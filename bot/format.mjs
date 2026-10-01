// Turns content items into WhatsApp text. Formatting uses WhatsApp's own markup
// (*bold*), so text from content has the characters that would break it removed.

import { formatDate } from '../scripts/lib/render.mjs';

// WhatsApp reads * ~ ` as formatting; content should not contain them (a test enforces it).
export const plain = (s) => String(s).replace(/[*~`]/g, '');

export const truncate = (s, max) => {
  const chars = Array.from(s);
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
};

function sourcesLine(item, sourcesById) {
  const seen = new Set();
  const parts = [];
  for (const ref of item.sources) {
    const src = sourcesById.get(ref.source);
    const part = `${src.short}, ${ref.locator}`;
    if (!seen.has(part)) { seen.add(part); parts.push(part); }
  }
  return `${parts.length > 1 ? 'Fuentes' : 'Fuente'}: ${parts.join('; ')}`;
}

// One item as blocks of text (each block is a paragraph group; blocks are joined by blank lines).
export function itemBlocks(item, { sourcesById, mode }) {
  const head = [`*${plain(item.title)}*`, plain(item.body)];
  if (item.list) head.push(...item.list.map((l) => `• ${plain(l)}`));
  const blocks = [head.join('\n')];
  if (item.quote) {
    const src = sourcesById.get(item.quote.source);
    // Quotes are shown exactly as stored: never altered, so they can be shown to an official.
    blocks.push(`«${item.quote.text}»\n— ${src.short}, ${item.quote.locator}`);
  }
  if (item.contacts?.length) blocks.push(item.contacts.map((c) => `${plain(c.label)}: ${plain(c.value)}`).join('\n'));
  const cited = sourcesLine(item, sourcesById);
  const quoteCite = item.quote ? `Fuente: ${sourcesById.get(item.quote.source).short}, ${item.quote.locator}` : null;
  if (cited !== quoteCite) blocks.push(cited); // a quote already carries its own citation
  if (mode === 'public' && item.review.last_reviewed) blocks.push(`Fuentes verificadas el ${formatDate(item.review.last_reviewed)}`);
  return blocks;
}

// Everything the bot says about one state: its agencies, then what else to know.
export function stateBlocks(state, ctx, titles) {
  const agencies = state.items.filter((i) => i.kind === 'agency');
  const notes = state.items.filter((i) => i.kind === 'note');
  const blocks = [titles.title];
  for (const item of agencies) blocks.push(itemBlocks(item, ctx).join('\n\n'));
  if (notes.length) {
    blocks.push(titles.notes);
    for (const item of notes) blocks.push(itemBlocks(item, ctx).join('\n\n'));
  }
  return blocks;
}

// Joins blocks with blank lines into as few messages as possible, never splitting a block
// unless it alone is longer than the limit (then at line breaks, and as a last resort mid-line).
export function packBlocks(blocks, limit) {
  const pieces = [];
  for (const block of blocks) {
    if (block.length <= limit) { pieces.push(block); continue; }
    let chunk = '';
    for (const line of block.split('\n')) {
      for (let rest = line; ; ) {
        const room = limit - (chunk ? chunk.length + 1 : 0);
        if (rest.length <= room) { chunk = chunk ? `${chunk}\n${rest}` : rest; break; }
        if (chunk) { pieces.push(chunk); chunk = ''; continue; }
        pieces.push(rest.slice(0, limit));
        rest = rest.slice(limit);
      }
    }
    if (chunk) pieces.push(chunk);
  }
  const messages = [];
  let current = '';
  for (const piece of pieces) {
    const joined = current ? `${current}\n\n${piece}` : piece;
    if (joined.length <= limit) current = joined;
    else { messages.push(current); current = piece; }
  }
  if (current) messages.push(current);
  return messages;
}
