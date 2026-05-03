import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { fetchReviewStats } from '../api/client';
import { useMe } from '../auth/useMe';

type Role = 'public' | 'admin' | 'superadmin';

interface SidebarLink {
  to: string;
  label: string;
  icon: string;
  showBadge?: boolean;
  requires?: Role;
}

const links: SidebarLink[] = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/quotes', label: 'Quotes', icon: '❝' },
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/submit', label: 'Submit Article', icon: '＋' },
  { to: '/bulk-submit', label: 'Bulk Submit', icon: '⇈' },
  { to: '/feed-harvest', label: 'Feed Harvest', icon: '⊞' },
  { to: '/review', label: 'Review Queue', icon: '⊘', showBadge: true, requires: 'admin' },
  { to: '/people', label: 'Speakers', icon: '◉' },
  { to: '/admin', label: 'Admin', icon: '⚙', requires: 'admin' },
  { to: '/users', label: 'Users', icon: '⌥', requires: 'superadmin' },
];

function canSee(link: SidebarLink, me: ReturnType<typeof useMe>['me']): boolean {
  if (!link.requires || link.requires === 'public') return true;
  if (!me) return false;
  if (link.requires === 'admin') return me.is_admin || me.is_superadmin;
  if (link.requires === 'superadmin') return me.is_superadmin;
  return false;
}

export default function Sidebar() {
  const { me } = useMe();
  const isAdmin = !!me && (me.is_admin || me.is_superadmin);

  const { data: stats } = useQuery({
    queryKey: ['review-stats'],
    queryFn: fetchReviewStats,
    refetchInterval: 60_000,
    enabled: isAdmin,
  });

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-6 py-5 border-b border-slate-700 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">AI Quote Tracker</h1>
        <p className="text-xs text-slate-400 mt-0.5">US Political Statements on AI</p>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto py-4 px-3 space-y-1">
        {links.filter((l) => canSee(l, me)).map((l) => (
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
            {l.showBadge && stats && stats.pending_count > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                {stats.pending_count}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-slate-700 flex items-center justify-between shrink-0">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="text-sm font-medium text-slate-300 hover:text-white">
              Sign in
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="flex items-center gap-3 min-w-0">
            <UserButton afterSignOutUrl="/" />
            {me && (
              <div className="text-xs text-slate-400 truncate">
                {me.name || me.email}
                {me.is_superadmin && (
                  <span className="ml-1 text-amber-400">superadmin</span>
                )}
                {!me.is_superadmin && me.is_admin && (
                  <span className="ml-1 text-blue-400">admin</span>
                )}
                {!me.is_admin && me.is_editor && (
                  <span className="ml-1 text-emerald-400">editor</span>
                )}
              </div>
            )}
          </div>
        </SignedIn>
      </div>
    </aside>
  );
}
