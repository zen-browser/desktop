"use strict";

const { Weave } = ChromeUtils.importESModule(
  "resource://services-sync/main.sys.mjs"
);
const { SyncedTabs } = ChromeUtils.importESModule(
  "resource://services-sync/SyncedTabs.sys.mjs"
);

Log.repository.getLogger("Sync.RemoteTabs").addAppender(new Log.DumpAppender());

// A mock "Tabs" engine which the SyncedTabs module will use instead of the real
// engine. We pass a constructor that Sync creates.
function MockTabsEngine() {
  this.clients = {}; // We'll set this dynamically
  // Mock fxAccounts + recentDeviceList as if we hit the FxA server
  this.fxAccounts = {
    device: {
      recentDeviceList: [
        {
          id: 1,
          name: "updated desktop name",
          availableCommands: {
            "https://identity.mozilla.com/cmd/open-uri": "baz",
          },
        },
        {
          id: 2,
          name: "updated mobile name",
          availableCommands: {
            "https://identity.mozilla.com/cmd/open-uri": "boo",
          },
        },
      ],
    },
  };
}

MockTabsEngine.prototype = {
  name: "tabs",
  enabled: true,

  getAllClients() {
    return Object.values(this.clients);
  },

  getOpenURLs() {
    return new Set();
  },
};

let tabsEngine;

// A clients engine that doesn't need to be a constructor.
let MockClientsEngine = {
  clientSettings: null, // Set in `configureClients`.

  isMobile(guid) {
    if (!guid.endsWith("desktop") && !guid.endsWith("mobile")) {
      throw new Error(
        "this module expected guids to end with 'desktop' or 'mobile'"
      );
    }
    return guid.endsWith("mobile");
  },
  remoteClientExists(id) {
    return this.clientSettings[id] !== false;
  },
  getClientName(id) {
    if (this.clientSettings[id]) {
      return this.clientSettings[id];
    }
    let client = tabsEngine.clients[id];
    let fxaDevice = tabsEngine.fxAccounts.device.recentDeviceList.find(
      device => device.id === client.fxaDeviceId
    );
    return fxaDevice ? fxaDevice.name : client.clientName;
  },

  getClientFxaDeviceId(id) {
    if (this.clientSettings[id]) {
      return this.clientSettings[id];
    }
    return tabsEngine.clients[id].fxaDeviceId;
  },

  getClientType() {
    return "desktop";
  },
};

function configureClients(clients, clientSettings = {}) {
  // each client record is expected to have an id.
  for (let [guid, client] of Object.entries(clients)) {
    client.id = guid;
  }
  tabsEngine.clients = clients;
  // Apply clients collection overrides.
  MockClientsEngine.clientSettings = clientSettings;
  // Send an observer that pretends the engine just finished a sync.
  Services.obs.notifyObservers(null, "weave:engine:sync:finish", "tabs");
}

add_task(async function setup() {
  await Weave.Service.promiseInitialized;
  // Configure Sync with our mock tabs engine and force it to become initialized.
  await Weave.Service.engineManager.unregister("tabs");
  await Weave.Service.engineManager.register(MockTabsEngine);
  Weave.Service.clientsEngine = MockClientsEngine;
  tabsEngine = Weave.Service.engineManager.get("tabs");

  // Tell the Sync XPCOM service it is initialized.
  let weaveXPCService = Cc["@mozilla.org/weave/service;1"].getService(
    Ci.nsISupports
  ).wrappedJSObject;
  weaveXPCService.ready = true;
});

// The tests.
add_task(async function test_noClients() {
  // no clients, can't be tabs.
  await configureClients({});

  let tabs = await SyncedTabs.getTabClients();
  equal(Object.keys(tabs).length, 0);
});

add_task(async function test_clientWithTabs() {
  await configureClients({
    guid_desktop: {
      clientName: "My Desktop",
      tabs: [
        {
          urlHistory: ["http://foo.com/"],
          icon: "http://foo.com/favicon",
          lastUsed: 1655745700, // Mon, 20 Jun 2022 17:21:40 GMT
        },
      ],
    },
    guid_mobile: {
      clientName: "My Phone",
      tabs: [],
    },
  });

  let clients = await SyncedTabs.getTabClients();
  equal(clients.length, 2);
  clients.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
  equal(clients[0].tabs.length, 1);
  equal(clients[0].tabs[0].url, "http://foo.com/");
  let icon_url = new URL(clients[0].tabs[0].icon);
  equal(icon_url.protocol, "moz-remote-image:", "image protocol is correct");
  equal(icon_url.searchParams.get("url"), "http://foo.com/favicon");

  equal(clients[0].tabs[0].lastUsed, 1655745700);
  // second client has no tabs.
  equal(clients[1].tabs.length, 0);
});

