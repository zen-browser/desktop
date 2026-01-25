/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Basic_Split_View_Inset() {
  let viewsToCheck = [];
  await basicSplitNTabs(() => {
    viewsToCheck = document.querySelectorAll('.browserSidebarContainer[zen-split="true"]');
    ok(viewsToCheck.length, "There should be split views present");
    Assert.equal(
      viewsToCheck[0].style.inset,
      "0% 50% 0% 0%",
      "The split view should have correct inset style"
    );
    Assert.equal(
      viewsToCheck[1].style.inset,
      "0% 0% 0% 50%",
      "The second split view should have correct inset style"
    );
  });
  for (const view of viewsToCheck) {
    Assert.equal(view.style.inset, "", "The unsplit view should not have correct inset style");
  }
});

add_task(async function test_Horizontal_Split_Inset() {
  await basicSplitNTabs(() => {
    const viewsToCheck = document.querySelectorAll('.browserSidebarContainer[zen-split="true"]');
    ok(viewsToCheck.length, "There should be split views present");
    Assert.equal(
      viewsToCheck[0].style.inset,
      "0% 50% 0% 0%",
      "The horizontal split view should have correct inset style"
    );
    Assert.equal(
      viewsToCheck[1].style.inset,
      "0% 0% 0% 50%",
      "The second horizontal split view should have correct inset style"
    );
  });
});

add_task(async function test_3_Splits_Grid_Inset() {
  await basicSplitNTabs(
    () => {
      const viewsToCheck = document.querySelectorAll('.browserSidebarContainer[zen-split="true"]');
      ok(viewsToCheck.length, "There should be split views present");
      Assert.equal(
        viewsToCheck[0].style.inset,
        "0% 0% 50% 50%",
        "The first split view should have correct inset style"
      );
      Assert.equal(
        viewsToCheck[1].style.inset,
        "50% 0% 0% 50%",
        "The second split view should have correct inset style"
      );
      Assert.equal(
        viewsToCheck[2].style.inset,
        "0% 50% 0% 0%",
        "The third split view should have correct inset style"
      );
    },
    "grid",
    3
  );
});
