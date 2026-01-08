import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../lib/api';
import PostCard from '../components/PostCard';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

function SkeletonRow() {
  return (
    <div className="border-b border-ink-border pt-5 pb-6 animate-pulse">
      <div className="h-3 bg-ink-muted rounded w-1/4 mb-3" />
      <div className="h-5 bg-ink-raised rounded w-3/4 mb-2" />
      <div className="h-4 bg-ink-raised rounded w-full mb-1" />
      <div className="h-4 bg-ink-raised rounded w-2/3" />
    </div>
  );
}

export default function Home() {
  const { data, isLoading } = useQuery({
    queryKey: ['posts-home'],
    queryFn: () => api.get('/posts?limit=7').then(r => r.data),
    staleTime: 0,
  });

  const seen = new Set();
  const uniquePosts = (data?.posts ?? []).filter(p => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });
  const [featured, ...rest] = uniquePosts;

  return (
    <>
      <Helmet>
        <title>NeuralPost — The AI-Native Publishing Platform</title>
      </Helmet>

      {/* ── Hero banner ── */}
      <section className="border-b border-ink-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-5">
              AI-Powered Publishing
            </p>
            <h1 className="font-display text-5xl md:text-7xl font-black text-cream leading-[1.05] mb-6">
              Write once.<br />
              <em className="not-italic text-amber">Discovered</em> forever.
            </h1>
            <p className="text-cream-muted text-lg leading-relaxed max-w-xl mb-10">
              NeuralPost is a publishing platform that understands your content.
              Semantic search, AI writing tools, and real-time analytics — all in one place.
            </p>
            <div className="flex items-center gap-5 flex-wrap">
              <Link to="/register" className="btn-primary">
                Start Writing Free
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link
                to="/explore"
                className="text-sm font-medium text-cream-muted hover:text-cream flex items-center gap-1.5 transition-colors"
              >
                Explore Posts <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities bar ── */}
      <section className="border-b border-ink-border bg-ink-soft overflow-x-auto">
        <div className="flex items-center justify-center divide-x divide-ink-border w-full">
          {[
            'Semantic Search via pgvector HNSW',
            'AI Writing Assistant',
            'Real-Time Analytics',
            'Hybrid Keyword + Semantic Ranking',
            'Read Completion Tracking',
          ].map(item => (
            <span
              key={item}
              className="text-xs text-cream-faint px-6 py-3 whitespace-nowrap"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ── Main content ── */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12">
        <div className="flex items-baseline justify-between mb-6 border-b border-amber pb-3">
          <h2 className="font-display font-bold text-xl text-cream tracking-tight">Latest</h2>
          <Link
            to="/explore"
            className="text-xs font-medium text-amber hover:text-amber-light flex items-center gap-1.5 transition-colors"
          >
            All posts <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-[1fr_1px_1fr_1px_1fr] gap-0">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className={i % 2 === 1 ? 'hidden md:block bg-ink-border' : ''}>
                {i % 2 !== 1 && <SkeletonRow />}
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Featured post — full-width spotlight */}
            {featured && (
              <article className="group border-b border-ink-border pb-8 mb-2">
                <div className="md:grid md:grid-cols-[1fr_auto] gap-12 items-start">
                  <div>
                    {featured.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {featured.tags.slice(0, 3).map(tag => (
                          <span key={tag.slug} className="tag-pill">{tag.name}</span>
                        ))}
                      </div>
                    )}
                    <h3 className="font-display font-black text-3xl md:text-4xl text-cream leading-tight mb-3 group-hover:text-amber transition-colors">
                      <Link
                        to={featured.blog_slug ? `/blog/${featured.blog_slug}/${featured.slug}` : `/posts/${featured.slug}`}
                      >
                        {featured.title}
                      </Link>
                    </h3>
                    {featured.excerpt && (
                      <p className="text-cream-muted leading-relaxed mb-5 max-w-2xl">{featured.excerpt}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-cream-faint">
                      <span className="text-cream-muted">{featured.username}</span>
                      {featured.reading_time_mins && <span>{featured.reading_time_mins} min read</span>}
                      {featured.view_count > 0 && <span>{featured.view_count} views</span>}
                    </div>
                  </div>
                  {featured.cover_image_url && (
                    <div className="hidden md:block w-56 h-36 overflow-hidden shrink-0">
                      <img
                        src={featured.cover_image_url}
                        alt={featured.title}
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                      />
                    </div>
                  )}
                </div>
              </article>
            )}

            {/* List of remaining posts — 3-column divider grid */}
            <div className="grid md:grid-cols-3 md:divide-x md:divide-ink-border">
              {[0, 1, 2].map(col => (
                <div key={col} className={`${col > 0 ? 'md:pl-8' : ''} ${col < 2 ? 'md:pr-8' : ''}`}>
                  {rest
                    .filter((_, i) => i % 3 === col)
                    .map(post => (
                      <PostCard key={post.id} post={post} />
                    ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
