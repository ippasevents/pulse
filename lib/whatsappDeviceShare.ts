/**
 * Device detection & Direct-to-Client WhatsApp Document (PDF) + Text sharing utilities.
 *
 * Why previous OS Share Sheet (`navigator.share({ files: [pdf], text })`) failed user needs:
 * 1. WhatsApp's Android/iOS OS share receiver for `application/pdf` strips `EXTRA_TEXT`, attaching ONLY the PDF without text.
 * 2. OS Share Sheet cannot target a specific recipient phone number (`cleanPhone`), forcing manual contact search.
 *
 * Solution:
 * - Pre-uploads the generated A4 PDF to `/api/shared-doc` (backed by server cache, /tmp, and Supabase Storage)
 *   to obtain an instant, public, zero-login `.pdf` document URL (`.../api/shared-doc/<id>/<filename>.pdf`).
 * - Opens the exact Client's / Staff's WhatsApp number (`https://wa.me/<cleanPhone>?text=...`) directly
 *   with BOTH the full formatted message text AND the official clickable/downloadable `.pdf` document attached together!
 * - "Copy Text" buttons remain strictly Desktop / Laptop Web View only (`isDesktopWebView() === true`).
 * - Never calls `window.open`; uses safe programmatic `<a target="_blank" rel="noopener noreferrer">` clicks.
 */

export interface PreparedWhatsAppSharePayload {
  file: File;
  blob: Blob;
  filename: string;
  messageText: string;
  cleanPhone: string;
  docId?: string;
  preUploadedPdfUrl?: string | null;
}

export interface WhatsAppShareOutcome {
  success: boolean;
  sharedDirectlyWithFile: boolean;
  openedDirectClientChat?: boolean;
  pdfPublicUrl?: string;
  gestureExpired?: boolean;
  file: File;
  payload?: PreparedWhatsAppSharePayload;
  error?: string;
}

export function isDesktopWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const navWithUAData = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };
  if (navWithUAData.userAgentData?.mobile === true) {
    return false;
  }

  const ua = navigator.userAgent || '';
  const mobileRegex =
    /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
  if (mobileRegex.test(ua)) {
    return false;
  }

  const isIPad =
    /iPad/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIPad) {
    return false;
  }

  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    window.innerWidth < 1024
  ) {
    return false;
  }

  return true;
}

export function isTouchCapableOrMobile(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  if (!isDesktopWebView()) return true;
  if ((navigator.maxTouchPoints || 0) > 0) return true;
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  ) {
    return true;
  }
  return false;
}

export function openExternalUrlSafe(url: string): void {
  if (typeof document === 'undefined') return;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function triggerPdfBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Uploads a generated PDF Blob to `/api/shared-doc` and returns a direct public `.pdf` URL
 * so the recipient can view/download the official PDF directly inside WhatsApp without login.
 */
export async function uploadSharedPdfForWhatsApp(
  blob: Blob,
  filename: string,
  docId?: string
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const safeId =
      docId ||
      `${filename.replace(/\.pdf$/i, '')}-${Date.now().toString(36)}`;
    const formData = new FormData();
    formData.append('docId', safeId);
    formData.append('filename', filename);
    formData.append('file', blob, filename);

    const res = await fetch('/api/shared-doc', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.ok && data?.relativeUrl) {
      return `${window.location.origin}${data.relativeUrl}`;
    }
    if (data?.ok && data?.supabasePublicUrl) {
      return String(data.supabasePublicUrl);
    }
    return null;
  } catch {
    return null;
  }
}

export function composeWhatsAppMessageWithPdfLink(
  messageText: string,
  filename: string,
  pdfUrl?: string | null
): string {
  const base = (messageText || '').trim();
  if (!pdfUrl) return base;
  if (base.includes(pdfUrl)) return base;
  return `${base}\n\n📄 *Official PDF Document (${filename}):*\n${pdfUrl}`;
}

/**
 * Primary WhatsApp Share Action:
 * Sends BOTH the complete message text AND the official PDF document directly to the
 * Client's / Staff's WhatsApp phone number (`https://wa.me/<cleanPhone>?text=...`).
 */
export async function sharePdfWithCaptionToWhatsApp(
  params: PreparedWhatsAppSharePayload
): Promise<WhatsAppShareOutcome> {
  const {
    file,
    blob,
    filename,
    messageText,
    cleanPhone,
    docId,
    preUploadedPdfUrl
  } = params;

  if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
    return {
      success: false,
      sharedDirectlyWithFile: false,
      file,
      error:
        'Please enter a valid 10-digit WhatsApp mobile number so both the Text and PDF Document attach directly to the client’s WhatsApp chat.'
    };
  }

  const pdfUrl =
    preUploadedPdfUrl ||
    (await uploadSharedPdfForWhatsApp(blob, filename, docId));

  const combinedMessage = composeWhatsAppMessageWithPdfLink(
    messageText,
    filename,
    pdfUrl
  );

  // Copy combined message silently as convenience backup
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(combinedMessage).catch(() => {});
    }
  } catch {
    // ignore clipboard errors
  }

  // On Desktop / Laptop Web View, also save a local copy of the PDF file automatically
  if (isDesktopWebView()) {
    triggerPdfBlobDownload(blob, filename);
  }

  // Open the recipient's WhatsApp chat number directly with BOTH Text + Official PDF Document attached
  const digits = cleanPhone.replace(/\D/g, '');
  const waDirectUrl = `https://wa.me/${digits}?text=${encodeURIComponent(
    combinedMessage
  )}`;
  openExternalUrlSafe(waDirectUrl);

  return {
    success: true,
    sharedDirectlyWithFile: Boolean(pdfUrl),
    openedDirectClientChat: true,
    pdfPublicUrl: pdfUrl || undefined,
    file
  };
}

/**
 * Optional secondary helper for mobile users who also want to share the raw offline PDF file
 * via OS Share Sheet (automatically copies the message text to clipboard first so text is never lost).
 */
export async function shareRawPdfFileViaOsSheet(
  file: File,
  messageText: string
): Promise<{ shared: boolean; error?: string }> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(messageText).catch(() => {});
    }
  } catch {
    // ignore
  }

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: messageText
        });
        return { shared: true };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { shared: false };
      }
      return {
        shared: false,
        error: 'Could not open device file share sheet.'
      };
    }
  }

  return {
    shared: false,
    error: 'Device file share sheet is only supported on mobile browsers.'
  };
}
