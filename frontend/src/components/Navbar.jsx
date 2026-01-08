import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';import { useAuthStore } from '../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { Search, PenSquare, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    logout();
    queryClient.clear(); // wipe all cached data so next user sees only their own
    navigate('/');
    toast.success('Logged out');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-ink-border shadow-sm">
      <nav className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Masthead */}
          <Link
            to="/"
            className="font-display font-bold text-xl text-cream tracking-tight hover:text-amber transition-colors"
          >
            NeuralPost
          </Link>

          {/* Center */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className="text-sm font-medium text-cream-muted hover:text-cream transition-colors"
            >
              Home
            </Link>
            <Link
              to="/explore"
              className="text-sm font-medium text-cream-muted hover:text-cream transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              Explore
            </Link>
          </div>

          {/* Right */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard/editor"
                  className="btn-primary text-sm"
                >
                  <PenSquare className="w-4 h-4" />
                  Write
                </Link>
                <Link
                  to="/dashboard"
                  className="btn-ghost text-sm"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <div className="flex items-center gap-2 pl-3 border-l border-ink-border ml-1">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full ring-2 ring-ink-border" />
                  ) : (
                    <div className="w-8 h-8 bg-amber text-white flex items-center justify-center text-xs font-bold rounded-full">
                      {user?.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-cream-faint hover:text-ember transition-colors"
                    title="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-cream-muted hover:text-cream transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-cream-muted hover:text-cream transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-ink-border py-4 space-y-1 animate-fade-up">
            <Link to="/" onClick={() => setMenuOpen(false)}
              className="block text-sm font-medium py-2.5 px-2 rounded-lg text-cream-muted hover:text-cream hover:bg-ink-soft transition-colors">
              Home
            </Link>
            <Link to="/explore" onClick={() => setMenuOpen(false)}
              className="block text-sm font-medium py-2.5 px-2 rounded-lg text-cream-muted hover:text-cream hover:bg-ink-soft transition-colors">
              Explore
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" onClick={() => setMenuOpen(false)}
                  className="block text-sm font-medium py-2.5 px-2 rounded-lg text-cream-muted hover:bg-ink-soft transition-colors">Dashboard</Link>
                <Link to="/dashboard/editor" onClick={() => setMenuOpen(false)}
                  className="block text-sm font-medium py-2.5 px-2 rounded-lg text-amber hover:bg-blue-50 transition-colors">Write</Link>
                <button onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="block w-full text-left text-sm font-medium py-2.5 px-2 rounded-lg text-ember hover:bg-red-50 transition-colors">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)}
                  className="block text-sm font-medium py-2.5 px-2 rounded-lg text-cream-muted hover:bg-ink-soft transition-colors">Log in</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)}
                  className="block text-sm font-medium py-2.5 px-2 rounded-lg text-amber hover:bg-blue-50 transition-colors">Get Started</Link>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
