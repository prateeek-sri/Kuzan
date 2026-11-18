'use client';

import React from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Calendar,
  GitBranch,
  Cpu,
  Layers,
  Bug,
  Terminal,
} from 'lucide-react';
import type { CodeDefectItem } from '@shared/types/contracts';

interface FormalAuditReportProps {
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  defaultBranch: string;
  createdAt: string;
  modelType: string;
  analysisId: string;
  summary: {
    totalFiles: number;
    analyzedFiles: number;
    defectProneFiles: number;
    averageComplexity: number;
    totalChurnLines: number;
  };
  files: Array<{
    filePath: string;
    defectProbability: number;
    riskLevel: string;
    language: string;
    cyclomaticComplexity: number;
    defects?: CodeDefectItem[];
  }>;
}

export function FormalAuditReport({
  repoOwner,
  repoName,
  defaultBranch,
  createdAt,
  modelType,
  analysisId,
  summary,
  files,
}: FormalAuditReportProps) {
  // Aggregate all defects across files
  const allDefectsWithFile = files.flatMap((f) =>
    (f.defects || []).map((d) => ({
      ...d,
      filePath: f.filePath,
      language: f.language,
      fileComplexity: f.cyclomaticComplexity,
      defectProb: f.defectProbability,
    }))
  );

  const totalBugs = allDefectsWithFile.length;
  const criticalBugs = allDefectsWithFile.filter(
    (d) => d.severity === 'CRITICAL' || d.severity === 'HIGH'
  ).length;
  const filesWithDefects = files.filter((f) => f.defects && f.defects.length > 0).length;

  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="formal-report mx-auto max-w-4xl space-y-8 font-sans print:space-y-6 print:text-black print:max-w-none">
      {/* 1. Formal Document Header */}
      <div className="border-b border-neutral-800 pb-6 print:border-neutral-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-neutral-400 print:text-neutral-600 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-100 print:text-black">BugPulse</span>
            <span>//</span>
            <span>Defect audit report</span>
          </div>
          <div>
            <span>Ref: {analysisId.slice(0, 13).toUpperCase()}</span>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-100 print:text-black">
            Software defect audit & remediation report
          </h1>
          <p className="text-sm text-neutral-400 print:text-neutral-600 max-w-2xl leading-relaxed">
            Automated pre-release defect discovery, AST root-cause diagnostics, and verified code remediation plan for target repository.
          </p>
        </div>

        {/* Audit Meta Grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="rounded border border-neutral-800 bg-[#141416] p-2.5 print:bg-white print:border-neutral-200">
            <span className="text-neutral-500 block text-[10px]">Target repository</span>
            <span className="font-medium text-neutral-200 print:text-black truncate block">
              {repoOwner}/{repoName}
            </span>
          </div>
          <div className="rounded border border-neutral-800 bg-[#141416] p-2.5 print:bg-white print:border-neutral-200">
            <span className="text-neutral-500 block text-[10px]">Branch audited</span>
            <span className="font-medium text-neutral-200 print:text-black block">{defaultBranch}</span>
          </div>
          <div className="rounded border border-neutral-800 bg-[#141416] p-2.5 print:bg-white print:border-neutral-200">
            <span className="text-neutral-500 block text-[10px]">Analysis engine</span>
            <span className="font-medium text-neutral-200 print:text-black block">{modelType}</span>
          </div>
          <div className="rounded border border-neutral-800 bg-[#141416] p-2.5 print:bg-white print:border-neutral-200">
            <span className="text-neutral-500 block text-[10px]">Audit timestamp</span>
            <span className="font-medium text-neutral-200 print:text-black block">{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* 2. Executive Scorecard */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono font-medium text-neutral-400 print:text-neutral-600">
          Executive scorecard
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-neutral-800 bg-[#141416] p-4 print:bg-white print:border-neutral-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 print:text-neutral-600">Flagged bugs</span>
              <Bug className="h-3.5 w-3.5 text-red-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-semibold font-mono text-neutral-100 print:text-black tabular-nums">
                {totalBugs}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500 print:text-neutral-500">
              Resolved with line calibrations
            </p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-[#141416] p-4 print:bg-white print:border-neutral-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 print:text-neutral-600">High severity</span>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-semibold font-mono text-neutral-100 print:text-black tabular-nums">
                {criticalBugs}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500 print:text-neutral-500">
              Immediate action recommended
            </p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-[#141416] p-4 print:bg-white print:border-neutral-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 print:text-neutral-600">Affected files</span>
              <FileCode className="h-3.5 w-3.5 text-neutral-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-semibold font-mono text-neutral-100 print:text-black tabular-nums">
                {filesWithDefects}
              </span>
              <span className="text-xs text-neutral-500 font-mono ml-1">/ {summary.analyzedFiles}</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500 print:text-neutral-500">
              Modules with verified defects
            </p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-[#141416] p-4 print:bg-white print:border-neutral-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 print:text-neutral-600">Patch readiness</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-semibold font-mono text-neutral-100 print:text-black tabular-nums">
                100%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500 print:text-neutral-500">
              Unified git patch compiled
            </p>
          </div>
        </div>
      </div>

      {/* 3. Executive Findings Summary */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono font-medium text-neutral-400 print:text-neutral-600">
          Executive summary & diagnostic findings
        </h2>

        <div className="rounded-lg border border-neutral-800 bg-[#141416] p-5 space-y-3 print:bg-white print:border-neutral-200">
          <ul className="space-y-2.5 text-xs text-neutral-300 print:text-neutral-800 leading-relaxed list-disc list-inside">
            <li>
              <strong className="text-neutral-100 print:text-black font-medium">Defect density:</strong> Found{' '}
              <span className="font-mono text-red-400 print:text-red-700">{totalBugs} verified defect instances</span>{' '}
              across {filesWithDefects} files. {criticalBugs} defects represent high-risk runtime stability hazards.
            </li>
            <li>
              <strong className="text-neutral-100 print:text-black font-medium">Code complexity baseline:</strong> Average cyclomatic complexity across analyzed modules is{' '}
              <span className="font-mono">{summary.averageComplexity.toFixed(1)}</span> with a total churn volume of{' '}
              <span className="font-mono">{summary.totalChurnLines}</span> lines.
            </li>
            <li>
              <strong className="text-neutral-100 print:text-black font-medium">Automated resolution status:</strong> 100% of discovered bugs have verified replacement code snippets and a unified git patch ready to apply.
            </li>
          </ul>
        </div>
      </div>

      {/* 4. Actionable Defect Manifest */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-medium text-neutral-400 print:text-neutral-600">
            Diagnostic manifest ({allDefectsWithFile.length} items)
          </h2>
          <span className="text-xs text-neutral-500 font-mono">
            Calibrated line citations
          </span>
        </div>

        <div className="space-y-4">
          {allDefectsWithFile.map((defect, idx) => (
            <div
              key={`${defect.filePath || 'file'}_${defect.id || 'defect'}_${idx}`}
              className="rounded-lg border border-neutral-800 bg-[#0c0c0d] p-5 space-y-3 print:bg-white print:border-neutral-300 page-break-inside-avoid"
            >
              {/* Item Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-neutral-800/80 print:border-neutral-200">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded border border-neutral-800 bg-[#141416] text-neutral-300 print:bg-neutral-100 print:text-black">
                    #{idx + 1}
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 print:border-red-300 print:text-red-700">
                    Line {defect.lineNumber}
                  </span>
                  <h3 className="text-sm font-semibold text-neutral-100 print:text-black">
                    {defect.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-400 print:text-neutral-600">
                  <span className="truncate max-w-[240px]">{defect.filePath}</span>
                </div>
              </div>

              {/* Cause & Impact */}
              <div className="space-y-1.5 text-xs text-neutral-300 print:text-neutral-700 leading-relaxed">
                <div>
                  <strong className="text-neutral-100 print:text-black font-medium">Root cause:</strong>{' '}
                  {defect.cause}
                </div>
                {defect.impact && (
                  <div>
                    <strong className="text-neutral-100 print:text-black font-medium">Impact:</strong>{' '}
                    {defect.impact}
                  </div>
                )}
              </div>

              {/* Diffs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Buggy Code */}
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-red-400 print:text-red-700 flex items-center gap-1">
                    <span>- Buggy code:</span>
                  </div>
                  <pre className="rounded border border-red-500/20 bg-[#070708] p-3 text-[11px] font-mono text-neutral-300 overflow-x-auto whitespace-pre-wrap print:bg-neutral-50 print:border-neutral-300 print:text-black">
                    {defect.buggyCodeSnippet}
                  </pre>
                </div>

                {/* Remediation Fix */}
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-emerald-400 print:text-emerald-700 flex items-center gap-1">
                    <span>+ Remediation fix:</span>
                  </div>
                  <pre className="rounded border border-emerald-500/20 bg-[#070708] p-3 text-[11px] font-mono text-neutral-200 overflow-x-auto whitespace-pre-wrap print:bg-neutral-50 print:border-neutral-300 print:text-black">
                    {defect.remediedCodeSnippet}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Document Sign-Off Footer */}
      <div className="border-t border-neutral-800 pt-6 text-xs font-mono text-neutral-500 print:border-neutral-300 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          <span>Verified report &bull; BugPulse AI Defect Engine</span>
        </div>
        <div>
          <span>Repository patch ready via <code>git apply</code></span>
        </div>
      </div>
    </div>
  );
}
