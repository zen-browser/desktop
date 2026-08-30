/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

let lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  SearchService: "moz-src:///toolkit/components/search/SearchService.sys.mjs",
});

/* eslint-disable mozilla/no-arbitrary-setTimeout */

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function currentPageContent() {
  return document.querySelector(
    "#zen-welcome-page-content > .zen-welcome-page:not([exiting])"
  );
}

add_task(async function test_Welcome_Steps() {
  const selectedTab = gBrowser.selectedTab;
  await wait(2000); // Give tons of time for the welcome start button to be clicked
  await waitForFocus();
  await EventUtils.synthesizeMouseAtCenter(
    document.getElementById("zen-welcome-start-button"),
    {}
  );
  await wait(1500); // Wait for the transition to complete
  ok(true, "Welcome start button clicked successfully");
  Assert.notEqual(
    window.windowState,
    window.STATE_MAXIMIZED,
    "Window should not be maximized by the welcome screen"
  );

  const backButton = document.getElementById("zen-welcome-back");
  ok(
    backButton.hasAttribute("disabled"),
    "Back button should be hidden on the first page"
  );
  Assert.equal(
    currentPageContent().querySelectorAll(".zen-welcome-option").length,
    2,
    "Import page should offer two options"
  );

  await goNextWelcomePage("zen-generic-next");
  ok(true, "Welcome Import Step Test Finished");

  ok(
    !backButton.hasAttribute("disabled"),
    "Back button should be visible after the first page"
  );
  await EventUtils.synthesizeMouseAtCenter(backButton, {});
  await wait(800);
  ok(
    backButton.hasAttribute("disabled"),
    "Going back should return to the first page"
  );
  await goNextWelcomePage("zen-generic-next");

  await goNextWelcomePage("zen-generic-next");
  ok(true, "Welcome Theme Step Test Finished");

  let options = currentPageContent().querySelectorAll(".zen-welcome-option");
  Assert.greater(
    options.length,
    0,
    "Search page should list the available engines"
  );
  for (const option of options) {
    ok(
      option.querySelector("img").getAttribute("src").includes("blob:"),
      "Each engine option should have an image with a blob URL"
    );
  }

  await EventUtils.synthesizeMouseAtCenter(options[1], {});
  await wait(100);
  let engineName = await lazy.SearchService.getDefault();
  ok(
    options[1].querySelector("input").checked,
    "The selected option should be checked"
  );
  Assert.equal(
    engineName.name,
    options[1].querySelector(".zen-welcome-option-label").textContent.trim(),
    "The default search engine should match the selected option"
  );

  await goNextWelcomePage("zen-generic-next");
  ok(true, "Welcome Search Step Test Finished");

  const essentials = currentPageContent().querySelectorAll(
    "#zen-welcome-essentials .zen-welcome-essential"
  );
  Assert.greater(
    essentials.length,
    3,
    "Welcome page content should have more than 3 essentials"
  );
  await EventUtils.synthesizeMouseAtCenter(essentials[0], {});
  await EventUtils.synthesizeMouseAtCenter(essentials[2], {});
  ok(
    essentials[0].hasAttribute("selected"),
    "The first essential should be selected"
  );
  ok(
    !essentials[1].hasAttribute("selected"),
    "The second essential should not be selected"
  );
  ok(
    essentials[2].hasAttribute("selected"),
    "The third essential should be selected"
  );
  const urlsToCheck = [essentials[0].dataset.url, essentials[2].dataset.url];
  for (const url of urlsToCheck) {
    ok(
      url.startsWith("https://"),
      `The URL "${url}" should start with "https://"`
    );
  }

  await goNextWelcomePage("zen-generic-next");
  ok(true, "Welcome Essentials Step Test Finished");

  options = currentPageContent().querySelectorAll(".zen-welcome-option");
  Assert.equal(options.length, 2, "Default browser page should have 2 options");
  await EventUtils.synthesizeMouseAtCenter(options[0], {});
  ok(
    options[0].querySelector("input").checked,
    "Clicking the option should check its radio"
  );
  // Don't actually change the default browser in the test.
  await EventUtils.synthesizeMouseAtCenter(options[1], {});

  await goNextWelcomePage("zen-generic-next");
  ok(true, "Welcome Default Browser Step Test Finished");

  await goNextWelcomePage("zen-welcome-start-browsing");
  ok(true, "Welcome Finish Step Test Finished");

  await wait(3000); // Wait for the finish animation to complete

  for (const url of urlsToCheck) {
    ok(
      await PlacesUtils.history.hasVisits(url),
      `The URL "${url}" should have visits in history`
    );
  }
  Assert.equal(
    gBrowser._numZenEssentials,
    2,
    "There should be 2 Essentials after the welcome process"
  );
  Assert.equal(
    gBrowser.tabs.filter(
      tab => tab.pinned && !tab.hasAttribute("zen-essential")
    ).length,
    2,
    "There should be 2 pinned tabs after the welcome process"
  );

  gBrowser.selectedTab = selectedTab;
  const groups = gBrowser.tabGroups;
  Assert.equal(
    groups.length,
    1,
    "There should be one tab group after the welcome process"
  );
  const group = groups[0];
  Assert.equal(
    group.tabs.length,
    2,
    "The first tab group should have 2 tabs after the welcome process"
  );
  Assert.equal(
    group.label,
    "zen basics",
    'The first tab group should be labeled "zen basics" after the welcome process'
  );
  for (const tab of gBrowser.tabs) {
    if (tab.hasAttribute("zen-empty-tab")) {
      continue;
    }
    if (tab.pinned && !tab.hasAttribute("zen-essential")) {
      ok(
        tab.hasAttribute("zen-workspace-id"),
        "Pinned tabs should have a zen-workspace-id attribute"
      );
      Assert.equal(
        tab.group,
        group,
        "Pinned tabs should belong to the first tab group"
      );
    }
  }
  group.delete();
  for (const tab of gBrowser.tabs) {
    if (tab.pinned) {
      gBrowser.removeTab(tab);
    }
  }
  ok(true, "Welcome process completed successfully");
});
