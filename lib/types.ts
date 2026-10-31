export type UserRole = 'super_admin' | 'owner' | 'manager' | 'accountant' | 'staff';
export type EventStatus = 'inquiry' | 'quoted' | 'confirmed' | 'completed' | 'cancelled';
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'void';
export type PricingType = 'per_guest' | 'per_kg';
export type StaffSalaryType = 'hourly' | 'per_event' | 'monthly';
export type StaffSalaryRecordType = 'payment' | 'advance' | 'earning';
export type ShiftRateUpdateMode = 'keep_existing' | 'update_upcoming' | 'update_all_unsettled';

export interface Profile {
  id: string;
  username: string;
  password?: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  role_title?: string;
  hourly_rate?: number;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  created_at: string;
}

export interface EventRecord {
  id: string;
  quotation_number?: string;
  client_id: string;
  title: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  venue?: string;
  guest_count: number;
  status: EventStatus;
  notes?: string;
  payment_terms?: string;
  show_bank_details?: boolean;
  show_payment_details?: boolean;
  stock_deducted?: boolean;
  locked_ingredient_costs?: Record<string, number>;
  created_at: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  stock_qty: number;
  low_stock_level: number;
  expiry_date?: string;
}

export type StockPaymentStatus = 'paid' | 'partially_paid' | 'unpaid';

export interface StockPurchasePayment {
  id: string;
  purchase_id: string;
  amount: number;
  paid_at: string;
  method: string;
  note?: string;
}

export interface StockPurchaseItem {
  id: string;
  ingredient_id?: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export interface StockPurchase {
  id: string;
  purchase_date: string;
  vendor_name: string;
  vendor_location?: string;
  vendor_phone?: string;
  bill_number?: string;
  items: StockPurchaseItem[];
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: StockPaymentStatus;
  payment_method: string;
  notes?: string;
  created_at: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  pricing_type: PricingType;
  price_per_unit: number;
  price_per_guest: number;
  active: boolean;
}

export interface MenuItemIngredient {
  menu_item_id: string;
  ingredient_id: string;
  qty_per_guest: number;
}

export interface EventItem {
  id: string;
  event_id: string;
  menu_item_id: string;
  pricing_type: PricingType;
  price_per_unit: number;
  quantity?: number;
  price_per_guest: number;
  dish_name?: string;
  dish_category?: string;
}

export interface EventExtra {
  id: string;
  event_id: string;
  description: string;
  amount: number;
}

export interface StaffSalaryRatePeriod {
  salary_type: StaffSalaryType;
  hourly_rate: number;
  event_rate: number;
  monthly_salary: number;
  effective_from: string;
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  password?: string;
  role_title?: string;
  salary_type?: StaffSalaryType;
  hourly_rate: number;
  event_rate?: number;
  monthly_salary?: number;
  salary_start_date?: string;
  salary_history?: StaffSalaryRatePeriod[];
  active: boolean;
}

export type ShiftAttendanceStatus = 'pending' | 'present' | 'absent';
export type PaymentChannel = 'bank' | 'cash';

export interface Shift {
  id: string;
  event_id: string;
  staff_member_id: string;
  role_label?: string;
  starts_at: string;
  ends_at: string;
  duty_note?: string;
  whatsapp_notified_at?: string;
  attendance_status?: ShiftAttendanceStatus;
  attendance_marked_at?: string;
  locked_salary_type?: StaffSalaryType;
  locked_hourly_rate?: number;
  locked_event_rate?: number;
  locked_monthly_salary?: number;
  rate_locked_at?: string;
}

export interface StaffSalaryRecord {
  id: string;
  staff_member_id: string;
  event_id?: string;
  record_type: StaffSalaryRecordType;
  amount: number;
  recorded_at: string;
  method: string;
  note?: string;
}

export interface InvoiceLineSnapshot {
  id: string;
  description: string;
  category?: string;
  pricing_type?: PricingType | 'extra';
  qty_label: string;
  rate_label: string;
  line_total: number;
  is_extra?: boolean;
}

export interface Invoice {
  id: string;
  event_id: string;
  invoice_number: string;
  quotation_number?: string;
  kind: 'deposit' | 'final';
  subtotal: number;
  discount: number;
  discount_note?: string;
  amount: number;
  due_date?: string;
  status: InvoiceStatus;
  show_bank_details?: boolean;
  show_payment_details?: boolean;
  locked_items_snapshot?: InvoiceLineSnapshot[];
  created_at: string;
  notes?: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  payment_channel?: PaymentChannel;
  destination_account?: string;
  paid_at: string;
  note?: string;
}

export interface BusinessSettings {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  payment_terms?: string;
  last_backup_downloaded_at?: string;
}

export type EventExpenseCategory =
  | 'stock_pricing'
  | 'extras_cost'
  | 'staff_expense'
  | 'other_expense';

export interface EventExpense {
  id: string;
  event_id: string;
  category: EventExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  notes?: string;
  created_by_role?: UserRole;
  created_by_name?: string;
  created_at: string;
}

export type AuditEntityType =
  | 'event'
  | 'quotation'
  | 'event_expense'
  | 'invoice'
  | 'payment'
  | 'client'
  | 'menu'
  | 'recipe'
  | 'stock'
  | 'purchase'
  | 'staff'
  | 'shift'
  | 'salary'
  | 'settings'
  | 'user'
  | 'database';

export type AuditAction = 'create' | 'update' | 'delete';
export type AuditSource = 'app' | 'database';

export interface AuditLogEntry {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  parent_event_id?: string;
  action: AuditAction;
  summary: string;
  details?: string;
  actor_id?: string;
  actor_username: string;
  actor_name: string;
  actor_role: UserRole | 'database';
  source: AuditSource;
  is_read_by_owner: boolean;
  created_at: string;
}


