-- Catering event management: Postgres schema (Supabase-ready)
-- Run in the Supabase SQL editor.

create type user_role as enum ('owner', 'chef', 'staff');
create type event_status as enum ('inquiry', 'quoted', 'confirmed', 'completed', 'cancelled');
create type invoice_status as enum ('draft', 'sent', 'partially_paid', 'paid', 'void');

-- Users (linked to Supabase auth)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null default 'staff',
  hourly_rate numeric(8,2)
);

-- Clients
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  company text,
  notes text,
  created_at timestamptz default now()
);

-- Events (the core record)
create table events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete restrict,
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

-- Menu: ingredients, dishes, and dish recipes
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null,                 -- e.g. kg, l, each
  cost_per_unit numeric(10,2) not null default 0
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,                      -- starter, main, dessert, drink...
  price_per_guest numeric(10,2) not null,
  active boolean not null default true
);

-- Quantity of each ingredient needed per guest for a dish
create table menu_item_ingredients (
  menu_item_id uuid references menu_items on delete cascade,
  ingredient_id uuid references ingredients on delete restrict,
  qty_per_guest numeric(10,4) not null,
  primary key (menu_item_id, ingredient_id)
);

-- Dishes chosen for an event (this is the quote)
create table event_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  menu_item_id uuid not null references menu_items on delete restrict,
  price_per_guest numeric(10,2) not null,   -- snapshot so old quotes don't change
  unique (event_id, menu_item_id)
);

-- Extra quote lines (rentals, delivery, service fees, discounts)
create table event_extras (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  description text not null,
  amount numeric(10,2) not null
);

-- Staff scheduling
create table shifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  staff_id uuid not null references profiles on delete restrict,
  role_label text,                    -- server, bartender, sous chef...
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);

-- Invoicing and payments
create table invoices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete restrict,
  invoice_number text not null unique,
  kind text not null default 'final',  -- deposit | final
  amount numeric(10,2) not null,
  due_date date,
  status invoice_status not null default 'draft',
  created_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices on delete cascade,
  amount numeric(10,2) not null,
  method text,                         -- card, cash, bank transfer
  paid_at timestamptz not null default now()
);

-- Handy views
create view event_totals as
select
  e.id as event_id,
  coalesce(sum(ei.price_per_guest) * e.guest_count, 0)
    + coalesce((select sum(amount) from event_extras x where x.event_id = e.id), 0) as quote_total
from events e
left join event_items ei on ei.event_id = e.id
group by e.id, e.guest_count;

-- Shopping/prep list: total ingredients needed per event
create view event_ingredient_needs as
select
  ei.event_id,
  i.id as ingredient_id,
  i.name,
  i.unit,
  sum(mii.qty_per_guest * e.guest_count) as total_qty,
  sum(mii.qty_per_guest * e.guest_count * i.cost_per_unit) as total_cost
from event_items ei
join events e on e.id = ei.event_id
join menu_item_ingredients mii on mii.menu_item_id = ei.menu_item_id
join ingredients i on i.id = mii.ingredient_id
group by ei.event_id, i.id, i.name, i.unit;

-- Row-level security: with 4 trusted users, any signed-in user can read;
-- only the owner can change money-related tables.
alter table profiles enable row level security;
alter table clients enable row level security;
alter table events enable row level security;
alter table ingredients enable row level security;
alter table menu_items enable row level security;
alter table menu_item_ingredients enable row level security;
alter table event_items enable row level security;
alter table event_extras enable row level security;
alter table shifts enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;

create function is_owner() returns boolean
language sql stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner');
$$;

-- Everyone signed in can read operational data
create policy read_all on clients for select to authenticated using (true);
create policy read_all on events for select to authenticated using (true);
create policy read_all on ingredients for select to authenticated using (true);
create policy read_all on menu_items for select to authenticated using (true);
create policy read_all on menu_item_ingredients for select to authenticated using (true);
create policy read_all on event_items for select to authenticated using (true);
create policy read_all on shifts for select to authenticated using (true);
create policy read_all on profiles for select to authenticated using (true);

-- Money tables: owner only
create policy owner_all on invoices for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_all on payments for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_all on event_extras for all to authenticated using (is_owner()) with check (is_owner());

-- Owner can edit everything else
create policy owner_write on clients for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_write on events for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_write on event_items for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_write on shifts for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_write on profiles for all to authenticated using (is_owner()) with check (is_owner());

-- Chef can manage menu and recipes
create policy chef_write on ingredients for all to authenticated
  using (is_owner() or exists (select 1 from profiles where id = auth.uid() and role = 'chef'))
  with check (is_owner() or exists (select 1 from profiles where id = auth.uid() and role = 'chef'));
