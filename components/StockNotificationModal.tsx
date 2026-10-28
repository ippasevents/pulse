'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { Ingredient } from '@/lib/types';

interface StockNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StockNotificationModal({ isOpen, onClose }: StockNotificationModalProps) {
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(25);

  if (!isOpen) return null;

  const state = store.getState();
  const lowStockItems = state.ingredients.filter((i) => i.stock_qty <= i.low_stock_level);
  const outOfStockItems = state.ingredients.filter((i) => i.stock_qty <= 0);

  const handleRestock = (ing: Ingredient) => {
    store.adjustStock(ing.id, restockAmount);
    setAdjustingId(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', width: '92%' }}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🔔</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Stock Alerts &amp; Notifications
              </h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Automated warehouse inventory alerts when items reach or drop below safety levels.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        {lowStockItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>
              All Stock Levels are Healthy
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              All pantry ingredients are currently above their minimum safety thresholds.
            </p>
          </div>
        ) : (
          <div>
            <div
              style={{
                background: outOfStockItems.length > 0 ? '#fee2e2' : '#fffbeb',
                border: `1px solid ${outOfStockItems.length > 0 ? '#fecaca' : '#fde68a'}`,
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: outOfStockItems.length > 0 ? '#991b1b' : '#92400e'
              }}
            >
              ⚠️ <strong>{lowStockItems.length} pantry ingredients</strong> are below safety threshold
              {outOfStockItems.length > 0 && ` (${outOfStockItems.length} completely out of stock)`}.
            </div>

            <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {lowStockItems.map((item) => {
                const isZero = item.stock_qty <= 0;
                return (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '0.75rem 0.85rem',
                      background: isZero ? '#fef2f2' : '#ffffff',
                      borderLeft: `4px solid ${isZero ? '#ef4444' : '#f59e0b'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Unit Rate: ₹{item.cost_per_unit} / {item.unit} &bull; Min Alert Level: {item.low_stock_level} {item.unit}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span
                          className="badge"
                          style={{
                            background: isZero ? '#dc2626' : '#d97706',
                            color: '#ffffff',
                            fontWeight: 700
                          }}
                        >
                          {isZero ? 'OUT OF STOCK' : `${item.stock_qty} ${item.unit} Remaining`}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Current Stock: <strong>{item.stock_qty} {item.unit}</strong>
                      </span>

                      {adjustingId === item.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            style={{ width: '80px', padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                            value={restockAmount}
                            onChange={(e) => setRestockAmount(Number(e.target.value))}
                          />
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => handleRestock(item)}
                          >
                            + Add {item.unit}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                            onClick={() => setAdjustingId(null)}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', fontWeight: 600 }}
                          onClick={() => {
                            setAdjustingId(item.id);
                            setRestockAmount(Math.max(10, Math.ceil(item.low_stock_level * 1.5)));
                          }}
                        >
                          ⚡ Quick Restock
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <Link
                href="/stock"
                onClick={onClose}
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 600 }}
              >
                Go to Stock Management &rarr;
              </Link>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
