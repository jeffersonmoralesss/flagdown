export function telHref(phone) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

// "Gray Toyota Camry" in English, "Toyota Camry gris" in Spanish (the color comes last in Spanish).
export function carLine(cab, lang, t) {
  const color = t(`color.${cab.color}`)
  const car = `${cab.make} ${cab.model}`
  if (lang === 'es') return `${car} ${color.toLowerCase()}`
  return `${color} ${car}`
}

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
}

// '2026-10' -> 'Oct 2026'. Built from the text, so a time zone can't shift the month.
export function monthYear(yearMonth, lang = 'en') {
  const months = MONTHS[lang] ?? MONTHS.en
  return `${months[Number(yearMonth.slice(5, 7)) - 1]} ${yearMonth.slice(0, 4)}`
}

// Which filters a cab passes. `filters` looks like { wheelchair: true, six: false, card: false }.
export function matchesFilters(cab, filters) {
  if (filters.wheelchair && !cab.wheelchair) return false
  if (filters.six && cab.seats < 6) return false
  if (filters.card && !cab.payments.includes('card')) return false
  return true
}
