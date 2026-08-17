import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Local dev mode (default): no Azure needed. AuthContext.jsx is a simple
// localStorage-backed "login" that pairs with the backend's AUTH_MODE=dev.
//
// TO SWITCH TO REAL AZURE ENTRA ID LOGIN LATER:
//   1. Set AUTH_MODE=azure on the backend and VITE_AUTH_MODE=azure on the frontend.
//   2. Fill in frontend/src/auth/msalConfig.js with your App Registration IDs.
//   3. Replace the two imports below with:
//        import { MsalProvider } from '@azure/msal-react';
//        import { PublicClientApplication, EventType } from '@azure/msal-browser';
//        import { msalConfig } from './auth/msalConfig';
//        import { AuthProvider } from './auth/AzureAuthContext';
//      and wrap <AuthProvider> in <MsalProvider instance={msalInstance}> as
//      shown in AzureAuthContext.jsx's own comments. Nothing else in the app
//      (pages, ProtectedRoute, api client) needs to change — they only rely
//      on useAuth()'s shape, which both contexts share.
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import FormPage from './pages/FormPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/forms/:formId" element={<ProtectedRoute><FormPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
