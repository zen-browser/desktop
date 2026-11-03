/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function getColor(aSpawnTarget) {
  return SpecialPowers.spawn(aSpawnTarget, [], function () {
    return content.document.defaultView.getComputedStyle(
      content.document.querySelector("p")
    ).color;
  });
}

async function insertIFrame() {
  let bc = gBrowser.selectedBrowser.browsingContext;
  let len = bc.children.length;

  const kURL =
    WEB_ROOT.replace("example.com", "example.net") + "page_style.html";
  await SpecialPowers.spawn(gBrowser.selectedBrowser, [kURL], function (url) {
    return new Promise(function (resolve) {
      let e = content.document.createElement("iframe");
      e.src = url;
      e.onload = () => resolve();
      content.document.body.append(e);
    });
  });

  // Wait for the new frame to get a pres shell and be styled.
  await TestUtils.waitForCondition(async function () {
    return (
      bc.children.length == len + 1 && (await getColor(bc.children[len])) != ""
    );
  });
}

// Test that inserting an iframe with a URL that is loaded OOP with Fission
// enabled correctly matches the tab's author style disabled state.
add_task(async function test_disable_style() {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    WEB_ROOT + "page_style.html",
    /* waitForLoad = */ true
  );

  let bc = gBrowser.selectedBrowser.browsingContext;

  await insertIFrame();

  is(
    await getColor(bc),
    "rgb(0, 0, 255)",
    "parent color before disabling style"
  );
  is(
    await getColor(bc.children[0]),
    "rgb(0, 0, 255)",
    "first child color before disabling style"
  );

  gPageStyleMenu.disableStyle();

  is(await getColor(bc), "rgb(0, 0, 0)", "parent color after disabling style");
  is(
    await getColor(bc.children[0]),
    "rgb(0, 0, 0)",
    "first child color after disabling style"
  );

  await insertIFrame();

  is(
    await getColor(bc.children[1]),
    "rgb(0, 0, 0)",
    "second child color after disabling style"
  );

  await BrowserTestUtils.reloadTab(tab, {
    includeSubFrames: true,
  });

  // Check the menu:
  let { menupopup } = document.getElementById("pageStyleMenu");
  gPageStyleMenu.fillPopup(menupopup);
  Assert.equal(
    menupopup.querySelector("menuitem[checked]").dataset.l10nId,
    "menu-view-page-style-no-style",
    "No style menu should be checked."
  );

  // check the page content still has a disabled author style:
  Assert.ok(
    await SpecialPowers.spawn(
      tab.linkedBrowser,
      [],
      () => content.docShell.docViewer.authorStyleDisabled
    ),
    "Author style should still be disabled."
  );

  BrowserTestUtils.removeTab(tab);
});
