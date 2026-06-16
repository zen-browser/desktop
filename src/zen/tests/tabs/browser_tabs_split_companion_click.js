/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function pushCompanionClickPrefs() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.splitCompanion.enabled", true],
      ["zen.splitCompanion.pane.visible", true],
      ["zen.splitCompanion.rightWeb.visible", true],
    ],
  });
}

function nextCompanionClickRefreshFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

function fakeCompanionClickTab(attributes = {}, properties = {}) {
  const attrs = new Map(Object.entries(attributes));
  return {
    ...properties,
    hasAttribute(name) {
      return attrs.has(name);
    },
    getAttribute(name) {
      return attrs.get(name) ?? null;
    },
  };
}

async function withRenderedCompanionRows(splitterResult, task) {
  const companionPane = window.gZenSplitCompanionPane;
  const originalBrowser = window.gBrowser;
  const originalWorkspaceManager = window.gZenWorkspaces;
  const originalSplitter = window.gZenViewSplitter;
  let pushedPrefEnv = false;
  const baseTab = fakeCompanionClickTab(
    {
      linkedpanel: "base-panel",
    },
    {
      label: "Base tab",
      _tPos: 0,
    }
  );
  const rightTab = fakeCompanionClickTab(
    {
      linkedpanel: "right-panel",
    },
    {
      label: "Right candidate",
      _tPos: 1,
    }
  );
  const calls = [];
  let selectedTabValue = baseTab;
  let selectedTabSetCount = 0;
  const browser = {
    tabs: [baseTab, rightTab],
    get selectedTab() {
      return selectedTabValue;
    },
    set selectedTab(tab) {
      selectedTabSetCount++;
      selectedTabValue = tab;
    },
  };
  const splitter = {
    setRightSplitTab(tab, options) {
      calls.push({ tab, options });
      return splitterResult;
    },
  };

  try {
    companionPane.destroy();
    window.gBrowser = browser;
    window.gZenWorkspaces = null;
    window.gZenViewSplitter = splitter;

    await pushCompanionClickPrefs();
    pushedPrefEnv = true;
    companionPane.init();
    await nextCompanionClickRefreshFrame();

    const host = document.getElementById("zen-split-companion-pane");
    await task({
      baseTab,
      calls,
      host,
      rightTab,
      selectedTabSetCount: () => selectedTabSetCount,
      selectedTabValue: () => selectedTabValue,
    });
  } finally {
    companionPane.destroy();
    if (pushedPrefEnv) {
      await SpecialPowers.popPrefEnv();
    }
    window.gBrowser = originalBrowser;
    window.gZenWorkspaces = originalWorkspaceManager;
    window.gZenViewSplitter = originalSplitter;
    companionPane.init();
  }
}

add_task(async function test_Split_Companion_Click_Delegates_To_Right_Split_API() {
  await withRenderedCompanionRows({ ok: true, action: "set-right-tab" }, async ({
    baseTab,
    calls,
    host,
    rightTab,
    selectedTabSetCount,
    selectedTabValue,
  }) => {
    const row = host.querySelector('[data-zen-tab-id="right-panel"]');
    ok(row, "Companion pane should render the right candidate row");

    EventUtils.synthesizeMouseAtCenter(row, {});

    is(
      calls.length,
      1,
      "Clicking a companion row should call the Split View right-tab API once"
    );
    is(
      calls[0].tab,
      rightTab,
      "Companion row identity should resolve back to the live tab"
    );
    is(
      calls[0].options?.baseTab,
      baseTab,
      "Companion row clicks should pass the currently selected tab as API context"
    );
    is(
      selectedTabSetCount(),
      0,
      "Companion click handling should not assign gBrowser.selectedTab directly"
    );
    is(
      selectedTabValue(),
      baseTab,
      "Companion click handling should leave browser selection unchanged"
    );
    ok(
      !row.hasAttribute("data-zen-split-action-failed"),
      "Successful companion actions should not mark the row as failed"
    );
    ok(
      !row.hasAttribute("data-zen-split-action-error"),
      "Successful companion actions should not leave an error reason"
    );
  });
});

