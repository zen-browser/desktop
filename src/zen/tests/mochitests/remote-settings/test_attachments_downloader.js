const { Downloader } = ChromeUtils.importESModule(
  "resource://services-settings/Attachments.sys.mjs"
);

const RECORD = {
  id: "1f3a0802-648d-11ea-bd79-876a8b69c377",
  attachment: {
    hash: "f41ed47d0f43325c9f089d03415c972ce1d3f1ecab6e4d6260665baf3db3ccee",
    size: 1597,
    filename: "test_file.pem",
    location:
      "main-workspace/some-collection/65650a0f-7c22-4c10-9744-2d67e301f5f4.pem",
    mimetype: "application/x-pem-file",
  },
};

const RECORD_OF_DUMP = {
  id: "filename-of-dump.txt",
  attachment: {
    filename: "filename-of-dump.txt",
    hash: "4c46ef7e4f1951d210fe54c21e07c09bab265fd122580083ed1d6121547a8c6b",
    size: 25,
  },
  last_modified: 1234567,
  some_key: "some metadata",
};

let downloader;
let server;

add_setup(() => {
  server = new HttpServer();
  server.start(-1);
  registerCleanupFunction(() => server.stop(() => {}));

  server.registerDirectory(
    "/cdn/main-workspace/some-collection/",
    do_get_file("test_attachments_downloader")
  );
  server.registerDirectory(
    "/cdn/bundles/",
    do_get_file("test_attachments_downloader")
  );

  // For this test, we are using a server other than production. Force
  // LOAD_DUMPS to true so that we can still load attachments from dumps.
  delete Utils.LOAD_DUMPS;
  Utils.LOAD_DUMPS = true;
});

async function clear_state() {
  Services.fog.testResetFOG();
  enableUptakeMetric();

  Services.prefs.setStringPref(
    "services.settings.server",
    `http://localhost:${server.identity.primaryPort}/v1`
  );

  downloader = new Downloader("main", "some-collection");
  downloader.cache = {};
  const memCacheImpl = {
    get: async id => {
      return downloader.cache[id];
    },
    set: async (id, obj) => {
      downloader.cache[id] = obj;
    },
    setMultiple: async idsObjs => {
      idsObjs.forEach(([id, obj]) => (downloader.cache[id] = obj));
    },
    delete: async id => {
      delete downloader.cache[id];
    },
    deleteMultiple: async ids => {
      ids.forEach(id => delete downloader.cache[id]);
    },
    hasData: async () => {
      return !!Object.keys(downloader.cache).length;
    },
  };
  // The download() method requires a cacheImpl, but the Downloader
  // class does not have one. Define a dummy no-op one.
  Object.defineProperty(downloader, "cacheImpl", {
    value: memCacheImpl,
    // Writable to allow specific tests to override cacheImpl.
    writable: true,
  });
  await downloader.deleteDownloaded(RECORD);

  server.registerPathHandler("/v1/", (request, response) => {
    response.write(
      JSON.stringify({
        capabilities: {
          attachments: {
            base_url: `http://localhost:${server.identity.primaryPort}/cdn/`,
          },
        },
      })
    );
    response.setHeader("Content-Type", "application/json; charset=UTF-8");
    response.setStatusLine(null, 200, "OK");
  });

  // For tests that use a real client and DB cache, clear the local DB too.
  const client = RemoteSettings("some-collection");
  await client.db.clear();
  await client.db.pruneAttachments([]);
}
add_task(clear_state);

add_task(
  async function test_download_throws_server_info_error_if_invalid_response() {
    server.registerPathHandler("/v1/", (request, response) => {
      response.write("{bad json content");
      response.setHeader("Content-Type", "application/json; charset=UTF-8");
      response.setStatusLine(null, 200, "OK");
    });

    let error;
    try {
      await downloader.download(RECORD);
    } catch (e) {
      error = e;
    }

    Assert.ok(error instanceof Downloader.ServerInfoError);
  }
);
add_task(clear_state);

