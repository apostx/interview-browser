#!/usr/bin/env node
'use strict';

/*
 * Extract the general fullstack concepts from content/NN_*.html into the
 * `general` collection (one file per topic) plus the shared theme.
 * Does not touch the originals.
 *
 *   authoring/collections/general/<topic>.json   { collection, topic, hero, concepts:[{n,title,titleHtml,bodyHtml}] }
 *   authoring/theme.css                           merged styles
 *
 * Concept ids are <collection>/<topic>/<n>, e.g. general/api/1. Job-specific
 * data goes into its own collection later (authoring/collections/<job>/…) with
 * the same shape, and stays selectable by id from any page spec.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const COLLECTION = 'general';
const OUT_DIR = path.join(__dirname, 'collections', COLLECTION);
const OUT_CSS = path.join(__dirname, 'theme.css');

const englishText = (html) =>
  String(html)
    .replace(/<span lang="hu">[\s\S]*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const topicFiles = fs.readdirSync(CONTENT).filter((f) => /^\d+_.*\.html$/.test(f)).sort();
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const cssBlocks = new Map();
let topicCount = 0;
let conceptCount = 0;

for (const file of topicFiles) {
  const html = fs.readFileSync(path.join(CONTENT, file), 'utf8');
  const topic = file.replace(/^\d+_/, '').replace(/\.html$/, '');

  const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1].trim();
  if (style) cssBlocks.set(style, true);

  const heroStart = html.indexOf('<div class="hero">');
  const navStart = html.indexOf('<nav class="index"', heroStart);
  const hero = heroStart !== -1 && navStart !== -1 ? html.slice(heroStart, navStart).trimEnd() : '';

  const concepts = [];
  const re = /<section\b([^>]*)>([\s\S]*?)<\/section>/g;
  let m;
  let n = 0;
  while ((m = re.exec(html))) {
    if (!/class="[^"]*\bconcept\b/.test(m[1])) continue;
    n++;
    const inner = m[2];
    const titleHtml = (inner.match(/<div class="concept__head">[\s\S]*?<h2>([\s\S]*?)<\/h2>/) || [, ''])[1].trim();
    const bodyHtml = inner.replace(/^\s*<div class="concept__head">[\s\S]*?<\/div>\s*/, '').trim();
    concepts.push({ n, title: englishText(titleHtml), titleHtml, bodyHtml });
  }

  fs.writeFileSync(
    path.join(OUT_DIR, `${topic}.json`),
    JSON.stringify({ collection: COLLECTION, topic, hero, concepts }, null, 2)
  );
  topicCount++;
  conceptCount += concepts.length;
}

fs.writeFileSync(OUT_CSS, [...cssBlocks.keys()].join('\n\n/* --- */\n\n'));

console.log(`collection "${COLLECTION}": ${topicCount} topics, ${conceptCount} concepts`);
console.log(`-> ${path.relative(ROOT, OUT_DIR)}/, ${path.relative(ROOT, OUT_CSS)}`);
