import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Cpu } from 'lucide-react';

export default function RelatedPosts({ postId }) {
  const { data = [] } = useQuery({
    queryKey: ['related', postId],
    queryFn: () => api.get(`/search/related/${postId}?limit=4`).then(r => r.data),
    enabled: !!postId,
  });

  if (!data.length) return null;

  return (
    <div className="mt-12 pt-8 border-t border-gray-100">
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Cpu className="w-5 h-5 text-blue-500" />
        You might also like
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {data.map(post => (
          <Link
            key={post.id}
            to={post.blog_slug ? `/blog/${post.blog_slug}/${post.slug}` : `/posts/${post.slug}`}
            className="group bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow"
          >
            <p className="font-medium text-gray-900 text-sm mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
              {post.title}
            </p>
            {post.excerpt && (
              <p className="text-xs text-gray-400 line-clamp-1">{post.excerpt}</p>
            )}
            {post.similarity_score != null && (
              <p className="text-xs text-purple-500 font-medium mt-1">
                {(post.similarity_score * 100).toFixed(0)}% similar
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
