import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEMO_CABS, demoCabsAt, positionOnLoop } from '../src/lib/demoCabs.js'
import { carLine, matchesFilters, monthYear, telHref } from '../src/lib/format.js'
import { DC_CENTER, distanceKm, etaMinutes, offsetKm } from '../src/lib/geo.js'
import { STRINGS, translate } from '../src/lib/strings.js'

test('distance: the White House to the Capitol is about 2.5 km', () => {
  const km = distanceKm(38.8977, -77.0365, 38.8899, -77.0091)
  assert.ok(km > 2.3 && km < 2.7, `got ${km}`)
})

test('offsetKm moves a point the distance asked for', () => {
  const p = offsetKm(DC_CENTER, 1, 2)
  const km = distanceKm(DC_CENTER.lat, DC_CENTER.lng, p.lat, p.lng)
  assert.ok(Math.abs(km - Math.hypot(1, 2)) < 0.02, `got ${km}`)
})

test('ETA is never under 1 minute and grows with distance', () => {
  assert.equal(etaMinutes(0), 1)
  assert.ok(etaMinutes(5) > etaMinutes(1))
})

test('a cab drives all four sides of its loop and returns to the start', () => {
  const loop = { east: 0, north: 0, w: 1, h: 0.5, speedKmh: 3, phase: 0 } // 3 km/h on a 3 km loop = 1 lap per hour
  const hour = 3_600_000
  assert.deepEqual(positionOnLoop(loop, 0), { east: 0, north: 0 })
  assert.deepEqual(positionOnLoop(loop, hour / 6), { east: 0.5, north: 0 }) // halfway along the first side
  assert.deepEqual(positionOnLoop(loop, hour / 2), { east: 1, north: 0.5 }) // the far corner
  assert.deepEqual(positionOnLoop(loop, hour), { east: 0, north: 0 })
})

test('a parked cab stays put', () => {
  const loop = { east: 1, north: 1, w: 0, h: 0, speedKmh: 0, phase: 0 }
  assert.deepEqual(positionOnLoop(loop, 123456), { east: 1, north: 1 })
})

test('demo cabs come back closest first, all near the rider', () => {
  const cabs = demoCabsAt(DC_CENTER, 1_700_000_000_000)
  assert.equal(cabs.length, DEMO_CABS.length)
  cabs.forEach((cab, i) => {
    assert.ok(cab.distance_km < 5, `${cab.id} is ${cab.distance_km} km away`)
    if (i > 0) assert.ok(cab.eta_min >= cabs[i - 1].eta_min)
  })
})

test('filters keep only matching cabs', () => {
  const van = { wheelchair: true, seats: 6, payments: ['cash'] }
  const sedan = { wheelchair: false, seats: 4, payments: ['cash', 'card'] }
  const none = { wheelchair: false, six: false, card: false }
  assert.ok(matchesFilters(sedan, none))
  assert.ok(matchesFilters(van, { ...none, wheelchair: true, six: true }))
  assert.ok(!matchesFilters(sedan, { ...none, wheelchair: true }))
  assert.ok(!matchesFilters(van, { ...none, card: true }))
})

test('formatting: phone links, dates and car descriptions', () => {
  assert.equal(telHref('(202) 555-0142'), 'tel:2025550142')
  assert.equal(monthYear('2026-10', 'en'), 'Oct 2026')
  assert.equal(monthYear('2026-10', 'es'), 'oct 2026')
  const cab = { color: 'gray', make: 'Toyota', model: 'Camry' }
  assert.equal(carLine(cab, 'en', (k) => translate('en', k)), 'Gray Toyota Camry')
  assert.equal(carLine(cab, 'es', (k) => translate('es', k)), 'Toyota Camry gris')
})

test('translations: Spanish has every English key, with the same blanks', () => {
  const blanks = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join()
  assert.deepEqual(Object.keys(STRINGS.es).sort(), Object.keys(STRINGS.en).sort())
  for (const key of Object.keys(STRINGS.en)) {
    assert.equal(blanks(STRINGS.es[key]), blanks(STRINGS.en[key]), key)
  }
})

test('translate fills blanks and falls back to the key', () => {
  assert.equal(translate('en', 'call', { name: 'Samuel' }), 'Call Samuel')
  assert.equal(translate('es', 'call', { name: 'Marisol' }), 'Llamar a Marisol')
  assert.equal(translate('en', 'no.such.key'), 'no.such.key')
})

test('every demo cab color has a translation', () => {
  DEMO_CABS.forEach((cab) => assert.ok(STRINGS.en[`color.${cab.color}`], cab.color))
})
