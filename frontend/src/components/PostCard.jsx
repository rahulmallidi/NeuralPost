import { Link } from 'react-router-dom';
import { Clock, Eye, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PostCard({ post, similarityScore }) {
  const postUrl = post.blog_slug
    ? `/blog/${post.blog_slug}/${post.slug}`
    : `/posts/${post.slug}`;

  return (
    <article className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
      {post.cover_image_url && (
        <img
          src={post.cover_image_url}
          alt={post.title}
          className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
        />
      )}
      <div className="p-5">
        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.slice(0, 3).map(tag => (
              <span key={tag.slug} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <h2 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
          <Link to={postUrl}>{post.title}</Link>
        </h2>

        {post.excerpt && (
          <p className="text-gray-500 text-sm mb-4 line-clamp-2">{post.excerpt}</p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {post.username}
            </span>
            {post.reading_time_mins && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {post.reading_time_mins} min
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

        {similarityScore != null && (
          <div className="mt-2 text-xs text-purple-500 font-medium">
            {(similarityScore * 100).toFixed(0)}% relevance
          </div>
        )}
      </div>
    </article>
  );
}
