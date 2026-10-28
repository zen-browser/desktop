// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  Subprocess: "resource://gre/modules/Subprocess.sys.mjs",
});

const VIDEO_CONFERENCE_REGEX =
  /https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:meet\.google\.com|zoom\.us|zoomgov\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|meet\.jit\.si|around\.co|whereby\.com|chime\.aws|gotomeeting\.com|bluejeans\.com|v\.ringcentral\.com|discord\.gg|discord\.com\/channels)\/[^\s"'<>]+/i;

const GENERIC_VIDEO_URL_REGEX =
  /https:\/\/[^\s"'<>]*(?:meet|zoom|teams|webex|jitsi|conference|call)[^\s"'<>]*/i;

export class ZenSystemCalendarProvider {
  #timer = null;
  #onMeetingCallback = null;
  #lastMeetings = [];
  detectedCalendars = new Set();

  constructor(onMeetingCallback) {
    this.#onMeetingCallback = onMeetingCallback;
  }

  init() {
    this.poll();
    this.getSystemCalendars().catch(() => {});
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
    this.#lastMeetings = [];
  }

  getDetectedCalendars() {
    return Array.from(this.detectedCalendars);
  }

  #extractVideoUrl(...fields) {
    for (const field of fields) {
      if (!field || typeof field !== "string") continue;
      const match =
        field.match(VIDEO_CONFERENCE_REGEX) ||
        field.match(GENERIC_VIDEO_URL_REGEX);
      if (match) {
        return match[0];
      }
    }
    return null;
  }

  async poll() {
    const isEnabled =
      Services.prefs.getBoolPref("zen.tab-intelligence.enabled", true) &&
      Services.prefs.getBoolPref(
        "zen.tab-intelligence.system-calendar.enabled",
        true
      );

    if (!isEnabled) {
      if (this.#lastMeetings.length > 0) {
        this.#lastMeetings = [];
        this.#onMeetingCallback?.([]);
      }
      return;
    }

    try {
      const meetings = await this.getImminentMeetings();
      const meetingsJson = JSON.stringify(meetings);
      const lastJson = JSON.stringify(this.#lastMeetings);

      if (meetingsJson !== lastJson) {
        this.#lastMeetings = meetings;
        this.#onMeetingCallback?.(meetings);
      }
    } catch {
      // Silent catch for OS calendar queries
    }
  }

  async getImminentMeeting() {
    const meetings = await this.getImminentMeetings();
    return meetings && meetings.length > 0 ? meetings[0] : null;
  }

  async getImminentMeetings() {
    const platform = Services.appinfo.OS;

    if (platform === "Darwin") {
      return this.#getImminentMeetingsMacOS();
    } else if (platform === "WINNT") {
      return this.#getImminentMeetingsWindows();
    } else if (platform === "Linux") {
      return this.#getImminentMeetingsLinux();
    }

    return [];
  }

  async getSystemCalendars() {
    const platform = Services.appinfo.OS;

    try {
      if (platform === "Darwin") {
        const script = `
          tell application "Calendar"
            set out to ""
            repeat with c in calendars
              try
                set out to out & (name of c as string) & "<||>"
              end try
            end repeat
            return out
          end tell
        `;
        const proc = await lazy.Subprocess.call({
          command: "/usr/bin/osascript",
          arguments: ["-e", script],
        });
        const stdout = await proc.stdout.readString();
        await proc.wait();
        if (stdout) {
          const names = stdout.split("<||>").map(s => s.trim()).filter(Boolean);
          for (const name of names) {
            this.detectedCalendars.add(name);
          }
        }
      } else if (platform === "WINNT") {
        const psScript = `
          try {
            $ol = New-Object -ComObject Outlook.Application -ErrorAction Stop
            $ns = $ol.GetNamespace("MAPI")
            $cal = $ns.GetDefaultFolder(9)
            $out = $cal.Name
            foreach ($f in $cal.Folders) {
              $out += "<||>" + $f.Name
            }
            Write-Output $out
          } catch {}
        `;
        const proc = await lazy.Subprocess.call({
          command: "powershell.exe",
          arguments: ["-NoProfile", "-NonInteractive", "-Command", psScript],
        });
        const stdout = await proc.stdout.readString();
        await proc.wait();
        if (stdout) {
          const names = stdout.split("<||>").map(s => s.trim()).filter(Boolean);
          for (const name of names) {
            this.detectedCalendars.add(name);
          }
        }
      } else if (platform === "Linux") {
        const khalPath = await lazy.Subprocess.pathSearch("khal").catch(() => null);
        if (khalPath) {
          const proc = await lazy.Subprocess.call({
            command: khalPath,
            arguments: ["printcalendars"],
          });
          const stdout = await proc.stdout.readString();
          await proc.wait();
          if (stdout) {
            const lines = stdout.split("\n").map(s => s.trim()).filter(Boolean);
            for (const name of lines) {
              this.detectedCalendars.add(name);
            }
          }
        }
      }
    } catch {
      // Ignore discovery errors
    }

    return Array.from(this.detectedCalendars);
  }

  async #getImminentMeetingsMacOS() {
    const script = `
      set output to ""
      tell application "Calendar"
        set now to current date
        set timeWindowStart to now - (10 * 60)
        set timeWindowEnd to now + (6 * 60)
        repeat with c in calendars
          try
            set cName to (name of c as string)
            set evs to (every event of c whose start date >= timeWindowStart and start date <= timeWindowEnd)
            repeat with e in evs
              set evSummary to (summary of e as string)
              set evStart to ((start date of e) - now)
              set evUrl to ""
              try
                set evUrl to (url of e as string)
              end try
              set evDesc to ""
              try
                set evDesc to (description of e as string)
              end try
              set evLoc to ""
              try
                set evLoc to (location of e as string)
              end try
              set output to output & evSummary & "<||>" & evStart & "<||>" & evUrl & "<||>" & evDesc & "<||>" & evLoc & "<||>" & cName & "<##>"
            end repeat
          end try
        end repeat
      end tell
      return output
    `;

    const meetings = [];
    try {
      const proc = await lazy.Subprocess.call({
        command: "/usr/bin/osascript",
        arguments: ["-e", script],
      });

      const stdout = await proc.stdout.readString();
      await proc.wait();

      if (!stdout || !stdout.trim()) return [];

      const entries = stdout.split("<##>").map(e => e.trim()).filter(Boolean);
      for (const entry of entries) {
        const [summary, secondsLeftStr, url, desc, loc, calName] = entry.split("<||>");
        const secondsLeft = parseFloat(secondsLeftStr);
        const minutesLeft = Math.ceil(secondsLeft / 60);

        if (calName) {
          this.detectedCalendars.add(calName);
        }

        // Strictly verify that there is a browser-openable video conference URL
        const videoUrl = this.#extractVideoUrl(url, desc, loc, summary);
        if (videoUrl && minutesLeft >= -5 && minutesLeft <= 5) {
          meetings.push({
            title: summary || "Meeting",
            videoUrl,
            minutesLeft: Math.max(0, minutesLeft),
            calendar: calName || "",
            isSystemCalendar: true,
          });
        }
      }
    } catch {
      // Permission denied or Calendar.app not available
    }

    return meetings;
  }

  async #getImminentMeetingsWindows() {
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
          $cName = $cal.Name
          try { if ($e.Parent -and $e.Parent.Name) { $cName = $e.Parent.Name } } catch {}
          Write-Output "$($e.Subject)<||>$mins<||>$($e.Location)<||>$($e.Body)<||>$cName<##>"
        }
      } catch {}
    `;

    const meetings = [];
    try {
      const proc = await lazy.Subprocess.call({
        command: "powershell.exe",
        arguments: ["-NoProfile", "-NonInteractive", "-Command", psScript],
      });

      const stdout = await proc.stdout.readString();
      await proc.wait();

      if (!stdout || !stdout.trim()) return [];

      const entries = stdout.split("<##>").map(e => e.trim()).filter(Boolean);
      for (const entry of entries) {
        const [summary, minutesLeftStr, location, body, calName] = entry.split("<||>");
        const minutesLeft = parseInt(minutesLeftStr, 10);

        if (calName) {
          this.detectedCalendars.add(calName);
        }

        // Strictly verify browser-openable video URL
        const videoUrl = this.#extractVideoUrl(location, body, summary);
        if (videoUrl && minutesLeft >= -5 && minutesLeft <= 5) {
          meetings.push({
            title: summary || "Meeting",
            videoUrl,
            minutesLeft: Math.max(0, minutesLeft),
            calendar: calName || "",
            isSystemCalendar: true,
          });
        }
      }
    } catch {
      // Not on Windows or Outlook not present
    }

    return meetings;
  }

  async #getImminentMeetingsLinux() {
    const meetings = [];
    try {
      const khalPath = await lazy.Subprocess.pathSearch("khal").catch(() => null);
      if (khalPath) {
        const proc = await lazy.Subprocess.call({
          command: khalPath,
          arguments: [
            "list",
            "now",
            "10m",
            "--format",
            "{title}<||>{start-time}<||>{description}<||>{location}<||>{calendar}<##>",
          ],
        });

        const stdout = await proc.stdout.readString();
        await proc.wait();

        if (stdout && stdout.trim()) {
          const entries = stdout.split("<##>").map(e => e.trim()).filter(Boolean);
          for (const entry of entries) {
            const [title, startTime, desc, loc, calName] = entry.split("<||>");
            if (calName) {
              this.detectedCalendars.add(calName);
            }

            const videoUrl = this.#extractVideoUrl(desc, loc, title);
            if (videoUrl) {
              meetings.push({
                title: title || "Meeting",
                videoUrl,
                minutesLeft: 5,
                calendar: calName || "",
                isSystemCalendar: true,
              });
            }
          }
        }
      }
    } catch {
      // khal not installed
    }

    return meetings;
  }
}
