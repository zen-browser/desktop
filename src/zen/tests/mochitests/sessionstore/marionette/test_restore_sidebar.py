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
            startup_page=1,
            include_private=False,
            restore_on_demand=True,
            test_windows=set([
                (
                    inline("lorem ipsom"),
                    inline("dolor"),
                ),
            ]),
        )

    def test_restore_sidebar_open(self):
        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            1,
            msg="Should have 1 window open.",
        )
        self.marionette.execute_async_script(
            """
            const resolve = arguments[0];
            let window = BrowserWindowTracker.getTopWindow()
            window.SidebarController.show("viewHistorySidebar").then(() => {
              let sidebarBox = window.document.getElementById("sidebar-box")
              sidebarBox.style.width = "100px";
            }).then(resolve);
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

    def test_restore_sidebar_closed(self):
        self.marionette.execute_async_script(
            """
            const resolve = arguments[0];
            let window = BrowserWindowTracker.getTopWindow()
            window.SidebarController.show("viewHistorySidebar").then(() => {
             let sidebarBox = window.document.getElementById("sidebar-box")
             sidebarBox.style.width = "100px";
             window.SidebarController.toggle();
            }).then(resolve);
            """
        )

        self.assertEqual(
            self.marionette.execute_script(
                """
                let window = BrowserWindowTracker.getTopWindow()
                return window.document.getElementById("sidebar-box").hidden;
                """
            ),
            True,
            "Sidebar is hidden before window is closed.",
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
                return window.document.getElementById("sidebar-box").hidden;
                """
            ),
            True,
            "Sidebar is hidden on session restore.",
        )

        self.assertEqual(
            self.marionette.execute_script(
                """
                let window = BrowserWindowTracker.getTopWindow()
                return window.document.getElementById("sidebar-box").style.width;
                """
            ),
            "100px",
            "Sidebar width has been restored.",
        )

    def test_restore_for_always_show(self):
        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("sidebar.revamp", true);
            // Always show is only available with vertical tabs
            Services.prefs.setBoolPref("sidebar.verticalTabs", true);
            Services.prefs.setBoolPref("sidebar.animation.enabled", false);
            Services.prefs.setStringPref("sidebar.visibility", "always-show");
            """
        )
        self.marionette.restart()
        self.marionette.set_context("chrome")

        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            1,
            msg="Should have 1 window open.",
        )
        self.assertTrue(
            self.marionette.execute_script(
                """
                const window = BrowserWindowTracker.getTopWindow();
                return window.SidebarController.sidebarMain.expanded;
                """
            ),
            "Sidebar is expanded before window is closed.",
        )

        self.marionette.restart()

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            let { BrowserInitState } = ChromeUtils.importESModule("resource:///modules/BrowserGlue.sys.mjs");
            BrowserInitState.startupIdleTaskPromise.then(resolve);
            """
        )

        self.assertTrue(
            self.marionette.execute_script(
                """
                const window = BrowserWindowTracker.getTopWindow();
                return window.SidebarController.sidebarMain.expanded;
                """
            ),
            "Sidebar expanded state has been restored.",
        )

    def test_restore_for_hide_sidebar(self):
        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("sidebar.revamp", true);
            Services.prefs.setStringPref("sidebar.visibility", "hide-sidebar");
            """
        )
        self.marionette.restart()
        self.marionette.set_context("chrome")

        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            1,
            msg="Should have 1 window open.",
        )
        self.assertTrue(
            self.marionette.execute_script(
                """
                const window = BrowserWindowTracker.getTopWindow();
                return window.SidebarController.sidebarContainer.hidden;
                """
            ),
            "Sidebar is hidden before window is closed.",
        )

        self.marionette.restart()

        self.assertTrue(
            self.marionette.execute_script(
                """
                const window = BrowserWindowTracker.getTopWindow();
                return window.SidebarController.sidebarContainer.hidden;
                """
            ),
            "Sidebar visibility state has been restored.",
        )

    def test_restore_sidebar_open_from_backup_pref(self):
        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("sidebar.revamp", true);
            Services.prefs.setBoolPref("browser.privatebrowsing.autostart", true);
            """
        )
        self.marionette.restart()
        self.marionette.set_context("chrome")

        # Open the history panel.
        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            let window = BrowserWindowTracker.getTopWindow();
            window.SidebarController.show("viewHistorySidebar").then(resolve);
            """
        )

        # Restart the browser.
        self.marionette.restart()
        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            let { BrowserInitState } = ChromeUtils.importESModule("resource:///modules/BrowserGlue.sys.mjs");
            BrowserInitState.startupIdleTaskPromise.then(resolve);
            """
        )

        # Check to see if the history panel was restored.
        self.assertEqual(
            self.marionette.execute_script(
                """
                let window = BrowserWindowTracker.getTopWindow();
                return window.SidebarController.currentID;
                """
            ),
            "viewHistorySidebar",
            "Correct sidebar category has been restored.",
        )

    def test_upgrade_profile_and_restore_sidebar_from_backup_pref(self):
        # Bug 1963549 - Sidebar bookmarks no longer open automatically since the last update.
        self.marionette.execute_script(
            """
            Services.prefs.setIntPref("browser.migration.version", 154);
            Services.xulStore.setValue(
                AppConstants.BROWSER_CHROME_URL,
                "sidebar-box",
                "checked",
                "true"
            );
            """
        )
        self.test_restore_sidebar_open_from_backup_pref()
