# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys

# add this directory to the path
sys.path.append(os.path.dirname(__file__))

from session_store_test_case import SessionStoreTestCase, inline

POPUP_FEATURES = "chrome,dialog=no,resizable,toolbar=no"

# Mirrors the features string URILoadingHelper.sys.mjs's openInWindow()
# builds for a "chromeless" open (e.g. onboarding's where: "chromeless").
CHROMELESS_FEATURES = "chrome,dialog=no,resizable,minimizable,titlebar,close"

# Mirrors the features string browser.windows.create({type: "popup"})
# builds in ext-windows.js.
EXTENSION_POPUP_FEATURES = (
    "chrome,dialog,resizable,minimizable,titlebar,close,centerscreen"
)


class PopupWindowMismatchTestMixin:
    """
    Bug 2065228: restoreLastSession() reuses the current top window for the
    first window of the saved session whenever that window isn't tied to a
    __SS_lastSessionWindowID.

    A window's popup-ness is fixed by the `toolbar` native chrome flag at
    creation time and can't be changed afterwards, so reusing a mismatched
    window can never actually make it look like the restored session's window.
    Restoring the last session with a saved window whose popup-ness doesn't
    match the current top window should therefore open a new window instead of
    reusing it, leaving the top window untouched.
    """

    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=False,
            test_windows=set(),
        )


