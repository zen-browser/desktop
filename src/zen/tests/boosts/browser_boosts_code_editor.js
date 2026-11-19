/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { gZenBoostsManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs"
);

const DOMAIN = "example.com";
const PAGE = "https://example.com/";
const ORIGINAL_CSS = "body { color: rgb(1, 2, 3); }\n/* Keep this CSS. */";
const ADDED_CSS = "p { font-size: 18px; }\n";

async function openCodeEditor(boost, browser) {
  const editor = gZenBoostsManager.openBoostWindow(
    window,
    boost,
    Services.io.newURI(PAGE),
    { browser }
  );
  await BrowserTestUtils.waitForEvent(editor, "load");
  await TestUtils.waitForCondition(
    () => editor.boostEditor?.codeEditorReady,
    "The CSS editor should finish loading"
  );
  editor.boostEditor.onCodeButtonPressed();
  return editor;
}

async function closeCodeEditor(editor) {
  const closed = BrowserTestUtils.windowClosed(editor);
  editor.close();
  await closed;
}

async function waitForSavedCSS(boost, expected) {
  const path = PathUtils.join(
    PathUtils.profileDir,
    "zen-boosts",
    `${boost.id}.css`
  );
  await TestUtils.waitForCondition(async () => {
    if (!(await IOUtils.exists(path))) {
      return false;
    }
    return (await IOUtils.readUTF8(path)) === expected;
  }, "The saved CSS file should preserve the complete editor contents");
}

async function withBoostEditor(data, task) {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    const boost = gZenBoostsManager.createNewBoost(DOMAIN);
    boost.boostEntry.boostData = data;
    gZenBoostsManager.makeBoostActiveForDomain(DOMAIN, boost.id);
    gZenBoostsManager.saveBoostToStore(boost);
    let editor;
    try {
      editor = await openCodeEditor(boost, browser);
      await task(editor, boost, browser);
    } finally {
      if (editor && !editor.closed) {
        await closeCodeEditor(editor);
      }
      gZenBoostsManager.deleteBoost(boost);
    }
  });
}

add_task(async function test_existing_css_survives_editing_and_reopening() {
  for (const variant of [
    "complete",
    "missing-primary",
    "missing-secondary",
    "null-positions",
    "partial-positions",
    "minimal",
  ]) {
    const defaults = gZenBoostsManager.getEmptyBoostEntry().boostData;
    let data = structuredClone(defaults);
    switch (variant) {
      case "missing-primary":
        delete data.dotPos;
        break;
      case "missing-secondary":
        delete data.secondaryDotPos;
        break;
      case "null-positions":
        data.dotPos = null;
        data.secondaryDotPos = null;
        break;
      case "partial-positions":
        data.dotPos = { x: 0.25 };
        data.secondaryDotPos = { y: 0.75 };
        break;
      case "minimal":
        data = {};
        break;
    }
    data.customCSS = ORIGINAL_CSS;
    data.changeWasMade = true;
    const expectedPrimary = { ...defaults.dotPos, ...data.dotPos };
    const expectedSecondary = {
      ...defaults.secondaryDotPos,
      ...data.secondaryDotPos,
    };

    await withBoostEditor(data, async (editor, boost, browser) => {
      is(
        editor._editor.getText(),
        ORIGINAL_CSS,
        `${variant}: load existing CSS`
      );
      Assert.deepEqual(
        editor.boostEditor.currentBoostData.dotPos,
        expectedPrimary,
        `${variant}: retain primary coordinates and default missing coordinates`
      );
      Assert.deepEqual(
        editor.boostEditor.currentBoostData.secondaryDotPos,
        expectedSecondary,
        `${variant}: retain secondary coordinates and default missing coordinates`
      );
      editor._editor.codeMirror.replaceRange(ADDED_CSS, { line: 0, ch: 0 });
      const expected = ADDED_CSS + ORIGINAL_CSS;
      is(
        editor.boostEditor.currentBoostData.customCSS,
        expected,
        `${variant}: edits should keep the previous CSS`
      );
      await closeCodeEditor(editor);
      await waitForSavedCSS(boost, expected);

      const reopened = await openCodeEditor(boost, browser);
      try {
        is(
          reopened._editor.getText(),
          expected,
          `${variant}: reopen with all CSS`
        );
      } finally {
        await closeCodeEditor(reopened);
      }
      await waitForSavedCSS(boost, expected);
    });
  }
});

add_task(async function test_imported_css_and_reset_update_the_editor() {
  const data = gZenBoostsManager.getEmptyBoostEntry().boostData;
  data.customCSS = ORIGINAL_CSS;
  data.changeWasMade = true;
  await withBoostEditor(data, async (editor, boost) => {
    const importedCSS = "a { text-decoration: underline; }";
    const originalImport = gZenBoostsManager.importBoost;
    try {
      gZenBoostsManager.importBoost = async () => ({
        customCSS: importedCSS,
        changeWasMade: true,
      });
      await editor.boostEditor.onLoadBoostClick();
    } finally {
      gZenBoostsManager.importBoost = originalImport;
    }
    is(
      editor._editor.getText(),
      importedCSS,
      "Import should replace the editor CSS"
    );
    editor._editor.codeMirror.replaceRange(ADDED_CSS, { line: 0, ch: 0 });
    is(
      editor.boostEditor.currentBoostData.customCSS,
      ADDED_CSS + importedCSS,
      "Editing an incomplete import should retain the imported CSS"
    );
    editor.boostEditor.resetBoost();
    is(editor._editor.getText(), "", "Reset should clear the CSS editor");
    await closeCodeEditor(editor);
    await TestUtils.waitForCondition(
      async () =>
        !(await IOUtils.exists(
          PathUtils.join(PathUtils.profileDir, "zen-boosts", `${boost.id}.css`)
        )),
      "Reset should remove the saved custom CSS"
    );
  });
});

add_task(async function test_opening_an_empty_boost_does_not_mark_it_changed() {
  await withBoostEditor(
    gZenBoostsManager.getEmptyBoostEntry().boostData,
    async editor => {
      is(
        editor._editor.getText(),
        "",
        "A new Boost should have an empty editor"
      );
      ok(
        !editor.boostEditor.currentBoostData.changeWasMade,
        "Loading the editor should not count as a user edit"
      );
    }
  );
});
