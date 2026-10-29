import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

export interface SendInvoicePayload {
  to?: string;
  invoice: {
    invoice_number: string;
    kind: 'deposit' | 'final';
    subtotal: number;
    discount: number;
    amount: number;
    due_date?: string;
    status: string;
    created_at: string;
    notes?: string;
  };
  event?: {
    title?: string;
    event_date?: string;
    venue?: string;
    guest_count?: number;
  };
  client?: {
    name?: string;
    company?: string;
    phone?: string;
    email?: string;
  };
  items?: Array<{
    name: string;
    category?: string;
    qtyLabel: string;
    rateLabel: string;
    lineTotal: number;
  }>;
  extras?: Array<{
    description: string;
    amount: number;
  }>;
  paidAmount?: number;
  balanceDue?: number;
  settings?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    bank_name?: string;
    account_name?: string;
    account_number?: string;
    ifsc_code?: string;
    upi_id?: string;
    payment_terms?: string;
  };
}

function formatINR(num: number): string {
  return `₹${Number(num || 0).toLocaleString('en-IN')}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendInvoicePayload;
    const recipient = (
      body.to ||
      process.env.INVOICE_NOTIFICATION_EMAIL ||
      'ippasevents@gmail.com'
    ).trim();

    if (!body?.invoice?.invoice_number) {
      return NextResponse.json(
        { success: false, error: 'Missing invoice details.' },
        { status: 400 }
      );
    }

    const smtpUser = (process.env.SMTP_USER || 'ippassales@gmail.com').trim();
    const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
    const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const smtpPort = Number(process.env.SMTP_PORT || 465);

    if (!smtpUser || !smtpPass) {
      return NextResponse.json({
        success: false,
        configured: false,
        sentTo: recipient,
        error:
          'SMTP_USER (ippassales@gmail.com) and SMTP_PASS environment variables are not configured on the server yet. Add them in your deployment Environment Variables to send automatically in the background.'
      });
    }

    const inv = body.invoice;
    const evt = body.event || {};
    const client = body.client || {};
    const settings = body.settings || {};
    const items = body.items || [];
    const extras = body.extras || [];
    const paidAmount = Number(body.paidAmount || 0);
    const balanceDue =
      body.balanceDue !== undefined
        ? Number(body.balanceDue)
        : Math.max(0, Number(inv.amount || 0) - paidAmount);

    const brandName = settings.name || 'IPPAS Food Service & Events';
    const kindLabel = inv.kind === 'deposit' ? 'Advance Deposit' : 'Final Settlement';
    const subject = `[${brandName}] Invoice ${inv.invoice_number} — ${evt.title || 'Catering Event'} (${formatINR(inv.amount)})`;

    const itemRowsHtml =
      items.length > 0
        ? items
            .map(
              (item) => `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">
              <strong>${item.name}</strong>
              ${item.category ? `<div style="font-size:12px;color:#64748b;">${item.category}</div>` : ''}
            </td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${item.qtyLabel}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${item.rateLabel}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatINR(item.lineTotal)}</td>
          </tr>`
            )
            .join('')
        : `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">
              <strong>${evt.title || 'Catering Package'}</strong>
              <div style="font-size:12px;color:#64748b;">${kindLabel}</div>
            </td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">1 Lot</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatINR(inv.subtotal)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatINR(inv.subtotal)}</td>
          </tr>`;

    const extraRowsHtml = extras
      .map(
        (ex) => `
        <tr>
          <td colspan="3" style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#334155;">Extra: ${ex.description}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatINR(ex.amount)}</td>
        </tr>`
      )
      .join('');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;color:#0f172a;">
        <div style="background:#0f172a;color:#ffffff;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:18px;font-weight:800;letter-spacing:0.4px;">${brandName}</div>
            <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">Automatic Invoice Copy &bull; #${inv.invoice_number} (${kindLabel})</div>
          </div>
        </div>

        <div style="padding:24px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
            <tr>
              <td style="padding:12px 14px;vertical-align:top;">
                <div style="font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;">Billed To</div>
                <div style="font-size:15px;font-weight:700;margin-top:4px;">${client.name || 'Valued Client'}</div>
                ${client.company ? `<div style="font-size:13px;color:#334155;">${client.company}</div>` : ''}
                ${client.phone ? `<div style="font-size:13px;color:#334155;">Phone: ${client.phone}</div>` : ''}
                ${client.email ? `<div style="font-size:13px;color:#334155;">Email: ${client.email}</div>` : ''}
              </td>
              <td style="padding:12px 14px;vertical-align:top;text-align:right;font-size:13px;line-height:1.6;">
                <div><strong>Invoice #:</strong> ${inv.invoice_number}</div>
                <div><strong>Event:</strong> ${evt.title || 'Catering Order'}</div>
                ${evt.event_date ? `<div><strong>Event Date:</strong> ${evt.event_date}</div>` : ''}
                ${evt.venue ? `<div><strong>Venue:</strong> ${evt.venue}</div>` : ''}
                ${evt.guest_count ? `<div><strong>Guests:</strong> ${evt.guest_count} Pax</div>` : ''}
                <div><strong>Due Date:</strong> ${inv.due_date || 'Immediate'}</div>
              </td>
            </tr>
          </table>

          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:2px solid #0f172a;">
                <th style="padding:8px 10px;text-align:left;">Description</th>
                <th style="padding:8px 10px;text-align:center;">Qty</th>
                <th style="padding:8px 10px;text-align:right;">Rate</th>
                <th style="padding:8px 10px;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml}
              ${extraRowsHtml}
            </tbody>
          </table>

          <div style="margin-left:auto;max-width:290px;font-size:14px;">
            <div style="display:flex;justify-content:space-between;padding:4px 0;">
              <span style="color:#475569;">Subtotal:</span>
              <strong>${formatINR(inv.subtotal)}</strong>
            </div>
            ${
              Number(inv.discount || 0) > 0
                ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#16a34a;">
                    <span>Discount:</span>
                    <strong>- ${formatINR(inv.discount)}</strong>
                  </div>`
                : ''
            }
            <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#0f172a;color:#ffffff;border-radius:4px;margin-top:6px;">
              <strong>Net Invoice Total:</strong>
              <strong>${formatINR(inv.amount)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;color:#16a34a;">
              <span>Paid Amount:</span>
              <strong>${formatINR(paidAmount)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #cbd5e1;color:${balanceDue > 0 ? '#dc2626' : '#16a34a'};">
              <strong>Balance Due:</strong>
              <strong>${formatINR(balanceDue)}</strong>
            </div>
          </div>

          ${
            inv.notes
              ? `<div style="margin-top:16px;padding:10px 12px;background:#f8fafc;border-left:3px solid #e11d48;font-size:13px;color:#334155;">
                  <strong>Notes:</strong> ${inv.notes}
                </div>`
              : ''
          }

          <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12px;color:#475569;line-height:1.6;">
            <div><strong>Bank Details:</strong> ${settings.bank_name || ''} | A/C: ${settings.account_number || ''} | IFSC: ${settings.ifsc_code || ''} | UPI: ${settings.upi_id || ''}</div>
            ${settings.payment_terms ? `<div><strong>Terms:</strong> ${settings.payment_terms}</div>` : ''}
          </div>
        </div>
      </div>
    `;

    const isGmail = smtpHost.toLowerCase().includes('gmail.com');
    const transporter = nodemailer.createTransport(
      isGmail
        ? {
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass
            }
          }
        : {
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass
            }
          }
    );

    await transporter.sendMail({
      from: `"${brandName}" <${smtpUser}>`,
      to: recipient,
      replyTo: smtpUser,
      subject,
      html
    });

    return NextResponse.json({
      success: true,
      configured: true,
      sentFrom: smtpUser,
      sentTo: recipient
    });
  } catch (err: any) {
    console.error('[Send Invoice Email Error]', err);
    const rawMsg = String(err?.message || '');
    const isGmailAppPasswordError =
      err?.code === 'EAUTH' ||
      rawMsg.includes('535') ||
      rawMsg.toLowerCase().includes('application-specific password') ||
      rawMsg.toLowerCase().includes('username and password not accepted');

    const friendlyError = isGmailAppPasswordError
      ? 'Gmail blocked standard password login for ippassales@gmail.com. Google requires a 16-digit Gmail App Password (Google Account -> Security -> 2-Step Verification -> App passwords) in SMTP_PASS.'
      : rawMsg || 'Failed to send invoice email.';

    return NextResponse.json(
      {
        success: false,
        configured: true,
        error: friendlyError
      },
      { status: 500 }
    );
  }
}
