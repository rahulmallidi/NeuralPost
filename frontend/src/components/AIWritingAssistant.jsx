import { useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Sparkles, Loader2, X, Wand2 } from 'lucide-react';

const INSTRUCTIONS = [
  'Improve clarity and engagement',
  'Make it more concise',
  'Add a technical explanation',
  'Fix grammar and style',
  'Make it more compelling',
];

export default function AIWritingAssistant({ editor, onClose }) {
  const [instruction, setInstruction] = useState(INSTRUCTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleAssist = async () => {
    const selectedText = editor?.state?.doc?.textBetween(
      editor.state.selection.from,
      editor.state.selection.to
    ) || editor?.getText()?.substring(0, 500);

    if (!selectedText) {
      toast.error('Select some text or write something first');
      return;
    }

    setLoading(true);
    setResult('');
    try {
      const { data } = await api.post('/ai/writing-assist', { text: selectedText, instruction });
      setResult(data.result);
    } catch {
      toast.error('AI assist failed');
    } finally {
      setLoading(false);
    }
  };

  const applyResult = () => {
    if (result && editor) {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        editor.chain().focus().deleteRange({ from, to }).insertContent(result).run();
      } else {
        editor.chain().focus().insertContent(result).run();
      }
      setResult('');
      toast.success('Applied!');
    }
  };

  return (
    <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-purple-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> AI Writing Assistant
        </span>
        <button onClick={onClose} className="text-purple-400 hover:text-purple-700"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        {INSTRUCTIONS.map(inst => (
          <button key={inst} onClick={() => setInstruction(inst)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              instruction === inst ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-100'
            }`}>
            {inst}
          </button>
        ))}
      </div>

      <button onClick={handleAssist} disabled={loading}
        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-60">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        {loading ? 'Thinking...' : 'Improve Selected Text'}
      </button>

      {result && (
        <div className="mt-3 bg-white border border-purple-200 rounded-lg p-3">
          <p className="text-sm text-gray-700 mb-2">{result}</p>
          <button onClick={applyResult}
            className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700">
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
