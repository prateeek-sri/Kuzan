/**
 * Patch & Remediation Engine: Applies defect fixes to source code
 * and compiles standard RFC Unified Git Diffs (.patch).
 * Standard: api-and-interface-design, test-driven-development
 */

import type { CodeDefectItem } from '@shared/types/contracts';

export interface FilePatchItem {
  filePath: string;
  originalContent: string;
  remediatedContent: string;
}

/**
 * Safely applies concrete code defects to source code by replacing
 * buggy code snippets with their recommended remediation fixes.
 */
export function applyDefectFixesToSourceCode(
  sourceCode: string,
  defects: CodeDefectItem[]
): { newCode: string; appliedCount: number } {
  if (!sourceCode || !defects || defects.length === 0) {
    return { newCode: sourceCode, appliedCount: 0 };
  }

  // Sort defects by line number descending so replacing lines at bottom doesn't throw off line numbers above
  const sortedDefects = [...defects].sort((a, b) => b.lineNumber - a.lineNumber);

  let modified = sourceCode.replace(/\r\n/g, '\n');
  let appliedCount = 0;

  for (const defect of sortedDefects) {
    const buggy = defect.buggyCodeSnippet.replace(/\r\n/g, '\n').trim();
    const fix = defect.remediedCodeSnippet.replace(/\r\n/g, '\n').trim();

    if (!buggy || !fix || buggy === fix) continue;

    // First attempt: exact match in source
    if (modified.includes(buggy)) {
      modified = modified.replace(buggy, fix);
      appliedCount++;
      continue;
    }

    // Second attempt: match by lines around lineNumber
    const lines = modified.split('\n');
    const targetIdx = defect.lineNumber - 1;

    if (targetIdx >= 0 && targetIdx < lines.length) {
      const targetLine = lines[targetIdx];
      // If buggy snippet is part of this target line (e.g. e.target.value)
      if (targetLine.includes(buggy)) {
        lines[targetIdx] = targetLine.replace(buggy, fix);
        modified = lines.join('\n');
        appliedCount++;
        continue;
      }

      // If buggy snippet is multi-line starting around targetIdx
      const buggyLines = buggy.split('\n').map((l) => l.trim());
      let matched = true;
      for (let j = 0; j < buggyLines.length && targetIdx + j < lines.length; j++) {
        if (!lines[targetIdx + j].trim().includes(buggyLines[j])) {
          matched = false;
          break;
        }
      }

      if (matched) {
        lines.splice(targetIdx, buggyLines.length, fix);
        modified = lines.join('\n');
        appliedCount++;
      }
    }
  }

  return { newCode: modified, appliedCount };
}

/**
 * Computes a standard unified git diff format between original and modified code.
 */
export function generateUnifiedFileDiff(
  filePath: string,
  originalCode: string,
  modifiedCode: string
): string {
  const normOriginal = originalCode.replace(/\r\n/g, '\n');
  const normModified = modifiedCode.replace(/\r\n/g, '\n');

  if (normOriginal === normModified) return '';

  const origLines = normOriginal.split('\n');
  const modLines = normModified.split('\n');

  const diffOutput: string[] = [
    `diff --git a/${filePath} b/${filePath}`,
    `index 0000000..1111111 100644`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
  ];

  // Compute minimal hunk diff
  let startIdx = 0;
  while (
    startIdx < origLines.length &&
    startIdx < modLines.length &&
    origLines[startIdx] === modLines[startIdx]
  ) {
    startIdx++;
  }

  let origEnd = origLines.length - 1;
  let modEnd = modLines.length - 1;
  while (
    origEnd > startIdx &&
    modEnd > startIdx &&
    origLines[origEnd] === modLines[modEnd]
  ) {
    origEnd--;
    modEnd--;
  }

  const contextBefore = Math.max(0, startIdx - 2);
  const contextAfterOrig = Math.min(origLines.length, origEnd + 3);
  const contextAfterMod = Math.min(modLines.length, modEnd + 3);

  const origCount = contextAfterOrig - contextBefore;
  const modCount = contextAfterMod - contextBefore;

  diffOutput.push(`@@ -${contextBefore + 1},${origCount} +${contextBefore + 1},${modCount} @@`);

  // Context lines before
  for (let i = contextBefore; i < startIdx; i++) {
    diffOutput.push(` ${origLines[i]}`);
  }

  // Removed original lines
  for (let i = startIdx; i <= origEnd; i++) {
    diffOutput.push(`-${origLines[i]}`);
  }

  // Added modified lines
  for (let i = startIdx; i <= modEnd; i++) {
    diffOutput.push(`+${modLines[i]}`);
  }

  // Context lines after
  for (let i = origEnd + 1; i < contextAfterOrig; i++) {
    diffOutput.push(` ${origLines[i]}`);
  }

  return diffOutput.join('\n') + '\n';
}

/**
 * Combines multiple file diffs into an actionable, unified Git Patch bundle.
 */
export function generateRepositoryPatch(files: FilePatchItem[]): string {
  const diffs: string[] = [];

  for (const file of files) {
    const fileDiff = generateUnifiedFileDiff(
      file.filePath,
      file.originalContent,
      file.remediatedContent
    );
    if (fileDiff.trim().length > 0) {
      diffs.push(fileDiff);
    }
  }

  return diffs.join('\n');
}

