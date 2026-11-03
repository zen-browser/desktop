const { PermissionTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PermissionTestUtils.sys.mjs"
);

const TEST_ORIGIN = "https://example.com";
const TEST_ORIGIN_CERT_ERROR = "https://expired.example.com";
const LOW_TLS_VERSION = "https://tls1.example.com/";

async function testPermissions(defaultPermission) {
  await BrowserTestUtils.withNewTab(TEST_ORIGIN, async function () {
    let pageInfo = BrowserCommands.pageInfo(TEST_ORIGIN, "permTab");
    await BrowserTestUtils.waitForEvent(pageInfo, "load");

    let defaultCheckbox = await TestUtils.waitForCondition(() =>
      pageInfo.document.getElementById("geoDef")
    );
    let radioGroup = pageInfo.document.getElementById("geoRadioGroup");
    let defaultRadioButton = pageInfo.document.getElementById(
      "geo#" + defaultPermission
    );
    let blockRadioButton = pageInfo.document.getElementById("geo#2");

    ok(defaultCheckbox.checked, "The default checkbox should be checked.");

    PermissionTestUtils.add(
      gBrowser.currentURI,
      "geo",
      Services.perms.DENY_ACTION
    );

    ok(!defaultCheckbox.checked, "The default checkbox should not be checked.");

    defaultCheckbox.checked = true;
    defaultCheckbox.doCommand();

    ok(
      !PermissionTestUtils.getPermissionObject(gBrowser.currentURI, "geo"),
      "Checking the default checkbox should reset the permission."
    );

    defaultCheckbox.checked = false;
    defaultCheckbox.doCommand();

    ok(
      !PermissionTestUtils.getPermissionObject(gBrowser.currentURI, "geo"),
      "Unchecking the default checkbox should pick the default permission."
    );
    is(
      radioGroup.selectedItem,
      defaultRadioButton,
      "The unknown radio button should be selected."
    );

    radioGroup.selectedItem = blockRadioButton;
    blockRadioButton.doCommand();

    is(
      PermissionTestUtils.getPermissionObject(gBrowser.currentURI, "geo")
        .capability,
      Services.perms.DENY_ACTION,
      "Selecting a value in the radio group should set the corresponding permission"
    );

    radioGroup.selectedItem = defaultRadioButton;
    defaultRadioButton.doCommand();

    ok(
      !PermissionTestUtils.getPermissionObject(gBrowser.currentURI, "geo"),
      "Selecting the default value should reset the permission."
    );
    ok(defaultCheckbox.checked, "The default checkbox should be checked.");

    pageInfo.close();
    PermissionTestUtils.remove(gBrowser.currentURI, "geo");
  });
}

// Test displaying website permissions on certificate error pages.
add_task(async function test_CertificateError() {
  let browser;
  let pageLoaded;
  await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    () => {
      gBrowser.selectedTab = BrowserTestUtils.addTab(
        gBrowser,
        TEST_ORIGIN_CERT_ERROR
      );
      browser = gBrowser.selectedBrowser;
      pageLoaded = BrowserTestUtils.waitForErrorPage(browser);
    },
    false
  );

  await pageLoaded;

  let pageInfo = BrowserCommands.pageInfo(TEST_ORIGIN_CERT_ERROR, "permTab");
  await BrowserTestUtils.waitForEvent(pageInfo, "load");
  let permissionTab = pageInfo.document.getElementById("permTab");
  await TestUtils.waitForCondition(
    () => BrowserTestUtils.isVisible(permissionTab),
    "Permission tab should be visible."
  );

  let hostText = pageInfo.document.getElementById("hostText");
  let permList = pageInfo.document.getElementById("permList");
  let excludedPermissions = pageInfo.window.getExcludedPermissions();
  let permissions = SitePermissions.listPermissions().filter(
    p =>
      SitePermissions.getPermissionLabel(p) != null &&
      !excludedPermissions.includes(p)
  );

  await TestUtils.waitForCondition(
    () => hostText.value === browser.currentURI.displayPrePath,
    `Value of owner should be "${browser.currentURI.displayPrePath}" instead got "${hostText.value}".`
  );

  await TestUtils.waitForCondition(
    () => permList.childElementCount === permissions.length,
    `Value of verifier should be ${permissions.length}, instead got ${permList.childElementCount}.`
  );

  pageInfo.close();
  BrowserTestUtils.removeTab(gBrowser.selectedTab);
});

