-- IPPAS Food Service & Events: Complete Idempotent PostgreSQL / Supabase SQL Schema
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run).
-- Safe to run on both brand-new and existing databases. Configures all 18 tables, columns,
-- cascade foreign keys, views, RLS policies, Realtime publications, and Owner audit triggers.

-- ============================================================================
-- 1. ENUM TYPES (IDEMPOTENT)
-- ============================================================================
do $$ begin
  create type user_role as enum ('owner', 'chef', 'staff', 'manager', 'accountant');
exception when duplicate_object then null;
end $$;

alter type user_role add value if not exists 'manager';
alter type user_role add value if not exists 'accountant';

do $$ begin
  create type event_status as enum ('inquiry', 'quoted', 'confirmed', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type invoice_status as enum ('draft', 'sent', 'partially_paid', 'paid', 'void');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type pricing_type as enum ('per_guest', 'per_kg');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type stock_payment_status as enum ('paid', 'partially_paid', 'unpaid');
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- 2. CORE BUSINESS SETTINGS & USER PROFILES
-- ============================================================================
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
  payment_terms text,
  auto_email_invoices boolean default true,
  invoice_notification_email text default 'ippasevents@gmail.com'
);

alter table business_settings
  add column if not exists bank_name text,
  add column if not exists account_name text,
  add column if not exists account_number text,
  add column if not exists ifsc_code text,
  add column if not exists upi_id text,
  add column if not exists payment_terms text,
  add column if not exists auto_email_invoices boolean default true,
  add column if not exists invoice_notification_email text default 'ippasevents@gmail.com';

insert into business_settings (id, name, auto_email_invoices, invoice_notification_email)
values (1, 'IPPAS Food Service & Events', true, 'ippasevents@gmail.com')
on conflict (id) do nothing;

-- Profiles (decoupled from auth.users so custom Username & Password accounts sync cleanly)
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique,
  password text,
  full_name text not null,
  phone text,
  role user_role not null default 'staff',
  role_title text,
  hourly_rate numeric(8,2)
);

alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles alter column id set default gen_random_uuid();
alter table profiles
  add column if not exists username text unique,
  add column if not exists password text,
  add column if not exists role_title text,
  add column if not exists hourly_rate numeric(8,2);

insert into profiles (id, username, password, full_name, role, phone)
values
  ('00000000-0000-4000-8000-000000000001', 'owner', 'owner123', 'Fazil (Owner)', 'owner', '+91 98470 11111'),
  ('00000000-0000-4000-8000-000000000002', 'manager', 'manager123', 'Aisha (Manager)', 'manager', '+91 98470 22222'),
  ('00000000-0000-4000-8000-000000000003', 'accountant', 'accountant123', 'Rahul (Accountant)', 'accountant', '+91 98470 33333')
on conflict (username) do nothing;

-- ============================================================================
-- 3. CLIENTS & EVENTS
-- ============================================================================
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  company text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  venue text,
  guest_count int not null check (guest_count > 0),
  status event_status not null default 'inquiry',
  notes text,
  created_at timestamptz default now()
);

alter table events drop constraint if exists events_client_id_fkey;
alter table events add constraint events_client_id_fkey
  foreign key (client_id) references clients(id) on delete cascade;

-- ============================================================================
-- 4. INGREDIENTS, MENU ITEMS, RECIPES & EVENT QUOTATIONS
-- ============================================================================
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null default 'kg',
  cost_per_unit numeric(10,2) not null default 0,
  stock_qty numeric(12,3) not null default 0,
  low_stock_level numeric(12,3) not null default 0
);

alter table ingredients
  add column if not exists stock_qty numeric(12,3) not null default 0,
  add column if not exists low_stock_level numeric(12,3) not null default 0;

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  pricing_type pricing_type not null default 'per_guest',
  price_per_unit numeric(10,2),
  price_per_guest numeric(10,2) not null default 0,
  active boolean not null default true
);

alter table menu_items
  add column if not exists pricing_type pricing_type not null default 'per_guest',
  add column if not exists price_per_unit numeric(10,2);

update menu_items set price_per_unit = price_per_guest where price_per_unit is null;

create table if not exists menu_item_ingredients (
  menu_item_id uuid references menu_items(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete cascade,
  qty_per_guest numeric(10,4) not null,
  primary key (menu_item_id, ingredient_id)
);

alter table menu_item_ingredients drop constraint if exists menu_item_ingredients_ingredient_id_fkey;
alter table menu_item_ingredients add constraint menu_item_ingredients_ingredient_id_fkey
  foreign key (ingredient_id) references ingredients(id) on delete cascade;

create table if not exists event_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  pricing_type pricing_type not null default 'per_guest',
  price_per_unit numeric(10,2),
  price_per_guest numeric(10,2) not null default 0,
  quantity numeric(10,3),
  unique (event_id, menu_item_id)
);

