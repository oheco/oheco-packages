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
function card(pkg) {
  const article = el('article', undefined, 'package');
  const top = el('div', undefined, 'top');
  top.append(el('h3', pkg.name), el('span', 'OHOS · ARM64', 'badge'));
  article.append(top, el('p', pkg.description, 'description'));
  const meta = el('div', undefined, 'metadata');
  meta.append(link('上游项目 ↗', pkg.upstream), link('鸿蒙适配 ↗', pkg.repository), el('span', pkg.license));
  article.append(meta);
  const people = el('div', undefined, 'metadata');
  people.append(el('span', '移植维护：'));
  for (const person of pkg.maintainers) people.append(link(`@${person.github}`, `https://github.com/${encodeURIComponent(person.github)}`));
  article.append(people);
  const row = el('div', undefined, 'version-row');
  const select = el('select');
  select.setAttribute('aria-label', `${pkg.name} 版本`);
  const versions = pkg.versions.filter(version => version.artifacts[target]);
  for (const version of versions) {
    const option = el('option', version.version + (pkg.latest[target] === version.version ? ' · 最新' : ''));
    option.value = version.version;
    select.append(option);
  }
  select.value = pkg.latest[target];
  const download = el('a', '下载软件包 ↗', 'download');
  row.append(select, download);
  const command = el('div', undefined, 'command');
  const code = el('code');
  const button = el('button', '复制'); button.type = 'button';
  button.addEventListener('click', () => copy(code.textContent, button));
  command.append(code, button);
  const details = el('details', undefined, 'details');
  const summary = el('summary');
  const hash = el('code');
  details.append(summary, hash);
  function updateVersion() {
    const artifact = versions.find(version => version.version === select.value).artifacts[target];
    download.href = link('', artifact.url).href;
    code.textContent = `oo install ${pkg.name}@${select.value}`;
    summary.textContent = `${(artifact.size / 1024 / 1024).toFixed(1)} MiB · SHA-256`;
    hash.textContent = artifact.sha256;
  }
  if (versions.length) { updateVersion(); select.addEventListener('change', updateVersion); article.append(row, command, details); }
  else article.append(el('p', '此平台暂无可用版本', 'notes'));
  if (pkg.notes) article.append(el('p', pkg.notes, 'notes'));
  return article;
}
function render() {
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
fetch('./index/v1/index.json').then(response => {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}).then(index => {
  if (index.schema_version !== 1 || !Array.isArray(index.packages)) throw new Error('不支持的索引格式');
  packages = index.packages;
  render();
}).catch(error => { status.textContent = `工具目录暂时无法加载：${error.message}。请稍后重试。`; });
