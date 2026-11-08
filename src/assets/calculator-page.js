// Reads the form, calls calc.js, renders the result. All numbers come from calc.js and recipes.json.
import { computeRecipe, panArea, formatNumber } from "./calc.js";
import { interpolate, formatDuration } from "./i18n.js";

const { recipes: data, strings: t, lang } = JSON.parse(document.getElementById("calc-data").textContent);
const $ = (id) => document.getElementById(id);
const n = (x) => formatNumber(x, lang);
const f = (str, params) => interpolate(str, params, lang);
const g = (x) => `${n(x)} ${t.unit.g}`;
const sep = lang === "fa" ? "، " : ", ";

// ---- Tiny DOM helpers -------------------------------------------------------

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) e.append(kid);
  return e;
}
const SVG = (path, cls = "ic") => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("class", cls);
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  for (const d of path.split("|")) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    s.append(p);
  }
  return s;
};
// Same icon paths as lib/icons.js (kept short: only the ones the results need).
const ICON = {
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3",
  copy: "M5 15V6a2 2 0 0 1 2-2h8|M11 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z",
  print: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z",
  safe: "M8 3h8l5 5v8l-5 5H8l-5-5V8z|M12 8v5M12 16.5h.01",
  warn: "M12 3l10 18H2z|M12 10v5M12 18h.01",
  note: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 11v5M12 7.5h.01",
  error: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7v6M12 16.5h.01",
};

/** Accept Persian / Arabic-Indic digits and the Arabic decimal mark in number fields. */
function parseNum(s) {
  const latin = String(s ?? "")
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06f0)
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660)
    .replace(/[٫,]/g, ".")
    .trim();
  return latin === "" ? NaN : Number(latin);
}

// ---- State ------------------------------------------------------------------

const state = { yeast: "dry", pans: [], thick: false, shape: "round" };
const style = () => data.styles[$("f-style").value];
const presetsFor = (styleId) => data.pan_presets.filter((p) => p.styles.includes(styleId));

function sizeNode(p) {
  return el("bdi", { dir: "ltr" }, p.shape === "round" ? n(p.diameter) : `${n(p.length)} × ${n(p.width)}`);
}
/** "Rectangle · 30 × 40 cm" with the numbers isolated, so they stay in order in right-to-left text. */
function withSize(template, p) {
  const [a, b = ""] = template.split("{size}");
  return [a, sizeNode(p), b];
}
function panText(p) {
  const size = p.shape === "round" ? n(p.diameter) : `${n(p.length)} × ${n(p.width)}`;
  return f(p.shape === "round" ? t.calc.pan_round : t.calc.pan_rect, { size });
}
function presetNodes(pre) {
  const kind = t.calc[pre.label_key] ?? "";
  return [`${kind} `, ...withSize(t.calc.pan_label, pre)];
}
const samePan = (a, b) => a.shape === b.shape && (a.shape === "round" ? a.diameter === b.diameter : a.length === b.length && a.width === b.width);

function setStyle(styleId, { resetMethod = true } = {}) {
  const st = data.styles[styleId];
  $("f-style").value = styleId;
  if (resetMethod) $("f-method").value = st.default_method;
  const isPan = st.kind === "pan";
  $("ball-inputs").hidden = isPan;
  $("pan-inputs").hidden = !isPan;
  $("mode-hint").textContent = isPan ? t.calc.hint_pan : t.calc.hint_pizzas;
  $("thick").hidden = !(isPan && st.density.thick);
  state.thick = false;
  setSwitch($("thick"), false);
  if (isPan) {
    state.pans = st.default_mode.pans.map((p) => ({ ...p }));
    renderPanInputs();
  } else {
    $("f-count").value = st.default_mode.pizzas;
    $("f-ball").value = st.ball_g.value;
  }
}

function setSwitch(btn, on) {
  btn.setAttribute("aria-checked", String(on));
}

