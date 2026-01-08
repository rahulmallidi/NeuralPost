import { useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Loader2, X, Wand2, PenLine, Sparkles } from 'lucide-react';

const INSTRUCTIONS = [
  'Improve clarity and engagement',
  'Make it more concise',
  'Add a technical explanation',
  'Fix grammar and style',
  'Make it more compelling',
];

const TONES = ['Professional', 'Casual', 'Technical', 'Creative'];

export default function AIWritingAssistant({ editor, setTitle, setWordCount, onClose }) {
  const [tab, setTab] = useState('generate');

  // Generate Post state
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('Professional');
  const [targetWords, setTargetWords] = useState('900');
  const [generating, setGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState(null);
  const [ragSources, setRagSources] = useState([]);

  // Improve Text state
  const [instruction, setInstruction] = useState(INSTRUCTIONS[0]);
  const [improving, setImproving] = useState(false);
  const [result, setResult] = useState('');

  // ── Generate Post ────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error('Enter a topic first'); return; }
    setGenerating(true);
    setGeneratedPost(null);
    try {
      const { data } = await api.post('/ai/generate-post', { topic, tone, wordCount: parseInt(targetWords, 10) || 900 });
      setGeneratedPost(data);
      setRagSources(data._sources || []);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'AI generation failed. Check that GROQ_API_KEY is set in your .env';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const applyGeneratedPost = () => {
    if (!generatedPost) return;
    if (setTitle) setTitle(generatedPost.title || '');
    if (editor) {
      editor.commands.clearContent();
      // Prefer pre-converted HTML so TipTap renders headings/bold/etc correctly
      editor.commands.setContent(generatedPost.content_html || generatedPost.content || '');
    }
    // Manually recount — editor.getText() is unreliable immediately after setContent
    if (setWordCount) {
      const plainText = (generatedPost.content || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#*`_>~!\[\]()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      setWordCount(plainText ? plainText.split(/\s+/).length : 0);
    }
    toast.success('Post loaded into editor!');
    setGeneratedPost(null);
    onClose();
  };

  // ── Improve Text ─────────────────────────────────────────────────────────
  const handleAssist = async () => {
    const selectedText = editor?.state?.doc?.textBetween(
      editor.state.selection.from,
      editor.state.selection.to
    ) || editor?.getText()?.substring(0, 500);
    if (!selectedText) { toast.error('Select some text or write something first'); return; }
    setImproving(true);
    setResult('');
    try {
      const { data } = await api.post('/ai/writing-assist', { text: selectedText, instruction });
      setResult(data.result);
    } catch {
      toast.error('AI assist failed');
    } finally {
      setImproving(false);
    }
  };

  const applyResult = () => {
    if (!result || !editor) return;
    const { from, to } = editor.state.selection;
    if (from !== to) {
      editor.chain().focus().deleteRange({ from, to }).insertContent(result).run();
    } else {
      editor.chain().focus().insertContent(result).run();
    }
    setResult('');
    toast.success('Applied!');
  };

  return (
    <div className="mb-4 bg-white border border-amber/30 rounded-xl shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-ink-border">
        <div className="flex rounded-lg overflow-hidden border border-ink-border">
          <button
            onClick={() => setTab('generate')}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 transition-colors ${
              tab === 'generate'
                ? 'bg-amber text-white'
                : 'text-cream-faint hover:text-cream'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Write for Me
          </button>
          <button
            onClick={() => setTab('assist')}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 border-l border-ink-border transition-colors ${
              tab === 'assist'
                ? 'bg-amber text-white'
                : 'text-cream-faint hover:text-cream'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" /> Improve Text
          </button>
        </div>
        <button onClick={onClose} className="text-cream-faint hover:text-cream transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        {/* ── GENERATE POST TAB ── */}
        {tab === 'generate' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-cream-muted mb-2">
                What should the post be about?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  placeholder="e.g. How to build a REST API with Node.js and PostgreSQL"
                  className="input-field flex-1"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-cream-muted mb-2">Tone</label>
                <div className="flex gap-1 rounded-lg overflow-hidden border border-ink-border">
                  {TONES.map(t => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`flex-1 text-xs font-medium px-2 py-1.5 transition-colors ${
                        tone === t ? 'bg-amber text-white' : 'text-cream-faint hover:text-cream'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-cream-muted mb-2">Length (words)</label>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  step="100"
                  value={targetWords}
                  onChange={e => setTargetWords(e.target.value)}
                  className="input-field w-32 text-center"
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="btn-primary w-full"
            >
              {generating
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating post...</>
                : <><PenLine className="w-3.5 h-3.5" /> Generate Post</>}
            </button>

            {generatedPost && (
              <div className="bg-ink-raised border border-ink-border p-4 space-y-3">
                <p className="font-semibold text-cream text-sm leading-snug">{generatedPost.title}</p>
                <p className="text-cream-muted text-xs leading-relaxed line-clamp-3">
                  {generatedPost.content?.replace(/#+\s/g, '').substring(0, 240)}…
                </p>
                {ragSources.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-cream-faint">Sources:</span>
                    {ragSources.map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 bg-amber/10 text-amber border border-amber/20 rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={applyGeneratedPost} className="btn-primary text-sm">
                    <PenLine className="w-4 h-4" /> Use this post
                  </button>
                  <button onClick={() => setGeneratedPost(null)} className="btn-ghost text-sm">
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── IMPROVE TEXT TAB ── */}
        {tab === 'assist' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-cream-muted mb-2">Instruction</label>
              <div className="flex gap-1.5 flex-wrap">
                {INSTRUCTIONS.map(inst => (
                  <button
                    key={inst}
                    onClick={() => setInstruction(inst)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors border ${
                      instruction === inst
                        ? 'bg-amber text-white border-amber'
                        : 'border-ink-border text-cream-faint hover:border-cream-muted hover:text-cream-muted'
                    }`}
                  >
                    {inst}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-cream-faint text-[11px]">Select text in the editor to improve a specific section, or leave nothing selected to improve the whole post.</p>
            <button
              onClick={handleAssist}
              disabled={improving}
              className="btn-primary"
            >
              {improving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...</> : <><Wand2 className="w-3.5 h-3.5" /> Improve Selected Text</>}
            </button>
            {result && (
              <div className="bg-ink-raised border border-ink-border p-4">
                <p className="text-sm text-cream/80 mb-3 leading-relaxed">{result}</p>
                <button onClick={applyResult} className="btn-primary text-sm">
                  Apply
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
