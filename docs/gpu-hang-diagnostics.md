<!--
   - This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/.
   -->

# Collecting GPU Hang Diagnostics on macOS

If Zen becomes sluggish and **Zen GPU Helper** keeps using substantial CPU, collect a sample before restarting it. A process using 100% CPU in macOS is using approximately one CPU core; this alone does not identify the cause or prove a hang.

## Capture the Busy Process

1. Open `about:processes` and find the **GPU** row. Record its process ID, memory use, and CPU use. Check whether the load persists when the browser is not doing graphics-intensive work.
2. In Activity Monitor, find **Zen GPU Helper** with that process ID and collect a [process sample](https://support.apple.com/guide/activity-monitor/actmntr2225/mac). Alternatively, run the following in Terminal, replacing `12345` with the recorded GPU process ID:

   ```sh
   /usr/bin/sample 12345 3 -file zen-gpu-sample.txt
   ```

3. Record the Zen version/build, macOS version, Mac model, and whether video, WebGL, multiple displays, extensions, Mods, or custom CSS were involved. Note when the problem started and any reliable steps that trigger it.
4. Review diagnostic files before sharing them. Remove personal paths, browsing URLs, account details, or other information unrelated to the report.

A sample can help distinguish shader compilation, rendering, and waiting threads. For example, an `OpenGLMT` stack containing `glpPPShaderLinearizeStreamMgrEx`, `BuildInterferenceSets`, and `BitSetNextSetBit` points to work inside Apple's OpenGL shader pipeline. It does not by itself establish whether the cause belongs to Zen, Firefox, a page or extension, or the graphics driver.

## Try Manual Recovery

Save work first: resetting the GPU process can reset WebGL contexts and briefly interrupt video or other graphics-dependent activity.

1. Try **Minimize memory usage** in `about:memory`, then check CPU use again. Memory cleanup may help memory pressure without resolving a busy graphics process.
2. If the GPU helper remains busy, use Activity Monitor to select the **Zen GPU Helper** process with the recorded ID and request [**Quit**](https://support.apple.com/guide/activity-monitor/actmntr1002/mac) from its stop control. Do not quit the main Zen process or an unrelated helper.
3. Check whether Zen starts a replacement GPU helper with a new process ID and whether CPU use settles. If the browser does not recover, restart Zen normally after saving any remaining work.

Recovery after replacing the helper is useful diagnostic evidence. It does not demonstrate that the underlying bug is fixed. Avoid automatic resets based only on CPU or memory thresholds: legitimate graphics work can also use substantial resources.

## Report the Result

Search [existing GPU-helper reports](https://github.com/zen-browser/desktop/issues?q=is%3Aissue+GPU+Helper+macOS) before opening a new issue. Include the sanitized sample, reproduction steps, environment, and whether memory minimization or replacing the GPU helper changed the behavior.

Follow the [bug report template](../.github/ISSUE_TEMPLATE/bug_report.yml), including checks with Mods/custom CSS removed and a comparison with stock Firefox. Use a separate test profile so these checks do not alter the working profile. State clearly which checks have not been performed; similar symptoms do not necessarily have the same cause.
