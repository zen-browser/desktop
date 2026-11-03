# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import time
from urllib.parse import quote

from marionette_harness import MarionetteTestCase, WindowManagerMixin


def inline(doc):
    return f"data:text/html;charset=utf-8,{quote(doc)}"


# The page blocks its content process for this long, which has to outlast the
# loose timer's first beat, one second into the shutdown flush.
CONTENT_BUSY_MS = 10000

# Give the navigation time to settle before the block starts, so that it is the
# shutdown flush that gets stuck rather than the test's own setup.
CONTENT_BUSY_DELAY_MS = 500

TIMED_OUT_PATTERN = r"looseTimer of \d+ timed out"


class TestShutdownFlushTimeout(WindowManagerMixin, MarionetteTestCase):
    """Shutdown races the window flushes against a loose timer, so that an
    unresponsive content process cannot stall quitting. This covers the timer
    winning that race, which only happens when its callback can reach the
    logger."""

    def setUp(self):
        super().setUp()
        self.marionette.enforce_gecko_prefs({
            "browser.sessionstore.loglevel": "Debug",
            "browser.sessionstore.log.appender.file.logOnSuccess": True,
            # The timer waits DELAY_CRASH_MS - 10000, so this brings it forward
            # to its first beat.
            "toolkit.asyncshutdown.crash_timeout": 10000,
        })

    def tearDown(self):
        try:
            # Create a fresh profile for subsequent tests.
            self.marionette.restart(in_app=False, clean=True)
        finally:
            super().tearDown()

    def getLogContents(self):
        profilePath = self.marionette.instance.profile.profile
        assert profilePath is not None
        dirPath = os.path.join(profilePath, "sessionstore-logs")
        if not os.path.isdir(dirPath):
            return ""
        contents = []
        for entry in os.scandir(dirPath):
            if entry.is_file():
                with open(entry.path) as f:
                    contents.append(f.read())
        return "\n".join(contents)

    def quitFromParent(self):
        with self.marionette.using_context("chrome"):
            self.marionette.execute_script(
                "Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);"
            )

    def test_flush_timeout_is_logged(self):
        # The page blocks its own content process shortly after loading, so the
        # parent cannot collect its tab state and the timer wins the race.
        with self.marionette.using_context("content"):
            self.marionette.navigate(
                inline(
                    "<script>"
                    f"setTimeout(() => {{ const end = Date.now() + {CONTENT_BUSY_MS};"
                    " while (Date.now() < end) {} }, "
                    f"{CONTENT_BUSY_DELAY_MS});"
                    "</script>"
                )
            )
        time.sleep((CONTENT_BUSY_DELAY_MS + 500) / 1000)

        self.marionette.quit(callback=self.quitFromParent)

        self.assertRegex(
            self.getLogContents(),
            TIMED_OUT_PATTERN,
            "The loose timer resolved the shutdown flush race",
        )

        self.marionette.start_session()
