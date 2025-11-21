import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import api from '../../lib/api';
import DashboardNav from '../../components/DashboardNav';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { BarChart2 } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => api.get('/analytics/dashboard').then(r => r.data),
  });

  return (
    <>
      <Helmet><title>Analytics — NeuralPost</title></Helmet>
      <div className="flex min-h-screen bg-gray-50">
        <DashboardNav />
        <main className="flex-1 p-8 max-w-5xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-500" /> Analytics
          </h1>

          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-6">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-6 h-64 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Views Timeline */}
              <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Views Over Time (30 Days)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data?.viewsTimeline || []}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Top Posts */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-900 mb-4">Top Posts by Views</h2>
                  <div className="space-y-3">
                    {data?.topPosts?.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-300 w-5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{p.title}</p>
                          <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                            <span>{p.view_count} views</span>
                            <span>{p.read_completion_rate}% completion</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Read Completion */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-900 mb-4">Avg Read Completion</h2>
                  <div className="flex items-center justify-center h-40">
                    <div className="text-center">
                      <div className="text-5xl font-extrabold text-blue-600">{data?.avgReadCompletionRate || 0}%</div>
                      <p className="text-gray-400 text-sm mt-2">of readers finish your posts</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
