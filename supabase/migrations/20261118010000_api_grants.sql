-- Flagdown: give the app's roles access to the tables they use.
-- Run this once in the Supabase SQL Editor, after 20261118000000_init.sql.
--
-- Why: since May 30, 2026, new Supabase projects no longer give the app's roles (anon = the public
-- key, authenticated = a signed-in user) automatic access to new tables. Without these grants, every
-- table read or write from the apps fails with "permission denied for table".
--
-- Grants and row level security are two separate locks:
--   1. a GRANT decides whether a role may use a table at all
--   2. the row level security policies in the first migration decide WHICH ROWS it may use
-- So granting "update on drivers" to signed-in users does NOT let them edit other drivers: the
-- policies still limit each driver to their own row, and admins (with two-step sign-in) to all rows.
-- Each table only gets the actions the apps actually do.
--
-- Riders (anon) get no table access at all, on purpose. They only call nearby_cabs() and
-- submit_report(), which the first migration already allows.

-- Signed-in drivers and admins
grant select, insert, update, delete on public.drivers          to authenticated; -- delete: admins only (policy)
grant select, insert, update, delete on public.driver_documents to authenticated;
grant select, insert, update, delete on public.driver_positions to authenticated;
grant select                         on public.location_pings   to authenticated;
grant select, update                 on public.reports          to authenticated; -- admins only (policy)
grant select                         on public.admins           to authenticated;
grant select                         on public.admin_log        to authenticated; -- admins only (policy)

-- Server code using the secret key (the billing webhook, later). It skips row level security by
-- design, so it gets everything; this key must never be in an app.
grant select, insert, update, delete on all tables    in schema public to service_role;
grant usage, select                  on all sequences in schema public to service_role;

-- Make sure the public key has nothing on any table, whatever this project's defaults are.
revoke all on all tables in schema public from anon;
