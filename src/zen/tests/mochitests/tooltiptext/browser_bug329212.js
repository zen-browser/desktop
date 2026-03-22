"use strict";

add_task(async function () {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "http://mochi.test:8888/browser/toolkit/components/tooltiptext/tests/title_test.svg",
    },
    async function (browser) {
      await SpecialPowers.spawn(browser, [""], function () {
        let tttp = Cc[
          "@mozilla.org/embedcomp/default-tooltiptextprovider;1"
        ].getService(Ci.nsITooltipTextProvider);
        function checkElement(id, expectedTooltipText) {
          let el = content.document.getElementById(id);
          let textObj = {};
          let shouldHaveTooltip = expectedTooltipText !== null;
          is(
            tttp.getNodeText(el, textObj, {}),
            shouldHaveTooltip,
            "element " +
              id +
              " should " +
              (shouldHaveTooltip ? "" : "not ") +
              "have a tooltip"
          );
          if (shouldHaveTooltip) {
            is(
              textObj.value,
              expectedTooltipText,
              "element " + id + " should have the right tooltip text"
            );
          }
        }
        checkElement("svg1", "This is a non-root SVG element title");
        checkElement("text1", "\n\n\n    This            is a title\n\n    ");
        checkElement("text2", null);
        checkElement("text3", null);
        checkElement("link1", "\n      This is a title\n    ");
        checkElement("text4", "\n      This is a title\n    ");
        checkElement("link2", null);
        checkElement("link3", "This is an xlink:title attribute");
        checkElement("link4", "This is an xlink:title attribute");
        checkElement("text5", null);
      });
    }
  );
});
