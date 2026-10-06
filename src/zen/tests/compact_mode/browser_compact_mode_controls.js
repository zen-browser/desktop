/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function checkToolbarControls({
  expanded = true,
  spacing = 8,
  animate = true,
} = {}) {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.view.use-single-toolbar", false],
      ["zen.view.sidebar-expanded", expanded],
      ["zen.theme.content-element-separation", spacing],
      ["zen.tabs.vertical.right-side", false],
      ["zen.view.compact.enable-at-startup", false],
      ["zen.view.compact.hide-tabbar", true],
      ["zen.view.compact.hide-toolbar", false],
      ["zen.view.compact.animate-sidebar", animate],
    ],
  });

  await BrowserTestUtils.withNewTab("about:robots", async () => {
    const manager = gZenCompactModeManager;
    if (manager.preference) {
      const toggled = BrowserTestUtils.waitForEvent(
        window,
        "ZenCompactMode:Toggled"
      );
      manager.toggle(true);
      await toggled;
    }
    const controls = [
      gZenVerticalTabsManager.actualWindowButtons,
      document.getElementById("zen-sidebar-top-buttons-customization-target"),
    ];
    const layoutElements = [
      document.getElementById("titlebar"),
      document.getElementById("nav-bar-customization-target"),
    ];
    const navigation = ["back-button", "forward-button", "reload-button"].map(
      id => document.getElementById(id)
    );
    const compactButton = document.getElementById("zen-toggle-compact-mode");
    const customizations = [...controls[1].children];

    for (const direction of ["hide", "show", "hide", "show"]) {
      const initial = controls.map(element => ({
        bounds: element.getBoundingClientRect(),
        style: element.style.cssText,
      }));
      const layoutStyles = layoutElements.map(element => element.style.cssText);
      const samples = [];
      const initialButtonX = compactButton.getBoundingClientRect().x;
      const initialTabY = gBrowser.selectedTab.getBoundingClientRect().y;
      const initialNavigation = navigation.map(
        element => element.getBoundingClientRect().x
      );
      let finished = false;
      const sampling = new Promise(resolve => {
        function sample() {
          samples.push({
            controls: controls.map(element => element.getBoundingClientRect()),
            animating: manager.sidebar.hasAttribute("animate"),
            buttonX: compactButton.getBoundingClientRect().x,
            tabY: gBrowser.selectedTab.getBoundingClientRect().y,
            navigation: navigation.map(
              element => element.getBoundingClientRect().x
            ),
          });
          if (finished) {
            resolve();
          } else {
            requestAnimationFrame(sample);
          }
        }
        requestAnimationFrame(sample);
      });
      const toggled = BrowserTestUtils.waitForEvent(
        window,
        "ZenCompactMode:Toggled"
      );
      manager.toggle(true);
      await toggled;
      finished = true;
      await sampling;

      if (animate) {
        const animationSamples = samples.filter(sample => sample.animating);
        Assert.greater(
          animationSamples.length,
          0,
          `${direction} samples an active animation`
        );
        const expectedTabY =
          direction === "hide"
            ? initialTabY
            : gBrowser.selectedTab.getBoundingClientRect().y;
        Assert.lessOrEqual(
          Math.max(
            ...animationSamples.map(sample =>
              Math.abs(sample.tabY - expectedTabY)
            )
          ),
          0.5,
          `${direction} keeps sidebar content at the same height`
        );
      }
      Assert.lessOrEqual(
        Math.max(
          ...samples.map(sample => Math.abs(sample.buttonX - initialButtonX)),
          Math.abs(compactButton.getBoundingClientRect().x - initialButtonX)
        ),
        0.5,
        `${direction} keeps the compact-mode button in place`
      );
      navigation.forEach((element, index) => {
        const finalX = element.getBoundingClientRect().x;
        const positions = samples.map(sample => sample.navigation[index]);
        Assert.greaterOrEqual(
          Math.min(...positions),
          Math.min(initialNavigation[index], finalX) - 4,
          `${direction} keeps ${element.id} from overshooting left`
        );
        Assert.lessOrEqual(
          Math.max(...positions),
          Math.max(initialNavigation[index], finalX) + 4,
          `${direction} keeps ${element.id} from overshooting right`
        );
      });
      for (const element of customizations) {
        Assert.equal(
          element.parentElement,
          controls[1],
          `${direction} preserves toolbar items`
        );
      }
      for (let index = 0; index < controls.length; index++) {
        const displacement = Math.max(
          ...samples.map(sample =>
            Math.abs(sample.controls[index].x - initial[index].bounds.x)
          )
        );
        Assert.lessOrEqual(
          displacement,
          4,
          `${direction} keeps control ${index} in place`
        );
        Assert.lessOrEqual(
          Math.max(
            ...samples.map(sample =>
              Math.abs(sample.controls[index].y - initial[index].bounds.y)
            )
          ),
          0.5,
          `${direction} keeps control ${index} at the same height`
        );
        Assert.equal(
          controls[index].style.cssText,
          initial[index].style,
          `${direction} restores the control's original style`
        );
      }
      layoutElements.forEach((element, index) =>
        Assert.equal(
          element.style.cssText,
          layoutStyles[index],
          `${direction} restores ${element.id} styles`
        )
      );
    }
  });
  await SpecialPowers.popPrefEnv();
}

add_task(async function test_toolbar_controls_stay_in_place() {
  await checkToolbarControls();
});

add_task(async function test_collapsed_sidebar_controls() {
  await checkToolbarControls({ expanded: false });
});

add_task(async function test_custom_browser_spacing() {
  for (const spacing of [0, 12]) {
    await checkToolbarControls({ spacing });
  }
});

add_task(async function test_disabled_animation() {
  await checkToolbarControls({ animate: false });
});

add_task(async function test_rtl_does_not_compensate_toolbar() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.view.use-single-toolbar", false],
      ["zen.view.sidebar-expanded", true],
      ["zen.tabs.vertical.right-side", false],
      ["zen.view.compact.animate-sidebar", true],
      ["zen.view.compact.enable-at-startup", false],
    ],
  });
  const root = document.documentElement;
  const originalDirection = root.getAttribute("dir");
  root.setAttribute("dir", "rtl");
  try {
    await BrowserTestUtils.withNewTab("about:robots", async () => {
      const manager = gZenCompactModeManager;
      const elements = [
        [gZenVerticalTabsManager.actualWindowButtons, "transform"],
        [
          document.getElementById(
            "zen-sidebar-top-buttons-customization-target"
          ),
          "transform",
        ],
        [document.getElementById("titlebar"), "margin-top"],
        [
          document.getElementById("nav-bar-customization-target"),
          "margin-left",
        ],
      ];
      for (const direction of ["hide", "show"]) {
        const before = elements.map(([element, property]) =>
          element.style.getPropertyValue(property)
        );
        const toggled = BrowserTestUtils.waitForEvent(
          window,
          "ZenCompactMode:Toggled"
        );
        manager.toggle(true);
        await new Promise(resolve => requestAnimationFrame(resolve));
        Assert.ok(
          manager.sidebar.hasAttribute("animate"),
          "Samples the RTL animation"
        );
        elements.forEach(([element, property], index) =>
          Assert.equal(
            element.style.getPropertyValue(property),
            before[index],
            `${direction} preserves RTL ${property}`
          )
        );
        await toggled;
      }
    });
  } finally {
    if (originalDirection === null) {
      root.removeAttribute("dir");
    } else {
      root.setAttribute("dir", originalDirection);
    }
    await SpecialPowers.popPrefEnv();
  }
});