class TestRestoreLastSessionPopupIntoNormalWindow(
    PopupWindowMismatchTestMixin, SessionStoreTestCase
):
    def test_restore_last_session_popup_opens_new_window_instead_of_reusing_normal_top_window(
        self,
    ):
        self.replace_current_window({}, features=POPUP_FEATURES)
        self.open_tabs(
            self.marionette.current_chrome_window_handle, (inline("popup tab"),)
        )

        self.assertTrue(
            self.is_current_window_popup(),
            msg="Window should be a genuine popup before quitting",
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        startup_window = self.marionette.current_chrome_window_handle
        self.assertFalse(
            self.is_current_window_popup(),
            msg="Startup window should be a normal (non-popup) window",
        )
        startup_urls_before = self.get_urls_for_window(startup_window)

        self.restore_last_session()

        handles = self.marionette.chrome_window_handles
        self.assertEqual(
            len(handles),
            2,
            msg="Restoring a popup from last session should open a new window "
            "instead of reusing the mismatched normal startup window",
        )

        self.marionette.switch_to_window(startup_window)
        self.assertEqual(
            self.get_urls_for_window(startup_window),
            startup_urls_before,
            msg="Startup window's tabs should be untouched by the restore",
        )
        self.assertFalse(
            self.is_current_window_popup(),
            msg="Startup window should remain normal, not be turned into a popup",
        )

        [new_window] = [h for h in handles if h != startup_window]
        self.marionette.switch_to_window(new_window)
        self.assertTrue(
            self.is_current_window_popup(),
            msg="New window should be created as a popup to match the restored session",
        )
        self.wait_for_tab_urls(
            new_window,
            [inline("popup tab")],
            "New window should contain the restored popup's tab",
        )


class TestRestoreLastSessionNormalIntoPopupWindow(
    PopupWindowMismatchTestMixin, SessionStoreTestCase
):
    def test_restore_last_session_normal_window_opens_new_window_instead_of_reusing_popup_top_window(
        self,
    ):
        normal_window = self.marionette.current_chrome_window_handle
        self.open_tabs(normal_window, (inline("normal tab"),))

        self.assertFalse(
            self.is_current_window_popup(),
            msg="Window should be a normal (non-popup) window before quitting",
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        # Make the top window at restore time a popup instead of the
        # normal startup window.
        self.replace_current_window({}, features=POPUP_FEATURES)
        popup_top_window = self.marionette.current_chrome_window_handle
        self.assertTrue(
            self.is_current_window_popup(),
            msg="Top window at restore time should be a genuine popup",
        )
        popup_urls_before = self.get_urls_for_window(popup_top_window)

        self.restore_last_session()

        handles = self.marionette.chrome_window_handles
        self.assertEqual(
            len(handles),
            2,
            msg="Restoring a normal window from last session should open a "
            "new window instead of reusing the mismatched popup top window",
        )

        self.marionette.switch_to_window(popup_top_window)
        self.assertEqual(
            self.get_urls_for_window(popup_top_window),
            popup_urls_before,
            msg="Popup top window's tabs should be untouched by the restore",
        )
        self.assertTrue(
            self.is_current_window_popup(),
            msg="Popup top window should remain a popup, not be turned into a normal window",
        )

        [new_window] = [h for h in handles if h != popup_top_window]
        self.marionette.switch_to_window(new_window)
        self.assertFalse(
            self.is_current_window_popup(),
            msg="New window should be created as normal to match the restored session",
        )
        self.wait_for_tab_urls(
            new_window,
            [inline("normal tab")],
            "New window should contain the restored normal window's tab",
        )


class TestChromelessWindowSessionRestore(SessionStoreTestCase):
    """
    Bug 2066315: Ensure that chromeless windows are saved and restored as such.
    Ensure that manually restoring a chromeless window into a normal window
    does not try to convert the normal window into a chromless window.
    """

    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=False,
            test_windows=set(),
        )

    def test_window_state_records_chromeless_window(self):
        self.replace_current_window(
            {"chromeless-window": True},
            features=CHROMELESS_FEATURES,
        )

        state = self.get_sessionstore_window_state()
        self.assertTrue(
            state.get("args", {}).get("chromeless-window"),
            msg="SessionStore should record chromeless-window in the "
            "window's saved args",
        )

    def test_restored_new_window_gets_chromeless_window_attribute(self):
        self.replace_current_window(
            {"chromeless-window": True},
            features=CHROMELESS_FEATURES,
        )
        self.open_tabs(
            self.marionette.current_chrome_window_handle,
            (inline("chromeless tab"),),
        )
        second_chromeless = self.open_window_with_extra_options(
            {"chromeless-window": True},
            features=CHROMELESS_FEATURES,
        )
        self.marionette.switch_to_window(second_chromeless)
        self.open_tabs(second_chromeless, (inline("chromeless tab"),))

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        startup_window = self.marionette.current_chrome_window_handle

        self.restore_last_session()

        handles = self.marionette.chrome_window_handles
        self.assertEqual(
            len(handles),
            3,
            msg="Both saved chromeless windows should be restored into "
            "new windows, leaving the mismatched startup window in place",
        )

        new_windows = [h for h in handles if h != startup_window]
        self.assertEqual(len(new_windows), 2)
        for handle in new_windows:
            self.marionette.switch_to_window(handle)
            self.assertTrue(
                self.get_window_document_attribute("chromeless-window"),
                msg="Restored window should have the chromeless-window attribute set",
            )
            self.wait_for_tab_urls(
                handle,
                [inline("chromeless tab")],
                "Restored chromeless window should have its tab",
            )

    def test_deferred_restore_does_not_reuse_normal_top_window(self):
        self.replace_current_window(
            {"chromeless-window": True},
            features=CHROMELESS_FEATURES,
        )
        self.open_tabs(
            self.marionette.current_chrome_window_handle,
            (inline("chromeless tab"),),
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        startup_window = self.marionette.current_chrome_window_handle
        self.assertFalse(
            self.is_current_window_popup(),
            msg="Startup window should be a normal (non-popup) window",
        )
        startup_urls_before = self.get_urls_for_window(startup_window)

        self.restore_last_session()

        handles = self.marionette.chrome_window_handles
        self.assertEqual(
            len(handles),
            2,
            msg="Deferred restore of a chromeless-window should open a "
            "new window instead of reusing the normal startup window",
        )

        self.marionette.switch_to_window(startup_window)
        self.assertEqual(
            self.get_urls_for_window(startup_window),
            startup_urls_before,
            msg="Startup window's tabs should be untouched by the restore",
        )

        [new_window] = [h for h in handles if h != startup_window]
        self.marionette.switch_to_window(new_window)
        self.assertTrue(
            self.get_window_document_attribute("chromeless-window"),
            msg="New window should be restored as a chromeless-window",
        )


class TestWebExtensionPopupWindowSessionRestore(SessionStoreTestCase):
    """
    Bug 2066315: Ensure that WebExtension popup windows are saved and restored
    as such. Ensure that manually restoring a WebExtensions popup window into
    a normal window does not try to convert the normal window into a
    WebExtension popup window.
    """

    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=False,
            test_windows=set(),
        )

    def test_window_state_records_web_extension_popup_window(self):
        self.replace_current_window(
            {"web-extension-popup-window": True},
            features=EXTENSION_POPUP_FEATURES,
        )

        state = self.get_sessionstore_window_state()
        self.assertTrue(
            state.get("args", {}).get("web-extension-popup-window"),
            msg="SessionStore should record web-extension-popup-window in "
            "the window's saved args",
        )

    def test_restored_new_window_gets_web_extension_popup_window_attribute(self):
        self.replace_current_window(
            {"web-extension-popup-window": True},
            features=EXTENSION_POPUP_FEATURES,
        )
        self.open_tabs(
            self.marionette.current_chrome_window_handle,
            (inline("extension popup tab"),),
        )
        second_popup = self.open_window_with_extra_options(
            {"web-extension-popup-window": True},
            features=EXTENSION_POPUP_FEATURES,
        )
        self.marionette.switch_to_window(second_popup)
        self.open_tabs(second_popup, (inline("extension popup tab"),))

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        startup_window = self.marionette.current_chrome_window_handle

        self.restore_last_session()

        handles = self.marionette.chrome_window_handles
        self.assertEqual(
            len(handles),
            3,
            msg="Both saved popup windows should be restored into new "
            "windows, leaving the mismatched startup window in place",
        )

        new_windows = [h for h in handles if h != startup_window]
        self.assertEqual(len(new_windows), 2)
        for handle in new_windows:
            self.marionette.switch_to_window(handle)
            self.assertTrue(
                self.get_window_document_attribute("web-extension-popup-window"),
                msg="Restored window should have the "
                "web-extension-popup-window attribute set",
            )
            self.wait_for_tab_urls(
                handle,
                [inline("extension popup tab")],
                "Restored extension-popup window should have its tab",
            )

    def test_deferred_restore_does_not_reuse_normal_top_window(self):
        self.replace_current_window(
            {"web-extension-popup-window": True},
            features=EXTENSION_POPUP_FEATURES,
        )
        self.open_tabs(
            self.marionette.current_chrome_window_handle,
            (inline("extension popup tab"),),
        )

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        startup_window = self.marionette.current_chrome_window_handle
        self.assertFalse(
            self.is_current_window_popup(),
            msg="Startup window should be a normal (non-popup) window",
        )
        startup_urls_before = self.get_urls_for_window(startup_window)

        self.restore_last_session()

        handles = self.marionette.chrome_window_handles
        self.assertEqual(
            len(handles),
            2,
            msg="Deferred restore of a web-extension-popup-window should "
            "open a new window instead of reusing the normal startup window",
        )

        self.marionette.switch_to_window(startup_window)
        self.assertEqual(
            self.get_urls_for_window(startup_window),
            startup_urls_before,
            msg="Startup window's tabs should be untouched by the restore",
        )

        [new_window] = [h for h in handles if h != startup_window]
        self.marionette.switch_to_window(new_window)
        self.assertTrue(
            self.get_window_document_attribute("web-extension-popup-window"),
            msg="New window should be restored as a web-extension-popup-window",
        )


class TestPrivateWindowSessionRestore(SessionStoreTestCase):
    """
    Bug 829568: Don't restore the last session into an open private window.
    """

    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=False,
            test_windows=set(),
        )

    def test_restore_last_session_normal_window_opens_new_window_instead_of_reusing_private_top_window(
        self,
    ):
        normal_window = self.marionette.current_chrome_window_handle
        self.open_tabs(normal_window, (inline("normal tab"),))

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        # Make the top window at restore time a private window instead of
        # the normal startup window.
        private_window = self.open_window(private=True)
        self.marionette.close_chrome_window()
        self.marionette.switch_to_window(private_window)
        private_urls_before = self.get_urls_for_window(private_window)

        self.restore_last_session()

        handles = self.marionette.chrome_window_handles
        self.assertEqual(
            len(handles),
            2,
            msg="Restoring a normal window from the last session should open "
            "a new window instead of reusing the mismatched private top window",
        )

        self.marionette.switch_to_window(private_window)
        self.assertEqual(
            self.get_urls_for_window(private_window),
            private_urls_before,
            msg="Private top window's tabs should be untouched by the restore",
        )

        [new_window] = [h for h in handles if h != private_window]
        self.marionette.switch_to_window(new_window)
        self.assertFalse(
            self.is_current_window_popup(),
            msg="New window should be created as normal to match the restored session",
        )
        self.wait_for_tab_urls(
            new_window,
            [inline("normal tab")],
            "New window should contain the restored normal window's tab",
        )


