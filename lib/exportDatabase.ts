'use client';

import * as XLSX from 'xlsx';
import { store } from './store';

export type CsvExportSection =
  | 'all'
  | 'treasury_accounts'
  | 'invoice_payments'
  | 'invoices'
  | 'events'
  | 'clients'
  | 'staff_attendance'
  | 'staff_salary'
  | 'stock_purchases'
  | 'inventory_menu';

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsvBlock(title: string, rows: Record<string, unknown>[]): string {
  const lines: string[] = [];
  lines.push(`=== ${title} ===`);
  if (rows.length === 0) {
    lines.push('No records');
    lines.push('');
    return lines.join('\r\n');
  }
  const headers = Object.keys(rows[0]);
  lines.push(headers.map(escapeCsvCell).join(','));
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(','));
  }
  lines.push('');
  return lines.join('\r\n');
}

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function buildDatasetSheets() {
  const state = store.getState();

  // STRICT OWNER-ONLY ENFORCEMENT
  if (state.currentRole !== 'owner') {
    throw new Error('Unauthorized: Only the Owner can export the database.');
  }

  const collections = store.getInvoiceCollectionsBreakdown();

  const totalStaffEarned = state.staff.reduce(
    (s, st) => s + store.getStaffSalarySummary(st.id).totalEarned,
    0
  );
  const totalStaffPaid = state.staff.reduce(
    (s, st) => s + store.getStaffSalarySummary(st.id).totalPaid,
    0
  );
  const totalStaffPayable = state.staff.reduce(
    (s, st) => s + store.getStaffSalarySummary(st.id).balancePayable,
    0
  );
  const totalVendorBills = (state.stockPurchases || []).reduce(
    (s, sp) => s + Number(sp.total_amount || 0),
    0
  );
  const totalVendorPaid = (state.stockPurchases || []).reduce(
    (s, sp) => s + Number(sp.paid_amount || 0),
    0
  );
  const totalVendorDues = (state.stockPurchases || []).reduce(
    (s, sp) => s + Number(sp.balance_amount || 0),
    0
  );

  // 1. Treasury & Summary Sheet (Where all amounts are held: Bank vs Cash & Accounts)
  const summaryRows: Record<string, unknown>[] = [
    {
      Category: 'Invoice Total Billed',
      Channel: 'All Invoices',
      'Account / Location': 'Client Invoices',
      'Amount (INR)': collections.totalInvoiced,
      Notes: `${state.invoices.length} invoices generated`
    },
    {
      Category: 'Invoice Amount Collected (Total)',
      Channel: 'Bank + Cash',
      'Account / Location': 'All Business Accounts & Cash',
      'Amount (INR)': collections.totalCollected,
      Notes: `${state.payments.length} payment receipts`
    },
    {
      Category: 'Invoice Amount Received in BANK',
      Channel: 'BANK',
      'Account / Location': 'All Bank & UPI Accounts',
      'Amount (INR)': collections.totalBankReceived,
      Notes: `${collections.bankPaymentCount} bank/UPI/card transfers`
    },
    {
      Category: 'Invoice Amount Received as CASH',
      Channel: 'CASH',
      'Account / Location': 'Cash Counter / Hand Cash',
      'Amount (INR)': collections.totalCashReceived,
      Notes: `${collections.cashPaymentCount} cash receipts`
    },
    {
      Category: 'Invoice Pending Balance Receivable',
      Channel: 'Pending from Clients',
      'Account / Location': 'With Clients (Unpaid Balance)',
      'Amount (INR)': collections.totalPendingReceivable,
      Notes: 'Remaining amount to collect from clients'
    },
    ...collections.accountHoldings.map((h) => ({
      Category: 'Account Holding Breakdown',
      Channel: h.channel.toUpperCase(),
      'Account / Location': h.accountName,
      'Amount (INR)': h.totalReceived,
      Notes: `${h.paymentCount} receipt(s) • Last: ${h.lastReceivedAt ? h.lastReceivedAt.slice(0, 10) : '-'}`
    })),
    {
      Category: 'Staff Salary Total Earned (Attended Only)',
      Channel: 'Payroll',
      'Account / Location': 'Attended Event Shifts + Allowances',
      'Amount (INR)': totalStaffEarned,
      Notes: 'Only shifts marked PRESENT are counted'
    },
    {
      Category: 'Staff Salary Paid',
      Channel: 'Payroll Outflow',
      'Account / Location': 'Paid to Crew',
      'Amount (INR)': totalStaffPaid,
      Notes: 'Total salary disbursed'
    },
    {
      Category: 'Staff Salary Balance Payable',
      Channel: 'Payroll Liability',
      'Account / Location': 'Pending to Staff',
      'Amount (INR)': totalStaffPayable,
      Notes: 'Remaining balance to pay staff'
    },
    {
      Category: 'Stock Purchases Total',
      Channel: 'Vendor Procurement',
      'Account / Location': 'All Suppliers',
      'Amount (INR)': totalVendorBills,
      Notes: `Paid: ₹${totalVendorPaid} | Dues: ₹${totalVendorDues}`
    }
  ];

  // 2. Invoice Payments & Account Destinations
  const invoicePaymentsRows = state.payments.map((p) => {
    const inv = state.invoices.find((i) => i.id === p.invoice_id);
    const evt = state.events.find((e) => e.id === inv?.event_id);
    const client = state.clients.find((c) => c.id === evt?.client_id);
    const ch = store.inferPaymentChannel(p.method, p.payment_channel);
    const destAcc = store.resolveDestinationAccount(p);
    return {
      'Payment Date': p.paid_at ? p.paid_at.slice(0, 10) : '',
      'Invoice Number': inv?.invoice_number || '',
      Event: evt?.title || '',
      Client: client?.name || '',
      'Channel (Bank / Cash)': ch.toUpperCase(),
      'Destination Account (Where Held)': destAcc,
      'Payment Method': p.method,
      'Amount Received (INR)': p.amount,
      'Reference / Note': p.note || ''
    };
  });

  // 3. Invoices
  const invoicesRows = state.invoices.map((inv) => {
    const evt = state.events.find((e) => e.id === inv.event_id);
    const client = state.clients.find((c) => c.id === evt?.client_id);
    const invPmts = state.payments.filter((p) => p.invoice_id === inv.id);
    const paidTotal = invPmts.reduce((s, p) => s + p.amount, 0);
    const paidBank = invPmts
      .filter((p) => store.inferPaymentChannel(p.method, p.payment_channel) === 'bank')
      .reduce((s, p) => s + p.amount, 0);
    const paidCash = invPmts
      .filter((p) => store.inferPaymentChannel(p.method, p.payment_channel) === 'cash')
      .reduce((s, p) => s + p.amount, 0);
    const accountsUsed = Array.from(
      new Set(invPmts.map((p) => store.resolveDestinationAccount(p)))
    ).join(' | ');
    return {
      'Invoice Number': inv.invoice_number,
      Kind: inv.kind,
      Event: evt?.title || '',
      Client: client?.name || '',
      'Subtotal (INR)': inv.subtotal,
      'Discount (INR)': inv.discount,
      'Net Invoice Amount (INR)': inv.amount,
      'Received in Bank (INR)': paidBank,
      'Received as Cash (INR)': paidCash,
      'Total Paid (INR)': paidTotal,
      'Balance Due (INR)': Math.max(0, inv.amount - paidTotal),
      'Deposited Accounts': accountsUsed || '—',
      Status: inv.status,
      'Due Date': inv.due_date || '',
      'Created At': inv.created_at ? inv.created_at.slice(0, 10) : '',
      Notes: inv.notes || ''
    };
  });

  // 4. Events
  const eventsRows = state.events.map((e) => {
    const client = state.clients.find((c) => c.id === e.client_id);
    const totals = store.getEventTotal(e.id);
    return {
      'Event Date': e.event_date,
      'Event Title': e.title,
      Client: client?.name || '',
      'Client Phone': client?.phone || '',
      Venue: e.venue || '',
      'Start Time': e.start_time || '',
      'End Time': e.end_time || '',
      'Guests (Pax)': e.guest_count,
      Status: e.status,
      'Menu Total (INR)': totals.menuTotal,
      'Extras Total (INR)': totals.extrasTotal,
      'Grand Quote Total (INR)': totals.grandTotal,
      Notes: e.notes || ''
    };
  });

  // 5. Clients
  const clientsRows = state.clients.map((c) => ({
    'Client Name': c.name,
    Company: c.company || '',
    Phone: c.phone || '',
    Email: c.email || '',
    Notes: c.notes || '',
    'Created Date': c.created_at ? c.created_at.slice(0, 10) : ''
  }));

  // 6. Event Quotations (Menu Lines + Extras)
  const quotationRows = [
    ...state.eventItems.map((ei) => {
      const evt = state.events.find((e) => e.id === ei.event_id);
      const dish = state.menuItems.find((m) => m.id === ei.menu_item_id);
      const isKg = ei.pricing_type === 'per_kg';
      const qty =
        ei.quantity !== undefined ? ei.quantity : isKg ? 1 : evt?.guest_count || 1;
      const rate = ei.price_per_unit || ei.price_per_guest || 0;
      return {
        Event: evt?.title || '',
        'Event Date': evt?.event_date || '',
        'Line Type': 'Dish',
        Description: dish?.name || '',
        'Pricing Mode': ei.pricing_type,
        Quantity: qty,
        'Rate (INR)': rate,
        'Line Total (INR)': rate * qty
      };
    }),
    ...state.eventExtras.map((ex) => {
      const evt = state.events.find((e) => e.id === ex.event_id);
      return {
        Event: evt?.title || '',
        'Event Date': evt?.event_date || '',
        'Line Type': 'Extra / Logistics',
        Description: ex.description,
        'Pricing Mode': 'fixed',
        Quantity: 1,
        'Rate (INR)': ex.amount,
        'Line Total (INR)': ex.amount
      };
    })
  ];

  // 7. Staff Attendance Register & Shifts (Strict rule: hide payment if NOT Present!)
  const staffAttendanceRows = state.shifts.map((sh) => {
    const evt = state.events.find((e) => e.id === sh.event_id);
    const st = state.staff.find((s) => s.id === sh.staff_member_id);
    const hrs = store.calculateShiftHours(sh.starts_at, sh.ends_at);
    const status = sh.attendance_status || 'pending';
    const isPresent = status === 'present' && evt?.status !== 'cancelled';
    const earned = isPresent ? Math.round(hrs * Number(st?.hourly_rate || 0)) : '';
    return {
      'Event Date': evt?.event_date || '',
      Event: evt?.title || '',
      'Staff Name': st?.name || '',
      Phone: st?.phone || '',
      'Assigned Role': sh.role_label || st?.role_title || '',
      'Start Time': sh.starts_at ? sh.starts_at.slice(11, 16) : '',
      'End Time': sh.ends_at ? sh.ends_at.slice(11, 16) : '',
      Hours: hrs,
      'Attendance Status': status.toUpperCase(),
      'Earned Shift Pay (INR)': isPresent ? earned : '— (Not Attended)'
    };
  });

  // 8. Staff Salary Summary & Balances
  const staffSalarySummaryRows = state.staff.map((st) => {
    const sum = store.getStaffSalarySummary(st.id);
    return {
      'Staff Name': st.name,
      'Phone (Login)': st.phone,
      Role: st.role_title || '',
      'Hourly Rate (INR)': st.hourly_rate,
      'Attended Shifts': sum.attendedShiftsCount,
      'Absent Shifts': sum.absentShiftsCount,
      'Pending Attendance Shifts': sum.pendingShiftsCount,
      'Attended Hours': sum.totalShiftHours,
      'Shift Pay Earned (INR)': sum.shiftEarnings,
      'Allowances / Bonus (INR)': sum.extraEarnings,
      'Total Earned (INR)': sum.totalEarned,
      'Total Salary Paid (INR)': sum.totalPaid,
      'Balance Payable (INR)': sum.balancePayable,
      Status: st.active ? 'Active' : 'Inactive'
    };
  });

  // 9. Staff Salary Payments & Allowances Ledger
  const staffSalaryLedgerRows = (state.staffSalaryRecords || []).map((sr) => {
    const st = state.staff.find((s) => s.id === sr.staff_member_id);
    const evt = state.events.find((e) => e.id === sr.event_id);
    return {
      Date: sr.recorded_at ? sr.recorded_at.slice(0, 10) : '',
      'Staff Name': st?.name || '',
      Type: sr.record_type === 'payment' ? 'Salary Payment' : 'Duty Allowance / Bonus',
      'Method / Category': sr.method,
      'Linked Event': evt?.title || '',
      'Amount (INR)': sr.amount,
      Note: sr.note || ''
    };
  });

  // 10. Menu & Recipes
  const menuRows = state.menuItems.map((m) => ({
    'Dish Name': m.name,
    Category: m.category,
    'Pricing Type': m.pricing_type,
    'Unit Price (INR)': m.price_per_unit || m.price_per_guest,
    Active: m.active ? 'Yes' : 'No',
    Description: m.description || ''
  }));

  // 11. Inventory Stock
  const inventoryRows = state.ingredients.map((i) => ({
    Ingredient: i.name,
    Unit: i.unit,
    'Current Stock': i.stock_qty,
    'Low Stock Alert Level': i.low_stock_level,
    'Expiry Date': i.expiry_date || '—',
    'Cost Per Unit (INR)': i.cost_per_unit,
    'Stock Valuation (INR)': Math.round(i.stock_qty * i.cost_per_unit),
    Status: i.stock_qty <= i.low_stock_level ? 'LOW STOCK' : 'OK'
  }));

  // 12. Stock Purchases & Vendor Dues
  const purchasesRows = (state.stockPurchases || []).map((sp) => ({
    'Purchase Date': sp.purchase_date,
    Vendor: sp.vendor_name,
    Location: sp.vendor_location || '',
    Phone: sp.vendor_phone || '',
    'Bill Number': sp.bill_number || '',
    Items: (sp.items || []).map((it) => `${it.item_name} (${it.quantity} ${it.unit})`).join('; '),
    'Total Bill (INR)': sp.total_amount,
    'Paid Amount (INR)': sp.paid_amount,
    'Balance Due (INR)': sp.balance_amount,
    Status: sp.payment_status,
    'Payment Method': sp.payment_method,
    Notes: sp.notes || ''
  }));

  // 13. Owner Activity & Audit Trail
  const auditRows = (state.auditLogs || []).slice(0, 300).map((log) => ({
    Timestamp: log.created_at,
    'Actor Role': log.actor_role,
    'Login ID': log.actor_username,
    'Actor Name': log.actor_name,
    Source: log.source,
    Module: log.entity_type,
    Action: log.action,
    Summary: log.summary,
    Details: log.details || ''
  }));

  return {
    summaryRows,
    invoicePaymentsRows,
    invoicesRows,
    eventsRows,
    clientsRows,
    quotationRows,
    staffAttendanceRows,
    staffSalarySummaryRows,
    staffSalaryLedgerRows,
    menuRows,
    inventoryRows,
    purchasesRows,
    auditRows
  };
}

