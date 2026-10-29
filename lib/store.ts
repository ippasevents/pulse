'use client';

import {
  supabase,
  isSupabaseConfigured,
  ensureSupabaseOnlineConnection,
  setLiveSupabaseCredentials,
  clearLiveSupabaseCredentials,
  onSupabaseConfigChange,
  getSupabaseConfig
} from './supabase';
import {
  Client,
  EventRecord,
  Ingredient,
  MenuItem,
  MenuItemIngredient,
  EventItem,
  EventExtra,
  StaffMember,
  Shift,
  ShiftAttendanceStatus,
  StaffSalaryRecord,
  StaffSalaryRecordType,
  Invoice,
  Payment,
  PaymentChannel,
  BusinessSettings,
  Profile,
  UserRole,
  PricingType,
  StockPurchase,
  StockPurchaseItem,
  StockPurchasePayment,
  StockPaymentStatus,
  AuditLogEntry,
  AuditEntityType,
  AuditAction,
  AuditSource
} from './types';

export interface StaffShiftEarningItem {
  shift: Shift;
  event?: EventRecord;
  hours: number;
  hourlyRate: number;
  attendanceStatus: ShiftAttendanceStatus;
  isAttended: boolean;
  earnedAmount: number;
}

export interface StaffSalarySummary {
  staffId: string;
  shiftItems: StaffShiftEarningItem[];
  attendedShiftsCount: number;
  absentShiftsCount: number;
  pendingShiftsCount: number;
  totalShiftHours: number;
  shiftEarnings: number;
  extraEarnings: number;
  totalEarned: number;
  totalPaid: number;
  balancePayable: number;
  advanceExcess: number;
  paymentRecords: StaffSalaryRecord[];
  earningRecords: StaffSalaryRecord[];
}

export interface InvoiceAccountHolding {
  accountName: string;
  channel: PaymentChannel;
  totalReceived: number;
  paymentCount: number;
  lastReceivedAt: string;
}

export interface InvoiceCollectionsBreakdown {
  totalInvoiced: number;
  totalCollected: number;
  totalPendingReceivable: number;
  totalBankReceived: number;
  totalCashReceived: number;
  bankPaymentCount: number;
  cashPaymentCount: number;
  accountHoldings: InvoiceAccountHolding[];
}

export interface StockEstimationItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  costPerUnit: number;
  qtyNeeded: number;
  currentStock: number;
  shortageQty: number;
  estimatedCost: number;
  isShortage: boolean;
  contributingDishes: string[];
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isValidUUID(val: string | undefined | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

const INITIAL_SETTINGS: BusinessSettings = {
  id: 1,
  name: 'IPPAS Food Service & Events',
  address: '24 Park Street, Suite 402, Calicut, Kerala',
  phone: '+91 98470 12345',
  email: 'events@ippas.com',
  bank_name: 'Federal Bank / State Bank of India',
  account_name: 'IPPAS Food Service & Events',
  account_number: '9876-5432-1000',
  ifsc_code: 'FDRL0001234',
  upi_id: 'ippas@upi',
  payment_terms: 'Payment strictly due within 3 days. 50% advance deposit upon booking confirmation.',
  auto_email_invoices: true,
  invoice_notification_email: 'ippasevents@gmail.com'
};

const INITIAL_PROFILES: Profile[] = [
  {
    id: '00000000-0000-4000-8000-000000000000',
    username: 'superadmin',
    password: 'superadmin123',
    full_name: 'Super Admin',
    role: 'super_admin',
    phone: '+91 99999 00000'
  },
  {
    id: '00000000-0000-4000-8000-000000000001',
    username: 'owner',
    password: 'owner123',
    full_name: 'Fazil (Owner)',
    role: 'owner',
    phone: '+91 98470 11111'
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    username: 'manager',
    password: 'manager123',
    full_name: 'Aisha (Manager)',
    role: 'manager',
    phone: '+91 98470 22222'
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    username: 'accountant',
    password: 'accountant123',
    full_name: 'Rahul (Accountant)',
    role: 'accountant',
    phone: '+91 98470 33333'
  }
];

const INITIAL_CLIENTS: Client[] = [
  { id: '00000000-0000-4000-8000-000000000101', name: 'Dr. Zameer Khan', company: 'Aster Medcity', phone: '+91 94471 00001', email: 'zameer@example.com', notes: 'VIP client, prefers mild spice', created_at: '2026-09-01T10:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000102', name: 'Ananya Nair', company: 'Kerala Tech Summit', phone: '+91 94471 00002', email: 'ananya@techsummit.in', notes: 'Annual corporate gala banquet', created_at: '2026-09-15T14:30:00Z' },
  { id: '00000000-0000-4000-8000-000000000103', name: 'Farhan & Nimra Wedding', company: '', phone: '+91 94471 00003', email: 'farhan.events@gmail.com', notes: 'Royal wedding dinner at Beachfront Resort', created_at: '2026-10-01T09:00:00Z' }
];

const INITIAL_INGREDIENTS: Ingredient[] = [
  { id: '00000000-0000-4000-8000-000000000201', name: 'Basmati Rice (Khaas)', unit: 'kg', cost_per_unit: 140, stock_qty: 150, low_stock_level: 50 },
  { id: '00000000-0000-4000-8000-000000000202', name: 'Malabar Mutton (Fresh)', unit: 'kg', cost_per_unit: 850, stock_qty: 45, low_stock_level: 20 },
  { id: '00000000-0000-4000-8000-000000000203', name: 'Chicken (Curry Cut)', unit: 'kg', cost_per_unit: 260, stock_qty: 80, low_stock_level: 30 },
  { id: '00000000-0000-4000-8000-000000000204', name: 'Pure Desi Ghee', unit: 'l', cost_per_unit: 680, stock_qty: 25, low_stock_level: 10 },
  { id: '00000000-0000-4000-8000-000000000205', name: 'Brown Shallots / Onion', unit: 'kg', cost_per_unit: 45, stock_qty: 120, low_stock_level: 40 },
  { id: '00000000-0000-4000-8000-000000000206', name: 'Saffron & Spices Mix', unit: 'kg', cost_per_unit: 1200, stock_qty: 5, low_stock_level: 2 },
  { id: '00000000-0000-4000-8000-000000000207', name: 'Fresh Paneer', unit: 'kg', cost_per_unit: 380, stock_qty: 18, low_stock_level: 10 },
  { id: '00000000-0000-4000-8000-000000000208', name: 'Tender Coconut Pulp', unit: 'l', cost_per_unit: 180, stock_qty: 12, low_stock_level: 15 },
  { id: '00000000-0000-4000-8000-000000000209', name: 'Cashews & Raisins', unit: 'kg', cost_per_unit: 750, stock_qty: 15, low_stock_level: 5 }
];

const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    name: 'Thalassery Mutton Dum Biryani',
    description: 'Traditional aromatic kaima rice dum biryani cooked in pure ghee with tender mutton chunks',
    category: 'Main',
    pricing_type: 'per_guest',
    price_per_unit: 420,
    price_per_guest: 420,
    active: true
  },
  {
    id: '00000000-0000-4000-8000-000000000302',
    name: 'Malabar Chicken Roast & Kerala Parotta',
    description: 'Caramelized onion-marinated chicken served with flaky handmade coin parottas',
    category: 'Main',
    pricing_type: 'per_guest',
    price_per_unit: 320,
    price_per_guest: 320,
    active: true
  },
  {
    id: '00000000-0000-4000-8000-000000000303',
    name: 'Paneer Butter Masala & Garlic Naan',
    description: 'Cottage cheese simmered in rich cashew tomato gravy',
    category: 'Main',
    pricing_type: 'per_guest',
    price_per_unit: 280,
    price_per_guest: 280,
    active: true
  },
  {
    id: '00000000-0000-4000-8000-000000000304',
    name: 'Golden Crispy Fish Fingers w/ Tartar',
    description: 'Fresh catch fish fillet crumbed and fried with house dip',
    category: 'Starter',
    pricing_type: 'per_guest',
    price_per_unit: 180,
    price_per_guest: 180,
    active: true
  },
  {
    id: '00000000-0000-4000-8000-000000000305',
    name: 'Kozhi Porichathu (Calicut Fried Chicken)',
    description: 'Spicy deep-fried chicken wings with curry leaves and green chillies',
    category: 'Starter',
    pricing_type: 'per_guest',
    price_per_unit: 160,
    price_per_guest: 160,
    active: true
  },
  {
    id: '00000000-0000-4000-8000-000000000306',
    name: 'Tender Coconut Souffle Pudding',
    description: 'Silky dessert made from fresh elaneer pulp and cream',
    category: 'Dessert',
    pricing_type: 'per_guest',
    price_per_unit: 120,
    price_per_guest: 120,
    active: true
  },
  {
    id: '00000000-0000-4000-8000-000000000307',
    name: 'Sulaimani with Spiced Mint',
    description: 'Digestive black tea flavored with clove, cardamom and lemon',
    category: 'Drink',
    pricing_type: 'per_guest',
    price_per_unit: 40,
    price_per_guest: 40,
    active: true
  },
  {
    id: '00000000-0000-4000-8000-000000000308',
    name: 'Special Malabar Dum Biriyani (Bulk Handi)',
    description: 'Freshly prepared bulk handi dum biryani supplied by kilogram with boiled eggs, raita & pickle',
    category: 'Main',
    pricing_type: 'per_kg',
    price_per_unit: 1250,
    price_per_guest: 1250,
    active: true
  },
  {
    id: '00000000-0000-4000-8000-000000000309',
    name: 'Traditional Kozhikodan Halwa Assortment',
    description: 'Authentic wheat & ghee Calicut halwa sold per kilogram',
    category: 'Dessert',
    pricing_type: 'per_kg',
    price_per_unit: 450,
    price_per_guest: 450,
    active: true
  }
];

const INITIAL_RECIPES: MenuItemIngredient[] = [
  { menu_item_id: '00000000-0000-4000-8000-000000000301', ingredient_id: '00000000-0000-4000-8000-000000000201', qty_per_guest: 0.18 },
  { menu_item_id: '00000000-0000-4000-8000-000000000301', ingredient_id: '00000000-0000-4000-8000-000000000202', qty_per_guest: 0.25 },
  { menu_item_id: '00000000-0000-4000-8000-000000000301', ingredient_id: '00000000-0000-4000-8000-000000000204', qty_per_guest: 0.03 },
  { menu_item_id: '00000000-0000-4000-8000-000000000301', ingredient_id: '00000000-0000-4000-8000-000000000205', qty_per_guest: 0.12 },
  { menu_item_id: '00000000-0000-4000-8000-000000000301', ingredient_id: '00000000-0000-4000-8000-000000000206', qty_per_guest: 0.008 },
  { menu_item_id: '00000000-0000-4000-8000-000000000301', ingredient_id: '00000000-0000-4000-8000-000000000209', qty_per_guest: 0.015 },
  { menu_item_id: '00000000-0000-4000-8000-000000000302', ingredient_id: '00000000-0000-4000-8000-000000000203', qty_per_guest: 0.22 },
  { menu_item_id: '00000000-0000-4000-8000-000000000302', ingredient_id: '00000000-0000-4000-8000-000000000205', qty_per_guest: 0.1 },
  { menu_item_id: '00000000-0000-4000-8000-000000000303', ingredient_id: '00000000-0000-4000-8000-000000000207', qty_per_guest: 0.15 },
  { menu_item_id: '00000000-0000-4000-8000-000000000306', ingredient_id: '00000000-0000-4000-8000-000000000208', qty_per_guest: 0.08 },
  { menu_item_id: '00000000-0000-4000-8000-000000000308', ingredient_id: '00000000-0000-4000-8000-000000000201', qty_per_guest: 0.35 },
  { menu_item_id: '00000000-0000-4000-8000-000000000308', ingredient_id: '00000000-0000-4000-8000-000000000202', qty_per_guest: 0.5 },
  { menu_item_id: '00000000-0000-4000-8000-000000000308', ingredient_id: '00000000-0000-4000-8000-000000000204', qty_per_guest: 0.08 }
];

const INITIAL_EVENTS: EventRecord[] = [
  {
    id: '00000000-0000-4000-8000-000000000401',
    client_id: '00000000-0000-4000-8000-000000000103',
    title: 'Farhan & Nimra Grand Wedding Banquet',
    event_date: '2026-11-12',
    start_time: '18:30',
    end_time: '23:00',
    venue: 'Raviz Kadavu Grand Lawn',
    guest_count: 350,
    status: 'confirmed',
    notes: 'Live cooking counters, bridal VIP seating service',
    created_at: '2026-10-02T11:00:00Z'
  },
  {
    id: '00000000-0000-4000-8000-000000000402',
    client_id: '00000000-0000-4000-8000-000000000102',
    title: 'Kerala Tech Summit Luncheon',
    event_date: '2026-11-20',
    start_time: '12:00',
    end_time: '15:30',
    venue: 'Cyberpark Convention Hall',
    guest_count: 180,
    status: 'quoted',
    notes: 'Buffet setup with high-top tables, quick refilling required',
    created_at: '2026-10-10T14:00:00Z'
  },
  {
    id: '00000000-0000-4000-8000-000000000403',
    client_id: '00000000-0000-4000-8000-000000000101',
    title: 'Aster Medical Doctors Day Gala',
    event_date: '2026-12-05',
    start_time: '19:00',
    end_time: '22:30',
    venue: 'Hotel Malabar Palace',
    guest_count: 120,
    status: 'inquiry',
    notes: 'Tentative date, awaiting board approval for final menu',
    created_at: '2026-10-20T08:30:00Z'
  }
];

const INITIAL_EVENT_ITEMS: EventItem[] = [
  { id: '00000000-0000-4000-8000-000000000501', event_id: '00000000-0000-4000-8000-000000000401', menu_item_id: '00000000-0000-4000-8000-000000000304', pricing_type: 'per_guest', price_per_unit: 180, price_per_guest: 180 },
  { id: '00000000-0000-4000-8000-000000000502', event_id: '00000000-0000-4000-8000-000000000401', menu_item_id: '00000000-0000-4000-8000-000000000301', pricing_type: 'per_guest', price_per_unit: 420, price_per_guest: 420 },
  { id: '00000000-0000-4000-8000-000000000503', event_id: '00000000-0000-4000-8000-000000000401', menu_item_id: '00000000-0000-4000-8000-000000000306', pricing_type: 'per_guest', price_per_unit: 120, price_per_guest: 120 },
  { id: '00000000-0000-4000-8000-000000000504', event_id: '00000000-0000-4000-8000-000000000401', menu_item_id: '00000000-0000-4000-8000-000000000307', pricing_type: 'per_guest', price_per_unit: 40, price_per_guest: 40 },
  { id: '00000000-0000-4000-8000-000000000505', event_id: '00000000-0000-4000-8000-000000000402', menu_item_id: '00000000-0000-4000-8000-000000000302', pricing_type: 'per_guest', price_per_unit: 320, price_per_guest: 320 },
  { id: '00000000-0000-4000-8000-000000000506', event_id: '00000000-0000-4000-8000-000000000402', menu_item_id: '00000000-0000-4000-8000-000000000303', pricing_type: 'per_guest', price_per_unit: 280, price_per_guest: 280 },
  { id: '00000000-0000-4000-8000-000000000507', event_id: '00000000-0000-4000-8000-000000000402', menu_item_id: '00000000-0000-4000-8000-000000000307', pricing_type: 'per_guest', price_per_unit: 40, price_per_guest: 40 }
];

const INITIAL_EVENT_EXTRAS: EventExtra[] = [
  { id: '00000000-0000-4000-8000-000000000601', event_id: '00000000-0000-4000-8000-000000000401', description: 'Chafing dishes, copper crockery & linen rental', amount: 18500 },
  { id: '00000000-0000-4000-8000-000000000602', event_id: '00000000-0000-4000-8000-000000000401', description: 'Refrigerated transport & on-site logistics', amount: 6500 },
  { id: '00000000-0000-4000-8000-000000000603', event_id: '00000000-0000-4000-8000-000000000402', description: 'Premium cutlery & buffet station decors', amount: 8000 }
];

const INITIAL_STAFF: StaffMember[] = [
  { id: '00000000-0000-4000-8000-000000000701', name: 'Shyam Kumar', phone: '9745111001', password: 'password123', role_title: 'Senior Banquet Captain', hourly_rate: 350, active: true },
  { id: '00000000-0000-4000-8000-000000000702', name: 'Abdul Rasheed', phone: '9745111002', password: 'password123', role_title: 'Lead Chef', hourly_rate: 450, active: true },
  { id: '00000000-0000-4000-8000-000000000703', name: 'Manoj Pillai', phone: '9745111003', password: 'password123', role_title: 'Buffet Server', hourly_rate: 200, active: true },
  { id: '00000000-0000-4000-8000-000000000704', name: 'Rubeena K', phone: '9745111004', password: 'password123', role_title: 'Buffet Server', hourly_rate: 200, active: true },
  { id: '00000000-0000-4000-8000-000000000705', name: 'Jithesh P', phone: '9745111005', password: 'password123', role_title: 'Dish Steward / Utility', hourly_rate: 180, active: true }
];

const INITIAL_SHIFTS: Shift[] = [
  {
    id: '00000000-0000-4000-8000-000000000801',
    event_id: '00000000-0000-4000-8000-000000000401',
    staff_member_id: '00000000-0000-4000-8000-000000000701',
    role_label: 'Captain',
    starts_at: '2026-11-12T16:00:00Z',
    ends_at: '2026-11-12T23:30:00Z',
    attendance_status: 'present',
    attendance_marked_at: '2026-10-27T18:00:00Z'
  },
  {
    id: '00000000-0000-4000-8000-000000000802',
    event_id: '00000000-0000-4000-8000-000000000401',
    staff_member_id: '00000000-0000-4000-8000-000000000702',
    role_label: 'Head Cook',
    starts_at: '2026-11-12T14:00:00Z',
    ends_at: '2026-11-12T22:00:00Z',
    attendance_status: 'present',
    attendance_marked_at: '2026-10-27T18:00:00Z'
  },
  {
    id: '00000000-0000-4000-8000-000000000803',
    event_id: '00000000-0000-4000-8000-000000000401',
    staff_member_id: '00000000-0000-4000-8000-000000000703',
    role_label: 'Server',
    starts_at: '2026-11-12T17:30:00Z',
    ends_at: '2026-11-12T23:00:00Z',
    attendance_status: 'absent',
    attendance_marked_at: '2026-10-27T18:05:00Z'
  },
  {
    id: '00000000-0000-4000-8000-000000000804',
    event_id: '00000000-0000-4000-8000-000000000401',
    staff_member_id: '00000000-0000-4000-8000-000000000704',
    role_label: 'Server',
    starts_at: '2026-11-12T17:30:00Z',
    ends_at: '2026-11-12T23:00:00Z',
    attendance_status: 'pending'
  }
];

const INITIAL_STAFF_SALARY_RECORDS: StaffSalaryRecord[] = [
  {
    id: '00000000-0000-4000-8000-000000001401',
    staff_member_id: '00000000-0000-4000-8000-000000000701',
    event_id: '00000000-0000-4000-8000-000000000401',
    record_type: 'payment',
    amount: 1000,
    method: 'UPI / GPay',
    note: 'Advance salary payment',
    recorded_at: '2026-10-25T12:00:00Z'
  },
  {
    id: '00000000-0000-4000-8000-000000001402',
    staff_member_id: '00000000-0000-4000-8000-000000000702',
    event_id: '00000000-0000-4000-8000-000000000401',
    record_type: 'payment',
    amount: 2000,
    method: 'Cash',
    note: 'Kitchen duty advance',
    recorded_at: '2026-10-26T15:30:00Z'
  }
];

const INITIAL_INVOICES: Invoice[] = [
  { id: '00000000-0000-4000-8000-000000000901', event_id: '00000000-0000-4000-8000-000000000401', invoice_number: 'INV-0001', kind: 'deposit', subtotal: 100000, discount: 0, amount: 100000, due_date: '2026-10-15', status: 'paid', created_at: '2026-10-03T10:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000902', event_id: '00000000-0000-4000-8000-000000000401', invoice_number: 'INV-0002', kind: 'final', subtotal: 197000, discount: 10000, amount: 187000, due_date: '2026-11-14', status: 'sent', created_at: '2026-10-25T11:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000903', event_id: '00000000-0000-4000-8000-000000000402', invoice_number: 'INV-0003', kind: 'deposit', subtotal: 40000, discount: 0, amount: 40000, due_date: '2026-11-05', status: 'draft', created_at: '2026-10-20T16:00:00Z' }
];

const INITIAL_PAYMENTS: Payment[] = [
  {
    id: '00000000-0000-4000-8000-000000001001',
    invoice_id: '00000000-0000-4000-8000-000000000901',
    amount: 75000,
    method: 'Bank Transfer (NEFT)',
    payment_channel: 'bank',
    destination_account: 'Federal Bank (A/c 9876-5432-1000)',
    note: 'Advance booking bank transfer',
    paid_at: '2026-10-12T14:15:00Z'
  },
  {
    id: '00000000-0000-4000-8000-000000001002',
    invoice_id: '00000000-0000-4000-8000-000000000901',
    amount: 25000,
    method: 'Cash',
    payment_channel: 'cash',
    destination_account: 'Cash in Hand (Office Counter)',
    note: 'Cash advance received at office',
    paid_at: '2026-10-13T11:20:00Z'
  }
];

