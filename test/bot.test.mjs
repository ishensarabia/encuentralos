import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from '../scripts/lib/content.mjs';
import {
  createBot, createCounters, createFileCounters, matchState, crawlBot, loadBot,
  eventsFromWebhook, toCloudApiPayload, checkMessage,
} from '../bot/index.mjs';
import { COUNTER_NAME } from '../bot/counters.mjs';
import { B } from '../bot/strings.mjs';
import { packBlocks, plain } from '../bot/format.mjs';

const contentRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const approved = { status: 'approved', reviewed_by: 'Revisora', last_reviewed: '2026-09-20', notes: '' };
const item = (id, extra = {}) => ({
  id, title: `Título ${id}`, body: `Texto ${id}`,
  sources: [{ source: 'ley', locator: 'art. 1', verification: 'primary' }], review: approved, ...extra,
});

// Small approved content: a 15-topic "ahora" phase (to test pages), one "primeros días" topic,
// a quote, a contact, one available state and one with nothing approved yet.
function fixture() {
  const ahora = [
    item('no-esperes', { phase: 'ahora' }),
    item('no-necesitas-denuncia', { phase: 'ahora' }),
    item('donde-reportar', { phase: 'ahora' }),
    ...Array.from({ length: 12 }, (_, i) => item(`extra-${i + 1}`, { phase: 'ahora', short: `Extra ${i + 1}` })),
  ];
  return {
    sources: [{ id: 'ley', short: 'Ley General', title: 'Ley', issuer: 'Congreso', type: 'law', url: 'https://example.org', published: null, last_reform: null, accessed: '2026-09-01' }],
    sections: [
      { section: { id: 'checklist', title: 'Qué hacer' }, items: [...ahora, item('dias-1', { phase: 'primeros-dias' })] },
      { section: { id: 'rechazo', title: 'Si no te reciben', intro: 'Muestra esta página.' }, items: [item('rch-1', { quote: { text: 'Ningún plazo de espera.', source: 'ley', locator: 'art. 80' }, sources: [{ source: 'ley', locator: 'art. 80', verification: 'primary' }] })] },
      { section: { id: 'instituciones', title: '¿Quién hace qué?' }, items: [item('ag-cnb', { title: 'Comisión Nacional (CNB)', contacts: [{ kind: 'phone', label: 'Teléfono gratuito', value: '800 028 77 83', source: 'ley', locator: 'p. 1', confirmed_on: '2026-09-25' }] })] },
    ],
    states: [
      { state: { id: 'jalisco', name: 'Jalisco', aliases: ['gdl', 'zapopan'] }, items: [
        item('jal-a', { kind: 'agency', contacts: [{ kind: 'phone', label: 'Teléfono', value: '33 1514 5422', source: 'ley', locator: 'p. 1', confirmed_on: '2026-09-25' }] }),
        item('jal-n', { kind: 'note' }),
      ] },
      { state: { id: 'estado-de-mexico', name: 'Estado de México', aliases: ['edomex'] }, items: [] },
    ],
  };
}
const publicBot = (over = {}) => createBot({ content: fixture(), mode: 'public', ...over });
const reply = (bot, id) => bot.handle({ type: 'reply', id });
const said = (messages) => messages.map((m) => m.body).join('\n');
const last = (messages) => messages[messages.length - 1];
const rowIds = (m) => m.rows.map((r) => r.id);

// --- state matching ---

test('matchState: accents, case, punctuation and aliases', () => {
  const states = [{ id: 'ciudad-de-mexico', name: 'Ciudad de México', aliases: ['cdmx', 'df', 'd f'] }];
  for (const text of ['Ciudad de México', 'ciudad de mexico', 'CDMX', 'cdmx!!', 'mi hijo desapareció en el D.F.']) {
    assert.deepEqual(matchState(text, states), { kind: 'covered', id: 'ciudad-de-mexico', name: 'Ciudad de México' }, text);
  }
});

