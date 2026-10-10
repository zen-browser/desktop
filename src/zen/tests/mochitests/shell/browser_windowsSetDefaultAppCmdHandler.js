/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

const { CommandLineHandler } = ChromeUtils.importESModule(
  "moz-src:///browser/components/shell/WindowsSetDefaultAppCmdHandler.sys.mjs"
);

ChromeUtils.defineESModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  SET_DEFAULT_REDIRECT_PREF:
    "moz-src:///browser/components/shell/WindowsSetDefaultRedirect.sys.mjs",
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
  WindowsSetDefaultRedirect:
    "moz-src:///browser/components/shell/WindowsSetDefaultRedirect.sys.mjs",
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

Assert.equal(AppConstants.platform, "win", "Platform is Windows");

const confusedFoxPath = ShellService.getBundledPdfFile("confused_fox.pdf").path;
const blankURISpec = Services.io.newFileURI(
  ShellService.getBundledPdfFile("blank.pdf")
).spec;

const workingDir = Services.dirsvc.get("GreD", Ci.nsIFile);

// Build a real nsICommandLine from an args array, so we exercise the same
// flag-parsing the OS-initiated launch goes through
function makeCmdLine(args, state = Ci.nsICommandLine.STATE_INITIAL_LAUNCH) {
  return Cu.createCommandLine(args, workingDir, state);
}

// Arm the one-shot redirect via the real ShellService helper, the way
// setAsDefault{*}Handler does right before launching the OS picker. These
// tests all use file openWithArgs, so default the type.
function armRedirect(
  openWithArg,
  overrideUri,
  type = WindowsSetDefaultRedirect.TYPE.FILE
) {
  WindowsSetDefaultRedirect.arm(openWithArg, overrideUri, type);
}

let fakeWin;
let getTopWindowStub;
let openWindowStub;

add_setup(function () {
  fakeWin = { openTrustedLinkIn: sinon.stub() };
  // Stubbed rather than spied: getTopWindow must return our fake window (and
  // null on demand), and openWindow must not actually open a window in the
  // test harness. We only inspect the calls.
  getTopWindowStub = sinon.stub(BrowserWindowTracker, "getTopWindow");
  openWindowStub = sinon.stub(BrowserWindowTracker, "openWindow");
});

registerCleanupFunction(() => {
  sinon.restore();
  Services.prefs.clearUserPref(SET_DEFAULT_REDIRECT_PREF);
});

function resetState() {
  fakeWin.openTrustedLinkIn.resetHistory();
  getTopWindowStub.reset();
  getTopWindowStub.returns(fakeWin);
  openWindowStub.reset();
  Services.prefs.clearUserPref(SET_DEFAULT_REDIRECT_PREF);
}

add_task(async function test_no_osint_returns_early() {
  resetState();
  armRedirect(confusedFoxPath, blankURISpec);
  const cmdLine = makeCmdLine(["-url", confusedFoxPath]);
  new CommandLineHandler().handle(cmdLine);

  Assert.equal(
    cmdLine.preventDefault,
    false,
    "preventDefault left untouched without -osint"
  );
  Assert.greaterOrEqual(
    cmdLine.findFlag("url", false),
    0,
    "-url remains for the next handler"
  );
  Assert.ok(
    fakeWin.openTrustedLinkIn.notCalled,
    "No tab opened without -osint"
  );
  Assert.ok(openWindowStub.notCalled, "No window opened without -osint");
});

add_task(async function test_osint_without_url_returns_early() {
  resetState();
  armRedirect(confusedFoxPath, blankURISpec);
  const cmdLine = makeCmdLine(["-osint"]);
  new CommandLineHandler().handle(cmdLine);

  Assert.equal(
    cmdLine.preventDefault,
    false,
    "preventDefault left untouched without -url"
  );
  Assert.ok(fakeWin.openTrustedLinkIn.notCalled, "No tab opened without -url");
  Assert.ok(openWindowStub.notCalled, "No window opened without -url");
});

add_task(async function test_no_pending_redirect_leaves_arg() {
  // No armed redirect: even a -url that looks like our stub PDF is a real,
  // user-initiated open (e.g. they double-clicked the file), so we must leave
  // it for BrowserContentHandler.
  resetState();

  const cmdLine = makeCmdLine(["-osint", "-url", confusedFoxPath]);
  new CommandLineHandler().handle(cmdLine);

  Assert.equal(
    cmdLine.preventDefault,
    false,
    "preventDefault not set when no redirect is pending"
  );
  Assert.greaterOrEqual(
    cmdLine.findFlag("url", false),
    0,
    "-url preserved for BrowserContentHandler"
  );
  Assert.ok(
    fakeWin.openTrustedLinkIn.notCalled,
    "No tab opened when no redirect is pending"
  );
  Assert.ok(
    openWindowStub.notCalled,
    "No window opened when no redirect is pending"
  );
});

