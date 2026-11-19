add_task(async function test_zoom_tooltip() {
  const TEST_PAGE_URL = 'data:text/html,<html title="tooltiptext">';
  await BrowserTestUtils.withNewTab(TEST_PAGE_URL, async function (browser) {
    FullZoom.setZoom(2.0, browser);

    const tooltip = document.getElementById("remoteBrowserTooltip");
    const popupShown = new Promise(resolve => {
      tooltip.addEventListener("popupshown", resolve, { once: true });
    });

    // Fire a mousemove to trigger the tooltip.
    // Margin from the anchor and stuff depends on the platform, but these
    // should be big enough so that all platforms pass, but not big enough so
    // that it'd pass even when messing up the coordinates would.
    const DISTANCE = 300;
    const EPSILON = 25;

    EventUtils.synthesizeMouse(browser, DISTANCE, DISTANCE, {
      type: "mousemove",
    });

    await popupShown;
    ok(
      true,
      `popup should be shown (coords: ${tooltip.screenX}, ${tooltip.screenY})`
    );

    isfuzzy(
      tooltip.screenX,
      browser.screenX + DISTANCE,
      EPSILON,
      "Should be at the right x position, more or less"
    );
    isfuzzy(
      tooltip.screenY,
      browser.screenY + DISTANCE,
      EPSILON,
      "Should be at the right y position, more or less"
    );
  });
});
