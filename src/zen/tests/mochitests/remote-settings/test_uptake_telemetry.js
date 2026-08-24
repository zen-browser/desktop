const { UptakeTelemetry } = ChromeUtils.importESModule(
  "resource://services-settings/UptakeTelemetry.sys.mjs"
);

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

add_task(async function test_unknown_status_is_not_reported() {
  Services.fog.testResetFOG();
  enableUptakeMetric();

  try {
    await UptakeTelemetry.report("unknown-status", { source: "update-source" });
  } catch (e) {}

  Assert.equal(
    null,
    Glean.uptakeRemotecontentResult.uptakeRemotesettings.testGetValue()
  );
});

add_task(async function test_age_is_converted_to_string_and_reported() {
  Services.fog.testResetFOG();
  enableUptakeMetric();
  const status = UptakeTelemetry.STATUS.SUCCESS;
  const age = 42;

  await UptakeTelemetry.report(status, { source: "s", age });

  const events =
    Glean.uptakeRemotecontentResult.uptakeRemotesettings.testGetValue();
  Assert.equal(1, events.length);
  Assert.deepEqual(events[0].extra, {
    value: status,
    source: "s",
    age: `${age}`,
  });
});

add_task(async function test_each_status_can_be_caught_in_snapshot() {
  Services.fog.testResetFOG();
  enableUptakeMetric();
  const source = "some-source";

  for (const status of Object.values(UptakeTelemetry.STATUS)) {
    await UptakeTelemetry.report(status, { source });
  }

  const events =
    Glean.uptakeRemotecontentResult.uptakeRemotesettings.testGetValue();
  for (const status of Object.values(UptakeTelemetry.STATUS)) {
    Assert.ok(
      events.some(e => e.extra.value === status && e.extra.source === source),
      `check events for ${status}`
    );
  }
});
