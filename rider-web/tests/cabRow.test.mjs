import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { byEta, cabFromRow } from '../src/lib/cabRow.js'
import { carLine } from '../src/lib/format.js'
import { STRINGS, translate } from '../src/lib/strings.js'

// One row exactly as the database function nearby_cabs() returns it.
const ROW = {
  id: 'a1', display_name: 'Rosa', company_name: 'Test Cab Co', cab_number: '500', plate: 'H 00500',
  vehicle_color: 'blue', vehicle_make: 'Toyota', vehicle_model: 'Camry', seats: 4, wheelchair_accessible: false,
  payments: ['cash', 'card'], phone: '(202) 555-0100', license_checked_on: '2026-10-06',
  lat: 38.9123, lng: -77.0235, heading: 90, distance_km: 1.2, position_age_s: 4, is_demo: false,
}

test('a database row becomes the shape the screens use', () => {
  const cab = cabFromRow(ROW)
  assert.equal(cab.driver, 'Rosa')
  assert.equal(cab.company, 'Test Cab Co')
  assert.equal(cab.cabNumber, '500')
  assert.equal(cab.color, 'blue')
  assert.equal(cab.wheelchair, false)
  assert.equal(cab.licenseCheckedOn, '2026-10')
  assert.ok(cab.eta_min >= 1)
})

test('a missing license date stays missing instead of breaking', () => {
  assert.equal(cabFromRow({ ...ROW, license_checked_on: null }).licenseCheckedOn, null)
})

test('sorting: fewer minutes first, then shorter distance', () => {
  const near = cabFromRow({ ...ROW, id: 'n', distance_km: 0.3 })
  const nearer = cabFromRow({ ...ROW, id: 'm', distance_km: 0.2 })
  const far = cabFromRow({ ...ROW, id: 'f', distance_km: 4 })
  assert.deepEqual([far, near, nearer].sort(byEta).map((c) => c.id), ['m', 'n', 'f'])
})

test('every color the database allows has a translation (or, for "other", is left out)', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261118000000_init.sql', import.meta.url), 'utf8')
  const allowed = sql.match(/vehicle_color in \(([^)]+)\)/)[1].match(/'(\w+)'/g).map((s) => s.slice(1, -1))
  for (const color of allowed.filter((c) => c !== 'other')) {
    assert.ok(STRINGS.en[`color.${color}`] && STRINGS.es[`color.${color}`], color)
  }
  const t = (k) => translate('en', k)
  assert.equal(carLine({ color: 'other', make: 'Ford', model: 'Fusion' }, 'en', t), 'Ford Fusion')
})
