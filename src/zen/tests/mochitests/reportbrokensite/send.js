/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Helper methods for testing sending reports with
 * the Report Broken Site feature.
 */

/* import-globals-from head.js */

"use strict";

const { Troubleshoot } = ChromeUtils.importESModule(
  "resource://gre/modules/Troubleshoot.sys.mjs"
);

function getSysinfoProperty(propertyName, defaultValue) {
  try {
    return Services.sysinfo.getProperty(propertyName);
  } catch (e) {}
  return defaultValue;
}

function securityStringToArray(str) {
  return str ? str.split(";") : null;
}

function getExpectedGraphicsDevices(snapshot) {
  const { graphics } = snapshot;
  return [
    graphics.adapterDeviceID,
    graphics.adapterVendorID,
    graphics.adapterDeviceID2,
    graphics.adapterVendorID2,
  ]
    .filter(i => i)
    .sort();
}

function compareGraphicsDevices(expected, rawActual) {
  const actual = rawActual
    .map(({ deviceID, vendorID }) => [deviceID, vendorID])
    .flat()
    .filter(i => i)
    .sort();
  return areObjectsEqual(actual, expected);
}

function getExpectedGraphicsDrivers(snapshot) {
  const { graphics } = snapshot;
  const expected = [];
  for (let i = 1; i < 3; ++i) {
    const version = graphics[`webgl${i}Version`];
    if (version && version != "-") {
      expected.push(graphics[`webgl${i}Renderer`]);
      expected.push(version);
    }
  }
  return expected.filter(i => i).sort();
}

function compareGraphicsDrivers(expected, rawActual) {
  const actual = rawActual
    .map(({ renderer, version }) => [renderer, version])
    .flat()
    .filter(i => i)
    .sort();
  return areObjectsEqual(actual, expected);
}

function getExpectedGraphicsFeatures(snapshot) {
  const expected = {};
  for (let { name, log, status } of snapshot.graphics.featureLog.features) {
    for (const item of log?.reverse() ?? []) {
      if (item.failureId && item.status == status) {
        status = `${status} (${item.message || item.failureId})`;
      }
    }
    expected[name] = status;
  }
  return expected;
}

