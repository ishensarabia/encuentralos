// The seam with WhatsApp Cloud API. Pure functions, no network and no secrets: your existing
// webhook keeps doing signature verification and sending. What is here:
//   eventsFromWebhook(body)   incoming webhook JSON -> events for bot.handle()
//   toCloudApiPayload(to, m)  a bot message -> the JSON to POST to /messages
//   checkMessage(m)           WhatsApp's size limits, so a too-long message is caught in
//                             tests and at start-up instead of failing in front of a family
//
// Bot messages are one of:
//   { type: 'text',    body }
//   { type: 'buttons', body, buttons: [{ id, title }], footer? }
//   { type: 'list',    body, button, rows: [{ id, title, description? }], footer? }

export const LIMITS = {
  textBody: 4096,
  interactiveBody: 1024,
  footer: 60,
  buttons: 3,
  buttonTitle: 20,
  listButton: 20,
  rows: 10,
  rowTitle: 24,
  rowDescription: 72,
  id: 200,
};

const len = (s) => Array.from(String(s)).length;

export function checkMessage(m) {
  const problems = [];
  const over = (what, value, max) => { if (len(value) > max) problems.push(`${what} is ${len(value)} characters (max ${max})`); };
  if (m.type === 'text') {
    if (!m.body) problems.push('empty text');
    over('text body', m.body, LIMITS.textBody);
    return problems;
  }
  if (m.type !== 'buttons' && m.type !== 'list') return [`unknown message type "${m.type}"`];
  if (!m.body) problems.push('empty body');
  over('body', m.body, LIMITS.interactiveBody);
  if (m.footer !== undefined) over('footer', m.footer, LIMITS.footer);
  const ids = new Set();
  const checkId = (id) => {
    over(`id "${id}"`, id, LIMITS.id);
    if (ids.has(id)) problems.push(`duplicate id "${id}"`);
    ids.add(id);
  };
  if (m.type === 'buttons') {
    if (m.buttons.length < 1 || m.buttons.length > LIMITS.buttons) problems.push(`${m.buttons.length} buttons (allowed 1-${LIMITS.buttons})`);
    for (const b of m.buttons) { over(`button "${b.title}"`, b.title, LIMITS.buttonTitle); checkId(b.id); }
  } else {
    over('list button', m.button, LIMITS.listButton);
    if (m.rows.length < 1 || m.rows.length > LIMITS.rows) problems.push(`${m.rows.length} rows (allowed 1-${LIMITS.rows})`);
    for (const r of m.rows) {
      over(`row title "${r.title}"`, r.title, LIMITS.rowTitle);
      if (r.description !== undefined) over(`row description of "${r.title}"`, r.description, LIMITS.rowDescription);
      checkId(r.id);
    }
  }
  return problems;
}

export function toCloudApiPayload(to, m) {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
  if (m.type === 'text') return { ...base, type: 'text', text: { preview_url: false, body: m.body } };
  const interactive = { body: { text: m.body } };
  if (m.footer) interactive.footer = { text: m.footer };
  if (m.type === 'buttons') {
    interactive.type = 'button';
    interactive.action = { buttons: m.buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) };
  } else {
    interactive.type = 'list';
    interactive.action = {
      button: m.button,
      sections: [{ rows: m.rows.map((r) => ({ id: r.id, title: r.title, ...(r.description ? { description: r.description } : {}) })) }],
    };
  }
  return { ...base, type: 'interactive', interactive };
}

// One WhatsApp message object -> an event, or null when the bot should stay silent
// (reactions, receipts). `from` is only there so the caller knows where to reply; the bot
// never reads it, stores it or logs it.
export function eventFromMessage(m) {
  if (!m || typeof m !== 'object') return null;
  if (m.type === 'text') return { from: m.from, type: 'text', text: m.text?.body ?? '' };
  if (m.type === 'interactive') {
    const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
    return reply?.id ? { from: m.from, type: 'reply', id: reply.id } : { from: m.from, type: 'other' };
  }
  if (m.type === 'reaction' || m.type === 'unsupported') return null;
  return { from: m.from, type: 'other' };
}

export function eventsFromWebhook(body) {
  const events = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const m of change?.value?.messages ?? []) {
        const event = eventFromMessage(m);
        if (event) events.push(event);
      }
    }
  }
  return events;
}
