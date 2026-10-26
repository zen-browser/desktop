/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ArcProfileMigrator } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenProfileMigrators.sys.mjs"
);

add_task(async function test_parse_arc_sidebar() {
  const plan = ZenMigrationUtils.parseArcSidebar(buildArcSidebar());

  Assert.deepEqual(
    plan.favorites,
    [{ type: "tab", url: "https://example.com/calendar", title: "Calendar" }],
    "Top apps become favorites"
  );
  Assert.equal(plan.spaces.length, 2, "Both spaces are found");

  const [first, second] = plan.spaces;
  Assert.equal(first.title, "Work Space", "The space title is kept");
  Assert.equal(first.icon, "\u{1F9EA}", "The emoji icon is kept");
  Assert.deepEqual(
    first.theme.colors,
    kArcThemeColors,
    "Base colors come first, visible overlays follow, transparent ones and the palette are skipped"
  );
  Assert.equal(first.theme.intensity, 0.8, "Arc's intensity is read");
  Assert.equal(first.theme.noise, 0.5, "Arc's noise is read");
  Assert.deepEqual(
    first.items,
    [
      { type: "tab", url: "https://example.com/", title: "Example" },
      {
        type: "folder",
        title: "Work",
        items: [
          { type: "tab", url: "https://example.com/2", title: "Two" },
          { type: "tab", url: "https://example.com/3", title: "Three" },
          { type: "tab", url: "https://example.com/4", title: "Four" },
          {
            type: "folder",
            title: "Nested",
            items: [
              { type: "tab", url: "https://example.com/5", title: "Five" },
            ],
          },
        ],
      },
    ],
    "Pinned items keep their order, split views are flattened and internal pages are skipped"
  );

  Assert.deepEqual(
    first.unpinned,
    [{ type: "tab", url: "https://example.com/today", title: "Today" }],
    "Unpinned tabs are read from the space's unpinned container"
  );
  Assert.deepEqual(second.unpinned, [], "A space can have no unpinned tabs");

  Assert.equal(second.title, "Space 2", "Untitled spaces get a name");
  Assert.equal(second.icon, undefined, "Spaces without an emoji get no icon");
  Assert.deepEqual(
    second.theme.colors,
    [],
    "Spaces without a theme get no colors"
  );
  Assert.deepEqual(
    second.items,
    [{ type: "tab", url: "https://example.com/6", title: "Six" }],
    "Items are found through parent links when the container lists none"
  );
});

add_task(async function test_parse_arc_single_color_theme() {
  const sidebar = buildArcSidebar();
  const space = sidebar.sidebar.containers[1].spaces[1];
  space.customInfo.windowTheme.background.single._0.style.color._0 = {
    blendedSingleColor: {
      _0: {
        color: arcColorOf(0.2, 0.4, 0.6),
        modifiers: { noiseFactor: 0, intensityFactor: 0.3 },
      },
    },
  };
  const [first] = ZenMigrationUtils.parseArcSidebar(sidebar).spaces;
  Assert.deepEqual(
    first.theme,
    { colors: [[51, 102, 153]], intensity: 0.3, noise: 0 },
    "A single color theme gives one color"
  );
});

add_task(async function test_parse_arc_sidebar_garbage() {
  for (const input of [null, {}, { sidebar: { containers: "nope" } }]) {
    Assert.deepEqual(
      ZenMigrationUtils.parseArcSidebar(input),
      { favorites: [], spaces: [] },
      "Unexpected input gives an empty plan"
    );
  }
});

