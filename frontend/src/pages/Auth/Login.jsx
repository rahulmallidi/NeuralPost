import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // Already logged in — send to dashboard
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome back, ${data.user.username}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Log in — NeuralPost</title></Helmet>
      <div className="min-h-[calc(100vh-63px)] grid md:grid-cols-2">

        {/* Left panel — branding */}
        <div className="hidden md:flex flex-col justify-between bg-[#0f172a] border-r border-[#1e3a5f] p-12">
          <Link to="/" className="font-display font-black text-2xl text-white hover:text-blue-400 transition-colors">
            NeuralPost
          </Link>
          <div>
            <blockquote className="font-display text-3xl font-bold text-white leading-snug mb-4">
              "The best way to predict the future is to <em>write it.</em>"
            </blockquote>
            <p className="text-xs font-medium text-blue-400">— NeuralPost</p>
          </div>
          <p className="text-white/50 text-sm">
            Semantic search · AI writing · Real-time analytics
          </p>
        </div>

        {/* Right panel — form */}
        <div className="flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-3">Welcome back</p>
            <h1 className="font-display font-black text-3xl text-cream mb-8">Sign in</h1>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-cream-muted mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="input-field"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-cream-muted mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="input-field"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-2"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Sign In
              </button>
            </form>

            <p className="mt-6 text-sm text-cream-faint">
              No account?{' '}
              <Link to="/register" className="text-amber hover:text-amber-light transition-colors">
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
