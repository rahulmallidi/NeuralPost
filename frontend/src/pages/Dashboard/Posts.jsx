import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import DashboardNav from '../../components/DashboardNav';
import { PenSquare, Trash2, Send, Archive, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function DashboardPosts() {
  const qc = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['my-posts'],
    queryFn: () => api.get('/posts?status=published&limit=50').then(r => r.data.posts),
  });

  const { data: drafts = [] } = useQuery({
    queryKey: ['my-drafts'],
    queryFn: () => api.get('/posts/my/drafts').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/posts/${id}`),
    onSuccess: () => {
      toast.success('Post deleted');
      qc.invalidateQueries(['my-posts']);
      qc.invalidateQueries(['my-drafts']);
    },
    onError: () => toast.error('Failed to delete post'),
  });

  const publishMutation = useMutation({
    mutationFn: (id) => api.post(`/posts/${id}/publish`),
    onSuccess: () => {
      toast.success('Post published!');
      qc.invalidateQueries(['my-posts']);
      qc.invalidateQueries(['my-drafts']);
    },
    onError: () => toast.error('Failed to publish post'),
  });

  const PostRow = ({ post, isDraft }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <p className="font-medium text-gray-900 text-sm truncate">{post.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {isDraft ? `Edited ${format(new Date(post.updated_at), 'MMM d')}` : `Published ${format(new Date(post.published_at), 'MMM d, yyyy')}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isDraft && (
          <button onClick={() => publishMutation.mutate(post.id)}
            className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-lg hover:bg-green-100 transition-colors">
            <Send className="w-3 h-3" /> Publish
          </button>
        )}
        <Link to={`/dashboard/editor/${post.id}`}
          className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors">
          <PenSquare className="w-3 h-3" /> Edit
        </Link>
        <button onClick={() => deleteMutation.mutate(post.id)}
          className="text-gray-400 hover:text-red-500 transition-colors p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Helmet><title>My Posts — NeuralPost</title></Helmet>
      <div className="flex min-h-screen bg-gray-50">
        <DashboardNav />
        <main className="flex-1 p-8 max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900">My Posts</h1>
            <Link to="/dashboard/editor" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              <PenSquare className="w-4 h-4" /> New Post
            </Link>
          </div>

          {drafts.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-500" /> Drafts ({drafts.length})
              </h2>
              {drafts.map(p => <PostRow key={p.id} post={p} isDraft />)}
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-green-500" /> Published ({posts.length})
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                {Array(3).fill(0).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : posts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No published posts yet.</p>
            ) : (
              posts.map(p => <PostRow key={p.id} post={p} />)
            )}
          </div>
        </main>
      </div>
    </>
  );
}
