/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */
/* eslint-disable mozilla/no-arbitrary-setTimeout */

"use strict";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({ set: [["ui.tooltip.delay_ms", 0]] });
});

add_task(async function () {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "data:text/html,<!DOCTYPE html>",
    },
    async function (browser) {
      info("Moving mouse out of the way.");
      await EventUtils.synthesizeAndWaitNativeMouseMove(browser, 300, 300);

      await SpecialPowers.spawn(browser, [], function () {
        let widget = content.document.insertAnonymousContent();
        widget.root.innerHTML = `<button style="pointer-events: auto; position: absolute; width: 200px; height: 200px;" title="foo">bar</button>`;
        let tttp = Cc[
          "@mozilla.org/embedcomp/default-tooltiptextprovider;1"
        ].getService(Ci.nsITooltipTextProvider);

        let text = {};
        let dir = {};
        ok(
          tttp.getNodeText(widget.root.querySelector("button"), text, dir),
          "A tooltip should be shown for NAC"
        );
        is(text.value, "foo", "Tooltip text should be correct");
      });

      let awaitTooltipOpen = new Promise(resolve => {
        let tooltipId = Services.appinfo.browserTabsRemoteAutostart
          ? "remoteBrowserTooltip"
          : "aHTMLTooltip";
        let tooltip = document.getElementById(tooltipId);
        tooltip.addEventListener(
          "popupshown",
          function (event) {
            resolve(event.target);
          },
          { once: true }
        );
      });

      info("Initial mouse move");
      await EventUtils.synthesizeAndWaitNativeMouseMove(browser, 50, 5);
      info("Waiting");
      await new Promise(resolve => setTimeout(resolve, 400));
      info("Second mouse move");
      await EventUtils.synthesizeAndWaitNativeMouseMove(browser, 70, 5);
      info("Waiting for tooltip to open");
      let tooltip = await awaitTooltipOpen;
      is(
        tooltip.getAttribute("label"),
        "foo",
        "tooltip label should match expectation"
      );
    }
  );
});
