import MarkdownIt from "markdown-it";
import { formatNumber } from "./src/assets/calc.js";
import { interpolate } from "./src/assets/i18n.js";
import { icon } from "./lib/icons.js";
import { contentPlugin, renderContent, splitSections } from "./lib/content.js";

export default function (eleventyConfig) {
  // calc.js, i18n.js, the page scripts, style.css and fonts are served as-is from /assets/.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Markdown content (src/content) is not a page; templates render it through the filters below.
  eleventyConfig.ignores.add("src/content/**");
  eleventyConfig.addWatchTarget("src/content/");
  const md = new MarkdownIt({ html: true }).use(contentPlugin);

  // {{ 12.34 | num(lang) }} -> "12.3"
  eleventyConfig.addFilter("num", (n, lang) => formatNumber(n, lang));
  // {{ "text with {max_c}" | fill(params, lang) }}
  eleventyConfig.addFilter("fill", (str, params, lang) => interpolate(str, params, lang));
  // {{ docs[lang].basics | md(lang) | safe }}
  eleventyConfig.addFilter("md", (text, lang) => renderContent(md, text, lang));
  // {{ docs[lang].styles[id] | recipeParts(lang, basicsUrl) }} -> [{ title, methods, main, html }] (see lib/content.js)
  eleventyConfig.addFilter("recipeParts", (text, lang, basicsUrl) =>
    splitSections(text).map((s) => ({ ...s, html: renderContent(md, s.body, lang, { basicsUrl }) })),
  );
  // {% icon "arrow", "dir-icon" %}
  eleventyConfig.addShortcode("icon", (name, extra) => icon(name, extra));

  return {
    pathPrefix: process.env.PATH_PREFIX || "/",
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk",
  };
}
