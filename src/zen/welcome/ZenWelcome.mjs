// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

{
  let _tabsToPinEssentials = [];
  let _welcomePagesInstance = null;
  let lazy = {};

  ChromeUtils.defineESModuleGetters(lazy, {
    ConfigSearchEngine:
      "moz-src:///toolkit/components/search/ConfigSearchEngine.sys.mjs",
    SearchService: "moz-src:///toolkit/components/search/SearchService.sys.mjs",
    SearchUtils: "moz-src:///toolkit/components/search/SearchUtils.sys.mjs",
  });

  const kZenElementsToIgnore = [
    "zen-browser-background",
    "zen-toast-container",
  ];

  const kTotalWelcomeSteps = 6;

  /** @type {"chrome"|"new"|null} Layout choice from the browser-switcher step. */
  let _welcomeBrowserChoice = null;

  /** Preferred welcome search engines (display order). */
  const kPreferredSearchEngines = [
    "Google",
    "Bing",
    "DuckDuckGo",
    "Perplexity",
    "Yahoo",
  ];

  function clearBrowserElements() {
    for (const element of document.getElementById("browser").children) {
      if (kZenElementsToIgnore.includes(element.id)) {
        continue;
      }
      element.style.display = "none";
    }
  }

  /**
   * After welcome hides #browser chrome with display:none, OverflowableToolbar
   * may have parked widgets in #widget-overflow-list against zero width.
   * Unhide is not enough — re-run single-toolbar layout and explicitly restore
   * App Hub / Suraksha if they remain overflowed.
   */
  function restoreBrowserChromeLayout() {
    document.getElementById("navigator-toolbox")?.getBoundingClientRect();
    gZenVerticalTabsManager?._updateEvent();
  }

  async function settleToolbarOverflowAfterWelcome() {
    if (gZenUIManager?.settleToolbarOverflow) {
      await gZenUIManager.settleToolbarOverflow();
      return;
    }
    // Fallback if UI manager is unavailable during early failure recovery.
    restoreBrowserChromeLayout();
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  }

  function getMotion() {
    return gZenUIManager.motion;
  }

  async function animate(...args) {
    return getMotion().animate(...args);
  }

  /** Cap page swaps at ≤150ms; springs were ~800ms+ and blocked interactivity. */
  const kWelcomeSwapSec = 0.12;

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function welcomeQueryAll(targets) {
    if (typeof targets === "string") {
      return [...document.querySelectorAll(targets)];
    }
    if (Array.isArray(targets)) {
      return targets.filter(Boolean);
    }
    return targets ? [targets] : [];
  }

  function setWelcomeOpacity(targets, opacity) {
    for (const el of welcomeQueryAll(targets)) {
      el.style.opacity = String(opacity);
      el.style.transform = "";
    }
  }

  /**
   * Single GPU-only welcome transition (opacity / transform only).
   * Honors prefers-reduced-motion; never animates layout properties.
   */
  async function welcomeTransition(targets, { from = 0, to = 1, y = 0 } = {}) {
    const els = welcomeQueryAll(targets);
    if (!els.length) {
      return;
    }
    if (prefersReducedMotion() || !getMotion()?.animate) {
      setWelcomeOpacity(els, to);
      return;
    }
    const keyframes =
      y !== 0
        ? {
            opacity: [from, to],
            y: from < to ? [y, 0] : [0, -Math.abs(y)],
          }
        : { opacity: [from, to] };
    try {
      // Prefer selector strings when possible — Motion One handles them reliably.
      const animateTarget =
        typeof targets === "string" ? targets : els.length === 1 ? els[0] : els;
      await animate(animateTarget, keyframes, {
        duration: kWelcomeSwapSec,
        easing: "easeOut",
      });
    } catch {
      // Fall through to final opacity.
    }
    setWelcomeOpacity(els, to);
  }

  /** Valid Glean MigrationUtils entrypoint — "astra-welcome" is not in the enum. */
  function welcomeMigrationEntrypoint(mu) {
    return (
      mu?.MIGRATION_ENTRYPOINTS?.FIRSTRUN ||
      mu?.MIGRATION_ENTRYPOINTS?.UNKNOWN ||
      "firstrun"
    );
  }

  /**
   * Open a visible, non-blocking migration dialog.
   * isStartupMigration:true uses a blocking modal that can open with no usable
   * surface during welcome; about:preferences is also hidden (display:none).
   */
  function openWelcomeMigrationDialog(mu, options = {}) {
    const entrypoint =
      options.entrypoint &&
      Object.values(mu?.MIGRATION_ENTRYPOINTS || {}).includes(options.entrypoint)
        ? options.entrypoint
        : welcomeMigrationEntrypoint(mu);
    Services.ww.openWindow(
      window,
      "chrome://browser/content/migration/migration-dialog-window.html",
      "_blank",
      "chrome,centerscreen,resizable=no,dialog",
      {
        options: {
          entrypoint,
          isStartupMigration: false,
        },
      }
    );
  }

  function createIconEl(iconKey, size = 24) {
    const el = document.createElement("span");
    el.className = "zen-welcome-icon";
    el.setAttribute("data-icon", iconKey);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  function buildDecor(items = []) {
    const decor = document.createElement("div");
    decor.className = "zen-welcome-decor";
    for (const item of items) {
      if (item.type === "dot") {
        const dot = document.createElement("div");
        dot.className = "zen-welcome-decor-dot";
        dot.setAttribute("data-pos", item.pos);
        decor.appendChild(dot);
      } else {
        const badge = document.createElement("div");
        badge.className = "zen-welcome-decor-badge";
        badge.setAttribute("data-pos", item.pos);
        badge.appendChild(createIconEl(item.icon, 18));
        decor.appendChild(badge);
      }
    }
    return decor;
  }

  function contentQuerySelectedBrowserChoice() {
    const checked = document.querySelector(
      'input[name="zen-welcome-browser-choice"]:checked'
    );
    return checked?.value || null;
  }

  function buildProgressDots(stepNum, totalSteps) {
    const dots = document.createElement("div");
    dots.className = "zen-welcome-dots";
    for (let i = 0; i < totalSteps; i++) {
      const dot = document.createElement("div");
      dot.className = "zen-welcome-dot";
      if (i === stepNum - 1) {
        dot.setAttribute("active", "true");
      }
      dots.appendChild(dot);
    }
    return dots;
  }

  async function openImportSettings() {
    // Always open a standalone non-modal dialog. Welcome hides #browser chrome
    // (so about:preferences migrate is invisible), and isStartupMigration opens
    // a blocking modal that can fail to present a usable window here.
    try {
      const { MigrationUtils: mu } = ChromeUtils.importESModule(
        "resource:///modules/MigrationUtils.sys.mjs"
      );
      openWelcomeMigrationDialog(mu);
      return;
    } catch (e) {
      console.warn("[Astra] Direct migration dialog open failed:", e);
    }
    try {
      if (window.gAstraMigration?.openNativeWizard) {
        const result = await window.gAstraMigration.openNativeWizard({
          // Non-startup: avoid blocking modal. Entrypoint must be Glean-valid.
          isStartupMigration: false,
          entrypoint: "firstrun",
          standalone: true,
        });
        if (result?.ok !== false) {
          return;
        }
      }
    } catch (e) {
      console.warn("[Astra] gAstraMigration open failed, falling back:", e);
    }
    try {
      const { MigrationUtils } = ChromeUtils.importESModule(
        "resource:///modules/MigrationUtils.sys.mjs"
      );
      // Last resort: may open about:preferences (hidden during welcome).
      MigrationUtils.showMigrationWizard(window, {
        entrypoint: welcomeMigrationEntrypoint(MigrationUtils),
      });
    } catch (e) {
      console.error("[Astra] Failed to open import settings wizard:", e);
    }
  }

  function initializeZenWelcome() {
    document.documentElement.setAttribute("zen-welcome-stage", "true");
    const XUL = `
      <html:div id="zen-welcome">
        <html:div id="zen-welcome-start">
          <html:div id="zen-welcome-start-inner">
            <html:div id="zen-welcome-start-title"></html:div>
            <html:p id="zen-welcome-start-subtitle" data-l10n-id="zen-welcome-subtitle"></html:p>
            <html:button class="zen-welcome-btn-primary" id="zen-welcome-start-button" data-l10n-id="zen-welcome-get-started"></html:button>
            <html:button id="zen-welcome-import-link" data-l10n-id="zen-welcome-import-settings"></html:button>
          </html:div>
        </html:div>
        <html:div id="zen-welcome-pages">
          <html:div id="zen-welcome-wizard">
            <html:div id="zen-welcome-page-content"></html:div>
          </html:div>
        </html:div>
      </html:div>
    `;
    const fragment = window.MozXULElement.parseXULToFragment(XUL);
    document.getElementById("browser").appendChild(fragment);
    window.MozXULElement.insertFTLIfNeeded("browser/zen-welcome.ftl");

    // Intro decorative badges (what's inside — not literal feature previews).
    const start = document.getElementById("zen-welcome-start");
    start.insertBefore(
      buildDecor([
        { icon: "folder", pos: "tl" },
        { icon: "sparkles", pos: "tr" },
        { icon: "shield", pos: "bl" },
        { icon: "lock", pos: "br" },
        { type: "dot", pos: "a" },
        { type: "dot", pos: "b" },
      ]),
      start.firstChild
    );

    const inner = document.getElementById("zen-welcome-start-inner");
    const markWrap = document.createElement("div");
    markWrap.className = "zen-welcome-mark-wrap";
    const ring = document.createElement("div");
    ring.className = "zen-welcome-mark-ring";
    const mark = document.createElement("div");
    mark.className = "zen-welcome-mark";
    mark.appendChild(createIconEl("sparkles", 24));
    markWrap.appendChild(ring);
    markWrap.appendChild(mark);
    inner.insertBefore(markWrap, inner.firstChild);

    const wordmark = document.createElement("div");
    wordmark.className = "zen-welcome-wordmark";
    wordmark.textContent = "Astra";
    markWrap.after(wordmark);

    const dots = buildProgressDots(1, kTotalWelcomeSteps);
    dots.id = "zen-welcome-start-dots";
    inner.appendChild(dots);

    document
      .getElementById("zen-welcome-import-link")
      .addEventListener("click", () => {
        openImportSettings();
      });
  }

  var _iconToData = {};

  async function getIconData(iconURL, mimeType = null) {
    const cacheKey = mimeType ? `${iconURL}|${mimeType}` : iconURL;
    if (_iconToData[cacheKey]) {
      return _iconToData[cacheKey];
    }
    const response = await fetch(iconURL);
    if (!response.ok) {
      console.error(`Failed to fetch icon: ${iconURL}`);
      return null;
    }
    const blob = await response.blob();
    // resource:// dumps often report application/x-unknown-content-type;
    // SVGs need image/svg+xml or <img> naturalWidth stays 0.
    const type =
      mimeType ||
      (blob.type && !blob.type.includes("unknown") ? blob.type : null) ||
      "application/octet-stream";
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const dataURI = `data:${type};base64,${btoa(binary)}`;
    _iconToData[cacheKey] = dataURI;
    return dataURI;
  }

  /**
   * Packaged search-config-icons dump for an engine.
   * Used when SearchService.getIconURL() returns null — e.g. Marionette sets
   * services.settings.server to the dummy URI, which forces LOAD_DUMPS=false
   * and skips Attachments.get() dump fallback even though the files are present
   * at resource://app/defaults/settings/main/search-config-icons/.
   *
   * @returns {Promise<?{url: string, mimeType: ?string}>}
   */
  async function getPackagedSearchIcon(engineId, preferredWidth = 32) {
    if (!engineId) {
      return null;
    }
    try {
      const records =
        await lazy.ConfigSearchEngine.iconHandler.getAvailableRecords(engineId);
      // Prefer raster/SVG brand assets — skip PDF/other non-<img> types.
      const renderable = records.filter(r => {
        const mime = r.attachment?.mimetype || "";
        return (
          mime.startsWith("image/") ||
          mime === "image/svg+xml" ||
          mime === "image/x-icon" ||
          mime === "image/vnd.microsoft.icon"
        );
      });
      const pool = renderable.length ? renderable : records;
      if (!pool.length) {
        return null;
      }
      const sizes = pool.map(r => r.imageSize);
      const width = lazy.SearchUtils.chooseIconSize(preferredWidth, sizes);
      const record = pool.find(r => r.imageSize == width) || pool[0];
      if (!record?.id) {
        return null;
      }
      return {
        url:
          "resource://app/defaults/settings/main/search-config-icons/" +
          record.id,
        mimeType: record.attachment?.mimetype || null,
      };
    } catch (e) {
      console.warn("[Astra] Packaged search icon lookup failed:", engineId, e);
      return null;
    }
  }

  /**
   * Resolve a brand icon URL for the welcome search grid.
   * Prefer SearchService blob URLs; fall back to packaged dumps; never invert.
   */
  async function resolveWelcomeEngineIconURL(searchEngine) {
    const preferredWidth = 32;
    try {
      const iconURL = await searchEngine.getIconURL(preferredWidth);
      if (iconURL) {
        return iconURL;
      }
    } catch (e) {
      console.warn(
        "[Astra] getIconURL failed:",
        searchEngine?.id || searchEngine?.name,
        e
      );
    }
    const packaged = await getPackagedSearchIcon(
      searchEngine.id,
      preferredWidth
    );
    if (!packaged) {
      return null;
    }
    // Prefer a data URI with the catalog mimetype so SVG/ICO both decode.
    return (
      (await getIconData(packaged.url, packaged.mimeType)) || packaged.url
    );
  }

  function setRequestedLocale(localeList) {
    try {
      Services.prefs.setStringPref("intl.locale.requested", localeList);
      Services.locale.requestedLocales = localeList
        .split(",")
        .map(l => l.trim());
      const win = Services.wm.getMostRecentWindow("navigator:browser");
      if (win) {
        win.location.reload();
      }
    } catch (e) {
      console.error("Failed to set requested locale", e);
    }
  }

  async function buildHero(page) {
    const existing = document.getElementById("zen-welcome-hero");
    if (existing) {
      existing.remove();
    }
    document.querySelector("#zen-welcome-wizard > .zen-welcome-decor")?.remove();
    document
      .querySelector("#zen-welcome-wizard > .zen-welcome-dots")
      ?.remove();

    const wizard = document.getElementById("zen-welcome-wizard");
    const content = document.getElementById("zen-welcome-page-content");

    if (page.decor?.length) {
      wizard.insertBefore(buildDecor(page.decor), wizard.firstChild);
    }

    const hero = document.createElement("div");
    hero.id = "zen-welcome-hero";

    if (page.icon) {
      const markWrap = document.createElement("div");
      markWrap.className = "zen-welcome-mark-wrap";
      const ring = document.createElement("div");
      ring.className = "zen-welcome-mark-ring";
      const mark = document.createElement("div");
      mark.className = "zen-welcome-mark";
      mark.appendChild(createIconEl(page.icon, 24));
      markWrap.appendChild(ring);
      markWrap.appendChild(mark);
      hero.appendChild(markWrap);
    }

    if (page.eyebrow) {
      const eyebrow = document.createElement("div");
      eyebrow.className = "zen-welcome-eyebrow";
      document.l10n.setAttributes(eyebrow, page.eyebrow);
      hero.appendChild(eyebrow);
    }

    const title = document.createElement("div");
    title.id = "zen-welcome-sidebar-title";
    title.className = "zen-welcome-headline";
    document.l10n.setAttributes(title, page.text[0].id);
    hero.appendChild(title);

    const sub = document.createElement("div");
    sub.id = "zen-welcome-sidebar-sub";
    sub.className = "zen-welcome-subhead";
    document.l10n.setAttributes(sub, page.text[1].id);
    hero.appendChild(sub);

    wizard.insertBefore(hero, content);

    if (page.stepNum) {
      wizard.appendChild(buildProgressDots(page.stepNum, page.totalSteps));
    }

    return hero;
  }

  class nsZenWelcomePages {
    constructor(pages) {
      this._currentPage = -1;
      this._pages = pages;
      this._navigating = false;
      _welcomePagesInstance = this;
      this.init();
      this.next();
    }

    init() {
      const start = document.getElementById("zen-welcome-start");
      if (start) {
        start.style.display = "none";
      }
      document.getElementById("zen-welcome-pages").style.display = "flex";
      window.maximize();
      // Non-blocking; page show runs its own synchronized fade.
      welcomeTransition("#zen-welcome-pages", { from: 0, to: 1 });
    }

    async returnToIntro() {
      if (this._navigating) {
        return;
      }
      this._navigating = true;
      try {
        await this.#transitionAwayFromCurrentPage();
        this._currentPage = -1;
        const pagesEl = document.getElementById("zen-welcome-pages");
        const start = document.getElementById("zen-welcome-start");
        if (pagesEl) {
          await animate(
            "#zen-welcome-pages",
            { opacity: [1, 0] },
            { duration: 0.2 }
          );
          pagesEl.style.display = "none";
          pagesEl.style.opacity = "";
        }
        if (start) {
          start.style.display = "";
          // Re-enable Get Started after returning from the wizard.
          const button = document.getElementById("zen-welcome-start-button");
          if (button) {
            button.disabled = false;
          }
          const targets = start.querySelectorAll(
            "#zen-welcome-start-inner > *, .zen-welcome-decor"
          );
          for (const el of targets) {
            el.style.opacity = "1";
            el.style.transform = "";
          }
        }
      } finally {
        _welcomePagesInstance = null;
        this._navigating = false;
      }
    }

    async fadeInSidebar(page) {
      if (page.noSidebar || !page.stepNum) {
        return;
      }
      // DOM only — opacity animated later with content+buttons as one group.
      await buildHero(page);
      setWelcomeOpacity("#zen-welcome-hero > *", 0);
    }

    async fadeInTitles(page) {
      if (page.rawText) {
        const [title1, description1, description2] = page.rawText;
        const titleElement = document.createElement("div");
        titleElement.id = "zen-welcome-legacy-sidebar-content";
        /* eslint-disable no-unsanitized/property */
        titleElement.innerHTML =
          `<html:h1>${title1}</html:h1><html:p>${description1}</html:p>` +
          (description2 ? `<html:p>${description2}</html:p>` : "");
        document
          .getElementById("zen-welcome-page-content")
          .prepend(titleElement);
      }
    }

    /**
     * Mount Back/Continue/Skip immediately and leave them interactive.
     * Visibility is handled by the synchronized page fade (Option A).
     */
    mountButtons(page) {
      if (page.skipButtons) {
        return [];
      }
      const content = document.getElementById("zen-welcome-page-content");
      let btnRow = content.querySelector(".zen-welcome-btn-row");
      if (!btnRow) {
        btnRow = document.createElement("div");
        btnRow.className = "zen-welcome-btn-row";
        content.appendChild(btnRow);
      }
      btnRow.style.opacity = "0";

      const mainRow = document.createElement("div");
      mainRow.className = "zen-welcome-btn-row-main";
      btnRow.appendChild(mainRow);

      const insertedButtons = [];
      for (const button of page.buttons) {
        const buttonElement = document.createElement("button");
        if (button.l10n) {
          document.l10n.setAttributes(buttonElement, button.l10n);
        } else if (button.label) {
          buttonElement.textContent = button.label;
        }
        const isSkip = button.skip === true;
        const isPrimary =
          !isSkip &&
          (button.primary === true ||
            (button.primary !== false &&
              !button.back &&
              !insertedButtons.some(b =>
                b.classList.contains("zen-welcome-btn-primary")
              )));
        if (isSkip) {
          buttonElement.classList.add("zen-welcome-btn-skip");
        } else {
          buttonElement.classList.add(
            isPrimary ? "zen-welcome-btn-primary" : "zen-welcome-btn-ghost"
          );
        }
        if (button.disabled) {
          buttonElement.disabled = true;
        }
        buttonElement.addEventListener("click", async () => {
          if (this._navigating || buttonElement.disabled) {
            return;
          }
          const shouldAdvance = await button.onclick();
          if (shouldAdvance === "back") {
            await this.prev();
          } else if (shouldAdvance) {
            await this.next();
          }
        });
        // Interactive as soon as mounted — no pointer-events lock waiting on fades.
        insertedButtons.push(buttonElement);
        if (isSkip) {
          btnRow.appendChild(buttonElement);
        } else {
          mainRow.appendChild(buttonElement);
        }
      }
      return insertedButtons;
    }

    async fadeOutPageGroup() {
      await welcomeTransition(
        "#zen-welcome-hero > *, #zen-welcome-page-content > *, #zen-welcome-wizard > .zen-welcome-decor, #zen-welcome-wizard > .zen-welcome-dots",
        { from: 1, to: 0, y: 8 }
      );
    }

    async fadeInPageGroup() {
      // Ensure starting opacity for the synchronized fade.
      setWelcomeOpacity(
        "#zen-welcome-hero > *, #zen-welcome-page-content > *",
        0
      );
      await welcomeTransition(
        "#zen-welcome-hero > *, #zen-welcome-page-content > *",
        { from: 0, to: 1, y: 10 }
      );
    }

    async #transitionAwayFromCurrentPage() {
      if (this._currentPage === -1) {
        return;
      }
      const previousPage = this._pages[this._currentPage];
      // One short fade for the whole page (content + controls together).
      if (!previousPage.dontFadeOut) {
        await this.fadeOutPageGroup();
      }
      await previousPage.fadeOut();
      const content = document.getElementById("zen-welcome-page-content");
      if (content) {
        content.innerHTML = "";
        content.removeAttribute("select-engine");
      }
      document.getElementById("zen-welcome-hero")?.remove();
      document.querySelector("#zen-welcome-wizard > .zen-welcome-decor")?.remove();
      document
        .querySelector("#zen-welcome-wizard > .zen-welcome-dots")
        ?.remove();
    }

    async #showCurrentPage() {
      const currentPage = this._pages[this._currentPage];
      if (!currentPage) {
        await this.finish();
        return;
      }
      // Mount hero + page body structure first. Search mounts the card grid
      // synchronously here and fills icons in the background.
      await this.fadeInSidebar(currentPage);
      await this.fadeInTitles(currentPage);

      const pageFade = Promise.resolve(currentPage.fadeIn()).catch(e => {
        console.error("[Astra] Welcome page fadeIn failed:", e);
      });
      // Wait only for structure (search resolves before icon fetches).
      await pageFade;

      // Buttons after content so the row stays at the bottom of the flex column,
      // but still before the synchronized fade — content and controls appear together.
      this.mountButtons(currentPage);

      performance.mark?.("zen-welcome-content-painted");

      await this.fadeInPageGroup();
      // Unlock after the short synchronized fade (≤150ms), not after multi-second springs.
      this._navigating = false;
      performance.mark?.("zen-welcome-buttons-interactive");
      try {
        currentPage.afterPaint?.();
      } catch (e) {
        console.error("[Astra] Welcome afterPaint failed:", e);
      }
    }

    async next() {
      if (this._navigating) {
        return;
      }
      this._navigating = true;
      try {
        await this.#transitionAwayFromCurrentPage();
        this._currentPage++;
        await this.#showCurrentPage();
      } finally {
        this._navigating = false;
      }
    }

    async prev() {
      if (this._navigating) {
        return;
      }
      // Step 2 Back returns to the intro (step 1); no Back on intro itself.
      if (this._currentPage <= 0) {
        await this.returnToIntro();
        return;
      }
      this._navigating = true;
      try {
        await this.#transitionAwayFromCurrentPage();
        this._currentPage--;
        await this.#showCurrentPage();
      } finally {
        this._navigating = false;
      }
    }

    async finish() {
      _iconToData = undefined;
      gZenWorkspaces.reorganizeTabsAfterWelcome();

      const pagesEl = document.getElementById("zen-welcome-pages");
      if (pagesEl) {
        await animate("#zen-welcome-wizard", { opacity: [1, 0] });
      }

      await this.#pinRemainingTabs();

      if (pagesEl) {
        await animate("#zen-welcome-pages", { opacity: [1, 0] });
      }
      document.getElementById("zen-welcome")?.remove();
      document.documentElement.removeAttribute("zen-welcome-stage");
      for (const element of document.getElementById("browser").children) {
        if (kZenElementsToIgnore.includes(element.id)) {
          continue;
        }
        element.style.opacity = 0;
        element.style.removeProperty("display");
      }
      restoreBrowserChromeLayout();
      await settleToolbarOverflowAfterWelcome();
      let elementsToIgnore = kZenElementsToIgnore
        .map(id => `#${id}`)
        .join(", ");
      await animate(`#browser > *:not(${elementsToIgnore})`, {
        opacity: [0, 1],
      });
      gZenUIManager.showToast("zen-welcome-finished");
      _welcomePagesInstance = null;
    }

    async #pinRemainingTabs() {
      for (const tab of _tabsToPinEssentials) {
        tab.removeAttribute("pending");
        gZenPinnedTabManager.addToEssentials(tab);
      }
      let tabsToGroup = [];
      if (!gBrowser.selectedTab.hasAttribute("zen-empty-tab")) {
        tabsToGroup.push(gBrowser.selectedTab);
      }
      // Fresh install often has nothing real to group (empty essentials +
      // empty-tab selected). Creating a folder anyway left a default
      // "astra basics" group in the sidebar with no user bookmarks/tabs.
      if (!tabsToGroup.length) {
        return;
      }
      gZenFolders.createFolder(tabsToGroup, {
        renameFolder: false,
        label: "astra basics",
        // Icon-only brand orange via folderAccent (--zen-primary-color on the
        // folder node). Do NOT pass color: "orange" — that sets Firefox
        // --tab-group-color-invert and paints the full label/row as a pill.
        // User-created folders omit folderAccent and keep workspace accent.
        folderAccent: "#FF9933",
      });
    }
  }

  class ZenSearchEngineStore {
    constructor() {
      this._engines = [];
    }

    async init() {
      const visibleEngines = await lazy.SearchService.getVisibleEngines();
      this.initSpecificEngine(visibleEngines);
    }

    getEngines() {
      return this._engines.filter(
        engine =>
          !(
            engine.name.toLowerCase().includes("wikipedia") ||
            engine.name.toLowerCase().includes("ebay")
          )
      );
    }

    /**
     * Display order for the welcome grid. Falls back to getEngines() if none
     * of the preferred names are present (does not change setDefault path).
     */
    getWelcomeEngines() {
      const all = this.getEngines();
      const byName = new Map(all.map(e => [e.name, e]));
      const preferred = kPreferredSearchEngines
        .map(name => byName.get(name))
        .filter(Boolean);
      return preferred.length ? preferred : all;
    }

    initSpecificEngine(engines) {
      for (const engine of engines) {
        try {
          this._engines.push(this._cloneEngine(engine));
        } catch (e) {
          console.error(e);
        }
      }
    }

    getEngineByName(aName) {
      return this._engines.find(engine => engine.name == aName);
    }

    _cloneEngine(aEngine) {
      const clonedObj = {};

      for (const i of ["name", "alias", "_iconURI", "hidden"]) {
        clonedObj[i] = aEngine[i];
      }

      clonedObj.originalEngine = aEngine;

      return clonedObj;
    }

    async getDefaultEngine() {
      let engineName = await lazy.SearchService.getDefault();
      return this.getEngineByName(engineName._name);
    }

    async setDefaultEngine(engine) {
      // FF149+ (bug 2003300): Ci.nsISearchService.CHANGE_REASON_* was removed.
      // SearchService.setDefault expects SearchService.CHANGE_REASON string values.
      await lazy.SearchService.init();
      const liveEngine =
        lazy.SearchService.getEngineByName(engine.name) ||
        engine.originalEngine;
      await lazy.SearchService.setDefault(
        liveEngine,
        lazy.SearchService.CHANGE_REASON.USER
      );
    }
  }

  function getWelcomePages() {
    const totalSteps = kTotalWelcomeSteps;

    const backButton = {
      l10n: "zen-welcome-back",
      back: true,
      onclick: async () => "back",
    };
    const continueButton = {
      l10n: "zen-welcome-continue",
      primary: true,
      onclick: async () => true,
    };
    const skipButton = {
      l10n: "zen-welcome-skip",
      skip: true,
      // Same as pre-redesign: advance to the next step (not finish()).
      // finish() + settleToolbarOverflow still run when the final CTA advances
      // past the last page.
      onclick: async () => true,
    };

    return [
      {
        stepNum: 2,
        totalSteps,
        icon: "folder",
        eyebrow: "zen-welcome-browser-eyebrow",
        text: [
          { id: "zen-welcome-browser-title" },
          { id: "zen-welcome-browser-sub" },
        ],
        decor: [
          { icon: "folder", pos: "tl" },
          { icon: "sparkles", pos: "tr" },
          { type: "dot", pos: "a" },
        ],
        buttons: [backButton, continueButton, skipButton],
        fadeIn() {
          const content = document.getElementById("zen-welcome-page-content");
          content.setAttribute("browser-choice", "true");

          const list = document.createElement("div");
          list.className = "zen-welcome-choice-list";

          for (const [value, titleId, subId] of [
            ["chrome", "zen-welcome-browser-yes", "zen-welcome-browser-yes-sub"],
            ["new", "zen-welcome-browser-no", "zen-welcome-browser-no-sub"],
          ]) {
            const label = document.createElement("label");
            label.className = "zen-welcome-choice-card";
            const input = document.createElement("input");
            input.type = "radio";
            input.name = "zen-welcome-browser-choice";
            input.value = value;
            input.checked =
              _welcomeBrowserChoice === value ||
              (_welcomeBrowserChoice === null && value === "chrome");
            input.addEventListener("change", () => {
              if (input.checked) {
                _welcomeBrowserChoice = value;
              }
            });
            const body = document.createElement("div");
            body.className = "zen-welcome-choice-body";
            const title = document.createElement("div");
            title.className = "zen-welcome-choice-title";
            document.l10n.setAttributes(title, titleId);
            const sub = document.createElement("div");
            sub.className = "zen-welcome-choice-sub";
            document.l10n.setAttributes(sub, subId);
            body.appendChild(title);
            body.appendChild(sub);
            label.appendChild(input);
            label.appendChild(body);
            list.appendChild(label);
          }
          content.appendChild(list);

          const importRow = document.createElement("div");
          importRow.className = "zen-welcome-browser-import-row";
          const importBtn = document.createElement("button");
          importBtn.type = "button";
          importBtn.className = "zen-welcome-btn-ghost zen-welcome-browser-import-btn";
          document.l10n.setAttributes(importBtn, "zen-welcome-browser-import");
          importBtn.addEventListener("click", () => openImportSettings());
          importRow.appendChild(importBtn);
          content.appendChild(importRow);

          if (_welcomeBrowserChoice === null) {
            _welcomeBrowserChoice = "chrome";
          }
        },
        fadeOut() {
          const selected =
            contentQuerySelectedBrowserChoice() || _welcomeBrowserChoice || "chrome";
          _welcomeBrowserChoice = selected;
          const fromChrome = selected === "chrome";
          // Soft default: Chrome-like top bar for switchers; Only Sidebar for others.
          Services.prefs.setBoolPref(
            "zen.view.use-single-toolbar",
            !fromChrome
          );
          Services.prefs.setBoolPref("zen.view.sidebar-expanded", true);
          gZenVerticalTabsManager?._updateEvent?.();
          document
            .getElementById("zen-welcome-page-content")
            ?.removeAttribute("browser-choice");
        },
      },
      {
        stepNum: 3,
        totalSteps,
        icon: "shield",
        eyebrow: "zen-welcome-ublock-eyebrow",
        text: [
          { id: "zen-welcome-ublock-title" },
          { id: "zen-welcome-ublock-sub" },
        ],
        decor: [
          { icon: "ad-block", pos: "tl" },
          { icon: "eye", pos: "tr" },
          { type: "dot", pos: "a" },
        ],
        buttons: [backButton, continueButton, skipButton],
        fadeIn() {},
        fadeOut() {},
      },
      {
        stepNum: 4,
        totalSteps,
        icon: "sparkles",
        eyebrow: "zen-welcome-ai-eyebrow",
        text: [
          { id: "zen-welcome-ai-title" },
          { id: "zen-welcome-ai-sub" },
        ],
        decor: [
          { icon: "translate", pos: "tl" },
          { icon: "chat", pos: "tr" },
          { type: "dot", pos: "b" },
        ],
        buttons: [backButton, continueButton, skipButton],
        fadeIn() {},
        fadeOut() {},
      },
      {
        stepNum: 5,
        totalSteps,
        icon: "compact",
        eyebrow: "zen-welcome-compact-eyebrow",
        text: [
          { id: "zen-welcome-compact-title" },
          { id: "zen-welcome-compact-sub" },
        ],
        decor: [{ type: "dot", pos: "a" }, { type: "dot", pos: "b" }],
        buttons: [backButton, continueButton, skipButton],
        fadeIn() {
          // Informational only — does not toggle compact mode.
          const content = document.getElementById("zen-welcome-page-content");
          const wrap = document.createElement("div");
          wrap.className = "zen-welcome-compact-compare";

          for (const [variant, labelId] of [
            ["before", "zen-welcome-compact-before"],
            ["after", "zen-welcome-compact-after"],
          ]) {
            const col = document.createElement("div");
            col.className = "zen-welcome-compact-col";
            const pane = document.createElement("div");
            pane.className = "zen-welcome-compact-pane";
            pane.setAttribute("data-variant", variant);
            const bar = document.createElement("div");
            bar.className = "bar";
            const body = document.createElement("div");
            body.className = "body";
            pane.appendChild(bar);
            pane.appendChild(body);
            const label = document.createElement("div");
            label.className = "zen-welcome-compact-label";
            document.l10n.setAttributes(label, labelId);
            col.appendChild(pane);
            col.appendChild(label);
            wrap.appendChild(col);
          }
          content.appendChild(wrap);
        },
        fadeOut() {},
      },
      {
        stepNum: 6,
        totalSteps,
        icon: "search",
        eyebrow: "zen-welcome-search-eyebrow",
        text: [
          { id: "zen-welcome-search-title" },
          { id: "zen-welcome-search-sub" },
        ],
        decor: [{ type: "dot", pos: "a" }],
        buttons: [
          backButton,
          {
            l10n: "zen-welcome-finish-btn",
            primary: true,
            // Advance past last page → #showCurrentPage → finish(), which
            // includes settleToolbarOverflowAfterWelcome (ca4c796 / 95590c2).
            onclick: async () => true,
          },
        ],
        async fadeIn() {
          const content = document.getElementById("zen-welcome-page-content");
          content.setAttribute("select-engine", "true");

          // Skeleton grid first (sync) so the page has structure before icons/data.
          const skeletons = [];
          for (let i = 0; i < kPreferredSearchEngines.length; i++) {
            const label = document.createElement("label");
            label.className =
              "zen-welcome-engine-card zen-welcome-engine-skeleton";
            label.setAttribute("aria-hidden", "true");
            const icon = document.createElement("span");
            icon.className = "engine-icon engine-icon-skeleton";
            const name = document.createElement("span");
            name.className = "zen-welcome-engine-name";
            name.textContent = "\u00a0";
            label.appendChild(icon);
            label.appendChild(name);
            content.appendChild(label);
            skeletons.push(label);
          }

          // Hydrate after the synchronized fade so replacement cards stay visible.
          this.afterPaint = () => {
            this.afterPaint = null;
            (async () => {
              try {
                const engineStore = new ZenSearchEngineStore();
                await engineStore.init();
                const defaultEngine = await lazy.SearchService.getDefault();
                const applySelectedEngine = async engineName => {
                  const selectedEngine =
                    engineStore.getEngineByName(engineName);
                  if (!selectedEngine) {
                    throw new Error(
                      `Welcome search engine not in store: ${engineName}`
                    );
                  }
                  await engineStore.setDefaultEngine(selectedEngine);
                };

                const btnRow = content.querySelector(".zen-welcome-btn-row");
                for (const sk of skeletons) {
                  sk.remove();
                }

                const iconJobs = [];
                for (const engine of engineStore.getWelcomeEngines()) {
                  const label = document.createElement("label");
                  label.className = "zen-welcome-engine-card";
                  label.style.opacity = "1";
                  const engineId = engine.name
                    .replace(/\s+/g, "-")
                    .toLowerCase();
                  label.setAttribute("for", engineId);
                  const input = document.createElement("input");
                  input.setAttribute("type", "radio");
                  input.setAttribute("id", engineId);
                  input.setAttribute(
                    "name",
                    "zen-welcome-set-default-browser"
                  );
                  input.setAttribute("hidden", "true");
                  input.dataset.engineName = engine.name;
                  if (engine.name === defaultEngine?.name) {
                    input.setAttribute("checked", "true");
                  }
                  label.appendChild(input);
                  const engineLabel = document.createElement("span");
                  engineLabel.className = "zen-welcome-engine-name";
                  engineLabel.textContent = engine.name;
                  const icon = document.createElement("img");
                  icon.setAttribute("width", "28");
                  icon.setAttribute("height", "28");
                  icon.setAttribute("class", "engine-icon");
                  icon.setAttribute("alt", "");
                  icon.setAttribute("decoding", "async");
                  icon.style.visibility = "hidden";
                  iconJobs.push(
                    (async () => {
                      try {
                        const iconURL = await resolveWelcomeEngineIconURL(
                          engine.originalEngine
                        );
                        if (iconURL) {
                          icon.setAttribute("src", iconURL);
                          icon.style.visibility = "";
                        }
                      } catch (e) {
                        console.error(
                          "[Astra] Welcome search engine icon failed:",
                          engine.name,
                          e
                        );
                      }
                    })()
                  );
                  label.appendChild(icon);
                  label.appendChild(engineLabel);
                  if (btnRow) {
                    content.insertBefore(label, btnRow);
                  } else {
                    content.appendChild(label);
                  }
                  input.addEventListener("change", async () => {
                    if (!input.checked) {
                      return;
                    }
                    try {
                      await applySelectedEngine(engine.name);
                    } catch (e) {
                      console.error(
                        "[Astra] Failed to set default search engine:",
                        e
                      );
                    }
                  });
                }
                Promise.all(iconJobs).catch(() => {});
              } catch (e) {
                console.error("[Astra] Search engine page fadeIn failed:", e);
                for (const sk of skeletons) {
                  sk.remove();
                }
                _welcomePagesInstance?.next().catch(err =>
                  console.error(
                    "[Astra] Failed to advance past broken welcome page:",
                    err
                  )
                );
              }
            })();
          };
        },
        async fadeOut() {
          const content = document.getElementById("zen-welcome-page-content");
          // Commit the checked radio on leave so Next still applies the
          // choice even if the change handler did not settle.
          const checked = content?.querySelector(
            'input[name="zen-welcome-set-default-browser"]:checked'
          );
          const engineName = checked?.dataset?.engineName?.trim();
          if (engineName) {
            try {
              await lazy.SearchService.init();
              const engine = lazy.SearchService.getEngineByName(engineName);
              if (engine) {
                await lazy.SearchService.setDefault(
                  engine,
                  lazy.SearchService.CHANGE_REASON.USER
                );
              } else {
                console.error(
                  "[Astra] Welcome search engine not found:",
                  engineName
                );
              }
            } catch (e) {
              console.error(
                "[Astra] Failed to apply welcome search engine on leave:",
                e
              );
            }
          }
          content?.removeAttribute("select-engine");
        },
      },
    ];
  }

  async function animateInitialStage() {
    const [line1, line2] = await document.l10n.formatValues([
      { id: "zen-welcome-title-line1" },
      { id: "zen-welcome-title-line2" },
    ]);
    const titleElement = document.getElementById("zen-welcome-start-title");
    // XHTML chrome rejects bare <br>/<span> via innerHTML (SyntaxError:
    // "An invalid or illegal string was specified"). Build with DOM APIs.
    // Build with DOM APIs (not innerHTML) — XHTML chrome rejects bare <br>/<span>
    // via innerHTML. Two block lines keep "Meet the" / "internet, better."
    titleElement.replaceChildren();
    const line1El = document.createElement("div");
    line1El.textContent = line1;
    const line2El = document.createElement("div");
    line2El.textContent = line2;
    titleElement.appendChild(line1El);
    titleElement.appendChild(line2El);

    const markWrap = document.querySelector(
      "#zen-welcome-start .zen-welcome-mark-wrap"
    );
    const wordmark = document.querySelector(
      "#zen-welcome-start .zen-welcome-wordmark"
    );
    if (markWrap) {
      markWrap.style.opacity = "0";
    }
    if (wordmark) {
      wordmark.style.opacity = "0";
    }

    await animate(
      "#zen-welcome-start .zen-welcome-mark-wrap, #zen-welcome-start .zen-welcome-wordmark, #zen-welcome-start-title, #zen-welcome-start-subtitle",
      { opacity: [0, 1], y: [20, 0] },
      {
        delay: getMotion().stagger(0.12, { startDelay: 0.15 }),
        type: "spring",
        stiffness: 280,
        damping: 22,
        mass: 1.4,
      }
    );

    const button = document.getElementById("zen-welcome-start-button");
    const importLink = document.getElementById("zen-welcome-import-link");
    const startDots = document.getElementById("zen-welcome-start-dots");
    let starting = false;
    button.addEventListener("click", async () => {
      // Single-flight: ignore repeats while the exit animation / page boot runs.
      if (starting || button.disabled || _welcomePagesInstance) {
        return;
      }
      starting = true;
      button.disabled = true;
      try {
        await welcomeTransition(
          "#zen-welcome-start-inner > *, #zen-welcome-start > .zen-welcome-decor",
          { from: 1, to: 0, y: 8 }
        );
        new nsZenWelcomePages(getWelcomePages());
      } catch (e) {
        button.disabled = false;
        throw e;
      } finally {
        starting = false;
      }
    });

    await animate(
      [button, importLink, startDots].filter(Boolean),
      { opacity: [0, 1], y: [16, 0] },
      {
        delay: 0.08,
        type: "spring",
        stiffness: 280,
        damping: 22,
        mass: 1.4,
      }
    );
  }

  function bindWelcomeEnterKey() {
    window.addEventListener(
      "keydown",
      event => {
        const isEnter = event.key === "Enter" || event.keyCode === 13;
        if (!isEnter || event.defaultPrevented || event.repeat) {
          return;
        }
        const welcome = document.getElementById("zen-welcome");
        if (!welcome) {
          return;
        }
        // Don't steal Enter from real text fields; hidden radios on the search
        // step are fine to override.
        const tag = event.target?.localName;
        if (
          tag === "textarea" ||
          (tag === "input" &&
            event.target?.type &&
            event.target.type !== "radio" &&
            event.target.type !== "hidden" &&
            event.target.type !== "button" &&
            event.target.type !== "submit")
        ) {
          return;
        }
        const startEl = document.getElementById("zen-welcome-start");
        const startBtn = document.getElementById("zen-welcome-start-button");
        if (
          startBtn &&
          startEl &&
          getComputedStyle(startEl).display !== "none" &&
          !startBtn.disabled
        ) {
          event.preventDefault();
          startBtn.click();
          return;
        }
        const primary = document.querySelector(
          "#zen-welcome-page-content .zen-welcome-btn-primary:not([disabled])"
        );
        if (primary && primary.style.pointerEvents !== "none") {
          event.preventDefault();
          primary.click();
        }
      },
      true
    );
  }

  function centerWindowOnScreen() {
    window.addEventListener(
      "MozAfterPaint",
      function () {
        window.resizeTo(875, 560);
        window.focus();
        const appWin = window.docShell.treeOwner
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIAppWindow);
        appWin.rollupAllPopups();
        window.moveTo(
          screen.availLeft + (screen.availWidth - outerWidth) / 2,
          screen.availTop + (screen.availHeight - outerHeight) / 2
        );
      },
      { once: true }
    );
  }

  function restoreBrowserOnWelcomeFailure() {
    try {
      document.getElementById("zen-welcome")?.remove();
      document.documentElement.removeAttribute("zen-welcome-stage");
      for (const element of document.getElementById("browser").children) {
        if (kZenElementsToIgnore.includes(element.id)) {
          continue;
        }
        element.style.removeProperty("display");
      }
      restoreBrowserChromeLayout();
      // Fire-and-forget settle: failure path is sync; two rAFs still let
      // OverflowableToolbar un-park before the user interacts.
      settleToolbarOverflowAfterWelcome();
      Services.prefs.setBoolPref("zen.welcome-screen.seen", false);
    } catch (e) {
      console.error(
        "[Astra] Failed to restore browser after welcome failure:",
        e
      );
    }
  }

  function startZenWelcome() {
    try {
      clearBrowserElements();
      centerWindowOnScreen();
      initializeZenWelcome();
      bindWelcomeEnterKey();
      animateInitialStage().catch(e => {
        console.error("[Astra] Welcome animateInitialStage failed:", e);
        restoreBrowserOnWelcomeFailure();
      });
    } catch (e) {
      console.error("[Astra] Welcome startup failed:", e);
      restoreBrowserOnWelcomeFailure();
    }
  }

  startZenWelcome();
}
