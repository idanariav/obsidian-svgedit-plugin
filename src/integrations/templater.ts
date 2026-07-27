import { App, TFile, TFolder } from "obsidian";

const TEMPLATER_PLUGIN_ID = "templater-obsidian";

/** The slice of Templater's public plugin API this integration calls. Templater
 *  doesn't publish a types package — this is typed narrowly for just what
 *  create_new_note_from_template needs, matching its documented signature. */
interface TemplaterApi {
  create_new_note_from_template(
    template: TFile | string,
    folder?: TFolder | string,
    filename?: string,
    openNewNote?: boolean,
  ): Promise<TFile | undefined>;
}

/** The Templater plugin's exposed API, or null when Templater isn't installed
 *  or isn't enabled. `app.plugins` isn't part of the public Obsidian API
 *  surface, but is the standard way community plugins reach each other's
 *  public APIs (this is the same lookup Templater's own docs recommend for
 *  other plugin authors). */
function getTemplaterApi(app: App): TemplaterApi | null {
  const plugins = (app as unknown as { plugins?: { plugins?: Record<string, { templater?: TemplaterApi }> } })
    .plugins;
  return plugins?.plugins?.[TEMPLATER_PLUGIN_ID]?.templater ?? null;
}

/**
 * Create a new note by running the template's actual Templater script — its
 * frontmatter script block, `tp.file.include(...)`, `tp.file.move(...)`, etc.
 * — instead of this plugin trying to statically re-parse Templater syntax
 * (which can't evaluate JS or follow includes). `folder`/`filename` seed
 * where Templater starts creating the note; the template's own script may
 * still move/rename it, and the returned TFile reflects wherever it ends up.
 * Returns null when Templater isn't installed/enabled, so callers can fall
 * back to building the note directly from the template's Drawing block.
 */
export async function createNoteViaTemplater(
  app: App,
  template: TFile,
  folder: string,
  filename: string,
): Promise<TFile | null> {
  const templater = getTemplaterApi(app);
  if (!templater) return null;
  const file = await templater.create_new_note_from_template(template, folder, filename, false);
  return file ?? null;
}
