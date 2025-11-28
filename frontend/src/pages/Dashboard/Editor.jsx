import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import api from '../../lib/api';
import DashboardNav from '../../components/DashboardNav';
import AIWritingAssistant from '../../components/AIWritingAssistant';
import toast from 'react-hot-toast';
import { Save, Send, Sparkles, Tag, Loader2 } from 'lucide-react';

export default function DashboardEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your post...' }),
    ],
    editorProps: {
      attributes: {
        class: 'prose focus:outline-none min-h-[400px] px-1',
      },
    },
  });

  // Load existing post
  const { data: existingPost } = useQuery({
    queryKey: ['post-edit', id],
    queryFn: () => api.get(`/posts/${id}`).then(r => r.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (existingPost && editor) {
      setTitle(existingPost.title);
      setTags(existingPost.tags?.map(t => t.name) || []);
      editor.commands.setContent(existingPost.content);
    }
  }, [existingPost, editor]);

  const saveMutation = useMutation({
    mutationFn: (data) => id
      ? api.put(`/posts/${id}`, data)
      : api.post('/posts', data),
    onSuccess: (res) => {
      toast.success(id ? 'Post updated!' : 'Draft saved!');
      if (!id) navigate(`/dashboard/editor/${res.data.id}`);
    },
    onError: () => toast.error('Failed to save post'),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const content = editor.getText();
      const res = id
        ? await api.put(`/posts/${id}`, { title, content: editor.getText(), tags, status: 'published' })
        : await api.post('/posts', { title, content, tags, status: 'published' });
      return res;
    },
    onSuccess: () => {
      toast.success('Post published! 🎉');
      navigate('/dashboard/posts');
    },
    onError: () => toast.error('Failed to publish'),
  });

  const handleSave = () => {
    saveMutation.mutate({
      title,
      content: editor?.getText() || '',
      tags,
      status: 'draft',
    });
  };

  const handleSuggestTags = async () => {
    if (!editor?.getText()) return;
    setSuggestingTags(true);
    try {
      const { data } = await api.post('/ai/suggest-tags', { content: editor.getText() });
      setTags(prev => [...new Set([...prev, ...data.tags])]);
      toast.success('AI suggested tags added!');
    } catch {
      toast.error('Tag suggestion failed');
    } finally {
      setSuggestingTags(false);
    }
  };

  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      setTags(prev => [...new Set([...prev, tagInput.trim()])]);
      setTagInput('');
    }
  };

  return (
    <>
      <Helmet><title>{id ? 'Edit Post' : 'New Post'} — NeuralPost</title></Helmet>
      <div className="flex min-h-screen bg-gray-50">
        <DashboardNav />
        <main className="flex-1 p-8">
          <div className="max-w-3xl mx-auto">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold text-gray-900">{id ? 'Edit Post' : 'New Post'}</h1>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAI(!showAI)}
                  className="flex items-center gap-1.5 text-sm text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100">
                  <Sparkles className="w-4 h-4" /> AI Assistant
                </button>
                <button onClick={handleSave} disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 text-sm text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Draft
                </button>
                <button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}
                  className="flex items-center gap-1.5 text-sm text-white bg-blue-600 px-4 py-1.5 rounded-lg hover:bg-blue-700">
                  {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Publish
                </button>
              </div>
            </div>

            {showAI && <AIWritingAssistant editor={editor} onClose={() => setShowAI(false)} />}

            {/* Editor */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Post title..."
                className="w-full text-3xl font-bold text-gray-900 px-8 pt-8 pb-4 border-0 focus:outline-none placeholder-gray-300"
              />
              <div className="border-t border-gray-100 px-8 py-6">
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Tags */}
            <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Tag className="w-4 h-4" /> Tags
                </label>
                <button onClick={handleSuggestTags} disabled={suggestingTags}
                  className="text-xs text-purple-600 flex items-center gap-1 hover:text-purple-700">
                  {suggestingTags ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  AI suggest
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map(t => (
                  <span key={t} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                    {t}
                    <button onClick={() => setTags(prev => prev.filter(x => x !== t))} className="text-blue-400 hover:text-blue-700 ml-1">&times;</button>
                  </span>
                ))}
              </div>
              <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag}
                placeholder="Add tag (press Enter)..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
