/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenCommonUtils.h"

#include "mozilla/Services.h"
#include "nsIBaseWindow.h"
#include "nsIObserverService.h"
#include "nsIWidget.h"
#include "nsThreadUtils.h"

#include <algorithm>

#import <AppKit/AppKit.h>
#import <Carbon/Carbon.h>

static bool sPrepareGlobalSearchPanel = false;
static EventHandlerRef sHotkeyHandler = nullptr;
static EventHotKeyRef sHotkey = nullptr;
static UInt32 sHotkeyID = 0;
static nsString sRegisteredShortcut;
static uint64_t sActiveGlobalSearchPanelGeneration = 0;
static uint64_t sNextGlobalSearchPanelGeneration = 0;

@class ChildView;

@interface ZenGlobalSearchPanel : NSPanel {
 @private
  BOOL _zenCloseOnResignKey;
  BOOL _zenDrawsIntoWindowFrame;
  BOOL _zenIsBeingShown;
  BOOL _zenAnimationSuppressed;
  uint64_t _zenDeactivationGeneration;
  mozilla::WindowShadow _zenShadowStyle;
}
- (void)zenArmDeactivation;
@end

@implementation ZenGlobalSearchPanel

- (instancetype)initWithContentRect:(NSRect)aContentRect
                          styleMask:(NSWindowStyleMask)aStyleMask
                            backing:(NSBackingStoreType)aBackingType
                              defer:(BOOL)aFlag {
  NSWindowStyleMask style =
      NSWindowStyleMaskBorderless | NSWindowStyleMaskNonactivatingPanel;
  self = [super initWithContentRect:aContentRect
                          styleMask:style
                            backing:aBackingType
                              defer:aFlag];
  if (self) {
    self.floatingPanel = YES;
    self.hidesOnDeactivate = NO;
    self.worksWhenModal = YES;
    self.opaque = NO;
    self.backgroundColor = NSColor.clearColor;
    self.hasShadow = NO;
    // Gecko owns this native window through nsCocoaWindow and balances its
    // allocation by closing it from DestroyNativeWindow. Keep the standard
    // BaseWindow ownership contract so a failed/early chrome load cannot
    // leave the NSPanel detached from its Gecko host.
    self.releasedWhenClosed = YES;
    self.animationBehavior = NSWindowAnimationBehaviorUtilityWindow;
    _zenCloseOnResignKey = NO;
    _zenDrawsIntoWindowFrame = NO;
    _zenIsBeingShown = NO;
    _zenAnimationSuppressed = NO;
    _zenDeactivationGeneration = 0;
    _zenShadowStyle = mozilla::WindowShadow::None;
  }
  return self;
}

- (void)setOpaque:(BOOL)aOpaque {
  // nsCocoaWindow marks every non-popup top-level window opaque after native
  // construction. This specific host is component-shaped and must preserve
  // alpha around Gecko's URL-bar surface.
  [super setOpaque:NO];
}

// nsCocoaWindow normally creates a BaseWindow subclass. An actual NSPanel
// cannot also inherit BaseWindow, so this class supplies the narrow BaseWindow
// selector contract used by a borderless top-level Gecko host. Keeping the
// compatibility surface here lets every ordinary browser/standalone remain a
// normal BaseWindow-backed NSWindow.
- (NSRect)childViewRectForFrameRect:(NSRect)aFrameRect {
  return aFrameRect;
}

- (NSRect)frameRectForChildViewRect:(NSRect)aChildViewRect {
  return aChildViewRect;
}

- (NSRect)childViewFrameRectForCurrentBounds {
  return self.contentView.bounds;
}

- (void)updateChildViewFrameRect {
  ((NSView*)self.mainChildView).frame = self.childViewFrameRectForCurrentBounds;
}

- (ChildView*)mainChildView {
  return (ChildView*)self.contentView.subviews.lastObject;
}

- (NSArray<NSView*>*)contentViewContents {
  return [[self.contentView.subviews copy] autorelease];
}

