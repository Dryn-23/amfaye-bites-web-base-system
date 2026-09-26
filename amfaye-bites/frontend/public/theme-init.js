// Runs before React/styles load, preventing a light flash for a saved dark preference.
// Only validated values are used; no user-supplied HTML/CSS is inserted.
(function () {
  var preference = "light";
  try {
    var saved = localStorage.getItem("ab-theme");
    if (["light", "dark", "system"].includes(saved)) preference = saved;
  } catch (_) {
    /* Storage may be unavailable; use the existing light theme. */
  }
  var isDark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  var root = document.documentElement;
  root.dataset.theme = isDark ? "dark" : "light";
  root.dataset.themePreference = preference;
  root.style.colorScheme = isDark ? "dark" : "light";
  if (isDark) root.style.backgroundColor = "#191612";
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.dataset.lightColor = meta.content;
    if (isDark) meta.content = "#191612";
  }
})();
