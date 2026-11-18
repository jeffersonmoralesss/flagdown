// Date helpers. Dates from the database arrive as 'YYYY-MM-DD' text, or as full timestamps.

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
};

// '2027-06-30' -> 'Jun 30, 2027' or '30 jun 2027'. Built from the text, so the phone's time zone can
// never shift it to the day before (which `new Date('2027-06-30')` can do west of Greenwich).
export function formatDate(iso, lang = 'en') {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const month = (MONTHS[lang] ?? MONTHS.en)[m - 1];
  return lang === 'es' ? `${d} ${month} ${y}` : `${month} ${d}, ${y}`;
}

// A timestamp ('2026-12-18T15:04:05+00:00') as a date in the phone's own time zone.
export function formatTimestampDate(ts, lang = 'en') {
  const t = new Date(ts);
  const mm = String(t.getMonth() + 1).padStart(2, '0');
  const dd = String(t.getDate()).padStart(2, '0');
  return formatDate(`${t.getFullYear()}-${mm}-${dd}`, lang);
}

// Today plus n days, as 'YYYY-MM-DD' in the phone's local time.
export function addDays(n, from = new Date()) {
  const t = new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);
  const mm = String(t.getMonth() + 1).padStart(2, '0');
  const dd = String(t.getDate()).padStart(2, '0');
  return `${t.getFullYear()}-${mm}-${dd}`;
}

// How long ago, as a translation key and number: { key: 'ago.min', n: 3 }.
export function timeAgo(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return { key: 'ago.now', n: 0 };
  const m = Math.round(s / 60);
  if (m < 60) return { key: 'ago.min', n: m };
  return { key: 'ago.hour', n: Math.round(m / 60) };
}
