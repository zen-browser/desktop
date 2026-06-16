/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const {
  buildZenSplitCompanionSnapshot,
  renderZenSplitCompanionSnapshot,
} = ChromeUtils.importESModule(
  "chrome://browser/content/zen-components/ZenSplitCompanionPane.mjs",
  { global: "current" }
);

function fakeTab(attributes = {}, properties = {}) {
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

add_task(async function test_Split_Companion_Disabled_Does_Not_Build_Snapshot() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.splitCompanion.enabled", false],
      ["zen.splitCompanion.pane.visible", true],
      ["zen.splitCompanion.rightWeb.visible", true],
    ],
  });

  try {
    window.gZenSplitCompanionPane.destroy();
    window.gZenSplitCompanionPane.init();
    Assert.equal(
      window.gZenSplitCompanionPane.snapshot,
      null,
      "Disabled companion pane should not build tab snapshots"
    );
  } finally {
    window.gZenSplitCompanionPane.destroy();
    await SpecialPowers.popPrefEnv();
    window.gZenSplitCompanionPane.init();
  }
});

add_task(async function test_Split_Companion_Model_Maps_ReadOnly_Tab_State() {
  const activeWorkspaceId = "workspace-active";
  const inactiveTab = fakeTab(
    {
      "zen-workspace-id": "workspace-inactive",
      linkedpanel: "inactive-panel",
    },
    { label: "Inactive tab" }
  );
  const selectedPinnedTab = fakeTab(
    {
      "zen-workspace-id": activeWorkspaceId,
      image: "chrome://test/selected.svg",
      linkedpanel: "selected-panel",
      busy: "true",
      soundplaying: "true",
    },
    {
      label: "Selected pinned tab",
      pinned: true,
      _tPos: 3,
    }
  );
  const hiddenEssentialSplitTab = fakeTab(
    {
      "zen-workspace-id": activeWorkspaceId,
      "zen-essential": "true",
      hidden: "true",
      muted: "true",
      linkedpanel: "essential-panel",
      "split-view": "true",
    },
    {
      label: "Hidden essential split tab",
      closing: true,
      group: {
        id: "split-group",
        hasAttribute(name) {
          return name === "split-view-group";
        },
      },
      splitView: true,
      _tPos: 4,
    }
  );

  const snapshot = buildZenSplitCompanionSnapshot({
    browser: {
      selectedTab: selectedPinnedTab,
      tabs: [inactiveTab, selectedPinnedTab, hiddenEssentialSplitTab],
    },
    workspaceManager: {
      activeWorkspace: activeWorkspaceId,
      getWorkspaces() {
        return [
          { uuid: activeWorkspaceId, name: "Active Workspace" },
          { uuid: "workspace-inactive", name: "Inactive Workspace" },
        ];
      },
    },
  });

  Assert.equal(
    snapshot.activeWorkspace.id,
    activeWorkspaceId,
    "Snapshot records the active workspace"
  );
  Assert.deepEqual(
    snapshot.workspaces.map(workspace => ({
      id: workspace.id,
      name: workspace.name,
      active: workspace.active,
    })),
    [
      { id: activeWorkspaceId, name: "Active Workspace", active: true },
      { id: "workspace-inactive", name: "Inactive Workspace", active: false },
    ],
    "Snapshot maps the workspace list without exposing workspace objects"
  );
  Assert.deepEqual(
    snapshot.tabs.map(tab => tab.id),
    ["selected-panel", "essential-panel"],
    "Snapshot keeps ordered active-workspace tabs only"
  );

  const pinned = snapshot.tabs[0];
  Assert.equal(pinned.title, "Selected pinned tab", "Snapshot maps tab title");
  Assert.equal(
    pinned.favicon,
    "chrome://test/selected.svg",
    "Snapshot maps tab favicon/image"
  );
  Assert.ok(pinned.pinned, "Snapshot maps pinned state");
  Assert.ok(pinned.active, "Snapshot maps the selected tab as active");
  Assert.ok(pinned.busy, "Snapshot maps busy/loading state");
  Assert.ok(pinned.soundPlaying, "Snapshot maps sound-playing state");
  Assert.ok(!pinned.essential, "Pinned tab is not marked essential");
  Assert.ok(!pinned.hidden, "Pinned tab is not marked hidden");
  Assert.ok(!pinned.splitView, "Pinned tab is not marked split-view");

  const essential = snapshot.tabs[1];
  Assert.ok(essential.essential, "Snapshot maps essential state");
  Assert.ok(essential.hidden, "Snapshot maps hidden state");
  Assert.ok(essential.closing, "Snapshot maps closing state");
  Assert.ok(essential.splitView, "Snapshot maps split-view membership");
  Assert.equal(
    essential.splitViewGroupId,
    "split-group",
    "Snapshot maps split-view group identity"
  );
  Assert.ok(essential.muted, "Snapshot maps muted state");
  Assert.ok(
    !("tab" in essential),
    "Snapshot does not expose a source tab reference"
  );
  Assert.notEqual(
    essential,
    hiddenEssentialSplitTab,
    "Snapshot does not expose the source tab DOM node"
  );
});

