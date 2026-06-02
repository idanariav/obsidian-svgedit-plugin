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
const name = "color-shift";
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
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let _namedColorCtx;
const parseNamedColor = (str) => {
  if (!_namedColorCtx) _namedColorCtx = document.createElement("canvas").getContext("2d");
  _namedColorCtx.fillStyle = "#000";
  try {
    _namedColorCtx.fillStyle = str;
  } catch {
    return null;
  }
  const c = _namedColorCtx.fillStyle;
  if (c[0] === "#") return parseColor(c);
  const m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean);
    return { r: +p[0], g: +p[1], b: +p[2], a: p[3] != null ? +p[3] : 1 };
  }
  return null;
};
const parseColor = (str) => {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  if (s === "none" || s === "transparent") return null;
  if (s[0] === "#") {
    let h = s.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 4) h = h.split("").map((c) => c + c).join("");
    if (h.length === 6) {
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    }
    if (h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: parseInt(h.slice(6, 8), 16) / 255
      };
    }
    return null;
  }
  let m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean);
    return { r: +p[0], g: +p[1], b: +p[2], a: p[3] != null ? +p[3] : 1 };
  }
  m = s.match(/^hsla?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean);
    const rgb = hslToRgb({ h: +p[0], s: +String(p[1]).replace("%", ""), l: +String(p[2]).replace("%", "") });
    rgb.a = p[3] != null ? +p[3] : 1;
    return rgb;
  }
  return parseNamedColor(s);
};
const rgbToHsl = ({ r, g, b }) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
};
const hue2rgb = (p, q, t) => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};
const hslToRgb = ({ h, s, l }) => {
  const hh = (h % 360 + 360) % 360 / 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return { r: v, g: v, b: v };
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  return {
    r: Math.round(hue2rgb(p, q, hh + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hh) * 255),
    b: Math.round(hue2rgb(p, q, hh - 1 / 3) * 255)
  };
};
const toHex = ({ r, g, b }) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
const PAINTABLE_TAGS = /* @__PURE__ */ new Set([
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
  "tspan",
  "foreignObject"
]);
const extColorShift = {
  name,
  async init() {
    const svgEditor = this;
    const { svgCanvas } = svgEditor;
    const { BatchCommand, ChangeElementCommand } = svgCanvas.history;
    const { $id } = svgCanvas;
    await loadExtensionTranslation(svgEditor);
    const snapshots = /* @__PURE__ */ new WeakMap();
    const isPaintable = (el) => el && PAINTABLE_TAGS.has(el.tagName);
    const paintableSelection = () => svgCanvas.getSelectedElements().filter(isPaintable);
    const captureSnapshot = (elem) => {
      const fillRaw = elem.getAttribute("fill");
      const strokeRaw = elem.getAttribute("stroke");
      const fill = fillRaw ?? "#000000";
      const stroke = strokeRaw ?? "none";
      const fillOpacity = parseFloat(elem.getAttribute("fill-opacity") ?? "1");
      const strokeOpacity = parseFloat(elem.getAttribute("stroke-opacity") ?? "1");
      const fillRgb = parseColor(fill);
      const strokeRgb = parseColor(stroke);
      return {
        fillRaw,
        strokeRaw,
        fill,
        stroke,
        fillOpacity,
        strokeOpacity,
        fillHSL: fillRgb ? rgbToHsl(fillRgb) : null,
        strokeHSL: strokeRgb ? rgbToHsl(strokeRgb) : null
      };
    };
    const ensureSnapshot = (elem) => {
      let s = snapshots.get(elem);
      if (!s) {
        s = captureSnapshot(elem);
        snapshots.set(elem, s);
      }
      return s;
    };
    const getValues = () => ({
      h: Number($id("color_shift_h").value) || 0,
      s: Number($id("color_shift_s").value) || 0,
      l: Number($id("color_shift_l").value) || 0,
      t: Number($id("color_shift_t").value) || 0,
      applyFill: $id("color_shift_fill").checked,
      applyStroke: $id("color_shift_stroke").checked
    });
    const setAttrIfChanged = (elem, attr, value, oldAttrs) => {
      const current = elem.getAttribute(attr);
      const next = value === null ? null : String(value);
      if (current === next) return;
      oldAttrs[attr] = current ?? "";
      if (next === null) elem.removeAttribute(attr);
      else elem.setAttribute(attr, next);
    };
    const applyShift = () => {
      const { h, s, l, t: t2, applyFill, applyStroke } = getValues();
      const elems = paintableSelection();
      if (!elems.length) return;
      const batch = new BatchCommand("Color shift");
      for (const elem of elems) {
        const snap = ensureSnapshot(elem);
        const oldAttrs = {};
        if (applyFill) {
          if (snap.fillHSL) {
            const nextHsl = {
              h: snap.fillHSL.h + h,
              s: clamp(snap.fillHSL.s + s, 0, 100),
              l: clamp(snap.fillHSL.l + l, 0, 100)
            };
            const nextFill = toHex(hslToRgb(nextHsl));
            setAttrIfChanged(elem, "fill", nextFill, oldAttrs);
          }
          const nextFO = clamp(snap.fillOpacity - t2 / 100, 0, 1);
          const foStr = nextFO >= 1 ? null : String(Math.round(nextFO * 1e3) / 1e3);
          setAttrIfChanged(elem, "fill-opacity", foStr, oldAttrs);
        }
        if (applyStroke) {
          if (snap.strokeHSL) {
            const nextHsl = {
              h: snap.strokeHSL.h + h,
              s: clamp(snap.strokeHSL.s + s, 0, 100),
              l: clamp(snap.strokeHSL.l + l, 0, 100)
            };
            const nextStroke = toHex(hslToRgb(nextHsl));
            setAttrIfChanged(elem, "stroke", nextStroke, oldAttrs);
          }
          if (snap.strokeHSL) {
            const nextSO = clamp(snap.strokeOpacity - t2 / 100, 0, 1);
            const soStr = nextSO >= 1 ? null : String(Math.round(nextSO * 1e3) / 1e3);
            setAttrIfChanged(elem, "stroke-opacity", soStr, oldAttrs);
          }
        }
        if (Object.keys(oldAttrs).length) {
          batch.addSubCommand(new ChangeElementCommand(elem, oldAttrs));
        }
      }
      if (!batch.isEmpty()) svgCanvas.addCommandToHistory(batch);
    };
    const resetInputs = () => {
      $id("color_shift_h").value = 0;
      $id("color_shift_s").value = 0;
      $id("color_shift_l").value = 0;
      $id("color_shift_t").value = 0;
    };
    const reseed = () => {
      for (const elem of paintableSelection()) {
        snapshots.set(elem, captureSnapshot(elem));
      }
      resetInputs();
    };
    const updateVisibility = () => {
      const panel = $id("color_shift_panel");
      const hint = $id("color_shift_hint");
      const body = $id("color_shift_body");
      if (!panel) return;
      const hasPaintable = paintableSelection().length > 0;
      hint.style.display = hasPaintable ? "none" : "";
      body.style.display = hasPaintable ? "" : "none";
    };
    const t = (key) => svgEditor.i18next.t(`${name}:${key}`);
    return {
      name: t("name"),
      callback() {
        const sidepanel = $id("tab_effects") || $id("sidepanel_content");
        if (!sidepanel) return;
        const tpl = document.createElement("template");
        tpl.innerHTML = `
          <div id="color_shift_panel">
            <div id="color_shift_label">${t("panelTitle")}</div>
            <div id="color_shift_hint">${t("hint")}</div>
            <div id="color_shift_body" style="display:none">
              <div class="color_shift_grid">
                <se-spin-input id="color_shift_h" label="H" min="-180" max="180" step="1" value="0"
                  title="${t("inputs.hue.title")}"></se-spin-input>
                <se-spin-input id="color_shift_s" label="S" min="-100" max="100" step="1" value="0"
                  title="${t("inputs.saturation.title")}"></se-spin-input>
                <se-spin-input id="color_shift_l" label="L" min="-100" max="100" step="1" value="0"
                  title="${t("inputs.lightness.title")}"></se-spin-input>
                <se-spin-input id="color_shift_t" label="T" min="-100" max="100" step="1" value="0"
                  title="${t("inputs.transparency.title")}"></se-spin-input>
              </div>
              <div class="color_shift_toggles">
                <label title="${t("toggles.fill.title")}">
                  <input id="color_shift_fill" type="checkbox" checked>
                  <span>${t("toggles.fill.label")}</span>
                </label>
                <label title="${t("toggles.stroke.title")}">
                  <input id="color_shift_stroke" type="checkbox" checked>
                  <span>${t("toggles.stroke.label")}</span>
                </label>
                <button id="color_shift_reset" type="button"
                  title="${t("reset.title")}">Reset</button>
              </div>
            </div>
          </div>
        `;
        sidepanel.appendChild(tpl.content.cloneNode(true));
        ["color_shift_h", "color_shift_s", "color_shift_l", "color_shift_t"].forEach((id) => $id(id).addEventListener("change", applyShift));
        ["color_shift_fill", "color_shift_stroke"].forEach((id) => $id(id).addEventListener("change", applyShift));
        $id("color_shift_reset").addEventListener("click", () => {
          resetInputs();
          applyShift();
        });
        updateVisibility();
      },
      selectedChanged(_opts) {
        reseed();
        updateVisibility();
      }
    };
  }
};
export {
  extColorShift as default
};
//# sourceMappingURL=ext-color-shift.js.map
