# Design reference (read-only)

Exported from the Khamirbazi design canvas: https://claude.ai/artifact/Txwq38ixzSvox7MZAJ9FCD (private link; version 1794143776-69d2).

These `.dc.html` files only run inside the canvas. Do not ship them. Use them as a reference when building the Eleventy site.

## Where to look

| What | File |
|---|---|
| All screens, components, CSS, and copy for both languages | `Screens.dc.html` (one component; `screen` (home, recipe, basics, tokens, components), `lang`, `theme` props pick the variant) |
| Which variant each board shows | the small wrapper files (`Main`, `HomeFaDark`, `StyleEn`, `CalcPanFa`, ...) |
| Design tokens (CSS variables) | the `.kb` and `.kb[data-theme=dark]` blocks at the top of `Screens.dc.html`, and the "Design tokens" board |
| Logotype and icon rules | `Logo.dc.html` |
| RTL decisions and assumptions | `Notes.dc.html` |
| Board layout on the canvas | `canvas.json` |

## Porting rules

- Take the CSS from the `<style>` in `Screens.dc.html` into one `src/assets/style.css`. It already uses logical properties for RTL.
- Rename the `.kb` root selector to `:root` / `[data-theme]` / `[dir=rtl]`. Remove the `sc-for, sc-if` rule and `min-height: 100vh`.
- `{{...}}` holes become Eleventy variables. Strings in `renderVals()` move to `src/_data/i18n/en.json` and `fa.json`.
- **Every number, time, difficulty and fermentation label in the mockups is a placeholder.** Real values come only from `recipes.json` after the fact-check.
- Farsi copy is a draft.
- Fonts: self-host Inter and Vazirmatn (all SIL OFL). Do not load from Google Fonts in production.

## Logo

`logo/` holds the SVG files: `mark.svg` (tomato), `mark-ink.svg`, `mark-cream.svg`, `mark-on-dark.svg`, `favicon.svg`.
They are hand-traced from the supplied raster concept (ring, cut-out slice, six dots: one per style). The wordmark is live text: Inter 600 (English) or Vazirmatn 700 (Farsi).
Before launch, check the mark against existing logos and consider a trademark search; pizza-with-a-slice-missing is a common idea.
