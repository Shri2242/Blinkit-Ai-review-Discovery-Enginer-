'use client';

import { formatDistanceToNow } from 'date-fns';
import { Bug, Calendar, ChevronDown, ChevronUp, Lightbulb, Star, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

export interface ReviewData {
  id: string;
  projectId: string;
  source: string;
  sourceReviewId?: string | null;
  reviewText: string;
  reviewTitle?: string | null;
  rating?: number | null;
  authorName?: string | null;
  reviewDate: string | Date;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed' | null;
  theme?: string | null;
  subTheme?: string | null;
  priority?: 'critical' | 'high' | 'medium' | 'low' | null;
  priorityReason?: string | null;
  keyPhrases?: string[] | null;
  aiSummary?: string | null;
  isBug: boolean;
  isFeatureRequest: boolean;
}

interface ReviewCardProps {
  review: ReviewData;
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatSource = (src: string) => {
    if (src === 'app_store' || src === 'appstore') return 'App Store';
    if (src === 'google_play' || src === 'playstore') return 'Google Play';
    return src.replace('_', ' ');
  };

  const getRelativeTime = (dateVal: string | Date) => {
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'unknown date';
      return formatDistanceToNow(d, { addSuffix: true });
    } catch {
      return 'unknown date';
    }
  };

  const renderStars = (rating: number | null | undefined) => {
    const r = rating ?? 0;
    return (
      <div className="flex items-center gap-0.5 text-amber-400">
        {[...Array(5)].map((_, idx) => (
          <Star
            key={idx}
            size={14}
            className={idx < r ? 'fill-amber-400 stroke-amber-400' : 'text-slate-700'}
          />
        ))}
      </div>
    );
  };

  const sentimentStyles = {
    positive: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15',
    negative: 'bg-red-500/10 text-red-400 border border-red-500/15',
    neutral: 'bg-slate-500/10 text-slate-400 border border-slate-500/15',
    mixed: 'bg-amber-500/10 text-amber-400 border border-amber-500/15',
  };

  const priorityStyles = {
    critical: 'bg-red-600/20 text-red-400 border border-red-500/25 font-bold',
    high: 'bg-orange-500/10 text-orange-400 border border-orange-500/15',
    medium: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15',
    low: 'bg-slate-500/10 text-slate-500 border border-slate-500/10',
  };

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      className="glass-card rounded-2xl border border-slate-900/60 bg-slate-900/10 hover:border-slate-800 p-6 shadow-lg transition duration-300 cursor-pointer relative overflow-hidden group flex flex-col justify-between"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/3 to-purple-500/3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {renderStars(review.rating)}

          {review.sentiment && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${sentimentStyles[review.sentiment] || sentimentStyles.neutral}`}
            >
              {review.sentiment}
            </span>
          )}

          {review.priority && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${priorityStyles[review.priority] || priorityStyles.low}`}
            >
              {review.priority}
            </span>
          )}

          {review.theme && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 capitalize">
              {review.theme}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="bg-slate-900 border border-slate-800/80 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-slate-400">
            {formatSource(review.source)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {getRelativeTime(review.reviewDate)}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {review.reviewTitle && (
          <h4 className="font-extrabold text-slate-100 text-sm">{review.reviewTitle}</h4>
        )}
        <p className={`text-slate-300 text-sm leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
          {review.reviewText}
        </p>
      </div>

      {isExpanded && (
        <div
          className="mt-6 pt-6 border-t border-slate-900/60 space-y-4 text-xs relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {review.aiSummary && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-900">
              <div className="font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-400" />
                AI Summary
              </div>
              <p className="text-slate-400 italic leading-relaxed">
                &ldquo;{review.aiSummary}&rdquo;
              </p>
            </div>
          )}

          {review.keyPhrases && review.keyPhrases.length > 0 && (
            <div>
              <div className="font-bold text-slate-500 uppercase tracking-wider mb-2">
                Key phrases:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {review.keyPhrases.map((phrase, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800/80 text-slate-400 font-medium"
                  >
                    {phrase}
                  </span>
                ))}
              </div>
            </div>
          )}

          {review.priorityReason && (
            <div className="text-slate-400 leading-relaxed">
              <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Priority Analysis:
              </span>
              {review.priorityReason}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-900/30 text-slate-500">
        <div className="flex items-center gap-4">
          {review.isBug && (
            <div className="flex items-center gap-1 text-red-400" title="Identified as Bug Report">
              <Bug size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Bug</span>
            </div>
          )}
          {review.isFeatureRequest && (
            <div
              className="flex items-center gap-1 text-indigo-400"
              title="Identified as Feature Request"
            >
              <Lightbulb size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Feature</span>
            </div>
          )}
        </div>

        <div className="text-slate-400 flex items-center gap-1 text-xs font-semibold group-hover:text-indigo-400 transition-colors">
          <span>{isExpanded ? 'Collapse' : 'Expand Details'}</span>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>
    </div>
  );
}
