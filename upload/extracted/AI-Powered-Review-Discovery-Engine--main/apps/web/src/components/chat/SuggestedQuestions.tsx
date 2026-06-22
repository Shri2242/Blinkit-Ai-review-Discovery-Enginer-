'use client';

import { Lightbulb, MessageSquare } from 'lucide-react';
import React from 'react';

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export default function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  const suggestions = [
    {
      text: 'What are the most common complaints?',
      icon: MessageSquare,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
    },
    {
      text: 'Are there any critical bugs reported this week?',
      icon: Lightbulb,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      text: 'What do users think about the pricing?',
      icon: MessageSquare,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      text: 'Summarize the negative feedback about payments',
      icon: Lightbulb,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center max-w-2xl mx-auto my-auto py-12 px-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-100 mb-2">AI-Powered Review Chat</h2>
        <p className="text-slate-400 text-sm max-w-md">
          Ask questions about your project reviews. Get answers synthesised with sources and
          semantic insights.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {suggestions.map((suggestion, index) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={index}
              onClick={() => onSelect(suggestion.text)}
              className="flex items-start gap-4 p-5 rounded-2xl text-left border border-slate-800 bg-slate-900/40 hover:bg-slate-900/80 hover:border-slate-700 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <div
                className={`p-2.5 rounded-xl ${suggestion.bgColor} ${suggestion.color} group-hover:scale-105 transition-transform shrink-0`}
              >
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-300 group-hover:text-slate-200 leading-snug">
                  {suggestion.text}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
