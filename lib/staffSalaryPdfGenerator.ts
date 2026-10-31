import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  AppState,
  calculateMonthlySalaryMonthsCount,
  formatStaffSalaryRate,
  formatStaffSalaryTypeLabel,
  getStaffSalaryType,
  isSalaryAdvanceRecord,
  store
} from '@/lib/store';
import {
  EventRecord,
  Shift,
  ShiftAttendanceStatus,
  StaffMember,
  StaffSalaryRecord,
  StaffSalaryType
} from '@/lib/types';
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
  salaryType: StaffSalaryType;
  rateLabel: string;
  attendanceStatus: ShiftAttendanceStatus;
  isAttended: boolean;
  earnedAmount: number;
}

export interface StaffPeriodReportRow {
  staff: StaffMember;
  salaryType: StaffSalaryType;
  rateDisplay: string;
  monthlyMonthsCount: number;
  monthlyBaseEarnings: number;
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
  regularPaymentRecords: StaffSalaryRecord[];
  advancePaymentRecords: StaffSalaryRecord[];
  paymentRecords: StaffSalaryRecord[];
  regularPaymentsReceived: number;
  advancesReceived: number;
  paymentsReceived: number;
  periodNetBalance: number;
  periodPayable: number;
  periodAdvanceExcess: number;
  overallBalancePayable: number;
  hasActivityInRange: boolean;
}

export interface StaffPeriodReportTotals {
  staffCount: number;
  activeStaffInPeriod: number;
  attendedShiftsCount: number;
  totalHoursWorked: number;
  shiftEarnings: number;
  monthlyBaseEarnings: number;
  extraEarnings: number;
  totalEarnings: number;
  regularPaymentsReceived: number;
  advancesReceived: number;
  paymentsReceived: number;
  paymentCount: number;
  advanceCount: number;
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
 * Honors each staff member's salary structure (Per Hour, Per Event, Monthly Fixed) and separates
 * Salary Advances from Standard Salary Payouts.
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
  const effectiveStart =
    startDate && endDate && startDate > endDate ? endDate : startDate;
  const effectiveEnd =
    startDate && endDate && startDate > endDate ? startDate : endDate;

  const targetStaffList = staffIdFilter
    ? state.staff.filter((s) => s.id === staffIdFilter)
    : state.staff;

