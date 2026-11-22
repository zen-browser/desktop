# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from marionette_driver import Wait
from session_store_test_case import SessionStoreTestCase


def wait_for_fog(marionette):
    # Glean's blocking test APIs (testGetValue) park the main thread forever if
    # Glean is still pre-init, and FOG is initialized from a startup idle task,
    # so it can lag the point where the browser reports itself started up.
    Wait(marionette, timeout=60).until(
        lambda _: marionette.execute_script(
            """
            return Services.fog.initialized;
            """
        ),
        message="FOG should be initialized before reading Glean metrics.",
    )


def inline(title):
    return f"data:text/html;charset=utf-8,<html><head><title>{title}</title></head><body></body></html>"


TEST_WINDOWS = set([
    (
        inline("Page 1"),
        inline("Page 2"),
    ),
])


class RestoreCountsTestCase(SessionStoreTestCase):
    """The number_of_* counts are recorded on every restore attempt, including
    attempts that end up restoring nothing."""

    def _quit_and_restore(self):
        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

    def _read_counts(self):
        wait_for_fog(self.marionette)
        # On a normal restore these are recorded from a deadline timer that
        # runs COLLECT_RESULTS_AFTER_MS after the last window was restored,
        # so they aren't there the moment the session starts.
        Wait(self.marionette, timeout=40).until(
            lambda _: self.marionette.execute_script(
                """
                return Glean.sessionRestore.numberOfTabsRestored.testGetValue()
                  != null;
                """
            ),
            message="The restore counts should be recorded.",
        )
        return self.marionette.execute_script(
            """
            let counts = {};
            for (let name of [
              "numberOfTabsRestored",
              "numberOfWindowsRestored",
              "numberOfEagerTabsRestored",
            ]) {
              counts[name] = Glean.sessionRestore[name].testGetValue();
            }
            return counts;
            """
        )


class TestCountsAfterRestore(RestoreCountsTestCase):
    def setUp(self):
        super().setUp(
            startup_page=3,
            include_private=False,
            restore_on_demand=False,
            test_windows=TEST_WINDOWS,
        )

    def test_counts_are_recorded_when_tabs_are_restored(self):
        self._quit_and_restore()

        counts = self._read_counts()
        for name, value in counts.items():
            self.assertIsNotNone(value, f"{name} should be recorded.")
        self.assertGreater(
            counts["numberOfTabsRestored"]["sum"],
            0,
            "Tabs were restored, so the count is not zero.",
        )


class TestCountsWhenNothingRestored(RestoreCountsTestCase):
    def setUp(self):
        super().setUp(
            startup_page=3,
            include_private=False,
            restore_on_demand=False,
            test_windows=TEST_WINDOWS,
        )

    def test_counts_are_recorded_when_no_window_is_restored(self):
        # A session whose only windows are in _closedWindows restores no
        # window at all, so the deadline timer that normally reports these
        # counts is never started. Real sessions reach this on macOS, where
        # quitting after closing the last window saves it only in
        # _closedWindows. Build that state from the live session, and since
        # SessionStore rewrites sessionstore.jsonlz4 on shutdown, write it to
        # a separate file and swap it in once the browser has quit.
        self.marionette.execute_async_script(
            """
            let [resolve] = arguments;
            const { SessionStore } = ChromeUtils.importESModule(
                "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
            );
            let state = JSON.parse(SessionStore.getBrowserState());
            state._closedWindows = state.windows;
            state.windows = [];
            IOUtils.writeJSON(
                PathUtils.join(PathUtils.profileDir, "restore-counts-fixture.jsonlz4"),
                state,
                { compress: true }
            ).then(resolve);
            """
        )

        self.marionette.quit()
        profile_dir = self.marionette.instance.profile.profile
        os.replace(
            os.path.join(profile_dir, "restore-counts-fixture.jsonlz4"),
            os.path.join(profile_dir, "sessionstore.jsonlz4"),
        )
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        counts = self._read_counts()
        for name, value in counts.items():
            self.assertIsNotNone(
                value, f"{name} should be recorded even with nothing restored."
            )
            self.assertEqual(
                value["sum"], 0, f"{name} should report zero, not be absent."
            )
