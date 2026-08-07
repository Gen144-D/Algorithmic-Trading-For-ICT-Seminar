import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-accent">◉ AlgoTrade</div>
          <p className="text-sm text-slate-400 mt-2">Algorithmic Trading System</p>
        </div>
        <form onSubmit={submit} className="card space-y-4">
          <h1 className="text-xl font-semibold text-slate-100">Create account</h1>
          {error && <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">{error}</div>}
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Register'}</button>
          <p className="text-sm text-slate-400 text-center">
            Have an account? <Link to="/login" className="text-accent">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
