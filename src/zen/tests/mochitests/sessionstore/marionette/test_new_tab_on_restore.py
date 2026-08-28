# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import copy
import os
import sys

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from marionette_driver import Wait
from session_store_test_case import SessionStoreTestCase


def inline(title):
    return f"data:text/html;charset=utf-8,<html><head><title>{title}</title></head><body></body></html>"


RESTORED_TAB_COUNT = 2


class TestNewTabOnRestore(SessionStoreTestCase):
    def setUp(self):
        super().setUp(
            startup_page=3,
            include_private=False,
            restore_on_demand=False,
            test_windows=set([
                (
                    inline("Page 1"),
                    inline("Page 2"),
                ),
            ]),
        )

    def _set_new_tab_on_restore_prefs(self, enabled, show_setting=True):
        self.marionette.set_prefs({
            "browser.sessionstore.newTabOnRestore": enabled,
            "browser.sessionstore.newTabOnRestore.showSetting": show_setting,
        })

    def _quit_and_restore(self, expected_tab_count=None):
        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")
        if expected_tab_count is not None:
            Wait(self.marionette, timeout=5, interval=0.1).until(
                lambda _: self._get_tab_count() == expected_tab_count,
                message=f"Expected {expected_tab_count} tabs after restore",
            )

    def _get_tab_count(self):
        return self.marionette.execute_script(
            """
            let win = BrowserWindowTracker.getTopWindow();
            return win.gBrowser.tabs.length;
            """
        )

    def _get_selected_tab_url(self):
        return self.marionette.execute_script(
            """
            let win = BrowserWindowTracker.getTopWindow();
            return win.gBrowser.selectedBrowser.currentURI.spec;
            """
        )

    def _is_selected_tab_hidden(self):
        return self.marionette.execute_script(
            """
            let win = BrowserWindowTracker.getTopWindow();
            return win.gBrowser.selectedTab.hidden;
            """
        )

    def _get_telemetry_events(self):
        return self.marionette.execute_script(
            """
            return Glean.sessionRestore.startupSessionAutoRestored.testGetValue();
            """
        )

    def test_new_tab_opens_when_enabled(self):
        self._set_new_tab_on_restore_prefs(enabled=True)
        self._quit_and_restore(expected_tab_count=RESTORED_TAB_COUNT + 1)

        selected_url = self._get_selected_tab_url()
        self.assertIn(
            "newtab",
            selected_url.lower().replace("_", ""),
            "Selected tab should be a new tab page",
        )

        events = self._get_telemetry_events()
        self.assertEqual(len(events), 1, "One telemetry event recorded")
        self.assertEqual(events[0]["extra"]["new_tab_action"], "opened")

    def test_no_new_tab_when_disabled(self):
        self._set_new_tab_on_restore_prefs(enabled=False)
        self._quit_and_restore(expected_tab_count=RESTORED_TAB_COUNT)

        events = self._get_telemetry_events()
        self.assertEqual(len(events), 1, "One telemetry event recorded")
        self.assertEqual(events[0]["extra"]["new_tab_action"], "disabled")

    def test_no_new_tab_when_show_setting_false(self):
        self._set_new_tab_on_restore_prefs(enabled=True, show_setting=False)
        self._quit_and_restore(expected_tab_count=RESTORED_TAB_COUNT)

        events = self._get_telemetry_events()
        self.assertEqual(len(events), 1, "One telemetry event recorded")
        self.assertEqual(events[0]["extra"]["new_tab_action"], "disabled")

    def test_reuses_existing_newtab_rightmost(self):
        self._set_new_tab_on_restore_prefs(enabled=True)

        self.marionette.execute_script(
            """
            let win = BrowserWindowTracker.getTopWindow();
            let { AboutNewTab } = ChromeUtils.importESModule(
                "resource:///modules/AboutNewTab.sys.mjs"
            );
            win.gBrowser.addTrustedTab(AboutNewTab.newTabURL, {
                triggeringPrincipal:
                    Services.scriptSecurityManager.getSystemPrincipal(),
            });
            """
        )

        self._quit_and_restore(expected_tab_count=RESTORED_TAB_COUNT + 1)

        events = self._get_telemetry_events()
        self.assertEqual(len(events), 1, "One telemetry event recorded")
        self.assertEqual(events[0]["extra"]["new_tab_action"], "reused")

    def test_reuses_selected_newtab(self):
        self._set_new_tab_on_restore_prefs(enabled=True)

        self.marionette.execute_script(
            """
            let win = BrowserWindowTracker.getTopWindow();
            let { AboutNewTab } = ChromeUtils.importESModule(
                "resource:///modules/AboutNewTab.sys.mjs"
            );
            let tab = win.gBrowser.addTrustedTab(AboutNewTab.newTabURL, {
                triggeringPrincipal:
                    Services.scriptSecurityManager.getSystemPrincipal(),
            });
            win.gBrowser.selectedTab = tab;
            """
        )

        self._quit_and_restore(expected_tab_count=RESTORED_TAB_COUNT + 1)

        events = self._get_telemetry_events()
        self.assertEqual(len(events), 1, "One telemetry event recorded")
        self.assertEqual(events[0]["extra"]["new_tab_action"], "reused")

    def test_no_new_tab_when_cmdline_url(self):
        self._set_new_tab_on_restore_prefs(enabled=True)

        orig_args = copy.copy(self.marionette.instance.app_args)
        try:
            self.marionette.quit()
            self.marionette.instance.app_args.extend([
                "-url",
                "data:text/html,<title>cmdline</title>",
            ])
            self.marionette.start_session()
            self.marionette.set_context("chrome")

            Wait(self.marionette, timeout=5, interval=0.1).until(
                lambda _: self._get_tab_count() >= RESTORED_TAB_COUNT,
                message=f"Expected at least {RESTORED_TAB_COUNT} tabs after restore",
            )

            events = self._get_telemetry_events()
            self.assertEqual(len(events), 1, "One telemetry event recorded")
            self.assertEqual(events[0]["extra"]["new_tab_action"], "preempted")
        finally:
            self.marionette.instance.app_args = orig_args

    def test_reuse_newtab_selects_visible_tab(self):
        self._set_new_tab_on_restore_prefs(enabled=True)

        self.marionette.execute_script(
            """
            let win = BrowserWindowTracker.getTopWindow();
            let { AboutNewTab } = ChromeUtils.importESModule(
                "resource:///modules/AboutNewTab.sys.mjs"
            );
            let visibleTab = win.gBrowser.addTrustedTab(AboutNewTab.newTabURL, {
                triggeringPrincipal:
                    Services.scriptSecurityManager.getSystemPrincipal(),
            });
            let hiddenTab = win.gBrowser.addTrustedTab(AboutNewTab.newTabURL, {
                triggeringPrincipal:
                    Services.scriptSecurityManager.getSystemPrincipal(),
            });
            win.gBrowser.hideTab(hiddenTab);
            // Select first tab so neither newtab is selected
            win.gBrowser.selectedTab = win.gBrowser.tabs[0];
            """
        )

        self._quit_and_restore(expected_tab_count=RESTORED_TAB_COUNT + 2)

        self.assertFalse(
            self._is_selected_tab_hidden(),
            "Selected tab should not be hidden",
        )

        events = self._get_telemetry_events()
        self.assertEqual(len(events), 1, "One telemetry event recorded")
        self.assertEqual(events[0]["extra"]["new_tab_action"], "reused")


