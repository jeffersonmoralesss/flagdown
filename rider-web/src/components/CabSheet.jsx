import { useEffect, useRef, useState } from 'react'
import { carLine, monthYear, telHref } from '../lib/format.js'
import { useT } from '../lib/i18n.jsx'
import { BackIcon, CloseIcon, PhoneIcon, ShareIcon } from './Icons.jsx'

// Everything about one cab, with the Call button. On a phone it slides up from the bottom;
// on a wide screen it covers the list on the left.
export default function CabSheet({ cab, onClose }) {
  const { t, lang } = useT()
  const headingRef = useRef(null)
  const [shareNote, setShareNote] = useState(null)

  // When the sheet opens, move keyboard and screen-reader focus into it. Escape closes it.
  useEffect(() => {
    headingRef.current?.focus()
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cab.id, onClose])

  const car = carLine(cab, lang, t)

  // A safety habit worth making easy: send the driver, car and plate to a friend before the ride.
  // Phones open their own share menu. Browsers without one copy the text instead.
  const share = async () => {
    const text = t('share.text', { driver: cab.driver, company: cab.company, cab: cab.cabNumber, car, plate: cab.plate })
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setShareNote(t('share.copied'))
    } catch (error) {
      if (error?.name !== 'AbortError') setShareNote(t('share.failed')) // AbortError = the rider closed the share menu
    }
  }

  const pay = cab.payments.map((p) => t(`pay.${p}`)).join(', ')

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-top">
          <button type="button" className="sheet-back" onClick={onClose}>
            <BackIcon />
            {t('sheet.back')}
          </button>
          <button type="button" className="sheet-close" onClick={onClose} aria-label={t('sheet.close')}>
            <CloseIcon />
          </button>
        </div>

        <p className="sheet-eta">{t('eta.away', { n: cab.eta_min })}</p>
        <h2 id="sheet-title" className="sheet-title" tabIndex={-1} ref={headingRef}>
          {cab.driver}
        </h2>
        <p className="sheet-company">{cab.company}</p>

        <a className="button button-primary button-call" href={telHref(cab.phone)}>
          <PhoneIcon />
          {t('call', { name: cab.driver })}
        </a>
        <p className="call-number">{cab.phone}</p>
        <p className="call-hint">{t('call.hint')}</p>

        <dl className="facts">
          <Fact label={t('fact.car')}>{car}</Fact>
          <Fact label={t('fact.plate')}>
            <span className="plate">{cab.plate}</span>
          </Fact>
          <Fact label={t('fact.cab')}>{cab.cabNumber}</Fact>
          <Fact label={t('fact.seats')}>{cab.seats}</Fact>
          <Fact label={t('fact.wheelchair')}>{cab.wheelchair ? t('yes') : t('no')}</Fact>
          <Fact label={t('fact.pay')}>{pay}</Fact>
          <Fact label={t('fact.fare')}>{t('fact.fareValue')}</Fact>
          {cab.licenseCheckedOn && (
            <Fact label={t('fact.license')}>{t('fact.licenseValue', { date: monthYear(cab.licenseCheckedOn, lang) })}</Fact>
          )}
        </dl>

        <button type="button" className="button button-quiet" onClick={share}>
          <ShareIcon />
          {t('share.button')}
        </button>
        {/* role="status" makes screen readers announce the note when it appears */}
        <p className="share-note" role="status">
          {shareNote}
        </p>
        {cab.is_demo && <p className="fine-print">{t('list.demo')}</p>}
      </section>
    </>
  )
}

function Fact({ label, children }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
