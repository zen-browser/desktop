/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Helper methods for testing the "send more info" link
 * of the Report Broken Site feature.
 */

/* import-globals-from head.js */
/* import-globals-from send.js */

"use strict";

Services.scriptloader.loadSubScript(
  getRootDirectory(gTestPath) + "send.js",
  this
);

async function reformatExpectedWebCompatInfo(tab, overrides) {
  const gfxInfo = Cc["@mozilla.org/gfx/info;1"].getService(Ci.nsIGfxInfo);
  const snapshot = await Troubleshoot.snapshot();
  const expected = await getExpectedWebCompatInfo(tab, snapshot, true);
  const { browserInfo, tabInfo } = expected;
  const { app, graphics, prefs, security } = browserInfo;
  const {
    applicationName,
    defaultUseragentString,
    fissionEnabled,
    osArchitecture,
    osName,
    osVersion,
    updateChannel,
    version,
  } = app;
  const { devicePixelRatio, hasTouchScreen } = graphics;
  const { antitracking, languages, useragentString } = tabInfo;

  const addons = overrides.addons || [];
  const experiments = overrides.experiments || [];
  const atOverrides = overrides.antitracking;
  const blockList = atOverrides?.blockList ?? antitracking.blockList;
  const blockedOrigins =
    atOverrides?.blockedOrigins ?? antitracking.blockedOrigins ?? [];
  const hasMixedActiveContentBlocked =
    atOverrides?.hasMixedActiveContentBlocked ??
    antitracking.hasMixedActiveContentBlocked;
  const hasMixedDisplayContentBlocked =
    atOverrides?.hasMixedDisplayContentBlocked ??
    antitracking.hasMixedDisplayContentBlocked;
  const hasTrackingContentBlocked =
    atOverrides?.hasTrackingContentBlocked ??
    antitracking.hasTrackingContentBlocked;
  const isPrivateBrowsing =
    atOverrides?.isPrivateBrowsing ?? antitracking.isPrivateBrowsing;
  const btpHasPurgedSite =
    atOverrides?.btpHasPurgedSite ?? antitracking.btpHasPurgedSite;
  const etpCategory = atOverrides?.etpCategory ?? antitracking.etpCategory;

  const extra_labels = [];
  const frameworks = overrides.frameworks ?? {
    fastclick: false,
    mobify: false,
    marfeel: false,
  };

  // ignore the console log unless explicily testing for it.
  const consoleLog = overrides.consoleLog ?? (() => true);

  const reformatted = {
    blockList,
    details: {
      additionalData: {
        browserInfo: {
          addons,
          app: {
            applicationName,
            buildId: snapshot.application.buildID,
            defaultLocales: snapshot.intl.localeService.available,
            defaultUseragentString,
            fissionEnabled,
            osArchitecture,
            osName,
            osVersion,
            updateChannel,
            version,
          },
          experiments,
          graphics: {
            devicePixelRatio: parseInt(devicePixelRatio),
            devices(actual) {
              const devices = getExpectedGraphicsDevices(snapshot);
              return compareGraphicsDevices(devices, actual);
            },
            drivers(actual) {
              const drvs = getExpectedGraphicsDrivers(snapshot);
              return compareGraphicsDrivers(drvs, actual);
            },
            features(actual) {
              const features = getExpectedGraphicsFeatures(snapshot);
              return areObjectsEqual(actual, features);
            },
            hasTouchScreen,
            monitors(actual) {
              return areObjectsEqual(actual, gfxInfo.getMonitors());
            },
          },
          prefs,
          system: {
            isTablet: getSysinfoProperty("tablet", false),
            memory: browserInfo.system.memory,
          },
        },
        tabInfo: {
          antitracking: {
            blockList,
            blockedOrigins,
            btpHasPurgedSite,
            etpCategory,
            hasMixedActiveContentBlocked,
            hasMixedDisplayContentBlocked,
            hasTrackingContentBlocked,
            isPrivateBrowsing,
          },
          frameworks,
          languages,
          useragentString,
        },
      },
      blockList,
      channel: updateChannel,
      consoleLog,
      defaultUserAgent: defaultUseragentString,
      frameworks,
      hasTouchScreen,
      "gfx.webrender.software": prefs.softwareWebrender,
      "mixed active content blocked": hasMixedActiveContentBlocked,
      "mixed passive content blocked": hasMixedDisplayContentBlocked,
      "tracking content blocked": hasTrackingContentBlocked
        ? `true (${blockList})`
        : "false",
      "btp has purged site": btpHasPurgedSite,
    },
    extra_labels,
    src: "desktop-reporter",
    utm_campaign: "report-broken-site",
    utm_source: "desktop-reporter",
  };

  // We only care about this pref on Linux right now on webcompat.com.
  if (AppConstants.platform != "linux") {
    delete prefs.forcedAcceleratedLayers;
  } else {
    reformatted.details["layers.acceleration.force-enabled"] =
      prefs.forcedAcceleratedLayers;
  }

  if (security) {
    reformatted.details.additionalData.browserInfo.security = security;
  }

  if (blockList != "basic") {
    extra_labels.push(`type-tracking-protection-${blockList}`);
  }

  if (overrides.expectNoTabDetails) {
    delete reformatted.details.frameworks;
    delete reformatted.details.consoleLog;
    delete reformatted.details["mixed active content blocked"];
    delete reformatted.details["mixed passive content blocked"];
    delete reformatted.details["tracking content blocked"];
    delete reformatted.details["btp has purged site"];
  } else {
    const { fastclick, mobify, marfeel } = frameworks;
    if (fastclick) {
      extra_labels.push("type-fastclick");
      reformatted.details.fastclick = true;
    }
    if (mobify) {
      extra_labels.push("type-mobify");
      reformatted.details.mobify = true;
    }
    if (marfeel) {
      extra_labels.push("type-marfeel");
      reformatted.details.marfeel = true;
    }
  }

  extra_labels.sort();

  return reformatted;
}

