# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from marionette_driver import Wait
from session_store_test_case import SessionStoreTestCase


def inline(title):
    return f"data:text/html;charset=utf-8,<html><head><title>{title}</title></head><body></body></html>"


TEST_WINDOWS = set([
    (
        inline("Page 1"),
        inline("Page 2"),
    ),
])


class DeferredStartupTestCase(SessionStoreTestCase):
    """Restart the browser with a session we were not asked to restore, and
    check whether startup took the restore path for it."""

    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=False,
            test_windows=TEST_WINDOWS,
        )

    def _quit_and_restart(self, persist_closed_tabs):
        # Session Restore reads this pref once, when its module loads, so it
        # has to be in place before the restart it should apply to.
        self.marionette.set_pref(
            "browser.sessionstore.persist_closed_tabs_between_sessions",
            persist_closed_tabs,
        )
        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")
        self.wait_for_fog()

    def _read_startup_telemetry(self):
        return self.marionette.execute_script(
            """
            let events = Glean.sessionRestore.startupSessionDecision.testGetValue();
            let timeline = Glean.sessionRestore.startupTimeline;
            return {
                decision: events?.length == 1 ? events[0].extra : null,
                initialized: timeline.sessionRestoreInitialized.testGetValue(),
                restoring: timeline.sessionRestoreRestoring.testGetValue(),
            };
            """
        )


class TestDeferredSessionWithNothingToCarryOver(DeferredStartupTestCase):
    def test_startup_does_not_take_the_restore_path(self):
        # With closed tabs not persisted and no pinned tabs or groups, there is
        # nothing from the deferred session to put into the startup window.
        self._quit_and_restart(persist_closed_tabs=False)

        telemetry = self._read_startup_telemetry()
        self.assertIsNotNone(
            telemetry["decision"], "The session decision is recorded once."
        )
        self.assertEqual(telemetry["decision"]["session_type"], "defer")
        self.assertEqual(
            telemetry["decision"]["action"],
            "nothing",
            "Nothing from the deferred session is opened or carried over.",
        )
        self.assertIsNotNone(
            telemetry["initialized"], "Session Restore initialized at startup."
        )
        self.assertIsNone(
            telemetry["restoring"],
            "Startup should not take the restore path when there is nothing "
            "to restore.",
        )

    def test_last_session_can_still_be_restored(self):
        self._quit_and_restart(persist_closed_tabs=False)

        self.assertTrue(
            self.marionette.execute_script(
                """
                const { SessionStore } = ChromeUtils.importESModule(
                    "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
                );
                return SessionStore.canRestoreLastSession;
                """
            ),
            "The deferred session is kept for the user to restore by hand.",
        )

        self.marionette.execute_async_script(
            """
            let [resolve] = arguments;
            const { SessionStore } = ChromeUtils.importESModule(
                "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
            );
            const topic = "sessionstore-browser-state-restored";
            Services.obs.addObserver(function observe() {
                Services.obs.removeObserver(observe, topic);
                resolve();
            }, topic);
            SessionStore.restoreLastSession();
            """
        )

        expected_urls = {url for urls in TEST_WINDOWS for url in urls}

        def all_restored(_):
            open_urls = set()
            for win in self.marionette.chrome_window_handles:
                open_urls.update(self.get_urls_for_window(win))
            return expected_urls <= open_urls

        Wait(self.marionette, timeout=20).until(
            all_restored,
            message="Every tab from the last session should have been restored.",
        )


class TestDeferredSessionWithClosedTabsToCarryOver(DeferredStartupTestCase):
    def test_startup_takes_the_restore_path(self):
        # The deferred session's tabs are carried over as closed tabs, in a
        # window that is restored into the startup window.
        self._quit_and_restart(persist_closed_tabs=True)

        telemetry = self._read_startup_telemetry()
        self.assertIsNotNone(
            telemetry["decision"], "The session decision is recorded once."
        )
        self.assertEqual(telemetry["decision"]["session_type"], "defer")
        self.assertEqual(telemetry["decision"]["action"], "deferred_only")
        self.assertIsNotNone(
            telemetry["restoring"],
            "Startup takes the restore path to carry over the closed tabs.",
        )
