import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AppState, store } from '@/lib/store';
import { EventRecord, Shift, ShiftAttendanceStatus, StaffMember, StaffSalaryRecord } from '@/lib/types';
import { printHtmlDocument } from '@/lib/printDocument';

function escapeHtml(val?: string | number | null): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  }
  const fallback = new Date(dateStr);
  if (!isNaN(fallback.getTime())) {
    return fallback.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
  return dateStr;
}

export function formatPeriodLabel(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return 'All Recorded Dates';
  if (startDate && !endDate) return `From ${formatDisplayDate(startDate)}`;
  if (!startDate && endDate) return `Up to ${formatDisplayDate(endDate)}`;
  return `${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)}`;
}

export interface StaffPeriodShiftEntry {
  shift: Shift;
  event?: EventRecord;
  date: string;
  hours: number;
  hourlyRate: number;
  attendanceStatus: ShiftAttendanceStatus;
  isAttended: boolean;
  earnedAmount: number;
}

export interface StaffPeriodReportRow {
  staff: StaffMember;
  attendedShifts: StaffPeriodShiftEntry[];
  allShiftsInRange: StaffPeriodShiftEntry[];
  attendedShiftsCount: number;
  absentShiftsCount: number;
  pendingShiftsCount: number;
  totalHoursWorked: number;
  shiftEarnings: number;
  allowanceRecords: StaffSalaryRecord[];
  extraEarnings: number;
  totalEarnings: number;
  paymentRecords: StaffSalaryRecord[];
  paymentsReceived: number;
  periodNetBalance: number; // totalEarnings - paymentsReceived (can be negative if advance paid in period)
  periodPayable: number; // Math.max(0, totalEarnings - paymentsReceived)
  periodAdvanceExcess: number; // Math.max(0, paymentsReceived - totalEarnings)
  overallBalancePayable: number;
  hasActivityInRange: boolean;
}

export interface StaffPeriodReportTotals {
  staffCount: number;
  activeStaffInPeriod: number;
  attendedShiftsCount: number;
  totalHoursWorked: number;
  shiftEarnings: number;
  extraEarnings: number;
  totalEarnings: number;
  paymentsReceived: number;
  paymentCount: number;
  periodPayable: number;
}

function isDateWithinRange(dateYmd: string, startDate: string, endDate: string): boolean {
  if (!dateYmd) return !startDate && !endDate;
  const clean = dateYmd.slice(0, 10);
  if (startDate && clean < startDate) return false;
  if (endDate && clean > endDate) return false;
  return true;
}

/**
 * Computes per-staff and aggregate payroll summaries for a selected [startDate, endDate] range.
 * Strictly honors the attendance-gated rule: only shifts marked 'present' on non-cancelled events
 * contribute to hours worked and shift earnings.
 */
