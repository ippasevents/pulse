import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { createPool } from '@/src/db/index';
import { deriveSupabaseUrlFromJwt } from '@/lib/supabase';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
};

export type DbOperation =
  | {
      type: 'upsert';
      table: string;
      values: Record<string, any> | Record<string, any>[];
      onConflict?: string;
    }
  | {
      type: 'insert';
      table: string;
      values: Record<string, any> | Record<string, any>[];
    }
  | {
      type: 'update';
      table: string;
      values: Record<string, any>;
      match: Record<string, any>;
    }
  | {
      type: 'delete';
      table: string;
      match: Record<string, any>;
    }
  | {
      type: 'delete_all';
      table: string;
    };

const ALLOWED_TABLES = new Set([
  'business_settings',
  'profiles',
  'clients',
  'ingredients',
  'menu_items',
  'menu_item_ingredients',
  'events',
  'event_items',
  'event_extras',
  'event_expenses',
  'staff_members',
  'shifts',
  'staff_salary_records',
  'invoices',
  'payments',
  'stock_purchases',
  'stock_purchase_items',
  'stock_purchase_payments',
  'activity_logs'
]);

function isMissingTableError(msg: string): boolean {
  const lower = (msg || '').toLowerCase();
  return (
    lower.includes('does not exist') ||
    lower.includes('could not find the table') ||
    lower.includes('schema cache') ||
    lower.includes('pgrst205')
  );
}

function isCloudSqlConfigured(): boolean {
  return Boolean(
    process.env.SQL_HOST &&
    process.env.SQL_USER &&
    process.env.SQL_PASSWORD &&
    process.env.SQL_DB_NAME
  );
}

function getServerSupabase(): SupabaseClient | null {
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  let url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    deriveSupabaseUrlFromJwt(key) ||
    ''
  ).trim();
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  if (!url || !key || !url.startsWith('http') || url.includes('your-project')) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function extractMissingColumn(errMessage: string): string | null {
  const m1 = errMessage.match(/Could not find the '([^']+)' column/i);
  if (m1?.[1]) return m1[1];
  const m2 = errMessage.match(/column "([^"]+)" of relation/i);
  if (m2?.[1]) return m2[1];
  return null;
}

function stripColumn(
  values: Record<string, any> | Record<string, any>[],
  col: string
): Record<string, any> | Record<string, any>[] {
  if (Array.isArray(values)) {
    return values.map((row) => {
      const next = { ...row };
      delete next[col];
      return next;
    });
  }
  const next = { ...values };
  delete next[col];
  return next;
}