add_task(async function test_apply_arc_sidebar() {
  const original = snapshotActiveWorkspace();
  const plan = ZenMigrationUtils.parseArcSidebar(buildArcSidebar());

  const count = await ZenMigrationUtils.applyArcSidebar(plan, window);
  Assert.equal(count, 2, "Two spaces were imported");

  const workspaces = gZenWorkspaces.getWorkspaces();
  Assert.equal(
    workspaces.length,
    2,
    "The empty active space was reused for the first Arc space"
  );
  const first = gZenWorkspaces.getWorkspaceFromId(original.uuid);
  Assert.equal(first.name, "Work Space", "The active space was renamed");
  Assert.equal(first.icon, "\u{1F9EA}", "The active space got the icon");
  Assert.deepEqual(
    first.theme.gradientColors.map(color => color.c),
    kArcThemeColors,
    "The active space got Arc's colors as its gradient"
  );
  ok(
    first.theme.gradientColors[0].isPrimary &&
      !first.theme.gradientColors[1].isPrimary,
    "The first base color is the primary one"
  );
  Assert.equal(first.theme.opacity, 0.8, "Arc's intensity sets the opacity");
  Assert.equal(first.theme.texture, 0.5, "Arc's noise sets the texture");
  const second = workspaces.find(w => w.uuid !== original.uuid);
  Assert.equal(second.name, "Space 2", "The second space was created");

  const essentials = gBrowser.tabs.filter(tab =>
    tab.hasAttribute("zen-essential")
  );
  Assert.equal(essentials.length, 1, "The favorite became an essential");
  Assert.equal(
    pinnedUrlOf(essentials[0]),
    "https://example.com/calendar",
    "The essential remembers its url"
  );

  const firstItems = pinnedItemsOf(original.uuid);
  Assert.equal(firstItems.length, 2, "A pinned tab and a folder");
  ok(gBrowser.isTab(firstItems[0]) && firstItems[0].pinned, "First is a tab");
  Assert.equal(pinnedUrlOf(firstItems[0]), "https://example.com/");
  Assert.equal(
    firstItems[0].getAttribute("zen-workspace-id"),
    original.uuid,
    "The tab belongs to the first space"
  );
  const folder = firstItems[1];
  ok(folder.isZenFolder, "Second is a folder");
  Assert.equal(folder.label, "Work", "The folder keeps its name");
  ok(folder.collapsed, "Imported folders start collapsed");
  const folderItems = folderItemsOf(folder);
  Assert.equal(folderItems.length, 4, "Three tabs and a subfolder");
  Assert.deepEqual(
    folderItems.slice(0, 3).map(pinnedUrlOf),
    ["https://example.com/2", "https://example.com/3", "https://example.com/4"],
    "Folder tabs keep their order"
  );
  Assert.deepEqual(
    folderItems.slice(0, 3).map(tab => tab.label),
    ["Two", "Three", "Four"],
    "Folder tabs show Arc's titles without loading"
  );
  Assert.equal(firstItems[0].label, "Example", "Pinned tabs show their title");
  Assert.equal(essentials[0].label, "Calendar", "Essentials show their title");
  const subfolder = folderItems[3];
  ok(subfolder.isZenFolder, "The nested list became a subfolder");
  Assert.equal(subfolder.label, "Nested");
  ok(subfolder.collapsed, "Imported subfolders start collapsed too");
  Assert.equal(subfolder.group, folder, "The subfolder sits in its parent");
  Assert.deepEqual(folderItemsOf(subfolder).map(pinnedUrlOf), [
    "https://example.com/5",
  ]);

  const secondItems = pinnedItemsOf(second.uuid);
  Assert.equal(secondItems.length, 1, "The second space has its pinned tab");
  Assert.equal(pinnedUrlOf(secondItems[0]), "https://example.com/6");
  ok(secondItems[0].hasAttribute("pending"), "Imported tabs are not loaded");

  const unpinned = unpinnedTabsOf(original.uuid).filter(
    tab => !original.tabs.has(tab)
  );
  Assert.equal(unpinned.length, 1, "The unpinned tab was opened");
  Assert.equal(
    (
      unpinned[0].linkedBrowser.registeredOpenURI ??
      unpinned[0].linkedBrowser.currentURI
    ).spec,
    "https://example.com/today",
    "The unpinned tab will load Arc's url"
  );
  ok(unpinned[0].hasAttribute("pending"), "The unpinned tab is not loaded");

  await cleanupImportedState(original);
});

