// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

{
  let _tabsToPinEssentials = [];
  let _welcomePagesInstance = null;
  let lazy = {};

  ChromeUtils.defineESModuleGetters(lazy, {
    SearchService: "moz-src:///toolkit/components/search/SearchService.sys.mjs",
  });

  const kZenElementsToIgnore = [
    "zen-browser-background",
    "zen-toast-container",
  ];

  const kFeatIconGlyphs = {
    "layout-sidebar": "⊞",
    columns: "⫿",
    shield: "🛡",
    "layout-compact": "▭",
    eye: "👁",
    "hand-finger": "☝",
  };

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

  function initializeZenWelcome() {
    document.documentElement.setAttribute("zen-welcome-stage", "true");
    const XUL = `
      <html:div id="zen-welcome">
        <html:div id="zen-welcome-start">
          <html:div id="zen-welcome-start-title"></html:div>
          <html:p id="zen-welcome-start-subtitle" data-l10n-id="zen-welcome-subtitle"></html:p>
          <html:button class="zen-welcome-btn-primary" id="zen-welcome-start-button" data-l10n-id="zen-welcome-get-started"></html:button>
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
  }

  var _iconToData = {};

  async function getIconData(iconURL) {
    if (_iconToData[iconURL]) {
      return _iconToData[iconURL];
    }
    const response = await fetch(iconURL);
    if (!response.ok) {
      console.error(`Failed to fetch icon: ${iconURL}`);
      return null;
    }
    const blob = await response.blob();
    const reader = new FileReader();
    const data = await new Promise(resolve => {
      reader.onloadend = () => {
        const base64Data = reader.result.split(",")[1];
        _iconToData[iconURL] = `data:${blob.type};base64,${base64Data}`;
        resolve(_iconToData[iconURL]);
      };
      reader.readAsDataURL(blob);
    });
    return data;
  }

  function setRequestedLocale(localeList) {
    try {
      Services.prefs.setStringPref("intl.locale.requested", localeList);
      Services.locale.requestedLocales = localeList.split(",").map(l => l.trim());
      const win = Services.wm.getMostRecentWindow("navigator:browser");
      if (win) {
        win.location.reload();
      }
    } catch (e) {
      console.error("Failed to set requested locale", e);
    }
  }

  async function buildSidebar(stepNum, totalSteps, titleL10n, subL10n) {
    const existing = document.getElementById("zen-welcome-sidebar");
    if (existing) {
      existing.remove();
    }

    const sidebar = document.createElement("div");
    sidebar.id = "zen-welcome-sidebar";

    const pill = document.createElement("div");
    pill.className = "zen-welcome-step-pill";
    pill.textContent = `Step ${stepNum} of ${totalSteps}`;
    sidebar.appendChild(pill);

    const title = document.createElement("div");
    title.id = "zen-welcome-sidebar-title";
    document.l10n.setAttributes(title, titleL10n);
    sidebar.appendChild(title);

    const sub = document.createElement("div");
    sub.id = "zen-welcome-sidebar-sub";
    document.l10n.setAttributes(sub, subL10n);
    sidebar.appendChild(sub);

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
    sidebar.appendChild(dots);

    const wizard = document.getElementById("zen-welcome-wizard");
    const content = document.getElementById("zen-welcome-page-content");
    wizard.insertBefore(sidebar, content);
    return sidebar;
  }

  function buildToggle(labelKey, subKey, defaultOn = true) {
    const el = document.createElement("div");
    el.className = "zen-welcome-toggle-item";

    const textWrap = document.createElement("div");
    const label = document.createElement("div");
    label.className = "zen-welcome-toggle-label";
    document.l10n.setAttributes(label, labelKey);
    const sub = document.createElement("div");
    sub.className = "zen-welcome-toggle-sub";
    document.l10n.setAttributes(sub, subKey);
    textWrap.appendChild(label);
    textWrap.appendChild(sub);

    const pill = document.createElement("div");
    pill.className = "zen-welcome-toggle-pill";
    if (!defaultOn) {
      pill.setAttribute("off", "true");
    }
    pill.addEventListener("click", () => {
      pill.toggleAttribute("off");
    });

    el.appendChild(textWrap);
    el.appendChild(pill);

    return {
      el,
      isOn: () => !pill.hasAttribute("off"),
    };
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
      document.getElementById("zen-welcome-pages").style.display = "flex";
      document.getElementById("zen-welcome-start").remove();
      window.maximize();
      animate(
        "#zen-welcome-pages",
        { opacity: [0, 1] },
        { delay: 0.2, duration: 0.1 }
      );
    }

    async fadeInSidebar(page) {
      if (page.noSidebar || !page.stepNum) {
        return;
      }
      const titleL10n = page.text[0].id;
      const subL10n = page.text[1].id;
      await buildSidebar(
        page.stepNum,
        page.totalSteps,
        titleL10n,
        subL10n
      );
      await animate(
        "#zen-welcome-sidebar > *",
        { x: ["150%", 0] },
        {
          delay: getMotion().stagger(0.05),
          type: "spring",
          bounce: 0.2,
        }
      );
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

    async fadeInButtons(page) {
      if (page.skipButtons) {
        return;
      }
      const content = document.getElementById("zen-welcome-page-content");
      let btnRow = content.querySelector(".zen-welcome-btn-row");
      if (!btnRow) {
        btnRow = document.createElement("div");
        btnRow.className = "zen-welcome-btn-row";
        content.appendChild(btnRow);
      }
      // Ensure the row itself is never left at the content's default opacity: 0.
      btnRow.style.opacity = "1";

      const insertedButtons = [];
      for (const button of page.buttons) {
        const buttonElement = document.createElement("button");
        if (button.l10n) {
          document.l10n.setAttributes(buttonElement, button.l10n);
        } else if (button.label) {
          buttonElement.textContent = button.label;
        }
        const isPrimary =
          button.primary === true ||
          (button.primary !== false &&
            !button.back &&
            !insertedButtons.some(b => b.classList.contains("zen-welcome-btn-primary")));
        buttonElement.classList.add(
          isPrimary ? "zen-welcome-btn-primary" : "zen-welcome-btn-ghost"
        );
        buttonElement.addEventListener("click", async () => {
          if (this._navigating) {
            return;
          }
          const shouldAdvance = await button.onclick();
          if (shouldAdvance === "back") {
            await this.prev();
          } else if (shouldAdvance) {
            await this.next();
          }
        });
        buttonElement.style.pointerEvents = "none";
        insertedButtons.push(buttonElement);
        btnRow.appendChild(buttonElement);
      }
      await animate(
        ".zen-welcome-btn-row button",
        { opacity: [0, 1], x: ["150%", 0] },
        {
          delay: getMotion().stagger(0.1, { startDelay: 0.4 }),
          type: "spring",
          bounce: 0.2,
        }
      );
      for (const button of insertedButtons) {
        button.style.pointerEvents = "";
      }
    }

    async fadeInContent() {
      if (document.getElementById("zen-welcome-finish")) {
        return;
      }
      const selector = "#zen-welcome-page-content > *:not(.zen-welcome-btn-row)";
      const targets = document.querySelectorAll(selector);
      if (!targets.length) {
        return;
      }
      await animate(
        selector,
        { opacity: [0, 1] },
        {
          delay: getMotion().stagger(0.1),
          type: "spring",
          bounce: 0.2,
        }
      );
    }

    async fadeOutButtons() {
      const btnRow = document.querySelector(".zen-welcome-btn-row");
      if (!btnRow) {
        return;
      }
      await animate(
        ".zen-welcome-btn-row button",
        { x: [0, "-150%"] },
        {
          type: "spring",
          bounce: 0,
          delay: getMotion().stagger(0.1, { startDelay: 0.4 }),
        }
      );
      btnRow.remove();
    }

    async fadeOutSidebar() {
      const sidebar = document.getElementById("zen-welcome-sidebar");
      if (!sidebar) {
        return;
      }
      await animate(
        "#zen-welcome-sidebar > *",
        { x: [0, "-150%"] },
        {
          delay: getMotion().stagger(0.05, { startDelay: 0.3 }),
          type: "spring",
          bounce: 0,
        }
      );
      sidebar.remove();
    }

    async fadeOutContent() {
      const selector = "#zen-welcome-page-content > *:not(.zen-welcome-btn-row)";
      const targets = document.querySelectorAll(selector);
      if (!targets.length) {
        return;
      }
      await animate(
        selector,
        { opacity: [1, 0] },
        {
          delay: getMotion().stagger(0.05, { startDelay: 0.3 }),
          type: "spring",
          bounce: 0,
          duration: 0.1,
        }
      );
    }

    async #transitionAwayFromCurrentPage() {
      if (this._currentPage === -1) {
        return;
      }
      const previousPage = this._pages[this._currentPage];
      const promises = [this.fadeOutSidebar(), this.fadeOutButtons()];
      if (!previousPage.dontFadeOut) {
        promises.push(this.fadeOutContent());
      }
      await Promise.all(promises);
      await previousPage.fadeOut();
      const content = document.getElementById("zen-welcome-page-content");
      if (content) {
        content.innerHTML = "";
        content.removeAttribute("select-engine");
      }
    }

    async #showCurrentPage() {
      const currentPage = this._pages[this._currentPage];
      if (!currentPage) {
        await this.finish();
        return;
      }
      await Promise.all([
        this.fadeInSidebar(currentPage),
        this.fadeInTitles(currentPage),
      ]);
      // Unlock before page fadeIn so slow/failing pages (search engines) can
      // advance; buttons are not in the DOM yet so users can't double-navigate.
      this._navigating = false;
      await currentPage.fadeIn();
      // Buttons after content so the row stays at the bottom of the flex column.
      await Promise.all([
        this.fadeInButtons(currentPage),
        this.fadeInContent(),
      ]);
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
      if (this._navigating || this._currentPage <= 0) {
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

      const finishEl = document.getElementById("zen-welcome-finish");
      const pagesEl = document.getElementById("zen-welcome-pages");
      if (finishEl) {
        await animate("#zen-welcome-finish", { opacity: [1, 0] });
      } else if (pagesEl) {
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
      gZenFolders.createFolder(tabsToGroup, {
        renameFolder: false,
        label: "astra basics",
      });
    }

    async animHeart() {
      const sidebar = document.getElementById("zen-welcome-sidebar");
      if (!sidebar) {
        return;
      }
      const heart = document.createElement("div");
      heart.id = "zen-welcome-heart";
      sidebar.style.width = "100%";
      sidebar.appendChild(heart);
      sidebar.setAttribute("animate-heart", "true");
      await animate(
        "#zen-welcome-heart",
        { opacity: [0, 1, 1, 1, 0], scale: [0.5, 1, 1.2, 1, 1.2] },
        {
          duration: 1.5,
          delay: 0.2,
          bounce: 0,
        }
      );
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
    let importToggle;
    let defaultToggle;
    const totalSteps = 4;

    const backButton = {
      l10n: "zen-welcome-back",
      back: true,
      onclick: async () => "back",
    };
    const nextButton = {
      l10n: "zen-generic-next",
      primary: true,
      onclick: async () => true,
    };

    return [
      {
        stepNum: 1,
        totalSteps,
        text: [
          { id: "zen-welcome-features-title" },
          { id: "zen-welcome-features-sub" },
        ],
        buttons: [nextButton],
        fadeIn() {
          const content = document.getElementById("zen-welcome-page-content");
          const grid = document.createElement("div");
          grid.className = "zen-welcome-feature-grid";

          const features = [
            {
              icon: "layout-sidebar",
              color: "orange",
              name: "zen-feat-workspaces",
              sub: "zen-feat-workspaces-sub",
            },
            {
              icon: "columns",
              color: "blue",
              name: "zen-feat-splitview",
              sub: "zen-feat-splitview-sub",
            },
            {
              icon: "shield",
              color: "green",
              name: "zen-feat-smartguard",
              sub: "zen-feat-smartguard-sub",
            },
            {
              icon: "layout-compact",
              color: "purple",
              name: "zen-feat-compact",
              sub: "zen-feat-compact-sub",
            },
            {
              icon: "eye",
              color: "teal",
              name: "zen-feat-glance",
              sub: "zen-feat-glance-sub",
            },
            {
              icon: "shield",
              color: "pink",
              name: "zen-feat-suraksha",
              sub: "zen-feat-suraksha-sub",
            },
          ];

          for (const feat of features) {
            const card = document.createElement("div");
            card.className = "zen-welcome-feat-card";

            const iconEl = document.createElement("div");
            iconEl.className = "zen-welcome-feat-icon";
            iconEl.setAttribute("data-color", feat.color);
            iconEl.setAttribute("data-icon", feat.icon);
            iconEl.textContent = kFeatIconGlyphs[feat.icon] || "•";

            const textWrap = document.createElement("div");
            const nameEl = document.createElement("div");
            nameEl.className = "zen-welcome-feat-name";
            document.l10n.setAttributes(nameEl, feat.name);
            const subEl = document.createElement("div");
            subEl.className = "zen-welcome-feat-sub";
            document.l10n.setAttributes(subEl, feat.sub);
            textWrap.appendChild(nameEl);
            textWrap.appendChild(subEl);

            card.appendChild(iconEl);
            card.appendChild(textWrap);
            grid.appendChild(card);
          }

          content.appendChild(grid);
        },
        fadeOut() {},
      },
      {
        stepNum: 2,
        totalSteps,
        text: [
          { id: "zen-welcome-privacy-title" },
          { id: "zen-welcome-privacy-sub" },
        ],
        buttons: [backButton, nextButton],
        fadeIn() {
          const content = document.getElementById("zen-welcome-page-content");

          const list = document.createElement("div");
          list.className = "zen-welcome-privacy-list";
          for (const key of [
            "zen-privacy-trackers",
            "zen-privacy-ads",
            "zen-privacy-fingerprint",
            "zen-privacy-telemetry",
          ]) {
            const item = document.createElement("div");
            item.className = "zen-welcome-priv-item";
            const check = document.createElement("div");
            check.className = "zen-welcome-priv-check";
            check.textContent = "✓";
            const label = document.createElement("span");
            document.l10n.setAttributes(label, key);
            item.appendChild(check);
            item.appendChild(label);
            list.appendChild(item);
          }
          content.appendChild(list);

          const toggleList = document.createElement("div");
          toggleList.className = "zen-welcome-toggle-list";
          toggleList.appendChild(
            buildToggle("zen-privacy-https", "zen-privacy-https-sub", true).el
          );
          toggleList.appendChild(
            buildToggle(
              "zen-privacy-safebrowsing",
              "zen-privacy-safebrowsing-sub",
              true
            ).el
          );
          content.appendChild(toggleList);
        },
        fadeOut() {},
      },
      {
        stepNum: 3,
        totalSteps,
        text: [
          { id: "zen-welcome-search-title" },
          { id: "zen-welcome-search-sub" },
        ],
        buttons: [backButton, nextButton],
        async fadeIn() {
          try {
            const content = document.getElementById("zen-welcome-page-content");
            const engineStore = new ZenSearchEngineStore();
            await engineStore.init();

            content.setAttribute("select-engine", "true");

            const defaultEngine = await lazy.SearchService.getDefault();
            const promises = [];
            const applySelectedEngine = async engineName => {
              const selectedEngine = engineStore.getEngineByName(engineName);
              if (!selectedEngine) {
                throw new Error(
                  `Welcome search engine not in store: ${engineName}`
                );
              }
              await engineStore.setDefaultEngine(selectedEngine);
            };
            engineStore.getEngines().forEach(engine => {
              const label = document.createElement("label");
              const engineId = engine.name.replace(/\s+/g, "-").toLowerCase();
              label.setAttribute("for", engineId);
              const input = document.createElement("input");
              input.setAttribute("type", "radio");
              input.setAttribute("id", engineId);
              input.setAttribute("name", "zen-welcome-set-default-browser");
              input.setAttribute("hidden", "true");
              // Stable id for commit on leave — display names match
              // search-config-v2 (Google/Bing/DuckDuckGo/Perplexity/Yahoo).
              input.dataset.engineName = engine.name;
              if (engine.name === defaultEngine?.name) {
                input.setAttribute("checked", "true");
              }
              label.appendChild(input);
              const engineLabel = document.createElement("label");
              engineLabel.textContent = engine.name;
              const icon = document.createElement("img");
              promises.push(
                (async () => {
                  try {
                    const iconURL = await engine.originalEngine.getIconURL();
                    if (iconURL) {
                      icon.setAttribute("src", iconURL);
                    } else {
                      icon.style.visibility = "hidden";
                    }
                  } catch {
                    icon.style.visibility = "hidden";
                  }
                })()
              );
              icon.setAttribute("width", "32");
              icon.setAttribute("height", "32");
              icon.setAttribute("class", "engine-icon");
              label.appendChild(icon);
              label.appendChild(engineLabel);
              content.appendChild(label);
              // Apply on radio change (label click checks the input).
              // Matches step 4 committing choices via real browser APIs.
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
            });
            await Promise.all(promises);
          } catch (e) {
            console.error("[Astra] Search engine page fadeIn failed:", e);
            _welcomePagesInstance?.next().catch(err =>
              console.error("[Astra] Failed to advance past broken welcome page:", err)
            );
          }
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
      {
        stepNum: 4,
        totalSteps,
        text: [
          { id: "zen-welcome-import-title" },
          { id: "zen-welcome-import-sub" },
        ],
        buttons: [
          backButton,
          {
            l10n: "zen-generic-next",
            primary: true,
            onclick: async () => {
              if (importToggle?.isOn()) {
                MigrationUtils.showMigrationWizard(window, {
                  isStartupMigration: true,
                });
              }
              if (defaultToggle?.isOn()) {
                if (AppConstants.HAVE_SHELL_SERVICE) {
                  const shellSvc = window.getShellService();
                  if (shellSvc) {
                    try {
                      await shellSvc.setDefaultBrowser(false);
                    } catch (ex) {
                      console.error(ex);
                    }
                  }
                }
              }
              return true;
            },
          },
          {
            l10n: "zen-welcome-skip",
            onclick: async () => true,
          },
        ],
        fadeIn() {
          const content = document.getElementById("zen-welcome-page-content");
          const toggleList = document.createElement("div");
          toggleList.className = "zen-welcome-toggle-list";
          importToggle = buildToggle(
            "zen-import-chrome",
            "zen-import-chrome-sub",
            false
          );
          defaultToggle = buildToggle(
            "zen-import-default",
            "zen-import-default-sub",
            false
          );
          toggleList.appendChild(importToggle.el);
          toggleList.appendChild(defaultToggle.el);
          content.appendChild(toggleList);
        },
        fadeOut() {},
      },
      {
        noSidebar: true,
        skipButtons: true,
        text: [],
        buttons: [],
        async fadeIn() {
          const wizard = document.getElementById("zen-welcome-wizard");
          wizard.innerHTML = "";
          wizard.style.height = "520px";

          const finish = document.createElement("div");
          finish.id = "zen-welcome-finish";

          const icon = document.createElement("div");
          icon.id = "zen-welcome-finish-icon";
          icon.textContent = "🚀";

          const title = document.createElement("div");
          title.id = "zen-welcome-finish-title";
          document.l10n.setAttributes(title, "zen-welcome-finish-title");

          const sub = document.createElement("div");
          sub.id = "zen-welcome-finish-sub";
          document.l10n.setAttributes(sub, "zen-welcome-finish-sub");

          const btn = document.createElement("button");
          btn.className = "zen-welcome-btn-primary";
          document.l10n.setAttributes(btn, "zen-welcome-finish-btn");
          btn.addEventListener("click", async () => {
            if (_welcomePagesInstance) {
              await _welcomePagesInstance.finish();
            }
          });

          finish.appendChild(icon);
          finish.appendChild(title);
          finish.appendChild(sub);
          finish.appendChild(btn);
          wizard.appendChild(finish);

          for (const child of finish.children) {
            child.style.opacity = 0;
          }
          await animate(
            "#zen-welcome-finish > *",
            { opacity: [0, 1], y: [12, 0] },
            {
              delay: getMotion().stagger(0.12),
              type: "spring",
              bounce: 0.2,
            }
          );
        },
        fadeOut() {},
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
    // Emoji is fine as a text node; FTL may keep 🇮🇳 — only innerHTML parsing
    // was broken in the packaged runtime probe.
    const line2Text = line2.replace(/\s*🇮🇳\s*$/u, "").trim();
    titleElement.replaceChildren();
    titleElement.appendChild(document.createTextNode(line1));
    titleElement.appendChild(document.createElement("br"));
    const line2Span = document.createElement("span");
    line2Span.textContent = line2Text;
    titleElement.appendChild(line2Span);
    titleElement.appendChild(document.createTextNode(" 🇮🇳"));

    await animate(
      "#zen-welcome-start-title, #zen-welcome-start-subtitle",
      { opacity: [0, 1], y: [20, 0], filter: ["blur(2px)", "blur(0px)"] },
      {
        delay: getMotion().stagger(0.3, { startDelay: 0.2 }),
        type: "spring",
        stiffness: 300,
        damping: 20,
        mass: 1.8,
      }
    );

    const button = document.getElementById("zen-welcome-start-button");
    let starting = false;
    button.addEventListener("click", async () => {
      // Single-flight: ignore repeats while the exit animation / page boot runs.
      if (starting || button.disabled) {
        return;
      }
      starting = true;
      button.disabled = true;
      try {
        await animate(
          "#zen-welcome-start-title, #zen-welcome-start-subtitle, #zen-welcome-start-button",
          { opacity: [1, 0], y: [0, -10], filter: ["blur(0px)", "blur(2px)"] },
          {
            type: "spring",
            ease: [0.755, 0.05, 0.855, 0.06],
            bounce: 0.4,
            delay: getMotion().stagger(0.2),
          }
        );
        new nsZenWelcomePages(getWelcomePages());
      } catch (e) {
        starting = false;
        button.disabled = false;
        throw e;
      }
    });
    await animate(
      button,
      { opacity: [0, 1], y: [20, 0], filter: ["blur(2px)", "blur(0px)"] },
      {
        delay: 0.1,
        type: "spring",
        stiffness: 300,
        damping: 20,
        mass: 1.8,
      }
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
      console.error("[Astra] Failed to restore browser after welcome failure:", e);
    }
  }

  function startZenWelcome() {
    try {
      clearBrowserElements();
      centerWindowOnScreen();
      initializeZenWelcome();
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
