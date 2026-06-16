/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZEN_SPLIT_COMPANION_REFRESH_EVENTS } = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/ZenSplitCompanionPane.mjs",
  { global: "current" }
);

async function pushCompanionPrefs(enabled, paneVisible, rightWebVisible) {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.splitCompanion.enabled", enabled],
      ["zen.splitCompanion.pane.visible", paneVisible],
      ["zen.splitCompanion.rightWeb.visible", rightWebVisible],
    ],
  });
}

function nextCompanionRefreshFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

function makeCompanionListenerOwner({
  addName,
  removeName,
  addCalls,
  removeCalls,
}) {
  return {
    [addName](listener) {
      addCalls.push(listener);
    },
    [removeName](listener) {
      removeCalls.push(listener);
    },
  };
}

add_task(async function test_Split_Companion_Refresh_Listeners_Are_Lifecycle_Gated() {
  const companionPane = window.gZenSplitCompanionPane;
  const host = document.getElementById("zen-split-companion-pane");
  const originalBuildSnapshot = companionPane.buildSnapshot;
  const originalBrowser = window.gBrowser;
  const originalWorkspaceManager = window.gZenWorkspaces;
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;
  const originalAddEventListenerDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "addEventListener"
  );
  const originalRemoveEventListenerDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "removeEventListener"
  );
  const capturedWindowRefreshListeners = new Map(
    ZEN_SPLIT_COMPANION_REFRESH_EVENTS.map(eventName => [eventName, new Set()])
  );
  const workspaceAddCalls = [];
  const workspaceRemoveCalls = [];
  const tabsProgressAddCalls = [];
  const tabsProgressRemoveCalls = [];
  const workspaceManager = makeCompanionListenerOwner({
    addName: "addChangeListeners",
    removeName: "removeChangeListeners",
    addCalls: workspaceAddCalls,
    removeCalls: workspaceRemoveCalls,
  });
  const browser = makeCompanionListenerOwner({
    addName: "addTabsProgressListener",
    removeName: "removeTabsProgressListener",
    addCalls: tabsProgressAddCalls,
    removeCalls: tabsProgressRemoveCalls,
  });
  let pushedPrefEnvs = 0;
  let refreshes = 0;

  async function pushTrackedCompanionPrefs(enabled, paneVisible, rightWebVisible) {
    await pushCompanionPrefs(enabled, paneVisible, rightWebVisible);
    pushedPrefEnvs++;
  }

  function dispatchCapturedWindowRefreshEvents(...eventNames) {
    for (const eventName of eventNames) {
      for (const listener of capturedWindowRefreshListeners.get(eventName)) {
        listener.call(window, new CustomEvent(eventName));
      }
    }
  }

  companionPane.buildSnapshot = function () {
    refreshes++;
    return {
      activeWorkspaceId: "workspace-sync",
      activeWorkspace: {
        id: "workspace-sync",
        name: `Workspace Sync ${refreshes}`,
      },
      workspaces: [],
      tabs: [
        {
          id: `sync-tab-${refreshes}`,
          position: refreshes,
          workspaceId: "workspace-sync",
          title: `Synchronized Tab ${refreshes}`,
          favicon: "",
          image: "",
          pinned: false,
          essential: false,
          active: true,
          selected: true,
          hidden: false,
          closing: false,
          busy: false,
          loading: false,
          pending: false,
          muted: false,
          soundPlaying: false,
          activeMediaBlocked: false,
          splitView: false,
          splitViewValue: "",
          splitViewGroupId: "",
          groupId: "",
          groupLabel: "",
        },
      ],
    };
  };

  try {
    companionPane.destroy();
    window.gZenWorkspaces = workspaceManager;
    window.gBrowser = browser;
    window.addEventListener = function (type, listener, options) {
      const capturedListeners = capturedWindowRefreshListeners.get(type);
      if (capturedListeners) {
        capturedListeners.add(listener);
        return;
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
    window.removeEventListener = function (type, listener, options) {
      const capturedListeners = capturedWindowRefreshListeners.get(type);
      if (capturedListeners) {
        capturedListeners.delete(listener);
        return;
      }
      return originalRemoveEventListener.call(this, type, listener, options);
    };

    await pushTrackedCompanionPrefs(true, true, true);
    companionPane.init();
    companionPane.init();
    await nextCompanionRefreshFrame();

    is(refreshes, 1, "Visible companion pane should build its initial snapshot");
    is(
      workspaceAddCalls.length,
      1,
      "Repeated init should attach one workspace change listener"
    );
    is(
      tabsProgressAddCalls.length,
      1,
      "Repeated init should attach one tabs progress listener"
    );

    dispatchCapturedWindowRefreshEvents(...ZEN_SPLIT_COMPANION_REFRESH_EVENTS);
    workspaceAddCalls[0]();
    tabsProgressAddCalls[0].onLocationChange();
    tabsProgressAddCalls[0].onStateChange();
    tabsProgressAddCalls[0].onLinkIconAvailable();

    is(
      refreshes,
      1,
      "Refresh signals should not rebuild synchronously"
    );
    await nextCompanionRefreshFrame();
    is(
      refreshes,
      2,
      "Window, workspace, and tab progress signals in one frame should coalesce"
    );
    is(
      host.querySelector(".zen-split-companion-tab-title").value,
      `Synchronized Tab ${refreshes}`,
      "Refresh events should render the latest read-only snapshot"
    );

    await pushTrackedCompanionPrefs(true, false, true);
    await nextCompanionRefreshFrame();
    const hiddenRefreshes = refreshes;
    dispatchCapturedWindowRefreshEvents(...ZEN_SPLIT_COMPANION_REFRESH_EVENTS);
    workspaceAddCalls[0]();
    tabsProgressAddCalls[0].onLocationChange();
    await nextCompanionRefreshFrame();
    is(
      refreshes,
      hiddenRefreshes,
      "Hidden companion pane should ignore all refresh listener signals"
    );
    is(
      host.querySelector(".zen-split-companion-render"),
      null,
      "Hidden companion pane should clear rendered snapshot DOM"
    );

    await pushTrackedCompanionPrefs(false, true, true);
    await nextCompanionRefreshFrame();
    const disabledRefreshes = refreshes;
    dispatchCapturedWindowRefreshEvents(...ZEN_SPLIT_COMPANION_REFRESH_EVENTS);
    workspaceAddCalls[0]();
    tabsProgressAddCalls[0].onLocationChange();
    await nextCompanionRefreshFrame();
    is(
      refreshes,
      disabledRefreshes,
      "Disabled companion pane should ignore all refresh listener signals"
    );

    await pushTrackedCompanionPrefs(true, true, true);
    await nextCompanionRefreshFrame();
    const beforeCanceledRefresh = refreshes;
    dispatchCapturedWindowRefreshEvents("TabOpen");
    window.gZenWorkspaces = null;
    window.gBrowser = null;
    companionPane.destroy();
    await nextCompanionRefreshFrame();
    is(
      refreshes,
      beforeCanceledRefresh,
      "Destroy should cancel a pending scheduled refresh"
    );
    is(
      workspaceRemoveCalls.length,
      1,
      "Destroy should remove workspace listeners from the attached owner"
    );
    is(
      workspaceRemoveCalls[0],
      workspaceAddCalls[0],
      "Destroy should remove the exact workspace listener that was attached"
    );
    is(
      tabsProgressRemoveCalls.length,
      1,
      "Destroy should remove tabs progress listeners from the attached owner"
    );
    is(
      tabsProgressRemoveCalls[0],
      tabsProgressAddCalls[0],
      "Destroy should remove the exact tabs progress listener that was attached"
    );

    companionPane.destroy();
    is(
      workspaceRemoveCalls.length,
      1,
      "Repeated destroy should not remove workspace listeners twice"
    );
    is(
      tabsProgressRemoveCalls.length,
      1,
      "Repeated destroy should not remove tabs progress listeners twice"
    );
  } finally {
    window.gZenWorkspaces = originalWorkspaceManager;
    window.gBrowser = originalBrowser;
    companionPane.buildSnapshot = originalBuildSnapshot;
    companionPane.destroy();
    if (originalAddEventListenerDescriptor) {
      Object.defineProperty(
        window,
        "addEventListener",
        originalAddEventListenerDescriptor
      );
    } else {
      delete window.addEventListener;
    }
    if (originalRemoveEventListenerDescriptor) {
      Object.defineProperty(
        window,
        "removeEventListener",
        originalRemoveEventListenerDescriptor
      );
    } else {
      delete window.removeEventListener;
    }
    while (pushedPrefEnvs > 0) {
      await SpecialPowers.popPrefEnv();
      pushedPrefEnvs--;
    }
    companionPane.init();
  }
});
