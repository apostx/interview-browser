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
    versionBar: document.getElementById('version-bar'),
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

  function naturalCompare(a, b) {
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  function materialSub(mat) {
    const n = mat.versions.length;
    const pdfBadge = mat.versions[0].kind === 'pdf' ? 'PDF' : '';
    const count = n > 1 ? `${n} versions` : '';
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
              sub: item.children.length === 1 ? '1 item' : `${item.children.length} items`,
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
      ? 'pdf.html?file=' + encodeURIComponent(version.file)
      : encodeURI(version.file);
  }

  // Resolve a target facet vector to an existing version: exact match if any,
  // otherwise the closest version that keeps the just-changed dimension and
  // agrees with the previous selection on as many other dimensions as possible
  // (earlier-declared dimensions weigh more).
  function resolveFaceted(mat, target, changedIndex) {
    const exact = mat.versions.find((v) => v.values.every((x, k) => x === target[k]));
    if (exact) return { version: exact, fallback: false };

    const fixed = mat.versions.filter((v) => v.values[changedIndex] === target[changedIndex]);
    const pool = fixed.length ? fixed : mat.versions;
    let best = pool[0];
    let bestScore = -1;
    for (const v of pool) {
      let score = 0;
      for (let k = 0; k < target.length; k++) {
        if (k !== changedIndex && v.values[k] === target[k]) score += target.length - k;
      }
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    return { version: best, fallback: true };
  }

  function selectVersion(mat, versionName, fallback) {
    history.replaceState(null, '', hashFor(mat.path, versionName));
    renderViewer(mat, versionName, fallback);
  }

  function renderVersionBar(mat, version, fallback) {
    if (!mat.facets) {
      // Flat: a single version dropdown (hidden when there is only one version).
      if (mat.versions.length < 2) {
        el.versionBar.hidden = true;
        el.versionBar.innerHTML = '';
        return;
      }
      el.versionBar.hidden = false;
      el.versionBar.innerHTML =
        `<select class="version-select" aria-label="Version">` +
        mat.versions
          .map((v) => `<option value="${escapeHtml(v.name)}"${v === version ? ' selected' : ''}>${escapeHtml(v.name)}</option>`)
          .join('') +
        `</select>`;
      el.versionBar.querySelector('select').onchange = (e) => selectVersion(mat, e.target.value);
      return;
    }

    // Faceted: one labeled dropdown per dimension.
    el.versionBar.hidden = false;
    const values = version.values;
    let html = '';
    for (let i = 0; i < mat.facets.length; i++) {
      const options = [...new Set(mat.versions.map((v) => v.values[i]))].sort(naturalCompare);
      const optionsHtml = options
        .map((val) => {
          // Available if some version matches the current selection on every
          // other dimension, with this dimension set to `val`.
          const available = mat.versions.some(
            (v) => v.values[i] === val && v.values.every((x, k) => k === i || x === values[k])
          );
          const label = available ? val : `${val} (n/a)`;
          return `<option value="${escapeHtml(val)}"${val === values[i] ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        })
        .join('');
      html +=
        `<div class="facet"><label>${escapeHtml(mat.facets[i])}</label>` +
        `<select data-dim="${i}" aria-label="${escapeHtml(mat.facets[i])}">${optionsHtml}</select></div>`;
    }
    if (fallback) html += `<div class="facet-note">closest match</div>`;
    el.versionBar.innerHTML = html;

    el.versionBar.querySelectorAll('select').forEach((sel) => {
      sel.onchange = () => {
        const dim = Number(sel.dataset.dim);
        const target = version.values.slice();
        target[dim] = sel.value;
        const resolved = resolveFaceted(mat, target, dim);
        selectVersion(mat, resolved.version.name, resolved.fallback);
      };
    });
  }

  function renderViewer(mat, versionName, fallback) {
    el.listView.hidden = true;
    el.viewer.hidden = false;
    document.title = `${mat.name} – Interview Browser`;
    el.viewerTitle.textContent = mat.name;

    const version = mat.versions.find((v) => v.name === versionName) || mat.versions[0];
    renderVersionBar(mat, version, !!fallback);

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

  // no-cache: always revalidate, so a fresh release shows up immediately
  // instead of after GitHub Pages' 10-minute max-age expires.
  fetch('manifest.json', { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`manifest.json: HTTP ${r.status}`);
      return r.json();
    })
    .then((manifest) => {
      root.children = manifest.items;
      indexTree(manifest.items, root, []);
      if (manifest.version) {
        document.getElementById('version').textContent =
          `v${manifest.version} · ${new Date(manifest.generatedAt).toLocaleString('en-GB')}`;
      }
      render();
    })
    .catch((err) => {
      el.items.innerHTML = `<p class="empty">Failed to load the manifest: ${escapeHtml(String(err))}</p>`;
    });
})();
