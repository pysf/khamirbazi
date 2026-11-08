# Khamirbazi

A static, bilingual (English and Farsi) home pizza dough guide with a calculator. The UI offers New York and Neapolitan; the data, calculator and tests still cover six styles (also Roman tonda, al taglio, Detroit, Chicago deep dish), pans, ball weights and a timeline, which the UI does not expose. Built with Eleventy 3 (ESM); the calculator is plain JavaScript.

## Run

Needs Node 20 or newer and `make`.

```
make help      # list commands
make dev       # local server with live reload, http://localhost:8080/
make ci        # tests + English/Farsi sync check + build (what GitHub Actions runs)
make preview   # build with the GitHub Pages sub-path, http://localhost:8081/khamirbazi/
```

`make test`, `make check`, `make build` and `make clean` run the single steps.

The site is built to `_site/` with URLs `/en/` (Home = calculator), `/en/recipe/<style_id>/?method=&size=&pizzas=&yeast=`, `/en/basics/` and the same under `/fa/`; `/` redirects to `/en/`. It is published with GitHub Actions to GitHub Pages (`.github/workflows/pages.yml`). Set `PATH_PREFIX=/khamirbazi/` to build for the Pages sub-path; all internal links use Eleventy's `url` filter for this.

## Where things are

- `src/_data/recipes.json`: every number (baker's percentages, methods, yeast, pans, bake settings, safety data), each with `confidence`, `verified`, `sources` and notes. Single source of truth.
- `src/assets/calc.js`: pure calculator (`computeRecipe`, `panArea`, `formatNumber`). No DOM. Results are exact; only `formatNumber` rounds, to at most one decimal. Round and tray sizes: `mode: { pizzas, size: { shape, diameter | length, width } }`, dough = pizzas x area x the style's `dough_density_g_per_cm2` (derived from 250 g for 30 cm; `sizes` in `recipes.json` lists the four sizes of the site).
- `src/assets/home.js`: the Home inputs; "Show recipe" is a link with the choices in the query string. `src/assets/recipe.js`: reads the query string, renders the ingredients with `calc.js`, shows the steps of the chosen method. `src/assets/site.js`: theme toggle, language switch that keeps the query string.
- `src/_data/i18n/en.json`, `fa.json`: UI strings. `src/_data/recipePage.js`: per-style data for the recipe page and its no-JS default table.
- `src/_includes/layout.njk`, `src/home.njk`, `src/recipe.njk`, `src/basics.njk`: templates. `src/assets/style.css`: the only stylesheet (tokens ported from `docs/design`, which is read-only reference).
- `src/assets/fonts/`: self-hosted Inter and Vazirmatn (SIL OFL, license in `OFL.txt`). `src/assets/logo/`: logo mark and favicon.
- `lib/content.js`: renders the Markdown content (steps, "?" notes, callouts, `{{ }}` values). `lib/icons.js`: the inline SVG icons.
- `src/content/<lang>/`: Markdown prose, same file names in `en` and `fa`: `basics.md`, `glossary.md`, and `styles/<style_id>.md` (the body of a recipe page; until a file exists the page shows a placeholder).
- `test/calc.test.js`: tests with hand-computed expectations for every style and several methods.

## Writing content (Markdown convention)

Prose for a style lives in `src/content/<lang>/styles/<style_id>.md` (ids as in `recipes.json`), identical structure in both languages. `make check` compares the counts below.

- `##` headings are the sections (for example the steps, then troubleshooting).
- An ordered list is the list of steps. Write the action as the item text.
- A blockquote line `> Why: ...`, indented under a step, becomes the round "?" of that step ("Good to know", with a link to Basics). Write the step as `**Action.** one line of detail.`; the bold part is shown as the step title.
- `> Tip: ...`, `> Warning: ...` and `> Safety: ...` become callouts. The marker words stay in English in both languages; the visible label ("Tip", "نکته") comes from the UI strings. Every blockquote must start with one of the four markers.
- Bullet lists become the bulleted list (for example troubleshooting: `- **Problem.** Fix.`).
- Numbers come from `recipes.json`: write `{{ recipes.styles.new_york.bake.temp_c.value }}`, never the number. A wrong path stops the build. Do not put links in content (they would need the sub-path prefix).
- A `##` heading that ends with `{methods=id1,id2}` (method ids from `recipes.json`) whose section contains an ordered list is the **main step list** of those methods: the recipe page shows it first, only for the selected method (without JavaScript, the style's default method). Every other `##` section (also method-specific ones without steps, such as a checklist) goes under "More details" as a collapsible block, in file order. Use the same markers in both languages; `make check` compares them.
- Recipe pages with written content do not repeat the generated parchment, grill, olive oil and yeast notes at the top; write them as `> Safety:` / `> Warning:` callouts in the content (with values from `recipes.safety`).
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

Until a style has a content file, its recipe page shows the ingredients, a placeholder for the steps and the generated safety notes (parchment limit, olive oil smoke point) from `recipes.json` and a placeholder for the steps. Numbers used only in prose (for example `styles.new_york.practice`) also live in `recipes.json`. A method can set `min_pizzas` (the warm 2-hour method needs 2): the calculator then reports `min_batch` instead of a yeast amount.

## Fonts and theme

Fonts are self-hosted (`src/assets/fonts/`, woff2 subsets, `font-display: swap`; Inter, and Vazirmatn for Farsi); nothing loads from Google Fonts. Dark mode follows `prefers-color-scheme`; the footer button sets `data-theme` on `<html>` and remembers the choice in `localStorage` (the page works without storage). Numbers use Western digits (0-9) in both languages, as the design decides.
