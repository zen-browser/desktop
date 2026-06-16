/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { renderZenSplitCompanionSnapshot } = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/ZenSplitCompanionPane.mjs",
  { global: "current" }
);

async function pushCompanionWorkspacePrefs() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.splitCompanion.enabled", true],
      ["zen.splitCompanion.pane.visible", true],
      ["zen.splitCompanion.rightWeb.visible", true],
    ],
  });
}

function nextCompanionWorkspaceRefreshFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

async function flushWorkspaceSwitchPromiseHandlers() {
  await Promise.resolve();
  await Promise.resolve();
}

function dispatchCompanionKey(target, key, options = {}) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key,
  });
  if (options.defaultPrevented) {
    event.preventDefault();
  }
  target.dispatchEvent(event);
  return event;
}

function createDeferred() {
  let reject;
  const promise = new Promise((_, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

function fakeWorkspaceClickTab(attributes = {}, properties = {}) {
  const attrs = new Map(Object.entries(attributes));
  const setAttributeCalls = [];
  return {
    ...properties,
    setAttribute(name, value) {
      setAttributeCalls.push({ name, value });
      attrs.set(name, String(value));
    },
    hasAttribute(name) {
      return attrs.has(name);
    },
    getAttribute(name) {
      return attrs.get(name) ?? null;
    },
    getSetAttributeCalls() {
      return setAttributeCalls;
    },
  };
}

async function withRenderedWorkspaceControls(changeWorkspaceWithID, task) {
  const companionPane = window.gZenSplitCompanionPane;
  const originalBrowser = window.gBrowser;
  const originalWorkspaceManager = window.gZenWorkspaces;
  const originalSplitter = window.gZenViewSplitter;
  let activeWorkspaceSetCount = 0;
  let activeWorkspaceValue = "workspace-active";
  let pushedPrefEnv = false;
  const activeTab = fakeWorkspaceClickTab(
    {
      "zen-workspace-id": "workspace-active",
      linkedpanel: "active-panel",
    },
    {
      label: "Active tab",
      _tPos: 0,
    }
  );
  const targetTab = fakeWorkspaceClickTab(
    {
      "zen-workspace-id": "workspace-target",
      linkedpanel: "target-panel",
    },
    {
      label: "Target tab",
      _tPos: 1,
    }
  );
  const workspaceManager = {
    get activeWorkspace() {
      return activeWorkspaceValue;
    },
    set activeWorkspace(value) {
      activeWorkspaceSetCount++;
      activeWorkspaceValue = value;
    },
    getWorkspaces() {
      return [
        { uuid: "workspace-active", name: "Active Space", icon: "A" },
        { uuid: "workspace-target", name: "Target Space", icon: "T" },
      ];
    },
    changeWorkspaceWithID,
  };

  try {
    companionPane.destroy();
    window.gBrowser = {
      selectedTab: activeTab,
      tabs: [activeTab, targetTab],
    };
    window.gZenWorkspaces = workspaceManager;
    window.gZenViewSplitter = {
      setRightSplitTab() {
        throw new Error("workspace click should not use split tab routing");
      },
    };

    await pushCompanionWorkspacePrefs();
    pushedPrefEnv = true;
    companionPane.init();
    await nextCompanionWorkspaceRefreshFrame();

    const host = document.getElementById("zen-split-companion-pane");
    await task({
      activeTab,
      host,
      targetTab,
      activeWorkspaceSetCount: () => activeWorkspaceSetCount,
      activeWorkspaceValue: () => activeWorkspaceValue,
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

add_task(async function test_Split_Companion_Renders_Workspace_Controls_From_Snapshot() {
  const host = document.createXULElement("vbox");
  const nativeWorkspaceNode = document.createXULElement("toolbarbutton");
  nativeWorkspaceNode.id = "native-workspace-node";
  nativeWorkspaceNode.className = "zen-workspace-button";

  renderZenSplitCompanionSnapshot(host, {
    activeWorkspaceId: "workspace-active",
    activeWorkspace: {
      id: "workspace-active",
      name: "Active Space",
      active: true,
    },
    workspaces: [
      {
        id: "workspace-active",
        name: "Active Space",
        active: true,
        icon: "A",
        position: 0,
        sourceNode: nativeWorkspaceNode,
      },
      {
        id: "workspace-target",
        name: "Target Space",
        active: false,
        icon: "T",
        position: 1,
      },
    ],
    tabs: [],
  });

  const rows = host.querySelectorAll(".zen-split-companion-workspace-row");
  is(rows.length, 2, "Renderer creates one companion-owned row per workspace");
  is(
    host.querySelectorAll(".zen-workspace-button").length,
    0,
    "Renderer does not move or clone native workspace DOM"
  );
  is(
    host.querySelectorAll("[id]").length,
    0,
    "Renderer avoids repeated/global ids in workspace controls"
  );
  is(
    nativeWorkspaceNode.parentNode,
    null,
    "Renderer leaves source workspace nodes untouched"
  );

  const activeRow = rows[0];
  is(
    activeRow.getAttribute("data-zen-workspace-id"),
    "workspace-active",
    "Workspace controls keep identity as companion-owned data"
  );
  ok(
    activeRow.hasAttribute("data-zen-workspace-active"),
    "Active workspace is marked with companion-owned state"
  );
  is(
    activeRow.getAttribute("aria-current"),
    "true",
    "Active workspace exposes current state"
  );
  is(
    activeRow.querySelector(".zen-split-companion-workspace-name").value,
    "Active Space",
    "Workspace controls render the workspace name"
  );
  is(
    activeRow.querySelector(".zen-split-companion-workspace-icon").value,
    "A",
    "Workspace controls render the workspace icon text"
  );
  is(
    host.querySelector("[zen-workspace-id]"),
    null,
    "Workspace controls do not write native workspace attributes"
  );
});

add_task(async function test_Split_Companion_Workspace_Click_Delegates_To_Manager() {
  const calls = [];
  await withRenderedWorkspaceControls((workspaceId, options) => {
    calls.push({ workspaceId, options });
  }, async ({ activeTab, host, targetTab, activeWorkspaceSetCount }) => {
    const row = host.querySelector('[data-zen-workspace-id="workspace-target"]');
    ok(row, "Companion pane should render the target workspace row");

    EventUtils.synthesizeMouseAtCenter(row, {});

    is(calls.length, 1, "Workspace click should call changeWorkspaceWithID once");
    is(
      calls[0].workspaceId,
      "workspace-target",
      "Workspace click should delegate the target workspace id"
    );
    is(
      calls[0].options?.source,
      "split-companion-pane",
      "Workspace click should include companion source context"
    );
    is(
      activeWorkspaceSetCount(),
      0,
      "Workspace click should not assign gZenWorkspaces.activeWorkspace directly"
    );
    is(
      activeTab
        .getSetAttributeCalls()
        .filter(call => call.name === "zen-workspace-id").length,
      0,
      "Workspace click should not write native workspace attributes on active tabs"
    );
    is(
      targetTab
        .getSetAttributeCalls()
        .filter(call => call.name === "zen-workspace-id").length,
      0,
      "Workspace click should not write native workspace attributes on target tabs"
    );
    ok(
      !row.hasAttribute("data-zen-workspace-switch-failed"),
      "Successful workspace switch should not mark failure"
    );
  });
});

add_task(async function test_Split_Companion_Workspace_Keyboard_Delegates_To_Manager() {
  for (const key of ["VK_RETURN", "VK_SPACE"]) {
    const calls = [];
    await withRenderedWorkspaceControls((workspaceId, options) => {
      calls.push({ workspaceId, options });
    }, async ({ host, activeWorkspaceSetCount }) => {
      const row = host.querySelector(
        '[data-zen-workspace-id="workspace-target"]'
      );
      ok(row, "Companion pane should render the target workspace row");

      row.focus();
      EventUtils.synthesizeKey(key);

      is(
        calls.length,
        1,
        `${key} should call changeWorkspaceWithID exactly once`
      );
      is(
        calls[0].workspaceId,
        "workspace-target",
        `${key} should delegate the target workspace id`
      );
      is(
        calls[0].options?.source,
        "split-companion-pane",
        `${key} should include companion source context`
      );
      is(
        activeWorkspaceSetCount(),
        0,
        `${key} should not assign gZenWorkspaces.activeWorkspace directly`
      );
    });
  }
});

add_task(async function test_Split_Companion_Workspace_Keyboard_Ignores_Non_Activation_Keys() {
  const calls = [];
  await withRenderedWorkspaceControls((workspaceId, options) => {
    calls.push({ workspaceId, options });
  }, async ({ host }) => {
    const row = host.querySelector('[data-zen-workspace-id="workspace-target"]');
    ok(row, "Companion pane should render the target workspace row");

    row.focus();
    for (const key of ["Escape", "ArrowDown", "a"]) {
      const event = dispatchCompanionKey(row, key);

      is(
        calls.length,
        0,
        `${key} should not call changeWorkspaceWithID`
      );
      ok(!event.defaultPrevented, `${key} should not prevent default`);
    }
  });
});

add_task(async function test_Split_Companion_Workspace_Keyboard_Ignores_Default_Prevented_Activation_Keys() {
  for (const key of ["Enter", " ", "Spacebar"]) {
    const calls = [];
    await withRenderedWorkspaceControls((workspaceId, options) => {
      calls.push({ workspaceId, options });
    }, async ({ host }) => {
      const row = host.querySelector(
        '[data-zen-workspace-id="workspace-target"]'
      );
      ok(row, "Companion pane should render the target workspace row");

      row.focus();
      const event = dispatchCompanionKey(row, key, {
        defaultPrevented: true,
      });

      ok(event.defaultPrevented, `${key} should remain default-prevented`);
      is(
        calls.length,
        0,
        `${key} should not call changeWorkspaceWithID when defaultPrevented`
      );
    });
  }
});

add_task(async function test_Split_Companion_Workspace_Keyboard_Ignores_Companion_Tab_Rows() {
  for (const key of ["Enter", " ", "Spacebar"]) {
    const calls = [];
    await withRenderedWorkspaceControls((workspaceId, options) => {
      calls.push({ workspaceId, options });
    }, async ({ host }) => {
      const row = host.querySelector('[data-zen-tab-id="active-panel"]');
      ok(row, "Companion pane should render a companion tab row");
      ok(
        !row.classList.contains("zen-split-companion-workspace-row"),
        "Companion tab row should not be a workspace row"
      );

      row.focus();
      dispatchCompanionKey(row, key);

      is(
        calls.length,
        0,
        `${key} on a companion tab row should not call changeWorkspaceWithID`
      );
    });
  }
});

add_task(async function test_Split_Companion_Active_Workspace_Click_Is_NoOp() {
  const calls = [];
  await withRenderedWorkspaceControls((workspaceId, options) => {
    calls.push({ workspaceId, options });
  }, async ({ host, activeWorkspaceSetCount, activeWorkspaceValue }) => {
    const row = host.querySelector('[data-zen-workspace-id="workspace-active"]');
    ok(row, "Companion pane should render the active workspace row");

    EventUtils.synthesizeMouseAtCenter(row, {});

    is(calls.length, 0, "Clicking the active workspace should not switch");
    is(
      activeWorkspaceSetCount(),
      0,
      "Active workspace no-op should not assign activeWorkspace directly"
    );
    is(
      activeWorkspaceValue(),
      "workspace-active",
      "Active workspace no-op should leave manager state unchanged"
    );
  });
});

add_task(async function test_Split_Companion_Workspace_Failure_Stays_Companion_Owned() {
  await withRenderedWorkspaceControls(() => {
    throw new Error("workspace switch rejected");
  }, async ({ host, activeWorkspaceSetCount, activeWorkspaceValue }) => {
    const row = host.querySelector('[data-zen-workspace-id="workspace-target"]');
    ok(row, "Companion pane should render the target workspace row");

    EventUtils.synthesizeMouseAtCenter(row, {});

    ok(
      row.hasAttribute("data-zen-workspace-switch-failed"),
      "Thrown workspace switches should mark companion-owned failure state"
    );
    is(
      row.getAttribute("data-zen-workspace-switch-error"),
      "Error",
      "Thrown workspace switches should expose a safe error name"
    );
    ok(
      !row.hasAttribute("data-zen-workspace-active"),
      "Failure handling should not mark the target row active"
    );
    is(
      row.getAttribute("aria-current"),
      "false",
      "Failure handling should not change rendered active state"
    );
    is(
      activeWorkspaceSetCount(),
      0,
      "Failure handling should not assign activeWorkspace directly"
    );
    is(
      activeWorkspaceValue(),
      "workspace-active",
      "Failure handling should leave manager state unchanged"
    );
  });
});

add_task(async function test_Split_Companion_Workspace_Rejection_Stays_Companion_Owned() {
  await withRenderedWorkspaceControls(
    () => Promise.reject(new DOMException("denied", "InvalidStateError")),
    async ({ host }) => {
      const row = host.querySelector('[data-zen-workspace-id="workspace-target"]');
      ok(row, "Companion pane should render the target workspace row");

      EventUtils.synthesizeMouseAtCenter(row, {});
      await flushWorkspaceSwitchPromiseHandlers();

      ok(
        row.hasAttribute("data-zen-workspace-switch-failed"),
        "Rejected workspace switches should mark companion-owned failure state"
      );
      is(
        row.getAttribute("data-zen-workspace-switch-error"),
        "InvalidStateError",
        "Rejected workspace switches should expose a safe error name"
      );
    }
  );
});

add_task(async function test_Split_Companion_Workspace_Rejection_Marks_Current_Rendered_Row() {
  const deferred = createDeferred();
  await withRenderedWorkspaceControls(
    () => deferred.promise,
    async ({ host }) => {
      const originalRow = host.querySelector(
        '[data-zen-workspace-id="workspace-target"]'
      );
      ok(originalRow, "Companion pane should render the target workspace row");

      EventUtils.synthesizeMouseAtCenter(originalRow, {});
      renderZenSplitCompanionSnapshot(host, {
        activeWorkspaceId: "workspace-active",
        activeWorkspace: {
          id: "workspace-active",
          name: "Active Space",
          active: true,
        },
        workspaces: [
          {
            id: "workspace-active",
            name: "Active Space",
            active: true,
            icon: "A",
            position: 0,
          },
          {
            id: "workspace-target",
            name: "Target Space",
            active: false,
            icon: "T",
            position: 1,
          },
        ],
        tabs: [],
      });
      const currentRow = host.querySelector(
        '[data-zen-workspace-id="workspace-target"]'
      );
      ok(currentRow, "Companion pane should render a replacement target row");
      ok(
        currentRow !== originalRow,
        "Companion pane replacement row should be a different element"
      );

      deferred.reject(new DOMException("denied", "InvalidStateError"));
      await flushWorkspaceSwitchPromiseHandlers();

      ok(
        !originalRow.hasAttribute("data-zen-workspace-switch-failed"),
        "Rejected stale row should not receive companion failure state"
      );
      ok(
        currentRow.hasAttribute("data-zen-workspace-switch-failed"),
        "Rejected workspace switches should mark the current companion row"
      );
      is(
        currentRow.getAttribute("data-zen-workspace-switch-error"),
        "InvalidStateError",
        "Rejected workspace switches should expose a safe error name"
      );
      ok(
        !currentRow.hasAttribute("data-zen-workspace-active"),
        "Failure handling should not mark the replacement target row active"
      );
      is(
        host.querySelector("[zen-workspace-id]"),
        null,
        "Failure handling should not write native workspace attributes"
      );
    }
  );
});
