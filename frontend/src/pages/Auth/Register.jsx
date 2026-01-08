import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { Loader2, Eye, EyeOff, Check, X } from 'lucide-react';

// ── Password strength helpers ─────────────────────────────────────────────────
const REQUIREMENTS = [
  { id: 'length',    label: 'At least 8 characters',          test: p => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A–Z)',      test: p => /[A-Z]/.test(p) },
  { id: 'number',    label: 'One number (0–9)',                test: p => /[0-9]/.test(p) },
  { id: 'special',   label: 'One special character (!@#$…)',   test: p => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(password) {
  const passed = REQUIREMENTS.filter(r => r.test(password)).length;
  if (password.length === 0) return { level: 0, label: '', color: '' };
  if (passed <= 1) return { level: 1, label: 'Weak',   color: 'bg-red-500' };
  if (passed === 2) return { level: 2, label: 'Fair',   color: 'bg-orange-400' };
  if (passed === 3) return { level: 3, label: 'Good',   color: 'bg-yellow-400' };
  return              { level: 4, label: 'Strong', color: 'bg-green-500' };
}

// Defined outside Register so React doesn't remount it on every keystroke
const Field = ({ label, optional, ...props }) => (
  <div>
    <label className="flex items-center gap-2 text-sm font-medium text-cream-muted mb-2">
      {label}
      {optional && <span className="text-cream-faint text-xs font-normal">(optional)</span>}
    </label>
    <input className="input-field" {...props} />
  </div>
);

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '', blogName: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // Already logged in — send to dashboard
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const strength = getStrength(form.password);
  const allPassed = REQUIREMENTS.every(r => r.test(form.password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allPassed) { toast.error('Please meet all password requirements'); return; }
    setLoading(true);
    try {
      logout(); // clear any stale session before creating new account
      const { data } = await api.post('/auth/register', form);
      login(data.user, data.accessToken, data.refreshToken);
      toast.success('Account created! Welcome to NeuralPost.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Create Account — NeuralPost</title></Helmet>
      <div className="min-h-[calc(100vh-63px)] grid md:grid-cols-2">

        {/* Left panel */}
        <div className="hidden md:flex flex-col justify-between bg-[#0f172a] border-r border-[#1e3a5f] p-12">
          <Link to="/" className="font-display font-black text-2xl text-white hover:text-blue-400 transition-colors">
            NeuralPost
          </Link>
          <div className="space-y-6">
            {[
              { num: '01', label: 'Semantic Search', desc: 'Readers find your work by concept, not just keywords.' },
              { num: '02', label: 'AI Writing Tools', desc: 'Tag suggestions, excerpt generation, prose improvements.' },
              { num: '03', label: 'Deep Analytics', desc: 'Track read completion, visitor journeys, and search queries.' },
            ].map(f => (
              <div key={f.num} className="flex gap-4">
                <span className="text-blue-400 text-xs mt-0.5 shrink-0 tabular-nums">{f.num}</span>
                <div>
                  <p className="font-semibold text-white text-sm">{f.label}</p>
                  <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-white/50 text-sm">
            Free forever · No credit card required
          </p>
        </div>

        {/* Right panel — form */}
        <div className="flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-3">Join NeuralPost</p>
            <h1 className="font-display font-black text-3xl text-cream mb-8">Create your blog</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Email" type="email" required value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com" />
              <Field label="Username" type="text" required value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                placeholder="johndoe" />
              <Field label="Blog Name" optional type="text" value={form.blogName}
                onChange={e => setForm(p => ({ ...p, blogName: e.target.value }))}
                placeholder="My Tech Corner" />

              {/* Password with toggle + strength */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-cream-muted mb-2">
                  Password
                  {form.password.length > 0 && (
                    <span className={`text-[9px] normal-case tracking-normal font-semibold ${
                      strength.level === 4 ? 'text-green-500' :
                      strength.level === 3 ? 'text-yellow-400' :
                      strength.level === 2 ? 'text-orange-400' : 'text-red-500'
                    }`}>
                      {strength.label}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    className="input-field pr-10"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    placeholder="Min. 8 chars, include A, 1, @"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-faint hover:text-cream transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {form.password.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 transition-all duration-300 ${
                          i <= strength.level ? strength.color : 'bg-ink-border'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Requirements checklist — shown when focused or has content */}
                {(passwordFocused || form.password.length > 0) && (
                  <ul className="mt-3 space-y-1.5">
                    {REQUIREMENTS.map(req => {
                      const passed = req.test(form.password);
                      return (
                        <li key={req.id} className={`flex items-center gap-2 text-[11px] transition-colors ${
                          passed ? 'text-green-500' : 'text-cream-faint'
                        }`}>
                          {passed
                            ? <Check className="w-3 h-3 shrink-0" />
                            : <X className="w-3 h-3 shrink-0 text-red-400" />}
                          {req.label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !allPassed}
                className="btn-primary w-full mt-2"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Account
              </button>
            </form>

            <p className="mt-6 text-sm text-cream-faint">
              Already have an account?{' '}
              <Link to="/login" className="text-amber hover:text-amber-light transition-colors">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
