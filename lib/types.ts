export type UserRole = 'owner' | 'manager' | 'accountant' | 'chef' | 'staff';
export type EventStatus = 'inquiry' | 'quoted' | 'confirmed' | 'completed' | 'cancelled';
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'void';

export interface Profile {
  id: string;
  full_name: string;
  phone?: string;
  role: UserRole;
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

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  category: string;
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
  phone?: string;
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
  subtotal?: number;
  discount?: number;
  amount: number;
  due_date?: string;
  status: InvoiceStatus;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  paid_at: string;
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
