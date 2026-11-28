# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from session_store_test_case import SessionStoreTestCase, inline

POPUP_FEATURES = "chrome,dialog=no,resizable,toolbar=no"


class TestAutomaticStartupWindowFeaturesMismatch(SessionStoreTestCase):
    """
    Bug 2070404: Automatic session restore on startup (entry_point ==
    "automatic_startup") restores into whatever window Firefox happens to
    open at startup, regardless of whether that window's chrome matches the
    saved session's first window.

    If the oldest window in the session is a popup, we should record telemetry
    that this was attempted.
    """

    def setUp(self):
        super().setUp(
            startup_page=3,
            include_private=False,
            restore_on_demand=False,
            test_windows=set(),
        )

    def test_automatic_startup_records_popup_mismatch(self):
        self.replace_current_window({}, features=POPUP_FEATURES)
        self.open_tabs(
            self.marionette.current_chrome_window_handle, (inline("popup tab"),)
        )
        self.assertTrue(
            self.is_current_window_popup(),
            msg="Window should be a genuine popup before quitting",
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        startup_window = self.marionette.current_chrome_window_handle
        self.wait_for_tab_urls(
            startup_window,
            [inline("popup tab")],
            "The popup's tab should be restored into the startup window "
            "even though its chrome can't be changed",
        )

        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            1,
            msg="The mismatched restore should be applied into the "
            "existing startup window rather than opening a new window",
        )
        self.assertFalse(
            self.is_current_window_popup(),
            msg="The startup window should remain normal; its chrome "
            "can't be changed to match the restored popup",
        )

        self.wait_for_fog()
        events = self.marionette.execute_script(
            """
            return Glean.sessionRestore.windowFeaturesMismatchIgnored.testGetValue();
            """
        )
        self.assertEqual(len(events), 1, "One mismatch event should have been recorded")
        self.assertEqual(
            events[0]["extra"]["entry_point"],
            "automatic_startup",
            "entry_point should be automatic_startup",
        )
        self.assertEqual(
            events[0]["extra"]["existing_features"],
            "",
            "existing startup window is not a popup",
        )
        self.assertEqual(
            events[0]["extra"]["requested_features"],
            "popup",
            "requested state wanted a popup",
        )
