/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

add_task(async function test_subprocess_pipe_flags() {
  const { Subprocess, getSubprocessImplForTest } = ChromeUtils.importESModule(
    "resource://gre/modules/Subprocess.sys.mjs"
  );
  const { ctypes } = ChromeUtils.importESModule(
    "resource://gre/modules/ctypes.sys.mjs"
  );
  const constants = ChromeUtils.getLibcConstants();
  const library = ctypes.open("a.out");
  const fcntl = library.declare(
    "fcntl",
    ctypes.default_abi,
    ctypes.int,
    ctypes.int,
    ctypes.int,
    "..."
  );
  // Darwin's fcntl commands for reading descriptor and file status flags.
  const F_GETFD = 1;
  const F_GETFL = 3;
  let process;

  try {
    const worker = getSubprocessImplForTest().Process.getWorker();
    Assert.equal(
      fcntl(worker.signalFd, F_GETFD),
      constants.FD_CLOEXEC,
      "The main-thread signal pipe has exactly FD_CLOEXEC set"
    );

    process = await Subprocess.call({
      command: "/bin/cat",
      stderr: "pipe",
      disclaim: true,
    });
    const fds = await worker.call("getFds", [process.id]);
    // Only inspect the descriptors while the worker owns them and cat is alive.
    // Exact flags also rule out an unintended FD_CLOFORK on macOS.
    for (const fd of fds) {
      Assert.equal(
        fcntl(fd, F_GETFD),
        constants.FD_CLOEXEC,
        "Worker pipes have exactly FD_CLOEXEC set"
      );
      Assert.equal(
        fcntl(fd, F_GETFL) & constants.O_NONBLOCK,
        constants.O_NONBLOCK,
        "Worker pipes are nonblocking"
      );
    }

    const output = process.stdout.readString(5);
    await process.stdin.write("hello");
    Assert.equal(await output, "hello", "The subprocess pipes transfer data");
    await process.stdin.close();
    Assert.equal(
      (await process.wait()).exitCode,
      0,
      "The subprocess exits cleanly"
    );
  } finally {
    if (process && process.exitCode === null) {
      await process.kill();
    }
    library.close();
  }
});
