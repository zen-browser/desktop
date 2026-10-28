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

  init() {
    this.window.gZenTabIntelligenceUI = this;
    lazy.ZenTabIntelligenceManager.addListener(this);

    this.#ensurePopupPanel();

    // Listen to tab title changes directly in the chrome window
    this.window.addEventListener("TabAttrModified", this);
    this.window.addEventListener("mouseover", this, { passive: true });
    this.window.addEventListener("mouseout", this, { passive: true });

    // Initial check of existing tabs
    if (this.window.gBrowser?.tabs) {
      for (const tab of this.window.gBrowser.tabs) {
        this.evaluateTab(tab);
      }
    }

    // Check if there is already an active imminent meeting
    const activeMeeting =
      lazy.ZenTabIntelligenceManager.getActiveImminentMeeting();
    if (activeMeeting) {
      this.onImminentMeetingChanged(activeMeeting);
    }
  }

  uninit() {
    lazy.ZenTabIntelligenceManager.removeListener(this);
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
      case "TabAttrModified": {
        if (event.detail?.changed?.includes("label")) {
          this.evaluateTab(event.target);
        }
        break;
      }
      case "mouseover": {
        const tab = event.target.closest?.(".tabbrowser-tab");
        if (!tab) return;
        if (tab === this.#currentHoverTab) return;
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

      panel.addEventListener("mouseleave", () => {
        this.#scheduleHide(150);
      });

      popupSet.appendChild(panel);
    }

    this.#panel = panel;
  }

  #handleTabHover(tab) {
    if (!lazy.ZenTabIntelligenceManager.isTargetTab(tab)) return;

    const url = tab.linkedBrowser?.currentURI?.spec || "";
    const isGmail = url.startsWith("https://mail.google.com/");
    const isWhatsApp = url.startsWith("https://web.whatsapp.com/");
    const isGCal = url.startsWith("https://calendar.google.com/");
    if (!isGmail && !isWhatsApp && !isGCal) return;

    this.#currentHoverTab = tab;

    if (this.#hideTimer) {
      this.window.clearTimeout(this.#hideTimer);
      this.#hideTimer = null;
    }

    if (this.#hoverTimer) {
      this.window.clearTimeout(this.#hoverTimer);
    }

    this.#hoverTimer = this.window.setTimeout(() => {
      this.#showPreviewForTab(tab);
    }, 180);
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
      if (this.#panel && this.#panel.state === "open") {
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
        header.className = "zen-intelligence-counter-header";
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
      header.className = "zen-intelligence-counter-header";
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
      // - Sidebar on left: deployed right at the bottom-right corner of the tab (topleft bottomright)
      // - Sidebar on right: deployed right at the bottom-left corner of the tab (topright bottomleft)
      position = isRightSide ? "topright bottomleft" : "topleft bottomright";
      xOffset = isRightSide ? -2 : 2;
      yOffset = 2;
    } else {
      // Pinned tab:
      // - Deployed towards the window interior from the vertical center of the tab
      // - Anchored on the side of the tab closest to the inner edge of the sidebar
      position = isRightSide ? "rightcenter leftcenter" : "leftcenter rightcenter";
      xOffset = isRightSide ? -6 : 6;
      yOffset = 0;
    }

    this.#panel.openPopup(tab, position, xOffset, yOffset, false, false);
  }

  #createItemRow(item, tab) {
    const itemRow = this.document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div"
    );
    itemRow.className = "zen-intelligence-item-row";

    let html = `
      <div class="zen-intelligence-item-main">
        <span class="zen-intelligence-item-title">${this.#escapeHtml(item.title)}</span>
        ${item.subtitle ? `<span class="zen-intelligence-item-subtitle">${this.#escapeHtml(item.subtitle)}</span>` : ""}
        ${item.snippet ? `<span class="zen-intelligence-item-snippet">${this.#escapeHtml(item.snippet)}</span>` : ""}
      </div>
    `;

    if (item.videoUrl) {
      html += `
        <button class="zen-intelligence-join-btn" title="Join Meeting">Join</button>
      `;
    }

    itemRow.innerHTML = html;

    itemRow.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("zen-intelligence-join-btn") &&
        item.videoUrl
      ) {
        e.stopPropagation();
        this.window.gBrowser.addTab(item.videoUrl, {
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
          inBackground: false,
        });
      } else {
        this.window.gBrowser.selectedTab = tab;
      }
      this.#panel.hidePopup();
    });

    return itemRow;
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

  onImminentMeetingChanged({ tab, meeting }) {
    const banners = this.document.querySelectorAll(
      ".zen-imminent-meeting-banner"
    );
    if (!banners || banners.length === 0) return;

    for (const banner of banners) {
      if (meeting) {
        banner.removeAttribute("hidden");
        const titleEl = banner.querySelector(".zen-imminent-meeting-title");
        if (titleEl) {
          const timeText =
            meeting.minutesLeft <= 0 ? "Now" : `in ${meeting.minutesLeft}m`;
          titleEl.textContent = `${meeting.title} (${timeText})`;
        }

        const joinBtn = banner.querySelector(".zen-imminent-meeting-join-button");
        if (joinBtn) {
          joinBtn.onclick = (e) => {
            e.stopPropagation();
            this.window.gBrowser.addTab(meeting.videoUrl, {
              triggeringPrincipal:
                Services.scriptSecurityManager.getSystemPrincipal(),
              inBackground: false,
            });
          };
        }

        banner.onclick = () => {
          if (tab && tab.isConnected) {
            this.window.gBrowser.selectedTab = tab;
          }
        };
      } else {
        banner.setAttribute("hidden", "true");
      }
    }
  }
}
