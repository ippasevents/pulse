'use client';

import { store } from './store';
import { Ingredient } from './types';

const NEAR_EXPIRY_DAYS = 14;

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerCsvDownload(csvContent: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function evaluateExpiry(expiryDate?: string): {
  statusLabel: string;
  cleanDate: string;
  isUrgent: boolean;
} {
  if (!expiryDate || !expiryDate.trim()) {
    return { statusLabel: 'No Expiry Set', cleanDate: '', isUrgent: false };
  }
  const clean = expiryDate.trim().slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return { statusLabel: 'Unknown', cleanDate: clean, isUrgent: false };
  }
  const [y, m, d] = parts;
  const expDateObj = new Date(y, m - 1, d);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysUntil = Math.round((expDateObj.getTime() - todayMidnight) / 86400000);

  if (daysUntil < 0) {
    return {
      statusLabel: `EXPIRED (${Math.abs(daysUntil)}d ago)`,
      cleanDate: clean,
      isUrgent: true
    };
  }
  if (daysUntil === 0) {
    return {
      statusLabel: 'EXPIRES TODAY',
      cleanDate: clean,
      isUrgent: true
    };
  }
  if (daysUntil <= NEAR_EXPIRY_DAYS) {
    return {
      statusLabel: `Expiring Soon (${daysUntil}d left)`,
      cleanDate: clean,
      isUrgent: true
    };
  }
  return {
    statusLabel: `Fresh (${daysUntil}d left)`,
    cleanDate: clean,
    isUrgent: false
  };
}

function buildRowsBlock(title: string, rows: Record<string, unknown>[]): string {
  const lines: string[] = [];
  lines.push(`=== ${title} ===`);
  if (rows.length === 0) {
    lines.push('No items');
    lines.push('');
    return lines.join('\r\n');
  }
  const headers = Object.keys(rows[0]);
  lines.push(headers.map(escapeCsvCell).join(','));
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(','));
  }
  lines.push('');
  return lines.join('\r\n');
}

export interface InventoryCsvExportResult {
  filename: string;
  inventoryCount: number;
  shortageCount: number;
  estimatedOrderCost: number;
}

/**
 * Exports Current Warehouse Inventory + Combined Shortage & Vendor Reorder List as a UTF-8 CSV file.
 * Combines safety-stock deficits AND active upcoming-event recipe requirements so warehouse staff
 * and managers have an accurate vendor purchase sheet.
 */
