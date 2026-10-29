import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'ippas_supabase_live_url';
const STORAGE_KEY_KEY = 'ippas_supabase_live_anon_key';

type ConfigChangeListener = (client: SupabaseClient | null) => void;
const changeListeners: Set<ConfigChangeListener> = new Set();

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
  let customUrl = '';
  let customKey = '';

  if (typeof window !== 'undefined') {
    try {
      customUrl = cleanUrl(localStorage.getItem(STORAGE_URL_KEY));
      customKey = (localStorage.getItem(STORAGE_KEY_KEY) || '').trim();
    } catch {
      // ignore localStorage disabled
    }
  }

  if (customUrl && customKey && customUrl.startsWith('http')) {
    return {
      url: customUrl,
      anonKey: customKey,
      isConnected: true,
      source: 'custom'
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

function initSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConnected) {
    return null;
  }
  try {
    return createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
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
    return { success: false, client: null, error: 'Please provide a valid Supabase anon/public API key' };
  }

  try {
    const newClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_URL_KEY, url);
        localStorage.setItem(STORAGE_KEY_KEY, key);
      } catch {
        // ignore
      }
    }

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
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_URL_KEY);
      localStorage.removeItem(STORAGE_KEY_KEY);
    } catch {
      // ignore
    }
  }

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
    const testClient = createClient(url, key, {
      auth: { persistSession: false }
    });

    // Test query on business_settings
    const { data, error } = await testClient
      .from('business_settings')
      .select('id, name')
      .limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: true,
          tablesFound: false,
          message: 'Connected to Supabase! However, the catering database tables have not been created yet. Run schema.sql in your Supabase SQL editor.'
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
