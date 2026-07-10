// @vitest-environment node
/**
 * src/export/raster.ts draws an SVG into a real <canvas> via an <img>, which
 * jsdom doesn't implement (no canvas 2D rendering, no image decoding), so this
 * runs the actual source in a real Chromium page via Playwright instead — see
 * CLAUDE.md's "Headless" testing section. esbuild transforms the file
 * (types-only strip, no bundling needed: raster.ts has no imports) into an
 * IIFE exposed as `window.RasterExport`, which the page then calls directly.
 *
 * Forced to the `node` environment (rather than this project's default
 * jsdom): jsdom's TextEncoder polyfill produces objects that fail esbuild's
 * own `instanceof Uint8Array` sanity check, so esbuild refuses to run at all
 * under jsdom. Nothing in this file needs jsdom's DOM shim anyway — the real
 * DOM being tested is the one Playwright drives inside Chromium.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { transform } from "esbuild";
import { chromium, type Browser, type Page } from "playwright";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const RASTER_PATH = resolve(__dirname, "../../src/export/raster.ts");

// Minimal PNG chunk reader: signature + IHDR are always the first 33 bytes,
// with width/height as big-endian uint32s at a fixed offset (no need to pull
// in a PNG-decoding dependency just to assert on dimensions).
function pngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

const RED_SQUARE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10">' +
  '<rect width="20" height="10" fill="#ff0000"/>' +
  "</svg>";

declare global {
  interface Window {
    RasterExport: {
      svgToPngArrayBuffer(
        svgString: string,
        scale?: number,
        transparent?: boolean,
        bgColor?: string,
      ): Promise<ArrayBuffer>;
    };
  }
}

describe("svgToPngArrayBuffer (real browser rasterization)", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    const bundled = (
      await transform(readFileSync(RASTER_PATH, "utf8"), {
        loader: "ts",
        format: "iife",
        globalName: "RasterExport",
        target: "es2020",
      })
    ).code;

    browser = await chromium.launch();
    page = await browser.newPage();
    await page.setContent(`<script>${bundled}</script>`);
  });

  afterAll(async () => {
    await browser.close();
  });

  it("rasterizes an SVG to a PNG with matching pixel dimensions", async () => {
    const bytes = await page.evaluate(async (svg) => {
      const buf = await window.RasterExport.svgToPngArrayBuffer(svg, 1, false, "#ffffff");
      return Array.from(new Uint8Array(buf));
    }, RED_SQUARE_SVG);

    const png = new Uint8Array(bytes);
    // PNG signature.
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(pngDimensions(png)).toEqual({ width: 20, height: 10 });
  });

  it("scales pixel dimensions by the scale factor", async () => {
    const bytes = await page.evaluate(async (svg) => {
      const buf = await window.RasterExport.svgToPngArrayBuffer(svg, 2, false, "#ffffff");
      return Array.from(new Uint8Array(buf));
    }, RED_SQUARE_SVG);

    expect(pngDimensions(new Uint8Array(bytes))).toEqual({ width: 40, height: 20 });
  });

  it("rejects an SVG string with no root element", async () => {
    const message = await page.evaluate(async () => {
      try {
        await window.RasterExport.svgToPngArrayBuffer("not an svg", 1, false, "#ffffff");
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(message).toBe("Invalid SVG: missing root element");
  });
});
