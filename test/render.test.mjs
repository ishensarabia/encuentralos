import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, selectPublishable, validateContent } from '../scripts/lib/content.mjs';
import { renderSite, telHref, formatDate, esc } from '../scripts/lib/render.mjs';
import { buildAssets } from '../scripts/lib/offline.mjs';

const contentRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const opts = (mode) => ({ mode, css: 'body{}', builtOn: '2026-09-29' });

const approved = { status: 'approved', reviewed_by: 'Revisora', last_reviewed: '2026-09-20', notes: 'nota interna aprobada' };
const unreviewed = { status: 'unreviewed', reviewed_by: null, last_reviewed: null, notes: 'nota interna pendiente' };
const item = (id, review, extra = {}) => ({
  id, phase: 'ahora', title: `Título ${id}`, body: `Texto ${id}`,
  sources: [{ source: 'ley', locator: 'art. 1', verification: 'primary' }], review, ...extra,
});

// Required public items approved, plus one unreviewed item that must never be published.
function fixture() {
  return {
    sources: [
      { id: 'ley', short: 'Ley', title: 'Ley completa', issuer: 'Congreso', type: 'law', url: 'https://example.org/ley', published: '2017-11-17', last_reform: null, accessed: '2026-09-01' },
      { id: 'otra', short: 'Otra', title: 'Otra fuente', issuer: 'X', type: 'ngo_guide', url: 'https://example.org/otra', published: null, last_reform: null, accessed: '2026-09-01' },
    ],
    sections: [{
      file: 'national/checklist.json',
      section: { id: 'checklist', title: 'Qué hacer' },
      items: [
        item('no-esperes', approved, { quote: { text: 'Ningún plazo de espera.', source: 'ley', locator: 'art. 80' } }),
        item('no-necesitas-denuncia', approved),
        item('donde-reportar', approved),
        item('ag-cnb', approved),
        item('secreto', unreviewed, { sources: [{ source: 'otra', locator: 'p. 1', verification: 'secondary' }] }),
      ],
    }],
    states: [{
      file: 'states/jalisco.json',
      state: { id: 'jalisco', name: 'Jalisco' },
      items: [{
        id: 'jal-uno', kind: 'agency', title: 'Comisión', body: 'Busca.',
        sources: [{ source: 'ley', locator: 'art. 2', verification: 'primary' }],
        contacts: [{ kind: 'phone', label: 'Tel', value: '33 1514 5422', source: 'ley', locator: 'art. 2', confirmed_on: null }],
        review: unreviewed,
      }],
    }],
    guide: null,
  };
}

// Every relative href/src must point to a generated file, and every #anchor to an id on that page.
function brokenLinks(pages) {
  const files = new Map([...pages, ...buildAssets(pages, { guideLogic: '', guideUi: '', appJs: '', icon: '', fichaUi: '', escritosLogic: '', escritosUi: '' })]);
  const broken = [];
  for (const [file, html] of pages) {
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https:|tel:|mailto:)/.test(href)) continue;
      const [target, anchor] = href.split('#');
      const page = files.get(target || file);
      if (page === undefined) broken.push(`${file} → ${href}`);
      else if (anchor && !page.includes(`id="${anchor}"`)) broken.push(`${file} → ${href} (no anchor)`);
    }
  }
  return broken;
}

