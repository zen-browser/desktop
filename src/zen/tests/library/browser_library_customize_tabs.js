/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const HIDDEN_TABS_PREF = "zen.library.hidden-tabs";

const Library = customElements.get("zen-library");

registerCleanupFunction(() => {
  Services.prefs.clearUserPref(HIDDEN_TABS_PREF);
});

async function openLibrary() {
  if (!Library.isLibraryOpen) {
    Library.toggle("history");
  }
  const library = document.querySelector("zen-library");
  await TestUtils.waitForCondition(
    () =>
      Library.libraryProgress === 1 && !library.hasAttribute("transitioning"),
    "the library settles open"
  );
  await library.updateComplete;
  return library;
}

async function closeLibrary() {
  if (!Library.isLibraryOpen) {
    return;
  }
  Library.toggle();
  await TestUtils.waitForCondition(
    () => !Library.isLibraryOpen && Library.libraryProgress === 0,
    "the library settles closed"
  );
}

function railIds(library) {
  return [
    ...library.querySelectorAll("#zen-library-sidebar-tabs .zen-library-tab"),
  ].map(tab => tab.dataset.section);
}

add_task(async function test_a_tab_can_be_taken_out_and_put_back() {
  Services.prefs.clearUserPref(HIDDEN_TABS_PREF);
  const library = await openLibrary();
  const shown = railIds(library);

  document.getElementById("zen-library-customize-button").doCommand();
  await library.updateComplete;
  Assert.ok(library.hasAttribute("customizing"), "the rail is up for changes");

  // Something other than the tab being looked at, to keep the two apart.
  const spare = shown.find(id => id !== library.activeTab);
  const tab = library.querySelector(
    `.zen-library-tab[data-section="${spare}"]`
  );
  tab.querySelector(".zen-library-tab-toggle").click();
  await library.updateComplete;

  Assert.equal(
    Services.prefs.getStringPref(HIDDEN_TABS_PREF),
    spare,
    "the tab was taken out"
  );
  Assert.ok(
    library
      .querySelector(`.zen-library-tab[data-section="${spare}"]`)
      .hasAttribute("hidden-tab"),
    "and says so while the rail is up for changes"
  );

  document.getElementById("zen-library-customize-button").doCommand();
  await library.updateComplete;
  Assert.ok(!library.hasAttribute("customizing"), "the rail is settled again");
  Assert.ok(
    !railIds(library).includes(spare),
    "a tab taken out is not in the rail"
  );

  document.getElementById("zen-library-customize-button").doCommand();
  await library.updateComplete;
  library
    .querySelector(
      `.zen-library-tab[data-section="${spare}"] .zen-library-tab-toggle`
    )
    .click();
  await library.updateComplete;
  Assert.equal(
    Services.prefs.getStringPref(HIDDEN_TABS_PREF),
    "",
    "and it can be put back"
  );

  document.getElementById("zen-library-customize-button").doCommand();
  await library.updateComplete;
  Assert.deepEqual(railIds(library), shown, "leaving the rail as it was");
  await closeLibrary();
});

add_task(async function test_the_tab_being_looked_at_moves_aside() {
  Services.prefs.clearUserPref(HIDDEN_TABS_PREF);
  const library = await openLibrary();
  const active = library.activeTab;

  document.getElementById("zen-library-customize-button").doCommand();
  await library.updateComplete;
  library
    .querySelector(
      `.zen-library-tab[data-section="${active}"] .zen-library-tab-toggle`
    )
    .click();
  await library.updateComplete;

  Assert.notEqual(
    library.activeTab,
    active,
    "taking out the tab being looked at moves to one that is left"
  );
  Assert.ok(
    !Services.prefs.getStringPref(HIDDEN_TABS_PREF).includes(library.activeTab),
    "and the one it moved to is in the rail"
  );

  document.getElementById("zen-library-customize-button").doCommand();
  Services.prefs.clearUserPref(HIDDEN_TABS_PREF);
  await library.updateComplete;
  await closeLibrary();
});

add_task(async function test_closing_the_library_is_done_choosing() {
  Services.prefs.clearUserPref(HIDDEN_TABS_PREF);
  const library = await openLibrary();

  document.getElementById("zen-library-customize-button").doCommand();
  await library.updateComplete;
  Assert.ok(library.hasAttribute("customizing"), "the rail is up for changes");

  await closeLibrary();
  await library.updateComplete;
  Assert.ok(
    !library.hasAttribute("customizing"),
    "closing the library is done choosing tabs"
  );
  Assert.ok(
    !library.querySelector(".zen-library-tab-toggle"),
    "and the handles are gone with it"
  );
});
