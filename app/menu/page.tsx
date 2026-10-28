'use client';

import React, { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { MenuItem } from '@/lib/types';

export default function MenuPage() {
  const [state, setState] = useState(store.getState());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Recipe management modal
  const [recipeDish, setRecipeDish] = useState<MenuItem | null>(null);
  const [recipeLines, setRecipeLines] = useState<{ ingredient_id: string; qty_per_guest: number }[]>([]);

  // Dish form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'Main',
    description: '',
    price_per_guest: 250,
    active: true
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const canEditMenu = role === 'owner' || role === 'manager' || role === 'chef';

  const categories = ['all', 'Starter', 'Main', 'Dessert', 'Drink', 'Bread'];

  const filteredItems = state.menuItems.filter((item) => {
    return selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  const handleSaveDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingItem) {
      store.updateMenuItem(editingItem.id, formData);
    } else {
      store.addMenuItem(formData);
    }
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({ name: '', category: 'Main', description: '', price_per_guest: 250, active: true });
  };

  const handleOpenRecipe = (dish: MenuItem) => {
    setRecipeDish(dish);
    const existing = state.recipes.filter((r) => r.menu_item_id === dish.id);
    setRecipeLines(existing.map((r) => ({ ingredient_id: r.ingredient_id, qty_per_guest: r.qty_per_guest })));
  };

  const handleSaveRecipe = () => {
    if (!recipeDish) return;
    store.setRecipeIngredients(recipeDish.id, recipeLines);
    setRecipeDish(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Menu &amp; Culinary Recipes</h1>
          <p className="page-subtitle">
            Configure banquet dishes, guest per-head pricing, and kitchen ingredient scaling recipes.
          </p>
        </div>
        <div>
          {canEditMenu && (
            <button
              onClick={() => {
                setEditingItem(null);
                setFormData({ name: '', category: 'Main', description: '', price_per_guest: 250, active: true });
                setIsModalOpen(true);
              }}
              className="btn btn-primary"
            >
              + Add Menu Item
            </button>
          )}
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
            style={{ textTransform: 'capitalize' }}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Dishes Grid */}
      <div className="grid-3">
        {filteredItems.map((dish) => {
          const recipeForThis = state.recipes.filter((r) => r.menu_item_id === dish.id);
          return (
            <div
              key={dish.id}
              className="card"
              style={{
                opacity: dish.active ? 1 : 0.65,
                borderLeft: dish.active ? '4px solid var(--primary)' : '4px solid #cbd5e1'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="badge" style={{ background: '#f1f5f9' }}>{dish.category}</span>
                <span
                  className="badge"
                  style={{
                    background: dish.active ? '#dcfce7' : '#f1f5f9',
                    color: dish.active ? '#15803d' : '#64748b'
                  }}
                >
                  {dish.active ? 'Active' : 'Hidden'}
                </span>
              </div>

              <div style={{ margin: '0.75rem 0' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{dish.name}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', minHeight: '38px' }}>
                  {dish.description || 'No description added.'}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Price per Guest</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>
                    ₹{dish.price_per_guest}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    title="View/Edit Recipe"
                    onClick={() => handleOpenRecipe(dish)}
                  >
                    🍲 Recipe ({recipeForThis.length})
                  </button>

                  {canEditMenu && (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          store.updateMenuItem(dish.id, { active: !dish.active });
                        }}
                        title={dish.active ? 'Hide dish' : 'Show dish'}
                      >
                        {dish.active ? 'Hide' : 'Show'}
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingItem(dish);
                          setFormData({
                            name: dish.name,
                            category: dish.category,
                            description: dish.description || '',
                            price_per_guest: dish.price_per_guest,
                            active: dish.active
                          });
                          setIsModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dish Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingItem ? 'Edit Dish Details' : 'Add New Menu Item'}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveDish}>
              <div className="form-group">
                <label className="form-label">Dish Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Kozhikodan Biryani, Fish Moilee"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-control"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="Starter">Starter</option>
                    <option value="Main">Main Course</option>
                    <option value="Dessert">Dessert</option>
                    <option value="Drink">Drink / Beverage</option>
                    <option value="Bread">Bread / Roti</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Price Per Guest (₹) *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.price_per_guest}
                    onChange={(e) => setFormData({ ...formData, price_per_guest: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description / Preparation Notes</label>
                <textarea
                  rows={3}
                  className="form-control"
                  placeholder="Flavor notes, preparation methods, allergen details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                />
                <label htmlFor="activeCheck" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Available in active quote catalog
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingItem ? 'Save Updates' : 'Add Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Modal */}
      {recipeDish && (
        <div className="modal-overlay" onClick={() => setRecipeDish(null)}>
          <div className="modal-content" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  Kitchen Recipe: {recipeDish.name}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Specify the quantity of each ingredient needed per 1 guest. Headcounts in events will scale these automatically.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setRecipeDish(null)}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              {recipeLines.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem', textAlign: 'center' }}>
                  No ingredients configured for this dish recipe yet. Add ingredients below.
                </p>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Qty per Guest</th>
                        <th>Unit</th>
                        {canEditMenu && <th style={{ textAlign: 'center' }}>Remove</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {recipeLines.map((line, idx) => {
                        const ing = state.ingredients.find((i) => i.id === line.ingredient_id);
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{ing?.name || 'Unknown'}</td>
                            <td>
                              <input
                                type="number"
                                step="0.001"
                                className="form-control"
                                style={{ width: '110px', padding: '0.3rem 0.5rem' }}
                                value={line.qty_per_guest}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const updated = [...recipeLines];
                                  updated[idx].qty_per_guest = val;
                                  setRecipeLines(updated);
                                }}
                                disabled={!canEditMenu}
                              />
                            </td>
                            <td>{ing?.unit}</td>
                            {canEditMenu && (
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => {
                                    setRecipeLines(recipeLines.filter((_, i) => i !== idx));
                                  }}
                                >
                                  ✕
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add ingredient row */}
              {canEditMenu && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                  <select
                    className="form-control"
                    id="addIngSelect"
                    defaultValue=""
                    style={{ flex: 1 }}
                  >
                    <option value="" disabled>Select ingredient to add...</option>
                    {state.ingredients
                      .filter((ing) => !recipeLines.some((rl) => rl.ingredient_id === ing.id))
                      .map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                  </select>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Qty / guest"
                    className="form-control"
                    id="addIngQty"
                    style={{ width: '130px' }}
                    defaultValue="0.1"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const sel = document.getElementById('addIngSelect') as HTMLSelectElement;
                      const qty = document.getElementById('addIngQty') as HTMLInputElement;
                      if (sel.value && qty.value) {
                        setRecipeLines([
                          ...recipeLines,
                          { ingredient_id: sel.value, qty_per_guest: parseFloat(qty.value) || 0 }
                        ]);
                        sel.value = '';
                      }
                    }}
                  >
                    + Add
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRecipeDish(null)}>
                Close
              </button>
              {canEditMenu && (
                <button type="button" className="btn btn-primary" onClick={handleSaveRecipe}>
                  Save Recipe
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
