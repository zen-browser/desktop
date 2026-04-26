/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  MockRegistrar: "resource://testing-common/MockRegistrar.sys.mjs",
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

let gMockService = {
  QueryInterface: ChromeUtils.generateQI([Ci.nsISecondaryTileService]),
  requestCreateAndPin: () =>
    ok(false, "requestCreate called when not stubbed out!"),
  requestDelete: () => ok(false, "requestDelete called when not stubbed out!"),
};

add_setup(function setup() {
  MockRegistrar.register(
    "@mozilla.org/browser/secondary-tile-service;1",
    gMockService
  );
});

function validateRequestCreateThen(sandbox, callback) {
  let args = ["tileid", "name", "iconpath", ["a", "b", "c"]];
  let fakeCalled = false;
  sandbox
    .stub(gMockService, "requestCreateAndPin")
    .callsFake(
      function fakeCreate(aTileId, aName, aIconPath, aArguments, aListener) {
        equal(aTileId, args[0], "Tile ID matches");
        equal(aName, args[1], "Tile name matches");
        equal(aIconPath, args[2], "Icon path matches");
        deepEqual(aArguments, args[3], "Arguments match");
        ok(
          aListener instanceof Ci.nsISecondaryTileListener,
          "Listener is valid"
        );

        fakeCalled = true;
        callback(aListener);
      }
    );

  return ShellService.requestCreateAndPinSecondaryTile(...args).finally(() => {
    ok(fakeCalled, "The fake was actually used");
  });
}

add_task(async function requestCreateSuccess() {
  let sandbox = sinon.createSandbox();
  equal(
    await validateRequestCreateThen(sandbox, listener =>
      listener.succeeded(true)
    ),
    true,
    "Promise resolved to 'true' without exception"
  );
  sandbox.restore();
});

add_task(async function requestCreateRejected() {
  let sandbox = sinon.createSandbox();
  equal(
    await validateRequestCreateThen(sandbox, listener =>
      listener.succeeded(false)
    ),
    false,
    "Promise resolved to 'false' without exception"
  );
  sandbox.restore();
});

add_task(async function requestCreateFailure() {
  let sandbox = sinon.createSandbox();
  await Assert.rejects(
    validateRequestCreateThen(sandbox, listener => listener.failed(1234)),
    /Secondary tile pinning failed \(HRESULT 000004d2\)/,
    "Pinning should fail with the expected result"
  );
  sandbox.restore();
});

function validateRequestDeleteThen(sandbox, callback) {
  let fakeCalled = false;
  sandbox
    .stub(gMockService, "requestDelete")
    .callsFake(function fakeDelete(aTileId, aListener) {
      equal(aTileId, "idtile", "Tile ID matches");
      ok(aListener instanceof Ci.nsISecondaryTileListener, "Listener is valid");

      fakeCalled = true;
      callback(aListener);
    });

  return ShellService.requestDeleteSecondaryTile("idtile").finally(() => {
    ok(fakeCalled, "The fake was actually used");
  });
}

add_task(async function requestDeleteSuccess() {
  let sandbox = sinon.createSandbox();
  equal(
    await validateRequestDeleteThen(sandbox, listener =>
      listener.succeeded(true)
    ),
    true,
    "Promise resolved to 'true' without exception"
  );
  sandbox.restore();
});

add_task(async function requestDeleteRejected() {
  let sandbox = sinon.createSandbox();
  equal(
    await validateRequestDeleteThen(sandbox, listener =>
      listener.succeeded(false)
    ),
    false,
    "Promise resolved to 'false' without exception"
  );
  sandbox.restore();
});

add_task(async function requestDeleteFailure() {
  let sandbox = sinon.createSandbox();
  await Assert.rejects(
    validateRequestDeleteThen(sandbox, listener => listener.failed(4321)),
    /Secondary tile unpinning failed \(HRESULT 000010e1\)/,
    "Unpinning should fail with the expected result"
  );
  sandbox.restore();
});