add_task(async function test_parse_arc_profiles() {
  const sidebar = buildArcSidebar();
  const container = sidebar.sidebar.containers[1];
  container.spaces[3].profile = arcProfileOf("Profile 1");
  container.items.push("top-apps-2", {
    id: "top-apps-2",
    parentID: null,
    data: {
      itemContainer: {
        containerType: { topApps: { _0: arcProfileOf("Profile 1") } },
      },
    },
    childrenIds: ["fav-2", "fav-3"],
  });
  for (const [id, url] of [
    ["fav-2", "https://example.com/mail"],
    ["fav-3", "https://example.com/mail"],
  ]) {
    container.items.push(id, {
      id,
      parentID: "top-apps-2",
      childrenIds: [],
      data: { tab: { savedURL: url, savedTitle: "Mail" } },
    });
  }
  container.topAppsContainerIDs.push(arcProfileOf("Profile 1"), "top-apps-2");

  const byProfile = profileId =>
    ZenMigrationUtils.parseArcSidebar(sidebar, { profileId });

  const main = byProfile("Default");
  Assert.deepEqual(
    main.spaces.map(space => space.id),
    ["s1"],
    "Spaces without a profile key belong to the default profile"
  );
  Assert.deepEqual(
    main.favorites.map(favorite => favorite.url),
    ["https://example.com/calendar"],
    "The default profile keeps its own favorites"
  );

  const other = byProfile("Profile 1");
  Assert.deepEqual(
    other.spaces.map(space => space.id),
    ["s2"],
    "A custom profile gets its own spaces"
  );
  Assert.deepEqual(
    other.favorites.map(favorite => favorite.url),
    ["https://example.com/mail"],
    "Favorites are per profile and repeated urls are kept once"
  );

  Assert.deepEqual(
    byProfile("Profile 9"),
    { favorites: [], spaces: [] },
    "An unknown profile has nothing to import"
  );
  Assert.equal(
    ZenMigrationUtils.parseArcSidebar(sidebar).spaces.length,
    2,
    "Without a profile every space is kept"
  );
});

add_task(async function test_parse_arc_space_order() {
  const sidebar = buildArcSidebar();
  sidebar.sidebarSyncState = {
    container: { value: { orderedSpaceIDs: ["s2", "s1"] } },
  };
  Assert.deepEqual(
    ZenMigrationUtils.parseArcSidebar(sidebar).spaces.map(space => space.id),
    ["s2", "s1"],
    "Spaces follow Arc's sidebar order"
  );
});

add_task(async function test_apply_arc_sidebar_twice() {
  const original = snapshotActiveWorkspace();
  const plan = ZenMigrationUtils.parseArcSidebar(buildArcSidebar());

  await ZenMigrationUtils.applyArcSidebar(plan, window);
  const second = gZenWorkspaces
    .getWorkspaces()
    .find(w => w.uuid !== original.uuid);
  const count = await ZenMigrationUtils.applyArcSidebar(plan, window);
  Assert.equal(count, 2, "Both spaces are reported on the second run");

  Assert.equal(
    gZenWorkspaces.getWorkspaces().length,
    2,
    "Importing again reuses the spaces it created"
  );
  const firstItems = pinnedItemsOf(original.uuid);
  Assert.equal(firstItems.length, 2, "No pinned tab or folder was duplicated");
  Assert.equal(
    folderItemsOf(firstItems[1]).length,
    4,
    "The folder was merged instead of copied"
  );
  Assert.equal(
    folderItemsOf(folderItemsOf(firstItems[1])[3]).length,
    1,
    "The subfolder was merged too"
  );
  Assert.equal(pinnedItemsOf(second.uuid).length, 1);
  Assert.equal(
    gBrowser.tabs.filter(tab => tab.hasAttribute("zen-essential")).length,
    1,
    "Favorites are not added twice"
  );
  Assert.equal(
    unpinnedTabsOf(original.uuid).filter(tab => !original.tabs.has(tab)).length,
    1,
    "Unpinned tabs are not opened twice"
  );

  await cleanupImportedState(original);
});