add_task(async function test_download_is_retried_3_times_if_download_fails() {
  const record = {
    id: "abc",
    attachment: {
      ...RECORD.attachment,
      location: "404-error.pem",
    },
  };

  let called = 0;
  const _fetchAttachment = downloader._fetchAttachment;
  downloader._fetchAttachment = async url => {
    called++;
    return _fetchAttachment(url);
  };

  let error;
  try {
    await downloader.download(record);
  } catch (e) {
    error = e;
  }

  Assert.equal(called, 4); // 1 + 3 retries
  Assert.ok(error instanceof Downloader.DownloadError);
});
add_task(clear_state);

add_task(async function test_download_as_bytes() {
  const bytes = await downloader.downloadAsBytes(RECORD);

  // See *.pem file in tests data.
  Assert.greater(
    bytes.byteLength,
    1500,
    `Wrong bytes size: ${bytes.byteLength}`
  );
});
add_task(clear_state);

add_task(async function test_download_is_retried_3_times_if_content_fails() {
  const record = {
    id: "abc",
    attachment: {
      ...RECORD.attachment,
      hash: "always-wrong",
    },
  };
  let called = 0;
  downloader._fetchAttachment = async () => {
    called++;
    return new ArrayBuffer();
  };

  let error;
  try {
    await downloader.download(record);
  } catch (e) {
    error = e;
  }

  Assert.equal(called, 4); // 1 + 3 retries
  Assert.ok(error instanceof Downloader.BadContentError);
});
add_task(clear_state);

add_task(async function test_delete_all() {
  const client = RemoteSettings("some-collection");
  await client.db.create(RECORD);
  await downloader.download(RECORD);

  await client.attachments.deleteAll();

  Assert.ok(!(await client.attachments.cacheImpl.get(RECORD.id)));
});
add_task(clear_state);

add_task(async function test_downloader_reports_download_errors() {
  const client = RemoteSettings("some-collection");

  const record = {
    attachment: {
      ...RECORD.attachment,
      location: "404-error.pem",
    },
  };

  try {
    await client.attachments.download(record, { retry: 0 });
  } catch (e) {}

  assertTelemetryEvents([
    {
      value: UptakeTelemetry.STATUS.DOWNLOAD_START,
      source: client.identifier,
    },
    {
      value: UptakeTelemetry.STATUS.DOWNLOAD_ERROR,
      source: client.identifier,
    },
  ]);
});
add_task(clear_state);

add_task(async function test_downloader_reports_offline_error() {
  const backupOffline = Services.io.offline;
  Services.io.offline = true;

  try {
    const client = RemoteSettings("some-collection");
    const record = {
      attachment: {
        ...RECORD.attachment,
        location: "will-try-and-fail.pem",
      },
    };
    try {
      await client.attachments.download(record, { retry: 0 });
    } catch (e) {}

    assertTelemetryEvents([
      {
        value: UptakeTelemetry.STATUS.DOWNLOAD_START,
        source: client.identifier,
      },
      {
        value: UptakeTelemetry.STATUS.NETWORK_OFFLINE_ERROR,
        source: client.identifier,
      },
    ]);
  } finally {
    Services.io.offline = backupOffline;
  }
});
add_task(clear_state);

// Common code for test_download_cache_hit and test_download_cache_corruption.
async function doTestDownloadCacheImpl({
  simulateCorruption,
  expectedReads = 1,
  expectedWrites = 1,
  downloadOptions = {},
}) {
  let readCount = 0;
  let writeCount = 0;
  const cacheImpl = {
    async get(attachmentId) {
      Assert.equal(attachmentId, RECORD.id, "expected attachmentId");
      ++readCount;
      if (simulateCorruption) {
        throw new Error("Simulation of corrupted cache (read)");
      }
    },
    async set(attachmentId, attachment) {
      Assert.equal(attachmentId, RECORD.id, "expected attachmentId");
      Assert.deepEqual(attachment.record, RECORD, "expected record");
      ++writeCount;
      if (simulateCorruption) {
        throw new Error("Simulation of corrupted cache (write)");
      }
    },
    async delete() {},
  };
  Object.defineProperty(downloader, "cacheImpl", { value: cacheImpl });

  let downloadResult = await downloader.download(RECORD, downloadOptions);
  Assert.equal(downloadResult._source, "remote_match", "expected source");
  Assert.equal(downloadResult.buffer.byteLength, 1597, "expected result");
  Assert.equal(readCount, expectedReads, "expected cache read attempts");
  Assert.equal(writeCount, expectedWrites, "expected cache write attempts");
}

