import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllForms, fetchAllUsers, createForm, setUserRole, deleteUser } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const ROLES = ['admin', 'hr_division', 'employee', 'supervisor', 'sbu_hr'];
const STEP_LABEL = { hr_division: 'HR Division', employee: 'Employee', supervisor: 'Supervisor', sbu_hr: 'SBU HR', done: 'Complete' };

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [forms, setForms] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userError, setUserError] = useState(null);

  const refresh = () => {
    setLoading(true);
    Promise.all([fetchAllForms(), fetchAllUsers()])
      .then(([f, u]) => { setForms(f); setUsers(u); })
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const handleRemoveUser = async (u) => {
    if (!window.confirm(`Remove ${u.display_name || u.email}? This can't be undone.`)) return;
    setUserError(null);
    try {
      await deleteUser(u.id);
      refresh();
    } catch (e) {
      setUserError(e?.response?.data?.detail || 'Could not remove this user.');
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.headerRow}>
        <div>
          <div style={s.eyebrow}>Admin</div>
          <h1 style={s.title}>Form Workflows</h1>
        </div>
        <button style={s.primaryBtn} onClick={() => setShowCreate(true)}>+ Create Fresh Form</button>
      </div>

      {loading ? <p>Loading…</p> : (
        <div style={s.list}>
          {forms.map((f) => (
            <Link key={f.id} to={`/forms/${f.id}`} style={s.row}>
              <div>
                <div style={s.rowTitle}>{f.employee_name || 'Untitled Review'}</div>
                <div style={s.rowSub}>Currently with: {STEP_LABEL[f.current_step] || f.current_step}</div>
              </div>
              <span style={{ ...s.badge, ...(f.status === 'completed' ? s.badgeDone : s.badgeProgress) }}>
                {f.status === 'completed' ? 'Completed' : 'In progress'}
              </span>
            </Link>
          ))}
          {forms.length === 0 && <p style={s.emptyText}>No forms created yet.</p>}
        </div>
      )}

      <h2 style={s.subTitle}>Manage User Roles</h2>
      {userError && <div style={s.errorBox}>{userError}</div>}
      <div style={s.userTable}>
        {users.map((u) => (
          <div key={u.id} style={s.userRow}>
            <div>
              <div style={s.rowTitle}>{u.display_name || u.email}</div>
              <div style={s.rowSub}>{u.email}</div>
            </div>
            <div style={s.userActions}>
              <select
                value={u.role || ''}
                onChange={async (e) => {
                  const role = e.target.value;
                  if (!role) return;
                  await setUserRole(u.id, role);
                  refresh();
                }}
                style={{ ...s.select, width: 'auto', minWidth: 170 }}
              >
                <option value="" disabled>No role assigned</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {u.id !== profile?.id && (
                <button style={s.removeBtn} onClick={() => handleRemoveUser(u)}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateFormModal
          users={users}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh(); }}
        />
      )}
    </div>
  );
}

function CreateFormModal({ users, onClose, onCreated }) {
  const [assignments, setAssignments] = useState({
    hr_division_email: '', employee_email: '', supervisor_email: '', sbu_hr_email: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const byRole = (role) => users.filter((u) => u.role === role);

  const fields = [
    { key: 'hr_division_email', label: 'HR Division', role: 'hr_division' },
    { key: 'employee_email', label: 'Employee', role: 'employee' },
    { key: 'supervisor_email', label: 'Supervisor', role: 'supervisor' },
    { key: 'sbu_hr_email', label: 'SBU HR', role: 'sbu_hr' },
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const form = await createForm(assignments);
      onCreated(form);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not create form');
    } finally {
      setSubmitting(false);
    }
  };

  const allFilled = Object.values(assignments).every((v) => v);

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <h3 style={s.modalTitle}>Create Fresh Form</h3>
        <p style={s.rowSub}>Assign one person to each role for this specific review.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '18px 0' }}>
          {fields.map((f) => (
            <div key={f.key}>
              <label style={s.label}>{f.label}</label>
              <select
                style={s.select}
                value={assignments[f.key]}
                onChange={(e) => setAssignments((prev) => ({ ...prev, [f.key]: e.target.value }))}
              >
                <option value="" disabled>Select a user with role: {f.role}</option>
                {byRole(f.role).map((u) => (
                  <option key={u.id} value={u.email}>{u.display_name || u.email}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {error && <p style={{ color: '#C0392B', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button style={s.secondaryBtn} onClick={onClose}>Cancel</button>
          <button style={s.primaryBtn} disabled={!allFilled || submitting} onClick={handleSubmit}>
            {submitting ? 'Creating…' : 'Create Form'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  wrap: { maxWidth: 780, margin: '0 auto', padding: '32px 24px', fontFamily: 'Inter, system-ui, sans-serif', color: '#16233F' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 },
  eyebrow: { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A93A6', fontWeight: 600 },
  title: { fontSize: 22, fontWeight: 800, margin: '2px 0 0' },
  subTitle: { fontSize: 16, fontWeight: 700, margin: '32px 0 14px' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #E1E5EC', borderRadius: 10, padding: '14px 18px', textDecoration: 'none', color: 'inherit' },
  rowTitle: { fontWeight: 700, fontSize: 14.5 },
  rowSub: { fontSize: 12.5, color: '#5A6577', marginTop: 2 },
  badge: { fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 100 },
  badgeProgress: { background: '#EEF1FD', color: '#3457D5' },
  badgeDone: { background: '#EAF6F3', color: '#1E8A73' },
  emptyText: { fontSize: 13.5, color: '#5A6577' },
  primaryBtn: { background: '#16233F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' },
  secondaryBtn: { background: '#fff', border: '1px solid #E1E5EC', borderRadius: 8, padding: '10px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' },
  userTable: { display: 'flex', flexDirection: 'column', gap: 8 },
  userRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #E1E5EC', borderRadius: 8, padding: '10px 16px' },
  userActions: { display: 'flex', alignItems: 'center', gap: 10 },
  removeBtn: { background: '#fff', color: '#C0392B', border: '1px solid #F0C4C4', borderRadius: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  errorBox: { background: '#FBEAEA', border: '1px solid #F0C4C4', color: '#A93226', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 12 },
  select: { border: '1px solid #E1E5EC', borderRadius: 7, padding: '9px 10px', fontSize: 13.5, width: '100%', fontFamily: 'Inter, system-ui, sans-serif' },
  label: { fontSize: 12, fontWeight: 600, color: '#5A6577', display: 'block', marginBottom: 6 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(22,35,63,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 12, padding: '26px 28px', width: 420, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' },
  modalTitle: { fontSize: 17, fontWeight: 800, margin: 0 },
};