/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function withBookmarkFolderFixture(callback) {
  clearAllRoutes();
  const work = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.unfiledGuid,
    type: PlacesUtils.bookmarks.TYPE_FOLDER,
    title: "Routing Work",
  });
  const school = await PlacesUtils.bookmarks.insert({
    parentGuid: PlacesUtils.bookmarks.unfiledGuid,
    type: PlacesUtils.bookmarks.TYPE_FOLDER,
    title: "Routing School",
  });
  const nested = await PlacesUtils.bookmarks.insert({
    parentGuid: work.guid,
    type: PlacesUtils.bookmarks.TYPE_FOLDER,
    title: "Projects",
  });
  const bookmark = await PlacesUtils.bookmarks.insert({
    parentGuid: nested.guid,
    url: "https://routing.example/Project?view=work#details",
    title: "Project",
  });
  try {
    await gZenSpaceRoutingManager.getBookmarkFolders();
    await callback({ work, school, nested, bookmark });
  } finally {
    clearAllRoutes();
    for (const folder of [work, school]) {
      if (await PlacesUtils.bookmarks.fetch(folder.guid)) {
        await PlacesUtils.bookmarks.remove(folder.guid);
      }
    }
    await gZenSpaceRoutingManager.getBookmarkFolders();
  }
}

add_task(async function test_exact_urls_and_nested_folder_membership() {
  await withBookmarkFolderFixture(
    async ({ work, school, nested, bookmark }) => {
      const route = addRoute({
        reference: work.guid,
        matchType: "bookmark-folder",
        openIn: "work-space",
      });
      const uri = bookmark.url.href;
      ok(
        gZenSpaceRoutingManager.isRouteMatching(uri, route),
        "Nested bookmark matches its parent folder"
      );
      ok(
        gZenSpaceRoutingManager.isRouteMatching(uri, {
          ...route,
          reference: nested.guid,
        }),
        "Nested folder matches its own bookmark"
      );
      ok(
        !gZenSpaceRoutingManager.isRouteMatching(uri, {
          ...route,
          reference: school.guid,
        }),
        "An unrelated folder does not match"
      );
      for (const different of [
        // eslint-disable-next-line sdl/no-insecure-url -- Compare protocols without making a request.
        "http://routing.example/Project?view=work#details",
        "https://routing.example/project?view=work#details",
        "https://routing.example/Project?view=school#details",
        "https://routing.example/Project?view=work",
        "https://routing.example/Project?view=work#other",
        "https://routing.example/Project/child?view=work#details",
      ]) {
        ok(
          !gZenSpaceRoutingManager.isRouteMatching(different, route),
          `A different full URL is not routed: ${different}`
        );
      }
      const folders = await gZenSpaceRoutingManager.getBookmarkFolders();
      const project = folders.find(folder => folder.guid === nested.guid);
      ok(
        project.title.endsWith("Routing Work / Projects"),
        "Picker entries include the nested folder path"
      );
      project.title = "Changed copy";
      isnot(
        (await gZenSpaceRoutingManager.getBookmarkFolders()).find(
          folder => folder.guid === nested.guid
        ).title,
        "Changed copy",
        "Callers cannot mutate the folder snapshot"
      );
      is(
        gZenSpaceRoutingManager.routeUri(uri, {}),
        "work-space",
        "Folder membership selects the configured space"
      );
      const win = makeFakeWindow({
        workspaces: [{ uuid: "work-space", name: "Work", containerTabId: 7 }],
      });
      const result = gZenSpaceRoutingManager.onBeforeAddTab(uri, {}, win);
      ok(
        result.isRouteFound,
        "The tab-opening routing hook finds the folder rule"
      );
      is(
        result.userContextId,
        7,
        "The routed tab receives the target space's container"
      );
    }
  );
});

