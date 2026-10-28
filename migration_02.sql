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