- (void)setDrawsContentsIntoWindowFrame:(BOOL)aState {
  _zenDrawsIntoWindowFrame = aState;
}

- (BOOL)drawsContentsIntoWindowFrame {
  return _zenDrawsIntoWindowFrame;
}

- (void)setIsBeingShown:(BOOL)aState {
  _zenIsBeingShown = aState;
}

- (BOOL)isBeingShown {
  return _zenIsBeingShown;
}

- (BOOL)isVisibleOrBeingShown {
  return self.visible || _zenIsBeingShown;
}

- (void)setIsAnimationSuppressed:(BOOL)aState {
  _zenAnimationSuppressed = aState;
}

- (BOOL)isAnimationSuppressed {
  return _zenAnimationSuppressed;
}

- (NSTimeInterval)animationResizeTime:(NSRect)aNewFrame {
  return _zenAnimationSuppressed ? 0.0 : [super animationResizeTime:aNewFrame];
}

- (void)disableSetNeedsDisplay {
}
- (void)enableSetNeedsDisplay {
}
- (void)createTrackingArea {
}
- (void)removeTrackingArea {
}

- (NSMutableDictionary*)exportState {
  return [[@{
    @"title" : self.title ?: @"",
    @"drawsContentsIntoWindowFrame" : @(_zenDrawsIntoWindowFrame),
    @"collectionBehavior" : @(self.collectionBehavior),
  } mutableCopy] autorelease];
}

- (void)importState:(NSDictionary*)aState {
  NSString* title = aState[@"title"];
  if (title) {
    self.title = title;
  }
  _zenDrawsIntoWindowFrame =
      [aState[@"drawsContentsIntoWindowFrame"] boolValue];
  NSNumber* behavior = aState[@"collectionBehavior"];
  if (behavior) {
    self.collectionBehavior = behavior.unsignedIntegerValue;
  }
}

- (void)setEffectViewWrapperForStyle:(mozilla::WindowShadow)aStyle {
  _zenShadowStyle = aStyle;
}

- (void)setShadowStyle:(mozilla::WindowShadow)aStyle {
  _zenShadowStyle = aStyle;
}

- (mozilla::WindowShadow)shadowStyle {
  return _zenShadowStyle;
}

- (void)updateTitlebarTransparency {
}
- (void)releaseJSObjects {
}

- (BOOL)canBecomeKeyWindow {
  return YES;
}
- (BOOL)canBecomeMainWindow {
  return NO;
}

- (void)zenArmDeactivation {
  _zenCloseOnResignKey = YES;
  _zenDeactivationGeneration = ++sNextGlobalSearchPanelGeneration;
  sActiveGlobalSearchPanelGeneration = _zenDeactivationGeneration;
}

- (void)close {
  if (_zenDeactivationGeneration == sActiveGlobalSearchPanelGeneration) {
    sActiveGlobalSearchPanelGeneration = 0;
  }
  [super close];
}

- (void)resignKeyWindow {
  [super resignKeyWindow];
  if (!_zenCloseOnResignKey) {
    return;
  }
  const uint64_t generation = _zenDeactivationGeneration;
  NS_DispatchToMainThread(NS_NewRunnableFunction(
      "ZenGlobalSearchPanelDeactivated", [generation] {
        if (!generation ||
            generation != sActiveGlobalSearchPanelGeneration) {
          return;
        }
        sActiveGlobalSearchPanelGeneration = 0;
        nsCOMPtr<nsIObserverService> observers =
            mozilla::services::GetObserverService();
        if (observers) {
          observers->NotifyObservers(
              nullptr, "zen-global-search-panel-deactivated", nullptr);
        }
      }));
}

@end

