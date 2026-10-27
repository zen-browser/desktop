/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { gZenSpaceRoutingManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/spacerouting/ZenSpaceRoutingManager.sys.mjs"
);

const Library = customElements.get("zen-library");

function clearRoutes() {
  for (const route of gZenSpaceRoutingManager.getAllRoutes()) {
    gZenSpaceRoutingManager.removeRoute(route.id);
  }
  gZenSpaceRoutingManager.saveRoutes();
}

async function openRoutingSection() {
  await closeLibrary();
  Library.toggle("space-routing");
  const library = document.querySelector("zen-library");
  await TestUtils.waitForCondition(
    () =>
      Library.libraryProgress === 1 && !library.hasAttribute("transitioning"),
    "the library settles open"
  );
  const section = document.querySelector("zen-library-space-routing-section");
  await section.updateComplete;
  return section;
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

async function fillReference(section, value) {
  const input = section.querySelector(".zen-library-routing-reference");
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await section.updateComplete;
  return input;
}

async function openPicker(picker) {
  const shown = BrowserTestUtils.waitForEvent(
    document.getElementById("mainPopupSet"),
    "popupshown",
    true
  );
  picker.click();
  const menu = (await shown).target;
  return menu;
}

async function pick(menu, item) {
  const hidden = BrowserTestUtils.waitForEvent(menu, "popuphidden");
  menu.activateItem(item);
  await hidden;
}

add_task(async function test_new_route_form_adds_a_route() {
  clearRoutes();
  const section = await openRoutingSection();

  Assert.ok(
    section.querySelector(".zen-library-empty"),
    "a profile with no routes says so"
  );

  section.querySelector(".zen-library-filter-button").click();
  await section.updateComplete;
  Assert.ok(
    section.querySelector(".zen-library-routing-form"),
    "the new button opens the form"
  );

  const save = section.querySelector(".zen-library-routing-save");
  Assert.ok(save.disabled, "there is nothing to add before a link is given");

  await fillReference(section, "zen-browser.app");
  Assert.ok(!save.disabled, "a link is all the form asks for");
  save.click();
  await section.updateComplete;

  const routes = gZenSpaceRoutingManager.getAllRoutes();
  Assert.equal(routes.length, 1, "the route was kept");
  Assert.equal(routes[0].reference, "zen-browser.app", "with its link");
  Assert.equal(routes[0].matchType, "contains", "and the match it was given");
  Assert.ok(
    !section.querySelector(".zen-library-search-top[open]"),
    "the form closes once the route is in"
  );
  Assert.equal(
    section.querySelectorAll(".zen-library-row").length,
    1,
    "and the route is in the list"
  );

  clearRoutes();
  await closeLibrary();
});

add_task(async function test_match_type_changes_what_is_saved() {
  clearRoutes();
  const section = await openRoutingSection();
  section.querySelector(".zen-library-filter-button").click();
  await section.updateComplete;

  const chips = section.querySelectorAll(
    ".zen-library-routing-match-types .zen-library-filter-chip"
  );
  Assert.equal(chips.length, 3, "the three ways to match a link are offered");
  chips[2].click();
  await section.updateComplete;

  const input = await fillReference(section, "zen-browser\\.app");
  Assert.equal(
    input.placeholder,
    "zen-browser\\.app",
    "the placeholder reads as a pattern once the match does"
  );
  section.querySelector(".zen-library-routing-save").click();
  await section.updateComplete;

  const [route] = gZenSpaceRoutingManager.getAllRoutes();
  Assert.equal(route.matchType, "regex", "the match type was kept");

  clearRoutes();
  await closeLibrary();
});

add_task(async function test_a_pattern_that_cannot_be_read_is_not_saved() {
  clearRoutes();
  const section = await openRoutingSection();
  section.querySelector(".zen-library-filter-button").click();
  await section.updateComplete;

  section
    .querySelectorAll(
      ".zen-library-routing-match-types .zen-library-filter-chip"
    )[2]
    .click();
  await section.updateComplete;

  const input = await fillReference(section, "zen-browser.app[");
  Assert.ok(input.hasAttribute("invalid"), "the field says it is no pattern");
  Assert.ok(
    section.querySelector(".zen-library-routing-save").disabled,
    "and there is nothing to add"
  );
  Assert.equal(
    gZenSpaceRoutingManager.getAllRoutes().length,
    0,
    "nothing was kept"
  );

  clearRoutes();
  await closeLibrary();
});

add_task(async function test_a_route_can_be_changed_and_taken_away() {
  clearRoutes();
  const route = gZenSpaceRoutingManager.createNewRoute();
  route.reference = "zen-browser.app";
  gZenSpaceRoutingManager.updateRoute(route);
  gZenSpaceRoutingManager.saveRoutes();

  const section = await openRoutingSection();
  section.querySelector(".zen-library-row").click();
  await section.updateComplete;
  Assert.equal(
    section.querySelector(".zen-library-routing-reference").value,
    "zen-browser.app",
    "a row opens the form on its own route"
  );

  await fillReference(section, "docs.zen-browser.app");
  section.querySelector(".zen-library-routing-save").click();
  await section.updateComplete;

  let routes = gZenSpaceRoutingManager.getAllRoutes();
  Assert.equal(routes.length, 1, "the route was changed rather than added to");
  Assert.equal(
    routes[0].reference,
    "docs.zen-browser.app",
    "with its new link"
  );

  section
    .querySelector(".zen-library-row .zen-library-row-actions toolbarbutton")
    .click();
  await section.updateComplete;
  Assert.equal(
    gZenSpaceRoutingManager.getAllRoutes().length,
    0,
    "the route was taken away"
  );

  clearRoutes();
  await closeLibrary();
});

add_task(async function test_escape_closes_the_form_and_leaves_the_library() {
  clearRoutes();
  const section = await openRoutingSection();
  section.querySelector(".zen-library-filter-button").click();
  await section.updateComplete;
  Assert.ok(
    section.querySelector(".zen-library-routing-form"),
    "the form is up"
  );

  EventUtils.synthesizeKey("KEY_Escape");
  await section.updateComplete;
  Assert.ok(
    !section.querySelector(".zen-library-search-top[open]"),
    "escape puts the form away"
  );
  Assert.ok(Library.isLibraryOpen, "and leaves the library where it was");

  await closeLibrary();
});

add_task(async function test_footer_sets_where_other_apps_land() {
  clearRoutes();
  gZenSpaceRoutingManager.setDefaultExternalRoute("most-recent-space");
  const section = await openRoutingSection();

  const footer = section.querySelector(".zen-library-routing-footer");
  Assert.ok(footer, "the footer is under the list");
  const picker = footer.querySelector(".zen-library-routing-select");
  const menu = await openPicker(picker);
  const space = [...menu.children].find(
    item => item.dataset.value !== "most-recent-space"
  );
  Assert.ok(space, "the spaces of this window are offered");
  const recent = menu.firstElementChild;
  Assert.ok(
    !recent.hasAttribute("image"),
    "landing wherever the user was last is shown without an icon"
  );
  await document.l10n.translateFragment(menu);
  Assert.equal(
    recent.getAttribute("label"),
    "Most recent space",
    "and it is named"
  );

  const value = space.dataset.value;
  await pick(menu, space);
  await section.updateComplete;
  Assert.equal(
    gZenSpaceRoutingManager.getDefaultExternalRoute(),
    value,
    "picking a space is where links from other apps go now"
  );

  gZenSpaceRoutingManager.setDefaultExternalRoute("most-recent-space");
  gZenSpaceRoutingManager.saveRoutes();
  await closeLibrary();
});

add_task(async function test_closing_the_library_puts_the_form_away() {
  clearRoutes();
  const section = await openRoutingSection();
  section.querySelector(".zen-library-filter-button").click();
  await section.updateComplete;
  await fillReference(section, "zen-browser.app");

  await closeLibrary();
  await section.updateComplete;
  Assert.ok(
    !section.querySelector(".zen-library-routing-form"),
    "the form is gone with the library it was open in"
  );

  const reopened = await openRoutingSection();
  Assert.ok(
    !reopened.querySelector(".zen-library-routing-form"),
    "and the library does not open back onto it"
  );
  Assert.equal(
    gZenSpaceRoutingManager.getAllRoutes().length,
    0,
    "what was being written was not kept"
  );

  await closeLibrary();
});
