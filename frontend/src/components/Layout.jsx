import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fmtMoney } from '../api/client';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/market', label: 'Market' },
  { to: '/strategies', label: 'Strategies' },
  { to: '/bots', label: 'Bots' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/backtest', label: 'Backtest' },
  { to: '/brokers', label: 'Brokers' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/journal', label: 'Journal' },
  { to: '/ai', label: 'AI Assistant' },
  { to: '/analytics', label: 'Analytics' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-base-900 border-b border-base-700">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <button onClick={() => navigate('/')} className="font-bold text-accent text-lg tracking-tight">
              ◉ AlgoTrade
            </button>
            <nav className="hidden md:flex items-center gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-base-800 text-accent' : 'text-slate-400 hover:text-slate-100'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-slate-200">{user.name}</div>
                <div className="text-xs text-slate-400">{fmtMoney(user.balance)}</div>
              </div>
            )}
            <button onClick={logout} className="btn-ghost text-sm">Logout</button>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="text-center text-xs text-slate-500 py-6 border-t border-base-800">
        Algorithmic Trading System — market data → algorithm → decision → order → monitoring
      </footer>
    </div>
  );
}
