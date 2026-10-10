/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

add_task(async function test_findCluster() {
  syncTestLogging();
  _("Test Service._findCluster()");
  try {
    let whenReadyToAuthenticate = Promise.withResolvers();
    Service.identity.whenReadyToAuthenticate = whenReadyToAuthenticate;
    whenReadyToAuthenticate.resolve(true);

    Service.identity._ensureValidToken = () =>
      Promise.reject(new Error("Connection refused"));

    _("_findCluster() throws on network errors (e.g. connection refused).");
    await Assert.rejects(Service.identity._findCluster(), /Connection refused/);

    Service.identity._ensureValidToken = () =>
      Promise.resolve({ endpoint: "http://weave.user.node" });

    _("_findCluster() returns the user's cluster node");
    let cluster = await Service.identity._findCluster();
    Assert.equal(cluster, "http://weave.user.node/");
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  }
});

add_task(async function test_setCluster() {
  syncTestLogging();
  _("Test Service._setCluster()");
  try {
    _("Check initial state.");
    Assert.equal(Service.clusterURL, "");

    Service.identity._findCluster = () => "http://weave.user.node/";

    _("Set the cluster URL.");
    Assert.ok(await Service.identity.setCluster());
    Assert.equal(Service.clusterURL, "http://weave.user.node/");

    _("Setting it again won't make a difference if it's the same one.");
    Assert.ok(!(await Service.identity.setCluster()));
    Assert.equal(Service.clusterURL, "http://weave.user.node/");

    _("A 'null' response won't make a difference either.");
    Service.identity._findCluster = () => null;
    Assert.ok(!(await Service.identity.setCluster()));
    Assert.equal(Service.clusterURL, "http://weave.user.node/");
  } finally {
    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
  }
});
