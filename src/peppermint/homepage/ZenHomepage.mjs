/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  ZenHomepage,
  collectHomepageStats,
  formatClock,
  formatDuration,
  formatToday,
  getTodayActiveMs,
  startActiveTimeTracking,
} from "resource:///modules/zen/homepage/ZenHomepage.sys.mjs";

const HTML_NS = "http://www.w3.org/1999/xhtml";

const CARDS = [
  { id: "time-spent", l10nId: "zen-homepage-card-time-spent", field: "timeSpent" },
  { id: "top-site", l10nId: "zen-homepage-card-top-site", field: "topSite" },
  {
    id: "network-speed",
    l10nId: "zen-homepage-card-network-speed",
    field: "networkSpeed",
  },
  { id: "downloads", l10nId: "zen-homepage-card-downloads", field: "downloads" },
  {
    id: "visited-sites",
    l10nId: "zen-homepage-card-visited-sites",
    field: "visitedSites",
  },
  { id: "version", l10nId: "zen-homepage-card-version", field: "version" },
];

function htmlElement(tag, attributes = {}) {
  const node = document.createElementNS(HTML_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}

class ZenHomepageController {
  #root = null;
  #appliedSpec = null;
  #warnedInvalidURL = false;
  #clockTimer = 0;
  #statsTimer = 0;
  #statsToken = 0;
  #lastDateLabel = "";

  init() {
    if (this.#root || !document.getElementById("zen-tabbox-wrapper")) {
      return;
    }
    this.#build();
    startActiveTimeTracking();
    Services.prefs.addObserver("zen.homepage.", this);
    window.addEventListener("TabSelect", this);
    window.addEventListener("unload", this, { once: true });
    this.sync();
  }

  observe(subject, topic, data) {
    // Active-time bookkeeping writes these on blur. Refreshing stats here
    // would rerun the Places queries for every focused window.
    if (
      data === "zen.homepage.daily-active-ms" ||
      data === "zen.homepage.daily-active-day"
    ) {
      return;
    }
    this.#warnedInvalidURL = false;
    this.sync();
  }

  get statsRefreshCount() {
    return this.#statsToken;
  }

  handleEvent(event) {
    if (event.type === "unload") {
      this.#shutdown();
      return;
    }
    if (event.type === "TabSelect") {
      this.sync();
    }
  }

  sync() {
    if (!this.#root) {
      return;
    }
    this.#applyCardVisibility();
    this.#applyEmptyTabDocument();
    const show = this.#shouldShowOverlay();
    this.#root.hidden = !show;
    this.#syncTimers(show);
    if (show) {
      this.#tickClock();
      this.#refreshStats();
    }
  }

  #scheduleClock() {
    const delay = 60000 - (Date.now() % 60000);
    this.#clockTimer = window.setTimeout(() => {
      this.#clockTimer = 0;
      this.#tickClock();
      if (this.#root && !this.#root.hidden) {
        this.#scheduleClock();
      }
    }, delay);
  }

  #syncTimers(show) {
    if (show) {
      if (!this.#clockTimer) {
        this.#scheduleClock();
      }
      if (!this.#statsTimer) {
        this.#statsTimer = window.setInterval(() => this.#refreshStats(), 60000);
      }
      return;
    }
    window.clearTimeout(this.#clockTimer);
    window.clearInterval(this.#statsTimer);
    this.#clockTimer = 0;
    this.#statsTimer = 0;
  }

  #shutdown() {
    Services.prefs.removeObserver("zen.homepage.", this);
    window.removeEventListener("TabSelect", this);
    window.clearTimeout(this.#clockTimer);
    window.clearInterval(this.#statsTimer);
  }

  #shouldShowOverlay() {
    if (document.documentElement.hasAttribute("zen-welcome-stage")) {
      return false;
    }
    if (!ZenHomepage.shouldShowBuiltin()) {
      return false;
    }
    const tab = gBrowser.selectedTab;
    if (!tab?.hasAttribute("zen-empty-tab")) {
      return false;
    }
    const spec = tab.linkedBrowser?.currentURI?.spec;
    return !spec || spec === "about:blank";
  }

  #applyEmptyTabDocument() {
    const tab = gZenWorkspaces?._emptyTab;
    const browser = tab?.linkedBrowser;
    if (!browser || tab.closing) {
      return;
    }
    const mode = ZenHomepage.getMode();
    let target = "about:blank";
    if (mode === "custom") {
      target = ZenHomepage.getCustomURL();
      if (!target) {
        if (!this.#warnedInvalidURL) {
          this.#warnedInvalidURL = true;
          console.warn(
            "Zen homepage: custom URL is empty or not http(s); showing a blank page."
          );
        }
        target = "about:blank";
      }
    }
    const current = browser.currentURI?.spec;
    if (current === target) {
      this.#appliedSpec = target;
      return;
    }
    // A load is already in flight, or the user navigated away from the
    // homepage URL. Don't start another load until the target changes.
    if (this.#appliedSpec === target) {
      return;
    }
    try {
      const uri = Services.io.newURI(target);
      const originAttributes = browser.contentPrincipal?.originAttributes || {};
      browser.loadURI(uri, {
        triggeringPrincipal: Services.scriptSecurityManager.createContentPrincipal(
          uri,
          originAttributes
        ),
      });
      this.#appliedSpec = target;
    } catch (error) {
      console.error("Zen homepage failed to load", target, error);
    }
  }

  #applyCardVisibility() {
    for (const card of this.#root.querySelectorAll("[data-card]")) {
      card.hidden = !ZenHomepage.isCardEnabled(card.getAttribute("data-card"));
    }
  }

  #tickClock() {
    if (!this.#root || this.#root.hidden) {
      return;
    }
    const clock = this.#root.querySelector(".zen-homepage-clock");
    if (clock) {
      clock.textContent = formatClock();
    }
    const date = this.#root.querySelector(".zen-homepage-date");
    const dateLabel = formatToday();
    if (date && dateLabel !== this.#lastDateLabel) {
      this.#lastDateLabel = dateLabel;
      document.l10n.setAttributes(date, "zen-homepage-today", {
        date: dateLabel,
      });
    }
    const timeSpent = this.#root.querySelector(
      '[data-card="time-spent"] .zen-homepage-card-value'
    );
    if (timeSpent) {
      timeSpent.textContent = formatDuration(getTodayActiveMs());
    }
  }

  #refreshStats() {
    if (!this.#root || this.#root.hidden) {
      return;
    }
    const token = ++this.#statsToken;
    const isPrivate = PrivateBrowsingUtils.isWindowPrivate(window);
    collectHomepageStats({ isPrivate })
      .then(stats => {
        if (token !== this.#statsToken || !this.#root) {
          return;
        }
        const welcome = this.#root.querySelector(".zen-homepage-welcome");
        if (welcome) {
          document.l10n.setAttributes(welcome, "zen-homepage-welcome", {
            name: stats.name,
          });
        }
        for (const card of CARDS) {
          const value = this.#root.querySelector(
            `[data-card="${card.id}"] .zen-homepage-card-value`
          );
          if (value) {
            value.textContent = stats[card.field];
          }
        }
        this.#tickClock();
      })
      .catch(error => {
        console.error("Zen homepage stats failed", error);
      });
  }

  #build() {
    const root = htmlElement("div", { id: "zen-homepage", hidden: "true" });
    root.appendChild(htmlElement("div", { class: "zen-homepage-grain" }));

    const content = htmlElement("div", { class: "zen-homepage-content" });
    const header = htmlElement("div", { class: "zen-homepage-header" });
    header.appendChild(htmlElement("div", { class: "zen-homepage-welcome" }));
    header.appendChild(htmlElement("div", { class: "zen-homepage-date" }));

    const tagline = htmlElement("p", {
      class: "zen-homepage-tagline",
      "data-l10n-id": "zen-homepage-tagline",
    });
    tagline.appendChild(
      htmlElement("span", {
        class: "zen-homepage-fresh",
        "data-l10n-name": "fresh",
      })
    );
    header.appendChild(tagline);
    content.appendChild(header);

    const grid = htmlElement("div", { class: "zen-homepage-grid" });
    for (const card of CARDS) {
      const cardEl = htmlElement("div", {
        class: "zen-homepage-card",
        "data-card": card.id,
      });
      cardEl.appendChild(
        htmlElement("div", {
          class: "zen-homepage-card-title",
          "data-l10n-id": card.l10nId,
        })
      );
      cardEl.appendChild(
        htmlElement("div", { class: "zen-homepage-card-value" })
      );
      grid.appendChild(cardEl);
    }
    const clockCard = htmlElement("div", {
      class: "zen-homepage-clock-card",
      "data-card": "clock",
    });
    clockCard.appendChild(htmlElement("div", { class: "zen-homepage-clock" }));
    const glass = htmlElement("div", { class: "zen-homepage-glass" });
    glass.appendChild(grid);
    glass.appendChild(clockCard);
    content.appendChild(glass);
    root.appendChild(content);

    document.getElementById("zen-tabbox-wrapper").appendChild(root);
    this.#root = root;
    document.l10n?.translateFragment(root);
  }
}

window.gZenHomepage = new ZenHomepageController();
