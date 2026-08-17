import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { apiRequest, loginRequest } from './msalConfig';
import { setTokenGetter } from '../api/client';
import { fetchMe } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [profile, setProfile] = useState(null); // backend User row: {id, email, role, ...}
  const [loading, setLoading] = useState(true);

  const getToken = useCallback(async () => {
    if (accounts.length === 0) return null;
    try {
      const result = await instance.acquireTokenSilent({ ...apiRequest, account: accounts[0] });
      return result.accessToken;
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const result = await instance.acquireTokenRedirect({ ...apiRequest, account: accounts[0] });
        return result?.accessToken ?? null;
      }
      throw e;
    }
  }, [instance, accounts]);

  // Let the plain axios client (outside React) pull a fresh token on every call.
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  useEffect(() => {
    async function loadProfile() {
      if (!isAuthenticated) {
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
    }
    loadProfile();
  }, [isAuthenticated]);

  const login = () => instance.loginRedirect(loginRequest);
  const logout = () => instance.logoutRedirect();

  const value = {
    isAuthenticated,
    account: accounts[0] || null,
    profile,          // { id, email, display_name, role } from our backend
    role: profile?.role || null,
    loading,
    login,
    logout,
    refreshProfile: async () => setProfile(await fetchMe()),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
