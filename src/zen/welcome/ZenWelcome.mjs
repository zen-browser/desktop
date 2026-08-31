// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

{
  let lazy = {};

  ChromeUtils.defineESModuleGetters(lazy, {
    SearchService: "moz-src:///toolkit/components/search/SearchService.sys.mjs",
  });

  const kZenElementsToIgnore = [
    "zen-browser-background",
    "zen-toast-container",
  ];

  const kEssentialApps = [
    { url: "https://obsidian.md", icon: "obsidian", color: "#7c3aed" },
    { url: "https://discord.com", icon: "discord", color: "#5865f2" },
    { url: "https://trello.com", icon: "trello", color: "#0052cc" },
    { url: "https://slack.com", icon: "slack", color: "#e01e5a" },
    { url: "https://github.com", icon: "github", color: "#57606a" },
    { url: "https://app.tuta.com/", icon: "tuta", color: "#c00002" },
    { url: "https://notion.com", icon: "notion", color: "#37352f" },
    { url: "https://calendar.google.com", icon: "calendar", color: "#4285f4" },
    { url: "https://figma.com", icon: "figma", color: "#f24e1e" },
  ];

  const gChoices = {
    setDefaultBrowser: false,
    essentials: new Set(),
  };

  function clearBrowserElements() {
    for (const element of document.getElementById("browser").children) {
      if (kZenElementsToIgnore.includes(element.id)) {
        continue;
      }
      element.style.display = "none";
    }
  }

  function getMotion() {
    return gZenUIManager.motion;
  }

  function animate(...args) {
    return getMotion().animate(...args);
  }

  function parseXUL(xul) {
    return window.MozXULElement.parseXULToFragment(xul);
  }

  function initializeZenWelcome() {
    document.documentElement.setAttribute("zen-welcome-stage", "true");
    const XUL = `
      <html:video id="zen-welcome-video" autoplay="" loop="" muted=""
                    disablepictureinpicture="" tabindex="-1"
                    src="chrome://browser/content/zen-videos/welcome-background.mp4"></html:video>
      <html:div id="zen-welcome">
        <html:div id="zen-welcome-start">
          <html:h1 id="zen-welcome-title"></html:h1>
          <button class="footer-button primary" id="zen-welcome-start-button">
          </button>
        </html:div>
        <html:div id="zen-welcome-pages">
          <html:div id="zen-welcome-page-sidebar">
            <html:button id="zen-welcome-back" data-l10n-id="zen-welcome-back"></html:button>
            <html:div id="zen-welcome-page-sidebar-content"></html:div>
            <html:div id="zen-welcome-page-sidebar-buttons"></html:div>
          </html:div>
          <html:div id="zen-welcome-page-content"></html:div>
        </html:div>
      </html:div>
    `;
    document.getElementById("browser").appendChild(parseXUL(XUL));
    const video = document.getElementById("zen-welcome-video");
    video.play().catch(() => {});
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

  function createOption({ id, group, checked, l10n, text, extra }) {
    const label = document.createElement("label");
    label.className = "zen-welcome-option";
    label.setAttribute("for", id);
    const input = document.createElement("input");
    input.type = "radio";
    input.id = id;
    input.name = group;
    input.checked = !!checked;
    label.appendChild(input);
    const radio = document.createElement("span");
    radio.className = "zen-welcome-option-radio no-squircles";
    label.appendChild(radio);
    if (extra) {
      label.appendChild(extra);
    }
    const labelText = document.createElement("span");
    labelText.className = "zen-welcome-option-label";
    if (l10n) {
      document.l10n.setAttributes(labelText, l10n);
    } else {
      labelText.textContent = text;
    }
    label.appendChild(labelText);
    return label;
  }

  function removeVideoBackground() {
    const video = document.getElementById("zen-welcome-video");
    if (!video) {
      return;
    }
    animate(video, { opacity: 0 }, { duration: 0.6, ease: "easeOut" }).then(
      () => {
        video.pause();
        video.remove();
      }
    );
  }

  const kSpring = { type: "spring", bounce: 0.35, visualDuration: 0.35 };
  const kExit = { duration: 0.12, ease: "easeIn" };
  const kFade = { duration: 0.25, ease: "easeOut" };

  class nsZenWelcomePages {
    #index = -1;
    #pages;
    #content = null;
    #renderToken = 0;
    #buttonsToken = 0;

    constructor(pages) {
      this.#pages = pages;
      this.init();
      this.next();
    }

    get textContainer() {
      return document.getElementById("zen-welcome-page-sidebar-content");
    }

    get contentContainer() {
      return document.getElementById("zen-welcome-page-content");
    }

    get buttonsContainer() {
      return document.getElementById("zen-welcome-page-sidebar-buttons");
    }

    get backButton() {
      return document.getElementById("zen-welcome-back");
    }

    get currentPage() {
      return this.#pages[this.#index];
    }

    get content() {
      return this.#content;
    }

    init() {
      document.getElementById("zen-welcome-start").remove();
      const pages = document.getElementById("zen-welcome-pages");
      pages.style.display = "flex";
      animate(pages, { opacity: [0, 1] }, { ...kFade, duration: 0.2 });
      this.backButton.addEventListener("click", () => this.back());
    }

    next() {
      this.currentPage?.commit?.(this.#content);
      this.#show(this.#index + 1, 1);
    }

    back() {
      if (this.#index <= 0) {
        return;
      }
      this.#show(this.#index - 1, -1);
    }

    #show(index, direction) {
      const previous = this.currentPage;
      this.#index = index;
      const page = this.currentPage;
      if (!page) {
        this.finish();
        return;
      }
      previous?.leave?.();
      this.#exit(this.textContainer, { x: [0, -80 * direction] });
      this.#exit(this.contentContainer, {});
      this.backButton.toggleAttribute("disabled", index === 0);
      this.updateButtons();
      this.#renderText(page, direction);
      this.#renderContent(page);
    }

    #exit(container, keyframes) {
      for (const element of container.children) {
        if (element.hasAttribute("exiting")) {
          continue;
        }
        element.setAttribute("exiting", "");
        animate(element, { opacity: [1, 0], ...keyframes }, kExit).then(() =>
          element.remove()
        );
      }
    }

    async #renderText(page, direction) {
      const token = ++this.#renderToken;
      const text = document.createElement("div");
      text.className = "zen-welcome-text";
      const title = document.createElement("h1");
      document.l10n.setAttributes(title, page.title);
      text.appendChild(title);
      for (const id of page.descriptions ?? []) {
        const p = document.createElement("p");
        document.l10n.setAttributes(p, id);
        text.appendChild(p);
      }
      await document.l10n.translateFragment(text);
      if (token !== this.#renderToken) {
        return;
      }
      this.textContainer.appendChild(text);
      animate(
        [...text.children],
        { opacity: [0, 1], x: [120 * direction, 0] },
        {
          ...kSpring,
          bounce: 0.4,
          visualDuration: 0.3,
          delay: getMotion().stagger(0.03),
        }
      );
    }

    #renderContent(page) {
      const content = document.createElement("div");
      content.className = "zen-welcome-page";
      if (page.id) {
        content.setAttribute("page", page.id);
      }
      page.render(content);
      this.contentContainer.appendChild(content);
      this.#content = content;
      animate(content, { opacity: [0, 1] }, kFade);
    }

    async updateButtons() {
      const token = ++this.#buttonsToken;
      const fragment = document.createDocumentFragment();
      for (const button of this.currentPage.buttons) {
        const element = document.createElement("button");
        element.className = button.primary
          ? "zen-welcome-button primary"
          : "zen-welcome-button";
        document.l10n.setAttributes(element, button.l10n);
        element.addEventListener("click", () => {
          if (button.onclick?.(this) !== false) {
            this.next();
          }
        });
        fragment.appendChild(element);
      }
      await document.l10n.translateFragment(fragment);
      if (token === this.#buttonsToken) {
        this.buttonsContainer.replaceChildren(fragment);
      }
    }

    async finish() {
      ++this.#buttonsToken;
      this.buttonsContainer.replaceChildren();
      this.backButton.toggleAttribute("disabled", true);
      gZenWorkspaces.reorganizeTabsAfterWelcome();
      const promises = [this.#applyChoices()];
      await animate("#zen-welcome", { opacity: [1, 0] });
      this.contentContainer.remove();
      await Promise.all(promises);
      _iconToData = undefined; // Unload icon data
      document.getElementById("zen-welcome").remove();
      document.documentElement.removeAttribute("zen-welcome-stage");
      unlockWindowSize();
      for (const element of document.getElementById("browser").children) {
        if (kZenElementsToIgnore.includes(element.id)) {
          continue;
        }
        element.style.opacity = 0;
        element.style.removeProperty("display");
      }
      gZenUIManager.updateTabsToolbar();
      let elementsToIgnore = kZenElementsToIgnore
        .map(id => `#${id}`)
        .join(", ");
      await animate(`#browser > *:not(${elementsToIgnore})`, {
        opacity: [0, 1],
      });
    }

    async #applyChoices() {
      await this.#pinEssentials();
      let tabsToGroup = [];
      if (!gBrowser.selectedTab.hasAttribute("zen-empty-tab")) {
        tabsToGroup.push(gBrowser.selectedTab);
      }
      gZenFolders.createFolder(tabsToGroup, {
        renameFolder: false,
        label: "zen basics",
      });
    }

    async #pinEssentials() {
      const apps = kEssentialApps.filter(app =>
        gChoices.essentials.has(app.url)
      );
      if (!apps.length) {
        return;
      }
      await PlacesUtils.history.insertMany(
        apps.map(app => ({
          url: app.url,
          visits: [{ transition: PlacesUtils.history.TRANSITIONS.TYPED }],
        }))
      );
      const { TabStateCache } = ChromeUtils.importESModule(
        "resource:///modules/sessionstore/TabStateCache.sys.mjs"
      );
      for (const app of apps) {
        const tab = window.gBrowser.addTrustedTab(app.url, {
          inBackground: true,
          createLazyBrowser: true,
        });
        const icon = await getIconData(
          `chrome://browser/content/zen-images/favicons/${app.icon}.svg`
        );
        // Update the persistent tab state cache with |tabData| information.
        TabStateCache.update(tab.linkedBrowser.permanentKey, {
          history: { entries: [{ url: app.url }], index: 0 },
          image: icon,
        });
        gBrowser.setIcon(tab, icon);
        tab.removeAttribute("pending"); // Make it appear loaded
        gZenPinnedTabManager.addToEssentials(tab);
      }
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
          // Ignore engines that throw an exception when cloning.
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
      await lazy.SearchService.setDefault(
        engine.originalEngine,
        lazy.SearchService.CHANGE_REASON.USER
      );
    }
  }

  const kNextButton = { l10n: "zen-generic-next", primary: true };

  async function setDefaultBrowser() {
    const shellSvc =
      AppConstants.HAVE_SHELL_SERVICE && window.getShellService();
    if (!shellSvc) {
      return;
    }
    try {
      await shellSvc.setDefaultBrowser(false);
    } catch (ex) {
      console.error(ex);
    }
  }

  function getWelcomePages() {
    return [
      {
        id: "import",
        title: "zen-welcome-import-title",
        descriptions: ["zen-welcome-import-description"],
        buttons: [kNextButton],
        render(content) {
          const yes = createOption({
            id: "zen-welcome-import-yes",
            group: "zen-welcome-import",
            l10n: "zen-welcome-import-yes",
          });
          content.appendChild(yes);
          content.appendChild(
            createOption({
              id: "zen-welcome-import-no",
              group: "zen-welcome-import",
              l10n: "zen-welcome-import-no",
              checked: true,
            })
          );
        },
        commit(content) {
          if (content.querySelector("#zen-welcome-import-yes").checked) {
            MigrationUtils.showMigrationWizard(window, {
              isStartupMigration: true,
            });
          }
        },
      },
      {
        id: "colors",
        title: "zen-welcome-workspace-colors-title",
        descriptions: ["zen-welcome-workspace-colors-description"],
        buttons: [kNextButton],
        render(content) {
          removeVideoBackground();
          const anchor = document.createElement("div");
          anchor.id = "zen-welcome-workspace-colors-anchor";
          content.appendChild(anchor);
          const panel = gZenThemePicker.panel;
          panel.setAttribute("noautohide", "true");
          panel.setAttribute("consumeoutsideclicks", "false");
          panel.setAttribute("nonnative", "");
          panel.addEventListener(
            "popupshowing",
            () => {
              const panelRect = panel.getBoundingClientRect();
              // 20 is the shadow width * 2
              anchor.style.height =
                panelRect.height -
                (AppConstants.platform == "macosx" ? -72 : 20) +
                "px";
              anchor.style.width = panelRect.width - 20 + "px";
            },
            { once: true }
          );
          PanelMultiView.openPopup(panel, anchor, { position: "overlap" });
        },
        leave() {
          const panel = gZenThemePicker.panel;
          panel.removeAttribute("noautohide");
          panel.removeAttribute("consumeoutsideclicks");
          panel.removeAttribute("nonnative");
          animate(panel, { opacity: [1, 0] }, kExit).then(() => {
            panel.hidePopup();
            panel.removeAttribute("style");
          });
        },
      },
      {
        id: "search",
        title: "zen-welcome-default-search-title",
        descriptions: ["zen-welcome-default-search-description"],
        buttons: [kNextButton],
        async render(content) {
          const engineStore = new ZenSearchEngineStore();
          await engineStore.init();
          const defaultEngine = await lazy.SearchService.getDefault();
          for (const engine of engineStore.getEngines()) {
            const iconWrapper = document.createElement("div");
            iconWrapper.className = "engine-icon-wrapper";
            const iconBackdrop = document.createElement("img");
            iconBackdrop.className = "engine-icon-backdrop";
            const icon = document.createElement("img");
            icon.className = "engine-icon";
            icon.width = icon.height = 40;
            iconWrapper.append(iconBackdrop, icon);
            engine.originalEngine.getIconURL(96).then(url => {
              icon.src = url;
              iconBackdrop.src = url;
            });
            const option = createOption({
              id: "zen-welcome-engine-" + engine.name.replace(/\s+/g, "-"),
              group: "zen-welcome-search-engine",
              text: engine.name,
              checked: engine.name === defaultEngine.name,
              extra: iconWrapper,
            });
            option
              .querySelector("input")
              .addEventListener("change", () =>
                engineStore.setDefaultEngine(engine)
              );
            content.appendChild(option);
          }
        },
      },
      {
        id: "essentials",
        title: "zen-welcome-essentials-title",
        descriptions: ["zen-welcome-essentials-description"],
        buttons: [
          kNextButton,
          {
            l10n: "zen-welcome-skip",
            onclick(pages) {
              for (const button of pages.content.querySelectorAll(
                ".zen-welcome-essential[selected]"
              )) {
                button.removeAttribute("selected");
              }
            },
          },
        ],
        render(content) {
          content.appendChild(
            parseXUL(`
              <html:div class="zen-welcome-mock-browser">
                <html:div class="zen-welcome-mock-browser-sidebar">
                  <html:div class="zen-welcome-mock-browser-dots">
                    <html:div class="no-squircles"></html:div>
                    <html:div class="no-squircles"></html:div>
                    <html:div class="no-squircles"></html:div>
                  </html:div>
                  <html:div id="zen-welcome-essentials"></html:div>
                  <html:div class="zen-welcome-mock-tab"></html:div>
                  <html:div class="zen-welcome-mock-tab"></html:div>
                </html:div>
              </html:div>
            `)
          );
          const grid = content.querySelector("#zen-welcome-essentials");
          for (const app of kEssentialApps) {
            const button = document.createElement("button");
            button.className = "zen-welcome-essential";
            button.dataset.url = app.url;
            button.style.setProperty(
              "--zen-welcome-app-icon",
              `url("chrome://browser/content/zen-images/favicons/${app.icon}.svg")`
            );
            button.style.setProperty("--zen-welcome-app-color", app.color);
            button.toggleAttribute(
              "selected",
              gChoices.essentials.has(app.url)
            );
            button.addEventListener("click", () => {
              button.toggleAttribute("selected");
            });
            grid.appendChild(button);
          }
        },
        commit(content) {
          gChoices.essentials = new Set(
            [
              ...content.querySelectorAll(".zen-welcome-essential[selected]"),
            ].map(button => button.dataset.url)
          );
        },
      },
      {
        id: "default-browser",
        title: "zen-welcome-default-browser-title",
        descriptions: ["zen-welcome-default-browser-description"],
        buttons: [kNextButton],
        render(content) {
          content.appendChild(
            createOption({
              id: "zen-welcome-set-default-browser",
              group: "zen-welcome-default-browser",
              l10n: "zen-welcome-set-default-browser",
              checked: gChoices.setDefaultBrowser,
            })
          );
          content.appendChild(
            createOption({
              id: "zen-welcome-dont-set-default-browser",
              group: "zen-welcome-default-browser",
              l10n: "zen-welcome-dont-set-default-browser",
              checked: !gChoices.setDefaultBrowser,
            })
          );
        },
        commit(content) {
          gChoices.setDefaultBrowser = content.querySelector(
            "#zen-welcome-set-default-browser"
          ).checked;
          if (gChoices.setDefaultBrowser) {
            setDefaultBrowser();
          }
        },
      },
      {
        id: "finish",
        title: "zen-welcome-start-browsing-title",
        descriptions: ["zen-welcome-start-browsing-description-1"],
        buttons: [{ l10n: "zen-welcome-start-browsing", primary: true }],
        render() {},
      },
    ];
  }

  async function animateInitialStage() {
    const [title1, title2] = await document.l10n.formatValues([
      { id: "zen-welcome-title-line1" },
      { id: "zen-welcome-title-line2" },
    ]);
    const titleElement = document.getElementById("zen-welcome-title");
    for (const line of [title1, title2]) {
      const lineElement = document.createElement("span");
      for (const char of line) {
        if (char === " ") {
          lineElement.append(" ");
          continue;
        }
        const charElement = document.createElement("span");
        charElement.className = "zen-welcome-char";
        charElement.textContent = char;
        lineElement.appendChild(charElement);
      }
      titleElement.appendChild(lineElement);
    }
    const chars = titleElement.querySelectorAll(".zen-welcome-char");
    await animate(
      chars,
      { opacity: [0, 1], y: [50, 0] },
      {
        delay: getMotion().stagger(0.035, { startDelay: 0.2 }),
        type: "spring",
        bounce: 0.3,
        visualDuration: 0.45,
      }
    );
    const button = document.getElementById("zen-welcome-start-button");
    button.addEventListener(
      "click",
      async () => {
        await animate(
          "#zen-welcome-title .zen-welcome-char, #zen-welcome-start-button",
          { opacity: [1, 0], y: [0, -14] },
          { ...kSpring, delay: getMotion().stagger(0.012) }
        );
        new nsZenWelcomePages(getWelcomePages());
      },
      { once: true }
    );
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

  const kSizeLockProperties = [
    "min-width",
    "max-width",
    "min-height",
    "max-height",
  ];

  function lockWindowSize(width, height) {
    const style = document.documentElement.style;
    style.setProperty("min-width", `${width}px`, "important");
    style.setProperty("max-width", `${width}px`, "important");
    style.setProperty("min-height", `${height}px`, "important");
    style.setProperty("max-height", `${height}px`, "important");
  }

  function unlockWindowSize() {
    const style = document.documentElement.style;
    for (const property of kSizeLockProperties) {
      style.removeProperty(property);
    }
  }

  function centerWindowOnScreen() {
    window.addEventListener(
      "MozAfterPaint",
      function () {
        const width = Math.min(1200, screen.availWidth);
        const height = Math.min(720, screen.availHeight);
        window.resizeTo(width, height);
        window.focus();
        const appWin = window.docShell.treeOwner
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIAppWindow);
        appWin.rollupAllPopups();
        window.moveTo(
          screen.availLeft + (screen.availWidth - width) / 2,
          screen.availTop + (screen.availHeight - height) / 2
        );
        lockWindowSize(width, height);
      },
      { once: true }
    );
  }

  function startZenWelcome() {
    clearBrowserElements();
    centerWindowOnScreen();
    initializeZenWelcome();
    animateInitialStage();
  }

  startZenWelcome();
}
