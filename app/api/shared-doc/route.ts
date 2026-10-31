import { NextRequest, NextResponse } from 'next/server';
import { saveSharedPdfDocument } from '@/lib/sharedDocStorage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let rawId = '';
    let rawFilename = 'Document.pdf';
    let pdfBuffer: Buffer | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      rawId = String(formData.get('docId') || `doc-${Date.now()}`);
      rawFilename = String(formData.get('filename') || 'Document.pdf');
      const fileEntry = formData.get('file');
      if (fileEntry && typeof (fileEntry as Blob).arrayBuffer === 'function') {
        const ab = await (fileEntry as Blob).arrayBuffer();
        pdfBuffer = Buffer.from(ab);
      }
    } else {
      const body = await req.json();
      rawId = String(body.docId || `doc-${Date.now()}`);
      rawFilename = String(body.filename || 'Document.pdf');
      if (typeof body.base64Pdf === 'string' && body.base64Pdf.length > 0) {
        const cleanBase64 = body.base64Pdf.replace(/^data:application\/pdf;base64,/, '');
        pdfBuffer = Buffer.from(cleanBase64, 'base64');
      }
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Missing PDF file payload.' },
        { status: 400 }
      );
    }

    const saved = await saveSharedPdfDocument(rawId, rawFilename, pdfBuffer);
    const relativeUrl = `/api/shared-doc/${encodeURIComponent(saved.docId)}/${encodeURIComponent(saved.filename)}`;

    return NextResponse.json({
      ok: true,
      docId: saved.docId,
      filename: saved.filename,
      relativeUrl,
      supabasePublicUrl: saved.supabasePublicUrl || null
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to store shared PDF document.' },
      { status: 500 }
    );
  }
}
