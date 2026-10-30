'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { Ingredient, StockPurchase, StockPaymentStatus, StockPurchaseItem } from '@/lib/types';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';

const NEAR_EXPIRY_DAYS = 14;

function getIngredientExpiryStatus(expiryDate?: string): {
  status: 'none' | 'expired' | 'expiring_soon' | 'fresh';
  daysUntil: number | null;
  formattedDate: string;
} {
  if (!expiryDate || !expiryDate.trim()) {
    return { status: 'none', daysUntil: null, formattedDate: '—' };
  }
  const clean = expiryDate.trim().slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return { status: 'none', daysUntil: null, formattedDate: clean };
  }
  const [y, m, d] = parts;
  const expDateObj = new Date(y, m - 1, d);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysUntil = Math.round((expDateObj.getTime() - todayMidnight) / 86400000);
  const formattedDate = expDateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  if (daysUntil < 0) {
    return { status: 'expired', daysUntil, formattedDate };
  }
  if (daysUntil <= NEAR_EXPIRY_DAYS) {
    return { status: 'expiring_soon', daysUntil, formattedDate };
  }
  return { status: 'fresh', daysUntil, formattedDate };
}

export default function StockPage() {
  const [state, setState] = useState(store.getState());
  const [activeTab, setActiveTab] = useState<'inventory' | 'purchases'>('inventory');

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'low_stock' | 'expiring'>('all');
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<'all' | 'unpaid' | 'partially_paid' | 'paid'>('all');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Bulk Update state
  const [selectedIngIds, setSelectedIngIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkDirection, setBulkDirection] = useState<'add' | 'deduct'>('add');
  const [bulkAmount, setBulkAmount] = useState<number>(10);
  const [bulkModalSearch, setBulkModalSearch] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  // Ingredient modal state
  const [isIngModalOpen, setIsIngModalOpen] = useState(false);
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);
  const [ingFormData, setIngFormData] = useState({
    name: '',
    unit: 'kg',
    cost_per_unit: 100,
    stock_qty: 50,
    low_stock_level: 15,
    expiry_date: ''
  });

  // Purchase modal state
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    purchase_date: new Date().toISOString().split('T')[0],
    vendor_name: '',
    vendor_location: '',
    vendor_phone: '',
    bill_number: '',
    payment_method: 'UPI / GPay',
    paid_amount: 0,
    notes: '',
    updateWarehouseStock: true
  });
  const [purchaseItems, setPurchaseItems] = useState<
    {
      ingredient_id: string;
      item_name: string;
      quantity: number;
      unit: string;
      unit_price: number;
      total_price: number;
    }[]
  >([
    {
      ingredient_id: '',
      item_name: '',
      quantity: 10,
      unit: 'kg',
      unit_price: 100,
      total_price: 1000
    }
  ]);

  // Pay Vendor modal state
  const [payingPurchase, setPayingPurchase] = useState<StockPurchase | null>(null);
  const [vendorPayForm, setVendorPayForm] = useState({
    amount: 0,
    method: 'UPI / GPay',
    note: '',
    paid_at: new Date().toISOString().split('T')[0]
  });

  // View Purchase Details modal
  const [viewingPurchase, setViewingPurchase] = useState<StockPurchase | null>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const canManageStock = role === 'owner' || role === 'manager' || role === 'super_admin';

  // Calculations for Inventory
  const lowStockItems = state.ingredients.filter((i) => i.stock_qty <= i.low_stock_level);
  const expiringItems = state.ingredients
    .filter((i) => {
      const exp = getIngredientExpiryStatus(i.expiry_date);
      return exp.status === 'expired' || exp.status === 'expiring_soon';
    })
    .sort((a, b) => (a.expiry_date || '').localeCompare(b.expiry_date || ''));

  const filteredIngredients = state.ingredients.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (inventoryFilter === 'low_stock') {
      return i.stock_qty <= i.low_stock_level;
    }
    if (inventoryFilter === 'expiring') {
      const exp = getIngredientExpiryStatus(i.expiry_date);
      return exp.status === 'expired' || exp.status === 'expiring_soon';
    }
    return true;
  });

  const allVisibleSelected =
    filteredIngredients.length > 0 &&
    filteredIngredients.every((item) => selectedIngIds.includes(item.id));

  // Calculations for Purchases
  const purchasesList = state.stockPurchases || [];
  const filteredPurchases = purchasesList.filter((sp) => {
    const matchesSearch =
      sp.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
      (sp.vendor_location && sp.vendor_location.toLowerCase().includes(search.toLowerCase())) ||
      (sp.bill_number && sp.bill_number.toLowerCase().includes(search.toLowerCase())) ||
      sp.items.some((it) => it.item_name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      purchaseStatusFilter === 'all' || sp.payment_status === purchaseStatusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPurchasesAmount = purchasesList.reduce((sum, p) => sum + p.total_amount, 0);
  const totalVendorPaidAmount = purchasesList.reduce((sum, p) => sum + p.paid_amount, 0);
  const totalVendorBalanceDue = purchasesList.reduce((sum, p) => sum + p.balance_amount, 0);
  const unpaidPurchasesCount = purchasesList.filter((p) => p.balance_amount > 0).length;

  // Handlers for Ingredients
  const handleIngredientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingFormData.name) return;

    if (editingIng) {
      store.updateIngredient(editingIng.id, {
        ...ingFormData,
        expiry_date: ingFormData.expiry_date.trim()
      });
    } else {
      store.addIngredient({
        ...ingFormData,
        expiry_date: ingFormData.expiry_date.trim() || undefined
      });
    }
    setIsIngModalOpen(false);
    setEditingIng(null);
    setIngFormData({
      name: '',
      unit: 'kg',
      cost_per_unit: 100,
      stock_qty: 50,
      low_stock_level: 15,
      expiry_date: ''
    });
  };

  const handleAdjust = (id: string, delta: number) => {
    store.adjustStock(id, delta);
  };

  const toggleSelectIngredient = (id: string) => {
    setSelectedIngIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setBulkError(null);
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredIngredients.map((i) => i.id);
    if (allVisibleSelected) {
      setSelectedIngIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIngIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
    setBulkError(null);
  };

  const handleApplyBulkUpdate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validIds = selectedIngIds.filter((id) =>
      state.ingredients.some((ing) => ing.id === id)
    );
    if (validIds.length === 0) {
      setBulkError('Please select at least one ingredient to update.');
      return;
    }
    const rawAmt = Math.abs(Number(bulkAmount));
    if (!Number.isFinite(rawAmt) || rawAmt <= 0) {
      setBulkError('Please enter a stock adjustment amount greater than 0.');
      return;
    }

    const signedDelta = bulkDirection === 'deduct' ? -rawAmt : rawAmt;
    const updatedCount = store.bulkAdjustStock(validIds, signedDelta);
    setBulkError(null);
    setIsBulkModalOpen(false);
    setSelectedIngIds([]);
    setBulkFeedback(
      `✓ Bulk update applied (${signedDelta > 0 ? `+${signedDelta}` : signedDelta}) across ${updatedCount} ingredient${updatedCount === 1 ? '' : 's'}.`
    );
  };

  // Handlers for Purchases
  const handleAddItemRow = () => {
    setPurchaseItems([
      ...purchaseItems,
      {
        ingredient_id: '',
        item_name: '',
        quantity: 5,
        unit: 'kg',
        unit_price: 100,
        total_price: 500
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (purchaseItems.length === 1) return;
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...purchaseItems];
    const row = { ...updated[index], [field]: value };

    // If ingredient selected, prefill name, unit, cost
    if (field === 'ingredient_id') {
      const selected = state.ingredients.find((ing) => ing.id === value);
      if (selected) {
        row.item_name = selected.name;
        row.unit = selected.unit;
        row.unit_price = selected.cost_per_unit;
      }
    }

    if (field === 'quantity' || field === 'unit_price' || field === 'ingredient_id') {
      const qty = Number(row.quantity) || 0;
      const rate = Number(row.unit_price) || 0;
      row.total_price = Math.round(qty * rate);
    }

    updated[index] = row;
    setPurchaseItems(updated);
  };

  const totalCalculatedBill = purchaseItems.reduce((sum, it) => sum + (it.total_price || 0), 0);

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.vendor_name) return;

    const validItems = purchaseItems.filter((it) => it.item_name.trim() !== '');
    if (validItems.length === 0) {
      setPurchaseError('Please enter at least one item purchased.');
      return;
    }
    setPurchaseError(null);

    const totalAmt = totalCalculatedBill;
    const paidAmt = Math.min(totalAmt, Number(purchaseForm.paid_amount) || 0);

    store.addStockPurchase(
      {
        purchase_date: purchaseForm.purchase_date,
        vendor_name: purchaseForm.vendor_name.trim(),
        vendor_location: purchaseForm.vendor_location.trim(),
        vendor_phone: purchaseForm.vendor_phone.trim(),
        bill_number: purchaseForm.bill_number.trim(),
        items: validItems,
        total_amount: totalAmt,
        paid_amount: paidAmt,
        payment_method: purchaseForm.payment_method,
        notes: purchaseForm.notes.trim()
      },
      purchaseForm.updateWarehouseStock
    );

    setIsPurchaseModalOpen(false);
    // Reset purchase form
    setPurchaseForm({
      purchase_date: new Date().toISOString().split('T')[0],
      vendor_name: '',
      vendor_location: '',
      vendor_phone: '',
      bill_number: '',
      payment_method: 'UPI / GPay',
      paid_amount: 0,
      notes: '',
      updateWarehouseStock: true
    });
    setPurchaseItems([
      {
        ingredient_id: '',
        item_name: '',
        quantity: 10,
        unit: 'kg',
        unit_price: 100,
        total_price: 1000
      }
    ]);
  };

  const handleOpenPayVendor = (purchase: StockPurchase) => {
    setPayingPurchase(purchase);
    setVendorPayForm({
      amount: purchase.balance_amount,
      method: 'UPI / GPay',
      note: `Installment towards Bill #${purchase.bill_number || purchase.vendor_name}`,
      paid_at: new Date().toISOString().split('T')[0]
    });
  };

  const handleRecordVendorPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingPurchase || vendorPayForm.amount <= 0) return;

    store.addVendorPayment(payingPurchase.id, {
      amount: Number(vendorPayForm.amount),
      method: vendorPayForm.method,
      note: vendorPayForm.note.trim(),
      paid_at: vendorPayForm.paid_at ? new Date(vendorPayForm.paid_at).toISOString() : new Date().toISOString()
    });

    setPayingPurchase(null);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pantry, Stock &amp; Vendor Purchases</h1>
          <p className="page-subtitle">
            Manage warehouse inventory, vendor purchases, purchase locations, payments, and outstanding balances.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canManageStock && (
            <>
              {activeTab === 'inventory' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkError(null);
                      setBulkModalSearch('');
                      setIsBulkModalOpen(true);
                    }}
                    className="btn btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontWeight: 700,
                      borderColor: selectedIngIds.length > 0 ? '#6366f1' : undefined,
                      background: selectedIngIds.length > 0 ? '#eef2ff' : undefined,
                      color: selectedIngIds.length > 0 ? '#3730a3' : undefined
                    }}
                  >
                    ⚡ Bulk Update
                    {selectedIngIds.length > 0 && (
                      <span
                        style={{
                          background: '#4f46e5',
                          color: '#ffffff',
                          fontSize: '0.72rem',
                          padding: '1px 7px',
                          borderRadius: '10px'
                        }}
                      >
                        {selectedIngIds.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingIng(null);
                      setIngFormData({
                        name: '',
                        unit: 'kg',
                        cost_per_unit: 100,
                        stock_qty: 50,
                        low_stock_level: 15,
                        expiry_date: ''
                      });
                      setIsIngModalOpen(true);
                    }}
                    className="btn btn-primary"
                  >
                    + Add Raw Ingredient
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsPurchaseModalOpen(true)}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  🛒 + Record Stock Purchase
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            background: activeTab === 'inventory' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'inventory' ? '#ffffff' : '#475569',
            transition: 'all 0.15s ease'
          }}
        >
          📦 Warehouse Inventory
          {lowStockItems.length > 0 && (
            <span style={{ marginLeft: '0.5rem', background: '#ef4444', color: '#fff', fontSize: '0.72rem', padding: '2px 7px', borderRadius: '10px' }}>
              {lowStockItems.length} Low
            </span>
          )}
          {expiringItems.length > 0 && (
            <span style={{ marginLeft: '0.4rem', background: '#ea580c', color: '#fff', fontSize: '0.72rem', padding: '2px 7px', borderRadius: '10px' }}>
              {expiringItems.length} Expiring
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('purchases')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            background: activeTab === 'purchases' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'purchases' ? '#ffffff' : '#475569',
            transition: 'all 0.15s ease'
          }}
        >
          🛒 Stock Purchases &amp; Vendor Dues
          {unpaidPurchasesCount > 0 && (
            <span style={{ marginLeft: '0.5rem', background: '#dc2626', color: '#fff', fontSize: '0.72rem', padding: '2px 7px', borderRadius: '10px' }}>
              {unpaidPurchasesCount} Dues
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INVENTORY & WAREHOUSE STOCK                                       */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && (
        <div>
          {bulkFeedback && (
            <div
              style={{
                background: '#dcfce7',
                border: '1px solid #86efac',
                color: '#166534',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.88rem',
                fontWeight: 600
              }}
            >
              <span>{bulkFeedback}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setBulkFeedback(null)}
              >
                ✕
              </button>
            </div>
          )}

          {expiringItems.length > 0 && (
            <div
              style={{
                background: '#fff7ed',
                border: '1px solid #fdba74',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}
            >
              <div style={{ fontWeight: 700, color: '#9a3412', marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span>
                  ⏳ Expiration Alert ({expiringItems.length} item{expiringItems.length === 1 ? '' : 's'} expired or nearing expiration within {NEAR_EXPIRY_DAYS} days)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setInventoryFilter(inventoryFilter === 'expiring' ? 'all' : 'expiring')
                  }
                  style={{
                    background: inventoryFilter === 'expiring' ? '#9a3412' : '#ffedd5',
                    color: inventoryFilter === 'expiring' ? '#ffffff' : '#9a3412',
                    border: '1px solid #fb923c',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {inventoryFilter === 'expiring' ? 'Show All Items' : 'Filter Expiring Items'}
                </button>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#c2410c' }}>
                {expiringItems
                  .map((i) => {
                    const exp = getIngredientExpiryStatus(i.expiry_date);
                    const statusNote =
                      exp.status === 'expired'
                        ? `EXPIRED ${Math.abs(exp.daysUntil || 0)}d ago (${exp.formattedDate})`
                        : exp.daysUntil === 0
                        ? `EXPIRES TODAY (${exp.formattedDate})`
                        : `in ${exp.daysUntil}d (${exp.formattedDate})`;
                    return `${i.name} — ${i.stock_qty} ${i.unit} [${statusNote}]`;
                  })
                  .join(' • ')}
              </div>
            </div>
          )}

          {lowStockItems.length > 0 && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.25rem'
              }}
            >
              <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.25rem' }}>
                ⚠️ Low Stock Alert ({lowStockItems.length} items below minimum safety stock)
              </div>
              <div style={{ fontSize: '0.85rem', color: '#b45309' }}>
                {lowStockItems.map((i) => `${i.name} (${i.stock_qty} ${i.unit} left, threshold ${i.low_stock_level} ${i.unit})`).join(' • ')}
              </div>
            </div>
          )}

          <div
            className="card"
            style={{
              marginBottom: '1.25rem',
              padding: '1rem',
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ flex: '1', minWidth: '240px' }}>
              <input
                type="text"
                placeholder="Search pantry ingredients (e.g. Basmati, Mutton, Ghee)..."
                className="form-control"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Show:</span>
              <button
                type="button"
                onClick={() => setInventoryFilter('all')}
                style={{
                  padding: '5px 11px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: inventoryFilter === 'all' ? '#0f172a' : '#ffffff',
                  color: inventoryFilter === 'all' ? '#ffffff' : '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                All ({state.ingredients.length})
              </button>
              <button
                type="button"
                onClick={() => setInventoryFilter('low_stock')}
                style={{
                  padding: '5px 11px',
                  borderRadius: '6px',
                  border: '1px solid #fde68a',
                  background: inventoryFilter === 'low_stock' ? '#d97706' : '#fffbeb',
                  color: inventoryFilter === 'low_stock' ? '#ffffff' : '#92400e',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⚠️ Low Stock ({lowStockItems.length})
              </button>
              <button
                type="button"
                onClick={() => setInventoryFilter('expiring')}
                style={{
                  padding: '5px 11px',
                  borderRadius: '6px',
                  border: '1px solid #fdba74',
                  background: inventoryFilter === 'expiring' ? '#ea580c' : '#fff7ed',
                  color: inventoryFilter === 'expiring' ? '#ffffff' : '#9a3412',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⏳ Nearing Expiry ({expiringItems.length})
              </button>
            </div>
          </div>

          {canManageStock && selectedIngIds.length > 0 && (
            <div
              className="card"
              style={{
                marginBottom: '1rem',
                padding: '0.85rem 1rem',
                background: '#eef2ff',
                border: '1.5px solid #818cf8',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: '#4f46e5',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '6px'
                  }}
                >
                  {selectedIngIds.length} Selected
                </span>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e1b4b' }}>
                  Bulk Stock Adjustment:
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '0.38rem 0.6rem', fontSize: '0.84rem', fontWeight: 600 }}
                  value={bulkDirection}
                  onChange={(e) => setBulkDirection(e.target.value as 'add' | 'deduct')}
                >
                  <option value="add">+ Add Stock</option>
                  <option value="deduct">− Deduct Stock</option>
                </select>

                <input
                  type="number"
                  min="0.01"
                  step="any"
                  className="form-control"
                  style={{ width: '110px', padding: '0.38rem 0.6rem', fontSize: '0.86rem', fontWeight: 700 }}
                  placeholder="Qty"
                  value={bulkAmount || ''}
                  onChange={(e) => setBulkAmount(parseFloat(e.target.value) || 0)}
                />

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 700 }}
                  onClick={() => handleApplyBulkUpdate()}
                >
                  ⚡ Apply ({bulkDirection === 'deduct' ? '-' : '+'}{Math.abs(Number(bulkAmount) || 0)})
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setBulkError(null);
                    setIsBulkModalOpen(true);
                  }}
                >
                  Preview
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedIngIds([])}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  {canManageStock && (
                    <th style={{ width: '42px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        title="Select all visible ingredients for Bulk Update"
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </th>
                  )}
                  <th>Ingredient Name</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Cost / Unit</th>
                  <th style={{ textAlign: 'right' }}>Current Stock</th>
                  <th style={{ textAlign: 'right' }}>Low Stock Alert Level</th>
                  <th style={{ textAlign: 'center' }}>Expiry Date</th>
                  <th style={{ textAlign: 'center' }}>Stock Health</th>
                  {canManageStock && <th style={{ textAlign: 'center' }}>Quick Adjust</th>}
                  {canManageStock && <th style={{ textAlign: 'center' }}>Edit</th>}
                </tr>
              </thead>
              <tbody>
                {filteredIngredients.length === 0 ? (
                  <tr>
                    <td colSpan={canManageStock ? 10 : 7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No matching ingredients found in stock.
                    </td>
                  </tr>
                ) : (
                  filteredIngredients.map((item) => {
                    const isLow = item.stock_qty <= item.low_stock_level;
                    const exp = getIngredientExpiryStatus(item.expiry_date);
                    const isSelected = selectedIngIds.includes(item.id);
                    const rowBg = isSelected
                      ? '#eef2ff'
                      : exp.status === 'expired'
                      ? '#fef2f2'
                      : exp.status === 'expiring_soon'
                      ? '#fff7ed'
                      : isLow
                      ? '#fffbeb'
                      : 'transparent';

                    return (
                      <tr key={item.id} style={{ background: rowBg }}>
                        {canManageStock && (
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectIngredient(item.id)}
                              aria-label={`Select ${item.name}`}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          {role === 'owner' && (
                            <OwnerAuditBadge
                              role={role}
                              entry={store.getEntityAudit(item.id, ['stock'])}
                              prefixLabel="Updated by"
                            />
                          )}
                        </td>
                        <td>{item.unit}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.cost_per_unit}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {item.stock_qty} {item.unit}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                          {item.low_stock_level} {item.unit}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {exp.status === 'none' ? (
                            <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>—</span>
                          ) : exp.status === 'expired' ? (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span
                                className="badge"
                                style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}
                              >
                                🚨 Expired ({Math.abs(exp.daysUntil || 0)}d ago)
                              </span>
                              <span style={{ fontSize: '0.73rem', color: '#b91c1c', fontWeight: 600 }}>
                                {exp.formattedDate}
                              </span>
                            </div>
                          ) : exp.status === 'expiring_soon' ? (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span
                                className="badge"
                                style={{ background: '#ffedd5', color: '#c2410c', fontWeight: 700 }}
                              >
                                {exp.daysUntil === 0
                                  ? '⚠️ Expires Today'
                                  : `⏳ Expiring in ${exp.daysUntil}d`}
                              </span>
                              <span style={{ fontSize: '0.73rem', color: '#9a3412', fontWeight: 600 }}>
                                {exp.formattedDate}
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                              <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#0f172a' }}>
                                {exp.formattedDate}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#15803d' }}>
                                ✓ {exp.daysUntil}d left
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isLow ? (
                            <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                              ⚠️ Low Stock
                            </span>
                          ) : (
                            <span className="badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                              ✓ Sufficient
                            </span>
                          )}
                        </td>
                        {canManageStock && (
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleAdjust(item.id, -5)}
                                title="Subtract 5"
                              >
                                -5
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleAdjust(item.id, -1)}
                                title="Subtract 1"
                              >
                                -1
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleAdjust(item.id, 1)}
                                title="Add 1"
                              >
                                +1
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleAdjust(item.id, 10)}
                                title="Add 10"
                              >
                                +10
                              </button>
                            </div>
                          </td>
                        )}
                        {canManageStock && (
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setEditingIng(item);
                                setIngFormData({
                                  name: item.name,
                                  unit: item.unit,
                                  cost_per_unit: item.cost_per_unit,
                                  stock_qty: item.stock_qty,
                                  low_stock_level: item.low_stock_level,
                                  expiry_date: item.expiry_date || ''
                                });
                                setIsIngModalOpen(true);
                              }}
                            >
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PURCHASES & VENDOR DUES                                            */}
      {/* ========================================================================= */}
      {activeTab === 'purchases' && (
        <div>
          {/* KPI Cards for Purchases */}
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="stats-card">
              <span className="stats-label">Total Stock Purchases</span>
              <span className="stats-value">₹{totalPurchasesAmount.toLocaleString('en-IN')}</span>
              <span className="stats-sub">Across {purchasesList.length} vendor purchase bills</span>
            </div>
            <div className="stats-card">
              <span className="stats-label">Amount Paid to Vendors</span>
              <span className="stats-value" style={{ color: 'var(--success)' }}>
                ₹{totalVendorPaidAmount.toLocaleString('en-IN')}
              </span>
              <span className="stats-sub">Paid via GPay, Cash &amp; Bank transfers</span>
            </div>
            <div className="stats-card" style={{ borderColor: totalVendorBalanceDue > 0 ? '#fca5a5' : 'inherit' }}>
              <span className="stats-label">Vendor Balance Due</span>
              <span className="stats-value" style={{ color: totalVendorBalanceDue > 0 ? '#dc2626' : 'var(--success)' }}>
                ₹{totalVendorBalanceDue.toLocaleString('en-IN')}
              </span>
              <span className="stats-sub">
                {unpaidPurchasesCount} bill{unpaidPurchasesCount === 1 ? '' : 's'} with pending dues
              </span>
            </div>
          </div>

          {/* Filters & Actions Bar */}
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: '1', minWidth: '240px' }}>
              <input
                type="text"
                placeholder="Search vendor name, purchase location, item, or bill #..."
                className="form-control"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Filter:</span>
              <button
                type="button"
                onClick={() => setPurchaseStatusFilter('all')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: purchaseStatusFilter === 'all' ? '#0f172a' : '#ffffff',
                  color: purchaseStatusFilter === 'all' ? '#ffffff' : '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                All ({purchasesList.length})
              </button>
              <button
                type="button"
                onClick={() => setPurchaseStatusFilter('unpaid')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #fca5a5',
                  background: purchaseStatusFilter === 'unpaid' ? '#dc2626' : '#fff1f2',
                  color: purchaseStatusFilter === 'unpaid' ? '#ffffff' : '#991b1b',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Unpaid / Credit ({purchasesList.filter((p) => p.payment_status === 'unpaid').length})
              </button>
              <button
                type="button"
                onClick={() => setPurchaseStatusFilter('partially_paid')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #fed7aa',
                  background: purchaseStatusFilter === 'partially_paid' ? '#ea580c' : '#fff7ed',
                  color: purchaseStatusFilter === 'partially_paid' ? '#ffffff' : '#9a3412',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Partially Paid ({purchasesList.filter((p) => p.payment_status === 'partially_paid').length})
              </button>
              <button
                type="button"
                onClick={() => setPurchaseStatusFilter('paid')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #bbf7d0',
                  background: purchaseStatusFilter === 'paid' ? '#16a34a' : '#f0fdf4',
                  color: purchaseStatusFilter === 'paid' ? '#ffffff' : '#166534',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Fully Paid ({purchasesList.filter((p) => p.payment_status === 'paid').length})
              </button>
            </div>
          </div>

          {/* Purchases Table */}
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Purchase Date &amp; Bill #</th>
                  <th>Vendor &amp; Location</th>
                  <th>Items Purchased</th>
                  <th style={{ textAlign: 'right' }}>Total Bill</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Balance Due</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No stock purchase records found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((purchase) => {
                    const hasDues = purchase.balance_amount > 0;
                    return (
                      <tr key={purchase.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            {new Date(purchase.purchase_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Bill: {purchase.bill_number || purchase.id}
                          </div>
                          {role === 'owner' && (
                            <OwnerAuditBadge
                              role={role}
                              entry={store.getEntityAudit(purchase.id, ['purchase'])}
                              prefixLabel="Updated by"
                            />
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            {purchase.vendor_name}
                          </div>
                          {purchase.vendor_location && (
                            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                              📍 {purchase.vendor_location}
                            </div>
                          )}
                          {purchase.vendor_phone && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              📞 {purchase.vendor_phone}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>
                            {purchase.items.map((it, idx) => (
                              <div key={idx} style={{ color: '#334155', lineHeight: 1.35 }}>
                                &bull; <strong>{it.item_name}</strong>: {it.quantity} {it.unit} @ ₹{it.unit_price}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>
                          ₹{purchase.total_amount.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                          ₹{purchase.paid_amount.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: hasDues ? '#dc2626' : '#16a34a', fontSize: '0.95rem' }}>
                          ₹{purchase.balance_amount.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="badge"
                            style={{
                              background:
                                purchase.payment_status === 'paid'
                                  ? '#dcfce7'
                                  : purchase.payment_status === 'partially_paid'
                                  ? '#ffedd5'
                                  : '#fee2e2',
                              color:
                                purchase.payment_status === 'paid'
                                  ? '#15803d'
                                  : purchase.payment_status === 'partially_paid'
                                  ? '#c2410c'
                                  : '#b91c1c'
                            }}
                          >
                            {purchase.payment_status === 'paid'
                              ? 'Fully Paid'
                              : purchase.payment_status === 'partially_paid'
                              ? 'Partially Paid'
                              : 'Unpaid / Credit'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {hasDues && canManageStock && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 600 }}
                                title="Pay Vendor Installment"
                                onClick={() => handleOpenPayVendor(purchase)}
                              >
                                + Pay Vendor
                              </button>
                            )}

                            <button
                              className="btn btn-secondary btn-sm"
                              title="View Purchase Details & Receipts"
                              onClick={() => setViewingPurchase(purchase)}
                            >
                              📜 View
                            </button>

                            {canManageStock && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ color: '#dc2626' }}
                                title="Delete purchase"
                                onClick={() => {
                                  if (confirm(`Delete purchase bill from ${purchase.vendor_name}?`)) {
                                    store.deleteStockPurchase(purchase.id);
                                  }
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD RAW INGREDIENT                                                 */}
      {/* ========================================================================= */}
      {isIngModalOpen && (
        <div className="modal-overlay" onClick={() => setIsIngModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingIng ? 'Edit Ingredient' : 'New Raw Ingredient'}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsIngModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleIngredientSubmit}>
              <div className="form-group">
                <label className="form-label">Ingredient Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Cardamom, Mutton, Ghee"
                  value={ingFormData.name}
                  onChange={(e) => setIngFormData({ ...ingFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Measurement Unit *</label>
                  <select
                    className="form-control"
                    value={ingFormData.unit}
                    onChange={(e) => setIngFormData({ ...ingFormData, unit: e.target.value })}
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="g">g (Gram)</option>
                    <option value="l">l (Liter)</option>
                    <option value="ml">ml (Milliliter)</option>
                    <option value="each">each (Count/Nos)</option>
                    <option value="box">box</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Purchase Cost / Unit (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={ingFormData.cost_per_unit}
                    onChange={(e) => setIngFormData({ ...ingFormData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Initial Stock Quantity *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control"
                    value={ingFormData.stock_qty}
                    onChange={(e) => setIngFormData({ ...ingFormData, stock_qty: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Low Stock Alert Level *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control"
                    value={ingFormData.low_stock_level}
                    onChange={(e) => setIngFormData({ ...ingFormData, low_stock_level: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Expiry Date (Optional)</label>
                  {ingFormData.expiry_date && (
                    <button
                      type="button"
                      onClick={() => setIngFormData({ ...ingFormData, expiry_date: '' })}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#dc2626',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Clear Date
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  className="form-control"
                  value={ingFormData.expiry_date}
                  onChange={(e) => setIngFormData({ ...ingFormData, expiry_date: e.target.value })}
                />
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Items within {NEAR_EXPIRY_DAYS} days of expiry are automatically flagged in the inventory table.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsIngModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingIng ? 'Update Stock Item' : 'Add to Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BULK UPDATE STOCK QUANTITIES                                       */}
      {/* ========================================================================= */}
      {isBulkModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBulkModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', width: '96%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  ⚡ Bulk Update Warehouse Stock
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  Select multiple ingredients and apply a uniform stock adjustment amount at once.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsBulkModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyBulkUpdate}>
              {bulkError && (
                <div
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginBottom: '0.85rem'
                  }}
                >
                  {bulkError}
                </div>
              )}

              {/* Step 1: Uniform Stock Adjustment Controls */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.95rem 1rem',
                  marginBottom: '1rem'
                }}
              >
                <div className="grid-2" style={{ gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Adjustment Type *</label>
                    <select
                      className="form-control"
                      value={bulkDirection}
                      onChange={(e) => setBulkDirection(e.target.value as 'add' | 'deduct')}
                    >
                      <option value="add">+ Add to Current Stock</option>
                      <option value="deduct">− Deduct from Current Stock</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Uniform Adjustment Amount *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      className="form-control"
                      value={bulkAmount || ''}
                      onChange={(e) => {
                        setBulkAmount(parseFloat(e.target.value) || 0);
                        setBulkError(null);
                      }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.65rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginRight: '0.2rem' }}>
                    Quick presets:
                  </span>
                  {[
                    { dir: 'add' as const, amt: 5, label: '+5' },
                    { dir: 'add' as const, amt: 10, label: '+10' },
                    { dir: 'add' as const, amt: 25, label: '+25' },
                    { dir: 'add' as const, amt: 50, label: '+50' },
                    { dir: 'deduct' as const, amt: 1, label: '-1' },
                    { dir: 'deduct' as const, amt: 5, label: '-5' },
                    { dir: 'deduct' as const, amt: 10, label: '-10' }
                  ].map((preset) => {
                    const isActive = bulkDirection === preset.dir && Number(bulkAmount) === preset.amt;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setBulkDirection(preset.dir);
                          setBulkAmount(preset.amt);
                        }}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '6px',
                          border: isActive ? '1px solid #4f46e5' : '1px solid #cbd5e1',
                          background: isActive ? '#4f46e5' : '#ffffff',
                          color: isActive ? '#ffffff' : '#334155',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Select Multiple Ingredients */}
              <div style={{ marginBottom: '1rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.5rem'
                  }}
                >
                  <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                    Select Ingredients ({selectedIngIds.length} of {state.ingredients.length} selected)
                  </label>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      onClick={() => {
                        setSelectedIngIds(state.ingredients.map((i) => i.id));
                        setBulkError(null);
                      }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      onClick={() => {
                        setSelectedIngIds(lowStockItems.map((i) => i.id));
                        setBulkError(null);
                      }}
                    >
                      Select Low Stock ({lowStockItems.length})
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      onClick={() => setSelectedIngIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Filter ingredients inside list..."
                  style={{ marginBottom: '0.5rem', fontSize: '0.84rem', padding: '0.45rem 0.65rem' }}
                  value={bulkModalSearch}
                  onChange={(e) => setBulkModalSearch(e.target.value)}
                />

                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#ffffff'
                  }}
                >
                  {state.ingredients
                    .filter((ing) =>
                      ing.name.toLowerCase().includes(bulkModalSearch.toLowerCase())
                    )
                    .map((ing) => {
                      const checked = selectedIngIds.includes(ing.id);
                      const delta =
                        bulkDirection === 'deduct'
                          ? -Math.abs(Number(bulkAmount) || 0)
                          : Math.abs(Number(bulkAmount) || 0);
                      const nextStock = Math.max(0, Number((ing.stock_qty + delta).toFixed(3)));
                      const exp = getIngredientExpiryStatus(ing.expiry_date);

                      return (
                        <label
                          key={ing.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.65rem',
                            padding: '0.55rem 0.75rem',
                            borderBottom: '1px solid #f1f5f9',
                            background: checked ? '#eef2ff' : '#ffffff',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelectIngredient(ing.id)}
                              style={{ width: '16px', height: '16px' }}
                            />
                            <div>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>{ing.name}</span>
                              {ing.stock_qty <= ing.low_stock_level && (
                                <span
                                  style={{
                                    marginLeft: '0.45rem',
                                    fontSize: '0.7rem',
                                    background: '#fef3c7',
                                    color: '#b45309',
                                    padding: '1px 6px',
                                    borderRadius: '8px',
                                    fontWeight: 600
                                  }}
                                >
                                  Low
                                </span>
                              )}
                              {(exp.status === 'expired' || exp.status === 'expiring_soon') && (
                                <span
                                  style={{
                                    marginLeft: '0.35rem',
                                    fontSize: '0.7rem',
                                    background: exp.status === 'expired' ? '#fee2e2' : '#ffedd5',
                                    color: exp.status === 'expired' ? '#991b1b' : '#c2410c',
                                    padding: '1px 6px',
                                    borderRadius: '8px',
                                    fontWeight: 600
                                  }}
                                >
                                  {exp.status === 'expired' ? 'Expired' : `Exp ${exp.daysUntil}d`}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', fontSize: '0.82rem' }}>
                            <span style={{ color: '#64748b' }}>
                              {ing.stock_qty} {ing.unit}
                            </span>
                            {checked && delta !== 0 && (
                              <span
                                style={{
                                  marginLeft: '0.4rem',
                                  fontWeight: 800,
                                  color: delta > 0 ? '#15803d' : '#dc2626'
                                }}
                              >
                                &rarr; {nextStock} {ing.unit}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsBulkModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 700 }}
                  disabled={selectedIngIds.length === 0 || !(Number(bulkAmount) > 0)}
                >
                  ⚡ Apply Bulk Update ({selectedIngIds.length} Item{selectedIngIds.length === 1 ? '' : 's'})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD STOCK PURCHASE                                              */}
      {/* ========================================================================= */}
      {isPurchaseModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPurchaseModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px', width: '96%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  🛒 Record Stock Purchase
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  Record vendor name, purchase location, bill amount, payments made, and pending balance.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsPurchaseModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePurchase}>
              {purchaseError && (
                <div
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginBottom: '0.85rem'
                  }}
                >
                  {purchaseError}
                </div>
              )}
              {/* Vendor & Location info */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #e2e8f0' }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Vendor / Store Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Metro Wholesale, Kozhikode Meat Stall"
                      value={purchaseForm.vendor_name}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, vendor_name: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Purchase Location / Place *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Palayam Market, Calicut"
                      value={purchaseForm.vendor_location}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, vendor_location: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid-3" style={{ marginTop: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Purchase Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={purchaseForm.purchase_date}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. +91 98470 12345"
                      value={purchaseForm.vendor_phone}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, vendor_phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Bill / Memo Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. MW-10294"
                      value={purchaseForm.bill_number}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, bill_number: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Items Purchased List */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0, fontSize: '0.9rem' }}>
                    Items Purchased:
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.8rem' }}
                  >
                    + Add Another Item
                  </button>
                </div>

                {purchaseItems.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 0.8fr 0.6fr 0.8fr 0.9fr auto',
                      gap: '0.5rem',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      padding: '0.65rem',
                      borderRadius: '6px',
                      marginBottom: '0.5rem'
                    }}
                  >
                    {/* Item Name / Select Existing */}
                    <div>
                      <select
                        className="form-control"
                        style={{ fontSize: '0.82rem', padding: '0.4rem 0.5rem', marginBottom: '0.25rem' }}
                        value={item.ingredient_id}
                        onChange={(e) => handleItemChange(index, 'ingredient_id', e.target.value)}
                      >
                        <option value="">-- Or Select from Pantry --</option>
                        {state.ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.stock_qty} {ing.unit} in stock)
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Item name (e.g. Rice, Ghee)"
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}
                        value={item.item_name}
                        onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                        required
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        required
                        min={0.01}
                      />
                    </div>

                    {/* Unit */}
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Unit</label>
                      <input
                        type="text"
                        className="form-control"
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        required
                      />
                    </div>

                    {/* Unit Price */}
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Rate (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        required
                        min={0}
                      />
                    </div>

                    {/* Line Total */}
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Total (₹)</label>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', padding: '0.4rem 0' }}>
                        ₹{item.total_price.toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* Delete Item row */}
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'transparent' }}>X</label>
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(index)}
                        disabled={purchaseItems.length === 1}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: purchaseItems.length === 1 ? '#cbd5e1' : '#dc2626',
                          cursor: purchaseItems.length === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '1rem',
                          padding: '0.3rem'
                        }}
                        title="Remove row"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Warehouse auto-update checkbox */}
              <div style={{ marginBottom: '1.25rem', background: '#ecfdf5', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: '#065f46' }}>
                  <input
                    type="checkbox"
                    checked={purchaseForm.updateWarehouseStock}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, updateWarehouseStock: e.target.checked })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span>
                    Auto-add quantities to Warehouse Stock
                  </span>
                </label>
              </div>

              {/* Payment details: Total, Paid, Balance */}
              <div style={{ background: '#f1f5f9', padding: '1rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Total Purchase Amount:</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    ₹{totalCalculatedBill.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="grid-2" style={{ gap: '1rem', marginTop: '0.5rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Amount Paid Now (₹) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      className="form-control"
                      value={purchaseForm.paid_amount}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, paid_amount: parseFloat(e.target.value) || 0 })}
                      required
                      min={0}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Payment Method
                    </label>
                    <select
                      className="form-control"
                      value={purchaseForm.payment_method}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, payment_method: e.target.value })}
                    >
                      <option value="UPI / GPay">UPI / Google Pay / PhonePe</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Credit">Credit (Pay Later)</option>
                    </select>
                  </div>
                </div>

                {/* Live Balance Payable calculation */}
                {(() => {
                  const paid = Number(purchaseForm.paid_amount) || 0;
                  const balance = Math.max(0, totalCalculatedBill - paid);
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid #cbd5e1' }}>
                      <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>
                        Balance Payable to Vendor:
                      </span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: balance > 0 ? '#dc2626' : '#16a34a' }}>
                        ₹{balance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Notes / Remarks</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Balance to be paid on 10th of next month, delivery by truck..."
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPurchaseModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                  Save Purchase Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PAY VENDOR INSTALLMENT                                             */}
      {/* ========================================================================= */}
      {payingPurchase && (
        <div className="modal-overlay" onClick={() => setPayingPurchase(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '95%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                  💳 Pay Vendor ({payingPurchase.vendor_name})
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  Record payment made to vendor towards outstanding dues.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setPayingPurchase(null)}>
                ✕
              </button>
            </div>

            {/* Dues summary box */}
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span>Store / Vendor:</span>
                <strong>{payingPurchase.vendor_name} ({payingPurchase.vendor_location})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span>Bill Total:</span>
                <strong>₹{payingPurchase.total_amount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', color: '#16a34a' }}>
                <span>Already Paid:</span>
                <strong>₹{payingPurchase.paid_amount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 700, fontSize: '0.95rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.35rem' }}>
                <span>Current Balance Due:</span>
                <span>₹{payingPurchase.balance_amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <form onSubmit={handleRecordVendorPayment}>
              <div className="form-group">
                <label className="form-label">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="1"
                  className="form-control"
                  value={vendorPayForm.amount}
                  onChange={(e) => setVendorPayForm({ ...vendorPayForm, amount: parseFloat(e.target.value) || 0 })}
                  required
                  min={1}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-control"
                  value={vendorPayForm.method}
                  onChange={(e) => setVendorPayForm({ ...vendorPayForm, method: e.target.value })}
                >
                  <option value="UPI / GPay">UPI / Google Pay / PhonePe</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={vendorPayForm.paid_at}
                  onChange={(e) => setVendorPayForm({ ...vendorPayForm, paid_at: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reference Note / Transaction ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. GPay ref #81023, Part settlement..."
                  value={vendorPayForm.note}
                  onChange={(e) => setVendorPayForm({ ...vendorPayForm, note: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPayingPurchase(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW PURCHASE DETAILS & INSTALLMENTS HISTORY                        */}
      {/* ========================================================================= */}
      {viewingPurchase && (
        <div className="modal-overlay" onClick={() => setViewingPurchase(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', width: '95%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  📜 Purchase Bill &amp; Payment History
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  {viewingPurchase.vendor_name} &bull; {viewingPurchase.vendor_location}
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewingPurchase(null)}>
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                <span>Bill Number:</span>
                <strong>{viewingPurchase.bill_number || 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                <span>Purchase Date:</span>
                <strong>{new Date(viewingPurchase.purchase_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
              </div>
              {viewingPurchase.vendor_phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                  <span>Vendor Phone:</span>
                  <strong>{viewingPurchase.vendor_phone}</strong>
                </div>
              )}
              {viewingPurchase.notes && (
                <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.4rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.35rem' }}>
                  <em>Note: {viewingPurchase.notes}</em>
                </div>
              )}
            </div>

            {/* Items list */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                Items Purchased:
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #0f172a', background: '#f1f5f9' }}>
                    <th style={{ textAlign: 'left', padding: '0.4rem' }}>Item</th>
                    <th style={{ textAlign: 'center', padding: '0.4rem' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem' }}>Rate</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingPurchase.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.4rem', fontWeight: 600 }}>{it.item_name}</td>
                      <td style={{ textAlign: 'center', padding: '0.4rem' }}>{it.quantity} {it.unit}</td>
                      <td style={{ textAlign: 'right', padding: '0.4rem' }}>₹{it.unit_price}</td>
                      <td style={{ textAlign: 'right', padding: '0.4rem', fontWeight: 700 }}>₹{it.total_price.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total / Paid / Balance summary */}
            <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span>Total Bill Amount:</span>
                <strong>₹{viewingPurchase.total_amount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: '#16a34a' }}>
                <span>Amount Paid:</span>
                <strong>₹{viewingPurchase.paid_amount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: viewingPurchase.balance_amount > 0 ? '#dc2626' : '#16a34a', fontWeight: 800, fontSize: '1rem', borderTop: '1px solid #cbd5e1', paddingTop: '0.35rem' }}>
                <span>Balance Due:</span>
                <span>₹{viewingPurchase.balance_amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Installment payments history */}
            {(() => {
              const purchasePayments = (state.stockPurchasePayments || []).filter((p) => p.purchase_id === viewingPurchase.id);
              return (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                    Payment Receipts / Installments History ({purchasePayments.length}):
                  </div>
                  {purchasePayments.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      No separate payment receipts recorded.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
                          <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem' }}>Date</th>
                          <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem' }}>Method</th>
                          <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem' }}>Note / Ref</th>
                          <th style={{ textAlign: 'right', padding: '0.35rem 0.25rem' }}>Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchasePayments.map((p) => (
                          <tr key={p.id} style={{ borderBottom: '1px dashed #e2e8f0' }}>
                            <td style={{ padding: '0.35rem 0.25rem' }}>
                              {new Date(p.paid_at).toLocaleDateString('en-GB')}
                            </td>
                            <td style={{ padding: '0.35rem 0.25rem', fontWeight: 500 }}>{p.method}</td>
                            <td style={{ padding: '0.35rem 0.25rem', color: '#64748b' }}>{p.note || '-'}</td>
                            <td style={{ textAlign: 'right', padding: '0.35rem 0.25rem', fontWeight: 700, color: '#16a34a' }}>
                              ₹{p.amount.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewingPurchase(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