// ---- Pan inputs -------------------------------------------------------------

function renderPanInputs() {
  const min = data.limits.min_pan_area_cm2;
  const list = $("pan-list");
  list.replaceChildren(
    ...state.pans.map((p, i) => {
      let area = NaN;
      try { area = panArea(p); } catch { /* invalid size */ }
      const bad = !(area >= min);
      return el("li", { class: bad ? "bad" : "" },
        el("span", {}, el("strong", {}, withSize(p.shape === "round" ? t.calc.pan_round : t.calc.pan_rect, p)), el("span", { class: "small" }, Number.isNaN(area) ? "" : `${n(area)} ${t.unit.cm2}`)),
        el("button", { type: "button", class: "rm", onclick: () => { state.pans.splice(i, 1); renderPanInputs(); update(); } }, t.calc.remove_pan));
    }),
  );
  $("pan-presets").replaceChildren(
    ...presetsFor($("f-style").value).map((pre) =>
      el("button", { type: "button", class: "chip add", onclick: () => {
        const { shape, diameter, length, width } = pre;
        state.pans.push(shape === "round" ? { shape, diameter } : { shape, length, width });
        renderPanInputs(); update();
      } }, presetNodes(pre))),
  );
}

function addCustomPan() {
  const shape = state.shape;
  const pan = shape === "round" ? { shape, diameter: parseNum($("c-diameter").value) } : { shape, length: parseNum($("c-length").value), width: parseNum($("c-width").value) };
  const vals = shape === "round" ? [pan.diameter] : [pan.length, pan.width];
  if (vals.some((v) => !(v > 0))) {
    showPanError(t.calc.err.invalid_pan);
    return;
  }
  state.pans.push(pan);
  for (const id of ["c-diameter", "c-length", "c-width"]) $(id).value = "";
  renderPanInputs(); update();
}
function showPanError(msg) {
  const box = $("pan-error");
  box.hidden = !msg;
  box.replaceChildren(...(msg ? [SVG(ICON.error), msg] : []));
}

// ---- Reading and validating the form ----------------------------------------

function fieldError(id, msg) {
  const field = $(id).closest(".field");
  field.classList.toggle("err", !!msg);
  const box = field.querySelector(".msg-err");
  box.hidden = !msg;
  box.replaceChildren(...(msg ? [SVG(ICON.error), msg] : []));
}

/** Returns { input } or { error }. Errors are shown next to the field and block the result. */
function readInput() {
  const styleId = $("f-style").value;
  const st = data.styles[styleId];
  const input = {
    styleId,
    methodId: $("f-method").value,
    yeastType: state.yeast,
    bakeTime: $("f-bake").value ? new Date($("f-bake").value) : null,
    thick: state.thick,
  };
  let error = null;
  if (st.kind === "pan") {
    fieldError("f-count", null);
    fieldError("f-ball", null);
    const min = data.limits.min_pan_area_cm2;
    let msg = null;
    if (state.pans.length === 0) msg = t.calc.err.missing_pans;
    else if (state.pans.some((p) => { try { return panArea(p) < min; } catch { return false; } })) msg = f(t.calc.err.pan_too_small, { min });
    else if (state.pans.some((p) => { try { panArea(p); return false; } catch { return true; } })) msg = t.calc.err.invalid_pan;
    showPanError(msg);
    error = msg;
    input.mode = { pans: state.pans };
  } else {
    const pizzas = parseNum($("f-count").value);
    const ball = parseNum($("f-ball").value);
    fieldError("f-count", pizzas > 0 ? null : t.calc.err.invalid_pizzas);
    fieldError("f-ball", ball > 0 ? null : t.calc.err.invalid_ball_weight);
    error = pizzas > 0 && ball > 0 ? null : t.calc.err.invalid_pizzas;
    input.mode = { pizzas, ballWeight: ball };
  }
  return error ? { error } : { input };
}

// ---- Result model (shared by the page and "copy as text") -------------------

