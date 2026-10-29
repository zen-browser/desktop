// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenTabIntelligenceManager:
    "resource:///modules/zen/intelligence/ZenTabIntelligenceManager.sys.mjs",
  ZenGoogleAuth:
    "resource:///modules/zen/intelligence/ZenGoogleAuth.sys.mjs",
  ZenOutlookAuth:
    "resource:///modules/zen/intelligence/ZenOutlookAuth.sys.mjs",
  ZenOutlookConnector:
    "resource:///modules/zen/intelligence/ZenOutlookConnector.sys.mjs",
});

export class ZenTabIntelligenceUI extends ZenUIComponent {
  #panel = null;
  #hoverTimer = null;
  #hideTimer = null;
  #currentHoverTab = null;
  #prefObserver = null;
  #tabMutationObserver = null;

  init() {
    this.window.gZenTabIntelligenceUI = this;
    lazy.ZenTabIntelligenceManager.addListener(this);

    this.#ensurePopupPanel();

    // Listen to tab events in the chrome window and on tab container
    this.window.addEventListener("TabAttrModified", this);
    this.window.addEventListener("TabPinned", this);
    this.window.addEventListener("TabUnpinned", this);
    this.window.addEventListener("mouseover", this, { passive: true });
    this.window.addEventListener("mouseout", this, { passive: true });
    this.window.addEventListener("mousemove", this, { passive: true });
    this.window.addEventListener("mousedown", this, true);
    this.window.addEventListener("dragstart", this, true);
    this.window.addEventListener("ZenWorkspacesUIUpdate", this);
    this.window.addEventListener("ZenWorkspaceDataChanged", this);

    const tabContainer =
      this.window.gBrowser?.tabContainer ||
      this.document.getElementById("tabbrowser-tabs");
    if (tabContainer) {
      tabContainer.addEventListener("mouseover", this, { passive: true });
      tabContainer.addEventListener("mouseout", this, { passive: true });
      tabContainer.addEventListener("mousemove", this, { passive: true });
    }

    // Direct DOM observer for essential/pinned changes across workspaces and containers
    try {
      this.#tabMutationObserver = new this.window.MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.type === "attributes" &&
            mutation.target?.classList?.contains("tabbrowser-tab")
          ) {
            this.evaluateTab(mutation.target);
          }
        }
      });
      this.#tabMutationObserver.observe(this.document.documentElement, {
        attributes: true,
        subtree: true,
        attributeFilter: ["zen-essential", "pinned"],
      });
    } catch (e) {
      console.warn("[ZenTabIntelligenceUI] Failed to start tab MutationObserver:", e);
    }

    this.#prefObserver = () => {
      this.reEvaluateAllTabs();
    };
    Services.prefs.addObserver("zen.tab-intelligence.", this.#prefObserver);

    // Initial check of existing tabs
    if (this.window.gBrowser?.tabs) {
      for (const tab of this.window.gBrowser.tabs) {
        this.evaluateTab(tab);
      }
    }

    this.updateImminentMeetingBanners();
  }

  uninit() {
    lazy.ZenTabIntelligenceManager.removeListener(this);
    if (this.#tabMutationObserver) {
      this.#tabMutationObserver.disconnect();
      this.#tabMutationObserver = null;
    }
    this.window.removeEventListener("TabAttrModified", this);
    this.window.removeEventListener("TabPinned", this);
    this.window.removeEventListener("TabUnpinned", this);
    this.window.removeEventListener("mouseover", this, { passive: true });
    this.window.removeEventListener("mouseout", this, { passive: true });
    this.window.removeEventListener("mousemove", this, { passive: true });
    this.window.removeEventListener("mousedown", this, true);
    this.window.removeEventListener("dragstart", this, true);
    this.window.removeEventListener("ZenWorkspacesUIUpdate", this);
    this.window.removeEventListener("ZenWorkspaceDataChanged", this);

    const tabContainer =
      this.window.gBrowser?.tabContainer ||
      this.document.getElementById("tabbrowser-tabs");
    if (tabContainer) {
      tabContainer.removeEventListener("mouseover", this, { passive: true });
      tabContainer.removeEventListener("mouseout", this, { passive: true });
      tabContainer.removeEventListener("mousemove", this, { passive: true });
    }
    if (this.#prefObserver) {
      Services.prefs.removeObserver("zen.tab-intelligence.", this.#prefObserver);
      this.#prefObserver = null;
    }
    if (this.#hoverTimer) {
      this.window.clearTimeout(this.#hoverTimer);
      this.#hoverTimer = null;
    }
    if (this.#hideTimer) {
      this.window.clearTimeout(this.#hideTimer);
      this.#hideTimer = null;
    }
    if (this.#panel) {
      this.#panel.remove();
      this.#panel = null;
    }
  }

  handleEvent(event) {
    switch (event.type) {
      case "ZenWorkspacesUIUpdate":
      case "ZenWorkspaceDataChanged": {
        this.reEvaluateAllTabs();
        this.updateImminentMeetingBanners();
        break;
      }
      case "TabPinned":
      case "TabUnpinned": {
        const tab = event.target?.closest?.(".tabbrowser-tab") || event.target;
        if (tab?.classList?.contains("tabbrowser-tab")) {
          this.evaluateTab(tab);
        }
        break;
      }
      case "TabAttrModified": {
        const changed = event.detail?.changed;
        if (
          !changed ||
          changed.includes("label") ||
          changed.includes("zen-essential") ||
          changed.includes("pinned") ||
          changed.includes("image")
        ) {
          this.evaluateTab(event.target);
        }
        break;
      }
      case "mousedown": {
        if (
          event.target.closest?.(".tabbrowser-tab") ||
          !this.#panel?.contains(event.target)
        ) {
          if (this.#hoverTimer) {
            this.window.clearTimeout(this.#hoverTimer);
            this.#hoverTimer = null;
          }
          if (this.#panel && this.#panel.state === "open") {
            this.#panel.hidePopup();
          }
          this.#currentHoverTab = null;
        }
        break;
      }
      case "dragstart": {
        if (this.#hoverTimer) {
          this.window.clearTimeout(this.#hoverTimer);
          this.#hoverTimer = null;
        }
        if (this.#panel && this.#panel.state === "open") {
          this.#panel.hidePopup();
        }
        this.#currentHoverTab = null;
        break;
      }
      case "mouseover": {
        const tab = event.target.closest?.(".tabbrowser-tab");
        if (!tab) {
          if (!this.#panel?.contains(event.target)) {
            if (this.#hoverTimer) {
              this.window.clearTimeout(this.#hoverTimer);
              this.#hoverTimer = null;
            }
            this.#scheduleHide(150);
          }
          return;
        }

        if (tab === this.#currentHoverTab) {
          if (this.#hideTimer) {
            this.window.clearTimeout(this.#hideTimer);
            this.#hideTimer = null;
          }
          if (
            this.#hoverTimer ||
            (this.#panel &&
              (this.#panel.state === "open" || this.#panel.state === "showing"))
          ) {
            return;
          }
        }

        this.#handleTabHover(tab);
        break;
      }
      case "mouseout": {
        const tab = event.target.closest?.(".tabbrowser-tab");
        if (!tab || tab !== this.#currentHoverTab) return;
        const rel = event.relatedTarget;
        if (rel && (tab.contains(rel) || this.#panel?.contains(rel))) return;
        this.#handleTabLeave(tab);
        break;
      }
      case "mousemove": {
        const tab = event.target.closest?.(".tabbrowser-tab");
        if (tab && this.#isSupportedTab(tab)) {
          if (
            this.#currentHoverTab !== tab ||
            (!this.#hoverTimer &&
              (!this.#panel ||
                (this.#panel.state !== "open" && this.#panel.state !== "showing")))
          ) {
            this.#handleTabHover(tab);
          }
        }
        break;
      }
    }
  }

  reEvaluateAllTabs() {
    const isGloballyEnabled = Services.prefs.getBoolPref(
      "zen.tab-intelligence.enabled",
      true
    );
    if (this.window.gBrowser?.tabs) {
      for (const tab of this.window.gBrowser.tabs) {
        if (!isGloballyEnabled) {
          tab.removeAttribute("zen-has-unread");
        } else {
          this.evaluateTab(tab);
        }
      }
    }
    if (
      !isGloballyEnabled &&
      this.#panel &&
      (this.#panel.state === "open" || this.#panel.state === "showing")
    ) {
      this.#panel.hidePopup();
    }
    this.updateImminentMeetingBanners();
  }

  getTabContentTitle(tab) {
    if (!tab) return "";
    return (
      tab.linkedBrowser?.contentTitle ||
      tab.linkedBrowser?.browsingContext?.currentWindowGlobal?.documentTitle ||
      tab.label ||
      ""
    );
  }

  evaluateTab(tab) {
    if (!tab || !tab.isConnected) return;

    if (!lazy.ZenTabIntelligenceManager.isTargetTab(tab)) {
      tab.removeAttribute("zen-has-unread");
      return;
    }

    const isPinnedOrEssential =
      tab.pinned ||
      tab.hasAttribute("zen-essential") ||
      tab.getAttribute("zen-essential") === "true";

    const service = lazy.ZenTabIntelligenceManager.getTabService(tab);
    if (service === "gmail" || service === "whatsapp" || service === "outlook") {
      const pageTitle = this.getTabContentTitle(tab);
      const match = pageTitle.match(/\(([0-9+]+)\)/);
      const unreadCount = match ? parseInt(match[1], 10) || 1 : 0;
      const hasUnread = unreadCount > 0;

      if (hasUnread && isPinnedOrEssential) {
        tab.setAttribute("zen-has-unread", "true");
      } else {
        tab.removeAttribute("zen-has-unread");
      }

      lazy.ZenTabIntelligenceManager.onTabStatusUpdate(tab, {
        hasUnread,
        unreadCount,
        service: service === "whatsapp" ? "WhatsApp" : (service === "outlook" ? "Outlook" : "Gmail"),
      });
    }
  }

  #ensurePopupPanel() {
    if (this.#panel?.isConnected) return;

    const popupSet = this.document.getElementById("mainPopupSet");
    if (!popupSet) return;

    let panel = this.document.getElementById("zen-tab-intelligence-panel");
    if (!panel) {
      panel = this.document.createXULElement("panel");
      panel.id = "zen-tab-intelligence-panel";
      panel.className = "zen-intelligence-panel";
      panel.setAttribute("noautofocus", "true");
      panel.setAttribute("orient", "vertical");
      panel.setAttribute("level", "top");
      panel.setAttribute("nonnative", "");
      panel.setAttribute("type", "arrow");
      panel.setAttribute("norolluponanchor", "true");
      panel.setAttribute("consumeoutsideclicks", "never");

      const wrapper = this.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div"
      );
      wrapper.className = "zen-intelligence-container";
      panel.appendChild(wrapper);

      panel.addEventListener("mouseenter", () => {
        if (this.#hideTimer) {
          this.window.clearTimeout(this.#hideTimer);
          this.#hideTimer = null;
        }
      });

      panel.addEventListener("mouseleave", (e) => {
        if (this.#currentHoverTab?.contains(e.relatedTarget)) {
          return;
        }
        this.#scheduleHide(150);
      });

      panel.addEventListener("popuphidden", () => {
        this.#currentHoverTab = null;
        if (this.#hoverTimer) {
          this.window.clearTimeout(this.#hoverTimer);
          this.#hoverTimer = null;
        }
      });

      popupSet.appendChild(panel);
    }

    this.#panel = panel;
  }

  #isSupportedTab(tab) {
    if (!tab || !tab.isConnected) return false;
    if (!lazy.ZenTabIntelligenceManager.isTargetTab(tab)) return false;

    const service = lazy.ZenTabIntelligenceManager.getTabService(tab);
    // Hover preview enabled for Gmail, Google Calendar, and Microsoft Outlook
    return service === "gmail" || service === "google-calendar" || service === "outlook";
  }

  #handleTabHover(tab) {
    if (!this.#isSupportedTab(tab)) {
      if (this.#hoverTimer) {
        this.window.clearTimeout(this.#hoverTimer);
        this.#hoverTimer = null;
      }
      if (this.#panel && (this.#panel.state === "open" || this.#panel.state === "showing")) {
        this.#scheduleHide(100);
      }
      return;
    }

    if (this.#currentHoverTab === tab && (this.#hoverTimer || this.#panel?.state === "open")) {
      return;
    }

    this.#currentHoverTab = tab;

    if (this.#hideTimer) {
      this.window.clearTimeout(this.#hideTimer);
      this.#hideTimer = null;
    }

    if (this.#hoverTimer) {
      this.window.clearTimeout(this.#hoverTimer);
      this.#hoverTimer = null;
    }

    // When the panel is already open/showing on a previous tab, chain immediately with minimal delay
    const isChaining =
      this.#panel &&
      (this.#panel.state === "open" || this.#panel.state === "showing");
    const delay = isChaining ? 40 : 120;

    this.#hoverTimer = this.window.setTimeout(() => {
      this.#hoverTimer = null;
      this.#showPreviewForTab(tab);
    }, delay);
  }

  #handleTabLeave(tab) {
    if (this.#hoverTimer) {
      this.window.clearTimeout(this.#hoverTimer);
      this.#hoverTimer = null;
    }
    this.#scheduleHide(180);
  }

  #scheduleHide(delayMs) {
    if (this.#hideTimer) {
      this.window.clearTimeout(this.#hideTimer);
    }
    this.#hideTimer = this.window.setTimeout(() => {
      if (
        this.#panel &&
        (this.#panel.state === "open" || this.#panel.state === "showing")
      ) {
        this.#panel.hidePopup();
      }
      this.#currentHoverTab = null;
    }, delayMs);
  }

  async #showPreviewForTab(tab) {
    if (!tab || !tab.isConnected || tab !== this.#currentHoverTab) return;

    this.#ensurePopupPanel();
    if (!this.#panel) return;

    const wrapper = this.#panel.querySelector(".zen-intelligence-container");
    if (!wrapper) return;

    const details = await lazy.ZenTabIntelligenceManager.requestTabDetails(tab);
    if (!tab || !tab.isConnected || tab !== this.#currentHoverTab) return;

    const status = lazy.ZenTabIntelligenceManager.getTabStatus(tab);
    const pageTitle = this.getTabContentTitle(tab);
    const titleMatch = pageTitle.match(/\((\d+)\)/);
    const unreadCount =
      status?.unreadCount ||
      (titleMatch ? parseInt(titleMatch[1], 10) : 0) ||
      (tab.hasAttribute("zen-has-unread") ? 1 : 0);

    const hasUnread =
      unreadCount > 0 ||
      tab.hasAttribute("zen-has-unread") ||
      (details?.items && details.items.length > 0 && details.type !== "calendar");

    const items = details?.items || [];

    wrapper.innerHTML = "";

    if (details?.configured === false) {
      const connectCard = this.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div"
      );
      connectCard.className = "zen-intelligence-connect-card";

      const titleEl = this.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div"
      );
      titleEl.className = "zen-intelligence-connect-title";
      const isOutlook = details?.service === "Outlook";
      titleEl.textContent = isOutlook ? "Outlook Tab Intelligence" : "Google Tab Intelligence";

      const descEl = this.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div"
      );
      descEl.className = "zen-intelligence-connect-desc";
      descEl.textContent = isOutlook
        ? "Connectez votre compte Microsoft pour prévisualiser vos emails et réunions du jour au survol."
        : "Connectez votre compte Google pour prévisualiser vos 3 derniers emails et réunions du jour au survol.";

      const btn = this.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "button"
      );
      btn.className = "zen-intelligence-connect-btn";
      btn.textContent = isOutlook ? "Se connecter avec Microsoft" : "Se connecter avec Google";
      btn.onclick = (e) => {
        e.stopPropagation();
        this.hidePreview();
        if (isOutlook) {
          lazy.ZenOutlookAuth.login(this.window);
        } else {
          lazy.ZenGoogleAuth.login(this.window);
        }
      };

      connectCard.appendChild(titleEl);
      connectCard.appendChild(descEl);
      connectCard.appendChild(btn);
      wrapper.appendChild(connectCard);
    } else if (details?.type === "outlook") {
      const unreadCount = details.totalUnread || items.length;
      const calItems = details.calendarItems || [];

      if (items.length > 0 || calItems.length > 0) {
        if (items.length > 0) {
          const header = this.document.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "div"
          );
          header.className = "tabs-list-header zen-intelligence-counter-header";
          header.textContent = `${unreadCount} unread email${unreadCount > 1 ? "s" : ""}`;
          wrapper.appendChild(header);

          const listEl = this.document.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "div"
          );
          listEl.className = "zen-intelligence-items-list";
          for (const item of items) {
            listEl.appendChild(this.#createItemRow(item, tab));
          }
          wrapper.appendChild(listEl);
        }

        if (calItems.length > 0) {
          const header = this.document.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "div"
          );
          header.className = "tabs-list-header zen-intelligence-counter-header";
          header.textContent = `${calItems.length} upcoming event${calItems.length > 1 ? "s" : ""}`;
          wrapper.appendChild(header);

          const listEl = this.document.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "div"
          );
          listEl.className = "zen-intelligence-items-list";
          for (const item of calItems) {
            listEl.appendChild(this.#createItemRow(item, tab));
          }
          wrapper.appendChild(listEl);
        }
      } else {
        const emptyEl = this.document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "div"
        );
        emptyEl.className = "zen-intelligence-empty-state";
        emptyEl.textContent = "Aucun nouveau message ou événement";
        wrapper.appendChild(emptyEl);
      }
    } else if (details?.type === "calendar") {
      if (items.length > 0) {
        const header = this.document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "div"
        );
        header.className = "tabs-list-header zen-intelligence-counter-header";
        header.textContent = `${items.length} upcoming event${items.length > 1 ? "s" : ""}`;
        wrapper.appendChild(header);

        const listEl = this.document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "div"
        );
        listEl.className = "zen-intelligence-items-list";
        for (const item of items) {
          listEl.appendChild(this.#createItemRow(item, tab));
        }
        wrapper.appendChild(listEl);
      } else {
        const emptyEl = this.document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "div"
        );
        emptyEl.className = "zen-intelligence-empty-state";
        emptyEl.textContent = "No upcoming events";
        wrapper.appendChild(emptyEl);
      }
    } else if (details?.type === "mail") {
      if (items.length > 0) {
        const count = details.totalUnread || items.length;
        const countText = `${count} unread email${count > 1 ? "s" : ""}`;

        const header = this.document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "div"
        );
        header.className = "tabs-list-header zen-intelligence-counter-header";
        header.textContent = countText;
        wrapper.appendChild(header);

        const listEl = this.document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "div"
        );
        listEl.className = "zen-intelligence-items-list";
        for (const item of items) {
          listEl.appendChild(this.#createItemRow(item, tab));
        }
        wrapper.appendChild(listEl);
      } else {
        const emptyEl = this.document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "div"
        );
        emptyEl.className = "zen-intelligence-empty-state";
        emptyEl.textContent = "No unread, breathe! 🍃";
        wrapper.appendChild(emptyEl);
      }
    } else {
      const emptyEl = this.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div"
      );
      emptyEl.className = "zen-intelligence-empty-state";
      emptyEl.textContent = "No unread, breathe! 🍃";
      wrapper.appendChild(emptyEl);
    }

    const isRightSide =
      this.document.documentElement.getAttribute("zen-right-side") === "true";
    const isEssential =
      tab.hasAttribute("zen-essential") ||
      tab.getAttribute("zen-essential") === "true";

    let position;
    let xOffset = 0;
    let yOffset = 0;

    if (isEssential) {
      position = isRightSide ? "bottomleft topright" : "bottomright topleft";
      xOffset = isRightSide ? -1 : 1;
      yOffset = 1;
    } else {
      // Matches Zen folder popup positioning (anchored to tab edge)
      position = isRightSide ? "topleft topright" : "topright topleft";
      xOffset = isRightSide ? -8 : 8;
      yOffset = 0;
    }

    this.#panel.setAttribute("side", isRightSide ? "right" : "left");

    const popupOptions = {
      position,
      x: xOffset,
      y: yOffset,
    };

    if (this.#panel.state === "open") {
      let moved = false;
      try {
        if (typeof this.#panel.moveToAnchor === "function") {
          this.#panel.moveToAnchor(tab, position, xOffset, yOffset, false);
          moved = true;
        }
      } catch {}
      if (!moved) {
        this.#panel.hidePopup();
        this.window.requestAnimationFrame(() => {
          if (tab === this.#currentHoverTab) {
            try {
              this.#panel.openPopup(tab, popupOptions);
            } catch {
              this.#panel.openPopup(tab, position, xOffset, yOffset, false, false);
            }
          }
        });
      }
    } else if (this.#panel.state === "showing") {
      this.window.requestAnimationFrame(() => {
        if (tab === this.#currentHoverTab) {
          try {
            this.#panel.moveToAnchor(tab, position, xOffset, yOffset, false);
          } catch {
            try {
              this.#panel.openPopup(tab, popupOptions);
            } catch {
              this.#panel.openPopup(tab, position, xOffset, yOffset, false, false);
            }
          }
        }
      });
    } else {
      try {
        this.#panel.openPopup(tab, popupOptions);
      } catch {
        this.#panel.openPopup(tab, position, xOffset, yOffset, false, false);
      }
    }
  }

  #createItemRow(item, tab) {
    const itemEl = this.document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div"
    );
    itemEl.className = "folders-tabs-list-item zen-intelligence-item-row";

    const content = this.document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div"
    );
    content.className = "folders-tabs-list-item-content";

    const icon = this.document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "img"
    );
    icon.className = "folders-tabs-list-item-icon";
    icon.src =
      this.window.gBrowser.getIcon(tab) ||
      "chrome://global/skin/icons/defaultFavicon.svg";

    const labelsContainer = this.document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div"
    );
    labelsContainer.className = "folders-tabs-list-item-labels";

    const mainLabel = this.document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div"
    );
    mainLabel.className = "folders-tabs-list-item-label";
    mainLabel.textContent = item.title || "";
    labelsContainer.append(mainLabel);

    const secondaryText = item.subtitle || item.snippet || item.time || "";
    if (secondaryText && secondaryText !== item.title) {
      const secondaryLabel = this.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div"
      );
      secondaryLabel.className = "tab-list-item-secondary-label";
      secondaryLabel.textContent = secondaryText;
      labelsContainer.append(secondaryLabel);
    }

    content.append(icon, labelsContainer);

    if (item.videoUrl) {
      const joinBtn = this.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "button"
      );
      joinBtn.className = "zen-intelligence-join-btn";
      joinBtn.textContent = "Join";
      joinBtn.title = "Join Meeting";
      content.append(joinBtn);
    }

    itemEl.append(content);

    itemEl.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("zen-intelligence-join-btn") &&
        item.videoUrl
      ) {
        e.stopPropagation();
        const cleanUrl = item.videoUrl.replace(/[\s"'>.,;)\]]+$/, "");
        const newTab = this.window.gBrowser.addTab(cleanUrl, {
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
          inBackground: false,
        });
        if (newTab) {
          this.window.gBrowser.selectedTab = newTab;
        }
      } else {
        this.window.gBrowser.selectedTab = tab;
      }
      this.#panel.hidePopup();
    });

    return itemEl;
  }

  #escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  onTabStatusChanged({ tab, status }) {
    // Managed centrally in TabIntelligenceManager
  }

  onImminentMeetingChanged() {
    this.updateImminentMeetingBanners();
  }

  onImminentMeetingsChanged() {
    this.updateImminentMeetingBanners();
  }

  updateImminentMeetingBanners() {
    const banners = this.document.querySelectorAll(
      ".zen-imminent-meeting-banner"
    );
    if (!banners || banners.length === 0) return;

    for (const banner of banners) {
      const workspaceElement = banner.closest("zen-workspace");
      const workspaceId = workspaceElement ? workspaceElement.id : null;

      const meetingInfo = this.#resolveMeetingForWorkspace(workspaceId);
      if (meetingInfo && meetingInfo.meeting) {
        banner.removeAttribute("hidden");
        const { tab, meeting } = meetingInfo;

        const headerEl =
          banner.querySelector(".zen-imminent-meeting-header") ||
          banner.querySelector(".zen-imminent-meeting-badge");
        const subtitleEl =
          banner.querySelector(".zen-imminent-meeting-subtitle") ||
          banner.querySelector(".zen-imminent-meeting-title");

        const minutes =
          meeting.minutesLeft !== undefined ? meeting.minutesLeft : 0;
        let timeText;
        if (minutes <= 0) {
          timeText = "Upcoming Meeting now";
        } else if (minutes === 1) {
          timeText = "Upcoming Meeting in 1 minute";
        } else {
          timeText = `Upcoming Meeting in ${minutes} minutes`;
        }

        if (headerEl) {
          headerEl.textContent = timeText;
        }

        if (subtitleEl) {
          const calPrefix = meeting.calendar ? `[${meeting.calendar}] ` : "";
          subtitleEl.textContent = `${calPrefix}${meeting.title || "Meeting"}`;
        }

        const cleanUrl = meeting.videoUrl
          ? meeting.videoUrl.replace(/[\s"'>.,;)\]]+$/, "")
          : null;

        const openMeeting = (e) => {
          if (e) {
            e.stopPropagation();
            e.preventDefault();
          }
          if (tab && tab.isConnected) {
            this.window.gBrowser.selectedTab = tab;
          } else if (cleanUrl) {
            const newTab = this.window.gBrowser.addTab(cleanUrl, {
              triggeringPrincipal:
                Services.scriptSecurityManager.getSystemPrincipal(),
              inBackground: false,
            });
            if (newTab) {
              this.window.gBrowser.selectedTab = newTab;
            }
          }
        };

        const joinBtn = banner.querySelector(".zen-imminent-meeting-join-button");
        if (joinBtn) {
          joinBtn.onclick = openMeeting;
        }

        banner.onclick = openMeeting;
      } else {
        banner.setAttribute("hidden", "true");
      }
    }
  }

  #resolveMeetingForWorkspace(workspaceId) {
    if (!Services.prefs.getBoolPref("zen.tab-intelligence.enabled", true)) {
      return null;
    }

    return lazy.ZenTabIntelligenceManager.getActiveImminentMeeting();
  }
}
