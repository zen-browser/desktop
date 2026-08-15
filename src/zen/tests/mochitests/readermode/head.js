/* exported is_element_visible, is_element_hidden */

function is_element_visible(element, msg) {
  isnot(element, null, "Element should not be null, when checking visibility");
  ok(BrowserTestUtils.isVisible(element), msg || "Element should be visible");
}
function is_element_hidden(element, msg) {
  isnot(element, null, "Element should not be null, when checking visibility");
  ok(BrowserTestUtils.isHidden(element), msg || "Element should be hidden");
}
