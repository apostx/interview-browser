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
- **Material:** any unmarked folder inside a group or at the root. Its subfolders are **versions** (named freely — dates, v1, anything).
- **Content file** within a folder: `index.html` > alphabetically first `*.html` > first `*.pdf`. All other files (images, css, js) are copied verbatim, so relative references keep working.
- **Default version:** if the material folder directly contains a content file, that is the default (shown as "current"); otherwise the first version in descending name order (for date-named folders that is the newest).
- A subfolder without a content file is not a version but an asset folder — the build omits it from the list but still copies its files.

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

- `app/` — the shell app: vanilla HTML/CSS/JS, hash-based routing (`#/@frontend/react-hooks?v=2026-07-10`), materials render in an iframe. PDFs are rendered chromeless by `app/pdf.html` — a minimal viewer built on the vendored [PDF.js](https://mozilla.github.io/pdf.js/) core (`app/vendor/pdfjs/`) that draws pages as plain full-width canvases (no toolbar/sidebar/own zoom), so a PDF feels like part of the site. A native iframed / new-tab PDF would behave as a download on Android.
- `scripts/build.js` — zero-dependency scanner: walks `content/`, copies the app + content into `dist/`, and generates `dist/manifest.json`.
- `scripts/serve.js` — zero-dependency local static server.
- `scripts/release.js` — the content release flow described above.
