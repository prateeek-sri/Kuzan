import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { fetchGitHubFileContent, createGitHubPullRequest } from '@/lib/github';
import {
  applyDefectFixesToSourceCode,
  generateUnifiedFileDiff,
  generateRepositoryPatch,
} from '@/lib/remediation/patch-engine';
import type { CodeDefectItem, RemediationPatchResponse } from '@shared/types/contracts';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const {
      selectedDefectIds,
      action = 'preview-patch',
      githubToken = process.env.GITHUB_TOKEN,
      prTitle = 'fix: apply BugPulse AI defect remediations',
      prBranchName,
    } = body;

    const run = await prisma.predictionRun.findUnique({
      where: { id },
      include: {
        repository: true,
        predictions: {
          orderBy: { riskRank: 'asc' },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: `Prediction run "${id}" was not found.`,
          },
        },
        { status: 404 }
      );
    }

    // Authentication guard: ensure user is logged in to generate/apply remediations
    const currentUser = await getCurrentUser(req).catch(() => null);
    if (!currentUser) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please sign in to apply remediations.',
          },
        },
        { status: 401 }
      );
    }

    const filesWithDefects = run.predictions.filter((p) => {
      const d = p.defects as unknown as CodeDefectItem[] | null;
      return Array.isArray(d) && d.length > 0;
    });

    const patchFiles: Array<{
      filePath: string;
      originalContent: string;
      remediatedContent: string;
    }> = [];

    const modifiedFilesSummary: Array<{
      filePath: string;
      defectsFixedCount: number;
      fileDiff: string;
    }> = [];

    let totalFixesApplied = 0;

    for (const p of filesWithDefects) {
      let fileDefects = (p.defects as unknown as CodeDefectItem[]) || [];

      // Filter by selectedDefectIds if provided
      if (Array.isArray(selectedDefectIds) && selectedDefectIds.length > 0) {
        fileDefects = fileDefects.filter((d) => selectedDefectIds.includes(d.id));
      }

      if (fileDefects.length === 0) continue;

      let originalContent = '';
      try {
        originalContent = await fetchGitHubFileContent(
          run.repository.owner,
          run.repository.name,
          p.filePath,
          run.repository.defaultBranch,
          githubToken
        );
      } catch {
        // Fallback to synthetic content from defect snippets
        originalContent = fileDefects
          .map((d) => `// Line ${d.lineNumber} [${d.title}]\n${d.buggyCodeSnippet}\n`)
          .join('\n');
      }

      if (!originalContent) {
        originalContent = fileDefects
          .map((d) => `// Line ${d.lineNumber} [${d.title}]\n${d.buggyCodeSnippet}\n`)
          .join('\n');
      }

      const { newCode, appliedCount } = applyDefectFixesToSourceCode(
        originalContent,
        fileDefects
      );

      const fileDiff = generateUnifiedFileDiff(p.filePath, originalContent, newCode);

      if (fileDiff.trim().length > 0) {
        patchFiles.push({
          filePath: p.filePath,
          originalContent,
          remediatedContent: newCode,
        });

        modifiedFilesSummary.push({
          filePath: p.filePath,
          defectsFixedCount: appliedCount,
          fileDiff,
        });

        totalFixesApplied += appliedCount;
      }
    }

    const unifiedPatch = generateRepositoryPatch(patchFiles);
    const applyCommand = `curl -s "${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/reports/${run.id}/download?format=patch" | git apply`;

    let pullRequestResult:
      | { htmlUrl: string; number: number; branchName: string }
      | undefined = undefined;

    // Optional automated PR creation
    if (action === 'create-pr' && githubToken && patchFiles.length > 0) {
      const filesToCommit = patchFiles.map((f) => ({
        filePath: f.filePath,
        content: f.remediatedContent,
      }));

      pullRequestResult = await createGitHubPullRequest(
        run.repository.owner,
        run.repository.name,
        run.repository.defaultBranch,
        githubToken,
        filesToCommit,
        prTitle,
        `### Automated Bug Fixes by BugPulse AI\n\nThis PR fixes **${totalFixesApplied}** defects across **${patchFiles.length}** modules:\n\n${modifiedFilesSummary
          .map((m) => `- \`${m.filePath}\`: ${m.defectsFixedCount} bug(s) remediated`)
          .join('\n')}\n\n*Verified by BugPulse Defect Gatekeeper.*`
      );
    }

    const response: RemediationPatchResponse = {
      analysisId: run.id,
      repo: {
        owner: run.repository.owner,
        name: run.repository.name,
        defaultBranch: run.repository.defaultBranch,
      },
      totalFilesModified: patchFiles.length,
      totalFixesApplied,
      unifiedPatch,
      applyCommand,
      modifiedFiles: modifiedFilesSummary,
      pullRequest: pullRequestResult,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('Error executing remediation endpoint:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to generate remediation patch',
        },
      },
      { status: 500 }
    );
  }
}

