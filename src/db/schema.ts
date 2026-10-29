import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uuid,
  primaryKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Firebase Auth Users Table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Business Settings Table
export const businessSettings = pgTable('business_settings', {
  id: integer('id').primaryKey().default(1),
  name: text('name'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  bank_name: text('bank_name'),
  account_name: text('account_name'),
  account_number: text('account_number'),
  ifsc_code: text('ifsc_code'),
  upi_id: text('upi_id'),
  payment_terms: text('payment_terms'),
  auto_email_invoices: boolean('auto_email_invoices').default(true),
  invoice_notification_email: text('invoice_notification_email').default('ippasevents@gmail.com')
});

// Profiles (Staff / Management User Logins)
export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').unique(),
  password: text('password'),
  full_name: text('full_name').notNull(),
  phone: text('phone'),
  role: text('role').notNull().default('staff'),
  role_title: text('role_title'),
  hourly_rate: numeric('hourly_rate', { precision: 8, scale: 2 })
});

// Clients Table
export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Ingredients Table
export const ingredients = pgTable('ingredients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  unit: text('unit').notNull().default('kg'),
  cost_per_unit: numeric('cost_per_unit', { precision: 10, scale: 2 }).notNull().default('0'),
  stock_qty: numeric('stock_qty', { precision: 12, scale: 3 }).notNull().default('0'),
  low_stock_level: numeric('low_stock_level', { precision: 12, scale: 3 }).notNull().default('0')
});

// Menu Items Table
export const menuItems = pgTable('menu_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  pricing_type: text('pricing_type').notNull().default('per_guest'),
  price_per_unit: numeric('price_per_unit', { precision: 10, scale: 2 }),
  price_per_guest: numeric('price_per_guest', { precision: 10, scale: 2 }).notNull().default('0'),
  active: boolean('active').notNull().default(true)
});

// Menu Item Ingredients Table (Composite PK)
export const menuItemIngredients = pgTable(
  'menu_item_ingredients',
  {
    menu_item_id: uuid('menu_item_id')
      .references(() => menuItems.id, { onDelete: 'cascade' })
      .notNull(),
    ingredient_id: uuid('ingredient_id')
      .references(() => ingredients.id, { onDelete: 'cascade' })
      .notNull(),
    qty_per_guest: numeric('qty_per_guest', { precision: 10, scale: 4 }).notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.menu_item_id, table.ingredient_id] })
  })
);

