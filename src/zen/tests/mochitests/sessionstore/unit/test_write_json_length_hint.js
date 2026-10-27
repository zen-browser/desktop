/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { SessionWriter } = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/SessionWriter.sys.mjs"
);

const profd = do_get_profile();
const { SessionFile } = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/SessionFile.sys.mjs"
);

const { updateAppInfo } = ChromeUtils.importESModule(
  "resource://testing-common/AppInfo.sys.mjs"
);
updateAppInfo({
  name: "SessionRestoreTest",
  ID: "{230de50e-4cd1-11dc-8314-0800200c9a66}",
  version: "1",
  platformVersion: "",
});

add_setup(async function () {
  let source = do_get_file("data/sessionstore_valid.js");
  source.copyTo(profd, "sessionstore.js");
  await writeCompressedFile(
    SessionFile.Paths.clean.replace("jsonlz4", "js"),
    SessionFile.Paths.clean
  );
  await SessionFile.read();
});

add_task(async function test_length_hint_updates_after_write() {
  Assert.equal(SessionWriter._jsonLengthHint, 0, "Length hint starts at 0");

  await SessionFile.write({});

  let hintAfterSmall = SessionWriter._jsonLengthHint;
  Assert.equal(
    hintAfterSmall,
    JSON.stringify({}).length,
    "Hint matches the uncompressed JSON byte length"
  );

  let largerState = await IOUtils.readJSON(
    PathUtils.join(do_get_cwd().path, "data", "sessionstore_complete.json")
  );
  await SessionFile.write(largerState);

  Assert.greater(
    SessionWriter._jsonLengthHint,
    hintAfterSmall,
    "Hint grows after writing a larger state"
  );
});

add_task(async function test_length_hint_resets_on_wipe() {
  await SessionFile.write({ windows: [{ tabs: [{ entries: [] }] }] });
  Assert.greater(SessionWriter._jsonLengthHint, 0, "Hint is nonzero");

  await SessionFile.wipe();
  Assert.equal(SessionWriter._jsonLengthHint, 0, "Hint resets to 0 after wipe");
});
