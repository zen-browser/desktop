/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// `Service` is used as a global in head_helpers.js.
// eslint-disable-next-line no-unused-vars
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { logManager } = ChromeUtils.importESModule(
  "resource://gre/modules/FxAccountsCommon.sys.mjs"
);
const { FileUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/FileUtils.sys.mjs"
);

const logsdir = FileUtils.getDir("ProfD", ["weave", "logs"]);
logsdir.create(Ci.nsIFile.DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);

// Delay to wait before cleanup, to allow files to age.
// This is so large because the file timestamp granularity is per-second, and
// so otherwise we can end up with all of our files -- the ones we want to
// keep, and the ones we want to clean up -- having the same modified time.
const CLEANUP_DELAY = 2000;
const DELAY_BUFFER = 500; // Buffer for timers on different OS platforms.

function run_test() {
  validate_all_future_pings();
  run_next_test();
}

add_test(function test_noOutput() {
  // Ensure that the log appender won't print anything.
  logManager._fileAppender.level = Log.Level.Fatal + 1;

  // Clear log output from startup.
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnSuccess", false);
  Svc.Obs.notify("weave:service:sync:finish");
  Svc.Obs.add("weave:service:reset-file-log", function onResetFileLogOuter() {
    Svc.Obs.remove("weave:service:reset-file-log", onResetFileLogOuter);
    // Clear again without having issued any output.
    Svc.PrefBranch.setBoolPref("log.appender.file.logOnSuccess", true);

    Svc.Obs.add("weave:service:reset-file-log", function onResetFileLogInner() {
      Svc.Obs.remove("weave:service:reset-file-log", onResetFileLogInner);

      logManager._fileAppender.level = Log.Level.Trace;
      for (const pref of Svc.PrefBranch.getChildList("")) {
        Svc.PrefBranch.clearUserPref(pref);
      }
      run_next_test();
    });

    // Fake a successful sync.
    Svc.Obs.notify("weave:service:sync:finish");
  });
});

add_test(function test_logOnSuccess_false() {
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnSuccess", false);

  let log = Log.repository.getLogger("Sync.Test.FileLog");
  log.info("this won't show up");

  Svc.Obs.add("weave:service:reset-file-log", function onResetFileLog() {
    Svc.Obs.remove("weave:service:reset-file-log", onResetFileLog);
    // No log file was written.
    Assert.ok(!logsdir.directoryEntries.hasMoreElements());

    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
    run_next_test();
  });

  // Fake a successful sync.
  Svc.Obs.notify("weave:service:sync:finish");
});

function readFile(file, callback) {
  NetUtil.asyncFetch(
    {
      uri: NetUtil.newURI(file),
      loadUsingSystemPrincipal: true,
    },
    function (inputStream, statusCode) {
      let data = NetUtil.readInputStreamToString(
        inputStream,
        inputStream.available()
      );
      callback(statusCode, data);
    }
  );
}

add_test(function test_logOnSuccess_true() {
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnSuccess", true);

  let log = Log.repository.getLogger("Sync.Test.FileLog");
  const MESSAGE = "this WILL show up";
  log.info(MESSAGE);

  Svc.Obs.add("weave:service:reset-file-log", function onResetFileLog() {
    Svc.Obs.remove("weave:service:reset-file-log", onResetFileLog);

    // Exactly one log file was written.
    let entries = logsdir.directoryEntries;
    Assert.ok(entries.hasMoreElements());
    let logfile = entries.getNext().QueryInterface(Ci.nsIFile);
    Assert.equal(logfile.leafName.slice(-4), ".txt");
    Assert.ok(logfile.leafName.startsWith("success-sync-"), logfile.leafName);
    Assert.ok(!entries.hasMoreElements());

    // Ensure the log message was actually written to file.
    readFile(logfile, function (error, data) {
      Assert.ok(Components.isSuccessCode(error));
      Assert.notEqual(data.indexOf(MESSAGE), -1);

      // Clean up.
      try {
        logfile.remove(false);
      } catch (ex) {
        dump("Couldn't delete file: " + ex.message + "\n");
        // Stupid Windows box.
      }

      for (const pref of Svc.PrefBranch.getChildList("")) {
        Svc.PrefBranch.clearUserPref(pref);
      }
      run_next_test();
    });
  });

  // Fake a successful sync.
  Svc.Obs.notify("weave:service:sync:finish");
});

