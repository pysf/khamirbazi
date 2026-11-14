# Visual guide: step pictures and chips (build spec)

Audience: the coding agent that builds this into the site. Read `CLAUDE.md` first; its rules win over this file.

Design reference (private canvas, the owner can share it): https://claude.ai/artifact/LZ3fdpDuhcjuHnyiCDK8qp
The canvas boards "All steps: warm 2 hours" and "All steps: cold fermentation" show the target look for every New York step. The 15 drawings are in `docs/visual-guide/illustrations/`.

## Goal

Make each step of the recipe easier to scan, without removing anything.

- Add, above each step's text: a small drawing and **chips** (time, temperature, size).
- **Nothing is removed or shortened.** Step text, `> Why:` notes, `> Tip:`, `> Warning:`, `> Safety:` render exactly as today, below the new header.
- Out of scope for this task (later, same pattern): timeline strip, "Is the dough ready?" picture checks, schedule panel, Neapolitan markers.

## Hard rules (from CLAUDE.md, repeated because they matter here)

1. **Numbers live only in `recipes.json`.** Chips read values by reference. No number in a Markdown file, in `stepVisuals.json`, in an SVG or in `i18n/*.json` (except the `{v}`/`{a}`/`{b}` placeholders).
2. **English and Farsi stay in sync.** Same markers in `en` and `fa`; same keys in both i18n files. `make check` must fail when they drift (Module D).
3. **No Latin words on Farsi pages.** Chip labels in `fa.json` are Persian words. Digits are converted by the existing `toPersianDigits` and `lib/persian-html.js`; do not hand-write Persian digits.
4. **Every internal URL goes through Eleventy's `url` filter.** (SVGs are inlined, so there are no image URLs.)
5. No client framework, no new dependency. Plain Nunjucks and CSS. Keep it small (KISS).
6. Work on a branch off `main`. Run `make ci` before each commit. One module, one commit. Do not push.
7. **Farsi wording:** write plain, simple Farsi labels, but expect the owner (and the later polish pass) to adjust the wording. Do not invent unusual terms.

## Module A: illustrations

- Source files: `docs/visual-guide/illustrations/*.svg` (15 files). Copy them to `src/assets/illustrations/`.
- Each file is `viewBox="0 0 200 140"`, `aria-hidden="true"`, has **no text** and uses only these classes:

| class | use | light | dark |
|---|---|---|---|
| `v` (on the `<g>`) | line work: no fill, round caps, 3 px stroke | `--text` | `--text` |
| `dough` | dough fill | `#EBD3A0` | `#8A7650` |
| `crust` | crust fill | `#D9A45B` | `#A8742E` |
| `water` | water fill | `#BFD6E4` | `#4C6B7D` |
| `sauce` | sauce fill | `#C8452B` | `#D65A40` |
| `hot` | thermometer bulb | `--accent` | `--accent` |
| `paper` | white-ish fill | `--surface` | `--surface-2` |
| `solid` | dark fill (pan, oven window) | `--text` | `--text` |
| `acc` (stroke) | accent arrows, heat lines | `--accent` | `--accent` |
| `cold` (stroke) | cold marks | `#3F7FA8` | `#8DB8FF` |

- Add a shortcode `{% illustration "rise" %}` in `.eleventy.js` (or the existing config file) that **inlines** the SVG file. Inline (not `<img>`) so the classes can use the site's CSS variables and dark mode. Fail the build if the file does not exist.
- CSS goes into `src/assets/style.css` (one block, `.vis` prefix not needed beyond the wrapper below). Define the table above with the site tokens from `:root` and `[data-theme="dark"]`. The hex values above are starting points; pick dark values with enough contrast on `--surface-2`.
- Drawings are not mirrored in RTL. They carry no reading direction except a few arrows that point at the object; leave them.
- Do not change a drawing without telling the owner; they approved these.

## Module B: step mapping (`src/_data/stepVisuals.json`)

A step key maps to a drawing and a list of chips.

