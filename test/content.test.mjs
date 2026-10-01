import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, validateContent, selectPublishable, summarize } from '../scripts/lib/content.mjs';

const contentRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const TODAY = '2026-10-01';

// Smallest valid content: one read source, one checklist item, one state with one agency.
function fixture() {
  return {
    sourcesFile: 'sources.json',
    sources: [
      { id: 'ley', short: 'Ley', title: 'Ley', issuer: 'Congreso', type: 'law', url: 'https://example.org/ley.pdf', published: '2017-11-17', last_reform: null, accessed: '2026-09-01' },
      { id: 'sitio', short: 'Sitio', title: 'Sitio', issuer: 'Gobierno', type: 'official_site', url: 'https://example.org', published: null, last_reform: null, accessed: '2026-09-01' },
    ],
    sections: [{
      file: 'national/checklist.json',
      section: { id: 'checklist', title: 'Pasos' },
      items: [{
        id: 'paso-uno',
        phase: 'ahora',
        title: 'Reporta',
        body: 'Reporta ya.',
        sources: [{ source: 'ley', locator: 'art. 80', verification: 'primary' }],
        review: { status: 'unreviewed', reviewed_by: null, last_reviewed: null, notes: '' },
      }],
    }],
    states: [{
      file: 'states/jalisco.json',
      state: { id: 'jalisco', name: 'Jalisco' },
      items: [{
        id: 'jal-comision',
        kind: 'agency',
        title: 'Comisión',
        body: 'Busca.',
        sources: [{ source: 'sitio', locator: 'inicio', verification: 'primary' }],
        contacts: [{ kind: 'phone', label: 'Tel', value: '33 0000 0000', source: 'sitio', locator: 'inicio', confirmed_on: null }],
        review: { status: 'unreviewed', reviewed_by: null, last_reviewed: null, notes: '' },
      }],
    }],
  };
}

const checklistItem = (c) => c.sections[0].items[0];
const stateItem = (c) => c.states[0].items[0];
const approve = (item) => { item.review = { status: 'approved', reviewed_by: 'Revisora', last_reviewed: '2026-09-20', notes: '' }; };
const validate = (c) => validateContent(c, { today: TODAY });
const hasError = (result, fragment) => result.errors.some((e) => e.includes(fragment));

test('the real content files are valid', async () => {
  const content = await loadContent(contentRoot);
  const { errors } = validate(content);
  assert.deepEqual(errors, []);
});

test('nothing in the real content is publishable until a reviewer approves it', async () => {
  const content = await loadContent(contentRoot);
  const pub = selectPublishable(content);
  const published = [...pub.sections, ...pub.states].flatMap((s) => s.items);
  const approved = [...content.sections, ...content.states].flatMap((s) => s.items).filter((i) => i.review.status === 'approved');
  assert.ok(published.every((i) => i.review.status === 'approved'));
  assert.equal(published.length, approved.length);
});

test('the fixture is valid', () => {
  assert.deepEqual(validate(fixture()).errors, []);
});

test('an item without sources is rejected', () => {
  const c = fixture();
  checklistItem(c).sources = [];
  assert.ok(hasError(validate(c), 'at least one source is required'));
});

test('a reference to an unknown source is rejected', () => {
  const c = fixture();
  checklistItem(c).sources[0].source = 'no-existe';
  assert.ok(hasError(validate(c), 'unknown source "no-existe"'));
});

test('a reference without a locator is rejected', () => {
  const c = fixture();
  checklistItem(c).sources[0].locator = ' ';
  assert.ok(hasError(validate(c), 'locator is required'));
});

test('duplicate item ids across files are rejected', () => {
  const c = fixture();
  stateItem(c).id = 'paso-uno';
  assert.ok(hasError(validate(c), 'duplicate item id'));
});

test('misspelled fields are rejected instead of silently ignored', () => {
  const c = fixture();
  checklistItem(c).sorces = [];
  assert.ok(hasError(validate(c), 'unknown field "sorces"'));
});

test('checklist items need a valid phase', () => {
  const c = fixture();
  checklistItem(c).phase = 'luego';
  assert.ok(hasError(validate(c), 'phase must be one of'));
});

test('state file name must match state id', () => {
  const c = fixture();
  c.states[0].file = 'states/jal.json';
  assert.ok(hasError(validate(c), 'file name must match state.id'));
});

test('an approved item needs a reviewer name and date', () => {
  const c = fixture();
  checklistItem(c).review = { status: 'approved', reviewed_by: null, last_reviewed: null, notes: '' };
  const result = validate(c);
  assert.ok(hasError(result, 'need review.reviewed_by'));
  assert.ok(hasError(result, 'need review.last_reviewed'));
});

test('a review date in the future is rejected', () => {
  const c = fixture();
  approve(checklistItem(c));
  checklistItem(c).review.last_reviewed = '2027-01-01';
  assert.ok(hasError(validate(c), 'is in the future'));
});

test('an item citing an unconfirmed claim cannot be approved', () => {
  const c = fixture();
  checklistItem(c).sources[0].verification = 'unconfirmed';
  assert.deepEqual(validate(c).errors, [], 'unconfirmed is fine while unreviewed');
  approve(checklistItem(c));
  assert.ok(hasError(validate(c), 'cannot be approved: sources[0] is unconfirmed'));
});

test('an item citing a source nobody has read cannot be approved', () => {
  const c = fixture();
  c.sources[0].accessed = null;
  approve(checklistItem(c));
  assert.ok(hasError(validate(c), 'has never been read'));
});

test('an agency with an unconfirmed phone number cannot be approved', () => {
  const c = fixture();
  approve(stateItem(c));
  assert.ok(hasError(validate(c), 'has not been confirmed'));
  stateItem(c).contacts[0].confirmed_on = '2026-09-25';
  assert.deepEqual(validate(c).errors, []);
});

test('an approved contact confirmed long ago produces a warning', () => {
  const c = fixture();
  approve(stateItem(c));
  stateItem(c).contacts[0].confirmed_on = '2025-01-01';
  const result = validate(c);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((w) => w.includes('more than 180 days ago')));
});

test('a null entry in a list is reported, not a crash', () => {
  const c = fixture();
  c.sections[0].items.push(null);
  assert.ok(hasError(validate(c), 'must be an object'));
});

test('selectPublishable returns only approved items and the sources they cite', () => {
  const c = fixture();
  approve(checklistItem(c));
  const pub = selectPublishable(c);
  assert.deepEqual(pub.sections[0].items.map((i) => i.id), ['paso-uno']);
  assert.deepEqual(pub.states[0].items, []);
  assert.deepEqual(pub.sources.map((s) => s.id), ['ley']);
});

test('summarize counts statuses and unconfirmed contacts', () => {
  const stats = summarize(fixture());
  assert.equal(stats.items, 2);
  assert.equal(stats.byStatus.unreviewed, 2);
  assert.equal(stats.unconfirmedContacts, 1);
});
