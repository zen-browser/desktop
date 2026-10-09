/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  AboutNewTab: "resource:///modules/AboutNewTab.sys.mjs",
  sinon: "resource://testing-common/Sinon.sys.mjs",
  TopSites: "resource:///modules/topsites/TopSites.sys.mjs",
  UrlbarProviderTopSites:
    "moz-src:///browser/components/urlbar/UrlbarProviderTopSites.sys.mjs",
});

add_task(async function test_shortcut_preferences() {
  const fixtures = [
    null,
    { url: "https://both.example/", isPinned: true, sponsored_position: 1 },
    { url: "https://pinned.example/", isPinned: true },
    { url: "https://sponsored.example/", sponsored_position: 1 },
    { url: "https://ordinary.example/" },
    { url: "https://another.example/" },
  ];
  const testSandbox = sinon.createSandbox();
  testSandbox.stub(TopSites, "getSites").resolves(fixtures);
  testSandbox.stub(AboutNewTab, "getTopSites").returns(fixtures);
  try {
    for (const componentEnabled of [false, true]) {
      for (const [
        showPinned,
        showSponsored,
        expected,
        nativeSponsored = true,
      ] of [
        [false, false, ["ordinary", "another"]],
        [true, false, ["pinned", "ordinary"]],
        [false, true, ["sponsored", "ordinary"]],
        [true, true, ["both", "pinned"]],
        [false, true, ["ordinary", "another"], false],
      ]) {
        await SpecialPowers.pushPrefEnv({
          set: [
            ["browser.topsites.component.enabled", componentEnabled],
            ["browser.urlbar.suggest.topsites", true],
            ["browser.newtabpage.activity-stream.feeds.system.topsites", true],
            ["browser.urlbar.sponsoredTopSites", nativeSponsored],
            ["browser.urlbar.suggest.openpage", false],
            ["browser.urlbar.suggest.bookmark", false],
            ["browser.urlbar.resultExplanations.featureGate", false],
            ["browser.urlbar.maxRichResults", 2],
            ["zen.urlbar.show-pinned", showPinned],
            ["zen.urlbar.show-sponsored", showSponsored],
          ],
        });
        const results = [];
        await new UrlbarProviderTopSites().startQuery(
          { isPrivate: false },
          (_provider, result) => results.push(result.payload.url)
        );
        Assert.deepEqual(
          results,
          expected.map(name => `https://${name}.example/`),
          `Top Sites backend ${componentEnabled}, pinned ${showPinned}, sponsored ${showSponsored}`
        );
        await SpecialPowers.popPrefEnv();
      }
    }
    Assert.equal(fixtures.length, 6, "The source shortcuts are unchanged");
  } finally {
    testSandbox.restore();
  }
});
