// Small helpers shared by the build (Eleventy filters) and the calculator page.
import { formatNumber } from "./calc.js";

/** Replace {name} in a UI string. Numbers are formatted for the locale, strings are used as-is. */
export function interpolate(str, params = {}, locale = "en") {
  return String(str).replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in params)) return match;
    const v = params[key];
    return typeof v === "number" ? formatNumber(v, locale) : String(v);
  });
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
