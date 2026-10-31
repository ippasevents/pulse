import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { EventExtra, EventRecord } from '@/lib/types';
import { store, AppState, isAutoLabourChargeExtra } from '@/lib/store';
import { sharePdfWithCaptionToWhatsApp } from '@/lib/whatsappDeviceShare';

function escapeHtml(val?: string | number | null): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeWhatsAppPhone(raw?: string): string {
  const digits = (raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Ensures every Quotation includes the mandatory 'Labour Charges' line item based on
 * assigned staff shifts without mutating finalized/completed historical events.
 */
export function resolveQuotationExtrasWithMandatoryLabour(
  liveEvent: EventRecord,
  state: AppState
): {
  displayExtras: EventExtra[];
  menuTotal: number;
  extrasTotal: number;
  grandTotal: number;
} {
  const baseTotals = store.getEventTotal(liveEvent.id);
  const rawExtras = state.eventExtras.filter((x) => x.event_id === liveEvent.id);
  const hasLabourExtra = rawExtras.some((ex) => isAutoLabourChargeExtra(ex.description));

  if (hasLabourExtra) {
    // Place Labour Charges first among service/extra charges for clear visibility
    const sorted = [...rawExtras].sort((a, b) => {
      const aLab = isAutoLabourChargeExtra(a.description) ? 0 : 1;
      const bLab = isAutoLabourChargeExtra(b.description) ? 0 : 1;
      return aLab - bLab;
    });
    return {
      displayExtras: sorted,
      menuTotal: baseTotals.menuTotal,
      extrasTotal: baseTotals.extrasTotal,
      grandTotal: baseTotals.grandTotal
    };
  }

  // Fallback for legacy events created before automatic Labour Charges row initialization:
  const hasLockedInvoice = state.invoices.some(
    (inv) => inv.event_id === liveEvent.id && (inv.status === 'paid' || inv.kind === 'final')
  );
  const isHistoricalLocked = liveEvent.status === 'completed' || hasLockedInvoice;
  const labourSummary = store.getEventAssignedLabourSummary(liveEvent.id);
  const computedLabourAmount = isHistoricalLocked ? 0 : labourSummary.totalLabourAmount;
  const syntheticLabourRow: EventExtra = {
    id: `auto-labour-${liveEvent.id}`,
    event_id: liveEvent.id,
    description: isHistoricalLocked
      ? 'Labour Charges'
      : labourSummary.label,
    amount: computedLabourAmount
  };

  const displayExtras = [syntheticLabourRow, ...rawExtras];
  const extrasTotal = baseTotals.extrasTotal + computedLabourAmount;
  const grandTotal = baseTotals.menuTotal + extrasTotal;

  return {
    displayExtras,
    menuTotal: baseTotals.menuTotal,
    extrasTotal,
    grandTotal
  };
}

/**
 * Generates an off-screen A4 portrait representation of the Event Quotation
 * (Menu Items + Mandatory Labour Charges + Logistics, Transport & Extra Charges)
 * and compiles it into a sharp PDF.
 */
export async function generateQuotationPdfBlob(
  event: EventRecord,
  state: AppState
): Promise<{ blob: Blob; file: File; quoteNumber: string } | null> {
  if (typeof window === 'undefined') return null;

  const liveEvent = state.events.find((e) => e.id === event.id) || event;
  const client = state.clients.find((c) => c.id === liveEvent.client_id);
  const quoteNumber = store.getQuotationNumber(liveEvent);
  const evtItems = state.eventItems.filter((i) => i.event_id === liveEvent.id);
  const { displayExtras, menuTotal, extrasTotal, grandTotal } =
    resolveQuotationExtrasWithMandatoryLabour(liveEvent, state);

  const showBankDetails = liveEvent.show_bank_details !== false;
  const showPaymentDetails = liveEvent.show_payment_details !== false;
  const termsText =
    liveEvent.payment_terms ||
    state.settings.payment_terms ||
    '50% Advance deposit upon confirmation, balance on event completion.';

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-9999px';
  container.style.width = '794px';
  container.style.zIndex = '-1000';
  container.style.background = '#ffffff';

  const cleanFilename = `${quoteNumber}.pdf`;

  container.innerHTML = `
    <div style="width: 794px; min-height: 1123px; padding: 36px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; background: #ffffff; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; border-bottom: 2px solid #0f172a; padding-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <img src="/logo.png" alt="Logo" style="height: 60px; width: auto; object-fit: contain; display: block;" />
          <div>
            <div style="font-weight: 800; font-size: 1.15rem; letter-spacing: 0.5px; color: #0f172a;">
              ${escapeHtml(state.settings.name || 'IPPAS FOOD SERVICE & EVENTS')}
            </div>
            <div style="font-size: 0.8rem; color: #64748b;">
              ${escapeHtml(state.settings.address || 'Outdoor Catering • Event Management • Calicut')}
            </div>
            <div style="font-size: 0.75rem; color: #64748b;">
              Phone: ${escapeHtml(state.settings.phone || '+91 98470 11111')} &bull; Email: ${escapeHtml(state.settings.email || 'events@ippas.com')}
            </div>
          </div>
        </div>
        <div style="text-align: right;">
          <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 2.3rem; font-weight: 700; color: #0f172a; line-height: 1; margin: 0;">
            Quotation
          </h1>
          <div style="font-size: 0.85rem; color: #64748b; margin-top: 4px; font-weight: 500;">
            Catering Proposal
          </div>
          <div style="font-size: 0.82rem; color: #0f172a; margin-top: 4px; font-weight: 700;">
            #${escapeHtml(quoteNumber)}
          </div>
        </div>
      </div>

      <!-- Metadata -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-bottom: 20px; background: #f8fafc; padding: 14px 18px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 0.85rem;">
        <div>
          <div style="font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px;">
            Prepared For:
          </div>
          <div style="font-size: 0.98rem; font-weight: 700; color: #0f172a;">
            ${escapeHtml(client?.name || 'Valued Client')}
          </div>
          ${client?.company ? `<div style="color: #334155;">🏢 ${escapeHtml(client.company)}</div>` : ''}
          ${client?.phone ? `<div style="color: #334155;">📞 ${escapeHtml(client.phone)}</div>` : ''}
          <div style="margin-top: 4px;"><strong>Event:</strong> ${escapeHtml(liveEvent.title)}</div>
        </div>

        <div style="text-align: right; line-height: 1.55;">
          <div><strong>Quote #:</strong> ${escapeHtml(quoteNumber)}</div>
          <div><strong>Quote Date:</strong> ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          <div><strong>Event Date:</strong> ${liveEvent.event_date ? new Date(liveEvent.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD'}</div>
          <div><strong>Venue:</strong> ${escapeHtml(liveEvent.venue || 'TBD')}</div>
          <div><strong>Guest Count:</strong> ${liveEvent.guest_count} Pax</div>
        </div>
      </div>

      <!-- Menu & Mandatory Labour Charges / Logistics Table -->
      <div style="margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 2px solid #0f172a; background: #f1f5f9;">
              <th style="text-align: left; padding: 8px 8px; font-weight: 700; color: #0f172a;">Dish / Service Particulars</th>
              <th style="text-align: center; padding: 8px 8px; font-weight: 700; color: #0f172a;">Category / Type</th>
              <th style="text-align: center; padding: 8px 8px; font-weight: 700; color: #0f172a;">Quantity</th>
              <th style="text-align: right; padding: 8px 8px; font-weight: 700; color: #0f172a;">Rate</th>
              <th style="text-align: right; padding: 8px 8px; font-weight: 700; color: #0f172a;">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${evtItems
              .map((item) => {
                const dish = state.menuItems.find((m) => m.id === item.menu_item_id);
                const dishName = item.dish_name || dish?.name || 'Menu Dish';
                const dishCategory = item.dish_category || dish?.category || '';
                const isKg = item.pricing_type === 'per_kg';
                const rate = item.price_per_unit || item.price_per_guest || 0;
                const qty = isKg
                  ? item.quantity !== undefined
                    ? item.quantity
                    : 1
                  : item.quantity !== undefined
                  ? item.quantity
                  : liveEvent.guest_count;
                const lineTotal = rate * qty;

                return `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 8px;">
                      <div style="font-weight: 600; color: #0f172a;">${escapeHtml(dishName)}</div>
                      ${dishCategory ? `<div style="font-size: 0.72rem; color: #64748b;">${escapeHtml(dishCategory)}</div>` : ''}
                    </td>
                    <td style="text-align: center; padding: 8px 8px; font-size: 0.78rem; color: #334155;">
                      ${isKg ? 'Per Kg' : 'Per Guest'}
                    </td>
                    <td style="text-align: center; padding: 8px 8px; font-weight: 600; color: #0f172a;">
                      ${qty} ${isKg ? 'kg' : 'pax'}
                    </td>
                    <td style="text-align: right; padding: 8px 8px; color: #334155;">
                      ₹${rate.toLocaleString('en-IN')}${isKg ? '/kg' : '/pax'}
                    </td>
                    <td style="text-align: right; padding: 8px 8px; font-weight: 700; color: #0f172a;">
                      ₹${lineTotal.toLocaleString('en-IN')}
                    </td>
                  </tr>
                `;
              })
              .join('')}

            ${displayExtras
              .map((ex) => {
                const isLabour = isAutoLabourChargeExtra(ex.description);
                return `
                  <tr style="border-bottom: 1px solid #e2e8f0; background: ${isLabour ? '#f8fafc' : '#fcfcfd'};">
                    <td style="padding: 8px 8px;">
                      <div style="font-weight: ${isLabour ? '700' : '600'}; color: #0f172a;">${escapeHtml(ex.description)}</div>
                      <div style="font-size: 0.72rem; color: #64748b;">
                        ${isLabour ? 'Assigned Event Crew & Service Staff Charges' : 'Logistics, Transport &amp; Additional Services'}
                      </div>
                    </td>
                    <td style="text-align: center; padding: 8px 8px; font-size: 0.78rem; color: #475569;">
                      ${isLabour ? 'Labour Charges' : 'Logistics / Extra'}
                    </td>
                    <td style="text-align: center; padding: 8px 8px; color: #334155;">1 Lot</td>
                    <td style="text-align: right; padding: 8px 8px; color: #334155;">₹${ex.amount.toLocaleString('en-IN')}</td>
                    <td style="text-align: right; padding: 8px 8px; font-weight: 700; color: #0f172a;">
                      ₹${ex.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>

      <!-- Totals -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
        <div style="width: 320px; font-size: 0.86rem;">
          <div style="display: flex; justify-content: space-between; padding: 4px 6px;">
            <span style="color: #475569;">Menu Items Total:</span>
            <strong>₹${menuTotal.toLocaleString('en-IN')}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 4px 6px;">
            <span style="color: #475569;">Labour, Logistics &amp; Extras:</span>
            <strong>₹${extrasTotal.toLocaleString('en-IN')}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 10px; background: #0f172a; color: #ffffff; border-radius: 4px; margin-top: 6px;">
            <span style="font-weight: 700; font-size: 0.96rem;">Total Estimate:</span>
            <span style="font-weight: 800; font-size: 1.12rem;">₹${grandTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <!-- Optional Payment Details & Bank Details Footer -->
      <div style="display: grid; grid-template-columns: 1.35fr 1fr; gap: 20px; border-top: 1px solid #e2e8f0; padding-top: 18px; align-items: flex-end;">
        <div style="font-size: 0.78rem; color: #334155; line-height: 1.55;">
          ${
            showBankDetails
              ? `
                <div style="margin-bottom: ${showPaymentDetails ? '8px' : '0'};">
                  <div style="font-weight: 700; color: #0f172a; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.3px;">
                    Bank Account Details
                  </div>
                  <div>Bank: <strong>${escapeHtml(state.settings.bank_name || 'Federal Bank')}</strong></div>
                  <div>Account Name: <strong>${escapeHtml(state.settings.account_name || state.settings.name)}</strong></div>
                  <div>Account No: <strong>${escapeHtml(state.settings.account_number || '9876-5432-1000')}</strong> &bull; IFSC: <strong>${escapeHtml(state.settings.ifsc_code || 'FDRL0001234')}</strong></div>
                  <div>UPI ID: <strong>${escapeHtml(state.settings.upi_id || 'ippas@upi')}</strong></div>
                </div>
              `
              : ''
          }
          ${
            showPaymentDetails
              ? `
                <div>
                  <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                    Payment Details &amp; Booking Terms
                  </div>
                  <div style="color: #dc2626; font-weight: 600;">
                    ${escapeHtml(termsText)}
                  </div>
                </div>
              `
              : ''
          }
        </div>

        <div style="text-align: right;">
          <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 1.05rem; font-weight: 700; color: #0f172a;">
            ${escapeHtml(state.settings.name)}
          </div>
          <div style="margin-top: 24px; padding-top: 6px; border-top: 1px dashed #94a3b8; display: inline-block; min-width: 150px; text-align: center; font-size: 0.72rem; color: #64748b;">
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2.2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 800
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const margin = 8;
    const pageWidth = 210;
    const pageHeight = 297;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    const contentWidth = printableWidth;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    if (contentHeight <= printableHeight) {
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
    } else {
      const scaledWidth = (printableHeight * canvas.width) / canvas.height;
      const xOffset = margin + (printableWidth - scaledWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, margin, scaledWidth, printableHeight);
    }

    const blob = pdf.output('blob');
    const file = new File([blob], cleanFilename, { type: 'application/pdf' });

    return { blob, file, quoteNumber };
  } catch (err) {
    console.error('Error generating quotation PDF blob:', err);
    return null;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Formats WhatsApp text message for Client Quotation (always including locked dish names and Labour Charges).
 */
export function formatWhatsAppQuotationMessage(
  event: EventRecord,
  state: AppState
): string {
  const liveEvent = state.events.find((e) => e.id === event.id) || event;
  const client = state.clients.find((c) => c.id === liveEvent.client_id);
  const quoteNumber = store.getQuotationNumber(liveEvent);
  const evtItems = state.eventItems.filter((i) => i.event_id === liveEvent.id);
  const { displayExtras, menuTotal, extrasTotal, grandTotal } =
    resolveQuotationExtrasWithMandatoryLabour(liveEvent, state);
  const businessName = state.settings.name || 'IPPAS FOOD SERVICE & EVENTS';

  const showBankDetails = liveEvent.show_bank_details !== false;
  const showPaymentDetails = liveEvent.show_payment_details !== false;
  const termsText =
    liveEvent.payment_terms ||
    state.settings.payment_terms ||
    '50% Advance deposit upon confirmation, balance on event completion.';

  const lines: string[] = [
    `🍽️ *${businessName}*`,
    `*CATERING PROPOSAL — ${quoteNumber}*`,
    ``,
    `Dear ${client?.name || 'Valued Client'},`,
    `Please find our catering quotation for *${liveEvent.title}*.`,
    ``,
    `📅 *Event Date:* ${liveEvent.event_date}`,
    `📍 *Venue:* ${liveEvent.venue || 'TBD'}`,
    `👥 *Guest Count:* ${liveEvent.guest_count} Pax`
  ];

  if (evtItems.length > 0) {
    lines.push(``, `🍛 *Selected Menu (${evtItems.length} items):*`);
    evtItems.slice(0, 12).forEach((it) => {
      const dish = state.menuItems.find((m) => m.id === it.menu_item_id);
      const dishName = it.dish_name || dish?.name || 'Dish';
      const isKg = it.pricing_type === 'per_kg';
      const qty = isKg ? (it.quantity ?? 1) : (it.quantity ?? liveEvent.guest_count);
      lines.push(`• ${dishName} (${qty} ${isKg ? 'kg' : 'pax'})`);
    });
    if (evtItems.length > 12) {
      lines.push(`• +${evtItems.length - 12} more items (see attached PDF)`);
    }
    lines.push(`   Menu Subtotal: ₹${menuTotal.toLocaleString('en-IN')}`);
  }

  if (displayExtras.length > 0) {
    lines.push(``, `🚚 *Labour Charges, Logistics & Extra Services:*`);
    displayExtras.forEach((ex) => {
      lines.push(`• ${ex.description}: ₹${ex.amount.toLocaleString('en-IN')}`);
    });
    lines.push(`   Labour & Extras Subtotal: ₹${extrasTotal.toLocaleString('en-IN')}`);
  }

  lines.push(``, `💰 *Total Quotation Estimate: ₹${grandTotal.toLocaleString('en-IN')}*`);

  if (showPaymentDetails && termsText) {
    lines.push(``, `📜 *Payment Details / Terms:*`, `${termsText}`);
  }

  if (showBankDetails) {
    lines.push(
      ``,
      `🏦 *Bank Transfer Details:*`,
      `• Bank: ${state.settings.bank_name || 'Federal Bank'}`,
      `• A/c Name: ${state.settings.account_name || businessName}`,
      `• A/c No: ${state.settings.account_number || ''}`,
      `• IFSC: ${state.settings.ifsc_code || ''}`,
      `• UPI ID: ${state.settings.upi_id || ''}`
    );
  }

  lines.push(
    ``,
    `Kindly review and confirm to book your date.`,
    `📞 ${state.settings.phone || '+91 98470 11111'}`
  );

  return lines.join('\n');
}

/**
 * Shares Quotation A4 PDF + formatted text caption directly to Client's WhatsApp on smartphones,
 * or downloads PDF + opens WhatsApp chat with text pre-attached on desktop/laptop browsers.
 */
export async function shareQuotationPdfToWhatsApp(
  event: EventRecord,
  state: AppState,
  prebuiltPdf?: { blob: Blob; file: File; quoteNumber: string },
  customMessage?: string
): Promise<{
  success: boolean;
  sharedDirectlyWithFile: boolean;
  gestureExpired?: boolean;
  quoteNumber: string;
  file?: File;
  error?: string;
}> {
  const liveEvent = state.events.find((e) => e.id === event.id) || event;
  const client = state.clients.find((c) => c.id === liveEvent.client_id);
  const quoteNumber = prebuiltPdf?.quoteNumber || store.getQuotationNumber(liveEvent);
  const messageText =
    customMessage && customMessage.trim()
      ? customMessage.trim()
      : formatWhatsAppQuotationMessage(liveEvent, state);
  const cleanPhone = normalizeWhatsAppPhone(client?.phone);

  if (prebuiltPdf) {
    const shareOutcome = await sharePdfWithCaptionToWhatsApp({
      file: prebuiltPdf.file,
      blob: prebuiltPdf.blob,
      filename: `${quoteNumber}.pdf`,
      messageText,
      cleanPhone,
      docId: `qtn-${liveEvent.id}`
    });
    if (shareOutcome.success && liveEvent.status === 'inquiry') {
      store.updateEvent(liveEvent.id, { status: 'quoted' });
    }
    return {
      ...shareOutcome,
      quoteNumber
    };
  }

  const pdfResult = await generateQuotationPdfBlob(liveEvent, state);
  if (!pdfResult) {
    return {
      success: false,
      sharedDirectlyWithFile: false,
      quoteNumber,
      error: 'Could not generate Quotation PDF file.'
    };
  }

  const shareOutcome = await sharePdfWithCaptionToWhatsApp({
    file: pdfResult.file,
    blob: pdfResult.blob,
    filename: `${quoteNumber}.pdf`,
    messageText,
    cleanPhone,
    docId: `qtn-${liveEvent.id}`
  });

  if (shareOutcome.success && liveEvent.status === 'inquiry') {
    store.updateEvent(liveEvent.id, { status: 'quoted' });
  }

  return {
    ...shareOutcome,
    quoteNumber
  };
}
