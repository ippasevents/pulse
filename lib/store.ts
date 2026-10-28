'use client';

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
    id: 'u-1',
    username: 'owner',
    password: 'owner123',
    full_name: 'Fazil (Owner)',
    role: 'owner',
    phone: '+91 98470 11111'
  },
  {
    id: 'u-2',
    username: 'manager',
    password: 'manager123',
    full_name: 'Aisha (Manager)',
    role: 'manager',
    phone: '+91 98470 22222'
  },
  {
    id: 'u-3',
    username: 'accountant',
    password: 'accountant123',
    full_name: 'Rahul (Accountant)',
    role: 'accountant',
    phone: '+91 98470 33333'
  }
];

const INITIAL_CLIENTS: Client[] = [
  { id: 'c-1', name: 'Dr. Zameer Khan', company: 'Aster Medcity', phone: '+91 94471 00001', email: 'zameer@example.com', notes: 'VIP client, prefers mild spice', created_at: '2026-09-01T10:00:00Z' },
  { id: 'c-2', name: 'Ananya Nair', company: 'Kerala Tech Summit', phone: '+91 94471 00002', email: 'ananya@techsummit.in', notes: 'Annual corporate gala banquet', created_at: '2026-09-15T14:30:00Z' },
  { id: 'c-3', name: 'Farhan & Nimra Wedding', company: '', phone: '+91 94471 00003', email: 'farhan.events@gmail.com', notes: 'Royal wedding dinner at Beachfront Resort', created_at: '2026-10-01T09:00:00Z' }
];

const INITIAL_INGREDIENTS: Ingredient[] = [
  { id: 'ing-1', name: 'Basmati Rice (Khaas)', unit: 'kg', cost_per_unit: 140, stock_qty: 150, low_stock_level: 50 },
  { id: 'ing-2', name: 'Malabar Mutton (Fresh)', unit: 'kg', cost_per_unit: 850, stock_qty: 45, low_stock_level: 20 },
  { id: 'ing-3', name: 'Chicken (Curry Cut)', unit: 'kg', cost_per_unit: 260, stock_qty: 80, low_stock_level: 30 },
  { id: 'ing-4', name: 'Pure Desi Ghee', unit: 'l', cost_per_unit: 680, stock_qty: 25, low_stock_level: 10 },
  { id: 'ing-5', name: 'Brown Shallots / Onion', unit: 'kg', cost_per_unit: 45, stock_qty: 120, low_stock_level: 40 },
  { id: 'ing-6', name: 'Saffron & Spices Mix', unit: 'kg', cost_per_unit: 1200, stock_qty: 5, low_stock_level: 2 },
  { id: 'ing-7', name: 'Fresh Paneer', unit: 'kg', cost_per_unit: 380, stock_qty: 18, low_stock_level: 10 },
  { id: 'ing-8', name: 'Tender Coconut Pulp', unit: 'l', cost_per_unit: 180, stock_qty: 12, low_stock_level: 15 },
  { id: 'ing-9', name: 'Cashews & Raisins', unit: 'kg', cost_per_unit: 750, stock_qty: 15, low_stock_level: 5 }
];

