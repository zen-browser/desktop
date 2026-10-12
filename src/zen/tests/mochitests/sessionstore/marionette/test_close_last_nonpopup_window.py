# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from session_store_test_case import SessionStoreTestCase, inline

POPUP_FEATURES = "chrome,dialog=no,resizable,toolbar=no"


class TestCloseLastNonPopupWindow(SessionStoreTestCase):
    """
    Bug 597071 - When closing the last normal window while popup window(s)
    remain open, the session should stay alive and the normal window should
    be tracked as a closed window.
    """

    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=False,
            test_windows=set(),
        )

    def test_close_last_nonpopup_window(self):
        # Purge the list of closed windows.
        self.forget_closed_windows()

        normal_window = self.marionette.current_chrome_window_handle
        self.open_tabs(normal_window, (inline("normal window tab"),))

        popup_window = self.open_window_with_extra_options({}, features=POPUP_FEATURES)

        self.marionette.switch_to_window(normal_window)
        self.marionette.close_chrome_window()
        self.marionette.switch_to_window(popup_window)

        self.assertEqual(
            len(self.get_closed_windows()),
            1,
            msg="the normal window should be tracked as a closed window",
        )

        self.assertTrue(
            self.is_current_window_popup(),
            msg="the popup window should still be open",
        )
        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            1,
            msg="the session should stay alive with only the popup window open",
        )

        # Cleanup.
        new_window = self.open_window_with_extra_options({})
        self.marionette.switch_to_window(popup_window)
        self.marionette.close_chrome_window()
        self.marionette.switch_to_window(new_window)
        self.forget_closed_windows()
