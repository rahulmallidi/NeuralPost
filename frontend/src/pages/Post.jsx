import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Clock, Eye, Calendar, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import RelatedPosts from '../components/RelatedPosts';
import { usePostAnalytics } from '../hooks/useAnalytics';

export default function Post() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', slug],
    queryFn: () => api.get(`/posts/${slug}`).then(r => r.data),
  });

  usePostAnalytics(post?.id);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-16 animate-pulse space-y-4">
        <div className="h-3 bg-ink-raised w-1/4 rounded" />
        <div className="h-10 bg-ink-raised w-5/6 rounded" />
        <div className="h-10 bg-ink-raised w-4/5 rounded" />
        <div className="h-3 bg-ink-muted w-1/3 rounded mt-6" />
        <div className="space-y-2 mt-8">
          <div className="h-4 bg-ink-raised rounded" />
          <div className="h-4 bg-ink-raised rounded w-11/12" />
          <div className="h-4 bg-ink-raised rounded w-4/5" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-32 text-cream-faint">
        <div className="font-display font-black text-8xl text-ink-muted mb-4">404</div>
        <p className="text-sm font-medium">Post not found</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{post.title} — NeuralPost</title>
        <meta name="description" content={post.excerpt} />
      </Helmet>

      {/* Reading column */}
      <article className="max-w-2xl mx-auto px-5 sm:px-8 py-14">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-cream-muted hover:text-amber transition-colors mb-10 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {post.tags.map(tag => (
              <span key={tag.slug} className="tag-pill">{tag.name}</span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="font-display font-black text-4xl md:text-5xl text-cream leading-[1.1] mb-5">
          {post.title}
        </h1>

        {/* Excerpt (lede) */}
        {post.excerpt && (
          <p className="text-xl text-cream-muted leading-relaxed mb-7 border-l-4 border-amber pl-5">
            {post.excerpt}
          </p>
        )}

        {/* Byline */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-cream-faint pb-7 border-b border-ink-border mb-8">
          <span className="text-cream-muted">{post.username}</span>
          {post.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(post.published_at), 'MMM d, yyyy')}
            </span>
          )}
          {post.reading_time_mins && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {post.reading_time_mins} min read
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {post.view_count} views
          </span>
        </div>

        {/* Cover image */}
        {post.cover_image_url && (
          <div className="mb-10 -mx-5 sm:-mx-8">
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full max-h-[400px] object-cover"
            />
          </div>
        )}

        {/* Body */}
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: post.content_html || post.content }}
        />

        {/* Post end marker */}
        <div id="post-end" className="h-1" />
      </article>

      {/* Related posts */}
      {post?.id && (
        <div className="max-w-6xl mx-auto px-5 sm:px-8 pb-16 border-t border-ink-border pt-10">
          <RelatedPosts postId={post.id} />
        </div>
      )}
    </>
  );
}
