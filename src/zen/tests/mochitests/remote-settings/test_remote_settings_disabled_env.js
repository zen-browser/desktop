/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const server = new HttpServer();
server.start(-1);
registerCleanupFunction(() => server.stop(() => {}));

server.registerPrefixHandler("/", () => {
  Assert.ok(false, "No request should reach the server");
});

add_setup(() => {
  Services.prefs.setStringPref(
    "services.settings.server",
    `http://localhost:${server.identity.primaryPort}/v1`
  );
  registerCleanupFunction(() =>
    Services.prefs.clearUserPref("services.settings.server")
  );
});

add_task(async function test_remote_activity_disabled() {
  Assert.ok(Utils.shouldSkipRemoteActivity);
  Assert.deepEqual(await RemoteSettings.pullStartupBundle(), []);
  await RemoteSettings.pollChanges();
});

add_task(function test_env_read_once() {
  Services.env.set("MOZ_REMOTE_SETTINGS_DISABLED", "");
  Assert.ok(
    Utils.shouldSkipRemoteActivity,
    "The environment variable is only read once"
  );
});
