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
        this.#handleTabHover(tab);
        break;
      }
      case "mouseout": {
        const tab = event.target.closest?.(".tabbrowser-tab");
        if (!tab || tab !== this.#currentHoverTab) return;
        this.#handleTabLeave(tab);
        break;
      }
    }
  }

  evaluateTab(tab) {
    if (!tab || !tab.isConnected) return;

    if (!lazy.ZenTabIntelligenceManager.isTargetTab(tab)) {
      tab.removeAttribute("zen-has-unread");
      return;
    }

    const url = tab.linkedBrowser?.currentURI?.spec || "";
    if (url.startsWith("https://mail.google.com/")) {
      const label = tab.label || "";
      const match = label.match(/\((\d+)\)/);
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
        service: "Gmail",
      });
    }
  }

  #ensurePopupPanel() {
    if (this.#panel) return;

    const popupSet = this.document.getElementById("mainPopupSet");
    if (!popupSet) return;

    this.#panel = this.document.createXULElement("panel");
    this.#panel.id = "zen-tab-intelligence-panel";
    this.#panel.className = "zen-intelligence-panel";
    this.#panel.setAttribute("type", "arrow");
    this.#panel.setAttribute("noautofocus", "true");
    this.#panel.setAttribute("orient", "vertical");
    this.#panel.setAttribute("level", "top");

    this.#panel.innerHTML = `
      <vbox class="zen-intelligence-container">
        <hbox class="zen-intelligence-header" align="center">
          <image class="zen-intelligence-service-icon" />
          <label class="zen-intelligence-service-title" flex="1" />
          <label class="zen-intelligence-count-badge" />
        </hbox>
        <vbox class="zen-intelligence-items-list" />
      </vbox>
    `;

    this.#panel.addEventListener("mouseenter", () => {
      if (this.#hideTimer) {
        this.window.clearTimeout(this.#hideTimer);
        this.#hideTimer = null;
      }
    });

    this.#panel.addEventListener("mouseleave", () => {
      this.#scheduleHide(150);
    });

    popupSet.appendChild(this.#panel);
  }

  #handleTabHover(tab) {
    if (!lazy.ZenTabIntelligenceManager.isTargetTab(tab)) return;

    const url = tab.linkedBrowser?.currentURI?.spec || "";
    const isGmail = url.startsWith("https://mail.google.com/");
    const isGCal = url.startsWith("https://calendar.google.com/");
    if (!isGmail && !isGCal) return;

    const label = tab.label || "";
    const hasUnread =
      tab.hasAttribute("zen-has-unread") || !!label.match(/\((\d+)\)/);

    // Only show for tabs with unread content or calendar tabs
    if (!hasUnread && !isGCal) return;

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
    }, 200);
  }

  #handleTabLeave(tab) {
    if (this.#hoverTimer) {
      this.window.clearTimeout(this.#hoverTimer);
      this.#hoverTimer = null;
    }
    this.#scheduleHide(200);
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

    const titleEl = this.#panel.querySelector(".zen-intelligence-service-title");
    const countEl = this.#panel.querySelector(".zen-intelligence-count-badge");
    const listEl = this.#panel.querySelector(".zen-intelligence-items-list");

    listEl.innerHTML = "";
    titleEl.textContent = tab.label || "Tab Preview";
    countEl.textContent = "";

    const details = await lazy.ZenTabIntelligenceManager.requestTabDetails(tab);
    if (!details || tab !== this.#currentHoverTab) return;

    if (details.service) {
      titleEl.textContent = details.service;
    }

    if (details.items && details.items.length > 0) {
      countEl.textContent = `${details.items.length}`;

      for (const item of details.items) {
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

        listEl.appendChild(itemRow);
      }
    } else {
      const emptyRow = this.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div"
      );
      emptyRow.className = "zen-intelligence-item-row zen-intelligence-empty";
      emptyRow.textContent = "No recent items";
      listEl.appendChild(emptyRow);
    }

    const isRightSide =
      this.document.documentElement.getAttribute("zen-right-side") === "true";
    const position = isRightSide ? "topleft topright" : "topright topleft";

    this.#panel.openPopup(tab, position, isRightSide ? -8 : 8, 0, false, false);
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
