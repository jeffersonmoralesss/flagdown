import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CabList, { Filters } from './components/CabList.jsx'
import CabSheet from './components/CabSheet.jsx'
import Welcome from './components/Welcome.jsx'
import { fetchNearbyCabs, isDemo, REFRESH_MS } from './lib/api.js'
import { APP_NAME } from './lib/brand.js'
import { matchesFilters } from './lib/format.js'
import { DC_CENTER, getCurrentPosition } from './lib/geo.js'
import { useT } from './lib/i18n.jsx'

// The map library is large. lazy() splits it into its own file that only downloads when the map
// first shows, after the welcome screen, so the first screen opens fast on a weak signal.
const MapView = lazy(() => import('./components/MapView.jsx'))

const NO_FILTERS = { wheelchair: false, six: false, card: false }

export default function App() {
  const { t, lang, setLang } = useT()
  // `start` is null on the welcome screen. After that it is { position }, where position is the
  // rider's location, or null if they skipped it or the phone couldn't tell.
  const [start, setStart] = useState(null)

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">{APP_NAME}</span>
        {isDemo && <span className="demo-pill">{t('demo')}</span>}
        <button
          type="button"
          className="lang-button"
          lang={lang === 'en' ? 'es' : 'en'}
          aria-label={t('lang.switchLabel')}
          onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
        >
          {t('lang.switch')}
        </button>
      </header>
      {start ? <FindCab initialPosition={start.position} /> : <Welcome onStart={(position) => setStart({ position })} />}
    </div>
  )
}

function FindCab({ initialPosition }) {
  const { t } = useT()
  const [userLocation, setUserLocation] = useState(initialPosition)
  const [locationNote, setLocationNote] = useState(null)
  const [cabs, setCabs] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [filters, setFilters] = useState(NO_FILTERS)
  const [selectedId, setSelectedId] = useState(null)

  // Cabs are searched around the rider, or around downtown DC when there's no location.
  const searchPoint = userLocation ?? DC_CENTER
  // A ref always holds the latest search point, so load() below can stay the same function forever
  // and the refresh timer doesn't restart on every render.
  const searchRef = useRef(searchPoint)
  searchRef.current = searchPoint

  const load = useCallback(async ({ first = false } = {}) => {
    if (first) setStatus('loading')
    try {
      setCabs(await fetchNearbyCabs(searchRef.current, { first }))
      setStatus('ready')
    } catch {
      // A failed background refresh keeps the list the rider is already looking at.
      setStatus((s) => (!first && s === 'ready' ? s : 'error'))
    }
  }, [])

  // Load on start and whenever the search point moves, then keep refreshing.
  useEffect(() => {
    load({ first: true })
    const timer = setInterval(() => {
      // Skip refreshes while the tab is hidden: saves the rider's data and battery.
      if (document.visibilityState === 'visible') load()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [searchPoint.lat, searchPoint.lng, load])

  const useMyLocation = async () => {
    setLocationNote(null)
    const position = await getCurrentPosition()
    if (position) setUserLocation(position)
    else setLocationNote(t('loc.denied'))
  }

  const visible = useMemo(() => cabs.filter((cab) => matchesFilters(cab, filters)), [cabs, filters])
  const selected = useMemo(() => cabs.find((cab) => cab.id === selectedId) ?? null, [cabs, selectedId])
  const closeSheet = useCallback(() => setSelectedId(null), [])

  return (
    <main className="find">
      <div className="panel">
        {!userLocation && (
          <div className="notice">
            <p>{locationNote ?? t('loc.off')}</p>
            <button type="button" className="link-button" onClick={useMyLocation}>
              {t('loc.use')}
            </button>
          </div>
        )}
        <Results
          status={status}
          cabs={cabs}
          visible={visible}
          filters={filters}
          onFilters={setFilters}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRetry={() => load({ first: true })}
        />
      </div>
      <Suspense fallback={<div className="map map-fallback">{t('map.loading')}</div>}>
        <MapView
          center={searchPoint}
          userLocation={userLocation}
          cabs={visible}
          selectedId={selectedId}
          onSelect={setSelectedId}
          glideMs={REFRESH_MS}
        />
      </Suspense>
      {selected && <CabSheet cab={selected} onClose={closeSheet} />}
    </main>
  )
}

function Results({ status, cabs, visible, filters, onFilters, selectedId, onSelect, onRetry }) {
  const { t } = useT()

  if (status === 'loading' && cabs.length === 0) {
    return (
      <p className="state" role="status">
        {t('list.loading')}
      </p>
    )
  }
  if (status === 'error' && cabs.length === 0) {
    return (
      <div className="state" role="alert">
        <p>{t('list.error')}</p>
        <button type="button" className="button button-primary" onClick={onRetry}>
          {t('list.retry')}
        </button>
      </div>
    )
  }
  if (cabs.length === 0) {
    return (
      <p className="state" role="status">
        {t('list.none')}
      </p>
    )
  }

  const count = visible.length === 1 ? t('list.count.one') : t('list.count.other', { n: visible.length })
  return (
    <>
      <h1 className="list-title">{count}</h1>
      <p className="list-sub">{t('list.sub')}</p>
      <Filters filters={filters} onChange={onFilters} />
      {visible.length === 0 ? (
        <div className="state">
          <p>{t('list.noMatch')}</p>
          <button type="button" className="button button-quiet" onClick={() => onFilters(NO_FILTERS)}>
            {t('list.showAll')}
          </button>
        </div>
      ) : (
        <CabList cabs={visible} selectedId={selectedId} onSelect={onSelect} />
      )}
      <p className="fine-print">
        {t('list.estimates')} {cabs.some((cab) => cab.is_demo) && t('list.demo')}
      </p>
    </>
  )
}
