import React from 'react';
(globalThis as any).React = React;

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormalAuditReport } from '../components/FormalAuditReport';
import { ModuleRiskTable } from '../components/ModuleRiskTable';

describe('Defect List React Key Uniqueness & Console Health (TDD - M1)', () => {
  const mockFilesWithCollidingDefectIds = [
    {
      filePath: 'src/modules/auth.ts',
      defectProbability: 0.92,
      riskLevel: 'CRITICAL',
      language: 'typescript',
      cyclomaticComplexity: 22,
      commitCount: 14,
      churnLines: 410,
      bugFixCount: 4,
      loc: 320,
      sloc: 260,
      rank: 1,
      defects: [
        {
          id: 'def_null_22', // Colliding defect ID #1
          category: 'UNHANDLED_NULL' as const,
          severity: 'CRITICAL' as const,
          title: 'Unchecked Null Dereference',
          lineNumber: 22,
          cause: 'Direct nested property access without null guard',
          impact: 'TypeError runtime crash during token verification',
          buggyCodeSnippet: 'const user = session.user.profile.permissions;',
          remediedCodeSnippet: 'const user = session?.user?.profile?.permissions;',
        },
        {
          id: 'def_res_leak_45', // Colliding defect ID #2
          category: 'RESOURCE_LEAK' as const,
          severity: 'HIGH' as const,
          title: 'Unclosed Stream Connection',
          lineNumber: 45,
          cause: 'Buffer handle not released in finally block',
          impact: 'Memory accumulation over sustained requests',
          buggyCodeSnippet: 'const stream = fs.createReadStream(path);',
          remediedCodeSnippet: 'using stream = fs.createReadStream(path);',
        },
      ],
    },
    {
      filePath: 'src/modules/billing.ts',
      defectProbability: 0.81,
      riskLevel: 'HIGH',
      language: 'typescript',
      cyclomaticComplexity: 16,
      commitCount: 8,
      churnLines: 230,
      bugFixCount: 2,
      loc: 210,
      sloc: 175,
      rank: 2,
      defects: [
        {
          id: 'def_null_22', // Colliding defect ID #1 identical to auth.ts
          category: 'UNHANDLED_NULL' as const,
          severity: 'HIGH' as const,
          title: 'Unchecked Null Dereference',
          lineNumber: 22,
          cause: 'Invoice customer field read before validation',
          impact: 'Cannot read properties of undefined',
          buggyCodeSnippet: 'const taxRate = invoice.customer.taxProfile.rate;',
          remediedCodeSnippet: 'const taxRate = invoice?.customer?.taxProfile?.rate ?? 0;',
        },
        {
          id: 'def_res_leak_45', // Colliding defect ID #2 identical to auth.ts
          category: 'RESOURCE_LEAK' as const,
          severity: 'HIGH' as const,
          title: 'Payment Gateway Client Not Disposed',
          lineNumber: 45,
          cause: 'HTTP client pool not disconnected on error',
          impact: 'TCP socket exhaustion',
          buggyCodeSnippet: 'const client = new StripeClient(key);',
          remediedCodeSnippet: 'try { ... } finally { await client.destroy(); }',
        },
      ],
    },
    {
      filePath: 'src/services/telemetry.ts',
      defectProbability: 0.65,
      riskLevel: 'MEDIUM',
      language: 'typescript',
      cyclomaticComplexity: 11,
      commitCount: 5,
      churnLines: 115,
      bugFixCount: 1,
      loc: 140,
      sloc: 110,
      rank: 3,
      defects: [
        {
          id: 'def_res_leak_45', // Colliding defect ID #2 appearing in a 3rd file
          category: 'RESOURCE_LEAK' as const,
          severity: 'MEDIUM' as const,
          title: 'Unflushed Telemetry Batch',
          lineNumber: 45,
          cause: 'Batch buffer dropped during process SIGTERM',
          impact: 'Telemetry data drop',
          buggyCodeSnippet: 'exporter.send(batch);',
          remediedCodeSnippet: 'await exporter.forceFlush();',
        },
      ],
    },
    {
      filePath: 'src/utils/helpers.ts',
      defectProbability: 0.12,
      riskLevel: 'LOW',
      language: 'typescript',
      cyclomaticComplexity: 3,
      commitCount: 2,
      churnLines: 20,
      bugFixCount: 0,
      loc: 50,
      sloc: 40,
      rank: 4,
      defects: [], // Clean file with zero defects
    },
  ];

  it('renders FormalAuditReport with colliding defect IDs without console errors or duplicate keys', () => {
    const originalError = console.error;
    const originalWarn = console.warn;
    const loggedErrors: string[] = [];
    const loggedWarns: string[] = [];

    console.error = (...args: any[]) => {
      loggedErrors.push(args.join(' '));
    };
    console.warn = (...args: any[]) => {
      loggedWarns.push(args.join(' '));
    };

    try {
      const html = renderToStaticMarkup(
        React.createElement(FormalAuditReport, {
          repoOwner: 'octocat',
          repoName: 'hello-world',
          repoUrl: 'https://github.com/octocat/hello-world',
          defaultBranch: 'main',
          createdAt: new Date().toISOString(),
          modelType: 'AutoSelectBest',
          analysisId: 'analysis-uuid-9876',
          summary: {
            totalFiles: 4,
            analyzedFiles: 4,
            defectProneFiles: 3,
            averageComplexity: 13,
            totalChurnLines: 775,
          },
          files: mockFilesWithCollidingDefectIds,
        })
      );

      // Verify HTML rendered cleanly
      assert.ok(html.length > 500, 'FormalAuditReport rendered non-empty markup');
      assert.ok(html.includes('src/modules/auth.ts'), 'HTML contains auth.ts path');
      assert.ok(html.includes('src/modules/billing.ts'), 'HTML contains billing.ts path');
      assert.ok(html.includes('src/services/telemetry.ts'), 'HTML contains telemetry.ts path');

      // Assert zero duplicate key console warnings
      const duplicateKeyWarnings = [...loggedErrors, ...loggedWarns].filter(
        (msg) =>
          msg.includes('same key') ||
          msg.includes('Encountered two children') ||
          msg.includes('duplicate key')
      );
      assert.equal(
        duplicateKeyWarnings.length,
        0,
        `Expected 0 duplicate key warnings, received: ${duplicateKeyWarnings.join('; ')}`
      );
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
  });

  it('verifies FormalAuditReport element keys are globally unique across all flattened defects', () => {
    // Directly invoke the component function to inspect the returned React element tree
    const element = FormalAuditReport({
      repoOwner: 'octocat',
      repoName: 'hello-world',
      repoUrl: 'https://github.com/octocat/hello-world',
      defaultBranch: 'main',
      createdAt: new Date().toISOString(),
      modelType: 'AutoSelectBest',
      analysisId: 'analysis-uuid-9876',
      summary: {
        totalFiles: 4,
        analyzedFiles: 4,
        defectProneFiles: 3,
        averageComplexity: 13,
        totalChurnLines: 775,
      },
      files: mockFilesWithCollidingDefectIds,
    });

    assert.ok(React.isValidElement(element), 'FormalAuditReport returned a valid React element');

    // Traverse element tree to extract children of the defect card container
    function findDefectCards(node: any): any[] {
      if (!node || typeof node !== 'object') return [];
      if (node.props?.className && typeof node.props.className === 'string' && node.props.className.includes('space-y-4')) {
        const children = React.Children.toArray(node.props.children);
        // Look for items with the diagnostic card class
        const cards = children.filter(
          (c: any) =>
            React.isValidElement(c) &&
            typeof (c as any).props?.className === 'string' &&
            (c as any).props.className.includes('page-break-inside-avoid')
        );
        if (cards.length > 0) return cards;
      }
      if (node.props?.children) {
        const children = React.Children.toArray(node.props.children);
        for (const child of children) {
          const found = findDefectCards(child);
          if (found.length > 0) return found;
        }
      }
      return [];
    }

    const defectCards = findDefectCards(element);
    assert.equal(
      defectCards.length,
      5,
      `Expected 5 total flattened defect cards across the 3 vulnerable files, got ${defectCards.length}`
    );

    const keys = defectCards.map((c: any) => c.key);
    const uniqueKeys = new Set(keys);

    assert.equal(
      uniqueKeys.size,
      defectCards.length,
      `All 5 defect cards must have distinct React keys. Got keys: ${JSON.stringify(keys)}`
    );

    // Verify key naming convention incorporates file path, defect ID, and index
    keys.forEach((key) => {
      assert.ok(typeof key === 'string' && key.length > 0, 'Key must be a non-empty string');
      assert.match(
        key,
        /_def_/,
        `Key "${key}" must contain defect category pattern prefix "_def_"`
      );
    });
  });

  it('renders ModuleRiskTable with colliding defect IDs without console warnings', () => {
    const originalError = console.error;
    const originalWarn = console.warn;
    const loggedErrors: string[] = [];
    const loggedWarns: string[] = [];

    console.error = (...args: any[]) => {
      loggedErrors.push(args.join(' '));
    };
    console.warn = (...args: any[]) => {
      loggedWarns.push(args.join(' '));
    };

    try {
      const html = renderToStaticMarkup(
        React.createElement(ModuleRiskTable, {
          files: mockFilesWithCollidingDefectIds,
          repoUrl: 'https://github.com/octocat/hello-world',
          defaultBranch: 'main',
        })
      );

      assert.ok(html.length > 500, 'ModuleRiskTable rendered non-empty markup');
      assert.ok(html.includes('src/modules/auth.ts'), 'HTML contains auth.ts path');
      assert.ok(html.includes('clean files'), 'HTML contains clean files indicator');

      const duplicateKeyWarnings = [...loggedErrors, ...loggedWarns].filter(
        (msg) =>
          msg.includes('same key') ||
          msg.includes('Encountered two children') ||
          msg.includes('duplicate key')
      );
      assert.equal(
        duplicateKeyWarnings.length,
        0,
        `Expected 0 duplicate key warnings, received: ${duplicateKeyWarnings.join('; ')}`
      );
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
  });

  it('verifies compound defect key derivation satisfies Interface Contract F1 & F2', () => {
    // Test the contract logic directly across files and indices
    const generatedKeys: string[] = [];
    mockFilesWithCollidingDefectIds.forEach((file, fileIdx) => {
      const fileCardKey = `${file.filePath || 'file'}_${fileIdx}`;
      generatedKeys.push(fileCardKey);

      file.defects?.forEach((defect, defectIdx) => {
        const defectItemKey = `${file.filePath}_${defect.id || 'defect'}_${defectIdx}`;
        generatedKeys.push(defectItemKey);
      });
    });

    const uniqueKeys = new Set(generatedKeys);
    assert.equal(
      uniqueKeys.size,
      generatedKeys.length,
      `All generated file and defect keys must be unique. Total keys: ${generatedKeys.length}`
    );

    // Verify collision resolution between auth.ts:def_null_22:0 and billing.ts:def_null_22:0
    const authNullKey = 'src/modules/auth.ts_def_null_22_0';
    const billingNullKey = 'src/modules/billing.ts_def_null_22_0';
    assert.ok(generatedKeys.includes(authNullKey), 'Should contain authNullKey');
    assert.ok(generatedKeys.includes(billingNullKey), 'Should contain billingNullKey');
    assert.notEqual(authNullKey, billingNullKey, 'Keys for colliding defect IDs across files must differ');
  });

  it('handles adversarial edge cases: duplicate IDs within the same file and missing properties safely', () => {
    const adversarialFiles = [
      {
        filePath: 'src/edge-case.ts',
        defectProbability: 0.99,
        riskLevel: 'CRITICAL',
        language: 'typescript',
        cyclomaticComplexity: 30,
        commitCount: 20,
        churnLines: 500,
        bugFixCount: 5,
        loc: 400,
        sloc: 350,
        rank: 1,
        defects: [
          // Same defect ID multiple times in the SAME file
          {
            id: 'def_null_22',
            category: 'UNHANDLED_NULL' as const,
            severity: 'CRITICAL' as const,
            title: 'Unchecked Null 1',
            lineNumber: 22,
            cause: 'Cause 1',
            impact: 'Impact 1',
            buggyCodeSnippet: 'a.b.c',
            remediedCodeSnippet: 'a?.b?.c',
          },
          {
            id: 'def_null_22', // Exact identical ID in the same file
            category: 'UNHANDLED_NULL' as const,
            severity: 'CRITICAL' as const,
            title: 'Unchecked Null 2',
            lineNumber: 22,
            cause: 'Cause 2',
            impact: 'Impact 2',
            buggyCodeSnippet: 'x.y.z',
            remediedCodeSnippet: 'x?.y?.z',
          },
          // Missing / undefined properties fallback test
          {
            id: '',
            category: 'RESOURCE_LEAK' as const,
            severity: 'HIGH' as const,
            title: 'Missing ID Defect',
            lineNumber: 100,
            cause: 'Empty ID string',
            impact: 'Resilience test',
            buggyCodeSnippet: 'bad()',
            remediedCodeSnippet: 'good()',
          },
        ],
      },
    ];

    const element = FormalAuditReport({
      repoOwner: 'test',
      repoName: 'test',
      repoUrl: 'https://github.com/test/test',
      defaultBranch: 'main',
      createdAt: new Date().toISOString(),
      modelType: 'AutoSelectBest',
      analysisId: 'adversarial-1',
      summary: {
        totalFiles: 1,
        analyzedFiles: 1,
        defectProneFiles: 1,
        averageComplexity: 30,
        totalChurnLines: 500,
      },
      files: adversarialFiles,
    });

    function findDefectCards(node: any): any[] {
      if (!node || typeof node !== 'object') return [];
      if (node.props?.className && typeof node.props.className === 'string' && node.props.className.includes('space-y-4')) {
        const children = React.Children.toArray(node.props.children);
        const cards = children.filter(
          (c: any) =>
            React.isValidElement(c) &&
            typeof (c as any).props?.className === 'string' &&
            (c as any).props.className.includes('page-break-inside-avoid')
        );
        if (cards.length > 0) return cards;
      }
      if (node.props?.children) {
        const children = React.Children.toArray(node.props.children);
        for (const child of children) {
          const found = findDefectCards(child);
          if (found.length > 0) return found;
        }
      }
      return [];
    }

    const cards = findDefectCards(element);
    assert.equal(cards.length, 3, 'Should render all 3 cards even with duplicate/empty defect IDs');

    const keys = cards.map((c: any) => c.key);
    const uniqueKeys = new Set(keys);
    assert.equal(
      uniqueKeys.size,
      3,
      `All 3 keys must be distinct even with duplicate IDs in the same file. Got: ${JSON.stringify(keys)}`
    );

    // Verify fallback does not produce empty or invalid keys
    keys.forEach((key) => {
      assert.ok(typeof key === 'string' && key.length > 0);
      assert.ok(!key.includes('undefined'));
    });
  });

  it('renders cleanly with 0 files or all-clean repositories', () => {
    const emptyHtml = renderToStaticMarkup(
      React.createElement(ModuleRiskTable, {
        files: [],
        repoUrl: 'https://github.com/octocat/hello-world',
        defaultBranch: 'main',
      })
    );
    assert.ok(emptyHtml.includes('No defects matched current filter'));
    assert.ok(emptyHtml.includes('All scanned modules passed defect inspection without violations.'));

    const allCleanFiles = [
      {
        filePath: 'src/clean1.ts',
        defectProbability: 0.05,
        riskLevel: 'LOW',
        language: 'typescript',
        cyclomaticComplexity: 2,
        commitCount: 1,
        churnLines: 10,
        bugFixCount: 0,
        loc: 30,
        sloc: 25,
        rank: 1,
        defects: [],
      },
      {
        filePath: 'src/clean2.ts',
        defectProbability: 0.08,
        riskLevel: 'LOW',
        language: 'typescript',
        cyclomaticComplexity: 4,
        commitCount: 2,
        churnLines: 15,
        bugFixCount: 0,
        loc: 45,
        sloc: 35,
        rank: 2,
        defects: [],
      },
    ];

    const cleanHtml = renderToStaticMarkup(
      React.createElement(ModuleRiskTable, {
        files: allCleanFiles,
        repoUrl: 'https://github.com/octocat/hello-world',
        defaultBranch: 'main',
      })
    );
    assert.ok(cleanHtml.includes('Show 2 clean files'));
  });
});