async function getExpectedWebCompatInfo(tab, snapshot, fullAppData = false) {
  const gfxInfo = Cc["@mozilla.org/gfx/info;1"].getService(Ci.nsIGfxInfo);

  const { application, graphics, intl, securitySoftware } = snapshot;

  const { fissionAutoStart, memorySizeBytes, updateChannel, userAgent } =
    application;

  const app = {
    defaultLocales: intl.localeService.available,
    defaultUseragentString: userAgent,
    fissionEnabled: fissionAutoStart,
  };
  if (fullAppData) {
    app.applicationName = application.name;
    app.osArchitecture = getSysinfoProperty("arch", null);
    app.osName = getSysinfoProperty("name", null);
    app.osVersion = getSysinfoProperty("version", null);
    app.updateChannel = updateChannel;
    app.version = application.version;
  }

  const hasTouchScreen = graphics.info.ApzTouchInput == 1;

  const { registeredAntiVirus, registeredAntiSpyware, registeredFirewall } =
    securitySoftware;

  const browserInfo = {
    addons: [],
    app,
    experiments: [],
    graphics: {
      devicesJson(actualStr) {
        const expected = getExpectedGraphicsDevices(snapshot);
        // If undefined is saved to the Glean value here, we'll get the string "undefined" (invalid JSON).
        // We should stop using JSON like this in bug 1875185.
        if (!actualStr || actualStr == "undefined") {
          return !expected.length;
        }
        return compareGraphicsDevices(expected, JSON.parse(actualStr));
      },
      driversJson(actualStr) {
        const expected = getExpectedGraphicsDrivers(snapshot);
        // If undefined is saved to the Glean value here, we'll get the string "undefined" (invalid JSON).
        // We should stop using JSON like this in bug 1875185.
        if (!actualStr || actualStr == "undefined") {
          return !expected.length;
        }
        return compareGraphicsDrivers(expected, JSON.parse(actualStr));
      },
      featuresJson(actualStr) {
        const expected = getExpectedGraphicsFeatures(snapshot);
        // If undefined is saved to the Glean value here, we'll get the string "undefined" (invalid JSON).
        // We should stop using JSON like this in bug 1875185.
        if (!actualStr || actualStr == "undefined") {
          return !expected.length;
        }
        return areObjectsEqual(JSON.parse(actualStr), expected);
      },
      hasTouchScreen,
      monitorsJson(actualStr) {
        const expected = gfxInfo.getMonitors();
        // If undefined is saved to the Glean value here, we'll get the string "undefined" (invalid JSON).
        // We should stop using JSON like this in bug 1875185.
        if (!actualStr || actualStr == "undefined") {
          return !expected.length;
        }
        return areObjectsEqual(JSON.parse(actualStr), expected);
      },
    },
    prefs: {
      cookieBehavior: Services.prefs.getIntPref(
        "network.cookie.cookieBehavior",
        -1
      ),
      forcedAcceleratedLayers: Services.prefs.getBoolPref(
        "layers.acceleration.force-enabled",
        false
      ),
      globalPrivacyControlEnabled: Services.prefs.getBoolPref(
        "privacy.globalprivacycontrol.enabled",
        false
      ),
      installtriggerEnabled: Services.prefs.getBoolPref(
        "extensions.InstallTrigger.enabled",
        false
      ),
      opaqueResponseBlocking: Services.prefs.getBoolPref(
        "browser.opaqueResponseBlocking",
        false
      ),
      resistFingerprintingEnabled: Services.prefs.getBoolPref(
        "privacy.resistFingerprinting",
        false
      ),
      softwareWebrender: Services.prefs.getBoolPref(
        "gfx.webrender.software",
        false
      ),
      thirdPartyCookieBlockingEnabled: Services.prefs.getBoolPref(
        "network.cookie.cookieBehavior.optInPartitioning",
        false
      ),
      thirdPartyCookieBlockingEnabledInPbm: Services.prefs.getBoolPref(
        "network.cookie.cookieBehavior.optInPartitioning.pbmode",
        false
      ),
    },
    system: {
      isTablet: getSysinfoProperty("tablet", false),
      memory: Math.round(memorySizeBytes / 1024 / 1024),
    },
  };
  if (registeredAntiSpyware) {
    browserInfo.security ??= {};
    browserInfo.security.antispyware = securityStringToArray(
      registeredAntiSpyware
    );
  }
  if (registeredAntiVirus) {
    browserInfo.security ??= {};
    browserInfo.security.antivirus = securityStringToArray(registeredAntiVirus);
  }
  if (registeredFirewall) {
    browserInfo.security ??= {};
    browserInfo.security.firewall = securityStringToArray(registeredFirewall);
  }

  const tabInfo = await tab.linkedBrowser.ownerGlobal.SpecialPowers.spawn(
    tab.linkedBrowser,
    [],
    async function () {
      return {
        devicePixelRatio: `${content.devicePixelRatio}`,
        antitracking: {
          blockList: "basic",
          blockedOrigins: null,
          isPrivateBrowsing: false,
          hasTrackingContentBlocked: false,
          hasMixedActiveContentBlocked: false,
          hasMixedDisplayContentBlocked: false,
          btpHasPurgedSite: false,
          etpCategory: "standard",
        },
        frameworks: {
          fastclick: false,
          marfeel: false,
          mobify: false,
        },
        languages: content.navigator.languages,
        useragentString: content.navigator.userAgent,
      };
    }
  );

  browserInfo.graphics.devicePixelRatio = tabInfo.devicePixelRatio;
  delete tabInfo.devicePixelRatio;

  return { browserInfo, tabInfo };
}

function extractPingData(branch) {
  const data = {};
  for (const [name, value] of Object.entries(branch)) {
    data[name] = value.testGetValue();
  }
  return data;
}

