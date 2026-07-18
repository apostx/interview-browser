# Interview Browser

Mobil-optimalizált keret-webapp, amiben AI-generált, egymástól teljesen független egyoldalas HTML (vagy PDF) interjú-felkészítő anyagok között lehet tallózni és a verzióik között váltani.

Új anyag hozzáadásához **nem kell se konfigot, se kódot módosítani**: csak bemásolod a mappát a `content/` alá és pusholsz — a build magától felderíti.

## Mappa-konvenció

```
content/
  @frontend/              <- group (@ prefix, tetszőlegesen ágyazható)
    react-hooks/          <- anyag (jelöletlen mappa)
      index.html          <- default verzió ("aktuális")
      2026-07-10/         <- verzió (az anyag almappája, a neve kötetlen)
        barmi-nevu.html
  system-design/          <- group nélküli anyag a gyökérben
    2026-06-01/
      prep.html
    2026-07-01/           <- default = név szerint csökkenő sorrendben az első
      prep.html
```

Szabályok:

- **Group:** `@`-prefixű mappa (megjelenített név a prefix nélkül). Tartalmazhat groupokat és anyagokat, tetszőleges mélységben.
- **Anyag:** bármilyen jelöletlen mappa egy groupban vagy a gyökérben. Az almappái a **verziók** (a nevük kötetlen — dátum, v1, bármi).
- **Tartalomfájl** egy mappán belül: `index.html` > ábécé szerinti első `*.html` > első `*.pdf`. Minden más fájl (kép, css, js) változatlanul másolódik, így a relatív hivatkozások működnek.
- **Default verzió:** ha az anyag mappájában közvetlenül van tartalomfájl, az a default („aktuális” néven jelenik meg); különben a név szerint csökkenően rendezett első verzió (dátum-nevű mappáknál ez a legújabb).
- Tartalomfájl nélküli almappa nem verzió, hanem asset-mappa — a build kihagyja a listából, de a fájljai kimásolódnak.

## Használat

Élő oldal: **https://interviewbrowser.sallai.cc/**

```sh
# lokális fejlesztés: build + szerver (nincs függőség, csak Node kell)
npm run dev                    # http://localhost:8080

# csak build
npm run build                  # -> dist/

# content release: build-ellenőrzés + conventional commit + szemver bump + tag + push
npm run release                        # automatikus üzenet + automatikus bump
npm run release -- --major             # bump felülbírálása (--major/--minor/--patch)
npm run release -- "feat(content): saját üzenet"
```

A `release` csak a `content/` alatti változásokat commitolja (az app/script módosításokat nem), és a push után a GitHub Actions automatikusan deployol.

## Verziózás és commit konvenció

A repo [conventional commits](https://www.conventionalcommits.org/) szerint commitol (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:` …; content-hez a `(content)` scope), a projekt pedig [szemver](https://semver.org/) verziót követ (`package.json` + `vX.Y.Z` git tag).

A `npm run release` default logikája:

| Változás a content/ alatt | Commit | Bump |
|---|---|---|
| van új fájl (új anyag vagy verzió) | `feat(content): <anyag/verzió lista>` | minor |
| csak módosítás/törlés | `fix(content): <anyag/verzió lista>` | patch |

A content commit után külön `chore(release): vX.Y.Z` commit bumpolja a `package.json`-t, tageli a verziót, és `push --follow-tags`-szel tol ki mindent. App-oldali release-hez ugyanez kézzel: conventional commit + `npm version minor` (vagy `major`/`patch`).

## Deploy

Minden `main`-re történő push után a GitHub Actions workflow (`.github/workflows/deploy.yml`) lebuildeli és publikálja az oldalt GitHub Pages-re.

A workflow első futása megpróbálja magától bekapcsolni a Pages-t (`configure-pages` + `enablement: true`). Ha ez jogosultság miatt nem sikerülne: a repo *Settings → Pages → Build and deployment → Source* alatt válaszd a **GitHub Actions**-t, majd futtasd újra a workflow-t.

## Felépítés

- `app/` — a keret app: vanilla HTML/CSS/JS, hash-alapú routing (`#/@frontend/react-hooks?v=2026-07-10`), az anyagokat iframe-be ágyazza. A PDF-eket a vendorolt [PDF.js](https://mozilla.github.io/pdf.js/) viewer rendereli (`app/vendor/pdfjs/`), mert Androidon az iframe-be ágyazott / új füles PDF letöltésként viselkedne.
- `scripts/build.js` — zero-dependency scanner: bejárja a `content/`-et, `dist/`-be másolja az appot + tartalmat, és legenerálja a `dist/manifest.json`-t.
- `scripts/serve.js` — zero-dependency lokális statikus szerver.
