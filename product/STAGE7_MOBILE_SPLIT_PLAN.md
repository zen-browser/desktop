# Stage 7 - Mobile Split Plan

## Goal

Plan Android and iOS as separate products without mixing mobile work into the desktop repo.

## Repositories

- `nevai-browser-android`
- `nevai-browser-ios`

## Desktop Repo Rule

This repo remains `nevai-browser-desktop`.

Do not place Android or iOS app code in this repository.

## Android Direction

Recommended base:

- Firefox Android / Fenix / GeckoView ecosystem

First milestones:

- create repo
- build debug APK
- set package name
- set app name and icon
- set Nevai defaults
- document Mozilla/Firefox attribution requirements
- internal APK testing

## iOS Direction

Recommended early base:

- WKWebView browser shell or Firefox iOS-style fork

First milestones:

- create repo
- build simple browser shell
- set bundle ID
- set app name and icon
- tabs/history/bookmarks baseline
- TestFlight planning

## Shared Product Requirements

Mobile repos should share:

- Nevai brand assets
- privacy posture
- default search/start page decisions
- support channels
- release notes style
- issue labels

Shared assets should come from a future product/brand source, not by copying desktop build output.

## Do Not Do Yet

- do not start mobile implementation before desktop alpha foundation is stable
- do not promise Gecko on iOS globally
- do not add sync/accounts before privacy and backend strategy exists
- do not mix mobile CI into desktop CI
