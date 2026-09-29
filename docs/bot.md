# WhatsApp bot

A menu over the same content as the website. Fixed replies only: no AI-generated text. It stores
**no messages and no phone numbers**, only aggregate counters.

The bot is the conversation logic (`bot/`). Your existing Meta app, number, webhook, signature
verification and send helpers stay as they are; the bot plugs in between them.

## Plugging it into your webhook

```js
import { loadBot, createFileCounters, eventsFromWebhook, toCloudApiPayload } from './bot/index.mjs';

const bot = await loadBot({
  mode: 'public',                                  // or 'preview' on a test number, see below
  counters: createFileCounters('data/counts.json'),
  siteUrl: 'https://…',                            // optional: mentioned in the greeting
  // matchState: yourExistingMatcher,              // optional, see "State matching"
});

// In the webhook handler, AFTER your signature check:
for (const event of eventsFromWebhook(body)) {
  for (const message of bot.handle(event)) {
    await yourSend(event.from, toCloudApiPayload(event.from, message)); // or convert with your own helpers
  }
}
```

- `eventsFromWebhook(body)` turns Cloud API webhook JSON into events (`text`, `reply`, `other`).
  Delivery receipts and reactions are skipped, so the bot stays silent for them.
- `bot.handle(event)` returns an array of messages to send, in order. Each is
  `{ type: 'text', body }`, `{ type: 'buttons', body, buttons }` or `{ type: 'list', body, button, rows }`.
  `toCloudApiPayload` builds the JSON for `/messages`; if your send helpers already take text and
  buttons, map these three shapes onto them instead.
- `loadBot` reads `content/`, **refuses to start** if it is invalid or a quote no longer matches its
  source, and checks WhatsApp's size limits on every screen the bot can reach.

## Conversation map

Everything is stateless: each button and list row carries its destination in its id.

| Id | Shows |
|---|---|
| (text «hola») | Greeting (with the privacy note and the two key messages) + main menu |
| `menu` | Main menu |
| `st`, `st:<state>`, `st:otro` | State picker, a state's agencies and notes, or "not covered yet" |
| `c:checklist` | Phase picker (now / first days / weeks and months) |
| `c:<collection>[:<page>]` | List of topics, 8 per page |
| `i:<collection>:<item>` | One topic, with **Siguiente / Ver lista / Menú** |
| `about` | About this guide |

Typing a state name anywhere (accents, case and aliases like CDMX or Edomex don't matter, and it
can be inside a sentence) jumps to that state. States we don't cover yet get an honest answer and
the national contacts. Anything else gets a fixed "no entendí" and the menu; **what the person
typed is never echoed back**.

Every reply is fixed text from `content/` and `bot/strings.mjs`. To read all of it without running
anything: `npm run bot:transcript` writes every screen to `docs/review/bot-mensajes.md`.

## What is stored

Only `data/counts.json`-style counters: `{ "2026-09-29": { "state:jalisco": 12, "menu": 40 } }`
(day in Mexico City time → topic → count). Names come from a fixed pattern (`greeting`, `menu`,
`state:<id>`, `item:<id>`, …), so free text cannot get in. There is no user id, phone number,
message text or conversation id, and nothing that ties a count to a person.

**Your webhook must keep to the same rules:**

- Do not log request bodies, `event.from` or message text (including in error logs and APM/tracing).
- Use `event.from` only to address the reply. Do not keep it after sending.
- Meta re-delivers a webhook if you do not answer `200` quickly. The bot deliberately keeps no
  message ids, so answer fast (the bot itself is instant) and, if you need de-duplication, do it in
  memory with a short expiry, never on disk.
- The greeting says honestly that **WhatsApp and Meta can see the conversation**. Nothing here
  can change that. It is also why the website (no data collected at all) stays the safest channel.

## Review gate

| Mode | Content | Every message |
|---|---|---|
| `public` | Approved items only. Refuses to start until the key messages (`no-esperes`, `no-necesitas-denuncia`, `donde-reportar`) are approved. | Clean |
| `preview` | Everything | Starts with **[SIN REVISAR · SOLO PRUEBAS]** |

Run `preview` only on a test number shared with reviewers. `public` cannot be started before the
content is approved (`loadBot({ mode: 'public' })` fails until then).

## State matching

`bot/match-state.mjs` normalizes (lowercase, no accents, no punctuation), matches whole words only,
prefers the longest name (`Baja California Sur` is not `Baja California`) and never guesses on "México"
alone. It recognizes the 29 states we have no guide for so it can say so honestly. Aliases for the
states we cover live in `content/states/<id>.json` (`state.aliases`), shared with the validator, which
rejects an alias that belongs to two states.

To use your existing matcher, pass `matchState(text, states)` returning one of
`{ kind: 'covered', id, name }`, `{ kind: 'other', name }`, `{ kind: 'ambiguous' }`, `{ kind: 'none' }`,
where `states` is `[{ id, name, aliases }]`.

## Adding content

- New item in an existing section: add it to the JSON with a `short` title (24 characters or fewer,
  used in WhatsApp lists). It appears in the bot with no code change.
- New state: add `content/states/<id>.json` with `aliases`. The picker fits 8 states; past that it
  needs pages (the bot refuses to start rather than silently drop one).
- New section: add a menu entry in `bot/strings.mjs` (the bot refuses to start otherwise).

`npm test` crawls the real content through the bot and fails if any screen breaks a WhatsApp limit,
if an item is unreachable, if a quote is altered, or if content contains characters WhatsApp would
read as formatting (`*`, `~`, `` ` ``).

## Not in the bot

- The guided questions ("¿Qué hago ahora?") are on the website only. The bot's menu covers the same
  content.
- Photos, audio, files and free-form questions: the bot answers that it only understands text and
  buttons.
- Reminders and follow-up (phase 3): separate consent, encryption and expiry are needed first.
