import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Search, PenSquare, LayoutDashboard, LogOut, Menu, X, Cpu } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    logout();
    navigate('/');
    toast.success('Logged out');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-gray-900">
            <Cpu className="text-blue-600 w-6 h-6" />
            NeuralPost
          </Link>

          {/* Center links */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-gray-600 hover:text-gray-900 transition-colors text-sm">Home</Link>
            <Link to="/explore" className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors text-sm">
              <Search className="w-4 h-4" />
              Explore
            </Link>
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard/editor"
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  <PenSquare className="w-4 h-4" />
                  Write
                </Link>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg text-sm transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <div className="flex items-center gap-2">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                      {user?.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <button onClick={handleLogout} className="text-gray-400 hover:text-gray-700">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-gray-900 text-sm">Log in</Link>
                <Link to="/register" className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden py-3 border-t border-gray-100 space-y-2">
            <Link to="/" className="block text-gray-700 py-2">Home</Link>
            <Link to="/explore" className="block text-gray-700 py-2">Explore</Link>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="block text-gray-700 py-2">Dashboard</Link>
                <Link to="/dashboard/editor" className="block text-gray-700 py-2">Write</Link>
                <button onClick={handleLogout} className="block text-red-600 py-2">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="block text-gray-700 py-2">Log in</Link>
                <Link to="/register" className="block text-gray-700 py-2">Register</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