// ---------------------------------------------------------------------------
// Cloud SQL Operations Handler (pg Pool)
// ---------------------------------------------------------------------------
async function runSingleCloudSqlOperation(
  pool: Pool,
  op: DbOperation,
  attempt: number = 0
): Promise<{ error: any | null }> {
  if (!ALLOWED_TABLES.has(op.table)) {
    return { error: { message: `Disallowed table: ${op.table}` } };
  }

  try {
    if (op.type === 'delete_all') {
      await pool.query(`DELETE FROM "${op.table}"`);
      return { error: null };
    }

    if (op.type === 'delete') {
      const matchEntries = Object.entries(op.match || {});
      if (matchEntries.length === 0) return { error: null };
      const whereClauses = matchEntries.map(([k], idx) => `"${k}" = $${idx + 1}`).join(' AND ');
      const params = matchEntries.map(([, v]) => v);
      await pool.query(`DELETE FROM "${op.table}" WHERE ${whereClauses}`, params);
      return { error: null };
    }

    if (op.type === 'update') {
      const valEntries = Object.entries(op.values || {});
      if (valEntries.length === 0) return { error: null };
      const matchEntries = Object.entries(op.match || {});
      const setClauses = valEntries.map(([k], idx) => `"${k}" = $${idx + 1}`).join(', ');
      const whereClauses = matchEntries
        .map(([k], idx) => `"${k}" = $${valEntries.length + idx + 1}`)
        .join(' AND ');
      const params = [...valEntries.map(([, v]) => v), ...matchEntries.map(([, v]) => v)];
      await pool.query(`UPDATE "${op.table}" SET ${setClauses} WHERE ${whereClauses}`, params);
      return { error: null };
    }

    // Insert or Upsert
    const rows = Array.isArray(op.values) ? op.values : [op.values];
    for (const rawRow of rows) {
      if (!rawRow || Object.keys(rawRow).length === 0) continue;
      const keys = Object.keys(rawRow);
      const cols = keys.map((k) => `"${k}"`).join(', ');
      const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
      const params = keys.map((k) => rawRow[k]);

      if (op.type === 'upsert') {
        const conflictKeys = (op.onConflict || 'id')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const conflictTarget = conflictKeys.map((k) => `"${k}"`).join(', ');
        const updateCols = keys.filter((k) => !conflictKeys.includes(k));

        if (updateCols.length > 0) {
          const updateSet = updateCols.map((k) => `"${k}" = EXCLUDED."${k}"`).join(', ');
          await pool.query(
            `INSERT INTO "${op.table}" (${cols}) VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updateSet}`,
            params
          );
        } else {
          await pool.query(
            `INSERT INTO "${op.table}" (${cols}) VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO NOTHING`,
            params
          );
        }
      } else {
        await pool.query(`INSERT INTO "${op.table}" (${cols}) VALUES (${placeholders})`, params);
      }
    }

    return { error: null };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (op.table === 'event_expenses' && isMissingTableError(msg)) {
      return { error: null };
    }
    const missingCol = extractMissingColumn(msg);
    if (
      missingCol &&
      attempt < 8 &&
      (op.type === 'insert' || op.type === 'upsert' || op.type === 'update') &&
      op.values
    ) {
      return runSingleCloudSqlOperation(
        pool,
        { ...op, values: stripColumn(op.values, missingCol) },
        attempt + 1
      );
    }
    return { error: { message: msg } };
  }
}

// ---------------------------------------------------------------------------
// Supabase Fallback Operations Handler
// ---------------------------------------------------------------------------
async function runSingleSupabaseOperation(
  sb: SupabaseClient,
  op: DbOperation
): Promise<{ error: any | null }> {
  if (!ALLOWED_TABLES.has(op.table)) {
    return { error: { message: `Disallowed table: ${op.table}` } };
  }

  if (op.type === 'delete_all') {
    if (op.table === 'menu_item_ingredients') {
      const { error } = await sb
        .from(op.table)
        .delete()
        .neq('menu_item_id', '00000000-0000-0000-0000-000000000000');
      return { error };
    }
    if (op.table === 'business_settings') {
      const { error } = await sb.from(op.table).delete().neq('id', -1);
      return { error };
    }
    const { error } = await sb
      .from(op.table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error && op.table === 'event_expenses' && isMissingTableError(String(error.message || ''))) {
      return { error: null };
    }
    return { error };
  }

  if (op.type === 'delete') {
    let query = sb.from(op.table).delete();
    for (const [k, v] of Object.entries(op.match || {})) {
      query = query.eq(k, v);
    }
    const { error } = await query;
    if (error && op.table === 'event_expenses' && isMissingTableError(String(error.message || ''))) {
      return { error: null };
    }
    return { error };
  }

  if (op.type === 'update') {
    let currentValues = { ...op.values };
    for (let attempt = 0; attempt < 5; attempt++) {
      let query = sb.from(op.table).update(currentValues);
      for (const [k, v] of Object.entries(op.match || {})) {
        query = query.eq(k, v);
      }
      const { error } = await query;
      if (!error) return { error: null };

      const msg = String(error.message || '');
      if (op.table === 'event_expenses' && isMissingTableError(msg)) {
        return { error: null };
      }
      const missingCol = extractMissingColumn(msg);
      if (missingCol && missingCol in currentValues) {
        delete currentValues[missingCol];
        if (Object.keys(currentValues).length === 0) return { error: null };
        continue;
      }
      return { error };
    }
    return { error: null };
  }

  let currentValues = Array.isArray(op.values)
    ? op.values.map((r) => ({ ...r }))
    : { ...op.values };

  for (let attempt = 0; attempt < 6; attempt++) {
    const query =
      op.type === 'upsert'
        ? sb.from(op.table).upsert(currentValues, {
            onConflict: op.onConflict || 'id'
          })
        : sb.from(op.table).insert(currentValues);

    const { error } = await query;
    if (!error) return { error: null };

    const msg = String(error.message || '');
    if (op.table === 'event_expenses' && isMissingTableError(msg)) {
      return { error: null };
    }
    const missingCol = extractMissingColumn(msg);
    if (missingCol) {
      currentValues = stripColumn(currentValues, missingCol);
      continue;
    }

    if (
      op.table === 'ingredients' &&
      !Array.isArray(currentValues) &&
      currentValues.name &&
      (msg.includes('ingredients_name_key') || error.code === '23505')
    ) {
      const updatePayload = { ...currentValues };
      delete updatePayload.id;
      const { error: byNameErr } = await sb
        .from('ingredients')
        .update(updatePayload)
        .eq('name', currentValues.name);
      if (!byNameErr) return { error: null };
    }

    if (
      op.table === 'profiles' &&
      !Array.isArray(currentValues) &&
      currentValues.username &&
      (msg.includes('profiles_username_key') || error.code === '23505')
    ) {
      const updatePayload = { ...currentValues };
      delete updatePayload.id;
      const { error: byUserErr } = await sb
        .from('profiles')
        .update(updatePayload)
        .eq('username', currentValues.username);
      if (!byUserErr) return { error: null };
    }

    return { error };
  }

  return { error: null };
}