function extractBrokenSiteReportFromGleanPing(Glean) {
  const ping = extractPingData(Glean.brokenSiteReport);
  ping.tabInfo = extractPingData(Glean.brokenSiteReportTabInfo);
  ping.tabInfo.antitracking = extractPingData(
    Glean.brokenSiteReportTabInfoAntitracking
  );
  ping.tabInfo.frameworks = extractPingData(
    Glean.brokenSiteReportTabInfoFrameworks
  );
  ping.browserInfo = {
    addons: Array.from(Glean.brokenSiteReportBrowserInfo.addons.testGetValue()),
    app: extractPingData(Glean.brokenSiteReportBrowserInfoApp),
    graphics: extractPingData(Glean.brokenSiteReportBrowserInfoGraphics),
    experiments: Array.from(
      Glean.brokenSiteReportBrowserInfo.experiments.testGetValue()
    ),
    prefs: extractPingData(Glean.brokenSiteReportBrowserInfoPrefs),
    system: extractPingData(Glean.brokenSiteReportBrowserInfoSystem),
  };
  const security = extractPingData(Glean.brokenSiteReportBrowserInfoSecurity);
  for (const [k, v] of Object.entries(security)) {
    if (v === null) {
      delete security[k];
    }
  }
  if (Object.keys(security).length) {
    ping.browserInfo.security = security;
  }
  return ping;
}

async function testSend(tab, menu, expectedOverrides = {}) {
  const url = expectedOverrides.url ?? menu.win.gBrowser.currentURI.spec;
  const description = expectedOverrides.description ?? "";
  const breakageCategory = expectedOverrides.breakageCategory ?? null;

  let rbs = await menu.openAndPrefillReportBrokenSite(url, description);

  const snapshot = await Troubleshoot.snapshot();
  const expected = await getExpectedWebCompatInfo(tab, snapshot);

  expected.url = url;
  expected.description = description;
  expected.breakageCategory = breakageCategory;

  if (expectedOverrides.addons) {
    expected.browserInfo.addons = expectedOverrides.addons;
  }

  if (expectedOverrides.experiments) {
    expected.browserInfo.experiments = expectedOverrides.experiments;
  }

  if (expectedOverrides.antitracking) {
    expected.tabInfo.antitracking = expectedOverrides.antitracking;

    if (expectedOverrides.antitracking.blockedOrigins) {
      rbs.blockedTrackersCheckbox = true;
    }
  }

  if (expectedOverrides.frameworks) {
    expected.tabInfo.frameworks = expectedOverrides.frameworks;
  }

  if (breakageCategory) {
    rbs.chooseReason(breakageCategory);
  }

  Services.fog.testResetFOG();
  await GleanPings.brokenSiteReport.testSubmission(
    () => {
      const ping = extractBrokenSiteReportFromGleanPing(Glean);

      // sanity checks
      const { browserInfo, tabInfo } = ping;
      ok(ping.url?.length, "Got a URL");
      ok(
        ["basic", "strict"].includes(tabInfo.antitracking.blockList),
        "Got a blockList"
      );
      if (rbs.blockedTrackersCheckbox.checked) {
        ok(
          Array.isArray(tabInfo.antitracking.blockedOrigins),
          "Got an array for blockedOrigins"
        );
      } else {
        ok(!tabInfo.antitracking.blockedOrigins, "No blockedOrigins included");
      }
      ok(tabInfo.useragentString?.length, "Got a final UA string");
      ok(
        browserInfo.app.defaultUseragentString?.length,
        "Got a default UA string"
      );

      filterFrameworkDetectorFails(ping.tabInfo, expected.tabInfo);

      ok(areObjectsEqual(ping, expected), "ping matches expectations");
    },
    () => rbs.clickSend()
  );

  await rbs.clickOkay();

  const telemetry = Glean.webcompatreporting.send.testGetValue();
  is(telemetry?.length, 1, "Got a 'send' telemetry event");
  is(
    telemetry[0].extra.sent_with_blocked_trackers,
    String(!!expectedOverrides.antitracking?.blockedOrigins),
    "Got correct 'sent_with_blocked_trackers' flag"
  );

  // re-opening the panel, the url and description should be reset
  rbs = await menu.openReportBrokenSite();
  rbs.isMainViewResetToCurrentTab();
  ok(
    !rbs.blockedTrackersCheckbox.checked,
    "blocked trackers checkbox is reset"
  );
  rbs.close();
}
