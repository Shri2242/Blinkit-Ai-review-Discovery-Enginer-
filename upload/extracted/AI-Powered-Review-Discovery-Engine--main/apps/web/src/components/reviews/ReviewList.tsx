'use client';

import { Loader2, MessageSquare } from 'lucide-react';
import React from 'react';

import ReviewCard, { ReviewData } from './ReviewCard';

interface ReviewListProps {
  reviews: ReviewData[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function ReviewList({ reviews, loading, hasMore, onLoadMore }: ReviewListProps) {
  if (reviews.length === 0 && !loading) {
    return (
      <div className="glass-card rounded-2xl border border-slate-900 bg-slate-900/10 p-12 text-center shadow-lg flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 animate-pulse">
          <MessageSquare size={20} />
        </div>
        <h3 className="font-bold text-slate-200 text-base mb-1">No reviews match your filters</h3>
        <p className="text-slate-500 max-w-xs text-xs">
          Try adjusting your query, widening search keywords, or clear filters to view processed
          review records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Review cards grid */}
      <div className="grid grid-cols-1 gap-4">
        {reviews.map((rev) => (
          <div key={rev.id} className="animate-fade-in">
            <ReviewCard review={rev} />
          </div>
        ))}

        {/* Loading skeletons */}
        {loading &&
          [...Array(3)].map((_, i) => (
            <div
              key={i}
              className="glass-card rounded-2xl border border-slate-900/60 bg-slate-900/10 p-6 space-y-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="h-4 w-20 bg-slate-900 rounded" />
                  <div className="h-4 w-12 bg-slate-900 rounded" />
                </div>
                <div className="h-4 w-24 bg-slate-900 rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-slate-900 rounded" />
                <div className="h-4 w-5/6 bg-slate-900 rounded" />
                <div className="h-4 w-2/3 bg-slate-900 rounded" />
              </div>
              <div className="h-4 w-16 bg-slate-900 rounded" />
            </div>
          ))}
      </div>

      {/* Pagination Load More control */}
      {hasMore && !loading && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-900 hover:border-slate-800 bg-slate-900/20 hover:bg-slate-900/60 text-slate-300 hover:text-white transition text-xs font-bold shadow-lg shadow-indigo-950/5 active:scale-[0.98]"
          >
            Load More Reviews
          </button>
        </div>
      )}

      {hasMore && loading && (
        <div className="flex justify-center pt-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
            <Loader2 className="animate-spin" size={16} />
            Loading more...
          </div>
        </div>
      )}
    </div>
  );
}
