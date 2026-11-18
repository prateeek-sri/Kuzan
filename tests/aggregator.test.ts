import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateRepositoryMetrics } from '../lib/metrics/aggregator';
import { BugPredictor } from '../lib/predictor';
import type { RepoSourceFile, CommitRecord } from '../shared/types/contracts';

describe('Metrics Aggregator & Bug Predictor Service (TDD)', () => {
  const sampleFiles: RepoSourceFile[] = [
    {
      path: 'src/checkout.py',
      content: `
def process_payment(amount, user, method):
    if amount <= 0:
        return False
    if method == "card":
        if user.is_verified:
            return charge_card(amount)
        return False
    elif method == "paypal":
        return charge_paypal(amount)
    return False
`,
      language: 'python',
    },
    {
      path: 'src/config.ts',
      content: `
export const API_URL = "https://api.example.com";
export const TIMEOUT = 5000;
`,
      language: 'typescript',
    },
  ];

  const sampleCommits: CommitRecord[] = [
    {
      hash: 'h1',
      message: 'feat: add checkout logic',
      author: 'alice',
      timestamp: '2026-10-01T10:00:00Z',
      filesChanged: [{ path: 'src/checkout.py', added: 40, deleted: 0 }],
    },
    {
      hash: 'h2',
      message: 'fix: resolve payment failure bug in checkout',
      author: 'bob',
      timestamp: '2026-10-05T12:00:00Z',
      filesChanged: [{ path: 'src/checkout.py', added: 12, deleted: 4 }],
    },
    {
      hash: 'h3',
      message: 'chore: add config constants',
      author: 'alice',
      timestamp: '2026-10-06T14:00:00Z',
      filesChanged: [{ path: 'src/config.ts', added: 5, deleted: 0 }],
    },
  ];

  it('aggregates static code complexity and commit churn into unified feature vectors', async () => {
    const metrics = await aggregateRepositoryMetrics(sampleFiles, sampleCommits, {
      persistToDatabase: false,
    });

    assert.equal(metrics.length, 2);

    const checkoutMetric = metrics.find((m) => m.filePath === 'src/checkout.py');
    assert.ok(checkoutMetric !== undefined);
    assert.ok(checkoutMetric.cyclomaticComplexity >= 5); // multiple if/elif branches
    assert.equal(checkoutMetric.commitCount, 2);
    assert.equal(checkoutMetric.churnLines, 56); // 40 + (12 + 4)
    assert.equal(checkoutMetric.authorCount, 2); // alice, bob
    assert.equal(checkoutMetric.bugFixCount, 1); // 1 fix commit

    const configMetric = metrics.find((m) => m.filePath === 'src/config.ts');
    assert.ok(configMetric !== undefined);
    assert.equal(configMetric.cyclomaticComplexity, 1); // no decision branches
    assert.equal(configMetric.commitCount, 1);
    assert.equal(configMetric.bugFixCount, 0);
  });

  it('runs bug prediction and ranks defect risk based on aggregated metrics', async () => {
    const metrics = await aggregateRepositoryMetrics(sampleFiles, sampleCommits, {
      persistToDatabase: false,
    });

    const result = await BugPredictor.predictAndRank(metrics, {
      persistToDatabase: false,
    });

    assert.equal(result.totalFiles, 2);
    assert.ok(result.averageComplexity > 0);
    assert.equal(result.predictions.length, 2);

    // src/checkout.py (complex, bug-prone) must rank higher than src/config.ts (simple)
    const top = result.predictions[0];
    const bottom = result.predictions[1];

    assert.equal(top.filePath, 'src/checkout.py');
    assert.equal(top.rank, 1);
    assert.equal(bottom.filePath, 'src/config.ts');
    assert.equal(bottom.rank, 2);
    assert.ok(top.defectProbability > bottom.defectProbability);
  });
});