function getActiveDatabaseType(): 'supabase' | 'cloudsql' | 'none' {
  const sb = getServerSupabase();
  const hasCloudSql = isCloudSqlConfigured();

  if (process.env.DATABASE_PROVIDER === 'supabase' && sb) return 'supabase';
  if (process.env.DATABASE_PROVIDER === 'cloudsql' && hasCloudSql) return 'cloudsql';

  // If Supabase keys are provided in environment, use Supabase
  if (sb) return 'supabase';
  if (hasCloudSql) return 'cloudsql';
  return 'none';
}

// ---------------------------------------------------------------------------
// GET & POST Handlers
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const dbType = getActiveDatabaseType();
  const isConfigured = dbType !== 'none';
  const sb = getServerSupabase();

  const mode = req.nextUrl.searchParams.get('mode');
  if (mode === 'status') {
    return NextResponse.json(
      {
        configured: isConfigured,
        engine: dbType
      },
      { headers: NO_STORE_HEADERS }
    );
  }

  if (mode === 'ping') {
    if (!isConfigured) {
      return NextResponse.json(
        { configured: false, online: false, error: 'Supabase is not configured.' },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }
    if (sb) {
      try {
        const { error } = await sb.from('business_settings').select('id').limit(1);
        if (
          error &&
          (String(error.message || '').toLowerCase().includes('fetch') ||
            String(error.message || '').toLowerCase().includes('network') ||
            String(error.message || '').toLowerCase().includes('enotfound') ||
            String(error.message || '').toLowerCase().includes('econnrefused'))
        ) {
          return NextResponse.json(
            { configured: true, online: false, error: error.message },
            { status: 503, headers: NO_STORE_HEADERS }
          );
        }
        return NextResponse.json(
          { configured: true, online: true, engine: 'supabase' },
          { headers: NO_STORE_HEADERS }
        );
      } catch (err: any) {
        return NextResponse.json(
          { configured: true, online: false, error: err?.message || 'Supabase unreachable' },
          { status: 503, headers: NO_STORE_HEADERS }
        );
      }
    }
    return NextResponse.json(
      { configured: true, online: true, engine: dbType },
      { headers: NO_STORE_HEADERS }
    );
  }

  if (!isConfigured) {
    return NextResponse.json({ configured: false }, { headers: NO_STORE_HEADERS });
  }

  // Read via Cloud SQL (pg Pool)
  if (dbType === 'cloudsql') {
    try {
      const pool = createPool();
      const [
        settingsRes,
        profilesRes,
        clientsRes,
        ingredientsRes,
        menuItemsRes,
        recipesRes,
        eventsRes,
        eventItemsRes,
        eventExtrasRes,
        staffRes,
        shiftsRes,
        salaryRecordsRes,
        invoicesRes,
        paymentsRes,
        purchasesRes,
        purchaseItemsRes,
        purchasePaymentsRes,
        activityLogsRes,
        eventExpensesRes
      ] = await Promise.all([
        pool.query('SELECT * FROM business_settings WHERE id = 1 LIMIT 1'),
        pool.query('SELECT * FROM profiles ORDER BY full_name ASC'),
        pool.query('SELECT * FROM clients ORDER BY created_at DESC'),
        pool.query('SELECT * FROM ingredients ORDER BY name ASC'),
        pool.query('SELECT * FROM menu_items ORDER BY name ASC'),
        pool.query('SELECT * FROM menu_item_ingredients'),
        pool.query('SELECT * FROM events ORDER BY event_date ASC'),
        pool.query('SELECT * FROM event_items'),
        pool.query('SELECT * FROM event_extras'),
        pool.query('SELECT * FROM staff_members ORDER BY name ASC'),
        pool.query('SELECT * FROM shifts'),
        pool.query('SELECT * FROM staff_salary_records ORDER BY recorded_at DESC'),
        pool.query('SELECT * FROM invoices ORDER BY created_at DESC'),
        pool.query('SELECT * FROM payments ORDER BY paid_at DESC'),
        pool.query('SELECT * FROM stock_purchases ORDER BY created_at DESC'),
        pool.query('SELECT * FROM stock_purchase_items'),
        pool.query('SELECT * FROM stock_purchase_payments ORDER BY paid_at DESC'),
        pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 400'),
        pool.query('SELECT * FROM event_expenses ORDER BY created_at DESC').catch(() => ({ rows: [], tableMissing: true }))
      ]);

      return NextResponse.json({
        configured: true,
        engine: 'cloudsql',
        results: {
          settingsRes: { data: settingsRes.rows[0] || null },
          profilesRes: { data: profilesRes.rows },
          clientsRes: { data: clientsRes.rows },
          ingredientsRes: { data: ingredientsRes.rows },
          menuItemsRes: { data: menuItemsRes.rows },
          recipesRes: { data: recipesRes.rows },
          eventsRes: { data: eventsRes.rows },
          eventItemsRes: { data: eventItemsRes.rows },
          eventExtrasRes: { data: eventExtrasRes.rows },
          eventExpensesRes: {
            data: eventExpensesRes.rows,
            tableMissing: Boolean((eventExpensesRes as any).tableMissing)
          },
          staffRes: { data: staffRes.rows },
          shiftsRes: { data: shiftsRes.rows },
          salaryRecordsRes: { data: salaryRecordsRes.rows },
          invoicesRes: { data: invoicesRes.rows },
          paymentsRes: { data: paymentsRes.rows },
          purchasesRes: { data: purchasesRes.rows },
          purchaseItemsRes: { data: purchaseItemsRes.rows },
          purchasePaymentsRes: { data: purchasePaymentsRes.rows },
          activityLogsRes: { data: activityLogsRes.rows }
        }
      });
    } catch (err: any) {
      console.error('[Cloud SQL Read Error]', err);
      return NextResponse.json(
        {
          configured: true,
          error: err?.message || 'Failed to read from Cloud SQL database.'
        },
        { status: 500 }
      );
    }
  }

  // Read via Supabase
  if (sb) {
    try {
      const [
        settingsRes,
        profilesRes,
        clientsRes,
        ingredientsRes,
        menuItemsRes,
        recipesRes,
        eventsRes,
        eventItemsRes,
        eventExtrasRes,
        eventExpensesRes,
        staffRes,
        shiftsRes,
        salaryRecordsRes,
        invoicesRes,
        paymentsRes,
        purchasesRes,
        purchaseItemsRes,
        purchasePaymentsRes,
        activityLogsRes
      ] = await Promise.all([
        sb.from('business_settings').select('*').eq('id', 1).maybeSingle(),
        sb.from('profiles').select('*'),
        sb.from('clients').select('*').order('created_at', { ascending: false }),
        sb.from('ingredients').select('*').order('name', { ascending: true }),
        sb.from('menu_items').select('*').order('name', { ascending: true }),
        sb.from('menu_item_ingredients').select('*'),
        sb.from('events').select('*').order('event_date', { ascending: true }),
        sb.from('event_items').select('*'),
        sb.from('event_extras').select('*'),
        sb.from('event_expenses').select('*').order('created_at', { ascending: false }),
        sb.from('staff_members').select('*').order('name', { ascending: true }),
        sb.from('shifts').select('*'),
        sb.from('staff_salary_records').select('*').order('recorded_at', { ascending: false }),
        sb.from('invoices').select('*').order('created_at', { ascending: false }),
        sb.from('payments').select('*').order('paid_at', { ascending: false }),
        sb.from('stock_purchases').select('*').order('created_at', { ascending: false }),
        sb.from('stock_purchase_items').select('*'),
        sb.from('stock_purchase_payments').select('*').order('paid_at', { ascending: false }),
        sb.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(400)
      ]);

      return NextResponse.json(
        {
          configured: true,
          engine: 'supabase',
          results: {
            settingsRes,
            profilesRes,
            clientsRes,
            ingredientsRes,
            menuItemsRes,
            recipesRes,
            eventsRes,
            eventItemsRes,
            eventExtrasRes,
            eventExpensesRes,
            staffRes,
            shiftsRes,
            salaryRecordsRes,
            invoicesRes,
            paymentsRes,
            purchasesRes,
            purchaseItemsRes,
            purchasePaymentsRes,
            activityLogsRes
          }
        },
        { headers: NO_STORE_HEADERS }
      );
    } catch (err: any) {
      return NextResponse.json(
        {
          configured: true,
          online: false,
          error: err?.message || 'Failed to read from Supabase database.'
        },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }
  }

  return NextResponse.json({ configured: false }, { headers: NO_STORE_HEADERS });
}

export async function POST(req: NextRequest) {
  const dbType = getActiveDatabaseType();
  const sb = getServerSupabase();

  if (dbType === 'none') {
    return NextResponse.json({
      configured: false,
      success: false,
      error: 'SQL database credentials are not configured.'
    });
  }

  try {
    const body = await req.json();
    const operations: DbOperation[] = Array.isArray(body?.operations)
      ? body.operations
      : [];

    if (dbType === 'cloudsql') {
      const pool = createPool();
      for (const op of operations) {
        const { error } = await runSingleCloudSqlOperation(pool, op);
        if (error) {
          return NextResponse.json(
            {
              configured: true,
              engine: 'cloudsql',
              success: false,
              failedTable: op.table,
              error: error.message || String(error)
            },
            { status: 400 }
          );
        }
      }
    } else if (dbType === 'supabase' && sb) {
      for (const op of operations) {
        const { error } = await runSingleSupabaseOperation(sb, op);
        if (error) {
          return NextResponse.json(
            {
              configured: true,
              engine: 'supabase',
              success: false,
              failedTable: op.table,
              error: error.message || String(error)
            },
            { status: 400 }
          );
        }
      }
    }

    return NextResponse.json({
      configured: true,
      engine: dbType,
      success: true,
      count: operations.length
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        configured: true,
        success: false,
        error: err?.message || 'Failed to execute SQL database update.'
      },
      { status: 500 }
    );
  }
}
