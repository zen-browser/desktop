// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

pref("widget.gtk.rounded-bottom-corners.enabled", true);

// Enable transparent background for linux
#ifdef MOZ_WIDGET_GTK
pref('zen.widget.linux.transparency', false);

// VAAPI/FFMPEG is Linux only
pref('media.ffmpeg.vaapi.enabled', true);
pref('media.ffmpeg.encoder.enabled', true);
#endif
