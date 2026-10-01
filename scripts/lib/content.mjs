// Loads and validates the guide's content files (content/**/*.json).
// Shared by the validate CLI, the tests and, later, the site build and the bot,
// so that all of them agree on what is publishable.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { normalizeName } from './normalize.mjs';

export const VERIFICATION = ['primary', 'secondary', 'unconfirmed'];
export const REVIEW_STATUS = ['unreviewed', 'needs_changes', 'approved', 'rejected'];
export const PHASES = ['ahora', 'primeros-dias', 'semanas-y-meses'];
export const CONTACT_KINDS = ['phone', 'whatsapp', 'web', 'email', 'address'];
export const SOURCE_TYPES = ['law', 'state_law', 'protocol', 'un_standard', 'ngo_guide', 'official_site', 'news', 'data'];
export const STATE_ITEM_KINDS = ['agency', 'note'];

// Approved contacts older than this get a warning: phone numbers change.
export const CONTACT_MAX_AGE_DAYS = 180;

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PARTIAL_DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

const SOURCE_KEYS = new Set(['id', 'short', 'title', 'issuer', 'type', 'url', 'published', 'last_reform', 'accessed']);
const ITEM_KEYS = new Set(['id', 'kind', 'phase', 'title', 'short', 'body', 'list', 'quote', 'sources', 'contacts', 'review']);
const STATE_KEYS = new Set(['id', 'name', 'aliases']);
// WhatsApp list rows show at most 24 characters of title.
export const SHORT_TITLE_MAX = 24;
const REF_KEYS = new Set(['source', 'locator', 'verification']);
const QUOTE_KEYS = new Set(['text', 'source', 'locator']);
const GUIDE_KEYS = new Set(['_comment', 'title', 'intro', 'questions', 'steps', 'review']);
const QUESTION_KEYS = new Set(['id', 'text', 'options']);
const OPTION_KEYS = new Set(['id', 'label']);
const STEP_KEYS = new Set(['item', 'section', 'state', 'when']);
const CONTACT_KEYS = new Set(['kind', 'label', 'value', 'source', 'locator', 'confirmed_on']);
const REVIEW_KEYS = new Set(['status', 'reviewed_by', 'last_reviewed', 'notes']);

