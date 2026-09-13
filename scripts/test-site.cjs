'use strict';
// Offline DOM-contract regression test; no browser, network or npm dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const site = path.join(__dirname, '../site');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const installCommand = html.match(/<code id="install-command">([^<]+)<\/code>/)?.[1];
assert.equal(installCommand, 'curl -fsSL https://oheco.org/install.sh | zsh');
const canonicalLinks = [...html.matchAll(/<link\b[^>]*\brel="canonical"[^>]*>/g)];
assert.equal(canonicalLinks.length, 1, 'the page must have exactly one canonical URL');
assert.match(canonicalLinks[0][0], /\bhref="https:\/\/oheco\.org\/"/);
assert.equal(fs.readFileSync(path.join(site, 'CNAME'), 'utf8'), 'oheco.org\n');
assert.doesNotMatch(html, /https:\/\/oheco\.github\.io\/oheco-packages\//);
// Keep local previews and project-path deployments working after the domain move.
assert.match(html, /<link rel="stylesheet" href="\.\/style\.css">/);
assert.match(html, /<script src="\.\/app\.js(?:\?[^"<>]*)?" defer><\/script>/);
assert.match(html, /<a href="\.\/index\/v5\/index\.json">/);

class Element {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.attrs = {}; this.style = {};
    this.listeners = {}; this.value = ''; this._text = ''; this.className = '';
    const classes = new Set();
    this.classList = {
      toggle: (name, value) => value ? classes.add(name) : classes.delete(name),
      remove: name => classes.delete(name),
    };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  setAttribute(name, value) { this.attrs[name] = value; }
  removeAttribute(name) { delete this.attrs[name]; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  focus() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { top: 0, bottom: 46, height: 46 }; }
}
const nodes = Object.fromEntries(['packages', 'status', 'search', 'copy-install', 'install-command', 'count'].map(id => ['#' + id, new Element('div')]));
nodes['#install-command'].textContent = installCommand;
const clipboardWrites = [];
const artifact = { url: 'https://example.com/tool.tgz', sha256: 'a'.repeat(64), size: 100, binaries: {} };
const meta = { description: 'fixture', upstream: 'https://example.com/upstream', repository: 'https://github.com/oheco/fixture', license: 'MIT', maintainers: [{ github: 'maintainer' }], latest: { 'ohos-arm64': '2.0' } };
const fixtures = [
  { ...meta, name: 'native', versions: [
    { version: '1.0', artifacts: { 'ohos-arm64': artifact }, dependencies: [{ name: 'runtime', constraint: '>=1 <2', version_basis: 'upstream', platforms: ['ohos-arm64'] }] },
    { version: '2.0', artifacts: { 'ohos-arm64': artifact }, dependencies: [{ name: 'git', constraint: '*' }] },
  ] },
  { ...meta, name: 'node-fixture', package_manager: 'npm', package_name: '@fixture/node', versions: [{ version: '2.0', npm_artifacts: artifact }] },
  { ...meta, name: 'python-fixture', package_manager: 'pip', package_name: 'python-fixture', versions: [{ version: '2.0', pip_artifacts: [artifact] }] },
];
const requests = [];
const context = vm.createContext({
  document: { querySelector: selector => nodes[selector], createElement: tag => new Element(tag), addEventListener() {} },
  window: { addEventListener() {}, innerHeight: 800 },
  navigator: { clipboard: { async writeText(text) { clipboardWrites.push(text); } } },
  URL, console, setTimeout,
  fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ schema_version: 5, packages: fixtures }) };
  },
});
vm.runInContext(fs.readFileSync(path.join(site, 'app.js'), 'utf8'), context);
function all(node) { return [node, ...node.children.flatMap(all)]; }
function hasClass(node, name) { return node.className.split(' ').includes(name); }

(async () => {
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests[0].url, './index/v5/index.json');
  assert.equal(requests[0].options.cache, 'no-cache');
  for (const base of ['https://oheco.org/', 'https://oheco.github.io/oheco-packages/', 'http://127.0.0.1:8080/']) {
    assert.equal(new URL(requests[0].url, base).href, `${base}index/v5/index.json`);
  }
  await nodes['#copy-install'].listeners.click({ currentTarget: nodes['#copy-install'] });
  assert.deepEqual(clipboardWrites, ['curl -fsSL https://oheco.org/install.sh | zsh']);
  assert.equal(nodes['#count'].textContent, '3');
  assert.equal(nodes['#packages'].children.length, 3, 'all managers must be visible');
  const native = nodes['#packages'].children[0];
  const dependencies = all(native).find(node => hasClass(node, 'dependencies'));
  assert.match(dependencies.textContent, /原生软件依赖 · 2\.0/);
  assert.match(dependencies.textContent, /git \* · 包版本 · 全部产物平台/);
  assert.match(nodes['#packages'].children[1].textContent, /<由npm管理> · 非安装状态/);
  assert.match(nodes['#packages'].children[2].textContent, /<由pip管理> · 非安装状态/);
  const firstVersion = all(native).find(node => hasClass(node, 'version-option') && node.textContent.startsWith('1.0'));
  firstVersion.listeners.click();
  assert.match(dependencies.textContent, /原生软件依赖 · 1\.0/);
  assert.match(dependencies.textContent, /runtime >=1 <2 · 上游版本 · ohos-arm64/);
  assert.doesNotMatch(dependencies.textContent, /git \*/);
  assert.match(native.textContent, /oo install native@1\.0/);
  nodes['#search'].value = 'npm';
  nodes['#search'].listeners.input();
  assert.equal(nodes['#packages'].children.length, 1);
  assert.match(nodes['#packages'].textContent, /node-fixture/);
  nodes['#search'].value = 'runtime';
  nodes['#search'].listeners.input();
  assert.equal(nodes['#packages'].children.length, 1, 'dependency names are searchable');
  const compare = vm.runInContext('compareVersionNames', context);
  for (const [a, b, want] of [
    ['1', '01.0.0', 0], ['3.5', '3.5a', -1], ['3.5a', '3.5b', -1], ['3.9a', '3.10', -1],
    ['1.0-ohos.2', '1.0-ohos.10', -1], ['1.0', '1.0-ohos.0', 0],
    ['26.0.0.35-Beta2', '26.0.0.35-Beta10', -1], ['26.0.0.35-Beta', '26.0.0.35', -1],
    ['1-rc.2', '1-rc.10', -1], ['snapshot-9', 'snapshot-10', -1], ['v1', '1', -1],
    ['99999999999999999999999999998', '99999999999999999999999999999', -1],
  ]) {
    assert.equal(compare(a, b), want, `${a} vs ${b}`);
    assert.equal(compare(b, a), -want || 0, `${b} vs ${a}`);
  }
  console.log('PASS official install URL and clipboard, canonical/CNAME, relative paths, v5 loading, all managers, per-version dependencies, search and native sorting');
})().catch(error => { console.error(error); process.exitCode = 1; });