add_test(function test_sync_error_logOnError_false() {
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", false);

  let log = Log.repository.getLogger("Sync.Test.FileLog");
  log.info("this won't show up");

  Svc.Obs.add("weave:service:reset-file-log", function onResetFileLog() {
    Svc.Obs.remove("weave:service:reset-file-log", onResetFileLog);
    // No log file was written.
    Assert.ok(!logsdir.directoryEntries.hasMoreElements());

    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
    run_next_test();
  });

  // Fake an unsuccessful sync.
  Svc.Obs.notify("weave:service:sync:error");
});

add_test(function test_sync_error_logOnError_true() {
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", true);

  let log = Log.repository.getLogger("Sync.Test.FileLog");
  const MESSAGE = "this WILL show up";
  log.info(MESSAGE);

  Svc.Obs.add("weave:service:reset-file-log", function onResetFileLog() {
    Svc.Obs.remove("weave:service:reset-file-log", onResetFileLog);

    // Exactly one log file was written.
    let entries = logsdir.directoryEntries;
    Assert.ok(entries.hasMoreElements());
    let logfile = entries.getNext().QueryInterface(Ci.nsIFile);
    Assert.equal(logfile.leafName.slice(-4), ".txt");
    Assert.ok(logfile.leafName.startsWith("error-sync-"), logfile.leafName);
    Assert.ok(!entries.hasMoreElements());

    // Ensure the log message was actually written to file.
    readFile(logfile, function (error, data) {
      Assert.ok(Components.isSuccessCode(error));
      Assert.notEqual(data.indexOf(MESSAGE), -1);

      // Clean up.
      try {
        logfile.remove(false);
      } catch (ex) {
        dump("Couldn't delete file: " + ex.message + "\n");
        // Stupid Windows box.
      }

      for (const pref of Svc.PrefBranch.getChildList("")) {
        Svc.PrefBranch.clearUserPref(pref);
      }
      run_next_test();
    });
  });

  // Fake an unsuccessful sync.
  Svc.Obs.notify("weave:service:sync:error");
});

add_test(function test_login_error_logOnError_false() {
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", false);

  let log = Log.repository.getLogger("Sync.Test.FileLog");
  log.info("this won't show up");

  Svc.Obs.add("weave:service:reset-file-log", function onResetFileLog() {
    Svc.Obs.remove("weave:service:reset-file-log", onResetFileLog);
    // No log file was written.
    Assert.ok(!logsdir.directoryEntries.hasMoreElements());

    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
    run_next_test();
  });

  // Fake an unsuccessful login.
  Svc.Obs.notify("weave:service:login:error");
});

add_test(function test_login_error_logOnError_true() {
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", true);

  let log = Log.repository.getLogger("Sync.Test.FileLog");
  const MESSAGE = "this WILL show up";
  log.info(MESSAGE);

  Svc.Obs.add("weave:service:reset-file-log", function onResetFileLog() {
    Svc.Obs.remove("weave:service:reset-file-log", onResetFileLog);

    // Exactly one log file was written.
    let entries = logsdir.directoryEntries;
    Assert.ok(entries.hasMoreElements());
    let logfile = entries.getNext().QueryInterface(Ci.nsIFile);
    Assert.equal(logfile.leafName.slice(-4), ".txt");
    Assert.ok(logfile.leafName.startsWith("error-sync-"), logfile.leafName);
    Assert.ok(!entries.hasMoreElements());

    // Ensure the log message was actually written to file.
    readFile(logfile, function (error, data) {
      Assert.ok(Components.isSuccessCode(error));
      Assert.notEqual(data.indexOf(MESSAGE), -1);

      // Clean up.
      try {
        logfile.remove(false);
      } catch (ex) {
        dump("Couldn't delete file: " + ex.message + "\n");
        // Stupid Windows box.
      }

      for (const pref of Svc.PrefBranch.getChildList("")) {
        Svc.PrefBranch.clearUserPref(pref);
      }
      run_next_test();
    });
  });

  // Fake an unsuccessful login.
  Svc.Obs.notify("weave:service:login:error");
});

