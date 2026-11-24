/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenTabArchiver } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenTabArchiver.sys.mjs"
);
const { TabStateFlusher } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/TabStateFlusher.sys.mjs"
);

const TIMEOUT_PREF = "zen.tabs.auto-archive.timeout-minutes";
const TIMEOUT_MINUTES = 12 * 60;
const MS_PER_MINUTE = 60 * 1000;

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({ set: [[TIMEOUT_PREF, TIMEOUT_MINUTES]] });
});

/**
 * Makes a tab look like nobody has opened it for longer than the timeout.
 *
 * @param {MozTabbrowserTab} tab - A tab that isn't selected
 */
function makeIdle(tab) {
  tab.updateLastAccessed(Date.now() - (TIMEOUT_MINUTES + 1) * MS_PER_MINUTE);
}

/**
 * @param {string} name - What the page is called
 * @returns {Promise<MozTabbrowserTab>} A background tab nobody has opened for
 *   longer than the timeout
 */
async function openIdleTab(name) {
  const tab = await addTab(`data:text/html,<title>${name}</title>`);
  makeIdle(tab);
  return tab;
}

/** @returns {string[]} The pages of the tabs this window has closed */
function closedTabUrls() {
  return SessionStore.getClosedTabData({ sourceWindow: window }).map(
    ({ state }) => state.entries[state.index - 1]?.url
  );
}

function removeTabs(...tabs) {
  for (const tab of tabs) {
    if (tab.isConnected && !tab.closing) {
      gBrowser.removeTab(tab, { animate: false, skipPermitUnload: true });
    }
  }
}

/**
 * Pins a tab, and waits for window sync to save its pinned state so the tab
 * isn't closed while that is still going on.
 *
 * @param {MozTabbrowserTab} tab - The tab to pin
 */
async function pinTab(tab) {
  gBrowser.pinTab(tab);
  await TestUtils.waitForCondition(
    () => tab._zenPinnedInitialState,
    "The pinned tab's state is saved"
  );
}

add_task(async function test_off_by_default() {
  is(
    Services.prefs.getDefaultBranch("").getIntPref(TIMEOUT_PREF),
    0,
    "Tabs are only archived once the user picks a time"
  );
  await SpecialPowers.pushPrefEnv({ set: [[TIMEOUT_PREF, 0]] });
  const tab = await openIdleTab("Off");

  Assert.deepEqual(ZenTabArchiver.sweep(), [], "Nothing is archived");
  ok(!tab.closing, "Not even a tab that has gone unopened for long");

  removeTabs(tab);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_archives_idle_tabs() {
  const idle = await openIdleTab("Idle");
  const recent = await addTab("data:text/html,<title>Recent</title>");
  const url = idle.linkedBrowser.currentURI.spec;
  await TabStateFlusher.flush(idle.linkedBrowser);

  const archived = ZenTabArchiver.sweep();

  ok(archived.includes(idle), "A tab unopened for that long is archived");
  ok(idle.closing, "Which closes it");
  ok(!archived.includes(recent) && !recent.closing, "A recent tab is kept");
  await TestUtils.waitForCondition(
    () => closedTabUrls().includes(url),
    "The archived tab is kept with the closed tabs, to reopen from the Archive"
  );

  removeTabs(recent);
});

add_task(async function test_keeps_pinned_and_selected_tabs() {
  const pinned = await openIdleTab("Pinned");
  await pinTab(pinned);
  const essential = await openIdleTab("Essential");
  await pinTab(essential);
  gZenPinnedTabManager.addToEssentials(essential);
  const multiselected = await openIdleTab("Multiselected");
  gBrowser.addToMultiSelectedTabs(multiselected);
  const tabs = [pinned, essential, multiselected];
  for (const tab of tabs) {
    makeIdle(tab);
  }

  const archived = ZenTabArchiver.sweep();

  for (const tab of tabs) {
    ok(!archived.includes(tab) && !tab.closing, `${tab.label} is kept`);
  }

  gBrowser.clearMultiSelectedTabs();
  removeTabs(...tabs);
});

add_task(async function test_unpinned_tab_gets_the_whole_timeout() {
  const tab = await openIdleTab("Unpinned");
  // The archiver remembers tabs by the id window sync gives them.
  await TestUtils.waitForCondition(() => tab.id, "The tab has its id");
  await pinTab(tab);
  ok(!ZenTabArchiver.sweep().includes(tab), "A pinned tab is kept");

  gBrowser.unpinTab(tab);
  makeIdle(tab);
  ok(
    !ZenTabArchiver.sweep().includes(tab),
    "Once unpinned, it isn't archived until it has been idle for the timeout"
  );

  removeTabs(tab);
});

add_task(async function test_keeps_tabs_in_use() {
  const tab = await openIdleTab("In use");
  for (const attribute of ["soundplaying", "pictureinpicture", "attention"]) {
    tab.setAttribute(attribute, "true");
    makeIdle(tab);
    ok(
      !ZenTabArchiver.sweep().includes(tab),
      `A tab with ${attribute} is kept`
    );
    tab.removeAttribute(attribute);
  }
  ok(!tab.closing, "The tab is still open");

  await SpecialPowers.spawn(tab.linkedBrowser, [], () => {
    content.addEventListener("beforeunload", event => event.preventDefault());
  });
  await TestUtils.waitForCondition(
    () => tab.linkedBrowser.hasBeforeUnload,
    "The page asks before it is left"
  );
  makeIdle(tab);
  ok(
    !ZenTabArchiver.sweep().includes(tab),
    "A page that would ask before it is left is kept"
  );

  removeTabs(tab);
});

add_task(async function test_archives_idle_tabs_in_other_spaces() {
  const firstSpace = gZenWorkspaces.getActiveWorkspace();
  const otherSpace = await gZenWorkspaces.createAndSaveWorkspace("Elsewhere");
  const tab = await openIdleTab("Elsewhere");
  is(
    tab.getAttribute("zen-workspace-id"),
    otherSpace.uuid,
    "The tab belongs to the new space"
  );
  await gZenWorkspaces.changeWorkspace(firstSpace);
  makeIdle(tab);

  ok(
    ZenTabArchiver.sweep().includes(tab),
    "Idle tabs are archived from spaces that aren't shown too"
  );

  await gZenWorkspaces.removeWorkspace(otherSpace.uuid);
});
