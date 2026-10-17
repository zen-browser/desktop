/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function libraryClass() {
  return customElements.get("zen-library");
}

function searchInput(sectionId) {
  return document.querySelector(
    `zen-library [data-section="${sectionId}"] .zen-library-search-box input`
  );
}

async function waitForLibrary(open) {
  const Library = libraryClass();
  const lib = document.querySelector("zen-library");
  await TestUtils.waitForCondition(
    () =>
      !lib.hasAttribute("transitioning") &&
      Library.isLibraryOpen === open &&
      Library.libraryProgress === (open ? 1 : 0),
    `library ${open ? "opens" : "closes"}`
  );
}

async function closeLibrary() {
  if (libraryClass().isLibraryOpen) {
    libraryClass().toggle();
    await waitForLibrary(false);
  }
}

// Each section is opened fresh, again right after closing it (when only the
// library opening can focus it, as the section itself is not shown anew),
// and after the library was last left on the other section.
for (const sectionId of [
  "history",
  "history",
  "downloads",
  "downloads",
  "history",
]) {
  add_task(async function test_opening_on_section_focuses_its_search() {
    await closeLibrary();
    libraryClass().toggle(sectionId);
    await waitForLibrary(true);
    await TestUtils.waitForCondition(
      () =>
        searchInput(sectionId) &&
        document.activeElement === searchInput(sectionId),
      `${sectionId} search box gets focus`
    );
    ok(true, `opening the library on ${sectionId} focuses its search box`);
    await closeLibrary();
  });
}
