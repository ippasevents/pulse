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