add_task(async function test_download_cache_hit() {
  await doTestDownloadCacheImpl({ simulateCorruption: false });
});
add_task(clear_state);

// Verify that the downloader works despite a broken cache implementation.
add_task(async function test_download_cache_corruption() {
  await doTestDownloadCacheImpl({ simulateCorruption: true });
});
add_task(clear_state);

add_task(async function test_download_with_cache_enabled() {
  await doTestDownloadCacheImpl({
    simulateCorruption: false,
    downloadOptions: {
      cacheResult: true,
    },
  });
});
add_task(clear_state);

add_task(async function test_download_with_cache_disabled() {
  await doTestDownloadCacheImpl({
    simulateCorruption: false,
    expectedWrites: 0,
    downloadOptions: {
      cacheResult: false,
    },
  });
});
add_task(clear_state);

add_task(async function test_download_cached() {
  const client = RemoteSettings("main", "some-collection");
  const attachmentId = "dummy filename";
  const badRecord = {
    attachment: {
      ...RECORD.attachment,
      hash: "non-matching hash",
      location: "non-existing-location-should-fail.bin",
    },
  };
  async function downloadWithCache(record, options) {
    options = { ...options, useCache: true };
    return client.attachments.download(record, options);
  }
  function checkInfo(downloadResult, expectedSource, msg) {
    Assert.deepEqual(
      downloadResult.record,
      RECORD,
      `${msg} : expected identical record`
    );
    // Simple check: assume that content is identical if the size matches.
    Assert.equal(
      downloadResult.buffer.byteLength,
      RECORD.attachment.size,
      `${msg} : expected buffer`
    );
    Assert.equal(
      downloadResult._source,
      expectedSource,
      `${msg} : expected source of the result`
    );
  }

  await Assert.rejects(
    downloadWithCache(null, { attachmentId }),
    /DownloadError: Could not download dummy filename/,
    "Download without record or cache should fail."
  );

  // Populate cache.
  const info1 = await downloadWithCache(RECORD, { attachmentId });
  checkInfo(info1, "remote_match", "first time download");

  await Assert.rejects(
    downloadWithCache(null, { attachmentId }),
    /DownloadError: Could not download dummy filename/,
    "Download without record still fails even if there is a cache."
  );

  await Assert.rejects(
    downloadWithCache(badRecord, { attachmentId }),
    /DownloadError: Could not download .*non-existing-location-should-fail.bin/,
    "Download with non-matching record still fails even if there is a cache."
  );

  // Download from cache.
  const info2 = await downloadWithCache(RECORD, { attachmentId });
  checkInfo(info2, "cache_match", "download matching record from cache");

  const info3 = await downloadWithCache(RECORD, {
    attachmentId,
    fallbackToCache: true,
  });
  checkInfo(info3, "cache_match", "fallbackToCache accepts matching record");

  const info4 = await downloadWithCache(null, {
    attachmentId,
    fallbackToCache: true,
  });
  checkInfo(info4, "cache_fallback", "fallbackToCache accepts null record");

  const info5 = await downloadWithCache(badRecord, {
    attachmentId,
    fallbackToCache: true,
  });
  checkInfo(info5, "cache_fallback", "fallbackToCache ignores bad record");

  // Bye bye cache.
  await client.attachments.deleteDownloaded({ id: attachmentId });
  await Assert.rejects(
    downloadWithCache(null, { attachmentId, fallbackToCache: true }),
    /DownloadError: Could not download dummy filename/,
    "Download without cache should fail again."
  );
  await Assert.rejects(
    downloadWithCache(badRecord, { attachmentId, fallbackToCache: true }),
    /DownloadError: Could not download .*non-existing-location-should-fail.bin/,
    "Download should fail to fall back to a download of a non-existing record"
  );
});
add_task(clear_state);

