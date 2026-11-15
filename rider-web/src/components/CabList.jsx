import { carLine } from '../lib/format.js'
import { useT } from '../lib/i18n.jsx'
import { ChevronIcon, WheelchairIcon } from './Icons.jsx'

// The three filters. Each is an on/off button; aria-pressed tells screen readers which are on.
const FILTERS = ['wheelchair', 'six', 'card']

export function Filters({ filters, onChange }) {
  const { t } = useT()
  return (
    <div className="filters" role="group" aria-label={t('filter.label')}>
      {FILTERS.map((key) => (
        <button
          key={key}
          type="button"
          className="chip"
          aria-pressed={filters[key]}
          onClick={() => onChange({ ...filters, [key]: !filters[key] })}
        >
          {t(`filter.${key}`)}
        </button>
      ))}
    </div>
  )
}

// One row per cab: minutes away on the left, then who and what, then an arrow.
// The whole row is one big button, so it is easy to tap and works with a keyboard.
export default function CabList({ cabs, selectedId, onSelect }) {
  const { t, lang } = useT()
  return (
    <ul className="cab-list">
      {cabs.map((cab) => (
        <li key={cab.id}>
          <button
            type="button"
            className={`cab-row${cab.id === selectedId ? ' selected' : ''}`}
            onClick={() => onSelect(cab.id)}
            aria-label={t('row.label', { driver: cab.driver, company: cab.company, n: cab.eta_min })}
          >
            <span className="eta" aria-hidden="true">
              <span className="eta-number">{cab.eta_min}</span>
              <span className="eta-unit">{t('eta.min')}</span>
            </span>
            <span className="cab-body" aria-hidden="true">
              <span className="cab-name">{cab.driver}</span>
              <span className="cab-company">{cab.company}</span>
              <span className="cab-car">
                {carLine(cab, lang, t)} <span className="plate">{cab.plate}</span>
              </span>
              <CabTags cab={cab} />
            </span>
            <span className="cab-arrow">
              <ChevronIcon />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// Only facts that change a rider's choice get a tag: wheelchair access, a bigger cab, or a payment limit.
function CabTags({ cab }) {
  const { t } = useT()
  const tags = []
  if (cab.wheelchair) tags.push({ key: 'w', text: t('tag.wheelchair'), icon: true })
  if (cab.seats >= 6) tags.push({ key: 's', text: t('tag.seats', { n: cab.seats }) })
  if (!cab.payments.includes('card')) tags.push({ key: 'c', text: t('tag.cashOnly') })
  if (!cab.payments.includes('cash')) tags.push({ key: 'k', text: t('tag.cardOnly') })
  if (tags.length === 0) return null
  return (
    <span className="tags">
      {tags.map((tag) => (
        <span key={tag.key} className="tag">
          {tag.icon && <WheelchairIcon />}
          {tag.text}
        </span>
      ))}
    </span>
  )
}