add_task(async function test_apply_arc_sidebar_new_tab_on_second_run() {
  const original = snapshotActiveWorkspace();
  await ZenMigrationUtils.applyArcSidebar(
    ZenMigrationUtils.parseArcSidebar(buildArcSidebar()),
    window
  );

  const sidebar = buildArcSidebar();
  const items = sidebar.sidebar.containers[1].items;
  const folder = items[items.indexOf("folder-1") + 1];
  folder.childrenIds.push("tab-new");
  items.push("tab-new", {
    id: "tab-new",
    parentID: "folder-1",
    childrenIds: [],
    data: { tab: { savedURL: "https://example.com/new", savedTitle: "New" } },
  });
  await ZenMigrationUtils.applyArcSidebar(
    ZenMigrationUtils.parseArcSidebar(sidebar),
    window
  );

  const folderItems = folderItemsOf(pinnedItemsOf(original.uuid)[1]);
  Assert.equal(folderItems.length, 5, "Only the new tab was added");
  Assert.equal(
    pinnedUrlOf(folderItems[4]),
    "https://example.com/new",
    "The new tab goes at the end of its folder"
  );

  await cleanupImportedState(original);
});

add_task(async function test_apply_arc_sidebar_after_space_removed() {
  const original = snapshotActiveWorkspace();
  const plan = ZenMigrationUtils.parseArcSidebar(buildArcSidebar());
  await ZenMigrationUtils.applyArcSidebar(plan, window);

  const removed = gZenWorkspaces
    .getWorkspaces()
    .find(w => w.uuid !== original.uuid);
  await gZenWorkspaces.removeWorkspace(removed.uuid);
  await ZenMigrationUtils.applyArcSidebar(plan, window);

  const recreated = gZenWorkspaces
    .getWorkspaces()
    .find(w => w.uuid !== original.uuid);
  Assert.equal(
    gZenWorkspaces.getWorkspaces().length,
    2,
    "The removed space is created again"
  );
  Assert.notEqual(recreated.uuid, removed.uuid, "It is a new space");
  Assert.equal(pinnedItemsOf(recreated.uuid).length, 1);
  const imported = JSON.parse(
    Services.prefs.getStringPref("zen.migration.arc.imported-spaces")
  );
  Assert.deepEqual(
    Object.values(imported).sort(),
    [original.uuid, recreated.uuid].sort(),
    "The saved map points at the new space"
  );

  await cleanupImportedState(original);
});

