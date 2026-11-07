const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const storage = new Map();
function fileContext(fetch) {
  const context = vm.createContext({
    window: {}, location: { protocol: 'file:' }, crypto: webcrypto, AbortSignal, URL,
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: { createElement: (tag) => ({ tag, append() {} }) },
    fetch, console: { error() {} },
  });
  for (const script of ['config.js', 'community.js', 'components.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), context);
  }
  return context;
}

test('HTML loads ordered classic scripts and relative local assets without redirecting', () => {
  assert.doesNotMatch(html, /type=["']module|location\.replace|href=["']\//);
  const scripts = [...html.matchAll(/<script\b([^>]*)src="([^"]+)"[^>]*>/g)];
  assert.deepEqual(scripts.map((match) => match[2]), ['config.js', 'community.js', 'components.js', 'app.js']);
  for (const [, , asset] of scripts) {
    assert.ok(fs.existsSync(path.join(root, asset)));
    new vm.Script(fs.readFileSync(path.join(root, asset), 'utf8'));
  }
  for (const [, asset] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(https?:|data:|#)/.test(asset)) continue;
    assert.ok(fs.existsSync(path.join(root, asset)), asset);
  }
  const context = fileContext();
  const item = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'))).items[0];
  // Both views resolve the catalog's image path against Archive.
  const images = [];
  context.document.createElement = (tag) => {
    const element = { append() {}, setAttribute() {}, addEventListener() {} };
    if (tag === 'img') images.push(element);
    return element;
  };
  context.window.SoleFitComponents.ShoePreview(item);
  context.window.SoleFitComponents.InventoryCard(item, () => {});
  const imageUrl = new URL(item.image_url, context.window.SOLE_FIT_CONFIG.archiveOrigin).href;
  assert.deepEqual(images.map((image) => image.src), [imageUrl, imageUrl]);
  assert.ok(fs.existsSync(path.join(root, item.image_url)));
});

test('file fetches use the API host and persist votes without cross-site cookies', async () => {
  const calls = [];
  const fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ count: 20 }) }; };
  const first = fileContext(fetch);
  await first.window.SoleFitCommunity.fitRequest('/api/catalog');
  assert.equal(calls[0].url, 'http://127.0.0.1:8002/api/catalog');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.headers['Content-Type'], undefined);
  await first.window.SoleFitCommunity.fitRequest('/api/fit/feedback', { method: 'POST', body: '{}' });
  const token = calls[1].options.headers['X-SoleFit-Voter'];
  assert.match(token, /^[a-f0-9]{64}$/);
  const reopened = fileContext(fetch);
  await reopened.window.SoleFitCommunity.fitRequest('/api/fit/feedback', { method: 'POST', body: '{}' });
  assert.equal(calls[2].options.headers['X-SoleFit-Voter'], token);
  const offline = fileContext(async () => { throw new TypeError('Connection refused'); });
  await assert.rejects(offline.window.SoleFitCommunity.fitRequest('/api/catalog'), /API could not be reached.*START_SOLE\.cmd/);
});
