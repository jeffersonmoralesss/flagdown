import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allRequiredValid, daysUntil, summarize, uploadedCount } from '../src/lib/documents.js';

const today = new Date(2026, 10, 18); // Nov 18, 2026 (months count from 0)
const doc = (kind, expires_on, verified, created_at = '2026-11-01') => ({ kind, expires_on, verified, created_at });
const allThree = (verified, expires = '2027-06-30') => [
  doc('dfhv_license', expires, verified),
  doc('vehicle_registration', expires, verified),
  doc('insurance', expires, verified),
];

test('days until an expiry date', () => {
  assert.equal(daysUntil('2026-11-18', today), 0);
  assert.equal(daysUntil('2026-11-19', today), 1);
  assert.equal(daysUntil('2026-11-17', today), -1);
  assert.equal(daysUntil('2026-11-19T00:00:00.000Z', today), 1, 'a full timestamp reads the same');
});

test('nothing uploaded: missing, and 0 of 3', () => {
  assert.equal(summarize([], 'insurance', today).state, 'missing');
  assert.equal(uploadedCount([], today), 0);
});

test('uploaded but not reviewed: waiting for review, counts as uploaded, not valid', () => {
  const docs = allThree(false);
  assert.equal(summarize(docs, 'insurance', today).state, 'review');
  assert.equal(uploadedCount(docs, today), 3);
  assert.equal(allRequiredValid(docs, today), false);
});

test('all three verified: valid', () => {
  assert.equal(allRequiredValid(allThree(true), today), true);
});

test('missing one of the three: not valid', () => {
  assert.equal(allRequiredValid(allThree(true).slice(0, 2), today), false);
});

test('expiring within 30 days, and expired', () => {
  assert.equal(summarize([doc('insurance', '2026-12-01', true)], 'insurance', today).state, 'expiring');
  assert.equal(summarize([doc('insurance', '2026-11-17', true)], 'insurance', today).state, 'expired');
  assert.equal(summarize([doc('insurance', '2026-11-18', true)], 'insurance', today).state, 'expiring', 'the expiry day itself still counts');
});

test('renewing: the old verified copy keeps you valid while the new one is reviewed', () => {
  const docs = [doc('insurance', '2026-12-01', true, '2026-01-01'), doc('insurance', '2027-12-01', false, '2026-11-15')];
  const s = summarize(docs, 'insurance', today);
  assert.equal(s.state, 'expiring');
  assert.ok(s.current && s.pending);
});
