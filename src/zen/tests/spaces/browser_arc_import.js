/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenArcMigrator } = ChromeUtils.importESModule(
  "resource:///modules/ZenArcMigrator.sys.mjs"
);

const MOCK_ARC_SIDEBAR = {
  version: 1,
  sidebar: {
    containers: [
      { global: {} },
      {
        spaces: [
          {
            id: "arc-space-1",
            title: "Work Space",
            customInfo: {
              iconType: { icon: "planet" },
              windowTheme: {
                background: {
                  single: {
                    _0: {
                      style: {
                        color: {
                          _0: {
                            blendedGradient: {
                              _0: {
                                baseColors: [
                                  { red: 0.9, green: 0.1, blue: 0.2, alpha: 1 },
                                  { red: 0.1, green: 0.8, blue: 0.3, alpha: 1 },
                                ],
                                modifiers: { noiseFactor: 0.5 },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            containerIDs: [
              "pinned",
              "pinned-container-1",
              "unpinned",
              "unpinned-container-1",
            ],
          },
        ],
        items: [
          {
            id: "item-pinned-tab-1",
            parentID: "pinned-container-1",
            title: "Docs",
            data: {
              tab: {
                savedTitle: "Docs",
                savedURL: "https://example.com/docs",
              },
            },
          },
          {
            id: "item-unpinned-tab-1",
            parentID: "unpinned-container-1",
            title: "Search",
            data: {
              tab: {
                savedTitle: "Search",
                savedURL: "https://example.com/search",
              },
            },
          },
        ],
      },
    ],
  },
};

add_task(async function test_arc_icon_mapping() {
  Assert.equal(ZenArcMigrator.mapArcIcon({ icon: "planet" }), "🪐", "Planet icon mapped");
  Assert.equal(ZenArcMigrator.mapArcIcon({ icon: "airplane" }), "✈️", "Airplane icon mapped");
  Assert.equal(ZenArcMigrator.mapArcIcon({ icon: "book" }), "📚", "Book icon mapped");
  Assert.equal(ZenArcMigrator.mapArcIcon("star"), "⭐", "Star icon string mapped");
});

add_task(async function test_arc_theme_conversion() {
  const customInfo = MOCK_ARC_SIDEBAR.sidebar.containers[1].spaces[0].customInfo;
  const theme = ZenArcMigrator.convertTheme(customInfo);

  Assert.equal(theme.type, "gradient", "Theme type is gradient");
  Assert.equal(theme.gradientColors.length, 2, "Has two gradient colors");
  Assert.equal(theme.texture, 0.5, "Texture matches Arc noiseFactor");

  const [c1, c2] = theme.gradientColors;
  Assert.deepEqual(c1.c, [230, 26, 51], "Base color 1 converted correctly");
  Assert.deepEqual(c2.c, [26, 204, 77], "Base color 2 converted correctly");
});

add_task(async function test_arc_sidebar_parsing() {
  const spaces = ZenArcMigrator.parseSidebar(MOCK_ARC_SIDEBAR);
  Assert.equal(spaces.length, 1, "Parsed exactly one space");

  const space = spaces[0];
  Assert.equal(space.name, "Work Space", "Space name matches");
  Assert.equal(space.icon, "🪐", "Space icon matches");
  Assert.equal(space.pinnedItems.length, 1, "Has 1 pinned item");
  Assert.equal(space.pinnedItems[0].url, "https://example.com/docs", "Pinned tab URL matches");
  Assert.equal(space.unpinnedItems.length, 1, "Has 1 unpinned item");
  Assert.equal(space.unpinnedItems[0].url, "https://example.com/search", "Unpinned tab URL matches");
});
