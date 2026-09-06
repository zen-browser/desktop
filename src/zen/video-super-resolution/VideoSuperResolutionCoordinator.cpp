/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "VideoSuperResolutionCoordinator.h"

#include "VideoSuperResolutionScalePolicy.h"

namespace mozilla::zen {

VideoSuperResolutionCoordinator& VideoSuperResolutionCoordinator::Get() {
  static VideoSuperResolutionCoordinator sInstance;
  return sInstance;
}

VideoSuperResolutionCoordinator::VideoSuperResolutionCoordinator() = default;

VideoSuperResolutionCoordinator::PipelineState*
VideoSuperResolutionCoordinator::FindPipeline(uint64_t aPipeline) {
  for (auto& state : mPipelines) {
    if (state.pipeline == aPipeline) {
      return &state;
    }
  }
  return nullptr;
}

VideoSuperResolutionCoordinator::PipelineState&
VideoSuperResolutionCoordinator::EnsurePipeline(uint64_t aPipeline) {
  if (PipelineState* found = FindPipeline(aPipeline)) {
    return *found;
  }
  if (mPipelines.Length() >= 16) {
    mPipelines[0] = PipelineState{};
    mPipelines[0].pipeline = aPipeline;
    return mPipelines[0];
  }
  PipelineState* appended = mPipelines.AppendElement(PipelineState{});
  appended->pipeline = aPipeline;
  return *appended;
}

bool VideoSuperResolutionCoordinator::NoteSelected(
    uint64_t aPipeline, const SuperResolutionFrameToken& aToken) {
  MutexAutoLock lock(mLock);
  if (aPipeline == 0 || !aToken.HasIdentity()) {
    return false;
  }

  PipelineState& state = EnsurePipeline(aPipeline);

  const bool unique = !state.hasSelected || state.lastSelected != aToken;
  if (unique) {
    if (state.hasSelected &&
        (!state.lastSelected.MatchesStream(aToken) ||
         aToken.frame < state.lastSelected.frame)) {
      state.completed.Clear();
      state.hasPresented = false;
    }
    state.hasSelected = true;
    state.lastSelected = aToken;
  }
  return unique;
}

bool VideoSuperResolutionCoordinator::LookupReady(
    uint64_t aPipeline, const SuperResolutionFrameToken& aCurrent,
    SuperResolutionFrameToken* aMatched) {
  MutexAutoLock lock(mLock);
  PipelineState* state = FindPipeline(aPipeline);
  if (!state || !aCurrent.HasIdentity()) {
    return false;
  }

  const SuperResolutionFrameToken* best = nullptr;
  for (const auto& candidate : state->completed) {
    if (!aCurrent.MatchesStream(candidate)) {
      continue;
    }
    const int64_t lag = static_cast<int64_t>(aCurrent.frame) -
                        static_cast<int64_t>(candidate.frame);
    if (lag < 0 || lag > kMaxFrameLag ||
        (state->hasPresented && state->lastPresented.MatchesStream(candidate) &&
         candidate.frame < state->lastPresented.frame)) {
      continue;
    }
    if (!best || candidate.frame > best->frame) {
      best = &candidate;
    }
  }
  if (best) {
    if (aMatched) {
      *aMatched = *best;
    }
    return true;
  }
  return false;
}

bool VideoSuperResolutionCoordinator::NoteExternalCompleted(
    uint64_t aPipeline, const SuperResolutionFrameToken& aToken) {
  MutexAutoLock lock(mLock);
  PipelineState* state = FindPipeline(aPipeline);
  if (!state || !state->hasSelected || !aToken.HasIdentity()) {
    return false;
  }

  const int64_t lag = static_cast<int64_t>(state->lastSelected.frame) -
                      static_cast<int64_t>(aToken.frame);
  if (!aToken.MatchesStream(state->lastSelected) || lag < 0 ||
      lag > kMaxFrameLag) {
    return false;
  }

  for (const auto& c : state->completed) {
    if (c == aToken) {
      return true;
    }
  }

  if (state->completed.Length() >= 8) {
    state->completed.RemoveElementAt(0);
  }
  state->completed.AppendElement(aToken);
  return true;
}

void VideoSuperResolutionCoordinator::NotePresented(
    uint64_t aPipeline, const SuperResolutionFrameToken& aToken) {
  MutexAutoLock lock(mLock);
  PipelineState* state = FindPipeline(aPipeline);
  if (!state) {
    return;
  }
  state->hasPresented = true;
  state->lastPresented = aToken;

  for (size_t i = 0; i < state->completed.Length();) {
    if (state->completed[i] == aToken ||
        state->completed[i].frame < aToken.frame) {
      state->completed.RemoveElementAt(i);
    } else {
      ++i;
    }
  }
}

bool VideoSuperResolutionCoordinator::WasPresented(
    uint64_t aPipeline, const SuperResolutionFrameToken& aToken) {
  MutexAutoLock lock(mLock);
  for (const auto& state : mPipelines) {
    if (state.pipeline == aPipeline) {
      return state.hasPresented && state.lastPresented == aToken;
    }
  }
  return false;
}

void VideoSuperResolutionCoordinator::InvalidatePipeline(uint64_t aPipeline) {
  MutexAutoLock lock(mLock);
  for (size_t i = 0; i < mPipelines.Length(); ++i) {
    if (mPipelines[i].pipeline == aPipeline) {
      mPipelines.RemoveElementAt(i);
      return;
    }
  }
}

void VideoSuperResolutionCoordinator::InvalidateAll() {
  MutexAutoLock lock(mLock);
  mPipelines.Clear();
}

uint64_t VideoSuperResolutionCoordinator::SyncConfigFromPrefs() {
  MutexAutoLock lock(mLock);
  const SuperResolutionConfig config =
      VideoSuperResolutionScalePolicy::ReadConfigFromPrefs();
  if (!mConfigInitialized || !mLastConfig.SemanticallyEquals(config)) {
    if (mConfigInitialized) {
      ++mConfigGeneration;
      mPipelines.Clear();
    }
    mLastConfig = config;
    mConfigInitialized = true;
  }
  return mConfigGeneration;
}

}  // namespace mozilla::zen
