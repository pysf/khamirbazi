// Pure calculator for the pizza guide. No DOM, no rounding of results.
// All numbers come from the recipes data object (src/_data/recipes.json).
// Display rounding lives only in formatNumber() at the bottom.

const MS_PER_MIN = 60000;

function positive(x, code) {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) throw new RangeError(code);
  return n;
}

/** Area in cm2 of one pan: {shape:'round', diameter} or {shape:'rect', length, width}. */
export function panArea(pan) {
  if (!pan || typeof pan !== "object") throw new RangeError("invalid_pan");
  if (pan.shape === "round") {
    const d = positive(pan.diameter, "invalid_pan");
    return (Math.PI * d * d) / 4;
  }
  if (pan.shape === "rect") {
    return positive(pan.length, "invalid_pan") * positive(pan.width, "invalid_pan");
  }
  throw new RangeError("invalid_pan");
}

function toppingGrams(t, ctx) {
  const a = t.amount.value;
  if (t.basis === "pizza") return a * ctx.pizzas;
  if (t.basis === "cm2") return a * ctx.area;
  if (t.basis === "ref_area") return (a * ctx.area) / t.ref_area_cm2;
  throw new Error(`unknown topping basis ${t.basis}`);
}

function buildTimeline({ data, style, method, methodId, bakeTime, bakeMinutes }) {
  const pre = data.oven.preheat_min.value;
  const shapeLead = data.timeline.shape_lead_min.value;
  const shapeId = style.kind === "pan" ? "pan" : "ball";
  const bakeMin = 0; // baking start is the zero point
  const steps = []; // built backwards as offsets (minutes, <= 0) from the start of baking

  let mix;
  let knead = null;
  let rest;
  let divide;
  let fridge = null;
  let takeOut = null;
  const kneadMin = method.knead_min.value;
  const autolyse = method.autolyse_min === 0 ? 0 : method.autolyse_min.value;

  if (method.fridge_h) {
    takeOut = bakeMin - method.take_out_lead_min.value;
    fridge = takeOut - method.fridge_h.value * 60;
    rest = fridge - method.room_rest_min.value;
    knead = rest - kneadMin;
    mix = knead - autolyse;
  } else {
    const finalRest =
      methodId === "warm_2h" && style.warm_final_rest_min
        ? style.warm_final_rest_min.value
        : method.final_rest_min.value;
    divide = bakeMin - shapeLead - finalRest;
    rest = divide - method.bulk_min.value;
    // Warm method has no autolyse: mix and knead are one step.
    knead = autolyse > 0 ? rest - kneadMin : null;
    mix = autolyse > 0 ? knead - autolyse : rest - kneadMin;
  }

  steps.push({ id: "mix", offset_min: mix, duration_min: autolyse > 0 ? autolyse : kneadMin });
  if (autolyse > 0) steps.push({ id: "knead", offset_min: knead, duration_min: kneadMin });
  steps.push({
    id: "rest",
    offset_min: rest,
    duration_min: method.fridge_h ? method.room_rest_min.value : method.bulk_min.value,
  });
  if (fridge !== null) {
    // Divide and ball the dough, then into the fridge.
    steps.push({ id: "fridge", offset_min: fridge, duration_min: method.fridge_h.value * 60 });
    steps.push({ id: "take_out", offset_min: takeOut, duration_min: method.take_out_lead_min.value });
  } else {
    steps.push({ id: shapeId, offset_min: divide, duration_min: -divide - shapeLead });
  }
  steps.push({ id: "preheat", offset_min: -pre, duration_min: pre });
  steps.push({ id: "shape", offset_min: -shapeLead, duration_min: shapeLead });
  steps.push({ id: "bake", offset_min: 0, duration_min: bakeMinutes });

  // Stable sort keeps the intended order for ties (for example ball and preheat).
  const sorted = steps
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.offset_min - b.s.offset_min || a.i - b.i)
    .map(({ s }) => s);

  const bake = bakeTime == null ? null : new Date(bakeTime);
  return sorted.map((s) => ({
    ...s,
    at: bake && !Number.isNaN(bake.getTime()) ? new Date(bake.getTime() + s.offset_min * MS_PER_MIN) : null,
  }));
}

/**
 * Compute a full recipe.
 * input: {styleId, methodId, yeastType:'dry'|'fresh', mode, bakeTime?, thick?}
 *   mode: {pizzas, ballWeight?} or {pizzas, size:{shape,...}} (a round or rectangle; needs the style's dough_density_g_per_cm2) for ball styles, {pans:[{shape,...}]} for pan styles.
 * data: the parsed recipes.json.
 * Returns exact (unrounded) grams.
 */
