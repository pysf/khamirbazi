# Prompt for an AI UI designer

Design the UI for **Khamirbazi**, a static, bilingual (English LTR and Farsi RTL) website that teaches people to bake six pizza styles at home, with a built-in dough calculator. Deliver a mobile-first design (360 px wide first, then tablet 768 px and desktop 1200 px) in light and dark mode, for both languages.

## Audience and context

- Home bakers, beginners to intermediate, mostly reading on a phone in the kitchen with floury hands: large tap targets, high contrast, readable at arm's length, no tiny controls.
- Many users are Farsi speakers living in Germany. Ovens max out at 250 degrees Celsius and kitchen scales read whole grams only. Quantities are always in grams.
- Tone: calm, clear, trustworthy, a little warm. Not playful or jokey. It should feel like a precise cookbook, not a food blog.

## Pages

1. **Home:** short pitch, six style cards (New York, Neapolitan, Roman tonda, al taglio, Detroit, Chicago deep dish), each with a name, one-line description, difficulty, typical fermentation time, and a link. Also a prominent "Open the calculator" button.
2. **Style page** (one per style): the same layout for all six.
   - Header: name, short description, key facts (hydration, bake temperature and time, fermentation options).
   - Method switcher: 2-hour warm, overnight, 24 h, 48 h, 72 h cold.
   - Ingredient table (the only table on the site) for a chosen quantity, with a link "Change amount in the calculator".
   - Step-by-step instructions as a numbered list. Every step has a short bold action and a lighter "Why?" explanation, collapsed by default and expandable.
   - Tips and troubleshooting list. Safety notes shown as clear callouts.
3. **Calculator:** the most important screen. Inputs: style, method, yeast type (dry or fresh), then either number of pizzas plus ball weight, or a pan (round diameter, or rectangle length x width, with presets such as "Oven tray 30 x 40 cm", multiple pans allowed). Optional: planned bake time. Output, updating live as inputs change:
   - ingredient list in grams,
   - yeast solution instructions as a small boxed step ("Dissolve 1 packet in 700 g water, then use X g"),
   - sauce, cheese and topping amounts,
   - a vertical timeline that counts backwards from the bake time (mix, rest, fridge, take out, preheat, shape, bake),
   - oven settings and bake time,
   - actions: copy as text, print, "keep screen awake" toggle.
4. **Basics (reference):** hydration, gluten, yeast and time, style comparison, glossary. Quieter visual style than the cooking pages.
5. **Language switcher:** always visible; switching keeps the user on the same page.

## Design requirements

- Mobile first, single column; the calculator may be two columns (inputs and results) on desktop only. Sticky "result summary" bar on mobile calculator.
- Light and dark themes; dark mode comfortable in a dim kitchen. Warm, food-appropriate palette (suggestions: tomato red accent, flour-cream background, olive or charcoal text), but check WCAG AA contrast (4.5:1) in both themes.
- Typography: a readable system or free web font pair. Farsi: use Vazirmatn or similar; make sure Farsi and Latin text sit well together and that numbers read clearly. Generous line height, short line length.
- Full RTL support: mirror layout, icons with direction (arrows, back buttons), progress and timeline orientation, and number formatting. Show Latin terms and units correctly inside Farsi sentences.
- Components to specify: header and nav, language switcher, style card, key-facts strip, method tabs, ingredient table (responsive, no horizontal scroll), step list with expandable "Why?", callouts (tip, warning, safety), calculator form controls (segmented control, number stepper, select, radio cards), results card, timeline, buttons, footer with the disclaimer "Amounts and times are approximate; change one thing at a time."
- States: empty, valid, error (for example pan too small), loading is not needed (static), print view for the calculator output and style pages.
- Accessibility: keyboard navigable, visible focus, semantic structure, respects reduced motion, no information by color alone.
- Performance and implementation limits: plain HTML, CSS and a little JavaScript; no heavy images. Use simple SVG icons and one illustration style for the style cards (flat, minimal). The design must be implementable with one responsive stylesheet and CSS variables (design tokens for colors, spacing, radius, type scale).

## Deliverables

- Screens: Home, Style page, Calculator (input state and result state), Basics, in mobile, tablet and desktop, English and Farsi, light and dark.
- A small design-token sheet (colors, type scale, spacing, radius, shadows) with names I can copy into CSS variables.
- Component sheet with states.
- Short notes on RTL decisions and any assumptions.
