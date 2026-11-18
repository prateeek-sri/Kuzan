/**
 * Git Commit & Churn Mining Engine
 * Standard: test-driven-development & api-and-interface-design
 */

import type { CommitRecord } from '@shared/types/contracts';

export interface FileChurnMetric {
  filePath: string;
  commitCount: number;
  churnLines: number;
  authorCount: number;
  bugFixCount: number;
}

// Semantic patterns identifying defect-repair commits
const BUG_FIX_PATTERNS: RegExp[] = [
  /\b(fix|fixes|fixed|fixing)\b/i,
  /\b(bug|bugs|bugfix|bugfixes)\b/i,
  /\b(hotfix|patch|patched)\b/i,
  /\b(defect|defects)\b/i,
  /\b(close|closes|closed|resolve|resolves|resolved)\s+#\d+\b/i,
  /\bissue\s+#\d+\b/i,
  /^fix(\([a-z0-9_-]+\))?:/i,
  /^bugfix(\([a-z0-9_-]+\))?:/i,
  /^hotfix(\([a-z0-9_-]+\))?:/i,
];

/**
 * Checks if a commit message indicates a bug fix using semantic heuristics
 */
export function isBugFixCommit(message: string): boolean {
  if (!message || message.trim() === '') return false;
  return BUG_FIX_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Aggregates commit history into per-file churn, author diversity, and bug-fix metrics
 */
export function extractCommitChurnMetrics(
  commits: CommitRecord[]
): Map<string, FileChurnMetric> {
  const fileMap = new Map<
    string,
    {
      commitCount: number;
      churnLines: number;
      authors: Set<string>;
      bugFixCount: number;
    }
  >();

  for (const commit of commits) {
    const isFix = isBugFixCommit(commit.message);
    const author = commit.author ? commit.author.trim().toLowerCase() : 'unknown';

    for (const fileChange of commit.filesChanged) {
      const path = fileChange.path.trim();
      if (!path) continue;

      let entry = fileMap.get(path);
      if (!entry) {
        entry = {
          commitCount: 0,
          churnLines: 0,
          authors: new Set<string>(),
          bugFixCount: 0,
        };
        fileMap.set(path, entry);
      }

      entry.commitCount += 1;
      entry.churnLines += Math.max(0, fileChange.added) + Math.max(0, fileChange.deleted);
      entry.authors.add(author);
      if (isFix) {
        entry.bugFixCount += 1;
      }
    }
  }

  const result = new Map<string, FileChurnMetric>();
  for (const [filePath, stats] of fileMap.entries()) {
    result.set(filePath, {
      filePath,
      commitCount: stats.commitCount,
      churnLines: stats.churnLines,
      authorCount: stats.authors.size || 1,
      bugFixCount: stats.bugFixCount,
    });
  }

  return result;
}

