/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ProfilerTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/ProfilerTestUtils.sys.mjs"
);

async function addTab() {
  const tab = BrowserTestUtils.addTab(gBrowser, "https://example.com/browser", {
    forceNewProcess: true,
  });
  const browser = gBrowser.getBrowserForTab(tab);
  await BrowserTestUtils.browserLoaded(browser);
  return tab;
}

const sandboxSettingsEnabled = {
  entries: 8 * 1024 * 1024, // 8M entries = 64MB
  interval: 1, // ms
  features: ["stackwalk", "sandbox"],
  threads: ["SandboxProfilerEmitter"],
};

const sandboxSettingsDisabled = {
  entries: 8 * 1024 * 1024, // 8M entries = 64MB
  interval: 1, // ms
  features: ["stackwalk"],
  threads: ["SandboxProfilerEmitter"],
};

const kNewProcesses = 2;

async function waitForMaybeSandboxProfilerData(
  threadName,
  name1,
  withStacks,
  enabled
) {
  let tabs = [];
  for (let i = 0; i < kNewProcesses; ++i) {
    tabs.push(await addTab());
  }

  let profile;
  let intercepted = undefined;
  try {
    await TestUtils.waitForCondition(
      async () => {
        profile = await Services.profiler.getProfileDataAsync();
        intercepted = profile.processes
          .flatMap(ps => {
            let sandboxThreads = ps.threads.filter(
              th => th.name === threadName
            );
            return sandboxThreads.flatMap(th => {
              let markersData = th.markers.data;
              return markersData.flatMap(d => {
                let [, , , , , o] = d;
                return o;
              });
            });
          })
          .filter(x => "name1" in x && name1.includes(x.name1) >= 0);
        return !!intercepted.length;
      },
      `Wait for some samples from ${threadName}`,
      /* interval*/ 100,
      /* maxTries */ 25
    );
    Assert.greater(
      intercepted.length,
      0,
      `Should have collected some data from ${threadName}`
    );
  } catch (ex) {
    if (!enabled && ex.includes(`Wait for some samples from ${threadName}`)) {
      Assert.equal(
        intercepted.length,
        0,
        `Should have NOT collected data from ${threadName}`
      );
    } else {
      throw ex;
    }
  }

  if (withStacks) {
    let stacks = profile.processes.flatMap(ps => {
      let sandboxThreads = ps.threads.filter(th => th.name === threadName);
      return sandboxThreads.flatMap(th => {
        let stackTableData = th.stackTable.data;
        return stackTableData.flatMap(d => {
          return [d];
        });
      });
    });
    if (enabled) {
      Assert.greater(stacks.length, 0, "Should have some stack as well");
    } else {
      Assert.equal(stacks.length, 0, "Should have NO stack as well");
    }
  }

  for (let tab of tabs) {
    await BrowserTestUtils.removeTab(tab);
  }
}

add_task(async () => {
  await ProfilerTestUtils.startProfiler(sandboxSettingsEnabled);
  await waitForMaybeSandboxProfilerData(
    "SandboxProfilerEmitterSyscalls",
    ["id", "init"],
    /* withStacks */ true,
    /* enabled */ true
  );
  await Services.profiler.StopProfiler();
});

add_task(async () => {
  await ProfilerTestUtils.startProfiler(sandboxSettingsEnabled);
  await waitForMaybeSandboxProfilerData(
    "SandboxProfilerEmitterLogs",
    ["log"],
    /* withStacks */ false,
    /* enabled */ true
  );
  await Services.profiler.StopProfiler();
});

add_task(async () => {
  await ProfilerTestUtils.startProfiler(sandboxSettingsDisabled);
  await waitForMaybeSandboxProfilerData(
    "SandboxProfilerEmitterSyscalls",
    ["id", "init"],
    /* withStacks */ true,
    /* enabled */ false
  );
  await Services.profiler.StopProfiler();
});

add_task(async () => {
  await ProfilerTestUtils.startProfiler(sandboxSettingsEnabled);
  await waitForMaybeSandboxProfilerData(
    "SandboxProfilerEmitterLogs",
    ["log"],
    /* withStacks */ false,
    /* enabled */ false
  );
  await Services.profiler.StopProfiler();
});