// Test displaying website permissions on network error pages.
add_task(async function test_NetworkError() {
  // Setup for TLS error
  Services.prefs.setIntPref("security.tls.version.max", 3);
  Services.prefs.setIntPref("security.tls.version.min", 3);

  let browser;
  let pageLoaded;
  await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    () => {
      gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser, LOW_TLS_VERSION);
      browser = gBrowser.selectedBrowser;
      pageLoaded = BrowserTestUtils.waitForErrorPage(browser);
    },
    false
  );

  await pageLoaded;

  let pageInfo = BrowserCommands.pageInfo(LOW_TLS_VERSION, "permTab");
  await BrowserTestUtils.waitForEvent(pageInfo, "load");
  let permissionTab = pageInfo.document.getElementById("permTab");
  await TestUtils.waitForCondition(
    () => BrowserTestUtils.isVisible(permissionTab),
    "Permission tab should be visible."
  );

  let hostText = pageInfo.document.getElementById("hostText");
  let permList = pageInfo.document.getElementById("permList");
  let excludedPermissions = pageInfo.window.getExcludedPermissions();
  let permissions = SitePermissions.listPermissions().filter(
    p =>
      SitePermissions.getPermissionLabel(p) != null &&
      !excludedPermissions.includes(p)
  );

  await TestUtils.waitForCondition(
    () => hostText.value === browser.currentURI.displayPrePath,
    `Value of host should be should be "${browser.currentURI.displayPrePath}" instead got "${hostText.value}".`
  );

  await TestUtils.waitForCondition(
    () => permList.childElementCount === permissions.length,
    `Value of permissions list should be ${permissions.length}, instead got ${permList.childElementCount}.`
  );

  pageInfo.close();
  BrowserTestUtils.removeTab(gBrowser.selectedTab);
});

// Test some standard operations in the permission tab.
add_task(async function test_geo_permission() {
  await testPermissions(Services.perms.UNKNOWN_ACTION);
});

// Test some standard operations in the permission tab, falling back to a custom
// default permission instead of UNKNOWN.
add_task(async function test_default_geo_permission() {
  await SpecialPowers.pushPrefEnv({
    set: [["permissions.default.geo", SitePermissions.ALLOW]],
  });
  await testPermissions(Services.perms.ALLOW_ACTION);
});

// The clear-on-shutdown exception row is hidden unless data is cleared on
// shutdown.
add_task(async function test_persist_data_on_shutdown_hidden() {
  await SpecialPowers.pushPrefEnv({
    set: [["privacy.sanitize.sanitizeOnShutdown", false]],
  });
  await BrowserTestUtils.withNewTab(TEST_ORIGIN, async function () {
    let pageInfo = BrowserCommands.pageInfo(TEST_ORIGIN, "permTab");
    await BrowserTestUtils.waitForEvent(pageInfo, "load");

    let permList = pageInfo.document.getElementById("permList");
    await BrowserTestUtils.waitForMutationCondition(
      permList,
      { childList: true },
      () => permList.childElementCount
    );
    is(
      pageInfo.document.getElementById("persist-data-on-shutdownDef"),
      null,
      "The clear-on-shutdown exception row should not be present."
    );

    pageInfo.close();
  });
});

