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
export {
  insertImageFromHref
};
//# sourceMappingURL=insertImage.js.map
