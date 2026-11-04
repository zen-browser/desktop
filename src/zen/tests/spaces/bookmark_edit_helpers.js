/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Shared helpers for tests that drive the bookmark-edit surfaces (the Star
 * panel and the bookmark properties dialog). The places-specific helpers
 * mirror upstream browser/components/places/tests/browser/head.js, which the
 * Zen suite does not load.
 */

// Find the Bookmarks Toolbar node for a bookmark GUID.
function getToolbarNodeForItemGuid(aItemGuid, aWin = window) {
  let children = aWin.document.getElementById("PlacesToolbarItems").childNodes;
  for (let child of children) {
    if (aItemGuid === child._placesNode?.bookmarkGuid) {
      return child;
    }
  }
  return null;
}

function isToolbarVisible(aToolbar) {
  let hidingAttribute =
    aToolbar.getAttribute("type") == "menubar" ? "autohide" : "collapsed";
  // The attribute can be present without a value, so test for presence.
  return !aToolbar.hasAttribute(hidingAttribute);
}

function promiseSetToolbarVisibility(aToolbar, aVisible) {
  if (isToolbarVisible(aToolbar) != aVisible) {
    let visibilityChanged = TestUtils.waitForCondition(
      () => aToolbar.collapsed != aVisible
    );
    setToolbarVisibility(aToolbar, aVisible, undefined, false);
    return visibilityChanged;
  }
  return Promise.resolve();
}

/**
 * Make the bookmarks toolbar visible and populated. Zen defaults to
 * visibility "never", and PlacesToolbarHelper._realInit() bails before
 * building the view while the toolbar is collapsed — so uncollapse, then
 * force the (idempotent) init, or #PlacesToolbarItems stays empty.
 */
async function ensureBookmarksToolbarIsVisibleAndPopulated() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.toolbars.bookmarks.visibility", "always"]],
  });

  // Start from a clean slate so the toolbar count is predictable.
  await PlacesUtils.bookmarks.eraseEverything();

  // One placeholder bookmark keeps the empty-toolbar placeholder out of the way.
  let bm = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.toolbarGuid,
    title: "initial",
    url: "about:robots",
  });

  let toolbar = document.getElementById("PersonalToolbar");
  if (toolbar.collapsed) {
    await promiseSetToolbarVisibility(toolbar, true);
  }

  let viewElt = document.getElementById("PlacesToolbar");
  PlacesToolbarHelper._realInit();
  await TestUtils.waitForCondition(
    () => viewElt._placesView,
    "the PlacesToolbar view should be created"
  );

  registerCleanupFunction(async () => {
    await promiseSetToolbarVisibility(toolbar, false);
    try {
      await PlacesUtils.bookmarks.remove(bm);
    } catch (ex) {
      // May have been removed already by a test's own cleanup.
    }
  });

  await TestUtils.waitForCondition(
    () =>
      document.getElementById("PlacesToolbarItems").childElementCount == 1,
    "the placeholder bookmark should appear on the toolbar",
    100,
    100
  );
}

// Wait out a pending PlacesToolbar rebuild: Zen rebuilds on workspace switch
// and workspace-bookmark changes, and an insert racing a rebuild gets dropped.
async function promiseToolbarRebuilt() {
  let view = document.getElementById("PlacesToolbar")._placesView;
  if (view) {
    await view.promiseRebuilt();
  }
}

/**
 * Wait for a toolbar node to appear. A rebuild can race the insert and drop
 * the node; nudge another rebuild, which is what a workspace switch does.
 */
async function waitForToolbarNode(aGuid) {
  try {
    return await TestUtils.waitForCondition(
      () => {
        let node = getToolbarNodeForItemGuid(aGuid);
        if (!node) {
          gZenWorkspaces._invalidateBookmarkContainers();
        }
        return node;
      },
      "Toolbar node should be found",
      100,
      100
    );
  } catch (ex) {
    let items = [...document.getElementById("PlacesToolbarItems").children].map(
      c => `${c._placesNode?.bookmarkGuid}:${c._placesNode?.title}`
    );
    info(`toolbar items: [${items.join(", ")}] looking for ${aGuid}`);
    throw ex;
  }
}

