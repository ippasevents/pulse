'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { EventRecord, Shift, ShiftAttendanceStatus, StaffMember, StaffSalaryRecordType } from '@/lib/types';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';
import StaffWhatsAppModal from '@/components/StaffWhatsAppModal';
import {
  computeStaffPeriodReport,
  downloadBatchStaffSalarySlipsPdf,
  downloadSingleStaffSalarySlipPdf,
  downloadStaffPayrollSummaryPdf,
  formatDisplayDate,
  formatPeriodLabel,
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
  const [activeTab, setActiveTab] = useState<'roster' | 'report'>('roster');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Date-Range Salary Report & Payslips State
  const initialBounds = getInitialMonthBounds();
  const [reportStartDate, setReportStartDate] = useState<string>(initialBounds.start);
  const [reportEndDate, setReportEndDate] = useState<string>(initialBounds.end);
  const [reportStaffFilter, setReportStaffFilter] = useState<string>('');
  const [reportSearch, setReportSearch] = useState<string>('');
  const [reportActiveInPeriodOnly, setReportActiveInPeriodOnly] = useState<boolean>(false);
  const [previewSlipStaffId, setPreviewSlipStaffId] = useState<string | null>(null);
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null);

  // Salary Payment / Extra Wage Modal
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

  // Individual Staff Statement Modal & Removal Confirmation States
  const [statementStaff, setStatementStaff] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [confirmRemoveShiftId, setConfirmRemoveShiftId] = useState<string | null>(null);
  const [confirmDeleteSalaryId, setConfirmDeleteSalaryId] = useState<string | null>(null);
  const [attendanceEventFilter, setAttendanceEventFilter] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [whatsAppModalEvent, setWhatsAppModalEvent] = useState<EventRecord | null>(null);
  const [whatsAppModalShift, setWhatsAppModalShift] = useState<Shift | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: 'password123',
    role_title: 'Buffet Server',
    hourly_rate: 200,
    active: true
  });

  useEffect(() => {
    setState(store.getState());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const role = state.currentRole;
  const canEditStaff = role === 'owner' || role === 'manager' || role === 'super_admin';
  const canManageSalary = role === 'owner' || role === 'manager' || role === 'accountant' || role === 'super_admin';
  const canMarkAttendance = role === 'owner' || role === 'manager' || role === 'accountant' || role === 'super_admin';

  // Summaries across all staff
  const staffRows = state.staff.map((st) => ({
    staff: st,
    summary: store.getStaffSalarySummary(st.id)
  }));

  const filteredStaffRows = staffRows.filter(
    ({ staff }) =>
      staff.name.toLowerCase().includes(search.toLowerCase()) ||
      (staff.phone && staff.phone.includes(search)) ||
      (staff.role_title && staff.role_title.toLowerCase().includes(search.toLowerCase()))
  );

  const totalEarnedAll = staffRows.reduce((sum, r) => sum + r.summary.totalEarned, 0);
  const totalPaidAll = staffRows.reduce((sum, r) => sum + r.summary.totalPaid, 0);
  const totalPendingAll = staffRows.reduce((sum, r) => sum + r.summary.balancePayable, 0);
  const activeCrewCount = state.staff.filter((s) => s.active).length;

  const handleSubmitStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingStaff) {
      store.updateStaff(editingStaff.id, formData);
      showNotice(`Updated staff member ${formData.name}.`);
    } else {
      store.addStaff(formData);
      showNotice(`Registered new staff member ${formData.name}.`);
    }
    setIsModalOpen(false);
    setEditingStaff(null);
    setFormData({
      name: '',
      phone: '',
      password: 'password123',
      role_title: 'Buffet Server',
      hourly_rate: 200,
      active: true
    });
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
            : 500
          : 500,
      method: type === 'payment' ? 'UPI / GPay' : 'Duty Allowance',
      recorded_at: new Date().toISOString().slice(0, 10),
      note: ''
    });
    setSalaryModalOpen(true);
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
      salaryRecordType === 'payment'
        ? `Salary payment of ₹${Number(salaryForm.amount).toLocaleString('en-IN')} recorded for ${targetStaff?.name || 'staff'}.`
        : `Duty wage / allowance of ₹${Number(salaryForm.amount).toLocaleString('en-IN')} added for ${targetStaff?.name || 'staff'}.`
    );
  };

  const recentSalaryRecords = [...(state.staffSalaryRecords || [])].sort((a, b) =>
    b.recorded_at.localeCompare(a.recorded_at)
  );

  const filteredShifts = state.shifts.filter((sh) =>
    attendanceEventFilter ? sh.event_id === attendanceEventFilter : true
  );

  const handleMarkShiftAttendance = (shiftId: string, status: ShiftAttendanceStatus, staffName?: string) => {
    store.updateShiftAttendance(shiftId, status);
    const label = status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : 'Pending';
    showNotice(`Attendance marked "${label}"${staffName ? ` for ${staffName}` : ''}.`);
  };

  const handleConfirmDeleteStaff = () => {
    if (!staffToDelete) return;
    const removedName = staffToDelete.name;
    store.deleteStaff(staffToDelete.id);
    if (statementStaff?.id === staffToDelete.id) {
      setStatementStaff(null);
    }
    if (editingStaff?.id === staffToDelete.id) {
      setEditingStaff(null);
      setIsModalOpen(false);
    }
    setStaffToDelete(null);
    showNotice(`Removed "${removedName}" from staff roster & database.`);
  };

  // Date-range report computation & preset helpers
  const applyDatePreset = (preset: 'this_month' | 'last_month' | 'next_month' | 'last_30' | 'this_year' | 'all') => {
    const now = new Date();
    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setReportStartDate(toLocalYmd(start));
      setReportEndDate(toLocalYmd(end));
    } else if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setReportStartDate(toLocalYmd(start));
      setReportEndDate(toLocalYmd(end));
    } else if (preset === 'next_month') {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      setReportStartDate(toLocalYmd(start));
      setReportEndDate(toLocalYmd(end));
    } else if (preset === 'last_30') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      setReportStartDate(toLocalYmd(start));
      setReportEndDate(toLocalYmd(now));
    } else if (preset === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      setReportStartDate(toLocalYmd(start));
      setReportEndDate(toLocalYmd(end));
    } else {
      setReportStartDate('');
      setReportEndDate('');
    }
  };

  const fullPeriodReport = computeStaffPeriodReport(
    state,
    reportStartDate,
    reportEndDate,
    reportStaffFilter || undefined
  );

  const visibleReportRows = fullPeriodReport.rows.filter((r) => {
    if (reportActiveInPeriodOnly && !r.hasActivityInRange) return false;
    if (reportSearch.trim()) {
      const q = reportSearch.trim().toLowerCase();
      const matchName = r.staff.name.toLowerCase().includes(q);
      const matchPhone = (r.staff.phone || '').includes(q);
      const matchRole = (r.staff.role_title || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchRole) return false;
    }
    return true;
  });

  const visibleReportTotals = {
    staffCount: visibleReportRows.length,
    activeStaffInPeriod: visibleReportRows.filter((r) => r.hasActivityInRange).length,
    attendedShiftsCount: visibleReportRows.reduce((s, r) => s + r.attendedShiftsCount, 0),
    totalHoursWorked: Number(
      visibleReportRows.reduce((s, r) => s + r.totalHoursWorked, 0).toFixed(2)
    ),
    shiftEarnings: visibleReportRows.reduce((s, r) => s + r.shiftEarnings, 0),
    extraEarnings: visibleReportRows.reduce((s, r) => s + r.extraEarnings, 0),
    totalEarnings: visibleReportRows.reduce((s, r) => s + r.totalEarnings, 0),
    paymentsReceived: visibleReportRows.reduce((s, r) => s + r.paymentsReceived, 0),
    paymentCount: visibleReportRows.reduce((s, r) => s + r.paymentRecords.length, 0),
    periodPayable: visibleReportRows.reduce((s, r) => s + r.periodPayable, 0)
  };

  const previewSlipRow: StaffPeriodReportRow | null = previewSlipStaffId
    ? computeStaffPeriodReport(state, reportStartDate, reportEndDate, previewSlipStaffId).rows[0] ||
      null
    : null;

  const handleDownloadSingleSlip = async (row: StaffPeriodReportRow) => {
    const key = `slip-${row.staff.id}`;
    setPdfBusyKey(key);
    try {
      const ok = await downloadSingleStaffSalarySlipPdf(
        row,
        reportStartDate,
        reportEndDate,
        state
      );
      if (ok) {
        showNotice(`Downloaded PDF salary slip for ${row.staff.name}.`);
      }
    } finally {
      setPdfBusyKey(null);
    }
  };

  const handleDownloadAllSlips = async () => {
    if (visibleReportRows.length === 0) return;
    setPdfBusyKey('batch-slips');
    try {
      const ok = await downloadBatchStaffSalarySlipsPdf(
        visibleReportRows,
        reportStartDate,
        reportEndDate,
        state
      );
      if (ok) {
        showNotice(`Exported ${visibleReportRows.length} staff salary slip(s) as PDF.`);
      }
    } finally {
      setPdfBusyKey(null);
    }
  };

  const handleDownloadSummaryReport = async () => {
    setPdfBusyKey('summary-report');
    try {
      const ok = await downloadStaffPayrollSummaryPdf(
        visibleReportRows,
        visibleReportTotals,
        reportStartDate,
        reportEndDate,
        state
      );
      if (ok) {
        showNotice('Exported Master Staff Payroll Report PDF.');
      }
    } finally {
      setPdfBusyKey(null);
    }
  };

  const openStaffSalarySlipReport = (staff: StaffMember, openPreview: boolean = true) => {
    setActiveTab('report');
    setReportStaffFilter(staff.id);
    if (openPreview) {
      setPreviewSlipStaffId(staff.id);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Finance &amp; Attendance Register</h1>
          <p className="page-subtitle">
            Track event shift attendance, shift wages (strictly shown &amp; counted only when Present), salary payouts, and exportable PDF salary slips.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'report' ? 'roster' : 'report')}
            className="btn btn-secondary"
            style={{
              fontWeight: 700,
              background: activeTab === 'report' ? '#0f172a' : '#eff6ff',
              color: activeTab === 'report' ? '#ffffff' : '#1d4ed8',
              borderColor: activeTab === 'report' ? '#0f172a' : '#bfdbfe'
            }}
          >
            {activeTab === 'report' ? '← Back to Roster & Attendance' : '📄 Salary Report & PDF Slips'}
          </button>
          {canManageSalary && (
            <>
              <button
                type="button"
                onClick={() => openSalaryModal('payment')}
                className="btn btn-primary"
                style={{ fontWeight: 600 }}
              >
                💸 Record Salary Payment
              </button>
              <button
                type="button"
                onClick={() => openSalaryModal('earning')}
                className="btn btn-secondary"
                style={{ fontWeight: 600 }}
              >
                + Add Duty Wage / Bonus
              </button>
            </>
          )}
          {canEditStaff && (
            <button
              type="button"
              onClick={() => {
                setEditingStaff(null);
                setFormData({
                  name: '',
                  phone: '',
                  password: 'password123',
                  role_title: 'Buffet Server',
                  hourly_rate: 200,
                  active: true
                });
                setIsModalOpen(true);
              }}
              className="btn btn-secondary"
            >
              + Register Staff Member
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          style={{
            background: '#dcfce7',
            border: '1px solid #86efac',
            color: '#166534',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
        >
          ✓ {notice}
        </div>
      )}

      {/* View Mode Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.35rem',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '0.5rem',
          flexWrap: 'wrap'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.93rem',
            cursor: 'pointer',
            background: activeTab === 'roster' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'roster' ? '#ffffff' : '#475569',
            transition: 'all 0.15s ease'
          }}
        >
          🧑‍🍳 Staff Roster &amp; Shift Attendance
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('report')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.93rem',
            cursor: 'pointer',
            background: activeTab === 'report' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'report' ? '#ffffff' : '#475569',
            transition: 'all 0.15s ease'
          }}
        >
          📄 Salary Report &amp; Payslips (PDF)
        </button>
      </div>

      {activeTab === 'report' ? (
        <div>
          {/* Date Range & Filter Controls */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem',
                flexWrap: 'wrap',
                marginBottom: '1rem'
              }}
            >
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  📅 Staff Payroll Summary &amp; Salary Slip Generator
                </h2>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Showing period: <strong>{formatPeriodLabel(reportStartDate, reportEndDate)}</strong> &bull; Only attended shifts marked <strong>Present</strong> are counted toward hours worked and shift wages.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {reportStaffFilter && visibleReportRows.length === 1 ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontWeight: 700 }}
                      onClick={() => setPreviewSlipStaffId(visibleReportRows[0].staff.id)}
                    >
                      👁 Preview Salary Slip
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontWeight: 700 }}
                      disabled={pdfBusyKey !== null}
                      onClick={() => handleDownloadSingleSlip(visibleReportRows[0])}
                    >
                      {pdfBusyKey === `slip-${visibleReportRows[0].staff.id}`
                        ? '⏳ Generating PDF...'
                        : `📥 Export Salary Slip PDF (${visibleReportRows[0].staff.name})`}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        fontWeight: 700,
                        background: '#f8fafc',
                        borderColor: '#cbd5e1',
                        color: '#0f172a'
                      }}
                      disabled={pdfBusyKey !== null || visibleReportRows.length === 0}
                      onClick={handleDownloadSummaryReport}
                    >
                      {pdfBusyKey === 'summary-report'
                        ? '⏳ Generating Report...'
                        : '📊 Export Payroll Summary PDF'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontWeight: 700 }}
                      disabled={pdfBusyKey !== null || visibleReportRows.length === 0}
                      onClick={handleDownloadAllSlips}
                    >
                      {pdfBusyKey === 'batch-slips'
                        ? '⏳ Building Salary Slips...'
                        : `📑 Export All Salary Slips PDF (${visibleReportRows.length})`}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Date Pickers + Staff Selector + Search */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
                gap: '0.85rem',
                alignItems: 'end',
                marginBottom: '0.9rem'
              }}
            >
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.3rem', display: 'block' }}>
                  Start Date (From)
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.3rem', display: 'block' }}>
                  End Date (To)
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.3rem', display: 'block' }}>
                  Staff Member
                </label>
                <select
                  className="form-control"
                  value={reportStaffFilter}
                  onChange={(e) => setReportStaffFilter(e.target.value)}
                >
                  <option value="">All Staff Members ({state.staff.length})</option>
                  {state.staff.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.role_title || 'Crew'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '0.3rem', display: 'block' }}>
                  Search Crew
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Name, phone, or role..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Quick Date Range Presets & Activity Filter */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
                paddingTop: '0.75rem',
                borderTop: '1px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginRight: '0.2rem' }}>
                  Quick Range:
                </span>
                {[
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_month', label: 'Last Month' },
                  { id: 'next_month', label: 'Next Month' },
                  { id: 'last_30', label: 'Last 30 Days' },
                  { id: 'this_year', label: 'This Year' },
                  { id: 'all', label: 'All Dates' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.76rem', fontWeight: 600 }}
                    onClick={() =>
                      applyDatePreset(
                        p.id as 'this_month' | 'last_month' | 'next_month' | 'last_30' | 'this_year' | 'all'
                      )
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <input
                  type="checkbox"
                  checked={reportActiveInPeriodOnly}
                  onChange={(e) => setReportActiveInPeriodOnly(e.target.checked)}
                  style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span>Show only staff with shifts/payments in period</span>
              </label>
            </div>
          </div>

          {/* Period KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}
          >
            <div className="stats-card" style={{ borderLeft: '4px solid #475569' }}>
              <span className="stats-label">Total Hours Worked</span>
              <span className="stats-value" style={{ color: '#0f172a' }}>
                {visibleReportTotals.totalHoursWorked} hrs
              </span>
              <span className="stats-sub">
                Across {visibleReportTotals.attendedShiftsCount} attended shift{visibleReportTotals.attendedShiftsCount === 1 ? '' : 's'}
              </span>
            </div>

            <div className="stats-card" style={{ borderLeft: '4px solid #2563eb' }}>
              <span className="stats-label">Total Earnings (Period)</span>
              <span className="stats-value" style={{ color: '#2563eb' }}>
                ₹{visibleReportTotals.totalEarnings.toLocaleString('en-IN')}
              </span>
              <span className="stats-sub">
                ₹{visibleReportTotals.shiftEarnings.toLocaleString('en-IN')} shifts + ₹{visibleReportTotals.extraEarnings.toLocaleString('en-IN')} allowances
              </span>
            </div>

            <div className="stats-card" style={{ borderLeft: '4px solid #059669' }}>
              <span className="stats-label">Payments Received (Period)</span>
              <span className="stats-value" style={{ color: '#059669' }}>
                ₹{visibleReportTotals.paymentsReceived.toLocaleString('en-IN')}
              </span>
              <span className="stats-sub">
                {visibleReportTotals.paymentCount} disbursement{visibleReportTotals.paymentCount === 1 ? '' : 's'} recorded
              </span>
            </div>

            <div className="stats-card" style={{ borderLeft: '4px solid #dc2626' }}>
              <span className="stats-label">Net Period Payable</span>
              <span
                className="stats-value"
                style={{ color: visibleReportTotals.periodPayable > 0 ? '#dc2626' : '#059669' }}
              >
                ₹{visibleReportTotals.periodPayable.toLocaleString('en-IN')}
              </span>
              <span className="stats-sub">
                Remaining unpaid earnings for selected range
              </span>
            </div>
          </div>

          {/* Staff Payroll Period Table */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.9rem',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}
            >
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  🧾 Staff Period Earnings, Hours &amp; Salary Slips
                </h2>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Click <strong>Preview Slip</strong> to inspect itemized duty shifts &amp; payouts, or <strong>PDF Slip</strong> to download an official A4 staff salary slip.
                </p>
              </div>
              {reportStaffFilter && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setReportStaffFilter('')}
                >
                  Show All Staff
                </button>
              )}
            </div>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Member &amp; Rate</th>
                    <th style={{ textAlign: 'center' }}>Present Shifts</th>
                    <th style={{ textAlign: 'center' }}>Total Hours Worked</th>
                    <th style={{ textAlign: 'right' }}>Shift Wages</th>
                    <th style={{ textAlign: 'right' }}>Allowances</th>
                    <th style={{ textAlign: 'right' }}>Total Earnings</th>
                    <th style={{ textAlign: 'right' }}>Payments Received</th>
                    <th style={{ textAlign: 'right' }}>Period Balance</th>
                    <th style={{ textAlign: 'center' }}>Salary Slip (PDF)</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReportRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        <div>No staff records match the selected date range and filters.</div>
                        {(reportActiveInPeriodOnly || reportSearch || reportStaffFilter) && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ marginTop: '0.6rem' }}
                            onClick={() => {
                              setReportActiveInPeriodOnly(false);
                              setReportSearch('');
                              setReportStaffFilter('');
                            }}
                          >
                            Reset Filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    visibleReportRows.map((row) => (
                      <tr key={row.staff.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.staff.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {row.staff.role_title || 'Service Crew'} &bull; ₹{row.staff.hourly_rate}/hr
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            {row.attendedShiftsCount}
                          </span>
                          {(row.absentShiftsCount > 0 || row.pendingShiftsCount > 0) && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {row.absentShiftsCount > 0 ? `${row.absentShiftsCount} abs` : ''}
                              {row.absentShiftsCount > 0 && row.pendingShiftsCount > 0 ? ' • ' : ''}
                              {row.pendingShiftsCount > 0 ? `${row.pendingShiftsCount} pend` : ''}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                          {row.totalHoursWorked} hrs
                        </td>
                        <td style={{ textAlign: 'right', color: '#334155', fontWeight: 600 }}>
                          ₹{row.shiftEarnings.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>
                          ₹{row.extraEarnings.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          ₹{row.totalEarnings.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          ₹{row.paymentsReceived.toLocaleString('en-IN')}
                          {row.paymentRecords.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                              {row.paymentRecords.length} payment{row.paymentRecords.length === 1 ? '' : 's'}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: row.periodPayable > 0 ? '#dc2626' : '#059669'
                            }}
                          >
                            ₹{row.periodPayable.toLocaleString('en-IN')}
                          </div>
                          {row.periodAdvanceExcess > 0 && (
                            <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: 600 }}>
                              Advance: +₹{row.periodAdvanceExcess.toLocaleString('en-IN')}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setPreviewSlipStaffId(row.staff.id)}
                              title="Preview itemized salary slip for this period"
                            >
                              👁 Preview Slip
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={pdfBusyKey !== null}
                              onClick={() => handleDownloadSingleSlip(row)}
                              title="Download official A4 Salary Slip PDF"
                            >
                              {pdfBusyKey === `slip-${row.staff.id}` ? '⏳...' : '📥 PDF Slip'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {visibleReportRows.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                      <td>TOTAL ({visibleReportRows.length} Staff)</td>
                      <td style={{ textAlign: 'center' }}>{visibleReportTotals.attendedShiftsCount}</td>
                      <td style={{ textAlign: 'center' }}>{visibleReportTotals.totalHoursWorked} hrs</td>
                      <td style={{ textAlign: 'right' }}>
                        ₹{visibleReportTotals.shiftEarnings.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right', color: '#2563eb' }}>
                        ₹{visibleReportTotals.extraEarnings.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        ₹{visibleReportTotals.totalEarnings.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right', color: '#059669' }}>
                        ₹{visibleReportTotals.paymentsReceived.toLocaleString('en-IN')}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: visibleReportTotals.periodPayable > 0 ? '#dc2626' : '#059669'
                        }}
                      >
                        ₹{visibleReportTotals.periodPayable.toLocaleString('en-IN')}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Inline Itemized Breakdown when a single staff member is selected */}
          {reportStaffFilter && visibleReportRows.length === 1 && (() => {
            const singleRow = visibleReportRows[0];
            return (
              <div className="grid-2" style={{ gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div className="card">
                  <h3 className="card-title" style={{ fontSize: '1rem' }}>
                    🧑‍🍳 {singleRow.staff.name} — Shifts &amp; Allowances ({singleRow.attendedShifts.length + singleRow.allowanceRecords.length})
                  </h3>
                  {singleRow.attendedShifts.length === 0 && singleRow.allowanceRecords.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      No attended shifts or allowances recorded in this period.
                    </p>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Event / Duty</th>
                            <th style={{ textAlign: 'center' }}>Hours</th>
                            <th style={{ textAlign: 'right' }}>Earned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleRow.attendedShifts.map((s) => (
                            <tr key={s.shift.id}>
                              <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatDisplayDate(s.date)}</td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{s.event?.title || 'Event Shift'}</div>
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                                  {s.shift.role_label || singleRow.staff.role_title} &bull; ₹{s.hourlyRate}/hr
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.hours} hrs</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                ₹{s.earnedAmount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                          {singleRow.allowanceRecords.map((al) => (
                            <tr key={al.id}>
                              <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatDisplayDate(al.recorded_at)}</td>
                              <td>
                                <div style={{ fontWeight: 600, color: '#1d4ed8' }}>{al.method}</div>
                                {al.note && (
                                  <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{al.note}</div>
                                )}
                              </td>
                              <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Fixed
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>
                                ₹{al.amount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3 className="card-title" style={{ fontSize: '1rem' }}>
                    💸 {singleRow.staff.name} — Payments Received ({singleRow.paymentRecords.length})
                  </h3>
                  {singleRow.paymentRecords.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      No salary payments recorded in this period.
                    </p>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Method</th>
                            <th>Note</th>
                            <th style={{ textAlign: 'right' }}>Received</th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleRow.paymentRecords.map((pay) => (
                            <tr key={pay.id}>
                              <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatDisplayDate(pay.recorded_at)}</td>
                              <td style={{ fontWeight: 600 }}>{pay.method}</td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pay.note || '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                ₹{pay.amount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <>
      {/* Top Salary & Crew KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div className="stats-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <span className="stats-label">Total Staff Salary Earned</span>
          <span className="stats-value" style={{ color: '#2563eb' }}>
            ₹{totalEarnedAll.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">Attended shifts only + allowances</span>
        </div>

        <div className="stats-card" style={{ borderLeft: '4px solid #059669' }}>
          <span className="stats-label">Total Salary Paid (Received)</span>
          <span className="stats-value" style={{ color: '#059669' }}>
            ₹{totalPaidAll.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">Disbursed via Cash, UPI &amp; Bank</span>
        </div>

        <div className="stats-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <span className="stats-label">Pending Salary Payable</span>
          <span
            className="stats-value"
            style={{ color: totalPendingAll > 0 ? '#dc2626' : '#059669' }}
          >
            ₹{totalPendingAll.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">Remaining salary balance to pay staff</span>
        </div>

        <div className="stats-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <span className="stats-label">Active Crew Roster</span>
          <span className="stats-value" style={{ color: '#7c3aed' }}>
            {activeCrewCount} / {state.staff.length}
          </span>
          <span className="stats-sub">Available for banquet duty</span>
        </div>
      </div>

      {/* Staff Salary & Balance Directory */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>
              🧑‍🍳 Staff Salary &amp; Balance Ledger
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Real-time breakdown of each staff member&apos;s earned wages, salary received, and balance remaining to pay.
            </p>
          </div>
          <div style={{ minWidth: '250px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search staff by name, phone, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff Name &amp; Login Phone</th>
                <th>Role &amp; Rate</th>
                <th style={{ textAlign: 'center' }}>Attended Shifts / Hours</th>
                <th style={{ textAlign: 'right' }}>Total Earned</th>
                <th style={{ textAlign: 'right' }}>Salary Paid</th>
                <th style={{ textAlign: 'right' }}>Balance Payable</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaffRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No staff members found.
                  </td>
                </tr>
              ) : (
                filteredStaffRows.map(({ staff, summary }) => (
                  <tr key={staff.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{staff.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        📞 {staff.phone || 'No phone'}
                      </div>
                      {role === 'owner' && (
                        <OwnerAuditBadge
                          role={role}
                          entry={store.getEntityAudit(staff.id, ['staff'])}
                          prefixLabel="Updated by"
                        />
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{staff.role_title || 'Service Crew'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                        ₹{staff.hourly_rate}/hr
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#059669' }}>
                        {summary.attendedShiftsCount} attended ({summary.totalShiftHours} hrs)
                      </div>
                      {(summary.absentShiftsCount > 0 || summary.pendingShiftsCount > 0) && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {summary.absentShiftsCount > 0 ? `${summary.absentShiftsCount} absent` : ''}
                          {summary.absentShiftsCount > 0 && summary.pendingShiftsCount > 0 ? ' • ' : ''}
                          {summary.pendingShiftsCount > 0 ? `${summary.pendingShiftsCount} pending` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                      ₹{summary.totalEarned.toLocaleString('en-IN')}
                      {summary.extraEarnings > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 500 }}>
                          (+₹{summary.extraEarnings.toLocaleString('en-IN')} bonus)
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                      ₹{summary.totalPaid.toLocaleString('en-IN')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontWeight: 800,
                          color: summary.balancePayable > 0 ? '#dc2626' : '#059669'
                        }}
                      >
                        ₹{summary.balancePayable.toLocaleString('en-IN')}
                      </div>
                      {summary.advanceExcess > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: 600 }}>
                          Advance: +₹{summary.advanceExcess.toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>
                    <td>
                      {summary.balancePayable > 0 ? (
                        <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>
                          Balance Due
                        </span>
                      ) : summary.totalEarned > 0 || summary.totalPaid > 0 ? (
                        <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                          Settled
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            background: staff.active ? '#f1f5f9' : '#e2e8f0',
                            color: '#475569'
                          }}
                        >
                          {staff.active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {canManageSalary && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              title="Record Salary or Advance Payment"
                              onClick={() => openSalaryModal('payment', staff)}
                            >
                              💸 Pay
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="Add Fixed Duty Wage or Bonus"
                              onClick={() => openSalaryModal('earning', staff)}
                            >
                              + Wage
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          title="View Complete Salary Statement"
                          onClick={() => setStatementStaff(staff)}
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
                            fontWeight: 600
                          }}
                          title="Open Date-Range Salary Slip & Export PDF"
                          onClick={() => openStaffSalarySlipReport(staff, true)}
                        >
                          📄 Slip
                        </button>
                        {canEditStaff && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setEditingStaff(staff);
                                setFormData({
                                  name: staff.name,
                                  phone: staff.phone || '',
                                  password: staff.password || 'password123',
                                  role_title: staff.role_title || '',
                                  hourly_rate: staff.hourly_rate,
                                  active: staff.active
                                });
                                setIsModalOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              title="Remove this staff member permanently"
                              onClick={() => setStaffToDelete(staff)}
                            >
                              🗑 Remove
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

      {/* Event Shift Attendance Register (Strict Attendance-Gated Pay) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>
              📋 Event Shift Attendance Register
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Mark whether each assigned crew member attended the event. <strong>Shift payment is displayed and counted ONLY when marked Present.</strong> Absent or unmarked shifts never show or accrue pay.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-control"
              style={{ width: 'auto', minWidth: '220px', fontSize: '0.85rem' }}
              value={attendanceEventFilter}
              onChange={(e) => setAttendanceEventFilter(e.target.value)}
            >
              <option value="">All Events ({state.shifts.length} assigned shifts)</option>
              {state.events
                .filter((ev) => state.shifts.some((sh) => sh.event_id === ev.id))
                .map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({ev.event_date})
                  </option>
                ))}
            </select>

            {canMarkAttendance && attendanceEventFilter && filteredShifts.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    fontWeight: 700,
                    background: '#16a34a',
                    color: '#ffffff',
                    border: '1px solid #15803d'
                  }}
                  onClick={() => {
                    const evt = state.events.find((e) => e.id === attendanceEventFilter) || null;
                    setWhatsAppModalShift(null);
                    setWhatsAppModalEvent(evt);
                  }}
                >
                  💬 Notify Event Crew on WhatsApp
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 600 }}
                  onClick={() => {
                    store.markEventShiftsAttendance(attendanceEventFilter, 'present');
                    showNotice('Marked all shifts for the selected event as Present.');
                  }}
                >
                  ✓ Mark All Present
                </button>
              </>
            )}
          </div>
        </div>

        {filteredShifts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No assigned event shifts found. Schedule crew shifts from inside any Event page.
          </p>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event &amp; Date</th>
                  <th>Assigned Staff &amp; Role</th>
                  <th>Shift Timing</th>
                  <th style={{ textAlign: 'center' }}>WhatsApp Alert</th>
                  <th style={{ textAlign: 'center' }}>Attendance Register</th>
                  <th style={{ textAlign: 'right' }}>Shift Payment (Present Only)</th>
                  {canEditStaff && <th style={{ textAlign: 'center' }}>Remove Shift</th>}
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((sh) => {
                  const evt = state.events.find((e) => e.id === sh.event_id);
                  const st = state.staff.find((s) => s.id === sh.staff_member_id);
                  const hrs = store.calculateShiftHours(sh.starts_at, sh.ends_at);
                  const attStatus: ShiftAttendanceStatus =
                    sh.attendance_status === 'present' || sh.attendance_status === 'absent'
                      ? sh.attendance_status
                      : 'pending';
                  const isPresent = attStatus === 'present' && evt?.status !== 'cancelled';
                  const earnedPay = isPresent ? Math.round(hrs * Number(st?.hourly_rate || 0)) : 0;

                  return (
                    <tr key={sh.id}>
                      <td>
                        <Link
                          href={`/events/${evt?.id}`}
                          style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'underline' }}
                        >
                          {evt?.title || 'Unknown Event'}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {evt?.event_date} {evt?.venue ? `• ${evt.venue}` : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{st?.name || 'Unassigned'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {sh.role_label || st?.role_title}
                        </div>
                        {role === 'owner' && (
                          <OwnerAuditBadge
                            role={role}
                            entry={store.getEntityAudit(sh.id, ['shift'])}
                            prefixLabel="Updated by"
                          />
                        )}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        <div style={{ fontWeight: 600 }}>
                          {sh.starts_at.slice(11, 16)} - {sh.ends_at.slice(11, 16)}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{hrs} hrs</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {evt && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              background: sh.whatsapp_notified_at ? '#f0fdf4' : '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #86efac',
                              fontWeight: 700,
                              fontSize: '0.73rem',
                              padding: '0.24rem 0.55rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                            onClick={() => {
                              setWhatsAppModalShift(sh);
                              setWhatsAppModalEvent(evt);
                            }}
                          >
                            <span>💬</span>
                            <span>{sh.whatsapp_notified_at ? '✓ Sent' : 'Notify'}</span>
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {canMarkAttendance ? (
                          <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                background: attStatus === 'present' ? '#16a34a' : '#f1f5f9',
                                color: attStatus === 'present' ? '#ffffff' : '#334155',
                                border: `1px solid ${attStatus === 'present' ? '#15803d' : '#cbd5e1'}`,
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.55rem'
                              }}
                              onClick={() => handleMarkShiftAttendance(sh.id, 'present', st?.name)}
                            >
                              ✓ Present
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                background: attStatus === 'absent' ? '#dc2626' : '#f1f5f9',
                                color: attStatus === 'absent' ? '#ffffff' : '#334155',
                                border: `1px solid ${attStatus === 'absent' ? '#b91c1c' : '#cbd5e1'}`,
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.55rem'
                              }}
                              onClick={() => handleMarkShiftAttendance(sh.id, 'absent', st?.name)}
                            >
                              ✕ Absent
                            </button>
                            {attStatus !== 'pending' && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  background: '#ffffff',
                                  color: '#64748b',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.72rem',
                                  padding: '0.25rem 0.45rem'
                                }}
                                title="Reset attendance to Pending"
                                onClick={() => handleMarkShiftAttendance(sh.id, 'pending', st?.name)}
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        ) : (
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              color:
                                attStatus === 'present'
                                  ? '#15803d'
                                  : attStatus === 'absent'
                                  ? '#dc2626'
                                  : '#b45309'
                            }}
                          >
                            {attStatus === 'present'
                              ? '✓ Present'
                              : attStatus === 'absent'
                              ? '✕ Absent'
                              : '⏳ Pending'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isPresent ? (
                          <span style={{ fontWeight: 800, color: '#059669', fontSize: '0.95rem' }}>
                            ₹{earnedPay.toLocaleString('en-IN')}
                          </span>
                        ) : attStatus === 'absent' ? (
                          <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>
                            — (Absent)
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            — (Mark Present to unlock)
                          </span>
                        )}
                      </td>
                      {canEditStaff && (
                        <td style={{ textAlign: 'center' }}>
                          {confirmRemoveShiftId === sh.id ? (
                            <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                                onClick={() => {
                                  store.removeShift(sh.id);
                                  setConfirmRemoveShiftId(null);
                                  showNotice(`Removed shift for ${st?.name || 'staff'} from ${evt?.title || 'event'}.`);
                                }}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                                onClick={() => setConfirmRemoveShiftId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ fontSize: '0.74rem', padding: '0.22rem 0.5rem' }}
                              title="Unassign staff from this event shift"
                              onClick={() => setConfirmRemoveShiftId(sh.id)}
                            >
                              ✕ Remove
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

      {/* Salary Payments & Allowances History */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title">💳 Recent Salary Payments &amp; Wage Entries</h2>
        {recentSalaryRecords.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No salary payments or wage adjustments recorded yet.
          </p>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Staff Member</th>
                  <th>Type</th>
                  <th>Method / Note</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  {canManageSalary && <th style={{ textAlign: 'center' }}>Delete</th>}
                </tr>
              </thead>
              <tbody>
                {recentSalaryRecords.slice(0, 15).map((rec) => {
                  const st = state.staff.find((s) => s.id === rec.staff_member_id);
                  const isPayment = rec.record_type === 'payment';
                  return (
                    <tr key={rec.id}>
                      <td style={{ fontSize: '0.8rem' }}>
                        {new Date(rec.recorded_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{st?.name || 'Staff Member'}</div>
                        {role === 'owner' && (
                          <OwnerAuditBadge
                            role={role}
                            entry={store.getEntityAudit(rec.id, ['salary'])}
                            prefixLabel="Recorded by"
                          />
                        )}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: isPayment ? '#dcfce7' : '#dbeafe',
                            color: isPayment ? '#15803d' : '#1d4ed8',
                            fontWeight: 600
                          }}
                        >
                          {isPayment ? 'Salary Paid' : 'Duty Wage'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <div>{rec.method}</div>
                        {rec.note && <div style={{ color: 'var(--text-muted)' }}>{rec.note}</div>}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: isPayment ? '#059669' : '#2563eb'
                        }}
                      >
                        ₹{rec.amount.toLocaleString('en-IN')}
                      </td>
                      {canManageSalary && (
                        <td style={{ textAlign: 'center' }}>
                          {confirmDeleteSalaryId === rec.id ? (
                            <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                                onClick={() => {
                                  store.deleteStaffSalaryRecord(rec.id);
                                  setConfirmDeleteSalaryId(null);
                                  showNotice('Removed salary entry. Staff balance updated.');
                                }}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                                onClick={() => setConfirmDeleteSalaryId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              title="Delete this salary entry"
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
        </>
      )}

      {/* Interactive Staff Salary Slip Preview & PDF Export Modal */}
      {previewSlipRow && (
        <div className="modal-overlay" onClick={() => setPreviewSlipStaffId(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '760px', width: '96%' }}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.22rem', fontWeight: 800, margin: 0 }}>
                  📄 Staff Salary Slip — {previewSlipRow.staff.name}
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Period: <strong>{formatPeriodLabel(reportStartDate, reportEndDate)}</strong> &bull; {previewSlipRow.staff.role_title || 'Crew'} &bull; Rate: ₹{previewSlipRow.staff.hourly_rate}/hr
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setPreviewSlipStaffId(null)}>
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}
            >
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '0.73rem', color: '#475569', fontWeight: 700 }}>Total Hours Worked</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  {previewSlipRow.totalHoursWorked} hrs
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {previewSlipRow.attendedShiftsCount} attended shift{previewSlipRow.attendedShiftsCount === 1 ? '' : 's'}
                </div>
              </div>

              <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.73rem', color: '#1e40af', fontWeight: 700 }}>Total Earnings</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a8a' }}>
                  ₹{previewSlipRow.totalEarnings.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#1e40af' }}>
                  Shifts + Allowances
                </div>
              </div>

              <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <div style={{ fontSize: '0.73rem', color: '#065f46', fontWeight: 700 }}>Payments Received</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>
                  ₹{previewSlipRow.paymentsReceived.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#065f46' }}>
                  {previewSlipRow.paymentRecords.length} payment{previewSlipRow.paymentRecords.length === 1 ? '' : 's'}
                </div>
              </div>

              <div
                style={{
                  background: previewSlipRow.periodPayable > 0 ? '#fef2f2' : '#f8fafc',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${previewSlipRow.periodPayable > 0 ? '#fecaca' : '#cbd5e1'}`
                }}
              >
                <div style={{ fontSize: '0.73rem', color: previewSlipRow.periodPayable > 0 ? '#991b1b' : '#334155', fontWeight: 700 }}>
                  Net Period Payable
                </div>
                <div
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: previewSlipRow.periodPayable > 0 ? '#dc2626' : '#059669'
                  }}
                >
                  ₹{previewSlipRow.periodPayable.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {previewSlipRow.periodPayable > 0 ? 'Balance due for period' : 'Period settled'}
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.45rem' }}>
              1. Attended Shifts &amp; Allowances ({previewSlipRow.attendedShifts.length + previewSlipRow.allowanceRecords.length})
            </h3>
            {previewSlipRow.attendedShifts.length === 0 && previewSlipRow.allowanceRecords.length === 0 ? (
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                No attended shifts or allowances recorded in this date range.
              </p>
            ) : (
              <div className="data-table-container" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event / Allowance</th>
                      <th style={{ textAlign: 'center' }}>Hours / Type</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewSlipRow.attendedShifts.map((s) => (
                      <tr key={s.shift.id}>
                        <td>{formatDisplayDate(s.date)}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{s.event?.title || 'Event Shift'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {s.shift.role_label || previewSlipRow.staff.role_title} ({(s.shift.starts_at || '').slice(11, 16)}–{(s.shift.ends_at || '').slice(11, 16)})
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.hours} hrs</td>
                        <td style={{ textAlign: 'right' }}>₹{s.hourlyRate}/hr</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          ₹{s.earnedAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    {previewSlipRow.allowanceRecords.map((al) => (
                      <tr key={al.id}>
                        <td>{formatDisplayDate(al.recorded_at)}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1d4ed8' }}>{al.method}</div>
                          {al.note && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{al.note}</div>}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Allowance</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Fixed</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>
                          ₹{al.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.45rem' }}>
              2. Payments Received in Period ({previewSlipRow.paymentRecords.length})
            </h3>
            {previewSlipRow.paymentRecords.length === 0 ? (
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                No salary payments recorded in this date range.
              </p>
            ) : (
              <div className="data-table-container" style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Note</th>
                      <th style={{ textAlign: 'right' }}>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewSlipRow.paymentRecords.map((pay) => (
                      <tr key={pay.id}>
                        <td>{formatDisplayDate(pay.recorded_at)}</td>
                        <td style={{ fontWeight: 600 }}>{pay.method}</td>
                        <td>{pay.note || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          ₹{pay.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

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
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Overall Account Balance (All Dates):{' '}
                <strong style={{ color: previewSlipRow.overallBalancePayable > 0 ? '#dc2626' : '#059669' }}>
                  ₹{previewSlipRow.overallBalancePayable.toLocaleString('en-IN')}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {canManageSalary && previewSlipRow.periodPayable > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const target = previewSlipRow.staff;
                      setPreviewSlipStaffId(null);
                      openSalaryModal('payment', target);
                    }}
                  >
                    💸 Record Payment
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontWeight: 700 }}
                  disabled={pdfBusyKey !== null}
                  onClick={() => handleDownloadSingleSlip(previewSlipRow)}
                >
                  {pdfBusyKey === `slip-${previewSlipRow.staff.id}`
                    ? '⏳ Generating PDF...'
                    : '📥 Download Salary Slip PDF'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPreviewSlipStaffId(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Salary Payment / Extra Wage Modal */}
      {salaryModalOpen && (
        <div className="modal-overlay" onClick={() => setSalaryModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                {salaryRecordType === 'payment'
                  ? '💸 Record Staff Salary Payment'
                  : '➕ Add Duty Wage / Bonus Allowance'}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setSalaryModalOpen(false)}>
                ✕
              </button>
            </div>

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
                      {st.name} ({st.role_title || 'Crew'} — {st.phone})
                    </option>
                  ))}
                </select>
              </div>

              {salaryForm.staff_member_id && (() => {
                const s = store.getStaffSalarySummary(salaryForm.staff_member_id);
                return (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      marginBottom: '1rem',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span>Total Salary Earned:</span>
                      <strong>₹{s.totalEarned.toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', marginBottom: '0.25rem' }}>
                      <span>Salary Already Paid:</span>
                      <strong>₹{s.totalPaid.toLocaleString('en-IN')}</strong>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderTop: '1px solid #cbd5e1',
                        paddingTop: '0.35rem',
                        fontWeight: 700,
                        color: s.balancePayable > 0 ? '#dc2626' : '#059669'
                      }}
                    >
                      <span>Pending Balance Payable:</span>
                      <span>₹{s.balancePayable.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    {salaryRecordType === 'payment' ? 'Payment Amount (₹) *' : 'Wage / Bonus Amount (₹) *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={salaryForm.amount}
                    onChange={(e) => setSalaryForm({ ...salaryForm, amount: parseFloat(e.target.value) || 0 })}
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
                    {salaryRecordType === 'payment' ? 'Payment Method' : 'Allowance Category'}
                  </label>
                  {salaryRecordType === 'payment' ? (
                    <select
                      className="form-control"
                      value={salaryForm.method}
                      onChange={(e) => setSalaryForm({ ...salaryForm, method: e.target.value })}
                    >
                      <option value="UPI / GPay">UPI / GPay / PhonePe</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  ) : (
                    <select
                      className="form-control"
                      value={salaryForm.method}
                      onChange={(e) => setSalaryForm({ ...salaryForm, method: e.target.value })}
                    >
                      <option value="Duty Allowance">Fixed Event Duty Wage</option>
                      <option value="Overtime Bonus">Overtime / Extra Hours</option>
                      <option value="Travel Allowance">Travel / Night Allowance</option>
                      <option value="Monthly Salary">Monthly Fixed Salary</option>
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
                    <option value="">General / All Duties</option>
                    {state.events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.event_date})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reference / Note</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={
                    salaryRecordType === 'payment'
                      ? 'e.g. Salary settlement via GPay, Advance paid...'
                      : 'e.g. Special wedding banquet captain bonus...'
                  }
                  value={salaryForm.note}
                  onChange={(e) => setSalaryForm({ ...salaryForm, note: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSalaryModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
                  {salaryRecordType === 'payment' ? 'Save Salary Payment' : 'Add Wage Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Staff Salary Statement Modal */}
      {statementStaff && (() => {
        const sum = store.getStaffSalarySummary(statementStaff.id);
        return (
          <div className="modal-overlay" onClick={() => setStatementStaff(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', width: '96%' }}>
              <div className="modal-header">
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                    📋 Salary Statement — {statementStaff.name}
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {statementStaff.role_title} &bull; Phone: {statementStaff.phone} &bull; Rate: ₹{statementStaff.hourly_rate}/hr
                  </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setStatementStaff(null)}>
                  ✕
                </button>
              </div>

              <div className="grid-3" style={{ marginBottom: '1rem' }}>
                <div style={{ background: '#eff6ff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>Total Earned</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a' }}>
                    ₹{sum.totalEarned.toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ background: '#ecfdf5', padding: '0.85rem', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 600 }}>Salary Received</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
                    ₹{sum.totalPaid.toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ background: sum.balancePayable > 0 ? '#fef2f2' : '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>Balance Payable</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: sum.balancePayable > 0 ? '#dc2626' : '#059669' }}>
                    ₹{sum.balancePayable.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Salary Payments Received ({sum.paymentRecords.length})
              </h3>
              {sum.paymentRecords.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  No salary payments recorded yet.
                </p>
              ) : (
                <div className="data-table-container" style={{ marginBottom: '1rem' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Note</th>
                        <th style={{ textAlign: 'right' }}>Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sum.paymentRecords.map((p) => (
                        <tr key={p.id}>
                          <td>{new Date(p.recorded_at).toLocaleDateString('en-GB')}</td>
                          <td>{p.method}</td>
                          <td>{p.note || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                            ₹{p.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Shift Attendance &amp; Allowance Earnings ({sum.shiftItems.length + sum.earningRecords.length})
              </h3>
              <div className="data-table-container" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event / Allowance</th>
                      <th>Attendance</th>
                      <th>Details</th>
                      <th style={{ textAlign: 'right' }}>Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sum.earningRecords.map((er) => (
                      <tr key={er.id}>
                        <td>{new Date(er.recorded_at).toLocaleDateString('en-GB')}</td>
                        <td style={{ fontWeight: 600 }}>{er.method}</td>
                        <td>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>
                            Allowance
                          </span>
                        </td>
                        <td>{er.note || 'Manual wage entry'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                          ₹{er.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    {sum.shiftItems.map((si) => (
                      <tr key={si.shift.id}>
                        <td>{si.event?.event_date || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{si.event?.title || 'Event Shift'}</td>
                        <td>
                          {si.attendanceStatus === 'present' ? (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>
                              ✓ Present
                            </span>
                          ) : si.attendanceStatus === 'absent' ? (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}>
                              ✕ Absent
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309' }}>
                              ⏳ Pending
                            </span>
                          )}
                        </td>
                        <td>
                          {si.isAttended
                            ? `${si.hours} hrs @ ₹${si.hourlyRate}/hr (${si.shift.role_label || 'Crew'})`
                            : `${si.hours} hrs (${si.shift.role_label || 'Crew'})`}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {si.isAttended ? (
                            <span style={{ color: '#059669' }}>
                              ₹{si.earnedAmount.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <div>
                  {canEditStaff && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        const target = statementStaff;
                        setStatementStaff(null);
                        setStaffToDelete(target);
                      }}
                    >
                      🗑 Remove Staff
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      background: '#eff6ff',
                      borderColor: '#bfdbfe',
                      color: '#1d4ed8',
                      fontWeight: 700
                    }}
                    onClick={() => {
                      const target = statementStaff;
                      setStatementStaff(null);
                      openStaffSalarySlipReport(target, true);
                    }}
                  >
                    📄 Export Salary Slip PDF
                  </button>
                  {canManageSalary && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const target = statementStaff;
                        setStatementStaff(null);
                        openSalaryModal('payment', target);
                      }}
                    >
                      💸 Pay Balance
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatementStaff(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Register / Edit Staff Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingStaff ? 'Edit Staff Member' : 'Register Crew Member'}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitStaff}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Shyam Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Phone Number (Login Username) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 9745111001"
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
                    placeholder="Default: password123"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Primary Role</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Senior Captain, Buffet Server, Sous Chef"
                    value={formData.role_title}
                    onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Hourly Wage Rate (INR ₹) *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.hourly_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="staffActive"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                />
                <label htmlFor="staffActive" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Available for scheduling
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
                    className="btn btn-danger"
                    onClick={() => {
                      const target = editingStaff;
                      setIsModalOpen(false);
                      setStaffToDelete(target);
                    }}
                  >
                    🗑 Remove Staff
                  </button>
                )}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
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
        const totalAssignedShifts = delSummary.shiftItems.length;
        return (
          <div className="modal-overlay" onClick={() => setStaffToDelete(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="modal-header">
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#dc2626' }}>
                  🗑 Remove Staff Member
                </h2>
                <button className="btn btn-secondary btn-sm" onClick={() => setStaffToDelete(null)}>
                  ✕
                </button>
              </div>

              <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.5, marginBottom: '1rem' }}>
                Are you sure you want to permanently remove <strong>{staffToDelete.name}</strong> from your staff roster?
              </p>

              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  marginBottom: '1rem',
                  fontSize: '0.84rem',
                  color: '#7f1d1d'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span>Role &amp; Phone Login:</span>
                  <strong>
                    {staffToDelete.role_title || 'Crew'} ({staffToDelete.phone || 'No phone'})
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span>Assigned Event Shifts:</span>
                  <strong>{totalAssignedShifts} shift(s)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span>Earned / Paid:</span>
                  <strong>
                    ₹{delSummary.totalEarned.toLocaleString('en-IN')} / ₹{delSummary.totalPaid.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid #fca5a5',
                    paddingTop: '0.35rem',
                    marginTop: '0.35rem',
                    fontWeight: 700
                  }}
                >
                  <span>Pending Balance Payable:</span>
                  <span>₹{delSummary.balancePayable.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '1.25rem' }}>
                Removing this staff member will revoke their mobile login and remove their assigned shifts and salary records across the website, server, and SQL database. (Tip: If you only want to pause scheduling while keeping past history, click <strong>Edit</strong> and uncheck <em>Available for scheduling</em> instead.)
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStaffToDelete(null)}
                >
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
    </div>
  );
}
