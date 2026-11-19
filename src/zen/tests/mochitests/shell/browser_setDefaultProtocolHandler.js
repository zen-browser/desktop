/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.defineESModuleGetters(this, {
  DEFAULT_PROTOCOL_URLS:
    "moz-src:///browser/components/shell/ShellService.sys.mjs",
  SET_DEFAULT_REDIRECT_PREF:
    "moz-src:///browser/components/shell/WindowsSetDefaultRedirect.sys.mjs",
  WindowsSetDefaultRedirect:
    "moz-src:///browser/components/shell/WindowsSetDefaultRedirect.sys.mjs",
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

// Everything here is Windows.
Assert.equal(AppConstants.platform, "win", "Platform is Windows");

// Protocol defaults carry OPEN_WITH_PROTOCOL_MESSAGING on top of the
// set-handler flag, unlike the file-type flags in browser_setDefaultPDFHandler.
const SET_PROTOCOL_WIN11 =
  Ci.nsIWindowsShellService.OPEN_WITH_SET_HANDLER |
  Ci.nsIWindowsShellService.OPEN_WITH_PROTOCOL_MESSAGING;
const SET_PROTOCOL_WIN10 =
  Ci.nsIWindowsShellService.OPEN_WITH_SET_HANDLER_WIN10 |
  Ci.nsIWindowsShellService.OPEN_WITH_PROTOCOL_MESSAGING;

const launchSetDefaultAppPickerStub = sinon.stub();
const launchModernSettingsDialogDefaultAppsStub = sinon.stub();
const shellStub = sinon.stub(ShellService, "shellService").value({
  launchSetDefaultAppPicker: launchSetDefaultAppPickerStub,
  launchModernSettingsDialogDefaultApps:
    launchModernSettingsDialogDefaultAppsStub,
  QueryInterface: ChromeUtils.generateQI([]),
});

registerCleanupFunction(() => {
  shellStub.restore();
  Services.prefs.clearUserPref(SET_DEFAULT_REDIRECT_PREF);
});

function resetState() {
  launchSetDefaultAppPickerStub.reset();
  launchModernSettingsDialogDefaultAppsStub.reset();
  Services.prefs.clearUserPref(SET_DEFAULT_REDIRECT_PREF);
}

function readPrefObject() {
  return JSON.parse(
    Services.prefs.getStringPref(SET_DEFAULT_REDIRECT_PREF, "")
  );
}

add_task(async function test_default_https_uses_url_and_win11_flag() {
  resetState();
  const sandbox = sinon.createSandbox();
  sandbox.stub(ShellService, "_isWindows11").returns(true);

  try {
    await ShellService.setAsDefaultProtocolHandler("https");

    Assert.ok(
      launchSetDefaultAppPickerStub.calledOnce,
      "Picker invoked once for the https default"
    );
    Assert.deepEqual(
      launchSetDefaultAppPickerStub.firstCall.args,
      [DEFAULT_PROTOCOL_URLS.https, SET_PROTOCOL_WIN11],
      "Picker called with https URL and SET_HANDLER | PROTOCOL_MESSAGING"
    );
    Assert.ok(
      launchModernSettingsDialogDefaultAppsStub.notCalled,
      "Modern settings not invoked when launcher succeeds"
    );
    Assert.deepEqual(
      readPrefObject(),
      {
        openWithArg: DEFAULT_PROTOCOL_URLS.https,
        overrideUri: null,
        type: WindowsSetDefaultRedirect.TYPE.PROTOCOL,
      },
      "Pref records the URL; overrideUri null so the round-trip is suppressed"
    );
  } finally {
    sandbox.restore();
  }
});

add_task(async function test_custom_url_overrides_protocol_default() {
  resetState();
  const sandbox = sinon.createSandbox();
  sandbox.stub(ShellService, "_isWindows11").returns(true);

  try {
    const customUrl = "https://custom.example.com/handler-check";
    await ShellService.setAsDefaultProtocolHandler("https", customUrl, true);

    Assert.deepEqual(
      launchSetDefaultAppPickerStub.firstCall.args,
      [customUrl, SET_PROTOCOL_WIN11],
      "Picker called with caller-provided URL, not the protocol default"
    );
    Assert.deepEqual(
      readPrefObject(),
      {
        openWithArg: customUrl,
        overrideUri: DEFAULT_PROTOCOL_URLS.https,
        type: WindowsSetDefaultRedirect.TYPE.PROTOCOL,
      },
      "Pref stashes the custom URL + protocol-default overrideUri for the round-trip"
    );
  } finally {
    sandbox.restore();
  }
});

add_task(async function test_win10_uses_set_handler_win10_flag() {
  resetState();
  const sandbox = sinon.createSandbox();
  sandbox.stub(ShellService, "_isWindows11").returns(false);

  try {
    await ShellService.setAsDefaultProtocolHandler("https");
    Assert.deepEqual(
      launchSetDefaultAppPickerStub.firstCall.args,
      [DEFAULT_PROTOCOL_URLS.https, SET_PROTOCOL_WIN10],
      "Picker called with SET_HANDLER_WIN10 | PROTOCOL_MESSAGING when not on Win11"
    );
  } finally {
    sandbox.restore();
  }
});

add_task(async function test_falls_back_to_settings_when_picker_throws() {
  resetState();
  const sandbox = sinon.createSandbox();
  sandbox.stub(ShellService, "_isWindows11").returns(true);
  launchSetDefaultAppPickerStub.throws(new Error("mock launcher failure"));

  try {
    await ShellService.setAsDefaultProtocolHandler("https", undefined, true);

    Assert.ok(launchSetDefaultAppPickerStub.called, "Tried picker first");
    Assert.ok(
      launchModernSettingsDialogDefaultAppsStub.called,
      "Fell through to modern settings when launcher threw"
    );
    Assert.ok(
      !Services.prefs.prefHasUserValue(SET_DEFAULT_REDIRECT_PREF),
      "Pending redirect cleared on launcher failure so a later round-trip can't pick up stale intent"
    );
  } finally {
    sandbox.restore();
  }
});

add_task(async function test_unknown_protocol_with_no_url_throws() {
  resetState();

  await Assert.rejects(
    ShellService.setAsDefaultProtocolHandler("notaprotocol"),
    /No URL provided and no DEFAULT_PROTOCOL_URLS fallback/,
    "Throws when neither URL nor protocol fallback resolves to a URL"
  );
  Assert.ok(
    launchSetDefaultAppPickerStub.notCalled,
    "Picker not invoked when args don't resolve to a URL"
  );
  Assert.ok(
    !Services.prefs.prefHasUserValue(SET_DEFAULT_REDIRECT_PREF),
    "Pref not touched when validation fails before any side effects"
  );
});

// Wait for the deferred set_default_protocol_handler_attempt event to be
// recorded, then return the single event emitted by the most recent call.
async function awaitAttemptEvent() {
  await TestUtils.waitForCondition(() => {
    const events =
      Glean.browser.setDefaultProtocolHandlerAttempt.testGetValue();
    return events && events.length;
  }, "Recorded set_default_protocol_handler_attempt event");
  const events = Glean.browser.setDefaultProtocolHandlerAttempt.testGetValue();
  Assert.equal(events.length, 1, "Recorded exactly one attempt event");
  return events[0];
}

add_task(async function test_telemetry_records_open_with_success() {
  resetState();
  const sandbox = sinon.createSandbox();
  sandbox.stub(ShellService, "_isWindows11").returns(true);
  const isDefaultHandlerForStub = sandbox
    .stub(ShellService, "isDefaultHandlerFor")
    .returns(true);
  await SpecialPowers.pushPrefEnv({
    set: [["browser.shell.setDefaultProtocolHandler.attemptWaitTimeMs", 0]],
  });

  try {
    Services.fog.testResetFOG();
    await ShellService.setAsDefaultProtocolHandler("https");

    const event = await awaitAttemptEvent();
    Assert.equal(event.extra.method, "open_with", "Event method is open_with");
    Assert.equal(event.extra.success, "true", "Event success is true");
    Assert.equal(event.extra.protocol, "https", "Event protocol is https");
    Assert.equal(
      event.extra.result_is_default,
      "true",
      "Event result_is_default reflects isDefaultHandlerFor"
    );
    Assert.ok(
      isDefaultHandlerForStub.calledWith("https"),
      "Sampled isDefaultHandlerFor with the protocol"
    );
  } finally {
    sandbox.restore();
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_telemetry_records_settings_fallback() {
  resetState();
  const sandbox = sinon.createSandbox();
  sandbox.stub(ShellService, "_isWindows11").returns(true);
  sandbox.stub(ShellService, "isDefaultHandlerFor").returns(true);
  launchSetDefaultAppPickerStub.throws(new Error("mock launcher failure"));
  await SpecialPowers.pushPrefEnv({
    set: [["browser.shell.setDefaultProtocolHandler.attemptWaitTimeMs", 0]],
  });

  try {
    Services.fog.testResetFOG();
    await ShellService.setAsDefaultProtocolHandler("mailto");

    Assert.equal(
      Glean.browser.setDefaultProtocolHandlerModernSettingsResult.Success.testGetValue(),
      1,
      "Recorded modern settings success"
    );

    const event = await awaitAttemptEvent();
    Assert.equal(
      event.extra.method,
      "settings",
      "Event method is settings (last attempted)"
    );
    Assert.equal(
      event.extra.success,
      "true",
      "Event success reflects modern settings launch"
    );
    Assert.equal(event.extra.protocol, "mailto", "Event protocol is mailto");
  } finally {
    sandbox.restore();
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_telemetry_records_complete_failure() {
  resetState();
  const sandbox = sinon.createSandbox();
  sandbox.stub(ShellService, "_isWindows11").returns(true);
  sandbox.stub(ShellService, "isDefaultHandlerFor").returns(false);
  launchSetDefaultAppPickerStub.throws(new Error("mock launcher failure"));
  launchModernSettingsDialogDefaultAppsStub.throws(
    new Error("mock modern settings failure")
  );
  await SpecialPowers.pushPrefEnv({
    set: [["browser.shell.setDefaultProtocolHandler.attemptWaitTimeMs", 0]],
  });

  try {
    Services.fog.testResetFOG();
    await ShellService.setAsDefaultProtocolHandler("https");

    Assert.equal(
      Glean.browser.setDefaultProtocolHandlerModernSettingsResult.Failure.testGetValue(),
      1,
      "Recorded modern settings failure"
    );

    const event = await awaitAttemptEvent();
    Assert.equal(event.extra.method, "settings", "Event method is settings");
    Assert.equal(
      event.extra.success,
      "false",
      "Event success is false when every method failed"
    );
    Assert.equal(
      event.extra.result_is_default,
      "false",
      "Event result_is_default is false when no method set the default"
    );
  } finally {
    sandbox.restore();
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_overwrites_existing_pending_redirect() {
  resetState();
  const sandbox = sinon.createSandbox();
  sandbox.stub(ShellService, "_isWindows11").returns(true);

  try {
    // A differently-typed leftover value on the pref must not trip the
    // setStringPref in WindowsSetDefaultRedirect.arm (it clears first).
    Services.prefs.setBoolPref(SET_DEFAULT_REDIRECT_PREF, true);
    await ShellService.setAsDefaultProtocolHandler("https", undefined, false);
    Assert.deepEqual(
      readPrefObject(),
      {
        openWithArg: DEFAULT_PROTOCOL_URLS.https,
        overrideUri: null,
        type: WindowsSetDefaultRedirect.TYPE.PROTOCOL,
      },
      "Stale value replaced with the structured redirect on the next call"
    );
  } finally {
    sandbox.restore();
  }
});
