
import os
import sys

import hashlib

FLATID = "io.github.zen_browser.zen"
TEMPLATE = open(f"flatpak/{FLATID}.yml.template").read()

LINUX_ARCHIVE = "zen.linux-generic.tar.bz2"
FLATPAK_ARCHIVE = "archive.tar"

VERSION = sys.argv[1]

def get_sha256sum(filename):  
    sha256 = hashlib.sha256()
    with open(filename, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256.update(byte_block)
    return sha256.hexdigest()

def build_template(linux_sha256, flatpak_sha256):
    return TEMPLATE.format(linux_sha256=linux_sha256, 
                          flatpak_sha256=flatpak_sha256,
                          version=VERSION)

def check_required_files():
    if not os.path.exists(LINUX_ARCHIVE):
        print(f"File {LINUX_ARCHIVE} not found")
        sys.exit(1)
    if not os.path.exists(FLATPAK_ARCHIVE):
        print(f"File {FLATPAK_ARCHIVE} not found")
        sys.exit(1)

    if not os.path.exists(f"flatpak"):
        print(f"Directory flatpak not found")
        sys.exit(1)

def main():
    check_required_files()
    linux_sha256 = get_sha256sum(LINUX_ARCHIVE)
    flatpak_sha256 = get_sha256sum(FLATPAK_ARCHIVE)

    template = build_template(linux_sha256, flatpak_sha256)

    with open(f"flatpak/{FLATID}.yml", "w") as f:
        f.write(template)

if __name__ == "__main__":
    main()
