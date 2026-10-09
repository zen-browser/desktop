// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Shared by the content actor and the settings page.

// A gesture is one or two strokes, joined by a dash. This is also the order
// the settings page lists them in.
export const GESTURES = [
  "left",
  "right",
  "up",
  "down",
  "down-right",
  "left-up",
  "right-up",
  "right-down",
  "up-left",
  "up-right",
  "down-left",
  "left-down",
  "up-down",
  "down-up",
  "left-right",
  "right-left",
];

export const MAX_STROKES = 2;

// Everything a gesture can be set to. Scrolling is done by the page's actor,
// the rest map to browser commands in ZenMouseGesturesParent.
export const ACTIONS = [
  "none",
  "back",
  "forward",
  "reload",
  "stop",
  "tab-prev",
  "tab-next",
  "new-tab",
  "close-tab",
  "restore-tab",
  "scroll-up",
  "scroll-down",
  "scroll-top",
  "scroll-bottom",
];

/**
 * @param {string} gesture One of GESTURES.
 * @returns {string} The pref holding the action for it.
 */
export function getGesturePref(gesture) {
  return `zen.mouse-gestures.action.${gesture}`;
}

const SVG_NS = "http://www.w3.org/2000/svg";

const kStrokeVectors = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

const ICON_SIZE = 24;
const SINGLE_STROKE_LENGTH = 16;
const DOUBLE_STROKE_LENGTH = 11;
const ARROW_HEAD_LENGTH = 4;
const U_TURN_WIDTH = 6;

const round = (number) => Math.round(number * 100) / 100;

/**
 * Draws a gesture as a line following its strokes, ending in an arrowhead.
 * The icon uses currentColor, so it follows the text color of where it is
 * put.
 *
 * @param {Document} doc The document the icon is going to be used in.
 * @param {string} gesture One of GESTURES.
 * @returns {SVGElement}
 */
export function createGestureIcon(doc, gesture) {
  const directions = gesture.split("-");
  const length =
    directions.length === 1 ? SINGLE_STROKE_LENGTH : DOUBLE_STROKE_LENGTH;

  let points = [[0, 0]];
  for (const [i, direction] of directions.entries()) {
    const [dx, dy] = kStrokeVectors[direction];
    const [x, y] = points.at(-1);
    const next = [x + dx * length, y + dy * length];
    points.push(next);
    // Going back the way it came would draw over the first stroke, so step
    // aside first to make a U-turn.
    if (i === 0 && directions[1]) {
      const [nx, ny] = kStrokeVectors[directions[1]];
      if (nx === -dx && ny === -dy) {
        points.push([next[0] - dy * U_TURN_WIDTH, next[1] + dx * U_TURN_WIDTH]);
      }
    }
  }
  // Center the line in the icon.
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const offsetX = ICON_SIZE / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
  const offsetY = ICON_SIZE / 2 - (Math.min(...ys) + Math.max(...ys)) / 2;
  points = points.map(([x, y]) => [x + offsetX, y + offsetY]);

  // The two sides of the arrowhead point back from the end of the line,
  // 45 degrees to either side of the direction it was going.
  const [dx, dy] = kStrokeVectors[directions.at(-1)];
  const [endX, endY] = points.at(-1);
  const cos = Math.SQRT1_2;
  const barbs = [cos, -cos].map((sin) => [
    endX - ARROW_HEAD_LENGTH * (dx * cos - dy * sin),
    endY - ARROW_HEAD_LENGTH * (dx * sin + dy * cos),
  ]);

  const line = points
    .map(([x, y], i) => `${i ? "L" : "M"}${round(x)} ${round(y)}`)
    .join(" ");
  const head = `M${round(barbs[0][0])} ${round(barbs[0][1])} L${round(endX)} ${round(endY)} L${round(barbs[1][0])} ${round(barbs[1][1])}`;

  const svg = doc.createElementNS(SVG_NS, "svg");
  for (const [name, value] of Object.entries({
    width: ICON_SIZE,
    height: ICON_SIZE,
    viewBox: `0 0 ${ICON_SIZE} ${ICON_SIZE}`,
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.8,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  })) {
    svg.setAttribute(name, value);
  }
  const path = doc.createElementNS(SVG_NS, "path");
  path.setAttribute("d", `${line} ${head}`);
  svg.appendChild(path);
  return svg;
}
