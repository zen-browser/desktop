# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from session_store_test_case import SessionStoreTestCase, inline

POPUP_FEATURES = "chrome,dialog=no,resizable,toolbar=no"


class TestAutomaticWithTaskbarTabWindowFeaturesMismatch(SessionStoreTestCase):
    """
    Bug 2070404: When the last regular Firefox window closes while a
    taskbar tab window remains open, SessionStore saves the current state
    so it can be restored automatically (entry_point ==
    "automatic_with_taskbar_tab") the next time a regular window opens.
    Taskbar tab windows are excluded from that saved state, but popup
    windows are not. If the closing "last regular window" was a
    popup, it ends up as `windows[0]` of the saved state, and a later
    regular window can't be turned into a popup to match it.

    If the oldest window in the session is a popup, we should record telemetry
    that this was attempted.
    """

    def setUp(self):
        super().setUp(
            startup_page=3,
            include_private=False,
            restore_on_demand=False,
            taskbartabs_enable=True,
            test_windows=set(),
        )

    def test_automatic_with_taskbar_tab_records_popup_mismatch(self):
        self.replace_current_window({}, features=POPUP_FEATURES)
        popup_window = self.marionette.current_chrome_window_handle
        self.open_tabs(popup_window, (inline("popup tab"),))
        self.assertTrue(
            self.is_current_window_popup(),
            msg="Window should be a genuine popup",
        )

        self.open_taskbartab_window()

        # Close the popup, leaving only the taskbar tab window open. This
        # is "the last regular window" from SessionStore's perspective
        # (popups aren't excluded from that check), so it should save the
        # current state for automatic restore once a regular window
        # reopens.
        self.marionette.switch_to_window(popup_window)
        taskbartab_window = self.marionette.close_chrome_window()[0]
        self.marionette.switch_to_window(taskbartab_window)

        new_window = self.open_window()
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
            msg="Only the taskbar tab window and the new regular window "
            "should be open; no extra window should be opened for the "
            "mismatched restore",
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
            "automatic_with_taskbar_tab",
            "entry_point should be automatic_with_taskbar_tab",
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
