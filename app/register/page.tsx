'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, User, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        let msg = data.error?.message;
        if (data.error?.details && typeof data.error.details === 'object') {
          const detailStrings = Object.values(data.error.details).flat().filter(Boolean);
          if (detailStrings.length > 0) {
            msg = detailStrings.join('. ');
          }
        }
        throw new Error(msg || 'Registration failed');
      }

      // Automatically sign in after registration
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }

      const loginData = await loginRes.json();
      if (loginData.user) {
        try {
          localStorage.setItem('auth_user', JSON.stringify(loginData.user));
          window.dispatchEvent(new CustomEvent('auth-state-change', { detail: loginData.user }));
        } catch {
          // LocalStorage fallback
        }
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-md items-center justify-center px-4 py-12">
      <Card className="w-full border-neutral-800 bg-[#141416] shadow-sm">
        <CardHeader className="space-y-1.5 pb-5 text-center">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 bg-[#1a1a1d] text-neutral-200">
            <UserPlus className="h-4 w-4" />
          </div>
          <CardTitle className="text-lg font-semibold tracking-tight text-neutral-100">
            Register
          </CardTitle>
          <CardDescription className="text-xs text-neutral-400">
            Create an account to run repository audits and generate verified patches
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
                <User className="h-3.5 w-3.5 text-neutral-500" />
                <span>Username</span>
              </label>
              <Input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="analyst"
                className="font-mono bg-[#0c0c0d] border-neutral-800 text-xs h-9"
              />
            </div>

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
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-neutral-300 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Password</span>
                </label>
                <span className="text-[10px] text-neutral-500 font-mono">min. 6 chars</span>
              </div>
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="font-mono bg-[#0c0c0d] border-neutral-800 text-xs h-9"
              />
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
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create account</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-neutral-500">
              Already have an account?{' '}
              <Link href="/login" className="text-neutral-300 hover:text-white underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
