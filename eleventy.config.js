import { formatNumber } from "./src/assets/calc.js";
import { interpolate } from "./src/assets/i18n.js";

export default function (eleventyConfig) {
  // calc.js, calculator-page.js, i18n.js and style.css are served as-is from /assets/.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // {{ 12.34 | num(lang) }} -> "12.3" (or Persian digits for fa)
  eleventyConfig.addFilter("num", (n, lang) => formatNumber(n, lang));
  // {{ "text with {max_c}" | fill(params, lang) }}
  eleventyConfig.addFilter("fill", (str, params, lang) => interpolate(str, params, lang));

  return {
    pathPrefix: process.env.PATH_PREFIX || "/",
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk",
  };
}
