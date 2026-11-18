'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface RecentRepo {
  id: string;
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
  lastAnalyzedAt: string | null;
  latestRun: {
    id: string;
    status: string;
    modelType: string;
    totalFiles: number;
    defectProneCount: number;
    averageComplexity: number;
    createdAt: string;
  } | null;
}

export function RecentAnalysesTable() {
  const [repositories, setRepositories] = useState<RecentRepo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/repos')
      .then((res) => res.json())
      .then((data) => {
        if (data.repositories) {
          setRepositories(data.repositories);
        }
      })
      .catch((err) => console.error('Error fetching repositories:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="p-6 border-neutral-800 bg-[#141416]">
        <div className="h-4 w-36 bg-neutral-800 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-8 bg-[#1a1a1d] rounded" />
          <div className="h-8 bg-[#1a1a1d] rounded" />
          <div className="h-8 bg-[#1a1a1d] rounded" />
        </div>
      </Card>
    );
  }

  if (repositories.length === 0) {
    return null;
  }

  return (
    <Card className="border-neutral-800 bg-[#141416] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-neutral-400" />
          Recent analyses
        </h3>
        <span className="text-xs text-neutral-500 font-mono tabular-nums">
          {repositories.length} {repositories.length === 1 ? 'repository' : 'repositories'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-400">
              <th className="pb-2.5 pl-1 font-medium">Repository</th>
              <th className="pb-2.5 px-3 font-medium">Model</th>
              <th className="pb-2.5 px-3 text-center font-medium">Files</th>
              <th className="pb-2.5 px-3 text-center font-medium">Defect risk</th>
              <th className="pb-2.5 px-3 font-medium">Last run</th>
              <th className="pb-2.5 pr-1 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
            {repositories.map((repo) => {
              const run = repo.latestRun;
              const hasRun = run && run.status === 'COMPLETED';
              const defectPercent =
                hasRun && run.totalFiles > 0
                  ? Math.round((run.defectProneCount / run.totalFiles) * 100)
                  : 0;

              return (
                <tr key={repo.id} className="hover:bg-[#1a1a1d]/60 transition-colors">
                  <td className="py-2.5 pl-1 font-medium text-neutral-200">
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-500">{repo.owner}/</span>
                      <span className="text-neutral-100 font-semibold">{repo.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-neutral-400">
                    {run?.modelType || 'AutoSelect'}
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-400 tabular-nums">
                    {run ? run.totalFiles : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {hasRun ? (
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono py-0 px-1.5 ${
                          defectPercent > 40
                            ? 'border-red-500/30 text-red-400 bg-red-500/10'
                            : defectPercent > 15
                            ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                            : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                        }`}
                      >
                        {defectPercent}%
                      </Badge>
                    ) : (
                      <span className="text-neutral-600">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-400 tabular-nums">
                    {run ? new Date(run.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-2.5 pr-1 text-right">
                    {run ? (
                      <Link href={`/reports/${run.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[11px] px-2 border-neutral-800 bg-[#141416] text-neutral-300 hover:text-white hover:bg-neutral-800"
                        >
                          <span>Report</span>
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    ) : (
                      <span className="text-neutral-600 text-xs">Queued</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
