'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  GitBranch,
  Cpu,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  KeyRound,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const POPULAR_REPOS = [
  { label: 'psf/requests', url: 'https://github.com/psf/requests', lang: 'Python' },
  { label: 'pallets/flask', url: 'https://github.com/pallets/flask', lang: 'Python' },
  { label: 'expressjs/express', url: 'https://github.com/expressjs/express', lang: 'JavaScript' },
  { label: 'gin-gonic/gin', url: 'https://github.com/gin-gonic/gin', lang: 'Go' },
  { label: 'facebook/react', url: 'https://github.com/facebook/react', lang: 'TypeScript' },
];

const AVAILABLE_MODELS = [
  { id: 'AutoSelectBest', name: 'AutoSelect (Best benchmark)' },
  { id: 'RandomForest', name: 'Random forest classifier' },
  { id: 'XGBoost', name: 'XGBoost gradient trees' },
  { id: 'LightGBM', name: 'LightGBM classifier' },
  { id: 'GradientBoosting', name: 'Gradient boosting' },
  { id: 'ExtraTrees', name: 'Extra trees ensemble' },
  { id: 'AdaBoost', name: 'AdaBoost classifier' },
  { id: 'LogisticRegression', name: 'Logistic regression' },
  { id: 'SVM', name: 'Support vector machine (RBF)' },
  { id: 'KNN', name: 'K-nearest neighbors' },
  { id: 'NaiveBayes', name: 'Gaussian Naive Bayes' },
  { id: 'NeuralNetwork_MLP', name: 'Multi-layer perceptron neural net (MLP)' },
  { id: 'VotingEnsemble', name: 'Soft voting ensemble' },
  { id: 'StackingEnsemble', name: 'Stacking ensemble' },
];

export interface FormErrorState {
  code?: string;
  message: string;
  guidance?: string;
  actionText?: string;
  action?: () => void;
}

/**
 * Pure helper function constructing structured error states and recovery guidance
 * across all HTTP error statuses, GitHub API exceptions, and field validation failures.
 */
