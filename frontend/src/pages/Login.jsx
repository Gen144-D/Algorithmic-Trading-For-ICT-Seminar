import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, verify2FA } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingToken, setPendingToken] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await login(email, password);
      if (res.need2fa) {
        setPendingToken(res.pendingToken);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit2FA = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await verify2FA(pendingToken, code);
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
        {pendingToken ? (
          <form onSubmit={submit2FA} className="card space-y-4">
            <h1 className="text-xl font-semibold text-slate-100">Two-factor authentication</h1>
            <p className="text-sm text-slate-400">Enter the 6-digit code from your authenticator app.</p>
            {error && <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg p-3">{error}</div>}
            <div>
              <label className="label">Authenticator code</label>
              <input
                className="input text-center tracking-widest text-lg"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoFocus
                required
              />
            </div>
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Verifying…' : 'Verify'}</button>
            <button
              type="button"
              onClick={() => setPendingToken(null)}
              className="w-full text-sm text-slate-400 hover:text-slate-200"
            >
              Back
            </button>
          </form>
        ) : (
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
        )}
      </div>
    </div>
  );
}
