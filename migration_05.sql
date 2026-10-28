-- Run once in the Supabase SQL editor (after migration_04.sql).
-- Managers can view invoices and payments (read-only).
drop policy if exists finance_read on invoices;
create policy finance_read on invoices for select to authenticated using (has_role(array['manager']));
drop policy if exists finance_read on payments;
create policy finance_read on payments for select to authenticated using (has_role(array['manager']));