const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'm-1',
    name: 'Thalassery Mutton Dum Biryani',
    description: 'Traditional aromatic kaima rice dum biryani cooked in pure ghee with tender mutton chunks',
    category: 'Main',
    pricing_type: 'per_guest',
    price_per_unit: 420,
    price_per_guest: 420,
    active: true
  },
  {
    id: 'm-2',
    name: 'Malabar Chicken Roast & Kerala Parotta',
    description: 'Caramelized onion-marinated chicken served with flaky handmade coin parottas',
    category: 'Main',
    pricing_type: 'per_guest',
    price_per_unit: 320,
    price_per_guest: 320,
    active: true
  },
  {
    id: 'm-3',
    name: 'Paneer Butter Masala & Garlic Naan',
    description: 'Cottage cheese simmered in rich cashew tomato gravy',
    category: 'Main',
    pricing_type: 'per_guest',
    price_per_unit: 280,
    price_per_guest: 280,
    active: true
  },
  {
    id: 'm-4',
    name: 'Golden Crispy Fish Fingers w/ Tartar',
    description: 'Fresh catch fish fillet crumbed and fried with house dip',
    category: 'Starter',
    pricing_type: 'per_guest',
    price_per_unit: 180,
    price_per_guest: 180,
    active: true
  },
  {
    id: 'm-5',
    name: 'Kozhi Porichathu (Calicut Fried Chicken)',
    description: 'Spicy deep-fried chicken wings with curry leaves and green chillies',
    category: 'Starter',
    pricing_type: 'per_guest',
    price_per_unit: 160,
    price_per_guest: 160,
    active: true
  },
  {
    id: 'm-6',
    name: 'Tender Coconut Souffle Pudding',
    description: 'Silky dessert made from fresh elaneer pulp and cream',
    category: 'Dessert',
    pricing_type: 'per_guest',
    price_per_unit: 120,
    price_per_guest: 120,
    active: true
  },
  {
    id: 'm-7',
    name: 'Sulaimani with Spiced Mint',
    description: 'Digestive black tea flavored with clove, cardamom and lemon',
    category: 'Drink',
    pricing_type: 'per_guest',
    price_per_unit: 40,
    price_per_guest: 40,
    active: true
  },
  {
    id: 'm-8',
    name: 'Special Malabar Dum Biriyani (Bulk Handi)',
    description: 'Freshly prepared bulk handi dum biryani supplied by kilogram with boiled eggs, raita & pickle',
    category: 'Main',
    pricing_type: 'per_kg',
    price_per_unit: 1250,
    price_per_guest: 1250,
    active: true
  },
  {
    id: 'm-9',
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
  { menu_item_id: 'm-1', ingredient_id: 'ing-1', qty_per_guest: 0.18 },
  { menu_item_id: 'm-1', ingredient_id: 'ing-2', qty_per_guest: 0.25 },
  { menu_item_id: 'm-1', ingredient_id: 'ing-4', qty_per_guest: 0.03 },
  { menu_item_id: 'm-1', ingredient_id: 'ing-5', qty_per_guest: 0.12 },
  { menu_item_id: 'm-1', ingredient_id: 'ing-6', qty_per_guest: 0.008 },
  { menu_item_id: 'm-1', ingredient_id: 'ing-9', qty_per_guest: 0.015 },
  { menu_item_id: 'm-2', ingredient_id: 'ing-3', qty_per_guest: 0.22 },
  { menu_item_id: 'm-2', ingredient_id: 'ing-5', qty_per_guest: 0.1 },
  { menu_item_id: 'm-3', ingredient_id: 'ing-7', qty_per_guest: 0.15 },
  { menu_item_id: 'm-6', ingredient_id: 'ing-8', qty_per_guest: 0.08 },
  { menu_item_id: 'm-8', ingredient_id: 'ing-1', qty_per_guest: 0.35 },
  { menu_item_id: 'm-8', ingredient_id: 'ing-2', qty_per_guest: 0.5 },
  { menu_item_id: 'm-8', ingredient_id: 'ing-4', qty_per_guest: 0.08 }
];

