'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Spinner } from '@/components/ui/Spinner';
import { getUserFromToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { Usuario, UsuarioResumen } from '@/types';

interface AuthContextType {
  user: UsuarioResumen | null;
  fullProfile: Usuario | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  fullProfile: null,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UsuarioResumen | null>(null);
  const [fullProfile, setFullProfile] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFullProfile = useCallback(async () => {
    try {
      const data = await apiFetch<Usuario>('/auth/me');
      setFullProfile(data);
    } catch (err) {
      // If /auth/me fails, user might be unauthorized, but we handle it gracefully
      console.error('Error fetching full profile:', err);
    }
  }, []);

  useEffect(() => {
    const activeUser = getUserFromToken();
    if (!activeUser) {
      router.replace('/login');
      return;
    }

    Promise.resolve().then(() => {
      setUser(activeUser);
      // Fetch detailed profile from server in parallel
      fetchFullProfile().finally(() => {
        setIsLoading(false);
      });
    });
  }, [router, fetchFullProfile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Validando credenciales...</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, fullProfile, refreshProfile: fetchFullProfile }}>
      <div className="flex h-screen bg-zinc-50 overflow-hidden">
        {/* Persistent Left Sidebar */}
        <div className="hidden md:flex shrink-0">
          <Sidebar />
        </div>

        {/* Right Main Panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Persistent Header */}
          <div className="fixed top-0 left-0 right-0 md:static z-30 shrink-0">
            <TopBar />
          </div>

          {/* Scrolling Main Content */}
          <main className="flex-1 overflow-y-auto pt-20 pb-24 md:py-8 px-4 md:px-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 md:gap-8">
              {children}
            </div>
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <BottomNav />
        </div>
      </div>
    </AuthContext.Provider>
  );
}