namespace {

static NSWindow* NativeWindow(nsIBaseWindow* aWindow) {
  if (!aWindow) {
    return nil;
  }
  nsCOMPtr<nsIWidget> widget = aWindow->GetMainWidget();
  return widget
             ? static_cast<NSWindow*>(widget->GetNativeData(NS_NATIVE_WINDOW))
             : nil;
}

static NSScreen* ActiveScreen() {
  NSPoint mouseLocation = NSEvent.mouseLocation;
  for (NSScreen* screen in NSScreen.screens) {
    if (NSPointInRect(mouseLocation, screen.frame)) {
      return screen;
    }
  }
  return NSScreen.mainScreen ?: NSScreen.screens.firstObject;
}

static bool KeyCodeForDOMCode(NSString* aCode, UInt32* aKeyCode) {
  static NSDictionary<NSString*, NSNumber*>* keyCodes = nil;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    keyCodes = [@{
      @"KeyA" : @(kVK_ANSI_A),
      @"KeyB" : @(kVK_ANSI_B),
      @"KeyC" : @(kVK_ANSI_C),
      @"KeyD" : @(kVK_ANSI_D),
      @"KeyE" : @(kVK_ANSI_E),
      @"KeyF" : @(kVK_ANSI_F),
      @"KeyG" : @(kVK_ANSI_G),
      @"KeyH" : @(kVK_ANSI_H),
      @"KeyI" : @(kVK_ANSI_I),
      @"KeyJ" : @(kVK_ANSI_J),
      @"KeyK" : @(kVK_ANSI_K),
      @"KeyL" : @(kVK_ANSI_L),
      @"KeyM" : @(kVK_ANSI_M),
      @"KeyN" : @(kVK_ANSI_N),
      @"KeyO" : @(kVK_ANSI_O),
      @"KeyP" : @(kVK_ANSI_P),
      @"KeyQ" : @(kVK_ANSI_Q),
      @"KeyR" : @(kVK_ANSI_R),
      @"KeyS" : @(kVK_ANSI_S),
      @"KeyT" : @(kVK_ANSI_T),
      @"KeyU" : @(kVK_ANSI_U),
      @"KeyV" : @(kVK_ANSI_V),
      @"KeyW" : @(kVK_ANSI_W),
      @"KeyX" : @(kVK_ANSI_X),
      @"KeyY" : @(kVK_ANSI_Y),
      @"KeyZ" : @(kVK_ANSI_Z),
      @"Digit0" : @(kVK_ANSI_0),
      @"Digit1" : @(kVK_ANSI_1),
      @"Digit2" : @(kVK_ANSI_2),
      @"Digit3" : @(kVK_ANSI_3),
      @"Digit4" : @(kVK_ANSI_4),
      @"Digit5" : @(kVK_ANSI_5),
      @"Digit6" : @(kVK_ANSI_6),
      @"Digit7" : @(kVK_ANSI_7),
      @"Digit8" : @(kVK_ANSI_8),
      @"Digit9" : @(kVK_ANSI_9),
      @"F1" : @(kVK_F1),
      @"F2" : @(kVK_F2),
      @"F3" : @(kVK_F3),
      @"F4" : @(kVK_F4),
      @"F5" : @(kVK_F5),
      @"F6" : @(kVK_F6),
      @"F7" : @(kVK_F7),
      @"F8" : @(kVK_F8),
      @"F9" : @(kVK_F9),
      @"F10" : @(kVK_F10),
      @"F11" : @(kVK_F11),
      @"F12" : @(kVK_F12),
      @"F13" : @(kVK_F13),
      @"F14" : @(kVK_F14),
      @"F15" : @(kVK_F15),
      @"F16" : @(kVK_F16),
      @"F17" : @(kVK_F17),
      @"F18" : @(kVK_F18),
      @"F19" : @(kVK_F19),
      @"F20" : @(kVK_F20),
    } retain];
  });
  NSNumber* value = keyCodes[aCode];
  if (!value) {
    return false;
  }
  *aKeyCode = value.unsignedIntValue;
  return true;
}

