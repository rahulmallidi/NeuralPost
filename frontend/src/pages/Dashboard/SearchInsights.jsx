import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import api from '../../lib/api';
import DashboardNav from '../../components/DashboardNav';
import { TrendingUp, AlertCircle } from 'lucide-react';

export default function SearchInsights() {
  const { data, isLoading } = useQuery({
    queryKey: ['search-insights'],
    queryFn: () => api.get('/analytics/search-insights').then(r => r.data),
  });

  return (
    <>
      <Helmet><title>Search Insights — NeuralPost</title></Helmet>
      <div className="flex min-h-screen bg-ink-soft">
        <DashboardNav />
        <main className="flex-1 p-8 max-w-4xl overflow-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-1">Discover</p>
          <h1 className="font-display font-black text-3xl text-cream mb-8">Search Insights</h1>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Top Queries */}
            <div className="bg-white border border-ink-border rounded-xl shadow-card p-6">
              <h2 className="text-sm font-semibold text-cream-muted mb-5 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-amber" /> Top Queries (7 days)
              </h2>
              {isLoading ? (
                <div className="space-y-2">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className="h-8 bg-ink-raised animate-pulse" />
                  ))}
                </div>
              ) : data?.topQueries?.length === 0 ? (
                <p className="text-cream-faint text-sm text-center py-8">No queries yet.</p>
              ) : (
                <div className="divide-y divide-ink-border">
                  {data?.topQueries?.map((q, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5">
                      <span className="text-cream text-sm">&ldquo;{q.query}&rdquo;</span>
                      <div className="text-xs text-cream-faint flex items-center gap-3">
                        <span>{q.count}x</span>
                        <span>{Number(q.avg_results).toFixed(0)} results</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zero Result Queries */}
            <div className="bg-white border border-ink-border rounded-xl shadow-card p-6">
              <h2 className="text-sm font-semibold text-cream-muted mb-2 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-ember" /> Zero-Result Queries
              </h2>
              <p className="text-xs text-cream-faint mb-5">
                Write about these topics to fill content gaps.
              </p>
              {data?.zeroResultQueries?.length === 0 ? (
                <p className="text-cream-faint text-sm text-center py-8">
                  No zero-result queries. Great work.
                </p>
              ) : (
                <div className="divide-y divide-ink-border">
                  {data?.zeroResultQueries?.map((q, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5">
                      <span className="text-cream text-sm">&ldquo;{q.query}&rdquo;</span>
                      <span className="text-xs font-semibold text-ember">{q.count}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
