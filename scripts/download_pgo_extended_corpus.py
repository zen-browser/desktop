# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import yaml
import os
import requests
import tarfile
import hashlib

EXTENDED_CORPUS_KEY="pgo-extended-corpus"
TASKCLUSTER_PATH=os.path.join("taskcluster", "kinds", "fetch", "benchmarks.yml")

def download_corpus(corpus_url, expected_sha256, output_path):
    response = requests.get(corpus_url, stream=True)
    response.raise_for_status()

    os.makedirs(output_path, exist_ok=True)
    archive_path = os.path.join(output_path, "corpus.tar.gz")

    with open(archive_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

    # Verify the SHA256 checksum
    sha256 = hashlib.sha256()
    with open(archive_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    if sha256.hexdigest() != expected_sha256:
        os.remove(archive_path)
        raise ValueError("SHA256 checksum does not match expected value.")

    print("Checksum verified ({}). Extracting corpus...".format(expected_sha256))
    with tarfile.open(archive_path, "r:gz") as tar:
        tar.extractall(path=output_path)

    # rename "JetStream-[id]" to just "JetStream"
    for item in os.listdir(output_path):
        if item.startswith("JetStream-"):
            os.rename(os.path.join(output_path, item), os.path.join(output_path, "JetStream"))
            break

    # Clean up the downloaded archive
    os.remove(archive_path)
    print(f"Corpus downloaded and extracted to: {output_path}")

def main():
    print("\n------------------------------------\n")
    print("Fetching PGO extended corpus information from Taskcluster...")
    with open(TASKCLUSTER_PATH, "r", encoding="utf-8") as f:
        benchmarks = yaml.safe_load(f)
    corpus_url = benchmarks[EXTENDED_CORPUS_KEY]
    fetch_info = corpus_url["fetch"]
    download_corpus(fetch_info["url"], fetch_info["sha256"], "pgo-extended-corpus")
    print("\n------------------------------------\n")

if __name__ == "__main__":
    main()
