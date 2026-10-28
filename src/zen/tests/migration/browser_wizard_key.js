/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { InternalTestingProfileMigrator } = ChromeUtils.importESModule(
  "moz-src:///browser/components/migration/InternalTestingProfileMigrator.sys.mjs"
);

const { MigrationWizardConstants } = ChromeUtils.importESModule(
  "chrome://browser/content/migration/migration-wizard-constants.mjs"
);

async function openStartupWizard(options) {
  const opened = BrowserTestUtils.domWindowOpened();
  executeSoon(() => {
    MigrationUtils.showMigrationWizard(window, {
      isStartupMigration: true,
      ...options,
    });
  });
  const win = await opened;
  await BrowserTestUtils.waitForEvent(win, "MigrationWizard:Ready");
  const shadow = win.document.getElementById("wizard").openOrClosedShadowRoot;
  const selector = shadow.querySelector("#browser-profile-selector");
  const items = [...shadow.querySelectorAll("panel-item[key]")];
  const keys = items.map(item => item.getAttribute("key"));
  return { win, shadow, selector, keys };
}

const kZenDisplayNames = { arc: "Arc", dia: "Dia" };

function selectedKey(selector) {
  return selector.selectedPanelItem.getAttribute("key");
}

async function closeWizard(win) {
  await BrowserTestUtils.closeWindow(win);
  await Promise.allSettled(document.getAnimations().map(anim => anim.finished));
}

add_task(async function test_wizard_preselects_migrator_key() {
  let { win, shadow, selector, keys } = await openStartupWizard({});
  const defaultKey = selectedKey(selector);
  ok(
    keys.includes(InternalTestingProfileMigrator.key),
    "The testing migrator is listed"
  );
  try {
    for (const key of keys.filter(k => k in kZenDisplayNames)) {
      const item = shadow.querySelector(`panel-item[key="${key}"]`);
      await TestUtils.waitForCondition(
        () => item.textContent.trim().startsWith(kZenDisplayNames[key]),
        `The ${key} migrator shows its name from Zen's strings`
      );
      info(`${key} is listed as "${item.textContent.trim()}"`);
    }
  } finally {
    await closeWizard(win);
  }

  const wanted =
    keys.find(key => key !== defaultKey) ?? InternalTestingProfileMigrator.key;
  ({ win, selector } = await openStartupWizard({ migratorKey: wanted }));
  Assert.equal(
    selectedKey(selector),
    wanted,
    "The wizard opens on the browser it was asked for"
  );
  await closeWizard(win);
});

add_task(async function test_wizard_preselects_profile_with_data_expanded() {
  const { win, shadow, selector } = await openStartupWizard({
    migratorKey: InternalTestingProfileMigrator.key,
    profileId: InternalTestingProfileMigrator.testProfile.id,
  });
  Assert.equal(
    shadow.querySelector("#wizard-deck").getAttribute("selected-view"),
    "page-" + MigrationWizardConstants.PAGES.SELECTION,
    "The wizard waits on the selection page"
  );
  Assert.equal(
    selectedKey(selector),
    InternalTestingProfileMigrator.key,
    "The requested browser is selected"
  );
  Assert.equal(
    selector.selectedPanelItem.profile?.id,
    InternalTestingProfileMigrator.testProfile.id,
    "The requested profile is selected"
  );
  ok(
    shadow.querySelector("details.resource-selection-details").open,
    "The data list is expanded"
  );
  const checkboxes = shadow.querySelectorAll(
    "label[data-resource-type]:not([hidden]) > input"
  );
  Assert.greater(checkboxes.length, 0, "The data types are listed");
  ok(
    [...checkboxes].every(checkbox => BrowserTestUtils.isVisible(checkbox)),
    "Each data type is shown without expanding anything"
  );
  await closeWizard(win);
});

add_task(async function test_wizard_ignores_unknown_migrator_key() {
  const { win, selector, keys } = await openStartupWizard({
    migratorKey: "no-such-browser",
  });
  Assert.equal(
    selectedKey(selector),
    keys[0],
    "An unknown key leaves the first browser selected"
  );
  await closeWizard(win);
});