// Only our own script files may run: no inline code and nothing from other sites.
function unexpectedScripts(html) {
  return [...html.matchAll(/<script\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => !/^<script src="(app|guia|ficha|escritos)\.js" defer>$/.test(tag) && !/^<script type="application\/json" id="(guia|ficha|escritos)-datos">$/.test(tag));
}

test('preview of the real content: every page is flagged, unindexed and runs only our scripts', async () => {
  const pages = renderSite(await loadContent(contentRoot), opts('preview'));
  for (const [file, html] of pages) {
    assert.match(html, /VERSIÓN DE REVISIÓN/, `${file} lacks the preview banner`);
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/, `${file} is indexable`);
    assert.match(html, /Content-Security-Policy/, `${file} lacks CSP`);
    assert.deepEqual(unexpectedScripts(html), [], `${file} has unexpected scripts`);
    assert.doesNotMatch(html, /src="http/i, `${file} loads an external resource`);
  }
});

test('preview of the real content: every item appears once, and no links are broken', async () => {
  const content = await loadContent(contentRoot);
  const pages = renderSite(content, opts('preview'));
  const all = [...pages.values()].join('\n');
  for (const group of [...content.sections, ...content.states]) {
    for (const it of group.items) {
      const count = all.split(`id="${it.id}"`).length - 1;
      assert.equal(count, 1, `item ${it.id} rendered ${count} times`);
    }
  }
  assert.deepEqual(brokenLinks(pages), []);
});

test('preview of the real content includes the guided questions and the "no te reciben" sheet', async () => {
  const pages = renderSite(await loadContent(contentRoot), opts('preview'));
  const guide = pages.get('que-hago.html');
  assert.ok(guide, 'que-hago.html missing');
  assert.match(guide, /<script src="guia\.js" defer>/);
  assert.match(guide, /id="guia-datos"/);
  assert.match(guide, /name="estado" value="jalisco"/);
  assert.match(guide, /data-key="item:no-esperes"/);
  const sheet = pages.get('si-no-te-reciben.html');
  assert.ok(sheet, 'si-no-te-reciben.html missing');
  assert.match(sheet, /<blockquote class="quote"><p>«Ningún protocolo establecerá plazos de espera/);
});

test('public build of the real content works, and is refused if a required item loses approval', async () => {
  const content = await loadContent(contentRoot);
  assert.doesNotThrow(() => renderSite(selectPublishable(content), opts('public')));
  const required = content.sections.flatMap((s) => s.items).find((i) => i.id === 'no-esperes');
  required.review.status = 'unreviewed';
  assert.throws(() => renderSite(selectPublishable(content), opts('public')), /must be approved first: no-esperes/);
});

test('public build refuses raw content that includes unapproved items', () => {
  assert.throws(() => renderSite(fixture(), opts('public')), /unapproved items: secreto, jal-uno/);
});

test('public build shows approved items only, without review markup', () => {
  const c = fixture();
  assert.deepEqual(validateContent(c, { today: '2026-09-29' }).errors, []);
  const pages = renderSite(selectPublishable(c), opts('public'));
  const all = [...pages.values()].join('\n');
  assert.match(all, /Título no-esperes/);
  assert.match(all, /Fuentes verificadas el 20 de septiembre de 2026/);
  for (const hidden of ['Título secreto', 'nota interna', 'VERSIÓN DE REVISIÓN', 'Sin revisar', 'noindex', 'Otra fuente']) {
    assert.ok(!all.includes(hidden), `public site contains "${hidden}"`);
  }
  assert.ok(!pages.has('estado-jalisco.html'), 'a state with no approved items must not get a page');
  assert.ok(!pages.has('que-hago.html'), 'guided questions must not be published before approval');
  assert.deepEqual(brokenLinks(pages), []);
});

test('preview shows review status, reviewer notes and unconfirmed contacts', () => {
  const pages = renderSite(fixture(), opts('preview'));
  assert.match(pages.get('pasos.html'), /Sin revisar/);
  assert.match(pages.get('pasos.html'), /nota interna pendiente/);
  assert.match(pages.get('estado-jalisco.html'), /sin confirmar por teléfono/);
  assert.match(pages.get('estado-jalisco.html'), /href="tel:\+523315145422"/);
});

test('quotes are rendered with their source and locator', () => {
  const html = renderSite(fixture(), opts('preview')).get('pasos.html');
  assert.match(html, /<blockquote class="quote"><p>«Ningún plazo de espera\.»<\/p><footer>Ley, art\. 80<\/footer><\/blockquote>/);
});

test('content text is HTML-escaped', () => {
  const c = fixture();
  c.sections[0].items[0].title = '<script>alert(1)</script>';
  const html = renderSite(c, opts('preview')).get('pasos.html');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.equal(esc(`"'&`), '&quot;&#39;&amp;');
});

test('telHref: local numbers get +52, toll-free numbers do not', () => {
  assert.equal(telHref('33 1514 5422'), 'tel:+523315145422');
  assert.equal(telHref('55 5658 1111'), 'tel:+525556581111');
  assert.equal(telHref('800 028 77 83'), 'tel:8000287783');
});

test('formatDate handles full and partial dates in Spanish', () => {
  assert.equal(formatDate('2026-03-25'), '25 de marzo de 2026');
  assert.equal(formatDate('2025-10'), 'octubre de 2025');
  assert.equal(formatDate('2019'), '2019');
  assert.equal(formatDate(null), '');
});
