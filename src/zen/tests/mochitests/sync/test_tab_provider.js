/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { TabProvider } = ChromeUtils.importESModule(
  "resource://services-sync/engines/tabs.sys.mjs"
);

add_task(async function test_getAllTabs() {
  let provider = TabProvider;

  provider.getOrderedNonPrivateWindows = mockGetOrderedNonPrivateWindows.bind(
    this,
    ["http://bar.com"]
  );

  _("Get all tabs.");
  let tabs = (
    await provider.getAllTabsWithEstimatedMax(false, Number.MAX_SAFE_INTEGER)
  ).tabs;
  _("Tabs: " + JSON.stringify(tabs));
  equal(tabs.length, 1);
  equal(tabs[0].title, "title");
  equal(tabs[0].urlHistory.length, 1);
  equal(tabs[0].urlHistory[0], "http://bar.com/");
  equal(tabs[0].icon, "");
  equal(tabs[0].lastUsed, 2000);

  _("Get all tabs, and check that filtering works.");
  provider.getOrderedNonPrivateWindows = mockGetOrderedNonPrivateWindows.bind(
    this,
    ["http://foo.com", "about:foo"]
  );
  tabs = (
    await provider.getAllTabsWithEstimatedMax(true, Number.MAX_SAFE_INTEGER)
  ).tabs;
  _("Filtered: " + JSON.stringify(tabs));
  equal(tabs.length, 1);

  _("Get all tabs, and check that they are properly sorted");
  provider.getOrderedNonPrivateWindows = mockGetOrderedNonPrivateWindows.bind(
    this,
    ["http://foo.com", "http://bar.com"]
  );
  tabs = (
    await provider.getAllTabsWithEstimatedMax(true, Number.MAX_SAFE_INTEGER)
  ).tabs;
  _("Ordered: " + JSON.stringify(tabs));
  equal(tabs[0].lastUsed > tabs[1].lastUsed, true);

  // reader mode URLs are provided.
  provider.getOrderedNonPrivateWindows = mockGetOrderedNonPrivateWindows.bind(
    this,
    ["about:reader?url=http%3A%2F%2Ffoo.com%2F"]
  );
  tabs = (
    await provider.getAllTabsWithEstimatedMax(true, Number.MAX_SAFE_INTEGER)
  ).tabs;
  equal(tabs[0].urlHistory[0], "http://foo.com/");
});
