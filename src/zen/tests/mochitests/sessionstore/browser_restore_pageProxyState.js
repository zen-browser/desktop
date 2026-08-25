/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const BACKUP_STATE = SessionStore.getBrowserState();
registerCleanupFunction(() => promiseBrowserState(BACKUP_STATE));

// The pageproxystate of the restored tab controls whether the identity
// information in the URL bar will display correctly. See bug 1766951 for more
// context.
async function test_pageProxyState(url1, url2) {
  info(`urls: "${url1}", "${url2}"`);

  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.sessionstore.restore_on_demand", true],
      ["browser.sessionstore.restore_tabs_lazily", true],
    ],
  });

  await promiseBrowserState({
    windows: [
      {
        tabs: [
          {
            entries: [
              {
                url: url1,
                triggeringPrincipal_base64,
              },
            ],
          },
          {
            entries: [
              {
                url: url2,
                triggeringPrincipal_base64,
              },
            ],
          },
        ],
        selected: 1,
      },
    ],
  });

  // The first tab isn't lazy and should be initialized.
  ok(gBrowser.tabs[0].linkedPanel, "first tab is not lazy");
  is(gBrowser.selectedTab, gBrowser.tabs[0], "first tab is selected");
  is(gBrowser.userTypedValue, null, "no user typed value");
  is(
    gURLBar.getAttribute("pageproxystate"),
    "valid",
    "has valid page proxy state"
  );

  // The second tab is lazy until selected.
  ok(!gBrowser.tabs[1].linkedPanel, "second tab should be lazy");
  gBrowser.selectedTab = gBrowser.tabs[1];
  await promiseTabRestored(gBrowser.tabs[1]);
  is(gBrowser.userTypedValue, null, "no user typed value");
  is(
    gURLBar.getAttribute("pageproxystate"),
    "valid",
    "has valid page proxy state"
  );
}

add_task(async function test_system() {
  await test_pageProxyState("about:support", "about:addons");
});

add_task(async function test_http() {
  await test_pageProxyState(
    "https://example.com/document-builder.sjs?html=tab1",
    "https://example.com/document-builder.sjs?html=tab2"
  );
});
