/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { PasswordValidator } = ChromeUtils.importESModule(
  "resource://services-sync/engines/passwords.sys.mjs"
);
const { BridgedEngine } = ChromeUtils.importESModule(
  "resource://services-sync/bridged_engine.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);

function getDummyServerAndClient() {
  return {
    server: [
      {
        id: "11111",
        guid: "11111",
        hostname: "https://www.11111.com",
        formSubmitURL: "https://www.11111.com",
        password: "qwerty123",
        passwordField: "pass",
        username: "foobar",
        usernameField: "user",
        httpRealm: null,
      },
      {
        id: "22222",
        guid: "22222",
        hostname: "https://www.22222.org",
        formSubmitURL: "https://www.22222.org",
        password: "hunter2",
        passwordField: "passwd",
        username: "baz12345",
        usernameField: "user",
        httpRealm: null,
      },
      {
        id: "33333",
        guid: "33333",
        hostname: "https://www.33333.com",
        formSubmitURL: "https://www.33333.com",
        password: "p4ssw0rd",
        passwordField: "passwad",
        username: "quux",
        usernameField: "user",
        httpRealm: null,
      },
    ],
    client: [
      {
        id: "11111",
        guid: "11111",
        hostname: "https://www.11111.com",
        formSubmitURL: "https://www.11111.com",
        password: "qwerty123",
        passwordField: "pass",
        username: "foobar",
        usernameField: "user",
        httpRealm: null,
      },
      {
        id: "22222",
        guid: "22222",
        hostname: "https://www.22222.org",
        formSubmitURL: "https://www.22222.org",
        password: "hunter2",
        passwordField: "passwd",
        username: "baz12345",
        usernameField: "user",
        httpRealm: null,
      },
      {
        id: "33333",
        guid: "33333",
        hostname: "https://www.33333.com",
        formSubmitURL: "https://www.33333.com",
        password: "p4ssw0rd",
        passwordField: "passwad",
        username: "quux",
        usernameField: "user",
        httpRealm: null,
      },
    ],
  };
}

add_task(async function test_valid() {
  let { server, client } = getDummyServerAndClient();
  let validator = new PasswordValidator();
  let { problemData, clientRecords, records, deletedRecords } =
    await validator.compareClientWithServer(client, server);
  equal(clientRecords.length, 3);
  equal(records.length, 3);
  equal(deletedRecords.length, 0);
  deepEqual(problemData, validator.emptyProblemData());
});

add_task(async function test_missing() {
  let validator = new PasswordValidator();
  {
    let { server, client } = getDummyServerAndClient();

    client.pop();

    let { problemData, clientRecords, records, deletedRecords } =
      await validator.compareClientWithServer(client, server);

    equal(clientRecords.length, 2);
    equal(records.length, 3);
    equal(deletedRecords.length, 0);

    let expected = validator.emptyProblemData();
    expected.clientMissing.push("33333");
    deepEqual(problemData, expected);
  }
  {
    let { server, client } = getDummyServerAndClient();

    server.pop();

    let { problemData, clientRecords, records, deletedRecords } =
      await validator.compareClientWithServer(client, server);

    equal(clientRecords.length, 3);
    equal(records.length, 2);
    equal(deletedRecords.length, 0);

    let expected = validator.emptyProblemData();
    expected.serverMissing.push("33333");
    deepEqual(problemData, expected);
  }
});

add_task(async function test_deleted() {
  let { server, client } = getDummyServerAndClient();
  let deletionRecord = { id: "444444", guid: "444444", deleted: true };

  server.push(deletionRecord);
  let validator = new PasswordValidator();

  let { problemData, clientRecords, records, deletedRecords } =
    await validator.compareClientWithServer(client, server);

  equal(clientRecords.length, 3);
  equal(records.length, 4);
  deepEqual(deletedRecords, [deletionRecord]);

  let expected = validator.emptyProblemData();
  deepEqual(problemData, expected);
});

add_task(async function test_duplicates() {
  let validator = new PasswordValidator();
  {
    let { server, client } = getDummyServerAndClient();
    client.push(Cu.cloneInto(client[0], {}));

    let { problemData } = await validator.compareClientWithServer(
      client,
      server
    );

    let expected = validator.emptyProblemData();
    expected.clientDuplicates.push("11111");
    deepEqual(problemData, expected);
  }
  {
    let { server, client } = getDummyServerAndClient();
    server.push(Cu.cloneInto(server[server.length - 1], {}));

    let { problemData } = await validator.compareClientWithServer(
      client,
      server
    );

    let expected = validator.emptyProblemData();
    expected.duplicates.push("33333");
    deepEqual(problemData, expected);
  }
});

// A bridged engine (eg, the Rust logins engine) decrypts records with
// RawCryptoWrapper, so their cleartext is the raw payload string rather than a
// parsed object. `getServerItems` must still yield objects to the validator,
// otherwise every server record looks like it has no id and every local login
// is wrongly reported as `serverMissing`.
add_task(async function test_bridged_engine_server_items() {
  let engine = new BridgedEngine("Passwords", Service);
  engine._bridge = {
    storageVersion: 1,
    resetSyncId() {
      return "syncIDAAAAAA";
    },
  };
  engine.enabled = true;

  let server = await serverForFoo(engine);
  try {
    await SyncTestingInfrastructure(server);

    let guid = "{1e110b98-1407-4801-baf1-f6ca91e0f982}";
    let login = {
      id: guid,
      hostname: "https://accounts.google.com",
      formSubmitURL: "https://accounts.google.com",
      username: "iosmztest",
      password: "test15mz",
      usernameField: "Email",
      passwordField: "Passwd",
    };
    server
      .user("foo")
      .collection("passwords")
      .insert(guid, encryptPayload(login), new_timestamp());

    let validator = new PasswordValidator();
    let serverItems = await validator.getServerItems(engine);
    let clientItems = [{ ...login, guid, httpRealm: null }];

    let { problemData } = await validator.compareClientWithServer(
      clientItems,
      serverItems
    );

    equal(
      problemData.serverMissing.length,
      0,
      "A record present on the server must not be reported as serverMissing"
    );
    deepEqual(problemData, validator.emptyProblemData());
  } finally {
    await promiseStopServer(server);
    await engine.finalize();
  }
});
