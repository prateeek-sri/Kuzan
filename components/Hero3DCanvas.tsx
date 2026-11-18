'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Check,
  Copy,
  Terminal,
  ShieldAlert,
  Wrench,
  FileCode2,
  Scan,
  Activity,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CodeSnippetScenario {
  id: string;
  filename: string;
  language: string;
  riskScore: number;
  status: 'critical' | 'warning' | 'clean';
  cyclomatic: number;
  churnLoc: number;
  defectLine: number;
  defectTitle: string;
  defectDetail: string;
  remediationTitle: string;
  remediationPatch: string;
  lines: Array<{
    num: number;
    code: string;
    isBug?: boolean;
    isFix?: boolean;
    fixCode?: string;
  }>;
}

const SCENARIOS: CodeSnippetScenario[] = [
  {
    id: 'auth_ts',
    filename: 'auth.ts',
    language: 'TypeScript',
    riskScore: 88.4,
    status: 'critical',
    cyclomatic: 24,
    churnLoc: 420,
    defectLine: 410,
    defectTitle: 'TypeError: Unhandled null chain',
    defectDetail: 'session.user.profile is nullable on unverified OAuth accounts',
    remediationTitle: 'Optional chaining & fallback null guard applied',
    remediationPatch: `--- a/lib/auth.ts\n+++ b/lib/auth.ts\n@@ -409,3 +409,3 @@\n-  const role = session.user.profile.permissions.find(p => p.id === 'admin');\n+  const role = session?.user?.profile?.permissions?.find(p => p.id === 'admin') ?? null;`,
    lines: [
      { num: 407, code: 'export async function verifyUserSession(token: string) {' },
      { num: 408, code: '  const session = await decodeToken(token);' },
      { num: 409, code: '  if (!session) throw new AuthError("EXPIRED");' },
      {
        num: 410,
        code: '  const role = session.user.profile.permissions.find(p => p.id === "admin");',
        isBug: true,
        isFix: true,
        fixCode: '  const role = session?.user?.profile?.permissions?.find(p => p.id === "admin") ?? null;',
      },
      { num: 411, code: '  if (!role) throw new AuthError("FORBIDDEN");' },
      { num: 412, code: '  return { authorized: true, role };' },
      { num: 413, code: '}' },
    ],
  },
  {
    id: 'crypto_py',
    filename: 'crypto.py',
    language: 'Python',
    riskScore: 64.2,
    status: 'warning',
    cyclomatic: 18,
    churnLoc: 280,
    defectLine: 184,
    defectTitle: 'Security: Timing attack vulnerability',
    defectDetail: 'String equality operator == leaks execution time by character',
    remediationTitle: 'Replaced with constant-time hmac.compare_digest',
    remediationPatch: `--- a/lib/crypto.py\n+++ b/lib/crypto.py\n@@ -183,3 +183,3 @@\n-    return expected_token == received_token\n+    return hmac.compare_digest(expected_token, received_token)`,
    lines: [
      { num: 181, code: 'def verify_signature(expected_token: str, received_token: str) -> bool:' },
      { num: 182, code: '    if not expected_token or not received_token:' },
      { num: 183, code: '        return False' },
      {
        num: 184,
        code: '    return expected_token == received_token',
        isBug: true,
        isFix: true,
        fixCode: '    return hmac.compare_digest(expected_token, received_token)',
      },
      { num: 185, code: '    # Fallback timing protection' },
      { num: 186, code: '    return True' },
    ],
  },
  {
    id: 'patch_engine_ts',
    filename: 'patch_engine.ts',
    language: 'TypeScript',
    riskScore: 92.1,
    status: 'critical',
    cyclomatic: 22,
    churnLoc: 340,
    defectLine: 72,
    defectTitle: 'Off-by-one: Unified diff hunk offset',
    defectDetail: 'findIndex returns -1 if unmatched, causing negative hunk line numbers',
    remediationTitle: 'Guarded with Math.max(1, index + 1) line boundary',
    remediationPatch: `--- a/lib/patch_engine.ts\n+++ b/lib/patch_engine.ts\n@@ -71,3 +71,3 @@\n-  const hunkStart = sourceLines.findIndex(l => l === target) + 1;\n+  const hunkStart = Math.max(1, sourceLines.findIndex(l => l === target) + 1);`,
    lines: [
      { num: 70, code: 'export function generateFileHunk(sourceLines: string[], target: string) {' },
      { num: 71, code: '  if (!target) return null;' },
      {
        num: 72,
        code: '  const hunkStart = sourceLines.findIndex(l => l === target) + 1;',
        isBug: true,
        isFix: true,
        fixCode: '  const hunkStart = Math.max(1, sourceLines.findIndex(l => l === target) + 1);',
      },
      { num: 73, code: '  return formatHunkHeader(hunkStart, target.length);' },
      { num: 74, code: '}' },
    ],
  },
];

