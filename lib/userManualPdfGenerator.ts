import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  getUserManualsByLanguage,
  MANUAL_ROLE_ORDER,
  ManualChapter,
  ManualLanguage,
  ManualRoleKey,
  RoleUserManual
} from '@/lib/userManualsMalayalam';
import { triggerPdfBlobDownload } from '@/lib/whatsappDeviceShare';

function escapeHtml(val?: string | number | null): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PDF_FONT_STACK = `'Plus Jakarta Sans', 'Noto Sans Malayalam', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

function buildChapterHtml(
  chapter: ManualChapter,
  accentColor: string,
  language: ManualLanguage
): string {
  const isMl = language === 'ml';
  const bodyLineHeight = isMl ? '1.66' : '1.56';
  const bodyFontSize = isMl ? '0.78rem' : '0.81rem';

  const stepsHtml = chapter.stepsMl
    .map(
      (step, idx) => `
        <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 6px;">
          <span style="min-width: 22px; height: 22px; border-radius: 5px; background: #f8fafc; border: 1px solid #cbd5e1; color: ${accentColor}; font-size: 0.72rem; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; margin-top: 2px; font-variant-numeric: tabular-nums;">
            ${idx + 1}
          </span>
          <div style="font-size: ${bodyFontSize}; line-height: ${bodyLineHeight}; color: #1e293b; flex: 1;">
            ${escapeHtml(step)}
          </div>
        </div>
      `
    )
    .join('');

  const notePrefix = isMl ? 'പ്രധാന കുറിപ്പ്:' : 'Important Note:';

  const noteHtml = chapter.importantNoteMl
    ? `
      <div style="margin-top: 9px; padding: 8px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-size: ${isMl ? '0.74rem' : '0.76rem'}; line-height: ${isMl ? '1.62' : '1.55'}; color: #334155;">
        <strong style="color: #0f172a;">${notePrefix}</strong> ${escapeHtml(chapter.importantNoteMl)}
      </div>
    `
    : '';

  const modulePrefix = isMl ? 'മൊഡ്യൂൾ:' : 'Module:';

  return `
    <div style="border: 1px solid #e2e8f0; border-top: 3px solid ${accentColor}; border-radius: 8px; padding: 13px 16px; margin-bottom: 12px; background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-bottom: 7px; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
        <div style="font-size: ${isMl ? '0.9rem' : '0.94rem'}; font-weight: 700; color: #0f172a; line-height: 1.45;">
          <span style="color: ${accentColor}; font-variant-numeric: tabular-nums; margin-right: 6px;">${escapeHtml(chapter.number)}.</span>${escapeHtml(chapter.titleMl)}
        </div>
        <div style="font-size: 0.69rem; font-weight: 600; color: #64748b; white-space: nowrap;">
          ${modulePrefix} ${escapeHtml(chapter.menuLabel)}
        </div>
      </div>

      <div style="font-size: ${isMl ? '0.77rem' : '0.8rem'}; color: #475569; line-height: ${bodyLineHeight}; margin-bottom: 9px;">
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
 * Builds discrete A4 portrait pages for a RoleUserManual in either English ('en') or Malayalam ('ml')
 * so content never slices across page breaks.
 */
