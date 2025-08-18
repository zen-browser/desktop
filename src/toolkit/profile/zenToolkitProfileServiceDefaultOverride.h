/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef ZEN_TOOLKIT_PROFILE_OVERRIDE
#define ZEN_TOOLKIT_PROFILE_OVERRIDE "Default Profile"
#endif

#ifndef ZEN_DO_NOT_OVERRIDE_DEFAULT_PROFILE_NAME
#undef DEFAULT_NAME
#define DEFAULT_NAME ZEN_TOOLKIT_PROFILE_OVERRIDE
#endif
