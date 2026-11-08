# Test-bake plan

This plan is for the maintainer. It is not published on the site. No recipe in this guide has been test-baked yet, so every amount and time in `src/_data/recipes.json` is a starting point. The seven tests below come from the independent validation review (November 2026). Each test checks the values that review marked as uncertain.

## How to run a test

- Change one thing at a time. Keep everything else as the site says.
- Write down the date, the room temperature, the fridge temperature (put a thermometer in a glass of water in the fridge overnight), the flour (protein per 100 g) and the yeast (dry or fresh, packet date).
- Mark the dough level on the container with tape or a pen at the start, so you can see 1.5 times and 2 times.
- Take a photo of the dough before baking and of the crust and base after baking.
- A 1 g kitchen scale is enough. A kitchen timer and an oven or infrared thermometer help.

## 1. Warm 2-hour method

- **Bake:** New York, 2 pizzas of 30 cm, dry yeast (the card says about 2 g).
- **Note:** the room or warm-place temperature, and the minutes until the dough is 1.5 times and 2 times its size.
- **Decide:** if the dough needs more than 75 minutes at 26 to 28 degrees, raise `methods.warm_2h.yeast_pct_dry` to about 0.8 to 1%. If it doubles in under 40 minutes, lower it. Also note how long the rise takes in a 21 degree room without a warm place; if it is far from 90 minutes, change `methods.warm_2h.bulk_slow_max_min`.

## 2. Room-temperature method, 8 to 12 hours

- **Bake:** Neapolitan, room-temperature method (0.1% dry yeast), in a room of about 21 degrees.
- **Note:** at 4 hours, the dough in one piece should be about 1.3 to 1.5 times its size. At 9 hours, the balls should be relaxed and a finger dent should spring back slowly.
- **Decide:** if the balls are slack or smell of alcohol by 9 hours, lower `methods.room_8_12h.yeast_pct_dry`. If they are still tight at 12 hours, raise it.

## 3. Cold fermentation, 24, 48 and 72 hours

- **Bake:** one batch with the 24-hour amount (or one batch per time), divided into balls. Bake one ball at 24 hours, one at 48 hours and one at 72 hours.
- **Note:** a sharp alcohol smell, flat or slack balls and big bubbles mean too much yeast. A dense, pale crust means too little.
- **Decide:** if the 48 or 72-hour dough over-rises, try 0.1% for 48 hours and 0.07% for 72 hours (`methods.cold_48h.yeast_pct_dry`, `methods.cold_72h.yeast_pct_dry`). Repeat for the 12 to 16-hour method (0.3%), which is an estimate.

## 4. Bake times and heat recovery

- **Bake:** New York on the baking surface you have (cast iron, steel or stone) at 250 degrees on the upper third. Bake one pizza with the grill for the last 1 to 2 minutes and one without.
- **Note:** minutes until the rim is golden and the base is spotted and crisp. If you have an infrared thermometer, measure the surface after 45 and after 60 minutes of preheating, and the minutes it needs to get back to that temperature after the first pizza comes out.
- **Decide:** update `styles.new_york.bake.time_min` (now 7 to 9 minutes), `styles.new_york.bake.stone_max_min` (now up to 12 on a stone), `oven.preheat_min` (45 to 60 minutes) and `styles.new_york.practice.second_pizza_wait_min` (now 5 to 10 minutes, low confidence).

## 5. Yeast solution: does stirring matter?

- **Bake:** make the 700 g solution with one 7 g packet. Take 60 g from the top after 10 minutes without stirring, and 60 g right after stirring. Make two small doughs with them.
- **Note:** compare how fast the two doughs rise.
- **Decide:** if the unstirred sample rises clearly slower, keep the "stir again right before you pour" line on the card (UI string `card.solution_dry`). Check whether `yeast.solution.dissolve_wait_min` (5 minutes) is enough for the dry yeast to dissolve.

## 6. Baking paper at 250 degrees

- **Bake:** one pizza on paper left in for the whole bake, one with the paper pulled out after 3 minutes.
- **Note:** when the paper darkens or turns brittle, any smoke or smell, and whether the base sets enough by 2 to 3 minutes to pull the paper out.
- **Decide:** update `safety.parchment_pull_min` (now 2 to 3 minutes).

## 7. Fan versus top and bottom heat

- **Bake:** only if your oven has a pizza mode (fan with bottom heat). Bake one pizza with top and bottom heat and one in that mode, same time and rack.
- **Note:** colour of the top and of the base, and the bake time.
- **Decide:** if the pizza mode gives an even top and base, the text can recommend it next to top and bottom heat (`oven.mode_info` note and the oven step in both languages).

## After a test: updating recipes.json

1. Change the `value` or `range` of the item you tested.
2. Write in its `note` what you baked, when, and what you saw (for example: "Test bake 2026-12-01: doubled in 55 min at 27 C"). Keep the source list.
3. Raise `confidence` if the result was clear. `verified` stays `false` unless you checked the value against a primary source; a home test is noted as home-tested in the note, as for the cast-iron advice.
4. If the value appears in text, the text changes by itself (the pages read numbers from `recipes.json`). Check both the English and the Farsi page.
5. Update the hand-computed expectations in `test/calc.test.js` if a yeast percentage changed, then run `make ci`.
6. Update "Known unverified items" in `CLAUDE.md`.
