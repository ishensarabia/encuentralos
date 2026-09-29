#!/usr/bin/env node
// Validates content/**/*.json and prints a review-status summary.
// Usage: node scripts/validate.mjs [--root <content dir>]
// Exits 1 if there are errors. Warnings do not fail the run.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, validateContent, selectPublishable, summarize } from './lib/content.mjs';
import { checkQuotes } from './lib/quotes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const rootFlag = args.indexOf('--root');
const root = rootFlag >= 0 ? path.resolve(args[rootFlag + 1]) : path.join(here, '..', 'content');

const content = await loadContent(root);
const { errors, warnings } = validateContent(content);
errors.push(...(await checkQuotes(content, path.join(here, '..', 'docs', 'source-texts'))));
const stats = summarize(content);
const publishable = selectPublishable(content);
const publishableCount = [...publishable.sections, ...publishable.states].reduce((n, s) => n + s.items.length, 0);

for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`error    ${e}`);

console.log(`
Content: ${stats.items} items, ${stats.sources} sources
Review:  ${Object.entries(stats.byStatus).map(([k, v]) => `${k} ${v}`).join(' · ')}
Sources: ${Object.entries(stats.byVerification).map(([k, v]) => `${k} ${v}`).join(' · ')}
Contacts: ${stats.contacts} (${stats.unconfirmedContacts} not yet confirmed by phone)
Guided questions: ${stats.guide}
Publishable (approved) items: ${publishableCount}
${errors.length ? `\n${errors.length} error(s).` : 'OK: no errors.'}`);

process.exitCode = errors.length ? 1 : 0;
