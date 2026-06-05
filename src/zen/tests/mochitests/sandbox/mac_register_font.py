#!/usr/bin/python
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"""
mac_register_font.py

Mac-specific utility command to register a font file with the OS.
"""

import argparse
import sys

import Cocoa
import CoreText


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="print verbose registration failures",
        default=False,
    )
    parser.add_argument(
        "file", nargs="*", help="font file to register or unregister", default=[]
    )
    parser.add_argument(
        "-u",
        "--unregister",
        action="store_true",
        help="unregister the provided fonts",
        default=False,
    )
    parser.add_argument(
        "-p",
        "--persist-user",
        action="store_true",
        help="permanently register the font",
        default=False,
    )

    args = parser.parse_args()

    if args.persist_user:
        scope = CoreText.kCTFontManagerScopeUser
        scopeDesc = "user"
    else:
        scope = CoreText.kCTFontManagerScopeSession
        scopeDesc = "session"

    failureCount = 0
    for fontPath in args.file:
        fontURL = Cocoa.NSURL.fileURLWithPath_(fontPath)
        (result, error) = register_or_unregister_font(fontURL, args.unregister, scope)
        if result:
            print(
                "%sregistered font %s with %s scope"
                % (("un" if args.unregister else ""), fontPath, scopeDesc)
            )
        else:
            print(
                "Failed to %sregister font %s with %s scope"
                % (("un" if args.unregister else ""), fontPath, scopeDesc)
            )
            if args.verbose:
                print(error)
            failureCount += 1

    sys.exit(failureCount)


def register_or_unregister_font(fontURL, unregister, scope):
    return (
        CoreText.CTFontManagerUnregisterFontsForURL(fontURL, scope, None)
        if unregister
        else CoreText.CTFontManagerRegisterFontsForURL(fontURL, scope, None)
    )


if __name__ == "__main__":
    main()
