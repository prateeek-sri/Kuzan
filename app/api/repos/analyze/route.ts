import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import {
  parseGitHubUrl,
  fetchGitHubRepoMetadata,
  fetchGitHubRepoTree,
  fetchGitHubFileContent,
  fetchGitHubCommits,
  GitHubError,
  type GitHubFileEntry,
} from '@/lib/github';
import { detectLanguage } from '@/lib/metrics/complexity';
import { aggregateRepositoryMetrics } from '@/lib/metrics/aggregator';
import { inspectCodeForDefects } from '@/lib/metrics/defect-inspector';
import { inspectFileWithNvidia } from '@/lib/ai/nvidia';
import { resolveAccurateLineNumber } from '@/lib/remediation/code-locator';
import { BugPredictor } from '@/lib/predictor';
import type { RiskLevel } from '@prisma/client';
import type { RepoSourceFile, MLModelType, CodeDefectItem } from '@shared/types/contracts';

const emptyToUndefined = (val: unknown) => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return val;
};

const normalizeModel = (val: unknown) => {
  const v = emptyToUndefined(val);
  if (v === 'MLP_NeuralNet') return 'NeuralNetwork_MLP';
  if (v === 'SoftVotingEnsemble') return 'VotingEnsemble';
  return v;
};

const AnalyzeRepoSchema = z.object({
  repoUrl: z.string().trim().min(1, 'Repository URL is required').max(500),
  githubToken: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid GitHub token format')
      .max(255)
      .optional()
  ),
  nvidiaApiKey: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(255)
      .optional()
  ),
  branch: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_./@-]+$/, 'Invalid git ref/branch name')
      .max(100)
      .optional()
  ),
  selectedModel: z.preprocess(
    normalizeModel,
    z
      .enum([
        'AutoSelectBest',
        'RandomForest',
        'XGBoost',
        'LightGBM',
        'GradientBoosting',
        'ExtraTrees',
        'AdaBoost',
        'LogisticRegression',
        'SVM',
        'KNN',
        'NaiveBayes',
        'NeuralNetwork_MLP',
        'VotingEnsemble',
        'StackingEnsemble',
      ])
      .default('AutoSelectBest')
  ),
});

/**
 * Headless asynchronous background pipeline executing repo ingestion,
 * metrics extraction, and ML defect prediction without blocking HTTP requests.
 */
