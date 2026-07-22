# Adding language (or other switchable variants) to a content page

Hand this document to whoever — human or AI — generates a content page for
[Interview Browser](../README.md) that should support switching between
variants, typically languages.

## How a content page is embedded

The shell app lists materials and renders the selected one in a same-origin
`<iframe>`. It draws the version bar (the dropdowns above the content), so a
content page **must not** build its own language switcher UI — it only reacts to
what the shell tells it.

Which dropdown appears is declared in a `_facets.json` next to the content (see
the README). A *param axis* looks like this:

```json
[
  { "label": "Language", "param": "lang", "values": ["en", "hu"], "keepPosition": true }
]
```

- `param` — the name the choice is passed under (`lang` here).
- `values` — exactly the strings the page will receive; the **first is the
  default**.
- `keepPosition` — the shell tries to keep the reading position across a switch.

## What the content page must do

### 1. Read the initial value from the URL (required)

The shell loads the page with the current choice in the query string, e.g.
`page.html?lang=hu`. Deep links carry it too, so the page must apply it on load:

```js
const lang = new URLSearchParams(location.search).get('lang') || 'en';
```

Always fall back to a default so the page still works when opened directly.

### 2. Expose an in-place switch (strongly recommended)

If the page defines `window.interviewBrowser.setParams`, the shell calls it
directly instead of reloading the iframe:

```js
window.interviewBrowser = {
  setParams(params) {
    applyLang(params.lang);
  },
};
```

- `params` is an object of **all** current param values, e.g. `{ lang: "hu" }`.
- The call is synchronous and same-origin; nothing is posted or awaited.
- Define it as early as possible (a plain `<script>` in the body is fine) — the
  shell only looks for it at the moment of a switch.

**Why it matters.** With `setParams` the switch is instant: no reload, no white
flash, and the scroll position is untouched. Without it the shell falls back to
reloading the iframe with the new query parameter; that works, but the page
blanks for a moment and the position can only be restored approximately (it is
restored by pixel offset, and the same offset is not the same paragraph when one
language runs longer than the other).

## Recommended implementation

Keep **both languages in the DOM** and toggle them with an attribute + CSS. No
network requests, no re-rendering, so switching cannot fail or flicker:

```html
<style>
  :root[data-lang="hu"] [lang="en"] { display: none }
  :root[data-lang="en"] [lang="hu"] { display: none }
</style>

<p>
  <span lang="en">Explain the event loop.</span>
  <span lang="hu">Magyarazd el az event loopot.</span>
</p>

<script>
  function applyLang(lang) {
    document.documentElement.dataset.lang = lang;
  }
  window.interviewBrowser = { setParams: (params) => applyLang(params.lang) };
  applyLang(new URLSearchParams(location.search).get('lang') || 'en');
</script>
```

## Rules of thumb

- Use exactly the value strings from `values` (`"en"`, `"hu"`), nothing else.
- Don't render your own language buttons — the shell owns that UI.
- Don't reload, navigate or rewrite `location` when switching; just re-style.
- Keep the two variants structurally identical (same sections in the same
  order), so the position stays meaningful across a switch.
- The mechanism is not language-specific: any param axis (audience, difficulty,
  …) works the same way; `setParams` receives all of them at once.
