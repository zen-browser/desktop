/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* import-globals-from ../../../common/tests/unit/head_helpers.js */

var { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

// Required to avoid failures.
do_get_profile();

// Init FormHistoryStartup and pretend we opened a profile.
var fhs = Cc["@mozilla.org/satchel/form-history-startup;1"].getService(
  Ci.nsIObserver
);
fhs.observe(null, "profile-after-change", null);

// An app is going to have some prefs set which xpcshell tests don't.
Services.prefs.setStringPref(
  "identity.sync.tokenserver.uri",
  "http://token-server"
);

// Make sure to provide the right OS so crypto loads the right binaries
function getOS() {
  switch (mozinfo.os) {
    case "win":
      return "WINNT";
    case "mac":
      return "Darwin";
    default:
      return "Linux";
  }
}

const { updateAppInfo } = ChromeUtils.importESModule(
  "resource://testing-common/AppInfo.sys.mjs"
);
updateAppInfo({
  name: "XPCShell",
  ID: "xpcshell@tests.mozilla.org",
  version: "1",
  platformVersion: "",
  OS: getOS(),
});

// Register resource aliases. Normally done in SyncComponents.manifest.
function addResourceAlias() {
  const resProt = Services.io
    .getProtocolHandler("resource")
    .QueryInterface(Ci.nsIResProtocolHandler);
  for (let s of ["common", "sync", "crypto"]) {
    let uri = Services.io.newURI("resource://gre/modules/services-" + s + "/");
    resProt.setSubstitution("services-" + s, uri);
  }
}
addResourceAlias();
