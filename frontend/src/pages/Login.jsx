import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Navigate } from 'react-router-dom';

// Matches the backend's DEV_ADMIN_EMAIL default (see backend/app/main.py) —
// signing in with this address lands you on the Admin Dashboard immediately.
const DEFAULT_ADMIN_EMAIL = 'admin@local.dev';

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    login(email.trim(), name.trim() || undefined);
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.eyebrow}>Human Resources · Performance Documentation</div>
        <h1 style={styles.title}>Probation Progress Review</h1>
        <p style={styles.sub}>
          Local dev login — no Azure required yet. Enter any email to sign in;
          the backend creates that person automatically.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ textAlign: 'left' }}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div style={{ textAlign: 'left' }}>
            <label style={styles.label}>Display name (optional)</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button style={styles.btn} type="submit">Continue</button>
        </form>
        <button
          style={styles.linkBtn}
          onClick={() => login(DEFAULT_ADMIN_EMAIL, 'Admin')}
        >
          Sign in as the seeded Admin ({DEFAULT_ADMIN_EMAIL})
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EEF1F6', fontFamily: 'Inter, system-ui, sans-serif' },
  card: { background: '#fff', border: '1px solid #E1E5EC', borderRadius: 12, padding: '36px 40px', width: 380, textAlign: 'center', boxShadow: '0 4px 18px rgba(22,35,63,0.08)' },
  eyebrow: { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A6577', fontWeight: 600, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: 800, color: '#16233F', margin: '0 0 10px' },
  sub: { fontSize: 13, color: '#5A6577', margin: '0 0 22px', lineHeight: 1.6 },
  label: { fontSize: 12, fontWeight: 600, color: '#5A6577', display: 'block', marginBottom: 5 },
  input: { width: '100%', border: '1px solid #E1E5EC', borderRadius: 7, padding: '9px 11px', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none' },
  btn: { background: '#16233F', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 4 },
  linkBtn: { background: 'transparent', border: 'none', color: '#3457D5', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginTop: 16, textDecoration: 'underline' },
};