add_task(async function test_unrelated_url_arg_is_ignored() {
  resetState();
  armRedirect(confusedFoxPath, blankURISpec);

  const cmdLine = makeCmdLine([
    "-osint",
    "-url",
    "https://example.com/some-page",
  ]);
  new CommandLineHandler().handle(cmdLine);

  Assert.equal(
    cmdLine.preventDefault,
    false,
    "preventDefault not set for a -url that isn't the pending openWithArg"
  );
  Assert.greaterOrEqual(
    cmdLine.findFlag("url", false),
    0,
    "-url preserved for subsequent handler"
  );
  Assert.ok(
    fakeWin.openTrustedLinkIn.notCalled,
    "No tab opened for an unrelated -url"
  );
  Assert.ok(
    Services.prefs.prefHasUserValue(SET_DEFAULT_REDIRECT_PREF),
    "Pending redirect untouched when the openWithArg doesn't match"
  );
});

add_task(async function test_suppress_only_when_target_null() {
  resetState();
  armRedirect(confusedFoxPath, null);

  const cmdLine = makeCmdLine(["-osint", "-url", confusedFoxPath]);
  new CommandLineHandler().handle(cmdLine);

  Assert.equal(
    cmdLine.preventDefault,
    true,
    "openWithArg suppressed so BrowserContentHandler skips it"
  );
  Assert.equal(
    cmdLine.findFlag("url", false),
    -1,
    "-url consumed even with no redirect target"
  );
  Assert.ok(
    fakeWin.openTrustedLinkIn.notCalled,
    "No redirect when target is null"
  );
  Assert.ok(openWindowStub.notCalled, "No fallback window when target is null");
  Assert.ok(
    !Services.prefs.prefHasUserValue(SET_DEFAULT_REDIRECT_PREF),
    "Redirect intent consumed"
  );
});

add_task(async function test_redirects_to_top_window() {
  resetState();
  armRedirect(confusedFoxPath, blankURISpec);

  const cmdLine = makeCmdLine(["-osint", "-url", confusedFoxPath]);
  new CommandLineHandler().handle(cmdLine);

  Assert.equal(
    cmdLine.preventDefault,
    true,
    "Default open suppressed for the pending openWithArg"
  );
  Assert.equal(cmdLine.findFlag("url", false), -1, "-url consumed");
  Assert.ok(
    fakeWin.openTrustedLinkIn.calledOnce,
    "Redirected into the top window"
  );
  Assert.deepEqual(fakeWin.openTrustedLinkIn.firstCall.args, [
    blankURISpec,
    "tab",
  ]);
  Assert.ok(openWindowStub.notCalled, "No new window when one exists");
  Assert.ok(
    !Services.prefs.prefHasUserValue(SET_DEFAULT_REDIRECT_PREF),
    "Redirect intent is one-shot and cleared after use"
  );
});

add_task(async function test_opens_new_window_when_no_top() {
  resetState();
  getTopWindowStub.returns(null);
  armRedirect(confusedFoxPath, blankURISpec);

  const cmdLine = makeCmdLine(["-osint", "-url", confusedFoxPath]);
  new CommandLineHandler().handle(cmdLine);

  Assert.equal(
    cmdLine.preventDefault,
    true,
    "Default open suppressed even when no top window exists"
  );
  Assert.ok(
    fakeWin.openTrustedLinkIn.notCalled,
    "Top-window path skipped when getTopWindow returns null"
  );
  Assert.ok(openWindowStub.calledOnce, "Falls back to openWindow");

  const opts = openWindowStub.firstCall.args[0];
  Assert.ok(
    opts && opts.args,
    "openWindow called with a {args} options object"
  );
  Assert.ok(
    opts.args instanceof Ci.nsISupportsString,
    "args is an nsISupportsString"
  );
  Assert.equal(
    opts.args.data,
    blankURISpec,
    "nsISupportsString carries the redirect URI"
  );
  Assert.ok(
    !Services.prefs.prefHasUserValue(SET_DEFAULT_REDIRECT_PREF),
    "Redirect intent is one-shot and cleared after use"
  );
});

add_task(async function test_intent_is_one_shot() {
  resetState();
  armRedirect(confusedFoxPath, blankURISpec);

  new CommandLineHandler().handle(
    makeCmdLine(["-osint", "-url", confusedFoxPath])
  );
  Assert.ok(
    fakeWin.openTrustedLinkIn.calledOnce,
    "First call honors the pending redirect"
  );

  fakeWin.openTrustedLinkIn.resetHistory();
  const second = makeCmdLine(["-osint", "-url", confusedFoxPath]);
  new CommandLineHandler().handle(second);

  Assert.equal(
    second.preventDefault,
    false,
    "Second call leaves the openWithArg alone because the intent was consumed"
  );
  Assert.greaterOrEqual(
    second.findFlag("url", false),
    0,
    "-url preserved on the second call (no pending redirect)"
  );
  Assert.ok(
    fakeWin.openTrustedLinkIn.notCalled,
    "Second call does not redirect"
  );
});
