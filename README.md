# Khamirbazi

Pizza dough at home, in English and Farsi. Pick a pizza type, fermentation, size and number of pizzas, and get exact grams and step-by-step instructions. Two styles: New York and Neapolitan. Dough only.

Live: https://pysf.github.io/khamirbazi/

## Run

Needs Node 20+ and `make`.

```
make dev       # live server, http://localhost:8080/
make ci        # tests + English/Farsi sync check + build (same as GitHub Actions)
make preview   # build with the Pages sub-path, http://localhost:8081/khamirbazi/
make help      # all commands
```

Every push to `main` deploys to GitHub Pages (`.github/workflows/pages.yml`).

## Where things are

- `src/_data/recipes.json`: every number, with sources and confidence. The single source of truth.
- `src/assets/calc.js`: the calculator (pure functions, tested in `test/`).
- `src/content/{en,fa}/`: the text, as Markdown. Same files and structure in both languages.
- `src/_data/i18n/{en,fa}.json`: UI strings.
- `src/*.njk`, `src/assets/`: templates, page scripts, CSS, fonts.
- `lib/`: Markdown rendering and the Persian-digit transform.
- `docs/test-bake-plan.md`: test bakes still to do.

## Writing content

- `## Heading {methods=warm_2h}`: the main steps of those fermentations. Other `##` sections go under "More details".
- `## Heading {#some-id}`: gives the section an id (the same in both languages), so text can link to it, for example `[Reading the dough](/en/basics/#reading-the-dough)`.
- Steps: `1. **Short title**`, then the body indented below. Numbered sub-steps for actions in order, bullets for alternatives.
- Under a step: `> Why:` (a note), `> Tip:`, `> Warning:`, `> Safety:` (callouts). Markers stay English in both languages.
- Numbers only as `{{ recipes.… }}`, never typed in text, and never in a `##` heading.
- Farsi: no Latin letters, Western digits in the source (the build shows Persian digits).
- Change English and Farsi in the same commit. `make check` fails when they drift.

The project rules are in `CLAUDE.md`.
