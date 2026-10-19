# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from session_store_test_case import SessionStoreTestCase


class TestSetBrowserStateWindowFeaturesMismatch(SessionStoreTestCase):
    """
    Bug 2070404: SessionStore.setBrowserState() (entry_point ==
    "set_browser_state") restores into the current top window, closing
    every other window first. That top window's chrome can't be changed,
    so if the state's `windows[0]` is a popup, the mismatch is recorded
    and only the popup's tabs get restored into the existing window.
    """

    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=False,
            test_windows=set(),
        )

    def test_set_browser_state_records_popup_mismatch(self):
        window = self.marionette.current_chrome_window_handle
        self.assertFalse(
            self.is_current_window_popup(),
            msg="Window should not be a popup",
        )

        state = {"windows": [{"tabs": [{"entries": []}], "isPopup": True}]}
        self.marionette.execute_script(
            """
            const { SessionStore } = ChromeUtils.importESModule(
                "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
            );
            SessionStore.setBrowserState(JSON.stringify(arguments[0]));
            """,
            script_args=[state],
        )

        self.assertFalse(
            self.is_current_window_popup(),
            msg="Window should remain normal; its chrome can't be "
            "changed to match the restored popup",
        )
        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            1,
            msg="setBrowserState() should restore into the existing "
            "window rather than opening a new one",
        )
        self.assertEqual(
            self.marionette.current_chrome_window_handle,
            window,
            msg="The original window should still be the current window",
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
            "set_browser_state",
            "entry_point should be set_browser_state",
        )
        self.assertEqual(
            events[0]["extra"]["existing_features"],
            "",
            "existing window is not a popup",
        )
        self.assertEqual(
            events[0]["extra"]["requested_features"],
            "popup",
            "requested state wanted a popup",
        )
