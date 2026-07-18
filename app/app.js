'use strict';

(() => {
  const el = {
    listView: document.getElementById('list-view'),
    listTitle: document.getElementById('list-title'),
    upBtn: document.getElementById('up-btn'),
    search: document.getElementById('search'),
    items: document.getElementById('items'),
    empty: document.getElementById('empty'),
    viewer: document.getElementById('viewer'),
    viewerTitle: document.getElementById('viewer-title'),
    backBtn: document.getElementById('back-btn'),
    versionSelect: document.getElementById('version-select'),
    frame: document.getElementById('frame'),
  };

  const root = { type: 'group', name: 'Interview Browser', path: '', children: [] };
  const byPath = new Map([['', root]]);
  const parentOf = new Map();
  const allMaterials = [];

  function indexTree(items, parent, groupNames) {
    for (const item of items) {
      byPath.set(item.path, item);
      parentOf.set(item.path, parent);
      if (item.type === 'group') {
        indexTree(item.children, item, groupNames.concat(item.name));
      } else {
        item.groupLabel = groupNames.join(' / ');
        allMaterials.push(item);
      }
    }
  }

  function encodePath(p) {
    return p.split('/').map(encodeURIComponent).join('/');
  }

  function hashFor(path, version) {
    let h = '#/' + encodePath(path);
    if (version) h += '?v=' + encodeURIComponent(version);
    return h;
  }

  function currentRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const qIndex = raw.indexOf('?');
    const rawPath = qIndex === -1 ? raw : raw.slice(0, qIndex);
    const query = qIndex === -1 ? '' : raw.slice(qIndex + 1);
    let path = '';
    try {
      path = rawPath.split('/').map(decodeURIComponent).join('/');
    } catch {
      path = '';
    }
    return { path, version: new URLSearchParams(query).get('v') };
  }

  function rowHtml({ href, icon, title, sub, chevron }) {
    const subHtml = sub ? `<div class="row-sub">${escapeHtml(sub)}</div>` : '';
    return `<a class="row" href="${href}">
      <span class="row-icon">${icon}</span>
      <span class="row-body">
        <span class="row-title">${escapeHtml(title)}</span>${subHtml}
      </span>
      ${chevron ? '<span class="row-chevron">›</span>' : ''}
    </a>`;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function materialSub(mat) {
    const n = mat.versions.length;
    const pdfBadge = mat.versions[0].kind === 'pdf' ? 'PDF' : '';
    const count = n > 1 ? `${n} verzió` : '';
    return [pdfBadge, count].filter(Boolean).join(' · ');
  }

  function renderRows(rows) {
    el.items.innerHTML = rows.join('');
    el.empty.hidden = rows.length > 0;
  }

  function renderList(group) {
    el.viewer.hidden = true;
    el.listView.hidden = false;
    el.frame.src = 'about:blank';
    document.title = group.path ? `${group.name} – Interview Browser` : 'Interview Browser';
    el.listTitle.textContent = group.name;
    el.upBtn.hidden = !group.path;

    const query = el.search.value.trim().toLowerCase();
    if (query) {
      renderRows(
        allMaterials
          .filter((m) => m.name.toLowerCase().includes(query))
          .map((m) => rowHtml({
            href: hashFor(m.path),
            icon: '📄',
            title: m.name,
            sub: [m.groupLabel, materialSub(m)].filter(Boolean).join(' · '),
          }))
      );
      return;
    }

    renderRows(
      group.children.map((item) =>
        item.type === 'group'
          ? rowHtml({
              href: hashFor(item.path),
              icon: '📁',
              title: item.name,
              sub: `${item.children.length} elem`,
              chevron: true,
            })
          : rowHtml({
              href: hashFor(item.path),
              icon: '📄',
              title: item.name,
              sub: materialSub(item),
            })
      )
    );
  }

  function frameSrcFor(version) {
    return version.kind === 'pdf'
      ? 'vendor/pdfjs/web/viewer.html?file=' + encodeURIComponent('../../../' + version.file)
      : encodeURI(version.file);
  }

  function renderViewer(mat, versionName) {
    el.listView.hidden = true;
    el.viewer.hidden = false;
    document.title = `${mat.name} – Interview Browser`;
    el.viewerTitle.textContent = mat.name;

    const version = mat.versions.find((v) => v.name === versionName) || mat.versions[0];

    el.versionSelect.innerHTML = mat.versions
      .map((v) => `<option value="${escapeHtml(v.name)}"${v === version ? ' selected' : ''}>${escapeHtml(v.name)}</option>`)
      .join('');
    el.versionSelect.hidden = mat.versions.length < 2;
    el.versionSelect.onchange = () => {
      history.replaceState(null, '', hashFor(mat.path, el.versionSelect.value));
      render();
    };

    const src = frameSrcFor(version);
    if (el.frame.getAttribute('src') !== src) el.frame.src = src;
  }

  function render() {
    const { path, version } = currentRoute();
    const node = byPath.get(path) || root;
    if (node.type === 'material') renderViewer(node, version);
    else renderList(node);
  }

  function goUp() {
    const { path } = currentRoute();
    const parent = parentOf.get(path);
    location.hash = hashFor(parent ? parent.path : '');
  }

  el.upBtn.addEventListener('click', goUp);
  el.backBtn.addEventListener('click', goUp);
  el.search.addEventListener('input', render);
  window.addEventListener('hashchange', render);

  fetch('manifest.json')
    .then((r) => {
      if (!r.ok) throw new Error(`manifest.json: HTTP ${r.status}`);
      return r.json();
    })
    .then((manifest) => {
      root.children = manifest.items;
      indexTree(manifest.items, root, []);
      render();
    })
    .catch((err) => {
      el.items.innerHTML = `<p class="empty">Nem sikerült betölteni a manifestet: ${escapeHtml(String(err))}</p>`;
    });
})();
