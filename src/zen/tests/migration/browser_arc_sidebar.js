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
    [
      {
        type: "tab",
        url: "https://example.com/calendar",
        title: "Calendar",
        profile: "Default",
      },
    ],
    "Top apps become favorites and remember their Arc profile"
  );
  Assert.equal(
    plan.spaces.length,
    2,
    "Only the main sidebar's spaces are found, Little Arc windows are skipped"
  );

  const [first, second] = plan.spaces;
  Assert.equal(first.profile, "Default", "The main profile's space is tagged");
  Assert.equal(
    second.profile,
    "Profile 1",
    "A custom profile's space is tagged with its directory"
  );
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

add_task(async function test_filter_arc_plan() {
  const plan = ZenMigrationUtils.parseArcSidebar(buildArcSidebar());
  Assert.strictEqual(
    ZenMigrationUtils.filterArcPlan(plan),
    plan,
    "Without a profile the whole plan is kept"
  );
  const main = ZenMigrationUtils.filterArcPlan(plan, "Default");
  Assert.deepEqual(
    main.spaces.map(space => space.id),
    ["s1"],
    "The main profile only gets its own spaces"
  );
  Assert.equal(main.favorites.length, 1, "and its own favorites");
  const custom = ZenMigrationUtils.filterArcPlan(plan, "Profile 1");
  Assert.deepEqual(
    custom.spaces.map(space => space.id),
    ["s2"],
    "A custom profile only gets its own spaces"
  );
  Assert.deepEqual(custom.favorites, [], "and none of the main favorites");
  Assert.deepEqual(
    ZenMigrationUtils.filterArcPlan(plan, "Profile 9"),
    { favorites: [], spaces: [] },
    "An unknown profile has nothing to import"
  );
});

add_task(async function test_parse_arc_sidebar_little_arc_windows() {
  const sidebar = buildArcSidebar();
  const [globalKind, main, littleKind, little] = sidebar.sidebar.containers;
  sidebar.sidebar.containers = [
    littleKind,
    little,
    { littleBrowser: { _0: "little-2" } },
    buildLittleArcSidebar("little-2"),
    globalKind,
    main,
  ];
  const plan = ZenMigrationUtils.parseArcSidebar(sidebar);
  Assert.deepEqual(
    plan.spaces.map(space => space.id),
    ["s1", "s2"],
    "Little Arc sidebars are skipped wherever they appear"
  );
  Assert.equal(
    plan.favorites.length,
    1,
    "Favorites still come from the main sidebar"
  );

  sidebar.sidebar.containers = [littleKind, little];
  Assert.deepEqual(
    ZenMigrationUtils.parseArcSidebar(sidebar),
    { favorites: [], spaces: [] },
    "A file with only Little Arc windows has nothing to import"
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

  await cleanupImportedState(original);
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
  for (const profile of ["Default", "Profile 1", "Profile 2"]) {
    await IOUtils.makeDirectory(PathUtils.join(userData, profile), {
      createAncestors: true,
    });
  }
  await IOUtils.writeJSON(PathUtils.join(userData, "Local State"), {
    profile: {
      info_cache: {
        Default: { name: "Person 1" },
        "Profile 1": { name: "Arc Work" },
        "Profile 2": { name: "Empty" },
      },
    },
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
    ["zen-all-profiles", "Default", "Profile 1"],
    "Profiles with something to import are listed, after an all-profiles entry"
  );
  Assert.equal(profiles[0].name, "All profiles", "The entry is localized");
  const spacesResourceOf = async profile =>
    (await migrator.getResources(profile)).find(
      resource => resource.type === MigrationUtils.resourceTypes.ZEN_SPACES
    );
  const [all, mainProfile, workProfile] = profiles;

  const mainSpaces = await spacesResourceOf(mainProfile);
  ok(mainSpaces, "The sidebar is offered for the main profile");

  ok(
    await new Promise(resolve => mainSpaces.migrate(resolve)),
    "The main profile's sidebar migrated"
  );
  Assert.equal(
    ZenMigrationUtils.lastImportedSpaceCount,
    1,
    "Only the main profile's space was imported"
  );
  Assert.equal(
    gZenWorkspaces.getWorkspaces().length,
    1,
    "The empty active space was reused for it"
  );
  Assert.equal(
    gZenWorkspaces.getWorkspaceFromId(original.uuid).containerTabId,
    0,
    "The main profile gets no container"
  );

  const workSpaces = await spacesResourceOf(workProfile);
  ok(workSpaces, "The sidebar is offered for the custom profile too");
  ok(
    await new Promise(resolve => workSpaces.migrate(resolve)),
    "The custom profile's sidebar migrated"
  );
  Assert.equal(ZenMigrationUtils.lastImportedSpaceCount, 1);
  const workspaces = gZenWorkspaces.getWorkspaces();
  Assert.equal(workspaces.length, 2, "The custom profile got its own space");
  const work = workspaces.find(workspace => workspace.uuid !== original.uuid);
  Assert.equal(work.name, "Space 2", "with the Arc space's name");
  Assert.greater(work.containerTabId, 0, "and a container");
  Assert.equal(
    ContextualIdentityService.getUserContextLabel(work.containerTabId),
    "Arc Work",
    "The container is named after the Arc profile"
  );
  const workItems = pinnedItemsOf(work.uuid);
  Assert.equal(workItems.length, 1, "The profile's pinned tab was imported");
  Assert.equal(
    workItems[0].userContextId,
    work.containerTabId,
    "and opens in the profile's container"
  );
  Assert.equal(
    ZenMigrationUtils.containerIdForArcProfile(workProfile),
    work.containerTabId,
    "Importing the profile again reuses its container"
  );
  await cleanupImportedState(original);

  const allSpaces = await spacesResourceOf(all);
  ok(allSpaces, "The sidebar is offered for all profiles at once");
  ok(
    await new Promise(resolve => allSpaces.migrate(resolve)),
    "Every profile's sidebar migrated"
  );
  Assert.equal(
    ZenMigrationUtils.lastImportedSpaceCount,
    2,
    "The count covers every profile"
  );
  const allWorkspaces = gZenWorkspaces.getWorkspaces();
  Assert.equal(allWorkspaces.length, 2, "Both profiles' spaces were created");
  Assert.deepEqual(
    allWorkspaces.map(workspace => workspace.containerTabId),
    [0, work.containerTabId],
    "The main profile's space has no container, the other keeps its own"
  );

  await cleanupImportedState(original);
  ContextualIdentityService.remove(work.containerTabId);
  await IOUtils.remove(dir, { recursive: true });
});
