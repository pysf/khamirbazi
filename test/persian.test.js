// Persian digits on Farsi pages: the shared text function and the HTML transform.
import test from "node:test";
import assert from "node:assert/strict";
import { toPersianDigits, localize, interpolate } from "../src/assets/i18n.js";
import { persianizeHtml } from "../lib/persian-html.js";

test("toPersianDigits: digits and decimal points", () => {
  assert.equal(toPersianDigits("12.5"), "۱۲٫۵");
  assert.equal(toPersianDigits("روش 2 ساعته، 250 درجه"), "روش ۲ ساعته، ۲۵۰ درجه");
  assert.equal(toPersianDigits("7 g"), "۷ g");
  assert.equal(toPersianDigits("1.2.3"), "۱٫۲٫۳");
  assert.equal(toPersianDigits("0123456789"), "۰۱۲۳۴۵۶۷۸۹");
});

test("toPersianDigits: times, ranges, thousands, percent and sentence ends", () => {
  assert.equal(toPersianDigits("1:30"), "۱:۳۰");
  assert.equal(toPersianDigits("8 تا 12 ساعت، 30×40"), "۸ تا ۱۲ ساعت، ۳۰×۴۰");
  assert.equal(toPersianDigits("1,000 g"), "۱,۰۰۰ g");
  assert.equal(toPersianDigits("65.5%"), "۶۵٫۵%");
  assert.equal(toPersianDigits("این 4 بار است. بعد"), "این ۴ بار است. بعد");
  assert.equal(toPersianDigits("بار 4.\nبعد"), "بار ۴.\nبعد");
  assert.equal(toPersianDigits("نه 4.بعد"), "نه ۴.بعد");
});

test("toPersianDigits: every digit is converted, no exceptions", () => {
  assert.equal(toPersianDigits("آرد «تیپو 00» و 2 بسته"), "آرد «تیپو ۰۰» و ۲ بسته");
});

test("localize and interpolate: fa converts, en does not", () => {
  assert.equal(localize("2 pizzas", "en"), "2 pizzas");
  assert.equal(localize("2 پیتزا", "fa"), "۲ پیتزا");
  assert.equal(interpolate("{n} پیتزا، 30 سانتی‌متر", { n: 12.5 }, "fa"), "۱۲٫۵ پیتزا، ۳۰ سانتی‌متر");
  assert.equal(interpolate("{n} pizzas, 30 cm", { n: 12.5 }, "en"), "12.5 pizzas, 30 cm");
});

test("persianizeHtml: converts text and readable attributes only", () => {
  const html = `<html lang="fa" dir="rtl"><head><title>خمیر 2</title><style>.a{width:30px}</style>
<script>var x = 12.5;</script></head><body>
<a href="/fa/recipe/new_york/?size=30&pizzas=2" class="c3" id="x1" data-n="5" aria-label="تعداد 2" title="3 تا">متن 12.5 و <bdi>تیپو 00</bdi> &#8211; &amp;2</a>
<select><option value="warm_2h">2 ساعته</option></select>
<button value="12" aria-pressed="true" data-value="30">30</button>
<script type="application/json" id="recipe-data">{"n":[1,2.5],"s":"روش 2"}</script>
<code>a1</code><!-- c 5 --><input placeholder="عدد 4" value="7"></body></html>`;
  const out = persianizeHtml(html);
  assert.match(out, /<title>خمیر ۲<\/title>/);
  assert.match(out, /\.a\{width:30px\}/);
  assert.match(out, /var x = 12\.5;/);
  assert.match(out, /href="\/fa\/recipe\/new_york\/\?size=30&pizzas=2" class="c3" id="x1" data-n="5"/);
  assert.match(out, /aria-label="تعداد ۲" title="۳ تا"/);
  assert.match(out, />متن ۱۲٫۵ و <bdi>تیپو ۰۰<\/bdi> &#8211; &amp;۲</);
  assert.match(out, /<option value="warm_2h">۲ ساعته<\/option>/);
  assert.match(out, /<button value="12" aria-pressed="true" data-value="30">۳۰<\/button>/);
  assert.match(out, /\{"n":\[1,2\.5\],"s":"روش 2"\}/);
  assert.match(out, /<code>a1<\/code><!-- c 5 -->/);
  assert.match(out, /placeholder="عدد ۴" value="7"/);
  assert.match(out, /<html lang="fa" dir="rtl">/);
});
