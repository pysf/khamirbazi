// Inline SVG icons from the design (24x24, stroke only). One place, used by templates ({% icon "arrow" %}) and by the Markdown renderer.
const PATHS = {
  arrow: "M5 12h14M13 6l6 6-6 6", // mirrored in RTL (class dir-icon)
  back: "M19 12H5M11 6l-6 6 6 6", // mirrored in RTL
  chev: "M6 9l6 6 6-6", // points down, never mirrored
  check: "M5 12l5 5 9-10",
  copy: "M5 15V6a2 2 0 0 1 2-2h8|M11 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z",
  print: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3",
  safe: "M8 3h8l5 5v8l-5 5H8l-5-5V8z|M12 8v5M12 16.5h.01",
  warn: "M12 3l10 18H2z|M12 10v5M12 18h.01",
  tip: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z",
  note: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 11v5M12 7.5h.01",
  error: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7v6M12 16.5h.01",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
};

/** Returns an <svg> string. `extra` is added to the class list (for example "dir-icon" for icons that flip in RTL). */
export function icon(name, extra = "") {
  const d = PATHS[name];
  if (!d) throw new Error(`unknown icon "${name}"`);
  const paths = d.split("|").map((p) => `<path d="${p}"></path>`).join("");
  return `<svg class="ic${extra ? " " + extra : ""}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}
