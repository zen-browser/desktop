/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { initializeIdentityWithTokenServerResponse } =
  ChromeUtils.importESModule(
    "resource://testing-common/services/sync/fxa_utils.sys.mjs"
  );

add_task(async function test_findCluster() {
  _("Test FxA _findCluster()");

  _("_findCluster() throws on 500 errors.");
  initializeIdentityWithTokenServerResponse({
    status: 500,
    headers: [],
    body: "",
  });

  await Assert.rejects(
    Service.identity._findCluster(),
    /TokenServerClientServerError/
  );

  _("_findCluster() returns null on authentication errors.");
  initializeIdentityWithTokenServerResponse({
    status: 401,
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  let cluster = await Service.identity._findCluster();
  Assert.strictEqual(cluster, null);

  _("_findCluster() works with correct tokenserver response.");
  let endpoint = "http://example.com/something";
  initializeIdentityWithTokenServerResponse({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_endpoint: endpoint,
      duration: 300,
      id: "id",
      key: "key",
      uid: "uid",
    }),
  });

  cluster = await Service.identity._findCluster();
  // The cluster manager ensures a trailing "/"
  Assert.strictEqual(cluster, endpoint + "/");

  for (const pref of Svc.PrefBranch.getChildList("")) {
    Svc.PrefBranch.clearUserPref(pref);
  }
});
