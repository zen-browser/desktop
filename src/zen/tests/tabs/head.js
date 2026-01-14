/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { TabGroupTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/TabGroupTestUtils.sys.mjs"
);

function promiseTabLoadEvent(tab, url) {
  info("Wait tab event: load");

  function handle(loadedUrl) {
    if (loadedUrl === "about:blank" || (url && loadedUrl !== url)) {
      info(`Skipping spurious load event for ${loadedUrl}`);
      return false;
    }

    info("Tab event received: load");
    return true;
  }

  let loaded = BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, handle);

  if (url) {
    BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, url);
  }

  return loaded;
}

function updateTabContextMenu(tab) {
  let menu = document.getElementById("tabContextMenu");
  if (!tab) {
    tab = gBrowser.selectedTab;
  }
  var evt = new Event("");
  tab.dispatchEvent(evt);
  menu.openPopup(tab, "end_after", 0, 0, true, false, evt);
  is(window.TabContextMenu.contextTab, tab, "TabContextMenu context is the expected tab");
  menu.hidePopup();
}

function triggerClickOn(target, options) {
  let promise = BrowserTestUtils.waitForEvent(target, "click");
  if (AppConstants.platform == "macosx") {
    options = {
      metaKey: options.ctrlKey,
      shiftKey: options.shiftKey,
    };
  }
  EventUtils.synthesizeMouseAtCenter(target, options);
  return promise;
}

function triggerMiddleClickOn(target) {
  let promise = BrowserTestUtils.waitForEvent(target, "click");
  EventUtils.synthesizeMouseAtCenter(target, { button: 1 });
  return promise;
}

async function addTab(url = "http://mochi.test:8888/", params) {
  return addTabTo(gBrowser, url, params);
}

async function addTabTo(targetBrowser, url = "http://mochi.test:8888/", params = {}) {
  params.skipAnimation = true;
  const tab = BrowserTestUtils.addTab(targetBrowser, url, params);
  const browser = targetBrowser.getBrowserForTab(tab);
  await BrowserTestUtils.browserLoaded(browser);
  return tab;
}

async function addMediaTab() {
  const PAGE =
    "https://example.com/browser/browser/components/tabbrowser/test/browser/tabs/file_mediaPlayback.html";
  const tab = BrowserTestUtils.addTab(gBrowser, PAGE, { skipAnimation: true });
  const browser = gBrowser.getBrowserForTab(tab);
  await BrowserTestUtils.browserLoaded(browser);
  return tab;
}

function muted(tab) {
  return tab.linkedBrowser.audioMuted;
}

function activeMediaBlocked(tab) {
  return tab.activeMediaBlocked;
}

async function toggleMuteAudio(tab, expectMuted) {
  let mutedPromise = get_wait_for_mute_promise(tab, expectMuted);
  tab.toggleMuteAudio();
  await mutedPromise;
}

async function pressIcon(icon) {
  let tooltip = document.getElementById("tabbrowser-tab-tooltip");
  await hover_icon(icon, tooltip);
  EventUtils.synthesizeMouseAtCenter(icon, { button: 0 });
  leave_icon(icon);
}

async function wait_for_tab_playing_event(tab, expectPlaying) {
  if (tab.soundPlaying == expectPlaying) {
    ok(true, "The tab should " + (expectPlaying ? "" : "not ") + "be playing");
    return true;
  }
  return BrowserTestUtils.waitForEvent(tab, "TabAttrModified", false, (event) => {
    if (event.detail.changed.includes("soundplaying")) {
      is(
        tab.hasAttribute("soundplaying"),
        expectPlaying,
        "The tab should " + (expectPlaying ? "" : "not ") + "be playing"
      );
      is(
        tab.soundPlaying,
        expectPlaying,
        "The tab should " + (expectPlaying ? "" : "not ") + "be playing"
      );
      return true;
    }
    return false;
  });
}

async function wait_for_tab_media_blocked_event(tab, expectMediaBlocked) {
  if (tab.activeMediaBlocked == expectMediaBlocked) {
    ok(true, "The tab should " + (expectMediaBlocked ? "" : "not ") + "be activemedia-blocked");
    return true;
  }
  return BrowserTestUtils.waitForEvent(tab, "TabAttrModified", false, (event) => {
    if (event.detail.changed.includes("activemedia-blocked")) {
      is(
        tab.hasAttribute("activemedia-blocked"),
        expectMediaBlocked,
        "The tab should " + (expectMediaBlocked ? "" : "not ") + "be activemedia-blocked"
      );
      is(
        tab.activeMediaBlocked,
        expectMediaBlocked,
        "The tab should " + (expectMediaBlocked ? "" : "not ") + "be activemedia-blocked"
      );
      return true;
    }
    return false;
  });
}