add_test(function test_noNewFailed_noErrorLog() {
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", true);
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnSuccess", false);

  Svc.Obs.add("weave:service:reset-file-log", function onResetFileLog() {
    Svc.Obs.remove("weave:service:reset-file-log", onResetFileLog);
    // No log file was written.
    Assert.ok(!logsdir.directoryEntries.hasMoreElements());

    for (const pref of Svc.PrefBranch.getChildList("")) {
      Svc.PrefBranch.clearUserPref(pref);
    }
    run_next_test();
  });
  // failed is nonzero and newFailed is zero -- shouldn't write a log.
  let count = {
    applied: 8,
    succeeded: 4,
    failed: 5,
    newFailed: 0,
    reconciled: 4,
  };
  Svc.Obs.notify("weave:engine:sync:applied", count, "foobar-engine");
  Svc.Obs.notify("weave:service:sync:finish");
});

add_test(function test_newFailed_errorLog() {
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", true);
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnSuccess", false);

  let log = Log.repository.getLogger("Sync.Test.FileLog");
  const MESSAGE = "this WILL show up 2";
  log.info(MESSAGE);

  Svc.Obs.add("weave:service:reset-file-log", function onResetFileLog() {
    Svc.Obs.remove("weave:service:reset-file-log", onResetFileLog);

    // Exactly one log file was written.
    let entries = logsdir.directoryEntries;
    Assert.ok(entries.hasMoreElements());
    let logfile = entries.getNext().QueryInterface(Ci.nsIFile);
    Assert.equal(logfile.leafName.slice(-4), ".txt");
    Assert.ok(logfile.leafName.startsWith("error-sync-"), logfile.leafName);
    Assert.ok(!entries.hasMoreElements());

    // Ensure the log message was actually written to file.
    readFile(logfile, function (error, data) {
      Assert.ok(Components.isSuccessCode(error));
      Assert.notEqual(data.indexOf(MESSAGE), -1);

      // Clean up.
      try {
        logfile.remove(false);
      } catch (ex) {
        dump("Couldn't delete file: " + ex.message + "\n");
        // Stupid Windows box.
      }

      for (const pref of Svc.PrefBranch.getChildList("")) {
        Svc.PrefBranch.clearUserPref(pref);
      }
      run_next_test();
    });
  });
  // newFailed is nonzero -- should write a log.
  let count = {
    applied: 8,
    succeeded: 4,
    failed: 5,
    newFailed: 4,
    reconciled: 4,
  };

  Svc.Obs.notify("weave:engine:sync:applied", count, "foobar-engine");
  Svc.Obs.notify("weave:service:sync:finish");
});

add_test(function test_errorLog_dumpAddons() {
  Svc.PrefBranch.setStringPref("log.logger", "Trace");
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", true);

  Svc.Obs.add("weave:service:reset-file-log", function onResetFileLog() {
    Svc.Obs.remove("weave:service:reset-file-log", onResetFileLog);

    let entries = logsdir.directoryEntries;
    Assert.ok(entries.hasMoreElements());
    let logfile = entries.getNext().QueryInterface(Ci.nsIFile);
    Assert.equal(logfile.leafName.slice(-4), ".txt");
    Assert.ok(logfile.leafName.startsWith("error-sync-"), logfile.leafName);
    Assert.ok(!entries.hasMoreElements());

    // Ensure we logged some addon list (which is probably empty)
    readFile(logfile, function (error, data) {
      Assert.ok(Components.isSuccessCode(error));
      Assert.notEqual(data.indexOf("Addons installed"), -1);

      // Clean up.
      try {
        logfile.remove(false);
      } catch (ex) {
        dump("Couldn't delete file: " + ex.message + "\n");
        // Stupid Windows box.
      }

      for (const pref of Svc.PrefBranch.getChildList("")) {
        Svc.PrefBranch.clearUserPref(pref);
      }
      run_next_test();
    });
  });

  // Fake an unsuccessful sync.
  Svc.Obs.notify("weave:service:sync:error");
});

