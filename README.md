# Catering Manager (module 1: events, clients, quotes)

1. In Supabase, run `schema.sql` in the SQL editor.
2. Create users under Authentication > Users, then in the `profiles` table add a row for each
   (id = the auth user's id, full_name, role = 'owner' | 'chef' | 'staff').
3. Copy `.env.example` to `.env.local` and fill in your project URL and anon key.
4. `npm install && npm run dev`, open http://localhost:3000
5. To install on a phone: deploy to Vercel, open the site, then "Add to Home Screen".

Dashboard (/dashboard) shows sales, pipeline, payments, monthly sales and top dishes. Owner-only data (payments, extras) shows as 0 for other roles.

## Update 2
- If you already ran schema.sql before, run `migration_02.sql` once in the Supabase SQL editor (fresh installs: schema.sql already includes it).
- New pages: Clients, Stock, Settings. Menu now has edit/hide/delete and recipes. Event pages have an "Edit event details" section and show stock vs. needed.

## Update 3
- Run `migration_03.sql` once in the Supabase SQL editor (after migration_02.sql). Fresh installs: schema.sql already includes everything.
- Staff page: manage staff members (no login needed) and see upcoming shifts. Add shifts from each event page (overlap warning + estimated staff cost).
- Invoices: create from an event page; open to print on A4 (Print / Save as PDF), send a WhatsApp message, record payments. All amounts are in INR, no tax lines.

## Update 4: roles
- Run `migration_04.sql` once (after migration_03.sql). Fresh installs: schema.sql includes it.
- Roles: owner (everything), manager (clients, events, quotes, staff, shifts, menu, stock), accountant (invoices, payments, dashboard; view-only elsewhere), managers also view invoices read-only, chef (menu, recipes, stock; view events and shifts).
- New logins created in Supabase appear on the Users page automatically as read-only "staff"; the owner sets their role there.

## Update 5
- Run `migration_05.sql` once. Managers can now view invoices and payments (read-only); owner and accountant still create invoices and record payments.

## Logo
Logo is in public/logo.png (also used for the app icon). Replace that file to change it.
