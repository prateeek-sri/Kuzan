import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractCommitChurnMetrics, isBugFixCommit } from '../lib/metrics/churn';
import type { CommitRecord } from '../shared/types/contracts';

describe('Git Commit & Churn Mining Engine (TDD)', () => {
  describe('Bug-Fix Semantic Commit Detection', () => {
    it('identifies bug fix commits using standard semantic commit messages', () => {
      assert.equal(isBugFixCommit('fix: resolve null pointer in user auth'), true);
      assert.equal(isBugFixCommit('bugfix(cart): correct pricing roundoff'), true);
      assert.equal(isBugFixCommit('Fixed issue #102 with database timeout'), true);
      assert.equal(isBugFixCommit('hotfix: patch memory leak in worker'), true);
      assert.equal(isBugFixCommit('defect: resolve defect in report generator'), true);
      assert.equal(isBugFixCommit('close #42: resolve error on logout'), true);
    });

    it('rejects regular feature, documentation, or refactor commits', () => {
      assert.equal(isBugFixCommit('feat: add user profile page'), false);
      assert.equal(isBugFixCommit('docs: update README with architecture diagrams'), false);
      assert.equal(isBugFixCommit('refactor: simplify metric extraction functions'), false);
      assert.equal(isBugFixCommit('chore: bump dependency versions'), false);
    });
  });

  describe('Churn & Author Mining per File', () => {
    it('computes commitCount, churnLines, authorCount, and bugFixCount per file', () => {
      const mockCommits: CommitRecord[] = [
        {
          hash: 'c1',
          message: 'feat: initial implementation of cart and auth',
          author: 'alice',
          timestamp: '2026-09-01T10:00:00Z',
          filesChanged: [
            { path: 'src/cart.py', added: 120, deleted: 0 },
            { path: 'src/auth.py', added: 80, deleted: 0 },
          ],
        },
        {
          hash: 'c2',
          message: 'fix: handle zero price bug in cart',
          author: 'bob',
          timestamp: '2026-09-05T12:00:00Z',
          filesChanged: [
            { path: 'src/cart.py', added: 15, deleted: 5 },
          ],
        },
        {
          hash: 'c3',
          message: 'refactor: clean up auth methods',
          author: 'charlie',
          timestamp: '2026-09-10T14:00:00Z',
          filesChanged: [
            { path: 'src/auth.py', added: 20, deleted: 10 },
          ],
        },
        {
          hash: 'c4',
          message: 'fix(cart): resolve issue #33 NaN discount error',
          author: 'alice',
          timestamp: '2026-09-15T16:00:00Z',
          filesChanged: [
            { path: 'src/cart.py', added: 8, deleted: 3 },
          ],
        },
      ];

      const metricsMap = extractCommitChurnMetrics(mockCommits);

      // Verify src/cart.py metrics
      const cartMetrics = metricsMap.get('src/cart.py');
      assert.ok(cartMetrics !== undefined);
      assert.equal(cartMetrics.commitCount, 3); // c1, c2, c4
      // churn = (120+0) + (15+5) + (8+3) = 151
      assert.equal(cartMetrics.churnLines, 151);
      assert.equal(cartMetrics.authorCount, 2); // alice, bob
      assert.equal(cartMetrics.bugFixCount, 2); // c2, c4

      // Verify src/auth.py metrics
      const authMetrics = metricsMap.get('src/auth.py');
      assert.ok(authMetrics !== undefined);
      assert.equal(authMetrics.commitCount, 2); // c1, c3
      assert.equal(authMetrics.churnLines, 110); // (80+0) + (20+10)
      assert.equal(authMetrics.authorCount, 2); // alice, charlie
      assert.equal(authMetrics.bugFixCount, 0); // No fix commits
    });

    it('handles empty commit logs safely', () => {
      const metricsMap = extractCommitChurnMetrics([]);
      assert.equal(metricsMap.size, 0);
    });
  });
});

