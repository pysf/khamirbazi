import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeRecipe, roundArea, formatNumber, yeastCard, householdMeasure } from "../src/assets/calc.js";
import { formatMeasure } from "../src/assets/i18n.js";

const data = JSON.parse(readFileSync(new URL("../src/_data/recipes.json", import.meta.url)));

const near = (actual, expected, tol = 0.01, msg = "") =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} expected ${expected}, got ${actual}`);
const g = (r, id) => r.ingredients.find((i) => i.id === id)?.g;

const two = { pizzas: 2 };

// Expected values were computed by hand (dough mass / (1 + sum of percentages), then each percentage),
// see comments for the dough mass and the divisor.
// [style, method, mode, flour, water to add, solution to take (or null), direct dry yeast (or null), salt, sugar, oil]
const cases = [
  // New York: 2 x 250 g = 500 g, divisor 1.7 (warm: with yeast 0.6667%) or 1.6933 (solution)
  ["new_york", "warm_2h", two, 294.12, 185.3, null, 1.961, 6.853, 2.941, 8.824],
  ["new_york", "cold_24h", two, 295.28, 126.97, 59.06, null, 6.88, 2.953, 8.858],
  ["new_york", "cold_48h", two, 295.28, 141.74, 44.29, null, 6.88, 2.953, 8.858],
  ["new_york", "room_8_12h", two, 295.28, 156.5, 29.53, null, 6.88, 2.953, 8.858],
  // Neapolitan: 500 g, hydration 61.7, salt 2.67, sugar 0.7, no oil
  ["neapolitan", "warm_2h", two, 301.68, 186.14, null, 2.011, 8.055, 2.112, null],
  ["neapolitan", "cold_24h", two, 302.9, 126.31, 60.58, null, 8.087, 2.12, null],
];

for (const [style, method, mode, flour, water, take, yeast, salt, sugar, oil] of cases) {
  test(`${style} ${method}: ingredient amounts`, () => {
    const r = computeRecipe({ styleId: style, methodId: method, mode }, data);
    near(r.flour_total_g, flour, 0.01, "flour");
    near(r.water.add_g, water, 0.01, "water to add");
    near(r.water.total_g, water + (take ?? 0), 0.01, "total water");
    if (take != null) {
      assert.equal(r.yeast.mode, "solution");
      near(r.yeast.solution.take_g, take, 0.01, "solution");
      near(g(r, "yeast_solution"), take, 0.01);
    } else {
      assert.equal(r.yeast.mode, "direct");
      near(r.yeast.weigh_g, yeast, 0.001, "direct yeast");
    }
    near(g(r, "salt"), salt, 0.001, "salt");
    if (sugar != null) near(g(r, "sugar"), sugar, 0.001, "sugar");
    else assert.equal(g(r, "sugar"), undefined);
    if (oil != null) near(g(r, "oil"), oil, 0.001, "oil");
    else assert.equal(g(r, "oil"), undefined);
    // the parts add up to the dough
    const parts = r.ingredients.reduce((s, i) => s + (i.id === "flour" ? i.g : 0), 0);
    near(parts, r.flour_total_g, 1e-9);
    const total = r.ingredients.reduce((s, i) => s + i.g, 0);
    // dough = all ingredients (direct yeast is included in the dough mass)
    near(total, r.dough_g, 1e-6, "ingredients add up to dough");
  });
}

test("yeast percentages per method (instant dry, % of flour)", () => {
  const expected = { warm_2h: 2 / 300 * 100, room_8_12h: 0.1, cold_12_16h: 0.3, cold_24h: 0.2, cold_48h: 0.15, cold_72h: 0.1 };
  for (const [id, pct] of Object.entries(expected)) {
    near(data.methods[id].yeast_pct_dry.value, pct, 1e-9, id);
    assert.equal(data.methods[id].yeast_pct_dry.confidence, "low");
    assert.equal(data.methods[id].yeast_pct_dry.verified, false);
  }
  assert.equal(data.yeast.fresh_to_dry.value, 3);
});

test("yeast solution: dry = 7 g in 700 g (1%), fresh = 21 g in 700 g (3%), same solution mass", () => {
  const dry = computeRecipe({ styleId: "new_york", methodId: "cold_24h", yeastType: "dry", mode: two }, data);
  const fresh = computeRecipe({ styleId: "new_york", methodId: "cold_24h", yeastType: "fresh", mode: two }, data);
  assert.deepEqual(
    [dry.yeast.solution.yeast_g, dry.yeast.solution.water_g, dry.yeast.solution.concentration_pct, dry.yeast.solution.packet],
    [7, 700, 1, "whole_7g_packet"],
  );
  assert.deepEqual(
    [fresh.yeast.solution.yeast_g, fresh.yeast.solution.water_g, fresh.yeast.solution.concentration_pct, fresh.yeast.solution.packet],
    [21, 700, 3, "half_42g_cube"],
  );
  // 295.28 g flour x 0.2% = 0.5906 g dry = 59.06 g of 1% solution; fresh 1.7717 g = 59.06 g of 3% solution
  near(dry.yeast.solution.take_g, 59.06, 0.01);
  near(fresh.yeast.solution.take_g, dry.yeast.solution.take_g, 1e-9);
  near(fresh.yeast.amount_g, 3 * dry.yeast.amount_g, 1e-9);
  // the solution mass replaces recipe water
  near(dry.water.add_g + dry.yeast.solution.take_g, dry.water.total_g, 1e-9);
  assert.equal(dry.yeast.solution.use_immediately, true);
});

test("solution threshold: under 1.5 g dry-equivalent uses solution, otherwise weigh directly", () => {
  const run = (pizzas, yeastType = "dry") =>
    computeRecipe({ styleId: "new_york", methodId: "cold_12_16h", yeastType, mode: { pizzas } }, data);
  // 3 pizzas: flour 750 / 1.6933 = 442.92 g x 0.3% = 1.329 g dry-eq -> solution (132.88 g)
  const a = run(3);
  assert.equal(a.yeast.mode, "solution");
  near(a.yeast.dry_equivalent_g, 1.329, 0.001);
  near(a.yeast.solution.take_g, 132.88, 0.01);
  assert.ok(a.yeast.dry_equivalent_g < 1.5);
  // 4 pizzas: flour 1000 / 1.6963 = 589.52 g x 0.3% = 1.769 g -> direct
  const b = run(4);
  assert.equal(b.yeast.mode, "direct");
  near(b.yeast.weigh_g, 1.769, 0.001);
  // fresh yeast direct is three times the dry amount; 1000 / (1.6933 + 0.009) = 587.44 g
  const c = run(4, "fresh");
  assert.equal(c.yeast.mode, "direct");
  near(c.flour_total_g, 587.44, 0.01);
  near(c.yeast.weigh_g, 5.287, 0.001);
  near(g(c, "yeast_fresh"), 5.287, 0.001);
});

test("when the solution would exceed the recipe water, weigh the yeast and warn", () => {
  const r = computeRecipe({ styleId: "new_york", methodId: "warm_2h", mode: { pizzas: 2, ballWeight: 150 } }, data);
  // a small batch: the solution would be more than all the recipe water
  assert.equal(r.yeast.mode, "direct");
  assert.ok(r.warnings.some((w) => w.id === "solution_exceeds_water"));
  assert.ok(r.water.add_g > 0);
});

test("never instruct weighing under 1 g (all styles, methods, yeast types, sizes)", () => {
  const modesFor = () => [{ pizzas: 1 }, { pizzas: 2 }, { pizzas: 6 }, { pizzas: 1, ballWeight: 100 }, { pizzas: 2, size: { shape: "round", diameter: 26 } }];
  for (const styleId of Object.keys(data.styles)) {
    for (const methodId of Object.keys(data.methods)) {
      for (const yeastType of ["dry", "fresh"]) {
        for (const mode of modesFor()) {
          const r = computeRecipe({ styleId, methodId, yeastType, mode }, data);
          const label = `${styleId} ${methodId} ${yeastType}`;
          for (const i of r.ingredients) {
            if (i.id.startsWith("yeast")) assert.ok(i.g >= 1, `${label}: ${i.id} ${i.g} g`);
          }
          if (r.yeast.mode === "direct") assert.ok(r.yeast.weigh_g >= 1, label);
          if (r.yeast.mode === "unavailable") {
            assert.equal(r.yeast.weigh_g, null, label);
            assert.ok(r.warnings.some((w) => w.id === "batch_too_small" || w.id === "min_batch"), label);
            assert.equal(r.ingredients.some((i) => i.id.startsWith("yeast")), false, label);
          }
          if (r.yeast.mode === "solution") assert.ok(r.yeast.solution.take_g >= 1, label);
          // the water to add is never negative
          assert.ok(r.water.add_g > 0, label);
        }
      }
    }
  }
});

test("a batch too small for any yeast amount is reported as batch_too_small (not min_batch)", () => {
  const r = computeRecipe({ styleId: "new_york", methodId: "warm_2h", mode: { pizzas: 2, ballWeight: 60 } }, data);
  assert.equal(r.yeast.mode, "unavailable");
  assert.ok(r.warnings.some((w) => w.id === "batch_too_small"));
  assert.equal(r.warnings.some((w) => w.id === "min_batch"), false);
});

test("the warm method needs at least min_pizzas pizzas: min_batch warning, no yeast amount", () => {
  assert.equal(data.methods.warm_2h.min_pizzas, 2);
  for (const styleId of ["new_york", "neapolitan"]) {
    for (const yeastType of ["dry", "fresh"]) {
      for (const mode of [{ pizzas: 1 }, { pizzas: 1.5 }, { pizzas: 1, ballWeight: 400 }]) {
        const r = computeRecipe({ styleId, methodId: "warm_2h", yeastType, mode }, data);
        const w = r.warnings.find((x) => x.id === "min_batch");
        assert.ok(w, `${styleId} ${yeastType} ${JSON.stringify(mode)}`);
        assert.deepEqual([w.params.min_pizzas, w.params.pizzas, w.params.min_g], [2, mode.pizzas, 1]);
        assert.equal(r.yeast.mode, "unavailable");
        assert.equal(r.yeast.weigh_g, null);
        assert.equal(r.warnings.some((x) => x.id === "batch_too_small" || x.id === "solution_exceeds_water"), false);
        assert.equal(r.ingredients.some((i) => i.id.startsWith("yeast")), false);
      }
    }
  }
});

test("round styles: pizzas x ball weight; ball weight defaults come from the data", () => {
  assert.equal(data.styles.new_york.ball_g.value, 250);
  assert.equal(data.styles.neapolitan.ball_g.value, 250);
  const r = computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: { pizzas: 4, ballWeight: 220 } }, data);
  near(r.dough_g, 880, 1e-9);
  near(r.flour_total_g, 880 / 1.6933, 1e-6);
});

test("oven settings and bake times per style", () => {
  const get = (style, mode) => computeRecipe({ styleId: style, methodId: "cold_24h", mode }, data);
  const ny = get("new_york", two);
  assert.equal(ny.oven.temp_c, 250);
  assert.equal(ny.oven.mode, "top_bottom");
  assert.equal(ny.oven.fan, false);
  assert.equal(ny.oven.rack, "upper_third");
  assert.deepEqual(ny.bake.time_min, [7, 9]);
  assert.deepEqual(ny.oven.grill.last_min, [1, 2]);
  const ne = get("neapolitan", two);
  assert.deepEqual(ne.bake.time_min, [5, 7]);
  assert.deepEqual(ne.oven.grill.last_min, [1, 2]);
  assert.equal(ne.oven.grill.max_min, 5);
});

test("safety warnings: parchment rating, grill, olive oil smoke", () => {
  const ny = computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: two }, data);
  const ids = ny.warnings.map((w) => w.id);
  assert.ok(ids.includes("parchment"));
  assert.ok(ids.includes("parchment_grill"));
  assert.ok(ids.includes("oil_smoke"));
  assert.equal(ny.warnings.find((w) => w.id === "parchment").params.max_c, 220);
  assert.equal(ny.warnings.find((w) => w.id === "oil_smoke").severity, "safety");
  const nea = computeRecipe({ styleId: "neapolitan", methodId: "cold_24h", mode: two }, data);
  assert.ok(nea.warnings.some((w) => w.id === "no_oil_no_sugar"));
});

test("invalid input throws RangeError", () => {
  const ok = { styleId: "new_york", methodId: "cold_24h", mode: two };
  assert.throws(() => computeRecipe({ ...ok, styleId: "nope" }, data), RangeError);
  assert.throws(() => computeRecipe({ ...ok, methodId: "nope" }, data), RangeError);
  assert.throws(() => computeRecipe({ ...ok, yeastType: "wet" }, data), RangeError);
  assert.throws(() => computeRecipe({ ...ok, mode: { pizzas: 0 } }, data), RangeError);
  assert.throws(() => computeRecipe({ ...ok, mode: { pizzas: 2, ballWeight: -5 } }, data), RangeError);
  assert.throws(() => computeRecipe({ ...ok, mode: {} }, data), RangeError);
  assert.throws(() => computeRecipe({ ...ok, mode: { pizzas: 2, size: { shape: "rect", length: 30, width: 40 } } }, data), RangeError);
});

test("results are exact: no rounding to friendly numbers", () => {
  const r = computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: two }, data);
  assert.notEqual(r.flour_total_g, Math.round(r.flour_total_g));
  assert.notEqual(r.yeast.solution.take_g, Math.round(r.yeast.solution.take_g));
});

test("formatNumber: at most 1 decimal, Persian digits and ٫ in Farsi", () => {
  assert.equal(formatNumber(12.345), "12.3");
  assert.equal(formatNumber(1.96), "2");
  assert.equal(formatNumber(59.06), "59.1");
  assert.equal(formatNumber(1234.56), "1,234.6");
  assert.equal(formatNumber(0.04), "0");
  assert.equal(formatNumber(null), "");
  assert.equal(formatNumber(12.5, "fa"), "۱۲٫۵");
  assert.equal(formatNumber(2, "fa"), "۲");
  assert.equal(formatNumber(296.74, "fa"), "۲۹۶٫۷");
  assert.equal(formatNumber(0.04, "fa"), "۰");
});

test("data: every value object has confidence, verified and sources or a note", () => {
  const seen = [];
  (function walk(o, path) {
    if (Array.isArray(o)) return o.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (!o || typeof o !== "object") return;
    if ("value" in o || "range" in o) {
      seen.push(path);
      assert.ok(["high", "medium", "low"].includes(o.confidence), `${path} confidence`);
      assert.equal(typeof o.verified, "boolean", `${path} verified`);
      assert.ok(Array.isArray(o.sources), `${path} sources`);
      assert.ok(o.sources.every((u) => /^https:\/\//.test(u)), `${path} source URLs`);
      if (o.sources.length === 0) assert.ok(o.note, `${path} needs a note when it has no source`);
      if (o.verified === false && o.confidence === "high") assert.ok(o.sources.length > 0 || o.note, path);
      if (path.includes("yeast_pct_dry")) assert.ok(/5x/.test(o.note), `${path} mentions the 5x spread`);
    }
    for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
  })(data, "recipes");
  assert.ok(seen.length > 100, "found value objects");
  assert.deepEqual(Object.keys(data.styles), ["new_york", "neapolitan"]);
});

// ---- By size (round diameter) ----------------------------------------------------------
const round = (d) => ({ shape: "round", diameter: d });

test("size mode: dough = pizzas x area x density; the density is derived from 250 g at 30 cm", () => {
  assert.equal(data.styles.new_york.dough_density_g_per_cm2.verified, false);
  near(data.styles.new_york.dough_density_g_per_cm2.value * Math.PI * 15 * 15, 250, 1e-6, "250 g at 30 cm");
  const r30 = computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: { pizzas: 2, size: round(30) } }, data);
  near(r30.dough_g, 500, 1e-5);
  near(r30.ball_g, 250, 1e-6);
  near(r30.flour_total_g, 295.28, 0.01);
  near(r30.water.add_g, 126.97, 0.01);
  near(r30.yeast.solution.take_g, 59.06, 0.01);
  // same as the ball-weight mode for 2 x 250 g
  const ball = computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: { pizzas: 2, ballWeight: 250 } }, data);
  near(r30.flour_total_g, ball.flour_total_g, 1e-4);
});

test("size mode: 26 cm and 32 cm scale with area (hand-computed)", () => {
  const d = data.styles.new_york.dough_density_g_per_cm2.value;
  const dough = (size, n = 2) => computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: { pizzas: n, size } }, data).dough_g;
  near(dough(round(26)), 2 * Math.PI * 169 * d, 1e-9); // about 375.6 g
  near(dough(round(26)), 375.6, 0.1);
  near(dough(round(32)), 568.9, 0.1);
});

test("size mode: Neapolitan works, 2-pizza minimum for the warm method still applies, styles without a density throw", () => {
  const nea = computeRecipe({ styleId: "neapolitan", methodId: "cold_24h", mode: { pizzas: 2, size: round(30) } }, data);
  near(nea.dough_g, 500, 1e-5);
  const one = computeRecipe({ styleId: "new_york", methodId: "warm_2h", mode: { pizzas: 1, size: round(30) } }, data);
  assert.equal(one.yeast.mode, "unavailable");
  assert.ok(one.warnings.some((w) => w.id === "min_batch"));
  const okTwo = computeRecipe({ styleId: "new_york", methodId: "warm_2h", mode: { pizzas: 2, size: round(30) } }, data);
  assert.equal(okTwo.yeast.mode, "direct");
  const noDensity = structuredClone(data);
  delete noDensity.styles.neapolitan.dough_density_g_per_cm2;
  assert.throws(() => computeRecipe({ styleId: "neapolitan", methodId: "cold_24h", mode: { pizzas: 2, size: round(30) } }, noDensity), RangeError);
  assert.throws(() => computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: { pizzas: 2, size: round(0) } }, data), RangeError);
});

test("the sizes list in recipes.json is the three round sizes of the site", () => {
  assert.deepEqual(data.sizes.map((s) => s.id), ["round_26", "round_30", "round_32"]);
  assert.ok(data.sizes.every((s) => s.shape === "round"));
  near(roundArea(data.sizes[1]), Math.PI * 225, 1e-9);
});

test("roundArea: round sizes only", () => {
  near(roundArea({ shape: "round", diameter: 20 }), 314.159, 0.001);
  for (const bad of [null, {}, { shape: "round" }, { shape: "round", diameter: 0 }, { shape: "rect", length: 5, width: 5 }]) {
    assert.throws(() => roundArea(bad), RangeError);
  }
});

test("dough only: no sauce, cheese or topping data or output", () => {
  assert.equal(data.sauce_recipe, undefined);
  for (const [id, st] of Object.entries(data.styles)) {
    assert.equal(st.toppings, undefined, id);
    assert.equal(st.layer_order, undefined, id);
  }
  const r = computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: two }, data);
  for (const k of ["sauce", "cheese", "toppings"]) assert.equal(r[k], undefined, k);
});

// ---- Ingredients card: yeast warnings and the 1 g scale note (yeastCard) ---------------------------------
const card = (styleId, methodId, pizzas, d = 30, yeastType = "dry") =>
  yeastCard(computeRecipe({ styleId, methodId, yeastType, mode: { pizzas, size: round(d) } }, data), data);

test("yeastCard: a yeast solution or a whole-gram amount needs no extra line", () => {
  assert.deepEqual(card("new_york", "cold_24h", 2), []);
  assert.deepEqual(card("new_york", "cold_24h", 2, 30, "fresh"), []);
  assert.deepEqual(card("new_york", "warm_2h", 2), []);
  // big cold batches weigh the yeast directly, with no solution row
  const r = computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: { pizzas: 6, size: round(30) } }, data);
  assert.equal(r.ingredients.some((i) => i.id === "yeast_solution"), false);
  near(g(r, "yeast_dry"), 1.77, 0.01);
});

test("yeastCard: warm method, 2 x 26 cm: 1.47 g lies between two scale readings", () => {
  const lines = card("new_york", "warm_2h", 2, 26);
  assert.deepEqual(lines.map((l) => l.key), ["scale_resolution"]);
  assert.deepEqual([lines[0].params.lo, lines[0].params.hi], [1, 2]);
});

test("yeastCard: no amount gives the warning instead of a yeast amount", () => {
  assert.deepEqual(card("new_york", "warm_2h", 1).map((l) => [l.group, l.key]), [["warn", "min_batch"]]);
  assert.deepEqual(card("neapolitan", "warm_2h", 1, 30, "fresh").map((l) => [l.group, l.key]), [["warn", "min_batch"]]);
  const tiny = yeastCard(computeRecipe({ styleId: "new_york", methodId: "warm_2h", mode: { pizzas: 2, ballWeight: 60 } }, data), data);
  assert.deepEqual(tiny.map((l) => [l.group, l.key]), [["warn", "batch_too_small"]]);
});

test("yeastCard: warnings exactly when there is no yeast amount; every line has a UI string", () => {
  const strings = ["en", "fa"].map((l) => JSON.parse(readFileSync(new URL(`../src/_data/i18n/${l}.json`, import.meta.url))));
  for (const styleId of Object.keys(data.styles))
    for (const methodId of Object.keys(data.methods))
      for (const yeastType of ["dry", "fresh"])
        for (const d of [26, 30, 32])
          for (const pizzas of [1, 2, 3, 5, 6, 10]) {
            const r = computeRecipe({ styleId, methodId, yeastType, mode: { pizzas, size: round(d) } }, data);
            const lines = yeastCard(r, data);
            const label = `${styleId} ${methodId} ${yeastType} ${d} cm x ${pizzas}`;
            assert.equal(lines.some((l) => l.group === "warn"), r.yeast.mode === "unavailable", label);
            const hasYeastRow = r.ingredients.some((i) => i.id === "yeast_solution" || i.id === `yeast_${yeastType}`);
            assert.equal(hasYeastRow, r.yeast.mode !== "unavailable", label);
            for (const t of strings) for (const l of lines) assert.ok(t[l.group][l.key], `${label}: ${l.group}.${l.key}`);
          }
});

// ---- Household measures (the approximate "About" column) ------------------------------------------------
const hm = (id, grams) => householdMeasure(id, grams, data);

test("householdMeasure: data basis is 5 ml teaspoon, 15 ml tablespoon, 1/4 spoon steps", () => {
  const m = data.measures;
  assert.deepEqual([m.tsp_ml.value, m.tbsp_ml.value, m.spoon_step.value, m.spoon_min.value], [5, 15, 0.25, 0.25]);
  assert.deepEqual([m.cube_step.value, m.cube_min.value], [0.125, 0.25]);
  const i = m.ingredients;
  assert.deepEqual([i.salt.g_per_tsp.value, i.sugar.g_per_tsp.value, i.yeast_dry.g_per_tsp.value], [6, 4.2, 3.1]);
  assert.deepEqual([i.oil.g_per_tsp.value, i.oil.g_per_tbsp.value], [4.6, 13.7]);
  assert.deepEqual([i.water.g_per_ml.value, i.yeast_solution.g_per_ml.value], [1, 1]);
});

test("householdMeasure: no measure for flour, unknown ids and empty amounts", () => {
  assert.equal(hm("flour", 300), null);
  assert.equal(hm("cheese", 10), null);
  assert.equal(hm("salt", 0), null);
  assert.equal(hm("salt", NaN), null);
});

test("householdMeasure: water and yeast solution in whole ml (1 g = 1 ml)", () => {
  assert.deepEqual(hm("water", 126.97), { unit: "ml", amount: 127 });
  assert.deepEqual(hm("yeast_solution", 59.06), { unit: "ml", amount: 59 });
  assert.deepEqual(hm("water", 0.6), { unit: "ml", amount: 1 });
  assert.equal(hm("water", 0.4), null);
});

test("householdMeasure: teaspoons rounded to the nearest 1/4 (hand-computed)", () => {
  assert.deepEqual(hm("salt", 6.88), { unit: "tsp", amount: 1.25 }); // 1.147 tsp: 4.59 quarters -> 5
  assert.deepEqual(hm("salt", 8.087), { unit: "tsp", amount: 1.25 }); // 1.348
  assert.deepEqual(hm("salt", 15), { unit: "tsp", amount: 2.5 }); // 2.5 exactly
  assert.deepEqual(hm("salt", 69), { unit: "tsp", amount: 11.5 }); // salt stays in teaspoons
  assert.deepEqual(hm("sugar", 2.953), { unit: "tsp", amount: 0.75 }); // 0.703
  assert.deepEqual(hm("sugar", 2.12), { unit: "tsp", amount: 0.5 }); // 0.505
  assert.deepEqual(hm("yeast_dry", 1.961), { unit: "tsp", amount: 0.75 }); // 0.633
  assert.deepEqual(hm("yeast_dry", 1), { unit: "tsp", amount: 0.25 }); // 0.323
});

test("householdMeasure: under 1/4 teaspoon there is no spoon amount", () => {
  assert.equal(hm("yeast_dry", 0.77), null); // 0.248 tsp
  assert.deepEqual(hm("yeast_dry", 0.78), { unit: "tsp", amount: 0.25 }); // 0.252
  assert.equal(hm("salt", 1.4), null); // 0.233
  assert.equal(hm("sugar", 1), null); // 0.238
});

test("householdMeasure: oil in teaspoons below 1 tablespoon, tablespoons from 1 tablespoon up", () => {
  assert.deepEqual(hm("oil", 8.858), { unit: "tsp", amount: 2 }); // 1.926 tsp
  assert.deepEqual(hm("oil", 13.6), { unit: "tsp", amount: 3 }); // 2.957 tsp, still under 13.7 g
  assert.deepEqual(hm("oil", 13.7), { unit: "tbsp", amount: 1 });
  assert.deepEqual(hm("oil", 17.716), { unit: "tbsp", amount: 1.25 }); // 1.293
  assert.deepEqual(hm("oil", 0.9), null); // 0.196 tsp
});

test("householdMeasure: fresh yeast as a fraction of the 42 g cube, nearest 1/8, at least 1/4", () => {
  assert.equal(data.yeast.solution.fresh.cube_g.value, 42);
  assert.deepEqual(hm("yeast_fresh", 11.765), { unit: "cube", amount: 0.25 }); // 0.280
  assert.deepEqual(hm("yeast_fresh", 21), { unit: "cube", amount: 0.5 });
  assert.deepEqual(hm("yeast_fresh", 15.5), { unit: "cube", amount: 0.375 }); // 0.369
  assert.deepEqual(hm("yeast_fresh", 58.8), { unit: "cube", amount: 1.375 }); // 1.4
  assert.equal(hm("yeast_fresh", 10.4), null); // 0.248 cube
  assert.equal(hm("yeast_fresh", 5.9), null);
});

const i18n = Object.fromEntries(["en", "fa"].map((l) => [l, JSON.parse(readFileSync(new URL(`../src/_data/i18n/${l}.json`, import.meta.url)))]));

test("formatMeasure: fractions and units in English and Farsi (no Latin letters in Farsi)", () => {
  const en = (m) => formatMeasure(m, i18n.en.measure, "en");
  const fa = (m) => formatMeasure(m, i18n.fa.measure, "fa");
  assert.equal(en(null), "");
  assert.equal(en({ unit: "tsp", amount: 1.25 }), "≈ 1 ¼ tsp");
  assert.equal(en({ unit: "tsp", amount: 0.75 }), "≈ ¾ tsp");
  assert.equal(en({ unit: "tbsp", amount: 2 }), "≈ 2 tbsp");
  assert.equal(en({ unit: "ml", amount: 1270 }), "≈ 1,270 ml");
  assert.equal(en({ unit: "cube", amount: 0.5 }), "≈ ½ cube");
  assert.equal(en({ unit: "cube", amount: 1.375 }), "≈ 1 ⅜ cubes");
  assert.equal(fa({ unit: "tsp", amount: 1.25 }), "≈ ۱ و یک‌چهارم قاشق چای‌خوری");
  assert.equal(fa({ unit: "tsp", amount: 0.5 }), "≈ نیم قاشق چای‌خوری");
  assert.equal(fa({ unit: "ml", amount: 127 }), "≈ ۱۲۷ میلی‌لیتر");
  assert.equal(fa({ unit: "cube", amount: 0.25 }), "≈ یک‌چهارم قالب");
});

test("householdMeasure: every ingredient row of every style, method, yeast, size and count gives null or a valid measure with text in both languages", () => {
  const steps = { ml: 1, tsp: 0.25, tbsp: 0.25, cube: 0.125 };
  const counts = {};
  for (const styleId of Object.keys(data.styles))
    for (const methodId of Object.keys(data.methods))
      for (const yeastType of ["dry", "fresh"])
        for (const d of [26, 30, 32])
          for (const pizzas of [1, 2, 3, 4, 5, 6, 10, 20]) {
            const r = computeRecipe({ styleId, methodId, yeastType, mode: { pizzas, size: round(d) } }, data);
            for (const i of r.ingredients) {
              const label = `${styleId} ${methodId} ${yeastType} ${d} cm x ${pizzas}: ${i.id}`;
              const m = hm(i.id, i.g);
              if (i.id === "flour") assert.equal(m, null, label);
              if (m == null) continue;
              assert.ok(i.id in data.measures.ingredients, label);
              assert.ok(steps[m.unit], label);
              assert.ok(m.amount > 0 && Number.isInteger(m.amount / steps[m.unit]), `${label} ${m.amount}`);
              if (m.unit === "tsp" || m.unit === "tbsp") assert.ok(m.amount >= 0.25, label);
              if (m.unit === "cube") assert.ok(m.amount >= 0.25, label);
              counts[m.unit] = (counts[m.unit] ?? 0) + 1;
              for (const lang of ["en", "fa"]) {
                const text = formatMeasure(m, i18n[lang].measure, lang);
                assert.ok(text.startsWith("≈ ") && !/[{}]|undefined/.test(text), `${label} ${lang}: ${text}`);
                if (lang === "fa") assert.ok(!/[A-Za-z0-9]/.test(text), `${label} fa: ${text}`);
              }
            }
          }
  for (const u of Object.keys(steps)) assert.ok(counts[u] > 0, `some rows use ${u}`);
});
