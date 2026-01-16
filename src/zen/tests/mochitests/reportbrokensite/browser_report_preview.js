/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/* Helper methods for testing sending reports with
 * the Report Broken Site feature.
 */

/* import-globals-from head.js */

function setClipboard(string) {
  Cc["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Ci.nsIClipboardHelper)
    .copyString(string);
}

function getClipboardAsString() {
  let trans = Cc["@mozilla.org/widget/transferable;1"].createInstance(
    Ci.nsITransferable
  );
  trans.init(window.docShell.QueryInterface(Ci.nsILoadContext));
  trans.addDataFlavor("text/plain");
  Services.clipboard.getData(
    trans,
    Ci.nsIClipboard.kGlobalClipboard,
    SpecialPowers.wrap(window).browsingContext.currentWindowContext
  );
  let data = {};
  trans.getTransferData("text/plain", data);
  data = data.value.QueryInterface(Ci.nsISupportsString);
  return data.toString();
}

async function checkPreviewPanel(rbs, basic) {
  const items = rbs.previewItems.querySelectorAll("details");

  let target = await pressKeyAndGetFocus("VK_TAB");
  ok(
    target.matches("toolbarbutton.subviewbutton-back"),
    "First focus is on back button"
  );
  const previewData = {};
  for (const [idx, item] of items.entries()) {
    target = await pressKeyAndGetFocus("VK_TAB");
    const summary = item.querySelector("summary");
    is(target, summary, "Next focus is on next preview item");

    is(
      item.getAttribute("open"),
      idx ? null : "",
      `Next preview item starts off ${idx ? "closed" : "open"}`
    );
    let text = item.querySelector(".data").innerText;

    EventUtils.synthesizeKey("VK_SPACE");
    is(
      item.getAttribute("open"),
      idx ? "" : null,
      `Next preview item properly ${idx ? "opens" : "closes"}`
    );

    text ||= item.querySelector(".data").innerText;

    EventUtils.synthesizeKey("VK_SPACE");
    is(
      item.getAttribute("open"),
      idx ? null : "",
      `Next preview item properly ${idx ? "closes" : "opens"} again`
    );

    previewData[summary.innerText] = Object.fromEntries(
      text.split("\n").map(line => {
        const s = line.split(":");
        const label = s.shift();
        const value = s.join(":");
        return [label, JSON.parse(value)];
      })
    );
  }

  function adjustForWrapping(value) {
    // match what we do to strings when generating the preview markup.
    return typeof value === "string"
      ? value.replaceAll(":", ": ").replaceAll(",", ", ")
      : value;
  }

  const expectedPreviewData = {
    basic: Object.fromEntries(
      Object.entries(basic).map(([n, v]) => [n, adjustForWrapping(v)])
    ),
  };
  const rawReportData = structuredClone(
    await ViewState.get(document).currentTabWebcompatDetailsPromise
  );
  if (!rbs.blockedTrackersCheckbox.checked) {
    delete rawReportData.antitracking.blockedOrigins;
  }
  for (const [category, values] of Object.entries(rawReportData)) {
    expectedPreviewData[category] = Object.fromEntries(
      Object.entries(values)
        .filter(([_, { do_not_preview }]) => !do_not_preview)
        .map(([name, { value }]) => [name, adjustForWrapping(value)])
    );
  }
  ok(
    areObjectsEqual(previewData, expectedPreviewData),
    "Preview had the expected information"
  );
}

add_task(async function testPreview() {
  ensureReportBrokenSitePreffedOn();

  const tab = await openTab(REPORTABLE_PAGE_URL);

  ViewState.get(document).reset();

  const menu = AppMenu();
  const url = menu.win.gBrowser.currentURI.spec;
  let rbs = await menu.openAndPrefillReportBrokenSite();

  await rbs.clickPreview();
  await checkPreviewPanel(rbs, {
    description: "",
    reason: "",
    url,
  });

  await rbs.clickPreviewBack();
  const url2 = `${url}?test`;
  rbs.setURL(url2);
  rbs.setDescription("description");
  rbs.chooseReason("slow");
  rbs.blockedTrackersCheckbox = true;
  await rbs.clickPreview();
  await checkPreviewPanel(rbs, {
    description: "description",
    reason: ViewState.get(document).reasonText,
    url: url2,
  });

  await rbs.close();

  ViewState.get(document).reset();

  closeTab(tab);
});