export function buildFormError(status: number, data: any): FormErrorState {
  const errorData = data?.error;
  const errorCode = typeof errorData === 'object' && errorData !== null ? errorData.code : undefined;
  const errorMsg =
    (typeof errorData === 'string' ? errorData : errorData?.message) ||
    (typeof data?.message === 'string' ? data.message : undefined) ||
    (typeof data === 'string' && data.trim().length > 0 ? data.trim() : `Request failed with status ${status}`);

  let guidance = '';
  let actionText: string | undefined;

  const isRateLimit =
    errorCode === 'RATE_LIMIT_EXCEEDED' ||
    status === 429 ||
    errorMsg.toLowerCase().includes('rate limit') ||
    errorMsg.toLowerCase().includes('too many requests');

  const isForbidden =
    errorCode === 'FORBIDDEN' ||
    (!isRateLimit &&
      (status === 403 ||
        errorMsg.toLowerCase().includes('forbidden') ||
        errorMsg.toLowerCase().includes('saml')));

  if (isRateLimit) {
    guidance =
      'GitHub API rate limit was exceeded. Expand Advanced Settings below to add a GitHub Personal Access Token (PAT) for 5,000 requests/hour or wait before retrying.';
    actionText = 'Configure GitHub Token';
  } else if (isForbidden) {
    guidance =
      'Access to this repository was forbidden (HTTP 403). If this repository belongs to an organization with SAML SSO, please authorize your Personal Access Token for that organization, or ensure your token has adequate repository permissions.';
    actionText = 'Configure GitHub Token';
  } else if (status === 404 || errorCode === 'NOT_FOUND') {
    guidance =
      'Verify that the repository exists and that the owner/name spelling is correct. If this is a private repository, provide a GitHub Personal Access Token with repository read permissions in Advanced Settings.';
    actionText = 'Add Access Token for Private Repo';
  } else if (status === 401 || errorCode === 'UNAUTHORIZED') {
    guidance =
      'The provided GitHub Personal Access Token was rejected by GitHub. Check that the token is valid, active, and has appropriate repo scope.';
    actionText = 'Update Token';
  } else if (
    status === 503 ||
    errorCode === 'SERVICE_UNAVAILABLE' ||
    errorCode === 'NETWORK_ERROR' ||
    errorMsg.toLowerCase().includes('network') ||
    errorMsg.toLowerCase().includes('fetch failed')
  ) {
    guidance =
      'Could not establish a connection to GitHub API. Please check your network connection, inspect githubstatus.com, and retry your submission.';
    actionText = 'Retry Analysis';
  } else if (status === 422 || errorCode === 'VALIDATION_ERROR') {
    const fieldErrors = errorData?.details;
    if (fieldErrors?.githubToken) {
      guidance = `Invalid GitHub Personal Access Token: ${fieldErrors.githubToken.join(', ')}`;
      actionText = 'Fix GitHub Token';
    } else if (fieldErrors?.branch) {
      guidance = `Invalid branch name: ${fieldErrors.branch.join(', ')}`;
      actionText = 'Fix Branch';
    } else if (fieldErrors?.selectedModel) {
      guidance = `Invalid ML model selection: ${fieldErrors.selectedModel.join(', ')}`;
      actionText = 'Choose Model';
    } else if (fieldErrors?.repoUrl) {
      guidance = fieldErrors.repoUrl.join(', ');
    } else {
      guidance =
        'Please verify that the repository URL is in a valid format (e.g. psf/requests, https://github.com/psf/requests, or git@github.com:psf/requests.git).';
    }
  } else {
    guidance =
      'An unexpected error occurred while analyzing the repository. Please verify repository availability and try again.';
    actionText = 'Retry Analysis';
  }

  let derivedCode = errorCode;
  if (!derivedCode) {
    if (isRateLimit) derivedCode = 'RATE_LIMIT_EXCEEDED';
    else if (isForbidden) derivedCode = 'FORBIDDEN';
    else if (status === 404) derivedCode = 'NOT_FOUND';
    else if (status === 401) derivedCode = 'UNAUTHORIZED';
    else if (status === 503) derivedCode = 'SERVICE_UNAVAILABLE';
    else if (status === 422) derivedCode = 'VALIDATION_ERROR';
    else derivedCode = `HTTP_${status}`;
  }

  return {
    code: derivedCode,
    message: errorMsg,
    guidance,
    actionText,
  };
}

export interface RepoInputFormProps {
  initialError?: FormErrorState;
}

