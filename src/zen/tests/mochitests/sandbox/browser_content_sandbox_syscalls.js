/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */
/* import-globals-from browser_content_sandbox_utils.js */
"use strict";

Services.scriptloader.loadSubScript(
  "chrome://mochitests/content/browser/" +
    "security/sandbox/test/browser_content_sandbox_utils.js",
  this
);

const lazy = {};

/* getLibcConstants is only present on *nix */
ChromeUtils.defineLazyGetter(lazy, "LIBC", () =>
  ChromeUtils.getLibcConstants()
);

/*
 * This test is for executing system calls in content processes to validate
 * that calls that are meant to be blocked by content sandboxing are blocked.
 * We use the term system calls loosely so that any OS API call such as
 * fopen could be included.
 */

// Calls the native execv library function. Include imports so this can be
// safely serialized and run remotely by ContentTask.spawn.
function callExec(args) {
  const { ctypes } = ChromeUtils.importESModule(
    "resource://gre/modules/ctypes.sys.mjs"
  );
  let { lib, cmd } = args;
  let libc = ctypes.open(lib);
  let exec = libc.declare(
    "execv",
    ctypes.default_abi,
    ctypes.int,
    ctypes.char.ptr
  );
  let rv = exec(cmd);
  libc.close();
  return rv;
}

// Calls the native fork syscall.
function callFork(args) {
  const { ctypes } = ChromeUtils.importESModule(
    "resource://gre/modules/ctypes.sys.mjs"
  );
  let { lib } = args;
  let libc = ctypes.open(lib);
  let fork = libc.declare("fork", ctypes.default_abi, ctypes.int);
  let rv = fork();
  libc.close();
  return rv;
}

// Calls the native sysctl syscall.
function callSysctl(args) {
  const { ctypes } = ChromeUtils.importESModule(
    "resource://gre/modules/ctypes.sys.mjs"
  );
  let { lib, name } = args;
  let libc = ctypes.open(lib);
  let sysctlbyname = libc.declare(
    "sysctlbyname",
    ctypes.default_abi,
    ctypes.int,
    ctypes.char.ptr,
    ctypes.voidptr_t,
    ctypes.size_t.ptr,
    ctypes.voidptr_t,
    ctypes.size_t.ptr
  );
  let rv = sysctlbyname(name, null, null, null, null);
  libc.close();
  return rv;
}

function callPrctl(args) {
  const { ctypes } = ChromeUtils.importESModule(
    "resource://gre/modules/ctypes.sys.mjs"
  );
  let { lib, option } = args;
  let libc = ctypes.open(lib);
  let prctl = libc.declare(
    "prctl",
    ctypes.default_abi,
    ctypes.int,
    ctypes.int, // option
    ctypes.unsigned_long, // arg2
    ctypes.unsigned_long, // arg3
    ctypes.unsigned_long, // arg4
    ctypes.unsigned_long // arg5
  );
  let rv = prctl(option, 0, 0, 0, 0);
  if (rv == -1) {
    rv = ctypes.errno;
  }
  libc.close();
  return rv;
}

// Calls the native open/close syscalls.
function callOpen(args) {
  const { ctypes } = ChromeUtils.importESModule(
    "resource://gre/modules/ctypes.sys.mjs"
  );
  let { lib, path, flags } = args;
  let libc = ctypes.open(lib);
  let open = libc.declare(
    "open",
    ctypes.default_abi,
    ctypes.int,
    ctypes.char.ptr,
    ctypes.int
  );
  let close = libc.declare("close", ctypes.default_abi, ctypes.int, ctypes.int);
  let fd = open(path, flags);
  close(fd);
  libc.close();
  return fd;
}

// Verify faccessat2
function callFaccessat2(args) {
  const { ctypes } = ChromeUtils.importESModule(
    "resource://gre/modules/ctypes.sys.mjs"
  );
  let { lib, dirfd, path, mode, flag } = args;
  let libc = ctypes.open(lib);
  let faccessat = libc.declare(
    "faccessat",
    ctypes.default_abi,
    ctypes.int,
    ctypes.int, // dirfd
    ctypes.char.ptr, // path
    ctypes.int, // mode
    ctypes.int // flag
  );
  let rv = faccessat(dirfd, path, mode, flag);
  if (rv == -1) {
    rv = ctypes.errno;
  }
  libc.close();
  return rv;
}

