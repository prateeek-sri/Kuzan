import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccurateLineNumber } from '../lib/remediation/code-locator';
import {
  applyDefectFixesToSourceCode,
  generateUnifiedFileDiff,
  generateRepositoryPatch,
} from '../lib/remediation/patch-engine';
import type { CodeDefectItem } from '@shared/types/contracts';

describe('Accurate Code Locator & Patch Engine (TDD)', () => {
  describe('resolveAccurateLineNumber', () => {
    const sampleCode = `import React from 'react';

export function Login() {
  const [val, setVal] = React.useState('');

  const handleChange = (e) => {
    setVal(e.target.value);
  };

  return <input onChange={handleChange} />;
}`;

    test('locates exact line number for single expression snippet', () => {
      const line = resolveAccurateLineNumber(sampleCode, 'e.target.value', 1);
      assert.strictEqual(line, 7);
    });

    test('locates exact line number for multi-line block snippet', () => {
      const block = `const handleChange = (e) => {\n  setVal(e.target.value);\n};`;
      const line = resolveAccurateLineNumber(sampleCode, block, 1);
      assert.strictEqual(line, 6);
    });

    test('falls back gracefully when snippet cannot be matched in code', () => {
      const line = resolveAccurateLineNumber(sampleCode, 'nonExistentFunctionCall()', 42);
      assert.strictEqual(line, 42);
    });

    test('accurately locates openLogTime defect at line 410 in ClientPage context', () => {
      // Simulate snippet from ClientPage lines 405-415
      const clientPageHeader = new Array(405).fill('// leading code line').join('\n') + '\n';
      const openLogTimeBlock =
        '  const openLogTime = (id: string, dateStr: string) => {\n' + // Line 406
        '    if (dateStr !== iso(today())) return\n' +                  // Line 407
        '    const habit = initialHabits.find(h => h.id === id)\n' +    // Line 408
        '    if (!habit) return\n' +                                    // Line 409
        '    setLoggingTimeFor({ habitId: id, dateStr, currentMinutes: habit.completions[dateStr] || 0 })\n' + // Line 410
        '  }\n';

      const simulatedSource = clientPageHeader + openLogTimeBlock;
      const targetSnippet = 'setLoggingTimeFor({ habitId: id, dateStr, currentMinutes: habit.completions[dateStr] || 0 })';

      const resolvedLine = resolveAccurateLineNumber(simulatedSource, targetSnippet, 413);
      assert.strictEqual(resolvedLine, 410);
    });
  });

  describe('applyDefectFixesToSourceCode', () => {
    const source = `function processItem(item) {
  const city = item.address.city;
  return city;
}`;

    const defect: CodeDefectItem = {
      id: 'def_test_1',
      category: 'UNHANDLED_NULL',
      severity: 'HIGH',
      title: 'Null Dereference Risk',
      lineNumber: 2,
      cause: 'Unchecked item.address.city access',
      impact: 'Crash',
      buggyCodeSnippet: 'item.address.city',
      remediedCodeSnippet: 'item?.address?.city ?? "Unknown"',
    };

    test('replaces buggy snippet with remediation fix accurately', () => {
      const { newCode, appliedCount } = applyDefectFixesToSourceCode(source, [defect]);
      assert.strictEqual(appliedCount, 1);
      assert.ok(newCode.includes('item?.address?.city ?? "Unknown"'));
      assert.ok(!newCode.includes('item.address.city;'));
    });

    test('handles multi-line replacements cleanly', () => {
      const original = `setTimeout(() => {
  setHabits(updatedHabits);
}, 1000);`;

      const multiDefect: CodeDefectItem = {
        id: 'def_test_2',
        category: 'RESOURCE_LEAK',
        severity: 'HIGH',
        title: 'Async Update Leak',
        lineNumber: 1,
        cause: 'Leak',
        impact: 'Memory leak on unmount',
        buggyCodeSnippet: `setTimeout(() => {\n  setHabits(updatedHabits);\n}, 1000);`,
        remediedCodeSnippet: `useEffect(() => {\n  let isMounted = true;\n  if (isMounted) setHabits(updatedHabits);\n}, []);`,
      };

      const { newCode, appliedCount } = applyDefectFixesToSourceCode(original, [multiDefect]);
      assert.strictEqual(appliedCount, 1);
      assert.ok(newCode.includes('useEffect'));
    });
  });

  describe('generateUnifiedFileDiff & generateRepositoryPatch', () => {
    test('generates valid git diff format with a/ and b/ headers', () => {
      const original = `line 1\nline 2 - buggy\nline 3`;
      const modified = `line 1\nline 2 - fixed\nline 3`;
      const diff = generateUnifiedFileDiff('src/app.ts', original, modified);

      assert.ok(diff.includes('diff --git a/src/app.ts b/src/app.ts'));
      assert.ok(diff.includes('--- a/src/app.ts'));
      assert.ok(diff.includes('+++ b/src/app.ts'));
      assert.ok(diff.includes('-line 2 - buggy'));
      assert.ok(diff.includes('+line 2 - fixed'));
    });

    test('generates multi-file repository patch bundle', () => {
      const files = [
        {
          filePath: 'app/login.ts',
          originalContent: 'const a = 1;',
          remediatedContent: 'const a = 2;',
        },
        {
          filePath: 'lib/db.ts',
          originalContent: 'const db = null;',
          remediatedContent: 'const db = init();',
        },
      ];

      const patch = generateRepositoryPatch(files);
      assert.ok(patch.includes('diff --git a/app/login.ts b/app/login.ts'));
      assert.ok(patch.includes('diff --git a/lib/db.ts b/lib/db.ts'));
    });
  });
});
