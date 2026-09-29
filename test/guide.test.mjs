import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { stepApplies, selectSteps } from '../scripts/lib/guide-logic.mjs';
import { loadContent, validateContent, selectPublishable } from '../scripts/lib/content.mjs';
import { bundleGuideScript } from '../scripts/lib/offline.mjs';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = '2026-09-29';

test('a step without conditions always applies', () => {
  assert.equal(stepApplies({ item: 'x' }, {}), true);
});

test('a step applies only when every answered condition matches', () => {
  const step = { item: 'x', when: { tiempo: ['horas', 'dias'], reportado: ['no'] } };
  assert.equal(stepApplies(step, { tiempo: 'horas', reportado: 'no' }), true);
  assert.equal(stepApplies(step, { tiempo: 'meses', reportado: 'no' }), false);
  assert.equal(stepApplies(step, { tiempo: 'horas', reportado: 'si' }), false);
});

test('an unanswered question never hides a step', () => {
  const step = { item: 'x', when: { dinero: ['si'] } };
  assert.equal(stepApplies(step, {}), true);
  assert.equal(stepApplies(step, { dinero: '' }), true);
  assert.equal(stepApplies(step, { dinero: 'no' }), false);
});

test('selectSteps keeps order, expands state steps and removes duplicates', () => {
  const guide = {
    steps: [
      { item: 'urgente', when: { dinero: ['si'] } },
      { state: 'agency' },
      { section: 'rechazo', when: { reportado: ['rechazado'] } },
      { item: 'comun' },
      { item: 'comun' },
      { state: 'note' },
    ],
  };
  const stateItems = { jalisco: { agency: ['jal-a', 'jal-b'], note: ['jal-n'] } };
  assert.deepEqual(
    selectSteps(guide, { estado: 'jalisco', dinero: 'si', reportado: 'rechazado' }, stateItems),
    ['item:urgente', 'item:jal-a', 'item:jal-b', 'section:rechazo', 'item:comun', 'item:jal-n'],
  );
  assert.deepEqual(selectSteps(guide, { estado: 'otro', dinero: 'no', reportado: 'si' }, stateItems), ['item:comun']);
});

test('the real guided questions are valid and point at real items', async () => {
  const content = await loadContent(path.join(repo, 'content'));
  assert.ok(content.guide, 'content/guide.json is missing');
  assert.deepEqual(validateContent(content, { today: TODAY }).errors, []);
});

test('the real guide always shows the no-waiting and no-denuncia steps to someone who has not reported', async () => {
  const { guide, states } = await loadContent(path.join(repo, 'content'));
  const stateItems = Object.fromEntries(states.map((s) => [s.state.id, { agency: [], note: [] }]));
  for (const tiempo of ['horas', 'dias']) {
    const keys = selectSteps(guide, { reportado: 'no', tiempo }, stateItems);
    assert.ok(keys.includes('item:no-esperes'), `no-esperes missing for tiempo=${tiempo}`);
    assert.ok(keys.includes('item:no-necesitas-denuncia'));
    assert.ok(keys.includes('item:donde-reportar'));
  }
});

test('guide validation rejects unknown items, questions and options', async () => {
  const content = await loadContent(path.join(repo, 'content'));
  content.guide = structuredClone(content.guide);
  content.guide.steps.push({ item: 'no-existe' });
  content.guide.steps.push({ item: 'no-esperes', when: { color: ['azul'] } });
  content.guide.steps.push({ item: 'no-esperes', when: { dinero: ['quizas'] } });
  content.guide.steps.push({ item: 'no-esperes', section: 'rechazo' });
  const { errors } = validateContent(content, { today: TODAY });
  const has = (s) => errors.some((e) => e.includes(s));
  assert.ok(has('unknown item "no-existe"'));
  assert.ok(has('unknown question "color"'));
  assert.ok(has('unknown option "quizas"'));
  assert.ok(has('needs exactly one of item, section or state'));
});

test('the guided questions are not published until approved', async () => {
  const content = await loadContent(path.join(repo, 'content'));
  assert.equal(selectPublishable(content).guide, null);
});

test('the browser bundle runs and does nothing on a page without the form', async () => {
  const bundle = bundleGuideScript(
    await readFile(path.join(repo, 'scripts', 'lib', 'guide-logic.mjs'), 'utf8'),
    await readFile(path.join(repo, 'site', 'guide-ui.js'), 'utf8'),
  );
  assert.doesNotMatch(bundle, /^\s*export /m);
  const context = { document: { getElementById: () => null } };
  assert.doesNotThrow(() => vm.runInNewContext(bundle, context));
});
