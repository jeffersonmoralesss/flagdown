// Checks the database rules: what riders, drivers and admins can and can't do.
// Run: cd supabase/tests && npm install && npm test
import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { as, fails, makeDb } from './db.mjs'

const DRIVER = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'
const ADMIN = '33333333-3333-3333-3333-333333333333'
const DOWNTOWN = [38.9007, -77.0365]

let db
let myId // the test driver's row id

const near = (lat = DOWNTOWN[0], lng = DOWNTOWN[1], radius = 8) =>
  as(db, 'anon', null, 'select * from public.nearby_cabs($1, $2, $3)', [lat, lng, radius]).then((r) => r.rows)
const row = (id) => db.query('select * from public.drivers where id = $1', [id]).then((r) => r.rows[0])
const asDriver = (sql, params) => as(db, 'authenticated', DRIVER, sql, params)
const asAdmin = (sql, params) => as(db, 'authenticated', ADMIN, sql, params, 2)

const NEW_DRIVER = `insert into public.drivers
  (display_name, legal_name, dfhv_license_number, phone, company_name, cab_number, plate,
   vehicle_color, vehicle_make, vehicle_model, status, subscription_status, is_available, is_demo)
  values ('Rosa', 'Rosa Test', 'DFHV-555', '(202) 555-0100', 'Test Cab Co', '500', 'H 00500',
          'blue', 'Toyota', 'Camry', 'approved', 'active', true, true)
  returning *`

before(async () => {
  db = await makeDb()
  await db.query(`insert into auth.users values ($1, 'driver@example.com'), ($2, 'other@example.com'), ($3, 'admin@example.com')`, [DRIVER, OTHER, ADMIN])
  await db.query(`insert into public.admins values ($1, 'admin@example.com')`, [ADMIN])
})

describe('riders (public key, no account)', () => {
  test('see the 8 demo cabs downtown, closest first', async () => {
    const cabs = await near()
    assert.equal(cabs.length, 8)
    cabs.slice(1).forEach((cab, i) => assert.ok(cab.distance_km >= cabs[i].distance_km))
  })

  test('get what the app shows, and nothing private', async () => {
    const [cab] = await near()
    for (const key of ['display_name', 'company_name', 'cab_number', 'plate', 'vehicle_color', 'phone', 'payments', 'license_checked_on']) {
      assert.ok(cab[key] != null, key)
    }
    for (const key of ['legal_name', 'dfhv_license_number', 'user_id', 'stripe_customer_id']) {
      assert.ok(!(key in cab), `${key} must not be returned`)
    }
  })

  test('positions are rounded to 4 decimals (about 11 meters)', async () => {
    const cabs = await near()
    for (const cab of cabs) {
      assert.ok(Math.abs(cab.lat * 1e4 - Math.round(cab.lat * 1e4)) < 1e-6)
      assert.ok(Math.abs(cab.lng * 1e4 - Math.round(cab.lng * 1e4)) < 1e-6)
    }
  })

  test('see nobody in New York, and the radius is capped at 15 km', async () => {
    assert.equal((await near(40.71, -74.0)).length, 0)
    const wide = await near(DOWNTOWN[0], DOWNTOWN[1], 500)
    assert.ok(wide.every((cab) => cab.distance_km <= 15))
  })

  test('get at most 25 cabs, whatever they ask for', async () => {
    const r = await as(db, 'anon', null, 'select count(*)::int n from public.nearby_cabs($1, $2, 15, 1000)', DOWNTOWN)
    assert.ok(r.rows[0].n <= 25)
  })

  test('cannot read any table directly', async () => {
    for (const table of ['drivers', 'driver_positions', 'driver_documents', 'location_pings', 'reports', 'admins', 'admin_log']) {
      assert.ok(await fails(() => as(db, 'anon', null, `select * from public.${table}`)), table)
    }
  })

  test('cannot run admin or housekeeping functions', async () => {
    for (const fn of ['purge_old_pings()', 'expire_stale_availability()', `start_free_trial(gen_random_uuid(), 30)`, `approve_driver(gen_random_uuid())`]) {
      assert.ok(await fails(() => as(db, 'anon', null, `select public.${fn}`)), fn)
    }
  })

  test('can report a driver, but not an unknown one', async () => {
    const [cab] = await near()
    const r = await as(db, 'anon', null, `select public.submit_report($1, 'overcharged', 'Meter was off', null) id`, [cab.id])
    assert.ok(r.rows[0].id)
    assert.ok(await fails(() => as(db, 'anon', null, `select public.submit_report(gen_random_uuid(), 'other', null, null)`)))
  })
})

