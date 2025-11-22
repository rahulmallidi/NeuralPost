import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import api from '../lib/api';
import PostCard from '../components/PostCard';
import { Search, Loader2, Zap, AlignLeft, Layers } from 'lucide-react';

const MODE_LABELS = {
  hybrid: { label: 'Smart Search', icon: <Layers className="w-4 h-4" />, desc: 'Semantic + keyword' },
  semantic: { label: 'Semantic', icon: <Zap className="w-4 h-4" />, desc: 'Meaning-based' },
  keyword: { label: 'Keyword', icon: <AlignLeft className="w-4 h-4" />, desc: 'Exact match' },
};

let debounceTimer;

export default function Explore() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [mode, setMode] = useState('hybrid');

  const handleInput = useCallback((val) => {
    setQuery(val);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => setDebouncedQuery(val), 400);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery, mode],
    queryFn: () => debouncedQuery
      ? api.get(`/search/${mode}?q=${encodeURIComponent(debouncedQuery)}&limit=12`).then(r => r.data)
      : api.get('/posts?limit=12').then(r => r.data),
    keepPreviousData: true,
    enabled: true,
  });

  const results = debouncedQuery ? data?.results : data?.posts;

  return (
    <>
      <Helmet><title>Explore — NeuralPost</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Explore Posts</h1>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder="Search by concept, not just keywords..."
            className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder-gray-400"
          />
          {isFetching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 w-5 h-5 animate-spin" />}
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2 mb-8">
          {Object.entries(MODE_LABELS).map(([key, m]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mode === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {m.icon} {m.label}
              <span className={`text-xs ${mode === key ? 'opacity-75' : 'opacity-50'}`}>({m.desc})</span>
            </button>
          ))}
        </div>

        {/* Results */}
        {!results?.length && debouncedQuery && !isFetching ? (
          <div className="text-center py-16 text-gray-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No results for "<strong>{debouncedQuery}</strong>"</p>
            <p className="text-sm mt-1">Try different keywords or switch to keyword search</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results?.map(post => (
              <PostCard key={post.id} post={post} similarityScore={post.rrf_score || post.similarity_score} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
