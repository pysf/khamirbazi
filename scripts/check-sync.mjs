// Fails (exit 1) when English and Farsi content drift apart.
// Checks: UI strings (same keys, same {placeholders}), every recipe style and
// method has names in both languages, and Markdown content in src/content/en
// and src/content/fa (same files, same structure, same template variables).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const problems = [];
const fail = (msg) => problems.push(msg);

const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

// 1. UI strings: same key tree and same {placeholders} per string.
function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}
const placeholders = (s) =>
  [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

const en = flatten(readJson("src/_data/i18n/en.json"));
const fa = flatten(readJson("src/_data/i18n/fa.json"));
// "latin" (the Latin name of a style) exists only in English; Farsi pages show no Latin names.
const ENGLISH_ONLY = /\.latin$/;
for (const k of Object.keys(en)) {
  if (ENGLISH_ONLY.test(k)) continue;
  if (!(k in fa)) fail(`i18n: key "${k}" is in en.json but missing in fa.json`);
  else if (placeholders(en[k]) !== placeholders(fa[k]))
    fail(`i18n: key "${k}" has different {placeholders} in en and fa`);
}
for (const k of Object.keys(fa)) if (!(k in en)) fail(`i18n: key "${k}" is in fa.json but missing in en.json`);

// 2. Every style and method in recipes.json is named in both languages.
const recipes = readJson("src/_data/recipes.json");
for (const lang of ["en", "fa"]) {
  const t = readJson(`src/_data/i18n/${lang}.json`);
  for (const id of Object.keys(recipes.styles))
    if (!t.styles?.[id]?.name) fail(`recipes: style "${id}" has no name in ${lang}.json`);
  for (const id of Object.keys(recipes.methods))
    if (!t.methods?.[id]) fail(`recipes: method "${id}" has no name in ${lang}.json`);
}

// 3. Markdown content: same files, same structure, same template variables.
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}
function walkFiles(dir, exts) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (f === "assets" || f === "content" ? [] : walkFiles(p, exts)) : exts.some((e) => p.endsWith(e)) ? [p] : [];
  });
}
function shape(text) {
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  const body = fm ? text.slice(fm[0].length) : text;
  const frontKeys = fm ? [...fm[1].matchAll(/^([\w-]+):/gm)].map((m) => m[1]).sort().join(",") : "";
  const count = (re) => (body.match(re) || []).length;
  return {
    frontKeys,
    headings: [1, 2, 3, 4].map((n) => count(new RegExp(`^#{${n}} `, "gm"))).join("/"),
    steps: count(/^\d+\. /gm),
    bullets: count(/^\s*[-*] /gm),
    substeps: count(/^\s+\d+\. /gm),
    // Markers stay in English in both languages: Why (under a step), Tip, Warning, Safety.
    why: count(/^\s*> Why:/gm),
    tips: count(/^\s*> Tip:/gm),
    warnings: count(/^\s*> Warning:/gm),
    safety: count(/^\s*> Safety:/gm),
    vars: [...body.matchAll(/\{\{\s*([^}|]+?)\s*(?:\|[^}]*)?\}\}/g)].map((m) => m[1]).sort().join(","),
    links: count(/\]\(/g),
    // "## Heading {#id}" gives a section an id for links; both languages use the same ids.
    ids: [...body.matchAll(/^#+ .*\{#([\w-]+)\}\s*$/gm)].map((m) => m[1]).join(","),
    // "## Heading {methods=a,b}" marks the main step list of those methods: same markers, same order in both languages
    methodSections: [...body.matchAll(/^## .*\{methods=([\w,]+)\}\s*$/gm)].map((m) => m[1]).join(";"),
  };
}
// A blockquote must start with a known marker; later lines of the same quote may continue it.
function checkMarkers(file, text) {
  const body = text.replace(/^---\n[\s\S]*?\n---/, "");
  let inQuote = false;
  body.split("\n").forEach((line, i) => {
    const q = line.match(/^\s*>\s?(.*)$/);
    if (q && !inQuote && !/^(Why|Tip|Warning|Safety): /.test(q[1])) fail(`content: ${file} line ${i + 1}: a blockquote must start with "Why:", "Tip:", "Warning:" or "Safety:"`);
    inQuote = !!q;
  });
  // "Why:" belongs under a step (an indented quote after a numbered item)
  if (/^> Why:/m.test(body)) fail(`content: ${file}: "> Why:" must be indented under a numbered step`);
}

// A bold step title (the bold lead-in of a numbered step) has no full stop at the end: "**Bake the pizza** detail".
// "?", "!" and ":" are fine. English uses ".", Farsi may also use the Urdu-style "\u06D4".
function checkStepTitles(file, text) {
  const body = text.replace(/^---\n[\s\S]*?\n---/, "");
  body.split("\n").forEach((line, i) => {
    const m = line.match(/^\s*\d+\. \*\*((?:(?!\*\*).)+?)\*\*/);
    if (m && /[.\u06D4]$/.test(m[1].trim())) fail(`content: ${file} line ${i + 1}: step title "${m[1]}" must not end with a full stop`);
    // "##" section headings are read before the template runs, so a {{ variable }} there prints raw.
    if (/^## .*\{\{/.test(line)) fail(`content: ${file} line ${i + 1}: no {{ variables }} in a heading`);
  });
}

const enDir = join(root, "src/content/en");
const faDir = join(root, "src/content/fa");
const enFiles = new Set(walk(enDir).map((p) => relative(enDir, p)));
const faFiles = new Set(walk(faDir).map((p) => relative(faDir, p)));
for (const f of enFiles) if (!faFiles.has(f)) fail(`content: ${f} exists in en but not in fa`);
for (const f of faFiles) if (!enFiles.has(f)) fail(`content: ${f} exists in fa but not in en`);
for (const [dir, files] of [[enDir, enFiles], [faDir, faFiles]])
  for (const f of files) {
    checkMarkers(`${relative(root, dir)}/${f}`, readFileSync(join(dir, f), "utf8"));
    checkStepTitles(`${relative(root, dir)}/${f}`, readFileSync(join(dir, f), "utf8"));
  }
for (const f of enFiles) {
  if (!faFiles.has(f)) continue;
  const a = shape(readFileSync(join(enDir, f), "utf8"));
  const b = shape(readFileSync(join(faDir, f), "utf8"));
  for (const k of Object.keys(a))
    if (a[k] !== b[k]) fail(`content: ${f} differs in "${k}" (en: ${a[k]} | fa: ${b[k]})`);
}

// Every link to a section id ("#id", "/en/recipe/<style>/#id", "/en/basics/#id") must point at a "{#id}" heading of that page.
for (const [lang, dir, files] of [["en", enDir, enFiles], ["fa", faDir, faFiles]]) {
  const idsOf = (f) => (files.has(f) ? [...readFileSync(join(dir, f), "utf8").matchAll(/^#+ .*\{#([\w-]+)\}\s*$/gm)].map((m) => m[1]) : []);
  for (const f of files)
    for (const m of readFileSync(join(dir, f), "utf8").matchAll(/\]\(([^)\s]*)#([\w-]+)\)/g)) {
      const [, path, id] = m;
      const page = path === "" ? f : path.match(new RegExp(`^/${lang}/recipe/(\\w+)/$`)) ? `styles/${path.split("/")[3]}.md` : path === `/${lang}/basics/` ? "basics.md" : null;
      if (!page) fail(`content: ${lang}/${f}: link "${path}#${id}" must point to /${lang}/recipe/<style>/ or /${lang}/basics/`);
      else if (!idsOf(page).includes(id)) fail(`content: ${lang}/${f}: link "${path}#${id}" has no "{#${id}}" heading in ${page}`);
    }
}

// 4. Farsi sources use Western digits (0-9). The build turns them into Persian digits (lib/persian-html.js).
// Arabic-Indic (٠-٩) or already-converted (۰-۹) digits in a source would be wrong, or break the step counting above.
const digitFiles = [...faFiles].map((f) => join(faDir, f)).concat(join(root, "src/_data/i18n/fa.json"));
for (const p of digitFiles)
  if (/[\u0660-\u0669\u06F0-\u06F9]/.test(readFileSync(p, "utf8"))) fail(`digits: ${relative(root, p)} contains Arabic-Indic or Persian digits; write 0-9 and let the build convert them`);

// 5. Published text names no stores, brands, countries or local-language product terms (see CLAUDE.md, Writing rules).
// Scans the Markdown content, both UI string files, the templates and the fields of recipes.json that pages can show
// (notes, sources and the like are citations and are not rendered, so they are skipped).
const BANNED = [
  "REWE", "Edeka", "dm", "dmBio", "Aldi", "Lidl", "Kaufland", "Oetker", "Toppits", "Alnatura", "Wieninger",
  "Profissimo", "Friessinger", "Caputo", "IKEA", "Germany", "German", "Deutsch", "Berlin",
  "Pizzamehl", "Trockenhefe", "Frischhefe", "Backpapier", "Unterhitze", "Umluft", "Eiwei\u00df", "Hartweizengrie\u00df", "Backblech", "Auflaufform", "Maismehl",
];
const BANNED_RE = new RegExp(`(?<![\\p{L}])(${BANNED.map((w) => w).join("|")})(?![\\p{L}])`, "iu");
const NOT_RENDERED = new Set(["note", "notes", "sources", "confidence", "verified", "unit", "mode_note"]);
function rendered(o, path = "") {
  if (typeof o === "string") return [[path, o]];
  if (!o || typeof o !== "object") return [];
  return Object.entries(o).flatMap(([k, v]) => (NOT_RENDERED.has(k) ? [] : rendered(v, `${path}/${k}`)));
}
const scanned = [
  ...[...enFiles].map((f) => [join(enDir, f), readFileSync(join(enDir, f), "utf8")]),
  ...[...faFiles].map((f) => [join(faDir, f), readFileSync(join(faDir, f), "utf8")]),
  ...["en", "fa"].map((l) => [join(root, `src/_data/i18n/${l}.json`), readFileSync(join(root, `src/_data/i18n/${l}.json`), "utf8")]),
  ...walkFiles(join(root, "src"), [".njk"]).map((p) => [p, readFileSync(p, "utf8")]),
  ...rendered(recipes).map(([k, v]) => [`recipes.json${k}`, v]),
];
for (const [where, text] of scanned) {
  const m = text.match(BANNED_RE);
  if (m) fail(`banned word "${m[1]}" in ${where.startsWith(root) ? relative(root, where) : where}`);
}

// 6. Farsi pages contain no Latin words (CLAUDE.md, Farsi writing rules). Proper names are written in Persian script.
// Not checked: template syntax, {placeholders}, {methods=...} markers, the blockquote marker words, URLs and "(#id)" link targets.
// ALLOW holds the only exceptions; the "EN"/"FA" language-switch codes live in the layout template, not in these sources.
const ALLOW = new Set([]);
function latinWords(line) {
  const s = line
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/\{methods=[\w,]+\}/g, " ")
    .replace(/\{#[\w-]+\}/g, " ")
    .replace(/\{\w+\}/g, " ")
    .replace(/^(\s*>\s*)(Why|Tip|Warning|Safety):/, "$1")
    .replace(/(https?:\/\/|\/)[^\s)"]*/g, " ")
    .replace(/\]\(#[\w-]+\)/g, "] ");
  return (s.match(/[A-Za-z][A-Za-z'\u2019-]*/g) || []).filter((w) => !ALLOW.has(w));
}
function checkLatin(file, lines) {
  lines.forEach((line, i) => {
    for (const w of latinWords(line)) fail(`latin: ${file} line ${i + 1}: "${w}" (write it in Persian script)`);
  });
}
for (const f of faFiles) {
  const text = readFileSync(join(faDir, f), "utf8").replace(/^---\n[\s\S]*?\n---/, (m) => m.replace(/[^\n]/g, ""));
  checkLatin(`src/content/fa/${f}`, text.split("\n"));
}
// fa.json: check the values only (keys are identifiers). Line numbers come from the raw file.
{
  const raw = readFileSync(join(root, "src/_data/i18n/fa.json"), "utf8").split("\n");
  raw.forEach((line, i) => {
    const m = line.match(/^\s*"([^"]+)":\s*"(.*)",?\s*$/);
    if (m && !["lang", "dir"].includes(m[1])) // "lang" and "dir" are the HTML attribute values
      for (const w of latinWords(m[2])) fail(`latin: src/_data/i18n/fa.json line ${i + 1}: "${w}" (write it in Persian script)`);
  });
}

if (problems.length) {
  console.error(`Language sync check FAILED (${problems.length}):`);
  for (const p of problems) console.error(" - " + p);
  process.exit(1);
}
console.log(`Language sync OK: ${Object.keys(en).length} UI strings, ${Object.keys(recipes.styles).length} styles, ${enFiles.size} content files.`);
