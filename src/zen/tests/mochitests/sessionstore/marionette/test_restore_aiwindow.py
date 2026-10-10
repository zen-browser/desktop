# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from session_store_test_case import SessionStoreTestCase


def inline(title):
    return f"data:text/html;charset=utf-8,<html><head><title>{title}</title></head><body></body></html>"


class AIWindowTestMixin:
    def setUp(self, startup_page=1):
        super().setUp(
            startup_page=startup_page,
            include_private=False,
            restore_on_demand=True,
            test_windows=set([
                (
                    inline("Tab 1"),
                    inline("Tab 2"),
                    inline("Tab 3"),
                ),
            ]),
        )
        self.marionette.set_context("chrome")
        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("browser.smartwindow.enabled", true);
            """
        )

    def is_ai_window(self):
        return self.marionette.execute_script(
            """
            return window.document.documentElement.hasAttribute("ai-window");
            """
        )

    def get_tab_count(self):
        return self.marionette.execute_script(
            """
            return gBrowser.tabs.length;
            """
        )

    def toggle_ai_window(self, enabled):
        self.marionette.execute_script(
            """
            const { AIWindow } = ChromeUtils.importESModule(
                "moz-src:///browser/components/aiwindow/ui/modules/AIWindow.sys.mjs"
            );
            AIWindow.toggleAIWindow(window, arguments[0]);
            """,
            script_args=[enabled],
        )

    def restore_last_session(self):
        self.marionette.execute_script(
            """
            const lazy = {};
            ChromeUtils.defineESModuleGetters(lazy, {
                SessionStore: "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs",
            });
            function observeClosedObjectsChange() {
                return new Promise(resolve => {
                    function observe(subject, topic, data) {
                        if (topic == "sessionstore-closed-objects-changed") {
                            Services.obs.removeObserver(observe, "sessionstore-closed-objects-changed");
                            resolve();
                        }
                    }
                    Services.obs.addObserver(observe, "sessionstore-closed-objects-changed");
                });
            }

            async function restoreSession() {
                let closedWindowsObserver = observeClosedObjectsChange();
                lazy.SessionStore.restoreLastSession();
                await closedWindowsObserver;
            }
            return restoreSession();
            """
        )


class SmartWindowDefaultMixin(AIWindowTestMixin):
    """Sets the prefs so the *next* startup opens a Smart Window.

    Setting them after super().setUp() (which opened the Classic test windows)
    means only the post-restart startup window is affected. The prefs flush to
    prefs.js on the clean quit, so they apply at the restart startup.
    """

    def setUp(self, startup_page=1):
        super().setUp(startup_page=startup_page)
        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("browser.smartwindow.isDefaultWindow", true);
            Services.prefs.setIntPref("browser.smartwindow.tos.consentTime", 1);
            // Keep the Smart Window sign-in flow from navigating to the real
            // accounts.firefox.com (non-local address crashes the test sandbox).
            Services.prefs.setCharPref(
                "identity.fxaccounts.remote.root",
                "http://127.0.0.1/"
            );
            """
        )

    def can_restore_last_session(self):
        return self.marionette.execute_script(
            """
            const { SessionStore } = ChromeUtils.importESModule(
                "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
            );
            return SessionStore.canRestoreLastSession;
            """
        )


