/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { SessionMigration } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/SessionMigration.sys.mjs"
);

add_task(async function test_migrated_state_has_show_reason() {
  let profileDir = do_get_profile().path;
  let fromPath = PathUtils.join(profileDir, "migration_in.jsonlz4");
  let toPath = PathUtils.join(profileDir, "migration_out.jsonlz4");
  await IOUtils.writeJSON(
    fromPath,
    {
      windows: [
        {
          tabs: [{ entries: [{ url: "https://example.com/" }], index: 1 }],
        },
      ],
    },
    { compress: true }
  );

  await SessionMigration.migrate(fromPath, toPath);

  let state = await IOUtils.readJSON(toPath, { decompress: true });
  let { formdata } = state.windows[0].tabs[0];
  Assert.equal(formdata.url, "about:welcomeback");
  Assert.equal(
    formdata.id.showReason,
    "profile_refresh",
    "about:welcomeback is told why it is shown"
  );
  Assert.equal(
    formdata.id.sessionData.windows[0].tabs[0].entries[0].url,
    "https://example.com/",
    "The migrated session is still passed to the page"
  );
});
