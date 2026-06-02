import { __vitePreload } from "../_virtual/preload-helper.js";
import { l as libExports } from "../_virtual/index.js";
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
const name = "curvature";
let curveMode = "catmull";
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
const fmt = (n) => Math.round(n * 100) / 100;
function buildCatmullRom(pts, closed) {
  let d = `M ${fmt(pts[0].x)},${fmt(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    if (p1.corner || p2.corner) {
      d += ` L ${fmt(p2.x)},${fmt(p2.y)}`;
      continue;
    }
    const p0 = pts[Math.max(0, i - 1)];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${fmt(cp1x)},${fmt(cp1y)} ${fmt(cp2x)},${fmt(cp2y)} ${fmt(p2.x)},${fmt(p2.y)}`;
  }
  if (closed) d += " Z";
  return d;
}
function buildBSpline(pts, closed) {
  if (pts.length === 2) {
    return `M ${fmt(pts[0].x)},${fmt(pts[0].y)} L ${fmt(pts[1].x)},${fmt(pts[1].y)}${closed ? " Z" : ""}`;
  }
  const ctrl = [];
  pts.forEach((p, i) => {
    const isEnd = !closed && (i === 0 || i === pts.length - 1);
    const mult = p.corner || isEnd ? 3 : 1;
    for (let k = 0; k < mult; k++) ctrl.push(p);
  });
  if (closed) ctrl.push(ctrl[0], ctrl[1], ctrl[2]);
  const joint = (a, b, c) => ({ x: (a.x + 4 * b.x + c.x) / 6, y: (a.y + 4 * b.y + c.y) / 6 });
  const ctrl1 = (b, c) => ({ x: (2 * b.x + c.x) / 3, y: (2 * b.y + c.y) / 3 });
  const ctrl2 = (b, c) => ({ x: (b.x + 2 * c.x) / 3, y: (b.y + 2 * c.y) / 3 });
  const start = joint(ctrl[0], ctrl[1], ctrl[2]);
  let d = `M ${fmt(start.x)},${fmt(start.y)}`;
  for (let i = 0; i < ctrl.length - 3; i++) {
    const p1 = ctrl[i + 1];
    const p2 = ctrl[i + 2];
    const p3 = ctrl[i + 3];
    const c1 = ctrl1(p1, p2);
    const c2 = ctrl2(p1, p2);
    const end = joint(p1, p2, p3);
    d += ` C ${fmt(c1.x)},${fmt(c1.y)} ${fmt(c2.x)},${fmt(c2.y)} ${fmt(end.x)},${fmt(end.y)}`;
  }
  if (closed) d += " Z";
  return d;
}
class SpiroPathContext {
  constructor() {
    this.d = "";
  }
  beginShape() {
  }
  endShape() {
  }
  moveTo(x, y) {
    this.d += `M ${fmt(x)},${fmt(y)}`;
  }
  lineTo(x, y) {
    this.d += ` L ${fmt(x)},${fmt(y)}`;
  }
  cubicTo(x1, y1, x2, y2, x, y) {
    this.d += ` C ${fmt(x1)},${fmt(y1)} ${fmt(x2)},${fmt(y2)} ${fmt(x)},${fmt(y)}`;
  }
}
function buildSpiro(pts, closed) {
  const last = pts.length - 1;
  const knots = pts.map((p, i) => {
    let type = "g2";
    if (p.corner) type = "corner";
    else if (!closed && i === 0) type = "open";
    else if (!closed && i === last) type = "open_end";
    return { x: p.x, y: p.y, type };
  });
  const ctx = new SpiroPathContext();
  try {
    libExports.spiroToBezierOnContext(knots, closed, ctx);
  } catch (_err) {
    return buildCatmullRom(pts, closed);
  }
  let d = ctx.d;
  if (!d || d.includes("NaN")) return buildCatmullRom(pts, closed);
  if (closed) d += " Z";
  return d;
}
function buildPathD(points, tentative = null, closed = false) {
  const pts = tentative ? [...points, { x: tentative.x, y: tentative.y, corner: false }] : [...points];
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${fmt(pts[0].x)},${fmt(pts[0].y)}`;
  switch (curveMode) {
    case "bspline":
      return buildBSpline(pts, closed);
    case "spiro":
      return buildSpiro(pts, closed);
    default:
      return buildCatmullRom(pts, closed);
  }
}
const extCurvature = {
  name,
  async init() {
    const svgEditor = this;
    const { svgCanvas } = svgEditor;
    const { $id, $click } = svgCanvas;
    await loadExtensionTranslation(svgEditor);
    const suppressNativeDblClick = (evt) => {
      if (svgCanvas.getMode() !== "curvature") return;
      const root = $id("svgcanvas");
      if (!root || root.contains(evt.target)) {
        evt.stopPropagation();
      }
    };
    window.addEventListener("dblclick", suppressNativeDblClick, true);
    let points = [];
    let previewEl = null;
    let isDrawing = false;
    const dist = (ax, ay, bx, by) => Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
    const getLayer = () => svgCanvas.getCurrentDrawing().getCurrentLayer();
    const createPreview = (x, y) => {
      const svgNS2 = "http://www.w3.org/2000/svg";
      const el = document.createElementNS(svgNS2, "path");
      const zoom = svgCanvas.getZoom();
      el.setAttribute("d", `M ${x},${y}`);
      el.setAttribute("fill", "none");
      el.setAttribute("stroke", svgCanvas.getColor("stroke") || "#000");
      el.setAttribute("stroke-width", String(svgCanvas.getStrokeWidth() || 1));
      el.setAttribute("stroke-dasharray", `${6 / zoom},${3 / zoom}`);
      el.setAttribute("opacity", "0.75");
      el.setAttribute("pointer-events", "none");
      el.setAttribute("id", "curvature_preview");
      getLayer().appendChild(el);
      previewEl = el;
    };
    const updatePreview = (tentative, closed) => {
      if (!previewEl) return;
      previewEl.setAttribute("d", buildPathD(points, tentative, closed));
    };
    const removePreview = () => {
      previewEl?.remove();
      previewEl = null;
    };
    const finalize = (closed) => {
      removeAnchorDots();
      if (points.length < 2) {
        removePreview();
        points = [];
        isDrawing = false;
        return;
      }
      const finalD = buildPathD(points, null, closed);
      removePreview();
      const { InsertElementCommand } = svgCanvas.history;
      const el = svgCanvas.addSVGElementsFromJson({
        element: "path",
        curStyles: true,
        attr: {
          d: finalD,
          id: svgCanvas.getNextId(),
          opacity: svgCanvas.getCurShape().opacity
          // override the /2 halving applied by curStyles
        }
      });
      if (el) {
        svgCanvas.undoMgr.addCommandToHistory(new InsertElementCommand(el));
      }
      points = [];
      isDrawing = false;
    };
    let anchorDots = [];
    const svgNS = "http://www.w3.org/2000/svg";
    const addAnchorDot = (x, y, corner) => {
      const zoom = svgCanvas.getZoom();
      const r = 3.5 / zoom;
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("r", r);
      dot.setAttribute("fill", corner ? "#e00" : "#06f");
      dot.setAttribute("stroke", "#fff");
      dot.setAttribute("stroke-width", String(1 / zoom));
      dot.setAttribute("pointer-events", "none");
      getLayer().appendChild(dot);
      anchorDots.push(dot);
    };
    const removeAnchorDots = () => {
      anchorDots.forEach((d) => d.remove());
      anchorDots = [];
    };
    return {
      name: svgEditor.i18next.t(`${name}:name`),
      callback() {
        const title = `${name}:buttons.0.title`;
        svgCanvas.insertChildAtIndex(
          $id("tools_left"),
          `<se-button id="tool_curvature" title="${title}" src="curvature.svg"></se-button>`,
          12
        );
        const panel = document.createElement("template");
        panel.innerHTML = `
          <div id="curvature_panel" class="quick_tray">
            <se-select id="curvature_mode" label="${name}:modes.label"
              options="Catmull-Rom,B-spline,Spiro" values="catmull::bspline::spiro"></se-select>
          </div>`;
        $id("tools_top").appendChild(panel.content.cloneNode(true));
        const showPanel = (on) => {
          const p = $id("curvature_panel");
          if (!p) return;
          if (on) p.style.removeProperty("display");
          else p.style.display = "none";
        };
        showPanel(false);
        curveMode = svgEditor.configObj.pref("curvatureMode") || "catmull";
        $id("curvature_mode").value = curveMode;
        $id("curvature_mode").addEventListener("change", (evt) => {
          curveMode = evt.detail.value;
          svgEditor.configObj.pref("curvatureMode", curveMode);
          updatePreview(null, false);
        });
        $click($id("tool_curvature"), () => {
          if (this.leftPanel.updateLeftPanel("tool_curvature")) {
            svgCanvas.setMode("curvature");
          }
        });
        document.addEventListener("modeChange", (evt) => {
          showPanel(evt.detail.getMode() === "curvature");
        });
      },
      mouseDown(opts) {
        if (svgCanvas.getMode() !== "curvature") return void 0;
        const evt = opts.event;
        const isDoubleClick = evt.detail >= 2;
        const isCorner = evt.shiftKey;
        const x = opts.start_x;
        const y = opts.start_y;
        if (isDrawing && points.length >= 2) {
          const closeRadius = 8 / svgCanvas.getZoom();
          if (dist(x, y, points[0].x, points[0].y) <= closeRadius) {
            finalize(true);
            return { started: false };
          }
        }
        if (isDoubleClick && isDrawing) {
          finalize(false);
          return { started: false };
        }
        if (!isDrawing) {
          isDrawing = true;
          createPreview(x, y);
        }
        points.push({ x, y, corner: isCorner });
        addAnchorDot(x, y, isCorner);
        updatePreview(null, false);
        return { started: true };
      },
      mouseMove(opts) {
        if (!isDrawing) return void 0;
        const zoom = svgCanvas.getZoom();
        const mx = opts.mouse_x / zoom;
        const my = opts.mouse_y / zoom;
        updatePreview({ x: mx, y: my }, false);
        return { started: true };
      },
      mouseUp(_opts) {
        if (!isDrawing) return void 0;
        return { keep: false, started: false };
      },
      keyDown(opts) {
        if (svgCanvas.getMode() !== "curvature") return void 0;
        if (!isDrawing) return void 0;
        if (opts.event.key === "Escape") {
          finalize(false);
          return { preventDefault: true };
        }
        return void 0;
      }
    };
  }
};
export {
  extCurvature as default
};
//# sourceMappingURL=ext-curvature.js.map
