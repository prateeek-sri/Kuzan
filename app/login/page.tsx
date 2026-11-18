'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Invalid email or password');
      }

      // Store authenticated user in localStorage for instant reactive UI
      if (data.user) {
        try {
          localStorage.setItem('auth_user', JSON.stringify(data.user));
          window.dispatchEvent(new CustomEvent('auth-state-change', { detail: data.user }));
        } catch {
          // LocalStorage fallback
        }
      }

      // Successful login -> Navigate to callbackUrl
      router.push(callbackUrl);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('analyst@bugpulse.ai');
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-md items-center justify-center px-4 py-12">
      <Card className="w-full border-neutral-800 bg-[#141416] shadow-sm">
        <CardHeader className="space-y-1.5 pb-5 text-center">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 bg-[#1a1a1d] text-neutral-200">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <CardTitle className="text-lg font-semibold tracking-tight text-neutral-100">
            Sign in
          </CardTitle>
          <CardDescription className="text-xs text-neutral-400">
            Authenticate to access repository audit reports and automated patches
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-neutral-300 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-neutral-500" />
                <span>Email address</span>
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@bugpulse.ai"
                className="font-mono bg-[#0c0c0d] border-neutral-800 text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-neutral-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-neutral-500" />
                <span>Password</span>
              </label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="font-mono bg-[#0c0c0d] border-neutral-800 text-xs h-9"
              />
            </div>

            {/* Quick Demo Credentials Button */}
            <div className="rounded border border-neutral-800 bg-[#0c0c0d] p-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-neutral-400">Demo account:</span>
                <button
                  type="button"
                  onClick={fillDemoCredentials}
                  className="text-neutral-200 hover:text-white underline cursor-pointer font-medium"
                >
                  Auto-fill credentials
                </button>
              </div>
              <p className="text-[10px] text-neutral-500 font-mono">
                analyst@bugpulse.ai &bull; password123
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3 pt-2">
            <Button
              type="submit"
              disabled={loading}
              variant="default"
              className="w-full text-xs font-medium h-9 bg-neutral-100 text-neutral-900 hover:bg-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-neutral-500">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-neutral-300 hover:text-white underline">
                Register
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
