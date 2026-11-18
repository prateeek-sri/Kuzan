/**
 * Actionable Code Defect & Remediation Inspector Engine
 * Standard: test-driven-development & api-and-interface-design
 * Pinpoints exact line numbers, defect root causes, and before/after code patches
 */

import type { CodeDefectItem, DefectPatternCategory } from '@shared/types/contracts';

/**
 * Inspects source code to discover concrete code defects, unhandled edge-cases,
 * and generates actionable code remediation patches.
 */
export function inspectCodeForDefects(
  filePath: string,
  sourceCode: string,
  language: string
): CodeDefectItem[] {
  if (!sourceCode || typeof sourceCode !== 'string') return [];

  const lines = sourceCode.split('\n');
  const defects: CodeDefectItem[] = [];

  let currentFunction: string | undefined = undefined;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    // Track function names
    const fnMatch = line.match(/(?:function\s+([a-zA-Z0-9_]+)|def\s+([a-zA-Z0-9_]+)|([a-zA-Z0-9_]+)\s*\([^)]*\)\s*[:{])/);
    if (fnMatch) {
      currentFunction = fnMatch[1] || fnMatch[2] || fnMatch[3];
    }

    // 1. Swallowed Exception / Silent Catch Block Detection
    const hasCatch = /\bcatch\s*(?:\([a-zA-Z0-9_]*\))?\s*\{?/.test(trimmed);
    const isEmptyNext = i + 1 < lines.length && lines[i + 1].trim() === '}';
    const isSingleLineEmpty = /\bcatch\s*(?:\([a-zA-Z0-9_]*\))?\s*\{\s*\}/.test(trimmed);

    if (hasCatch && (isEmptyNext || isSingleLineEmpty)) {
      const catchParam = (line.match(/catch\s*\(([a-zA-Z0-9_]+)\)/) || [])[1] || 'err';
      defects.push({
        id: `def_swallowed_${lineNum}`,
        category: 'SWALLOWED_EXCEPTION',
        severity: 'HIGH',
        title: 'Silent Exception Swallowed',
        functionName: currentFunction,
        lineNumber: lineNum,
        cause: 'Silent exception swallowing with empty catch block hides fatal runtime errors, masking database, network, or parsing crashes.',
        impact: 'Failure silently corrupts application state and prevents error recovery or root-cause diagnosis in production.',
        buggyCodeSnippet: `try {\n  ...\n} catch (${catchParam}) {\n  // Empty catch block\n}`,
        remediedCodeSnippet: `try {\n  ...\n} catch (${catchParam}) {\n  console.error('Operation failed in ${currentFunction || 'module'}:', ${catchParam});\n  throw ${catchParam}; // Or return safe fallback value\n}`,
      });
    }

    // 2. Unhandled Null / Undefined Deep Property Access (JS/TS/Python)
    const isEventHandler = /on[A-Z][a-zA-Z0-9]*\s*=/.test(line) || /target\.value/.test(line);
    const isTypeOrSchema = /\b(type|interface|Schema|Types|model)\b/.test(line);
    const deepChainMatch = line.match(/\b([a-zA-Z0-9_$]+)\.([a-zA-Z0-9_$]+)\.([a-zA-Z0-9_$]+)(?:\.([a-zA-Z0-9_$]+))?\b/);

    if (
      deepChainMatch &&
      !isEventHandler &&
      !isTypeOrSchema &&
      !line.includes('?.') &&
      !line.includes('&&') &&
      !line.includes('typeof') &&
      !line.includes('import ') &&
      !line.includes('export ') &&
      !line.includes('console.')
    ) {
      const [fullMatch, root, p1, p2, p3] = deepChainMatch;
      const excludedRoots = [
        'process',
        'document',
        'window',
        'Math',
        'Object',
        'JSON',
        'this',
        'console',
        'mongoose',
        'Schema',
        'Prisma',
        'React',
        'e',
        'event',
        'req',
        'res',
        'next',
        'router',
        'styles',
        'path',
        'fs',
        'crypto',
        'jwt',
        'bcrypt',
      ];

      const excludedProps = ['toString', 'toISOString', 'toLowerCase', 'toUpperCase', 'trim', 'split', 'length'];

      if (!excludedRoots.includes(root) && !excludedProps.includes(p2) && !excludedProps.includes(p3 || '')) {
        const safeChain = p3
          ? `${root}?.${p1}?.${p2}?.${p3}`
          : `${root}?.${p1}?.${p2}`;

        const safeReplacedLine = trimmed.replace(fullMatch, `${safeChain} ?? null`);

        defects.push({
          id: `def_null_${lineNum}`,
          category: 'UNHANDLED_NULL',
          severity: 'HIGH',
          title: 'Unchecked Null / Undefined Dereference Risk',
          functionName: currentFunction,
          lineNumber: lineNum,
          cause: `Direct nested property access "${fullMatch}" without null-guards risks runtime TypeError ("Cannot read properties of undefined").`,
          impact: 'Uncaught TypeError throws and crashes active user request thread.',
          buggyCodeSnippet: trimmed,
          remediedCodeSnippet: safeReplacedLine,
        });
      }
    }

    // 3. Deep Conditional Nesting (4+ Nested If Blocks)
    if (trimmed.startsWith('if (') || trimmed.startsWith('if(')) {
      // Look ahead to check if there are 4+ nested if statements
      let nestingDepth = 0;
      let checkIdx = i;
      const nestedLines: string[] = [];

      while (checkIdx < lines.length && checkIdx < i + 15) {
        const checkLine = lines[checkIdx].trim();
        if (checkLine.startsWith('if (') || checkLine.startsWith('if(')) {
          nestingDepth++;
          nestedLines.push(checkLine);
        } else if (checkLine.length > 0 && !checkLine.startsWith('{') && !checkLine.startsWith('}')) {
          break;
        }
        checkIdx++;
      }

      if (nestingDepth >= 4) {
        const guardClauses = nestedLines
          .map((l) => {
            const condMatch = l.match(/if\s*\((.*)\)/);
            const cond = condMatch ? condMatch[1] : 'condition';
            return `if (!(${cond})) return;`;
          })
          .join('\n');

        defects.push({
          id: `def_nesting_${lineNum}`,
          category: 'DEEP_NESTING',
          severity: 'MEDIUM',
          title: 'Deep Conditional Nesting (Arrow Anti-Pattern)',
          functionName: currentFunction,
          lineNumber: lineNum,
          cause: `Deep conditional nesting (depth ${nestingDepth}) impairs code readability and exponentially increases cyclomatic execution paths.`,
          impact: 'High cognitive complexity and increased risk of edge-case regression bugs during maintenance.',
          buggyCodeSnippet: nestedLines.join('\n'),
          remediedCodeSnippet: `// Refactored using Guard Clauses (Early Return Pattern):\n${guardClauses}\n// Flat linear execution logic...`,
        });
      }
    }



    // 4. Loose Equality Comparison (JS/TS)
    if ((language === 'javascript' || language === 'typescript') &&
        /\b([a-zA-Z0-9_$]+)\s*(==|!=)\s*(null|undefined|0|false|true|''|"")\b/.test(trimmed)) {
      const match = trimmed.match(/\b([a-zA-Z0-9_$]+)\s*(==|!=)\s*(null|undefined|0|false|true|''|"")\b/);
      if (match) {
        const [full, varName, op, val] = match;
        const strictOp = op === '==' ? '===' : '!==';
        defects.push({
          id: `def_equality_${lineNum}`,
          category: 'UNSAFE_EQUALITY',
          severity: 'LOW',
          title: 'Unsafe Type-Coercing Loose Equality',
          functionName: currentFunction,
          lineNumber: lineNum,
          cause: `Using loose equality operator "${op}" triggers implicit JavaScript type coercion, causing false positives on empty strings and zero.`,
          impact: 'Subtle logical flaws when evaluating falsy values like empty string or 0.',
          buggyCodeSnippet: full,
          remediedCodeSnippet: `${varName} ${strictOp} ${val}`,
        });
      }
    }

    // 5. Unguarded Async State Update / Memory Leak (React hooks / timeouts)
    if ((language === 'javascript' || language === 'typescript') &&
        /setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{/.test(trimmed) &&
        i + 1 < lines.length && /set[A-Z][a-zA-Z0-9_]*\(/.test(lines[i + 1])) {
      const setterLine = lines[i + 1].trim();
      const stateMatch = setterLine.match(/(set[A-Z][a-zA-Z0-9_]*)\((.*)\)/);
      const setterName = stateMatch ? stateMatch[1] : 'setHabits';
      const setterArg = stateMatch ? stateMatch[2] : 'updatedHabits';

      defects.push({
        id: `def_async_${lineNum}`,
        category: 'RESOURCE_LEAK',
        severity: 'HIGH',
        title: 'Unguarded Async State Update (Memory Leak Risk)',
        functionName: currentFunction,
        lineNumber: lineNum,
        cause: 'Updating component state inside an asynchronous timeout without an isMounted guard or cleanup function triggers memory leaks when the component unmounts.',
        impact: 'React unmounted component state updates lead to stale closures and performance degradation.',
        buggyCodeSnippet: `setTimeout(() => {\n  ${setterName}(${setterArg});\n}, 1000);`,
        remediedCodeSnippet: `useEffect(() => {\n  let isMounted = true;\n  setTimeout(() => {\n    if (isMounted)\n      ${setterName}(${setterArg});\n  }, 1000);\n  return () => {\n    isMounted = false;\n  };\n}, []);`,
      });
    }
  }

  // Deduplicate by line number and category (at most 5 top actionable defects per file)
  const seen = new Set<string>();
  const uniqueDefects: CodeDefectItem[] = [];

  for (const d of defects) {
    const key = `${d.category}_${d.lineNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueDefects.push(d);
      if (uniqueDefects.length >= 6) break;
    }
  }

  return uniqueDefects;
}

/**
 * Generates contextual defect remediation items for high-complexity files
 * when raw source code AST scanning did not detect surface syntax defects.
 */
export function getOrGenerateFileDefects(
  filePath: string,
  sourceCode: string | undefined,
  language: string,
  _cyclomaticComplexity = 1
): CodeDefectItem[] {
  if (sourceCode && sourceCode.trim().length > 0) {
    return inspectCodeForDefects(filePath, sourceCode, language);
  }

  // When sourceCode is not provided and cyclomatic complexity is high (>= 10)
  if (!sourceCode && _cyclomaticComplexity >= 10) {
    return [
      {
        id: `def_complexity_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
        category: 'COMPLEX_BRANCHING',
        severity: _cyclomaticComplexity >= 15 ? 'CRITICAL' : 'HIGH',
        title: `High Cyclomatic Complexity (${_cyclomaticComplexity})`,
        lineNumber: 1,
        cause: `File exhibits elevated McCabe complexity (${_cyclomaticComplexity}), indicating excessive conditional decision branches and error-prone execution paths.`,
        impact: 'High defect probability and increased maintenance and regression risk.',
        buggyCodeSnippet: `// High Cyclomatic Complexity (${_cyclomaticComplexity})\n// Module contains multiple nested conditional branches exceeding threshold (> 10)`,
        remediedCodeSnippet: `// Recommended Refactoring: Strategy Pattern / Guard Clauses\n// Decompose complex branching logic into polymorphic strategy handlers or extracted functions.`,
      },
    ];
  }

  return [];
}

