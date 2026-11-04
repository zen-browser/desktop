// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";

const lazy = {};

ChromeUtils.defineLazyGetter(
  lazy,
  "timeFormat",
  () =>
    new (Services.intl?.DateTimeFormat || Intl.DateTimeFormat)(
      Services.locale?.appLocaleAsBCP47 || undefined,
      {
        timeStyle: "short",
      }
    )
);

ChromeUtils.defineLazyGetter(
  lazy,
  "dateFormat",
  () =>
    new (Services.intl?.DateTimeFormat || Intl.DateTimeFormat)(
      Services.locale?.appLocaleAsBCP47 || undefined,
      {
        dateStyle: "short",
      }
    )
);

ChromeUtils.defineLazyGetter(
  lazy,
  "hourFormat",
  () =>
    new (Services.intl?.DateTimeFormat || Intl.DateTimeFormat)(
      Services.locale?.appLocaleAsBCP47 || undefined,
      {
        hour: "numeric",
      }
    )
);

ChromeUtils.defineESModuleGetters(lazy, {
  ZenIntegrationsManager:
    "resource:///modules/zen/integrations/ZenIntegrationsManager.sys.mjs",
});

const SHOW_DELAY = 140;
const HIDE_DELAY = 240;
const MINUTE_MS = 60 * 1000;

/**
 * Per-window UI. Previews unread mail and upcoming events when hovering a
 * pinned or essential mail/calendar tab, manages unread badges and essential meeting notices,
 * and offers to join the next meeting in each space.
 */
export class ZenIntegrationsUI extends ZenUIComponent {
  #popup = null;
  #list = null;
  #meetingCard = null;
  #meetingJoinBtn = null;
  #meetingSelect = null;
  #settingsBtn = null;
  #composeBtn = null;
  #hoveredTab = null;
  #currentTarget = null;
  #showTimer = 0;
  #hideTimer = 0;
  #clockTimer = 0;
  #animatingOutTimer = null;
  #isSelectOpen = false;
  #isSwiping = false;
  #wheelSwipeTimer = null;
  #swipeEndTimer = null;
  #meetingsMenu = null;