async function is_audio_playing(tab) {
  let browser = tab.linkedBrowser;
  let isPlaying = await SpecialPowers.spawn(browser, [], async function () {
    let audio = content.document.querySelector("audio");
    return !audio.paused;
  });
  return isPlaying;
}

async function play(tab, expectPlaying = true) {
  let browser = tab.linkedBrowser;
  await SpecialPowers.spawn(browser, [], async function () {
    let audio = content.document.querySelector("audio");
    audio.play();
  });

  // If the tab has already been muted, it means the tab won't get soundplaying,
  // so we don't need to check this attribute.
  if (browser.audioMuted) {
    return;
  }

  if (expectPlaying) {
    await wait_for_tab_playing_event(tab, true);
  } else {
    await wait_for_tab_media_blocked_event(tab, true);
  }
}

function disable_non_test_mouse(disable) {
  let utils = window.windowUtils;
  utils.disableNonTestMouseEvents(disable);
}

function hover_icon(icon, tooltip) {
  disable_non_test_mouse(true);

  let popupShownPromise = BrowserTestUtils.waitForEvent(tooltip, "popupshown");
  EventUtils.synthesizeMouse(icon, 1, 1, { type: "mouseover" });
  EventUtils.synthesizeMouse(icon, 2, 2, { type: "mousemove" });
  EventUtils.synthesizeMouse(icon, 3, 3, { type: "mousemove" });
  EventUtils.synthesizeMouse(icon, 4, 4, { type: "mousemove" });
  return popupShownPromise;
}

function leave_icon(icon) {
  EventUtils.synthesizeMouse(icon, 0, 0, { type: "mouseout" });
  EventUtils.synthesizeMouseAtCenter(document.documentElement, {
    type: "mousemove",
  });
  EventUtils.synthesizeMouseAtCenter(document.documentElement, {
    type: "mousemove",
  });
  EventUtils.synthesizeMouseAtCenter(document.documentElement, {
    type: "mousemove",
  });

  disable_non_test_mouse(false);
}

// The set of tabs which have ever had their mute state changed.
// Used to determine whether the tab should have a muteReason value.
let everMutedTabs = new WeakSet();

function get_wait_for_mute_promise(tab, expectMuted) {
  return BrowserTestUtils.waitForEvent(tab, "TabAttrModified", false, (event) => {
    if (
      event.detail.changed.includes("muted") ||
      event.detail.changed.includes("activemedia-blocked")
    ) {
      is(
        tab.hasAttribute("muted"),
        expectMuted,
        "The tab should " + (expectMuted ? "" : "not ") + "be muted"
      );
      is(
        tab.muted,
        expectMuted,
        "The tab muted property " + (expectMuted ? "" : "not ") + "be true"
      );

      if (expectMuted || everMutedTabs.has(tab)) {
        everMutedTabs.add(tab);
        is(tab.muteReason, null, "The tab should have a null muteReason value");
      } else {
        is(tab.muteReason, undefined, "The tab should have an undefined muteReason value");
      }
      return true;
    }
    return false;
  });
}

async function test_mute_tab(tab, icon, expectMuted) {
  let mutedPromise = get_wait_for_mute_promise(tab, expectMuted);

  let activeTab = gBrowser.selectedTab;

  let tooltip = document.getElementById("tabbrowser-tab-tooltip");

  await hover_icon(icon, tooltip);
  EventUtils.synthesizeMouseAtCenter(icon, { button: 0 });
  leave_icon(icon);

  is(
    gBrowser.selectedTab,
    activeTab,
    "Clicking on mute should not change the currently selected tab"
  );

  // If the audio is playing, we should check whether clicking on icon affects
  // the media element's playing state.
  let isAudioPlaying = await is_audio_playing(tab);
  if (isAudioPlaying) {
    await wait_for_tab_playing_event(tab, !expectMuted);
  }

  return mutedPromise;
}

