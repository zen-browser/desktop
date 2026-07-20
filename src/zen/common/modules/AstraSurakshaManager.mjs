/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Lazy Suraksha advanced manager. Attaches to bootstrap; never replaces
 * window.gAstraSuraksha. Kept intentionally small — adapters own status logic.
 */

import { readConnection } from "chrome://browser/content/zen-components/AstraSurakshaConnection.mjs";
import {
  readProtection,
  openProtectionPanel,
  openProtectionDashboard,
} from "chrome://browser/content/zen-components/AstraSurakshaProtection.mjs";
import {
  readUBlock,
  openUBlockBrowserAction,
  manageUBlock,
  openAddonsManager,
} from "chrome://browser/content/zen-components/AstraSurakshaUBlock.mjs";
import {
  readPermissions,
  openPermissionManager,
} from "chrome://browser/content/zen-components/AstraSurakshaPermissions.mjs";
import {
  getSiteDataContext,
  readSiteData,
  clearSiteData,
} from "chrome://browser/content/zen-components/AstraSurakshaSiteData.mjs";
import {
  readCleanLink,
  copyCleanLink,
} from "chrome://browser/content/zen-components/AstraSurakshaCleanLink.mjs";
import {
  readSafeBrowsing,
  openSafeBrowsingSettings,
} from "chrome://browser/content/zen-components/AstraSurakshaSafeBrowsing.mjs";
import {
  readPasswords,
  openPasswordManager,
  openPasswordSettings,
} from "chrome://browser/content/zen-components/AstraSurakshaPasswords.mjs";

const LOG_PREFIX = "[AstraSuraksha]";
const PANEL_ID = "PanelUI-astra-suraksha";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

class AstraSurakshaManager {
  #generation = 0;
  #destroyed = false;
  #boundTabSelect = null;
  #boundProgress = null;
  #boundRefreshClick = null;
  #boundAdvancedClick = null;
  #listenersBound = false;
  #addonListener = null;

  constructor() {
    // Native Suraksha path owns the UX. Keep this module inert if present.
    if (window.gAstraSurakshaDiagnostics?.nativeMode) {
      console.log(
        `${LOG_PREFIX} legacy manager suppressed; native protections path active`
      );
      this.#destroyed = true;
      return;
    }
    window.gAstraSurakshaManager = this;
    try {
      window.gAstraSurakshaBootstrap?.attachManager?.(this);
      this.#ensureListeners();
      window.gAstraSurakshaBootstrap?.setAdvancedReady?.(true);
    } catch (error) {
      window.gAstraSurakshaBootstrap?.markManagerFailed?.(error, "init");
    }
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#generation += 1;
    this.#teardownListeners();
    try {
      window.gAstraSurakshaBootstrap?.setAdvancedReady?.(false);
    } catch {
      // ignore
    }
  }

  get panel() {
    return document.getElementById(PANEL_ID);
  }

  get isOpen() {
    const panel = this.panel;
    if (!panel) {
      return false;
    }
    const state = panel.state;
    return state === "open" || state === "showing";
  }

