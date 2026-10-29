import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const ENV_LOCAL_PATH = path.join(process.cwd(), '.env.local');

export async function GET() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const isConfigured = Boolean(url && key && url.startsWith('http') && !url.includes('your-project'));

  return NextResponse.json({
    configured: isConfigured,
    url: url || null,
    maskedKey: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let url = String(body.url || '').trim();
    const anonKey = String(body.anonKey || '').trim();
    const serviceRoleKey = String(body.serviceRoleKey || '').trim();

    if (!url || !anonKey) {
      return NextResponse.json(
        { success: false, error: 'Both Supabase URL and Anon Key are required.' },
        { status: 400 }
      );
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Test connection
    try {
      const testClient = createClient(url, anonKey, {
        auth: { persistSession: false }
      });
      const { error } = await testClient.from('business_settings').select('id').limit(1);
      if (error && error.code !== '42P01' && !error.message.includes('relation') && !error.message.includes('does not exist')) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to authenticate with Supabase: ${error.message}`
          },
          { status: 400 }
        );
      }
    } catch (testErr: any) {
      return NextResponse.json(
        {
          success: false,
          error: `Could not reach Supabase endpoint: ${testErr?.message || String(testErr)}`
        },
        { status: 400 }
      );
    }

    // Update in-memory process.env without triggering webpack DefinePlugin static inlining
    const pubUrlKey = ['NEXT', 'PUBLIC', 'SUPABASE', 'URL'].join('_');
    const pubAnonKey = ['NEXT', 'PUBLIC', 'SUPABASE', 'ANON', 'KEY'].join('_');
    const envObj: Record<string, string | undefined> = process.env;
    envObj[pubUrlKey] = url;
    envObj['SUPABASE_URL'] = url;
    envObj[pubAnonKey] = anonKey;
    envObj['SUPABASE_ANON_KEY'] = anonKey;
    if (serviceRoleKey) {
      envObj['SUPABASE_SERVICE_ROLE_KEY'] = serviceRoleKey;
    }
    envObj['DATABASE_PROVIDER'] = 'supabase';

    // Persist to .env.local
    let existingContent = '';
    if (fs.existsSync(ENV_LOCAL_PATH)) {
      existingContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
    }

    const envMap: Record<string, string> = {};
    existingContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim();
        envMap[k] = v;
      }
    });

    envMap[pubUrlKey] = url;
    envMap['SUPABASE_URL'] = url;
    envMap[pubAnonKey] = anonKey;
    envMap['SUPABASE_ANON_KEY'] = anonKey;
    if (serviceRoleKey) {
      envMap['SUPABASE_SERVICE_ROLE_KEY'] = serviceRoleKey;
    }
    envMap['DATABASE_PROVIDER'] = 'supabase';

    const newEnvLines = Object.entries(envMap).map(([k, v]) => `${k}=${v}`);
    fs.writeFileSync(ENV_LOCAL_PATH, newEnvLines.join('\n') + '\n', 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Supabase credentials saved and live connection established!'
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save Supabase credentials' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const pubUrlKey = ['NEXT', 'PUBLIC', 'SUPABASE', 'URL'].join('_');
    const pubAnonKey = ['NEXT', 'PUBLIC', 'SUPABASE', 'ANON', 'KEY'].join('_');
    const envObj: Record<string, string | undefined> = process.env;
    delete envObj[pubUrlKey];
    delete envObj['SUPABASE_URL'];
    delete envObj[pubAnonKey];
    delete envObj['SUPABASE_ANON_KEY'];
    delete envObj['SUPABASE_SERVICE_ROLE_KEY'];

    if (fs.existsSync(ENV_LOCAL_PATH)) {
      const existing = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
      const filtered = existing
        .split('\n')
        .filter((l) => !l.startsWith('NEXT_PUBLIC_SUPABASE') && !l.startsWith('SUPABASE_'))
        .join('\n');
      fs.writeFileSync(ENV_LOCAL_PATH, filtered, 'utf-8');
    }

    return NextResponse.json({ success: true, message: 'Supabase credentials cleared.' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to clear credentials' },
      { status: 500 }
    );
  }
}
