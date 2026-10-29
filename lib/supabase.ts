import { createClient, SupabaseClient } from '@supabase/supabase-js';

type ConfigChangeListener = (client: SupabaseClient | null) => void;
const changeListeners: Set<ConfigChangeListener> = new Set();

let runtimeUrl = '';
let runtimeAnonKey = '';

function cleanUrl(raw?: string | null): string {
  let url = (raw || '').trim();
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  isConnected: boolean;
  source: 'custom' | 'env' | 'none';
} {
  if (runtimeUrl && runtimeAnonKey && runtimeUrl.startsWith('http')) {
    return {
      url: runtimeUrl,
      anonKey: runtimeAnonKey,
      isConnected: true,
      source: 'env'
    };
  }

  const envUrl = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  const envKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envKey && envUrl.startsWith('http') && !envUrl.includes('your-project')) {
    return {
      url: envUrl,
      anonKey: envKey,
      isConnected: true,
      source: 'env'
    };
  }

  return {
    url: '',
    anonKey: '',
    isConnected: false,
    source: 'none'
  };
}

function buildSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      },
      heartbeatIntervalMs: 15000
    }
  });
}

function initSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConnected) {
    return null;
  }
  try {
    return buildSupabaseClient(config.url, config.anonKey);
  } catch (err) {
    console.error('[Supabase Client Init Error]', err);
    return null;
  }
}

export let supabase: SupabaseClient | null = initSupabaseClient();
export let isSupabaseConfigured: boolean = Boolean(supabase);

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabase) {
    supabase = initSupabaseClient();
    isSupabaseConfigured = Boolean(supabase);
  }
  return supabase;
}

export async function ensureSupabaseOnlineConnection(): Promise<SupabaseClient | null> {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/db/config', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.configured && data?.url && data?.anonKey) {
          const cleanServerUrl = cleanUrl(data.url);
          const cleanServerKey = String(data.anonKey).trim();
          if (!supabase || runtimeUrl !== cleanServerUrl || runtimeAnonKey !== cleanServerKey) {
            const resSetup = setLiveSupabaseCredentials(cleanServerUrl, cleanServerKey);
            if (resSetup.success && resSetup.client) {
              return resSetup.client;
            }
          }
          return supabase;
        }
      }
    } catch {
      return null;
    }
  }

  return getSupabaseClient();
}

export function setLiveSupabaseCredentials(
  rawUrl: string,
  rawKey: string
): { success: boolean; client: SupabaseClient | null; error?: string } {
  const url = cleanUrl(rawUrl);
  const key = (rawKey || '').trim();

  if (!url || !url.startsWith('http')) {
    return { success: false, client: null, error: 'Please provide a valid Supabase URL starting with https://' };
  }
  if (!key || key.length < 15) {
    return { success: false, client: null, error: 'Please provide a valid Supabase API key' };
  }

  try {
    runtimeUrl = url;
    runtimeAnonKey = key;
    const newClient = buildSupabaseClient(url, key);

    supabase = newClient;
    isSupabaseConfigured = true;

    changeListeners.forEach((listener) => {
      try {
        listener(newClient);
      } catch (e) {
        console.error(e);
      }
    });

    return { success: true, client: newClient };
  } catch (err: any) {
    return { success: false, client: null, error: err?.message || 'Failed to initialize Supabase client.' };
  }
}

export function clearLiveSupabaseCredentials(): void {
  runtimeUrl = '';
  runtimeAnonKey = '';
  supabase = initSupabaseClient();
  isSupabaseConfigured = Boolean(supabase);

  changeListeners.forEach((listener) => {
    try {
      listener(supabase);
    } catch (e) {
      console.error(e);
    }
  });
}

export async function testSupabaseLiveConnection(
  rawUrl: string,
  rawKey: string
): Promise<{ success: boolean; message: string; tablesFound?: boolean }> {
  const url = cleanUrl(rawUrl);
  const key = (rawKey || '').trim();

  if (!url || !url.startsWith('http')) {
    return { success: false, message: 'Invalid URL. Must start with https://' };
  }
  if (!key) {
    return { success: false, message: 'API key is required.' };
  }

  try {
    const testClient = buildSupabaseClient(url, key);
    const { data, error } = await testClient
      .from('business_settings')
      .select('id, name')
      .limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: true,
          tablesFound: false,
          message: 'Connected to Supabase! Run schema.sql in your Supabase SQL editor to initialize tables.'
        };
      }
      return {
        success: false,
        message: `Supabase error (${error.code || 'API'}): ${error.message}`
      };
    }

    return {
      success: true,
      tablesFound: true,
      message: `Successfully connected to live Supabase database! Found ${data ? 'active tables' : 'database'}.`
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Network error connecting to Supabase.'
    };
  }
}

export function onSupabaseConfigChange(listener: ConfigChangeListener): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}