// Check that error log files are deleted above an age threshold.
add_test(async function test_logErrorCleanup_age() {
  _("Beginning test_logErrorCleanup_age.");
  let maxAge = CLEANUP_DELAY / 1000;
  let oldLogs = [];
  let numLogs = 10;
  let errString = "some error log\n";

  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", true);
  Svc.PrefBranch.setIntPref("log.appender.file.maxErrorAge", maxAge);

  _("Making some files.");
  const logsDir = PathUtils.join(PathUtils.profileDir, "weave", "logs");
  await IOUtils.makeDirectory(logsDir);
  for (let i = 0; i < numLogs; i++) {
    let now = Date.now();
    let filename = "error-sync-" + now + "" + i + ".txt";
    let newLog = new FileUtils.File(PathUtils.join(logsDir, filename));
    let foStream = FileUtils.openFileOutputStream(newLog);
    foStream.write(errString, errString.length);
    foStream.close();
    _("  > Created " + filename);
    oldLogs.push(newLog.leafName);
  }

  Svc.Obs.add(
    "services-tests:common:log-manager:cleanup-logs",
    function onCleanupLogs() {
      Svc.Obs.remove(
        "services-tests:common:log-manager:cleanup-logs",
        onCleanupLogs
      );

      // Only the newest created log file remains.
      let entries = logsdir.directoryEntries;
      Assert.ok(entries.hasMoreElements());
      let logfile = entries.getNext().QueryInterface(Ci.nsIFile);
      Assert.ok(
        oldLogs.every(function (e) {
          return e != logfile.leafName;
        })
      );
      Assert.ok(!entries.hasMoreElements());

      // Clean up.
      try {
        logfile.remove(false);
      } catch (ex) {
        dump("Couldn't delete file: " + ex.message + "\n");
        // Stupid Windows box.
      }

      for (const pref of Svc.PrefBranch.getChildList("")) {
        Svc.PrefBranch.clearUserPref(pref);
      }
      run_next_test();
    }
  );

  let delay = CLEANUP_DELAY + DELAY_BUFFER;

  _("Cleaning up logs after " + delay + "msec.");
  CommonUtils.namedTimer(
    function onTimer() {
      Svc.Obs.notify("weave:service:sync:error");
    },
    delay,
    this,
    "cleanup-timer"
  );
});

add_task(async function test_remove_log_on_startOver() {
  Svc.PrefBranch.setBoolPref("log.appender.file.logOnError", true);

  let log = Log.repository.getLogger("Sync.Test.FileLog");
  const MESSAGE = "this WILL show up";
  log.info(MESSAGE);

  let promiseLogWritten = promiseOneObserver("weave:service:reset-file-log");
  // Fake an unsuccessful sync.
  Svc.Obs.notify("weave:service:sync:error");

  await promiseLogWritten;
  // Should have at least 1 log file.
  let entries = logsdir.directoryEntries;
  Assert.ok(entries.hasMoreElements());

  // Fake a reset.
  let promiseRemoved = promiseOneObserver("weave:service:remove-file-log");
  Svc.Obs.notify("weave:service:start-over:finish");
  await promiseRemoved;

  // should be no files left.
  Assert.ok(!logsdir.directoryEntries.hasMoreElements());
});
