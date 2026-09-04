# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys
from urllib.parse import quote

sys.path.append(os.path.dirname(__file__))

from marionette_driver import Wait
from session_store_test_case import SessionStoreTestCase


def inline(doc):
    return f"data:text/html;charset=utf-8,{quote(doc)}"


CANONICAL_URL = "https://example.com/canonical"


class TestCanonicalUrlRestore(SessionStoreTestCase):
    """
    Test that canonicalUrl and hasTabNote are properly restored on pending
    tabs after browser restart with session restore enabled.

    Uses two tabs with restore_on_demand=True:
    - tabs[0]: pending tab (not selected, stays pending)
    - tabs[1]: selected tab (the last one opened)
    """

    def setUp(self):
        super().setUp(
            startup_page=3,  # Restore previous session
            include_private=False,
            restore_on_demand=True,  # Keep non-selected tabs pending
            test_windows=set([
                # Two tabs - the last one opened will be selected
                (
                    inline("<div>Tab 1</div>"),
                    inline("<div>Tab 2</div>"),
                ),
            ]),
        )
        self.marionette.set_context("chrome")
        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("browser.tabs.notes.enabled", true);
            """
        )

    def test_hasTabNote_set_after_restart(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        tab_count = self.marionette.execute_script("return gBrowser.tabs.length;")
        self.assertEqual(tab_count, 2, "Should have 2 tabs")

        # Set canonicalUrl and note on tabs[0] (will be pending after restart)
        self.marionette.execute_async_script(
            f"""
            let resolve = arguments[0];
            (async () => {{
                const {{ TabNotes }} = ChromeUtils.importESModule(
                    "moz-src:///browser/components/tabnotes/TabNotes.sys.mjs"
                );

                await TabNotes.init();

                let pendingTab = gBrowser.tabs[0];
                pendingTab.canonicalUrl = "{CANONICAL_URL}";
                await TabNotes.set(pendingTab, "Note for pending tab");

                let {{ TabStateFlusher }} = ChromeUtils.importESModule(
                    "resource:///modules/sessionstore/TabStateFlusher.sys.mjs"
                );
                await TabStateFlusher.flushWindow(gBrowser.documentGlobal);
            }})().then(resolve);
            """
        )

        # Verify state before restart
        result_before = self.marionette.execute_script(
            """
            return {
                canonicalUrl: gBrowser.tabs[0].canonicalUrl,
                hasTabNote: gBrowser.tabs[0].hasTabNote
            };
            """
        )
        self.assertEqual(
            result_before["canonicalUrl"],
            CANONICAL_URL,
            "canonicalUrl should be set before restart",
        )
        self.assertTrue(
            result_before["hasTabNote"],
            "hasTabNote should be true before restart",
        )

        # Restart browser
        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        # Wait for hasTabNote to be set on the pending tab (async due to database check)
        Wait(self.marionette, timeout=10, interval=0.2).until(
            lambda _: self.marionette.execute_script(
                """
                return gBrowser.tabs[0].hasTabNote === true;
                """
            ),
            message="hasTabNote should be set on pending tab after restart",
        )

        # Verify state after restart
        result = self.marionette.execute_script(
            """
            let pendingTab = gBrowser.tabs[0];
            return {
                isPending: pendingTab.hasAttribute("pending"),
                canonicalUrl: pendingTab.canonicalUrl,
                hasTabNote: pendingTab.hasTabNote
            };
            """
        )

        self.assertTrue(result["isPending"], "Tab should be pending after restore")
        self.assertEqual(
            result["canonicalUrl"],
            CANONICAL_URL,
            "canonicalUrl should be restored on pending tab",
        )
        self.assertTrue(
            result["hasTabNote"],
            "hasTabNote should be true for pending tab with existing note",
        )

    def test_canonicalUrl_cleared_when_feature_disabled(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        # Set canonicalUrl on a tab
        self.marionette.execute_async_script(
            f"""
            let resolve = arguments[0];
            (async () => {{
                let tab = gBrowser.tabs[0];
                tab.canonicalUrl = "{CANONICAL_URL}";

                let {{ TabStateFlusher }} = ChromeUtils.importESModule(
                    "resource:///modules/sessionstore/TabStateFlusher.sys.mjs"
                );
                await TabStateFlusher.flushWindow(gBrowser.documentGlobal);
            }})().then(resolve);
            """
        )

        canonicalUrl = self.marionette.execute_script(
            "return gBrowser.tabs[0].canonicalUrl;"
        )
        self.assertEqual(
            canonicalUrl, CANONICAL_URL, "canonicalUrl should be set before restart"
        )

        # Restart browser with tab notes disabled
        self.marionette.execute_script(
            """
            Services.prefs.setBoolPref("browser.tabs.notes.enabled", false);
            """
        )
        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        result = self.marionette.execute_script(
            """
            let tab = gBrowser.tabs[0];
            return {
                canonicalUrl: tab.canonicalUrl,
                isPending: tab.hasAttribute("pending")
            };
            """
        )

        self.assertTrue(result["isPending"], "Tab should be pending after restore")
        self.assertIsNone(
            result["canonicalUrl"],
            "canonicalUrl should be cleared when feature is disabled",
        )

    def test_hasTabNote_false_when_no_note(self):
        self.skipTest("To be added in Bug 2014766 pending TabNotesController updates")
