// Tests for the Markdown content convention (lib/content.js). The sample below is a test fixture only,
// not recipe content: it shows the steps / Why / callout syntax.
import test from "node:test";
import assert from "node:assert/strict";
import MarkdownIt from "markdown-it";
import { contentPlugin, renderContent, fillVars } from "../lib/content.js";

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

test("steps become step cards and Why becomes an expandable details", () => {
  const html = renderContent(md, SAMPLE, "en");
  assert.match(html, /<ol class="steps">/);
  assert.equal((html.match(/<li><div>/g) || []).length, 2);
  assert.match(html, /<p class="act">First sample step\.<\/p>/);
  assert.match(html, /<details class="why"><summary>Why\?/);
  assert.match(html, /Sample reason for the first step\./);
  assert.equal((html.match(/<details/g) || []).length, 1);
});

test("Tip, Warning and Safety become callouts with a translated label", () => {
  const en = renderContent(md, SAMPLE, "en");
  assert.match(en, /<div class="callout tip" role="note">.*<strong>Tip<\/strong>/s);
  assert.match(en, /<div class="callout warn" role="note">.*<strong>Careful<\/strong>/s);
  assert.match(en, /<div class="callout safe" role="note">.*<strong>Safety<\/strong>/s);
  const fa = renderContent(md, SAMPLE, "fa");
  assert.match(fa, /<strong>نکته<\/strong>/);
  assert.match(fa, /<summary>چرا؟/);
  assert.doesNotMatch(en, /Tip:|Warning:|Safety:|Why:/);
});

test("bullets get the bullets class and markers are removed from the text", () => {
  const html = renderContent(md, SAMPLE, "en");
  assert.match(html, /<ul class="bullets">/);
  assert.match(html, /<strong>Sample problem\.<\/strong>/);
});

test("{{ path }} comes from recipes.json and is formatted per language", () => {
  assert.equal(fillVars("{{ recipes.safety.parchment_max_c.value }}", "en"), "220");
  assert.equal(fillVars("x {{ recipes.styles.neapolitan.dough.hydration.value }} y", "fa"), "x 61.7 y");
  assert.throws(() => fillVars("{{ recipes.nope.value }}", "en"), /not found/);
});

test("a plain blockquote stays a blockquote", () => {
  assert.match(renderContent(md, "> Just a quote.", "en"), /<blockquote>/);
});
