# Khamirbazi: home pizza guide + calculator

A simple static website (English and Farsi, built together) with accurate, step-by-step instructions for pizza dough at home and a calculator that scales the recipe to your pizza size and number of pizzas. The UI offers two styles now (New York, Neapolitan). calc.js, recipes.json, the tests and the i18n names still cover six styles, pans and a timeline; the UI does not expose them.

Keep it simple (KISS). Prefer fewer files, fewer dependencies, and plain code over clever code.

## Stack (decided)

- **Eleventy (11ty)** builds the static site. Output goes to `_site/`.
- **Pages** (per language, `/en/`, `/fa/`): Home = the calculator (style, method, size, number of pizzas, yeast, then "Show recipe"); `/<lang>/recipe/<style_id>/?method=&size=&pizzas=&yeast=` = ingredients (computed in the browser with calc.js; a 2-pizza 30 cm table is the no-JS fallback) and the steps of the chosen method, then the other Markdown sections under "More details"; Basics. No style pages, no calculator page. The recipe is about dough only.
- **Content** is Markdown, one file per section per language: `src/content/en/` and `src/content/fa/`, same file names in both (`basics.md`, `glossary.md`, `styles/<style_id>.md`). Write content once; never copy it into HTML. Convention (details and sample in README.md): ordered list = steps; an indented `> Why:` line under a step = a muted note that is always shown below the step (no label); `> Tip:`, `> Warning:`, `> Safety:` = callouts (markers stay English in both languages); numbers only as `{{ recipes... }}` values; no Latin words in Farsi text.
- **Languages:** English (LTR) and Farsi (RTL, `lang="fa" dir="rtl"`). Numbers, quantities and percentages live only in `recipes.json`, never in translated text; prose refers to them through template variables so the two languages cannot disagree. UI strings live in `src/_data/i18n/en.json` and `fa.json`. Farsi pages contain no Latin words (see "Farsi writing rules"). Farsi uses the rules in "Farsi writing rules" below. Language switch keeps the user on the same page.
- **Delivery order:** work one pizza style at a time, and finish English and Farsi for that style together so the user can review both side by side. Start with New York.
- **Data** is `src/_data/recipes.json`. It is the single source of truth for every number. Recipe tables and the calculator are both generated from it. Never hardcode a quantity in prose or in JS.
- **Calculator** is one vanilla JS module, `src/assets/calc.js`, exporting pure functions (no DOM). The page script only reads inputs and renders results.
- **Styling** is one hand-written responsive CSS file, mobile first. No CSS framework. The layout adapts; content never changes per screen size. The visual design is in `docs/design` (read-only reference; tokens are CSS variables with the design's names). Fonts are self-hosted (Inter, Vazirmatn, SIL OFL; one sans family), never from Google Fonts. Dark mode follows the system with a footer toggle (`data-theme` on `<html>`, saved in `localStorage` inside try/catch). Farsi pages show Persian digits and ٫ everywhere. Sources, recipes.json, URLs and input values stay Western; the build transform (`lib/persian-html.js`) and the client scripts convert via `toPersianDigits` in `src/assets/i18n.js`.
- **No client framework** (React, Vue, etc.). No dependencies except Eleventy and dev tooling.
- **Tests:** `node --test` on `calc.js`. Test every style/method combination against hand-computed values.
- **Local commands go through the `Makefile`** (`make help` lists them): `make dev` (live server on port 8080), `make test`, `make check`, `make build`, `make ci` (test + check + build, exactly what CI runs), `make preview` (build with the GitHub Pages sub-path and serve it on port 8081), `make clean`. Add new build steps to the Makefile, not only to package.json, so local and CI never differ.

## Publishing (GitHub Pages)

- The site is public on GitHub Pages at `https://pysf.github.io/khamirbazi/`, deployed by GitHub Actions (`.github/workflows/pages.yml`): every push and pull request runs `make ci`; pushes to `main` also deploy `_site/`.
- The workflow sets `PATH_PREFIX=/<repo name>/`. **Every internal link, stylesheet and script URL must go through Eleventy's `url` filter** (for example `{{ '/assets/style.css' | url }}`), never a bare absolute path. JS must use relative imports. Test with `make preview`.
- Only `main` is deployed. Nothing is pushed or merged without the user's say-so. The user must enable Pages once in the repo settings (Source: GitHub Actions).

## Language sync (always)

- English and Farsi must always describe the same recipe. `make check` (`scripts/check-sync.mjs`) runs in CI and fails the build when the two drift: it compares UI string keys and `{placeholders}`, requires every style and method in `recipes.json` to be named in both languages, and compares each pair of files in `src/content/en` and `src/content/fa` (same file names, front matter keys, heading, step, bullet and callout counts, template variables and links).
- Any change to a recipe, step, tip or warning in one language is made in the other in the same commit. Never merge a step that exists in only one language.
- If you add a kind of content that the check cannot see, extend the check in the same commit.

## Data model (`recipes.json`)

- Store everything as **baker's percentages** of flour weight (flour = 100%): water, salt, sugar, oil, yeast, plus per-style `dough_density_g_per_cm2`, bake temperature/time, bake rack. No sauce, cheese or topping data: the guide is about dough only.
- Each style lists its **methods**: `warm_2h`, `room_8_12h`, `cold_12_16h`, `cold_24h`, `cold_48h`, `cold_72h`, each with yeast % (dry), water temperature, rise and rest times.
- Fresh yeast = 3x dry yeast.
- Cold methods use a yeast solution (see below), so the water in the recipe is reduced by the solution amount.
- Every value that is not verified must carry `"verified": false` and a `"note"`. The footer disclaimer stays on the site.

## Calculator rules

- Inputs (UI): style, method, yeast type (dry/fresh), size (round 26/30/32 cm or the 30 x 40 cm oven tray, from `sizes` in `recipes.json`) and number of pizzas (trays for the tray). Dough per pizza = size area x the style's `dough_density_g_per_cm2`. calc.js also still supports ball weight, pans and the timeline (not shown in the UI).
- Output: all ingredients in grams, the yeast solution instructions, a timeline that works backwards from the planned bake time (mix, rest, fridge, take out, preheat, open, bake), oven settings, and bake time. Dough only: no sauce, cheese or topping amounts anywhere (data, calculator, tests, text).
- **Do not round to friendly numbers.** Compute exactly; display at most 1 decimal.
- **Assume a 1 g kitchen scale.** Never ask the user to weigh less than 1 g. Yeast is handled by a solution: dry yeast = one whole 7 g packet in 700 g water (1%); fresh yeast = half a 42 g cube (21 g) in 700 g water (3%). Then weigh out X g of solution, and subtract X from the recipe water.
- Pan styles scale by pan area x dough density, not by pizza count.
- Fridge temperature is an ordinary fridge (about 4-5 degrees C). Room temperature is 21 degrees C.

## Styles in scope (all six in v1)

New York (main recipe), Neapolitan, Roman tonda, al taglio, Detroit, Chicago deep dish.

Reference quantities (for 300 g flour, about 2 pizzas) currently live in `pizza-guide-v7-raw.md` (Persian). That file is the **translation source**. Port its numbers into `recipes.json` (after the fact-check) and write each style in English and Farsi together, then retire it. Designer brief: `docs/ui-designer-prompt.md`.

## Baker's setup the guide assumes (maintainer's private context)

This section is background for the maintainer. **It must not leak into published text** (content, UI strings, glossary, rendered data): no brands, stores, countries or cities, no local-language product terms. `make check` fails when a banned word appears (list in `scripts/check-sync.mjs`).

- Oven max 250 degrees C, German modes (Ober-/Unterhitze, Umluft, Grill). Use top+bottom heat, no fan.
- Flat cast-iron pizza pan (IKEA), preheated 45-60 min on the upper rack. The site says "pizza stone, baking steel or cast-iron pan" are all fine; steel and cast iron conduct heat better than stone. No controlled test of cast iron was found, so mark that advice as home-tested. Other users have different pans, so always offer pan-size alternatives.
- Pizzamehl (Tipo 00), protein about 12-13 g per 100 g. Dry (Trockenhefe, 7 g packet) or fresh (Frischhefe, 42 g cube) yeast. No sourdough.
- Dried, grated mozzarella. Parchment paper (Backpapier) used to launch the pizza.
- Beginner to intermediate. Phone readers.

## Working rules (subagents and facts)

- **Use subagents for medium and large tasks.** Anything that needs more than a few tool calls (researching a style's numbers, porting and translating a style, scaffolding, writing a test suite, reviewing a large diff) goes to a subagent. Run independent ones in parallel. Brief each one fully: it starts with no context. Keep small edits and quick questions in the main session.
- **Fact-based only.** Every number in `recipes.json` must come from a looked-up source (manufacturer, standards body such as AVPN, established baker/cookbook, food-science source). Record `source` URL(s) and `confidence` next to each value. A blog alone is low confidence. If sources disagree, store the range and say so. Research reports go to the scratchpad; only the verified results go in the repo.
- **Final Farsi polish (planned last step, after all style content is written):** run one subagent with `model: "opus"` over every Farsi text file (`src/content/fa/**`, `src/_data/i18n/fa.json`). Wording only: make it fluent and natural, remove literal-translation stiffness, keep the informal "تو" voice. It must not change numbers, `{{ variables }}`, `{methods=...}` markers, `> Why:`/`> Tip:`/`> Warning:`/`> Safety:` markers, no Latin words, list/step counts or meaning. It reports every change; `make ci` must still pass; the user does the final native read. Everything else stays on the default model.
- If a lookup disagrees with a value from the user's earlier tests or instructions, report it and wait for approval before changing it.

## Writing rules (English)

- **Published text must not mention brands, stores, countries or cities of the reader, or local-language product terms** (no Germany, Berlin, REWE, Edeka, dm, Backpapier, Pizzamehl and the like). Use generic terms: pizza flour, instant dry yeast, fresh yeast, baking paper, top and bottom heat, fan mode, protein, semolina, oven tray. Give general guidance only (flour type and protein line, 3x yeast conversion, check the baking paper rating). The origin of a style (Naples, New York...) is history, not the reader's location, and is fine. Package sizes read "a common 7 g packet / 42 g cube, check your pack".
- Plain English, short sentences. Explain **why** next to each step. Keep practical tips; do not cut details.
- Every foreign or technical term is explained where it first appears and listed in the glossary.
- Cross-reference by section number and name (for example "Section 3: Kneading").
- Tables only for ingredients. Everything else is lists and short paragraphs.
- Practical path first; concepts, history and comparisons go in the appendix at the end.
- No jokey or vague names. No invented terms.
- Temperatures in degrees Celsius, quantities in grams.

## Farsi writing rules

- Simple, fluent Farsi; short sentences; explain why next to each step. Phone readers.
- Write temperatures as "250 degrees" in words (the letter C breaks right-to-left flow). Avoid `&` and complex Latin mixes.
- No Latin-script words on Farsi pages. Use the established Persian word (آرد، مخمر فوری، تخمیر سرد، ورز دادن، کفگیر/پیتزابر) and add a short Persian explanation when the term would be opaque. Write proper names in Persian script (تیپو 00، لومباردی، یونسکو). The only Latin on a Farsi page is the language-switch label "EN". `make check` fails on any Latin word in `src/content/fa/**` or in the values of `fa.json` (allow list in `scripts/check-sync.mjs`). Units in words: گرم، درجه، دقیقه، ساعت، سانتی‌متر.
- No unknown or meaningless Farsi phrases. Example: say "کشیدن و تا کردن خمیر" (stretch the dough and fold it over itself), not a literal calque.
- Section references use number and name, same as English.
- The existing Persian guide (`pizza-guide-v7-raw.md`) shows the user's preferred tone; reuse its wording where the content is unchanged.

## Accuracy rules

- Never state an unverified number as fact. If unsure, say so and mark it.
- Keep claims from web sources separate from my own reasoning; cite the source in a comment or note.
- If a lookup suggests changing a user-tested or user-given value, do not change it silently. Report it and wait for approval.
- Known unverified items: exact protein of REWE/Edeka Pizzamehl (about 11.8-13 g), dm dry yeast, yeast amounts for 12-16 h, 48 h, 72 h and room-temperature methods, al taglio / Detroit / Chicago dough density and fermentation ranges, history dates and names. No recipe has been test-baked yet.
- Safety notes must be present: check the parchment paper's maximum temperature (many are rated 220-230 degrees C) before using it at 250 degrees or under the grill; olive oil smokes in a 250 degree pan.

## Known content problems to fix while porting

1. Yeast table lacks 12-16 h (overnight); recipes only show cold water/solution for 24 h. Derive other durations from the data.
2. Cold method timeline is ambiguous (stretch-and-fold rounds vs the 1-1.5 h room-temperature rise). Make the sequence explicit.
3. Neapolitan grill instruction contradicts the oven section. Use one rule: top+bottom heat, grill for the last 1-2 minutes.
4. Second pizza waits on parchment while the first bakes: tell the user to open it only when the oven is ready.
5. Verify the thin al taglio density and the Chicago pan load.

## Git

- Work on branches off `main`, never directly on `main`. Pushing and merging are the user's call.
- **Commit at the end of every step** (scaffold done, calculator done, one style finished in both languages, research results merged into `recipes.json`, and so on). One step, one commit, with a clear message. Run `make ci` first. Do not push unless asked.
- Commit messages end with the Co-Authored-By line from the session attribution.
