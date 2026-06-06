/**
 * Ambient declaration for svgedit's self-contained editor bundle.
 *
 * The import specifier is mapped by esbuild's `alias` to `svgedit-dist/Editor.js`
 * (the prebuilt ESM bundle). This declaration keeps `tsc` happy without making it
 * type-check the 4 MB build artifact; the real shape is asserted at the call site
 * via the `SvgEditorInstance` interface in SvgView.ts.
 */
declare module "svgedit-editor" {
  const Editor: new (container: HTMLElement) => unknown;
  export default Editor;
}