add_task(async function test_download_from_dump() {
  const client = RemoteSettings("dump-collection", {
    bucketName: "dump-bucket",
  });

  // Temporarily replace the resource:-URL with another resource:-URL.
  const orig_RESOURCE_BASE_URL = Downloader._RESOURCE_BASE_URL;
  Downloader._RESOURCE_BASE_URL = "resource://rs-downloader-test";
  const resProto = Services.io
    .getProtocolHandler("resource")
    .QueryInterface(Ci.nsIResProtocolHandler);
  resProto.setSubstitution(
    "rs-downloader-test",
    Services.io.newFileURI(do_get_file("test_attachments_downloader"))
  );

  function checkInfo(result, expectedSource, expectedRecord = RECORD_OF_DUMP) {
    Assert.equal(
      new TextDecoder().decode(new Uint8Array(result.buffer)),
      "This would be a RS dump.\n",
      "expected content from dump"
    );
    Assert.deepEqual(result.record, expectedRecord, "expected record for dump");
    Assert.equal(result._source, expectedSource, "expected source of dump");
  }

  // If record matches, should happen before network request.
  const dump1 = await client.attachments.download(RECORD_OF_DUMP, {
    // Note: attachmentId not set, so should fall back to record.id.
    fallbackToDump: true,
  });
  checkInfo(dump1, "dump_match");

  // If no record given, should try network first, but then fall back to dump.
  const dump2 = await client.attachments.download(null, {
    attachmentId: RECORD_OF_DUMP.id,
    fallbackToDump: true,
  });
  checkInfo(dump2, "dump_fallback");

  // Fill the cache with the same data as the dump for the next part.
  await client.db.saveAttachment(RECORD_OF_DUMP.id, {
    record: RECORD_OF_DUMP,
    blob: new Blob([dump1.buffer]),
  });
  // The dump should take precedence over the cache.
  const dump3 = await client.attachments.download(RECORD_OF_DUMP, {
    fallbackToCache: true,
    fallbackToDump: true,
  });
  checkInfo(dump3, "dump_match");

  // When the record is not given, the dump takes precedence over the cache
  // as a fallback (when the cache and dump are identical).
  const dump4 = await client.attachments.download(null, {
    attachmentId: RECORD_OF_DUMP.id,
    fallbackToCache: true,
    fallbackToDump: true,
  });
  checkInfo(dump4, "dump_fallback");

  // Store a record in the cache that is newer than the dump.
  const RECORD_NEWER_THAN_DUMP = {
    ...RECORD_OF_DUMP,
    last_modified: RECORD_OF_DUMP.last_modified + 1,
  };
  await client.db.saveAttachment(RECORD_OF_DUMP.id, {
    record: RECORD_NEWER_THAN_DUMP,
    blob: new Blob([dump1.buffer]),
  });

  // When the record is not given, use the cache if it has a more recent record.
  const dump5 = await client.attachments.download(null, {
    attachmentId: RECORD_OF_DUMP.id,
    fallbackToCache: true,
    fallbackToDump: true,
  });
  checkInfo(dump5, "cache_fallback", RECORD_NEWER_THAN_DUMP);

  // When a record is given, use whichever that has the matching last_modified.
  const dump6 = await client.attachments.download(RECORD_OF_DUMP, {
    fallbackToCache: true,
    fallbackToDump: true,
  });
  checkInfo(dump6, "dump_match");
  const dump7 = await client.attachments.download(RECORD_NEWER_THAN_DUMP, {
    fallbackToCache: true,
    fallbackToDump: true,
  });
  checkInfo(dump7, "cache_match", RECORD_NEWER_THAN_DUMP);

  await client.attachments.deleteDownloaded(RECORD_OF_DUMP);

  await Assert.rejects(
    client.attachments.download(null, {
      attachmentId: "filename-without-meta.txt",
      fallbackToDump: true,
    }),
    /DownloadError: Could not download filename-without-meta.txt/,
    "Cannot download dump that lacks a .meta.json file"
  );

  await Assert.rejects(
    client.attachments.download(null, {
      attachmentId: "filename-without-content.txt",
      fallbackToDump: true,
    }),
    /Could not download resource:\/\/rs-downloader-test\/settings\/dump-bucket\/dump-collection\/filename-without-content\.txt(?!\.meta\.json)/,
    "Cannot download dump that is missing, despite the existing .meta.json"
  );

  // Restore, just in case.
  Downloader._RESOURCE_BASE_URL = orig_RESOURCE_BASE_URL;
  resProto.setSubstitution("rs-downloader-test", null);
});
// Not really needed because the last test doesn't modify the main collection,
// but added for consistency with other tests tasks around here.
add_task(clear_state);

