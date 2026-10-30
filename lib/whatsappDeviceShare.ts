/**
 * Device detection & native WhatsApp PDF + Text sharing utilities.
 *
 * - On Smartphones (Android / iOS): Uses Web Share API Level 2 (`navigator.share({ files: [file], text: messageText })`)
 *   so BOTH the PDF document AND its formatted caption text attach automatically in WhatsApp.
 * - Copy Text buttons are shown ONLY on Desktop / Laptop Web Views (`isDesktopWebView() === true`).
 * - Never calls `window.open`; uses safe programmatic `<a target="_blank" rel="noopener noreferrer">` clicks.
 */

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

  // iPadOS / touch-primary tablets
  const isIPad =
    /iPad/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIPad) {
    return false;
  }

  // Narrow touch viewport (e.g. mobile browser / responsive smartphone mode)
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    window.innerWidth < 1024
  ) {
    return false;
  }

  return true;
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

export async function sharePdfWithCaptionToWhatsApp(params: {
  file: File;
  blob: Blob;
  filename: string;
  messageText: string;
  cleanPhone: string;
}): Promise<{
  success: boolean;
  sharedDirectlyWithFile: boolean;
  file: File;
  error?: string;
}> {
  const { file, blob, filename, messageText, cleanPhone } = params;

  const canUseWebShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });

  // Prefer native OS Share Sheet on smartphones / mobile browsers so PDF + Text attach together
  if (canUseWebShareFiles && !isDesktopWebView()) {
    try {
      // Omit `title` so Android/iOS share intents map `messageText` directly to EXTRA_TEXT (WhatsApp document caption)
      await navigator.share({
        files: [file],
        text: messageText
      });
      return { success: true, sharedDirectlyWithFile: true, file };
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        return { success: true, sharedDirectlyWithFile: true, file };
      }
      // If a browser rejects combined files + text with TypeError, copy text and share file
      if (shareErr?.name === 'TypeError') {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(messageText);
          }
          await navigator.share({ files: [file] });
          return { success: true, sharedDirectlyWithFile: true, file };
        } catch (retryErr: any) {
          if (retryErr?.name === 'AbortError') {
            return { success: true, sharedDirectlyWithFile: true, file };
          }
        }
      }
      console.warn(
        'Native smartphone share failed, falling back to download + WhatsApp link:',
        shareErr
      );
    }
  }

  // Desktop / Laptop Web View (or fallback): copy caption, download PDF, and open WhatsApp chat with text pre-attached
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
