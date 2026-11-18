// Form checks that mirror the database's own rules (supabase/migrations/..._init.sql).
// The database would reject bad data anyway; checking here first shows a clear message next to the
// right field instead of a raw database error.
//
// Each check returns null when the value is fine, or { key, vars } naming the message in
// src/i18n/strings.js, so the screen can show it in English or Spanish.

export const PHONE_PATTERN = /^\+?[0-9 ().-]{7,20}$/; // the same pattern as drivers.phone

const err = (key, vars) => ({ key, vars });

export function checkText(value, { min = 1, max }) {
  const v = (value ?? '').trim();
  if (!v) return err('err.required');
  if (v.length < min) return err('err.tooShort', { n: min });
  if (max && v.length > max) return err('err.tooLong', { n: max });
  return null;
}

export function checkPhone(value) {
  const v = (value ?? '').trim();
  if (!v) return err('err.required');
  return PHONE_PATTERN.test(v) ? null : err('err.phone');
}

export function checkEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value ?? '').trim()) ? null : err('err.email');
}

export function checkPassword(value) {
  return (value ?? '').length >= 8 ? null : err('err.password');
}

// The limits on each driver field, the same numbers as the database's CHECK rules.
export const FIELD_LIMITS = {
  display_name: { min: 1, max: 40 },
  legal_name: { min: 2, max: 120 },
  dfhv_license_number: { min: 2, max: 30 },
  company_name: { min: 2, max: 80 },
  cab_number: { min: 1, max: 12 },
  plate: { min: 2, max: 12 },
  vehicle_make: { min: 2, max: 30 },
  vehicle_model: { min: 1, max: 30 },
};

export const COLORS = ['black', 'blue', 'gray', 'green', 'red', 'silver', 'white', 'yellow', 'other'];
export const SEAT_CHOICES = [4, 5, 6, 7, 8];
export const PAYMENT_CHOICES = ['cash', 'card'];

// Checks a whole driver form at once. Returns { errors, ok } where errors maps field -> message.
export function checkDriverForm(form) {
  const errors = {};
  for (const [field, limits] of Object.entries(FIELD_LIMITS)) {
    const e = checkText(form[field], limits);
    if (e) errors[field] = e;
  }
  const phone = checkPhone(form.phone);
  if (phone) errors.phone = phone;
  if (!COLORS.includes(form.vehicle_color)) errors.vehicle_color = err('err.required');
  if (!(form.seats >= 1 && form.seats <= 8)) errors.seats = err('err.required');
  if (!form.payments?.length) errors.payments = err('err.payments');
  return { errors, ok: Object.keys(errors).length === 0 };
}

// Trims every text field, so ' Samuel ' is saved as 'Samuel'.
export function cleanDriverForm(form) {
  const out = { ...form };
  for (const field of [...Object.keys(FIELD_LIMITS), 'phone']) out[field] = (form[field] ?? '').trim();
  out.plate = out.plate.toUpperCase();
  return out;
}

// Expiry dates are typed as YYYY-MM-DD, so no date-picker library is needed and it works the same on
// phones and the web. `today` is passed in so tests can control it.
export function checkExpiryDate(value, today = new Date()) {
  const v = (value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return err('err.date');
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // new Date() quietly rolls 2027-02-31 into March; reject dates that changed.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return err('err.dateMissing');
  if (date.getTime() < Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) return err('err.datePast');
  return null;
}
