import { App, TFile, ViewState, WorkspaceLeaf } from "obsidian";
import { around } from "monkey-around";
import { isSvgDrawingFile, shouldOpenAsMarkdown } from "../data/frontmatter";
import { VIEW_TYPE_SVG } from "../constants";

/**
 * Monkey-patch WorkspaceLeaf.setViewState so that opening a markdown file that
 * is an SVG drawing (svg-plugin: parsed frontmatter) forces the SVG view type
 * instead of the default markdown view — unless svg-open-md is true.
 *
 * Returns an uninstall function; call it in plugin.onunload().
 */
export function installViewStatePatch(app: App, isLoaded: () => boolean): () => void {
  return around(WorkspaceLeaf.prototype, {
    setViewState(next) {
      return function (
        this: WorkspaceLeaf,
        state: ViewState,
        eState?: unknown,
      ) {
        if (
          isLoaded() &&
          state.type === "markdown" &&
          typeof (state as ViewState & { state?: { file?: string } }).state?.file === "string"
        ) {
          const filepath = (state as ViewState & { state: { file: string } }).state.file;
          const file = app.vault.getAbstractFileByPath(filepath);
          if (
            file instanceof TFile &&
            isSvgDrawingFile(app, file) &&
            !shouldOpenAsMarkdown(app, file)
          ) {
            return next.call(this, { ...state, type: VIEW_TYPE_SVG }, eState);
          }
        }
        return next.call(this, state, eState);
      };
    },
  });
}
