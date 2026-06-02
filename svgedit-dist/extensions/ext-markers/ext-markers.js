const extMarkers = {
  name: "markers",
  async init() {
    const svgEditor = this;
    const { svgCanvas } = svgEditor;
    const { BatchCommand, RemoveElementCommand, InsertElementCommand } = svgCanvas.history;
    const { $id, addSVGElementsFromJson: addElem } = svgCanvas;
    const mtypes = ["start", "mid", "end"];
    const markerElems = ["line", "path", "polyline", "polygon"];
    const markerTypes = {
      nomarker: {},
      leftarrow: { element: "path", attr: { d: "M0,50 L100,90 L70,50 L100,10 Z" } },
      rightarrow: { element: "path", attr: { d: "M100,50 L0,90 L30,50 L0,10 Z" } },
      box: { element: "path", attr: { d: "M20,20 L20,80 L80,80 L80,20 Z" } },
      mcircle: { element: "circle", attr: { r: 30, cx: 50, cy: 50 } },
      triangle: { element: "path", attr: { d: "M0,10 L100,50 L0,90 Z" } },
      diamond: { element: "path", attr: { d: "M0,50 L50,10 L100,50 L50,90 Z" } },
      openarrow: { element: "path", attr: { d: "M0,10 L100,50 L0,90" } },
      star: { element: "path", attr: { d: "M50,5 L61,39 L97,39 L68,61 L79,95 L50,75 L21,95 L32,61 L3,39 L39,39 Z" } },
      xmark: { element: "path", attr: { d: "M20,20 L80,80 M80,20 L20,80" } },
      forwardslash: { element: "path", attr: { d: "M20,80 L80,20" } },
      reverseslash: { element: "path", attr: { d: "M20,20 L80,80" } },
      verticalslash: { element: "path", attr: { d: "M50,10 L50,90" } }
    };
    ["leftarrow", "rightarrow", "box", "mcircle", "triangle", "star", "diamond"].forEach((v) => {
      markerTypes[v + "_o"] = markerTypes[v];
    });
    const strokeOnly = ["openarrow", "forwardslash", "reverseslash", "verticalslash", "xmark"];
    const getLinked = (elem, attr) => {
      const str = elem.getAttribute(attr);
      if (!str) {
        return null;
      }
      const m = str.match(/\(#(.*)\)/);
      if (!m || m.length !== 2) {
        return null;
      }
      return svgCanvas.getElement(m[1]);
    };
    const showPanel = (on, elem) => {
      $id("marker_panel").style.display = on ? "block" : "none";
      if (on && elem) {
        mtypes.forEach((pos) => {
          const marker = getLinked(elem, "marker-" + pos);
          if (marker?.attributes?.se_type) {
            $id(`${pos}_marker_list_opts`).setAttribute("value", marker.attributes.se_type.value);
          } else {
            $id(`${pos}_marker_list_opts`).setAttribute("value", "nomarker");
          }
        });
      }
    };
    const addMarker = (id, seType) => {
      const selElems = svgCanvas.getSelectedElements();
      let marker = svgCanvas.getElement(id);
      if (marker) {
        return void 0;
      }
      if (seType === "" || seType === "nomarker") {
        return void 0;
      }
      const el = selElems[0];
      const color = el.getAttribute("stroke");
      const strokeWidth = 10;
      const refX = 50;
      const refY = 50;
      const viewBox = "0 0 100 100";
      const markerWidth = 5;
      const markerHeight = 5;
      if (!markerTypes[seType]) {
        console.error(`unknown marker type: ${seType}`);
        return void 0;
      }
      marker = addElem({
        element: "marker",
        attr: {
          id,
          markerUnits: "strokeWidth",
          orient: "auto",
          style: "pointer-events:none",
          se_type: seType
        }
      });
      const mel = addElem(markerTypes[seType]);
      const fillcolor = seType.substr(-2) === "_o" || strokeOnly.includes(seType) ? "none" : color;
      mel.setAttribute("fill", fillcolor);
      mel.setAttribute("stroke", color);
      mel.setAttribute("stroke-width", strokeWidth);
      marker.append(mel);
      marker.setAttribute("viewBox", viewBox);
      marker.setAttribute("markerWidth", markerWidth);
      marker.setAttribute("markerHeight", markerHeight);
      marker.setAttribute("refX", refX);
      marker.setAttribute("refY", refY);
      svgCanvas.findDefs().append(marker);
      return marker;
    };
    const convertline = (elem) => {
      if (elem.tagName !== "line") {
        return elem;
      }
      const x1 = Number(elem.getAttribute("x1"));
      const x2 = Number(elem.getAttribute("x2"));
      const y1 = Number(elem.getAttribute("y1"));
      const y2 = Number(elem.getAttribute("y2"));
      const { id } = elem;
      const midPt = " " + (x1 + x2) / 2 + "," + (y1 + y2) / 2 + " ";
      const pline = addElem({
        element: "polyline",
        attr: {
          points: x1 + "," + y1 + midPt + x2 + "," + y2,
          stroke: elem.getAttribute("stroke"),
          "stroke-width": elem.getAttribute("stroke-width"),
          fill: "none",
          opacity: elem.getAttribute("opacity") || 1
        }
      });
      mtypes.forEach((pos) => {
        const nam = "marker-" + pos;
        const m = elem.getAttribute(nam);
        if (m) {
          pline.setAttribute(nam, elem.getAttribute(nam));
        }
      });
      const batchCmd = new BatchCommand();
      batchCmd.addSubCommand(new RemoveElementCommand(elem, elem.parentNode));
      batchCmd.addSubCommand(new InsertElementCommand(pline));
      elem.insertAdjacentElement("afterend", pline);
      elem.remove();
      svgCanvas.clearSelection();
      pline.id = id;
      svgCanvas.addToSelection([pline]);
      svgCanvas.addCommandToHistory(batchCmd);
      return pline;
    };
    const setMarker = (pos, markerType) => {
      const selElems = svgCanvas.getSelectedElements();
      if (selElems.length === 0) return;
      const markerName = "marker-" + pos;
      const el = selElems[0];
      const marker = getLinked(el, markerName);
      if (marker) {
        marker.remove();
      }
      el.removeAttribute(markerName);
      let val = markerType;
      if (val === "") {
        val = "nomarker";
      }
      if (val === "nomarker") {
        svgCanvas.call("changed", selElems);
        return;
      }
      const id = "mkr_" + pos + "_" + el.id;
      addMarker(id, val);
      svgCanvas.changeSelectedAttribute(markerName, "url(#" + id + ")");
      if (el.tagName === "line" && pos === "mid") {
        convertline(el);
      }
      svgCanvas.call("changed", selElems);
    };
    const colorChanged = (elem) => {
      const color = elem.getAttribute("stroke");
      mtypes.forEach((pos) => {
        const marker = getLinked(elem, "marker-" + pos);
        if (!marker) {
          return;
        }
        if (!marker.attributes.se_type) {
          return;
        }
        const ch = marker.lastElementChild;
        if (!ch) {
          return;
        }
        const curfill = ch.getAttribute("fill");
        const curstroke = ch.getAttribute("stroke");
        if (curfill && curfill !== "none") {
          ch.setAttribute("fill", color);
        }
        if (curstroke && curstroke !== "none") {
          ch.setAttribute("stroke", color);
        }
      });
    };
    const updateReferences = (el) => {
      const selElems = svgCanvas.getSelectedElements();
      mtypes.forEach((pos) => {
        const markerName = "marker-" + pos;
        const marker = getLinked(el, markerName);
        if (!marker || !marker.attributes.se_type) {
          return;
        }
        const url = el.getAttribute(markerName);
        if (url) {
          const len = el.id.length;
          const linkid = url.substr(-len - 1, len);
          if (el.id !== linkid) {
            const newMarkerId = "mkr_" + pos + "_" + el.id;
            addMarker(newMarkerId, marker.attributes.se_type.value);
            svgCanvas.changeSelectedAttribute(markerName, "url(#" + newMarkerId + ")");
            svgCanvas.call("changed", selElems);
          }
        }
      });
    };
    return {
      name: svgEditor.i18next.t(`${name}:name`),
      // The callback should be used to load the DOM with the appropriate UI items
      callback() {
        const panelTemplate = document.createElement("template");
        const posLabels = { start: "Start", mid: "Mid", end: "End" };
        let innerHTML = '<div id="marker_panel" class="sidepanel_section" style="display:none">';
        innerHTML += '<div class="sidepanel_section_label">Markers</div>';
        innerHTML += '<div class="sidepanel_btn_row">';
        mtypes.forEach((pos) => {
          innerHTML += `<div><div class="sub_label">${posLabels[pos]}</div>`;
          innerHTML += `<se-list id="${pos}_marker_list_opts" title="tools.${pos}_marker_list_opts" label="" width="22px" height="22px">`;
          Object.entries(markerTypes).forEach(([marker, _mkr]) => {
            innerHTML += `<se-list-item id="mkr_${pos}_${marker}" value="${marker}" title="tools.mkr_${marker}" src="${marker}.svg" img-height="22px"></se-list-item>`;
          });
          innerHTML += "</se-list></div>";
        });
        innerHTML += "</div></div>";
        panelTemplate.innerHTML = innerHTML;
        const designTab = $id("tab_design");
        const objectPanel = designTab?.querySelector(".selected_panel");
        if (designTab) {
          if (objectPanel) {
            designTab.insertBefore(panelTemplate.content, objectPanel);
          } else {
            designTab.appendChild(panelTemplate.content);
          }
        } else {
          $id("tools_top").appendChild(panelTemplate.content.cloneNode(true));
        }
        showPanel(false);
        mtypes.forEach((pos) => {
          $id(`${pos}_marker_list_opts`).addEventListener("change", (evt) => {
            setMarker(pos, evt.detail.value);
          });
        });
      },
      selectedChanged(opts) {
        if (opts.elems.length === 0) showPanel(false);
        opts.elems.forEach((elem) => {
          if (elem && markerElems.includes(elem.tagName)) {
            if (opts.selectedElement && !opts.multiselected) {
              showPanel(true, elem);
            } else {
              showPanel(false);
            }
          } else {
            showPanel(false);
          }
        });
      },
      elementChanged(opts) {
        const elem = opts.elems[0];
        if (elem && (elem.getAttribute("marker-start") || elem.getAttribute("marker-mid") || elem.getAttribute("marker-end"))) {
          colorChanged(elem);
          updateReferences(elem);
        }
      }
    };
  }
};
export {
  extMarkers as default
};
//# sourceMappingURL=ext-markers.js.map
