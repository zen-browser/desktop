/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

function goToRightSideTabs(callback) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async resolve => {
    await SpecialPowers.pushPrefEnv({
      set: [["zen.tabs.vertical.right-side", true]],
    });
    // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
    setTimeout(async () => {
      await callback();
      await SpecialPowers.popPrefEnv();
      // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
      setTimeout(() => {
        resolve();
      }, 1000); // Wait for new layout
    }, 1000); // Wait for new layout
  });
}

async function testSidebarWidth() {
  let resolvePromise;
  const promise = new Promise(resolve => {
    resolvePromise = resolve;
  });

  let hasRan = false;
  const ogSize = gNavToolbox.getBoundingClientRect().width;
  const onCompactChanged = _event => {
    if (hasRan) {
      // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
      setTimeout(() => {
        gZenCompactModeManager.removeEventListener(onCompactChanged);
        resolvePromise();
      }, 500);
      return;
    }
    // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
    setTimeout(() => {
      const newSize = gNavToolbox.style
        .getPropertyValue("--zen-sidebar-width")
        .replace("px", "");
      Assert.equal(
        newSize,
        ogSize,
        "The size of the titlebar should be the same as the original size"
      );
      hasRan = true;
      gZenCompactModeManager.preference = false;
    }, 500);
  };

  gZenCompactModeManager.addEventListener(onCompactChanged);

  await gZenCompactModeManager.toggle();
  await promise;
}

async function setCompactMode(enabled) {
  if (gZenCompactModeManager.preference === enabled) {
    return;
  }
  const toggled = BrowserTestUtils.waitForEvent(
    window,
    "ZenCompactMode:Toggled",
    false,
    event => event.detail === enabled
  );
  await gZenCompactModeManager.toggle();
  await toggled;
}

function dispatchMouseEvent(target, type, clientX, clientY) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: type === "mouseup" ? 0 : 1,
      clientX,
      clientY,
      screenX: window.mozInnerScreenX + clientX,
      screenY: window.mozInnerScreenY + clientY,
    })
  );
}

