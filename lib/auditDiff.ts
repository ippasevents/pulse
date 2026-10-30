export interface AuditFieldChange {
  field: string;
  before: string;
  after: string;
}

const DIFF_START = '@@DIFF@@';
const DIFF_END = '@@END@@';
const META_START = '@@META@@';
const META_END = '@@ENDMETA@@';
const EXPENSE_START = '@@EXPENSE@@';
const EXPENSE_END = '@@ENDEXPENSE@@';

export function formatAuditVal(val: unknown, suffix: string = ''): string {
  if (val === undefined || val === null || val === '') return 'Empty';
  if (typeof val === 'boolean') return val ? 'Enabled' : 'Disabled';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return '0';
    return suffix ? `${val.toLocaleString('en-IN')}${suffix}` : val.toLocaleString('en-IN');
  }
  const str = String(val).trim();
  if (!str) return 'Empty';
  return suffix ? `${str}${suffix}` : str;
}

export function formatCurrencyAuditVal(val: unknown): string {
  const num = Number(val || 0);
  if (!Number.isFinite(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
}

export interface FieldDescriptor<T> {
  key: keyof T;
  label: string;
  format?: (val: any, record: T) => string;
}

export function buildRecordDiffs<T extends Record<string, any>>(
  before: T | undefined,
  after: T | undefined,
  descriptors: FieldDescriptor<T>[]
): AuditFieldChange[] {
  if (!before || !after) return [];
  const diffs: AuditFieldChange[] = [];

  for (const desc of descriptors) {
    const rawBefore = before[desc.key];
    const rawAfter = after[desc.key];
    const formattedBefore = desc.format
      ? desc.format(rawBefore, before)
      : formatAuditVal(rawBefore);
    const formattedAfter = desc.format
      ? desc.format(rawAfter, after)
      : formatAuditVal(rawAfter);

    if (formattedBefore !== formattedAfter) {
      diffs.push({
        field: desc.label,
        before: formattedBefore,
        after: formattedAfter
      });
    }
  }

  return diffs;
}

export function encodeAuditDetails(options: {
  changes?: AuditFieldChange[];
  note?: string;
  meta?: string;
  expensePayload?: Record<string, any>;
}): string | undefined {
  const parts: string[] = [];

  if (options.changes && options.changes.length > 0) {
    try {
      parts.push(`${DIFF_START}${JSON.stringify(options.changes)}${DIFF_END}`);
    } catch {
      // ignore serialization error
    }
  }

  if (options.note && options.note.trim()) {
    parts.push(options.note.trim());
  }

  if (options.meta && options.meta.trim()) {
    parts.push(`${META_START}${options.meta.trim()}${META_END}`);
  }

  if (options.expensePayload) {
    try {
      parts.push(`${EXPENSE_START}${JSON.stringify(options.expensePayload)}${EXPENSE_END}`);
    } catch {
      // ignore serialization error
    }
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function extractEmbeddedExpensePayload(details?: string): Record<string, any> | null {
  if (!details) return null;
  const startIdx = details.indexOf(EXPENSE_START);
  const endIdx = details.indexOf(EXPENSE_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  const rawJson = details.slice(startIdx + EXPENSE_START.length, endIdx);
  try {
    const parsed = JSON.parse(rawJson);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function parseAuditDetails(details?: string): {
  changes: AuditFieldChange[];
  cleanNote: string;
} {
  if (!details) {
    return { changes: [], cleanNote: '' };
  }

  let working = details;
  let changes: AuditFieldChange[] = [];

  // 1. Extract structured diff array if present
  const diffStart = working.indexOf(DIFF_START);
  const diffEnd = working.indexOf(DIFF_END);
  if (diffStart !== -1 && diffEnd !== -1 && diffEnd > diffStart) {
    const jsonSlice = working.slice(diffStart + DIFF_START.length, diffEnd);
    try {
      const parsed = JSON.parse(jsonSlice);
      if (Array.isArray(parsed)) {
        changes = parsed
          .filter((item) => item && typeof item.field === 'string')
          .map((item) => ({
            field: String(item.field),
            before: String(item.before ?? 'Empty'),
            after: String(item.after ?? 'Empty')
          }));
      }
    } catch {
      // ignore malformed JSON
    }
    working = (working.slice(0, diffStart) + ' ' + working.slice(diffEnd + DIFF_END.length)).trim();
  }

  // 2. Strip hidden metadata blocks
  const metaRegex = new RegExp(`${META_START}[\\s\\S]*?${META_END}`, 'g');
  working = working.replace(metaRegex, '').trim();

  const expenseRegex = new RegExp(`${EXPENSE_START}[\\s\\S]*?${EXPENSE_END}`, 'g');
  working = working.replace(expenseRegex, '').trim();

  // 3. Clean legacy internal sync tags so notifications stay concise and readable
  const cleanedSegments = working
    .split('•')
    .map((seg) => seg.trim())
    .filter((seg) => {
      if (!seg) return false;
      if (/^(BankDetails|PayDetails|QuoteRef|DiscountNote|Quote#):/i.test(seg)) {
        return false;
      }
      return true;
    });

  return {
    changes,
    cleanNote: cleanedSegments.join(' • ')
  };
}
