-- Flagdown: the whole database, in one file.
-- Run it once in the Supabase SQL Editor (paste, then Run), or with `supabase db push`.
--
-- Adapted from TowConnect's four migrations. What's the same: admins with two-step sign-in, an
-- activity log, documents checked by a person, row level security on every table, and riders
-- reaching the data only through two small functions. What's different for cabs:
--   - drivers instead of tow operators, and each driver's cab lives on the same row
--   - three required documents: DC taxi (DFHV) operator license, vehicle registration, insurance
--   - a subscription: only drivers with an active subscription or free trial show up
--   - positions are shown to about 11 meters instead of half a mile, because the rider has to see
--     where a moving cab is, and only while the driver has switched Available on
--   - positions go stale after 3 minutes instead of 30, because the driver app sends them
--     every few seconds while driving (TowConnect relied on iPhone check-ins every 15 minutes)

-- ===========================================================================
-- Types
-- ===========================================================================

-- Where a driver is in sign-up: pending (waiting for review), approved, suspended.
create type public.driver_status       as enum ('pending', 'approved', 'suspended');
-- Mirrors Stripe's subscription states, plus 'none' for drivers who never subscribed.
create type public.subscription_status as enum ('none', 'trialing', 'active', 'past_due', 'canceled');
create type public.document_kind       as enum ('dfhv_license', 'vehicle_registration', 'insurance', 'other');
create type public.report_reason       as enum ('overcharged', 'no_show', 'refused_ride', 'unsafe_driving', 'wrong_vehicle', 'rude', 'other');
create type public.report_status       as enum ('open', 'resolved');

-- ===========================================================================
-- Admins
-- ===========================================================================

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- An admin only has admin powers after signing in with a password AND an authenticator-app code
-- (Supabase calls that 'aal2'). A stolen password alone can't read drivers' documents.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- True for the SQL Editor, migrations and server code using the secret key; false for app users
-- unless they are an admin. Must stay SECURITY INVOKER so current_user is the real caller.
create or replace function public.is_privileged()
returns boolean
language sql stable
as $$
  select current_user not in ('anon', 'authenticated') or public.is_admin();
$$;

-- The admin panel calls this after the password step to know which screen to show.
create or replace function public.admin_whoami()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'is_admin_account', exists (select 1 from public.admins where user_id = auth.uid()),
    'mfa_done',         coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  );
$$;

