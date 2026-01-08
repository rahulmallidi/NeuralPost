import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function RelatedPosts({ postId }) {
  const { data = [] } = useQuery({
    queryKey: ['related', postId],
    queryFn: () => api.get(`/search/related/${postId}?limit=4`).then(r => r.data),
    enabled: !!postId,
  });

  if (!data.length) return null;

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-6 border-b border-amber pb-3">
        <h2 className="font-display font-bold text-xl text-cream">Further Reading</h2>
        <span className="text-xs text-cream-faint">
          Semantically similar
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-0 md:divide-x md:divide-ink-border">
        {data.map((post, i) => (
          <Link
            key={post.id}
            to={post.blog_slug ? `/blog/${post.blog_slug}/${post.slug}` : `/posts/${post.slug}`}
            className={`group block py-4 hover:bg-ink-soft transition-colors ${i % 2 === 1 ? 'md:pl-8' : ''}`}
          >
            <p className="font-display font-bold text-cream text-base leading-snug mb-1 group-hover:text-amber transition-colors line-clamp-2">
              {post.title}
            </p>
            {post.excerpt && (
              <p className="text-cream-faint text-xs leading-relaxed line-clamp-1">{post.excerpt}</p>
            )}
            {post.similarity_score != null && (
              <p className="text-xs font-medium text-amber mt-2">
                {(post.similarity_score * 100).toFixed(0)}% similar
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
