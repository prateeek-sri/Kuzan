import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MLRunner, computeStatisticalDefectScores } from '../lib/ml-runner';
import type { FileMetricVector } from '../shared/types/contracts';

describe('Next.js Backend ML Runner Integration (TDD)', () => {
  it('computes calibrated statistical defect scores without external ML dependencies', () => {
    const sampleMetrics: FileMetricVector[] = [
      {
        filePath: 'src/payment_gateway.ts',
        loc: 450,
        sloc: 380,
        cyclomaticComplexity: 28.0,
        commitCount: 52,
        churnLines: 920,
        authorCount: 5,
        bugFixCount: 9,
      },
      {
        filePath: 'src/theme.ts',
        loc: 20,
        sloc: 18,
        cyclomaticComplexity: 1.0,
        commitCount: 2,
        churnLines: 10,
        authorCount: 1,
        bugFixCount: 0,
      },
    ];

    const result = computeStatisticalDefectScores(sampleMetrics);
    assert.equal(result.predictions.length, 2);

    const highRisk = result.predictions[0];
    const lowRisk = result.predictions[1];

    assert.equal(highRisk.filePath, 'src/payment_gateway.ts');
    assert.ok(highRisk.defectProbability > 0.7);
    assert.equal(highRisk.riskLevel, 'CRITICAL');
    assert.equal(highRisk.rank, 1);

    assert.equal(lowRisk.filePath, 'src/theme.ts');
    assert.ok(lowRisk.defectProbability < 0.25);
    assert.equal(lowRisk.riskLevel, 'LOW');
    assert.equal(lowRisk.rank, 2);
  });
  it('invokes Python ML engine and returns ranked defect predictions', async () => {
    const sampleMetrics: FileMetricVector[] = [
      {
        filePath: 'src/checkout.py',
        loc: 280,
        sloc: 220,
        cyclomaticComplexity: 22.0,
        commitCount: 38,
        churnLines: 540,
        authorCount: 4,
        bugFixCount: 7,
      },
      {
        filePath: 'src/constants.py',
        loc: 30,
        sloc: 25,
        cyclomaticComplexity: 1.0,
        commitCount: 3,
        churnLines: 15,
        authorCount: 1,
        bugFixCount: 0,
      },
    ];

    const result = await MLRunner.predict(sampleMetrics);

    assert.ok(result.modelVersion);
    assert.equal(result.predictions.length, 2);

    // Verify ordering by defect probability
    const top = result.predictions[0];
    const bottom = result.predictions[1];

    assert.equal(top.filePath, 'src/checkout.py');
    assert.ok(top.defectProbability > bottom.defectProbability);
    assert.equal(top.rank, 1);
    assert.equal(bottom.rank, 2);
  });

  it('handles empty input gracefully', async () => {
    const result = await MLRunner.predict([]);
    assert.equal(result.predictions.length, 0);
  });
});

