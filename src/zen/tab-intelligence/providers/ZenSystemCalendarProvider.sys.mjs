// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  Subprocess: "resource://gre/modules/Subprocess.sys.mjs",
});

const VIDEO_CONFERENCE_REGEX =
  /https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:meet\.google\.com\/[a-z0-9-]+|zoom\.us\/j\/\d+[^\s"'<>]*|teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+|webex\.com\/[^\s"'<>]+|meet\.jit\.si\/[^\s"'<>]+)/i;

export class ZenSystemCalendarProvider {
  #timer = null;
  #onMeetingCallback = null;
  #lastMeeting = null;

  constructor(onMeetingCallback) {
    this.#onMeetingCallback = onMeetingCallback;
  }

  init() {
    this.poll();
    this.#timer = Services.tm.dispatch(
      () => {},
      Services.tm.DISPATCH_NORMAL
    );
    // Poll every 60 seconds
    this.#startPollingInterval();
  }

  #startPollingInterval() {
    if (this.#timer) {
      clearInterval(this.#timer);
    }
    this.#timer = setInterval(() => {
      this.poll();
    }, 60000);
  }

  uninit() {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    this.#lastMeeting = null;
  }

  async poll() {
    const isEnabled =
      Services.prefs.getBoolPref("zen.tab-intelligence.enabled", true) &&
      Services.prefs.getBoolPref(
        "zen.tab-intelligence.system-calendar.enabled",
        true
      );

    if (!isEnabled) {
      if (this.#lastMeeting) {
        this.#lastMeeting = null;
        this.#onMeetingCallback?.(null);
      }
      return;
    }

    try {
      const meeting = await this.getImminentMeeting();
      const meetingJson = JSON.stringify(meeting);
      const lastJson = JSON.stringify(this.#lastMeeting);

      if (meetingJson !== lastJson) {
        this.#lastMeeting = meeting;
        this.#onMeetingCallback?.(meeting);
      }
    } catch (e) {
      // Silent catch for OS calendar queries
    }
  }

  async getImminentMeeting() {
    const platform = Services.appinfo.OS;

    if (platform === "Darwin") {
      return this.#getImminentMeetingMacOS();
    } else if (platform === "WINNT") {
      return this.#getImminentMeetingWindows();
    } else if (platform === "Linux") {
      return this.#getImminentMeetingLinux();
    }

    return null;
  }

  async #getImminentMeetingMacOS() {
    // AppleScript querying Calendar.app events starting today
    const script = `
      set output to ""
      tell application "Calendar"
        set now to current date
        set timeWindowStart to now - (10 * 60)
        set timeWindowEnd to now + (6 * 60)
        repeat with c in calendars
          try
            set evs to (every event of c whose start date >= timeWindowStart and start date <= timeWindowEnd)
            repeat with e in evs
              set evSummary to (summary of e)
              set evStart to ((start date of e) - now)
              set evUrl to ""
              try
                set evUrl to (url of e as string)
              end try
              set evDesc to ""
              try
                set evDesc to (description of e as string)
              end try
              set output to output & evSummary & "<||>" & evStart & "<||>" & evUrl & "<||>" & evDesc & "<##>"
            end repeat
          end try
        end repeat
      end tell
      return output
    `;

    try {
      const proc = await lazy.Subprocess.call({
        command: "/usr/bin/osascript",
        arguments: ["-e", script],
      });

      const stdout = await proc.stdout.readString();
      await proc.wait();

      if (!stdout || !stdout.trim()) return null;

      const entries = stdout.split("<##>").map(e => e.trim()).filter(Boolean);
      for (const entry of entries) {
        const [summary, secondsLeftStr, url, desc] = entry.split("<||>");
        const secondsLeft = parseFloat(secondsLeftStr);
        const minutesLeft = Math.ceil(secondsLeft / 60);

        const videoMatch =
          url?.match(VIDEO_CONFERENCE_REGEX) ||
          desc?.match(VIDEO_CONFERENCE_REGEX) ||
          summary?.match(VIDEO_CONFERENCE_REGEX);

        if (videoMatch && minutesLeft >= -5 && minutesLeft <= 5) {
          return {
            title: summary || "Meeting",
            videoUrl: videoMatch[0],
            minutesLeft: Math.max(0, minutesLeft),
            isSystemCalendar: true,
          };
        }
      }
    } catch {
      // Permission denied or Calendar.app not available
    }

    return null;
  }

  async #getImminentMeetingWindows() {
    // PowerShell querying Outlook.Application if available
    const psScript = `
      $now = Get-Date
      $start = $now.AddMinutes(-5)
      $end = $now.AddMinutes(5)
      try {
        $ol = New-Object -ComObject Outlook.Application -ErrorAction Stop
        $ns = $ol.GetNamespace("MAPI")
        $cal = $ns.GetDefaultFolder(9)
        $items = $cal.Items
        $items.IncludeRecurrences = $true
        $items.Sort("[Start]")
        $filter = "[Start] >= '$($start.ToString("g"))' and [Start] <= '$($end.ToString("g"))'"
        $filtered = $items.Restrict($filter)
        foreach ($e in $filtered) {
          $mins = [Math]::Ceiling(($e.Start - $now).TotalMinutes)
          Write-Output "$($e.Subject)<||>$mins<||>$($e.Location)<||>$($e.Body)<##>"
        }
      } catch {}
    `;

    try {
      const proc = await lazy.Subprocess.call({
        command: "powershell.exe",
        arguments: ["-NoProfile", "-NonInteractive", "-Command", psScript],
      });

      const stdout = await proc.stdout.readString();
      await proc.wait();

      if (!stdout || !stdout.trim()) return null;

      const entries = stdout.split("<##>").map(e => e.trim()).filter(Boolean);
      for (const entry of entries) {
        const [summary, minutesLeftStr, location, body] = entry.split("<||>");
        const minutesLeft = parseInt(minutesLeftStr, 10);

        const videoMatch =
          location?.match(VIDEO_CONFERENCE_REGEX) ||
          body?.match(VIDEO_CONFERENCE_REGEX) ||
          summary?.match(VIDEO_CONFERENCE_REGEX);

        if (videoMatch && minutesLeft >= -5 && minutesLeft <= 5) {
          return {
            title: summary || "Meeting",
            videoUrl: videoMatch[0],
            minutesLeft: Math.max(0, minutesLeft),
            isSystemCalendar: true,
          };
        }
      }
    } catch {
      // Not on Windows or Outlook not present
    }

    return null;
  }

  async #getImminentMeetingLinux() {
    // Linux: check via khal or gdbus if available
    try {
      const khalPath = await lazy.Subprocess.pathSearch("khal").catch(() => null);
      if (khalPath) {
        const proc = await lazy.Subprocess.call({
          command: khalPath,
          arguments: ["list", "now", "10m", "--format", "{title}<||>{start-time}<||>{description}<##>"],
        });

        const stdout = await proc.stdout.readString();
        await proc.wait();

        if (stdout && stdout.trim()) {
          const entries = stdout.split("<##>").map(e => e.trim()).filter(Boolean);
          for (const entry of entries) {
            const [title, startTime, desc] = entry.split("<||>");
            const videoMatch = desc?.match(VIDEO_CONFERENCE_REGEX) || title?.match(VIDEO_CONFERENCE_REGEX);
            if (videoMatch) {
              return {
                title: title || "Meeting",
                videoUrl: videoMatch[0],
                minutesLeft: 5,
                isSystemCalendar: true,
              };
            }
          }
        }
      }
    } catch {
      // khal not installed
    }

    return null;
  }
}