add_task(
  async function test_Split_Companion_Model_Tolerates_Transient_Tab_Getter_Failures() {
    const activeWorkspaceId = "workspace-active";
    const throwingTab = fakeTab(
      {
        "zen-workspace-id": activeWorkspaceId,
        linkedpanel: "getter-panel",
        hidden: "true",
        closing: "true",
      },
      {}
    );

    for (const property of [
      "_tPos",
      "elementIndex",
      "group",
      "label",
      "linkedBrowser",
      "image",
      "pinned",
      "selected",
      "hidden",
      "closing",
      "busy",
      "pending",
      "muted",
      "soundPlaying",
      "activeMediaBlocked",
      "splitView",
      "splitViewValue",
    ]) {
      Object.defineProperty(throwingTab, property, {
        get() {
          throw new Error(`${property} unavailable`);
        },
      });
    }

    const snapshot = buildZenSplitCompanionSnapshot({
      browser: {
        selectedTab: null,
        tabs: [throwingTab],
      },
      workspaceManager: {
        activeWorkspace: activeWorkspaceId,
        getWorkspaces() {
          return [{ uuid: activeWorkspaceId, name: "Active Workspace" }];
        },
      },
    });

    Assert.equal(snapshot.tabs.length, 1, "Snapshot keeps the readable tab");
    Assert.equal(
      snapshot.tabs[0].id,
      "getter-panel",
      "Snapshot keeps readable tab identity"
    );
    Assert.equal(
      snapshot.tabs[0].position,
      0,
      "Snapshot falls back when tab position getters fail"
    );
    Assert.equal(
      snapshot.tabs[0].title,
      "",
      "Snapshot falls back when title getters fail"
    );
    Assert.ok(
      snapshot.tabs[0].hidden,
      "Snapshot still reads hidden state from attributes"
    );
    Assert.ok(
      snapshot.tabs[0].closing,
      "Snapshot still reads closing state from attributes"
    );
  }
);

