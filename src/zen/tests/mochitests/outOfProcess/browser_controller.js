add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["test.wait300msAfterTabSwitch", true]],
  });
});

function checkCommandState(testid, undoEnabled, copyEnabled, deleteEnabled) {
  is(
    !document.getElementById("cmd_undo").hasAttribute("disabled"),
    undoEnabled,
    testid + " undo"
  );
  is(
    !document.getElementById("cmd_copy").hasAttribute("disabled"),
    copyEnabled,
    testid + " copy"
  );
  is(
    !document.getElementById("cmd_delete").hasAttribute("disabled"),
    deleteEnabled,
    testid + " delete"
  );
}

function keyAndUpdate(key, eventDetails, updateEventsCount) {
  let updatePromise = BrowserTestUtils.waitForEvent(
    window,
    "commandupdate",
    false,
    () => {
      return --updateEventsCount == 0;
    }
  );
  EventUtils.synthesizeKey(key, eventDetails);
  return updatePromise;
}

add_task(async function test_controllers_subframes() {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    OOP_BASE_PAGE_URI
  );
  let browser = tab.linkedBrowser;
  let browsingContexts = await initChildFrames(
    browser,
    "<input id='input'><br><br>"
  );

  gURLBar.focus();

  for (let stepNum = 0; stepNum < browsingContexts.length; stepNum++) {
    let useTab = stepNum > 0;
    await keyAndUpdate(useTab ? "VK_TAB" : "VK_F6", {}, 4);

    // Since focus may be switching into a separate process here,
    // need to wait for the focus to have been updated.
    await SpecialPowers.spawn(browsingContexts[stepNum], [], () => {
      return ContentTaskUtils.waitForCondition(
        () => content.browsingContext.isActive && content.document.hasFocus()
      );
    });

    // Force the UI to update on platforms that don't
    // normally do so until menus are opened.
    goUpdateGlobalEditMenuItems(true);

    await SpecialPowers.spawn(browsingContexts[stepNum], [{ useTab }], args => {
      // Both the tab key and document navigation with F6 will focus
      // the root of the document within the frame.
      // When dom.disable_tab_focus_to_root_element is true, only F6 will do this.
      let document = content.document;
      let expectedElement = !args.useTab
        ? document.documentElement
        : document.getElementById("input");
      Assert.equal(document.activeElement, expectedElement, "root focused");
    });

    if (!useTab) {
      // XXX Currently, Copy is always enabled when the root (not an editor element)
      // is focused. Possibly that should only be true if a listener is present?
      checkCommandState(
        "step " + stepNum + " root focused",
        false,
        true,
        false
      );

      // Tab to the textbox.
      await keyAndUpdate("VK_TAB", {}, 1);
    }

    goUpdateGlobalEditMenuItems(true);

    await SpecialPowers.spawn(browsingContexts[stepNum], [], () => {
      Assert.equal(
        content.document.activeElement,
        content.document.getElementById("input"),
        "input focused"
      );
    });
    checkCommandState(
      "step " + stepNum + " input focused",
      false,
      false,
      false
    );

    // Type into the textbox.
    await keyAndUpdate("a", {}, 1);
    checkCommandState("step " + stepNum + " typed", true, false, false);

    await SpecialPowers.spawn(browsingContexts[stepNum], [], () => {
      Assert.equal(
        content.document.activeElement,
        content.document.getElementById("input"),
        "input focused"
      );
    });

    // Select all text; this causes the Copy and Delete commands to be enabled.
    await keyAndUpdate("a", { accelKey: true }, 1);
    goUpdateGlobalEditMenuItems(true);

    checkCommandState("step " + stepNum + " selected", true, true, true);

    // Now make sure that the text is selected.
    await SpecialPowers.spawn(browsingContexts[stepNum], [], () => {
      let input = content.document.getElementById("input");
      Assert.equal(input.value, "a", "text matches");
      Assert.equal(input.selectionStart, 0, "selectionStart matches");
      Assert.equal(input.selectionEnd, 1, "selectionEnd matches");
    });
  }

  BrowserTestUtils.removeTab(tab);
});
