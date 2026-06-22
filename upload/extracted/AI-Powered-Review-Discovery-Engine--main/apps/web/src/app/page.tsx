'use client';

import { Search, ArrowRight, MessageSquare, Shield, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

import { useAuthStore } from '@/store/auth';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col justify-between">
      {/* Glow backgrounds */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Search className="text-white" size={20} />
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Review Discovery Engine
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-slate-300 hover:text-white transition text-sm font-semibold px-4 py-2"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition shadow-lg shadow-indigo-600/10"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Body */}
      <main className="relative max-w-5xl mx-auto px-6 text-center py-20 z-10 flex-grow flex flex-col justify-center items-center">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent leading-[1.1] mb-6">
          Analyze Product Reviews <br />
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Using AI Agents
          </span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl mb-10 leading-relaxed">
          Aggregated metrics, semantic search lookup, chatbot exploration with citations, and
          AI-generated weekly summaries for App Store and Play Store reviews.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-sm mb-16">
          <Link
            href="/register"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl py-3.5 font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
          >
            Get Started Free
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/login"
            className="w-full bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-slate-200 rounded-xl py-3.5 font-bold transition flex items-center justify-center"
          >
            Log In
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-12 text-left">
          <div className="glass-card rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-400">
              <BarChart3 size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-100 mb-2">Metrics & Trends</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Real-time dashboards tracking sentiments, issues distribution, bugs, features, and
              source volume changes.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-400">
              <MessageSquare size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-100 mb-2">RAG AI Chatbot</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Explore your reviews database through interactive chats complete with precise
              citations and source breakdowns.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-400">
              <Shield size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-100 mb-2">Webhook Integrations</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Register endpoints with HMAC signing to fire webhook events on ingestion triggers or
              negative spikes.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative w-full max-w-7xl mx-auto px-6 py-8 text-center text-xs text-slate-600 border-t border-slate-900/60 z-10">
        &copy; {new Date().getFullYear()} Review Discovery Engine. Powered by DeepSeek and pgvector.
      </footer>
    </div>
  );
}