async function readJson(file) {
  const text = await readFile(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${file}: invalid JSON (${err.message})`);
  }
}

async function readJsonDir(dir) {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  return Promise.all(names.map(async (name) => ({ file: path.join(dir, name), data: await readJson(path.join(dir, name)) })));
}

export async function loadContent(root) {
  const sourcesFile = path.join(root, 'sources.json');
  const sources = await readJson(sourcesFile);
  const national = await readJsonDir(path.join(root, 'national'));
  const states = await readJsonDir(path.join(root, 'states'));
  let guide = null;
  try {
    guide = await readJson(path.join(root, 'guide.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return {
    sourcesFile,
    sources: sources.sources,
    sections: national.map(({ file, data }) => ({ file, section: data.section, items: data.items })),
    states: states.map(({ file, data }) => ({ file, state: data.state, items: data.items })),
    guide,
  };
}

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function daysBetween(fromIso, toIso) {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000;
}

export function validateContent(content, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

  // Returns false (after reporting) when obj is not an object, so callers can skip it.
  const checkKeys = (where, obj, allowed) => {
    if (!isObject(obj)) {
      err(where, 'must be an object');
      return false;
    }
    for (const key of Object.keys(obj)) if (!allowed.has(key)) err(where, `unknown field "${key}"`);
    return true;
  };
  const checkDate = (where, field, value, { pattern = ISO_DATE } = {}) => {
    if (value === null) return;
    if (typeof value !== 'string' || !pattern.test(value)) return err(where, `${field} must be null or a date like YYYY-MM-DD`);
    if (value.length === 10 && value > today) err(where, `${field} ${value} is in the future`);
  };

  // --- sources ---
  const sources = new Map();
  if (!Array.isArray(content.sources)) {
    err(content.sourcesFile ?? 'sources.json', '"sources" must be an array');
  } else {
    for (const s of content.sources) {
      const where = `source ${s?.id ?? '(no id)'}`;
      if (!checkKeys(where, s, SOURCE_KEYS)) continue;
      if (!ID.test(s.id ?? '')) err(where, 'id must be lowercase-kebab-case');
      else if (sources.has(s.id)) err(where, 'duplicate source id');
      else sources.set(s.id, s);
      for (const f of ['short', 'title', 'issuer']) if (!isText(s[f])) err(where, `${f} is required`);
      if (!SOURCE_TYPES.includes(s.type)) err(where, `type must be one of ${SOURCE_TYPES.join(', ')}`);
      if (!/^https:\/\//.test(s.url ?? '')) err(where, 'url must start with https://');
      checkDate(where, 'published', s.published, { pattern: PARTIAL_DATE });
      checkDate(where, 'last_reform', s.last_reform, { pattern: PARTIAL_DATE });
      checkDate(where, 'accessed', s.accessed);
    }
  }

  // --- items ---
  const usedSources = new Set();
  const itemIds = new Set();

  const checkItem = (file, item, { requirePhase, requireKind }) => {
    const where = `${path.basename(file)} › ${item?.id ?? '(no id)'}`;
    if (!checkKeys(where, item, ITEM_KEYS)) return;
    if (!ID.test(item.id ?? '')) err(where, 'id must be lowercase-kebab-case');
    else if (itemIds.has(item.id)) err(where, 'duplicate item id');
    else itemIds.add(item.id);

    if (!isText(item.title)) err(where, 'title is required');
    if (item.short !== undefined && (!isText(item.short) || Array.from(item.short).length > SHORT_TITLE_MAX)) {
      err(where, `short must be text of at most ${SHORT_TITLE_MAX} characters (it is the WhatsApp list title)`);
    }
    if (!isText(item.body)) err(where, 'body is required');
    if (item.list !== undefined && !(Array.isArray(item.list) && item.list.length && item.list.every(isText))) {
      err(where, 'list must be a non-empty array of strings');
    }
    if (requirePhase && !PHASES.includes(item.phase)) err(where, `phase must be one of ${PHASES.join(', ')}`);
    if (!requirePhase && item.phase !== undefined) err(where, 'phase is only allowed in the checklist');
    if (requireKind && !STATE_ITEM_KINDS.includes(item.kind)) err(where, `kind must be one of ${STATE_ITEM_KINDS.join(', ')}`);
    if (!requireKind && item.kind !== undefined) err(where, 'kind is only allowed in state files');

    const review = item.review;
    const approved = review?.status === 'approved';
    const blockApproval = (msg) => approved && err(where, `cannot be approved: ${msg}`);

    if (!Array.isArray(item.sources) || item.sources.length === 0) {
      err(where, 'at least one source is required');
    } else {
      item.sources.forEach((ref, i) => {
        const at = `${where} › sources[${i}]`;
        if (!checkKeys(at, ref, REF_KEYS)) return blockApproval(`sources[${i}] is malformed`);
        const src = sources.get(ref.source);
        if (!src) err(at, `unknown source "${ref.source}"`);
        else usedSources.add(ref.source);
        if (!isText(ref.locator)) err(at, 'locator is required (e.g. "art. 80")');
        if (!VERIFICATION.includes(ref.verification)) err(at, `verification must be one of ${VERIFICATION.join(', ')}`);
        if (ref.verification === 'unconfirmed') blockApproval(`sources[${i}] is unconfirmed`);
        if (src && src.accessed === null) blockApproval(`source "${src.id}" has never been read (accessed is null)`);
      });
    }

    // A verbatim quote from a source (e.g. the law text shown to an official).
    if (item.quote !== undefined && checkKeys(`${where} › quote`, item.quote, QUOTE_KEYS)) {
      const q = item.quote;
      if (!isText(q.text)) err(`${where} › quote`, 'text is required');
      if (!isText(q.locator)) err(`${where} › quote`, 'locator is required');
      const src = sources.get(q.source);
      if (!src) err(`${where} › quote`, `unknown source "${q.source}"`);
      else usedSources.add(q.source);
      if (src && src.accessed === null) blockApproval(`quote source "${src.id}" has never been read`);
    }

    if (item.contacts !== undefined) {
      if (!Array.isArray(item.contacts)) err(where, 'contacts must be an array');
      else item.contacts.forEach((c, i) => {
        const at = `${where} › contacts[${i}]`;
        if (!checkKeys(at, c, CONTACT_KEYS)) return blockApproval(`contacts[${i}] is malformed`);
        if (!CONTACT_KINDS.includes(c.kind)) err(at, `kind must be one of ${CONTACT_KINDS.join(', ')}`);
        for (const f of ['label', 'value', 'locator']) if (!isText(c[f])) err(at, `${f} is required`);
        if (c.kind === 'web' && !/^https:\/\/[^\s"<>]+$/.test(c.value ?? '')) err(at, 'web contacts must be an https:// URL');
        if (c.kind === 'email' && !/^[^\s@"<>]+@[^\s@"<>]+\.[a-z]{2,}$/i.test(c.value ?? '')) err(at, 'email contact is not a valid address');
        const src = sources.get(c.source);
        if (!src) err(at, `unknown source "${c.source}"`);
        else usedSources.add(c.source);
        checkDate(at, 'confirmed_on', c.confirmed_on);
        if (c.confirmed_on === null || c.confirmed_on === undefined) {
          blockApproval(`contacts[${i}] (${c.value}) has not been confirmed`);
        } else if (approved && ISO_DATE.test(c.confirmed_on) && daysBetween(c.confirmed_on, today) > CONTACT_MAX_AGE_DAYS) {
          warn(at, `last confirmed ${c.confirmed_on}, more than ${CONTACT_MAX_AGE_DAYS} days ago`);
        }
        if (src && src.accessed === null) blockApproval(`contact source "${src.id}" has never been read`);
      });
    }

    checkReview(where, review);
  };

  function checkReview(where, review) {
    if (!checkKeys(`${where} › review`, review, REVIEW_KEYS)) return;
    if (!REVIEW_STATUS.includes(review.status)) err(where, `review.status must be one of ${REVIEW_STATUS.join(', ')}`);
    if (review.notes !== undefined && typeof review.notes !== 'string') err(where, 'review.notes must be a string');
    checkDate(where, 'review.last_reviewed', review.last_reviewed ?? null);
    if (review.status === 'approved') {
      if (!isText(review.reviewed_by)) err(where, 'approved items need review.reviewed_by');
      if (!review.last_reviewed) err(where, 'approved items need review.last_reviewed');
    }
  }

  const sectionIds = new Set();
  for (const { file, section, items } of content.sections) {
    const where = path.basename(file);
    if (!ID.test(section?.id ?? '')) err(where, 'section.id must be lowercase-kebab-case');
    else if (sectionIds.has(section.id)) err(where, `duplicate section id "${section.id}"`);
    else sectionIds.add(section.id);
    if (!isText(section?.title)) err(where, 'section.title is required');
    if (!Array.isArray(items) || items.length === 0) { err(where, 'items must be a non-empty array'); continue; }
    for (const item of items) checkItem(file, item, { requirePhase: section?.id === 'checklist', requireKind: false });
  }

  const stateIds = new Set();
  const nameOwner = new Map(); // normalized name or alias -> state id
  for (const { file, state, items } of content.states) {
    const where = path.basename(file);
    if (!ID.test(state?.id ?? '')) err(where, 'state.id must be lowercase-kebab-case');
    else if (stateIds.has(state.id)) err(where, `duplicate state id "${state.id}"`);
    else stateIds.add(state.id);
    if (path.basename(file, '.json') !== state?.id) err(where, `file name must match state.id "${state?.id}"`);
    if (!isText(state?.name)) err(where, 'state.name is required');
    if (isObject(state)) {
      checkKeys(`${where} › state`, state, STATE_KEYS);
      // The bot matches free text against the name and these aliases, so none may be shared.
      const names = [state.name, ...(state.aliases ?? [])];
      if (state.aliases !== undefined && !(Array.isArray(state.aliases) && state.aliases.every(isText))) {
        err(where, 'state.aliases must be an array of non-empty strings');
      } else {
        for (const n of names.filter(isText)) {
          const key = normalizeName(n);
          if (!key) { err(where, `alias "${n}" has no letters or digits`); continue; }
          const owner = nameOwner.get(key);
          if (owner && owner !== state.id) err(where, `"${n}" is also a name or alias of ${owner}`);
          else nameOwner.set(key, state.id);
        }
      }
    }
    if (!Array.isArray(items) || items.length === 0) { err(where, 'items must be a non-empty array'); continue; }
    for (const item of items) checkItem(file, item, { requirePhase: false, requireKind: true });
  }

  if (content.guide) checkGuide(content.guide);

  function checkGuide(g) {
    const where = 'guide.json';
    if (!checkKeys(where, g, GUIDE_KEYS)) return;
    if (!isText(g.title)) err(where, 'title is required');
    if (!isText(g.intro)) err(where, 'intro is required');

    const options = new Map(); // question id -> Set of valid answers
    if (!Array.isArray(g.questions) || g.questions.length === 0) err(where, 'questions must be a non-empty array');
    else for (const q of g.questions) {
      const at = `${where} › question ${q?.id ?? '(no id)'}`;
      if (!checkKeys(at, q, QUESTION_KEYS)) continue;
      if (!ID.test(q.id ?? '')) err(at, 'id must be lowercase-kebab-case');
      else if (options.has(q.id)) err(at, 'duplicate question id');
      if (!isText(q.text)) err(at, 'text is required');
      if (q.options === 'states') {
        if (q.id !== 'estado') err(at, 'only the "estado" question can use "states" options');
        options.set(q.id, new Set([...stateIds, 'otro']));
      } else if (Array.isArray(q.options) && q.options.length >= 2) {
        const ids = new Set();
        for (const o of q.options) {
          if (!checkKeys(`${at} › option`, o, OPTION_KEYS)) continue;
          if (!ID.test(o.id ?? '')) err(at, `option id "${o.id}" must be lowercase-kebab-case`);
          else if (ids.has(o.id)) err(at, `duplicate option "${o.id}"`);
          else ids.add(o.id);
          if (!isText(o.label)) err(at, `option "${o.id}" needs a label`);
        }
        options.set(q.id, ids);
      } else {
        err(at, 'options must be "states" or an array of at least 2 options');
      }
    }

    if (!Array.isArray(g.steps) || g.steps.length === 0) err(where, 'steps must be a non-empty array');
    else g.steps.forEach((s, i) => {
      const at = `${where} › steps[${i}]`;
      if (!checkKeys(at, s, STEP_KEYS)) return;
      const targets = ['item', 'section', 'state'].filter((k) => s[k] !== undefined);
      if (targets.length !== 1) return err(at, 'needs exactly one of item, section or state');
      if (s.item !== undefined && !itemIds.has(s.item)) err(at, `unknown item "${s.item}"`);
      if (s.section !== undefined && !sectionIds.has(s.section)) err(at, `unknown section "${s.section}"`);
      if (s.state !== undefined) {
        if (!STATE_ITEM_KINDS.includes(s.state)) err(at, `state must be one of ${STATE_ITEM_KINDS.join(', ')}`);
        if (!options.has('estado')) err(at, 'state steps need an "estado" question');
      }
      if (s.when === undefined) return;
      if (!isObject(s.when)) return err(at, 'when must be an object');
      for (const [qid, allowed] of Object.entries(s.when)) {
        const valid = options.get(qid);
        if (!valid) { err(at, `when: unknown question "${qid}"`); continue; }
        if (!Array.isArray(allowed) || allowed.length === 0) { err(at, `when.${qid} must be a non-empty array`); continue; }
        for (const a of allowed) if (!valid.has(a)) err(at, `when.${qid}: unknown option "${a}"`);
      }
    });

    checkReview(where, g.review);
  }

  for (const id of sources.keys()) if (!usedSources.has(id)) warn(`source ${id}`, 'not cited by any item');

  return { errors, warnings };
}

const allItems = (content) => [
  ...content.sections.flatMap((s) => s.items),
  ...content.states.flatMap((s) => s.items),
];

// The only content the public site and the bot may show: approved items,
// plus the sources those items cite. Run validateContent first.
export function selectPublishable(content) {
  const isApproved = (item) => item.review?.status === 'approved';
  const sections = content.sections.map((s) => ({ ...s, items: s.items.filter(isApproved) }));
  const states = content.states.map((s) => ({ ...s, items: s.items.filter(isApproved) }));
  const cited = new Set();
  for (const item of [...sections, ...states].flatMap((s) => s.items)) {
    for (const ref of item.sources) cited.add(ref.source);
    for (const c of item.contacts ?? []) cited.add(c.source);
    if (item.quote) cited.add(item.quote.source);
  }

  // The guided questions are published only once approved, and only point at published items.
  let guide = null;
  if (content.guide && isApproved(content.guide)) {
    const items = new Set([...sections, ...states].flatMap((s) => s.items.map((i) => i.id)));
    const sectionIds = new Set(sections.filter((s) => s.items.length).map((s) => s.section.id));
    const steps = content.guide.steps.filter((s) => (s.item ? items.has(s.item) : s.section ? sectionIds.has(s.section) : true));
    guide = { ...content.guide, steps };
  }

  return {
    sources: content.sources.filter((s) => cited.has(s.id)),
    sections,
    states,
    guide,
  };
}

export function summarize(content) {
  const items = allItems(content);
  const byStatus = Object.fromEntries(REVIEW_STATUS.map((s) => [s, 0]));
  const byVerification = Object.fromEntries(VERIFICATION.map((v) => [v, 0]));
  let contacts = 0;
  let unconfirmedContacts = 0;
  for (const item of items) {
    if (REVIEW_STATUS.includes(item.review?.status)) byStatus[item.review.status] += 1;
    for (const ref of item.sources ?? []) if (VERIFICATION.includes(ref?.verification)) byVerification[ref.verification] += 1;
    for (const c of item.contacts ?? []) {
      contacts += 1;
      if (c?.confirmed_on == null) unconfirmedContacts += 1;
    }
  }
  const guide = content.guide ? content.guide.review?.status ?? 'invalid' : 'none';
  return { items: items.length, sources: content.sources.length, byStatus, byVerification, contacts, unconfirmedContacts, guide };
}
