// Checks that every quote in the content appears word for word in the stored text of
// its source (docs/source-texts/<source-id>.txt). Families show these quotes to
// officials, so a paraphrase or typo must fail the build.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Whitespace and line breaks from PDF extraction do not count; every word must match.
export const normalizeText = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

// Same check for the articles quoted by the document generator (site/tools.mjs).
export async function checkFundamentos(fundamentos, sourceTextsDir, source = 'lgmdfp') {
  let full;
  try {
    full = normalizeText(await readFile(path.join(sourceTextsDir, `${source}.txt`), 'utf8'));
  } catch {
    return [`fundamentos: no stored text for source "${source}" in docs/source-texts/, so they cannot be checked`];
  }
  return Object.entries(fundamentos)
    .filter(([, f]) => !full.includes(normalizeText(f.text)))
    .map(([key, f]) => `fundamento "${key}" (${f.art}): not found word for word in source "${source}"`);
}

export async function checkQuotes(content, sourceTextsDir) {
  const errors = [];
  const texts = new Map();
  const items = [...content.sections, ...content.states].flatMap((g) => g.items).filter((i) => i?.quote);
  for (const item of items) {
    const { source, text } = item.quote;
    if (!texts.has(source)) {
      try {
        texts.set(source, normalizeText(await readFile(path.join(sourceTextsDir, `${source}.txt`), 'utf8')));
      } catch {
        texts.set(source, null);
      }
    }
    const full = texts.get(source);
    if (full === null) errors.push(`${item.id} › quote: no stored text for source "${source}" in docs/source-texts/, so it cannot be checked`);
    else if (!full.includes(normalizeText(text))) errors.push(`${item.id} › quote: not found word for word in source "${source}"`);
  }
  return errors;
}
