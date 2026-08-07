export const API_URL = '';

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token && auth) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (resp.status === 401 && auth) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || data.detail || 'Request failed');
  return data;
}

export const fmtMoney = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0));

export const fmtPct = (v) => `${Number(v || 0).toFixed(2)}%`;

export default api;
