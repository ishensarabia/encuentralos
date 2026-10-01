import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FUNDAMENTOS, CAMPOS, ESCRITOS, FICHA_PAGE, ESCRITOS_PAGE } from '../site/tools.mjs';
import { buildEscrito, missingFields, fechaLarga } from '../scripts/lib/escritos-logic.mjs';
import { checkFundamentos } from '../scripts/lib/quotes.mjs';
import { bundleGuideScript, buildAssets } from '../scripts/lib/offline.mjs';
import { loadContent, selectPublishable } from '../scripts/lib/content.mjs';
import { renderSite } from '../scripts/lib/render.mjs';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceTexts = path.join(repo, 'docs', 'source-texts');
const TODAY = '2026-10-01';
const full = {
  ciudad: 'Guadalajara, Jalisco', destinatario: 'Comisión de Búsqueda de Personas del Estado de Jalisco',
  nombre: 'Ana Pérez', parentesco: 'madre', telefono: '33 1234 5678', correo: '', domicilio: '',
  nombre_pd: 'Luis Gómez', edad: '24', sexo: 'hombre', curp: '', senas: 'Tatuaje en el brazo', vestimenta: 'Playera azul',
  fecha_hechos: '2026-09-28', lugar_hechos: 'Zapopan', hechos: 'Salió al trabajo y no volvió.',
  autoridad: 'Agencia del Ministerio Público', fecha_rechazo: '2026-09-29', motivo: 'Dijeron que esperara 72 horas.',
};
const build = (type, values = full) => buildEscrito(type, values, ESCRITOS[type], CAMPOS, FUNDAMENTOS, TODAY);

test('every article the documents quote appears word for word in the law text', async () => {
  assert.deepEqual(await checkFundamentos(FUNDAMENTOS, sourceTexts), []);
});

test('a changed word in an article is caught', async () => {
  const bad = { x: { art: 'art. 89', text: FUNDAMENTOS.busqueda_inmediata.text.replace('de inmediato', 'pronto') } };
  assert.equal((await checkFundamentos(bad, sourceTexts)).length, 1);
});

test('every document only uses fields and articles that exist, and quotes only from the law', () => {
  for (const def of Object.values(ESCRITOS)) for (const id of def.fields) assert.ok(CAMPOS[id], `unknown field ${id}`);
  for (const type of Object.keys(ESCRITOS)) {
    for (const m of build(type).text.matchAll(/«([^»]+)»/g)) {
      assert.ok(Object.values(FUNDAMENTOS).some((f) => f.text === m[1]), `quote not from FUNDAMENTOS in ${type}`);
    }
  }
});

test('the report names the person, asks for the folio and quotes the law', () => {
  const { text, missing } = build('reporte');
  assert.deepEqual(missing, []);
  assert.match(text, /^Guadalajara, Jalisco, a 1 de octubre de 2026/);
  assert.match(text, /Yo, Ana Pérez, madre de Luis Gómez/);
  assert.match(text, /28 de septiembre de 2026 en Zapopan/);
  assert.match(text, /folio único de búsqueda/);
  assert.match(text, /Art\. 89: «Cuando la Comisión Nacional/);
  assert.match(text, /no se condicione a que presente la CURP/, 'no CURP given: say it cannot be required');
  assert.doesNotMatch(text, /protocolo de búsqueda especializada/, 'adult: no minors paragraph');
  assert.doesNotMatch(text, /COMPLETA/);
});

test('a missing person under 18 adds the special-protocol request and article 7', () => {
  const { text } = build('reporte', { ...full, edad: '15', curp: 'ABCD123456HJCXXX01' });
  assert.match(text, /menor de 18 años/);
  assert.match(text, /Art\. 7: «Las niñas, niños y adolescentes/);
  assert.match(text, /CURP: ABCD123456HJCXXX01/);
  assert.doesNotMatch(text, /no se condicione a que presente la CURP/);
});

