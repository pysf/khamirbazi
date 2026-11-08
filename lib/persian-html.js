// Build step for Farsi pages: Persian digits in the visible text of the HTML (see toPersianDigits in src/assets/i18n.js).
// Authors keep writing Western digits; recipes.json, URLs and script data stay Western.
// A small tokenizer walks the HTML and converts only text nodes and a few human-readable attributes.
import { toPersianDigits } from "../src/assets/i18n.js";

const TEXT_ATTRS = new Set(["aria-label", "title", "alt", "placeholder"]);
// Elements whose content is code or data, never prose.
const RAW = new Set(["script", "style", "code", "pre", "textarea"]);
const ENTITY = /(&#?\w+;)/; // keep &#8211; and &amp; intact

const convertText = (s) => s.split(ENTITY).map((p, i) => (i % 2 ? p : toPersianDigits(p))).join("");

function convertTag(tag) {
  return tag.replace(/(\s)([^\s=/>"']+)(\s*=\s*)("[^"]*"|'[^']*')/g, (m, sp, name, eq, val) =>
    TEXT_ATTRS.has(name.toLowerCase()) ? sp + name + eq + val[0] + convertText(val.slice(1, -1)) + val[0] : m);
}

export function persianizeHtml(html) {
  const re = /<!--[\s\S]*?-->|<(?:!doctype|!DOCTYPE)[^>]*>|<\/?([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let out = "";
  let last = 0;
  let raw = null; // name of the raw element we are inside
  for (let m; (m = re.exec(html)); ) {
    const text = html.slice(last, m.index);
    out += raw ? text : convertText(text);
    last = m.index + m[0].length;
    const name = m[1]?.toLowerCase();
    const closing = m[0].startsWith("</");
    if (raw) {
      // Inside a raw element only its own closing tag matters.
      if (closing && name === raw) raw = null;
      out += m[0];
      continue;
    }
    if (!name) { out += m[0]; continue; } // comment or doctype
    out += closing ? m[0] : convertTag(m[0]);
    if (!closing && RAW.has(name) && !m[0].endsWith("/>")) raw = name;
  }
  const tail = html.slice(last);
  return out + (raw ? tail : convertText(tail));
}