```json
{
  "yeast_warm":    { "ill": "yeast",    "chips": [ { "unit": "deg", "ref": "methods.warm_2h.water_temp_c" } ] },
  "yeast_cold":    { "ill": "solution", "chips": [ { "unit": "deg", "ref": "methods.{method}.water_temp_c", "label": "cold_water" } ] },
  "mix":           { "ill": "mix",      "chips": [] },
  "rest_autolyse": { "ill": "rest",     "chips": [ { "unit": "min", "ref": "methods.{method}.autolyse_min" } ] },
  "knead_warm":    { "ill": "knead",    "chips": [ { "unit": "min", "ref": "methods.warm_2h.knead_min" } ] },
  "knead_cold":    { "ill": "knead",    "chips": [ { "unit": "min", "ref": "methods.{method}.knead_min" } ] },
  "rise_warm":     { "ill": "rise",     "chips": [
      { "unit": "min", "ref": "methods.warm_2h.bulk_min" },
      { "unit": "deg", "ref": "styles.{style}.practice.warm_place_c" },
      { "unit": "times", "ref": "styles.{style}.practice.rise_factor", "label": "times_bigger" } ] },
  "rise_cold":     { "ill": "rise",     "chips": [
      { "unit": "min", "ref": "methods.{method}.room_rest_min" },
      { "unit": "deg", "ref": "oven.room_c" },
      { "unit": "pct", "ref": "styles.{style}.practice.cold_rise_pct", "label": "pct_bigger" } ] },
  "oven":          { "ill": "oven",     "chips": [
      { "unit": "deg", "ref": "styles.{style}.bake.temp_c" },
      { "unit": "min", "ref": "oven.preheat_min" } ] },
  "divide":        { "ill": "divide",   "chips": [ { "label": "per_pizza" } ] },
  "rest_balls":    { "ill": "rest",     "chips": [ { "unit": "min", "ref": "methods.warm_2h.final_rest_min" } ] },
  "chill":         { "ill": "chill",    "chips": [
      { "unit": "h", "ref": "methods.{method}.fridge_h" },
      { "unit": "deg", "ref": "oven.fridge_c", "label": "fridge" } ] },
  "take_out":      { "ill": "warmup",   "chips": [ { "unit": "min", "ref": "methods.{method}.take_out_lead_min", "label": "before_opening" } ] },
  "open":          { "ill": "open",     "chips": [] },
  "dress":         { "ill": "dress",    "chips": [ { "unit": "cm", "ref": "styles.{style}.practice.rim_cm", "label": "bare_rim" } ] },
  "slide":         { "ill": "slide",    "chips": [] },
  "bake":          { "ill": "bake",     "chips": [
      { "unit": "min", "ref": "styles.{style}.bake.time_min" },
      { "unit": "deg", "ref": "styles.{style}.bake.temp_c" } ] },
  "cut":           { "ill": "cut",      "chips": [ { "unit": "min", "ref": "styles.{style}.practice.rest_before_cut_min" } ] }
}
```

Rules for a chip:

- `ref` is a path into `recipes.json`. `{style}` is the style id (`new_york`), `{method}` is the method id from the page URL (`cold_24h` and so on). A value is either `{ "value": n }` or `{ "range": [a, b] }`; both already exist in the file.
- `unit` picks the default label (`min`, `h`, `deg`, `cm`, `times`, `pct`) and the colour group: `min`/`h` = time, `deg` = temperature, `cm`/`times`/`pct` = size. A chip without `ref` is a fixed text chip (`per_pizza`).
- `label` (optional) is a key in the i18n `chips` object for a custom phrase with `{v}`.
- If a ref is missing for a method (for example `autolyse_min` is `0` for the warm method), **skip that chip**; do not print "0 min". The build should list skipped chips in a warning during `make build` so a typo in a ref is noticed.
- Ranges print as `chips.range` (`{a} to {b}`) and single values as the plain number. All numbers go through the existing `num` filter, so Farsi pages get Persian digits.
- Chip order is the order in the JSON.

## Module C: markers and rendering

1. In Markdown, add a marker after the bold step title, same as the existing `{methods=...}` convention on headings:

```
1. **Prepare the yeast** {visual=yeast_warm}
```

2. Check how `src/_data/docs.js` and the Markdown setup parse steps today, and follow the existing style. The marker must **not** show in the rendered text and must **not** change anything else in the step.
3. The renderer (Nunjucks include, for example `src/_includes/step-header.njk`) outputs, above the step text:

```html
<div class="step-head">
  <div class="step-art">{% illustration ill %}</div>
  <ul class="chips"> <li class="chip chip-time">45 to 60 min</li> ... </ul>
</div>
```

The step number and title stay where they are today (the ordered list). Do not duplicate them.

4. Layout and look (see the canvas for the target):
   - Mobile first. Phone: picture on top (max 160 px wide), chips under it. From 600 px: picture left (200 px), chips to the right of it.
   - Chips are pills: `--r-pill`, `--fs-xs`, 600 weight. Time = `--surface-2`, temperature = `--accent-soft` with `--safe-ink` text, size = a light blue pair (add `--chip-blue-bg` and `--chip-blue-ink` tokens for light and dark).
   - The picture sits on a `--surface-2` rounded tile (`--r-md`).
   - RTL: use logical properties (`margin-inline-start`, `gap`); the layout mirrors by itself.