test('matchState: whole words only, longest name wins', () => {
  const states = [];
  assert.deepEqual(matchState('Baja California Sur', states), { kind: 'other', name: 'Baja California Sur' });
  assert.deepEqual(matchState('baja california', states), { kind: 'other', name: 'Baja California' });
  assert.deepEqual(matchState('las cosas que son', states), { kind: 'none' }, '"son" is a word, not Sonora');
  assert.deepEqual(matchState('jaliscoo', states), { kind: 'none' });
  assert.deepEqual(matchState('leon', states), { kind: 'none' });
  assert.deepEqual(matchState('nuevo leon', states), { kind: 'other', name: 'Nuevo León' });
  assert.deepEqual(matchState('NL', states), { kind: 'other', name: 'Nuevo León' });
});

test('matchState: "México" alone is ambiguous, several of our states let the person choose', () => {
  const states = [{ id: 'jalisco', name: 'Jalisco' }, { id: 'cdmx', name: 'CDMX' }];
  assert.deepEqual(matchState('México', states), { kind: 'ambiguous' });
  assert.deepEqual(matchState('mx', states), { kind: 'ambiguous' });
  assert.deepEqual(matchState('jalisco y cdmx', states), { kind: 'ambiguous' });
  assert.deepEqual(matchState('sonora y sinaloa', states), { kind: 'other', name: 'Sonora' });
  assert.deepEqual(matchState('jalisco y sonora', states), { kind: 'ambiguous' });
});

// --- conversation ---

test('"hola" gives the greeting with the honest privacy note, the key messages and the menu', () => {
  const messages = publicBot().handle({ type: 'text', text: 'Hola' });
  assert.equal(messages.length, 2);
  assert.equal(messages[0].type, 'text');
  assert.match(messages[0].body, /WhatsApp y Meta pueden ver los mensajes de esta conversación/);
  assert.match(messages[0].body, /Yo no guardo tu número ni lo que escribes/);
  assert.match(messages[0].body, /• Título no-esperes\n• Título no-necesitas-denuncia/);
  assert.match(messages[0].body, /llama al 911/);
  assert.equal(messages[1].type, 'list');
  assert.equal(messages[1].footer, B.privacyFooter);
  assert.deepEqual(rowIds(messages[1]), ['c:checklist', 'st', 'c:rechazo', 'c:instituciones', 'about']);
});

test('the greeting mentions the website only when one is configured', () => {
  assert.doesNotMatch(said(publicBot().handle({ type: 'text', text: 'hola' })), /sin WhatsApp/);
  assert.match(said(publicBot({ siteUrl: 'https://encuentralos.example' }).handle({ type: 'text', text: 'hola' })), /sin WhatsApp en https:\/\/encuentralos\.example/);
});

test('a typed place name goes to that state, even inside a sentence', () => {
  const messages = publicBot().handle({ type: 'text', text: 'Hola, mi hijo desapareció en Zapopan' });
  assert.match(messages[0].body, /\*Qué hacer en Jalisco\*/);
  assert.match(messages[0].body, /Teléfono: 33 1514 5422/);
  assert.match(messages[0].body, /\*Título jal-n\*/);
  assert.equal(last(messages).footer, B.privacyFooter, 'typed entry gets the privacy reminder');
  assert.deepEqual(last(messages).buttons.map((b) => b.id), ['c:checklist', 'c:rechazo', 'menu']);
});

test('a state picked from the list has no privacy footer; typed and picked show the same content', () => {
  const picked = reply(publicBot(), 'st:jalisco');
  const typed = publicBot().handle({ type: 'text', text: 'jalisco' });
  assert.equal(last(picked).footer, undefined);
  assert.equal(said(picked), said(typed));
});

test('"México" alone asks which state; the picker leaves out states with nothing approved', () => {
  const [picker] = publicBot().handle({ type: 'text', text: 'México' });
  assert.equal(picker.type, 'list');
  assert.deepEqual(rowIds(picker), ['st:jalisco', 'st:otro', 'menu']);
});

test('a state with no approved content is treated as not covered yet, and says so', () => {
  const messages = publicBot().handle({ type: 'text', text: 'edomex' });
  assert.match(messages[0].body, /Todavía no tenemos la guía de Estado de México/);
  assert.match(messages[0].body, /Comisión Nacional \(CNB\)/);
  assert.match(messages[0].body, /800 028 77 83/);
});

