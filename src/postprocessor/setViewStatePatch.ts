import { App, TFile, ViewState, WorkspaceLeaf } from "obsidian";
import { around } from "monkey-around";
import { isSvgDrawingFile, resolveEffectiveSettings } from "../data/frontmatter";
import { VIEW_TYPE_SVG } from "../constants";
import type { SvgPluginSettings } from "../settings/defaults";

/**
 * Monkey-patch WorkspaceLeaf.setViewState so that opening a markdown file that
 * is an SVG drawing (sketch-editor-plugin: parsed frontmatter) forces the SVG view type
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
  markdownModeLeaves: Map<string, string>,
): () => void {
  const uninstallSetViewState = around(WorkspaceLeaf.prototype, {
    // Drop a closed leaf's intentional-markdown marker so its id can't leak or
    // wrongly apply if Obsidian reuses it.
    detach(next) {
      return function (this: WorkspaceLeaf) {
        const id = (this as unknown as { id?: string }).id;
        if (id) markdownModeLeaves.delete(id);
        return next.call(this);
      };
    },
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

  // Obsidian's WorkspaceLeaf.setViewState pushes the *previous* state onto the
  // leaf's navigation history whenever the view type changes, even if the file
  // is unchanged. That means every drawing/markdown toggle (the command, the
  // file-menu item, or the auto-redirects above) adds a spurious history entry,
  // so a single "back" from a drawing note lands back on the same note's other
  // view mode instead of the file that was actually open before it. Suppress
  // just those same-file mode-toggle entries so back/forward navigate between
  // files, not view modes. recordHistory isn't part of the public API, so this
  // is cast loosely and left to no-op harmlessly if Obsidian's internals ever
  // stop matching this shape.
  const uninstallRecordHistory = around(
    WorkspaceLeaf.prototype as unknown as Record<string, (entry: { state?: ViewState }) => void>,
    {
      recordHistory(next) {
        return function (this: WorkspaceLeaf, entry: { state?: ViewState }) {
          if (typeof next !== "function") return;
          const oldType = entry?.state?.type;
          const oldFile = (entry?.state?.state as { file?: string } | undefined)?.file;
          const newType = this.view?.getViewType();
          const newFile = (this.view as unknown as { file?: TFile })?.file?.path;
          const isDrawingModeToggle =
            !!oldFile &&
            oldFile === newFile &&
            ((oldType === "markdown" && newType === VIEW_TYPE_SVG) ||
              (oldType === VIEW_TYPE_SVG && newType === "markdown"));
          if (isDrawingModeToggle) return;
          return next.call(this, entry);
        };
      },
    },
  );

  return () => {
    uninstallSetViewState();
    uninstallRecordHistory();
  };
}
