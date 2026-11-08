// Reads the form, calls calc.js, renders the result. All numbers come from calc.js and recipes.json.
import { computeRecipe, panArea, formatNumber } from "./calc.js";
import { interpolate, formatDuration } from "./i18n.js";

const { recipes: data, strings: t, lang } = JSON.parse(document.getElementById("calc-data").textContent);
const $ = (id) => document.getElementById(id);
const n = (x) => formatNumber(x, lang);
const f = (str, params) => interpolate(str, params, lang);
const gUnit = t.unit.g;
const g = (x) => `${n(x)} ${gUnit}`;

let pans = [];

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) e.append(kid);
  return e;
}

// ---- Form state -------------------------------------------------------------

function presetsFor(styleId) {
  return data.pan_presets.filter((p) => p.styles.includes(styleId));
}
function presetLabel(p) {
  const size = p.shape === "round" ? `${n(p.diameter)}` : `${n(p.length)} × ${n(p.width)}`;
  const kind = t.calc[p.label_key] ?? "";
  return `${kind} ${f(t.calc.pan_label, { size })}${p.shape === "round" ? ` (${t.calc.round_word})` : ""}`.trim();
}

function setStyle(styleId, { resetMethod = true } = {}) {
  const st = data.styles[styleId];
  $("style").value = styleId;
  if (resetMethod) $("method").value = st.default_method;
  const isPan = st.kind === "pan";
  $("ball-inputs").hidden = isPan;
  $("pan-inputs").hidden = !isPan;
  $("thick-field").hidden = !(isPan && st.density.thick);
  $("thick").checked = false;
  if (isPan) {
    pans = st.default_mode.pans.map((p) => ({ preset: "custom", ...p }));
    pans.forEach((p, i) => {
      const match = presetsFor(styleId).find((q) => q.shape === p.shape && (p.shape === "round" ? q.diameter === p.diameter : q.length === p.length && q.width === p.width));
      if (match) pans[i] = { preset: match.id, ...p };
    });
    renderPans();
  } else {
    $("pizzas").value = st.default_mode.pizzas;
    $("ball").value = st.ball_g.value;
  }
}

function renderPans() {
  const list = $("pan-list");
  list.replaceChildren();
  const presets = presetsFor($("style").value);
  pans.forEach((p, i) => {
    const sel = el("select", { "aria-label": t.calc.preset, onchange: (e) => {
      const v = e.target.value;
      const pre = presets.find((q) => q.id === v);
      pans[i] = pre ? { preset: v, shape: pre.shape, diameter: pre.diameter, length: pre.length, width: pre.width }
        : { preset: v, shape: v === "custom_round" ? "round" : "rect", diameter: 20, length: 20, width: 25 };
      renderPans(); update();
    } },
      presets.map((q) => el("option", { value: q.id }, presetLabel(q))),
      el("option", { value: "custom_round" }, t.calc.custom_round),
      el("option", { value: "custom_rect" }, t.calc.custom_rect));
    sel.value = p.preset === "custom" ? (p.shape === "round" ? "custom_round" : "custom_rect") : p.preset;
    const row = el("div", { class: "pan-row" }, sel);
    const num = (key, label) => el("label", {}, label, el("input", { type: "number", inputmode: "decimal", min: "1", step: "any", value: p[key] ?? "", oninput: (e) => { pans[i][key] = e.target.value; update(); } }));
    if (sel.value === "custom_round") row.append(num("diameter", t.calc.diameter));
    if (sel.value === "custom_rect") row.append(num("length", t.calc.length), num("width", t.calc.width));
    if (pans.length > 1) row.append(el("button", { type: "button", class: "button secondary pan-remove", onclick: () => { pans.splice(i, 1); renderPans(); update(); } }, t.calc.remove_pan));
    list.append(row);
  });
}

function readInput() {
  const styleId = $("style").value;
  const st = data.styles[styleId];
  const input = {
    styleId,
    methodId: $("method").value,
    yeastType: document.querySelector('input[name="yeast"]:checked').value,
    bakeTime: $("bake-time").value ? new Date($("bake-time").value) : null,
    thick: $("thick").checked,
  };
  if (st.kind === "pan") {
    input.mode = { pans: pans.map((p) => (p.shape === "round" ? { shape: "round", diameter: p.diameter } : { shape: "rect", length: p.length, width: p.width })) };
  } else {
    input.mode = { pizzas: $("pizzas").value, ballWeight: $("ball").value };
  }
  return input;
}

