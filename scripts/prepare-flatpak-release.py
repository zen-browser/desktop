import hashlib
import argparse
import sys

FLATID = "io.github.zen_browser.zen"

def get_sha256sum(filename):  
    """Calculate the SHA256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(filename, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256.update(byte_block)
    return sha256.hexdigest()

def build_template(template, linux_sha256, flatpak_sha256, version):
    print(f"Building template with version {version}")
    print(f"\tLinux archive sha256: {linux_sha256}")
    print(f"\tFlatpak archive sha256: {flatpak_sha256}")
    return template.format(linux_sha256=linux_sha256, 
                          flatpak_sha256=flatpak_sha256,
                          version=version)

def get_template(template_root):
    file = f"{template_root}/{FLATID}.yml.template"
    print(f"Reading template {file}")
    try:
        with open(file, "r") as f:
            return f.read()
    except FileNotFoundError:
        print(f"Template {file} not found")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Prepare flatpak release')
    parser.add_argument('--version', help='Version of the release', required=True)
    parser.add_argument('--linux-archive', help='Linux archive', required=True)
    parser.add_argument('--flatpak-archive', help='Flatpak archive', required=True)
    parser.add_argument('--output', help='Output file', default=f"{FLATID}.yml")
    parser.add_argument('--template-root', help='Template root', default="flatpak")
    args = parser.parse_args()

    linux_sha256 = get_sha256sum(args.linux_archive)
    flatpak_sha256 = get_sha256sum(args.flatpak_archive)
    template = build_template(get_template(args.template_root), linux_sha256, flatpak_sha256, args.version)

    print(f"Writing output to {args.output}")
    with open(args.output, "w") as f:
        f.write(template)

if __name__ == "__main__":
    main()

