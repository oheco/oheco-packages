'use strict';
const target = 'ohos-arm64';
const container = document.querySelector('#packages');
const status = document.querySelector('#status');
const search = document.querySelector('#search');
let packages = [];
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function link(text, href, className) {
  const node = el('a', text, className);
  const url = new URL(href);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) throw new Error('不支持的下载地址');
  node.href = url.href;
  node.rel = 'noopener noreferrer';
  return node;
}
async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = '已复制';
    setTimeout(() => { button.textContent = original; }, 1500);
  } catch { status.textContent = '无法自动复制，请选择命令文本后手动复制。'; }
}
document.querySelector('#copy-install').addEventListener('click', event => copy(document.querySelector('#install-command').textContent, event.currentTarget));
const versionOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
function compareVersions(a, b) {
  // Compare numeric releases first, including SDK versions with four components.
  const parse = value => value.replace(/^v(?=\d)/i, '').split('+')[0].match(/^(\d+(?:\.\d+)*)(.*)$/);
  const left = parse(a.version), right = parse(b.version);
  if (left && right) {
    const release = versionOrder.compare(right[1], left[1]);
    if (release) return release;
    // OHOS revisions follow a release; alpha/beta/rc versions precede it.
    const stage = suffix => /^-ohos(?:[.-]|$)/i.test(suffix) ? 1 : suffix ? -1 : 0;
    return stage(right[2]) - stage(left[2]) || versionOrder.compare(right[2], left[2]);
  }
  return versionOrder.compare(b.version, a.version);
}
function projectURL(href) {
  const url = new URL(href);
  const path = url.pathname.replace(/\/+$/, '').replace(/\.git$/i, '');
  return url.origin + (url.hostname === 'github.com' ? path.toLowerCase() : path);
}
let openVersionMenu;
document.addEventListener('pointerdown', event => {
  if (openVersionMenu && !openVersionMenu.node.contains(event.target)) openVersionMenu.close();
});
window.addEventListener('resize', () => openVersionMenu?.close());
function versionPicker(pkg, versions, onChange) {
  const picker = el('div', undefined, 'version-picker');
  const trigger = el('button', undefined, 'version-trigger');
  trigger.type = 'button';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `versions-${pkg.name}`);
  const value = el('span', undefined, 'version-value');
  const latest = el('span', '最新', 'version-latest');
  trigger.append(el('span', '版本', 'version-label'), value, latest, el('span', undefined, 'version-chevron'));
  const menu = el('div', undefined, 'version-menu');
  menu.hidden = true;
  const heading = el('div', undefined, 'version-menu-heading');
  heading.append(el('span', '选择版本'), el('span', `${versions.length} 个版本`));
  const list = el('div', undefined, 'version-options');
  list.id = `versions-${pkg.name}`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', `${pkg.name} 版本`);
  // Keep focus on the combobox when choosing an option with the pointer.
  list.addEventListener('mousedown', event => event.preventDefault());
  let selected = Math.max(0, versions.findIndex(version => version.version === pkg.latest[target]));
  let active = selected;
  const options = versions.map((version, index) => {
    const option = el('div', undefined, 'version-option');
    option.id = `${list.id}-${index}`;
    option.setAttribute('role', 'option');
    option.append(el('span', version.version, 'version-number'));
    if (version.version === pkg.latest[target]) option.append(el('span', '最新', 'version-latest'));
    const check = el('span', '✓', 'version-check');
    check.setAttribute('aria-hidden', 'true');
    option.append(check);
    option.addEventListener('click', () => choose(index));
    return option;
  });
  list.append(...options);
  menu.append(heading, list);
  picker.append(trigger, menu);
  function refresh() {
    const version = versions[selected].version;
    value.textContent = version;
    latest.hidden = version !== pkg.latest[target];
    trigger.setAttribute('aria-label', `${pkg.name} 版本：${version}${latest.hidden ? '' : '，最新'}`);
    options.forEach((option, index) => option.setAttribute('aria-selected', String(index === selected)));
  }
  function highlight(index) {
    active = Math.max(0, Math.min(options.length - 1, index));
    options.forEach((option, i) => option.classList.toggle('is-active', i === active));
    trigger.setAttribute('aria-activedescendant', options[active].id);
    options[active].scrollIntoView({ block: 'nearest' });
  }
  function close() {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    if (openVersionMenu?.node === picker) openVersionMenu = undefined;
  }
  function open() {
    openVersionMenu?.close();
    menu.hidden = false;
    menu.classList.remove('opens-above');
    list.style.maxHeight = '';
    const bounds = trigger.getBoundingClientRect();
    const height = menu.getBoundingClientRect().height;
    const above = bounds.top - 8, below = window.innerHeight - bounds.bottom - 8;
    const opensAbove = below < height && above > below;
    menu.classList.toggle('opens-above', opensAbove);
    const chrome = height - list.getBoundingClientRect().height;
    list.style.maxHeight = `${Math.max(42, Math.min(240, (opensAbove ? above : below) - chrome - 8))}px`;
    trigger.setAttribute('aria-expanded', 'true');
    openVersionMenu = { node: picker, close };
    highlight(selected);
  }
  function choose(index) {
    selected = index;
    refresh();
    onChange(versions[selected]);
    close();
    trigger.focus();
  }
  trigger.addEventListener('click', () => menu.hidden ? open() : close());
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const wasClosed = menu.hidden;
      if (wasClosed) open();
      if (event.key === 'Home') highlight(0);
      else if (event.key === 'End') highlight(options.length - 1);
      else if (!wasClosed) highlight(active + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (menu.hidden) open();
      else choose(active);
    } else if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') close();
  });
  picker.addEventListener('focusout', event => {
    if (!picker.contains(event.relatedTarget)) close();
  });
  refresh();
  onChange(versions[selected]);
  return picker;
}
function card(pkg) {
  const article = el('article', undefined, 'package');
  const top = el('div', undefined, 'top');
  top.append(el('h3', pkg.name), el('span', 'OHOS · ARM64', 'badge'));
  article.append(top, el('p', pkg.description, 'description'));
  const meta = el('div', undefined, 'metadata');
  if (!pkg.upstream || projectURL(pkg.upstream) === projectURL(pkg.repository)) {
    meta.append(link('项目地址 ↗', pkg.repository));
  } else {
    meta.append(link('上游项目 ↗', pkg.upstream), link('鸿蒙适配 ↗', pkg.repository));
  }
  meta.append(el('span', pkg.license));
  article.append(meta);
  const people = el('div', undefined, 'metadata');
  people.append(el('span', '移植维护：'));
  for (const person of pkg.maintainers) people.append(link(`@${person.github}`, `https://github.com/${encodeURIComponent(person.github)}`));
  article.append(people);
  const row = el('div', undefined, 'version-row');
  const versions = pkg.versions.filter(version => version.artifacts[target]).sort(compareVersions);
  const download = el('a', '下载软件包 ↗', 'download');
  const command = el('div', undefined, 'command');
  const code = el('code');
  const button = el('button', '复制'); button.type = 'button';
  button.addEventListener('click', () => copy(code.textContent, button));
  command.append(code, button);
  const details = el('details', undefined, 'details');
  const summary = el('summary');
  const hash = el('code');
  details.append(summary, hash);
  function updateVersion(version) {
    const artifact = version.artifacts[target];
    download.href = link('', artifact.url).href;
    code.textContent = `oo install ${pkg.name}@${version.version}`;
    summary.textContent = `${(artifact.size / 1024 / 1024).toFixed(1)} MiB · SHA-256`;
    hash.textContent = artifact.sha256;
  }
  if (versions.length) {
    row.append(versionPicker(pkg, versions, updateVersion), download);
    article.append(row, command, details);
  }
  else article.append(el('p', '此平台暂无可用版本', 'notes'));
  if (pkg.notes) article.append(el('p', pkg.notes, 'notes'));
  return article;
}
function render() {
  openVersionMenu?.close();
  const query = search.value.trim().toLocaleLowerCase();
  const matches = packages.filter(pkg => {
    const commands = pkg.versions.flatMap(version => Object.values(version.artifacts).flatMap(artifact => Object.keys(artifact.binaries)));
    return [pkg.name, pkg.description, ...commands].join(' ').toLocaleLowerCase().includes(query);
  });
  container.replaceChildren(...matches.map(card));
  document.querySelector('#count').textContent = String(matches.length);
  status.textContent = matches.length ? '' : '没有找到匹配的工具。';
}
search.addEventListener('input', render);
fetch('./index/v2/index.json').then(response => {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}).then(index => {
  if (index.schema_version !== 2 || !Array.isArray(index.packages)) throw new Error('不支持的索引格式');
  packages = index.packages;
  render();
}).catch(error => { status.textContent = `工具目录暂时无法加载：${error.message}。请稍后重试。`; });
