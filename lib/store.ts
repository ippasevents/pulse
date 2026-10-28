'use client';

import { supabase, isSupabaseConfigured } from './supabase';
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
  Invoice,
  Payment,
  BusinessSettings,
  Profile,
  UserRole,
  PricingType,
  StockPurchase,
  StockPurchaseItem,
  StockPurchasePayment,
  StockPaymentStatus
} from './types';

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
  payment_terms: 'Payment strictly due within 3 days. 50% advance deposit upon booking confirmation.'
};

const INITIAL_PROFILES: Profile[] = [
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
  { id: '00000000-0000-4000-8000-000000000801', event_id: '00000000-0000-4000-8000-000000000401', staff_member_id: '00000000-0000-4000-8000-000000000701', role_label: 'Captain', starts_at: '2026-11-12T16:00:00Z', ends_at: '2026-11-12T23:30:00Z' },
  { id: '00000000-0000-4000-8000-000000000802', event_id: '00000000-0000-4000-8000-000000000401', staff_member_id: '00000000-0000-4000-8000-000000000702', role_label: 'Head Cook', starts_at: '2026-11-12T14:00:00Z', ends_at: '2026-11-12T22:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000803', event_id: '00000000-0000-4000-8000-000000000401', staff_member_id: '00000000-0000-4000-8000-000000000703', role_label: 'Server', starts_at: '2026-11-12T17:30:00Z', ends_at: '2026-11-12T23:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000804', event_id: '00000000-0000-4000-8000-000000000401', staff_member_id: '00000000-0000-4000-8000-000000000704', role_label: 'Server', starts_at: '2026-11-12T17:30:00Z', ends_at: '2026-11-12T23:00:00Z' }
];

const INITIAL_INVOICES: Invoice[] = [
  { id: '00000000-0000-4000-8000-000000000901', event_id: '00000000-0000-4000-8000-000000000401', invoice_number: 'INV-0001', kind: 'deposit', subtotal: 100000, discount: 0, amount: 100000, due_date: '2026-10-15', status: 'paid', created_at: '2026-10-03T10:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000902', event_id: '00000000-0000-4000-8000-000000000401', invoice_number: 'INV-0002', kind: 'final', subtotal: 197000, discount: 10000, amount: 187000, due_date: '2026-11-14', status: 'sent', created_at: '2026-10-25T11:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000903', event_id: '00000000-0000-4000-8000-000000000402', invoice_number: 'INV-0003', kind: 'deposit', subtotal: 40000, discount: 0, amount: 40000, due_date: '2026-11-05', status: 'draft', created_at: '2026-10-20T16:00:00Z' }
];

