/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { FileUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/FileUtils.sys.mjs"
);

add_task(async function test_roundtrip() {
  _("Do a simple write of an array to json and read");
  await Utils.jsonSave("foo", {}, ["v1", "v2"]);

  let foo = await Utils.jsonLoad("foo", {});
  Assert.equal(typeof foo, "object");
  Assert.equal(foo.length, 2);
  Assert.equal(foo[0], "v1");
  Assert.equal(foo[1], "v2");
});

add_task(async function test_string() {
  _("Try saving simple strings");
  await Utils.jsonSave("str", {}, "hi");

  let str = await Utils.jsonLoad("str", {});
  Assert.equal(typeof str, "string");
  Assert.equal(str.length, 2);
  Assert.equal(str[0], "h");
  Assert.equal(str[1], "i");
});

add_task(async function test_number() {
  _("Try saving a number");
  await Utils.jsonSave("num", {}, 42);

  let num = await Utils.jsonLoad("num", {});
  Assert.equal(typeof num, "number");
  Assert.equal(num, 42);
});

add_task(async function test_nonexistent_file() {
  _("Try loading a non-existent file.");
  let val = await Utils.jsonLoad("non-existent", {});
  Assert.equal(val, undefined);
});

add_task(async function test_save_logging() {
  _("Verify that writes are logged.");
  let trace;
  await Utils.jsonSave(
    "log",
    {
      _log: {
        trace(msg) {
          trace = msg;
        },
      },
    },
    "hi"
  );
  Assert.ok(!!trace);
});

add_task(async function test_load_logging() {
  _("Verify that reads and read errors are logged.");

  // Write a file with some invalid JSON
  let file = await IOUtils.getFile(PathUtils.profileDir, "weave", "log.json");
  let fos = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(
    Ci.nsIFileOutputStream
  );
  let flags =
    FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_TRUNCATE;
  fos.init(file, flags, FileUtils.PERMS_FILE, fos.DEFER_OPEN);
  let stream = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(
    Ci.nsIConverterOutputStream
  );
  stream.init(fos, "UTF-8");
  stream.writeString("invalid json!");
  stream.close();

  let trace, debug;
  let obj = {
    _log: {
      trace(msg) {
        trace = msg;
      },
      debug(msg) {
        debug = msg;
      },
    },
  };
  let val = await Utils.jsonLoad("log", obj);
  Assert.ok(!val);
  Assert.ok(!!trace);
  Assert.ok(!!debug);
});