class TestAIWindowSessionRestore(AIWindowTestMixin, SessionStoreTestCase):
    """
    Test that AI Window state persists correctly across session restarts.
    """

    def test_window_mode_persists_across_restart(self):
        """Test that both Classic and AI Window states persist across session restarts."""
        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("browser.sessionstore.persist_closed_tabs_between_sessions", true);
            """
        )

        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.assertFalse(
            self.is_ai_window(), msg="Window should start as Classic Window"
        )

        tab_count = self.get_tab_count()
        self.assertEqual(tab_count, 3, msg="Should have 3 tabs")

        self.toggle_ai_window(True)
        self.assertTrue(
            self.is_ai_window(), msg="Window should be AI Window after toggle"
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.restore_last_session()

        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            2,
            msg="AI Window opened in new window due to type mismatch with startup window.",
        )

        # Switch to the AI window (the second window)
        self.marionette.switch_to_window(self.marionette.chrome_window_handles[1])

        self.assertTrue(
            self.is_ai_window(),
            msg="AI Window state should persist after restart",
        )

        self.assertEqual(
            self.get_tab_count(),
            tab_count,
            msg="Tab count should be preserved after restart",
        )

    def test_aiwindow_not_restored_when_pref_disabled(self):
        """Test that AI Windows revert to Classic when pref is disabled after restart."""
        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("browser.sessionstore.persist_closed_tabs_between_sessions", true);
            """
        )

        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.toggle_ai_window(True)
        self.assertTrue(self.is_ai_window(), msg="Window should be AI before restart")

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("browser.smartwindow.enabled", false);
            """
        )

        self.restore_last_session()

        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            1,
            msg="Window from last session has been restored.",
        )

        self.assertFalse(
            self.is_ai_window(),
            msg="AI Window should revert to Classic when pref is disabled",
        )


class TestAIWindowAutomaticRestore(AIWindowTestMixin, SessionStoreTestCase):
    """Test AI Window persistence with automatic session restore."""

    def setUp(self):
        super().setUp(startup_page=3)

    def test_single_window_stays_in_smart_window_on_automatic_restart(self):

        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.assertFalse(
            self.is_ai_window(), msg="Window should start as Classic Window"
        )

        tab_count = self.get_tab_count()
        self.assertEqual(tab_count, 3, msg="Should have 3 tabs")

        self.toggle_ai_window(True)
        self.assertTrue(
            self.is_ai_window(), msg="Window should be AI Window after toggle"
        )

        # Restart with automatic session restore
        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            1,
            msg="Should have exactly one window after automatic restore",
        )

        self.assertTrue(
            self.is_ai_window(),
            msg="Window should stay in Smart Window mode after restart",
        )

        self.assertEqual(
            self.get_tab_count(),
            tab_count,
            msg="Tab count should be preserved after restart",
        )


class TestSmartWindowDefaultRestore(SmartWindowDefaultMixin, SessionStoreTestCase):
    """
    Regression test: "Restore previous session" must stay available when the
    user's default is a Smart Window.

    When Smart Window is the default, the first window opens as Smart at startup.
    That startup path used to read the session restore state too early — before
    the saved session had been loaded from disk — so the browser concluded there
    was no session and disabled "Restore previous session". This test starts with
    Smart Window as the default, restarts, and verifies the previous session is
    still restorable and that the window stays Smart.
    """

    def test_restore_previous_session_available_with_smart_default(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )
        self.assertFalse(
            self.is_ai_window(),
            msg="Window opened during setUp should still be Classic",
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        # Startup window opens as Smart because Smart Window is the default, and
        # it must stay Smart (no flash back to Classic).
        self.assertTrue(
            self.is_ai_window(),
            msg="Startup window should open and stay Smart when it is the default",
        )

        # The actual regression: the previous session must not be discarded.
        self.assertTrue(
            self.can_restore_last_session(),
            msg="Previous session should be restorable when Smart Window is default",
        )


class TestSmartWindowDefaultClassicAutomaticRestore(
    SmartWindowDefaultMixin, SessionStoreTestCase
):
    """With Smart Window as default AND automatic restore (page=3), a window the
    user kept as Classic must come back Classic — a full restore respects the
    saved window type, even though new windows default to Smart."""

    def setUp(self):
        super().setUp(startup_page=3)

    def test_classic_window_restored_as_classic_on_automatic_restore(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )
        self.assertFalse(self.is_ai_window(), msg="Window should start as Classic")

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertFalse(
            self.is_ai_window(),
            msg="Classic window must restore as Classic on automatic restore, "
            "even when Smart Window is the default",
        )


class TestSmartWindowDefaultManualRestore(
    SmartWindowDefaultMixin, SessionStoreTestCase
):
    """With Smart Window as default (startup.page=1), restoring a previously
    Classic session via "Restore previous session" brings it back as Classic.
    Smart-by-default only applies to the new startup window, not to windows
    restored from a saved session."""

    def test_classic_session_restored_as_classic_from_history_menu(self):
        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("browser.sessionstore.persist_closed_tabs_between_sessions", true);
            """
        )

        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )
        self.assertFalse(
            self.is_ai_window(), msg="Window opened during setUp should be Classic"
        )
        tab_count = self.get_tab_count()

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        # The new startup window opens Smart because Smart Window is the default.
        self.assertTrue(
            self.is_ai_window(),
            msg="Startup window should open Smart when Smart Window is the default",
        )

        self.restore_last_session()

        # The saved session was Classic, so restoring it opens its own window
        # (its type doesn't match the Smart startup window).
        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            2,
            msg="Restored Classic session should open in a separate window",
        )

        self.marionette.switch_to_window(self.marionette.chrome_window_handles[1])
        self.assertFalse(
            self.is_ai_window(),
            msg="Restored window must stay Classic (restore respects the saved type)",
        )
        self.assertEqual(
            self.get_tab_count(),
            tab_count,
            msg="Tab count should be preserved after restore",
        )


class TestSmartWindowDefaultManualRestoreOverwritesNewTab(
    SmartWindowDefaultMixin, SessionStoreTestCase
):
    """With Smart Window as default (startup.page=1), the startup window opens
    showing the Smart new tab. Restoring a previously Smart session via
    "Restore previous session" reuses that startup window (the types match),
    and the restored tabs must *overwrite* the Smart new tab rather than being
    appended alongside it."""

    def test_smart_session_restored_overwrites_smart_new_tab(self):
        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("browser.sessionstore.persist_closed_tabs_between_sessions", true);
            """
        )

        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        # Make the saved session a Smart Window with the 3 content tabs from
        # setUp (Tab 1/2/3), which are real pages, not the Smart new tab.
        self.toggle_ai_window(True)
        self.assertTrue(
            self.is_ai_window(), msg="Window should be Smart before the restart"
        )
        tab_count = self.get_tab_count()
        self.assertEqual(tab_count, 3, msg="Saved session should have 3 tabs")

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        # The new startup window opens Smart (Smart Window is the default) and
        # shows a single Smart new tab.
        self.assertTrue(
            self.is_ai_window(),
            msg="Startup window should open Smart when Smart Window is the default",
        )

        self.restore_last_session()

        self.assertEqual(
            len(self.marionette.chrome_window_handles),
            1,
            msg="Smart session should restore into the existing startup window",
        )
        self.assertTrue(
            self.is_ai_window(),
            msg="Restored window should stay Smart",
        )

        # Asserts if Smart new tab was overwritten, not appended to.
        self.assertEqual(
            self.get_tab_count(),
            tab_count,
            msg="Restored tabs should overwrite the Smart new tab, not be "
            "appended alongside it",
        )