// ---- Result -> sections (shared by the page and "copy as text") --------------

function timeLabel(step) {
  if (step.at) {
    const loc = lang === "fa" ? "fa-u-ca-gregory" : "en-GB";
    return new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(step.at);
  }
  return step.offset_min === 0 ? t.calc.timeline_now : f(t.calc.timeline_rel, { t: formatDuration(-step.offset_min, t, lang) });
}

function buildSections(r) {
  const s = [];
  const style = data.styles[r.style_id];
  const ingLabel = (i) => {
    let label = t.ing[i.id];
    if (i.id === "water") label += ` (${f(t.calc.water_temp, { c: i.temp_c })})`;
    if (i.optional) label += ` (${t.calc.optional})`;
    return label;
  };

  const total = [[t.calc.dough_total, g(r.dough_g)]];
  s.push({ title: t.calc.results, rows: total, hideTitle: true });
  s.push({ title: t.calc.ingredients, rows: r.ingredients.map((i) => [ingLabel(i), g(i.g)]) });

  // yeast
  const y = r.yeast;
  const yeastLines = [];
  if (y.mode === "solution") {
    const sol = y.solution;
    const packet = f(y.type === "dry" ? t.calc.packet_dry : t.calc.packet_fresh, { g: sol.yeast_g, cube: data.yeast.solution.fresh.cube_g.value });
    yeastLines.push(...f(t.calc.solution_steps, { yeast: packet, water: sol.water_g, pct: sol.concentration_pct, take: sol.take_g }).split("\n"));
    yeastLines.push(f(t.calc.water_note, { take: sol.take_g, add: r.water.add_g, temp: r.water.temp_c }));
    s.push({ title: t.calc.solution_title, box: true, lines: yeastLines, ordered: yeastLines.length - 1 });
  } else if (y.mode === "direct") {
    s.push({ title: t.calc.yeast, lines: [f(t.calc.yeast_direct, { g: y.weigh_g, type: t.calc[`type_${y.type}`] })] });
  } else {
    s.push({ title: t.calc.yeast, lines: [t.calc.yeast_none] });
  }

  // pan oil, sauce, cheese, toppings
  const top = [];
  if (r.pan_oil_g != null) top.push([t.calc.pan_oil, g(r.pan_oil_g)]);
  for (const x of r.toppings) {
    let label = t.top[x.id];
    if (x.id === "cheese" && x.blend) label += ` (${x.blend.map((b) => t.top[b]).join(" + ")})`;
    if (x.optional) label += ` (${t.calc.optional})`;
    if (x.after_bake && !label.includes(t.calc.after_bake)) label += ` - ${t.calc.after_bake}`;
    top.push([label, g(x.g)]);
  }
  if (top.length) s.push({ title: `${t.calc.sauce} / ${t.calc.cheese} / ${t.calc.toppings}`, rows: top });
  if (r.sauce) s.push({ title: t.calc.sauce_recipe, rows: r.sauce.recipe.map((i) => [t.top[i.id] + (i.optional ? ` (${t.calc.optional})` : ""), g(i.g)]) });
  s.push({ title: "", lines: [f(t.calc.layer_order, { order: r.bake.layer_order.map((k) => t.calc.layer[k]).join(" > ") })], plain: true });

  // oven
  const o = r.oven;
  const ovenLines = [f(t.calc.oven_line, { temp: o.temp_c, rack: t.rack[o.rack], surface: o.surface.map((k) => t.surface[k]).join(" / "), pre: o.preheat_min })];
  if (o.grill) ovenLines.push(f(t.calc.grill_line, { from: o.grill.last_min[0], to: o.grill.last_min[1], max: o.grill.max_min ?? o.grill.last_min[1] }));
  ovenLines.push(f(t.calc.bake_line, { from: r.bake.time_min[0], to: r.bake.time_min[1], temp: r.bake.temp_c }));
  s.push({ title: t.calc.oven, lines: ovenLines });

  // timeline
  s.push({
    title: t.calc.timeline,
    steps: r.timeline.map((st) => {
      let label = t.timeline[st.id];
      if (["fridge", "rest", "ball", "pan", "take_out"].includes(st.id) && st.duration_min > 0) label += ` (${formatDuration(st.duration_min, t, lang)})`;
      return [timeLabel(st), label];
    }),
  });
  const lead = -r.timeline[0].offset_min;
  s.push({ title: "", lines: [f(t.calc.total_lead, { t: formatDuration(lead, t, lang) })], plain: true });

  const warns = r.warnings.map((w) => ({ text: f(t.warn[w.id], w.params), severity: w.severity }));
  s.push({ title: t.calc.warnings, warnings: warns });
  return s;
}

