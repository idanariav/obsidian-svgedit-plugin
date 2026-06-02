const applyTheme = (theme, rootEl) => {
  const el = rootEl ?? document.querySelector(".svg_editor");
  if (!el) return;
  const isDark = theme === "dark";
  el.classList.toggle("theme-dark", isDark);
  el.classList.toggle("theme-light", !isDark);
};
export {
  applyTheme
};
//# sourceMappingURL=themeUtil.js.map
