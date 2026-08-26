import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ZenDevTools } from "zen-devtools-mcp";

export const DEFAULT_PROFILE_PARENT = path.join(os.homedir(), ".zenmod");
export const DEFAULT_ZEN_PATH = "/Applications/Zen.app/Contents/MacOS/zen";
const BROWSER_DOCUMENT = "chrome://browser/content/browser.xhtml";

function remoteValueToNative(remoteValue) {
  if (!remoteValue || typeof remoteValue !== "object") {
    return remoteValue;
  }

  const { type, value } = remoteValue;
  switch (type) {
    case "undefined":
      return undefined;
    case "null":
      return null;
    case "string":
    case "boolean":
    case "number":
    case "date":
      return value;
    case "bigint":
      return `${value}n`;
    case "array":
    case "set":
      return value.map(remoteValueToNative);
    case "object":
      return Object.fromEntries(
        value.map(([key, item]) => [key, remoteValueToNative(item)])
      );
    case "map":
      return Object.fromEntries(
        value.map(([key, item]) => [
          String(remoteValueToNative(key)),
          remoteValueToNative(item),
        ])
      );
    case "regexp":
      return `/${value.pattern}/${value.flags ?? ""}`;
    default:
      return `[${type}]`;
  }
}

function exceptionMessage(details) {
  const exception = remoteValueToNative(details?.exception);
  const suffix = exception ? `\n${JSON.stringify(exception, null, 2)}` : "";
  return `${details?.text ?? "Privileged script failed"}${suffix}`;
}

export class ZenModSession {
  constructor(options = {}) {
    this.options = {
      headless: options.headless ?? true,
      height: options.height ?? 900,
      prefs: options.prefs ?? {},
      profileParent:
        options.profileParent ??
        process.env.ZENMOD_PROFILE_PARENT ??
        DEFAULT_PROFILE_PARENT,
      width: options.width ?? 1440,
      zenPath: options.zenPath ?? process.env.ZEN_PATH ?? DEFAULT_ZEN_PATH,
    };
    this.client = null;
    this.contextId = null;
  }