-- ===========================================================================
-- Drivers (and their cab: a driver drives one cab at a time, so it's kept on the same row)
-- ===========================================================================

create table public.drivers (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid unique references auth.users (id) on delete cascade,

  -- What riders see
  display_name          text not null check (char_length(display_name) between 1 and 40),   -- usually a first name
  phone                 text not null check (phone ~ '^\+?[0-9 ().-]{7,20}$'),
  company_name          text not null check (char_length(company_name) between 2 and 80),   -- the DC cab company or association
  cab_number            text not null check (char_length(cab_number) between 1 and 12),
  plate                 text not null check (char_length(plate) between 2 and 12),
  vehicle_color         text not null check (vehicle_color in ('black', 'blue', 'gray', 'green', 'red', 'silver', 'white', 'yellow', 'other')),
  vehicle_make          text not null check (char_length(vehicle_make) between 2 and 30),
  vehicle_model         text not null check (char_length(vehicle_model) between 1 and 30),
  seats                 smallint not null default 4 check (seats between 1 and 8),            -- passenger seats
  wheelchair_accessible boolean not null default false,
  payments              text[] not null default array['cash', 'card']
                        check (cardinality(payments) >= 1 and payments <@ array['cash', 'card']),

  -- Private: only the driver and admins see these
  legal_name            text not null check (char_length(legal_name) between 2 and 120),
  dfhv_license_number   text not null check (char_length(dfhv_license_number) between 2 and 30),

  -- Set by admins and billing, never by the driver
  status                public.driver_status not null default 'pending',
  subscription_status   public.subscription_status not null default 'none',
  subscription_ends_at  timestamptz,       -- end of the paid period or trial
  stripe_customer_id    text,
  is_demo               boolean not null default false,

  -- The driver's Available switch
  is_available          boolean not null default false,
  available_since       timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Does this driver's subscription let them appear to riders?
-- Trialing, active, or past due (a card payment is being retried), with 3 days of grace after the
-- end date, so a late billing update never hides a paying driver mid-shift.
create or replace function public.subscription_ok(p_status public.subscription_status, p_ends_at timestamptz)
returns boolean
language sql immutable
as $$
  select p_status in ('trialing', 'active', 'past_due')
     and (p_ends_at is null or p_ends_at > now() - interval '3 days');
$$;

-- The rules for editing a driver row, enforced inside the database so no app can skip them:
--   - drivers can't approve themselves, change their subscription, or mark themselves as demo
--   - once approved, what riders use to recognize the cab (name, company, cab number, plate,
--     vehicle, seats, wheelchair access) and the license number are locked; changes go through
--     an admin, who re-checks the documents. Phone, payments and Available stay editable.
--   - only approved drivers with a working subscription can switch Available on
create or replace function public.drivers_guard()
returns trigger
language plpgsql
as $$
declare
  v_priv boolean := public.is_privileged();
begin
  if not v_priv then
    if tg_op = 'INSERT' then
      new.user_id              := auth.uid();
      new.status               := 'pending';
      new.subscription_status  := 'none';
      new.subscription_ends_at := null;
      new.stripe_customer_id   := null;
      new.is_demo              := false;
      new.is_available         := false;
    else
      new.user_id              := old.user_id;
      new.status               := old.status;
      new.subscription_status  := old.subscription_status;
      new.subscription_ends_at := old.subscription_ends_at;
      new.stripe_customer_id   := old.stripe_customer_id;
      new.is_demo              := old.is_demo;
      if old.status = 'approved' then
        new.display_name          := old.display_name;
        new.legal_name            := old.legal_name;
        new.dfhv_license_number   := old.dfhv_license_number;
        new.company_name          := old.company_name;
        new.cab_number            := old.cab_number;
        new.plate                 := old.plate;
        new.vehicle_color         := old.vehicle_color;
        new.vehicle_make          := old.vehicle_make;
        new.vehicle_model         := old.vehicle_model;
        new.seats                 := old.seats;
        new.wheelchair_accessible := old.wheelchair_accessible;
      end if;
    end if;
  end if;

  if new.status <> 'approved' or not public.subscription_ok(new.subscription_status, new.subscription_ends_at) then
    new.is_available := false;
  end if;

  if new.is_available and (tg_op = 'INSERT' or not old.is_available) then
    new.available_since := now();
  elsif not new.is_available then
    new.available_since := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger drivers_guard
before insert or update on public.drivers
for each row execute function public.drivers_guard();

create or replace function public.owns_driver(p_driver_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.drivers where id = p_driver_id and user_id = auth.uid());
$$;

-- ===========================================================================
-- Documents. The files live in the private `driver-docs` storage bucket; this table is the record.
-- ===========================================================================

create table public.driver_documents (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.drivers (id) on delete cascade,
  kind        public.document_kind not null,
  file_path   text,
  expires_on  date,
  verified    boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references auth.users (id),
  notes       text check (char_length(notes) <= 500),
  created_at  timestamptz not null default now()
);

create index driver_documents_driver_idx on public.driver_documents (driver_id, kind);

-- Drivers can't verify their own documents, and replacing a file or changing a date clears the check.
create or replace function public.documents_guard()
returns trigger
language plpgsql
as $$
begin
  if not public.is_privileged() then
    if tg_op = 'INSERT' then
      new.verified := false; new.verified_at := null; new.verified_by := null;
    elsif new.file_path is distinct from old.file_path
       or new.expires_on is distinct from old.expires_on
       or new.kind is distinct from old.kind then
      new.verified := false; new.verified_at := null; new.verified_by := null;
    else
      new.verified := old.verified; new.verified_at := old.verified_at; new.verified_by := old.verified_by;
    end if;
  elsif new.verified and (tg_op = 'INSERT' or not old.verified) then
    new.verified_at := coalesce(new.verified_at, now());
    new.verified_by := coalesce(new.verified_by, auth.uid());
  elsif not new.verified then
    new.verified_at := null; new.verified_by := null;
  end if;
  return new;
end;
$$;

create trigger documents_guard
before insert or update on public.driver_documents
for each row execute function public.documents_guard();

-- The three documents a driver needs, each verified and not expired.
create or replace function public.documents_ok(p_driver_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select count(distinct d.kind) = 3
  from public.driver_documents d
  where d.driver_id = p_driver_id
    and d.kind in ('dfhv_license', 'vehicle_registration', 'insurance')
    and d.verified
    and (d.expires_on is null or d.expires_on >= current_date);
$$;

-- ===========================================================================
-- Positions
--   driver_positions = each driver's one current position (the driver app updates it)
--   location_pings   = short history, kept 30 days, for handling reports and disputes
-- ===========================================================================

create table public.driver_positions (
  driver_id  uuid primary key references public.drivers (id) on delete cascade,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  heading    real check (heading >= 0 and heading < 360),
  accuracy_m real check (accuracy_m >= 0),
  updated_at timestamptz not null default now()
);

create table public.location_pings (
  id          bigint generated always as identity primary key,
  driver_id   uuid not null references public.drivers (id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  recorded_at timestamptz not null default now()
);

create index location_pings_driver_time_idx on public.location_pings (driver_id, recorded_at desc);
create index location_pings_time_idx on public.location_pings (recorded_at);

-- The server's clock decides when a position arrived (a phone's clock can be wrong).
-- History is kept at most once a minute per driver: a cab sends a position every few seconds,
-- and storing every one would fill the free database tier fast without helping anyone.
create or replace function public.positions_touch()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at := now();
  if not exists (
    select 1 from public.location_pings
    where driver_id = new.driver_id and recorded_at > now() - interval '1 minute'
  ) then
    insert into public.location_pings (driver_id, lat, lng) values (new.driver_id, new.lat, new.lng);
  end if;
  return new;
end;
$$;

create trigger positions_touch
before insert or update on public.driver_positions
for each row execute function public.positions_touch();

-- ===========================================================================
-- Reports from riders
-- ===========================================================================

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  driver_id        uuid not null references public.drivers (id) on delete cascade,
  reason           public.report_reason not null,
  details          text check (char_length(details) <= 2000),
  reporter_contact text check (char_length(reporter_contact) <= 200),
  status           public.report_status not null default 'open',
  admin_notes      text check (char_length(admin_notes) <= 2000),
  resolved_by      uuid references auth.users (id),
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at desc);
create index reports_driver_idx on public.reports (driver_id, created_at desc);

-- ===========================================================================
-- Row level security
-- Riders use the public key, which gets no table access at all: only the functions further down.
-- ===========================================================================

alter table public.admins           enable row level security;
alter table public.drivers          enable row level security;
alter table public.driver_documents enable row level security;
alter table public.driver_positions enable row level security;
alter table public.location_pings   enable row level security;
alter table public.reports          enable row level security;

revoke all on all tables in schema public from anon;

create policy "admins see the admin list"
  on public.admins for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "drivers read own row; admins read all"
  on public.drivers for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "drivers create their own row"
  on public.drivers for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy "drivers update own row; admins update any"
  on public.drivers for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "admins delete drivers"
  on public.drivers for delete to authenticated
  using (public.is_admin());

create policy "documents: owner or admin"
  on public.driver_documents for all to authenticated
  using (public.owns_driver(driver_id) or public.is_admin())
  with check (public.owns_driver(driver_id) or public.is_admin());

create policy "positions: owner or admin"
  on public.driver_positions for all to authenticated
  using (public.owns_driver(driver_id) or public.is_admin())
  with check (public.owns_driver(driver_id) or public.is_admin());

create policy "pings: owner or admin can read"
  on public.location_pings for select to authenticated
  using (public.owns_driver(driver_id) or public.is_admin());

create policy "reports: admins read"
  on public.reports for select to authenticated
  using (public.is_admin());

create policy "reports: admins update"
  on public.reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===========================================================================
-- Rider functions (callable with the public key, no account needed)
-- ===========================================================================

-- Free cabs near a point, closest first. A cab is listed only when ALL of these are true:
--   approved, Available switched on, subscription working, all three documents verified and not
--   expired, and a position from the last 3 minutes (demo cabs skip the time check).
-- Positions are rounded to 4 decimals (about 11 meters): enough to see the cab on the right block,
-- not the exact spot it's parked. The search is capped at 15 km and 25 cabs, so one request can't
-- collect every driver in the city.
create or replace function public.nearby_cabs(
  p_lat       double precision,
  p_lng       double precision,
  p_radius_km double precision default 8,
  p_limit     integer default 20
)
returns table (
  id                    uuid,
  display_name          text,
  company_name          text,
  cab_number            text,
  plate                 text,
  vehicle_color         text,
  vehicle_make          text,
  vehicle_model         text,
  seats                 smallint,
  wheelchair_accessible boolean,
  payments              text[],
  phone                 text,
  license_checked_on    date,
  lat                   double precision,
  lng                   double precision,
  heading               real,
  distance_km           double precision,
  position_age_s        integer,
  is_demo               boolean
)
language sql stable security definer set search_path = public
as $$
  with params as (
    select
      greatest(-90.0, least(90.0, p_lat))                    as lat,
      greatest(-180.0, least(180.0, p_lng))                  as lng,
      greatest(0.5, least(15.0, coalesce(p_radius_km, 8)))   as radius,
      greatest(1, least(25, coalesce(p_limit, 20)))          as lim
  ),
  eligible as (
    select
      d.*,
      round(pos.lat::numeric, 4)::double precision as rlat,
      round(pos.lng::numeric, 4)::double precision as rlng,
      pos.heading,
      pos.updated_at as pos_at
    from public.drivers d
    join public.driver_positions pos on pos.driver_id = d.id
    where d.status = 'approved'
      and d.is_available
      and public.subscription_ok(d.subscription_status, d.subscription_ends_at)
      and public.documents_ok(d.id)
      and (pos.updated_at > now() - interval '3 minutes' or d.is_demo)
  )
  select
    e.id, e.display_name, e.company_name, e.cab_number, e.plate,
    e.vehicle_color, e.vehicle_make, e.vehicle_model, e.seats, e.wheelchair_accessible, e.payments,
    e.phone,
    (select max(doc.verified_at)::date from public.driver_documents doc
      where doc.driver_id = e.id and doc.kind = 'dfhv_license' and doc.verified),
    e.rlat, e.rlng, e.heading,
    round(dist.km::numeric, 3)::double precision,
    greatest(0, extract(epoch from now() - e.pos_at))::integer,
    e.is_demo
  from eligible e
  cross join params p
  cross join lateral (
    select 2 * 6371 * asin(least(1.0, sqrt(
      power(sin(radians(e.rlat - p.lat) / 2), 2)
      + cos(radians(p.lat)) * cos(radians(e.rlat)) * power(sin(radians(e.rlng - p.lng) / 2), 2)
    ))) as km
  ) dist
  where dist.km <= p.radius
  order by dist.km
  limit (select lim from params);
$$;

-- Riders can report a driver without an account. Limited to 20 reports per driver per hour, so
-- nobody can bury a driver under fake reports.
create or replace function public.submit_report(
  p_driver_id uuid,
  p_reason    public.report_reason,
  p_details   text default null,
  p_contact   text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.drivers where id = p_driver_id and status <> 'pending') then
    raise exception 'That driver could not be found.';
  end if;

  if (select count(*) from public.reports
      where driver_id = p_driver_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many reports for this driver in the last hour. Try again later.';
  end if;

  insert into public.reports (driver_id, reason, details, reporter_contact)
  values (p_driver_id, p_reason, left(nullif(trim(p_details), ''), 2000), left(nullif(trim(p_contact), ''), 200))
  returning id into v_id;

  return v_id;
end;
$$;

-- ===========================================================================
-- Activity log: who approved, suspended, verified or resolved what.
-- Filled only by triggers, which run as the table owner, so nobody can write or edit it directly.
-- ===========================================================================

create table public.admin_log (
  id          bigint generated always as identity primary key,
  admin_id    uuid references auth.users (id) on delete set null, -- null = SQL Editor or billing
  admin_email text,
  action      text not null,
  target_type text not null,   -- 'driver' | 'document' | 'report' | 'subscription' | 'admin'
  target_id   text,
  target_name text,
  created_at  timestamptz not null default now()
);

create index admin_log_time_idx on public.admin_log (created_at desc);

alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon;

create policy "admin log: admins read"
  on public.admin_log for select to authenticated
  using (public.is_admin());

create or replace function public.log_admin_action(p_action text, p_target_type text, p_target_id text, p_target_name text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.admin_log (admin_id, admin_email, action, target_type, target_id, target_name)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), p_action, p_target_type, p_target_id, p_target_name);
$$;

create or replace function public.driver_label(p_driver_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select legal_name || ' (cab ' || cab_number || ')' from public.drivers where id = p_driver_id;
$$;

create or replace function public.log_driver_changes()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_admin_action(new.status::text, 'driver', new.id::text, public.driver_label(new.id));
  end if;
  if new.subscription_status is distinct from old.subscription_status then
    perform public.log_admin_action(new.subscription_status::text, 'subscription', new.id::text, public.driver_label(new.id));
  end if;
  return null;
end;
$$;

create trigger log_driver_changes
after update on public.drivers
for each row execute function public.log_driver_changes();

-- A document verified, or un-verified by an admin. (A driver replacing a file also clears
-- 'verified', but that isn't an admin action, so it isn't logged. auth.uid() is null in the SQL Editor.)
create or replace function public.log_document_verified()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.verified is distinct from old.verified and (new.verified or public.is_admin() or auth.uid() is null) then
    perform public.log_admin_action(
      case when new.verified then 'verified' else 'unverified' end,
      'document', new.id::text, public.driver_label(new.driver_id) || ': ' || new.kind::text);
  end if;
  return null;
end;
$$;

create trigger log_document_verified
after update on public.driver_documents
for each row execute function public.log_document_verified();

create or replace function public.log_report_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_admin_action(new.status::text, 'report', new.id::text,
      public.driver_label(new.driver_id) || ': ' || new.reason::text);
  end if;
  return null;
end;
$$;

create trigger log_report_status
after update on public.reports
for each row execute function public.log_report_status();

create or replace function public.log_admin_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_admin_action('added', 'admin', new.user_id::text, new.email);
  else
    perform public.log_admin_action('removed', 'admin', old.user_id::text, old.email);
  end if;
  return null;
end;
$$;

create trigger log_admin_change
after insert or delete on public.admins
for each row execute function public.log_admin_change();

-- ===========================================================================
-- Admin actions
-- ===========================================================================

-- Approve a driver and verify their documents in one step. A function runs as one transaction, so
-- a driver can never end up approved with unverified documents if something fails halfway.
create or replace function public.approve_driver(p_driver_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_name    text;
  v_missing text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve drivers.' using errcode = '42501';
  end if;

  select legal_name into v_name from public.drivers where id = p_driver_id;
  if v_name is null then
    return jsonb_build_object('ok', false, 'message', 'That driver no longer exists.');
  end if;

  -- All three documents must be uploaded (a file, not just a typed date) and not expired.
  select string_agg(label, ', ') into v_missing
  from (values ('dfhv_license'::public.document_kind, 'DC taxi license'),
               ('vehicle_registration', 'vehicle registration'),
               ('insurance', 'insurance')) as req(kind, label)
  where not exists (
    select 1 from public.driver_documents d
    where d.driver_id = p_driver_id and d.kind = req.kind
      and d.file_path is not null and d.expires_on >= current_date
  );
  if v_missing is not null then
    return jsonb_build_object('ok', false, 'message', 'Can''t approve yet. Missing or expired: ' || v_missing || '.');
  end if;

  update public.driver_documents
  set verified = true
  where driver_id = p_driver_id and not verified and (expires_on is null or expires_on >= current_date);

  update public.drivers set status = 'approved' where id = p_driver_id;

  return jsonb_build_object('ok', true, 'message', v_name || ' is approved.');
end;
$$;

-- Give a driver free access for a number of days (for the beta, before billing exists).
-- Never shortens a longer trial or paid period that's already in place.
create or replace function public.start_free_trial(p_driver_id uuid, p_days integer default 30)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_ends timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only admins can start a free trial.' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 365 then
    return jsonb_build_object('ok', false, 'message', 'Choose between 1 and 365 days.');
  end if;

  update public.drivers
  set subscription_status  = case when subscription_status = 'active' then 'active'::public.subscription_status
                                   else 'trialing'::public.subscription_status end,
      subscription_ends_at = greatest(coalesce(subscription_ends_at, now()), now() + make_interval(days => p_days))
  where id = p_driver_id
  returning subscription_ends_at into v_ends;

  if v_ends is null then
    return jsonb_build_object('ok', false, 'message', 'That driver no longer exists.');
  end if;
  return jsonb_build_object('ok', true, 'message', 'Free access until ' || to_char(v_ends, 'Mon FMDD, YYYY') || '.');
end;
$$;

create or replace function public.add_admin(p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id    uuid;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can add admins.' using errcode = '42501';
  end if;
  select id, email into v_id, v_email from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    return jsonb_build_object('ok', false, 'message', 'No account uses that email yet. Ask them to sign up first, then add them.');
  end if;
  if exists (select 1 from public.admins where user_id = v_id) then
    return jsonb_build_object('ok', false, 'message', v_email || ' is already an admin.');
  end if;
  insert into public.admins (user_id, email) values (v_id, v_email);
  return jsonb_build_object('ok', true, 'message', v_email || ' is now an admin. They sign in and set up their authenticator app.');
end;
$$;

-- You can't remove yourself, so the last admin can never be removed by accident.
create or replace function public.remove_admin(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove admins.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    return jsonb_build_object('ok', false, 'message', 'You can''t remove yourself. Another admin has to do it.');
  end if;
  delete from public.admins where user_id = p_user_id returning email into v_email;
  if v_email is null then
    return jsonb_build_object('ok', false, 'message', 'That person is not an admin.');
  end if;
  return jsonb_build_object('ok', true, 'message', v_email || ' is no longer an admin.');
end;
$$;

-- ===========================================================================
-- Housekeeping (scheduled below; nobody else can run these)
-- ===========================================================================

-- Switch off drivers whose phone stopped sending positions for 30 minutes (phone died, app killed,
-- forgot to switch off). They can switch back on any time.
create or replace function public.expire_stale_availability()
returns integer
language sql security definer set search_path = public
as $$
  with changed as (
    update public.drivers d
    set is_available = false
    where d.is_available
      and not d.is_demo
      and d.available_since < now() - interval '30 minutes'
      and not exists (
        select 1 from public.driver_positions p
        where p.driver_id = d.id and p.updated_at > now() - interval '30 minutes'
      )
    returning 1
  )
  select count(*)::integer from changed;
$$;

-- Keep location history for 30 days only.
create or replace function public.purge_old_pings()
returns integer
language sql security definer set search_path = public
as $$
  with gone as (delete from public.location_pings where recorded_at < now() - interval '30 days' returning 1)
  select count(*)::integer from gone;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    execute $job$select cron.schedule('expire-stale-availability', '*/5 * * * *', 'select public.expire_stale_availability()')$job$;
    execute $job$select cron.schedule('purge-old-pings', '15 3 * * *', 'select public.purge_old_pings()')$job$;
    raise notice 'Scheduled the two cleanup jobs with pg_cron.';
  else
    raise notice 'pg_cron is not available here, so the cleanup jobs were not scheduled.';
  end if;
end;
$$;

-- ===========================================================================
-- Who can call what
-- ===========================================================================

-- Postgres lets everyone run new functions by default. Take that away from all of them first,
-- then hand back exactly what each kind of user needs.
revoke all on all functions in schema public from public, anon, authenticated;

-- Server code using the secret key (the billing webhook, later) can run everything.
grant execute on all functions in schema public to service_role;

-- Riders (public key) and everyone else
grant execute on function public.nearby_cabs(double precision, double precision, double precision, integer) to anon, authenticated;
grant execute on function public.submit_report(uuid, public.report_reason, text, text) to anon, authenticated;

-- Signed-in users. Each of these checks is_admin() itself where it matters.
grant execute on function public.admin_whoami()                  to authenticated;
grant execute on function public.approve_driver(uuid)            to authenticated;
grant execute on function public.start_free_trial(uuid, integer) to authenticated;
grant execute on function public.add_admin(text)                 to authenticated;
grant execute on function public.remove_admin(uuid)              to authenticated;

-- Used inside the row rules and triggers, so signed-in users must be able to run them.
grant execute on function public.is_admin()                                                to authenticated;
grant execute on function public.is_privileged()                                           to authenticated;
grant execute on function public.owns_driver(uuid)                                         to authenticated;
grant execute on function public.subscription_ok(public.subscription_status, timestamptz)  to authenticated;

-- ===========================================================================
-- Storage: a private bucket for documents, one folder per user, e.g. driver-docs/<user id>/insurance.pdf
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('driver-docs', 'driver-docs', false)
on conflict (id) do nothing;

create policy "drivers upload to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'driver-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "drivers read own docs; admins read all"
  on storage.objects for select to authenticated
  using (bucket_id = 'driver-docs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "drivers delete own docs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'driver-docs' and (storage.foldername(name))[1] = auth.uid()::text);
