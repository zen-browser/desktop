/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function fillPopupAndGetItems() {
  let menupopup = document.getElementById("pageStyleMenu").menupopup;
  gPageStyleMenu.fillPopup(menupopup);
  return Array.from(menupopup.querySelectorAll("menuseparator ~ menuitem"));
}

function getRootColor() {
  return SpecialPowers.spawn(gBrowser.selectedBrowser, [], function () {
    return content.document.defaultView.getComputedStyle(
      content.document.documentElement
    ).color;
  });
}

const RED = "rgb(255, 0, 0)";
const LIME = "rgb(0, 255, 0)";
const BLUE = "rgb(0, 0, 255)";

const kStyleSheetsInPageStyleSample = 18;

/*
 * Test that the right stylesheets do (and others don't) show up
 * in the page style menu.
 */
add_task(async function test_menu() {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:blank",
    false
  );
  let browser = tab.linkedBrowser;
  BrowserTestUtils.startLoadingURIString(
    browser,
    WEB_ROOT + "page_style_sample.html"
  );
  await promiseStylesheetsLoaded(browser, kStyleSheetsInPageStyleSample);

  let menuitems = fillPopupAndGetItems();
  let items = menuitems.map(el => ({
    label: el.getAttribute("label"),
    checked: el.hasAttribute("checked"),
  }));

  let validLinks = await SpecialPowers.spawn(
    gBrowser.selectedBrowser,
    [items],
    function (contentItems) {
      let contentValidLinks = 0;
      for (let el of content.document.querySelectorAll("link, style")) {
        var title = el.getAttribute("title");
        var rel = el.getAttribute("rel");
        var media = el.getAttribute("media");
        var idstring =
          el.nodeName +
          " " +
          (title ? title : "without title and") +
          ' with rel="' +
          rel +
          '"' +
          (media ? ' and media="' + media + '"' : "");

        var item = contentItems.filter(aItem => aItem.label == title);
        var found = item.length == 1;
        var checked = found && item[0].checked;

        switch (el.getAttribute("data-state")) {
          case "0":
            ok(!found, idstring + " should not show up in page style menu");
            break;
          case "1":
            contentValidLinks++;
            ok(found, idstring + " should show up in page style menu");
            ok(!checked, idstring + " should not be selected");
            break;
          case "2":
            contentValidLinks++;
            ok(found, idstring + " should show up in page style menu");
            ok(checked, idstring + " should be selected");
            break;
          default:
            throw new Error(
              "data-state attribute is missing or has invalid value"
            );
        }
      }
      return contentValidLinks;
    }
  );

  ok(menuitems.length, "At least one item in the menu");
  is(menuitems.length, validLinks, "all valid links found");

  is(await getRootColor(), LIME, "Root should be lime (styles should apply)");

  let disableStyles = document.getElementById("menu_pageStyleNoStyle");
  let defaultStyles = document.getElementById("menu_pageStylePersistentOnly");
  let otherStyles = menuitems[0].parentNode.querySelector("[label='28']");

  // Assert that the menu works as expected.
  disableStyles.click();

  await TestUtils.waitForCondition(async function () {
    let color = await getRootColor();
    return color != LIME && color != BLUE;
  }, "ensuring disabled styles work");

  otherStyles.click();

  await TestUtils.waitForCondition(async function () {
    let color = await getRootColor();
    return color == BLUE;
  }, "ensuring alternate styles work. clicking on: " + otherStyles.label);

  defaultStyles.click();

  info("ensuring default styles work");
  await TestUtils.waitForCondition(async function () {
    let color = await getRootColor();
    return color == LIME;
  }, "ensuring default styles work");

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_default_style_with_no_sheets() {
  const PAGE = WEB_ROOT + "page_style_only_alternates.html";
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: PAGE,
      waitForLoad: true,
    },
    async function (browser) {
      await promiseStylesheetsLoaded(browser, 2);

      let menuitems = fillPopupAndGetItems();
      is(menuitems.length, 2, "Should've found two style sets");
      is(
        await getRootColor(),
        BLUE,
        "First found style should become the preferred one and apply"
      );

      // Reset the styles.
      document.getElementById("menu_pageStylePersistentOnly").click();
      await TestUtils.waitForCondition(async function () {
        let color = await getRootColor();
        return color != BLUE && color != RED;
      });

      ok(
        true,
        "Should reset the style properly even if there are no non-alternate stylesheets"
      );
    }
  );
});

add_task(async function test_page_style_file() {
  const FILE_PAGE = Services.io.newFileURI(
    new FileUtils.File(getTestFilePath("page_style_sample.html"))
  ).spec;
  await BrowserTestUtils.withNewTab(FILE_PAGE, async function (browser) {
    await promiseStylesheetsLoaded(browser, kStyleSheetsInPageStyleSample);
    let menuitems = fillPopupAndGetItems();
    is(
      menuitems.length,
      kStyleSheetsInPageStyleSample,
      "Should have the right amount of items even for file: URI."
    );
  });
});
