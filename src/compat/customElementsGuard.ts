/**
 * Obsidian-specific workaround — must be imported before the svgedit bundle.
 *
 * The inlined svgedit bundle (svgedit-dist/Editor.js) makes ~39 top-level
 * `customElements.define(...)` calls when its module is evaluated. Obsidian
 * re-evaluates the plugin's main.js from scratch every time the plugin is
 * re-enabled, but the CustomElementRegistry lives on `window` and survives the
 * reload. The second evaluation therefore hits "'se-button' has already been
 * used with this registry", which throws during module load — before
 * SvgPlugin.onload() runs — so the plugin silently fails to re-enable until the
 * vault (and its window) is reopened.
 *
 * Making define() a no-op for names that are already registered keeps the first
 * load's element definitions in force and lets every later reload load cleanly.
 */
const registry = window.customElements;
const originalDefine = registry.define.bind(registry);

registry.define = function (
  name: string,
  constructor: CustomElementConstructor,
  options?: ElementDefinitionOptions,
): void {
  if (registry.get(name)) return;
  originalDefine(name, constructor, options);
};

export {};
