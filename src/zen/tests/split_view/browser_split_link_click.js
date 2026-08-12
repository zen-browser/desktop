/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_PAGE = "http://mochi.test:8888/";
const LINK_URL = "http://mochi.test:8888/?zen-split-target";
const LINK_ID = "zen-split-test-link";
const JS_LINK_ID = "zen-split-test-js-link";

/**
 * Opens a tab holding two large, easy-to-hit links: an ordinary one and a
 * `javascript:` one.
 *
 * @returns {Promise<Tab>} The tab holding the links.
 */
async function addLinkTab() {
  const tab = await addTabTo(gBrowser, TEST_PAGE);
  gBrowser.selectedTab = tab;
  await SpecialPowers.spawn(
    tab.linkedBrowser,
    [LINK_URL, LINK_ID, JS_LINK_ID],
    (url, linkId, jsLinkId) => {
      for (const [id, href, top] of [
        [linkId, url, 0],
        [jsLinkId, "javascript:void 0", 120],
      ]) {
        const link = content.document.createElement("a");
        link.id = id;
        link.href = href;
        link.textContent = id;
        link.style.cssText = `position:fixed;left:0;top:${top}px;width:300px;height:100px;background:#fff;`;
        content.document.body.append(link);
      }
    }
  );
  return tab;
}

function clickLink(tab, id, modifiers) {
  return BrowserTestUtils.synthesizeMouseAtCenter(
    `#${id}`,
    modifiers,
    tab.linkedBrowser
  );
}

async function removeSplitTabs(tabs) {
  gZenViewSplitter.unsplitCurrentView();
  for (const tab of tabs) {
    await BrowserTestUtils.removeTab(tab);
  }
}

add_task(async function test_link_click_opens_split() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.splitView.enable-link-click-split", true],
      ["zen.splitView.link-activation-method", "shift"],
      ["zen.glance.activation-method", "alt"],
    ],
  });

  const sourceTab = await addLinkTab();
  const activated = BrowserTestUtils.waitForEvent(
    window,
    "ZenViewSplitter:SplitViewActivated"
  );
  await clickLink(sourceTab, LINK_ID, { shiftKey: true });
  await activated;

  const newTab = gBrowser.selectedTab;
  Assert.notStrictEqual(newTab, sourceTab, "A new tab should have been opened");
  ok(sourceTab.splitView, "The source tab should be in a split view");
  ok(newTab.splitView, "The opened tab should be in a split view");
  Assert.equal(
    newTab.group,
    sourceTab.group,
    "Both tabs should share the same split group"
  );
  Assert.equal(
    newTab.linkedBrowser.currentURI.spec,
    LINK_URL,
    "The new tab should have loaded the link's URL"
  );

  await removeSplitTabs([sourceTab, newTab]);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_click_without_modifier_does_not_split() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.splitView.enable-link-click-split", true],
      ["zen.splitView.link-activation-method", "shift"],
    ],
  });

  const tab = await addLinkTab();
  const tabCount = gBrowser.tabs.length;
  const loaded = BrowserTestUtils.browserLoaded(
    tab.linkedBrowser,
    false,
    LINK_URL
  );
  await clickLink(tab, LINK_ID, {});
  await loaded;

  ok(!tab.splitView, "A plain click should not create a split view");
  Assert.equal(
    gBrowser.tabs.length,
    tabCount,
    "A plain click should not open a tab"
  );

  await BrowserTestUtils.removeTab(tab);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_javascript_link_is_not_split() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.splitView.enable-link-click-split", true],
      ["zen.splitView.link-activation-method", "shift"],
      ["zen.glance.activation-method", "alt"],
      ["browser.link.alternative_click.block_javascript", true],
    ],
  });

  const sourceTab = await addLinkTab();
  const tabCount = gBrowser.tabs.length;

  // The javascript: link must be ignored entirely. Clicking the ordinary link
  // afterwards gives the test a deterministic point to check state at: only
  // that second click may have opened anything.
  await clickLink(sourceTab, JS_LINK_ID, { shiftKey: true });
  const activated = BrowserTestUtils.waitForEvent(
    window,
    "ZenViewSplitter:SplitViewActivated"
  );
  await clickLink(sourceTab, LINK_ID, { shiftKey: true });
  await activated;

  const newTab = gBrowser.selectedTab;
  Assert.equal(
    gBrowser.tabs.length,
    tabCount + 1,
    "Only the ordinary link should have opened a tab"
  );
  Assert.equal(
    newTab.linkedBrowser.currentURI.spec,
    LINK_URL,
    "The split should have been created from the ordinary link"
  );
  Assert.equal(
    sourceTab.group.tabs.length,
    2,
    "The split should contain exactly two tabs"
  );

  await removeSplitTabs([sourceTab, newTab]);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_glance_keeps_its_own_modifier() {
  // Both features bound to the same modifier: Glance owns the click and split
  // view has to stand down rather than race it.
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.splitView.enable-link-click-split", true],
      ["zen.splitView.link-activation-method", "shift"],
      ["zen.glance.enabled", true],
      ["zen.glance.activation-method", "shift"],
    ],
  });

  const tab = await addLinkTab();
  await clickLink(tab, LINK_ID, { shiftKey: true });
  await TestUtils.waitForCondition(
    () => tab.glanceTab,
    "Waiting for Glance to claim the click"
  );

  ok(!tab.splitView, "Split view should not claim Glance's modifier");

  await gZenGlanceManager.closeGlance({ onTabClose: true });
  await BrowserTestUtils.removeTab(tab);
  await SpecialPowers.popPrefEnv();
});