export function computeStaffPeriodReport(
  state: AppState,
  startDate: string,
  endDate: string,
  staffIdFilter?: string
): {
  rows: StaffPeriodReportRow[];
  totals: StaffPeriodReportTotals;
} {
  // Normalize range order if user entered startDate > endDate
  const effectiveStart =
    startDate && endDate && startDate > endDate ? endDate : startDate;
  const effectiveEnd =
    startDate && endDate && startDate > endDate ? startDate : endDate;

  const targetStaffList = staffIdFilter
    ? state.staff.filter((s) => s.id === staffIdFilter)
    : state.staff;

  const rows: StaffPeriodReportRow[] = targetStaffList.map((staff) => {
    const hourlyRate = Number(staff.hourly_rate || 0);
    const overallSummary = store.getStaffSalarySummary(staff.id);

    const allShiftsInRange: StaffPeriodShiftEntry[] = state.shifts
      .filter((sh) => sh.staff_member_id === staff.id)
      .map((sh) => {
        const event = state.events.find((e) => e.id === sh.event_id);
        const date = event?.event_date
          ? event.event_date.slice(0, 10)
          : (sh.starts_at || '').slice(0, 10);
        const hours = store.calculateShiftHours(sh.starts_at, sh.ends_at);
        const attendanceStatus: ShiftAttendanceStatus =
          sh.attendance_status === 'present' || sh.attendance_status === 'absent'
            ? sh.attendance_status
            : 'pending';
        const isAttended = attendanceStatus === 'present' && event?.status !== 'cancelled';
        const earnedAmount = isAttended ? Math.round(hours * hourlyRate) : 0;

        return {
          shift: sh,
          event,
          date,
          hours,
          hourlyRate,
          attendanceStatus,
          isAttended,
          earnedAmount
        };
      })
      .filter((entry) => (!entry.event || entry.event.status !== 'cancelled') && isDateWithinRange(entry.date, effectiveStart, effectiveEnd))
      .sort((a, b) => a.date.localeCompare(b.date));

    const attendedShifts = allShiftsInRange.filter((s) => s.isAttended);
    const attendedShiftsCount = attendedShifts.length;
    const absentShiftsCount = allShiftsInRange.filter((s) => s.attendanceStatus === 'absent').length;
    const pendingShiftsCount = allShiftsInRange.filter((s) => s.attendanceStatus === 'pending').length;

    const totalHoursWorked = Number(
      attendedShifts.reduce((sum, s) => sum + s.hours, 0).toFixed(2)
    );
    const shiftEarnings = attendedShifts.reduce((sum, s) => sum + s.earnedAmount, 0);

    const recordsInRange = (state.staffSalaryRecords || []).filter(
      (rec) =>
        rec.staff_member_id === staff.id &&
        isDateWithinRange((rec.recorded_at || '').slice(0, 10), effectiveStart, effectiveEnd)
    );

    const allowanceRecords = recordsInRange
      .filter((r) => r.record_type === 'earning')
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

    const paymentRecords = recordsInRange
      .filter((r) => r.record_type === 'payment')
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

    const extraEarnings = allowanceRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const totalEarnings = shiftEarnings + extraEarnings;
    const paymentsReceived = paymentRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const periodNetBalance = totalEarnings - paymentsReceived;
    const periodPayable = Math.max(0, periodNetBalance);
    const periodAdvanceExcess = Math.max(0, paymentsReceived - totalEarnings);

    const hasActivityInRange =
      attendedShiftsCount > 0 ||
      extraEarnings > 0 ||
      paymentsReceived > 0 ||
      allShiftsInRange.length > 0;

    return {
      staff,
      attendedShifts,
      allShiftsInRange,
      attendedShiftsCount,
      absentShiftsCount,
      pendingShiftsCount,
      totalHoursWorked,
      shiftEarnings,
      allowanceRecords,
      extraEarnings,
      totalEarnings,
      paymentRecords,
      paymentsReceived,
      periodNetBalance,
      periodPayable,
      periodAdvanceExcess,
      overallBalancePayable: overallSummary.balancePayable,
      hasActivityInRange
    };
  });

  const totals: StaffPeriodReportTotals = {
    staffCount: rows.length,
    activeStaffInPeriod: rows.filter((r) => r.hasActivityInRange).length,
    attendedShiftsCount: rows.reduce((s, r) => s + r.attendedShiftsCount, 0),
    totalHoursWorked: Number(rows.reduce((s, r) => s + r.totalHoursWorked, 0).toFixed(2)),
    shiftEarnings: rows.reduce((s, r) => s + r.shiftEarnings, 0),
    extraEarnings: rows.reduce((s, r) => s + r.extraEarnings, 0),
    totalEarnings: rows.reduce((s, r) => s + r.totalEarnings, 0),
    paymentsReceived: rows.reduce((s, r) => s + r.paymentsReceived, 0),
    paymentCount: rows.reduce((s, r) => s + r.paymentRecords.length, 0),
    periodPayable: rows.reduce((s, r) => s + r.periodPayable, 0)
  };

  return { rows, totals };
}

/**
 * Builds the printable HTML markup for a single Staff Member's A4 Salary Slip.
 */