create policy chef_write on menu_items for all to authenticated
  using (is_owner() or exists (select 1 from profiles where id = auth.uid() and role = 'chef'))
  with check (is_owner() or exists (select 1 from profiles where id = auth.uid() and role = 'chef'));
create policy chef_write on menu_item_ingredients for all to authenticated
  using (is_owner() or exists (select 1 from profiles where id = auth.uid() and role = 'chef'))
  with check (is_owner() or exists (select 1 from profiles where id = auth.uid() and role = 'chef'));

-- ===== Added in update 2 (business settings + stock) =====
-- Run once in the Supabase SQL editor if you already ran schema.sql earlier.
create table if not exists business_settings (
  id int primary key default 1 check (id = 1),
  name text, address text, phone text, email text
);
insert into business_settings (id, name) values (1, 'IPPAS Food Service & Events') on conflict do nothing;

alter table ingredients add column if not exists stock_qty numeric(12,3) not null default 0;
alter table ingredients add column if not exists low_stock_level numeric(12,3) not null default 0;

alter table business_settings enable row level security;
create policy read_all on business_settings for select to authenticated using (true);
create policy owner_write on business_settings for all to authenticated using (is_owner()) with check (is_owner());

-- ===== Added in update 3 (staff + invoices) =====
-- Run once in the Supabase SQL editor (after migration_02.sql).
create table if not exists staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  role_title text,
  hourly_rate numeric(10,2) not null default 0,
  active boolean not null default true
);
alter table shifts alter column staff_id drop not null;
alter table shifts add column if not exists staff_member_id uuid references staff_members on delete restrict;

alter table invoices add column if not exists snapshot jsonb;
create sequence if not exists invoice_seq;
alter table invoices alter column invoice_number
  set default ('INV-' || lpad(nextval('invoice_seq')::text, 4, '0'));

alter table staff_members enable row level security;
create policy read_all on staff_members for select to authenticated using (true);
create policy owner_write on staff_members for all to authenticated using (is_owner()) with check (is_owner());

-- ===== Added in update 4 (roles) =====
-- Run once in the Supabase SQL editor (after migration_03.sql).
-- Roles: owner, manager, accountant, chef (the old 'staff' value stays as a read-only role).
alter type user_role add value if not exists 'manager';
alter type user_role add value if not exists 'accountant';

create or replace function has_role(roles text[]) returns boolean
language sql stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role::text = any(roles));
$$;

-- New sign-ups automatically get a read-only profile; the owner assigns roles in the app (Users page).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
insert into profiles (id, full_name)
  select id, split_part(email, '@', 1) from auth.users on conflict do nothing;

-- Owner + manager: clients, events, quotes, shifts, staff
do $$
declare t text;
begin
  foreach t in array array['clients','events','event_items','event_extras','shifts','staff_members'] loop
    execute format('drop policy if exists owner_write on %I', t);
    execute format('drop policy if exists owner_all on %I', t);
    execute format('drop policy if exists mgr_write on %I', t);
    execute format('create policy mgr_write on %I for all to authenticated
      using (has_role(array[''owner'',''manager''])) with check (has_role(array[''owner'',''manager'']))', t);
  end loop;
  -- Owner + manager + chef: menu, recipes, stock
  foreach t in array array['ingredients','menu_items','menu_item_ingredients'] loop
    execute format('drop policy if exists chef_write on %I', t);
    execute format('drop policy if exists kitchen_write on %I', t);
    execute format('create policy kitchen_write on %I for all to authenticated
      using (has_role(array[''owner'',''manager'',''chef''])) with check (has_role(array[''owner'',''manager'',''chef'']))', t);
  end loop;
  -- Owner + accountant: invoices and payments
  foreach t in array array['invoices','payments'] loop
    execute format('drop policy if exists owner_all on %I', t);
    execute format('drop policy if exists finance_all on %I', t);
    execute format('create policy finance_all on %I for all to authenticated
      using (has_role(array[''owner'',''accountant''])) with check (has_role(array[''owner'',''accountant'']))', t);
  end loop;
end $$;

drop policy if exists read_all on event_extras;
create policy read_all on event_extras for select to authenticated using (true);

-- Make yourself the owner if needed (replace the email):
-- update profiles set role = 'owner' where id = (select id from auth.users where email = 'you@example.com');

-- ===== Added in update 5 (manager can view invoices) =====
-- Run once in the Supabase SQL editor (after migration_04.sql).
-- Managers can view invoices and payments (read-only).
drop policy if exists finance_read on invoices;
create policy finance_read on invoices for select to authenticated using (has_role(array['manager']));
drop policy if exists finance_read on payments;
create policy finance_read on payments for select to authenticated using (has_role(array['manager']));
