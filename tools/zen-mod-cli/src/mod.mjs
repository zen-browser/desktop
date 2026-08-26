import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveModFile(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Mod file escapes its directory: ${relativePath}`);
  }
  return resolved;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${filePath}: ${error.message}`);
  }
}

async function readManifest(root) {
  const manifestPath = path.join(root, "sine-mod.json");
  if (!(await exists(manifestPath))) {
    return null;
  }

  const manifest = await readJson(manifestPath);
  const entries = Object.entries(manifest);
  if (entries.length !== 1) {
    throw new Error("sine-mod.json must contain exactly one local mod");
  }

  const [id, definition] = entries[0];
  if (!definition || typeof definition !== "object") {
    throw new Error(`Invalid manifest entry for ${id}`);
  }
  return { definition, id, manifestPath };
}

function scriptNames(definition) {
  if (!definition?.scripts) {
    return [];
  }
  if (Array.isArray(definition.scripts)) {
    return definition.scripts;
  }
  return Object.entries(definition.scripts)
    .filter(([, config]) => {
      const includes = config?.include;
      return (
        !Array.isArray(includes) ||
        includes.includes("chrome://browser/content/browser.xhtml")
      );
    })
    .map(([name]) => name);
}

export async function readMod(modDirectory) {
  const root = path.resolve(modDirectory);
  if (!(await exists(root))) {
    throw new Error(`Mod directory does not exist: ${root}`);
  }

  const manifest = await readManifest(root);
  const directoryEntries = await readdir(root);
  const fallbackScripts = directoryEntries
    .filter(name => name.endsWith(".uc.js"))
    .sort();
  const scripts = (
    manifest ? scriptNames(manifest.definition) : fallbackScripts
  ).map(name => resolveModFile(root, name));

  for (const script of scripts) {
    if (!(await exists(script))) {
      throw new Error(`Manifest script does not exist: ${script}`);
    }
  }

  const styleConfig = manifest?.definition?.style;
  const styleName =
    typeof styleConfig === "string"
      ? styleConfig
      : styleConfig?.chrome ||
        (directoryEntries.includes("chrome.css") ? "chrome.css" : null);
  const stylePath = styleName ? resolveModFile(root, styleName) : null;
  if (stylePath && !(await exists(stylePath))) {
    throw new Error(`Manifest stylesheet does not exist: ${stylePath}`);
  }

  const preferencesName = manifest?.definition?.preferences;
  const preferencesPath = preferencesName
    ? resolveModFile(root, preferencesName)
    : directoryEntries.includes("preferences.json")
      ? path.join(root, "preferences.json")
      : null;
  const preferences =
    preferencesPath && (await exists(preferencesPath))
      ? await readJson(preferencesPath)
      : [];
  if (!Array.isArray(preferences)) {
    throw new Error("preferences.json must contain an array");
  }

  return {
    definition: manifest?.definition ?? {},
    id: manifest?.id ?? path.basename(root),
    preferences,
    root,
    scripts,
    stylePath,
  };
}