export function buildStaffSalarySlipHtml(
  row: StaffPeriodReportRow,
  startDate: string,
  endDate: string,
  state: AppState
): string {
  const periodLabel = formatPeriodLabel(startDate, endDate);
  const issueDate = formatDisplayDate(new Date().toISOString().slice(0, 10));
  const slipCode = `SLIP-${(endDate || new Date().toISOString().slice(0, 7)).replace(/-/g, '').slice(0, 6)}-${row.staff.id.slice(-4).toUpperCase()}`;
  const businessName = state.settings.name || 'IPPAS FOOD SERVICE & EVENTS';

  const earningRowsHtml =
    row.attendedShifts.length > 0 || row.allowanceRecords.length > 0
      ? [
          ...row.attendedShifts.map((entry) => {
            const timeSpan = `${(entry.shift.starts_at || '').slice(11, 16)} – ${(entry.shift.ends_at || '').slice(11, 16)}`;
            return `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 8px; font-weight: 600; white-space: nowrap;">${escapeHtml(formatDisplayDate(entry.date))}</td>
                <td style="padding: 7px 8px;">
                  <div style="font-weight: 600; color: #0f172a;">${escapeHtml(entry.event?.title || 'Event Catering Shift')}</div>
                  <div style="font-size: 0.72rem; color: #64748b;">
                    Role: ${escapeHtml(entry.shift.role_label || row.staff.role_title || 'Crew')} &bull; Shift: ${escapeHtml(timeSpan)}
                  </div>
                </td>
                <td style="padding: 7px 8px; text-align: center; color: #334155; font-weight: 600;">
                  ${entry.hours} hrs
                </td>
                <td style="padding: 7px 8px; text-align: right; color: #334155;">
                  ₹${entry.hourlyRate.toLocaleString('en-IN')}/hr
                </td>
                <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: #0f172a;">
                  ₹${entry.earnedAmount.toLocaleString('en-IN')}
                </td>
              </tr>
            `;
          }),
          ...row.allowanceRecords.map((rec) => {
            const linkedEvt = rec.event_id
              ? state.events.find((e) => e.id === rec.event_id)
              : undefined;
            return `
              <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                <td style="padding: 7px 8px; font-weight: 600; white-space: nowrap;">${escapeHtml(formatDisplayDate(rec.recorded_at))}</td>
                <td style="padding: 7px 8px;">
                  <div style="font-weight: 600; color: #1d4ed8;">${escapeHtml(rec.method || 'Duty Allowance / Bonus')}</div>
                  <div style="font-size: 0.72rem; color: #64748b;">
                    ${escapeHtml(rec.note || (linkedEvt ? `Event: ${linkedEvt.title}` : 'Additional wage / allowance'))}
                  </div>
                </td>
                <td style="padding: 7px 8px; text-align: center; color: #64748b;">Fixed</td>
                <td style="padding: 7px 8px; text-align: right; color: #64748b;">Allowance</td>
                <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: #1d4ed8;">
                  ₹${Number(rec.amount || 0).toLocaleString('en-IN')}
                </td>
              </tr>
            `;
          })
        ].join('')
      : `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td colspan="5" style="padding: 12px 8px; text-align: center; color: #64748b; font-size: 0.8rem;">
            No attended shifts or extra wage entries recorded during this period.
          </td>
        </tr>
      `;

  const paymentRowsHtml =
    row.paymentRecords.length > 0
      ? row.paymentRecords
          .map((pay) => {
            const linkedEvt = pay.event_id
              ? state.events.find((e) => e.id === pay.event_id)
              : undefined;
            return `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 8px; font-weight: 600; white-space: nowrap;">${escapeHtml(formatDisplayDate(pay.recorded_at))}</td>
                <td style="padding: 7px 8px; font-weight: 600; color: #0f172a;">${escapeHtml(pay.method || 'Cash / UPI')}</td>
                <td style="padding: 7px 8px; color: #475569;">
                  ${escapeHtml(pay.note || (linkedEvt ? `For ${linkedEvt.title}` : 'Salary disbursement'))}
                </td>
                <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: #059669;">
                  ₹${Number(pay.amount || 0).toLocaleString('en-IN')}
                </td>
              </tr>
            `;
          })
          .join('')
      : `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td colspan="4" style="padding: 12px 8px; text-align: center; color: #64748b; font-size: 0.8rem;">
            No salary payments recorded during this period.
          </td>
        </tr>
      `;

  const isPeriodSettled = row.periodPayable === 0;

  return `
    <div style="width: 794px; min-height: 1100px; padding: 34px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Company & Slip Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="/logo.png" alt="Logo" style="height: 56px; width: auto; object-fit: contain; display: block;" />
            <div>
              <div style="font-weight: 800; font-size: 1.15rem; letter-spacing: 0.4px; color: #0f172a;">
                ${escapeHtml(businessName)}
              </div>
              <div style="font-size: 0.78rem; color: #475569;">
                ${escapeHtml(state.settings.address || 'Outdoor Catering & Event Management • Kerala')}
              </div>
              <div style="font-size: 0.74rem; color: #64748b;">
                Phone: ${escapeHtml(state.settings.phone || '+91 98470 11111')} &bull; Email: ${escapeHtml(state.settings.email || 'events@ippas.com')}
              </div>
            </div>
          </div>

          <div style="text-align: right;">
            <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 1.85rem; font-weight: 700; color: #0f172a; letter-spacing: 0.5px; line-height: 1;">
              SALARY SLIP
            </div>
            <div style="font-size: 0.78rem; font-weight: 700; color: #e11d48; margin-top: 5px;">
              Ref: ${escapeHtml(slipCode)}
            </div>
            <div style="font-size: 0.74rem; color: #475569; margin-top: 2px;">
              Generated: ${escapeHtml(issueDate)}
            </div>
          </div>
        </div>

        <!-- Employee Info & Pay Period Metadata -->
        <div style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px;">
          <div style="font-size: 0.83rem; line-height: 1.6;">
            <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 2px;">
              Staff / Crew Member Details
            </div>
            <div style="font-size: 1.02rem; font-weight: 800; color: #0f172a;">
              ${escapeHtml(row.staff.name)}
            </div>
            <div><strong>Designation / Role:</strong> ${escapeHtml(row.staff.role_title || 'Service Crew')}</div>
            <div><strong>Mobile Number:</strong> ${escapeHtml(row.staff.phone || '—')}</div>
            <div><strong>Standard Hourly Rate:</strong> ₹${Number(row.staff.hourly_rate || 0).toLocaleString('en-IN')} / hr</div>
          </div>

          <div style="text-align: right; font-size: 0.83rem; line-height: 1.6;">
            <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 2px;">
              Statement Period
            </div>
            <div style="font-size: 0.94rem; font-weight: 800; color: #0f172a;">
              ${escapeHtml(periodLabel)}
            </div>
            <div><strong>Attended Shifts:</strong> ${row.attendedShiftsCount} shift${row.attendedShiftsCount === 1 ? '' : 's'}</div>
            <div><strong>Total Hours Worked:</strong> ${row.totalHoursWorked} hrs</div>
            <div style="margin-top: 4px;">
              <span style="display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; background: ${isPeriodSettled ? '#dcfce7' : '#fee2e2'}; color: ${isPeriodSettled ? '#15803d' : '#b91c1c'};">
                ${isPeriodSettled ? 'Period Settled' : 'Balance Payable'}
              </span>
            </div>
          </div>
        </div>

        <!-- 4 Summary Highlight Boxes -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
          <div style="border: 1px solid #cbd5e1; border-left: 4px solid #475569; border-radius: 6px; padding: 10px 12px; background: #ffffff;">
            <div style="font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Hours Worked</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-top: 2px;">${row.totalHoursWorked} hrs</div>
            <div style="font-size: 0.7rem; color: #64748b;">${row.attendedShiftsCount} present shift${row.attendedShiftsCount === 1 ? '' : 's'}</div>
          </div>

          <div style="border: 1px solid #bfdbfe; border-left: 4px solid #2563eb; border-radius: 6px; padding: 10px 12px; background: #eff6ff;">
            <div style="font-size: 0.7rem; font-weight: 700; color: #1e40af; text-transform: uppercase;">Total Earnings</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: #1e3a8a; margin-top: 2px;">₹${row.totalEarnings.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.7rem; color: #1e40af;">Shifts + Allowances</div>
          </div>

          <div style="border: 1px solid #a7f3d0; border-left: 4px solid #059669; border-radius: 6px; padding: 10px 12px; background: #ecfdf5;">
            <div style="font-size: 0.7rem; font-weight: 700; color: #065f46; text-transform: uppercase;">Payments Received</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: #059669; margin-top: 2px;">₹${row.paymentsReceived.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.7rem; color: #065f46;">${row.paymentRecords.length} payment${row.paymentRecords.length === 1 ? '' : 's'}</div>
          </div>

          <div style="border: 1px solid ${row.periodPayable > 0 ? '#fecaca' : '#cbd5e1'}; border-left: 4px solid ${row.periodPayable > 0 ? '#dc2626' : '#059669'}; border-radius: 6px; padding: 10px 12px; background: ${row.periodPayable > 0 ? '#fef2f2' : '#f8fafc'};">
            <div style="font-size: 0.7rem; font-weight: 700; color: ${row.periodPayable > 0 ? '#991b1b' : '#334155'}; text-transform: uppercase;">
              ${row.periodAdvanceExcess > 0 ? 'Advance Excess' : 'Period Balance'}
            </div>
            <div style="font-size: 1.2rem; font-weight: 800; color: ${row.periodPayable > 0 ? '#dc2626' : '#059669'}; margin-top: 2px;">
              ₹${(row.periodAdvanceExcess > 0 ? row.periodAdvanceExcess : row.periodPayable).toLocaleString('en-IN')}
            </div>
            <div style="font-size: 0.7rem; color: #64748b;">
              ${row.periodPayable > 0 ? 'Remaining for period' : row.periodAdvanceExcess > 0 ? 'Paid over period earnings' : 'Cleared in period'}
            </div>
          </div>
        </div>

        <!-- Earnings Breakdown Table -->
        <div style="margin-bottom: 18px;">
          <div style="font-size: 0.82rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; color: #0f172a; margin-bottom: 6px;">
            1. Attended Shifts &amp; Earnings Breakdown
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff;">
                <th style="padding: 7px 8px; text-align: left; width: 105px;">Date</th>
                <th style="padding: 7px 8px; text-align: left;">Event / Duty Description</th>
                <th style="padding: 7px 8px; text-align: center; width: 85px;">Hours</th>
                <th style="padding: 7px 8px; text-align: right; width: 95px;">Rate</th>
                <th style="padding: 7px 8px; text-align: right; width: 105px;">Earned (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${earningRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Payments Received Breakdown Table -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 0.82rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; color: #0f172a; margin-bottom: 6px;">
            2. Salary Payments Received in Period
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #f1f5f9; color: #0f172a; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 7px 8px; text-align: left; width: 105px;">Date</th>
                <th style="padding: 7px 8px; text-align: left; width: 150px;">Payment Method</th>
                <th style="padding: 7px 8px; text-align: left;">Reference / Note</th>
                <th style="padding: 7px 8px; text-align: right; width: 115px;">Received (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${paymentRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Net Salary Calculation Box -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
          <div style="width: 350px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; background: #f8fafc; font-size: 0.83rem;">
            <div style="display: flex; justify-content: space-between; padding: 3px 0;">
              <span style="color: #475569;">Shift Wages (${row.totalHoursWorked} hrs):</span>
              <span style="font-weight: 600;">₹${row.shiftEarnings.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 3px 0;">
              <span style="color: #475569;">Duty Allowances / Bonuses:</span>
              <span style="font-weight: 600;">₹${row.extraEarnings.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-top: 1px solid #cbd5e1; margin-top: 4px; font-weight: 700; color: #0f172a;">
              <span>Gross Period Earnings:</span>
              <span>₹${row.totalEarnings.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #059669; font-weight: 700;">
              <span>Less: Payments Received:</span>
              <span>- ₹${row.paymentsReceived.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #0f172a; color: #ffffff; border-radius: 5px; margin-top: 6px;">
              <span style="font-weight: 700;">Net Period Balance Payable:</span>
              <span style="font-weight: 800; font-size: 1.05rem;">₹${row.periodPayable.toLocaleString('en-IN')}</span>
            </div>
            ${
              row.overallBalancePayable !== row.periodPayable
                ? `
                  <div style="display: flex; justify-content: space-between; padding-top: 6px; margin-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 0.75rem; color: #475569;">
                    <span>Cumulative Account Payable (All Dates):</span>
                    <strong style="color: ${row.overallBalancePayable > 0 ? '#dc2626' : '#059669'};">₹${row.overallBalancePayable.toLocaleString('en-IN')}</strong>
                  </div>
                `
                : ''
            }
          </div>
        </div>
      </div>

      <!-- Signatures Footer -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 22px; margin-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 0.78rem; color: #475569;">
        <div style="text-align: center;">
          <div style="width: 180px; border-top: 1px dashed #94a3b8; padding-top: 6px;">
            Staff Signature (${escapeHtml(row.staff.name)})
          </div>
        </div>

        <div style="font-size: 0.7rem; color: #94a3b8; text-align: center;">
          Computer-generated Staff Salary Slip &bull; ${escapeHtml(businessName)}
        </div>

        <div style="text-align: center;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 22px;">
            For ${escapeHtml(businessName)}
          </div>
          <div style="width: 180px; border-top: 1px dashed #94a3b8; padding-top: 6px;">
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Helper that renders an HTML string into a canvas and appends one or more A4 pages onto an existing jsPDF instance.
 */
async function appendHtmlPageToPdf(
  pdf: jsPDF,
  htmlMarkup: string,
  isFirstDocumentPage: boolean
): Promise<void> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-9999px';
  container.style.width = '794px';
  container.style.zIndex = '-1000';
  container.style.background = '#ffffff';
  container.innerHTML = htmlMarkup;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2.2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 800
    });

    const margin = 8;
    const pageWidth = 210;
    const pageHeight = 297;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    const contentWidth = printableWidth;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    if (!isFirstDocumentPage) {
      pdf.addPage();
    }

    if (contentHeight <= printableHeight) {
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
    } else if (contentHeight <= printableHeight * 1.35) {
      // Slightly taller than 1 page: fit proportionally onto one crisp A4 sheet
      const imgData = canvas.toDataURL('image/png');
      const scaledWidth = (printableHeight * canvas.width) / canvas.height;
      const xOffset = margin + (printableWidth - scaledWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, margin, scaledWidth, printableHeight);
    } else {
      // Very long statement: paginate cleanly across multiple A4 sheets
      const pxPerPage = Math.floor((printableHeight * canvas.width) / contentWidth);
      let renderedHeightPx = 0;
      let subPageIdx = 0;

      while (renderedHeightPx < canvas.height) {
        if (subPageIdx > 0) {
          pdf.addPage();
        }
        const sliceHeightPx = Math.min(pxPerPage, canvas.height - renderedHeightPx);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            renderedHeightPx,
            canvas.width,
            sliceHeightPx,
            0,
            0,
            canvas.width,
            sliceHeightPx
          );
          const sliceImg = pageCanvas.toDataURL('image/png');
          const sliceMmHeight = (sliceHeightPx * contentWidth) / canvas.width;
          pdf.addImage(sliceImg, 'PNG', margin, margin, contentWidth, sliceMmHeight);
        }
        renderedHeightPx += sliceHeightPx;
        subPageIdx += 1;
      }
    }
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

function sanitizeFileSlug(text: string): string {
  return (
    text
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'Staff'
  );
}

/**
 * Exports a single staff member's official A4 Salary Slip PDF for the selected date range.
 */
export async function downloadSingleStaffSalarySlipPdf(
  row: StaffPeriodReportRow,
  startDate: string,
  endDate: string,
  state: AppState
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const html = buildStaffSalarySlipHtml(row, startDate, endDate, state);
    await appendHtmlPageToPdf(pdf, html, true);

    const periodTag =
      startDate && endDate
        ? `${startDate}_to_${endDate}`
        : startDate || endDate || 'All-Dates';
    const filename = `Salary-Slip-${sanitizeFileSlug(row.staff.name)}-${periodTag}.pdf`;
    pdf.save(filename);
    return true;
  } catch (err) {
    console.error('Error generating single staff salary slip PDF:', err);
    return false;
  }
}

/**
 * Prints ONLY a single staff member's official A4 Salary Slip document (excluding webpage UI).
 */
export function printSingleStaffSalarySlip(
  row: StaffPeriodReportRow,
  startDate: string,
  endDate: string,
  state: AppState
): boolean {
  const html = buildStaffSalarySlipHtml(row, startDate, endDate, state);
  return printHtmlDocument(html, {
    title: `Salary Slip - ${row.staff.name}`,
    orientation: 'portrait'
  });
}

/**
 * Exports a multi-page A4 PDF containing individual Staff Salary Slips for all provided staff rows.
 */
export async function downloadBatchStaffSalarySlipsPdf(
  rows: StaffPeriodReportRow[],
  startDate: string,
  endDate: string,
  state: AppState
): Promise<boolean> {
  if (typeof window === 'undefined' || rows.length === 0) return false;
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    for (let i = 0; i < rows.length; i++) {
      const html = buildStaffSalarySlipHtml(rows[i], startDate, endDate, state);
      await appendHtmlPageToPdf(pdf, html, i === 0);
    }

    const periodTag =
      startDate && endDate
        ? `${startDate}_to_${endDate}`
        : startDate || endDate || 'All-Dates';
    pdf.save(`Staff-Salary-Slips-${periodTag}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generating batch staff salary slips PDF:', err);
    return false;
  }
}