  #ensureListeners() {
    if (this.#listenersBound || this.#destroyed) {
      return;
    }
    this.#boundTabSelect = () => {
      if (this.isOpen) {
        void this.refresh();
      }
    };
    this.#boundProgress = {
      onLocationChange: (aWebProgress, _aRequest, _aLocation) => {
        if (aWebProgress?.isTopLevel && this.isOpen) {
          void this.refresh();
        }
      },
    };
    this.#boundRefreshClick = event => {
      event?.preventDefault?.();
      void this.refresh();
    };
    this.#boundAdvancedClick = event => this.#onAdvancedClick(event);

    try {
      window.gBrowser?.tabContainer?.addEventListener(
        "TabSelect",
        this.#boundTabSelect
      );
      window.gBrowser?.addProgressListener?.(this.#boundProgress);
    } catch {
      // ignore
    }

    const refreshBtn = document.getElementById("astra-suraksha-refresh");
    refreshBtn?.addEventListener("click", this.#boundRefreshClick);

    const advanced = document.getElementById("PanelUI-astra-suraksha-advanced");
    advanced?.addEventListener("click", this.#boundAdvancedClick);

    try {
      const { AddonManager } = ChromeUtils.importESModule(
        "resource://gre/modules/AddonManager.sys.mjs"
      );
      this.#addonListener = {
        onEnabled: () => this.#maybeRefreshAddons(),
        onDisabled: () => this.#maybeRefreshAddons(),
        onInstalled: () => this.#maybeRefreshAddons(),
        onUninstalled: () => this.#maybeRefreshAddons(),
      };
      AddonManager.addAddonListener(this.#addonListener);
    } catch {
      this.#addonListener = null;
    }

    this.#listenersBound = true;
  }

  #teardownListeners() {
    if (!this.#listenersBound) {
      return;
    }
    try {
      window.gBrowser?.tabContainer?.removeEventListener(
        "TabSelect",
        this.#boundTabSelect
      );
      window.gBrowser?.removeProgressListener?.(this.#boundProgress);
    } catch {
      // ignore
    }
    document
      .getElementById("astra-suraksha-refresh")
      ?.removeEventListener("click", this.#boundRefreshClick);
    document
      .getElementById("PanelUI-astra-suraksha-advanced")
      ?.removeEventListener("click", this.#boundAdvancedClick);
    if (this.#addonListener) {
      try {
        const { AddonManager } = ChromeUtils.importESModule(
          "resource://gre/modules/AddonManager.sys.mjs"
        );
        AddonManager.removeAddonListener(this.#addonListener);
      } catch {
        // ignore
      }
      this.#addonListener = null;
    }
    this.#listenersBound = false;
  }

  #maybeRefreshAddons() {
    if (this.#destroyed || !this.isOpen) {
      return;
    }
    void this.refresh();
  }

  onShellOpened(_options) {
    if (this.#destroyed) {
      return;
    }
    window.gAstraSurakshaBootstrap?.setAdvancedReady?.(true);
    void this.refresh();
  }

  close(_options = {}) {
    const panel = this.panel;
    if (!panel || !this.isOpen) {
      return;
    }
    try {
      panel.hidePopup();
    } catch {
      // ignore
    }
  }

  async refresh(_options = {}) {
    if (this.#destroyed) {
      return;
    }
    const generation = ++this.#generation;
    const win = window;

    this.#setModeLabel("advanced");
    this.#showCardLoading("astra-suraksha-card-connection");
    this.#showCardLoading("astra-suraksha-card-protection");
    this.#showCardLoading("astra-suraksha-card-ublock");
    this.#showCardLoading("astra-suraksha-card-safebrowsing");
    this.#showCardLoading("astra-suraksha-card-passwords");
    this.#showCardLoading("astra-suraksha-card-permissions");
    this.#showCardLoading("astra-suraksha-card-site-data");
    this.#showCardLoading("astra-suraksha-card-clean-link");

    const siteCtx = getSiteDataContext(win);

    const tasks = [
      this.#safe(() => readConnection(win)).then(result => {
        if (!this.#isCurrent(generation)) {
          return;
        }
        this.#renderConnection(result);
      }),
      this.#safe(() => readProtection(win)).then(result => {
        if (!this.#isCurrent(generation)) {
          return;
        }
        this.#renderProtection(result);
      }),
      this.#safe(() => readUBlock(win)).then(result => {
        if (!this.#isCurrent(generation)) {
          return;
        }
        this.#renderUBlock(result);
      }),
      this.#safe(() => readSafeBrowsing(win)).then(result => {
        if (!this.#isCurrent(generation)) {
          return;
        }
        this.#renderSafeBrowsing(result);
      }),
      this.#safe(() => readPasswords(win)).then(result => {
        if (!this.#isCurrent(generation)) {
          return;
        }
        this.#renderPasswords(result);
      }),
      this.#safe(() => readPermissions(win)).then(result => {
        if (!this.#isCurrent(generation)) {
          return;
        }
        this.#renderPermissions(result);
      }),
      this.#safe(() => readCleanLink(win)).then(result => {
        if (!this.#isCurrent(generation)) {
          return;
        }
        this.#renderCleanLink(result);
      }),
    ];

    // Site data: show checking, then async presence.
    this.#renderSiteData({
      available: true,
      state: siteCtx.state === "private" || siteCtx.state === "na" ? siteCtx.state : "checking",
      labelId:
        siteCtx.state === "private" || siteCtx.state === "na"
          ? "astra-suraksha-not-applicable"
          : "astra-suraksha-site-data-checking",
      actions: [],
    });
    if (siteCtx.state === "pending" && siteCtx.asciiHost) {
      tasks.push(
        this.#safe(() => readSiteData(win, siteCtx.asciiHost)).then(result => {
          if (!this.#isCurrent(generation) || result?.stale) {
            return;
          }
          this.#renderSiteData(result);
        })
      );
    }

    await Promise.allSettled(tasks);
  }

  #isCurrent(generation) {
    return !this.#destroyed && generation === this.#generation;
  }

  async #safe(fn) {
    try {
      return await fn();
    } catch {
      return {
        available: false,
        state: "error",
        labelId: "astra-suraksha-error",
        detailId: null,
        actions: [],
      };
    }
  }

  #setModeLabel(mode) {
    const el = document.getElementById("astra-suraksha-mode-label");
    if (!el) {
      return;
    }
    try {
      document.l10n?.setAttributes?.(
        el,
        mode === "advanced"
          ? "astra-suraksha-subtitle"
          : "astra-suraksha-mode-fallback"
      );
    } catch {
      // ignore
    }
  }

  #variantForState(state) {
    switch (String(state || "")) {
      case "secure":
      case "ok":
      case "active":
      case "present":
      case "ready":
      case "has":
        return "good";
      case "warn":
      case "exception":
      case "disabled":
      case "not-secure":
      case "partial":
      case "private":
        return "attention";
      case "broken":
      case "cert-error":
      case "https-only-error":
      case "net-error":
      case "error":
      case "missing":
      case "app-disabled":
        return "danger";
      case "loading":
      case "checking":
      case "pending":
        return "loading";
      default:
        return "neutral";
    }
  }

  #applyCardVariant(card, state) {
    if (!card) {
      return;
    }
    const resolved = state || "error";
    card.setAttribute("data-state", resolved);
    card.setAttribute("data-variant", this.#variantForState(resolved));
  }

  #showCardLoading(cardId) {
    const card = document.getElementById(cardId);
    const status = document.querySelector(`#${cardId} .astra-suraksha-card-status`);
    if (status) {
      status.hidden = false;
      try {
        document.l10n?.setAttributes?.(status, "astra-suraksha-loading");
      } catch {
        // ignore
      }
    }
    this.#applyCardVariant(card, "loading");
  }

  #setL10n(el, id, args) {
    if (!el || !id) {
      return;
    }
    try {
      if (args) {
        document.l10n.setAttributes(el, id, args);
      } else {
        document.l10n.setAttributes(el, id);
      }
    } catch {
      // ignore missing strings
    }
  }

  #htmlEl(tag) {
    return document.createElementNS(XHTML_NS, tag);
  }

  #clearChildren(node) {
    if (!node) {
      return;
    }
    while (node.firstChild) {
      node.firstChild.remove();
    }
  }

  #renderActionButtons(container, actions) {
    if (!container) {
      return;
    }
    // Preserve a More Details control if already placed in this actions row.
    const more = container.querySelector(".astra-suraksha-more-details");
    this.#clearChildren(container);
    if (more) {
      container.appendChild(more);
    }
    if (!actions?.length) {
      return;
    }
    for (const action of actions) {
      const btn = this.#htmlEl("button");
      btn.type = "button";
      btn.classList.add("astra-suraksha-action", "astra-suraksha-action-compact");
      btn.setAttribute("data-suraksha-action", action.id);
      this.#setL10n(btn, action.labelId);
      container.appendChild(btn);
    }
  }

  #renderConnection(result) {
    const card = document.getElementById("astra-suraksha-card-connection");
    if (!card) {
      return;
    }
    const hostEl = card.querySelector(".astra-suraksha-hostname");
    const status = card.querySelector(".astra-suraksha-card-status");
    const detail = card.querySelector(".astra-suraksha-card-detail");
    const actions = card.querySelector(".astra-suraksha-card-actions");
    if (hostEl) {
      if (result?.hostname) {
        hostEl.removeAttribute("data-l10n-id");
        hostEl.textContent = result.hostname;
      } else {
        this.#setL10n(hostEl, "astra-suraksha-hostname-unknown");
      }
    }
    this.#setL10n(status, result?.labelId || "astra-suraksha-error");
    if (detail) {
      if (result?.detailId) {
        detail.hidden = false;
        this.#setL10n(detail, result.detailId);
      } else {
        detail.hidden = true;
      }
    }
    this.#renderActionButtons(actions, result?.actions || []);
    this.#applyCardVariant(card, result?.state || "error");
  }

  #renderProtection(result) {
    const card = document.getElementById("astra-suraksha-card-protection");
    if (!card) {
      return;
    }
    const status = card.querySelector(".astra-suraksha-card-status");
    const detail = card.querySelector(".astra-suraksha-card-detail");
    const actions = card.querySelector(".astra-suraksha-card-actions");
    this.#setL10n(status, result?.labelId || "astra-suraksha-error");
    if (detail) {
      if (result?.detailId && result?.modeId) {
        detail.hidden = false;
        try {
          const modeLabel = this.#htmlEl("span");
          document.l10n.setAttributes(modeLabel, result.modeId);
          document.l10n
            .translateElements([modeLabel])
            .then(() => {
              const mode = modeLabel.textContent || "";
              document.l10n.setAttributes(detail, result.detailId, { mode });
            })
            .catch(() => {
              this.#setL10n(detail, result.detailId, { mode: "" });
            });
        } catch {
          this.#setL10n(detail, result.detailId, { mode: "" });
        }
      } else {
        detail.hidden = true;
      }
    }
    this.#renderActionButtons(actions, result?.actions || []);
    this.#applyCardVariant(card, result?.state || "error");
  }

  #renderUBlock(result) {
    const card = document.getElementById("astra-suraksha-card-ublock");
    if (!card) {
      return;
    }
    const status = card.querySelector(".astra-suraksha-card-status");
    const detail = card.querySelector(".astra-suraksha-card-detail");
    const actions = card.querySelector(".astra-suraksha-card-actions");
    this.#setL10n(status, result?.labelId || "astra-suraksha-error");
    if (detail) {
      const first = result?.details?.[0];
      if (first?.id) {
        detail.hidden = false;
        if (first.version) {
          this.#setL10n(detail, first.id, { version: first.version });
        } else {
          this.#setL10n(detail, first.id);
        }
      } else if (result?.version) {
        detail.hidden = false;
        this.#setL10n(detail, "astra-suraksha-ublock-version", {
          version: result.version,
        });
      } else {
        detail.hidden = true;
      }
    }
    this.#renderActionButtons(actions, result?.actions || []);
    this.#applyCardVariant(card, result?.state || "error");
  }

  #renderDetailListCard(cardId, result) {
    const card = document.getElementById(cardId);
    if (!card) {
      return;
    }
    const status = card.querySelector(".astra-suraksha-card-status");
    const detail = card.querySelector(".astra-suraksha-card-detail");
    const detailsBox = card.querySelector(".astra-suraksha-card-details");
    const actions = card.querySelector(".astra-suraksha-card-actions");
    if (status) {
      status.hidden = false;
    }
    this.#setL10n(status, result?.labelId || "astra-suraksha-error");

    // Drop prior more-details / extras before rebuild (no duplicates on refresh).
    actions
      ?.querySelectorAll(".astra-suraksha-more-details")
      .forEach(node => node.remove());
    card
      .querySelectorAll(".astra-suraksha-card-detail-extra")
      .forEach(node => node.remove());
    if (detailsBox) {
      this.#clearChildren(detailsBox);
      detailsBox.hidden = true;
      detailsBox.setAttribute("hidden", "true");
    }

    const details = result?.details || [];
    if (detail) {
      if (details[0]?.id) {
        detail.hidden = false;
        this.#setL10n(detail, details[0].id);
        if (details.length > 1 && detailsBox && actions) {
          const detailsId = detailsBox.id || `${cardId}-details`;
          detailsBox.id = detailsId;
          detailsBox.setAttribute(
            "data-pending-details",
            JSON.stringify(details.slice(1).map(d => d.id).filter(Boolean))
          );
          const more = this.#htmlEl("button");
          more.type = "button";
          more.classList.add(
            "astra-suraksha-action",
            "astra-suraksha-action-compact",
            "astra-suraksha-more-details"
          );
          more.setAttribute("aria-expanded", "false");
          more.setAttribute("aria-controls", detailsId);
          more.setAttribute("data-suraksha-toggle-details", detailsId);
          this.#setL10n(more, "astra-suraksha-more-details");
          actions.appendChild(more);
        }
      } else {
        detail.hidden = true;
      }
    }
    this.#renderActionButtons(actions, result?.actions || []);
    this.#applyCardVariant(card, result?.state || "error");
  }

  #renderSafeBrowsing(result) {
    this.#renderDetailListCard("astra-suraksha-card-safebrowsing", result);
  }

  #renderPasswords(result) {
    this.#renderDetailListCard("astra-suraksha-card-passwords", result);
  }

  #renderPermissions(result) {
    const card = document.getElementById("astra-suraksha-card-permissions");
    if (!card) {
      return;
    }
    const status = card.querySelector(".astra-suraksha-card-status");
    const list = card.querySelector(".astra-suraksha-perm-list");
    const actions = card.querySelector(".astra-suraksha-card-actions");
    this.#clearChildren(list);
    if (!result?.available) {
      this.#setL10n(status, result?.labelId || "astra-suraksha-error");
    } else if (!result.items?.length) {
      this.#setL10n(status, result.labelId || "astra-suraksha-perm-empty");
    } else {
      status.hidden = true;
      for (const item of result.items) {
        const row = this.#htmlEl("div");
        row.classList.add("astra-suraksha-perm-row");
        const name = this.#htmlEl("span");
        name.classList.add("astra-suraksha-perm-name");
        name.textContent = item.name;
        const state = this.#htmlEl("span");
        state.classList.add("astra-suraksha-perm-state");
        this.#setL10n(state, item.stateLabelId);
        row.appendChild(name);
        row.appendChild(state);
        if (item.temporary) {
          const temp = this.#htmlEl("span");
          temp.classList.add("astra-suraksha-perm-temp");
          this.#setL10n(temp, "astra-suraksha-perm-temporary");
          row.appendChild(temp);
        }
        list.appendChild(row);
      }
    }
    if (status && result?.items?.length) {
      status.hidden = true;
    } else if (status) {
      status.hidden = false;
    }
    this.#renderActionButtons(actions, result?.actions || []);
    this.#applyCardVariant(card, result?.state || "error");
  }

  #renderSiteData(result) {
    const card = document.getElementById("astra-suraksha-card-site-data");
    if (!card) {
      return;
    }
    const status = card.querySelector(".astra-suraksha-card-status");
    const actions = card.querySelector(".astra-suraksha-card-actions");
    if (status) {
      status.hidden = false;
    }
    this.#setL10n(status, result?.labelId || "astra-suraksha-error");
    this.#renderActionButtons(actions, result?.actions || []);
    this.#applyCardVariant(card, result?.state || "error");
  }

  #renderCleanLink(result) {
    const card = document.getElementById("astra-suraksha-card-clean-link");
    if (!card) {
      return;
    }
    if (result?.state === "hidden") {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const status = card.querySelector(".astra-suraksha-card-status");
    const actions = card.querySelector(".astra-suraksha-card-actions");
    if (status) {
      status.hidden = false;
    }
    this.#setL10n(status, result?.labelId || "astra-suraksha-error");
    this.#renderActionButtons(actions, result?.actions || []);
    this.#applyCardVariant(card, result?.state || "error");
  }

  #toggleDetails(detailsId, trigger) {
    const detailsBox = document.getElementById(detailsId);
    if (!detailsBox || !trigger) {
      return;
    }
    const currentlyHidden = !!detailsBox.hidden;
    if (currentlyHidden) {
      detailsBox.hidden = false;
      detailsBox.removeAttribute("hidden");
      trigger.setAttribute("aria-expanded", "true");
      if (!detailsBox.childElementCount) {
        const pending = detailsBox.getAttribute("data-pending-details");
        if (pending) {
          try {
            const ids = JSON.parse(pending);
            for (const id of ids) {
              const extra = this.#htmlEl("p");
              extra.classList.add(
                "astra-suraksha-card-detail",
                "astra-suraksha-card-detail-extra"
              );
              this.#setL10n(extra, id);
              detailsBox.appendChild(extra);
            }
          } catch {
            // ignore malformed pending payload
          }
          detailsBox.removeAttribute("data-pending-details");
        }
      }
    } else {
      detailsBox.hidden = true;
      detailsBox.setAttribute("hidden", "true");
      trigger.setAttribute("aria-expanded", "false");
    }
  }

  #onAdvancedClick(event) {
    try {
      const target = event.target;
      if (!target || typeof target.closest !== "function") {
        return;
      }
      // Ignore non-primary clicks / already-handled controls.
      if (event.button != null && event.button !== 0) {
        return;
      }
      const toggle = target.closest("[data-suraksha-toggle-details]");
      if (toggle) {
        if (toggle.disabled) {
          return;
        }
        event.preventDefault();
        this.#toggleDetails(
          toggle.getAttribute("data-suraksha-toggle-details"),
          toggle
        );
        return;
      }
      const item = target.closest("[data-suraksha-action]");
      if (!item || item.disabled) {
        return;
      }
      event.preventDefault();
      const action = item.getAttribute("data-suraksha-action");
      this.#runAction(action, event);
    } catch (error) {
      console.error(`${LOG_PREFIX} advanced click failed`, error);
    }
  }

  #runAction(action, event) {
    const win = window;
    const bootstrap = window.gAstraSurakshaBootstrap;
    switch (action) {
      case "etp-panel":
        bootstrap?.close?.({ restoreFocus: false });
        openProtectionPanel(win, event);
        break;
      case "etp-dashboard":
      case "protections-dashboard":
        bootstrap?.close?.({ restoreFocus: false });
        openProtectionDashboard(win);
        break;
      case "ublock-popup":
        bootstrap?.close?.({ restoreFocus: false });
        openUBlockBrowserAction(win);
        break;
      case "ublock-manage":
        bootstrap?.close?.({ restoreFocus: false });
        void manageUBlock(win);
        break;
      case "safebrowsing-settings":
        bootstrap?.close?.({ restoreFocus: false });
        openSafeBrowsingSettings(win);
        break;
      case "passwords-manager":
        bootstrap?.close?.({ restoreFocus: false });
        openPasswordManager(win);
        break;
      case "passwords-settings":
        bootstrap?.close?.({ restoreFocus: false });
        openPasswordSettings(win);
        break;
      case "addons":
        bootstrap?.close?.({ restoreFocus: false });
        openAddonsManager(win);
        break;
      case "manage-permissions":
        bootstrap?.close?.({ restoreFocus: false });
        openPermissionManager(win);
        break;
      case "clear-site-data":
        if (clearSiteData(win, event)) {
          window.setTimeout(() => {
            if (!this.#destroyed && this.isOpen) {
              void this.refresh();
            }
          }, 500);
        }
        break;
      case "copy-clean-link":
        copyCleanLink(win);
        break;
      case "protections-panel":
        bootstrap?.openFallbackAction?.("protections-panel", event);
        break;
      case "site-info":
        bootstrap?.openFallbackAction?.("site-info", event);
        break;
      default:
        break;
    }
  }
}

new AstraSurakshaManager();
