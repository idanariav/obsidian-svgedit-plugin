import { App, TFile, ViewState, WorkspaceLeaf } from "obsidian";
import { around } from "monkey-around";
import { isSvgDrawingFile, resolveEffectiveSettings } from "../data/frontmatter";
import { VIEW_TYPE_SVG } from "../constants";
import type { SvgPluginSettings } from "../settings/defaults";

/**
 * Monkey-patch WorkspaceLeaf.setViewState so that opening a markdown file that
 * is an SVG drawing (svg-plugin: parsed frontmatter) forces the SVG view type
 * instead of the default markdown view — unless the resolved effective settings
 * say to open as markdown (via per-file frontmatter, folder config, or global
 * default).
 *
 * bypassLeaves: leaves in this set skip the redirect for one call (used when
 * the plugin itself explicitly switches a leaf from SVG → markdown view).
 *
 * Returns an uninstall function; call it in plugin.onunload().
 */
export function installViewStatePatch(
  app: App,
  isLoaded: () => boolean,
  bypassLeaves: Set<WorkspaceLeaf>,
  getSettings: () => SvgPluginSettings,
): () => void {
  return around(WorkspaceLeaf.prototype, {
    setViewState(next) {
      return function (
        this: WorkspaceLeaf,
        state: ViewState,
        eState?: unknown,
      ) {
        // Explicit bypass: plugin is intentionally switching this leaf to markdown.
        if (bypassLeaves.has(this)) {
          bypassLeaves.delete(this);
          return next.call(this, state, eState);
        }

        if (
          isLoaded() &&
          state.type === "markdown" &&
          typeof (state as ViewState & { state?: { file?: string } }).state?.file === "string"
        ) {
          const filepath = (state as ViewState & { state: { file: string } }).state.file;

          // If this leaf is already showing a markdown view of the SAME file,
          // the call is a mode change (e.g. toggling source / live-preview /
          // reading view) rather than a new file open.  Let Obsidian handle it
          // natively so that "Source view" works correctly on drawing files.
          // A DIFFERENT file is a new open and must still go through the SVG
          // redirect below, otherwise clicking a drawing while a markdown view
          // is active would wrongly open it as markdown.
          if (
            this.view?.getViewType() === "markdown" &&
            (this.view as { file?: TFile }).file?.path === filepath
          ) {
            return next.call(this, state, eState);
          }

          const file = app.vault.getAbstractFileByPath(filepath);
          if (file instanceof TFile && isSvgDrawingFile(app, file)) {
            const effective = resolveEffectiveSettings(app, file, getSettings());
            if (!effective.openAsMarkdown) {
              return next.call(this, { ...state, type: VIEW_TYPE_SVG }, eState);
            }
          }
        }
        return next.call(this, state, eState);
      };
    },
  });
}