/**
 * Collect the live spaces into the session store. The edit surfaces read
 * spaces from ZenSessionStore.getClonedSpaces(), which lags the live cache
 * until a save happens, so force one before opening either surface.
 */
function flushSpacesToSessionStore() {
  const { ZenSessionStore } = ChromeUtils.importESModule(
    "resource:///modules/zen/ZenSessionManager.sys.mjs"
  );
  ZenSessionStore.saveState(JSON.parse(SessionStore.getBrowserState()), true);
}

/**
 * Open the Star panel and wait until it is fully initialized (the workspace
 * list is populated before openPopup()).
 *
 * @param {Window} [aWin]
 * @returns {Promise<Element>} the panel element.
 */
async function openStarPanel(aWin = window) {
  aWin.StarUI._createPanelIfNeeded();
  let panel = aWin.document.getElementById("editBookmarkPanel");
  let shown = BrowserTestUtils.waitForPopupEvent(panel, "shown");
  aWin.BookmarkingUI.star.click();
  await shown;
  return panel;
}

/**
 * Returns an openFn for withBookmarksDialog. The upstream helpers drive the
 * Places context menu, but Zen's toolbar sits in a window-dragging region
 * that swallows synthesized mouse events, so call the dialog directly — the
 * same entry point the "Properties" menu item uses.
 */
function openPropertiesForToolbarNode(aToolbarNode) {
  return function () {
    PlacesUIUtils.showBookmarkDialog(
      {
        action: "edit",
        node: aToolbarNode._placesNode,
        hiddenRows: ["folderPicker"],
      },
      window
    );
  };
}

function workspaceElements(aDoc) {
  return {
    content: aDoc.getElementById("editBookmarkPanelContent"),
    label: aDoc.querySelector(
      'label[control="editBMPanel_workspacesSelectorExpander"]'
    ),
    dropdown: aDoc.getElementById("editBMPanel_workspaceDropdown"),
    summary: aDoc.getElementById("editBMPanel_workspaceSummary"),
    expander: aDoc.getElementById("editBMPanel_workspacesSelectorExpander"),
    list: aDoc.getElementById("editBMPanel_workspaceList"),
  };
}

// Expand the selector and check the checkbox belonging to aSpace.
async function selectSpace(aDoc, aSpace) {
  const els = workspaceElements(aDoc);
  // The panel keeps expansion state between opens, so only toggle when
  // collapsed.
  if (els.list.hidden) {
    els.expander.click();
  }
  await TestUtils.waitForCondition(
    () => !els.list.hidden,
    "expander should reveal the space list"
  );

  // _initWorkspaceDropdown reads spaces from the session store, so the
  // checkbox for a fresh space may land a tick late.
  let checkbox;
  await TestUtils.waitForCondition(() => {
    checkbox = els.list.querySelector(`input[value="${aSpace.uuid}"]`);
    return !!checkbox;
  }, "a checkbox should exist for every space");

  checkbox.click();
  await TestUtils.waitForCondition(
    () => els.summary.textContent.includes(aSpace.name),
    "summary should list the selected space"
  );
}

/**
 * Open the properties dialog for a toolbar node, wait for it to initialize,
 * and run aTestFn(dialogWin, doc). Cancels the dialog if aTestFn throws —
 * withBookmarksDialog(false) would otherwise hang on the rejection.
 */
async function withPropertiesDialog(aToolbarNode, aTestFn) {
  await withBookmarksDialog(
    false,
    openPropertiesForToolbarNode(aToolbarNode),
    async function (dialogWin) {
      const doc = dialogWin.document;
      const cancel = () =>
        doc.getElementById("bookmarkpropertiesdialog").cancelDialog();
      try {
        await TestUtils.waitForCondition(() => doc.title);
        await aTestFn(dialogWin, doc);
      } catch (ex) {
        cancel();
        throw ex;
      }
    }
  );
}

// Waits until the window-modal bookmark properties dialog has fully closed.
function promiseDialogClosed(aDialogWin) {
  let container = document.getElementById("window-modal-dialog");
  return BrowserTestUtils.waitForEvent(container, "close").then(() =>
    BrowserTestUtils.waitForMutationCondition(
      container,
      { childList: true, attributes: true },
      () => !container.hasChildNodes() && !container.open
    )
  );
}
