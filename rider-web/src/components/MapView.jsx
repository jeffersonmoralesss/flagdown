import { useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useT } from '../lib/i18n.jsx'

// After bundling, MapLibre can't find its worker next to its own code, so point it at the copy Vite ships.
setWorkerUrl(workerUrl)

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty'

// Map of the rider and the free cabs around them.
//
// React normally owns the page's HTML, but MapLibre draws its own map and manages its own pins.
// So this component creates the map once, keeps it in a ref (a box React doesn't re-render), and
// uses effects to push changes into it: recenter, move the "you" dot, add/move/remove cab pins.
//
// Each cab pin shows its minutes away, the same number as the list, so the two are easy to match.
export default function MapView({ center, userLocation, cabs, selectedId, onSelect, glideMs }) {
  const { t } = useT()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const glidesRef = useRef(new Map()) // cab id -> the animation frame that is moving its pin
  const userMarkerRef = useRef(null)
  const [failed, setFailed] = useState(false)

  // Create the map once.
  useEffect(() => {
    let map
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: STYLE_URL,
        center: [center.lng, center.lat],
        zoom: 13.5,
        attributionControl: { compact: true },
      })
    } catch {
      setFailed(true)
      return undefined
    }
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    const markers = markersRef.current
    const glides = glidesRef.current
    return () => {
      glides.forEach((frame) => cancelAnimationFrame(frame))
      glides.clear()
      markers.forEach((m) => m.remove())
      markers.clear()
      userMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recenter when the search point changes.
  useEffect(() => {
    const map = mapRef.current
    map?.easeTo({ center: [center.lng, center.lat], animate: map.loaded() && !reducedMotion() })
  }, [center.lat, center.lng])

  // The rider's own position.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userLocation) return
    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'you-dot'
      userMarkerRef.current = new Marker({ element: el })
    }
    userMarkerRef.current.getElement().setAttribute('aria-label', t('map.you'))
    userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]).addTo(map)
  }, [userLocation, t])

  // Cab pins: add, move and remove to match the list.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = markersRef.current
    const glides = glidesRef.current
    const seen = new Set()

    cabs.forEach((cab) => {
      seen.add(cab.id)
      let marker = markers.get(cab.id)
      const target = [cab.lng, cab.lat]
      if (!marker) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'cab-pin'
        el.addEventListener('click', (event) => {
          event.stopPropagation()
          onSelect(el.dataset.id)
        })
        marker = new Marker({ element: el, anchor: 'bottom', offset: [0, -7] }) // the pin's tip sits on the cab
        marker.setLngLat(target).addTo(map)
        markers.set(cab.id, marker)
      } else {
        glide(cab.id, marker, target)
      }
      const el = marker.getElement()
      el.dataset.id = cab.id
      el.textContent = `${cab.eta_min} ${t('eta.min')}`
      el.setAttribute('aria-label', t('map.pin', { driver: cab.driver, n: cab.eta_min }))
      el.classList.toggle('selected', cab.id === selectedId)
      el.style.zIndex = cab.id === selectedId ? '2' : '1'
    })

    markers.forEach((marker, id) => {
      if (!seen.has(id)) {
        cancelAnimationFrame(glides.get(id))
        glides.delete(id)
        marker.remove()
        markers.delete(id)
      }
    })

    // Slide a pin from where it is to where the cab is now, instead of jumping. The slide lasts as
    // long as the gap between updates, so a moving cab looks like it is driving smoothly.
    function glide(id, marker, [toLng, toLat]) {
      cancelAnimationFrame(glides.get(id))
      const from = marker.getLngLat()
      if (reducedMotion() || !glideMs || (from.lng === toLng && from.lat === toLat)) {
        marker.setLngLat([toLng, toLat])
        return
      }
      const started = performance.now()
      const step = (now) => {
        const k = Math.min(1, (now - started) / glideMs)
        marker.setLngLat([from.lng + (toLng - from.lng) * k, from.lat + (toLat - from.lat) * k])
        if (k < 1) glides.set(id, requestAnimationFrame(step))
      }
      glides.set(id, requestAnimationFrame(step))
    }
  }, [cabs, selectedId, onSelect, glideMs, t])

  // Frame the rider and the four closest cabs, once per search point.
  // Only once, so live updates never yank the map away while the rider is panning it.
  const framedRef = useRef(null)
  useEffect(() => {
    const map = mapRef.current
    const key = `${center.lat},${center.lng}`
    if (!map || cabs.length === 0 || framedRef.current === key) return
    framedRef.current = key
    const points = [[center.lng, center.lat], ...cabs.slice(0, 4).map((cab) => [cab.lng, cab.lat])]
    const lngs = points.map((p) => p[0])
    const lats = points.map((p) => p[1])
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      // Jump if the style is still loading (animations wait on it); animate once it's ready.
      { padding: { top: 56, bottom: 32, left: 48, right: 64 }, maxZoom: 15, animate: map.loaded() && !reducedMotion() },
    )
  }, [cabs, center.lat, center.lng])

  if (failed) {
    return (
      <div className="map map-fallback">
        <p>{t('map.failed')}</p>
      </div>
    )
  }

  return <div className="map" ref={containerRef} role="region" aria-label={t('map.label')} />
}