add_task(async function test_staleClientWithTabs() {
  await configureClients(
    {
      guid_desktop: {
        clientName: "My Desktop",
        tabs: [
          {
            urlHistory: ["http://foo.com/"],
            icon: "http://foo.com/favicon",
            lastUsed: 1655745750,
          },
        ],
      },
      guid_mobile: {
        clientName: "My Phone",
        tabs: [],
      },
      guid_stale_mobile: {
        clientName: "My Deleted Phone",
        tabs: [],
      },
      guid_stale_desktop: {
        clientName: "My Deleted Laptop",
        tabs: [
          {
            urlHistory: ["https://bar.com/"],
            icon: "https://bar.com/favicon",
            lastUsed: 1655745700,
          },
        ],
      },
      guid_stale_name_desktop: {
        clientName: "My Generic Device",
        tabs: [
          {
            urlHistory: ["https://example.edu/"],
            icon: "https://example.edu/favicon",
            lastUsed: 1655745800,
          },
        ],
      },
    },
    {
      guid_stale_mobile: false,
      guid_stale_desktop: false,
      // We should always use the device name from the clients collection, instead
      // of the possibly stale tabs collection.
      guid_stale_name_desktop: "My Laptop",
    }
  );
  let clients = await SyncedTabs.getTabClients();
  clients.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
  equal(clients.length, 3);
  equal(clients[0].name, "My Desktop");
  equal(clients[0].tabs.length, 1);
  equal(clients[0].tabs[0].url, "http://foo.com/");
  equal(clients[0].tabs[0].lastUsed, 1655745750);
  equal(clients[1].name, "My Laptop");
  equal(clients[1].tabs.length, 1);
  equal(clients[1].tabs[0].url, "https://example.edu/");
  equal(clients[1].tabs[0].lastUsed, 1655745800);
  equal(clients[2].name, "My Phone");
  equal(clients[2].tabs.length, 0);
});

add_task(async function test_clientWithTabsIconsDisabled() {
  Services.prefs.setBoolPref("services.sync.syncedTabs.showRemoteIcons", false);
  await configureClients({
    guid_desktop: {
      clientName: "My Desktop",
      tabs: [
        {
          urlHistory: ["http://foo.com/"],
          icon: "http://foo.com/favicon",
        },
      ],
    },
  });

  let clients = await SyncedTabs.getTabClients();
  equal(clients.length, 1);
  clients.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
  equal(clients[0].tabs.length, 1);
  equal(clients[0].tabs[0].url, "http://foo.com/");
  // Expect the default favicon due to the pref being false.
  equal(clients[0].tabs[0].icon, "page-icon:http://foo.com/");
  Services.prefs.clearUserPref("services.sync.syncedTabs.showRemoteIcons");
});

add_task(async function test_filter() {
  // Nothing matches.
  await configureClients({
    guid_desktop: {
      clientName: "My Desktop",
      tabs: [
        {
          urlHistory: ["http://foo.com/"],
          title: "A test page.",
        },
        {
          urlHistory: ["http://bar.com/"],
          title: "Another page.",
        },
      ],
    },
  });

  let clients = await SyncedTabs.getTabClients("foo");
  equal(clients.length, 1);
  equal(clients[0].tabs.length, 1);
  equal(clients[0].tabs[0].url, "http://foo.com/");
  // check it matches the title.
  clients = await SyncedTabs.getTabClients("test");
  equal(clients.length, 1);
  equal(clients[0].tabs.length, 1);
  equal(clients[0].tabs[0].url, "http://foo.com/");
});

add_task(async function test_duplicatesTabsAcrossClients() {
  await configureClients({
    guid_desktop: {
      clientName: "My Desktop",
      tabs: [
        {
          urlHistory: ["http://foo.com/"],
          title: "A test page.",
        },
      ],
    },
    guid_mobile: {
      clientName: "My Phone",
      tabs: [
        {
          urlHistory: ["http://foo.com/"],
          title: "A test page.",
        },
      ],
    },
  });

  let clients = await SyncedTabs.getTabClients();
  equal(clients.length, 2);
  equal(clients[0].tabs.length, 1);
  equal(clients[1].tabs.length, 1);
  equal(clients[0].tabs[0].url, "http://foo.com/");
  equal(clients[1].tabs[0].url, "http://foo.com/");
});

add_task(async function test_clientsTabUpdatedName() {
  // See the "fxAccounts" object in the MockEngine above for the device list
  await configureClients({
    guid_desktop: {
      clientName: "My Desktop",
      tabs: [
        {
          urlHistory: ["http://foo.com/"],
          icon: "http://foo.com/favicon",
        },
      ],
      fxaDeviceId: 1,
    },
    guid_mobile: {
      clientName: "My Phone",
      tabs: [
        {
          urlHistory: ["http://bar.com/"],
          icon: "http://bar.com/favicon",
        },
      ],
      fxaDeviceId: 2,
    },
  });
  let clients = await SyncedTabs.getTabClients();
  equal(clients.length, 2);
  equal(clients[0].name, "updated desktop name");
  equal(clients[1].name, "updated mobile name");
});
