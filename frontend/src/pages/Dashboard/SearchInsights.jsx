import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import api from '../../lib/api';
import DashboardNav from '../../components/DashboardNav';
import { Search, TrendingUp, AlertCircle } from 'lucide-react';

export default function SearchInsights() {
  const { data, isLoading } = useQuery({
    queryKey: ['search-insights'],
    queryFn: () => api.get('/analytics/search-insights').then(r => r.data),
  });

  return (
    <>
      <Helmet><title>Search Insights — NeuralPost</title></Helmet>
      <div className="flex min-h-screen bg-gray-50">
        <DashboardNav />
        <main className="flex-1 p-8 max-w-4xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2">
            <Search className="w-6 h-6 text-blue-500" /> Search Insights
          </h1>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Queries */}
            <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" /> Top Queries (7 days)
              </h2>
              {isLoading ? (
                <div className="space-y-2">
                  {Array(5).fill(0).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : data?.topQueries?.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No search queries yet.</p>
              ) : (
                <div className="space-y-2">
                  {data?.topQueries?.map((q, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-800 font-medium">"{q.query}"</span>
                      <div className="flex items-center gap-3 text-gray-400">
                        <span>{q.count}x</span>
                        <span>{Number(q.avg_results).toFixed(0)} results</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zero Result Queries */}
            <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" /> Zero-Result Queries
              </h2>
              <p className="text-xs text-gray-400 mb-4">These queries returned no results. Consider writing about these topics!</p>
              {data?.zeroResultQueries?.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No zero-result queries. Great job! ✅</p>
              ) : (
                <div className="space-y-2">
                  {data?.zeroResultQueries?.map((q, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-800">"{q.query}"</span>
                      <span className="text-red-500 text-xs">{q.count}x searched</span>
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
