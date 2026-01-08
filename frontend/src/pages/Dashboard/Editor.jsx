import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import api from '../../lib/api';
import DashboardNav from '../../components/DashboardNav';
import AIWritingAssistant from '../../components/AIWritingAssistant';
import toast from 'react-hot-toast';
import Image from '@tiptap/extension-image';
import {
  Save, Send, Sparkles, Tag, Loader2, ImagePlus, Image as ImageIcon, X,
  Bold, Italic, Strikethrough, List, ListOrdered, Quote, Code2, FileCode,
  Minus, Link2, Link2Off,
} from 'lucide-react';

export default function DashboardEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [showCoverInput, setShowCoverInput] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: 'Start writing your post...' }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-amber underline underline-offset-2 hover:text-amber-light' } }),
    ],
    editorProps: {
      attributes: {
        // No max-height — editor grows freely with content
        class: 'focus:outline-none min-h-[320px] h-auto px-1',
      },
    },
  });

  // Word count — use `{ editor: e }` argument to avoid stale closure after setContent
  useEffect(() => {
    if (!editor) return;
    const update = ({ editor: e }) => {
      const text = e.getText();
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    };
    editor.on('update', update);
    return () => editor.off('update', update);
  }, [editor]);

  const handleSetLink = useCallback(() => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', prev || 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

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
      if (existingPost.cover_image_url) {
        setCoverImageUrl(existingPost.cover_image_url);
        setShowCoverInput(true);
      }
      // Load HTML so TipTap renders formatting correctly
      editor.commands.setContent(existingPost.content_html || existingPost.content);
      // Compute word count from raw content — editor.getText() after setContent
      // is unreliable due to async ProseMirror transaction scheduling
      const rawText = (existingPost.content_html || existingPost.content || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      setWordCount(rawText ? rawText.split(/\s+/).length : 0);
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
      const content = editor.getHTML();
      const res = id
        ? await api.put(`/posts/${id}`, { title, content, coverImageUrl: coverImageUrl || undefined, tags, status: 'published' })
        : await api.post('/posts', { title, content, coverImageUrl: coverImageUrl || undefined, tags, status: 'published' });
      return res;
    },
    onSuccess: () => {
      toast.success('Post published! 🎉');
      // Bust public feeds so the new post appears at the top immediately
      qc.invalidateQueries({ queryKey: ['posts-home'] });
      qc.invalidateQueries({ queryKey: ['search'] });
      navigate('/dashboard/posts');
    },
    onError: () => toast.error('Failed to publish'),
  });

  const handleSave = () => {
    saveMutation.mutate({
      title,
      content: editor?.getHTML() || '',
      coverImageUrl: coverImageUrl || undefined,
      tags,
      status: 'draft',
    });
  };

  const handleInsertImage = () => {
    if (!imageUrlInput.trim()) return;
    editor.chain().focus().setImage({ src: imageUrlInput.trim() }).run();
    setImageUrlInput('');
    setShowImagePrompt(false);
  };

  const handleSuggestTags = async () => {
    if (!editor?.getText()) return;
    setSuggestingTags(true);
    try {
      const { data } = await api.post('/ai/suggest-tags', { title, content: editor.getText() });
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
      <div className="flex min-h-screen bg-ink-soft">
        <DashboardNav />
        <main className="flex-1 p-8">
          <div className="max-w-3xl mx-auto">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-1">Editor</p>
                <h1 className="font-display font-bold text-2xl text-cream">{id ? 'Edit Post' : 'New Post'}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAI(!showAI)}
                  className={`btn-ghost text-sm ${
                    showAI ? 'border-amber text-amber' : ''
                  }`}
                >
                  <Sparkles className="w-4 h-4" /> AI
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="btn-ghost text-sm"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Draft
                </button>
                <button
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  className="btn-primary text-sm"
                >
                  {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Publish
                </button>
              </div>
            </div>

            {showAI && <AIWritingAssistant editor={editor} setTitle={setTitle} setWordCount={setWordCount} onClose={() => setShowAI(false)} />}

            {/* Editor surface */}
            <div className="bg-white border border-ink-border rounded-xl shadow-card">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Post title..."
                className="w-full font-display font-black text-3xl text-cream bg-transparent px-8 pt-8 pb-4 border-0 focus:outline-none placeholder-cream-faint/30"
              />

              {/* Cover image */}
              <div className="px-8 pb-4">
                {showCoverInput ? (
                  <div className="flex items-center gap-2">
                    {coverImageUrl && (
                      <img src={coverImageUrl} alt="cover" className="w-16 h-10 object-cover rounded border border-ink-border shrink-0" />
                    )}
                    <input
                      type="url"
                      value={coverImageUrl}
                      onChange={e => setCoverImageUrl(e.target.value)}
                      placeholder="Paste cover image URL..."
                      className="input-field text-xs flex-1"
                    />
                    <button
                      onClick={() => { setCoverImageUrl(''); setShowCoverInput(false); }}
                      className="text-cream-faint hover:text-cream transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCoverInput(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-cream-faint hover:text-cream transition-colors"
                  >
                    <ImagePlus className="w-4 h-4" /> Add Cover Image
                  </button>
                )}
              </div>

              {/* Formatting toolbar */}
              <div className="border-t border-ink-border px-4 py-2 flex items-center flex-wrap gap-0.5 bg-ink-soft">
                {[
                  { icon: <Bold className="w-3.5 h-3.5" />, action: () => editor.chain().focus().toggleBold().run(), active: editor?.isActive('bold'), title: 'Bold (Ctrl+B)' },
                  { icon: <Italic className="w-3.5 h-3.5" />, action: () => editor.chain().focus().toggleItalic().run(), active: editor?.isActive('italic'), title: 'Italic (Ctrl+I)' },
                  { icon: <Strikethrough className="w-3.5 h-3.5" />, action: () => editor.chain().focus().toggleStrike().run(), active: editor?.isActive('strike'), title: 'Strikethrough' },
                  null,
                  { icon: <span className="font-display font-black text-[11px]">H1</span>, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor?.isActive('heading', { level: 1 }), title: 'Heading 1' },
                  { icon: <span className="font-display font-black text-[11px]">H2</span>, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive('heading', { level: 2 }), title: 'Heading 2' },
                  { icon: <span className="font-display font-black text-[11px]">H3</span>, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor?.isActive('heading', { level: 3 }), title: 'Heading 3' },
                  null,
                  { icon: <List className="w-3.5 h-3.5" />, action: () => editor.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList'), title: 'Bullet list' },
                  { icon: <ListOrdered className="w-3.5 h-3.5" />, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList'), title: 'Ordered list' },
                  { icon: <Quote className="w-3.5 h-3.5" />, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor?.isActive('blockquote'), title: 'Blockquote' },
                  null,
                  { icon: <Code2 className="w-3.5 h-3.5" />, action: () => editor.chain().focus().toggleCode().run(), active: editor?.isActive('code'), title: 'Inline code' },
                  { icon: <FileCode className="w-3.5 h-3.5" />, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor?.isActive('codeBlock'), title: 'Code block' },
                  { icon: <Minus className="w-3.5 h-3.5" />, action: () => editor.chain().focus().setHorizontalRule().run(), active: false, title: 'Horizontal rule' },
                  null,
                  { icon: <Link2 className="w-3.5 h-3.5" />, action: handleSetLink, active: editor?.isActive('link'), title: 'Add link' },
                  { icon: <Link2Off className="w-3.5 h-3.5" />, action: () => editor.chain().focus().unsetLink().run(), active: false, title: 'Remove link', disabled: !editor?.isActive('link') },
                ].map((item, i) =>
                  item === null
                    ? <div key={i} className="w-px h-5 bg-ink-border mx-1" />
                    : <button
                        key={i}
                        type="button"
                        title={item.title}
                        disabled={item.disabled}
                        onMouseDown={e => { e.preventDefault(); item.action(); }}
                        className={`flex items-center justify-center w-7 h-7 transition-colors rounded-sm
                          ${ item.active
                            ? 'bg-amber text-ink'
                            : 'text-cream-muted hover:bg-ink-soft hover:text-cream'}
                          ${ item.disabled ? 'opacity-30 pointer-events-none' : ''}`}
                      >
                        {item.icon}
                      </button>
                )}
              </div>

              {/* Inline image insert */}
              <div className="border-t border-ink-border px-8 pt-3 pb-1 flex items-center gap-2">
                <button
                  onClick={() => setShowImagePrompt(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-cream-faint hover:text-amber transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Insert Image
                </button>
                {showImagePrompt && (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={e => setImageUrlInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleInsertImage()}
                      placeholder="Image URL..."
                      className="input-field text-xs flex-1"
                      autoFocus
                    />
                    <button
                      onClick={handleInsertImage}
                      className="btn-ghost text-xs py-1 px-2"
                    >
                      Insert
                    </button>
                    <button onClick={() => { setShowImagePrompt(false); setImageUrlInput(''); }} className="text-cream-faint hover:text-cream">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="px-8 py-6">
                <EditorContent editor={editor} />
              </div>
              <div className="border-t border-ink-border px-8 py-2 flex items-center justify-end gap-4 text-xs text-cream-faint">
                <span>
                  <span className={wordCount > 0 ? 'text-cream-muted' : ''}>{wordCount.toLocaleString()}</span> words
                </span>
                <span className="text-ink-border">·</span>
                <span>~{Math.max(1, Math.ceil(wordCount / 200))} min read</span>
              </div>
            </div>

            {/* Tags */}
            <div className="mt-3 bg-white border border-ink-border rounded-xl shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-cream-muted flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Tags
                </label>
                <button
                  onClick={handleSuggestTags}
                  disabled={suggestingTags}
                  className="text-xs font-medium text-amber hover:text-amber-light flex items-center gap-1.5 transition-colors"
                >
                  {suggestingTags ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  AI Suggest
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map(t => (
                  <span
                    key={t}
                    className="tag-pill flex items-center gap-1.5 border-amber/40 text-amber"
                  >
                    {t}
                    <button
                      onClick={() => setTags(prev => prev.filter(x => x !== t))}
                      className="hover:text-ember transition-colors"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={addTag}
                placeholder="Add tag and press Enter..."
                className="input-field text-sm"
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
