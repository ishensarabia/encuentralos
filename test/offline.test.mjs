import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildAssets } from '../scripts/lib/offline.mjs';

const inputs = { guideLogic: 'export function selectSteps() { return []; }', guideUi: '', appJs: '// app', icon: '<svg/>' };
const cachedFiles = (sw) => JSON.parse(sw.match(/var FILES = (\[.*\]);/)[1]);
const cacheName = (sw) => sw.match(/var CACHE = '([^']+)'/)[1];

test('the service worker caches every page and asset', () => {
  const pages = new Map([['index.html', 'a'], ['pasos.html', 'b'], ['que-hago.html', 'c']]);
  const assets = buildAssets(pages, inputs);
  const files = cachedFiles(assets.get('sw.js'));
  for (const f of ['index.html', 'pasos.html', 'que-hago.html', 'guia.js', 'app.js', 'icon.svg', 'manifest.webmanifest']) {
    assert.ok(files.includes(f), `${f} is not cached for offline use`);
  }
  assert.ok(!files.includes('sw.js'));
});

test('the cache name changes when any page changes, so phones get corrections', () => {
  const before = buildAssets(new Map([['index.html', 'Tel 33 1514 5422']]), inputs).get('sw.js');
  const after = buildAssets(new Map([['index.html', 'Tel 33 1514 5423']]), inputs).get('sw.js');
  assert.notEqual(cacheName(before), cacheName(after));
});

test('guia.js is only built when the guided questions page exists', () => {
  assert.ok(buildAssets(new Map([['que-hago.html', 'x']]), inputs).has('guia.js'));
  assert.ok(!buildAssets(new Map([['index.html', 'x']]), inputs).has('guia.js'));
});

test('the generated service worker and manifest are valid', () => {
  const assets = buildAssets(new Map([['index.html', 'x']]), inputs);
  assert.doesNotThrow(() => new vm.Script(assets.get('sw.js')));
  const manifest = JSON.parse(assets.get('manifest.webmanifest'));
  assert.equal(manifest.lang, 'es-MX');
  assert.equal(manifest.start_url, 'index.html');
});