test('required fields left empty show as visible blanks and are reported as missing', () => {
  const { text, missing } = build('reporte', { ...full, nombre: '', hechos: '' });
  assert.deepEqual(missing.sort(), ['hechos', 'nombre']);
  assert.match(text, /\[COMPLETA: tu nombre completo\]/);
  assert.match(text, /\[COMPLETA: qué pasó, con tus palabras\]/);
  assert.ok(missingFields(ESCRITOS.avance, CAMPOS, {}).includes('nombre'));
});

test('the refusal document records who, when and what was said, and asks for a receipt', () => {
  const { text } = build('rechazo', { ...full, servidor: 'una persona en la ventanilla 2' });
  assert.match(text, /29 de septiembre de 2026 acudí a Agencia del Ministerio Público/);
  assert.match(text, /Me atendió una persona en la ventanilla 2/);
  assert.match(text, /Dijeron que esperara 72 horas\./);
  assert.match(text, /Art\. 80, último párrafo: «Ningún protocolo establecerá plazos de espera/);
  assert.match(text, /sello o firma de recibido/);
});

test('the information request asks for access and a free copy, and adds proposed steps only if given', () => {
  const base = build('avance', { ...full, folio: 'F-123', carpeta: 'C-9' }).text;
  assert.match(base, /folio único de búsqueda F-123 y carpeta de investigación C-9/);
  assert.match(base, /copia simple, sin costo/);
  assert.doesNotMatch(base, /diligencias que propongo/);
  const more = build('avance', { ...full, diligencias: 'Revisar cámaras' }).text;
  assert.match(more, /diligencias que propongo:\n {4}Revisar cámaras/);
  assert.match(more, /Art\. 138, fracción II/);
});

test('an unknown document type fails loudly', () => {
  assert.throws(() => buildEscrito('otro', full, ESCRITOS.reporte, CAMPOS, FUNDAMENTOS, TODAY), /unknown document type/);
});

test('fechaLarga handles ISO dates and leaves anything else alone', () => {
  assert.equal(fechaLarga('2026-01-05'), '5 de enero de 2026');
  assert.equal(fechaLarga('ayer'), 'ayer');
  assert.equal(fechaLarga(''), '');
});

test('the browser scripts do nothing on a page without their form', async () => {
  const read = (...p) => readFile(path.join(repo, ...p), 'utf8');
  const bundle = bundleGuideScript(await read('scripts', 'lib', 'escritos-logic.mjs'), await read('site', 'escritos-ui.js'));
  assert.doesNotMatch(bundle, /^\s*export /m);
  const context = { document: { getElementById: () => null } };
  assert.doesNotThrow(() => vm.runInNewContext(bundle, context));
  const ficha = await read('site', 'ficha-ui.js');
  assert.doesNotThrow(() => vm.runInNewContext(ficha, context));
});

test('the tool pages are built, linked from the home page, cached for offline use and talk to no one', async () => {
  const read = (...p) => readFile(path.join(repo, ...p), 'utf8');
  const content = await loadContent(path.join(repo, 'content'));
  const pages = renderSite(selectPublishable(content), { mode: 'public', css: 'body{}', builtOn: TODAY });
  for (const p of [FICHA_PAGE, ESCRITOS_PAGE]) {
    assert.ok(pages.has(p.file));
    assert.match(pages.get('index.html'), new RegExp(`href="${p.file}"`));
    assert.match(pages.get(p.file), new RegExp(`<script src="${p.script}"`));
    assert.doesNotMatch(pages.get(p.file), /<form[^>]*\saction=|https?:\/\//);
  }
  const assets = buildAssets(pages, {
    guideLogic: await read('scripts', 'lib', 'guide-logic.mjs'), guideUi: await read('site', 'guide-ui.js'),
    appJs: await read('site', 'app.js'), icon: await read('site', 'icon.svg'),
    fichaUi: await read('site', 'ficha-ui.js'), escritosLogic: await read('scripts', 'lib', 'escritos-logic.mjs'), escritosUi: await read('site', 'escritos-ui.js'),
  });
  assert.ok(assets.has('ficha.js') && assets.has('escritos.js'));
  assert.match(assets.get('sw.js'), /ficha\.html/);
  assert.match(assets.get('sw.js'), /escritos\.js/);
});