export async function downloadDatabaseAsExcel(): Promise<void> {
  if (store.getState().currentRole !== 'owner') {
    throw new Error('Only the Owner account is authorized to download the database.');
  }

  // Pull latest SQL rows first if connected so export reflects live server + DB state
  await store.syncFromSupabase(true);

  const sheets = buildDatasetSheets();
  const wb = XLSX.utils.book_new();

  const appendSheet = (name: string, rows: Record<string, unknown>[]) => {
    const safeRows = rows.length > 0 ? rows : [{ Status: 'No records yet' }];
    const ws = XLSX.utils.json_to_sheet(safeRows);
    const headers = Object.keys(safeRows[0]);
    ws['!cols'] = headers.map((h) => ({
      wch: Math.min(42, Math.max(h.length + 4, 16))
    }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  appendSheet('Treasury & Accounts', sheets.summaryRows);
  appendSheet('Invoice Receipts', sheets.invoicePaymentsRows);
  appendSheet('Invoices', sheets.invoicesRows);
  appendSheet('Events', sheets.eventsRows);
  appendSheet('Clients', sheets.clientsRows);
  appendSheet('Event Quotations', sheets.quotationRows);
  appendSheet('Staff Attendance', sheets.staffAttendanceRows);
  appendSheet('Staff Salary Summary', sheets.staffSalarySummaryRows);
  appendSheet('Staff Salary Ledger', sheets.staffSalaryLedgerRows);
  appendSheet('Inventory Stock', sheets.inventoryRows);
  appendSheet('Vendor Purchases', sheets.purchasesRows);
  appendSheet('Menu Catalog', sheets.menuRows);
  appendSheet('Owner Audit Logs', sheets.auditRows);

  const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const dateStamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([wbArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  triggerFileDownload(blob, `IPPAS_Database_Export_${dateStamp}.xlsx`);
}

export async function downloadDatabaseAsCsv(section: CsvExportSection = 'all'): Promise<void> {
  if (store.getState().currentRole !== 'owner') {
    throw new Error('Only the Owner account is authorized to download the database.');
  }

  await store.syncFromSupabase(true);

  const sheets = buildDatasetSheets();
  const blocks: string[] = [];

  if (section === 'all' || section === 'treasury_accounts') {
    blocks.push(rowsToCsvBlock('TREASURY SUMMARY & BANK / CASH ACCOUNT HOLDINGS', sheets.summaryRows));
  }
  if (section === 'all' || section === 'invoice_payments') {
    blocks.push(rowsToCsvBlock('INVOICE PAYMENT RECEIPTS & DESTINATION ACCOUNTS', sheets.invoicePaymentsRows));
  }
  if (section === 'all' || section === 'invoices') {
    blocks.push(rowsToCsvBlock('INVOICES', sheets.invoicesRows));
  }
  if (section === 'all' || section === 'events') {
    blocks.push(rowsToCsvBlock('EVENTS & QUOTATIONS', sheets.eventsRows));
    if (section === 'all') {
      blocks.push(rowsToCsvBlock('EVENT QUOTATION LINE ITEMS', sheets.quotationRows));
    }
  }
  if (section === 'all' || section === 'clients') {
    blocks.push(rowsToCsvBlock('CLIENTS', sheets.clientsRows));
  }
  if (section === 'all' || section === 'staff_attendance') {
    blocks.push(rowsToCsvBlock('STAFF EVENT ATTENDANCE REGISTER', sheets.staffAttendanceRows));
  }
  if (section === 'all' || section === 'staff_salary') {
    blocks.push(rowsToCsvBlock('STAFF SALARY BALANCES', sheets.staffSalarySummaryRows));
    blocks.push(rowsToCsvBlock('STAFF SALARY PAYMENTS & ALLOWANCES', sheets.staffSalaryLedgerRows));
  }
  if (section === 'all' || section === 'stock_purchases') {
    blocks.push(rowsToCsvBlock('STOCK PURCHASES & VENDOR DUES', sheets.purchasesRows));
  }
  if (section === 'all' || section === 'inventory_menu') {
    blocks.push(rowsToCsvBlock('WAREHOUSE INVENTORY STOCK', sheets.inventoryRows));
    blocks.push(rowsToCsvBlock('MENU CATALOG', sheets.menuRows));
  }
  if (section === 'all') {
    blocks.push(rowsToCsvBlock('OWNER AUDIT TRAIL', sheets.auditRows));
  }

  const csvContent = '\uFEFF' + blocks.join('\r\n');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const suffix = section === 'all' ? 'Full_Database' : section;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerFileDownload(blob, `IPPAS_${suffix}_${dateStamp}.csv`);
}