export function buildRoleManualPagesHtml(
  manual: RoleUserManual,
  businessName = 'IPPAS FOOD SERVICE & EVENTS',
  businessPhone = '+91 98470 11111',
  language: ManualLanguage = 'en'
): string[] {
  const isMl = language === 'ml';
  const totalPages = manual.pages.length;
  const issueDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const allChaptersFlat = manual.pages.flatMap((p) => p.chapters);
  const editionBadge = isMl
    ? `IPPAS PULSE · ഔദ്യോഗിക യൂസർ മാനുവൽ (${escapeHtml(manual.malayalamRoleName)} - മലയാളം പതിപ്പ്)`
    : `IPPAS PULSE · Official Role-Based User Manual (${escapeHtml(manual.englishRoleLabel)} — English Edition)`;
  const sectionLabel = isMl ? 'വിഭാഗം:' : 'Section:';
  const checklistHeading = isMl
    ? 'പ്രധാന നിർദ്ദേശങ്ങളും ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങളും'
    : 'Key Best Practices & Quick Operational Checklist';

  return manual.pages.map((pageGroup, pageIndex) => {
    const pageNum = pageIndex + 1;
    const isCoverPage = pageIndex === 0;
    const isLastPage = pageIndex === totalPages - 1;

    const runningHeaderHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; margin-bottom: 14px; border-bottom: 2px solid ${manual.accentColor};">
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
          <div style="font-size: 0.9rem; font-weight: 700; color: ${manual.accentColor};">
            ${escapeHtml(manual.titleMl)}
          </div>
          <div style="font-size: 0.71rem; color: #64748b; margin-top: 2px; font-variant-numeric: tabular-nums;">
            ${escapeHtml(manual.docCode)} &middot; Page ${pageNum} of ${totalPages}
          </div>
        </div>
      </div>
    `;

    const coverHeroHtml = isCoverPage
      ? `
        <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #cbd5e1; border-top: 4px solid ${manual.accentColor}; border-radius: 10px; padding: 15px 18px; margin-bottom: 13px;">
          <div style="font-size: 0.73rem; font-weight: 700; color: ${manual.accentColor}; margin-bottom: 4px;">
            ${editionBadge}
          </div>
          <div style="font-size: ${isMl ? '1.34rem' : '1.45rem'}; font-weight: 800; color: #0f172a; line-height: 1.32; margin-bottom: 6px;">
            ${escapeHtml(manual.titleMl)}
          </div>
          <div style="font-size: ${isMl ? '0.79rem' : '0.82rem'}; color: #334155; line-height: ${isMl ? '1.62' : '1.55'}; margin-bottom: 9px;">
            ${escapeHtml(manual.subtitleMl)}
          </div>
          <div style="font-size: ${isMl ? '0.75rem' : '0.78rem'}; color: #475569; line-height: ${isMl ? '1.64' : '1.56'}; padding-top: 8px; border-top: 1px solid #cbd5e1;">
            ${escapeHtml(manual.overviewMl)}
          </div>

          <div style="margin-top: 9px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 5px 14px;">
            ${allChaptersFlat
              .map(
                (ch) => `
                  <div style="font-size: ${isMl ? '0.72rem' : '0.74rem'}; color: #1e293b; line-height: 1.48;">
                    <strong style="color: ${manual.accentColor}; font-variant-numeric: tabular-nums;">${escapeHtml(ch.number)}.</strong> ${escapeHtml(ch.titleMl)}
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      `
      : `
        <div style="margin-bottom: 10px; font-size: 0.8rem; font-weight: 700; color: ${manual.accentColor};">
          ${sectionLabel} ${escapeHtml(pageGroup.pageTitleMl)}
        </div>
      `;

    const chaptersHtml = pageGroup.chapters
      .map((ch) => buildChapterHtml(ch, manual.accentColor, language))
      .join('');

    const bestPracticesHtml = isLastPage
      ? `
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 13px 16px; margin-top: 6px;">
          <div style="font-size: 0.84rem; font-weight: 700; color: #0f172a; margin-bottom: 7px;">
            ${checklistHeading}
          </div>
          ${manual.bestPracticesMl
            .map(
              (tip) => `
                <div style="font-size: ${isMl ? '0.76rem' : '0.78rem'}; color: #334155; line-height: ${isMl ? '1.64' : '1.58'}; margin-bottom: 4px;">
                  &bull; ${escapeHtml(tip)}
                </div>
              `
            )
            .join('')}
        </div>
      `
      : '';

    const footerHtml = `
      <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: #64748b;">
        <div>
          ${escapeHtml(businessName)} &middot; Phone: ${escapeHtml(businessPhone)}
        </div>
        <div style="font-variant-numeric: tabular-nums;">
          Revised Edition (${isMl ? 'Malayalam' : 'English'}): ${escapeHtml(issueDate)} &middot; Page ${pageNum} of ${totalPages}
        </div>
      </div>
    `;

    return `
      <div style="width: 794px; min-height: 1105px; padding: 26px 32px; font-family: ${PDF_FONT_STACK}; color: #0f172a; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
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

async function ensureFontsReady(): Promise<void> {
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
  businessPhone?: string,
  language: ManualLanguage = 'en'
): Promise<{ blob: Blob; file: File; filename: string } | null> {
  if (typeof window === 'undefined') return null;

  const manualsMap = getUserManualsByLanguage(language);
  const manual = manualsMap[roleKey];
  if (!manual) return null;

  try {
    await ensureFontsReady();

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pagesHtml = buildRoleManualPagesHtml(manual, businessName, businessPhone, language);
    for (let i = 0; i < pagesHtml.length; i++) {
      await appendSingleSheetToPdf(pdf, pagesHtml[i], i === 0);
    }

    const blob = pdf.output('blob');
    const filename = manual.pdfFilename;
    const file = new File([blob], filename, { type: 'application/pdf' });

    return { blob, file, filename };
  } catch (err) {
    console.error(`Error generating user manual PDF (${language}) for ${roleKey}:`, err);
    return null;
  }
}

export async function downloadRoleUserManualPdf(
  roleKey: ManualRoleKey,
  businessName?: string,
  businessPhone?: string,
  language: ManualLanguage = 'en'
): Promise<boolean> {
  const result = await generateRoleUserManualPdfBlob(
    roleKey,
    businessName,
    businessPhone,
    language
  );
  if (!result) return false;
  triggerPdfBlobDownload(result.blob, result.filename);
  return true;
}

export async function downloadAllFourUserManualPdfs(
  businessName?: string,
  businessPhone?: string,
  onProgress?: (currentIndex: number, roleKey: ManualRoleKey) => void,
  language: ManualLanguage = 'en'
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  for (let i = 0; i < MANUAL_ROLE_ORDER.length; i++) {
    const key = MANUAL_ROLE_ORDER[i];
    if (onProgress) onProgress(i + 1, key);
    const ok = await downloadRoleUserManualPdf(key, businessName, businessPhone, language);
    if (!ok) return false;
    await new Promise((resolve) => setTimeout(resolve, 450));
  }
  return true;
}
