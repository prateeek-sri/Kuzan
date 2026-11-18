/**
 * Software Metrics Aggregator Service
 * Standard: api-and-interface-design & incremental-implementation
 * Orchestrates Complexity + Git Churn extraction and persists to D2
 */

import { analyzeCodeComplexity } from './complexity';
import { extractCommitChurnMetrics } from './churn';
import type {
  RepoSourceFile,
  CommitRecord,
  FileMetricVector,
} from '@shared/types/contracts';
import { prisma } from '../prisma';

export interface AggregateMetricsOptions {
  repoId?: string;
  persistToDatabase?: boolean;
}

export async function aggregateRepositoryMetrics(
  files: RepoSourceFile[],
  commits: CommitRecord[],
  options: AggregateMetricsOptions = {}
): Promise<FileMetricVector[]> {
  // 1. Compute churn metrics map across all commits
  const churnMap = extractCommitChurnMetrics(commits);

  // 2. Compute complexity and merge for every source file
  const metrics: FileMetricVector[] = [];

  for (const file of files) {
    const complexity = analyzeCodeComplexity(file.path, file.content, file.language);
    const churn = churnMap.get(file.path) ?? {
      filePath: file.path,
      commitCount: 0,
      churnLines: 0,
      authorCount: 1,
      bugFixCount: 0,
    };

    metrics.push({
      filePath: file.path,
      loc: complexity.loc,
      sloc: complexity.sloc,
      cyclomaticComplexity: complexity.cyclomaticComplexity,
      halsteadVolume: complexity.halsteadVolume,
      commitCount: churn.commitCount,
      churnLines: churn.churnLines,
      authorCount: churn.authorCount,
      bugFixCount: churn.bugFixCount,
    });
  }

  // 3. Persist to PostgreSQL D2 Repo Metric DB if repoId provided
  if (options.persistToDatabase && options.repoId) {
    const repoId = options.repoId;
    for (const m of metrics) {
      await prisma.fileMetric.upsert({
        where: {
          repoId_filePath: {
            repoId,
            filePath: m.filePath,
          },
        },
        update: {
          language: files.find((f) => f.path === m.filePath)?.language ?? 'generic',
          loc: m.loc,
          sloc: m.sloc,
          cyclomaticComplexity: m.cyclomaticComplexity,
          halsteadVolume: m.halsteadVolume,
          commitCount: m.commitCount,
          churnLines: m.churnLines,
          authorCount: m.authorCount,
          bugFixCount: m.bugFixCount,
        },
        create: {
          repoId,
          filePath: m.filePath,
          language: files.find((f) => f.path === m.filePath)?.language ?? 'generic',
          loc: m.loc,
          sloc: m.sloc,
          cyclomaticComplexity: m.cyclomaticComplexity,
          halsteadVolume: m.halsteadVolume,
          commitCount: m.commitCount,
          churnLines: m.churnLines,
          authorCount: m.authorCount,
          bugFixCount: m.bugFixCount,
        },
      });
    }
  }

  return metrics;
}

