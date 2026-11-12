/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Writes a local mod's files into a temporary folder of its own.
 *
 * @param {Record<string, string>} files - Paths and contents
 * @param {object} style - What theme.json says about its styles
 * @returns {Promise<string>} The folder
 */
async function makeStyledMod(files, style) {
  const folder = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "zen-content-mod"
  );

  await IOUtils.writeJSON(PathUtils.join(folder, "theme.json"), {
    name: "Styled Mod",
    version: "1.0.0",
    style,
  });

  for (const [path, content] of Object.entries(files)) {
    const file = PathUtils.join(folder, ...path.split("/"));

    await IOUtils.makeDirectory(PathUtils.parent(file), {
      ignoreExisting: true,
    });
    await IOUtils.writeUTF8(file, content);
  }

  registerCleanupFunction(() =>
    IOUtils.remove(folder, { recursive: true, ignoreAbsent: true })
  );

  return folder;
}

add_task(async function test_page_styles() {
  const folder = await makeStyledMod(
    {
      "chrome.css": ':root { --zen-test-chrome: "chrome" !important; }',
      "css/userContent.css": ':root { --zen-test-page: "page" !important; }',
    },
    { chrome: "chrome.css", content: "css/userContent.css" }
  );
  const modId = await gZenModsManager.installLocalMod(folder);
  const mirror = PathUtils.join(gZenModsManager.modsRootPath, modId);

  ok(
    await IOUtils.exists(PathUtils.join(mirror, "css", "userContent.css")),
    "A local mod with page styles gets a copy in the profile, which pages can read"
  );
  await waitForRootValue(
    window,
    "--zen-test-chrome",
    '"chrome"',
    "Its styles for Zen apply"
  );

  await BrowserTestUtils.withNewTab(
    "data:text/html,<p>A page</p>",
    async browser => {
      const pageValue = () =>
        SpecialPowers.spawn(browser, [], () =>
          content
            .getComputedStyle(content.document.documentElement)
            .getPropertyValue("--zen-test-page")
            .trim()
        );

      await TestUtils.waitForCondition(
        async () => (await pageValue()) === '"page"',
        "Pages get the mod's page styles"
      );
      is(
        rootValue(window, "--zen-test-page"),
        "",
        "Zen's windows don't get them"
      );

      await BrowserTestUtils.withNewTab("about:preferences", async prefs => {
        const prefsValue = await SpecialPowers.spawn(prefs, [], () =>
          content
            .getComputedStyle(content.document.documentElement)
            .getPropertyValue("--zen-test-page")
            .trim()
        );

        is(
          prefsValue,
          "",
          "Nor privileged pages like about:preferences, the way out of a broken mod"
        );
      });

      await IOUtils.writeUTF8(
        PathUtils.join(folder, "css", "userContent.css"),
        ':root { --zen-test-page: "edited" !important; }'
      );
      await gZenModsManager.reloadLocalMod(modId);
      await TestUtils.waitForCondition(
        async () => (await pageValue()) === '"edited"',
        "Reloading the mod restyles the pages already open"
      );

      await gZenModsManager.setModEnabled(modId, false);
      await TestUtils.waitForCondition(
        async () => (await pageValue()) === "",
        "Turning it off takes its styles from the pages already open"
      );
    }
  );

  await gZenModsManager.uninstallMod(modId);

  ok(!(await IOUtils.exists(mirror)), "Removing the mod removes its copy");
  ok(await IOUtils.exists(folder), "And keeps the user's folder");
});

add_task(async function test_mods_cant_hide_the_fullscreen_warning() {
  const folder = await makeStyledMod(
    {
      "chrome.css": `
        :root { --zen-test-hider: "on" !important; }
        .pointerlockfswarning {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          filter: opacity(0) !important;
          transform: scale(0) !important;
          color: transparent !important;
          font-size: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
        }
      `,
    },
    "chrome.css"
  );
  const modId = await gZenModsManager.installLocalMod(folder);

  await waitForRootValue(
    window,
    "--zen-test-hider",
    '"on"',
    "The mod's styles apply"
  );

  const warning = document.getElementById("fullscreen-warning");

  warning.hidden = false;
  warning.showPopover();

  ok(warning.matches(":popover-open"), "The warning is open");
  info(
    "Rules: " +
      InspectorUtils.getMatchingCSSRules(warning)
        .map(rule => rule.parentStyleSheet?.href?.split("/").pop())
        .filter(Boolean)
        .join(", ")
  );

  const style = window.getComputedStyle(warning);

  is(style.display, "flex", "The fullscreen warning still shows");
  is(style.visibility, "visible", "It stays visible");
  is(style.opacity, "1", "And opaque");
  is(style.filter, "none", "Without filters");
  is(style.transform, "none", "Unshrunk");
  is(style.color, "rgb(250, 250, 250)", "Readable");
  is(style.fontSize, "21px", "At its size");
  is(style.overflow, "visible", "And uncut");

  warning.hidePopover();
  warning.hidden = true;
  await gZenModsManager.uninstallMod(modId);
});

add_task(async function test_removing_a_mod_keeps_the_browsers_preferences() {
  const browserPref = "zen.mods.auto-update-days";
  const folder = await makeStyledMod(
    {
      "chrome.css": ':root { --zen-test-prefs-mod: "on" !important; }',
      "preferences.json": JSON.stringify([
        { type: "number", property: browserPref, label: "Days" },
        { type: "string", property: "zen.test.mods.own", label: "Own" },
      ]),
    },
    "chrome.css"
  );
  const modId = await gZenModsManager.installLocalMod(folder);

  Services.prefs.setIntPref(browserPref, 7);
  Services.prefs.setStringPref("zen.test.mods.own", "set");
  registerCleanupFunction(() => Services.prefs.clearUserPref(browserPref));

  await gZenModsManager.uninstallMod(modId);

  is(
    Services.prefs.getIntPref(browserPref),
    7,
    "A preference the browser has keeps the user's value"
  );
  ok(
    !Services.prefs.prefHasUserValue("zen.test.mods.own"),
    "One only the mod had goes"
  );
});
