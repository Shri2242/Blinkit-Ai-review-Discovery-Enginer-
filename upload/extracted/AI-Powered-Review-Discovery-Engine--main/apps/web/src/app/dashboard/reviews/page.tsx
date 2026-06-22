'use client';
import { Search, Star, AlertTriangle, Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';

import api from '@/lib/api';
import { useProjectStore } from '@/store/project';

export default function ReviewsPage() {
  const { currentProject } = useProjectStore();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!currentProject?.id) {
      setLoading(false);
      return;
    }
    api
      .get(`/projects/${currentProject.id}/ai/reviews?limit=50&sortBy=newest`)
      .then((r) => setReviews(r.data.data?.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentProject?.id]);

  const filtered = reviews.filter((r) => {
    if (filter === 'bugs') return r.isBug;
    if (filter === 'features') return r.isFeatureRequest;
    if (filter === 'positive') return r.sentiment === 'positive';
    if (filter === 'negative') return r.sentiment === 'negative';
    if (search) return (r.reviewText || '').toLowerCase().includes(search.toLowerCase());
    return true;
  });

  if (!currentProject)
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <p>No Project Selected</p>
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Reviews</h1>
          <p className="page-subtitle">
            {reviews.length} reviews in {currentProject.name}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reviews..."
            className="input pl-10 w-64"
          />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {[
          { k: 'all', l: 'All' },
          { k: 'positive', l: 'Positive' },
          { k: 'negative', l: 'Negative' },
          { k: 'bugs', l: 'Bugs' },
          { k: 'features', l: 'Features' },
        ].map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${filter === f.k ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
          >
            {f.l}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, 30).map((r) => (
            <div key={r.id} className="card hover:shadow-md transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {r.rating && (
                      <div className="flex items-center gap-0.5">
                        <Star
                          className={`w-3.5 h-3.5 ${r.rating >= 4 ? 'text-amber-400 fill-amber-400' : r.rating <= 2 ? 'text-red-400 fill-red-400' : 'text-slate-400'}`}
                        />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {r.rating}
                        </span>
                      </div>
                    )}
                    {r.sentiment && (
                      <span
                        className={`badge ${r.sentiment === 'positive' ? 'badge-green' : r.sentiment === 'negative' ? 'badge-red' : r.sentiment === 'mixed' ? 'badge-yellow' : 'badge-slate'}`}
                      >
                        {r.sentiment}
                      </span>
                    )}
                    {r.isBug && (
                      <span className="badge badge-red">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Bug
                      </span>
                    )}
                    {r.isFeatureRequest && (
                      <span className="badge badge-blue">
                        <Lightbulb className="w-3 h-3 mr-1" />
                        Feature
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed line-clamp-3">
                    {r.reviewText || r.text}
                  </p>
                  {r.aiSummary && (
                    <p className="mt-1.5 text-xs text-brand-600 dark:text-brand-400 italic">
                      {r.aiSummary}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">
                    {r.reviewDate ? new Date(r.reviewDate).toLocaleDateString() : ''}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{r.source}</p>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500">No reviews found.</div>
          )}
        </div>
      )}
    </div>
  );
}
