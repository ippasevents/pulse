'use client';

import React, { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { Ingredient } from '@/lib/types';

export default function StockPage() {
  const [state, setState] = useState(store.getState());
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',
    cost_per_unit: 100,
    stock_qty: 50,
    low_stock_level: 15
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const canEditStock = role === 'owner' || role === 'manager' || role === 'chef';

  const filtered = state.ingredients.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockItems = state.ingredients.filter((i) => i.stock_qty <= i.low_stock_level);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingIng) {
      store.updateIngredient(editingIng.id, formData);
    } else {
      store.addIngredient(formData);
    }
    setIsModalOpen(false);
    setEditingIng(null);
    setFormData({ name: '', unit: 'kg', cost_per_unit: 100, stock_qty: 50, low_stock_level: 15 });
  };

  const handleAdjust = (id: string, delta: number) => {
    store.adjustStock(id, delta);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pantry &amp; Raw Material Stock</h1>
          <p className="page-subtitle">
            Track ingredients warehouse stock, threshold alert levels, and per-unit purchase costs.
          </p>
        </div>
        <div>
          {canEditStock && (
            <button
              onClick={() => {
                setEditingIng(null);
                setFormData({ name: '', unit: 'kg', cost_per_unit: 100, stock_qty: 50, low_stock_level: 15 });
                setIsModalOpen(true);
              }}
              className="btn btn-primary"
            >
              + Add Raw Ingredient
            </button>
          )}
        </div>
      </div>

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

      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <input
          type="text"
          placeholder="Search pantry ingredients (e.g. Basmati, Mutton, Ghee)..."
          className="form-control"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ingredient Name</th>
              <th>Unit</th>
              <th style={{ textAlign: 'right' }}>Cost / Unit</th>
              <th style={{ textAlign: 'right' }}>Current Stock</th>
              <th style={{ textAlign: 'right' }}>Low Stock Alert Level</th>
              <th style={{ textAlign: 'center' }}>Stock Health</th>
              {canEditStock && <th style={{ textAlign: 'center' }}>Quick Adjust</th>}
              {canEditStock && <th style={{ textAlign: 'center' }}>Edit</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No ingredients found in stock.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isLow = item.stock_qty <= item.low_stock_level;
                return (
                  <tr key={item.id} style={{ background: isLow ? '#fffbeb' : 'transparent' }}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
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
                    {canEditStock && (
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
                    {canEditStock && (
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingIng(item);
                            setFormData({
                              name: item.name,
                              unit: item.unit,
                              cost_per_unit: item.cost_per_unit,
                              stock_qty: item.stock_qty,
                              low_stock_level: item.low_stock_level
                            });
                            setIsModalOpen(true);
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

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingIng ? 'Edit Ingredient' : 'New Raw Ingredient'}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Ingredient Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Cardamom, Mutton, Ghee"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Measurement Unit *</label>
                  <select
                    className="form-control"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
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
                    value={formData.cost_per_unit}
                    onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) || 0 })}
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
                    value={formData.stock_qty}
                    onChange={(e) => setFormData({ ...formData, stock_qty: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Low Stock Alert Level *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control"
                    value={formData.low_stock_level}
                    onChange={(e) => setFormData({ ...formData, low_stock_level: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
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
    </div>
  );
}
