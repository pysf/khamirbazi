// Renders the Markdown content in src/content/<lang>/ (style bodies, basics).
// Convention (also in README.md):
//   - an ordered list is the list of steps; its items become numbered step cards;
//   - a blockquote line "> Why: ..." directly under a step becomes the expandable "Why?";
//   - "> Tip:", "> Warning:", "> Safety:" become callouts. The marker words stay in English in both languages;
//     the visible label comes from the UI strings (en.json / fa.json);
//   - {{ path.to.value }} is replaced by a value from recipes.json (numbers are formatted for the language).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { icon } from "./icons.js";
import { formatNumber } from "../src/assets/calc.js";

const root = new URL("..", import.meta.url).pathname;
const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
let recipesCache;
const strings = {};

export const MARKERS = ["Why", "Tip", "Warning", "Safety"];
const MARKER_RE = new RegExp(`^(${MARKERS.join("|")}):\\s*`);
// marker -> CSS class, icon name and label key (strings.callout.*) share one short name
const CALLOUT = { tip: "tip", warning: "warn", safety: "safe" };

/** Replace {{ a.b.c }} with a value from recipes.json. A missing path stops the build. */
export function fillVars(text, lang, recipes = (recipesCache ??= readJson("src/_data/recipes.json"))) {
  return text.replace(/\{\{\s*([\w.]+)\s*(?:\|[^}]*)?\}\}/g, (match, path) => {
    const v = path.split(".").reduce((o, k) => (o == null ? o : o[k]), { recipes });
    if (v == null || typeof v === "object") throw new Error(`content variable "${path}" not found in recipes.json`);
    return typeof v === "number" ? formatNumber(v, lang) : String(v);
  });
}

/** markdown-it plugin: steps, Why details and callouts. */
export function contentPlugin(md) {
  md.core.ruler.push("khamirbazi_blocks", (state) => {
    const tokens = state.tokens;
    const listStack = [];
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (tk.type === "ordered_list_open") { listStack.push("ol"); tk.attrJoin("class", "steps"); }
      else if (tk.type === "bullet_list_open") { listStack.push("ul"); tk.attrJoin("class", "bullets"); }
      else if (tk.type === "ordered_list_close" || tk.type === "bullet_list_close") listStack.pop();
      else if (tk.type === "list_item_open" || tk.type === "list_item_close") {
        if (listStack.at(-1) === "ol") tk.meta = { step: true };
        // The first paragraph of a step is the action text.
        if (tk.type === "list_item_open" && listStack.at(-1) === "ol" && tokens[i + 1]?.type === "paragraph_open") {
          tokens[i + 1].hidden = false;
          tokens[i + 1].attrJoin("class", "act");
          let j = i + 2;
          while (tokens[j] && tokens[j].type !== "paragraph_close") j++;
          if (tokens[j]) tokens[j].hidden = false;
        }
      } else if (tk.type === "blockquote_open") {
        const inline = tokens[i + 2];
        const m = inline?.type === "inline" ? inline.content.match(MARKER_RE) : null;
        if (!m) continue;
        const kind = m[1].toLowerCase();
        inline.content = inline.content.slice(m[0].length);
        const first = inline.children?.[0];
        if (first?.type === "text") first.content = first.content.replace(MARKER_RE, "");
        tk.meta = { kind };
        let j = i + 1;
        while (tokens[j] && !(tokens[j].type === "blockquote_close" && tokens[j].level === tk.level)) j++;
        if (tokens[j]) tokens[j].meta = { kind };
      }
    }
  });

  const wrap = (tokens, idx) => tokens[idx].meta?.step;
  md.renderer.rules.list_item_open = (tokens, idx) => (wrap(tokens, idx) ? "<li><div>" : "<li>");
  md.renderer.rules.list_item_close = (tokens, idx) => (wrap(tokens, idx) ? "</div></li>\n" : "</li>\n");

  const defaultOpen = md.renderer.rules.blockquote_open;
  const defaultClose = md.renderer.rules.blockquote_close;
  md.renderer.rules.blockquote_open = (tokens, idx, options, env, self) => {
    const kind = tokens[idx].meta?.kind;
    if (!kind) return defaultOpen ? defaultOpen(tokens, idx, options, env, self) : "<blockquote>\n";
    const t = env.strings;
    if (kind === "why") return `<details class="why"><summary>${t.style.why}${icon("chev", "chev")}</summary>\n`;
    const c = CALLOUT[kind];
    return `<div class="callout ${c}" role="note">${icon(c)}<div><strong>${t.callout[c]}</strong>\n`;
  };
  md.renderer.rules.blockquote_close = (tokens, idx, options, env, self) => {
    const kind = tokens[idx].meta?.kind;
    if (!kind) return defaultClose ? defaultClose(tokens, idx, options, env, self) : "</blockquote>\n";
    return kind === "why" ? "</details>\n" : "</div></div>\n";
  };
}

/** Render one content file. `md` is a markdown-it instance that already uses contentPlugin. */
export function renderContent(md, text, lang) {
  const t = (strings[lang] ??= readJson(`src/_data/i18n/${lang}.json`));
  return md.render(fillVars(text, lang), { strings: t, lang });
}

/** All Markdown under src/content/<lang>/ as { en: { styles: { new_york: "..." }, basics: "..." }, fa: {...} }. Front matter is dropped. */
export function loadContent() {
  const out = {};
  for (const lang of ["en", "fa"]) {
    out[lang] = {};
    const walk = (dir, target) => {
      if (!existsSync(dir)) return;
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p, (target[f] = {}));
        else if (f.endsWith(".md")) target[f.slice(0, -3)] = readFileSync(p, "utf8").replace(/^---\n[\s\S]*?\n---\n?/, "");
      }
    };
    walk(join(root, "src/content", lang), out[lang]);
  }
  return out;
}
