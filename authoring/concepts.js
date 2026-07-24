'use strict';

/*
 * Loads every collection under authoring/collections/ into a flat concept map.
 * Concept id = <collection>/<topic>/<n>. Any collection's concepts are
 * selectable from a page spec by that id.
 */

const fs = require('fs');
const path = require('path');

const COLLECTIONS_DIR = path.join(__dirname, 'collections');

function load() {
  const byId = new Map();
  const topics = {}; // "<collection>/<topic>" -> { hero, title }
  const collections = {}; // name -> [conceptId,...]

  if (!fs.existsSync(COLLECTIONS_DIR)) return { byId, topics, collections };

  for (const collection of fs.readdirSync(COLLECTIONS_DIR)) {
    const dir = path.join(COLLECTIONS_DIR, collection);
    if (!fs.statSync(dir).isDirectory()) continue;
    collections[collection] = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const topic = data.topic || file.replace(/\.json$/, '');
      topics[`${collection}/${topic}`] = { hero: data.hero || '', title: data.title || topic };
      for (const c of data.concepts || []) {
        const id = `${collection}/${topic}/${c.n}`;
        const concept = { id, collection, topic, ...c };
        byId.set(id, concept);
        collections[collection].push(id);
      }
    }
  }
  return { byId, topics, collections };
}

module.exports = { load };