describe('a new driver signing up', () => {
  test('is forced to pending, unsubscribed, not demo and not Available', async () => {
    const r = await asDriver(NEW_DRIVER)
    const me = r.rows[0]
    myId = me.id
    assert.equal(me.status, 'pending')
    assert.equal(me.subscription_status, 'none')
    assert.equal(me.is_demo, false)
    assert.equal(me.is_available, false)
    assert.equal(me.user_id, DRIVER)
  })

  test('cannot approve themselves, subscribe themselves, or switch Available on', async () => {
    await asDriver(`update public.drivers set status = 'approved', subscription_status = 'active', is_available = true where id = $1`, [myId])
    const me = await row(myId)
    assert.equal(me.status, 'pending')
    assert.equal(me.subscription_status, 'none')
    assert.equal(me.is_available, false)
  })

  test('cannot verify their own documents', async () => {
    const r = await asDriver(`insert into public.driver_documents (driver_id, kind, file_path, expires_on, verified)
      values ($1, 'dfhv_license', '${DRIVER}/license.pdf', current_date + 200, true) returning verified`, [myId])
    assert.equal(r.rows[0].verified, false)
  })

  test('is invisible to other signed-in users', async () => {
    const r = await as(db, 'authenticated', OTHER, 'select * from public.drivers')
    assert.equal(r.rows.length, 0)
    assert.ok(await fails(() => as(db, 'authenticated', OTHER, 'insert into public.driver_positions (driver_id, lat, lng) values ($1, 38.9, -77.0)', [myId])))
  })
})

describe('admins', () => {
  test('without two-step sign-in, an admin account has no powers', async () => {
    const r = await as(db, 'authenticated', ADMIN, 'select public.approve_driver($1)', [myId], 1).catch((e) => e)
    assert.ok(r instanceof Error)
    const list = await as(db, 'authenticated', ADMIN, 'select * from public.drivers', [], 1)
    assert.equal(list.rows.length, 0)
  })

  test('cannot approve a driver whose documents are missing', async () => {
    const r = await asAdmin('select public.approve_driver($1) r', [myId])
    assert.equal(r.rows[0].r.ok, false)
    assert.match(r.rows[0].r.message, /vehicle registration, insurance/)
  })

  test('approve a driver with all three documents, which verifies them', async () => {
    for (const kind of ['vehicle_registration', 'insurance']) {
      await asDriver(`insert into public.driver_documents (driver_id, kind, file_path, expires_on)
        values ($1, '${kind}', '${DRIVER}/${kind}.pdf', current_date + 200)`, [myId])
    }
    const r = await asAdmin('select public.approve_driver($1) r', [myId])
    assert.equal(r.rows[0].r.ok, true)
    assert.equal((await row(myId)).status, 'approved')
    const docs = await db.query('select bool_and(verified) v from public.driver_documents where driver_id = $1', [myId])
    assert.equal(docs.rows[0].v, true)
  })

  test('approval and verification are written to the activity log', async () => {
    const r = await db.query(`select action from public.admin_log where target_id = $1 or target_name like 'Rosa Test%'`, [myId])
    const actions = r.rows.map((x) => x.action)
    assert.ok(actions.includes('approved'))
    assert.ok(actions.includes('verified'))
  })
})