const dateLocale = lang === "fa" ? "fa-u-ca-gregory-nu-latn" : "en-GB";
const fmtTime = (d) => new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const fmtDay = (d) => new Intl.DateTimeFormat(dateLocale, { weekday: "short", day: "numeric", month: "short" }).format(d);
const fmtFull = (d) => `${fmtDay(d)} ${fmtTime(d)}`;

function build(r, input) {
  const style = data.styles[r.style_id];
  const model = {};

  model.sub = [t.styles[r.style_id].name, t.methods_short[r.method_id], t.calc[`yeast_${r.yeast_type}_short`]].join(" · ");
  model.amount = r.kind === "pan"
    ? f(t.calc.amount_pans, { n: r.pans.length, area: r.area_cm2 })
    : f(t.calc.amount_pizzas, { n: r.pizzas, ball: r.ball_g });
  model.dough = g(r.dough_g);
  model.flour = g(r.flour_total_g);

  model.ingredients = r.ingredients.map((i) => {
    let label = t.ing[i.id];
    if (i.id === "water") label += ` (${f(t.calc.water_temp, { c: i.temp_c })})`;
    if (i.optional) label += ` (${t.calc.optional})`;
    return [label, g(i.g)];
  });

  const y = r.yeast;
  if (y.mode === "solution") {
    const sol = y.solution;
    const packet = f(y.type === "dry" ? t.calc.packet_dry : t.calc.packet_fresh, { g: sol.yeast_g, cube: data.yeast.solution.fresh.cube_g.value });
    const lines = f(t.calc.solution_steps, { yeast: packet, water: sol.water_g, pct: sol.concentration_pct, take: sol.take_g }).split("\n");
    model.yeast = {
      title: t.calc.solution_title,
      steps: lines.map((l) => l.replace(/^\S+\s/, "")),
      note: f(t.calc.water_note, { take: sol.take_g, add: r.water.add_g, temp: r.water.temp_c }),
    };
  } else if (y.mode === "direct") {
    model.yeast = { title: t.calc.yeast, steps: [], note: f(t.calc.yeast_direct, { g: y.weigh_g, type: t.calc[`type_${y.type}`] }) };
  } else {
    model.yeast = { title: t.calc.yeast, steps: [], note: t.calc.yeast_none };
  }

  model.toppings = [];
  if (r.pan_oil_g != null) model.toppings.push([t.calc.pan_oil, g(r.pan_oil_g)]);
  for (const x of r.toppings) {
    let label = t.top[x.id];
    if (x.id === "cheese" && x.blend) label += ` (${x.blend.map((b) => t.top[b]).join(" + ")})`;
    if (x.optional) label += ` (${t.calc.optional})`;
    if (x.after_bake && !label.includes(t.calc.after_bake)) label += ` - ${t.calc.after_bake}`;
    model.toppings.push([label, g(x.g)]);
  }
  model.sauceRecipe = r.sauce ? r.sauce.recipe.map((i) => [t.top[i.id] + (i.optional ? ` (${t.calc.optional})` : ""), g(i.g)]) : null;
  model.layers = f(t.calc.layer_order, { order: r.bake.layer_order.map((k) => t.calc.layer[k]).join(" > ") });

  const o = r.oven;
  model.oven = [f(t.calc.oven_line, { temp: o.temp_c, rack: t.rack[o.rack], surface: o.surface.map((k) => t.surface[k]).join(" / "), pre: o.preheat_min })];
  if (o.grill) model.oven.push(f(t.calc.grill_line, { from: o.grill.last_min[0], to: o.grill.last_min[1], max: o.grill.max_min ?? o.grill.last_min[1] }));
  model.oven.push(f(t.calc.bake_line, { from: r.bake.time_min[0], to: r.bake.time_min[1], temp: r.bake.temp_c }));

  const dated = !!r.timeline[0].at;
  model.dated = dated;
  model.tlSub = dated ? f(t.calc.tl_sub, { when: fmtFull(input.bakeTime) }) : t.calc.tl_sub_rel;
  model.timeline = r.timeline.map((st) => {
    const rest = ["fridge", "rest", "ball", "pan", "take_out", "mix", "knead", "preheat", "shape"].includes(st.id) && st.duration_min > 0;
    const desc = st.id === "bake" ? f(t.calc.minutes_range, { from: r.bake.time_min[0], to: r.bake.time_min[1] }) : rest ? formatDuration(st.duration_min, t, lang) : "";
    let time;
    let small = "";
    if (dated) { time = fmtTime(st.at); small = fmtDay(st.at); }
    else if (st.offset_min === 0) time = t.calc.timeline_now;
    else { time = formatDuration(-st.offset_min, t, lang); small = t.calc.before; }
    return { time, small, title: t.timeline[st.id], desc, big: st.id === "bake" };
  });
  model.lead = f(t.calc.total_lead, { t: formatDuration(-r.timeline[0].offset_min, t, lang) });

  model.warnings = r.warnings
    .map((w) => ({ text: f(t.warn[w.id], w.params), kind: w.severity === "safety" ? "safe" : w.severity === "warning" ? "warn" : "note" }));
  return model;
}