const INITIAL_STOCK_PURCHASES: StockPurchase[] = [
  {
    id: '00000000-0000-4000-8000-000000001101',
    purchase_date: '2026-10-22',
    vendor_name: 'Metro Wholesale Cash & Carry',
    vendor_location: 'Palayam, Kozhikode',
    vendor_phone: '+91 98470 11223',
    bill_number: 'MW-9821',
    items: [
      {
        id: '00000000-0000-4000-8000-000000001201',
        ingredient_id: '00000000-0000-4000-8000-000000000201',
        item_name: 'Kaima / Jeerakasala Biryani Rice',
        quantity: 150,
        unit: 'kg',
        unit_price: 90,
        total_price: 13500
      },
      {
        id: '00000000-0000-4000-8000-000000001202',
        ingredient_id: '00000000-0000-4000-8000-000000000204',
        item_name: 'Pure Milma Cow Ghee',
        quantity: 20,
        unit: 'kg',
        unit_price: 580,
        total_price: 11600
      }
    ],
    total_amount: 25100,
    paid_amount: 15000,
    balance_amount: 10100,
    payment_status: 'partially_paid',
    payment_method: 'UPI / GPay',
    notes: 'Advance payment made via GPay. Balance to be cleared next week.',
    created_at: '2026-10-22T09:30:00Z'
  },
  {
    id: '00000000-0000-4000-8000-000000001102',
    purchase_date: '2026-10-24',
    vendor_name: 'Kozhikode Central Meat Market',
    vendor_location: 'Central Meat Market, Calicut',
    vendor_phone: '+91 98950 44556',
    bill_number: 'KMM-409',
    items: [
      {
        id: '00000000-0000-4000-8000-000000001203',
        ingredient_id: '00000000-0000-4000-8000-000000000202',
        item_name: 'Fresh Tender Mutton',
        quantity: 50,
        unit: 'kg',
        unit_price: 780,
        total_price: 39000
      }
    ],
    total_amount: 39000,
    paid_amount: 39000,
    balance_amount: 0,
    payment_status: 'paid',
    payment_method: 'Bank Transfer (NEFT)',
    notes: 'Fully settled on delivery day.',
    created_at: '2026-10-24T07:15:00Z'
  },
  {
    id: '00000000-0000-4000-8000-000000001103',
    purchase_date: '2026-10-26',
    vendor_name: 'Malabar Spices & Condiments',
    vendor_location: 'Big Bazaar Road, Kozhikode',
    vendor_phone: '+91 94471 88990',
    bill_number: 'MS-1102',
    items: [
      {
        id: '00000000-0000-4000-8000-000000001204',
        ingredient_id: '00000000-0000-4000-8000-000000000206',
        item_name: 'Whole Biryani Garam Spices',
        quantity: 8,
        unit: 'kg',
        unit_price: 450,
        total_price: 3600
      },
      {
        id: '00000000-0000-4000-8000-000000001205',
        ingredient_id: '00000000-0000-4000-8000-000000000209',
        item_name: 'Cashew Nuts & Golden Raisins',
        quantity: 12,
        unit: 'kg',
        unit_price: 720,
        total_price: 8640
      }
    ],
    total_amount: 12240,
    paid_amount: 0,
    balance_amount: 12240,
    payment_status: 'unpaid',
    payment_method: 'Credit',
    notes: 'Credit purchase, payable before next month 1st week.',
    created_at: '2026-10-26T11:00:00Z'
  }
];

const INITIAL_STOCK_PURCHASE_PAYMENTS: StockPurchasePayment[] = [
  {
    id: '00000000-0000-4000-8000-000000001301',
    purchase_id: '00000000-0000-4000-8000-000000001101',
    amount: 15000,
    method: 'UPI / GPay',
    paid_at: '2026-10-22T10:00:00Z',
    note: 'Initial installment paid via GPay'
  },
  {
    id: '00000000-0000-4000-8000-000000001302',
    purchase_id: '00000000-0000-4000-8000-000000001102',
    amount: 39000,
    method: 'Bank Transfer (NEFT)',
    paid_at: '2026-10-24T08:00:00Z',
    note: 'Full settlement transfer Ref 98210344'
  }
];

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: '00000000-0000-4000-8000-000000009001',
    entity_type: 'quotation',
    entity_id: '00000000-0000-4000-8000-000000000505',
    parent_event_id: '00000000-0000-4000-8000-000000000402',
    action: 'update',
    summary: 'Edited quotation items on "Kerala Tech Summit Luncheon"',
    details: 'Added Malabar Chicken Roast & Kerala Parotta (₹320/guest)',
    actor_id: '00000000-0000-4000-8000-000000000002',
    actor_username: 'manager',
    actor_name: 'Aisha (Manager)',
    actor_role: 'manager',
    source: 'app',
    is_read_by_owner: false,
    created_at: '2026-10-27T16:40:00Z'
  },
  {
    id: '00000000-0000-4000-8000-000000009002',
    entity_type: 'event',
    entity_id: '00000000-0000-4000-8000-000000000401',
    parent_event_id: '00000000-0000-4000-8000-000000000401',
    action: 'update',
    summary: 'Updated event schedule & guest count on "Farhan & Nimra Grand Wedding Banquet"',
    details: 'Status: confirmed • 350 Guests • Raviz Kadavu Grand Lawn',
    actor_id: '00000000-0000-4000-8000-000000000002',
    actor_username: 'manager',
    actor_name: 'Aisha (Manager)',
    actor_role: 'manager',
    source: 'app',
    is_read_by_owner: false,
    created_at: '2026-10-27T14:15:00Z'
  },
  {
    id: '00000000-0000-4000-8000-000000009003',
    entity_type: 'invoice',
    entity_id: '00000000-0000-4000-8000-000000000902',
    parent_event_id: '00000000-0000-4000-8000-000000000401',
    action: 'create',
    summary: 'Generated Final Invoice INV-0002 (₹1,87,000)',
    details: 'Discount applied: ₹10,000 • Event: Farhan & Nimra Grand Wedding Banquet',
    actor_id: '00000000-0000-4000-8000-000000000003',
    actor_username: 'accountant',
    actor_name: 'Rahul (Accountant)',
    actor_role: 'accountant',
    source: 'app',
    is_read_by_owner: false,
    created_at: '2026-10-26T18:20:00Z'
  }
];

export interface AppState {
  _version?: number;
  settings: BusinessSettings;
  profiles: Profile[];
  currentRole: UserRole;
  currentUserId: string;
  isAuthenticated: boolean;
  clients: Client[];
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  recipes: MenuItemIngredient[];
  events: EventRecord[];
  eventItems: EventItem[];
  eventExtras: EventExtra[];
  staff: StaffMember[];
  shifts: Shift[];
  staffSalaryRecords: StaffSalaryRecord[];
  invoices: Invoice[];
  payments: Payment[];
  stockPurchases: StockPurchase[];
  stockPurchasePayments: StockPurchasePayment[];
  auditLogs: AuditLogEntry[];
}

const STORAGE_KEY = 'ippas_catering_manager_state';
const SESSION_KEY = 'ippas_catering_auth_session';
const PENDING_SQL_OPS_KEY = 'ippas_catering_pending_sql_ops';
const BOOTSTRAP_KEY = 'ippas_catering_sql_bootstrapped';

type SqlOperation =
  | {
      type: 'upsert';
      table: string;
      values: Record<string, any> | Record<string, any>[];
      onConflict?: string;
    }
  | {
      type: 'insert';
      table: string;
      values: Record<string, any> | Record<string, any>[];
    }
  | {
      type: 'update';
      table: string;
      values: Record<string, any>;
      match: Record<string, any>;
    }
  | {
      type: 'delete';
      table: string;
      match: Record<string, any>;
    }
  | {
      type: 'delete_all';
      table: string;
    };

interface PendingSqlBatch {
  id: string;
  label: string;
  operations: SqlOperation[];
}

class DataStore {
  private state: AppState;
  private listeners: Set<() => void> = new Set();
  private syncError: string | null = null;
  private isSyncingState: boolean = false;
  private isWritingState: boolean = false;
  private serverDbConfigured: boolean = false;
  private isInternetConnected: boolean = true;
  private hasInitialRemoteLoaded: boolean = false;
  private pendingSqlBatches: PendingSqlBatch[] = [];
  private writeChain: Promise<void> = Promise.resolve();
  private realtimeSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private realtimeChannel: any = null;
  private realtimeReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSilentSyncAt: number = 0;
  private recentLocalMutations: Map<string, number> = new Map();

  constructor() {
    this.state = this.loadInitial();
    if (typeof window !== 'undefined') {
      // Purge any legacy offline/local DB caches permanently
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PENDING_SQL_OPS_KEY);
        localStorage.removeItem(BOOTSTRAP_KEY);
      } catch {
        // ignore storage restrictions
      }

      this.isInternetConnected = typeof navigator === 'undefined' ? true : navigator.onLine;

      // Cross-tab auth session sync only (no local DB data)
      window.addEventListener('storage', (e) => {
        if (e.key === SESSION_KEY) {
          try {
            const session = e.newValue ? JSON.parse(e.newValue) : null;
            this.state.isAuthenticated = Boolean(session?.isAuthenticated);
            if (session?.currentRole) this.state.currentRole = session.currentRole;
            if (session?.currentUserId) this.state.currentUserId = session.currentUserId;
            this.notify();
          } catch {
            // ignore
          }
        }
      });

      // Immediately reconnect & sync from live Supabase when internet returns
      window.addEventListener('online', () => {
        this.autoConnectSupabaseWhenOnline();
      });

      // Immediately block all pages when internet disconnects
      window.addEventListener('offline', () => {
        this.isInternetConnected = false;
        this.isSyncingState = false;
        this.isWritingState = false;
        this.notify();
      });

