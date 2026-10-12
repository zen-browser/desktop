# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from urllib.parse import quote

from marionette_driver import Wait, errors
from marionette_driver.keys import Keys
from marionette_harness import MarionetteTestCase, WindowManagerMixin


def inline(doc):
    return f"data:text/html;charset=utf-8,{quote(doc)}"


# Each list element represents a window of tabs loaded at
# some testing URL
DEFAULT_WINDOWS = set([
    # Window 1. Note the comma after the inline call -
    # this is Python's way of declaring a 1 item tuple.
    (inline("""<div">Lorem</div>"""),),
    # Window 2
    (
        inline("""<div">ipsum</div>"""),
        inline("""<div">dolor</div>"""),
    ),
    # Window 3
    (
        inline("""<div">sit</div>"""),
        inline("""<div">amet</div>"""),
    ),
])


class SessionStoreTestCase(WindowManagerMixin, MarionetteTestCase):
    def setUp(
        self,
        startup_page=1,
        include_private=True,
        restore_on_demand=False,
        no_auto_updates=True,
        win_register_restart=False,
        test_windows=DEFAULT_WINDOWS,
        taskbartabs_enable=False,
    ):
        super().setUp()
        self.marionette.set_context("chrome")

        platform = self.marionette.session_capabilities["platformName"]
        self.accelKey = Keys.META if platform == "mac" else Keys.CONTROL

        self.test_windows = test_windows

        self.private_windows = set([
            (
                inline("""<div">consectetur</div>"""),
                inline("""<div">ipsum</div>"""),
            ),
            (
                inline("""<div">adipiscing</div>"""),
                inline("""<div">consectetur</div>"""),
            ),
        ])

        self.marionette.enforce_gecko_prefs({
            # Set browser restore previous session pref,
            # depending on what the test requires.
            "browser.startup.page": startup_page,
            # Make the content load right away instead of waiting for
            # the user to click on the background tabs
            "browser.sessionstore.restore_on_demand": restore_on_demand,
            # Avoid race conditions by having the content process never
            # send us session updates unless the parent has explicitly asked
            # for them via the TabStateFlusher.
            "browser.sessionstore.debug.no_auto_updates": no_auto_updates,
            # Whether to enable the register application restart mechanism.
            "toolkit.winRegisterApplicationRestart": win_register_restart,
            # Whether to enable taskbar tabs for this test
            "browser.taskbarTabs.enabled": taskbartabs_enable,
        })

        self.all_windows = self.test_windows.copy()
        self.open_windows(self.test_windows)

        if include_private:
            self.all_windows.update(self.private_windows)
            self.open_windows(self.private_windows, is_private=True)

    def tearDown(self):
        try:
            # Create a fresh profile for subsequent tests.
            self.marionette.restart(in_app=False, clean=True)
        finally:
            super().tearDown()

    def open_windows(self, window_sets, is_private=False):
        """Open a set of windows with tabs pointing at some URLs.

        @param window_sets (list)
               A set of URL tuples. Each tuple within window_sets
               represents a window, and each URL in the URL
               tuples represents what will be loaded in a tab.

               Note that if is_private is False, then the first
               URL tuple will be opened in the current window, and
               subequent tuples will be opened in new windows.

               Example:

               set(
                   (self.marionette.absolute_url('layout/mozilla_1.html'),
                    self.marionette.absolute_url('layout/mozilla_2.html')),

                   (self.marionette.absolute_url('layout/mozilla_3.html'),
                    self.marionette.absolute_url('layout/mozilla_4.html')),
               )

               This would take the currently open window, and load
               mozilla_1.html and mozilla_2.html in new tabs. It would
               then open a new, second window, and load tabs at
               mozilla_3.html and mozilla_4.html.
        @param is_private (boolean, optional)
               Whether or not any new windows should be a private browsing
               windows.
        """
        if is_private:
            win = self.open_window(private=True)
            self.marionette.switch_to_window(win)
        else:
            win = self.marionette.current_chrome_window_handle

        for index, urls in enumerate(window_sets):
            if index > 0:
                win = self.open_window(private=is_private)
                self.marionette.switch_to_window(win)
            self.open_tabs(win, urls)

    # Open a Firefox web app (taskbar tab) window
    def open_taskbartab_window(self):
        self.marionette.execute_async_script(
            """
            let [resolve] = arguments;
            (async () => {
                    let extraOptions = Cc["@mozilla.org/hash-property-bag;1"].createInstance(
                        Ci.nsIWritablePropertyBag2
                    );
                    extraOptions.setPropertyAsBool("taskbartab", true);

                    let args = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
                    args.appendElement(null);
                    args.appendElement(extraOptions);
                    args.appendElement(null);

                    // Simulate opening a taskbar tab window
                    let win = Services.ww.openWindow(
                        null,
                        AppConstants.BROWSER_CHROME_URL,
                        "_blank",
                        "chrome,dialog=no,titlebar,close,toolbar,location,personalbar=no,status,menubar=no,resizable,minimizable",
                        args
                    );
                    await new Promise(resolve => {
                        win.addEventListener("load", resolve, { once: true });
                    });
                    await win.delayedStartupPromise;
            })().then(resolve);
        """
        )

    # Helper function for taskbar tabs tests, opens a taskbar tab window,
    # closes the regular window, and reopens another regular window.
    # Firefox will then be in a "ready to restore" state
    def setup_taskbartab_restore_scenario(self):
        self.open_taskbartab_window()
        taskbar_tab_window_handle = self.marionette.close_chrome_window()[0]
        self.marionette.switch_to_window(taskbar_tab_window_handle)
        self.marionette.open(type="window")

    def open_window_with_extra_options(
        self, extra_options: dict, features="chrome,dialog=no,all"
    ):
        """Open a new browser window with the given extraOptions and
        features string, mirroring how real callers (WebExtensions
        windows.create, URILoadingHelper's "chromeless" open, taskbar
        tabs) build the arguments array passed to Services.ww.openWindow.

        @param extra_options (dict)
               Maps nsIWritablePropertyBag2 keys to bool/string values to
               set on the extraOptions bag passed as window.arguments[1].
        @param features (str)
               The chrome features string to open the window with.

        @return the new window's handle. Does not switch to it.
        """
        current_windows = set(self.marionette.chrome_window_handles)
        self.marionette.execute_async_script(
            """
            let [extraOptionsData, features, resolve] = arguments;
            (async () => {
                let extraOptions = Cc["@mozilla.org/hash-property-bag;1"].createInstance(
                    Ci.nsIWritablePropertyBag2
                );
                for (let [key, value] of Object.entries(extraOptionsData)) {
                    if (typeof value == "boolean") {
                        extraOptions.setPropertyAsBool(key, value);
                    } else {
                        extraOptions.setPropertyAsAString(key, value);
                    }
                }

                let args = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
                args.appendElement(null);
                args.appendElement(extraOptions);

                let win = Services.ww.openWindow(
                    null,
                    AppConstants.BROWSER_CHROME_URL,
                    "_blank",
                    features,
                    args
                );
                await new Promise(resolve => {
                    win.addEventListener("load", resolve, { once: true });
                });
                await win.delayedStartupPromise;
            })().then(resolve);
            """,
            script_args=[extra_options, features],
        )
        [new_window] = list(
            set(self.marionette.chrome_window_handles) - current_windows
        )
        return new_window

    def replace_current_window(
        self, extra_options: dict, features="chrome,dialog=no,all"
    ):
        """Open a new window like open_window_with_extra_options, close the
        current window, and switch to the new one so it becomes the sole
        (and top) open window."""
        new_window = self.open_window_with_extra_options(extra_options, features)
        self.marionette.close_chrome_window()
        self.marionette.switch_to_window(new_window)
        return new_window

    def get_window_document_attribute(self, name: str):
        """Returns the value of an attribute on the current window's
        `document.documentElement`."""
        return self.marionette.execute_script(
            "return document.documentElement.hasAttribute(arguments[0]);",
            script_args=[name],
        )

    def is_current_window_popup(self) -> bool:
        """Returns whether the current window is a popup window. This is based
        on the `window` itself, not based on SessionStore's state."""
        return self.marionette.execute_script(
            """
            return !window.toolbar.visible;
            """
        )

    def wait_for_fog(self):
        """Glean's blocking test APIs (testGetValue) park the main thread
        forever if Glean is still pre-init, and FOG is initialized from a
        startup idle task, so it can lag the point where the browser reports
        itself started up."""
        Wait(self.marionette, timeout=60).until(
            lambda _: self.marionette.execute_script(
                """
                return Services.fog.initialized;
                """
            ),
            message="FOG should be initialized before reading Glean metrics.",
        )

    def get_closed_windows(self) -> list:
        """Returns SessionStore.getClosedWindowData()."""
        return self.marionette.execute_script(
            """
            const { SessionStore } = ChromeUtils.importESModule(
                "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
            );
            return SessionStore.getClosedWindowData();
            """
        )

    def forget_closed_windows(self):
        """Forgets every window tracked by SessionStore.getClosedWindowData()."""
        self.marionette.execute_script(
            """
            const { SessionStore } = ChromeUtils.importESModule(
                "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
            );
            while (SessionStore.getClosedWindowCount() > 0) {
                SessionStore.forgetClosedWindow(0);
            }
            """
        )

    def get_sessionstore_window_state(self):
        return self.marionette.execute_script(
            """
            let { SessionStore } = ChromeUtils.importESModule(
                "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
            );
            return SessionStore.getWindowState(window).windows[0];
            """
        )

    def restore_last_session(self):
        """Executes SessionStore.restoreLastSession() to manually restore the
        last session."""
        self.marionette.execute_script(
            """
            const { SessionStore } = ChromeUtils.importESModule(
                "moz-src:///browser/components/sessionstore/SessionStore.sys.mjs"
            );
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
                SessionStore.restoreLastSession();
                await closedWindowsObserver;
            }
            return restoreSession();
            """
        )

    def open_tabs(self, win, urls):
        """Open a set of URLs inside a window in new tabs.

        @param win (browser window)
               The browser window to load the tabs in.
        @param urls (tuple)
               A tuple of URLs to load in this window. The
               first URL will be loaded in the currently selected
               browser tab. Subsequent URLs will be loaded in
               new tabs.
        """
        # If there are any remaining URLs for this window,
        # open some new tabs and navigate to them.
        with self.marionette.using_context("content"):
            if isinstance(urls, str):
                self.marionette.navigate(urls)
            else:
                for index, url in enumerate(urls):
                    if index > 0:
                        tab = self.open_tab()
                        self.marionette.switch_to_window(tab)
                    self.marionette.navigate(url)

    def wait_for_windows(self, expected_windows, message, timeout=5):
        current_windows = None

        def check(_):
            nonlocal current_windows
            current_windows = self.convert_open_windows_to_set()
            return current_windows == expected_windows

        try:
            wait = Wait(self.marionette, timeout=timeout, interval=0.1)
            wait.until(check, message=message)
        except errors.TimeoutException as e:
            # Update the message to include the most recent list of windows
            message = (
                f"{e.message}. Expected {expected_windows}, got {current_windows}."
            )
            raise errors.TimeoutException(message)

    def wait_for_tab_urls(self, win, expected_urls, message, timeout=20):
        """Wait until the given window's tabs match expected_urls exactly.

        Tab content can still be loading asynchronously after a
        restore has been completed, so callers that just triggered a
        restore should wait for this instead of reading
        get_urls_for_window() once immediately.
        """
        current_urls = None

        def check(_):
            nonlocal current_urls
            current_urls = self.get_urls_for_window(win)
            return current_urls == expected_urls

        try:
            wait = Wait(self.marionette, timeout=timeout, interval=0.1)
            wait.until(check, message=message)
        except errors.TimeoutException as e:
            message = f"{e.message}. Expected {expected_urls}, got {current_urls}."
            raise errors.TimeoutException(message)

    def get_urls_for_window(self, win):
        orig_handle = self.marionette.current_chrome_window_handle

        try:
            with self.marionette.using_context("chrome"):
                self.marionette.switch_to_window(win)
                return self.marionette.execute_script(
                    """
                  return gBrowser.tabs.map(tab => {
                    return tab.linkedBrowser.currentURI.spec;
                  });
                """
                )
        finally:
            self.marionette.switch_to_window(orig_handle)

    def convert_open_windows_to_set(self):
        # There's no guarantee that Marionette will return us an
        # iterator for the opened windows that will match the
        # order within our window list. Instead, we'll convert
        # the list of URLs within each open window to a set of
        # tuples that will allow us to do a direct comparison
        # while allowing the windows to be in any order.
        opened_windows = set()
        for win in self.marionette.chrome_window_handles:
            urls = tuple(self.get_urls_for_window(win))
            opened_windows.add(urls)

        return opened_windows

    def _close_window(self):
        """Use as a callback to `marionette.quit` in order to close the
        browser window.

        `marionette.close`/`marionette.close_chrome_window` cannot
        be used alone because they don't allow closing the last window.
        """

        self.marionette.execute_script("window.close()")

    def close_all_tabs_and_restart(self):
        self.close_all_tabs()
        self.marionette.quit(callback=self._close_window)
        self.marionette.start_session()

    def simulate_os_shutdown(self):
        """Simulate an OS shutdown.

        :raises: Exception: if not supported on the current platform
        :raises: WindowsError: if a Windows API call failed
        """
        if self.marionette.session_capabilities["platformName"] != "windows":
            raise Exception("Unsupported platform for simulate_os_shutdown")

        self._shutdown_with_windows_restart_manager(self.marionette.process_id)

    def _shutdown_with_windows_restart_manager(self, pid):
        """Shut down a process using the Windows Restart Manager.

        When Windows shuts down, it uses a protocol including the
        WM_QUERYENDSESSION and WM_ENDSESSION messages to give
        applications a chance to shut down safely. The best way to
        simulate this is via the Restart Manager, which allows a process
        (such as an installer) to use the same mechanism to shut down
        any other processes which are using registered resources.

        This function starts a Restart Manager session, registers the
        process as a resource, and shuts down the process.

        :param pid: The process id (int) of the process to shutdown

        :raises: WindowsError: if a Windows API call fails
        """
        import ctypes
        from ctypes import POINTER, WINFUNCTYPE, Structure, WinError, pointer, windll
        from ctypes.wintypes import BOOL, DWORD, HANDLE, LPCWSTR, UINT, ULONG, WCHAR

        # set up Windows SDK types
        OpenProcess = windll.kernel32.OpenProcess
        OpenProcess.restype = HANDLE
        OpenProcess.argtypes = [
            DWORD,  # dwDesiredAccess
            BOOL,  # bInheritHandle
            DWORD,
        ]  # dwProcessId
        PROCESS_QUERY_INFORMATION = 0x0400

        class FILETIME(Structure):
            _fields_ = [("dwLowDateTime", DWORD), ("dwHighDateTime", DWORD)]

        LPFILETIME = POINTER(FILETIME)

        GetProcessTimes = windll.kernel32.GetProcessTimes
        GetProcessTimes.restype = BOOL
        GetProcessTimes.argtypes = [
            HANDLE,  # hProcess
            LPFILETIME,  # lpCreationTime
            LPFILETIME,  # lpExitTime
            LPFILETIME,  # lpKernelTime
            LPFILETIME,
        ]  # lpUserTime

        ERROR_SUCCESS = 0

        class RM_UNIQUE_PROCESS(Structure):
            _fields_ = [("dwProcessId", DWORD), ("ProcessStartTime", FILETIME)]

        RmStartSession = windll.rstrtmgr.RmStartSession
        RmStartSession.restype = DWORD
        RmStartSession.argtypes = [
            POINTER(DWORD),  # pSessionHandle
            DWORD,  # dwSessionFlags
            POINTER(WCHAR),
        ]  # strSessionKey

        class GUID(ctypes.Structure):
            _fields_ = [
                ("Data1", ctypes.c_ulong),
                ("Data2", ctypes.c_ushort),
                ("Data3", ctypes.c_ushort),
                ("Data4", ctypes.c_ubyte * 8),
            ]

        CCH_RM_SESSION_KEY = ctypes.sizeof(GUID) * 2

        RmRegisterResources = windll.rstrtmgr.RmRegisterResources
        RmRegisterResources.restype = DWORD
        RmRegisterResources.argtypes = [
            DWORD,  # dwSessionHandle
            UINT,  # nFiles
            POINTER(LPCWSTR),  # rgsFilenames
            UINT,  # nApplications
            POINTER(RM_UNIQUE_PROCESS),  # rgApplications
            UINT,  # nServices
            POINTER(LPCWSTR),
        ]  # rgsServiceNames

        RM_WRITE_STATUS_CALLBACK = WINFUNCTYPE(None, UINT)
        RmShutdown = windll.rstrtmgr.RmShutdown
        RmShutdown.restype = DWORD
        RmShutdown.argtypes = [
            DWORD,  # dwSessionHandle
            ULONG,  # lActionFlags
            RM_WRITE_STATUS_CALLBACK,
        ]  # fnStatus

        RmEndSession = windll.rstrtmgr.RmEndSession
        RmEndSession.restype = DWORD
        RmEndSession.argtypes = [DWORD]  # dwSessionHandle

        # Get the info needed to uniquely identify the process
        hProc = OpenProcess(PROCESS_QUERY_INFORMATION, False, pid)
        if not hProc:
            raise WinError()

        creationTime = FILETIME()
        exitTime = FILETIME()
        kernelTime = FILETIME()
        userTime = FILETIME()
        if not GetProcessTimes(
            hProc,
            pointer(creationTime),
            pointer(exitTime),
            pointer(kernelTime),
            pointer(userTime),
        ):
            raise WinError()

        # Start the Restart Manager Session
        dwSessionHandle = DWORD()
        sessionKeyType = WCHAR * (CCH_RM_SESSION_KEY + 1)
        sessionKey = sessionKeyType()
        if RmStartSession(pointer(dwSessionHandle), 0, sessionKey) != ERROR_SUCCESS:
            raise WinError()

        try:
            UProcs_count = 1
            UProcsArrayType = RM_UNIQUE_PROCESS * UProcs_count
            UProcs = UProcsArrayType(RM_UNIQUE_PROCESS(pid, creationTime))

            # Register the process as a resource
            if (
                RmRegisterResources(
                    dwSessionHandle, 0, None, UProcs_count, UProcs, 0, None
                )
                != ERROR_SUCCESS
            ):
                raise WinError()

            # Shut down all processes using registered resources
            if (
                RmShutdown(
                    dwSessionHandle, 0, ctypes.cast(None, RM_WRITE_STATUS_CALLBACK)
                )
                != ERROR_SUCCESS
            ):
                raise WinError()

        finally:
            RmEndSession(dwSessionHandle)

    def windows_shutdown_with_variety(self, restart_by_os, expect_restore):
        """Test restoring windows after Windows shutdown.

        Opens a set of windows, both standard and private, with
        some number of tabs in them. Once the tabs have loaded, shuts down
        the browser with the Windows Restart Manager and restarts the browser.

        This specifically exercises the Windows synchronous shutdown mechanism,
        which terminates the process in response to the Restart Manager's
        WM_ENDSESSION message.

        If restart_by_os is True, the -os-restarted arg is passed when restarting,
        simulating being automatically restarted by the Restart Manager.

        If expect_restore is True, this ensures that the standard tabs have been
        restored, and that the private ones have not. Otherwise it ensures that
        no tabs and windows have been restored.
        """
        current_windows_set = self.convert_open_windows_to_set()
        self.assertEqual(
            current_windows_set,
            self.all_windows,
            msg=f"Not all requested windows have been opened. Expected {self.all_windows}, got {current_windows_set}.",
        )

        self.marionette.quit(callback=self.simulate_os_shutdown)

        saved_args = self.marionette.instance.app_args
        try:
            if restart_by_os:
                self.marionette.instance.app_args = ["-os-restarted"]

            self.marionette.start_session()
            self.marionette.set_context("chrome")
        finally:
            self.marionette.instance.app_args = saved_args

        if expect_restore:
            self.wait_for_windows(
                self.test_windows,
                "Non private browsing windows should have been restored",
            )
        else:
            self.assertEqual(
                len(self.marionette.chrome_window_handles),
                1,
                msg="Windows from last session shouldn`t have been restored.",
            )
            self.assertEqual(
                len(self.marionette.window_handles),
                1,
                msg="Tabs from last session shouldn`t have been restored.",
            )