const INITIAL_PAYMENTS: Payment[] = [
  { id: '00000000-0000-4000-8000-000000001001', invoice_id: '00000000-0000-4000-8000-000000000901', amount: 100000, method: 'Bank Transfer (Federal Bank)', note: 'Advance booking deposit', paid_at: '2026-10-12T14:15:00Z' }
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

interface AppState {
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
  invoices: Invoice[];
  payments: Payment[];
  stockPurchases: StockPurchase[];
  stockPurchasePayments: StockPurchasePayment[];
}

const STORAGE_KEY = 'ippas_catering_manager_state';
const SESSION_KEY = 'ippas_catering_auth_session';

class DataStore {
  private state: AppState;
  private listeners: Set<() => void> = new Set();
  private syncError: string | null = null;
  private isSyncingState: boolean = false;

  constructor() {
    this.state = this.loadInitial();
    if (typeof window !== 'undefined' && isSupabaseConfigured && supabase) {
      this.syncFromSupabase();
    }
  }

  public getSyncStatus(): { isSyncing: boolean; error: string | null } {
    return { isSyncing: this.isSyncingState, error: this.syncError };
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

  private notify() {
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

  public async syncFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    this.isSyncingState = true;
    this.notify();

    try {
      const [
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
        invoicesRes,
        paymentsRes,
        purchasesRes,
        purchaseItemsRes,
        purchasePaymentsRes
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
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('paid_at', { ascending: false }),
        supabase.from('stock_purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('stock_purchase_items').select('*'),
        supabase.from('stock_purchase_payments').select('*').order('paid_at', { ascending: false })
      ]);

      // Surface schema/RLS errors clearly so user knows if migration_06.sql hasn't been run
      const firstCriticalErr =
        clientsRes.error ||
        eventsRes.error ||
        menuItemsRes.error ||
        ingredientsRes.error ||
        invoicesRes.error;

      if (firstCriticalErr) {
        this.reportDbError('Database Read Error (Run migration_06.sql in Supabase)', firstCriticalErr);
        this.isSyncingState = false;
        this.notify();
        return;
      }

      if (purchasesRes.error) {
        this.reportDbError('Stock Purchases Table Missing (Run migration_06.sql in Supabase)', purchasesRes.error);
      } else {
        this.clearDbError();
      }

      // Seed default profiles & settings into Supabase if profiles table has no login accounts yet
      let rawProfiles = profilesRes.data || [];
      const usableProfiles = rawProfiles.filter(
        (p: any) => p.role === 'owner' || p.role === 'manager' || p.role === 'accountant'
      );

      if (!profilesRes.error && usableProfiles.length === 0) {
        const seedRes = await supabase.from('profiles').upsert(
          INITIAL_PROFILES.map((p) => ({
            id: p.id,
            username: p.username,
            password: p.password,
            full_name: p.full_name,
            role: p.role,
            phone: p.phone || null
          })),
          { onConflict: 'id' }
        );
        if (!seedRes.error) {
          rawProfiles = INITIAL_PROFILES;
        }
      }

      if (!settingsRes.error && !settingsRes.data) {
        await supabase.from('business_settings').upsert(INITIAL_SETTINGS, { onConflict: 'id' });
      }

      const loadedProfiles: Profile[] =
        usableProfiles.length > 0
          ? usableProfiles.map((p: any) => {
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
            })
          : this.state.profiles;

      const purchaseItemsData = purchaseItemsRes.data || [];
      const loadedPurchases: StockPurchase[] = !purchasesRes.error
        ? (purchasesRes.data || []).map((sp: any) => {
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
        : this.state.stockPurchases;

      const loadedPurchasePayments: StockPurchasePayment[] = !purchasePaymentsRes.error
        ? (purchasePaymentsRes.data || []).map((spp: any) => ({
            id: spp.id,
            purchase_id: spp.purchase_id,
            amount: Number(spp.amount || 0),
            paid_at: spp.paid_at,
            method: spp.method || 'Cash',
            note: spp.note || ''
          }))
        : this.state.stockPurchasePayments;

      this.state = {
        ...this.state,
        settings: settingsRes.data
          ? { ...INITIAL_SETTINGS, ...settingsRes.data }
          : this.state.settings,
        profiles: loadedProfiles,
        clients: (clientsRes.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email || '',
          phone: c.phone || '',
          company: c.company || '',
          notes: c.notes || '',
          created_at: c.created_at || new Date().toISOString()
        })),
        ingredients: (ingredientsRes.data || []).map((i: any) => ({
          id: i.id,
          name: i.name,
          unit: i.unit || 'kg',
          cost_per_unit: Number(i.cost_per_unit || 0),
          stock_qty: Number(i.stock_qty || 0),
          low_stock_level: Number(i.low_stock_level || 0)
        })),
        menuItems: (menuItemsRes.data || []).map((m: any) => {
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
        recipes: (recipesRes.data || []).map((r: any) => ({
          menu_item_id: r.menu_item_id,
          ingredient_id: r.ingredient_id,
          qty_per_guest: Number(r.qty_per_guest || 0)
        })),
        events: (eventsRes.data || []).map((e: any) => ({
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
          created_at: e.created_at || new Date().toISOString()
        })),
        eventItems: (eventItemsRes.data || []).map((ei: any) => {
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
        eventExtras: (eventExtrasRes.data || []).map((x: any) => ({
          id: x.id,
          event_id: x.event_id,
          description: x.description,
          amount: Number(x.amount || 0)
        })),
        staff: (staffRes.data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          phone: s.phone || '',
          password: s.password || 'password123',
          role_title: s.role_title || 'Service Crew',
          hourly_rate: Number(s.hourly_rate || 0),
          active: s.active !== false
        })),
        shifts: (shiftsRes.data || [])
          .filter((sh: any) => sh.staff_member_id || sh.staff_id)
          .map((sh: any) => ({
            id: sh.id,
            event_id: sh.event_id,
            staff_member_id: sh.staff_member_id || sh.staff_id,
            role_label: sh.role_label || '',
            starts_at: sh.starts_at,
            ends_at: sh.ends_at
          })),
        invoices: (invoicesRes.data || []).map((inv: any) => {
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
        payments: (paymentsRes.data || []).map((p: any) => ({
          id: p.id,
          invoice_id: p.invoice_id,
          amount: Number(p.amount || 0),
          method: p.method || 'Cash',
          paid_at: p.paid_at || new Date().toISOString(),
          note: p.note || ''
        })),
        stockPurchases: loadedPurchases,
        stockPurchasePayments: loadedPurchasePayments
      };

      // Ensure currentUserId points to a valid record after remote sync
      if (this.state.currentRole !== 'staff') {
        const match =
          this.state.profiles.find((p) => p.id === this.state.currentUserId) ||
          this.state.profiles.find((p) => p.role === this.state.currentRole);
        if (match) {
          this.state.currentUserId = match.id;
        }
      }

      this.saveLocalOnly();
    } catch (err) {
      this.reportDbError('Supabase Connection Failed', err);
    } finally {
      this.isSyncingState = false;
      this.notify();
    }
  }

  private loadInitial(): AppState {
    if (typeof window !== 'undefined') {
      try {
        const sessionRaw = localStorage.getItem(SESSION_KEY);
        const session = sessionRaw ? JSON.parse(sessionRaw) : null;
        const stored = localStorage.getItem(STORAGE_KEY);

        if (stored) {
          const parsed = JSON.parse(stored);

          let normalizedProfiles: Profile[] = Array.isArray(parsed.profiles)
            ? parsed.profiles
                .filter((p: any) => p && (p.role === 'owner' || p.role === 'manager' || p.role === 'accountant'))
                .map((p: any) => {
                  const initMatch = INITIAL_PROFILES.find((ip) => ip.id === p.id || ip.role === p.role);
                  return {
                    ...p,
                    username: p.username || initMatch?.username || p.role,
                    password: p.password || initMatch?.password || `${p.role}123`
                  };
                })
            : [];

          if (normalizedProfiles.length === 0) {
            normalizedProfiles = INITIAL_PROFILES;
          } else if (!normalizedProfiles.some((p) => p.role === 'owner')) {
            normalizedProfiles = [INITIAL_PROFILES[0], ...normalizedProfiles];
          }

          let currentRole: UserRole = session?.currentRole ?? parsed.currentRole;
          if (currentRole !== 'owner' && currentRole !== 'manager' && currentRole !== 'accountant' && currentRole !== 'staff') {
            currentRole = 'owner';
          }

          const currentUserId =
            session?.currentUserId ||
            parsed.currentUserId ||
            normalizedProfiles.find((p) => p.role === currentRole)?.id ||
            INITIAL_PROFILES[0].id;
          const isAuthenticated = Boolean(session ? session.isAuthenticated : parsed.isAuthenticated);

          const menuItems: MenuItem[] = (parsed.menuItems || INITIAL_MENU_ITEMS).map((m: any) => ({
            ...m,
            pricing_type: m.pricing_type || 'per_guest',
            price_per_unit: Number(m.price_per_unit || m.price_per_guest || 0),
            price_per_guest: Number(m.price_per_guest || m.price_per_unit || 0)
          }));

          const eventItems: EventItem[] = (parsed.eventItems || INITIAL_EVENT_ITEMS).map((ei: any) => ({
            ...ei,
            pricing_type: ei.pricing_type || 'per_guest',
            price_per_unit: Number(ei.price_per_unit || ei.price_per_guest || 0),
            price_per_guest: Number(ei.price_per_guest || ei.price_per_unit || 0),
            quantity: ei.quantity !== undefined ? Number(ei.quantity) : undefined
          }));

          return {
            ...parsed,
            settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
            profiles: normalizedProfiles,
            currentRole,
            currentUserId,
            isAuthenticated,
            menuItems,
            eventItems,
            stockPurchases: Array.isArray(parsed.stockPurchases) ? parsed.stockPurchases : INITIAL_STOCK_PURCHASES,
            stockPurchasePayments: Array.isArray(parsed.stockPurchasePayments) ? parsed.stockPurchasePayments : INITIAL_STOCK_PURCHASE_PAYMENTS
          };
        }
      } catch (e) {
        console.warn('Could not read from localStorage, using default data', e);
      }
    }

    // When Supabase is configured, start with empty collections while remote fetch loads real DB rows
    if (isSupabaseConfigured) {
      return {
        settings: INITIAL_SETTINGS,
        profiles: INITIAL_PROFILES,
        currentRole: 'owner',
        currentUserId: INITIAL_PROFILES[0].id,
        isAuthenticated: false,
        clients: [],
        ingredients: [],
        menuItems: [],
        recipes: [],
        events: [],
        eventItems: [],
        eventExtras: [],
        staff: [],
        shifts: [],
        invoices: [],
        payments: [],
        stockPurchases: [],
        stockPurchasePayments: []
      };
    }

    return {
      settings: INITIAL_SETTINGS,
      profiles: INITIAL_PROFILES,
      currentRole: 'owner',
      currentUserId: INITIAL_PROFILES[0].id,
      isAuthenticated: false,
      clients: INITIAL_CLIENTS,
      ingredients: INITIAL_INGREDIENTS,
      menuItems: INITIAL_MENU_ITEMS,
      recipes: INITIAL_RECIPES,
      events: INITIAL_EVENTS,
      eventItems: INITIAL_EVENT_ITEMS,
      eventExtras: INITIAL_EVENT_EXTRAS,
      staff: INITIAL_STAFF,
      shifts: INITIAL_SHIFTS,
      invoices: INITIAL_INVOICES,
      payments: INITIAL_PAYMENTS,
      stockPurchases: INITIAL_STOCK_PURCHASES,
      stockPurchasePayments: INITIAL_STOCK_PURCHASE_PAYMENTS
    };
  }

  private saveLocalOnly() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        this.saveSession();
      } catch (e) {
        console.warn('Could not persist to localStorage', e);
      }
    }
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
      if (isSupabaseConfigured && supabase) {
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
      if (isSupabaseConfigured && supabase) {
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

  public addProfile(profileData: {
    full_name: string;
    username: string;
    password: string;
    phone?: string;
    role: UserRole;
  }): { success: boolean; error?: string; profile?: Profile } {
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
    this.save();

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('profiles')
        .insert({
          id: newProfile.id,
          username: newProfile.username,
          password: newProfile.password,
          full_name: newProfile.full_name,
          phone: newProfile.phone || null,
          role: newProfile.role
        })
        .then(({ error }) => {
          if (error) this.reportDbError('Add User Failed', error);
          else this.clearDbError();
        });
    }

    return { success: true, profile: newProfile };
  }

  public updateProfile(profileId: string, updates: Partial<Profile>): { success: boolean; error?: string } {
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

    this.save();

    if (isSupabaseConfigured && supabase && updatedRecord && isValidUUID(profileId)) {
      supabase
        .from('profiles')
        .upsert(
          {
            id: updatedRecord.id,
            username: updatedRecord.username,
            password: updatedRecord.password,
            full_name: updatedRecord.full_name,
            phone: updatedRecord.phone || null,
            role: updatedRecord.role
          },
          { onConflict: 'id' }
        )
        .then(({ error }) => {
          if (error) this.reportDbError('Update User Failed', error);
          else this.clearDbError();
        });
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
    if (target.role === 'owner') {
      const ownerCount = this.state.profiles.filter((p) => p.role === 'owner').length;
      if (ownerCount <= 1) {
        return { success: false, error: 'At least one Owner account must remain in the system.' };
      }
    }
    this.state.profiles = this.state.profiles.filter((p) => p.id !== profileId);
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(profileId)) {
      supabase
        .from('profiles')
        .delete()
        .eq('id', profileId)
        .then(({ error }) => {
          if (error) this.reportDbError('Delete User Failed', error);
          else this.clearDbError();
        });
    }

    return { success: true };
  }

  public resetToDefault() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
    if (isSupabaseConfigured && supabase) {
      this.syncFromSupabase();
      return;
    }
    this.state = {
      settings: INITIAL_SETTINGS,
      profiles: INITIAL_PROFILES,
      currentRole: 'owner',
      currentUserId: INITIAL_PROFILES[0].id,
      isAuthenticated: false,
      clients: INITIAL_CLIENTS,
      ingredients: INITIAL_INGREDIENTS,
      menuItems: INITIAL_MENU_ITEMS,
      recipes: INITIAL_RECIPES,
      events: INITIAL_EVENTS,
      eventItems: INITIAL_EVENT_ITEMS,
      eventExtras: INITIAL_EVENT_EXTRAS,
      staff: INITIAL_STAFF,
      shifts: INITIAL_SHIFTS,
      invoices: INITIAL_INVOICES,
      payments: INITIAL_PAYMENTS,
      stockPurchases: INITIAL_STOCK_PURCHASES,
      stockPurchasePayments: INITIAL_STOCK_PURCHASE_PAYMENTS
    };
    this.save();
  }

  // Clients
  public addClient(client: Omit<Client, 'id' | 'created_at'>) {
    const newClient: Client = {
      ...client,
      id: generateUUID(),
      created_at: new Date().toISOString()
    };
    this.state.clients.unshift(newClient);
    this.save();

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('clients')
        .insert({
          id: newClient.id,
          name: newClient.name,
          email: newClient.email || null,
          phone: newClient.phone || null,
          company: newClient.company || null,
          notes: newClient.notes || null,
          created_at: newClient.created_at
        })
        .then(({ error }) => {
          if (error) this.reportDbError('Add Client Failed', error);
          else this.clearDbError();
        });
    }

    return newClient;
  }

  public updateClient(id: string, updates: Partial<Client>) {
    this.state.clients = this.state.clients.map((c) => (c.id === id ? { ...c, ...updates } : c));
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(id)) {
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.email !== undefined) dbUpdates.email = updates.email || null;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
      if (updates.company !== undefined) dbUpdates.company = updates.company || null;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;

      supabase
        .from('clients')
        .update(dbUpdates)
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Update Client Failed', error);
          else this.clearDbError();
        });
    }
  }

  public deleteClient(id: string) {
    this.state.clients = this.state.clients.filter((c) => c.id !== id);
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(id)) {
      supabase
        .from('clients')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Delete Client Failed', error);
          else this.clearDbError();
        });
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
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(newEvent.client_id)) {
      supabase
        .from('events')
        .insert({
          id: newEvent.id,
          client_id: newEvent.client_id,
          title: newEvent.title,
          event_date: newEvent.event_date,
          start_time: newEvent.start_time || null,
          end_time: newEvent.end_time || null,
          venue: newEvent.venue || null,
          guest_count: Math.max(1, Number(newEvent.guest_count) || 1),
          status: newEvent.status,
          notes: newEvent.notes || null,
          created_at: newEvent.created_at
        })
        .then(({ error }) => {
          if (error) this.reportDbError('Create Event Failed', error);
          else this.clearDbError();
        });
    }

    return newEvent;
  }

  public updateEvent(id: string, updates: Partial<EventRecord>) {
    this.state.events = this.state.events.map((e) => (e.id === id ? { ...e, ...updates } : e));
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(id)) {
      const dbUpdates: Record<string, any> = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.event_date !== undefined) dbUpdates.event_date = updates.event_date;
      if (updates.start_time !== undefined) dbUpdates.start_time = updates.start_time || null;
      if (updates.end_time !== undefined) dbUpdates.end_time = updates.end_time || null;
      if (updates.venue !== undefined) dbUpdates.venue = updates.venue || null;
      if (updates.guest_count !== undefined) dbUpdates.guest_count = Math.max(1, Number(updates.guest_count) || 1);
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;
      if (updates.client_id !== undefined && isValidUUID(updates.client_id)) dbUpdates.client_id = updates.client_id;

      supabase
        .from('events')
        .update(dbUpdates)
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Update Event Failed', error);
          else this.clearDbError();
        });
    }
  }

  public deleteEvent(id: string) {
    const invIds = this.state.invoices.filter((inv) => inv.event_id === id).map((inv) => inv.id);
    this.state.events = this.state.events.filter((e) => e.id !== id);
    this.state.eventItems = this.state.eventItems.filter((ei) => ei.event_id !== id);
    this.state.eventExtras = this.state.eventExtras.filter((ex) => ex.event_id !== id);
    this.state.shifts = this.state.shifts.filter((sh) => sh.event_id !== id);
    this.state.invoices = this.state.invoices.filter((inv) => inv.event_id !== id);
    this.state.payments = this.state.payments.filter((p) => !invIds.includes(p.invoice_id));
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(id)) {
      Promise.all([
        supabase.from('invoices').delete().eq('event_id', id),
        supabase.from('event_items').delete().eq('event_id', id),
        supabase.from('event_extras').delete().eq('event_id', id),
        supabase.from('shifts').delete().eq('event_id', id)
      ]).then(() => {
        supabase!
          .from('events')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) this.reportDbError('Delete Event Failed', error);
            else this.clearDbError();
          });
      });
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
    const existingIndex = this.state.eventItems.findIndex(
      (ei) => ei.event_id === eventId && ei.menu_item_id === menuItemId
    );
    let targetItem: EventItem;
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
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(eventId) && isValidUUID(menuItemId)) {
      supabase
        .from('event_items')
        .upsert(
          {
            id: targetItem.id,
            event_id: targetItem.event_id,
            menu_item_id: targetItem.menu_item_id,
            pricing_type: targetItem.pricing_type,
            price_per_unit: targetItem.price_per_unit,
            price_per_guest: targetItem.price_per_guest,
            quantity: targetItem.quantity ?? null
          },
          { onConflict: 'event_id,menu_item_id' }
        )
        .then(({ error }) => {
          if (error) this.reportDbError('Save Quote Dish Failed', error);
          else this.clearDbError();
        });
    }
  }

  public updateEventItem(id: string, updates: Partial<EventItem>) {
    this.state.eventItems = this.state.eventItems.map((ei) => (ei.id === id ? { ...ei, ...updates } : ei));
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(id)) {
      const dbUpdates: Record<string, any> = {};
      if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
      if (updates.price_per_unit !== undefined) {
        dbUpdates.price_per_unit = updates.price_per_unit;
        dbUpdates.price_per_guest = updates.price_per_unit;
      }
      if (updates.pricing_type !== undefined) dbUpdates.pricing_type = updates.pricing_type;

      supabase
        .from('event_items')
        .update(dbUpdates)
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Update Quote Quantity Failed', error);
          else this.clearDbError();
        });
    }
  }

  public removeEventItem(eventId: string, menuItemId: string) {
    this.state.eventItems = this.state.eventItems.filter(
      (ei) => !(ei.event_id === eventId && ei.menu_item_id === menuItemId)
    );
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(eventId) && isValidUUID(menuItemId)) {
      supabase
        .from('event_items')
        .delete()
        .eq('event_id', eventId)
        .eq('menu_item_id', menuItemId)
        .then(({ error }) => {
          if (error) this.reportDbError('Remove Quote Dish Failed', error);
          else this.clearDbError();
        });
    }
  }

  // Event Extras
  public addEventExtra(eventId: string, description: string, amount: number) {
    const newExtra: EventExtra = {
      id: generateUUID(),
      event_id: eventId,
      description,
      amount
    };
    this.state.eventExtras.push(newExtra);
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(eventId)) {
      supabase
        .from('event_extras')
        .insert({
          id: newExtra.id,
          event_id: newExtra.event_id,
          description: newExtra.description,
          amount: newExtra.amount
        })
        .then(({ error }) => {
          if (error) this.reportDbError('Add Extra Charge Failed', error);
          else this.clearDbError();
        });
    }
  }

  public removeEventExtra(id: string) {
    this.state.eventExtras = this.state.eventExtras.filter((x) => x.id !== id);
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(id)) {
      supabase
        .from('event_extras')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Delete Extra Charge Failed', error);
          else this.clearDbError();
        });
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
    this.save();

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('menu_items')
        .insert({
          id: newItem.id,
          name: newItem.name,
          description: newItem.description || null,
          category: newItem.category,
          pricing_type: newItem.pricing_type,
          price_per_unit: newItem.price_per_unit,
          price_per_guest: newItem.price_per_guest,
          active: newItem.active
        })
        .then(({ error }) => {
          if (error) this.reportDbError('Add Menu Item Failed', error);
          else this.clearDbError();
        });
    }

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
    this.save();

    if (isSupabaseConfigured && supabase && updatedItem && isValidUUID(id)) {
      supabase
        .from('menu_items')
        .update({
          name: updatedItem.name,
          description: updatedItem.description || null,
          category: updatedItem.category,
          pricing_type: updatedItem.pricing_type,
          price_per_unit: updatedItem.price_per_unit,
          price_per_guest: updatedItem.price_per_guest,
          active: updatedItem.active
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Update Menu Item Failed', error);
          else this.clearDbError();
        });
    }
  }

  public deleteMenuItem(id: string) {
    this.state.menuItems = this.state.menuItems.filter((m) => m.id !== id);
    this.state.recipes = this.state.recipes.filter((r) => r.menu_item_id !== id);
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(id)) {
      supabase
        .from('menu_items')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Delete Menu Item Failed', error);
          else this.clearDbError();
        });
    }
  }

  public setRecipeIngredients(menuItemId: string, ingredients: { ingredient_id: string; qty_per_guest: number }[]) {
    const validLines = ingredients.filter((ing) => ing.ingredient_id && ing.qty_per_guest > 0);
    this.state.recipes = this.state.recipes.filter((r) => r.menu_item_id !== menuItemId);
    for (const ing of validLines) {
      this.state.recipes.push({
        menu_item_id: menuItemId,
        ingredient_id: ing.ingredient_id,
        qty_per_guest: ing.qty_per_guest
      });
    }
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(menuItemId)) {
      supabase
        .from('menu_item_ingredients')
        .delete()
        .eq('menu_item_id', menuItemId)
        .then(({ error: delErr }) => {
          if (delErr) {
            this.reportDbError('Update Recipe Failed', delErr);
            return;
          }
          const rows = validLines
            .filter((l) => isValidUUID(l.ingredient_id))
            .map((l) => ({
              menu_item_id: menuItemId,
              ingredient_id: l.ingredient_id,
              qty_per_guest: l.qty_per_guest
            }));
          if (rows.length > 0 && supabase) {
            supabase
              .from('menu_item_ingredients')
              .insert(rows)
              .then(({ error: insErr }) => {
                if (insErr) this.reportDbError('Save Recipe Ingredients Failed', insErr);
                else this.clearDbError();
              });
          }
        });
    }
  }

  // Stock / Ingredients
  public addIngredient(ing: Omit<Ingredient, 'id'>) {
    const newIng: Ingredient = { ...ing, id: generateUUID() };
    this.state.ingredients.push(newIng);
    this.save();

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('ingredients')
        .insert({
          id: newIng.id,
          name: newIng.name,
          unit: newIng.unit,
          cost_per_unit: newIng.cost_per_unit,
          stock_qty: newIng.stock_qty,
          low_stock_level: newIng.low_stock_level
        })
        .then(({ error }) => {
          if (error) this.reportDbError('Add Ingredient Failed', error);
          else this.clearDbError();
        });
    }

    return newIng;
  }

  public updateIngredient(id: string, updates: Partial<Ingredient>) {
    let updatedIng: Ingredient | undefined;
    this.state.ingredients = this.state.ingredients.map((i) => {
      if (i.id !== id) return i;
      updatedIng = { ...i, ...updates };
      return updatedIng;
    });
    this.save();

    if (isSupabaseConfigured && supabase && updatedIng && isValidUUID(id)) {
      supabase
        .from('ingredients')
        .update({
          name: updatedIng.name,
          unit: updatedIng.unit,
          cost_per_unit: updatedIng.cost_per_unit,
          stock_qty: updatedIng.stock_qty,
          low_stock_level: updatedIng.low_stock_level
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Update Ingredient Failed', error);
          else this.clearDbError();
        });
    }
  }

  public adjustStock(id: string, delta: number) {
    let nextQty: number | undefined;
    this.state.ingredients = this.state.ingredients.map((i) => {
      if (i.id === id) {
        const next = Math.max(0, Number((i.stock_qty + delta).toFixed(3)));
        nextQty = next;
        return { ...i, stock_qty: next };
      }
      return i;
    });
    this.save();

    if (isSupabaseConfigured && supabase && nextQty !== undefined && isValidUUID(id)) {
      supabase
        .from('ingredients')
        .update({ stock_qty: nextQty })
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Adjust Stock Failed', error);
          else this.clearDbError();
        });
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
        if (pi.ingredient_id) {
          const ing = this.state.ingredients.find((i) => i.id === pi.ingredient_id);
          if (ing) {
            ing.stock_qty = Number((ing.stock_qty + pi.quantity).toFixed(2));
            if (pi.unit_price > 0) {
              ing.cost_per_unit = pi.unit_price;
            }
            updatedIngredients.push(ing);
          }
        }
      });
    }

    this.save();

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('stock_purchases')
        .insert({
          id: newPurchase.id,
          purchase_date: newPurchase.purchase_date,
          vendor_name: newPurchase.vendor_name,
          vendor_location: newPurchase.vendor_location || null,
          vendor_phone: newPurchase.vendor_phone || null,
          bill_number: newPurchase.bill_number || null,
          total_amount: newPurchase.total_amount,
          paid_amount: newPurchase.paid_amount,
          balance_amount: newPurchase.balance_amount,
          payment_status: newPurchase.payment_status,
          payment_method: newPurchase.payment_method,
          notes: newPurchase.notes || null,
          created_at: newPurchase.created_at
        })
        .then(({ error }) => {
          if (error) {
            this.reportDbError('Add Stock Purchase Failed', error);
            return;
          }
          this.clearDbError();

          if (purchaseItems.length > 0 && supabase) {
            supabase
              .from('stock_purchase_items')
              .insert(
                purchaseItems.map((it) => ({
                  id: it.id,
                  purchase_id: newPurchase.id,
                  ingredient_id: isValidUUID(it.ingredient_id) ? it.ingredient_id : null,
                  item_name: it.item_name,
                  quantity: it.quantity,
                  unit: it.unit,
                  unit_price: it.unit_price,
                  total_price: it.total_price
                }))
              )
              .then(({ error: itemErr }) => {
                if (itemErr) this.reportDbError('Save Purchase Items Failed', itemErr);
              });
          }

          if (initialPayment && supabase) {
            supabase
              .from('stock_purchase_payments')
              .insert({
                id: initialPayment.id,
                purchase_id: initialPayment.purchase_id,
                amount: initialPayment.amount,
                paid_at: initialPayment.paid_at,
                method: initialPayment.method,
                note: initialPayment.note || null
              })
              .then(({ error: payErr }) => {
                if (payErr) this.reportDbError('Save Initial Vendor Payment Failed', payErr);
              });
          }

          updatedIngredients.forEach((ing) => {
            if (isValidUUID(ing.id) && supabase) {
              supabase
                .from('ingredients')
                .update({ stock_qty: ing.stock_qty, cost_per_unit: ing.cost_per_unit })
                .eq('id', ing.id)
                .then(({ error: ingErr }) => {
                  if (ingErr) this.reportDbError('Auto-Update Warehouse Stock Failed', ingErr);
                });
            }
          });
        });
    }

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

    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(purchaseId)) {
      Promise.all([
        supabase.from('stock_purchase_payments').insert({
          id: newPayment.id,
          purchase_id: newPayment.purchase_id,
          amount: newPayment.amount,
          method: newPayment.method,
          note: newPayment.note || null,
          paid_at: newPayment.paid_at
        }),
        supabase
          .from('stock_purchases')
          .update({
            paid_amount: purchase.paid_amount,
            balance_amount: purchase.balance_amount,
            payment_status: purchase.payment_status
          })
          .eq('id', purchaseId)
      ]).then(([insRes, updRes]) => {
        const err = insRes.error || updRes.error;
        if (err) this.reportDbError('Record Vendor Payment Failed', err);
        else this.clearDbError();
      });
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
    this.save();

    if (isSupabaseConfigured && supabase && updatedPurchase && isValidUUID(id)) {
      supabase
        .from('stock_purchases')
        .update({
          vendor_name: updatedPurchase.vendor_name,
          vendor_location: updatedPurchase.vendor_location || null,
          vendor_phone: updatedPurchase.vendor_phone || null,
          bill_number: updatedPurchase.bill_number || null,
          total_amount: updatedPurchase.total_amount,
          paid_amount: updatedPurchase.paid_amount,
          balance_amount: updatedPurchase.balance_amount,
          payment_status: updatedPurchase.payment_status,
          notes: updatedPurchase.notes || null
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Update Stock Purchase Failed', error);
          else this.clearDbError();
        });
    }
  }

  public deleteStockPurchase(purchaseId: string) {
    if (Array.isArray(this.state.stockPurchases)) {
      this.state.stockPurchases = this.state.stockPurchases.filter((p) => p.id !== purchaseId);
    }
    if (Array.isArray(this.state.stockPurchasePayments)) {
      this.state.stockPurchasePayments = this.state.stockPurchasePayments.filter((p) => p.purchase_id !== purchaseId);
    }
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(purchaseId)) {
      supabase
        .from('stock_purchases')
        .delete()
        .eq('id', purchaseId)
        .then(({ error }) => {
          if (error) this.reportDbError('Delete Stock Purchase Failed', error);
          else this.clearDbError();
        });
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
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(paymentId)) {
      supabase
        .from('stock_purchase_payments')
        .delete()
        .eq('id', paymentId)
        .then(({ error }) => {
          if (error) this.reportDbError('Delete Vendor Payment Failed', error);
          else if (purchase && isValidUUID(purchaseId) && supabase) {
            supabase
              .from('stock_purchases')
              .update({
                paid_amount: purchase.paid_amount,
                balance_amount: purchase.balance_amount,
                payment_status: purchase.payment_status
              })
              .eq('id', purchaseId)
              .then(() => {});
          }
        });
    }
  }

  // Staff & Shifts
  public addStaff(staff: Omit<StaffMember, 'id'>) {
    const newStaff: StaffMember = { ...staff, id: generateUUID() };
    this.state.staff.push(newStaff);
    this.save();

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('staff_members')
        .insert({
          id: newStaff.id,
          name: newStaff.name,
          phone: newStaff.phone || null,
          password: newStaff.password || 'password123',
          role_title: newStaff.role_title || null,
          hourly_rate: newStaff.hourly_rate,
          active: newStaff.active
        })
        .then(({ error }) => {
          if (error) this.reportDbError('Register Staff Failed', error);
          else this.clearDbError();
        });
    }

    return newStaff;
  }

  public updateStaff(id: string, updates: Partial<StaffMember>) {
    let updatedStaff: StaffMember | undefined;
    this.state.staff = this.state.staff.map((s) => {
      if (s.id !== id) return s;
      updatedStaff = { ...s, ...updates };
      return updatedStaff;
    });
    this.save();

    if (isSupabaseConfigured && supabase && updatedStaff && isValidUUID(id)) {
      supabase
        .from('staff_members')
        .update({
          name: updatedStaff.name,
          phone: updatedStaff.phone || null,
          password: updatedStaff.password || 'password123',
          role_title: updatedStaff.role_title || null,
          hourly_rate: updatedStaff.hourly_rate,
          active: updatedStaff.active
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Update Staff Failed', error);
          else this.clearDbError();
        });
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

    const newShift: Shift = { ...shift, ends_at: endsAt, id: generateUUID() };
    this.state.shifts.push(newShift);
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(newShift.event_id) && isValidUUID(newShift.staff_member_id)) {
      supabase
        .from('shifts')
        .insert({
          id: newShift.id,
          event_id: newShift.event_id,
          staff_member_id: newShift.staff_member_id,
          role_label: newShift.role_label || null,
          starts_at: newShift.starts_at,
          ends_at: newShift.ends_at
        })
        .then(({ error }) => {
          if (error) this.reportDbError('Schedule Shift Failed', error);
          else this.clearDbError();
        });
    }

    return newShift;
  }

  public removeShift(id: string) {
    this.state.shifts = this.state.shifts.filter((sh) => sh.id !== id);
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(id)) {
      supabase
        .from('shifts')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Remove Shift Failed', error);
          else this.clearDbError();
        });
    }
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
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(newInv.event_id)) {
      supabase
        .from('invoices')
        .insert({
          id: newInv.id,
          event_id: newInv.event_id,
          invoice_number: newInv.invoice_number,
          kind: newInv.kind,
          subtotal: newInv.subtotal,
          discount: newInv.discount,
          amount: newInv.amount,
          due_date: newInv.due_date || null,
          status: newInv.status,
          notes: newInv.notes || null,
          created_at: newInv.created_at
        })
        .then(({ error }) => {
          if (error) this.reportDbError('Create Invoice Failed', error);
          else this.clearDbError();
        });
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
    this.save();

    if (isSupabaseConfigured && supabase && updatedInv && isValidUUID(id)) {
      supabase
        .from('invoices')
        .update({
          kind: updatedInv.kind,
          subtotal: updatedInv.subtotal,
          discount: updatedInv.discount,
          amount: updatedInv.amount,
          due_date: updatedInv.due_date || null,
          status: updatedInv.status,
          notes: updatedInv.notes || null
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Update Invoice Failed', error);
          else this.clearDbError();
        });
    }
  }

  public deleteInvoice(id: string) {
    this.state.invoices = this.state.invoices.filter((inv) => inv.id !== id);
    this.state.payments = this.state.payments.filter((p) => p.invoice_id !== id);
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(id)) {
      supabase
        .from('invoices')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) this.reportDbError('Delete Invoice Failed', error);
          else this.clearDbError();
        });
    }
  }

  // Record Part-Payment directly against the same invoice
  public addPayment(payment: {
    invoice_id: string;
    amount: number;
    method: string;
    note?: string;
  }) {
    const newPayment: Payment = {
      id: generateUUID(),
      invoice_id: payment.invoice_id,
      amount: Number(payment.amount),
      method: payment.method,
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
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(newPayment.invoice_id)) {
      supabase
        .from('payments')
        .insert({
          id: newPayment.id,
          invoice_id: newPayment.invoice_id,
          amount: newPayment.amount,
          method: newPayment.method,
          note: newPayment.note || null,
          paid_at: newPayment.paid_at
        })
        .then(({ error }) => {
          if (error) {
            this.reportDbError('Record Payment Failed', error);
          } else {
            this.clearDbError();
            if (invoice && isValidUUID(invoice.id) && supabase) {
              supabase
                .from('invoices')
                .update({ status: invoice.status })
                .eq('id', invoice.id)
                .then(() => {});
            }
          }
        });
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
    this.save();

    if (isSupabaseConfigured && supabase && isValidUUID(paymentId)) {
      supabase
        .from('payments')
        .delete()
        .eq('id', paymentId)
        .then(({ error }) => {
          if (error) this.reportDbError('Delete Payment Failed', error);
          else if (invoice && isValidUUID(invoice.id) && supabase) {
            supabase
              .from('invoices')
              .update({ status: invoice.status })
              .eq('id', invoice.id)
              .then(() => {});
          }
        });
    }
  }

  // Settings
  public updateSettings(updates: Partial<BusinessSettings>) {
    this.state.settings = { ...this.state.settings, ...updates };
    this.save();

    if (isSupabaseConfigured && supabase) {
      const s = this.state.settings;
      supabase
        .from('business_settings')
        .upsert(
          {
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
            payment_terms: s.payment_terms || null
          },
          { onConflict: 'id' }
        )
        .then(({ error }) => {
          if (error) this.reportDbError('Update Settings Failed', error);
          else this.clearDbError();
        });
    }
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
