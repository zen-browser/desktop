/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Relative import: keeps the module loadable outside chrome:// URLs.
import { bakeKeyframes, createSpring } from "./ZenSpring.mjs";

// One element's `translate`, animated by WAAPI so it runs on the compositor.
// Retargets analytically from the current sample, so interrupting never jumps
// and velocity carries over. Leaves no inline style at rest.
// Spring time is read from the animation's own currentTime: the document
// timeline freezes while the refresh driver is idle, and startTime is left
// unset so the animation starts on the next frame (pending reads as 0).

export class SupersededError extends Error {
  constructor() {
    super("SidebarTransition: superseded");
    this.name = "SupersededError";
  }
}

const vec2 = v => (Array.isArray(v) ? [v[0] ?? 0, v[1] ?? 0] : [v, 0]);
const format = ([x, y]) => `${x}px ${y}px`;

export class SidebarTransition {
  #el;
  #animate;
  #timeScale;
  #reducedMotion;
  #fps;
  #onMovingChange;
  #moving = false;
  #value = [0, 0];
  #run = null; // { spring, scale, anim, reject, done, startTime }

  constructor(
    el,
    { animate, timeScale, reducedMotion, fps = 120, onMovingChange } = {}
  ) {
    this.#el = el;
    this.#animate =
      animate ??
      ((target, keyframes, options) => target.animate(keyframes, options));
    this.#timeScale = timeScale ?? (() => 1);
    this.#reducedMotion = reducedMotion ?? (() => false);
    this.#fps = fps;
    this.#onMovingChange = onMovingChange ?? (() => {});
  }

  // The logical position: the live sample while moving, otherwise the rest
  // value of the last moveTo/jumpTo/release. After jumpTo or release no
  // animation holds the element, so the DOM shows whatever the stylesheet
  // says, which is not necessarily this value.
  get value() {
    return this.sample().position;
  }

  get isAnimating() {
    return !!this.#run && !this.#run.done;
  }

  sample() {
    const run = this.#run;
    if (!run || run.done) {
      return { position: this.#value.slice(), velocity: [0, 0] };
    }
    const t = this.#elapsed(run);
    return {
      position: run.spring.position(t),
      velocity: run.spring.velocity(t),
    };
  }

  moveTo(to, { spring, from, velocity, holdAtEnd = false } = {}) {
    const current = this.sample();
    const target = vec2(to);
    const start = from === undefined ? current.position : vec2(from);
    const v0 = velocity === undefined ? current.velocity : vec2(velocity);
    const curve = createSpring(spring, {
      from: start,
      to: target,
      velocity: v0,
    });

    let resolve, reject;
    const settled = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    settled.catch(() => {});

    const previous = this.#run;
    if (this.#reducedMotion() || curve.settleTime === 0) {
      // Instant: no animation is left behind, so holdAtEnd does not apply.
      this.#run = null;
      this.#discard(previous);
      this.#value = target;
      this.#setMoving(false);
      resolve(target.slice());
      return { settled };
    }

    const scale = this.#timeScale();
    const { keyframes, duration } = bakeKeyframes(curve, this.#fps);
    const anim = this.#animate(
      this.#el,
      keyframes.map(p => ({ translate: format(p) })),
      { duration: duration * 1000 * scale, easing: "linear", fill: "forwards" }
    );
    const run = {
      spring: curve,
      scale,
      anim,
      reject,
      done: false,
      startTime: null,
    };
    this.#run = run;
    // After the new animation exists, so no frame is painted without one.
    this.#discard(previous);
    this.#setMoving(true);

    // Remember when it started, to sample it even after an external cancel.
    anim.ready?.then(
      () => (run.startTime = anim.startTime),
      () => {}
    );
    anim.finished.then(
      () => {
        if (this.#run !== run) {
          return;
        }
        run.done = true;
        this.#value = target;
        if (!holdAtEnd) {
          this.#run = null;
          anim.cancel();
          this.#setMoving(false);
        }
        resolve(target.slice());
      },
      () => {
        // Our own cancels detach the run first, so this one was cancelled by
        // someone else (e.g. getAnimations()): rest where it last was and
        // report it as superseded so its owner can clean up.
        if (this.#run !== run) {
          return;
        }
        this.#value = run.spring.position(this.#elapsed(run));
        this.#run = null;
        this.#setMoving(false);
        run.reject(new SupersededError());
      }
    );
    return { settled };
  }

  jumpTo(value) {
    const previous = this.#run;
    this.#run = null;
    this.#discard(previous);
    this.#value = vec2(value);
    this.#setMoving(false);
  }

  release() {
    const position = this.sample().position;
    const previous = this.#run;
    this.#run = null;
    this.#discard(previous);
    this.#value = position;
    this.#el.style.removeProperty("translate");
    this.#setMoving(false);
  }

  // Spring time of a run, in seconds. A cancelled animation reads a null
  // currentTime; reconstruct it from its timeline rather than reading 0.
  #elapsed(run) {
    let ms = run.anim.currentTime;
    if (ms === null || ms === undefined) {
      const now = run.anim.timeline?.currentTime;
      ms =
        run.startTime !== null && Number.isFinite(now)
          ? now - run.startTime
          : 0;
    }
    return Math.max(0, ms / 1000 / run.scale);
  }

  #setMoving(moving) {
    if (this.#moving === moving) {
      return;
    }
    this.#moving = moving;
    this.#onMovingChange(moving);
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