static bool ParseShortcut(const nsAString& aShortcut, UInt32* aKeyCode,
                          UInt32* aModifiers) {
  NSString* shortcut =
      [NSString stringWithCharacters:reinterpret_cast<const unichar*>(
                                         aShortcut.BeginReading())
                              length:aShortcut.Length()];
  NSArray<NSString*>* sides = [shortcut componentsSeparatedByString:@"|"];
  if (sides.count != 2 || !KeyCodeForDOMCode(sides[1], aKeyCode)) {
    return false;
  }

  UInt32 modifiers = 0;
  NSMutableSet<NSString*>* seen = [NSMutableSet set];
  for (NSString* modifier in [sides[0] componentsSeparatedByString:@","]) {
    if (!modifier.length || [seen containsObject:modifier]) {
      return false;
    }
    [seen addObject:modifier];
    if ([modifier isEqualToString:@"meta"]) {
      modifiers |= cmdKey;
    } else if ([modifier isEqualToString:@"alt"]) {
      modifiers |= optionKey;
    } else if ([modifier isEqualToString:@"control"]) {
      modifiers |= controlKey;
    } else if ([modifier isEqualToString:@"shift"]) {
      modifiers |= shiftKey;
    } else {
      return false;
    }
  }
  if (!(modifiers & (cmdKey | optionKey | controlKey))) {
    return false;
  }
  *aModifiers = modifiers;
  return true;
}

static OSStatus HandleGlobalSearchHotkey(EventHandlerCallRef, EventRef aEvent,
                                         void*) {
  EventHotKeyID hotkeyID;
  if (GetEventParameter(aEvent, kEventParamDirectObject, typeEventHotKeyID,
                        nullptr, sizeof(hotkeyID), nullptr,
                        &hotkeyID) != noErr ||
      hotkeyID.signature != 'ZenG' || hotkeyID.id != sHotkeyID) {
    return eventNotHandledErr;
  }
  NS_DispatchToMainThread(NS_NewRunnableFunction("ZenGlobalSearchHotkey", [] {
    nsCOMPtr<nsIObserverService> observers =
        mozilla::services::GetObserverService();
    if (observers) {
      observers->NotifyObservers(nullptr, "zen-global-standalone-search",
                                 nullptr);
    }
  }));
  return noErr;
}

static OSStatus EnsureHotkeyHandler() {
  if (sHotkeyHandler) {
    return noErr;
  }
  EventTypeSpec eventType = {kEventClassKeyboard, kEventHotKeyPressed};
  return InstallApplicationEventHandler(HandleGlobalSearchHotkey, 1, &eventType,
                                        nullptr, &sHotkeyHandler);
}

static void SetResult(nsAString& aResult, bool aOK, const char* aReason) {
  aResult.AssignLiteral(u"{\"ok\":");
  if (aOK) {
    aResult.AppendLiteral(u"true,\"reason\":\"");
  } else {
    aResult.AppendLiteral(u"false,\"reason\":\"");
  }
  aResult.Append(NS_ConvertASCIItoUTF16(aReason));
  aResult.AppendLiteral(u"\"}");
}

}  // namespace

// Called synchronously by nsCocoaWindow::CreateNativeWindow. Preparation is
// one-shot so no unrelated browser window can inherit the panel class.
Class ZenConsumePreparedGlobalSearchPanelClass() {
  if (!sPrepareGlobalSearchPanel) {
    return Nil;
  }
  sPrepareGlobalSearchPanel = false;
  return [ZenGlobalSearchPanel class];
}