interface Hero3DCanvasProps {
  className?: string;
}

export function Hero3DCanvas({ className = '' }: Hero3DCanvasProps) {
  const [activeScenarioId, setActiveScenarioId] = useState<string>('auth_ts');
  const [viewMode, setViewMode] = useState<'defect' | 'remediation'>('defect');
  const [isScanning, setIsScanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tilt, setTilt] = useState({ rx: 3, ry: -3 });
  const containerRef = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS.find(s => s.id === activeScenarioId) || SCENARIOS[0];

  // Subtle interactive 3D perspective mouse tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate clamped rotation (-6deg to +6deg on X, -8deg to +8deg on Y)
    const ry = ((x - centerX) / centerX) * 6;
    const rx = -((y - centerY) / centerY) * 5;
    setTilt({ rx: Math.round(rx * 10) / 10, ry: Math.round(ry * 10) / 10 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Return smoothly to calm default tilt
    setTilt({ rx: 2.5, ry: -2.5 });
  }, []);

  const handleCopyPatch = async () => {
    try {
      await navigator.clipboard.writeText(scenario.remediationPatch);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleTriggerScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 1200);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full select-none transition-transform duration-300 ease-out ${className}`}
      style={{
        perspective: '1200px',
      }}
    >
      {/* 3D Perspective Wrapper with bounded height */}
      <div
        className="w-full h-[400px] sm:h-[420px] rounded-xl border border-neutral-800 bg-[#0c0c0e] shadow-2xl overflow-hidden flex flex-col transition-all duration-200"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: 'preserve-3d',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.07)',
        }}
        role="region"
        aria-label="Interactive 3D Code Defect Diagnostic Terminal"
      >
        {/* Top Window Header & File Tabs */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#121214] border-b border-neutral-800/80 font-mono text-xs">
          {/* Mac-style Window Controls & Title */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 mr-2">
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-700/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-700/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-700/80" />
            </div>

            {/* File Switcher Tabs */}
            <div className="flex items-center gap-1">
              {SCENARIOS.map(s => {
                const isActive = s.id === scenario.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setActiveScenarioId(s.id);
                      setViewMode('defect');
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                      isActive
                        ? 'bg-[#1a1a1d] text-neutral-100 border border-neutral-700/60 shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                    }`}
                  >
                    <FileCode2 className="h-3 w-3 text-neutral-400" />
                    <span>{s.filename}</span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        s.status === 'critical'
                          ? 'bg-rose-500'
                          : s.status === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Mode Toggle: Defect vs Remediation */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-lg border border-neutral-800 bg-[#161619] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode('defect')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  viewMode === 'defect'
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <ShieldAlert className="h-3 w-3" />
                <span>Defect</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('remediation')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  viewMode === 'remediation'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Wrench className="h-3 w-3" />
                <span>Patch</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerScan}
              disabled={isScanning}
              className="h-6 px-2 text-[10px] font-mono border-neutral-800 bg-[#18181b] hover:bg-neutral-800 text-neutral-300 hover:text-white"
              title="Trigger AST Diagnostic Scan"
            >
              <Scan className={`h-2.5 w-2.5 mr-1 ${isScanning ? 'animate-spin text-sky-400' : 'text-neutral-400'}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan AST'}</span>
            </Button>
          </div>
        </div>

        {/* Diagnostic Meta Sub-header */}
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#0f0f11] border-b border-neutral-800/60 font-mono text-[10px] text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-neutral-300">
              <span className="text-neutral-500">MODULE:</span>
              <span className="font-semibold text-neutral-200">{scenario.filename}</span>
            </span>
            <span className="text-neutral-700">&bull;</span>
            <span>CYCLOMATIC: <strong className="text-neutral-200">{scenario.cyclomatic}</strong></span>
            <span className="text-neutral-700">&bull;</span>
            <span>CHURN: <strong className="text-neutral-200">+{scenario.churnLoc} LOC</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-neutral-500">RISK INDEX:</span>
            <Badge
              variant="outline"
              className={`text-[10px] font-mono py-0 px-1.5 ${
                scenario.riskScore > 75
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              {viewMode === 'remediation' ? '0.0% (Remediated)' : `${scenario.riskScore}% Critical`}
            </Badge>
          </div>
        </div>

        {/* Code Viewport with Syntax Lines */}
        <div className="relative flex-1 p-3.5 font-mono text-[11px] leading-relaxed overflow-hidden bg-[#0a0a0c]">
          {/* Animated Diagnostic Scan Laser Line */}
          {isScanning && (
            <div
              className="absolute inset-x-0 h-[2px] bg-sky-400 shadow-[0_0_8px_#38bdf8] pointer-events-none z-20 animate-pulse"
              style={{
                top: '45%',
                transition: 'top 1.2s ease-in-out',
              }}
            />
          )}

          <div className="space-y-1">
            {scenario.lines.map(line => {
              const isTargetLine = line.num === scenario.defectLine;

              if (isTargetLine) {
                if (viewMode === 'defect') {
                  return (
                    <div
                      key={line.num}
                      className="group -mx-3.5 px-3.5 py-1.5 bg-rose-950/20 border-y border-rose-500/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-8 shrink-0 text-rose-400/80 select-none text-right">
                          {line.num}
                        </span>
                        <span className="text-rose-400 font-semibold select-none mr-1">-</span>
                        <span className="text-rose-200 flex-1 break-all">
                          {line.code}
                        </span>
                      </div>

                      {/* Defect Callout Box */}
                      <div className="mt-1.5 ml-11 flex flex-wrap items-center gap-2 text-[10px] text-rose-300/90 font-mono">
                        <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 border border-rose-500/20">
                          <ShieldAlert className="h-2.5 w-2.5" />
                          <span>{scenario.defectTitle}</span>
                        </span>
                        <span className="text-neutral-400 text-[10px]">
                          {scenario.defectDetail}
                        </span>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={line.num}
                      className="group -mx-3.5 px-3.5 py-1.5 bg-emerald-950/20 border-y border-emerald-500/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-8 shrink-0 text-emerald-400/80 select-none text-right">
                          {line.num}
                        </span>
                        <span className="text-emerald-400 font-semibold select-none mr-1">+</span>
                        <span className="text-emerald-200 flex-1 break-all">
                          {line.fixCode}
                        </span>
                      </div>

                      {/* Fix Callout Box */}
                      <div className="mt-1.5 ml-11 flex flex-wrap items-center justify-between gap-2 text-[10px] text-emerald-300/90 font-mono">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 border border-emerald-500/20">
                          <Check className="h-2.5 w-2.5" />
                          <span>{scenario.remediationTitle}</span>
                        </span>

                        <button
                          type="button"
                          onClick={handleCopyPatch}
                          className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-200 font-semibold transition-colors ml-auto mr-1"
                        >
                          {copied ? (
                            <>
                              <Check className="h-2.5 w-2.5 text-emerald-400" />
                              <span>Copied patch!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-2.5 w-2.5" />
                              <span>Copy Git Patch</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                }
              }

              // Normal Code Line
              return (
                <div key={line.num} className="flex items-start gap-3 py-0.5">
                  <span className="w-8 shrink-0 text-neutral-600 select-none text-right">
                    {line.num}
                  </span>
                  <span className="text-neutral-600 select-none mr-1"> </span>
                  <span className="text-neutral-300 break-all font-mono">
                    {line.code}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Status & Diagnostic Telemetry Footer */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d0f] border-t border-neutral-800/80 font-mono text-[10px] text-neutral-400">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 text-neutral-300">
              <Activity className="h-3 w-3 text-emerald-400" />
              <span>AST Engine: Tree-sitter v0.22</span>
            </span>
            <span className="text-neutral-700 hidden sm:inline">&bull;</span>
            <span className="text-neutral-400 hidden sm:inline">NVIDIA NIM LLaMA-3.3-70B</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-neutral-500">CALIBRATION:</span>
            <span className="text-neutral-200 font-semibold">99.4% F1-Score</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Hero3DCanvas;