/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

ChromeUtils.defineESModuleGetters(this, {
  ShellService: "moz-src:///browser/components/shell/ShellService.sys.mjs",
  Subprocess: "resource://gre/modules/Subprocess.sys.mjs",
  TestUtils: "resource://testing-common/TestUtils.sys.mjs",
  XPCOMUtils: "resource://gre/modules/XPCOMUtils.sys.mjs",
});

// This tests the browser's interaction with the Dynamic Launcher portal, which
// is documented at
//
//   https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.DynamicLauncher

XPCOMUtils.defineLazyServiceGetter(
  this,
  "IniParserFactory",
  "@mozilla.org/xpcom/ini-parser-factory;1",
  Ci.nsIINIParserFactory
);

function desktopEntryFromObject(object) {
  let ini = IniParserFactory.createINIParser().QueryInterface(
    Ci.nsIINIParserWriter
  );

  for (const property of Object.getOwnPropertyNames(object)) {
    ini.setString("Desktop Entry", property, "" + object[property]);
  }

  return ini;
}

function objectFromDesktopEntry(aINI) {
  let ini = IniParserFactory.createINIParser();
  ini.initFromString(aINI);

  let sections = ini.getSections();
  ok(sections.hasMore(), "There is at least one section");
  Assert.equal(sections.getNext(), "Desktop Entry", "First key is correct");
  Assert.equal(sections.hasMore(), false, "...and there aren't others");

  let keys = ini.getKeys("Desktop Entry");
  let result = Object.create(null);
  while (keys.hasMore()) {
    let key = keys.getNext();
    result[key] = ini.getString("Desktop Entry", key);
  }

  return result;
}

const portalBusName = "org.freedesktop.portal.Desktop";
const portalObjectPath = "/org/freedesktop/portal/desktop";
const portalInterfaceName = "org.freedesktop.portal.DynamicLauncher";
const dbusMockInterface = "org.freedesktop.DBus.Mock";
const addObjectMethod = `${dbusMockInterface}.AddObject`;
const addMethodMethod = `${dbusMockInterface}.AddMethod`;
const emitSignalDetailedMethod = `${dbusMockInterface}.EmitSignalDetailed`;
const getCallsMethod = `${dbusMockInterface}.GetCalls`;
const clearCallsMethod = `${dbusMockInterface}.ClearCalls`;
const resetMethod = `${dbusMockInterface}.Reset`;
const mockRequestObjectPath = "/org/freedesktop/portal/desktop/request";

var DBUS_SESSION_BUS_ADDRESS = "";
var DBUS_SESSION_BUS_PID = 0; // eslint-disable-line no-unused-vars
var DBUS_MOCK = null;
var gdbusCmd = null;

async function callDbusMethod(objectPath, methodName, args) {
  let mockProcess = await Subprocess.call({
    command: gdbusCmd,
    arguments: [
      "call",
      "--session",
      "-d",
      portalBusName,
      "-o",
      objectPath,
      "-m",
      methodName,
      ...args,
    ],
  });
  return mockProcess.wait();
}

// Launches a D-Bus daemon that the tests will run under, and sets it (via
// environment variables) to be used as the D-Bus connection. Additionally, sets
// up dbusmock to allow the test to create fake D-Bus objects; this avoids
// needing to display UI to the user, or depending on the details of the
// specific portal they have installed.
add_setup(async function setup() {
  // Start and use a separate message bus for the tests, to not interfere with
  // the current's session message bus.
  let dbus = await Subprocess.call({
    command: await Subprocess.pathSearch("dbus-launch"),
  });
  await dbus.wait();
  let stdout = await dbus.stdout.readString();
  let lines = stdout.split("\n");
  for (let i in lines) {
    let tokens = lines[i].split("=");
    switch (tokens.shift()) {
      case "DBUS_SESSION_BUS_ADDRESS":
        DBUS_SESSION_BUS_ADDRESS = tokens.join("=");
        break;
      case "DBUS_SESSION_BUS_PID":
        DBUS_SESSION_BUS_PID = tokens.join();
        break;
      default:
    }
  }

  gdbusCmd = await Subprocess.pathSearch("gdbus");

  Services.env.set("DBUS_SESSION_BUS_ADDRESS", DBUS_SESSION_BUS_ADDRESS);
  Services.env.set("GTK_USE_PORTAL", "1");

  // dbusmock is used to mock the native messaging portal's D-Bus API.
  DBUS_MOCK = await Subprocess.call({
    command: await Subprocess.pathSearch("python3"),
    arguments: [
      "-m",
      "dbusmock",
      portalBusName,
      portalObjectPath,
      portalInterfaceName,
      // vvvvvvvvvvvvv why is this needed?!
      "-l",
      "/dev/null",
    ],
  });

  // Wait until dbusmock is ready
  await TestUtils.waitForCondition(async () => {
    let res = await callDbusMethod(
      portalObjectPath,
      "org.freedesktop.DBus.Mock.GetCalls",
      []
    );
    return res.exitCode == 0;
  }, "waiting for dbusmock");

  registerCleanupFunction(async function () {
    await DBUS_MOCK.kill();
    // XXX: While this works locally, it consistently fails when tests are run
    // in CI, with "xpcshell return code: -15". This needs to be investigated
    // further. This leaves a stray dbus-daemon process behind,
    // which isn't ideal, but is harmless.
    /*await lazy.Subprocess.call({
      command: await lazy.Subprocess.pathSearch("kill"),
      arguments: ["-SIGQUIT", DBUS_SESSION_BUS_PID],
    });*/
  });
});

