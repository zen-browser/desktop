# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# add this directory to the path
import os
import sys
import unittest
from urllib.parse import quote

sys.path.append(os.path.dirname(__file__))

from session_store_test_case import SessionStoreTestCase


def inline(doc):
    return f"data:text/html;charset=utf-8,{quote(doc)}"


# Each list element represents a window of tabs loaded at
# some testing URL
DEFAULT_WINDOWS = set([
    # Window 1. Note the comma after the inline call -
    # this is Python's way of declaring a 1 item tuple.
    (
        inline("""<div">Lorem</div>"""),
        inline("""<div">Ipsum</div>"""),
        inline("""<div">Dolor</div>"""),
        inline("""<div">sit</div>"""),
        inline("""<div">amet</div>"""),
    ),
])


class TestAutoRestoreWithSplitView(SessionStoreTestCase):
    def setUp(self):
        super().setUp(
            startup_page=3,
            include_private=False,
            restore_on_demand=True,
            test_windows=DEFAULT_WINDOWS,
        )
        self.marionette.set_context("chrome")

    def test_splitview_restored_after_quit(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            gBrowser.addTabSplitView([gBrowser.tabs[0], gBrowser.tabs[1]], {
            insertBefore: gBrowser.tabs[0],
            });
            let { TabStateFlusher } = ChromeUtils.importESModule("resource:///modules/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(resolve);
            """
        )

        self.assertEqual(
            self.marionette.execute_script(
                "return gBrowser.tabs[1].splitview.tabs.length"
            ),
            2,
            "There is a splitview with two tabs",
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script(
                "return gBrowser.tabs[1].splitview.tabs.length"
            ),
            2,
            "Splitview with two tabs restored",
        )

        self.assertIsNone(
            self.marionette.execute_script("return gBrowser.activeSplitView"),
            "Split view is not activated on restore when the selected tab is not in the split view",
        )

    def test_splitview_restored_multiple_after_quit(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            gBrowser.addTabSplitView([gBrowser.tabs[0], gBrowser.tabs[1]], {
            insertBefore: gBrowser.tabs[0],
            });
            gBrowser.addTabSplitView([gBrowser.tabs[2], gBrowser.tabs[3]], {
            insertBefore: gBrowser.tabs[2],
            });
            gBrowser.selectedTab = gBrowser.tabs[2];
            let { TabStateFlusher } = ChromeUtils.importESModule("resource:///modules/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(resolve);
            """
        )

        self.assertEqual(
            self.marionette.execute_script(
                "return gBrowser.tabs[2].splitview.tabs.length"
            ),
            2,
            "There is a second splitview with two tabs",
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertTrue(
            self.marionette.execute_script(
                "return gBrowser.tabs[1].splitview.tabs.length && gBrowser.tabs[2].splitview.tabs.length"
            ),
            "Two split views have been restored",
        )

        self.assertTrue(
            self.marionette.execute_script(
                "return gBrowser.selectedTab == gBrowser.tabs[2]"
            ),
            "Third tab that's in a splitview is the selected tab",
        )
        self.assertTrue(
            self.marionette.execute_script(
                "return gBrowser.activeSplitView != gBrowser.tabs[0].splitview && gBrowser.activeSplitView == gBrowser.tabs[2].splitview"
            ),
            "Split view is not activated on restore when the selected tab does not belong to that split view",
        )

    @unittest.skipIf(
        sys.platform.startswith("darwin"),
        "macOS does not close Firefox when the last window closes",
    )
    def test_splitview_restored_after_closing_last_window(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            gBrowser.addTabSplitView([gBrowser.tabs[0], gBrowser.tabs[1]], {
                insertBefore: gBrowser.tabs[0],
            });
            let { TabStateFlusher } = ChromeUtils.importESModule("resource:///modules/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(resolve);
            """
        )

        self.assertEqual(
            self.marionette.execute_script(
                """
                return gBrowser.tabs[0].splitview.tabs.length
                """
            ),
            2,
            "There is a splitview with two tabs",
        )

        self.marionette.quit(callback=self._close_window)
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script(
                "return gBrowser.tabs[0].splitview.tabs.length"
            ),
            2,
            "Splitview with two tabs restored",
        )

        self.assertIsNone(
            self.marionette.execute_script("return gBrowser.activeSplitView"),
            "Split view is not activated on restore when the selected tab is not in the split view",
        )
