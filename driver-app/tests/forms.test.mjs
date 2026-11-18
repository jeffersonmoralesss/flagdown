import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { carLine, riderTags } from '../src/lib/format.js';
import { formatDate, timeAgo } from '../src/lib/dates.js';
import { STRINGS, translate } from '../src/i18n/strings.js';
import { subscriptionMessage, subscriptionOk } from '../src/lib/subscription.js';
import { checkDriverForm, checkExpiryDate, checkPhone, cleanDriverForm, COLORS, FIELD_LIMITS } from '../src/lib/validate.js';

const GOOD = {
  display_name: 'Rosa', legal_name: 'Rosa Test', phone: '(202) 555-0100', dfhv_license_number: 'DFHV-555',
  company_name: 'Test Cab Co', cab_number: '500', plate: 'h 00500', vehicle_color: 'blue', vehicle_make: 'Toyota',
  vehicle_model: 'Camry', seats: 4, wheelchair_accessible: false, payments: ['cash', 'card'],
};
const migration = readFileSync(new URL('../../supabase/migrations/20261118000000_init.sql', import.meta.url), 'utf8');

test('a complete form passes', () => {
  assert.equal(checkDriverForm(GOOD).ok, true);
});

test('empty, too long and missing fields are caught by name', () => {
  const { errors } = checkDriverForm({ ...GOOD, display_name: ' ', plate: 'X'.repeat(13), payments: [], vehicle_color: '' });
  assert.equal(errors.display_name.key, 'err.required');
  assert.equal(errors.plate.key, 'err.tooLong');
  assert.equal(errors.payments.key, 'err.payments');
  assert.equal(errors.vehicle_color.key, 'err.required');
});

test('phone numbers', () => {
  assert.equal(checkPhone('(202) 555-0142'), null);
  assert.equal(checkPhone('+1 202 555 0142'), null);
  assert.equal(checkPhone('call me').key, 'err.phone');
});

test('cleaning trims text and uppercases the plate', () => {
  const clean = cleanDriverForm({ ...GOOD, display_name: '  Rosa ' });
  assert.equal(clean.display_name, 'Rosa');
  assert.equal(clean.plate, 'H 00500');
});

test('form limits and colors match the database rules exactly', () => {
  for (const [field, { min, max }] of Object.entries(FIELD_LIMITS)) {
    assert.ok(migration.includes(`char_length(${field}) between ${min} and ${max}`), field);
  }
  const dbColors = migration.match(/vehicle_color in \(([^)]+)\)/)[1].match(/'(\w+)'/g).map((c) => c.slice(1, -1));
  assert.deepEqual([...COLORS].sort(), [...dbColors].sort());
});

test('expiry dates', () => {
  const today = new Date(2026, 10, 18);
  assert.equal(checkExpiryDate('2027-06-30', today), null);
  assert.equal(checkExpiryDate('2026-11-18', today), null);
  assert.equal(checkExpiryDate('06/30/2027', today).key, 'err.date');
  assert.equal(checkExpiryDate('2027-02-31', today).key, 'err.dateMissing');
  assert.equal(checkExpiryDate('2026-11-17', today).key, 'err.datePast');
});

test('subscription matches the database: grace of 3 days, none and canceled are off', () => {
  const now = Date.UTC(2026, 10, 18);
  const day = 86_400_000;
  assert.equal(subscriptionOk({ subscription_status: 'none' }, now), false);
  assert.equal(subscriptionOk({ subscription_status: 'canceled' }, now), false);
  assert.equal(subscriptionOk({ subscription_status: 'trialing', subscription_ends_at: new Date(now + day).toISOString() }, now), true);
  assert.equal(subscriptionOk({ subscription_status: 'active', subscription_ends_at: new Date(now - 2 * day).toISOString() }, now), true);
  assert.equal(subscriptionOk({ subscription_status: 'active', subscription_ends_at: new Date(now - 4 * day).toISOString() }, now), false);
  assert.equal(subscriptionMessage({ subscription_status: 'trialing', subscription_ends_at: '2026-12-18T00:00:00Z' }, now).key, 'home.subTrial');
  assert.equal(subscriptionMessage({ subscription_status: 'none' }, now).key, 'home.subNone');
});

test('car line and rider tags match the rider app', () => {
  const t = (k, v) => translate('en', k, v);
  const ts = (k, v) => translate('es', k, v);
  assert.equal(carLine({ ...GOOD, vehicle_color: 'gray' }, 'en', t), 'Gray Toyota Camry');
  assert.equal(carLine({ ...GOOD, vehicle_color: 'gray' }, 'es', ts), 'Toyota Camry gris');
  assert.equal(carLine({ ...GOOD, vehicle_color: 'other' }, 'en', t), 'Toyota Camry');
  assert.deepEqual(riderTags({ ...GOOD, seats: 6, wheelchair_accessible: true, payments: ['cash'] }, t), ['Wheelchair accessible', '6 seats', 'Cash only']);
});

test('dates and "ago"', () => {
  assert.equal(formatDate('2027-06-30', 'en'), 'Jun 30, 2027');
  assert.equal(formatDate('2027-06-30', 'es'), '30 jun 2027');
  assert.deepEqual(timeAgo(1000, 1000 + 30_000), { key: 'ago.now', n: 0 });
  assert.deepEqual(timeAgo(0, 3 * 60_000), { key: 'ago.min', n: 3 });
});

test('Spanish has every English key, with the same blanks', () => {
  const blanks = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  assert.deepEqual(Object.keys(STRINGS.es).sort(), Object.keys(STRINGS.en).sort());
  for (const key of Object.keys(STRINGS.en)) assert.equal(blanks(STRINGS.es[key]), blanks(STRINGS.en[key]), key);
});

test('every translation key used in the code exists', () => {
  // Finds every t('some.key') in the app's code (a plain t, not the end of a word like request).
  const { readdirSync, readFileSync: read } = process.getBuiltinModule('node:fs');
  const root = new URL('../', import.meta.url);
  const files = ['App.js', ...readdirSync(new URL('src', root), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => `src/${f}`)];
  const code = files.map((f) => read(new URL(f, root), 'utf8')).join('\n');
  const used = new Set([...code.matchAll(/(?<![\w.])t\('([\w.]+)'/g)].map((m) => m[1]));
  assert.ok(used.size > 50, `found ${used.size} keys`);
  for (const key of used) assert.ok(key in STRINGS.en, `missing key: ${key}`);
});
