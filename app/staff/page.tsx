'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
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
  ShiftRateUpdateMode,
  StaffMember,
  StaffSalaryRecordType,
  StaffSalaryType
} from '@/lib/types';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';
import StaffWhatsAppModal from '@/components/StaffWhatsAppModal';
import SalarySlipWhatsAppModal from '@/components/SalarySlipWhatsAppModal';
import {
  computeStaffPeriodReport,
  downloadBatchStaffSalarySlipsPdf,
  downloadSingleStaffSalarySlipPdf,
  downloadStaffPayrollSummaryPdf,
  formatDisplayDate,
  formatPeriodLabel,
  printSingleStaffSalarySlip,
  printStaffPayrollSummaryReport,
  StaffPeriodReportRow
} from '@/lib/staffSalaryPdfGenerator';

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getInitialMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toLocalYmd(first), end: toLocalYmd(last) };
}

export default function StaffPage() {
  const [state, setState] = useState(store.getState());
  const [activeTab, setActiveTab] = useState<'crew' | 'attendance' | 'report'>('crew');
  const [search, setSearch] = useState('');
  const [crewFilter, setCrewFilter] = useState<'all' | 'due' | 'upcoming'>('all');

  // Add / Edit Staff Modal (with 3 Salary Structures decided on registration)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [shiftRateUpdateMode, setShiftRateUpdateMode] = useState<ShiftRateUpdateMode>('keep_existing');
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    unique_id: string;
    dob: string;
    phone: string;
    password: string;
    role_title: string;
    salary_type: StaffSalaryType;
    hourly_rate: number;
    event_rate: number;
    monthly_salary: number;
    salary_start_date: string;
    active: boolean;
  }>({
    name: '',
    unique_id: store.generateNextUniqueId('staff'),
    dob: '',
    phone: '',
    password: 'password123',
    role_title: 'Buffet Server',
    salary_type: 'hourly',
    hourly_rate: 200,
    event_rate: 1200,
    monthly_salary: 18000,
    salary_start_date: toLocalYmd(new Date()),
    active: true
  });

  // Admin 1-Click Staff Password Reset Modal
  const [resetPwStaff, setResetPwStaff] = useState<StaffMember | null>(null);
  const [resetPwValue, setResetPwValue] = useState('password123');
  const [resetPwBusy, setResetPwBusy] = useState(false);
  const [resetPwError, setResetPwError] = useState<string | null>(null);

  // Individual Staff Events & Ledger Modal (Upcoming vs Attended vs Salary & Advances)
  const [statementStaff, setStatementStaff] = useState<StaffMember | null>(null);
  const [statementTab, setStatementTab] = useState<'upcoming' | 'attended' | 'salary'>('upcoming');

  // Attendance Tab Filters
  const [attendanceEventFilter, setAttendanceEventFilter] = useState<string>('');
  const [attendanceTimeFilter, setAttendanceTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  // Date-Range Salary Report & Payslips State
  const initialBounds = getInitialMonthBounds();
  const [reportStartDate, setReportStartDate] = useState<string>(initialBounds.start);
  const [reportEndDate, setReportEndDate] = useState<string>(initialBounds.end);
  const [reportStaffFilter, setReportStaffFilter] = useState<string>('');
  const [reportSearch, setReportSearch] = useState<string>('');
  const [reportActiveInPeriodOnly, setReportActiveInPeriodOnly] = useState<boolean>(false);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'payment' | 'advance' | 'earning'>('all');
  const [previewSlipStaffId, setPreviewSlipStaffId] = useState<string | null>(null);
  const [waSlipRow, setWaSlipRow] = useState<StaffPeriodReportRow | null>(null);
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null);

  // Salary Payout / Salary Advance / Bonus Modal
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [salaryRecordType, setSalaryRecordType] = useState<StaffSalaryRecordType>('payment');
  const [salaryForm, setSalaryForm] = useState({
    staff_member_id: '',
    event_id: '',
    amount: 0,
    method: 'UPI / GPay',
    recorded_at: new Date().toISOString().slice(0, 10),
    note: ''
  });

  // Inline Delete Confirmations & Feedback Notice
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [confirmRemoveShiftId, setConfirmRemoveShiftId] = useState<string | null>(null);
  const [confirmDeleteSalaryId, setConfirmDeleteSalaryId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // WhatsApp Duty Notification Modal
  const [whatsAppModalEvent, setWhatsAppModalEvent] = useState<EventRecord | null>(null);
  const [whatsAppModalShift, setWhatsAppModalShift] = useState<Shift | null>(null);

  useEffect(() => {
    setState(store.getState());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const role = state.currentRole;
  const canEditStaff = role === 'owner' || role === 'manager' || role === 'super_admin';
  const canManageSalary =
    role === 'owner' || role === 'manager' || role === 'accountant' || role === 'super_admin';
  const canMarkAttendance =
    role === 'owner' || role === 'manager' || role === 'accountant' || role === 'super_admin';

  const todayYmd = toLocalYmd(new Date());

  // Summaries + Upcoming vs Attended event split per staff member
  const staffRows = state.staff.map((st) => {
    const summary = store.getStaffSalarySummary(st.id);

    const upcomingItems = summary.shiftItems
      .filter((si) => {
        if (!si.event || si.event.status === 'cancelled') return false;
        if (si.event.status === 'completed') return false;
        if (si.attendanceStatus === 'present' || si.attendanceStatus === 'absent') return false;
        return (
          si.event.event_date >= todayYmd ||
          si.event.status === 'confirmed' ||
          si.event.status === 'inquiry'
        );
      })
      .sort((a, b) => (a.event?.event_date || '').localeCompare(b.event?.event_date || ''));

    const attendedItems = summary.shiftItems
      .filter((si) => {
        if (!si.event || si.event.status === 'cancelled') return false;
        if (si.isAttended) return true;
        return (
          (si.event.status === 'completed' || si.event.event_date < todayYmd) &&
          si.attendanceStatus !== 'absent' &&
          !upcomingItems.some((u) => u.shift.id === si.shift.id)
        );
      })
      .sort((a, b) => (b.event?.event_date || '').localeCompare(a.event?.event_date || ''));

    return {
      staff: st,
      summary,
      upcomingItems,
      attendedItems
    };
  });

  const filteredStaffRows = staffRows.filter(({ staff, summary, upcomingItems }) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      staff.name.toLowerCase().includes(q) ||
      (staff.unique_id && staff.unique_id.toLowerCase().includes(q)) ||
      (staff.phone && staff.phone.toLowerCase().includes(q)) ||
      (staff.role_title && staff.role_title.toLowerCase().includes(q));
    if (!matchesSearch) return false;
    if (crewFilter === 'due') return summary.balancePayable > 0;
    if (crewFilter === 'upcoming') return upcomingItems.length > 0;
    return true;
  });

  const totalEarnedAll = staffRows.reduce((sum, r) => sum + r.summary.totalEarned, 0);
  const totalRegularPaidAll = staffRows.reduce((sum, r) => sum + r.summary.totalRegularPaid, 0);
  const totalAdvancePaidAll = staffRows.reduce((sum, r) => sum + r.summary.totalAdvancePaid, 0);
  const totalPendingAll = staffRows.reduce((sum, r) => sum + r.summary.balancePayable, 0);
  const activeCrewCount = state.staff.filter((s) => s.active).length;

  // Date-Range Payroll Report Calculation
  const periodReport = computeStaffPeriodReport(state, reportStartDate, reportEndDate);
  const filteredReportRows = periodReport.rows.filter((r) => {
    if (reportStaffFilter && r.staff.id !== reportStaffFilter) return false;
    if (reportActiveInPeriodOnly) {
      if (!r.hasActivityInRange) return false;
    }
    const q = reportSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      r.staff.name.toLowerCase().includes(q) ||
      (r.staff.unique_id && r.staff.unique_id.toLowerCase().includes(q)) ||
      (r.staff.phone && r.staff.phone.toLowerCase().includes(q)) ||
      (r.staff.role_title && r.staff.role_title.toLowerCase().includes(q))
    );
  });

  const filteredTotals = {
    staffCount: filteredReportRows.length,
    activeStaffInPeriod: filteredReportRows.filter((r) => r.hasActivityInRange).length,
    attendedShiftsCount: filteredReportRows.reduce((s, r) => s + r.attendedShiftsCount, 0),
    totalHoursWorked: Number(
      filteredReportRows.reduce((s, r) => s + r.totalHoursWorked, 0).toFixed(2)
    ),
    shiftEarnings: filteredReportRows.reduce((s, r) => s + r.shiftEarnings, 0),
    monthlyBaseEarnings: filteredReportRows.reduce((s, r) => s + r.monthlyBaseEarnings, 0),
    extraEarnings: filteredReportRows.reduce((s, r) => s + r.extraEarnings, 0),
    totalEarnings: filteredReportRows.reduce((s, r) => s + r.totalEarnings, 0),
    regularPaymentsReceived: filteredReportRows.reduce((s, r) => s + r.regularPaymentsReceived, 0),
    advancesReceived: filteredReportRows.reduce((s, r) => s + r.advancesReceived, 0),
    paymentsReceived: filteredReportRows.reduce((s, r) => s + r.paymentsReceived, 0),
    paymentCount: filteredReportRows.reduce((s, r) => s + r.regularPaymentRecords.length, 0),
    advanceCount: filteredReportRows.reduce((s, r) => s + r.advancePaymentRecords.length, 0),
    periodPayable: filteredReportRows.reduce((s, r) => s + r.periodPayable, 0)
  };

  const previewSlipRow = previewSlipStaffId
    ? periodReport.rows.find((r) => r.staff.id === previewSlipStaffId) || null
    : null;

  const resetStaffForm = () => ({
    name: '',
    unique_id: store.generateNextUniqueId('staff'),
    dob: '',
    phone: '',
    password: 'password123',
    role_title: 'Buffet Server',
    salary_type: 'hourly' as StaffSalaryType,
    hourly_rate: 200,
    event_rate: 1200,
    monthly_salary: 18000,
    salary_start_date: toLocalYmd(new Date()),
    active: true
  });

  // Handlers
  const handleSubmitStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffFormError(null);
    if (!formData.name.trim()) {
      setStaffFormError('Full name is required.');
      return;
    }

    const normalizedUid = store.normalizeUniqueId(formData.unique_id);
    if (!normalizedUid) {
      setStaffFormError('Unique ID is required for every staff member.');
      return;
    }
    if (store.isUniqueIdTaken(normalizedUid, editingStaff?.id)) {
      setStaffFormError(
        `Unique ID "${normalizedUid}" is already assigned to another user or staff member. Please enter a unique code or click Auto ID.`
      );
      return;
    }
    if (!formData.dob) {
      setStaffFormError('Date of Birth is required (used for 2-of-3 password recovery).');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      unique_id: normalizedUid,
      dob: formData.dob,
      phone: formData.phone.trim(),
      password: formData.password,
      role_title: formData.role_title.trim(),
      salary_type: formData.salary_type,
      hourly_rate: Number(formData.hourly_rate || 0),
      event_rate: Number(formData.event_rate || 0),
      monthly_salary: Number(formData.monthly_salary || 0),
      salary_start_date: formData.salary_start_date || toLocalYmd(new Date()),
      active: formData.active
    };

    if (editingStaff) {
      store.updateStaff(editingStaff.id, payload, shiftRateUpdateMode);
      const policyNote =
        shiftRateUpdateMode === 'update_upcoming'
          ? ' · Switched upcoming shifts to new rate'
          : shiftRateUpdateMode === 'update_all_unsettled'
          ? ' · Switched unsettled shifts to new rate'
          : ' · Existing shifts kept at assigned historical rate';
      showNotice(
        `✓ Updated staff profile for ${payload.name} [${normalizedUid}] (${formatStaffSalaryRate(payload)})${policyNote}.`
      );
    } else {
      store.addStaff(payload);
      showNotice(
        `✓ Registered ${payload.name} [Unique ID: ${normalizedUid}] on ${formatStaffSalaryTypeLabel(payload.salary_type)} plan (${formatStaffSalaryRate(payload)}).`
      );
    }
    setIsModalOpen(false);
    setEditingStaff(null);
    setStaffFormError(null);
    setShiftRateUpdateMode('keep_existing');
    setFormData(resetStaffForm());
  };

  const handleOpenResetPassword = (st: StaffMember) => {
    setResetPwStaff(st);
    setResetPwValue('password123');
    setResetPwError(null);
  };

  const handleConfirmAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwStaff) return;
    setResetPwError(null);
    setResetPwBusy(true);
    try {
      const res = await store.adminResetStaffPassword(resetPwStaff.id, resetPwValue);
      if (!res.success) {
        setResetPwError(res.error || 'Could not reset password.');
      } else {
        showNotice(`🔑 Password reset for ${resetPwStaff.name} (Login: ${resetPwStaff.phone}).`);
        setResetPwStaff(null);
      }
    } finally {
      setResetPwBusy(false);
    }
  };

  const openSalaryModal = (type: StaffSalaryRecordType, preselectedStaff?: StaffMember) => {
    const targetStaff = preselectedStaff || state.staff[0];
    const summary = targetStaff ? store.getStaffSalarySummary(targetStaff.id) : null;
    setSalaryRecordType(type);
    setSalaryForm({
      staff_member_id: targetStaff?.id || '',
      event_id: '',
      amount:
        type === 'payment'
          ? summary && summary.balancePayable > 0
            ? summary.balancePayable
            : 1000
          : type === 'advance'
          ? 1000
          : 500,
      method: type === 'earning' ? 'Duty Allowance' : 'UPI / GPay',
      recorded_at: new Date().toISOString().slice(0, 10),
      note: type === 'advance' ? 'Salary Advance' : ''
    });
    setSalaryModalOpen(true);
  };

  const switchSalaryModalType = (nextType: StaffSalaryRecordType) => {
    const sum = salaryForm.staff_member_id
      ? store.getStaffSalarySummary(salaryForm.staff_member_id)
      : null;
    setSalaryRecordType(nextType);
    setSalaryForm((prev) => ({
      ...prev,
      amount:
        nextType === 'payment'
          ? sum && sum.balancePayable > 0
            ? sum.balancePayable
            : prev.amount || 1000
          : nextType === 'advance'
          ? prev.amount || 1000
          : prev.amount || 500,
      method:
        nextType === 'earning'
          ? prev.method === 'UPI / GPay' || prev.method === 'Cash' || prev.method === 'Bank Transfer'
            ? 'Duty Allowance'
            : prev.method
          : prev.method === 'Duty Allowance' ||
            prev.method === 'Travel / Night Batta' ||
            prev.method === 'Festival / Event Bonus'
          ? 'UPI / GPay'
          : prev.method,
      note:
        nextType === 'advance' && !prev.note
          ? 'Salary Advance'
          : nextType !== 'advance' && prev.note === 'Salary Advance'
          ? ''
          : prev.note
    }));
  };

  const handleSubmitSalary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryForm.staff_member_id || salaryForm.amount <= 0) return;

    const targetStaff = state.staff.find((s) => s.id === salaryForm.staff_member_id);
    const isoDate = salaryForm.recorded_at
      ? `${salaryForm.recorded_at}T12:00:00Z`
      : new Date().toISOString();

    store.addStaffSalaryRecord({
      staff_member_id: salaryForm.staff_member_id,
      event_id: salaryForm.event_id || undefined,
      record_type: salaryRecordType,
      amount: Number(salaryForm.amount),
      method: salaryForm.method,
      note: salaryForm.note,
      recorded_at: isoDate
    });

    setSalaryModalOpen(false);
    showNotice(
      salaryRecordType === 'advance'
        ? `⚡ Recorded ₹${Number(salaryForm.amount).toLocaleString('en-IN')} Salary Advance for ${targetStaff?.name || 'Staff'}.`
        : salaryRecordType === 'payment'
        ? `💸 Paid ₹${Number(salaryForm.amount).toLocaleString('en-IN')} standard salary to ${targetStaff?.name || 'Staff'}.`
        : `✓ Added ₹${Number(salaryForm.amount).toLocaleString('en-IN')} allowance for ${targetStaff?.name || 'Staff'}.`
    );
  };

  const handleConfirmDeleteStaff = () => {
    if (!staffToDelete) return;
    const removedName = staffToDelete.name;
    if (statementStaff?.id === staffToDelete.id) {
      setStatementStaff(null);
    }
    store.deleteStaff(staffToDelete.id);
    setStaffToDelete(null);
    showNotice(`Removed ${removedName} from staff roster.`);
  };

  const handleSetAttendance = (shiftId: string, status: ShiftAttendanceStatus) => {
    store.updateShiftAttendance(shiftId, status);
  };

  const applyDatePreset = (preset: 'this_month' | 'last_month' | 'last_30' | 'this_year' | 'all') => {
    const now = new Date();
    if (preset === 'this_month') {
      const bounds = getInitialMonthBounds();
      setReportStartDate(bounds.start);
      setReportEndDate(bounds.end);
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setReportStartDate(toLocalYmd(first));
      setReportEndDate(toLocalYmd(last));
    } else if (preset === 'last_30') {
      const start = new Date(now.getTime() - 29 * 86400000);
      setReportStartDate(toLocalYmd(start));
      setReportEndDate(toLocalYmd(now));
    } else if (preset === 'this_year') {
      setReportStartDate(`${now.getFullYear()}-01-01`);
      setReportEndDate(`${now.getFullYear()}-12-31`);
    } else {
      setReportStartDate('');
      setReportEndDate('');
    }
  };

  const handleDownloadSummaryPdf = async () => {
    setPdfBusyKey('summary');
    try {
      await downloadStaffPayrollSummaryPdf(
        filteredReportRows,
        filteredTotals,
        reportStartDate,
        reportEndDate,
        state
      );
      showNotice('📥 Downloaded Staff Payroll Summary PDF.');
    } finally {
      setPdfBusyKey(null);
    }
  };

  const handleDownloadBatchSlipsPdf = async () => {
    if (filteredReportRows.length === 0) return;
    setPdfBusyKey('batch');
    try {
      await downloadBatchStaffSalarySlipsPdf(filteredReportRows, reportStartDate, reportEndDate, state);
      showNotice(`📥 Downloaded ${filteredReportRows.length} Staff Salary Slip(s) PDF.`);
    } finally {
      setPdfBusyKey(null);
    }
  };

  const handleDownloadSingleSlip = async (row: StaffPeriodReportRow) => {
    setPdfBusyKey(`slip-${row.staff.id}`);
    try {
      await downloadSingleStaffSalarySlipPdf(row, reportStartDate, reportEndDate, state);
      showNotice(`📥 Downloaded Salary Slip PDF for ${row.staff.name}.`);
    } finally {
      setPdfBusyKey(null);
    }
  };

  // Shift Attendance Rows
  const allShiftRows = state.shifts
    .map((sh) => {
      const staffMember = state.staff.find((s) => s.id === sh.staff_member_id);
      const event = state.events.find((e) => e.id === sh.event_id);
      const summary = staffMember ? store.getStaffSalarySummary(staffMember.id) : null;
      const shiftCalc = summary?.shiftItems.find((item) => item.shift.id === sh.id);
      const isUpcoming =
        Boolean(event) &&
        event!.status !== 'cancelled' &&
        event!.status !== 'completed' &&
        (event!.event_date >= todayYmd || event!.status === 'confirmed' || event!.status === 'inquiry');
      return { shift: sh, staffMember, event, shiftCalc, isUpcoming };
    })
    .filter((item) => item.staffMember && item.event && item.event.status !== 'cancelled')
    .filter((item) => (!attendanceEventFilter ? true : item.event?.id === attendanceEventFilter))
    .filter((item) => {
      if (attendanceTimeFilter === 'upcoming') return item.isUpcoming;
      if (attendanceTimeFilter === 'past') return !item.isUpcoming;
      return true;
    })
    .sort((a, b) => (b.event?.event_date || '').localeCompare(a.event?.event_date || ''));

  const selectedFilterEvent = attendanceEventFilter
    ? state.events.find((e) => e.id === attendanceEventFilter) || null
    : null;

  const filteredSalaryRecords = [...(state.staffSalaryRecords || [])]
    .filter((rec) => {
      if (ledgerFilter === 'all') return true;
      if (ledgerFilter === 'earning') return rec.record_type === 'earning';
      const isAdv = isSalaryAdvanceRecord(rec);
      if (ledgerFilter === 'advance') return rec.record_type !== 'earning' && isAdv;
      return rec.record_type === 'payment' && !isAdv;
    })
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Crew, Events &amp; Salary Payroll</h1>
          <p className="page-subtitle">
            Manage Per Hour, Per Event, and Monthly staff salary plans, record Salary Advances separately from standard payouts, and export PDF slips.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canManageSalary && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: '#d97706',
                  borderColor: '#d97706',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
                onClick={() => openSalaryModal('advance')}
              >
                ⚡ Salary Advance
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: '#059669',
                  borderColor: '#059669',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
                onClick={() => openSalaryModal('payment')}
              >
                💸 Pay Staff Salary
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                onClick={() => openSalaryModal('earning')}
              >
                + Bonus / Allowance
              </button>
            </>
          )}
          {canEditStaff && (
            <button
              type="button"
              onClick={() => {
                setStaffFormError(null);
                setEditingStaff(null);
                setFormData(resetStaffForm());
                setIsModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              + Add Staff
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {notice && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #6ee7b7',
            color: '#065f46',
            borderRadius: '10px',
            padding: '0.7rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.86rem',
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 5 Summary KPI Cards (Separating Standard Salary Paid vs Salary Advances) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '0.85rem',
          marginBottom: '1.25rem'
        }}
      >
        <div
          className="stats-card"
          style={{
            borderTop: '3px solid #2563eb',
            background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 70%)'
          }}
        >
          <span className="stats-label" style={{ color: '#1d4ed8' }}>
            Total Crew Wages Earned
          </span>
          <span className="stats-value" style={{ color: '#1d4ed8', fontVariantNumeric: 'tabular-nums' }}>
            ₹{totalEarnedAll.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">Shifts, events, monthly &amp; bonus</span>
        </div>

        <div
          className="stats-card"
          style={{
            borderTop: '3px solid #059669',
            background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 70%)'
          }}
        >
          <span className="stats-label" style={{ color: '#047857' }}>
            Standard Salary Paid
          </span>
          <span className="stats-value" style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
            ₹{totalRegularPaidAll.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">Regular salary settlements</span>
        </div>

        <div
          className="stats-card"
          style={{
            borderTop: '3px solid #d97706',
            background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 70%)'
          }}
        >
          <span className="stats-label" style={{ color: '#b45309' }}>
            Salary Advances Paid
          </span>
          <span className="stats-value" style={{ color: '#d97706', fontVariantNumeric: 'tabular-nums' }}>
            ₹{totalAdvancePaidAll.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">Tracked separately from payouts</span>
        </div>

        <div
          className="stats-card"
          style={{
            borderTop: `3px solid ${totalPendingAll > 0 ? '#e11d48' : '#059669'}`,
            background:
              totalPendingAll > 0
                ? 'linear-gradient(180deg, #fff1f2 0%, #ffffff 70%)'
                : 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 70%)'
          }}
        >
          <span className="stats-label" style={{ color: totalPendingAll > 0 ? '#be123c' : '#047857' }}>
            Pending Salary Payable
          </span>
          <span
            className="stats-value"
            style={{
              color: totalPendingAll > 0 ? '#dc2626' : '#059669',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            ₹{totalPendingAll.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">
            {totalPendingAll > 0 ? 'Net balance owed after advances' : 'All staff dues cleared'}
          </span>
        </div>

        <div
          className="stats-card"
          style={{
            borderTop: '3px solid #7c3aed',
            background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 70%)'
          }}
        >
          <span className="stats-label" style={{ color: '#6d28d9' }}>
            Active Catering Crew
          </span>
          <span className="stats-value" style={{ color: '#6d28d9', fontVariantNumeric: 'tabular-nums' }}>
            {activeCrewCount}{' '}
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#64748b' }}>
              / {state.staff.length}
            </span>
          </span>
          <span className="stats-sub">Available for banquet duty</span>
        </div>
      </div>

      {/* Simplified 3-Tab Segmented Switcher */}
      <div
        style={{
          display: 'flex',
          gap: '0.45rem',
          padding: '0.35rem',
          background: '#f1f5f9',
          borderRadius: '11px',
          marginBottom: '1.25rem',
          overflowX: 'auto'
        }}
      >
        {[
          { id: 'crew' as const, label: `🧑‍🍳 Crew & Events (${state.staff.length})` },
          { id: 'attendance' as const, label: `📋 Shift Attendance (${allShiftRows.length})` },
          { id: 'report' as const, label: '📄 Payroll Report & PDF Slips' }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.55rem 1.05rem',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? '#0f172a' : 'transparent',
                color: isActive ? '#ffffff' : '#475569',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background 0.15s ease, color 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CREW DIRECTORY, UPCOMING VS ATTENDED EVENTS & QUICK PAY        */}
      {/* ===================================================================== */}
      {activeTab === 'crew' && (
        <div>
          {/* Search & Quick Filter Bar */}
          <div
            className="card"
            style={{
              padding: '0.9rem 1.1rem',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}
          >
            <div style={{ flex: '1 1 260px', maxWidth: '420px' }}>
              <input
                type="text"
                placeholder="Search staff by name, Unique ID, mobile number, or role..."
                className="form-control"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.35rem',
                padding: '0.25rem',
                background: '#f1f5f9',
                borderRadius: '8px',
                flexWrap: 'wrap'
              }}
            >
              {[
                { id: 'all' as const, label: `All Crew (${staffRows.length})` },
                {
                  id: 'due' as const,
                  label: `Balance Due (${staffRows.filter((r) => r.summary.balancePayable > 0).length})`
                },
                {
                  id: 'upcoming' as const,
                  label: `Upcoming Duty (${staffRows.filter((r) => r.upcomingItems.length > 0).length})`
                }
              ].map((flt) => {
                const active = crewFilter === flt.id;
                return (
                  <button
                    key={flt.id}
                    type="button"
                    onClick={() => setCrewFilter(flt.id)}
                    style={{
                      padding: '0.38rem 0.75rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: active ? '#ffffff' : 'transparent',
                      color: active ? '#0f172a' : '#475569',
                      fontWeight: active ? 700 : 600,
                      fontSize: '0.8rem',
                      boxShadow: active ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {flt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simplified Crew Cards Grid */}
          {filteredStaffRows.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: '#64748b' }}>
              No staff members match your current filter.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(370px, 1fr))',
                gap: '1rem'
              }}
            >
              {filteredStaffRows.map(({ staff, summary, upcomingItems, attendedItems }) => {
                const nextEvt = upcomingItems[0]?.event;
                const lastEvt = attendedItems[0]?.event;
                return (
                  <div
                    key={staff.id}
                    className="card"
                    style={{
                      padding: '1.15rem 1.2rem',
                      borderTop: `3px solid ${
                        !staff.active
                          ? '#94a3b8'
                          : summary.balancePayable > 0
                          ? '#e11d48'
                          : '#059669'
                      }`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.9rem'
                    }}
                  >
                    {/* Top Row: Staff Name, Role, Phone & Configured Salary Plan */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '0.5rem'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.06rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                              {staff.name}
                            </h3>
                            {staff.unique_id && (
                              <span
                                style={{
                                  background: '#eef2ff',
                                  border: '1px solid #c7d2fe',
                                  color: '#3730a3',
                                  borderRadius: '6px',
                                  padding: '0.12rem 0.45rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  fontVariantNumeric: 'tabular-nums',
                                  letterSpacing: '0.02em'
                                }}
                                title="Staff Unique ID (used for Sign-In & 2-of-3 Password Reset)"
                              >
                                ID: {staff.unique_id}
                              </span>
                            )}
                            {role === 'owner' && (
                              <OwnerAuditBadge
                                role={role}
                                entry={store.getEntityAudit(staff.id, ['staff', 'shift', 'salary'])}
                              />
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: '#475569',
                              marginTop: '0.18rem',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            <span style={{ fontWeight: 700, color: '#4f46e5' }}>
                              {staff.role_title || 'Service Crew'}
                            </span>
                            <span> · 📱 {staff.phone || 'No phone'}</span>
                            {staff.dob && <span> · 🎂 {formatDisplayDate(staff.dob)}</span>}
                            {!staff.active && (
                              <span style={{ color: '#b45309', fontWeight: 700 }}> · On Leave</span>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            flexShrink: 0
                          }}
                        >
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                            {summary.rateDisplay}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                            {formatStaffSalaryTypeLabel(summary.salaryType)}
                          </div>
                        </div>
                      </div>

                      {/* Simplified Separated Upcoming vs Attended Events Strip */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.6rem',
                          marginTop: '0.85rem'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setStatementStaff(staff);
                            setStatementTab('upcoming');
                          }}
                          style={{
                            textAlign: 'left',
                            padding: '0.6rem 0.7rem',
                            borderRadius: '8px',
                            border: '1px solid #ddd6fe',
                            background: '#faf5ff',
                            cursor: 'pointer'
                          }}
                          title="Click to view all upcoming events assigned to this staff member"
                        >
                          <div
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#6d28d9',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            📅 Upcoming ({upcomingItems.length})
                          </div>
                          <div
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: '#0f172a',
                              marginTop: '0.15rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {nextEvt ? nextEvt.title : 'No upcoming duty'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            {nextEvt ? formatDisplayDate(nextEvt.event_date) : 'Schedule clear'}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setStatementStaff(staff);
                            setStatementTab('attended');
                          }}
                          style={{
                            textAlign: 'left',
                            padding: '0.6rem 0.7rem',
                            borderRadius: '8px',
                            border: '1px solid #a7f3d0',
                            background: '#ecfdf5',
                            cursor: 'pointer'
                          }}
                          title="Click to view all past events attended by this staff member"
                        >
                          <div
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#047857',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            ✅ Attended ({attendedItems.length})
                          </div>
                          <div
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: '#0f172a',
                              marginTop: '0.15rem',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            {summary.salaryType === 'per_event'
                              ? `${summary.attendedShiftsCount} paid event${summary.attendedShiftsCount === 1 ? '' : 's'}`
                              : `${summary.totalShiftHours} hrs worked`}
                          </div>
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#64748b',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {lastEvt ? `Last: ${lastEvt.title}` : 'No past shifts yet'}
                          </div>
                        </button>
                      </div>

                      {/* Clean 4-Column Financial Row: Earned · Salary Paid · Advance · Balance Due */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '0.45rem',
                          marginTop: '0.75rem',
                          paddingTop: '0.7rem',
                          borderTop: '1px solid #f1f5f9',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Earned</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1d4ed8' }}>
                            ₹{summary.totalEarned.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Salary Paid</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#059669' }}>
                            ₹{summary.totalRegularPaid.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#b45309' }}>Advance</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#d97706' }}>
                            ₹{summary.totalAdvancePaid.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Balance Due</div>
                          <div
                            style={{
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              color: summary.balancePayable > 0 ? '#dc2626' : '#059669'
                            }}
                          >
                            ₹{summary.balancePayable.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Toolbar */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.35rem',
                        flexWrap: 'wrap',
                        paddingTop: '0.65rem',
                        borderTop: '1px solid #f1f5f9'
                      }}
                    >
                      {canManageSalary && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{
                              background: '#fffbeb',
                              borderColor: '#fcd34d',
                              color: '#b45309',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                            title="Record a quick Salary Advance (tracked separately from standard salary payouts)"
                            onClick={() => openSalaryModal('advance', staff)}
                          >
                            ⚡ Advance
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{
                              background: '#ecfdf5',
                              borderColor: '#6ee7b7',
                              color: '#065f46',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                            onClick={() => openSalaryModal('payment', staff)}
                          >
                            💸 Pay Salary
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                            onClick={() => openSalaryModal('earning', staff)}
                          >
                            + Bonus
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                        onClick={() => {
                          setStatementStaff(staff);
                          setStatementTab(upcomingItems.length > 0 ? 'upcoming' : 'attended');
                        }}
                      >
                        📋 Ledger
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          background: '#eff6ff',
                          borderColor: '#bfdbfe',
                          color: '#1d4ed8',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}
                        onClick={() => setPreviewSlipStaffId(staff.id)}
                      >
                        📄 Slip PDF
                      </button>

                      {canEditStaff && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{
                              background: '#f8fafc',
                              borderColor: '#cbd5e1',
                              color: '#334155',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                            title="Reset forgotten login password for this staff member"
                            onClick={() => handleOpenResetPassword(staff)}
                          >
                            🔑 Reset PW
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ whiteSpace: 'nowrap' }}
                            onClick={() => {
                              const stType = getStaffSalaryType(staff);
                              setStaffFormError(null);
                              setEditingStaff(staff);
                              setShiftRateUpdateMode('keep_existing');
                              setFormData({
                                name: staff.name,
                                unique_id: staff.unique_id || store.generateNextUniqueId('staff'),
                                dob: staff.dob || '',
                                phone: staff.phone || '',
                                password: staff.password || 'password123',
                                role_title: staff.role_title || 'Buffet Server',
                                salary_type: stType,
                                hourly_rate: Number(staff.hourly_rate || 200),
                                event_rate: Number(
                                  staff.event_rate || (stType === 'per_event' ? staff.hourly_rate : 1200)
                                ),
                                monthly_salary: Number(
                                  staff.monthly_salary || (stType === 'monthly' ? staff.hourly_rate : 18000)
                                ),
                                salary_start_date: staff.salary_start_date || toLocalYmd(new Date()),
                                active: staff.active
                              });
                              setIsModalOpen(true);
                            }}
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: SHIFT ATTENDANCE & DUTY WHATSAPP DISPATCH                      */}
      {/* ===================================================================== */}
      {activeTab === 'attendance' && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}
          >
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>
                📋 Event Duty Shifts &amp; Attendance Register
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Mark crew Present after duty to credit their Per-Hour or Per-Event wage automatically.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  gap: '0.25rem',
                  padding: '0.25rem',
                  background: '#f1f5f9',
                  borderRadius: '8px'
                }}
              >
                {[
                  { id: 'all' as const, label: 'All Shifts' },
                  { id: 'upcoming' as const, label: '📅 Upcoming' },
                  { id: 'past' as const, label: '✅ Past / Completed' }
                ].map((flt) => {
                  const active = attendanceTimeFilter === flt.id;
                  return (
                    <button
                      key={flt.id}
                      type="button"
                      onClick={() => setAttendanceTimeFilter(flt.id)}
                      style={{
                        padding: '0.35rem 0.7rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: active ? '#ffffff' : 'transparent',
                        color: active ? '#0f172a' : '#475569',
                        fontWeight: active ? 700 : 600,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {flt.label}
                    </button>
                  );
                })}
              </div>

              <select
                className="form-control"
                style={{ width: 'auto', minWidth: '220px' }}
                value={attendanceEventFilter}
                onChange={(e) => setAttendanceEventFilter(e.target.value)}
              >
                <option value="">All Events ({state.events.length})</option>
                {[...state.events]
                  .filter((e) => e.status !== 'cancelled')
                  .sort((a, b) => b.event_date.localeCompare(a.event_date))
                  .map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.event_date})
                    </option>
                  ))}
              </select>

              {selectedFilterEvent && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      background: '#ecfdf5',
                      borderColor: '#6ee7b7',
                      color: '#047857',
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}
                    onClick={() => {
                      setWhatsAppModalShift(null);
                      setWhatsAppModalEvent(selectedFilterEvent);
                    }}
                  >
                    💬 Notify Crew on WA
                  </button>
                  {canMarkAttendance && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ whiteSpace: 'nowrap' }}
                      onClick={() => {
                        const targetShifts = state.shifts.filter(
                          (s) => s.event_id === selectedFilterEvent.id && s.attendance_status !== 'present'
                        );
                        targetShifts.forEach((s) => store.updateShiftAttendance(s.id, 'present'));
                        showNotice(
                          `✓ Marked ${targetShifts.length} crew shift(s) Present for ${selectedFilterEvent.title}.`
                        );
                      }}
                    >
                      ✓ Mark All Present
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event &amp; Date</th>
                  <th>Staff Member</th>
                  <th>Role &amp; Timing</th>
                  <th style={{ textAlign: 'right' }}>Shift / Event Pay</th>
                  <th style={{ textAlign: 'center' }}>Attendance</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allShiftRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.25rem', color: '#64748b' }}>
                      No shifts found for this filter. Assign crew inside an Event page to track shifts here.
                    </td>
                  </tr>
                ) : (
                  allShiftRows.map(({ shift, staffMember, event, shiftCalc, isUpcoming }) => {
                    const att = shift.attendance_status || 'pending';
                    const eff = store.getShiftEffectiveRateInfo(shift, staffMember);
                    const sType = eff.salaryType;
                    const estShiftPay = eff.payrollShiftAmount;

                    return (
                      <tr key={shift.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            <Link href={`/events/${event!.id}`} style={{ color: '#0f172a', textDecoration: 'none' }}>
                              {event!.title}
                            </Link>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            {formatDisplayDate(event!.event_date)} ·{' '}
                            <span style={{ color: isUpcoming ? '#6d28d9' : '#059669', fontWeight: 700 }}>
                              {isUpcoming ? 'Upcoming' : 'Past / Completed'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{staffMember!.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            📱 {staffMember!.phone || '—'} · Assigned: <strong>{eff.rateLabel}</strong>
                          </div>
                          {eff.differsFromCurrentProfile && (
                            <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 700
                                }}
                              >
                                Locked Rate (Current: {eff.currentProfileRateLabel})
                              </span>
                              {canEditStaff && event!.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    store.applyCurrentStaffRateToShift(shift.id);
                                    showNotice(
                                      `↻ Switched ${staffMember!.name}'s shift on ${event!.title} to ${eff.currentProfileRateLabel}.`
                                    );
                                  }}
                                  style={{
                                    fontSize: '0.68rem',
                                    background: '#ffffff',
                                    color: '#0f172a',
                                    border: '1px solid #cbd5e1',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  ↻ Switch to {eff.currentProfileRateLabel}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ fontWeight: 600, color: '#334155' }}>
                            {shift.role_label || staffMember!.role_title || 'Crew'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {(shift.starts_at || '').slice(11, 16) || '—'} – {(shift.ends_at || '').slice(11, 16) || '—'} (
                            {shiftCalc?.hours ?? eff.hours} hrs)
                          </div>
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color: att === 'present' ? '#059669' : '#64748b'
                          }}
                        >
                          {sType === 'monthly' ? (
                            <span>Monthly Fixed</span>
                          ) : (
                            <span>₹{estShiftPay.toLocaleString('en-IN')}</span>
                          )}
                          <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>
                            {att === 'present' ? 'Credited' : att === 'absent' ? 'Absent (₹0)' : `Rate: ${eff.rateLabel}`}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {canMarkAttendance ? (
                            <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{
                                  background: att === 'present' ? '#059669' : '#f8fafc',
                                  borderColor: att === 'present' ? '#059669' : '#cbd5e1',
                                  color: att === 'present' ? '#ffffff' : '#334155',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap'
                                }}
                                onClick={() => handleSetAttendance(shift.id, 'present')}
                              >
                                ✓ Present
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{
                                  background: att === 'absent' ? '#dc2626' : '#f8fafc',
                                  borderColor: att === 'absent' ? '#dc2626' : '#cbd5e1',
                                  color: att === 'absent' ? '#ffffff' : '#334155',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap'
                                }}
                                onClick={() => handleSetAttendance(shift.id, 'absent')}
                              >
                                ✕ Absent
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{att}</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                background: '#ecfdf5',
                                borderColor: '#a7f3d0',
                                color: '#047857',
                                fontWeight: 700,
                                whiteSpace: 'nowrap'
                              }}
                              onClick={() => {
                                setWhatsAppModalEvent(event!);
                                setWhatsAppModalShift(shift);
                              }}
                            >
                              💬 WA Duty
                            </button>

                            {canEditStaff &&
                              (confirmRemoveShiftId === shift.id ? (
                                <span style={{ display: 'inline-flex', gap: '0.2rem' }}>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                                    onClick={() => {
                                      store.removeShift(shift.id);
                                      setConfirmRemoveShiftId(null);
                                      showNotice('Removed shift assignment.');
                                    }}
                                  >
                                    Remove?
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem' }}
                                    onClick={() => setConfirmRemoveShiftId(null)}
                                  >
                                    No
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: '#dc2626' }}
                                  title="Remove shift"
                                  onClick={() => setConfirmRemoveShiftId(shift.id)}
                                >
                                  ✕
                                </button>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PAYROLL REPORT, SALARY SLIP PDF & PAYMENT/ADVANCE LEDGER       */}
      {/* ===================================================================== */}
      {activeTab === 'report' && (
        <div>
          {/* Date-Range Controls Card */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}
            >
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  📄 Staff Salary Report &amp; Printable PDF Slips
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  Period: <strong>{formatPeriodLabel(reportStartDate, reportEndDate)}</strong> · Separates Standard Salary Payouts from Salary Advances
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                  onClick={() =>
                    printStaffPayrollSummaryReport(
                      filteredReportRows,
                      filteredTotals,
                      reportStartDate,
                      reportEndDate,
                      state
                    )
                  }
                >
                  🖨️ Print Summary
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                  disabled={pdfBusyKey !== null}
                  onClick={handleDownloadSummaryPdf}
                >
                  {pdfBusyKey === 'summary' ? '⏳ Generating...' : '📥 Summary PDF'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                  disabled={pdfBusyKey !== null || filteredReportRows.length === 0}
                  onClick={handleDownloadBatchSlipsPdf}
                >
                  {pdfBusyKey === 'batch'
                    ? '⏳ Generating...'
                    : `📥 All Salary Slips PDF (${filteredReportRows.length})`}
                </button>
              </div>
            </div>

            {/* Date Pickers + Quick Presets */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                gap: '0.75rem',
                alignItems: 'end',
                marginBottom: '0.85rem'
              }}
            >
              <div>
                <label className="form-label" style={{ fontSize: '0.76rem' }}>
                  From Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.76rem' }}>
                  To Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.76rem' }}>
                  Staff Member
                </label>
                <select
                  className="form-control"
                  value={reportStaffFilter}
                  onChange={(e) => setReportStaffFilter(e.target.value)}
                >
                  <option value="">All Staff ({state.staff.length})</option>
                  {state.staff.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.76rem' }}>
                  Quick Search
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Name or phone..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'this_month' as const, label: 'This Month' },
                  { id: 'last_month' as const, label: 'Last Month' },
                  { id: 'last_30' as const, label: 'Last 30 Days' },
                  { id: 'this_year' as const, label: 'This Year' },
                  { id: 'all' as const, label: 'All Dates' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.76rem', padding: '0.28rem 0.65rem', whiteSpace: 'nowrap' }}
                    onClick={() => applyDatePreset(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={reportActiveInPeriodOnly}
                  onChange={(e) => setReportActiveInPeriodOnly(e.target.checked)}
                />
                Show only staff with activity in period
              </label>
            </div>
          </div>

          {/* Payroll Summary Table */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Member &amp; Plan</th>
                    <th style={{ textAlign: 'center' }}>Attendance</th>
                    <th style={{ textAlign: 'right' }}>Total Earnings</th>
                    <th style={{ textAlign: 'right' }}>Salary Paid</th>
                    <th style={{ textAlign: 'right' }}>Salary Advance</th>
                    <th style={{ textAlign: 'right' }}>Period Balance</th>
                    <th style={{ textAlign: 'center' }}>Slip, Advance &amp; Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReportRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No staff payroll rows match the selected period/filter.
                      </td>
                    </tr>
                  ) : (
                    filteredReportRows.map((r) => (
                      <tr key={r.staff.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.staff.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            {r.staff.role_title || 'Crew'} · {formatStaffSalaryTypeLabel(r.salaryType)} ({r.rateDisplay})
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {r.totalHoursWorked} hrs
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                            {r.attendedShiftsCount} shift{r.attendedShiftsCount === 1 ? '' : 's'}
                          </div>
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#1d4ed8',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          ₹{r.totalEarnings.toLocaleString('en-IN')}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#059669',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          ₹{r.regularPaymentsReceived.toLocaleString('en-IN')}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#d97706',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          ₹{r.advancesReceived.toLocaleString('en-IN')}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 800,
                            color: r.periodPayable > 0 ? '#dc2626' : '#059669',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          ₹{r.periodPayable.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ whiteSpace: 'nowrap' }}
                              onClick={() => setPreviewSlipStaffId(r.staff.id)}
                            >
                              👁 Slip
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ whiteSpace: 'nowrap' }}
                              onClick={() =>
                                printSingleStaffSalarySlip(r, reportStartDate, reportEndDate, state)
                              }
                            >
                              🖨️
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                              disabled={pdfBusyKey !== null}
                              onClick={() => handleDownloadSingleSlip(r)}
                            >
                              📥 PDF
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                background: '#ecfdf5',
                                borderColor: '#6ee7b7',
                                color: '#047857',
                                fontWeight: 700,
                                whiteSpace: 'nowrap'
                              }}
                              onClick={() => setWaSlipRow(r)}
                            >
                              💬 WA
                            </button>
                            {canManageSalary && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{
                                    background: '#fffbeb',
                                    borderColor: '#fcd34d',
                                    color: '#b45309',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap'
                                  }}
                                  onClick={() => openSalaryModal('advance', r.staff)}
                                >
                                  ⚡ Adv
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{
                                    background: '#f5f3ff',
                                    borderColor: '#c4b5fd',
                                    color: '#5b21b6',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap'
                                  }}
                                  onClick={() => openSalaryModal('payment', r.staff)}
                                >
                                  💸 Pay
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Salary Payouts, Salary Advances & Allowances Ledger */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.6rem',
                marginBottom: '0.85rem'
              }}
            >
              <h3 className="card-title" style={{ margin: 0 }}>
                🧾 Salary Payouts, Advances &amp; Allowances Ledger ({filteredSalaryRecords.length})
              </h3>

              <div
                style={{
                  display: 'flex',
                  gap: '0.25rem',
                  padding: '0.25rem',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  flexWrap: 'wrap'
                }}
              >
                {[
                  { id: 'all' as const, label: 'All Entries' },
                  { id: 'payment' as const, label: '💸 Salary Payouts' },
                  { id: 'advance' as const, label: '⚡ Salary Advances' },
                  { id: 'earning' as const, label: '➕ Allowances' }
                ].map((flt) => {
                  const active = ledgerFilter === flt.id;
                  return (
                    <button
                      key={flt.id}
                      type="button"
                      onClick={() => setLedgerFilter(flt.id)}
                      style={{
                        padding: '0.32rem 0.65rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: active ? '#ffffff' : 'transparent',
                        color: active ? '#0f172a' : '#475569',
                        fontWeight: active ? 700 : 600,
                        fontSize: '0.76rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {flt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredSalaryRecords.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No salary transactions match this filter.</p>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Staff Member</th>
                      <th>Transaction Type &amp; Method</th>
                      <th>Note</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      {canManageSalary && <th style={{ textAlign: 'center' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalaryRecords.slice(0, 50).map((rec) => {
                      const st = state.staff.find((s) => s.id === rec.staff_member_id);
                      const isAdv = rec.record_type !== 'earning' && isSalaryAdvanceRecord(rec);
                      const typeColor =
                        rec.record_type === 'earning'
                          ? '#1d4ed8'
                          : isAdv
                          ? '#b45309'
                          : '#059669';
                      const typeLabel =
                        rec.record_type === 'earning'
                          ? '➕ Allowance / Bonus'
                          : isAdv
                          ? '⚡ Salary Advance'
                          : '💸 Standard Salary Payout';

                      return (
                        <tr key={rec.id}>
                          <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {formatDisplayDate(rec.recorded_at)}
                          </td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{st?.name || 'Staff'}</td>
                          <td>
                            <span style={{ fontWeight: 700, color: typeColor }}>{typeLabel}</span> · {rec.method}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{rec.note || '—'}</td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 800,
                              fontVariantNumeric: 'tabular-nums',
                              color: typeColor
                            }}
                          >
                            ₹{rec.amount.toLocaleString('en-IN')}
                          </td>
                          {canManageSalary && (
                            <td style={{ textAlign: 'center' }}>
                              {confirmDeleteSalaryId === rec.id ? (
                                <span style={{ display: 'inline-flex', gap: '0.25rem' }}>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                                    onClick={() => {
                                      store.deleteStaffSalaryRecord(rec.id);
                                      setConfirmDeleteSalaryId(null);
                                      showNotice('Deleted salary entry.');
                                    }}
                                  >
                                    Delete?
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem' }}
                                    onClick={() => setConfirmDeleteSalaryId(null)}
                                  >
                                    No
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: '#dc2626' }}
                                  onClick={() => setConfirmDeleteSalaryId(rec.id)}
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: STAFF EVENTS (UPCOMING VS ATTENDED) & SALARY LEDGER            */}
      {/* ===================================================================== */}
      {statementStaff && (() => {
        const rowData = staffRows.find((r) => r.staff.id === statementStaff.id);
        if (!rowData) return null;
        const { summary, upcomingItems, attendedItems } = rowData;

        return (
          <div className="modal-overlay" onClick={() => setStatementStaff(null)}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '720px', width: '96%', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div className="modal-header">
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    🧑‍🍳 {statementStaff.name}
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.18rem 0 0 0' }}>
                    {statementStaff.unique_id ? `ID: ${statementStaff.unique_id} · ` : ''}
                    {statementStaff.role_title || 'Crew'} · 📱 {statementStaff.phone || '—'}
                    {statementStaff.dob ? ` · 🎂 DOB: ${formatDisplayDate(statementStaff.dob)}` : ''} ·{' '}
                    <strong>{formatStaffSalaryTypeLabel(summary.salaryType)}</strong> ({summary.rateDisplay})
                  </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setStatementStaff(null)}>
                  ✕
                </button>
              </div>

              {/* 4-Card Balance Strip Separating Standard Salary Paid & Salary Advance */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                  gap: '0.6rem',
                  marginBottom: '1rem',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8' }}>Total Earned</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a' }}>
                    ₹{summary.totalEarned.toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#047857' }}>Standard Salary Paid</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669' }}>
                    ₹{summary.totalRegularPaid.toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309' }}>Salary Advances</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#d97706' }}>
                    ₹{summary.totalAdvancePaid.toLocaleString('en-IN')}
                  </div>
                </div>
                <div
                  style={{
                    background: summary.balancePayable > 0 ? '#fff1f2' : '#f8fafc',
                    border: `1px solid ${summary.balancePayable > 0 ? '#fecdd3' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '0.65rem 0.75rem'
                  }}
                >
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: summary.balancePayable > 0 ? '#be123c' : '#475569' }}>
                    Balance Payable
                  </div>
                  <div
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: summary.balancePayable > 0 ? '#dc2626' : '#059669'
                    }}
                  >
                    ₹{summary.balancePayable.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Segmented Tabs inside Modal */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.35rem',
                  padding: '0.3rem',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  overflowX: 'auto'
                }}
              >
                {[
                  { id: 'upcoming' as const, label: `📅 Upcoming Events (${upcomingItems.length})` },
                  { id: 'attended' as const, label: `✅ Attended Events (${attendedItems.length})` },
                  {
                    id: 'salary' as const,
                    label: `💸 Payouts, Advances & Bonus (${summary.paymentRecords.length + summary.earningRecords.length})`
                  }
                ].map((t) => {
                  const active = statementTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setStatementTab(t.id)}
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: active ? '#ffffff' : 'transparent',
                        color: active ? '#0f172a' : '#475569',
                        fontWeight: active ? 700 : 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {statementTab === 'upcoming' && (
                <div>
                  {upcomingItems.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                      No upcoming events currently scheduled for {statementStaff.name}.
                    </div>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Event &amp; Venue</th>
                            <th>Role, Timing &amp; Assigned Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcomingItems.map((si) => {
                            const eff = store.getShiftEffectiveRateInfo(si.shift, statementStaff);
                            return (
                              <tr key={si.shift.id}>
                                <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 700 }}>
                                  {formatDisplayDate(si.event!.event_date)}
                                </td>
                                <td>
                                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{si.event?.title}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📍 {si.event?.venue || 'Venue TBD'}</div>
                                </td>
                                <td style={{ fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                  <div style={{ fontWeight: 600, color: '#6d28d9' }}>
                                    {si.shift.role_label || statementStaff.role_title || 'Crew'} · {eff.rateLabel}
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                    {(si.shift.starts_at || '').slice(11, 16) || '—'} – {(si.shift.ends_at || '').slice(11, 16) || '—'}
                                  </div>
                                  {eff.differsFromCurrentProfile && canEditStaff && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        store.applyCurrentStaffRateToShift(si.shift.id);
                                        showNotice(`↻ Switched shift rate to ${eff.currentProfileRateLabel}.`);
                                      }}
                                      style={{
                                        marginTop: '0.25rem',
                                        fontSize: '0.7rem',
                                        background: '#eff6ff',
                                        color: '#1d4ed8',
                                        border: '1px solid #bfdbfe',
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      ↻ Switch to {eff.currentProfileRateLabel}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {statementTab === 'attended' && (
                <div>
                  {attendedItems.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                      No past events attended yet.
                    </div>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Event &amp; Venue</th>
                            <th>Hours &amp; Assigned Rate</th>
                            <th style={{ textAlign: 'right' }}>Earned (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendedItems.map((si) => {
                            const eff = store.getShiftEffectiveRateInfo(si.shift, statementStaff);
                            return (
                              <tr key={si.shift.id}>
                                <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 700 }}>
                                  {formatDisplayDate(si.event?.event_date || '')}
                                </td>
                                <td>
                                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{si.event?.title || 'Event'}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📍 {si.event?.venue || '—'}</div>
                                </td>
                                <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                  <div>{si.hours} hrs</div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Rate: {eff.rateLabel}</div>
                                </td>
                                <td
                                  style={{
                                    textAlign: 'right',
                                    fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums',
                                    color: si.isAttended ? '#059669' : '#64748b'
                                  }}
                                >
                                  {si.isAttended
                                    ? eff.salaryType === 'monthly'
                                      ? 'Monthly Fixed'
                                      : `₹${si.earnedAmount.toLocaleString('en-IN')}`
                                    : 'Pending Attendance'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {statementTab === 'salary' && (
                <div>
                  {summary.paymentRecords.length === 0 && summary.earningRecords.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                      No salary payouts, advances, or bonuses recorded yet.
                    </div>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Method &amp; Note</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...summary.paymentRecords, ...summary.earningRecords]
                            .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
                            .map((rec) => {
                              const isAdv = rec.record_type !== 'earning' && isSalaryAdvanceRecord(rec);
                              const color =
                                rec.record_type === 'earning'
                                  ? '#1d4ed8'
                                  : isAdv
                                  ? '#b45309'
                                  : '#059669';
                              const label =
                                rec.record_type === 'earning'
                                  ? '➕ Bonus / Allowance'
                                  : isAdv
                                  ? '⚡ Salary Advance'
                                  : '💸 Standard Salary Payout';
                              return (
                                <tr key={rec.id}>
                                  <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                    {formatDisplayDate(rec.recorded_at)}
                                  </td>
                                  <td style={{ fontWeight: 700, color, whiteSpace: 'nowrap' }}>{label}</td>
                                  <td style={{ fontSize: '0.82rem', color: '#475569' }}>
                                    <strong>{rec.method}</strong>
                                    {rec.note ? ` · ${rec.note}` : ''}
                                  </td>
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      fontWeight: 800,
                                      fontVariantNumeric: 'tabular-nums',
                                      color
                                    }}
                                  >
                                    ₹{rec.amount.toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                  marginTop: '1.15rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid #e2e8f0',
                  flexWrap: 'wrap'
                }}
              >
                {canManageSalary && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ background: '#d97706', borderColor: '#d97706', fontWeight: 700, whiteSpace: 'nowrap' }}
                      onClick={() => {
                        const target = statementStaff;
                        setStatementStaff(null);
                        openSalaryModal('advance', target);
                      }}
                    >
                      ⚡ Salary Advance
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ background: '#059669', borderColor: '#059669', fontWeight: 700, whiteSpace: 'nowrap' }}
                      onClick={() => {
                        const target = statementStaff;
                        setStatementStaff(null);
                        openSalaryModal('payment', target);
                      }}
                    >
                      💸 Pay Salary
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                  onClick={() => {
                    const id = statementStaff.id;
                    setStatementStaff(null);
                    setPreviewSlipStaffId(id);
                  }}
                >
                  📄 View Salary Slip PDF
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatementStaff(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MODAL: ADMIN 1-CLICK STAFF PASSWORD RESET                             */}
      {/* ===================================================================== */}
      {resetPwStaff && (
        <div className="modal-overlay" onClick={() => setResetPwStaff(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '430px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  🔑 Reset Staff Password
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  Set a new login password for <strong>{resetPwStaff.name}</strong> ({resetPwStaff.phone})
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setResetPwStaff(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAdminResetPassword}>
              {resetPwError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginBottom: '0.85rem'
                  }}
                >
                  {resetPwError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input
                  type="text"
                  className="form-control"
                  value={resetPwValue}
                  onChange={(e) => setResetPwValue(e.target.value)}
                  minLength={4}
                  required
                />
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                  All users and staff can also reset a forgotten password on the Sign-In screen by verifying any 2 of: Unique ID, Phone Number, or Date of Birth.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.15rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResetPwStaff(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={resetPwBusy} style={{ fontWeight: 700 }}>
                  {resetPwBusy ? 'Saving...' : '🔑 Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SALARY SLIP PREVIEW, PRINT, PDF & WHATSAPP                     */}
      {/* ===================================================================== */}
      {previewSlipRow && (
        <div className="modal-overlay" onClick={() => setPreviewSlipStaffId(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '760px', width: '96%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  📄 Salary Slip — {previewSlipRow.staff.name}
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  Period: {formatPeriodLabel(reportStartDate, reportEndDate)} ·{' '}
                  <strong>{formatStaffSalaryTypeLabel(previewSlipRow.salaryType)}</strong> ({previewSlipRow.rateDisplay})
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setPreviewSlipStaffId(null)}>
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                gap: '0.6rem',
                marginBottom: '1rem',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              <div style={{ background: '#f8fafc', padding: '0.7rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700 }}>Attendance</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  {previewSlipRow.totalHoursWorked} hrs
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  {previewSlipRow.attendedShiftsCount} shift{previewSlipRow.attendedShiftsCount === 1 ? '' : 's'}
                </div>
              </div>

              <div style={{ background: '#eff6ff', padding: '0.7rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700 }}>Total Earnings</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e3a8a' }}>
                  ₹{previewSlipRow.totalEarnings.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#1e40af' }}>
                  {formatStaffSalaryTypeLabel(previewSlipRow.salaryType)} + Bonus
                </div>
              </div>

              <div style={{ background: '#ecfdf5', padding: '0.7rem', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <div style={{ fontSize: '0.72rem', color: '#065f46', fontWeight: 700 }}>Salary Paid</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>
                  ₹{previewSlipRow.regularPaymentsReceived.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#065f46' }}>
                  {previewSlipRow.regularPaymentRecords.length} standard payout{previewSlipRow.regularPaymentRecords.length === 1 ? '' : 's'}
                </div>
              </div>

              <div style={{ background: '#fffbeb', padding: '0.7rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>Salary Advance</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#d97706' }}>
                  ₹{previewSlipRow.advancesReceived.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#b45309' }}>
                  {previewSlipRow.advancePaymentRecords.length} advance{previewSlipRow.advancePaymentRecords.length === 1 ? '' : 's'}
                </div>
              </div>

              <div
                style={{
                  background: previewSlipRow.periodPayable > 0 ? '#fef2f2' : '#f8fafc',
                  padding: '0.7rem',
                  borderRadius: '8px',
                  border: `1px solid ${previewSlipRow.periodPayable > 0 ? '#fecaca' : '#cbd5e1'}`
                }}
              >
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: previewSlipRow.periodPayable > 0 ? '#991b1b' : '#334155',
                    fontWeight: 700
                  }}
                >
                  Net Payable
                </div>
                <div
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: previewSlipRow.periodPayable > 0 ? '#dc2626' : '#059669'
                  }}
                >
                  ₹{previewSlipRow.periodPayable.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  {previewSlipRow.periodPayable > 0 ? 'Balance due' : 'Period settled'}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
                paddingTop: '0.85rem',
                borderTop: '1px solid #e2e8f0',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ fontSize: '0.82rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                Overall Balance (All Dates):{' '}
                <strong style={{ color: previewSlipRow.overallBalancePayable > 0 ? '#dc2626' : '#059669' }}>
                  ₹{previewSlipRow.overallBalancePayable.toLocaleString('en-IN')}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                {canManageSalary && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        background: '#fffbeb',
                        borderColor: '#fcd34d',
                        color: '#b45309',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}
                      onClick={() => {
                        const target = previewSlipRow.staff;
                        setPreviewSlipStaffId(null);
                        openSalaryModal('advance', target);
                      }}
                    >
                      ⚡ Salary Advance
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ whiteSpace: 'nowrap' }}
                      onClick={() => {
                        const target = previewSlipRow.staff;
                        setPreviewSlipStaffId(null);
                        openSalaryModal('payment', target);
                      }}
                    >
                      💸 Pay Salary
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                  onClick={() =>
                    printSingleStaffSalarySlip(previewSlipRow, reportStartDate, reportEndDate, state)
                  }
                >
                  🖨️ Print Slip
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{
                    background: '#ecfdf5',
                    borderColor: '#6ee7b7',
                    color: '#047857',
                    fontWeight: 700,
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => setWaSlipRow(previewSlipRow)}
                >
                  💬 Send WA (PDF + Text)
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                  disabled={pdfBusyKey !== null}
                  onClick={() => handleDownloadSingleSlip(previewSlipRow)}
                >
                  {pdfBusyKey === `slip-${previewSlipRow.staff.id}` ? '⏳ Generating...' : '📥 Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: RECORD SALARY ADVANCE / STANDARD SALARY PAYOUT / ALLOWANCE     */}
      {/* ===================================================================== */}
      {salaryModalOpen && (
        <div className="modal-overlay" onClick={() => setSalaryModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                {salaryRecordType === 'advance'
                  ? '⚡ Record Salary Advance'
                  : salaryRecordType === 'payment'
                  ? '💸 Pay Standard Staff Salary'
                  : '➕ Add Duty Bonus / Allowance'}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setSalaryModalOpen(false)}>
                ✕
              </button>
            </div>

            {/* 3-Mode Segmented Selector Clearly Separating Salary Advance from Standard Payout */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.35rem',
                padding: '0.3rem',
                background: '#f1f5f9',
                borderRadius: '8px',
                marginBottom: '0.9rem'
              }}
            >
              {[
                { id: 'advance' as const, label: '⚡ Salary Advance', activeBg: '#d97706' },
                { id: 'payment' as const, label: '💸 Salary Payout', activeBg: '#059669' },
                { id: 'earning' as const, label: '➕ Allowance', activeBg: '#2563eb' }
              ].map((opt) => {
                const isSelected = salaryRecordType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => switchSalaryModalType(opt.id)}
                    style={{
                      padding: '0.45rem 0.5rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: isSelected ? opt.activeBg : 'transparent',
                      color: isSelected ? '#ffffff' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {salaryRecordType === 'advance' && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '0.6rem 0.8rem',
                  marginBottom: '0.9rem',
                  fontSize: '0.8rem',
                  color: '#92400e',
                  lineHeight: 1.45
                }}
              >
                <strong>Salary Advance Mode:</strong> Recorded separately from standard monthly/shift salary payouts on
                all statements and PDF salary slips, and automatically deducted from net payable balance.
              </div>
            )}

            <form onSubmit={handleSubmitSalary}>
              <div className="form-group">
                <label className="form-label">Select Staff Member *</label>
                <select
                  className="form-control"
                  value={salaryForm.staff_member_id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const sum = nextId ? store.getStaffSalarySummary(nextId) : null;
                    setSalaryForm({
                      ...salaryForm,
                      staff_member_id: nextId,
                      amount:
                        salaryRecordType === 'payment' && sum && sum.balancePayable > 0
                          ? sum.balancePayable
                          : salaryForm.amount
                    });
                  }}
                  required
                >
                  <option value="">Select staff...</option>
                  {state.staff.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.role_title || 'Crew'} — {formatStaffSalaryRate(st)})
                    </option>
                  ))}
                </select>
              </div>

              {salaryForm.staff_member_id && (() => {
                const sum = store.getStaffSalarySummary(salaryForm.staff_member_id);
                return (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      marginBottom: '0.9rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.4rem',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    <span>
                      Earned: <strong>₹{sum.totalEarned.toLocaleString('en-IN')}</strong> · Paid:{' '}
                      <strong style={{ color: '#059669' }}>₹{sum.totalRegularPaid.toLocaleString('en-IN')}</strong> ·
                      Advance:{' '}
                      <strong style={{ color: '#d97706' }}>₹{sum.totalAdvancePaid.toLocaleString('en-IN')}</strong>
                    </span>
                    <span style={{ fontWeight: 800, color: sum.balancePayable > 0 ? '#dc2626' : '#059669' }}>
                      Net Due: ₹{sum.balancePayable.toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              })()}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    {salaryRecordType === 'advance'
                      ? 'Advance Amount (₹) *'
                      : salaryRecordType === 'payment'
                      ? 'Salary Payout Amount (₹) *'
                      : 'Allowance Amount (₹) *'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="1"
                    className="form-control"
                    value={salaryForm.amount}
                    onChange={(e) =>
                      setSalaryForm({ ...salaryForm, amount: parseFloat(e.target.value) || 0 })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={salaryForm.recorded_at}
                    onChange={(e) => setSalaryForm({ ...salaryForm, recorded_at: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    {salaryRecordType === 'earning' ? 'Allowance Type' : 'Payment Method'}
                  </label>
                  {salaryRecordType === 'earning' ? (
                    <select
                      className="form-control"
                      value={salaryForm.method}
                      onChange={(e) => setSalaryForm({ ...salaryForm, method: e.target.value })}
                    >
                      <option value="Duty Allowance">Duty Allowance</option>
                      <option value="Travel / Night Batta">Travel / Night Batta</option>
                      <option value="Festival / Event Bonus">Festival / Event Bonus</option>
                    </select>
                  ) : (
                    <select
                      className="form-control"
                      value={salaryForm.method}
                      onChange={(e) => setSalaryForm({ ...salaryForm, method: e.target.value })}
                    >
                      <option value="UPI / GPay">UPI / GPay / PhonePe</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Linked Event (Optional)</label>
                  <select
                    className="form-control"
                    value={salaryForm.event_id}
                    onChange={(e) => setSalaryForm({ ...salaryForm, event_id: e.target.value })}
                  >
                    <option value="">General / Monthly</option>
                    {state.events
                      .filter((ev) => ev.status !== 'cancelled')
                      .map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.title} ({ev.event_date})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Note / Reference</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={
                    salaryRecordType === 'advance'
                      ? 'e.g. Mid-month salary advance, emergency advance...'
                      : 'e.g. GPay ref, monthly settlement...'
                  }
                  value={salaryForm.note}
                  onChange={(e) => setSalaryForm({ ...salaryForm, note: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.15rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSalaryModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    fontWeight: 700,
                    background:
                      salaryRecordType === 'advance'
                        ? '#d97706'
                        : salaryRecordType === 'payment'
                        ? '#059669'
                        : undefined,
                    borderColor:
                      salaryRecordType === 'advance'
                        ? '#d97706'
                        : salaryRecordType === 'payment'
                        ? '#059669'
                        : undefined
                  }}
                >
                  {salaryRecordType === 'advance'
                    ? '⚡ Save Salary Advance'
                    : salaryRecordType === 'payment'
                    ? '💸 Save Salary Payout'
                    : '➕ Save Allowance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADD / EDIT STAFF MEMBER (DECIDE SALARY STRUCTURE UPFRONT)      */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  {editingStaff ? 'Edit Staff & Salary Structure' : 'Register New Staff Member'}
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  Configure personal details, Unique ID, Date of Birth, and salary structure.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            {staffFormError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  borderRadius: '8px',
                  padding: '0.6rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  marginBottom: '0.9rem'
                }}
              >
                ⚠️ {staffFormError}
              </div>
            )}

            <form onSubmit={handleSubmitStaff}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Rafeeq K"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role / Designation *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Master Chef, Buffet Server"
                    value={formData.role_title}
                    onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.35rem',
                      marginBottom: '0.35rem'
                    }}
                  >
                    <label className="form-label" style={{ margin: 0 }}>
                      Unique ID *
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          unique_id: store.generateNextUniqueId('staff')
                        })
                      }
                      style={{
                        background: '#eef2ff',
                        border: '1px solid #c7d2fe',
                        color: '#4338ca',
                        borderRadius: '5px',
                        padding: '0.1rem 0.45rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      title="Generate next available Unique ID"
                    >
                      ↻ Auto ID
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-control"
                    style={{ textTransform: 'uppercase', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                    placeholder="e.g. STF-006"
                    value={formData.unique_id}
                    onChange={(e) =>
                      setFormData({ ...formData, unique_id: e.target.value.toUpperCase() })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Date of Birth *</label>
                  <input
                    type="date"
                    className="form-control"
                    max={todayYmd}
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Mobile Number (Login ID) *</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="e.g. 9847011223"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Login Password *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.74rem',
                  color: '#475569',
                  marginBottom: '0.9rem'
                }}
              >
                🔐 <strong>2-of-3 Password Recovery Enabled:</strong> If a password is forgotten, this staff member can reset it by verifying any <strong>2</strong> of their <strong>Unique ID</strong>, <strong>Mobile Number</strong>, or <strong>Date of Birth</strong>.
              </div>

              {/* Salary Structure Selector */}
              <div className="form-group">
                <label className="form-label">Salary Structure *</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.45rem'
                  }}
                >
                  {[
                    {
                      id: 'hourly' as StaffSalaryType,
                      title: '⏱ Per Hour',
                      sub: 'Paid per shift hour'
                    },
                    {
                      id: 'per_event' as StaffSalaryType,
                      title: '🎪 Per Event',
                      sub: 'Fixed rate per event'
                    },
                    {
                      id: 'monthly' as StaffSalaryType,
                      title: '📅 Monthly',
                      sub: 'Fixed monthly salary'
                    }
                  ].map((opt) => {
                    const active = formData.salary_type === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, salary_type: opt.id })}
                        style={{
                          padding: '0.6rem 0.55rem',
                          borderRadius: '8px',
                          border: `1.5px solid ${active ? '#2563eb' : '#cbd5e1'}`,
                          background: active ? '#eff6ff' : '#ffffff',
                          color: '#0f172a',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '0.84rem', color: active ? '#1d4ed8' : '#0f172a' }}>
                          {opt.title}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.1rem' }}>
                          {opt.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {formData.salary_type === 'hourly' && (
                <div className="form-group">
                  <label className="form-label">Per Hour Salary Rate (INR ₹ / hr) *</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    className="form-control"
                    value={formData.hourly_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })
                    }
                    required
                  />
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.28rem' }}>
                    Automatically multiplies attended shift hours by ₹{formData.hourly_rate || 0}/hr.
                  </div>
                </div>
              )}

              {formData.salary_type === 'per_event' && (
                <div className="form-group">
                  <label className="form-label">Per Event Salary Rate (INR ₹ / event) *</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    className="form-control"
                    value={formData.event_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, event_rate: parseFloat(e.target.value) || 0 })
                    }
                    required
                  />
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.28rem' }}>
                    Credits ₹{(formData.event_rate || 0).toLocaleString('en-IN')} flat for each event shift marked Present.
                  </div>
                </div>
              )}

              {formData.salary_type === 'monthly' && (
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Monthly Fixed Salary (INR ₹ / month) *</label>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      className="form-control"
                      value={formData.monthly_salary}
                      onChange={(e) =>
                        setFormData({ ...formData, monthly_salary: parseFloat(e.target.value) || 0 })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Salary Effective From *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.salary_start_date}
                      onChange={(e) => setFormData({ ...formData, salary_start_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
              )}

              {editingStaff && (() => {
                const prevType = getStaffSalaryType(editingStaff);
                const prevHourly = Number(editingStaff.hourly_rate || 0);
                const prevEventRate = Number(editingStaff.event_rate ?? editingStaff.hourly_rate ?? 0);
                const prevMonthly = Number(editingStaff.monthly_salary ?? editingStaff.hourly_rate ?? 0);
                const rateChanged =
                  formData.salary_type !== prevType ||
                  (formData.salary_type === 'hourly' && Number(formData.hourly_rate) !== prevHourly) ||
                  (formData.salary_type === 'per_event' && Number(formData.event_rate) !== prevEventRate) ||
                  (formData.salary_type === 'monthly' && Number(formData.monthly_salary) !== prevMonthly);
                const existingShiftsCount = state.shifts.filter(
                  (sh) => sh.staff_member_id === editingStaff.id
                ).length;

                if (!rateChanged) return null;

                return (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0.75rem 0.85rem',
                      marginBottom: '0.9rem'
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.2rem' }}>
                      Existing Event Shifts Rate Policy ({existingShiftsCount} Assigned Shift{existingShiftsCount === 1 ? '' : 's'})
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#475569', marginBottom: '0.55rem', lineHeight: 1.45 }}>
                      Previous rate was <strong>{formatStaffSalaryRate(editingStaff)}</strong>. Choose how existing assigned
                      event shifts should handle this new pricing:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {[
                        {
                          id: 'keep_existing' as ShiftRateUpdateMode,
                          title: 'Keep existing assigned shifts at their original rate (Recommended)',
                          sub: 'Applies new rate only to shifts assigned from now on; past & current quotes remain unchanged.'
                        },
                        {
                          id: 'update_upcoming' as ShiftRateUpdateMode,
                          title: 'Switch upcoming (uncompleted) event shifts to this new rate',
                          sub: 'Updates scheduled upcoming shifts & recalculates their quotation Labour Charges; completed events stay locked.'
                        },
                        {
                          id: 'update_all_unsettled' as ShiftRateUpdateMode,
                          title: 'Switch all non-settled shifts to this new rate',
                          sub: 'Updates shifts on events without a settled/final invoice.'
                        }
                      ].map((opt) => {
                        const selected = shiftRateUpdateMode === opt.id;
                        return (
                          <label
                            key={opt.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                              padding: '0.45rem 0.6rem',
                              borderRadius: '6px',
                              border: `1px solid ${selected ? '#2563eb' : '#e2e8f0'}`,
                              background: selected ? '#eff6ff' : '#ffffff',
                              cursor: 'pointer'
                            }}
                          >
                            <input
                              type="radio"
                              name="shiftRateUpdateMode"
                              checked={selected}
                              onChange={() => setShiftRateUpdateMode(opt.id)}
                              style={{ marginTop: '0.2rem' }}
                            />
                            <div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                                {opt.title}
                              </div>
                              <div style={{ fontSize: '0.71rem', color: '#64748b', lineHeight: 1.4 }}>
                                {opt.sub}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="staffActive"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                />
                <label htmlFor="staffActive" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Available for event scheduling
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: editingStaff && canEditStaff ? 'space-between' : 'flex-end',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginTop: '1.25rem',
                  flexWrap: 'wrap'
                }}
              >
                {editingStaff && canEditStaff && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      const target = editingStaff;
                      setIsModalOpen(false);
                      setStaffToDelete(target);
                    }}
                  >
                    🗑 Remove Staff
                  </button>
                )}
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                    {editingStaff ? 'Save Changes' : 'Register Staff'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Permanent Staff Removal Modal */}
      {staffToDelete && (() => {
        const delSummary = store.getStaffSalarySummary(staffToDelete.id);
        return (
          <div className="modal-overlay" onClick={() => setStaffToDelete(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
              <div className="modal-header">
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#dc2626' }}>
                  🗑 Remove Staff Member
                </h2>
                <button className="btn btn-secondary btn-sm" onClick={() => setStaffToDelete(null)}>
                  ✕
                </button>
              </div>

              <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.5, marginBottom: '0.9rem' }}>
                Permanently remove <strong>{staffToDelete.name}</strong> ({staffToDelete.phone})? Pending balance: ₹
                {delSummary.balancePayable.toLocaleString('en-IN')}.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStaffToDelete(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ fontWeight: 700 }}
                  onClick={handleConfirmDeleteStaff}
                >
                  🗑 Yes, Remove Staff
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Staff Duty Assignment WhatsApp Notification Module */}
      <StaffWhatsAppModal
        isOpen={Boolean(whatsAppModalEvent)}
        onClose={() => {
          setWhatsAppModalEvent(null);
          setWhatsAppModalShift(null);
        }}
        event={whatsAppModalEvent}
        targetShift={whatsAppModalShift}
        initialNote={whatsAppModalShift?.duty_note || ''}
      />

      {/* Staff Salary Slip PDF + Text WhatsApp Modal */}
      <SalarySlipWhatsAppModal
        row={waSlipRow}
        startDate={reportStartDate}
        endDate={reportEndDate}
        state={state}
        onClose={() => setWaSlipRow(null)}
      />
    </div>
  );
}
