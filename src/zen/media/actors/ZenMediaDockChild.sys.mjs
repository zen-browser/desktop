// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ContentDOMReference: "resource://gre/modules/ContentDOMReference.sys.mjs",
});

/**
 * Finds the <video> in a frame that the sidebar media card should show. The
 * card then clones it with the Picture-in-Picture player machinery, which
 * needs a ContentDOMReference that only the content process can create.
 */
export class ZenMediaDockChild extends JSWindowActorChild {
  receiveMessage(message) {
    switch (message.name) {
      case "ZenMediaDock:FindVideo":
        return this.#findVideo();
    }
    return null;
  }

  /**
   * Same heuristic as PictureInPictureLauncherChild.findVideoToPiP: the
   * first playing video, otherwise the longest one, so short previews
   * elsewhere on the page are skipped.
   *
   * @returns {object|null} The video reference and its intrinsic size.
   */
  #findVideo() {
    const doc = this.document;
    if (!doc) {
      return null;
    }

    const respectDisabled = Services.prefs.getBoolPref(
      "media.videocontrols.picture-in-picture.respect-disablePictureInPicture",
      true
    );
    const videos = [...doc.querySelectorAll("video")].filter(
      video =>
        !isNaN(video.duration) &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        // Already shown in a Picture-in-Picture window (or another card).
        !video.isCloningElementVisually &&
        !(respectDisabled && video.disablePictureInPicture)
    );
    if (!videos.length) {
      return null;
    }

    const playing = videos.find(video => !video.paused && !video.ended);
    const video = playing ?? videos.sort((a, b) => b.duration - a.duration)[0];

    return {
      videoRef: lazy.ContentDOMReference.get(video),
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      playing: !!playing,
    };
  }
}
