/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.defineESModuleGetters(this, {
  ExperimentAPI: "resource://nimbus/ExperimentAPI.sys.mjs",
  NimbusFeatures: "resource://nimbus/ExperimentAPI.sys.mjs",
  NimbusTestUtils: "resource://testing-common/NimbusTestUtils.sys.mjs",
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

const setDefaultBrowserUserChoiceStub = sinon.stub();
const setDefaultExtensionHandlersUserChoiceStub = sinon
  .stub()
  .callsFake(() => Promise.resolve());

const defaultAgentStub = sinon.stub(ShellService, "defaultAgent").value({
  setDefaultBrowserUserChoiceAsync: setDefaultBrowserUserChoiceStub,
  setDefaultExtensionHandlersUserChoice:
    setDefaultExtensionHandlersUserChoiceStub,
});

XPCOMUtils.defineLazyServiceGetter(
  this,
  "XreDirProvider",
  "@mozilla.org/xre/directory-provider;1",
  Ci.nsIXREDirProvider
);

const _userChoiceImpossibleTelemetryResultStub = sinon
  .stub(ShellService, "_userChoiceImpossibleTelemetryResult")
  .callsFake(() => null);

// Ensure we don't fall back to a real implementation.
const setDefaultStub = sinon.stub();
// We'll dynamically update this as needed during the tests.
const queryCurrentDefaultHandlerForStub = sinon.stub();
const launchOpenWithDefaultPickerForFileTypeStub = sinon.stub();
const launchModernSettingsDialogDefaultAppsStub = sinon.stub();
const shellStub = sinon.stub(ShellService, "shellService").value({
  setDefaultBrowser: setDefaultStub,
  queryCurrentDefaultHandlerFor: queryCurrentDefaultHandlerForStub,
  QueryInterface: () => ({
    launchOpenWithDefaultPickerForFileType:
      launchOpenWithDefaultPickerForFileTypeStub,
    launchModernSettingsDialogDefaultApps:
      launchModernSettingsDialogDefaultAppsStub,
  }),
});

registerCleanupFunction(() => {
  defaultAgentStub.restore();
  _userChoiceImpossibleTelemetryResultStub.restore();
  shellStub.restore();
});

add_task(async function ready() {
  await ExperimentAPI.ready();
});

// Everything here is Windows.
Assert.equal(AppConstants.platform, "win", "Platform is Windows");

add_task(async function remoteEnableWithPDF() {
  let doCleanup = await NimbusTestUtils.enrollWithFeatureConfig(
    {
      featureId: NimbusFeatures.shellService.featureId,
      value: {
        setDefaultBrowserUserChoice: true,
        setDefaultPDFHandlerOnlyReplaceBrowsers: false,
        setDefaultPDFHandler: true,
        enabled: true,
      },
    },
    { isRollout: true }
  );

  Assert.equal(
    NimbusFeatures.shellService.getVariable("setDefaultBrowserUserChoice"),
    true
  );
  Assert.equal(
    NimbusFeatures.shellService.getVariable("setDefaultPDFHandler"),
    true
  );

  setDefaultBrowserUserChoiceStub.resetHistory();
  await ShellService.setDefaultBrowser();

  const aumi = XreDirProvider.getInstallHash();
  Assert.ok(setDefaultBrowserUserChoiceStub.called);
  Assert.deepEqual(setDefaultBrowserUserChoiceStub.firstCall.args, [
    aumi,
    [".pdf", "FirefoxPDF"],
  ]);

  await doCleanup();
});

add_task(async function remoteEnableWithPDF_testOnlyReplaceBrowsers() {
  let doCleanup = await NimbusTestUtils.enrollWithFeatureConfig(
    {
      featureId: NimbusFeatures.shellService.featureId,
      value: {
        setDefaultBrowserUserChoice: true,
        setDefaultPDFHandlerOnlyReplaceBrowsers: true,
        setDefaultPDFHandler: true,
        enabled: true,
      },
    },
    { isRollout: true }
  );

  Assert.equal(
    NimbusFeatures.shellService.getVariable("setDefaultBrowserUserChoice"),
    true
  );
  Assert.equal(
    NimbusFeatures.shellService.getVariable("setDefaultPDFHandler"),
    true
  );
  Assert.equal(
    NimbusFeatures.shellService.getVariable(
      "setDefaultPDFHandlerOnlyReplaceBrowsers"
    ),
    true
  );

  const aumi = XreDirProvider.getInstallHash();

  // We'll take the default from a missing association or a known browser.
  for (let progId of ["", "MSEdgePDF"]) {
    queryCurrentDefaultHandlerForStub.callsFake(() => progId);

    setDefaultBrowserUserChoiceStub.resetHistory();
    await ShellService.setDefaultBrowser();

    Assert.ok(setDefaultBrowserUserChoiceStub.called);
    Assert.deepEqual(
      setDefaultBrowserUserChoiceStub.firstCall.args,
      [aumi, [".pdf", "FirefoxPDF"]],
      `Will take default from missing association or known browser with ProgID '${progId}'`
    );
  }

  // But not from a non-browser.
  queryCurrentDefaultHandlerForStub.callsFake(() => "Acrobat.Document.DC");

  setDefaultBrowserUserChoiceStub.resetHistory();
  await ShellService.setDefaultBrowser();

  Assert.ok(setDefaultBrowserUserChoiceStub.called);
  Assert.deepEqual(
    setDefaultBrowserUserChoiceStub.firstCall.args,
    [aumi, []],
    `Will not take default from non-browser`
  );

  await doCleanup();
});

add_task(async function remoteEnableWithoutPDF() {
  let doCleanup = await NimbusTestUtils.enrollWithFeatureConfig(
    {
      featureId: NimbusFeatures.shellService.featureId,
      value: {
        setDefaultBrowserUserChoice: true,
        setDefaultPDFHandler: false,
        enabled: true,
      },
    },
    { isRollout: true }
  );

  Assert.equal(
    NimbusFeatures.shellService.getVariable("setDefaultBrowserUserChoice"),
    true
  );
  Assert.equal(
    NimbusFeatures.shellService.getVariable("setDefaultPDFHandler"),
    false
  );

  setDefaultBrowserUserChoiceStub.resetHistory();
  await ShellService.setDefaultBrowser();

  const aumi = XreDirProvider.getInstallHash();
  Assert.ok(setDefaultBrowserUserChoiceStub.called);
  Assert.deepEqual(setDefaultBrowserUserChoiceStub.firstCall.args, [aumi, []]);

  await doCleanup();
});

add_task(async function remoteDisable() {
  let doCleanup = await NimbusTestUtils.enrollWithFeatureConfig(
    {
      featureId: NimbusFeatures.shellService.featureId,
      value: {
        setDefaultBrowserUserChoice: false,
        setDefaultPDFHandler: true,
        enabled: false,
      },
    },
    { isRollout: true }
  );

  Assert.equal(
    NimbusFeatures.shellService.getVariable("setDefaultBrowserUserChoice"),
    false
  );
  Assert.equal(
    NimbusFeatures.shellService.getVariable("setDefaultPDFHandler"),
    true
  );

  setDefaultBrowserUserChoiceStub.resetHistory();
  await ShellService.setDefaultBrowser();

  Assert.ok(setDefaultBrowserUserChoiceStub.notCalled);
  Assert.ok(setDefaultStub.called);

  await doCleanup();
});

add_task(async function test_setAsDefaultPDFHandler_knownBrowser() {
  const sandbox = sinon.createSandbox();

  const aumi = XreDirProvider.getInstallHash();
  const expectedArguments = [aumi, [".pdf", "FirefoxPDF"]];
  const resetStubs = () => {
    setDefaultExtensionHandlersUserChoiceStub.resetHistory();
    launchOpenWithDefaultPickerForFileTypeStub.resetHistory();
    launchModernSettingsDialogDefaultAppsStub.resetHistory();
  };

  try {
    const pdfHandlerResult = { registered: true, knownBrowser: true };
    sandbox
      .stub(ShellService, "getDefaultPDFHandler")
      .returns(pdfHandlerResult);

    info("Testing setAsDefaultPDFHandler(true) when knownBrowser = true");
    await ShellService.setAsDefaultPDFHandler(true);
    Assert.ok(
      setDefaultExtensionHandlersUserChoiceStub.called,
      "Used userChoice for .pdf"
    );
    Assert.deepEqual(
      setDefaultExtensionHandlersUserChoiceStub.firstCall.args,
      expectedArguments,
      "Called default browser agent with expected arguments"
    );
    Assert.ok(
      launchOpenWithDefaultPickerForFileTypeStub.notCalled,
      "Did not fall back to open-with picker"
    );
    Assert.ok(
      launchModernSettingsDialogDefaultAppsStub.notCalled,
      "Did not fall back to settings dialog"
    );
    resetStubs();

    info("Testing setAsDefaultPDFHandler(false) when knownBrowser = true");
    await ShellService.setAsDefaultPDFHandler(false);
    Assert.ok(
      setDefaultExtensionHandlersUserChoiceStub.called,
      "Used userChoice for .pdf"
    );
    Assert.deepEqual(
      setDefaultExtensionHandlersUserChoiceStub.firstCall.args,
      expectedArguments,
      "Called default browser agent with expected arguments"
    );
    Assert.ok(
      launchOpenWithDefaultPickerForFileTypeStub.notCalled,
      "Did not fall back to open-with picker"
    );
    Assert.ok(
      launchModernSettingsDialogDefaultAppsStub.notCalled,
      "Did not fall back to settings dialog"
    );
    resetStubs();

    pdfHandlerResult.knownBrowser = false;

    info("Testing setAsDefaultPDFHandler(true) when knownBrowser = false");
    await ShellService.setAsDefaultPDFHandler(true);
    Assert.ok(
      setDefaultExtensionHandlersUserChoiceStub.notCalled,
      "Did not use userChoice"
    );
    Assert.ok(
      launchOpenWithDefaultPickerForFileTypeStub.notCalled,
      "Did not fall back to open-with picker"
    );
    Assert.ok(
      launchModernSettingsDialogDefaultAppsStub.notCalled,
      "Did not fall back to settings dialog"
    );
    resetStubs();

    info("Testing setAsDefaultPDFHandler(false) when knownBrowser = false");
    await ShellService.setAsDefaultPDFHandler(false);
    Assert.ok(
      setDefaultExtensionHandlersUserChoiceStub.called,
      "Used userChoice for .pdf"
    );
    Assert.deepEqual(
      setDefaultExtensionHandlersUserChoiceStub.firstCall.args,
      expectedArguments,
      "Called default browser agent with expected arguments"
    );
    Assert.ok(
      launchOpenWithDefaultPickerForFileTypeStub.notCalled,
      "Did not fall back to open-with picker"
    );
    Assert.ok(
      launchModernSettingsDialogDefaultAppsStub.notCalled,
      "Did not fall back to settings dialog"
    );
    resetStubs();
  } finally {
    sandbox.restore();
  }
});

// Wait for the deferred set_default_pdf_handler_attempt event to be recorded,
// then return the single event that was emitted by the most recent call.
async function awaitAttemptEvent() {
  await TestUtils.waitForCondition(() => {
    const events = Glean.browser.setDefaultPdfHandlerAttempt.testGetValue();
    return events && events.length;
  }, "Recorded set_default_pdf_handler_attempt event");
  const events = Glean.browser.setDefaultPdfHandlerAttempt.testGetValue();
  Assert.equal(events.length, 1, "Recorded exactly one attempt event");
  return events[0];
}

add_task(async function test_setAsDefaultPDFHandler_fallback() {
  const sandbox = sinon.createSandbox();
  // Enable the IOpenWithLauncher branch explicitly so the test does not
  // depend on the build-channel default of
  // browser.shell.setDefaultPDFHandler.useOpenWith, and use a 0ms wait so
  // the deferred attempt event fires promptly.
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.shell.setDefaultPDFHandler.useOpenWith", true],
      ["browser.shell.setDefaultPDFHandler.attemptWaitTimeMs", 0],
    ],
  });

  try {
    const userChoiceStub = sandbox
      .stub(ShellService, "setAsDefaultPDFHandlerUserChoice")
      .rejects(new Error("mock userChoice failure"));
    sandbox.stub(ShellService, "_isWindows11").returns(true);
    const isDefaultHandlerForStub = sandbox
      .stub(ShellService, "isDefaultHandlerFor")
      .returns(true);

    info(
      "When userChoice fails and open-with picker succeeds, should not fall back to settings dialog"
    );
    Services.fog.testResetFOG();
    await ShellService.setAsDefaultPDFHandler(false);

    Assert.ok(userChoiceStub.called, "Attempted userChoice");
    Assert.ok(
      launchOpenWithDefaultPickerForFileTypeStub.calledWith(".pdf"),
      "Fell back to open-with picker for .pdf"
    );
    Assert.ok(
      launchModernSettingsDialogDefaultAppsStub.notCalled,
      "Did not fall back to settings dialog"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerUserChoiceResult.ErrOther.testGetValue(),
      1,
      "Recorded user-choice failure"
    );

    let event = await awaitAttemptEvent();
    Assert.equal(event.extra.method, "open_with", "Event method is open_with");
    Assert.equal(event.extra.success, "true", "Event success is true");
    Assert.equal(
      event.extra.result_is_default,
      "true",
      "Event result_is_default reflects isDefaultHandlerFor"
    );
    Assert.ok(
      isDefaultHandlerForStub.calledWith(".pdf"),
      "Sampled isDefaultHandlerFor after the delay"
    );
    userChoiceStub.resetHistory();
    isDefaultHandlerForStub.resetHistory();
    launchOpenWithDefaultPickerForFileTypeStub.resetHistory();
    launchModernSettingsDialogDefaultAppsStub.resetHistory();

    info(
      "When the picker succeeds but Firefox is not default after the delay, event records result_is_default=false"
    );
    Services.fog.testResetFOG();
    isDefaultHandlerForStub.returns(false);
    await ShellService.setAsDefaultPDFHandler(false);

    event = await awaitAttemptEvent();
    Assert.equal(event.extra.method, "open_with", "Event method is open_with");
    Assert.equal(event.extra.success, "true", "Event success is true");
    Assert.equal(
      event.extra.result_is_default,
      "false",
      "Event result_is_default is false when Firefox did not become default"
    );
    isDefaultHandlerForStub.returns(true);
    userChoiceStub.resetHistory();
    isDefaultHandlerForStub.resetHistory();
    launchOpenWithDefaultPickerForFileTypeStub.resetHistory();
    launchModernSettingsDialogDefaultAppsStub.resetHistory();

    info(
      "When userChoice fails and open-with picker fails, should fall back to settings dialog"
    );
    Services.fog.testResetFOG();
    launchOpenWithDefaultPickerForFileTypeStub.throws(
      new Error("mock IOpenWithLauncher failure")
    );
    await ShellService.setAsDefaultPDFHandler(false);

    Assert.ok(userChoiceStub.called, "Attempted userChoice");
    Assert.ok(
      launchOpenWithDefaultPickerForFileTypeStub.calledWith(".pdf"),
      "Attempted open-with picker for .pdf"
    );
    Assert.ok(
      launchModernSettingsDialogDefaultAppsStub.called,
      "Fell back to settings dialog"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerUserChoiceResult.ErrOther.testGetValue(),
      1,
      "Recorded user-choice failure"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerModernSettingsResult.Success.testGetValue(),
      1,
      "Recorded modern settings success"
    );

    event = await awaitAttemptEvent();
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
    Assert.equal(
      event.extra.result_is_default,
      "true",
      "Event result_is_default reflects isDefaultHandlerFor"
    );
    userChoiceStub.resetHistory();
    isDefaultHandlerForStub.resetHistory();
    launchOpenWithDefaultPickerForFileTypeStub.resetHistory();
    launchModernSettingsDialogDefaultAppsStub.resetHistory();

    info(
      "When userChoice fails, open-with fails, and modern settings fails, event records success=false"
    );
    Services.fog.testResetFOG();
    isDefaultHandlerForStub.returns(false);
    launchModernSettingsDialogDefaultAppsStub.throws(
      new Error("mock modern settings failure")
    );
    await ShellService.setAsDefaultPDFHandler(false);

    Assert.equal(
      Glean.browser.setDefaultPdfHandlerModernSettingsResult.Failure.testGetValue(),
      1,
      "Recorded modern settings failure"
    );

    event = await awaitAttemptEvent();
    Assert.equal(
      event.extra.method,
      "settings",
      "Event method is settings (last attempted)"
    );
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
    launchOpenWithDefaultPickerForFileTypeStub.reset();
    launchModernSettingsDialogDefaultAppsStub.reset();
    sandbox.restore();
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_setAsDefaultPDFHandler_useOpenWithDisabled() {
  const sandbox = sinon.createSandbox();
  // With useOpenWith disabled, a userChoice failure should skip the
  // IOpenWithLauncher branch entirely and fall straight through to the
  // modern settings dialog.
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.shell.setDefaultPDFHandler.useOpenWith", false],
      ["browser.shell.setDefaultPDFHandler.attemptWaitTimeMs", 0],
    ],
  });

  try {
    sandbox
      .stub(ShellService, "setAsDefaultPDFHandlerUserChoice")
      .rejects(new Error("mock userChoice failure"));
    sandbox.stub(ShellService, "_isWindows11").returns(true);
    sandbox.stub(ShellService, "isDefaultHandlerFor").returns(true);

    Services.fog.testResetFOG();
    await ShellService.setAsDefaultPDFHandler(false);

    Assert.ok(
      launchOpenWithDefaultPickerForFileTypeStub.notCalled,
      "Did not invoke open-with picker when pref is disabled"
    );
    Assert.ok(
      launchModernSettingsDialogDefaultAppsStub.called,
      "Fell through to modern settings dialog"
    );

    const event = await awaitAttemptEvent();
    Assert.equal(
      event.extra.method,
      "settings",
      "Event method skipped open_with and recorded settings"
    );
    Assert.equal(event.extra.success, "true", "Event success is true");
    Assert.equal(
      event.extra.result_is_default,
      "true",
      "Event result_is_default reflects isDefaultHandlerFor"
    );
  } finally {
    launchOpenWithDefaultPickerForFileTypeStub.reset();
    launchModernSettingsDialogDefaultAppsStub.reset();
    sandbox.restore();
    await SpecialPowers.popPrefEnv();
  }
});
