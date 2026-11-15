/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const DEV_PREF = "zen.developer-mode.enabled";
const MODE_ATTRIBUTE = "zen-developer-mode";
let localURL;

add_setup(async function () {
  await gZenStartup.promiseInitialized;
  const { HttpServer } = ChromeUtils.importESModule(
    "resource://testing-common/httpd.sys.mjs",
  );
  const server = new HttpServer();
  server.registerPathHandler("/developer", (request, response) => {
    response.setHeader("Content-Type", "text/html", false);
    response.write(
      "<!doctype html><title>Developer Mode test</title><p>Local page</p>",
    );
  });
  server.start(-1);
  localURL = `http://localhost:${server.identity.primaryPort}/developer?query=kept#fragment`;
  registerCleanupFunction(() => new Promise((resolve) => server.stop(resolve)));
});

add_task(function test_local_host_boundaries() {
  const { isLocalDevelopmentURI } = ChromeUtils.importESModule(
    "resource:///modules/zen/ui/ZenDeveloperMode.sys.mjs",
  );
  for (const [spec, expected] of [
    ["http://localhost:3000/path?x=1#fragment", true],
    ["https://app.localhost/", true],
    ["http://LOCALHOST./", true],
    ["http://127.0.0.1/", true],
    ["http://[::1]:3000/", true],
    ["http://localhost.example.com/", false],
    ["http://127.0.0.1.example.com/", false],
    ["http://192.168.1.1/", false],
    ["https://example.com/?host=localhost", false],
    ["file:///localhost/index.html", false],
    ["about:blank", false],
  ]) {
    Assert.equal(
      isLocalDevelopmentURI(Services.io.newURI(spec)),
      expected,
      spec,
    );
  }
});

function toolbarFor(browser) {
  return browser
    .closest(".browserContainer")
    ?.querySelector(".zen-developer-toolbar");
}

async function waitForToolbar(browser) {
  await TestUtils.waitForCondition(() => toolbarFor(browser));
  return toolbarFor(browser);
}

