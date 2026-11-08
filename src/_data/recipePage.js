// Per UI style: the data the recipe page needs in the browser (a small copy of recipes.json without notes and sources)
// and the default table (2 pizzas, 30 cm, the style's default method, dry yeast) that the page shows without JavaScript.
import { readFileSync } from "node:fs";
import { computeRecipe, yeastCard } from "../assets/calc.js";
import site from "./site.js";

const recipes = JSON.parse(readFileSync(new URL("./recipes.json", import.meta.url)));
const DROP = new Set(["note", "notes", "sources", "confidence", "verified", "unit", "mode_note"]);
const slim = (o) =>
  Array.isArray(o) ? o.map(slim) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).filter(([k]) => !DROP.has(k)).map(([k, v]) => [k, slim(v)])) : o;

export default Object.fromEntries(
  site.uiStyles.map((id) => {
    const style = recipes.styles[id];
    const size = recipes.sizes.find((s) => s.id === "round_30");
    const r = computeRecipe({ styleId: id, methodId: style.default_method, yeastType: "dry", mode: { pizzas: 2, size } }, recipes);
    const data = slim({ ...recipes, styles: { [id]: style }, sizes: undefined });
    return [id, { data, size, defaultMethod: style.default_method, dough_g: r.dough_g, ball_g: r.ball_g, yeastLines: yeastCard(r, recipes), rows: r.ingredients.map((i) => ({ id: i.id, g: i.g, optional: !!i.optional })) }];
  }),
);
