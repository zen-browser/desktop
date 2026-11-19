/* import-globals-from ../../../common/tests/unit/head_helpers.js */

var { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

try {
  // In the context of xpcshell tests, there won't be a default AppInfo
  // eslint-disable-next-line mozilla/use-services
  Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
} catch (ex) {
  // Make sure to provide the right OS so crypto loads the right binaries
  var OS = "XPCShell";
  if (mozinfo.os == "win") {
    OS = "WINNT";
  } else if (mozinfo.os == "mac") {
    OS = "Darwin";
  } else {
    OS = "Linux";
  }

  const { updateAppInfo } = ChromeUtils.importESModule(
    "resource://testing-common/AppInfo.sys.mjs"
  );
  updateAppInfo({
    name: "XPCShell",
    ID: "{3e3ba16c-1675-4e88-b9c8-afef81b3d2ef}",
    version: "1",
    platformVersion: "",
    OS,
  });
}

function base64UrlDecode(s) {
  s = s.replace(/-/g, "+");
  s = s.replace(/_/g, "/");

  // Replace padding if it was stripped by the sender.
  // See http://tools.ietf.org/html/rfc4648#section-4
  switch (s.length % 4) {
    case 0:
      break; // No pad chars in this case
    case 2:
      s += "==";
      break; // Two pad chars
    case 3:
      s += "=";
      break; // One pad char
    default:
      throw new Error("Illegal base64url string!");
  }

  // With correct padding restored, apply the standard base64 decoder
  return atob(s);
}

/**
 * Print some debug message to the console. All arguments will be printed,
 * separated by spaces.
 *
 * @param [arg0, arg1, arg2, ...]
 *        Any number of arguments to print out
 * Usage: _("Hello World") -> prints "Hello World"
 * Usage: _(1, 2, 3) -> prints "1 2 3"
 */
var _ = function () {
  print(Array.from(arguments).join(" "));
};
