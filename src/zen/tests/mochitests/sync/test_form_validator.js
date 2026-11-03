/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { FormValidator } = ChromeUtils.importESModule(
  "resource://services-sync/engines/forms.sys.mjs"
);

function getDummyServerAndClient() {
  return {
    server: [
      {
        id: "11111",
        guid: "11111",
        name: "foo",
        fieldname: "foo",
        value: "bar",
      },
      {
        id: "22222",
        guid: "22222",
        name: "foo2",
        fieldname: "foo2",
        value: "bar2",
      },
      {
        id: "33333",
        guid: "33333",
        name: "foo3",
        fieldname: "foo3",
        value: "bar3",
      },
    ],
    client: [
      {
        id: "11111",
        guid: "11111",
        name: "foo",
        fieldname: "foo",
        value: "bar",
      },
      {
        id: "22222",
        guid: "22222",
        name: "foo2",
        fieldname: "foo2",
        value: "bar2",
      },
      {
        id: "33333",
        guid: "33333",
        name: "foo3",
        fieldname: "foo3",
        value: "bar3",
      },
    ],
  };
}

add_task(async function test_valid() {
  let { server, client } = getDummyServerAndClient();
  let validator = new FormValidator();
  let { problemData, clientRecords, records, deletedRecords } =
    await validator.compareClientWithServer(client, server);
  equal(clientRecords.length, 3);
  equal(records.length, 3);
  equal(deletedRecords.length, 0);
  deepEqual(problemData, validator.emptyProblemData());
});

add_task(async function test_formValidatorIgnoresMissingClients() {
  // Since history form records are not deleted from the server, the
  // |FormValidator| shouldn't set the |missingClient| flag in |problemData|.
  let { server, client } = getDummyServerAndClient();
  client.pop();

  let validator = new FormValidator();
  let { problemData, clientRecords, records, deletedRecords } =
    await validator.compareClientWithServer(client, server);

  equal(clientRecords.length, 2);
  equal(records.length, 3);
  equal(deletedRecords.length, 0);

  let expected = validator.emptyProblemData();
  deepEqual(problemData, expected);
});
