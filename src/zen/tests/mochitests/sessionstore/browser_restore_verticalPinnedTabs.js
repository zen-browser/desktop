add_setup(() =>
  SpecialPowers.pushPrefEnv({
    set: [
      ["sidebar.revamp", true],
      ["sidebar.verticalTabs", true],
    ],
  })
);
const BACKUP_STATE = SessionStore.getBrowserState();
const REMOTE_URL = "https://www.example.com/";
const ABOUT_ROBOTS_URL = "about:robots";
const ABOUT_HOME = "about:home";
const ABOUT_MOZILLA = "about:mozilla";

let tabs = [
  {
    entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }],
    pinned: true,
    userContextId: 0,
    hidden: false,
  },
  {
    entries: [{ url: ABOUT_MOZILLA, triggeringPrincipal_base64 }],
    pinned: true,
    userContextId: 0,
    hidden: false,
  },
  {
    entries: [{ url: ABOUT_ROBOTS_URL, triggeringPrincipal_base64 }],
    pinned: true,
    userContextId: 0,
    hidden: false,
  },
  {
    entries: [{ url: ABOUT_HOME, triggeringPrincipal_base64 }],
    userContextId: 0,
    hidden: false,
  },
];

add_task(async function test_pinned_tabs_restored_position() {
  let allTabsRestored = promiseSessionStoreLoads(3);
  await setWindowState(
    window,
    {
      windows: [
        {
          selected: 3, // SessionStore uses 1-based indexing.
          tabs,
        },
      ],
    },
    true
  );
  await allTabsRestored;

  const sidebar = document.querySelector("sidebar-main");
  ok(sidebar, "Sidebar is shown.");

  let tabStrip = document.getElementById("tabbrowser-tabs");
  let verticalTabs = document.querySelector("#vertical-tabs");
  let pinnedTabsContainer = document.querySelector("#pinned-tabs-container");

  ok(BrowserTestUtils.isVisible(verticalTabs), "Vertical tabs slot is visible");
  is(
    tabStrip.parentNode,
    verticalTabs,
    "Tabstrip is slotted into the sidebar vertical tabs container"
  );
  ok(
    BrowserTestUtils.isVisible(pinnedTabsContainer),
    "Vertical pinned tabs container is visible"
  );
  is(
    pinnedTabsContainer.children.length,
    gBrowser.pinnedTabCount,
    "Three tabs are in the vertical pinned tabs container"
  );

  let [tab1, tab2, tab3, tab4] = gBrowser.tabs;
  ok(tab1.pinned, "First tab is pinned");
  ok(tab2.pinned, "Second tab is pinned");
  ok(tab3.pinned, "Third tab is pinned");
  ok(!tab4.pinned, "Fourth tab is not pinned");
  ok(tab3.selected, "Third tab is selected");

  is(
    tab1.linkedBrowser.currentURI.spec,
    REMOTE_URL,
    "First tab has matching URL"
  );
  is(
    tab2.linkedBrowser.currentURI.spec,
    ABOUT_MOZILLA,
    "Second tab has matching URL"
  );
  is(
    tab3.linkedBrowser.currentURI.spec,
    ABOUT_ROBOTS_URL,
    "Third tab has matching URL"
  );

  // cleanup
  await promiseBrowserState(BACKUP_STATE);
});