alter table event_items
  add column if not exists pricing_type pricing_type not null default 'per_guest',
  add column if not exists price_per_unit numeric(10,2),
  add column if not exists quantity numeric(10,3);

update event_items set price_per_unit = price_per_guest where price_per_unit is null;

alter table event_items drop constraint if exists event_items_menu_item_id_fkey;
alter table event_items add constraint event_items_menu_item_id_fkey
  foreign key (menu_item_id) references menu_items(id) on delete cascade;

create table if not exists event_extras (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null default 0
);

-- ============================================================================
-- 5. STAFF MEMBERS, SHIFTS & SALARY LEDGER
-- ============================================================================
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

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  staff_id uuid references profiles(id) on delete set null,
  staff_member_id uuid references staff_members(id) on delete cascade,
  role_label text,
  starts_at timestamptz not null,
  ends_at timestamptz not null
);

alter table shifts alter column staff_id drop not null;
alter table shifts add column if not exists staff_member_id uuid references staff_members(id) on delete cascade;
alter table shifts drop constraint if exists shifts_check;
alter table shifts drop constraint if exists shifts_staff_id_fkey;
alter table shifts add constraint shifts_staff_id_fkey
  foreign key (staff_id) references profiles(id) on delete set null;
alter table shifts drop constraint if exists shifts_staff_member_id_fkey;
alter table shifts add constraint shifts_staff_member_id_fkey
  foreign key (staff_member_id) references staff_members(id) on delete cascade;

create table if not exists staff_salary_records (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references staff_members(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  record_type text not null default 'payment' check (record_type in ('payment', 'earning')),
  amount numeric(12,2) not null default 0,
  method text not null default 'Cash',
  note text,
  recorded_at timestamptz not null default now()
);

-- ============================================================================
-- 6. INVOICES & CLIENT PAYMENTS
-- ============================================================================
create sequence if not exists invoice_seq;

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  invoice_number text not null unique default ('INV-' || lpad(nextval('invoice_seq')::text, 4, '0')),
  kind text not null default 'final',
  subtotal numeric(12,2),
  discount numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  due_date date,
  status invoice_status not null default 'draft',
  notes text,
  snapshot jsonb,
  created_at timestamptz default now()
);

alter table invoices
  add column if not exists subtotal numeric(12,2),
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists notes text,
  add column if not exists snapshot jsonb;

update invoices set subtotal = amount where subtotal is null;

alter table invoices drop constraint if exists invoices_event_id_fkey;
alter table invoices add constraint invoices_event_id_fkey
  foreign key (event_id) references events(id) on delete cascade;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  method text,
  note text,
  paid_at timestamptz not null default now()
);

alter table payments
  add column if not exists note text;

-- ============================================================================
-- 7. STOCK PURCHASES & VENDOR PAYMENTS
-- ============================================================================
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
  purchase_id uuid not null references stock_purchases(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete set null,
  item_name text not null,
  quantity numeric(12,3) not null default 1,
  unit text not null default 'kg',
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0
);

create table if not exists stock_purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references stock_purchases(id) on delete cascade,
  amount numeric(12,2) not null,
  paid_at timestamptz not null default now(),
  method text not null default 'Cash',
  note text
);

-- ============================================================================
-- 8. REPORTING VIEWS
-- ============================================================================
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

-- ============================================================================
-- 9. OWNER ACTIVITY & DATABASE AUDIT LOGS + TRIGGERS
-- ============================================================================
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  parent_event_id text,
  action text not null check (action in ('create', 'update', 'delete')),
  summary text not null,
  details text,
  actor_id text,
  actor_username text not null default 'supabase_db',
  actor_name text not null default 'Direct Database Change',
  actor_role text not null default 'database',
  source text not null default 'database' check (source in ('app', 'database')),
  is_read_by_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at on activity_logs (created_at desc);
create index if not exists idx_activity_logs_entity_id on activity_logs (entity_id);
create index if not exists idx_activity_logs_parent_event_id on activity_logs (parent_event_id);
create index if not exists idx_activity_logs_unread on activity_logs (is_read_by_owner) where is_read_by_owner = false;

create or replace function fn_dedup_app_activity_logs()
returns trigger
language plpgsql
as $$
begin
  if NEW.source = 'app' then
    delete from activity_logs
    where source = 'database'
      and id <> NEW.id
      and created_at >= (NEW.created_at - interval '15 seconds')
      and (
        entity_id = NEW.entity_id
        or (parent_event_id is not null and parent_event_id = NEW.parent_event_id and entity_type = NEW.entity_type)
      );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_dedup_app_activity_logs on activity_logs;
create trigger trg_dedup_app_activity_logs
after insert on activity_logs
for each row
execute function fn_dedup_app_activity_logs();