add_task(async function test_Split_Companion_Click_Failure_Stays_Companion_Owned() {
  await withRenderedCompanionRows(
    { ok: false, reason: "right-split-unavailable" },
    async ({
      baseTab,
      calls,
      host,
      rightTab,
      selectedTabSetCount,
      selectedTabValue,
    }) => {
      const row = host.querySelector('[data-zen-tab-id="right-panel"]');
      ok(row, "Companion pane should render the right candidate row");

      EventUtils.synthesizeMouseAtCenter(row, {});

      is(
        calls.length,
        1,
        "Failing companion row clicks should still delegate to the Split View API"
      );
      is(
        calls[0].tab,
        rightTab,
        "Failure handling should use the live tab resolved from row identity"
      );
      is(
        selectedTabSetCount(),
        0,
        "Failure handling should not assign gBrowser.selectedTab directly"
      );
      is(
        selectedTabValue(),
        baseTab,
        "Failure handling should leave browser selection unchanged"
      );
      ok(
        row.hasAttribute("data-zen-split-action-failed"),
        "Failure handling should mark companion-owned row state only"
      );
      is(
        row.getAttribute("data-zen-split-action-error"),
        "right-split-unavailable",
        "Failure handling should expose the API reason on companion-owned DOM"
      );
      ok(
        !row.hasAttribute("selected"),
        "Failure handling should not make the candidate row selected"
      );
      is(
        row.getAttribute("aria-selected"),
        "false",
        "Failure handling should not change the rendered selection state"
      );
    }
  );
});

add_task(async function test_Split_Companion_Click_Requires_Stable_Row_Identity() {
  await withRenderedCompanionRows({ ok: true, action: "set-right-tab" }, async ({
    baseTab,
    calls,
    host,
    selectedTabSetCount,
    selectedTabValue,
  }) => {
    const row = host.querySelector('[data-zen-tab-id="right-panel"]');
    ok(row, "Companion pane should render the right candidate row");

    row.setAttribute("data-zen-tab-id", "stale-panel");
    EventUtils.synthesizeMouseAtCenter(row, {});

    is(
      calls.length,
      0,
      "A stale stable row identity should not fall back to row position"
    );
    is(
      row.getAttribute("data-zen-split-action-error"),
      "tab-not-found",
      "A stale stable row identity should mark a companion-owned not-found failure"
    );
    is(
      selectedTabSetCount(),
      0,
      "A stale stable row identity should not assign gBrowser.selectedTab"
    );
    is(
      selectedTabValue(),
      baseTab,
      "A stale stable row identity should leave browser selection unchanged"
    );
    ok(
      !row.hasAttribute("selected"),
      "A stale stable row identity should not select the companion row"
    );
    is(
      row.getAttribute("aria-selected"),
      "false",
      "A stale stable row identity should leave rendered selection state unchanged"
    );

    row.removeAttribute("data-zen-tab-id");
    EventUtils.synthesizeMouseAtCenter(row, {});

    is(
      calls.length,
      0,
      "A missing stable row identity should not fall back to row position"
    );
    is(
      row.getAttribute("data-zen-split-action-error"),
      "tab-not-found",
      "A missing stable row identity should mark a companion-owned not-found failure"
    );
    is(
      selectedTabSetCount(),
      0,
      "A missing stable row identity should not assign gBrowser.selectedTab"
    );
    is(
      selectedTabValue(),
      baseTab,
      "A missing stable row identity should leave browser selection unchanged"
    );
  });
});

add_task(async function test_Split_Companion_Click_Listener_Moves_To_Replaced_Host() {
  await withRenderedCompanionRows({ ok: true, action: "set-right-tab" }, async ({
    calls,
    host,
    rightTab,
  }) => {
    const originalHost = host;
    const staleRow = originalHost.querySelector('[data-zen-tab-id="right-panel"]');
    const replacementHost = originalHost.cloneNode(true);

    ok(staleRow, "Original companion host should have a rendered row");
    originalHost.replaceWith(replacementHost);
    window.gZenSplitCompanionPane.init();
    await nextCompanionClickRefreshFrame();

    staleRow.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    );
    is(
      calls.length,
      0,
      "Reinitializing with a replaced host should detach the old click listener"
    );

    const replacementRow = replacementHost.querySelector(
      '[data-zen-tab-id="right-panel"]'
    );
    ok(replacementRow, "Replacement companion host should have a rendered row");

    EventUtils.synthesizeMouseAtCenter(replacementRow, {});

    is(
      calls.length,
      1,
      "Reinitializing with a replaced host should attach the current click listener"
    );
    is(
      calls[0].tab,
      rightTab,
      "Replacement host clicks should delegate using the live tab identity"
    );
  });
});
