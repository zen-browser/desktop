# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import copy
import os
import sys

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from session_store_test_case import SessionStoreTestCase, inline

POPUP_FEATURES = "chrome,dialog=no,resizable,toolbar=no"


class TestDeferredInitialStateWindowFeaturesMismatch(SessionStoreTestCase):
    """
    Bug 2070404: A deferred initial-state restore (entry_point ==
    "deferred_initial_state") happens when Firefox starts up with a
    private or taskbar tab window first, so the automatic restore of the
    saved session is deferred until a regular window opens. That regular
    window is guaranteed to be non-private, non-taskbar-tab, and
    non-popup, but the saved session's `windows[0]` (the oldest surviving
    window from that session) could be a popup.

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

    def test_deferred_initial_state_records_popup_mismatch(self):
        self.replace_current_window({}, features=POPUP_FEATURES)
        self.open_tabs(
            self.marionette.current_chrome_window_handle, (inline("popup tab"),)
        )
        self.assertTrue(
            self.is_current_window_popup(),
            msg="Window should be a genuine popup before quitting",
        )

        orig_args = copy.copy(self.marionette.instance.app_args)
        try:
            self.marionette.quit()
            self.marionette.instance.app_args.extend(["-private-window"])
            self.marionette.start_session()
            self.marionette.set_context("chrome")

            self.assertTrue(
                self.marionette.execute_script(
                    "return PrivateBrowsingUtils.isWindowPrivate(window);"
                ),
                msg="Startup window should be a private window, deferring "
                "the initial state instead of restoring it immediately",
            )

            # `self.open_window()` would inherit the privateness of the current
            # top window, so use `self.open_window_with_extra_options({})` to
            # avoid inheriting features of the top window.
            new_window = self.open_window_with_extra_options({})
            self.marionette.switch_to_window(new_window)
            self.assertFalse(
                self.is_current_window_popup(),
                msg="New window should be a normal (non-popup) window",
            )

            self.wait_for_tab_urls(
                new_window,
                [inline("popup tab"), "about:blank"],
                "The popup's tab should be restored into the new regular "
                "window even though its chrome can't be changed",
            )

            self.assertEqual(
                len(self.marionette.chrome_window_handles),
                2,
                msg="Only the private window and the new regular window "
                "should be open; no extra window should be opened for "
                "the mismatched restore",
            )

            self.wait_for_fog()
            events = self.marionette.execute_script(
                """
                return Glean.sessionRestore.windowFeaturesMismatchIgnored.testGetValue();
                """
            )
            self.assertEqual(
                len(events), 1, "One mismatch event should have been recorded"
            )
            self.assertEqual(
                events[0]["extra"]["entry_point"],
                "deferred_initial_state",
                "entry_point should be deferred_initial_state",
            )
            self.assertEqual(
                events[0]["extra"]["existing_features"],
                "",
                "existing new window is not a popup",
            )
            self.assertEqual(
                events[0]["extra"]["requested_features"],
                "popup",
                "requested state wanted a popup",
            )
        finally:
            self.marionette.instance.app_args = orig_args