function buildStaffPayrollSummaryHtml(
  rows: StaffPeriodReportRow[],
  totals: StaffPeriodReportTotals,
  startDate: string,
  endDate: string,
  state: AppState
): string {
  const periodLabel = formatPeriodLabel(startDate, endDate);
  const issueDate = formatDisplayDate(new Date().toISOString().slice(0, 10));
  const businessName = state.settings.name || 'IPPAS FOOD SERVICE & EVENTS';

  const tableRowsHtml =
    rows.length > 0
      ? rows
          .map(
            (r, idx) => `
              <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                <td style="padding: 8px 7px;">
                  <div style="font-weight: 700; color: #0f172a;">${escapeHtml(r.staff.name)}</div>
                  <div style="font-size: 0.7rem; color: #64748b;">
                    ${escapeHtml(r.staff.role_title || 'Crew')} &bull; ₹${Number(r.staff.hourly_rate || 0).toLocaleString('en-IN')}/hr
                  </div>
                </td>
                <td style="padding: 8px 7px; text-align: center; font-weight: 600; color: #334155;">
                  ${r.attendedShiftsCount}
                </td>
                <td style="padding: 8px 7px; text-align: center; font-weight: 700; color: #0f172a;">
                  ${r.totalHoursWorked} hrs
                </td>
                <td style="padding: 8px 7px; text-align: right; color: #334155;">
                  ₹${r.shiftEarnings.toLocaleString('en-IN')}
                </td>
                <td style="padding: 8px 7px; text-align: right; color: #1d4ed8;">
                  ₹${r.extraEarnings.toLocaleString('en-IN')}
                </td>
                <td style="padding: 8px 7px; text-align: right; font-weight: 700; color: #0f172a;">
                  ₹${r.totalEarnings.toLocaleString('en-IN')}
                </td>
                <td style="padding: 8px 7px; text-align: right; font-weight: 700; color: #059669;">
                  ₹${r.paymentsReceived.toLocaleString('en-IN')}
                </td>
                <td style="padding: 8px 7px; text-align: right; font-weight: 800; color: ${r.periodPayable > 0 ? '#dc2626' : '#059669'};">
                  ₹${r.periodPayable.toLocaleString('en-IN')}
                </td>
              </tr>
            `
          )
          .join('')
      : `
        <tr>
          <td colspan="8" style="padding: 16px; text-align: center; color: #64748b;">
            No staff records match the selected period.
          </td>
        </tr>
      `;

  const html = `
    <div style="width: 794px; min-height: 1100px; padding: 34px 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="/logo.png" alt="Logo" style="height: 54px; width: auto; object-fit: contain; display: block;" />
            <div>
              <div style="font-weight: 800; font-size: 1.12rem; color: #0f172a;">
                ${escapeHtml(businessName)}
              </div>
              <div style="font-size: 0.76rem; color: #64748b;">
                Phone: ${escapeHtml(state.settings.phone || '+91 98470 11111')} &bull; Email: ${escapeHtml(state.settings.email || 'events@ippas.com')}
              </div>
            </div>
          </div>

          <div style="text-align: right;">
            <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 1.55rem; font-weight: 700; color: #0f172a;">
              STAFF PAYROLL REPORT
            </div>
            <div style="font-size: 0.8rem; font-weight: 700; color: #e11d48; margin-top: 3px;">
              Period: ${escapeHtml(periodLabel)}
            </div>
            <div style="font-size: 0.73rem; color: #64748b;">
              Generated: ${escapeHtml(issueDate)}
            </div>
          </div>
        </div>

        <!-- Aggregate KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
          <div style="border: 1px solid #cbd5e1; border-left: 4px solid #475569; border-radius: 6px; padding: 10px 12px;">
            <div style="font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Hours Worked</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-top: 2px;">${totals.totalHoursWorked} hrs</div>
            <div style="font-size: 0.7rem; color: #64748b;">${totals.attendedShiftsCount} attended shifts</div>
          </div>

          <div style="border: 1px solid #bfdbfe; border-left: 4px solid #2563eb; border-radius: 6px; padding: 10px 12px; background: #eff6ff;">
            <div style="font-size: 0.7rem; font-weight: 700; color: #1e40af; text-transform: uppercase;">Total Earnings</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: #1e3a8a; margin-top: 2px;">₹${totals.totalEarnings.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.7rem; color: #1e40af;">${totals.staffCount} staff summarized</div>
          </div>

          <div style="border: 1px solid #a7f3d0; border-left: 4px solid #059669; border-radius: 6px; padding: 10px 12px; background: #ecfdf5;">
            <div style="font-size: 0.7rem; font-weight: 700; color: #065f46; text-transform: uppercase;">Payments Received</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: #059669; margin-top: 2px;">₹${totals.paymentsReceived.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.7rem; color: #065f46;">${totals.paymentCount} disbursements</div>
          </div>

          <div style="border: 1px solid ${totals.periodPayable > 0 ? '#fecaca' : '#cbd5e1'}; border-left: 4px solid ${totals.periodPayable > 0 ? '#dc2626' : '#059669'}; border-radius: 6px; padding: 10px 12px; background: ${totals.periodPayable > 0 ? '#fef2f2' : '#f8fafc'};">
            <div style="font-size: 0.7rem; font-weight: 700; color: ${totals.periodPayable > 0 ? '#991b1b' : '#334155'}; text-transform: uppercase;">Net Period Payable</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: ${totals.periodPayable > 0 ? '#dc2626' : '#059669'}; margin-top: 2px;">₹${totals.periodPayable.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.7rem; color: #64748b;">Unpaid period balance</div>
          </div>
        </div>

        <!-- Summary Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 8px 7px; text-align: left;">Staff Member</th>
              <th style="padding: 8px 7px; text-align: center;">Shifts</th>
              <th style="padding: 8px 7px; text-align: center;">Hours</th>
              <th style="padding: 8px 7px; text-align: right;">Shift Pay</th>
              <th style="padding: 8px 7px; text-align: right;">Allowances</th>
              <th style="padding: 8px 7px; text-align: right;">Total Earned</th>
              <th style="padding: 8px 7px; text-align: right;">Paid</th>
              <th style="padding: 8px 7px; text-align: right;">Payable</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; border-top: 2px solid #0f172a; font-weight: 800;">
              <td style="padding: 9px 7px;">TOTAL (${rows.length} Staff)</td>
              <td style="padding: 9px 7px; text-align: center;">${totals.attendedShiftsCount}</td>
              <td style="padding: 9px 7px; text-align: center;">${totals.totalHoursWorked} hrs</td>
              <td style="padding: 9px 7px; text-align: right;">₹${totals.shiftEarnings.toLocaleString('en-IN')}</td>
              <td style="padding: 9px 7px; text-align: right;">₹${totals.extraEarnings.toLocaleString('en-IN')}</td>
              <td style="padding: 9px 7px; text-align: right;">₹${totals.totalEarnings.toLocaleString('en-IN')}</td>
              <td style="padding: 9px 7px; text-align: right; color: #059669;">₹${totals.paymentsReceived.toLocaleString('en-IN')}</td>
              <td style="padding: 9px 7px; text-align: right; color: ${totals.periodPayable > 0 ? '#dc2626' : '#059669'};">₹${totals.periodPayable.toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 20px; margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 0.76rem; color: #64748b;">
        <div>
          Note: Shift hours and shift earnings include only shifts marked Present on active events.
        </div>
        <div style="text-align: center;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 20px;">For ${escapeHtml(businessName)}</div>
          <div style="width: 170px; border-top: 1px dashed #94a3b8; padding-top: 5px;">Authorized Signatory</div>
        </div>
      </div>
    </div>
  `;
  return html;
}