# Mirrors the features string session_store_test_case.py's
# open_taskbartab_window() builds for a taskbar tab window.
TASKBARTAB_FEATURES = (
    "chrome,dialog=no,titlebar,close,toolbar,location,personalbar=no,"
    "status,menubar=no,resizable,minimizable"
)


class TestTaskbarTabWindowSessionRestore(SessionStoreTestCase):
    """
    Bug 1915738: Don't restore last session into an open taskbar tab window.
    """

    def setUp(self):
        super().setUp(
            startup_page=1,
            include_private=False,
            restore_on_demand=False,
            test_windows=set(),
        )

    def test_restore_last_session_normal_window_opens_new_window_instead_of_reusing_taskbar_tab_top_window(
        self,
    ):
        normal_window = self.marionette.current_chrome_window_handle
        self.open_tabs(normal_window, (inline("normal tab"),))

        self.marionette.quit()
        self.marionette.start_session()
        self.marionette.set_context("chrome")

        # Make the top window at restore time a taskbar tab window instead
        # of the normal startup window.
        self.replace_current_window({"taskbartab": True}, features=TASKBARTAB_FEATURES)
        taskbartab_window = self.marionette.current_chrome_window_handle
        self.assertTrue(
            self.get_window_document_attribute("taskbartab"),
            msg="Top window at restore time should be a genuine taskbar tab window",
        )
        taskbartab_urls_before = self.get_urls_for_window(taskbartab_window)

        self.restore_last_session()

        handles = self.marionette.chrome_window_handles
        self.assertEqual(
            len(handles),
            2,
            msg="Restoring a normal window from last session should open a new "
            "window instead of reusing the mismatched taskbar tab top window",
        )

        self.marionette.switch_to_window(taskbartab_window)
        self.assertEqual(
            self.get_urls_for_window(taskbartab_window),
            taskbartab_urls_before,
            msg="Taskbar tab top window's tabs should be untouched by the restore",
        )

        [new_window] = [h for h in handles if h != taskbartab_window]
        self.marionette.switch_to_window(new_window)
        self.assertFalse(
            self.is_current_window_popup(),
            msg="New window should be created as normal to match the restored session",
        )
        self.wait_for_tab_urls(
            new_window,
            [inline("normal tab")],
            "New window should contain the restored normal window's tab",
        )