// Catering Events Table
export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  client_id: uuid('client_id')
    .references(() => clients.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  event_date: text('event_date').notNull(),
  start_time: text('start_time'),
  end_time: text('end_time'),
  venue: text('venue'),
  guest_count: integer('guest_count').notNull(),
  status: text('status').notNull().default('inquiry'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Event Menu Items Table
export const eventItems = pgTable('event_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  event_id: uuid('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  menu_item_id: uuid('menu_item_id')
    .references(() => menuItems.id, { onDelete: 'cascade' })
    .notNull(),
  pricing_type: text('pricing_type').notNull().default('per_guest'),
  price_per_unit: numeric('price_per_unit', { precision: 10, scale: 2 }),
  price_per_guest: numeric('price_per_guest', { precision: 10, scale: 2 }).notNull().default('0'),
  quantity: numeric('quantity', { precision: 10, scale: 3 })
});

// Event Extras Table
export const eventExtras = pgTable('event_extras', {
  id: uuid('id').defaultRandom().primaryKey(),
  event_id: uuid('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull().default('0')
});

// Staff Members Table
export const staffMembers = pgTable('staff_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  password: text('password').default('password123'),
  role_title: text('role_title'),
  hourly_rate: numeric('hourly_rate', { precision: 10, scale: 2 }).notNull().default('0'),
  active: boolean('active').notNull().default(true)
});

// Event Shifts Table
export const shifts = pgTable('shifts', {
  id: uuid('id').defaultRandom().primaryKey(),
  event_id: uuid('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  staff_id: uuid('staff_id').references(() => profiles.id, { onDelete: 'set null' }),
  staff_member_id: uuid('staff_member_id').references(() => staffMembers.id, { onDelete: 'cascade' }),
  role_label: text('role_label'),
  starts_at: timestamp('starts_at', { withTimezone: true }).notNull(),
  ends_at: timestamp('ends_at', { withTimezone: true }).notNull(),
  attendance_status: text('attendance_status').notNull().default('pending'),
  attendance_marked_at: timestamp('attendance_marked_at', { withTimezone: true })
});

// Staff Salary & Wage Records Table
export const staffSalaryRecords = pgTable('staff_salary_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  staff_member_id: uuid('staff_member_id')
    .references(() => staffMembers.id, { onDelete: 'cascade' })
    .notNull(),
  event_id: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
  record_type: text('record_type').notNull().default('payment'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
  method: text('method').notNull().default('Cash'),
  note: text('note'),
  recorded_at: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow()
});

// Invoices Table
export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  event_id: uuid('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  invoice_number: text('invoice_number').notNull().unique(),
  kind: text('kind').notNull().default('final'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }),
  discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
  due_date: text('due_date'),
  status: text('status').notNull().default('draft'),
  notes: text('notes'),
  snapshot: jsonb('snapshot'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Payments Table
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoice_id: uuid('invoice_id')
    .references(() => invoices.id, { onDelete: 'cascade' })
    .notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  method: text('method'),
  payment_channel: text('payment_channel').notNull().default('bank'),
  destination_account: text('destination_account'),
  note: text('note'),
  paid_at: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow()
});

// Stock Purchases Table
export const stockPurchases = pgTable('stock_purchases', {
  id: uuid('id').defaultRandom().primaryKey(),
  purchase_date: text('purchase_date').notNull(),
  vendor_name: text('vendor_name').notNull(),
  vendor_location: text('vendor_location'),
  vendor_phone: text('vendor_phone'),
  bill_number: text('bill_number'),
  total_amount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  paid_amount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  balance_amount: numeric('balance_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  payment_status: text('payment_status').notNull().default('unpaid'),
  payment_method: text('payment_method').notNull().default('Cash'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// Stock Purchase Line Items Table
export const stockPurchaseItems = pgTable('stock_purchase_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  purchase_id: uuid('purchase_id')
    .references(() => stockPurchases.id, { onDelete: 'cascade' })
    .notNull(),
  ingredient_id: uuid('ingredient_id').references(() => ingredients.id, { onDelete: 'set null' }),
  item_name: text('item_name').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull().default('1'),
  unit: text('unit').notNull().default('kg'),
  unit_price: numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
  total_price: numeric('total_price', { precision: 12, scale: 2 }).notNull().default('0')
});

// Stock Purchase Payments Table
export const stockPurchasePayments = pgTable('stock_purchase_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  purchase_id: uuid('purchase_id')
    .references(() => stockPurchases.id, { onDelete: 'cascade' })
    .notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paid_at: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
  method: text('method').notNull().default('Cash'),
  note: text('note')
});

// Activity / Audit Logs Table
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id').notNull(),
  parent_event_id: text('parent_event_id'),
  action: text('action').notNull(),
  summary: text('summary').notNull(),
  details: text('details'),
  actor_id: text('actor_id'),
  actor_username: text('actor_username').notNull().default('system'),
  actor_name: text('actor_name').notNull().default('System / Database'),
  actor_role: text('actor_role').notNull().default('database'),
  source: text('source').notNull().default('database'),
  is_read_by_owner: boolean('is_read_by_owner').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// Relations
export const clientsRelations = relations(clients, ({ many }) => ({
  events: many(events)
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  client: one(clients, {
    fields: [events.client_id],
    references: [clients.id]
  }),
  items: many(eventItems),
  extras: many(eventExtras),
  shifts: many(shifts),
  invoices: many(invoices)
}));

export const eventItemsRelations = relations(eventItems, ({ one }) => ({
  event: one(events, {
    fields: [eventItems.event_id],
    references: [events.id]
  }),
  menuItem: one(menuItems, {
    fields: [eventItems.menu_item_id],
    references: [menuItems.id]
  })
}));

export const menuItemsRelations = relations(menuItems, ({ many }) => ({
  ingredients: many(menuItemIngredients),
  eventItems: many(eventItems)
}));

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  menuItems: many(menuItemIngredients)
}));

export const staffMembersRelations = relations(staffMembers, ({ many }) => ({
  shifts: many(shifts),
  salaryRecords: many(staffSalaryRecords)
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  event: one(events, {
    fields: [invoices.event_id],
    references: [events.id]
  }),
  payments: many(payments)
}));

export const stockPurchasesRelations = relations(stockPurchases, ({ many }) => ({
  items: many(stockPurchaseItems),
  payments: many(stockPurchasePayments)
}));
