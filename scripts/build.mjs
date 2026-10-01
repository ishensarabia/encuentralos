#!/usr/bin/env node
// Builds the static site from content/.
// Usage: node scripts/build.mjs [--mode preview|public] [--out <dir>]
//   preview (default): every item, marked "SIN REVISAR", with reviewer notes. For reviewers only.
//   public: approved items only. Refuses to build until the required items are approved.

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, validateContent, selectPublishable } from './lib/content.mjs';
import { renderSite } from './lib/render.mjs';
import { buildAssets } from './lib/offline.mjs';
import { checkQuotes, checkFundamentos } from './lib/quotes.mjs';
import { FUNDAMENTOS } from '../site/tools.mjs';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const mode = flag('--mode', 'preview');
const out = path.resolve(flag('--out', path.join(repo, 'dist', mode)));

const content = await loadContent(path.join(repo, 'content'));
const { errors } = validateContent(content);
errors.push(...(await checkQuotes(content, path.join(repo, 'docs', 'source-texts'))));
errors.push(...(await checkFundamentos(FUNDAMENTOS, path.join(repo, 'docs', 'source-texts'))));
if (errors.length) {
  for (const e of errors) console.error(`error    ${e}`);
  console.error(`\nNot built: ${errors.length} content error(s). Run npm run validate for details.`);
  process.exit(1);
}

const read = (...p) => readFile(path.join(repo, ...p), 'utf8');
const css = await read('site', 'style.css');
const data = mode === 'public' ? selectPublishable(content) : content;
let pages;
try {
  pages = renderSite(data, { mode, css, builtOn: new Date().toISOString().slice(0, 10) });
} catch (err) {
  console.error(`Not built: ${err.message}`);
  process.exit(1);
}
const assets = buildAssets(pages, {
  guideLogic: await read('scripts', 'lib', 'guide-logic.mjs'),
  guideUi: await read('site', 'guide-ui.js'),
  appJs: await read('site', 'app.js'),
  fichaUi: await read('site', 'ficha-ui.js'),
  escritosLogic: await read('scripts', 'lib', 'escritos-logic.mjs'),
  escritosUi: await read('site', 'escritos-ui.js'),
  icon: await read('site', 'icon.svg'),
});
// Public site should be findable by families; the preview never.
assets.set('robots.txt', mode === 'public' ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');

// Cloudflare Pages reads _headers from the output folder. sw.js must never be cached, or
// corrections would not reach phones that already have the site.
assets.set('_headers', ['/*','  X-Content-Type-Options: nosniff','  Referrer-Policy: no-referrer','  Permissions-Policy: camera=(), microphone=(), geolocation=()','/sw.js','  Cache-Control: no-cache',''].join('\n'));

// Only empty the output folder when it is inside dist/, never an arbitrary path. Its contents
// are removed rather than the folder itself, which Windows refuses while the folder is open.
const dist = path.join(repo, 'dist') + path.sep;
await mkdir(out, { recursive: true });
if (out.startsWith(dist)) {
  for (const entry of await readdir(out)) await rm(path.join(out, entry), { recursive: true, force: true });
}
let bytes = 0;
for (const [file, text] of [...pages, ...assets]) {
  await writeFile(path.join(out, file), text, 'utf8');
  bytes += Buffer.byteLength(text);
}
console.log(`Built ${pages.size} pages + ${assets.size} assets (${mode}, ${Math.round(bytes / 1024)} KB) → ${path.relative(repo, out) || out}`);
