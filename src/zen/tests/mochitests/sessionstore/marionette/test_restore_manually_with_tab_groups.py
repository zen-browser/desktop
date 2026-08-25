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


class TestSessionRestoreWithTabGroups(SessionStoreTestCase):
    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=True,
            test_windows=set([
                (
                    inline("""<div">lorem</div>"""),
                    inline("""<div">ipsum</div>"""),
                    inline("""<div">dolor</div>"""),
                    inline("""<div">sit</div>"""),
                    inline("""<div">amet</div>"""),
                ),
            ]),
        )

    def test_no_restore_with_quit(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            gBrowser.addTabGroup([gBrowser.tabs[3], gBrowser.tabs[4]], { id: "group-left-open-1", label: "open-1" });
            gBrowser.addTabGroup([gBrowser.tabs[2]], { id: "group-left-open-2", label: "open-2" });
            let closedGroup = gBrowser.addTabGroup([gBrowser.tabs[1]], { id:"group-closed", label: "closed" });
            gBrowser.removeTabGroup(closedGroup);

            let { TabStateFlusher } = ChromeUtils.importESModule("resource:///modules/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(resolve);
        """
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")
        self.assertEqual(
            self.marionette.execute_script(
                """
                let closedGroupIds = SessionStore.getWindowState(gBrowser.documentGlobal).windows[0].closedGroups.map(g => g.id);
                return !(closedGroupIds.includes("group-left-open-1") && closedGroupIds.includes("group-left-open-2"));
                """
            ),
            True,
            "Groups that were left open are NOT in closedGroups",
        )

        self.assertEqual(
            self.marionette.execute_script(
                "return SessionStore.getWindowState(gBrowser.documentGlobal).windows[0].closedGroups.length"
            ),
            1,
            msg="There is one closed group in the window",
        )

        self.assertEqual(
            self.marionette.execute_script(
                "return SessionStore.getWindowState(gBrowser.documentGlobal).windows[0].closedGroups[0].id"
            ),
            "group-closed",
            msg="Correct group appears in closedGroups",
        )

        self.assertEqual(
            self.marionette.execute_script("return SessionStore.savedGroups.length"),
            2,
            msg="There are two saved groups",
        )

        self.assertEqual(
            self.marionette.execute_script(
                "return SessionStore.savedGroups.map(g => g.id)"
            ),
            ["group-left-open-1", "group-left-open-2"],
            msg="The open groups from last session are now saved",
        )

        self.assertEqual(
            self.marionette.execute_script(
                "return SessionStore.getWindowState(gBrowser.documentGlobal).windows[0].closedGroups[0].tabs.length"
            ),
            1,
            msg="Closed group has 1 tab",
        )

        self.assertEqual(
            self.marionette.execute_script(
                "return SessionStore.savedGroups.map(g => g.tabs.length)"
            ),
            [2, 1],
            msg="Saved groups have 1 and 2 tabs respectively",
        )

        self.marionette.execute_script(
            """
            SessionStore.restoreLastSession();
        """
        )
        self.wait_for_tabcount(4, "Waiting for 4 tabs")

        self.assertEqual(
            self.marionette.execute_script("return gBrowser.tabs.length"),
            4,
            msg="4 tabs was restored",
        )
        self.assertEqual(
            self.marionette.execute_script("return gBrowser.tabGroups.length"),
            2,
            msg="2 tab groups were restored",
        )

        self.assertEqual(
            self.marionette.execute_script("return SessionStore.savedGroups?.length"),
            0,
            msg="We have no saved tab groups",
        )

    def test_no_redundant_saves(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_script(
            """
            let group = gBrowser.addTabGroup([...gBrowser.tabs], { id: "group-to-save", label: "to-save" });
            let { TabStateFlusher } = ChromeUtils.importESModule("resource:///modules/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(() => {
                group.saveAndClose();
            });
            """
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")
        self.assertEqual(
            self.marionette.execute_script(
                """
                return SessionStore.savedGroups.length;
                """
            ),
            1,
            "There is one and only one saved group",
        )

        self.marionette.execute_script(
            """
            SessionStore.forgetSavedTabGroup("group-to-save");
            """
        )

    def test_open_groups_become_permanently_saved_after_two_quits_bug1954488(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            gBrowser.addTabGroup([gBrowser.tabs[3], gBrowser.tabs[4]], { id: "save-through-restore-1", label: "open-1" });
            gBrowser.addTabGroup([gBrowser.tabs[1], gBrowser.tabs[2]], { id: "save-through-restore-2", label: "open-2" });

            let { TabStateFlusher } = ChromeUtils.importESModule("resource:///modules/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(resolve);
        """
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script(
                """
                return SessionStore.savedGroups.length;
                """
            ),
            2,
            "There are two saved groups",
        )

        win = self.marionette.current_chrome_window_handle
        self.open_tabs(win, (inline("sit"), inline("amet")))

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script(
                """
                return SessionStore.savedGroups.length;
                """
            ),
            2,
            "There are two saved groups",
        )

        self.marionette.execute_script(
            """
            SessionStore.restoreLastSession();
        """
        )
        self.wait_for_tabcount(2, "Waiting for 2 tabs")

        self.assertEqual(
            self.marionette.execute_script(
                """
                return SessionStore.savedGroups.length;
                """
            ),
            2,
            "There are still two saved groups after the second quit",
        )

        self.marionette.execute_script(
            """
            SessionStore.forgetSavedTabGroup("save-through-restore-1");
            SessionStore.forgetSavedTabGroup("save-through-restore-2");
            """
        )

    def test_saved_groups_no_longer_saved_if_restored_to_tab_strip_bug1956254(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            gBrowser.addTabGroup([gBrowser.tabs[3], gBrowser.tabs[4]], { id: "not-saved-after-restore-1", label: "open-1" });
            gBrowser.addTabGroup([gBrowser.tabs[1], gBrowser.tabs[2]], { id: "not-saved-after-restore-2", label: "open-2" });

            let { TabStateFlusher } = ChromeUtils.importESModule("resource:///modules/sessionstore/TabStateFlusher.sys.mjs");
            TabStateFlusher.flushWindow(gBrowser.documentGlobal).then(resolve);
            """
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        self.assertEqual(
            self.marionette.execute_script(
                """
                return SessionStore.savedGroups.length;
                """
            ),
            2,
            "There are two saved groups in the default state before restoration",
        )

        self.marionette.execute_script(
            """
            SessionStore.restoreLastSession();
            """
        )
        self.wait_for_tabcount(5, "Waiting for 5 tabs")

        self.assertEqual(
            self.marionette.execute_script(
                """
                return SessionStore.savedGroups.length;
                """
            ),
            0,
            "The two saved groups should no longer be saved because they were restored to the tab strip",
        )

        tab_group_ids = set(
            self.marionette.execute_script(
                """
                return gBrowser.getAllTabGroups().map(tabGroup => tabGroup.id);
                """
            )
        )
        self.assertTrue(
            "not-saved-after-restore-1" in tab_group_ids,
            "the first saved tab group should now be in the tab strip",
        )
        self.assertTrue(
            "not-saved-after-restore-2" in tab_group_ids,
            "the second saved tab group should now be in the tab strip",
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
