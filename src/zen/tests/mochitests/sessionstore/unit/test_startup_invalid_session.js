/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function run_test() {
  let profd = do_get_profile();
  var SessionFile = ChromeUtils.importESModule(
    "resource:///modules/sessionstore/SessionFile.sys.mjs"
  ).SessionFile;

  let sourceSession = do_get_file("data/sessionstore_invalid.js");
  sourceSession.copyTo(profd, "sessionstore.js");

  let sourceCheckpoints = do_get_file("data/sessionCheckpoints_all.json");
  sourceCheckpoints.copyTo(profd, "sessionCheckpoints.json");

  // Compress sessionstore.js to sessionstore.jsonlz4
  // and remove sessionstore.js
  let oldExtSessionFile = SessionFile.Paths.clean.replace("jsonlz4", "js");
  writeCompressedFile(oldExtSessionFile, SessionFile.Paths.clean).then(() => {
    afterSessionStartupInitialization(function cb() {
      Assert.equal(SessionStartup.sessionType, SessionStartup.NO_SESSION);
      do_test_finished();
    });
  });

  do_test_pending();
}