/**
 * Determines who called the corresponding D-Bus method. dbusmock doesn't
 * provide this information, but we need it to create a portal Request path, so
 * this uses a one-off dbus-monitor instead.
 *
 * This function has two phases, determined by the promises in its return value:
 *
 *   - monitorReady will resolve when dbus-monitor appears to be awake. At this
 *     point, the method call should happen.
 *
 *   - senderPromise will resolve when the call is detected. This will resolve
 *     to the sender of the method call.
 *
 * @param {string} method
 *   The method call to look for. (Currently you can't key based on the object
 *   path.)
 * @returns {{monitorReady:Promise<undefined>,senderPromise:Promise<string>}}
 *   A set of promises corresponding to the current 'phase' of the check.
 */
function sniffDbusMethodCaller(method) {
  let readyResolvers = Promise.withResolvers();
  let doneResolvers = Promise.withResolvers();

  // Use .then here so this can be a synchronous function, so you don't
  // additionally have to worry about the promise returned.
  Subprocess.pathSearch("dbus-monitor")
    .then(command =>
      Subprocess.call({
        command,
        arguments: ["--session"],
      })
    )
    .then(async process => {
      while (true) {
        for (const line of (await process.stdout.readString()).split("\n")) {
          readyResolvers.resolve();

          // Extract the sender name from the dbus-monitor process's output.
          if (
            line.startsWith("method call") &&
            line.includes(`member=${method}`)
          ) {
            let match = line.match(/sender=(\S*)/);
            ok(match, "dbus-monitor output informs us of the sender");
            doneResolvers.resolve(match[1]);
            await process.kill();
            return;
          }
        }
      }
    })
    .finally(err => {
      readyResolvers.reject(err);
      doneResolvers.reject(err);
    });

  return {
    monitorReady: readyResolvers.promise,
    senderPromise: doneResolvers.promise,
  };
}

/**
 * Waits for a D-Bus method call with the given object path, method, and
 * position in time (in case multiple calls happened).
 *
 * @param {string} objectPath
 *   The object path the call should be for. This must be a dbusmock-based mock
 *   object.
 * @param {string} method
 *   The method to get information for.
 * @param {number} offset
 *   Indicates that information should be returned for the nth (zero-based)
 *   call.
 * @returns {{offset:number,params:string}}
 *   The offset after this call as a number (zero if it wasn't called), and the
 *   string representation of the arguments; e.g. "'abc', 'def'".
 */
async function expectDbusMockCall(objectPath, method, offset) {
  let getCalls = await Subprocess.call({
    command: gdbusCmd,
    arguments: [
      "call",
      "--session",
      "-d",
      portalBusName,
      "-o",
      objectPath,
      "-m",
      getCallsMethod,
    ],
  });
  let out = "";
  while (!out.endsWith("\n")) {
    out += await getCalls.stdout.readString();
  }
  // The other regexes are fragile, so remove the byte arrays that break them.
  out = out.replaceAll(/<\('bytes', <\[byte 0x[0-9a-fx, ]+\]>\)>/g, "<bytes>");
  out = out.match(/\((@a\(tsav\) )?\[(.*)\],\)/)[2];
  let calls = out.matchAll(/\(.*?\),?/g);
  let methodCalled = false;
  let params = {};
  let i = 0;
  for (let call of calls) {
    if (i++ < offset) {
      continue;
    }
    let matches = call[0].match(
      /\((uint64 )?(?<timestamp>\d+), '(?<method>\w+)', (@av )?\[(?<params>.*)\]\),?/
    );
    ok(parseFloat(matches.groups.timestamp), "timestamp is valid");
    if (matches.groups.method == method) {
      methodCalled = true;
      params = matches.groups.params;
      break;
    }
  }
  if (method) {
    ok(methodCalled, `The ${method} mock was called`);
  } else {
    equal(i, 0, "No method mock was called");
  }

  await getCalls.wait();
  return { offset: i, params };
}

