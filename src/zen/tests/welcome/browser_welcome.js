/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

let lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  SearchService: "moz-src:///toolkit/components/search/SearchService.sys.mjs",
});

const { InternalTestingProfileMigrator } = ChromeUtils.importESModule(
  "moz-src:///browser/components/migration/InternalTestingProfileMigrator.sys.mjs"
);

const { MigrationWizardConstants } = ChromeUtils.importESModule(
  "chrome://browser/content/migration/migration-wizard-constants.mjs"
);

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
  const importOptions = currentPageContent().querySelectorAll(
    ".zen-welcome-option"
  );
  Assert.greaterOrEqual(
    importOptions.length,
    1,
    "Import page should offer at least the start fresh option"
  );
  ok(
    importOptions[0].querySelector("#zen-welcome-import-no").checked,
    "Starting fresh should be selected by default"
  );
  for (const option of [...importOptions].slice(1)) {
    ok(
      option.querySelector("input").dataset.sourceIndex,
      "Each browser option should know its source"
    );
    ok(
      option.querySelector(".engine-icon").getAttribute("src"),
      "Each browser option should show its brand image"
    );
  }
  const multiProfile = currentPageContent().querySelector(
    ".zen-welcome-import-source:has(.zen-welcome-import-profiles)"
  );
  if (multiProfile) {
    ok(
      !multiProfile.hasAttribute("expanded"),
      "Profiles stay hidden until the browser is selected"
    );
    const expanded = BrowserTestUtils.waitForEvent(
      multiProfile.querySelector(".zen-welcome-import-profiles"),
      "transitionend"
    );
    await EventUtils.synthesizeMouseAtCenter(
      multiProfile.querySelector(".zen-welcome-option"),
      {}
    );
    ok(
      multiProfile.hasAttribute("expanded"),
      "Selecting the browser reveals its profiles"
    );
    await expanded;
    const profileRadios = multiProfile.querySelectorAll(
      ".zen-welcome-import-profile input"
    );
    Assert.greater(profileRadios.length, 1, "Several profiles are listed");
    ok(profileRadios[0].checked, "The first profile is selected by default");
    const secondProfile = profileRadios[1].closest(
      ".zen-welcome-import-profile"
    );
    secondProfile.scrollIntoView({ block: "center" });
    await EventUtils.synthesizeMouseAtCenter(secondProfile, {});
    ok(profileRadios[1].checked, "Another profile can be picked");
    importOptions[0].scrollIntoView({ block: "center" });
    await EventUtils.synthesizeMouseAtCenter(importOptions[0], {});
    ok(
      !multiProfile.hasAttribute("expanded"),
      "Choosing another option hides the profiles again"
    );
  }

  let wizardOpened = false;
  const windowObserver = () => {
    wizardOpened = true;
  };
  Services.obs.addObserver(windowObserver, "domwindowopened");
  await goNextWelcomePage("zen-generic-next");
  Services.obs.removeObserver(windowObserver, "domwindowopened");
  ok(!wizardOpened, "Starting fresh should not open the migration wizard");
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

  const importPage = currentPageContent();
  await TestUtils.waitForCondition(
    () =>
      importPage.importSources?.some(
        source => source.key === InternalTestingProfileMigrator.key
      ),
    "the testing migrator to be listed",
    100,
    300
  );
  const sourceIndex = importPage.importSources.findIndex(
    source => source.key === InternalTestingProfileMigrator.key
  );
  const sourceOption = importPage.querySelector(
    `label[for="zen-welcome-import-${sourceIndex}"]`
  );
  sourceOption.scrollIntoView({ block: "center" });
  await EventUtils.synthesizeMouseAtCenter(sourceOption, {});
  ok(
    sourceOption.querySelector("input").checked,
    "The browser to import from should be selected"
  );
  const wizardPromise = BrowserTestUtils.domWindowOpened();
  const nextButton = document.querySelector(
    "#zen-welcome-page-sidebar-buttons button[data-l10n-id='zen-generic-next']"
  );
  executeSoon(() => EventUtils.synthesizeMouseAtCenter(nextButton, {}));
  const wizardWin = await wizardPromise;
  await BrowserTestUtils.waitForEvent(wizardWin, "MigrationWizard:Ready");
  const wizardShadow =
    wizardWin.document.getElementById("wizard").openOrClosedShadowRoot;
  Assert.equal(
    wizardShadow.querySelector("#wizard-deck").getAttribute("selected-view"),
    "page-" + MigrationWizardConstants.PAGES.SELECTION,
    "The wizard should wait on its selection page"
  );
  const selectedSource = wizardShadow.querySelector(
    "#browser-profile-selector"
  ).selectedPanelItem;
  Assert.equal(
    selectedSource.getAttribute("key"),
    InternalTestingProfileMigrator.key,
    "The wizard should open on the browser picked in the onboarding"
  );
  Assert.equal(
    selectedSource.profile?.id,
    InternalTestingProfileMigrator.testProfile.id,
    "The wizard should open on that browser's profile"
  );
  await BrowserTestUtils.closeWindow(wizardWin);
  await TestUtils.waitForCondition(
    () => currentPageContent()?.getAttribute("page") === "colors",
    "the onboarding to move on once the wizard closes"
  );
  await wait(800); // Let the page transition settle.

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

  await TestUtils.waitForCondition(
    () => currentPageContent()?.getAttribute("page") === "essentials",
    "the ad blocking page to be skipped when uBlock is unavailable"
  );
  ok(true, "Welcome Block Ads Step Test Finished");

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
