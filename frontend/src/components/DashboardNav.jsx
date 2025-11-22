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
    <aside className="w-56 min-h-screen bg-white border-r border-gray-100 px-3 py-6 shrink-0">
      <nav className="space-y-1">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