add_task(async function test_apply_arc_sidebar_without_unpinned_tabs() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.migration.arc.import-unpinned-tabs", false]],
  });
  const original = snapshotActiveWorkspace();
  await ZenMigrationUtils.applyArcSidebar(
    ZenMigrationUtils.parseArcSidebar(buildArcSidebar()),
    window
  );
  Assert.equal(
    unpinnedTabsOf(original.uuid).filter(tab => !original.tabs.has(tab)).length,
    0,
    "Unpinned tabs are skipped when the pref is off"
  );
  await cleanupImportedState(original);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_arc_migrator_resource_per_profile() {
  const original = snapshotActiveWorkspace();
  const dir = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-arc-migration"
  );
  const userData = PathUtils.join(dir, "User Data");
  for (const profile of ["Default", "Profile 1"]) {
    await IOUtils.makeDirectory(PathUtils.join(userData, profile), {
      createAncestors: true,
    });
  }
  await IOUtils.writeJSON(PathUtils.join(userData, "Local State"), {
    profile: {
      info_cache: {
        Default: { name: "Person 1" },
        "Profile 1": { name: "Work" },
      },
    },
  });
  const sidebar = buildArcSidebar();
  sidebar.sidebar.containers[1].spaces[3].profile = arcProfileOf("Profile 1");
  await IOUtils.writeJSON(PathUtils.join(dir, "StorableSidebar.json"), sidebar);

  const migrator = new ArcProfileMigrator();
  migrator._chromeUserDataPath = userData;
  const profiles = await migrator.getSourceProfiles();
  Assert.deepEqual(
    profiles.map(profile => profile.id).sort(),
    ["Default", "Profile 1"],
    "Every Arc profile with spaces is listed"
  );
  const resources = await migrator.getResources(
    profiles.find(profile => profile.id === "Profile 1")
  );
  const spaces = resources.find(
    resource => resource.type === MigrationUtils.resourceTypes.ZEN_SPACES
  );
  ok(spaces, "The second profile offers its spaces");

  const success = await new Promise(resolve => spaces.migrate(resolve));
  ok(success, "The sidebar migrated");
  Assert.equal(
    ZenMigrationUtils.lastImportedSpaceCount,
    1,
    "Only the second profile's space was imported"
  );
  Assert.equal(
    gZenWorkspaces.getWorkspaceFromId(original.uuid).name,
    "Space 1",
    "The profile's only space took over the empty active space"
  );

  await cleanupImportedState(original);
  await IOUtils.remove(dir, { recursive: true });
});

add_task(async function test_apply_arc_sidebar_keeps_used_space() {
  const original = snapshotActiveWorkspace();
  const existing = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/"
  );
  gBrowser.pinTab(existing);
  await gBrowser.TabStateFlusher.flush(existing.linkedBrowser);

  const plan = ZenMigrationUtils.parseArcSidebar(buildArcSidebar());
  await ZenMigrationUtils.applyArcSidebar(plan, window);

  Assert.equal(
    gZenWorkspaces.getWorkspaces().length,
    3,
    "A space with pinned tabs is left alone and new spaces are created"
  );
  Assert.equal(
    gZenWorkspaces.getWorkspaceFromId(original.uuid).name,
    original.name,
    "The active space keeps its name"
  );

  await cleanupImportedState(original);
});

add_task(async function test_arc_migrator_resource() {
  const original = snapshotActiveWorkspace();
  const dir = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-arc-migration"
  );
  const userData = PathUtils.join(dir, "User Data");
  await IOUtils.makeDirectory(PathUtils.join(userData, "Default"), {
    createAncestors: true,
  });
  await IOUtils.writeJSON(PathUtils.join(userData, "Local State"), {
    profile: { info_cache: { Default: { name: "Person 1" } } },
  });
  await IOUtils.writeJSON(
    PathUtils.join(dir, "StorableSidebar.json"),
    buildArcSidebar()
  );

  const migrator = new ArcProfileMigrator();
  migrator._chromeUserDataPath = userData;
  const profiles = await migrator.getSourceProfiles();
  Assert.deepEqual(
    profiles.map(profile => profile.id),
    ["Default"],
    "The profile is listed because the sidebar can be imported"
  );
  const resources = await migrator.getResources(profiles[0]);
  const spaces = resources.find(
    resource => resource.type === MigrationUtils.resourceTypes.ZEN_SPACES
  );
  ok(spaces, "The sidebar is offered as a resource");

  const success = await new Promise(resolve => spaces.migrate(resolve));
  ok(success, "The sidebar migrated");
  Assert.equal(
    ZenMigrationUtils.lastImportedSpaceCount,
    2,
    "The wizard can report how many spaces were imported"
  );
  Assert.equal(gZenWorkspaces.getWorkspaces().length, 2);

  await cleanupImportedState(original);
  await IOUtils.remove(dir, { recursive: true });
});
