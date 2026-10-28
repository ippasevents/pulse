'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { StaffMember, StaffSalaryRecordType } from '@/lib/types';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';

export default function StaffPage() {
  const [state, setState] = useState(store.getState());
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

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

  // Individual Staff Statement Modal
  const [statementStaff, setStatementStaff] = useState<StaffMember | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
  const canEditStaff = role === 'owner' || role === 'manager';
  const canManageSalary = role === 'owner' || role === 'manager' || role === 'accountant';

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff &amp; Salary Management</h1>
          <p className="page-subtitle">
            Manage banquet crew roster, shift earnings, salary payments disbursed, and pending balances payable.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
          <span className="stats-sub">Shift wages &amp; duty allowances</span>
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
                <th style={{ textAlign: 'center' }}>Shifts / Hours</th>
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
                      <div style={{ fontWeight: 600 }}>{summary.shiftItems.length} shifts</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {summary.totalShiftHours} hrs
                      </div>
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
                        {canEditStaff && (
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

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Salary Payments & Allowances History */}
        <div className="card">
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
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                if (confirm('Remove this salary entry? Staff balance will update immediately.')) {
                                  store.deleteStaffSalaryRecord(rec.id);
                                }
                              }}
                            >
                              ✕
                            </button>
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

        {/* Upcoming Shifts Schedule */}
        <div className="card">
          <h2 className="card-title">📅 Assigned Event Shifts</h2>
          {state.shifts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No upcoming shifts scheduled. Assign shifts from inside any event page.
            </p>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Staff Assigned</th>
                    <th>Timing &amp; Hours</th>
                    <th style={{ textAlign: 'right' }}>Shift Wage</th>
                  </tr>
                </thead>
                <tbody>
                  {state.shifts.map((sh) => {
                    const evt = state.events.find((e) => e.id === sh.event_id);
                    const st = state.staff.find((s) => s.id === sh.staff_member_id);
                    const hrs = store.calculateShiftHours(sh.starts_at, sh.ends_at);
                    const wage = Math.round(hrs * Number(st?.hourly_rate || 0));
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
                            {evt?.event_date}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{st?.name || 'Unassigned'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {sh.role_label || st?.role_title}
                          </div>
                          {role === 'owner' && (
                            <OwnerAuditBadge
                              role={role}
                              entry={store.getEntityAudit(sh.id, ['shift'])}
                              prefixLabel="Assigned by"
                            />
                          )}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          <div>
                            {sh.starts_at.slice(11, 16)} - {sh.ends_at.slice(11, 16)}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{hrs} hrs</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          ₹{wage.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
                Shift &amp; Allowance Earnings ({sum.shiftItems.length + sum.earningRecords.length})
              </h3>
              <div className="data-table-container" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event / Allowance</th>
                      <th>Details</th>
                      <th style={{ textAlign: 'right' }}>Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sum.earningRecords.map((er) => (
                      <tr key={er.id}>
                        <td>{new Date(er.recorded_at).toLocaleDateString('en-GB')}</td>
                        <td style={{ fontWeight: 600 }}>{er.method}</td>
                        <td>{er.note || 'Manual wage entry'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          ₹{er.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    {sum.shiftItems.map((si) => (
                      <tr key={si.shift.id}>
                        <td>{si.event?.event_date || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{si.event?.title || 'Event Shift'}</td>
                        <td>
                          {si.hours} hrs @ ₹{si.hourlyRate}/hr ({si.shift.role_label || 'Crew'})
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          ₹{si.earnedAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingStaff ? 'Save Changes' : 'Register Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
