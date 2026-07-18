#!/usr/bin/env node
'use strict';

/*
 * Content release: validates content/ with a build, commits the content
 * changes with a conventional commit message, bumps the project semver in
 * package.json (chore(release) commit + vX.Y.Z tag), then pushes.
 *
 * Default logic:
 *   - any ADDED content file      -> feat(content): ...  + minor bump
 *   - only modification/deletion  -> fix(content): ...   + patch bump
 *
 * Usage:
 *   npm run release                          -> auto message + auto bump
 *   npm run release -- --major|--minor|--patch  -> bump override
 *   npm run release -- "feat(content): custom message"  (can be combined with a flag)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { build } = require('./build.js');

const ROOT = path.join(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const LIVE_URL = 'https://interviewbrowser.sallai.cc/';

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts });
}

// --- CLI args ---
const args = process.argv.slice(2);
const bumpFlag = ['--major', '--minor', '--patch'].find((f) => args.includes(f));
const customMessage = args.filter((a) => !a.startsWith('--')).join(' ').trim();

// 1. Validate: a failing build aborts the release, and its warnings surface
//    empty/misplaced folders before they go live.
build();

// 2. Anything to release?
const changes = git(['status', '--porcelain', '--', 'content/'])
  .split('\n')
  .filter(Boolean);

if (changes.length === 0) {
  console.log('No changes under content/ — nothing to release.');
  process.exit(0);
}

console.log('\nChanges:');
for (const line of changes) console.log('  ' + line);

// 3. Classify: added files -> feat + minor, otherwise fix + patch.
const hasAddition = changes.some((l) => l.startsWith('??') || l[0] === 'A' || l[1] === 'A');
const commitType = hasAddition ? 'feat' : 'fix';
const bump = bumpFlag ? bumpFlag.slice(2) : hasAddition ? 'minor' : 'patch';

// 4. Conventional commit message from the touched material/version folders.
const touched = new Set();
for (const line of changes) {
  // porcelain: "XY path" or "XY old -> new"
  const file = line.slice(3).split(' -> ').pop().replace(/^"|"$/g, '');
  const parts = file.replace(/\/$/, '').split('/');
  if (parts[0] === 'content' && parts.length > 1) {
    touched.add(parts.slice(1, -1).join('/') || parts[1]);
  }
}
const touchedList = [...touched].sort();

let subject = customMessage;
let body = null;
if (!subject) {
  subject = `${commitType}(content): ${touchedList.join(', ')}`;
  if (subject.length > 72) {
    subject = `${commitType}(content): update ${touchedList.length} materials`;
    body = touchedList.join('\n');
  }
}

// 5. Commit the content changes.
git(['add', '-A', '--', 'content/']);
const commitArgs = ['commit', '-m', subject];
if (body) commitArgs.push('-m', body);
git(commitArgs, { stdio: 'inherit' });

// 6. Bump project semver + chore(release) commit + tag.
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
pkg.version =
  bump === 'major' ? `${major + 1}.0.0` :
  bump === 'minor' ? `${major}.${minor + 1}.0` :
  `${major}.${minor}.${patch + 1}`;
fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');

git(['add', '--', 'package.json']);
git(['commit', '-m', `chore(release): v${pkg.version}`], { stdio: 'inherit' });
git(['tag', '-a', `v${pkg.version}`, '-m', `v${pkg.version}`]);

// 7. Push commits + tag.
git(['push', '--follow-tags'], { stdio: 'inherit' });

console.log(`\nRelease: v${pkg.version} (${bump} bump)`);
console.log(`Live after deploy: ${LIVE_URL}`);
console.log('Workflow: https://github.com/apostx/interview-browser/actions');
