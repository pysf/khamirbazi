// Ingredient tables for the style pages, computed from recipes.json with calc.js.
import { readFileSync } from "node:fs";
import { computeRecipe } from "../assets/calc.js";

const data = JSON.parse(readFileSync(new URL("./recipes.json", import.meta.url)));
const ROW_ORDER = ["flour", "cornmeal", "water", "yeast_solution", "salt", "sugar", "oil", "fat", "yeast_dry", "pan_oil"];

export default Object.fromEntries(
  Object.entries(data.styles).map(([styleId, style]) => {
    // every typical method of the style, default first in the data order; the page switches between them
    const methodIds = [...new Set([...style.methods_typical, style.default_method])].sort(
      (a, b) => Object.keys(data.methods).indexOf(a) - Object.keys(data.methods).indexOf(b),
    );
    const mode = style.kind === "pan" ? { pans: style.default_mode.pans } : { pizzas: style.default_mode.pizzas };
    const results = methodIds.map((methodId) => computeRecipe({ styleId, methodId, yeastType: "dry", mode }, data));
    const main = results[methodIds.indexOf(style.default_method)];
    const rows = ROW_ORDER.map((id) => {
      const cells = results.map((r) => (id === "pan_oil" ? r.pan_oil_g : r.ingredients.find((i) => i.id === id)?.g ?? null));
      const optional = results.some((r) => r.ingredients.find((i) => i.id === id)?.optional);
      return { id, cells, optional };
    }).filter((row) => row.cells.some((c) => c != null));
    return [styleId, { methodIds, rows, mode, ball_g: main.ball_g, warnings: main.warnings, bake: main.bake, oven: main.oven }];
  }),
);