describe('an approved driver', () => {
  test('without a subscription cannot switch Available on', async () => {
    await asDriver('update public.drivers set is_available = true where id = $1', [myId])
    assert.equal((await row(myId)).is_available, false)
  })

  test('with a free trial can switch on, send a position, and appear to riders', async () => {
    const t = await asAdmin('select public.start_free_trial($1, 30) r', [myId])
    assert.equal(t.rows[0].r.ok, true)
    await asDriver('update public.drivers set is_available = true where id = $1', [myId])
    assert.equal((await row(myId)).is_available, true)
    await asDriver(`insert into public.driver_positions (driver_id, lat, lng, heading) values ($1, 38.912345, -77.023456, 90)
      on conflict (driver_id) do update set lat = excluded.lat, lng = excluded.lng`, [myId])
    const mine = (await near()).find((c) => c.id === myId)
    assert.ok(mine, 'should appear')
    assert.equal(mine.lat, 38.9123)
    assert.equal(mine.lng, -77.0235)
  })

  test('a free trial never shortens a longer one', async () => {
    const before = (await row(myId)).subscription_ends_at
    await asAdmin('select public.start_free_trial($1, 5)', [myId])
    assert.equal((await row(myId)).subscription_ends_at.getTime(), before.getTime())
  })

  test('can change their phone and payments, but not what riders recognize the cab by', async () => {
    await asDriver(`update public.drivers set phone = '(202) 555-0199', payments = array['cash'],
      plate = 'FAKE 1', display_name = 'Someone', dfhv_license_number = 'X', wheelchair_accessible = true where id = $1`, [myId])
    const me = await row(myId)
    assert.equal(me.phone, '(202) 555-0199')
    assert.deepEqual(me.payments, ['cash'])
    assert.equal(me.plate, 'H 00500')
    assert.equal(me.display_name, 'Rosa')
    assert.equal(me.dfhv_license_number, 'DFHV-555')
    assert.equal(me.wheelchair_accessible, false)
  })

  test('replacing a document clears its verification and hides the cab', async () => {
    await asDriver(`update public.driver_documents set file_path = '${DRIVER}/insurance-new.pdf' where driver_id = $1 and kind = 'insurance'`, [myId])
    const doc = await db.query(`select verified from public.driver_documents where driver_id = $1 and kind = 'insurance'`, [myId])
    assert.equal(doc.rows[0].verified, false)
    assert.ok(!(await near()).find((c) => c.id === myId))
    await db.query(`update public.driver_documents set verified = true where driver_id = $1`, [myId])
  })

  test('expired insurance hides the cab', async () => {
    await db.query(`update public.driver_documents set expires_on = current_date - 1 where driver_id = $1 and kind = 'insurance'`, [myId])
    assert.ok(!(await near()).find((c) => c.id === myId))
    await db.query(`update public.driver_documents set expires_on = current_date + 200 where driver_id = $1 and kind = 'insurance'`, [myId])
    assert.ok((await near()).find((c) => c.id === myId))
  })

  test('a position older than 3 minutes hides the cab', async () => {
    await db.query('alter table public.driver_positions disable trigger positions_touch')
    await db.query(`update public.driver_positions set updated_at = now() - interval '4 minutes' where driver_id = $1`, [myId])
    assert.ok(!(await near()).find((c) => c.id === myId))
    await db.query(`update public.driver_positions set updated_at = now() where driver_id = $1`, [myId])
    await db.query('alter table public.driver_positions enable trigger positions_touch')
  })

  test('an ended subscription hides the cab after 3 days of grace', async () => {
    await db.query(`update public.drivers set subscription_status = 'past_due', subscription_ends_at = now() - interval '1 day' where id = $1`, [myId])
    assert.ok((await near()).find((c) => c.id === myId), 'still shown 1 day after')
    await db.query(`update public.drivers set subscription_ends_at = now() - interval '4 days' where id = $1`, [myId])
    assert.equal((await row(myId)).is_available, false, 'switched off')
    assert.ok(!(await near()).find((c) => c.id === myId))
    await db.query(`update public.drivers set subscription_status = 'active', subscription_ends_at = now() + interval '30 days', is_available = true where id = $1`, [myId])
  })

  test('location history is kept at most once a minute', async () => {
    const count = () => db.query('select count(*)::int n from public.location_pings where driver_id = $1', [myId]).then((r) => r.rows[0].n)
    const start = await count()
    for (let i = 0; i < 5; i++) {
      await asDriver('update public.driver_positions set lat = lat + 0.0001 where driver_id = $1', [myId])
    }
    assert.equal(await count(), start)
  })

  test('housekeeping switches off a driver whose phone went quiet for 30 minutes', async () => {
    await db.query('alter table public.driver_positions disable trigger positions_touch')
    await db.query(`update public.driver_positions set updated_at = now() - interval '45 minutes' where driver_id = $1`, [myId])
    await db.query('alter table public.driver_positions enable trigger positions_touch')
    await db.query(`update public.drivers set available_since = now() - interval '2 hours' where id = $1`, [myId])
    const n = (await db.query('select public.expire_stale_availability() n')).rows[0].n
    assert.equal(n, 1, 'only the test driver; demo cabs are never switched off')
    assert.equal((await row(myId)).is_available, false)
  })

  test('once suspended, cannot switch Available on', async () => {
    await asAdmin(`update public.drivers set status = 'suspended' where id = $1`, [myId])
    await asDriver('update public.drivers set is_available = true where id = $1', [myId])
    assert.equal((await row(myId)).is_available, false)
  })
})

describe('reports and admin management', () => {
  test('only admins read reports, and resolving one is logged', async () => {
    assert.equal((await asDriver('select * from public.reports')).rows.length, 0)
    const r = await asAdmin('select id from public.reports')
    assert.ok(r.rows.length >= 1)
    await asAdmin(`update public.reports set status = 'resolved' where id = $1`, [r.rows[0].id])
    const log = await db.query(`select 1 from public.admin_log where action = 'resolved' and target_id = $1`, [r.rows[0].id])
    assert.equal(log.rows.length, 1)
  })

  test('nobody can write to the activity log directly', async () => {
    assert.ok(await fails(() => asAdmin(`insert into public.admin_log (action, target_type) values ('fake', 'driver')`)))
  })

  test('admins can add another admin but cannot remove themselves', async () => {
    const add = await asAdmin(`select public.add_admin('OTHER@example.com') r`)
    assert.equal(add.rows[0].r.ok, true)
    const self = await asAdmin('select public.remove_admin($1) r', [ADMIN])
    assert.equal(self.rows[0].r.ok, false)
  })

  test('a non-admin cannot add admins', async () => {
    assert.ok(await fails(() => asDriver(`select public.add_admin('driver@example.com')`)))
  })
})

describe('document storage', () => {
  test('drivers upload only into their own folder', async () => {
    await asDriver(`insert into storage.objects (bucket_id, name) values ('driver-docs', '${DRIVER}/license.pdf')`)
    assert.ok(await fails(() => asDriver(`insert into storage.objects (bucket_id, name) values ('driver-docs', '${OTHER}/license.pdf')`)))
  })

  test('other drivers cannot see the file; admins can', async () => {
    const other = await as(db, 'authenticated', OTHER, `select * from storage.objects where bucket_id = 'driver-docs'`)
    assert.equal(other.rows.length, 0)
    const admin = await asAdmin(`select * from storage.objects where bucket_id = 'driver-docs'`)
    assert.equal(admin.rows.length, 1)
  })
})
