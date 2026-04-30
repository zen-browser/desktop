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

add_task(async function test_setAsDefaultPDFHandler_fallback() {
  const sandbox = sinon.createSandbox();

  try {
    const userChoiceStub = sandbox
      .stub(ShellService, "setAsDefaultPDFHandlerUserChoice")
      .rejects(new Error("mock userChoice failure"));
    sandbox.stub(ShellService, "_isWindows11").returns(true);

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
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerUserChoiceResult.Success.testGetValue(),
      undefined,
      "Did not record user-choice success"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerOpenWithResult.Success.testGetValue(),
      1,
      "Recorded open-with success"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerOpenWithResult.Failure.testGetValue(),
      undefined,
      "Did not record open-with failure"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerModernSettingsResult.Success.testGetValue(),
      undefined,
      "Did not record modern settings result"
    );
    userChoiceStub.resetHistory();
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
      Glean.browser.setDefaultPdfHandlerUserChoiceResult.Success.testGetValue(),
      undefined,
      "Did not record user-choice success"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerOpenWithResult.Failure.testGetValue(),
      1,
      "Recorded open-with failure"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerOpenWithResult.Success.testGetValue(),
      undefined,
      "Did not record open-with success"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerModernSettingsResult.Success.testGetValue(),
      1,
      "Recorded modern settings success"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerModernSettingsResult.Failure.testGetValue(),
      undefined,
      "Did not record modern settings failure"
    );
    userChoiceStub.resetHistory();
    launchOpenWithDefaultPickerForFileTypeStub.resetHistory();
    launchModernSettingsDialogDefaultAppsStub.resetHistory();

    info(
      "When userChoice fails, open-with fails, and modern settings fails, should record all failures"
    );
    Services.fog.testResetFOG();
    launchModernSettingsDialogDefaultAppsStub.throws(
      new Error("mock modern settings failure")
    );
    await ShellService.setAsDefaultPDFHandler(false);

    Assert.equal(
      Glean.browser.setDefaultPdfHandlerUserChoiceResult.ErrOther.testGetValue(),
      1,
      "Recorded user-choice failure"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerUserChoiceResult.Success.testGetValue(),
      undefined,
      "Did not record user-choice success"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerOpenWithResult.Failure.testGetValue(),
      1,
      "Recorded open-with failure"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerModernSettingsResult.Failure.testGetValue(),
      1,
      "Recorded modern settings failure"
    );
    Assert.equal(
      Glean.browser.setDefaultPdfHandlerModernSettingsResult.Success.testGetValue(),
      undefined,
      "Did not record modern settings success"
    );
  } finally {
    launchOpenWithDefaultPickerForFileTypeStub.reset();
    launchModernSettingsDialogDefaultAppsStub.reset();
    sandbox.restore();
  }
});
