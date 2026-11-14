/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// The glance child measures the element under a mousedown and sends it to the
// parent, so a glance can animate out of it. Measuring flushes layout in the
// page, so it should only happen for presses a glance can follow.

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

const LINK_WIDTH = 120;
const PLAIN_WIDTH = 200;

// The page cancels link navigation and the context menu, so the presses below
// have no side effects.
const PAGE = `https://example.com/document-builder.sjs?html=${encodeURIComponent(`
  <!doctype html>
  <style>
    body { margin: 0; }
    #link { display: block; width: ${LINK_WIDTH}px; height: 40px; }
    #plain { width: ${PLAIN_WIDTH}px; height: 200px; }
  </style>
  <body oncontextmenu="event.preventDefault()">
    <a id="link" href="https://example.org/"
       onclick="event.preventDefault()">link</a>
    <div id="plain">plain</div>
  </body>
`)}`;

/**
 * Spies on the click data the parent receives from the glance child.
 *
 * @param {Browser} browser
 * @returns {{sandbox: object, measuredWidths: Function}}
 */
function spyOnClickData(browser) {
  const sandbox = sinon.createSandbox();
  const spy = sandbox.spy(gZenGlanceManager, "lastLinkClickData", ["set"]);
  const zoom = browser.browsingContext.fullZoom;
  const measuredWidths = () =>
    spy.set.args.map(([data]) => Math.round(data.width / zoom));
  return { sandbox, measuredWidths };
}

add_task(async function test_only_presses_a_glance_can_follow_are_measured() {
  await BrowserTestUtils.withNewTab({ gBrowser, url: PAGE }, async browser => {
    const { sandbox, measuredWidths } = spyOnClickData(browser);
    try {
      // No glance can follow these.
      await BrowserTestUtils.synthesizeMouseAtCenter("#plain", {}, browser);
      await BrowserTestUtils.synthesizeMouseAtCenter("#link", {}, browser);

      // The context menu can open a search in a glance from any element.
      await BrowserTestUtils.synthesizeMouseAtCenter(
        "#plain",
        { button: 2 },
        browser
      );
      // So can a link pressed with a modifier. The click that follows has no
      // modifier, so no glance actually opens.
      await BrowserTestUtils.synthesizeMouseAtCenter(
        "#link",
        { type: "mousedown", altKey: true },
        browser
      );
      await BrowserTestUtils.synthesizeMouseAtCenter(
        "#link",
        { type: "mouseup" },
        browser
      );

      // Messages from the child arrive in order, so anything sent for the
      // plain clicks would already be here.
      await TestUtils.waitForCondition(
        () => measuredWidths().includes(LINK_WIDTH),
        "The modified press on the link should be measured"
      );
      Assert.deepEqual(
        measuredWidths(),
        [PLAIN_WIDTH, LINK_WIDTH],
        "Only the right-click and the modified press should be measured"
      );
    } finally {
      sandbox.restore();
    }
  });
});

add_task(async function test_pinned_tab_presses_are_measured() {
  await BrowserTestUtils.withNewTab({ gBrowser, url: PAGE }, async browser => {
    const tab = gBrowser.getTabForBrowser(browser);
    const { sandbox, measuredWidths } = spyOnClickData(browser);
    try {
      gBrowser.pinTab(tab);
      await SpecialPowers.spawn(browser, [], () =>
        ContentTaskUtils.waitForCondition(
          () => content.browsingContext.isAppTab,
          "The page should know it is in a pinned tab"
        )
      );

      // Pinned tabs open links to other domains in a glance, even through
      // window.open(), so a plain press on any element is measured.
      await BrowserTestUtils.synthesizeMouseAtCenter("#plain", {}, browser);
      await TestUtils.waitForCondition(
        () => measuredWidths().length,
        "The plain press in a pinned tab should be measured"
      );
      Assert.deepEqual(
        measuredWidths(),
        [PLAIN_WIDTH],
        "The pressed element should be the one measured"
      );
    } finally {
      sandbox.restore();
      if (tab.pinned) {
        gBrowser.unpinTab(tab);
      }
    }
  });
});
