// Aggregate counters: how many times each topic was opened, per day. This is the only thing
// the bot ever records. No phone numbers, no message text, no user or conversation ids, and
// nothing that links one count to a person. Counter names are checked against a fixed
// pattern, so a bug cannot put free text into the counters.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// YYYY-MM-DD in Mexico City time.
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' });

export const COUNTER_NAME = /^(greeting|menu|about|fallback|unsupported|checklist|state:[a-z0-9-]+|collection:[a-z0-9.-]+|item:[a-z0-9-]+)$/;

export function createCounters({ now = () => new Date(), initial = {}, onChange = () => {} } = {}) {
  const days = structuredClone(initial);
  return {
    increment(name) {
      if (!COUNTER_NAME.test(name)) throw new Error(`invalid counter name: ${name}`);
      const day = dayFormat.format(now());
      days[day] ??= {};
      days[day][name] = (days[day][name] ?? 0) + 1;
      onChange(days);
    },
    snapshot: () => structuredClone(days),
  };
}

// Same counters, kept in a small JSON file ({ "2026-09-29": { "state:jalisco": 12 } }).
// Written to a temporary file first and renamed, so a crash never leaves half a file.
export function createFileCounters(file, options = {}) {
  let initial = {};
  try {
    initial = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return createCounters({
    ...options,
    initial,
    onChange(days) {
      mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(days, null, 2)}\n`);
      renameSync(tmp, file);
    },
  });
}
