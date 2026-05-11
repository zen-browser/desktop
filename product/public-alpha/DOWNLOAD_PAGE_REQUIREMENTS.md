# Download Page Requirements

The download page must match the artifacts that actually exist.

## Required Fields

Each downloadable artifact must show:

- product name
- version
- platform
- architecture
- file name
- file size
- SHA-256 checksum
- source commit or tag
- release date
- known issues link
- release notes link

## Required Warnings

Alpha builds must clearly state:

- unsigned unless explicitly signed
- automatic updates disabled
- manual upgrade required
- unstable and for testing
- platform support is limited to listed artifacts

## Platform Sections

### macOS

Show only when macOS artifact exists.

Required:

- Apple silicon or Intel support statement
- unsigned/notarization status
- install instructions
- Gatekeeper warning if unsigned

### Linux

Show only when Linux artifact exists.

Required:

- distro expectations
- portable tarball instructions
- checksum
- known missing package requirements if any

### Windows

Show only when Windows artifact exists.

Required:

- architecture
- portable or installer status
- unsigned status
- SmartScreen warning if unsigned

## Do Not Show

- Linux download before Linux artifact exists
- Windows download before Windows artifact exists
- automatic-update claims before real update infrastructure exists
- mobile download buttons before mobile repos/builds exist
