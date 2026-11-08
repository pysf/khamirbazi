// Small helpers shared by the build (Eleventy filters) and the calculator page.
import { formatNumber } from "./calc.js";

const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

/** Farsi display: digits 0-9 -> ۰-۹ and a decimal point between digits -> ٫.
 *  Commas, colons, "%" and a full stop that ends a sentence are not touched. Pure text: never call it on HTML, URLs or input values. */
export function toPersianDigits(text) {
  return String(text).replace(/(\d)\.(?=\d)/g, "$1٫").replace(/\d/g, (d) => PERSIAN[d]);
}

/** Text for the page in this language: Persian digits for "fa", unchanged otherwise. */
export function localize(text, locale = "en") {
  return locale === "fa" ? toPersianDigits(text) : String(text);
}

/** Replace {name} in a UI string. Numbers are formatted for the locale, strings are used as-is. */
export function interpolate(str, params = {}, locale = "en") {
  return localize(String(str).replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in params)) return match;
    const v = params[key];
    return typeof v === "number" ? formatNumber(v, locale) : String(v);
  }), locale);
}

/** Minutes -> "2 h 10 min" using the strings t.calc.hm / m / h. */
export function formatDuration(minutes, t, locale = "en") {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return interpolate(t.calc.hm, { h, m }, locale);
  if (h > 0) return interpolate(t.calc.h, { h }, locale);
  return interpolate(t.calc.m, { m }, locale);
}
