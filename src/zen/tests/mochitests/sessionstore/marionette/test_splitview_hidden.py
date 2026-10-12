# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# add this directory to the path
import os
import sys
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

RETURN_HIDDEN_TAB_COUNT = """
return gBrowser.tabs.reduce((count, t) => count + (t.hidden ? 1 : 0), 0)
"""


class TestHiddenTabsRestoreWithSplitView(SessionStoreTestCase):
    def setUp(self):
        super().setUp(
            startup_page=3,
            include_private=False,
            restore_on_demand=True,
            test_windows=DEFAULT_WINDOWS,
        )
        self.marionette.set_context("chrome")

    def test_splitview_no_hidden_tabs(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            gBrowser.addTabSplitView([gBrowser.tabs[0], gBrowser.tabs[1]], {
            insertBefore: gBrowser.tabs[0],
            });
            let { TabStateFlusher } = ChromeUtils.importESModule("moz-src:///browser/components/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(resolve);
            """
        )

        self.assertEqual(
            self.marionette.execute_script(RETURN_HIDDEN_TAB_COUNT),
            0,
            "No tabs are hidden",
        )
        self.assertTrue(
            self.marionette.execute_script(
                "return gBrowser.splitViews.every(t => !t.hasAttribute('hidden'))"
            ),
            "No split views are hidden",
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script(RETURN_HIDDEN_TAB_COUNT),
            0,
            "No tabs are restored hidden",
        )
        self.assertTrue(
            self.marionette.execute_script(
                "return gBrowser.splitViews.every(t => !t.hasAttribute('hidden'))"
            ),
            "No restored split views are hidden",
        )

    def test_splitview_both_hidden(self):
        """
        Hiding one tab in a split view should hide both of the tabs and the
        split view container. They should be restored in the same state.
        """
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            gBrowser.addTabSplitView([gBrowser.tabs[0], gBrowser.tabs[1]], {
            insertBefore: gBrowser.tabs[0],
            });
            gBrowser.hideTab(gBrowser.tabs[0]);
            let { TabStateFlusher } = ChromeUtils.importESModule("moz-src:///browser/components/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(resolve);
            """
        )

        self.assertEqual(
            self.marionette.execute_script(RETURN_HIDDEN_TAB_COUNT),
            2,
            "Two tabs are hidden",
        )
        self.assertTrue(
            self.marionette.execute_script(
                "return gBrowser.tabs[0].hidden && gBrowser.tabs[1].hidden"
            ),
            "The right tabs are hidden",
        )
        self.assertTrue(
            self.marionette.execute_script(
                "return gBrowser.splitViews[0].hasAttribute('hidden')"
            ),
            "The split view is hidden because both tabs in it are hidden",
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script(RETURN_HIDDEN_TAB_COUNT),
            2,
            "Two tabs are restored hidden",
        )
        self.assertTrue(
            self.marionette.execute_script(
                "return gBrowser.tabs[0].hidden && gBrowser.tabs[1].hidden"
            ),
            "The right tabs are restored hidden",
        )
        self.assertTrue(
            self.marionette.execute_script(
                "return gBrowser.splitViews[0].hasAttribute('hidden')"
            ),
            "The split view is restored hidden",
        )

    def test_splitview_in_collapsed_group_is_not_hidden(self):
        """
        Bug 2063789: ensure split views that are invisible (e.g. in a collapsed
        group) but not actually hidden are restored not hidden.
        """
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            let splitview = gBrowser.addTabSplitView([gBrowser.tabs[0], gBrowser.tabs[1]], {
            insertBefore: gBrowser.tabs[0],
            });
            let group = gBrowser.addTabGroup([splitview, gBrowser.tabs[2]], { insertBefore: splitview });
            group.collapsed = true;
            let { TabStateFlusher } = ChromeUtils.importESModule("moz-src:///browser/components/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(resolve);
            """
        )

        self.assertEqual(
            self.marionette.execute_script(RETURN_HIDDEN_TAB_COUNT),
            0,
            "No tabs are hidden",
        )
        self.assertTrue(
            self.marionette.execute_script(
                "return gBrowser.splitViews.every(t => !t.hasAttribute('hidden'))"
            ),
            "No split views are hidden",
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script(RETURN_HIDDEN_TAB_COUNT),
            0,
            "No tabs are restored hidden",
        )
        self.assertTrue(
            self.marionette.execute_script(
                "return gBrowser.splitViews.every(t => !t.hasAttribute('hidden'))"
            ),
            "No restored split views are hidden",
        )