function toText(m) {
  const out = [m.sub, m.amount, "", `${t.calc.sum_dough}: ${m.dough}`, `${t.calc.sum_flour}: ${m.flour}`, "", t.calc.ingredients];
  m.ingredients.forEach(([a, b]) => out.push(`${a}: ${b}`));
  out.push("", m.yeast.title);
  m.yeast.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
  out.push(m.yeast.note);
  if (m.toppings.length) {
    out.push("", `${t.calc.sauce} / ${t.calc.cheese} / ${t.calc.toppings}`);
    m.toppings.forEach(([a, b]) => out.push(`${a}: ${b}`));
  }
  if (m.sauceRecipe) { out.push("", t.calc.sauce_recipe); m.sauceRecipe.forEach(([a, b]) => out.push(`${a}: ${b}`)); }
  out.push(m.layers, "", t.calc.timeline, m.tlSub);
  m.timeline.forEach((e) => out.push(`${e.time}${e.small ? " " + e.small : ""}  ${e.title}${e.desc ? " (" + e.desc + ")" : ""}`));
  out.push(m.lead, "", t.calc.oven);
  m.oven.forEach((l) => out.push(`- ${l}`));
  if (m.warnings.length) { out.push("", t.calc.warnings); m.warnings.forEach((w) => out.push(`- ${w.text}`)); }
  return out.join("\n");
}

// ---- Rendering --------------------------------------------------------------

const card = (id, title, ...kids) =>
  el("section", { class: "card stack", "aria-labelledby": id }, el("h2", { id, style: "font-size:var(--fs-lg)" }, title), ...kids);

