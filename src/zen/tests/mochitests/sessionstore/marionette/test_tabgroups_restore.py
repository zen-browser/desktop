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
    (inline("""<div">Lorem</div>"""), inline("""<div">Ipsum</div>""")),
])


class TestAutoRestoreWithTabGroups(SessionStoreTestCase):
    def setUp(self):
        super().setUp(
            startup_page=3,
            include_private=False,
            restore_on_demand=True,
            test_windows=DEFAULT_WINDOWS,
        )
        self.marionette.set_context("chrome")

    def test_saved_groups_restored_after_quit(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            let group = gBrowser.addTabGroup([gBrowser.tabs[0]], { id: "test-group", label: "test-group" });
            let { TabStateFlusher } = ChromeUtils.importESModule("resource:///modules/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(resolve);
            """
        )

        self.assertEqual(
            self.marionette.execute_script("return gBrowser.getAllTabGroups().length"),
            1,
            "There is one open group",
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script("return gBrowser.getAllTabGroups().length"),
            1,
            "There is one open group",
        )

        self.assertEqual(
            self.marionette.execute_script("return SessionStore.savedGroups.length"),
            0,
            "The group was not saved because it was automatically restored",
        )

        self.marionette.execute_script(
            """
            let group = gBrowser.getTabGroupById("test-group");
            group.documentGlobal.SessionStore.addSavedTabGroup(group);
            group.documentGlobal.gBrowser.removeTabGroup(group, { animate: false });
            """
        )

        self.assertEqual(
            self.marionette.execute_script("return SessionStore.savedGroups.length"),
            1,
            "The group is now saved",
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script("return gBrowser.getAllTabGroups().length"),
            0,
            "The group was not automatically restored because it was manually saved",
        )

        self.assertEqual(
            self.marionette.execute_script("return SessionStore.savedGroups.length"),
            1,
            "The saved group persists after a second restart",
        )

        self.marionette.execute_script(
            """
            SessionStore.forgetSavedTabGroup("test-group");
            """
        )

    @unittest.skipIf(
        sys.platform.startswith("darwin"),
        "macOS does not close Firefox when the last window closes",
    )
    def test_saved_groups_restored_after_closing_last_window(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            let group = gBrowser.addTabGroup([gBrowser.tabs[0]], { id: "test-group", label: "test-group" });
            let { TabStateFlusher } = ChromeUtils.importESModule("resource:///modules/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(resolve);
            """
        )

        self.assertEqual(
            self.marionette.execute_script("return gBrowser.getAllTabGroups().length"),
            1,
            "There is one open group",
        )

        self.marionette.quit(callback=self._close_window)
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script("return gBrowser.getAllTabGroups().length"),
            1,
            "There is one open group",
        )

        self.assertEqual(
            self.marionette.execute_script("return SessionStore.savedGroups.length"),
            0,
            "The group was not saved because it was automatically restored",
        )

        self.marionette.execute_script(
            """
            let group = gBrowser.getTabGroupById("test-group");
            group.documentGlobal.SessionStore.addSavedTabGroup(group);
            group.documentGlobal.gBrowser.removeTabGroup(group, { animate: false });
            """
        )

        self.assertEqual(
            self.marionette.execute_script("return SessionStore.savedGroups.length"),
            1,
            "The group is now saved",
        )

        self.marionette.quit(callback=self._close_window)
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script("return gBrowser.getAllTabGroups().length"),
            0,
            "The group was not automatically restored because it was manually saved",
        )

        self.assertEqual(
            self.marionette.execute_script("return SessionStore.savedGroups.length"),
            1,
            "The saved group persists after a second restart",
        )

        self.marionette.execute_script(
            """
            SessionStore.forgetSavedTabGroup("test-group");
            """
        )