add_task(async function test_successful_creation() {
  await callDbusMethod(portalObjectPath, resetMethod, []);
  await callDbusMethod(portalObjectPath, clearCallsMethod, []);

  await callDbusMethod(portalObjectPath, addMethodMethod, [
    portalInterfaceName,
    "PrepareInstall",
    "ssva{sv}",
    "o",
    `ret = "/should/not/be/used"`,
  ]);

  let object = {
    Version: "1.5",
    Type: "Application",
    Name: "Example Launcher Name",
    Icon:
      Services.dirsvc.get("CurWorkD", Ci.nsIFile).path +
      "/favicon-normal16.png",
    Exec: "browser command",
  };
  let ini = desktopEntryFromObject(object);

  let { monitorReady, senderPromise } = sniffDbusMethodCaller("PrepareInstall");
  await monitorReady;

  let promise = ShellService.requestInstallDynamicLauncher("a.b.c", ini, null);

  let senderName = await senderPromise;
  let result = await expectDbusMockCall(portalObjectPath, "PrepareInstall", 0);
  let [parentWindow, name, icon] = result.params.split(", ");
  Assert.equal(parentWindow, "<''>", "No parent window was provided");
  Assert.equal(name, "<'Example Launcher Name'>", "Launcher name was provided");
  Assert.equal(icon, "<bytes>", "Icon was some sequence of bytes");

  let match = result.params.match(/'handle_token': <'(?<token>.*)'>/);
  ok(match, "Start arguments contain a handle token");
  let handleToken = match.groups.token;

  await callDbusMethod(portalObjectPath, addMethodMethod, [
    portalInterfaceName,
    "Install",
    "sssa{sv}",
    "",
    "",
  ]);

  // Mock the Request object that is expected to be created in response to
  // calling the Start method on the native messaging portal, wait for it to be
  // available, and emit its Response signal.
  let requestPath = `${mockRequestObjectPath}/${senderName
    .slice(1)
    .replace(".", "_")}/${handleToken}`;
  await callDbusMethod(portalObjectPath, addObjectMethod, [
    requestPath,
    "org.freedesktop.portal.Request",
    "@a{sv} {}",
    "@a(ssss) []",
  ]);
  await callDbusMethod(requestPath, emitSignalDetailedMethod, [
    "org.freedesktop.portal.Request",
    "Response",
    "ua{sv}",
    `[<uint32 0>, <@a{sv} {'token': <'qwerty'>}>]`,
    `{'destination': <'${senderName}'>}`,
  ]);

  // Verify that the Install method was called as expected after the Start
  // request completed.
  result = await expectDbusMockCall(portalObjectPath, "Install", result.offset);
  let [token, desktopFileId, desktopEntry] = result.params.split(", ");
  Assert.equal(token, "<'qwerty'>", "Correct token is provided");
  Assert.equal(
    desktopFileId,
    "<'a.b.c.desktop'>",
    "Correct desktop file ID is provided"
  );

  desktopEntry = desktopEntry
    .replace(/^<'/, "")
    .replace(/'>$/, "")
    .replaceAll(/\\n/g, "\n");
  let entry = objectFromDesktopEntry(desktopEntry);
  Assert.deepEqual(entry, object, "Desktop entry contains expected values");

  // Check for exceptions etc.
  await promise;
});

add_task(async function test_prepareinstall_error() {
  await callDbusMethod(portalObjectPath, resetMethod, []);
  await callDbusMethod(portalObjectPath, clearCallsMethod, []);

  await callDbusMethod(portalObjectPath, addMethodMethod, [
    portalInterfaceName,
    "PrepareInstall",
    "ssva{sv}",
    "o",
    `raise dbus.exceptions.DBusException("prepareinstall failed", name="org.mozilla.Error.Mocked")`,
  ]);

  let object = {
    Version: "1.5",
    Type: "Application",
    Name: "Example Launcher Name",
    Icon:
      Services.dirsvc.get("CurWorkD", Ci.nsIFile).path +
      "/favicon-normal16.png",
    Exec: "browser command",
  };
  let ini = desktopEntryFromObject(object);

  await Assert.rejects(
    (async () =>
      ShellService.requestInstallDynamicLauncher("a.b.c", ini, null))(),
    /.*prepareinstall failed.*/,
    "Failure was propagated from D-Bus"
  );
});

add_task(async function test_install_error() {
  await callDbusMethod(portalObjectPath, resetMethod, []);
  await callDbusMethod(portalObjectPath, clearCallsMethod, []);

  await callDbusMethod(portalObjectPath, addMethodMethod, [
    portalInterfaceName,
    "PrepareInstall",
    "ssva{sv}",
    "o",
    `ret = "/should/not/be/used"`,
  ]);

  let object = {
    Version: "1.5",
    Type: "Application",
    Name: "Example Launcher Name",
    Icon:
      Services.dirsvc.get("CurWorkD", Ci.nsIFile).path +
      "/favicon-normal16.png",
    Exec: "browser command",
  };
  let ini = desktopEntryFromObject(object);

  let { monitorReady, senderPromise } = sniffDbusMethodCaller("PrepareInstall");
  await monitorReady;

  let promise = ShellService.requestInstallDynamicLauncher("a.b.c", ini, null);

  let senderName = await senderPromise;
  let result = await expectDbusMockCall(portalObjectPath, "PrepareInstall", 0);

  let match = result.params.match(/'handle_token': <'(?<token>.*)'>/);
  ok(match, "Start arguments contain a handle token");
  let handleToken = match.groups.token;

  await callDbusMethod(portalObjectPath, addMethodMethod, [
    portalInterfaceName,
    "Install",
    "sssa{sv}",
    "",
    `raise dbus.exceptions.DBusException("plain install failed", name="org.mozilla.Error.Mocked")`,
  ]);

  // Mock the Request object that is expected to be created in response to
  // calling the Start method on the native messaging portal, wait for it to be
  // available, and emit its Response signal.
  let requestPath = `${mockRequestObjectPath}/${senderName
    .slice(1)
    .replace(".", "_")}/${handleToken}`;
  await callDbusMethod(portalObjectPath, addObjectMethod, [
    requestPath,
    "org.freedesktop.portal.Request",
    "@a{sv} {}",
    "@a(ssss) []",
  ]);
  await callDbusMethod(requestPath, emitSignalDetailedMethod, [
    "org.freedesktop.portal.Request",
    "Response",
    "ua{sv}",
    `[<uint32 0>, <@a{sv} {'token': <'qwerty'>}>]`,
    `{'destination': <'${senderName}'>}`,
  ]);

  result = await expectDbusMockCall(portalObjectPath, "Install", result.offset);
  await Assert.rejects(
    promise,
    /.*plain install failed.*/,
    "Promise rejected with expected content."
  );
});

add_task(async function test_negativeResponseFromPrepareInstall() {
  await callDbusMethod(portalObjectPath, resetMethod, []);
  await callDbusMethod(portalObjectPath, clearCallsMethod, []);

  await callDbusMethod(portalObjectPath, addMethodMethod, [
    portalInterfaceName,
    "PrepareInstall",
    "ssva{sv}",
    "o",
    `ret = "/should/not/be/used"`,
  ]);

  let object = {
    Version: "1.5",
    Type: "Application",
    Name: "Example Launcher Name",
    Icon:
      Services.dirsvc.get("CurWorkD", Ci.nsIFile).path +
      "/favicon-normal16.png",
    Exec: "browser command",
  };
  let ini = desktopEntryFromObject(object);

  let { monitorReady, senderPromise } = sniffDbusMethodCaller("PrepareInstall");
  await monitorReady;

  let promise = ShellService.requestInstallDynamicLauncher("a.b.c", ini, null);

  let senderName = await senderPromise;
  let result = await expectDbusMockCall(portalObjectPath, "PrepareInstall", 0);

  let match = result.params.match(/'handle_token': <'(?<token>.*)'>/);
  ok(match, "Start arguments contain a handle token");
  let handleToken = match.groups.token;

  let requestPath = `${mockRequestObjectPath}/${senderName
    .slice(1)
    .replace(".", "_")}/${handleToken}`;
  await callDbusMethod(portalObjectPath, addObjectMethod, [
    requestPath,
    "org.freedesktop.portal.Request",
    "@a{sv} {}",
    "@a(ssss) []",
  ]);
  await callDbusMethod(requestPath, emitSignalDetailedMethod, [
    "org.freedesktop.portal.Request",
    "Response",
    "ua{sv}",
    `[<uint32 2>, <@a{sv} {}>]`,
    `{'destination': <'${senderName}'>}`,
  ]);

  await Assert.rejects(
    promise,
    /.*Response was non-zero.*/,
    "Promise rejected with expected content."
  );
});

add_task(async function test_missingTokenFromPrepareInstall() {
  await callDbusMethod(portalObjectPath, resetMethod, []);
  await callDbusMethod(portalObjectPath, clearCallsMethod, []);

  await callDbusMethod(portalObjectPath, addMethodMethod, [
    portalInterfaceName,
    "PrepareInstall",
    "ssva{sv}",
    "o",
    `ret = "/should/not/be/used"`,
  ]);

  let object = {
    Version: "1.5",
    Type: "Application",
    Name: "Example Launcher Name",
    Icon:
      Services.dirsvc.get("CurWorkD", Ci.nsIFile).path +
      "/favicon-normal16.png",
    Exec: "browser command",
  };
  let ini = desktopEntryFromObject(object);

  let { monitorReady, senderPromise } = sniffDbusMethodCaller("PrepareInstall");
  await monitorReady;

  let promise = ShellService.requestInstallDynamicLauncher("a.b.c", ini, null);

  let senderName = await senderPromise;
  let result = await expectDbusMockCall(portalObjectPath, "PrepareInstall", 0);

  let match = result.params.match(/'handle_token': <'(?<token>.*)'>/);
  ok(match, "Start arguments contain a handle token");
  let handleToken = match.groups.token;

  let requestPath = `${mockRequestObjectPath}/${senderName
    .slice(1)
    .replace(".", "_")}/${handleToken}`;
  await callDbusMethod(portalObjectPath, addObjectMethod, [
    requestPath,
    "org.freedesktop.portal.Request",
    "@a{sv} {}",
    "@a(ssss) []",
  ]);
  await callDbusMethod(requestPath, emitSignalDetailedMethod, [
    "org.freedesktop.portal.Request",
    "Response",
    "ua{sv}",
    `[<uint32 0>, <@a{sv} {}>]`,
    `{'destination': <'${senderName}'>}`,
  ]);

  await Assert.rejects(
    promise,
    /.*No token was provided from the portal.*/,
    "Promise rejected with expected content."
  );
});

add_task(async function test_bad_icon() {
  await callDbusMethod(portalObjectPath, resetMethod, []);
  await callDbusMethod(portalObjectPath, clearCallsMethod, []);

  let object = {
    Version: "1.5",
    Type: "Application",
    Name: "Example Launcher Name",
    Icon:
      Services.dirsvc.get("CurWorkD", Ci.nsIFile).path + "/does-not-exist.png",
    Exec: "browser command",
  };
  let ini = desktopEntryFromObject(object);

  await Assert.rejects(
    (async () =>
      ShellService.requestInstallDynamicLauncher("a.b.c", ini, null))(),
    /.*Failed to open .*png.*/,
    "The resulting error should indicate that the file wasn't found."
  );
});

add_task(async function test_uninstall_success() {
  await callDbusMethod(portalObjectPath, resetMethod, []);
  await callDbusMethod(portalObjectPath, clearCallsMethod, []);

  await callDbusMethod(portalObjectPath, addMethodMethod, [
    portalInterfaceName,
    "Uninstall",
    "sa{sv}",
    "",
    ``,
  ]);

  await ShellService.requestUninstallDynamicLauncher("a.b.c");
  let result = await expectDbusMockCall(portalObjectPath, "Uninstall", 0);

  Assert.equal(
    result.params,
    "<'a.b.c.desktop'>, <@a{sv} {}>",
    "Correct desktop entry ID was provided"
  );
});

add_task(async function test_uninstall_failure() {
  await callDbusMethod(portalObjectPath, resetMethod, []);
  await callDbusMethod(portalObjectPath, clearCallsMethod, []);

  await callDbusMethod(portalObjectPath, addMethodMethod, [
    portalInterfaceName,
    "Uninstall",
    "sa{sv}",
    "",
    `raise dbus.exceptions.DBusException("uninstall dbus failed", name="org.mozilla.Error.Mocked")`,
  ]);

  await Assert.rejects(
    (async () => ShellService.requestUninstallDynamicLauncher("a.b.c"))(),
    /.*uninstall dbus failed.*/,
    "The uninstall request should fail."
  );
});
