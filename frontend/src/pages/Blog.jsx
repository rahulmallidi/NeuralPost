import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import api from '../lib/api';
import PostCard from '../components/PostCard';
import { BookOpen, Eye } from 'lucide-react';

export default function Blog() {
  const { blogSlug } = useParams();

  const { data: meta } = useQuery({
    queryKey: ['blog-meta', blogSlug],
    queryFn: () => api.get(`/blog/${blogSlug}`).then(r => r.data),
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts', blogSlug],
    queryFn: () => api.get(`/blog/${blogSlug}/posts`).then(r => r.data),
  });

  return (
    <>
      <Helmet>
        <title>{meta?.blog_name || blogSlug} — NeuralPost</title>
      </Helmet>

      {/* Blog masthead */}
      <div className="border-b border-ink-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12">
          {meta && (
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="shrink-0 w-14 h-14 bg-amber text-ink flex items-center justify-center font-display font-black text-2xl">
                {meta.avatar_url
                  ? <img src={meta.avatar_url} className="w-14 h-14 object-cover" alt={meta.username} />
                  : meta.username?.[0]?.toUpperCase()
                }
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-1">
                  @{meta.username}
                </p>
                <h1 className="font-display font-black text-3xl md:text-4xl text-cream leading-tight mb-3">
                  {meta.blog_name}
                </h1>
                <div className="flex items-center gap-5 text-xs text-cream-faint">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" />
                    {meta.stats?.post_count} posts
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3 h-3" />
                    {Number(meta.stats?.total_views || 0).toLocaleString()} views
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-0 md:divide-x md:divide-ink-border">
            {[0, 1, 2].map(col => (
              <div key={col} className={col > 0 ? 'md:pl-8' : ''}>
                {Array(2).fill(0).map((_, i) => (
                  <div key={i} className="border-b border-ink-border pt-5 pb-6 animate-pulse">
                    <div className="h-4 bg-ink-raised rounded w-3/4 mb-2" />
                    <div className="h-3 bg-ink-muted rounded w-full mb-1" />
                    <div className="h-3 bg-ink-muted rounded w-2/3" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 md:divide-x md:divide-ink-border">
            {[0, 1, 2].map(col => (
              <div key={col} className={col > 0 ? 'md:pl-8' : ''}>
                {posts
                  .filter((_, i) => i % 3 === col)
                  .map(post => (
                    <PostCard key={post.id} post={{ ...post, blog_slug: blogSlug }} />
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
