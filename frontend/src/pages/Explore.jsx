import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import api from '../lib/api';
import PostCard from '../components/PostCard';
import { Search, Loader2 } from 'lucide-react';

const MODES = [
  { key: 'hybrid', label: 'Smart', sub: 'semantic + keyword' },
  { key: 'semantic', label: 'Semantic', sub: 'by meaning' },
  { key: 'keyword', label: 'Keyword', sub: 'exact match' },
];

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
    queryFn: () =>
      debouncedQuery
        ? api.get(`/search/${mode}?q=${encodeURIComponent(debouncedQuery)}&limit=100`).then(r => r.data)
        : api.get('/posts?limit=24').then(r => r.data),
    keepPreviousData: true,
    enabled: true,
    staleTime: 0,
  });

  const rawResults = debouncedQuery ? data?.results : data?.posts;
  // Deduplicate by slug in case DB still has content-identical posts with different IDs
  const seen = new Set();
  const results = rawResults?.filter(p => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });

  return (
    <>
      <Helmet><title>Explore — NeuralPost</title></Helmet>

      {/* Page header */}
      <div className="border-b border-ink-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 pb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-3">Discover</p>
          <h1 className="font-display font-black text-4xl md:text-5xl text-cream mb-6 leading-tight">
            Explore Posts
          </h1>

          {/* Search input */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cream-faint w-4 h-4" />
            <input
              type="text"
              value={query}
              onChange={e => handleInput(e.target.value)}
              placeholder="Search by concept, not just keywords..."
              className="input-field pl-11 pr-10"
            />
            {isFetching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-amber w-4 h-4 animate-spin" />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        {/* Mode toggle */}
        <div className="flex items-center gap-0 mb-8 border border-ink-border rounded-lg overflow-hidden w-fit">
          {MODES.map((m, i) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-r border-ink-border last:border-r-0 ${
                mode === m.key
                  ? 'bg-amber text-white font-semibold'
                  : 'text-cream-muted hover:text-cream hover:bg-ink-raised'
              }`}
            >
              <span className="block">{m.label}</span>
              <span className="text-xs opacity-60">{m.sub}</span>
            </button>
          ))}
        </div>

        {/* Results */}
        {!results?.length && debouncedQuery && !isFetching ? (
          <div className="py-20 text-center">
            <div className="font-display text-6xl font-black text-ink-muted mb-4">?</div>
            <p className="text-cream-muted text-sm">
              No results for "<span className="text-cream">{debouncedQuery}</span>"
            </p>
            <p className="text-cream-faint text-xs mt-2">
              Try different keywords or switch to keyword mode
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 md:divide-x md:divide-ink-border">
            {[0, 1, 2].map(col => (
              <div key={col} className={`${col > 0 ? 'md:pl-8' : ''} ${col < 2 ? 'md:pr-8' : ''}`}>
                {results
                  ?.filter((_, i) => i % 3 === col)
                  .map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      similarityScore={post.rrf_score || post.similarity_score}
                    />
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
