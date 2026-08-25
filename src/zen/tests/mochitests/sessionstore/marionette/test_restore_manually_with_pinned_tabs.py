# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys
from urllib.parse import quote

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from marionette_driver import Wait, errors
from session_store_test_case import SessionStoreTestCase


def inline(doc):
    return f"data:text/html;charset=utf-8,{quote(doc)}"


class TestSessionRestoreWithPinnedTabs(SessionStoreTestCase):
    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=True,
            test_windows=set([
                # Window 1
                (
                    inline("""<div">ipsum</div>"""),
                    inline("""<div">dolor</div>"""),
                    inline("""<div">amet</div>"""),
                ),
            ]),
        )

    def test_no_restore_with_quit(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )
        # add pinned tab in first window.
        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            gBrowser.pinTab(gBrowser.tabs[0]);
            let { TabStateFlusher } = ChromeUtils.importESModule("resource:///modules/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flush(gBrowser.tabs[0]).then(resolve);
        """
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script("return gBrowser.tabs.length"),
            2,
            msg="Should have 2 tabs.",
        )

        self.assertEqual(
            self.marionette.execute_script(
                "return gBrowser.tabs.filter(t => t.pinned).length"
            ),
            1,
            msg="Pinned tab should have been restored.",
        )

        self.marionette.execute_script(
            """
            SessionStore.restoreLastSession();
        """
        )
        self.wait_for_tabcount(3, "Waiting for 3 tabs")

        self.assertEqual(
            self.marionette.execute_script("return gBrowser.tabs.length"),
            3,
            msg="Should have 2 tabs.",
        )
        self.assertEqual(
            self.marionette.execute_script(
                "return gBrowser.tabs.filter(t => t.pinned).length"
            ),
            1,
            msg="Should still have 1 pinned tab",
        )

    def wait_for_tabcount(self, expected_tabcount, message, timeout=5):
        current_tabcount = None

        def check(_):
            nonlocal current_tabcount
            current_tabcount = self.marionette.execute_script(
                "return gBrowser.tabs.length;"
            )
            return current_tabcount == expected_tabcount

        try:
            wait = Wait(self.marionette, timeout=timeout, interval=0.1)
            wait.until(check, message=message)
        except errors.TimeoutException as e:
            # Update the message to include the most recent list of windows
            message = (
                f"{e.message}. Expected {expected_tabcount}, got {current_tabcount}."
            )
            raise errors.TimeoutException(message)
