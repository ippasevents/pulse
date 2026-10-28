'use client';

import { store } from './store';
import { Invoice } from './types';

export interface EmailInvoiceResult {
  success: boolean;
  configured: boolean;
  sentTo: string;
  mailtoUrl: string;
  gmailWebUrl: string;
  error?: string;
}

export function buildInvoiceEmailPayload(invoice: Invoice, overrideTo?: string) {
  const state = store.getState();
  const recipient = (
    overrideTo ||
    state.settings.invoice_notification_email ||
    'ippasevents@gmail.com'
  ).trim();

  const evt = state.events.find((e) => e.id === invoice.event_id);
  const client = state.clients.find((c) => c.id === evt?.client_id);
  const evtItems = evt ? state.eventItems.filter((i) => i.event_id === evt.id) : [];
  const extras = evt ? state.eventExtras.filter((x) => x.event_id === evt.id) : [];
  const paidAmount = state.payments
    .filter((p) => p.invoice_id === invoice.id)
    .reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(0, invoice.amount - paidAmount);

  const items = evtItems.map((item) => {
    const mi = state.menuItems.find((m) => m.id === item.menu_item_id);
    const isPerKg = item.pricing_type === 'per_kg';
    const qty =
      item.quantity !== undefined
        ? item.quantity
        : isPerKg
        ? 1
        : evt?.guest_count || 1;
    const rate = item.price_per_unit || item.price_per_guest || 0;
    return {
      name: mi?.name || 'Menu Item',
      category: mi?.category || '',
      qtyLabel: `${qty} ${isPerKg ? 'Kg' : 'Pax'}`,
      rateLabel: `₹${rate.toLocaleString('en-IN')}/${isPerKg ? 'Kg' : 'Pax'}`,
      lineTotal: rate * qty
    };
  });

  const brandName = state.settings.name || 'IPPAS Food Service & Events';
  const kindLabel = invoice.kind === 'deposit' ? 'Advance Deposit' : 'Final Settlement';
  const subject = `[${brandName}] Invoice ${invoice.invoice_number} - ${evt?.title || 'Catering Order'} (₹${invoice.amount.toLocaleString('en-IN')})`;

  const lines = [
    `${brandName} — Official Invoice Copy`,
    `--------------------------------------------------`,
    `Invoice #: ${invoice.invoice_number} (${kindLabel})`,
    `Event: ${evt?.title || 'Catering Order'}`,
    `Event Date: ${evt?.event_date || 'TBD'} | Guests: ${evt?.guest_count || 0} Pax`,
    `Venue: ${evt?.venue || 'TBD'}`,
    `Client: ${client?.name || 'Valued Client'}${client?.phone ? ` (${client.phone})` : ''}`,
    `--------------------------------------------------`,
    `Subtotal: ₹${(invoice.subtotal ?? invoice.amount).toLocaleString('en-IN')}`,
    ...(invoice.discount > 0 ? [`Discount: -₹${invoice.discount.toLocaleString('en-IN')}`] : []),
    `Net Invoice Total: ₹${invoice.amount.toLocaleString('en-IN')}`,
    `Paid So Far: ₹${paidAmount.toLocaleString('en-IN')}`,
    `Balance Due: ₹${balanceDue.toLocaleString('en-IN')}`,
    `Due Date: ${invoice.due_date || 'Immediate'}`,
    ...(invoice.notes ? [`Notes: ${invoice.notes}`] : []),
    `--------------------------------------------------`,
    `Bank: ${state.settings.bank_name || ''} | A/C: ${state.settings.account_number || ''} | IFSC: ${state.settings.ifsc_code || ''} | UPI: ${state.settings.upi_id || ''}`
  ];

  const plainBody = lines.join('\n');
  const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
  const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;

  return {
    recipient,
    mailtoUrl,
    gmailWebUrl,
    payload: {
      to: recipient,
      invoice,
      event: evt
        ? {
            title: evt.title,
            event_date: evt.event_date,
            venue: evt.venue,
            guest_count: evt.guest_count
          }
        : undefined,
      client: client
        ? {
            name: client.name,
            company: client.company,
            phone: client.phone,
            email: client.email
          }
        : undefined,
      items,
      extras: extras.map((x) => ({ description: x.description, amount: x.amount })),
      paidAmount,
      balanceDue,
      settings: state.settings
    }
  };
}

export async function sendInvoiceEmailNotification(
  invoice: Invoice,
  overrideTo?: string
): Promise<EmailInvoiceResult> {
  const { recipient, mailtoUrl, gmailWebUrl, payload } = buildInvoiceEmailPayload(invoice, overrideTo);

  try {
    const res = await fetch('/api/send-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    return {
      success: Boolean(data.success),
      configured: data.configured !== false,
      sentTo: data.sentTo || recipient,
      mailtoUrl,
      gmailWebUrl,
      error: data.error
    };
  } catch (err: any) {
    return {
      success: false,
      configured: false,
      sentTo: recipient,
      mailtoUrl,
      gmailWebUrl,
      error: err?.message || 'Network error while sending invoice email.'
    };
  }
}
