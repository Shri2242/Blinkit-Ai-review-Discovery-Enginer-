'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import Sidebar from '@/components/layout/Sidebar';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/project';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, loadFromStorage } = useAuthStore();
  const { fetchProjects } = useProjectStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadFromStorage();
    setReady(true);
  }, [loadFromStorage]);

  useEffect(() => {
    if (ready && !isAuthenticated) {
      router.push('/login' as never);
      return;
    }
    if (isAuthenticated) {
      fetchProjects().catch(() => {});
    }
  }, [ready, isAuthenticated, router, fetchProjects]);

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex h-screen bg-surface-secondary">
        {/* Sidebar skeleton */}
        <div className="w-[260px] bg-sidebar animate-pulse" />
        {/* Content skeleton */}
        <div className="flex-1 p-8 space-y-6">
          <div className="skeleton h-8 w-48" />
          <div className="grid grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="skeleton h-80 rounded-xl" />
            <div className="skeleton h-80 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
