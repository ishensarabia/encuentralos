# Encuéntralos

A free, open-source Spanish guide for families in the first hours and days after someone
disappears in Mexico. It has no accounts, no analytics and no data collection.

> **Status: unreviewed draft.** Nothing here has been reviewed yet by the partner family-support
> organization. Do not share the preview with families.

## How it works

- `content/` holds every piece of text as JSON, each item with its source and review status.
  See [content/README.md](content/README.md).
- `site/` holds the interface text (`strings.mjs`) and styles.
- `scripts/build.mjs` turns content into static HTML pages: no external resources, small enough
  for slow phones, and readable without JavaScript. With JavaScript, the site adds:
  - **¿Qué hago ahora?**: guided questions that build a personal checklist. Answers stay in the
    page's memory; nothing is stored or sent.
  - **Offline use**: after the first visit, a service worker keeps every page on the phone.
    Pages are fetched from the network first, so corrections arrive as soon as there is signal.
- **Si no te quieren recibir** quotes the law word for word; the quotes are checked against
  [docs/source-texts/](docs/source-texts/README.md) on every build.

Two builds:

| Command | Output | Shows |
|---|---|---|
| `npm run build` | `dist/preview/` | Everything, marked **SIN REVISAR**, with reviewer notes. Not indexed. For reviewers only. |
| `npm run build:public` | `dist/public/` | Approved items only. Refuses to build until the key messages are approved. |

## WhatsApp bot

`bot/` is a menu over the same approved content, with fixed replies only (no AI-generated text),
no stored messages or phone numbers, and aggregate counters only. It plugs into an existing Meta
webhook; see [docs/bot.md](docs/bot.md). `npm run bot:transcript` writes every message it can send
to `docs/review/bot-mensajes.md` for reviewers.

## Commands

```
npm run validate        check content and show review status
npm test                run the tests
npm run build           build the reviewer preview
npm run build:public    build the public site
npm run contacts-sheet  export phone numbers that still need a call
npm run bot:transcript  write every bot message to docs/review/bot-mensajes.md
```

Requires Node 20 or later. There are no dependencies.

Research notes and sources: [docs/research/01-outline-and-sources.md](docs/research/01-outline-and-sources.md).
