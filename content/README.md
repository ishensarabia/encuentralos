# Content

All text shown to families lives here as JSON. The website and the WhatsApp bot both read these
files, so they always say the same thing.

```
content/
  sources.json              every law, protocol, guide or site we cite
  national/
    checklist.json          step-by-step checklist (phases: ahora, primeros-dias, semanas-y-meses)
    documents.json          information to gather
    dna.json                how DNA samples work
    agencies.json           who does what (+ national contacts)
    rechazo.json            "si no te quieren recibir": law quotes to show officials
  guide.json                guided questions («¿Qué hago ahora?») and the rules for what they show
  states/
    <state-id>.json         state agencies, contacts and notes (file name = state id)
```

## Items

Every entry in `items` has the same shape:

```json
{
  "id": "no-esperes",
  "title": "No tienes que esperar para reportar",
  "body": "…",
  "list": ["optional", "bullet points"],
  "sources": [
    { "source": "lgmdfp", "locator": "art. 80, último párrafo", "verification": "primary" }
  ],
  "review": { "status": "unreviewed", "reviewed_by": null, "last_reviewed": null, "notes": "" }
}
```

- Checklist items also have `phase`. State items also have `kind` (`agency` or `note`).
- Any item can have a `quote`: `{ "text", "source", "locator" }`. The text must appear word for
  word in `docs/source-texts/<source>.txt`, or validation fails.
- Agencies can have `contacts`: `{ "kind", "label", "value", "source", "locator", "confirmed_on" }`.
- `verification` says how the claim was checked:
  - `primary`: read in the law or official document itself, at that locator.
  - `secondary`: taken from an NGO guide or similar.
  - `unconfirmed`: known only from search results; must be checked.
- `review.notes` is for the reviewer. It is never shown to families.
- In `sources.json`, `short` is the name shown next to each item; `accessed: null` means nobody on
  the project has read that source yet.

## Guided questions (`guide.json`)

`questions` are asked on the «¿Qué hago ahora?» page; `steps` decide what is shown, in order.
Each step is one of `{ "item": id }`, `{ "section": id }` (a link to that page) or
`{ "state": "agency" | "note" }` (the chosen state's items), with an optional
`"when": { "<question>": ["<option>", …] }`. All listed questions must match; any listed
option counts; **a question left unanswered never hides a step**. The guide has its own
`review` block and is published only once approved.

## Review rules (enforced by `npm run validate`)

Only items with `review.status: "approved"` are ever published. An item **cannot** be approved if:

- it has no reviewer name (`reviewed_by`) or date (`last_reviewed`);
- any of its sources is `unconfirmed`, or is a source nobody has read (`accessed: null`);
- any of its contacts has no `confirmed_on` date (someone must call the number first).

Approved contacts confirmed more than 180 days ago produce a warning.

## Commands

```
npm run validate        check all content and print review status
npm test                run the validator's tests
npm run contacts-sheet  export unconfirmed contacts to docs/review/contactos-por-confirmar.csv
```
