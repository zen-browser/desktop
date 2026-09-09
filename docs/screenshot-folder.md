# Screenshots in the downloads panel

Open the downloads popup, select **Choose screenshots folder…**, and choose
the folder where your operating system saves screenshots. The panel shows the
ten most recently modified images in that folder. Drag a filename into a drop
target, or select it to reveal the file in the system file manager.

The folder is checked when the popup opens and every two seconds while it is
open. Closed popups do no scanning. **Change folder…** selects another folder;
**Disconnect** forgets the selection without touching the files.

The selection is local to the browser profile and is not opted into Sync.
This feature is disabled in private windows. It does not access the clipboard,
upload images, decode previews, launch files, or add entries to download history.
Existing downloads and their commands are unchanged.

## File handling

- Only direct children with PNG, JPEG, WebP, GIF, HEIC, TIFF, or BMP extensions
  qualify. A selected folder may contain images other than screenshots; filenames
  are not used to guess which application created them.
- Hidden dotfiles, directories, symbolic links, empty files, and files modified
  within the last second are excluded. The delay avoids common partial writes;
  it is not a guarantee that another application has finished writing a file.
- Scans reject folders with more than 2,000 entries and limit concurrent metadata
  requests to 32. Use a dedicated, accessible screenshots folder.
- Folder ancestors and the selected file are checked again at the drag/reveal
  gesture. Native file drags permit copying only and supply no text or URL flavors.
  As with other native path-based drags, an external application can still modify
  a file after validation; this is not a snapshot or a sandbox for local programs.
- File names are inserted as text, and errors do not log local paths. Disconnect,
  folder changes, panel closure, and window teardown invalidate pending scans.

## Validation

With a built Zen development tree, run `npm test -- downloads` and `npm run lint`.
Browser tests cover filtering, recency, ordering, the display limit, removed and
rewritten files, out-of-folder paths, cancellation, live panel updates, native
drag payloads, disconnect, and private windows.

Before release, check on macOS, Windows, and Linux:

1. Choose a screenshots folder, save a screenshot with the system shortcut,
   and drag it from the popup into a web upload target and a native application.
2. Change and disconnect the folder, cancel the chooser, and reopen the popup.
   Confirm normal downloads still work and filenames remain keyboard accessible.
3. Delete an image, replace it with a symlink, and replace the selected folder
   or one of its ancestors with a symlink. Confirm no linked files can be dragged.
4. Test inaccessible/missing folders, long filenames, private windows, multiple
   normal windows, and closing the popup or window during a scan.
