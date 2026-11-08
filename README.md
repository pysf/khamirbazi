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
- `src/_includes/layout.njk`, `src/home.njk`, `src/style.njk`, `src/calculator.njk`: templates. `src/assets/style.css`: the only stylesheet.
- `test/calc.test.js`: tests with hand-computed expectations for every style and several methods.
