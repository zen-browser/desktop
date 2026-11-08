ChromeUtils.defineESModuleGetters(this, {
  SessionStartup:
    "moz-src:///browser/components/sessionstore/SessionStartup.sys.mjs",
  SessionStore:
    "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs",
});

function sessionStoreReadOptions() {
  let opts = { decompress: true };
  if (
    Services.prefs.getBoolPref(
      "browser.sessionstore.encryption.available",
      false
    ) &&
    Services.prefs.getBoolPref("browser.sessionstore.encryption.enabled", false)
  ) {
    opts.decrypt = "sessionstore";
  }
  return opts;
}

// Call a function once initialization of SessionStartup is complete
function afterSessionStartupInitialization(cb) {
  info("Waiting for session startup initialization");
  let observer = function () {
    try {
      info("Session startup initialization observed");
      Services.obs.removeObserver(observer, "sessionstore-state-finalized");
      cb();
    } catch (ex) {
      do_throw(ex);
    }
  };
  Services.obs.addObserver(observer, "sessionstore-state-finalized");

  // We need the Crash Monitor initialized for sessionstartup to run
  // successfully.
  const { CrashMonitor } = ChromeUtils.importESModule(
    "resource://gre/modules/CrashMonitor.sys.mjs"
  );
  CrashMonitor.init();

  // Start sessionstartup initialization.
  SessionStartup.init();
}

// Compress the source file using lz4 and put the result to destination file.
// After that, source file is deleted.
/**
 * Writes the session file and the Crash Monitor checkpoints left by the
 * previous session, then waits for SessionStartup to initialize. Neither can
 * be initialized twice, so this can only be called once per test file.
 *
 * @param {object} options
 * @param {object} options.session - The session state to write.
 * @param {object} [options.checkpoints] - The checkpoints file contents. Left
 *   unset, there is no checkpoints file.
 */
async function promiseStartupWith({ session, checkpoints }) {
  Services.fog.initializeFOG();
  await IOUtils.writeJSON(
    PathUtils.join(PathUtils.profileDir, "sessionstore.jsonlz4"),
    session,
    { compress: true }
  );
  if (checkpoints) {
    await IOUtils.writeJSON(
      PathUtils.join(PathUtils.profileDir, "sessionCheckpoints.json"),
      checkpoints
    );
  }
  await new Promise(resolve => afterSessionStartupInitialization(resolve));
}

function shutdownSuccessEvents() {
  let events =
    Glean.sessionRestore.shutdownSuccessSessionStartup.testGetValue() ?? [];
  return events.map(event => event.extra);
}

function shutdownOkCounts() {
  return {
    clean: Glean.sessionRestore.shutdownOk.true.testGetValue(),
    unclean: Glean.sessionRestore.shutdownOk.false.testGetValue(),
  };
}

async function writeCompressedFile(source, destination) {
  let s = await IOUtils.read(source);
  await IOUtils.write(destination, s, { compress: true });
  await IOUtils.remove(source);
}