async function runAnalysisPipeline(
  runId: string,
  repoId: string,
  owner: string,
  repo: string,
  activeBranch: string,
  selectedModel: MLModelType,
  githubToken?: string,
  nvidiaApiKey?: string,
  defaultBranch?: string
) {
  try {
    // 1. Ingestion: Tree & Commits
    await prisma.predictionRun.update({
      where: { id: runId },
      data: { status: 'FETCHING' },
    });

    let currentBranch = activeBranch;
    let fileEntries: GitHubFileEntry[];
    try {
      fileEntries = await fetchGitHubRepoTree(owner, repo, currentBranch, githubToken);
    } catch (treeErr: unknown) {
      if (
        defaultBranch &&
        defaultBranch !== currentBranch &&
        treeErr instanceof GitHubError &&
        treeErr.status === 404
      ) {
        console.warn(
          `Branch "${currentBranch}" not found for ${owner}/${repo}; falling back to default branch "${defaultBranch}".`
        );
        currentBranch = defaultBranch;
        fileEntries = await fetchGitHubRepoTree(owner, repo, currentBranch, githubToken);
      } else {
        throw treeErr;
      }
    }

    const commits = await fetchGitHubCommits(owner, repo, currentBranch, githubToken, 50);

    if (fileEntries.length === 0) {
      await prisma.predictionRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          errorMessage: 'Repository contains no supported source code files for analysis.',
        },
      });
      return;
    }

    // 2. Metrics Extraction
    await prisma.predictionRun.update({
      where: { id: runId },
      data: { status: 'EXTRACTING_METRICS' },
    });

    const filesToAnalyze = fileEntries.slice(0, 50);
    const repoFiles: RepoSourceFile[] = [];

    // Fetch file contents in controlled batches of 5
    for (let i = 0; i < filesToAnalyze.length; i += 5) {
      const batch = filesToAnalyze.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(async (entry) => {
          try {
            const content = await fetchGitHubFileContent(
              owner,
              repo,
              entry.path,
              currentBranch,
              githubToken
            );
            return {
              path: entry.path,
              content,
              language: detectLanguage(entry.path),
            };
          } catch {
            return {
              path: entry.path,
              content: '',
              language: detectLanguage(entry.path),
            };
          }
        })
      );
      repoFiles.push(...batchResults.filter((f) => f.content.length > 0));
    }

    // Aggregate complexity and commit churn into unified feature vectors and persist to D2
    const aggregatedMetrics = await aggregateRepositoryMetrics(repoFiles, commits, {
      repoId,
      persistToDatabase: true,
    });

    // 3. ML Defect Prediction & Risk Assessment
    await prisma.predictionRun.update({
      where: { id: runId },
      data: { status: 'PREDICTING' },
    });

    const predictionResults = await BugPredictor.predictAndRank(aggregatedMetrics, {
      repoId,
      modelType: selectedModel,
      persistToDatabase: false,
    });

    // 4. Run NVIDIA NIM semantic LLM inspection on top ranked modules (with SHA-256 caching)
    const defectsByPath = new Map<string, CodeDefectItem[]>();
    const inspectedFiles = new Set<string>();
    const fileContentMap = new Map(repoFiles.map((f) => [f.path, f]));
    const topPredictions = predictionResults.predictions.slice(0, 8);

    for (const pred of topPredictions) {
      const file = fileContentMap.get(pred.filePath);
      if (!file || !file.content) continue;

      try {
        const inspection = await inspectFileWithNvidia(
          file.path,
          file.content,
          file.language,
          { apiKey: nvidiaApiKey }
        );
        inspectedFiles.add(file.path);
        if (inspection.defects.length > 0) {
          defectsByPath.set(file.path, inspection.defects);
        }
      } catch (err) {
        console.warn(`[NVIDIA Pipeline] Defect inspection error on ${file.path}:`, err);
      }
    }

    // Fast static AST fallback ONLY for remaining files not evaluated by NVIDIA
    for (const file of repoFiles) {
      if (!inspectedFiles.has(file.path) && !defectsByPath.has(file.path)) {
        const found = inspectCodeForDefects(file.path, file.content, file.language);
        if (found.length > 0) {
          defectsByPath.set(file.path, found);
        }
      }
    }

    // Verify and calibrate accurate 1-based line numbers against raw file content
    for (const [filePath, defects] of defectsByPath.entries()) {
      const file = fileContentMap.get(filePath);
      if (file && file.content) {
        const calibrated = defects.map((d) => ({
          ...d,
          lineNumber: resolveAccurateLineNumber(file.content, d.buggyCodeSnippet, d.lineNumber),
        }));
        defectsByPath.set(filePath, calibrated);
      }
    }

    // Save predictions and concrete code defects to PostgreSQL D3
    await prisma.filePrediction.createMany({
      data: predictionResults.predictions.map((pred) => ({
        runId,
        filePath: pred.filePath,
        defectProbability: pred.defectProbability,
        riskLevel: pred.riskLevel as RiskLevel,
        riskRank: pred.rank,
        defects: defectsByPath.get(pred.filePath) ? (defectsByPath.get(pred.filePath) as any) : undefined,
      })),
    });

    // 4. Finalize PredictionRun with summary stats
    await prisma.predictionRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        totalFiles: predictionResults.totalFiles,
        defectProneCount: predictionResults.defectProneCount,
        averageComplexity: predictionResults.averageComplexity,
        totalChurnLines: predictionResults.totalChurnLines,
        completedAt: new Date(),
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Analysis pipeline failed for run ${runId}:`, errorMsg);
    await prisma.predictionRun
      .update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          errorMessage: errorMsg,
        },
      })
      .catch(() => null);
  }
}

export async function POST(req: Request) {
  try {
    // 0. Authentication Guard: user must be signed in to analyze repositories
    const currentUser = await getCurrentUser(req).catch(() => null);
    if (!currentUser) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please sign in to analyze repositories.',
          },
        },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Malformed or missing JSON request body',
          },
        },
        { status: 422 }
      );
    }
    const parseResult = AnalyzeRepoSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid repository submission parameters',
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const { repoUrl, githubToken, branch, selectedModel, nvidiaApiKey } = parseResult.data;

    // 1. Parse repository URL
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid GitHub URL. Must be a valid github.com repository URL or owner/repo format.',
          },
        },
        { status: 422 }
      );
    }

    const { owner, repo } = parsed;

    // 2. Fetch repository metadata from GitHub
    let meta;
    try {
      meta = await fetchGitHubRepoMetadata(owner, repo, githubToken);
    } catch (err: unknown) {
      if (err instanceof GitHubError) {
        const responseCode = err.code === 'NETWORK_ERROR' ? 'SERVICE_UNAVAILABLE' : err.code;
        return NextResponse.json(
          {
            error: {
              code: responseCode,
              message: err.message,
            },
          },
          { status: err.status }
        );
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        errMsg.toLowerCase().includes('rate limit') ||
        errMsg.toLowerCase().includes('too many requests') ||
        (err as any)?.code === 'RATE_LIMIT_EXCEEDED' ||
        (err as any)?.status === 429;
      const isForbidden =
        (err as any)?.code === 'FORBIDDEN' ||
        (!isRateLimit &&
          ((err as any)?.status === 403 ||
            errMsg.toLowerCase().includes('forbidden') ||
            errMsg.toLowerCase().includes('saml')));
      const isAuth =
        errMsg.toLowerCase().includes('unauthorized') ||
        errMsg.toLowerCase().includes('bad credentials') ||
        (err as any)?.status === 401;
      const isNetwork =
        errMsg.toLowerCase().includes('fetch failed') ||
        errMsg.toLowerCase().includes('enotfound') ||
        errMsg.toLowerCase().includes('network') ||
        errMsg.toLowerCase().includes('econnrefused') ||
        errMsg.toLowerCase().includes('timeout') ||
        (err as any)?.code === 'NETWORK_ERROR' ||
        (err as any)?.status === 503;
      const isNotFound =
        !isNetwork &&
        (errMsg.toLowerCase().includes('not found') ||
          errMsg.includes('404') ||
          (err as any)?.code === 'NOT_FOUND' ||
          (err as any)?.status === 404);

      if (isRateLimit) {
        return NextResponse.json(
          {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: errMsg,
            },
          },
          { status: 403 }
        );
      }

      if (isForbidden) {
        return NextResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: errMsg || 'Access to GitHub repository is forbidden',
            },
          },
          { status: 403 }
        );
      }

      if (isAuth) {
        return NextResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: errMsg,
            },
          },
          { status: 401 }
        );
      }

      if (isNetwork) {
        return NextResponse.json(
          {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: `Network failure connecting to GitHub API: ${errMsg}`,
            },
          },
          { status: 503 }
        );
      }

      if (isNotFound) {
        return NextResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: errMsg,
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: errMsg || 'Failed to inspect GitHub repository',
          },
        },
        { status: 500 }
      );
    }

    const activeBranch = branch || meta.defaultBranch || 'main';

    // 4. Upsert Repository in PostgreSQL D2 (preserving existing owner if already set)
    const existingRepo = await prisma.repository.findUnique({
      where: {
        owner_name: {
          owner: meta.owner,
          name: meta.repo,
        },
      },
    });

    const repository = await prisma.repository.upsert({
      where: {
        owner_name: {
          owner: meta.owner,
          name: meta.repo,
        },
      },
      update: {
        url: `https://github.com/${meta.owner}/${meta.repo}`,
        defaultBranch: activeBranch,
        isPrivate: meta.isPrivate,
        lastAnalyzedAt: new Date(),
        userId: existingRepo?.userId ?? currentUser?.id ?? null,
      },
      create: {
        owner: meta.owner,
        name: meta.repo,
        url: `https://github.com/${meta.owner}/${meta.repo}`,
        defaultBranch: activeBranch,
        isPrivate: meta.isPrivate,
        lastAnalyzedAt: new Date(),
        userId: currentUser?.id ?? null,
      },
    });

    // 5. Create initial PredictionRun in D3 in QUEUED status
    const run = await prisma.predictionRun.create({
      data: {
        repoId: repository.id,
        modelType: selectedModel,
        status: 'QUEUED',
      },
    });

    // 6. Launch pipeline asynchronously in background
    runAnalysisPipeline(
      run.id,
      repository.id,
      meta.owner,
      meta.repo,
      activeBranch,
      selectedModel as MLModelType,
      githubToken,
      nvidiaApiKey,
      meta.defaultBranch
    );

    // 7. Return 202 Accepted immediately
    return NextResponse.json(
      {
        analysisId: run.id,
        repo: {
          id: repository.id,
          owner: meta.owner,
          name: meta.repo,
          url: `https://github.com/${meta.owner}/${meta.repo}`,
          defaultBranch: activeBranch,
        },
        status: 'QUEUED',
        statusUrl: `/api/repos/analysis/${run.id}`,
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Analysis pipeline internal error:', errorMsg);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected internal error occurred during analysis. Please try again later.',
        },
      },
      { status: 500 }
    );
  }
}
