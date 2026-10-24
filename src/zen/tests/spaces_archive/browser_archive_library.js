/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const Library = customElements.get("zen-library");

async function openSpacesSection() {
  Library.toggle("spaces");
  const library = document.querySelector("zen-library");
  await TestUtils.waitForCondition(
    () =>
      Library.libraryProgress === 1 && !library.hasAttribute("transitioning"),
    "the library settles open"
  );
  const section = document.querySelector("zen-library-spaces-section");
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

add_task(async function test_library_lists_and_restores_archived() {
  const [first, second] = await createTestSpaces(2);
  await gZenWorkspaces.archiveWorkspace(second.uuid);
  const section = await openSpacesSection();

  ok(
    !section.querySelector(`.zen-library-space[data-uuid="${second.uuid}"]`),
    "Archived space has no card"
  );
  const entry = section.querySelector(
    `.zen-library-archived-space[data-uuid="${second.uuid}"]`
  );
  ok(entry, "Archived space is listed under Archived");

  entry.querySelector(".zen-library-archived-space-restore").click();
  await TestUtils.waitForCondition(
    () => gZenWorkspaces.activeWorkspace === second.uuid,
    "Restore switches to the space"
  );
  await section.updateComplete;
  ok(
    section.querySelector(`.zen-library-space[data-uuid="${second.uuid}"]`),
    "Restored space has a card again"
  );
  ok(
    !section.querySelector(".zen-library-archived-spaces"),
    "Archived area is gone once empty"
  );

  await closeLibrary();
  await gZenWorkspaces.changeWorkspace(first);
});

add_task(async function test_library_delete_asks_first() {
  const [, second] = await createTestSpaces(2);
  await gZenWorkspaces.archiveWorkspace(second.uuid);
  const section = await openSpacesSection();

  // XPCOM service methods can't be stubbed in place, so swap the service.
  const original = Services.prompt;
  let confirmCalls = 0;
  Services.prompt = {
    QueryInterface: ChromeUtils.generateQI([Ci.nsIPromptService]),
    confirm() {
      confirmCalls++;
      return true;
    },
  };
  section
    .querySelector(
      `.zen-library-archived-space[data-uuid="${second.uuid}"] .zen-library-archived-space-delete`
    )
    .click();
  await TestUtils.waitForCondition(
    () => !gZenWorkspaces.getWorkspaceFromId(second.uuid),
    "Confirmed delete removes the space"
  );
  Services.prompt = original;
  is(confirmCalls, 1, "Delete asks for confirmation first");

  await closeLibrary();
});