// Returns the name of the native library needed for native syscalls
function getOSLib() {
  switch (Services.appinfo.OS) {
    case "WINNT":
      return "kernel32.dll";
    case "Darwin":
      return "libc.dylib";
    case "Linux":
      return "libc.so.6";
    default:
      Assert.ok(false, "Unknown OS");
      return 0;
  }
}

// Reading a header might be weird, but the alternatives to read a stable
// version number we can easily check against are not much more fun
async function getKernelVersion() {
  let header = await IOUtils.readUTF8("/usr/include/linux/version.h");
  let hr = header.split("\n");
  for (let line in hr) {
    let hrs = hr[line].split(" ");
    if (hrs[0] === "#define" && hrs[1] === "LINUX_VERSION_CODE") {
      return Number(hrs[2]);
    }
  }
  throw Error("No LINUX_VERSION_CODE");
}

// This is how it is done in /usr/include/linux/version.h
function computeKernelVersion(major, minor, dot) {
  return (major << 16) + (minor << 8) + dot;
}

function getGlibcVersion() {
  const { ctypes } = ChromeUtils.importESModule(
    "resource://gre/modules/ctypes.sys.mjs"
  );
  let libc = ctypes.open(getOSLib());
  let gnu_get_libc_version = libc.declare(
    "gnu_get_libc_version",
    ctypes.default_abi,
    ctypes.char.ptr
  );
  let rv = gnu_get_libc_version().readString();
  libc.close();
  let ar = rv.split(".");
  // return a number made of MAJORMINOR
  return Number(ar[0] + ar[1]);
}

// Returns a harmless command to execute with execv
function getOSExecCmd() {
  Assert.ok(!isWin());
  return "/bin/cat";
}

// Returns true if the current content sandbox level, passed in
// the |level| argument, supports syscall sandboxing.
function areContentSyscallsSandboxed(level) {
  let syscallsSandboxMinLevel = 0;

  // Set syscallsSandboxMinLevel to the lowest level that has
  // syscall sandboxing enabled. For now, this varies across
  // Windows, Mac, Linux, other.
  switch (Services.appinfo.OS) {
    case "WINNT":
      syscallsSandboxMinLevel = 1;
      break;
    case "Darwin":
      syscallsSandboxMinLevel = 1;
      break;
    case "Linux":
      syscallsSandboxMinLevel = 1;
      break;
    default:
      Assert.ok(false, "Unknown OS");
  }

  return level >= syscallsSandboxMinLevel;
}