add_task(async function test_stable_sidebar_and_selected_border() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [DEV_PREF, false],
      ["zen.view.use-single-toolbar", true],
      ["zen.view.sidebar-expanded", true],
    ],
  });
  await TestUtils.waitForCondition(
    () => gZenVerticalTabsManager._hasSetSingleToolbar,
  );
  await BrowserTestUtils.withNewTab(localURL, async (browser) => {
    const tab = gBrowser.getTabForBrowser(browser);
    const urlbarParent = gURLBar.parentNode;
    const navbarParent = document.getElementById("nav-bar").parentNode;
    const bounds = gURLBar.getBoundingClientRect();
    Assert.ok(!toolbarFor(browser), "Disabled feature adds no page toolbar");
    await SpecialPowers.pushPrefEnv({ set: [[DEV_PREF, true]] });
    const toolbar = await waitForToolbar(browser);
    const subtitle = tab.querySelector(".zen-developer-tab-sublabel");
    Assert.greater(
      subtitle.getBoundingClientRect().height,
      0,
      "Hostname subtitle is visibly rendered",
    );
    Assert.lessOrEqual(
      subtitle.getBoundingClientRect().bottom,
      tab.querySelector(".tab-background").getBoundingClientRect().bottom - 2,
      "Hostname subtitle fits inside the tab's caution border",
    );
    Assert.equal(
      getComputedStyle(tab.querySelector(".tab-background")).outlineStyle,
      "dashed",
      "Selected development tab has a caution border",
    );

    Assert.equal(
      gURLBar.value,
      Services.io.newURI(localURL).displayHostPort,
      "Unfocused native sidebar field shows only hostname and port",
    );
    Assert.equal(
      gURLBar.untrimmedValue,
      localURL,
      "Native URLbar retains the complete URL for editing",
    );

    Assert.ok(
      BrowserTestUtils.isVisible(toolbar),
      "Local page has its own toolbar",
    );
    Assert.ok(
      gZenVerticalTabsManager._hasSetSingleToolbar,
      "Native sidebar layout stays enabled",
    );
    Assert.equal(
      gURLBar.parentNode,
      urlbarParent,
      "Native URLbar stays in its original parent",
    );
    Assert.equal(
      document.getElementById("nav-bar").parentNode,
      navbarParent,
      "Navigation controls stay in place",
    );
    const after = gURLBar.getBoundingClientRect();
    Assert.lessOrEqual(
      Math.abs(after.x - bounds.x),
      0.5,
      "URLbar does not move horizontally",
    );
    Assert.lessOrEqual(
      Math.abs(after.y - bounds.y),
      0.5,
      "URLbar does not move vertically",
    );
    Assert.equal(
      document.querySelectorAll("#urlbar").length,
      1,
      "One native Firefox URLbar remains",
    );
    Assert.equal(
      toolbar.querySelector("input").value,
      localURL,
      "Page field shows full URL",
    );

    await BrowserTestUtils.withNewTab("about:robots", async () => {
      Assert.ok(
        tab.hasAttribute(MODE_ATTRIBUTE),
        "Inactive local tab keeps its development marker",
      );
      const style = getComputedStyle(tab.querySelector(".tab-background"));
      Assert.notEqual(
        style.outlineStyle,
        "dashed",
        "Inactive local tab has no caution outline",
      );
      Assert.equal(
        tab.querySelector(".zen-developer-tab-sublabel").value,
        Services.io.newURI(localURL).displayHostPort,
        "Inactive development tab retains hostname subtitle",
      );
      Assert.ok(
        !toolbarFor(gBrowser.selectedBrowser),
        "Ordinary page has no development toolbar",
      );
      Assert.equal(
        gURLBar.parentNode,
        urlbarParent,
        "Switching tabs never reparents the URLbar",
      );
      Assert.equal(
        document.getElementById("nav-bar").parentNode,
        navbarParent,
        "Switching tabs never reparents navigation controls",
      );
      Assert.ok(
        gZenVerticalTabsManager._hasSetSingleToolbar,
        "Ordinary tab uses the same native layout",
      );
    });
    await SpecialPowers.popPrefEnv();
    await TestUtils.waitForCondition(() => !toolbarFor(browser));
    Assert.ok(
      !tab.hasAttribute(MODE_ATTRIBUTE),
      "Disabling clears inactive and active markers",
    );
    Assert.ok(
      Services.prefs.getBoolPref("zen.view.use-single-toolbar"),
      "Saved layout preference is unchanged",
    );
  });
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_background_navigation_updates_development_state() {
  await SpecialPowers.pushPrefEnv({ set: [[DEV_PREF, true]] });
  await BrowserTestUtils.withNewTab("about:robots", async (foreground) => {
    const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
    try {
      let loaded = BrowserTestUtils.browserLoaded(
        tab.linkedBrowser,
        false,
        localURL,
      );
      BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, localURL);
      await loaded;
      await TestUtils.waitForCondition(() => tab.hasAttribute(MODE_ATTRIBUTE));
      Assert.equal(
        gBrowser.selectedBrowser,
        foreground,
        "Loading a background local page does not select it",
      );
      loaded = BrowserTestUtils.browserLoaded(
        tab.linkedBrowser,
        false,
        "about:robots",
      );
      BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, "about:robots");
      await loaded;
      await TestUtils.waitForCondition(() => !tab.hasAttribute(MODE_ATTRIBUTE));
      Assert.ok(
        !toolbarFor(tab.linkedBrowser),
        "Navigating background tab away removes its toolbar",
      );
    } finally {
      BrowserTestUtils.removeTab(tab);
    }
  });
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_address_editing_and_icon_hit_areas() {
  await SpecialPowers.pushPrefEnv({ set: [[DEV_PREF, true]] });
  await BrowserTestUtils.withNewTab(localURL, async (browser) => {
    const toolbar = await waitForToolbar(browser);
    await document.l10n.translateFragment(toolbar);
    const stripBounds = toolbar.getBoundingClientRect();
    const pageBounds = browser.getBoundingClientRect();
    Assert.lessOrEqual(
      Math.abs(
        pageBounds.bottom -
          browser.parentElement.getBoundingClientRect().bottom,
      ),
      0.5,
      "Page fills remaining pane height without overflowing",
    );

    Assert.lessOrEqual(
      Math.abs(stripBounds.left - pageBounds.left),
      0.5,
      "Toolbar and page share the same left edge",
    );
    Assert.lessOrEqual(
      Math.abs(stripBounds.width - pageBounds.width),
      0.5,
      "Toolbar spans the full page width",
    );
    Assert.lessOrEqual(
      stripBounds.bottom,
      pageBounds.top + 0.5,
      "Toolbar sits above the page instead of beside it",
    );

    for (const button of toolbar.querySelectorAll("button")) {
      const image = button.querySelector("img");
      await TestUtils.waitForCondition(
        () => image.complete && image.naturalWidth > 0,
        "Native icon loads",
      );
      Assert.equal(
        button.textContent.trim(),
        "",
        "Tool button contains no visible text or hidden label box",
      );
      Assert.ok(
        button.title && button.getAttribute("aria-label"),
        "Icon button has tooltip and accessible label",
      );
      Assert.equal(
        button.getBoundingClientRect().width,
        28,
        "Button has a compact, predictable hit area",
      );
    }
    const input = toolbar.querySelector("input");
    const edited = localURL.replace("query=kept", "edited=kept");
    const loaded = BrowserTestUtils.browserLoaded(browser, false, edited);
    input.focus();
    input.value = edited;
    EventUtils.synthesizeKey("KEY_Enter");
    await loaded;
    await TestUtils.waitForCondition(() => input.value === edited);
    Assert.equal(
      browser.currentURI.spec,
      edited,
      "Editing full URL navigates its own page",
    );
    input.focus();
    input.value = "http://localhost:1/cancelled";
    EventUtils.synthesizeKey("KEY_Escape");
    Assert.equal(
      input.value,
      edited,
      "Escape restores committed URL without navigating",
    );
  });
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_all_tool_buttons_repeat_close() {
  await SpecialPowers.pushPrefEnv({ set: [[DEV_PREF, true]] });
  await BrowserTestUtils.withNewTab(localURL, async (browser) => {
    const toolbar = await waitForToolbar(browser);
    const { require } = ChromeUtils.importESModule(
      "resource://devtools/shared/loader/Loader.sys.mjs",
    );
    const { gDevTools } = require("devtools/client/framework/devtools");
    const tab = gBrowser.selectedTab;
    const clickTool = (id) =>
      toolbar.querySelector(`[data-tool="${id}"]`).click();
    const ready = async (id) => {
      await TestUtils.waitForCondition(() => {
        const toolbox = gDevTools.getToolboxForTab(tab);
        return (
          toolbox?.isReady &&
          toolbox.currentToolId === id &&
          toolbox.getPanel(id)
        );
      }, `Native ${id} panel is ready`);
      return gDevTools.getToolboxForTab(tab);
    };
    try {
      for (const toolId of ["webconsole", "netmonitor", "inspector"]) {
        clickTool(toolId);
        const toolbox = await ready(toolId);
        const destroyed = toolbox.once("destroyed");
        clickTool(toolId);
        await destroyed;
        Assert.ok(
          !gDevTools.getToolboxForTab(tab),
          `Second ${toolId} click closes the complete toolbox`,
        );
      }
      clickTool("webconsole");
      const toolbox = await ready("webconsole");
      clickTool("netmonitor");
      Assert.equal(
        await ready("netmonitor"),
        toolbox,
        "Different tool selects its panel in the existing toolbox",
      );
    } finally {
      await gDevTools.getToolboxForTab(tab)?.destroy();
    }
  });
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_split_controls_target_their_own_page() {
  await SpecialPowers.pushPrefEnv({ set: [[DEV_PREF, true]] });
  await BrowserTestUtils.withNewTab(localURL, async (firstBrowser) => {
    const firstTab = gBrowser.getTabForBrowser(firstBrowser);
    const secondURL = localURL.replace("query=kept", "pane=second");
    const secondTab = BrowserTestUtils.addTab(gBrowser, secondURL);
    const { require } = ChromeUtils.importESModule(
      "resource://devtools/shared/loader/Loader.sys.mjs",
    );
    const { gDevTools } = require("devtools/client/framework/devtools");
    try {
      await BrowserTestUtils.browserLoaded(secondTab.linkedBrowser);
      const activated = BrowserTestUtils.waitForEvent(
        window,
        "ZenViewSplitter:SplitViewActivated",
      );
      gZenViewSplitter.splitTabs([firstTab, secondTab], "grid");
      await activated;
      const firstBar = await waitForToolbar(firstBrowser);
      const secondBar = await waitForToolbar(secondTab.linkedBrowser);
      Assert.ok(
        firstBar !== secondBar,
        "Each local split pane owns its toolbar",
      );
      gBrowser.selectedTab = firstTab;
      secondBar.querySelector('[data-tool="webconsole"]').click();
      await TestUtils.waitForCondition(() => {
        const toolbox = gDevTools.getToolboxForTab(secondTab);
        return toolbox?.isReady && toolbox.getPanel("webconsole");
      });
      Assert.equal(
        gBrowser.selectedTab,
        secondTab,
        "Tool action selects its owning pane",
      );
      Assert.ok(
        !gDevTools.getToolboxForTab(firstTab),
        "Other pane's toolbox stays closed",
      );
      await gDevTools.getToolboxForTab(secondTab).destroy();

      gBrowser.selectedTab = firstTab;
      await SimpleTest.promiseClipboardChange(secondURL, () => {
        secondBar.querySelector('[data-action="copy"]').click();
      });
      const toastLabel = await TestUtils.waitForCondition(() =>
        document.querySelector(
          '#zen-toast-container [data-l10n-id="zen-copy-current-url-confirmation"]',
        ),
      );
      if (Services.zen.canShare()) {
        Assert.ok(
          toastLabel
            .closest(".zen-toast")
            .querySelector("#zen-copy-current-url-button"),
          "Copy confirmation includes the native Share button when available",
        );
      }

      gBrowser.selectedTab = firstTab;
      const screenshot = secondBar.querySelector('[data-action="screenshot"]');
      const { ScreenshotsUtils, UIPhases } = ChromeUtils.importESModule(
        "moz-src:///browser/components/screenshots/ScreenshotsUtils.sys.mjs",
      );
      screenshot.click();
      const secondBrowser = secondTab.linkedBrowser;
      await TestUtils.waitForCondition(
        () => ScreenshotsUtils.getUIPhase(secondBrowser) === UIPhases.INITIAL,
        "Native screenshot panel opens in the owning pane",
      );
      Assert.equal(
        ScreenshotsUtils.getUIPhase(firstBrowser),
        UIPhases.CLOSED,
        "The other pane's screenshot panel stays closed",
      );
      await SimpleTest.promiseFocus(window);
      EventUtils.synthesizeKey("KEY_Escape");
      await TestUtils.waitForCondition(
        () => ScreenshotsUtils.getUIPhase(secondBrowser) === UIPhases.CLOSED,
        "Escape closes the native screenshot panel",
      );

      await SpecialPowers.pushPrefEnv({
        set: [["screenshots.browser.component.enabled", false]],
      });
      const screenshotDivider = screenshot.nextElementSibling;
      await TestUtils.waitForCondition(
        () => [screenshot, screenshotDivider].every(BrowserTestUtils.isHidden),
        "The camera and its trailing divider hide when Screenshots is disabled",
      );
      await SpecialPowers.popPrefEnv();
      await TestUtils.waitForCondition(
        () => [screenshot, screenshotDivider].every(BrowserTestUtils.isVisible),
        "The camera and its trailing divider return when Screenshots is enabled",
      );

      gBrowser.selectedTab = firstTab;
      const input = secondBar.querySelector("input");
      input.focus();
      Assert.equal(
        gBrowser.selectedTab,
        secondTab,
        "Keyboard focus selects the address field's pane",
      );
      Assert.equal(
        document.activeElement,
        input,
        "Pane activation preserves URL field keyboard focus",
      );
      const edited = secondURL.replace("pane=second", "pane=edited");
      input.value = edited;
      let loaded = BrowserTestUtils.browserLoaded(
        secondTab.linkedBrowser,
        false,
        edited,
      );
      EventUtils.synthesizeKey("KEY_Enter");
      await loaded;
      Assert.equal(
        firstBrowser.currentURI.spec,
        localURL,
        "Editing second pane leaves first pane's URL unchanged",
      );
      Assert.equal(
        secondTab.linkedBrowser.currentURI.spec,
        edited,
        "Second pane navigates to its edited URL",
      );
      loaded = BrowserTestUtils.browserLoaded(
        secondTab.linkedBrowser,
        false,
        "about:robots",
      );
      BrowserTestUtils.startLoadingURIString(
        secondTab.linkedBrowser,
        "about:robots",
      );
      await loaded;
      await TestUtils.waitForCondition(
        () => !toolbarFor(secondTab.linkedBrowser),
      );
      Assert.ok(
        firstBar.isConnected && firstTab.hasAttribute(MODE_ATTRIBUTE),
        "Mixed split retains development toolbar and marker on local pane only",
      );
    } finally {
      await gDevTools.getToolboxForTab(secondTab)?.destroy();
      await BrowserTestUtils.removeTab(secondTab);
    }
  });
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_all_look_and_feel_layouts_use_one_url_row() {
  await SpecialPowers.pushPrefEnv({ set: [[DEV_PREF, true]] });
  await BrowserTestUtils.withNewTab(localURL, async (browser) => {
    const tab = gBrowser.getTabForBrowser(browser);
    const root = document.documentElement;
    const nativeURLbar = gURLBar;
    const ordinarySublabel = tab.querySelector(".zen-tab-sublabel");
    ordinarySublabel.value = "Status owned by another feature";
    const originalL10n = ordinarySublabel.getAttribute("data-l10n-args");
    for (const [name, single, expanded] of [
      ["Only Sidebar", true, true],
      ["Sidebar and Top Toolbar", false, true],
      ["Collapsed Sidebar", false, false],
      ["Only Sidebar again", true, true],
    ]) {
      await SpecialPowers.pushPrefEnv({
        set: [
          ["zen.view.use-single-toolbar", single],
          ["zen.view.sidebar-expanded", expanded],
        ],
      });
      await TestUtils.waitForCondition(
        () =>
          gZenVerticalTabsManager._hasSetSingleToolbar === single &&
          root.hasAttribute("zen-developer-top-toolbar") === !single,
      );
      const paneToolbar = await waitForToolbar(browser);
      const nativeTools = document.getElementById("zen-developer-nav-tools");
      Assert.equal(
        gURLBar,
        nativeURLbar,
        name + " retains the original native URLbar",
      );
      Assert.equal(
        BrowserTestUtils.isVisible(paneToolbar),
        single,
        name + " shows pane strip only when the URLbar is in the sidebar",
      );
      Assert.equal(
        Boolean(nativeTools && BrowserTestUtils.isVisible(nativeTools)),
        !single,
        name + " uses the existing top row for developer actions",
      );
      Assert.equal(
        gURLBar.value,
        single ? Services.io.newURI(localURL).displayHostPort : localURL,
        name + " formats the native address appropriately",
      );
      Assert.equal(
        tab.querySelector(".zen-developer-tab-sublabel").value,
        Services.io.newURI(localURL).displayHostPort,
        name + " retains hostname subtitle",
      );
      Assert.equal(
        ordinarySublabel.value,
        "Status owned by another feature",
        name + " preserves another feature's subtitle value",
      );
      Assert.equal(
        ordinarySublabel.getAttribute("data-l10n-args"),
        originalL10n,
        name + " preserves native subtitle localization ownership",
      );
      const nav = document.getElementById("nav-bar");
      const stripedBar = single ? paneToolbar : nav;
      Assert.ok(
        getComputedStyle(stripedBar).backgroundImage.startsWith(
          "repeating-linear-gradient(",
        ),
        name + " renders the developer toolbar stripes",
      );
      const [beforeCamera, afterCamera] = (
        single ? paneToolbar : nativeTools
      ).querySelectorAll(".zen-developer-action-divider");
      Assert.ok(
        beforeCamera?.getBoundingClientRect().width === 1 &&
          afterCamera?.getBoundingClientRect().width === 1 &&
          beforeCamera.previousElementSibling?.dataset.action === "copy" &&
          beforeCamera.nextElementSibling?.dataset.action === "screenshot" &&
          beforeCamera.nextElementSibling ===
            afterCamera.previousElementSibling &&
          afterCamera.nextElementSibling?.dataset.tool === "webconsole",
        name + " separates the camera from both Copy URL and Console",
      );
      const navParent = nav.parentNode;
      const localGap =
        browser.getBoundingClientRect().top -
        nav.getBoundingClientRect().bottom;
      await BrowserTestUtils.withNewTab(
        "about:robots",
        async (ordinaryBrowser) => {
          Assert.equal(
            nav.parentNode,
            navParent,
            name + " never moves navigation controls on tab selection",
          );
          Assert.ok(
            !root.hasAttribute("zen-developer-top-toolbar-active"),
            name + " restores normal top-row presentation on ordinary tabs",
          );
          Assert.ok(
            !nativeTools || !BrowserTestUtils.isVisible(nativeTools),
            name + " hides developer actions on ordinary tabs",
          );
          if (!single) {
            const ordinaryGap =
              ordinaryBrowser.getBoundingClientRect().top -
              nav.getBoundingClientRect().bottom;
            Assert.lessOrEqual(
              Math.abs(localGap - ordinaryGap),
              0.5,
              name + " has no extra address row above the development page",
            );
          }
        },
      );
      await TestUtils.waitForCondition(
        () => single || root.hasAttribute("zen-developer-top-toolbar-active"),
      );
      if (!single) {
        const { require } = ChromeUtils.importESModule(
          "resource://devtools/shared/loader/Loader.sys.mjs",
        );
        const { gDevTools } = require("devtools/client/framework/devtools");
        const button = nativeTools.querySelector('[data-tool="webconsole"]');
        button.click();
        await TestUtils.waitForCondition(() => {
          const toolbox = gDevTools.getToolboxForTab(tab);
          return toolbox?.isReady && toolbox.getPanel("webconsole");
        });
        const toolbox = gDevTools.getToolboxForTab(tab);
        const destroyed = toolbox.once("destroyed");
        button.click();
        await destroyed;
        Assert.ok(
          !gDevTools.getToolboxForTab(tab),
          name + " top-row Console repeat closes DevTools",
        );
      }
      await SpecialPowers.popPrefEnv();
    }
    await SpecialPowers.pushPrefEnv({ set: [[DEV_PREF, false]] });
    Assert.ok(
      !tab.querySelector(".zen-developer-tab-sublabel"),
      "Disabling removes only the development subtitle",
    );
    Assert.equal(
      ordinarySublabel.value,
      "Status owned by another feature",
      "Disabling preserves the original subtitle owner",
    );
    await SpecialPowers.popPrefEnv();
  });
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_native_top_toolbar_tracks_mixed_split_selection() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [DEV_PREF, true],
      ["zen.view.use-single-toolbar", false],
      ["zen.view.sidebar-expanded", true],
    ],
  });
  await BrowserTestUtils.withNewTab(localURL, async (browser) => {
    const localTab = gBrowser.getTabForBrowser(browser);
    const ordinaryTab = BrowserTestUtils.addTab(gBrowser, "about:robots");
    const { require } = ChromeUtils.importESModule(
      "resource://devtools/shared/loader/Loader.sys.mjs",
    );
    const { gDevTools } = require("devtools/client/framework/devtools");
    const originalWidth = window.outerWidth;
    const height = window.outerHeight;
    try {
      await BrowserTestUtils.browserLoaded(ordinaryTab.linkedBrowser);
      const activated = BrowserTestUtils.waitForEvent(
        window,
        "ZenViewSplitter:SplitViewActivated",
      );
      gZenViewSplitter.splitTabs([localTab, ordinaryTab], "grid");
      await activated;
      const root = document.documentElement;
      gBrowser.selectedTab = ordinaryTab;
      await TestUtils.waitForCondition(
        () => !root.hasAttribute("zen-developer-top-toolbar-active"),
      );
      Assert.ok(
        !BrowserTestUtils.isVisible(toolbarFor(browser)),
        "Mixed top-toolbar split has no extra local-pane row",
      );
      gBrowser.selectedTab = localTab;
      await TestUtils.waitForCondition(() =>
        root.hasAttribute("zen-developer-top-toolbar-active"),
      );
      Assert.equal(
        gURLBar.value,
        localURL,
        "Shared native top row follows the selected local pane",
      );
      const tools = document.getElementById("zen-developer-nav-tools");
      const button = tools.querySelector('[data-tool="netmonitor"]');
      button.click();
      await TestUtils.waitForCondition(() => {
        const toolbox = gDevTools.getToolboxForTab(localTab);
        return (
          toolbox?.isReady &&
          toolbox.currentToolId === "netmonitor" &&
          toolbox.getPanel("netmonitor")
        );
      });
      Assert.ok(
        !gDevTools.getToolboxForTab(ordinaryTab),
        "Top-row action never opens tools on the other pane",
      );
      const toolbox = gDevTools.getToolboxForTab(localTab);
      const destroyed = toolbox.once("destroyed");
      button.click();
      await destroyed;
      Assert.ok(
        !gDevTools.getToolboxForTab(localTab),
        "Mixed-split top-row repeat closes its own toolbox",
      );
      const target = document.getElementById("nav-bar-customization-target");
      const overflowButton = document.getElementById("nav-bar-overflow-button");
      const compact = () =>
        root.hasAttribute("zen-developer-top-toolbar-compact");
      window.resizeTo(660, height);
      await TestUtils.waitForCondition(
        compact,
        "Narrowing the top row puts its actions in the app menu",
      );
      Assert.ok(
        !BrowserTestUtils.isVisible(tools),
        "The compact top bar hides the inline actions",
      );
      Assert.equal(
        tools.parentNode,
        target,
        "Firefox's customizable overflow keeps the non-customizable group in place",
      );

      const appMenu = PanelUI.panel;
      const shown = BrowserTestUtils.waitForPopupEvent(appMenu, "shown");
      PanelUI.show();
      await shown;
      const menuTools = document.getElementById("zen-developer-menu-tools");
      const copy = menuTools.querySelector('[data-action="copy"]');
      await TestUtils.waitForCondition(() => copy.getAttribute("label"));
      Assert.ok(
        BrowserTestUtils.isVisible(menuTools),
        "The app menu shows labeled developer actions",
      );
      const hidden = BrowserTestUtils.waitForPopupEvent(appMenu, "hidden");
      await SimpleTest.promiseClipboardChange(localURL, () => copy.doCommand());
      await hidden;

      const navBar = document.getElementById("nav-bar");
      const stopReload = document.getElementById("stop-reload-button");
      const appMenuButton = document.getElementById("PanelUI-button");
      const narrowWidth = navBar.clientWidth;
      const checkNavigation = (pane) => {
        const navBounds = navBar.getBoundingClientRect();
        const urlBounds = gURLBar.getBoundingClientRect();
        const menuBounds = appMenuButton.getBoundingClientRect();
        Assert.equal(
          stopReload.parentNode,
          target,
          pane + " keeps Reload in the navigation row",
        );
        Assert.ok(
          BrowserTestUtils.isVisible(stopReload),
          pane + " keeps Reload visible",
        );
        Assert.lessOrEqual(
          urlBounds.right,
          menuBounds.left + 1,
          pane + " keeps the address field clear of the app menu",
        );
        Assert.lessOrEqual(
          menuBounds.right,
          navBounds.right + 1,
          pane + " keeps the app menu inside the toolbar",
        );
      };
      window.resizeTo(520, height);
      await TestUtils.waitForCondition(
        () => navBar.clientWidth < narrowWidth,
        "The shared toolbar becomes narrower than the first compact layout",
      );
      checkNavigation("The narrow developer pane");

      gBrowser.selectedTab = ordinaryTab;
      await TestUtils.waitForCondition(() => !compact() && menuTools.hidden);
      checkNavigation("The narrow ordinary pane");
      Assert.ok(
        !BrowserTestUtils.isVisible(overflowButton),
        "The ordinary pane has no empty overflow button",
      );
      await SpecialPowers.pushPrefEnv({ set: [[DEV_PREF, false]] });
      try {
        checkNavigation("The top toolbar with Developer Mode disabled");
        Assert.ok(
          !BrowserTestUtils.isVisible(overflowButton),
          "The chevron stays hidden when there are no overflowed widgets",
        );
      } finally {
        await SpecialPowers.popPrefEnv();
      }
      gBrowser.selectedTab = localTab;
      await TestUtils.waitForCondition(compact);
      Assert.ok(
        !menuTools.hidden,
        "Selecting the local pane restores its app menu actions",
      );

      window.resizeTo(originalWidth, height);
      await TestUtils.waitForCondition(
        () => !compact() && BrowserTestUtils.isVisible(tools),
      );
      Assert.ok(
        menuTools.hidden,
        "Growing the window restores the inline actions",
      );
    } finally {
      window.resizeTo(originalWidth, height);
      PanelUI.hide();
      await gDevTools.getToolboxForTab(localTab)?.destroy();
      await BrowserTestUtils.removeTab(ordinaryTab);
    }
  });
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_site_controls_toggle_and_restore_defaults() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [DEV_PREF, true],
      ["zen.view.use-single-toolbar", true],
    ],
  });
  const panel = gZenSiteDataPanel.unifiedPanel;
  const button = document.getElementById("zen-site-data-developer-mode");
  const { readDeveloperMode, setDeveloperMode } = ChromeUtils.importESModule(
    "resource:///modules/zen/ui/ZenDeveloperMode.sys.mjs",
  );

  async function open() {
    const shown = BrowserTestUtils.waitForPopupEvent(panel, "shown");
    await gUnifiedExtensions.togglePanel(
      null,
      null,
      panel,
      gZenSiteDataPanel.unifiedPanelView,
      gZenSiteDataPanel.anchor,
    );
    await shown;
    await TestUtils.waitForCondition(() => !button.hidden && !button.disabled);
  }

  async function close() {
    if (panel.state !== "closed") {
      const hidden = BrowserTestUtils.waitForPopupEvent(panel, "hidden");
      panel.hidePopup(true);
      await hidden;
    }
  }

  async function toggle(browser, enabled) {
    EventUtils.synthesizeMouseAtCenter(button, {});
    await TestUtils.waitForCondition(
      () =>
        button.getAttribute("aria-checked") === String(enabled) &&
        !button.hasAttribute("aria-busy") &&
        Boolean(toolbarFor(browser)) === enabled,
      "The setting and the current tab reflect the new mode",
    );
  }

  await BrowserTestUtils.withNewTab(localURL, async (browser) => {
    const sameHostTab = BrowserTestUtils.addTab(
      gBrowser,
      localURL.replace("query=kept", "query=other-tab"),
    );
    const uri = browser.currentURI;
    const context = browser.loadContext;
    try {
      await waitForToolbar(sameHostTab.linkedBrowser);
      await open();
      Assert.equal(
        button.getAttribute("aria-checked"),
        "true",
        "Localhost defaults to On",
      );
      Assert.ok(
        button.previousElementSibling.classList.contains(
          "permission-popup-permission-item-site-protection",
        ),
        "The switch is directly below Tracking Protection",
      );
      await toggle(browser, false);
      await TestUtils.waitForCondition(
        () => !toolbarFor(sameHostTab.linkedBrowser),
      );
      const sameHostOtherPort = Services.io.newURI("http://localhost:3001/");
      Assert.ok(
        !(await readDeveloperMode(sameHostOtherPort, context)),
        "Turning localhost off also applies to a different port",
      );
      const privateContext = Cu.createPrivateLoadContext();
      Assert.ok(
        !(await readDeveloperMode(uri, privateContext)),
        "Private browsing starts with the profile's choice",
      );
      await setDeveloperMode(uri, privateContext, true);
      Assert.ok(
        await readDeveloperMode(uri, privateContext),
        "Private sessions can override it",
      );
      Assert.ok(
        !(await readDeveloperMode(uri, context)),
        "The private choice does not change the profile",
      );
      await setDeveloperMode(uri, privateContext, false);
      Assert.ok(
        !(await readDeveloperMode(uri, privateContext)),
        "Returning to the inherited value clears the private override",
      );
      await close();
      await open();
      Assert.equal(
        button.getAttribute("aria-checked"),
        "false",
        "The same control remains reachable after turning off the toolbar",
      );
      await toggle(browser, true);
      await waitForToolbar(sameHostTab.linkedBrowser);
      const contentPrefs = Cc["@mozilla.org/content-pref/service;1"].getService(
        Ci.nsIContentPrefService2,
      );
      const saved = await new Promise((resolve) => {
        let value;
        contentPrefs.getByDomainAndName(
          "localhost",
          "zen.developer-mode.site-override",
          context,
          {
            handleResult(pref) {
              value = pref.value;
            },
            handleCompletion() {
              resolve(value);
            },
          },
        );
      });
      Assert.equal(
        saved,
        undefined,
        "Toggling back to the default removes the saved exception",
      );
    } finally {
      await close();
      await setDeveloperMode(uri, context, true);
      await BrowserTestUtils.removeTab(sameHostTab);
    }
  });

  await BrowserTestUtils.withNewTab("https://example.com/", async (browser) => {
    const uri = browser.currentURI;
    try {
      await open();
      Assert.equal(
        button.getAttribute("aria-checked"),
        "false",
        "An ordinary host defaults to Off",
      );
      await toggle(browser, true);
      Assert.equal(
        gBrowser.selectedTab.querySelector(".zen-developer-tab-sublabel").value,
        "example.com",
        "An explicitly enabled host gets a hostname subtitle",
      );
      Assert.ok(
        !(await readDeveloperMode(
          Services.io.newURI("https://other.example.com/"),
          browser.loadContext,
        )),
        "Explicit activation does not apply to subdomains",
      );
      await toggle(browser, false);
    } finally {
      await close();
      await setDeveloperMode(uri, browser.loadContext, false);
    }
  });
  await SpecialPowers.popPrefEnv();
});
