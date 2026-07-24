# Authoring pipeline

Turns interview-prep pages into **data + a template**, so pages can be assembled
from concepts instead of hand-written — e.g. a job-description-specific selection
across topics.

**It never touches the original topic pages.** The hand-written
`content/NN_*.html` stay exactly as they are. `authoring/build.js` writes the
assembled pages into their own group, `content/@assembled/`, so they show up in
the app **next to** the originals but clearly separate — delete that folder to
drop the whole experiment. The pipeline sources (`authoring/`) live outside
`content/`, so the app build ignores them.

## The unit

Every page is a list of **concepts**. A concept is a `<section class="concept">`
with a bilingual head + body (definition, Q&A, watch-out, optional table/diagram)
— the exact block the existing topic pages are built from.

```
concept collections ──generate──▶ standalone HTML page
   (data)                            (same shape as content/NN_*.html)
```

## Collections (data)

Concepts live in **collections** so general and job-specific data stay separate
but both remain selectable:

```
authoring/collections/
  general/                 # the general fullstack concepts (197, 14 topics)
    api.json               # { collection, topic, hero, concepts:[{n,title,titleHtml,bodyHtml}] }
    nodejs_&_backend_topics.json
    ...
  acme-corp/               # a future job-specific collection (same shape)
    backend.json
```

- Concept id = `<collection>/<topic>/<n>`, e.g. `general/api/1`.
- The general collection is extracted from `content/NN_*.html` by `extract.js`.
- **To add job-specific data:** drop a `authoring/collections/<name>/<topic>.json`
  with the same shape (author it by hand or generate it). Its concepts are then
  selectable by id (`<name>/<topic>/<n>`) from any page spec, without mixing into
  `general`.

## Pages (specs)

A page is a spec in `authoring/pages/*.json`:

```json
{
  "title": "Backend / API focus",
  "eyebrow": "Role-targeted prep",
  "lede": "A cross-topic set for a senior backend interview…",
  "concepts": [
    "general/api/1",
    "general/nodejs_&_backend_topics/1",
    "acme-corp/backend/2"
  ]
}
```

- `concepts` entries are ids, `"@<collection>/<topic>"` for a whole topic in
  order (e.g. `"@general/api"`), or `"@<collection>"` for an entire collection
  (e.g. `"@general"` — every concept, used by the *All* page).
- `hero: "@general/api"` reuses that topic's original hero; otherwise a hero is
  built from title/eyebrow/lede.
- Titles/lede/eyebrow may contain bilingual `<span lang="…">` markup.
- `pageSize` (default `6`) sets the initial page size — only that many concepts
  show at once, with a prev/next pager and index links that jump to the right
  page. The reader can change it in-page via the **per-page** dropdown (options
  incl. *All*), and the choice is remembered across pages. `0` starts on *All*.

## Run it

```sh
node authoring/extract.js   # (re)build collections/general/* + theme.css from content/
node authoring/build.js     # generate every authoring/pages/*.json into content/@assembled/
node authoring/generate.js authoring/pages/backend_focus.json out.html   # one page, anywhere
```

## Pieces

- `extract.js` — content topic pages → `collections/general/*` + `theme.css`.
- `concepts.js` — loads every collection into a concept map (`id → concept`).
- `generate.js` — `generate(spec)` → a complete page (renumbered concepts,
  auto-index, fixed bilingual toggle that never blanks the page).
- `build.js` — runs every spec in `pages/` into `content/@assembled/`.
- `theme.css` — merged styles (union of all topics), so any mix renders.

## Verified

- The API page rebuilt from data is visually identical to `content/00_api.html`.
- A cross-topic mix renders concepts from several topics correctly (tables and
  SVG diagrams included); the language toggle works and never blanks the page.

## Kept separate on purpose

The original topic pages and the assembled pages are **two separate things**:
the originals stay at the content root (the study material), the assembled pages
live in the `@assembled` group. Nothing is migrated or merged — if the assembled
approach doesn't pan out, delete `content/@assembled/` and the pipeline is gone
with no trace on the originals.

## Not done yet

- **Theme trimming** — `theme.css` is the union of all topics' styles (correct,
  but larger than needed); a shared base stylesheet would slim it.
