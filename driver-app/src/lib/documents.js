// Works out what to tell the driver about each document. Plain functions (no React, no network), so
// the rules are easy to read and are covered by tests/documents.test.mjs.

// The three documents the database requires before a cab can appear (see documents_ok() in the migration).
export const REQUIRED_KINDS = ['dfhv_license', 'vehicle_registration', 'insurance'];

const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPIRING_SOON_DAYS = 30;

// Whole days from `today` until an expiry date ('YYYY-MM-DD'). Negative once it has passed.
// Only the first 10 characters are read, so a full timestamp ('2027-08-31T00:00:00Z') works too.
export function daysUntil(expiresOn, today = new Date()) {
  if (!expiresOn) return Infinity;
  const [y, m, d] = String(expiresOn).slice(0, 10).split('-').map(Number);
  const end = Date.UTC(y, m - 1, d);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end - start) / DAY_MS);
}

// Matches the database: verified, and not expired (the expiry day itself still counts).
export function isValid(doc, today = new Date()) {
  return Boolean(doc?.verified) && daysUntil(doc.expires_on, today) >= 0;
}

// Summary for one kind of document. `docs` can be in any order.
//   current: the verified, unexpired record that keeps the driver visible (if any)
//   pending: a newer upload still waiting for review (if any)
//   state:   'missing' | 'review' | 'verified' | 'expiring' | 'expired'
// Each upload is a new record, so a driver renewing their insurance stays visible on the old,
// still-valid record while the new one is reviewed.
export function summarize(docs, kind, today = new Date()) {
  const ofKind = docs.filter((d) => d.kind === kind).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const current = ofKind.find((d) => isValid(d, today)) ?? null;
  const pending = ofKind.find((d) => !d.verified && daysUntil(d.expires_on, today) >= 0) ?? null;

  let state;
  if (current) state = daysUntil(current.expires_on, today) <= EXPIRING_SOON_DAYS ? 'expiring' : 'verified';
  else if (pending) state = 'review';
  else if (ofKind.length) state = 'expired';
  else state = 'missing';
  return { state, current, pending };
}

// Every required document verified and unexpired: what riders need to see you.
export function allRequiredValid(docs, today = new Date()) {
  return REQUIRED_KINDS.every((kind) => summarize(docs, kind, today).current);
}

// How many required documents are at least uploaded (verified or waiting for review).
export function uploadedCount(docs, today = new Date()) {
  return REQUIRED_KINDS.filter((kind) => !['missing', 'expired'].includes(summarize(docs, kind, today).state)).length;
}