const INITIAL_EVENTS: EventRecord[] = [
  {
    id: 'e-1',
    client_id: 'c-3',
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
    id: 'e-2',
    client_id: 'c-2',
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
    id: 'e-3',
    client_id: 'c-1',
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
  { id: 'ei-1', event_id: 'e-1', menu_item_id: 'm-4', pricing_type: 'per_guest', price_per_unit: 180, price_per_guest: 180 },
  { id: 'ei-2', event_id: 'e-1', menu_item_id: 'm-1', pricing_type: 'per_guest', price_per_unit: 420, price_per_guest: 420 },
  { id: 'ei-3', event_id: 'e-1', menu_item_id: 'm-6', pricing_type: 'per_guest', price_per_unit: 120, price_per_guest: 120 },
  { id: 'ei-4', event_id: 'e-1', menu_item_id: 'm-7', pricing_type: 'per_guest', price_per_unit: 40, price_per_guest: 40 },
  { id: 'ei-5', event_id: 'e-2', menu_item_id: 'm-2', pricing_type: 'per_guest', price_per_unit: 320, price_per_guest: 320 },
  { id: 'ei-6', event_id: 'e-2', menu_item_id: 'm-3', pricing_type: 'per_guest', price_per_unit: 280, price_per_guest: 280 },
  { id: 'ei-7', event_id: 'e-2', menu_item_id: 'm-7', pricing_type: 'per_guest', price_per_unit: 40, price_per_guest: 40 }
];

const INITIAL_EVENT_EXTRAS: EventExtra[] = [
  { id: 'ex-1', event_id: 'e-1', description: 'Chafing dishes, copper crockery & linen rental', amount: 18500 },
  { id: 'ex-2', event_id: 'e-1', description: 'Refrigerated transport & on-site logistics', amount: 6500 },
  { id: 'ex-3', event_id: 'e-2', description: 'Premium cutlery & buffet station decors', amount: 8000 }
];

const INITIAL_STAFF: StaffMember[] = [
  { id: 'st-1', name: 'Shyam Kumar', phone: '9745111001', password: 'password123', role_title: 'Senior Banquet Captain', hourly_rate: 350, active: true },
  { id: 'st-2', name: 'Abdul Rasheed', phone: '9745111002', password: 'password123', role_title: 'Lead Chef', hourly_rate: 450, active: true },
  { id: 'st-3', name: 'Manoj Pillai', phone: '9745111003', password: 'password123', role_title: 'Buffet Server', hourly_rate: 200, active: true },
  { id: 'st-4', name: 'Rubeena K', phone: '9745111004', password: 'password123', role_title: 'Buffet Server', hourly_rate: 200, active: true },
  { id: 'st-5', name: 'Jithesh P', phone: '9745111005', password: 'password123', role_title: 'Dish Steward / Utility', hourly_rate: 180, active: true }
];

const INITIAL_SHIFTS: Shift[] = [
  { id: 'sh-1', event_id: 'e-1', staff_member_id: 'st-1', role_label: 'Captain', starts_at: '2026-11-12T16:00:00Z', ends_at: '2026-11-12T23:30:00Z' },
  { id: 'sh-2', event_id: 'e-1', staff_member_id: 'st-2', role_label: 'Head Cook', starts_at: '2026-11-12T14:00:00Z', ends_at: '2026-11-12T22:00:00Z' },
  { id: 'sh-3', event_id: 'e-1', staff_member_id: 'st-3', role_label: 'Server', starts_at: '2026-11-12T17:30:00Z', ends_at: '2026-11-12T23:00:00Z' },
  { id: 'sh-4', event_id: 'e-1', staff_member_id: 'st-4', role_label: 'Server', starts_at: '2026-11-12T17:30:00Z', ends_at: '2026-11-12T23:00:00Z' }
];

const INITIAL_INVOICES: Invoice[] = [
  { id: 'inv-1', event_id: 'e-1', invoice_number: 'INV-0001', kind: 'deposit', subtotal: 100000, discount: 0, amount: 100000, due_date: '2026-10-15', status: 'paid', created_at: '2026-10-03T10:00:00Z' },
  { id: 'inv-2', event_id: 'e-1', invoice_number: 'INV-0002', kind: 'final', subtotal: 197000, discount: 10000, amount: 187000, due_date: '2026-11-14', status: 'sent', created_at: '2026-10-25T11:00:00Z' },
  { id: 'inv-3', event_id: 'e-2', invoice_number: 'INV-0003', kind: 'deposit', subtotal: 40000, discount: 0, amount: 40000, due_date: '2026-11-05', status: 'draft', created_at: '2026-10-20T16:00:00Z' }
];

const INITIAL_PAYMENTS: Payment[] = [
  { id: 'p-1', invoice_id: 'inv-1', amount: 100000, method: 'Bank Transfer (Federal Bank)', note: 'Advance booking deposit', paid_at: '2026-10-12T14:15:00Z' }
];

const INITIAL_STOCK_PURCHASES: StockPurchase[] = [
  {
    id: 'sp-1',
    purchase_date: '2026-10-22',
    vendor_name: 'Metro Wholesale Cash & Carry',
    vendor_location: 'Palayam, Kozhikode',
    vendor_phone: '+91 98470 11223',
    bill_number: 'MW-9821',
    items: [
      {
        id: 'spi-1',
        ingredient_id: 'ing-1',
        item_name: 'Kaima / Jeerakasala Biryani Rice',
        quantity: 150,
        unit: 'kg',
        unit_price: 90,
        total_price: 13500
      },
      {
        id: 'spi-2',
        ingredient_id: 'ing-4',
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
    id: 'sp-2',
    purchase_date: '2026-10-24',
    vendor_name: 'Kozhikode Central Meat Market',
    vendor_location: 'Central Meat Market, Calicut',
    vendor_phone: '+91 98950 44556',
    bill_number: 'KMM-409',
    items: [
      {
        id: 'spi-3',
        ingredient_id: 'ing-2',
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
    id: 'sp-3',
    purchase_date: '2026-10-26',
    vendor_name: 'Malabar Spices & Condiments',
    vendor_location: 'Big Bazaar Road, Kozhikode',
    vendor_phone: '+91 94471 88990',
    bill_number: 'MS-1102',
    items: [
      {
        id: 'spi-4',
        ingredient_id: 'ing-6',
        item_name: 'Whole Biryani Garam Spices',
        quantity: 8,
        unit: 'kg',
        unit_price: 450,
        total_price: 3600
      },
      {
        id: 'spi-5',
        ingredient_id: 'ing-9',
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
    id: 'spp-1',
    purchase_id: 'sp-1',
    amount: 15000,
    method: 'UPI / GPay',
    paid_at: '2026-10-22T10:00:00Z',
    note: 'Initial installment paid via GPay'
  },
  {
    id: 'spp-2',
    purchase_id: 'sp-2',
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

class DataStore {
  private state: AppState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadInitial();
  }

  private loadInitial(): AppState {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);

          let normalizedProfiles: Profile[] = Array.isArray(parsed.profiles)
            ? parsed.profiles.filter((p: any) => p.role === 'owner' || p.role === 'manager' || p.role === 'accountant')
            : [];

          if (normalizedProfiles.length === 0) {
            normalizedProfiles = INITIAL_PROFILES;
          } else {
            normalizedProfiles = INITIAL_PROFILES.map((initP) => {
              const found = normalizedProfiles.find((p) => p.role === initP.role || p.id === initP.id);
              return {
                ...initP,
                ...(found || {}),
                username: found?.username || initP.username,
                password: found?.password || initP.password
              };
            });
          }

          let currentRole: UserRole = parsed.currentRole;
          if (currentRole !== 'owner' && currentRole !== 'manager' && currentRole !== 'accountant' && currentRole !== 'staff') {
            currentRole = 'owner';
          }

          const currentUserId = parsed.currentUserId || normalizedProfiles.find((p) => p.role === currentRole)?.id || 'u-1';
          const isAuthenticated = Boolean(parsed.isAuthenticated);

          // Normalize menuItems for pricing_type
          const menuItems: MenuItem[] = (parsed.menuItems || INITIAL_MENU_ITEMS).map((m: any) => ({
            ...m,
            pricing_type: m.pricing_type || 'per_guest',
            price_per_unit: Number(m.price_per_unit || m.price_per_guest || 0),
            price_per_guest: Number(m.price_per_guest || m.price_per_unit || 0)
          }));

          // Normalize eventItems
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
    return {
      settings: INITIAL_SETTINGS,
      profiles: INITIAL_PROFILES,
      currentRole: 'owner',
      currentUserId: 'u-1',
      isAuthenticated: false, // Must authenticate on app visit
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

  private save() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.warn('Could not persist to localStorage', e);
      }
    }
    this.listeners.forEach((cb) => cb());
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
          role: 'staff'
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

      // Allow staff to login with their password or phone number or default 'password123'
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
        role: 'staff'
      };

      this.state.currentUserId = staffMember.id;
      this.state.currentRole = 'staff';
      this.state.isAuthenticated = true;
      this.save();
      return { success: true, user: staffProfile };
    }

    return { success: false, error: 'User not found. Please enter a valid username or staff phone number.' };
  }

  public logout() {
    this.state.isAuthenticated = false;
    this.save();
  }

  public updateProfile(profileId: string, updates: Partial<Profile>) {
    this.state.profiles = this.state.profiles.map((p) =>
      p.id === profileId ? { ...p, ...updates } : p
    );
    this.save();
  }

  public resetToDefault() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.state = {
      settings: INITIAL_SETTINGS,
      profiles: INITIAL_PROFILES,
      currentRole: 'owner',
      currentUserId: 'u-1',
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
      id: 'c-' + Date.now(),
      created_at: new Date().toISOString()
    };
    this.state.clients.unshift(newClient);
    this.save();
    return newClient;
  }

  public updateClient(id: string, updates: Partial<Client>) {
    this.state.clients = this.state.clients.map((c) => (c.id === id ? { ...c, ...updates } : c));
    this.save();
  }

  public deleteClient(id: string) {
    this.state.clients = this.state.clients.filter((c) => c.id !== id);
    this.save();
  }

  // Events
  public addEvent(eventData: Omit<EventRecord, 'id' | 'created_at'>) {
    const newEvent: EventRecord = {
      ...eventData,
      id: 'e-' + Date.now(),
      created_at: new Date().toISOString()
    };
    this.state.events.unshift(newEvent);
    this.save();
    return newEvent;
  }

  public updateEvent(id: string, updates: Partial<EventRecord>) {
    this.state.events = this.state.events.map((e) => (e.id === id ? { ...e, ...updates } : e));
    this.save();
  }

  public deleteEvent(id: string) {
    this.state.events = this.state.events.filter((e) => e.id !== id);
    this.state.eventItems = this.state.eventItems.filter((ei) => ei.event_id !== id);
    this.state.eventExtras = this.state.eventExtras.filter((ex) => ex.event_id !== id);
    this.state.shifts = this.state.shifts.filter((sh) => sh.event_id !== id);
    this.save();
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
    if (existingIndex >= 0) {
      this.state.eventItems[existingIndex].price_per_unit = pricePerUnit;
      this.state.eventItems[existingIndex].price_per_guest = pricePerUnit;
      this.state.eventItems[existingIndex].pricing_type = pricingType;
      if (quantity !== undefined) {
        this.state.eventItems[existingIndex].quantity = quantity;
      }
    } else {
      this.state.eventItems.push({
        id: 'ei-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        event_id: eventId,
        menu_item_id: menuItemId,
        pricing_type: pricingType,
        price_per_unit: pricePerUnit,
        price_per_guest: pricePerUnit,
        quantity: quantity !== undefined ? quantity : (pricingType === 'per_kg' ? 10 : undefined)
      });
    }
    this.save();
  }

  public updateEventItem(id: string, updates: Partial<EventItem>) {
    this.state.eventItems = this.state.eventItems.map((ei) => (ei.id === id ? { ...ei, ...updates } : ei));
    this.save();
  }

  public removeEventItem(eventId: string, menuItemId: string) {
    this.state.eventItems = this.state.eventItems.filter(
      (ei) => !(ei.event_id === eventId && ei.menu_item_id === menuItemId)
    );
    this.save();
  }

  // Event Extras
  public addEventExtra(eventId: string, description: string, amount: number) {
    this.state.eventExtras.push({
      id: 'ex-' + Date.now(),
      event_id: eventId,
      description,
      amount
    });
    this.save();
  }

  public removeEventExtra(id: string) {
    this.state.eventExtras = this.state.eventExtras.filter((x) => x.id !== id);
    this.save();
  }

  // Menu items & Recipes
  public addMenuItem(item: Omit<MenuItem, 'id'>) {
    const pricing_type = item.pricing_type || 'per_guest';
    const price_per_unit = Number(item.price_per_unit || item.price_per_guest || 0);
    const newItem: MenuItem = {
      ...item,
      id: 'm-' + Date.now(),
      pricing_type,
      price_per_unit,
      price_per_guest: price_per_unit
    };
    this.state.menuItems.unshift(newItem);
    this.save();
    return newItem;
  }

  public updateMenuItem(id: string, updates: Partial<MenuItem>) {
    this.state.menuItems = this.state.menuItems.map((m) => {
      if (m.id !== id) return m;
      const price_per_unit = updates.price_per_unit !== undefined ? Number(updates.price_per_unit) : (updates.price_per_guest !== undefined ? Number(updates.price_per_guest) : m.price_per_unit);
      return {
        ...m,
        ...updates,
        price_per_unit,
        price_per_guest: price_per_unit
      };
    });
    this.save();
  }

  public deleteMenuItem(id: string) {
    this.state.menuItems = this.state.menuItems.filter((m) => m.id !== id);
    this.state.recipes = this.state.recipes.filter((r) => r.menu_item_id !== id);
    this.save();
  }

  public setRecipeIngredients(menuItemId: string, ingredients: { ingredient_id: string; qty_per_guest: number }[]) {
    this.state.recipes = this.state.recipes.filter((r) => r.menu_item_id !== menuItemId);
    for (const ing of ingredients) {
      this.state.recipes.push({
        menu_item_id: menuItemId,
        ingredient_id: ing.ingredient_id,
        qty_per_guest: ing.qty_per_guest
      });
    }
    this.save();
  }

  // Stock / Ingredients
  public addIngredient(ing: Omit<Ingredient, 'id'>) {
    const newIng: Ingredient = { ...ing, id: 'ing-' + Date.now() };
    this.state.ingredients.push(newIng);
    this.save();
    return newIng;
  }

  public updateIngredient(id: string, updates: Partial<Ingredient>) {
    this.state.ingredients = this.state.ingredients.map((i) => (i.id === id ? { ...i, ...updates } : i));
    this.save();
  }

  public adjustStock(id: string, delta: number) {
    this.state.ingredients = this.state.ingredients.map((i) => {
      if (i.id === id) {
        const next = Math.max(0, Number((i.stock_qty + delta).toFixed(3)));
        return { ...i, stock_qty: next };
      }
      return i;
    });
    this.save();
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
    const purchaseId = 'sp-' + Date.now();
    const purchaseItems: StockPurchaseItem[] = purchase.items.map((it, idx) => ({
      ...it,
      id: `spi-${Date.now()}-${idx}`
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

    if (paid_amount > 0) {
      this.state.stockPurchasePayments.unshift({
        id: 'spp-' + Date.now(),
        purchase_id: purchaseId,
        amount: paid_amount,
        paid_at: new Date().toISOString(),
        method: newPurchase.payment_method,
        note: 'Initial payment recorded during purchase entry'
      });
    }

    // Auto-update warehouse inventory stock if requested
    if (updateWarehouseStock) {
      purchaseItems.forEach((pi) => {
        if (pi.ingredient_id) {
          const ing = this.state.ingredients.find((i) => i.id === pi.ingredient_id);
          if (ing) {
            ing.stock_qty = Number((ing.stock_qty + pi.quantity).toFixed(2));
            if (pi.unit_price > 0) {
              ing.cost_per_unit = pi.unit_price;
            }
          }
        }
      });
    }

    this.save();
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
      id: 'spp-' + Date.now(),
      purchase_id: purchaseId,
      amount: Number(payment.amount),
      method: payment.method,
      note: payment.note || '',
      paid_at: payment.paid_at || new Date().toISOString()
    };

    this.state.stockPurchasePayments.unshift(newPayment);

    // Recalculate purchase paid & balance amounts
    const allPayments = this.state.stockPurchasePayments.filter((p) => p.purchase_id === purchaseId);
    const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

    purchase.paid_amount = totalPaid;
    purchase.balance_amount = Math.max(0, purchase.total_amount - totalPaid);
    purchase.payment_status =
      purchase.balance_amount === 0 ? 'paid' : purchase.paid_amount > 0 ? 'partially_paid' : 'unpaid';

    this.save();
    return newPayment;
  }

  public updateStockPurchase(id: string, updates: Partial<StockPurchase>) {
    if (!Array.isArray(this.state.stockPurchases)) return;
    this.state.stockPurchases = this.state.stockPurchases.map((p) => {
      if (p.id !== id) return p;
      const total = updates.total_amount !== undefined ? Number(updates.total_amount) : p.total_amount;
      const paid = updates.paid_amount !== undefined ? Number(updates.paid_amount) : p.paid_amount;
      const balance = Math.max(0, total - paid);
      const status: StockPaymentStatus =
        balance === 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid';

      return {
        ...p,
        ...updates,
        total_amount: total,
        paid_amount: paid,
        balance_amount: balance,
        payment_status: status
      };
    });
    this.save();
  }

  public deleteStockPurchase(purchaseId: string) {
    if (Array.isArray(this.state.stockPurchases)) {
      this.state.stockPurchases = this.state.stockPurchases.filter((p) => p.id !== purchaseId);
    }
    if (Array.isArray(this.state.stockPurchasePayments)) {
      this.state.stockPurchasePayments = this.state.stockPurchasePayments.filter((p) => p.purchase_id !== purchaseId);
    }
    this.save();
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
  }

  // Staff & Shifts
  public addStaff(staff: Omit<StaffMember, 'id'>) {
    const newStaff: StaffMember = { ...staff, id: 'st-' + Date.now() };
    this.state.staff.push(newStaff);
    this.save();
    return newStaff;
  }

  public updateStaff(id: string, updates: Partial<StaffMember>) {
    this.state.staff = this.state.staff.map((s) => (s.id === id ? { ...s, ...updates } : s));
    this.save();
  }

  public addShift(shift: Omit<Shift, 'id'>) {
    const newShift: Shift = { ...shift, id: 'sh-' + Date.now() };
    this.state.shifts.push(newShift);
    this.save();
    return newShift;
  }

  public removeShift(id: string) {
    this.state.shifts = this.state.shifts.filter((sh) => sh.id !== id);
    this.save();
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
    const seq = this.state.invoices.length + 1;
    const invoice_number = 'INV-' + String(seq).padStart(4, '0');
    const subtotal = Number(inv.subtotal || 0);
    const discount = Number(inv.discount || 0);
    const amount = Math.max(0, subtotal - discount);

    const newInv: Invoice = {
      id: 'inv-' + Date.now(),
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
    return newInv;
  }

  public updateInvoice(id: string, updates: Partial<Invoice>) {
    this.state.invoices = this.state.invoices.map((inv) => {
      if (inv.id !== id) return inv;
      const subtotal = updates.subtotal !== undefined ? Number(updates.subtotal) : (inv.subtotal ?? inv.amount);
      const discount = updates.discount !== undefined ? Number(updates.discount) : (inv.discount ?? 0);
      const amount = Math.max(0, subtotal - discount);
      return { ...inv, ...updates, subtotal, discount, amount };
    });
    this.save();
  }

  public deleteInvoice(id: string) {
    this.state.invoices = this.state.invoices.filter((inv) => inv.id !== id);
    this.state.payments = this.state.payments.filter((p) => p.invoice_id !== id);
    this.save();
  }

  // Record Part-Payment directly against the same invoice
  public addPayment(payment: {
    invoice_id: string;
    amount: number;
    method: string;
    note?: string;
  }) {
    const newPayment: Payment = {
      id: 'p-' + Date.now(),
      invoice_id: payment.invoice_id,
      amount: Number(payment.amount),
      method: payment.method,
      note: payment.note || '',
      paid_at: new Date().toISOString()
    };
    this.state.payments.unshift(newPayment);

    // Auto-update the same invoice status and balance
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
  }

  // Settings
  public updateSettings(updates: Partial<BusinessSettings>) {
    this.state.settings = { ...this.state.settings, ...updates };
    this.save();
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

    // Sort items: shortages first, then alphabetical
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
