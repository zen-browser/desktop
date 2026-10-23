// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const DEFAULT_CONFIG_JSON = `{
  "url": "https://api.example.com/items",
  "params": {},
  "label": "",
  "icon": "",
  "headers": {},
  "mapping": {
    "items": "",
    "id": "id",
    "title": "title",
    "url": "url",
    "subtitle": "author"
  },
  "maxItems": 100
}`;

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ZenLiveFoldersManager: "resource:///modules/zen/ZenLiveFoldersManager.sys.mjs",
});

/**
 * Builds the config JSON object for a REST live folder.
 *
 * @param {object} state - The live folder state.
 * @returns {string} - JSON string of the config.
 */
function configToJson(state) {
  const config = {
    url: state.url ?? "https://api.example.com/items",
    params: state.params ?? {},
    label: state.label ?? "",
    icon: state.icon ?? "",
    headers: state.headers ?? {},
    mapping: state.mapping ?? {
      items: "",
      id: "id",
      title: "title",
      url: "url",
      subtitle: "author",
    },
    maxItems: state.maxItems ?? 100,
  };
  return JSON.stringify(config, null, 2);
}

/**
 * Opens the Custom REST API Live Folder creation or edit dialog.
 * The dialog shows a single JSON editor with the full config object.
 *
 * @param {Window} win - The browser window.
 * @param {object} [options] - Optional options.
 * @param {object} [options.liveFolder] - If provided, edit mode: pre-fill with this folder's config and update on save.
 * @returns {Promise<boolean>} - Resolves to true if a folder was created/updated, false if cancelled.
 */
export async function openRestLiveFolderDialog(win, options = {}) {
  const { liveFolder } = options;
  const isEditMode = !!liveFolder;

  const doc = win.document;
  const dialog = doc.createElementNS("http://www.w3.org/1999/xhtml", "dialog");
  dialog.setAttribute("id", "zen-rest-live-folder-dialog");
  dialog.className = "zen-rest-live-folder-dialog";

  const form = doc.createElementNS("http://www.w3.org/1999/xhtml", "form");
  form.method = "dialog";

  const titleEl = doc.createElementNS("http://www.w3.org/1999/xhtml", "h2");
  titleEl.className = "zen-rest-dialog-title";

  const configLabel = doc.createElementNS("http://www.w3.org/1999/xhtml", "label");
  configLabel.setAttribute("data-l10n-id", "zen-live-folder-rest-dialog-config");
  configLabel.htmlFor = "zen-rest-dialog-config";
  const configTextarea = doc.createElementNS("http://www.w3.org/1999/xhtml", "textarea");
  configTextarea.id = "zen-rest-dialog-config";
  configTextarea.rows = 20;
  configTextarea.spellcheck = false;
  configTextarea.value = isEditMode ? configToJson(liveFolder.state) : DEFAULT_CONFIG_JSON;

  const hintEl = doc.createElementNS("http://www.w3.org/1999/xhtml", "p");
  hintEl.className = "zen-rest-dialog-hint";

  const buttons = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  buttons.className = "zen-rest-dialog-buttons";
  const createBtn = doc.createElementNS("http://www.w3.org/1999/xhtml", "button");
  createBtn.type = "submit";
  createBtn.setAttribute(
    "data-l10n-id",
    isEditMode ? "zen-live-folder-rest-dialog-save" : "zen-live-folder-rest-dialog-create"
  );
  createBtn.className = "zen-rest-dialog-create";
  const cancelBtn = doc.createElementNS("http://www.w3.org/1999/xhtml", "button");
  cancelBtn.type = "button";
  cancelBtn.setAttribute("data-l10n-id", "zen-live-folder-rest-dialog-cancel");
  cancelBtn.className = "zen-rest-dialog-cancel";
  buttons.appendChild(createBtn);
  buttons.appendChild(cancelBtn);

  form.appendChild(titleEl);
  form.appendChild(configLabel);
  form.appendChild(configTextarea);
  form.appendChild(hintEl);
  form.appendChild(buttons);
  dialog.appendChild(form);

  doc.documentElement.appendChild(dialog);

  const titleId = isEditMode
    ? "zen-live-folder-rest-dialog-edit-title"
    : "zen-live-folder-rest-dialog-title";
  const createId = isEditMode
    ? "zen-live-folder-rest-dialog-save"
    : "zen-live-folder-rest-dialog-create";
  const ids = [
    titleId,
    "zen-live-folder-rest-dialog-config",
    createId,
    "zen-live-folder-rest-dialog-cancel",
    "zen-live-folder-rest-dialog-hint",
  ];
  let titleStr;
  let configLabelStr;
  let createLabelStr;
  let cancelLabelStr;
  let hintStr;
  try {
    [titleStr, configLabelStr, createLabelStr, cancelLabelStr, hintStr] =
      await doc.l10n.formatValues(ids);
  } catch {
    titleStr = isEditMode ? "Edit REST Live Folder" : "Create Custom REST Live Folder";
    configLabelStr = "Configuration (JSON)";
    createLabelStr = isEditMode ? "Save" : "Create";
    cancelLabelStr = "Cancel";
    hintStr =
      "Include: url, params (optional, for {placeholder} substitution and query string), label, icon (optional, use \"favicon\"), headers, mapping";
  }

  const fallback = (s, d) => (s != null && s !== "" ? s : d);
  dialog.setAttribute("aria-label", fallback(titleStr, "Edit REST Live Folder"));
  titleEl.textContent = fallback(titleStr, isEditMode ? "Edit REST Live Folder" : "Create Custom REST Live Folder");
  configLabel.textContent = fallback(configLabelStr, "Configuration (JSON)");
  createBtn.textContent = fallback(createLabelStr, isEditMode ? "Save" : "Create");
  cancelBtn.textContent = fallback(cancelLabelStr, "Cancel");
  hintEl.textContent = fallback(
    hintStr,
    'Include: url, label, icon (optional, use "favicon" for favicon from API origin), headers, mapping'
  );

  return new Promise((resolve) => {
    function cleanup() {
      dialog.remove();
    }

    cancelBtn.addEventListener("click", () => {
      dialog.close();
      cleanup();
      resolve(false);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      let config;
      try {
        config = JSON.parse(configTextarea.value || "{}");
      } catch {
        win.gZenUIManager?.showToast?.("zen-live-folder-rest-invalid-json", {
          timeout: 4000,
        });
        return;
      }

      const url = config.url;
      if (!url || typeof url !== "string") {
        win.gZenUIManager?.showToast?.("zen-live-folder-rest-invalid-url", {
          timeout: 4000,
        });
        return;
      }

      try {
        new URL(url);
      } catch {
        win.gZenUIManager?.showToast?.("zen-live-folder-rest-invalid-url", {
          timeout: 4000,
        });
        return;
      }

      const protocol = new URL(url).protocol;
      if (protocol !== "http:" && protocol !== "https:") {
        win.gZenUIManager?.showToast?.("zen-live-folder-rest-invalid-url", {
          timeout: 4000,
        });
        return;
      }

      const mapping = config.mapping;
      if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
        win.gZenUIManager?.showToast?.("zen-live-folder-rest-invalid-json", {
          timeout: 4000,
        });
        return;
      }

      const required = ["items", "id", "title", "url"];
      for (const key of required) {
        if (mapping[key] === undefined || mapping[key] === null) {
          win.gZenUIManager?.showToast?.("zen-live-folder-rest-invalid-json", {
            timeout: 4000,
          });
          return;
        }
      }

      let headers = {};
      if (config.headers && typeof config.headers === "object" && !Array.isArray(config.headers)) {
        for (const [k, v] of Object.entries(config.headers)) {
          if (k && v != null && typeof v === "string") {
            headers[k] = v;
          }
        }
      }

      let params = {};
      if (config.params && typeof config.params === "object" && !Array.isArray(config.params)) {
        for (const [k, v] of Object.entries(config.params)) {
          if (k && (v == null || typeof v === "string")) {
            params[k] = v;
          }
        }
      }

      const createConfig = {
        url,
        params: Object.keys(params).length > 0 ? params : undefined,
        mapping,
        label: config.label && typeof config.label === "string" ? config.label : undefined,
        icon: config.icon && typeof config.icon === "string" ? config.icon : undefined,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        maxItems:
          config.maxItems != null && Number.isFinite(config.maxItems) ? config.maxItems : undefined,
      };

      let success = false;
      if (isEditMode) {
        success = await lazy.ZenLiveFoldersManager.updateFolderFromRestConfig(
          liveFolder.id,
          createConfig
        );
      } else {
        const created = await lazy.ZenLiveFoldersManager.createFolderFromRestConfig(
          win,
          createConfig
        );
        success = created !== -1;
      }

      dialog.close();
      cleanup();
      resolve(success);
    });

    dialog.showModal();
  });
}
