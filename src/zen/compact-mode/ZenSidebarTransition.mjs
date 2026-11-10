/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { bakeKeyframes, createSpring } from "./ZenSpring.mjs";

// One element's `translate`, animated by WAAPI so it runs on the compositor.
// Retargets analytically from the current sample, so interrupting never jumps
// and velocity carries over. Leaves no inline style at rest.

export class SupersededError extends Error {
  constructor() {
    super("SidebarTransition: superseded");
    this.name = "SupersededError";
  }
}

const vec2 = v => (Array.isArray(v) ? [v[0] ?? 0, v[1] ?? 0] : [v, 0]);
const defaultReportError = globalThis.reportError?.bind(globalThis) ?? (e => queueMicrotask(() => { throw e; }));
const format = ([x, y]) => `${x}px ${y}px`;

export class SidebarTransition {
  #el;
  #clock;
  #animate;
  #timeScale;
  #reducedMotion;
  #fps;
  #reportError;
  #value = [0, 0];
  #run = null; // { spring, startTime, scale, anim, reject, done }

  constructor(el, { clock, animate, timeScale, reducedMotion, fps = 120, reportError } = {}) {
    this.#el = el;
    this.#clock = clock ?? (() => el.ownerDocument.timeline.currentTime ?? performance.now());
    this.#animate = animate ?? ((target, keyframes, options) => target.animate(keyframes, options));
    this.#timeScale = timeScale ?? (() => 1);
    this.#reducedMotion = reducedMotion ?? (() => false);
    this.#fps = fps;
    this.#reportError = reportError ?? (e => defaultReportError(e));
  }

  get value() {
    return this.sample().position;
  }

  get isAnimating() {
    return !!this.#run && !this.#run.done;
  }

  sample(now = this.#clock()) {
    const run = this.#run;
    if (!run || run.done) {
      return { position: this.#value.slice(), velocity: [0, 0] };
    }
    const t = Math.max(0, (now - run.startTime) / 1000 / run.scale);
    return { position: run.spring.position(t), velocity: run.spring.velocity(t) };
  }

  moveTo(to, { spring, from, velocity, holdAtEnd = false, onSettle } = {}) {
    const now = this.#clock();
    const current = this.sample(now);
    const target = vec2(to);
    const start = from === undefined ? current.position : vec2(from);
    const v0 = velocity === undefined ? current.velocity : vec2(velocity);
    const curve = createSpring(spring, { from: start, to: target, velocity: v0 });

    let resolve, reject;
    const settled = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    settled.catch(() => {});

    const previous = this.#run;
    if (this.#reducedMotion() || curve.settleTime === 0) {
      this.#run = null;
      this.#discard(previous);
      this.#value = target;
      const error = this.#callSettle(onSettle, target);
      resolve(target.slice());
      if (error) {
        this.#reportError(error.e);
      }
      return { settled };
    }

    const scale = this.#timeScale();
    const { keyframes, duration } = bakeKeyframes(curve, this.#fps);
    const anim = this.#animate(
      this.#el,
      keyframes.map(p => ({ translate: format(p) })),
      { duration: duration * 1000 * scale, easing: "linear", fill: "forwards" }
    );
    anim.startTime = now;
    const run = { spring: curve, startTime: now, scale, anim, reject, done: false };
    this.#run = run;
    this.#discard(previous); // after the new animation exists: no frame without one

    anim.finished.then(
      () => {
        if (this.#run !== run) {
          return;
        }
        run.done = true;
        this.#value = target;
        const error = this.#callSettle(onSettle, target);
        if (!holdAtEnd) {
          this.#run = null;
          anim.cancel();
        }
        resolve(target.slice());
        if (error) {
          this.#reportError(error.e);
        }
      },
      () => {}
    );
    return { settled };
  }

  jumpTo(value) {
    const previous = this.#run;
    this.#run = null;
    this.#discard(previous);
    this.#value = vec2(value);
  }

  release() {
    const position = this.sample().position;
    const previous = this.#run;
    this.#run = null;
    this.#discard(previous);
    this.#value = position;
    this.#el.style.removeProperty("translate");
  }

  // Returns { e } if onSettle threw, so callers can finish cleanup first.
  #callSettle(onSettle, target) {
    try {
      onSettle?.(target.slice());
    } catch (e) {
      return { e };
    }
    return null;
  }

  #discard(run) {
    if (!run) {
      return;
    }
    if (!run.done) {
      run.reject(new SupersededError());
    }
    run.anim.cancel();
  }
}
