/* eslint-disable mozilla/no-arbitrary-setTimeout */

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({ set: [["ui.tooltip.delay_ms", 0]] });
});

add_task(async function test_title_in_shadow_dom() {
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser);

  info("Moving mouse out of the way.");
  await EventUtils.synthesizeAndWaitNativeMouseMove(
    tab.linkedBrowser,
    300,
    300
  );

  info("creating host");
  await SpecialPowers.spawn(tab.linkedBrowser, [], async function () {
    let doc = content.document;
    let host = doc.createElement("div");
    doc.body.appendChild(host);
    host.setAttribute("style", "position: absolute; top: 0; left: 0;");
    var sr = host.attachShadow({ mode: "closed" });
    sr.innerHTML =
      "<div title='shadow' style='width: 200px; height: 200px;'>shadow</div>";
  });

  let awaitTooltipOpen = new Promise(resolve => {
    let tooltipId = Services.appinfo.browserTabsRemoteAutostart
      ? "remoteBrowserTooltip"
      : "aHTMLTooltip";
    let tooltip = document.getElementById(tooltipId);
    tooltip.addEventListener(
      "popupshown",
      function (event) {
        resolve(event.target);
      },
      { once: true }
    );
  });
  info("Initial mouse move");
  await EventUtils.synthesizeAndWaitNativeMouseMove(tab.linkedBrowser, 50, 5);
  info("Waiting");
  await new Promise(resolve => setTimeout(resolve, 400));
  info("Second mouse move");
  await EventUtils.synthesizeAndWaitNativeMouseMove(tab.linkedBrowser, 70, 5);
  info("Waiting for tooltip to open");
  let tooltip = await awaitTooltipOpen;

  is(
    tooltip.getAttribute("label"),
    "shadow",
    "tooltip label should match expectation"
  );

  info("Closing tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_title_in_light_dom() {
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser);

  info("Moving mouse out of the way.");
  await EventUtils.synthesizeAndWaitNativeMouseMove(
    tab.linkedBrowser,
    300,
    300
  );

  info("creating host");
  await SpecialPowers.spawn(tab.linkedBrowser, [], async function () {
    let doc = content.document;
    let host = doc.createElement("div");
    host.title = "light";
    doc.body.appendChild(host);
    host.setAttribute("style", "position: absolute; top: 0; left: 0;");
    var sr = host.attachShadow({ mode: "closed" });
    sr.innerHTML = "<div style='width: 200px; height: 200px;'>shadow</div>";
  });

  let awaitTooltipOpen = new Promise(resolve => {
    let tooltipId = Services.appinfo.browserTabsRemoteAutostart
      ? "remoteBrowserTooltip"
      : "aHTMLTooltip";
    let tooltip = document.getElementById(tooltipId);
    tooltip.addEventListener(
      "popupshown",
      function (event) {
        resolve(event.target);
      },
      { once: true }
    );
  });
  info("Initial mouse move");
  await EventUtils.synthesizeAndWaitNativeMouseMove(tab.linkedBrowser, 50, 5);
  info("Waiting");
  await new Promise(resolve => setTimeout(resolve, 400));
  info("Second mouse move");
  await EventUtils.synthesizeAndWaitNativeMouseMove(tab.linkedBrowser, 70, 5);
  info("Waiting for tooltip to open");
  let tooltip = await awaitTooltipOpen;

  is(
    tooltip.getAttribute("label"),
    "light",
    "tooltip label should match expectation"
  );

  info("Closing tab");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_title_through_slot() {
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser);

  info("Moving mouse out of the way.");
  await EventUtils.synthesizeAndWaitNativeMouseMove(
    tab.linkedBrowser,
    300,
    300
  );

  info("creating host");
  await SpecialPowers.spawn(tab.linkedBrowser, [], async function () {
    let doc = content.document;
    let host = doc.createElement("div");
    host.title = "light";
    host.innerHTML = "<div style='width: 200px; height: 200px;'>light</div>";
    doc.body.appendChild(host);
    host.setAttribute("style", "position: absolute; top: 0; left: 0;");
    var sr = host.attachShadow({ mode: "closed" });
    sr.innerHTML =
      "<div title='shadow' style='width: 200px; height: 200px;'><slot></slot></div>";
  });

  let awaitTooltipOpen = new Promise(resolve => {
    let tooltipId = Services.appinfo.browserTabsRemoteAutostart
      ? "remoteBrowserTooltip"
      : "aHTMLTooltip";
    let tooltip = document.getElementById(tooltipId);
    tooltip.addEventListener(
      "popupshown",
      function (event) {
        resolve(event.target);
      },
      { once: true }
    );
  });
  info("Initial mouse move");
  await EventUtils.synthesizeAndWaitNativeMouseMove(tab.linkedBrowser, 50, 5);
  info("Waiting");
  await new Promise(resolve => setTimeout(resolve, 400));
  info("Second mouse move");
  await EventUtils.synthesizeAndWaitNativeMouseMove(tab.linkedBrowser, 70, 5);
  info("Waiting for tooltip to open");
  let tooltip = await awaitTooltipOpen;

  is(
    tooltip.getAttribute("label"),
    "shadow",
    "tooltip label should match expectation"
  );

  info("Closing tab");
  BrowserTestUtils.removeTab(tab);
});
