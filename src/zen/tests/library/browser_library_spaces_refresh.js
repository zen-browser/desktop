/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const Library = customElements.get("zen-library");

const REFRESH_SETTLE_MS = 400;

function cardOf(section, uuid) {
  return section.querySelector(`.zen-library-space[data-uuid="${uuid}"]`);
}

function rowsOf(card) {
  return [...card.querySelector(".zen-library-space-tabs").children];
}

/**
 * Fires a tab event the way the sidebar does, from something that belongs to
 * the given space, without touching any real tab.
 *
 * @param {string} type - The event to fire
 * @param {string} uuid - The space it happened in
 */
async function fireFromSpace(type, uuid) {
  const stand = document.createXULElement("box");
  stand.setAttribute("zen-workspace-id", uuid);
  document.documentElement.appendChild(stand);
  stand.dispatchEvent(new CustomEvent(type, { bubbles: true }));
  stand.remove();
  /* eslint-disable mozilla/no-arbitrary-setTimeout */
  await new Promise(resolve => setTimeout(resolve, REFRESH_SETTLE_MS));
  /* eslint-enable mozilla/no-arbitrary-setTimeout */
}

add_task(async function test_a_change_is_only_built_for_the_space_it_is_in() {
  // Opening this view has the library size itself off the cards while the
  // cards size themselves off the library, which the platform reports as a
  // ResizeObserver loop. It happens with or without anything this test is
  // about (gh-16192), so it is not this test's business.
  ignoreAllUncaughtExceptions();
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.library.enabled", true],
      // The library remembers the tab it was last on, and the spaces view is
      // not what the tests after this one should open onto.
      ["zen.library.last-tab", "history"],
    ],
  });
  await gZenWorkspaces.promiseInitialized;
  const active = gZenWorkspaces.activeWorkspace;

  Library.toggle("spaces");
  const library = document.querySelector("zen-library");
  await TestUtils.waitForCondition(
    () =>
      Library.libraryProgress === 1 && !library.hasAttribute("transitioning"),
    "the library settles open"
  );
  const section = document.querySelector("zen-library-spaces-section");
  await section.updateComplete;

  const card = await TestUtils.waitForCondition(
    () => cardOf(section, active),
    "the space in view has a card"
  );
  await TestUtils.waitForCondition(
    () => rowsOf(card).length,
    "and the card is built"
  );

  Assert.ok(
    rowsOf(card).every(row => row.hasAttribute("zen-library-copy")),
    "what a card holds says it is a copy, so nothing takes one for a real tab"
  );

  // A change in a space with no card on screen is no reason to build
  // anything: with ten spaces, rebuilding them all for every tab event is
  // what runs the window out of memory.
  const before = rowsOf(card);
  await fireFromSpace("TabMove", "a-space-that-is-not-shown");
  Assert.deepEqual(
    rowsOf(card),
    before,
    "a change elsewhere leaves the built card exactly as it was"
  );

  // The space the card is for is built again, so it still follows along.
  await fireFromSpace("TabMove", active);
  const after = rowsOf(card);
  Assert.ok(
    after.length && after.some((row, index) => row !== before[index]),
    "a change in the space the card is for does build it again"
  );

  Library.toggle();
  await TestUtils.waitForCondition(
    () => !Library.isLibraryOpen && Library.libraryProgress === 0,
    "the library settles closed"
  );
  Assert.ok(
    !rowsOf(card).length,
    "closing the library gives up every copy it was holding"
  );

  // The library opens on the tab it was left on, and the tests after this
  // one should not be made to open this view.
  library.activeTab = "history";
  await library.updateComplete;
  await SpecialPowers.popPrefEnv();
});
