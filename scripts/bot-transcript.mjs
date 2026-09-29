#!/usr/bin/env node
// Writes every message the bot can send, screen by screen, to docs/review/bot-mensajes.md,
// so reviewers can read the bot's exact wording without running anything.
// Usage: node scripts/bot-transcript.mjs [--out <file>]
// Built from the preview bot: it includes unreviewed content and says so.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBot, crawlBot } from '../bot/index.mjs';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const out = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(repo, 'docs', 'review', 'bot-mensajes.md');

const quote = (text) => text.split('\n').map((l) => `> ${l}`.trimEnd()).join('\n');

function render(m) {
  if (m.type === 'text') return `**Mensaje**\n\n${quote(m.body)}`;
  const lines = [m.type === 'buttons' ? '**Mensaje con botones**' : '**Mensaje con lista**', '', quote(m.body), ''];
  if (m.type === 'buttons') lines.push(`Botones: ${m.buttons.map((b) => `[${b.title}]`).join(' ')}`);
  else {
    lines.push(`Botón para abrir la lista: [${m.button}]`, '');
    for (const r of m.rows) lines.push(`- **${r.title}**${r.description ? `: ${r.description}` : ''}`);
  }
  if (m.footer) lines.push('', `Pie del mensaje: ${m.footer}`);
  return lines.join('\n');
}

const bot = await loadBot({ mode: 'preview' });
const screens = crawlBot(bot);
const doc = [
  '# Mensajes del bot de WhatsApp',
  '',
  '> **BORRADOR SIN REVISAR.** Generado con `npm run bot:transcript` a partir del contenido actual. Cada mensaje real lleva al inicio la marca «[SIN REVISAR · SOLO PRUEBAS]» mientras el contenido no esté aprobado.',
  '',
  'El bot solo dice lo que aparece aquí: texto fijo, sin inteligencia artificial. Los botones y las listas de cada pantalla llevan a las pantallas siguientes.',
  '',
  `${screens.length} pantallas.`,
  '',
  ...screens.flatMap(({ via, messages }, i) => [`## ${i + 1}. ${via}`, '', ...messages.flatMap((m) => [render(m), ''])]),
].join('\n');

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, doc, 'utf8');
console.log(`${screens.length} screens → ${path.relative(repo, out)}`);