test('a state we do not cover, and "otro estado", point to the national contacts', () => {
  assert.match(said(publicBot().handle({ type: 'text', text: 'sonora' })), /Todavía no tenemos la guía de Sonora/);
  const other = reply(publicBot(), 'st:otro');
  assert.match(said(other), /guía de tu estado/);
  assert.ok(last(other).buttons.some((b) => b.id === 'menu'));
});

test('menu words show the menu; unknown text gets the fallback and is never echoed', () => {
  const [menu] = publicBot().handle({ type: 'text', text: 'ayuda' });
  assert.equal(menu.type, 'list');
  const messages = publicBot().handle({ type: 'text', text: 'mi secreto 5512345678 xyzzy' });
  assert.equal(messages[0].body, B.fallback);
  assert.doesNotMatch(said(messages), /secreto|5512345678|xyzzy/);
});

test('files and other non-text messages get a gentle answer and the menu', () => {
  const messages = publicBot().handle({ type: 'other' });
  assert.equal(messages[0].body, B.unsupported);
  assert.equal(messages[1].type, 'list');
});

test('the checklist asks for the phase, then lists topics 8 per page', () => {
  const bot = publicBot();
  const [picker] = reply(bot, 'c:checklist');
  assert.deepEqual(picker.buttons.map((b) => b.id), ['c:checklist.ahora', 'c:checklist.primeros-dias']);

  const [page0] = reply(bot, 'c:checklist.ahora');
  assert.equal(page0.rows.length, 10);
  assert.deepEqual(rowIds(page0).slice(-2), ['c:checklist.ahora:1', 'menu']);
  assert.equal(page0.rows[0].id, 'i:checklist.ahora:no-esperes');
  assert.equal(page0.rows[0].title, 'Título no-esperes'.slice(0, 24));
  assert.equal(page0.rows[0].description, undefined, 'no description when the title fits');
  assert.equal(page0.rows[3].title, 'Extra 1', 'uses the short title');
  assert.equal(page0.rows[3].description, 'Título extra-1', 'and the full title as description');

  const [page1] = reply(bot, 'c:checklist.ahora:1');
  assert.equal(page1.rows.length, 8, '7 topics + back to menu');
  assert.deepEqual(reply(bot, 'c:checklist.ahora:9')[0].rows, page0.rows, 'a page that does not exist shows the first page');
});

test('with a single phase the checklist goes straight to the topics', () => {
  const content = fixture();
  content.sections[0].items = content.sections[0].items.filter((i) => i.phase === 'ahora');
  const [list] = reply(createBot({ content, mode: 'public' }), 'c:checklist');
  assert.equal(list.type, 'list');
});

test('a topic offers next, back to its list page, and the menu', () => {
  const bot = publicBot();
  const first = reply(bot, 'i:checklist.ahora:no-esperes');
  assert.equal(first.length, 1);
  assert.match(first[0].body, /\*Título no-esperes\*\nTexto no-esperes/);
  assert.deepEqual(first[0].buttons.map((b) => [b.title, b.id]), [
    ['Siguiente', 'i:checklist.ahora:no-necesitas-denuncia'], ['Ver lista', 'c:checklist.ahora:0'], ['Menú', 'menu'],
  ]);
  const tenth = reply(bot, 'i:checklist.ahora:extra-7')[0]; // index 9: second page
  assert.equal(tenth.buttons[1].id, 'c:checklist.ahora:1');
  const lastTopic = reply(bot, 'i:checklist.ahora:extra-12')[0];
  assert.deepEqual(lastTopic.buttons.map((b) => b.title), ['Ver lista', 'Menú'], 'no "Siguiente" after the last topic');
});

test('a topic shows its quote once, its contacts and its sources, and the review date when public', () => {
  const [quote] = reply(publicBot(), 'i:rechazo:rch-1');
  assert.match(quote.body, /«Ningún plazo de espera\.»\n— Ley General, art\. 80/);
  assert.equal(quote.body.split('art. 80').length - 1, 1, 'the citation is not repeated');
  const [contact] = reply(publicBot(), 'i:instituciones:ag-cnb');
  assert.match(contact.body, /Teléfono gratuito: 800 028 77 83/);
  assert.match(contact.body, /Fuente: Ley General, art\. 1/);
  assert.match(contact.body, /Fuentes verificadas el 20 de septiembre de 2026/);
});

