/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PAGE =
  "data:text/html,<p id='text'>The quick brown fox jumps over the lazy dog</p>";

function library() {
  return document.querySelector("zen-library");
}

function libraryClass() {
  return customElements.get("zen-library");
}

async function openLibrary(section) {
  libraryClass().toggle(section);
  await TestUtils.waitForCondition(
    () =>
      libraryClass().isLibraryOpen &&
      libraryClass().libraryProgress === 1 &&
      !library().hasAttribute("transitioning") &&
      library().contains(document.activeElement),
    "The library opens with its search box focused"
  );
}

async function waitClosed() {
  await TestUtils.waitForCondition(
    () =>
      !libraryClass().isLibraryOpen &&
      libraryClass().libraryProgress === 0 &&
      !library().hasAttribute("transitioning"),
    "The library closes"
  );
}

add_task(async function test_urlbar_focus_and_selection_come_back() {
  gURLBar.focus();
  gURLBar.value = "hello world";
  gURLBar.inputField.setSelectionRange(2, 7);

  await openLibrary("history");
  EventUtils.synthesizeKey("KEY_Escape");
  await waitClosed();

  Assert.equal(
    document.activeElement,
    gURLBar.inputField,
    "The address bar has focus again"
  );
  Assert.equal(gURLBar.inputField.selectionStart, 2, "Selection start kept");
  Assert.equal(gURLBar.inputField.selectionEnd, 7, "Selection end kept");

  gURLBar.handleRevert();
  gBrowser.selectedBrowser.focus();
});

add_task(async function test_page_focus_and_selection_come_back() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    await SpecialPowers.spawn(browser, [], () => {
      const range = content.document.createRange();
      range.selectNodeContents(content.document.getElementById("text"));
      content.getSelection().removeAllRanges();
      content.getSelection().addRange(range);
    });
    browser.focus();

    for (const section of ["history", "downloads"]) {
      await openLibrary(section);
      libraryClass().toggle(section);
      await waitClosed();

      Assert.equal(
        document.activeElement,
        browser,
        `The page has focus again after closing ${section}`
      );
      const selected = await SpecialPowers.spawn(browser, [], () =>
        content.getSelection().toString()
      );
      Assert.equal(
        selected,
        "The quick brown fox jumps over the lazy dog",
        `The page selection is still there after closing ${section}`
      );
    }
  });
});

add_task(async function test_focus_moved_elsewhere_is_left_alone() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    browser.focus();
    await openLibrary("history");

    gURLBar.focus();
    libraryClass().toggle("history");
    await waitClosed();

    Assert.equal(
      document.activeElement,
      gURLBar.inputField,
      "Focus moved to the address bar while open stays there"
    );
    browser.focus();
  });
});

add_task(async function test_page_text_box_focus_comes_back() {
  const page = "data:text/html,<p>Search</p><input id='box' value='wiki'>";
  await BrowserTestUtils.withNewTab(page, async browser => {
    await SpecialPowers.spawn(browser, [], () => {
      const box = content.document.getElementById("box");
      box.focus();
      box.setSelectionRange(1, 3);
    });
    browser.focus();

    for (const section of ["history", "downloads"]) {
      await openLibrary(section);
      libraryClass().toggle(section);
      await waitClosed();

      Assert.equal(document.activeElement, browser, "The page has focus");
      const state = await SpecialPowers.spawn(browser, [], () => {
        const el = content.document.activeElement;
        return [
          el?.id,
          el?.selectionStart,
          el?.selectionEnd,
          content.document.hasFocus(),
        ];
      });
      Assert.deepEqual(
        state,
        ["box", 1, 3, true],
        `The text box has focus and its selection after closing ${section}`
      );
    }
  });
});
