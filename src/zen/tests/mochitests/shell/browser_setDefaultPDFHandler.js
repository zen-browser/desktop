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
const shellStub = sinon.stub(ShellService, "shellService").value({
  setDefaultBrowser: setDefaultStub,
  queryCurrentDefaultHandlerFor: queryCurrentDefaultHandlerForStub,
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

  try {
    const pdfHandlerResult = { registered: true, knownBrowser: true };
    sandbox
      .stub(ShellService, "getDefaultPDFHandler")
      .returns(pdfHandlerResult);

    info("Testing setAsDefaultPDFHandler(true) when knownBrowser = true");
    ShellService.setAsDefaultPDFHandler(true);
    Assert.ok(
      setDefaultExtensionHandlersUserChoiceStub.called,
      "Called default browser agent"
    );
    Assert.deepEqual(
      setDefaultExtensionHandlersUserChoiceStub.firstCall.args,
      expectedArguments,
      "Called default browser agent with expected arguments"
    );
    setDefaultExtensionHandlersUserChoiceStub.resetHistory();

    info("Testing setAsDefaultPDFHandler(false) when knownBrowser = true");
    ShellService.setAsDefaultPDFHandler(false);
    Assert.ok(
      setDefaultExtensionHandlersUserChoiceStub.called,
      "Called default browser agent"
    );
    Assert.deepEqual(
      setDefaultExtensionHandlersUserChoiceStub.firstCall.args,
      expectedArguments,
      "Called default browser agent with expected arguments"
    );
    setDefaultExtensionHandlersUserChoiceStub.resetHistory();

    pdfHandlerResult.knownBrowser = false;

    info("Testing setAsDefaultPDFHandler(true) when knownBrowser = false");
    ShellService.setAsDefaultPDFHandler(true);
    Assert.ok(
      setDefaultExtensionHandlersUserChoiceStub.notCalled,
      "Did not call default browser agent"
    );
    setDefaultExtensionHandlersUserChoiceStub.resetHistory();

    info("Testing setAsDefaultPDFHandler(false) when knownBrowser = false");
    ShellService.setAsDefaultPDFHandler(false);
    Assert.ok(
      setDefaultExtensionHandlersUserChoiceStub.called,
      "Called default browser agent"
    );
    Assert.deepEqual(
      setDefaultExtensionHandlersUserChoiceStub.firstCall.args,
      expectedArguments,
      "Called default browser agent with expected arguments"
    );
    setDefaultExtensionHandlersUserChoiceStub.resetHistory();
  } finally {
    sandbox.restore();
  }
});
