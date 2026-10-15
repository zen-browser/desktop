/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { AppConstants } = ChromeUtils.importESModule(
  "resource://gre/modules/AppConstants.sys.mjs"
);

const modules = [
  "addonutils.sys.mjs",
  "addonsreconciler.sys.mjs",
  "constants.sys.mjs",
  "engines/addons.sys.mjs",
  "engines/clients.sys.mjs",
  "engines/extension-storage.sys.mjs",
  "engines/passwords.sys.mjs",
  "engines/prefs.sys.mjs",
  "engines.sys.mjs",
  "keys.sys.mjs",
  "main.sys.mjs",
  "policies.sys.mjs",
  "record.sys.mjs",
  "resource.sys.mjs",
  "service.sys.mjs",
  "stages/declined.sys.mjs",
  "stages/enginesync.sys.mjs",
  "status.sys.mjs",
  "sync_auth.sys.mjs",
  "util.sys.mjs",
];

if (AppConstants.MOZ_APP_NAME != "thunderbird") {
  modules.push(
    "engines/bookmarks.sys.mjs",
    "engines/forms.sys.mjs",
    "engines/history.sys.mjs",
    "engines/tabs.sys.mjs"
  );
}

const testingModules = [
  "fakeservices.sys.mjs",
  "rotaryengine.sys.mjs",
  "utils.sys.mjs",
  "fxa_utils.sys.mjs",
];

function run_test() {
  for (let m of modules) {
    let res = "resource://services-sync/" + m;
    _("Attempting to load " + res);
    ChromeUtils.importESModule(res);
  }

  for (let m of testingModules) {
    let res = "resource://testing-common/services/sync/" + m;
    _("Attempting to load " + res);
    ChromeUtils.importESModule(res);
  }
}