add_task(async function test_Split_Companion_Rendering_Is_ReadOnly_Companion_DOM() {
  const host = document.createXULElement("vbox");
  const sourceTab = document.createXULElement("tab");
  sourceTab.id = "source-tab-node";
  sourceTab.className = "tabbrowser-tab";

  renderZenSplitCompanionSnapshot(host, {
    activeWorkspaceId: "workspace-active",
    activeWorkspace: {
      id: "workspace-active",
      name: "Active Workspace",
    },
    workspaces: [],
    tabs: [
      {
        id: "selected-panel",
        position: 2,
        workspaceId: "workspace-active",
        title: "Selected Busy Audio Tab",
        favicon: "chrome://test/selected.svg",
        image: "chrome://test/selected.svg",
        pinned: true,
        essential: false,
        active: true,
        selected: true,
        hidden: false,
        closing: false,
        busy: true,
        loading: true,
        pending: false,
        muted: false,
        soundPlaying: true,
        activeMediaBlocked: false,
        splitView: false,
        splitViewValue: "",
        splitViewGroupId: "",
        groupId: "group-a",
        groupLabel: "Research",
        sourceTab,
      },
      {
        id: "split-panel",
        position: 3,
        workspaceId: "workspace-active",
        title: "Hidden Essential Split Tab",
        favicon: "",
        image: "",
        pinned: false,
        essential: true,
        active: false,
        selected: false,
        hidden: true,
        closing: true,
        busy: false,
        loading: false,
        pending: true,
        muted: true,
        soundPlaying: false,
        activeMediaBlocked: true,
        splitView: true,
        splitViewValue: "right",
        splitViewGroupId: "split-group",
        groupId: "split-group",
        groupLabel: "Compare",
      },
    ],
  });

  const rows = host.querySelectorAll(".zen-split-companion-tab-row");
  Assert.equal(rows.length, 2, "Renderer creates one companion row per tab");
  Assert.equal(
    host.querySelectorAll(".tabbrowser-tab").length,
    0,
    "Renderer does not move or clone tabbrowser tab DOM"
  );
  Assert.equal(
    host.querySelectorAll("[id]").length,
    0,
    "Renderer avoids repeated/global ids inside generated content"
  );
  Assert.equal(
    sourceTab.parentNode,
    null,
    "Renderer leaves source tab nodes untouched"
  );

  const selectedRow = rows[0];
  Assert.equal(
    selectedRow.getAttribute("data-zen-tab-id"),
    "selected-panel",
    "Renderer records safe tab identity as data"
  );
  Assert.equal(
    selectedRow.getAttribute("aria-selected"),
    "true",
    "Renderer exposes selection state"
  );
  Assert.ok(selectedRow.hasAttribute("active"), "Renderer reflects active");
  Assert.ok(selectedRow.hasAttribute("selected"), "Renderer reflects selected");
  Assert.ok(selectedRow.hasAttribute("pinned"), "Renderer reflects pinned");
  Assert.ok(selectedRow.hasAttribute("busy"), "Renderer reflects busy");
  Assert.ok(selectedRow.hasAttribute("loading"), "Renderer reflects loading");
  Assert.ok(
    selectedRow.hasAttribute("soundplaying"),
    "Renderer reflects audio playback"
  );
  Assert.equal(
    selectedRow.querySelector(".zen-split-companion-tab-title").value,
    "Selected Busy Audio Tab",
    "Renderer writes the tab title into companion label DOM"
  );
  Assert.equal(
    selectedRow.querySelector(".zen-split-companion-tab-icon").getAttribute("src"),
    "chrome://test/selected.svg",
    "Renderer writes favicon/image state"
  );
  Assert.equal(
    selectedRow.querySelector(".zen-split-companion-tab-group-label").value,
    "Research",
    "Renderer shows the group label when available"
  );
  Assert.equal(selectedRow.tabIndex, -1, "Rows are not keyboard focus targets");

  const splitRow = rows[1];
  Assert.ok(splitRow.hasAttribute("zen-essential"), "Renderer reflects essential");
  Assert.ok(
    !splitRow.hasAttribute("hidden"),
    "Renderer does not hide companion rows with the native hidden attribute"
  );
  Assert.ok(
    splitRow.hasAttribute("data-zen-hidden"),
    "Renderer reflects hidden as companion-only state"
  );
  Assert.ok(splitRow.hasAttribute("closing"), "Renderer reflects closing");
  Assert.ok(splitRow.hasAttribute("pending"), "Renderer reflects pending");
  Assert.ok(splitRow.hasAttribute("muted"), "Renderer reflects muted");
  Assert.ok(
    splitRow.hasAttribute("activemedia-blocked"),
    "Renderer reflects blocked media"
  );
  Assert.ok(splitRow.hasAttribute("split-view"), "Renderer reflects split view");
  Assert.equal(
    splitRow.getAttribute("data-zen-split-view-group-id"),
    "split-group",
    "Renderer records split-view group identity"
  );
  Assert.equal(
    splitRow.getAttribute("data-zen-split-view-value"),
    "right",
    "Renderer records split-view value"
  );
  const splitIconStack = splitRow.querySelector(
    ".zen-split-companion-tab-icon-stack"
  );
  Assert.ok(
    splitIconStack.hasAttribute("icon-placeholder"),
    "Renderer marks missing favicons with the placeholder state"
  );
  Assert.equal(
    splitIconStack.querySelector(".zen-split-companion-tab-icon"),
    null,
    "Renderer should not append an empty favicon image over the placeholder"
  );
});
