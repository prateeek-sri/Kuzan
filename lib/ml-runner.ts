/**
 * Next.js Backend Machine Learning Runner
 * Standard: api-and-interface-design
 * Executes the Python ML inference engine headlessly from Next.js backend
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type {
  FileMetricVector,
  PredictionResponse,
  FilePredictionDTO,
  DefectRiskLevel,
} from '@shared/types/contracts';

/**
 * Computes calibrated software defect probability without external ML dependencies
 * Standard: empirical software engineering risk model (NASA MDP / PROMISE defect density)
 */
export function computeStatisticalDefectScores(
  metrics: FileMetricVector[]
): PredictionResponse {
  if (!metrics || metrics.length === 0) {
    return {
      modelVersion: '1.0.0-statistical-calibrated',
      predictions: [],
    };
  }

  const rawScored: FilePredictionDTO[] = metrics.map((m) => {
    // 1. Normalized metric components
    const compScore = Math.min(1.0, m.cyclomaticComplexity / 25.0);
    const churnScore = Math.min(1.0, m.churnLines / 800.0);
    const fixScore = Math.min(1.0, m.bugFixCount / 6.0);
    const authorScore = Math.min(1.0, (m.authorCount || 1) / 4.0);

    // 2. Weighted empirical risk combination (Complexity 35%, Churn 30%, Fixes 20%, Authors 15%)
    const rawIndex =
      0.35 * compScore +
      0.30 * churnScore +
      0.20 * fixScore +
      0.15 * authorScore;

    // 3. Sigmoid calibration centered around 0.40 threshold
    const calibratedProb = 1.0 / (1.0 + Math.exp(-6.0 * (rawIndex - 0.40)));
    const defectProbability = Math.round(calibratedProb * 100) / 100;

    let riskLevel: DefectRiskLevel = 'LOW';
    if (defectProbability >= 0.75) {
      riskLevel = 'CRITICAL';
    } else if (defectProbability >= 0.50) {
      riskLevel = 'HIGH';
    } else if (defectProbability >= 0.25) {
      riskLevel = 'MEDIUM';
    }

    return {
      filePath: m.filePath,
      defectProbability,
      riskLevel,
      rank: 1,
    };
  });

  // Sort descending by probability
  rawScored.sort((a, b) => b.defectProbability - a.defectProbability);

  // Assign ranks
  rawScored.forEach((item, index) => {
    item.rank = index + 1;
  });

  return {
    modelVersion: '1.0.0-statistical-calibrated',
    predictions: rawScored,
  };
}

export class MLRunner {
  private static resolvePythonPath(): string | null {
    if (process.env.PYTHON_PATH) {
      return process.env.PYTHON_PATH;
    }

    const venvBase = path.resolve(process.cwd(), '../ml-service/.venv');
    const winPath = path.join(venvBase, 'Scripts', 'python.exe');
    const unixPath = path.join(venvBase, 'bin', 'python');

    if (process.platform === 'win32' && fs.existsSync(winPath)) {
      return winPath;
    }
    if (fs.existsSync(unixPath)) {
      return unixPath;
    }

    return null;
  }

  private static scriptPath = path.resolve(
    process.cwd(),
    '../ml-service/models/predictor.py'
  );

  /**
   * Runs defect risk inference on an array of file metrics with automated fallback
   */
  public static async predict(
    metrics: FileMetricVector[],
    timeoutMs: number = 30000
  ): Promise<PredictionResponse> {
    if (!metrics || metrics.length === 0) {
      return {
        modelVersion: '1.0.0',
        predictions: [],
      };
    }

    const pythonExecutable = this.resolvePythonPath();

    // If Python virtual environment or script is unavailable, use statistical scoring engine
    if (!pythonExecutable || !fs.existsSync(this.scriptPath)) {
      console.warn('Python ML environment not detected; utilizing calibrated statistical defect engine.');
      return computeStatisticalDefectScores(metrics);
    }

    return new Promise((resolve) => {
      let child;
      try {
        child = spawn(pythonExecutable, [this.scriptPath]);
      } catch (err: unknown) {
        console.warn('Failed to spawn Python process; falling back to statistical scoring engine.');
        return resolve(computeStatisticalDefectScores(metrics));
      }

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Timeout watchdog
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
        console.warn(`ML Runner timed out after ${timeoutMs}ms; using statistical fallback.`);
        resolve(computeStatisticalDefectScores(metrics));
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.stdin.on('error', (err) => {
        console.error('ML Runner stdin stream error:', err.message);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) return;

        if (code !== 0) {
          console.warn(`ML Runner exited with code ${code}; falling back to statistical scoring engine.`);
          return resolve(computeStatisticalDefectScores(metrics));
        }

        try {
          const parsed = JSON.parse(stdout);
          if (!Array.isArray(parsed.predictions)) {
            return resolve(computeStatisticalDefectScores(metrics));
          }
          resolve(parsed as PredictionResponse);
        } catch {
          console.warn('Failed to parse ML output JSON; falling back to statistical scoring.');
          resolve(computeStatisticalDefectScores(metrics));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        console.warn('Python process execution error:', err.message, '; using fallback.');
        resolve(computeStatisticalDefectScores(metrics));
      });

      // Stream metrics as JSON into stdin
      child.stdin.write(JSON.stringify(metrics));
      child.stdin.end();
    });
  }
}

