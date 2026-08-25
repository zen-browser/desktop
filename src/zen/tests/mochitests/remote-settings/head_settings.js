/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* import-globals-from ../../../common/tests/unit/head_global.js */
/* import-globals-from ../../../common/tests/unit/head_helpers.js */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  AppConstants: "resource://gre/modules/AppConstants.sys.mjs",
  Database: "resource://services-settings/Database.sys.mjs",
  RemoteSettings: "resource://services-settings/remote-settings.sys.mjs",
  RemoteSettingsClient:
    "resource://services-settings/RemoteSettingsClient.sys.mjs",
  RemoteSettingsWorker:
    "resource://services-settings/RemoteSettingsWorker.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  SharedUtils: "resource://services-settings/SharedUtils.sys.mjs",
  SyncHistory: "resource://services-settings/SyncHistory.sys.mjs",
  TelemetryTestUtils: "resource://testing-common/TelemetryTestUtils.sys.mjs",
  TestUtils: "resource://testing-common/TestUtils.sys.mjs",
  UptakeTelemetry: "resource://services-settings/UptakeTelemetry.sys.mjs",
  Utils: "resource://services-settings/Utils.sys.mjs",
});

const IS_ANDROID = AppConstants.platform == "android";

function arrayEqual(a, b) {
  return JSON.stringify(a) == JSON.stringify(b);
}

add_setup(function () {
  Services.fog.initializeFOG();
});

function enableUptakeMetric() {
  Services.fog.applyServerKnobsConfig(
    JSON.stringify({
      metrics_enabled: {
        "uptake.remotecontent.result.uptake_remotesettings": true,
      },
    })
  );
}

function assertTelemetryEvents(expectedEvents) {
  if (IS_ANDROID) {
    /*
      Since `Services.fog.applyServerKnobsConfig()` has no effect on Android
      https://searchfox.org/firefox-main/rev/e28b34ab33dbf49364999070168cbb7e11e8e5bd/toolkit/components/glean/xpcom/FOG.cpp#379-390
      we skip assertions on events on this platform.
      Alternatively we could have disabled the whole tests suites or introduced `if IS_ANDROID` on each
      test involving telemetry, but this seems the most reasonable way.
      See Bug 2028765 and Bug 2042499
    */
    Assert.ok(
      true,
      "Glean Uptake Telemetry assertions are ALWAYS true on Android"
    );
    return;
  }
  const events =
    Glean.uptakeRemotecontentResult.uptakeRemotesettings.testGetValue() ?? [];
  const receivedValues = events.map(e => e.extra.value);
  Assert.equal(
    events.length,
    expectedEvents.length,
    `number of uptake events (${receivedValues})`
  );
  for (let i = 0; i < expectedEvents.length; i++) {
    for (const [key, expected] of Object.entries(expectedEvents[i])) {
      if (typeof expected === "function") {
        Assert.ok(
          expected(events[i].extra[key]),
          `event[${i}].extra.${key} passes validator`
        );
      } else {
        Assert.equal(
          events[i].extra[key],
          expected,
          `event[${i}].extra.${key}`
        );
      }
    }
  }
}