export function computeRecipe(input, data) {
  const { styleId, methodId, yeastType = "dry", mode, bakeTime = null, thick = false } = input ?? {};
  const style = data.styles[styleId];
  const method = data.methods[methodId];
  if (!style) throw new RangeError("unknown_style");
  if (!method) throw new RangeError("unknown_method");
  if (yeastType !== "dry" && yeastType !== "fresh") throw new RangeError("unknown_yeast_type");
  if (!mode || typeof mode !== "object") throw new RangeError("missing_mode");

  const warnings = [];
  const warn = (id, severity, params = {}) => warnings.push({ id, severity, params });

  // ---- Dough mass ----------------------------------------------------------
  let doughG;
  let pizzas = null;
  let ballWeight = null;
  let area = null;
  let pans = null;
  let densityUsed = null;
  let sizeArea = null;

  if (style.kind === "pan") {
    if (!Array.isArray(mode.pans) || mode.pans.length === 0) throw new RangeError("missing_pans");
    pans = mode.pans.map((p) => ({ ...p, area_cm2: panArea(p) }));
    area = pans.reduce((sum, p) => sum + p.area_cm2, 0);
    densityUsed = thick && style.density.thick ? style.density.thick.value : style.density.value;
    doughG = area * densityUsed;
    if (area < data.limits.min_pan_area_cm2) {
      warn("pan_small", "warning", { min_area_cm2: data.limits.min_pan_area_cm2 });
    }
  } else {
    pizzas = positive(mode.pizzas, "invalid_pizzas");
    if (mode.size != null) {
      // By size: one pizza (or tray) is a round or rectangle; dough = area x the style's dough density.
      const density = style.dough_density_g_per_cm2?.value;
      if (density == null) throw new RangeError("no_size_density");
      sizeArea = panArea(mode.size);
      ballWeight = sizeArea * density;
      area = sizeArea * pizzas;
      densityUsed = density;
    } else {
      ballWeight = mode.ballWeight == null ? style.ball_g.value : positive(mode.ballWeight, "invalid_ball_weight");
    }
    doughG = pizzas * ballWeight;
  }

  // ---- Flour and yeast -----------------------------------------------------
  const d = style.dough;
  const hyd = d.hydration.value / 100;
  const base = hyd + d.salt.value / 100 + (d.sugar?.value ?? 0) / 100 + (d.oil?.value ?? 0) / 100;
  const y = method.yeast_pct_dry.value / 100; // dry yeast fraction of flour
  const freshX = data.yeast.fresh_to_dry.value;
  const yeastFactor = yeastType === "fresh" ? freshX : 1;
  const threshold = data.yeast.solution_threshold_dry_g.value;
  // Some methods need a minimum number of pizzas (the warm method: 1 pizza needs under 1 g of yeast).
  const minPizzas = method.min_pizzas ?? 0;
  const tooFew = style.kind === "ball" && pizzas < minPizzas;
  const minWeigh = data.yeast.min_weigh_g.value;

  // Decide direct or solution from the dry-equivalent amount (dry yeast mass in the dough).
  const flourEstimate = doughG / (1 + base + y);
  let yeastMode = flourEstimate * y < threshold ? "solution" : "direct";

  const flourFor = (m) => doughG / (1 + base + (m === "direct" ? y * yeastFactor : 0));
  let flourTotal = flourFor(yeastMode);
  let dryEq = flourTotal * y;
  let waterTotal = hyd * flourTotal;

  const sol = data.yeast.solution[yeastType];
  const solutionG = (dryE) => (dryE * yeastFactor) / (sol.concentration_pct.value / 100);

  if (!tooFew && yeastMode === "solution" && solutionG(dryEq) > waterTotal) {
    // The solution would be more than all the water: fall back to weighing the yeast.
    warn("solution_exceeds_water", "info", {});
    yeastMode = "direct";
    flourTotal = flourFor("direct");
    dryEq = flourTotal * y;
    waterTotal = hyd * flourTotal;
  }

  let yeastInfo;
  if (tooFew) {
    yeastMode = "unavailable";
    yeastInfo = { mode: "unavailable", type: yeastType, dry_equivalent_g: dryEq, amount_g: dryEq * yeastFactor, weigh_g: null };
    warn("min_batch", "warning", { min_pizzas: minPizzas, pizzas, min_g: minWeigh });
  } else if (yeastMode === "solution") {
    const take = solutionG(dryEq);
    yeastInfo = {
      mode: "solution",
      type: yeastType,
      dry_equivalent_g: dryEq,
      amount_g: dryEq * yeastFactor,
      solution: {
        yeast_g: sol.yeast_g.value,
        water_g: sol.water_g.value,
        concentration_pct: sol.concentration_pct.value,
        packet: yeastType === "dry" ? "whole_7g_packet" : "half_42g_cube",
        take_g: take,
        use_immediately: data.yeast.solution.use_immediately,
      },
    };
  } else {
    const direct = dryEq * yeastFactor;
    if (direct < minWeigh) {
      yeastMode = "unavailable";
      yeastInfo = { mode: "unavailable", type: yeastType, dry_equivalent_g: dryEq, amount_g: direct, weigh_g: null };
      warn("batch_too_small", "warning", { yeast_g: direct });
    } else {
      yeastInfo = { mode: "direct", type: yeastType, dry_equivalent_g: dryEq, amount_g: direct, weigh_g: direct };
      if (dryEq < threshold) warn("scale_resolution", "info", { yeast_g: direct });
    }
  }

  const solutionTake = yeastInfo.mode === "solution" ? yeastInfo.solution.take_g : 0;
  const waterToAdd = waterTotal - solutionTake;

  // ---- Ingredients ---------------------------------------------------------
  const cornmealG = d.cornmeal ? (d.cornmeal.value / 100) * flourTotal : 0;
  const ingredients = [{ id: "flour", g: flourTotal - cornmealG }];
  if (cornmealG > 0) ingredients.push({ id: "cornmeal", g: cornmealG });
  ingredients.push({ id: "water", g: waterToAdd, temp_c: method.water_temp_c.value });
  if (yeastInfo.mode === "solution") ingredients.push({ id: "yeast_solution", g: solutionTake });
  ingredients.push({ id: "salt", g: (d.salt.value / 100) * flourTotal });
  if (d.sugar && d.sugar.value > 0) {
    ingredients.push({ id: "sugar", g: (d.sugar.value / 100) * flourTotal, optional: !!d.sugar.optional });
  }
  if (d.oil && d.oil.value > 0) ingredients.push({ id: style.oil_id ?? "oil", g: (d.oil.value / 100) * flourTotal });
  if (yeastInfo.mode === "direct") ingredients.push({ id: `yeast_${yeastType}`, g: yeastInfo.amount_g });

  const panOilG = style.pan_oil ? (style.pan_oil.amount.value * area) / style.pan_oil.ref_area_cm2 : null;

  // ---- Sauce, cheese, toppings --------------------------------------------
  const ctx = { pizzas, area };
  const toppings = style.toppings.map((t) => ({
    id: t.id,
    g: toppingGrams(t, ctx),
    optional: !!t.optional,
    after_bake: !!t.after_bake,
    alt_group: t.alt_group ?? null,
    blend: t.blend ?? null,
  }));
  const sauceTop = toppings.find((t) => t.id === "sauce");
  const cheeseTop = toppings.find((t) => t.id === "cheese");
  let sauce = null;
  if (sauceTop) {
    const rec = data.sauce_recipe;
    const k = sauceTop.g / (rec.base_g.value + rec.parts_g.reduce((s, p) => s + p.g, 0));
    sauce = {
      g: sauceTop.g,
      recipe: [{ id: "tomatoes", g: rec.base_g.value * k }, ...rec.parts_g.map((p) => ({ id: p.id, g: p.g * k, optional: !!p.optional }))],
    };
  }
  const cheese = cheeseTop ? { g: cheeseTop.g, blend: cheeseTop.blend } : null;

  // ---- Oven and bake -------------------------------------------------------
  const bakeRange = style.bake.time_min.range;
  const oven = {
    temp_c: style.bake.temp_c.value,
    mode: data.oven.mode,
    fan: false,
    rack: style.bake.rack,
    preheat_min: data.oven.preheat_min.value,
    surface: data.oven.surface.options,
    grill: style.bake.grill
      ? { last_min: style.bake.grill.last_min.range, max_min: style.bake.grill.max_min?.value ?? null }
      : null,
  };
  const bake = { temp_c: oven.temp_c, time_min: bakeRange, layer_order: style.layer_order };

  // ---- Timeline ------------------------------------------------------------
  const timeline = buildTimeline({
    data,
    style,
    method,
    methodId,
    bakeTime,
    bakeMinutes: bakeRange[1],
  });

  // ---- Warnings ------------------------------------------------------------
  if (!style.methods_typical.includes(methodId)) warn("method_not_typical", "info", {});
  warn("yeast_varies", "info", { spread: data.yeast.source_spread_x.value });
  if (style.kind === "ball") {
    warn("parchment", "safety", { max_c: data.safety.parchment_max_c.value });
    if (style.bake.grill) warn("parchment_grill", "safety", { max_c: data.safety.parchment_max_c.value });
  }
  const evoo = data.safety.evoo_smoke_c;
  if (oven.temp_c > evoo.range[0]) {
    warn("oil_smoke", "safety", { min_c: evoo.range[0], max_c: evoo.range[1], oven_c: oven.temp_c });
  }
  if (style.flags?.no_oil_no_sugar) warn("no_oil_no_sugar", "info", { oven_c: oven.temp_c });

  return {
    style_id: styleId,
    method_id: methodId,
    yeast_type: yeastType,
    kind: style.kind,
    pizzas,
    ball_g: ballWeight,
    pans,
    area_cm2: area,
    size_area_cm2: sizeArea,
    density_g_per_cm2: densityUsed,
    dough_g: doughG,
    flour_total_g: flourTotal,
    ingredients,
    water: { total_g: waterTotal, add_g: waterToAdd, temp_c: method.water_temp_c.value },
    yeast: yeastInfo,
    pan_oil_g: panOilG,
    sauce,
    cheese,
    toppings,
    oven,
    bake,
    timeline,
    warnings,
  };
}

/** Display helper: at most 1 decimal. Western digits (0-9) in both languages, as the design decides, so numbers match the kitchen scale and oven display. Never use for calculation. */
export function formatNumber(n, locale = "en") {
  if (n == null || Number.isNaN(n)) return "";
  const loc = locale === "fa" ? "fa-IR-u-nu-latn" : "en-US";
  return new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(n);
}
