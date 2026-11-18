// A fresh in-memory Postgres (PGlite) with stand-ins for the Supabase pieces the migration expects
// (roles, auth.users, auth.uid(), auth.jwt(), storage), then the migration and the demo seed.
// No Supabase account or internet needed, so the tests run anywhere in a couple of seconds.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)

export async function makeDb({ seed = true } = {}) {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable
      as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable
      as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated;
  `)
  // Supabase grants these on every new table by default; row level security does the real protecting.
  // (The migration then takes everything away from anon.)
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
                 alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
                 alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;`)
  const dir = new URL('migrations/', root)
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(file, dir), 'utf8'))
  }
  await db.exec('grant select, insert, delete on storage.objects to authenticated')
  if (seed) await db.exec(readFileSync(new URL('seed.sql', root), 'utf8'))
  return db
}

// Run SQL as a particular kind of user:
//   as(db, 'anon', null, sql)                     a rider using the public key
//   as(db, 'authenticated', userId, sql)          a signed-in driver
//   as(db, 'authenticated', userId, sql, [], 2)   an admin who finished two-step sign-in
export async function as(db, role, uid, sql, params = [], aal = 1) {
  const claims = JSON.stringify({ sub: uid ?? '', aal: `aal${aal}` })
  await db.exec(`reset role;
    select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);
    select set_config('request.jwt.claims', '${claims}', false);
    set role ${role};`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec('reset role')
  }
}

export async function fails(fn) {
  try {
    await fn()
    return false
  } catch {
    return true
  }
}
