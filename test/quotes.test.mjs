import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from '../scripts/lib/content.mjs';
import { checkQuotes, normalizeText } from '../scripts/lib/quotes.mjs';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const textsDir = path.join(repo, 'docs', 'source-texts');
const withQuote = (quote) => ({ sections: [{ items: [{ id: 'x', quote }] }], states: [] });

test('every quote in the real content appears word for word in its source', async () => {
  const content = await loadContent(path.join(repo, 'content'));
  const quoted = [...content.sections, ...content.states].flatMap((g) => g.items).filter((i) => i.quote);
  assert.ok(quoted.length >= 10, 'expected the "si no te reciben" quotes');
  assert.deepEqual(await checkQuotes(content, textsDir), []);
});

test('a quote with one word changed is rejected', async () => {
  const errors = await checkQuotes(withQuote({ text: 'Ningún protocolo establecerá plazos de espera para iniciar la búsqueda.', source: 'lgmdfp', locator: 'art. 80' }), textsDir);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /not found word for word/);
});

test('a quote whose source has no stored text is rejected', async () => {
  const errors = await checkQuotes(withQuote({ text: 'Algo.', source: 'idheas-2025', locator: 'p. 1' }), textsDir);
  assert.match(errors[0], /no stored text for source "idheas-2025"/);
});

test('line breaks and repeated spaces do not matter, words do', () => {
  assert.equal(normalizeText('Ningún  protocolo\nestablecerá'), 'Ningún protocolo establecerá');
});