      window.addEventListener('focus', () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          this.isInternetConnected = false;
          this.notify();
        } else {
          this.checkOnlineHeartbeat(true);
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            this.isInternetConnected = false;
            this.notify();
          } else {
            this.checkOnlineHeartbeat(true);
          }
        }
      });

      // Connect to Supabase immediately on every boot
      this.autoConnectSupabaseWhenOnline();

      // Continuous keep-alive heartbeat every 12 seconds so connection never drops silently
      this.keepAliveInterval = setInterval(() => {
        this.checkOnlineHeartbeat(false);
      }, 12000);

      onSupabaseConfigChange(async () => {
        this.serverDbConfigured = Boolean(isSupabaseConfigured);
        if (isSupabaseConfigured && supabase) {
          this.setupRealtimeSubscription(true);
          await this.syncFromSupabase(true);
        }
        this.notify();
      });
    }
  }

  public isOnline(): boolean {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    return this.isInternetConnected;
  }

  public isInitialSyncDone(): boolean {
    return this.hasInitialRemoteLoaded;
  }

  public isSqlConnected(): boolean {
    return this.isOnline() && Boolean(isSupabaseConfigured || this.serverDbConfigured);
  }

  public getLiveSupabaseConfig() {
    return getSupabaseConfig();
  }

  public async checkOnlineHeartbeat(syncDataToo: boolean = false): Promise<boolean> {
    if (typeof window === 'undefined') return true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (this.isInternetConnected) {
        this.isInternetConnected = false;
        this.notify();
      }
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/db?mode=ping', {
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        this.isInternetConnected = false;
        this.notify();
        return false;
      }

      const data = await res.json();
      if (!data?.configured || data?.online === false) {
        this.isInternetConnected = false;
        this.notify();
        return false;
      }

      const wasDisconnected = !this.isInternetConnected || !this.hasInitialRemoteLoaded;
      this.serverDbConfigured = true;
      this.isInternetConnected = true;

      if (!supabase || !isSupabaseConfigured) {
        await ensureSupabaseOnlineConnection();
      }
      this.setupRealtimeSubscription(false);

      if (wasDisconnected || syncDataToo) {
        await this.syncFromSupabase(true);
      } else {
        this.notify();
      }
      return true;
    } catch {
      this.isInternetConnected = false;
      this.notify();
      return false;
    }
  }

  public async connectLiveSupabase(url: string, anonKey: string): Promise<{ success: boolean; error?: string }> {
    const res = setLiveSupabaseCredentials(url, anonKey);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    try {
      await fetch('/api/db/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, anonKey })
      });
    } catch {
      return { success: false, error: 'Internet disconnected while saving Supabase configuration.' };
    }

    this.serverDbConfigured = true;
    this.isInternetConnected = true;
    this.setupRealtimeSubscription(true);
    await this.syncFromSupabase(false);
    this.notify();
    return { success: true };
  }

  public async disconnectLiveSupabase(): Promise<void> {
    clearLiveSupabaseCredentials();
    this.notify();
  }

  public async autoConnectSupabaseWhenOnline(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isInternetConnected = false;
      this.isSyncingState = false;
      this.isWritingState = false;
      this.notify();
      return;
    }

    try {
      // 1. Verify live server + Supabase reachability first
      const pingRes = await fetch('/api/db?mode=ping', { cache: 'no-store' });
      if (!pingRes.ok) {
        this.isInternetConnected = false;
        this.notify();
        return;
      }
      const pingData = await pingRes.json();
      if (!pingData?.configured || pingData?.online === false) {
        this.isInternetConnected = false;
        this.notify();
        return;
      }

      this.serverDbConfigured = true;
      this.isInternetConnected = true;

      // 2. Ensure browser Realtime Supabase client is initialized
      const client = await ensureSupabaseOnlineConnection();
      if (client) {
        this.serverDbConfigured = true;
      }

      // 3. Setup Realtime WebSocket and pull fresh data directly from online Supabase
      this.clearDbError();
      this.setupRealtimeSubscription(false);
      await this.syncFromSupabase(!this.hasInitialRemoteLoaded ? false : true);
    } catch (err: any) {
      console.warn('[Auto-Connect Supabase]', err);
      this.isInternetConnected = false;
    } finally {
      this.notify();
    }
  }

  private savePendingSqlBatches() {
    // Offline queue persistence disabled: app operates strictly online against Supabase
  }

  private extractMissingColumn(errMsg: string): string | null {
    const m1 = errMsg.match(/Could not find the '([^']+)' column/i);
    if (m1?.[1]) return m1[1];
    const m2 = errMsg.match(/column "([^"]+)" of relation/i);
    if (m2?.[1]) return m2[1];
    return null;
  }

  private stripColFromValues(
    values: Record<string, any> | Record<string, any>[],
    col: string
  ): Record<string, any> | Record<string, any>[] {
    if (Array.isArray(values)) {
      return values.map((r) => {
        const copy = { ...r };
        delete copy[col];
        return copy;
      });
    }
    const copy = { ...values };
    delete copy[col];
    return copy;
  }

  private async runClientSingleOperation(op: SqlOperation): Promise<{ error: any | null }> {
    if (!supabase) return { error: { message: 'Client Supabase not initialized' } };

    if (op.type === 'delete_all') {
      if (op.table === 'menu_item_ingredients') {
        const { error } = await supabase
          .from(op.table)
          .delete()
          .neq('menu_item_id', '00000000-0000-0000-0000-000000000000');
        return { error };
      }
      if (op.table === 'business_settings') {
        const { error } = await supabase.from(op.table).delete().neq('id', -1);
        return { error };
      }
      const { error } = await supabase
        .from(op.table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      return { error };
    }

    if (op.type === 'delete') {
      let q = supabase.from(op.table).delete();
      for (const [k, v] of Object.entries(op.match || {})) {
        q = q.eq(k, v);
      }
      const { error } = await q;
      if (error) {
        const msg = String(error.message || '');
        if (
          msg.includes('does not exist') ||
          msg.includes('Could not find the table') ||
          msg.includes('schema cache')
        ) {
          return { error: null };
        }
      }
      return { error };
    }

    if (op.type === 'update') {
      const currentValues = { ...op.values };
      for (let attempt = 0; attempt < 5; attempt++) {
        let q = supabase.from(op.table).update(currentValues);
        for (const [k, v] of Object.entries(op.match || {})) {
          q = q.eq(k, v);
        }
        const { error } = await q;
        if (!error) return { error: null };

        const missingCol = this.extractMissingColumn(String(error.message || ''));
        if (missingCol && missingCol in currentValues) {
          delete currentValues[missingCol];
          if (Object.keys(currentValues).length === 0) return { error: null };
          continue;
        }
        return { error };
      }
      return { error: null };
    }

    let currentValues = Array.isArray(op.values)
      ? op.values.map((r) => ({ ...r }))
      : { ...op.values };

    for (let attempt = 0; attempt < 6; attempt++) {
      const q =
        op.type === 'upsert'
          ? supabase.from(op.table).upsert(currentValues, {
              onConflict: op.onConflict || 'id'
            })
          : supabase.from(op.table).insert(currentValues);

      const { error } = await q;
      if (!error) return { error: null };

      const msg = String(error.message || '');
      const missingCol = this.extractMissingColumn(msg);
      if (missingCol) {
        currentValues = this.stripColFromValues(currentValues, missingCol);
        continue;
      }

      if (
        op.table === 'ingredients' &&
        !Array.isArray(currentValues) &&
        currentValues.name &&
        (msg.includes('ingredients_name_key') || error.code === '23505')
      ) {
        const upd = { ...currentValues };
        delete upd.id;
        const { error: nameErr } = await supabase
          .from('ingredients')
          .update(upd)
          .eq('name', currentValues.name);
        if (!nameErr) return { error: null };
      }

      if (
        op.table === 'profiles' &&
        !Array.isArray(currentValues) &&
        currentValues.username &&
        (msg.includes('profiles_username_key') || error.code === '23505')
      ) {
        const upd = { ...currentValues };
        delete upd.id;
        const { error: userErr } = await supabase
          .from('profiles')
          .update(upd)
          .eq('username', currentValues.username);
        if (!userErr) return { error: null };
      }

      if (
        op.table === 'invoices' &&
        !Array.isArray(currentValues) &&
        currentValues.invoice_number &&
        (msg.includes('invoices_invoice_number_key') || error.code === '23505')
      ) {
        const suffix = String(Date.now()).slice(-4);
        currentValues = {
          ...currentValues,
          invoice_number: `${currentValues.invoice_number}-${suffix}`
        };
        continue;
      }

      return { error };
    }

    return { error: null };
  }

  private async sendBatchViaServerApi(operations: SqlOperation[]): Promise<{
    configured: boolean;
    success: boolean;
    error?: string;
    networkFailed?: boolean;
  }> {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations })
      });
      const data = await res.json();
      if (data?.configured) {
        this.serverDbConfigured = true;
      }
      return {
        configured: Boolean(data?.configured),
        success: Boolean(data?.success),
        error: data?.error
      };
    } catch (err: any) {
      return {
        configured: this.serverDbConfigured,
        success: false,
        networkFailed: true,
        error: err?.message || 'Network error while updating SQL database'
      };
    }
  }

  private isTransientNetworkError(err: any): boolean {
    const msg = String(err?.message || err || '').toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('load failed') ||
      msg.includes('timeout')
    );
  }

  public flushPendingSqlWrites(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      if (this.pendingSqlBatches.length === 0) return;

      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
        this.pendingSqlBatches = [];
        this.isInternetConnected = false;
        this.isWritingState = false;
        this.notify();
        return;
      }

      this.isWritingState = true;

      while (this.pendingSqlBatches.length > 0) {
        const batch = this.pendingSqlBatches[0];
        let succeeded = false;
        let lastError: any = null;
        let transientFailure = false;

        // Primary write path: Server /api/db (uses SUPABASE_SERVICE_ROLE_KEY directly against online Supabase)
        const serverRes = await this.sendBatchViaServerApi(batch.operations);
        if (serverRes.success) {
          succeeded = true;
          this.isInternetConnected = true;
        } else if (serverRes.networkFailed) {
          transientFailure = true;
          lastError = { message: serverRes.error };
        } else if (isSupabaseConfigured && supabase) {
          // Secondary fallback via live browser Supabase client
          let clientFailed = false;
          for (const op of batch.operations) {
            const { error } = await this.runClientSingleOperation(op);
            if (error) {
              clientFailed = true;
              lastError = error;
              if (this.isTransientNetworkError(error)) {
                transientFailure = true;
              }
              break;
            }
          }
          if (!clientFailed) {
            succeeded = true;
          }
        } else {
          lastError = { message: serverRes.error };
        }

        if (succeeded) {
          this.pendingSqlBatches.shift();
          this.clearDbError();
        } else if (transientFailure) {
          // Immediately transition to Internet Disconnected state; do not queue offline edits
          this.pendingSqlBatches = [];
          this.isInternetConnected = false;
          this.notify();
          break;
        } else {
          this.pendingSqlBatches.shift();
          this.reportDbError(batch.label, lastError);
        }
      }

      this.isWritingState = false;
    });

    return this.writeChain;
  }

  private enqueueSqlOperations(label: string, operations: SqlOperation[]) {
    if (!operations || operations.length === 0) return;
    if (!this.isOnline()) {
      this.isInternetConnected = false;
      this.notify();
      return;
    }
    this.pendingSqlBatches.push({
      id: generateUUID(),
      label,
      operations
    });
    this.flushPendingSqlWrites();
  }

  // Row Serializers & Automatic Parent-FK Guarantees so edits NEVER fail due to missing parent rows
  private toClientSqlRow(c: Client) {
    return {
      id: c.id,
      name: c.name,
      email: c.email || null,
      phone: c.phone || null,
      company: c.company || null,
      notes: c.notes || null,
      created_at: c.created_at || new Date().toISOString()
    };
  }

  private toEventSqlRow(e: EventRecord) {
    return {
      id: e.id,
      client_id: e.client_id,
      title: e.title,
      event_date: e.event_date,
      start_time: e.start_time || null,
      end_time: e.end_time || null,
      venue: e.venue || null,
      guest_count: Math.max(1, Math.round(Number(e.guest_count) || 1)),
      status: e.status,
      notes: e.notes || null,
      created_at: e.created_at || new Date().toISOString()
    };
  }

  private toIngredientSqlRow(i: Ingredient) {
    return {
      id: i.id,
      name: i.name,
      unit: i.unit || 'kg',
      cost_per_unit: Number(i.cost_per_unit || 0),
      stock_qty: Number(i.stock_qty || 0),
      low_stock_level: Number(i.low_stock_level || 0)
    };
  }

  private toMenuItemSqlRow(m: MenuItem) {
    const unitPrice = Number(m.price_per_unit ?? m.price_per_guest ?? 0);
    return {
      id: m.id,
      name: m.name,
      description: m.description || null,
      category: m.category || 'Main',
      pricing_type: m.pricing_type || 'per_guest',
      price_per_unit: unitPrice,
      price_per_guest: unitPrice,
      active: m.active !== false
    };
  }

  private toStaffSqlRow(s: StaffMember) {
    return {
      id: s.id,
      name: s.name,
      phone: s.phone || null,
      password: s.password || 'password123',
      role_title: s.role_title || null,
      hourly_rate: Number(s.hourly_rate || 0),
      active: s.active !== false
    };
  }

  private toInvoiceSqlRow(inv: Invoice) {
    return {
      id: inv.id,
      event_id: inv.event_id,
      invoice_number: inv.invoice_number,
      kind: inv.kind,
      subtotal: Number(inv.subtotal ?? inv.amount ?? 0),
      discount: Number(inv.discount || 0),
      amount: Number(inv.amount || 0),
      due_date: inv.due_date || null,
      status: inv.status,
      notes: inv.notes || null,
      created_at: inv.created_at || new Date().toISOString()
    };
  }

  private toStockPurchaseSqlRow(sp: StockPurchase) {
    return {
      id: sp.id,
      purchase_date: sp.purchase_date,
      vendor_name: sp.vendor_name,
      vendor_location: sp.vendor_location || null,
      vendor_phone: sp.vendor_phone || null,
      bill_number: sp.bill_number || null,
      total_amount: Number(sp.total_amount || 0),
      paid_amount: Number(sp.paid_amount || 0),
      balance_amount: Number(sp.balance_amount || 0),
      payment_status: sp.payment_status,
      payment_method: sp.payment_method || 'Cash',
      notes: sp.notes || null,
      created_at: sp.created_at || new Date().toISOString()
    };
  }

  private ensureClientParentOps(clientId?: string): SqlOperation[] {
    if (!clientId || !isValidUUID(clientId)) return [];
    const client = this.state.clients.find((c) => c.id === clientId);
    if (!client) return [];
    return [{ type: 'upsert', table: 'clients', values: this.toClientSqlRow(client), onConflict: 'id' }];
  }

  private ensureEventParentOps(eventId?: string): SqlOperation[] {
    if (!eventId || !isValidUUID(eventId)) return [];
    const evt = this.state.events.find((e) => e.id === eventId);
    if (!evt || !isValidUUID(evt.client_id)) return [];
    return [
      ...this.ensureClientParentOps(evt.client_id),
      { type: 'upsert', table: 'events', values: this.toEventSqlRow(evt), onConflict: 'id' }
    ];
  }

  private ensureMenuItemParentOps(menuItemId?: string): SqlOperation[] {
    if (!menuItemId || !isValidUUID(menuItemId)) return [];
    const mi = this.state.menuItems.find((m) => m.id === menuItemId);
    if (!mi) return [];
    return [{ type: 'upsert', table: 'menu_items', values: this.toMenuItemSqlRow(mi), onConflict: 'id' }];
  }

  private ensureIngredientParentOps(ingredientId?: string): SqlOperation[] {
    if (!ingredientId || !isValidUUID(ingredientId)) return [];
    const ing = this.state.ingredients.find((i) => i.id === ingredientId);
    if (!ing) return [];
    return [{ type: 'upsert', table: 'ingredients', values: this.toIngredientSqlRow(ing), onConflict: 'id' }];
  }

  private ensureStaffParentOps(staffId?: string): SqlOperation[] {
    if (!staffId || !isValidUUID(staffId)) return [];
    const st = this.state.staff.find((s) => s.id === staffId);
    if (!st) return [];
    return [{ type: 'upsert', table: 'staff_members', values: this.toStaffSqlRow(st), onConflict: 'id' }];
  }

  private ensureInvoiceParentOps(invoiceId?: string): SqlOperation[] {
    if (!invoiceId || !isValidUUID(invoiceId)) return [];
    const inv = this.state.invoices.find((i) => i.id === invoiceId);
    if (!inv || !isValidUUID(inv.event_id)) return [];
    return [
      ...this.ensureEventParentOps(inv.event_id),
      { type: 'upsert', table: 'invoices', values: this.toInvoiceSqlRow(inv), onConflict: 'id' }
    ];
  }

  private ensurePurchaseParentOps(purchaseId?: string): SqlOperation[] {
    if (!purchaseId || !isValidUUID(purchaseId)) return [];
    const sp = (this.state.stockPurchases || []).find((p) => p.id === purchaseId);
    if (!sp) return [];
    return [{ type: 'upsert', table: 'stock_purchases', values: this.toStockPurchaseSqlRow(sp), onConflict: 'id' }];
  }

  // Local DB push is permanently disabled; all reads/writes happen directly on online Supabase
  public async pushAllToSupabase(): Promise<{ success: boolean; error?: string }> {
    await this.syncFromSupabase(false);
    if (this.syncError) {
      return { success: false, error: this.syncError };
    }
    return { success: true };
  }

  private setupRealtimeSubscription(forceRecreate: boolean = false) {
    if (!isSupabaseConfigured || !supabase || !this.isOnline()) return;
    if (this.realtimeChannel && !forceRecreate) return;

    try {
      if (this.realtimeChannel) {
        try {
          supabase.removeChannel(this.realtimeChannel);
        } catch {
          // ignore
        }
        this.realtimeChannel = null;
      }

      this.realtimeChannel = supabase
        .channel('ippas-live-realtime-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          (payload: any) => {
            this.scheduleSilentSync(250);
            this.inspectRealtimeDatabasePayload(payload);
          }
        )
        .subscribe((status: string) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            this.realtimeChannel = null;
            if (this.realtimeReconnectTimer) {
              clearTimeout(this.realtimeReconnectTimer);
            }
            this.realtimeReconnectTimer = setTimeout(() => {
              if (this.isOnline()) {
                this.setupRealtimeSubscription(true);
              }
            }, 3000);
          }
        });
    } catch (err) {
      console.warn('Realtime subscription warning:', err);
    }
  }

  private mapTableToEntityType(tableName: string): AuditEntityType {
    switch (tableName) {
      case 'events':
        return 'event';
      case 'event_items':
      case 'event_extras':
        return 'quotation';
      case 'invoices':
        return 'invoice';
      case 'payments':
        return 'payment';
      case 'clients':
        return 'client';
      case 'menu_items':
        return 'menu';
      case 'menu_item_ingredients':
        return 'recipe';
      case 'ingredients':
        return 'stock';
      case 'stock_purchases':
      case 'stock_purchase_items':
      case 'stock_purchase_payments':
        return 'purchase';
      case 'staff_members':
        return 'staff';
      case 'shifts':
        return 'shift';
      case 'staff_salary_records':
        return 'salary';
      case 'business_settings':
        return 'settings';
      case 'profiles':
        return 'user';
      default:
        return 'database';
    }
  }

  // Fallback detector for direct Supabase DB edits even if SQL triggers in migration_07.sql haven't been installed yet
  private inspectRealtimeDatabasePayload(payload: any) {
    if (!payload || !payload.table || payload.table === 'activity_logs') return;
    const tableName = String(payload.table);
    const eventType = String(payload.eventType || 'UPDATE').toUpperCase();
    const rowData = (eventType === 'DELETE' ? payload.old : payload.new) || payload.new || payload.old || {};
    const entityId = String(
      rowData.id || rowData.menu_item_id || rowData.purchase_id || rowData.event_id || tableName
    );
    const parentEventId =
      tableName === 'events' ? entityId : rowData.event_id ? String(rowData.event_id) : undefined;

    // Give syncFromSupabase 1400ms to pull any matching 'app' or trigger 'database' log first
    setTimeout(() => {
      const now = Date.now();
      const localStamp = this.recentLocalMutations.get(entityId) || (parentEventId ? this.recentLocalMutations.get(parentEventId) : 0) || 0;
      if (now - localStamp < 15000) return;

      const entityType = this.mapTableToEntityType(tableName);
      const alreadyLogged = (this.state.auditLogs || []).some((log) => {
        const logTime = new Date(log.created_at).getTime();
        if (isNaN(logTime) || Math.abs(now - logTime) > 16000) return false;
        return (
          log.entity_id === entityId ||
          (parentEventId && log.parent_event_id === parentEventId && log.entity_type === entityType)
        );
      });

      if (alreadyLogged) return;

      const label =
        rowData.title ||
        rowData.name ||
        rowData.invoice_number ||
        rowData.vendor_name ||
        rowData.description ||
        rowData.full_name ||
        entityId;

      const action: AuditAction =
        eventType === 'INSERT' ? 'create' : eventType === 'DELETE' ? 'delete' : 'update';

      const dbAlert: AuditLogEntry = {
        id: generateUUID(),
        entity_type: entityType,
        entity_id: entityId,
        parent_event_id: parentEventId,
        action,
        summary: `Direct Database ${eventType} on ${tableName} (${label})`,
        details: `Detected live database modification on table "${tableName}"`,
        actor_username: 'supabase_db',
        actor_name: 'Direct Database Change',
        actor_role: 'database',
        source: 'database',
        is_read_by_owner: false,
        created_at: new Date().toISOString()
      };

      this.state.auditLogs = this.deduplicateAuditLogs([dbAlert, ...(this.state.auditLogs || [])]);
      this.save();

      this.enqueueSqlOperations('Log Database Activity', [
        {
          type: 'upsert',
          table: 'activity_logs',
          values: {
            id: dbAlert.id,
            entity_type: dbAlert.entity_type,
            entity_id: dbAlert.entity_id,
            parent_event_id: dbAlert.parent_event_id || null,
            action: dbAlert.action,
            summary: dbAlert.summary,
            details: dbAlert.details || null,
            actor_username: dbAlert.actor_username,
            actor_name: dbAlert.actor_name,
            actor_role: dbAlert.actor_role,
            source: dbAlert.source,
            is_read_by_owner: false,
            created_at: dbAlert.created_at
          },
          onConflict: 'id'
        }
      ]);
    }, 1400);
  }

  private deduplicateAuditLogs(logs: AuditLogEntry[]): AuditLogEntry[] {
    const byId = new Map<string, AuditLogEntry>();
    for (const item of logs) {
      if (item && item.id && !byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
    const sorted = Array.from(byId.values()).sort((a, b) =>
      (b.created_at || '').localeCompare(a.created_at || '')
    );

    const appLogs = sorted.filter((l) => l.source === 'app');
    const filtered = sorted.filter((log) => {
      if (log.source !== 'database') return true;
      const logMs = new Date(log.created_at).getTime();
      const hasMatchingAppLog = appLogs.some((appLog) => {
        const appMs = new Date(appLog.created_at).getTime();
        if (isNaN(logMs) || isNaN(appMs) || Math.abs(appMs - logMs) > 16000) return false;
        return (
          appLog.entity_id === log.entity_id ||
          (log.parent_event_id &&
            appLog.parent_event_id === log.parent_event_id &&
            appLog.entity_type === log.entity_type)
        );
      });
      return !hasMatchingAppLog;
    });

    return filtered.slice(0, 500);
  }

  private logMutation(params: {
    entity_type: AuditEntityType;
    entity_id: string;
    parent_event_id?: string;
    action: AuditAction;
    summary: string;
    details?: string;
  }): AuditLogEntry {
    const actor = this.getCurrentUser();
    const role = this.state.currentRole || 'owner';
    const actorUsername = actor?.username || role;
    const actorName = actor?.full_name || role.toUpperCase();
    const nowIso = new Date().toISOString();

    this.recentLocalMutations.set(params.entity_id, Date.now());
    if (params.parent_event_id) {
      this.recentLocalMutations.set(params.parent_event_id, Date.now());
    }

    const entry: AuditLogEntry = {
      id: generateUUID(),
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      parent_event_id: params.parent_event_id,
      action: params.action,
      summary: params.summary,
      details: params.details,
      actor_id: actor?.id,
      actor_username: actorUsername,
      actor_name: actorName,
      actor_role: role,
      source: 'app',
      is_read_by_owner: role === 'owner' || role === 'super_admin',
      created_at: nowIso
    };

    this.state.auditLogs = this.deduplicateAuditLogs([entry, ...(this.state.auditLogs || [])]);

    this.enqueueSqlOperations('Record Audit Log', [
      {
        type: 'upsert',
        table: 'activity_logs',
        values: {
          id: entry.id,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          parent_event_id: entry.parent_event_id || null,
          action: entry.action,
          summary: entry.summary,
          details: entry.details || null,
          actor_id: entry.actor_id || null,
          actor_username: entry.actor_username,
          actor_name: entry.actor_name,
          actor_role: entry.actor_role,
          source: 'app',
          is_read_by_owner: entry.is_read_by_owner,
          created_at: entry.created_at
        },
        onConflict: 'id'
      }
    ]);

    return entry;
  }

  public getEntityAudit(
    entityId: string,
    entityTypes?: AuditEntityType[]
  ): AuditLogEntry | undefined {
    if (!entityId) return undefined;
    const isSuperAdmin = this.state.currentRole === 'super_admin';
    const logs = this.state.auditLogs || [];
    return logs.find((l) => {
      // Super admin activities are completely hidden from owner & other users
      if (!isSuperAdmin && l.actor_role === 'super_admin') {
        return false;
      }
      if (entityTypes && entityTypes.length > 0 && !entityTypes.includes(l.entity_type)) {
        return false;
      }
      return l.entity_id === entityId;
    });
  }

  public getEventAuditSummary(eventId: string): {
    eventAudit?: AuditLogEntry;
    quoteAudit?: AuditLogEntry;
    latestAudit?: AuditLogEntry;
    history: AuditLogEntry[];
  } {
    const isSuperAdmin = this.state.currentRole === 'super_admin';
    const allLogs = this.state.auditLogs || [];
    // Strict stealth: Owner and others never see super_admin logs in audit summary
    const logs = isSuperAdmin ? allLogs : allLogs.filter((l) => l.actor_role !== 'super_admin');
    const history = logs.filter(
      (l) => l.entity_id === eventId || l.parent_event_id === eventId
    );
    const eventAudit = history.find((l) => l.entity_type === 'event');
    const quoteAudit = history.find((l) => l.entity_type === 'quotation');
    const latestAudit = history[0];
    return { eventAudit, quoteAudit, latestAudit, history };
  }

  public getUnreadOwnerAlerts(): AuditLogEntry[] {
    // Super admin actions are strictly hidden from owner alerts
    return (this.state.auditLogs || []).filter(
      (l) => !l.is_read_by_owner && l.actor_role !== 'owner' && l.actor_role !== 'super_admin'
    );
  }

  public markAuditLogRead(logId: string) {
    this.state.auditLogs = (this.state.auditLogs || []).map((l) =>
      l.id === logId ? { ...l, is_read_by_owner: true } : l
    );
    this.save();

    if (isValidUUID(logId)) {
      this.enqueueSqlOperations('Mark Audit Log Read', [
        {
          type: 'update',
          table: 'activity_logs',
          values: { is_read_by_owner: true },
          match: { id: logId }
        }
      ]);
    }
  }

  public markAllAuditLogsRead() {
    const unreadIds = (this.state.auditLogs || [])
      .filter((l) => !l.is_read_by_owner)
      .map((l) => l.id);

    if (unreadIds.length === 0) return;

    this.state.auditLogs = (this.state.auditLogs || []).map((l) => ({
      ...l,
      is_read_by_owner: true
    }));
    this.save();

    this.enqueueSqlOperations('Mark All Audit Logs Read', [
      {
        type: 'update',
        table: 'activity_logs',
        values: { is_read_by_owner: true },
        match: { is_read_by_owner: false }
      }
    ]);
  }

  private scheduleSilentSync(delayMs: number = 250) {
    if (!this.isSqlConnected()) return;
    if (this.realtimeSyncTimer) {
      clearTimeout(this.realtimeSyncTimer);
    }
    this.realtimeSyncTimer = setTimeout(() => {
      this.syncFromSupabase(true);
    }, delayMs);
  }

  public refreshOnNavigation() {
    // Emit fresh state reference immediately for instant UI responsiveness across pages
    this.notify();
    if (this.isSqlConnected()) {
      const now = Date.now();
      if (now - this.lastSilentSyncAt > 1200) {
        this.lastSilentSyncAt = now;
        this.syncFromSupabase(true);
      }
    }
  }

  public getSyncStatus(): {
    isSyncing: boolean;
    isWriting: boolean;
    pendingCount: number;
    isConnected: boolean;
    error: string | null;
  } {
    return {
      isSyncing: this.isSyncingState,
      isWriting: this.isWritingState,
      pendingCount: this.pendingSqlBatches.length,
      isConnected: this.isSqlConnected(),
      error: this.syncError
    };
  }

  private reportDbError(context: string, err: any) {
    if (!err) return;
    const msg = err.message || String(err);
    console.error(`[Supabase ${context}]`, err);
    this.syncError = `${context}: ${msg}`;
    this.notify();
  }

  private clearDbError() {
    if (this.syncError) {
      this.syncError = null;
    }
  }

  // Always clone state & arrays before notifying so React useState always detects changes immediately on the spot
  private notify() {
    this.state = {
      ...this.state,
      _version: (this.state._version || 0) + 1,
      settings: { ...this.state.settings },
      profiles: [...this.state.profiles],
      clients: [...this.state.clients],
      ingredients: [...this.state.ingredients],
      menuItems: [...this.state.menuItems],
      recipes: [...this.state.recipes],
      events: [...this.state.events],
      eventItems: [...this.state.eventItems],
      eventExtras: [...this.state.eventExtras],
      staff: [...this.state.staff],
      shifts: [...this.state.shifts],
      staffSalaryRecords: [...(this.state.staffSalaryRecords || [])],
      invoices: [...this.state.invoices],
      payments: [...this.state.payments],
      stockPurchases: [...(this.state.stockPurchases || [])],
      stockPurchasePayments: [...(this.state.stockPurchasePayments || [])],
      auditLogs: [...(this.state.auditLogs || [])]
    };
    this.listeners.forEach((cb) => cb());
  }

  private saveSession() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            currentRole: this.state.currentRole,
            currentUserId: this.state.currentUserId,
            isAuthenticated: this.state.isAuthenticated
          })
        );
      } catch (e) {
        console.warn('Could not save auth session', e);
      }
    }
  }

  public async syncFromSupabase(silent: boolean = false): Promise<void> {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isInternetConnected = false;
      this.isSyncingState = false;
      this.notify();
      return;
    }

    if (!silent) {
      this.isSyncingState = true;
      this.notify();
    }

    try {
      await this.flushPendingSqlWrites();

      let settingsRes: any;
      let profilesRes: any;
      let clientsRes: any;
      let ingredientsRes: any;
      let menuItemsRes: any;
      let recipesRes: any;
      let eventsRes: any;
      let eventItemsRes: any;
      let eventExtrasRes: any;
      let staffRes: any;
      let shiftsRes: any;
      let salaryRecordsRes: any;
      let invoicesRes: any;
      let paymentsRes: any;
      let purchasesRes: any;
      let purchaseItemsRes: any;
      let purchasePaymentsRes: any;
      let activityLogsRes: any;

      // Primary live read via server /api/db (uses SUPABASE_SERVICE_ROLE_KEY with no-store)
      const apiRes = await fetch('/api/db', { cache: 'no-store' });
      const apiJson = await apiRes.json();

      if (!apiRes.ok && apiJson?.online === false) {
        this.isInternetConnected = false;
        this.isSyncingState = false;
        this.notify();
        return;
      }

      if (apiJson?.configured && apiJson?.results) {
        this.serverDbConfigured = true;
        this.isInternetConnected = true;
        ({
          settingsRes,
          profilesRes,
          clientsRes,
          ingredientsRes,
          menuItemsRes,
          recipesRes,
          eventsRes,
          eventItemsRes,
          eventExtrasRes,
          staffRes,
          shiftsRes,
          salaryRecordsRes,
          invoicesRes,
          paymentsRes,
          purchasesRes,
          purchaseItemsRes,
          purchasePaymentsRes,
          activityLogsRes
        } = apiJson.results);
      } else if (isSupabaseConfigured && supabase) {
        [
          settingsRes,
          profilesRes,
          clientsRes,
          ingredientsRes,
          menuItemsRes,
          recipesRes,
          eventsRes,
          eventItemsRes,
          eventExtrasRes,
          staffRes,
          shiftsRes,
          salaryRecordsRes,
          invoicesRes,
          paymentsRes,
          purchasesRes,
          purchaseItemsRes,
          purchasePaymentsRes,
          activityLogsRes
        ] = await Promise.all([
          supabase.from('business_settings').select('*').eq('id', 1).maybeSingle(),
          supabase.from('profiles').select('*'),
          supabase.from('clients').select('*').order('created_at', { ascending: false }),
          supabase.from('ingredients').select('*').order('name', { ascending: true }),
          supabase.from('menu_items').select('*').order('name', { ascending: true }),
          supabase.from('menu_item_ingredients').select('*'),
          supabase.from('events').select('*').order('event_date', { ascending: true }),
          supabase.from('event_items').select('*'),
          supabase.from('event_extras').select('*'),
          supabase.from('staff_members').select('*').order('name', { ascending: true }),
          supabase.from('shifts').select('*'),
          supabase.from('staff_salary_records').select('*').order('recorded_at', { ascending: false }),
          supabase.from('invoices').select('*').order('created_at', { ascending: false }),
          supabase.from('payments').select('*').order('paid_at', { ascending: false }),
          supabase.from('stock_purchases').select('*').order('created_at', { ascending: false }),
          supabase.from('stock_purchase_items').select('*'),
          supabase.from('stock_purchase_payments').select('*').order('paid_at', { ascending: false }),
          supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(400)
        ]);
        this.isInternetConnected = true;
      } else {
        this.isInternetConnected = false;
        this.isSyncingState = false;
        this.notify();
        return;
      }

      const firstCriticalErr =
        clientsRes?.error ||
        eventsRes?.error ||
        menuItemsRes?.error ||
        ingredientsRes?.error ||
        invoicesRes?.error;

      if (firstCriticalErr) {
        if (this.isTransientNetworkError(firstCriticalErr)) {
          this.isInternetConnected = false;
          this.isSyncingState = false;
          this.notify();
          return;
        }
        this.reportDbError('Database Read Error (Run schema.sql in Supabase)', firstCriticalErr);
        this.hasInitialRemoteLoaded = true;
        this.isSyncingState = false;
        this.notify();
        return;
      }

      if (purchasesRes?.error) {
        this.reportDbError('Stock Purchases Table Missing (Run schema.sql in Supabase)', purchasesRes.error);
      } else {
        this.clearDbError();
      }

      // Seed default login profiles ONLY if Supabase profiles table has zero management accounts
      let rawProfiles = profilesRes?.data || [];
      let usableProfiles = rawProfiles.filter(
        (p: any) => p.role === 'super_admin' || p.role === 'owner' || p.role === 'manager' || p.role === 'accountant'
      );

      if (!profilesRes?.error && usableProfiles.length === 0) {
        this.enqueueSqlOperations('Seed Default Login Profiles', [
          {
            type: 'upsert',
            table: 'profiles',
            values: INITIAL_PROFILES.map((p) => ({
              id: p.id,
              username: p.username,
              password: p.password,
              full_name: p.full_name,
              role: p.role,
              phone: p.phone || null
            })),
            onConflict: 'id'
          }
        ]);
        usableProfiles = INITIAL_PROFILES;
      }

      if (!settingsRes?.error && !settingsRes?.data) {
        this.enqueueSqlOperations('Seed Business Settings', [
          {
            type: 'upsert',
            table: 'business_settings',
            values: INITIAL_SETTINGS,
            onConflict: 'id'
          }
        ]);
      }

      let loadedProfiles: Profile[] = usableProfiles.map((p: any) => {
        const fallbackRole = (p.role as UserRole) || 'manager';
        return {
          id: p.id,
          username: p.username || fallbackRole,
          password: p.password || `${fallbackRole}123`,
          full_name: p.full_name || fallbackRole,
          phone: p.phone || '',
          role: fallbackRole,
          role_title: p.role_title || undefined,
          hourly_rate: p.hourly_rate != null ? Number(p.hourly_rate) : undefined
        };
      });

      if (!loadedProfiles.some((p) => p.role === 'super_admin')) {
        loadedProfiles = [INITIAL_PROFILES[0], ...loadedProfiles];
      }

      const purchaseItemsData = purchaseItemsRes?.data || [];
      const loadedPurchases: StockPurchase[] = !purchasesRes?.error
        ? (purchasesRes?.data || []).map((sp: any) => {
            const itemsForPurchase: StockPurchaseItem[] = purchaseItemsData
              .filter((it: any) => it.purchase_id === sp.id)
              .map((it: any) => ({
                id: it.id,
                ingredient_id: it.ingredient_id || '',
                item_name: it.item_name,
                quantity: Number(it.quantity || 0),
                unit: it.unit || 'kg',
                unit_price: Number(it.unit_price || 0),
                total_price: Number(it.total_price || 0)
              }));

            return {
              id: sp.id,
              purchase_date: sp.purchase_date,
              vendor_name: sp.vendor_name,
              vendor_location: sp.vendor_location || '',
              vendor_phone: sp.vendor_phone || '',
              bill_number: sp.bill_number || '',
              items: itemsForPurchase,
              total_amount: Number(sp.total_amount || 0),
              paid_amount: Number(sp.paid_amount || 0),
              balance_amount: Number(sp.balance_amount || 0),
              payment_status: (sp.payment_status as StockPaymentStatus) || 'unpaid',
              payment_method: sp.payment_method || 'Cash',
              notes: sp.notes || '',
              created_at: sp.created_at || new Date().toISOString()
            };
          })
        : [];

      const loadedPurchasePayments: StockPurchasePayment[] = !purchasePaymentsRes?.error
        ? (purchasePaymentsRes?.data || []).map((spp: any) => ({
            id: spp.id,
            purchase_id: spp.purchase_id,
            amount: Number(spp.amount || 0),
            paid_at: spp.paid_at,
            method: spp.method || 'Cash',
            note: spp.note || ''
          }))
        : [];

      const loadedStaff: StaffMember[] = (staffRes?.data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        phone: s.phone || '',
        password: s.password || 'password123',
        role_title: s.role_title || 'Service Crew',
        hourly_rate: Number(s.hourly_rate || 0),
        active: s.active !== false
      }));

      this.state = {
        ...this.state,
        settings: settingsRes?.data
          ? { ...INITIAL_SETTINGS, ...settingsRes.data }
          : INITIAL_SETTINGS,
        profiles: loadedProfiles,
        clients: (clientsRes?.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email || '',
          phone: c.phone || '',
          company: c.company || '',
          notes: c.notes || '',
          created_at: c.created_at || new Date().toISOString()
        })),
        ingredients: (ingredientsRes?.data || []).map((i: any) => ({
          id: i.id,
          name: i.name,
          unit: i.unit || 'kg',
          cost_per_unit: Number(i.cost_per_unit || 0),
          stock_qty: Number(i.stock_qty || 0),
          low_stock_level: Number(i.low_stock_level || 0)
        })),
        menuItems: (menuItemsRes?.data || []).map((m: any) => {
          const unitPrice = Number(m.price_per_unit ?? m.price_per_guest ?? 0);
          return {
            id: m.id,
            name: m.name,
            description: m.description || '',
            category: m.category || 'Main',
            pricing_type: (m.pricing_type as PricingType) || 'per_guest',
            price_per_unit: unitPrice,
            price_per_guest: Number(m.price_per_guest ?? unitPrice),
            active: m.active !== false
          };
        }),
        recipes: (recipesRes?.data || []).map((r: any) => ({
          menu_item_id: r.menu_item_id,
          ingredient_id: r.ingredient_id,
          qty_per_guest: Number(r.qty_per_guest || 0)
        })),
        events: (eventsRes?.data || []).map((e: any) => ({
          id: e.id,
          client_id: e.client_id,
          title: e.title,
          event_date: e.event_date,
          start_time: e.start_time ? String(e.start_time).slice(0, 5) : '',
          end_time: e.end_time ? String(e.end_time).slice(0, 5) : '',
          venue: e.venue || '',
          guest_count: Number(e.guest_count || 1),
          status: e.status || 'inquiry',
          notes: e.notes || '',
          payment_terms: e.payment_terms || undefined,
          created_at: e.created_at || new Date().toISOString()
        })),
        eventItems: (eventItemsRes?.data || []).map((ei: any) => {
          const unitPrice = Number(ei.price_per_unit ?? ei.price_per_guest ?? 0);
          return {
            id: ei.id,
            event_id: ei.event_id,
            menu_item_id: ei.menu_item_id,
            pricing_type: (ei.pricing_type as PricingType) || 'per_guest',
            price_per_unit: unitPrice,
            price_per_guest: Number(ei.price_per_guest ?? unitPrice),
            quantity: ei.quantity != null ? Number(ei.quantity) : undefined
          };
        }),
        eventExtras: (eventExtrasRes?.data || []).map((x: any) => ({
          id: x.id,
          event_id: x.event_id,
          description: x.description,
          amount: Number(x.amount || 0)
        })),
        staff: loadedStaff,
        shifts: (shiftsRes?.data || [])
          .filter((sh: any) => sh.staff_member_id || sh.staff_id)
          .map((sh: any) => ({
            id: sh.id,
            event_id: sh.event_id,
            staff_member_id: sh.staff_member_id || sh.staff_id,
            role_label: sh.role_label || '',
            starts_at: sh.starts_at,
            ends_at: sh.ends_at,
            attendance_status:
              sh.attendance_status === 'present' || sh.attendance_status === 'absent'
                ? sh.attendance_status
                : 'pending',
            attendance_marked_at: sh.attendance_marked_at || undefined
          })),
        staffSalaryRecords: !salaryRecordsRes?.error
          ? (salaryRecordsRes?.data || []).map((sr: any) => ({
              id: sr.id,
              staff_member_id: sr.staff_member_id,
              event_id: sr.event_id || undefined,
              record_type: (sr.record_type === 'earning' ? 'earning' : 'payment') as StaffSalaryRecordType,
              amount: Number(sr.amount || 0),
              method: sr.method || 'Cash',
              note: sr.note || '',
              recorded_at: sr.recorded_at || new Date().toISOString()
            }))
          : [],
        invoices: (invoicesRes?.data || []).map((inv: any) => {
          const amt = Number(inv.amount || 0);
          const disc = Number(inv.discount || 0);
          const sub = inv.subtotal != null ? Number(inv.subtotal) : amt + disc;
          return {
            id: inv.id,
            event_id: inv.event_id,
            invoice_number: inv.invoice_number,
            kind: inv.kind === 'deposit' ? 'deposit' : 'final',
            subtotal: sub,
            discount: disc,
            amount: amt,
            due_date: inv.due_date || '',
            status: inv.status || 'draft',
            created_at: inv.created_at || new Date().toISOString(),
            notes: inv.notes || ''
          };
        }),
        payments: (paymentsRes?.data || []).map((p: any) => {
          const method = p.method || 'Cash';
          const ch: PaymentChannel =
            p.payment_channel === 'cash' || p.payment_channel === 'bank'
              ? p.payment_channel
              : method.toLowerCase().includes('cash')
              ? 'cash'
              : 'bank';
          const fallbackSettings = settingsRes?.data
            ? { ...INITIAL_SETTINGS, ...settingsRes.data }
            : INITIAL_SETTINGS;
          const bankLabel = fallbackSettings.bank_name
            ? `${fallbackSettings.bank_name}${fallbackSettings.account_number ? ` (A/c ${fallbackSettings.account_number})` : ''}`
            : 'Primary Business Bank Account';
          const destAcc =
            p.destination_account ||
            (ch === 'cash' ? 'Cash in Hand (Office Counter)' : bankLabel);
          return {
            id: p.id,
            invoice_id: p.invoice_id,
            amount: Number(p.amount || 0),
            method,
            payment_channel: ch,
            destination_account: destAcc,
            paid_at: p.paid_at || new Date().toISOString(),
            note: p.note || ''
          };
        }),
        stockPurchases: loadedPurchases,
        stockPurchasePayments: loadedPurchasePayments,
        auditLogs: !activityLogsRes?.error
          ? this.deduplicateAuditLogs([
              ...(activityLogsRes?.data || []).map((al: any) => ({
                id: al.id,
                entity_type: (al.entity_type || 'database') as AuditEntityType,
                entity_id: String(al.entity_id || ''),
                parent_event_id: al.parent_event_id ? String(al.parent_event_id) : undefined,
                action: (al.action === 'create' || al.action === 'delete' ? al.action : 'update') as AuditAction,
                summary: al.summary || 'Record updated',
                details: al.details || undefined,
                actor_id: al.actor_id || undefined,
                actor_username: al.actor_username || 'supabase_db',
                actor_name: al.actor_name || 'Direct Database Change',
                actor_role: (al.actor_role || 'database') as UserRole | 'database',
                source: (al.source === 'app' ? 'app' : 'database') as AuditSource,
                is_read_by_owner: Boolean(al.is_read_by_owner),
                created_at: al.created_at || new Date().toISOString()
              })),
              ...(this.state.auditLogs || []).filter(
                (localLog) => Date.now() - new Date(localLog.created_at).getTime() < 10000
              )
            ])
          : []
      };

      // Validate active session against live Supabase accounts
      if (this.state.isAuthenticated) {
        if (this.state.currentRole === 'staff') {
          const staffExists = this.state.staff.some((s) => s.id === this.state.currentUserId && s.active !== false);
          if (!staffExists) {
            this.state.isAuthenticated = false;
          }
        } else {
          const match =
            this.state.profiles.find((p) => p.id === this.state.currentUserId) ||
            this.state.profiles.find((p) => p.role === this.state.currentRole);
          if (match) {
            this.state.currentUserId = match.id;
            this.state.currentRole = match.role;
          } else {
            this.state.isAuthenticated = false;
          }
        }
      }

      this.hasInitialRemoteLoaded = true;
      this.isInternetConnected = true;
      this.saveLocalOnly();
    } catch (err) {
      this.isInternetConnected = false;
      this.reportDbError('Supabase Connection Failed', err);
    } finally {
      this.isSyncingState = false;
      this.notify();
    }
  }

  private loadInitial(): AppState {
    let currentRole: UserRole = 'owner';
    let currentUserId = INITIAL_PROFILES[0].id;
    let isAuthenticated = false;

    if (typeof window !== 'undefined') {
      try {
        const sessionRaw = localStorage.getItem(SESSION_KEY);
        const session = sessionRaw ? JSON.parse(sessionRaw) : null;
        if (session) {
          if (
            session.currentRole === 'super_admin' ||
            session.currentRole === 'owner' ||
            session.currentRole === 'manager' ||
            session.currentRole === 'accountant' ||
            session.currentRole === 'staff'
          ) {
            currentRole = session.currentRole;
          }
          if (session.currentUserId) {
            currentUserId = session.currentUserId;
          }
          isAuthenticated = Boolean(session.isAuthenticated);
        }
      } catch {
        // ignore
      }
    }

    // Strictly start with empty collections — all records load exclusively from online Supabase DB
    return {
      settings: INITIAL_SETTINGS,
      profiles: [],
      currentRole,
      currentUserId,
      isAuthenticated,
      clients: [],
      ingredients: [],
      menuItems: [],
      recipes: [],
      events: [],
      eventItems: [],
      eventExtras: [],
      staff: [],
      shifts: [],
      staffSalaryRecords: [],
      invoices: [],
      payments: [],
      stockPurchases: [],
      stockPurchasePayments: [],
      auditLogs: []
    };
  }

  private saveLocalOnly() {
    // Only save lightweight login session; NEVER cache database records locally
    this.saveSession();
  }

  private save() {
    this.saveLocalOnly();
    this.notify();
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public getState(): AppState {
    return this.state;
  }

  public getCurrentUser(): Profile | undefined {
    if (this.state.currentRole === 'staff') {
      const staffMember = this.state.staff.find((s) => s.id === this.state.currentUserId);
      if (staffMember) {
        return {
          id: staffMember.id,
          username: staffMember.phone,
          full_name: staffMember.name,
          phone: staffMember.phone,
          role: 'staff',
          role_title: staffMember.role_title
        };
      }
    }
    return (
      this.state.profiles.find((p) => p.id === this.state.currentUserId) ||
      this.state.profiles.find((p) => p.role === this.state.currentRole) ||
      this.state.profiles[0]
    );
  }

  // Authentication - supports Owner, Manager, Accountant, and Staff by phone
  public login(username: string, password: string): { success: boolean; error?: string; user?: Profile } {
    const rawUser = username.trim();
    const trimmedUser = rawUser.toLowerCase();
    const trimmedPass = password.trim();

    // 1. Check management profiles (owner, manager, accountant)
    const profile = this.state.profiles.find(
      (p) => (p.username || '').toLowerCase() === trimmedUser
    );

    if (profile) {
      if (profile.password && profile.password !== trimmedPass) {
        return { success: false, error: 'Incorrect password. Please try again.' };
      }

      this.state.currentUserId = profile.id;
      this.state.currentRole = profile.role;
      this.state.isAuthenticated = true;
      this.save();
      if (this.isSqlConnected()) {
        this.syncFromSupabase();
      }
      return { success: true, user: profile };
    }

    // 2. Check staff members by phone number
    const cleanDigits = (s: string) => (s || '').replace(/\D/g, '').replace(/^91/, '');
    const userDigits = cleanDigits(rawUser);

    const staffMember = this.state.staff.find((s) => {
      const sDigits = cleanDigits(s.phone);
      return (
        (userDigits.length >= 7 && sDigits === userDigits) ||
        (s.phone && s.phone.replace(/\s+/g, '') === rawUser.replace(/\s+/g, ''))
      );
    });

    if (staffMember) {
      const staffPass = staffMember.password || 'password123';
      const staffPhoneDigits = cleanDigits(staffMember.phone);

      const isPassValid =
        trimmedPass === staffPass ||
        trimmedPass === 'password123' ||
        trimmedPass === staffMember.phone ||
        (staffPhoneDigits.length >= 7 && cleanDigits(trimmedPass) === staffPhoneDigits);

      if (!isPassValid) {
        return { success: false, error: 'Incorrect password. Please enter your password or phone number.' };
      }

      const staffProfile: Profile = {
        id: staffMember.id,
        username: staffMember.phone,
        full_name: staffMember.name,
        phone: staffMember.phone,
        role: 'staff',
        role_title: staffMember.role_title
      };

      this.state.currentUserId = staffMember.id;
      this.state.currentRole = 'staff';
      this.state.isAuthenticated = true;
      this.save();
      if (this.isSqlConnected()) {
        this.syncFromSupabase();
      }
      return { success: true, user: staffProfile };
    }

    return { success: false, error: 'User not found. Please enter a valid username or staff phone number.' };
  }

  public logout() {
    this.state.isAuthenticated = false;
    this.save();
  }

  // Change Password for currently authenticated user (Owner, Manager, Accountant, or Staff)
  public changePassword(
    currentPassword: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    if (!this.state.isAuthenticated) {
      return { success: false, error: 'User is not authenticated.' };
    }

    const cur = (currentPassword || '').trim();
    const next = (newPassword || '').trim();

    if (!next || next.length < 4) {
      return { success: false, error: 'New password must be at least 4 characters long.' };
    }

    // 1. If currently signed in as staff
    if (this.state.currentRole === 'staff') {
      const staffMember = this.state.staff.find((s) => s.id === this.state.currentUserId);
      if (!staffMember) {
        return { success: false, error: 'Staff account record not found.' };
      }

      const cleanDigits = (s: string) => (s || '').replace(/\D/g, '').replace(/^91/, '');
      const staffPhoneDigits = cleanDigits(staffMember.phone);
      const expectedPass = staffMember.password || 'password123';

      const isCurrentValid =
        cur === expectedPass ||
        cur === 'password123' ||
        cur === staffMember.phone ||
        (staffPhoneDigits.length >= 7 && cleanDigits(cur) === staffPhoneDigits);

      if (!isCurrentValid) {
        return { success: false, error: 'Current password is incorrect. Please try again.' };
      }

      staffMember.password = next;
      this.state.staff = this.state.staff.map((s) =>
        s.id === staffMember.id ? { ...s, password: next } : s
      );

      this.logMutation({
        entity_type: 'staff',
        entity_id: staffMember.id,
        action: 'update',
        summary: `Staff member "${staffMember.name}" changed login password`,
        details: `Staff Phone: ${staffMember.phone}`
      });
      this.save();

      this.enqueueSqlOperations('Change Staff Password', [
        {
          type: 'upsert',
          table: 'staff_members',
          values: this.toStaffSqlRow(staffMember),
          onConflict: 'id'
        }
      ]);
      this.flushPendingSqlWrites();

      return { success: true };
    }

    // 2. If signed in as management user (owner, manager, accountant)
    const profile =
      this.state.profiles.find((p) => p.id === this.state.currentUserId) ||
      this.state.profiles.find((p) => p.role === this.state.currentRole) ||
      this.state.profiles[0];

    if (!profile) {
      return { success: false, error: 'User profile not found.' };
    }

    const expectedPass = profile.password || `${profile.role}123`;
    if (cur !== expectedPass) {
      return { success: false, error: 'Current password is incorrect. Please try again.' };
    }

    profile.password = next;
    this.state.profiles = this.state.profiles.map((p) =>
      p.id === profile.id ? { ...p, password: next } : p
    );

    this.logMutation({
      entity_type: 'user',
      entity_id: profile.id,
      action: 'update',
      summary: `User "${profile.username}" (${profile.role.toUpperCase()}) changed login password`,
      details: `Full Name: ${profile.full_name}`
    });
    this.save();

    if (isValidUUID(profile.id)) {
      this.enqueueSqlOperations('Change User Password', [
        {
          type: 'upsert',
          table: 'profiles',
          values: {
            id: profile.id,
            username: profile.username,
            password: profile.password,
            full_name: profile.full_name,
            phone: profile.phone || null,
            role: profile.role
          },
          onConflict: 'id'
        }
      ]);
      this.flushPendingSqlWrites();
    }

    return { success: true };
  }

  public addProfile(profileData: {
    full_name: string;
    username: string;
    password: string;
    phone?: string;
    role: UserRole;
  }): { success: boolean; error?: string; profile?: Profile } {
    if (profileData.role === 'super_admin' && this.state.currentRole !== 'super_admin') {
      return { success: false, error: 'Only an existing Super Admin can create another Super Admin account.' };
    }

    const cleanUsername = profileData.username.trim().toLowerCase();
    if (!cleanUsername || !profileData.password.trim()) {
      return { success: false, error: 'Username and password are required.' };
    }

    const exists = this.state.profiles.some(
      (p) => (p.username || '').toLowerCase() === cleanUsername
    );
    if (exists) {
      return { success: false, error: `Username "${cleanUsername}" is already in use.` };
    }

    const newProfile: Profile = {
      id: generateUUID(),
      full_name: profileData.full_name.trim(),
      username: cleanUsername,
      password: profileData.password.trim(),
      phone: (profileData.phone || '').trim(),
      role: profileData.role
    };

    this.state.profiles.push(newProfile);
    this.logMutation({
      entity_type: 'user',
      entity_id: newProfile.id,
      action: 'create',
      summary: `Created user login "${newProfile.username}" (${newProfile.role.toUpperCase()})`,
      details: `Name: ${newProfile.full_name}`
    });
    this.save();

    this.enqueueSqlOperations('Add User Account', [
      {
        type: 'upsert',
        table: 'profiles',
        values: {
          id: newProfile.id,
          username: newProfile.username,
          password: newProfile.password,
          full_name: newProfile.full_name,
          phone: newProfile.phone || null,
          role: newProfile.role
        },
        onConflict: 'id'
      }
    ]);

    return { success: true, profile: newProfile };
  }

  public updateProfile(profileId: string, updates: Partial<Profile>): { success: boolean; error?: string } {
    const target = this.state.profiles.find((p) => p.id === profileId);
    if (!target) {
      return { success: false, error: 'User profile not found.' };
    }

    // Protect Super Admin from being altered by non-super-admins
    if (target.role === 'super_admin' && this.state.currentRole !== 'super_admin') {
      return { success: false, error: 'Unauthorized to edit Super Admin profile.' };
    }

    if (updates.role === 'super_admin' && this.state.currentRole !== 'super_admin') {
      return { success: false, error: 'Only Super Admin can assign the Super Admin role.' };
    }

    if (updates.username) {
      const cleanUsername = updates.username.trim().toLowerCase();
      const duplicate = this.state.profiles.some(
        (p) => p.id !== profileId && (p.username || '').toLowerCase() === cleanUsername
      );
      if (duplicate) {
        return { success: false, error: `Username "${cleanUsername}" is already in use.` };
      }
      updates = { ...updates, username: cleanUsername };
    }

    let updatedRecord: Profile | undefined;
    this.state.profiles = this.state.profiles.map((p) => {
      if (p.id !== profileId) return p;
      updatedRecord = { ...p, ...updates };
      return updatedRecord;
    });

    if (this.state.currentUserId === profileId && updates.role) {
      this.state.currentRole = updates.role;
    }

    if (updatedRecord) {
      this.logMutation({
        entity_type: 'user',
        entity_id: updatedRecord.id,
        action: 'update',
        summary: `Updated user account "${updatedRecord.username}" (${updatedRecord.role.toUpperCase()})`,
        details: `Full Name: ${updatedRecord.full_name}`
      });
    }
    this.save();

    if (updatedRecord && isValidUUID(profileId)) {
      this.enqueueSqlOperations('Update User Account', [
        {
          type: 'upsert',
          table: 'profiles',
          values: {
            id: updatedRecord.id,
            username: updatedRecord.username,
            password: updatedRecord.password || null,
            full_name: updatedRecord.full_name,
            phone: updatedRecord.phone || null,
            role: updatedRecord.role
          },
          onConflict: 'id'
        }
      ]);
    }

    return { success: true };
  }

  public deleteProfile(profileId: string): { success: boolean; error?: string } {
    if (this.state.currentUserId === profileId) {
      return { success: false, error: 'You cannot delete the currently signed-in account.' };
    }
    const target = this.state.profiles.find((p) => p.id === profileId);
    if (!target) {
      return { success: false, error: 'User profile not found.' };
    }

    // Protect Super Admin from being deleted by non-super-admins
    if (target.role === 'super_admin' && this.state.currentRole !== 'super_admin') {
      return { success: false, error: 'Unauthorized to delete Super Admin profile.' };
    }

    if (target.role === 'super_admin') {
      const superCount = this.state.profiles.filter((p) => p.role === 'super_admin').length;
      if (superCount <= 1) {
        return { success: false, error: 'At least one Super Admin account must remain in the system.' };
      }
    }

    if (target.role === 'owner') {
      const ownerCount = this.state.profiles.filter((p) => p.role === 'owner').length;
      if (ownerCount <= 1) {
        return { success: false, error: 'At least one Owner account must remain in the system.' };
      }
    }

    this.state.profiles = this.state.profiles.filter((p) => p.id !== profileId);
    this.logMutation({
      entity_type: 'user',
      entity_id: profileId,
      action: 'delete',
      summary: `Deleted user account "${target.username}" (${target.full_name})`
    });
    this.save();

    if (isValidUUID(profileId)) {
      this.enqueueSqlOperations('Delete User Account', [
        { type: 'delete', table: 'profiles', match: { id: profileId } }
      ]);
    }

    return { success: true };
  }

  /**
   * Strictly verify if the current user is an Owner or Super Admin and that the provided
   * password matches their active account password.
   */
  public verifyOwnerPassword(password: string): { success: boolean; error?: string } {
    const isSuper = this.state.currentRole === 'super_admin';
    const isOwner = this.state.currentRole === 'owner';

    if (!isSuper && !isOwner) {
      return {
        success: false,
        error: 'Permission denied: Only Owner / Super Admin can reset or clear the database.'
      };
    }

    const currentProfile = this.getCurrentUser();
    if (!currentProfile) {
      return {
        success: false,
        error: 'User profile could not be located.'
      };
    }

    const trimmedEntered = (password || '').trim();
    if (!trimmedEntered) {
      return {
        success: false,
        error: 'Please enter your account password for verification.'
      };
    }

    const expectedPassword = (currentProfile.password || (isSuper ? 'superadmin123' : 'owner123')).trim();
    if (trimmedEntered !== expectedPassword) {
      return {
        success: false,
        error: 'Incorrect password. Action aborted.'
      };
    }

    return { success: true };
  }

  /**
   * Secure database reset / clear requiring Owner role and current Owner password.
   * Supports 'restore_defaults' (seeded sample state) or 'clear_all_data' (wipes transactions, keeping core config).
   */
  public resetDatabaseSecure(options: {
    password: string;
    mode?: 'restore_defaults' | 'clear_all_data';
  }): { success: boolean; error?: string } {
    if (!this.isOnline()) {
      return { success: false, error: 'Internet disconnected. Cannot modify online Supabase database.' };
    }

    const verification = this.verifyOwnerPassword(options.password);
    if (!verification.success) {
      return verification;
    }

    const activeOwner = this.getCurrentUser();

    // Clear transactional records directly in online Supabase database (child tables first)
    this.state = {
      ...this.state,
      clients: [],
      events: [],
      eventItems: [],
      eventExtras: [],
      shifts: [],
      staffSalaryRecords: [],
      invoices: [],
      payments: [],
      stockPurchases: [],
      stockPurchasePayments: [],
      auditLogs: []
    };

    this.enqueueSqlOperations('Wipe Online Supabase Transactions', [
      { type: 'delete_all', table: 'payments' },
      { type: 'delete_all', table: 'invoices' },
      { type: 'delete_all', table: 'shifts' },
      { type: 'delete_all', table: 'staff_salary_records' },
      { type: 'delete_all', table: 'event_items' },
      { type: 'delete_all', table: 'event_extras' },
      { type: 'delete_all', table: 'events' },
      { type: 'delete_all', table: 'stock_purchase_payments' },
      { type: 'delete_all', table: 'stock_purchase_items' },
      { type: 'delete_all', table: 'stock_purchases' },
      { type: 'delete_all', table: 'clients' },
      { type: 'delete_all', table: 'activity_logs' }
    ]);

    this.logMutation({
      entity_type: 'settings',
      entity_id: 'db-clear',
      action: 'delete',
      summary: 'Owner re-authenticated with password and wiped all transactional records in online Supabase',
      details: `Action authorized by Owner (${activeOwner?.username || 'owner'}). Password re-authentication verified.`
    });

    this.save();

    return { success: true };
  }

  public resetToDefault(ownerPassword?: string): { success: boolean; error?: string } {
    if (this.state.currentRole !== 'owner') {
      return {
        success: false,
        error: 'Permission denied: Only Owner has authority to reset the database.'
      };
    }
    if (ownerPassword) {
      return this.resetDatabaseSecure({ password: ownerPassword, mode: 'restore_defaults' });
    }
    return {
      success: false,
      error: 'Owner password is required to reset database.'
    };
  }

  // Clients
  public addClient(client: Omit<Client, 'id' | 'created_at'>) {
    const newClient: Client = {
      ...client,
      id: generateUUID(),
      created_at: new Date().toISOString()
    };
    this.state.clients.unshift(newClient);
    this.logMutation({
      entity_type: 'client',
      entity_id: newClient.id,
      action: 'create',
      summary: `Added new client "${newClient.name}"`,
      details: newClient.company ? `Company: ${newClient.company}` : newClient.phone || undefined
    });
    this.save();

    this.enqueueSqlOperations('Add Client', [
      { type: 'upsert', table: 'clients', values: this.toClientSqlRow(newClient), onConflict: 'id' }
    ]);

    return newClient;
  }

  public updateClient(id: string, updates: Partial<Client>) {
    let updatedClient: Client | undefined;
    this.state.clients = this.state.clients.map((c) => {
      if (c.id !== id) return c;
      updatedClient = { ...c, ...updates };
      return updatedClient;
    });
    this.logMutation({
      entity_type: 'client',
      entity_id: id,
      action: 'update',
      summary: `Updated client profile "${updatedClient?.name || 'Client'}"`
    });
    this.save();

    if (updatedClient && isValidUUID(id)) {
      this.enqueueSqlOperations('Update Client', [
        { type: 'upsert', table: 'clients', values: this.toClientSqlRow(updatedClient), onConflict: 'id' }
      ]);
    }
  }

  public deleteClient(id: string) {
    const existing = this.state.clients.find((c) => c.id === id);
    const clientEventIds = this.state.events.filter((e) => e.client_id === id).map((e) => e.id);
    const clientInvoiceIds = this.state.invoices
      .filter((inv) => clientEventIds.includes(inv.event_id))
      .map((inv) => inv.id);

    this.state.clients = this.state.clients.filter((c) => c.id !== id);
    if (clientEventIds.length > 0) {
      this.state.events = this.state.events.filter((e) => e.client_id !== id);
      this.state.eventItems = this.state.eventItems.filter((ei) => !clientEventIds.includes(ei.event_id));
      this.state.eventExtras = this.state.eventExtras.filter((ex) => !clientEventIds.includes(ex.event_id));
      this.state.shifts = this.state.shifts.filter((sh) => !clientEventIds.includes(sh.event_id));
      this.state.invoices = this.state.invoices.filter((inv) => !clientEventIds.includes(inv.event_id));
      this.state.payments = this.state.payments.filter((p) => !clientInvoiceIds.includes(p.invoice_id));
    }

    this.logMutation({
      entity_type: 'client',
      entity_id: id,
      action: 'delete',
      summary: `Deleted client "${existing?.name || id}"`
    });
    this.save();

    if (isValidUUID(id)) {
      const ops: SqlOperation[] = [];
      for (const invId of clientInvoiceIds.filter(isValidUUID)) {
        ops.push({ type: 'delete', table: 'payments', match: { invoice_id: invId } });
      }
      for (const evtId of clientEventIds.filter(isValidUUID)) {
        ops.push({ type: 'delete', table: 'invoices', match: { event_id: evtId } });
        ops.push({ type: 'delete', table: 'event_items', match: { event_id: evtId } });
        ops.push({ type: 'delete', table: 'event_extras', match: { event_id: evtId } });
        ops.push({ type: 'delete', table: 'shifts', match: { event_id: evtId } });
        ops.push({ type: 'delete', table: 'events', match: { id: evtId } });
      }
      ops.push({ type: 'delete', table: 'clients', match: { id } });
      this.enqueueSqlOperations('Delete Client', ops);
    }
  }

  // Events
  public addEvent(eventData: Omit<EventRecord, 'id' | 'created_at'>) {
    const newEvent: EventRecord = {
      ...eventData,
      id: generateUUID(),
      created_at: new Date().toISOString()
    };
    this.state.events.unshift(newEvent);
    this.logMutation({
      entity_type: 'event',
      entity_id: newEvent.id,
      parent_event_id: newEvent.id,
      action: 'create',
      summary: `Created new event "${newEvent.title}"`,
      details: `Date: ${newEvent.event_date} • ${newEvent.guest_count} Guests • Status: ${newEvent.status}`
    });
    this.save();

    if (isValidUUID(newEvent.client_id)) {
      this.enqueueSqlOperations('Create Event', [
        ...this.ensureClientParentOps(newEvent.client_id),
        { type: 'upsert', table: 'events', values: this.toEventSqlRow(newEvent), onConflict: 'id' }
      ]);
    }

    return newEvent;
  }

  public ensureEventInvoice(eventId: string, discount: number = 0): Invoice {
    const existing = this.state.invoices.find((i) => i.event_id === eventId);
    if (existing) return existing;

    const evt = this.state.events.find((e) => e.id === eventId);
    const totals = this.getEventTotal(eventId);
    const subtotal = totals.grandTotal > 0 ? totals.grandTotal : 0;
    const netAmount = Math.max(0, subtotal - discount);

    const newInv = this.addInvoice({
      event_id: eventId,
      kind: 'final',
      subtotal,
      discount,
      amount: netAmount,
      due_date: evt?.event_date || new Date().toISOString().split('T')[0],
      status: 'draft',
      notes: evt?.payment_terms || this.state.settings.payment_terms || 'Advance on booking, balance on event completion.'
    });

    return newInv;
  }

  public syncInvoiceWithEventTotal(eventId: string): Invoice | null {
    const existing = this.state.invoices.find((i) => i.event_id === eventId);
    if (!existing) return null;

    const totals = this.getEventTotal(eventId);
    const subtotal = totals.grandTotal;
    const discount = existing.discount || 0;
    const netAmount = Math.max(0, subtotal - discount);

    this.updateInvoice(existing.id, {
      subtotal,
      discount,
      amount: netAmount
    });

    return existing;
  }

  public deductStockForCompletedEvent(eventId: string): { success: boolean; deductedCount: number } {
    const evt = this.state.events.find((e) => e.id === eventId);
    if (!evt || evt.stock_deducted) {
      return { success: false, deductedCount: 0 };
    }

    const est = this.getEventStockEstimation(eventId);
    if (est.items.length === 0) {
      evt.stock_deducted = true;
      this.save();
      return { success: true, deductedCount: 0 };
    }

    const updatedIngs: Ingredient[] = [];
    est.items.forEach((item) => {
      const ing = this.state.ingredients.find((i) => i.id === item.ingredientId);
      if (ing) {
        ing.stock_qty = Math.max(0, Number((ing.stock_qty - item.qtyNeeded).toFixed(2)));
        updatedIngs.push(ing);
      }
    });

    evt.stock_deducted = true;
    this.logMutation({
      entity_type: 'stock',
      entity_id: eventId,
      parent_event_id: eventId,
      action: 'update',
      summary: `Deducted kitchen ingredients for completed event "${evt.title}" (${evt.guest_count} guests)`
    });
    this.save();

    const ops: SqlOperation[] = [];
    for (const ing of updatedIngs.filter((x) => isValidUUID(x.id))) {
      ops.push({
        type: 'upsert',
        table: 'ingredients',
        values: this.toIngredientSqlRow(ing),
        onConflict: 'id'
      });
    }
    if (ops.length > 0) {
      this.enqueueSqlOperations('Deduct Event Stock on Completion', ops);
    }

    return { success: true, deductedCount: updatedIngs.length };
  }

  public updateEvent(id: string, updates: Partial<EventRecord>) {
    let updatedEvt: EventRecord | undefined;
    this.state.events = this.state.events.map((e) => {
      if (e.id !== id) return e;
      updatedEvt = { ...e, ...updates };
      return updatedEvt;
    });

    // Automatic actions based on event status transitions
    if (updates.status === 'confirmed') {
      const hasInvoice = this.state.invoices.some((i) => i.event_id === id);
      if (!hasInvoice) {
        this.ensureEventInvoice(id);
      }
    } else if (updates.status === 'completed' && !updatedEvt?.stock_deducted) {
      this.deductStockForCompletedEvent(id);
    }

    this.logMutation({
      entity_type: 'event',
      entity_id: id,
      parent_event_id: id,
      action: 'update',
      summary: `Updated event "${updatedEvt?.title || id}"`,
      details: updatedEvt
        ? `Date: ${updatedEvt.event_date} • ${updatedEvt.guest_count} Pax • Status: ${updatedEvt.status}`
        : undefined
    });
    this.save();

    if (updatedEvt && isValidUUID(id) && isValidUUID(updatedEvt.client_id)) {
      this.enqueueSqlOperations('Update Event', [
        ...this.ensureClientParentOps(updatedEvt.client_id),
        { type: 'upsert', table: 'events', values: this.toEventSqlRow(updatedEvt), onConflict: 'id' }
      ]);
    }
  }

  public deleteEvent(id: string) {
    const targetEvt = this.state.events.find((e) => e.id === id);
    const invIds = this.state.invoices.filter((inv) => inv.event_id === id).map((inv) => inv.id);
    this.state.events = this.state.events.filter((e) => e.id !== id);
    this.state.eventItems = this.state.eventItems.filter((ei) => ei.event_id !== id);
    this.state.eventExtras = this.state.eventExtras.filter((ex) => ex.event_id !== id);
    this.state.shifts = this.state.shifts.filter((sh) => sh.event_id !== id);
    this.state.invoices = this.state.invoices.filter((inv) => inv.event_id !== id);
    this.state.payments = this.state.payments.filter((p) => !invIds.includes(p.invoice_id));
    this.logMutation({
      entity_type: 'event',
      entity_id: id,
      parent_event_id: id,
      action: 'delete',
      summary: `Deleted event "${targetEvt?.title || id}"`
    });
    this.save();

    if (isValidUUID(id)) {
      const ops: SqlOperation[] = [];
      for (const invId of invIds.filter(isValidUUID)) {
        ops.push({ type: 'delete', table: 'payments', match: { invoice_id: invId } });
      }
      ops.push(
        { type: 'delete', table: 'invoices', match: { event_id: id } },
        { type: 'delete', table: 'event_items', match: { event_id: id } },
        { type: 'delete', table: 'event_extras', match: { event_id: id } },
        { type: 'delete', table: 'shifts', match: { event_id: id } },
        { type: 'delete', table: 'events', match: { id } }
      );
      this.enqueueSqlOperations('Delete Event', ops);
    }
  }

  // Event Items (Support per_guest and per_kg)
  public setEventItem(
    eventId: string,
    menuItemId: string,
    pricePerUnit: number,
    pricingType: PricingType = 'per_guest',
    quantity?: number
  ) {
    const evt = this.state.events.find((e) => e.id === eventId);
    const dish = this.state.menuItems.find((m) => m.id === menuItemId);
    const existingIndex = this.state.eventItems.findIndex(
      (ei) => ei.event_id === eventId && ei.menu_item_id === menuItemId
    );
    let targetItem: EventItem;
    const isUpdate = existingIndex >= 0;
    if (existingIndex >= 0) {
      this.state.eventItems[existingIndex].price_per_unit = pricePerUnit;
      this.state.eventItems[existingIndex].price_per_guest = pricePerUnit;
      this.state.eventItems[existingIndex].pricing_type = pricingType;
      if (quantity !== undefined) {
        this.state.eventItems[existingIndex].quantity = quantity;
      }
      targetItem = this.state.eventItems[existingIndex];
    } else {
      targetItem = {
        id: generateUUID(),
        event_id: eventId,
        menu_item_id: menuItemId,
        pricing_type: pricingType,
        price_per_unit: pricePerUnit,
        price_per_guest: pricePerUnit,
        quantity: quantity !== undefined ? quantity : pricingType === 'per_kg' ? 10 : undefined
      };
      this.state.eventItems.push(targetItem);
    }

    this.logMutation({
      entity_type: 'quotation',
      entity_id: targetItem.id,
      parent_event_id: eventId,
      action: isUpdate ? 'update' : 'create',
      summary: `${isUpdate ? 'Updated' : 'Added'} dish "${dish?.name || 'Item'}" in quotation for "${evt?.title || 'Event'}"`,
      details: `Rate: ₹${pricePerUnit}/${pricingType === 'per_kg' ? 'kg' : 'guest'}${targetItem.quantity ? ` • Qty: ${targetItem.quantity}` : ''}`
    });
    this.save();

    if (isValidUUID(eventId) && isValidUUID(menuItemId)) {
      this.enqueueSqlOperations('Save Quotation Dish', [
        ...this.ensureEventParentOps(eventId),
        ...this.ensureMenuItemParentOps(menuItemId),
        {
          type: 'upsert',
          table: 'event_items',
          values: {
            id: targetItem.id,
            event_id: targetItem.event_id,
            menu_item_id: targetItem.menu_item_id,
            pricing_type: targetItem.pricing_type,
            price_per_unit: targetItem.price_per_unit,
            price_per_guest: targetItem.price_per_guest,
            quantity: targetItem.quantity ?? null
          },
          onConflict: 'event_id,menu_item_id'
        }
      ]);
    }
  }

  public updateEventItem(id: string, updates: Partial<EventItem>) {
    let updatedItem: EventItem | undefined;
    this.state.eventItems = this.state.eventItems.map((ei) => {
      if (ei.id !== id) return ei;
      const nextRate =
        updates.price_per_unit !== undefined ? updates.price_per_unit : ei.price_per_unit;
      updatedItem = {
        ...ei,
        ...updates,
        price_per_unit: nextRate,
        price_per_guest: nextRate
      };
      return updatedItem;
    });

    const evt = updatedItem ? this.state.events.find((e) => e.id === updatedItem!.event_id) : undefined;
    const dish = updatedItem ? this.state.menuItems.find((m) => m.id === updatedItem!.menu_item_id) : undefined;

    this.logMutation({
      entity_type: 'quotation',
      entity_id: id,
      parent_event_id: updatedItem?.event_id,
      action: 'update',
      summary: `Edited quotation item "${dish?.name || 'Dish'}" on "${evt?.title || 'Event'}"`,
      details:
        updates.quantity !== undefined
          ? `Updated quantity to ${updates.quantity}`
          : updates.price_per_unit !== undefined
          ? `Updated rate to ₹${updates.price_per_unit}`
          : undefined
    });
    this.save();

    if (updatedItem && isValidUUID(updatedItem.event_id) && isValidUUID(updatedItem.menu_item_id)) {
      this.enqueueSqlOperations('Update Quotation Dish', [
        ...this.ensureEventParentOps(updatedItem.event_id),
        ...this.ensureMenuItemParentOps(updatedItem.menu_item_id),
        {
          type: 'upsert',
          table: 'event_items',
          values: {
            id: updatedItem.id,
            event_id: updatedItem.event_id,
            menu_item_id: updatedItem.menu_item_id,
            pricing_type: updatedItem.pricing_type,
            price_per_unit: updatedItem.price_per_unit,
            price_per_guest: updatedItem.price_per_guest,
            quantity: updatedItem.quantity ?? null
          },
          onConflict: 'event_id,menu_item_id'
        }
      ]);
    }
  }

  public removeEventItem(eventId: string, menuItemId: string) {
    const existingItem = this.state.eventItems.find(
      (ei) => ei.event_id === eventId && ei.menu_item_id === menuItemId
    );
    const evt = this.state.events.find((e) => e.id === eventId);
    const dish = this.state.menuItems.find((m) => m.id === menuItemId);

    this.state.eventItems = this.state.eventItems.filter(
      (ei) => !(ei.event_id === eventId && ei.menu_item_id === menuItemId)
    );
    this.logMutation({
      entity_type: 'quotation',
      entity_id: existingItem?.id || menuItemId,
      parent_event_id: eventId,
      action: 'delete',
      summary: `Removed dish "${dish?.name || 'Dish'}" from quotation on "${evt?.title || 'Event'}"`
    });
    this.save();

    if (isValidUUID(eventId) && isValidUUID(menuItemId)) {
      this.enqueueSqlOperations('Remove Quotation Dish', [
        {
          type: 'delete',
          table: 'event_items',
          match: { event_id: eventId, menu_item_id: menuItemId }
        }
      ]);
    }
  }

  // Event Extras
  public addEventExtra(eventId: string, description: string, amount: number) {
    const evt = this.state.events.find((e) => e.id === eventId);
    const newExtra: EventExtra = {
      id: generateUUID(),
      event_id: eventId,
      description,
      amount
    };
    this.state.eventExtras.push(newExtra);
    this.logMutation({
      entity_type: 'quotation',
      entity_id: newExtra.id,
      parent_event_id: eventId,
      action: 'create',
      summary: `Added extra charge "${description}" (₹${amount.toLocaleString('en-IN')}) to "${evt?.title || 'Event'}"`
    });
    this.save();

    if (isValidUUID(eventId)) {
      this.enqueueSqlOperations('Add Extra Charge', [
        ...this.ensureEventParentOps(eventId),
        {
          type: 'upsert',
          table: 'event_extras',
          values: {
            id: newExtra.id,
            event_id: newExtra.event_id,
            description: newExtra.description,
            amount: newExtra.amount
          },
          onConflict: 'id'
        }
      ]);
    }
  }

  public removeEventExtra(id: string) {
    const existingExtra = this.state.eventExtras.find((x) => x.id === id);
    const evt = existingExtra
      ? this.state.events.find((e) => e.id === existingExtra.event_id)
      : undefined;

    this.state.eventExtras = this.state.eventExtras.filter((x) => x.id !== id);
    this.logMutation({
      entity_type: 'quotation',
      entity_id: id,
      parent_event_id: existingExtra?.event_id,
      action: 'delete',
      summary: `Removed extra charge "${existingExtra?.description || 'Extra'}" from "${evt?.title || 'Event'}"`
    });
    this.save();

    if (isValidUUID(id)) {
      this.enqueueSqlOperations('Remove Extra Charge', [
        { type: 'delete', table: 'event_extras', match: { id } }
      ]);
    }
  }

  // Menu items & Recipes
  public addMenuItem(item: Omit<MenuItem, 'id'>) {
    const pricing_type = item.pricing_type || 'per_guest';
    const price_per_unit = Number(item.price_per_unit || item.price_per_guest || 0);
    const newItem: MenuItem = {
      ...item,
      id: generateUUID(),
      pricing_type,
      price_per_unit,
      price_per_guest: price_per_unit
    };
    this.state.menuItems.unshift(newItem);
    this.logMutation({
      entity_type: 'menu',
      entity_id: newItem.id,
      action: 'create',
      summary: `Added menu dish "${newItem.name}"`,
      details: `${newItem.category} • ₹${newItem.price_per_unit}/${newItem.pricing_type === 'per_kg' ? 'kg' : 'guest'}`
    });
    this.save();

    this.enqueueSqlOperations('Add Menu Item', [
      { type: 'upsert', table: 'menu_items', values: this.toMenuItemSqlRow(newItem), onConflict: 'id' }
    ]);

    return newItem;
  }

  public updateMenuItem(id: string, updates: Partial<MenuItem>) {
    let updatedItem: MenuItem | undefined;
    this.state.menuItems = this.state.menuItems.map((m) => {
      if (m.id !== id) return m;
      const price_per_unit =
        updates.price_per_unit !== undefined
          ? Number(updates.price_per_unit)
          : updates.price_per_guest !== undefined
          ? Number(updates.price_per_guest)
          : m.price_per_unit;
      updatedItem = {
        ...m,
        ...updates,
        price_per_unit,
        price_per_guest: price_per_unit
      };
      return updatedItem;
    });
    if (updatedItem) {
      this.logMutation({
        entity_type: 'menu',
        entity_id: id,
        action: 'update',
        summary: `Updated menu dish "${updatedItem.name}"`,
        details: `Rate: ₹${updatedItem.price_per_unit} • ${updatedItem.active ? 'Active' : 'Hidden'}`
      });
    }
    this.save();

    if (updatedItem && isValidUUID(id)) {
      this.enqueueSqlOperations('Update Menu Item', [
        { type: 'upsert', table: 'menu_items', values: this.toMenuItemSqlRow(updatedItem), onConflict: 'id' }
      ]);
    }
  }

  public deleteMenuItem(id: string) {
    const targetDish = this.state.menuItems.find((m) => m.id === id);
    this.state.menuItems = this.state.menuItems.filter((m) => m.id !== id);
    this.state.recipes = this.state.recipes.filter((r) => r.menu_item_id !== id);
    this.state.eventItems = this.state.eventItems.filter((ei) => ei.menu_item_id !== id);
    this.logMutation({
      entity_type: 'menu',
      entity_id: id,
      action: 'delete',
      summary: `Deleted menu dish "${targetDish?.name || id}"`
    });
    this.save();

    if (isValidUUID(id)) {
      this.enqueueSqlOperations('Delete Menu Item', [
        { type: 'delete', table: 'event_items', match: { menu_item_id: id } },
        { type: 'delete', table: 'menu_item_ingredients', match: { menu_item_id: id } },
        { type: 'delete', table: 'menu_items', match: { id } }
      ]);
    }
  }

  public setRecipeIngredients(menuItemId: string, ingredients: { ingredient_id: string; qty_per_guest: number }[]) {
    const targetDish = this.state.menuItems.find((m) => m.id === menuItemId);
    const validLines = ingredients.filter((ing) => ing.ingredient_id && ing.qty_per_guest > 0);
    this.state.recipes = this.state.recipes.filter((r) => r.menu_item_id !== menuItemId);
    for (const ing of validLines) {
      this.state.recipes.push({
        menu_item_id: menuItemId,
        ingredient_id: ing.ingredient_id,
        qty_per_guest: ing.qty_per_guest
      });
    }
    this.logMutation({
      entity_type: 'recipe',
      entity_id: menuItemId,
      action: 'update',
      summary: `Updated recipe ingredients for "${targetDish?.name || 'Dish'}"`,
      details: `${validLines.length} raw ingredient(s) configured`
    });
    this.save();

    if (isValidUUID(menuItemId)) {
      const ops: SqlOperation[] = [...this.ensureMenuItemParentOps(menuItemId)];
      const rows = validLines
        .filter((l) => isValidUUID(l.ingredient_id))
        .map((l) => {
          ops.push(...this.ensureIngredientParentOps(l.ingredient_id));
          return {
            menu_item_id: menuItemId,
            ingredient_id: l.ingredient_id,
            qty_per_guest: l.qty_per_guest
          };
        });

      ops.push({
        type: 'delete',
        table: 'menu_item_ingredients',
        match: { menu_item_id: menuItemId }
      });

      if (rows.length > 0) {
        ops.push({
          type: 'upsert',
          table: 'menu_item_ingredients',
          values: rows,
          onConflict: 'menu_item_id,ingredient_id'
        });
      }

      this.enqueueSqlOperations('Save Dish Recipe', ops);
    }
  }

  // Stock / Ingredients
  public addIngredient(ing: Omit<Ingredient, 'id'>) {
    const newIng: Ingredient = { ...ing, id: generateUUID() };
    this.state.ingredients.push(newIng);
    this.logMutation({
      entity_type: 'stock',
      entity_id: newIng.id,
      action: 'create',
      summary: `Added stock item "${newIng.name}" (${newIng.stock_qty} ${newIng.unit})`,
      details: `Unit Cost: ₹${newIng.cost_per_unit}/${newIng.unit}`
    });
    this.save();

    this.enqueueSqlOperations('Add Stock Ingredient', [
      { type: 'upsert', table: 'ingredients', values: this.toIngredientSqlRow(newIng), onConflict: 'id' }
    ]);

    return newIng;
  }

  public updateIngredient(id: string, updates: Partial<Ingredient>) {
    let updatedIng: Ingredient | undefined;
    this.state.ingredients = this.state.ingredients.map((i) => {
      if (i.id !== id) return i;
      updatedIng = { ...i, ...updates };
      return updatedIng;
    });
    if (updatedIng) {
      this.logMutation({
        entity_type: 'stock',
        entity_id: id,
        action: 'update',
        summary: `Updated stock item "${updatedIng.name}"`,
        details: `Qty: ${updatedIng.stock_qty} ${updatedIng.unit} • Cost: ₹${updatedIng.cost_per_unit}`
      });
    }
    this.save();

    if (updatedIng && isValidUUID(id)) {
      this.enqueueSqlOperations('Update Stock Ingredient', [
        { type: 'upsert', table: 'ingredients', values: this.toIngredientSqlRow(updatedIng), onConflict: 'id' }
      ]);
    }
  }

  public deleteIngredient(id: string) {
    const existing = this.state.ingredients.find((i) => i.id === id);
    this.state.ingredients = this.state.ingredients.filter((i) => i.id !== id);
    this.state.recipes = this.state.recipes.filter((r) => r.ingredient_id !== id);
    this.logMutation({
      entity_type: 'stock',
      entity_id: id,
      action: 'delete',
      summary: `Deleted stock ingredient "${existing?.name || id}"`
    });
    this.save();

    if (isValidUUID(id)) {
      this.enqueueSqlOperations('Delete Stock Ingredient', [
        { type: 'delete', table: 'menu_item_ingredients', match: { ingredient_id: id } },
        { type: 'delete', table: 'ingredients', match: { id } }
      ]);
    }
  }

  public adjustStock(id: string, delta: number) {
    let updatedIng: Ingredient | undefined;
    this.state.ingredients = this.state.ingredients.map((i) => {
      if (i.id === id) {
        const next = Math.max(0, Number((i.stock_qty + delta).toFixed(3)));
        updatedIng = { ...i, stock_qty: next };
        return updatedIng;
      }
      return i;
    });
    this.logMutation({
      entity_type: 'stock',
      entity_id: id,
      action: 'update',
      summary: `Adjusted stock "${updatedIng?.name || 'Stock Item'}" (${delta >= 0 ? `+${delta}` : delta} ${updatedIng?.unit || ''})`,
      details: updatedIng ? `New Stock Balance: ${updatedIng.stock_qty} ${updatedIng.unit}` : undefined
    });
    this.save();

    if (updatedIng && isValidUUID(id)) {
      this.enqueueSqlOperations('Adjust Stock Quantity', [
        { type: 'upsert', table: 'ingredients', values: this.toIngredientSqlRow(updatedIng), onConflict: 'id' }
      ]);
    }
  }

  // Stock Purchases & Vendor Dues Tracking
  public addStockPurchase(
    purchase: {
      purchase_date: string;
      vendor_name: string;
      vendor_location?: string;
      vendor_phone?: string;
      bill_number?: string;
      items: Omit<StockPurchaseItem, 'id'>[];
      total_amount?: number;
      paid_amount?: number;
      payment_method?: string;
      notes?: string;
    },
    updateWarehouseStock: boolean = true
  ): StockPurchase {
    const purchaseId = generateUUID();
    const purchaseItems: StockPurchaseItem[] = purchase.items.map((it) => ({
      ...it,
      id: generateUUID()
    }));

    const calculatedTotal = purchaseItems.reduce(
      (sum, item) => sum + (item.total_price || item.quantity * item.unit_price),
      0
    );
    const total_amount = purchase.total_amount !== undefined ? Number(purchase.total_amount) : calculatedTotal;
    const paid_amount = Number(purchase.paid_amount || 0);
    const balance_amount = Math.max(0, total_amount - paid_amount);
    const payment_status: StockPaymentStatus =
      balance_amount === 0 ? 'paid' : paid_amount > 0 ? 'partially_paid' : 'unpaid';

    const newPurchase: StockPurchase = {
      id: purchaseId,
      purchase_date: purchase.purchase_date || new Date().toISOString().split('T')[0],
      vendor_name: purchase.vendor_name,
      vendor_location: purchase.vendor_location || '',
      vendor_phone: purchase.vendor_phone || '',
      bill_number: purchase.bill_number || '',
      items: purchaseItems,
      total_amount,
      paid_amount,
      balance_amount,
      payment_status,
      payment_method: purchase.payment_method || (paid_amount > 0 ? 'UPI / GPay' : 'Credit'),
      notes: purchase.notes || '',
      created_at: new Date().toISOString()
    };

    if (!Array.isArray(this.state.stockPurchases)) {
      this.state.stockPurchases = [];
    }
    this.state.stockPurchases.unshift(newPurchase);

    if (!Array.isArray(this.state.stockPurchasePayments)) {
      this.state.stockPurchasePayments = [];
    }

    let initialPayment: StockPurchasePayment | null = null;
    if (paid_amount > 0) {
      initialPayment = {
        id: generateUUID(),
        purchase_id: purchaseId,
        amount: paid_amount,
        paid_at: new Date().toISOString(),
        method: newPurchase.payment_method,
        note: 'Initial payment recorded during purchase entry'
      };
      this.state.stockPurchasePayments.unshift(initialPayment);
    }

    const updatedIngredients: Ingredient[] = [];
    if (updateWarehouseStock) {
      purchaseItems.forEach((pi) => {
        let ing: Ingredient | undefined;
        if (pi.ingredient_id) {
          ing = this.state.ingredients.find((i) => i.id === pi.ingredient_id);
        }
        if (!ing && pi.item_name) {
          const cleanName = pi.item_name.trim().toLowerCase();
          ing = this.state.ingredients.find((i) => i.name.trim().toLowerCase() === cleanName);
        }

        if (ing) {
          ing.stock_qty = Number((ing.stock_qty + pi.quantity).toFixed(2));
          if (pi.unit_price > 0) {
            ing.cost_per_unit = pi.unit_price;
          }
          pi.ingredient_id = ing.id;
          updatedIngredients.push(ing);
        } else if (pi.item_name && pi.item_name.trim()) {
          const newIng: Ingredient = {
            id: generateUUID(),
            name: pi.item_name.trim(),
            unit: pi.unit || 'kg',
            cost_per_unit: pi.unit_price || 0,
            stock_qty: pi.quantity,
            low_stock_level: 10
          };
          this.state.ingredients.push(newIng);
          pi.ingredient_id = newIng.id;
          updatedIngredients.push(newIng);
        }
      });
    }

    this.logMutation({
      entity_type: 'purchase',
      entity_id: newPurchase.id,
      action: 'create',
      summary: `Recorded stock purchase from "${newPurchase.vendor_name}" (₹${newPurchase.total_amount.toLocaleString('en-IN')})`,
      details: `Paid: ₹${newPurchase.paid_amount.toLocaleString('en-IN')} • Balance: ₹${newPurchase.balance_amount.toLocaleString('en-IN')}`
    });
    this.save();

    const ops: SqlOperation[] = [
      {
        type: 'upsert',
        table: 'stock_purchases',
        values: this.toStockPurchaseSqlRow(newPurchase),
        onConflict: 'id'
      }
    ];

    for (const ing of updatedIngredients.filter((x) => isValidUUID(x.id))) {
      ops.push({
        type: 'upsert',
        table: 'ingredients',
        values: this.toIngredientSqlRow(ing),
        onConflict: 'id'
      });
    }

    if (purchaseItems.length > 0) {
      ops.push({
        type: 'upsert',
        table: 'stock_purchase_items',
        values: purchaseItems.map((it) => ({
          id: it.id,
          purchase_id: newPurchase.id,
          ingredient_id: isValidUUID(it.ingredient_id) ? it.ingredient_id : null,
          item_name: it.item_name,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          total_price: it.total_price
        })),
        onConflict: 'id'
      });
    }

    if (initialPayment) {
      ops.push({
        type: 'upsert',
        table: 'stock_purchase_payments',
        values: {
          id: initialPayment.id,
          purchase_id: initialPayment.purchase_id,
          amount: initialPayment.amount,
          paid_at: initialPayment.paid_at,
          method: initialPayment.method,
          note: initialPayment.note || null
        },
        onConflict: 'id'
      });
    }

    this.enqueueSqlOperations('Add Stock Purchase', ops);

    return newPurchase;
  }

  public addVendorPayment(
    purchaseId: string,
    payment: {
      amount: number;
      method: string;
      note?: string;
      paid_at?: string;
    }
  ): StockPurchasePayment | null {
    if (!Array.isArray(this.state.stockPurchases)) {
      this.state.stockPurchases = [];
    }
    if (!Array.isArray(this.state.stockPurchasePayments)) {
      this.state.stockPurchasePayments = [];
    }

    const purchase = this.state.stockPurchases.find((p) => p.id === purchaseId);
    if (!purchase) return null;

    const newPayment: StockPurchasePayment = {
      id: generateUUID(),
      purchase_id: purchaseId,
      amount: Number(payment.amount),
      method: payment.method,
      note: payment.note || '',
      paid_at: payment.paid_at || new Date().toISOString()
    };

    this.state.stockPurchasePayments.unshift(newPayment);

    const allPayments = this.state.stockPurchasePayments.filter((p) => p.purchase_id === purchaseId);
    const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

    purchase.paid_amount = totalPaid;
    purchase.balance_amount = Math.max(0, purchase.total_amount - totalPaid);
    purchase.payment_status =
      purchase.balance_amount === 0 ? 'paid' : purchase.paid_amount > 0 ? 'partially_paid' : 'unpaid';

    this.logMutation({
      entity_type: 'purchase',
      entity_id: purchaseId,
      action: 'update',
      summary: `Paid vendor installment ₹${newPayment.amount.toLocaleString('en-IN')} to "${purchase.vendor_name}"`,
      details: `Method: ${newPayment.method} • Remaining Due: ₹${purchase.balance_amount.toLocaleString('en-IN')}`
    });
    this.save();

    if (isValidUUID(purchaseId)) {
      this.enqueueSqlOperations('Record Vendor Payment', [
        ...this.ensurePurchaseParentOps(purchaseId),
        {
          type: 'upsert',
          table: 'stock_purchase_payments',
          values: {
            id: newPayment.id,
            purchase_id: newPayment.purchase_id,
            amount: newPayment.amount,
            method: newPayment.method,
            note: newPayment.note || null,
            paid_at: newPayment.paid_at
          },
          onConflict: 'id'
        }
      ]);
    }

    return newPayment;
  }

  public updateStockPurchase(id: string, updates: Partial<StockPurchase>) {
    if (!Array.isArray(this.state.stockPurchases)) return;
    let updatedPurchase: StockPurchase | undefined;
    this.state.stockPurchases = this.state.stockPurchases.map((p) => {
      if (p.id !== id) return p;
      const total = updates.total_amount !== undefined ? Number(updates.total_amount) : p.total_amount;
      const paid = updates.paid_amount !== undefined ? Number(updates.paid_amount) : p.paid_amount;
      const balance = Math.max(0, total - paid);
      const status: StockPaymentStatus =
        balance === 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid';

      updatedPurchase = {
        ...p,
        ...updates,
        total_amount: total,
        paid_amount: paid,
        balance_amount: balance,
        payment_status: status
      };
      return updatedPurchase;
    });
    if (updatedPurchase) {
      this.logMutation({
        entity_type: 'purchase',
        entity_id: id,
        action: 'update',
        summary: `Updated stock purchase bill from "${updatedPurchase.vendor_name}"`
      });
    }
    this.save();

    if (updatedPurchase && isValidUUID(id)) {
      this.enqueueSqlOperations('Update Stock Purchase', [
        {
          type: 'upsert',
          table: 'stock_purchases',
          values: this.toStockPurchaseSqlRow(updatedPurchase),
          onConflict: 'id'
        }
      ]);
    }
  }

  public deleteStockPurchase(purchaseId: string) {
    const existing = this.state.stockPurchases?.find((p) => p.id === purchaseId);
    if (Array.isArray(this.state.stockPurchases)) {
      this.state.stockPurchases = this.state.stockPurchases.filter((p) => p.id !== purchaseId);
    }
    if (Array.isArray(this.state.stockPurchasePayments)) {
      this.state.stockPurchasePayments = this.state.stockPurchasePayments.filter((p) => p.purchase_id !== purchaseId);
    }
    this.logMutation({
      entity_type: 'purchase',
      entity_id: purchaseId,
      action: 'delete',
      summary: `Deleted stock purchase bill from "${existing?.vendor_name || purchaseId}"`
    });
    this.save();

    if (isValidUUID(purchaseId)) {
      this.enqueueSqlOperations('Delete Stock Purchase', [
        { type: 'delete', table: 'stock_purchase_payments', match: { purchase_id: purchaseId } },
        { type: 'delete', table: 'stock_purchase_items', match: { purchase_id: purchaseId } },
        { type: 'delete', table: 'stock_purchases', match: { id: purchaseId } }
      ]);
    }
  }

  public deleteVendorPayment(paymentId: string) {
    if (!Array.isArray(this.state.stockPurchasePayments)) return;
    const payment = this.state.stockPurchasePayments.find((p) => p.id === paymentId);
    if (!payment) return;
    const purchaseId = payment.purchase_id;

    this.state.stockPurchasePayments = this.state.stockPurchasePayments.filter((p) => p.id !== paymentId);

    const purchase = this.state.stockPurchases?.find((p) => p.id === purchaseId);
    if (purchase) {
      const allPayments = this.state.stockPurchasePayments.filter((p) => p.purchase_id === purchaseId);
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
      purchase.paid_amount = totalPaid;
      purchase.balance_amount = Math.max(0, purchase.total_amount - totalPaid);
      purchase.payment_status =
        purchase.balance_amount === 0 ? 'paid' : purchase.paid_amount > 0 ? 'partially_paid' : 'unpaid';
    }
    this.logMutation({
      entity_type: 'purchase',
      entity_id: purchaseId,
      action: 'update',
      summary: `Removed vendor payment ₹${payment.amount.toLocaleString('en-IN')} from "${purchase?.vendor_name || 'Vendor Bill'}"`
    });
    this.save();

    if (isValidUUID(paymentId)) {
      const ops: SqlOperation[] = [
        { type: 'delete', table: 'stock_purchase_payments', match: { id: paymentId } }
      ];
      if (purchase && isValidUUID(purchaseId)) {
        ops.push({
          type: 'upsert',
          table: 'stock_purchases',
          values: this.toStockPurchaseSqlRow(purchase),
          onConflict: 'id'
        });
      }
      this.enqueueSqlOperations('Delete Vendor Payment', ops);
    }
  }

  // Staff & Shifts
  public addStaff(staff: Omit<StaffMember, 'id'>) {
    const newStaff: StaffMember = { ...staff, id: generateUUID() };
    this.state.staff.push(newStaff);
    this.logMutation({
      entity_type: 'staff',
      entity_id: newStaff.id,
      action: 'create',
      summary: `Registered staff member "${newStaff.name}"`,
      details: `${newStaff.role_title || 'Crew'} • ₹${newStaff.hourly_rate}/hr`
    });
    this.save();

    this.enqueueSqlOperations('Register Staff Member', [
      { type: 'upsert', table: 'staff_members', values: this.toStaffSqlRow(newStaff), onConflict: 'id' }
    ]);

    return newStaff;
  }

  public updateStaff(id: string, updates: Partial<StaffMember>) {
    let updatedStaff: StaffMember | undefined;
    this.state.staff = this.state.staff.map((s) => {
      if (s.id !== id) return s;
      updatedStaff = { ...s, ...updates };
      return updatedStaff;
    });
    if (updatedStaff) {
      this.logMutation({
        entity_type: 'staff',
        entity_id: id,
        action: 'update',
        summary: `Updated staff profile "${updatedStaff.name}"`,
        details: `${updatedStaff.role_title || 'Crew'} • ₹${updatedStaff.hourly_rate}/hr`
      });
    }
    this.save();

    if (updatedStaff && isValidUUID(id)) {
      this.enqueueSqlOperations('Update Staff Member', [
        { type: 'upsert', table: 'staff_members', values: this.toStaffSqlRow(updatedStaff), onConflict: 'id' }
      ]);
    }
  }

  public deleteStaff(id: string) {
    const existing = this.state.staff.find((s) => s.id === id);
    const removedShiftsCount = this.state.shifts.filter((sh) => sh.staff_member_id === id).length;
    const removedSalaryCount = Array.isArray(this.state.staffSalaryRecords)
      ? this.state.staffSalaryRecords.filter((sr) => sr.staff_member_id === id).length
      : 0;

    this.state.staff = this.state.staff.filter((s) => s.id !== id);
    this.state.shifts = this.state.shifts.filter((sh) => sh.staff_member_id !== id);
    if (Array.isArray(this.state.staffSalaryRecords)) {
      this.state.staffSalaryRecords = this.state.staffSalaryRecords.filter(
        (sr) => sr.staff_member_id !== id
      );
    }

    // If the removed staff member happened to hold the active staff session, sign out cleanly
    if (this.state.currentRole === 'staff' && this.state.currentUserId === id) {
      this.state.isAuthenticated = false;
      this.state.currentRole = 'owner';
      this.state.currentUserId = this.state.profiles[0]?.id || INITIAL_PROFILES[0].id;
    }

    this.logMutation({
      entity_type: 'staff',
      entity_id: id,
      action: 'delete',
      summary: `Removed staff member "${existing?.name || id}"`,
      details: `${existing?.role_title || 'Crew'}${existing?.phone ? ` • Phone: ${existing.phone}` : ''} • Cleared ${removedShiftsCount} shift(s) & ${removedSalaryCount} salary entry(s)`
    });
    this.save();

    if (isValidUUID(id)) {
      this.enqueueSqlOperations('Delete Staff Member', [
        { type: 'delete', table: 'staff_salary_records', match: { staff_member_id: id } },
        { type: 'delete', table: 'shifts', match: { staff_member_id: id } },
        { type: 'delete', table: 'staff_members', match: { id } }
      ]);
    }
  }

  public addShift(shift: Omit<Shift, 'id'>) {
    let endsAt = shift.ends_at;
    if (endsAt <= shift.starts_at) {
      const endDate = new Date(endsAt);
      if (!isNaN(endDate.getTime())) {
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        endsAt = endDate.toISOString();
      }
    }

    const staffMember = this.state.staff.find((s) => s.id === shift.staff_member_id);
    const evt = this.state.events.find((e) => e.id === shift.event_id);
    const attendanceStatus: ShiftAttendanceStatus =
      shift.attendance_status === 'present' || shift.attendance_status === 'absent'
        ? shift.attendance_status
        : 'pending';
    const newShift: Shift = {
      ...shift,
      ends_at: endsAt,
      attendance_status: attendanceStatus,
      attendance_marked_at:
        attendanceStatus !== 'pending'
          ? shift.attendance_marked_at || new Date().toISOString()
          : undefined,
      id: generateUUID()
    };
    this.state.shifts.push(newShift);
    this.logMutation({
      entity_type: 'shift',
      entity_id: newShift.id,
      parent_event_id: newShift.event_id,
      action: 'create',
      summary: `Assigned "${staffMember?.name || 'Staff'}" to "${evt?.title || 'Event'}"`,
      details: `Role: ${newShift.role_label || 'Crew'} • ${newShift.starts_at.slice(11, 16)} - ${newShift.ends_at.slice(11, 16)} • Attendance: ${attendanceStatus.toUpperCase()}`
    });
    this.save();

    if (isValidUUID(newShift.event_id) && isValidUUID(newShift.staff_member_id)) {
      this.enqueueSqlOperations('Schedule Staff Shift', [
        ...this.ensureEventParentOps(newShift.event_id),
        ...this.ensureStaffParentOps(newShift.staff_member_id),
        {
          type: 'upsert',
          table: 'shifts',
          values: {
            id: newShift.id,
            event_id: newShift.event_id,
            staff_member_id: newShift.staff_member_id,
            role_label: newShift.role_label || null,
            starts_at: newShift.starts_at,
            ends_at: newShift.ends_at,
            attendance_status: newShift.attendance_status || 'pending',
            attendance_marked_at: newShift.attendance_marked_at || null
          },
          onConflict: 'id'
        }
      ]);
    }

    return newShift;
  }

  public updateShiftAttendance(shiftId: string, status: ShiftAttendanceStatus) {
    let updatedShift: Shift | undefined;
    const markedAt = status === 'pending' ? undefined : new Date().toISOString();

    this.state.shifts = this.state.shifts.map((sh) => {
      if (sh.id !== shiftId) return sh;
      updatedShift = {
        ...sh,
        attendance_status: status,
        attendance_marked_at: markedAt
      };
      return updatedShift;
    });

    if (!updatedShift) return;

    const staffMember = this.state.staff.find((s) => s.id === updatedShift!.staff_member_id);
    const evt = this.state.events.find((e) => e.id === updatedShift!.event_id);
    const statusLabel =
      status === 'present' ? 'PRESENT (Attended)' : status === 'absent' ? 'ABSENT' : 'PENDING';

    this.logMutation({
      entity_type: 'shift',
      entity_id: shiftId,
      parent_event_id: updatedShift.event_id,
      action: 'update',
      summary: `Marked attendance ${statusLabel} for "${staffMember?.name || 'Staff'}" on "${evt?.title || 'Event'}"`
    });
    this.save();

    if (
      isValidUUID(updatedShift.id) &&
      isValidUUID(updatedShift.event_id) &&
      isValidUUID(updatedShift.staff_member_id)
    ) {
      this.enqueueSqlOperations('Update Shift Attendance', [
        ...this.ensureEventParentOps(updatedShift.event_id),
        ...this.ensureStaffParentOps(updatedShift.staff_member_id),
        {
          type: 'upsert',
          table: 'shifts',
          values: {
            id: updatedShift.id,
            event_id: updatedShift.event_id,
            staff_member_id: updatedShift.staff_member_id,
            role_label: updatedShift.role_label || null,
            starts_at: updatedShift.starts_at,
            ends_at: updatedShift.ends_at,
            attendance_status: updatedShift.attendance_status || 'pending',
            attendance_marked_at: updatedShift.attendance_marked_at || null
          },
          onConflict: 'id'
        }
      ]);
    }
  }

  public markEventShiftsAttendance(eventId: string, status: ShiftAttendanceStatus) {
    const markedAt = status === 'pending' ? undefined : new Date().toISOString();
    const updatedShifts: Shift[] = [];

    this.state.shifts = this.state.shifts.map((sh) => {
      if (sh.event_id !== eventId) return sh;
      const next: Shift = {
        ...sh,
        attendance_status: status,
        attendance_marked_at: markedAt
      };
      updatedShifts.push(next);
      return next;
    });

    if (updatedShifts.length === 0) return;

    const evt = this.state.events.find((e) => e.id === eventId);
    this.logMutation({
      entity_type: 'shift',
      entity_id: eventId,
      parent_event_id: eventId,
      action: 'update',
      summary: `Marked all ${updatedShifts.length} shifts ${status.toUpperCase()} for "${evt?.title || 'Event'}"`
    });
    this.save();

    const ops: SqlOperation[] = [...this.ensureEventParentOps(eventId)];
    for (const sh of updatedShifts) {
      if (isValidUUID(sh.id) && isValidUUID(sh.staff_member_id)) {
        ops.push(...this.ensureStaffParentOps(sh.staff_member_id));
        ops.push({
          type: 'upsert',
          table: 'shifts',
          values: {
            id: sh.id,
            event_id: sh.event_id,
            staff_member_id: sh.staff_member_id,
            role_label: sh.role_label || null,
            starts_at: sh.starts_at,
            ends_at: sh.ends_at,
            attendance_status: sh.attendance_status || 'pending',
            attendance_marked_at: sh.attendance_marked_at || null
          },
          onConflict: 'id'
        });
      }
    }
    this.enqueueSqlOperations('Bulk Update Event Shift Attendance', ops);
  }

  public removeShift(id: string) {
    const existingShift = this.state.shifts.find((sh) => sh.id === id);
    const staffMember = existingShift
      ? this.state.staff.find((s) => s.id === existingShift.staff_member_id)
      : undefined;
    const evt = existingShift
      ? this.state.events.find((e) => e.id === existingShift.event_id)
      : undefined;

    this.state.shifts = this.state.shifts.filter((sh) => sh.id !== id);
    this.logMutation({
      entity_type: 'shift',
      entity_id: id,
      parent_event_id: existingShift?.event_id,
      action: 'delete',
      summary: `Removed shift for "${staffMember?.name || 'Staff'}" on "${evt?.title || 'Event'}"`
    });
    this.save();

    if (isValidUUID(id)) {
      this.enqueueSqlOperations('Remove Staff Shift', [
        { type: 'delete', table: 'shifts', match: { id } }
      ]);
    }
  }

  // Staff Salary & Wage Management — STRICTLY Attendance-Gated (only 'present' shifts earn pay!)
  public calculateShiftHours(startsAt: string, endsAt: string): number {
    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      const diffHrs = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      if (diffHrs > 0) {
        return Number(diffHrs.toFixed(2));
      }
      if (diffHrs < 0) {
        return Number((24 + diffHrs).toFixed(2));
      }
    }
    const startH = parseInt((startsAt || '').slice(11, 13) || '17', 10);
    const startM = parseInt((startsAt || '').slice(14, 16) || '0', 10);
    const endH = parseInt((endsAt || '').slice(11, 13) || '23', 10);
    const endM = parseInt((endsAt || '').slice(14, 16) || '0', 10);
    const startTotal = startH + startM / 60;
    const endTotal = endH + endM / 60;
    const hrs = endTotal >= startTotal ? endTotal - startTotal : 24 - startTotal + endTotal;
    return Math.max(1, Number(hrs.toFixed(2)));
  }

  public getStaffSalarySummary(staffId: string): StaffSalarySummary {
    const staffMember = this.state.staff.find((s) => s.id === staffId);
    const hourlyRate = Number(staffMember?.hourly_rate || 0);

    const shiftItems: StaffShiftEarningItem[] = this.state.shifts
      .filter((sh) => sh.staff_member_id === staffId)
      .map((sh) => {
        const event = this.state.events.find((e) => e.id === sh.event_id);
        const hours = this.calculateShiftHours(sh.starts_at, sh.ends_at);
        const attendanceStatus: ShiftAttendanceStatus =
          sh.attendance_status === 'present' || sh.attendance_status === 'absent'
            ? sh.attendance_status
            : 'pending';
        const isAttended = attendanceStatus === 'present' && event?.status !== 'cancelled';
        // CRITICAL: Only count and expose shift pay when the staff member actually attended ('present')
        const earnedAmount = isAttended ? Math.round(hours * hourlyRate) : 0;
        return {
          shift: sh,
          event,
          hours,
          hourlyRate,
          attendanceStatus,
          isAttended,
          earnedAmount
        };
      })
      .filter((item) => !item.event || item.event.status !== 'cancelled')
      .sort((a, b) => (b.event?.event_date || '').localeCompare(a.event?.event_date || ''));

    const attendedShiftsCount = shiftItems.filter((item) => item.attendanceStatus === 'present').length;
    const absentShiftsCount = shiftItems.filter((item) => item.attendanceStatus === 'absent').length;
    const pendingShiftsCount = shiftItems.filter((item) => item.attendanceStatus === 'pending').length;

    const totalShiftHours = Number(
      shiftItems
        .filter((item) => item.isAttended)
        .reduce((sum, item) => sum + item.hours, 0)
        .toFixed(2)
    );
    const shiftEarnings = shiftItems.reduce((sum, item) => sum + item.earnedAmount, 0);

    const allRecords = (this.state.staffSalaryRecords || []).filter(
      (sr) => sr.staff_member_id === staffId
    );

    const earningRecords = allRecords
      .filter((sr) => sr.record_type === 'earning')
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));

    const paymentRecords = allRecords
      .filter((sr) => sr.record_type === 'payment')
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));

    const extraEarnings = earningRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const totalEarned = shiftEarnings + extraEarnings;
    const totalPaid = paymentRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const balancePayable = Math.max(0, totalEarned - totalPaid);
    const advanceExcess = Math.max(0, totalPaid - totalEarned);

    return {
      staffId,
      shiftItems,
      attendedShiftsCount,
      absentShiftsCount,
      pendingShiftsCount,
      totalShiftHours,
      shiftEarnings,
      extraEarnings,
      totalEarned,
      totalPaid,
      balancePayable,
      advanceExcess,
      paymentRecords,
      earningRecords
    };
  }

  public addStaffSalaryRecord(record: {
    staff_member_id: string;
    event_id?: string;
    record_type: StaffSalaryRecordType;
    amount: number;
    method: string;
    note?: string;
    recorded_at?: string;
  }): StaffSalaryRecord {
    const newRecord: StaffSalaryRecord = {
      id: generateUUID(),
      staff_member_id: record.staff_member_id,
      event_id: record.event_id || undefined,
      record_type: record.record_type,
      amount: Number(record.amount || 0),
      method: record.method || 'Cash',
      note: (record.note || '').trim(),
      recorded_at: record.recorded_at || new Date().toISOString()
    };

    if (!Array.isArray(this.state.staffSalaryRecords)) {
      this.state.staffSalaryRecords = [];
    }
    const staffMember = this.state.staff.find((s) => s.id === newRecord.staff_member_id);
    this.state.staffSalaryRecords.unshift(newRecord);
    this.logMutation({
      entity_type: 'salary',
      entity_id: newRecord.id,
      parent_event_id: newRecord.event_id,
      action: 'create',
      summary:
        newRecord.record_type === 'payment'
          ? `Recorded salary payment ₹${newRecord.amount.toLocaleString('en-IN')} to "${staffMember?.name || 'Staff'}"`
          : `Added duty wage/allowance ₹${newRecord.amount.toLocaleString('en-IN')} for "${staffMember?.name || 'Staff'}"`,
      details: `${newRecord.method}${newRecord.note ? ` • ${newRecord.note}` : ''}`
    });
    this.save();

    if (isValidUUID(newRecord.staff_member_id)) {
      const ops: SqlOperation[] = [...this.ensureStaffParentOps(newRecord.staff_member_id)];
      if (newRecord.event_id && isValidUUID(newRecord.event_id)) {
        ops.push(...this.ensureEventParentOps(newRecord.event_id));
      }
      ops.push({
        type: 'upsert',
        table: 'staff_salary_records',
        values: {
          id: newRecord.id,
          staff_member_id: newRecord.staff_member_id,
          event_id: isValidUUID(newRecord.event_id) ? newRecord.event_id : null,
          record_type: newRecord.record_type,
          amount: newRecord.amount,
          method: newRecord.method,
          note: newRecord.note || null,
          recorded_at: newRecord.recorded_at
        },
        onConflict: 'id'
      });
      this.enqueueSqlOperations('Save Staff Salary Record', ops);
    }

    return newRecord;
  }

  public deleteStaffSalaryRecord(id: string) {
    if (!Array.isArray(this.state.staffSalaryRecords)) return;
    const existing = this.state.staffSalaryRecords.find((sr) => sr.id === id);
    const staffMember = existing
      ? this.state.staff.find((s) => s.id === existing.staff_member_id)
      : undefined;
    this.state.staffSalaryRecords = this.state.staffSalaryRecords.filter((sr) => sr.id !== id);
    this.logMutation({
      entity_type: 'salary',
      entity_id: id,
      parent_event_id: existing?.event_id,
      action: 'delete',
      summary: `Deleted salary record (₹${(existing?.amount || 0).toLocaleString('en-IN')}) for "${staffMember?.name || 'Staff'}"`
    });
    this.save();

    if (isValidUUID(id)) {
      this.enqueueSqlOperations('Delete Staff Salary Record', [
        { type: 'delete', table: 'staff_salary_records', match: { id } }
      ]);
    }
  }

  public getInvoiceAudit(invoiceId: string): AuditLogEntry | undefined {
    const paymentIds = new Set(
      this.state.payments.filter((p) => p.invoice_id === invoiceId).map((p) => p.id)
    );
    return (this.state.auditLogs || []).find(
      (l) => l.entity_id === invoiceId || paymentIds.has(l.entity_id)
    );
  }

  // Invoices & Part-Payments on Same Invoice
  public addInvoice(inv: {
    event_id: string;
    kind: 'deposit' | 'final';
    subtotal: number;
    discount?: number;
    amount?: number;
    due_date?: string;
    status?: Invoice['status'];
    notes?: string;
  }) {
    const evt = this.state.events.find((e) => e.id === inv.event_id);
    const maxExistingSeq = this.state.invoices.reduce((maxN, item) => {
      const m = (item.invoice_number || '').match(/INV-(\d+)/i);
      const n = m ? parseInt(m[1], 10) : 0;
      return n > maxN ? n : maxN;
    }, this.state.invoices.length);
    const seq = maxExistingSeq + 1;
    const invoice_number = 'INV-' + String(seq).padStart(4, '0');
    const subtotal = Number(inv.subtotal || 0);
    const discount = Number(inv.discount || 0);
    const amount = Math.max(0, subtotal - discount);

    const newInv: Invoice = {
      id: generateUUID(),
      event_id: inv.event_id,
      invoice_number,
      kind: inv.kind,
      subtotal,
      discount,
      amount,
      due_date: inv.due_date || '',
      status: inv.status || 'draft',
      notes: inv.notes || '',
      created_at: new Date().toISOString()
    };
    this.state.invoices.unshift(newInv);
    this.logMutation({
      entity_type: 'invoice',
      entity_id: newInv.id,
      parent_event_id: newInv.event_id,
      action: 'create',
      summary: `Created ${newInv.kind === 'deposit' ? 'Advance' : 'Final'} Invoice ${newInv.invoice_number} (₹${newInv.amount.toLocaleString('en-IN')})`,
      details: `Event: ${evt?.title || 'Event'}${newInv.discount > 0 ? ` • Discount: ₹${newInv.discount.toLocaleString('en-IN')}` : ''}`
    });
    this.save();

    if (isValidUUID(newInv.event_id)) {
      this.enqueueSqlOperations('Create Invoice', [
        ...this.ensureEventParentOps(newInv.event_id),
        { type: 'upsert', table: 'invoices', values: this.toInvoiceSqlRow(newInv), onConflict: 'id' }
      ]);
    }

    return newInv;
  }

  public updateInvoice(id: string, updates: Partial<Invoice>) {
    let updatedInv: Invoice | undefined;
    this.state.invoices = this.state.invoices.map((inv) => {
      if (inv.id !== id) return inv;
      const subtotal = updates.subtotal !== undefined ? Number(updates.subtotal) : inv.subtotal ?? inv.amount;
      const discount = updates.discount !== undefined ? Number(updates.discount) : inv.discount ?? 0;
      const amount = Math.max(0, subtotal - discount);
      updatedInv = { ...inv, ...updates, subtotal, discount, amount };
      return updatedInv;
    });
    if (updatedInv) {
      const evt = this.state.events.find((e) => e.id === updatedInv!.event_id);
      this.logMutation({
        entity_type: 'invoice',
        entity_id: id,
        parent_event_id: updatedInv.event_id,
        action: 'update',
        summary: `Edited Invoice ${updatedInv.invoice_number} (₹${updatedInv.amount.toLocaleString('en-IN')})`,
        details: `Event: ${evt?.title || 'Event'} • Discount: ₹${updatedInv.discount.toLocaleString('en-IN')} • Status: ${updatedInv.status}`
      });
    }
    this.save();

    if (updatedInv && isValidUUID(id) && isValidUUID(updatedInv.event_id)) {
      this.enqueueSqlOperations('Update Invoice', [
        ...this.ensureEventParentOps(updatedInv.event_id),
        { type: 'upsert', table: 'invoices', values: this.toInvoiceSqlRow(updatedInv), onConflict: 'id' }
      ]);
    }
  }

  public deleteInvoice(id: string) {
    const existing = this.state.invoices.find((inv) => inv.id === id);
    this.state.invoices = this.state.invoices.filter((inv) => inv.id !== id);
    this.state.payments = this.state.payments.filter((p) => p.invoice_id !== id);
    this.logMutation({
      entity_type: 'invoice',
      entity_id: id,
      parent_event_id: existing?.event_id,
      action: 'delete',
      summary: `Deleted Invoice ${existing?.invoice_number || id}`
    });
    this.save();

    if (isValidUUID(id)) {
      this.enqueueSqlOperations('Delete Invoice', [
        { type: 'delete', table: 'payments', match: { invoice_id: id } },
        { type: 'delete', table: 'invoices', match: { id } }
      ]);
    }
  }

  public inferPaymentChannel(method?: string, explicitChannel?: PaymentChannel): PaymentChannel {
    if (explicitChannel === 'cash' || explicitChannel === 'bank') return explicitChannel;
    if ((method || '').toLowerCase().includes('cash')) return 'cash';
    return 'bank';
  }

  public getDefaultDestinationAccount(channel: PaymentChannel, method?: string): string {
    if (channel === 'cash') {
      return 'Cash in Hand (Office Counter)';
    }
    const s = this.state.settings;
    const primaryBank = (s.bank_name || 'Federal Bank').split('/')[0].trim();
    const accSuffix = s.account_number ? ` (A/c ${s.account_number})` : '';
    const m = (method || '').toLowerCase();
    if ((m.includes('upi') || m.includes('gpay') || m.includes('phonepe')) && s.upi_id) {
      return `${primaryBank} — UPI (${s.upi_id})`;
    }
    return `${primaryBank}${accSuffix}`;
  }

  public resolveDestinationAccount(
    payment: Pick<Payment, 'method' | 'payment_channel' | 'destination_account'>
  ): string {
    if (payment.destination_account && payment.destination_account.trim()) {
      return payment.destination_account.trim();
    }
    const ch = this.inferPaymentChannel(payment.method, payment.payment_channel);
    return this.getDefaultDestinationAccount(ch, payment.method);
  }

  public getPresetPaymentAccounts(channel?: PaymentChannel): { label: string; channel: PaymentChannel }[] {
    const s = this.state.settings;
    const primaryBank = (s.bank_name || 'Federal Bank').split('/')[0].trim();
    const accSuffix = s.account_number ? ` (A/c ${s.account_number})` : '';

    const items: { label: string; channel: PaymentChannel }[] = [
      { label: `${primaryBank}${accSuffix}`, channel: 'bank' }
    ];

    if (s.upi_id) {
      items.push({ label: `${primaryBank} — UPI (${s.upi_id})`, channel: 'bank' });
    }
    items.push(
      { label: 'State Bank of India (Current A/c)', channel: 'bank' },
      { label: 'HDFC Bank (Business A/c)', channel: 'bank' },
      { label: 'Cash in Hand (Office Counter)', channel: 'cash' },
      { label: 'Owner Cash Locker', channel: 'cash' },
      { label: 'Petty Cash Box', channel: 'cash' }
    );

    // Include any custom destination accounts previously recorded
    for (const p of this.state.payments) {
      const ch = this.inferPaymentChannel(p.method, p.payment_channel);
      const acc = (p.destination_account || '').trim();
      if (acc && !items.some((x) => x.label.toLowerCase() === acc.toLowerCase())) {
        items.push({ label: acc, channel: ch });
      }
    }

    return channel ? items.filter((i) => i.channel === channel) : items;
  }

  public getInvoiceCollectionsBreakdown(eventId?: string): InvoiceCollectionsBreakdown {
    const relevantInvoices = eventId
      ? this.state.invoices.filter((inv) => inv.event_id === eventId && inv.status !== 'void')
      : this.state.invoices.filter((inv) => inv.status !== 'void');

    const invoiceIdSet = new Set(relevantInvoices.map((inv) => inv.id));
    const relevantPayments = this.state.payments.filter((p) => invoiceIdSet.has(p.invoice_id));

    const totalInvoiced = relevantInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const totalCollected = relevantPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPendingReceivable = Math.max(0, totalInvoiced - totalCollected);

    let totalBankReceived = 0;
    let totalCashReceived = 0;
    let bankPaymentCount = 0;
    let cashPaymentCount = 0;

    const holdingsMap = new Map<string, InvoiceAccountHolding>();

    for (const p of relevantPayments) {
      const amt = Number(p.amount || 0);
      const ch = this.inferPaymentChannel(p.method, p.payment_channel);
      const accName = this.resolveDestinationAccount(p);

      if (ch === 'cash') {
        totalCashReceived += amt;
        cashPaymentCount += 1;
      } else {
        totalBankReceived += amt;
        bankPaymentCount += 1;
      }

      const key = `${ch}::${accName.toLowerCase()}`;
      const existing = holdingsMap.get(key);
      if (existing) {
        existing.totalReceived += amt;
        existing.paymentCount += 1;
        if ((p.paid_at || '') > existing.lastReceivedAt) {
          existing.lastReceivedAt = p.paid_at;
        }
      } else {
        holdingsMap.set(key, {
          accountName: accName,
          channel: ch,
          totalReceived: amt,
          paymentCount: 1,
          lastReceivedAt: p.paid_at || ''
        });
      }
    }

    const accountHoldings = Array.from(holdingsMap.values()).sort(
      (a, b) => b.totalReceived - a.totalReceived
    );

    return {
      totalInvoiced,
      totalCollected,
      totalPendingReceivable,
      totalBankReceived,
      totalCashReceived,
      bankPaymentCount,
      cashPaymentCount,
      accountHoldings
    };
  }

  // Record Part-Payment directly against the same invoice (with Bank vs Cash & Destination Account)
  public addPayment(payment: {
    invoice_id: string;
    amount: number;
    method: string;
    payment_channel?: PaymentChannel;
    destination_account?: string;
    note?: string;
  }) {
    const channel = this.inferPaymentChannel(payment.method, payment.payment_channel);
    const destinationAccount =
      payment.destination_account && payment.destination_account.trim()
        ? payment.destination_account.trim()
        : this.getDefaultDestinationAccount(channel, payment.method);

    const newPayment: Payment = {
      id: generateUUID(),
      invoice_id: payment.invoice_id,
      amount: Number(payment.amount),
      method: payment.method,
      payment_channel: channel,
      destination_account: destinationAccount,
      note: payment.note || '',
      paid_at: new Date().toISOString()
    };
    this.state.payments.unshift(newPayment);

    const invoice = this.state.invoices.find((i) => i.id === payment.invoice_id);
    if (invoice) {
      const allPaymentsForInv = this.state.payments
        .filter((p) => p.invoice_id === invoice.id)
        .reduce((sum, p) => sum + p.amount, 0);

      if (allPaymentsForInv >= invoice.amount) {
        invoice.status = 'paid';
      } else if (allPaymentsForInv > 0) {
        invoice.status = 'partially_paid';
      }
    }
    this.logMutation({
      entity_type: 'payment',
      entity_id: newPayment.id,
      parent_event_id: invoice?.event_id,
      action: 'create',
      summary: `Recorded ${channel.toUpperCase()} payment ₹${newPayment.amount.toLocaleString('en-IN')} on ${invoice?.invoice_number || 'Invoice'}`,
      details: `Account: ${destinationAccount} • Mode: ${newPayment.method}${newPayment.note ? ` • ${newPayment.note}` : ''}`
    });
    this.save();

    if (isValidUUID(newPayment.invoice_id)) {
      this.enqueueSqlOperations('Record Invoice Payment', [
        ...this.ensureInvoiceParentOps(newPayment.invoice_id),
        {
          type: 'upsert',
          table: 'payments',
          values: {
            id: newPayment.id,
            invoice_id: newPayment.invoice_id,
            amount: newPayment.amount,
            method: newPayment.method,
            payment_channel: newPayment.payment_channel,
            destination_account: newPayment.destination_account,
            note: newPayment.note || null,
            paid_at: newPayment.paid_at
          },
          onConflict: 'id'
        }
      ]);
    }

    return newPayment;
  }

  public deletePayment(paymentId: string) {
    const payment = this.state.payments.find((p) => p.id === paymentId);
    if (!payment) return;
    const invId = payment.invoice_id;
    this.state.payments = this.state.payments.filter((p) => p.id !== paymentId);

    const invoice = this.state.invoices.find((i) => i.id === invId);
    if (invoice) {
      const allPaymentsForInv = this.state.payments
        .filter((p) => p.invoice_id === invoice.id)
        .reduce((sum, p) => sum + p.amount, 0);

      if (allPaymentsForInv >= invoice.amount) {
        invoice.status = 'paid';
      } else if (allPaymentsForInv > 0) {
        invoice.status = 'partially_paid';
      } else {
        invoice.status = 'sent';
      }
    }
    this.logMutation({
      entity_type: 'payment',
      entity_id: paymentId,
      parent_event_id: invoice?.event_id,
      action: 'delete',
      summary: `Deleted payment ₹${payment.amount.toLocaleString('en-IN')} from ${invoice?.invoice_number || 'Invoice'}`
    });
    this.save();

    if (isValidUUID(paymentId)) {
      const ops: SqlOperation[] = [
        { type: 'delete', table: 'payments', match: { id: paymentId } }
      ];
      if (invoice && isValidUUID(invoice.id)) {
        ops.push({
          type: 'upsert',
          table: 'invoices',
          values: this.toInvoiceSqlRow(invoice),
          onConflict: 'id'
        });
      }
      this.enqueueSqlOperations('Delete Invoice Payment', ops);
    }
  }

  // Settings
  public updateSettings(updates: Partial<BusinessSettings>) {
    this.state.settings = { ...this.state.settings, ...updates };
    this.logMutation({
      entity_type: 'settings',
      entity_id: String(this.state.settings.id || 1),
      action: 'update',
      summary: 'Updated business profile, bank details, or auto-email settings'
    });
    this.save();

    const s = this.state.settings;
    this.enqueueSqlOperations('Update Business Settings', [
      {
        type: 'upsert',
        table: 'business_settings',
        values: {
          id: 1,
          name: s.name,
          address: s.address || null,
          phone: s.phone || null,
          email: s.email || null,
          bank_name: s.bank_name || null,
          account_name: s.account_name || null,
          account_number: s.account_number || null,
          ifsc_code: s.ifsc_code || null,
          upi_id: s.upi_id || null,
          payment_terms: s.payment_terms || null,
          auto_email_invoices: s.auto_email_invoices !== false,
          invoice_notification_email: s.invoice_notification_email || 'ippasevents@gmail.com'
        },
        onConflict: 'id'
      }
    ]);
  }

  // Event Totals: supports per_guest and per_kg
  public getEventTotal(eventId: string): { menuTotal: number; extrasTotal: number; grandTotal: number } {
    const event = this.state.events.find((e) => e.id === eventId);
    if (!event) return { menuTotal: 0, extrasTotal: 0, grandTotal: 0 };
    const items = this.state.eventItems.filter((i) => i.event_id === eventId);

    let menuTotal = 0;
    items.forEach((item) => {
      const unitRate = Number(item.price_per_unit || item.price_per_guest || 0);
      if (item.pricing_type === 'per_kg') {
        const kgQty = Number(item.quantity !== undefined ? item.quantity : 1);
        menuTotal += unitRate * kgQty;
      } else {
        const paxQty = Number(item.quantity !== undefined ? item.quantity : event.guest_count);
        menuTotal += unitRate * paxQty;
      }
    });

    const extrasTotal = this.state.eventExtras
      .filter((x) => x.event_id === eventId)
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

    return {
      menuTotal,
      extrasTotal,
      grandTotal: menuTotal + extrasTotal
    };
  }

  // Automatic Stock Estimation for an Event
  public getEventStockEstimation(eventId: string): {
    items: StockEstimationItem[];
    totalEstimatedCost: number;
    totalShortageCount: number;
  } {
    const event = this.state.events.find((e) => e.id === eventId);
    if (!event) {
      return { items: [], totalEstimatedCost: 0, totalShortageCount: 0 };
    }

    const eventItems = this.state.eventItems.filter((ei) => ei.event_id === eventId);
    const ingredientMap: Record<
      string,
      {
        needed: number;
        ingredient: Ingredient;
        dishes: Set<string>;
      }
    > = {};

    eventItems.forEach((ei) => {
      const menuItem = this.state.menuItems.find((m) => m.id === ei.menu_item_id);
      const dishName = menuItem ? menuItem.name : 'Unknown Dish';
      const recipes = this.state.recipes.filter((r) => r.menu_item_id === ei.menu_item_id);

      const multiplier =
        ei.pricing_type === 'per_kg'
          ? Number(ei.quantity !== undefined ? ei.quantity : 1)
          : Number(ei.quantity !== undefined ? ei.quantity : event.guest_count);

      recipes.forEach((r) => {
        const ing = this.state.ingredients.find((i) => i.id === r.ingredient_id);
        if (ing) {
          if (!ingredientMap[ing.id]) {
            ingredientMap[ing.id] = {
              needed: 0,
              ingredient: ing,
              dishes: new Set()
            };
          }
          ingredientMap[ing.id].needed += r.qty_per_guest * multiplier;
          ingredientMap[ing.id].dishes.add(dishName);
        }
      });
    });

    let totalEstimatedCost = 0;
    let totalShortageCount = 0;

    const items: StockEstimationItem[] = Object.values(ingredientMap).map((entry) => {
      const currentStock = entry.ingredient.stock_qty;
      const qtyNeeded = Number(entry.needed.toFixed(2));
      const shortageQty = Math.max(0, Number((qtyNeeded - currentStock).toFixed(2)));
      const isShortage = shortageQty > 0;
      const estimatedCost = Math.round(shortageQty * entry.ingredient.cost_per_unit);

      if (isShortage) {
        totalShortageCount++;
        totalEstimatedCost += estimatedCost;
      }

      return {
        ingredientId: entry.ingredient.id,
        ingredientName: entry.ingredient.name,
        unit: entry.ingredient.unit,
        costPerUnit: entry.ingredient.cost_per_unit,
        qtyNeeded,
        currentStock,
        shortageQty,
        estimatedCost,
        isShortage,
        contributingDishes: Array.from(entry.dishes)
      };
    });

    items.sort((a, b) => {
      if (a.isShortage && !b.isShortage) return -1;
      if (!a.isShortage && b.isShortage) return 1;
      return a.ingredientName.localeCompare(b.ingredientName);
    });

    return {
      items,
      totalEstimatedCost,
      totalShortageCount
    };
  }
}

export const store = new DataStore();