// Test the clear-on-shutdown exception permission, which exposes a "Clear when
// closing" (default) and an "Always keep site data" radio alongside the "Use
// Default" checkbox.
add_task(async function test_persist_data_on_shutdown_permission() {
  await SpecialPowers.pushPrefEnv({
    set: [["privacy.sanitize.sanitizeOnShutdown", true]],
  });
  await BrowserTestUtils.withNewTab(TEST_ORIGIN, async function () {
    let pageInfo = BrowserCommands.pageInfo(TEST_ORIGIN, "permTab");
    await BrowserTestUtils.waitForEvent(pageInfo, "load");

    let permList = pageInfo.document.getElementById("permList");
    await BrowserTestUtils.waitForMutationCondition(
      permList,
      { childList: true },
      () => pageInfo.document.getElementById("persist-data-on-shutdownDef")
    );
    let defaultCheckbox = pageInfo.document.getElementById(
      "persist-data-on-shutdownDef"
    );
    let radioGroup = pageInfo.document.getElementById(
      "persist-data-on-shutdownRadioGroup"
    );
    let clearRadioButton = pageInfo.document.getElementById(
      "persist-data-on-shutdown#0"
    );
    let allowRadioButton = pageInfo.document.getElementById(
      "persist-data-on-shutdown#1"
    );
    let command = pageInfo.document.getElementById(
      "cmd_persist-data-on-shutdownToggle"
    );

    let row = pageInfo.document.getElementById(
      "perm-persist-data-on-shutdown-row"
    );
    // The Permissions tab needs to be displayed before its rows lay out as
    // visible.
    await TestUtils.waitForCondition(
      () => BrowserTestUtils.isVisible(row),
      "The permission row should be visible."
    );
    ok(
      BrowserTestUtils.isVisible(defaultCheckbox),
      "The default checkbox should be visible."
    );
    ok(
      BrowserTestUtils.isVisible(radioGroup),
      "The radio group should be visible."
    );

    ok(defaultCheckbox.checked, "The default checkbox should be checked.");
    is(
      radioGroup.selectedItem,
      clearRadioButton,
      "The clear (default) radio button should be selected."
    );
    ok(
      command.hasAttribute("disabled"),
      "The radio controls should be disabled in the default state."
    );

    // An exception added externally should be reflected via the observer.
    PermissionTestUtils.add(
      gBrowser.currentURI,
      "persist-data-on-shutdown",
      Services.perms.ALLOW_ACTION
    );

    ok(!defaultCheckbox.checked, "The default checkbox should not be checked.");
    is(
      radioGroup.selectedItem,
      allowRadioButton,
      "The allow radio button should be selected."
    );
    ok(
      !command.hasAttribute("disabled"),
      "The radio controls should be enabled once an exception is set."
    );

    // Checking the default checkbox removes the exception.
    defaultCheckbox.checked = true;
    defaultCheckbox.doCommand();

    ok(
      !PermissionTestUtils.getPermissionObject(
        gBrowser.currentURI,
        "persist-data-on-shutdown"
      ),
      "Checking the default checkbox should reset the permission."
    );

    // Selecting the allow radio sets the ALLOW exception.
    radioGroup.selectedItem = allowRadioButton;
    allowRadioButton.doCommand();

    is(
      PermissionTestUtils.testPermission(
        gBrowser.currentURI,
        "persist-data-on-shutdown"
      ),
      SitePermissions.ALLOW,
      "Selecting the allow radio should set the exception to ALLOW."
    );
    ok(!defaultCheckbox.checked, "The default checkbox should not be checked.");

    // Selecting the clear radio reverts to the default (no exception stored).
    radioGroup.selectedItem = clearRadioButton;
    clearRadioButton.doCommand();

    ok(
      !PermissionTestUtils.getPermissionObject(
        gBrowser.currentURI,
        "persist-data-on-shutdown"
      ),
      "Selecting the clear radio should reset the permission."
    );
    ok(defaultCheckbox.checked, "The default checkbox should be checked.");
    ok(
      command.hasAttribute("disabled"),
      "The radio controls should be disabled once back to the default state."
    );

    pageInfo.close();
    PermissionTestUtils.remove(gBrowser.currentURI, "persist-data-on-shutdown");
  });
});

// Test special behavior for cookie permissions.
add_task(async function test_cookie_permission() {
  await BrowserTestUtils.withNewTab(TEST_ORIGIN, async function () {
    let pageInfo = BrowserCommands.pageInfo(TEST_ORIGIN, "permTab");
    await BrowserTestUtils.waitForEvent(pageInfo, "load");

    let defaultCheckbox = await TestUtils.waitForCondition(() =>
      pageInfo.document.getElementById("cookieDef")
    );
    let radioGroup = pageInfo.document.getElementById("cookieRadioGroup");
    let allowRadioButton = pageInfo.document.getElementById("cookie#1");
    let blockRadioButton = pageInfo.document.getElementById("cookie#2");

    ok(defaultCheckbox.checked, "The default checkbox should be checked.");
    ok(!defaultCheckbox.disabled, "The default checkbox should be enabled.");

    defaultCheckbox.checked = false;
    defaultCheckbox.dispatchEvent(new Event("command"));

    ok(
      !blockRadioButton.disabled,
      "The cookie radios should be enabled once the default is unchecked."
    );
    is(
      PermissionTestUtils.testPermission(gBrowser.currentURI, "cookie"),
      SitePermissions.ALLOW,
      "Unchecking the default checkbox should pick the default permission."
    );
    is(
      radioGroup.selectedItem,
      allowRadioButton,
      "The unknown radio button should be selected."
    );

    radioGroup.selectedItem = blockRadioButton;
    blockRadioButton.doCommand();

    is(
      PermissionTestUtils.testPermission(gBrowser.currentURI, "cookie"),
      SitePermissions.BLOCK,
      "Selecting a value in the radio group should set the corresponding permission"
    );

    radioGroup.selectedItem = allowRadioButton;
    allowRadioButton.doCommand();

    is(
      PermissionTestUtils.testPermission(gBrowser.currentURI, "cookie"),
      SitePermissions.ALLOW,
      "Selecting a value in the radio group should set the corresponding permission"
    );
    ok(!defaultCheckbox.checked, "The default checkbox should not be checked.");

    defaultCheckbox.checked = true;
    defaultCheckbox.doCommand();

    is(
      PermissionTestUtils.testPermission(gBrowser.currentURI, "cookie"),
      SitePermissions.UNKNOWN,
      "Checking the default checkbox should reset the permission."
    );
    is(
      radioGroup.selectedItem,
      null,
      "For cookies, no item should be selected when the checkbox is checked."
    );

    pageInfo.close();
    PermissionTestUtils.remove(gBrowser.currentURI, "cookie");
  });
});
