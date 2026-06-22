'use client';
import { Bot, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

import api from '@/lib/api';
import { useProjectStore } from '@/store/project';

export default function ChatPage() {
  const { currentProject } = useProjectStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!currentProject?.id) return;
    api
      .get(`/projects/${currentProject.id}/chat/history`)
      .then((r) => setMessages(Array.isArray(r.data.data) ? [...r.data.data].reverse() : []))
      .catch(() => {});
  }, [currentProject?.id]);

  const handleSend = async () => {
    if (!currentProject?.id || !input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setMessages((p) => [
      ...p,
      {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
    setLoading(true);
    try {
      const res = await api.post(`/projects/${currentProject.id}/chat`, { question: text });
      const { answer, sources, cost } = res.data.data;
      setMessages((p) => [
        ...p,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: answer,
          metadata: { sources, cost },
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <Bot size={48} className="text-brand-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">No Project Selected</h2>
        <p className="text-sm text-slate-500 mt-2">Select a project to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
          <Bot size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 dark:text-white">
            Review Insights Assistant
          </h1>
          <p className="text-[10px] text-slate-500">RAG powered by DeepSeek & pgvector</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              Ask about customer feedback, bugs, or features...
            </p>
            <div className="flex gap-2 justify-center mt-4 flex-wrap">
              {[
                'What are common complaints?',
                'Any bugs found?',
                'Feature requests?',
                'Performance feedback?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    handleSend();
                  }}
                  className="px-3 py-1.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.metadata?.sources?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                  <p className="text-[10px] text-slate-400 mb-1">
                    Sources ({msg.metadata.sources.length})
                  </p>
                  {msg.metadata.sources.slice(0, 3).map((s: any, i: number) => (
                    <p key={i} className="text-[10px] text-slate-500 truncate">
                      [{s.sentiment}] {s.text?.substring(0, 60)}...
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about reviews..."
            disabled={loading}
            className="input flex-1"
          />
          <button onClick={handleSend} disabled={loading || !input.trim()} className="btn">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