async function dragAndDrop(
  tab1,
  tab2,
  copy = false,
  destWindow = window,
  afterTab = true,
  origWindow = window
) {
  let rect = tab2.getBoundingClientRect();
  let event = {
    ctrlKey: copy,
    altKey: copy,
    clientX: rect.left + rect.width / 2 + (afterTab ? 1 : -1),
    clientY: rect.top + rect.height / 2,
  };

  if (destWindow != origWindow) {
    // Make sure that both tab1 and tab2 are visible
    origWindow.focus();
    origWindow.moveTo(rect.left, rect.top + rect.height * 3);
  }

  let originalIndex = tab1.elementIndex;
  EventUtils.synthesizeDrop(
    tab1,
    tab2,
    null,
    copy ? "copy" : "move",
    origWindow,
    destWindow,
    event
  );
  // Ensure dnd suppression is cleared.
  EventUtils.synthesizeMouseAtCenter(tab2, { type: "mouseup" }, destWindow);
  if (!copy && destWindow == origWindow) {
    await BrowserTestUtils.waitForCondition(() => {
      return tab1.elementIndex != originalIndex;
    }, "Waiting for tab position to be updated");
  } else if (destWindow != origWindow) {
    await BrowserTestUtils.waitForCondition(() => tab1.closing, "Waiting for tab closing");
  }
}

function getUrl(tab) {
  return tab.linkedBrowser.currentURI.spec;
}

/**
 * Takes a xul:browser and makes sure that the remoteTypes for the browser in
 * both the parent and the child processes are the same.
 *
 * @param {XULBrowser} browser
 * @param {string} expectedRemoteType
 *        The expected remoteType value for the browser in both the parent
 *        and child processes.
 * @param {string?} message
 *        If provided, shows this string as the message when remoteType values
 *        do not match. If not present, it uses the default message defined
 *        in the function parameters.
 */
function checkBrowserRemoteType(
  browser,
  expectedRemoteType,
  message = `Ensures that tab runs in the ${expectedRemoteType} content process.`
) {
  // Check both parent and child to ensure that they have the correct remoteType.
  if (expectedRemoteType == E10SUtils.WEB_REMOTE_TYPE) {
    ok(E10SUtils.isWebRemoteType(browser.remoteType), message);
    ok(
      E10SUtils.isWebRemoteType(browser.messageManager.remoteType),
      "Parent and child process should agree on the remote type."
    );
  } else {
    is(browser.remoteType, expectedRemoteType, message);
    is(
      browser.messageManager.remoteType,
      expectedRemoteType,
      "Parent and child process should agree on the remote type."
    );
  }
}

