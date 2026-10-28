/**
 * Date utility helpers for Invoicing
 * Enforces maximum 3 days due date constraint as requested by the user
 */

export function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function getMaxDueDate(baseDateStr?: string): string {
  const base = baseDateStr ? new Date(baseDateStr) : new Date();
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + 3);
  return d.toISOString().split('T')[0];
}

export function getDefaultDueDate(baseDateStr?: string): string {
  return getMaxDueDate(baseDateStr);
}

export function clampDueDate(dueDateStr: string, baseDateStr?: string): string {
  if (!dueDateStr) return getDefaultDueDate(baseDateStr);
  const max = getMaxDueDate(baseDateStr);
  const min = baseDateStr ? baseDateStr.slice(0, 10) : getTodayString();
  if (dueDateStr > max) return max;
  if (dueDateStr < min) return min;
  return dueDateStr;
}
