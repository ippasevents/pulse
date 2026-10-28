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
  UserRole
} from './types';

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
  { id: 'u-1', full_name: 'Fazil (Owner)', role: 'owner', phone: '+91 98470 11111' },
  { id: 'u-2', full_name: 'Aisha (Manager)', role: 'manager', phone: '+91 98470 22222' },
  { id: 'u-3', full_name: 'Rahul (Accountant)', role: 'accountant', phone: '+91 98470 33333' },
  { id: 'u-4', full_name: 'Chef Tariq', role: 'chef', phone: '+91 98470 44444' },
  { id: 'u-5', full_name: 'Sunil (Staff)', role: 'staff', phone: '+91 98470 55555' }
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
  { id: 'm-1', name: 'Thalassery Mutton Dum Biryani', description: 'Traditional aromatic kaima rice dum biryani cooked in pure ghee with tender mutton chunks', category: 'Main', price_per_guest: 420, active: true },
  { id: 'm-2', name: 'Malabar Chicken Roast & Kerala Parotta', description: 'Caramelized onion-marinated chicken served with flaky handmade coin parottas', category: 'Main', price_per_guest: 320, active: true },
  { id: 'm-3', name: 'Paneer Butter Masala & Garlic Naan', description: 'Cottage cheese simmered in rich cashew tomato gravy', category: 'Main', price_per_guest: 280, active: true },
  { id: 'm-4', name: 'Golden Crispy Fish Fingers w/ Tartar', description: 'Fresh catch fish fillet crumbed and fried with house dip', category: 'Starter', price_per_guest: 180, active: true },
  { id: 'm-5', name: 'Kozhi Porichathu (Calicut Fried Chicken)', description: 'Spicy deep-fried chicken wings with curry leaves and green chillies', category: 'Starter', price_per_guest: 160, active: true },
  { id: 'm-6', name: 'Tender Coconut Souffle Pudding', description: 'Silky dessert made from fresh elaneer pulp and cream', category: 'Dessert', price_per_guest: 120, active: true },
  { id: 'm-7', name: 'Sulaimani with Spiced Mint', description: 'Digestive black tea flavored with clove, cardamom and lemon', category: 'Drink', price_per_guest: 40, active: true }
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
  { menu_item_id: 'm-6', ingredient_id: 'ing-8', qty_per_guest: 0.08 }
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
  { id: 'ei-1', event_id: 'e-1', menu_item_id: 'm-4', price_per_guest: 180 },
  { id: 'ei-2', event_id: 'e-1', menu_item_id: 'm-1', price_per_guest: 420 },
  { id: 'ei-3', event_id: 'e-1', menu_item_id: 'm-6', price_per_guest: 120 },
  { id: 'ei-4', event_id: 'e-1', menu_item_id: 'm-7', price_per_guest: 40 },
  { id: 'ei-5', event_id: 'e-2', menu_item_id: 'm-2', price_per_guest: 320 },
  { id: 'ei-6', event_id: 'e-2', menu_item_id: 'm-3', price_per_guest: 280 },
  { id: 'ei-7', event_id: 'e-2', menu_item_id: 'm-7', price_per_guest: 40 }
];

const INITIAL_EVENT_EXTRAS: EventExtra[] = [
  { id: 'ex-1', event_id: 'e-1', description: 'Chafing dishes, copper crockery & linen rental', amount: 18500 },
  { id: 'ex-2', event_id: 'e-1', description: 'Refrigerated transport & on-site logistics', amount: 6500 },
  { id: 'ex-3', event_id: 'e-2', description: 'Premium cutlery & buffet station decors', amount: 8000 }
];

const INITIAL_STAFF: StaffMember[] = [
  { id: 'st-1', name: 'Shyam Kumar', phone: '+91 97451 11001', role_title: 'Senior Banquet Captain', hourly_rate: 350, active: true },
  { id: 'st-2', name: 'Abdul Rasheed', phone: '+91 97451 11002', role_title: 'Lead Chef', hourly_rate: 450, active: true },
  { id: 'st-3', name: 'Manoj Pillai', phone: '+91 97451 11003', role_title: 'Buffet Server', hourly_rate: 200, active: true },
  { id: 'st-4', name: 'Rubeena K', phone: '+91 97451 11004', role_title: 'Buffet Server', hourly_rate: 200, active: true },
  { id: 'st-5', name: 'Jithesh P', phone: '+91 97451 11005', role_title: 'Dish Steward / Utility', hourly_rate: 180, active: true }
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
  { id: 'p-1', invoice_id: 'inv-1', amount: 100000, method: 'bank transfer', paid_at: '2026-10-12T14:15:00Z' }
];

