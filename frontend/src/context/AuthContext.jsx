import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    if (data.need2fa) return { need2fa: true, pendingToken: data.pendingToken };
    storeSession(data);
    return { need2fa: false, user: data.user };
  };

  const verify2FA = async (pendingToken, code) => {
    const data = await api('/auth/2fa/verify', {
      method: 'POST',
      body: { pendingToken, code },
      auth: false,
    });
    storeSession(data);
    return data.user;
  };

  const register = async (name, email, password) => {
    const data = await api('/auth/register', { method: 'POST', body: { name, email, password }, auth: false });
    storeSession(data);
    return data.user;
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      api('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(() => {});
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
    window.location.href = '/login';
  };

  const refresh = async () => {
    const me = await api('/auth/me');
    setUser(me);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verify2FA, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

function storeSession(data) {
  localStorage.setItem('token', data.token);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
}

export function useAuth() {
  return useContext(AuthContext);
}