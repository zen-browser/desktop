# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from urllib.parse import quote

from marionette_harness import MarionetteTestCase, WindowManagerMixin


def inline(doc):
    return f"data:text/html;charset=utf-8,{quote(doc)}"


class TestRestoreLoadingPage(WindowManagerMixin, MarionetteTestCase):
    def setUp(self):
        super().setUp()
        self.delayed_page = self.marionette.absolute_url("slow")

    def do_test(self, html, is_restoring_expected):
        self.marionette.navigate(inline(html.format(self.delayed_page)))
        link = self.marionette.find_element("id", "link")
        link.click()

        self.marionette.restart(in_app=True)

        with self.marionette.using_context("chrome"):
            urls = self.marionette.execute_script(
                "return gBrowser.tabs.map(t => t.linkedBrowser.currentURI.spec);"
            )

        if is_restoring_expected:
            self.assertEqual(
                len(urls),
                2,
                msg="The tab opened should be restored",
            )
            self.assertEqual(
                urls[1],
                self.delayed_page,
                msg="The tab restored is correct",
            )
        else:
            self.assertEqual(
                len(urls),
                1,
                msg="The tab opened should not be restored",
            )

        self.close_all_tabs()

    def test_target_blank(self):
        self.do_test("<a id='link' href='{}' target='_blank'>click</a>", True)

    def test_target_other(self):
        self.do_test("<a id='link' href='{}' target='other'>click</a>", False)

    def test_by_script(self):
        self.do_test(
            """
            <a id='link'>click</a>
            <script>
            document.getElementById("link").addEventListener(
                "click",
                () => window.open("{}", "_blank");
            )
            </script>
            """,
            False,
        )
