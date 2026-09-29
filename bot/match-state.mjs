// Finds which state a message is talking about. Accent-less, case-insensitive, whole words
// only ("son" never matches inside "sonora"), longest name wins ("Baja California Sur" is
// not "Baja California"). This is a stand-in with the same behaviour as the matcher already
// in the deployed bot: pass yours as `matchState` to createBot() to use it instead.
//
// matchState(text, states) -> one of
//   { kind: 'covered',   id, name }   a state we have a guide for (states: [{id, name, aliases}])
//   { kind: 'other',     name }       a Mexican state we have no guide for yet
//   { kind: 'ambiguous' }             more than one state, or just "México"
//   { kind: 'none' }

import { normalizeName } from '../scripts/lib/normalize.mjs';

// Every other Mexican state, so the bot can say "we don't have that one yet" instead of
// treating it as unknown text. Abbreviations are limited to ones that are not ordinary
// Spanish words (no "son", "sin", "col", "ver", "tab").
export const OTHER_STATES = [
  { name: 'Aguascalientes', aliases: ['ags'] },
  { name: 'Baja California', aliases: ['bc'] },
  { name: 'Baja California Sur', aliases: ['bcs'] },
  { name: 'Campeche' },
  { name: 'Chiapas', aliases: ['chis'] },
  { name: 'Chihuahua', aliases: ['chih'] },
  { name: 'Coahuila', aliases: ['coah'] },
  { name: 'Colima' },
  { name: 'Durango', aliases: ['dgo'] },
  { name: 'Guanajuato', aliases: ['gto'] },
  { name: 'Guerrero', aliases: ['gro'] },
  { name: 'Hidalgo', aliases: ['hgo'] },
  { name: 'Michoacán', aliases: ['mich'] },
  { name: 'Morelos' },
  { name: 'Nayarit', aliases: ['nay'] },
  { name: 'Nuevo León', aliases: ['nl'] },
  { name: 'Oaxaca', aliases: ['oax'] },
  { name: 'Puebla' },
  { name: 'Querétaro', aliases: ['qro'] },
  { name: 'Quintana Roo', aliases: ['qroo'] },
  { name: 'San Luis Potosí', aliases: ['slp'] },
  { name: 'Sinaloa' },
  { name: 'Sonora' },
  { name: 'Tabasco' },
  { name: 'Tamaulipas', aliases: ['tamps'] },
  { name: 'Tlaxcala', aliases: ['tlax'] },
  { name: 'Veracruz' },
  { name: 'Yucatán', aliases: ['yuc'] },
  { name: 'Zacatecas', aliases: ['zac'] },
];

export function matchState(text, states) {
  const padded = ` ${normalizeName(text)} `;
  // "México" alone could mean the country, the capital or the state: never guess.
  if (padded === ' mexico ' || padded === ' mx ') return { kind: 'ambiguous' };

  const candidates = [];
  const add = (names, target) => {
    for (const name of names) {
      const phrase = normalizeName(name);
      if (phrase) candidates.push({ phrase, target });
    }
  };
  for (const s of states) add([s.name, ...(s.aliases ?? [])], { kind: 'covered', id: s.id, name: s.name });
  for (const o of OTHER_STATES) add([o.name, ...(o.aliases ?? [])], { kind: 'other', name: o.name });

  const hits = [];
  for (const c of candidates) {
    const at = padded.indexOf(` ${c.phrase} `);
    if (at !== -1) hits.push({ ...c, at });
  }
  // A hit inside a longer hit is the same mention ("baja california" inside "baja california sur").
  const kept = hits.filter((h) => !hits.some((o) => o !== h && o.phrase.length > h.phrase.length && ` ${o.phrase} `.includes(` ${h.phrase} `)));

  const targets = new Map();
  for (const h of kept.sort((a, b) => a.at - b.at)) {
    const key = h.target.kind === 'covered' ? `c:${h.target.id}` : `o:${h.target.name}`;
    if (!targets.has(key)) targets.set(key, h.target);
  }
  const found = [...targets.values()];
  if (found.length === 0) return { kind: 'none' };
  if (found.length === 1) return found[0];
  // Several states named. If any is one of ours, let the person choose; otherwise it hardly
  // matters which "not yet covered" state we name first.
  return found.some((t) => t.kind === 'covered') ? { kind: 'ambiguous' } : found[0];
}
