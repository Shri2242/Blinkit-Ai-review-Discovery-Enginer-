'use client';

import { Send } from 'lucide-react';
import React, { useRef, useState, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  maxLength?: number;
}

export default function ChatInput({ onSend, disabled, maxLength = 2000 }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto resize height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    // limit height to around 4 lines (approx 110px)
    textarea.style.height = `${Math.min(scrollHeight, 110)}px`;
  }, [value]);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-2 p-2 rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-md focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/50 transition duration-150">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Waiting for AI response...'
              : 'Ask about customer feedback, bugs, or features...'
          }
          disabled={disabled}
          maxLength={maxLength}
          rows={1}
          className="flex-1 max-h-[110px] min-h-[36px] py-2 px-3 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none resize-none disabled:cursor-not-allowed scrollbar-thin"
        />

        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:bg-slate-900 disabled:text-slate-600 disabled:cursor-not-allowed shadow-md shadow-indigo-950/20"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Character count warning */}
      {value.length > 1500 && (
        <div className="text-right text-[10px] text-slate-500 mt-1 mr-2">
          {value.length} / {maxLength} characters
        </div>
      )}
    </div>
  );
}
