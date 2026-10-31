/**
 * Device detection & unified WhatsApp Document (PDF) + Text sharing utilities.
 *
 * - On Smartphones & Tablets (Android / iOS, including "Desktop site" mode):
 *   Uses Web Share API Level 2 (`navigator.share({ files: [file], text: messageText })`)
 *   so BOTH the PDF document AND its message text attach together in WhatsApp in a single send action.
 * - Preserves synchronous browser user activation (`navigator.userActivation`) when a pre-built PDF is passed,
 *   and returns `gestureExpired: true` if an async PDF build preceded the share so the UI can trigger a 1-tap share.
 * - "Copy Text" buttons are shown ONLY on Desktop / Laptop Web Views (`isDesktopWebView() === true`).
 * - Never calls `window.open`; uses safe programmatic `<a target="_blank" rel="noopener noreferrer">` clicks.
 */

export interface PreparedWhatsAppSharePayload {
  file: File;
  blob: Blob;
  filename: string;
  messageText: string;
  cleanPhone: string;
}

export interface WhatsAppShareOutcome {
  success: boolean;
  sharedDirectlyWithFile: boolean;
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

/**
 * True on any smartphone or touch device (even when mobile Chrome has "Desktop site" checked).
 */
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

export async function sharePdfWithCaptionToWhatsApp(
  params: PreparedWhatsAppSharePayload
): Promise<WhatsAppShareOutcome> {
  const { file, blob, filename, messageText, cleanPhone } = params;

  const canUseWebShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    (() => {
      try {
        return navigator.canShare({ files: [file] });
      } catch {
        return false;
      }
    })();

  // IMPORTANT: Call navigator.share BEFORE any await (like clipboard) so transient user activation stays active!
  if (canUseWebShareFiles && isTouchCapableOrMobile()) {
    try {
      // Omit `title` so Android/iOS map `text` directly to WhatsApp's document caption (PDF + Text together)
      await navigator.share({
        files: [file],
        text: messageText
      });
      return { success: true, sharedDirectlyWithFile: true, file };
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        return { success: true, sharedDirectlyWithFile: true, file };
      }

      // If async PDF generation expired user activation, return payload for immediate 1-tap synchronous retry
      if (shareErr?.name === 'NotAllowedError') {
        return {
          success: false,
          sharedDirectlyWithFile: false,
          gestureExpired: true,
          file,
          payload: params,
          error: 'Tap once more to open WhatsApp with PDF & Text attached together.'
        };
      }

      // If an older browser rejects combined files + text with TypeError, copy caption & share PDF file
      if (shareErr?.name === 'TypeError') {
        try {
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(messageText).catch(() => {});
          }
          await navigator.share({ files: [file] });
          return { success: true, sharedDirectlyWithFile: true, file };
        } catch (retryErr: any) {
          if (retryErr?.name === 'AbortError') {
            return { success: true, sharedDirectlyWithFile: true, file };
          }
        }
      }
    }
  }

  // Desktop / Laptop Web View fallback: copy text, download PDF, and open WhatsApp Web/App with text pre-filled
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(messageText);
    }
  } catch {
    // ignore clipboard permission errors
  }

  triggerPdfBlobDownload(blob, filename);

  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
    : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
  openExternalUrlSafe(waUrl);

  return { success: true, sharedDirectlyWithFile: false, file };
}
