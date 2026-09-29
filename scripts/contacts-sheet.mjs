#!/usr/bin/env node
// Writes every not-yet-confirmed contact to a CSV for someone to check by phone.
// Usage: node scripts/contacts-sheet.mjs [--out <file>]
// After calling, copy the date into the contact's "confirmed_on" in the content JSON.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from './lib/content.mjs';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const out = outFlag >= 0 ? path.resolve(args[outFlag + 1]) : path.join(repo, 'docs', 'review', 'contactos-por-confirmar.csv');

const content = await loadContent(path.join(repo, 'content'));
const sourceUrl = new Map(content.sources.map((s) => [s.id, s.url]));

const header = ['estado', 'institucion', 'item_id', 'tipo', 'etiqueta', 'valor', 'fuente_url', 'confirmado_el', 'confirmado_por', 'notas'];
const rows = [];
const groups = [
  ...content.sections.map((s) => ({ place: 'Nacional', items: s.items })),
  ...content.states.map((s) => ({ place: s.state.name, items: s.items })),
];
for (const { place, items } of groups) {
  for (const item of items) {
    for (const c of item.contacts ?? []) {
      if (c.confirmed_on) continue;
      rows.push([place, item.title, item.id, c.kind, c.label, c.value, sourceUrl.get(c.source) ?? '', '', '', '']);
    }
  }
}

const cell = (v) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
// BOM so Excel opens the accents correctly.
const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, csv, 'utf8');
console.log(`${rows.length} contacts to confirm → ${path.relative(repo, out)}`);