  const rows: StaffPeriodReportRow[] = targetStaffList.map((staff) => {
    const salaryType = getStaffSalaryType(staff);
    const rateDisplay = formatStaffSalaryRate(staff);
    const hourlyRate = Number(staff.hourly_rate || 0);
    const eventRate = Number(staff.event_rate ?? staff.hourly_rate ?? 0);
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

        let earnedAmount = 0;
        let rateLabel = `₹${hourlyRate.toLocaleString('en-IN')}/hr`;
        if (salaryType === 'per_event') {
          earnedAmount = isAttended ? Math.round(eventRate) : 0;
          rateLabel = `₹${eventRate.toLocaleString('en-IN')}/event`;
        } else if (salaryType === 'monthly') {
          earnedAmount = 0;
          rateLabel = 'Monthly Fixed';
        } else {
          earnedAmount = isAttended ? Math.round(hours * hourlyRate) : 0;
        }

        return {
          shift: sh,
          event,
          date,
          hours,
          hourlyRate,
          salaryType,
          rateLabel,
          attendanceStatus,
          isAttended,
          earnedAmount
        };
      })
      .filter(
        (entry) =>
          (!entry.event || entry.event.status !== 'cancelled') &&
          isDateWithinRange(entry.date, effectiveStart, effectiveEnd)
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const attendedShifts = allShiftsInRange.filter((s) => s.isAttended);
    const attendedShiftsCount = attendedShifts.length;
    const absentShiftsCount = allShiftsInRange.filter((s) => s.attendanceStatus === 'absent').length;
    const pendingShiftsCount = allShiftsInRange.filter((s) => s.attendanceStatus === 'pending').length;

    const totalHoursWorked = Number(
      attendedShifts.reduce((sum, s) => sum + s.hours, 0).toFixed(2)
    );
    const shiftEarnings = attendedShifts.reduce((sum, s) => sum + s.earnedAmount, 0);

    const monthlyMonthsCount =
      salaryType === 'monthly'
        ? calculateMonthlySalaryMonthsCount(
            staff,
            state.shifts,
            state.staffSalaryRecords || [],
            effectiveStart,
            effectiveEnd
          )
        : 0;
    const monthlyBaseEarnings =
      salaryType === 'monthly'
        ? Math.round(monthlyMonthsCount * Number(staff.monthly_salary ?? staff.hourly_rate ?? 0))
        : 0;

    const recordsInRange = (state.staffSalaryRecords || []).filter(
      (rec) =>
        rec.staff_member_id === staff.id &&
        isDateWithinRange((rec.recorded_at || '').slice(0, 10), effectiveStart, effectiveEnd)
    );

    const allowanceRecords = recordsInRange
      .filter((r) => r.record_type === 'earning')
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

    const advancePaymentRecords = recordsInRange
      .filter((r) => r.record_type !== 'earning' && isSalaryAdvanceRecord(r))
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

    const regularPaymentRecords = recordsInRange
      .filter((r) => r.record_type === 'payment' && !isSalaryAdvanceRecord(r))
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

    const paymentRecords = [...regularPaymentRecords, ...advancePaymentRecords].sort((a, b) =>
      a.recorded_at.localeCompare(b.recorded_at)
    );

    const extraEarnings = allowanceRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const totalEarnings = shiftEarnings + monthlyBaseEarnings + extraEarnings;
    const regularPaymentsReceived = regularPaymentRecords.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );
    const advancesReceived = advancePaymentRecords.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );
    const paymentsReceived = regularPaymentsReceived + advancesReceived;

    const periodNetBalance = totalEarnings - paymentsReceived;
    const periodPayable = Math.max(0, periodNetBalance);
    const periodAdvanceExcess = Math.max(0, paymentsReceived - totalEarnings);

    const hasActivityInRange =
      attendedShiftsCount > 0 ||
      monthlyBaseEarnings > 0 ||
      extraEarnings > 0 ||
      paymentsReceived > 0 ||
      allShiftsInRange.length > 0;

    return {
      staff,
      salaryType,
      rateDisplay,
      monthlyMonthsCount,
      monthlyBaseEarnings,
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
      regularPaymentRecords,
      advancePaymentRecords,
      paymentRecords,
      regularPaymentsReceived,
      advancesReceived,
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
    monthlyBaseEarnings: rows.reduce((s, r) => s + r.monthlyBaseEarnings, 0),
    extraEarnings: rows.reduce((s, r) => s + r.extraEarnings, 0),
    totalEarnings: rows.reduce((s, r) => s + r.totalEarnings, 0),
    regularPaymentsReceived: rows.reduce((s, r) => s + r.regularPaymentsReceived, 0),
    advancesReceived: rows.reduce((s, r) => s + r.advancesReceived, 0),
    paymentsReceived: rows.reduce((s, r) => s + r.paymentsReceived, 0),
    paymentCount: rows.reduce((s, r) => s + r.regularPaymentRecords.length, 0),
    advanceCount: rows.reduce((s, r) => s + r.advancePaymentRecords.length, 0),
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
  const salaryStructureLabel = formatStaffSalaryTypeLabel(row.salaryType);

  const earningRowsList: string[] = [];

  if (row.salaryType === 'monthly' && row.monthlyBaseEarnings > 0) {
    earningRowsList.push(`
      <tr style="border-bottom: 1px solid #e2e8f0; background: #f5f3ff;">
        <td style="padding: 7px 8px; font-weight: 600; white-space: nowrap;">${escapeHtml(periodLabel)}</td>
        <td style="padding: 7px 8px;">
          <div style="font-weight: 700; color: #5b21b6;">Fixed Monthly Salary</div>
          <div style="font-size: 0.72rem; color: #64748b;">
            ${row.monthlyMonthsCount} active month${row.monthlyMonthsCount === 1 ? '' : 's'} in statement period
          </div>
        </td>
        <td style="padding: 7px 8px; text-align: center; color: #5b21b6; font-weight: 600;">
          ${row.monthlyMonthsCount} mo
        </td>
        <td style="padding: 7px 8px; text-align: right; color: #334155;">
          ${escapeHtml(row.rateDisplay)}
        </td>
        <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: #5b21b6;">
          ₹${row.monthlyBaseEarnings.toLocaleString('en-IN')}
        </td>
      </tr>
    `);
  }

  for (const entry of row.attendedShifts) {
    const timeSpan = `${(entry.shift.starts_at || '').slice(11, 16)} – ${(entry.shift.ends_at || '').slice(11, 16)}`;
    earningRowsList.push(`
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
          ${escapeHtml(entry.rateLabel)}
        </td>
        <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: #0f172a;">
          ${row.salaryType === 'monthly' ? 'Included' : `₹${entry.earnedAmount.toLocaleString('en-IN')}`}
        </td>
      </tr>
    `);
  }

  for (const rec of row.allowanceRecords) {
    const linkedEvt = rec.event_id
      ? state.events.find((e) => e.id === rec.event_id)
      : undefined;
    earningRowsList.push(`
      <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
        <td style="padding: 7px 8px; font-weight: 600; white-space: nowrap;">${escapeHtml(formatDisplayDate(rec.recorded_at))}</td>
        <td style="padding: 7px 8px;">
          <div style="font-weight: 600; color: #1d4ed8;">${escapeHtml(rec.method || 'Duty Allowance / Bonus')}</div>
          <div style="font-size: 0.72rem; color: #64748b;">
            ${escapeHtml(rec.note || (linkedEvt ? `Event: ${linkedEvt.title}` : 'Additional wage / allowance'))}
          </div>
        </td>
        <td style="padding: 7px 8px; text-align: center; color: #64748b;">Bonus</td>
        <td style="padding: 7px 8px; text-align: right; color: #64748b;">Allowance</td>
        <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: #1d4ed8;">
          ₹${Number(rec.amount || 0).toLocaleString('en-IN')}
        </td>
      </tr>
    `);
  }

  const earningRowsHtml =
    earningRowsList.length > 0
      ? earningRowsList.join('')
      : `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td colspan="5" style="padding: 12px 8px; text-align: center; color: #64748b; font-size: 0.8rem;">
            No attended shifts, monthly base salary, or extra wage entries recorded during this period.
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
            const isAdv = isSalaryAdvanceRecord(pay);
            return `
              <tr style="border-bottom: 1px solid #e2e8f0; background: ${isAdv ? '#fffbeb' : '#ffffff'};">
                <td style="padding: 7px 8px; font-weight: 600; white-space: nowrap;">${escapeHtml(formatDisplayDate(pay.recorded_at))}</td>
                <td style="padding: 7px 8px; font-weight: 700; color: ${isAdv ? '#b45309' : '#047857'};">
                  ${isAdv ? 'Salary Advance' : 'Standard Salary Payout'}
                </td>
                <td style="padding: 7px 8px; font-weight: 600; color: #0f172a;">${escapeHtml(pay.method || 'Cash / UPI')}</td>
                <td style="padding: 7px 8px; color: #475569;">
                  ${escapeHtml(pay.note || (linkedEvt ? `For ${linkedEvt.title}` : isAdv ? 'Advance against salary' : 'Salary disbursement'))}
                </td>
                <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: ${isAdv ? '#b45309' : '#059669'};">
                  ₹${Number(pay.amount || 0).toLocaleString('en-IN')}
                </td>
              </tr>
            `;
          })
          .join('')
      : `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td colspan="5" style="padding: 12px 8px; text-align: center; color: #64748b; font-size: 0.8rem;">
            No salary payouts or advances recorded during this period.
          </td>
        </tr>
      `;

  const isPeriodSettled = row.periodPayable === 0;

  return `
    <div style="width: 794px; min-height: 1100px; padding: 34px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; font-variant-numeric: tabular-nums;">
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
                ${escapeHtml(state.settings.address || 'Outdoor Catering • Event Management • Calicut')}
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
            <div style="font-size: 0.7rem; font-weight: 700; letter-spacing: 0.4px; color: #64748b; margin-bottom: 2px;">
              Staff / Crew Member Details
            </div>
            <div style="font-size: 1.02rem; font-weight: 800; color: #0f172a;">
              ${escapeHtml(row.staff.name)}
            </div>
            <div><strong>Designation / Role:</strong> ${escapeHtml(row.staff.role_title || 'Service Crew')}</div>
            <div><strong>Mobile Number:</strong> ${escapeHtml(row.staff.phone || '—')}</div>
            <div><strong>Salary Structure:</strong> ${escapeHtml(salaryStructureLabel)} (${escapeHtml(row.rateDisplay)})</div>
          </div>

          <div style="text-align: right; font-size: 0.83rem; line-height: 1.6;">
            <div style="font-size: 0.7rem; font-weight: 700; letter-spacing: 0.4px; color: #64748b; margin-bottom: 2px;">
              Statement Period
            </div>
            <div style="font-size: 0.94rem; font-weight: 800; color: #0f172a;">
              ${escapeHtml(periodLabel)}
            </div>
            <div><strong>Attended Shifts:</strong> ${row.attendedShiftsCount} shift${row.attendedShiftsCount === 1 ? '' : 's'} (${row.totalHoursWorked} hrs)</div>
            <div><strong>Status:</strong> <span style="font-weight: 800; color: ${isPeriodSettled ? '#15803d' : '#b91c1c'};">${isPeriodSettled ? 'Period Settled' : 'Balance Payable'}</span></div>
          </div>
        </div>

        <!-- 5 Summary Highlight Boxes (Separating Standard Salary Paid & Salary Advances) -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px;">
          <div style="border: 1px solid #cbd5e1; border-top: 3px solid #475569; border-radius: 6px; padding: 9px 10px; background: #ffffff;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #64748b;">Attendance</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-top: 2px;">${row.totalHoursWorked} hrs</div>
            <div style="font-size: 0.68rem; color: #64748b;">${row.attendedShiftsCount} present shift${row.attendedShiftsCount === 1 ? '' : 's'}</div>
          </div>

          <div style="border: 1px solid #bfdbfe; border-top: 3px solid #2563eb; border-radius: 6px; padding: 9px 10px; background: #eff6ff;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #1e40af;">Total Earnings</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #1e3a8a; margin-top: 2px;">₹${row.totalEarnings.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.68rem; color: #1e40af;">${escapeHtml(salaryStructureLabel)} + Bonus</div>
          </div>

          <div style="border: 1px solid #a7f3d0; border-top: 3px solid #059669; border-radius: 6px; padding: 9px 10px; background: #ecfdf5;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #065f46;">Salary Paid</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #059669; margin-top: 2px;">₹${row.regularPaymentsReceived.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.68rem; color: #065f46;">${row.regularPaymentRecords.length} standard payout${row.regularPaymentRecords.length === 1 ? '' : 's'}</div>
          </div>

          <div style="border: 1px solid #fde68a; border-top: 3px solid #d97706; border-radius: 6px; padding: 9px 10px; background: #fffbeb;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #b45309;">Salary Advance</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #d97706; margin-top: 2px;">₹${row.advancesReceived.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.68rem; color: #b45309;">${row.advancePaymentRecords.length} advance${row.advancePaymentRecords.length === 1 ? '' : 's'}</div>
          </div>

          <div style="border: 1px solid ${row.periodPayable > 0 ? '#fecaca' : '#cbd5e1'}; border-top: 3px solid ${row.periodPayable > 0 ? '#dc2626' : '#059669'}; border-radius: 6px; padding: 9px 10px; background: ${row.periodPayable > 0 ? '#fef2f2' : '#f8fafc'};">
            <div style="font-size: 0.68rem; font-weight: 700; color: ${row.periodPayable > 0 ? '#991b1b' : '#334155'};">
              ${row.periodAdvanceExcess > 0 ? 'Advance Excess' : 'Net Payable'}
            </div>
            <div style="font-size: 1.05rem; font-weight: 800; color: ${row.periodPayable > 0 ? '#dc2626' : '#059669'}; margin-top: 2px;">
              ₹${(row.periodAdvanceExcess > 0 ? row.periodAdvanceExcess : row.periodPayable).toLocaleString('en-IN')}
            </div>
            <div style="font-size: 0.68rem; color: #64748b;">
              ${row.periodPayable > 0 ? 'Balance due' : row.periodAdvanceExcess > 0 ? 'Overpaid / Advance' : 'Settled'}
            </div>
          </div>
        </div>

        <!-- Earnings Breakdown Table -->
        <div style="margin-bottom: 18px;">
          <div style="font-size: 0.82rem; font-weight: 800; letter-spacing: 0.3px; color: #0f172a; margin-bottom: 6px;">
            1. Salary, Attended Shifts &amp; Allowances Breakdown
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff;">
                <th style="padding: 7px 8px; text-align: left; width: 105px;">Date / Period</th>
                <th style="padding: 7px 8px; text-align: left;">Event / Salary Description</th>
                <th style="padding: 7px 8px; text-align: center; width: 85px;">Units</th>
                <th style="padding: 7px 8px; text-align: right; width: 105px;">Rate</th>
                <th style="padding: 7px 8px; text-align: right; width: 105px;">Earned (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${earningRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Payments & Advances Breakdown Table -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 0.82rem; font-weight: 800; letter-spacing: 0.3px; color: #0f172a; margin-bottom: 6px;">
            2. Standard Salary Payouts &amp; Salary Advances Received
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #f1f5f9; color: #0f172a; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 7px 8px; text-align: left; width: 100px;">Date</th>
                <th style="padding: 7px 8px; text-align: left; width: 155px;">Payout Type</th>
                <th style="padding: 7px 8px; text-align: left; width: 120px;">Method</th>
                <th style="padding: 7px 8px; text-align: left;">Reference / Note</th>
                <th style="padding: 7px 8px; text-align: right; width: 110px;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${paymentRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Net Salary Calculation Box -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
          <div style="width: 370px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; background: #f8fafc; font-size: 0.83rem;">
            ${
              row.salaryType === 'monthly'
                ? `
                  <div style="display: flex; justify-content: space-between; padding: 3px 0;">
                    <span style="color: #475569;">Monthly Fixed Salary (${row.monthlyMonthsCount} mo):</span>
                    <span style="font-weight: 600;">₹${row.monthlyBaseEarnings.toLocaleString('en-IN')}</span>
                  </div>
                `
                : `
                  <div style="display: flex; justify-content: space-between; padding: 3px 0;">
                    <span style="color: #475569;">${row.salaryType === 'per_event' ? `Event Wages (${row.attendedShiftsCount} events)` : `Shift Wages (${row.totalHoursWorked} hrs)`}:</span>
                    <span style="font-weight: 600;">₹${row.shiftEarnings.toLocaleString('en-IN')}</span>
                  </div>
                `
            }
            <div style="display: flex; justify-content: space-between; padding: 3px 0;">
              <span style="color: #475569;">Duty Allowances / Bonuses:</span>
              <span style="font-weight: 600;">₹${row.extraEarnings.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-top: 1px solid #cbd5e1; margin-top: 4px; font-weight: 700; color: #0f172a;">
              <span>Gross Period Earnings:</span>
              <span>₹${row.totalEarnings.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 3px 0; color: #059669; font-weight: 700;">
              <span>Less: Standard Salary Payouts:</span>
              <span>- ₹${row.regularPaymentsReceived.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 3px 0; color: #b45309; font-weight: 700;">
              <span>Less: Salary Advances Deducted:</span>
              <span>- ₹${row.advancesReceived.toLocaleString('en-IN')}</span>
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
      const imgData = canvas.toDataURL('image/png');
      const scaledWidth = (printableHeight * canvas.width) / canvas.height;
      const xOffset = margin + (printableWidth - scaledWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, margin, scaledWidth, printableHeight);
    } else {
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

export async function generateSingleStaffSalarySlipPdfBlob(
  row: StaffPeriodReportRow,
  startDate: string,
  endDate: string,
  state: AppState
): Promise<{ blob: Blob; file: File; filename: string } | null> {
  if (typeof window === 'undefined') return null;
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
    const blob = pdf.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    return { blob, file, filename };
  } catch (err) {
    console.error('Error generating single staff salary slip PDF blob:', err);
    return null;
  }
}

export function formatStaffSalarySlipWhatsAppMessage(
  row: StaffPeriodReportRow,
  startDate: string,
  endDate: string,
  state: AppState
): string {
  const businessName = state.settings?.name || 'IPPAS FOOD SERVICE & EVENTS';
  const periodLabel = formatPeriodLabel(startDate, endDate);
  const salaryStructureLabel = formatStaffSalaryTypeLabel(row.salaryType);

  const lines: string[] = [
    `🧾 *${businessName}*`,
    `Outdoor Catering • Event Management • Calicut`,
    ``,
    `*STAFF SALARY SLIP*`,
    `👤 *Name:* ${row.staff.name} (${row.staff.role_title || 'Service Crew'})`,
    `💼 *Salary Plan:* ${salaryStructureLabel} (${row.rateDisplay})`,
    `📅 *Period:* ${periodLabel}`,
    `⏱ *Attended Shifts:* ${row.attendedShiftsCount} (${row.totalHoursWorked} hrs)`,
    ``
  ];

  if (row.salaryType === 'monthly') {
    lines.push(
      `🏢 *Monthly Fixed Salary (${row.monthlyMonthsCount} mo):* ₹${row.monthlyBaseEarnings.toLocaleString('en-IN')}`
    );
  } else {
    lines.push(
      `💼 *${row.salaryType === 'per_event' ? 'Event Wages' : 'Shift Wages'}:* ₹${row.shiftEarnings.toLocaleString('en-IN')}`
    );
  }

  if (row.extraEarnings > 0) {
    lines.push(`🎁 *Allowances / Bonus:* ₹${row.extraEarnings.toLocaleString('en-IN')}`);
  }

  lines.push(
    `💰 *Total Earned:* ₹${row.totalEarnings.toLocaleString('en-IN')}`,
    `✅ *Standard Salary Paid:* ₹${row.regularPaymentsReceived.toLocaleString('en-IN')}`,
    `⚡ *Salary Advances:* ₹${row.advancesReceived.toLocaleString('en-IN')}`,
    row.periodPayable > 0
      ? `⏳ *Period Balance Payable:* ₹${row.periodPayable.toLocaleString('en-IN')}`
      : `🎉 *Status:* Period Settled`
  );

  lines.push(
    ``,
    `Please find your itemized A4 Salary Slip PDF attached herewith.`,
    `📞 ${state.settings?.phone || '+91 98470 11111'}`
  );

  return lines.join('\n');
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
  const res = await generateSingleStaffSalarySlipPdfBlob(row, startDate, endDate, state);
  if (!res) return false;
  const url = URL.createObjectURL(res.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
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
                <td style="padding: 8px 6px;">
                  <div style="font-weight: 700; color: #0f172a;">${escapeHtml(r.staff.name)}</div>
                  <div style="font-size: 0.69rem; color: #64748b;">
                    ${escapeHtml(r.staff.role_title || 'Crew')} &bull; ${escapeHtml(formatStaffSalaryTypeLabel(r.salaryType))} (${escapeHtml(r.rateDisplay)})
                  </div>
                </td>
                <td style="padding: 8px 6px; text-align: center; font-weight: 600; color: #334155;">
                  ${r.attendedShiftsCount} (${r.totalHoursWorked}h)
                </td>
                <td style="padding: 8px 6px; text-align: right; color: #334155;">
                  ₹${(r.shiftEarnings + r.monthlyBaseEarnings).toLocaleString('en-IN')}
                </td>
                <td style="padding: 8px 6px; text-align: right; color: #1d4ed8;">
                  ₹${r.extraEarnings.toLocaleString('en-IN')}
                </td>
                <td style="padding: 8px 6px; text-align: right; font-weight: 700; color: #0f172a;">
                  ₹${r.totalEarnings.toLocaleString('en-IN')}
                </td>
                <td style="padding: 8px 6px; text-align: right; font-weight: 700; color: #059669;">
                  ₹${r.regularPaymentsReceived.toLocaleString('en-IN')}
                </td>
                <td style="padding: 8px 6px; text-align: right; font-weight: 700; color: #b45309;">
                  ₹${r.advancesReceived.toLocaleString('en-IN')}
                </td>
                <td style="padding: 8px 6px; text-align: right; font-weight: 800; color: ${r.periodPayable > 0 ? '#dc2626' : '#059669'};">
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

  return `
    <div style="width: 794px; min-height: 1100px; padding: 34px 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; font-variant-numeric: tabular-nums;">
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
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px;">
          <div style="border: 1px solid #cbd5e1; border-top: 3px solid #475569; border-radius: 6px; padding: 9px 10px;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #64748b;">Total Hours</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-top: 2px;">${totals.totalHoursWorked} hrs</div>
            <div style="font-size: 0.68rem; color: #64748b;">${totals.attendedShiftsCount} attended shifts</div>
          </div>

          <div style="border: 1px solid #bfdbfe; border-top: 3px solid #2563eb; border-radius: 6px; padding: 9px 10px; background: #eff6ff;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #1e40af;">Total Earnings</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #1e3a8a; margin-top: 2px;">₹${totals.totalEarnings.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.68rem; color: #1e40af;">${totals.staffCount} staff summarized</div>
          </div>

          <div style="border: 1px solid #a7f3d0; border-top: 3px solid #059669; border-radius: 6px; padding: 9px 10px; background: #ecfdf5;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #065f46;">Salary Paid</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #059669; margin-top: 2px;">₹${totals.regularPaymentsReceived.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.68rem; color: #065f46;">${totals.paymentCount} standard payouts</div>
          </div>

          <div style="border: 1px solid #fde68a; border-top: 3px solid #d97706; border-radius: 6px; padding: 9px 10px; background: #fffbeb;">
            <div style="font-size: 0.68rem; font-weight: 700; color: #b45309;">Salary Advances</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #d97706; margin-top: 2px;">₹${totals.advancesReceived.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.68rem; color: #b45309;">${totals.advanceCount} advance payouts</div>
          </div>

          <div style="border: 1px solid ${totals.periodPayable > 0 ? '#fecaca' : '#cbd5e1'}; border-top: 3px solid ${totals.periodPayable > 0 ? '#dc2626' : '#059669'}; border-radius: 6px; padding: 9px 10px; background: ${totals.periodPayable > 0 ? '#fef2f2' : '#f8fafc'};">
            <div style="font-size: 0.68rem; font-weight: 700; color: ${totals.periodPayable > 0 ? '#991b1b' : '#334155'};">Net Payable</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: ${totals.periodPayable > 0 ? '#dc2626' : '#059669'}; margin-top: 2px;">₹${totals.periodPayable.toLocaleString('en-IN')}</div>
            <div style="font-size: 0.68rem; color: #64748b;">Unpaid period balance</div>
          </div>
        </div>

        <!-- Summary Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 0.76rem; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 8px 6px; text-align: left;">Staff Member &amp; Plan</th>
              <th style="padding: 8px 6px; text-align: center;">Shifts</th>
              <th style="padding: 8px 6px; text-align: right;">Base / Shift</th>
              <th style="padding: 8px 6px; text-align: right;">Bonus</th>
              <th style="padding: 8px 6px; text-align: right;">Total Earned</th>
              <th style="padding: 8px 6px; text-align: right;">Salary Paid</th>
              <th style="padding: 8px 6px; text-align: right;">Advance</th>
              <th style="padding: 8px 6px; text-align: right;">Payable</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; border-top: 2px solid #0f172a; font-weight: 800;">
              <td style="padding: 9px 6px;">TOTAL (${rows.length} Staff)</td>
              <td style="padding: 9px 6px; text-align: center;">${totals.attendedShiftsCount} (${totals.totalHoursWorked}h)</td>
              <td style="padding: 9px 6px; text-align: right;">₹${(totals.shiftEarnings + totals.monthlyBaseEarnings).toLocaleString('en-IN')}</td>
              <td style="padding: 9px 6px; text-align: right;">₹${totals.extraEarnings.toLocaleString('en-IN')}</td>
              <td style="padding: 9px 6px; text-align: right;">₹${totals.totalEarnings.toLocaleString('en-IN')}</td>
              <td style="padding: 9px 6px; text-align: right; color: #059669;">₹${totals.regularPaymentsReceived.toLocaleString('en-IN')}</td>
              <td style="padding: 9px 6px; text-align: right; color: #b45309;">₹${totals.advancesReceived.toLocaleString('en-IN')}</td>
              <td style="padding: 9px 6px; text-align: right; color: ${totals.periodPayable > 0 ? '#dc2626' : '#059669'};">₹${totals.periodPayable.toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 20px; margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 0.75rem; color: #64748b;">
        <div>
          Note: Standard Salary Payouts and Salary Advances are tracked separately and both deducted from Gross Period Earnings.
        </div>
        <div style="text-align: center;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 20px;">For ${escapeHtml(businessName)}</div>
          <div style="width: 170px; border-top: 1px dashed #94a3b8; padding-top: 5px;">Authorized Signatory</div>
        </div>
      </div>
    </div>
  `;
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
