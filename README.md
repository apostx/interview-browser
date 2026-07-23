# Interview Browser

Mobile-first shell webapp for browsing AI-generated, fully independent single-page HTML (or PDF) interview-prep materials and switching between their versions.

Adding new material requires **no config or code changes**: just copy a folder under `content/` and push — the build discovers everything on its own.

## Folder convention

```
content/
  @frontend/              <- group (@ prefix, nestable to any depth)
    react-hooks/          <- material (unmarked folder)
      index.html          <- default version ("current")
      2026-07-10/         <- version (subfolder of the material, any name)
        any-name.html
  system-design/          <- ungrouped material at the root
    2026-06-01/
      prep.html
    2026-07-01/           <- default = first in descending name order
      prep.html
```

Rules:

- **Group:** a folder with an `@` prefix (displayed without the prefix). May contain groups and materials, nested to any depth.
- **Material:** any unmarked folder inside a group or at the root. Its **versions** come from its subfolders (named after the folder) and/or the content files sitting directly in it. A single direct file is the material's one version ("current"); **several direct files each become a version** named after the file (e.g. `system_design/core.html`, `full.html`, `quick.html` → three versions). Version names are free-form — dates, v1, core/full/quick, anything.
- **Content file** of a version folder: `index.html` > alphabetically first `*.html` > first `*.pdf`. Non-content files (images, css, js) are copied verbatim, so relative references keep working.
- **Loose file:** an `.html` or `.pdf` sitting directly at a group or root level (not in a folder of its own) is also a material — a single, unversioned one, named after the file. Use it for one-off contents that need no versioning.
- **Default version:** a single direct file ("current"); otherwise the first version in ascending name order for direct files, or descending order for subfolders (so a date-named folder defaults to the newest).
- A subfolder without a content file is not a version but an asset folder — the build omits it from the list but still copies its files.
- **Display names:** underscores in group, material and file names are shown as spaces in the UI, with every word capitalised (`system_design` → *System Design*). Anything else in the name is left as-is.

### Faceted versions (optional)

When a material has many versions that vary along several independent axes (e.g. language × generator model × model version × doc version), a flat dropdown becomes unwieldy. A material can instead expose **one dropdown per axis**.

Enable it with a `_facets.json` file holding the axis labels, in folder-name order. Each entry is either a label string, or an object `{ "label": "…", "keepPosition": true }`:

```
content/
  _facets.json                 <- global default:
                                    [ { "label": "Language", "keepPosition": true },
                                      "Model", "Doc version" ]
  redspher/
    en_gpt-5.5_v1/  report.pdf  <- values: en · gpt-5.5 · v1
    hu_claude-5_v2/ report.pdf  <- values: hu · claude-5 · v2
    ...
```