5. **Accessibility:** drawings are decorative (`aria-hidden`). Chips are real text, so screen readers read them. Contrast must pass in light and dark.
6. **No-JS fallback:** chips and pictures are built at build time. Chips whose `ref` uses `{method}` need the method, which is chosen in the browser. For the no-JS fallback use the default method of the page (the same one the 2-pizza table uses). `src/assets/recipe.js` already shows the chosen method's steps; make it also refresh the chips for the chosen method (call a small pure function in `calc.js` or a new `src/assets/chips.js`, with a node test).

## Module D: i18n and checks

Add to `src/_data/i18n/en.json` and `fa.json` an object `chips`:

```json
"chips": {
  "unit": { "min": "{v} min", "h": "{v} hours", "deg": "{v} degrees", "cm": "{v} cm", "times": "{v} times", "pct": "{v}%" },
  "range": "{a} to {b}",
  "cold_water": "cold water, {v} degrees",
  "times_bigger": "{v} times bigger",
  "pct_bigger": "about {v}% bigger",
  "fridge": "fridge, {v} degrees",
  "before_opening": "{v} min before opening",
  "bare_rim": "bare rim {v} cm",
  "per_pizza": "one piece per pizza"
}
```

Farsi: same keys, Persian words, same `{placeholders}`, no Latin letters (`make check` already enforces this for `fa.json` values).

Extend `scripts/check-sync.mjs` (CI):

- Every `{visual=key}` in a Markdown file exists as a key in `stepVisuals.json`.
- The list of `visual` markers is identical, in order, in each `en` / `fa` file pair.
- Every `ill` value has an SVG file in `src/assets/illustrations/`; every SVG is used at least once.
- Every `unit` and `label` used has an entry in `chips` in both languages, with the same placeholders.
- Every `ref` resolves in `recipes.json` for the style (use the default method for `{method}`), or the check lists it.
- No SVG contains `<text>` or a `style` attribute with a colour.

Add node tests for the chip builder (range, single value, missing value skipped, `{method}` substitution).

## Which step gets which key

Warm method (`## Warm fermentation, 2 hours {methods=warm_2h}`)

| # | Step | key |
|---|---|---|
| 1 | Prepare the yeast | `yeast_warm` |
| 2 | Mix the dough | `mix` |
| 3 | Knead | `knead_warm` |
| 4 | Let the dough rise | `rise_warm` |
| 5 | Heat the oven and the baking surface | `oven` |
| 6 | Divide and ball | `divide` |
| 7 | Rest the balls | `rest_balls` |
| 8 | Open the dough | `open` |
| 9 | Dress the pizza | `dress` |
| 10 | Slide the pizza in | `slide` |
| 11 | Bake | `bake` |
| 12 | Rest and cut | `cut` |

Cold method (`## Cold fermentation {methods=cold_12_16h,cold_24h,cold_48h,cold_72h}`)

| # | Step | key |
|---|---|---|
| 1 | Prepare the yeast | `yeast_cold` |
| 2 | Mix the dough | `mix` |
| 3 | Rest the dough | `rest_autolyse` |
| 4 | Add the salt and knead | `knead_cold` |
| 5 | Let the dough rise | `rise_cold` |
| 6 | Divide and ball | `divide` |
| 7 | Chill the dough | `chill` |
| 8 | Take the dough out of the fridge | `take_out` |
| 9 | Heat the oven and the baking surface | `oven` |
| 10 | Open the dough | `open` |
| 11 | Dress the pizza | `dress` |
| 12 | Slide the pizza in | `slide` |
| 13 | Bake | `bake` |
| 14 | Rest and cut | `cut` |

Do the same for the Farsi files, step for step.

## Order of work and acceptance

1. Module A (files, shortcode, CSS). Commit.
2. Module B + C for **New York, English and Farsi together** (markers in both Markdown files, mapping, include, i18n). Commit.
3. Module D (check script, tests). Commit. `make ci` passes.
4. Run `make preview` (sub-path build) and look at the warm and cold pages on a phone width, in dark mode and on the Farsi page.

Done when:

- All 26 steps show a drawing; steps without chips show none.
- Chip numbers equal the numbers in the step text (they come from the same `recipes.json` values).
- Changing a value in `recipes.json` changes the chip and the text together.
- Removing a marker from only one language fails `make check`.
- No step text, Why note or callout changed (the diff of `src/content/**` is markers only).
- The chosen method on the page changes the chips (for example 24 hours vs 48 hours in "Chill the dough").
