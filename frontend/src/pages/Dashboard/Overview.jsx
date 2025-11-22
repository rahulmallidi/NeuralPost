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
    { label: 'Total Posts', value: data?.overview?.total_posts || 0, icon: <BookOpen className="w-5 h-5 text-blue-500" /> },
    { label: 'Total Views', value: Number(data?.overview?.total_views || 0).toLocaleString(), icon: <Eye className="w-5 h-5 text-green-500" /> },
    { label: 'Unique Visitors', value: Number(data?.overview?.unique_visitors || 0).toLocaleString(), icon: <Users className="w-5 h-5 text-purple-500" /> },
    { label: 'Avg Completion', value: `${data?.avgReadCompletionRate || 0}%`, icon: <TrendingUp className="w-5 h-5 text-orange-500" /> },
  ];

  return (
    <>
      <Helmet><title>Dashboard — NeuralPost</title></Helmet>
      <div className="flex min-h-screen bg-gray-50">
        <DashboardNav />
        <main className="flex-1 p-8 max-w-5xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.username}! 👋</h1>
              <p className="text-gray-500 text-sm">Here's how your blog is performing.</p>
            </div>
            <Link to="/dashboard/editor" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">
              <PenSquare className="w-4 h-4" /> New Post
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map(s => (
              <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 text-sm">{s.label}</span>
                  {s.icon}
                </div>
                <div className="text-2xl font-bold text-gray-900">{isLoading ? '—' : s.value}</div>
              </div>
            ))}
          </div>

          {/* Views Timeline */}
          {data?.viewsTimeline?.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-500" /> Views (Last 30 Days)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.viewsTimeline}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Posts */}
          {data?.topPosts?.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Posts</h2>
              <div className="space-y-3">
                {data.topPosts.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <Link to={`/posts/${p.slug}`} className="text-gray-800 hover:text-blue-600 font-medium text-sm line-clamp-1 flex-1 mr-4">
                      {p.title}
                    </Link>
                    <div className="flex items-center gap-4 text-sm text-gray-500 shrink-0">
                      <span>{p.view_count} views</span>
                      <span>{p.read_completion_rate}% reads</span>
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