interface AppState {
  settings: BusinessSettings;
  profiles: Profile[];
  currentRole: UserRole;
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
          return {
            ...parsed,
            settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) }
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
      payments: INITIAL_PAYMENTS
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

  public setRole(role: UserRole) {
    this.state.currentRole = role;
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
      payments: INITIAL_PAYMENTS
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

  // Event Items
  public setEventItem(eventId: string, menuItemId: string, pricePerGuest: number) {
    const existingIndex = this.state.eventItems.findIndex(
      (ei) => ei.event_id === eventId && ei.menu_item_id === menuItemId
    );
    if (existingIndex >= 0) {
      this.state.eventItems[existingIndex].price_per_guest = pricePerGuest;
    } else {
      this.state.eventItems.push({
        id: 'ei-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        event_id: eventId,
        menu_item_id: menuItemId,
        price_per_guest: pricePerGuest
      });
    }
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
    const newItem: MenuItem = { ...item, id: 'm-' + Date.now() };
    this.state.menuItems.unshift(newItem);
    this.save();
    return newItem;
  }

  public updateMenuItem(id: string, updates: Partial<MenuItem>) {
    this.state.menuItems = this.state.menuItems.map((m) => (m.id === id ? { ...m, ...updates } : m));
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

  // Invoices & Payments
  public addInvoice(inv: Omit<Invoice, 'id' | 'invoice_number' | 'created_at'>) {
    const seq = this.state.invoices.length + 1;
    const invoice_number = 'INV-' + String(seq).padStart(4, '0');
    const subtotal = inv.subtotal !== undefined ? inv.subtotal : inv.amount;
    const discount = inv.discount || 0;
    const amount = Math.max(0, subtotal - discount);
    const newInv: Invoice = {
      ...inv,
      subtotal,
      discount,
      amount,
      id: 'inv-' + Date.now(),
      invoice_number,
      created_at: new Date().toISOString()
    };
    this.state.invoices.unshift(newInv);
    this.save();
    return newInv;
  }

  public updateInvoiceStatus(id: string, status: Invoice['status']) {
    this.state.invoices = this.state.invoices.map((inv) => (inv.id === id ? { ...inv, status } : inv));
    this.save();
  }

  public updateInvoice(id: string, updates: Partial<Invoice>) {
    this.state.invoices = this.state.invoices.map((inv) => {
      if (inv.id !== id) return inv;
      const subtotal = updates.subtotal !== undefined ? updates.subtotal : (inv.subtotal ?? inv.amount);
      const discount = updates.discount !== undefined ? updates.discount : (inv.discount ?? 0);
      const amount = updates.amount !== undefined && updates.discount === undefined && updates.subtotal === undefined
        ? updates.amount
        : Math.max(0, subtotal - discount);
      return { ...inv, ...updates, subtotal, discount, amount };
    });
    this.save();
  }

  public deleteInvoice(id: string) {
    this.state.invoices = this.state.invoices.filter((inv) => inv.id !== id);
    this.state.payments = this.state.payments.filter((p) => p.invoice_id !== id);
    this.save();
  }

  public addPayment(payment: Omit<Payment, 'id' | 'paid_at'>) {
    const newPayment: Payment = {
      ...payment,
      id: 'p-' + Date.now(),
      paid_at: new Date().toISOString()
    };
    this.state.payments.unshift(newPayment);

    // Auto update invoice status
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

  // Settings & Profiles
  public updateSettings(updates: Partial<BusinessSettings>) {
    this.state.settings = { ...this.state.settings, ...updates };
    this.save();
  }

  public updateUserRole(profileId: string, role: UserRole) {
    this.state.profiles = this.state.profiles.map((p) => (p.id === profileId ? { ...p, role } : p));
    this.save();
  }

  // Calculations
  public getEventTotal(eventId: string): { menuTotal: number; extrasTotal: number; grandTotal: number } {
    const event = this.state.events.find((e) => e.id === eventId);
    if (!event) return { menuTotal: 0, extrasTotal: 0, grandTotal: 0 };
    const items = this.state.eventItems.filter((i) => i.event_id === eventId);
    const sumPricePerGuest = items.reduce((sum, item) => sum + Number(item.price_per_guest || 0), 0);
    const menuTotal = sumPricePerGuest * event.guest_count;
    const extrasTotal = this.state.eventExtras
      .filter((x) => x.event_id === eventId)
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);
    return {
      menuTotal,
      extrasTotal,
      grandTotal: menuTotal + extrasTotal
    };
  }
}

export const store = new DataStore();
