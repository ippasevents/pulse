-- migration_07.sql
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run).
-- Adds Owner-only Activity & Audit Logging + Automatic Database Change Detection Triggers.

-- 1. Create activity_logs table
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

-- 2. Enable RLS & Realtime on activity_logs
alter table activity_logs enable row level security;
drop policy if exists app_full_access on activity_logs;
create policy app_full_access on activity_logs
  for all to anon, authenticated
  using (true)
  with check (true);

do $$ begin
  alter publication supabase_realtime add table activity_logs;
exception
  when others then null;
end $$;

-- 3. Deduplication trigger when app writes rich user-attributed logs
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

-- 4. Automatic Database Change Trigger Function (catches direct SQL / Table Editor / external API changes)
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

  -- Skip if a matching in-app audit log was already written within the last 15 seconds
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

-- 5. Attach Direct Database Audit Triggers to All Business Tables
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
    'stock_purchase_payments'
  ] loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) then
      execute format('drop trigger if exists trg_capture_db_changes on %I', tbl);
      execute format(
        'create trigger trg_capture_db_changes after insert or update or delete on %I for each row execute function fn_capture_direct_db_changes()',
        tbl
      );
    end if;
  end loop;
end $$;
