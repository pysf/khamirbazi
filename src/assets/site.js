// Small helpers for every page: theme toggle and the language switch (keeps the query string and the #hash).
const root = document.documentElement;

// Theme: the head script already set data-theme; the button flips it and remembers the choice (if storage works).
document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch { /* storage blocked: the choice just is not remembered */ }
});

// Language switch: the other language's link gets the current query string, so the recipe stays the same.
// (The Home and recipe pages rewrite the address after this runs, so it is also refreshed on every click.)
document.querySelectorAll("[data-lang-switch] a").forEach((a) => {
  const base = a.getAttribute("href").split(/[?#]/)[0];
  const update = () => { a.href = base + location.search + location.hash; };
  update();
  a.addEventListener("click", update);
  a.addEventListener("focus", update);
  a.addEventListener("pointerdown", update);
});
