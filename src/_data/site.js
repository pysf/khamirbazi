import { readFileSync } from "node:fs";

const recipes = JSON.parse(readFileSync(new URL("./recipes.json", import.meta.url)));
const langs = ["en", "fa"];

export default {
  langs,
  // one entry per language and style, used to generate the style pages
  stylePages: langs.flatMap((lang) => Object.keys(recipes.styles).map((id) => ({ lang, id }))),
  // which flat illustration the style cards use (see the design: round, rect, square, deep) and the sauce radius for round ones
  illustrations: {
    new_york: { shape: "round", sauce: 40 },
    neapolitan: { shape: "round", sauce: 36 },
    roman_tonda: { shape: "round", sauce: 43 },
    al_taglio: { shape: "rect" },
    detroit: { shape: "square" },
    chicago: { shape: "deep" },
  },
};
