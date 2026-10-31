'use client';

import React, { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { MenuItem, PricingType } from '@/lib/types';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';

const CREATE_NEW_ING_VALUE = '__CREATE_NEW_INGREDIENT__';

export default function MenuPage() {
  const [state, setState] = useState(store.getState());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPricingType, setSelectedPricingType] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Recipe management modal
  const [recipeDish, setRecipeDish] = useState<MenuItem | null>(null);
  const [recipeLines, setRecipeLines] = useState<{ ingredient_id: string; qty_per_guest: number }[]>([]);

  // Inline "Add Ingredient Not in Stock" panel inside Recipe Modal
  const [showNewIngPanel, setShowNewIngPanel] = useState(false);
  const [targetLineIdxForNewIng, setTargetLineIdxForNewIng] = useState<number | null>(null);
  const [newIngError, setNewIngError] = useState<string | null>(null);
  const [newIngForm, setNewIngForm] = useState({
    name: '',
    unit: 'kg',
    cost_per_unit: 120,
    stock_qty: 0,
    low_stock_level: 5,
    qty_per_guest: 0.1
  });

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

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const role = state.currentRole;
  const canEditMenu = role === 'owner' || role === 'manager' || role === 'super_admin';

  const categories = ['all', 'Starter', 'Main', 'Dessert', 'Drink', 'Bread'];

  const filteredItems = state.menuItems.filter((item) => {
    const matchesCat =
      selectedCategory === 'all' ||
      item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesPricing =
      selectedPricingType === 'all' ||
      (selectedPricingType === 'per_guest' &&
        (item.pricing_type === 'per_guest' || !item.pricing_type)) ||
      (selectedPricingType === 'per_kg' && item.pricing_type === 'per_kg');
    return matchesCat && matchesPricing;
  });

  const resetDishForm = () => {
    setFormData({
      name: '',
      category: 'Main',
      pricing_type: 'per_guest',
      description: '',
      price_per_unit: 250,
      active: true
    });
  };

  const saveDishAndOptionallyOpenRecipe = (openRecipeAfter: boolean) => {
    if (!formData.name.trim()) return;

    const payload = {
      ...formData,
      name: formData.name.trim(),
      price_per_guest: formData.price_per_unit
    };

    let savedDish: MenuItem | null = null;
    if (editingItem) {
      store.updateMenuItem(editingItem.id, payload);
      savedDish = { ...editingItem, ...payload };
      showToast(`Updated menu item "${payload.name}".`);
    } else {
      savedDish = store.addMenuItem(payload);
      showToast(`Created menu item "${payload.name}".`);
    }

    setIsModalOpen(false);
    setEditingItem(null);
    resetDishForm();

    if (openRecipeAfter && savedDish) {
      handleOpenRecipe(savedDish);
    }
  };

  const handleSaveDish = (e: React.FormEvent) => {
    e.preventDefault();
    saveDishAndOptionallyOpenRecipe(false);
  };

  const resetNewIngForm = () => {
    setNewIngForm({
      name: '',
      unit: 'kg',
      cost_per_unit: 120,
      stock_qty: 0,
      low_stock_level: 5,
      qty_per_guest: 0.1
    });
    setNewIngError(null);
    setTargetLineIdxForNewIng(null);
  };

  const handleOpenRecipe = (dish: MenuItem) => {
    setRecipeDish(dish);
    const latestState = store.getState();
    const existing = latestState.recipes.filter((r) => r.menu_item_id === dish.id);
    setRecipeLines(
      existing.map((r) => ({
        ingredient_id: r.ingredient_id,
        qty_per_guest: r.qty_per_guest
      }))
    );
    setShowNewIngPanel(false);
    resetNewIngForm();
  };

  const handleCreateAndAddNonStockIngredient = () => {
    const cleanName = newIngForm.name.trim();
    if (!cleanName) {
      setNewIngError('Please enter the ingredient name.');
      return;
    }

    // Check if an ingredient with the exact same name already exists in warehouse stock
    const existingMatch = state.ingredients.find(
      (i) => i.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    const targetIng =
      existingMatch ||
      store.addIngredient({
        name: cleanName,
        unit: newIngForm.unit || 'kg',
        cost_per_unit: Math.max(0, Number(newIngForm.cost_per_unit) || 0),
        stock_qty: Math.max(0, Number(newIngForm.stock_qty) || 0),
        low_stock_level: Math.max(0, Number(newIngForm.low_stock_level) || 0)
      });

    const recipeQty =
      Number(newIngForm.qty_per_guest) > 0 ? Number(newIngForm.qty_per_guest) : 0.1;

    if (targetLineIdxForNewIng !== null && recipeLines[targetLineIdxForNewIng]) {
      const updated = [...recipeLines];
      updated[targetLineIdxForNewIng] = {
        ingredient_id: targetIng.id,
        qty_per_guest: recipeQty
      };
      setRecipeLines(updated);
    } else {
      const existingLineIdx = recipeLines.findIndex(
        (l) => l.ingredient_id === targetIng.id
      );
      if (existingLineIdx >= 0) {
        const updated = [...recipeLines];
        updated[existingLineIdx] = {
          ingredient_id: targetIng.id,
          qty_per_guest: recipeQty
        };
        setRecipeLines(updated);
      } else {
        setRecipeLines((prev) => [
          ...prev,
          { ingredient_id: targetIng.id, qty_per_guest: recipeQty }
        ]);
      }
    }

    setShowNewIngPanel(false);
    resetNewIngForm();
    showToast(
      existingMatch
        ? `Added "${targetIng.name}" to recipe.`
        : `Created "${targetIng.name}" (${targetIng.stock_qty} ${targetIng.unit} in stock) & added to recipe!`
    );
  };

  const handleSaveRecipe = () => {
    if (!recipeDish) return;
    store.setRecipeIngredients(recipeDish.id, recipeLines);
    showToast(`Saved kitchen recipe for "${recipeDish.name}".`);
    setRecipeDish(null);
    setShowNewIngPanel(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Menu &amp; Culinary Recipes</h1>
          <p className="page-subtitle">
            Configure banquet dishes with Per Guest or Per Kg rates and kitchen recipe ingredients (including items not yet in stock).
          </p>
        </div>
        <div>
          {canEditMenu && (
            <button
              onClick={() => {
                setEditingItem(null);
                resetDishForm();
                setIsModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ whiteSpace: 'nowrap' }}
            >
              + Add Menu Item
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '0.7rem 1rem',
            borderRadius: '10px',
            marginBottom: '1.15rem',
            fontWeight: 700,
            fontSize: '0.88rem'
          }}
        >
          ✓ {notice}
        </div>
      )}

      {/* Category & Pricing Type Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.25rem'
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textTransform: 'capitalize', whiteSpace: 'nowrap' }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Pricing Type Filter Controls */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Pricing:
          </span>
          <button
            className={`btn btn-sm ${selectedPricingType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.22rem 0.55rem', whiteSpace: 'nowrap' }}
            onClick={() => setSelectedPricingType('all')}
          >
            All
          </button>
          <button
            className={`btn btn-sm ${selectedPricingType === 'per_guest' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.22rem 0.55rem', whiteSpace: 'nowrap' }}
            onClick={() => setSelectedPricingType('per_guest')}
          >
            Per Guest
          </button>
          <button
            className={`btn btn-sm ${selectedPricingType === 'per_kg' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '0.22rem 0.55rem', whiteSpace: 'nowrap' }}
            onClick={() => setSelectedPricingType('per_kg')}
          >
            Per Kg
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
                borderTop: dish.active
                  ? isKg
                    ? '3px solid #059669'
                    : '3px solid #e11d48'
                  : '3px solid #cbd5e1'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontWeight: 600
                }}
              >
                <div>
                  <span style={{ color: '#334155', fontWeight: 700 }}>{dish.category}</span>
                  <span style={{ margin: '0 0.35rem' }}>·</span>
                  <span style={{ color: isKg ? '#059669' : '#1d4ed8', fontWeight: 700 }}>
                    {isKg ? 'Per Kg' : 'Per Guest'}
                  </span>
                </div>

                <span
                  style={{
                    color: dish.active ? '#15803d' : '#64748b',
                    fontWeight: 700
                  }}
                >
                  {dish.active ? 'Active' : 'Hidden'}
                </span>
              </div>

              <div style={{ margin: '0.7rem 0' }}>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#0f172a' }}>
                  {dish.name}
                </h3>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.25rem',
                    minHeight: '36px'
                  }}
                >
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

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '0.75rem',
                  marginTop: '0.5rem',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {isKg ? 'Rate Per Kg' : 'Rate Per Guest'}
                  </div>
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: isKg ? '#059669' : 'var(--primary)',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    ₹{price.toLocaleString('en-IN')}{' '}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: 'var(--text-muted)'
                      }}
                    >
                      {isKg ? '/ kg' : '/ guest'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    title="View/Edit Recipe Ingredients"
                    onClick={() => handleOpenRecipe(dish)}
                    style={{ whiteSpace: 'nowrap', fontWeight: 700 }}
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
                        style={{ whiteSpace: 'nowrap' }}
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
                        style={{ whiteSpace: 'nowrap' }}
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

      {/* Add / Edit Dish Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '540px' }}
          >
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
                    onChange={(e) =>
                      setFormData({ ...formData, pricing_type: e.target.value as PricingType })
                    }
                  >
                    <option value="per_guest">Per Guest</option>
                    <option value="per_kg">Per Kilogram (Kg)</option>
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
                  onChange={(e) =>
                    setFormData({ ...formData, price_per_unit: parseFloat(e.target.value) || 0 })
                  }
                  required
                />
                {editingItem &&
                  Number(formData.price_per_unit) !==
                    Number(editingItem.price_per_unit ?? editingItem.price_per_guest ?? 0) && (
                    <div
                      style={{
                        marginTop: '0.45rem',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.77rem',
                        color: '#1e3a8a',
                        lineHeight: 1.45
                      }}
                    >
                      <strong>Historical Rate Lock Active:</strong> New rate{' '}
                      <strong>₹{formData.price_per_unit}</strong> applies only to newly created or newly added quotation
                      items going forward. Previous events, quotations, and invoices remain locked at{' '}
                      <strong>
                        ₹{Number(editingItem.price_per_unit ?? editingItem.price_per_guest ?? 0)}
                      </strong>
                      .
                    </div>
                  )}
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

              <div
                className="form-group"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
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

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.6rem',
                  marginTop: '1.25rem',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    background: '#ecfdf5',
                    borderColor: '#6ee7b7',
                    color: '#065f46',
                    fontWeight: 700,
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => saveDishAndOptionallyOpenRecipe(true)}
                >
                  {editingItem ? 'Save & Edit Recipe →' : 'Create & Add Recipe →'}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {editingItem ? 'Save Changes' : 'Create Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Modal (Supports Both Existing Stock & New Ingredients Not in Stock) */}
      {recipeDish && (
        <div className="modal-overlay" onClick={() => setRecipeDish(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px', width: '96%' }}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.22rem', fontWeight: 800, margin: 0 }}>
                  🍲 Kitchen Recipe: {recipeDish.name}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {recipeDish.pricing_type === 'per_kg'
                    ? 'Define raw ingredients needed per 1 KG — add from stock or add new ingredients not yet in stock.'
                    : 'Define raw ingredients needed per 1 GUEST — add from stock or add new ingredients not yet in stock.'}
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setRecipeDish(null)}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                  Recipe Ingredients ({recipeDish.pricing_type === 'per_kg' ? 'Per 1 KG' : 'Per 1 Guest'})
                </span>
                {canEditMenu && (
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ whiteSpace: 'nowrap', fontWeight: 600 }}
                      onClick={() => {
                        const firstAvailable = state.ingredients[0];
                        if (firstAvailable) {
                          setRecipeLines([
                            ...recipeLines,
                            { ingredient_id: firstAvailable.id, qty_per_guest: 0.1 }
                          ]);
                        } else {
                          setShowNewIngPanel(true);
                        }
                      }}
                    >
                      + From Stock
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: showNewIngPanel ? '#0f172a' : '#059669',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}
                      onClick={() => {
                        setTargetLineIdxForNewIng(null);
                        setNewIngError(null);
                        setShowNewIngPanel((prev) => !prev);
                      }}
                    >
                      + New Ingredient (Not in Stock)
                    </button>
                  </div>
                )}
              </div>

              {/* Inline Create & Add Non-Stock Ingredient Sub-Form */}
              {showNewIngPanel && canEditMenu && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '10px',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.65rem',
                      gap: '0.5rem'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#065f46' }}>
                        ➕ Add New Ingredient (Not Currently in Warehouse Stock)
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#047857' }}>
                        Registers the item with 0 stock (so event shortage lists flag it automatically) and adds it directly to this recipe.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setShowNewIngPanel(false);
                        resetNewIngForm();
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {newIngError && (
                    <div
                      style={{
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        marginBottom: '0.65rem'
                      }}
                    >
                      {newIngError}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '0.65rem',
                      marginBottom: '0.75rem'
                    }}
                  >
                    <div style={{ gridColumn: 'span 2' }}>
                      <label className="form-label" style={{ fontSize: '0.76rem' }}>
                        New Ingredient Name *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Saffron, Cashew Paste, Rose Water, Mint"
                        value={newIngForm.name}
                        onChange={(e) =>
                          setNewIngForm({ ...newIngForm, name: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.76rem' }}>
                        Unit *
                      </label>
                      <select
                        className="form-control"
                        value={newIngForm.unit}
                        onChange={(e) =>
                          setNewIngForm({ ...newIngForm, unit: e.target.value })
                        }
                      >
                        <option value="kg">kg (Kilograms)</option>
                        <option value="g">g (Grams)</option>
                        <option value="l">l (Liters)</option>
                        <option value="ml">ml (Milliliters)</option>
                        <option value="each">each (Pieces)</option>
                        <option value="pkt">pkt (Packets)</option>
                        <option value="box">box (Boxes)</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.76rem' }}>
                        Recipe Qty ({recipeDish.pricing_type === 'per_kg' ? 'per 1 Kg' : 'per Guest'}) *
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        className="form-control"
                        value={newIngForm.qty_per_guest}
                        onChange={(e) =>
                          setNewIngForm({
                            ...newIngForm,
                            qty_per_guest: parseFloat(e.target.value) || 0
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.76rem' }}>
                        Est. Cost / {newIngForm.unit} (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="form-control"
                        value={newIngForm.cost_per_unit}
                        onChange={(e) =>
                          setNewIngForm({
                            ...newIngForm,
                            cost_per_unit: parseFloat(e.target.value) || 0
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.76rem' }}>
                        Current Stock ({newIngForm.unit})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        className="form-control"
                        value={newIngForm.stock_qty}
                        onChange={(e) =>
                          setNewIngForm({
                            ...newIngForm,
                            stock_qty: parseFloat(e.target.value) || 0
                          })
                        }
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setShowNewIngPanel(false);
                        resetNewIngForm();
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: '#059669',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}
                      onClick={handleCreateAndAddNonStockIngredient}
                    >
                      ✓ Save &amp; Add to Recipe
                    </button>
                  </div>
                </div>
              )}

              {recipeLines.length === 0 ? (
                <div
                  style={{
                    padding: '1.5rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div>No recipe ingredients added yet for this dish.</div>
                  {canEditMenu && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        marginTop: '0.75rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      {state.ingredients.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setRecipeLines([
                              { ingredient_id: state.ingredients[0].id, qty_per_guest: 0.1 }
                            ])
                          }
                        >
                          + Select Existing Stock Item
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowNewIngPanel(true)}
                      >
                        + Add Ingredient Not in Stock
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {recipeLines.map((line, idx) => {
                    const ingObj = state.ingredients.find((i) => i.id === line.ingredient_id);
                    const isOutOfStock = ingObj ? ingObj.stock_qty <= 0 : false;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          background: '#f8fafc',
                          padding: '0.45rem 0.6rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <div style={{ flex: 2.2, minWidth: '210px' }}>
                          <select
                            className="form-control"
                            disabled={!canEditMenu}
                            value={line.ingredient_id}
                            onChange={(e) => {
                              if (e.target.value === CREATE_NEW_ING_VALUE) {
                                setTargetLineIdxForNewIng(idx);
                                setShowNewIngPanel(true);
                                return;
                              }
                              const updated = [...recipeLines];
                              updated[idx].ingredient_id = e.target.value;
                              setRecipeLines(updated);
                            }}
                          >
                            {canEditMenu && (
                              <option value={CREATE_NEW_ING_VALUE}>
                                ➕ + Add New Ingredient (Not in Stock)...
                              </option>
                            )}
                            {state.ingredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit}) — Stock: {ing.stock_qty} {ing.unit} · ₹{ing.cost_per_unit}/{ing.unit}
                              </option>
                            ))}
                          </select>
                          {ingObj && isOutOfStock && (
                            <div
                              style={{
                                fontSize: '0.71rem',
                                color: '#b45309',
                                fontWeight: 600,
                                marginTop: '0.2rem'
                              }}
                            >
                              Currently 0 {ingObj.unit} in warehouse stock — will appear automatically in Event Shortage Lists
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            flex: 1,
                            minWidth: '130px'
                          }}
                        >
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            disabled={!canEditMenu}
                            className="form-control"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                            value={line.qty_per_guest}
                            onChange={(e) => {
                              const updated = [...recipeLines];
                              updated[idx].qty_per_guest = parseFloat(e.target.value) || 0;
                              setRecipeLines(updated);
                            }}
                          />
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                              minWidth: '32px',
                              fontWeight: 600
                            }}
                          >
                            {ingObj?.unit || 'unit'}
                          </span>
                        </div>

                        {canEditMenu && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              setRecipeLines(recipeLines.filter((_, i) => i !== idx));
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                borderTop: '1px solid var(--border)',
                paddingTop: '1rem'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRecipeDish(null)}
              >
                {canEditMenu ? 'Cancel' : 'Close'}
              </button>
              {canEditMenu && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveRecipe}
                  style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  Save Recipe Formula
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
