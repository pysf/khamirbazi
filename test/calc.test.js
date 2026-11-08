import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeRecipe, panArea, formatNumber } from "../src/assets/calc.js";

const data = JSON.parse(readFileSync(new URL("../src/_data/recipes.json", import.meta.url)));

const near = (actual, expected, tol = 0.01, msg = "") =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} expected ${expected}, got ${actual}`);
const g = (r, id) => r.ingredients.find((i) => i.id === id)?.g;

const two = { pizzas: 2 };
const rect = (n, length, width) => ({ pans: Array.from({ length: n }, () => ({ shape: "rect", length, width })) });
const round20x2 = { pans: [{ shape: "round", diameter: 20 }, { shape: "round", diameter: 20 }] };

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
  // Roman tonda: 2 x 170 g = 340 g, 58.3 / 2 / 3.5 (warm falls back to weighing, see below)
  ["roman_tonda", "warm_2h", two, 206.73, 120.52, null, 1.378, 4.135, null, 7.236],
  ["roman_tonda", "cold_24h", two, 207.57, 79.5, 41.51, null, 4.151, null, 7.265],
  ["roman_tonda", "cold_48h", two, 207.57, 89.88, 31.14, null, 4.151, null, 7.265],
  // Al taglio 30x40: 1200 cm2 x 0.63 = 756 g, 80 / 2.3 / 4
  ["al_taglio", "cold_24h", rect(1, 30, 40), 405.8, 243.48, 81.16, null, 9.333, null, 16.232],
  ["al_taglio", "cold_48h", rect(1, 30, 40), 405.8, 263.77, 60.87, null, 9.333, null, 16.232],
  // Detroit 2 x 20x25: 1000 cm2 x 0.65 = 650 g, 72 / 2.33 / 1 / 3
  ["detroit", "warm_2h", rect(2, 20, 25), 363.14, 261.46, null, 2.421, 8.461, 3.631, 10.894],
  ["detroit", "cold_24h", rect(2, 20, 25), 364.49, 189.54, 72.9, null, 8.493, 3.645, 10.935],
  // Chicago 2 x 20 cm: 628.32 g, 55 / 2 / 1 / 15, cornmeal 10% of total flour
  ["chicago", "warm_2h", round20x2, 361.8, 198.99, null, 2.412, 7.236, 3.618, 54.269],
  ["chicago", "cold_24h", round20x2, 363.19, 127.12, 72.64, null, 7.264, 3.632, 54.478],
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
    if (oil != null) near(g(r, r.style_id === "chicago" ? "fat" : "oil"), oil, 0.001, "oil");
    else assert.equal(g(r, "oil"), undefined);
    // the parts add up to the dough
    const parts = r.ingredients.reduce((s, i) => s + (i.id === "flour" || i.id === "cornmeal" ? i.g : 0), 0);
    near(parts, r.flour_total_g, 1e-9);
    const total = r.ingredients.reduce((s, i) => s + i.g, 0);
    // dough = all ingredients (direct yeast is included in the dough mass)
    near(total, r.dough_g, 1e-6, "ingredients add up to dough");
  });
}

test("Chicago splits total flour into wheat flour and cornmeal (10%)", () => {
  const r = computeRecipe({ styleId: "chicago", methodId: "warm_2h", mode: round20x2 }, data);
  near(g(r, "cornmeal"), 36.18, 0.005);
  near(g(r, "flour"), 325.62, 0.005);
  near(g(r, "cornmeal") / r.flour_total_g, 0.1, 1e-12);
  near(r.water.total_g / r.flour_total_g, 0.55, 1e-12, "hydration counts cornmeal");
});

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
  const r = computeRecipe({ styleId: "roman_tonda", methodId: "warm_2h", mode: two }, data);
  // 1.378 g dry-eq would need 137.8 g of solution but the recipe has only 120.52 g water
  assert.equal(r.yeast.mode, "direct");
  assert.ok(r.warnings.some((w) => w.id === "solution_exceeds_water"));
  assert.ok(r.water.add_g > 0);
});

test("never instruct weighing under 1 g (all styles, methods, yeast types, sizes)", () => {
  const modesFor = (style) =>
    data.styles[style].kind === "pan"
      ? [rect(1, 10, 10), rect(1, 23, 33), rect(2, 20, 25)].map((m) =>
          style === "chicago" ? { pans: [{ shape: "round", diameter: 18 }] } : m,
        )
      : [{ pizzas: 1 }, { pizzas: 2 }, { pizzas: 6 }, { pizzas: 1, ballWeight: 100 }];
  for (const styleId of Object.keys(data.styles)) {
    for (const methodId of Object.keys(data.methods)) {
      for (const yeastType of ["dry", "fresh"]) {
        for (const mode of modesFor(styleId)) {
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

test("the warm method needs at least min_pizzas pizzas: min_batch warning, no yeast amount", () => {
  assert.equal(data.methods.warm_2h.min_pizzas, 2);
  for (const styleId of ["new_york", "neapolitan", "roman_tonda"]) {
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

test("exactly min_pizzas pizzas is allowed; cold methods work for one pizza", () => {
  const two = computeRecipe({ styleId: "new_york", methodId: "warm_2h", mode: { pizzas: 2 } }, data);
  assert.equal(two.yeast.mode, "direct");
  assert.equal(two.warnings.some((x) => x.id === "min_batch"), false);
  for (const methodId of ["cold_12_16h", "cold_24h", "cold_48h", "cold_72h", "room_8_12h"]) {
    const r = computeRecipe({ styleId: "new_york", methodId, mode: { pizzas: 1 } }, data);
    assert.equal(r.yeast.mode, "solution", methodId);
    assert.equal(r.warnings.some((x) => x.id === "min_batch"), false, methodId);
  }
});

test("a pan dough too small for any yeast amount is still reported as batch_too_small", () => {
  const r = computeRecipe({ styleId: "chicago", methodId: "warm_2h", mode: rect(1, 10, 10) }, data);
  assert.equal(r.yeast.mode, "unavailable");
  assert.ok(r.warnings.some((w) => w.id === "batch_too_small"));
  assert.equal(r.warnings.some((w) => w.id === "min_batch"), false);
});

test("panArea: round and rectangle", () => {
  near(panArea({ shape: "round", diameter: 20 }), Math.PI * 100, 1e-9);
  near(panArea({ shape: "round", diameter: 20 }), 314.159, 0.001);
  assert.equal(panArea({ shape: "rect", length: 20, width: 25 }), 500);
  assert.equal(panArea({ shape: "rect", length: 45, width: 37.5 }), 1687.5);
  for (const bad of [null, {}, { shape: "round" }, { shape: "round", diameter: 0 }, { shape: "rect", length: 5 }, { shape: "rect", length: -1, width: 3 }]) {
    assert.throws(() => panArea(bad), RangeError);
  }
});

test("pan styles scale with pan area x density", () => {
  // al taglio: 756 g for 1200 cm2; thick option 0.95 g/cm2
  const t = computeRecipe({ styleId: "al_taglio", methodId: "cold_24h", mode: rect(1, 30, 40) }, data);
  near(t.dough_g, 756, 1e-9);
  near(t.density_g_per_cm2, 0.63, 1e-12);
  const thick = computeRecipe({ styleId: "al_taglio", methodId: "cold_24h", mode: rect(1, 30, 40), thick: true }, data);
  near(thick.dough_g, 1140, 1e-9);
  // pan oil: 22.5 g per 875 cm2 -> 1200 cm2 = 30.857 g
  near(t.pan_oil_g, 22.5 * 1200 / 875, 1e-9);
  near(t.pan_oil_g, 30.857, 0.001);
  // Detroit: two 20x25 pans = 1000 cm2 x 0.65 = 650 g; one pan is half; oil 14 g per 800 cm2
  // (cold method: both sizes use the solution, so everything is exactly proportional)
  const d2 = computeRecipe({ styleId: "detroit", methodId: "cold_24h", mode: rect(2, 20, 25) }, data);
  const d1 = computeRecipe({ styleId: "detroit", methodId: "cold_24h", mode: rect(1, 20, 25) }, data);
  near(d2.dough_g, 650, 1e-9);
  near(d1.dough_g, 325, 1e-9);
  near(d2.flour_total_g, 2 * d1.flour_total_g, 1e-9);
  near(d2.water.total_g, 2 * d1.water.total_g, 1e-9);
  near(d2.pan_oil_g, 17.5, 1e-9);
  near(d1.pan_oil_g, 8.75, 1e-9);
  // different pan shape with the same area gives the same dough
  const round = computeRecipe({ styleId: "detroit", methodId: "warm_2h", mode: { pans: [{ shape: "round", diameter: 2 * Math.sqrt(500 / Math.PI) }] } }, data);
  near(round.dough_g, 325, 1e-6);
  // Chicago: two 20 cm pans: 628.32 g at 1.0 g/cm2; oil 20 g per 20 cm pan
  const c = computeRecipe({ styleId: "chicago", methodId: "warm_2h", mode: round20x2 }, data);
  near(c.dough_g, 2 * Math.PI * 100, 1e-9);
  near(c.pan_oil_g, 40, 1e-9);
  // an 18 cm pan holds less
  const c18 = computeRecipe({ styleId: "chicago", methodId: "warm_2h", mode: { pans: [{ shape: "round", diameter: 18 }] } }, data);
  near(c18.dough_g, Math.PI * 81, 1e-9);
});

test("round styles: pizzas x ball weight; ball weight defaults come from the data", () => {
  assert.equal(data.styles.new_york.ball_g.value, 250);
  assert.equal(data.styles.neapolitan.ball_g.value, 250);
  assert.equal(data.styles.roman_tonda.ball_g.value, 170);
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
  assert.deepEqual(get("roman_tonda", two).bake.time_min, [5, 7]);
  assert.equal(get("roman_tonda", two).oven.grill, null);
  assert.deepEqual(get("al_taglio", rect(1, 30, 40)).bake.time_min, [15, 18]);
  const de = get("detroit", rect(2, 20, 25));
  assert.deepEqual([de.oven.temp_c, de.bake.time_min], [250, [12, 15]]);
  const ch = get("chicago", round20x2);
  assert.deepEqual([ch.oven.temp_c, ch.bake.time_min, ch.oven.rack], [220, [20, 32], "lower"]);
});

test("safety warnings: parchment rating, grill, olive oil smoke", () => {
  const ny = computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: two }, data);
  const ids = ny.warnings.map((w) => w.id);
  assert.ok(ids.includes("parchment"));
  assert.ok(ids.includes("parchment_grill"));
  assert.ok(ids.includes("oil_smoke"));
  assert.equal(ny.warnings.find((w) => w.id === "parchment").params.max_c, 220);
  assert.equal(ny.warnings.find((w) => w.id === "oil_smoke").severity, "safety");
  const roman = computeRecipe({ styleId: "roman_tonda", methodId: "cold_24h", mode: two }, data);
  assert.equal(roman.warnings.some((w) => w.id === "parchment_grill"), false);
  const det = computeRecipe({ styleId: "detroit", methodId: "cold_24h", mode: rect(1, 20, 25) }, data);
  assert.equal(det.warnings.some((w) => w.id === "parchment"), false);
  assert.ok(det.warnings.some((w) => w.id === "oil_smoke"));
  const nea = computeRecipe({ styleId: "neapolitan", methodId: "cold_24h", mode: two }, data);
  assert.ok(nea.warnings.some((w) => w.id === "no_oil_no_sugar"));
});

test("very small pans warn", () => {
  const r = computeRecipe({ styleId: "detroit", methodId: "cold_24h", mode: rect(1, 8, 8) }, data);
  assert.ok(r.warnings.some((w) => w.id === "pan_small"));
});

test("timeline: cold method sequence and offsets (minutes before baking)", () => {
  const bake = new Date("2026-03-07T19:00:00Z");
  const r = computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: two, bakeTime: bake }, data);
  const ids = r.timeline.map((s) => s.id);
  assert.deepEqual(ids, ["mix", "knead", "rest", "fridge", "take_out", "preheat", "shape", "bake"]);
  const off = Object.fromEntries(r.timeline.map((s) => [s.id, s.offset_min]));
  // take out 120 before; fridge 24 h earlier; room rest 60; knead 10; autolyse 30
  assert.deepEqual(off, { mix: -1660, knead: -1630, rest: -1620, fridge: -1560, take_out: -120, preheat: -60, shape: -15, bake: 0 });
  assert.equal(r.timeline.at(-1).at.getTime(), bake.getTime());
  assert.equal(r.timeline[0].at.getTime(), bake.getTime() - 1660 * 60000);
  for (let i = 1; i < r.timeline.length; i++) assert.ok(r.timeline[i].offset_min >= r.timeline[i - 1].offset_min);
});

test("timeline: every style x method is ordered, starts with mix and ends with bake", () => {
  const bake = new Date("2026-03-07T19:00:00Z");
  for (const styleId of Object.keys(data.styles)) {
    const mode = data.styles[styleId].kind === "pan" ? data.styles[styleId].default_mode : two;
    for (const methodId of Object.keys(data.methods)) {
      const r = computeRecipe({ styleId, methodId, mode, bakeTime: bake }, data);
      const label = `${styleId} ${methodId}`;
      assert.equal(r.timeline[0].id, "mix", label);
      assert.equal(r.timeline.at(-1).id, "bake", label);
      for (let i = 1; i < r.timeline.length; i++) {
        assert.ok(r.timeline[i].offset_min >= r.timeline[i - 1].offset_min, label);
        assert.ok(r.timeline[i].at >= r.timeline[i - 1].at, label);
      }
      const ids = r.timeline.map((s) => s.id);
      assert.ok(ids.indexOf("preheat") < ids.indexOf("bake"), label);
      assert.ok(ids.indexOf("shape") < ids.indexOf("bake"), label);
      if (methodId.startsWith("cold")) {
        assert.ok(ids.indexOf("fridge") < ids.indexOf("take_out"), label);
        assert.ok(ids.indexOf("take_out") < ids.indexOf("shape"), label);
      }
    }
  }
});

test("timeline: warm 2 h method and pan wording; without bakeTime there are offsets only", () => {
  const r = computeRecipe({ styleId: "new_york", methodId: "warm_2h", mode: two }, data);
  assert.deepEqual(r.timeline.map((s) => s.id), ["mix", "rest", "ball", "preheat", "shape", "bake"]);
  // knead 10, rise 60, rest 45, open 15 before baking: mix at -130
  assert.equal(r.timeline[0].offset_min, -130);
  assert.equal(r.timeline[0].at, null);
  const p = computeRecipe({ styleId: "detroit", methodId: "warm_2h", mode: rect(1, 20, 25) }, data);
  assert.ok(p.timeline.some((s) => s.id === "pan"));
  // Chicago uses a 30 min rest in the pan after the warm rise
  const c = computeRecipe({ styleId: "chicago", methodId: "warm_2h", mode: round20x2 }, data);
  assert.equal(c.timeline.find((s) => s.id === "pan").offset_min, -45);
  const room = computeRecipe({ styleId: "neapolitan", methodId: "room_8_12h", mode: two }, data);
  assert.deepEqual(room.timeline.map((s) => s.id), ["mix", "knead", "rest", "ball", "preheat", "shape", "bake"]);
  assert.equal(room.timeline[0].offset_min, -(15 + 300 + 240 + 10 + 30));
});

test("invalid input throws RangeError", () => {
  const ok = { styleId: "new_york", methodId: "cold_24h", mode: two };
  assert.throws(() => computeRecipe({ ...ok, styleId: "nope" }, data), RangeError);
  assert.throws(() => computeRecipe({ ...ok, methodId: "nope" }, data), RangeError);
  assert.throws(() => computeRecipe({ ...ok, yeastType: "wet" }, data), RangeError);
  assert.throws(() => computeRecipe({ ...ok, mode: { pizzas: 0 } }, data), RangeError);
  assert.throws(() => computeRecipe({ ...ok, mode: { pizzas: 2, ballWeight: -5 } }, data), RangeError);
  assert.throws(() => computeRecipe({ ...ok, mode: { pans: [] } }, data), RangeError);
  assert.throws(() => computeRecipe({ styleId: "detroit", methodId: "cold_24h", mode: two }, data), RangeError);
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
  assert.equal(Object.keys(data.styles).length, 6);
});

test("data: pan presets", () => {
  const ids = data.pan_presets.map((p) => `${p.shape}:${p.diameter ?? `${p.length}x${p.width}`}`);
  for (const want of ["rect:45x37.5", "rect:40x30", "rect:20x25", "rect:23x33", "rect:30x40", "round:18", "round:20", "round:23", "round:28"]) {
    assert.ok(ids.includes(want), want);
  }
});

// ---- By size (round diameter or tray) for ball styles ----------------------------------------------------------
const round = (d) => ({ shape: "round", diameter: d });
const tray = { shape: "rect", length: 30, width: 40 };

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

test("size mode: 26 cm, 32 cm and the 30 x 40 tray scale with area (hand-computed)", () => {
  const d = data.styles.new_york.dough_density_g_per_cm2.value;
  const dough = (size, n = 2) => computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: { pizzas: n, size } }, data).dough_g;
  near(dough(round(26)), 2 * Math.PI * 169 * d, 1e-9); // about 375.6 g
  near(dough(round(26)), 375.6, 0.1);
  near(dough(round(32)), 568.9, 0.1);
  near(dough(tray, 1), 1200 * d, 1e-9); // about 424.4 g for one tray
  near(dough(tray, 1), 424.4, 0.1);
  near(dough(tray, 3), 3 * dough(tray, 1), 1e-9);
});

test("size mode: Neapolitan works, 2-pizza minimum for the warm method still applies, styles without a density throw", () => {
  const nea = computeRecipe({ styleId: "neapolitan", methodId: "cold_24h", mode: { pizzas: 2, size: round(30) } }, data);
  near(nea.dough_g, 500, 1e-5);
  const one = computeRecipe({ styleId: "new_york", methodId: "warm_2h", mode: { pizzas: 1, size: round(30) } }, data);
  assert.equal(one.yeast.mode, "unavailable");
  assert.ok(one.warnings.some((w) => w.id === "min_batch"));
  const okTwo = computeRecipe({ styleId: "new_york", methodId: "warm_2h", mode: { pizzas: 2, size: round(30) } }, data);
  assert.equal(okTwo.yeast.mode, "direct");
  assert.throws(() => computeRecipe({ styleId: "roman_tonda", methodId: "cold_24h", mode: { pizzas: 2, size: round(30) } }, data), RangeError);
  assert.throws(() => computeRecipe({ styleId: "new_york", methodId: "cold_24h", mode: { pizzas: 2, size: round(0) } }, data), RangeError);
});

test("the sizes list in recipes.json is the four sizes of the site", () => {
  assert.deepEqual(data.sizes.map((s) => s.id), ["round_26", "round_30", "round_32", "tray_30x40"]);
  near(panArea(data.sizes[3]), 1200, 1e-9);
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
