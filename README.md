# Khamirbazi

A static, bilingual (English and Farsi) home pizza guide with a dough calculator. Six styles: New York, Neapolitan, Roman tonda, al taglio, Detroit, Chicago deep dish. Built with Eleventy 3 (ESM); the calculator is plain JavaScript.

## Run

Needs Node 20 or newer.

```
npm install
npm run dev      # local server with live reload, http://localhost:8080/
npm run build    # writes the site to _site/
npm test         # node --test on the calculator and the data
```

The site is built to `_site/` with URLs `/en/...` and `/fa/...`; `/` redirects to `/en/`. Serve `_site/` from a web root (asset links start with `/assets/`).

## Where things are

- `src/_data/recipes.json`: every number (baker's percentages, methods, yeast, pans, bake settings, safety data), each with `confidence`, `verified`, `sources` and notes. Single source of truth.
- `src/assets/calc.js`: pure calculator (`computeRecipe`, `panArea`, `formatNumber`). No DOM. Results are exact; only `formatNumber` rounds, to at most one decimal.
- `src/assets/calculator-page.js`: reads the form, calls `calc.js`, renders the result.
- `src/_data/i18n/en.json`, `fa.json`: UI strings. `src/_data/tables.js`: ingredient tables for the style pages, computed from the data.
- `src/_includes/layout.njk`, `src/home.njk`, `src/style.njk`, `src/calculator.njk`: templates. `src/assets/style.css`: the only stylesheet.
- `test/calc.test.js`: tests with hand-computed expectations for every style and several methods.
