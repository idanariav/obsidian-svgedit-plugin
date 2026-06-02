import { __vitePreload } from "../_virtual/preload-helper.js";
function __variableDynamicImportRuntime0__(path) {
  switch (path) {
    case "./locale/en.js":
      return __vitePreload(() => import("./locale/en.js"), true ? [] : void 0, import.meta.url);
    default:
      return new Promise(function(resolve, reject) {
        (typeof queueMicrotask === "function" ? queueMicrotask : setTimeout)(
          reject.bind(null, new Error("Unknown variable dynamic import: " + path))
        );
      });
  }
}
const name = "cutter";
const loadExtensionTranslation = async function(svgEditor) {
  let translationModule;
  const lang = svgEditor.configObj.pref("lang");
  try {
    translationModule = await __variableDynamicImportRuntime0__(`./locale/${lang}.js`);
  } catch (_error) {
    console.warn(`Missing translation (${lang}) for ${name} - using 'en'`);
    translationModule = await __vitePreload(() => import("./locale/en.js"), true ? [] : void 0, import.meta.url);
  }
  svgEditor.i18next.addResourceBundle(lang, name, translationModule.default);
};
const extCutter = {
  name,
  async init() {
    const svgEditor = this;
    const { svgCanvas } = svgEditor;
    const { $id, $click } = svgCanvas;
    await loadExtensionTranslation(svgEditor);
    let started = false;
    let startX = 0;
    let startY = 0;
    let previewLine = null;
    const createPreviewLine = (x1, y1) => {
      const svgNS = "http://www.w3.org/2000/svg";
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x1);
      line.setAttribute("y2", y1);
      line.setAttribute("stroke", "#e00");
      line.setAttribute("stroke-width", String(1.5 / svgCanvas.getZoom()));
      line.setAttribute("stroke-dasharray", `${6 / svgCanvas.getZoom()},${4 / svgCanvas.getZoom()}`);
      line.setAttribute("opacity", "0.85");
      line.setAttribute("pointer-events", "none");
      line.setAttribute("id", "cutter_preview_line");
      svgCanvas.getSvgContent().appendChild(line);
      previewLine = line;
    };
    const removePreviewLine = () => {
      previewLine?.remove();
      previewLine = null;
    };
    return {
      name: svgEditor.i18next.t(`${name}:name`),
      /**
       * Inject the toolbar button into the left panel.
       */
      callback() {
        const title = `${name}:buttons.0.title`;
        svgCanvas.insertChildAtIndex(
          $id("tools_left"),
          `<se-button id="tool_cutter" title="${title}" src="cutter.svg"></se-button>`,
          11
        );
        $click($id("tool_cutter"), () => {
          if (this.leftPanel.updateLeftPanel("tool_cutter")) {
            svgCanvas.setMode("cutter");
          }
        });
      },
      mouseDown(opts) {
        if (svgCanvas.getMode() !== "cutter") return void 0;
        startX = opts.start_x;
        startY = opts.start_y;
        createPreviewLine(startX, startY);
        started = true;
        return { started: true };
      },
      mouseMove(opts) {
        if (!started) return void 0;
        const zoom = svgCanvas.getZoom();
        previewLine?.setAttribute("x2", opts.mouse_x / zoom);
        previewLine?.setAttribute("y2", opts.mouse_y / zoom);
        return { started: true };
      },
      mouseUp(opts) {
        if (!started) return void 0;
        started = false;
        removePreviewLine();
        const zoom = svgCanvas.getZoom();
        const endX = opts.mouse_x / zoom;
        const endY = opts.mouse_y / zoom;
        const dx = endX - startX;
        const dy = endY - startY;
        if (Math.sqrt(dx * dx + dy * dy) >= 2) {
          svgCanvas.cutShapes(startX, startY, endX, endY);
        }
        return { keep: false, started: false };
      }
    };
  }
};
export {
  extCutter as default
};
//# sourceMappingURL=ext-cutter.js.map