add_task(
  async function test_download_from_dump_fails_when_load_dumps_is_false() {
    const client = RemoteSettings("dump-collection", {
      bucketName: "dump-bucket",
    });

    // Temporarily replace the resource:-URL with another resource:-URL.
    const orig_RESOURCE_BASE_URL = Downloader._RESOURCE_BASE_URL;
    Downloader._RESOURCE_BASE_URL = "resource://rs-downloader-test";
    const resProto = Services.io
      .getProtocolHandler("resource")
      .QueryInterface(Ci.nsIResProtocolHandler);
    resProto.setSubstitution(
      "rs-downloader-test",
      Services.io.newFileURI(do_get_file("test_attachments_downloader"))
    );

    function checkInfo(
      result,
      expectedSource,
      expectedRecord = RECORD_OF_DUMP
    ) {
      Assert.equal(
        new TextDecoder().decode(new Uint8Array(result.buffer)),
        "This would be a RS dump.\n",
        "expected content from dump"
      );
      Assert.deepEqual(
        result.record,
        expectedRecord,
        "expected record for dump"
      );
      Assert.equal(result._source, expectedSource, "expected source of dump");
    }

    // Download the dump so that we can use it to fill the cache.
    const dump1 = await client.attachments.download(RECORD_OF_DUMP, {
      // Note: attachmentId not set, so should fall back to record.id.
      fallbackToDump: true,
    });
    checkInfo(dump1, "dump_match");

    // Fill the cache with the same data as the dump for the next part.
    await client.db.saveAttachment(RECORD_OF_DUMP.id, {
      record: RECORD_OF_DUMP,
      blob: new Blob([dump1.buffer]),
    });

    // Now turn off loading dumps, and check we no longer load from the dump,
    // but use the cache instead.
    Utils.LOAD_DUMPS = false;

    const dump2 = await client.attachments.download(RECORD_OF_DUMP, {
      // Note: attachmentId not set, so should fall back to record.id.
      fallbackToDump: true,
    });
    checkInfo(dump2, "cache_match");

    // When the record is not given, the dump would take precedence over the
    // cache but we have disabled dumps, so we should load from the cache.
    const dump4 = await client.attachments.download(null, {
      attachmentId: RECORD_OF_DUMP.id,
      fallbackToCache: true,
      fallbackToDump: true,
    });
    checkInfo(dump4, "cache_fallback");

    // Restore, just in case.
    Utils.LOAD_DUMPS = true;
    Downloader._RESOURCE_BASE_URL = orig_RESOURCE_BASE_URL;
    resProto.setSubstitution("rs-downloader-test", null);
  }
);

