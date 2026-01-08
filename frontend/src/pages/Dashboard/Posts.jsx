import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import DashboardNav from '../../components/DashboardNav';
import { PenSquare, Trash2, Send, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function DashboardPosts() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['my-posts', user?.id],
    queryFn: () => api.get(`/posts?status=published&limit=50&author=${user?.username}`).then(r => r.data.posts),
    enabled: !!user,
  });

  const { data: drafts = [] } = useQuery({
    queryKey: ['my-drafts', user?.id],
    queryFn: () => api.get('/posts/my/drafts').then(r => r.data),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/posts/${id}`),
    onSuccess: () => {
      toast.success('Post deleted');
      qc.invalidateQueries({ queryKey: ['my-posts', user?.id] });
      qc.invalidateQueries({ queryKey: ['my-drafts', user?.id] });
    },
    onError: () => toast.error('Failed to delete post'),
  });

  const publishMutation = useMutation({
    mutationFn: (id) => api.post(`/posts/${id}/publish`),
    onSuccess: () => {
      toast.success('Post published!');
      qc.invalidateQueries({ queryKey: ['my-posts', user?.id] });
      qc.invalidateQueries({ queryKey: ['my-drafts', user?.id] });
      qc.invalidateQueries({ queryKey: ['posts-home'] });
      qc.invalidateQueries({ queryKey: ['search'] });
    },
    onError: () => toast.error('Failed to publish post'),
  });

  const PostRow = ({ post, isDraft }) => (
    <div className="flex items-center justify-between py-3 border-b border-ink-border last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-cream text-sm font-medium truncate">{post.title}</p>
        <p className="text-xs text-cream-faint mt-0.5">
          {isDraft
            ? `Edited ${format(new Date(post.updated_at), 'MMM d')}`
            : post.published_at
              ? `Published ${format(new Date(post.published_at), 'MMM d, yyyy')}`
              : 'Published'
          }
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isDraft && (
          <button
            onClick={() => publishMutation.mutate(post.id)}
            className="text-xs font-medium border border-ink-border rounded-lg text-amber px-3 py-1.5 hover:border-amber hover:bg-blue-50 transition-colors"
          >
            <Send className="w-3 h-3 inline mr-1" />Publish
          </button>
        )}
        <Link
          to={`/dashboard/editor/${post.id}`}
          className="text-xs font-medium border border-ink-border rounded-lg text-cream-muted px-3 py-1.5 hover:border-cream-muted hover:text-cream transition-colors"
        >
          <PenSquare className="w-3 h-3 inline mr-1" />Edit
        </Link>
        <button
          onClick={() => deleteMutation.mutate(post.id)}
          className="text-cream-faint hover:text-ember transition-colors p-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Helmet><title>My Posts — NeuralPost</title></Helmet>
      <div className="flex min-h-screen bg-ink-soft">
        <DashboardNav />
        <main className="flex-1 p-8 max-w-4xl overflow-auto">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-1">Content</p>
              <h1 className="font-display font-bold text-3xl text-cream">My Posts</h1>
            </div>
            <Link to="/dashboard/editor" className="btn-primary">
              <PenSquare className="w-4 h-4" /> New Post
            </Link>
          </div>

          {drafts.length > 0 && (
            <div className="bg-white border border-ink-border rounded-xl shadow-card p-6 mb-4">
              <h2 className="text-sm font-semibold text-cream-muted mb-4 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber" /> Drafts ({drafts.length})
              </h2>
              {drafts.map(p => <PostRow key={p.id} post={p} isDraft />)}
            </div>
          )}

          <div className="bg-white border border-ink-border rounded-xl shadow-card p-6">
            <h2 className="text-sm font-semibold text-cream-muted mb-4 flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-amber" /> Published ({posts.length})
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-12 bg-ink-raised animate-pulse" />
                ))}
              </div>
            ) : posts.length === 0 ? (
                <p className="text-cream-faint text-sm text-center py-8">
                No published posts yet.
              </p>
            ) : (
              posts.map(p => <PostRow key={p.id} post={p} />)
            )}
          </div>
        </main>
      </div>
    </>
  );
}
