/**
 * Global variables for testing.
 */
const gEMPTY_PAGE_URL = GetTestWebBasedURL("file_empty.html");

/**
 * Return a web-based URL for a given file based on the testing directory.
 *
 * @param {string} fileName
 *        file that caller wants its web-based url
 * @param {boolean} cors [optional]
 *        if set, then return a url with different origin
 */
function GetTestWebBasedURL(fileName, cors = false) {
  // eslint-disable-next-line @microsoft/sdl/no-insecure-url
  // eslint-disable-next-line @microsoft/sdl/no-insecure-url
  const origin = cors ? "http://example.org" : "http://example.com";
  return (
    getRootDirectory(gTestPath).replace("chrome://mochitests/content", origin) +
    fileName
  );
}

/**
 * Wait until tab sound indicator appears on the given tab.
 *
 * @param {tabbrowser} tab
 *        given tab where tab sound indicator should appear
 */
async function waitForTabSoundIndicatorAppears(tab) {
  if (!tab.soundPlaying) {
    info("Tab sound indicator doesn't appear yet");
    await BrowserTestUtils.waitForEvent(
      tab,
      "TabAttrModified",
      false,
      event => {
        return event.detail.changed.includes("soundplaying");
      }
    );
  }
  ok(tab.soundPlaying, "Tab sound indicator appears");
}

/**
 * Wait until tab sound indicator disappears on the given tab.
 *
 * @param {tabbrowser} tab
 *        given tab where tab sound indicator should disappear
 */
async function waitForTabSoundIndicatorDisappears(tab) {
  if (tab.soundPlaying) {
    info("Tab sound indicator doesn't disappear yet");
    await BrowserTestUtils.waitForEvent(
      tab,
      "TabAttrModified",
      false,
      event => {
        return event.detail.changed.includes("soundplaying");
      }
    );
  }
  ok(!tab.soundPlaying, "Tab sound indicator disappears");
}

/**
 * Return a new foreground tab loading with an empty file.
 *
 * @param {boolean} needObserver
 *        If true, sets an observer property on the returned tab. This property
 *        exposes `hasEverUpdated()` which will return a bool indicating if the
 *        sound indicator has ever updated.
 */
async function createBlankForegroundTab({ needObserver } = {}) {
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    gEMPTY_PAGE_URL
  );
  if (needObserver) {
    tab.observer = createSoundIndicatorObserver(tab);
  }
  return tab;
}

function createSoundIndicatorObserver(tab) {
  let hasEverUpdated = false;
  let listener = event => {
    if (event.detail.changed.includes("soundplaying")) {
      hasEverUpdated = true;
    }
  };
  tab.addEventListener("TabAttrModified", listener);
  return {
    hasEverUpdated: () => {
      tab.removeEventListener("TabAttrModified", listener);
      return hasEverUpdated;
    },
  };
}

/**
 * Sythesize mouse hover on the given icon, which would sythesize `mouseover`
 * and `mousemove` event on that. Return a promise that will be resolved when
 * the tooptip element shows.
 *
 * @param {tab icon} icon
 *        the icon on which we want to mouse hover
 * @param {tooltip element} tooltip
 *        the tab tooltip elementss
 */
function hoverIcon(icon, tooltip) {
  disableNonTestMouse(true);

  if (!tooltip) {
    tooltip = document.getElementById("tabbrowser-tab-tooltip");
  }

  let popupShownPromise = BrowserTestUtils.waitForEvent(tooltip, "popupshown");
  EventUtils.synthesizeMouse(icon, 1, 1, { type: "mouseover" });
  EventUtils.synthesizeMouse(icon, 2, 2, { type: "mousemove" });
  EventUtils.synthesizeMouse(icon, 3, 3, { type: "mousemove" });
  EventUtils.synthesizeMouse(icon, 4, 4, { type: "mousemove" });
  return popupShownPromise;
}

/**
 * Leave mouse from the given icon, which would sythesize `mouseout`
 * and `mousemove` event on that.
 *
 * @param {tab icon} icon
 *        the icon on which we want to mouse hover
 * @param {tooltip element} tooltip
 *        the tab tooltip elementss
 */
function leaveIcon(icon) {
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

  disableNonTestMouse(false);
}

/**
 * Sythesize mouse click on the given icon.
 *
 * @param {tab icon} icon
 *        the icon on which we want to mouse hover
 */
async function clickIcon(icon) {
  await hoverIcon(icon);
  EventUtils.synthesizeMouseAtCenter(icon, { button: 0 });
  leaveIcon(icon);
}

function disableNonTestMouse(disable) {
  let utils = window.windowUtils;
  utils.disableNonTestMouseEvents(disable);
}