  init() {
    this.#popup = this.document.getElementById("zen-integrations-popup");
    if (!this.#popup) {
      return;
    }

    this.#list = this.#popup.querySelector("#zen-integrations-list");
    this.#meetingCard = this.#popup.querySelector("#zen-integrations-meeting-card");
    this.#meetingJoinBtn = this.#popup.querySelector("#zen-integrations-meeting-join-btn");
    this.#meetingSelect = this.#popup.querySelector("#zen-integrations-meeting-select");
    this.#settingsBtn = this.#popup.querySelector("#zen-integrations-settings-btn");
    this.#composeBtn = this.#popup.querySelector("#zen-integrations-compose-btn");

    this.#meetingSelect?.addEventListener("focus", () => {
      this.#isSelectOpen = true;
      this.#cancelHide();
    });
    this.#meetingSelect?.addEventListener("mousedown", () => {
      this.#isSelectOpen = true;
      this.#cancelHide();
    });
    this.#meetingSelect?.addEventListener("blur", () => {
      this.window.setTimeout(() => {
        this.#isSelectOpen = false;
        if (!this.#popup?.matches(":hover") && !this.#hoveredTab?.matches(":hover")) {
          this.#scheduleHide();
        }
      }, 80);
    });
    this.#meetingSelect?.addEventListener("change", (e) => {
      this.#isSelectOpen = false;
      this.on_change(e);
    });

    this.#popup.addEventListener("mouseenter", () => this.#cancelHide());
    this.#popup.addEventListener("mouseleave", (e) => {
      const rel = e.relatedTarget;
      if (this.#hoveredTab?.contains(rel)) {
        return;
      }
      const delay = this.#isSelectOpen ? 1000 : HIDE_DELAY;
      this.#scheduleHide(delay);
    });
    this.#popup.addEventListener("popuphidden", () => {
      this.#isSelectOpen = false;
      this.#meetingSelect?.blur();
      this.#popup.removeAttribute("animating-out");
      if (this.#animatingOutTimer) {
        this.window.clearTimeout(this.#animatingOutTimer);
        this.#animatingOutTimer = null;
      }
    });

    this.addEventListener("mouseover", { passive: true });
    this.addEventListener("mouseout", { passive: true });
    this.addEventListener("mousedown", { passive: true });
    this.addEventListener("command");
    this.addEventListener("change");
    this.addEventListener("ZenWorkspacesUIUpdate");
    this.addEventListener("TabAttrModified");
    this.addEventListener("MozSwipeGestureMayStart", { passive: true });
    this.addEventListener("MozSwipeGestureStart", { passive: true });
    this.addEventListener("MozSwipeGestureUpdate", { passive: true });
    this.addEventListener("MozSwipeGesture", { passive: true });
    this.addEventListener("MozSwipeGestureEnd", { passive: true });
    this.addEventListener("wheel", { passive: true });

    lazy.ZenIntegrationsManager.addEventListener("meetingchange", this);

    const tabTooltip = this.document.getElementById("tabbrowser-tab-tooltip");
    if (tabTooltip) {
      tabTooltip.addEventListener("popupshowing", this, true);
    }
    Services.prefs.addObserver("zen.integrations.whatsapp-unread-badge", this);

    this.#evaluateAllTabs();
    this.#updateBanners();

    // Refresh meeting notices periodically
    this.#clockTimer = this.window.setInterval(() => {
      this.#updateEssentialNotices();
      this.#updateBanners();
    }, 30 * 1000);
  }

  uninit() {
    this.#meetingsMenu?.remove();
    this.#meetingsMenu = null;
    this.window.clearInterval(this.#clockTimer);
    if (this.#animatingOutTimer) {
      this.window.clearTimeout(this.#animatingOutTimer);
      this.#animatingOutTimer = null;
    }
    this.window.clearTimeout(this.#wheelSwipeTimer);
    this.window.clearTimeout(this.#swipeEndTimer);
    lazy.ZenIntegrationsManager.removeEventListener("meetingchange", this);
    const tabTooltip = this.document.getElementById("tabbrowser-tab-tooltip");
    if (tabTooltip) {
      tabTooltip.removeEventListener("popupshowing", this, true);
    }
    Services.prefs.removeObserver("zen.integrations.whatsapp-unread-badge", this);
  }

  observe(subject, topic, data) {
    if (data === "zen.integrations.whatsapp-unread-badge") {
      this.#evaluateAllTabs();
    }
  }

  on_popupshowing(event) {
    if (event.target.id === "tabbrowser-tab-tooltip") {
      const node = event.target.triggerNode;
      const tab =
        node?.closest?.(".tabbrowser-tab, tab") ||
        node?.getRootNode?.()?.host?.closest?.(".tabbrowser-tab, tab");
      if (tab) {
        const tabTarget = lazy.ZenIntegrationsManager.getTabTarget(tab);
        if (tabTarget && tabTarget.kind !== "chat") {
          event.preventDefault();
        }
      }
    }
  }

  on_MozSwipeGestureMayStart(event) {
    if (this.#popup?.contains(event.target)) {
      return;
    }
    this.#handleSwipeMovement();
  }

  on_MozSwipeGestureStart(event) {
    if (this.#popup?.contains(event.target)) {
      return;
    }
    this.#handleSwipeMovement();
  }

  on_MozSwipeGestureUpdate(event) {
    if (this.#popup?.contains(event.target)) {
      return;
    }
    this.#handleSwipeMovement();
  }

  on_MozSwipeGesture(event) {
    if (this.#popup?.contains(event.target)) {
      return;
    }
    this.#handleSwipeEnd();
  }

  on_MozSwipeGestureEnd(event) {
    if (this.#popup?.contains(event.target)) {
      return;
    }
    this.#handleSwipeEnd();
  }

  on_wheel(event) {
    // Scrolling inside the popup content must never close the popup!
    if (this.#popup?.contains(event.target)) {
      return;
    }
    // Only detect horizontal swipe between spaces on the tab strip / sidebar / workspace
    if (
      Math.abs(event.deltaX) > 8 &&
      event.target.closest("#tabbrowser-arrowscrollbox, zen-workspace, #zen-sidebar, .tabbrowser-tab")
    ) {
      this.#handleSwipeMovement();
      this.window.clearTimeout(this.#wheelSwipeTimer);
      this.#wheelSwipeTimer = this.window.setTimeout(() => {
        this.#handleSwipeEnd();
      }, 200);
    }
  }

  #handleSwipeMovement() {
    this.#isSwiping = true;
    this.#cancelShow();
    if (this.#popup?.state === "open") {
      this.#closeImmediately();
    }
  }

  #handleSwipeEnd() {
    this.window.clearTimeout(this.#swipeEndTimer);
    this.#swipeEndTimer = this.window.setTimeout(() => {
      this.#isSwiping = false;
      const hoveredElement = this.document.querySelector(".tabbrowser-tab:hover");
      if (hoveredElement && hoveredElement.isConnected) {
        const tabTarget = lazy.ZenIntegrationsManager.getTabTarget(hoveredElement);
        if (tabTarget && tabTarget.kind !== "chat") {
          this.#hoveredTab = hoveredElement;
          this.#currentTarget = tabTarget;
          this.#show(hoveredElement, tabTarget);
        }
      }
    }, 150);
  }

  on_mouseover(event) {
    if (this.#isSwiping) {
      return;
    }

    const target = event.target;

    // If hovering inside the popup itself, cancel any hide and keep it open
    if (this.#popup?.contains(target)) {
      this.#cancelHide();
      return;
    }

    const tab = target.closest?.(".tabbrowser-tab") ?? null;
    if (tab && tab === this.#hoveredTab) {
      this.#cancelHide();
      return;
    }

    // Moving outside popup and outside current tab:
    this.#isSelectOpen = false;
    this.#meetingSelect?.blur();
    this.#cancelShow();
    const tabTarget = tab ? lazy.ZenIntegrationsManager.getTabTarget(tab) : null;
    if (tabTarget && tabTarget.kind !== "chat") {
      this.document.getElementById("tabbrowser-tab-tooltip")?.hidePopup();
      this.#cancelHide();
      this.#hoveredTab = tab;
      this.#currentTarget = tabTarget;
      this.#showTimer = this.window.setTimeout(
        () => this.#show(tab, tabTarget),
        SHOW_DELAY
      );
    } else if (this.#hoveredTab) {
      this.#scheduleHide();
    }
  }

  on_mouseout(event) {
    if (this.#isSelectOpen) {
      this.#cancelHide();
      return;
    }
    const rel = event.relatedTarget;
    // If moving into popup or into the current tab, ignore
    if (rel && (this.#popup?.contains(rel) || this.#hoveredTab?.contains(rel))) {
      this.#cancelHide();
      return;
    }
  }

  on_mousedown() {
    this.#cancelShow();
  }

  on_command(event) {
    const { target } = event;

    // Join button in workspace sidebar banner
    if (target.classList?.contains("zen-integrations-join-button")) {
      const { meeting } = lazy.ZenIntegrationsManager;
      if (meeting?.joinUrl) {
        this.window.openWebLinkIn(meeting.joinUrl, "tab");
        lazy.ZenIntegrationsManager.dismissMeeting(meeting.key);
      }
      return;
    }

    // Camera button in workspace sidebar banner (collapsed sidebar)
    if (target.classList?.contains("zen-integrations-camera-button")) {
      const { meetings } = lazy.ZenIntegrationsManager;
      if (meetings.length > 1) {
        this.#openMeetingsMenu(target);
      } else {
        const meeting = meetings[0] ?? null;
        if (meeting?.joinUrl) {
          this.window.openWebLinkIn(meeting.joinUrl, "tab");
          lazy.ZenIntegrationsManager.dismissMeeting(meeting.key);
        }
      }
      return;
    }

    // Join button at top of Calendar hover popup
    if (target.id === "zen-integrations-meeting-join-btn") {
      const providerId = this.#currentTarget?.provider?.id;
      const meeting = lazy.ZenIntegrationsManager.meetings.find(m => {
        if (!providerId) {
          return true;
        }
        return m.key.startsWith(`mock:${providerId}:`) || m.key.startsWith(`${providerId}:`);
      }) || lazy.ZenIntegrationsManager.meeting;

      if (meeting?.joinUrl) {
        this.window.openWebLinkIn(meeting.joinUrl, "tab");
        lazy.ZenIntegrationsManager.dismissMeeting(meeting.key);
        this.#closeImmediately();
      }
      return;
    }

    // Settings gear button in header
    if (target.id === "zen-integrations-settings-btn") {
      this.window.openPreferences("paneZenTabManagement-integrations");
      this.#closeImmediately();
      return;
    }

    // Compose (+) button in header
    if (target.id === "zen-integrations-compose-btn") {
      const tab = this.#hoveredTab;
      const provider = this.#currentTarget?.provider;
      if (tab && provider) {
        const host = tab.linkedBrowser?.currentURI?.host || "outlook.live.com";
        const composeUrl =
          this.#currentTarget.kind === "mail"
            ? (provider.getComposeMailUrl ? provider.getComposeMailUrl(host) : provider.composeMailUrl)
            : (provider.getComposeEventUrl ? provider.getComposeEventUrl(host) : provider.composeEventUrl);
        if (composeUrl) {
          this.#navigateTab(tab, composeUrl);
        }
      }
      this.#closeImmediately();
      return;
    }
  }

  on_change(event) {
    const { target } = event;
    if (
      target.id === "zen-integrations-meeting-select" ||
      target.classList?.contains("zen-integrations-sidebar-select")
    ) {
      const selectedOption = target.selectedOptions?.[0];
      const joinUrl = selectedOption?.dataset?.joinUrl;
      const meetingKey = target.value;
      if (joinUrl) {
        this.window.openWebLinkIn(joinUrl, "tab");
        if (meetingKey) {
          lazy.ZenIntegrationsManager.dismissMeeting(meetingKey);
        }
      }
      target.selectedIndex = 0;
      if (target.id === "zen-integrations-meeting-select") {
        this.#closeImmediately();
      }
    }
  }

  on_meetingchange() {
    this.#updateBanners();
    this.#updateEssentialNotices();
  }

  on_ZenWorkspacesUIUpdate() {
    this.#updateBanners();
    this.#closeImmediately();
  }

  on_TabAttrModified(event) {
    if (event.detail?.changed?.includes("label")) {
      this.#evaluateTab(event.target);
    }
  }

  #evaluateAllTabs() {
    for (const tab of this.window.gBrowser?.tabs || []) {
      this.#evaluateTab(tab);
    }
    this.#updateEssentialNotices();
  }

  #evaluateTab(tab) {
    if (!tab || !tab.isConnected) {
      return;
    }

    const url = tab.linkedBrowser?.currentURI?.spec || "";
    const isWhatsApp = url.startsWith("https://web.whatsapp.com/");
    const isGmail = url.startsWith("https://mail.google.com/");
    const isOutlook =
      url.includes("outlook.cloud.microsoft") ||
      url.includes("outlook.live.com") ||
      url.includes("outlook.office.com") ||
      url.includes("outlook.office365.com") ||
      url.includes("outlook.");

    if (isWhatsApp) {
      const showBadge = Services.prefs.getBoolPref(
        "zen.integrations.whatsapp-unread-badge",
        true
      );
      if (!showBadge) {
        tab.removeAttribute("zen-has-unread");
        return;
      }
      // Real WhatsApp unread detection (never mocked)
      const label = tab.label || "";
      const match = label.match(/\((\d+)\)/);
      const hasUnread = match ? parseInt(match[1], 10) > 0 : false;
      if (hasUnread) {
        tab.setAttribute("zen-has-unread", "true");
      } else {
        tab.removeAttribute("zen-has-unread");
      }
      return;
    }

    if (isGmail || isOutlook) {
      const label = tab.label || "";
      const match = label.match(/\((\d+)\)/);
      const hasUnread = match
        ? parseInt(match[1], 10) > 0
        : (lazy.ZenIntegrationsManager.isMockEnabled && (tab.pinned || tab.hasAttribute("zen-essential")));

      if (hasUnread) {
        tab.setAttribute("zen-has-unread", "true");
      } else {
        tab.removeAttribute("zen-has-unread");
      }
    }
  }

  #updateEssentialNotices() {
    const { meeting } = lazy.ZenIntegrationsManager;
    const now = Date.now();

    for (const tab of this.window.gBrowser?.tabs || []) {
      if (!tab.hasAttribute("zen-essential")) {
        continue;
      }

      const url = tab.linkedBrowser?.currentURI?.spec || "";
      const isCalendar =
        url.startsWith("https://calendar.google.com/") ||
        (url.includes("outlook.") && url.includes("/calendar")) ||
        (url.includes("outlook.cloud.microsoft") && url.includes("/calendar"));

      if (isCalendar && meeting) {
        let noticeText = "";
        if (now < meeting.start) {
          const m = Math.max(0, Math.ceil((meeting.start - now) / MINUTE_MS));
          noticeText = m === 0 ? "Now" : `In ${m}m`;
        } else if (now < meeting.end) {
          const m = Math.max(0, Math.floor((now - meeting.start) / MINUTE_MS));
          noticeText = m === 0 ? "Now" : `${m}m ago`;
        }

        if (noticeText) {
          tab.setAttribute("zen-meeting-notice", noticeText);
        } else {
          tab.removeAttribute("zen-meeting-notice");
        }
      } else {
        tab.removeAttribute("zen-meeting-notice");
      }
    }
  }

  #cancelShow() {
    this.window.clearTimeout(this.#showTimer);
  }

  #cancelHide() {
    this.window.clearTimeout(this.#hideTimer);
    if (this.#animatingOutTimer) {
      this.window.clearTimeout(this.#animatingOutTimer);
      this.#animatingOutTimer = null;
    }
    if (this.#popup?.hasAttribute("animating-out")) {
      this.#popup.removeAttribute("animating-out");
    }
  }

  #scheduleHide(delay = HIDE_DELAY) {
    this.#cancelShow();
    this.window.clearTimeout(this.#hideTimer);
    this.#hideTimer = this.window.setTimeout(() => {
      if (this.#popup?.matches(":hover") || this.#hoveredTab?.matches(":hover")) {
        return;
      }
      this.#isSelectOpen = false;
      this.#meetingSelect?.blur();
      this.#hoveredTab = null;
      this.#currentTarget = null;
      this.#hidePopupAnimated();
    }, delay);
  }

  #hidePopupAnimated() {
    if (!this.#popup || this.#popup.state !== "open") {
      this.#popup?.removeAttribute("animating-out");
      return;
    }

    if (this.#popup.hasAttribute("animating-out")) {
      return;
    }

    this.#popup.setAttribute("animating-out", "true");

    const finishHide = () => {
      if (this.#animatingOutTimer) {
        this.window.clearTimeout(this.#animatingOutTimer);
        this.#animatingOutTimer = null;
      }
      this.#popup.removeEventListener("transitionend", onTransitionEnd);
      this.#popup.removeAttribute("animating-out");
      if (this.#popup.state === "open") {
        this.#popup.hidePopup();
      }
    };

    const onTransitionEnd = (event) => {
      if (event.target === this.#popup) {
        finishHide();
      }
    };

    this.#popup.addEventListener("transitionend", onTransitionEnd, { once: true });
    this.#animatingOutTimer = this.window.setTimeout(finishHide, 140);
  }

  #closeImmediately() {
    if (this.#animatingOutTimer) {
      this.window.clearTimeout(this.#animatingOutTimer);
      this.#animatingOutTimer = null;
    }
    this.#popup?.removeAttribute("animating-out");
    if (this.#popup?.state === "open") {
      this.#popup.hidePopup();
    }
  }

  async #show(tab, target) {
    let items, fallbacks;
    try {
      [items, fallbacks] = await Promise.all([
        lazy.ZenIntegrationsManager.getPreview(target),
        this.document.l10n.formatValues([
          { id: "zen-integrations-no-subject" },
          { id: "zen-integrations-no-title" },
        ]),
      ]);
    } catch (e) {
      console.warn("Could not load the tab preview", e);
      return;
    }

    if (tab !== this.#hoveredTab) {
      return;
    }

    this.#render(tab, target.kind, items, fallbacks);
    this.#open(tab);
  }

  #render(tab, kind, items, [noSubject, noTitle]) {
    const { l10n } = this.document;
    const isMail = kind === "mail";
    const providerId = this.#currentTarget?.provider?.id;
    const meetings = lazy.ZenIntegrationsManager.meetings.filter(m => {
      if (!providerId) {
        return true;
      }
      return m.key.startsWith(`mock:${providerId}:`) || m.key.startsWith(`${providerId}:`);
    });

    // Header label
    l10n.setAttributes(
      this.#popup.querySelector(".zen-integrations-header"),
      isMail
        ? "zen-integrations-unread-header"
        : "zen-integrations-upcoming-header"
    );

    // Compose action button tooltip: New message vs New event
    this.#composeBtn.removeAttribute("data-l10n-id");
    this.#composeBtn.setAttribute(
      "tooltiptext",
      isMail ? "New message" : "New event"
    );

    // Meeting card at top of Calendar preview
    if (!isMail && meetings.length > 1) {
      this.#meetingCard.hidden = false;
      this.#meetingJoinBtn.hidden = true;
      this.#meetingSelect.hidden = false;
      this.#meetingSelect.replaceChildren();

      const defaultOpt = this.document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.disabled = true;
      defaultOpt.selected = true;
      defaultOpt.textContent = `Join meeting (${meetings.length})...`;
      this.#meetingSelect.append(defaultOpt);

      for (const m of meetings) {
        const opt = this.document.createElement("option");
        opt.value = m.key;
        opt.dataset.joinUrl = m.joinUrl;
        const timeStr = lazy.timeFormat.formatRange(m.start, m.end);
        opt.textContent = `${m.title || "Meeting"} (${timeStr})`;
        this.#meetingSelect.append(opt);
      }
    } else if (!isMail && meetings.length === 1 && meetings[0].joinUrl) {
      const meeting = meetings[0];
      this.#meetingCard.hidden = false;
      this.#meetingSelect.hidden = true;
      this.#meetingJoinBtn.hidden = false;
      const joinLabel = `Join "${meeting.title || "Meeting"}"`;
      this.#meetingJoinBtn.setAttribute("label", joinLabel);
      this.#meetingJoinBtn.textContent = joinLabel;
    } else {
      this.#meetingCard.hidden = true;
      this.#meetingJoinBtn.hidden = true;
      this.#meetingSelect.hidden = true;
    }

    // Empty state
    const empty = this.#popup.querySelector(".zen-integrations-empty");
    empty.hidden = !!items.length;
    l10n.setAttributes(
      empty,
      isMail
        ? "zen-integrations-no-unread"
        : "zen-integrations-no-events"
    );

    if (isMail) {
      this.#renderMailList(tab, items, noSubject);
    } else {
      this.#renderCalendarTimeline(tab, items, noTitle);
    }
  }

  #renderMailList(tab, items, noSubject) {
    this.#list.className = "zen-integrations-mail-list";
    this.#list.replaceChildren(
      ...items.map(item => {
        const row = this.document.createElement("div");
        row.className = "folders-tabs-list-item zen-integrations-mail-item";

        const content = this.document.createElement("div");
        content.className = "folders-tabs-list-item-content zen-integrations-mail-content";

        const labels = this.document.createElement("div");
        labels.className = "folders-tabs-list-item-labels zen-integrations-mail-labels";

        const topRow = this.document.createElement("div");
        topRow.className = "zen-integrations-mail-top-row";

        const sender = this.document.createElement("div");
        sender.className = "folders-tabs-list-item-label zen-integrations-mail-sender";
        sender.textContent = item.sender || "Unknown";
        topRow.append(sender);

        if (item.date) {
          const dateEl = this.document.createElement("div");
          dateEl.className = "zen-integrations-mail-date";
          dateEl.textContent = this.#formatMailDate(item.date);
          topRow.append(dateEl);
        }

        const subject = this.document.createElement("div");
        subject.className = "tab-list-item-secondary-label zen-integrations-mail-subject";
        subject.textContent = item.subject || noSubject;

        labels.append(topRow, subject);

        if (item.snippet) {
          const snippet = this.document.createElement("div");
          snippet.className = "zen-integrations-mail-snippet";
          snippet.textContent = item.snippet;
          labels.append(snippet);
        }

        content.append(labels);
        row.append(content);

        row.addEventListener("click", () => {
          if (item.url) {
            this.#navigateTab(tab, item.url);
          } else {
            this.window.gBrowser.selectedTab = tab;
          }
          this.#closeImmediately();
        });

        return row;
      })
    );
  }

  #formatMailDate(timestamp) {
    if (!timestamp) {
      return "";
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return "";
    }
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    return isToday
      ? lazy.timeFormat.format(date)
      : lazy.dateFormat.format(date);
  }

  #renderCalendarTimeline(tab, items, noTitle) {
    this.#list.className = "zen-integrations-calendar-timeline";
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    const container = this.document.createElement("div");
    container.className = "zen-integrations-timeline-container";

    // Current time indicator line
    const currentIndicator = this.document.createElement("div");
    currentIndicator.className = "zen-integrations-current-time-marker";
    const minuteRatio = currentMinutes / 60;
    currentIndicator.style.top = `${minuteRatio * 38 + 6}px`;
    container.append(currentIndicator);

    // Hourly rows
    for (let i = 0; i < 5; i++) {
      const slotHour = (currentHour + i) % 24;
      const slotDate = new Date(now);
      slotDate.setHours(slotHour, 0, 0, 0);

      const hourRow = this.document.createElement("div");
      hourRow.className = "zen-integrations-hour-row";

      const timeLabel = this.document.createElement("div");
      timeLabel.className = "zen-integrations-hour-label";
      timeLabel.textContent = lazy.hourFormat.format(slotDate);

      const divider = this.document.createElement("div");
      divider.className = "zen-integrations-hour-divider";

      hourRow.append(timeLabel, divider);
      container.append(hourRow);
    }

    // Render colored event cards
    const eventsLayer = this.document.createElement("div");
    eventsLayer.className = "zen-integrations-events-layer";

    const clusters = this.#clusterEvents(items);
    for (const cluster of clusters) {
      if (cluster.length === 1) {
        eventsLayer.append(this.#createEventCard(tab, cluster[0], noTitle));
      } else {
        const row = this.document.createElement("div");
        row.className = "zen-integrations-events-overlap-row";
        for (const item of cluster) {
          row.append(this.#createEventCard(tab, item, noTitle));
        }
        eventsLayer.append(row);
      }
    }

    container.append(eventsLayer);
    this.#list.replaceChildren(container);
  }

  #clusterEvents(events) {
    if (!events || !events.length) {
      return [];
    }
    const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
    const clusters = [];
    let currentCluster = [sorted[0]];
    let clusterEnd = sorted[0].end;

    for (let i = 1; i < sorted.length; i++) {
      const event = sorted[i];
      if (event.start < clusterEnd) {
        currentCluster.push(event);
        clusterEnd = Math.max(clusterEnd, event.end);
      } else {
        clusters.push(currentCluster);
        currentCluster = [event];
        clusterEnd = event.end;
      }
    }
    clusters.push(currentCluster);
    return clusters;
  }

  #createEventCard(tab, item, noTitle) {
    const card = this.document.createElement("div");
    card.className = "zen-integrations-event-card";
    card.style.backgroundColor = item.color || "#818cf8";

    const title = this.document.createElement("div");
    title.className = "zen-integrations-event-title";
    const titleText = item.title || noTitle;
    title.textContent = titleText;

    const timeRange = this.document.createElement("div");
    timeRange.className = "zen-integrations-event-time";
    const timeText = lazy.timeFormat.formatRange(item.start, item.end);
    timeRange.textContent = timeText;

    card.setAttribute("tooltiptext", `${titleText} (${timeText})`);
    card.append(title, timeRange);

    if (item.joinUrl) {
      const camIcon = this.document.createElement("span");
      camIcon.className = "zen-integrations-event-cam-icon";
      card.append(camIcon);
    }

    card.addEventListener("click", () => {
      if (item.url) {
        this.#navigateTab(tab, item.url);
      } else {
        this.window.gBrowser.selectedTab = tab;
      }
      this.#closeImmediately();
    });

    return card;
  }

  #navigateTab(tab, url) {
    if (!tab || !tab.isConnected) {
      return;
    }
    this.window.gBrowser.selectedTab = tab;
    try {
      this.window.openTrustedLinkIn(url, "current");
    } catch {
      tab.linkedBrowser?.loadURI?.(Services.io.newURI(url), {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
    }
  }

  #open(tab) {
    if (this.#animatingOutTimer) {
      this.window.clearTimeout(this.#animatingOutTimer);
      this.#animatingOutTimer = null;
    }
    this.#popup.removeAttribute("animating-out");

    const isRightSide = this.window.gZenVerticalTabsManager?._prefsRightSide ?? false;

    // Essentials sit in top grid -> popup opens UNDER the tab
    // Pinned tabs sit in vertical sidebar -> popup opens to the SIDE (like folder popups)
    const { position, x, y } = tab.hasAttribute("zen-essential")
      ? {
          position: isRightSide ? "bottomleft topright" : "bottomright topleft",
          x: isRightSide ? -1 : 1,
          y: 2,
        }
      : {
          position: isRightSide ? "topleft topright" : "topright topleft",
          x: isRightSide ? -8 : 8,
          y: 0,
        };

    if (this.#popup.state === "open") {
      this.#popup.moveToAnchor(tab, position, x, y, false);
    } else if (this.#popup.state === "closed") {
      this.#popup.openPopup(tab, { position, x, y });
    }
  }

  #ensureMeetingsMenu() {
    if (!this.#meetingsMenu) {
      this.#meetingsMenu = this.document.createXULElement("menupopup");
      this.#meetingsMenu.id = "zen-integrations-meetings-menu";
      this.#meetingsMenu.addEventListener("command", event => {
        const item = event.target;
        const joinUrl = item.dataset.joinUrl;
        const meetingKey = item.dataset.meetingKey;
        if (joinUrl) {
          this.window.openWebLinkIn(joinUrl, "tab");
          if (meetingKey) {
            lazy.ZenIntegrationsManager.dismissMeeting(meetingKey);
          }
        }
      });
      const popupset = this.document.getElementById("mainPopupSet") || this.document.documentElement;
      popupset.appendChild(this.#meetingsMenu);
    }
    return this.#meetingsMenu;
  }

  #openMeetingsMenu(anchor) {
    const { meetings } = lazy.ZenIntegrationsManager;
    const menu = this.#ensureMeetingsMenu();
    menu.replaceChildren();

    for (const m of meetings) {
      const item = this.document.createXULElement("menuitem");
      const timeStr = m.start
        ? new Date(m.start).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })
        : "";
      item.setAttribute("label", timeStr ? `${m.title || "Meeting"} (${timeStr})` : (m.title || "Meeting"));
      item.dataset.joinUrl = m.joinUrl || "";
      item.dataset.meetingKey = m.key || "";
      menu.appendChild(item);
    }

    const isRightSide = this.document.documentElement.getAttribute("zen-right-side") === "true";
    const position = isRightSide ? "start_before" : "after_start";
    menu.openPopup(anchor, position);
  }

  #updateBanners() {
    const { meetings } = lazy.ZenIntegrationsManager;
    const meeting = meetings[0] ?? null;
    const minutes = meeting
      ? Math.max(0, Math.ceil((meeting.start - Date.now()) / MINUTE_MS))
      : 0;

    for (const banner of this.document.querySelectorAll(
      ".zen-integrations-banner"
    )) {
      banner.hidden = !meeting;
      if (!meeting) {
        continue;
      }
      this.document.l10n.setAttributes(
        banner.querySelector(".zen-integrations-banner-header"),
        "zen-integrations-meeting-soon",
        { minutes }
      );

      const titleEl = banner.querySelector(".zen-integrations-banner-title");
      const joinBtn = banner.querySelector(".zen-integrations-join-button");
      const select = banner.querySelector(".zen-integrations-sidebar-select");

      if (meetings.length > 1) {
        titleEl.textContent = `${meetings.length} upcoming meetings`;
        if (joinBtn) {
          joinBtn.hidden = true;
        }
        if (select) {
          select.hidden = false;
          select.replaceChildren();

          const defaultOpt = this.document.createElement("option");
          defaultOpt.value = "";
          defaultOpt.disabled = true;
          defaultOpt.selected = true;
          defaultOpt.textContent = "Join...";
          select.append(defaultOpt);

          for (const m of meetings) {
            const opt = this.document.createElement("option");
            opt.value = m.key;
            opt.dataset.joinUrl = m.joinUrl;
            opt.textContent = m.title || "Meeting";
            select.append(opt);
          }
        }
      } else {
        titleEl.textContent = meeting.title;
        if (select) {
          select.hidden = true;
        }
        if (joinBtn) {
          joinBtn.hidden = false;
          joinBtn.setAttribute("label", "Join");
          joinBtn.textContent = "Join";
        }
      }
    }
  }
}
