/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function checkToolbarControls({
  expanded = true,
  spacing = 8,
  animate = true,
  rightSide = false,
} = {}) {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.view.use-single-toolbar", false],
      ["zen.view.sidebar-expanded", expanded],
      ["zen.theme.content-element-separation", spacing],
      ["zen.tabs.vertical.right-side", rightSide],
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
      document.getElementById("nav-bar"),
      document.getElementById("zen-sidebar-top-buttons"),
    ];
    const navigation = ["back-button", "forward-button", "reload-button"].map(
      id => document.getElementById(id)
    );
    const toolbarElements = [
      ...navigation,
      document.getElementById("urlbar-container"),
      document.getElementById("PanelUI-button"),
    ];
    const toolbarBounds = () =>
      toolbarElements.map(element => element.getBoundingClientRect());
    const compactButton = document.getElementById("zen-toggle-compact-mode");
    const customizations = [...controls[1].children];
    const assertOriginalButtonOrder = direction => {
      if (!rightSide) {
        return;
      }
      const menu = document
        .getElementById("PanelUI-button")
        .getBoundingClientRect();
      const button = compactButton.getBoundingClientRect();
      const toggleInNavbar = manager.preference || !expanded;
      Assert.ok(
        toggleInNavbar ? button.right <= menu.x : menu.right <= button.x,
        `${direction} preserves the original ${toggleInNavbar ? "toggle then menu" : "menu then toggle"} order`
      );
    };

    for (const direction of ["hide", "show", "hide", "show"]) {
      const initial = controls.map(element => ({
        bounds: element.getBoundingClientRect(),
        style: element.style.cssText,
      }));
      const layoutStyles = layoutElements.map(element => element.style.cssText);
      const samples = [];
      const initialToolbar = toolbarBounds();
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
            toolbar: toolbarBounds(),
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
      let beforeCleanupButtonX;
      let beforeCleanupToolbar;
      const motion = gZenUIManager.motion;
      const animateElement = motion.animate;
      motion.animate = function (element, keyframes, options) {
        const animation = animateElement(element, keyframes, options);
        if (element !== manager.sidebar) {
          return animation;
        }
        return {
          then(onFulfilled, onRejected) {
            return animation.then(value => {
              beforeCleanupButtonX = compactButton.getBoundingClientRect().x;
              beforeCleanupToolbar = toolbarBounds();
              return onFulfilled(value);
            }, onRejected);
          },
        };
      };
      try {
        manager.toggle(true);
        await toggled;
      } finally {
        motion.animate = animateElement;
      }
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
      assertOriginalButtonOrder(direction);
      if (animate && rightSide) {
        toolbarBounds().forEach((bounds, index) => {
          for (const edge of ["x", "right"]) {
            const positions = samples.map(
              sample => sample.toolbar[index][edge]
            );
            Assert.ok(
              Math.min(...positions) >=
                Math.min(initialToolbar[index][edge], bounds[edge]) - 1 &&
                Math.max(...positions) <=
                  Math.max(initialToolbar[index][edge], bounds[edge]) + 1,
              `${direction} keeps ${toolbarElements[index].id} ${edge} within its endpoints`
            );
            Assert.lessOrEqual(
              Math.abs(beforeCleanupToolbar[index][edge] - bounds[edge]),
              1,
              `${direction} reaches ${toolbarElements[index].id} ${edge} before cleanup`
            );
          }
        });
      }
      const finalButtonX = compactButton.getBoundingClientRect().x;
      if (animate && rightSide) {
        Assert.lessOrEqual(
          Math.abs(beforeCleanupButtonX - finalButtonX),
          4,
          `${direction} reaches the compact-mode button's destination before cleanup`
        );
      }
      Assert.greaterOrEqual(
        Math.min(...samples.map(sample => sample.buttonX)),
        Math.min(initialButtonX, finalButtonX) - 0.5,
        `${direction} keeps the compact-mode button from overshooting left`
      );
      Assert.lessOrEqual(
        Math.max(...samples.map(sample => sample.buttonX)),
        Math.max(initialButtonX, finalButtonX) + 0.5,
        `${direction} keeps the compact-mode button from overshooting right`
      );
      if (!rightSide) {
        Assert.lessOrEqual(
          Math.abs(finalButtonX - initialButtonX),
          0.5,
          `${direction} keeps the compact-mode button in place`
        );
      }
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
        const finalX = controls[index].getBoundingClientRect().x;
        const positions = samples.map(sample => sample.controls[index].x);
        if (!rightSide) {
          Assert.lessOrEqual(
            Math.max(
              ...positions.map(x => Math.abs(x - initial[index].bounds.x))
            ),
            4,
            `${direction} keeps control ${index} in place`
          );
        }
        Assert.greaterOrEqual(
          Math.min(...positions),
          Math.min(initial[index].bounds.x, finalX) - 4,
          `${direction} keeps control ${index} from overshooting left`
        );
        Assert.lessOrEqual(
          Math.max(...positions),
          Math.max(initial[index].bounds.x, finalX) + 4,
          `${direction} keeps control ${index} from overshooting right`
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

add_task(async function test_right_sidebar_controls() {
  await checkToolbarControls({ rightSide: true });
});

add_task(async function test_collapsed_right_sidebar_controls() {
  await checkToolbarControls({ rightSide: true, expanded: false });
});

add_task(async function test_custom_browser_spacing() {
  for (const rightSide of [false, true]) {
    for (const spacing of [0, 12]) {
      await checkToolbarControls({ spacing, rightSide });
    }
  }
});

add_task(async function test_disabled_animation() {
  for (const rightSide of [false, true]) {
    await checkToolbarControls({ animate: false, rightSide });
  }
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
