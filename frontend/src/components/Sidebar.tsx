import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/quotes', label: 'Quotes', icon: '❝' },
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/submit', label: 'Submit Article', icon: '＋' },
  { to: '/bulk-submit', label: 'Bulk Submit', icon: '⇈' },
  { to: '/people', label: 'Speakers', icon: '◉' },
  { to: '/admin', label: 'Admin', icon: '⚙' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col min-h-screen shrink-0">
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-lg font-semibold tracking-tight">AI Quote Tracker</h1>
        <p className="text-xs text-slate-400 mt-0.5">US Political Statements on AI</p>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="text-base">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
