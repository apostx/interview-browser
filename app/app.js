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
        indexTree(item.children, item, groupNames.concat(prettyName(item.name)));
      } else {
        item.groupLabel = groupNames.join(' / ');
        allMaterials.push(item);
      }
    }
  }

  function encodePath(p) {
    return p.split('/').map(encodeURIComponent).join('/');
  }

  function hashFor(path, version, params) {
    const query = new URLSearchParams();
    if (version) query.set('v', version);
    for (const [key, value] of Object.entries(params || {})) query.set(key, value);
    const q = query.toString();
    return '#/' + encodePath(path) + (q ? '?' + q : '');
  }

  function currentRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const qIndex = raw.indexOf('?');
    const rawPath = qIndex === -1 ? raw : raw.slice(0, qIndex);
    const query = new URLSearchParams(qIndex === -1 ? '' : raw.slice(qIndex + 1));
    let path = '';
    try {
      path = rawPath.split('/').map(decodeURIComponent).join('/');
    } catch {
      path = '';
    }
    return { path, version: query.get('v'), query };
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

  // Folder and file names separate words with underscores; show them as words,
  // each capitalised. Anything else in the name is left alone.
  function prettyName(name) {
    return String(name)
      .replace(/_+/g, ' ')
      .trim()
      .replace(/(^|\s)(\S)/g, (match, space, ch) => space + ch.toUpperCase());
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
    const groupTitle = prettyName(group.name);
    document.title = group.path ? `${groupTitle} – Interview Browser` : 'Interview Browser';
    el.listTitle.textContent = groupTitle;
    el.upBtn.hidden = !group.path;

    const query = el.search.value.trim().toLowerCase();
    if (query) {
      renderRows(
        allMaterials
          .filter(
            (m) =>
              m.name.toLowerCase().includes(query) ||
              prettyName(m.name).toLowerCase().includes(query)
          )
          .map((m) => rowHtml({
            href: hashFor(m.path),
            icon: '📄',
            title: prettyName(m.name),
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
              title: prettyName(item.name),
              sub: item.children.length === 1 ? '1 item' : `${item.children.length} items`,
              chevron: true,
            })
          : rowHtml({
              href: hashFor(item.path),
              icon: '📄',
              title: prettyName(item.name),
              sub: materialSub(item),
            })
      )
    );
  }

  function frameSrcFor(version, scrollTop, paramValues) {
    if (version.kind === 'pdf') {
      let src = 'pdf.html?file=' + encodeURIComponent(version.file);
      if (scrollTop > 0) src += '&top=' + Math.round(scrollTop);
      return src;
    }
    // Param axes are handed to HTML content as URL parameters.
    const src = encodeURI(version.file);
    const query = new URLSearchParams(paramValues || {}).toString();
    return query ? src + (src.includes('?') ? '&' : '?') + query : src;
  }

  // Current value of each param axis, read from the route; the first configured
  // value is the default.
  function paramValuesFor(mat, query) {
    const values = {};
    for (const axis of mat.paramFacets || []) {
      const value = query.get(axis.param);
      values[axis.param] = axis.values.includes(value) ? value : axis.values[0];
    }
    return values;
  }

  // Collapsed/expanded state of the version bar is remembered across materials.
  function versionBarOpen() {
    try { return localStorage.getItem('versionBarOpen') === '1'; } catch { return false; }
  }
  function setVersionBarOpen(open) {
    try { localStorage.setItem('versionBarOpen', open ? '1' : '0'); } catch {}
  }

  // Preserve scroll position across a version switch only when every dimension
  // that actually changed is flagged keepPosition (its layout is known to match
  // the others). Any other differing dimension resets the view to the top.
  function keepsPosition(mat, oldValues, newValues) {
    if (!mat.facets) return false;
    let changed = false;
    for (let i = 0; i < mat.facets.length; i++) {
      if (oldValues[i] !== newValues[i]) {
        if (!mat.facets[i].keepPosition) return false;
        changed = true;
      }
    }
    return changed;
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

  function selectVersion(mat, versionName, fallback, scrollTop) {
    const params = paramValuesFor(mat, currentRoute().query);
    history.replaceState(null, '', hashFor(mat.path, versionName, params));
    renderViewer(mat, versionName, fallback, scrollTop);
  }

  function selectParam(mat, version, axis, value) {
    const params = { ...paramValuesFor(mat, currentRoute().query), [axis.param]: value };
    let scrollTop = 0;
    if (axis.keepPosition) {
      try { scrollTop = el.frame.contentWindow.scrollY || 0; } catch { scrollTop = 0; }
    }
    history.replaceState(null, '', hashFor(mat.path, version.name, params));
    renderViewer(mat, version.name, false, scrollTop);
  }

  // Build the inner controls: the version dropdown(s) plus any param axes.
  function versionControlsHtml(mat, version, fallback, paramValues, paramAxes) {
    let html = '';
    if (!mat.facets) {
      if (mat.versions.length > 1) {
        html +=
          `<select class="version-select" aria-label="Version">` +
          mat.versions
            .map((v) => `<option value="${escapeHtml(v.name)}"${v === version ? ' selected' : ''}>${escapeHtml(v.name)}</option>`)
            .join('') +
          `</select>`;
      }
      return html + paramControlsHtml(paramAxes, paramValues) + (fallback ? `<div class="facet-note">closest match</div>` : '');
    }
    const values = version.values;
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
        `<div class="facet"><label>${escapeHtml(mat.facets[i].label)}</label>` +
        `<select data-dim="${i}" aria-label="${escapeHtml(mat.facets[i].label)}">${optionsHtml}</select></div>`;
    }
    html += paramControlsHtml(paramAxes, paramValues);
    if (fallback) html += `<div class="facet-note">closest match</div>`;
    return html;
  }

  function paramControlsHtml(paramAxes, paramValues) {
    return paramAxes
      .map((axis) => {
        const optionsHtml = axis.values
          .map((val) => `<option value="${escapeHtml(val)}"${val === paramValues[axis.param] ? ' selected' : ''}>${escapeHtml(val)}</option>`)
          .join('');
        return (
          `<div class="facet"><label>${escapeHtml(axis.label)}</label>` +
          `<select data-param="${escapeHtml(axis.param)}" aria-label="${escapeHtml(axis.label)}">${optionsHtml}</select></div>`
        );
      })
      .join('');
  }

  function renderVersionBar(mat, version, fallback, paramValues) {
    // Param axes only mean something for HTML content, which can read them.
    const paramAxes = version.kind === 'pdf' ? [] : mat.paramFacets || [];
    if (mat.versions.length < 2 && paramAxes.length === 0) {
      el.versionBar.hidden = true;
      el.versionBar.innerHTML = '';
      return;
    }
    el.versionBar.hidden = false;

    const parts = [];
    if (mat.facets) parts.push(...version.values);
    else if (mat.versions.length > 1) parts.push(version.name);
    for (const axis of paramAxes) parts.push(paramValues[axis.param]);

    const open = versionBarOpen();
    el.versionBar.innerHTML =
      `<button type="button" class="version-summary" aria-expanded="${open}">` +
      `<span class="vs-text">${escapeHtml(parts.join(' · '))}</span><span class="vs-caret">▾</span></button>` +
      `<div class="version-controls"${open ? '' : ' hidden'}>` +
      `${versionControlsHtml(mat, version, fallback, paramValues, paramAxes)}</div>`;

    const summaryBtn = el.versionBar.querySelector('.version-summary');
    const controls = el.versionBar.querySelector('.version-controls');
    summaryBtn.onclick = () => {
      const nextOpen = controls.hidden;
      controls.hidden = !nextOpen;
      summaryBtn.setAttribute('aria-expanded', String(nextOpen));
      setVersionBarOpen(nextOpen);
    };

    controls.querySelectorAll('select').forEach((sel) => {
      if (sel.dataset.param !== undefined) {
        const axis = paramAxes.find((a) => a.param === sel.dataset.param);
        sel.onchange = () => selectParam(mat, version, axis, sel.value);
        return;
      }
      if (sel.dataset.dim === undefined) {
        sel.onchange = (e) => selectVersion(mat, e.target.value);
        return;
      }
      sel.onchange = () => {
        const dim = Number(sel.dataset.dim);
        const target = version.values.slice();
        target[dim] = sel.value;
        const resolved = resolveFaceted(mat, target, dim);
        let scrollTop = 0;
        if (keepsPosition(mat, version.values, resolved.version.values)) {
          try { scrollTop = el.frame.contentWindow.scrollY || 0; } catch { scrollTop = 0; }
        }
        selectVersion(mat, resolved.version.name, resolved.fallback, scrollTop);
      };
    });
  }

  function renderViewer(mat, versionName, fallback, scrollTop) {
    el.listView.hidden = true;
    el.viewer.hidden = false;
    const title = prettyName(mat.name);
    document.title = `${title} – Interview Browser`;
    el.viewerTitle.textContent = title;

    const version = mat.versions.find((v) => v.name === versionName) || mat.versions[0];
    const paramValues = paramValuesFor(mat, currentRoute().query);
    renderVersionBar(mat, version, !!fallback, paramValues);

    const src = frameSrcFor(version, scrollTop, paramValues);
    if (el.frame.getAttribute('src') !== src) {
      // A PDF restores the offset itself (via &top=); HTML content is scrolled
      // back once the frame has loaded.
      if (scrollTop > 0 && version.kind !== 'pdf') {
        el.frame.addEventListener(
          'load',
          () => { try { el.frame.contentWindow.scrollTo(0, scrollTop); } catch {} },
          { once: true }
        );
      }
      el.frame.src = src;
    }
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
