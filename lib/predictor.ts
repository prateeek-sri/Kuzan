/**
 * Bug Risk Prediction & Orchestration Service (DFD 0.4 BugPredictor)
 * Standard: api-and-interface-design & incremental-implementation
 */

import { MLRunner } from './ml-runner';
import { prisma } from './prisma';
import type { RiskLevel } from '@prisma/client';
import type {
  FileMetricVector,
  FilePredictionDTO,
  DefectRiskLevel,
  MLModelType,
} from '@shared/types/contracts';

export interface PredictOptions {
  repoId?: string;
  modelType?: MLModelType;
  persistToDatabase?: boolean;
}

export interface PredictionRunResult {
  runId?: string;
  repoId?: string;
  modelType: string;
  modelVersion: string;
  totalFiles: number;
  defectProneCount: number;
  averageComplexity: number;
  totalChurnLines: number;
  predictions: FilePredictionDTO[];
}

export class BugPredictor {
  /**
   * Executes defect prediction, computes aggregations, and saves to D3
   */
  public static async predictAndRank(
    metrics: FileMetricVector[],
    options: PredictOptions = {}
  ): Promise<PredictionRunResult> {
    if (!metrics || metrics.length === 0) {
      return {
        modelType: options.modelType ?? 'AutoSelectBest',
        modelVersion: '1.0.0',
        totalFiles: 0,
        defectProneCount: 0,
        averageComplexity: 0,
        totalChurnLines: 0,
        predictions: [],
      };
    }

    // 1. Run Machine Learning Inference
    const mlResponse = await MLRunner.predict(metrics);
    const predictions = mlResponse.predictions;

    // 2. Compute aggregate repository metrics
    const totalFiles = metrics.length;
    const defectProneCount = predictions.filter(
      (p) => p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL'
    ).length;

    const totalComplexity = metrics.reduce((acc, m) => acc + m.cyclomaticComplexity, 0);
    const averageComplexity = Math.round((totalComplexity / totalFiles) * 10) / 10;
    const totalChurnLines = metrics.reduce((acc, m) => acc + m.churnLines, 0);

    let runId: string | undefined = undefined;

    // 3. Persist to PostgreSQL D3 Prediction DB if repoId is provided
    if (options.persistToDatabase && options.repoId) {
      const repoId = options.repoId;
      const modelType = options.modelType ?? 'AutoSelectBest';

      const run = await prisma.predictionRun.create({
        data: {
          repoId,
          modelType,
          modelVersion: mlResponse.modelVersion,
          status: 'COMPLETED',
          totalFiles,
          defectProneCount,
          averageComplexity,
          totalChurnLines,
          completedAt: new Date(),
          predictions: {
            create: predictions.map((p) => ({
              filePath: p.filePath,
              defectProbability: p.defectProbability,
              riskLevel: p.riskLevel as RiskLevel,
              riskRank: p.rank,
            })),
          },
        },
      });

      runId = run.id;
    }

    return {
      runId,
      repoId: options.repoId,
      modelType: options.modelType ?? 'AutoSelectBest',
      modelVersion: mlResponse.modelVersion,
      totalFiles,
      defectProneCount,
      averageComplexity,
      totalChurnLines,
      predictions,
    };
  }
}

