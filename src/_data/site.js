const langs = ["en", "fa"];
// Only these styles have pages and appear in the UI. The other four stay in recipes.json, the tests and the i18n names.
const uiStyles = ["new_york", "neapolitan"];

export default {
  langs,
  uiStyles,
  // one entry per language and style, used to generate the recipe pages
  recipePages: langs.flatMap((lang) => uiStyles.map((id) => ({ lang, id }))),
};
