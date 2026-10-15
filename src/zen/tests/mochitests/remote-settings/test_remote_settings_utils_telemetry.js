/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const server = new HttpServer();
server.start(-1);
registerCleanupFunction(() => server.stop(() => {}));
const SERVER_BASE_URL = `http://localhost:${server.identity.primaryPort}`;

const proxyServer = new HttpServer();
proxyServer.start(-1);
const PROXY_PORT = proxyServer.identity.primaryPort;
proxyServer.stop();

server.registerPathHandler("/destination", (request, response) => {
  response.setStatusLine(null, 412);
});

function assertBypassTelemetryEvents(expectedEvents) {
  const events = Glean.serviceRequest.bypassProxyInfo.testGetValue() ?? [];
  Assert.equal(events.length, expectedEvents.length);
  for (let i = 0; i < expectedEvents.length; i++) {
    Assert.deepEqual(events[i].extra, {
      value: expectedEvents[i].value,
      ...expectedEvents[i].extra,
    });
  }
  Services.fog.testResetFOG();
}

add_task(async function test_telemetry() {
  const DESTINATION_URL = `${SERVER_BASE_URL}/destination`;

  {
    let res = await Utils.fetch(DESTINATION_URL);
    Assert.equal(res.status, 412, "fetch without proxy succeeded");
  }
  assertBypassTelemetryEvents([]);

  Services.prefs.setIntPref("network.proxy.type", 1);
  Services.prefs.setStringPref("network.proxy.http", "127.0.0.1");
  Services.prefs.setIntPref("network.proxy.http_port", PROXY_PORT);
  Services.prefs.setBoolPref("network.proxy.allow_hijacking_localhost", true);

  {
    let res = await Utils.fetch(DESTINATION_URL);
    Assert.equal(res.status, 412, "fetch with broken proxy succeeded");
  }
  // Note: failover handled by HttpChannel, hence no failover here.
  assertBypassTelemetryEvents([]);

  // Disable HttpChannel failover in favor of Utils.fetch's implementation.
  Services.prefs.setBoolPref("network.proxy.failover_direct", false);
  {
    let res = await Utils.fetch(DESTINATION_URL);
    Assert.equal(res.status, 412, "fetch succeeded with bypassProxy feature");
  }
  assertBypassTelemetryEvents([
    {
      category: "service_request",
      method: "bypass",
      object: "proxy_info",
      value: "remote-settings",
      extra: {
        source: "prefs",
        type: "manual",
      },
    },
  ]);

  Services.prefs.setBoolPref("network.proxy.allow_bypass", false);
  await Assert.rejects(
    Utils.fetch(DESTINATION_URL),
    /NetworkError/,
    "Request without failover fails"
  );
  assertBypassTelemetryEvents([]);
});
