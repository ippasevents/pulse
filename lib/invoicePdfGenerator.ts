import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Invoice } from '@/lib/types';
import { store, AppState } from '@/lib/store';

/**
 * Generates an off-screen A4 portrait representation of the invoice and compiles
 * it into a sharp, high-resolution PDF Blob and File object.
 */
export async function generateInvoicePdfBlob(
  invoice: Invoice,
  state: AppState
): Promise<{ blob: Blob; file: File; base64Data: string } | null> {
  if (typeof window === 'undefined') return null;

  const evt = state.events.find((e) => e.id === invoice.event_id);
  const client = state.clients.find((c) => c.id === evt?.client_id);
  const { grandTotal } = evt ? store.getEventTotal(evt.id) : { grandTotal: 0 };
  const evtItems = evt ? state.eventItems.filter((i) => i.event_id === evt.id) : [];
  const invPayments = state.payments.filter((p) => p.invoice_id === invoice.id);
  const paymentsForThis = invPayments.reduce((s, p) => s + p.amount, 0);
  const subtotal =
    invoice.subtotal !== undefined
      ? invoice.subtotal
      : grandTotal > 0
      ? grandTotal
      : invoice.amount;
  const discount = invoice.discount || 0;
  const netAmount = invoice.amount;
  const balanceDue = Math.max(0, netAmount - paymentsForThis);

  // Create temporary container offscreen
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-9999px';
  container.style.width = '794px'; // 210mm at 96 DPI
  container.style.zIndex = '-1000';
  container.style.background = '#ffffff';

  const cleanFilename = `${invoice.invoice_number}.pdf`;

  // Build the complete A4 invoice HTML matching the project's official print template
  container.innerHTML = `
    <div style="width: 794px; min-height: 1123px; padding: 36px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; background: #ffffff; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <img src="/logo.png" alt="Logo" style="height: 60px; width: auto; object-fit: contain; display: block;" />
          <div>
            <div style="font-weight: 800; font-size: 1.15rem; letter-spacing: 0.5px; color: #0f172a;">
              ${state.settings.name || 'IPPAS FOOD SERVICE & EVENTS'}
            </div>
            <div style="font-size: 0.8rem; color: #64748b;">
              Outdoor Catering &bull; Event Management &bull; Kerala
            </div>
            <div style="font-size: 0.75rem; color: #64748b;">
              Phone: ${state.settings.phone || '+91 98470 11111'} &bull; Email: ${state.settings.email || 'ippasevents@gmail.com'}
            </div>
          </div>
        </div>
        <div style="text-align: right;">
          <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 2.2rem; font-weight: 700; color: #0f172a; line-height: 1; margin: 0;">
            INVOICE
          </h1>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px; font-weight: 600;">
            #${invoice.invoice_number}
          </div>
          <div style="font-size: 0.75rem; color: #475569;">
            Kind: ${invoice.kind === 'deposit' ? 'Advance Deposit' : 'Final Settlement'}
          </div>
        </div>
      </div>

      <!-- Metadata -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-bottom: 20px; background: #f8fafc; padding: 14px 18px; border-radius: 6px; border: 1px solid #e2e8f0;">
        <div>
          <div style="font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px;">
            Billed To:
          </div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #0f172a;">
            ${client?.name || 'Valued Client'}
          </div>
          ${client?.company ? `<div style="font-size: 0.85rem; color: #334155;">🏢 ${client.company}</div>` : ''}
          ${client?.phone ? `<div style="font-size: 0.85rem; color: #334155;">📞 ${client.phone}</div>` : ''}
          ${client?.email ? `<div style="font-size: 0.85rem; color: #334155;">✉️ ${client.email}</div>` : ''}
          <div style="font-size: 0.85rem; color: #64748b; margin-top: 3px;">
            📍 Venue: ${evt?.venue || 'Kerala'}
          </div>
        </div>

        <div style="text-align: right; font-size: 0.85rem; line-height: 1.5;">
          <div><strong>Event:</strong> ${evt?.title || 'Catering Order'}</div>
          ${
            evt?.event_date
              ? `<div><strong>Event Date:</strong> ${new Date(evt.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>`
              : ''
          }
          ${evt?.guest_count ? `<div><strong>Guests:</strong> ${evt.guest_count} Pax</div>` : ''}
          <div><strong>Issue Date:</strong> ${new Date(invoice.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          <div><strong>Due Date:</strong> ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'On Receipt'}</div>
          <div style="margin-top: 5px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; background: ${balanceDue === 0 ? '#dcfce7' : '#fee2e2'}; color: ${balanceDue === 0 ? '#15803d' : '#b91c1c'};">
              Status: ${balanceDue === 0 ? 'Fully Paid' : invoice.status}
            </span>
          </div>
        </div>
      </div>

      <!-- Items Table -->
      <div style="margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 2px solid #0f172a; background: #f1f5f9;">
              <th style="text-align: left; padding: 8px 6px; font-weight: 700;">Description</th>
              <th style="text-align: center; padding: 8px 6px; font-weight: 700;">Unit / Type</th>
              <th style="text-align: right; padding: 8px 6px; font-weight: 700;">Rate</th>
              <th style="text-align: right; padding: 8px 6px; font-weight: 700;">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${
              evtItems.length > 0
                ? evtItems
                    .map((item) => {
                      const mi = state.menuItems.find((m) => m.id === item.menu_item_id);
                      const isPerKg = item.pricing_type === 'per_kg';
                      const qty =
                        item.quantity !== undefined
                          ? item.quantity
                          : isPerKg
                          ? 1
                          : evt?.guest_count || 1;
                      const rate = item.price_per_unit || item.price_per_guest || 0;
                      const lineTotal = rate * qty;
                      return `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                          <td style="padding: 7px 6px;">
                            <div style="font-weight: 600; color: #0f172a;">${mi?.name || 'Menu Item'}</div>
                            ${mi?.category ? `<div style="font-size: 0.7rem; color: #64748b;">${mi.category}</div>` : ''}
                          </td>
                          <td style="text-align: center; padding: 7px 6px; color: #334155;">
                            ${qty} ${isPerKg ? 'Kg' : 'Pax'}
                          </td>
                          <td style="text-align: right; padding: 7px 6px; color: #334155;">
                            ₹${rate.toLocaleString('en-IN')} ${isPerKg ? '/Kg' : '/Pax'}
                          </td>
                          <td style="text-align: right; padding: 7px 6px; font-weight: 600; color: #0f172a;">
                            ₹${lineTotal.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      `;
                    })
                    .join('')
                : `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 6px;">
                      <div style="font-weight: 600;">${evt?.title || 'Catering Package'}</div>
                      <div style="font-size: 0.72rem; color: #64748b;">
                        ${invoice.kind === 'deposit' ? 'Advance Deposit Payment' : 'Final Event Settlement'}
                      </div>
                    </td>
                    <td style="text-align: center; padding: 8px 6px;">1 Lot</td>
                    <td style="text-align: right; padding: 8px 6px;">₹${subtotal.toLocaleString('en-IN')}</td>
                    <td style="text-align: right; padding: 8px 6px; font-weight: 600;">₹${subtotal.toLocaleString('en-IN')}</td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>

      <!-- Totals -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
        <div style="width: 320px;">
          <div style="display: flex; justify-content: space-between; padding: 4px 6px; font-size: 0.85rem;">
            <span style="color: #475569;">Subtotal:</span>
            <span style="font-weight: 600;">₹${subtotal.toLocaleString('en-IN')}</span>
          </div>
          ${
            discount > 0
              ? `
              <div style="display: flex; justify-content: space-between; padding: 4px 6px; font-size: 0.85rem; color: #16a34a;">
                <span>Discount:</span>
                <span style="font-weight: 700;">- ₹${discount.toLocaleString('en-IN')}</span>
              </div>
            `
              : ''
          }
          <div style="display: flex; justify-content: space-between; padding: 8px 10px; background: #0f172a; color: #ffffff; border-radius: 4px; margin-top: 6px;">
            <span style="font-weight: 700; font-size: 0.95rem;">Net Invoice Total:</span>
            <span style="font-weight: 800; font-size: 1.1rem;">₹${netAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <!-- Payment History Table from the Beginning -->
      <div style="margin-bottom: 22px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px; background: #f8fafc;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
          <span style="font-weight: 700; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">
            💳 Payment History & Advance Details (ആദ്യം മുതലുള്ള പേയ്മെന്റുകൾ)
          </span>
          <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">
            ${invPayments.length} installment${invPayments.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        ${
          invPayments.length > 0
            ? `
          <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-bottom: 8px;">
            <thead>
              <tr style="border-bottom: 1px solid #cbd5e1; color: #475569; text-align: left;">
                <th style="padding: 4px 6px;">Date</th>
                <th style="padding: 4px 6px;">Payment Method</th>
                <th style="padding: 4px 6px;">Destination Account</th>
                <th style="padding: 4px 6px;">Note</th>
                <th style="padding: 4px 6px; text-align: right;">Amount Paid</th>
              </tr>
            </thead>
            <tbody>
              ${invPayments
                .map((p) => {
                  const ch = store.inferPaymentChannel(p.method, p.payment_channel);
                  const acc = store.resolveDestinationAccount(p);
                  return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 5px 6px; font-weight: 600;">${new Date(p.paid_at).toLocaleDateString('en-GB')}</td>
                      <td style="padding: 5px 6px; text-transform: capitalize;">${p.method} (${ch === 'cash' ? 'Cash' : 'Bank'})</td>
                      <td style="padding: 5px 6px; color: #0f172a;">${acc}</td>
                      <td style="padding: 5px 6px; color: #64748b;">${p.note || '—'}</td>
                      <td style="padding: 5px 6px; text-align: right; font-weight: 700; color: #16a34a;">₹${Number(p.amount).toLocaleString('en-IN')}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
          `
            : `
          <div style="font-size: 0.8rem; color: #64748b; padding: 4px 0 8px 0;">
            No advance or installment payments recorded yet.
          </div>
          `
        }

        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
          <div style="font-size: 0.85rem;">
            <span style="color: #475569;">Total Paid so far: </span>
            <strong style="color: #16a34a;">₹${paymentsForThis.toLocaleString('en-IN')}</strong>
          </div>
          <div style="font-size: 0.95rem;">
            <span style="color: #475569;">Balance Due: </span>
            <strong style="color: ${balanceDue > 0 ? '#dc2626' : '#16a34a'}; font-size: 1.1rem;">
              ₹${balanceDue.toLocaleString('en-IN')}
            </strong>
          </div>
        </div>
      </div>

      <!-- Bank & Signatory Footer -->
      <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px; border-top: 1px solid #e2e8f0; padding-top: 18px; align-items: flex-end;">
        <div style="font-size: 0.78rem; color: #334155; line-height: 1.5;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px;">
            Bank & Payment Details
          </div>
          <div>Bank: <strong>${state.settings.bank_name || 'Federal Bank / State Bank of India'}</strong></div>
          <div>Account Name: <strong>${state.settings.account_name || state.settings.name}</strong></div>
          <div>Account No: <strong>${state.settings.account_number || '9876-5432-1000'}</strong> &bull; IFSC: <strong>${state.settings.ifsc_code || 'FDRL0001234'}</strong></div>
          <div>UPI ID: <strong>${state.settings.upi_id || 'ippas@upi'}</strong></div>
          ${
            (evt?.payment_terms || state.settings.payment_terms)
              ? `<div style="margin-top: 4px; color: #64748b; font-size: 0.72rem;"><strong>Payment Terms:</strong> ${evt?.payment_terms || state.settings.payment_terms}</div>`
              : ''
          }
        </div>

        <div style="text-align: right;">
          <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 1.05rem; font-weight: 700; color: #0f172a;">
            ${state.settings.name}
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
    const base64Data = pdf.output('datauristring');

    return { blob, file, base64Data };
  } catch (err) {
    console.error('Error generating invoice PDF blob:', err);
    return null;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Creates formatted WhatsApp message text in Malayalam & English.
 */
export function formatWhatsAppInvoiceMessage(
  invoice: Invoice,
  state: AppState
): string {
  const evt = state.events.find((e) => e.id === invoice.event_id);
  const client = state.clients.find((c) => c.id === evt?.client_id);
  const invPayments = state.payments.filter((p) => p.invoice_id === invoice.id);
  const paymentsForThis = invPayments.reduce((s, p) => s + p.amount, 0);
  const balanceDue = Math.max(0, invoice.amount - paymentsForThis);
  const businessName = state.settings.name || 'IPPAS FOOD SERVICE & EVENTS';

  return `🧾 *${businessName}*
*INVOICE: ${invoice.invoice_number}*

പ്രിയപ്പെട്ട ${client?.name || 'Client'},
നിങ്ങളുടെ ഇവന്റിനായുള്ള (${evt?.title || 'Catering Event'}) ഔദ്യോഗിക ഇൻവോയ്സ് PDF ഇതിനോടൊപ്പം നൽകുന്നു.

💰 *ആകെ തുക (Total):* ₹${invoice.amount.toLocaleString('en-IN')}
✅ *നൽകിയത് (Paid):* ₹${paymentsForThis.toLocaleString('en-IN')}
⏳ *ബാക്കി തുക (Balance Due):* ₹${balanceDue.toLocaleString('en-IN')}
📅 *Due Date:* ${invoice.due_date || 'On Receipt'}

🏦 *ബാങ്ക് വിവരങ്ങൾ (Payment Details):*
• Bank: ${state.settings.bank_name || 'Federal Bank'}
• A/c Name: ${state.settings.account_name || businessName}
• A/c No: ${state.settings.account_number || ''}
• IFSC: ${state.settings.ifsc_code || ''}
• UPI ID: ${state.settings.upi_id || ''}

നന്ദി! 
${businessName}
📞 ${state.settings.phone || '+91 98470 11111'}`;
}

/**
 * Triggers native WhatsApp PDF document sharing on mobile/tablets via Web Share API Level 2.
 * Falls back to direct PDF download + WhatsApp chat link on desktop browsers.
 */
export async function shareInvoicePdfToWhatsApp(
  invoice: Invoice,
  state: AppState
): Promise<{
  success: boolean;
  sharedDirectlyWithFile: boolean;
  file?: File;
  error?: string;
}> {
  const evt = state.events.find((e) => e.id === invoice.event_id);
  const client = state.clients.find((c) => c.id === evt?.client_id);
  const messageText = formatWhatsAppInvoiceMessage(invoice, state);
  const cleanPhone = (client?.phone || '').replace(/[^0-9]/g, '');

  // 1. Generate the PDF File
  const pdfResult = await generateInvoicePdfBlob(invoice, state);
  if (!pdfResult) {
    return {
      success: false,
      sharedDirectlyWithFile: false,
      error: 'Could not generate invoice PDF file.'
    };
  }

  const { file, blob } = pdfResult;

  // 2. Mobile / PWA Native Web Share API with File Attachment
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: `Invoice ${invoice.invoice_number}`,
        text: messageText
      });
      return { success: true, sharedDirectlyWithFile: true, file };
    } catch (shareErr: any) {
      if (shareErr.name === 'AbortError') {
        // User cancelled the share dialog
        return { success: true, sharedDirectlyWithFile: true, file };
      }
      console.warn('Native share failed, falling back to download + WhatsApp link:', shareErr);
    }
  }

  // 3. Desktop / Unsupported Browser Fallback:
  // Automatically trigger PDF download so the user has the file immediately ready to attach
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoice.invoice_number}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Open WhatsApp Web with the client's number and prefilled message
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  return { success: true, sharedDirectlyWithFile: false, file };
}
