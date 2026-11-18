'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Shield, Github, BarChart3, LogIn, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UserDTO } from '@shared/types/contracts';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // 1. Check local storage cache first for instant synchronous UI state
    try {
      const cached = localStorage.getItem('auth_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.email || parsed.username)) {
          setUser(parsed);
        }
      }
    } catch {
      // LocalStorage access error
    }

    // 2. Validate against server session
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setUser(data.user);
          try {
            localStorage.setItem('auth_user', JSON.stringify(data.user));
          } catch {
            // Ignore
          }
          setLoading(false);
          return;
        }
      }
      // If server returned 401 or no user, clear session
      setUser(null);
      try {
        localStorage.removeItem('auth_user');
      } catch {
        // Ignore
      }
    } catch {
      // Network error, keep cached state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Listen to custom auth events from login/logout/register
    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<UserDTO | null>;
      if (customEvent.detail) {
        setUser(customEvent.detail);
        try {
          localStorage.setItem('auth_user', JSON.stringify(customEvent.detail));
        } catch {
          // Ignore
        }
      } else {
        setUser(null);
        try {
          localStorage.removeItem('auth_user');
        } catch {
          // Ignore
        }
        checkAuth();
      }
    };

    window.addEventListener('auth-state-change', handleAuthChange);
    return () => {
      window.removeEventListener('auth-state-change', handleAuthChange);
    };
  }, [checkAuth, pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignored
    } finally {
      setUser(null);
      try {
        localStorage.removeItem('auth_user');
      } catch {
        // Ignore
      }
      window.dispatchEvent(new CustomEvent('auth-state-change', { detail: null }));
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-[#09090b]/90 backdrop-blur-md print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 bg-[#141416] text-neutral-200 group-hover:border-neutral-700 transition-colors">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-neutral-100">
              BugPulse
            </span>
            <Badge variant="outline" className="text-[10px] text-neutral-400 font-mono py-0 px-1.5 border-neutral-800">
              v1.2
            </Badge>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {/* Subtle System Status */}
          <div className="hidden md:flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-neutral-400 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Llama 3.3 70B active
            </span>
            <span className="text-neutral-700">&bull;</span>
            <span className="flex items-center gap-1.5 text-neutral-400 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
              AST calibrated
            </span>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Analyzer</span>
            </Link>

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-neutral-800 bg-[#141416] px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors"
            >
              <Github className="h-3.5 w-3.5 text-neutral-400" />
              <span className="hidden sm:inline">GitHub</span>
            </a>

            {/* Authentication Control: Strictly mutually exclusive */}
            <div className="pl-2 border-l border-neutral-800">
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-[#141416] px-2.5 py-1 text-xs border border-neutral-800 font-mono text-neutral-200">
                    <User className="h-3 w-3 text-neutral-400" />
                    <span className="max-w-[120px] truncate">{user.username}</span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="text-xs h-7 px-2.5 border-neutral-800 bg-[#141416] hover:bg-neutral-800 text-neutral-300 hover:text-white"
                    title="Log out"
                  >
                    <LogOut className="h-3 w-3 mr-1 text-neutral-400" />
                    <span>Log out</span>
                  </Button>
                </div>
              ) : !loading ? (
                <Link href="/login">
                  <Button variant="default" size="sm" className="h-7 text-xs font-medium bg-neutral-100 text-neutral-900 hover:bg-white">
                    <LogIn className="h-3 w-3 mr-1" />
                    <span>Sign in</span>
                  </Button>
                </Link>
              ) : (
                <div className="h-7 w-16 bg-[#141416] rounded" />
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
