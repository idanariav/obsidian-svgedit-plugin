/** Convert an SVG string to a PNG ArrayBuffer by drawing into an offscreen canvas. */
export async function svgToPngArrayBuffer(
  svgString: string,
  scale = 1,
): Promise<ArrayBuffer> {
  const blob = await svgToPngBlob(svgString, scale);
  return blob.arrayBuffer();
}

async function svgToPngBlob(svgString: string, scale: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
    const svgEl = svgDoc.querySelector("svg");
    if (!svgEl) {
      reject(new Error("Invalid SVG: missing root element"));
      return;
    }

    const width = parseFloat(svgEl.getAttribute("width") || "800");
    const height = parseFloat(svgEl.getAttribute("height") || "600");

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not get 2D canvas context"));
      return;
    }
    ctx.scale(scale, scale);

    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("canvas.toBlob returned null"));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG as image"));
    };
    img.src = url;
  });
}
