const insertImageFromHref = (href, opts = {}) => {
  const svgCanvas = svgEditor.svgCanvas;
  const insertNewImage = (imageWidth, imageHeight) => {
    const newImage = svgCanvas.addSVGElementsFromJson({
      element: "image",
      attr: {
        x: 0,
        y: 0,
        width: imageWidth,
        height: imageHeight,
        id: svgCanvas.getNextId(),
        style: "pointer-events:inherit"
      }
    });
    svgCanvas.setHref(newImage, href);
    if (opts.vaultLink) newImage.setAttribute("data-vault-link", opts.vaultLink);
    if (opts.locked) newImage.setAttribute("data-vault-locked", "1");
    svgCanvas.selectOnly([newImage]);
    svgCanvas.alignSelectedElements("m", "page");
    svgCanvas.alignSelectedElements("c", "page");
    svgEditor.topPanel.updateContextPanel();
  };
  const img = new Image();
  img.style.opacity = 0;
  img.addEventListener("load", () => {
    const imgWidth = img.offsetWidth || img.naturalWidth || img.width || 100;
    const imgHeight = img.offsetHeight || img.naturalHeight || img.height || 100;
    insertNewImage(imgWidth, imgHeight);
  });
  img.addEventListener("error", () => {
    insertNewImage(100, 100);
  });
  img.src = href;
};
const insertSvgElements = (svgString, opts = {}) => {
  const svgCanvas = svgEditor.svgCanvas;
  const doc = svgCanvas.getDOMDocument();
  const parsed = new DOMParser().parseFromString(svgString, "image/svg+xml");
  const root = parsed.documentElement;
  if (!root || root.getElementsByTagName("parsererror").length) return;
  const defsNodes = [];
  const drawNodes = [];
  const collectDefs = (container) => {
    Array.from(container.children).forEach((node) => {
      if (node.localName === "defs") {
        Array.from(node.children).forEach((d) => defsNodes.push(d));
      }
    });
  };
  const collectDrawables = (container) => {
    Array.from(container.children).forEach((node) => {
      const tag = node.localName;
      if (tag === "title" || tag === "metadata" || tag === "defs") return;
      drawNodes.push(node);
    });
  };
  const layers = Array.from(root.children).filter(
    (n) => n.localName === "g" && n.classList.contains("layer")
  );
  collectDefs(root);
  if (layers.length) {
    layers.forEach(collectDefs);
    layers.forEach(collectDrawables);
  } else {
    collectDrawables(root);
  }
  if (!drawNodes.length) return;
  const temp = doc.createElementNS(svgCanvas.NS.SVG, "g");
  [...defsNodes, ...drawNodes].forEach((node) => {
    temp.appendChild(doc.adoptNode(node));
  });
  temp.querySelectorAll("*").forEach((el) => {
    if (!el.id) el.id = svgCanvas.getNextId();
  });
  temp.id = svgCanvas.getNextId();
  svgCanvas.uniquifyElems(temp);
  const canvasDefs = svgCanvas.findDefs();
  defsNodes.forEach((node) => canvasDefs.appendChild(node));
  const layer = svgCanvas.getCurrentDrawing().getCurrentLayer();
  drawNodes.forEach((node) => {
    layer.appendChild(node);
    if (opts.vaultLink) node.setAttribute("data-vault-link", opts.vaultLink);
  });
  svgCanvas.selectOnly(drawNodes);
  const batchCmd = new svgCanvas.history.BatchCommand("Insert SVG elements");
  [...defsNodes, ...drawNodes].forEach((node) => {
    batchCmd.addSubCommand(new svgCanvas.history.InsertElementCommand(node));
  });
  const bbox = svgCanvas.getStrokedBBox(drawNodes);
  if (bbox) {
    const dx = svgCanvas.getContentW() / 2 - (bbox.x + bbox.width / 2);
    const dy = svgCanvas.getContentH() / 2 - (bbox.y + bbox.height / 2);
    const moveCmd = svgCanvas.moveSelectedElements(
      drawNodes.map(() => dx),
      drawNodes.map(() => dy),
      false
    );
    if (moveCmd && !moveCmd.isEmpty()) batchCmd.addSubCommand(moveCmd);
  }
  svgCanvas.addCommandToHistory(batchCmd);
  svgCanvas.call("changed", drawNodes);
  svgEditor.topPanel.updateContextPanel();
};
export {
  insertImageFromHref,
  insertSvgElements
};
//# sourceMappingURL=insertImage.js.map
