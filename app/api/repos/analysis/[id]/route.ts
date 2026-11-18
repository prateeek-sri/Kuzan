import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getOrGenerateFileDefects } from '@/lib/metrics/defect-inspector';
import type { CodeDefectItem } from '@shared/types/contracts';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
            message: `Prediction run with ID "${id}" was not found.`,
          },
        },
        { status: 404 }
      );
    }

    // Authentication guard: ensure user is logged in to view defect analysis reports
    const currentUser = await getCurrentUser(req).catch(() => null);
    if (!currentUser) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please sign in to access defect analysis reports.',
          },
        },
        { status: 401 }
      );
    }

    // Access control: prevent IDOR leakage for private repositories
    if (run.repository.isPrivate) {
      if (run.repository.userId !== currentUser.id) {
        return NextResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to view analysis for this private repository.',
            },
          },
          { status: 403 }
        );
      }
    }

    // Fetch file metrics for these predicted files
    const metrics = await prisma.fileMetric.findMany({
      where: {
        repoId: run.repoId,
        filePath: {
          in: run.predictions.map((p) => p.filePath),
        },
      },
    });

    const metricsMap = new Map(metrics.map((m) => [m.filePath, m]));

    // Build enriched file details with actionable line-level defect diagnostics
    const topVulnerableFiles = run.predictions.map((p) => {
      const metric = metricsMap.get(p.filePath);
      const complexity = metric?.cyclomaticComplexity ?? 1.0;
      const language = metric?.language ?? 'generic';

      // Use persisted defects or generate contextual defect guidance if empty
      const storedDefects = (p.defects as unknown as CodeDefectItem[] | null) ?? [];
      const defects: CodeDefectItem[] =
        storedDefects.length > 0
          ? storedDefects
          : getOrGenerateFileDefects(p.filePath, undefined, language, complexity);

      return {
        filePath: p.filePath,
        defectProbability: p.defectProbability,
        riskLevel: p.riskLevel,
        cyclomaticComplexity: complexity,
        commitCount: metric?.commitCount ?? 0,
        churnLines: metric?.churnLines ?? 0,
        bugFixCount: metric?.bugFixCount ?? 0,
        loc: metric?.loc ?? 0,
        sloc: metric?.sloc ?? 0,
        language,
        rank: p.riskRank,
        defects,
      };
    });

    const highRiskCount = run.predictions.filter((p) => p.riskLevel === 'HIGH').length;
    const criticalRiskCount = run.predictions.filter((p) => p.riskLevel === 'CRITICAL').length;
    const mediumRiskCount = run.predictions.filter((p) => p.riskLevel === 'MEDIUM').length;
    const lowRiskCount = run.predictions.filter((p) => p.riskLevel === 'LOW').length;

    const progressMap: Record<string, { percent: number; message: string }> = {
      QUEUED: { percent: 10, message: 'Analysis job queued in processing worker...' },
      FETCHING: { percent: 35, message: 'Ingesting repository files & commit history from GitHub...' },
      EXTRACTING_METRICS: { percent: 65, message: 'Extracting multi-language AST complexity & churn metrics...' },
      PREDICTING: { percent: 85, message: 'Executing machine learning defect prediction model...' },
      COMPLETED: { percent: 100, message: 'Defect risk analysis complete.' },
      FAILED: { percent: 0, message: run.errorMessage || 'Analysis stopped or encountered an error.' },
    };

    const progressInfo = progressMap[run.status] || { percent: 50, message: 'Processing analysis...' };

    return NextResponse.json(
      {
        analysisId: run.id,
        status: run.status,
        progressPercent: progressInfo.percent,
        statusMessage: progressInfo.message,
        modelType: run.modelType,
        repo: {
          id: run.repository.id,
          owner: run.repository.owner,
          name: run.repository.name,
          url: run.repository.url,
          defaultBranch: run.repository.defaultBranch,
        },
        summary: {
          totalFiles: run.totalFiles,
          analyzedFiles: run.totalFiles,
          defectProneFiles: run.defectProneCount,
          averageComplexity: run.averageComplexity,
          totalChurnLines: run.totalChurnLines,
          lowRiskCount,
          mediumRiskCount,
          highRiskCount,
          criticalRiskCount,
        },
        topVulnerableFiles,
        createdAt: run.createdAt.toISOString(),
        completedAt: run.completedAt?.toISOString() || null,
        errorMessage: run.errorMessage,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching analysis:', errMsg);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve analysis details. Please try again later.',
        },
      },
      { status: 500 }
    );
  }
}

