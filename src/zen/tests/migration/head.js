/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenMigrationUtils } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenMigrationUtils.sys.mjs"
);

function buildArcSidebar() {
  const items = [];
  const push = item => items.push(item.id, { childrenIds: [], ...item });
  const tab = (id, parentID, url, title) =>
    push({
      id,
      parentID,
      title: null,
      data: { tab: { savedURL: url, savedTitle: title } },
    });

  push({
    id: "top-apps",
    parentID: null,
    data: { itemContainer: { containerType: { topApps: { _0: {} } } } },
    childrenIds: ["fav-1"],
  });
  tab("fav-1", "top-apps", "https://example.com/calendar", "Calendar");

  push({
    id: "pinned-1",
    parentID: null,
    data: { itemContainer: { containerType: { spaceItems: { _0: "s1" } } } },
    childrenIds: ["tab-1", "folder-1", "skip-1"],
  });
  tab("tab-1", "pinned-1", "https://example.com/", "Example");
  push({
    id: "folder-1",
    parentID: "pinned-1",
    title: "Work",
    data: { list: {} },
    childrenIds: ["tab-2", "split-1", "sub-1"],
  });
  tab("tab-2", "folder-1", "https://example.com/2", "Two");
  push({
    id: "split-1",
    parentID: "folder-1",
    data: { splitView: {} },
    childrenIds: ["tab-3", "tab-4"],
  });
  tab("tab-3", "split-1", "https://example.com/3", "Three");
  tab("tab-4", "split-1", "https://example.com/4", "Four");
  push({
    id: "sub-1",
    parentID: "folder-1",
    title: "Nested",
    data: { list: {} },
    childrenIds: ["tab-5"],
  });
  tab("tab-5", "sub-1", "https://example.com/5", "Five");
  tab("skip-1", "pinned-1", "arc://welcome", "Not a web page");
  tab("today-1", "unpinned-1", "https://example.com/today", "Today");

  push({
    id: "pinned-2",
    parentID: null,
    data: { itemContainer: { containerType: { spaceItems: { _0: "s2" } } } },
  });
  tab("tab-6", "pinned-2", "https://example.com/6", "Six");

  const spaces = [
    "s1",
    {
      id: "s1",
      title: "Work Space",
      profile: { default: {} },
      customInfo: {
        iconType: { emoji_v2: "\u{1F9EA}" },
        windowTheme: {
          background: {
            single: {
              _0: {
                style: {
                  color: {
                    _0: {
                      blendedGradient: {
                        _0: {
                          overlayColors: [
                            arcColorOf(0, 0, 0, 0),
                            arcColorOf(0.958, 1.001, 0.289),
                          ],
                          baseColors: [
                            arcColorOf(0.332, 0.686, 1.027),
                            arcColorOf(1.077, 0.414, 0.398),
                          ],
                          modifiers: {
                            overlay: "grain",
                            noiseFactor: 0.5,
                            intensityFactor: 0.8,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          primaryColorPalette: { tint: { red: 1, green: 1, blue: 1 } },
        },
      },
      containerIDs: ["unpinned", "unpinned-1", "pinned", "pinned-1"],
    },
    "s2",
    {
      id: "s2",
      profile: { custom: { _0: { directoryBasename: "Profile 1" } } },
      customInfo: {},
      containerIDs: ["pinned", "pinned-2", "unpinned", "unpinned-2"],
    },
  ];
  return {
    version: 1,
    sidebar: {
      containers: [
        { global: {} },
        { items, spaces, topAppsContainerIDs: [{ default: {} }, "top-apps"] },
        { littleBrowser: { _0: "little-1" } },
        buildLittleArcSidebar("little-1"),
      ],
    },
  };
}

function buildLittleArcSidebar(windowId) {
  const unpinnedId = `unpinned-${windowId}`;
  return {
    items: [
      unpinnedId,
      {
        id: unpinnedId,
        parentID: null,
        childrenIds: [`tab-${windowId}`],
        data: { itemContainer: { containerType: { unpinned: {} } } },
      },
      `tab-${windowId}`,
      {
        id: `tab-${windowId}`,
        parentID: unpinnedId,
        childrenIds: [],
        title: null,
        data: {
          tab: { savedURL: "https://example.com/little", savedTitle: "Little" },
        },
      },
    ],
    spaces: [
      `space-${windowId}`,
      {
        id: `space-${windowId}`,
        customInfo: {},
        containerIDs: ["unpinned", unpinnedId],
      },
    ],
    topAppsContainerIDs: [],
  };
}

function arcColorOf(red, green, blue, alpha = 1) {
  return { red, green, blue, alpha, colorSpace: "extendedSRGB" };
}

const kArcThemeColors = [
  [85, 175, 255],
  [255, 106, 101],
  [244, 255, 74],
];

function pinnedItemsOf(workspaceId) {
  const element = gZenWorkspaces.workspaceElement(workspaceId);
  return [...element.pinnedTabsContainer.children].filter(
    child =>
      (gBrowser.isTab(child) && !child.hasAttribute("zen-empty-tab")) ||
      gBrowser.isTabGroup(child)
  );
}

function folderItemsOf(folder) {
  return folder.allItems.filter(item => !item.hasAttribute("zen-empty-tab"));
}

function pinnedUrlOf(tab) {
  return tab._zenPinnedInitialState?.entry?.url;
}

function pinnedTitleOf(tab) {
  return tab._zenPinnedInitialState?.entry?.title;
}

function folderDepth(folder) {
  let depth = 0;
  for (let group = folder.group; group?.isZenFolder; group = group.group) {
    depth++;
  }
  return depth;
}

async function cleanupImportedState(original) {
  // Nested folders go first: a parent's removal event bubbles up from its
  // children, so waiting on the parent alone is not reliable.
  const folders = gBrowser.tabGroups
    .filter(group => group.isZenFolder && group.isConnected)
    .sort((a, b) => folderDepth(b) - folderDepth(a));
  for (const folder of folders) {
    if (!folder.isConnected) {
      continue;
    }
    folder.delete();
    try {
      await TestUtils.waitForCondition(
        () => !folder.isConnected,
        `folder ${folder.label} to be removed`
      );
    } catch (ex) {
      info(ex.message);
    }
  }
  for (const tab of [...gBrowser.tabs]) {
    if (tab.pinned && !tab.hasAttribute("zen-empty-tab")) {
      gBrowser.removeTab(tab);
    }
  }
  for (const workspace of gZenWorkspaces.getWorkspaces()) {
    if (workspace.uuid !== original.uuid) {
      await gZenWorkspaces.removeWorkspace(workspace.uuid);
    }
  }
  const workspace = gZenWorkspaces.getWorkspaceFromId(original.uuid);
  workspace.name = original.name;
  workspace.icon = original.icon;
  gZenWorkspaces.saveWorkspace(workspace);
}

function snapshotActiveWorkspace() {
  const workspace = gZenWorkspaces.getActiveWorkspaceFromCache();
  return { uuid: workspace.uuid, name: workspace.name, icon: workspace.icon };
}
