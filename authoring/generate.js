#!/usr/bin/env node
'use strict';

/*
 * Assemble a standalone page from the concept collections + a page spec.
 *
 * A spec is { title, eyebrow?, lede?, src?, hero?, concepts: [conceptId, ...] }.
 *   - conceptId is "<collection>/<topic>/<n>" (see authoring/collections/*),
 *     so one page can mix general and job-specific concepts freely.
 *   - hero: "@<collection>/<topic>" reuses that topic's original hero; otherwise
 *     a hero is built from title/eyebrow/lede.
 * Concepts are renumbered 1..N and an index is generated automatically. The
 * output is a complete page shaped like content/NN_*.html.
 *
 *   node authoring/generate.js <spec.json> [out.html]
 */

const fs = require('fs');
const path = require('path');
const { load } = require('./concepts.js');

const CSS = fs.readFileSync(path.join(__dirname, 'theme.css'), 'utf8');

const pad = (n) => String(n).padStart(2, '0');
const englishText = (html) =>
  String(html)
    .replace(/<span lang="hu">[\s\S]*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// Fixed bilingual toggle: data-lang only (never <html lang>, which a bare
// [lang="hu"]{display:none} rule would match and blank the page), scroll
// anchored, and the shell's in-place setParams hook.
const SCRIPT = `<script>
(function () {
  var SUPPORTED = ['en', 'hu'];
  var root = document.documentElement;
  function anchor() {
    var el = document.elementFromPoint(window.innerWidth / 2, 8);
    while (el && el !== document.body &&
           (el.hasAttribute('lang') || getComputedStyle(el).display === 'inline')) {
      el = el.parentElement;
    }
    return el && el !== document.body ? el : null;
  }
  function applyLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = 'en';
    if (root.dataset.lang === lang) return;
    var a = window.scrollY > 0 ? anchor() : null;
    var before = a ? a.getBoundingClientRect().top : 0;
    root.dataset.lang = lang;
    if (a) window.scrollBy(0, a.getBoundingClientRect().top - before);
  }
  window.interviewBrowser = { setParams: function (p) { applyLang(p && p.lang); } };
  applyLang(new URLSearchParams(location.search).get('lang') || 'en');
})();
</script>`;

// Extra styles for the in-page pager (uses the theme's CSS variables).
const PAGER_CSS = `
/* --- pager --- */
.pager{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px 14px;margin:20px 0;
  font-family:'Space Grotesk',system-ui,sans-serif}
.pager button{font:inherit;font-size:15px;font-weight:600;line-height:1;padding:8px 16px;
  border:1px solid var(--line);border-radius:999px;background:var(--card,#fff);color:var(--ink);cursor:pointer}
.pager button:disabled{opacity:.35;cursor:default}
.pager__info{font-size:13px;color:var(--muted);min-width:56px;text-align:center}
.pager__per{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);font-weight:500}
.pager__per select{font:inherit;font-size:13px;padding:5px 8px;border:1px solid var(--line);
  border-radius:8px;background:var(--card,#fff);color:var(--ink)}`;

// Splits the concepts into pages, shows one at a time, and lets the reader
// change how many show per page (persisted). Prev/next pager top + bottom, and
// the index links jump to the right page.
function pagerScript(size) {
  return `<script>
(function () {
  var DEFAULT = ${size};
  var concepts = [].slice.call(document.querySelectorAll('.concept'));
  var total = concepts.length;
  if (total <= 3) return;

  function readPref() { try { var v = localStorage.getItem('ib_pageSize'); return v == null ? null : Number(v); } catch (e) { return null; } }
  function writePref(v) { try { localStorage.setItem('ib_pageSize', String(v)); } catch (e) {} }

  var size = readPref();
  if (size == null || isNaN(size)) size = DEFAULT;

  var options = [3, 6, 10, 20].filter(function (n) { return n < total; });
  if (DEFAULT > 0 && DEFAULT < total && options.indexOf(DEFAULT) === -1) options.push(DEFAULT);
  options.sort(function (a, b) { return a - b; });
  options.push(0); // 0 = All

  var current = 0;
  function eff() { return size > 0 && size < total ? size : total; }
  function pageCount() { return Math.max(1, Math.ceil(total / eff())); }

  function makeSelect() {
    var lbl = document.createElement('label'); lbl.className = 'pager__per';
    lbl.innerHTML = '<span lang="en">per page</span><span lang="hu">oldalanként</span>';
    var sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Concepts per page');
    var isAll = !(size > 0 && size < total);
    options.forEach(function (n) {
      var o = document.createElement('option');
      o.value = String(n); o.textContent = n === 0 ? 'All' : String(n);
      if ((n === 0 && isAll) || (n !== 0 && n === size)) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = function () { size = Number(sel.value); writePref(size); current = 0; render(true); };
    lbl.appendChild(sel);
    return lbl;
  }

  function makeBar(withSelect) {
    var bar = document.createElement('div'); bar.className = 'pager';
    if (withSelect) bar.appendChild(makeSelect());
    var prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '\\u2039'; prev.setAttribute('aria-label', 'Previous');
    var info = document.createElement('span'); info.className = 'pager__info';
    var next = document.createElement('button'); next.type = 'button'; next.textContent = '\\u203A'; next.setAttribute('aria-label', 'Next');
    prev.onclick = function () { current--; render(true); };
    next.onclick = function () { current++; render(true); };
    bar.appendChild(prev); bar.appendChild(info); bar.appendChild(next);
    bar._prev = prev; bar._next = next; bar._info = info; bar._nav = [prev, info, next];
    return bar;
  }

  var top = makeBar(true), bottom = makeBar(false);
  var index = document.querySelector('.index');
  if (index && index.parentNode) index.parentNode.insertBefore(top, index); // above the index, right under the hero
  (document.querySelector('.wrap') || document.body).appendChild(bottom);

  function render(scroll) {
    var pages = pageCount();
    current = Math.max(0, Math.min(pages - 1, current));
    var e = eff();
    for (var i = 0; i < total; i++) concepts[i].style.display = (Math.floor(i / e) === current) ? '' : 'none';
    [top, bottom].forEach(function (b) {
      b._info.textContent = (current + 1) + ' / ' + pages;
      b._prev.disabled = current === 0;
      b._next.disabled = current >= pages - 1;
      b._nav.forEach(function (el) { el.style.display = pages <= 1 ? 'none' : ''; }); // hide prev/next when it all fits
    });
    bottom.style.display = pages <= 1 ? 'none' : '';
    if (scroll) window.scrollTo(0, 0);
  }

  var links = document.querySelectorAll('a.idx');
  for (var i = 0; i < links.length; i++) {
    (function (n) {
      links[n].addEventListener('click', function (ev) {
        ev.preventDefault();
        current = Math.floor(n / eff());
        render(false);
        if (concepts[n]) concepts[n].scrollIntoView();
      });
    })(i);
  }
  render(false);
})();
</script>`;
}

function renderConcept(c, n) {
  const nn = pad(n);
  return `  <section class="concept" id="c${nn}">
    <div class="concept__head"><span class="num">${nn}</span><h2>${c.titleHtml}</h2></div>
    ${c.bodyHtml}
  </section>`;
}

function renderIndex(concepts) {
  return concepts
    .map((c, i) => `      <a class="idx" href="#c${pad(i + 1)}"><span class="idx__n">${pad(i + 1)}</span><span class="idx__t">${c.titleHtml}</span></a>`)
    .join('\n');
}

function renderHero(spec, topics) {
  if (spec.hero && spec.hero[0] === '@') {
    const topic = topics[spec.hero.slice(1)];
    if (topic && topic.hero) return topic.hero;
  }
  const parts = ['<div class="hero">'];
  if (spec.eyebrow) parts.push(`    <p class="eyebrow">${spec.eyebrow}</p>`);
  parts.push(`    <h1>${spec.title || 'Interview prep'}</h1>`);
  if (spec.lede) parts.push(`    <p class="lede">${spec.lede}</p>`);
  if (spec.src) parts.push(`    <p class="src">${spec.src}</p>`);
  parts.push('  </div>');
  return parts.join('\n');
}

// A spec's concept list may contain single ids ("general/api/1"), a whole topic
// ("@general/api"), or a whole collection ("@general" -> every concept in it,
// in topic then order).
function expandConcepts(list, db) {
  const out = [];
  for (const entry of list) {
    if (entry[0] !== '@') {
      out.push(entry);
      continue;
    }
    const ref = entry.slice(1);
    if (db.collections[ref]) {
      out.push(...db.collections[ref]); // whole collection
    } else {
      const coll = ref.slice(0, ref.indexOf('/'));
      out.push(...(db.collections[coll] || []).filter((id) => id.startsWith(ref + '/')));
    }
  }
  return out;
}

function generate(spec, db) {
  const database = db || load();
  const { byId, topics } = database;
  const concepts = expandConcepts(spec.concepts, database).map((id) => {
    const c = byId.get(id);
    if (!c) throw new Error(`unknown concept id: ${id}`);
    return c;
  });
  // 0 / missing => no pagination (one long page); a number splits into pages.
  const pageSize = spec.pageSize == null ? 6 : spec.pageSize;
  return `<!DOCTYPE html>
<html lang="en" data-lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${englishText(spec.title || 'Interview prep')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
${CSS}
${PAGER_CSS}
</style>
</head>
<body>
<div class="wrap" id="top">

${renderHero(spec, topics)}

  <nav class="index">
    <h3><span lang="en">Jump to</span><span lang="hu">Ugrás</span></h3>
    <div class="grid">
${renderIndex(concepts)}
    </div>
  </nav>

${concepts.map((c, i) => renderConcept(c, i + 1)).join('\n\n')}

</div>
${SCRIPT}
${pagerScript(pageSize)}
</body>
</html>`;
}

module.exports = { generate };

if (require.main === module) {
  const [specPath, outPath] = process.argv.slice(2);
  if (!specPath) {
    console.error('usage: node authoring/generate.js <spec.json> [out.html]');
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const html = generate(spec);
  if (outPath) {
    fs.writeFileSync(outPath, html);
    console.log(`wrote ${outPath} (${spec.concepts.length} concepts)`);
  } else {
    process.stdout.write(html);
  }
}
