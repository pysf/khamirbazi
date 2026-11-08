// Small helpers for every page: theme toggle, ingredient-table method tabs, expanded "Why?" when printing.
const root = document.documentElement;

// Theme: the head script already set data-theme; the button flips it and remembers the choice (if storage works).
document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch { /* storage blocked: the choice just is not remembered */ }
});

// Style page: show one method's column of the ingredient table at a time.
const tabs = document.querySelector("[data-method-tabs]");
const table = document.querySelector("[data-method-table]");
if (tabs && table) {
  const calcLink = document.querySelector("[data-calc-link]");
  const show = (method) => {
    tabs.querySelectorAll("[data-method]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.method === method)));
    table.querySelectorAll("[data-m]").forEach((c) => { c.hidden = c.dataset.m !== method; });
    // Sections that belong to some methods only (style content: "## Heading {methods=a,b}").
    document.querySelectorAll("[data-method-section]").forEach((sec) => { sec.hidden = !sec.dataset.methodSection.split(" ").includes(method); });
    if (calcLink) calcLink.href = calcLink.href.replace(/method=[^&]*/, `method=${method}`);
  };
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-method]");
    if (b) show(b.dataset.method);
  });
  show(table.dataset.default);
}

// Printing: open every "Why?" so the printed page has the reasons, then restore.
let opened = [];
window.addEventListener("beforeprint", () => {
  opened = [...document.querySelectorAll("details.why:not([open])")];
  opened.forEach((d) => d.setAttribute("open", ""));
});
window.addEventListener("afterprint", () => opened.forEach((d) => d.removeAttribute("open")));
