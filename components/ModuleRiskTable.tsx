'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  CheckCircle2,
  GitMerge,
  Wrench,
  Terminal,
} from 'lucide-react';
import type { CodeDefectItem } from '@shared/types/contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SyntaxHighlighter } from './SyntaxHighlighter';

export interface FilePredictionItem {
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
}

interface ModuleRiskTableProps {
  files: FilePredictionItem[];
  repoUrl: string;
  defaultBranch: string;
  onApplyAllFixes?: () => void;
}

const SEVERITY_LEVELS = [
  { label: 'All', value: 'ALL' },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
];

export function ModuleRiskTable({
  files,
  repoUrl,
  defaultBranch,
  onApplyAllFixes,
}: ModuleRiskTableProps) {
  const [search, setSearch] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [selectedLang, setSelectedLang] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCleanFiles, setShowCleanFiles] = useState(false);

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const availableLanguages = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => {
      if (f.language) set.add(f.language);
    });
    return Array.from(set);
  }, [files]);

  // Separate files with active defects vs clean files
  const { filesWithDefects, cleanFiles } = useMemo(() => {
    const withDefects: FilePredictionItem[] = [];
    const clean: FilePredictionItem[] = [];

    files.forEach((f) => {
      if (f.defects && f.defects.length > 0) {
        withDefects.push(f);
      } else {
        clean.push(f);
      }
    });

    return { filesWithDefects: withDefects, cleanFiles: clean };
  }, [files]);

  // Filter files with defects according to search and selection
  const processedFiles = useMemo(() => {
    let result = [...filesWithDefects];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.filePath.toLowerCase().includes(q) ||
          f.defects?.some(
            (d) =>
              d.title.toLowerCase().includes(q) ||
              d.cause.toLowerCase().includes(q) ||
              d.functionName?.toLowerCase().includes(q) ||
              d.buggyCodeSnippet.toLowerCase().includes(q) ||
              d.remediedCodeSnippet.toLowerCase().includes(q)
          )
      );
    }

    if (selectedRisk !== 'ALL') {
      result = result.filter((f) => {
        return (
          f.riskLevel.toUpperCase() === selectedRisk ||
          f.defects?.some((d) => d.severity.toUpperCase() === selectedRisk)
        );
      });
    }

    if (selectedLang !== 'ALL') {
      result = result.filter(
        (f) => f.language?.toLowerCase() === selectedLang.toLowerCase()
      );
    }

    return result;
  }, [filesWithDefects, search, selectedRisk, selectedLang]);

  // Total concrete defect items in view
  const totalBugsInView = useMemo(() => {
    return processedFiles.reduce((acc, f) => acc + (f.defects?.length || 0), 0);
  }, [processedFiles]);

  const copyAllFixesForFiltered = () => {
    const allRemediations = processedFiles
      .flatMap((f) =>
        (f.defects || []).map((d) => {
          return `// File: ${f.filePath} (Line ${d.lineNumber})\n// Defect: ${d.title}\n${d.remediedCodeSnippet}\n`;
        })
      )
      .join('\n');

    navigator.clipboard.writeText(allRemediations);
    setCopiedId('all_fixes');
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-5">
      {/* Control Bar: Title, Count, Quick Actions, Search */}
      <Card className="border-neutral-800 bg-[#141416] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-100">
                Flagged defects and remediations
              </h3>
              <Badge variant="outline" className="font-mono text-[11px] text-neutral-400">
                {totalBugsInView} {totalBugsInView === 1 ? 'bug' : 'bugs'}
              </Badge>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Exact code locations, root cause diagnostics, and verified drop-in fixes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onApplyAllFixes && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onApplyAllFixes}
                className="gap-1.5 h-8 text-xs font-medium bg-neutral-100 text-neutral-900 hover:bg-white"
              >
                <GitMerge className="h-3.5 w-3.5" />
                <span>Apply all fixes</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyAllFixesForFiltered}
              className="gap-1.5 h-8 text-xs font-medium border-neutral-800 bg-[#1a1a1d] text-neutral-200 hover:text-white hover:bg-neutral-800"
            >
              {copiedId === 'all_fixes' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>All fixes copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-neutral-400" />
                  <span>Copy all fixes</span>
                </>
              )}
            </Button>

            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter files or code..."
                className="pl-8 bg-[#0c0c0d] border-neutral-800 text-neutral-200 placeholder:text-neutral-500 h-8 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Segmented Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-neutral-400 font-medium mr-1 font-mono text-[11px]">Severity:</span>
          {SEVERITY_LEVELS.map((item) => {
            const isActive = selectedRisk === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setSelectedRisk(item.value)}
                className={`rounded px-2.5 py-1 text-[11px] font-mono transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-neutral-200 text-neutral-900 font-medium shadow-sm'
                    : 'bg-[#141416] border border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}

          {availableLanguages.length > 1 && (
            <>
              <span className="text-neutral-500 font-medium ml-2 mr-1 font-mono text-[11px]">Lang:</span>
              {['ALL', ...availableLanguages].map((lang) => {
                const isActive = selectedLang === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSelectedLang(lang)}
                    className={`rounded px-2 py-1 text-[11px] font-mono capitalize transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-neutral-800 text-neutral-100 font-medium border border-neutral-700'
                        : 'bg-[#141416] border border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    {lang === 'ALL' ? 'All' : lang}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {cleanFiles.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCleanFiles(!showCleanFiles)}
            className="text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              {showCleanFiles ? 'Hide clean files' : `Show ${cleanFiles.length} clean files`}
            </span>
          </button>
        )}
      </div>

      {/* Primary List: Defective Files */}
      {processedFiles.length === 0 ? (
        <Card className="p-8 text-center border-neutral-800 bg-[#141416] space-y-2">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
          <h4 className="text-sm font-semibold text-neutral-200">
            No defects matched current filter
          </h4>
          <p className="text-xs text-neutral-400 font-mono">
            {filesWithDefects.length === 0
              ? 'All scanned modules passed defect inspection without violations.'
              : 'Try clearing the search query or adjusting the severity level.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {processedFiles.map((file, fileIdx) => {
            const githubFileUrl = `${repoUrl.replace(/\/$/, '')}/blob/${defaultBranch}/${file.filePath}`;

            return (
              <Card
                key={`${file.filePath || 'file'}_${fileIdx}`}
                className="border-neutral-800 bg-[#141416] p-5 sm:p-6 space-y-4 shadow-sm"
              >
                {/* File Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-800/80">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-neutral-500">File:</span>
                    <a
                      href={githubFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-neutral-200 hover:text-white hover:underline flex items-center gap-1.5 transition-colors"
                      title="View file on GitHub"
                    >
                      <span>{file.filePath}</span>
                      <ExternalLink className="h-3 w-3 text-neutral-500" />
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] text-neutral-400">
                      {file.language || 'Code'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] ${
                        file.riskLevel === 'CRITICAL'
                          ? 'border-red-500/40 text-red-400 bg-red-500/10'
                          : file.riskLevel === 'HIGH'
                          ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                          : 'text-neutral-400'
                      }`}
                    >
                      {file.riskLevel.toLowerCase()} risk
                    </Badge>
                    <span className="text-[11px] text-neutral-500 font-mono tabular-nums">
                      {file.defects?.length || 0} {(file.defects?.length || 0) === 1 ? 'defect' : 'defects'}
                    </span>
                  </div>
                </div>

                {/* Defects for this File */}
                <div className="space-y-4">
                  {file.defects?.map((defect, defectIdx) => {
                    const lang = file.language || 'tsx';
                    const isNvidiaAi = defect.id.startsWith('def_nvidia');
                    const defectKey = `${file.filePath}_${defect.id || 'defect'}_${defectIdx}`;

                    return (
                      <div
                        key={defectKey}
                        className="rounded-lg border border-neutral-800 bg-[#0c0c0d] p-4 sm:p-5 space-y-3.5"
                      >
                        {/* Defect Header: [Line X] + Title + Engine Badge */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="font-mono text-xs px-2 py-0.5 border-red-500/30 text-red-400 bg-red-500/10"
                            >
                              Line {defect.lineNumber}
                            </Badge>

                            <h4 className="text-sm font-semibold text-neutral-100">
                              {defect.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isNvidiaAi ? (
                              <Badge variant="outline" className="gap-1 font-mono text-[10px] text-neutral-400">
                                <Terminal className="h-3 w-3 text-neutral-400" />
                                <span>Llama 3.3 70B</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="font-mono text-[10px] text-neutral-400">
                                AST check
                              </Badge>
                            )}

                            {defect.functionName && (
                              <Badge variant="outline" className="text-[10px] text-neutral-400 font-mono">
                                fn: {defect.functionName}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Root Cause & Impact */}
                        <div className="space-y-1 text-xs leading-relaxed">
                          <p className="text-neutral-300">
                            <span className="text-neutral-200 font-medium">Root cause:</span>{' '}
                            {defect.cause}
                          </p>
                          {defect.impact && (
                            <p className="text-neutral-400 text-[11px]">
                              <span className="text-neutral-300 font-medium">Impact:</span>{' '}
                              {defect.impact}
                            </p>
                          )}
                        </div>

                        {/* Code Comparison Blocks */}
                        <div className="space-y-3 pt-1">
                          {/* 1. Buggy Code Box */}
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                              <span>Buggy code:</span>
                            </div>

                            <div className="rounded-lg border border-neutral-800 bg-[#070708] overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-1.5 text-xs font-mono border-b border-neutral-800/80 bg-[#111113] text-neutral-400">
                                <span className="text-[11px] font-mono lowercase">{lang}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(`${defectKey}_buggy`, defect.buggyCodeSnippet)}
                                  className="text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer p-0.5 rounded hover:bg-neutral-800"
                                  title="Copy buggy code"
                                >
                                  {copiedId === `${defectKey}_buggy` ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>

                              <div className="p-3 bg-[#070708] border-l-2 border-red-500/70">
                                <SyntaxHighlighter code={defect.buggyCodeSnippet} language={lang} />
                              </div>
                            </div>
                          </div>

                          {/* 2. Remediation Fix Box */}
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              <span>Remediation fix:</span>
                            </div>

                            <div className="rounded-lg border border-neutral-800 bg-[#070708] overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-1.5 text-xs font-mono border-b border-neutral-800/80 bg-[#111113] text-emerald-400">
                                <span className="text-[11px] font-mono lowercase">{lang}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(`${defectKey}_remedy`, defect.remediedCodeSnippet)}
                                  className="text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer p-0.5 rounded hover:bg-neutral-800"
                                  title="Copy remediation fix"
                                >
                                  {copiedId === `${defectKey}_remedy` ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>

                              <div className="p-3 bg-[#070708] border-l-2 border-emerald-500/70">
                                <SyntaxHighlighter code={defect.remediedCodeSnippet} language={lang} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Fix Action Bar */}
                        {(() => {
                          const cleanFix =
                            defect.remediedCodeSnippet
                              .split('\n')
                              .map((l) => l.trim())
                              .find((l) => l.length > 0 && !l.startsWith('//')) ||
                            defect.remediedCodeSnippet.trim();

                          return (
                            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-neutral-800/80">
                              <div className="flex items-center gap-2 text-xs font-mono">
                                <span className="text-emerald-400 font-medium">Fix:</span>
                                <code className="text-neutral-300 bg-[#111113] px-2 py-0.5 rounded border border-neutral-800 truncate max-w-xs sm:max-w-md">
                                  {cleanFix}
                                </code>
                              </div>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopy(defectKey, defect.remediedCodeSnippet)}
                                className="gap-1.5 text-xs h-7 border-neutral-800 bg-[#111113] hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100"
                              >
                                {copiedId === defectKey ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    <span>Copied fix</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5 text-neutral-400" />
                                    <span>Copy fix</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Optional Clean Files Accordion */}
      {showCleanFiles && cleanFiles.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-neutral-800/80">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-neutral-400 font-mono">
              Verified clean files ({cleanFiles.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {cleanFiles.map((f, cleanIdx) => (
              <div
                key={`${f.filePath}_${cleanIdx}`}
                className="flex items-center justify-between p-2.5 rounded border border-neutral-800 bg-[#141416] text-xs font-mono"
              >
                <span className="text-neutral-300 truncate max-w-[260px]">{f.filePath}</span>
                <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  0 defects
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
