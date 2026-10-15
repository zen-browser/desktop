/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * about:vault: shows the lock screen, the setup steps or the sections,
 * depending on PeppermintVault.state, and re-renders whenever that changes.
 */

import {
  clear,
  h,
  ICONS,
} from "chrome://browser/content/peppermint-vault/dom.mjs";
import { createLockScreen } from "chrome://browser/content/peppermint-vault/lock-screen.mjs";
import { closeModal } from "chrome://browser/content/peppermint-vault/modal.mjs";
import { createSectionView } from "chrome://browser/content/peppermint-vault/section-view.mjs";
import { createSetup } from "chrome://browser/content/peppermint-vault/setup.mjs";

const { PeppermintVault } = ChromeUtils.importESModule(
  "moz-src:///peppermint/vault/PeppermintVault.sys.mjs"
);
const { PeppermintVaultPassword } = ChromeUtils.importESModule(
  "moz-src:///peppermint/vault/PeppermintVaultPassword.sys.mjs"
);
const { PeppermintVaultRegistry } = ChromeUtils.importESModule(
  "moz-src:///peppermint/vault/PeppermintVaultRegistry.sys.mjs"
);
const { PeppermintVaultSession, STATE_TOPIC } = ChromeUtils.importESModule(
  "moz-src:///peppermint/vault/PeppermintVaultSession.sys.mjs"
);

const AGENT_SHEET =
  "chrome://browser/content/zen-styles/peppermint-vault-agent.css";
const TOAST_MS = 3500;
const CONFIRM_RESET_MS = 3000;
const AUTO_LOCK_REASONS = new Set(["idle", "sleep", "hidden"]);

try {
  const utils = window.windowUtils;
  utils.loadSheetUsingURIString(AGENT_SHEET, utils.AGENT_SHEET);
} catch {
  // The sheet is already loaded for this document.
}

const pageId = crypto.randomUUID();
const root = document.getElementById("vault-root");
const toastEl = document.getElementById("vault-toast");

let currentView = null;
let currentSectionId = null;
let confirmDialog = null;
let toastTimer = null;
let setupDone = null;
let renderQueued = false;

function toast(l10n, args) {
  document.l10n.setAttributes(toastEl, l10n, args);
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), TOAST_MS);
}

function closeConfirm(reject = null) {
  if (!confirmDialog) {
    return;
  }
  const { dialog, fail } = confirmDialog;
  confirmDialog = null;
  dialog.close();
  dialog.remove();
  if (reject) {
    fail(reject);
  }
}

/** Asks for the Primary Password before a sensitive action. */
function confirmPassword() {
  closeConfirm();
  return new Promise((resolve, reject) => {
    const cancel = () => {
      const error = new Error("cancelled");
      error.name = "VaultStepUpCancelled";
      closeConfirm(error);
    };
    const lockScreen = createLockScreen({
      session: PeppermintVaultSession,
      titleL10n: "peppermint-vault-confirm-title",
      descriptionL10n: "peppermint-vault-confirm-description",
      onUnlocked: () => {
        closeConfirm();
        resolve();
      },
      onCancel: cancel,
    });
    const dialog = h("dialog", { class: "vault-modal" }, lockScreen);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      cancel();
    });
    document.body.append(dialog);
    confirmDialog = { dialog, fail: reject };
    dialog.showModal();
  });
}

const api = {
  async call(sectionId, method, ...args) {
    try {
      return await PeppermintVaultRegistry.call(sectionId, method, ...args);
    } catch (error) {
      if (error.name == "VaultStepUpRequiredError") {
        await confirmPassword();
        return PeppermintVaultRegistry.call(sectionId, method, ...args);
      }
      throw error;
    }
  },
};