test('long topics are split into text messages within WhatsApp limits, then buttons', () => {
  const content = fixture();
  content.sections[0].items[0].body = 'palabra '.repeat(1200); // about 9,600 characters
  const messages = reply(createBot({ content, mode: 'public' }), 'i:checklist.ahora:no-esperes');
  assert.ok(messages.length >= 3);
  assert.deepEqual(messages.slice(0, -1).map((m) => m.type), messages.slice(0, -1).map(() => 'text'));
  assert.equal(last(messages).type, 'buttons');
  assert.equal(last(messages).body, B.followUp);
  for (const m of messages) assert.deepEqual(checkMessage(m), []);
});

test('packBlocks keeps blocks whole when it can and splits oversized ones at line breaks', () => {
  assert.deepEqual(packBlocks(['aaa', 'bbb'], 100), ['aaa\n\nbbb']);
  assert.deepEqual(packBlocks(['aaa', 'bbb'], 5), ['aaa', 'bbb']);
  assert.deepEqual(packBlocks(['aa\nbb\ncc'], 5), ['aa\nbb', 'cc']);
  assert.deepEqual(packBlocks(['abcdefgh'], 3), ['abc', 'def', 'gh']);
});

test('stale or made-up button ids fall back to the menu instead of failing', () => {
  for (const id of ['', 'x', 'i:nope:nope', 'c:nope', 'st:nowhere', 'i:checklist.ahora', 'c:a:b:c']) {
    const messages = reply(publicBot(), id);
    assert.equal(messages[0].body, B.fallback, `id "${id}"`);
  }
});

test('about this guide repeats the privacy caveat', () => {
  const [about] = reply(publicBot(), 'about');
  assert.match(about.body, /no guardo tu número ni tus mensajes/);
  assert.match(about.body, /WhatsApp y Meta sí pueden ver esta conversación/);
});

// --- review gate ---

test('preview marks every message as unreviewed; public never does', () => {
  const content = fixture();
  content.sections[0].items[0].review = { status: 'unreviewed', reviewed_by: null, last_reviewed: null, notes: '' };
  const preview = createBot({ content, mode: 'preview' });
  const screens = crawlBot(preview).flatMap((s) => s.messages);
  assert.ok(screens.length > 10);
  for (const m of screens) assert.ok(m.body.startsWith(B.previewMarker), m.body.slice(0, 60));
  for (const m of crawlBot(publicBot()).flatMap((s) => s.messages)) assert.ok(!m.body.includes('SIN REVISAR'));
});

test('a public bot refuses unapproved content and refuses to start without the key messages', () => {
  const content = fixture();
  content.sections[0].items[3].review = { status: 'unreviewed', reviewed_by: null, last_reviewed: null, notes: '' };
  assert.throws(() => createBot({ content, mode: 'public' }), /unapproved items: extra-1/);
  const noKey = fixture();
  noKey.sections[0].items = noKey.sections[0].items.filter((i) => i.id !== 'donde-reportar');
  assert.throws(() => createBot({ content: noKey, mode: 'public' }), /must be approved first: donde-reportar/);
  assert.doesNotThrow(() => createBot({ content: noKey, mode: 'preview' }), 'preview only needs the two greeting items');
});

test('a section without a menu entry stops the bot instead of being silently left out', () => {
  const content = fixture();
  content.sections.push({ section: { id: 'nueva', title: 'Nueva' }, items: [item('nu-1')] });
  assert.throws(() => createBot({ content, mode: 'public' }), /no menu entry for section "nueva"/);
});

test('loadBot starts in public mode with the approved real content', async () => {
  await assert.doesNotReject(() => loadBot({ mode: 'public' }));
});

// --- privacy ---

test('no phone number and no message text reaches a reply or a counter', () => {
  const counters = createCounters();
  const bot = publicBot({ counters });
  const number = '5215512345678';
  const events = [
    { from: number, type: 'text', text: `me llamo Ana ${number} desaparecido zapopan` },
    { from: number, type: 'text', text: 'contraseña 1234' },
    { from: number, type: 'reply', id: `st:${number}` },
    { from: number, type: 'other' },
  ];
  const outputs = events.map((e) => JSON.stringify(bot.handle(e))).join('\n');
  assert.ok(!outputs.includes(number) && !outputs.includes('Ana') && !outputs.includes('contraseña'));
  const dump = JSON.stringify(counters.snapshot());
  assert.ok(!dump.includes(number) && !dump.includes('Ana') && !dump.includes('1234'));
});

