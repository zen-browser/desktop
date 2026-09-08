/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// macOS-only checks for ShellService.setAsDefaultPDFHandler and the supporting
// isDefaultHandlerFor / canSetAsDefaultPDFHandler branches. On macOS these go
// through NSWorkspace; the native layer is mocked here.

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

Assert.equal(AppConstants.platform, "macosx", "Platform is macOS");

const setAsDefaultHandlerForStub = sinon.stub().resolves(false);
const isDefaultHandlerForStub = sinon.stub().returns(false);
const isDefaultHandlerAWebBrowserForStub = sinon.stub().returns(false);

const fakeShellService = {
  canSetAsDefaultHandler: true,
  setAsDefaultHandlerFor: setAsDefaultHandlerForStub,
  isDefaultHandlerFor: isDefaultHandlerForStub,
  isDefaultHandlerAWebBrowserFor: isDefaultHandlerAWebBrowserForStub,
  QueryInterface: ChromeUtils.generateQI([]),
};

const shellStub = sinon
  .stub(ShellService, "shellService")
  .value(fakeShellService);

registerCleanupFunction(() => {
  shellStub.restore();
});

function resetStubs() {
  setAsDefaultHandlerForStub.resetHistory();
  isDefaultHandlerForStub.resetHistory();
  isDefaultHandlerAWebBrowserForStub.resetHistory();
}

function getAttemptEvent() {
  const events = Glean.browser.setDefaultPdfHandlerAttempt.testGetValue();
  Assert.ok(events?.length, "Recorded a set_default_pdf_handler_attempt event");
  Assert.equal(events.length, 1, "Recorded exactly one attempt event");
  return events[0];
}

add_task(async function test_canSetAsDefaultPDFHandler() {
  fakeShellService.canSetAsDefaultHandler = true;
  Assert.ok(
    ShellService.canSetAsDefaultPDFHandler,
    "canSetAsDefaultPDFHandler is true when the native value is true"
  );

  try {
    fakeShellService.canSetAsDefaultHandler = false;
    Assert.ok(
      !ShellService.canSetAsDefaultPDFHandler,
      "canSetAsDefaultPDFHandler is false when the native value is false"
    );
  } finally {
    fakeShellService.canSetAsDefaultHandler = true;
  }
});

add_task(async function test_isDefaultHandlerFor() {
  isDefaultHandlerForStub.returns(true);
  Assert.ok(
    ShellService.isDefaultHandlerFor(".pdf"),
    "isDefaultHandlerFor('.pdf') reflects the native result"
  );
  Assert.ok(
    isDefaultHandlerForStub.calledWith(".pdf"),
    "Forwarded '.pdf' to the native isDefaultHandlerFor"
  );

  isDefaultHandlerForStub.returns(false);
  Assert.ok(
    !ShellService.isDefaultHandlerFor(".pdf"),
    "isDefaultHandlerFor('.pdf') is false when Firefox is not the default"
  );

  isDefaultHandlerForStub.returns(true);
  Assert.ok(
    ShellService.isDefaultHandlerFor("https"),
    "isDefaultHandlerFor('https') reflects the native result"
  );
  Assert.ok(
    isDefaultHandlerForStub.calledWith("https"),
    "Forwarded 'https' to the native isDefaultHandlerFor"
  );
  resetStubs();
});

add_task(async function test_setAsDefaultPDFHandler_unsupported() {
  Services.fog.testResetFOG();
  try {
    fakeShellService.canSetAsDefaultHandler = false;
    setAsDefaultHandlerForStub.resolves(true);
    isDefaultHandlerForStub.returns(true);

    const result = await ShellService.setAsDefaultPDFHandler();
    Assert.strictEqual(result, false, "Resolves false when unsupported");
    Assert.ok(
      setAsDefaultHandlerForStub.notCalled,
      "Did not call the native setter when unsupported"
    );
    Assert.ok(
      !Glean.browser.setDefaultPdfHandlerAttempt.testGetValue(),
      "Did not record an attempt event when unsupported"
    );
  } finally {
    fakeShellService.canSetAsDefaultHandler = true;
    resetStubs();
  }
});