function renderShell() {
  const sections = PeppermintVaultRegistry.describeAll().filter(
    section => section.availability.available
  );
  if (!sections.length) {
    root.append(
      h("p", {
        class: "vault-card vault-muted",
        l10n: "peppermint-vault-unavailable",
      })
    );
    return;
  }
  const active =
    sections.find(section => section.id == currentSectionId) ?? sections[0];
  currentSectionId = active.id;

  const params = new URLSearchParams(window.location.search);
  const view = createSectionView({
    section: active,
    api: { call: (method, ...args) => api.call(active.id, method, ...args) },
    toast,
    query: params.get("filter") ?? "",
  });
  currentView = view;

  const tabs =
    sections.length > 1
      ? h(
          "nav",
          { class: "vault-tabs", l10n: "peppermint-vault-sections-label" },
          sections.map(section =>
            h(
              "button",
              {
                class: "vault-tab",
                attrs: {
                  type: "button",
                  "aria-current": section.id == active.id ? "page" : null,
                },
                on: {
                  click() {
                    currentSectionId = section.id;
                    scheduleRender();
                  },
                },
              },
              h("img", {
                class: "vault-icon",
                attrs: { src: section.icon ?? ICONS.vault, alt: "" },
              }),
              h("span", { l10n: section.titleL10nId })
            )
          )
        )
      : null;

  let offTimer = null;
  const turnOff = h("button", {
    class: "vault-link-button vault-danger",
    attrs: { type: "button" },
    l10n: "peppermint-vault-turn-off",
    on: {
      async click() {
        if (!offTimer) {
          document.l10n.setAttributes(
            turnOff,
            "peppermint-vault-turn-off-confirm"
          );
          offTimer = setTimeout(() => {
            offTimer = null;
            document.l10n.setAttributes(turnOff, "peppermint-vault-turn-off");
          }, CONFIRM_RESET_MS);
          return;
        }
        clearTimeout(offTimer);
        try {
          try {
            PeppermintVault.disable();
          } catch (error) {
            if (error.name != "VaultStepUpRequiredError") {
              throw error;
            }
            await confirmPassword();
            PeppermintVault.disable();
          }
          scheduleRender();
        } catch (error) {
          if (error.name != "VaultStepUpCancelled") {
            toast("peppermint-vault-error-generic");
          }
        }
      },
    },
  });

  const header = h(
    "header",
    { class: "vault-topbar" },
    h(
      "div",
      { class: "vault-brand" },
      h("img", {
        class: "vault-brand-icon",
        attrs: { src: ICONS.vault, alt: "" },
      }),
      h("h1", { class: "vault-title", l10n: "peppermint-vault-title" })
    ),
    h(
      "button",
      {
        class: "vault-button",
        attrs: { type: "button" },
        on: { click: () => PeppermintVaultSession.lock("manual") },
      },
      h("span", { l10n: "peppermint-vault-lock-now" })
    )
  );

  const footer = h(
    "footer",
    { class: "vault-footer" },
    h("button", {
      class: "vault-link-button",
      attrs: { type: "button" },
      l10n: "peppermint-vault-settings",
      on: {
        click: () =>
          Services.wm
            .getMostRecentBrowserWindow()
            ?.openPreferences("privacy-logins"),
      },
    }),
    turnOff
  );

  root.append(
    h(
      "div",
      { class: "vault-page" },
      header,
      tabs,
      h(
        "main",
        { class: "vault-main" },
        h("h2", {
          class: "vault-visually-hidden",
          attrs: { id: "vault-section-title" },
          l10n: active.titleL10nId,
        }),
        view.element
      ),
      footer
    )
  );
  view.refresh();
}

function renderLocked() {
  const reason = PeppermintVaultSession.lastLockReason;
  root.append(
    createLockScreen({
      session: PeppermintVaultSession,
      lockReason: AUTO_LOCK_REASONS.has(reason) ? reason : null,
      onUnlocked: scheduleRender,
    })
  );
}

function renderSetup(mode) {
  root.append(
    createSetup({
      mode,
      password: PeppermintVaultPassword,
      vault: PeppermintVault,
      session: PeppermintVaultSession,
      onDone: ({ shortPassword }) => {
        setupDone = { shortPassword };
        scheduleRender();
      },
    })
  );
}

function render() {
  renderQueued = false;
  currentView?.destroy();
  currentView = null;
  closeModal();
  closeConfirm();
  clear(root);

  if (setupDone && PeppermintVault.state == "unlocked") {
    toast(
      setupDone.shortPassword
        ? "peppermint-vault-toast-ready-short"
        : "peppermint-vault-toast-ready"
    );
    setupDone = null;
  }

  switch (PeppermintVault.state) {
    case "off":
      renderSetup("enable");
      break;
    case "needs-password":
      renderSetup("restore");
      break;
    case "unavailable":
      root.append(
        h("p", {
          class: "vault-card vault-muted",
          l10n: "peppermint-vault-unavailable",
        })
      );
      break;
    case "locked":
      renderLocked();
      break;
    default:
      renderShell();
  }
}

function scheduleRender() {
  if (!renderQueued) {
    renderQueued = true;
    queueMicrotask(render);
  }
}

const observer = {
  QueryInterface: ChromeUtils.generateQI([
    "nsIObserver",
    "nsISupportsWeakReference",
  ]),
  observe(_subject, topic) {
    if (topic == "passwordmgr-storage-changed") {
      currentView?.refresh();
    } else {
      scheduleRender();
    }
  },
};
const TOPICS = [
  STATE_TOPIC,
  "passwordmgr-primary-pw-changed",
  "passwordmgr-storage-changed",
];
for (const topic of TOPICS) {
  Services.obs.addObserver(observer, topic);
}

function reportVisibility() {
  PeppermintVaultSession.setPageVisible(pageId, !document.hidden);
}
document.addEventListener("visibilitychange", reportVisibility);
reportVisibility();

document.addEventListener("keydown", event => {
  if (
    event.key == "/" &&
    !event.target.closest("input, textarea, select, dialog") &&
    currentView
  ) {
    event.preventDefault();
    currentView.focusSearch();
  }
});

window.addEventListener(
  "pagehide",
  () => {
    for (const topic of TOPICS) {
      Services.obs.removeObserver(observer, topic);
    }
    PeppermintVaultSession.removePage(pageId);
    currentView?.destroy();
    closeModal();
  },
  { once: true }
);

render();