test('counters hold only day + topic + count, with names from a fixed pattern', () => {
  const counters = createCounters({ now: () => new Date('2026-09-29T20:00:00Z') });
  const bot = publicBot({ counters });
  crawlBot(bot);
  const snapshot = counters.snapshot();
  assert.deepEqual(Object.keys(snapshot), ['2026-09-29']);
  for (const [name, n] of Object.entries(snapshot['2026-09-29'])) {
    assert.match(name, COUNTER_NAME);
    assert.ok(Number.isInteger(n) && n > 0);
  }
  assert.ok(snapshot['2026-09-29']['state:jalisco'] >= 1);
  assert.throws(() => counters.increment('texto libre del usuario'), /invalid counter name/);
});

test('counter days follow Mexico City time', () => {
  const counters = createCounters({ now: () => new Date('2026-09-30T04:30:00Z') }); // 22:30 on the 29th in CDMX
  counters.increment('menu');
  assert.deepEqual(Object.keys(counters.snapshot()), ['2026-09-29']);
});

test('file counters survive a restart and write only counts', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'encuentralos-'));
  try {
    const file = path.join(dir, 'nested', 'counts.json');
    const now = () => new Date('2026-09-29T18:00:00Z');
    const a = createFileCounters(file, { now });
    a.increment('menu');
    a.increment('menu');
    a.increment('state:jalisco');
    const b = createFileCounters(file, { now });
    b.increment('menu');
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { '2026-09-29': { menu: 3, 'state:jalisco': 1 } });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a broken counter never stops a reply', () => {
  const counters = { increment() { throw new Error('disk full'); }, snapshot: () => ({}) };
  assert.equal(publicBot({ counters }).handle({ type: 'text', text: 'hola' }).length, 2);
});

// --- WhatsApp seam ---

test('eventsFromWebhook reads texts and button/list taps, skips receipts and reactions', () => {
  const body = { entry: [{ changes: [{ value: {
    statuses: [{ id: 'x', status: 'delivered' }],
    messages: [
      { from: '5215500000000', type: 'text', text: { body: 'hola' } },
      { from: '5215500000000', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'st:jalisco', title: 'Jalisco' } } },
      { from: '5215500000000', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'menu', title: 'Menú' } } },
      { from: '5215500000000', type: 'reaction', reaction: { emoji: '👍' } },
      { from: '5215500000000', type: 'image', image: { id: 'i' } },
    ],
  } }] }] };
  assert.deepEqual(eventsFromWebhook(body).map(({ type, text, id }) => ({ type, text, id })), [
    { type: 'text', text: 'hola', id: undefined },
    { type: 'reply', text: undefined, id: 'st:jalisco' },
    { type: 'reply', text: undefined, id: 'menu' },
    { type: 'other', text: undefined, id: undefined },
  ]);
  assert.deepEqual(eventsFromWebhook({}), []);
  assert.deepEqual(eventsFromWebhook(null), []);
});

test('toCloudApiPayload builds text, button and list messages', () => {
  const text = toCloudApiPayload('5215500000000', { type: 'text', body: 'hola' });
  assert.deepEqual(text, { messaging_product: 'whatsapp', recipient_type: 'individual', to: '5215500000000', type: 'text', text: { preview_url: false, body: 'hola' } });
  const buttons = toCloudApiPayload('1', { type: 'buttons', body: 'b', buttons: [{ id: 'menu', title: 'Menú' }], footer: 'f' });
  assert.deepEqual(buttons.interactive, { body: { text: 'b' }, footer: { text: 'f' }, type: 'button', action: { buttons: [{ type: 'reply', reply: { id: 'menu', title: 'Menú' } }] } });
  const list = toCloudApiPayload('1', { type: 'list', body: 'b', button: 'Ver', rows: [{ id: 'a', title: 'A', description: 'd' }, { id: 'b', title: 'B' }] });
  assert.deepEqual(list.interactive.action, { button: 'Ver', sections: [{ rows: [{ id: 'a', title: 'A', description: 'd' }, { id: 'b', title: 'B' }] }] });
  assert.equal(list.interactive.footer, undefined);
});

