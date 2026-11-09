// Tests for the Markdown content convention (lib/content.js). The sample below is a test fixture only,
// not recipe content: it shows the steps / Why / callout syntax.
import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import MarkdownIt from "markdown-it";
import { contentPlugin, renderContent, fillVars, splitSections } from "../lib/content.js";

const md = new MarkdownIt({ html: true }).use(contentPlugin);

const SAMPLE = `## Steps

1. First sample step.
   > Why: Sample reason for the first step.
2. Second sample step.

> Tip: Sample tip.

> Warning: Sample warning.

> Safety: Sample safety note with {{ recipes.safety.parchment_max_c.value }} degrees.

## Troubleshooting

- **Sample problem.** Sample answer.
`;

test("steps become steps and Why becomes a visible note", () => {
  const html = renderContent(md, SAMPLE, "en");
  assert.match(html, /<ol class="steps">/);
  assert.equal((html.match(/<li><div class="sb">/g) || []).length, 2);
  assert.match(html, /<p class="act">First sample step\.<\/p>/);
  assert.match(html, /<div class="why">\s*<p>Sample reason/);
  assert.match(html, /Sample reason for the first step\./);
  assert.doesNotMatch(html, /<button|<details/);
});

test("a bold first phrase is the action of the step", () => {
  const html = renderContent(md, "1. **Do this.** Then that.\n2. Plain step.", "en");
  assert.match(html, /<p class="act lead"><strong>Do this\.<\/strong> Then that\.<\/p>/);
  assert.match(html, /<p class="act">Plain step\.<\/p>/);
});

test("Tip, Warning and Safety become callouts with a translated label", () => {
  const en = renderContent(md, SAMPLE, "en");
  assert.match(en, /<div class="callout tip" role="note">.*<strong>Tip<\/strong>/s);
  assert.match(en, /<div class="callout warn" role="note">.*<strong>Careful<\/strong>/s);
  assert.match(en, /<div class="callout safe" role="note">.*<strong>Safety<\/strong>/s);
  const fa = renderContent(md, SAMPLE, "fa");
  assert.match(fa, /<strong>نکته<\/strong>/);
  assert.doesNotMatch(fa, /why-l/);
  assert.doesNotMatch(en, /Tip:|Warning:|Safety:|Why:/);
});

test("bullets get the bullets class and markers are removed from the text", () => {
  const html = renderContent(md, SAMPLE, "en");
  assert.match(html, /<ul class="bullets">/);
  assert.match(html, /<strong>Sample problem\.<\/strong>/);
});

test("{{ path }} comes from recipes.json and is formatted per language", () => {
  assert.equal(fillVars("{{ recipes.safety.parchment_max_c.value }}", "en"), "220");
  assert.equal(fillVars("x {{ recipes.styles.neapolitan.dough.hydration.value }} y", "fa"), "x ۶۱٫۷ y");
  assert.throws(() => fillVars("{{ recipes.nope.value }}", "en"), /not found/);
});

test("a plain blockquote stays a blockquote", () => {
  assert.match(renderContent(md, "> Just a quote.", "en"), /<blockquote>/);
});

test("splitSections: method sections with a step list are the main steps, everything else is More details", () => {
  const text = `## Intro\n\nSome text.\n\n## Warm method {methods=warm_2h}\n\n1. **Mix.** Mix it.\n\n## Cold {methods=cold_24h,cold_48h}\n\n1. One.\n\n## Checklist {methods=warm_2h}\n\n- A bullet.\n\n## Kneading\n\n1. Knead.\n`;
  const parts = splitSections(text);
  assert.deepEqual(parts.map((p) => [p.title, p.methods, p.main]), [
    ["Intro", null, false],
    ["Warm method", ["warm_2h"], true],
    ["Cold", ["cold_24h", "cold_48h"], true],
    ["Checklist", ["warm_2h"], false], // method-specific, but no steps: shown in More details
    ["Kneading", null, false], // steps, but not for a method: More details
  ]);
  assert.match(parts[1].body, /^\n1\. \*\*Mix\./);
});

test("the New York content has a main step section for every typical method", () => {
  const nyEn = readFileSync(new URL("../src/content/en/styles/new_york.md", import.meta.url), "utf8");
  const main = splitSections(nyEn).filter((p) => p.main).flatMap((p) => p.methods);
  for (const m of ["warm_2h", "cold_12_16h", "cold_24h", "cold_48h", "cold_72h"]) assert.ok(main.includes(m), m);
});

test("the recipe page table ends with the total dough row, equal to the sum of the ingredients", async () => {
  const { default: recipePage } = await import("../src/_data/recipePage.js");
  for (const page of Object.values(recipePage)) {
    const sum = page.rows.reduce((s, r) => s + r.g, 0);
    assert.ok(Math.abs(sum - page.dough_g) < 1e-6);
  }
  const njk = readFileSync(new URL("../src/recipe.njk", import.meta.url), "utf8");
  const body = njk.slice(njk.indexOf('id="ing-body"'), njk.indexOf("</tbody>"));
  assert.ok(body.trimEnd().endsWith('<td class="num">{{ page_data.dough_g | num(lang) }}</td><td></td></tr>'), "total is the last row");
});