function renderSections(sections, root) {
  root.replaceChildren();
  for (const sec of sections) {
    if (sec.title && !sec.hideTitle) root.append(el("h3", {}, sec.title));
    if (sec.rows) root.append(el("ul", { class: "rows" }, sec.rows.map(([a, b]) => el("li", {}, el("span", {}, a), el("span", { class: "val" }, b)))));
    if (sec.lines && sec.box) {
      const ordered = sec.lines.slice(0, sec.ordered);
      root.append(el("div", { class: "box" }, el("ol", {}, ordered.map((l) => el("li", {}, l.replace(/^[^\s]+\s/, "")))), el("p", {}, sec.lines[sec.ordered])));
    } else if (sec.lines) {
      sec.lines.forEach((l) => root.append(el("p", {}, l)));
    }
    if (sec.steps) root.append(el("ol", { class: "timeline" }, sec.steps.map(([when, what]) => el("li", {}, el("span", { class: "when" }, when), what))));
    if (sec.warnings) root.append(el("ul", { class: "notes" }, sec.warnings.map((w) => el("li", { class: `note note-${w.severity}` }, w.text))));
  }
}

function toText(sections) {
  const out = [];
  for (const sec of sections) {
    if (sec.title && !sec.hideTitle) out.push("", sec.title);
    sec.rows?.forEach(([a, b]) => out.push(`${a}: ${b}`));
    sec.lines?.forEach((l) => out.push(l));
    sec.steps?.forEach(([a, b]) => out.push(`${a}  ${b}`));
    sec.warnings?.forEach((w) => out.push(`- ${w.text}`));
    if (sec.rows && sec.hideTitle) out.push("");
  }
  return out.join("\n").trim();
}

let lastText = "";
function update() {
  const body = $("results-body");
  try {
    const r = computeRecipe(readInput(), data);
    const sections = buildSections(r);
    renderSections(sections, body);
    lastText = toText(sections);
  } catch (e) {
    lastText = "";
    const code = e instanceof RangeError ? e.message : "unknown";
    body.replaceChildren(el("p", { class: "error" }, t.calc.err[code] ?? f(t.calc.error, { code })));
  }
  const q = new URLSearchParams({ style: $("style").value, method: $("method").value });
  history.replaceState(null, "", `?${q}`);
  const sw = document.querySelector(".lang-switch");
  if (sw) sw.href = sw.href.split("?")[0] + `?${q}`;
}

// ---- Wiring -----------------------------------------------------------------

$("style").addEventListener("change", () => { setStyle($("style").value); update(); });
$("calc-form").addEventListener("input", (e) => { if (e.target.id !== "style" && !e.target.closest(".pan-row")) update(); });
$("add-pan").addEventListener("click", () => {
  const last = pans.at(-1);
  pans.push({ ...last });
  renderPans();
  update();
});
$("print").addEventListener("click", () => window.print());
$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastText);
    $("copy").textContent = t.calc.copied;
    setTimeout(() => { $("copy").textContent = t.calc.copy; }, 1500);
  } catch { /* clipboard not available */ }
});
if ("wakeLock" in navigator) {
  $("wake-field").hidden = false;
  let lock = null;
  $("wake").addEventListener("change", async (e) => {
    try {
      if (e.target.checked) lock = await navigator.wakeLock.request("screen");
      else { await lock?.release(); lock = null; }
    } catch { e.target.checked = false; }
  });
}

const params = new URLSearchParams(location.search);
const startStyle = data.styles[params.get("style")] ? params.get("style") : "new_york";
setStyle(startStyle);
if (data.methods[params.get("method")]) $("method").value = params.get("method");
update();
