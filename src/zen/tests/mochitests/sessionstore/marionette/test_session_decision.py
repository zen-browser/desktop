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


def as_bool(value):
    # Glean has reported boolean event extras as strings in the past, so accept
    # either rather than depending on which.
    return value if isinstance(value, bool) else value == "true"


TEST_WINDOWS = set([
    (
        inline("Page 1"),
        inline("Page 2"),
    ),
])


class SessionDecisionTestCase(SessionStoreTestCase):
    """Restart the browser for real, then read back the telemetry describing
    what Session Restore decided to do with the session it found."""

    def _quit_and_restore(self, os_restarted=False):
        self.marionette.quit()
        saved_args = self.marionette.instance.app_args
        try:
            if os_restarted:
                self.marionette.instance.app_args = ["-os-restarted"]
            self.marionette.start_session()
            self.marionette.set_context("chrome")
        finally:
            self.marionette.instance.app_args = saved_args

    def _read_decision_telemetry(self):
        """Read the session_restore.startup_session_decision event that the
        startup we just completed recorded, and return its extra keys."""
        wait_for_fog(self.marionette)
        events = self.marionette.execute_script(
            """
            return Glean.sessionRestore.startupSessionDecision.testGetValue();
            """
        )
        self.assertIsNotNone(
            events, "A session decision should be recorded on startup."
        )
        self.assertEqual(
            len(events), 1, "The session decision should be recorded once per startup."
        )
        return events[0]["extra"]


class TestResumeByPreference(SessionDecisionTestCase):
    def setUp(self):
        # browser.startup.page has to be enforced through setUp: it is
        # re-applied on every restart, so setting it later doesn't survive.
        super().setUp(
            startup_page=3,
            include_private=False,
            restore_on_demand=False,
            test_windows=TEST_WINDOWS,
        )

    def test_session_is_resumed_because_the_user_asks_for_it(self):
        self._quit_and_restore()

        decision = self._read_decision_telemetry()
        self.assertEqual(decision["session_type"], "resume")
        self.assertEqual(
            decision["resume_reason"],
            "startup_page",
            "The standing preference is what made us resume.",
        )
        self.assertEqual(decision["action"], "restore")
        self.assertFalse(
            as_bool(decision["previous_session_crashed"]),
            "A clean shutdown is not reported as a crash.",
        )
        self.assertFalse(as_bool(decision["permanent_private"]))
        self.assertNotIn(
            "init_error", decision, "Preparing the session should not have failed."
        )
        self.assertNotIn(
            "interstitial_reason",
            decision,
            "No interstitial is shown when we restore normally.",
        )


class TestNoResumeRequested(SessionDecisionTestCase):
    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=False,
            test_windows=TEST_WINDOWS,
        )

    def test_session_is_kept_for_the_user_to_restore_by_hand(self):
        self._quit_and_restore()

        decision = self._read_decision_telemetry()
        self.assertEqual(
            decision["session_type"],
            "defer",
            "A session we were not asked to restore is kept for later.",
        )
        self.assertEqual(
            decision["action"],
            "deferred_only",
            "With no pinned tabs, the tabs are parked in recently-closed "
            "rather than opened.",
        )
        self.assertNotIn(
            "resume_reason",
            decision,
            "A resume reason is only meaningful when we resumed.",
        )


class TestOneOffResume(SessionDecisionTestCase):
    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=False,
            test_windows=TEST_WINDOWS,
        )

    def test_one_off_resume_is_reported_as_its_own_reason(self):
        # A browser update sets this to restore the session once, overriding
        # the user's usual "don't restore" preference.
        self.marionette.set_prefs({
            "browser.sessionstore.resume_session_once": True,
        })

        self._quit_and_restore()

        decision = self._read_decision_telemetry()
        self.assertEqual(decision["session_type"], "resume")
        self.assertEqual(decision["resume_reason"], "resume_session_once")
        self.assertEqual(decision["action"], "restore")

    def test_resume_after_an_os_restart_is_distinguished(self):
        self.marionette.set_prefs({
            "browser.sessionstore.resume_session_once": True,
            "browser.sessionstore.resuming_after_os_restart": True,
        })

        self._quit_and_restore(os_restarted=True)

        decision = self._read_decision_telemetry()
        self.assertEqual(decision["session_type"], "resume")
        self.assertEqual(
            decision["resume_reason"],
            "os_restart",
            "A resume the OS asked for is not the same as an update restart.",
        )
