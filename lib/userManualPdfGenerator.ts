import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  MALAYALAM_USER_MANUALS,
  MANUAL_ROLE_ORDER,
  ManualChapter,
  ManualRoleKey,
  RoleUserManual
} from '@/lib/userManualsMalayalam';
import { printHtmlDocument } from '@/lib/printDocument';
import {
  sharePdfWithCaptionToWhatsApp,
  triggerPdfBlobDownload
} from '@/lib/whatsappDeviceShare';

function escapeHtml(val?: string | number | null): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PDF_FONT_STACK = `'Noto Sans Malayalam', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

function buildChapterHtml(chapter: ManualChapter, accentColor: string): string {
  const stepsHtml = chapter.stepsMl
    .map(
      (step, idx) => `
        <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 7px;">
          <span style="min-width: 22px; height: 22px; border-radius: 4px; background: #f1f5f9; border: 1px solid #cbd5e1; color: #0f172a; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; margin-top: 2px; font-variant-numeric: tabular-nums;">
            ${idx + 1}
          </span>
          <div style="font-size: 0.84rem; line-height: 1.7; color: #1e293b; flex: 1;">
            ${escapeHtml(step)}
          </div>
        </div>
      `
    )
    .join('');

  const noteHtml = chapter.importantNoteMl
    ? `
      <div style="margin-top: 10px; padding: 9px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.79rem; line-height: 1.62; color: #334155;">
        <strong style="color: #0f172a;">ശ്രദ്ധിക്കുക:</strong> ${escapeHtml(chapter.importantNoteMl)}
      </div>
    `
    : '';

  return `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px 18px; margin-bottom: 14px; background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-bottom: 8px; margin-bottom: 9px; border-bottom: 1px solid #f1f5f9;">
        <div style="font-size: 0.98rem; font-weight: 700; color: #0f172a; line-height: 1.45;">
          <span style="color: ${accentColor}; font-variant-numeric: tabular-nums; margin-right: 6px;">${escapeHtml(chapter.number)}.</span>${escapeHtml(chapter.titleMl)}
        </div>
        <div style="font-size: 0.72rem; font-weight: 600; color: #64748b; white-space: nowrap;">
          മെനു: ${escapeHtml(chapter.menuLabel)}
        </div>
      </div>

      <div style="font-size: 0.83rem; color: #475569; line-height: 1.65; margin-bottom: 10px;">
        ${escapeHtml(chapter.summaryMl)}
      </div>

      <div>
        ${stepsHtml}
      </div>

      ${noteHtml}
    </div>
  `;
}

/**
 * Builds an array of discrete A4 page HTML strings for a given RoleUserManual.
 * Each page is sized to 794px width x ~1115px min-height so Malayalam lines never split across page boundaries.
 */
export function buildRoleManualPagesHtml(
  manual: RoleUserManual,
  businessName = 'IPPAS FOOD SERVICE & EVENTS',
  businessPhone = '+91 98470 11111'
): string[] {
  const totalPages = manual.pages.length;
  const issueDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const allChaptersFlat = manual.pages.flatMap((p) => p.chapters);

  return manual.pages.map((pageGroup, pageIndex) => {
    const pageNum = pageIndex + 1;
    const isCoverPage = pageIndex === 0;
    const isLastPage = pageIndex === totalPages - 1;

    const runningHeaderHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; margin-bottom: 16px; border-bottom: 2px solid #0f172a;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="/logo.png" alt="IPPAS Logo" style="height: 44px; width: auto; object-fit: contain; display: block;" />
          <div>
            <div style="font-weight: 800; font-size: 0.98rem; color: #0f172a; letter-spacing: 0.2px;">
              ${escapeHtml(businessName)}
            </div>
            <div style="font-size: 0.73rem; color: #475569;">
              Outdoor Catering &bull; Event Management &bull; Calicut
            </div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.92rem; font-weight: 700; color: ${manual.accentColor};">
            ${escapeHtml(manual.titleMl)}
          </div>
          <div style="font-size: 0.71rem; color: #64748b; margin-top: 2px; font-variant-numeric: tabular-nums;">
            ${escapeHtml(manual.docCode)} &middot; പേജ് ${pageNum} / ${totalPages}
          </div>
        </div>
      </div>
    `;

    const coverHeroHtml = isCoverPage
      ? `
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px 20px; margin-bottom: 16px;">
          <div style="font-size: 0.74rem; font-weight: 700; color: ${manual.accentColor}; margin-bottom: 4px;">
            IPPAS PULSE &middot; ഔദ്യോഗിക മലയാളം യൂസർ മാനുവൽ (${escapeHtml(manual.englishRoleLabel)} Guide)
          </div>
          <div style="font-size: 1.55rem; font-weight: 800; color: #0f172a; line-height: 1.3; margin-bottom: 6px;">
            ${escapeHtml(manual.titleMl)}
          </div>
          <div style="font-size: 0.85rem; color: #334155; line-height: 1.6; margin-bottom: 12px;">
            ${escapeHtml(manual.subtitleMl)}
          </div>
          <div style="font-size: 0.81rem; color: #475569; line-height: 1.68; padding-top: 10px; border-top: 1px solid #e2e8f0;">
            ${escapeHtml(manual.overviewMl)}
          </div>

          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px;">
            ${allChaptersFlat
              .map(
                (ch) => `
                  <div style="font-size: 0.76rem; color: #1e293b; line-height: 1.5;">
                    <strong style="color: ${manual.accentColor}; font-variant-numeric: tabular-nums;">${escapeHtml(ch.number)}.</strong> ${escapeHtml(ch.titleMl)}
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      `
      : `
        <div style="margin-bottom: 12px; font-size: 0.8rem; font-weight: 700; color: #475569;">
          അധ്യായ വിഭാഗം: ${escapeHtml(pageGroup.pageTitleMl)}
        </div>
      `;

    const chaptersHtml = pageGroup.chapters
      .map((ch) => buildChapterHtml(ch, manual.accentColor))
      .join('');

    const bestPracticesHtml = isLastPage
      ? `
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; margin-top: 6px;">
          <div style="font-size: 0.88rem; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
            പ്രധാന ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ (Quick Tips)
          </div>
          ${manual.bestPracticesMl
            .map(
              (tip) => `
                <div style="font-size: 0.8rem; color: #334155; line-height: 1.65; margin-bottom: 5px;">
                  &bull; ${escapeHtml(tip)}
                </div>
              `
            )
            .join('')}
        </div>
      `
      : '';

    const footerHtml = `
      <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: #64748b;">
        <div>
          ${escapeHtml(businessName)} &middot; ഫോൺ: ${escapeHtml(businessPhone)}
        </div>
        <div style="font-variant-numeric: tabular-nums;">
          തയ്യാറാക്കിയത്: ${escapeHtml(issueDate)} &middot; പേജ് ${pageNum} / ${totalPages}
        </div>
      </div>
    `;

    return `
      <div style="width: 794px; min-height: 1105px; padding: 28px 32px; font-family: ${PDF_FONT_STACK}; color: #0f172a; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          ${runningHeaderHtml}
          ${coverHeroHtml}
          ${chaptersHtml}
          ${bestPracticesHtml}
        </div>
        ${footerHtml}
      </div>
    `;
  });
}

async function ensureMalayalamFontsReady(): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    if ('fonts' in document && document.fonts) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 1800))
      ]);
    }
  } catch {
    // Proceed gracefully if font API is unavailable
  }
}

async function appendSingleSheetToPdf(
  pdf: jsPDF,
  sheetHtml: string,
  isFirstPage: boolean
): Promise<void> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-9999px';
  container.style.width = '794px';
  container.style.zIndex = '-1000';
  container.style.background = '#ffffff';
  container.innerHTML = sheetHtml;
  document.body.appendChild(container);

  try {
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
      )
    );

    const canvas = await html2canvas(container, {
      scale: 2.1,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 800
    });

    const margin = 7;
    const pageWidth = 210;
    const pageHeight = 297;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    const contentWidth = printableWidth;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    if (!isFirstPage) {
      pdf.addPage();
    }

    const imgData = canvas.toDataURL('image/png');
    if (contentHeight <= printableHeight) {
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
    } else {
      // Fit proportionally onto one A4 sheet so Malayalam lines never slice mid-character
      const scaledWidth = (printableHeight * canvas.width) / canvas.height;
      const xOffset = margin + (printableWidth - scaledWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, margin, scaledWidth, printableHeight);
    }
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export async function generateRoleUserManualPdfBlob(
  roleKey: ManualRoleKey,
  businessName?: string,
  businessPhone?: string
): Promise<{ blob: Blob; file: File; filename: string } | null> {
  if (typeof window === 'undefined') return null;

  const manual = MALAYALAM_USER_MANUALS[roleKey];
  if (!manual) return null;

  try {
    await ensureMalayalamFontsReady();

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pagesHtml = buildRoleManualPagesHtml(manual, businessName, businessPhone);
    for (let i = 0; i < pagesHtml.length; i++) {
      await appendSingleSheetToPdf(pdf, pagesHtml[i], i === 0);
    }

    const blob = pdf.output('blob');
    const filename = manual.pdfFilename;
    const file = new File([blob], filename, { type: 'application/pdf' });

    return { blob, file, filename };
  } catch (err) {
    console.error(`Error generating Malayalam manual PDF for ${roleKey}:`, err);
    return null;
  }
}

export async function downloadRoleUserManualPdf(
  roleKey: ManualRoleKey,
  businessName?: string,
  businessPhone?: string
): Promise<boolean> {
  const result = await generateRoleUserManualPdfBlob(roleKey, businessName, businessPhone);
  if (!result) return false;
  triggerPdfBlobDownload(result.blob, result.filename);
  return true;
}

export async function downloadAllFourUserManualPdfs(
  businessName?: string,
  businessPhone?: string,
  onProgress?: (currentIndex: number, roleKey: ManualRoleKey) => void
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  for (let i = 0; i < MANUAL_ROLE_ORDER.length; i++) {
    const key = MANUAL_ROLE_ORDER[i];
    if (onProgress) onProgress(i + 1, key);
    const ok = await downloadRoleUserManualPdf(key, businessName, businessPhone);
    if (!ok) return false;
    // Brief pause between downloads so browsers permit all 4 individual PDF files cleanly
    await new Promise((resolve) => setTimeout(resolve, 450));
  }
  return true;
}

export function printRoleUserManual(
  roleKey: ManualRoleKey,
  businessName?: string,
  businessPhone?: string
): boolean {
  const manual = MALAYALAM_USER_MANUALS[roleKey];
  if (!manual) return false;

  const pagesHtml = buildRoleManualPagesHtml(manual, businessName, businessPhone);
  const combinedPrintableHtml = pagesHtml
    .map(
      (pageMarkup, idx) => `
        <div style="${idx < pagesHtml.length - 1 ? 'page-break-after: always; break-after: page;' : ''}">
          ${pageMarkup}
        </div>
      `
    )
    .join('');

  return printHtmlDocument(combinedPrintableHtml, {
    title: `${manual.titleMl} - ${manual.englishRoleLabel}`,
    orientation: 'portrait'
  });
}

export function buildManualWhatsAppCaption(
  roleKey: ManualRoleKey,
  businessName = 'IPPAS Food Service & Events'
): string {
  const manual = MALAYALAM_USER_MANUALS[roleKey];
  return [
    `*${businessName}*`,
    `Outdoor Catering • Event Management • Calicut`,
    ``,
    `📘 *${manual.titleMl} (${manual.englishRoleLabel} User Manual)*`,
    `${manual.subtitleMl}`,
    ``,
    `ആപ്ലിക്കേഷൻ എങ്ങനെ ഉപയോഗിക്കണമെന്നതിന്റെ പൂർണ്ണ മലയാളം യൂസർ മാനുവൽ PDF ഇതോടൊപ്പം ചേർക്കുന്നു.`
  ].join('\n');
}

export async function shareRoleUserManualOnWhatsApp(params: {
  roleKey: ManualRoleKey;
  recipientPhone?: string;
  businessName?: string;
  businessPhone?: string;
  prebuiltPdf?: { blob: Blob; file: File; filename: string };
  customMessage?: string;
}): Promise<{
  success: boolean;
  sharedDirectlyWithFile: boolean;
  gestureExpired?: boolean;
  error?: string;
}> {
  const {
    roleKey,
    recipientPhone = '',
    businessName,
    businessPhone,
    prebuiltPdf,
    customMessage
  } = params;

  const cleanPhone = recipientPhone.replace(/\D/g, '');
  const normalizedPhone =
    cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  const messageText =
    customMessage && customMessage.trim()
      ? customMessage.trim()
      : buildManualWhatsAppCaption(roleKey, businessName);

  if (prebuiltPdf) {
    return sharePdfWithCaptionToWhatsApp({
      file: prebuiltPdf.file,
      blob: prebuiltPdf.blob,
      filename: prebuiltPdf.filename,
      messageText,
      cleanPhone: normalizedPhone
    });
  }

  const generated = await generateRoleUserManualPdfBlob(roleKey, businessName, businessPhone);
  if (!generated) {
    return {
      success: false,
      sharedDirectlyWithFile: false,
      error: 'Could not generate manual PDF.'
    };
  }

  return sharePdfWithCaptionToWhatsApp({
    file: generated.file,
    blob: generated.blob,
    filename: generated.filename,
    messageText,
    cleanPhone: normalizedPhone
  });
}
