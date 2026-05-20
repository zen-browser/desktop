/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenThemePicker } from "resource:///modules/zen/ZenGradientGenerator.mjs";

/** @type {Readonly<Record<string, { id: string, name: string, icon: string, colors: string[], opacity?: number }>>} */
export const ASTRA_SPACE_PRESETS = Object.freeze({
  study: {
    id: "study",
    name: "Study",
    icon: "📚",
    colors: ["#2563EB", "#0F172A", "#38BDF8"],
    opacity: 0.52,
  },
  work: {
    id: "work",
    name: "Work",
    icon: "💼",
    colors: ["#7C3AED", "#1E1B4B", "#A78BFA"],
    opacity: 0.5,
  },
  personal: {
    id: "personal",
    name: "Personal",
    icon: "🏠",
    colors: ["#059669", "#064E3B", "#34D399"],
    opacity: 0.48,
  },
  fun: {
    id: "fun",
    name: "Fun",
    icon: "🎬",
    colors: ["#DB2777", "#4C0519", "#F472B6"],
    opacity: 0.55,
  },
  banking: {
    id: "banking",
    name: "Banking",
    icon: "🪙",
    colors: ["#EA580C", "#431407", "#FBBF24"],
    opacity: 0.5,
  },
});

/**
 * @param {typeof ASTRA_SPACE_PRESETS[string]} preset
 */
export function themeFromSpacePreset(preset) {
  const gradientColors = preset.colors.map((hex, index) => ({
    c: hex,
    isCustom: true,
    isPrimary: index === 0,
  }));
  return nsZenThemePicker.getTheme(
    gradientColors,
    preset.opacity ?? 0.5,
    0
  );
}

export function getSpacePreset(presetId) {
  return ASTRA_SPACE_PRESETS[presetId] || null;
}