create or replace function fn_capture_direct_db_changes()
returns trigger
language plpgsql
as $$
declare
  v_row jsonb;
  v_action text;
  v_entity_type text;
  v_entity_id text;
  v_parent_event_id text;
  v_label text;
  v_summary text;
begin
  if TG_OP = 'DELETE' then
    v_row := to_jsonb(OLD);
    v_action := 'delete';
  elsif TG_OP = 'UPDATE' then
    v_row := to_jsonb(NEW);
    v_action := 'update';
  else
    v_row := to_jsonb(NEW);
    v_action := 'create';
  end if;

  v_entity_id := coalesce(
    v_row->>'id',
    v_row->>'menu_item_id',
    v_row->>'purchase_id',
    v_row->>'event_id',
    'global'
  );

  v_parent_event_id := v_row->>'event_id';

  case TG_TABLE_NAME
    when 'events' then
      v_entity_type := 'event';
      v_parent_event_id := v_entity_id;
    when 'event_items' then
      v_entity_type := 'quotation';
    when 'event_extras' then
      v_entity_type := 'quotation';
    when 'invoices' then
      v_entity_type := 'invoice';
    when 'payments' then
      v_entity_type := 'payment';
    when 'clients' then
      v_entity_type := 'client';
    when 'menu_items' then
      v_entity_type := 'menu';
    when 'menu_item_ingredients' then
      v_entity_type := 'recipe';
      v_entity_id := coalesce(v_row->>'menu_item_id', v_entity_id);
    when 'ingredients' then
      v_entity_type := 'stock';
    when 'stock_purchases' then
      v_entity_type := 'purchase';
    when 'stock_purchase_items' then
      v_entity_type := 'purchase';
      v_entity_id := coalesce(v_row->>'purchase_id', v_entity_id);
    when 'stock_purchase_payments' then
      v_entity_type := 'purchase';
      v_entity_id := coalesce(v_row->>'purchase_id', v_entity_id);
    when 'staff_members' then
      v_entity_type := 'staff';
    when 'shifts' then
      v_entity_type := 'shift';
    when 'staff_salary_records' then
      v_entity_type := 'salary';
    when 'business_settings' then
      v_entity_type := 'settings';
    when 'profiles' then
      v_entity_type := 'user';
    else
      v_entity_type := 'database';
  end case;

  if exists (
    select 1
    from activity_logs
    where source = 'app'
      and created_at >= (now() - interval '15 seconds')
      and (
        entity_id = v_entity_id
        or (v_parent_event_id is not null and parent_event_id = v_parent_event_id and entity_type = v_entity_type)
      )
  ) then
    return coalesce(NEW, OLD);
  end if;

  v_label := coalesce(
    v_row->>'title',
    v_row->>'name',
    v_row->>'item_name',
    v_row->>'invoice_number',
    v_row->>'vendor_name',
    v_row->>'description',
    v_row->>'full_name',
    v_row->>'username',
    v_entity_id
  );

  v_summary := format(
    'Direct Database %s on %s (%s)',
    upper(TG_OP),
    TG_TABLE_NAME,
    coalesce(v_label, 'record')
  );

  insert into activity_logs (
    entity_type,
    entity_id,
    parent_event_id,
    action,
    summary,
    details,
    actor_username,
    actor_name,
    actor_role,
    source,
    is_read_by_owner
  ) values (
    v_entity_type,
    v_entity_id,
    v_parent_event_id,
    v_action,
    v_summary,
    format('Table: %s | Operation: %s', TG_TABLE_NAME, TG_OP),
    'supabase_db',
    'Direct Database Change',
    'database',
    'database',
    false
  );

  return coalesce(NEW, OLD);
end;
$$;

-- ============================================================================
-- 10. RLS POLICIES, REALTIME PUBLICATION & DB AUDIT TRIGGERS ACROSS ALL TABLES
-- ============================================================================
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
    'staff_salary_records',
    'invoices',
    'payments',
    'business_settings',
    'stock_purchases',
    'stock_purchase_items',
    'stock_purchase_payments',
    'activity_logs'
  ] loop
    execute format('alter table %I enable row level security', tbl);
    execute format('drop policy if exists app_full_access on %I', tbl);
    execute format(
      'create policy app_full_access on %I for all to anon, authenticated using (true) with check (true)',
      tbl
    );
    begin
      execute format('alter publication supabase_realtime add table %I', tbl);
    exception
      when others then null;
    end;

    if tbl <> 'activity_logs' then
      execute format('drop trigger if exists trg_capture_db_changes on %I', tbl);
      execute format(
        'create trigger trg_capture_db_changes after insert or update or delete on %I for each row execute function fn_capture_direct_db_changes()',
        tbl
      );
    end if;
  end loop;
end $$;
