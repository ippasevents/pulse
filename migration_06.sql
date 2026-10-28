-- migration_06.sql
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run).
-- It updates your tables, columns, foreign keys, and RLS policies so the app can read & write all new data live.

-- 1. Ensure Enums Exist
do $$ begin
  create type user_role as enum ('owner', 'chef', 'staff', 'manager', 'accountant');
exception
  when duplicate_object then null;
end $$;

alter type user_role add value if not exists 'manager';
alter type user_role add value if not exists 'accountant';

do $$ begin
  create type pricing_type as enum ('per_guest', 'per_kg');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type stock_payment_status as enum ('paid', 'partially_paid', 'unpaid');
exception
  when duplicate_object then null;
end $$;

-- 2. Decouple profiles from auth.users so custom Username & Password accounts can be created/updated from the app
alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles alter column id set default gen_random_uuid();
alter table profiles
  add column if not exists username text unique,
  add column if not exists password text,
  add column if not exists role_title text;

-- Seed default Owner, Manager & Accountant logins if profiles table has no username accounts yet
insert into profiles (id, username, password, full_name, role, phone)
values
  ('00000000-0000-4000-8000-000000000001', 'owner', 'owner123', 'Fazil (Owner)', 'owner', '+91 98470 11111'),
  ('00000000-0000-4000-8000-000000000002', 'manager', 'manager123', 'Aisha (Manager)', 'manager', '+91 98470 22222'),
  ('00000000-0000-4000-8000-000000000003', 'accountant', 'accountant123', 'Rahul (Accountant)', 'accountant', '+91 98470 33333')
on conflict (username) do nothing;

-- 3. Staff Members Phone Login Password
create table if not exists staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  password text default 'password123',
  role_title text,
  hourly_rate numeric(10,2) not null default 0,
  active boolean not null default true
);

alter table staff_members
  add column if not exists password text default 'password123';

alter table shifts alter column staff_id drop not null;
alter table shifts add column if not exists staff_member_id uuid references staff_members on delete cascade;
alter table shifts drop constraint if exists shifts_check;

-- 4. Per-Guest & Per-Kg Pricing on Menu Items & Event Quotes
alter table ingredients
  add column if not exists stock_qty numeric(12,3) not null default 0,
  add column if not exists low_stock_level numeric(12,3) not null default 0;

alter table menu_items
  add column if not exists pricing_type pricing_type not null default 'per_guest',
  add column if not exists price_per_unit numeric(10,2);

update menu_items set price_per_unit = price_per_guest where price_per_unit is null;

alter table event_items
  add column if not exists pricing_type pricing_type not null default 'per_guest',
  add column if not exists price_per_unit numeric(10,2),
  add column if not exists quantity numeric(10,3);

update event_items set price_per_unit = price_per_guest where price_per_unit is null;

-- Allow deleting menu items or events cleanly without FK restrict errors
alter table event_items drop constraint if exists event_items_menu_item_id_fkey;
alter table event_items add constraint event_items_menu_item_id_fkey
  foreign key (menu_item_id) references menu_items(id) on delete cascade;

alter table menu_item_ingredients drop constraint if exists menu_item_ingredients_ingredient_id_fkey;
alter table menu_item_ingredients add constraint menu_item_ingredients_ingredient_id_fkey
  foreign key (ingredient_id) references ingredients(id) on delete cascade;

-- 5. Invoice Discounts, Subtotals, Notes & Part-Payment Notes
alter table invoices
  add column if not exists subtotal numeric(12,2),
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists notes text;

update invoices set subtotal = amount where subtotal is null;

alter table invoices drop constraint if exists invoices_event_id_fkey;
alter table invoices add constraint invoices_event_id_fkey
  foreign key (event_id) references events(id) on delete cascade;

alter table payments
  add column if not exists note text;

-- 6. Business Settings & Bank Details
create table if not exists business_settings (
  id int primary key default 1 check (id = 1),
  name text,
  address text,
  phone text,
  email text,
  bank_name text,
  account_name text,
  account_number text,
  ifsc_code text,
  upi_id text,
  payment_terms text
);

alter table business_settings
  add column if not exists bank_name text,
  add column if not exists account_name text,
  add column if not exists account_number text,
  add column if not exists ifsc_code text,
  add column if not exists upi_id text,
  add column if not exists payment_terms text;

insert into business_settings (id, name)
values (1, 'IPPAS Food Service & Events')
on conflict (id) do nothing;

-- 7. Stock Purchases & Vendor Dues Tables
create table if not exists stock_purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_date date not null default current_date,
  vendor_name text not null,
  vendor_location text,
  vendor_phone text,
  bill_number text,
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  balance_amount numeric(12,2) not null default 0,
  payment_status stock_payment_status not null default 'unpaid',
  payment_method text not null default 'Cash',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists stock_purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references stock_purchases on delete cascade,
  ingredient_id uuid references ingredients on delete set null,
  item_name text not null,
  quantity numeric(12,3) not null default 1,
  unit text not null default 'kg',
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0
);

create table if not exists stock_purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references stock_purchases on delete cascade,
  amount numeric(12,2) not null,
  paid_at timestamptz not null default now(),
  method text not null default 'Cash',
  note text
);

-- 8. Update Views
create or replace view event_totals as
select
  e.id as event_id,
  coalesce(
    sum(
      coalesce(ei.price_per_unit, ei.price_per_guest) *
      case
        when ei.pricing_type = 'per_kg' then coalesce(ei.quantity, 1)
        else coalesce(ei.quantity, e.guest_count)
      end
    ),
    0
  ) + coalesce((select sum(amount) from event_extras x where x.event_id = e.id), 0) as quote_total
from events e
left join event_items ei on ei.event_id = e.id
group by e.id, e.guest_count;

create or replace view event_ingredient_needs as
select
  ei.event_id,
  i.id as ingredient_id,
  i.name,
  i.unit,
  sum(
    mii.qty_per_guest *
    case
      when ei.pricing_type = 'per_kg' then coalesce(ei.quantity, 1)
      else coalesce(ei.quantity, e.guest_count)
    end
  ) as total_qty,
  sum(
    mii.qty_per_guest *
    case
      when ei.pricing_type = 'per_kg' then coalesce(ei.quantity, 1)
      else coalesce(ei.quantity, e.guest_count)
    end * i.cost_per_unit
  ) as total_cost
from event_items ei
join events e on e.id = ei.event_id
join menu_item_ingredients mii on mii.menu_item_id = ei.menu_item_id
join ingredients i on i.id = mii.ingredient_id
group by ei.event_id, i.id, i.name, i.unit;

-- 9. Configure RLS Policies so App Client (anon & authenticated) Can Read & Write Data
-- Note: Since the app uses its own custom Username/Phone + Password login screen rather than Supabase Email Auth,
-- client requests use NEXT_PUBLIC_SUPABASE_ANON_KEY ('anon' role). Without 'anon' policies, Supabase rejects all updates!
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles',
    'clients',
    'events',
    'ingredients',
    'menu_items',
    'menu_item_ingredients',
    'event_items',
    'event_extras',
    'staff_members',
    'shifts',
    'invoices',
    'payments',
    'business_settings',
    'stock_purchases',
    'stock_purchase_items',
    'stock_purchase_payments'
  ] loop
    execute format('alter table %I enable row level security', tbl);
    execute format('drop policy if exists app_full_access on %I', tbl);
    execute format(
      'create policy app_full_access on %I for all to anon, authenticated using (true) with check (true)',
      tbl
    );
  end loop;
end $$;