add_task(async function test_attachment_get() {
  // Since get() is largely a wrapper around the same code as download(),
  // we only test a couple of parts to check it functions as expected, and
  // rely on the download() testing for the rest.

  await Assert.rejects(
    downloader.get(RECORD),
    /NotFoundError: Could not find /,
    "get() fails when there is no local cache nor dump"
  );

  const client = RemoteSettings("dump-collection", {
    bucketName: "dump-bucket",
  });

  // Temporarily replace the resource:-URL with another resource:-URL.
  const orig_RESOURCE_BASE_URL = Downloader._RESOURCE_BASE_URL;
  Downloader._RESOURCE_BASE_URL = "resource://rs-downloader-test";
  const resProto = Services.io
    .getProtocolHandler("resource")
    .QueryInterface(Ci.nsIResProtocolHandler);
  resProto.setSubstitution(
    "rs-downloader-test",
    Services.io.newFileURI(do_get_file("test_attachments_downloader"))
  );

  function checkInfo(result, expectedSource, expectedRecord = RECORD_OF_DUMP) {
    Assert.equal(
      new TextDecoder().decode(new Uint8Array(result.buffer)),
      "This would be a RS dump.\n",
      "expected content from dump"
    );
    Assert.deepEqual(result.record, expectedRecord, "expected record for dump");
    Assert.equal(result._source, expectedSource, "expected source of dump");
  }

  // When a record is given, use whichever that has the matching last_modified.
  const dump = await client.attachments.get(RECORD_OF_DUMP);
  checkInfo(dump, "dump_match");

  await client.attachments.deleteDownloaded(RECORD_OF_DUMP);

  await Assert.rejects(
    client.attachments.get(null, {
      attachmentId: "filename-without-meta.txt",
      fallbackToDump: true,
    }),
    /NotFoundError: Could not find filename-without-meta.txt in cache or dump/,
    "Cannot download dump that lacks a .meta.json file"
  );

  await Assert.rejects(
    client.attachments.get(null, {
      attachmentId: "filename-without-content.txt",
      fallbackToDump: true,
    }),
    /Could not download resource:\/\/rs-downloader-test\/settings\/dump-bucket\/dump-collection\/filename-without-content\.txt(?!\.meta\.json)/,
    "Cannot download dump that is missing, despite the existing .meta.json"
  );

  // Restore, just in case.
  Downloader._RESOURCE_BASE_URL = orig_RESOURCE_BASE_URL;
  resProto.setSubstitution("rs-downloader-test", null);
});
// Not really needed because the last test doesn't modify the main collection,
// but added for consistency with other tests tasks around here.
add_task(clear_state);

add_task(async function test_obsolete_attachments_are_pruned() {
  const RECORD2 = {
    ...RECORD,
    id: "another-id",
  };
  const client = RemoteSettings("some-collection");
  // Store records and related attachments directly in the cache.
  await client.db.importChanges({}, 42, [RECORD, RECORD2], { clear: true });
  await client.db.saveAttachment(RECORD.id, {
    record: RECORD,
    blob: new Blob(["123"]),
  });
  await client.db.saveAttachment("custom-id", {
    record: RECORD2,
    blob: new Blob(["456"]),
  });
  // Store an extraneous cached attachment.
  await client.db.saveAttachment("bar", {
    record: { id: "bar" },
    blob: new Blob(["789"]),
  });

  const recordAttachment = await client.attachments.cacheImpl.get(RECORD.id);
  Assert.equal(
    await recordAttachment.blob.text(),
    "123",
    "Record has a cached attachment"
  );
  const record2Attachment = await client.attachments.cacheImpl.get("custom-id");
  Assert.equal(
    await record2Attachment.blob.text(),
    "456",
    "Record 2 has a cached attachment"
  );
  const { blob: cachedExtra } = await client.attachments.cacheImpl.get("bar");
  Assert.equal(await cachedExtra.text(), "789", "There is an extra attachment");

  await client.attachments.prune([]);

  Assert.ok(
    await client.attachments.cacheImpl.get(RECORD.id),
    "Record attachment was kept"
  );
  Assert.ok(
    await client.attachments.cacheImpl.get("custom-id"),
    "Record 2 attachment was kept"
  );
  Assert.ok(
    !(await client.attachments.cacheImpl.get("bar")),
    "Extra was deleted"
  );
});
add_task(clear_state);

