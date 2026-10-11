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
assert.match(html, /<link rel="stylesheet" href="\.\/style\.css(?:\?[^"<>]*)?">/);
assert.match(html, /<script src="\.\/app\.js(?:\?[^"<>]*)?" defer><\/script>/);
assert.match(html, /<a href="\.\/index\/v6\/index\.json">/);
// The logo is the "oo" mark glued into an infinity sign.
const logo = fs.readFileSync(path.join(site, 'logo.svg'), 'utf8');
const circles = text => [...text.matchAll(/<circle\b[^>]*>/g)].map(match => match[0].replace(/\s+/g, ' ').trim());
const logoCircles = circles(logo);
assert.equal(logoCircles.length, 2, 'the logo is built from two joined rings');
const headerMark = html.match(/<svg class="brand-mark"[\s\S]*?<\/svg>/)?.[0];
assert.ok(headerMark, 'the header shows the logo mark');
assert.deepEqual(circles(headerMark), logoCircles, 'the header mark matches logo.svg');
assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\.\/logo\.svg">/);
assert.match(html, /<span>oheco<\/span>/);

class Element {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.attrs = {}; this.style = {};
    this.listeners = {}; this.value = ''; this._text = ''; this.className = '';
    this.hidden = false; this.open = false;
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
const meta = { description: 'fixture', notes: 'Detailed setup instructions.', upstream: 'https://example.com/upstream', repository: 'https://github.com/oheco/fixture', license: 'MIT', maintainers: [{ github: 'maintainer' }], latest: { 'ohos-arm64': '2.0' } };
const fixtures = [
  { ...meta, name: 'native', versions: [
    { version: '1.0', artifacts: { 'ohos-arm64': artifact }, dependencies: [
      { name: 'runtime', constraint: '>=1 <2', version_basis: 'upstream', platforms: ['ohos-arm64'] },
      { name: 'other-architecture', constraint: '*', platforms: ['ohos-amd64'] },
    ] },
    { version: '2.0', artifacts: { 'ohos-arm64': artifact }, dependencies: [{ name: 'git', constraint: '*' }] },
  ] },
  { ...meta, name: 'node-fixture', package_manager: 'npm', package_name: '@fixture/node', versions: [{ version: '2.0', npm_artifacts: artifact }] },
  { ...meta, name: 'python-fixture', package_manager: 'pip', package_name: 'python-fixture', versions: [{ version: '2.0', pip_artifacts: [{ ...artifact, filename: 'fixture.whl' }] }] },
];
const requests = [];
const context = vm.createContext({
  document: { querySelector: selector => nodes[selector], createElement: tag => new Element(tag), addEventListener() {} },
  window: { addEventListener() {}, innerHeight: 800 },
  navigator: { clipboard: { async writeText(text) { clipboardWrites.push(text); } } },
  URL, console, setTimeout,
  fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ schema_version: 6, packages: fixtures }) };
  },
});
vm.runInContext(fs.readFileSync(path.join(site, 'app.js'), 'utf8'), context);
function all(node) { return [node, ...node.children.flatMap(all)]; }
function hasClass(node, name) { return node.className.split(' ').includes(name); }
function findClass(node, name) { return all(node).find(child => hasClass(child, name)); }
function packageCards() { return all(nodes['#packages']).filter(node => hasClass(node, 'package')); }
function tags(node) { return findClass(node, 'package-tags').children.map(child => child.textContent); }
function searchFor(query) {
  nodes['#search'].value = query;
  nodes['#search'].listeners.input();
}