export function exportWarehouseInventoryAndShortageCsv(options?: {
  shortageOnly?: boolean;
  ingredientsOverride?: Ingredient[];
}): InventoryCsvExportResult {
  const state = store.getState();
  const shortageOnly = Boolean(options?.shortageOnly);
  const sourceIngredients = options?.ingredientsOverride || state.ingredients;

  // Aggregate demand across all active upcoming events (inquiry, quoted, confirmed)
  const activeEvents = state.events.filter(
    (e) => e.status !== 'completed' && e.status !== 'cancelled'
  );

  const eventDemandByIngredient = new Map<
    string,
    { totalNeeded: number; eventsList: string[] }
  >();

  for (const evt of activeEvents) {
    const est = store.getEventStockEstimation(evt.id);
    for (const item of est.items) {
      const existing = eventDemandByIngredient.get(item.ingredientId) || {
        totalNeeded: 0,
        eventsList: []
      };
      existing.totalNeeded = Number((existing.totalNeeded + item.qtyNeeded).toFixed(3));
      existing.eventsList.push(`${evt.title} (${evt.event_date}: ${item.qtyNeeded} ${item.unit})`);
      eventDemandByIngredient.set(item.ingredientId, existing);
    }
  }

  const shortageRows: Record<string, unknown>[] = [];
  const inventoryRows: Record<string, unknown>[] = [];
  let totalEstimatedOrderCost = 0;

  const sortedIngredients = [...sourceIngredients].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const ing of sortedIngredients) {
    const demandInfo = eventDemandByIngredient.get(ing.id);
    const upcomingDemand = demandInfo ? demandInfo.totalNeeded : 0;
    const isBelowSafety = ing.stock_qty <= ing.low_stock_level;
    const safetyDeficit = Math.max(
      0,
      Number((ing.low_stock_level - ing.stock_qty).toFixed(3))
    );
    const eventShortage = Math.max(
      0,
      Number((upcomingDemand - ing.stock_qty).toFixed(3))
    );

    // Recommended vendor order covers upcoming event demand + safety stock buffer
    const targetStockNeeded = Math.max(
      ing.low_stock_level,
      Number((upcomingDemand + ing.low_stock_level).toFixed(3))
    );
    const isShortage = isBelowSafety || eventShortage > 0;
    const recommendedOrderQty = isShortage
      ? Math.max(
          safetyDeficit,
          eventShortage,
          Number(Math.max(0, targetStockNeeded - ing.stock_qty).toFixed(3))
        )
      : 0;

    const estimatedOrderCost = Math.round(recommendedOrderQty * Number(ing.cost_per_unit || 0));
    const currentStockValue = Math.round(ing.stock_qty * Number(ing.cost_per_unit || 0));
    const projectedBalance = Number((ing.stock_qty - upcomingDemand).toFixed(3));
    const expiryInfo = evaluateExpiry(ing.expiry_date);

    if (isShortage) {
      totalEstimatedOrderCost += estimatedOrderCost;
      const reasons: string[] = [];
      if (isBelowSafety) reasons.push('Below Safety Stock');
      if (eventShortage > 0) reasons.push('Upcoming Event Shortage');

      shortageRows.push({
        'Ingredient Name': ing.name,
        Unit: ing.unit,
        'Current Stock': ing.stock_qty,
        'Safety Stock Level': ing.low_stock_level,
        'Upcoming Events Demand': upcomingDemand,
        'Low Stock Deficit': safetyDeficit,
        'Event Shortage Qty': eventShortage,
        'Recommended Vendor Order Qty': recommendedOrderQty,
        'Unit Cost (INR)': ing.cost_per_unit,
        'Estimated Order Cost (INR)': estimatedOrderCost,
        'Shortage Reason': reasons.join(' + '),
        'Expiry Date': expiryInfo.cleanDate || '—',
        'Expiry Status': expiryInfo.statusLabel,
        'Upcoming Events Requiring Item': demandInfo ? demandInfo.eventsList.join(' | ') : '—'
      });
    }

    const stockHealthLabel =
      eventShortage > 0 && isBelowSafety
        ? 'CRITICAL: Event Shortage & Low Stock'
        : eventShortage > 0
        ? 'Event Recipe Shortage'
        : isBelowSafety
        ? 'Low Stock (Below Threshold)'
        : 'Sufficient';

    inventoryRows.push({
      'Ingredient Name': ing.name,
      Unit: ing.unit,
      'Current Stock': ing.stock_qty,
      'Safety Stock Level': ing.low_stock_level,
      'Upcoming Events Demand': upcomingDemand,
      'Projected Balance After Events': projectedBalance,
      'Stock Health': stockHealthLabel,
      'Recommended Order Qty': recommendedOrderQty,
      'Unit Cost (INR)': ing.cost_per_unit,
      'Current Stock Value (INR)': currentStockValue,
      'Expiry Date': expiryInfo.cleanDate || '—',
      'Expiry Status': expiryInfo.statusLabel
    });
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const businessName = state.settings.name || 'IPPAS Food Service & Events';

  const headerLines = [
    `${businessName} — Warehouse Inventory & Vendor Shortage Report`,
    `Exported On,${escapeCsvCell(new Date().toLocaleString('en-IN'))}`,
    `Total Inventory Items,${inventoryRows.length}`,
    `Shortage / Reorder Items,${shortageRows.length}`,
    `Estimated Vendor Order Cost (INR),${totalEstimatedOrderCost}`,
    ''
  ].join('\r\n');

  const sections: string[] = [
    headerLines,
    buildRowsBlock('SHORTAGE & VENDOR ORDERING LIST (ACTION REQUIRED)', shortageRows)
  ];

  if (!shortageOnly) {
    sections.push(buildRowsBlock('CURRENT WAREHOUSE INVENTORY REGISTER', inventoryRows));
  }

  const filename = shortageOnly
    ? `IPPAS-Shortage-Vendor-Order-${dateStamp}.csv`
    : `IPPAS-Inventory-And-Shortage-${dateStamp}.csv`;

  triggerCsvDownload(sections.join('\r\n'), filename);

  return {
    filename,
    inventoryCount: inventoryRows.length,
    shortageCount: shortageRows.length,
    estimatedOrderCost: totalEstimatedOrderCost
  };
}

