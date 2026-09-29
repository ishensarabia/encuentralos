// The conversation. handle(event) -> messages to send, always fixed text from content/ and
// bot/strings.mjs. Nothing is generated, and nothing is remembered between messages:
// every button and list row carries its own destination in its id, for example
//   menu              main menu                     st, st:<state>, st:otro   states
//   c:<collection>[:<page>]  a list of topics       i:<collection>:<item>     one topic
//   about             about this guide
// so a conversation needs no stored state, and no phone number or message is ever kept.
//
// Events: { type: 'text', text } | { type: 'reply', id } | { type: 'other' }.
// An event may carry `from` (the sender's number) so the caller knows where to reply. The bot
// never reads, stores or logs it.

import { PHASES } from '../scripts/lib/content.mjs';
import { normalizeName } from '../scripts/lib/normalize.mjs';
import { REQUIRED_PUBLIC_ITEMS, PHASE_TITLES } from '../site/strings.mjs';
import { B, MENU, GREETING_WORDS, MENU_WORDS } from './strings.mjs';
import { createCounters } from './counters.mjs';
import { matchState as defaultMatchState } from './match-state.mjs';
import { itemBlocks, stateBlocks, packBlocks, plain, truncate } from './format.mjs';
import { LIMITS } from './whatsapp.mjs';

// 8 topics + "ver más" + "volver al menú" = 10 rows, WhatsApp's maximum for a list.
const PAGE_SIZE = 8;
const GREETING_ITEMS = ['no-esperes', 'no-necesitas-denuncia'];

