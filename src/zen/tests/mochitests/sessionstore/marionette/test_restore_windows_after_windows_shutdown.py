# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# add this directory to the path
import os
import sys

sys.path.append(os.path.dirname(__file__))

from session_store_test_case import SessionStoreTestCase

# We test the following combinations with simulated Windows shutdown:
# - Start page = restore session (expect restore in all cases)
#   - RAR (toolkit.winRegisterApplicationRestart) disabled
#   - RAR enabled, restarted manually
#
# - Start page = home
#   - RAR disabled (no restore)
#   - RAR enabled:
#     - restarted by OS (restore)
#     - restarted manually (no restore)


class TestWindowsShutdown(SessionStoreTestCase):
    def setUp(self):
        super().setUp(startup_page=3, no_auto_updates=False)

    def test_with_variety(self):
        """Test session restore selected by user."""
        self.windows_shutdown_with_variety(restart_by_os=False, expect_restore=True)


class TestWindowsShutdownRegisterRestart(SessionStoreTestCase):
    def setUp(self):
        super().setUp(startup_page=3, no_auto_updates=False, win_register_restart=True)

    def test_manual_restart(self):
        """Test that restore tabs works in case of register restart failure."""
        self.windows_shutdown_with_variety(restart_by_os=False, expect_restore=True)


class TestWindowsShutdownNormal(SessionStoreTestCase):
    def setUp(self):
        super().setUp(no_auto_updates=False)

    def test_with_variety(self):
        """Test that windows are not restored on a normal restart."""
        self.windows_shutdown_with_variety(restart_by_os=False, expect_restore=False)


class TestWindowsShutdownForcedSessionRestore(SessionStoreTestCase):
    def setUp(self):
        super().setUp(no_auto_updates=False, win_register_restart=True)

    def test_os_restart(self):
        """Test that register application restart restores the session."""
        self.windows_shutdown_with_variety(restart_by_os=True, expect_restore=True)

    def test_manual_restart(self):
        """Test that OS shutdown is ignored on manual start."""
        self.windows_shutdown_with_variety(restart_by_os=False, expect_restore=False)