  async start() {
    this.client = new ZenDevTools({
      env: {
        MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: "1",
      },
      headless: this.options.headless,
      prefs: {
        "remote.prefs.recommended": false,
        ...this.options.prefs,
      },
      profilePath: this.options.profileParent,
      viewport: {
        height: this.options.height,
        width: this.options.width,
      },
      zenPath: this.options.zenPath,
    });

    try {
      await this.client.connect();
      await this.selectBrowserChrome();
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async selectBrowserChrome() {
    const tree = await this.client.sendBiDiCommand("browsingContext.getTree", {
      "moz:scope": "chrome",
    });
    const contexts = tree.contexts ?? [];
    const browserContext =
      contexts.find(context => context.url === BROWSER_DOCUMENT) ?? contexts[0];
    if (!browserContext) {
      throw new Error(
        "Zen exposed no privileged contexts. This build may not support MOZ_REMOTE_ALLOW_SYSTEM_ACCESS."
      );
    }

    const driver = this.client.getDriver();
    await driver.switchTo().window(browserContext.context);
    await driver.setContext("chrome");
    await driver.manage().setTimeouts({ script: 15000 });
    this.client.setCurrentContextId(browserContext.context);
    this.contextId = browserContext.context;
  }

  async loadMod(mod) {
    if (!this.client || !this.contextId) {
      throw new Error("Zen session has not started");
    }

    await this.applyPreferences(mod);
    if (mod.stylePath) {
      await this.applyStyle(mod.stylePath);
    }
    for (const scriptPath of mod.scripts) {
      await this.loadScript(scriptPath);
    }

    return {
      id: mod.id,
      preferences: mod.preferences.length,
      scripts: mod.scripts,
      style: mod.stylePath,
    };
  }

  async applyPreferences(mod) {
    const driver = this.client.getDriver();
    await driver.executeScript(
      `
        const [modName, preferences] = arguments;
        const sanitizedName =
          "theme-" + String(modName).replaceAll(/\\s/g, "-").replaceAll(/[^A-Za-z_-]+/g, "");
        const root = document.documentElement;

        for (const preference of preferences) {
          const { property, type, defaultValue } = preference;
          if (!property || defaultValue === undefined) {
            continue;
          }

          if (Services.prefs.getPrefType(property) === Services.prefs.PREF_INVALID) {
            if (type === "checkbox") {
              Services.prefs.setBoolPref(property, Boolean(defaultValue));
            } else {
              Services.prefs.setStringPref(property, String(defaultValue));
            }
          }

          const sanitizedProperty = property.replaceAll(".", "-");
          if (type === "dropdown") {
            let marker = document.getElementById(sanitizedName);
            if (!marker) {
              marker = document.createElement("div");
              marker.hidden = true;
              marker.id = sanitizedName;
              document.body.appendChild(marker);
            }
            marker.setAttribute(
              sanitizedProperty,
              Services.prefs.getStringPref(property, String(defaultValue))
            );
          } else if (type === "string") {
            root.style.setProperty(
              "--" + sanitizedProperty,
              Services.prefs.getStringPref(property, String(defaultValue))
            );
          }
        }
      `,
      mod.definition.name ?? mod.id,
      mod.preferences
    );
  }

  async applyStyle(stylePath) {
    const css = await readFile(stylePath, "utf8");
    const driver = this.client.getDriver();
    const result = await driver.executeScript(
      `
        const backend = Cc["@mozilla.org/zen/mods-backend;1"].getService(
          Ci.nsIZenModsBackend
        );
        return backend.rebuildModsStyles(arguments[0]);
      `,
      css
    );
    if (result !== 0 && result !== undefined && result !== null) {
      throw new Error(`Zen rejected ${stylePath} with result ${result}`);
    }
  }

  async loadScript(scriptPath) {
    const driver = this.client.getDriver();
    await driver.executeScript(
      `
        const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        file.initWithPath(arguments[0]);
        const uri = Services.io.newFileURI(file);
        Services.scriptloader.loadSubScript(uri.spec, window, "UTF-8");
      `,
      scriptPath
    );
  }

  async evaluateFunction(functionDeclaration) {
    const result = await this.client.sendBiDiCommand("script.callFunction", {
      arguments: [],
      awaitPromise: true,
      functionDeclaration,
      target: { context: this.contextId },
    });

    if (result.type === "success") {
      return remoteValueToNative(result.result);
    }
    if (result.type === "exception") {
      throw new Error(exceptionMessage(result.exceptionDetails));
    }
    throw new Error(`Unexpected privileged script result: ${result.type}`);
  }

  async inspect(selector, styleNames) {
    const serializedSelector = JSON.stringify(selector);
    const serializedStyles = JSON.stringify(styleNames);
    return this.evaluateFunction(`() => {
      const selector = ${serializedSelector};
      const styleNames = ${serializedStyles};
      return Array.from(document.querySelectorAll(selector)).map(element => {
        const bounds = element.getBoundingClientRect();
        const computed = getComputedStyle(element);
        return {
          attributes: Object.fromEntries(
            Array.from(element.attributes, attribute => [attribute.name, attribute.value])
          ),
          bounds: {
            height: bounds.height,
            width: bounds.width,
            x: bounds.x,
            y: bounds.y,
          },
          hidden: element.hidden,
          styles: Object.fromEntries(
            styleNames.map(name => [name, computed.getPropertyValue(name)])
          ),
          tag: element.localName,
          text: element.textContent?.trim() ?? "",
        };
      });
    }`);
  }

  async consoleMessages() {
    return this.client.getConsoleMessages();
  }

  async screenshot() {
    return this.client.takeScreenshotPage();
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.contextId = null;
    }
  }
}