function renderResult(m) {
  const box = $("results");
  const ingTable = el("table", { class: "tbl" },
    el("caption", { class: "vh" }, t.calc.ingredients),
    el("thead", {}, el("tr", {}, el("th", { scope: "col" }, t.style.th_ing), el("th", { scope: "col", class: "num" }, t.style.th_g))),
    el("tbody", {}, m.ingredients.map(([a, b]) => el("tr", {}, el("th", { scope: "row" }, a), el("td", { class: "num" }, b)))));

  const yeast = m.yeast.steps.length
    ? el("section", { class: "ybox", "aria-labelledby": "r-y" }, el("h2", { id: "r-y" }, SVG(ICON.flask), m.yeast.title), el("ol", {}, m.yeast.steps.map((s) => el("li", {}, s))), el("p", {}, m.yeast.note))
    : card("r-y", m.yeast.title, el("p", {}, m.yeast.note));

  const dl = (rows) => el("dl", { class: "dl2" }, rows.map(([a, b]) => el("div", {}, el("dt", {}, a), el("dd", {}, b))));
  const toppingKids = [];
  if (m.toppings.length) toppingKids.push(dl(m.toppings));
  if (m.sauceRecipe) toppingKids.push(el("h3", { style: "font-size:var(--fs-base)" }, t.calc.sauce_recipe), dl(m.sauceRecipe));
  toppingKids.push(el("p", { class: "muted small" }, m.layers));

  const tl = el("ol", { class: m.dated ? "tl" : "tl rel" }, m.timeline.map((e) =>
    el("li", {},
      el("div", { class: "tm" }, e.time, e.small ? el("small", {}, e.small) : null),
      el("div", { class: "rail" }, el("span", { class: e.big ? "dot big" : "dot" })),
      el("div", { class: "tx" }, el("strong", {}, e.title), e.desc ? el("span", {}, e.desc) : null))));

  const wake = "wakeLock" in navigator
    ? el("button", { type: "button", class: "sw", role: "switch", "aria-checked": String(!!wakeLock), id: "wake", onclick: toggleWake },
        el("span", { class: "trk" }), el("span", {}, t.calc.wake, el("br"), el("span", { class: "st", id: "wake-st" }, wakeLock ? t.calc.on : t.calc.off)))
    : null;

  box.replaceChildren(
    el("div", { class: "card editbar" },
      el("span", {}, el("strong", {}, m.sub), el("br"), el("span", { class: "muted small" }, m.amount)),
      el("a", { class: "btn btn-secondary", href: "#calc-form" }, t.calc.edit_amount)),
    el("section", { class: "sum", "aria-label": t.calc.results },
      el("div", {}, el("small", {}, t.calc.sum_dough), el("div", { class: "big" }, m.dough)),
      el("div", {}, el("small", {}, t.calc.sum_flour), el("div", { class: "big" }, m.flour))),
    card("r-ing", t.calc.ingredients, ingTable),
    yeast,
    m.toppings.length || m.sauceRecipe ? card("r-top", `${t.calc.sauce} / ${t.calc.cheese} / ${t.calc.toppings}`, ...toppingKids) : null,
    card("r-tl", t.calc.timeline, el("div", {}, el("span", { class: "muted small" }, m.tlSub)), tl, el("p", { class: "muted small" }, m.lead)),
    card("r-ov", t.calc.oven, el("ul", { class: "bullets" }, m.oven.map((l) => el("li", {}, l)))),
    m.warnings.length
      ? el("section", { class: "stack", "aria-labelledby": "r-warn" }, el("h2", { id: "r-warn", style: "font-size:var(--fs-lg)" }, t.calc.warnings),
          el("div", { class: "callouts" }, m.warnings.map((w) => el("div", { class: `callout ${w.kind === "note" ? "tip" : w.kind}`, role: "note" }, SVG(ICON[w.kind]), el("div", {}, el("strong", {}, t.callout[w.kind]), w.text)))))
      : null,
    el("div", { class: "actions" },
      el("button", { type: "button", class: "btn btn-primary", id: "copy", onclick: copyText }, SVG(ICON.copy), t.calc.copy),
      el("button", { type: "button", class: "btn btn-secondary", onclick: () => window.print() }, SVG(ICON.print), t.calc.print),
      wake));
}

// ---- Copy, print, keep-awake ------------------------------------------------

let lastText = "";
async function copyText() {
  const btn = $("copy");
  try {
    await navigator.clipboard.writeText(lastText);
    btn.lastChild.textContent = t.calc.copied;
    setTimeout(() => { btn.lastChild.textContent = t.calc.copy; }, 1500);
  } catch { /* clipboard not available */ }
}

