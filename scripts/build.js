#!/usr/bin/env node
'use strict';

/*
 * Zero-dependency build: scans content/ and assembles the static site in dist/.
 *
 * Folder convention (see README.md):
 *   - "@"-prefixed folder  -> group (may contain groups and materials)
 *   - any other folder     -> material; its subfolders are versions
 *   - content file of a folder: index.html > first *.html > first *.pdf
 *   - default version: direct file in the material folder ("current"),
 *     otherwise the newest version by descending natural name order
 *
 * Faceted versions (optional): a `_facets.json` file holds an array of
 * dimension labels, e.g. ["Language", "Model", "Model version", "Doc version"].
 * A material becomes faceted when an effective config applies AND every version
 * folder name splits (on "_") into exactly that many segments — then each
 * version carries a `values` vector and the material carries `facets` (labels),
 * so the app can offer one dropdown per dimension. Config resolution:
 *   - `content/_facets.json`                 -> global default
 *   - `content/<...>/<material>/_facets.json` -> per-material, fully overrides
 * If no config applies, or the folder names don't match the config length, the
 * material falls back to a flat version list. Values must not contain "_"
 * (write decimals with a dot, e.g. 5.5).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const APP_DIR = path.join(ROOT, 'app');
const DIST_DIR = path.join(ROOT, 'dist');

const GROUP_PREFIX = '@';
const DIRECT_VERSION_NAME = 'current';
const FACETS_FILE = '_facets.json';
const FACET_SEP = '_';
const CONTENT_FILE_RE = /\.(html|pdf)$/i;

// Each entry is one axis, given as either a label string or an object:
//   { label, keepPosition }                  -> folder axis: a segment of the
//                                               version folder name
//   { label, param, values, keepPosition }   -> param axis: not part of the
//                                               folder name at all; the viewer
//                                               offers `values` and passes the
//                                               choice to HTML content as the
//                                               `param` URL parameter
// keepPosition means the viewer preserves scroll position when only this axis
// changes.
function readFacetsConfig(dir) {
  const file = path.join(dir, FACETS_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    // An empty array is a valid config meaning "no axes here" — it overrides
    // (and so switches off) whatever this level would otherwise inherit.
    if (Array.isArray(parsed) && parsed.length === 0) return parsed;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const facets = parsed.map((entry) => {
        if (typeof entry === 'string') return { label: entry, keepPosition: false };
        if (!entry || typeof entry.label !== 'string') return null;
        const axis = { label: entry.label, keepPosition: entry.keepPosition === true };
        if (entry.param === undefined && entry.values === undefined) return axis;
        const valid =
          typeof entry.param === 'string' &&
          entry.param.length > 0 &&
          Array.isArray(entry.values) &&
          entry.values.length > 0 &&
          entry.values.every((v) => typeof v === 'string');
        if (!valid) return null;
        return { ...axis, param: entry.param, values: entry.values };
      });
      if (facets.every(Boolean)) return facets;
    }
    console.warn(`  [warn] ignoring ${FACETS_FILE} (expected an array of labels, {label,keepPosition} or {label,param,values}): ${file}`);
  } catch (err) {
    console.warn(`  [warn] ignoring invalid ${FACETS_FILE}: ${file} (${err.message})`);
  }
  return null;
}

// Folder axes come from the version folder name; param axes are passed to HTML
// content as URL parameters and take no part in the folder naming.
function splitAxes(config) {
  const folder = [];
  const param = [];
  for (const axis of config || []) (axis.param ? param : folder).push(axis);
  return { folder, param };
}

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

function scanMaterial(dir, relPath, inheritedConfig) {
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

  const material = {
    type: 'material',
    name: path.basename(relPath),
    path: relPath,
    versions,
  };

  // The nearest config wins: a material's own file overrides what it inherits.
  const config = readFacetsConfig(dir) || inheritedConfig;
  const { folder: folderAxes, param: paramAxes } = splitAxes(config);
  const facetable =
    folderAxes.length > 0 &&
    !direct &&
    versions.every((v) => v.name.split(FACET_SEP).length === folderAxes.length);
  if (folderAxes.length > 0 && !facetable && !direct && versions.length > 1) {
    console.log(`  [info] not faceted (names don't split into ${folderAxes.length} facets): ${relPath}`);
  }
  if (facetable) {
    material.facets = folderAxes;
    for (const v of versions) v.values = v.name.split(FACET_SEP);
  }
  if (paramAxes.length > 0) material.paramFacets = paramAxes;

  return material;
}

// A stray .html/.pdf sitting at a group (or root) level is a material of its
// own with a single, unversioned content file — no folder needed.
function looseMaterial(dir, relPath, fileName, inheritedConfig) {
  const materialRel = joinRel(relPath, fileName);
  const material = {
    type: 'material',
    name: fileName.replace(/\.[^.]+$/, ''),
    path: materialRel,
    versions: [
      { name: DIRECT_VERSION_NAME, file: `content/${materialRel}`, kind: kindOf(fileName) },
    ],
  };
  // Folder axes need version folders, so only param axes can apply here.
  const { param: paramAxes } = splitAxes(inheritedConfig);
  if (paramAxes.length > 0) material.paramFacets = paramAxes;
  return material;
}

function scanLevel(dir, relPath, inheritedConfig) {
  // Nearest config wins: this level's own file overrides what it inherits.
  const config = readFacetsConfig(dir) || inheritedConfig;
  const entries = listDir(dir);
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(naturalCompare);

  const groups = [];
  for (const name of dirs.filter((n) => n.startsWith(GROUP_PREFIX))) {
    const groupRel = joinRel(relPath, name);
    const children = scanLevel(path.join(dir, name), groupRel, config);
    if (children.length === 0) {
      console.warn(`  [warn] skipping empty group: ${groupRel}`);
      continue;
    }
    groups.push({ type: 'group', name: name.slice(GROUP_PREFIX.length), path: groupRel, children });
  }

  const materials = [];
  for (const name of dirs.filter((n) => !n.startsWith(GROUP_PREFIX))) {
    const materialRel = joinRel(relPath, name);
    const material = scanMaterial(path.join(dir, name), materialRel, config);
    if (!material) {
      console.warn(`  [warn] skipping material without content: ${materialRel}`);
      continue;
    }
    materials.push(material);
  }

  for (const entry of entries) {
    if (entry.isFile() && CONTENT_FILE_RE.test(entry.name)) {
      materials.push(looseMaterial(dir, relPath, entry.name, config));
    }
  }

  materials.sort((a, b) => naturalCompare(a.name, b.name));
  return [...groups, ...materials];
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
  const items = scanLevel(CONTENT_DIR, '', null);

  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.cpSync(APP_DIR, DIST_DIR, { recursive: true });
  fs.cpSync(CONTENT_DIR, path.join(DIST_DIR, 'content'), { recursive: true });

  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  // Cache-bust app assets so a reloaded index.html always pulls the matching
  // build instead of a stale cached copy (GitHub Pages serves max-age=600).
  const indexPath = path.join(DIST_DIR, 'index.html');
  fs.writeFileSync(
    indexPath,
    fs
      .readFileSync(indexPath, 'utf8')
      .replace('href="style.css"', `href="style.css?v=${version}"`)
      .replace('src="app.js"', `src="app.js?v=${version}"`)
  );

  const manifest = { version, generatedAt: new Date().toISOString(), items };
  fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '');

  console.log(`Done: ${countMaterials(items)} materials -> dist/`);
}

if (require.main === module) build();
module.exports = { build };
