'use client';

import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, Clock, Coins, DollarSign } from 'lucide-react';
import React, { useState } from 'react';

export interface SourceItem {
  id: string;
  text: string;
  similarity: number;
  sentiment?: string | null;
  source?: string | null;
}

export interface ChatMessageType {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    source_review_ids?: string[];
    sources?: SourceItem[];
    model?: string;
    usage?: { inputTokens: number; outputTokens: number; totalTokens?: number };
    cost?: { totalCost: number };
    latency_ms?: number;
  };
  createdAt?: string;
  created_at?: string;
}

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);
  const isAssistant = message.role === 'assistant';

  // Format message creation timestamp
  const dateObj = new Date(message.createdAt || message.created_at || new Date());
  const timeAgo = isNaN(dateObj.getTime()) ? '' : formatDistanceToNow(dateObj, { addSuffix: true });

  // Custom inline bold rendering
  const renderInlineBold = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  // Custom basic markdown lines parser
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentListItems: React.ReactNode[] = [];

    const flushList = (key: string | number) => {
      if (currentListItems.length > 0) {
        elements.push(
          <ul key={`list-${key}`} className="list-disc pl-5 my-2 space-y-1.5">
            {currentListItems}
          </ul>
        );
        currentListItems = [];
      }
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');

      if (isBullet) {
        const content = trimmed.replace(/^[-*]\s+/, '');
        currentListItems.push(
          <li key={`li-${i}`} className="text-sm text-slate-300">
            {renderInlineBold(content)}
          </li>
        );
      } else {
        flushList(i);
        if (trimmed.length > 0) {
          elements.push(
            <p key={`p-${i}`} className="text-sm text-slate-300 leading-relaxed mb-2.5 last:mb-0">
              {renderInlineBold(line)}
            </p>
          );
        } else {
          elements.push(<div key={`br-${i}`} className="h-2" />);
        }
      }
    });

    flushList('final');
    return elements;
  };

  const getSentimentStyles = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'negative':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'neutral':
        return 'bg-slate-800 text-slate-400 border border-slate-700';
      case 'mixed':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      default:
        return 'bg-slate-900 text-slate-500 border border-slate-800';
    }
  };

  const getSourceStyles = (source: string) => {
    switch (source?.toLowerCase()) {
      case 'csv_upload':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'app_store':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'google_play':
        return 'bg-green-500/10 text-green-400 border border-green-500/20';
      case 'g2':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'trustpilot':
        return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source?.toLowerCase()) {
      case 'csv_upload':
        return 'CSV';
      case 'app_store':
        return 'App Store';
      case 'google_play':
        return 'Google Play';
      case 'g2':
        return 'G2';
      case 'trustpilot':
        return 'Trustpilot';
      default:
        return source || 'System';
    }
  };

  // Assistant Chat Bubble
  if (isAssistant) {
    const usage = message.metadata?.usage;
    const cost = message.metadata?.cost;
    const latencyMs = message.metadata?.latency_ms;
    const sources = message.metadata?.sources || [];
    const sourceIds = message.metadata?.source_review_ids || [];

    const totalTokens =
      usage?.totalTokens || (usage ? (usage.inputTokens || 0) + (usage.outputTokens || 0) : 0);
    const costText = cost?.totalCost ? `$${cost.totalCost.toFixed(4)}` : '$0.0000';
    const latencyText = latencyMs ? `${(latencyMs / 1000).toFixed(2)}s` : '0.0s';
    const tokenText = totalTokens ? `${totalTokens.toLocaleString()} tokens` : '';

    return (
      <div className="flex flex-col items-start gap-1 w-full max-w-[85%] md:max-w-[75%] mr-auto">
        <div className="w-full rounded-2xl rounded-tl-none p-5 border border-slate-800 bg-slate-900/50 backdrop-blur-md shadow-lg shadow-slate-950/20">
          {/* Main Content */}
          <div className="space-y-1">{parseMarkdown(message.content)}</div>

          {/* Collapsible Sources Citation block */}
          {sourceIds.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <button
                onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition focus:outline-none"
              >
                <span>Sources ({sources.length || sourceIds.length})</span>
                {isSourcesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {isSourcesExpanded && (
                <div className="mt-2.5 space-y-2">
                  {sources.length > 0 ? (
                    sources.map((src, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-xl border border-slate-800 bg-slate-950/40 space-y-1.5"
                      >
                        <p className="text-xs text-slate-300 italic leading-relaxed">
                          &ldquo;{src.text}&rdquo;
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {(src.similarity * 100).toFixed(0)}% Match
                          </span>
                          {src.sentiment && (
                            <span
                              className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${getSentimentStyles(src.sentiment)}`}
                            >
                              {src.sentiment}
                            </span>
                          )}
                          {src.source && (
                            <span
                              className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${getSourceStyles(src.source)}`}
                            >
                              {getSourceLabel(src.source)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 italic p-1">
                      {sourceIds.length} review IDs referenced in this query.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info stats */}
        <div className="flex items-center gap-3 px-3 text-[10px] text-slate-500 mt-1">
          {cost && (
            <div className="flex items-center gap-1">
              <DollarSign size={10} className="shrink-0" />
              <span>{costText}</span>
            </div>
          )}
          {latencyMs && (
            <div className="flex items-center gap-1">
              <Clock size={10} className="shrink-0" />
              <span>{latencyText}</span>
            </div>
          )}
          {totalTokens > 0 && (
            <div className="flex items-center gap-1">
              <Coins size={10} className="shrink-0" />
              <span>{tokenText}</span>
            </div>
          )}
          {timeAgo && <span className="ml-1 text-slate-600">{timeAgo}</span>}
        </div>
      </div>
    );
  }

  // User Chat Bubble
  return (
    <div className="flex flex-col items-end gap-1 w-full max-w-[85%] md:max-w-[70%] ml-auto">
      <div className="rounded-2xl rounded-tr-none px-4.5 py-3 bg-indigo-600 text-slate-100 shadow-md shadow-indigo-950/20">
        <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
      {timeAgo && <span className="px-2 text-[10px] text-slate-500 mt-0.5">{timeAgo}</span>}
    </div>
  );
}
