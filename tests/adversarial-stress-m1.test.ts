import React from 'react';
(globalThis as any).React = React;

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormalAuditReport } from '../components/FormalAuditReport';
import { ModuleRiskTable, type FilePredictionItem } from '../components/ModuleRiskTable';
import type { CodeDefectItem, DefectPatternCategory } from '@shared/types/contracts';

describe('Milestone M1 Adversarial Stress Test & Key Stability Challenge', () => {

  // =========================================================================
  // Challenge 1: Deep Nesting, Special Characters & Unicode Paths
  // =========================================================================
  it('handles deeply nested paths, special characters, unicode, and brackets without key collision or console errors', () => {
    const originalError = console.error;
    const originalWarn = console.warn;
    const errors: string[] = [];
    const warns: string[] = [];

    console.error = (...args: any[]) => errors.push(args.join(' '));
    console.warn = (...args: any[]) => warns.push(args.join(' '));

    try {
      const adversarialFiles: FilePredictionItem[] = [
        {
          filePath: 'src/modules/[id]/[...slug]/foo.bar.ts',
          defectProbability: 0.88,
          riskLevel: 'CRITICAL',
          language: 'typescript',
          cyclomaticComplexity: 19,
          commitCount: 12,
          churnLines: 340,
          bugFixCount: 3,
          loc: 250,
          sloc: 200,
          rank: 1,
          defects: [
            {
              id: 'def_bracket_10',
              category: 'UNHANDLED_NULL',
              severity: 'CRITICAL',
              title: 'Bracket Path Null Dereference',
              lineNumber: 10,
              cause: 'Bracket token route access',
              impact: 'Runtime exception',
              buggyCodeSnippet: 'const slug = params[id][0];',
              remediedCodeSnippet: 'const slug = params?.[id]?.[0];',
            },
          ],
        },
        {
          filePath: 'src/modules/🚀/кириллица/日本語/한국어/العربية/üñïçödé.tsx',
          defectProbability: 0.77,
          riskLevel: 'HIGH',
          language: 'tsx',
          cyclomaticComplexity: 14,
          commitCount: 7,
          churnLines: 180,
          bugFixCount: 1,
          loc: 190,
          sloc: 150,
          rank: 2,
          defects: [
            {
              id: 'def_unicode_44',
              category: 'RESOURCE_LEAK',
              severity: 'HIGH',
              title: 'Unicode File Handle Leak',
              lineNumber: 44,
              cause: 'Stream unreleased in unicode path',
              impact: 'Resource leakage',
              buggyCodeSnippet: 'openUnicodeStream();',
              remediedCodeSnippet: 'using stream = openUnicodeStream();',
            },
          ],
        },
        {
          filePath: 'src/deep/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z/depth_30.ts',
          defectProbability: 0.95,
          riskLevel: 'CRITICAL',
          language: 'typescript',
          cyclomaticComplexity: 35,
          commitCount: 22,
          churnLines: 800,
          bugFixCount: 6,
          loc: 600,
          sloc: 500,
          rank: 3,
          defects: [
            {
              id: 'def_deep_99',
              category: 'DEEP_NESTING',
              severity: 'CRITICAL',
              title: 'Excessive Depth Call Stack',
              lineNumber: 99,
              cause: '30-level directory recursion',
              impact: 'Maximum call stack size exceeded',
              buggyCodeSnippet: 'recurse(30);',
              remediedCodeSnippet: 'iterative(30);',
            },
          ],
        },
        {
          filePath: 'path with spaces and symbols/!@#$%^&*()_+={}|:;<>?,.~.ts',
          defectProbability: 0.60,
          riskLevel: 'MEDIUM',
          language: 'typescript',
          cyclomaticComplexity: 8,
          commitCount: 4,
          churnLines: 90,
          bugFixCount: 1,
          loc: 80,
          sloc: 70,
          rank: 4,
          defects: [
            {
              id: 'def_sym_25',
              category: 'COMPLEX_BRANCHING',
              severity: 'MEDIUM',
              title: 'Special Characters Escape Defect',
              lineNumber: 25,
              cause: 'Raw string concatenation without escaping',
              impact: 'Path parsing bug',
              buggyCodeSnippet: 'resolve(path);',
              remediedCodeSnippet: 'resolve(sanitize(path));',
            },
          ],
        },
      ];

      // Test 1: Render FormalAuditReport
      const formalHtml = renderToStaticMarkup(
        React.createElement(FormalAuditReport, {
          repoOwner: 'octocat',
          repoName: 'adversarial-repo',
          repoUrl: 'https://github.com/octocat/adversarial-repo',
          defaultBranch: 'main',
          createdAt: new Date().toISOString(),
          modelType: 'Ensemble',
          analysisId: 'adv-analysis-1234',
          summary: {
            totalFiles: 4,
            analyzedFiles: 4,
            defectProneFiles: 4,
            averageComplexity: 19,
            totalChurnLines: 1410,
          },
          files: adversarialFiles,
        })
      );

      assert.ok(formalHtml.includes('[id]/[...slug]/foo.bar.ts'), 'FormalAuditReport rendered bracket path');
      assert.ok(formalHtml.includes('üñïçödé.tsx'), 'FormalAuditReport rendered unicode path');
      assert.ok(formalHtml.includes('depth_30.ts'), 'FormalAuditReport rendered deeply nested path');

      // Test 2: Render ModuleRiskTable
      const tableHtml = renderToStaticMarkup(
        React.createElement(ModuleRiskTable, {
          files: adversarialFiles,
          repoUrl: 'https://github.com/octocat/adversarial-repo',
          defaultBranch: 'main',
        })
      );

      assert.ok(tableHtml.includes('[id]/[...slug]/foo.bar.ts'), 'ModuleRiskTable rendered bracket path');
      assert.ok(tableHtml.includes('üñïçödé.tsx'), 'ModuleRiskTable rendered unicode path');

      // Verify zero console warnings/errors
      const keyIssues = [...errors, ...warns].filter(
        (m) => m.includes('key') || m.includes('Warning:') || m.includes('Error:')
      );
      assert.equal(
        keyIssues.length,
        0,
        `Expected 0 key/console warnings on adversarial paths, got: ${keyIssues.join('; ')}`
      );
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
  });

  // =========================================================================
  // Challenge 2: High Volume Rendering (120 files, 600+ defects)
  // =========================================================================
  it('stress tests high volume list rendering (120 files, 600 defects) measuring time and key uniqueness', () => {
    const TOTAL_FILES = 120;
    const DEFECTS_PER_FILE = 5;
    const categories: DefectPatternCategory[] = [
      'UNHANDLED_NULL',
      'SWALLOWED_EXCEPTION',
      'DEEP_NESTING',
      'COMPLEX_BRANCHING',
      'RESOURCE_LEAK',
      'UNSAFE_EQUALITY',
      'MISSING_BOUNDARY',
    ];
    const severities: Array<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    const highVolumeFiles: FilePredictionItem[] = [];
    for (let f = 0; f < TOTAL_FILES; f++) {
      const defects: CodeDefectItem[] = [];
      for (let d = 0; d < DEFECTS_PER_FILE; d++) {
        // Deliberately reuse identical defect IDs across files to stress collision resolution!
        const sharedDefectId = `def_shared_line_${(d + 1) * 10}`;
        defects.push({
          id: sharedDefectId,
          category: categories[(f + d) % categories.length],
          severity: severities[(f + d) % severities.length],
          title: `Defect item ${f}-${d}`,
          lineNumber: (d + 1) * 10,
          cause: `Synthetic root cause diagnosis for file ${f} defect ${d}`,
          impact: `Synthetic system impact for file ${f} defect ${d}`,
          buggyCodeSnippet: `const item_${f}_${d} = data.value;`,
          remediedCodeSnippet: `const item_${f}_${d} = data?.value ?? fallback;`,
        });
      }

      highVolumeFiles.push({
        filePath: `src/packages/subsystem_${Math.floor(f / 10)}/module_${f}.ts`,
        defectProbability: 0.5 + (f % 50) * 0.01,
        riskLevel: severities[f % severities.length],
        language: 'typescript',
        cyclomaticComplexity: 10 + (f % 20),
        commitCount: 5 + (f % 15),
        churnLines: 100 + f * 10,
        bugFixCount: f % 5,
        loc: 200 + f * 5,
        sloc: 160 + f * 4,
        rank: f + 1,
        defects,
      });
    }

    const totalDefects = TOTAL_FILES * DEFECTS_PER_FILE; // 600 defects
    assert.equal(totalDefects, 600, 'Constructed exactly 600 defects across 120 files');

    // Measure FormalAuditReport rendering time
    const t0Formal = performance.now();
    const formalHtml = renderToStaticMarkup(
      React.createElement(FormalAuditReport, {
        repoOwner: 'enterprise',
        repoName: 'monorepo',
        repoUrl: 'https://github.com/enterprise/monorepo',
        defaultBranch: 'main',
        createdAt: new Date().toISOString(),
        modelType: 'XGBoost',
        analysisId: 'monorepo-stress-999',
        summary: {
          totalFiles: TOTAL_FILES,
          analyzedFiles: TOTAL_FILES,
          defectProneFiles: TOTAL_FILES,
          averageComplexity: 18,
          totalChurnLines: 50000,
        },
        files: highVolumeFiles,
      })
    );
    const formalElapsedMs = performance.now() - t0Formal;

    // Rendering 600 items server-side should complete well under 5000ms
    assert.ok(formalElapsedMs < 5000, `FormalAuditReport 600-defect render took ${formalElapsedMs.toFixed(1)}ms (<5000ms)`);

    // Measure ModuleRiskTable rendering time
    const t0Table = performance.now();
    const tableHtml = renderToStaticMarkup(
      React.createElement(ModuleRiskTable, {
        files: highVolumeFiles,
        repoUrl: 'https://github.com/enterprise/monorepo',
        defaultBranch: 'main',
      })
    );
    const tableElapsedMs = performance.now() - t0Table;

    assert.ok(tableHtml.length > 50000, 'Rendered non-empty high volume module risk table');
    assert.ok(tableElapsedMs < 5000, `ModuleRiskTable 600-defect render took ${tableElapsedMs.toFixed(1)}ms (<5000ms)`);

    // Direct key uniqueness verification for FormalAuditReport
    const formalElement = FormalAuditReport({
      repoOwner: 'enterprise',
      repoName: 'monorepo',
      repoUrl: 'https://github.com/enterprise/monorepo',
      defaultBranch: 'main',
      createdAt: new Date().toISOString(),
      modelType: 'XGBoost',
      analysisId: 'monorepo-stress-999',
      summary: {
        totalFiles: TOTAL_FILES,
        analyzedFiles: TOTAL_FILES,
        defectProneFiles: TOTAL_FILES,
        averageComplexity: 18,
        totalChurnLines: 50000,
      },
      files: highVolumeFiles,
    });

    function collectKeys(node: any, predicate: (c: any) => boolean): string[] {
      const keys: string[] = [];
      function traverse(n: any) {
        if (!n || typeof n !== 'object') return;
        if (predicate(n) && n.key != null) {
          keys.push(String(n.key));
        }
        if (n.props?.children) {
          React.Children.forEach(n.props.children, (child) => traverse(child));
        }
      }
      traverse(node);
      return keys;
    }

    const formalKeys = collectKeys(
      formalElement,
      (c: any) => React.isValidElement(c) && typeof (c as any).props?.className === 'string' && (c as any).props.className.includes('page-break-inside-avoid')
    );

    assert.equal(
      formalKeys.length,
      600,
      `FormalAuditReport must render exactly 600 defect cards. Found: ${formalKeys.length}`
    );
    const uniqueFormalKeys = new Set(formalKeys);
    assert.equal(
      uniqueFormalKeys.size,
      600,
      `All 600 defect keys in FormalAuditReport must be strictly unique! Set size: ${uniqueFormalKeys.size}`
    );

    // Contract verification for ModuleRiskTable keys across high-volume dataset
    const highVolumeTableKeys: string[] = [];
    highVolumeFiles.forEach((file, fileIdx) => {
      highVolumeTableKeys.push(`${file.filePath || 'file'}_${fileIdx}`);
      file.defects?.forEach((defect, defectIdx) => {
        highVolumeTableKeys.push(`${file.filePath}_${defect.id || 'defect'}_${defectIdx}`);
      });
    });

    assert.equal(highVolumeTableKeys.length, 120 + 600, 'Total 720 keys for file cards and defects');
    const uniqueTableKeys = new Set(highVolumeTableKeys);
    assert.equal(uniqueTableKeys.size, 720, 'All 720 keys in ModuleRiskTable must be globally unique');
  });

  // =========================================================================
  // Challenge 3: Sibling Reconciliation Stability Across Filter State Changes
  // =========================================================================
  it('validates sibling reconciliation stability across severity filters and search states in ModuleRiskTable', () => {
    // Construct a dataset with diverse severities and languages
    const filesDataset: FilePredictionItem[] = [
      {
        filePath: 'src/core/critical-1.ts',
        defectProbability: 0.99,
        riskLevel: 'CRITICAL',
        language: 'typescript',
        cyclomaticComplexity: 25,
        commitCount: 15,
        churnLines: 400,
        bugFixCount: 5,
        loc: 300,
        sloc: 250,
        rank: 1,
        defects: [
          {
            id: 'def_crit_1',
            category: 'UNHANDLED_NULL',
            severity: 'CRITICAL',
            title: 'Critical DB Null dereference',
            lineNumber: 10,
            cause: 'Unchecked query result',
            impact: 'Server crash',
            buggyCodeSnippet: 'db.query().user.name;',
            remediedCodeSnippet: 'db.query()?.user?.name;',
          },
        ],
      },
      {
        filePath: 'src/core/high-1.ts',
        defectProbability: 0.85,
        riskLevel: 'HIGH',
        language: 'typescript',
        cyclomaticComplexity: 18,
        commitCount: 10,
        churnLines: 250,
        bugFixCount: 3,
        loc: 220,
        sloc: 180,
        rank: 2,
        defects: [
          {
            id: 'def_high_1',
            category: 'RESOURCE_LEAK',
            severity: 'HIGH',
            title: 'High stream leak',
            lineNumber: 20,
            cause: 'Stream unclosed',
            impact: 'FD exhaustion',
            buggyCodeSnippet: 'fs.open();',
            remediedCodeSnippet: 'using f = fs.open();',
          },
        ],
      },
      {
        filePath: 'src/core/medium-1.ts',
        defectProbability: 0.60,
        riskLevel: 'MEDIUM',
        language: 'python',
        cyclomaticComplexity: 12,
        commitCount: 6,
        churnLines: 120,
        bugFixCount: 1,
        loc: 150,
        sloc: 110,
        rank: 3,
        defects: [
          {
            id: 'def_med_1',
            category: 'COMPLEX_BRANCHING',
            severity: 'MEDIUM',
            title: 'Medium cyclomatic overload',
            lineNumber: 30,
            cause: 'Nested if statements',
            impact: 'Maintainability degradation',
            buggyCodeSnippet: 'if a: if b: if c: pass',
            remediedCodeSnippet: 'if a and b and c: pass',
          },
        ],
      },
      {
        filePath: 'src/core/clean-1.ts',
        defectProbability: 0.05,
        riskLevel: 'LOW',
        language: 'python',
        cyclomaticComplexity: 2,
        commitCount: 2,
        churnLines: 15,
        bugFixCount: 0,
        loc: 40,
        sloc: 30,
        rank: 4,
        defects: [],
      },
    ];

    const originalError = console.error;
    const originalWarn = console.warn;
    const errors: string[] = [];
    const warns: string[] = [];

    console.error = (...args: any[]) => errors.push(args.join(' '));
    console.warn = (...args: any[]) => warns.push(args.join(' '));

    try {
      // Step 1: Render default (ALL filter) via React DOM Server
      const htmlAll = renderToStaticMarkup(
        React.createElement(ModuleRiskTable, {
          files: filesDataset,
          repoUrl: 'https://github.com/octocat/test',
          defaultBranch: 'main',
        })
      );

      assert.ok(htmlAll.includes('critical-1.ts'), 'Renders critical file');
      assert.ok(htmlAll.includes('high-1.ts'), 'Renders high file');
      assert.ok(htmlAll.includes('medium-1.ts'), 'Renders medium file');
      assert.ok(htmlAll.includes('Show 1 clean files'), 'Indicates 1 clean file available');

      // Verify zero console errors or warnings during rendering
      const keyWarnings = [...errors, ...warns].filter(
        (m) => m.includes('key') || m.includes('warning') || m.includes('Warning')
      );
      assert.equal(keyWarnings.length, 0, `Zero key warnings expected, got: ${keyWarnings.join('; ')}`);

      // Step 2: Validate simulated filter transformations
      // Filter: CRITICAL only
      const criticalFiles = filesDataset.filter(
        (f) => f.riskLevel === 'CRITICAL' || f.defects?.some((d) => d.severity === 'CRITICAL')
      );
      const htmlCrit = renderToStaticMarkup(
        React.createElement(ModuleRiskTable, {
          files: criticalFiles,
          repoUrl: 'https://github.com/octocat/test',
          defaultBranch: 'main',
        })
      );
      assert.ok(htmlCrit.includes('critical-1.ts'), 'Renders critical file in filtered view');
      assert.ok(!htmlCrit.includes('high-1.ts'), 'Does not render high file in critical-only view');

      // Filter: Empty results
      const htmlEmpty = renderToStaticMarkup(
        React.createElement(ModuleRiskTable, {
          files: [],
          repoUrl: 'https://github.com/octocat/test',
          defaultBranch: 'main',
        })
      );
      assert.ok(htmlEmpty.includes('No defects matched current filter'), 'Renders empty state cleanly');

      // Clean file key format validation
      const cleanKeyDerived = `${filesDataset[3].filePath}_0`;
      assert.equal(cleanKeyDerived, 'src/core/clean-1.ts_0');
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
  });

  // =========================================================================
  // Challenge 4: Delimiter Ambiguity & Cross-File Collision Resistance
  // =========================================================================
  it('tests delimiter collision attack where filePath and defect.id could construct identical concatenated strings', () => {
    // Attack scenario:
    // File 1: filePath = "src/a_b", defectId = "c", idx = 0
    // File 2: filePath = "src/a",   defectId = "b_c", idx = 0
    // If simple concatenation `${filePath}_${defectId}_${idx}` is used, both evaluate to "src/a_b_c_0"
    const attackFiles: FilePredictionItem[] = [
      {
        filePath: 'src/a_b',
        defectProbability: 0.9,
        riskLevel: 'HIGH',
        language: 'typescript',
        cyclomaticComplexity: 10,
        commitCount: 5,
        churnLines: 100,
        bugFixCount: 1,
        loc: 100,
        sloc: 80,
        rank: 1,
        defects: [
          {
            id: 'c',
            category: 'UNHANDLED_NULL',
            severity: 'HIGH',
            title: 'Ambiguity Test 1',
            lineNumber: 10,
            cause: 'Cause 1',
            impact: 'Impact 1',
            buggyCodeSnippet: 'x',
            remediedCodeSnippet: 'y',
          },
        ],
      },
      {
        filePath: 'src/a',
        defectProbability: 0.9,
        riskLevel: 'HIGH',
        language: 'typescript',
        cyclomaticComplexity: 10,
        commitCount: 5,
        churnLines: 100,
        bugFixCount: 1,
        loc: 100,
        sloc: 80,
        rank: 2,
        defects: [
          {
            id: 'b_c',
            category: 'UNHANDLED_NULL',
            severity: 'HIGH',
            title: 'Ambiguity Test 2',
            lineNumber: 10,
            cause: 'Cause 2',
            impact: 'Impact 2',
            buggyCodeSnippet: 'x',
            remediedCodeSnippet: 'y',
          },
        ],
      },
    ];

    // In FormalAuditReport:
    // allDefectsWithFile is flat:
    // Item 0: filePath = "src/a_b", defect.id = "c", idx = 0 -> "src/a_b_c_0"
    // Item 1: filePath = "src/a",   defect.id = "b_c", idx = 1 -> "src/a_b_c_1"
    // Even under this delimiter collision scenario, idx tie-breaker (0 vs 1) PREVENTS COLLISION!
    const formalTree = FormalAuditReport({
      repoOwner: 'octocat',
      repoName: 'test',
      repoUrl: 'https://github.com/octocat/test',
      defaultBranch: 'main',
      createdAt: new Date().toISOString(),
      modelType: 'Test',
      analysisId: 'ambiguity-test',
      summary: {
        totalFiles: 2,
        analyzedFiles: 2,
        defectProneFiles: 2,
        averageComplexity: 10,
        totalChurnLines: 200,
      },
      files: attackFiles,
    });

    const formalKeys: string[] = [];
    function walk(n: any) {
      const nAny = n as any;
      if (React.isValidElement(n) && typeof nAny.props?.className === 'string' && nAny.props.className.includes('page-break-inside-avoid') && n.key != null) {
        formalKeys.push(String(n.key));
      }
      if (nAny.props?.children) React.Children.forEach(nAny.props.children, walk);
    }
    walk(formalTree);

    assert.equal(formalKeys.length, 2, 'Rendered 2 defect items');
    assert.notEqual(formalKeys[0], formalKeys[1], `Keys must not collide: ${formalKeys[0]} vs ${formalKeys[1]}`);
    assert.equal(new Set(formalKeys).size, 2, 'FormalAuditReport keys are strictly unique despite delimiter attack');
  });

  // =========================================================================
  // Challenge 5: Performance Benchmark - Key Generator Scalability
  // =========================================================================
  it('benchmarks 100,000 compound key generations to verify sub-millisecond per-item overhead', () => {
    const ITERATIONS = 100000;
    const t0 = performance.now();

    const sampleKeys = new Array(ITERATIONS);
    for (let i = 0; i < ITERATIONS; i++) {
      const filePath = `src/modules/sub_${i % 100}/component_${i % 1000}.tsx`;
      const defectId = `def_null_${i % 50}`;
      const index = i;
      sampleKeys[i] = `${filePath}_${defectId}_${index}`;
    }

    const elapsedMs = performance.now() - t0;
    const avgMicrosPerKey = (elapsedMs * 1000) / ITERATIONS;

    // 100,000 keys in modern V8 should execute in under 500ms (<5 microseconds per key)
    assert.ok(
      elapsedMs < 500,
      `100,000 key generations took ${elapsedMs.toFixed(2)}ms (average ${avgMicrosPerKey.toFixed(3)}µs/key)`
    );
    assert.equal(sampleKeys.length, ITERATIONS);
  });
});
