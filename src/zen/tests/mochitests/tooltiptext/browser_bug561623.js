add_task(async function () {
  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "data:text/html,<!DOCTYPE html><html><body><input id='i'></body></html>",
    },
    async function (browser) {
      await SpecialPowers.spawn(browser, [""], function () {
        let tttp = Cc[
          "@mozilla.org/embedcomp/default-tooltiptextprovider;1"
        ].getService(Ci.nsITooltipTextProvider);
        let i = content.document.getElementById("i");

        ok(
          !tttp.getNodeText(i, {}, {}),
          "No tooltip should be shown when @title is null"
        );

        i.title = "foo";
        ok(
          tttp.getNodeText(i, {}, {}),
          "A tooltip should be shown when @title is not the empty string"
        );

        i.pattern = "bar";
        ok(
          tttp.getNodeText(i, {}, {}),
          "A tooltip should be shown when @title is not the empty string"
        );
      });
    }
  );
});
