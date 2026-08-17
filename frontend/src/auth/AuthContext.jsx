import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchMe } from '../api/client';

/**
 * Zero-setup local auth: "login" just remembers an email in localStorage and
 * the API client sends it as an X-Dev-Email header (see api/client.js). The
 * backend upserts a User row for it and reports back their role.
 *
 * This is for local development only. When you're ready to wire up real
 * Azure Entra ID login, use AzureAuthContext.jsx instead — same exported
 * shape ({isAuthenticated, profile, role, login, logout, ...}), so nothing
 * else in the app needs to change, just swap the import in App.jsx and flip
 * AUTH_MODE=azure on both the frontend and backend.
 */

const AuthContext = createContext(null);
const EMAIL_KEY = 'devEmail';
const NAME_KEY = 'devName';

export function AuthProvider({ children }) {
  const [email, setEmail] = useState(() => window.localStorage.getItem(EMAIL_KEY) || '');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!email) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const me = await fetchMe();
      setProfile(me);
    } catch (e) {
      console.error('Failed to load profile', e);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const login = (newEmail, displayName) => {
    window.localStorage.setItem(EMAIL_KEY, newEmail);
    if (displayName) window.localStorage.setItem(NAME_KEY, displayName);
    setEmail(newEmail);
  };

  const logout = () => {
    window.localStorage.removeItem(EMAIL_KEY);
    window.localStorage.removeItem(NAME_KEY);
    setEmail('');
    setProfile(null);
  };

  const value = {
    isAuthenticated: !!email,
    account: email ? { username: email } : null,
    profile,
    role: profile?.role || null,
    loading,
    login,
    logout,
    refreshProfile: loadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
