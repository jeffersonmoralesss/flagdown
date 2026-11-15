import { useState } from 'react'
import { getCurrentPosition } from '../lib/geo.js'
import { useT } from '../lib/i18n.jsx'

// The first screen. It explains the app in three steps and asks for location only when the rider
// taps the button, so the browser's permission pop-up appears at a moment that makes sense.
export default function Welcome({ onStart }) {
  const { t } = useT()
  const [locating, setLocating] = useState(false)

  const findNearMe = async () => {
    setLocating(true)
    const position = await getCurrentPosition() // null when the rider says no or the phone can't tell
    onStart(position)
  }

  return (
    <main className="welcome">
      <div className="welcome-inner">
        <h1 className="welcome-title">{t('welcome.title')}</h1>
        <ol className="steps">
          <li>{t('welcome.step1')}</li>
          <li>{t('welcome.step2')}</li>
          <li>{t('welcome.step3')}</li>
        </ol>
        <div className="welcome-actions">
          <button type="button" className="button button-primary" onClick={findNearMe} disabled={locating}>
            {locating ? t('welcome.locating') : t('welcome.find')}
          </button>
          <button type="button" className="button button-quiet" onClick={() => onStart(null)} disabled={locating}>
            {t('welcome.downtown')}
          </button>
        </div>
        <p className="welcome-note">{t('welcome.free')} {t('welcome.why')}</p>
      </div>
    </main>
  )
}
