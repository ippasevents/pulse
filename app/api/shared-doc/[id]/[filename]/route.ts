import { NextRequest, NextResponse } from 'next/server';
import { loadSharedPdfDocument } from '@/lib/sharedDocStorage';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; filename: string }> }
) {
  try {
    const resolved = await context.params;
    const docId = decodeURIComponent(resolved.id || '');
    const filename = decodeURIComponent(resolved.filename || 'Document.pdf');

    const loaded = await loadSharedPdfDocument(docId, filename);
    if (!loaded) {
      return new NextResponse('Document expired or not found. Please request an updated PDF copy.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    const bytes = new Uint8Array(loaded.buffer);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `inline; filename="${loaded.filename}"`,
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch {
    return new NextResponse('Unable to load PDF document.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