(async () => {
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests[0].url, './index/v6/index.json');
  assert.equal(requests[0].options.cache, 'no-cache');
  for (const base of ['https://oheco.org/', 'https://oheco.github.io/oheco-packages/', 'http://127.0.0.1:8080/']) {
    assert.equal(new URL(requests[0].url, base).href, `${base}index/v6/index.json`);
  }
  await nodes['#copy-install'].listeners.click({ currentTarget: nodes['#copy-install'] });
  assert.deepEqual(clipboardWrites, ['curl -fsSL https://oheco.org/install.sh | zsh']);
  assert.equal(nodes['#count'].textContent, '3');
  assert.equal(packageCards().length, 3, 'all managers must be visible');
  const [native, npm, pip] = packageCards();
  assert.deepEqual(tags(native), ['移植', 'oo', 'arm64'], 'oo ownership does not imply a HarmonyOS origin');
  assert.deepEqual(tags(npm), ['移植', 'npm', 'arm64']);
  assert.deepEqual(tags(pip), ['移植', 'pip', 'arm64']);
  assert.doesNotMatch(nodes['#packages'].textContent, /非安装状态|<由|oheco · 原生|原生软件依赖|此版本未声明/);
  assert.equal(findClass(npm, 'dependencies').hidden, true);
  assert.equal(findClass(pip, 'dependencies').hidden, true);
  const usage = findClass(native, 'usage-notes');
  assert.equal(usage.tagName, 'details');
  assert.equal(usage.open, false, 'long setup notes start collapsed');
  assert.equal(usage.children[0].textContent, '使用说明');
  assert.match(usage.textContent, /Detailed setup instructions/);
  const dependencies = findClass(native, 'dependencies');
  assert.equal(dependencies.hidden, false);
  assert.match(dependencies.textContent, /git \*/);
  const columns = nodes['#packages'].children;
  assert.equal(columns.length, 2);
  assert.ok(columns[0].contains(native) && columns[1].contains(pip), 'cards belong to separate vertical stacks');
  const versionTrigger = findClass(native, 'version-trigger');
  versionTrigger.listeners.click();
  assert.equal(versionTrigger.attrs['aria-expanded'], 'true');
  assert.equal(findClass(native, 'version-menu').hidden, false);
  const firstVersion = all(native).find(node => hasClass(node, 'version-option') && node.textContent.startsWith('1.0'));
  firstVersion.listeners.click();
  assert.equal(versionTrigger.attrs['aria-expanded'], 'false');
  assert.equal(findClass(native, 'version-menu').hidden, true);
  assert.ok(columns[0].contains(native) && columns[1].contains(pip), 'version changes keep cards in their original column');
  assert.match(dependencies.textContent, /runtime >=1 <2/);
  assert.doesNotMatch(dependencies.textContent, /git \*|other-architecture|ohos-/);
  assert.match(native.textContent, /oo install native@1\.0/);
  const installButton = findClass(native, 'command').children[1];
  await installButton.listeners.click();
  assert.equal(clipboardWrites.at(-1), 'oo install native@1.0');
  searchFor('npm');
  assert.equal(packageCards().length, 1);
  assert.match(nodes['#packages'].textContent, /node-fixture/);
  searchFor('runtime');
  assert.equal(packageCards().length, 1, 'dependency names are searchable');
  searchFor('arm64');
  assert.equal(packageCards().length, 3, 'architecture badges are searchable');
  searchFor('no-such-tool');
  assert.equal(nodes['#count'].textContent, '0');
  assert.match(nodes['#status'].textContent, /没有找到/);

  context.catalogFixture = {
    ...fixtures[0],
    upstream: 'https://github.com/OHECO/fixture.git/',
    latest: { 'ohos-arm64': '2.0', 'ohos-amd64': '2.0' },
  };
  const original = vm.runInContext('card(catalogFixture)', context);
  assert.deepEqual(tags(original), ['原生', 'oo', 'amd64', 'arm64'], 'origin URLs are normalized and each architecture is shown once');
  context.catalogFixture = { ...fixtures[0], name: 'command-line-tools' };
  assert.equal(tags(vm.runInContext('card(catalogFixture)', context))[0], '原生', 'the official HarmonyOS tool bundle is native');

  const packageDirectory = path.join(__dirname, '../packages');
  const catalog = fs.readdirSync(packageDirectory).filter(name => name.endsWith('.json')).sort()
    .map(name => JSON.parse(fs.readFileSync(path.join(packageDirectory, name), 'utf8')));
  context.catalogPackages = catalog;
  nodes['#search'].value = '';
  vm.runInContext('packages = catalogPackages; render()', context);
  assert.equal(packageCards().length, catalog.length, 'every published package renders');
  for (const [index, pkg] of catalog.entries()) {
    const card = packageCards()[index];
    assert.equal(findClass(card, 'description').textContent, pkg.description);
    assert.doesNotMatch(findClass(card, 'description').textContent, /鸿蒙.*原生|已签名|固定依赖的 WASM|适配修订|原样分发/);
    assert.ok(tags(card).includes(pkg.package_manager === 'npm' ? 'npm' : pkg.package_manager === 'pip' ? 'pip' : 'oo'));
    const notes = findClass(card, 'usage-notes');
    if (pkg.notes) assert.equal(notes.open, false);
    else assert.equal(notes, undefined, 'packages without notes do not show an empty disclosure');
    if (!pkg.package_manager) {
      const deps = findClass(card, 'dependencies');
      const latest = pkg.versions.find(version => version.version === pkg.latest['ohos-arm64']);
      assert.equal(deps.hidden, !latest.dependencies?.length);
    }
  }
  searchFor('原生');
  assert.deepEqual(packageCards().map(card => card.children[0].children[0].textContent).sort(), ['command-line-tools', 'oheco', 'oheco-broker']);
  searchFor('deepseek-harness');
  assert.equal(packageCards().length, 1);
  const dsh = packageCards()[0];
  const projects = all(dsh).filter(node => hasClass(node, 'project-delivery'));
  assert.equal(projects.length, 1);
  assert.match(projects[0].textContent, /oo export deepseek-harness@0\.2\.0-rc\.2-ohos\.1 app --output/);
  assert.doesNotMatch(projects[0].textContent, /app-0\.2\.0-rc\.2-ohos\.2/);

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
  console.log(`PASS v6 loading, all ${catalog.length} packages, origin/manager/architecture tags, collapsed notes, version changes, copying, project export, search and version sorting`);
})().catch(error => { console.error(error); process.exitCode = 1; });
