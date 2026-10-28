import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

function getServerSupabase(): SupabaseClient | null {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

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
  // PostgREST / Postgres missing column patterns:
  // Could not find the 'auto_email_invoices' column of 'business_settings' in the schema cache
  // column "pricing_type" of relation "menu_items" does not exist
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

async function runSingleOperation(
  sb: SupabaseClient,
  op: DbOperation
): Promise<{ error: any | null }> {
  if (!ALLOWED_TABLES.has(op.table)) {
    return { error: { message: `Disallowed table: ${op.table}` } };
  }

  if (op.type === 'delete') {
    let query = sb.from(op.table).delete();
    for (const [k, v] of Object.entries(op.match || {})) {
      query = query.eq(k, v);
    }
    const { error } = await query;
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

      const missingCol = extractMissingColumn(String(error.message || ''));
      if (missingCol && missingCol in currentValues) {
        delete currentValues[missingCol];
        if (Object.keys(currentValues).length === 0) return { error: null };
        continue;
      }
      return { error };
    }
    return { error: null };
  }

  // insert or upsert with automatic missing-column stripping & unique-key recovery
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
    const missingCol = extractMissingColumn(msg);
    if (missingCol) {
      currentValues = stripColumn(currentValues, missingCol);
      continue;
    }

    // Handle ingredients unique name conflict gracefully
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

    // Handle profiles unique username conflict gracefully
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

    // Handle invoices unique invoice_number conflict if another row claimed the sequence number
    if (
      op.table === 'invoices' &&
      !Array.isArray(currentValues) &&
      currentValues.invoice_number &&
      (msg.includes('invoices_invoice_number_key') || error.code === '23505')
    ) {
      const suffix = String(Date.now()).slice(-4);
      currentValues = {
        ...currentValues,
        invoice_number: `${currentValues.invoice_number}-${suffix}`
      };
      continue;
    }

    return { error };
  }

  return { error: null };
}

export async function GET(req: NextRequest) {
  const sb = getServerSupabase();
  const mode = req.nextUrl.searchParams.get('mode');

  if (mode === 'status') {
    return NextResponse.json({ configured: Boolean(sb) });
  }

  if (!sb) {
    return NextResponse.json({ configured: false });
  }

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

    return NextResponse.json({
      configured: true,
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
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        configured: true,
        error: err?.message || 'Failed to read from SQL database.'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const sb = getServerSupabase();
  if (!sb) {
    return NextResponse.json({
      configured: false,
      success: false,
      error: 'Supabase SQL database credentials are not configured.'
    });
  }

  try {
    const body = await req.json();
    const operations: DbOperation[] = Array.isArray(body?.operations)
      ? body.operations
      : [];

    for (const op of operations) {
      const { error } = await runSingleOperation(sb, op);
      if (error) {
        return NextResponse.json(
          {
            configured: true,
            success: false,
            failedTable: op.table,
            error: error.message || String(error)
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      configured: true,
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
