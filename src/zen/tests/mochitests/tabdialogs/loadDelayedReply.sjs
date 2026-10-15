/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

function handleRequest(request, response) {
  response.processAsync();
  if (request.method === "POST") {
    getObjectState("wait", queryResponse => {
      if (!queryResponse) {
        throw new Error("Wrong call order");
      }
      queryResponse.finish();

      response.setStatusLine(request.httpVersion, 200);
      response.write("OK");
      response.finish();
    });
    return;
  }
  response.setStatusLine(request.httpVersion, 200);
  response.write("OK");
  setObjectState("wait", response);
}
