import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';
import { BarChart2, Eye, BookOpen, Users, TrendingUp, PenSquare } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import DashboardNav from '../../components/DashboardNav';

export default function DashboardOverview() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/analytics/dashboard').then(r => r.data),
  });

  const stats = [
    { label: 'Posts', value: data?.overview?.total_posts || 0, icon: <BookOpen className="w-4 h-4" /> },
    { label: 'Views', value: Number(data?.overview?.total_views || 0).toLocaleString(), icon: <Eye className="w-4 h-4" /> },
    { label: 'Visitors', value: Number(data?.overview?.unique_visitors || 0).toLocaleString(), icon: <Users className="w-4 h-4" /> },
    { label: 'Completion', value: `${data?.avgReadCompletionRate || 0}%`, icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <>
      <Helmet><title>Dashboard — NeuralPost</title></Helmet>
      <div className="flex min-h-screen bg-ink-soft">
        <DashboardNav />
        <main className="flex-1 p-8 max-w-5xl overflow-auto">

          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-1">Overview</p>
              <h1 className="font-display font-bold text-3xl text-cream">
                {user?.username}
              </h1>
            </div>
            <Link to="/dashboard/editor" className="btn-primary">
              <PenSquare className="w-4 h-4" /> New Post
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-ink-border mb-8">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`stat-card ${
                  i < stats.length - 1 ? 'border-r border-ink-border' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-cream-faint">{s.label}</span>
                  <span className="text-amber">{s.icon}</span>
                </div>
                <div className="font-display font-black text-3xl text-cream">
                  {isLoading ? '—' : s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Views chart */}
          {data?.viewsTimeline?.length > 0 && (
            <div className="bg-white border border-ink-border rounded-xl shadow-card p-6 mb-6">
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 className="w-4 h-4 text-amber" />
                <h2 className="text-sm font-semibold text-cream-muted">Views — Last 30 Days</h2>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.viewsTimeline}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    labelStyle={{ color: '#0f172a', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 12 }}
                    itemStyle={{ color: '#2563eb' }}
                  />
                  <Line type="monotone" dataKey="views" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top posts */}
          {data?.topPosts?.length > 0 && (
            <div className="bg-white border border-ink-border rounded-xl shadow-card p-6">
              <h2 className="text-sm font-semibold text-cream-muted mb-5">Top Posts</h2>
              <div className="divide-y divide-ink-border">
                {data.topPosts.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-4 flex-1 min-w-0 mr-6">
                      <span className="text-xs tabular-nums text-cream-faint w-4 shrink-0">{i + 1}</span>
                      <Link
                        to={`/posts/${p.slug}`}
                        className="text-cream hover:text-amber text-sm font-medium truncate transition-colors"
                      >
                        {p.title}
                      </Link>
                    </div>
                    <div className="flex items-center gap-5 text-xs font-medium text-cream-faint shrink-0">
                      <span>{p.view_count} views</span>
                      <span>{p.read_completion_rate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
