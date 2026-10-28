// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ZenTabIntelligenceManager:
    "resource:///modules/zen/intelligence/ZenTabIntelligenceManager.sys.mjs",
});

export class ZenTabIntelligenceUI extends ZenUIComponent {
  #panel = null;
  #hoverTimer = null;
  #hideTimer = null;
  #currentHoverTab = null;
  #prefObserver = null;

  init() {
    this.window.gZenTabIntelligenceUI = this;
    lazy.ZenTabIntelligenceManager.addListener(this);

    this.#ensurePopupPanel();

    // Listen to tab title changes directly in the chrome window
    this.window.addEventListener("TabAttrModified", this);
    this.window.addEventListener("mouseover", this, { passive: true });
    this.window.addEventListener("mouseout", this, { passive: true });
    this.window.addEventListener("mousedown", this, true);
    this.window.addEventListener("dragstart", this, true);
    this.window.addEventListener("ZenWorkspacesUIUpdate", this);
    this.window.addEventListener("ZenWorkspaceDataChanged", this);

    this.#prefObserver = () => {
      this.updateImminentMeetingBanners();
    };
    Services.prefs.addObserver(
      "zen.tab-intelligence.system-calendar.default-workspaces",
      this.#prefObserver
    );
    Services.prefs.addObserver(
      "zen.tab-intelligence.system-calendar.routing",
      this.#prefObserver
    );
    Services.prefs.addObserver(
      "zen.tab-intelligence.system-calendar.enabled",
      this.#prefObserver
    );
    Services.prefs.addObserver(
      "zen.tab-intelligence.enabled",
      this.#prefObserver
    );

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
    this.window.removeEventListener("TabAttrModified", this);
    this.window.removeEventListener("mouseover", this, { passive: true });
    this.window.removeEventListener("mouseout", this, { passive: true });
    this.window.removeEventListener("mousedown", this, true);
    this.window.removeEventListener("dragstart", this, true);
    this.window.removeEventListener("ZenWorkspacesUIUpdate", this);
    this.window.removeEventListener("ZenWorkspaceDataChanged", this);
    if (this.#prefObserver) {
      Services.prefs.removeObserver(
        "zen.tab-intelligence.system-calendar.default-workspaces",
        this.#prefObserver
      );
      Services.prefs.removeObserver(
        "zen.tab-intelligence.system-calendar.routing",
        this.#prefObserver
      );
      Services.prefs.removeObserver(
        "zen.tab-intelligence.system-calendar.enabled",
        this.#prefObserver
      );
      Services.prefs.removeObserver(
        "zen.tab-intelligence.enabled",
        this.#prefObserver
      );
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
        this.updateImminentMeetingBanners();
        break;
      }
      case "TabAttrModified": {
        if (event.detail?.changed?.includes("label")) {
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
        if (event.relatedTarget && tab.contains(event.relatedTarget)) return;
        if (event.relatedTarget && this.#panel?.contains(event.relatedTarget)) return;
        this.#handleTabLeave(tab);
        break;
      }
    }
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

    const url = tab.linkedBrowser?.currentURI?.spec || "";
    const isGmail = url.startsWith("https://mail.google.com/");
    const isWhatsApp = url.startsWith("https://web.whatsapp.com/");

    if (isGmail || isWhatsApp) {
      const pageTitle = this.getTabContentTitle(tab);
      const match = pageTitle.match(/\((\d+)\)/);
      const unreadCount = match ? parseInt(match[1], 10) : 0;
      const hasUnread = unreadCount > 0;

      if (hasUnread) {
        tab.setAttribute("zen-has-unread", "true");
      } else {
        tab.removeAttribute("zen-has-unread");
      }

      lazy.ZenTabIntelligenceManager.onTabStatusUpdate(tab, {
        hasUnread,
        unreadCount,
        service: isWhatsApp ? "WhatsApp" : "Gmail",
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

    const url = tab.linkedBrowser?.currentURI?.spec || "";
    return (
      url.startsWith("https://mail.google.com/") ||
      url.startsWith("https://web.whatsapp.com/") ||
      url.startsWith("https://calendar.google.com/")
    );
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

    this.#currentHoverTab = tab;

    if (this.#hideTimer) {
      this.window.clearTimeout(this.#hideTimer);
      this.#hideTimer = null;
    }

    if (this.#hoverTimer) {
      this.window.clearTimeout(this.#hoverTimer);
    }

    // When the panel is already open/showing on a previous tab, chain immediately with minimal delay
    const isChaining =
      this.#panel &&
      (this.#panel.state === "open" || this.#panel.state === "showing");
    const delay = isChaining ? 40 : 180;

    this.#hoverTimer = this.window.setTimeout(() => {
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

    if (details?.type === "calendar") {
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
    } else if (hasUnread && items.length > 0) {
      const count = Math.max(unreadCount, items.length);
      const isChat = details?.type === "chat";
      const countText = isChat
        ? `${count} unread message${count > 1 ? "s" : ""}`
        : `${count} unread email${count > 1 ? "s" : ""}`;

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

    const isRightSide =
      this.document.documentElement.getAttribute("zen-right-side") === "true";
    const isEssential =
      tab.hasAttribute("zen-essential") ||
      tab.getAttribute("zen-essential") === "true";

    let position;
    let xOffset = 0;
    let yOffset = 0;

    if (isEssential) {
      // Essential tab:
      // - Sidebar on left: anchor bottom-right of tab, popup top-left -> "bottomright topleft"
      // - Sidebar on right: anchor bottom-left of tab, popup top-right -> "bottomleft topright"
      position = isRightSide ? "bottomleft topright" : "bottomright topleft";
      xOffset = isRightSide ? -1 : 1;
      yOffset = 1;
    } else {
      // Pinned tab:
      // - Sidebar on left: anchor right-center of tab, popup left-center -> "rightcenter leftcenter"
      // - Sidebar on right: anchor left-center of tab, popup right-center -> "leftcenter rightcenter"
      position = isRightSide ? "leftcenter rightcenter" : "rightcenter leftcenter";
      xOffset = isRightSide ? -6 : 6;
      yOffset = 0;
    }

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
            this.#panel.openPopup(tab, position, xOffset, yOffset, false, false);
          }
        });
      }
    } else if (this.#panel.state === "showing") {
      this.window.requestAnimationFrame(() => {
        if (tab === this.#currentHoverTab) {
          try {
            this.#panel.moveToAnchor(tab, position, xOffset, yOffset, false);
          } catch {
            this.#panel.openPopup(tab, position, xOffset, yOffset, false, false);
          }
        }
      });
    } else {
      this.#panel.openPopup(tab, position, xOffset, yOffset, false, false);
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

    // 1. Check open tabs first
    const trackedTabs = lazy.ZenTabIntelligenceManager.getTrackedTabs();
    for (const tab of trackedTabs) {
      if (!tab.isConnected) continue;
      const status = lazy.ZenTabIntelligenceManager.getTabStatus(tab);
      if (status?.hasImminentMeeting && status?.imminentMeeting) {
        const tabWorkspace = tab.getAttribute("zen-workspace-id");
        const isEssential = tab.hasAttribute("zen-essential");
        if (
          isEssential ||
          !tabWorkspace ||
          !workspaceId ||
          tabWorkspace === workspaceId
        ) {
          return { tab, meeting: status.imminentMeeting };
        }
      }
    }

    // 2. Check system calendar meetings
    if (
      Services.prefs.getBoolPref(
        "zen.tab-intelligence.system-calendar.enabled",
        true
      )
    ) {
      const systemMeetings =
        lazy.ZenTabIntelligenceManager.getSystemImminentMeetings();
      for (const meeting of systemMeetings) {
        if (this.#isMeetingAllowedInWorkspace(meeting, workspaceId)) {
          return { tab: null, meeting };
        }
      }
    }

    return null;
  }

  #isMeetingAllowedInWorkspace(meeting, workspaceId) {
    const calName = meeting.calendar || "";

    // Read routing pref: JSON object mapping calendar name to array of workspace IDs
    let routing = {};
    try {
      const routingStr = Services.prefs.getStringPref(
        "zen.tab-intelligence.system-calendar.routing",
        "{}"
      );
      routing = JSON.parse(routingStr);
    } catch {}

    let targetWorkspaces = null;
    if (
      calName &&
      Array.isArray(routing[calName]) &&
      routing[calName].length > 0
    ) {
      targetWorkspaces = routing[calName];
    } else {
      // Fallback to default workspaces pref
      try {
        const defStr = Services.prefs.getStringPref(
          "zen.tab-intelligence.system-calendar.default-workspaces",
          "*"
        );
        if (defStr === "*") {
          targetWorkspaces = ["*"];
        } else if (defStr.startsWith("[")) {
          targetWorkspaces = JSON.parse(defStr);
        } else {
          targetWorkspaces = defStr
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
        }
      } catch {
        targetWorkspaces = ["*"];
      }
    }

    if (!Array.isArray(targetWorkspaces) || targetWorkspaces.length === 0) {
      targetWorkspaces = ["*"];
    }

    // If targetWorkspaces includes "*" (all workspaces), or matches workspaceId
    if (
      targetWorkspaces.includes("*") ||
      (workspaceId && targetWorkspaces.includes(workspaceId))
    ) {
      return true;
    }

    return false;
  }
}