// content: what the bot may say. For a public bot pass selectPublishable(content) (approved
// items only); mode "preview" accepts everything but marks every message as unreviewed.
export function createBot({ content, mode = 'public', counters = createCounters(), siteUrl = '', matchState = defaultMatchState } = {}) {
  if (mode !== 'public' && mode !== 'preview') throw new Error(`unknown mode "${mode}"`);

  const sourcesById = new Map(content.sources.map((s) => [s.id, s]));
  const itemsById = new Map();
  for (const group of [...content.sections, ...content.states]) for (const item of group.items) itemsById.set(item.id, item);

  if (mode === 'public') {
    const unapproved = [...itemsById.values()].filter((i) => i.review.status !== 'approved').map((i) => i.id);
    if (unapproved.length) throw new Error(`Public bot received unapproved items: ${unapproved.join(', ')}`);
  }
  const required = mode === 'public' ? [...new Set([...REQUIRED_PUBLIC_ITEMS, ...GREETING_ITEMS])] : GREETING_ITEMS;
  const missing = required.filter((id) => !itemsById.has(id));
  if (missing.length) throw new Error(`Bot refused to start. These items must be approved first: ${missing.join(', ')}`);

  // Collections: the lists of topics. The checklist is split by phase.
  const menuKeys = new Set(MENU.map((m) => m.key));
  const collections = new Map();
  for (const { section, items } of content.sections) {
    if (!items.length) continue;
    if (section.id === 'checklist') {
      for (const phase of PHASES) {
        const inPhase = items.filter((i) => i.phase === phase);
        if (inPhase.length) collections.set(`checklist.${phase}`, { id: `checklist.${phase}`, title: PHASE_TITLES[phase], intro: B.phaseIntros[phase] ?? '', items: inPhase });
      }
    } else {
      if (!menuKeys.has(section.id)) throw new Error(`The bot has no menu entry for section "${section.id}". Add one in bot/strings.mjs.`);
      collections.set(section.id, { id: section.id, title: section.title, intro: B.introOverrides[section.id] ?? section.intro ?? '', items });
    }
  }
  const allStates = content.states.map((s) => ({ id: s.state.id, name: s.state.name, aliases: s.state.aliases ?? [], items: s.items }));
  const states = allStates.filter((s) => s.items.length);
  if (states.length > PAGE_SIZE) throw new Error(`The state picker fits ${PAGE_SIZE} states; it needs pages before adding more.`);
  const hasChecklist = [...collections.keys()].some((k) => k.startsWith('checklist.'));

  const markerPrefix = mode === 'preview' ? `${B.previewMarker}\n` : '';
  const textLimit = LIMITS.textBody - markerPrefix.length;
  const bodyLimit = LIMITS.interactiveBody - markerPrefix.length;
  const ctx = { sourcesById, mode };

  // Counting is best effort: a failing counter must never keep a family from getting an answer.
  const count = (name) => {
    try { counters.increment(name); } catch { /* deliberately ignored */ }
  };
  const text = (body) => ({ type: 'text', body });
  const textMessages = (blocks) => packBlocks(blocks, textLimit).map(text);
  const finalize = (messages) => (markerPrefix ? messages.map((m) => ({ ...m, body: markerPrefix + m.body })) : messages);

  // Text followed by buttons. If it all fits in one interactive message, that is all we send.
  function withButtons(blocks, buttons) {
    const joined = blocks.join('\n\n');
    if (joined.length <= bodyLimit) return [{ type: 'buttons', body: joined, buttons }];
    return [...textMessages(blocks), { type: 'buttons', body: B.followUp, buttons }];
  }
  const menuButton = { id: 'menu', title: B.menu };
  const navButtons = () => [...(hasChecklist ? [{ id: 'c:checklist', title: B.stateButtons.checklist }] : []), menuButton];

  const menuAvailable = { checklist: hasChecklist, state: states.length > 0, about: true };
  function menuMessage() {
    const rows = MENU.filter((m) => menuAvailable[m.key] ?? collections.has(m.key)).map(({ id, title, description }) => ({ id, title, description }));
    return { type: 'list', body: B.menuBody, button: B.menuButton, rows, footer: B.privacyFooter };
  }

  function greeting() {
    count('greeting');
    const keyPoints = GREETING_ITEMS.map((id) => plain(itemsById.get(id).title));
    return [...textMessages(B.greeting(keyPoints, siteUrl)), menuMessage()];
  }
  function fallback() {
    count('fallback');
    return [text(B.fallback), menuMessage()];
  }

  function statePicker(body = B.statePickerBody) {
    const rows = states.map((s) => ({ id: `st:${s.id}`, title: truncate(plain(s.name), LIMITS.rowTitle) }));
    rows.push({ id: 'st:otro', ...B.otherStateRow }, { id: 'menu', title: B.menuRow });
    return { type: 'list', body, button: B.listButton, rows };
  }
  function stateView(state, typed) {
    count(`state:${state.id}`);
    const buttons = [...(hasChecklist ? [{ id: 'c:checklist', title: B.stateButtons.checklist }] : [])];
    if (collections.has('rechazo')) buttons.push({ id: 'c:rechazo', title: B.stateButtons.rechazo });
    buttons.push(menuButton);
    const messages = withButtons(stateBlocks(state, ctx, { title: B.stateTitle(plain(state.name)), notes: B.stateNotesTitle }), buttons);
    // Someone who typed a state may never have seen the greeting: remind them of the privacy caveat.
    if (typed) messages[messages.length - 1].footer = B.privacyFooter;
    return messages;
  }
  function otherState(name) {
    count('state:otro');
    const blocks = [B.otherState(name)];
    const cnb = itemsById.get('ag-cnb');
    if (cnb) blocks.push(itemBlocks(cnb, ctx).join('\n\n'));
    return withButtons(blocks, navButtons());
  }

  function collectionList(collId, page) {
    const coll = collections.get(collId);
    if (!coll) return null;
    const pages = Math.ceil(coll.items.length / PAGE_SIZE);
    const p = Number.isInteger(page) && page >= 0 && page < pages ? page : 0;
    count(`collection:${collId}`);
    const rows = coll.items.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE).map((item) => {
      const title = item.short ?? truncate(plain(item.title), LIMITS.rowTitle);
      const row = { id: `i:${collId}:${item.id}`, title };
      if (plain(item.title) !== title) row.description = truncate(plain(item.title), LIMITS.rowDescription);
      return row;
    });
    if (p + 1 < pages) rows.push({ id: `c:${collId}:${p + 1}`, title: B.moreRow, description: B.moreDescription(p + 2, pages) });
    rows.push({ id: 'menu', title: B.menuRow });
    const body = [`*${plain(coll.title)}*`, plain(coll.intro)].filter(Boolean).join('\n');
    return [{ type: 'list', body, button: B.listButton, rows }];
  }
  function checklistPicker() {
    const phases = PHASES.filter((p) => collections.has(`checklist.${p}`));
    if (!phases.length) return null;
    count('checklist');
    if (phases.length === 1) return collectionList(`checklist.${phases[0]}`, 0);
    return [{ type: 'buttons', body: B.checklistPickerBody, buttons: phases.map((p) => ({ id: `c:checklist.${p}`, title: B.phaseButtons[p] })) }];
  }
  function itemView(collId, itemId) {
    const coll = collections.get(collId);
    const index = coll ? coll.items.findIndex((i) => i.id === itemId) : -1;
    if (index < 0) return null;
    count(`item:${itemId}`);
    const next = coll.items[index + 1];
    const buttons = [];
    if (next) buttons.push({ id: `i:${collId}:${next.id}`, title: B.next });
    buttons.push({ id: `c:${collId}:${Math.floor(index / PAGE_SIZE)}`, title: B.list }, menuButton);
    return withButtons(itemBlocks(coll.items[index], ctx), buttons);
  }

  function routeReply(id) {
    if (id === 'menu') { count('menu'); return [menuMessage()]; }
    if (id === 'about') { count('about'); return withButtons(B.about, [menuButton]); }
    if (id === 'st') return states.length ? [statePicker()] : otherState(null);
    if (id === 'st:otro') return otherState(null);
    if (id.startsWith('st:')) {
      const state = states.find((s) => s.id === id.slice(3));
      if (state) return stateView(state, false);
    }
    const parts = id.split(':');
    if (id === 'c:checklist') {
      const picker = checklistPicker();
      if (picker) return picker;
    } else if (parts[0] === 'c' && parts.length <= 3 && parts[1]) {
      const list = collectionList(parts[1], parts[2] === undefined ? 0 : Number(parts[2]));
      if (list) return list;
    } else if (parts[0] === 'i' && parts.length === 3) {
      const view = itemView(parts[1], parts[2]);
      if (view) return view;
    }
    return fallback(); // an id from an old message that no longer exists
  }

  function routeText(raw) {
    const match = matchState(raw, allStates);
    if (match.kind === 'covered') {
      const state = states.find((s) => s.id === match.id);
      return state ? stateView(state, true) : otherState(match.name);
    }
    if (match.kind === 'other') return otherState(match.name);
    if (match.kind === 'ambiguous') return states.length ? [statePicker(B.ambiguousState)] : otherState(null);
    const words = new Set(normalizeName(raw).split(' '));
    if (GREETING_WORDS.some((w) => words.has(w))) return greeting();
    if (MENU_WORDS.some((w) => words.has(w))) { count('menu'); return [menuMessage()]; }
    return fallback();
  }

  return {
    mode,
    states: states.map(({ id, name }) => ({ id, name })),
    itemIds: [...itemsById.keys()],
    handle(event) {
      if (event?.type === 'reply') return finalize(routeReply(String(event.id ?? '')));
      if (event?.type === 'text') return finalize(routeText(String(event.text ?? '')));
      count('unsupported');
      return finalize([text(B.unsupported), menuMessage()]);
    },
  };
}