add_task(async function test_setAsDefaultPDFHandler_confirmed() {
  Services.fog.testResetFOG();
  setAsDefaultHandlerForStub.resolves(true);
  isDefaultHandlerForStub.returns(true);

  const result = await ShellService.setAsDefaultPDFHandler();
  Assert.strictEqual(result, true, "Resolves true when the user confirms");
  Assert.ok(
    setAsDefaultHandlerForStub.calledOnce,
    "Called the native setAsDefaultHandlerFor once"
  );
  Assert.ok(
    setAsDefaultHandlerForStub.calledWith(".pdf"),
    "Forwarded '.pdf' to the native setAsDefaultHandlerFor"
  );

  const event = getAttemptEvent();
  Assert.equal(
    event.extra.method,
    "launch_services",
    "Event method is launch_services"
  );
  Assert.equal(event.extra.success, "true", "Event success is true");
  Assert.equal(
    event.extra.result_is_default,
    "true",
    "Event result_is_default reflects isDefaultHandlerFor"
  );
  resetStubs();
});

add_task(async function test_setAsDefaultPDFHandler_recordsIndependentState() {
  Services.fog.testResetFOG();
  // success (the native setter's result) and result_is_default (a separate
  // isDefaultHandlerFor sample) come from different sources, so drive them to
  // different values: a bug that conflated the two would pass every test where
  // they happen to agree.
  setAsDefaultHandlerForStub.resolves(true);
  isDefaultHandlerForStub.returns(false);

  const result = await ShellService.setAsDefaultPDFHandler();
  Assert.strictEqual(result, true, "Resolves with the native setter's result");

  const event = getAttemptEvent();
  Assert.equal(
    event.extra.success,
    "true",
    "success reflects the native setter"
  );
  Assert.equal(
    event.extra.result_is_default,
    "false",
    "result_is_default reflects isDefaultHandlerFor, not success"
  );
  resetStubs();
});

add_task(async function test_setAsDefaultPDFHandler_declined() {
  Services.fog.testResetFOG();
  setAsDefaultHandlerForStub.resolves(false);
  isDefaultHandlerForStub.returns(false);

  const result = await ShellService.setAsDefaultPDFHandler();
  Assert.strictEqual(result, false, "Resolves false when the user declines");

  const event = getAttemptEvent();
  Assert.equal(event.extra.success, "false", "Event success is false");
  Assert.equal(
    event.extra.result_is_default,
    "false",
    "Event result_is_default is false"
  );
  resetStubs();
});

add_task(async function test_setAsDefaultPDFHandler_error() {
  Services.fog.testResetFOG();
  setAsDefaultHandlerForStub.rejects(new Error("mock NSWorkspace failure"));
  isDefaultHandlerForStub.returns(false);

  const result = await ShellService.setAsDefaultPDFHandler();
  Assert.strictEqual(
    result,
    false,
    "Resolves false when the native call rejects"
  );

  const event = getAttemptEvent();
  Assert.equal(event.extra.success, "false", "Event success is false on error");
  resetStubs();
  setAsDefaultHandlerForStub.resolves(false);
});

add_task(async function test_setAsDefaultPDFHandler_onlyIfKnownBrowser() {
  setAsDefaultHandlerForStub.resolves(true);
  isDefaultHandlerForStub.returns(true);

  isDefaultHandlerAWebBrowserForStub.returns(true);
  let result = await ShellService.setAsDefaultPDFHandler(true);
  Assert.strictEqual(
    result,
    true,
    "Resolves true when the handler is a browser"
  );
  Assert.ok(
    setAsDefaultHandlerForStub.called,
    "Set the default when the current handler is a browser"
  );
  Assert.ok(
    isDefaultHandlerAWebBrowserForStub.calledWith(".pdf"),
    "Forwarded '.pdf' to the native isDefaultHandlerAWebBrowserFor"
  );
  resetStubs();

  isDefaultHandlerAWebBrowserForStub.returns(false);
  result = await ShellService.setAsDefaultPDFHandler(true);
  Assert.strictEqual(
    result,
    false,
    "Resolves false when the handler is not a browser"
  );
  Assert.ok(
    setAsDefaultHandlerForStub.notCalled,
    "Did not set the default when the current handler is not a browser"
  );
  resetStubs();

  isDefaultHandlerAWebBrowserForStub.returns(false);
  result = await ShellService.setAsDefaultPDFHandler(false);
  Assert.strictEqual(
    result,
    true,
    "Resolves true and sets unconditionally when onlyIfKnownBrowser is false"
  );
  Assert.ok(
    setAsDefaultHandlerForStub.called,
    "Set the default unconditionally when onlyIfKnownBrowser is false"
  );
  Assert.ok(
    isDefaultHandlerAWebBrowserForStub.notCalled,
    "Did not consult the browser check when onlyIfKnownBrowser is false"
  );
  resetStubs();
});
