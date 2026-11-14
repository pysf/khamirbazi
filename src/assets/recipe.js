// Recipe page: reads the choices from the query string (method, size, pizzas, yeast), computes the ingredients with
// calc.js in the browser and shows only the steps of the chosen method. Without JavaScript the page shows the
// defaults rendered at build time.
import { computeRecipe, formatNumber, householdMeasure, yeastCard } from "./calc.js";
import { formatMeasure, interpolate, localize } from "./i18n.js";

const { styleId, lang, data, sizes, strings: t } = JSON.parse(document.getElementById("recipe-data").textContent);
const style = data.styles[styleId];
const q = new URLSearchParams(location.search);
const pick = (key, allowed, fallback) => (allowed.includes(q.get(key)) ? q.get(key) : fallback);

const methodId = pick("method", Object.keys(data.methods), style.default_method);
const size = sizes.find((s) => s.id === q.get("size")) ?? sizes.find((s) => s.id === "round_30");
const yeastType = pick("yeast", ["dry", "fresh"], "dry");
const n = Number(q.get("pizzas"));
const pizzas = Number.isInteger(n) && n >= 1 && n <= data.max_pizzas.value ? n : 2;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const fill = (str, params) => interpolate(str, params, lang);

const WARN_ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"></path><path d="M12 10v5M12 18h.01"></path></svg>';
// Same markup as the build-time version in recipe.njk.
function yeastHtml(l) {
  if (l.group === "warn") return `<div class="callout warn" role="note">${WARN_ICON}<div><p>${esc(fill(t.warn[l.key], l.params))}</p></div></div>`;
  return `<p class="ynote">${esc(fill(t.card[l.key], l.params))}</p>`;
}

function render() {
  const r = computeRecipe({ styleId, methodId, yeastType, mode: { pizzas, size } }, data);

  document.getElementById("ing-body").innerHTML = r.ingredients
    .map((i) => `<tr><th scope="row">${esc(localize(t.ing[i.id], lang))}${i.optional ? ` <span class="opt">(${esc(localize(t.recipe.optional, lang))})</span>` : ""}</th><td class="num">${formatNumber(i.g, lang)}</td><td class="msr">${esc(formatMeasure(householdMeasure(i.id, i.g, data), t.measure, lang))}</td></tr>`)
    .join("") + `<tr class="total"><th scope="row">${esc(localize(t.recipe.dough_total, lang))}</th><td class="num">${formatNumber(r.dough_g, lang)}</td><td></td></tr>`;

  // The warnings that replace the yeast amount, and the 1 g scale note (from calc.js).
  document.getElementById("ing-yeast").innerHTML = yeastCard(r, data).map(yeastHtml).join("");

  const sizeText = fill(t.recipe.size_round, { d: size.diameter });
  const count = fill(t.recipe[`pizza_${pizzas === 1 ? "one" : "other"}`], { n: pizzas });
  document.getElementById("pills").innerHTML = [sizeText, count, localize(t.methods_short[methodId], lang), localize(t.ing[`yeast_${yeastType}`], lang)]
    .map((x) => `<span class="pill">${esc(x)}</span>`).join("");
}

// Only the steps (and checklists) of the chosen method.
document.querySelectorAll("[data-method-section]").forEach((el) => {
  el.hidden = !el.dataset.methodSection.split(" ").includes(methodId);
});

// A link to "#id" in "More details" opens the folded section that holds the target, then scrolls to it.
function openTarget() {
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (!el) return;
  for (let d = el.closest("details"); d; d = d.parentElement.closest("details")) d.open = true;
  el.scrollIntoView();
}
addEventListener("hashchange", openTarget);
// A second click on the same link does not change the hash, so open the target on every click too.
document.addEventListener("click", (e) => { if (e.target.closest('a[href^="#"]')) setTimeout(openTarget); });
openTarget();

// "Change" goes back to the Home page with the same choices.
const change = document.getElementById("change");
const home = new URLSearchParams({ style: styleId, method: methodId, size: size.id, pizzas, yeast: yeastType });
change.href = `${change.getAttribute("href")}?${home}`;

try {
  render();
} catch (e) {
  console.error(e); // the default table from the build stays
}