async function testSendMoreInfo(tab, menu, expectedOverrides = {}) {
  const url = expectedOverrides.url ?? menu.win.gBrowser.currentURI.spec;
  const description = expectedOverrides.description ?? "";

  let rbs = await menu.openAndPrefillReportBrokenSite(url, description);

  const receivedData = await rbs.clickSendMoreInfo();
  await checkWebcompatComPayload(
    tab,
    url,
    description,
    expectedOverrides,
    receivedData
  );

  // re-opening the panel, the url and description should be reset
  rbs = await menu.openReportBrokenSite();
  rbs.isMainViewResetToCurrentTab();
  rbs.close();
}

async function testWebcompatComFallback(tab, menu) {
  const url = menu.win.gBrowser.currentURI.spec;
  const receivedData =
    await menu.clickReportBrokenSiteAndAwaitWebCompatTabData();
  await checkWebcompatComPayload(tab, url, "", {}, receivedData);
  menu.close();
}

async function checkWebcompatComPayload(
  tab,
  url,
  description,
  expectedOverrides,
  receivedData
) {
  const expected = await reformatExpectedWebCompatInfo(tab, expectedOverrides);
  expected.url = url;
  expected.description = description;

  // sanity checks
  const { message } = receivedData;
  const { details } = message;
  const { additionalData } = details;
  ok(message.url?.length, "Got a URL");
  ok(["basic", "strict"].includes(details.blockList), "Got a blockList");
  const { app } = additionalData.browserInfo;
  ok(app.applicationName?.length, "Got an app name");
  ok(app.osArchitecture?.length, "Got an OS arch");
  ok(app.osName?.length, "Got an OS name");
  ok(app.osVersion?.length, "Got an OS version");
  ok(app.version?.length, "Got an app version");
  ok(details.channel?.length, "Got an app channel");
  ok(details.defaultUserAgent?.length, "Got a default UA string");
  ok(additionalData.tabInfo.useragentString?.length, "Got a final UA string");

  // If we're sending any tab-specific data (which includes console logs),
  // check that there is also a valid screenshot.
  if (details.consoleLog) {
    const isScreenshotValid = await new Promise(done => {
      var image = new Image();
      image.onload = () => done(image.width > 0);
      image.onerror = () => done(false);
      image.src = receivedData.screenshot;
    });
    ok(isScreenshotValid, "Got a valid screenshot");
  }

  filterFrameworkDetectorFails(message.details, expected.details);

  ok(areObjectsEqual(message, expected), "sent info matches expectations");
}
