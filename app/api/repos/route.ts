import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const repositories = await prisma.repository.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        predictionRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const result = repositories.map((repo) => {
      const latestRun = repo.predictionRuns[0] || null;
      return {
        id: repo.id,
        owner: repo.owner,
        name: repo.name,
        url: repo.url,
        defaultBranch: repo.defaultBranch,
        lastAnalyzedAt: repo.lastAnalyzedAt?.toISOString() || null,
        latestRun: latestRun
          ? {
              id: latestRun.id,
              status: latestRun.status,
              modelType: latestRun.modelType,
              totalFiles: latestRun.totalFiles,
              defectProneCount: latestRun.defectProneCount,
              averageComplexity: latestRun.averageComplexity,
              createdAt: latestRun.createdAt.toISOString(),
            }
          : null,
      };
    });

    return NextResponse.json({ repositories: result }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to list repositories',
        },
      },
      { status: 500 }
    );
  }
}