/**
 * Prints ONLY the standalone A4 Staff Payroll Summary Report (excluding webpage UI).
 */
export function printStaffPayrollSummaryReport(
  rows: StaffPeriodReportRow[],
  totals: StaffPeriodReportTotals,
  startDate: string,
  endDate: string,
  state: AppState
): boolean {
  const html = buildStaffPayrollSummaryHtml(rows, totals, startDate, endDate, state);
  return printHtmlDocument(html, {
    title: `Staff Payroll Report - ${formatPeriodLabel(startDate, endDate)}`,
    orientation: 'portrait'
  });
}

/**
 * Exports a consolidated A4 Master Staff Payroll & Earnings Summary PDF for the selected date range.
 */
export async function downloadStaffPayrollSummaryPdf(
  rows: StaffPeriodReportRow[],
  totals: StaffPeriodReportTotals,
  startDate: string,
  endDate: string,
  state: AppState
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const html = buildStaffPayrollSummaryHtml(rows, totals, startDate, endDate, state);

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    await appendHtmlPageToPdf(pdf, html, true);
    const periodTag =
      startDate && endDate
        ? `${startDate}_to_${endDate}`
        : startDate || endDate || 'All-Dates';
    pdf.save(`Staff-Payroll-Report-${periodTag}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generating payroll summary PDF:', err);
    return false;
  }
}
