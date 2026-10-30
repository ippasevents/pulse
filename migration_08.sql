-- =================================================================================
-- IPPAS Pulse - Migration 08: Event Extra Expenses & Profit/Loss Tracking
-- Safe & Idempotent SQL script for Supabase SQL Editor
-- =================================================================================

create extension if not exists "pgcrypto";

create table if not exists event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade not null,
  category text not null check (category in ('stock_pricing', 'extras_cost', 'staff_expense', 'other_expense')),
  description text not null,
  amount numeric not null default 0,
  expense_date date not null default current_date,
  notes text,
  created_by_role text,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_expenses_event_id on event_expenses(event_id);

alter table event_expenses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'event_expenses' and policyname = 'Public full access event_expenses'
  ) then
    create policy "Public full access event_expenses"
      on event_expenses for all
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  begin
    execute 'alter table event_expenses replica identity full';
  exception when others then null;
  end;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'event_expenses'
  ) then
    begin
      execute 'alter publication supabase_realtime add table event_expenses';
    exception when others then null;
    end;
  end if;
end $$;
