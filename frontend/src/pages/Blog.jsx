import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import api from '../lib/api';
import PostCard from '../components/PostCard';
import { User, BookOpen, Eye } from 'lucide-react';

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
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Blog Header */}
        {meta && (
          <div className="mb-10 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              {meta.avatar_url
                ? <img src={meta.avatar_url} className="w-16 h-16 rounded-full object-cover" alt={meta.username} />
                : meta.username[0].toUpperCase()
              }
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{meta.blog_name}</h1>
            <p className="text-gray-400 flex items-center justify-center gap-4 text-sm">
              <span className="flex items-center gap-1"><User className="w-4 h-4" />{meta.username}</span>
              <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{meta.stats?.post_count} posts</span>
              <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{Number(meta.stats?.total_views || 0).toLocaleString()} views</span>
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => <div key={i} className="h-52 bg-white border border-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => <PostCard key={post.id} post={{ ...post, blog_slug: blogSlug }} />)}
          </div>
        )}
      </div>
    </>
  );
}