/**
 * Exports a single Event's Stock Estimation, Shortage List & Current Warehouse Inventory comparison as CSV.
 */
export function exportEventStockShortageCsv(eventId: string): {
  filename: string;
  shortageCount: number;
  totalItems: number;
} | null {
  const state = store.getState();
  const event = state.events.find((e) => e.id === eventId);
  if (!event) return null;

  const client = state.clients.find((c) => c.id === event.client_id);
  const quoteNumber = store.getQuotationNumber(event);
  const stockEst = store.getEventStockEstimation(event.id);

  const shortageRows = stockEst.items
    .filter((it) => it.isShortage)
    .map((it) => {
      const ing = state.ingredients.find((i) => i.id === it.ingredientId);
      const exp = evaluateExpiry(ing?.expiry_date);
      return {
        'Ingredient Name': it.ingredientName,
        Unit: it.unit,
        'Total Needed for Event': it.qtyNeeded,
        'Current Warehouse Stock': it.currentStock,
        'Shortage / To Buy Qty': it.shortageQty,
        'Unit Cost (INR)': it.costPerUnit,
        'Estimated Purchase Cost (INR)': it.estimatedCost,
        'Expiry Date': exp.cleanDate || '—',
        'Expiry Status': exp.statusLabel,
        'Used In Dishes': it.contributingDishes.join(' | ')
      };
    });

  const allReqRows = stockEst.items.map((it) => {
    const ing = state.ingredients.find((i) => i.id === it.ingredientId);
    const exp = evaluateExpiry(ing?.expiry_date);
    return {
      'Ingredient Name': it.ingredientName,
      Unit: it.unit,
      'Total Needed for Event': it.qtyNeeded,
      'Current Warehouse Stock': it.currentStock,
      'Safety Stock Level': ing?.low_stock_level ?? 0,
      'Shortage / To Buy Qty': it.shortageQty,
      Status: it.isShortage ? 'SHORTAGE - ORDER' : 'Sufficient in Stock',
      'Unit Cost (INR)': it.costPerUnit,
      'Estimated Purchase Cost (INR)': it.estimatedCost,
      'Expiry Date': exp.cleanDate || '—',
      'Used In Dishes': it.contributingDishes.join(' | ')
    };
  });

  const headerLines = [
    `${state.settings.name || 'IPPAS Food Service & Events'} — Event Stock & Vendor Shortage Sheet`,
    `Event,${escapeCsvCell(event.title)} (${quoteNumber})`,
    `Client,${escapeCsvCell(client?.name || '—')}`,
    `Event Date,${escapeCsvCell(event.event_date)}`,
    `Guest Count,${event.guest_count} Pax`,
    `Shortage Items,${stockEst.totalShortageCount} of ${stockEst.items.length}`,
    `Total Estimated Purchase Cost (INR),${stockEst.totalEstimatedCost}`,
    ''
  ].join('\r\n');

  const csvBody = [
    headerLines,
    buildRowsBlock('EVENT VENDOR SHORTAGE ORDER LIST', shortageRows),
    buildRowsBlock('COMPLETE EVENT RECIPE STOCK & WAREHOUSE COMPARISON', allReqRows)
  ].join('\r\n');

  const safeTitle = event.title.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `Event-Inventory-Shortage-${quoteNumber}-${safeTitle || 'Event'}.csv`;

  triggerCsvDownload(csvBody, filename);

  return {
    filename,
    shortageCount: stockEst.totalShortageCount,
    totalItems: stockEst.items.length
  };
}