- Version folder name = the axis values joined by `_`, in the order the labels declare. **Values must not contain `_`** (it's the axis separator); `-` and `.` are fine inside a value, so `gpt-5.5` is one value.
- **Config resolution:** the **nearest** `_facets.json` wins and **fully overrides** what it would inherit — a material's own file beats the one in its group, which beats `content/_facets.json` (the global default). An empty array (`[]`) is a valid config meaning *no axes here*, which switches an inherited config back off for that subtree.
- **Opt-in / fallback:** faceting applies only if a config is in effect *and* every version folder name splits into exactly as many segments as there are labels. Otherwise (no config, or a name that doesn't match) the material falls back to the plain flat version list — so simple date-named or single-file materials are unaffected.
- **Sparse matrices are fine:** not every combination has to exist. In each dropdown, options that don't combine with the current selection are marked `(n/a)`. Picking one isn't blocked — the app resolves to the closest existing version (keeping the axis you just changed, then matching as many other axes as possible, earlier axes first) and shows a *closest match* hint.
- **`keepPosition`:** for a PDF version, switching a `keepPosition` axis preserves the current scroll position instead of jumping back to page 1 — useful when the variants share the same layout (e.g. the same document in two languages). Position is only kept when *every* axis that changed is `keepPosition`; otherwise the view resets to the top.
- **`display`:** `"inline"` renders the axis as side-by-side buttons (pills) instead of a dropdown — handy for short value lists like a language toggle. The default is a dropdown. The built-in version picker (for materials with several file/folder versions) can be made inline too, and its order set, with a `{ "version": true, "display": "inline", "order": ["quick", "core", "full"] }` entry in the config — listed names come first in that order (the first is the default), any others follow in natural order.

#### Param axes (URL parameters for HTML content)

An axis can also live entirely in the config instead of in the folder names — useful when a single HTML content handles the variants itself (e.g. it has its own language switch). Give the axis a `param` and its `values`:

```json
[
  { "label": "Language", "param": "lang", "values": ["hu", "en"], "keepPosition": true }
]
```

- The viewer offers `values` in a dropdown and passes the choice to the content as a URL parameter — here `content/…/page.html?lang=en`. The first value is the default, and the choice is part of the deep link.
- Param axes take **no part in the folder naming**, so they don't count towards the segment check and work for single-file materials, including loose files.
- They apply to HTML content only (a PDF can't read URL parameters), so the dropdown is only shown for HTML versions. `keepPosition` works here too: the frame is scrolled back to where it was after the switch.
- **Switching without a reload:** if the content page exposes `window.interviewBrowser.setParams(params)`, the shell calls it instead of reloading the frame — the switch is then instant and the reading position is untouched. Pages that don't are reloaded with the new parameter. See [docs/content-language-support.md](docs/content-language-support.md) for the content-side contract (hand that file to whoever writes the content).

The version bar itself is collapsible: it shows a one-line summary of the current selection and expands to the dropdowns on tap (the collapsed/expanded choice is remembered).

## Usage

Live site: **https://interviewbrowser.sallai.cc/**

```sh
# local development: build + server (zero dependencies, only Node required)
npm run dev                    # http://localhost:8080

# build only
npm run build                  # -> dist/

# content release: build check + conventional commit + semver bump + tag + push
npm run release                        # auto message + auto bump
npm run release -- --major             # bump override (--major/--minor/--patch)
npm run release -- "feat(content): custom message"
```

`release` commits only the changes under `content/` (not app/script modifications), and GitHub Actions deploys automatically after the push.

## Versioning and commit convention

The repo follows [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:` …; the `(content)` scope for content) and the project follows [semver](https://semver.org/) (`package.json` + `vX.Y.Z` git tags).

Default logic of `npm run release`:

| Change under content/ | Commit | Bump |
|---|---|---|
| any new file (new material or version) | `feat(content): <material/version list>` | minor |
| modification/deletion only | `fix(content): <material/version list>` | patch |

After the content commit, a separate `chore(release): vX.Y.Z` commit bumps `package.json`, tags the version (annotated), and pushes everything with `push --follow-tags`. For app-side releases do the same manually: conventional commit + `npm version minor` (or `major`/`patch`).

## Deployment

Every push to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which builds and publishes the site to GitHub Pages.

The first run of the workflow tries to enable Pages on its own (`configure-pages` + `enablement: true`). If that fails due to permissions: under the repo *Settings → Pages → Build and deployment → Source* select **GitHub Actions**, then re-run the workflow.

## Architecture

- `app/` — the shell app: vanilla HTML/CSS/JS, hash-based routing (`#/@frontend/react-hooks?v=2026-07-10`), materials render in an iframe. PDFs are rendered chromeless by `app/pdf.html` — a minimal viewer built on the vendored [PDF.js](https://mozilla.github.io/pdf.js/) core (`app/vendor/pdfjs/`) that draws pages as plain full-width canvases (no toolbar/sidebar/own zoom), so a PDF feels like part of the site. Each page also carries an invisible, aligned PDF.js text layer (`pdf-textlayer.css` is lifted from the vendored viewer) so text can be selected and copied natively — nothing else about the reader UI is exposed. A native iframed / new-tab PDF would behave as a download on Android.
- `scripts/build.js` — zero-dependency scanner: walks `content/`, copies the app + content into `dist/`, and generates `dist/manifest.json`.
- `scripts/serve.js` — zero-dependency local static server.
- `scripts/release.js` — the content release flow described above.
