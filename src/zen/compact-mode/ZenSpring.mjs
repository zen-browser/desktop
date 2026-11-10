/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Analytic damped-spring solver (unit mass). Parameterised like SwiftUI/Motion:
// `response` = undamped period in seconds, `dampingRatio` = ζ (1 = critical).
// Pure: no DOM, no Services — importable from node tests.

export const SETTLE_POSITION_PX = 0.5;
export const SETTLE_VELOCITY_PX_S = 1;
const MAX_DURATION_S = 10;
const SCAN_STEP_S = 1 / 240;
const CRITICAL_EPSILON = 1e-6;

// Defaults fitted to Arc's sidebar animations (see PR description); must match prefs/zen/compact-mode.yaml.
export const DEFAULT_SPRINGS = Object.freeze({
  show: Object.freeze({ response: 0.1, dampingRatio: 0.88 }),
  hide: Object.freeze({ response: 0.09, dampingRatio: 0.9 }),
  "peek-in": Object.freeze({ response: 0.16, dampingRatio: 0.82 }),
  "peek-out": Object.freeze({ response: 0.16, dampingRatio: 0.84 }),
});

function axis(omega0, zeta, x0, v0) {
  if (zeta < 1 - CRITICAL_EPSILON) {
    const a = zeta * omega0;
    const wd = omega0 * Math.sqrt(1 - zeta * zeta);
    const b = (v0 + a * x0) / wd;
    const c = (a * v0 + omega0 * omega0 * x0) / wd;
    return {
      x: t => Math.exp(-a * t) * (x0 * Math.cos(wd * t) + b * Math.sin(wd * t)),
      v: t => Math.exp(-a * t) * (v0 * Math.cos(wd * t) - c * Math.sin(wd * t)),
    };
  }
  if (zeta <= 1 + CRITICAL_EPSILON) {
    const b = v0 + omega0 * x0;
    return {
      x: t => Math.exp(-omega0 * t) * (x0 + b * t),
      v: t => Math.exp(-omega0 * t) * (v0 - omega0 * b * t),
    };
  }
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega0 * (zeta - s);
  const r2 = -omega0 * (zeta + s);
  const c2 = (v0 - r1 * x0) / (r2 - r1);
  const c1 = x0 - c2;
  return {
    x: t => c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t),
    v: t => c1 * r1 * Math.exp(r1 * t) + c2 * r2 * Math.exp(r2 * t),
  };
}

function broadcast(values, n) {
  return values.map(v => {
    if (!Array.isArray(v)) {
      return new Array(n).fill(v);
    }
    if (v.length !== n) {
      throw new RangeError(`ZenSpring: expected ${n} axes, got ${v.length}`);
    }
    return v;
  });
}

export function createSpring(
  { response, dampingRatio },
  { from, to, velocity = 0 }
) {
  if (!(response > 0)) {
    throw new RangeError("ZenSpring: response must be > 0");
  }
  if (!(dampingRatio > 0)) {
    throw new RangeError("ZenSpring: dampingRatio must be > 0");
  }
  const isVector = [from, to, velocity].some(Array.isArray);
  const n = Math.max(
    ...[from, to, velocity].map(v => (Array.isArray(v) ? v.length : 1))
  );
  const [f, target, v0] = broadcast([from, to, velocity], n);
  const omega0 = (2 * Math.PI) / response;
  const axes = target.map((goal, i) =>
    axis(omega0, dampingRatio, f[i] - goal, v0[i])
  );

  const settledAt = t =>
    axes.every(
      a =>
        Math.abs(a.x(t)) < SETTLE_POSITION_PX &&
        Math.abs(a.v(t)) < SETTLE_VELOCITY_PX_S
    );
  let settleTime = 0;
  for (let t = 0; t <= MAX_DURATION_S; t += SCAN_STEP_S) {
    if (!settledAt(t)) {
      settleTime = t + SCAN_STEP_S;
    }
  }
  settleTime = Math.min(settleTime, MAX_DURATION_S);

  const out = isVector ? arr => arr : arr => arr[0];
  return {
    settleTime,
    position(t) {
      if (t <= 0) {
        return out(f.slice());
      }
      if (t >= settleTime) {
        return out(target.slice());
      }
      return out(axes.map((a, i) => target[i] + a.x(t)));
    },
    velocity(t) {
      if (t >= settleTime && settleTime > 0) {
        return out(new Array(n).fill(0));
      }
      if (settleTime === 0) {
        return out(new Array(n).fill(0));
      }
      return out(axes.map(a => a.v(Math.max(0, t))));
    },
  };
}

export function bakeKeyframes(spring, fps = 120) {
  const duration = spring.settleTime;
  if (duration === 0) {
    return { keyframes: [spring.position(0)], duration: 0 };
  }
  const count = Math.max(2, Math.ceil(duration * fps));
  const keyframes = [];
  for (let i = 0; i <= count; i++) {
    keyframes.push(spring.position((i / count) * duration));
  }
  return { keyframes, duration };
}

const PREF_BASE = "zen.view.compact.animation";

function positiveFloat(prefs, name, fallback) {
  const value = parseFloat(prefs.getStringPref(name, String(fallback)));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function springFromPrefs(prefs, name) {
  const fallback = DEFAULT_SPRINGS[name];
  const base = `${PREF_BASE}.spring.${name}`;
  return {
    response: positiveFloat(prefs, `${base}.response`, fallback.response),
    dampingRatio: positiveFloat(
      prefs,
      `${base}.damping-ratio`,
      fallback.dampingRatio
    ),
  };
}

export function timeScaleFromPrefs(prefs) {
  return Math.max(0.01, positiveFloat(prefs, `${PREF_BASE}.time-scale`, 1));
}