function test_url_for_process_types({
  url,
  chromeResult,
  webContentResult,
  privilegedAboutContentResult,
  privilegedMozillaContentResult,
  extensionProcessResult,
}) {
  const CHROME_PROCESS = E10SUtils.NOT_REMOTE;
  const WEB_CONTENT_PROCESS = E10SUtils.WEB_REMOTE_TYPE;
  const PRIVILEGEDABOUT_CONTENT_PROCESS = E10SUtils.PRIVILEGEDABOUT_REMOTE_TYPE;
  const PRIVILEGEDMOZILLA_CONTENT_PROCESS = E10SUtils.PRIVILEGEDMOZILLA_REMOTE_TYPE;
  const EXTENSION_PROCESS = E10SUtils.EXTENSION_REMOTE_TYPE;

  is(
    E10SUtils.canLoadURIInRemoteType(url, /* fission */ false, CHROME_PROCESS),
    chromeResult,
    "Check URL in chrome process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(url, /* fission */ false, WEB_CONTENT_PROCESS),
    webContentResult,
    "Check URL in web content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(url, /* fission */ false, PRIVILEGEDABOUT_CONTENT_PROCESS),
    privilegedAboutContentResult,
    "Check URL in privileged about content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(url, /* fission */ false, PRIVILEGEDMOZILLA_CONTENT_PROCESS),
    privilegedMozillaContentResult,
    "Check URL in privileged mozilla content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(url, /* fission */ false, EXTENSION_PROCESS),
    extensionProcessResult,
    "Check URL in extension process."
  );

  is(
    E10SUtils.canLoadURIInRemoteType(url + "#foo", /* fission */ false, CHROME_PROCESS),
    chromeResult,
    "Check URL with ref in chrome process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(url + "#foo", /* fission */ false, WEB_CONTENT_PROCESS),
    webContentResult,
    "Check URL with ref in web content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(
      url + "#foo",
      /* fission */ false,
      PRIVILEGEDABOUT_CONTENT_PROCESS
    ),
    privilegedAboutContentResult,
    "Check URL with ref in privileged about content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(
      url + "#foo",
      /* fission */ false,
      PRIVILEGEDMOZILLA_CONTENT_PROCESS
    ),
    privilegedMozillaContentResult,
    "Check URL with ref in privileged mozilla content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(url + "#foo", /* fission */ false, EXTENSION_PROCESS),
    extensionProcessResult,
    "Check URL with ref in extension process."
  );

  is(
    E10SUtils.canLoadURIInRemoteType(url + "?foo", /* fission */ false, CHROME_PROCESS),
    chromeResult,
    "Check URL with query in chrome process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(url + "?foo", /* fission */ false, WEB_CONTENT_PROCESS),
    webContentResult,
    "Check URL with query in web content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(
      url + "?foo",
      /* fission */ false,
      PRIVILEGEDABOUT_CONTENT_PROCESS
    ),
    privilegedAboutContentResult,
    "Check URL with query in privileged about content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(
      url + "?foo",
      /* fission */ false,
      PRIVILEGEDMOZILLA_CONTENT_PROCESS
    ),
    privilegedMozillaContentResult,
    "Check URL with query in privileged mozilla content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(url + "?foo", /* fission */ false, EXTENSION_PROCESS),
    extensionProcessResult,
    "Check URL with query in extension process."
  );

  is(
    E10SUtils.canLoadURIInRemoteType(url + "?foo#bar", /* fission */ false, CHROME_PROCESS),
    chromeResult,
    "Check URL with query and ref in chrome process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(url + "?foo#bar", /* fission */ false, WEB_CONTENT_PROCESS),
    webContentResult,
    "Check URL with query and ref in web content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(
      url + "?foo#bar",
      /* fission */ false,
      PRIVILEGEDABOUT_CONTENT_PROCESS
    ),
    privilegedAboutContentResult,
    "Check URL with query and ref in privileged about content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(
      url + "?foo#bar",
      /* fission */ false,
      PRIVILEGEDMOZILLA_CONTENT_PROCESS
    ),
    privilegedMozillaContentResult,
    "Check URL with query and ref in privileged mozilla content process."
  );
  is(
    E10SUtils.canLoadURIInRemoteType(url + "?foo#bar", /* fission */ false, EXTENSION_PROCESS),
    extensionProcessResult,
    "Check URL with query and ref in extension process."
  );
}

/*
 * Get a file URL for the local file name.
 */
function fileURL(filename) {
  let ifile = getChromeDir(getResolvedURI(gTestPath));
  ifile.append(filename);
  return Services.io.newFileURI(ifile).spec;
}

/*
 * Get a http URL for the local file name.
 */
function httpURL(filename, host = "https://example.com/") {
  let root = getRootDirectory(gTestPath).replace("chrome://mochitests/content/", host);
  return root + filename;
}

function loadTestSubscript(filePath) {
  Services.scriptloader.loadSubScript(new URL(filePath, gTestPath).href, this);
}

/**
 * Removes a tab group (along with its tabs). Resolves when the tab group
 * is gone.
 *
 * @param {MozTabbrowserTabGroup} group
 * @returns {Promise<void>}
 */
async function removeTabGroup(group) {
  return TabGroupTestUtils.removeTabGroup(group);
}

/**
 * @param {Node} triggerNode
 * @param {string} contextMenuId
 * @returns {Promise<XULMenuElement|XULPopupElement>}
 */
async function getContextMenu(triggerNode, contextMenuId) {
  let win = triggerNode.ownerGlobal;
  triggerNode.scrollIntoView({ behavior: "instant" });
  const contextMenu = win.document.getElementById(contextMenuId);
  const contextMenuShown = BrowserTestUtils.waitForPopupEvent(contextMenu, "shown");

  EventUtils.synthesizeMouseAtCenter(triggerNode, { type: "contextmenu", button: 2 }, win);
  await contextMenuShown;
  return contextMenu;
}

/**
 * @param {XULMenuElement|XULPopupElement} contextMenu
 * @returns {Promise<void>}
 */
async function closeContextMenu(contextMenu) {
  let menuHidden = BrowserTestUtils.waitForPopupEvent(contextMenu, "hidden");
  contextMenu.hidePopup();
  await menuHidden;
}
