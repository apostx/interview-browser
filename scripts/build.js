#!/usr/bin/env node
'use strict';

/*
 * Zero-dependency build: scans content/ and assembles the static site in dist/.
 *
 * Folder convention (see README.md):
 *   - "@"-prefixed folder  -> group (may contain groups and materials)
 *   - any other folder     -> material; its subfolders are versions
 *   - content file of a folder: index.html > first *.html > first *.pdf
 *   - default version: direct file in the material folder ("aktuális"),
 *     otherwise the newest version by descending natural name order
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const APP_DIR = path.join(ROOT, 'app');
const DIST_DIR = path.join(ROOT, 'dist');

const GROUP_PREFIX = '@';
const DIRECT_VERSION_NAME = 'aktuális';

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function listDir(dir) {
  return fs.readdirSync(dir, { withFileTypes: true });
}

function kindOf(file) {
  return file.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html';
}

function pickContentFile(dir) {
  const files = listDir(dir).filter((e) => e.isFile()).map((e) => e.name);
  const htmls = files.filter((f) => f.toLowerCase().endsWith('.html')).sort(naturalCompare);
  const index = htmls.find((f) => f.toLowerCase() === 'index.html');
  if (index) return index;
  if (htmls.length > 0) return htmls[0];
  const pdfs = files.filter((f) => f.toLowerCase().endsWith('.pdf')).sort(naturalCompare);
  if (pdfs.length > 0) return pdfs[0];
  return null;
}

function joinRel(relPath, name) {
  return relPath ? `${relPath}/${name}` : name;
}

function scanMaterial(dir, relPath) {
  const versions = [];

  const direct = pickContentFile(dir);
  if (direct) {
    versions.push({
      name: DIRECT_VERSION_NAME,
      file: `content/${relPath}/${direct}`,
      kind: kindOf(direct),
    });
  }

  const subdirs = listDir(dir)
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(naturalCompare)
    .reverse();

  for (const sub of subdirs) {
    const file = pickContentFile(path.join(dir, sub));
    if (!file) {
      // No content file: treated as an asset folder of the material, not a version.
      console.log(`  [info] not a version (no html/pdf inside): ${relPath}/${sub}`);
      continue;
    }
    versions.push({
      name: sub,
      file: `content/${relPath}/${sub}/${file}`,
      kind: kindOf(file),
    });
  }

  if (versions.length === 0) return null;

  return {
    type: 'material',
    name: path.basename(relPath),
    path: relPath,
    versions,
  };
}

function scanLevel(dir, relPath) {
  const items = [];
  const dirs = listDir(dir)
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(naturalCompare);

  for (const name of dirs.filter((n) => n.startsWith(GROUP_PREFIX))) {
    const groupRel = joinRel(relPath, name);
    const children = scanLevel(path.join(dir, name), groupRel);
    if (children.length === 0) {
      console.warn(`  [warn] skipping empty group: ${groupRel}`);
      continue;
    }
    items.push({ type: 'group', name: name.slice(GROUP_PREFIX.length), path: groupRel, children });
  }

  for (const name of dirs.filter((n) => !n.startsWith(GROUP_PREFIX))) {
    const materialRel = joinRel(relPath, name);
    const material = scanMaterial(path.join(dir, name), materialRel);
    if (!material) {
      console.warn(`  [warn] skipping material without content: ${materialRel}`);
      continue;
    }
    items.push(material);
  }

  return items;
}

function countMaterials(items) {
  return items.reduce(
    (sum, item) => sum + (item.type === 'group' ? countMaterials(item.children) : 1),
    0
  );
}

function build() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`Missing content/ folder: ${CONTENT_DIR}`);
    process.exit(1);
  }

  console.log('Scanning content/ ...');
  const items = scanLevel(CONTENT_DIR, '');

  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.cpSync(APP_DIR, DIST_DIR, { recursive: true });
  fs.cpSync(CONTENT_DIR, path.join(DIST_DIR, 'content'), { recursive: true });

  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const manifest = { version, generatedAt: new Date().toISOString(), items };
  fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '');

  console.log(`Done: ${countMaterials(items)} materials -> dist/`);
}

if (require.main === module) build();
module.exports = { build };
