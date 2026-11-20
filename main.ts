// Neon Coast Cover Studio — entry program (Node 22, standard library only).
// Copies app/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from the
// kit's vendored library. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output. Deterministic: the same repository writes the same bytes.

import { buildDossier } from './vendor/makefun-app.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTreeIntoOutput(name) {
  const source = join(repoRoot, name);
  const target = join(outputDir, name);
  if (!existsSync(source)) return;
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTreeIntoOutput('app');
copyTreeIntoOutput('screenshots');

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`dossier written: ${dossier.length} bytes -> ${join(outputDir, 'dossier.json')}`);
