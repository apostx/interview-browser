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