let wakeLock = null;
async function toggleWake() {
  try {
    if (wakeLock) { await wakeLock.release(); wakeLock = null; }
    else {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; syncWake(); });
    }
  } catch { wakeLock = null; }
  syncWake();
}
function syncWake() {
  const b = $("wake");
  if (!b) return;
  b.setAttribute("aria-checked", String(!!wakeLock));
  $("wake-st").textContent = wakeLock ? t.calc.on : t.calc.off;
}
// The browser releases the lock when the tab is hidden; ask for it again when the user comes back.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && $("wake")?.getAttribute("aria-checked") === "true" && !wakeLock) {
    try { wakeLock = await navigator.wakeLock.request("screen"); } catch { /* ignore */ }
  }
});

// ---- Update -----------------------------------------------------------------

function setSumbar(children) {
  $("sumbar-text").replaceChildren(...children);
}

function update() {
  const { input, error } = readInput();
  const box = $("results");
  if (error) {
    lastText = "";
    box.replaceChildren();
    $("sumbar").classList.remove("is-hidden");
    setSumbar([el("span", { class: "msg-err" }, SVG(ICON.error), t.calc.sum_none)]);
  } else {
    try {
      const r = computeRecipe(input, data);
      const m = build(r, input);
      renderResult(m);
      lastText = toText(m);
      setSumbar([`${t.calc.sum_dough} `, el("b", {}, m.dough), " · ", `${t.calc.sum_flour} `, el("b", {}, m.flour)]);
    } catch (e) {
      lastText = "";
      const code = e instanceof RangeError ? e.message : "unknown";
      box.replaceChildren(el("p", { class: "msg-err", role: "alert" }, SVG(ICON.error), t.calc.err[code] ?? f(t.calc.error, { code })));
      setSumbar([el("span", { class: "msg-err" }, SVG(ICON.error), t.calc.sum_none)]);
    }
  }
  // keep ?style= and ?method= in the address and in the language switch
  const q = new URLSearchParams({ style: $("f-style").value, method: $("f-method").value });
  history.replaceState(null, "", `?${q}`);
  document.querySelectorAll(".seg a[hreflang]").forEach((a) => { a.href = a.href.split("?")[0] + `?${q}`; });
}

// ---- Wiring -----------------------------------------------------------------

$("f-style").addEventListener("change", () => { setStyle($("f-style").value); update(); });
$("f-method").addEventListener("change", update);
$("f-bake").addEventListener("input", update);
$("calc-form").addEventListener("submit", (e) => e.preventDefault());
for (const id of ["f-count", "f-ball"]) $(id).addEventListener("input", update);

for (const b of document.querySelectorAll("[data-step]")) {
  b.addEventListener("click", () => {
    const input = $(b.dataset.for);
    const cur = parseNum(input.value);
    const next = Math.max(Number(input.dataset.min) || 1, (Number.isFinite(cur) ? cur : 0) + Number(b.dataset.step));
    input.value = String(next);
    update();
  });
}
for (const b of document.querySelectorAll("[data-yeast]")) {
  b.addEventListener("click", () => {
    state.yeast = b.dataset.yeast;
    document.querySelectorAll("[data-yeast]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    update();
  });
}
for (const b of document.querySelectorAll("[data-shape]")) {
  b.addEventListener("click", () => {
    state.shape = b.dataset.shape;
    document.querySelectorAll("[data-shape]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.querySelectorAll("[data-for-shape]").forEach((x) => { x.hidden = x.dataset.forShape !== state.shape; });
  });
}
$("custom-add").addEventListener("click", addCustomPan);
$("thick").addEventListener("click", () => {
  state.thick = !state.thick;
  setSwitch($("thick"), state.thick);
  update();
});

const params = new URLSearchParams(location.search);
setStyle(data.styles[params.get("style")] ? params.get("style") : "new_york");
if (data.methods[params.get("method")]) $("f-method").value = params.get("method");
$("sumbar").hidden = false;
// The summary bar is only useful while the recipe is out of view.
if ("IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => { $("sumbar").classList.toggle("is-hidden", entry.isIntersecting && $("results").childElementCount > 0); }).observe($("results"));
}
update();
