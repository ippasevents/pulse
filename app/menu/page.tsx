'use client';

import React, { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { MenuItem, PricingType } from '@/lib/types';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';

export default function MenuPage() {
  const [state, setState] = useState(store.getState());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPricingType, setSelectedPricingType] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Recipe management modal
  const [recipeDish, setRecipeDish] = useState<MenuItem | null>(null);
  const [recipeLines, setRecipeLines] = useState<{ ingredient_id: string; qty_per_guest: number }[]>([]);

  // Dish form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'Main',
    pricing_type: 'per_guest' as PricingType,
    description: '',
    price_per_unit: 250,
    active: true
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const canEditMenu = role === 'owner' || role === 'manager';

  const categories = ['all', 'Starter', 'Main', 'Dessert', 'Drink', 'Bread'];

  const filteredItems = state.menuItems.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesPricing =
      selectedPricingType === 'all' ||
      (selectedPricingType === 'per_guest' && (item.pricing_type === 'per_guest' || !item.pricing_type)) ||
      (selectedPricingType === 'per_kg' && item.pricing_type === 'per_kg');
    return matchesCat && matchesPricing;
  });

  const handleSaveDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const payload = {
      ...formData,
      price_per_guest: formData.price_per_unit
    };

    if (editingItem) {
      store.updateMenuItem(editingItem.id, payload);
    } else {
      store.addMenuItem(payload);
    }
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({
      name: '',
      category: 'Main',
      pricing_type: 'per_guest',
      description: '',
      price_per_unit: 250,
      active: true
    });
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
            Configure banquet dishes with Per Guest or Per Kg rates and kitchen recipe ingredients.
          </p>
        </div>
        <div>
          {canEditMenu && (
            <button
              onClick={() => {
                setEditingItem(null);
                setFormData({
                  name: '',
                  category: 'Main',
                  pricing_type: 'per_guest',
                  description: '',
                  price_per_unit: 250,
                  active: true
                });
                setIsModalOpen(true);
              }}
              className="btn btn-primary"
            >
              + Add Menu Item
            </button>
          )}
        </div>
      </div>

      {/* Category & Pricing Type Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
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

        {/* Pricing Type Filter Chips */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pricing Type:</span>
          <button
            className={`btn btn-sm ${selectedPricingType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            onClick={() => setSelectedPricingType('all')}
          >
            All
          </button>
          <button
            className={`btn btn-sm ${selectedPricingType === 'per_guest' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            onClick={() => setSelectedPricingType('per_guest')}
          >
            👥 Per Guest
          </button>
          <button
            className={`btn btn-sm ${selectedPricingType === 'per_kg' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            onClick={() => setSelectedPricingType('per_kg')}
          >
            ⚖️ Per Kg
          </button>
        </div>
      </div>

      {/* Dishes Grid */}
      <div className="grid-3">
        {filteredItems.map((dish) => {
          const recipeForThis = state.recipes.filter((r) => r.menu_item_id === dish.id);
          const isKg = dish.pricing_type === 'per_kg';
          const price = dish.price_per_unit || dish.price_per_guest || 0;

          return (
            <div
              key={dish.id}
              className="card"
              style={{
                opacity: dish.active ? 1 : 0.65,
                borderLeft: dish.active ? (isKg ? '4px solid #059669' : '4px solid var(--primary)') : '4px solid #cbd5e1'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: '#f1f5f9' }}>{dish.category}</span>
                  <span
                    className="badge"
                    style={{
                      background: isKg ? '#f0fdf4' : '#eff6ff',
                      color: isKg ? '#166534' : '#1e40af',
                      fontWeight: 600
                    }}
                  >
                    {isKg ? '⚖️ Per Kg' : '👥 Per Guest'}
                  </span>
                </div>

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
                {role === 'owner' && (
                  <OwnerAuditBadge
                    role={role}
                    entry={store.getEntityAudit(dish.id, ['menu', 'recipe'])}
                    prefixLabel="Updated by"
                  />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {isKg ? 'Price Per Kilogram' : 'Price Per Guest'}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isKg ? '#059669' : 'var(--primary)' }}>
                    ₹{price} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>{isKg ? '/ kg' : '/ guest'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    title="View/Edit Recipe Ingredients"
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
                            pricing_type: dish.pricing_type || 'per_guest',
                            description: dish.description || '',
                            price_per_unit: dish.price_per_unit || dish.price_per_guest || 250,
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
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
                <label className="form-label">Dish / Menu Item Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Kozhikodan Mutton Biriyani, Halwa, Chicken 65"
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
                  <label className="form-label">Pricing Mode *</label>
                  <select
                    className="form-control"
                    value={formData.pricing_type}
                    onChange={(e) => setFormData({ ...formData, pricing_type: e.target.value as PricingType })}
                  >
                    <option value="per_guest">👥 Per Guest</option>
                    <option value="per_kg">⚖️ Per Kilogram (Kg)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {formData.pricing_type === 'per_kg'
                    ? 'Price Per Kilogram (₹) *'
                    : 'Price Per Guest (₹) *'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-control"
                  value={formData.price_per_unit}
                  onChange={(e) => setFormData({ ...formData, price_per_unit: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Preparation Notes</label>
                <textarea
                  rows={3}
                  className="form-control"
                  placeholder="Flavor notes, portion details, allergen info..."
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
                  Available in active banquet quote catalog
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
                  {editingItem ? 'Save Changes' : 'Create Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Modal */}
      {recipeDish && (
        <div className="modal-overlay" onClick={() => setRecipeDish(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Kitchen Recipe: {recipeDish.name}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {recipeDish.pricing_type === 'per_kg'
                    ? 'Define raw ingredients needed per 1 KG of this dish'
                    : 'Define raw ingredients needed per 1 GUEST (pax scaling)'}
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setRecipeDish(null)}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Recipe Ingredients ({recipeDish.pricing_type === 'per_kg' ? 'Per 1 KG' : 'Per 1 Guest'})
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const firstAvailable = state.ingredients[0];
                    if (firstAvailable) {
                      setRecipeLines([...recipeLines, { ingredient_id: firstAvailable.id, qty_per_guest: 0.1 }]);
                    }
                  }}
                >
                  + Add Ingredient Line
                </button>
              </div>

              {recipeLines.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '8px' }}>
                  No scaled ingredients configured yet for this dish.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {recipeLines.map((line, idx) => {
                    const ingObj = state.ingredients.find((i) => i.id === line.ingredient_id);
                    return (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                          className="form-control"
                          style={{ flex: 2 }}
                          value={line.ingredient_id}
                          onChange={(e) => {
                            const updated = [...recipeLines];
                            updated[idx].ingredient_id = e.target.value;
                            setRecipeLines(updated);
                          }}
                        >
                          {state.ingredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} ({ing.unit}) - ₹{ing.cost_per_unit}/{ing.unit}
                            </option>
                          ))}
                        </select>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1.2 }}>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            className="form-control"
                            value={line.qty_per_guest}
                            onChange={(e) => {
                              const updated = [...recipeLines];
                              updated[idx].qty_per_guest = parseFloat(e.target.value) || 0;
                              setRecipeLines(updated);
                            }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '25px' }}>
                            {ingObj?.unit || 'unit'}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            setRecipeLines(recipeLines.filter((_, i) => i !== idx));
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRecipeDish(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveRecipe} style={{ fontWeight: 600 }}>
                Save Recipe Formula
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
