import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { deriveSupabaseUrlFromJwt } from '@/lib/supabase';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const TMP_DIR = '/tmp/ippas-shared-pdfs';
const BUCKET_NAME = 'whatsapp-pdfs';
const MAX_MEMORY_ENTRIES = 60;

interface CachedPdfEntry {
  buffer: Buffer;
  filename: string;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __ippasSharedPdfCache: Map<string, CachedPdfEntry> | undefined;
  // eslint-disable-next-line no-var
  var __ippasBucketEnsured: boolean | undefined;
}

function getMemoryCache(): Map<string, CachedPdfEntry> {
  if (!globalThis.__ippasSharedPdfCache) {
    globalThis.__ippasSharedPdfCache = new Map<string, CachedPdfEntry>();
  }
  return globalThis.__ippasSharedPdfCache;
}

export function sanitizeDocId(raw: string): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  return cleaned || `doc-${Date.now()}`;
}

export function sanitizePdfFilename(raw: string): string {
  const cleaned = (raw || 'Document.pdf')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
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

async function ensurePublicStorageBucket(sb: SupabaseClient): Promise<boolean> {
  if (globalThis.__ippasBucketEnsured) return true;
  try {
    const { data: buckets, error: listErr } = await sb.storage.listBuckets();
    if (!listErr && Array.isArray(buckets)) {
      const existing = buckets.find((b) => b.name === BUCKET_NAME);
      if (existing) {
        if (!existing.public) {
          await sb.storage.updateBucket(BUCKET_NAME, { public: true }).catch(() => {});
        }
        globalThis.__ippasBucketEnsured = true;
        return true;
      }
    }
    const { error: createErr } = await sb.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 15 * 1024 * 1024
    });
    if (!createErr || String(createErr.message || '').toLowerCase().includes('already exists')) {
      globalThis.__ippasBucketEnsured = true;
      return true;
    }
  } catch {
    // Fallback to /tmp and memory cache silently
  }
  return false;
}

export async function saveSharedPdfDocument(
  rawId: string,
  rawFilename: string,
  buffer: Buffer
): Promise<{
  docId: string;
  filename: string;
  supabasePublicUrl?: string;
}> {
  const docId = sanitizeDocId(rawId);
  const filename = sanitizePdfFilename(rawFilename);

  // 1. Store in fast memory cache
  const cache = getMemoryCache();
  if (cache.size >= MAX_MEMORY_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(docId, {
    buffer,
    filename,
    createdAt: Date.now()
  });

  // 2. Persist in /tmp directory on server disk
  try {
    await fs.promises.mkdir(TMP_DIR, { recursive: true });
    const filePath = path.join(TMP_DIR, `${docId}__${filename}`);
    await fs.promises.writeFile(filePath, buffer);
  } catch {
    // ignore fs write issues in read-only environments
  }

  // 3. Persist in Supabase Storage public bucket when available
  let supabasePublicUrl: string | undefined;
  const sb = getServerSupabase();
  if (sb && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const ready = await ensurePublicStorageBucket(sb);
      if (ready) {
        const storagePath = `${docId}/${filename}`;
        const { error: upErr } = await sb.storage
          .from(BUCKET_NAME)
          .upload(storagePath, buffer, {
            contentType: 'application/pdf',
            upsert: true,
            cacheControl: '86400'
          });
        if (!upErr) {
          const { data: pub } = sb.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
          if (pub?.publicUrl) {
            supabasePublicUrl = pub.publicUrl;
          }
        }
      }
    } catch {
      // ignore storage errors; /api/shared-doc route still serves from memory & /tmp
    }
  }

  return { docId, filename, supabasePublicUrl };
}

export async function loadSharedPdfDocument(
  rawId: string,
  rawFilename: string
): Promise<{ buffer: Buffer; filename: string } | null> {
  const docId = sanitizeDocId(rawId);
  const requestedFilename = sanitizePdfFilename(rawFilename);

  // 1. Check in-memory cache
  const cached = getMemoryCache().get(docId);
  if (cached) {
    return { buffer: cached.buffer, filename: cached.filename || requestedFilename };
  }

  // 2. Check /tmp directory
  try {
    const exactPath = path.join(TMP_DIR, `${docId}__${requestedFilename}`);
    if (fs.existsSync(exactPath)) {
      const buf = await fs.promises.readFile(exactPath);
      return { buffer: buf, filename: requestedFilename };
    }
    if (fs.existsSync(TMP_DIR)) {
      const files = await fs.promises.readdir(TMP_DIR);
      const match = files.find((f) => f.startsWith(`${docId}__`));
      if (match) {
        const buf = await fs.promises.readFile(path.join(TMP_DIR, match));
        const extractedName = match.slice(`${docId}__`.length) || requestedFilename;
        return { buffer: buf, filename: extractedName };
      }
    }
  } catch {
    // ignore
  }

  // 3. Check Supabase Storage public bucket
  const sb = getServerSupabase();
  if (sb) {
    try {
      const storagePath = `${docId}/${requestedFilename}`;
      const { data, error } = await sb.storage.from(BUCKET_NAME).download(storagePath);
      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        getMemoryCache().set(docId, {
          buffer: buf,
          filename: requestedFilename,
          createdAt: Date.now()
        });
        return { buffer: buf, filename: requestedFilename };
      }
    } catch {
      // ignore
    }
  }

  return null;
}
