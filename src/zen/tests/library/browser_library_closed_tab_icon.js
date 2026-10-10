/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

add_task(async function test_closed_tab_keeps_its_icon() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.library.history.closed-tabs", true]],
  });

  const url = "https://example.com/?closed-icon";
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, url);
  gBrowser.setIcon(tab, ICON);
  const closedCount = SessionStore.getClosedTabCountForWindow(window);
  BrowserTestUtils.removeTab(tab);
  await TestUtils.waitForCondition(
    () => SessionStore.getClosedTabCountForWindow(window) > closedCount,
    "the tab is remembered as closed"
  );
  is(
    SessionStore.getClosedTabData(window)[0].image,
    ICON,
    "session store kept the tab's icon"
  );

  const Library = customElements.get("zen-library");
  Library.toggle("history");
  let row;
  await TestUtils.waitForCondition(() => {
    const section = document.querySelector("zen-library-history-section");
    row = section?.querySelector(".zen-library-row");
    return row;
  }, "the closed tab is listed");

  const icon = row.querySelector(".zen-library-row-icon");
  ok(
    !icon.src.startsWith("page-icon:"),
    `the row uses the tab's own icon, not page-icon: (${icon.src})`
  );
  ok(icon.src.includes(ICON), "the row shows the icon the tab had");

  Library.toggle("history");
  await TestUtils.waitForCondition(
    () => !Library.isLibraryOpen && Library.libraryProgress === 0,
    "library closes"
  );
});
