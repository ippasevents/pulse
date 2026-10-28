export type UserRole = 'owner' | 'manager' | 'accountant' | 'staff';
export type EventStatus = 'inquiry' | 'quoted' | 'confirmed' | 'completed' | 'cancelled';
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'void';
export type PricingType = 'per_guest' | 'per_kg';

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
  client_id: string;
  title: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  venue?: string;
  guest_count: number;
  status: EventStatus;
  notes?: string;
  created_at: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  stock_qty: number;
  low_stock_level: number;
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
}

export interface EventExtra {
  id: string;
  event_id: string;
  description: string;
  amount: number;
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  password?: string;
  role_title?: string;
  hourly_rate: number;
  active: boolean;
}

export interface Shift {
  id: string;
  event_id: string;
  staff_member_id: string;
  role_label?: string;
  starts_at: string;
  ends_at: string;
}

export interface Invoice {
  id: string;
  event_id: string;
  invoice_number: string;
  kind: 'deposit' | 'final';
  subtotal: number;
  discount: number;
  amount: number;
  due_date?: string;
  status: InvoiceStatus;
  created_at: string;
  notes?: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
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
}
