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
