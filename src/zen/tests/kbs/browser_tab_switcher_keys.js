/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.ctrlTab.sortByRecentlyUsed", false]],
  });
  const tabs = [];
  for (let i = 0; i < 3; i++) {
    tabs.push(
      await BrowserTestUtils.openNewForegroundTab(
        gBrowser,
        `data:text/html,<title>Tab ${i}</title>`
      )
    );
  }
  registerCleanupFunction(async () => {
    CustomKeys.resetAll();
    for (const tab of tabs) {
      BrowserTestUtils.removeTab(tab);
    }
    await SpecialPowers.popPrefEnv();
  });
});

/**
 * Press a key and wait for the tab strip to be asked to move.
 *
 * @param {sinon.SinonStub} advance The stubbed advanceSelectedTab.
 * @param {string} key
 * @param {object} options
 * @returns {Promise<number>} The direction the tab strip was asked to move in.
 */
async function pressAndGetDirection(advance, key, options) {
  const calls = advance.callCount;
  EventUtils.synthesizeKey(key, options, window);
  await TestUtils.waitForCondition(
    () => advance.callCount > calls,
    `${key} to switch tabs`
  );
  return advance.lastCall.args[0];
}

async function pressAndExpectNothing(advance, key, options, message) {
  const calls = advance.callCount;
  EventUtils.synthesizeKey(key, options, window);
  await TestUtils.waitForTick();
  await TestUtils.waitForTick();
  is(advance.callCount, calls, message);
}

add_task(function test_tab_switcher_keys_have_defaults() {
  const expected = {
    "zen-tab-switcher-cycle": "VK_TAB",
    "zen-tab-switcher-next": "VK_PAGE_DOWN",
    "zen-tab-switcher-previous": "VK_PAGE_UP",
  };
  for (const [id, keycode] of Object.entries(expected)) {
    const keyEl = document.getElementById(id);
    ok(keyEl, `${id} exists`);
    is(keyEl.getAttribute("keycode"), keycode, `${id} has its default key`);
    is(
      keyEl.getAttribute("modifiers"),
      isMac ? "control" : "accel",
      `${id} uses Control`
    );
    is(keyEl.getAttribute("disabled"), "true", `${id} never fires itself`);
  }
});

add_task(async function test_customized_next_tab() {
  const sandbox = sinon.createSandbox();
  const advance = sandbox.stub(gBrowser.tabContainer, "advanceSelectedTab");
  try {
    is(
      await pressAndGetDirection(advance, "KEY_PageDown", { ctrlKey: true }),
      1,
      "Ctrl+Page Down moves to the next tab by default"
    );

    CustomKeys.changeKey("zen-tab-switcher-next", {
      modifiers: UNUSED_MODIFIERS,
      key: UNUSED_KEY,
    });
    is(
      await pressAndGetDirection(advance, UNUSED_KEY, UNUSED_OPTIONS),
      1,
      "The customized shortcut moves to the next tab"
    );
    await pressAndExpectNothing(
      advance,
      "KEY_PageDown",
      { ctrlKey: true },
      "Ctrl+Page Down no longer switches tabs"
    );
    is(
      await pressAndGetDirection(advance, "KEY_PageUp", { ctrlKey: true }),
      -1,
      "Previous tab keeps its default"
    );

    CustomKeys.resetKey("zen-tab-switcher-next");
    is(
      await pressAndGetDirection(advance, "KEY_PageDown", { ctrlKey: true }),
      1,
      "Ctrl+Page Down works again after a reset"
    );
  } finally {
    sandbox.restore();
    CustomKeys.resetAll();
  }
});

add_task(async function test_cleared_previous_tab() {
  const sandbox = sinon.createSandbox();
  const advance = sandbox.stub(gBrowser.tabContainer, "advanceSelectedTab");
  try {
    CustomKeys.clearKey("zen-tab-switcher-previous");
    await pressAndExpectNothing(
      advance,
      "KEY_PageUp",
      { ctrlKey: true },
      "A cleared shortcut does nothing"
    );
  } finally {
    sandbox.restore();
    CustomKeys.resetAll();
  }
});

add_task(async function test_customized_cycle() {
  const sandbox = sinon.createSandbox();
  const advance = sandbox.stub(gBrowser.tabContainer, "advanceSelectedTab");
  try {
    CustomKeys.changeKey("zen-tab-switcher-cycle", {
      modifiers: "alt",
      key: UNUSED_KEY,
    });
    is(
      await pressAndGetDirection(advance, UNUSED_KEY, { altKey: true }),
      1,
      "The customized shortcut cycles forward"
    );
    is(
      await pressAndGetDirection(advance, UNUSED_KEY, {
        altKey: true,
        shiftKey: true,
      }),
      -1,
      "and backwards with Shift"
    );
    await pressAndExpectNothing(
      advance,
      "KEY_Tab",
      { ctrlKey: true },
      "Ctrl+Tab no longer cycles"
    );

    CustomKeys.changeKey("zen-tab-switcher-cycle", {
      modifiers: UNUSED_MODIFIERS,
      key: UNUSED_KEY,
    });
    is(
      await pressAndGetDirection(advance, UNUSED_KEY, UNUSED_OPTIONS),
      1,
      "A shortcut that uses Shift itself still cycles forward"
    );
  } finally {
    sandbox.restore();
    CustomKeys.resetAll();
  }
});
