import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchMyForms } from '../api/client';

const STEP_LABEL = {
  hr_division: 'HR Division',
  employee: 'Employee',
  supervisor: 'Supervisor',
  sbu_hr: 'SBU HR',
  done: 'Complete',
};

export default function Dashboard() {
  const { profile, role, logout } = useAuth();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role) { setLoading(false); return; }
    fetchMyForms().then(setForms).finally(() => setLoading(false));
  }, [role]);

  if (!role) {
    return (
      <div style={s.wrap}>
        <Header profile={profile} logout={logout} />
        <div style={s.emptyCard}>
          <h2 style={s.emptyTitle}>Waiting on Admin</h2>
          <p style={s.emptyText}>
            Your account is signed in, but no role has been assigned yet. Ask an
            Admin to assign you a role before any forms can appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <Header profile={profile} logout={logout} />
      {role === 'admin' && (
        <Link to="/admin" style={s.adminLink}>Go to Admin Dashboard →</Link>
      )}
      <h1 style={s.title}>My Forms</h1>
      {loading ? (
        <p>Loading…</p>
      ) : forms.length === 0 ? (
        <p style={s.emptyText}>No forms assigned to you yet.</p>
      ) : (
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
        </div>
      )}
    </div>
  );
}

function Header({ profile, logout }) {
  return (
    <div style={s.header}>
      <div>
        <div style={s.eyebrow}>Human Resources</div>
        <div style={s.name}>{profile?.display_name || profile?.email}</div>
      </div>
      <button style={s.logoutBtn} onClick={logout}>Sign out</button>
    </div>
  );
}

const s = {
  wrap: { maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: 'Inter, system-ui, sans-serif', color: '#16233F' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  eyebrow: { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A93A6', fontWeight: 600 },
  name: { fontSize: 14, fontWeight: 700 },
  logoutBtn: { background: 'transparent', border: '1px solid #E1E5EC', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' },
  title: { fontSize: 22, fontWeight: 800, marginBottom: 18 },
  adminLink: { display: 'inline-block', fontSize: 12.5, fontWeight: 700, color: '#3457D5', textDecoration: 'none', marginBottom: 18 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #E1E5EC', borderRadius: 10, padding: '14px 18px', textDecoration: 'none', color: 'inherit' },
  rowTitle: { fontWeight: 700, fontSize: 14.5 },
  rowSub: { fontSize: 12.5, color: '#5A6577', marginTop: 2 },
  badge: { fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 100 },
  badgeProgress: { background: '#EEF1FD', color: '#3457D5' },
  badgeDone: { background: '#EAF6F3', color: '#1E8A73' },
  emptyCard: { background: '#fff', border: '1px solid #E1E5EC', borderRadius: 10, padding: '24px' },
  emptyTitle: { fontSize: 16, fontWeight: 700, margin: '0 0 8px' },
  emptyText: { fontSize: 13.5, color: '#5A6577', lineHeight: 1.6 },
};
