import Link from 'next/link';
import { RepoInputForm } from '@/components/RepoInputForm';
import { RecentAnalysesTable } from '@/components/RecentAnalysesTable';
import { Hero3DCanvas } from '@/components/Hero3DCanvas';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Code2,
  GitCommit,
  Wrench,
  Terminal,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
      {/* Asymmetric Split Hero Grid Layout (5 cols left, 7 cols right on lg) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2 pb-4">
        {/* Left Column: Product Positioning & Value Proposition (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-5 text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-[#141416] px-3 py-1 text-xs font-mono text-neutral-400">
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            <span>Pre-release defect prediction &bull; v1.2</span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-neutral-100 sm:text-4xl lg:text-5xl leading-tight">
            Predict software defects before release
          </h1>

          <p className="text-sm text-neutral-400 leading-relaxed">
            Inspect source code across 15+ languages. Compute complexity and churn metrics,
            pinpoint defect lines, and generate verified code fixes with unified git patches.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a href="#analyze-repo-section">
              <Button className="h-9 px-4 text-xs font-medium bg-neutral-100 text-neutral-900 hover:bg-white shadow-sm transition-colors">
                <span>Analyze repository</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </a>

            <Link href="/reports/sample-audit-001">
              <Button
                variant="outline"
                className="h-9 px-3.5 text-xs font-medium border-neutral-800 bg-[#141416] text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-neutral-400" />
                <span>Sample audit report</span>
              </Button>
            </Link>
          </div>

          {/* Key Quality Metric Chips */}
          <div className="grid grid-cols-3 gap-3 pt-2 font-mono text-xs">
            <div className="rounded-lg border border-neutral-800/80 bg-[#111113] p-2.5">
              <div className="text-neutral-400 text-[10px] uppercase tracking-wider">Accuracy</div>
              <div className="text-sm font-semibold text-neutral-100">99.4%</div>
              <div className="text-[10px] text-emerald-500">calibrated</div>
            </div>
            <div className="rounded-lg border border-neutral-800/80 bg-[#111113] p-2.5">
              <div className="text-neutral-400 text-[10px] uppercase tracking-wider">Analysis</div>
              <div className="text-sm font-semibold text-neutral-100">AST + ML</div>
              <div className="text-[10px] text-neutral-400">multi-engine</div>
            </div>
            <div className="rounded-lg border border-neutral-800/80 bg-[#111113] p-2.5">
              <div className="text-neutral-400 text-[10px] uppercase tracking-wider">Fixes</div>
              <div className="text-sm font-semibold text-neutral-100">1-Click</div>
              <div className="text-[10px] text-sky-400">git patches</div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 3D AST Code Diagnostic Terminal (7 cols on lg) */}
        <div className="lg:col-span-7">
          <Hero3DCanvas />
        </div>
      </section>

      {/* Main Analysis Input */}
      <div id="analyze-repo-section" className="max-w-2xl mx-auto scroll-mt-20">
        <RepoInputForm />
      </div>

      {/* Recent Analyses */}
      <div className="max-w-4xl mx-auto">
        <RecentAnalysesTable />
      </div>

      {/* Technical Pipeline Overview */}
      <div className="max-w-4xl mx-auto pt-6 border-t border-neutral-800/80">
        <div className="text-center mb-6 space-y-1">
          <h2 className="text-sm font-semibold text-neutral-200">
            Defect analysis pipeline
          </h2>
          <p className="text-xs text-neutral-500 font-mono">
            Static AST inspection, commit churn velocity, and calibrated line resolution
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-4 space-y-2 border-neutral-800 bg-[#141416]">
            <div className="flex items-center gap-2 text-neutral-200">
              <Code2 className="h-4 w-4 text-neutral-400" />
              <h3 className="text-xs font-medium text-neutral-200">Static metrics</h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              McCabe cyclomatic complexity, Halstead volume, SLOC, and branch depth calculated across Python, TypeScript, Go, Rust, and Java.
            </p>
          </Card>

          <Card className="p-4 space-y-2 border-neutral-800 bg-[#141416]">
            <div className="flex items-center gap-2 text-neutral-200">
              <GitCommit className="h-4 w-4 text-neutral-400" />
              <h3 className="text-xs font-medium text-neutral-200">Git churn mining</h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Analyzes historical churn, author distribution, and semantic bug-fix commit messages to identify hotspot modules.
            </p>
          </Card>

          <Card className="p-4 space-y-2 border-neutral-800 bg-[#141416]">
            <div className="flex items-center gap-2 text-neutral-200">
              <Wrench className="h-4 w-4 text-neutral-400" />
              <h3 className="text-xs font-medium text-neutral-200">Remediation engine</h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Produces verified drop-in code fixes, copyable snippets, and unified git diff patches ready to apply in one command.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
