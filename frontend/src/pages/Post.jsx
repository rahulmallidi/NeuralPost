import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Clock, Eye, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import RelatedPosts from '../components/RelatedPosts';
import { usePostAnalytics } from '../hooks/useAnalytics';

export default function Post() {
  const { slug, blogSlug } = useParams();

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', slug],
    queryFn: () => api.get(`/posts/${slug}`).then(r => r.data),
  });

  usePostAnalytics(post?.id);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse">
        <div className="h-8 bg-gray-200 rounded mb-4 w-3/4" />
        <div className="h-4 bg-gray-100 rounded mb-2" />
        <div className="h-4 bg-gray-100 rounded mb-2 w-5/6" />
        <div className="h-4 bg-gray-100 rounded w-2/3" />
      </div>
    );
  }

  if (!post) return <div className="text-center py-20 text-gray-400">Post not found.</div>;

  return (
    <>
      <Helmet>
        <title>{post.title} — NeuralPost</title>
        <meta name="description" content={post.excerpt} />
      </Helmet>

      <article className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <header className="mb-8">
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map(tag => (
                <span key={tag.slug} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-4">{post.title}</h1>

          {post.excerpt && <p className="text-xl text-gray-500 mb-6">{post.excerpt}</p>}

          <div className="flex items-center gap-4 text-sm text-gray-400 pb-6 border-b border-gray-100">
            <span className="font-medium text-gray-700">by {post.username}</span>
            {post.published_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(post.published_at), 'MMMM d, yyyy')}
              </span>
            )}
            {post.reading_time_mins && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {post.reading_time_mins} min read
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {post.view_count} views
            </span>
          </div>
        </header>

        {post.cover_image_url && (
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full rounded-xl mb-8 shadow-sm"
          />
        )}

        {/* Content */}
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: post.content_html || post.content }}
        />

        {/* Post end marker for read completion tracking */}
        <div id="post-end" className="h-1" />
      </article>

      {/* Related Posts */}
      {post?.id && (
        <div className="max-w-3xl mx-auto px-4 pb-16">
          <RelatedPosts postId={post.id} />
        </div>
      )}
    </>
  );
}