class TestNewTabOnRestoreNotSettingBased(SessionStoreTestCase):
    """
    Test that no new tab or telemetry is recorded when restore is not
    triggered by the user's startup.page setting.
    """

    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=False,
            test_windows=set([
                (inline("Page 1"),),
            ]),
        )

    def test_no_new_tab_on_non_setting_restore(self):
        self.marionette.set_prefs({
            "browser.sessionstore.newTabOnRestore": True,
            "browser.sessionstore.newTabOnRestore.showSetting": True,
        })

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        # Manually restore previous session (simulates non-setting-based restore)
        self.marionette.execute_script(
            """
            const { SessionStore } = ChromeUtils.importESModule(
                "resource:///modules/sessionstore/SessionStore.sys.mjs"
            );
            SessionStore.restoreLastSession();
            """
        )

        events = self.marionette.execute_script(
            """
            return Glean.sessionRestore.startupSessionAutoRestored.testGetValue();
            """
        )
        self.assertIsNone(
            events,
            "No telemetry when restore is not setting-based",
        )


class TestNewTabOnRestoreAfterCrash(SessionStoreTestCase):
    """
    A crash-triggered restore is not a user-configured restore, so the
    new-tab-on-restore feature must not engage even when the setting is on.
    Guards the `!ss.previousSessionCrashed` check in SessionStore's initSession.
    """

    def setUp(self):
        super().setUp(
            startup_page=3,
            include_private=False,
            restore_on_demand=False,
            test_windows=set([
                (
                    inline("Page 1"),
                    inline("Page 2"),
                ),
            ]),
        )
        self.marionette.set_prefs({
            "browser.sessionstore.newTabOnRestore": True,
            "browser.sessionstore.newTabOnRestore.showSetting": True,
        })

    def test_no_new_tab_after_crash(self):
        # Persist prefs and the session to disk before the crash.
        self.marionette.execute_async_script(
            """
            let [resolve] = arguments;
            Services.prefs.savePrefFile(Services.dirsvc.get("PrefF", Ci.nsIFile));
            const { TabStateFlusher } = ChromeUtils.importESModule(
                "resource:///modules/sessionstore/TabStateFlusher.sys.mjs"
            );
            const { SessionSaver } = ChromeUtils.importESModule(
                "resource:///modules/sessionstore/SessionSaver.sys.mjs"
            );
            (async () => {
                for (let win of Services.wm.getEnumerator("navigator:browser")) {
                    await TabStateFlusher.flushWindow(win);
                }
                await SessionSaver.run();
            })().then(resolve);
            """
        )

        # Simulate a crash: kill the process without a clean shutdown so the
        # "final-state-write-complete" checkpoint is never recorded.
        self.marionette.quit(in_app=False)
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.marionette.execute_async_script(
            """
            let [resolve] = arguments;
            const { SessionStore } = ChromeUtils.importESModule(
                "resource:///modules/sessionstore/SessionStore.sys.mjs"
            );
            SessionStore.promiseAllWindowsRestored.then(resolve);
            """
        )

        # Validity check: the prefs must have actually persisted across the
        # crash.
        prefs = self.marionette.execute_script(
            """
            return {
                enabled: Services.prefs.getBoolPref(
                    "browser.sessionstore.newTabOnRestore", false
                ),
                showSetting: Services.prefs.getBoolPref(
                    "browser.sessionstore.newTabOnRestore.showSetting", false
                ),
            };
            """
        )
        self.assertTrue(
            prefs["enabled"] and prefs["showSetting"],
            "newTabOnRestore prefs should persist across the crash so the "
            "feature is enabled; otherwise this test is not exercising the "
            "previousSessionCrashed path",
        )

        # No new tab should be added: only the restored tabs are present.
        tab_count = self.marionette.execute_script(
            """
            let win = BrowserWindowTracker.getTopWindow();
            return win.gBrowser.tabs.length;
            """
        )
        self.assertEqual(
            tab_count,
            RESTORED_TAB_COUNT,
            "No new tab should be added after a crash restore",
        )

        events = self.marionette.execute_script(
            """
            return Glean.sessionRestore.startupSessionAutoRestored.testGetValue();
            """
        )
        self.assertIsNone(
            events,
            "The new-tab-on-restore feature must not engage after a crash "
            "restore (previousSessionCrashed)",
        )