async function testResizeHandlePointer() {
  await BrowserTestUtils.withNewTab(
    "data:text/html,<!doctype html><title>Compact mode pointer test</title>",
    async () => {
      const originalWidth = gNavToolbox.getBoundingClientRect().width;
      const handle = document.getElementById(
        "zen-compact-sidebar-resize-handle"
      );
      await setCompactMode(true);
      const positionProperty = gZenCompactModeManager.sidebarIsOnRight
        ? "right"
        : "left";
      const opened = BrowserTestUtils.waitForEvent(
        gNavToolbox,
        "transitionend",
        false,
        event => event.propertyName === positionProperty
      );
      gNavToolbox.setAttribute("zen-has-hover", "true");
      await opened;
      await TestUtils.waitForCondition(
        () => BrowserTestUtils.isVisible(handle),
        "The compact sidebar resize handle should be visible"
      );
      const titlebarRect = document
        .getElementById("titlebar")
        .getBoundingClientRect();
      const rootRect = document.documentElement.getBoundingClientRect();
      const outerGap = gZenCompactModeManager.sidebarIsOnRight
        ? rootRect.right - titlebarRect.right
        : titlebarRect.left - rootRect.left;
      const expectedOuterGap =
        Number.parseFloat(getComputedStyle(gNavToolbox).paddingLeft) / 2;
      Assert.lessOrEqual(
        Math.abs(outerGap - expectedOuterGap),
        1,
        "The compact sidebar keeps the same outer gap on either side"
      );

      const minWidth = gZenCompactModeManager.sidebarMinWidth;
      const maxWidth = Math.max(
        minWidth,
        Services.prefs.getIntPref("zen.view.sidebar-expanded.max-width")
      );
      const middleWidth = minWidth + (maxWidth - minWidth) / 2;
      const direction = gZenCompactModeManager.sidebarIsOnRight ? -1 : 1;
      gZenCompactModeManager._applySidebarWidth(middleWidth);

      let handleRect = handle.getBoundingClientRect();
      let startX = handleRect.left + handleRect.width / 2;
      let pointerY = handleRect.top + handleRect.height / 2;
      const growX = startX + direction * (maxWidth - middleWidth + 50);
      dispatchMouseEvent(handle, "mousedown", startX, pointerY);
      Assert.equal(
        handle.getAttribute("state"),
        "dragging",
        "Pointer down starts compact sidebar resizing"
      );
      dispatchMouseEvent(
        document.documentElement,
        "mousemove",
        growX,
        pointerY
      );
      dispatchMouseEvent(document.documentElement, "mouseup", growX, pointerY);
      Assert.equal(
        Math.round(gNavToolbox.getBoundingClientRect().width),
        maxWidth,
        "Pointer dragging is clamped to the maximum width"
      );
      Assert.ok(
        !!gZenCompactModeManager._sidebarHoverBufferListener,
        "Releasing outside the sidebar starts the hover buffer"
      );

      dispatchMouseEvent(
        document.documentElement,
        "mousemove",
        growX,
        pointerY
      );
      Assert.ok(
        gNavToolbox.hasAttribute("zen-has-hover"),
        "The sidebar stays open until the pointer re-enters it"
      );

      const sidebarRect = document
        .getElementById("titlebar")
        .getBoundingClientRect();
      const insideX = (sidebarRect.left + sidebarRect.right) / 2;
      dispatchMouseEvent(
        document.documentElement,
        "mousemove",
        insideX,
        pointerY
      );

      const hoverBuffer = gZenCompactModeManager.SIDEBAR_HOVER_BUFFER;
      const bufferedX = gZenCompactModeManager.sidebarIsOnRight
        ? sidebarRect.left - hoverBuffer
        : sidebarRect.right + hoverBuffer;
      dispatchMouseEvent(
        document.documentElement,
        "mousemove",
        bufferedX,
        pointerY
      );
      Assert.ok(
        gNavToolbox.hasAttribute("zen-has-hover"),
        "The sidebar stays open inside the outside hover buffer"
      );

      const outsideX = gZenCompactModeManager.sidebarIsOnRight
        ? sidebarRect.left - hoverBuffer - 1
        : sidebarRect.right + hoverBuffer + 1;
      dispatchMouseEvent(
        document.documentElement,
        "mousemove",
        outsideX,
        pointerY
      );
      Assert.ok(
        !gNavToolbox.hasAttribute("zen-has-hover"),
        "The sidebar hides after the pointer leaves the outside hover buffer"
      );

      gNavToolbox.setAttribute("zen-has-hover", "true");
      gZenCompactModeManager._applySidebarWidth(maxWidth);
      handleRect = handle.getBoundingClientRect();
      startX = handleRect.left + handleRect.width / 2;
      pointerY = handleRect.top + handleRect.height / 2;
      const shrinkX = startX - direction * (maxWidth - minWidth + 50);
      dispatchMouseEvent(handle, "mousedown", startX, pointerY);
      dispatchMouseEvent(
        document.documentElement,
        "mousemove",
        shrinkX,
        pointerY
      );
      dispatchMouseEvent(
        document.documentElement,
        "mouseup",
        shrinkX,
        pointerY
      );
      Assert.equal(
        Math.round(gNavToolbox.getBoundingClientRect().width),
        minWidth,
        "Pointer dragging is clamped to the minimum width"
      );

      gZenCompactModeManager._stopSidebarHoverBuffer();
      gZenCompactModeManager._applySidebarWidth(originalWidth);
      gZenCompactModeManager.getAndApplySidebarWidth({});
      gNavToolbox.removeAttribute("zen-has-hover");
      await setCompactMode(false);
    }
  );
}

add_task(async function test_Compact_Mode_Width() {
  await testSidebarWidth();
});

add_task(async function test_Compact_Mode_Width_Right_Side() {
  await goToRightSideTabs(testSidebarWidth);
});

add_task(async function test_Compact_Mode_Hover() {
  gNavToolbox.setAttribute("zen-has-hover", true);
  await testSidebarWidth();
  gNavToolbox.removeAttribute("zen-has-hover");
});

add_task(async function test_Compact_Mode_Min_Width_Cache() {
  gZenCompactModeManager._invalidateSidebarMinWidth();
  const originalWidth = gNavToolbox.getBoundingClientRect().width;
  const measuredWidth = await gZenCompactModeManager._ensureSidebarMinWidth();
  Assert.equal(
    gNavToolbox.getBoundingClientRect().width,
    originalWidth,
    "Measuring the minimum restores the original sidebar width"
  );

  let resizeEvents = 0;
  const countResize = () => resizeEvents++;
  window.addEventListener("resize", countResize);
  const cachedWidth = await gZenCompactModeManager._ensureSidebarMinWidth();
  window.removeEventListener("resize", countResize);
  Assert.equal(cachedWidth, measuredWidth, "The cached minimum is reused");
  Assert.equal(resizeEvents, 0, "A cache hit does not trigger window resize");
});

add_task(async function test_Compact_Mode_Resize_Handle_Pointer() {
  await testResizeHandlePointer();
});

add_task(async function test_Compact_Mode_Resize_Handle_Pointer_Right_Side() {
  await goToRightSideTabs(testResizeHandlePointer);
});

