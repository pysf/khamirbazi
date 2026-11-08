// Home page: the five inputs. "Show recipe" is a link to the recipe page with the choices in the query string.
import { formatNumber } from "./calc.js";
import { localize } from "./i18n.js";

const $ = (sel, root = document) => root.querySelector(sel);
const calc = $("#calc");
const styleSel = $("#f-style");
const methodSel = $("#f-method");
const countEl = $("#f-count");
const err = $("#count-err");
const cta = $("#cta");
const minPizzas = Number(calc.dataset.minPizzas);
const labels = JSON.parse($("#method-labels").textContent);
const lang = document.documentElement.lang; // "fa" shows Persian digits; URLs and values stay Western
const state = { size: "round_30", pizzas: 2, yeast: "dry" };

// The method list depends on the style (its typical methods).
function fillMethods(wanted) {
  const opt = styleSel.selectedOptions[0];
  const ids = opt.dataset.methods.split(" ");
  const keep = ids.includes(wanted) ? wanted : opt.dataset.default;
  methodSel.replaceChildren(...ids.map((id) => {
    const o = new Option(localize(labels[id] ?? id, lang), id);
    o.selected = id === keep;
    return o;
  }));
}

function group(name, value) {
  document.querySelectorAll(`[data-group="${name}"] button`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === value)));
}

function render() {
  countEl.textContent = formatNumber(state.pizzas, lang);
  const tooFew = methodSel.value === "warm_2h" && state.pizzas < minPizzas;
  err.hidden = !tooFew;
  const q = new URLSearchParams({ method: methodSel.value, size: state.size, pizzas: state.pizzas, yeast: state.yeast });
  cta.href = `${styleSel.selectedOptions[0].dataset.url}?${q}`;
  cta.toggleAttribute("aria-disabled", tooFew);
  cta.classList.toggle("is-disabled", tooFew);
  // Keep the choices in the address so the language switch and the back button return to the same state.
  history.replaceState(null, "", `?style=${styleSel.value}&${q}`);
}

// Start from the query string (the recipe page's "Change" link brings the choices back).
const params = new URLSearchParams(location.search);
if ([...styleSel.options].some((o) => o.value === params.get("style"))) styleSel.value = params.get("style");
if ($(`[data-group="size"] [data-value="${params.get("size")}"]`)) state.size = params.get("size");
if (params.get("yeast") === "fresh") state.yeast = "fresh";
const n = Number(params.get("pizzas"));
if (Number.isInteger(n) && n >= 1 && n <= 20) state.pizzas = n;
fillMethods(params.get("method"));
group("size", state.size);
group("yeast", state.yeast);

styleSel.addEventListener("change", () => { fillMethods(methodSel.value); render(); });
methodSel.addEventListener("change", render);
calc.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const g = b.closest("[data-group]")?.dataset.group;
  if (g) { state[g] = b.dataset.value; group(g, state[g]); }
  else if (b.dataset.step) state.pizzas = Math.min(20, Math.max(1, state.pizzas + Number(b.dataset.step)));
  else return;
  render();
});
cta.addEventListener("click", (e) => { if (cta.hasAttribute("aria-disabled")) e.preventDefault(); });
render();
