/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const SPLITTER_SELECTOR = ".zen-split-view-splitter";

function dispatchMouse(target, type, clientX, clientY) {
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, clientX, clientY })
  );
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function splitContainers() {
  return [
    ...document.querySelectorAll('.browserSidebarContainer[zen-split="true"]'),
  ];
}

add_task(async function test_Splitter_Drag_Resizes() {
  await basicSplitNTabs(async () => {
    const splitter = document.querySelector(SPLITTER_SELECTOR);
    ok(splitter, "There should be a splitter between the two panes");

    const panel = gZenViewSplitter.tabBrowserPanel;
    const rect = panel.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    dispatchMouse(splitter, "mousedown", startX, y);
    ok(gZenViewSplitter._gestures.splitterDrag, "The drag should be in flight");
    ok(
      panel.hasAttribute("zen-split-resizing"),
      "The panel should be marked as resizing"
    );

    dispatchMouse(document, "mousemove", startX - rect.width * 0.1, y);
    await nextFrame();
    Assert.notEqual(
      splitContainers()[0].style.inset,
      "0% 50% 0% 0%",
      "The drag should have moved the boundary between the panes"
    );

    dispatchMouse(document, "mouseup", startX - rect.width * 0.1, y);
    Assert.equal(
      gZenViewSplitter._gestures.splitterDrag,
      null,
      "Mouseup should release the gesture slot"
    );
    ok(
      !panel.hasAttribute("zen-split-resizing"),
      "Mouseup should unmark the panel"
    );
  });
});

add_task(async function test_Split_Torn_Down_Mid_Drag() {
  await basicSplitNTabs(async tabs => {
    const containers = tabs.map(tab =>
      tab.linkedBrowser.closest(".browserSidebarContainer")
    );
    const splitter = document.querySelector(SPLITTER_SELECTOR);
    const panel = gZenViewSplitter.tabBrowserPanel;
    const rect = panel.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    dispatchMouse(splitter, "mousedown", startX, y);
    ok(gZenViewSplitter._gestures.splitterDrag, "The drag should be in flight");

    gZenViewSplitter.removeTabFromGroup(tabs[1], undefined, {
      forUnsplit: true,
    });
    Assert.equal(
      gZenViewSplitter._gestures.splitterDrag,
      null,
      "Tearing the split down should call the drag off"
    );
    ok(
      !panel.hasAttribute("zen-split-resizing"),
      "The panel should no longer be marked as resizing"
    );
    for (const container of containers) {
      Assert.equal(
        container.style.inset,
        "",
        "The teardown should have cleared the inset"
      );
    }

    dispatchMouse(document, "mousemove", startX - rect.width * 0.1, y);
    await nextFrame();
    for (const container of containers) {
      Assert.equal(
        container.style.inset,
        "",
        "A cancelled drag should not write an inset onto an unsplit container"
      );
    }

    dispatchMouse(document, "mouseup", startX - rect.width * 0.1, y);
  });
});
