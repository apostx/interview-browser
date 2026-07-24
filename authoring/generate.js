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
.pager{display:flex;align-items:center;justify-content:center;gap:14px;margin:20px 0;
  font-family:'Space Grotesk',system-ui,sans-serif}
.pager button{font:inherit;font-size:15px;font-weight:600;line-height:1;padding:8px 16px;
  border:1px solid var(--line);border-radius:999px;background:var(--card,#fff);color:var(--ink);cursor:pointer}
.pager button:disabled{opacity:.35;cursor:default}
.pager__info{font-size:13px;color:var(--muted);min-width:56px;text-align:center}`;

// Splits the concepts into pages of `size`, shows one at a time with a
// prev/next pager (top + bottom), and makes the index jump to the right page.
function pagerScript(size) {
  return `<script>
(function () {
  var SIZE = ${size};
  var concepts = [].slice.call(document.querySelectorAll('.concept'));
  if (!SIZE || concepts.length <= SIZE) return;
  var pages = Math.ceil(concepts.length / SIZE);
  var current = 0;
  function makeBar() {
    var bar = document.createElement('div'); bar.className = 'pager';
    var prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '\\u2039';
    prev.setAttribute('aria-label', 'Previous');
    var info = document.createElement('span'); info.className = 'pager__info';
    var next = document.createElement('button'); next.type = 'button'; next.textContent = '\\u203A';
    next.setAttribute('aria-label', 'Next');
    prev.onclick = function () { go(current - 1, true); };
    next.onclick = function () { go(current + 1, true); };
    bar.appendChild(prev); bar.appendChild(info); bar.appendChild(next);
    bar._prev = prev; bar._next = next; bar._info = info;
    return bar;
  }
  var bars = [makeBar(), makeBar()];
  var index = document.querySelector('.index');
  if (index && index.parentNode) index.parentNode.insertBefore(bars[0], index.nextSibling);
  var wrap = document.querySelector('.wrap') || document.body;
  wrap.appendChild(bars[1]);
  function go(p, scroll) {
    current = Math.max(0, Math.min(pages - 1, p));
    for (var i = 0; i < concepts.length; i++) {
      concepts[i].style.display = (Math.floor(i / SIZE) === current) ? '' : 'none';
    }
    for (var b = 0; b < bars.length; b++) {
      bars[b]._info.textContent = (current + 1) + ' / ' + pages;
      bars[b]._prev.disabled = current === 0;
      bars[b]._next.disabled = current === pages - 1;
    }
    if (scroll) window.scrollTo(0, 0);
  }
  var links = document.querySelectorAll('a.idx');
  for (var i = 0; i < links.length; i++) {
    (function (n) {
      links[n].addEventListener('click', function (e) {
        e.preventDefault();
        go(Math.floor(n / SIZE), false);
        if (concepts[n]) concepts[n].scrollIntoView();
      });
    })(i);
  }
  go(0, false);
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

// A spec's concept list may contain single ids ("general/api/1") or a whole
// topic ("@general/api" -> all of that topic's concepts, in order).
function expandConcepts(list, byId) {
  const out = [];
  for (const entry of list) {
    if (entry[0] === '@') {
      const prefix = entry.slice(1) + '/';
      out.push(
        ...[...byId.keys()]
          .filter((k) => k.startsWith(prefix))
          .sort((a, b) => Number(a.split('/').pop()) - Number(b.split('/').pop()))
      );
    } else {
      out.push(entry);
    }
  }
  return out;
}

function generate(spec, db) {
  const { byId, topics } = db || load();
  const concepts = expandConcepts(spec.concepts, byId).map((id) => {
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
