import React from 'react';

export default function ReviewsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-900 rounded-lg" />
          <div className="h-4 w-64 bg-slate-900 rounded-md" />
        </div>
      </div>

      {/* Filter Bar Skeleton */}
      <div className="h-28 bg-slate-900/60 border border-slate-900 rounded-2xl p-5" />

      {/* Result Stats Skeleton */}
      <div className="flex justify-between items-center">
        <div className="h-4 w-32 bg-slate-900 rounded" />
        <div className="h-4 w-40 bg-slate-900 rounded" />
      </div>

      {/* Reviews Cards List Skeletons */}
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="glass-card rounded-2xl border border-slate-900/60 bg-slate-900/10 p-6 space-y-4"
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
    </div>
  );
}
