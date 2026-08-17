import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// "dev" (default): no Azure needed, just a locally-remembered email — matches
// the backend's AUTH_MODE=dev. Switch both to "azure" once you have an
// App Registration set up.
const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'dev';

export const api = axios.create({ baseURL: BASE_URL });

// AzureAuthContext registers a getter here once MSAL is ready, so this plain
// module can attach a fresh token to every request without importing React.
let tokenGetter = async () => null;
export function setTokenGetter(fn) {
  tokenGetter = fn;
}

api.interceptors.request.use(async (config) => {
  if (AUTH_MODE === 'dev') {
    const email = window.localStorage.getItem('devEmail');
    const name = window.localStorage.getItem('devName');
    if (email) config.headers['X-Dev-Email'] = email;
    if (name) config.headers['X-Dev-Name'] = name;
    return config;
  }
  const token = await tokenGetter();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---- Convenience wrappers used across the app ----

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function fetchMyForms() {
  const { data } = await api.get('/forms');
  return data;
}

export async function fetchForm(formId) {
  const { data } = await api.get(`/forms/${formId}`);
  return data;
}

export async function saveSection(formId, sectionKey, sectionData, submit) {
  const { data } = await api.put(`/forms/${formId}/sections/${sectionKey}`, {
    data: sectionData,
    submit,
  });
  return data;
}

export async function fetchAllUsers() {
  const { data } = await api.get('/admin/users');
  return data;
}

export async function setUserRole(userId, role) {
  const { data } = await api.patch(`/admin/users/${userId}/role`, { role });
  return data;
}

export async function fetchAllForms() {
  const { data } = await api.get('/admin/forms');
  return data;
}

export async function createForm(assignments) {
  const { data } = await api.post('/admin/forms', assignments);
  return data;
}

export async function exportFormDocx(formId) {
  const response = await api.get(`/forms/${formId}/export/docx`, { responseType: 'blob' });
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `Probation_Review_${formId}.docx`;
  return { blob: response.data, filename };
}
