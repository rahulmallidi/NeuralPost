import { Link } from 'react-router-dom';
import { Clock, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PostCard({ post, similarityScore }) {
  const postUrl = post.blog_slug
    ? `/blog/${post.blog_slug}/${post.slug}`
    : `/posts/${post.slug}`;

  return (
    <article className="group border-b border-ink-border pt-5 pb-6 hover:border-amber transition-colors duration-200">
      {/* Cover image — full bleed if present */}
      {post.cover_image_url && (
        <div className="rounded-lg overflow-hidden mb-4 h-44">
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500 grayscale group-hover:grayscale-0"
          />
        </div>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.tags.slice(0, 2).map(tag => (
            <span key={tag.slug} className="tag-pill">
              {tag.name}
            </span>
          ))}
          {similarityScore != null && (
            <span className="tag-pill border-amber/40 text-amber">
              {(similarityScore * 100).toFixed(0)}% match
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <h2 className="font-display font-bold text-[1.15rem] leading-snug text-cream mb-2 line-clamp-2 group-hover:text-amber transition-colors">
        <Link to={postUrl}>{post.title}</Link>
      </h2>

      {/* Excerpt */}
      {post.excerpt && (
        <p className="text-cream-muted text-sm leading-relaxed mb-4 line-clamp-2">
          {post.excerpt}
        </p>
      )}

      {/* Meta strip */}
      <div className="flex items-center justify-between text-xs text-cream-faint">
        <div className="flex items-center gap-3">
          <span className="text-cream-muted font-medium">{post.username}</span>
          {post.reading_time_mins && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {post.reading_time_mins}m
            </span>
          )}
          {post.view_count > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {post.view_count}
            </span>
          )}
        </div>
        {post.published_at && (
          <span>{formatDistanceToNow(new Date(post.published_at), { addSuffix: true })}</span>
        )}
      </div>
    </article>
  );
}
