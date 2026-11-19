/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ClientEnvironmentBase } = ChromeUtils.importESModule(
  "resource://gre/modules/components-utils/ClientEnvironment.sys.mjs"
);
const { FilterExpressions } = ChromeUtils.importESModule(
  "resource://gre/modules/components-utils/FilterExpressions.sys.mjs"
);

const CRLITE_GATE = "env.version|versionCompare('133.!') >= 0";

function context() {
  return { env: ClientEnvironmentBase };
}

add_task(async function test_env_version_is_the_gecko_version() {
  is(
    ClientEnvironmentBase.version,
    Services.appinfo.platformVersion,
    "env.version reports the Gecko version"
  );
});

add_task(async function test_crlite_records_pass_their_gate() {
  ok(
    await FilterExpressions.eval(CRLITE_GATE, context()),
    "cert-revocations records are not filtered out on the client"
  );
});

add_task(async function test_legacy_gated_records_are_excluded() {
  ok(
    !(await FilterExpressions.eval(
      'env.version|versionCompare("142.0a1") < 0',
      context()
    )),
    "records meant only for pre-142 Gecko are not delivered"
  );
});
