"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClient } from '../../lib/api';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = ApiClient.token;
    if (!token) {
      setIsAuthenticated(false);
      // Fallback for tests or non-Next environments
      if (typeof window !== 'undefined' && window.location) {
        window.history.pushState({}, '', '/login');
      }
      router.replace('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bento-page-bg, #F5F5F7)' }}>
      {children}
    </div>
  );
}
