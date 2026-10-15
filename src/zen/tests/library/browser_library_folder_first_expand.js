/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function marginTopAnimation(element) {
  return element
    .getAnimations()
    .find(animation =>
      animation.effect.getKeyframes().some(frame => "marginTop" in frame)
    );
}

add_task(async function test_collapsed_folder_copy_slides_open() {
  const tabs = [];
  for (let i = 0; i < 3; i++) {
    tabs.push(BrowserTestUtils.addTab(gBrowser, "about:blank"));
  }
  // The folder collapses itself right after it is created.
  const folder = gZenFolders.createFolder(tabs, {
    renameFolder: false,
    label: "first expand",
    collapsed: true,
  });
  await BrowserTestUtils.waitForEvent(folder, "ZenFolderAnimationFinished");
  ok(folder.collapsed, "the folder is collapsed in the sidebar");

  const Library = customElements.get("zen-library");
  const library = document.querySelector("zen-library");
  Library.toggle("history");
  await TestUtils.waitForCondition(
    () =>
      Library.libraryProgress === 1 && !library.hasAttribute("transitioning"),
    "library opens"
  );
  Library.toggle("spaces");
  let copy;
  await TestUtils.waitForCondition(
    () => (copy = document.getElementById(`${folder.id}-copy`)),
    "the spaces section shows a copy of the folder"
  );
  ok(copy.collapsed, "the copy starts out collapsed");

  copy.querySelector(".tab-group-label-container").click();
  ok(!copy.collapsed, "clicking the copy expands it");
  const animation = marginTopAnimation(copy.groupStartElement);
  ok(animation, "the copy's tabs are animated in");
  Assert.less(
    parseFloat(animation.effect.getKeyframes()[0].marginTop),
    0,
    "the tabs slide down from above instead of popping in"
  );
  await animation.finished;

  Library.toggle("spaces");
  await TestUtils.waitForCondition(
    () => !Library.isLibraryOpen && Library.libraryProgress === 0,
    "library closes"
  );

  const removed = BrowserTestUtils.waitForEvent(folder, "TabGroupRemoved");
  await folder.delete();
  await removed;
});
