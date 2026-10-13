'use strict';
// Offline DOM-contract regression test; no browser, network or npm dependencies.
// Geometry is supplied by fixtures: this verifies placement/state contracts, not browser rendering.
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
    this.hidden = false; this.open = false; this.parentNode = null;
    this.geometry = { width: 46, height: 46, top: 0, left: 0 };
    this.geometryReads = [];
    const classes = () => new Set(this.className.split(/\s+/).filter(Boolean));
    const updateClasses = names => { this.className = [...names].join(' '); };
    this.classList = {
      contains: name => classes().has(name),
      add: (...names) => updateClasses(new Set([...classes(), ...names])),
      remove: (...names) => updateClasses(new Set([...classes()].filter(name => !names.includes(name)))),
      toggle: (name, force) => {
        const names = classes();
        const enabled = force === undefined ? !names.has(name) : Boolean(force);
        if (enabled) names.add(name); else names.delete(name);
        updateClasses(names);
        return enabled;
      },
    };
  }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...children) {
    for (const child of children) {
      if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(node => node !== child);
      child.parentNode = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this._text = ''; this.children = [];
    this.append(...children);
  }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  focus() {}
  scrollIntoView() {}
  getBoundingClientRect() {
    const width = this.style.width ? parseFloat(this.style.width) : this.geometry.width;
    const height = this.style.height ? parseFloat(this.style.height) :
      typeof this.geometry.height === 'function' ? this.geometry.height(width) : this.geometry.height;
    const top = this.style.top ? parseFloat(this.style.top) : this.geometry.top;
    const left = this.style.left ? parseFloat(this.style.left) : this.geometry.left;
    const rect = { width, height, top, left, bottom: top + height, right: left + width };
    this.geometryReads.push(rect);
    return rect;
  }
}
const nodes = Object.fromEntries(['packages', 'status', 'search', 'copy-install', 'install-command', 'count'].map(id => ['#' + id, new Element('div')]));
const container = nodes['#packages'];
container.geometry.width = 1056;
container.columnGap = '22px';
nodes['#install-command'].textContent = installCommand;
const animationFrames = new Map();
let nextFrame = 0;
function requestAnimationFrame(callback) {
  animationFrames.set(++nextFrame, callback);
  return nextFrame;
}
function flushAnimationFrame() {
  const callbacks = [...animationFrames.values()];
  animationFrames.clear();
  for (const callback of callbacks) callback(0);
}
const singleColumn = {
  media: '(max-width: 700px)', matches: false, listeners: {},
  addEventListener(name, callback) { this.listeners[name] = callback; },
  setMatches(matches) {
    if (this.matches === matches) return;
    this.matches = matches;
    this.listeners.change?.({ matches, media: this.media });
  },
};
const resizeObservers = [];
class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observed = new Set();
    resizeObservers.push(this);
  }
  observe(target) { this.observed.add(target); }
  unobserve(target) { this.observed.delete(target); }
  disconnect() { this.observed.clear(); }
  notify(...targets) {
    for (const target of targets) assert.ok(this.observed.has(target), 'resize notifications target observed elements');
    this.callback(targets.map(target => ({ target, contentRect: target.getBoundingClientRect() })), this);
  }
}
const getComputedStyle = node => ({ columnGap: node.columnGap || '0px' });
const window = {
  listeners: {}, innerHeight: 800,
  addEventListener(name, callback) { this.listeners[name] = callback; },
  matchMedia(query) { assert.equal(query, singleColumn.media); return singleColumn; },
  requestAnimationFrame, ResizeObserver, getComputedStyle,
};
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
  { ...meta, name: 'zebra-fixture', versions: [{ version: '2.0', artifacts: { 'ohos-arm64': artifact } }] },
];
// Deliberately put both the first and last alphabetical names out of position.
const indexFixtures = [fixtures[2], fixtures[3], fixtures[0], fixtures[1]];
const requests = [];
const context = vm.createContext({
  document: { querySelector: selector => nodes[selector], createElement: tag => new Element(tag), addEventListener() {} },
  window, requestAnimationFrame, ResizeObserver, getComputedStyle,
  navigator: { clipboard: { async writeText(text) { clipboardWrites.push(text); } } },
  URL, console, setTimeout,
  fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ schema_version: 6, packages: indexFixtures }) };
  },
});
vm.runInContext(fs.readFileSync(path.join(site, 'app.js'), 'utf8'), context);
function all(node) { return [node, ...node.children.flatMap(all)]; }
function hasClass(node, name) { return node.className.split(' ').includes(name); }
function findClass(node, name) { return all(node).find(child => hasClass(child, name)); }
function packageCards() { return all(container).filter(node => hasClass(node, 'package')); }
function cardNames() { return packageCards().map(card => card.children[0].children[0].textContent); }
function assertDirectCards(cards, message) {
  assert.equal(container.children.length, cards.length, `${message}: one container holds every card`);
  for (const [index, card] of cards.entries()) {
    assert.equal(container.children[index], card, `${message}: card ${index} retains its object and DOM position`);
    assert.equal(card.tagName, 'article');
    assert.equal(card.parentNode, container);
  }
}
function assertLayout(cards, positions, width, height, message) {
  assertDirectCards(cards, message);
  for (const [index, card] of cards.entries()) {
    const [left, top] = positions[index];
    assert.equal(card.style.width, `${width}px`, `${message}: ${index} width`);
    assert.equal(card.style.left, `${left}px`, `${message}: ${index} column`);
    assert.equal(card.style.top, `${top}px`, `${message}: ${index} top includes preceding heights and gaps`);
    assert.equal(card.geometryReads.at(-1).width, width, `${message}: height was measured at the assigned width`);
  }
  assert.equal(container.style.height, `${height}px`, `${message}: container ends at the lowest card without a trailing gap`);
  assert.equal(animationFrames.size, 0, `${message}: one animation frame completes the layout`);
}
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
  assert.equal(nodes['#count'].textContent, '4');
  assert.equal(packageCards().length, 4, 'all managers must be visible');
  assert.deepEqual(cardNames(), ['native', 'node-fixture', 'python-fixture', 'zebra-fixture'], 'a shuffled index renders in alphabetical DOM order');
  const cards = packageCards();
  const [native, npm, pip] = cards;
  assert.ok(container.classList.contains('is-masonry'), 'an available ResizeObserver enables masonry');
  assert.equal(resizeObservers.length, 1);
  const resizeObserver = resizeObservers[0];
  assert.equal(resizeObserver.observed.size, cards.length + 1, 'observe every card and the container');
  for (const node of [container, ...cards]) assert.ok(resizeObserver.observed.has(node));
  // Both initial columns have height zero; equal first-card heights also tie the next choice to the left.
  assertLayout(cards, [[0, 0], [539, 0], [0, 68], [539, 68]], 517, 114, 'equal-height cards start at top zero, left then right');
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
  const versionTrigger = findClass(native, 'version-trigger');
  versionTrigger.listeners.click();
  assert.equal(versionTrigger.attrs['aria-expanded'], 'true');
  assert.equal(findClass(native, 'version-menu').hidden, false);
  const firstVersion = all(native).find(node => hasClass(node, 'version-option') && node.textContent.startsWith('1.0'));
  firstVersion.listeners.click();
  assert.equal(versionTrigger.attrs['aria-expanded'], 'false');
  assert.equal(findClass(native, 'version-menu').hidden, true);
  assertDirectCards(cards, 'a version selection retains cards in alphabetical DOM order');
  assert.match(dependencies.textContent, /runtime >=1 <2/);
  assert.doesNotMatch(dependencies.textContent, /git \*|other-architecture|ohos-/);
  assert.match(native.textContent, /oo install native@1\.0/);
  const installButton = findClass(native, 'command').children[1];
  await installButton.listeners.click();
  assert.equal(clipboardWrites.at(-1), 'oo install native@1.0');

  usage.open = true;
  function assertRetainedState(message) {
    assertDirectCards(cards, message);
    assert.deepEqual(cardNames(), ['native', 'node-fixture', 'python-fixture', 'zebra-fixture'], `${message}: alphabetical DOM order`);
    assert.equal(findClass(native, 'version-trigger'), versionTrigger, `${message}: retain the version picker`);
    assert.equal(findClass(native, 'version-value').textContent, '1.0', `${message}: retain the chosen version`);
    assert.equal(firstVersion.attrs['aria-selected'], 'true');
    assert.equal(findClass(native, 'usage-notes'), usage, `${message}: retain the disclosure object`);
    assert.equal(usage.open, true, `${message}: retain expanded usage notes`);
    assert.match(findClass(native, 'command').textContent, /oo install native@1\.0/);
  }
  // At 1056px / gap 22px the columns are 517px. These heights defeat alternating placement:
  // cards 2, 3 and 4 all belong to the lower right column, at tops 0, 122 and 244.
  native.geometry.height = width => width < 500 ? 420 : 300;
  npm.geometry.height = 100;
  pip.geometry.height = 100;
  cards[3].geometry.height = 200;
  resizeObserver.notify(...cards);
  resizeObserver.notify(native);
  assert.equal(animationFrames.size, 1, 'multiple card resize callbacks share one animation frame');
  assert.equal(pip.style.left, '0px', 'card resize callbacks defer placement until the frame');
  flushAnimationFrame();
  assertLayout(cards, [[0, 0], [539, 0], [539, 122], [539, 244]], 517, 444, 'unequal heights choose the shortest column repeatedly');
  assertRetainedState('height-driven layout');

  resizeObserver.notify(container);
  assert.equal(animationFrames.size, 0, 'a container height notification at unchanged width does not create a resize loop');
  npm.geometry.height = 350;
  resizeObserver.notify(npm);
  assert.equal(animationFrames.size, 1, 'a changed card height schedules layout');
  flushAnimationFrame();
  assertLayout(cards, [[0, 0], [539, 0], [0, 322], [539, 372]], 517, 572, 'a taller card changes subsequent columns and container height');
  assertRetainedState('changed card height');

  container.geometry.width = 800;
  resizeObserver.notify(container);
  assert.equal(animationFrames.size, 1, 'a container width notification schedules layout');
  flushAnimationFrame();
  // Width-dependent height changes from 300px to 420px only after the new width is assigned.
  assertLayout(cards, [[0, 0], [411, 0], [411, 372], [0, 442]], 389, 642, 'new widths are applied before measuring responsive heights');
  assertRetainedState('container width change');

  container.geometry.width = 900;
  window.listeners.resize();
  window.listeners.resize();
  assert.equal(animationFrames.size, 1, 'window resize independently schedules and deduplicates layout');
  flushAnimationFrame();
  assertLayout(cards, [[0, 0], [461, 0], [461, 372], [0, 442]], 439, 642, 'window resize recomputes column width');
  assertRetainedState('window resize');

  container.geometry.width = 640;
  singleColumn.setMatches(true);
  assert.equal(animationFrames.size, 1, 'media query changes independently schedule layout');
  flushAnimationFrame();
  assertLayout(cards, [[0, 0], [0, 322], [0, 694], [0, 816]], 640, 1016, 'one column uses full width with a single gap between cards');
  assertRetainedState('single-column media query');

  container.geometry.width = 1056;
  singleColumn.setMatches(false);
  window.listeners.resize();
  assert.equal(animationFrames.size, 1, 'media and window events share one pending frame');
  flushAnimationFrame();
  assertLayout(cards, [[0, 0], [539, 0], [0, 322], [539, 372]], 517, 572, 'returning to two columns remeasures and balances heights');
  assertRetainedState('return to two columns');

  searchFor('npm');
  assert.equal(packageCards().length, 1);
  assert.match(nodes['#packages'].textContent, /node-fixture/);
  searchFor('runtime');
  assert.equal(packageCards().length, 1, 'dependency names are searchable');
  searchFor('arm64');
  assert.equal(packageCards().length, 4, 'architecture badges are searchable');
  searchFor('no-such-tool');
  assert.equal(nodes['#count'].textContent, '0');
  assert.match(nodes['#status'].textContent, /没有找到/);
  assert.equal(container.children.length, 0, 'empty search removes all cards');
  assert.equal(container.style.height, '0px', 'empty search clears the previous masonry height');
  assert.equal(resizeObserver.observed.size, 1, 'empty search disconnects old card observations');
  assert.ok(resizeObserver.observed.has(container));

  context.catalogFixture = {
    ...fixtures[0],
    upstream: 'https://github.com/OHECO/fixture.git/',
    latest: { 'ohos-arm64': '2.0', 'ohos-amd64': '2.0' },
  };
  const original = vm.runInContext('card(catalogFixture)', context);
  assert.deepEqual(tags(original), ['原生', 'oo', 'amd64', 'arm64'], 'origin URLs are normalized and each architecture is shown once');
  context.catalogFixture = { ...fixtures[0], name: 'command-line-tools' };
  assert.equal(tags(vm.runInContext('card(catalogFixture)', context))[0], '原生', 'the official HarmonyOS tool bundle is native');
  context.catalogFixture = { ...fixtures[0], notes: '' };
  assert.equal(findClass(vm.runInContext('card(catalogFixture)', context), 'usage-notes'), undefined, 'packages without notes do not show an empty disclosure');

  const packageDirectory = path.join(__dirname, '../packages');
  // File names sort oheco-broker.json before oheco.json; the UI sorts the actual package names.
  const catalog = fs.readdirSync(packageDirectory).filter(name => name.endsWith('.json'))
    .map(name => JSON.parse(fs.readFileSync(path.join(packageDirectory, name), 'utf8')))
    .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  context.catalogPackages = catalog;
  nodes['#search'].value = '';
  vm.runInContext('packages = catalogPackages; render()', context);
  assert.equal(packageCards().length, catalog.length, 'every published package renders');
  assert.deepEqual(cardNames(), catalog.map(pkg => pkg.name), 'real package names determine alphabetical DOM order');
  assertDirectCards(packageCards(), 'real catalog cards stay directly in one container');
  for (const [index, pkg] of catalog.entries()) {
    const card = packageCards()[index];
    assert.equal(findClass(card, 'description').textContent, pkg.description);
    assert.doesNotMatch(findClass(card, 'description').textContent, /鸿蒙.*原生|已签名|固定依赖的 WASM|适配修订|原样分发/);
    assert.ok(tags(card).includes(pkg.package_manager === 'npm' ? 'npm' : pkg.package_manager === 'pip' ? 'pip' : 'oo'));
    assert.ok(typeof pkg.notes === 'string' && pkg.notes.trim(), `${pkg.name} publishes usage notes`);
    const notes = findClass(card, 'usage-notes');
    assert.ok(notes, `${pkg.name} renders usage notes`);
    assert.equal(notes.tagName, 'details');
    assert.equal(notes.open, false, `${pkg.name} usage notes start collapsed`);
    assert.equal(notes.children[0].textContent, '使用说明');
    assert.equal(notes.children[1].textContent, pkg.notes, `${pkg.name} renders its complete instructions`);
    if (!pkg.package_manager) {
      const deps = findClass(card, 'dependencies');
      const latest = pkg.versions.find(version => version.version === pkg.latest['ohos-arm64']);
      assert.equal(deps.hidden, !latest.dependencies?.length);
    }
  }
  searchFor('原生');
  assert.deepEqual(cardNames(), ['command-line-tools', 'dsh-godot-control', 'oheco', 'oheco-broker'], 'filtered native packages retain alphabetical DOM order');
  searchFor('deepseek-harness');
  assert.equal(packageCards().length, 1);
  const dsh = packageCards()[0];
  const projects = all(dsh).filter(node => hasClass(node, 'project-delivery'));
  assert.equal(projects.length, 1);
  assert.match(projects[0].textContent, /oo export deepseek-harness@0\.2\.0-rc\.2-ohos\.1 app --output/);
  assert.doesNotMatch(projects[0].textContent, /app-0\.2\.0-rc\.2-ohos\.2/);
  await findClass(projects[0], 'command').children[1].listeners.click();
  assert.equal(clipboardWrites.at(-1), 'oo export deepseek-harness@0.2.0-rc.2-ohos.1 app --output ./deepseek-harness-app');

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
  console.log(`PASS v6 loading, all ${catalog.length} packages with usage notes, alphabetical DOM order, shortest-column masonry geometry, resize/media relayout and retained card/version/details state, origin/manager/architecture tags, version changes, copying, project export, search and version sorting (fake DOM geometry; not a browser rendering test)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