test('checkMessage catches every WhatsApp size limit', () => {
  assert.deepEqual(checkMessage({ type: 'text', body: 'ok' }), []);
  assert.equal(checkMessage({ type: 'text', body: 'x'.repeat(4097) }).length, 1);
  assert.equal(checkMessage({ type: 'buttons', body: 'x'.repeat(1025), buttons: [{ id: 'a', title: 'ok' }] }).length, 1);
  assert.equal(checkMessage({ type: 'buttons', body: 'b', buttons: [1, 2, 3, 4].map((n) => ({ id: `${n}`, title: 'ok' })) }).length, 1);
  assert.equal(checkMessage({ type: 'buttons', body: 'b', buttons: [{ id: 'a', title: 'x'.repeat(21) }] }).length, 1);
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, title: 'ok' }));
  assert.equal(checkMessage({ type: 'list', body: 'b', button: 'Ver', rows: rows(11) }).length, 1);
  assert.equal(checkMessage({ type: 'list', body: 'b', button: 'Ver', rows: [{ id: 'a', title: 'x'.repeat(25) }] }).length, 1);
  assert.equal(checkMessage({ type: 'list', body: 'b', button: 'Ver', rows: [{ id: 'a', title: 'ok', description: 'x'.repeat(73) }] }).length, 1);
  assert.equal(checkMessage({ type: 'list', body: 'b', button: 'Ver', rows: [{ id: 'a', title: 'ok' }, { id: 'a', title: 'ok' }] }).length, 1, 'duplicate ids');
  assert.equal(checkMessage({ type: 'list', body: 'b', button: 'Ver', rows: rows(1), footer: 'x'.repeat(61) }).length, 1);
  assert.equal(checkMessage({ type: 'nope' }).length, 1);
});

// --- the real content ---

test('the real content in preview: everything reachable, within limits, nothing dead-ends', async () => {
  const bot = await loadBot({ mode: 'preview' }); // also runs its own start-up check
  const content = await loadContent(contentRoot);
  const screens = crawlBot(bot);
  assert.ok(screens.length > 60);
  for (const { via, event, messages } of screens) {
    assert.ok(messages.length >= 1, via);
    for (const m of messages) assert.deepEqual(checkMessage(m), [], via);
    if (event.type === 'reply') assert.notEqual(messages[0].body, `${B.previewMarker}\n${B.fallback}`, `${via} (${event.id}) leads nowhere`);
  }

  // Every item is shown somewhere, and every quote appears in the bot exactly as stored.
  const everything = screens.flatMap((s) => s.messages).map((m) => m.body).join('\n');
  for (const group of [...content.sections, ...content.states]) {
    for (const it of group.items) {
      assert.ok(everything.includes(`*${plain(it.title)}*`), `item ${it.id} is never shown by the bot`);
      if (it.quote) assert.ok(everything.includes(`«${it.quote.text}»`), `quote of ${it.id} is altered or missing`);
    }
  }
});

test('the real content has nothing that WhatsApp would read as formatting', async () => {
  const content = await loadContent(contentRoot);
  const shown = [];
  for (const group of [...content.sections, ...content.states]) {
    for (const it of group.items) {
      shown.push(it.title, it.body, ...(it.list ?? []), ...(it.contacts ?? []).flatMap((c) => [c.label, c.value]), it.quote?.text ?? '');
    }
  }
  const bad = shown.filter((s) => /[*~`]/.test(s));
  assert.deepEqual(bad, []);
});

test('every real state with content answers to its own name and aliases', async () => {
  const bot = await loadBot({ mode: 'preview' });
  const content = await loadContent(contentRoot);
  for (const { state } of content.states) {
    for (const name of [state.name, ...(state.aliases ?? [])]) {
      const messages = bot.handle({ type: 'text', text: `desapareció en ${name}` });
      assert.match(messages[0].body, new RegExp(`\\*Qué hacer en ${state.name}\\*`), `"${name}" should reach ${state.name}`);
    }
  }
});
