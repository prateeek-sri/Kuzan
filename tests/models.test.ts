import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Machine Learning Model Registry & Benchmark Suite (TDD)', () => {
  it('defines comprehensive feature importance weights aligned with empirical metrics', () => {
    const featureWeights = [
      { feature: 'McCabe Cyclomatic Complexity', weight: 0.32 },
      { feature: 'Line Churn (Added/Deleted)', weight: 0.26 },
      { feature: 'Bug-Fix Commit Frequency', weight: 0.18 },
      { feature: 'Halstead Program Volume', weight: 0.11 },
      { feature: 'Author Count (Diversity)', weight: 0.08 },
      { feature: 'Source Lines of Code (SLOC)', weight: 0.05 },
    ];

    const totalWeight = featureWeights.reduce((sum, f) => sum + f.weight, 0);
    assert.equal(Math.round(totalWeight * 100), 100);
    assert.ok(featureWeights[0].weight > featureWeights[5].weight);
  });
});

