import { readFileSync } from "node:fs";

const recipes = JSON.parse(readFileSync(new URL("./recipes.json", import.meta.url)));
const langs = ["en", "fa"];

export default {
  langs,
  // one entry per language and style, used to generate the style pages
  stylePages: langs.flatMap((lang) => Object.keys(recipes.styles).map((id) => ({ lang, id }))),
};
