import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, PenSquare, BarChart2, Search } from 'lucide-react';

const links = [
  { to: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Overview', end: true },
  { to: '/dashboard/posts', icon: <FileText className="w-4 h-4" />, label: 'Posts' },
  { to: '/dashboard/editor', icon: <PenSquare className="w-4 h-4" />, label: 'New Post' },
  { to: '/dashboard/analytics', icon: <BarChart2 className="w-4 h-4" />, label: 'Analytics' },
  { to: '/dashboard/search-insights', icon: <Search className="w-4 h-4" />, label: 'Search Insights' },
];

export default function DashboardNav() {
  return (
    <aside className="w-56 min-h-screen bg-white border-r border-ink-border px-3 py-6 shrink-0 shadow-sm">
      <div className="px-3 mb-6">
        <span className="font-display font-bold text-lg text-cream">NeuralPost</span>
        <p className="text-xs text-cream-faint mt-0.5">Dashboard</p>
      </div>
      <nav className="space-y-1">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-amber font-semibold'
                  : 'text-cream-muted hover:text-cream hover:bg-ink-soft'
              }`
            }
          >
            {l.icon}
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
