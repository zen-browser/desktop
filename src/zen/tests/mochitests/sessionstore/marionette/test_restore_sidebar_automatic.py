# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 0.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/0.0/.

import os
import sys

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from session_store_test_case import SessionStoreTestCase


def inline(title):
    return f"data:text/html;charset=utf-8,<html><head><title>{title}</title></head><body></body></html>"


class TestSessionRestore(SessionStoreTestCase):
    """
    Test that the sidebar and its attributes are restored on reopening of window.
    """

    def setUp(self):
        super().setUp(
            startup_page=3,
            include_private=False,
            restore_on_demand=False,
            test_windows=set([
                (
                    inline("lorem ipsom"),
                    inline("dolor"),
                ),
            ]),
        )

    def test_restore(self):
        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            1,
            msg="Should have 1 window open.",
        )
        self.marionette.execute_script(
            """
            let window = BrowserWindowTracker.getTopWindow()
            window.SidebarController.show("viewHistorySidebar");
            let sidebarBox = window.document.getElementById("sidebar-box")
            sidebarBox.style.width = "100px";
            """
        )

        self.assertEqual(
            self.marionette.execute_script(
                """
                let window = BrowserWindowTracker.getTopWindow()
                return !window.document.getElementById("sidebar-box").hidden;
                """
            ),
            True,
            "Sidebar is open before window is closed.",
        )

        self.marionette.restart()
        self.marionette.set_context("chrome")

        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            1,
            msg="Windows from last session have been restored.",
        )

        self.assertEqual(
            self.marionette.execute_script(
                """
                let window = BrowserWindowTracker.getTopWindow()
                return !window.document.getElementById("sidebar-box").hidden;
                """
            ),
            True,
            "Sidebar has been restored.",
        )

        self.assertEqual(
            self.marionette.execute_script(
                """
                let window = BrowserWindowTracker.getTopWindow()
                return window.document.getElementById("sidebar-box").style.width;
                """
            ),
            "100px",
            "Sidebar width been restored.",
        )

        self.assertEqual(
            self.marionette.execute_script(
                """
                const lazy = {};
                ChromeUtils.defineESModuleGetters(lazy, {
                    SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
                });
                let state = SessionStore.getCurrentState();
                return state.windows[0].sidebar.command;
                """
            ),
            "viewHistorySidebar",
            "Correct sidebar category has been restored.",
        )