add_task(async function test_bookmark_edits_moves_and_folder_identity() {
  await withBookmarkFolderFixture(
    async ({ work, school, nested, bookmark }) => {
      const route = addRoute({
        reference: work.guid,
        matchType: "bookmark-folder",
        openIn: "work-space",
      });
      const original = bookmark.url.href;
      const updated = "https://routing.example/updated";
      await PlacesUtils.bookmarks.update({ guid: bookmark.guid, url: updated });
      await gZenSpaceRoutingManager.getBookmarkFolders();
      ok(
        !gZenSpaceRoutingManager.isRouteMatching(original, route),
        "An edited bookmark stops matching its old URL"
      );
      ok(
        gZenSpaceRoutingManager.isRouteMatching(updated, route),
        "Its replacement URL starts matching"
      );
      await PlacesUtils.bookmarks.update({
        guid: work.guid,
        title: "Renamed Work",
      });
      const folders = await gZenSpaceRoutingManager.getBookmarkFolders();
      ok(
        folders
          .find(folder => folder.guid === nested.guid)
          .title.endsWith("Renamed Work / Projects"),
        "Folder rename refreshes descendant picker paths"
      );
      ok(
        gZenSpaceRoutingManager.isRouteMatching(updated, route),
        "Renaming preserves the GUID-based rule"
      );
      await PlacesUtils.bookmarks.update({
        guid: nested.guid,
        parentGuid: school.guid,
        index: PlacesUtils.bookmarks.DEFAULT_INDEX,
      });
      await gZenSpaceRoutingManager.getBookmarkFolders();
      ok(
        !gZenSpaceRoutingManager.isRouteMatching(updated, route),
        "Moving a subtree out removes its parent membership"
      );
      ok(
        gZenSpaceRoutingManager.isRouteMatching(updated, {
          ...route,
          reference: school.guid,
        }),
        "The new parent gains the subtree's URLs"
      );
      await PlacesUtils.bookmarks.update({
        guid: bookmark.guid,
        parentGuid: work.guid,
        index: PlacesUtils.bookmarks.DEFAULT_INDEX,
      });
      await gZenSpaceRoutingManager.getBookmarkFolders();
      ok(
        gZenSpaceRoutingManager.isRouteMatching(updated, route),
        "Moving the bookmark back restores membership"
      );
      await PlacesUtils.bookmarks.remove(bookmark.guid);
      await gZenSpaceRoutingManager.getBookmarkFolders();
      ok(
        !gZenSpaceRoutingManager.isRouteMatching(updated, route),
        "Removing the bookmark clears membership"
      );
      const added = await PlacesUtils.bookmarks.insert({
        parentGuid: work.guid,
        url: updated,
      });
      await gZenSpaceRoutingManager.getBookmarkFolders();
      ok(
        gZenSpaceRoutingManager.isRouteMatching(added.url.href, route),
        "New bookmarks become routable"
      );
      await PlacesUtils.bookmarks.remove(work.guid);
      await gZenSpaceRoutingManager.getBookmarkFolders();
      ok(
        !gZenSpaceRoutingManager.isRouteMatching(updated, route),
        "A deleted folder never matches stale URLs"
      );
      is(
        gZenSpaceRoutingManager.getRoute(route.id).reference,
        work.guid,
        "The unavailable selection remains stored for the user to repair"
      );
      const replacement = await PlacesUtils.bookmarks.insert({
        parentGuid: school.guid,
        type: PlacesUtils.bookmarks.TYPE_FOLDER,
        title: "Renamed Work",
      });
      await PlacesUtils.bookmarks.insert({
        parentGuid: replacement.guid,
        url: updated,
      });
      await gZenSpaceRoutingManager.getBookmarkFolders();
      ok(
        !gZenSpaceRoutingManager.isRouteMatching(updated, route),
        "A new folder with the same name does not inherit the old rule"
      );
    }
  );
});

add_task(async function test_folder_rule_priority_and_external_fallback() {
  await withBookmarkFolderFixture(async ({ work, bookmark }) => {
    addRoute({ reference: "routing.example", openIn: "first-space" });
    addRoute({
      reference: work.guid,
      matchType: "bookmark-folder",
      openIn: "work-space",
    });
    is(
      gZenSpaceRoutingManager.routeUri(bookmark.url.href, {}),
      "first-space",
      "Folder rules preserve the existing first-match order"
    );
    clearAllRoutes();
    addRoute({
      reference: work.guid,
      matchType: "bookmark-folder",
      openIn: "work-space",
    });
    addRoute({ reference: "routing.example", openIn: "second-space" });
    is(
      gZenSpaceRoutingManager.routeUri(bookmark.url.href, {}),
      "work-space",
      "A folder rule placed first wins"
    );
    const savedDefault = gZenSpaceRoutingManager.getDefaultExternalRoute();
    try {
      gZenSpaceRoutingManager.setDefaultExternalRoute("external-space");
      is(
        gZenSpaceRoutingManager.routeUri("https://unrelated.example/", {
          fromExternal: true,
        }),
        "external-space",
        "An unmatched external URL uses the configured fallback"
      );
      is(
        gZenSpaceRoutingManager.routeUri("https://unrelated.example/", {}),
        "most-recent-space",
        "An unmatched internal URL keeps the current behavior"
      );
    } finally {
      gZenSpaceRoutingManager.setDefaultExternalRoute(savedDefault);
    }
  });
});

add_task(async function test_folder_picker_and_unavailable_selection() {
  await withBookmarkFolderFixture(async ({ work, school }) => {
    const route = addRoute({
      reference: work.guid,
      matchType: "bookmark-folder",
      openIn: "most-recent-space",
    });
    const dialog = await openRoutingDialog();
    try {
      const row = dialog.document.querySelector(".sr-rule-container");
      const picker = row.querySelector(".bookmark-folder-select");
      await TestUtils.waitForCondition(
        () => picker.querySelector(`menuitem[value="${work.guid}"]`),
        "The folder picker populates"
      );
      ok(
        row.querySelector(".input").hidden,
        "Folder rules hide the manual URL input"
      );
      ok(!picker.hidden, "Folder rules show the bookmark-folder picker");
      is(picker.value, work.guid, "The saved folder GUID is selected");
      picker.value = school.guid;
      picker.dispatchEvent(new dialog.Event("command", { bubbles: true }));
      is(
        gZenSpaceRoutingManager.getRoute(route.id).reference,
        school.guid,
        "Selecting another folder updates the rule"
      );
      await PlacesUtils.bookmarks.remove(school.guid);
      await dialog.spaceroutingDialog.createBookmarkFolderList(
        picker,
        route.id
      );
      const unavailable = picker.querySelector(
        `menuitem[value="${school.guid}"]`
      );
      ok(
        unavailable.disabled,
        "The deleted folder remains a disabled unavailable selection"
      );
      is(
        picker.value,
        school.guid,
        "Opening the picker does not silently choose a different folder"
      );
      const matchType = row.querySelector(".match-type-select");
      matchType.value = "contains";
      matchType.dispatchEvent(new dialog.Event("command", { bubbles: true }));
      is(
        gZenSpaceRoutingManager.getRoute(route.id).reference,
        "",
        "Switching to a URL rule clears the folder GUID"
      );
      ok(
        !row.querySelector(".input").hidden,
        "Switching restores the URL input"
      );
    } finally {
      await closeRoutingDialog(dialog);
    }
  });
});
