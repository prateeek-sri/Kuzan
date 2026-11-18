/**
 * Code Locator Engine: Resolves exact 1-based line numbers by cross-referencing
 * snippet content against raw source code lines.
 */

export function resolveAccurateLineNumber(
  sourceCode: string,
  snippet: string,
  fallbackLine = 1
): number {
  if (!sourceCode || !snippet) return fallbackLine;

  const sourceLines = sourceCode.split('\n');
  const cleanSnippet = snippet.trim();
  if (!cleanSnippet) return fallbackLine;

  const snippetLines = cleanSnippet.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (snippetLines.length === 0) return fallbackLine;

  const firstSnippetLine = snippetLines[0];

  // 1. Check if first line of snippet matches any source line exactly (trimmed)
  for (let i = 0; i < sourceLines.length; i++) {
    const trimmedSource = sourceLines[i].trim();

    if (trimmedSource === firstSnippetLine) {
      // If multi-line snippet, verify subsequent lines match
      if (snippetLines.length > 1) {
        let isMatch = true;
        for (let j = 1; j < snippetLines.length && i + j < sourceLines.length; j++) {
          if (sourceLines[i + j].trim() !== snippetLines[j]) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) return i + 1;
      } else {
        return i + 1;
      }
    }
  }

  // 2. Check if any source line contains the snippet expression (e.g. "e.target.value")
  for (let i = 0; i < sourceLines.length; i++) {
    if (sourceLines[i].includes(cleanSnippet)) {
      return i + 1;
    }
  }

  // 3. Normalized whitespace substring match across the entire file
  const normalizedSource = sourceCode.replace(/\r\n/g, '\n');
  const normalizedSnippet = snippet.replace(/\r\n/g, '\n').trim();
  const charIdx = normalizedSource.indexOf(normalizedSnippet);

  if (charIdx !== -1) {
    const linesBefore = normalizedSource.substring(0, charIdx).split('\n');
    return linesBefore.length;
  }

  return fallbackLine;
}

