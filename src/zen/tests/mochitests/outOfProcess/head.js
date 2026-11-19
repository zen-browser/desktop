const OOP_BASE_PAGE_URI =
  "https://example.com/browser/browser/base/content/test/browser-outOfProcess/file_base.html";

// The number of frames and subframes that exist for the basic OOP test. If frames are
// modified within file_base.html, update this value.
const TOTAL_FRAME_COUNT = 8;

// The frames are assigned different colors based on their process ids. If you add a
// frame you might need to add more colors to this list.
const FRAME_COLORS = ["white", "seashell", "lightcyan", "palegreen"];

/**
 * Set up a set of child frames for the given browser for testing
 * out of process frames. 'OOP_BASE_PAGE_URI' is the base page and subframes
 * contain pages from the same or other domains.
 *
 * @param browser browser containing frame hierarchy to set up
 * @param insertHTML HTML or function that returns what to insert into each frame
 * @returns array of all browsing contexts in depth-first order
 *
 * This function adds a browsing context and process id label to each
 * child subframe. It also sets the background color of each frame to
 * different colors based on the process id. The browser_basic_outofprocess.js
 * test verifies these colors to ensure that the frame/process hierarchy
 * has been set up as expected. Colors are used to help people visualize
 * the process setup.
 *
 * The insertHTML argument may be either a fixed string of HTML to insert
 * into each subframe, or a function that returns the string to insert. The
 * function takes one argument, the browsing context being processed.
 */
async function initChildFrames(browser, insertHTML) {
  let colors = FRAME_COLORS.slice();
  let colorMap = new Map();

  let browsingContexts = [];

  async function processBC(bc) {
    browsingContexts.push(bc);

    let pid = bc.currentWindowGlobal.osPid;
    let ident = "BrowsingContext: " + bc.id + "\nProcess: " + pid;

    let color = colorMap.get(pid);
    if (!color) {
      if (!colors.length) {
        ok(false, "ran out of available colors");
      }

      color = colors.shift();
      colorMap.set(pid, color);
    }

    let insertHTMLString = insertHTML;
    if (typeof insertHTML == "function") {
      insertHTMLString = insertHTML(bc);
    }

    await SpecialPowers.spawn(
      bc,
      [ident, color, insertHTMLString],
      (identChild, colorChild, insertHTMLChild) => {
        let root = content.document.documentElement;
        root.style = "background-color: " + colorChild;

        let pre = content.document.createElement("pre");
        pre.textContent = identChild;
        root.insertBefore(pre, root.firstChild);

        if (insertHTMLChild) {
          content.document.getElementById("insertPoint").innerHTML =
            insertHTMLChild;
        }
      }
    );

    for (let childBC of bc.children) {
      await processBC(childBC);
    }
  }
  await processBC(browser.browsingContext);

  return browsingContexts;
}
