-- Flagdown demo data, for testing only. NOT for production.
-- The same eight made-up cabs as the rider app's demo mode, parked around downtown DC.
-- Phone numbers use the 555-01xx range, which is reserved for fiction.
-- Remove before launch:  delete from public.drivers where is_demo;

with demo (display_name, legal_name, company_name, cab_number, plate, vehicle_color, vehicle_make, vehicle_model,
           seats, wheelchair_accessible, payments, phone, license_checked_on, lat, lng) as (
  values
    ('Samuel',  'Demo Driver 1', 'Red Line Cab',       '142', 'H 00142', 'gray',   'Toyota',    'Camry',         4, false, array['cash','card'], '(202) 555-0142', date '2026-10-06', 38.9025, -77.0423),
    ('Marisol', 'Demo Driver 2', 'Shaw Street Cab',    '27',  'H 00027', 'red',    'Toyota',    'Sienna',        6, true,  array['cash','card'], '(202) 555-0127', date '2026-11-02', 38.8926, -77.0330),
    ('Tesfaye', 'Demo Driver 3', 'Red Line Cab',       '88',  'H 00088', 'gray',   'Ford',      'Fusion',        4, false, array['cash','card'], '(202) 555-0188', date '2026-09-14', 38.8971, -77.0550),
    ('Denise',  'Demo Driver 4', 'Anacostia Taxi Co.', '305', 'H 00305', 'white',  'Chevrolet', 'Malibu',        4, false, array['cash'],        '(202) 555-0105', date '2026-10-20', 38.9061, -77.0238),
    ('Ahmed',   'Demo Driver 5', 'Shaw Street Cab',    '61',  'H 00061', 'red',    'Dodge',     'Grand Caravan', 6, true,  array['cash','card'], '(202) 555-0161', date '2026-08-11', 38.9124, -77.0469),
    ('Lucía',   'Demo Driver 6', 'Anacostia Taxi Co.', '212', 'H 00212', 'silver', 'Toyota',    'Prius',         4, false, array['cash','card'], '(202) 555-0112', date '2026-11-09', 38.8845, -77.0203),
    ('James',   'Demo Driver 7', 'Red Line Cab',       '9',   'H 00009', 'gray',   'Honda',     'Accord',        4, false, array['cash','card'], '(202) 555-0109', date '2026-10-27', 38.9151, -77.0642),
    ('Nia',     'Demo Driver 8', 'Shaw Street Cab',    '174', 'H 00174', 'black',  'Toyota',    'Highlander',    6, false, array['card'],        '(202) 555-0174', date '2026-09-29', 38.9178, -77.0110)
),
drivers as (
  insert into public.drivers
    (display_name, legal_name, dfhv_license_number, company_name, cab_number, plate, vehicle_color, vehicle_make,
     vehicle_model, seats, wheelchair_accessible, payments, phone, status, subscription_status, subscription_ends_at,
     is_available, is_demo)
  select display_name, legal_name, 'DEMO-' || cab_number, company_name, cab_number, plate, vehicle_color, vehicle_make,
         vehicle_model, seats, wheelchair_accessible, payments, phone, 'approved', 'active', now() + interval '10 years',
         true, true
  from demo
  returning id, cab_number
),
docs as (
  insert into public.driver_documents (driver_id, kind, expires_on, verified, verified_at, notes)
  select drivers.id, k.kind, (current_date + interval '1 year')::date, true,
         case when k.kind = 'dfhv_license' then demo.license_checked_on else now() end, 'Demo document'
  from drivers
  join demo on demo.cab_number = drivers.cab_number
  cross join (values ('dfhv_license'::public.document_kind), ('vehicle_registration'), ('insurance')) as k(kind)
  returning 1
)
insert into public.driver_positions (driver_id, lat, lng)
select drivers.id, demo.lat, demo.lng
from drivers
join demo on demo.cab_number = drivers.cab_number;
