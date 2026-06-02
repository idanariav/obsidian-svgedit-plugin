const name = "fonts";
const extFonts = {
  name,
  async init() {
    const svgEditor = this;
    const canv = svgEditor.svgCanvas;
    const { $id } = canv;
    return {
      callback() {
        const fontLib = $id("tool_font_library");
        const fontSelect = $id("tool_font_family");
        if (!fontLib || !fontSelect) return;
        const extPath = svgEditor.configObj.curConfig.extPath;
        fontLib.setAttribute("catalog", `${extPath}/ext-fonts/google-fonts-catalog.json`);
        fontLib.addEventListener("font-pick", (e) => {
          const { family } = e.detail;
          fontSelect.addOption(family, family);
          fontSelect.value = family;
          canv.setFontFamily(family);
        });
        fontLib.restoreCachedFonts().then((families) => {
          families.forEach((f) => fontSelect.addOption(f, f));
        });
      }
    };
  }
};
export {
  extFonts as default
};
//# sourceMappingURL=ext-fonts.js.map
