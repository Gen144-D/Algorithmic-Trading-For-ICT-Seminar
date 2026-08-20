export const API_URL = '';

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token && auth) headers.Authorization = `Bearer ${token}`;

  let resp = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Try a refresh-token exchange once before giving up.
  if (resp.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.Authorization = `Bearer ${refreshed}`;
      resp = await fetch(path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  if (resp.status === 401 && auth) {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || data.detail || 'Request failed');
  return data;
}

async function tryRefresh() {
  const refreshToken = localStorage.getItem('refreshToken');
  const token = localStorage.getItem('token');
  if (!refreshToken || !token) return null;
  try {
    const resp = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.token) return null;
    localStorage.setItem('token', data.token);
    if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
    return data.token;
  } catch {
    return null;
  }
}

export const fmtMoney = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0));

export const fmtPct = (v) => `${Number(v || 0).toFixed(2)}%`;

export default api;