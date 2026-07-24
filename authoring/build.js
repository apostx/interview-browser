#!/usr/bin/env node
'use strict';

/*
 * Generate a page for every spec in authoring/pages/ into the @assembled group
 * (content/@assembled/), so the assembled/job-targeted pages show up in the app
 * as their own group — clearly separate from the original hand-written topic
 * pages at the content root. Delete the group folder to drop the whole
 * experiment; the originals are never touched.
 *
 *   node authoring/build.js
 */

const fs = require('fs');
const path = require('path');
const { load } = require('./concepts.js');
const { generate } = require('./generate.js');

const PAGES_DIR = path.join(__dirname, 'pages');
const OUT_DIR = path.join(__dirname, '..', 'content', '@assembled');

const db = load();
fs.mkdirSync(OUT_DIR, { recursive: true });

const specs = fs.existsSync(PAGES_DIR)
  ? fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.json'))
  : [];

if (specs.length === 0) {
  console.log('no page specs in authoring/pages/');
  process.exit(0);
}

for (const file of specs) {
  const spec = JSON.parse(fs.readFileSync(path.join(PAGES_DIR, file), 'utf8'));
  const name = spec.out || file.replace(/\.json$/, '.html');
  const html = generate(spec, db);
  fs.writeFileSync(path.join(OUT_DIR, name), html);
  const count = html.match(/<section class="concept"/g)?.length || 0;
  console.log(`${name}: ${count} concepts`);
}

console.log(`-> ${path.relative(path.join(__dirname, '..'), OUT_DIR)}/`);
