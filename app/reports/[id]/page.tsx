'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Printer,
  Github,
  GitBranch,
  Cpu,
  Calendar,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Bug,
  AlertTriangle,
  FileCode,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  FileText,
  SlidersHorizontal,
  GitMerge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ModuleRiskTable } from '@/components/ModuleRiskTable';
import { CICDIntegrationCard } from '@/components/CICDIntegrationCard';
import { ApplyFixesModal } from '@/components/ApplyFixesModal';
import { FormalAuditReport } from '@/components/FormalAuditReport';
import type { CodeDefectItem } from '@shared/types/contracts';

interface AnalysisData {
  analysisId: string;
  status: string;
  progressPercent?: number;
  statusMessage?: string;
  modelType: string;
  repo: {
    id: string;
    owner: string;
    name: string;
    url: string;
    defaultBranch: string;
  };
  summary: {
    totalFiles: number;
    analyzedFiles: number;
    defectProneFiles: number;
    averageComplexity: number;
    totalChurnLines: number;
    lowRiskCount: number;
    mediumRiskCount: number;
    highRiskCount: number;
    criticalRiskCount: number;
  };
  topVulnerableFiles: Array<{
    filePath: string;
    defectProbability: number;
    riskLevel: string;
    cyclomaticComplexity: number;
    commitCount: number;
    churnLines: number;
    bugFixCount: number;
    loc: number;
    sloc: number;
    language: string;
    rank: number;
    defects?: CodeDefectItem[];
  }>;
  createdAt: string;
  completedAt: string | null;
  errorMessage?: string;
}

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCicd, setShowCicd] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [viewMode, setViewMode] = useState<'interactive' | 'report'>('interactive');

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const fetchAnalysis = async () => {
      try {
        const res = await fetch(`/api/repos/analysis/${id}`);
        if (res.status === 401) {
          router.push(`/login?callbackUrl=${encodeURIComponent(`/reports/${id}`)}`);
          return;
        }

        if (!res.ok) {
          throw new Error('Analysis report not found or could not be loaded');
        }

        const reportData = await res.json();
        setData(reportData);

        // If still processing, poll every 2 seconds
        if (reportData.status !== 'COMPLETED' && reportData.status !== 'FAILED') {
          timer = setTimeout(fetchAnalysis, 2000);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [id, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center space-y-4">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-neutral-800 bg-[#141416] text-neutral-300">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-neutral-200">Loading defect report</h2>
          <p className="text-xs text-neutral-500 font-mono">
            Fetching AST calibrations and verified remediations...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center space-y-4">
          <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-neutral-100">Unable to load report</h2>
            <p className="text-xs text-neutral-300 font-mono">{error || 'Report not found'}</p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to analyzer</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // If analysis is still in progress, show live progress card
  if (data.status !== 'COMPLETED' && data.status !== 'FAILED') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-5">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-neutral-800 bg-[#141416] text-neutral-300">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Inspecting repository for defects</h2>
          <p className="text-xs text-neutral-400 mt-1 font-mono">
            {data.statusMessage || 'Pinpointing line numbers and compiling fixes...'}
          </p>
        </div>

        <div className="mx-auto max-w-md w-full space-y-2">
          <div className="flex justify-between text-xs text-neutral-400 font-mono tabular-nums">
            <span>Stage: {data.status}</span>
            <span>{data.progressPercent || 50}%</span>
          </div>
          <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
            <div
              className="h-full bg-neutral-200 transition-all duration-300"
              style={{ width: `${data.progressPercent || 50}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Calculate total concrete defects count across all files
  const totalDefectsCount = data.topVulnerableFiles.reduce(
    (acc, f) => acc + (f.defects?.length || 0),
    0
  );

  const urgentDefectsCount = data.topVulnerableFiles.reduce(
    (acc, f) =>
      acc + (f.defects?.filter((d) => d.severity === 'CRITICAL' || d.severity === 'HIGH').length || 0),
    0
  );

  const filesWithDefectsCount = data.topVulnerableFiles.filter(
    (f) => f.defects && f.defects.length > 0
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Toolbar (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
          <Link href="/" className="hover:text-neutral-100 transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Analyzer</span>
          </Link>
          <span>/</span>
          <span className="text-neutral-200 font-medium">
            {data.repo.owner}/{data.repo.name}
          </span>
          <Badge variant="outline" className="font-mono text-[10px] text-neutral-400">
            Report
          </Badge>
        </div>

        {/* View Switcher & Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher: Interactive vs Formal Report */}
          <div className="flex items-center rounded-md border border-neutral-800 bg-[#141416] p-0.5 text-xs font-mono">
            <button
              onClick={() => setViewMode('interactive')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                viewMode === 'interactive'
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Interactive feed</span>
            </button>
            <button
              onClick={() => setViewMode('report')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                viewMode === 'report'
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileText className="h-3 w-3" />
              <span>Formal audit report</span>
            </button>
          </div>

          <Button
            onClick={() => setShowApplyModal(true)}
            variant="default"
            size="sm"
            className="gap-1.5 h-8 text-xs font-medium bg-neutral-100 text-neutral-900 hover:bg-white"
          >
            <GitMerge className="h-3.5 w-3.5" />
            <span>Apply all fixes</span>
          </Button>

          <a
            href={`/api/reports/${data.analysisId}/download?format=patch`}
            target="_blank"
            rel="noreferrer"
            download
          >
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-neutral-800 bg-[#141416] text-neutral-300 hover:text-white hover:bg-neutral-800">
              <Download className="h-3.5 w-3.5 text-neutral-400" />
              <span>.patch</span>
            </Button>
          </a>

          <a
            href={`/api/reports/${data.analysisId}/download?format=json`}
            target="_blank"
            rel="noreferrer"
            download
          >
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-neutral-800 bg-[#141416] text-neutral-300 hover:text-white hover:bg-neutral-800">
              <Download className="h-3.5 w-3.5 text-neutral-400" />
              <span>JSON</span>
            </Button>
          </a>

          <a
            href={`/api/reports/${data.analysisId}/download?format=csv`}
            target="_blank"
            rel="noreferrer"
            download
          >
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-neutral-800 bg-[#141416] text-neutral-300 hover:text-white hover:bg-neutral-800">
              <FileSpreadsheet className="h-3.5 w-3.5 text-neutral-400" />
              <span>CSV</span>
            </Button>
          </a>

          {/* Print PDF: Always prints the Formal Audit Report cleanly */}
          <Button
            onClick={() => window.print()}
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs border-neutral-800 bg-[#141416] text-neutral-300 hover:text-white hover:bg-neutral-800"
            title="Print formal executive report to PDF"
          >
            <Printer className="h-3.5 w-3.5 text-neutral-400" />
            <span>Print PDF</span>
          </Button>
        </div>
      </div>

      {/* VIEW MODE 1: INTERACTIVE DEVELOPER FEED (HIDDEN IN PRINT) */}
      {viewMode === 'interactive' && (
        <div className="space-y-6 print:hidden">
          {/* Header Info Banner */}
          <Card className="border-neutral-800 bg-[#141416] p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-100 font-mono">
                    {data.repo.owner}/<span>{data.repo.name}</span>
                  </h1>
                  <a
                    href={data.repo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-400 hover:text-neutral-100 transition-colors"
                    title="View GitHub repository"
                  >
                    <Github className="h-4 w-4" />
                  </a>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Exact code bugs, verified line numbers, root cause diagnostics, and copyable remediation fixes
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px] py-0.5 px-2.5 text-neutral-400">
                  <GitBranch className="h-3 w-3 text-neutral-400 mr-1" />
                  <span>Branch: {data.repo.defaultBranch}</span>
                </Badge>

                <Badge variant="outline" className="font-mono text-[11px] py-0.5 px-2.5 text-neutral-400">
                  <Cpu className="h-3 w-3 text-neutral-400 mr-1" />
                  <span>Engine: {data.modelType}</span>
                </Badge>

                <Badge variant="outline" className="font-mono text-[11px] py-0.5 px-2.5 text-neutral-400">
                  <Calendar className="h-3 w-3 text-neutral-400 mr-1" />
                  <span>{new Date(data.createdAt).toLocaleDateString()}</span>
                </Badge>
              </div>
            </div>
          </Card>

          {/* 4 Quiet Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Bugs */}
            <Card className="border-neutral-800 bg-[#141416] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">Flagged bugs</span>
                <div className="rounded border border-red-500/20 bg-red-500/10 p-1 text-red-400">
                  <Bug className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-neutral-100 font-mono tabular-nums">{totalDefectsCount}</span>
                <span className="text-xs text-red-400 font-medium">Bugs detected</span>
              </div>
            </Card>

            {/* Critical & High */}
            <Card className="border-neutral-800 bg-[#141416] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">Critical & high</span>
                <div className="rounded border border-amber-500/20 bg-amber-500/10 p-1 text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-neutral-100 font-mono tabular-nums">{urgentDefectsCount}</span>
                <span className="text-xs text-amber-400 font-medium">Urgent</span>
              </div>
            </Card>

            {/* Affected Files */}
            <Card className="border-neutral-800 bg-[#141416] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">Affected files</span>
                <div className="rounded border border-neutral-800 bg-[#1a1a1d] p-1 text-neutral-300">
                  <FileCode className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-neutral-100 font-mono tabular-nums">{filesWithDefectsCount}</span>
                <span className="text-xs text-neutral-500 font-mono">of {data.topVulnerableFiles.length} scanned</span>
              </div>
            </Card>

            {/* Fix Readiness */}
            <Card className="border-neutral-800 bg-[#141416] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">Remediation ready</span>
                <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-1 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-neutral-100 font-mono tabular-nums">100%</span>
                <span className="text-xs text-emerald-400 font-medium">Patches ready</span>
              </div>
            </Card>
          </div>

          {/* Actionable Bug & Remediation Feed */}
          <ModuleRiskTable
            files={data.topVulnerableFiles}
            repoUrl={data.repo.url}
            defaultBranch={data.repo.defaultBranch}
            onApplyAllFixes={() => setShowApplyModal(true)}
          />

          {/* CI/CD Integration Section */}
          <div className="pt-2 border-t border-neutral-800/80">
            <button
              onClick={() => setShowCicd(!showCicd)}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-neutral-800 bg-[#141416] hover:bg-[#1a1a1d] text-neutral-400 hover:text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-neutral-400" />
                <span>Automate defect gatekeeping in CI/CD (GitHub Actions workflow)</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showCicd ? 'rotate-180 text-neutral-100' : ''}`}
              />
            </button>

            {showCicd && (
              <div className="mt-4">
                <CICDIntegrationCard repoUrl={data.repo.url} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: FORMAL DEFECT AUDIT REPORT (DISPLAYED IN REPORT MODE & PRINT) */}
      <div className={viewMode === 'report' ? 'block' : 'hidden print:block'}>
        <FormalAuditReport
          repoOwner={data.repo.owner}
          repoName={data.repo.name}
          repoUrl={data.repo.url}
          defaultBranch={data.repo.defaultBranch}
          createdAt={data.createdAt}
          modelType={data.modelType}
          analysisId={data.analysisId}
          summary={data.summary}
          files={data.topVulnerableFiles}
        />
      </div>

      {/* Interactive Apply All Fixes Modal */}
      <ApplyFixesModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        analysisId={data.analysisId}
        repoOwner={data.repo.owner}
        repoName={data.repo.name}
        defaultBranch={data.repo.defaultBranch}
      />
    </div>
  );
}
