import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors esbuild.config.mjs's build-time alias, so tests can resolve
      // the same bare specifier SvgView.ts imports. Tests that touch it (see
      // tests/view/SvgView-init-race.test.ts) mock it via vi.mock rather
      // than loading the real 4MB bundle; this alias just needs to resolve
      // to an existing file for Vite's static import analysis.
      "svgedit-editor": resolve(__dirname, "svgedit-dist/Editor.js"),
      // The installed `obsidian` package is types-only (no runtime JS, see
      // tests/mocks/obsidian.ts), so any test that imports code which in
      // turn imports "obsidian" needs a real module here instead.
      obsidian: resolve(__dirname, "tests/mocks/obsidian.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
