/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// gh-14317: the scroll-shadow dividers are gated on the arrowscrollbox's
// scrolledtostart / scrolledtoend attributes. With pinned tabs collapsed, the
// pinned section's start marker is pulled out of the scroll flow, so the native
// element-edge computation reported the wrong state and a false top divider
// showed at scrollTop 0. The fix derives both attributes from the real scroll
// position for the workspace scrollbox. This test pins+collapses, overflows the
// list, and asserts the attributes track scroll position.

async function settle() {
  // Wait for the scroll event + the arrowscrollbox's rAF-batched
  // #updateScrollButtonsDisabledState (aRafCount = 2) to run.
  /* eslint-disable-next-line mozilla/no-arbitrary-setTimeout */
  await new Promise(resolve => setTimeout(resolve, 200));
}

add_task(async function test_scroll_shadow_with_collapsed_pinned_tabs() {
  const arrowscrollbox = gZenWorkspaces.activeScrollbox;
  arrowscrollbox.smoothScroll = false;
  const scrollbox = arrowscrollbox.scrollbox;
  const originalTab = gBrowser.selectedTab;
  const createdTabs = [];

  // Pin a couple of tabs so there is a pinned section to collapse.
  for (let i = 0; i < 2; i++) {
    const tab = await BrowserTestUtils.openNewForegroundTab(
      window.gBrowser,
      "https://example.com/",
      true
    );
    createdTabs.push(tab);
    gBrowser.pinTab(tab);
  }

  // Open enough normal tabs to overflow, plus generous margin so the list
  // still overflows after collapsing removes the pinned tabs' height.
  while (!arrowscrollbox.overflowing) {
    const tab = await BrowserTestUtils.openNewForegroundTab(
      window.gBrowser,
      "https://example.com/",
      true
    );
    createdTabs.push(tab);
  }
  let lastNormalTab;
  for (let i = 0; i < 6; i++) {
    lastNormalTab = await BrowserTestUtils.openNewForegroundTab(
      window.gBrowser,
      "https://example.com/",
      true
    );
    createdTabs.push(lastNormalTab);
  }

  // A NORMAL tab must be selected when collapsing: the collapse only applies
  // the negative-margin shift to the start marker when no pinned tab is
  // active (#calculateHeightShift returns 0 otherwise), and that shift is the
  // condition that triggers gh-14317.
  gBrowser.selectedTab = lastNormalTab;

  const workspace = gZenWorkspaces.activeWorkspaceElement;
  workspace.collapsiblePins.collapsed = true;
  ok(workspace.hasCollapsedPinnedTabs, "Pinned tabs should be collapsed");
  await settle();

  ok(
    arrowscrollbox.overflowing,
    "The scrollbox should still overflow with pinned tabs collapsed"
  );

  // Scroll to the very top.
  scrollbox.scrollTop = 0;
  scrollbox.dispatchEvent(new Event("scroll"));
  await settle();

  // The gh-14317 regression: at the top, scrolledtostart must be set even
  // though the collapsed pinned marker is shifted above the viewport.
  ok(
    arrowscrollbox.hasAttribute("scrolledtostart"),
    "scrolledtostart set at scrollTop 0 with collapsed pinned tabs (no false top divider)"
  );
  ok(
    !arrowscrollbox.hasAttribute("scrolledtoend"),
    "scrolledtoend not set at the top while overflowing"
  );

  // Scroll down a bit -> no longer at the start.
  scrollbox.scrollTop = 100;
  scrollbox.dispatchEvent(new Event("scroll"));
  await settle();
  ok(
    !arrowscrollbox.hasAttribute("scrolledtostart"),
    "scrolledtostart cleared after scrolling down"
  );

  // Scroll to the bottom -> scrolledtoend.
  scrollbox.scrollTop = scrollbox.scrollHeight;
  scrollbox.dispatchEvent(new Event("scroll"));
  await settle();
  ok(
    arrowscrollbox.hasAttribute("scrolledtoend"),
    "scrolledtoend set at the bottom"
  );
  ok(
    !arrowscrollbox.hasAttribute("scrolledtostart"),
    "scrolledtostart not set at the bottom"
  );

  // Cleanup.
  workspace.collapsiblePins.collapsed = false;
  gBrowser.selectedTab = originalTab;
  for (const tab of createdTabs.reverse()) {
    await BrowserTestUtils.removeTab(tab);
  }
});
