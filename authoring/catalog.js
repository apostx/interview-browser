#!/usr/bin/env node
'use strict';

/*
 * Generates docs/authoring-guide.md — a single, self-contained reference that
 * can be handed to an AI: what concepts exist (the catalog) and how to
 * assemble a page (or add a new job-specific collection) from them.
 *
 *   node authoring/catalog.js
 */

const fs = require('fs');
const path = require('path');
const { load } = require('./concepts.js');

const OUT = path.join(__dirname, '..', 'docs', 'authoring-guide.md');
const db = load();

// pick one real concept as a schema example
const sample = db.byId.get('general/api/1') || [...db.byId.values()][0];

function catalog() {
  const lines = [];
  const byCollection = {};
  for (const c of db.byId.values()) {
    (byCollection[c.collection] = byCollection[c.collection] || {});
    (byCollection[c.collection][c.topic] = byCollection[c.collection][c.topic] || []).push(c);
  }
  for (const coll of Object.keys(byCollection).sort()) {
    lines.push(`### Collection: \`${coll}\`\n`);
    for (const topic of Object.keys(byCollection[coll]).sort()) {
      const items = byCollection[coll][topic].sort((a, b) => a.n - b.n);
      lines.push(`<details><summary><b>${topic}</b> — ${items.length} concepts</summary>\n`);
      for (const c of items) lines.push(`- \`${c.id}\` — ${c.title}`);
      lines.push('\n</details>\n');
    }
  }
  return lines.join('\n');
}

const doc = `# Authoring guide — assembling interview-prep pages

This is a reference for building pages for **Interview Browser** from a library
of reusable *concepts*. Hand it to an AI (or a person) that needs to assemble a
targeted study page, or to add new job-specific material.

Live app: https://interviewbrowser.sallai.cc/ · Repo: https://github.com/apostx/interview-browser

---

## 1. The model

Every page is a list of **concepts**. A concept is one self-contained,
**bilingual** (English + Hungarian) block: a definition, the interview questions
+ model answers, and a "watch out". Pages are just *selections* of concepts.

Concepts live in **collections**. \`general\` holds the general full-stack
concepts; job-specific material goes into its own collection so it stays
separate but is still selectable. A concept's id is:

    <collection>/<topic>/<n>          e.g.  general/api/1

## 2. Assemble a page (a "spec")

A page is described by a small JSON **spec**:

\`\`\`json
{
  "title": "Backend / API focus",
  "eyebrow": "Role-targeted set",
  "lede": "A cross-topic selection for a senior backend interview…",
  "pageSize": 6,
  "concepts": [
    "general/api/1",
    "general/api/2",
    "@general/authentication",
    "custom-acme/backend/3"
  ]
}
\`\`\`

- **\`concepts\`** — the ordered list. Each entry is one concept id, or a
  shorthand: \`"@<collection>/<topic>"\` pulls a whole topic in order,
  \`"@<collection>"\` pulls an entire collection. Concepts are renumbered 1..N on
  the page and an index is generated automatically. **Mix collections freely.**
- **\`title\` / \`eyebrow\` / \`lede\`** — page header text. May contain bilingual
  markup: \`<span lang="en">…</span><span lang="hu">…</span>\`.
- **\`hero\`** *(optional)* — \`"@<collection>/<topic>"\` reuses that topic's
  original hero instead of building one from title/eyebrow/lede.
- **\`pageSize\`** *(optional, default 6)* — concepts shown per page; the reader
  can change it in-app. \`0\` = one long page.

Build it with the pipeline in the repo (\`authoring/\`):

\`\`\`sh
# put the spec in authoring/pages/<name>.json, then:
node authoring/build.js        # -> content/@assembled/<name>.html (a material in the app)
\`\`\`

## 3. Add new (job-specific) concepts

Create \`authoring/collections/<collection>/<topic>.json\`. Same shape as the
general ones; its concepts become selectable as \`<collection>/<topic>/<n>\`:

\`\`\`json
{
  "collection": "custom-acme",
  "topic": "backend",
  "hero": "",
  "concepts": [
    { "n": 1, "title": "…", "titleHtml": "…", "bodyHtml": "…" }
  ]
}
\`\`\`

Per concept:
- **\`title\`** — plain-text English title (for reference/ids).
- **\`titleHtml\`** — the heading, bilingual, e.g.
  \`HTTP <span lang="en">Methods</span><span lang="hu">metódusok</span>\`.
- **\`bodyHtml\`** — the concept body as HTML. Use these building blocks, and
  wrap every piece of prose in a \`<span lang="en">…</span><span lang="hu">…</span>\`
  pair so it works in both languages:
  - \`<p class="def">…</p>\` — one-line definition (bold the key sentence).
  - \`<div class="qa"> <p class="q">question</p> <ul class="a"><li>point</li>…</ul> … </div>\` — Q&A.
  - \`<p class="watch"><span class="watch__tag"><span lang="en">Watch out</span><span lang="hu">Buktató</span></span> …</p>\` — the trap.
  - Optional: \`<table class="t">…</table>\`, or an SVG diagram in \`<div class="dia">…</div>\`.
  - Inline: \`<code>…</code>\`, \`<strong>…</strong>\`, \`<em>…</em>\`.

### A real concept, verbatim (${sample.id})

\`\`\`json
${JSON.stringify({ n: sample.n, title: sample.title, titleHtml: sample.titleHtml, bodyHtml: sample.bodyHtml }, null, 2)}
\`\`\`

---

## 4. Catalog — every available concept

${Object.keys(db.collections).map((c) => `\`${c}\``).join(', ')} · ${db.byId.size} concepts total. Reference concepts by their id.

${catalog()}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, doc);
console.log(`wrote ${path.relative(path.join(__dirname, '..'), OUT)} (${db.byId.size} concepts)`);
