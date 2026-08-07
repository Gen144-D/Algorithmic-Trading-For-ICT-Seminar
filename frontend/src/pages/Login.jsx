import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
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
          <h1 className="text-xl font-semibold text-slate-100">Sign in</h1>
          {error && <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">{error}</div>}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="text-sm text-slate-400 text-center">
            No account? <Link to="/register" className="text-accent">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
