function handleRequest(request, response) {
  let { NetUtil } = ChromeUtils.importESModule(
    "resource://gre/modules/NetUtil.sys.mjs"
  );
  let query = new URLSearchParams(request.queryString);

  response.setHeader("Cross-Origin-Opener-Policy", "same-origin", false);
  response.setHeader("Cross-Origin-Embedder-Policy", "require-corp", false);

  var fileRoot = query.get("fileRoot");

  // Get the desired file
  var file;
  getObjectState("SERVER_ROOT", function (serverRoot) {
    file = serverRoot.getFile(fileRoot);
  });

  // Set up the file streams to read in the file as UTF-8
  let fstream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(
    Ci.nsIFileInputStream
  );

  fstream.init(file, -1, 0, 0);

  // Read the file
  let available = fstream.available();
  let data =
    available > 0 ? NetUtil.readInputStreamToString(fstream, available) : "";
  fstream.close();

  response.write(data);
}
