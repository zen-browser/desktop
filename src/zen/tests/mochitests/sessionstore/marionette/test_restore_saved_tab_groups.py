# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys
from urllib.parse import quote

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from session_store_test_case import SessionStoreTestCase


def inline(doc):
    return f"data:text/html;charset=utf-8,{quote(doc)}"


class TestSessionRestoreSavedTabGroups(SessionStoreTestCase):
    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=True,
            resume_from_crash=True,
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

        self.marionette.set_prefs({
            # Setting to 0 forces about:sessionrestore to show after the first crash
            "browser.sessionstore.max_resumed_crashes": 0,
        })

    def test_saved_groups_kept_with_sessionrestore_page(self):
        self.wait_for_windows(
            self.all_windows, "Not all requested windows have been opened"
        )

        self.marionette.execute_async_script(
            """
            let resolve = arguments[0];
            (async () => {
                let [t0, t1] = gBrowser.tabs;
                let savedGroup1 = gBrowser.addTabGroup([t0, t1], { id: "saved-1", label: "Saved 1"});

                let { TabStateFlusher } = ChromeUtils.importESModule("moz-src:///browser/components/sessionstore/TabStateFlusher.sys.mjs");
                await TabStateFlusher.flush(t0.linkedBrowser);
                await TabStateFlusher.flush(t1.linkedBrowser);

                SessionStore.addSavedTabGroup(savedGroup1);

                const { SessionSaver } = ChromeUtils.importESModule(
                    "moz-src:///browser/components/sessionstore/SessionSaver.sys.mjs"
                );
                await gBrowser.removeTabGroup(savedGroup1);
                await SessionSaver.run();
                Services.prefs.savePrefFile(Services.dirsvc.get("PrefF", Ci.nsIFile));
            })().then(resolve);
            """
        )

        ids_before_crash = self.marionette.execute_script(
            "return SessionStore.getSavedTabGroups().map(g => g.id)"
        )
        self.assertIn("saved-1", ids_before_crash)

        self.marionette.quit(in_app=False)  # Simulate a crash
        self.marionette.start_session()  # Restart the browser
        self.marionette.set_context("chrome")
        self.marionette.execute_async_script(
            """
            let [resolve] = arguments;
            const { SessionStore } = ChromeUtils.importESModule(
                "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
            );
            SessionStore.promiseAllWindowsRestored.then(resolve);
            """
        )

        tab_count, url = self.marionette.execute_script(
            "return [gBrowser.tabs.length, gBrowser.selectedBrowser.currentURI.spec];"
        )
        self.assertEqual(tab_count, 1, "Only one tab is open after the crash")
        self.assertEqual(
            url, "about:sessionrestore", "about:sessionrestore is shown after the crash"
        )

        saved_group = self.marionette.execute_script(
            """
            let group = SessionStore.getSavedTabGroups().find(g => g.id == "saved-1");
            return group && { name: group.name, tabCount: group.tabs.length };
            """
        )
        self.assertIsNotNone(
            saved_group, "Saved group is kept when about:sessionrestore is shown"
        )
        self.assertEqual(
            saved_group["name"], "Saved 1", "Saved group contains correct label"
        )
        self.assertEqual(saved_group["tabCount"], 2, "Saved group keeps its tabs")
