// Recipe page: reads the choices from the query string (method, size, pizzas, yeast), computes the ingredients with
// calc.js in the browser and shows only the steps of the chosen method. Without JavaScript the page shows the
// defaults rendered at build time.
import { computeRecipe, formatNumber } from "./calc.js";
import { interpolate, localize } from "./i18n.js";

const { styleId, lang, data, sizes, strings: t } = JSON.parse(document.getElementById("recipe-data").textContent);
const style = data.styles[styleId];
const q = new URLSearchParams(location.search);
const pick = (key, allowed, fallback) => (allowed.includes(q.get(key)) ? q.get(key) : fallback);

const methodId = pick("method", Object.keys(data.methods), style.default_method);
const size = sizes.find((s) => s.id === q.get("size")) ?? sizes.find((s) => s.id === "round_30");
const yeastType = pick("yeast", ["dry", "fresh"], "dry");
const n = Number(q.get("pizzas"));
const pizzas = Number.isInteger(n) && n >= 1 && n <= 20 ? n : 2;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const fill = (str, params) => interpolate(str, params, lang);

function render() {
  const r = computeRecipe({ styleId, methodId, yeastType, mode: { pizzas, size } }, data);

  document.getElementById("ing-body").innerHTML = r.ingredients
    .map((i) => `<tr><th scope="row">${esc(localize(t.ing[i.id], lang))}${i.optional ? ` <span class="opt">(${esc(localize(t.recipe.optional, lang))})</span>` : ""}</th><td class="num">${formatNumber(i.g, lang)}</td></tr>`)
    .join("");
  document.getElementById("dough-total").textContent = fill(t.recipe.dough_total, { g: r.dough_g });

  // The two warnings that change the table: too few pizzas for the warm method, or a batch too small to weigh the yeast.
  document.getElementById("ing-warn").innerHTML = r.warnings
    .filter((w) => w.id === "min_batch" || w.id === "batch_too_small")
    .map((w) => `<div class="callout warn" role="note"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"></path><path d="M12 10v5M12 18h.01"></path></svg><div><p>${esc(fill(t.warn[w.id], w.params))}</p></div></div>`)
    .join("");

  const sizeText = fill(t.recipe.size_round, { d: size.diameter });
  const count = fill(t.recipe[`pizza_${pizzas === 1 ? "one" : "other"}`], { n: pizzas });
  document.getElementById("pills").innerHTML = [sizeText, count, localize(t.methods_short[methodId], lang), localize(t.ing[`yeast_${yeastType}`], lang)]
    .map((x) => `<span class="pill">${esc(x)}</span>`).join("");
}

// Only the steps (and checklists) of the chosen method.
document.querySelectorAll("[data-method-section]").forEach((el) => {
  el.hidden = !el.dataset.methodSection.split(" ").includes(methodId);
});

// "Change" goes back to the Home page with the same choices.
const change = document.getElementById("change");
const home = new URLSearchParams({ style: styleId, method: methodId, size: size.id, pizzas, yeast: yeastType });
change.href = `${change.getAttribute("href")}?${home}`;

try {
  render();
} catch (e) {
  console.error(e); // the default table from the build stays
}