export const RepoInputForm: React.FC<RepoInputFormProps> = ({ initialError }) => {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [selectedModel, setSelectedModel] = useState('AutoSelectBest');
  const [githubToken, setGithubToken] = useState('');
  const [nvidiaApiKey, setNvidiaApiKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<FormErrorState | null>(initialError || null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [shouldFocusToken, setShouldFocusToken] = useState(false);
  const [shouldFocusBranch, setShouldFocusBranch] = useState(false);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const branchInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const consecutivePollErrors = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (shouldFocusToken && showAdvanced) {
      if (tokenInputRef.current) {
        tokenInputRef.current.focus();
        setShouldFocusToken(false);
      } else {
        const timer = setTimeout(() => {
          tokenInputRef.current?.focus() || document.getElementById('githubToken')?.focus();
          setShouldFocusToken(false);
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [shouldFocusToken, showAdvanced]);

  useEffect(() => {
    if (shouldFocusBranch && showAdvanced) {
      if (branchInputRef.current) {
        branchInputRef.current.focus();
        setShouldFocusBranch(false);
      } else {
        const timer = setTimeout(() => {
          branchInputRef.current?.focus() || document.getElementById('branchInput')?.focus();
          setShouldFocusBranch(false);
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [shouldFocusBranch, showAdvanced]);

  useEffect(() => {
    // 1. Check local cache for fast synchronous response
    try {
      const cached = localStorage.getItem('auth_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.email || parsed.username)) {
          setIsAuthenticated(true);
        }
      }
    } catch {
      // LocalStorage access error
    }

    // 2. Validate against server session
    fetch('/api/auth/me')
      .then((res) => {
        setIsAuthenticated(res.ok);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });

    // 3. Listen to auth changes
    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<unknown>;
      setIsAuthenticated(Boolean(customEvent.detail));
    };

    window.addEventListener('auth-state-change', handleAuthChange);
    return () => window.removeEventListener('auth-state-change', handleAuthChange);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    consecutivePollErrors.current = 0;

    // Strict gate: user must be signed in before analyzing repositories
    if (isAuthenticated === false) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/')}`);
      return;
    }

    if (!repoUrl.trim()) {
      setError({
        code: 'VALIDATION_ERROR',
        message: 'Repository URL is required',
        guidance: 'Enter a GitHub repository URL (e.g. psf/requests or https://github.com/facebook/react).',
      });
      return;
    }

    setLoading(true);
    setCurrentStep('QUEUED');
    setProgressPercent(10);
    setStatusMessage('Queueing repository for analysis...');

    try {
      const res = await fetch('/api/repos/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          branch: branch.trim() || undefined,
          selectedModel,
          githubToken: githubToken.trim() || undefined,
          nvidiaApiKey: nvidiaApiKey.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        const errorMsg = data?.error?.message || '';
        const isGitHubTokenError =
          errorMsg.toLowerCase().includes('github') ||
          errorMsg.toLowerCase().includes('bad credentials');

        // Only redirect to login if the app user session itself is unauthenticated/expired
        if (!isGitHubTokenError) {
          setLoading(false);
          router.push(`/login?callbackUrl=${encodeURIComponent('/')}`);
          return;
        }
      }

      if (!res.ok) {
        const baseError = buildFormError(res.status, data);
        let action: (() => void) | undefined;

        if (
          baseError.actionText === 'Configure GitHub Token' ||
          baseError.actionText === 'Add Access Token for Private Repo' ||
          baseError.actionText === 'Update Token' ||
          baseError.actionText === 'Fix GitHub Token'
        ) {
          action = () => {
            setShowAdvanced(true);
            setShouldFocusToken(true);
          };
        } else if (baseError.actionText === 'Fix Branch') {
          action = () => {
            setShowAdvanced(true);
            setShouldFocusBranch(true);
          };
        } else if (baseError.actionText === 'Choose Model') {
          action = () => {
            setShowAdvanced(true);
            setSelectedModel('AutoSelectBest');
            document.getElementById('modelSelect')?.focus();
          };
        } else if (baseError.actionText === 'Retry Analysis') {
          action = () => {
            const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
            handleSubmit(fakeEvent);
          };
        }

        setError({
          ...baseError,
          action,
        });
        setLoading(false);
        setCurrentStep(null);
        return;
      }

      const analysisId = data.analysisId;

      // Start live polling of analysis status
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/repos/analysis/${analysisId}`);
          if (statusRes.status === 401) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setLoading(false);
            router.push(`/login?callbackUrl=${encodeURIComponent(`/reports/${analysisId}`)}`);
            return;
          }

          if (statusRes.status === 404) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setLoading(false);
            setCurrentStep(null);
            setError({
              code: 'NOT_FOUND',
              message: 'Analysis job not found or has expired.',
              guidance:
                'The requested analysis session was not found on the server. Please verify repository details and start a new analysis.',
              actionText: 'Retry Analysis',
              action: () => {
                const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                handleSubmit(fakeEvent);
              },
            });
            return;
          }

          if (!statusRes.ok) {
            consecutivePollErrors.current += 1;
            if (consecutivePollErrors.current >= 6) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              setLoading(false);
              setCurrentStep(null);
              setError({
                code: `HTTP_${statusRes.status}`,
                message: `Unable to retrieve analysis status (${statusRes.status}).`,
                guidance:
                  'Communication with the analysis server was lost. Please verify your connection and retry.',
                actionText: 'Retry Analysis',
                action: () => {
                  const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                  handleSubmit(fakeEvent);
                },
              });
            }
            return;
          }

          consecutivePollErrors.current = 0;
          const statusData = await statusRes.json();
          setCurrentStep(statusData.status);
          setProgressPercent(statusData.progressPercent || 50);
          setStatusMessage(statusData.statusMessage || 'Processing analysis...');

          if (statusData.status === 'COMPLETED') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setProgressPercent(100);
            setStatusMessage('Analysis complete. Opening report...');
            setTimeout(() => {
              router.push(`/reports/${analysisId}`);
            }, 500);
          } else if (statusData.status === 'FAILED') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setLoading(false);
            const errorMsg = statusData.errorMessage || 'Analysis failed to complete';
            const isRateLimit =
              errorMsg.toLowerCase().includes('rate limit') ||
              errorMsg.toLowerCase().includes('too many requests');
            const isForbidden =
              errorMsg.toLowerCase().includes('forbidden') ||
              errorMsg.toLowerCase().includes('saml');
            const isAuth =
              errorMsg.toLowerCase().includes('unauthorized') ||
              errorMsg.toLowerCase().includes('bad credentials') ||
              errorMsg.toLowerCase().includes('token') ||
              errorMsg.toLowerCase().includes('authentication failed');
            const isNetwork =
              errorMsg.toLowerCase().includes('network') ||
              errorMsg.toLowerCase().includes('fetch failed');
            const isNoSourceFiles =
              errorMsg.toLowerCase().includes('no supported source code files');

            let guidance =
              'The analysis pipeline stopped while processing files. Check if the repository contains supported source code languages (Python, TypeScript, JavaScript, Go, Rust, Java, C/C++).';
            let actionText: string | undefined;
            let action: (() => void) | undefined;

            if (isRateLimit) {
              guidance =
                'GitHub API rate limit was exceeded during repository ingestion. Expand Advanced Settings below to add a GitHub Personal Access Token (PAT) for 5,000 requests/hour.';
              actionText = 'Configure GitHub Token';
              action = () => {
                setShowAdvanced(true);
                setShouldFocusToken(true);
              };
            } else if (isAuth) {
              guidance =
                'GitHub authentication failed during background ingestion. The GitHub Personal Access Token is invalid or expired. Expand Advanced Settings below to update your token.';
              actionText = 'Update Token';
              action = () => {
                setShowAdvanced(true);
                setShouldFocusToken(true);
              };
            } else if (isForbidden) {
              guidance =
                'Access to repository resources was forbidden during ingestion. Provide an authorized GitHub Personal Access Token in Advanced Settings.';
              actionText = 'Configure GitHub Token';
              action = () => {
                setShowAdvanced(true);
                setShouldFocusToken(true);
              };
            } else if (isNetwork) {
              guidance =
                'A network failure occurred during ingestion. Please check your internet connection and retry.';
              actionText = 'Retry Analysis';
              action = () => {
                const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                handleSubmit(fakeEvent);
              };
            } else if (isNoSourceFiles) {
              guidance =
                'This repository contains no supported source code files. Supported languages: Python, TypeScript, JavaScript, Go, Rust, Java, C/C++, C#, PHP, Ruby, Kotlin, Swift, Scala.';
            }

            setError({
              code: 'PIPELINE_FAILED',
              message: errorMsg,
              guidance,
              actionText,
              action,
            });
            setCurrentStep(null);
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isNetwork =
        msg.toLowerCase().includes('fetch failed') ||
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('offline');

      setError({
        code: isNetwork ? 'NETWORK_ERROR' : 'CLIENT_ERROR',
        message: msg || 'An unexpected client error occurred',
        guidance: isNetwork
          ? 'Network request failed. Please check your internet connection and try submitting again.'
          : 'Please check your inputs and try again.',
        actionText: isNetwork ? 'Retry Analysis' : undefined,
        action: isNetwork
          ? () => {
              const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
              handleSubmit(fakeEvent);
            }
          : undefined,
      });
      setCurrentStep(null);
      setLoading(false);
    }
  };

  return (
    <Card className="w-full border-neutral-800 bg-[#141416] p-6 sm:p-7 shadow-sm">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-neutral-100">
          Analyze repository
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Compute module complexity, mine churn history, and locate defect lines with verified fixes
        </p>
      </div>

      {/* Unauthenticated User Warning / Guidance */}
      {isAuthenticated === false && (
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-neutral-800 bg-[#0c0c0d] p-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-300">
            <Lock className="h-4 w-4 text-neutral-400 shrink-0" />
            <span>Sign in required to run defect scans and view reports</span>
          </div>
          <Link href="/login?callbackUrl=/">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs border-neutral-800 bg-[#141416] text-neutral-200 hover:text-white"
            >
              <span>Sign in</span>
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-md border border-red-500/25 bg-red-950/20 p-4 text-xs text-red-200 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-100">Analysis error</span>
                {error.code && (
                  <span className="rounded bg-red-900/50 border border-red-700/50 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
                    {error.code}
                  </span>
                )}
              </div>
              <p className="text-neutral-200 leading-normal">{error.message}</p>
              {error.guidance && (
                <div className="pt-1.5 border-t border-red-500/15">
                  <span className="text-neutral-400 font-medium font-mono text-[11px]">Recovery guidance: </span>
                  <span className="text-neutral-300 text-[11px] leading-relaxed">{error.guidance}</span>
                </div>
              )}
            </div>
          </div>
          {error.actionText && error.action && (
            <div className="pt-1 pl-6.5">
              <button
                type="button"
                onClick={error.action}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded px-3 py-1.5 transition-colors cursor-pointer"
              >
                <span>{error.actionText}</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center space-y-5">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-neutral-800 bg-[#1a1a1d] text-neutral-200">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>

          <div>
            <h3 className="text-sm font-medium text-neutral-100">Analyzing repository</h3>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              {statusMessage || 'Extracting metrics and calculating defect probabilities...'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mx-auto max-w-md w-full space-y-1.5">
            <div className="flex justify-between text-xs text-neutral-400 font-mono tabular-nums">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-neutral-200 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Progress Steps */}
          <div className="mx-auto max-w-md space-y-2 text-left text-xs font-mono">
            <div className="flex items-center gap-2.5">
              {currentStep === 'FETCHING' || currentStep === 'QUEUED' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-200" />
              ) : currentStep === 'EXTRACTING_METRICS' || currentStep === 'PREDICTING' || currentStep === 'COMPLETED' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-neutral-700" />
              )}
              <span className={currentStep === 'FETCHING' || currentStep === 'QUEUED' ? 'text-neutral-100 font-medium' : 'text-neutral-400'}>
                1. Fetching repository files and commit history
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {currentStep === 'EXTRACTING_METRICS' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-200" />
              ) : currentStep === 'PREDICTING' || currentStep === 'COMPLETED' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-neutral-700" />
              )}
              <span className={currentStep === 'EXTRACTING_METRICS' ? 'text-neutral-100 font-medium' : 'text-neutral-400'}>
                2. Calculating complexity and churn metrics
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {currentStep === 'PREDICTING' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-200" />
              ) : currentStep === 'COMPLETED' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-neutral-700" />
              )}
              <span className={currentStep === 'PREDICTING' ? 'text-neutral-100 font-medium' : 'text-neutral-400'}>
                3. Running ML defect model ({selectedModel})
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {currentStep === 'COMPLETED' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-neutral-700" />
              )}
              <span className={currentStep === 'COMPLETED' ? 'text-emerald-400 font-medium' : 'text-neutral-500'}>
                4. Compiling report and verified remediations
              </span>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Repository URL Input */}
          <div>
            <label htmlFor="repoUrl" className="block text-xs font-mono text-neutral-300 mb-1.5">
              Repository URL or owner/repo shorthand
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                <Search className="h-4 w-4" />
              </div>
              <Input
                id="repoUrl"
                type="text"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. psf/requests or facebook/react"
                className="pl-9 h-10 text-sm font-mono bg-[#0c0c0d] border-neutral-800 text-neutral-100 placeholder:text-neutral-600 focus-visible:ring-1 focus-visible:ring-neutral-400"
                required
              />
            </div>

            {/* Quick-fill sample pills */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-neutral-500 font-mono">Sample:</span>
              {POPULAR_REPOS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => {
                    setRepoUrl(sample.url);
                    if (error) setError(null);
                  }}
                  className="rounded border border-neutral-800 bg-[#1a1a1d] px-2 py-0.5 text-xs text-neutral-300 hover:border-neutral-700 hover:text-neutral-100 transition-colors flex items-center gap-1.5 font-mono cursor-pointer"
                >
                  <span>{sample.label}</span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {sample.lang}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Action Button: Strict Auth Awareness */}
          {isAuthenticated === false ? (
            <Button
              type="button"
              onClick={() => router.push(`/login?callbackUrl=${encodeURIComponent('/')}`)}
              variant="default"
              size="lg"
              className="w-full text-xs sm:text-sm font-medium h-10 gap-2 bg-neutral-100 text-neutral-900 hover:bg-white cursor-pointer"
            >
              <Lock className="h-4 w-4" />
              <span>Sign in to analyze repository</span>
            </Button>
          ) : (
            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full text-xs sm:text-sm font-medium h-10 gap-2 bg-neutral-100 text-neutral-900 hover:bg-white cursor-pointer"
            >
              <span>Analyze repository</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {/* Plain factual subtext */}
          <p className="text-center text-[11px] text-neutral-500 font-mono">
            Static AST inspection &bull; Commit churn classification &bull; Unified git patches
          </p>

          {/* Advanced Settings Accordion */}
          <div className="pt-2 border-t border-neutral-800/80">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span>Advanced settings (branch, model override, tokens)</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 rounded-lg border border-neutral-800 bg-[#0c0c0d] p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Model Override Selector */}
                  <div>
                    <label htmlFor="modelSelect" className="block text-xs font-mono text-neutral-300 mb-1 flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-neutral-400" />
                      Model selection
                    </label>
                    <select
                      id="modelSelect"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full rounded-md border border-neutral-800 bg-[#141416] px-3 py-1.5 text-xs text-neutral-200 focus:border-neutral-600 focus:outline-none cursor-pointer font-mono"
                    >
                      {AVAILABLE_MODELS.map((model) => (
                        <option key={model.id} value={model.id} className="bg-[#141416] text-neutral-200">
                          {model.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-neutral-500 mt-1 font-mono">
                      AutoSelect evaluates candidates and selects the highest-scoring model.
                    </p>
                  </div>

                  {/* Branch Selector */}
                  <div>
                    <label htmlFor="branchInput" className="block text-xs font-mono text-neutral-300 mb-1 flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-neutral-400" />
                      Branch or tag
                    </label>
                    <Input
                      ref={branchInputRef}
                      id="branchInput"
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="e.g. main or master (defaults to repository default)"
                      className="font-mono bg-[#141416] border-neutral-800 text-xs"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1 font-mono">
                      Target repository branch to scan. Defaults to repository default branch.
                    </p>
                  </div>
                </div>

                {/* API Keys */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-neutral-800/80">
                  <div>
                    <label htmlFor="githubToken" className="block text-xs font-mono text-neutral-300 mb-1 flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-neutral-400" />
                      GitHub access token (optional)
                    </label>
                    <Input
                      ref={tokenInputRef}
                      id="githubToken"
                      type="password"
                      value={githubToken}
                      onChange={(e) => {
                        setGithubToken(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="font-mono bg-[#141416] border-neutral-800 text-xs"
                    />
                  </div>

                  <div>
                    <label htmlFor="nvidiaApiKey" className="block text-xs font-mono text-neutral-300 mb-1 flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-neutral-400" />
                      NVIDIA NIM API key (optional)
                    </label>
                    <Input
                      id="nvidiaApiKey"
                      type="password"
                      value={nvidiaApiKey}
                      onChange={(e) => setNvidiaApiKey(e.target.value)}
                      placeholder="nvapi-xxxxxxxxxxxxxxxx"
                      className="font-mono bg-[#141416] border-neutral-800 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}