namespace zen {

nsresult ZenCommonUtils::RegisterGlobalSearchHotkeyInternal(
    const nsAString& aShortcut, nsAString& aResult) {
  MOZ_ASSERT(NS_IsMainThread());
  if (aShortcut.Equals(sRegisteredShortcut) && sHotkey) {
    SetResult(aResult, true, "registered");
    return NS_OK;
  }

  UInt32 keyCode;
  UInt32 modifiers;
  if (!ParseShortcut(aShortcut, &keyCode, &modifiers)) {
    SetResult(aResult, false, "invalid");
    return NS_OK;
  }
  if (EnsureHotkeyHandler() != noErr) {
    SetResult(aResult, false, "registration-failed");
    return NS_OK;
  }

  EventHotKeyRef replacement = nullptr;
  EventHotKeyID hotkeyID = {'ZenG', sHotkeyID + 1};
  OSStatus status =
      RegisterEventHotKey(keyCode, modifiers, hotkeyID,
                          GetApplicationEventTarget(), 0, &replacement);
  if (status != noErr) {
    SetResult(
        aResult, false,
        status == eventHotKeyExistsErr ? "conflict" : "registration-failed");
    return NS_OK;
  }

  if (sHotkey) {
    UnregisterEventHotKey(sHotkey);
  }
  sHotkey = replacement;
  sHotkeyID = hotkeyID.id;
  sRegisteredShortcut.Assign(aShortcut);
  SetResult(aResult, true, "registered");
  return NS_OK;
}

void ZenCommonUtils::UnregisterGlobalSearchHotkeyInternal() {
  if (sHotkey) {
    UnregisterEventHotKey(sHotkey);
    sHotkey = nullptr;
  }
  sRegisteredShortcut.Truncate();
}

void ZenCommonUtils::PrepareGlobalSearchPanelInternal() {
  MOZ_ASSERT(NS_IsMainThread());
  sPrepareGlobalSearchPanel = true;
}

void ZenCommonUtils::CancelPreparedGlobalSearchPanelInternal() {
  MOZ_ASSERT(NS_IsMainThread());
  sPrepareGlobalSearchPanel = false;
}

nsresult ZenCommonUtils::ConfigureGlobalSearchPanelInternal(
    nsIBaseWindow* aWindow, int32_t aWidth, int32_t aHeight) {
  nsCOMPtr<nsIWidget> widget = aWindow ? aWindow->GetMainWidget() : nullptr;
  if (!widget) {
    return NS_ERROR_INVALID_ARG;
  }
  widget->SetTransparencyMode(
      mozilla::widget::TransparencyMode::Transparent);

  NSWindow* window = NativeWindow(aWindow);
  if (![window isKindOfClass:[ZenGlobalSearchPanel class]]) {
    return NS_ERROR_INVALID_ARG;
  }

  NSScreen* screen = ActiveScreen();
  if (!screen) {
    return NS_ERROR_FAILURE;
  }
  NSRect available = screen.visibleFrame;
  CGFloat width =
      std::min<CGFloat>(std::max(aWidth, 320), available.size.width);
  CGFloat height =
      std::min<CGFloat>(std::max(aHeight, 64), available.size.height);
  NSRect frame = NSMakeRect(NSMidX(available) - width / 2.0,
                            NSMaxY(available) - height - 48.0, width, height);

  window.level = NSFloatingWindowLevel;
  window.opaque = NO;
  window.backgroundColor = NSColor.clearColor;
  window.hasShadow = NO;
  window.contentView.wantsLayer = YES;
  window.contentView.layer.opaque = NO;
  window.contentView.layer.backgroundColor = NSColor.clearColor.CGColor;
  window.contentMinSize = NSMakeSize(1.0, 1.0);
  window.minSize = NSMakeSize(1.0, 1.0);
  window.collectionBehavior = NSWindowCollectionBehaviorMoveToActiveSpace |
                              NSWindowCollectionBehaviorTransient |
                              NSWindowCollectionBehaviorFullScreenAuxiliary;
  [window setFrame:frame display:YES];
  [NSApp removeWindowsItem:window];
  [(ZenGlobalSearchPanel*)window zenArmDeactivation];
  [window orderFrontRegardless];
  [window makeKeyWindow];
  return NS_OK;
}

bool ZenCommonUtils::IsGlobalSearchPanelInternal(nsIBaseWindow* aWindow) {
  return [NativeWindow(aWindow) isKindOfClass:[ZenGlobalSearchPanel class]];
}

}  // namespace zen