add_task(async function test_Compact_Mode_Empty_Tab_Hover_Priority() {
  await BrowserTestUtils.withNewTab(
    "data:text/html,<!doctype html><title>Compact mode navigation test</title>",
    async browser => {
      const loadedTab = gBrowser.getTabForBrowser(browser);
      const emptyTab = gZenWorkspaces._emptyTab;
      window.windowUtils.disableNonTestMouseEvents(true);

      try {
        gBrowser.selectedTab = emptyTab;
        await TestUtils.waitForCondition(
          () => gNavToolbox.hasAttribute("zen-has-empty-tab"),
          "The sidebar should stay open for an empty tab"
        );
        await setCompactMode(true);

        EventUtils.synthesizeMouseAtCenter(loadedTab, { type: "mousemove" });
        await TestUtils.waitForCondition(
          () =>
            gNavToolbox.matches(":hover") &&
            gNavToolbox.hasAttribute("zen-has-hover"),
          "The sidebar should register pointer hover before tab selection"
        );
        EventUtils.synthesizeMouseAtCenter(loadedTab, {});
        await TestUtils.waitForCondition(
          () =>
            gBrowser.selectedTab === loadedTab &&
            !gNavToolbox.hasAttribute("zen-has-empty-tab"),
          "Selecting a loaded tab should leave the empty-tab state"
        );
        Assert.ok(
          gNavToolbox.hasAttribute("zen-has-hover"),
          "The sidebar stays open when navigation starts from inside it"
        );

        gBrowser.selectedTab = emptyTab;
        await TestUtils.waitForCondition(
          () => gNavToolbox.hasAttribute("zen-has-empty-tab"),
          "The empty-tab state should be restored"
        );
        EventUtils.synthesizeMouseAtCenter(gBrowser.tabpanels, {
          type: "mousemove",
        });
        await TestUtils.waitForCondition(
          () => !gNavToolbox.matches(":hover"),
          "The pointer should be outside the sidebar"
        );
        gBrowser.selectedTab = loadedTab;
        await TestUtils.waitForCondition(
          () => !gNavToolbox.hasAttribute("zen-has-empty-tab"),
          "Selecting a loaded tab should leave the empty-tab state"
        );
        Assert.ok(
          !gNavToolbox.hasAttribute("zen-has-hover"),
          "The sidebar hides when navigation starts from outside it"
        );
      } finally {
        window.windowUtils.disableNonTestMouseEvents(false);
        gZenCompactModeManager._unlockSidebarHover();
        gZenCompactModeManager._stopSidebarHoverBuffer();
        gNavToolbox.removeAttribute("zen-has-hover");
        await setCompactMode(false);
      }
    }
  );
});

add_task(async function test_Compact_Mode_Empty_Tab_Urlbar_Navigation() {
  const emptyTab = gZenWorkspaces._emptyTab;
  let openedTab;
  window.windowUtils.disableNonTestMouseEvents(true);

  try {
    gBrowser.selectedTab = emptyTab;
    await TestUtils.waitForCondition(
      () => gNavToolbox.hasAttribute("zen-has-empty-tab"),
      "The sidebar should stay open for an empty tab"
    );
    await setCompactMode(true);

    document.getElementById("Browser:OpenLocation").doCommand();
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      waitForFocus: SimpleTest.waitForFocus,
      value: "https://example.com/",
    });
    const result = await UrlbarTestUtils.getDetailsOfResultAt(window, 0);
    EventUtils.synthesizeMouseAtCenter(result.element.row, {
      type: "mousemove",
    });

    const titlebarRect = document
      .getElementById("titlebar")
      .getBoundingClientRect();
    const resultRect = result.element.row.getBoundingClientRect();
    const resultCenterX = (resultRect.left + resultRect.right) / 2;
    Assert.ok(
      gZenCompactModeManager.sidebarIsOnRight
        ? resultCenterX < titlebarRect.left
        : resultCenterX > titlebarRect.right,
      "The floating URL bar result should be outside the visible sidebar"
    );

    const tabOpened = BrowserTestUtils.waitForNewTab(
      gBrowser,
      "https://example.com/",
      true
    );
    EventUtils.synthesizeMouseAtCenter(result.element.row, {});
    openedTab = await tabOpened;
    await TestUtils.waitForCondition(
      () => !gNavToolbox.hasAttribute("zen-has-empty-tab"),
      "URL bar navigation should leave the empty-tab state"
    );
    Assert.ok(
      !gNavToolbox.hasAttribute("zen-has-hover"),
      "The sidebar hides when URL bar navigation starts outside its bounds"
    );
  } finally {
    window.windowUtils.disableNonTestMouseEvents(false);
    await UrlbarTestUtils.promisePopupClose(window);
    if (openedTab) {
      await BrowserTestUtils.removeTab(openedTab);
    }
    gZenCompactModeManager._unlockSidebarHover();
    gZenCompactModeManager._stopSidebarHoverBuffer();
    gNavToolbox.removeAttribute("zen-has-hover");
    await setCompactMode(false);
  }
});
