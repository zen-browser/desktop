/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Tests to ensure that the right data is sent for
 * private windows and when ETP blocks content.
 */

/* import-globals-from send.js */
/* import-globals-from send_more_info.js */

"use strict";

Services.scriptloader.loadSubScript(
  getRootDirectory(gTestPath) + "send_more_info.js",
  this
);

const { ExperimentAPI } = ChromeUtils.importESModule(
  "resource://nimbus/ExperimentAPI.sys.mjs"
);
const { NimbusTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/NimbusTestUtils.sys.mjs"
);

add_common_setup();

const EXPECTED_EXPERIMENTS_IN_REPORT = [
  { slug: "test-experiment", branch: "branch", kind: "nimbusExperiment" },
  { slug: "test-experiment-rollout", branch: "branch", kind: "nimbusRollout" },
];

let EXPERIMENT_CLEANUPS;

add_setup(async function () {
  await ExperimentAPI.ready();
  EXPERIMENT_CLEANUPS = [
    await NimbusTestUtils.enrollWithFeatureConfig(
      { featureId: "no-feature-firefox-desktop", value: {} },
      { slug: "test-experiment", branchSlug: "branch" }
    ),
    await NimbusTestUtils.enrollWithFeatureConfig(
      { featureId: "no-feature-firefox-desktop", value: {} },
      { slug: "test-experiment-rollout", isRollout: true, branchSlug: "branch" }
    ),
    async () => {
      ExperimentAPI.manager.store._deleteForTests("test-experiment-disabled");
      await NimbusTestUtils.flushStore();
    },
  ];

  await NimbusTestUtils.enrollWithFeatureConfig(
    { featureId: "no-feature-firefox-desktop", value: {} },
    { slug: "test-experiment-disabled" }
  );
  await ExperimentAPI.manager.unenroll("test-experiment-disabled");
});

add_task(async function testSendButton() {
  ensureReportBrokenSitePreffedOn();
  ensureReasonOptional();

  const tab = await openTab(REPORTABLE_PAGE_URL);

  await testSend(tab, AppMenu(), {
    experiments: EXPECTED_EXPERIMENTS_IN_REPORT,
  });

  closeTab(tab);
});

add_task(async function testSendingMoreInfo() {
  ensureReportBrokenSitePreffedOn();
  ensureSendMoreInfoEnabled();

  const tab = await openTab(REPORTABLE_PAGE_URL);

  await testSendMoreInfo(tab, AppMenu(), {
    experiments: EXPECTED_EXPERIMENTS_IN_REPORT,
  });

  closeTab(tab);
});

add_task(async function teardown() {
  for (const cleanup of EXPERIMENT_CLEANUPS) {
    await cleanup();
  }
});
