// Entry point for the bot.
//
//   const bot = await loadBot({ mode: 'public', counters: createFileCounters('data/counts.json') });
//   for (const event of eventsFromWebhook(body)) {          // after YOUR signature check
//     for (const message of bot.handle(event)) await send(event.from, message);
//   }
//
// loadBot() reads content/, refuses to start if it is invalid or if any quote no longer
// matches its source, and (public mode) shows only approved items. It then walks every
// screen the bot can reach and checks WhatsApp's size limits, so a message that would be
// rejected in front of a family is caught here instead.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, validateContent, selectPublishable } from '../scripts/lib/content.mjs';
import { checkQuotes } from '../scripts/lib/quotes.mjs';
import { createBot } from './flow.mjs';
import { createCounters } from './counters.mjs';
import { checkMessage } from './whatsapp.mjs';

export { createBot } from './flow.mjs';
export { createCounters, createFileCounters } from './counters.mjs';
export { matchState, OTHER_STATES } from './match-state.mjs';
export { eventsFromWebhook, eventFromMessage, toCloudApiPayload, checkMessage, LIMITS } from './whatsapp.mjs';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Visits every screen: the greeting, the fallbacks, each state, and every button and list row
// that any message offers, once each. Returns [{ via, event, messages }].
export function crawlBot(bot) {
  const queue = [
    { via: 'Escribe «hola»', event: { type: 'text', text: 'hola' } },
    { via: 'Escribe «menú»', event: { type: 'text', text: 'menu' } },
    { via: 'Escribe algo que el bot no entiende', event: { type: 'text', text: 'xyzzy plugh' } },
    { via: 'Envía una imagen u otro archivo', event: { type: 'other' } },
    { via: 'Escribe «México»', event: { type: 'text', text: 'mexico' } },
    { via: 'Escribe un estado que todavía no está en la guía (Sonora)', event: { type: 'text', text: 'sonora' } },
    ...bot.states.map((s) => ({ via: `Escribe «${s.name}»`, event: { type: 'text', text: s.name } })),
  ];
  const seen = new Set();
  const results = [];
  while (queue.length) {
    const { via, event } = queue.shift();
    const messages = bot.handle(event);
    results.push({ via, event, messages });
    for (const m of messages) {
      for (const target of m.type === 'buttons' ? m.buttons : m.type === 'list' ? m.rows : []) {
        if (seen.has(target.id)) continue;
        seen.add(target.id);
        queue.push({ via: `Toca «${target.title}»`, event: { type: 'reply', id: target.id } });
      }
    }
  }
  return results;
}

export async function loadBot({ mode = 'public', root = repoRoot, counters = createCounters(), siteUrl = '', matchState } = {}) {
  const content = await loadContent(path.join(root, 'content'));
  const errors = validateContent(content).errors;
  errors.push(...(await checkQuotes(content, path.join(root, 'docs', 'source-texts'))));
  if (errors.length) throw new Error(`Content is invalid:\n${errors.join('\n')}`);

  const data = mode === 'public' ? selectPublishable(content) : content;
  const options = { content: data, mode, siteUrl, matchState };

  // Self-check on a throwaway bot, so the crawl does not touch the real counters.
  const probe = createBot({ ...options, counters: createCounters() });
  const problems = crawlBot(probe).flatMap(({ via, messages }) => messages.flatMap((m) => checkMessage(m).map((p) => `${via}: ${p}`)));
  if (problems.length) throw new Error(`The bot would send messages WhatsApp rejects:\n${problems.join('\n')}`);

  return createBot({ ...options, counters });
}
