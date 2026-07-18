#!/usr/bin/env node
'use strict';

/*
 * Content release: validates content/ with a build, then commits and pushes
 * everything under content/ so the Pages workflow deploys it.
 *
 * Usage:
 *   npm run release                     -> auto-generated commit message
 *   npm run release -- "saját üzenet"   -> custom commit message
 */

const path = require('path');
const { execFileSync } = require('child_process');
const { build } = require('./build.js');

const ROOT = path.join(__dirname, '..');
const LIVE_URL = 'https://interviewbrowser.sallai.cc/';

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts });
}

// 1. Validate: a failing build (missing content dir, etc.) aborts the release,
//    and its warnings surface empty/misplaced folders before they go live.
build();

// 2. Anything to release?
const changes = git(['status', '--porcelain', '--', 'content/'])
  .split('\n')
  .filter(Boolean);

if (changes.length === 0) {
  console.log('Nincs változás a content/ alatt — nincs mit release-elni.');
  process.exit(0);
}

console.log('\nVáltozások:');
for (const line of changes) console.log('  ' + line);

// 3. Commit message: CLI args, or derived from the touched material folders.
let message = process.argv.slice(2).join(' ').trim();
if (!message) {
  const touched = new Set();
  for (const line of changes) {
    // porcelain: "XY path" or "XY old -> new"
    const file = line.slice(3).split(' -> ').pop().replace(/^"|"$/g, '');
    const parts = file.split('/');
    if (parts[0] === 'content' && parts.length > 1) {
      touched.add(parts.slice(1, -1).join('/') || parts[1]);
    }
  }
  message = 'content: ' + [...touched].sort().join(', ');
}

// 4. Commit + push.
git(['add', '-A', '--', 'content/']);
git(['commit', '-m', message], { stdio: 'inherit' });
git(['push'], { stdio: 'inherit' });

console.log(`\nRelease elindult. A deploy után élesben: ${LIVE_URL}`);
console.log('Workflow: https://github.com/apostx/interview-browser/actions');
