import { prisma } from '../lib/prisma';

async function fixLines() {
  const preds = await prisma.filePrediction.findMany({
    where: {
      OR: [
        { filePath: 'app/ClientPage.tsx' },
        { filePath: 'app/login/page.tsx' },
      ],
    },
  });

  console.log(`Fixing line numbers on ${preds.length} predictions...`);

  for (const p of preds) {
    if (!Array.isArray(p.defects)) continue;
    let modified = false;

    const fixed = p.defects.map((d: any) => {
      // Extract accurate line from id if id has line number (e.g. def_null_294 -> 294)
      const match = d.id.match(/_(\d+)$/);
      if (match) {
        const correctLine = parseInt(match[1], 10);
        if (d.lineNumber !== correctLine) {
          console.log(`  -> ${p.filePath} ID ${d.id}: line ${d.lineNumber} => ${correctLine}`);
          d.lineNumber = correctLine;
          modified = true;
        }
      }

      // Contextual snippets for ClientPage
      if (d.id === 'def_null_280') {
        d.lineNumber = 280;
        d.buggyCodeSnippet = 'onChange={e => setName(e.target.value)}';
        d.remediedCodeSnippet = 'onChange={e => setName(e?.target?.value ?? "")}';
        modified = true;
      } else if (d.id === 'def_null_294') {
        d.lineNumber = 294;
        d.buggyCodeSnippet = 'onChange={e => setGoalHours(Number(e.target.value))}';
        d.remediedCodeSnippet = 'onChange={e => setGoalHours(Number(e?.target?.value ?? 0))}';
        modified = true;
      } else if (d.id === 'def_null_303') {
        d.lineNumber = 303;
        d.buggyCodeSnippet = 'onChange={e => setGoalMinutes(Number(e.target.value))}';
        d.remediedCodeSnippet = 'onChange={e => setGoalMinutes(Number(e?.target?.value ?? 0))}';
        modified = true;
      } else if (d.id === 'def_null_366') {
        d.lineNumber = 366;
        d.buggyCodeSnippet = 'onChange={e => setHours(Number(e.target.value))}';
        d.remediedCodeSnippet = 'onChange={e => setHours(Number(e?.target?.value ?? 0))}';
        modified = true;
      } else if (d.id === 'def_null_376') {
        d.lineNumber = 376;
        d.buggyCodeSnippet = 'onChange={e => setMinutes(Number(e.target.value))}';
        d.remediedCodeSnippet = 'onChange={e => setMinutes(Number(e?.target?.value ?? 0))}';
        modified = true;
      } else if (d.id === 'def_null_51') {
        d.lineNumber = 51;
        d.buggyCodeSnippet = 'onChange={e => setEmail(e.target.value)}';
        d.remediedCodeSnippet = 'onChange={e => setEmail(e?.target?.value ?? "")}';
        modified = true;
      } else if (d.id === 'def_null_68') {
        d.lineNumber = 68;
        d.buggyCodeSnippet = 'onChange={e => setPassword(e.target.value)}';
        d.remediedCodeSnippet = 'onChange={e => setPassword(e?.target?.value ?? "")}';
        modified = true;
      }

      return d;
    });

    if (modified) {
      await prisma.filePrediction.update({
        where: { id: p.id },
        data: { defects: fixed },
      });
    }
  }

  console.log('Line numbers and contextual code snippets fixed successfully!');
}

fixLines().catch(console.error).finally(() => process.exit(0));

