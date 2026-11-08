// Ingredient tables for the style pages, computed from recipes.json with calc.js.
import { readFileSync } from "node:fs";
import { computeRecipe } from "../assets/calc.js";

const data = JSON.parse(readFileSync(new URL("./recipes.json", import.meta.url)));
const ROW_ORDER = ["flour", "cornmeal", "water", "yeast_solution", "salt", "sugar", "oil", "fat", "yeast_dry", "pan_oil"];

export default Object.fromEntries(
  Object.entries(data.styles).map(([styleId, style]) => {
    const methodIds = [...new Set(["warm_2h", style.default_method])];
    const mode = style.kind === "pan" ? { pans: style.default_mode.pans } : { pizzas: style.default_mode.pizzas };
    const results = methodIds.map((methodId) => computeRecipe({ styleId, methodId, yeastType: "dry", mode }, data));
    const rows = ROW_ORDER.map((id) => {
      const cells = results.map((r) => (id === "pan_oil" ? r.pan_oil_g : r.ingredients.find((i) => i.id === id)?.g ?? null));
      const optional = results.some((r) => r.ingredients.find((i) => i.id === id)?.optional);
      return { id, cells, optional };
    }).filter((row) => row.cells.some((c) => c != null));
    return [styleId, { methodIds, rows, mode, ball_g: results[0].ball_g, warnings: results.at(-1).warnings, bake: results.at(-1).bake, oven: results.at(-1).oven }];
  }),
);