//
// Drive tests for a single content process.
//
// Tests executing OS API calls in the content process. Limited to Mac
// and Linux calls for now.
//
add_task(async function () {
  // This test is only relevant in e10s
  if (!gMultiProcessBrowser) {
    ok(false, "e10s is enabled");
    info("e10s is not enabled, exiting");
    return;
  }

  let level = 0;
  let prefExists = true;

  // Read the security.sandbox.content.level pref.
  // If the pref isn't set and we're running on Linux on !isNightly(),
  // exit without failing. The Linux content sandbox is only enabled
  // on Nightly at this time.
  // eslint-disable-next-line mozilla/use-default-preference-values
  try {
    level = Services.prefs.getIntPref("security.sandbox.content.level");
  } catch (e) {
    prefExists = false;
  }

  ok(prefExists, "pref security.sandbox.content.level exists");
  if (!prefExists) {
    return;
  }

  info(`security.sandbox.content.level=${level}`);
  Assert.greater(level, 0, "content sandbox is enabled.");

  let areSyscallsSandboxed = areContentSyscallsSandboxed(level);

  // Content sandbox enabled, but level doesn't include syscall sandboxing.
  ok(areSyscallsSandboxed, "content syscall sandboxing is enabled.");
  if (!areSyscallsSandboxed) {
    info("content sandbox level too low for syscall tests, exiting\n");
    return;
  }

  let browser = gBrowser.selectedBrowser;
  let lib = getOSLib();

  // use execv syscall
  // (causes content process to be killed on Linux)
  if (isMac()) {
    // exec something harmless, this should fail
    let cmd = getOSExecCmd();
    let rv = await SpecialPowers.spawn(browser, [{ lib, cmd }], callExec);
    Assert.equal(rv, -1, `exec(${cmd}) is not permitted`);
  }

  // use open syscall
  if (isLinux() || isMac()) {
    // open a file for writing in $HOME, this should fail
    let path = fileInHomeDir().path;
    let flags = lazy.LIBC.O_CREAT | lazy.LIBC.O_WRONLY;
    let fd = await SpecialPowers.spawn(
      browser,
      [{ lib, path, flags }],
      callOpen
    );
    Assert.less(fd, 0, "opening a file for writing in home is not permitted");
  }

  // use open syscall
  if (isLinux() || isMac()) {
    // open a file for writing in the content temp dir, this should fail on
    // macOS and Linux. The open handler in the content process closes the file
    // for us
    let path = fileInTempDir().path;
    let flags = lazy.LIBC.O_CREAT | lazy.LIBC.O_WRONLY;
    let fd = await SpecialPowers.spawn(
      browser,
      [{ lib, path, flags }],
      callOpen
    );
    Assert.strictEqual(
      fd,
      -1,
      "opening a file for writing in content temp is not permitted"
    );
  }

  // use fork syscall
  if (isLinux() || isMac()) {
    let rv = await SpecialPowers.spawn(browser, [{ lib }], callFork);
    Assert.equal(rv, -1, "calling fork is not permitted");
  }

  // On macOS before 10.10 the |sysctl-name| predicate didn't exist for
  // filtering |sysctl| access. Check the Darwin version before running the
  // tests (Darwin 14.0.0 is macOS 10.10). This branch can be removed when we
  // remove support for macOS 10.9.
  if (isMac() && Services.sysinfo.getProperty("version") >= "14.0.0") {
    let rv = await SpecialPowers.spawn(
      browser,
      [{ lib, name: "kern.boottime" }],
      callSysctl
    );
    Assert.equal(rv, -1, "calling sysctl('kern.boottime') is not permitted");

    rv = await SpecialPowers.spawn(
      browser,
      [{ lib, name: "net.inet.ip.ttl" }],
      callSysctl
    );
    Assert.equal(rv, -1, "calling sysctl('net.inet.ip.ttl') is not permitted");

    rv = await SpecialPowers.spawn(
      browser,
      [{ lib, name: "hw.ncpu" }],
      callSysctl
    );
    Assert.equal(rv, 0, "calling sysctl('hw.ncpu') is permitted");
  }

  if (isLinux()) {
    // These constants are not portable.

    // verify we block PR_CAPBSET_READ with EINVAL
    let option = lazy.LIBC.PR_CAPBSET_READ;
    let rv = await SpecialPowers.spawn(browser, [{ lib, option }], callPrctl);
    Assert.strictEqual(
      rv,
      lazy.LIBC.EINVAL,
      "prctl(PR_CAPBSET_READ) is blocked"
    );

    const kernelVersion = await getKernelVersion();
    const glibcVersion = getGlibcVersion();
    // faccessat2 is only used with kernel 5.8+ by glibc 2.33+
    if (glibcVersion >= 233 && kernelVersion >= computeKernelVersion(5, 8, 0)) {
      info("Linux v5.8+, glibc 2.33+, checking faccessat2");
      const dirfd = 0;
      const path = "/";
      const mode = 0;
      // the value 0x01 is just one we know should get rejected
      let rv = await SpecialPowers.spawn(
        browser,
        [{ lib, dirfd, path, mode, flag: 0x01 }],
        callFaccessat2
      );
      Assert.strictEqual(
        rv,
        lazy.LIBC.ENOSYS,
        "faccessat2 (flag=0x01) was blocked with ENOSYS"
      );

      rv = await SpecialPowers.spawn(
        browser,
        [{ lib, dirfd, path, mode, flag: lazy.LIBC.AT_EACCESS }],
        callFaccessat2
      );
      Assert.strictEqual(
        rv,
        lazy.LIBC.EACCES,
        "faccessat2 (flag=0x200) was allowed, errno=EACCES"
      );
    } else {
      info(
        "Unsupported kernel (" +
          kernelVersion +
          " )/glibc (" +
          glibcVersion +
          "), skipping faccessat2"
      );
    }
  }
});
