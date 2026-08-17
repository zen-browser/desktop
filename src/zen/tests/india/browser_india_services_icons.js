/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { paintIndiaServiceIcons, indiaPanelHasRemoteIcons } =
  ChromeUtils.importESModule(
    "chrome://browser/content/zen-components/AstraIndiaServicesIcons.mjs"
  );

add_task(async function test_india_markup_has_no_remote_icon_urls() {
  const panel = document.getElementById("PanelUI-zen-india-gov");
  Assert.ok(panel, "India Services panel exists");
  Assert.ok(
    !indiaPanelHasRemoteIcons(panel),
    "India Services markup must not use remote favicon URLs"
  );
  for (const btn of panel.querySelectorAll(".zen-app-launcher-item")) {
    const style = btn.getAttribute("style") || "";
    Assert.ok(
      !/https?:/i.test(style),
      `${btn.getAttribute("data-url")} has no inline remote icon`
    );
  }
});

add_task(async function test_india_icons_use_local_pipeline() {
  const panel = document.getElementById("PanelUI-zen-india-gov");
  await paintIndiaServiceIcons(panel);

  const irctc = panel.querySelector('[data-app-id="irctc"]');
  Assert.ok(irctc, "IRCTC tile exists");
  const irctcImg = irctc.querySelector("img.zen-app-launcher-item-icon");
  Assert.ok(irctcImg, "IRCTC has a local image node");
  Assert.ok(
    irctcImg.src.startsWith("chrome://"),
    `IRCTC uses packaged chrome SVG, got ${irctcImg.src}`
  );

  const aadhaar = panel.querySelector('[data-app-id="aadhaar"]');
  Assert.ok(aadhaar, "Aadhaar tile exists");
  const mono = aadhaar.querySelector(".astra-app-hub-item-monogram");
  Assert.ok(mono, "Uncatalogued services fall back to a monogram");
  Assert.ok(
    !aadhaar.querySelector("img.zen-app-launcher-item-icon[src^='http']"),
    "Aadhaar must not load a remote image"
  );

  Assert.ok(
    !indiaPanelHasRemoteIcons(panel),
    "Painted India Services panel still has no remote icons"
  );
});
