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
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function compareNumber(a, b) {
  a = a.replace(/^0+/, ''); b = b.replace(/^0+/, '');
  return Math.sign(a.length - b.length) || compareText(a, b);
}
function naturalCompare(a, b) {
  const left = a.match(/[0-9]+|[^0-9]+/g) || [], right = b.match(/[0-9]+|[^0-9]+/g) || [];
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const an = /^[0-9]/.test(left[i]), bn = /^[0-9]/.test(right[i]);
    const result = an && bn ? compareNumber(left[i], right[i]) : an !== bn ? (an ? -1 : 1) : compareText(left[i], right[i]);
    if (result) return result;
  }
  return Math.sign(left.length - right.length);
}
function nativeVersion(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(value)) return null;
  const revision = value.match(/-ohos\.([0-9]+)$/);
  if (revision) value = value.slice(0, revision.index);
  if (value.includes('-ohos.')) return null;
  const match = value.match(/^([0-9]+(?:\.[0-9]+)*)([a-z]?)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$/);
  return match && { core: match[1].split('.'), letter: match[2], pre: match[3] || '', revision: revision?.[1] || '0' };
}
function comparePrerelease(a, b) {
  if (a === b) return 0;
  if (!a || !b) return a ? -1 : 1;
  const left = a.split(/[.-]/), right = b.split(/[.-]/);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const result = naturalCompare(left[i], right[i]);
    if (result) return result;
  }
  return Math.sign(left.length - right.length);
}
function compareVersionNames(a, b) {
  // Display order mirrors catalog.CompareVersions, not a global SemVer parser.
  // External package installation/version resolution remains with npm or pip.
  const left = nativeVersion(a), right = nativeVersion(b);
  if (left && right) {
    for (let i = 0; i < Math.max(left.core.length, right.core.length); i++) {
      const result = compareNumber(left.core[i] || '0', right.core[i] || '0');
      if (result) return result;
    }
    return compareText(left.letter, right.letter) || comparePrerelease(left.pre, right.pre) || compareNumber(left.revision, right.revision);
  }
  if (Boolean(left) !== Boolean(right)) return left ? 1 : -1;
  return naturalCompare(a, b) || compareText(a, b);
}
function compareVersions(a, b) { return -compareVersionNames(a.version, b.version); }
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
  const manager = pkg.package_manager || 'oheco';
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
  meta.append(el('span', manager === 'oheco' ? 'oheco · 原生' : `${manager} · ${pkg.package_name}`));
  if (manager !== 'oheco') meta.append(el('span', `<由${manager}管理> · 非安装状态`));
  article.append(meta);
  const people = el('div', undefined, 'metadata');
  people.append(el('span', '移植维护：'));
  for (const person of pkg.maintainers) people.append(link(`@${person.github}`, `https://github.com/${encodeURIComponent(person.github)}`));
  article.append(people);
  const row = el('div', undefined, 'version-row');
  const versions = pkg.versions.filter(version => manager === 'oheco' ?
    version.artifacts?.[target] || Object.keys(version.projects || {}).length : pkg.latest[target]).sort(compareVersions);
  const download = el('div');
  const command = el('div', undefined, 'command');
  const code = el('code');
  const button = el('button', '复制'); button.type = 'button';
  button.addEventListener('click', () => copy(code.textContent, button));
  command.append(code, button);
  const details = el('details', undefined, 'details');
  const summary = el('summary');
  const hash = el('code');
  details.append(summary, hash);
  const projects = el('div');
  const dependencies = el('section', undefined, 'dependencies');
  function updateVersion(version) {
    dependencies.replaceChildren();
    if (manager === 'oheco') {
      dependencies.append(el('strong', `原生软件依赖 · ${version.version}`));
      if (!version.dependencies?.length) dependencies.append(el('p', '此版本未声明原生软件依赖。', 'notes'));
      else {
        const list = el('ul');
        for (const dependency of version.dependencies) {
          const item = el('li');
          const basis = dependency.version_basis === 'upstream' ? '上游版本' : '包版本';
          const platforms = dependency.platforms?.length ? dependency.platforms.join(', ') : '全部产物平台';
          const applies = !dependency.platforms?.length || dependency.platforms.includes(target);
          item.append(el('code', `${dependency.name} ${dependency.constraint}`), el('span', ` · ${basis} · ${platforms}${applies ? '' : '（不适用于当前平台）'}`));
          list.append(item);
        }
        dependencies.append(list);
      }
    } else dependencies.append(el('p', `依赖由 ${manager} 在所选环境中即时解析；此页面不记录或判断安装状态。`, 'notes'));
    const artifacts = (manager === 'pip' ? version.pip_artifacts || [] : [manager === 'npm' ? version.npm_artifacts : version.artifacts?.[target]]).filter(Boolean);
    download.replaceChildren(...artifacts.map(artifact => link(
      manager === 'pip' ? `${artifact.filename} ↗` : '下载软件包 ↗', artifact.url, 'download')));
    code.textContent = `oo install ${pkg.name}@${version.version}`;
    summary.textContent = `${(artifacts.reduce((total, artifact) => total + artifact.size, 0) / 1024 / 1024).toFixed(1)} MiB · SHA-256`;
    hash.textContent = artifacts.map(artifact => `${artifact.filename ? artifact.filename + '\n' : ''}${artifact.sha256}`).join('\n');
    command.hidden = details.hidden = artifacts.length === 0;
    projects.replaceChildren(...Object.entries(version.projects || {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, project]) => {
      const section = el('div', undefined, 'project-delivery');
      const meta = el('div', undefined, 'metadata');
      meta.append(el('span', `DevEco 项目 · ${name}`), link('下载项目 ↗', project.url, 'download'));
      section.append(meta);
      if (project.description) section.append(el('p', project.description, 'notes'));
      const command = el('div', undefined, 'command');
      const code = el('code', `oo export ${pkg.name}@${version.version} ${name} --output ./${pkg.name}-${name}`);
      const button = el('button', '复制'); button.type = 'button';
      button.addEventListener('click', () => copy(code.textContent, button));
      command.append(code, button);
      const details = el('details', undefined, 'details');
      details.append(el('summary', `${(project.size / 1024 / 1024).toFixed(1)} MiB · SHA-256`), el('code', project.sha256));
      section.append(command, details);
      return section;
    }));
  }
  if (versions.length) {
    row.append(versionPicker(pkg, versions, updateVersion), download);
    article.append(row, command, details, dependencies, projects);
  }
  else article.append(el('p', '此平台暂无可用版本', 'notes'));
  if (pkg.notes) article.append(el('p', pkg.notes, 'notes'));
  return article;
}
function render() {
  openVersionMenu?.close();
  const query = search.value.trim().toLocaleLowerCase();
  const matches = packages.filter(pkg => {
    const commands = pkg.versions.flatMap(version => Object.values(version.artifacts || {}).flatMap(artifact => Object.keys(artifact.binaries)));
    const projects = pkg.versions.flatMap(version => Object.entries(version.projects || {}).flatMap(([name, project]) => [name, project.description || '']));
    const dependencies = pkg.versions.flatMap(version => (version.dependencies || []).map(dependency => dependency.name));
    return [pkg.name, pkg.package_manager || 'oheco', pkg.package_name || '', pkg.description, ...commands, ...projects, ...dependencies].join(' ').toLocaleLowerCase().includes(query);
  });
  container.replaceChildren(...matches.map(card));
  document.querySelector('#count').textContent = String(matches.length);
  status.textContent = matches.length ? '' : '没有找到匹配的工具。';
}
search.addEventListener('input', render);
let loadingIndex = false;
let loadedPackages;
async function refreshIndex() {
  if (loadingIndex) return;
  loadingIndex = true;
  try {
    // Pages caches files for ten minutes; revalidate release metadata on each visit.
    const response = await fetch('./index/v5/index.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const index = await response.json();
    if (index.schema_version !== 5 || !Array.isArray(index.packages)) throw new Error('不支持的索引格式');
    const updatedPackages = JSON.stringify(index.packages);
    if (updatedPackages !== loadedPackages) {
      packages = index.packages;
      render();
      loadedPackages = updatedPackages;
    }
  } catch (error) {
    // Retain a usable catalog when a background refresh fails.
    if (loadedPackages === undefined) status.textContent = `工具目录暂时无法加载：${error.message}。请稍后重试。`;
  } finally {
    loadingIndex = false;
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshIndex();
});
window.addEventListener('pageshow', event => {
  if (event.persisted) refreshIndex();
});
refreshIndex();
