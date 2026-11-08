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
for (const k of Object.keys(en)) {
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
    // Markers stay in English in both languages: Why (under a step), Tip, Warning, Safety.
    why: count(/^\s*> Why:/gm),
    tips: count(/^\s*> Tip:/gm),
    warnings: count(/^\s*> Warning:/gm),
    safety: count(/^\s*> Safety:/gm),
    vars: [...body.matchAll(/\{\{\s*([^}|]+?)\s*(?:\|[^}]*)?\}\}/g)].map((m) => m[1]).sort().join(","),
    links: count(/\]\(/g),
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

const enDir = join(root, "src/content/en");
const faDir = join(root, "src/content/fa");
const enFiles = new Set(walk(enDir).map((p) => relative(enDir, p)));
const faFiles = new Set(walk(faDir).map((p) => relative(faDir, p)));
for (const f of enFiles) if (!faFiles.has(f)) fail(`content: ${f} exists in en but not in fa`);
for (const f of faFiles) if (!enFiles.has(f)) fail(`content: ${f} exists in fa but not in en`);
for (const [dir, files] of [[enDir, enFiles], [faDir, faFiles]])
  for (const f of files) checkMarkers(`${relative(root, dir)}/${f}`, readFileSync(join(dir, f), "utf8"));
for (const f of enFiles) {
  if (!faFiles.has(f)) continue;
  const a = shape(readFileSync(join(enDir, f), "utf8"));
  const b = shape(readFileSync(join(faDir, f), "utf8"));
  for (const k of Object.keys(a))
    if (a[k] !== b[k]) fail(`content: ${f} differs in "${k}" (en: ${a[k]} | fa: ${b[k]})`);
}

if (problems.length) {
  console.error(`Language sync check FAILED (${problems.length}):`);
  for (const p of problems) console.error(" - " + p);
  process.exit(1);
}
console.log(`Language sync OK: ${Object.keys(en).length} UI strings, ${Object.keys(recipes.styles).length} styles, ${enFiles.size} content files.`);
