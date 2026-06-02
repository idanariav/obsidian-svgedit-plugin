import { __vitePreload } from "../_virtual/preload-helper.js";
function __variableDynamicImportRuntime0__(path) {
  switch (path) {
    case "./locale/en.js":
      return __vitePreload(() => import("./locale/en.js"), true ? [] : void 0, import.meta.url);
    case "./locale/fr.js":
      return __vitePreload(() => import("./locale/fr.js"), true ? [] : void 0, import.meta.url);
    case "./locale/sv.js":
      return __vitePreload(() => import("./locale/sv.js"), true ? [] : void 0, import.meta.url);
    case "./locale/tr.js":
      return __vitePreload(() => import("./locale/tr.js"), true ? [] : void 0, import.meta.url);
    case "./locale/uk.js":
      return __vitePreload(() => import("./locale/uk.js"), true ? [] : void 0, import.meta.url);
    case "./locale/zh-CN.js":
      return __vitePreload(() => import("./locale/zh-CN.js"), true ? [] : void 0, import.meta.url);
    default:
      return new Promise(function(resolve, reject) {
        (typeof queueMicrotask === "function" ? queueMicrotask : setTimeout)(
          reject.bind(null, new Error("Unknown variable dynamic import: " + path))
        );
      });
  }
}
const name = "grid";
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
const extGrid = {
  name,
  async init() {
    const svgEditor = this;
    await loadExtensionTranslation(svgEditor);
    const { svgCanvas } = svgEditor;
    const { $id, NS } = svgCanvas;
    const svgdoc = $id("svgcanvas").ownerDocument;
    const { assignAttributes } = svgCanvas;
    const hcanvas = document.createElement("canvas");
    const canvBG = $id("canvasBackground");
    const units = svgCanvas.getTypeMap();
    const intervals = [0.01, 0.1, 1, 10, 100, 1e3];
    const curConfig = svgEditor.configObj.curConfig;
    hcanvas.style.display = "none";
    svgEditor.$svgEditor.appendChild(hcanvas);
    const canvasGrid = svgdoc.createElementNS(NS.SVG, "svg");
    assignAttributes(canvasGrid, {
      id: "canvasGrid",
      width: "100%",
      height: "100%",
      x: 0,
      y: 0,
      overflow: "visible",
      display: "none"
    });
    canvBG.appendChild(canvasGrid);
    const gridDefs = svgdoc.createElementNS(NS.SVG, "defs");
    const gridPattern = svgdoc.createElementNS(NS.SVG, "pattern");
    assignAttributes(gridPattern, {
      id: "gridpattern",
      patternUnits: "userSpaceOnUse",
      x: 0,
      // -(value.strokeWidth / 2), // position for strokewidth
      y: 0,
      // -(value.strokeWidth / 2), // position for strokewidth
      width: 100,
      height: 100
    });
    const gridimg = svgdoc.createElementNS(NS.SVG, "image");
    assignAttributes(gridimg, {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    });
    gridPattern.append(gridimg);
    gridDefs.append(gridPattern);
    const gridClip = svgdoc.createElementNS(NS.SVG, "clipPath");
    gridClip.setAttribute("id", "gridclip");
    const gridClipRect = svgdoc.createElementNS(NS.SVG, "rect");
    assignAttributes(gridClipRect, { x: 0, y: 0, width: 100, height: 100 });
    gridClip.append(gridClipRect);
    gridDefs.append(gridClip);
    $id("canvasGrid").appendChild(gridDefs);
    const gridBox = svgdoc.createElementNS(NS.SVG, "rect");
    assignAttributes(gridBox, {
      width: "100%",
      height: "100%",
      x: 0,
      y: 0,
      "stroke-width": 0,
      stroke: "none",
      fill: "url(#gridpattern)",
      style: "pointer-events: none; display:visible;"
    });
    $id("canvasGrid").appendChild(gridBox);
    const gridLines = svgdoc.createElementNS(NS.SVG, "g");
    assignAttributes(gridLines, {
      id: "gridLines",
      "clip-path": "url(#gridclip)",
      style: "pointer-events: none;"
    });
    $id("canvasGrid").appendChild(gridLines);
    const buildShapeLines = (shape, w, h, d) => {
      const lines = [];
      const parallel = (angleDeg) => {
        const a = angleDeg * Math.PI / 180;
        const dir = { x: Math.cos(a), y: Math.sin(a) };
        const n = { x: -Math.sin(a), y: Math.cos(a) };
        const corners = [[0, 0], [w, 0], [0, h], [w, h]];
        const proj = corners.map(([x, y]) => x * n.x + y * n.y);
        const pMin = Math.min(...proj);
        const pMax = Math.max(...proj);
        const L = Math.hypot(w, h);
        for (let p = Math.floor(pMin / d) * d; p <= pMax; p += d) {
          const px = p * n.x;
          const py = p * n.y;
          lines.push([px - L * dir.x, py - L * dir.y, px + L * dir.x, py + L * dir.y]);
        }
      };
      const perimeter = () => {
        const pts = [];
        for (let x = 0; x <= w; x += d) {
          pts.push([x, 0], [x, h]);
        }
        for (let y = 0; y <= h; y += d) {
          pts.push([0, y], [w, y]);
        }
        return pts;
      };
      switch (shape) {
        case "isometric":
          parallel(30);
          parallel(-30);
          break;
        case "triangle":
          parallel(0);
          parallel(60);
          parallel(120);
          break;
        case "perspective1": {
          const vp = [w / 2, h / 2];
          lines.push([0, h / 2, w, h / 2]);
          perimeter().forEach(([x, y]) => lines.push([vp[0], vp[1], x, y]));
          break;
        }
        case "perspective2": {
          const vpL = [0, h / 2];
          const vpR = [w, h / 2];
          lines.push([0, h / 2, w, h / 2]);
          const edges = [];
          for (let x = 0; x <= w; x += d) {
            edges.push([x, 0], [x, h]);
          }
          edges.forEach(([x, y]) => {
            lines.push([vpL[0], vpL[1], x, y]);
            lines.push([vpR[0], vpR[1], x, y]);
          });
          break;
        }
      }
      return lines;
    };
    const updateLineGrid = (shape, zoom) => {
      const res = svgCanvas.getResolution();
      const w = res.w * zoom;
      const h = res.h * zoom;
      const stepPx = (curConfig.snappingStep || 10) * zoom;
      let d;
      if (shape === "isometric" || shape === "triangle") {
        d = stepPx * Math.sin(Math.PI / 3);
      } else {
        d = stepPx;
        while (d > 0 && d < 8) {
          d *= 2;
        }
      }
      gridClipRect.setAttribute("width", w);
      gridClipRect.setAttribute("height", h);
      const segs = buildShapeLines(shape, w, h, d);
      const frag = svgdoc.createDocumentFragment();
      segs.forEach(([x1, y1, x2, y2]) => {
        const ln = svgdoc.createElementNS(NS.SVG, "line");
        assignAttributes(ln, {
          x1,
          y1,
          x2,
          y2,
          stroke: curConfig.gridColor,
          "stroke-width": 1,
          "stroke-opacity": 0.3
        });
        frag.append(ln);
      });
      gridLines.replaceChildren(frag);
    };
    const updateSquareGrid = (zoom) => {
      const unit = units[svgEditor.configObj.curConfig.baseUnit];
      const uMulti = unit * zoom;
      const rawM = 100 / uMulti;
      let multi = 1;
      intervals.some((num) => {
        multi = num;
        return rawM <= num;
      });
      const bigInt = multi * uMulti;
      hcanvas.width = bigInt;
      hcanvas.height = bigInt;
      const ctx = hcanvas.getContext("2d");
      const curD = 0.5;
      const part = bigInt / 10;
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = svgEditor.configObj.curConfig.gridColor;
      for (let i = 1; i < 10; i++) {
        const subD = Math.round(part * i) + 0.5;
        const lineNum = 0;
        ctx.moveTo(subD, bigInt);
        ctx.lineTo(subD, lineNum);
        ctx.moveTo(bigInt, subD);
        ctx.lineTo(lineNum, subD);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.globalAlpha = 0.5;
      ctx.moveTo(curD, bigInt);
      ctx.lineTo(curD, 0);
      ctx.moveTo(bigInt, curD);
      ctx.lineTo(0, curD);
      ctx.stroke();
      const datauri = hcanvas.toDataURL("image/png");
      gridimg.setAttribute("width", bigInt);
      gridimg.setAttribute("height", bigInt);
      gridimg.parentNode.setAttribute("width", bigInt);
      gridimg.parentNode.setAttribute("height", bigInt);
      svgCanvas.setHref(gridimg, datauri);
    };
    const updateGrid = (zoom) => {
      const shape = curConfig.gridShape || "square";
      if (shape === "square") {
        gridBox.style.display = "";
        gridLines.style.display = "none";
        gridLines.replaceChildren();
        updateSquareGrid(zoom);
      } else {
        gridBox.style.display = "none";
        gridLines.style.display = "";
        updateLineGrid(shape, zoom);
      }
    };
    const gridUpdate = () => {
      const showGrid = curConfig.showGrid;
      if (showGrid) {
        updateGrid(svgCanvas.getZoom());
      }
      $id("canvasGrid").style.display = showGrid ? "block" : "none";
    };
    svgEditor.updateGrid = gridUpdate;
    return {
      name: svgEditor.i18next.t(`${name}:name`),
      zoomChanged(zoom) {
        if (curConfig.showGrid) {
          updateGrid(zoom);
        }
      },
      callback() {
        const buttonTemplate = document.createElement("template");
        const title = `${name}:buttons.0.title`;
        buttonTemplate.innerHTML = `
          <se-grid-settings id="grid_settings" title="${title}" src="grid.svg"></se-grid-settings>
        `;
        $id("editor_panel").append(buttonTemplate.content.cloneNode(true));
        $id("grid_settings").addEventListener("change", () => {
          gridUpdate();
        });
        if (curConfig.showGrid) {
          gridUpdate();
        }
      }
    };
  }
};
export {
  extGrid as default
};
//# sourceMappingURL=ext-grid.js.map
