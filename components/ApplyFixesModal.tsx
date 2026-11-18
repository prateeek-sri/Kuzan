'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Terminal,
  Download,
  Copy,
  Check,
  GitPullRequest,
  FileCode,
  Loader2,
  ExternalLink,
  AlertCircle,
  GitMerge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import type { RemediationPatchResponse } from '@shared/types/contracts';

interface ApplyFixesModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisId: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
}

export function ApplyFixesModal({
  isOpen,
  onClose,
  analysisId,
  repoOwner,
  repoName,
  defaultBranch,
}: ApplyFixesModalProps) {
  const [activeTab, setActiveTab] = useState<'cli' | 'diff' | 'pr'>('cli');
  const [loading, setLoading] = useState(false);
  const [remediationData, setRemediationData] = useState<RemediationPatchResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // GitHub PR Form state
  const [githubToken, setGithubToken] = useState('');
  const [prTitle, setPrTitle] = useState('fix: automated bug remediation by BugPulse AI');
  const [prLoading, setPrLoading] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);
  const [prResult, setPrResult] = useState<{ htmlUrl: string; number: number; branchName: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPatchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/repos/analysis/${analysisId}/remediate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'preview-patch' }),
        });
        if (res.ok) {
          const data = await res.json();
          setRemediationData(data);
        }
      } catch (err) {
        console.error('Failed to load remediation patch:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatchData();
  }, [isOpen, analysisId]);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubToken.trim()) {
      setPrError('A GitHub personal access token is required to create a pull request.');
      return;
    }

    setPrLoading(true);
    setPrError(null);

    try {
      const res = await fetch(`/api/repos/analysis/${analysisId}/remediate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-pr',
          githubToken: githubToken.trim(),
          prTitle: prTitle.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create pull request');
      }

      setPrResult({
        htmlUrl: data.pullRequestUrl,
        number: data.pullRequestNumber,
        branchName: data.branchName,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPrError(msg);
    } finally {
      setPrLoading(false);
    }
  };

  const patchUrl = `/api/reports/${analysisId}/download?format=patch`;
  const defaultApplyCmd = remediationData?.applyCommand || `curl -s "${window.location.origin}${patchUrl}" | git apply`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg border border-neutral-800 bg-[#141416] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#0c0c0d]">
          <div className="flex items-center gap-3">
            <div className="rounded border border-neutral-800 bg-[#1a1a1d] p-2 text-neutral-200">
              <GitMerge className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-neutral-100">
                  Apply all fixes
                </h2>
                <Badge variant="outline" className="font-mono text-[11px] text-neutral-400">
                  {remediationData ? `${remediationData.totalFixesApplied} fixes ready` : 'Compiling...'}
                </Badge>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Apply verified code remediations to your repository in one command
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Nav Tabs */}
        <div className="flex items-center gap-2 px-6 border-b border-neutral-800 bg-[#141416] text-xs font-mono">
          <button
            onClick={() => setActiveTab('cli')}
            className={`flex items-center gap-2 py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'cli'
                ? 'border-neutral-200 text-neutral-100 font-medium'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>1-click git apply</span>
          </button>

          <button
            onClick={() => setActiveTab('diff')}
            className={`flex items-center gap-2 py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'diff'
                ? 'border-neutral-200 text-neutral-100 font-medium'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Unified diff preview ({remediationData?.totalFilesModified || 0} files)</span>
          </button>

          <button
            onClick={() => setActiveTab('pr')}
            className={`flex items-center gap-2 py-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'pr'
                ? 'border-neutral-200 text-neutral-100 font-medium'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <GitPullRequest className="h-3.5 w-3.5" />
            <span>Create pull request</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center space-y-3">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
              <p className="text-xs font-mono text-neutral-400">
                Compiling unified diff patches from repository AST...
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: 1-Click Git Apply */}
              {activeTab === 'cli' && (
                <div className="space-y-6">
                  {/* Recommended Terminal Command */}
                  <div className="rounded-lg border border-neutral-800 bg-[#0c0c0d] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-neutral-300 flex items-center gap-1.5">
                        <Terminal className="h-4 w-4 text-neutral-400" />
                        Run in repository terminal:
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy('apply_cmd', defaultApplyCmd)}
                        className="gap-1.5 text-xs h-7 border-neutral-800 bg-[#141416] text-neutral-300 hover:text-white hover:bg-neutral-800"
                      >
                        {copiedKey === 'apply_cmd' ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-neutral-400" />
                            <span>Copy command</span>
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="rounded border border-neutral-800 bg-[#070708] p-3 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre">
                      {defaultApplyCmd}
                    </div>

                    <p className="text-[11px] text-neutral-400 font-mono">
                      This fetches the verified unified diff patch from this audit and applies it directly via native <code>git apply</code>.
                    </p>
                  </div>

                  {/* Alternative: Download Patch File */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-neutral-800 bg-[#141416]">
                    <div>
                      <h4 className="text-xs font-medium text-neutral-200">
                        Download patch file (.patch)
                      </h4>
                      <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                        Inspect offline or apply via <code>git apply bugpulse.patch</code>
                      </p>
                    </div>

                    <a href={patchUrl} download target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 border-neutral-800 bg-[#1a1a1d] text-neutral-300 hover:text-white hover:bg-neutral-800">
                        <Download className="h-3.5 w-3.5 text-neutral-400" />
                        <span>Download patch</span>
                      </Button>
                    </a>
                  </div>
                </div>
              )}

              {/* TAB 2: Unified Diff Preview */}
              {activeTab === 'diff' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-neutral-400">
                      Unified patch preview ({remediationData?.totalFixesApplied || 0} fixes across {remediationData?.totalFilesModified || 0} files)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy('raw_patch', remediationData?.unifiedPatch || '')}
                      className="gap-1.5 text-xs h-7 border-neutral-800 bg-[#141416] text-neutral-300 hover:text-white"
                    >
                      {copiedKey === 'raw_patch' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-neutral-400" />
                          <span>Copy diff</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <pre className="rounded-lg border border-neutral-800 bg-[#070708] p-4 text-[11px] font-mono text-neutral-300 max-h-[450px] overflow-auto whitespace-pre leading-relaxed">
                    {remediationData?.unifiedPatch || '// No unified patch content available'}
                  </pre>
                </div>
              )}

              {/* TAB 3: Create GitHub PR */}
              {activeTab === 'pr' && (
                <div className="space-y-5">
                  {prResult ? (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-5 space-y-3 text-center">
                      <Check className="mx-auto h-8 w-8 text-emerald-400" />
                      <div>
                        <h4 className="text-sm font-semibold text-neutral-100">
                          Pull request created successfully
                        </h4>
                        <p className="text-xs text-neutral-300 font-mono mt-1">
                          Branch: {prResult.branchName}
                        </p>
                      </div>

                      <a
                        href={prResult.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline font-mono"
                      >
                        <span>Open PR #{prResult.number} on GitHub</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <form onSubmit={handleCreatePR} className="space-y-4">
                      {prError && (
                        <div className="flex items-start gap-2.5 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                          <span>{prError}</span>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-mono text-neutral-300">
                          Pull request title
                        </label>
                        <Input
                          type="text"
                          value={prTitle}
                          onChange={(e) => setPrTitle(e.target.value)}
                          className="font-mono bg-[#0c0c0d] border-neutral-800 text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-mono text-neutral-300">
                          GitHub personal access token (with repository write scope)
                        </label>
                        <Input
                          type="password"
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          className="font-mono bg-[#0c0c0d] border-neutral-800 text-xs"
                          required
                        />
                        <p className="text-[11px] text-neutral-500 font-mono">
                          Creates a branch <code>bugpulse/remediation-...</code> and submits a pull request against <code>{defaultBranch}</code>.
                        </p>
                      </div>

                      <Button
                        type="submit"
                        disabled={prLoading}
                        className="w-full text-xs font-medium h-9 bg-neutral-100 text-neutral-900 hover:bg-white"
                      >
                        {prLoading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            <span>Creating pull request...</span>
                          </>
                        ) : (
                          <span>Submit pull request</span>
                        )}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
