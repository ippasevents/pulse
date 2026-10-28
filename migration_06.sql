-- migration_06.sql
-- Run in the Supabase SQL Editor (after schema.sql / migration_05.sql)
-- Brings Supabase schema & RLS policies in sync with all latest IPPAS Pulse features.

-- 1. Pricing Type support (Per Guest & Per Kg) on Menu Items and Event Quotes
do $$ begin
  create type pricing_type as enum ('per_guest', 'per_kg');
exception
  when duplicate_object then null;
end $$;

alter table menu_items
  add column if not exists pricing_type pricing_type not null default 'per_guest',
  add column if not exists price_per_unit numeric(10,2);

update menu_items
set price_per_unit = price_per_guest
where price_per_unit is null;

alter table event_items
  add column if not exists pricing_type pricing_type not null default 'per_guest',
  add column if not exists price_per_unit numeric(10,2),
  add column if not exists quantity numeric(10,3);

update event_items
set price_per_unit = price_per_guest
where price_per_unit is null;

-- Update views to support both per_guest and per_kg quantities
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

-- 2. Invoice Discounts, Subtotals, Notes & Part-Payment Notes
alter table invoices
  add column if not exists subtotal numeric(12,2),
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists notes text;

update invoices
set subtotal = amount
where subtotal is null;

alter table payments
  add column if not exists note text;

-- 3. Bank Details & Payment Terms in Business Settings
alter table business_settings
  add column if not exists bank_name text,
  add column if not exists account_name text,
  add column if not exists account_number text,
  add column if not exists ifsc_code text,
  add column if not exists upi_id text,
  add column if not exists payment_terms text;

-- 4. User Profiles & Staff Phone Login Credentials
alter table profiles
  add column if not exists username text unique,
  add column if not exists role_title text;

alter table staff_members
  add column if not exists user_id uuid references auth.users on delete set null,
  add column if not exists password text;

create unique index if not exists idx_staff_members_phone on staff_members (phone) where phone is not null;

-- 5. Stock Purchases & Vendor Dues Tables
do $$ begin
  create type stock_payment_status as enum ('paid', 'partially_paid', 'unpaid');
exception
  when duplicate_object then null;
end $$;

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

alter table stock_purchases enable row level security;
alter table stock_purchase_items enable row level security;
alter table stock_purchase_payments enable row level security;

-- 6. Updated Row-Level Security (RLS) Policies for Owner, Manager, Accountant & Staff
-- Remove Manager read access to Invoices & Payments (added previously in migration_05)
drop policy if exists finance_read on invoices;
drop policy if exists finance_read on payments;

-- Allow Accountant to also manage Quotations & Extra Charges (event_items, event_extras)
drop policy if exists mgr_write on event_items;
drop policy if exists quote_write on event_items;
create policy quote_write on event_items for all to authenticated
  using (has_role(array['owner','manager','accountant']))
  with check (has_role(array['owner','manager','accountant']));

drop policy if exists mgr_write on event_extras;
drop policy if exists quote_write on event_extras;
create policy quote_write on event_extras for all to authenticated
  using (has_role(array['owner','manager','accountant']))
  with check (has_role(array['owner','manager','accountant']));

-- Stock Purchases & Vendor Dues: Owner + Manager write; Owner + Manager + Accountant read
drop policy if exists stock_purchases_read on stock_purchases;
create policy stock_purchases_read on stock_purchases for select to authenticated
  using (has_role(array['owner','manager','accountant']));

drop policy if exists stock_purchases_write on stock_purchases;
create policy stock_purchases_write on stock_purchases for all to authenticated
  using (has_role(array['owner','manager']))
  with check (has_role(array['owner','manager']));

drop policy if exists stock_purchase_items_read on stock_purchase_items;
create policy stock_purchase_items_read on stock_purchase_items for select to authenticated
  using (has_role(array['owner','manager','accountant']));

drop policy if exists stock_purchase_items_write on stock_purchase_items;
create policy stock_purchase_items_write on stock_purchase_items for all to authenticated
  using (has_role(array['owner','manager']))
  with check (has_role(array['owner','manager']));

drop policy if exists stock_purchase_payments_read on stock_purchase_payments;
create policy stock_purchase_payments_read on stock_purchase_payments for select to authenticated
  using (has_role(array['owner','manager','accountant']));

drop policy if exists stock_purchase_payments_write on stock_purchase_payments;
create policy stock_purchase_payments_write on stock_purchase_payments for all to authenticated
  using (has_role(array['owner','manager']))
  with check (has_role(array['owner','manager']));

-- Restrict Staff ('staff' role) from reading non-duty tables; Staff only see assigned shifts & events
drop policy if exists read_all on clients;
create policy read_mgmt on clients for select to authenticated
  using (has_role(array['owner','manager','accountant']));

drop policy if exists read_all on ingredients;
create policy read_mgmt on ingredients for select to authenticated
  using (has_role(array['owner','manager','accountant']));

drop policy if exists read_all on menu_items;
create policy read_mgmt on menu_items for select to authenticated
  using (has_role(array['owner','manager','accountant']));

drop policy if exists read_all on menu_item_ingredients;
create policy read_mgmt on menu_item_ingredients for select to authenticated
  using (has_role(array['owner','manager','accountant']));

drop policy if exists read_all on event_items;
create policy read_mgmt on event_items for select to authenticated
  using (has_role(array['owner','manager','accountant']));

drop policy if exists read_all on event_extras;
create policy read_mgmt on event_extras for select to authenticated
  using (has_role(array['owner','manager','accountant']));

drop policy if exists read_all on shifts;
create policy read_shifts on shifts for select to authenticated
  using (
    has_role(array['owner','manager','accountant'])
    or staff_id = auth.uid()
    or exists (
      select 1 from staff_members sm
      where sm.id = shifts.staff_member_id and sm.user_id = auth.uid()
    )
  );

drop policy if exists read_all on events;
create policy read_events on events for select to authenticated
  using (
    has_role(array['owner','manager','accountant'])
    or exists (
      select 1 from shifts s
      left join staff_members sm on sm.id = s.staff_member_id
      where s.event_id = events.id
        and (s.staff_id = auth.uid() or sm.user_id = auth.uid())
    )
  );