add_task(
  async function test_obsolete_attachments_listed_as_excluded_are_not_pruned() {
    const client = RemoteSettings("some-collection");
    // Store records and related attachments directly in the cache.
    await client.db.importChanges({}, 42, [], { clear: true });
    await client.db.saveAttachment(RECORD.id, {
      record: RECORD,
      blob: new Blob(["123"]),
    });

    const recordAttachment = await client.attachments.cacheImpl.get(RECORD.id);
    Assert.equal(
      await recordAttachment.blob.text(),
      "123",
      "Record has a cached attachment"
    );

    await client.attachments.prune([RECORD.id]);

    Assert.ok(
      await client.attachments.cacheImpl.get(RECORD.id),
      "Record attachment was kept"
    );
  }
);

add_task(clear_state);

add_task(async function test_cacheAll_happy_path() {
  // verify bundle is downloaded succesfully
  const allSuccess = await downloader.cacheAll();
  Assert.ok(
    allSuccess,
    "Attachments cacheAll succesfully downloaded a bundle and saved all attachments"
  );

  // verify accuracy of attachments downloaded
  Assert.equal(
    downloader.cache["1"].record.title,
    "test1",
    "Test record 1 meta content appears accurate."
  );
  Assert.equal(
    await downloader.cache["1"].blob.text(),
    "test1\n",
    "Test file 1 content is accurate."
  );
  Assert.equal(
    downloader.cache["2"].record.title,
    "test2",
    "Test record 2 meta content appears accurate."
  );
  Assert.equal(
    await downloader.cache["2"].blob.text(),
    "test2\n",
    "Test file 2 content is accurate."
  );
});

add_task(async function test_cacheAll_using_real_db() {
  const client = RemoteSettings("some-collection");

  const allSuccess = await client.attachments.cacheAll();

  Assert.ok(
    allSuccess,
    "Attachments cacheAll succesfully downloaded a bundle and saved all attachments"
  );

  Assert.equal(
    (await client.attachments.cacheImpl.get("2")).record.title,
    "test2",
    "Test record 2 meta content appears accurate."
  );
  Assert.equal(
    await (await client.attachments.cacheImpl.get("2")).blob.text(),
    "test2\n",
    "Test file 2 content is accurate."
  );
});

add_task(clear_state);

add_task(async function test_cacheAll_skips_with_existing_data() {
  downloader.cache = {
    1: "1",
  };
  const allSuccess = await downloader.cacheAll();
  Assert.equal(
    allSuccess,
    null,
    "Attachments cacheAll skips downloads if data already exists"
  );
});

add_task(async function test_cacheAll_does_not_skip_if_force_is_true() {
  downloader.cache = {
    1: "1",
  };
  const allSuccess = await downloader.cacheAll(true);
  Assert.equal(
    allSuccess,
    true,
    "Attachments cacheAll does not skip downloads if force is true"
  );
});

add_task(clear_state);

add_task(async function test_cacheAll_failed_request() {
  downloader.bucketName = "fake-bucket";
  downloader.collectionName = "fake-collection";
  const allSuccess = await downloader.cacheAll();
  Assert.equal(
    allSuccess,
    false,
    "Attachments cacheAll request failed to download a bundle and returned false"
  );
});

add_task(clear_state);

add_task(async function test_cacheAll_failed_unzip() {
  downloader.bucketName = "error-bucket";
  downloader.collectionName = "bad-zip";
  const allSuccess = await downloader.cacheAll();
  Assert.equal(
    allSuccess,
    false,
    "Attachments cacheAll request failed to extract a bundle and returned false"
  );
});

add_task(clear_state);

add_task(async function test_cacheAll_failed_save() {
  const client = RemoteSettings("some-collection");

  const backup = client.db.saveAttachments;
  client.db.saveAttachments = () => {
    throw new Error("boom");
  };

  const allSuccess = await client.attachments.cacheAll();

  Assert.equal(
    allSuccess,
    false,
    "Attachments cacheAll failed to save entries in DB and returned false"
  );
  client.db.saveAttachments = backup;
});

add_task(clear_state);
