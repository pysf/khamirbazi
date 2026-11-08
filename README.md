# Khamirbazi

A static, bilingual (English and Farsi) home pizza guide with a dough calculator. Six styles: New York, Neapolitan, Roman tonda, al taglio, Detroit, Chicago deep dish. Built with Eleventy 3 (ESM); the calculator is plain JavaScript.

## Run

Needs Node 20 or newer and `make`.

```
make help      # list commands
make dev       # local server with live reload, http://localhost:8080/
make ci        # tests + English/Farsi sync check + build (what GitHub Actions runs)
make preview   # build with the GitHub Pages sub-path, http://localhost:8081/khamirbazi/
```

`make test`, `make check`, `make build` and `make clean` run the single steps.

The site is built to `_site/` with URLs `/en/...` and `/fa/...`; `/` redirects to `/en/`. It is published with GitHub Actions to GitHub Pages (`.github/workflows/pages.yml`). Set `PATH_PREFIX=/khamirbazi/` to build for the Pages sub-path; all internal links use Eleventy's `url` filter for this.

## Where things are

- `src/_data/recipes.json`: every number (baker's percentages, methods, yeast, pans, bake settings, safety data), each with `confidence`, `verified`, `sources` and notes. Single source of truth.
- `src/assets/calc.js`: pure calculator (`computeRecipe`, `panArea`, `formatNumber`). No DOM. Results are exact; only `formatNumber` rounds, to at most one decimal.
- `src/assets/calculator-page.js`: reads the form, calls `calc.js`, renders the result.
- `src/_data/i18n/en.json`, `fa.json`: UI strings. `src/_data/tables.js`: ingredient tables for the style pages, computed from the data.
- `src/_includes/layout.njk`, `src/home.njk`, `src/style.njk`, `src/calculator.njk`, `src/basics.njk`: templates. `src/assets/style.css`: the only stylesheet (design tokens as CSS variables, ported from `docs/design`, which is read-only reference).
- `src/assets/site.js`: theme toggle, method tabs on style pages, expanded "Why?" when printing. `src/assets/fonts/`: self-hosted Inter, Newsreader and Vazirmatn (SIL OFL, license in `OFL.txt`). `src/assets/favicon.svg`.
- `lib/content.js`: renders the Markdown content (steps, "Why?", callouts, `{{ }}` values). `lib/icons.js`: the inline SVG icons.
- `src/content/<lang>/`: Markdown prose, same file names in `en` and `fa`: `basics.md`, `glossary.md`, and `styles/<style_id>.md` (the step-by-step body of a style page; until a file exists the page shows a placeholder).
- `test/calc.test.js`: tests with hand-computed expectations for every style and several methods.

## Writing content (Markdown convention)

Prose for a style lives in `src/content/<lang>/styles/<style_id>.md` (ids as in `recipes.json`), identical structure in both languages. `make check` compares the counts below.

- `##` headings are the sections (for example the steps, then troubleshooting).
- An ordered list is the list of steps. Write the action as the item text.
- A blockquote line `> Why: ...`, indented under a step, becomes the expandable "Why?" of that step.
- `> Tip: ...`, `> Warning: ...` and `> Safety: ...` become callouts. The marker words stay in English in both languages; the visible label ("Tip", "نکته") comes from the UI strings. Every blockquote must start with one of the four markers.
- Bullet lists become the bulleted list (for example troubleshooting: `- **Problem.** Fix.`).
- Numbers come from `recipes.json`: write `{{ recipes.styles.new_york.bake.temp_c.value }}`, never the number. A wrong path stops the build. Do not put links in content (they would need the sub-path prefix).
- Latin terms inside Farsi text: wrap in `<bdi>...</bdi>`. Write temperatures in words ("degrees"), not with the letter C.

Sample (a test fixture, see `test/content.test.js`, not real content):

```
## Steps

1. First sample step.
   > Why: Sample reason for the first step.
2. Second sample step.

> Safety: Sample note about {{ recipes.safety.parchment_max_c.value }} degrees.

## Troubleshooting

- **Sample problem.** Sample answer.
```

Safety callouts on style pages (parchment limit, olive oil smoke point) are generated from `recipes.json` safety data, not written in Markdown.

## Fonts and theme

Fonts are self-hosted (`src/assets/fonts/`, woff2 subsets, `font-display: swap`); nothing loads from Google Fonts. Dark mode follows `prefers-color-scheme`; the header button sets `data-theme` on `<html>` and remembers the choice in `localStorage` (the page works without storage). Numbers use Western digits (0-9) in both languages, as the design decides.
