import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Invoice } from '@/lib/types';
import { store, AppState } from '@/lib/store';
import { sharePdfWithCaptionToWhatsApp } from '@/lib/whatsappDeviceShare';

function escapeHtml(val?: string | number | null): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function normalizeWhatsAppPhone(raw?: string): string {
  const digits = (raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Generates an off-screen A4 portrait representation of the invoice and compiles
 * it into a sharp, high-resolution PDF Blob and File object.
 * Includes Menu Items + Logistics/Transport/Extras, Discount details, Part-Payment history,
 * Bank/Payment visibility toggles, and strictly hides Payment Terms once Fully Paid.
 */
export async function generateInvoicePdfBlob(
  invoice: Invoice,
  state: AppState
): Promise<{ blob: Blob; file: File; base64Data: string } | null> {
  if (typeof window === 'undefined') return null;

  const liveInv = state.invoices.find((i) => i.id === invoice.id) || invoice;
  const evt = state.events.find((e) => e.id === liveInv.event_id);
  const client = state.clients.find((c) => c.id === evt?.client_id);
  const { grandTotal } = evt ? store.getEventTotal(evt.id) : { grandTotal: 0 };
  const evtItems = evt ? state.eventItems.filter((i) => i.event_id === evt.id) : [];
  const evtExtras = evt ? state.eventExtras.filter((x) => x.event_id === evt.id) : [];
  const invPayments = state.payments.filter((p) => p.invoice_id === liveInv.id);
  const paymentsForThis = invPayments.reduce((s, p) => s + p.amount, 0);
  const subtotal =
    liveInv.subtotal !== undefined
      ? liveInv.subtotal
      : grandTotal > 0
      ? grandTotal
      : liveInv.amount;
  const discount = liveInv.discount || 0;
  const netAmount = liveInv.amount;
  const balanceDue = Math.max(0, netAmount - paymentsForThis);
  const isFullyPaid = liveInv.status === 'paid' || (netAmount > 0 && balanceDue <= 0);
  const isFinalSettlement = isFullyPaid || liveInv.kind === 'final';
  const quoteRef = liveInv.quotation_number || (evt ? store.getQuotationNumber(evt) : '');

  const showBankDetails = liveInv.show_bank_details !== false;
  const showPaymentDetails = liveInv.show_payment_details !== false;
  // STRICT RULE: Never show payment terms once the invoice is fully paid
  const paymentTermsText = !isFullyPaid && showPaymentDetails
    ? evt?.payment_terms || state.settings.payment_terms || ''
    : '';

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-9999px';
  container.style.width = '794px';
  container.style.zIndex = '-1000';
  container.style.background = '#ffffff';

  const cleanFilename = `${liveInv.invoice_number}.pdf`;

  container.innerHTML = `
    <div style="width: 794px; min-height: 1123px; padding: 36px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; background: #ffffff; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <img src="/logo.png" alt="Logo" style="height: 60px; width: auto; object-fit: contain; display: block;" />
          <div>
            <div style="font-weight: 800; font-size: 1.15rem; letter-spacing: 0.5px; color: #0f172a;">
              ${escapeHtml(state.settings.name || 'IPPAS FOOD SERVICE & EVENTS')}
            </div>
            <div style="font-size: 0.8rem; color: #64748b;">
              Outdoor Catering &bull; Event Management &bull; Calicut
            </div>
            <div style="font-size: 0.75rem; color: #64748b;">
              Phone: ${escapeHtml(state.settings.phone || '+91 98470 11111')} &bull; Email: ${escapeHtml(state.settings.email || 'events@ippas.com')}
            </div>
          </div>
        </div>
        <div style="text-align: right;">
          <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 2.1rem; font-weight: 700; color: #0f172a; line-height: 1; margin: 0;">
            ${isFinalSettlement ? 'FINAL SETTLEMENT' : 'INVOICE'}
          </h1>
          <div style="font-size: 0.82rem; color: #0f172a; margin-top: 4px; font-weight: 700;">
            Invoice #${escapeHtml(liveInv.invoice_number)}
          </div>
          ${quoteRef ? `<div style="font-size: 0.74rem; color: #64748b;">Quote Ref: #${escapeHtml(quoteRef)}</div>` : ''}
          <div style="font-size: 0.75rem; color: ${isFinalSettlement ? '#15803d' : '#475569'}; font-weight: 600;">
            ${isFinalSettlement ? 'Final Settlement Invoice' : 'Advance / Booking Invoice'}
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
            ${escapeHtml(client?.name || 'Valued Client')}
          </div>
          ${client?.company ? `<div style="font-size: 0.85rem; color: #334155;">🏢 ${escapeHtml(client.company)}</div>` : ''}
          ${client?.phone ? `<div style="font-size: 0.85rem; color: #334155;">📞 ${escapeHtml(client.phone)}</div>` : ''}
          ${client?.email ? `<div style="font-size: 0.85rem; color: #334155;">✉️ ${escapeHtml(client.email)}</div>` : ''}
          <div style="font-size: 0.85rem; color: #64748b; margin-top: 3px;">
            📍 Venue: ${escapeHtml(evt?.venue || 'Calicut')}
          </div>
        </div>

        <div style="text-align: right; font-size: 0.85rem; line-height: 1.5;">
          <div><strong>Event:</strong> ${escapeHtml(evt?.title || 'Catering Order')}</div>
          ${
            evt?.event_date
              ? `<div><strong>Event Date:</strong> ${new Date(evt.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>`
              : ''
          }
          ${evt?.guest_count ? `<div><strong>Guests:</strong> ${evt.guest_count} Pax</div>` : ''}
          <div><strong>Issue Date:</strong> ${new Date(liveInv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          ${
            !isFullyPaid
              ? `<div><strong>Due Date:</strong> ${liveInv.due_date ? new Date(liveInv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'On Receipt'}</div>`
              : ''
          }
          <div style="margin-top: 5px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; background: ${isFullyPaid ? '#dcfce7' : '#fee2e2'}; color: ${isFullyPaid ? '#15803d' : '#b91c1c'};">
              Status: ${isFullyPaid ? 'Fully Paid (Final Settlement)' : liveInv.status}
            </span>
          </div>
        </div>
      </div>

      <!-- Items Table (Menu Items + Logistics, Transport & Extra Charges) -->
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
              Array.isArray(liveInv.locked_items_snapshot) && liveInv.locked_items_snapshot.length > 0
                ? liveInv.locked_items_snapshot
                    .map(
                      (snap) => `
                        <tr style="border-bottom: 1px solid #e2e8f0; background: ${snap.is_extra ? '#fcfcfd' : '#ffffff'};">
                          <td style="padding: 7px 6px;">
                            <div style="font-weight: 600; color: #0f172a;">${escapeHtml(snap.description)}</div>
                            ${snap.category ? `<div style="font-size: 0.7rem; color: #64748b;">${escapeHtml(snap.category)}</div>` : ''}
                          </td>
                          <td style="text-align: center; padding: 7px 6px; color: #334155;">
                            ${escapeHtml(snap.qty_label)}
                          </td>
                          <td style="text-align: right; padding: 7px 6px; color: #334155;">
                            ${escapeHtml(snap.rate_label)}
                          </td>
                          <td style="text-align: right; padding: 7px 6px; font-weight: 600; color: #0f172a;">
                            ₹${Number(snap.line_total || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      `
                    )
                    .join('')
                : evtItems.length > 0 || evtExtras.length > 0
                ? [
                    ...evtItems.map((item) => {
                      const mi = state.menuItems.find((m) => m.id === item.menu_item_id);
                      const dishName = item.dish_name || mi?.name || 'Menu Item';
                      const dishCategory = item.dish_category || mi?.category || '';
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
                            <div style="font-weight: 600; color: #0f172a;">${escapeHtml(dishName)}</div>
                            ${dishCategory ? `<div style="font-size: 0.7rem; color: #64748b;">${escapeHtml(dishCategory)}</div>` : ''}
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
                    }),
                    ...evtExtras.map(
                      (ex) => `
                        <tr style="border-bottom: 1px solid #e2e8f0; background: #fcfcfd;">
                          <td style="padding: 7px 6px;">
                            <div style="font-weight: 600; color: #0f172a;">${escapeHtml(ex.description)}</div>
                            <div style="font-size: 0.7rem; color: #64748b;">Service, Labour &amp; Additional Charges</div>
                          </td>
                          <td style="text-align: center; padding: 7px 6px; color: #334155;">1 Lot</td>
                          <td style="text-align: right; padding: 7px 6px; color: #334155;">₹${ex.amount.toLocaleString('en-IN')}</td>
                          <td style="text-align: right; padding: 7px 6px; font-weight: 600; color: #0f172a;">₹${ex.amount.toLocaleString('en-IN')}</td>
                        </tr>
                      `
                    )
                  ].join('')
                : `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 6px;">
                      <div style="font-weight: 600;">${escapeHtml(evt?.title || 'Catering Package')}</div>
                      <div style="font-size: 0.72rem; color: #64748b;">
                        ${isFinalSettlement ? 'Final Event Settlement' : 'Advance Booking Invoice'}
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

      <!-- Totals & Discount Details -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
        <div style="width: 340px;">
          <div style="display: flex; justify-content: space-between; padding: 4px 6px; font-size: 0.85rem;">
            <span style="color: #475569;">Subtotal:</span>
            <span style="font-weight: 600;">₹${subtotal.toLocaleString('en-IN')}</span>
          </div>
          ${
            discount > 0
              ? `
              <div style="display: flex; justify-content: space-between; padding: 4px 6px; font-size: 0.85rem; color: #16a34a;">
                <span>Discount${liveInv.discount_note ? ` (${escapeHtml(liveInv.discount_note)})` : ''}:</span>
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

      <!-- Part-Payment & Settlement History (Controlled by show_payment_details) -->
      ${
        showPaymentDetails
          ? `
      <div style="margin-bottom: 22px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px; background: #f8fafc;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
          <span style="font-weight: 700; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">
            💳 Part-Payment &amp; Settlement Details
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
                      <td style="padding: 5px 6px; text-transform: capitalize;">${escapeHtml(p.method)} (${ch === 'cash' ? 'Cash' : 'Bank'})</td>
                      <td style="padding: 5px 6px; color: #0f172a;">${escapeHtml(acc)}</td>
                      <td style="padding: 5px 6px; color: #64748b;">${escapeHtml(p.note || '—')}</td>
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
            No advance or part-payment installments recorded yet.
          </div>
          `
        }

        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
          <div style="font-size: 0.85rem;">
            <span style="color: #475569;">Total Paid: </span>
            <strong style="color: #16a34a;">₹${paymentsForThis.toLocaleString('en-IN')}</strong>
          </div>
          <div style="font-size: 0.95rem;">
            <span style="color: #475569;">Balance Due: </span>
            <strong style="color: ${balanceDue > 0 ? '#dc2626' : '#16a34a'}; font-size: 1.1rem;">
              ${balanceDue === 0 && netAmount > 0 ? '₹0 (Settled in Full)' : `₹${balanceDue.toLocaleString('en-IN')}`}
            </strong>
          </div>
        </div>
      </div>
      `
          : ''
      }

      <!-- Bank Details, Payment Terms (hidden when Fully Paid!) & Signatory Footer -->
      <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px; border-top: 1px solid #e2e8f0; padding-top: 18px; align-items: flex-end;">
        <div style="font-size: 0.78rem; color: #334155; line-height: 1.5;">
          ${
            showBankDetails
              ? `
            <div style="margin-bottom: ${paymentTermsText ? '6px' : '0'};">
              <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px;">
                Bank Account Details
              </div>
              <div>Bank: <strong>${escapeHtml(state.settings.bank_name || 'Federal Bank / State Bank of India')}</strong></div>
              <div>Account Name: <strong>${escapeHtml(state.settings.account_name || state.settings.name)}</strong></div>
              <div>Account No: <strong>${escapeHtml(state.settings.account_number || '9876-5432-1000')}</strong> &bull; IFSC: <strong>${escapeHtml(state.settings.ifsc_code || 'FDRL0001234')}</strong></div>
              <div>UPI ID: <strong>${escapeHtml(state.settings.upi_id || 'ippas@upi')}</strong></div>
            </div>
          `
              : ''
          }
          ${
            paymentTermsText
              ? `<div style="margin-top: 4px; color: #dc2626; font-size: 0.74rem; font-weight: 600;"><strong>Payment Terms:</strong> ${escapeHtml(paymentTermsText)}</div>`
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
 * Creates formatted WhatsApp message text for Invoice / Final Settlement Invoice.
 * Respects show_bank_details & show_payment_details and NEVER includes payment terms when Fully Paid.
 */
export function formatWhatsAppInvoiceMessage(
  invoice: Invoice,
  state: AppState
): string {
  const liveInv = state.invoices.find((i) => i.id === invoice.id) || invoice;
  const evt = state.events.find((e) => e.id === liveInv.event_id);
  const client = state.clients.find((c) => c.id === evt?.client_id);
  const invPayments = state.payments.filter((p) => p.invoice_id === liveInv.id);
  const paymentsForThis = invPayments.reduce((s, p) => s + p.amount, 0);
  const balanceDue = Math.max(0, liveInv.amount - paymentsForThis);
  const isFullyPaid = liveInv.status === 'paid' || (liveInv.amount > 0 && balanceDue <= 0);
  const isFinalSettlement = isFullyPaid || liveInv.kind === 'final';
  const businessName = state.settings.name || 'IPPAS FOOD SERVICE & EVENTS';

  const showBankDetails = liveInv.show_bank_details !== false;
  const showPaymentDetails = liveInv.show_payment_details !== false;
  const paymentTermsText = !isFullyPaid && showPaymentDetails
    ? evt?.payment_terms || state.settings.payment_terms || ''
    : '';

  const lines: string[] = [
    `🧾 *${businessName}*`,
    `*${isFinalSettlement ? 'FINAL SETTLEMENT INVOICE' : 'INVOICE'}: ${liveInv.invoice_number}*`,
    ``,
    `Dear ${client?.name || 'Valued Client'},`,
    `Please find attached the ${isFinalSettlement ? 'final settlement invoice' : 'official invoice'} for *${evt?.title || 'Catering Event'}*.`
  ];

  if ((liveInv.discount || 0) > 0) {
    lines.push(
      ``,
      `📋 *Subtotal:* ₹${(liveInv.subtotal || liveInv.amount + liveInv.discount).toLocaleString('en-IN')}`,
      `🎁 *Discount${liveInv.discount_note ? ` (${liveInv.discount_note})` : ''}:* -₹${liveInv.discount.toLocaleString('en-IN')}`
    );
  }

  lines.push(`💰 *Net Invoice Total:* ₹${liveInv.amount.toLocaleString('en-IN')}`);

  if (showPaymentDetails) {
    lines.push(
      `✅ *Paid Amount:* ₹${paymentsForThis.toLocaleString('en-IN')}`,
      isFullyPaid
        ? `🎉 *Status:* Fully Paid — Final Settlement Complete`
        : `⏳ *Balance Due:* ₹${balanceDue.toLocaleString('en-IN')}`
    );
    if (!isFullyPaid && liveInv.due_date) {
      lines.push(`📅 *Due Date:* ${liveInv.due_date}`);
    }
  }

  if (paymentTermsText) {
    lines.push(``, `📜 *Payment Terms:* ${paymentTermsText}`);
  }

  if (showBankDetails) {
    lines.push(
      ``,
      `🏦 *Bank Details:*`,
      `• Bank: ${state.settings.bank_name || 'Federal Bank'}`,
      `• A/c Name: ${state.settings.account_name || businessName}`,
      `• A/c No: ${state.settings.account_number || ''}`,
      `• IFSC: ${state.settings.ifsc_code || ''}`,
      `• UPI ID: ${state.settings.upi_id || ''}`
    );
  }

  lines.push(
    ``,
    `Thank you for choosing ${businessName}!`,
    `📞 ${state.settings.phone || '+91 98470 11111'}`
  );

  return lines.join('\n');
}

/**
 * Triggers native WhatsApp PDF + Text sharing on smartphones via Web Share API Level 2.
 * Falls back to PDF download + WhatsApp chat link with pre-attached text on desktop/laptop browsers.
 */
export async function shareInvoicePdfToWhatsApp(
  invoice: Invoice,
  state: AppState,
  prebuiltPdf?: { blob: Blob; file: File },
  customMessage?: string
): Promise<{
  success: boolean;
  sharedDirectlyWithFile: boolean;
  gestureExpired?: boolean;
  file?: File;
  error?: string;
}> {
  const liveInv = state.invoices.find((i) => i.id === invoice.id) || invoice;
  const evt = state.events.find((e) => e.id === liveInv.event_id);
  const client = state.clients.find((c) => c.id === evt?.client_id);
  const messageText =
    customMessage && customMessage.trim()
      ? customMessage.trim()
      : formatWhatsAppInvoiceMessage(liveInv, state);
  const cleanPhone = normalizeWhatsAppPhone(client?.phone);

  // When prebuiltPdf is ready, invoke sharePdfWithCaptionToWhatsApp immediately with zero preceding await!
  if (prebuiltPdf) {
    return sharePdfWithCaptionToWhatsApp({
      file: prebuiltPdf.file,
      blob: prebuiltPdf.blob,
      filename: `${liveInv.invoice_number}.pdf`,
      messageText,
      cleanPhone,
      docId: `inv-${liveInv.id}`
    });
  }

  const pdfResult = await generateInvoicePdfBlob(liveInv, state);
  if (!pdfResult) {
    return {
      success: false,
      sharedDirectlyWithFile: false,
      error: 'Could not generate invoice PDF file.'
    };
  }

  return sharePdfWithCaptionToWhatsApp({
    file: pdfResult.file,
    blob: pdfResult.blob,
    filename: `${liveInv.invoice_number}.pdf`,
    messageText,
    cleanPhone,
    docId: `inv-${liveInv.id}`
  });
}
