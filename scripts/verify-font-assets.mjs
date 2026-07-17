import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FONT_DIRECTORY = fileURLToPath(new URL('../src/assets/fonts/', import.meta.url));
const VALID_SFNT_SIGNATURES = new Set([
  '00010000',
  '4f54544f', // OTTO
  '74727565', // true
  '74797031', // typ1
]);

const fontFiles = (await readdir(FONT_DIRECTORY))
  .filter((fileName) => extname(fileName).toLowerCase() === '.ttf')
  .sort();

if (fontFiles.length === 0) {
  throw new Error('No TTF font assets found.');
}

const invalidFonts = [];

for (const fileName of fontFiles) {
  const fontPath = join(FONT_DIRECTORY, fileName);
  const fontData = await readFile(fontPath);
  const signature = fontData.subarray(0, 4).toString('hex');

  if (!VALID_SFNT_SIGNATURES.has(signature)) {
    invalidFonts.push(`${fileName} (signature: ${signature || 'empty'})`);
  }
}

if (invalidFonts.length > 0) {
  throw new Error(`Invalid font assets:\n${invalidFonts.map((font) => `- ${font}`).join('\n')}`);
}

console.log(`Verified ${fontFiles.length} font assets.`);
