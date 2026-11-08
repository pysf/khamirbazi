// Pure calculator for the pizza guide. No DOM, no rounding of results.
// All numbers come from the recipes data object (src/_data/recipes.json).
// Display rounding lives only in formatNumber() at the bottom.

function positive(x, code) {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) throw new RangeError(code);
  return n;
}

/** Area in cm2 of a round pizza: {shape:'round', diameter}. */
export function roundArea(size) {
  if (!size || typeof size !== "object" || size.shape !== "round") throw new RangeError("invalid_size");
  const d = positive(size.diameter, "invalid_size");
  return (Math.PI * d * d) / 4;
}

/**
 * Compute a full recipe.
 * input: {styleId, methodId, yeastType:'dry'|'fresh', mode}
 *   mode: {pizzas, ballWeight?} or {pizzas, size:{shape:'round', diameter}} (needs the style's dough_density_g_per_cm2).
 * data: the parsed recipes.json.
 * Returns exact (unrounded) grams.
 */
export function computeRecipe(input, data) {
  const { styleId, methodId, yeastType = "dry", mode } = input ?? {};
  const style = data.styles[styleId];
  const method = data.methods[methodId];
  if (!style) throw new RangeError("unknown_style");
  if (!method) throw new RangeError("unknown_method");
  if (yeastType !== "dry" && yeastType !== "fresh") throw new RangeError("unknown_yeast_type");
  if (!mode || typeof mode !== "object") throw new RangeError("missing_mode");

  const warnings = [];
  const warn = (id, severity, params = {}) => warnings.push({ id, severity, params });

  // ---- Dough mass ----------------------------------------------------------
  const pizzas = positive(mode.pizzas, "invalid_pizzas");
  let ballWeight;
  let area = null;
  let densityUsed = null;
  let sizeArea = null;

  if (mode.size != null) {
    // By size: dough per pizza = round area x the style's dough density.
    const density = style.dough_density_g_per_cm2?.value;
    if (density == null) throw new RangeError("no_size_density");
    sizeArea = roundArea(mode.size);
    ballWeight = sizeArea * density;
    area = sizeArea * pizzas;
    densityUsed = density;
  } else {
    ballWeight = mode.ballWeight == null ? style.ball_g.value : positive(mode.ballWeight, "invalid_ball_weight");
  }
  const doughG = pizzas * ballWeight;

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
  const tooFew = pizzas < minPizzas;
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
  const ingredients = [{ id: "flour", g: flourTotal }];
  ingredients.push({ id: "water", g: waterToAdd, temp_c: method.water_temp_c.value });
  if (yeastInfo.mode === "solution") ingredients.push({ id: "yeast_solution", g: solutionTake });
  ingredients.push({ id: "salt", g: (d.salt.value / 100) * flourTotal });
  if (d.sugar && d.sugar.value > 0) {
    ingredients.push({ id: "sugar", g: (d.sugar.value / 100) * flourTotal, optional: !!d.sugar.optional });
  }
  if (d.oil && d.oil.value > 0) ingredients.push({ id: style.oil_id ?? "oil", g: (d.oil.value / 100) * flourTotal });
  if (yeastInfo.mode === "direct") ingredients.push({ id: `yeast_${yeastType}`, g: yeastInfo.amount_g });

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
  const bake = { temp_c: oven.temp_c, time_min: bakeRange };

  // ---- Warnings ------------------------------------------------------------
  if (!style.methods_typical.includes(methodId)) warn("method_not_typical", "info", {});
  warn("yeast_varies", "info", { spread: data.yeast.source_spread_x.value });
  warn("parchment", "safety", { max_c: data.safety.parchment_max_c.value });
  if (style.bake.grill) warn("parchment_grill", "safety", { max_c: data.safety.parchment_max_c.value });
  const evoo = data.safety.evoo_smoke_c;
  if (oven.temp_c > evoo.range[0]) {
    warn("oil_smoke", "safety", { min_c: evoo.range[0], max_c: evoo.range[1], oven_c: oven.temp_c });
  }
  if (style.flags?.no_oil_no_sugar) warn("no_oil_no_sugar", "info", { oven_c: oven.temp_c });

  return {
    style_id: styleId,
    method_id: methodId,
    yeast_type: yeastType,
    pizzas,
    ball_g: ballWeight,
    area_cm2: area,
    size_area_cm2: sizeArea,
    density_g_per_cm2: densityUsed,
    dough_g: doughG,
    flour_total_g: flourTotal,
    ingredients,
    water: { total_g: waterTotal, add_g: waterToAdd, temp_c: method.water_temp_c.value },
    yeast: yeastInfo,
    oven,
    bake,
    warnings,
  };
}

/** Display helper: at most 1 decimal. English: 12.5. Farsi: Persian digits and the decimal separator, ۱۲٫۵ (the design decides). Never use for calculation or for URLs and input values. */
export function formatNumber(n, locale = "en") {
  if (n == null || Number.isNaN(n)) return "";
  const loc = locale === "fa" ? "fa-IR" : "en-US";
  return new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(n);
}
