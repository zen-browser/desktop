// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
/**
 * NOTE: Do not modify this file by hand.
 * Content was generated from source XPCOM .idl files.
 * If you're updating some of the sources, see README for instructions.
 */

declare global {
  // https://searchfox.org/mozilla-central/source/toolkit/components/bitsdownload/nsIBits.idl

  interface nsIBits extends nsISupports {
    readonly ERROR_TYPE_SUCCESS?: 0;
    readonly ERROR_TYPE_UNKNOWN?: 1;
    readonly ERROR_TYPE_METHOD_THREW?: 2;
    readonly ERROR_TYPE_METHOD_TIMEOUT?: 3;
    readonly ERROR_TYPE_NULL_ARGUMENT?: 4;
    readonly ERROR_TYPE_INVALID_ARGUMENT?: 5;
    readonly ERROR_TYPE_NOT_INITIALIZED?: 6;
    readonly ERROR_TYPE_NO_UTF8_CONVERSION?: 7;
    readonly ERROR_TYPE_INVALID_GUID?: 8;
    readonly ERROR_TYPE_PIPE_NOT_CONNECTED?: 9;
    readonly ERROR_TYPE_PIPE_TIMEOUT?: 10;
    readonly ERROR_TYPE_PIPE_BAD_WRITE_COUNT?: 11;
    readonly ERROR_TYPE_PIPE_API_ERROR?: 12;
    readonly ERROR_TYPE_FAILED_TO_CREATE_BITS_JOB?: 13;
    readonly ERROR_TYPE_FAILED_TO_ADD_FILE_TO_JOB?: 14;
    readonly ERROR_TYPE_FAILED_TO_APPLY_BITS_JOB_SETTINGS?: 15;
    readonly ERROR_TYPE_FAILED_TO_RESUME_BITS_JOB?: 16;
    readonly ERROR_TYPE_OTHER_BITS_ERROR?: 17;
    readonly ERROR_TYPE_OTHER_BITS_CLIENT_ERROR?: 18;
    readonly ERROR_TYPE_BITS_JOB_NOT_FOUND?: 19;
    readonly ERROR_TYPE_FAILED_TO_GET_BITS_JOB?: 20;
    readonly ERROR_TYPE_FAILED_TO_SUSPEND_BITS_JOB?: 21;
    readonly ERROR_TYPE_FAILED_TO_COMPLETE_BITS_JOB?: 22;
    readonly ERROR_TYPE_PARTIALLY_COMPLETED_BITS_JOB?: 23;
    readonly ERROR_TYPE_FAILED_TO_CANCEL_BITS_JOB?: 24;
    readonly ERROR_TYPE_MISSING_RESULT_DATA?: 25;
    readonly ERROR_TYPE_MISSING_CALLBACK?: 26;
    readonly ERROR_TYPE_CALLBACK_ON_WRONG_THREAD?: 27;
    readonly ERROR_TYPE_MISSING_BITS_SERVICE?: 28;
    readonly ERROR_TYPE_BITS_SERVICE_ON_WRONG_THREAD?: 29;
    readonly ERROR_TYPE_MISSING_BITS_REQUEST?: 30;
    readonly ERROR_TYPE_BITS_REQUEST_ON_WRONG_THREAD?: 31;
    readonly ERROR_TYPE_MISSING_OBSERVER?: 32;
    readonly ERROR_TYPE_OBSERVER_ON_WRONG_THREAD?: 33;
    readonly ERROR_TYPE_MISSING_CONTEXT?: 34;
    readonly ERROR_TYPE_CONTEXT_ON_WRONG_THREAD?: 35;
    readonly ERROR_TYPE_FAILED_TO_START_THREAD?: 36;
    readonly ERROR_TYPE_FAILED_TO_CONSTRUCT_TASK_RUNNABLE?: 37;
    readonly ERROR_TYPE_FAILED_TO_DISPATCH_RUNNABLE?: 38;
    readonly ERROR_TYPE_TRANSFER_ALREADY_COMPLETE?: 39;
    readonly ERROR_TYPE_OPERATION_ALREADY_IN_PROGRESS?: 40;
    readonly ERROR_TYPE_MISSING_BITS_CLIENT?: 41;
    readonly ERROR_TYPE_FAILED_TO_GET_JOB_STATUS?: 42;
    readonly ERROR_TYPE_BITS_STATE_ERROR?: 43;
    readonly ERROR_TYPE_BITS_STATE_TRANSIENT_ERROR?: 44;
    readonly ERROR_TYPE_BITS_STATE_CANCELLED?: 45;
    readonly ERROR_TYPE_BITS_STATE_UNEXPECTED?: 46;
    readonly ERROR_TYPE_VERIFICATION_FAILURE?: 47;
    readonly ERROR_TYPE_ACCESS_DENIED_EXPECTED?: 48;
    readonly ERROR_TYPE_FAILED_TO_CONNECT_TO_BCM?: 49;
    readonly ERROR_TYPE_USE_AFTER_REQUEST_SHUTDOWN?: 50;
    readonly ERROR_TYPE_BROWSER_SHUTTING_DOWN?: 51;
    readonly ERROR_ACTION_UNKNOWN?: 1;
    readonly ERROR_ACTION_NONE?: 2;
    readonly ERROR_ACTION_START_DOWNLOAD?: 3;
    readonly ERROR_ACTION_MONITOR_DOWNLOAD?: 4;
    readonly ERROR_ACTION_CHANGE_MONITOR_INTERVAL?: 5;
    readonly ERROR_ACTION_CANCEL?: 6;
    readonly ERROR_ACTION_SET_PRIORITY?: 7;
    readonly ERROR_ACTION_COMPLETE?: 8;
    readonly ERROR_ACTION_SUSPEND?: 9;
    readonly ERROR_ACTION_RESUME?: 10;
    readonly ERROR_ACTION_SET_NO_PROGRESS_TIMEOUT?: 11;
    readonly ERROR_STAGE_UNKNOWN?: 1;
    readonly ERROR_STAGE_PRETASK?: 2;
    readonly ERROR_STAGE_COMMAND_THREAD?: 3;
    readonly ERROR_STAGE_AGENT_COMMUNICATION?: 4;
    readonly ERROR_STAGE_BITS_CLIENT?: 5;
    readonly ERROR_STAGE_MAIN_THREAD?: 6;
    readonly ERROR_STAGE_MONITOR?: 7;
    readonly ERROR_STAGE_VERIFICATION?: 8;
    readonly ERROR_CODE_TYPE_NONE?: 1;
    readonly ERROR_CODE_TYPE_NSRESULT?: 2;
    readonly ERROR_CODE_TYPE_HRESULT?: 3;
    readonly ERROR_CODE_TYPE_STRING?: 4;
    readonly ERROR_CODE_TYPE_EXCEPTION?: 5;
    readonly PROXY_NONE?: 1;
    readonly PROXY_PRECONFIG?: 2;
    readonly PROXY_AUTODETECT?: 3;

    readonly initialized: boolean;
    init(jobName: string, savePathPrefix: string, monitorTimeoutMs: u32): void;
    startDownload(
      downloadURL: string,
      saveRelativePath: string,
      proxy: nsProxyUsage,
      noProgressTimeoutSecs: u32,
      monitorIntervalMs: u32,
      customHeaders: string,
      observer: nsIRequestObserver,
      context: nsISupports,
      callback: nsIBitsNewRequestCallback
    ): void;
    monitorDownload(
      id: string,
      monitorIntervalMs: u32,
      observer: nsIRequestObserver,
      context: nsISupports,
      callback: nsIBitsNewRequestCallback
    ): void;
  }

  interface nsIBitsNewRequestCallback extends nsISupports {
    success(request: nsIBitsRequest): void;
    failure(
      errorType: nsBitsErrorType,
      errorAction: nsBitsErrorAction,
      errorStage: nsBitsErrorStage
    ): void;
    failureNsresult(
      errorType: nsBitsErrorType,
      errorAction: nsBitsErrorAction,
      errorStage: nsBitsErrorStage,
      errorCode: nsresult
    ): void;
    failureHresult(
      errorType: nsBitsErrorType,
      errorAction: nsBitsErrorAction,
      errorStage: nsBitsErrorStage,
      errorCode: i32
    ): void;
    failureString(
      errorType: nsBitsErrorType,
      errorAction: nsBitsErrorAction,
      errorStage: nsBitsErrorStage,
      errorMessage: string
    ): void;
  }

  interface nsIBitsRequest extends nsIRequest {
    readonly bitsId: string;
    readonly transferError: nsBitsErrorType;
    changeMonitorInterval(monitorIntervalMs: u32, callback: nsIBitsCallback): void;
    cancelAsync(status: nsresult, callback: nsIBitsCallback): void;
    setPriorityHigh(callback: nsIBitsCallback): void;
    setPriorityLow(callback: nsIBitsCallback): void;
    setNoProgressTimeout(timeoutSecs: u32, callback: nsIBitsCallback): void;
    complete(callback: nsIBitsCallback): void;
    suspendAsync(callback: nsIBitsCallback): void;
    resumeAsync(callback: nsIBitsCallback): void;
  }

  interface nsIBitsCallback extends nsISupports {
    success(): void;
    failure(
      errorType: nsBitsErrorType,
      errorAction: nsBitsErrorAction,
      errorStage: nsBitsErrorStage
    ): void;
    failureNsresult(
      errorType: nsBitsErrorType,
      errorAction: nsBitsErrorAction,
      errorStage: nsBitsErrorStage,
      errorCode: nsresult
    ): void;
    failureHresult(
      errorType: nsBitsErrorType,
      errorAction: nsBitsErrorAction,
      errorStage: nsBitsErrorStage,
      errorCode: i32
    ): void;
    failureString(
      errorType: nsBitsErrorType,
      errorAction: nsBitsErrorAction,
      errorStage: nsBitsErrorStage,
      errorMessage: string
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibilityService.idl

  interface nsIAccessibilityService extends nsISupports {
    getApplicationAccessible(): nsIAccessible;
    getAccessibleFor(aNode: Node): nsIAccessible;
    getAccessibleDescendantFor(aNode: Node): nsIAccessible;
    getStringRole(aRole: u32): string;
    getStringStates(aStates: u32, aExtraStates: u32): nsISupports;
    getStringEventType(aEventType: u32): string;
    getStringRelationType(aRelationType: u32): string;
    getAccessibleFromCache(aNode: Node): nsIAccessible;
    setCacheDomains(aCacheDomains: u64): void;
    createAccessiblePivot(aRoot: nsIAccessible): nsIAccessiblePivot;
    createTextLeafPoint(aAccessible: nsIAccessible, aOffset: i32): nsIAccessibleTextLeafPoint;
    setLogging(aModules: string): void;
    isLogged(aModule: string): boolean;
    getConsumers(): string;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessible.idl

  interface nsIAccessible extends nsISupports {
    readonly parent: nsIAccessible;
    readonly nextSibling: nsIAccessible;
    readonly previousSibling: nsIAccessible;
    readonly firstChild: nsIAccessible;
    readonly lastChild: nsIAccessible;
    readonly children: nsIArray;
    readonly childCount: i32;
    readonly indexInParent: i32;
    readonly uniqueID: i64;
    readonly DOMNode: Node;
    readonly id: string;
    readonly document: nsIAccessibleDocument;
    readonly rootDocument: nsIAccessibleDocument;
    readonly language: string;
    readonly name: string;
    readonly value: string;
    readonly description: string;
    readonly accessKey: string;
    readonly keyboardShortcut: string;
    readonly role: u32;
    getState(aState: OutParam<u32>, aExtraState: OutParam<u32>): void;
    readonly focusedChild: nsIAccessible;
    readonly attributes: nsIPersistentProperties;
    readonly cache: nsIPersistentProperties;
    readonly nativeInterface: nsISupports;
    groupPosition(
      aGroupLevel: OutParam<i32>,
      aSimilarItemsInGroup: OutParam<i32>,
      aPositionInGroup: OutParam<i32>
    ): void;
    getChildAtPoint(x: i32, y: i32): nsIAccessible;
    getDeepestChildAtPoint(x: i32, y: i32): nsIAccessible;
    getDeepestChildAtPointInProcess(x: i32, y: i32): nsIAccessible;
    getChildAt(aChildIndex: i32): nsIAccessible;
    getRelationByType(aRelationType: u32): nsIAccessibleRelation;
    getRelations(): nsIArray;
    getBounds(
      x: OutParam<i32>,
      y: OutParam<i32>,
      width: OutParam<i32>,
      height: OutParam<i32>
    ): void;
    getBoundsInCSSPixels(
      aX: OutParam<i32>,
      aY: OutParam<i32>,
      aWidth: OutParam<i32>,
      aHeight: OutParam<i32>
    ): void;
    setSelected(isSelected: boolean): void;
    takeSelection(): void;
    takeFocus(): void;
    readonly actionCount: u8;
    getActionName(index: u8): string;
    getActionDescription(aIndex: u8): string;
    doAction(index: u8): void;
    scrollTo(aScrollType: u32): void;
    scrollToPoint(coordinateType: u32, x: i32, y: i32): void;
    announce(announcement: string, priority: u16): void;
    readonly computedARIARole: string;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleAnnouncementEvent.idl

  interface nsIAccessibleAnnouncementEvent extends nsIAccessibleEvent {
    readonly POLITE?: 0;
    readonly ASSERTIVE?: 1;

    readonly announcement: string;
    readonly priority: u16;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleApplication.idl

  interface nsIAccessibleApplication extends nsISupports {
    readonly appName: string;
    readonly appVersion: string;
    readonly platformName: string;
    readonly platformVersion: string;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleCaretMoveEvent.idl

  interface nsIAccessibleCaretMoveEvent extends nsIAccessibleEvent {
    readonly caretOffset: i32;
    readonly isSelectionCollapsed: boolean;
    readonly isAtEndOfLine: boolean;
    readonly granularity: i32;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleDocument.idl

  interface nsIAccessibleDocument extends nsISupports {
    readonly URL: string;
    readonly title: string;
    readonly mimeType: string;
    readonly docType: string;
    readonly DOMDocument: Document;
    readonly window: mozIDOMWindowProxy;
    readonly parentDocument: nsIAccessibleDocument;
    readonly childDocumentCount: u32;
    getChildDocumentAt(index: u32): nsIAccessibleDocument;
    readonly browsingContext: BrowsingContext;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleEditableText.idl

  interface nsIAccessibleEditableText extends nsISupports {
    setTextContents(text: string): void;
    insertText(text: string, position: i32): void;
    copyText(startPos: i32, endPos: i32): void;
    cutText(startPos: i32, endPos: i32): void;
    deleteText(startPos: i32, endPos: i32): void;
    pasteText(position: i32): void;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleEvent.idl

  interface nsIAccessibleEvent extends nsISupports {
    readonly EVENT_SHOW?: 1;
    readonly EVENT_HIDE?: 2;
    readonly EVENT_REORDER?: 3;
    readonly EVENT_FOCUS?: 4;
    readonly EVENT_STATE_CHANGE?: 5;
    readonly EVENT_NAME_CHANGE?: 6;
    readonly EVENT_DESCRIPTION_CHANGE?: 7;
    readonly EVENT_VALUE_CHANGE?: 8;
    readonly EVENT_SELECTION?: 9;
    readonly EVENT_SELECTION_ADD?: 10;
    readonly EVENT_SELECTION_REMOVE?: 11;
    readonly EVENT_SELECTION_WITHIN?: 12;
    readonly EVENT_ALERT?: 13;
    readonly EVENT_MENU_START?: 14;
    readonly EVENT_MENU_END?: 15;
    readonly EVENT_MENUPOPUP_START?: 16;
    readonly EVENT_MENUPOPUP_END?: 17;
    readonly EVENT_DRAGDROP_START?: 18;
    readonly EVENT_SCROLLING_START?: 19;
    readonly EVENT_SCROLLING_END?: 20;
    readonly EVENT_DOCUMENT_LOAD_COMPLETE?: 21;
    readonly EVENT_DOCUMENT_RELOAD?: 22;
    readonly EVENT_DOCUMENT_LOAD_STOPPED?: 23;
    readonly EVENT_TEXT_ATTRIBUTE_CHANGED?: 24;
    readonly EVENT_TEXT_CARET_MOVED?: 25;
    readonly EVENT_TEXT_INSERTED?: 26;
    readonly EVENT_TEXT_REMOVED?: 27;
    readonly EVENT_TEXT_SELECTION_CHANGED?: 28;
    readonly EVENT_WINDOW_ACTIVATE?: 29;
    readonly EVENT_WINDOW_DEACTIVATE?: 30;
    readonly EVENT_WINDOW_MAXIMIZE?: 31;
    readonly EVENT_WINDOW_MINIMIZE?: 32;
    readonly EVENT_WINDOW_RESTORE?: 33;
    readonly EVENT_OBJECT_ATTRIBUTE_CHANGED?: 34;
    readonly EVENT_TEXT_VALUE_CHANGE?: 35;
    readonly EVENT_SCROLLING?: 36;
    readonly EVENT_ANNOUNCEMENT?: 37;
    readonly EVENT_LIVE_REGION_ADDED?: 38;
    readonly EVENT_LIVE_REGION_REMOVED?: 39;
    readonly EVENT_INNER_REORDER?: 40;
    readonly EVENT_LIVE_REGION_CHANGED?: 41;
    readonly EVENT_LAST_ENTRY?: 42;

    readonly eventType: u32;
    readonly accessible: nsIAccessible;
    readonly accessibleDocument: nsIAccessibleDocument;
    readonly DOMNode: Node;
    readonly isFromUserInput: boolean;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleHideEvent.idl

  interface nsIAccessibleHideEvent extends nsIAccessibleEvent {
    readonly targetParent: nsIAccessible;
    readonly targetNextSibling: nsIAccessible;
    readonly targetPrevSibling: nsIAccessible;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleHyperLink.idl

  interface nsIAccessibleHyperLink extends nsISupports {
    readonly startIndex: i32;
    readonly endIndex: i32;
    readonly valid: boolean;
    readonly anchorCount: i32;
    getURI(index: i32): nsIURI;
    getAnchor(index: i32): nsIAccessible;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleHyperText.idl

  interface nsIAccessibleHyperText extends nsISupports {
    readonly linkCount: i32;
    getLinkAt(index: i32): nsIAccessibleHyperLink;
    getLinkIndex(link: nsIAccessibleHyperLink): i32;
    getLinkIndexAtOffset(offset: i32): i32;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleImage.idl

  interface nsIAccessibleImage extends nsISupports {
    getImagePosition(coordType: u32, x: OutParam<i32>, y: OutParam<i32>): void;
    getImageSize(width: OutParam<i32>, height: OutParam<i32>): void;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleObjectAttributeChangedEvent.idl

  interface nsIAccessibleObjectAttributeChangedEvent extends nsIAccessibleEvent {
    readonly changedAttribute: string;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessiblePivot.idl

  interface nsIAccessiblePivot extends nsISupports {
    next(
      aAnchor: nsIAccessible,
      aRule: nsIAccessibleTraversalRule,
      aIncludeStart?: boolean
    ): nsIAccessible;
    prev(
      aAnchor: nsIAccessible,
      aRule: nsIAccessibleTraversalRule,
      aIncludeStart?: boolean
    ): nsIAccessible;
    first(aRule: nsIAccessibleTraversalRule): nsIAccessible;
    last(aRule: nsIAccessibleTraversalRule): nsIAccessible;
    atPoint(aX: i32, aY: i32, aRule: nsIAccessibleTraversalRule): nsIAccessible;
  }

  interface nsIAccessibleTraversalRule extends nsISupports {
    readonly FILTER_IGNORE?: 0;
    readonly FILTER_MATCH?: 1;
    readonly FILTER_IGNORE_SUBTREE?: 2;

    match(aAccessible: nsIAccessible): u16;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleRelation.idl

  interface nsIAccessibleRelation extends nsISupports {
    readonly RELATION_LABELLED_BY?: 0;
    readonly RELATION_LABEL_FOR?: 1;
    readonly RELATION_DESCRIBED_BY?: 2;
    readonly RELATION_DESCRIPTION_FOR?: 3;
    readonly RELATION_NODE_CHILD_OF?: 4;
    readonly RELATION_NODE_PARENT_OF?: 5;
    readonly RELATION_CONTROLLED_BY?: 6;
    readonly RELATION_CONTROLLER_FOR?: 7;
    readonly RELATION_FLOWS_TO?: 8;
    readonly RELATION_FLOWS_FROM?: 9;
    readonly RELATION_MEMBER_OF?: 10;
    readonly RELATION_SUBWINDOW_OF?: 11;
    readonly RELATION_EMBEDS?: 12;
    readonly RELATION_EMBEDDED_BY?: 13;
    readonly RELATION_POPUP_FOR?: 14;
    readonly RELATION_PARENT_WINDOW_OF?: 15;
    readonly RELATION_DEFAULT_BUTTON?: 16;
    readonly RELATION_CONTAINING_DOCUMENT?: 17;
    readonly RELATION_CONTAINING_TAB_PANE?: 18;
    readonly RELATION_CONTAINING_WINDOW?: 19;
    readonly RELATION_CONTAINING_APPLICATION?: 20;
    readonly RELATION_DETAILS?: 21;
    readonly RELATION_DETAILS_FOR?: 22;
    readonly RELATION_ERRORMSG?: 23;
    readonly RELATION_ERRORMSG_FOR?: 24;
    readonly RELATION_LINKS_TO?: 25;

    readonly relationType: u32;
    readonly targetsCount: u32;
    getTarget(index: u32): nsIAccessible;
    getTargets(): nsIArray;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleRole.idl

  interface nsIAccessibleRole extends nsISupports {
    readonly ROLE_NOTHING?: 0;
    readonly ROLE_MENUBAR?: 1;
    readonly ROLE_SCROLLBAR?: 2;
    readonly ROLE_ALERT?: 3;
    readonly ROLE_INTERNAL_FRAME?: 4;
    readonly ROLE_MENUPOPUP?: 5;
    readonly ROLE_MENUITEM?: 6;
    readonly ROLE_TOOLTIP?: 7;
    readonly ROLE_APPLICATION?: 8;
    readonly ROLE_DOCUMENT?: 9;
    readonly ROLE_PANE?: 10;
    readonly ROLE_DIALOG?: 11;
    readonly ROLE_GROUPING?: 12;
    readonly ROLE_SEPARATOR?: 13;
    readonly ROLE_TOOLBAR?: 14;
    readonly ROLE_STATUSBAR?: 15;
    readonly ROLE_TABLE?: 16;
    readonly ROLE_COLUMNHEADER?: 17;
    readonly ROLE_ROWHEADER?: 18;
    readonly ROLE_ROW?: 19;
    readonly ROLE_CELL?: 20;
    readonly ROLE_LINK?: 21;
    readonly ROLE_LIST?: 22;
    readonly ROLE_LISTITEM?: 23;
    readonly ROLE_OUTLINE?: 24;
    readonly ROLE_OUTLINEITEM?: 25;
    readonly ROLE_PAGETAB?: 26;
    readonly ROLE_PROPERTYPAGE?: 27;
    readonly ROLE_GRAPHIC?: 28;
    readonly ROLE_STATICTEXT?: 29;
    readonly ROLE_TEXT_LEAF?: 30;
    readonly ROLE_PUSHBUTTON?: 31;
    readonly ROLE_CHECKBUTTON?: 32;
    readonly ROLE_RADIOBUTTON?: 33;
    readonly ROLE_COMBOBOX?: 34;
    readonly ROLE_PROGRESSBAR?: 35;
    readonly ROLE_SLIDER?: 36;
    readonly ROLE_SPINBUTTON?: 37;
    readonly ROLE_DIAGRAM?: 38;
    readonly ROLE_ANIMATION?: 39;
    readonly ROLE_BUTTONDROPDOWN?: 40;
    readonly ROLE_BUTTONMENU?: 41;
    readonly ROLE_WHITESPACE?: 42;
    readonly ROLE_PAGETABLIST?: 43;
    readonly ROLE_CANVAS?: 44;
    readonly ROLE_CHECK_MENU_ITEM?: 45;
    readonly ROLE_DATE_EDITOR?: 46;
    readonly ROLE_CHROME_WINDOW?: 47;
    readonly ROLE_LABEL?: 48;
    readonly ROLE_PASSWORD_TEXT?: 49;
    readonly ROLE_RADIO_MENU_ITEM?: 50;
    readonly ROLE_TEXT_CONTAINER?: 51;
    readonly ROLE_TOGGLE_BUTTON?: 52;
    readonly ROLE_TREE_TABLE?: 53;
    readonly ROLE_PARAGRAPH?: 54;
    readonly ROLE_ENTRY?: 55;
    readonly ROLE_CAPTION?: 56;
    readonly ROLE_NON_NATIVE_DOCUMENT?: 57;
    readonly ROLE_HEADING?: 58;
    readonly ROLE_SECTION?: 59;
    readonly ROLE_FORM?: 60;
    readonly ROLE_APP_ROOT?: 61;
    readonly ROLE_PARENT_MENUITEM?: 62;
    readonly ROLE_COMBOBOX_LIST?: 63;
    readonly ROLE_COMBOBOX_OPTION?: 64;
    readonly ROLE_IMAGE_MAP?: 65;
    readonly ROLE_OPTION?: 66;
    readonly ROLE_RICH_OPTION?: 67;
    readonly ROLE_LISTBOX?: 68;
    readonly ROLE_FLAT_EQUATION?: 69;
    readonly ROLE_GRID_CELL?: 70;
    readonly ROLE_NOTE?: 71;
    readonly ROLE_FIGURE?: 72;
    readonly ROLE_CHECK_RICH_OPTION?: 73;
    readonly ROLE_DEFINITION_LIST?: 74;
    readonly ROLE_TERM?: 75;
    readonly ROLE_DEFINITION?: 76;
    readonly ROLE_KEY?: 77;
    readonly ROLE_SWITCH?: 78;
    readonly ROLE_MATHML_MATH?: 79;
    readonly ROLE_MATHML_IDENTIFIER?: 80;
    readonly ROLE_MATHML_NUMBER?: 81;
    readonly ROLE_MATHML_OPERATOR?: 82;
    readonly ROLE_MATHML_TEXT?: 83;
    readonly ROLE_MATHML_STRING_LITERAL?: 84;
    readonly ROLE_MATHML_GLYPH?: 85;
    readonly ROLE_MATHML_ROW?: 86;
    readonly ROLE_MATHML_FRACTION?: 87;
    readonly ROLE_MATHML_SQUARE_ROOT?: 88;
    readonly ROLE_MATHML_ROOT?: 89;
    readonly ROLE_MATHML_ENCLOSED?: 90;
    readonly ROLE_MATHML_STYLE?: 91;
    readonly ROLE_MATHML_SUB?: 92;
    readonly ROLE_MATHML_SUP?: 93;
    readonly ROLE_MATHML_SUB_SUP?: 94;
    readonly ROLE_MATHML_UNDER?: 95;
    readonly ROLE_MATHML_OVER?: 96;
    readonly ROLE_MATHML_UNDER_OVER?: 97;
    readonly ROLE_MATHML_MULTISCRIPTS?: 98;
    readonly ROLE_MATHML_TABLE?: 99;
    readonly ROLE_MATHML_LABELED_ROW?: 100;
    readonly ROLE_MATHML_TABLE_ROW?: 101;
    readonly ROLE_MATHML_CELL?: 102;
    readonly ROLE_MATHML_ACTION?: 103;
    readonly ROLE_MATHML_ERROR?: 104;
    readonly ROLE_MATHML_STACK?: 105;
    readonly ROLE_MATHML_LONG_DIVISION?: 106;
    readonly ROLE_MATHML_STACK_GROUP?: 107;
    readonly ROLE_MATHML_STACK_ROW?: 108;
    readonly ROLE_MATHML_STACK_CARRIES?: 109;
    readonly ROLE_MATHML_STACK_CARRY?: 110;
    readonly ROLE_MATHML_STACK_LINE?: 111;
    readonly ROLE_RADIO_GROUP?: 112;
    readonly ROLE_TEXT?: 113;
    readonly ROLE_DETAILS?: 114;
    readonly ROLE_SUMMARY?: 115;
    readonly ROLE_LANDMARK?: 116;
    readonly ROLE_NAVIGATION?: 117;
    readonly ROLE_FOOTNOTE?: 118;
    readonly ROLE_ARTICLE?: 119;
    readonly ROLE_REGION?: 120;
    readonly ROLE_EDITCOMBOBOX?: 121;
    readonly ROLE_BLOCKQUOTE?: 122;
    readonly ROLE_CONTENT_DELETION?: 123;
    readonly ROLE_CONTENT_INSERTION?: 124;
    readonly ROLE_FORM_LANDMARK?: 125;
    readonly ROLE_MARK?: 126;
    readonly ROLE_SUGGESTION?: 127;
    readonly ROLE_COMMENT?: 128;
    readonly ROLE_CODE?: 129;
    readonly ROLE_TIME_EDITOR?: 130;
    readonly ROLE_LISTITEM_MARKER?: 131;
    readonly ROLE_METER?: 132;
    readonly ROLE_SUBSCRIPT?: 133;
    readonly ROLE_SUPERSCRIPT?: 134;
    readonly ROLE_EMPHASIS?: 135;
    readonly ROLE_STRONG?: 136;
    readonly ROLE_TIME?: 137;
    readonly ROLE_GRID?: 138;
    readonly ROLE_ROWGROUP?: 139;
    readonly ROLE_SEARCHBOX?: 140;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleScrollingEvent.idl

  interface nsIAccessibleScrollingEvent extends nsIAccessibleEvent {
    readonly scrollX: u32;
    readonly scrollY: u32;
    readonly maxScrollX: u32;
    readonly maxScrollY: u32;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleSelectable.idl

  interface nsIAccessibleSelectable extends nsISupports {
    readonly selectedItems: nsIArray;
    readonly selectedItemCount: u32;
    getSelectedItemAt(index: u32): nsIAccessible;
    isItemSelected(index: u32): boolean;
    addItemToSelection(index: u32): void;
    removeItemFromSelection(index: u32): void;
    selectAll(): boolean;
    unselectAll(): void;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleStateChangeEvent.idl

  interface nsIAccessibleStateChangeEvent extends nsIAccessibleEvent {
    readonly state: u32;
    readonly isExtraState: boolean;
    readonly isEnabled: boolean;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleStates.idl

  interface nsIAccessibleStates extends nsISupports {
    readonly STATE_UNAVAILABLE?: 1;
    readonly STATE_SELECTED?: 2;
    readonly STATE_FOCUSED?: 4;
    readonly STATE_PRESSED?: 8;
    readonly STATE_CHECKED?: 16;
    readonly STATE_MIXED?: 32;
    readonly STATE_READONLY?: 64;
    readonly STATE_HOTTRACKED?: 128;
    readonly STATE_DEFAULT?: 256;
    readonly STATE_EXPANDED?: 512;
    readonly STATE_COLLAPSED?: 1024;
    readonly STATE_BUSY?: 2048;
    readonly STATE_FLOATING?: 4096;
    readonly STATE_MARQUEED?: 8192;
    readonly STATE_ANIMATED?: 16384;
    readonly STATE_INVISIBLE?: 32768;
    readonly STATE_OFFSCREEN?: 65536;
    readonly STATE_SIZEABLE?: 131072;
    readonly STATE_MOVEABLE?: 262144;
    readonly STATE_SELFVOICING?: 524288;
    readonly STATE_FOCUSABLE?: 1048576;
    readonly STATE_SELECTABLE?: 2097152;
    readonly STATE_LINKED?: 4194304;
    readonly STATE_TRAVERSED?: 8388608;
    readonly STATE_MULTISELECTABLE?: 16777216;
    readonly STATE_EXTSELECTABLE?: 33554432;
    readonly STATE_ALERT_LOW?: 67108864;
    readonly STATE_ALERT_MEDIUM?: 134217728;
    readonly STATE_ALERT_HIGH?: 268435456;
    readonly STATE_PROTECTED?: 536870912;
    readonly STATE_HASPOPUP?: 1073741824;
    readonly STATE_REQUIRED?: 67108864;
    readonly STATE_IMPORTANT?: 134217728;
    readonly STATE_INVALID?: 268435456;
    readonly STATE_CHECKABLE?: 8192;
    readonly EXT_STATE_SUPPORTS_AUTOCOMPLETION?: 1;
    readonly EXT_STATE_DEFUNCT?: 2;
    readonly EXT_STATE_SELECTABLE_TEXT?: 4;
    readonly EXT_STATE_EDITABLE?: 8;
    readonly EXT_STATE_ACTIVE?: 16;
    readonly EXT_STATE_MODAL?: 32;
    readonly EXT_STATE_MULTI_LINE?: 64;
    readonly EXT_STATE_HORIZONTAL?: 128;
    readonly EXT_STATE_OPAQUE?: 256;
    readonly EXT_STATE_SINGLE_LINE?: 512;
    readonly EXT_STATE_TRANSIENT?: 1024;
    readonly EXT_STATE_VERTICAL?: 2048;
    readonly EXT_STATE_STALE?: 4096;
    readonly EXT_STATE_ENABLED?: 8192;
    readonly EXT_STATE_SENSITIVE?: 16384;
    readonly EXT_STATE_EXPANDABLE?: 32768;
    readonly EXT_STATE_PINNED?: 65536;
    readonly EXT_STATE_CURRENT?: 131072;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleTable.idl

  interface nsIAccessibleTable extends nsISupports {
    readonly caption: nsIAccessible;
    readonly summary: string;
    readonly columnCount: i32;
    readonly rowCount: i32;
    getCellAt(rowIndex: i32, columnIndex: i32): nsIAccessible;
    getCellIndexAt(rowIndex: i32, columnIndex: i32): i32;
    getColumnIndexAt(cellIndex: i32): i32;
    getRowIndexAt(cellIndex: i32): i32;
    getRowAndColumnIndicesAt(
      cellIndex: i32,
      rowIndex: OutParam<i32>,
      columnIndex: OutParam<i32>
    ): void;
    getColumnExtentAt(row: i32, column: i32): i32;
    getRowExtentAt(row: i32, column: i32): i32;
    getColumnDescription(columnIndex: i32): string;
    getRowDescription(rowIndex: i32): string;
    isColumnSelected(columnIndex: i32): boolean;
    isRowSelected(rowIndex: i32): boolean;
    isCellSelected(rowIndex: i32, columnIndex: i32): boolean;
    readonly selectedCellCount: u32;
    readonly selectedColumnCount: u32;
    readonly selectedRowCount: u32;
    readonly selectedCells: nsIArray;
    getSelectedCellIndices(): u32[];
    getSelectedColumnIndices(): u32[];
    getSelectedRowIndices(): u32[];
    isProbablyForLayout(): boolean;
  }

  interface nsIAccessibleTableCell extends nsISupports {
    readonly table: nsIAccessibleTable;
    readonly columnIndex: i32;
    readonly rowIndex: i32;
    readonly columnExtent: i32;
    readonly rowExtent: i32;
    readonly columnHeaderCells: nsIArray;
    readonly rowHeaderCells: nsIArray;
    isSelected(): boolean;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleTableChangeEvent.idl

  interface nsIAccessibleTableChangeEvent extends nsIAccessibleEvent {
    readonly rowOrColIndex: i32;
    readonly RowsOrColsCount: i32;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleText.idl

  interface nsIAccessibleText extends nsISupports {
    readonly TEXT_OFFSET_END_OF_TEXT?: -1;
    readonly TEXT_OFFSET_CARET?: -2;
    readonly BOUNDARY_CHAR?: 0;
    readonly BOUNDARY_WORD_START?: 1;
    readonly BOUNDARY_WORD_END?: 2;
    readonly BOUNDARY_SENTENCE_START?: 3;
    readonly BOUNDARY_SENTENCE_END?: 4;
    readonly BOUNDARY_LINE_START?: 5;
    readonly BOUNDARY_LINE_END?: 6;
    readonly BOUNDARY_PARAGRAPH?: 7;
    readonly BOUNDARY_CLUSTER?: 8;

    caretOffset: i32;
    getCaretRect(
      x: OutParam<i32>,
      y: OutParam<i32>,
      width: OutParam<i32>,
      height: OutParam<i32>
    ): void;
    readonly characterCount: i32;
    readonly selectionCount: i32;
    getText(startOffset: i32, endOffset: i32): string;
    getTextAfterOffset(
      offset: i32,
      boundaryType: AccessibleTextBoundary,
      startOffset: OutParam<i32>,
      endOffset: OutParam<i32>
    ): string;
    getTextAtOffset(
      offset: i32,
      boundaryType: AccessibleTextBoundary,
      startOffset: OutParam<i32>,
      endOffset: OutParam<i32>
    ): string;
    getTextBeforeOffset(
      offset: i32,
      boundaryType: AccessibleTextBoundary,
      startOffset: OutParam<i32>,
      endOffset: OutParam<i32>
    ): string;
    getCharacterAtOffset(offset: i32): string;
    getTextAttributes(
      includeDefAttrs: boolean,
      offset: i32,
      rangeStartOffset: OutParam<i32>,
      rangeEndOffset: OutParam<i32>
    ): nsIPersistentProperties;
    readonly defaultTextAttributes: nsIPersistentProperties;
    getCharacterExtents(
      offset: i32,
      x: OutParam<i32>,
      y: OutParam<i32>,
      width: OutParam<i32>,
      height: OutParam<i32>,
      coordType: u32
    ): void;
    getRangeExtents(
      startOffset: i32,
      endOffset: i32,
      x: OutParam<i32>,
      y: OutParam<i32>,
      width: OutParam<i32>,
      height: OutParam<i32>,
      coordType: u32
    ): void;
    getOffsetAtPoint(x: i32, y: i32, coordType: u32): i32;
    getSelectionBounds(
      selectionNum: i32,
      startOffset: OutParam<i32>,
      endOffset: OutParam<i32>
    ): void;
    setSelectionBounds(selectionNum: i32, startOffset: i32, endOffset: i32): void;
    addSelection(startOffset: i32, endOffset: i32): void;
    removeSelection(selectionNum: i32): void;
    scrollSubstringTo(startIndex: i32, endIndex: i32, scrollType: u32): void;
    scrollSubstringToPoint(
      startIndex: i32,
      endIndex: i32,
      coordinateType: u32,
      x: i32,
      y: i32
    ): void;
    readonly selectionRanges: nsIArray;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleTextChangeEvent.idl

  interface nsIAccessibleTextChangeEvent extends nsIAccessibleEvent {
    readonly start: i32;
    readonly length: u32;
    readonly isInserted: boolean;
    readonly modifiedText: string;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleTextLeafRange.idl

  interface nsIAccessibleTextLeafPoint extends nsISupports {
    readonly DIRECTION_NEXT?: 0;
    readonly DIRECTION_PREVIOUS?: 1;
    readonly BOUNDARY_FLAG_DEFAULT?: 0;
    readonly BOUNDARY_FLAG_INCLUDE_ORIGIN?: 1;
    readonly BOUNDARY_FLAG_STOP_IN_EDITABLE?: 2;
    readonly BOUNDARY_FLAG_SKIP_LIST_ITEM_MARKER?: 4;

    accessible: nsIAccessible;
    offset: i32;
    findBoundary(
      aBoundaryType: AccessibleTextBoundary,
      aDirection: u32,
      aFlags: u32
    ): nsIAccessibleTextLeafPoint;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleTextRange.idl

  interface nsIAccessibleTextRange extends nsISupports {
    readonly EndPoint_Start?: 1;
    readonly EndPoint_End?: 2;
    readonly AlignToTop?: 0;
    readonly AlignToBottom?: 1;

    readonly startContainer: nsIAccessibleText;
    readonly startOffset: i32;
    readonly endContainer: nsIAccessibleText;
    readonly endOffset: i32;
    readonly container: nsIAccessible;
    compare(aOtherRange: nsIAccessibleTextRange): boolean;
    compareEndPoints(
      aEndPoint: u32,
      aOtherRange: nsIAccessibleTextRange,
      aOtherRangeEndPoint: u32
    ): i32;
    crop(aContainer: nsIAccessible): boolean;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleTextSelectionChangeEvent.idl

  interface nsIAccessibleTextSelectionChangeEvent extends nsIAccessibleEvent {
    readonly selectionRanges: nsIArray;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleTypes.idl

  interface nsIAccessibleScrollType extends nsISupports {
    readonly SCROLL_TYPE_TOP_LEFT?: 0;
    readonly SCROLL_TYPE_BOTTOM_RIGHT?: 1;
    readonly SCROLL_TYPE_TOP_EDGE?: 2;
    readonly SCROLL_TYPE_BOTTOM_EDGE?: 3;
    readonly SCROLL_TYPE_LEFT_EDGE?: 4;
    readonly SCROLL_TYPE_RIGHT_EDGE?: 5;
    readonly SCROLL_TYPE_ANYWHERE?: 6;
  }

  interface nsIAccessibleCoordinateType extends nsISupports {
    readonly COORDTYPE_SCREEN_RELATIVE?: 0;
    readonly COORDTYPE_WINDOW_RELATIVE?: 1;
    readonly COORDTYPE_PARENT_RELATIVE?: 2;
  }

  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleValue.idl

  interface nsIAccessibleValue extends nsISupports {
    readonly maximumValue: double;
    readonly minimumValue: double;
    currentValue: double;
    readonly minimumIncrement: double;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/alerts/nsIAlertsService.idl

  interface nsIAlertNotificationImageListener extends nsISupports {
    onImageReady(aUserData: nsISupports, aRequest: imgIRequest): void;
    onImageMissing(aUserData: nsISupports): void;
  }

  interface nsIAlertAction extends nsISupports {
    readonly action: string;
    readonly title: string;
    readonly iconURL: string;
    readonly windowsSystemActivationType: boolean;
    readonly opaqueRelaunchData: string;
  }

  interface nsIAlertNotification extends nsISupports {
    init(
      aName?: string,
      aImageURL?: string,
      aTitle?: string,
      aText?: string,
      aTextClickable?: boolean,
      aCookie?: string,
      aDir?: string,
      aLang?: string,
      aData?: string,
      aPrincipal?: nsIPrincipal,
      aInPrivateBrowsing?: boolean,
      aRequireInteraction?: boolean,
      aSilent?: boolean,
      aVibrate?: u32[]
    ): void;
    readonly id: string;
    readonly name: string;
    readonly imageURL: string;
    readonly title: string;
    readonly text: string;
    readonly textClickable: boolean;
    readonly cookie: string;
    readonly dir: string;
    readonly lang: string;
    readonly data: string;
    readonly principal: nsIPrincipal;
    readonly URI: nsIURI;
    readonly inPrivateBrowsing: boolean;
    readonly requireInteraction: boolean;
    readonly silent: boolean;
    readonly vibrate: u32[];
    actions: nsIAlertAction[];
    readonly actionable: boolean;
    readonly source: string;
    opaqueRelaunchData: string;
    loadImage(
      aTimeout: u32,
      aListener: nsIAlertNotificationImageListener,
      aUserData?: nsISupports
    ): nsICancelable;
    getAction(aName: string): nsIAlertAction;
  }

  interface nsIAlertsService extends nsISupports {
    showAlert(aAlert: nsIAlertNotification, aAlertListener?: nsIObserver): void;
    showAlertNotification(
      aImageURL: string,
      aTitle: string,
      aText: string,
      aTextClickable?: boolean,
      aCookie?: string,
      aAlertListener?: nsIObserver,
      aName?: string,
      aDir?: string,
      aLang?: string,
      aData?: string,
      aPrincipal?: nsIPrincipal,
      aInPrivateBrowsing?: boolean,
      aRequireInteraction?: boolean
    ): void;
    closeAlert(aName?: string, aContextClosed?: boolean): void;
    teardown(): void;
    pbmTeardown(): void;
  }

  interface nsIAlertsDoNotDisturb extends nsISupports {
    manualDoNotDisturb: boolean;
    suppressForScreenSharing: boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpfe/appshell/nsIAppShellService.idl

  interface nsIAppShellService extends nsISupports {
    readonly SIZE_TO_CONTENT?: -1;

    createTopLevelWindow(
      aParent: nsIAppWindow,
      aUrl: nsIURI,
      aChromeMask: u32,
      aInitialWidth: i32,
      aInitialHeight: i32
    ): nsIAppWindow;
    createWindowlessBrowser(aIsChrome?: boolean, aChromeMask?: u32): nsIWindowlessBrowser;
    readonly hiddenWindow: nsIAppWindow;
    readonly hiddenDOMWindow: mozIDOMWindowProxy;
    registerTopLevelWindow(aWindow: nsIAppWindow): void;
    unregisterTopLevelWindow(aWindow: nsIAppWindow): void;
    readonly hasHiddenWindow: boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpfe/appshell/nsIAppWindow.idl

  interface nsIAppWindow extends nsISupports {
    readonly docShell: nsIDocShell;
    intrinsicallySized: boolean;
    readonly primaryContentShell: nsIDocShellTreeItem;
    readonly primaryRemoteTab: nsIRemoteTab;
    readonly primaryContentBrowsingContext: BrowsingContext;
    remoteTabAdded(aTab: nsIRemoteTab, aPrimary: boolean): void;
    remoteTabRemoved(aTab: nsIRemoteTab): void;
    readonly outerToInnerHeightDifferenceInCSSPixels: u32;
    readonly outerToInnerWidthDifferenceInCSSPixels: u32;
    center(aRelative: nsIAppWindow, aScreen: boolean, aAlert: boolean): void;
    showModal(): void;
    lockAspectRatio(aShouldLock: boolean): void;
    chromeFlags: u32;
    assumeChromeFlagsAreFrozen(): void;
    createNewWindow(aChromeFlags: i32, aOpenWindowInfo: nsIOpenWindowInfo): nsIAppWindow;
    XULBrowserWindow: nsIXULBrowserWindow;
    readonly initialOpenWindowInfo: nsIOpenWindowInfo;
    needFastSnaphot(): void;
    rollupAllPopups(): void;
  }

  // https://searchfox.org/mozilla-central/source/xpfe/appshell/nsIWindowMediator.idl

  interface nsIWindowMediator extends nsISupports {
    getEnumerator(aWindowType: string): nsISimpleEnumerator;
    getAppWindowEnumerator(aWindowType: string): nsISimpleEnumerator;
    getZOrderAppWindowEnumerator(aWindowType: string, aFrontToBack: boolean): nsISimpleEnumerator;
    getMostRecentWindow(aWindowType: string): mozIDOMWindowProxy;
    getMostRecentBrowserWindow(): mozIDOMWindowProxy;
    getMostRecentNonPBWindow(aWindowType: string): mozIDOMWindowProxy;
    getOuterWindowWithId(aOuterWindowID: u64): mozIDOMWindowProxy;
    getCurrentInnerWindowWithId(aInnerWindowID: u64): mozIDOMWindow;
    addListener(aListener: nsIWindowMediatorListener): void;
    removeListener(aListener: nsIWindowMediatorListener): void;
  }

  // https://searchfox.org/mozilla-central/source/xpfe/appshell/nsIWindowMediatorListener.idl

  interface nsIWindowMediatorListener extends nsISupports {
    onOpenWindow(window: nsIAppWindow): void;
    onCloseWindow(window: nsIAppWindow): void;
  }

  // https://searchfox.org/mozilla-central/source/xpfe/appshell/nsIWindowlessBrowser.idl

  interface nsIWindowlessBrowser extends nsIWebNavigation {
    close(): void;
    readonly docShell: nsIDocShell;
    readonly browsingContext: BrowsingContext;
  }

  // https://searchfox.org/mozilla-central/source/xpfe/appshell/nsIXULBrowserWindow.idl

  interface nsIXULBrowserWindow extends nsISupports {
    setOverLink(link: string): void;
    showTooltip(x: i32, y: i32, tooltip: string, direction: string, browser: Element): void;
    hideTooltip(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/startup/public/nsIAppStartup.idl
} // global

declare enum nsIAppStartup_IDLShutdownPhase {
  SHUTDOWN_PHASE_NOTINSHUTDOWN = 0,
  SHUTDOWN_PHASE_APPSHUTDOWNCONFIRMED = 1,
  SHUTDOWN_PHASE_APPSHUTDOWNNETTEARDOWN = 2,
  SHUTDOWN_PHASE_APPSHUTDOWNTEARDOWN = 3,
  SHUTDOWN_PHASE_APPSHUTDOWN = 4,
  SHUTDOWN_PHASE_APPSHUTDOWNQM = 5,
  SHUTDOWN_PHASE_APPSHUTDOWNRELEMETRY = 6,
  SHUTDOWN_PHASE_XPCOMWILLSHUTDOWN = 7,
  SHUTDOWN_PHASE_XPCOMSHUTDOWN = 8,
}

declare global {
  namespace nsIAppStartup {
    type IDLShutdownPhase = nsIAppStartup_IDLShutdownPhase;
  }

  interface nsIAppStartup extends nsISupports, Enums<typeof nsIAppStartup_IDLShutdownPhase> {
    readonly eConsiderQuit?: 1;
    readonly eAttemptQuit?: 2;
    readonly eForceQuit?: 3;
    readonly eRestart?: 16;
    readonly eSilently?: 256;

    run(): void;
    enterLastWindowClosingSurvivalArea(): void;
    exitLastWindowClosingSurvivalArea(): void;
    readonly automaticSafeModeNecessary: boolean;
    restartInSafeMode(aQuitMode: u32): void;
    createInstanceWithProfile(aProfile: nsIToolkitProfile): void;
    trackStartupCrashBegin(): boolean;
    trackStartupCrashEnd(): void;
    quit(aMode: u32, aExitCode?: i32): boolean;
    advanceShutdownPhase(aPhase: nsIAppStartup.IDLShutdownPhase): void;
    isInOrBeyondShutdownPhase(aPhase: nsIAppStartup.IDLShutdownPhase): boolean;
    readonly shuttingDown: boolean;
    readonly startingUp: boolean;
    readonly restarting: boolean;
    readonly wasRestarted: boolean;
    readonly wasSilentlyStarted: boolean;
    readonly secondsSinceLastOSRestart: i64;
    readonly showedPreXULSkeletonUI: boolean;
    getStartupInfo(): any;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/autocomplete/nsIAutoCompleteController.idl

  interface nsIAutoCompleteController extends nsISupports {
    readonly STATUS_NONE?: 1;
    readonly STATUS_SEARCHING?: 2;
    readonly STATUS_COMPLETE_NO_MATCH?: 3;
    readonly STATUS_COMPLETE_MATCH?: 4;

    input: nsIAutoCompleteInput;
    readonly searchStatus: u16;
    readonly matchCount: u32;
    startSearch(searchString: string): void;
    stopSearch(): void;
    handleText(): boolean;
    handleEnter(aIsPopupSelection: boolean, aEvent?: Event): boolean;
    handleEscape(): boolean;
    handleStartComposition(): void;
    handleEndComposition(): void;
    handleTab(): void;
    handleKeyNavigation(key: u32): boolean;
    handleDelete(): boolean;
    getValueAt(index: i32): string;
    getLabelAt(index: i32): string;
    getCommentAt(index: i32): string;
    getStyleAt(index: i32): string;
    getImageAt(index: i32): string;
    getFinalCompleteValueAt(index: i32): string;
    searchString: string;
    setInitiallySelectedIndex(index: i32): void;
    resetInternalState(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/autocomplete/nsIAutoCompleteInput.idl

  interface nsIAutoCompleteInput extends nsISupports {
    readonly popupElement: Element;
    readonly popup: nsIAutoCompletePopup;
    readonly controller: nsIAutoCompleteController;
    popupOpen: boolean;
    disableAutoComplete: boolean;
    completeDefaultIndex: boolean;
    completeSelectedIndex: boolean;
    forceComplete: boolean;
    minResultsForPopup: u32;
    maxRows: u32;
    timeout: u32;
    searchParam: string;
    readonly searchCount: u32;
    getSearchAt(index: u32): string;
    textValue: string;
    readonly selectionStart: i32;
    readonly selectionEnd: i32;
    selectTextRange(startIndex: i32, endIndex: i32): void;
    onSearchBegin(): void;
    onSearchComplete(): void;
    onTextEntered(aEvent?: Event): void;
    onTextReverted(): boolean;
    readonly consumeRollupEvent: boolean;
    readonly inPrivateContext: boolean;
    readonly noRollupOnCaretMove: boolean;
    readonly noRollupOnEmptySearch: boolean;
    readonly userContextId: u32;
    readonly invalidatePreviousResult: boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/autocomplete/nsIAutoCompletePopup.idl

  interface nsIAutoCompletePopup extends nsISupports {
    readonly INVALIDATE_REASON_NEW_RESULT?: 0;
    readonly INVALIDATE_REASON_DELETE?: 1;

    readonly input: nsIAutoCompleteInput;
    readonly overrideValue: string;
    selectedIndex: i32;
    readonly popupOpen: boolean;
    getNoRollupOnEmptySearch(element: Element): boolean;
    openAutocompletePopup(input: nsIAutoCompleteInput, element: Element): void;
    closePopup(): void;
    invalidate(reason: u16): void;
    selectBy(reverse: boolean, page: boolean): void;
    startSearch(
      searchString: string,
      element: Element,
      listener: nsIFormFillCompleteObserver
    ): void;
    stopSearch(): void;
    selectEntry(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/autocomplete/nsIAutoCompleteResult.idl

  interface nsIAutoCompleteResult extends nsISupports {
    readonly RESULT_IGNORED?: 1;
    readonly RESULT_FAILURE?: 2;
    readonly RESULT_NOMATCH?: 3;
    readonly RESULT_SUCCESS?: 4;
    readonly RESULT_NOMATCH_ONGOING?: 5;
    readonly RESULT_SUCCESS_ONGOING?: 6;

    readonly searchString: string;
    readonly searchResult: u16;
    readonly defaultIndex: i32;
    readonly errorDescription: string;
    readonly matchCount: u32;
    getValueAt(index: i32): string;
    getLabelAt(index: i32): string;
    getCommentAt(index: i32): string;
    getStyleAt(index: i32): string;
    getImageAt(index: i32): string;
    getFinalCompleteValueAt(index: i32): string;
    isRemovableAt(rowIndex: i32): boolean;
    removeValueAt(rowIndex: i32): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/autocomplete/nsIAutoCompleteSearch.idl

  interface nsIAutoCompleteSearch extends nsISupports {
    startSearch(
      searchString: string,
      searchParam: string,
      previousResult: nsIAutoCompleteResult,
      listener: nsIAutoCompleteObserver
    ): void;
    stopSearch(): void;
  }

  interface nsIAutoCompleteObserver extends nsISupports {
    onSearchResult(search: nsIAutoCompleteSearch, result: nsIAutoCompleteResult): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/autocomplete/nsIAutoCompleteSimpleResult.idl

  interface nsIAutoCompleteSimpleResult extends nsIAutoCompleteResult {
    setSearchString(aSearchString: string): void;
    setErrorDescription(aErrorDescription: string): void;
    setDefaultIndex(aDefaultIndex: i32): void;
    setSearchResult(aSearchResult: u16): void;
    insertMatchAt(
      aIndex: i32,
      aValue: string,
      aComment: string,
      aImage?: string,
      aStyle?: string,
      aFinalCompleteValue?: string,
      aLabel?: string
    ): void;
    appendMatch(
      aValue: string,
      aComment: string,
      aImage?: string,
      aStyle?: string,
      aFinalCompleteValue?: string,
      aLabel?: string
    ): void;
    removeMatchAt(aIndex: i32): void;
    getListener(): nsIAutoCompleteSimpleResultListener;
    setListener(aListener: nsIAutoCompleteSimpleResultListener): void;
  }

  interface nsIAutoCompleteSimpleResultListener extends nsISupports {
    onValueRemoved(aResult: nsIAutoCompleteSimpleResult, aValue: string): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/autocomplete/nsIAutoCompleteSimpleSearch.idl

  interface nsIAutoCompleteSimpleSearch extends nsIAutoCompleteSearch {
    overrideNextResult(values: nsIAutoCompleteResult): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/autoplay/nsIAutoplay.idl

  interface nsIAutoplay extends nsISupports {
    readonly ALLOWED?: 0;
    readonly BLOCKED?: 1;
    readonly BLOCKED_ALL?: 5;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/backgroundhangmonitor/nsIHangDetails.idl

  interface nsIHangDetails extends nsISupports {
    readonly wasPersisted: boolean;
    readonly duration: double;
    readonly thread: string;
    readonly runnableName: string;
    readonly process: string;
    readonly remoteType: string;
    readonly stack: any;
    readonly modules: any;
    readonly annotations: any;
  }

  // https://searchfox.org/mozilla-central/source/browser/components/nsIBrowserHandler.idl

  interface nsIBrowserHandler extends nsISupports {
    startPage: string;
    defaultArgs: string;
    getFirstWindowArgs(): string;
    kiosk: boolean;
    majorUpgrade: boolean;
    firstRunProfile: boolean;
    getFeatures(aCmdLine: nsICommandLine): string;
  }

  // https://searchfox.org/mozilla-central/source/caps/nsIAddonPolicyService.idl

  interface nsIAddonPolicyService extends nsISupports {
    readonly defaultCSP: string;
    readonly defaultCSPV3: string;
    getBaseCSP(aAddonId: string): string;
    getExtensionPageCSP(aAddonId: string): string;
    getGeneratedBackgroundPageUrl(aAddonId: string): string;
    addonHasPermission(aAddonId: string, aPerm: string): boolean;
    addonMayLoadURI(aAddonId: string, aURI: nsIURI, aExplicit?: boolean): boolean;
    getExtensionName(aAddonId: string): string;
    sourceMayLoadExtensionURI(
      aSourceURI: nsIURI,
      aExtensionURI: nsIURI,
      aFromPrivateWindow?: boolean
    ): boolean;
    extensionURIToAddonId(aURI: nsIURI): string;
  }

  interface nsIAddonContentPolicy extends nsISupports {
    readonly CSP_ALLOW_ANY?: 65535;
    readonly CSP_ALLOW_LOCALHOST?: 1;
    readonly CSP_ALLOW_EVAL?: 2;
    readonly CSP_ALLOW_REMOTE?: 4;
    readonly CSP_ALLOW_WASM?: 8;

    validateAddonCSP(aPolicyString: string, aPermittedPolicy: u32): string;
  }

  // https://searchfox.org/mozilla-central/source/caps/nsIDomainPolicy.idl

  interface nsIDomainPolicy extends nsISupports {
    readonly blocklist: nsIDomainSet;
    readonly superBlocklist: nsIDomainSet;
    readonly allowlist: nsIDomainSet;
    readonly superAllowlist: nsIDomainSet;
    deactivate(): void;
  }

  interface nsIDomainSet extends nsISupports {
    add(aDomain: nsIURI): void;
    remove(aDomain: nsIURI): void;
    clear(): void;
    contains(aDomain: nsIURI): boolean;
    containsSuperDomain(aDomain: nsIURI): boolean;
  }

  // https://searchfox.org/mozilla-central/source/caps/nsIPrincipal.idl

  interface nsIPrincipal extends nsISupports {
    equals(other: nsIPrincipal): boolean;
    equalsForPermission(other: nsIPrincipal, aExactHost: boolean): boolean;
    equalsConsideringDomain(other: nsIPrincipal): boolean;
    equalsURI(aOtherURI: nsIURI): boolean;
    readonly URI: nsIURI;
    subsumes(other: nsIPrincipal): boolean;
    subsumesConsideringDomain(other: nsIPrincipal): boolean;
    subsumesConsideringDomainIgnoringFPD(other: nsIPrincipal): boolean;
    checkMayLoad(uri: nsIURI, allowIfInheritsPrincipal: boolean): void;
    checkMayLoadWithReporting(
      uri: nsIURI,
      allowIfInheritsPrincipal: boolean,
      innerWindowID: u64
    ): void;
    isThirdPartyURI(uri: nsIURI): boolean;
    isThirdPartyPrincipal(principal: nsIPrincipal): boolean;
    isThirdPartyChannel(channel: nsIChannel): boolean;
    readonly originAttributes: any;
    readonly origin: string;
    readonly hostPort: string;
    readonly asciiHost: string;
    readonly host: string;
    readonly prePath: string;
    readonly filePath: string;
    readonly asciiSpec: string;
    readonly spec: string;
    readonly exposablePrePath: string;
    readonly exposableSpec: string;
    readonly scheme: string;
    schemeIs(scheme: string): boolean;
    isURIInPrefList(pref: string): boolean;
    isURIInList(list: string): boolean;
    isContentAccessibleAboutURI(): boolean;
    isSameOrigin(otherURI: nsIURI): boolean;
    hasFirstpartyStorageAccess(aWindow: mozIDOMWindow, rejectedReason: OutParam<u32>): boolean;
    readonly localStorageQuotaKey: string;
    readonly isOriginPotentiallyTrustworthy: boolean;
    readonly isLoopbackHost: boolean;
    getAboutModuleFlags(): u32;
    readonly storageOriginKey: string;
    readonly originNoSuffix: string;
    readonly originSuffix: string;
    readonly siteOrigin: string;
    readonly siteOriginNoSuffix: string;
    readonly baseDomain: string;
    readonly addonId: string;
    readonly addonPolicy: WebExtensionPolicy;
    readonly contentScriptAddonPolicy: WebExtensionPolicy;
    readonly userContextId: u32;
    readonly privateBrowsingId: u32;
    readonly isInPrivateBrowsing: boolean;
    readonly isNullPrincipal: boolean;
    readonly isContentPrincipal: boolean;
    readonly isExpandedPrincipal: boolean;
    readonly isSystemPrincipal: boolean;
    readonly isAddonOrExpandedAddonPrincipal: boolean;
    readonly isOnion: boolean;
    readonly isScriptAllowedByPolicy: boolean;
    isL10nAllowed(aDocumentURI: nsIURI): boolean;
    readonly nextSubDomainPrincipal: nsIPrincipal;
    readonly isIpAddress: boolean;
    readonly isLocalIpAddress: boolean;
    readonly precursorPrincipal: nsIPrincipal;
  }

  // https://searchfox.org/mozilla-central/source/caps/nsIScriptSecurityManager.idl

  interface nsIScriptSecurityManager extends nsISupports {
    readonly STANDARD?: 0;
    readonly LOAD_IS_AUTOMATIC_DOCUMENT_REPLACEMENT?: 1;
    readonly ALLOW_CHROME?: 2;
    readonly DISALLOW_INHERIT_PRINCIPAL?: 4;
    readonly DISALLOW_SCRIPT_OR_DATA?: 4;
    readonly DISALLOW_SCRIPT?: 8;
    readonly DONT_REPORT_ERRORS?: 16;
    readonly DEFAULT_USER_CONTEXT_ID?: 0;
    readonly DEFAULT_PRIVATE_BROWSING_ID?: 0;

    checkLoadURIWithPrincipalXPCOM(
      aPrincipal: nsIPrincipal,
      uri: nsIURI,
      flags: u32,
      innerWindowID?: u64
    ): void;
    checkLoadURIWithPrincipal(
      aPrincipal: nsIPrincipal,
      uri: nsIURI,
      flags?: u32,
      innerWindowID?: u64
    ): void;
    checkLoadURIStrWithPrincipalXPCOM(aPrincipal: nsIPrincipal, uri: string, flags: u32): void;
    checkLoadURIStrWithPrincipal(aPrincipal: nsIPrincipal, uri: string, flags?: u32): void;
    inFileURIAllowlist(aUri: nsIURI): boolean;
    getSystemPrincipal(): nsIPrincipal;
    getLoadContextContentPrincipal(uri: nsIURI, loadContext: nsILoadContext): nsIPrincipal;
    getDocShellContentPrincipal(uri: nsIURI, docShell: nsIDocShell): nsIPrincipal;
    principalWithOA(principal: nsIPrincipal, originAttributes: any): nsIPrincipal;
    createContentPrincipal(uri: nsIURI, originAttributes: any): nsIPrincipal;
    createContentPrincipalFromOrigin(origin: string): nsIPrincipal;
    principalToJSON(principal: nsIPrincipal): string;
    JSONToPrincipal(json: string): nsIPrincipal;
    createNullPrincipal(originAttributes: any): nsIPrincipal;
    checkSameOriginURI(
      aSourceURI: nsIURI,
      aTargetURI: nsIURI,
      reportError: boolean,
      fromPrivateWindow: boolean
    ): void;
    getChannelResultPrincipal(aChannel: nsIChannel): nsIPrincipal;
    getChannelResultStoragePrincipal(aChannel: nsIChannel): nsIPrincipal;
    getChannelResultPrincipals(
      aChannel: nsIChannel,
      aPrincipal: OutParam<nsIPrincipal>,
      aPartitionedPrincipal: OutParam<nsIPrincipal>
    ): void;
    getChannelURIPrincipal(aChannel: nsIChannel): nsIPrincipal;
    activateDomainPolicy(): nsIDomainPolicy;
    readonly domainPolicyActive: boolean;
    policyAllowsScript(aDomain: nsIURI): boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/captivedetect/nsICaptivePortalDetector.idl

  interface nsICaptivePortalCallback extends nsISupports {
    prepare(): void;
    complete(success: boolean): void;
  }

  interface nsICaptivePortalDetector extends nsISupports {
    checkCaptivePortal(ifname: string, callback: nsICaptivePortalCallback): void;
    abort(ifname: string): void;
    cancelLogin(eventId: string): void;
    finishPreparation(ifname: string): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/cascade_bloom_filter/nsICascadeFilter.idl

  interface nsICascadeFilter extends nsISupports {
    setFilterData(data: u8[]): void;
    has(key: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/chrome/nsIChromeRegistry.idl

  interface nsIChromeRegistry extends nsISupports {
    readonly NONE?: 0;
    readonly PARTIAL?: 1;
    readonly FULL?: 2;

    convertChromeURL(aChromeURL: nsIURI): nsIURI;
    checkForNewChrome(): void;
  }

  interface nsIXULChromeRegistry extends nsIChromeRegistry {
    isLocaleRTL(package: string): boolean;
    allowScriptsForPackage(url: nsIURI): boolean;
    allowContentToAccess(url: nsIURI): boolean;
    canLoadURLRemotely(url: nsIURI): boolean;
    mustLoadURLRemotely(url: nsIURI): boolean;
  }

  // https://searchfox.org/mozilla-central/source/chrome/nsIToolkitChromeRegistry.idl

  interface nsIToolkitChromeRegistry extends nsIXULChromeRegistry {
    getLocalesForPackage(aPackage: string): nsIUTF8StringEnumerator;
  }

  // https://searchfox.org/mozilla-central/source/dom/commandhandler/nsICommandManager.idl

  interface nsICommandManager extends nsISupports {
    addCommandObserver(aCommandObserver: nsIObserver, aCommandToObserve: string): void;
    removeCommandObserver(aCommandObserver: nsIObserver, aCommandObserved: string): void;
    isCommandSupported(aCommandName: string, aTargetWindow: mozIDOMWindowProxy): boolean;
    isCommandEnabled(aCommandName: string, aTargetWindow: mozIDOMWindowProxy): boolean;
    getCommandState(
      aCommandName: string,
      aTargetWindow: mozIDOMWindowProxy,
      aCommandParams: nsICommandParams
    ): void;
    doCommand(
      aCommandName: string,
      aCommandParams: nsICommandParams,
      aTargetWindow: mozIDOMWindowProxy
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/commandhandler/nsICommandParams.idl

  interface nsICommandParams extends nsISupports {
    readonly eNoType?: 0;
    readonly eBooleanType?: 1;
    readonly eLongType?: 2;
    readonly eDoubleType?: 3;
    readonly eWStringType?: 4;
    readonly eISupportsType?: 5;
    readonly eStringType?: 6;

    getValueType(name: string): i16;
    getBooleanValue(name: string): boolean;
    getLongValue(name: string): i32;
    getDoubleValue(name: string): double;
    getStringValue(name: string): string;
    getCStringValue(name: string): string;
    getISupportsValue(name: string): nsISupports;
    setBooleanValue(name: string, value: boolean): void;
    setLongValue(name: string, value: i32): void;
    setDoubleValue(name: string, value: double): void;
    setStringValue(name: string, value: string): void;
    setCStringValue(name: string, value: string): void;
    setISupportsValue(name: string, value: nsISupports): void;
    removeValue(name: string): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/commandhandler/nsIControllerCommand.idl

  interface nsIControllerCommand extends nsISupports {
    isCommandEnabled(aCommandName: string, aCommandContext: nsISupports): boolean;
    getCommandStateParams(
      aCommandName: string,
      aParams: nsICommandParams,
      aCommandContext: nsISupports
    ): void;
    doCommand(aCommandName: string, aCommandContext: nsISupports): void;
    doCommandParams(
      aCommandName: string,
      aParams: nsICommandParams,
      aCommandContext: nsISupports
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/commandhandler/nsIControllerCommandTable.idl

  interface nsIControllerCommandTable extends nsISupports {
    makeImmutable(): void;
    registerCommand(aCommandName: string, aCommand: nsIControllerCommand): void;
    unregisterCommand(aCommandName: string, aCommand: nsIControllerCommand): void;
    findCommandHandler(aCommandName: string): nsIControllerCommand;
    isCommandEnabled(aCommandName: string, aCommandRefCon: nsISupports): boolean;
    updateCommandState(aCommandName: string, aCommandRefCon: nsISupports): void;
    supportsCommand(aCommandName: string, aCommandRefCon: nsISupports): boolean;
    doCommand(aCommandName: string, aCommandRefCon: nsISupports): void;
    doCommandParams(
      aCommandName: string,
      aParam: nsICommandParams,
      aCommandRefCon: nsISupports
    ): void;
    getCommandState(
      aCommandName: string,
      aParam: nsICommandParams,
      aCommandRefCon: nsISupports
    ): void;
    getSupportedCommands(): string[];
  }

  // https://searchfox.org/mozilla-central/source/dom/commandhandler/nsIControllerContext.idl

  interface nsIControllerContext extends nsISupports {
    setCommandContext(aCommandContext: nsISupports): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/commandlines/nsICommandLine.idl

  interface nsICommandLine extends nsISupports {
    readonly STATE_INITIAL_LAUNCH?: 0;
    readonly STATE_REMOTE_AUTO?: 1;
    readonly STATE_REMOTE_EXPLICIT?: 2;

    readonly length: i32;
    getArgument(aIndex: i32): string;
    findFlag(aFlag: string, aCaseSensitive: boolean): i32;
    removeArguments(aStart: i32, aEnd: i32): void;
    handleFlag(aFlag: string, aCaseSensitive: boolean): boolean;
    handleFlagWithParam(aFlag: string, aCaseSensitive: boolean): string;
    readonly state: u32;
    preventDefault: boolean;
    readonly workingDirectory: nsIFile;
    resolveFile(aArgument: string): nsIFile;
    resolveURI(aArgument: string): nsIURI;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/commandlines/nsICommandLineHandler.idl

  interface nsICommandLineHandler extends nsISupports {
    handle(aCommandLine: nsICommandLine): void;
    readonly helpInfo: string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/commandlines/nsICommandLineRunner.idl

  // https://searchfox.org/mozilla-central/source/toolkit/components/commandlines/nsICommandLineValidator.idl

  interface nsICommandLineValidator extends nsISupports {
    validate(aCommandLine: nsICommandLine): void;
  }

  // https://searchfox.org/mozilla-central/source/editor/composer/nsIEditingSession.idl

  interface nsIEditingSession extends nsISupports {
    readonly eEditorOK?: 0;
    readonly eEditorCreationInProgress?: 1;
    readonly eEditorErrorCantEditMimeType?: 2;
    readonly eEditorErrorFileNotFound?: 3;
    readonly eEditorErrorCantEditFramesets?: 8;
    readonly eEditorErrorUnknown?: 9;

    readonly editorStatus: u32;
    makeWindowEditable(
      window: mozIDOMWindowProxy,
      aEditorType: string,
      doAfterUriLoad: boolean,
      aMakeWholeDocumentEditable: boolean,
      aInteractive: boolean
    ): void;
    windowIsEditable(window: mozIDOMWindowProxy): boolean;
    getEditorForWindow(window: mozIDOMWindowProxy): nsIEditor;
  }

  // https://searchfox.org/mozilla-central/source/dom/events/nsIEventListenerService.idl

  interface nsIEventListenerChange extends nsISupports {
    readonly target: EventTarget;
  }

  type nsIListenerChangeListener = Callable<{
    listenersChanged(aEventListenerChanges: nsIArray): void;
  }>;

  interface nsIEventListenerInfo extends nsISupports {
    readonly type: string;
    readonly capturing: boolean;
    readonly allowsUntrusted: boolean;
    readonly inSystemEventGroup: boolean;
    enabled: boolean;
    readonly listenerObject: any;
    toSource(): string;
  }

  interface nsIEventListenerService extends nsISupports {
    getListenerInfoFor(aEventTarget: EventTarget): nsIEventListenerInfo[];
    hasListenersFor(aEventTarget: EventTarget, aType: string): boolean;
    addListenerForAllEvents(
      target: EventTarget,
      listener: any,
      aUseCapture?: boolean,
      aWantsUntrusted?: boolean,
      aSystemEventGroup?: boolean
    ): void;
    removeListenerForAllEvents(
      target: EventTarget,
      listener: any,
      aUseCapture?: boolean,
      aSystemEventGroup?: boolean
    ): void;
    addListenerChangeListener(aListener: nsIListenerChangeListener): void;
    removeListenerChangeListener(aListener: nsIListenerChangeListener): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/gmp/mozIGeckoMediaPluginChromeService.idl

  interface mozIGeckoMediaPluginChromeService extends nsISupports {
    addPluginDirectory(directory: string): void;
    removePluginDirectory(directory: string): void;
    removeAndDeletePluginDirectory(directory: string, defer?: boolean): void;
    forgetThisSite(site: string, aPattern: string): void;
    forgetThisBaseDomain(baseDomain: string): void;
    isPersistentStorageAllowed(nodeId: string): boolean;
    getStorageDir(): nsIFile;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/gmp/mozIGeckoMediaPluginService.idl

  interface mozIGeckoMediaPluginService extends nsISupports {
    readonly thread: nsIThread;
    RunPluginCrashCallbacks(pluginId: u32, pluginName: string): void;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIDocShell.idl
} // global

declare enum nsIDocShell_DocShellEnumeratorDirection {
  ENUMERATE_FORWARDS = 0,
  ENUMERATE_BACKWARDS = 1,
}

declare enum nsIDocShell_AppType {
  APP_TYPE_UNKNOWN = 0,
  APP_TYPE_MAIL = 1,
  APP_TYPE_EDITOR = 2,
}

declare enum nsIDocShell_BusyFlags {
  BUSY_FLAGS_NONE = 0,
  BUSY_FLAGS_BUSY = 1,
  BUSY_FLAGS_BEFORE_PAGE_LOAD = 2,
  BUSY_FLAGS_PAGE_LOADING = 4,
}

declare enum nsIDocShell_LoadCommand {
  LOAD_CMD_NORMAL = 1,
  LOAD_CMD_RELOAD = 2,
  LOAD_CMD_HISTORY = 4,
  LOAD_CMD_PUSHSTATE = 8,
}

declare global {
  namespace nsIDocShell {
    type DocShellEnumeratorDirection = nsIDocShell_DocShellEnumeratorDirection;
    type AppType = nsIDocShell_AppType;
    type BusyFlags = nsIDocShell_BusyFlags;
    type LoadCommand = nsIDocShell_LoadCommand;
  }

  interface nsIDocShell
    extends nsIDocShellTreeItem,
      Enums<
        typeof nsIDocShell_DocShellEnumeratorDirection &
          typeof nsIDocShell_AppType &
          typeof nsIDocShell_BusyFlags &
          typeof nsIDocShell_LoadCommand
      > {
    setCancelContentJSEpoch(aEpoch: i32): void;
    addState(aData: any, aTitle: string, aURL: string, aReplace: boolean): void;
    prepareForNewContentModel(): void;
    setCurrentURIForSessionStore(aURI: nsIURI): void;
    readonly docViewer: nsIDocumentViewer;
    readonly outerWindowID: u64;
    chromeEventHandler: EventTarget;
    customUserAgent: string;
    cssErrorReportingEnabled: boolean;
    allowMetaRedirects: boolean;
    allowSubframes: boolean;
    allowImages: boolean;
    allowMedia: boolean;
    allowDNSPrefetch: boolean;
    allowWindowControl: boolean;
    allowContentRetargeting: boolean;
    allowContentRetargetingOnChildren: boolean;
    getAllDocShellsInSubtree(
      aItemType: i32,
      aDirection: nsIDocShell.DocShellEnumeratorDirection
    ): nsIDocShell[];
    appType: nsIDocShell.AppType;
    allowAuth: boolean;
    zoom: float;
    readonly busyFlags: nsIDocShell.BusyFlags;
    loadType: u32;
    defaultLoadFlags: nsLoadFlags;
    isBeingDestroyed(): boolean;
    readonly isExecutingOnLoadHandler: boolean;
    layoutHistoryState: nsILayoutHistoryState;
    readonly loadURIDelegate: nsILoadURIDelegate;
    suspendRefreshURIs(): void;
    resumeRefreshURIs(): void;
    beginRestore(viewer: nsIDocumentViewer, top: boolean): void;
    finishRestore(): void;
    clearCachedUserAgent(): void;
    clearCachedPlatform(): void;
    readonly restoringDocument: boolean;
    useErrorPages: boolean;
    displayLoadError(
      aError: nsresult,
      aURI: nsIURI,
      aURL: string,
      aFailedChannel?: nsIChannel
    ): boolean;
    readonly failedChannel: nsIChannel;
    readonly previousEntryIndex: i32;
    readonly loadedEntryIndex: i32;
    historyPurged(numEntries: i32): void;
    readonly currentDocumentChannel: nsIChannel;
    readonly isInUnload: boolean;
    exitPrintPreview(): void;
    readonly historyID: nsID;
    createAboutBlankDocumentViewer(
      aPrincipal: nsIPrincipal,
      aPartitionedPrincipal: nsIPrincipal,
      aCSP?: nsIContentSecurityPolicy
    ): void;
    readonly charset: string;
    forceEncodingDetection(): void;
    now(): DOMHighResTimeStamp;
    addWeakPrivacyTransitionObserver(obs: nsIPrivacyTransitionObserver): void;
    addWeakReflowObserver(obs: nsIReflowObserver): void;
    removeWeakReflowObserver(obs: nsIReflowObserver): void;
    readonly isTopLevelContentDocShell: boolean;
    readonly asyncPanZoomEnabled: boolean;
    readonly mayEnableCharacterEncodingMenu: boolean;
    editor: nsIEditor;
    readonly editable: boolean;
    readonly hasEditingSession: boolean;
    makeEditable(inWaitForUriLoad: boolean): void;
    getCurrentSHEntry(aEntry: OutParam<nsISHEntry>): boolean;
    isCommandEnabled(command: string): boolean;
    doCommand(command: string): void;
    doCommandWithParams(command: string, aParams: nsICommandParams): void;
    readonly hasLoadedNonBlankURI: boolean;
    windowDraggingAllowed: boolean;
    currentScrollRestorationIsManual: boolean;
    getOriginAttributes(): any;
    setOriginAttributes(aAttrs: any): void;
    readonly editingSession: nsIEditingSession;
    readonly browserChild: nsIBrowserChild;
    useTrackingProtection: boolean;
    setColorMatrix(aMatrix: float[]): void;
    readonly isForceReloading: boolean;
    getColorMatrix(): float[];
    readonly messageManager: ContentFrameMessageManager;
    getHasTrackingContentBlocked(): Promise<any>;
    readonly isNavigating: boolean;
    synchronizeLayoutHistoryState(): void;
    persistLayoutHistoryState(): void;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIDocShellTreeItem.idl

  interface nsIDocShellTreeItem extends nsISupports {
    readonly typeChrome?: 0;
    readonly typeContent?: 1;
    readonly typeContentWrapper?: 2;
    readonly typeChromeWrapper?: 3;
    readonly typeAll?: 2147483647;

    name: string;
    nameEquals(name: string): boolean;
    readonly itemType: i32;
    readonly parent: nsIDocShellTreeItem;
    readonly sameTypeParent: nsIDocShellTreeItem;
    readonly rootTreeItem: nsIDocShellTreeItem;
    readonly sameTypeRootTreeItem: nsIDocShellTreeItem;
    readonly treeOwner: nsIDocShellTreeOwner;
    readonly childCount: i32;
    getChildAt(index: i32): nsIDocShellTreeItem;
    readonly browsingContext: BrowsingContext;
    readonly domWindow: mozIDOMWindowProxy;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIDocShellTreeOwner.idl

  interface nsIDocShellTreeOwner extends nsISupports {
    contentShellAdded(aContentShell: nsIDocShellTreeItem, aPrimary: boolean): void;
    contentShellRemoved(aContentShell: nsIDocShellTreeItem): void;
    readonly primaryContentShell: nsIDocShellTreeItem;
    remoteTabAdded(aTab: nsIRemoteTab, aPrimary: boolean): void;
    remoteTabRemoved(aTab: nsIRemoteTab): void;
    readonly primaryRemoteTab: nsIRemoteTab;
    readonly primaryContentBrowsingContext: BrowsingContext;
    sizeShellTo(shell: nsIDocShellTreeItem, cx: i32, cy: i32): void;
    getPrimaryContentSize(width: OutParam<i32>, height: OutParam<i32>): void;
    setPrimaryContentSize(width: i32, height: i32): void;
    getRootShellSize(width: OutParam<i32>, height: OutParam<i32>): void;
    setRootShellSize(width: i32, height: i32): void;
    setPersistence(
      aPersistPosition: boolean,
      aPersistSize: boolean,
      aPersistSizeMode: boolean
    ): void;
    getPersistence(
      aPersistPosition: OutParam<boolean>,
      aPersistSize: OutParam<boolean>,
      aPersistSizeMode: OutParam<boolean>
    ): void;
    readonly hasPrimaryContent: boolean;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIDocumentLoaderFactory.idl

  interface nsIDocumentLoaderFactory extends nsISupports {
    createInstance(
      aCommand: string,
      aChannel: nsIChannel,
      aLoadGroup: nsILoadGroup,
      aContentType: string,
      aContainer: nsIDocShell,
      aExtraInfo: nsISupports,
      aDocListenerResult: OutParam<nsIStreamListener>
    ): nsIDocumentViewer;
    createInstanceForDocument(
      aContainer: nsISupports,
      aDocument: Document,
      aCommand: string
    ): nsIDocumentViewer;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIDocumentViewer.idl
} // global

declare enum nsIDocumentViewer_PermitUnloadAction {
  ePrompt = 0,
  eDontPromptAndDontUnload = 1,
  eDontPromptAndUnload = 2,
}

declare enum nsIDocumentViewer_PermitUnloadResult {
  eAllowNavigation = 0,
  eRequestBlockNavigation = 1,
}

declare global {
  namespace nsIDocumentViewer {
    type PermitUnloadAction = nsIDocumentViewer_PermitUnloadAction;
    type PermitUnloadResult = nsIDocumentViewer_PermitUnloadResult;
  }

  interface nsIDocumentViewer
    extends nsISupports,
      Enums<
        typeof nsIDocumentViewer_PermitUnloadAction & typeof nsIDocumentViewer_PermitUnloadResult
      > {
    readonly eDelayResize?: 1;

    container: nsIDocShell;
    loadComplete(aStatus: nsresult): void;
    permitUnload(aAction?: nsIDocumentViewer.PermitUnloadAction): boolean;
    readonly inPermitUnload: boolean;
    readonly beforeUnloadFiring: boolean;
    pageHide(isUnload: boolean): void;
    close(historyEntry: nsISHEntry): void;
    destroy(): void;
    stop(): void;
    readonly DOMDocument: Document;
    move(aX: i32, aY: i32): void;
    show(): void;
    hide(): void;
    sticky: boolean;
    open(aState: nsISupports, aSHEntry: nsISHEntry): void;
    clearHistoryEntry(): void;
    setPageModeForTesting(aPageMode: boolean, aPrintSettings: nsIPrintSettings): void;
    readonly historyEntry: nsISHEntry;
    readonly isTabModalPromptAllowed: boolean;
    isHidden: boolean;
    readonly deviceFullZoomForTest: float;
    authorStyleDisabled: boolean;
    getContentSize(
      maxWidth: i32,
      maxHeight: i32,
      prefWidth: i32,
      width: OutParam<i32>,
      height: OutParam<i32>
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIDocumentViewerEdit.idl

  interface nsIDocumentViewerEdit extends nsISupports {
    readonly COPY_IMAGE_TEXT?: 1;
    readonly COPY_IMAGE_HTML?: 2;
    readonly COPY_IMAGE_DATA?: 4;
    readonly COPY_IMAGE_ALL?: -1;

    clearSelection(): void;
    selectAll(): void;
    copySelection(): void;
    readonly copyable: boolean;
    copyLinkLocation(): void;
    readonly inLink: boolean;
    copyImage(aCopyFlags: i32): void;
    readonly inImage: boolean;
    getContents(aMimeType: string, aSelectionOnly: boolean): string;
    readonly canGetContents: boolean;
    setCommandNode(aNode: Node): void;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsILoadContext.idl

  interface nsILoadContext extends nsISupports {
    readonly associatedWindow: mozIDOMWindowProxy;
    readonly topWindow: mozIDOMWindowProxy;
    readonly topFrameElement: Element;
    readonly isContent: boolean;
    usePrivateBrowsing: boolean;
    readonly useRemoteTabs: boolean;
    readonly useRemoteSubframes: boolean;
    useTrackingProtection: boolean;
    readonly originAttributes: any;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsILoadURIDelegate.idl

  interface nsILoadURIDelegate extends nsISupports {
    handleLoadError(aURI: nsIURI, aError: nsresult, aErrorModule: i16): nsIURI;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIPrivacyTransitionObserver.idl

  type nsIPrivacyTransitionObserver = Callable<{
    privateModeChanged(enabled: boolean): void;
  }>;

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIReflowObserver.idl

  interface nsIReflowObserver extends nsISupports {
    reflow(start: DOMHighResTimeStamp, end: DOMHighResTimeStamp): void;
    reflowInterruptible(start: DOMHighResTimeStamp, end: DOMHighResTimeStamp): void;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIRefreshURI.idl

  interface nsIRefreshURI extends nsISupports {
    refreshURI(aURI: nsIURI, aPrincipal: nsIPrincipal, aMillis: u32): void;
    forceRefreshURI(aURI: nsIURI, aPrincipal: nsIPrincipal, aMillis: u32): void;
    cancelRefreshURITimers(): void;
    readonly refreshPending: boolean;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsITooltipListener.idl

  interface nsITooltipListener extends nsISupports {
    onShowTooltip(aXCoords: i32, aYCoords: i32, aTipText: string, aTipDir: string): void;
    onHideTooltip(): void;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsITooltipTextProvider.idl

  interface nsITooltipTextProvider extends nsISupports {
    getNodeText(aNode: Node, aText: OutParam<string>, aDirection: OutParam<string>): boolean;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIURIFixup.idl

  interface nsIURIFixupInfo extends nsISupports {
    consumer: BrowsingContext;
    preferredURI: nsIURI;
    fixedURI: nsIURI;
    keywordProviderName: string;
    keywordAsSent: string;
    schemelessInput: nsILoadInfo.SchemelessInputType;
    fixupChangedProtocol: boolean;
    fixupCreatedAlternateURI: boolean;
    originalInput: string;
    postData: nsIInputStream;
  }

  interface nsIURIFixup extends nsISupports {
    readonly FIXUP_FLAG_NONE?: 0;
    readonly FIXUP_FLAG_ALLOW_KEYWORD_LOOKUP?: 1;
    readonly FIXUP_FLAGS_MAKE_ALTERNATE_URI?: 2;
    readonly FIXUP_FLAG_PRIVATE_CONTEXT?: 4;
    readonly FIXUP_FLAG_FIX_SCHEME_TYPOS?: 8;

    getFixupURIInfo(aURIText: string, aFixupFlags?: u32): nsIURIFixupInfo;
    webNavigationFlagsToFixupFlags(aURIText: string, aDocShellFlags: u32): u32;
    keywordToURI(aKeyword: string, aIsPrivateContext?: boolean): nsIURIFixupInfo;
    forceHttpFixup(aUriString: string): nsIURIFixupInfo;
    checkHost(aURI: nsIURI, aListener: nsIDNSListener, aOriginAttributes?: any): void;
    isDomainKnown(aDomain: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIWebNavigation.idl

  interface nsIWebNavigation extends nsISupports {
    readonly LOAD_FLAGS_MASK?: 65535;
    readonly LOAD_FLAGS_NONE?: 0;
    readonly LOAD_FLAGS_IS_REFRESH?: 16;
    readonly LOAD_FLAGS_IS_LINK?: 32;
    readonly LOAD_FLAGS_BYPASS_HISTORY?: 64;
    readonly LOAD_FLAGS_REPLACE_HISTORY?: 128;
    readonly LOAD_FLAGS_BYPASS_CACHE?: 256;
    readonly LOAD_FLAGS_BYPASS_PROXY?: 512;
    readonly LOAD_FLAGS_CHARSET_CHANGE?: 1024;
    readonly LOAD_FLAGS_STOP_CONTENT?: 2048;
    readonly LOAD_FLAGS_FROM_EXTERNAL?: 4096;
    readonly LOAD_FLAGS_FIRST_LOAD?: 16384;
    readonly LOAD_FLAGS_ALLOW_POPUPS?: 32768;
    readonly LOAD_FLAGS_BYPASS_CLASSIFIER?: 65536;
    readonly LOAD_FLAGS_FORCE_ALLOW_COOKIES?: 131072;
    readonly LOAD_FLAGS_DISALLOW_INHERIT_PRINCIPAL?: 262144;
    readonly LOAD_FLAGS_ERROR_LOAD_CHANGES_RV?: 524288;
    readonly LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP?: 1048576;
    readonly LOAD_FLAGS_FIXUP_SCHEME_TYPOS?: 2097152;
    readonly LOAD_FLAGS_FORCE_ALLOW_DATA_URI?: 4194304;
    readonly LOAD_FLAGS_IS_REDIRECT?: 8388608;
    readonly LOAD_FLAGS_DISABLE_TRR?: 16777216;
    readonly LOAD_FLAGS_FORCE_TRR?: 33554432;
    readonly LOAD_FLAGS_BYPASS_LOAD_URI_DELEGATE?: 67108864;
    readonly LOAD_FLAGS_USER_ACTIVATION?: 134217728;
    readonly STOP_NETWORK?: 1;
    readonly STOP_CONTENT?: 2;
    readonly STOP_ALL?: 3;

    readonly canGoBack: boolean;
    readonly canGoBackIgnoringUserInteraction: boolean;
    readonly canGoForward: boolean;
    goBack(aRequireUserInteraction?: boolean, aUserActivation?: boolean): void;
    goForward(aRequireUserInteraction?: boolean, aUserActivation?: boolean): void;
    gotoIndex(index: i32, aUserActivation?: boolean): void;
    loadURI(aURI: nsIURI, aLoadURIOptions: any): void;
    fixupAndLoadURIString(aURIString: string, aLoadURIOptions: any): void;
    reload(aReloadFlags: u32): void;
    stop(aStopFlags: u32): void;
    readonly document: Document;
    readonly currentURI: nsIURI;
    readonly sessionHistory: nsISupports;
    resumeRedirectedLoad(aLoadIdentifier: u64, aHistoryIndex: i32): void;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIWebNavigationInfo.idl

  interface nsIWebNavigationInfo extends nsISupports {
    readonly UNSUPPORTED?: 0;
    readonly IMAGE?: 1;
    readonly FALLBACK?: 2;
    readonly OTHER?: 32768;

    isTypeSupported(aType: string): u32;
  }

  // https://searchfox.org/mozilla-central/source/docshell/base/nsIWebPageDescriptor.idl

  interface nsIWebPageDescriptor extends nsISupports {
    loadPageAsViewSource(otherDocShell: nsIDocShell, aURL: string): void;
    readonly currentDescriptor: nsISupports;
  }

  // https://searchfox.org/mozilla-central/source/dom/base/mozIDOMWindow.idl

  interface mozIDOMWindow extends nsISupports {}

  interface mozIDOMWindowProxy extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/dom/base/nsIContentPolicy.idl
} // global

declare enum nsIContentPolicy_nsContentPolicyType {
  TYPE_INVALID = 0,
  TYPE_OTHER = 1,
  TYPE_SCRIPT = 2,
  TYPE_IMAGE = 3,
  TYPE_STYLESHEET = 4,
  TYPE_OBJECT = 5,
  TYPE_DOCUMENT = 6,
  TYPE_SUBDOCUMENT = 7,
  TYPE_PING = 10,
  TYPE_XMLHTTPREQUEST = 11,
  TYPE_OBJECT_SUBREQUEST = 12,
  TYPE_DTD = 13,
  TYPE_FONT = 14,
  TYPE_MEDIA = 15,
  TYPE_WEBSOCKET = 16,
  TYPE_CSP_REPORT = 17,
  TYPE_XSLT = 18,
  TYPE_BEACON = 19,
  TYPE_FETCH = 20,
  TYPE_IMAGESET = 21,
  TYPE_WEB_MANIFEST = 22,
  TYPE_INTERNAL_SCRIPT = 23,
  TYPE_INTERNAL_WORKER = 24,
  TYPE_INTERNAL_SHARED_WORKER = 25,
  TYPE_INTERNAL_EMBED = 26,
  TYPE_INTERNAL_OBJECT = 27,
  TYPE_INTERNAL_FRAME = 28,
  TYPE_INTERNAL_IFRAME = 29,
  TYPE_INTERNAL_AUDIO = 30,
  TYPE_INTERNAL_VIDEO = 31,
  TYPE_INTERNAL_TRACK = 32,
  TYPE_INTERNAL_XMLHTTPREQUEST_ASYNC = 33,
  TYPE_INTERNAL_EVENTSOURCE = 34,
  TYPE_INTERNAL_SERVICE_WORKER = 35,
  TYPE_INTERNAL_SCRIPT_PRELOAD = 36,
  TYPE_INTERNAL_IMAGE = 37,
  TYPE_INTERNAL_IMAGE_PRELOAD = 38,
  TYPE_INTERNAL_STYLESHEET = 39,
  TYPE_INTERNAL_STYLESHEET_PRELOAD = 40,
  TYPE_INTERNAL_IMAGE_FAVICON = 41,
  TYPE_INTERNAL_WORKER_IMPORT_SCRIPTS = 42,
  TYPE_SAVEAS_DOWNLOAD = 43,
  TYPE_SPECULATIVE = 44,
  TYPE_INTERNAL_MODULE = 45,
  TYPE_INTERNAL_MODULE_PRELOAD = 46,
  TYPE_INTERNAL_DTD = 47,
  TYPE_INTERNAL_FORCE_ALLOWED_DTD = 48,
  TYPE_INTERNAL_AUDIOWORKLET = 49,
  TYPE_INTERNAL_PAINTWORKLET = 50,
  TYPE_INTERNAL_FONT_PRELOAD = 51,
  TYPE_INTERNAL_CHROMEUTILS_COMPILED_SCRIPT = 52,
  TYPE_INTERNAL_FRAME_MESSAGEMANAGER_SCRIPT = 53,
  TYPE_INTERNAL_FETCH_PRELOAD = 54,
  TYPE_UA_FONT = 55,
  TYPE_PROXIED_WEBRTC_MEDIA = 56,
  TYPE_WEB_IDENTITY = 57,
  TYPE_INTERNAL_WORKER_STATIC_MODULE = 58,
  TYPE_WEB_TRANSPORT = 59,
  TYPE_INTERNAL_XMLHTTPREQUEST_SYNC = 60,
  TYPE_INTERNAL_EXTERNAL_RESOURCE = 61,
  TYPE_JSON = 62,
  TYPE_INTERNAL_JSON_PRELOAD = 63,
  TYPE_END = 64,
}

declare global {
  namespace nsIContentPolicy {
    type nsContentPolicyType = nsIContentPolicy_nsContentPolicyType;
  }

  interface nsIContentPolicy
    extends nsISupports,
      Enums<typeof nsIContentPolicy_nsContentPolicyType> {
    readonly REJECT_REQUEST?: -1;
    readonly REJECT_TYPE?: -2;
    readonly REJECT_SERVER?: -3;
    readonly REJECT_OTHER?: -4;
    readonly REJECT_POLICY?: -5;
    readonly ACCEPT?: 1;

    shouldLoad(aContentLocation: nsIURI, aLoadInfo: nsILoadInfo): i16;
    shouldProcess(aContentLocation: nsIURI, aLoadInfo: nsILoadInfo): i16;
  }

  // https://searchfox.org/mozilla-central/source/dom/base/nsIDroppedLinkHandler.idl

  interface nsIDroppedLinkItem extends nsISupports {
    readonly url: string;
    readonly name: string;
    readonly type: string;
  }

  interface nsIDroppedLinkHandler extends nsISupports {
    canDropLink(aEvent: DragEvent, aAllowSameDocument: boolean): boolean;
    dropLinks(aEvent: DragEvent, aDisallowInherit?: boolean): nsIDroppedLinkItem[];
    validateURIsForDrop(aEvent: DragEvent, aURIs: string[], aDisallowInherit?: boolean): void;
    queryLinks(aDataTransfer: DataTransfer): nsIDroppedLinkItem[];
    getTriggeringPrincipal(aEvent: DragEvent): nsIPrincipal;
    getCsp(aEvent: DragEvent): nsIContentSecurityPolicy;
  }

  // https://searchfox.org/mozilla-central/source/dom/base/nsIEventSourceEventService.idl

  interface nsIEventSourceEventListener extends nsISupports {
    eventSourceConnectionOpened(aHttpChannelId: u64): void;
    eventSourceConnectionClosed(aHttpChannelId: u64): void;
    eventReceived(
      aHttpChannelId: u64,
      aEventName: string,
      aLastEventID: string,
      aData: string,
      aRetry: u32,
      aTimeStamp: DOMHighResTimeStamp
    ): void;
  }

  interface nsIEventSourceEventService extends nsISupports {
    addListener(aInnerWindowID: u64, aListener: nsIEventSourceEventListener): void;
    removeListener(aInnerWindowID: u64, aListener: nsIEventSourceEventListener): void;
    hasListenerFor(aInnerWindowID: u64): boolean;
  }

  // https://searchfox.org/mozilla-central/source/dom/base/nsIImageLoadingContent.idl

  interface nsIImageLoadingContent extends imgINotificationObserver {
    readonly UNKNOWN_REQUEST?: -1;
    readonly CURRENT_REQUEST?: 0;
    readonly PENDING_REQUEST?: 1;
  }

  // https://searchfox.org/mozilla-central/source/dom/base/nsIMessageManager.idl

  interface nsIMessageSender extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/dom/base/nsIObjectLoadingContent.idl

  interface nsIObjectLoadingContent extends nsISupports {
    readonly TYPE_LOADING?: 0;
    readonly TYPE_DOCUMENT?: 1;
    readonly TYPE_FALLBACK?: 2;

    readonly actualType: string;
    readonly displayedType: u32;
    readonly srcURI: nsIURI;
  }

  // https://searchfox.org/mozilla-central/source/dom/base/nsIScriptChannel.idl

  // https://searchfox.org/mozilla-central/source/dom/base/nsIScriptableContentIterator.idl
} // global

declare enum nsIScriptableContentIterator_IteratorType {
  NOT_INITIALIZED = 0,
  POST_ORDER_ITERATOR = 1,
  PRE_ORDER_ITERATOR = 2,
  SUBTREE_ITERATOR = 3,
}

declare global {
  namespace nsIScriptableContentIterator {
    type IteratorType = nsIScriptableContentIterator_IteratorType;
  }

  interface nsIScriptableContentIterator
    extends nsISupports,
      Enums<typeof nsIScriptableContentIterator_IteratorType> {
    initWithRootNode(aType: nsIScriptableContentIterator.IteratorType, aRoot: Node): void;
    initWithRange(aType: nsIScriptableContentIterator.IteratorType, aRange: Range): void;
    initWithRangeAllowCrossShadowBoundary(
      aType: nsIScriptableContentIterator.IteratorType,
      aRange: Range
    ): void;
    initWithPositions(
      aType: nsIScriptableContentIterator.IteratorType,
      aStartContainer: Node,
      aStartOffset: u32,
      aEndContainer: Node,
      aEndOffset: u32
    ): void;
    first(): void;
    last(): void;
    next(): void;
    prev(): void;
    readonly currentNode: Node;
    readonly isDone: boolean;
    positionAt(aNode: Node): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/base/nsISelectionController.idl
} // global

declare enum nsISelectionController_ControllerScrollFlags {
  SCROLL_SYNCHRONOUS = 2,
  SCROLL_FIRST_ANCESTOR_ONLY = 4,
  SCROLL_OVERFLOW_HIDDEN = 8,
  SCROLL_VERTICAL_NEAREST = 0,
  SCROLL_VERTICAL_START = 16,
  SCROLL_VERTICAL_CENTER = 32,
  SCROLL_VERTICAL_END = 64,
}

declare global {
  namespace nsISelectionController {
    type ControllerScrollFlags = nsISelectionController_ControllerScrollFlags;
  }

  interface nsISelectionController
    extends nsISelectionDisplay,
      Enums<typeof nsISelectionController_ControllerScrollFlags> {
    readonly SELECTION_NONE?: 0;
    readonly SELECTION_NORMAL?: 1;
    readonly SELECTION_SPELLCHECK?: 2;
    readonly SELECTION_IME_RAWINPUT?: 3;
    readonly SELECTION_IME_SELECTEDRAWTEXT?: 4;
    readonly SELECTION_IME_CONVERTEDTEXT?: 5;
    readonly SELECTION_IME_SELECTEDCONVERTEDTEXT?: 6;
    readonly SELECTION_ACCESSIBILITY?: 7;
    readonly SELECTION_FIND?: 8;
    readonly SELECTION_URLSECONDARY?: 9;
    readonly SELECTION_URLSTRIKEOUT?: 10;
    readonly SELECTION_TARGET_TEXT?: 11;
    readonly SELECTION_HIGHLIGHT?: 12;
    readonly NUM_SELECTIONTYPES?: 13;
    readonly SELECTION_ANCHOR_REGION?: 0;
    readonly SELECTION_FOCUS_REGION?: 1;
    readonly SELECTION_WHOLE_SELECTION?: 2;
    readonly NUM_SELECTION_REGIONS?: 3;
    readonly SELECTION_OFF?: 0;
    readonly SELECTION_HIDDEN?: 1;
    readonly SELECTION_ON?: 2;
    readonly SELECTION_DISABLED?: 3;
    readonly SELECTION_ATTENTION?: 4;
    readonly MOVE_LEFT?: 0;
    readonly MOVE_RIGHT?: 1;
    readonly MOVE_UP?: 2;
    readonly MOVE_DOWN?: 3;

    setDisplaySelection(toggle: i16): void;
    getDisplaySelection(): i16;
    getSelection(type: i16): Selection;
    scrollSelectionIntoView(
      type: i16,
      region: i16,
      flags: nsISelectionController.ControllerScrollFlags
    ): void;
    repaintSelection(type: i16): void;
    setCaretEnabled(enabled: boolean): void;
    setCaretReadOnly(readOnly: boolean): void;
    getCaretEnabled(): boolean;
    readonly caretVisible: boolean;
    setCaretVisibilityDuringSelection(visibility: boolean): void;
    characterMove(forward: boolean, extend: boolean): void;
    physicalMove(direction: i16, amount: i16, extend: boolean): void;
    wordMove(forward: boolean, extend: boolean): void;
    lineMove(forward: boolean, extend: boolean): void;
    intraLineMove(forward: boolean, extend: boolean): void;
    pageMove(forward: boolean, extend: boolean): void;
    completeScroll(forward: boolean): void;
    completeMove(forward: boolean, extend: boolean): void;
    scrollPage(forward: boolean): void;
    scrollLine(forward: boolean): void;
    scrollCharacter(right: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/base/nsISelectionDisplay.idl

  interface nsISelectionDisplay extends nsISupports {
    readonly DISPLAY_TEXT?: 1;
    readonly DISPLAY_IMAGES?: 2;
    readonly DISPLAY_FRAMES?: 4;
    readonly DISPLAY_ALL?: 7;

    setSelectionFlags(toggle: i16): void;
    getSelectionFlags(): i16;
  }

  // https://searchfox.org/mozilla-central/source/dom/base/nsISelectionListener.idl

  interface nsISelectionListener extends nsISupports {
    readonly NO_REASON?: 0;
    readonly DRAG_REASON?: 1;
    readonly MOUSEDOWN_REASON?: 2;
    readonly MOUSEUP_REASON?: 4;
    readonly KEYPRESS_REASON?: 8;
    readonly SELECTALL_REASON?: 16;
    readonly COLLAPSETOSTART_REASON?: 32;
    readonly COLLAPSETOEND_REASON?: 64;
    readonly IME_REASON?: 128;
    readonly JS_REASON?: 256;
    readonly CHARACTER_AMOUNT?: 0;
    readonly CLUSTER_AMOUNT?: 1;
    readonly WORD_AMOUNT?: 2;
    readonly WORDNOSPACE_AMOUNT?: 3;
    readonly LINE_AMOUNT?: 4;
    readonly BEGINLINE_AMOUNT?: 5;
    readonly ENDLINE_AMOUNT?: 6;
    readonly NO_AMOUNT?: 7;
    readonly PARAGRAPH_AMOUNT?: 8;

    notifySelectionChanged(doc: Document, sel: Selection, reason: i16, amount: i32): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/base/nsISlowScriptDebug.idl

  type nsISlowScriptDebugCallback = Callable<{
    handleSlowScriptDebug(aWindow: nsIDOMWindow): void;
  }>;

  type nsISlowScriptDebuggerStartupCallback = Callable<{
    finishDebuggerStartup(): void;
  }>;

  type nsISlowScriptDebugRemoteCallback = Callable<{
    handleSlowScriptDebug(
      aBrowser: EventTarget,
      aCallback: nsISlowScriptDebuggerStartupCallback
    ): void;
  }>;

  interface nsISlowScriptDebug extends nsISupports {
    activationHandler: nsISlowScriptDebugCallback;
    remoteActivationHandler: nsISlowScriptDebugRemoteCallback;
  }

  // https://searchfox.org/mozilla-central/source/dom/console/nsIConsoleAPIStorage.idl

  interface nsIConsoleAPIStorage extends nsISupports {
    getEvents(aId?: string): any;
    addLogEventListener(aListener: any, aPrincipal: nsIPrincipal): void;
    removeLogEventListener(aListener: any): void;
    recordEvent(aId: string, aEvent: any): void;
    clearEvents(aId?: string): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/file/ipc/mozIRemoteLazyInputStream.idl

  interface mozIRemoteLazyInputStream extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/dom/ipc/nsIDOMProcessChild.idl

  interface nsIDOMProcessChild extends nsISupports {
    readonly childID: u64;
    getActor(name: string): JSProcessActorChild;
    getExistingActor(name: string): JSProcessActorChild;
    readonly canSend: boolean;
  }

  // https://searchfox.org/mozilla-central/source/dom/ipc/nsIDOMProcessParent.idl

  interface nsIDOMProcessParent extends nsISupports {
    readonly childID: u64;
    readonly osPid: i32;
    getActor(name: string): JSProcessActorParent;
    getExistingActor(name: string): JSProcessActorParent;
    readonly canSend: boolean;
    readonly remoteType: string;
  }

  interface nsIContentParentKeepAlive extends nsISupports {
    readonly domProcess: nsIDOMProcessParent;
    invalidateKeepAlive(): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/ipc/nsIHangReport.idl

  interface nsIHangReport extends nsISupports {
    readonly scriptBrowser: Element;
    readonly scriptFileName: string;
    readonly hangDuration: double;
    readonly addonId: string;
    readonly childID: u64;
    userCanceled(): void;
    terminateScript(): void;
    beginStartingDebugger(): void;
    endStartingDebugger(): void;
    isReportForBrowserOrChildren(aFrameLoader: FrameLoader): boolean;
  }

  // https://searchfox.org/mozilla-central/source/dom/ipc/nsILoginDetectionService.idl

  interface nsILoginDetectionService extends nsISupports {
    init(): void;
    isLoginsLoaded(): boolean;
  }

  // https://searchfox.org/mozilla-central/source/dom/audiochannel/nsIAudioChannelAgent.idl

  interface nsISuspendedTypes extends nsISupports {
    readonly NONE_SUSPENDED?: 0;
    readonly SUSPENDED_BLOCK?: 1;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/domstubs.idl

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIBrowser.idl

  interface nsIBrowser extends nsISupports {
    dropLinks(links: string[], triggeringPrincipal: nsIPrincipal): void;
    swapBrowsers(aOtherBrowser: nsIBrowser): void;
    closeBrowser(): void;
    readonly isRemoteBrowser: boolean;
    readonly permanentKey: any;
    readonly contentPrincipal: nsIPrincipal;
    readonly contentPartitionedPrincipal: nsIPrincipal;
    readonly csp: nsIContentSecurityPolicy;
    readonly referrerInfo: nsIReferrerInfo;
    isNavigating: boolean;
    mayEnableCharacterEncodingMenu: boolean;
    updateForStateChange(aCharset: string, aDocumentURI: nsIURI, aContentType: string): void;
    updateWebNavigationForLocationChange(
      aCanGoBack: boolean,
      aCanGoBackIgnoringUserInteraction: boolean,
      aCanGoForward: boolean
    ): void;
    updateForLocationChange(
      aLocation: nsIURI,
      aCharset: string,
      aMayEnableCharacterEncodingMenu: boolean,
      aDocumentURI: nsIURI,
      aTitle: string,
      aContentPrincipal: nsIPrincipal,
      aContentPartitionedPrincipal: nsIPrincipal,
      aCSP: nsIContentSecurityPolicy,
      aReferrerInfo: nsIReferrerInfo,
      aIsSynthetic: boolean,
      aHasRequestContextID: boolean,
      aRequestContextID: u64,
      aContentType: string
    ): void;
    prepareToChangeRemoteness(): Promise<any>;
    beforeChangeRemoteness(): void;
    finishChangeRemoteness(aPendingSwitchId: u64): boolean;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIBrowserChild.idl

  interface nsIBrowserChild extends nsISupports {
    readonly messageManager: ContentFrameMessageManager;
    remoteDropLinks(links: nsIDroppedLinkItem[]): void;
    contentTransformsReceived(): Promise<any>;
    readonly tabId: u64;
    notifyNavigationFinished(): void;
    readonly chromeOuterWindowID: u64;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIBrowserDOMWindow.idl

  interface nsIOpenURIInFrameParams extends nsISupports {
    readonly openWindowInfo: nsIOpenWindowInfo;
    referrerInfo: nsIReferrerInfo;
    readonly isPrivate: boolean;
    triggeringPrincipal: nsIPrincipal;
    csp: nsIContentSecurityPolicy;
    readonly openerBrowser: Element;
    readonly openerOriginAttributes: any;
  }

  interface nsIBrowserDOMWindow extends nsISupports {
    readonly OPEN_DEFAULTWINDOW?: 0;
    readonly OPEN_CURRENTWINDOW?: 1;
    readonly OPEN_NEWWINDOW?: 2;
    readonly OPEN_NEWTAB?: 3;
    readonly OPEN_PRINT_BROWSER?: 4;
    readonly OPEN_NEWTAB_BACKGROUND?: 5;
    readonly OPEN_NEWTAB_FOREGROUND?: 6;
    readonly OPEN_NEW?: 0;
    readonly OPEN_EXTERNAL?: 1;
    readonly OPEN_NO_OPENER?: 4;
    readonly OPEN_NO_REFERRER?: 8;

    createContentWindow(
      aURI: nsIURI,
      aOpenWindowInfo: nsIOpenWindowInfo,
      aWhere: i16,
      aFlags: i32,
      aTriggeringPrincipal: nsIPrincipal,
      aCsp?: nsIContentSecurityPolicy
    ): BrowsingContext;
    createContentWindowInFrame(
      aURI: nsIURI,
      params: nsIOpenURIInFrameParams,
      aWhere: i16,
      aFlags: i32,
      aName: string
    ): Element;
    openURI(
      aURI: nsIURI,
      aOpenWindowInfo: nsIOpenWindowInfo,
      aWhere: i16,
      aFlags: i32,
      aTriggeringPrincipal: nsIPrincipal,
      aCsp?: nsIContentSecurityPolicy
    ): BrowsingContext;
    openURIInFrame(
      aURI: nsIURI,
      params: nsIOpenURIInFrameParams,
      aWhere: i16,
      aFlags: i32,
      aName: string
    ): Element;
    canClose(): boolean;
    readonly tabCount: u32;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIBrowserUsage.idl

  interface nsIBrowserUsage extends nsISupports {
    getUniqueDomainsVisitedInPast24Hours(): u32;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIContentPermissionPrompt.idl

  interface nsIContentPermissionType extends nsISupports {
    readonly type: string;
    readonly options: nsIArray;
  }

  interface nsIContentPermissionRequest extends nsISupports {
    readonly types: nsIArray;
    readonly principal: nsIPrincipal;
    readonly topLevelPrincipal: nsIPrincipal;
    readonly window: mozIDOMWindow;
    readonly element: Element;
    readonly hasValidTransientUserGestureActivation: boolean;
    readonly isRequestDelegatedToUnsafeThirdParty: boolean;
    getDelegatePrincipal(aType: string): nsIPrincipal;
    cancel(): void;
    allow(choices?: any): void;
  }

  type nsIContentPermissionPrompt = Callable<{
    prompt(request: nsIContentPermissionRequest): void;
  }>;

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIContentPrefService2.idl

  interface nsIContentPrefObserver extends nsISupports {
    onContentPrefSet(aGroup: string, aName: string, aValue: nsIVariant, aIsPrivate?: boolean): void;
    onContentPrefRemoved(aGroup: string, aName: string, aIsPrivate?: boolean): void;
  }

  interface nsIContentPrefService2 extends nsISupports {
    readonly GROUP_NAME_MAX_LENGTH?: 2000;

    getByName(name: string, context: nsILoadContext, callback: nsIContentPrefCallback2): void;
    getByDomainAndName(
      domain: string,
      name: string,
      context: nsILoadContext,
      callback: nsIContentPrefCallback2
    ): void;
    getBySubdomainAndName(
      domain: string,
      name: string,
      context: nsILoadContext,
      callback: nsIContentPrefCallback2
    ): void;
    getGlobal(name: string, context: nsILoadContext, callback: nsIContentPrefCallback2): void;
    getCachedByDomainAndName(domain: string, name: string, context: nsILoadContext): nsIContentPref;
    getCachedBySubdomainAndName(
      domain: string,
      name: string,
      context: nsILoadContext
    ): nsIContentPref[];
    getCachedGlobal(name: string, context: nsILoadContext): nsIContentPref;
    set(
      domain: string,
      name: string,
      value: nsIVariant,
      context: nsILoadContext,
      callback?: nsIContentPrefCallback2
    ): void;
    setGlobal(
      name: string,
      value: nsIVariant,
      context: nsILoadContext,
      callback?: nsIContentPrefCallback2
    ): void;
    removeByDomainAndName(
      domain: string,
      name: string,
      context: nsILoadContext,
      callback?: nsIContentPrefCallback2
    ): void;
    removeBySubdomainAndName(
      domain: string,
      name: string,
      context: nsILoadContext,
      callback?: nsIContentPrefCallback2
    ): void;
    removeGlobal(name: string, context: nsILoadContext, callback?: nsIContentPrefCallback2): void;
    removeByDomain(
      domain: string,
      context: nsILoadContext,
      callback?: nsIContentPrefCallback2
    ): void;
    removeBySubdomain(
      domain: string,
      context: nsILoadContext,
      callback?: nsIContentPrefCallback2
    ): void;
    removeByName(name: string, context: nsILoadContext, callback?: nsIContentPrefCallback2): void;
    removeAllDomains(context: nsILoadContext, callback?: nsIContentPrefCallback2): void;
    removeAllDomainsSince(
      since: u64,
      context: nsILoadContext,
      callback?: nsIContentPrefCallback2
    ): void;
    removeAllGlobals(context: nsILoadContext, callback?: nsIContentPrefCallback2): void;
    addObserverForName(name: string, observer: nsIContentPrefObserver): void;
    removeObserverForName(name: string, observer: nsIContentPrefObserver): void;
    extractDomain(str: string): string;
  }

  interface nsIContentPrefCallback2 extends nsISupports {
    readonly COMPLETE_OK?: 0;
    readonly COMPLETE_ERROR?: 1;

    handleResult(pref: nsIContentPref): void;
    handleError(error: nsresult): void;
    handleCompletion(reason: u16): void;
  }

  interface nsIContentPref extends nsISupports {
    readonly domain: string;
    readonly name: string;
    readonly value: nsIVariant;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIDOMGlobalPropertyInitializer.idl

  interface nsIDOMGlobalPropertyInitializer extends nsISupports {
    init(window: mozIDOMWindow): any;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIDOMWindow.idl

  interface nsIDOMWindow extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIDOMWindowUtils.idl

  interface nsIDOMWindowUtils extends nsISupports {
    readonly MODIFIER_ALT?: 1;
    readonly MODIFIER_CONTROL?: 2;
    readonly MODIFIER_SHIFT?: 4;
    readonly MODIFIER_META?: 8;
    readonly MODIFIER_ALTGRAPH?: 16;
    readonly MODIFIER_CAPSLOCK?: 32;
    readonly MODIFIER_FN?: 64;
    readonly MODIFIER_FNLOCK?: 128;
    readonly MODIFIER_NUMLOCK?: 256;
    readonly MODIFIER_SCROLLLOCK?: 512;
    readonly MODIFIER_SYMBOL?: 1024;
    readonly MODIFIER_SYMBOLLOCK?: 2048;
    readonly WHEEL_EVENT_CAUSED_BY_NO_LINE_OR_PAGE_DELTA_DEVICE?: 1;
    readonly WHEEL_EVENT_CAUSED_BY_MOMENTUM?: 2;
    readonly WHEEL_EVENT_CUSTOMIZED_BY_USER_PREFS?: 4;
    readonly WHEEL_EVENT_EXPECTED_OVERFLOW_DELTA_X_ZERO?: 16;
    readonly WHEEL_EVENT_EXPECTED_OVERFLOW_DELTA_X_POSITIVE?: 32;
    readonly WHEEL_EVENT_EXPECTED_OVERFLOW_DELTA_X_NEGATIVE?: 64;
    readonly WHEEL_EVENT_EXPECTED_OVERFLOW_DELTA_Y_ZERO?: 256;
    readonly WHEEL_EVENT_EXPECTED_OVERFLOW_DELTA_Y_POSITIVE?: 512;
    readonly WHEEL_EVENT_EXPECTED_OVERFLOW_DELTA_Y_NEGATIVE?: 1024;
    readonly NATIVE_MODIFIER_CAPS_LOCK?: 1;
    readonly NATIVE_MODIFIER_NUM_LOCK?: 2;
    readonly NATIVE_MODIFIER_SHIFT_LEFT?: 256;
    readonly NATIVE_MODIFIER_SHIFT_RIGHT?: 512;
    readonly NATIVE_MODIFIER_CONTROL_LEFT?: 1024;
    readonly NATIVE_MODIFIER_CONTROL_RIGHT?: 2048;
    readonly NATIVE_MODIFIER_ALT_LEFT?: 4096;
    readonly NATIVE_MODIFIER_ALT_RIGHT?: 8192;
    readonly NATIVE_MODIFIER_COMMAND_LEFT?: 16384;
    readonly NATIVE_MODIFIER_COMMAND_RIGHT?: 32768;
    readonly NATIVE_MODIFIER_HELP?: 65536;
    readonly NATIVE_MODIFIER_ALT_GRAPH?: 131072;
    readonly NATIVE_MODIFIER_FUNCTION?: 1048576;
    readonly NATIVE_MODIFIER_NUMERIC_KEY_PAD?: 16777216;
    readonly NATIVE_MOUSE_MESSAGE_BUTTON_DOWN?: 1;
    readonly NATIVE_MOUSE_MESSAGE_BUTTON_UP?: 2;
    readonly NATIVE_MOUSE_MESSAGE_MOVE?: 3;
    readonly NATIVE_MOUSE_MESSAGE_ENTER_WINDOW?: 4;
    readonly NATIVE_MOUSE_MESSAGE_LEAVE_WINDOW?: 5;
    readonly MOUSESCROLL_PREFER_WIDGET_AT_POINT?: 1;
    readonly MOUSESCROLL_SCROLL_LINES?: 2;
    readonly MOUSESCROLL_WIN_SCROLL_LPARAM_NOT_NULL?: 65536;
    readonly TOUCH_HOVER?: 1;
    readonly TOUCH_CONTACT?: 2;
    readonly TOUCH_REMOVE?: 4;
    readonly TOUCH_CANCEL?: 8;
    readonly PHASE_BEGIN?: 0;
    readonly PHASE_UPDATE?: 1;
    readonly PHASE_END?: 2;
    readonly UPDATE_TYPE_RESTORE?: 0;
    readonly UPDATE_TYPE_MAIN_THREAD?: 1;
    readonly SCROLL_MODE_INSTANT?: 0;
    readonly SCROLL_MODE_SMOOTH?: 1;
    readonly FLUSH_NONE?: -1;
    readonly FLUSH_STYLE?: 0;
    readonly FLUSH_LAYOUT?: 1;
    readonly IME_STATUS_DISABLED?: 0;
    readonly IME_STATUS_ENABLED?: 1;
    readonly IME_STATUS_PASSWORD?: 2;
    readonly INPUT_CONTEXT_ORIGIN_MAIN?: 0;
    readonly INPUT_CONTEXT_ORIGIN_CONTENT?: 1;
    readonly CONTENT_COMMAND_FLAG_PREVENT_SET_SELECTION?: 2;
    readonly QUERY_CONTENT_FLAG_USE_NATIVE_LINE_BREAK?: 0;
    readonly QUERY_CONTENT_FLAG_USE_XP_LINE_BREAK?: 1;
    readonly QUERY_CONTENT_FLAG_SELECTION_SPELLCHECK?: 2;
    readonly QUERY_CONTENT_FLAG_SELECTION_IME_RAWINPUT?: 4;
    readonly QUERY_CONTENT_FLAG_SELECTION_IME_SELECTEDRAWTEXT?: 8;
    readonly QUERY_CONTENT_FLAG_SELECTION_IME_CONVERTEDTEXT?: 16;
    readonly QUERY_CONTENT_FLAG_SELECTION_IME_SELECTEDCONVERTEDTEXT?: 32;
    readonly QUERY_CONTENT_FLAG_SELECTION_ACCESSIBILITY?: 64;
    readonly QUERY_CONTENT_FLAG_SELECTION_FIND?: 128;
    readonly QUERY_CONTENT_FLAG_SELECTION_URLSECONDARY?: 256;
    readonly QUERY_CONTENT_FLAG_SELECTION_URLSTRIKEOUT?: 512;
    readonly QUERY_CONTENT_FLAG_OFFSET_RELATIVE_TO_INSERTION_POINT?: 1024;
    readonly QUERY_SELECTED_TEXT?: 3200;
    readonly QUERY_TEXT_CONTENT?: 3201;
    readonly QUERY_CARET_RECT?: 3203;
    readonly QUERY_TEXT_RECT?: 3204;
    readonly QUERY_EDITOR_RECT?: 3205;
    readonly QUERY_CHARACTER_AT_POINT?: 3208;
    readonly QUERY_TEXT_RECT_ARRAY?: 3209;
    readonly SELECTION_SET_FLAG_USE_NATIVE_LINE_BREAK?: 0;
    readonly SELECTION_SET_FLAG_USE_XP_LINE_BREAK?: 1;
    readonly SELECTION_SET_FLAG_REVERSE?: 2;
    readonly SELECT_CHARACTER?: 0;
    readonly SELECT_CLUSTER?: 1;
    readonly SELECT_WORD?: 2;
    readonly SELECT_LINE?: 3;
    readonly SELECT_BEGINLINE?: 4;
    readonly SELECT_ENDLINE?: 5;
    readonly SELECT_PARAGRAPH?: 6;
    readonly SELECT_WORDNOSPACE?: 7;
    readonly AUDIO_INPUT?: 0;
    readonly AUDIO_OUTPUT?: 1;
    readonly AGENT_SHEET?: 0;
    readonly USER_SHEET?: 1;
    readonly AUTHOR_SHEET?: 2;
    readonly WR_CAPTURE_SCENE?: 1;
    readonly WR_CAPTURE_FRAME?: 2;
    readonly WR_CAPTURE_TILE_CACHE?: 4;
    readonly WR_CAPTURE_EXTERNAL_RESOURCES?: 8;
    readonly DEFAULT_MOUSE_POINTER_ID?: 0;
    readonly DEFAULT_PEN_POINTER_ID?: 1;
    readonly DEFAULT_TOUCH_POINTER_ID?: 2;
    readonly MOUSE_BUTTON_LEFT_BUTTON?: 0;
    readonly MOUSE_BUTTON_MIDDLE_BUTTON?: 1;
    readonly MOUSE_BUTTON_RIGHT_BUTTON?: 2;
    readonly MOUSE_BUTTONS_NO_BUTTON?: 0;
    readonly MOUSE_BUTTONS_LEFT_BUTTON?: 1;
    readonly MOUSE_BUTTONS_RIGHT_BUTTON?: 2;
    readonly MOUSE_BUTTONS_MIDDLE_BUTTON?: 4;
    readonly MOUSE_BUTTONS_4TH_BUTTON?: 8;
    readonly MOUSE_BUTTONS_5TH_BUTTON?: 16;
    readonly MOUSE_BUTTONS_NOT_SPECIFIED?: -1;
    readonly DIRECTION_LTR?: 0;
    readonly DIRECTION_RTL?: 1;
    readonly DIRECTION_NOT_SET?: 2;

    imageAnimationMode: u16;
    readonly docCharsetIsForced: boolean;
    readonly physicalMillimeterInCSSPixels: float;
    getDocumentMetadata(aName: string): string;
    getLastOverWindowPointerLocationInCSSPixels(aX: OutParam<float>, aY: OutParam<float>): void;
    updateLayerTree(): void;
    readonly lastTransactionId: u64;
    getViewportInfo(
      aDisplayWidth: u32,
      aDisplayHeight: u32,
      aDefaultZoom: OutParam<double>,
      aAllowZoom: OutParam<boolean>,
      aMinZoom: OutParam<double>,
      aMaxZoom: OutParam<double>,
      aWidth: OutParam<u32>,
      aHeight: OutParam<u32>,
      aAutoSize: OutParam<boolean>
    ): void;
    getViewportFitInfo(): string;
    getDocumentViewerSize(aDisplayWidth: OutParam<u32>, aDisplayHeight: OutParam<u32>): void;
    setMousewheelAutodir(aElement: Element, aEnabled: boolean, aHonourRoot: boolean): void;
    setDisplayPortForElement(
      aXPx: float,
      aYPx: float,
      aWidthPx: float,
      aHeightPx: float,
      aElement: Element,
      aPriority: u32
    ): void;
    setDisplayPortMarginsForElement(
      aLeftMargin: float,
      aTopMargin: float,
      aRightMargin: float,
      aBottomMargin: float,
      aElement: Element,
      aPriority: u32
    ): void;
    setDisplayPortBaseForElement(
      aX: i32,
      aY: i32,
      aWidth: i32,
      aHeight: i32,
      aElement: Element
    ): void;
    getScrollbarSizes(
      aElement: Element,
      aVerticalScrollbarWidth: OutParam<u32>,
      aHorizontalScrollbarHeight: OutParam<u32>
    ): void;
    setResolutionAndScaleTo(aResolution: float): void;
    getResolution(): float;
    setRestoreResolution(aResolution: float, aDisplayWidth: u32, aDisplayHeight: u32): void;
    isFirstPaint: boolean;
    getPresShellId(): u32;
    isCORSSafelistedRequestHeader(name: string, value: string): boolean;
    sendMouseEvent(
      aType: string,
      aX: float,
      aY: float,
      aButton: i32,
      aClickCount: i32,
      aModifiers: i32,
      aIgnoreRootScrollFrame?: boolean,
      aPressure?: float,
      aInputSourceArg?: u16,
      aIsDOMEventSynthesized?: boolean,
      aIsWidgetEventSynthesized?: boolean,
      aButtons?: i32,
      aIdentifier?: u32
    ): boolean;
    sendTouchEvent(
      aType: string,
      aIdentifiers: u32[],
      aXs: i32[],
      aYs: i32[],
      aRxs: u32[],
      aRys: u32[],
      aRotationAngles: float[],
      aForces: float[],
      aTiltXs: i32[],
      aTiltYs: i32[],
      aTwists: i32[],
      aModifiers: i32,
      aIgnoreRootScrollFrame?: boolean
    ): boolean;
    sendTouchEventAsPen(
      aType: string,
      aIdentifier: u32,
      aX: i32,
      aY: i32,
      aRx: u32,
      aRy: u32,
      aRotationAngle: float,
      aForce: float,
      aTiltX: i32,
      aTiltY: i32,
      aTwist: i32,
      aModifier: i32,
      aIgnoreRootScrollFrame?: boolean
    ): boolean;
    sendMouseEventToWindow(
      aType: string,
      aX: float,
      aY: float,
      aButton: i32,
      aClickCount: i32,
      aModifiers: i32,
      aIgnoreRootScrollFrame?: boolean,
      aPressure?: float,
      aInputSourceArg?: u16,
      aIsDOMEventSynthesized?: boolean,
      aIsWidgetEventSynthesized?: boolean,
      aButtons?: i32,
      aIdentifier?: u32
    ): void;
    sendTouchEventToWindow(
      aType: string,
      aIdentifiers: u32[],
      aXs: i32[],
      aYs: i32[],
      aRxs: u32[],
      aRys: u32[],
      aRotationAngles: float[],
      aForces: float[],
      aTiltXs: i32[],
      aTiltYs: i32[],
      aTwists: i32[],
      aModifiers: i32,
      aIgnoreRootScrollFrame?: boolean
    ): boolean;
    sendWheelEvent(
      aX: float,
      aY: float,
      aDeltaX: double,
      aDeltaY: double,
      aDeltaZ: double,
      aDeltaMode: u32,
      aModifiers: i32,
      aLineOrPageDeltaX: i32,
      aLineOrPageDeltaY: i32,
      aOptions: u32
    ): void;
    sendNativeKeyEvent(
      aNativeKeyboardLayout: i32,
      aNativeKeyCode: i32,
      aModifierFlags: u32,
      aCharacters: string,
      aUnmodifiedCharacters: string,
      aObserver?: nsIObserver
    ): void;
    sendNativeMouseEvent(
      aScreenX: i32,
      aScreenY: i32,
      aNativeMessage: u32,
      aButton: i16,
      aModifierFlags: u32,
      aElementOnWidget: Element,
      aObserver?: nsIObserver
    ): void;
    suppressAnimation(aSuppress: boolean): void;
    sendNativeMouseScrollEvent(
      aScreenX: i32,
      aScreenY: i32,
      aNativeMessage: u32,
      aDeltaX: double,
      aDeltaY: double,
      aDeltaZ: double,
      aModifierFlags: u32,
      aAdditionalFlags: u32,
      aElement: Element,
      aObserver?: nsIObserver
    ): void;
    sendNativeTouchPoint(
      aPointerId: u32,
      aTouchState: u32,
      aScreenX: i32,
      aScreenY: i32,
      aPressure: double,
      aOrientation: u32,
      aObserver?: nsIObserver,
      aElement?: Element
    ): void;
    sendNativeTouchpadPinch(
      aEventPhase: u32,
      aScale: float,
      aScreenX: i32,
      aScreenY: i32,
      aModifierFlags: i32
    ): void;
    sendNativeTouchTap(
      aScreenX: i32,
      aScreenY: i32,
      aLongTap: boolean,
      aObserver?: nsIObserver
    ): void;
    sendNativePenInput(
      aPointerId: u32,
      aPointerState: u32,
      aScreenX: i32,
      aScreenY: i32,
      aPressure: double,
      aRotation: u32,
      aTiltX: i32,
      aTiltY: i32,
      aButton: i32,
      aObserver?: nsIObserver,
      aElement?: Element
    ): void;
    clearNativeTouchSequence(aObserver?: nsIObserver): void;
    sendNativeTouchpadDoubleTap(aScreenX: i32, aScreenY: i32, aModifierFlags: i32): void;
    sendNativeTouchpadPan(
      aEventPhase: u32,
      aScreenX: i32,
      aScreenY: i32,
      aDeltaX: double,
      aDeltaY: double,
      aModifierFlags: i32,
      aObserver?: nsIObserver
    ): void;
    readonly parsedStyleSheets: u32;
    activateNativeMenuItemAt(indexString: string): void;
    forceUpdateNativeMenuAt(indexString: string): void;
    GetSelectionAsPlaintext(): string;
    garbageCollect(aListener?: nsICycleCollectorListener): void;
    cycleCollect(aListener?: nsICycleCollectorListener): void;
    runNextCollectorTimer(aReason?: string): void;
    pokeGC(aReason?: string): void;
    sendSimpleGestureEvent(
      aType: string,
      aX: float,
      aY: float,
      aDirection: u32,
      aDelta: double,
      aModifiers: i32,
      aClickCount?: u32
    ): void;
    elementFromPoint(
      aX: float,
      aY: float,
      aIgnoreRootScrollFrame: boolean,
      aFlushLayout: boolean
    ): Element;
    nodesFromRect(
      aX: float,
      aY: float,
      aTopSize: float,
      aRightSize: float,
      aBottomSize: float,
      aLeftSize: float,
      aIgnoreRootScrollFrame: boolean,
      aFlushLayout: boolean,
      aOnlyVisible: boolean,
      aTransparencyThreshold?: float
    ): NodeList;
    getTranslationNodes(aRoot: Node): nsITranslationNodeList;
    compareCanvases(
      aCanvas1: nsISupports,
      aCanvas2: nsISupports,
      aMaxDifference: OutParam<u32>
    ): u32;
    readonly isMozAfterPaintPending: boolean;
    readonly isWindowFullyOccluded: boolean;
    readonly isCompositorPaused: boolean;
    readonly isInputTaskManagerSuspended: boolean;
    suppressEventHandling(aSuppress: boolean): void;
    disableNonTestMouseEvents(aDisable: boolean): void;
    getScrollXY(aFlushLayout: boolean, aScrollX: OutParam<i32>, aScrollY: OutParam<i32>): void;
    getScrollXYFloat(
      aFlushLayout: boolean,
      aScrollX: OutParam<float>,
      aScrollY: OutParam<float>
    ): void;
    getScrollbarSize(aFlushLayout: boolean, aWidth: OutParam<i32>, aHeight: OutParam<i32>): void;
    getBoundsWithoutFlushing(aElement: Element): DOMRect;
    getWidgetOpaqueRegion(): DOMRect[];
    scrollToVisual(aOffsetX: float, aOffsetY: float, aUpdateType: i32, aScrollMode: i32): void;
    getVisualViewportOffsetRelativeToLayoutViewport(
      aOffsetX: OutParam<float>,
      aOffsetY: OutParam<float>
    ): void;
    getVisualViewportOffset(aOffsetX: OutParam<i32>, aOffsetY: OutParam<i32>): void;
    transformRectLayoutToVisual(aX: float, aY: float, aWidth: float, aHeight: float): DOMRect;
    toScreenRectInCSSUnits(aX: float, aY: float, aWidth: float, aHeight: float): DOMRect;
    toScreenRect(aX: float, aY: float, aWidth: float, aHeight: float): DOMRect;
    toTopLevelWidgetRect(aX: float, aY: float, aWidth: float, aHeight: float): DOMRect;
    convertFromParentProcessWidgetToLocal(
      aX: float,
      aY: float,
      aWidth: float,
      aHeight: float
    ): DOMRect;
    setDynamicToolbarMaxHeight(aHeightInScreen: u32): void;
    needsFlush(aFlushtype: i32): boolean;
    flushLayoutWithoutThrottledAnimations(): void;
    getRootBounds(): DOMRect;
    readonly IMEIsOpen: boolean;
    readonly IMEStatus: u32;
    readonly inputContextURI: nsIURI;
    readonly inputContextOrigin: u32;
    readonly nodeObservedByIMEContentObserver: Node;
    dispatchDOMEventViaPresShellForTesting(aTarget: Node, aEvent: Event): boolean;
    dispatchEventToChromeOnly(aTarget: EventTarget, aEvent: Event): boolean;
    getClassName(aObject: any): string;
    sendContentCommandEvent(
      aType: string,
      aTransferable?: nsITransferable,
      aString?: string,
      aOffset?: u32,
      aReplaceSrcString?: string,
      aAdditionalFlags?: u32
    ): void;
    sendQueryContentEvent(
      aType: u32,
      aOffset: i64,
      aLength: u32,
      aX: i32,
      aY: i32,
      aAdditionalFlags?: u32
    ): nsIQueryContentEventResult;
    remoteFrameFullscreenChanged(aFrameElement: Element): void;
    remoteFrameFullscreenReverted(): void;
    handleFullscreenRequests(): boolean;
    exitFullscreen(aDontRestoreViewSize?: boolean): void;
    sendSelectionSetEvent(aOffset: u32, aLength: u32, aAdditionalFlags?: u32): boolean;
    selectAtPoint(aX: float, aY: float, aSelectBehavior: u32): boolean;
    getVisitedDependentComputedStyle(
      aElement: Element,
      aPseudoElement: string,
      aPropertyName: string
    ): string;
    enterModalState(): void;
    leaveModalState(): void;
    isInModalState(): boolean;
    suspendTimeouts(): void;
    resumeTimeouts(): void;
    readonly layerManagerType: string;
    readonly layerManagerRemote: boolean;
    readonly isWebRenderRequested: boolean;
    readonly currentAudioBackend: string;
    readonly currentMaxAudioChannels: u32;
    defaultDevicesRoundTripLatency(): Promise<any>;
    readonly currentPreferredSampleRate: u32;
    audioDevices(aSide: u16): nsIArray;
    startFrameTimeRecording(): u32;
    stopFrameTimeRecording(startIndex: u32): float[];
    readonly displayDPI: float;
    advanceTimeAndRefresh(aMilliseconds: i64): void;
    restoreNormalRefresh(): void;
    readonly isTestControllingRefreshes: boolean;
    readonly asyncPanZoomEnabled: boolean;
    setAsyncScrollOffset(aElement: Element, aX: float, aY: float): void;
    setAsyncZoom(aRootElement: Element, aValue: float): void;
    flushApzRepaints(aElement?: Element): boolean;
    disableApzForElement(aElement: Element): void;
    zoomToFocusedInput(): void;
    computeAnimationDistance(
      element: Element,
      property: string,
      value1: string,
      value2: string
    ): double;
    getUnanimatedComputedStyle(
      aElement: Element,
      aPseudoElement: string,
      aProperty: string,
      aFlushType: i32
    ): string;
    readonly canvasBackgroundColor: string;
    readonly focusedInputType: string;
    readonly focusedActionHint: string;
    readonly focusedInputMode: string;
    readonly focusedAutocapitalize: string;
    readonly focusedAutocorrect: boolean;
    getViewId(aElement: Element): nsViewID;
    checkAndClearPaintedState(aElement: Element): boolean;
    checkAndClearDisplayListState(aElement: Element): boolean;
    getFileId(aFile: any): i64;
    getFilePath(aFile: any): string;
    getFileReferences(
      aDatabaseName: string,
      aId: i64,
      aRefCnt?: OutParam<i32>,
      aDBRefCnt?: OutParam<i32>
    ): boolean;
    flushPendingFileDeletions(): void;
    startPCCountProfiling(): void;
    stopPCCountProfiling(): void;
    purgePCCounts(): void;
    getPCCountScriptCount(): i32;
    getPCCountScriptSummary(script: i32): string;
    getPCCountScriptContents(script: i32): string;
    readonly paintingSuppressed: boolean;
    setVisualViewportSize(aWidth: float, aHeight: float): void;
    disableDialogs(): void;
    enableDialogs(): void;
    areDialogsEnabled(): boolean;
    resetDialogAbuseState(): void;
    loadSheet(sheetURI: nsIURI, type: u32): void;
    loadSheetUsingURIString(sheetURI: string, type: u32): void;
    addSheet(sheet: nsIPreloadedStyleSheet, type: u32): void;
    removeSheet(sheetURI: nsIURI, type: u32): void;
    removeSheetUsingURIString(sheetURI: string, type: u32): void;
    readonly isHandlingUserInput: boolean;
    readonly millisSinceLastUserInput: double;
    allowScriptsToClose(): void;
    readonly isParentWindowMainWidgetVisible: boolean;
    isNodeDisabledForEvents(aNode: Node): boolean;
    getOMTAStyle(aElement: Element, aProperty: string, aPseudoElement?: string): string;
    setHandlingUserInput(aHandlingInput: boolean): nsIJSRAIIHelper;
    isKeyboardEventUserActivity(aKeyboardEvent: Event): boolean;
    getContentAPZTestData(aElement?: Element): any;
    getCompositorAPZTestData(aElement?: Element): any;
    sendMozMouseHitTestEvent(aX: float, aY: float, aElement?: Element): void;
    postRestyleSelfEvent(aElement: Element): void;
    xpconnectArgument(aObj: nsISupports): void;
    askPermission(aRequest: nsIContentPermissionRequest): void;
    readonly restyleGeneration: u64;
    readonly framesConstructed: u64;
    readonly framesReflowed: u64;
    readonly animationTriggeredRestyles: u64;
    readonly refreshDriverHasPendingTick: boolean;
    setCustomTitlebar(aCustomTitlebar: boolean): void;
    setResizeMargin(aResizeMargin: i32): void;
    getFrameUniformityTestData(): any;
    enterChaosMode(): void;
    leaveChaosMode(): void;
    triggerDeviceReset(): void;
    hasRuleProcessorUsedByMultipleStyleSets(aSheetType: u32): boolean;
    respectDisplayPortSuppression(aEnabled: boolean): void;
    forceReflowInterrupt(): void;
    terminateGPUProcess(): void;
    readonly gpuProcessPid: i32;
    readonly rddProcessPid: i32;
    getStorageUsage(aStorage: Storage): i64;
    getDirectionFromText(aString: string): i32;
    ensureDirtyRootFrame(): void;
    wrCapture(): void;
    wrStartCaptureSequence(aPath: string, aFlags: u32): void;
    wrStopCaptureSequence(): void;
    setCompositionRecording(aValue: boolean): Promise<any>;
    startCompositionRecording(): Promise<any>;
    stopCompositionRecording(aWriteToDisk: boolean): Promise<any>;
    isCssPropertyRecordedInUseCounter(aProperty: string): boolean;
    resetMobileViewportManager(): void;
    isCoepCredentialless(): boolean;
    setHiDPIMode(aHiDPI: boolean): void;
    restoreHiDPIMode(): void;
    systemFont: string;
    readonly paintCount: u64;
    syncFlushCompositor(): void;
    getLayersId(aElement?: Element): u64;
    readonly effectivelyThrottlesFrameRequests: boolean;
    readonly webrtcRawDeviceId: string;
    readonly suspendedByBrowsingContextGroup: boolean;
    readonly hasScrollLinkedEffect: boolean;
    readonly orientationLock: u32;
    getWheelScrollTarget(): Element;
    readonly dragSession: nsIDragSession;
  }

  interface nsITranslationNodeList extends nsISupports {
    readonly length: u32;
    item(index: u32): Node;
    isTranslationRootAtIndex(index: u32): boolean;
  }

  interface nsIJSRAIIHelper extends nsISupports {
    destruct(): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIFocusManager.idl

  interface nsIFocusManager extends nsISupports {
    readonly FLAG_RAISE?: 1;
    readonly FLAG_NOSCROLL?: 2;
    readonly FLAG_NOSWITCHFRAME?: 4;
    readonly FLAG_NOPARENTFRAME?: 8;
    readonly FLAG_NONSYSTEMCALLER?: 16;
    readonly FLAG_BYMOUSE?: 4096;
    readonly FLAG_BYKEY?: 8192;
    readonly FLAG_BYMOVEFOCUS?: 16384;
    readonly FLAG_NOSHOWRING?: 32768;
    readonly FLAG_SHOWRING?: 65536;
    readonly FLAG_BYTOUCH?: 131072;
    readonly FLAG_BYJS?: 262144;
    readonly FLAG_BYLONGPRESS?: 524288;
    readonly METHOD_MASK?: 946176;
    readonly METHODANDRING_MASK?: 1044480;
    readonly MOVEFOCUS_FORWARD?: 1;
    readonly MOVEFOCUS_BACKWARD?: 2;
    readonly MOVEFOCUS_FORWARDDOC?: 3;
    readonly MOVEFOCUS_BACKWARDDOC?: 4;
    readonly MOVEFOCUS_FIRST?: 5;
    readonly MOVEFOCUS_LAST?: 6;
    readonly MOVEFOCUS_ROOT?: 7;
    readonly MOVEFOCUS_CARET?: 8;
    readonly MOVEFOCUS_FIRSTDOC?: 9;
    readonly MOVEFOCUS_LASTDOC?: 10;

    readonly activeWindow: mozIDOMWindowProxy;
    readonly activeBrowsingContext: BrowsingContext;
    readonly activeContentBrowsingContext: BrowsingContext;
    focusedWindow: mozIDOMWindowProxy;
    readonly focusedContentBrowsingContext: BrowsingContext;
    readonly focusedElement: Element;
    getLastFocusMethod(window: mozIDOMWindowProxy): u32;
    setFocus(aElement: Element, aFlags: u32): void;
    moveFocus(
      aWindow: mozIDOMWindowProxy,
      aStartElement: Element,
      aType: u32,
      aFlags: u32
    ): Element;
    clearFocus(aWindow: mozIDOMWindowProxy): void;
    getFocusedElementForWindow(
      aWindow: mozIDOMWindowProxy,
      aDeep: boolean,
      aFocusedWindow: OutParam<mozIDOMWindowProxy>
    ): Element;
    moveCaretToFocus(aWindow: mozIDOMWindowProxy): void;
    elementIsFocusable(aElement: Element, aFlags: u32): boolean;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIGeckoViewServiceWorker.idl

  interface nsIGeckoViewServiceWorker extends nsISupports {
    openWindow(uri: nsIURI, aOpenWindowInfo: nsIOpenWindowInfo): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIPermissionDelegateHandler.idl

  interface nsIPermissionDelegateHandler extends nsISupports {
    maybeUnsafePermissionDelegate(aTypes: string[]): boolean;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIQueryContentEventResult.idl

  interface nsIQueryContentEventResult extends nsISupports {
    readonly offset: u32;
    readonly tentativeCaretOffset: u32;
    readonly reversed: boolean;
    readonly left: i32;
    readonly top: i32;
    readonly width: i32;
    readonly height: i32;
    readonly text: string;
    getCharacterRect(
      offset: i32,
      left: OutParam<i32>,
      top: OutParam<i32>,
      width: OutParam<i32>,
      height: OutParam<i32>
    ): void;
    readonly succeeded: boolean;
    readonly notFound: boolean;
    readonly tentativeCaretOffsetNotFound: boolean;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIRemoteTab.idl
} // global

declare enum nsIRemoteTab_NavigationType {
  NAVIGATE_BACK = 0,
  NAVIGATE_FORWARD = 1,
  NAVIGATE_INDEX = 2,
  NAVIGATE_URL = 3,
}

declare global {
  namespace nsIRemoteTab {
    type NavigationType = nsIRemoteTab_NavigationType;
  }

  interface nsIRemoteTab extends nsISupports, Enums<typeof nsIRemoteTab_NavigationType> {
    renderLayers: boolean;
    readonly hasLayers: boolean;
    priorityHint: boolean;
    deprioritize(): void;
    preserveLayers(aPreserveLayers: boolean): void;
    readonly tabId: u64;
    readonly contentProcessId: u64;
    readonly osPid: i32;
    readonly browsingContext: BrowsingContext;
    readonly hasPresented: boolean;
    transmitPermissionsForPrincipal(aPrincipal: nsIPrincipal): void;
    createAboutBlankDocumentViewer(
      aPrincipal: nsIPrincipal,
      aPartitionedPrincipal: nsIPrincipal
    ): void;
    maybeCancelContentJSExecution(
      aNavigationType: nsIRemoteTab.NavigationType,
      aCancelContentJSOptions?: any
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIServiceWorkerManager.idl

  interface nsIServiceWorkerUnregisterCallback extends nsISupports {
    unregisterSucceeded(aState: boolean): void;
    unregisterFailed(): void;
  }

  interface nsIServiceWorkerInfo extends nsISupports {
    readonly STATE_PARSED?: 0;
    readonly STATE_INSTALLING?: 1;
    readonly STATE_INSTALLED?: 2;
    readonly STATE_ACTIVATING?: 3;
    readonly STATE_ACTIVATED?: 4;
    readonly STATE_REDUNDANT?: 5;
    readonly STATE_UNKNOWN?: 6;

    readonly id: string;
    readonly scriptSpec: string;
    readonly cacheName: string;
    readonly launchCount: u32;
    readonly state: u16;
    readonly debugger: nsIWorkerDebugger;
    readonly handlesFetchEvents: boolean;
    readonly installedTime: PRTime;
    readonly activatedTime: PRTime;
    readonly redundantTime: PRTime;
    readonly lifetimeDeadline: double;
    readonly navigationFaultCount: u32;
    testingInjectCancellation: nsresult;
    attachDebugger(): void;
    detachDebugger(): void;
    terminateWorker(): Promise<any>;
  }

  interface nsIServiceWorkerRegistrationInfoListener extends nsISupports {
    onChange(): void;
  }

  interface nsIServiceWorkerRegistrationInfo extends nsISupports {
    readonly UPDATE_VIA_CACHE_IMPORTS?: 0;
    readonly UPDATE_VIA_CACHE_ALL?: 1;
    readonly UPDATE_VIA_CACHE_NONE?: 2;

    readonly principal: nsIPrincipal;
    readonly unregistered: boolean;
    readonly scope: string;
    readonly scriptSpec: string;
    readonly updateViaCache: u16;
    readonly lastUpdateTime: PRTime;
    readonly evaluatingWorker: nsIServiceWorkerInfo;
    readonly installingWorker: nsIServiceWorkerInfo;
    readonly waitingWorker: nsIServiceWorkerInfo;
    readonly activeWorker: nsIServiceWorkerInfo;
    readonly quotaUsageCheckCount: i32;
    getWorkerByID(aID: u64): nsIServiceWorkerInfo;
    addListener(listener: nsIServiceWorkerRegistrationInfoListener): void;
    removeListener(listener: nsIServiceWorkerRegistrationInfoListener): void;
    forceShutdown(): void;
  }

  interface nsIServiceWorkerManagerListener extends nsISupports {
    onRegister(aInfo: nsIServiceWorkerRegistrationInfo): void;
    onUnregister(aInfo: nsIServiceWorkerRegistrationInfo): void;
    onQuotaUsageCheckFinish(aInfo: nsIServiceWorkerRegistrationInfo): void;
  }

  interface nsIServiceWorkerManager extends nsISupports {
    reloadRegistrationsForTest(): void;
    registerForTest(aPrincipal: nsIPrincipal, aScope: string, aScriptURL: string): Promise<any>;
    registerForAddonPrincipal(aPrincipal: nsIPrincipal): Promise<any>;
    getRegistrationForAddonPrincipal(aPrincipal: nsIPrincipal): nsIServiceWorkerRegistrationInfo;
    wakeForExtensionAPIEvent(
      aExtensionBaseURL: string,
      aAPINamespace: string,
      aAPIEventName: string
    ): Promise<any>;
    unregister(
      aPrincipal: nsIPrincipal,
      aCallback: nsIServiceWorkerUnregisterCallback,
      aScope: string
    ): void;
    getRegistrationByPrincipal(
      aPrincipal: nsIPrincipal,
      aScope: string
    ): nsIServiceWorkerRegistrationInfo;
    getScopeForUrl(aPrincipal: nsIPrincipal, aPath: string): string;
    getAllRegistrations(): nsIArray;
    removeRegistrationsByOriginAttributes(aOriginAttributes: string): void;
    propagateUnregister(
      aPrincipal: nsIPrincipal,
      aCallback: nsIServiceWorkerUnregisterCallback,
      aScope: string
    ): void;
    sendPushEvent(aOriginAttributes: string, aScope: string, aDataBytes?: u8[]): void;
    sendPushSubscriptionChangeEvent(
      aOriginAttributes: string,
      scope: string,
      aOldSubscription?: nsIPushSubscription
    ): void;
    addListener(aListener: nsIServiceWorkerManagerListener): void;
    removeListener(aListener: nsIServiceWorkerManagerListener): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsIStructuredCloneContainer.idl

  interface nsIStructuredCloneContainer extends nsISupports {
    initFromBase64(aData: string, aFormatVersion: u32): void;
    deserializeToJsval(): any;
    getDataAsBase64(): string;
    readonly serializedNBytes: u64;
    readonly formatVersion: u32;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsITextInputProcessor.idl

  interface nsITextInputProcessor extends nsISupports {
    readonly ATTR_RAW_CLAUSE?: 2;
    readonly ATTR_SELECTED_RAW_CLAUSE?: 3;
    readonly ATTR_CONVERTED_CLAUSE?: 4;
    readonly ATTR_SELECTED_CLAUSE?: 5;
    readonly KEY_DEFAULT_PREVENTED?: 1;
    readonly KEY_NON_PRINTABLE_KEY?: 2;
    readonly KEY_FORCE_PRINTABLE_KEY?: 4;
    readonly KEY_KEEP_KEY_LOCATION_STANDARD?: 8;
    readonly KEY_KEEP_KEYCODE_ZERO?: 16;
    readonly KEY_DONT_DISPATCH_MODIFIER_KEY_EVENT?: 32;
    readonly KEY_DONT_MARK_KEYDOWN_AS_PROCESSED?: 64;
    readonly KEY_MARK_KEYUP_AS_PROCESSED?: 128;
    readonly KEYEVENT_NOT_CONSUMED?: 0;
    readonly KEYDOWN_IS_CONSUMED?: 1;
    readonly KEYPRESS_IS_CONSUMED?: 2;

    readonly hasComposition: boolean;
    beginInputTransaction(
      aWindow: mozIDOMWindow,
      aCallback: nsITextInputProcessorCallback
    ): boolean;
    beginInputTransactionForTests(
      aWindow: mozIDOMWindow,
      aCallback?: nsITextInputProcessorCallback
    ): boolean;
    startComposition(aKeyboardEvent?: Event, aKeyFlags?: u32): boolean;
    setPendingCompositionString(aString: string): void;
    appendClauseToPendingComposition(aLength: u32, aAttribute: u32): void;
    setCaretInPendingComposition(aOffset: u32): void;
    flushPendingComposition(aKeyboardEvent?: Event, aKeyFlags?: u32): boolean;
    commitComposition(aKeyboardEvent?: Event, aKeyFlags?: u32): void;
    commitCompositionWith(aCommitString: string, aKeyboardEvent?: Event, aKeyFlags?: u32): boolean;
    cancelComposition(aKeyboardEvent?: Event, aKeyFlags?: u32): void;
    keydown(aKeyboardEvent: Event, aKeyFlags?: u32): u32;
    keyup(aKeyboardEvent: Event, aKeyFlags?: u32): boolean;
    insertTextWithKeyPress(aString: string, aKeyboardEvent?: Event, aKeyFlags?: u32): boolean;
    getModifierState(aModifierKey: string): boolean;
    shareModifierStateOf(aOther: nsITextInputProcessor): void;
    computeCodeValueOfNonPrintableKey(aKeyValue: string, aLocation?: any): string;
    guessCodeValueOfPrintableKeyInUSEnglishKeyboardLayout(
      aKeyValue: string,
      aLocation?: any
    ): string;
    guessKeyCodeValueOfPrintableKeyInUSEnglishKeyboardLayout(
      aKeyValue: string,
      aLocation?: any
    ): u32;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/base/nsITextInputProcessorCallback.idl

  interface nsITextInputProcessorNotification extends nsISupports {
    readonly type: string;
    readonly hasRange: boolean;
    readonly offset: u32;
    readonly text: string;
    readonly collapsed: boolean;
    readonly length: u32;
    readonly reversed: boolean;
    readonly writingMode: string;
    readonly causedByComposition: boolean;
    readonly causedBySelectionEvent: boolean;
    readonly occurredDuringComposition: boolean;
    readonly removedLength: u32;
    readonly addedLength: u32;
    readonly causedOnlyByComposition: boolean;
    readonly includingChangesDuringComposition: boolean;
    readonly includingChangesWithoutComposition: boolean;
  }

  type nsITextInputProcessorCallback = Callable<{
    onNotify(
      aTextInputProcessor: nsITextInputProcessor,
      aNotification: nsITextInputProcessorNotification
    ): boolean;
  }>;

  // https://searchfox.org/mozilla-central/source/dom/bindings/nsIScriptError.idl

  interface nsIScriptErrorNote extends nsISupports {
    readonly errorMessage: string;
    readonly sourceName: string;
    readonly sourceId: u32;
    readonly lineNumber: u32;
    readonly columnNumber: u32;
    toString(): string;
  }

  interface nsIScriptError extends nsIConsoleMessage {
    readonly errorFlag?: 0;
    readonly warningFlag?: 1;
    readonly infoFlag?: 8;

    readonly errorMessage: string;
    readonly sourceName: string;
    readonly sourceId: u32;
    readonly lineNumber: u32;
    readonly columnNumber: u32;
    readonly flags: u32;
    readonly category: string;
    readonly outerWindowID: u64;
    readonly innerWindowID: u64;
    readonly isFromPrivateWindow: boolean;
    readonly isFromChromeContext: boolean;
    readonly isPromiseRejection: boolean;
    exception: any;
    readonly hasException: boolean;
    stack: any;
    errorMessageName: string;
    readonly notes: nsIArray;
    cssSelectors: string;
    init(
      message: string,
      sourceName: string,
      lineNumber: u32,
      columnNumber: u32,
      flags: u32,
      category: string,
      fromPrivateWindow?: boolean,
      fromChromeContext?: boolean
    ): void;
    initWithWindowID(
      message: string,
      sourceName: string,
      lineNumber: u32,
      columnNumber: u32,
      flags: u32,
      category: string,
      innerWindowID: u64,
      fromChromeContext?: boolean
    ): void;
    initWithSanitizedSource(
      message: string,
      sourceName: string,
      lineNumber: u32,
      columnNumber: u32,
      flags: u32,
      category: string,
      innerWindowID: u64,
      fromChromeContext?: boolean
    ): void;
    initWithSourceURI(
      message: string,
      sourceURI: nsIURI,
      lineNumber: u32,
      columnNumber: u32,
      flags: u32,
      category: string,
      innerWindowID: u64,
      fromChromeContext?: boolean
    ): void;
    initSourceId(sourceId: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/events/nsIDOMEventListener.idl

  // https://searchfox.org/mozilla-central/source/dom/interfaces/geolocation/nsIDOMGeoPosition.idl

  interface nsIDOMGeoPosition extends nsISupports {
    readonly timestamp: EpochTimeStamp;
    readonly coords: nsIDOMGeoPositionCoords;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/geolocation/nsIDOMGeoPositionCallback.idl

  type nsIDOMGeoPositionCallback = Callable<{
    handleEvent(position: nsIDOMGeoPosition): void;
  }>;

  // https://searchfox.org/mozilla-central/source/dom/interfaces/geolocation/nsIDOMGeoPositionCoords.idl

  interface nsIDOMGeoPositionCoords extends nsISupports {
    readonly latitude: double;
    readonly longitude: double;
    readonly altitude: double;
    readonly accuracy: double;
    readonly altitudeAccuracy: double;
    readonly heading: double;
    readonly speed: double;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/geolocation/nsIDOMGeoPositionErrorCallback.idl

  type nsIDOMGeoPositionErrorCallback = Callable<{
    handleEvent(positionError: GeolocationPositionError): void;
  }>;

  // https://searchfox.org/mozilla-central/source/toolkit/components/credentialmanagement/nsICredentialChooserService.idl

  interface nsICredentialChooserService extends nsISupports {
    showCredentialChooser(
      browsingContext: BrowsingContext,
      credentials: any[],
      callback: nsICredentialChosenCallback
    ): void;
    cancelCredentialChooser(browsingContext: BrowsingContext): void;
    fetchImageToDataURI(window: mozIDOMWindow, uri: nsIURI): Promise<any>;
    fetchWellKnown(uri: nsIURI, triggeringPrincipal: nsIPrincipal): Promise<any>;
    fetchConfig(uri: nsIURI, triggeringPrincipal: nsIPrincipal): Promise<any>;
    fetchAccounts(uri: nsIURI, triggeringPrincipal: nsIPrincipal): Promise<any>;
    fetchToken(uri: nsIURI, body: string, triggeringPrincipal: nsIPrincipal): Promise<any>;
    fetchDisconnect(uri: nsIURI, body: string, triggeringPrincipal: nsIPrincipal): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/credentialmanagement/nsICredentialChosenCallback.idl

  type nsICredentialChosenCallback = Callable<{
    notify(aChosenID: string): void;
  }>;

  // https://searchfox.org/mozilla-central/source/toolkit/components/credentialmanagement/nsIIdentityCredentialPromptService.idl

  interface nsIIdentityCredentialPromptService extends nsISupports {
    showProviderPrompt(
      browsingContext: BrowsingContext,
      identityProviders: any,
      identityManifests: any
    ): Promise<any>;
    showPolicyPrompt(
      browsingContext: BrowsingContext,
      identityProvider: any,
      identityManifest: any,
      identityClientMetadata: any
    ): Promise<any>;
    showAccountListPrompt(
      browsingContext: BrowsingContext,
      accountList: any,
      identityProvider: any,
      identityManifest: any
    ): Promise<any>;
    close(browsingContext: BrowsingContext): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/credentialmanagement/nsIIdentityCredentialStorageService.idl

  interface nsIIdentityCredentialStorageService extends nsISupports {
    setState(
      rpPrincipal: nsIPrincipal,
      idpPrincipal: nsIPrincipal,
      credentialID: string,
      registered: boolean,
      allowLogout: boolean
    ): void;
    getState(
      rpPrincipal: nsIPrincipal,
      idpPrincipal: nsIPrincipal,
      credentialID: string,
      registered: OutParam<boolean>,
      allowLogout: OutParam<boolean>
    ): void;
    delete(rpPrincipal: nsIPrincipal, idpPrincipal: nsIPrincipal, credentialID: string): void;
    connected(
      rpPrincipal: nsIPrincipal,
      idpPrincipal: nsIPrincipal,
      connected: OutParam<boolean>
    ): void;
    disconnect(rpPrincipal: nsIPrincipal, idpPrincipal: nsIPrincipal): void;
    clear(): void;
    deleteFromBaseDomain(baseDomain: string): void;
    deleteFromPrincipal(rpPrincipal: nsIPrincipal): void;
    deleteFromTimeRange(aFrom: PRTime, aTo: PRTime): void;
    deleteFromOriginAttributesPattern(aPattern: string): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/indexedDB/nsIIDBPermissionsRequest.idl

  interface nsIIDBPermissionsRequest extends nsISupports {
    readonly browserElement: Element;
    readonly responseObserver: nsIObserver;
  }

  // https://searchfox.org/mozilla-central/source/dom/indexedDB/nsIIndexedDatabaseManager.idl

  interface nsIIndexedDatabaseManager extends nsISupports {
    doMaintenance(): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/dom/localstorage/nsILocalStorageManager.idl

  interface nsILocalStorageManager extends nsISupports {
    readonly nextGenLocalStorageEnabled: boolean;
    preload(aPrincipal: nsIPrincipal): Promise<any>;
    isPreloaded(aPrincipal: nsIPrincipal): Promise<any>;
    getState(aPrincipal: nsIPrincipal): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/nsIAudioDeviceInfo.idl

  interface nsIAudioDeviceInfo extends nsISupports {
    readonly TYPE_UNKNOWN?: 0;
    readonly TYPE_INPUT?: 1;
    readonly TYPE_OUTPUT?: 2;
    readonly STATE_DISABLED?: 0;
    readonly STATE_UNPLUGGED?: 1;
    readonly STATE_ENABLED?: 2;
    readonly PREF_NONE?: 0;
    readonly PREF_MULTIMEDIA?: 1;
    readonly PREF_VOICE?: 2;
    readonly PREF_NOTIFICATION?: 4;
    readonly PREF_ALL?: 15;
    readonly FMT_S16LE?: 16;
    readonly FMT_S16BE?: 32;
    readonly FMT_F32LE?: 4096;
    readonly FMT_F32BE?: 8192;

    readonly name: string;
    readonly groupId: string;
    readonly vendor: string;
    readonly type: u16;
    readonly state: u16;
    readonly preferred: u16;
    readonly supportedFormat: u16;
    readonly defaultFormat: u16;
    readonly maxChannels: u32;
    readonly defaultRate: u32;
    readonly maxRate: u32;
    readonly minRate: u32;
    readonly maxLatency: u32;
    readonly minLatency: u32;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/nsIMediaDevice.idl

  interface nsIMediaDevice extends nsISupports {
    readonly type: string;
    readonly mediaSource: string;
    readonly rawId: string;
    readonly id: string;
    readonly scary: boolean;
    readonly canRequestOsLevelPrompt: boolean;
    readonly rawName: string;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/nsIMediaManager.idl

  interface nsIMediaManagerService extends nsISupports {
    readonly STATE_NOCAPTURE?: 0;
    readonly STATE_CAPTURE_ENABLED?: 1;
    readonly STATE_CAPTURE_DISABLED?: 2;

    readonly activeMediaCaptureWindows: nsIArray;
    mediaCaptureWindowState(
      aWindow: nsIDOMWindow,
      aCamera: OutParam<u16>,
      aMicrophone: OutParam<u16>,
      aScreenShare: OutParam<u16>,
      aWindowShare: OutParam<u16>,
      aBrowserShare: OutParam<u16>,
      devices: OutParam<nsIMediaDevice[]>
    ): void;
    sanitizeDeviceIds(sinceWhen: i64): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/network/interfaces/nsITCPSocketCallback.idl

  interface nsITCPSocketCallback extends nsISupports {
    readonly BUFFER_SIZE?: 65536;

    fireErrorEvent(name: string, type: string, errorCode: nsresult): void;
    fireDataStringEvent(type: string, data: string): void;
    fireDataArrayEvent(type: string, data: u8[]): void;
    fireEvent(type: string): void;
    updateReadyState(readystate: u32): void;
    updateBufferedAmount(bufferedAmount: u32, trackingNumber: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/network/interfaces/nsIUDPSocketChild.idl

  interface nsIUDPSocketInternal extends nsISupports {
    callListenerOpened(): void;
    callListenerConnected(): void;
    callListenerClosed(): void;
    callListenerReceivedData(host: string, port: u16, data: u8[]): void;
    callListenerError(message: string, filename: string, lineNumber: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/notification/nsINotificationStorage.idl

  interface nsINotificationActionStorageEntry extends nsISupports {
    readonly name: string;
    readonly title: string;
  }

  interface nsINotificationStorageEntry extends nsISupports {
    readonly id: string;
    readonly title: string;
    readonly dir: string;
    readonly lang: string;
    readonly body: string;
    readonly tag: string;
    readonly icon: string;
    readonly requireInteraction: boolean;
    readonly silent: boolean;
    readonly dataSerialized: string;
    readonly actions: nsINotificationActionStorageEntry[];
  }

  type nsINotificationStorageCallback = Callable<{
    done(aEntries: nsINotificationStorageEntry[]): void;
  }>;

  interface nsINotificationStorage extends nsISupports {
    put(aOrigin: string, aEntry: nsINotificationStorageEntry, aScope: string): void;
    get(
      origin: string,
      scope: string,
      tag: string,
      aCallback: nsINotificationStorageCallback
    ): void;
    delete(origin: string, id: string): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/payments/nsIPaymentActionResponse.idl

  interface nsIPaymentResponseData extends nsISupports {
    readonly GENERAL_RESPONSE?: 0;
    readonly BASICCARD_RESPONSE?: 1;

    readonly type: u32;
    init(aType: u32): void;
  }

  interface nsIGeneralResponseData extends nsIPaymentResponseData {
    readonly data: string;
    initData(aData: any): void;
  }

  interface nsIBasicCardResponseData extends nsIPaymentResponseData {
    readonly cardholderName: string;
    readonly cardNumber: string;
    readonly expiryMonth: string;
    readonly expiryYear: string;
    readonly cardSecurityCode: string;
    readonly billingAddress: nsIPaymentAddress;
    initData(
      aCardholderName: string,
      aCardNumber: string,
      aExpiryMonth: string,
      aExpiryYear: string,
      aCardSecurityCode: string,
      billingAddress: nsIPaymentAddress
    ): void;
  }

  interface nsIPaymentActionResponse extends nsISupports {
    readonly NO_TYPE?: 0;
    readonly CANMAKE_ACTION?: 2;
    readonly SHOW_ACTION?: 3;
    readonly ABORT_ACTION?: 4;
    readonly COMPLETE_ACTION?: 5;
    readonly ABORT_SUCCEEDED?: 1;
    readonly ABORT_FAILED?: 0;
    readonly PAYMENT_REJECTED?: 0;
    readonly PAYMENT_ACCEPTED?: 1;
    readonly PAYMENT_NOTSUPPORTED?: 2;
    readonly COMPLETE_SUCCEEDED?: 1;
    readonly COMPLETE_FAILED?: 0;

    readonly requestId: string;
    readonly type: u32;
  }

  interface nsIPaymentCanMakeActionResponse extends nsIPaymentActionResponse {
    readonly result: boolean;
    init(aRequestId: string, aResult: boolean): void;
  }

  interface nsIPaymentShowActionResponse extends nsIPaymentActionResponse {
    readonly acceptStatus: u32;
    readonly methodName: string;
    readonly data: nsIPaymentResponseData;
    readonly payerName: string;
    readonly payerEmail: string;
    readonly payerPhone: string;
    init(
      aRequestId: string,
      aAcceptStatus: u32,
      aMethodName: string,
      aData: nsIPaymentResponseData,
      aPayerName: string,
      aPayerEmail: string,
      aPayerPhone: string
    ): void;
  }

  interface nsIPaymentAbortActionResponse extends nsIPaymentActionResponse {
    readonly abortStatus: u32;
    init(aRequestId: string, aAbortStatus: u32): void;
    isSucceeded(): boolean;
  }

  interface nsIPaymentCompleteActionResponse extends nsIPaymentActionResponse {
    readonly completeStatus: u32;
    init(aRequestId: string, aCompleteStatus: u32): void;
    isCompleted(): boolean;
  }

  interface nsIMethodChangeDetails extends nsISupports {
    readonly GENERAL_DETAILS?: 0;
    readonly BASICCARD_DETAILS?: 1;

    readonly type: u32;
    init(aType: u32): void;
  }

  interface nsIGeneralChangeDetails extends nsIMethodChangeDetails {
    readonly details: string;
    initData(aDetails: any): void;
  }

  interface nsIBasicCardChangeDetails extends nsIMethodChangeDetails {
    readonly billingAddress: nsIPaymentAddress;
    initData(billingAddress: nsIPaymentAddress): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/payments/nsIPaymentAddress.idl

  interface nsIPaymentAddress extends nsISupports {
    readonly country: string;
    readonly addressLine: nsIArray;
    readonly region: string;
    readonly regionCode: string;
    readonly city: string;
    readonly dependentLocality: string;
    readonly postalCode: string;
    readonly sortingCode: string;
    readonly organization: string;
    readonly recipient: string;
    readonly phone: string;
    init(
      aCountry: string,
      aAddressLine: nsIArray,
      aRegion: string,
      aRegionCode: string,
      aCity: string,
      aDependentLocality: string,
      aPostalCode: string,
      aSortingCode: string,
      aOrganization: string,
      aRecipient: string,
      aPhone: string
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/payments/nsIPaymentRequest.idl

  interface nsIPaymentMethodData extends nsISupports {
    readonly supportedMethods: string;
    readonly data: any;
  }

  interface nsIPaymentCurrencyAmount extends nsISupports {
    readonly currency: string;
    readonly value: string;
  }

  interface nsIPaymentItem extends nsISupports {
    readonly label: string;
    readonly amount: nsIPaymentCurrencyAmount;
    readonly pending: boolean;
  }

  interface nsIPaymentDetailsModifier extends nsISupports {
    readonly supportedMethods: string;
    readonly total: nsIPaymentItem;
    readonly additionalDisplayItems: nsIArray;
    readonly data: any;
  }

  interface nsIPaymentShippingOption extends nsISupports {
    readonly id: string;
    readonly label: string;
    readonly amount: nsIPaymentCurrencyAmount;
    selected: boolean;
  }

  interface nsIPaymentDetails extends nsISupports {
    readonly id: string;
    readonly totalItem: nsIPaymentItem;
    readonly displayItems: nsIArray;
    readonly shippingOptions: nsIArray;
    readonly modifiers: nsIArray;
    readonly error: string;
    readonly shippingAddressErrors: any;
    readonly payerErrors: any;
    readonly paymentMethodErrors: any;
  }

  interface nsIPaymentOptions extends nsISupports {
    readonly requestPayerName: boolean;
    readonly requestPayerEmail: boolean;
    readonly requestPayerPhone: boolean;
    readonly requestShipping: boolean;
    readonly requestBillingAddress: boolean;
    readonly shippingType: string;
  }

  interface nsIPaymentRequest extends nsISupports {
    readonly topOuterWindowId: u64;
    readonly topLevelPrincipal: nsIPrincipal;
    readonly requestId: string;
    readonly completeStatus: string;
    readonly paymentMethods: nsIArray;
    readonly paymentDetails: nsIPaymentDetails;
    readonly paymentOptions: nsIPaymentOptions;
    readonly shippingOption: string;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/payments/nsIPaymentRequestService.idl

  interface nsIPaymentRequestService extends nsISupports {
    getPaymentRequestById(aRequestId: string): nsIPaymentRequest;
    enumerate(): nsISimpleEnumerator;
    respondPayment(aResponse: nsIPaymentActionResponse): void;
    changeShippingAddress(requestId: string, aAddress: nsIPaymentAddress): void;
    changeShippingOption(requestId: string, option: string): void;
    changePayerDetail(
      requestId: string,
      aPayerName: string,
      aPayerEmail: string,
      aPayerPhone: string
    ): void;
    changePaymentMethod(
      requestId: string,
      aMethodName: string,
      aMethodDetails: nsIMethodChangeDetails
    ): void;
    cleanup(): void;
    setTestingUIService(aUIService: nsIPaymentUIService): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/payments/nsIPaymentUIService.idl

  interface nsIPaymentUIService extends nsISupports {
    showPayment(requestId: string): void;
    abortPayment(requestId: string): void;
    completePayment(requestId: string): void;
    updatePayment(requestId: string): void;
    closePayment(requestId: string): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/power/nsIDOMWakeLockListener.idl

  type nsIDOMMozWakeLockListener = Callable<{
    callback(aTopic: string, aState: string): void;
  }>;

  // https://searchfox.org/mozilla-central/source/dom/power/nsIPowerManagerService.idl

  interface nsIPowerManagerService extends nsISupports {
    addWakeLockListener(aListener: nsIDOMMozWakeLockListener): void;
    removeWakeLockListener(aListener: nsIDOMMozWakeLockListener): void;
    getWakeLockState(aTopic: string): string;
    newWakeLock(aTopic: string, aWindow?: mozIDOMWindow): nsIWakeLock;
  }

  // https://searchfox.org/mozilla-central/source/dom/power/nsIWakeLock.idl

  interface nsIWakeLock extends nsISupports {
    unlock(): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/push/nsIPushErrorReporter.idl

  interface nsIPushErrorReporter extends nsISupports {
    readonly ACK_DELIVERED?: 0;
    readonly ACK_DECRYPTION_ERROR?: 1;
    readonly ACK_NOT_DELIVERED?: 2;
    readonly UNSUBSCRIBE_MANUAL?: 3;
    readonly UNSUBSCRIBE_QUOTA_EXCEEDED?: 4;
    readonly UNSUBSCRIBE_PERMISSION_REVOKED?: 5;
    readonly DELIVERY_UNCAUGHT_EXCEPTION?: 6;
    readonly DELIVERY_UNHANDLED_REJECTION?: 7;
    readonly DELIVERY_INTERNAL_ERROR?: 8;

    reportDeliveryError(messageId: string, reason?: u16): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/push/nsIPushNotifier.idl

  interface nsIPushNotifier extends nsISupports {
    notifyPush(scope: string, principal: nsIPrincipal, messageId: string): void;
    notifyPushWithData(scope: string, principal: nsIPrincipal, messageId: string, data: u8[]): void;
    notifySubscriptionChange(
      scope: string,
      principal: nsIPrincipal,
      oldSubscription?: nsIPushSubscription
    ): void;
    notifySubscriptionModified(scope: string, principal: nsIPrincipal): void;
    notifyError(scope: string, principal: nsIPrincipal, message: string, flags: u32): void;
  }

  interface nsIPushData extends nsISupports {
    text(): string;
    json(): any;
    binary(): u8[];
  }

  interface nsIPushMessage extends nsISupports {
    readonly principal: nsIPrincipal;
    readonly data: nsIPushData;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/push/nsIPushService.idl

  interface nsIPushSubscription extends nsISupports {
    readonly endpoint: string;
    readonly pushCount: i64;
    readonly lastPush: i64;
    readonly quota: i32;
    readonly isSystemSubscription: boolean;
    readonly p256dhPrivateKey: any;
    quotaApplies(): boolean;
    isExpired(): boolean;
    getKey(name: string): u8[];
  }

  type nsIPushSubscriptionCallback = Callable<{
    onPushSubscription(status: nsresult, subscription: nsIPushSubscription): void;
  }>;

  type nsIUnsubscribeResultCallback = Callable<{
    onUnsubscribe(status: nsresult, success: boolean): void;
  }>;

  type nsIPushClearResultCallback = Callable<{
    onClear(status: nsresult): void;
  }>;

  interface nsIPushService extends nsISupports {
    readonly pushTopic: string;
    readonly subscriptionChangeTopic: string;
    readonly subscriptionModifiedTopic: string;
    subscribe(scope: string, principal: nsIPrincipal, callback: nsIPushSubscriptionCallback): void;
    subscribeWithKey(
      scope: string,
      principal: nsIPrincipal,
      key: u8[],
      callback: nsIPushSubscriptionCallback
    ): void;
    unsubscribe(
      scope: string,
      principal: nsIPrincipal,
      callback: nsIUnsubscribeResultCallback
    ): void;
    getSubscription(
      scope: string,
      principal: nsIPrincipal,
      callback: nsIPushSubscriptionCallback
    ): void;
    clearForDomain(
      domain: string,
      originAttributesPattern: any,
      callback: nsIPushClearResultCallback
    ): void;
    clearForPrincipal(principal: nsIPrincipal, callback: nsIPushClearResultCallback): void;
  }

  interface nsIPushQuotaManager extends nsISupports {
    notificationForOriginShown(origin: string): void;
    notificationForOriginClosed(origin: string): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/quota/nsIQuotaArtificialFailure.idl
} // global

declare enum nsIQuotaArtificialFailure_Category {
  CATEGORY_NONE = 0,
  CATEGORY_INITIALIZE_ORIGIN = 1,
  CATEGORY_OPEN_CLIENT_DIRECTORY = 2,
  CATEGORY_CREATE_DIRECTORY_METADATA2 = 4,
}

declare global {
  namespace nsIQuotaArtificialFailure {
    type Category = nsIQuotaArtificialFailure_Category;
  }

  interface nsIQuotaArtificialFailure
    extends nsISupports,
      Enums<typeof nsIQuotaArtificialFailure_Category> {}

  // https://searchfox.org/mozilla-central/source/dom/quota/nsIQuotaCallbacks.idl

  type nsIQuotaUsageCallback = Callable<{
    onUsageResult(aRequest: nsIQuotaUsageRequest): void;
  }>;

  type nsIQuotaCallback = Callable<{
    onComplete(aRequest: nsIQuotaRequest): void;
  }>;

  // https://searchfox.org/mozilla-central/source/dom/quota/nsIQuotaManagerService.idl

  interface nsIQuotaManagerService extends nsISupports {
    storageName(): nsIQuotaRequest;
    storageInitialized(): nsIQuotaRequest;
    persistentStorageInitialized(): nsIQuotaRequest;
    temporaryStorageInitialized(): nsIQuotaRequest;
    temporaryGroupInitialized(aPrincipal: nsIPrincipal): nsIQuotaRequest;
    persistentOriginInitialized(aPrincipal: nsIPrincipal): nsIQuotaRequest;
    temporaryOriginInitialized(aPersistenceType: string, aPrincipal: nsIPrincipal): nsIQuotaRequest;
    init(): nsIQuotaRequest;
    initializePersistentStorage(): nsIQuotaRequest;
    initTemporaryStorage(): nsIQuotaRequest;
    initializeAllTemporaryOrigins(): nsIQuotaRequest;
    initializeTemporaryGroup(aPrincipal: nsIPrincipal): nsIQuotaRequest;
    initializePersistentOrigin(aPrincipal: nsIPrincipal): nsIQuotaRequest;
    initializeTemporaryOrigin(
      aPersistenceType: string,
      aPrincipal: nsIPrincipal,
      aCreateIfNonExistent?: boolean
    ): nsIQuotaRequest;
    initializePersistentClient(aPrincipal: nsIPrincipal, aClientType: string): nsIQuotaRequest;
    initializeTemporaryClient(
      aPersistenceType: string,
      aPrincipal: nsIPrincipal,
      aClientType: string
    ): nsIQuotaRequest;
    getFullOriginMetadata(aPersistenceType: string, aPrincipal: nsIPrincipal): nsIQuotaRequest;
    getUsage(aCallback: nsIQuotaUsageCallback, aGetAll?: boolean): nsIQuotaUsageRequest;
    getUsageForPrincipal(
      aPrincipal: nsIPrincipal,
      aCallback: nsIQuotaUsageCallback
    ): nsIQuotaUsageRequest;
    getCachedUsageForPrincipal(aPrincipal: nsIPrincipal): nsIQuotaRequest;
    listOrigins(): nsIQuotaRequest;
    listCachedOrigins(): nsIQuotaRequest;
    clear(): nsIQuotaRequest;
    clearStoragesForPrivateBrowsing(): nsIQuotaRequest;
    clearStoragesForOriginAttributesPattern(aPattern: string): nsIQuotaRequest;
    clearStoragesForPrincipal(aPrincipal: nsIPrincipal, aPersistenceType?: string): nsIQuotaRequest;
    clearStoragesForClient(
      aPrincipal: nsIPrincipal,
      aClientType: string,
      aPersistenceType?: string
    ): nsIQuotaRequest;
    clearStoragesForOriginPrefix(
      aPrincipal: nsIPrincipal,
      aPersistenceType?: string
    ): nsIQuotaRequest;
    reset(): nsIQuotaRequest;
    resetStoragesForPrincipal(aPrincipal: nsIPrincipal, aPersistenceType?: string): nsIQuotaRequest;
    resetStoragesForClient(
      aPrincipal: nsIPrincipal,
      aClientType: string,
      aPersistenceType?: string
    ): nsIQuotaRequest;
    persisted(aPrincipal: nsIPrincipal): nsIQuotaRequest;
    persist(aPrincipal: nsIPrincipal): nsIQuotaRequest;
    estimate(aPrincipal: nsIPrincipal): nsIQuotaRequest;
  }

  // https://searchfox.org/mozilla-central/source/dom/quota/nsIQuotaManagerServiceInternal.idl

  interface nsIQuotaManagerServiceInternal extends nsISupports {
    setThumbnailPrivateIdentityId(aThumbnailPrivateIdentityId: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/quota/nsIQuotaRequests.idl

  interface nsIQuotaRequestBase extends nsISupports {
    readonly principal: nsIPrincipal;
    readonly resultCode: nsresult;
    readonly resultName: string;
  }

  interface nsIQuotaUsageRequest extends nsIQuotaRequestBase {
    readonly result: nsIVariant;
    callback: nsIQuotaUsageCallback;
    cancel(): void;
  }

  interface nsIQuotaRequest extends nsIQuotaRequestBase {
    readonly result: nsIVariant;
    callback: nsIQuotaCallback;
  }

  // https://searchfox.org/mozilla-central/source/dom/quota/nsIQuotaResults.idl

  interface nsIQuotaFullOriginMetadataResult extends nsISupports {
    readonly suffix: string;
    readonly group: string;
    readonly origin: string;
    readonly storageOrigin: string;
    readonly persistenceType: string;
    readonly persisted: boolean;
    readonly lastAccessTime: i64;
  }

  interface nsIQuotaUsageResult extends nsISupports {
    readonly origin: string;
    readonly persisted: boolean;
    readonly usage: u64;
    readonly lastAccessed: u64;
  }

  interface nsIQuotaOriginUsageResult extends nsISupports {
    readonly databaseUsage: u64;
    readonly fileUsage: u64;
    readonly usage: u64;
    readonly databaseUsageIsExplicit: boolean;
    readonly fileUsageIsExplicit: boolean;
    readonly totalUsageIsExplicit: boolean;
  }

  interface nsIQuotaEstimateResult extends nsISupports {
    readonly usage: u64;
    readonly limit: u64;
  }

  // https://searchfox.org/mozilla-central/source/dom/quota/nsIQuotaUtilsService.idl

  interface nsIQuotaUtilsService extends nsISupports {
    getPrivateIdentityId(aName: string): u32;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/security/nsIContentSecurityManager.idl

  interface nsIContentSecurityManager extends nsISupports {
    performSecurityCheck(
      aChannel: nsIChannel,
      aStreamListener: nsIStreamListener
    ): nsIStreamListener;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/security/nsIContentSecurityPolicy.idl
} // global

declare enum nsIContentSecurityPolicy_CSPDirective {
  NO_DIRECTIVE = 0,
  DEFAULT_SRC_DIRECTIVE = 1,
  SCRIPT_SRC_DIRECTIVE = 2,
  OBJECT_SRC_DIRECTIVE = 3,
  STYLE_SRC_DIRECTIVE = 4,
  IMG_SRC_DIRECTIVE = 5,
  MEDIA_SRC_DIRECTIVE = 6,
  FRAME_SRC_DIRECTIVE = 7,
  FONT_SRC_DIRECTIVE = 8,
  CONNECT_SRC_DIRECTIVE = 9,
  REPORT_URI_DIRECTIVE = 10,
  FRAME_ANCESTORS_DIRECTIVE = 11,
  REFLECTED_XSS_DIRECTIVE = 12,
  BASE_URI_DIRECTIVE = 13,
  FORM_ACTION_DIRECTIVE = 14,
  WEB_MANIFEST_SRC_DIRECTIVE = 15,
  UPGRADE_IF_INSECURE_DIRECTIVE = 16,
  CHILD_SRC_DIRECTIVE = 17,
  BLOCK_ALL_MIXED_CONTENT = 18,
  SANDBOX_DIRECTIVE = 19,
  WORKER_SRC_DIRECTIVE = 20,
  SCRIPT_SRC_ELEM_DIRECTIVE = 21,
  SCRIPT_SRC_ATTR_DIRECTIVE = 22,
  STYLE_SRC_ELEM_DIRECTIVE = 23,
  STYLE_SRC_ATTR_DIRECTIVE = 24,
  REQUIRE_TRUSTED_TYPES_FOR_DIRECTIVE = 25,
  TRUSTED_TYPES_DIRECTIVE = 26,
  REPORT_TO_DIRECTIVE = 27,
}

declare enum nsIContentSecurityPolicy_RequireTrustedTypesForDirectiveState {
  NONE = 0,
  REPORT_ONLY = 1,
  ENFORCE = 2,
}

declare global {
  namespace nsIContentSecurityPolicy {
    type CSPDirective = nsIContentSecurityPolicy_CSPDirective;
    type RequireTrustedTypesForDirectiveState =
      nsIContentSecurityPolicy_RequireTrustedTypesForDirectiveState;
  }

  interface nsIContentSecurityPolicy
    extends nsISerializable,
      Enums<
        typeof nsIContentSecurityPolicy_CSPDirective &
          typeof nsIContentSecurityPolicy_RequireTrustedTypesForDirectiveState
      > {
    readonly VIOLATION_TYPE_EVAL?: 1;
    readonly VIOLATION_TYPE_WASM_EVAL?: 2;

    getPolicy(index: u32): string;
    readonly policyCount: u32;
    readonly upgradeInsecureRequests: boolean;
    readonly blockAllMixedContent: boolean;
    readonly enforcesFrameAncestors: boolean;
    appendPolicy(policyString: string, reportOnly: boolean, deliveredViaMetaTag: boolean): void;
    readonly requireTrustedTypesForDirectiveState: nsIContentSecurityPolicy.RequireTrustedTypesForDirectiveState;
    getAllowsInline(
      aDirective: nsIContentSecurityPolicy.CSPDirective,
      aHasUnsafeHash: boolean,
      aNonce: string,
      aParserCreated: boolean,
      aTriggeringElement: Element,
      aCSPEventListener: nsICSPEventListener,
      aContentOfPseudoScript: string,
      aLineNumber: u32,
      aColumnNumber: u32
    ): boolean;
    getAllowsEval(shouldReportViolations: OutParam<boolean>): boolean;
    getAllowsWasmEval(shouldReportViolations: OutParam<boolean>): boolean;
    getCSPSandboxFlags(): u32;
    logViolationDetails(
      violationType: u16,
      triggeringElement: Element,
      aCSPEventListener: nsICSPEventListener,
      sourceFile: string,
      scriptSample: string,
      lineNum: i32,
      columnNum: i32,
      nonce?: string,
      content?: string
    ): void;
    setRequestContextWithDocument(aDocument: Document): void;
    setRequestContextWithPrincipal(
      aRequestPrincipal: nsIPrincipal,
      aSelfURI: nsIURI,
      aReferrer: string,
      aInnerWindowId: u64
    ): void;
    permitsAncestry(aLoadInfo: nsILoadInfo): boolean;
    permits(
      aTriggeringElement: Element,
      aCSPEventListener: nsICSPEventListener,
      aURI: nsIURI,
      aDir: nsIContentSecurityPolicy.CSPDirective,
      aSpecific: boolean,
      aSendViolationReports: boolean
    ): boolean;
    shouldLoad(
      aContentType: nsContentPolicyType,
      aCSPEventListener: nsICSPEventListener,
      aLoadInfo: nsILoadInfo,
      aContentLocation: nsIURI,
      aOriginalURIIfRedirect: nsIURI,
      aSendViolationReports: boolean
    ): i16;
    toJSON(): string;
  }

  type nsICSPEventListener = Callable<{
    onCSPViolationEvent(aJSON: string): void;
  }>;

  // https://searchfox.org/mozilla-central/source/dom/interfaces/security/nsIReferrerInfo.idl
} // global

declare enum nsIReferrerInfo_ReferrerPolicyIDL {
  EMPTY = 0,
  NO_REFERRER_WHEN_DOWNGRADE = 1,
  NO_REFERRER = 2,
  ORIGIN = 3,
  ORIGIN_WHEN_CROSS_ORIGIN = 4,
  UNSAFE_URL = 5,
  SAME_ORIGIN = 6,
  STRICT_ORIGIN = 7,
  STRICT_ORIGIN_WHEN_CROSS_ORIGIN = 8,
}

declare global {
  namespace nsIReferrerInfo {
    type ReferrerPolicyIDL = nsIReferrerInfo_ReferrerPolicyIDL;
  }

  interface nsIReferrerInfo
    extends nsISerializable,
      Enums<typeof nsIReferrerInfo_ReferrerPolicyIDL> {
    readonly originalReferrer: nsIURI;
    readonly referrerPolicy: nsIReferrerInfo.ReferrerPolicyIDL;
    getReferrerPolicyString(): string;
    readonly sendReferrer: boolean;
    readonly computedReferrerSpec: string;
    equals(other: nsIReferrerInfo): boolean;
    init(
      aReferrerPolicy: nsIReferrerInfo.ReferrerPolicyIDL,
      aSendReferrer?: boolean,
      aOriginalReferrer?: nsIURI
    ): void;
    initWithDocument(aDocument: Document): void;
    initWithElement(aNode: Element): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/security/nsIHttpsOnlyModePermission.idl

  interface nsIHttpsOnlyModePermission extends nsISupports {
    readonly LOAD_INSECURE_DEFAULT?: 0;
    readonly LOAD_INSECURE_ALLOW?: 1;
    readonly LOAD_INSECURE_BLOCK?: 2;
    readonly LOAD_INSECURE_ALLOW_SESSION?: 9;
    readonly HTTPSFIRST_LOAD_INSECURE_ALLOW?: 10;
  }

  // https://searchfox.org/mozilla-central/source/dom/serializers/nsIDocumentEncoder.idl

  interface nsIDocumentEncoderNodeFixup extends nsISupports {
    fixupNode(aNode: Node, aSerializeCloneKids: OutParam<boolean>): Node;
  }

  interface nsIDocumentEncoder extends nsISupports {
    readonly OutputSelectionOnly?: 1;
    readonly OutputFormatted?: 2;
    readonly OutputRaw?: 4;
    readonly OutputBodyOnly?: 8;
    readonly OutputPreformatted?: 16;
    readonly OutputWrap?: 32;
    readonly OutputFormatFlowed?: 64;
    readonly OutputAbsoluteLinks?: 128;
    readonly OutputCRLineBreak?: 512;
    readonly OutputLFLineBreak?: 1024;
    readonly OutputNoScriptContent?: 2048;
    readonly OutputNoFramesContent?: 4096;
    readonly OutputNoFormattingInPre?: 8192;
    readonly OutputEncodeBasicEntities?: 16384;
    readonly OutputPersistNBSP?: 131072;
    readonly OutputDontRewriteEncodingDeclaration?: 262144;
    readonly SkipInvisibleContent?: 524288;
    readonly OutputFormatDelSp?: 1048576;
    readonly OutputDropInvisibleBreak?: 2097152;
    readonly OutputIgnoreMozDirty?: 4194304;
    readonly OutputForPlainTextClipboardCopy?: 33554432;
    readonly OutputRubyAnnotation?: 67108864;
    readonly OutputDisallowLineBreaking?: 134217728;
    readonly RequiresReinitAfterOutput?: 268435456;
    readonly AllowCrossShadowBoundary?: 536870912;
    readonly MimicChromeToStringBehaviour?: 1073741824;

    init(aDocument: Document, aMimeType: string, aFlags: u32): void;
    setSelection(aSelection: Selection): void;
    setRange(aRange: Range): void;
    setNode(aNode: Node): void;
    setContainerNode(aContainer: Node): void;
    setCharset(aCharset: string): void;
    setWrapColumn(aWrapColumn: u32): void;
    readonly mimeType: string;
    encodeToStream(aStream: nsIOutputStream): void;
    encodeToString(): string;
    encodeToStringWithContext(
      aContextString: OutParam<string>,
      aInfoString: OutParam<string>
    ): string;
    encodeToStringWithMaxLength(aMaxLength: u32): string;
    setNodeFixup(aFixup: nsIDocumentEncoderNodeFixup): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/sidebar/nsIWebProtocolHandlerRegistrar.idl

  interface nsIWebProtocolHandlerRegistrar extends nsISupports {
    registerProtocolHandler(
      protocol: string,
      uri: nsIURI,
      title: string,
      documentURI: nsIURI,
      windowOrBrowser: nsISupports
    ): void;
    removeProtocolHandler(protocol: string, uri: string): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/simpledb/nsISDBCallbacks.idl

  type nsISDBCallback = Callable<{
    onComplete(aRequest: nsISDBRequest): void;
  }>;

  type nsISDBCloseCallback = Callable<{
    onClose(aConnection: nsISDBConnection): void;
  }>;

  // https://searchfox.org/mozilla-central/source/dom/simpledb/nsISDBConnection.idl

  interface nsISDBConnection extends nsISupports {
    init(aPrincipal: nsIPrincipal, aPersistenceType?: string): void;
    open(aName: string): nsISDBRequest;
    seek(offset: u64): nsISDBRequest;
    read(size: u64): nsISDBRequest;
    write(value: any): nsISDBRequest;
    close(): nsISDBRequest;
    closeCallback: nsISDBCloseCallback;
  }

  // https://searchfox.org/mozilla-central/source/dom/simpledb/nsISDBRequest.idl

  interface nsISDBRequest extends nsISupports {
    readonly result: nsIVariant;
    readonly resultCode: nsresult;
    readonly resultName: string;
    callback: nsISDBCallback;
  }

  // https://searchfox.org/mozilla-central/source/dom/simpledb/nsISDBResults.idl

  interface nsISDBResult extends nsISupports {
    getAsArray(): u8[];
    getAsArrayBuffer(): any;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/storage/nsIDOMStorageManager.idl

  interface nsIDOMStorageManager extends nsISupports {
    precacheStorage(aPrincipal: nsIPrincipal, aStoragePrincipal: nsIPrincipal): Storage;
    createStorage(
      aWindow: mozIDOMWindow,
      aPrincipal: nsIPrincipal,
      aStoragePrincipal: nsIPrincipal,
      aDocumentURI: string,
      aPrivate?: boolean
    ): Storage;
    getStorage(
      aWindow: mozIDOMWindow,
      aPrincipal: nsIPrincipal,
      aStoragePrincipal: nsIPrincipal,
      aPrivate?: boolean
    ): Storage;
    cloneStorage(aStorageToCloneFrom: Storage): void;
    checkStorage(aPrincipal: nsIPrincipal, aStorage: Storage): boolean;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/storage/nsIStorageActivityService.idl

  interface nsIStorageActivityService extends nsISupports {
    getActiveOrigins(from: PRTime, to: PRTime): nsIArray;
    moveOriginInTime(origin: nsIPrincipal, when: PRTime): void;
    testOnlyReset(): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/storage/nsISessionStorageService.idl

  interface nsISessionStorageService extends nsISupports {
    clearStoragesForOrigin(aPrincipal: nsIPrincipal): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/system/nsIOSPermissionRequest.idl

  interface nsIOSPermissionRequest extends nsISupports {
    readonly PERMISSION_STATE_NOTDETERMINED?: 0;
    readonly PERMISSION_STATE_RESTRICTED?: 1;
    readonly PERMISSION_STATE_DENIED?: 2;
    readonly PERMISSION_STATE_AUTHORIZED?: 3;

    getMediaCapturePermissionState(aVideo: OutParam<u16>, aAudio: OutParam<u16>): void;
    getAudioCapturePermissionState(aAudio: OutParam<u16>): void;
    getVideoCapturePermissionState(aVideo: OutParam<u16>): void;
    getScreenCapturePermissionState(aScreen: OutParam<u16>): void;
    requestVideoCapturePermission(): Promise<any>;
    requestAudioCapturePermission(): Promise<any>;
    maybeRequestScreenCapturePermission(): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/webauthn/nsIWebAuthnArgs.idl

  // https://searchfox.org/mozilla-central/source/dom/webauthn/nsIWebAuthnAttObj.idl

  // https://searchfox.org/mozilla-central/source/dom/webauthn/nsIWebAuthnPromise.idl

  // https://searchfox.org/mozilla-central/source/dom/webauthn/nsIWebAuthnResult.idl

  // https://searchfox.org/mozilla-central/source/dom/webauthn/nsIWebAuthnService.idl

  interface nsICredentialParameters extends nsISupports {
    readonly credentialId: string;
    readonly isResidentCredential: boolean;
    readonly rpId: string;
    readonly privateKey: string;
    readonly userHandle: string;
    readonly signCount: u32;
  }

  interface nsIWebAuthnAutoFillEntry extends nsISupports {
    readonly PROVIDER_UNKNOWN?: 0;
    readonly PROVIDER_TEST_TOKEN?: 1;
    readonly PROVIDER_PLATFORM_WINDOWS?: 2;
    readonly PROVIDER_PLATFORM_MACOS?: 3;
    readonly PROVIDER_PLATFORM_ANDROID?: 4;

    readonly provider: u8;
    readonly userName: string;
    readonly rpId: string;
    readonly credentialId: u8[];
  }

  interface nsIWebAuthnService extends nsISupports {
    readonly isUVPAA: boolean;
    cancel(aTransactionId: u64): void;
    hasPendingConditionalGet(aBrowsingContextId: u64, aOrigin: string): u64;
    getAutoFillEntries(aTransactionId: u64): nsIWebAuthnAutoFillEntry[];
    selectAutoFillEntry(aTransactionId: u64, aCredentialId: u8[]): void;
    resumeConditionalGet(aTransactionId: u64): void;
    pinCallback(aTransactionId: u64, aPin: string): void;
    setHasAttestationConsent(aTransactionId: u64, aHasConsent: boolean): void;
    selectionCallback(aTransactionId: u64, aIndex: u64): void;
    addVirtualAuthenticator(
      protocol: string,
      transport: string,
      hasResidentKey: boolean,
      hasUserVerification: boolean,
      isUserConsenting: boolean,
      isUserVerified: boolean
    ): u64;
    removeVirtualAuthenticator(authenticatorId: u64): void;
    addCredential(
      authenticatorId: u64,
      credentialId: string,
      isResidentCredential: boolean,
      rpId: string,
      privateKey: string,
      userHandle: string,
      signCount: u32
    ): void;
    getCredentials(authenticatorId: u64): nsICredentialParameters[];
    removeCredential(authenticatorId: u64, credentialId: string): void;
    removeAllCredentials(authenticatorId: u64): void;
    setUserVerified(authenticatorId: u64, isUserVerified: boolean): void;
    listen(): void;
    runCommand(aCommand: string): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/webspeech/recognition/nsISpeechRecognitionService.idl

  // https://searchfox.org/mozilla-central/source/dom/media/webspeech/synth/nsISpeechService.idl

  interface nsISpeechTaskCallback extends nsISupports {
    onPause(): void;
    onResume(): void;
    onCancel(): void;
    onVolumeChanged(aVolume: float): void;
  }

  interface nsISpeechTask extends nsISupports {
    setup(aCallback: nsISpeechTaskCallback): void;
    dispatchStart(): void;
    dispatchEnd(aElapsedTime: float, aCharIndex: u32): void;
    dispatchPause(aElapsedTime: float, aCharIndex: u32): void;
    dispatchResume(aElapsedTime: float, aCharIndex: u32): void;
    dispatchError(aElapsedTime: float, aCharIndex: u32): void;
    dispatchBoundary(aName: string, aElapsedTime: float, aCharIndex: u32, aCharLength?: u32): void;
    dispatchMark(aName: string, aElapsedTime: float, aCharIndex: u32): void;
  }

  interface nsISpeechService extends nsISupports {
    speak(
      aText: string,
      aUri: string,
      aVolume: float,
      aRate: float,
      aPitch: float,
      aTask: nsISpeechTask
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/webspeech/synth/nsISynthVoiceRegistry.idl

  interface nsISynthVoiceRegistry extends nsISupports {
    addVoice(
      aService: nsISpeechService,
      aUri: string,
      aName: string,
      aLang: string,
      aLocalService: boolean,
      aQueuesUtterances: boolean
    ): void;
    removeVoice(aService: nsISpeechService, aUri: string): void;
    notifyVoicesChanged(): void;
    notifyVoicesError(aError: string): void;
    setDefaultVoice(aUri: string, aIsDefault: boolean): void;
    readonly voiceCount: u32;
    getVoice(aIndex: u32): string;
    isDefaultVoice(aUri: string): boolean;
    isLocalVoice(aUri: string): boolean;
    getVoiceLang(aUri: string): string;
    getVoiceName(aUri: string): string;
  }

  // https://searchfox.org/mozilla-central/source/dom/workers/nsIWorkerChannelInfo.idl

  interface nsIWorkerChannelLoadInfo extends nsISupports {
    workerAssociatedBrowsingContextID: u64;
    readonly workerAssociatedBrowsingContext: BrowsingContext;
  }

  interface nsIWorkerChannelInfo extends nsISupports {
    loadInfo: nsIWorkerChannelLoadInfo;
    readonly channelId: u64;
  }

  // https://searchfox.org/mozilla-central/source/dom/workers/nsIWorkerDebugger.idl

  interface nsIWorkerDebuggerListener extends nsISupports {
    onClose(): void;
    onError(filename: string, lineno: u32, message: string): void;
    onMessage(message: string): void;
  }

  interface nsIWorkerDebugger extends nsISupports {
    readonly TYPE_DEDICATED?: 0;
    readonly TYPE_SHARED?: 1;
    readonly TYPE_SERVICE?: 2;

    readonly isClosed: boolean;
    readonly isChrome: boolean;
    readonly isInitialized: boolean;
    readonly parent: nsIWorkerDebugger;
    readonly type: u32;
    readonly url: string;
    readonly window: mozIDOMWindow;
    readonly windowIDs: u64[];
    readonly principal: nsIPrincipal;
    readonly serviceWorkerID: u32;
    readonly id: string;
    readonly name: string;
    initialize(url: string): void;
    postMessage(message: string): void;
    addListener(listener: nsIWorkerDebuggerListener): void;
    removeListener(listener: nsIWorkerDebuggerListener): void;
    setDebuggerReady(ready: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/workers/nsIWorkerDebuggerManager.idl

  interface nsIWorkerDebuggerManagerListener extends nsISupports {
    onRegister(aDebugger: nsIWorkerDebugger): void;
    onUnregister(aDebugger: nsIWorkerDebugger): void;
  }

  interface nsIWorkerDebuggerManager extends nsISupports {
    getWorkerDebuggerEnumerator(): nsISimpleEnumerator;
    addListener(listener: nsIWorkerDebuggerManagerListener): void;
    removeListener(listener: nsIWorkerDebuggerManagerListener): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/xslt/xslt/txIEXSLTFunctions.idl

  interface txIEXSLTFunctions extends nsISupports {
    match(str: string, regex: string, flags: string, doc: Document): DocumentFragment;
    replace(str: string, regex: string, flags: string, replace: string): string;
    test(str: string, regex: string, flags: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/xul/nsIDOMXULButtonElement.idl

  interface nsIDOMXULButtonElement extends nsIDOMXULControlElement {
    type: string;
    open: boolean;
    checked: boolean;
    group: string;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/xul/nsIDOMXULCommandDispatcher.idl

  interface nsIDOMXULCommandDispatcher extends nsISupports {
    focusedElement: Element;
    focusedWindow: mozIDOMWindowProxy;
    addCommandUpdater(updater: Element, events: string, targets: string): void;
    removeCommandUpdater(updater: Element): void;
    updateCommands(eventName: string): void;
    getControllerForCommand(command: string): nsIController;
    getControllers(): nsIControllers;
    advanceFocus(): void;
    rewindFocus(): void;
    advanceFocusIntoSubtree(elt: Element): void;
    lock(): void;
    unlock(): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/xul/nsIDOMXULContainerElement.idl

  interface nsIDOMXULContainerItemElement extends nsISupports {
    readonly parentContainer: Element;
  }

  interface nsIDOMXULContainerElement extends nsIDOMXULContainerItemElement {}

  // https://searchfox.org/mozilla-central/source/dom/interfaces/xul/nsIDOMXULControlElement.idl

  interface nsIDOMXULControlElement extends nsISupports {
    disabled: boolean;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/xul/nsIDOMXULMenuListElement.idl

  interface nsIDOMXULMenuListElement extends nsIDOMXULSelectControlElement {
    editable: boolean;
    open: boolean;
    readonly label: string;
    image: string;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/xul/nsIDOMXULMultSelectCntrlEl.idl

  interface nsIDOMXULMultiSelectControlElement extends nsIDOMXULSelectControlElement {
    selType: string;
    currentItem: Element;
    currentIndex: i32;
    readonly selectedItems: NodeList;
    addItemToSelection(item: nsIDOMXULSelectControlItemElement): void;
    removeItemFromSelection(item: nsIDOMXULSelectControlItemElement): void;
    toggleItemSelection(item: nsIDOMXULSelectControlItemElement): void;
    selectItem(item: nsIDOMXULSelectControlItemElement): void;
    selectItemRange(
      startItem: nsIDOMXULSelectControlItemElement,
      item: nsIDOMXULSelectControlItemElement
    ): void;
    selectAll(): void;
    clearSelection(): void;
    readonly selectedCount: i32;
    getSelectedItem(index: i32): Element;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/xul/nsIDOMXULRadioGroupElement.idl

  interface nsIDOMXULRadioGroupElement extends nsISupports {
    focusedItem: Element;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/xul/nsIDOMXULRelatedElement.idl

  interface nsIDOMXULRelatedElement extends nsISupports {
    getRelatedElement(aElement: Node): Element;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/xul/nsIDOMXULSelectCntrlEl.idl

  interface nsIDOMXULSelectControlElement extends nsIDOMXULControlElement {
    selectedItem: Element;
    selectedIndex: i32;
    value: string;
    readonly itemCount: u32;
    getIndexOfItem(item: nsIDOMXULSelectControlItemElement): i32;
    getItemAtIndex(index: i32): Element;
  }

  // https://searchfox.org/mozilla-central/source/dom/interfaces/xul/nsIDOMXULSelectCntrlItemEl.idl

  interface nsIDOMXULSelectControlItemElement extends nsISupports {
    disabled: boolean;
    image: string;
    label: string;
    accessKey: string;
    command: string;
    value: string;
    readonly selected: boolean;
    readonly control: Element;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/downloads/mozIDownloadPlatform.idl

  interface mozIDownloadPlatform extends nsISupports {
    readonly ZONE_MY_COMPUTER?: 0;
    readonly ZONE_INTRANET?: 1;
    readonly ZONE_TRUSTED?: 2;
    readonly ZONE_INTERNET?: 3;
    readonly ZONE_RESTRICTED?: 4;

    downloadDone(
      aSource: nsIURI,
      aReferrer: nsIURI,
      aTarget: nsIFile,
      aContentType: string,
      aIsPrivate: boolean
    ): Promise<any>;
    mapUrlToZone(aURL: string): u32;
  }

  // https://searchfox.org/mozilla-central/source/editor/nsIDocumentStateListener.idl

  interface nsIDocumentStateListener extends nsISupports {
    NotifyDocumentWillBeDestroyed(): void;
    NotifyDocumentStateChanged(aNowDirty: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/editor/nsIEditActionListener.idl

  interface nsIEditActionListener extends nsISupports {
    DidDeleteNode(aChild: Node, aResult: nsresult): void;
    DidInsertText(aTextNode: CharacterData, aOffset: i32, aString: string, aResult: nsresult): void;
    WillDeleteText(aTextNode: CharacterData, aOffset: i32, aLength: i32): void;
    WillDeleteRanges(aRangesToDelete: Range[]): void;
  }

  // https://searchfox.org/mozilla-central/source/editor/nsIEditor.idl

  interface nsIEditor extends nsISupports {
    readonly eNone?: 0;
    readonly eNext?: 1;
    readonly ePrevious?: 2;
    readonly eNextWord?: 3;
    readonly ePreviousWord?: 4;
    readonly eToBeginningOfLine?: 5;
    readonly eToEndOfLine?: 6;
    readonly eStrip?: 0;
    readonly eNoStrip?: 1;
    readonly eEditorPlaintextMask?: 1;
    readonly eEditorSingleLineMask?: 2;
    readonly eEditorPasswordMask?: 4;
    readonly eEditorReadonlyMask?: 8;
    readonly eEditorMailMask?: 32;
    readonly eEditorEnableWrapHackMask?: 64;
    readonly eEditorAllowInteraction?: 512;
    readonly eEditorRightToLeft?: 2048;
    readonly eEditorLeftToRight?: 4096;
    readonly eEditorSkipSpellCheck?: 8192;
    readonly eNewlinesPasteIntact?: 0;
    readonly eNewlinesPasteToFirst?: 1;
    readonly eNewlinesReplaceWithSpaces?: 2;
    readonly eNewlinesStrip?: 3;
    readonly eNewlinesReplaceWithCommas?: 4;
    readonly eNewlinesStripSurroundingWhitespace?: 5;

    readonly selection: Selection;
    setAttributeOrEquivalent(
      element: Element,
      sourceAttrName: string,
      sourceAttrValue: string,
      aSuppressTransaction: boolean
    ): void;
    removeAttributeOrEquivalent(
      element: Element,
      sourceAttrName: string,
      aSuppressTransaction: boolean
    ): void;
    flags: u32;
    contentsMIMEType: string;
    readonly isDocumentEditable: boolean;
    readonly isSelectionEditable: boolean;
    readonly document: Document;
    readonly rootElement: Element;
    readonly selectionController: nsISelectionController;
    deleteSelection(action: i16, stripWrappers: i16): void;
    readonly documentIsEmpty: boolean;
    readonly documentModified: boolean;
    documentCharacterSet: string;
    resetModificationCount(): void;
    getModificationCount(): i32;
    incrementModificationCount(aModCount: i32): void;
    enableUndo(enable: boolean): void;
    readonly undoRedoEnabled: boolean;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    clearUndoRedo(): void;
    undo(): void;
    undoAll(): void;
    redo(): void;
    beginTransaction(): void;
    endTransaction(): void;
    getInlineSpellChecker(autoCreate: boolean): nsIInlineSpellChecker;
    setSpellcheckUserOverride(enable: boolean): void;
    cut(): void;
    canCut(): boolean;
    copy(): void;
    canCopy(): boolean;
    paste(aClipboardType: nsIClipboard.ClipboardType): void;
    pasteTransferable(aTransferable: nsITransferable): void;
    canPaste(aClipboardType: nsIClipboard.ClipboardType): boolean;
    selectAll(): void;
    beginningOfDocument(): void;
    endOfDocument(): void;
    setAttribute(aElement: Element, attributestr: string, attvalue: string): void;
    removeAttribute(aElement: Element, aAttribute: string): void;
    cloneAttributes(aDestElement: Element, aSourceElement: Element): void;
    insertNode(node: Node, parent: Node, aPosition: u32, aPreserveSelection?: boolean): void;
    deleteNode(child: Node, aPreserveSelection?: boolean): void;
    outputToString(formatType: string, flags: u32): string;
    addEditActionListener(listener: nsIEditActionListener): void;
    removeEditActionListener(listener: nsIEditActionListener): void;
    addDocumentStateListener(listener: nsIDocumentStateListener): void;
    removeDocumentStateListener(listener: nsIDocumentStateListener): void;
    forceCompositionEnd(): void;
    readonly composing: boolean;
    unmask(aStart?: u32, aEnd?: i64, aTimeout?: u32): void;
    mask(): void;
    readonly unmaskedStart: u32;
    readonly unmaskedEnd: u32;
    readonly autoMaskingEnabled: boolean;
    readonly passwordMask: string;
    readonly textLength: u32;
    newlineHandling: i32;
    insertText(aStringToInsert: string): void;
    insertLineBreak(): void;
  }

  // https://searchfox.org/mozilla-central/source/editor/nsIEditorMailSupport.idl

  interface nsIEditorMailSupport extends nsISupports {
    insertAsCitedQuotation(aQuotedText: string, aCitation: string, aInsertHTML: boolean): Node;
    rewrap(aRespectNewlines: boolean): void;
    insertTextWithQuotations(aStringToInsert: string): void;
    wrapWidth: i32;
  }

  // https://searchfox.org/mozilla-central/source/editor/nsIEditorSpellCheck.idl

  interface nsIEditorSpellCheck extends nsISupports {
    readonly FILTERTYPE_NORMAL?: 1;
    readonly FILTERTYPE_MAIL?: 2;

    canSpellCheck(): boolean;
    InitSpellChecker(
      editor: nsIEditor,
      enableSelectionChecking: boolean,
      callback?: nsIEditorSpellCheckCallback
    ): void;
    GetNextMisspelledWord(): string;
    GetSuggestedWord(): string;
    CheckCurrentWord(suggestedWord: string): boolean;
    suggest(aCheckingWorkd: string, aMaxCount: u32): Promise<any>;
    ReplaceWord(misspelledWord: string, replaceWord: string, allOccurrences: boolean): void;
    IgnoreWordAllOccurrences(word: string): void;
    AddWordToDictionary(word: string): void;
    RemoveWordFromDictionary(word: string): void;
    GetDictionaryList(): string[];
    getCurrentDictionaries(): string[];
    setCurrentDictionaries(dictionaries: string[]): Promise<any>;
    UninitSpellChecker(): void;
    setFilterType(filterType: u32): void;
    UpdateCurrentDictionary(callback?: nsIEditorSpellCheckCallback): void;
  }

  type nsIEditorSpellCheckCallback = Callable<{
    editorSpellCheckDone(): void;
  }>;

  // https://searchfox.org/mozilla-central/source/editor/nsIHTMLAbsPosEditor.idl

  interface nsIHTMLAbsPosEditor extends nsISupports {
    absolutePositioningEnabled: boolean;
    readonly isAbsolutePositioningActive: boolean;
    snapToGridEnabled: boolean;
    gridSize: u32;
  }

  // https://searchfox.org/mozilla-central/source/editor/nsIHTMLEditor.idl

  interface nsIHTMLEditor extends nsISupports {
    readonly eLeft?: 0;
    readonly eCenter?: 1;
    readonly eRight?: 2;
    readonly eJustify?: 3;

    setInlineProperty(aProperty: string, aAttribute: string, aValue: string): void;
    getInlinePropertyWithAttrValue(
      aProperty: string,
      aAttribute: string,
      aValue: string,
      aFirst: OutParam<boolean>,
      aAny: OutParam<boolean>,
      aAll: OutParam<boolean>
    ): string;
    removeInlineProperty(aProperty: string, aAttribute: string): void;
    nodeIsBlock(aNode: Node): boolean;
    insertHTML(aInputString: string): void;
    rebuildDocumentFromSource(aSourceString: string): void;
    insertElementAtSelection(aElement: Element, aDeleteSelection: boolean): void;
    updateBaseURL(): void;
    selectElement(aElement: Element): void;
    getParagraphState(aMixed: OutParam<boolean>): string;
    getFontFaceState(aMixed: OutParam<boolean>): string;
    getHighlightColorState(aMixed: OutParam<boolean>): string;
    getListState(
      aMixed: OutParam<boolean>,
      aOL: OutParam<boolean>,
      aUL: OutParam<boolean>,
      aDL: OutParam<boolean>
    ): void;
    getListItemState(
      aMixed: OutParam<boolean>,
      aLI: OutParam<boolean>,
      aDT: OutParam<boolean>,
      aDD: OutParam<boolean>
    ): void;
    getAlignment(aMixed: OutParam<boolean>, aAlign: OutParam<i16>): void;
    makeOrChangeList(aListType: string, entireList: boolean, aBulletType: string): void;
    removeList(aListType: string): void;
    getElementOrParentByTagName(aTagName: string, aNode: Node): Element;
    getSelectedElement(aTagName: string): nsISupports;
    createElementWithDefaults(aTagName: string): Element;
    insertLinkAroundSelection(aAnchorElement: Element): void;
    setBackgroundColor(aColor: string): void;
    isCSSEnabled: boolean;
    checkSelectionStateForAnonymousButtons(): void;
    isAnonymousElement(aElement: Element): boolean;
    returnInParagraphCreatesNewParagraph: boolean;
  }

  // https://searchfox.org/mozilla-central/source/editor/nsIHTMLInlineTableEditor.idl

  interface nsIHTMLInlineTableEditor extends nsISupports {
    inlineTableEditingEnabled: boolean;
    readonly isInlineTableEditingActive: boolean;
  }

  // https://searchfox.org/mozilla-central/source/editor/nsIHTMLObjectResizer.idl

  interface nsIHTMLObjectResizer extends nsISupports {
    readonly eTopLeft?: 0;
    readonly eTop?: 1;
    readonly eTopRight?: 2;
    readonly eLeft?: 3;
    readonly eRight?: 4;
    readonly eBottomLeft?: 5;
    readonly eBottom?: 6;
    readonly eBottomRight?: 7;

    objectResizingEnabled: boolean;
    readonly isObjectResizingActive: boolean;
    hideResizers(): void;
  }

  // https://searchfox.org/mozilla-central/source/editor/nsITableEditor.idl

  interface nsITableEditor extends nsISupports {
    readonly eNoSearch?: 0;
    readonly ePreviousColumn?: 1;
    readonly ePreviousRow?: 2;

    insertTableCell(aNumberOfColumnsToInsert: i32, aInsertAfterSelectedCell: boolean): void;
    insertTableColumn(aNumberOfColumnsToInsert: i32, aInsertAfterSelectedCell: boolean): void;
    insertTableRow(aNumberOfRowsToInsert: i32, aInsertAfterSelectedCell: boolean): void;
    deleteTable(): void;
    deleteTableCellContents(): void;
    deleteTableCell(aNumberOfCellsToDelete: i32): void;
    deleteTableColumn(aNumberOfColumnsToDelete: i32): void;
    deleteTableRow(aNumberOfRowsToDelete: i32): void;
    selectTableCell(): void;
    selectTableRow(): void;
    selectTableColumn(): void;
    selectTable(): void;
    selectAllTableCells(): void;
    switchTableCellHeaderType(aSourceCell: Element): Element;
    joinTableCells(aMergeNonContiguousContents: boolean): void;
    splitTableCell(): void;
    normalizeTable(aTable: Element): void;
    getCellIndexes(
      aCellElement: Element,
      aRowIndex: OutParam<i32>,
      aColumnIndex: OutParam<i32>
    ): void;
    getTableSize(
      aTableOrElementInTable: Element,
      aRowCount: OutParam<i32>,
      aColCount: OutParam<i32>
    ): void;
    getCellAt(aTableElement: Element, aRowIndex: i32, aColumnIndex: i32): Element;
    getCellDataAt(
      aTableElement: Element,
      aRowIndex: i32,
      aColumnIndex: i32,
      aCellElement: OutParam<Element>,
      aStartRowIndex: OutParam<i32>,
      aStartColumnIndex: OutParam<i32>,
      aRowSpan: OutParam<i32>,
      aColSpan: OutParam<i32>,
      aEffectiveRowSpan: OutParam<i32>,
      aEffectiveColSpan: OutParam<i32>,
      aIsSelected: OutParam<boolean>
    ): void;
    getFirstRow(aTableElement: Element): Element;
    getSelectedOrParentTableElement(aTagName: OutParam<string>, aCount: OutParam<i32>): Element;
    getSelectedCellsType(aElement: Element): u32;
    getFirstSelectedCellInTable(aRowIndex: OutParam<i32>, aColIndex: OutParam<i32>): Element;
    getSelectedCells(): Element[];
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/enterprisepolicies/nsIEnterprisePolicies.idl

  interface nsIEnterprisePolicies extends nsISupports {
    readonly UNINITIALIZED?: -1;
    readonly INACTIVE?: 0;
    readonly ACTIVE?: 1;
    readonly FAILED?: 2;

    readonly status: i16;
    readonly isEnterprise: boolean;
    isAllowed(feature: string): boolean;
    getActivePolicies(): any;
    getSupportMenu(): any;
    getExtensionPolicy(extensionID: string): any;
    getExtensionSettings(extensionID: string): any;
    mayInstallAddon(addon: any): boolean;
    allowedInstallSource(uri: nsIURI): boolean;
    isExemptExecutableExtension(url: string, extension: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/amIAddonManagerStartup.idl

  interface amIAddonManagerStartup extends nsISupports {
    readStartupData(): any;
    registerChrome(manifestURI: nsIURI, entries: any): nsIJSRAIIHelper;
    encodeBlob(value: any): any;
    decodeBlob(value: any): any;
    enumerateJAR(uri: nsIURI, pattern: string): string[];
    enumerateJARSubtree(uri: nsIURI): string[];
    initializeURLPreloader(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/amIWebInstallPrompt.idl

  interface amIWebInstallPrompt extends nsISupports {
    confirm(aBrowser: Element, aUri: nsIURI, aInstalls: nsIVariant[]): void;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/exthandler/nsCExternalHandlerService.idl

  // https://searchfox.org/mozilla-central/source/uriloader/exthandler/nsIContentDispatchChooser.idl

  interface nsIContentDispatchChooser extends nsISupports {
    handleURI(
      aHandler: nsIHandlerInfo,
      aURI: nsIURI,
      aTriggeringPrincipal: nsIPrincipal,
      aBrowsingContext: BrowsingContext,
      aWasTriggeredExternally?: boolean
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/exthandler/nsIExternalHelperAppService.idl

  interface nsIExternalHelperAppService extends nsISupports {
    doContent(
      aMimeContentType: string,
      aChannel: nsIChannel,
      aContentContext: nsIInterfaceRequestor,
      aForceSave: boolean,
      aWindowContext?: nsIInterfaceRequestor
    ): nsIStreamListener;
    createListener(
      aMimeContentType: string,
      aChannel: nsIChannel,
      aContentContext: BrowsingContext,
      aForceSave: boolean,
      aWindowContext?: nsIInterfaceRequestor
    ): nsIStreamListener;
    applyDecodingForExtension(aExtension: string, aEncodingType: string): boolean;
    getPreferredDownloadsDirectory(): nsIFile;
  }

  interface nsPIExternalAppLauncher extends nsISupports {
    deleteTemporaryFileOnExit(aTemporaryFile: nsIFile): void;
    deleteTemporaryPrivateFileWhenPossible(aTemporaryFile: nsIFile): void;
  }

  interface nsIHelperAppLauncher extends nsICancelable {
    readonly MIMEInfo: nsIMIMEInfo;
    readonly source: nsIURI;
    readonly suggestedFileName: string;
    promptForSaveDestination(): void;
    setDownloadToLaunch(aHandleInternally: boolean, aFile: nsIFile): void;
    launchLocalFile(): void;
    saveDestinationAvailable(aFile: nsIFile, aDialogWasShown?: boolean): void;
    setWebProgressListener(aWebProgressListener: nsIWebProgressListener2): void;
    readonly targetFile: nsIFile;
    readonly targetFileIsExecutable: boolean;
    readonly timeDownloadStarted: PRTime;
    readonly contentLength: i64;
    readonly browsingContextId: u64;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/exthandler/nsIExternalProtocolService.idl

  interface nsIExternalProtocolService extends nsISupports {
    externalProtocolHandlerExists(aProtocolScheme: string): boolean;
    isExposedProtocol(aProtocolScheme: string): boolean;
    getProtocolHandlerInfo(aProtocolScheme: string): nsIHandlerInfo;
    getProtocolHandlerInfoFromOS(
      aProtocolScheme: string,
      aFound: OutParam<boolean>
    ): nsIHandlerInfo;
    setProtocolHandlerDefaults(aHandlerInfo: nsIHandlerInfo, aOSHandlerExists: boolean): void;
    loadURI(
      aURI: nsIURI,
      aTriggeringPrincipal?: nsIPrincipal,
      aRedirectPrincipal?: nsIPrincipal,
      aBrowsingContext?: BrowsingContext,
      aWasTriggeredExternally?: boolean,
      aHasValidUserGestureActivation?: boolean,
      aNewWindowTarget?: boolean
    ): void;
    getApplicationDescription(aScheme: string): string;
    isCurrentAppOSDefaultForProtocol(aScheme: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/exthandler/nsIHandlerService.idl

  interface nsIHandlerService extends nsISupports {
    asyncInit(): void;
    enumerate(): nsISimpleEnumerator;
    fillHandlerInfo(aHandlerInfo: nsIHandlerInfo, aOverrideType: string): void;
    store(aHandlerInfo: nsIHandlerInfo): void;
    exists(aHandlerInfo: nsIHandlerInfo): boolean;
    remove(aHandlerInfo: nsIHandlerInfo): void;
    getTypeFromExtension(aFileExtension: string): string;
    existsForProtocolOS(aProtocolScheme: string): boolean;
    existsForProtocol(aProtocolScheme: string): boolean;
    getApplicationDescription(aProtocolScheme: string): string;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/exthandler/nsIHelperAppLauncherDialog.idl

  interface nsIHelperAppLauncherDialog extends nsISupports {
    readonly REASON_CANTHANDLE?: 0;
    readonly REASON_SERVERREQUEST?: 1;
    readonly REASON_TYPESNIFFED?: 2;

    show(
      aLauncher: nsIHelperAppLauncher,
      aWindowContext: nsIInterfaceRequestor,
      aReason: u32
    ): void;
    promptForSaveToFileAsync(
      aLauncher: nsIHelperAppLauncher,
      aWindowContext: nsIInterfaceRequestor,
      aDefaultFileName: string,
      aSuggestedFileExtension: string,
      aForcePrompt: boolean
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/exthandler/nsISharingHandlerApp.idl

  interface nsISharingHandlerApp extends nsIHandlerApp {
    share(data: string, title?: string): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/typeaheadfind/nsITypeAheadFind.idl

  interface nsITypeAheadFind extends nsISupports {
    readonly FIND_INITIAL?: 0;
    readonly FIND_NEXT?: 1;
    readonly FIND_PREVIOUS?: 2;
    readonly FIND_FIRST?: 3;
    readonly FIND_LAST?: 4;
    readonly FIND_FOUND?: 0;
    readonly FIND_NOTFOUND?: 1;
    readonly FIND_WRAPPED?: 2;
    readonly FIND_PENDING?: 3;

    init(aDocShell: nsIDocShell): void;
    find(aSearchString: string, aLinksOnly: boolean, aMode: u32, aDontIterateFrames: boolean): u16;
    getFoundRange(): Range;
    setDocShell(aDocShell: nsIDocShell): void;
    setSelectionModeAndRepaint(toggle: i16): void;
    collapseSelection(): void;
    isRangeVisible(aRange: Range, aMustBeInViewPort: boolean): boolean;
    isRangeRendered(aRange: Range): boolean;
    readonly searchString: string;
    caseSensitive: boolean;
    matchDiacritics: boolean;
    entireWord: boolean;
    readonly foundLink: Element;
    readonly foundEditable: Element;
    readonly currentWindow: mozIDOMWindow;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/glean/xpcom/nsIFOG.idl

  interface nsIFOG extends nsISupports {
    initializeFOG(
      aDataPathOverride?: string,
      aAppIdOverride?: string,
      aDisableInternalPings?: boolean
    ): void;
    registerCustomPings(): void;
    setLogPings(aEnableLogPings: boolean): void;
    setTagPings(aDebugTag: string): void;
    sendPing(aPingName: string): void;
    setExperimentActive(aExperimentId: string, aBranch: string, aExtra?: any): void;
    setExperimentInactive(aExperimentId: string): void;
    testGetExperimentData(aExperimentId: string): any;
    applyServerKnobsConfig(aJsonConfig: string): void;
    testFlushAllChildren(): Promise<any>;
    testResetFOG(aDataPathOverride?: string, aAppIdOverride?: string): void;
    testTriggerMetrics(aProcessType: u32): Promise<any>;
    testRegisterRuntimeMetric(
      aType: string,
      aCategory: string,
      aName: string,
      aPings: string[],
      aLifetime: string,
      aDisabled: boolean,
      aExtraArgs?: string
    ): u32;
    testRegisterRuntimePing(
      aName: string,
      aIncludeClientId: boolean,
      aSendIfEmpty: boolean,
      aPreciseTimestamps: boolean,
      aIncludeInfoSections: boolean,
      aEnabled: boolean,
      aSchedulesPings: string[],
      aReasonCodes: string[],
      aFollowsCollectionEnabled: boolean
    ): u32;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/glean/xpcom/nsIGleanPing.idl

  type nsIGleanPingTestCallback = Callable<{
    call(aReason: string): void;
  }>;

  interface nsIGleanPing extends nsISupports {
    submit(aReason?: string): void;
    testBeforeNextSubmit(aCallback: nsIGleanPingTestCallback): void;
    setEnabled(aValue: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/gfx/src/nsIFontEnumerator.idl

  interface nsIFontEnumerator extends nsISupports {
    EnumerateAllFonts(): string[];
    EnumerateFonts(aLangGroup: string, aGeneric: string): string[];
    EnumerateAllFontsAsync(): any;
    EnumerateFontsAsync(aLangGroup: string, aGeneric: string): any;
    HaveFontFor(aLangGroup: string): boolean;
    getDefaultFont(aLangGroup: string, aGeneric: string): string;
    getStandardFamilyName(aName: string): string;
  }

  // https://searchfox.org/mozilla-central/source/gfx/thebes/nsIFontLoadCompleteCallback.idl

  // https://searchfox.org/mozilla-central/source/parser/html/nsIParserUtils.idl

  interface nsIParserUtils extends nsISupports {
    readonly SanitizerAllowComments?: 1;
    readonly SanitizerAllowStyle?: 2;
    readonly SanitizerCidEmbedsOnly?: 4;
    readonly SanitizerDropNonCSSPresentation?: 8;
    readonly SanitizerDropForms?: 16;
    readonly SanitizerDropMedia?: 32;
    readonly SanitizerLogRemovals?: 64;

    sanitize(src: string, flags: u32): string;
    removeConditionalCSS(src: string): string;
    convertToPlainText(src: string, flags: u32, wrapCol: u32): string;
    parseFragment(
      fragment: string,
      flags: u32,
      isXML: boolean,
      baseURI: nsIURI,
      element: Element
    ): DocumentFragment;
  }

  // https://searchfox.org/mozilla-central/source/parser/htmlparser/nsIExpatSink.idl

  interface nsIExpatSink extends nsISupports {
    HandleStartElement(
      aName: string,
      aAtts: string[],
      aAttsCount: u32,
      aLineNumber: u32,
      aColumnNumber: u32
    ): void;
    HandleEndElement(aName: string): void;
    HandleComment(aCommentText: string): void;
    HandleCDataSection(aData: string, aLength: u32): void;
    HandleDoctypeDecl(
      aSubset: string,
      aName: string,
      aSystemId: string,
      aPublicId: string,
      aCatalogData: nsISupports
    ): void;
    HandleCharacterData(aData: string, aLength: u32): void;
    HandleProcessingInstruction(aTarget: string, aData: string): void;
    HandleXMLDeclaration(aVersion: string, aEncoding: string, aStandalone: i32): void;
    ReportError(aErrorText: string, aSourceText: string, aError: nsIScriptError): boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/http-sfv/nsIStructuredFieldValues.idl

  interface nsISFVBareItem extends nsISupports {
    readonly BOOL?: 1;
    readonly STRING?: 2;
    readonly DECIMAL?: 3;
    readonly INTEGER?: 4;
    readonly TOKEN?: 5;
    readonly BYTE_SEQUENCE?: 6;

    readonly type: i32;
  }

  interface nsISFVInteger extends nsISFVBareItem {
    value: i64;
  }

  interface nsISFVString extends nsISFVBareItem {
    value: string;
  }

  interface nsISFVBool extends nsISFVBareItem {
    value: boolean;
  }

  interface nsISFVDecimal extends nsISFVBareItem {
    value: double;
  }

  interface nsISFVToken extends nsISFVBareItem {
    value: string;
  }

  interface nsISFVByteSeq extends nsISFVBareItem {
    value: string;
  }

  interface nsISFVParams extends nsISupports {
    get(key: string): nsISFVBareItem;
    set(key: string, item: nsISFVBareItem): void;
    delete(key: string): void;
    keys(): string[];
  }

  interface nsISFVParametrizable extends nsISupports {
    readonly params: nsISFVParams;
  }

  interface nsISFVItemOrInnerList extends nsISFVParametrizable {}

  interface nsISFVSerialize extends nsISupports {
    serialize(): string;
  }

  interface nsISFVItem extends nsISFVItemOrInnerList {
    readonly value: nsISFVBareItem;
    serialize(): string;
  }

  interface nsISFVInnerList extends nsISFVItemOrInnerList {
    items: nsISFVItem[];
  }

  interface nsISFVList extends nsISFVSerialize {
    members: nsISFVItemOrInnerList[];
    parseMore(header: string): void;
  }

  interface nsISFVDictionary extends nsISFVSerialize {
    get(key: string): nsISFVItemOrInnerList;
    set(key: string, member_value: nsISFVItemOrInnerList): void;
    delete(key: string): void;
    keys(): string[];
    parseMore(header: string): void;
  }

  interface nsISFVService extends nsISupports {
    parseDictionary(header: string): nsISFVDictionary;
    parseList(header: string): nsISFVList;
    parseItem(header: string): nsISFVItem;
    newInteger(value: i64): nsISFVInteger;
    newBool(value: boolean): nsISFVBool;
    newDecimal(value: double): nsISFVDecimal;
    newString(value: string): nsISFVString;
    newByteSequence(value: string): nsISFVByteSeq;
    newToken(value: string): nsISFVToken;
    newParameters(): nsISFVParams;
    newInnerList(items: nsISFVItem[], params: nsISFVParams): nsISFVInnerList;
    newItem(value: nsISFVBareItem, params: nsISFVParams): nsISFVItem;
    newList(members: nsISFVItemOrInnerList[]): nsISFVList;
    newDictionary(): nsISFVDictionary;
  }

  // https://searchfox.org/mozilla-central/source/image/imgICache.idl

  interface imgICache extends nsISupports {
    clearCache(chrome?: any): void;
    removeEntriesFromPrincipalInAllProcesses(aPrincipal: nsIPrincipal): void;
    removeEntriesFromSiteInAllProcesses(aBaseDomain: string, OriginAttributesPattern: any): void;
    findEntryProperties(uri: nsIURI, doc?: Document): nsIProperties;
    respectPrivacyNotifications(): void;
  }

  // https://searchfox.org/mozilla-central/source/image/imgIContainer.idl
} // global

declare enum imgIContainer_DecodeResult {
  DECODE_SURFACE_AVAILABLE = 0,
  DECODE_REQUESTED = 1,
  DECODE_REQUEST_FAILED = 2,
}

declare global {
  namespace imgIContainer {
    type DecodeResult = imgIContainer_DecodeResult;
  }

  interface imgIContainer extends nsISupports, Enums<typeof imgIContainer_DecodeResult> {
    readonly TYPE_RASTER?: 0;
    readonly TYPE_VECTOR?: 1;
    readonly TYPE_REQUEST?: 2;
    readonly FLAG_NONE?: 0;
    readonly FLAG_SYNC_DECODE?: 1;
    readonly FLAG_SYNC_DECODE_IF_FAST?: 2;
    readonly FLAG_ASYNC_NOTIFY?: 4;
    readonly FLAG_DECODE_NO_PREMULTIPLY_ALPHA?: 8;
    readonly FLAG_DECODE_NO_COLORSPACE_CONVERSION?: 16;
    readonly FLAG_CLAMP?: 32;
    readonly FLAG_HIGH_QUALITY_SCALING?: 64;
    readonly FLAG_BYPASS_SURFACE_CACHE?: 128;
    readonly FLAG_FORCE_PRESERVEASPECTRATIO_NONE?: 256;
    readonly FLAG_FORCE_UNIFORM_SCALING?: 512;
    readonly FLAG_AVOID_REDECODE_FOR_SIZE?: 1024;
    readonly FLAG_DECODE_TO_SRGB_COLORSPACE?: 2048;
    readonly FLAG_RECORD_BLOB?: 4096;
    readonly DECODE_FLAGS_DEFAULT?: 0;
    readonly DECODE_FLAGS_FOR_REENCODE?: 2056;
    readonly FRAME_FIRST?: 0;
    readonly FRAME_CURRENT?: 1;
    readonly FRAME_MAX_VALUE?: 1;
    readonly kNormalAnimMode?: 0;
    readonly kDontAnimMode?: 1;
    readonly kLoopOnceAnimMode?: 2;

    readonly width: i32;
    readonly height: i32;
    readonly hotspotX: i32;
    readonly hotspotY: i32;
    readonly type: u16;
    readonly animated: boolean;
    readonly providerId: u32;
    lockImage(): void;
    unlockImage(): void;
    requestDiscard(): void;
    animationMode: u16;
    resetAnimation(): void;
  }

  // https://searchfox.org/mozilla-central/source/image/imgIContainerDebug.idl

  interface imgIContainerDebug extends nsISupports {
    readonly framesNotified: u32;
  }

  // https://searchfox.org/mozilla-central/source/image/imgIEncoder.idl

  interface imgIEncoder extends nsIAsyncInputStream {
    readonly INPUT_FORMAT_RGB?: 0;
    readonly INPUT_FORMAT_RGBA?: 1;
    readonly INPUT_FORMAT_HOSTARGB?: 2;

    initFromData(
      data: u8[],
      length: u32,
      width: u32,
      height: u32,
      stride: u32,
      inputFormat: u32,
      outputOptions: string
    ): void;
    startImageEncode(width: u32, height: u32, inputFormat: u32, outputOptions: string): void;
    addImageFrame(
      data: u8[],
      length: u32,
      width: u32,
      height: u32,
      stride: u32,
      frameFormat: u32,
      frameOptions: string
    ): void;
    endImageEncode(): void;
  }

  // https://searchfox.org/mozilla-central/source/image/imgILoader.idl

  interface imgILoader extends nsISupports {
    readonly LOAD_CORS_ANONYMOUS?: 65536;
    readonly LOAD_CORS_USE_CREDENTIALS?: 131072;

    loadImageXPCOM(
      aURI: nsIURI,
      aInitialDocumentURL: nsIURI,
      aReferrerInfo: nsIReferrerInfo,
      aLoadingPrincipal: nsIPrincipal,
      aLoadGroup: nsILoadGroup,
      aObserver: imgINotificationObserver,
      aLoadingDocument: Document,
      aLoadFlags: nsLoadFlags,
      cacheKey: nsISupports,
      aContentPolicyType?: nsContentPolicyType
    ): imgIRequest;
    loadImageWithChannelXPCOM(
      aChannel: nsIChannel,
      aObserver: imgINotificationObserver,
      aLoadingDocument: Document,
      aListener: OutParam<nsIStreamListener>
    ): imgIRequest;
  }

  // https://searchfox.org/mozilla-central/source/image/imgINotificationObserver.idl

  interface imgINotificationObserver extends nsISupports {
    readonly SIZE_AVAILABLE?: 1;
    readonly FRAME_UPDATE?: 2;
    readonly FRAME_COMPLETE?: 3;
    readonly LOAD_COMPLETE?: 4;
    readonly DECODE_COMPLETE?: 5;
    readonly DISCARD?: 6;
    readonly UNLOCKED_DRAW?: 7;
    readonly IS_ANIMATED?: 8;
    readonly HAS_TRANSPARENCY?: 9;
  }

  // https://searchfox.org/mozilla-central/source/image/imgIRequest.idl

  interface imgIRequest extends nsIRequest {
    readonly STATUS_NONE?: 0;
    readonly STATUS_SIZE_AVAILABLE?: 1;
    readonly STATUS_LOAD_COMPLETE?: 2;
    readonly STATUS_ERROR?: 4;
    readonly STATUS_FRAME_COMPLETE?: 8;
    readonly STATUS_DECODE_COMPLETE?: 16;
    readonly STATUS_IS_ANIMATED?: 32;
    readonly STATUS_HAS_TRANSPARENCY?: 64;
    readonly CATEGORY_FRAME_INIT?: 1;
    readonly CATEGORY_FRAME_STYLE?: 2;
    readonly CATEGORY_SIZE_QUERY?: 4;
    readonly CATEGORY_DISPLAY?: 8;

    readonly image: imgIContainer;
    readonly providerId: u32;
    readonly triggeringPrincipal: nsIPrincipal;
    readonly imageStatus: u32;
    readonly URI: nsIURI;
    readonly finalURI: nsIURI;
    readonly notificationObserver: imgINotificationObserver;
    readonly mimeType: string;
    readonly fileName: string;
    clone(aObserver: imgINotificationObserver): imgIRequest;
    readonly imagePrincipal: nsIPrincipal;
    readonly hadCrossOriginRedirects: boolean;
    readonly multipart: boolean;
    readonly CORSMode: i32;
    readonly referrerInfo: nsIReferrerInfo;
    cancelAndForgetObserver(aStatus: nsresult): void;
    startDecoding(aFlags: u32): void;
    lockImage(): void;
    unlockImage(): void;
    requestDiscard(): void;
    getStaticRequest(): imgIRequest;
    incrementAnimationConsumers(): void;
    decrementAnimationConsumers(): void;
    boostPriority(aCategory: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/image/imgIScriptedNotificationObserver.idl

  interface imgIScriptedNotificationObserver extends nsISupports {
    sizeAvailable(aRequest: imgIRequest): void;
    frameUpdate(aRequest: imgIRequest): void;
    frameComplete(aRequest: imgIRequest): void;
    loadComplete(aRequest: imgIRequest): void;
    decodeComplete(aRequest: imgIRequest): void;
    discard(aRequest: imgIRequest): void;
    isAnimated(aRequest: imgIRequest): void;
    hasTransparency(aRequest: imgIRequest): void;
  }

  // https://searchfox.org/mozilla-central/source/image/imgITools.idl

  interface imgITools extends nsISupports {
    decodeImageFromBuffer(aBuffer: string, aSize: u32, aMimeType: string): imgIContainer;
    decodeImageFromArrayBuffer(aArrayBuffer: any, aMimeType: string): imgIContainer;
    decodeImageFromChannelAsync(
      aURI: nsIURI,
      aChannel: nsIChannel,
      aCallback: imgIContainerCallback,
      aObserver: imgINotificationObserver
    ): void;
    decodeImageAsync(
      aStream: nsIInputStream,
      aMimeType: string,
      aCallback: imgIContainerCallback,
      aEventTarget: nsIEventTarget
    ): void;
    encodeImage(
      aContainer: imgIContainer,
      aMimeType: string,
      outputOptions?: string
    ): nsIInputStream;
    encodeScaledImage(
      aContainer: imgIContainer,
      aMimeType: string,
      aWidth: i32,
      aHeight: i32,
      outputOptions?: string
    ): nsIInputStream;
    getImgLoaderForDocument(doc: Document): imgILoader;
    getImgCacheForDocument(doc: Document): imgICache;
    encodeCroppedImage(
      aContainer: imgIContainer,
      aMimeType: string,
      aOffsetX: i32,
      aOffsetY: i32,
      aWidth: i32,
      aHeight: i32,
      outputOptions?: string
    ): nsIInputStream;
    createScriptedObserver(aObserver: imgIScriptedNotificationObserver): imgINotificationObserver;
  }

  type imgIContainerCallback = Callable<{
    onImageReady(aImage: imgIContainer, aStatus: nsresult): void;
  }>;

  // https://searchfox.org/mozilla-central/source/image/nsIIconURI.idl

  interface nsIMozIconURI extends nsIURI {
    readonly iconURL: nsIURL;
    readonly imageSize: u32;
    readonly stockIcon: string;
    readonly iconSize: string;
    readonly iconState: string;
    readonly contentType: string;
    readonly fileExtension: string;
  }

  // https://searchfox.org/mozilla-central/source/layout/inspector/inIDeepTreeWalker.idl

  interface inIDeepTreeWalker extends nsISupports {
    showAnonymousContent: boolean;
    showSubDocuments: boolean;
    showDocumentsAsNodes: boolean;
    init(aRoot: Node): void;
    readonly root: Node;
    currentNode: Node;
    parentNode(): Node;
    firstChild(): Node;
    lastChild(): Node;
    previousSibling(): Node;
    nextSibling(): Node;
    previousNode(): Node;
    nextNode(): Node;
  }

  // https://searchfox.org/mozilla-central/source/intl/strres/nsIStringBundle.idl

  interface nsIStringBundle extends nsISupports {
    GetStringFromID(aID: i32): string;
    GetStringFromName(aName: string): string;
    formatStringFromID(aID: i32, params: string[]): string;
    formatStringFromName(aName: string, params: string[]): string;
    getSimpleEnumeration(): nsISimpleEnumerator;
    asyncPreload(): void;
  }

  interface nsIStringBundleService extends nsISupports {
    createBundle(aURLSpec: string): nsIStringBundle;
    formatStatusMessage(aStatus: nsresult, aStatusArg: string): string;
    flushBundles(): void;
  }

  // https://searchfox.org/mozilla-central/source/modules/libjar/nsIJARChannel.idl

  interface nsIJARChannel extends nsIChannel {
    jarFile: nsIFile;
    readonly zipEntry: nsIZipEntry;
    ensureCached(): boolean;
  }

  // https://searchfox.org/mozilla-central/source/modules/libjar/nsIJARURI.idl

  interface nsIJARURI extends nsIURL {
    readonly JARFile: nsIURI;
    readonly JAREntry: string;
  }

  // https://searchfox.org/mozilla-central/source/modules/libjar/nsIZipReader.idl

  interface nsIZipEntry extends nsISupports {
    readonly compression: u16;
    readonly size: u32;
    readonly realSize: u32;
    readonly CRC32: u32;
    readonly isDirectory: boolean;
    readonly lastModifiedTime: PRTime;
    readonly isSynthetic: boolean;
    readonly permissions: u32;
  }

  interface nsIZipReader extends nsISupports {
    open(zipFile: nsIFile): void;
    openInner(zipReader: nsIZipReader, zipEntry: string): void;
    readonly file: nsIFile;
    close(): void;
    test(aEntryName: string): void;
    extract(zipEntry: string, outFile: nsIFile): void;
    getEntry(zipEntry: string): nsIZipEntry;
    hasEntry(zipEntry: string): boolean;
    findEntries(aPattern: string): nsIUTF8StringEnumerator;
    getInputStream(zipEntry: string): nsIInputStream;
  }

  interface nsIZipReaderCache extends nsISupports {
    init(cacheSize: u32): void;
    getZip(zipFile: nsIFile): nsIZipReader;
    getZipIfCached(zipFile: nsIFile): nsIZipReader;
    isCached(zipFile: nsIFile): boolean;
    getInnerZip(zipFile: nsIFile, zipEntry: string): nsIZipReader;
  }

  // https://searchfox.org/mozilla-central/source/devtools/platform/IJSDebugger.idl

  interface IJSDebugger extends nsISupports {
    addClass(global: any): void;
  }

  // https://searchfox.org/mozilla-central/source/devtools/platform/nsIJSInspector.idl

  interface nsIJSInspector extends nsISupports {
    enterNestedEventLoop(requestor: any): u32;
    exitNestedEventLoop(): u32;
    readonly eventLoopNestLevel: u32;
    readonly lastNestRequestor: any;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/kvstore/nsIKeyValue.idl
} // global

declare enum nsIKeyValueService_RecoveryStrategy {
  ERROR = 0,
  DISCARD = 1,
  RENAME = 2,
}

declare global {
  namespace nsIKeyValueService {
    type RecoveryStrategy = nsIKeyValueService_RecoveryStrategy;
  }

  interface nsIKeyValueService
    extends nsISupports,
      Enums<typeof nsIKeyValueService_RecoveryStrategy> {
    getOrCreate(callback: nsIKeyValueDatabaseCallback, path: string, name: string): void;
    getOrCreateWithOptions(
      callback: nsIKeyValueDatabaseCallback,
      path: string,
      name: string,
      recoveryStrategy?: nsIKeyValueService.RecoveryStrategy
    ): void;
    createImporter(type: string, path: string): nsIKeyValueImporter;
  }

  interface nsIKeyValueImportSourceSpec extends nsISupports {
    readonly path: string;
    addDatabase(name: string): nsIKeyValueDatabaseImportOptions;
    addAllDatabases(): nsIKeyValueDatabaseImportOptions;
  }
} // global

declare enum nsIKeyValueImporter_ConflictPolicy {
  ERROR_ON_CONFLICT = 0,
  IGNORE_ON_CONFLICT = 1,
  REPLACE_ON_CONFLICT = 2,
}

declare enum nsIKeyValueImporter_CleanupPolicy {
  KEEP_AFTER_IMPORT = 0,
  DELETE_AFTER_IMPORT = 1,
}

declare global {
  namespace nsIKeyValueImporter {
    type ConflictPolicy = nsIKeyValueImporter_ConflictPolicy;
    type CleanupPolicy = nsIKeyValueImporter_CleanupPolicy;
  }

  interface nsIKeyValueImporter
    extends nsIKeyValueImportSourceSpec,
      Enums<typeof nsIKeyValueImporter_ConflictPolicy & typeof nsIKeyValueImporter_CleanupPolicy> {
    readonly type: string;
    addPath(path: string): nsIKeyValueImportSourceSpec;
    import(callback: nsIKeyValueVoidCallback): void;
  }

  interface nsIKeyValueDatabaseImportOptions extends nsISupports {
    setConflictPolicy(
      conflictPolicy: nsIKeyValueImporter.ConflictPolicy
    ): nsIKeyValueDatabaseImportOptions;
    setCleanupPolicy(
      cleanupPolicy: nsIKeyValueImporter.CleanupPolicy
    ): nsIKeyValueDatabaseImportOptions;
  }

  interface nsIKeyValueDatabase extends nsISupports {
    isEmpty(callback: nsIKeyValueVariantCallback): void;
    count(callback: nsIKeyValueVariantCallback): void;
    size(callback: nsIKeyValueVariantCallback): void;
    put(callback: nsIKeyValueVoidCallback, key: string, value: nsIVariant): void;
    writeMany(callback: nsIKeyValueVoidCallback, pairs: nsIKeyValuePair[]): void;
    get(callback: nsIKeyValueVariantCallback, key: string, defaultValue?: nsIVariant): void;
    has(callback: nsIKeyValueVariantCallback, key: string): void;
    delete(callback: nsIKeyValueVoidCallback, key: string): void;
    deleteRange(callback: nsIKeyValueVoidCallback, fromKey?: string, toKey?: string): void;
    clear(callback: nsIKeyValueVoidCallback): void;
    enumerate(callback: nsIKeyValueEnumeratorCallback, fromKey?: string, toKey?: string): void;
    close(callback: nsIKeyValueVoidCallback): void;
  }

  interface nsIKeyValuePair extends nsISupports {
    readonly key: string;
    readonly value: nsIVariant;
  }

  interface nsIKeyValueEnumerator extends nsISupports {
    hasMoreElements(): boolean;
    getNext(): nsIKeyValuePair;
  }

  interface nsIKeyValueDatabaseCallback extends nsISupports {
    resolve(database: nsIKeyValueDatabase): void;
    reject(message: string): void;
  }

  interface nsIKeyValueEnumeratorCallback extends nsISupports {
    resolve(enumerator: nsIKeyValueEnumerator): void;
    reject(message: string): void;
  }

  interface nsIKeyValuePairCallback extends nsISupports {
    resolve(pair: nsIKeyValuePair): void;
    reject(message: string): void;
  }

  interface nsIKeyValueVariantCallback extends nsISupports {
    resolve(result: nsIVariant): void;
    reject(message: string): void;
  }

  interface nsIKeyValueVoidCallback extends nsISupports {
    resolve(): void;
    reject(message: string): void;
  }

  // https://searchfox.org/mozilla-central/source/layout/base/nsILayoutHistoryState.idl

  interface nsILayoutHistoryState extends nsISupports {
    readonly hasStates: boolean;
    getKeys(): string[];
    getPresState(
      aKey: string,
      aScrollX: OutParam<float>,
      aScrollY: OutParam<float>,
      aAllowScrollOriginDowngrade: OutParam<boolean>,
      aRes: OutParam<float>
    ): void;
    addNewPresState(
      aKey: string,
      aScrollX: float,
      aScrollY: float,
      aAllowScrollOriginDowngrade: boolean,
      aRes: float
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/layout/base/nsIPreloadedStyleSheet.idl

  interface nsIPreloadedStyleSheet extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/layout/base/nsISVGPaintContext.idl

  interface nsISVGPaintContext extends nsISupports {
    readonly fillColor: string;
    readonly strokeColor: string;
    readonly fillOpacity: float;
    readonly strokeOpacity: float;
  }

  // https://searchfox.org/mozilla-central/source/layout/base/nsIStyleSheetService.idl

  interface nsIStyleSheetService extends nsISupports {
    readonly AGENT_SHEET?: 0;
    readonly USER_SHEET?: 1;
    readonly AUTHOR_SHEET?: 2;

    loadAndRegisterSheet(sheetURI: nsIURI, type: u32): void;
    sheetRegistered(sheetURI: nsIURI, type: u32): boolean;
    preloadSheet(sheetURI: nsIURI, type: u32): nsIPreloadedStyleSheet;
    preloadSheetAsync(sheetURI: nsIURI, type: u32): any;
    unregisterSheet(sheetURI: nsIURI, type: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/layout/xul/tree/nsITreeSelection.idl

  interface nsITreeSelection extends nsISupports {
    tree: XULTreeElement;
    readonly single: boolean;
    readonly count: i32;
    isSelected(index: i32): boolean;
    select(index: i32): void;
    timedSelect(index: i32, delay: i32): void;
    toggleSelect(index: i32): void;
    rangedSelect(startIndex: i32, endIndex: i32, augment: boolean): void;
    clearRange(startIndex: i32, endIndex: i32): void;
    clearSelection(): void;
    selectAll(): void;
    getRangeCount(): i32;
    getRangeAt(i: i32, min: OutParam<i32>, max: OutParam<i32>): void;
    invalidateSelection(): void;
    adjustSelection(index: i32, count: i32): void;
    selectEventsSuppressed: boolean;
    currentIndex: i32;
    readonly shiftSelectPivot: i32;
  }

  // https://searchfox.org/mozilla-central/source/layout/xul/tree/nsITreeView.idl

  interface nsITreeView extends nsISupports {
    readonly DROP_BEFORE?: -1;
    readonly DROP_ON?: 0;
    readonly DROP_AFTER?: 1;

    readonly rowCount: i32;
    selection: nsITreeSelection;
    getRowProperties(index: i32): string;
    getCellProperties(row: i32, col: TreeColumn): string;
    getColumnProperties(col: TreeColumn): string;
    isContainer(index: i32): boolean;
    isContainerOpen(index: i32): boolean;
    isContainerEmpty(index: i32): boolean;
    isSeparator(index: i32): boolean;
    isSorted(): boolean;
    canDrop(index: i32, orientation: i32, dataTransfer: DataTransfer): boolean;
    drop(row: i32, orientation: i32, dataTransfer: DataTransfer): void;
    getParentIndex(rowIndex: i32): i32;
    hasNextSibling(rowIndex: i32, afterIndex: i32): boolean;
    getLevel(index: i32): i32;
    getImageSrc(row: i32, col: TreeColumn): string;
    getCellValue(row: i32, col: TreeColumn): string;
    getCellText(row: i32, col: TreeColumn): string;
    setTree(tree: XULTreeElement): void;
    toggleOpenState(index: i32): void;
    cycleHeader(col: TreeColumn): void;
    selectionChanged(): void;
    cycleCell(row: i32, col: TreeColumn): void;
    isEditable(row: i32, col: TreeColumn): boolean;
    setCellValue(row: i32, col: TreeColumn, value: string): void;
    setCellText(row: i32, col: TreeColumn, value: string): void;
  }

  // https://searchfox.org/mozilla-central/source/intl/locale/mozILocaleService.idl

  interface mozILocaleService extends nsISupports {
    readonly langNegStrategyFiltering?: 0;
    readonly langNegStrategyMatching?: 1;
    readonly langNegStrategyLookup?: 2;

    readonly defaultLocale: string;
    readonly lastFallbackLocale: string;
    readonly appLocalesAsLangTags: string[];
    readonly appLocalesAsBCP47: string[];
    readonly regionalPrefsLocales: string[];
    readonly webExposedLocales: string[];
    negotiateLanguages(
      aRequested: string[],
      aAvailable: string[],
      aDefaultLocale?: string,
      langNegStrategy?: i32
    ): string[];
    readonly appLocaleAsLangTag: string;
    readonly appLocaleAsBCP47: string;
    requestedLocales: string[];
    readonly requestedLocale: string;
    availableLocales: string[];
    readonly isAppLocaleRTL: boolean;
    readonly packagedLocales: string[];
  }

  // https://searchfox.org/mozilla-central/source/intl/locale/mozIOSPreferences.idl

  interface mozIOSPreferences extends nsISupports {
    readonly dateTimeFormatStyleNone?: 0;
    readonly dateTimeFormatStyleShort?: 1;
    readonly dateTimeFormatStyleMedium?: 2;
    readonly dateTimeFormatStyleLong?: 3;
    readonly dateTimeFormatStyleFull?: 4;

    readonly systemLocales: string[];
    readonly regionalPrefsLocales: string[];
    readonly systemLocale: string;
    getDateTimePattern(timeFormatStyle: i32, dateFormatStyle: i32, locale?: string): string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/passwordmgr/nsILoginInfo.idl

  interface nsILoginInfo extends nsISupports {
    readonly displayOrigin: string;
    origin: string;
    hostname: string;
    formActionOrigin: string;
    formSubmitURL: string;
    httpRealm: string;
    username: string;
    usernameField: string;
    password: string;
    passwordField: string;
    unknownFields: string;
    everSynced: boolean;
    syncCounter: i32;
    init(
      aOrigin: string,
      aFormActionOrigin: string,
      aHttpRealm: string,
      aUsername: string,
      aPassword: string,
      aUsernameField?: string,
      aPasswordField?: string
    ): void;
    equals(aLoginInfo: nsILoginInfo): boolean;
    matches(aLoginInfo: nsILoginInfo, ignorePassword: boolean): boolean;
    clone(): nsILoginInfo;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/passwordmgr/nsILoginManager.idl

  interface nsILoginSearchCallback extends nsISupports {
    onSearchComplete(aLogins: nsILoginInfo[]): void;
  }

  interface nsILoginManager extends nsISupports {
    readonly initializationPromise: Promise<any>;
    addLogin(aLogin: nsILoginInfo): nsILoginInfo;
    addLoginAsync(aLogin: nsILoginInfo): Promise<any>;
    addLogins(aLogins: any): Promise<any>;
    removeLogin(aLogin: nsILoginInfo): void;
    modifyLogin(oldLogin: nsILoginInfo, newLoginData: nsISupports): void;
    recordPasswordUse(
      aLogin: nsILoginInfo,
      aPrivateContextWithoutExplicitConsent: boolean,
      aLoginType: string,
      aFilled: boolean
    ): void;
    removeAllUserFacingLogins(): void;
    removeAllLogins(): void;
    getAllLogins(): Promise<any>;
    getAllLoginsWithCallback(aCallback: nsILoginSearchCallback): void;
    getAllDisabledHosts(): string[];
    getLoginSavingEnabled(aHost: string): boolean;
    setLoginSavingEnabled(aHost: string, isEnabled: boolean): void;
    findLogins(aOrigin: string, aActionOrigin: string, aHttpRealm: string): nsILoginInfo[];
    countLogins(aOrigin: string, aActionOrigin: string, aHttpRealm: string): u32;
    searchLoginsAsync(matchData: any): Promise<any>;
    searchLogins(matchData: nsIPropertyBag): nsILoginInfo[];
    getSyncID(): Promise<any>;
    setSyncID(syncID: string): Promise<any>;
    getLastSync(): Promise<any>;
    setLastSync(timestamp: double): Promise<any>;
    ensureCurrentSyncID(newSyncID: string): Promise<any>;
    readonly uiBusy: boolean;
    readonly isLoggedIn: boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/passwordmgr/nsILoginManagerAuthPrompter.idl

  interface nsILoginManagerAuthPrompter extends nsISupports {
    init(aWindow: nsIDOMWindow): void;
    browser: Element;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/passwordmgr/nsILoginManagerCrypto.idl

  interface nsILoginManagerCrypto extends nsISupports {
    readonly ENCTYPE_BASE64?: 0;
    readonly ENCTYPE_SDR?: 1;

    encrypt(plainText: string): string;
    encryptMany(plainTexts: any): Promise<any>;
    decrypt(cipherText: string): string;
    decryptMany(cipherTexts: any): Promise<any>;
    readonly uiBusy: boolean;
    readonly isLoggedIn: boolean;
    readonly defaultEncType: u32;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/passwordmgr/nsILoginManagerPrompter.idl

  interface nsILoginManagerPrompter extends nsISupports {
    promptToSavePassword(
      aBrowser: Element,
      aLogin: nsILoginInfo,
      dismissed?: boolean,
      notifySaved?: boolean,
      autoFilledLoginGuid?: string,
      possibleValues?: any
    ): nsIPromptInstance;
    promptToChangePassword(
      aBrowser: Element,
      aOldLogin: nsILoginInfo,
      aNewLogin: nsILoginInfo,
      dismissed?: boolean,
      notifySaved?: boolean,
      autoSavedLoginGuid?: string,
      autoFilledLoginGuid?: string,
      possibleValues?: any
    ): nsIPromptInstance;
    promptToChangePasswordWithUsernames(
      aBrowser: Element,
      logins: nsILoginInfo[],
      aNewLogin: nsILoginInfo
    ): nsIPromptInstance;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/passwordmgr/nsILoginMetaInfo.idl

  interface nsILoginMetaInfo extends nsISupports {
    guid: string;
    timeCreated: u64;
    timeLastUsed: u64;
    timePasswordChanged: u64;
    timesUsed: u32;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/passwordmgr/nsIPromptInstance.idl

  interface nsIPromptInstance extends nsISupports {
    dismiss(): void;
  }

  // https://searchfox.org/mozilla-central/source/browser/components/migration/nsIEdgeMigrationUtils.idl

  interface nsIEdgeMigrationUtils extends nsISupports {
    isDbLocked(aFile: nsIFile): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/mime/nsIMIMEHeaderParam.idl

  interface nsIMIMEHeaderParam extends nsISupports {
    getParameter(
      aHeaderVal: string,
      aParamName: string,
      aFallbackCharset: string,
      aTryLocaleCharset: boolean,
      aLang: OutParam<string>
    ): string;
    getParameterHTTP(
      aHeaderVal: string,
      aParamName: string,
      aFallbackCharset: string,
      aTryLocaleCharset: boolean,
      aLang: OutParam<string>
    ): string;
    decodeRFC5987Param(aParamVal: string, aLang: OutParam<string>): string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/mime/nsIMIMEInfo.idl

  interface nsIHandlerInfo extends nsISupports {
    readonly saveToDisk?: 0;
    readonly alwaysAsk?: 1;
    readonly useHelperApp?: 2;
    readonly handleInternally?: 3;
    readonly useSystemDefault?: 4;

    readonly type: string;
    description: string;
    preferredApplicationHandler: nsIHandlerApp;
    readonly possibleApplicationHandlers: nsIMutableArray;
    readonly hasDefaultHandler: boolean;
    readonly defaultDescription: string;
    readonly defaultExecutable: nsIFile;
    launchWithURI(aURI: nsIURI, aBrowsingContext?: BrowsingContext): void;
    preferredAction: nsHandlerInfoAction;
    alwaysAskBeforeHandling: boolean;
  }

  interface nsIMIMEInfo extends nsIHandlerInfo {
    getFileExtensions(): nsIUTF8StringEnumerator;
    setFileExtensions(aExtensions: string): void;
    extensionExists(aExtension: string): boolean;
    appendExtension(aExtension: string): void;
    primaryExtension: string;
    readonly MIMEType: string;
    equals(aMIMEInfo: nsIMIMEInfo): boolean;
    readonly possibleLocalHandlers: nsIArray;
    launchWithFile(aFile: nsIFile): void;
    isCurrentAppOSDefault(): boolean;
  }

  interface nsIHandlerApp extends nsISupports {
    name: string;
    detailedDescription: string;
    equals(aHandlerApp: nsIHandlerApp): boolean;
    launchWithURI(aURI: nsIURI, aBrowsingContext?: BrowsingContext): void;
  }

  interface nsILocalHandlerApp extends nsIHandlerApp {
    executable: nsIFile;
    readonly parameterCount: u32;
    prettyNameAsync(): Promise<any>;
    clearParameters(): void;
    appendParameter(param: string): void;
    getParameter(parameterIndex: u32): string;
    parameterExists(param: string): boolean;
  }

  interface nsIWebHandlerApp extends nsIHandlerApp {
    uriTemplate: string;
  }

  interface nsIDBusHandlerApp extends nsIHandlerApp {
    service: string;
    objectPath: string;
    dBusInterface: string;
    method: string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/mime/nsIMIMEService.idl

  interface nsIMIMEService extends nsISupports {
    readonly VALIDATE_DEFAULT?: 0;
    readonly VALIDATE_SANITIZE_ONLY?: 1;
    readonly VALIDATE_DONT_COLLAPSE_WHITESPACE?: 2;
    readonly VALIDATE_DONT_TRUNCATE?: 4;
    readonly VALIDATE_GUESS_FROM_EXTENSION?: 8;
    readonly VALIDATE_ALLOW_EMPTY?: 16;
    readonly VALIDATE_NO_DEFAULT_FILENAME?: 32;
    readonly VALIDATE_FORCE_APPEND_EXTENSION?: 64;
    readonly VALIDATE_ALLOW_INVALID_FILENAMES?: 128;
    readonly VALIDATE_ALLOW_DIRECTORY_NAMES?: 256;

    getFromTypeAndExtension(aMIMEType: string, aFileExt: string): nsIMIMEInfo;
    getTypeFromExtension(aFileExt: string): string;
    getTypeFromURI(aURI: nsIURI): string;
    getDefaultTypeFromURI(aURI: nsIURI): string;
    getTypeFromFile(aFile: nsIFile): string;
    getPrimaryExtension(aMIMEType: string, aFileExt: string): string;
    getMIMEInfoFromOS(
      aType: string,
      aFileExtension: string,
      aFound: OutParam<boolean>
    ): nsIMIMEInfo;
    updateDefaultAppInfo(aMIMEInfo: nsIMIMEInfo): void;
    getValidFileName(
      aChannel: nsIChannel,
      aType: string,
      aOriginalURI: nsIURI,
      aFlags: u32
    ): string;
    validateFileNameForSaving(aFileName: string, aType: string, aFlags: u32): string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/ml/nsIMLUtils.idl

  interface nsIMLUtils extends nsISupports {
    readonly totalPhysicalMemory: u64;
    readonly availablePhysicalMemory: u64;
    getOptimalCPUConcurrency(): u8;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/find/nsIFind.idl

  interface nsIFind extends nsISupports {
    findBackwards: boolean;
    caseSensitive: boolean;
    entireWord: boolean;
    matchDiacritics: boolean;
    Find(aPatText: string, aSearchRange: Range, aStartPoint: Range, aEndPoint: Range): Range;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/find/nsIFindService.idl

  interface nsIFindService extends nsISupports {
    searchString: string;
    replaceString: string;
    findBackwards: boolean;
    wrapFind: boolean;
    entireWord: boolean;
    matchCase: boolean;
    matchDiacritics: boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/find/nsIWebBrowserFind.idl

  interface nsIWebBrowserFind extends nsISupports {
    findNext(): boolean;
    searchString: string;
    findBackwards: boolean;
    wrapFind: boolean;
    entireWord: boolean;
    matchCase: boolean;
    matchDiacritics: boolean;
    searchFrames: boolean;
  }

  interface nsIWebBrowserFindInFrames extends nsISupports {
    currentSearchFrame: mozIDOMWindowProxy;
    rootSearchFrame: mozIDOMWindowProxy;
    searchSubframes: boolean;
    searchParentFrames: boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/mozintl/mozIMozIntl.idl

  interface mozIMozIntl extends nsISupports {
    getCalendarInfo(locales?: any): any;
    getDisplayNamesDeprecated(locales?: any, options?: any): any;
    getAvailableLocaleDisplayNames(type: any): any;
    getLanguageDisplayNames(locales: any, langCodes: any): any;
    getRegionDisplayNames(locales: any, regionCodes: any): any;
    getLocaleDisplayNames(locales: any, localeCodes: any, options?: any): any;
    getScriptDirection(locale: any): any;
    stringHasRTLChars(str: any): boolean;
    readonly Collator: any;
    readonly DateTimeFormat: any;
    readonly DisplayNames: any;
    readonly ListFormat: any;
    readonly Locale: any;
    readonly NumberFormat: any;
    readonly PluralRules: any;
    readonly RelativeTimeFormat: any;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/mozintl/mozIMozIntlHelper.idl

  interface mozIMozIntlHelper extends nsISupports {
    addGetCalendarInfo(intlObject: any): void;
    addDateTimeFormatConstructor(intlObject: any): void;
    addDisplayNamesConstructor(intlObject: any): void;
    stringHasRTLChars(str: any): boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/mozIThirdPartyUtil.idl

  interface mozIThirdPartyUtil extends nsISupports {
    isThirdPartyURI(aFirstURI: nsIURI, aSecondURI: nsIURI): boolean;
    isThirdPartyWindow(aWindow: mozIDOMWindowProxy, aURI?: nsIURI): boolean;
    isThirdPartyChannel(aChannel: nsIChannel, aURI?: nsIURI): boolean;
    getBaseDomain(aHostURI: nsIURI): string;
    getURIFromWindow(aWindow: mozIDOMWindowProxy): nsIURI;
    getPrincipalFromWindow(aWindow: mozIDOMWindowProxy): nsIPrincipal;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIAndroidContentInputStream.idl

  interface nsIAndroidContentInputStream extends nsIInputStream {
    init(uri: nsIURI): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIArrayBufferInputStream.idl

  interface nsIArrayBufferInputStream extends nsIInputStream {
    setData(buffer: any, byteOffset: u64, byteLen: u64): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIAsyncStreamCopier.idl

  interface nsIAsyncStreamCopier extends nsIRequest {
    init(
      aSource: nsIInputStream,
      aSink: nsIOutputStream,
      aTarget: nsIEventTarget,
      aSourceBuffered: boolean,
      aSinkBuffered: boolean,
      aChunkSize: u32,
      aCloseSource: boolean,
      aCloseSink: boolean
    ): void;
    asyncCopy(aObserver: nsIRequestObserver, aObserverContext: nsISupports): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIAsyncStreamCopier2.idl

  interface nsIAsyncStreamCopier2 extends nsIRequest {
    init(
      aSource: nsIInputStream,
      aSink: nsIOutputStream,
      aTarget: nsIEventTarget,
      aChunkSize: u32,
      aCloseSource: boolean,
      aCloseSink: boolean
    ): void;
    asyncCopy(aObserver: nsIRequestObserver, aObserverContext: nsISupports): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIAsyncVerifyRedirectCallback.idl

  interface nsIAsyncVerifyRedirectCallback extends nsISupports {
    onRedirectVerifyCallback(result: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIAuthInformation.idl

  interface nsIAuthInformation extends nsISupports {
    readonly AUTH_HOST?: 1;
    readonly AUTH_PROXY?: 2;
    readonly NEED_DOMAIN?: 4;
    readonly ONLY_PASSWORD?: 8;
    readonly PREVIOUS_FAILED?: 16;
    readonly CROSS_ORIGIN_SUB_RESOURCE?: 32;

    readonly flags: u32;
    readonly realm: string;
    readonly authenticationScheme: string;
    username: string;
    password: string;
    domain: string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIAuthModule.idl

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIAuthPrompt.idl

  interface nsIAuthPrompt extends nsISupports {
    readonly SAVE_PASSWORD_NEVER?: 0;
    readonly SAVE_PASSWORD_FOR_SESSION?: 1;
    readonly SAVE_PASSWORD_PERMANENTLY?: 2;

    prompt(
      dialogTitle: string,
      text: string,
      passwordRealm: string,
      savePassword: u32,
      defaultText: string,
      result: OutParam<string>
    ): boolean;
    promptUsernameAndPassword(
      dialogTitle: string,
      text: string,
      passwordRealm: string,
      savePassword: u32,
      user: InOutParam<string>,
      pwd: InOutParam<string>
    ): boolean;
    asyncPromptUsernameAndPassword(
      dialogTitle: string,
      text: string,
      passwordRealm: string,
      savePassword: u32,
      user: InOutParam<string>,
      pwd: InOutParam<string>
    ): Promise<any>;
    promptPassword(
      dialogTitle: string,
      text: string,
      passwordRealm: string,
      savePassword: u32,
      pwd: InOutParam<string>
    ): boolean;
    asyncPromptPassword(
      dialogTitle: string,
      text: string,
      passwordRealm: string,
      savePassword: u32,
      pwd: InOutParam<string>
    ): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIAuthPrompt2.idl

  interface nsIAuthPrompt2 extends nsISupports {
    readonly LEVEL_NONE?: 0;
    readonly LEVEL_PW_ENCRYPTED?: 1;
    readonly LEVEL_SECURE?: 2;

    promptAuth(aChannel: nsIChannel, level: u32, authInfo: nsIAuthInformation): boolean;
    asyncPromptAuth(
      aChannel: nsIChannel,
      aCallback: nsIAuthPromptCallback,
      aContext: nsISupports,
      level: u32,
      authInfo: nsIAuthInformation
    ): nsICancelable;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIAuthPromptAdapterFactory.idl

  interface nsIAuthPromptAdapterFactory extends nsISupports {
    createAdapter(aPrompt: nsIAuthPrompt): nsIAuthPrompt2;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIAuthPromptCallback.idl

  interface nsIAuthPromptCallback extends nsISupports {
    onAuthAvailable(aContext: nsISupports, aAuthInfo: nsIAuthInformation): void;
    onAuthCancelled(aContext: nsISupports, userCancel: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIAuthPromptProvider.idl

  interface nsIAuthPromptProvider extends nsISupports {
    readonly PROMPT_NORMAL?: 0;
    readonly PROMPT_PROXY?: 1;

    getAuthPrompt<T extends nsIID>(aPromptReason: u32, iid: T): nsQIResult<T>;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIBackgroundFileSaver.idl

  interface nsIBackgroundFileSaver extends nsISupports {
    observer: nsIBackgroundFileSaverObserver;
    readonly signatureInfo: u8[][][];
    readonly sha256Hash: string;
    enableSignatureInfo(): void;
    enableSha256(): void;
    enableAppend(): void;
    setTarget(aTarget: nsIFile, aKeepPartial: boolean): void;
    finish(aStatus: nsresult): void;
  }

  interface nsIBackgroundFileSaverObserver extends nsISupports {
    onTargetChange(aSaver: nsIBackgroundFileSaver, aTarget: nsIFile): void;
    onSaveComplete(aSaver: nsIBackgroundFileSaver, aStatus: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIBaseChannel.idl

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIBufferedStreams.idl

  interface nsIBufferedInputStream extends nsIInputStream {
    init(fillFromStream: nsIInputStream, bufferSize: u32): void;
    readonly data: nsIInputStream;
  }

  interface nsIBufferedOutputStream extends nsIOutputStream {
    init(sinkToStream: nsIOutputStream, bufferSize: u32): void;
    readonly data: nsIOutputStream;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIByteRangeRequest.idl

  interface nsIByteRangeRequest extends nsISupports {
    readonly isByteRangeRequest: boolean;
    readonly startRange: i64;
    readonly endRange: i64;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsICacheInfoChannel.idl

  interface nsIInputStreamReceiver extends nsISupports {
    onInputStreamReady(aStream: nsIInputStream): void;
  }
} // global

declare enum nsICacheInfoChannel_PreferredAlternativeDataDeliveryType {
  NONE = 0,
  ASYNC = 1,
  SERIALIZE = 2,
}

declare global {
  namespace nsICacheInfoChannel {
    type PreferredAlternativeDataDeliveryType =
      nsICacheInfoChannel_PreferredAlternativeDataDeliveryType;
  }

  interface nsICacheInfoChannel
    extends nsISupports,
      Enums<typeof nsICacheInfoChannel_PreferredAlternativeDataDeliveryType> {
    readonly cacheTokenFetchCount: u32;
    readonly cacheTokenExpirationTime: u32;
    isFromCache(): boolean;
    isRacing(): boolean;
    getCacheEntryId(): u64;
    cacheKey: u32;
    allowStaleCacheContent: boolean;
    preferCacheLoadOverBypass: boolean;
    forceValidateCacheContent: boolean;
    preferAlternativeDataType(
      type: string,
      contentType: string,
      deliverAltData: nsICacheInfoChannel.PreferredAlternativeDataDeliveryType
    ): void;
    readonly alternativeDataType: string;
    readonly alternativeDataInputStream: nsIInputStream;
    getOriginalInputStream(aReceiver: nsIInputStreamReceiver): void;
    openAlternativeOutputStream(type: string, predictedSize: i64): nsIAsyncOutputStream;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsICachingChannel.idl

  interface nsICachingChannel extends nsICacheInfoChannel {
    readonly LOAD_NO_NETWORK_IO?: 67108864;
    readonly LOAD_BYPASS_LOCAL_CACHE?: 268435456;
    readonly LOAD_BYPASS_LOCAL_CACHE_IF_BUSY?: 536870912;
    readonly LOAD_ONLY_FROM_CACHE?: 1073741824;
    readonly LOAD_ONLY_IF_MODIFIED?: 2147483648;

    cacheToken: nsISupports;
    cacheOnlyMetadata: boolean;
    pin: boolean;
    forceCacheEntryValidFor(aSecondsToTheFuture: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsICancelable.idl

  interface nsICancelable extends nsISupports {
    cancel(aReason: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsICaptivePortalService.idl

  interface nsICaptivePortalServiceCallback extends nsISupports {
    complete(success: boolean, error: nsresult): void;
  }

  interface nsICaptivePortalService extends nsISupports {
    readonly UNKNOWN?: 0;
    readonly NOT_CAPTIVE?: 1;
    readonly UNLOCKED_PORTAL?: 2;
    readonly LOCKED_PORTAL?: 3;

    recheckCaptivePortal(): void;
    readonly state: i32;
    readonly lastChecked: u64;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIChannel.idl

  interface nsIChannel extends nsIRequest {
    readonly LOAD_DOCUMENT_URI?: 65536;
    readonly LOAD_RETARGETED_DOCUMENT_URI?: 131072;
    readonly LOAD_REPLACE?: 262144;
    readonly LOAD_INITIAL_DOCUMENT_URI?: 524288;
    readonly LOAD_TARGETED?: 1048576;
    readonly LOAD_CALL_CONTENT_SNIFFERS?: 2097152;
    readonly LOAD_BYPASS_URL_CLASSIFIER?: 4194304;
    readonly LOAD_MEDIA_SNIFFER_OVERRIDES_CONTENT_TYPE?: 8388608;
    readonly LOAD_EXPLICIT_CREDENTIALS?: 16777216;
    readonly LOAD_BYPASS_SERVICE_WORKER?: 33554432;
    readonly DISPOSITION_INLINE?: 0;
    readonly DISPOSITION_ATTACHMENT?: 1;
    readonly DISPOSITION_FORCE_INLINE?: 2;

    originalURI: nsIURI;
    readonly URI: nsIURI;
    owner: nsISupports;
    notificationCallbacks: nsIInterfaceRequestor;
    readonly securityInfo: nsITransportSecurityInfo;
    contentType: string;
    contentCharset: string;
    contentLength: i64;
    open(): nsIInputStream;
    asyncOpen(aListener: nsIStreamListener): void;
    readonly canceled: boolean;
    contentDisposition: u32;
    contentDispositionFilename: string;
    readonly contentDispositionHeader: string;
    loadInfo: nsILoadInfo;
    readonly isDocument: boolean;
  }

  interface nsIIdentChannel extends nsIChannel {
    channelId: u64;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIChannelEventSink.idl

  interface nsIChannelEventSink extends nsISupports {
    readonly REDIRECT_TEMPORARY?: 1;
    readonly REDIRECT_PERMANENT?: 2;
    readonly REDIRECT_INTERNAL?: 4;
    readonly REDIRECT_STS_UPGRADE?: 8;
    readonly REDIRECT_AUTH_RETRY?: 16;
    readonly REDIRECT_TRANSPARENT?: 32;

    asyncOnChannelRedirect(
      oldChannel: nsIChannel,
      newChannel: nsIChannel,
      flags: u32,
      callback: nsIAsyncVerifyRedirectCallback
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIChildChannel.idl

  interface nsIChildChannel extends nsISupports {
    connectParent(registrarId: u32): void;
    completeRedirectSetup(aListener: nsIStreamListener): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIClassOfService.idl
} // global

declare enum nsIClassOfService_FetchPriority {
  FETCHPRIORITY_UNSET = 0,
  FETCHPRIORITY_LOW = 1,
  FETCHPRIORITY_AUTO = 2,
  FETCHPRIORITY_HIGH = 3,
}

declare global {
  namespace nsIClassOfService {
    type FetchPriority = nsIClassOfService_FetchPriority;
  }

  interface nsIClassOfService extends nsISupports, Enums<typeof nsIClassOfService_FetchPriority> {
    readonly Leader?: 1;
    readonly Follower?: 2;
    readonly Speculative?: 4;
    readonly Background?: 8;
    readonly Unblocked?: 16;
    readonly Throttleable?: 32;
    readonly UrgentStart?: 64;
    readonly DontThrottle?: 128;
    readonly Tail?: 256;
    readonly TailAllowed?: 512;
    readonly TailForbidden?: 1024;

    classFlags: u32;
    incremental: boolean;
    clearClassFlags(flags: u32): void;
    addClassFlags(flags: u32): void;
    fetchPriority: nsIClassOfService.FetchPriority;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIClassifiedChannel.idl
} // global

declare enum nsIClassifiedChannel_ClassificationFlags {
  CLASSIFIED_FINGERPRINTING = 1,
  CLASSIFIED_FINGERPRINTING_CONTENT = 128,
  CLASSIFIED_CRYPTOMINING = 2,
  CLASSIFIED_CRYPTOMINING_CONTENT = 256,
  CLASSIFIED_TRACKING = 4,
  CLASSIFIED_TRACKING_AD = 8,
  CLASSIFIED_TRACKING_ANALYTICS = 16,
  CLASSIFIED_TRACKING_SOCIAL = 32,
  CLASSIFIED_TRACKING_CONTENT = 64,
  CLASSIFIED_SOCIALTRACKING = 512,
  CLASSIFIED_SOCIALTRACKING_FACEBOOK = 1024,
  CLASSIFIED_SOCIALTRACKING_LINKEDIN = 2048,
  CLASSIFIED_SOCIALTRACKING_TWITTER = 4096,
  CLASSIFIED_EMAILTRACKING = 8192,
  CLASSIFIED_EMAILTRACKING_CONTENT = 16384,
  CLASSIFIED_CONSENTMANAGER = 32768,
  CLASSIFIED_ANY_BASIC_TRACKING = 61,
  CLASSIFIED_ANY_STRICT_TRACKING = 253,
  CLASSIFIED_ANY_SOCIAL_TRACKING = 7680,
}

declare global {
  namespace nsIClassifiedChannel {
    type ClassificationFlags = nsIClassifiedChannel_ClassificationFlags;
  }

  interface nsIClassifiedChannel
    extends nsISupports,
      Enums<typeof nsIClassifiedChannel_ClassificationFlags> {
    setMatchedInfo(aList: string, aProvider: string, aFullHash: string): void;
    readonly matchedList: string;
    readonly matchedProvider: string;
    readonly matchedFullHash: string;
    setMatchedTrackingInfo(aLists: string[], aFullHashes: string[]): void;
    readonly matchedTrackingLists: string[];
    readonly matchedTrackingFullHashes: string[];
    readonly firstPartyClassificationFlags: u32;
    readonly thirdPartyClassificationFlags: u32;
    readonly classificationFlags: u32;
    isThirdPartyTrackingResource(): boolean;
    isThirdPartySocialTrackingResource(): boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIContentSniffer.idl

  interface nsIContentSniffer extends nsISupports {
    getMIMETypeFromContent(aRequest: nsIRequest, aData: u8[], aLength: u32): string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIDHCPClient.idl

  interface nsIDHCPClient extends nsISupports {
    getOption(option: u8): string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIDashboard.idl

  type nsINetDashboardCallback = Callable<{
    onDashboardDataAvailable(data: any): void;
  }>;

  interface nsIDashboard extends nsISupports {
    requestSockets(cb: nsINetDashboardCallback): void;
    requestHttpConnections(cb: nsINetDashboardCallback): void;
    requestWebsocketConnections(cb: nsINetDashboardCallback): void;
    requestDNSInfo(cb: nsINetDashboardCallback): void;
    requestConnection(
      aHost: string,
      aPort: u32,
      aProtocol: string,
      aTimeout: u32,
      cb: nsINetDashboardCallback
    ): void;
    enableLogging: boolean;
    requestDNSLookup(aHost: string, cb: nsINetDashboardCallback): void;
    requestDNSHTTPSRRLookup(aHost: string, cb: nsINetDashboardCallback): void;
    requestRcwnStats(cb: nsINetDashboardCallback): void;
    getLogPath(): string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIDashboardEventNotifier.idl

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIDownloader.idl

  interface nsIDownloader extends nsIStreamListener {
    init(observer: nsIDownloadObserver, downloadLocation: nsIFile): void;
  }

  interface nsIDownloadObserver extends nsISupports {
    onDownloadComplete(
      downloader: nsIDownloader,
      request: nsIRequest,
      status: nsresult,
      result: nsIFile
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIEncodedChannel.idl

  interface nsIEncodedChannel extends nsISupports {
    readonly contentEncodings: nsIUTF8StringEnumerator;
    applyConversion: boolean;
    hasContentDecompressed: boolean;
    doApplyContentConversions(
      aNextListener: nsIStreamListener,
      aNewNextListener: OutParam<nsIStreamListener>,
      aCtxt: nsISupports
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIExternalProtocolHandler.idl

  interface nsIExternalProtocolHandler extends nsIProtocolHandler {
    externalAppExistsForScheme(scheme: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIFileStreams.idl

  interface nsIFileInputStream extends nsIInputStream {
    readonly CLOSE_ON_EOF?: 4;
    readonly REOPEN_ON_REWIND?: 8;
    readonly DEFER_OPEN?: 16;
    readonly SHARE_DELETE?: 32;

    init(file: nsIFile, ioFlags: i32, perm: i32, behaviorFlags: i32): void;
  }

  interface nsIFileOutputStream extends nsIOutputStream {
    readonly DEFER_OPEN?: 1;

    init(file: nsIFile, ioFlags: i32, perm: i32, behaviorFlags: i32): void;
  }

  interface nsIFileRandomAccessStream extends nsIRandomAccessStream {
    readonly DEFER_OPEN?: 1;

    init(file: nsIFile, ioFlags: i32, perm: i32, behaviorFlags: i32): void;
  }

  interface nsIFileMetadata extends nsISupports {
    readonly size: i64;
    readonly lastModified: i64;
  }

  interface nsIAsyncFileMetadata extends nsIFileMetadata {
    asyncFileMetadataWait(aCallback: nsIFileMetadataCallback, aEventTarget: nsIEventTarget): void;
  }

  type nsIFileMetadataCallback = Callable<{
    onFileMetadataReady(aObject: nsIAsyncFileMetadata): void;
  }>;

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIFileURL.idl

  interface nsIFileURL extends nsIURL {
    readonly file: nsIFile;
  }

  interface nsIFileURLMutator extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIForcePendingChannel.idl

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIFormPOSTActionChannel.idl

  interface nsIFormPOSTActionChannel extends nsIUploadChannel {}

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIHttpAuthenticatorCallback.idl

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIHttpPushListener.idl

  interface nsIHttpPushListener extends nsISupports {
    onPush(associatedChannel: nsIHttpChannel, pushChannel: nsIHttpChannel): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIIOService.idl

  interface nsIIOService extends nsISupports {
    getProtocolHandler(aScheme: string): nsIProtocolHandler;
    getProtocolFlags(aScheme: string): u32;
    getDynamicProtocolFlags(aURI: nsIURI): u32;
    getDefaultPort(aScheme: string): i32;
    newURI(aSpec: string, aOriginCharset?: string, aBaseURI?: nsIURI): nsIURI;
    newFileURI(aFile: nsIFile): nsIURI;
    createExposableURI(aURI: nsIURI): nsIURI;
    newChannelFromURI(
      aURI: nsIURI,
      aLoadingNode: Node,
      aLoadingPrincipal: nsIPrincipal,
      aTriggeringPrincipal: nsIPrincipal,
      aSecurityFlags: u32,
      aContentPolicyType: nsContentPolicyType
    ): nsIChannel;
    newChannelFromURIWithLoadInfo(aURI: nsIURI, aLoadInfo: nsILoadInfo): nsIChannel;
    newChannel(
      aSpec: string,
      aOriginCharset: string,
      aBaseURI: nsIURI,
      aLoadingNode: Node,
      aLoadingPrincipal: nsIPrincipal,
      aTriggeringPrincipal: nsIPrincipal,
      aSecurityFlags: u32,
      aContentPolicyType: nsContentPolicyType
    ): nsIChannel;
    newSuspendableChannelWrapper(innerChannel: nsIChannel): nsISuspendableChannelWrapper;
    newWebTransport(): nsIWebTransport;
    originAttributesForNetworkState(aChannel: nsIChannel): any;
    offline: boolean;
    readonly connectivity: boolean;
    allowPort(aPort: i32, aScheme: string): boolean;
    extractScheme(urlString: string): string;
    hostnameIsLocalIPAddress(aURI: nsIURI): boolean;
    hostnameIsSharedIPAddress(aURI: nsIURI): boolean;
    hostnameIsIPAddressAny(aURI: nsIURI): boolean;
    isValidHostname(hostname: string): boolean;
    manageOfflineStatus: boolean;
    newChannelFromURIWithProxyFlags(
      aURI: nsIURI,
      aProxyURI: nsIURI,
      aProxyFlags: u32,
      aLoadingNode: Node,
      aLoadingPrincipal: nsIPrincipal,
      aTriggeringPrincipal: nsIPrincipal,
      aSecurityFlags: u32,
      aContentPolicyType: nsContentPolicyType
    ): nsIChannel;
    readonly socketProcessLaunched: boolean;
    readonly socketProcessId: u64;
    registerProtocolHandler(
      aScheme: string,
      aHandler: nsIProtocolHandler,
      aProtocolFlags: u32,
      aDefaultPort: i32
    ): void;
    unregisterProtocolHandler(aScheme: string): void;
    setSimpleURIUnknownRemoteSchemes(aRemoteSchemes: string[]): void;
    addEssentialDomainMapping(aFrom: string, aTo: string): void;
    clearEssentialDomainMapping(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIIncrementalDownload.idl

  interface nsIIncrementalDownload extends nsIRequest {
    init(
      uri: nsIURI,
      destination: nsIFile,
      chunkSize: i32,
      intervalInSeconds: i32,
      extraHeaders: string
    ): void;
    readonly URI: nsIURI;
    readonly finalURI: nsIURI;
    readonly destination: nsIFile;
    readonly totalSize: i64;
    readonly currentSize: i64;
    start(observer: nsIRequestObserver, ctxt: nsISupports): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIIncrementalStreamLoader.idl

  interface nsIIncrementalStreamLoaderObserver extends nsISupports {
    onStartRequest(aRequest: nsIRequest): void;
    onIncrementalData(
      loader: nsIIncrementalStreamLoader,
      ctxt: nsISupports,
      dataLength: u32,
      data: u8[],
      consumedLength: InOutParam<u32>
    ): void;
    onStreamComplete(
      loader: nsIIncrementalStreamLoader,
      ctxt: nsISupports,
      status: nsresult,
      resultLength: u32,
      result: u8[]
    ): void;
  }

  interface nsIIncrementalStreamLoader extends nsIThreadRetargetableStreamListener {
    init(aObserver: nsIIncrementalStreamLoaderObserver): void;
    readonly numBytesRead: u32;
    readonly request: nsIRequest;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIInputStreamChannel.idl

  interface nsIInputStreamChannel extends nsISupports {
    setURI(aURI: nsIURI): void;
    contentStream: nsIInputStream;
    srcdocData: string;
    readonly isSrcdocChannel: boolean;
    baseURI: nsIURI;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIInputStreamPump.idl

  interface nsIInputStreamPump extends nsIRequest {
    init(
      aStream: nsIInputStream,
      aSegmentSize: u32,
      aSegmentCount: u32,
      aCloseWhenDone: boolean,
      aMainThreadTarget?: nsISerialEventTarget
    ): void;
    asyncRead(aListener: nsIStreamListener): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIInterceptionInfo.idl

  interface nsIInterceptionInfo extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsILoadContextInfo.idl

  interface nsILoadContextInfo extends nsISupports {
    readonly isPrivate: boolean;
    readonly isAnonymous: boolean;
    readonly originAttributes: any;
  }

  interface nsILoadContextInfoFactory extends nsISupports {
    readonly default: nsILoadContextInfo;
    readonly private: nsILoadContextInfo;
    readonly anonymous: nsILoadContextInfo;
    custom(aAnonymous: boolean, aOriginAttributes: any): nsILoadContextInfo;
    fromLoadContext(aLoadContext: nsILoadContext, aAnonymous: boolean): nsILoadContextInfo;
    fromWindow(aWindow: nsIDOMWindow, aAnonymous: boolean): nsILoadContextInfo;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsILoadGroup.idl

  interface nsILoadGroup extends nsIRequest {
    groupObserver: nsIRequestObserver;
    defaultLoadRequest: nsIRequest;
    addRequest(aRequest: nsIRequest, aContext: nsISupports): void;
    removeRequest(aRequest: nsIRequest, aContext: nsISupports, aStatus: nsresult): void;
    readonly requests: nsISimpleEnumerator;
    totalKeepAliveBytes: u64;
    readonly activeCount: u32;
    notificationCallbacks: nsIInterfaceRequestor;
    readonly requestContextID: u64;
    defaultLoadFlags: nsLoadFlags;
    readonly isBrowsingContextDiscarded: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsILoadGroupChild.idl

  interface nsILoadGroupChild extends nsISupports {
    parentLoadGroup: nsILoadGroup;
    readonly childLoadGroup: nsILoadGroup;
    readonly rootLoadGroup: nsILoadGroup;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsILoadInfo.idl
} // global

declare enum nsILoadInfo_StoragePermissionState {
  NoStoragePermission = 0,
  HasStoragePermission = 1,
  StoragePermissionAllowListed = 2,
}

declare enum nsILoadInfo_CrossOriginOpenerPolicy {
  OPENER_POLICY_UNSAFE_NONE = 0,
  OPENER_POLICY_SAME_ORIGIN = 1,
  OPENER_POLICY_SAME_ORIGIN_ALLOW_POPUPS = 2,
  OPENER_POLICY_EMBEDDER_POLICY_REQUIRE_CORP_FLAG = 16,
  OPENER_POLICY_SAME_ORIGIN_EMBEDDER_POLICY_REQUIRE_CORP = 17,
}

declare enum nsILoadInfo_CrossOriginEmbedderPolicy {
  EMBEDDER_POLICY_NULL = 0,
  EMBEDDER_POLICY_REQUIRE_CORP = 1,
  EMBEDDER_POLICY_CREDENTIALLESS = 2,
}

declare enum nsILoadInfo_SchemelessInputType {
  SchemelessInputTypeUnset = 0,
  SchemelessInputTypeSchemeful = 1,
  SchemelessInputTypeSchemeless = 2,
}

declare enum nsILoadInfo_HTTPSUpgradeTelemetryType {
  NOT_INITIALIZED = 0,
  NO_UPGRADE = 1,
  ALREADY_HTTPS = 2,
  HSTS = 4,
  HTTPS_ONLY_UPGRADE = 8,
  HTTPS_ONLY_UPGRADE_DOWNGRADE = 16,
  HTTPS_FIRST_UPGRADE = 32,
  HTTPS_FIRST_UPGRADE_DOWNGRADE = 64,
  HTTPS_FIRST_SCHEMELESS_UPGRADE = 128,
  HTTPS_FIRST_SCHEMELESS_UPGRADE_DOWNGRADE = 256,
  CSP_UIR = 512,
  HTTPS_RR = 1024,
  WEB_EXTENSION_UPGRADE = 2048,
  UPGRADE_EXCEPTION = 4096,
  SKIP_HTTPS_UPGRADE = 8192,
}

declare global {
  namespace nsILoadInfo {
    type StoragePermissionState = nsILoadInfo_StoragePermissionState;
    type CrossOriginOpenerPolicy = nsILoadInfo_CrossOriginOpenerPolicy;
    type CrossOriginEmbedderPolicy = nsILoadInfo_CrossOriginEmbedderPolicy;
    type SchemelessInputType = nsILoadInfo_SchemelessInputType;
    type HTTPSUpgradeTelemetryType = nsILoadInfo_HTTPSUpgradeTelemetryType;
  }

  interface nsILoadInfo
    extends nsISupports,
      Enums<
        typeof nsILoadInfo_StoragePermissionState &
          typeof nsILoadInfo_CrossOriginOpenerPolicy &
          typeof nsILoadInfo_CrossOriginEmbedderPolicy &
          typeof nsILoadInfo_SchemelessInputType &
          typeof nsILoadInfo_HTTPSUpgradeTelemetryType
      > {
    readonly SEC_ONLY_FOR_EXPLICIT_CONTENTSEC_CHECK?: 0;
    readonly SEC_REQUIRE_SAME_ORIGIN_INHERITS_SEC_CONTEXT?: 1;
    readonly SEC_REQUIRE_SAME_ORIGIN_DATA_IS_BLOCKED?: 2;
    readonly SEC_ALLOW_CROSS_ORIGIN_INHERITS_SEC_CONTEXT?: 4;
    readonly SEC_ALLOW_CROSS_ORIGIN_SEC_CONTEXT_IS_NULL?: 8;
    readonly SEC_REQUIRE_CORS_INHERITS_SEC_CONTEXT?: 16;
    readonly SEC_COOKIES_DEFAULT?: 0;
    readonly SEC_COOKIES_INCLUDE?: 32;
    readonly SEC_COOKIES_SAME_ORIGIN?: 64;
    readonly SEC_COOKIES_OMIT?: 96;
    readonly SEC_FORCE_INHERIT_PRINCIPAL?: 128;
    readonly SEC_ABOUT_BLANK_INHERITS?: 512;
    readonly SEC_ALLOW_CHROME?: 1024;
    readonly SEC_DISALLOW_SCRIPT?: 2048;
    readonly SEC_DONT_FOLLOW_REDIRECTS?: 4096;
    readonly SEC_LOAD_ERROR_PAGE?: 8192;
    readonly SEC_FORCE_INHERIT_PRINCIPAL_OVERRULE_OWNER?: 16384;
    readonly HTTPS_ONLY_UNINITIALIZED?: 1;
    readonly HTTPS_ONLY_UPGRADED_LISTENER_NOT_REGISTERED?: 2;
    readonly HTTPS_ONLY_UPGRADED_LISTENER_REGISTERED?: 4;
    readonly HTTPS_ONLY_EXEMPT?: 8;
    readonly HTTPS_ONLY_TOP_LEVEL_LOAD_IN_PROGRESS?: 16;
    readonly HTTPS_ONLY_DOWNLOAD_IN_PROGRESS?: 32;
    readonly HTTPS_ONLY_DO_NOT_LOG_TO_CONSOLE?: 64;
    readonly HTTPS_ONLY_UPGRADED_HTTPS_FIRST?: 128;
    readonly HTTPS_ONLY_BYPASS_ORB?: 256;
    readonly TAINTING_BASIC?: 0;
    readonly TAINTING_CORS?: 1;
    readonly TAINTING_OPAQUE?: 2;
    readonly BLOCKING_REASON_NONE?: 0;
    readonly BLOCKING_REASON_CORSDISABLED?: 1001;
    readonly BLOCKING_REASON_CORSDIDNOTSUCCEED?: 1002;
    readonly BLOCKING_REASON_CORSREQUESTNOTHTTP?: 1003;
    readonly BLOCKING_REASON_CORSMULTIPLEALLOWORIGINNOTALLOWED?: 1004;
    readonly BLOCKING_REASON_CORSMISSINGALLOWORIGIN?: 1005;
    readonly BLOCKING_REASON_CORSNOTSUPPORTINGCREDENTIALS?: 1006;
    readonly BLOCKING_REASON_CORSALLOWORIGINNOTMATCHINGORIGIN?: 1007;
    readonly BLOCKING_REASON_CORSMISSINGALLOWCREDENTIALS?: 1008;
    readonly BLOCKING_REASON_CORSORIGINHEADERNOTADDED?: 1009;
    readonly BLOCKING_REASON_CORSEXTERNALREDIRECTNOTALLOWED?: 1010;
    readonly BLOCKING_REASON_CORSPREFLIGHTDIDNOTSUCCEED?: 1011;
    readonly BLOCKING_REASON_CORSINVALIDALLOWMETHOD?: 1012;
    readonly BLOCKING_REASON_CORSMETHODNOTFOUND?: 1013;
    readonly BLOCKING_REASON_CORSINVALIDALLOWHEADER?: 1014;
    readonly BLOCKING_REASON_CORSMISSINGALLOWHEADERFROMPREFLIGHT?: 1015;
    readonly BLOCKING_REASON_CLASSIFY_MALWARE_URI?: 2001;
    readonly BLOCKING_REASON_CLASSIFY_PHISHING_URI?: 2002;
    readonly BLOCKING_REASON_CLASSIFY_UNWANTED_URI?: 2003;
    readonly BLOCKING_REASON_CLASSIFY_TRACKING_URI?: 2004;
    readonly BLOCKING_REASON_CLASSIFY_BLOCKED_URI?: 2005;
    readonly BLOCKING_REASON_CLASSIFY_HARMFUL_URI?: 2006;
    readonly BLOCKING_REASON_CLASSIFY_CRYPTOMINING_URI?: 2007;
    readonly BLOCKING_REASON_CLASSIFY_FINGERPRINTING_URI?: 2008;
    readonly BLOCKING_REASON_CLASSIFY_SOCIALTRACKING_URI?: 2009;
    readonly BLOCKING_REASON_CLASSIFY_EMAILTRACKING_URI?: 2010;
    readonly BLOCKING_REASON_MIXED_BLOCKED?: 3001;
    readonly BLOCKING_REASON_CONTENT_POLICY_GENERAL?: 4000;
    readonly BLOCKING_REASON_CONTENT_POLICY_NO_DATA_PROTOCOL?: 4001;
    readonly BLOCKING_REASON_CONTENT_POLICY_CONTENT_BLOCKED?: 4003;
    readonly BLOCKING_REASON_CONTENT_POLICY_DATA_DOCUMENT?: 4004;
    readonly BLOCKING_REASON_CONTENT_POLICY_WEB_BROWSER?: 4005;
    readonly BLOCKING_REASON_CONTENT_POLICY_PRELOAD?: 4006;
    readonly BLOCKING_REASON_NOT_SAME_ORIGIN?: 5000;
    readonly BLOCKING_REASON_EXTENSION_WEBREQUEST?: 6000;
    readonly BLOCKING_REASON_WEBDRIVER_BIDI?: 7000;

    readonly loadingPrincipal: nsIPrincipal;
    readonly triggeringPrincipal: nsIPrincipal;
    triggeringRemoteType: string;
    principalToInherit: nsIPrincipal;
    readonly loadingDocument: Document;
    readonly loadingContext: nsISupports;
    readonly securityFlags: nsSecurityFlags;
    readonly sandboxFlags: u32;
    triggeringSandboxFlags: u32;
    triggeringWindowId: u64;
    triggeringStorageAccess: boolean;
    readonly securityMode: u32;
    skipContentSniffing: boolean;
    httpsOnlyStatus: u32;
    hstsStatus: boolean;
    hasValidUserGestureActivation: boolean;
    textDirectiveUserActivation: boolean;
    isSameDocumentNavigation: boolean;
    allowDeprecatedSystemRequests: boolean;
    parserCreatedScript: boolean;
    isUserTriggeredSave: boolean;
    isInDevToolsContext: boolean;
    isInThirdPartyContext: boolean;
    isThirdPartyContextToTopWindow: boolean;
    isOn3PCBExceptionList: boolean;
    readonly cookiePolicy: u32;
    cookieJarSettings: nsICookieJarSettings;
    storagePermission: nsILoadInfo.StoragePermissionState;
    isMetaRefresh: boolean;
    readonly forceInheritPrincipal: boolean;
    readonly forceInheritPrincipalOverruleOwner: boolean;
    readonly loadingSandboxed: boolean;
    readonly aboutBlankInherits: boolean;
    readonly allowChrome: boolean;
    readonly disallowScript: boolean;
    readonly dontFollowRedirects: boolean;
    readonly loadErrorPage: boolean;
    isFormSubmission: boolean;
    isGETRequest: boolean;
    readonly externalContentPolicyType: nsContentPolicyType;
    sendCSPViolationEvents: boolean;
    readonly internalContentPolicyType: nsContentPolicyType;
    readonly fetchDestination: string;
    readonly blockAllMixedContent: boolean;
    readonly upgradeInsecureRequests: boolean;
    readonly browserUpgradeInsecureRequests: boolean;
    browserDidUpgradeInsecureRequests: boolean;
    readonly browserWouldUpgradeInsecureRequests: boolean;
    forceAllowDataURI: boolean;
    allowInsecureRedirectToDataURI: boolean;
    skipContentPolicyCheckForWebRequest: boolean;
    originalFrameSrcLoad: boolean;
    readonly forceInheritPrincipalDropped: boolean;
    readonly innerWindowID: u64;
    readonly browsingContextID: u64;
    readonly browsingContext: BrowsingContext;
    workerAssociatedBrowsingContextID: u64;
    readonly workerAssociatedBrowsingContext: BrowsingContext;
    readonly frameBrowsingContextID: u64;
    readonly frameBrowsingContext: BrowsingContext;
    readonly targetBrowsingContextID: u64;
    readonly targetBrowsingContext: BrowsingContext;
    resetPrincipalToInheritToNullPrincipal(): void;
    originAttributes: any;
    initialSecurityCheckDone: boolean;
    loadTriggeredFromExternal: boolean;
    appendRedirectHistoryEntry(channelToDeriveFrom: nsIChannel, isInternalRedirect: boolean): void;
    readonly redirectChainIncludingInternalRedirects: any;
    readonly redirectChain: any;
    readonly forcePreflight: boolean;
    readonly isPreflight: boolean;
    readonly tainting: u32;
    maybeIncreaseTainting(aTainting: u32): void;
    readonly isTopLevelLoad: boolean;
    resultPrincipalURI: nsIURI;
    channelCreationOriginalURI: nsIURI;
    documentHasUserInteracted: boolean;
    allowListFutureDocumentsCreatedFromThisRedirectChain: boolean;
    needForCheckingAntiTrackingHeuristic: boolean;
    cspNonce: string;
    integrityMetadata: string;
    requestBlockingReason: u32;
    cspEventListener: nsICSPEventListener;
    readonly isFromProcessingFrameAttributes: boolean;
    loadingEmbedderPolicy: nsILoadInfo.CrossOriginEmbedderPolicy;
    isOriginTrialCoepCredentiallessEnabledForTopLevel: boolean;
    isMediaRequest: boolean;
    isMediaInitialRequest: boolean;
    isFromObjectOrEmbed: boolean;
    unstrippedURI: nsIURI;
    hasInjectedCookieForCookieBannerHandling: boolean;
    schemelessInput: nsILoadInfo.SchemelessInputType;
    httpsUpgradeTelemetry: nsILoadInfo.HTTPSUpgradeTelemetryType;
    isNewWindowTarget: boolean;
    skipHTTPSUpgrade: boolean;
    userNavigationInvolvement: u8;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIMIMEInputStream.idl

  interface nsIMIMEInputStream extends nsIInputStream {
    addHeader(name: string, value: string): void;
    visitHeaders(visitor: nsIHttpHeaderVisitor): void;
    setData(stream: nsIInputStream): void;
    readonly data: nsIInputStream;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIMockNetworkLayerController.idl

  interface nsIMockNetworkLayerController extends nsISupports {
    createScriptableNetAddr(aIP: string, aPort: u16): nsINetAddr;
    addNetAddrOverride(aFrom: nsINetAddr, aTo: nsINetAddr): void;
    clearNetAddrOverrides(): void;
    blockUDPAddrIO(aAddr: nsINetAddr): void;
    clearBlockedUDPAddr(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIMultiPartChannel.idl

  interface nsIMultiPartChannel extends nsISupports {
    readonly baseChannel: nsIChannel;
    readonly partID: u32;
    readonly isLastPart: boolean;
  }

  interface nsIMultiPartChannelListener extends nsISupports {
    onAfterLastPart(status: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsINestedURI.idl

  interface nsINestedURI extends nsISupports {
    readonly innerURI: nsIURI;
    readonly innermostURI: nsIURI;
  }

  interface nsINestedURIMutator extends nsISupports {}

  interface nsINestedAboutURIMutator extends nsISupports {}

  interface nsIJSURIMutator extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsINetAddr.idl

  interface nsINetAddr extends nsISupports {
    readonly FAMILY_INET?: 1;
    readonly FAMILY_INET6?: 2;
    readonly FAMILY_LOCAL?: 3;

    readonly family: u16;
    readonly address: string;
    readonly port: u16;
    readonly flow: u32;
    readonly scope: u32;
    readonly isV4Mapped: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsINetUtil.idl

  interface nsINetUtil extends nsISupports {
    readonly ESCAPE_ALL?: 0;
    readonly ESCAPE_XALPHAS?: 1;
    readonly ESCAPE_XPALPHAS?: 2;
    readonly ESCAPE_URL_PATH?: 4;
    readonly ESCAPE_URL_APPLE_EXTRA?: 8;
    readonly ESCAPE_URL_SCHEME?: 1;
    readonly ESCAPE_URL_USERNAME?: 2;
    readonly ESCAPE_URL_PASSWORD?: 4;
    readonly ESCAPE_URL_HOST?: 8;
    readonly ESCAPE_URL_DIRECTORY?: 16;
    readonly ESCAPE_URL_FILE_BASENAME?: 32;
    readonly ESCAPE_URL_FILE_EXTENSION?: 64;
    readonly ESCAPE_URL_PARAM?: 128;
    readonly ESCAPE_URL_QUERY?: 256;
    readonly ESCAPE_URL_REF?: 512;
    readonly ESCAPE_URL_FILEPATH?: 112;
    readonly ESCAPE_URL_MINIMAL?: 1023;
    readonly ESCAPE_URL_FORCED?: 1024;
    readonly ESCAPE_URL_ONLY_ASCII?: 2048;
    readonly ESCAPE_URL_ONLY_NONASCII?: 4096;
    readonly ESCAPE_URL_COLON?: 16384;
    readonly ESCAPE_URL_SKIP_CONTROL?: 32768;
    readonly ESCAPE_URL_EXT_HANDLER?: 131072;

    parseRequestContentType(
      aTypeHeader: string,
      aCharset: OutParam<string>,
      aHadCharset: OutParam<boolean>
    ): string;
    parseResponseContentType(
      aTypeHeader: string,
      aCharset: OutParam<string>,
      aHadCharset: OutParam<boolean>
    ): string;
    protocolHasFlags(aURI: nsIURI, aFlag: u32): boolean;
    URIChainHasFlags(aURI: nsIURI, aFlags: u32): boolean;
    escapeString(aString: string, aEscapeType: u32): string;
    escapeURL(aStr: string, aFlags: u32): string;
    unescapeString(aStr: string, aFlags: u32): string;
    extractCharsetFromContentType(
      aTypeHeader: string,
      aCharset: OutParam<string>,
      aCharsetStart: OutParam<i32>,
      aCharsetEnd: OutParam<i32>
    ): boolean;
    socketProcessTelemetryPing(): void;
    notImplemented(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsINetworkConnectivityService.idl
} // global

declare enum nsINetworkConnectivityService_ConnectivityState {
  UNKNOWN = 0,
  OK = 1,
  NOT_AVAILABLE = 2,
}

declare global {
  namespace nsINetworkConnectivityService {
    type ConnectivityState = nsINetworkConnectivityService_ConnectivityState;
  }

  interface nsINetworkConnectivityService
    extends nsISupports,
      Enums<typeof nsINetworkConnectivityService_ConnectivityState> {
    DNSv4: nsINetworkConnectivityService.ConnectivityState;
    DNSv6: nsINetworkConnectivityService.ConnectivityState;
    DNS_HTTPS: nsINetworkConnectivityService.ConnectivityState;
    IPv4: nsINetworkConnectivityService.ConnectivityState;
    IPv6: nsINetworkConnectivityService.ConnectivityState;
    NAT64: nsINetworkConnectivityService.ConnectivityState;
    recheckDNS(): void;
    recheckIPConnectivity(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsINetworkInfoService.idl

  interface nsIListNetworkAddressesListener extends nsISupports {
    onListedNetworkAddresses(aAddressArray: string[]): void;
    onListNetworkAddressesFailed(): void;
  }

  interface nsIGetHostnameListener extends nsISupports {
    onGotHostname(aHostname: string): void;
    onGetHostnameFailed(): void;
  }

  interface nsINetworkInfoService extends nsISupports {
    listNetworkAddresses(aListener: nsIListNetworkAddressesListener): void;
    getHostname(aListener: nsIGetHostnameListener): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsINetworkInterceptController.idl

  interface nsIInterceptedBodyCallback extends nsISupports {
    bodyComplete(aRv: nsresult): void;
  }

  interface nsIInterceptedChannel extends nsISupports {
    resetInterception(bypass: boolean): void;
    synthesizeStatus(status: u16, reason: string): void;
    synthesizeHeader(name: string, value: string): void;
    startSynthesizedResponse(
      body: nsIInputStream,
      callback: nsIInterceptedBodyCallback,
      channel: nsICacheInfoChannel,
      finalURLSpec: string,
      responseRedirected: boolean
    ): void;
    finishSynthesizedResponse(): void;
    cancelInterception(status: nsresult): void;
    readonly channel: nsIChannel;
    readonly secureUpgradedChannelURI: nsIURI;
  }

  interface nsINetworkInterceptController extends nsISupports {
    shouldPrepareForIntercept(aURI: nsIURI, aChannel: nsIChannel): boolean;
    channelIntercepted(aChannel: nsIInterceptedChannel): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsINetworkLinkService.idl

  interface nsINetworkLinkService extends nsISupports {
    readonly LINK_TYPE_UNKNOWN?: 0;
    readonly LINK_TYPE_ETHERNET?: 1;
    readonly LINK_TYPE_USB?: 2;
    readonly LINK_TYPE_WIFI?: 3;
    readonly LINK_TYPE_WIMAX?: 4;
    readonly LINK_TYPE_MOBILE?: 9;
    readonly NONE_DETECTED?: 0;
    readonly VPN_DETECTED?: 1;
    readonly PROXY_DETECTED?: 2;
    readonly NRPT_DETECTED?: 4;

    readonly isLinkUp: boolean;
    readonly linkStatusKnown: boolean;
    readonly linkType: u32;
    readonly networkID: string;
    readonly dnsSuffixList: string[];
    readonly resolvers: nsINetAddr[];
    readonly platformDNSIndications: u32;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsINetworkPredictor.idl

  interface nsINetworkPredictor extends nsISupports {
    readonly PREDICT_LINK?: 0;
    readonly PREDICT_LOAD?: 1;
    readonly PREDICT_STARTUP?: 2;
    readonly LEARN_LOAD_TOPLEVEL?: 0;
    readonly LEARN_LOAD_SUBRESOURCE?: 1;
    readonly LEARN_LOAD_REDIRECT?: 2;
    readonly LEARN_STARTUP?: 3;

    predict(
      targetURI: nsIURI,
      sourceURI: nsIURI,
      reason: PredictorPredictReason,
      originAttributes: any,
      verifier: nsINetworkPredictorVerifier
    ): void;
    learn(
      targetURI: nsIURI,
      sourceURI: nsIURI,
      reason: PredictorLearnReason,
      originAttributes: any
    ): void;
    reset(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsINetworkPredictorVerifier.idl

  interface nsINetworkPredictorVerifier extends nsISupports {
    onPredictPrefetch(uri: nsIURI, status: u32): void;
    onPredictPreconnect(uri: nsIURI): void;
    onPredictDNS(uri: nsIURI): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsINullChannel.idl

  interface nsINullChannel extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIParentChannel.idl

  interface nsIParentChannel extends nsIStreamListener {
    delete(): void;
    readonly remoteType: string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIParentRedirectingChannel.idl

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIPermission.idl

  interface nsIPermission extends nsISupports {
    readonly principal: nsIPrincipal;
    readonly type: string;
    readonly capability: u32;
    readonly expireType: u32;
    readonly expireTime: i64;
    readonly modificationTime: i64;
    matches(principal: nsIPrincipal, exactHost: boolean): boolean;
    matchesURI(uri: nsIURI, exactHost: boolean): boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIPermissionManager.idl

  interface nsIPermissionManager extends nsISupports {
    readonly UNKNOWN_ACTION?: 0;
    readonly ALLOW_ACTION?: 1;
    readonly DENY_ACTION?: 2;
    readonly PROMPT_ACTION?: 3;
    readonly MAX_VALID_ACTION?: 3;
    readonly EXPIRE_NEVER?: 0;
    readonly EXPIRE_SESSION?: 1;
    readonly EXPIRE_TIME?: 2;
    readonly EXPIRE_POLICY?: 3;

    getAllForPrincipal(principal: nsIPrincipal): nsIPermission[];
    getAllWithTypePrefix(prefix: string): nsIPermission[];
    getAllByTypes(types: string[]): nsIPermission[];
    getAllByTypeSince(type: string, since: i64): nsIPermission[];
    addFromPrincipal(
      principal: nsIPrincipal,
      type: string,
      permission: u32,
      expireType?: u32,
      expireTime?: i64
    ): void;
    testAddFromPrincipalByTime(
      principal: nsIPrincipal,
      type: string,
      permission: u32,
      modificationTime: i64
    ): void;
    addFromPrincipalAndPersistInPrivateBrowsing(
      principal: nsIPrincipal,
      type: string,
      permission: u32
    ): void;
    addDefaultFromPrincipal(principal: nsIPrincipal, type: string, permission: u32): void;
    removeFromPrincipal(principal: nsIPrincipal, type: string): void;
    removePermission(perm: nsIPermission): void;
    removeAll(): void;
    removeAllSince(since: i64): void;
    removeByType(type: string): void;
    removeAllExceptTypes(typeExceptions: string[]): void;
    removeByTypeSince(type: string, since: i64): void;
    removeAllSinceWithTypeExceptions(since: i64, typeExceptions: string[]): void;
    testPermissionFromPrincipal(principal: nsIPrincipal, type: string): u32;
    testExactPermissionFromPrincipal(principal: nsIPrincipal, type: string): u32;
    testExactPermanentPermission(principal: nsIPrincipal, type: string): u32;
    getPermissionObject(principal: nsIPrincipal, type: string, exactHost: boolean): nsIPermission;
    readonly all: nsIPermission[];
    removePermissionsWithAttributes(
      patternAsJSON: string,
      typeInclusions: string[],
      typeExceptions: string[]
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIPrivateBrowsingChannel.idl

  interface nsIPrivateBrowsingChannel extends nsISupports {
    setPrivate(aPrivate: boolean): void;
    readonly isChannelPrivate: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIProgressEventSink.idl

  interface nsIProgressEventSink extends nsISupports {
    onProgress(aRequest: nsIRequest, aProgress: i64, aProgressMax: i64): void;
    onStatus(aRequest: nsIRequest, aStatus: nsresult, aStatusArg: string): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIPrompt.idl

  interface nsIPrompt extends nsISupports {
    readonly BUTTON_POS_0?: 1;
    readonly BUTTON_POS_1?: 256;
    readonly BUTTON_POS_2?: 65536;
    readonly BUTTON_TITLE_OK?: 1;
    readonly BUTTON_TITLE_CANCEL?: 2;
    readonly BUTTON_TITLE_YES?: 3;
    readonly BUTTON_TITLE_NO?: 4;
    readonly BUTTON_TITLE_SAVE?: 5;
    readonly BUTTON_TITLE_DONT_SAVE?: 6;
    readonly BUTTON_TITLE_REVERT?: 7;
    readonly BUTTON_TITLE_IS_STRING?: 127;
    readonly BUTTON_POS_0_DEFAULT?: 0;
    readonly BUTTON_POS_1_DEFAULT?: 16777216;
    readonly BUTTON_POS_2_DEFAULT?: 33554432;
    readonly BUTTON_DELAY_ENABLE?: 67108864;
    readonly SHOW_SPINNER?: 134217728;
    readonly BUTTON_NONE_ENABLE_BIT?: 268435456;
    readonly BUTTON_NONE?: 268435583;
    readonly BUTTON_POS_1_IS_SECONDARY?: 536870912;
    readonly STD_OK_CANCEL_BUTTONS?: 513;
    readonly STD_YES_NO_BUTTONS?: 1027;
    readonly MODAL_TYPE_CONTENT?: 1;
    readonly MODAL_TYPE_TAB?: 2;
    readonly MODAL_TYPE_WINDOW?: 3;
    readonly MODAL_TYPE_INTERNAL_WINDOW?: 4;

    alert(dialogTitle: string, text: string): void;
    alertCheck(
      dialogTitle: string,
      text: string,
      checkMsg: string,
      checkValue: InOutParam<boolean>
    ): void;
    confirm(dialogTitle: string, text: string): boolean;
    confirmCheck(
      dialogTitle: string,
      text: string,
      checkMsg: string,
      checkValue: InOutParam<boolean>
    ): boolean;
    confirmEx(
      dialogTitle: string,
      text: string,
      buttonFlags: u32,
      button0Title: string,
      button1Title: string,
      button2Title: string,
      checkMsg: string,
      checkValue: InOutParam<boolean>
    ): i32;
    prompt(
      dialogTitle: string,
      text: string,
      value: InOutParam<string>,
      checkMsg: string,
      checkValue: InOutParam<boolean>
    ): boolean;
    promptPassword(dialogTitle: string, text: string, password: InOutParam<string>): boolean;
    promptUsernameAndPassword(
      dialogTitle: string,
      text: string,
      username: InOutParam<string>,
      password: InOutParam<string>
    ): boolean;
    select(
      dialogTitle: string,
      text: string,
      selectList: string[],
      outSelection: OutParam<i32>
    ): boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIProtocolHandler.idl

  interface nsIProtocolHandlerWithDynamicFlags extends nsISupports {
    getFlagsForURI(aURI: nsIURI): u32;
  }

  interface nsIProtocolHandler extends nsISupports {
    readonly URI_STD?: 0;
    readonly URI_NORELATIVE?: 1;
    readonly URI_NOAUTH?: 2;
    readonly ALLOWS_PROXY?: 4;
    readonly ALLOWS_PROXY_HTTP?: 8;
    readonly URI_INHERITS_SECURITY_CONTEXT?: 16;
    readonly URI_FORBIDS_AUTOMATIC_DOCUMENT_REPLACEMENT?: 32;
    readonly URI_LOADABLE_BY_ANYONE?: 64;
    readonly URI_DANGEROUS_TO_LOAD?: 128;
    readonly URI_IS_UI_RESOURCE?: 256;
    readonly URI_IS_LOCAL_FILE?: 512;
    readonly URI_LOADABLE_BY_SUBSUMERS?: 1024;
    readonly URI_DOES_NOT_RETURN_DATA?: 2048;
    readonly URI_IS_LOCAL_RESOURCE?: 4096;
    readonly URI_OPENING_EXECUTES_SCRIPT?: 8192;
    readonly URI_NON_PERSISTABLE?: 16384;
    readonly URI_CROSS_ORIGIN_NEEDS_WEBAPPS_PERM?: 32768;
    readonly URI_SYNC_LOAD_IS_OK?: 65536;
    readonly URI_IS_POTENTIALLY_TRUSTWORTHY?: 131072;
    readonly URI_IS_WEBEXTENSION_RESOURCE?: 262144;
    readonly ORIGIN_IS_FULL_SPEC?: 524288;
    readonly URI_SCHEME_NOT_SELF_LINKABLE?: 1048576;
    readonly URI_LOADABLE_BY_EXTENSIONS?: 2097152;
    readonly URI_FORBIDS_COOKIE_ACCESS?: 4194304;
    readonly URI_HAS_WEB_EXPOSED_ORIGIN?: 8388608;
    readonly DYNAMIC_URI_FLAGS?: 2228416;

    readonly scheme: string;
    newChannel(aURI: nsIURI, aLoadinfo: nsILoadInfo): nsIChannel;
    allowPort(port: i32, scheme: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIProtocolProxyCallback.idl

  interface nsIProtocolProxyCallback extends nsISupports {
    onProxyAvailable(
      aRequest: nsICancelable,
      aChannel: nsIChannel,
      aProxyInfo: nsIProxyInfo,
      aStatus: nsresult
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIProtocolProxyFilter.idl

  interface nsIProxyProtocolFilterResult extends nsISupports {
    onProxyFilterResult(aProxy: nsIProxyInfo): void;
  }

  interface nsIProtocolProxyFilter extends nsISupports {
    applyFilter(aURI: nsIURI, aProxy: nsIProxyInfo, aCallback: nsIProxyProtocolFilterResult): void;
  }

  interface nsIProtocolProxyChannelFilter extends nsISupports {
    applyFilter(
      aChannel: nsIChannel,
      aProxy: nsIProxyInfo,
      aCallback: nsIProxyProtocolFilterResult
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIProtocolProxyService.idl

  interface nsIProxyConfigChangedCallback extends nsISupports {
    onProxyConfigChanged(): void;
  }

  interface nsIProtocolProxyService extends nsISupports {
    readonly RESOLVE_PREFER_SOCKS_PROXY?: 2;
    readonly RESOLVE_IGNORE_URI_SCHEME?: 4;
    readonly RESOLVE_PREFER_HTTPS_PROXY?: 12;
    readonly RESOLVE_ALWAYS_TUNNEL?: 16;
    readonly PROXYCONFIG_DIRECT?: 0;
    readonly PROXYCONFIG_MANUAL?: 1;
    readonly PROXYCONFIG_PAC?: 2;
    readonly PROXYCONFIG_WPAD?: 4;
    readonly PROXYCONFIG_SYSTEM?: 5;

    asyncResolve(
      aChannelOrURI: nsISupports,
      aFlags: u32,
      aCallback: nsIProtocolProxyCallback,
      aMainThreadTarget?: nsISerialEventTarget
    ): nsICancelable;
    newProxyInfo(
      aType: string,
      aHost: string,
      aPort: i32,
      aProxyAuthorizationHeader: string,
      aConnectionIsolationKey: string,
      aFlags: u32,
      aFailoverTimeout: u32,
      aFailoverProxy: nsIProxyInfo
    ): nsIProxyInfo;
    newProxyInfoWithAuth(
      aType: string,
      aHost: string,
      aPort: i32,
      aUsername: string,
      aPassword: string,
      aProxyAuthorizationHeader: string,
      aConnectionIsolationKey: string,
      aFlags: u32,
      aFailoverTimeout: u32,
      aFailoverProxy: nsIProxyInfo
    ): nsIProxyInfo;
    getFailoverForProxy(aProxyInfo: nsIProxyInfo, aURI: nsIURI, aReason: nsresult): nsIProxyInfo;
    registerFilter(aFilter: nsIProtocolProxyFilter, aPosition: u32): void;
    registerChannelFilter(aFilter: nsIProtocolProxyChannelFilter, aPosition: u32): void;
    unregisterFilter(aFilter: nsIProtocolProxyFilter): void;
    unregisterChannelFilter(aFilter: nsIProtocolProxyChannelFilter): void;
    addProxyConfigCallback(aCallback: nsIProxyConfigChangedCallback): void;
    removeProxyConfigCallback(aCallback: nsIProxyConfigChangedCallback): void;
    notifyProxyConfigChangedInternal(): void;
    readonly proxyConfigType: u32;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIProtocolProxyService2.idl

  interface nsIProtocolProxyService2 extends nsIProtocolProxyService {
    reloadPAC(): void;
    asyncResolve2(
      aChannel: nsIChannel,
      aFlags: u32,
      aCallback: nsIProtocolProxyCallback,
      aMainThreadTarget?: nsISerialEventTarget
    ): nsICancelable;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIProxiedChannel.idl

  interface nsIProxiedChannel extends nsISupports {
    readonly proxyInfo: nsIProxyInfo;
    readonly httpProxyConnectResponseCode: i32;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIProxiedProtocolHandler.idl

  interface nsIProxiedProtocolHandler extends nsIProtocolHandler {
    newProxiedChannel(
      uri: nsIURI,
      proxyInfo: nsIProxyInfo,
      proxyResolveFlags: u32,
      proxyURI: nsIURI,
      aLoadInfo: nsILoadInfo
    ): nsIChannel;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIProxyInfo.idl

  interface nsIProxyInfo extends nsISupports {
    readonly SOCKS_V4?: 4;
    readonly SOCKS_V5?: 5;
    readonly TRANSPARENT_PROXY_RESOLVES_HOST?: 1;

    readonly host: string;
    readonly port: i32;
    readonly type: string;
    readonly flags: u32;
    readonly resolveFlags: u32;
    readonly username: string;
    readonly password: string;
    readonly failoverTimeout: u32;
    failoverProxy: nsIProxyInfo;
    sourceId: string;
    readonly proxyAuthorizationHeader: string;
    readonly connectionIsolationKey: string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIRandomGenerator.idl

  interface nsIRandomGenerator extends nsISupports {
    generateRandomBytes(aLength: u32): u8[];
    generateRandomBytesInto(aBuffer: u8[], aLength: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIRedirectChannelRegistrar.idl

  interface nsIRedirectChannelRegistrar extends nsISupports {
    registerChannel(channel: nsIChannel, id: u64): void;
    linkChannels(id: u64, channel: nsIParentChannel): nsIChannel;
    getRegisteredChannel(id: u64): nsIChannel;
    getParentChannel(id: u64): nsIParentChannel;
    deregisterChannels(id: u64): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIRedirectHistoryEntry.idl

  interface nsIRedirectHistoryEntry extends nsISupports {
    readonly principal: nsIPrincipal;
    readonly referrerURI: nsIURI;
    readonly remoteAddress: string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIRedirectResultListener.idl

  interface nsIRedirectResultListener extends nsISupports {
    onRedirectResult(status: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIRequest.idl
} // global

declare enum nsIRequest_TRRMode {
  TRR_DEFAULT_MODE = 0,
  TRR_DISABLED_MODE = 1,
  TRR_FIRST_MODE = 2,
  TRR_ONLY_MODE = 3,
}

declare global {
  namespace nsIRequest {
    type TRRMode = nsIRequest_TRRMode;
  }

  interface nsIRequest extends nsISupports, Enums<typeof nsIRequest_TRRMode> {
    readonly LOAD_REQUESTMASK?: 65535;
    readonly LOAD_NORMAL?: 0;
    readonly LOAD_BACKGROUND?: 1;
    readonly LOAD_HTML_OBJECT_DATA?: 2;
    readonly LOAD_DOCUMENT_NEEDS_COOKIE?: 4;
    readonly LOAD_TRR_MASK?: 24;
    readonly LOAD_TRR_DISABLED_MODE?: 8;
    readonly LOAD_TRR_FIRST_MODE?: 16;
    readonly LOAD_TRR_ONLY_MODE?: 24;
    readonly LOAD_ANONYMOUS_ALLOW_CLIENT_CERT?: 32;
    readonly INHIBIT_CACHING?: 128;
    readonly INHIBIT_PERSISTENT_CACHING?: 256;
    readonly LOAD_BYPASS_CACHE?: 512;
    readonly LOAD_FROM_CACHE?: 1024;
    readonly VALIDATE_ALWAYS?: 2048;
    readonly VALIDATE_NEVER?: 4096;
    readonly VALIDATE_ONCE_PER_SESSION?: 8192;
    readonly LOAD_ANONYMOUS?: 16384;
    readonly LOAD_FRESH_CONNECTION?: 32768;

    readonly name: string;
    isPending(): boolean;
    readonly status: nsresult;
    cancel(aStatus: nsresult): void;
    suspend(): void;
    resume(): void;
    loadGroup: nsILoadGroup;
    loadFlags: nsLoadFlags;
    getTRRMode(): nsIRequest.TRRMode;
    setTRRMode(mode: nsIRequest.TRRMode): void;
    cancelWithReason(aStatus: nsresult, aReason: string): void;
    canceledReason: string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIRequestContext.idl

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIRequestObserver.idl

  interface nsIRequestObserver extends nsISupports {
    onStartRequest(aRequest: nsIRequest): void;
    onStopRequest(aRequest: nsIRequest, aStatusCode: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIRequestObserverProxy.idl

  interface nsIRequestObserverProxy extends nsIRequestObserver {
    init(observer: nsIRequestObserver, context: nsISupports): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIResumableChannel.idl

  interface nsIResumableChannel extends nsISupports {
    resumeAt(startPos: u64, entityID: string): void;
    readonly entityID: string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISecCheckWrapChannel.idl

  interface nsISecCheckWrapChannel extends nsISupports {
    readonly innerChannel: nsIChannel;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISecureBrowserUI.idl

  interface nsISecureBrowserUI extends nsISupports {
    readonly state: u32;
    readonly isSecureContext: boolean;
    readonly secInfo: nsITransportSecurityInfo;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISensitiveInfoHiddenURI.idl

  interface nsISensitiveInfoHiddenURI extends nsISupports {
    getSensitiveInfoHiddenSpec(): string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISerializationHelper.idl

  interface nsISerializationHelper extends nsISupports {
    serializeToString(serializable: nsISerializable): string;
    deserializeObject(input: string): nsISupports;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIServerSocket.idl

  interface nsIServerSocket extends nsISupports {
    readonly LoopbackOnly?: 1;
    readonly KeepWhenOffline?: 2;

    init(aPort: i32, aLoopbackOnly: boolean, aBackLog: i32): void;
    initIPv6(aPort: i32, aLoopbackOnly: boolean, aBackLog: i32): void;
    initDualStack(aPort: i32, aBackLog: i32): void;
    initSpecialConnection(aPort: i32, aFlags: nsServerSocketFlag, aBackLog: i32): void;
    initWithFilename(aPath: nsIFile, aPermissions: u32, aBacklog: i32): void;
    initWithAbstractAddress(aName: string, aBacklog: i32): void;
    close(): void;
    asyncListen(aListener: nsIServerSocketListener): void;
    readonly port: i32;
  }

  interface nsIServerSocketListener extends nsISupports {
    onSocketAccepted(aServ: nsIServerSocket, aTransport: nsISocketTransport): void;
    onStopListening(aServ: nsIServerSocket, aStatus: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISimpleStreamListener.idl

  interface nsISimpleStreamListener extends nsIStreamListener {
    init(aSink: nsIOutputStream, aObserver: nsIRequestObserver): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISimpleURIMutator.idl

  interface nsISimpleURIMutator extends nsISupports {
    setSpecAndFilterWhitespace(aSpec: string): nsIURIMutator;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISocketFilter.idl

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISocketTransport.idl

  interface nsISocketTransport extends nsITransport {
    readonly TIMEOUT_CONNECT?: 0;
    readonly TIMEOUT_READ_WRITE?: 1;
    readonly STATUS_RESOLVING?: 4915203;
    readonly STATUS_RESOLVED?: 4915211;
    readonly STATUS_CONNECTING_TO?: 4915207;
    readonly STATUS_CONNECTED_TO?: 4915204;
    readonly STATUS_SENDING_TO?: 4915205;
    readonly STATUS_WAITING_FOR?: 4915210;
    readonly STATUS_RECEIVING_FROM?: 4915206;
    readonly STATUS_TLS_HANDSHAKE_STARTING?: 4915212;
    readonly STATUS_TLS_HANDSHAKE_ENDED?: 4915213;
    readonly BYPASS_CACHE?: 1;
    readonly ANONYMOUS_CONNECT?: 2;
    readonly DISABLE_IPV6?: 4;
    readonly NO_PERMANENT_STORAGE?: 8;
    readonly DISABLE_IPV4?: 16;
    readonly DISABLE_RFC1918?: 32;
    readonly BE_CONSERVATIVE?: 64;
    readonly DISABLE_TRR?: 128;
    readonly REFRESH_CACHE?: 256;
    readonly RETRY_WITH_DIFFERENT_IP_FAMILY?: 512;
    readonly DONT_TRY_ECH?: 1024;
    readonly TRR_MODE_FLAGS?: 6144;
    readonly USE_IP_HINT_ADDRESS?: 8192;
    readonly ANONYMOUS_CONNECT_ALLOW_CLIENT_CERT?: 16384;
    readonly IS_RETRY?: 32768;
    readonly IS_SPECULATIVE_CONNECTION?: 65536;

    readonly host: string;
    readonly port: i32;
    originAttributes: any;
    getScriptablePeerAddr(): nsINetAddr;
    getScriptableSelfAddr(): nsINetAddr;
    readonly tlsSocketControl: nsITLSSocketControl;
    securityCallbacks: nsIInterfaceRequestor;
    isAlive(): boolean;
    getTimeout(aType: u32): u32;
    setTimeout(aType: u32, aValue: u32): void;
    setLinger(aPolarity: boolean, aTimeout: i16): void;
    setReuseAddrPort(reuseAddrPort: boolean): void;
    connectionFlags: u32;
    tlsFlags: u32;
    QoSBits: u8;
    recvBufferSize: u32;
    sendBufferSize: u32;
    keepaliveEnabled: boolean;
    setKeepaliveVals(keepaliveIdleTime: i32, keepaliveRetryInterval: i32): void;
    readonly resetIPFamilyPreference: boolean;
    readonly echConfigUsed: boolean;
    setEchConfig(echConfig: string): void;
    resolvedByTRR(): boolean;
    readonly effectiveTRRMode: nsIRequest.TRRMode;
    readonly trrSkipReason: nsITRRSkipReason.value;
    readonly retryDnsIfPossible: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISocketTransportService.idl

  type nsISTSShutdownObserver = Callable<{
    observe(): void;
  }>;

  interface nsISocketTransportService extends nsISupports {
    createTransport(
      aSocketTypes: string[],
      aHost: string,
      aPort: i32,
      aProxyInfo: nsIProxyInfo,
      dnsRecord: nsIDNSRecord
    ): nsISocketTransport;
    createUnixDomainTransport(aPath: nsIFile): nsISocketTransport;
    createUnixDomainAbstractAddressTransport(aName: string): nsISocketTransport;
  }

  interface nsIRoutedSocketTransportService extends nsISocketTransportService {
    createRoutedTransport(
      aSocketTypes: string[],
      aHost: string,
      aPort: i32,
      aHostRoute: string,
      aPortRoute: i32,
      aProxyInfo: nsIProxyInfo,
      aDnsRecord: nsIDNSRecord
    ): nsISocketTransport;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISpeculativeConnect.idl

  interface nsISpeculativeConnect extends nsISupports {
    speculativeConnect(
      aURI: nsIURI,
      aPrincipal: nsIPrincipal,
      aCallbacks: nsIInterfaceRequestor,
      aAnonymous: boolean
    ): void;
    speculativeConnectWithOriginAttributes(
      aURI: nsIURI,
      originAttributes: any,
      aCallbacks: nsIInterfaceRequestor,
      aAnonymous: boolean
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIStandardURL.idl

  interface nsIStandardURL extends nsISupports {
    readonly URLTYPE_STANDARD?: 1;
    readonly URLTYPE_AUTHORITY?: 2;
    readonly URLTYPE_NO_AUTHORITY?: 3;
  }

  interface nsIStandardURLMutator extends nsISupports {
    init(
      aUrlType: u32,
      aDefaultPort: i32,
      aSpec: string,
      aOriginCharset: string,
      aBaseURI: nsIURI
    ): nsIURIMutator;
    setDefaultPort(aNewDefaultPort: i32): nsIURIMutator;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIStreamListener.idl

  interface nsIStreamListener extends nsIRequestObserver {
    onDataAvailable(
      aRequest: nsIRequest,
      aInputStream: nsIInputStream,
      aOffset: u64,
      aCount: u32
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIStreamListenerTee.idl

  interface nsIStreamListenerTee extends nsIThreadRetargetableStreamListener {
    init(
      listener: nsIStreamListener,
      sink: nsIOutputStream,
      requestObserver?: nsIRequestObserver
    ): void;
    initAsync(
      listener: nsIStreamListener,
      eventTarget: nsIEventTarget,
      sink: nsIOutputStream,
      requestObserver?: nsIRequestObserver
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIStreamLoader.idl

  interface nsIStreamLoaderObserver extends nsISupports {
    onStreamComplete(
      loader: nsIStreamLoader,
      ctxt: nsISupports,
      status: nsresult,
      resultLength: u32,
      result: u8[]
    ): void;
  }

  interface nsIStreamLoader extends nsIThreadRetargetableStreamListener {
    init(aStreamObserver: nsIStreamLoaderObserver, aRequestObserver?: nsIRequestObserver): void;
    readonly numBytesRead: u32;
    readonly request: nsIRequest;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIStreamTransportService.idl

  interface nsIStreamTransportService extends nsISupports {
    createInputTransport(aStream: nsIInputStream, aCloseWhenDone: boolean): nsITransport;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISuspendableChannelWrapper.idl

  interface nsISuspendableChannelWrapper extends nsIChannel {}

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISyncStreamListener.idl

  interface nsISyncStreamListener extends nsIStreamListener {
    readonly inputStream: nsIInputStream;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsISystemProxySettings.idl

  interface nsISystemProxySettings extends nsISupports {
    readonly mainThreadOnly: boolean;
    readonly PACURI: string;
    getProxyForURI(testSpec: string, testScheme: string, testHost: string, testPort: i32): string;
    readonly systemWPADSetting: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsITLSServerSocket.idl

  interface nsITLSServerSocket extends nsIServerSocket {
    readonly REQUEST_NEVER?: 0;
    readonly REQUEST_FIRST_HANDSHAKE?: 1;
    readonly REQUEST_ALWAYS?: 2;
    readonly REQUIRE_FIRST_HANDSHAKE?: 3;
    readonly REQUIRE_ALWAYS?: 4;

    serverCert: nsIX509Cert;
    setSessionTickets(aSessionTickets: boolean): void;
    setRequestClientCertificate(aRequestClientCert: u32): void;
    setVersionRange(aMinVersion: u16, aMaxVersion: u16): void;
  }

  interface nsITLSClientStatus extends nsISupports {
    readonly SSL_VERSION_3?: 768;
    readonly TLS_VERSION_1?: 769;
    readonly TLS_VERSION_1_1?: 770;
    readonly TLS_VERSION_1_2?: 771;
    readonly TLS_VERSION_1_3?: 772;
    readonly TLS_VERSION_UNKNOWN?: -1;

    readonly peerCert: nsIX509Cert;
    readonly tlsVersionUsed: i16;
    readonly cipherName: string;
    readonly keyLength: u32;
    readonly macLength: u32;
  }

  interface nsITLSServerConnectionInfo extends nsISupports {
    setSecurityObserver(observer: nsITLSServerSecurityObserver): void;
    readonly serverSocket: nsITLSServerSocket;
    readonly status: nsITLSClientStatus;
  }

  interface nsITLSServerSecurityObserver extends nsISupports {
    onHandshakeDone(aServer: nsITLSServerSocket, aStatus: nsITLSClientStatus): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIThreadRetargetableRequest.idl

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIThreadRetargetableStreamListener.idl

  interface nsIThreadRetargetableStreamListener extends nsIStreamListener {
    checkListenerChain(): void;
    onDataFinished(aStatusCode: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIThrottledInputChannel.idl

  interface nsIInputChannelThrottleQueue extends nsISupports {
    init(aMeanBytesPerSecond: u32, aMaxBytesPerSecond: u32): void;
    available(aRemaining: u32): u32;
    recordRead(aBytesRead: u32): void;
    bytesProcessed(): u64;
    wrapStream(aInputStream: nsIInputStream): nsIAsyncInputStream;
  }

  interface nsIThrottledInputChannel extends nsISupports {
    throttleQueue: nsIInputChannelThrottleQueue;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsITimedChannel.idl

  interface nsIServerTiming extends nsISupports {
    readonly name: string;
    readonly duration: double;
    readonly description: string;
  }
} // global

declare enum nsITimedChannel_BodyInfoAccess {
  DISALLOWED = 0,
  ALLOW_SIZES = 1,
  ALLOW_ALL = 2,
}

declare global {
  namespace nsITimedChannel {
    type BodyInfoAccess = nsITimedChannel_BodyInfoAccess;
  }

  interface nsITimedChannel extends nsISupports, Enums<typeof nsITimedChannel_BodyInfoAccess> {
    redirectCount: u8;
    internalRedirectCount: u8;
    initiatorType: string;
    readonly channelCreationTime: PRTime;
    readonly asyncOpenTime: PRTime;
    readonly launchServiceWorkerStartTime: PRTime;
    readonly launchServiceWorkerEndTime: PRTime;
    readonly dispatchFetchEventStartTime: PRTime;
    readonly dispatchFetchEventEndTime: PRTime;
    readonly handleFetchEventStartTime: PRTime;
    readonly handleFetchEventEndTime: PRTime;
    readonly domainLookupStartTime: PRTime;
    readonly domainLookupEndTime: PRTime;
    readonly connectStartTime: PRTime;
    readonly tcpConnectEndTime: PRTime;
    readonly secureConnectionStartTime: PRTime;
    readonly connectEndTime: PRTime;
    readonly requestStartTime: PRTime;
    readonly responseStartTime: PRTime;
    readonly responseEndTime: PRTime;
    readonly cacheReadStartTime: PRTime;
    readonly cacheReadEndTime: PRTime;
    readonly redirectStartTime: PRTime;
    readonly redirectEndTime: PRTime;
    readonly transactionPendingTime: PRTime;
    readonly serverTiming: nsIArray;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsITraceableChannel.idl

  interface nsITraceableChannel extends nsISupports {
    setNewListener(
      aListener: nsIStreamListener,
      aMustApplyContentConversion?: boolean
    ): nsIStreamListener;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsITransport.idl

  interface nsITransport extends nsISupports {
    readonly OPEN_BLOCKING?: 1;
    readonly OPEN_UNBUFFERED?: 2;
    readonly STATUS_READING?: 4915208;
    readonly STATUS_WRITING?: 4915209;

    openInputStream(aFlags: u32, aSegmentSize: u32, aSegmentCount: u32): nsIInputStream;
    openOutputStream(aFlags: u32, aSegmentSize: u32, aSegmentCount: u32): nsIOutputStream;
    close(aReason: nsresult): void;
    setEventSink(aSink: nsITransportEventSink, aEventTarget: nsIEventTarget): void;
  }

  interface nsITransportEventSink extends nsISupports {
    onTransportStatus(
      aTransport: nsITransport,
      aStatus: nsresult,
      aProgress: i64,
      aProgressMax: i64
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIUDPSocket.idl

  interface nsIUDPSocket extends nsISupports {
    init(
      aPort: i32,
      aLoopbackOnly: boolean,
      aPrincipal: nsIPrincipal,
      aAddressReuse?: boolean
    ): void;
    init2(aAddr: string, aPort: i32, aPrincipal: nsIPrincipal, aAddressReuse?: boolean): void;
    close(): void;
    asyncListen(aListener: nsIUDPSocketListener): void;
    readonly localAddr: nsINetAddr;
    readonly port: i32;
    send(host: string, port: u16, data: u8[]): u32;
    sendWithAddr(addr: nsINetAddr, data: u8[]): u32;
    sendBinaryStream(host: string, port: u16, stream: nsIInputStream): void;
    joinMulticast(addr: string, iface?: string): void;
    leaveMulticast(addr: string, iface?: string): void;
    multicastLoopback: boolean;
    multicastInterface: string;
  }

  interface nsIUDPSocketListener extends nsISupports {
    onPacketReceived(aSocket: nsIUDPSocket, aMessage: nsIUDPMessage): void;
    onStopListening(aSocket: nsIUDPSocket, aStatus: nsresult): void;
  }

  interface nsIUDPMessage extends nsISupports {
    readonly fromAddr: nsINetAddr;
    readonly data: string;
    readonly outputStream: nsIOutputStream;
    readonly rawData: any;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIURI.idl

  interface nsIURI extends nsISupports {
    readonly spec: string;
    readonly prePath: string;
    readonly scheme: string;
    readonly userPass: string;
    readonly username: string;
    readonly password: string;
    readonly hostPort: string;
    readonly host: string;
    readonly port: i32;
    readonly pathQueryRef: string;
    equals(other: nsIURI): boolean;
    schemeIs(scheme: string): boolean;
    resolve(relativePath: string): string;
    readonly asciiSpec: string;
    readonly asciiHostPort: string;
    readonly asciiHost: string;
    readonly ref: string;
    equalsExceptRef(other: nsIURI): boolean;
    readonly specIgnoringRef: string;
    readonly hasRef: boolean;
    readonly hasUserPass: boolean;
    readonly filePath: string;
    readonly query: string;
    readonly hasQuery: boolean;
    readonly displayHost: string;
    readonly displayHostPort: string;
    readonly displaySpec: string;
    readonly displayPrePath: string;
    mutate(): nsIURIMutator;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIURIMutator.idl

  interface nsIURISetSpec extends nsISupports {
    setSpec(aSpec: string): nsIURIMutator;
  }

  interface nsIURISetters extends nsIURISetSpec {
    setScheme(aScheme: string): nsIURIMutator;
    setUserPass(aUserPass: string): nsIURIMutator;
    setUsername(aUsername: string): nsIURIMutator;
    setPassword(aPassword: string): nsIURIMutator;
    setHostPort(aHostPort: string): nsIURIMutator;
    setHost(aHost: string): nsIURIMutator;
    setPort(aPort: i32): nsIURIMutator;
    setPathQueryRef(aPathQueryRef: string): nsIURIMutator;
    setRef(aRef: string): nsIURIMutator;
    setFilePath(aFilePath: string): nsIURIMutator;
    setQuery(aQuery: string): nsIURIMutator;
  }

  interface nsIURIMutator extends nsIURISetters {
    finalize(): nsIURI;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIURIWithSpecialOrigin.idl

  interface nsIURIWithSpecialOrigin extends nsISupports {
    readonly origin: nsIURI;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIURL.idl

  interface nsIURL extends nsIURI {
    readonly directory: string;
    readonly fileName: string;
    readonly fileBaseName: string;
    readonly fileExtension: string;
    getCommonBaseSpec(aURIToCompare: nsIURI): string;
    getRelativeSpec(aURIToCompare: nsIURI): string;
  }

  interface nsIURLMutator extends nsISupports {
    setFileName(aFileName: string): nsIURIMutator;
    setFileBaseName(aFileBaseName: string): nsIURIMutator;
    setFileExtension(aFileExtension: string): nsIURIMutator;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIURLParser.idl

  interface nsIURLParser extends nsISupports {
    parseURL(
      spec: string,
      specLen: i32,
      schemePos: OutParam<u32>,
      schemeLen: OutParam<i32>,
      authorityPos: OutParam<u32>,
      authorityLen: OutParam<i32>,
      pathPos: OutParam<u32>,
      pathLen: OutParam<i32>
    ): void;
    parseAuthority(
      authority: string,
      authorityLen: i32,
      usernamePos: OutParam<u32>,
      usernameLen: OutParam<i32>,
      passwordPos: OutParam<u32>,
      passwordLen: OutParam<i32>,
      hostnamePos: OutParam<u32>,
      hostnameLen: OutParam<i32>,
      port: OutParam<i32>
    ): void;
    parseUserInfo(
      userinfo: string,
      userinfoLen: i32,
      usernamePos: OutParam<u32>,
      usernameLen: OutParam<i32>,
      passwordPos: OutParam<u32>,
      passwordLen: OutParam<i32>
    ): void;
    parseServerInfo(
      serverinfo: string,
      serverinfoLen: i32,
      hostnamePos: OutParam<u32>,
      hostnameLen: OutParam<i32>,
      port: OutParam<i32>
    ): void;
    parsePath(
      path: string,
      pathLen: i32,
      filepathPos: OutParam<u32>,
      filepathLen: OutParam<i32>,
      queryPos: OutParam<u32>,
      queryLen: OutParam<i32>,
      refPos: OutParam<u32>,
      refLen: OutParam<i32>
    ): void;
    parseFilePath(
      filepath: string,
      filepathLen: i32,
      directoryPos: OutParam<u32>,
      directoryLen: OutParam<i32>,
      basenamePos: OutParam<u32>,
      basenameLen: OutParam<i32>,
      extensionPos: OutParam<u32>,
      extensionLen: OutParam<i32>
    ): void;
    parseFileName(
      filename: string,
      filenameLen: i32,
      basenamePos: OutParam<u32>,
      basenameLen: OutParam<i32>,
      extensionPos: OutParam<u32>,
      extensionLen: OutParam<i32>
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIUploadChannel.idl

  interface nsIUploadChannel extends nsISupports {
    setUploadStream(aStream: nsIInputStream, aContentType: string, aContentLength: i64): void;
    readonly uploadStream: nsIInputStream;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsIUploadChannel2.idl

  interface nsIUploadChannel2 extends nsISupports {
    explicitSetUploadStream(
      aStream: nsIInputStream,
      aContentType: string,
      aContentLength: i64,
      aMethod: string,
      aStreamHasHeaders: boolean
    ): void;
    readonly uploadStreamHasHeaders: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/base/nsPISocketTransportService.idl

  interface nsPISocketTransportService extends nsIRoutedSocketTransportService {
    init(): void;
    shutdown(aXpcomShutdown: boolean): void;
    readonly sendBufferSize: i32;
    offline: boolean;
    readonly keepaliveIdleTime: i32;
    readonly keepaliveRetryInterval: i32;
    readonly keepaliveProbeCount: i32;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/about/nsIAboutModule.idl

  interface nsIAboutModule extends nsISupports {
    readonly URI_SAFE_FOR_UNTRUSTED_CONTENT?: 1;
    readonly ALLOW_SCRIPT?: 2;
    readonly HIDE_FROM_ABOUTABOUT?: 4;
    readonly ENABLE_INDEXED_DB?: 8;
    readonly URI_CAN_LOAD_IN_CHILD?: 16;
    readonly URI_MUST_LOAD_IN_CHILD?: 32;
    readonly MAKE_UNLINKABLE?: 64;
    readonly MAKE_LINKABLE?: 128;
    readonly URI_CAN_LOAD_IN_PRIVILEGEDABOUT_PROCESS?: 256;
    readonly URI_MUST_LOAD_IN_EXTENSION_PROCESS?: 512;
    readonly IS_SECURE_CHROME_UI?: 1024;

    newChannel(aURI: nsIURI, aLoadInfo: nsILoadInfo): nsIChannel;
    getURIFlags(aURI: nsIURI): u32;
    getChromeURI(aURI: nsIURI): nsIURI;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cache2/nsICacheEntry.idl

  interface nsICacheEntry extends nsISupports {
    readonly CONTENT_TYPE_UNKNOWN?: 0;
    readonly CONTENT_TYPE_OTHER?: 1;
    readonly CONTENT_TYPE_JAVASCRIPT?: 2;
    readonly CONTENT_TYPE_IMAGE?: 3;
    readonly CONTENT_TYPE_MEDIA?: 4;
    readonly CONTENT_TYPE_STYLESHEET?: 5;
    readonly CONTENT_TYPE_WASM?: 6;
    readonly CONTENT_TYPE_LAST?: 7;
    readonly NO_EXPIRATION_TIME?: 4294967295;

    readonly key: string;
    readonly cacheEntryId: u64;
    readonly persistent: boolean;
    readonly fetchCount: u32;
    readonly lastFetched: u32;
    readonly lastModified: u32;
    readonly expirationTime: u32;
    setExpirationTime(expirationTime: u32): void;
    readonly onStartTime: u64;
    readonly onStopTime: u64;
    setNetworkTimes(onStartTime: u64, onStopTime: u64): void;
    setContentType(contentType: u8): void;
    forceValidFor(aSecondsToTheFuture: u32): void;
    readonly isForcedValid: boolean;
    markForcedValidUse(): void;
    openInputStream(offset: i64): nsIInputStream;
    openOutputStream(offset: i64, predictedSize: i64): nsIOutputStream;
    securityInfo: nsITransportSecurityInfo;
    readonly storageDataSize: u32;
    asyncDoom(listener: nsICacheEntryDoomCallback): void;
    getMetaDataElement(key: string): string;
    setMetaDataElement(key: string, value: string): void;
    visitMetaData(visitor: nsICacheEntryMetaDataVisitor): void;
    metaDataReady(): void;
    setValid(): void;
    dismiss(): void;
    readonly diskStorageSizeInKB: u32;
    recreate(aMemoryOnly?: boolean): nsICacheEntry;
    readonly dataSize: i64;
    readonly altDataSize: i64;
    readonly altDataType: string;
    openAlternativeOutputStream(type: string, predictedSize: i64): nsIAsyncOutputStream;
    openAlternativeInputStream(type: string): nsIInputStream;
    readonly loadContextInfo: nsILoadContextInfo;
  }

  interface nsICacheEntryMetaDataVisitor extends nsISupports {
    onMetaDataElement(key: string, value: string): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cache2/nsICacheEntryDoomCallback.idl

  interface nsICacheEntryDoomCallback extends nsISupports {
    onCacheEntryDoomed(aResult: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cache2/nsICacheEntryOpenCallback.idl

  interface nsICacheEntryOpenCallback extends nsISupports {
    readonly ENTRY_WANTED?: 0;
    readonly RECHECK_AFTER_WRITE_FINISHED?: 1;
    readonly ENTRY_NEEDS_REVALIDATION?: 2;
    readonly ENTRY_NOT_WANTED?: 3;

    onCacheEntryCheck(aEntry: nsICacheEntry): u32;
    onCacheEntryAvailable(aEntry: nsICacheEntry, aNew: boolean, aResult: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cache2/nsICachePurgeLock.idl

  interface nsICachePurgeLock extends nsISupports {
    lock(profileName: string): void;
    isOtherInstanceRunning(): boolean;
    unlock(): void;
    getLockFile(profileName: string): nsIFile;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cache2/nsICacheStorage.idl

  interface nsICacheStorage extends nsISupports {
    readonly OPEN_NORMALLY?: 0;
    readonly OPEN_TRUNCATE?: 1;
    readonly OPEN_READONLY?: 2;
    readonly OPEN_PRIORITY?: 4;
    readonly OPEN_BYPASS_IF_BUSY?: 8;
    readonly CHECK_MULTITHREADED?: 16;
    readonly OPEN_SECRETLY?: 32;
    readonly OPEN_INTERCEPTED?: 64;

    asyncOpenURI(
      aURI: nsIURI,
      aIdExtension: string,
      aFlags: u32,
      aCallback: nsICacheEntryOpenCallback
    ): void;
    openTruncate(aURI: nsIURI, aIdExtension: string): nsICacheEntry;
    exists(aURI: nsIURI, aIdExtension: string): boolean;
    getCacheIndexEntryAttrs(
      aURI: nsIURI,
      aIdExtension: string,
      aHasAltData: OutParam<boolean>,
      aSizeInKB: OutParam<u32>
    ): void;
    asyncDoomURI(aURI: nsIURI, aIdExtension: string, aCallback: nsICacheEntryDoomCallback): void;
    asyncEvictStorage(aCallback: nsICacheEntryDoomCallback): void;
    asyncVisitStorage(aVisitor: nsICacheStorageVisitor, aVisitEntries: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cache2/nsICacheStorageService.idl

  interface nsICacheStorageService extends nsISupports {
    readonly PURGE_DISK_DATA_ONLY?: 1;
    readonly PURGE_DISK_ALL?: 2;
    readonly PURGE_EVERYTHING?: 3;

    memoryCacheStorage(aLoadContextInfo: nsILoadContextInfo): nsICacheStorage;
    diskCacheStorage(aLoadContextInfo: nsILoadContextInfo): nsICacheStorage;
    pinningCacheStorage(aLoadContextInfo: nsILoadContextInfo): nsICacheStorage;
    clearOrigin(aPrincipal: nsIPrincipal): void;
    clearBaseDomain(aBaseDomain: string): void;
    clearOriginAttributes(aOriginAttributes: string): void;
    clear(): void;
    purgeFromMemory(aWhat: u32): void;
    readonly ioTarget: nsIEventTarget;
    asyncGetDiskConsumption(aObserver: nsICacheStorageConsumptionObserver): void;
    asyncVisitAllStorages(aVisitor: nsICacheStorageVisitor, aVisitEntries: boolean): void;
  }

  interface nsICacheStorageConsumptionObserver extends nsISupports {
    onNetworkCacheDiskConsumption(aDiskSize: i64): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cache2/nsICacheStorageVisitor.idl

  interface nsICacheStorageVisitor extends nsISupports {
    onCacheStorageInfo(
      aEntryCount: u32,
      aConsumption: u64,
      aCapacity: u64,
      aDiskDirectory: nsIFile
    ): void;
    onCacheEntryInfo(
      aURI: nsIURI,
      aIdEnhance: string,
      aDataSize: i64,
      aAltDataSize: i64,
      aFetchCount: u32,
      aLastModifiedTime: u32,
      aExpirationTime: u32,
      aPinned: boolean,
      aInfo: nsILoadContextInfo
    ): void;
    onCacheEntryVisitCompleted(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cache2/nsICacheTesting.idl

  interface nsICacheTesting extends nsISupports {
    suspendCacheIOThread(aLevel: u32): void;
    resumeCacheIOThread(): void;
    flush(aObserver: nsIObserver): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cookie/nsICookie.idl
} // global

declare enum nsICookie_schemeType {
  SCHEME_UNSET = 0,
  SCHEME_HTTP = 1,
  SCHEME_HTTPS = 2,
  SCHEME_FILE = 4,
}

declare global {
  namespace nsICookie {
    type schemeType = nsICookie_schemeType;
  }

  interface nsICookie extends nsISupports, Enums<typeof nsICookie_schemeType> {
    readonly SAMESITE_NONE?: 0;
    readonly SAMESITE_LAX?: 1;
    readonly SAMESITE_STRICT?: 2;

    readonly name: string;
    readonly value: string;
    readonly isDomain: boolean;
    readonly host: string;
    readonly rawHost: string;
    readonly path: string;
    readonly isSecure: boolean;
    readonly expires: u64;
    readonly expiry: i64;
    readonly originAttributes: any;
    readonly isSession: boolean;
    readonly isHttpOnly: boolean;
    readonly creationTime: i64;
    readonly lastAccessed: i64;
    readonly sameSite: i32;
    readonly schemeMap: nsICookie.schemeType;
    readonly isPartitioned: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cookie/nsICookieJarSettings.idl

  interface nsICookieJarSettings extends nsISerializable {
    readonly cookieBehavior: u32;
    readonly isFirstPartyIsolated: boolean;
    readonly shouldResistFingerprinting: boolean;
    readonly rejectThirdPartyContexts: boolean;
    readonly limitForeignContexts: boolean;
    readonly blockingAllThirdPartyContexts: boolean;
    readonly blockingAllContexts: boolean;
    partitionForeign: boolean;
    readonly isOnContentBlockingAllowList: boolean;
    readonly partitionKey: string;
    readonly fingerprintingRandomizationKey: u8[];
    cookiePermission(aPrincipal: nsIPrincipal): u32;
    initWithURI(aURI: nsIURI, aIsPrivate: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cookie/nsICookieManager.idl

  interface nsICookieManager extends nsISupports {
    removeAll(): void;
    readonly cookies: nsICookie[];
    readonly sessionCookies: nsICookie[];
    getCookieBehavior(aIsPrivate: boolean): u32;
    remove(aHost: string, aName: string, aPath: string, aOriginAttributes: any): void;
    add(
      aHost: string,
      aPath: string,
      aName: string,
      aValue: string,
      aIsSecure: boolean,
      aIsHttpOnly: boolean,
      aIsSession: boolean,
      aExpiry: i64,
      aOriginAttributes: any,
      aSameSite: i32,
      aSchemeMap: nsICookie.schemeType,
      aIsPartitioned?: boolean
    ): void;
    cookieExists(aHost: string, aPath: string, aName: string, aOriginAttributes: any): boolean;
    countCookiesFromHost(aHost: string): u32;
    getCookiesFromHost(aHost: string, aOriginAttributes: any, aSorted?: boolean): nsICookie[];
    getCookiesWithOriginAttributes(
      aPattern: string,
      aHost?: string,
      aSorted?: boolean
    ): nsICookie[];
    removeCookiesWithOriginAttributes(aPattern: string, aHost?: string): void;
    removeCookiesFromExactHost(aHost: string, aPattern: string): void;
    removeAllSince(aSinceWhen: i64): Promise<any>;
    getCookiesSince(aSinceWhen: i64): nsICookie[];
    addThirdPartyCookieBlockingExceptions(aExcpetions: nsIThirdPartyCookieExceptionEntry[]): void;
    removeThirdPartyCookieBlockingExceptions(
      aExceptions: nsIThirdPartyCookieExceptionEntry[]
    ): void;
    testGet3PCBExceptions(): string[];
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cookie/nsICookieNotification.idl
} // global

declare enum nsICookieNotification_Action {
  COOKIE_DELETED = 0,
  COOKIE_ADDED = 1,
  COOKIE_CHANGED = 2,
  ALL_COOKIES_CLEARED = 3,
  COOKIES_BATCH_DELETED = 4,
}

declare global {
  namespace nsICookieNotification {
    type Action = nsICookieNotification_Action;
  }

  interface nsICookieNotification extends nsISupports, Enums<typeof nsICookieNotification_Action> {
    readonly action: nsICookieNotification.Action;
    readonly cookie: nsICookie;
    readonly baseDomain: string;
    readonly isThirdParty: boolean;
    readonly batchDeletedCookies: nsIArray;
    readonly browsingContextId: u64;
    readonly browsingContext: BrowsingContext;
    readonly operationID: nsID;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cookie/nsICookiePermission.idl

  interface nsICookiePermission extends nsISupports {
    readonly ACCESS_DEFAULT?: 0;
    readonly ACCESS_ALLOW?: 1;
    readonly ACCESS_DENY?: 2;
    readonly ACCESS_SESSION?: 8;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cookie/nsICookieService.idl

  type nsICookieTransactionCallback = Callable<{
    callback(): void;
  }>;

  interface nsICookieService extends nsISupports {
    readonly BEHAVIOR_ACCEPT?: 0;
    readonly BEHAVIOR_REJECT_FOREIGN?: 1;
    readonly BEHAVIOR_REJECT?: 2;
    readonly BEHAVIOR_LIMIT_FOREIGN?: 3;
    readonly BEHAVIOR_REJECT_TRACKER?: 4;
    readonly BEHAVIOR_REJECT_TRACKER_AND_PARTITION_FOREIGN?: 5;
    readonly BEHAVIOR_LAST?: 5;

    getCookieStringFromHttp(aURI: nsIURI, aChannel: nsIChannel): string;
    setCookieStringFromHttp(aURI: nsIURI, aCookie: string, aChannel: nsIChannel): void;
    runInTransaction(aCallback: nsICookieTransactionCallback): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/cookie/nsIThirdPartyCookieBlockingExceptionListService.idl

  interface nsIThirdPartyCookieBlockingExceptionListService extends nsISupports {
    init(): Promise<any>;
    shutdown(): void;
  }

  interface nsIThirdPartyCookieExceptionEntry extends nsISupports {
    readonly firstPartySite: string;
    readonly thirdPartySite: string;
    serialize(): string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/dns/nsIDNSAdditionalInfo.idl

  interface nsIDNSAdditionalInfo extends nsISupports {
    readonly port: i32;
    readonly resolverURL: string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/dns/nsIDNSByTypeRecord.idl

  interface nsIDNSByTypeRecord extends nsIDNSRecord {
    readonly type: u32;
  }

  interface nsIDNSTXTRecord extends nsISupports {
    getRecordsAsOneString(): string;
  }

  interface nsISVCParam extends nsISupports {
    readonly type: u16;
  }

  interface nsISVCParamAlpn extends nsISupports {
    readonly alpn: string[];
  }

  interface nsISVCParamNoDefaultAlpn extends nsISupports {}

  interface nsISVCParamPort extends nsISupports {
    readonly port: u16;
  }

  interface nsISVCParamIPv4Hint extends nsISupports {
    readonly ipv4Hint: nsINetAddr[];
  }

  interface nsISVCParamEchConfig extends nsISupports {
    readonly echconfig: string;
  }

  interface nsISVCParamIPv6Hint extends nsISupports {
    readonly ipv6Hint: nsINetAddr[];
  }

  interface nsISVCParamODoHConfig extends nsISupports {
    readonly ODoHConfig: string;
  }

  interface nsISVCBRecord extends nsISupports {
    readonly priority: u16;
    readonly name: string;
    readonly selectedAlpn: string;
    readonly echConfig: string;
    readonly ODoHConfig: string;
    readonly hasIPHintAddress: boolean;
    readonly values: nsISVCParam[];
  }

  interface nsIDNSHTTPSSVCRecord extends nsISupports {
    readonly records: nsISVCBRecord[];
    GetServiceModeRecord(aNoHttp2: boolean, aNoHttp3: boolean): nsISVCBRecord;
    GetServiceModeRecordWithCname(
      aNoHttp2: boolean,
      aNoHttp3: boolean,
      aCName: string
    ): nsISVCBRecord;
    readonly hasIPAddresses: boolean;
    readonly allRecordsExcluded: boolean;
    readonly ttl: u32;
    IsTRR(): boolean;
    GetAllRecordsWithEchConfig(
      aNoHttp2: boolean,
      aNoHttp3: boolean,
      aCName: string,
      aAllRecordsHaveEchConfig: OutParam<boolean>,
      aAllRecordsInH3ExcludedList: OutParam<boolean>
    ): nsISVCBRecord[];
    GetAllRecords(aNoHttp2: boolean, aNoHttp3: boolean, aCName: string): nsISVCBRecord[];
  }

  // https://searchfox.org/mozilla-central/source/netwerk/dns/nsIDNSListener.idl

  interface nsIDNSListener extends nsISupports {
    onLookupComplete(aRequest: nsICancelable, aRecord: nsIDNSRecord, aStatus: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/dns/nsIDNSRecord.idl

  interface nsIDNSRecord extends nsISupports {}

  interface nsIDNSAddrRecord extends nsIDNSRecord {
    readonly canonicalName: string;
    getScriptableNextAddr(aPort: u16): nsINetAddr;
    getNextAddrAsString(): string;
    hasMore(): boolean;
    rewind(): void;
    reportUnusable(aPort: u16): void;
    IsTRR(): boolean;
    resolvedInSocketProcess(): boolean;
    readonly trrFetchDuration: double;
    readonly trrFetchDurationNetworkOnly: double;
    readonly effectiveTRRMode: nsIRequest.TRRMode;
    readonly trrSkipReason: nsITRRSkipReason.value;
    readonly ttl: u32;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/dns/nsIDNSService.idl
} // global

declare enum nsIDNSService_ResolveType {
  RESOLVE_TYPE_DEFAULT = 0,
  RESOLVE_TYPE_TXT = 16,
  RESOLVE_TYPE_HTTPSSVC = 65,
}

declare enum nsIDNSService_ResolverMode {
  MODE_NATIVEONLY = 0,
  MODE_RESERVED1 = 1,
  MODE_TRRFIRST = 2,
  MODE_TRRONLY = 3,
  MODE_RESERVED4 = 4,
  MODE_TRROFF = 5,
}

declare enum nsIDNSService_DNSFlags {
  RESOLVE_DEFAULT_FLAGS = 0,
  RESOLVE_BYPASS_CACHE = 1,
  RESOLVE_CANONICAL_NAME = 2,
  RESOLVE_PRIORITY_MEDIUM = 4,
  RESOLVE_PRIORITY_LOW = 8,
  RESOLVE_SPECULATE = 16,
  RESOLVE_DISABLE_IPV6 = 32,
  RESOLVE_OFFLINE = 64,
  RESOLVE_DISABLE_IPV4 = 128,
  RESOLVE_ALLOW_NAME_COLLISION = 256,
  RESOLVE_DISABLE_TRR = 512,
  RESOLVE_REFRESH_CACHE = 1024,
  RESOLVE_TRR_MODE_MASK = 6144,
  RESOLVE_TRR_DISABLED_MODE = 2048,
  RESOLVE_IGNORE_SOCKS_DNS = 8192,
  RESOLVE_IP_HINT = 16384,
  RESOLVE_WANT_RECORD_ON_ERROR = 65536,
  RESOLVE_DISABLE_NATIVE_HTTPS_QUERY = 131072,
  RESOLVE_CREATE_MOCK_HTTPS_RR = 262144,
  ALL_DNSFLAGS_BITS = 524287,
}

declare enum nsIDNSService_ConfirmationState {
  CONFIRM_OFF = 0,
  CONFIRM_TRYING_OK = 1,
  CONFIRM_OK = 2,
  CONFIRM_FAILED = 3,
  CONFIRM_TRYING_FAILED = 4,
  CONFIRM_DISABLED = 5,
}

declare global {
  namespace nsIDNSService {
    type ResolveType = nsIDNSService_ResolveType;
    type ResolverMode = nsIDNSService_ResolverMode;
    type DNSFlags = nsIDNSService_DNSFlags;
    type ConfirmationState = nsIDNSService_ConfirmationState;
  }

  interface nsIDNSService
    extends nsISupports,
      Enums<
        typeof nsIDNSService_ResolveType &
          typeof nsIDNSService_ResolverMode &
          typeof nsIDNSService_DNSFlags &
          typeof nsIDNSService_ConfirmationState
      > {
    asyncResolve(
      aHostName: string,
      aType: nsIDNSService.ResolveType,
      aFlags: nsIDNSService.DNSFlags,
      aInfo: nsIDNSAdditionalInfo,
      aListener: nsIDNSListener,
      aListenerTarget: nsIEventTarget,
      aOriginAttributes?: any
    ): nsICancelable;
    newAdditionalInfo(aTrrURL: string, aPort: i32): nsIDNSAdditionalInfo;
    cancelAsyncResolve(
      aHostName: string,
      aType: nsIDNSService.ResolveType,
      aFlags: nsIDNSService.DNSFlags,
      aResolver: nsIDNSAdditionalInfo,
      aListener: nsIDNSListener,
      aReason: nsresult,
      aOriginAttributes?: any
    ): void;
    resolve(
      aHostName: string,
      aFlags: nsIDNSService.DNSFlags,
      aOriginAttributes?: any
    ): nsIDNSRecord;
    clearCache(aTrrToo: boolean): void;
    reloadParentalControlEnabled(): void;
    setDetectedTrrURI(aURI: string): void;
    setHeuristicDetectionResult(value: nsITRRSkipReason.value): void;
    readonly heuristicDetectionResult: nsITRRSkipReason.value;
    getTRRSkipReasonName(value: nsITRRSkipReason.value): string;
    readonly lastConfirmationStatus: nsresult;
    readonly lastConfirmationSkipReason: nsITRRSkipReason.value;
    readonly currentTrrURI: string;
    readonly currentTrrMode: nsIDNSService.ResolverMode;
    readonly currentTrrConfirmationState: u32;
    readonly myHostName: string;
    readonly trrDomain: string;
    readonly TRRDomainKey: string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/dns/nsIEffectiveTLDService.idl

  interface nsIEffectiveTLDService extends nsISupports {
    getPublicSuffix(aURI: nsIURI): string;
    getKnownPublicSuffix(aURI: nsIURI): string;
    getBaseDomain(aURI: nsIURI, aAdditionalParts?: u32): string;
    getSchemelessSite(aURI: nsIURI): string;
    getSchemelessSiteFromHost(aHost: string): string;
    getSite(aURI: nsIURI): string;
    getPublicSuffixFromHost(aHost: string): string;
    getKnownPublicSuffixFromHost(aHost: string): string;
    getBaseDomainFromHost(aHost: string, aAdditionalParts?: u32): string;
    getNextSubDomain(aHost: string): string;
    hasRootDomain(aInput: string, aHost: string): boolean;
    hasKnownPublicSuffix(aURI: nsIURI): boolean;
    hasKnownPublicSuffixFromHost(aHost: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/dns/nsIIDNService.idl

  interface nsIIDNService extends nsISupports {
    domainToASCII(input: string): string;
    convertUTF8toACE(input: string): string;
    domainToDisplay(input: string): string;
    convertToDisplayIDN(input: string): string;
    convertACEtoUTF8(input: string): string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/dns/nsINativeDNSResolverOverride.idl

  interface nsINativeDNSResolverOverride extends nsISupports {
    addIPOverride(aHost: string, aIPLiteral: string): void;
    addHTTPSRecordOverride(aHost: string, aData: u8[], aLength: u32): void;
    setCnameOverride(aHost: string, aCNAME: string): void;
    clearHostOverride(aHost: string): void;
    clearOverrides(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/dns/nsITRRSkipReason.idl
} // global

declare enum nsITRRSkipReason_value {
  TRR_UNSET = 0,
  TRR_OK = 1,
  TRR_NO_GSERVICE = 2,
  TRR_PARENTAL_CONTROL = 3,
  TRR_OFF_EXPLICIT = 4,
  TRR_REQ_MODE_DISABLED = 5,
  TRR_MODE_NOT_ENABLED = 6,
  TRR_FAILED = 7,
  TRR_MODE_UNHANDLED_DEFAULT = 8,
  TRR_MODE_UNHANDLED_DISABLED = 9,
  TRR_DISABLED_FLAG = 10,
  TRR_TIMEOUT = 11,
  TRR_CHANNEL_DNS_FAIL = 12,
  TRR_BROWSER_IS_OFFLINE = 13,
  TRR_NOT_CONFIRMED = 14,
  TRR_DID_NOT_MAKE_QUERY = 15,
  TRR_UNKNOWN_CHANNEL_FAILURE = 16,
  TRR_HOST_BLOCKED_TEMPORARY = 17,
  TRR_SEND_FAILED = 18,
  TRR_NET_RESET = 19,
  TRR_NET_TIMEOUT = 20,
  TRR_NET_REFUSED = 21,
  TRR_NET_INTERRUPT = 22,
  TRR_NET_INADEQ_SEQURITY = 23,
  TRR_NO_ANSWERS = 24,
  TRR_DECODE_FAILED = 25,
  TRR_EXCLUDED = 26,
  TRR_SERVER_RESPONSE_ERR = 27,
  TRR_RCODE_FAIL = 28,
  TRR_NO_CONNECTIVITY = 29,
  TRR_NXDOMAIN = 30,
  TRR_REQ_CANCELLED = 31,
  ODOH_KEY_NOT_USABLE = 32,
  ODOH_UPDATE_KEY_FAILED = 33,
  ODOH_KEY_NOT_AVAILABLE = 34,
  ODOH_ENCRYPTION_FAILED = 35,
  ODOH_DECRYPTION_FAILED = 36,
  TRR_HEURISTIC_TRIPPED_GOOGLE_SAFESEARCH = 37,
  TRR_HEURISTIC_TRIPPED_YOUTUBE_SAFESEARCH = 38,
  TRR_HEURISTIC_TRIPPED_ZSCALER_CANARY = 39,
  TRR_HEURISTIC_TRIPPED_CANARY = 40,
  TRR_HEURISTIC_TRIPPED_MODIFIED_ROOTS = 41,
  TRR_HEURISTIC_TRIPPED_PARENTAL_CONTROLS = 42,
  TRR_HEURISTIC_TRIPPED_THIRD_PARTY_ROOTS = 43,
  TRR_HEURISTIC_TRIPPED_ENTERPRISE_POLICY = 44,
  TRR_HEURISTIC_TRIPPED_VPN = 45,
  TRR_HEURISTIC_TRIPPED_PROXY = 46,
  TRR_HEURISTIC_TRIPPED_NRPT = 47,
  TRR_BAD_URL = 48,
  TRR_SYSTEM_SLEEP_MODE = 49,
  eLAST_VALUE = 49,
}

declare global {
  namespace nsITRRSkipReason {
    type value = nsITRRSkipReason_value;
  }

  interface nsITRRSkipReason extends nsISupports, Enums<typeof nsITRRSkipReason_value> {}

  // https://searchfox.org/mozilla-central/source/netwerk/dns/nsPIDNSService.idl

  interface nsPIDNSService extends nsIDNSService {
    init(): void;
    shutdown(): void;
    prefetchEnabled: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/file/nsIFileChannel.idl

  interface nsIFileChannel extends nsISupports {
    readonly file: nsIFile;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/file/nsIFileProtocolHandler.idl

  interface nsIFileProtocolHandler extends nsIProtocolHandler {
    newFileURI(aFile: nsIFile): nsIURI;
    newFileURIMutator(file: nsIFile): nsIURIMutator;
    getURLSpecFromActualFile(file: nsIFile): string;
    getURLSpecFromDir(file: nsIFile): string;
    getFileFromURLSpec(url: string): nsIFile;
    readURLFile(file: nsIFile): nsIURI;
    readShellLink(file: nsIFile): nsIURI;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/data/nsIDataChannel.idl

  interface nsIDataChannel extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIBackgroundChannelRegistrar.idl

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIBinaryHttp.idl

  interface nsIBinaryHttpRequest extends nsISupports {
    readonly method: string;
    readonly scheme: string;
    readonly authority: string;
    readonly path: string;
    readonly headerNames: string[];
    readonly headerValues: string[];
    readonly content: u8[];
  }

  interface nsIBinaryHttpResponse extends nsISupports {
    readonly status: u16;
    readonly headerNames: string[];
    readonly headerValues: string[];
    readonly content: u8[];
  }

  interface nsIBinaryHttp extends nsISupports {
    encodeRequest(request: nsIBinaryHttpRequest): u8[];
    decodeRequest(request: u8[]): nsIBinaryHttpRequest;
    decodeResponse(response: u8[]): nsIBinaryHttpResponse;
    encodeResponse(response: nsIBinaryHttpResponse): u8[];
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsICORSPreflightCache.idl

  interface nsICORSPreflightCache extends nsISupports {
    getEntries(principal: nsIPrincipal): nsICORSPreflightCacheEntry[];
    clearEntry(entry: nsICORSPreflightCacheEntry): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsICORSPreflightCacheEntry.idl

  interface nsICORSPreflightCacheEntry extends nsISupports {
    readonly key: string;
    readonly URI: nsIURI;
    readonly originAttributes: any;
    readonly principal: nsIPrincipal;
    readonly privateBrowsing: boolean;
    readonly withCredentials: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIEarlyHintObserver.idl

  interface nsIEarlyHintObserver extends nsISupports {
    earlyHint(linkHeader: string, referrerPolicy: string, cspHeader: string): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIHttpActivityObserver.idl

  interface nsIHttpActivityObserver extends nsISupports {
    readonly ACTIVITY_TYPE_SOCKET_TRANSPORT?: 1;
    readonly ACTIVITY_TYPE_HTTP_TRANSACTION?: 2;
    readonly ACTIVITY_TYPE_HTTP_CONNECTION?: 3;
    readonly ACTIVITY_SUBTYPE_REQUEST_HEADER?: 20481;
    readonly ACTIVITY_SUBTYPE_REQUEST_BODY_SENT?: 20482;
    readonly ACTIVITY_SUBTYPE_RESPONSE_START?: 20483;
    readonly ACTIVITY_SUBTYPE_RESPONSE_HEADER?: 20484;
    readonly ACTIVITY_SUBTYPE_RESPONSE_COMPLETE?: 20485;
    readonly ACTIVITY_SUBTYPE_TRANSACTION_CLOSE?: 20486;
    readonly ACTIVITY_SUBTYPE_PROXY_RESPONSE_HEADER?: 20487;
    readonly ACTIVITY_SUBTYPE_DNSANDSOCKET_CREATED?: 20488;
    readonly ACTIVITY_SUBTYPE_SPECULATIVE_DNSANDSOCKET_CREATED?: 20489;
    readonly ACTIVITY_SUBTYPE_ECH_SET?: 20490;
    readonly ACTIVITY_SUBTYPE_CONNECTION_CREATED?: 20491;
    readonly ACTIVITY_SUBTYPE_EARLYHINT_RESPONSE_HEADER?: 20492;

    observeActivity(
      aHttpChannel: nsISupports,
      aActivityType: u32,
      aActivitySubtype: u32,
      aTimestamp: PRTime,
      aExtraSizeData: u64,
      aExtraStringData: string
    ): void;
    readonly isActive: boolean;
    observeConnectionActivity(
      aHost: string,
      aPort: i32,
      aSSL: boolean,
      aHasECH: boolean,
      aIsHttp3: boolean,
      aActivityType: u32,
      aActivitySubtype: u32,
      aTimestamp: PRTime,
      aExtraStringData: string
    ): void;
  }

  interface nsIHttpActivityDistributor extends nsIHttpActivityObserver {
    addObserver(aObserver: nsIHttpActivityObserver): void;
    removeObserver(aObserver: nsIHttpActivityObserver): void;
    observeProxyResponse: boolean;
    observeConnection: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIHttpAuthManager.idl

  interface nsIHttpAuthManager extends nsISupports {
    getAuthIdentity(
      aScheme: string,
      aHost: string,
      aPort: i32,
      aAuthType: string,
      aRealm: string,
      aPath: string,
      aUserDomain: OutParam<string>,
      aUserName: OutParam<string>,
      aUserPassword: OutParam<string>,
      aIsPrivate?: boolean,
      aPrincipal?: nsIPrincipal
    ): void;
    setAuthIdentity(
      aScheme: string,
      aHost: string,
      aPort: i32,
      aAuthType: string,
      aRealm: string,
      aPath: string,
      aUserDomain: string,
      aUserName: string,
      aUserPassword: string,
      aIsPrivate?: boolean,
      aPrincipal?: nsIPrincipal
    ): void;
    clearAll(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIHttpAuthenticableChannel.idl

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIHttpAuthenticator.idl

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIHttpChannel.idl

  interface nsIHttpChannel extends nsIIdentChannel {
    requestMethod: string;
    referrerInfo: nsIReferrerInfo;
    readonly protocolVersion: string;
    readonly transferSize: u64;
    readonly requestSize: u64;
    readonly decodedBodySize: u64;
    readonly encodedBodySize: u64;
    getRequestHeader(aHeader: string): string;
    setRequestHeader(aHeader: string, aValue: string, aMerge: boolean): void;
    setNewReferrerInfo(
      aUrl: string,
      aPolicy: nsIReferrerInfo.ReferrerPolicyIDL,
      aSendReferrer: boolean
    ): void;
    setEmptyRequestHeader(aHeader: string): void;
    visitRequestHeaders(aVisitor: nsIHttpHeaderVisitor): void;
    visitNonDefaultRequestHeaders(aVisitor: nsIHttpHeaderVisitor): void;
    ShouldStripRequestBodyHeader(aMethod: string): boolean;
    allowSTS: boolean;
    redirectionLimit: u32;
    readonly responseStatus: u32;
    readonly responseStatusText: string;
    readonly requestSucceeded: boolean;
    isMainDocumentChannel: boolean;
    getResponseHeader(header: string): string;
    setResponseHeader(header: string, value: string, merge: boolean): void;
    visitResponseHeaders(aVisitor: nsIHttpHeaderVisitor): void;
    getOriginalResponseHeader(aHeader: string, aVisitor: nsIHttpHeaderVisitor): void;
    visitOriginalResponseHeaders(aVisitor: nsIHttpHeaderVisitor): void;
    isNoStoreResponse(): boolean;
    isNoCacheResponse(): boolean;
    isPrivateResponse(): boolean;
    redirectTo(aTargetURI: nsIURI): void;
    upgradeToSecure(): void;
    topLevelContentWindowId: u64;
    browserId: u64;
    logBlockedCORSRequest(aMessage: string, aCategory: string, aIsWarning: boolean): void;
    logMimeTypeMismatch(
      aMessageName: string,
      aWarning: boolean,
      aURL: string,
      aContentType: string
    ): void;
    classicScriptHintCharset: string;
    documentCharacterSet: string;
    requestObserversCalled: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIHttpChannelAuthProvider.idl

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIHttpChannelChild.idl

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIHttpChannelInternal.idl

  interface nsIHttpUpgradeListener extends nsISupports {
    onTransportAvailable(
      aTransport: nsISocketTransport,
      aSocketIn: nsIAsyncInputStream,
      aSocketOut: nsIAsyncOutputStream
    ): void;
    onUpgradeFailed(aErrorCode: nsresult): void;
  }

  interface nsIHttpChannelInternal extends nsISupports {
    readonly THIRD_PARTY_FORCE_ALLOW?: 1;
    readonly TLS_FLAG_CONFIGURE_AS_RETRY?: 65536;
    readonly REDIRECT_MODE_FOLLOW?: 0;
    readonly REDIRECT_MODE_ERROR?: 1;
    readonly REDIRECT_MODE_MANUAL?: 2;
    readonly FETCH_CACHE_MODE_DEFAULT?: 0;
    readonly FETCH_CACHE_MODE_NO_STORE?: 1;
    readonly FETCH_CACHE_MODE_RELOAD?: 2;
    readonly FETCH_CACHE_MODE_NO_CACHE?: 3;
    readonly FETCH_CACHE_MODE_FORCE_CACHE?: 4;
    readonly FETCH_CACHE_MODE_ONLY_IF_CACHED?: 5;

    documentURI: nsIURI;
    getRequestVersion(major: OutParam<u32>, minor: OutParam<u32>): void;
    getResponseVersion(major: OutParam<u32>, minor: OutParam<u32>): void;
    setCookieHeaders(aCookieHeaders: string[]): void;
    thirdPartyFlags: u32;
    forceAllowThirdPartyCookie: boolean;
    channelIsForDownload: boolean;
    readonly localAddress: string;
    readonly localPort: i32;
    readonly remoteAddress: string;
    readonly remotePort: i32;
    HTTPUpgrade(aProtocolName: string, aListener: nsIHttpUpgradeListener): void;
    setConnectOnly(tlsTunnel: boolean): void;
    readonly onlyConnect: boolean;
    allowSpdy: boolean;
    allowHttp3: boolean;
    responseTimeoutEnabled: boolean;
    initialRwin: u32;
    readonly apiRedirectToURI: nsIURI;
    allowAltSvc: boolean;
    beConservative: boolean;
    bypassProxy: boolean;
    readonly isResolvedByTRR: boolean;
    readonly effectiveTRRMode: nsIRequest.TRRMode;
    readonly trrSkipReason: nsITRRSkipReason.value;
    readonly isLoadedBySocketProcess: boolean;
    isOCSP: boolean;
    tlsFlags: u32;
    readonly lastModifiedTime: PRTime;
    corsIncludeCredentials: boolean;
    redirectMode: u32;
    fetchCacheMode: u32;
    readonly topWindowURI: nsIURI;
    setTopWindowURIIfUnknown(topWindowURI: nsIURI): void;
    readonly proxyURI: nsIURI;
    blockAuthPrompt: boolean;
    integrityMetadata: string;
    readonly connectionInfoHashKey: string;
    setIPv4Disabled(): void;
    setIPv6Disabled(): void;
    readonly crossOriginOpenerPolicy: nsILoadInfo.CrossOriginOpenerPolicy;
    readonly supportsHTTP3: boolean;
    readonly hasHTTPSRR: boolean;
    setEarlyHintObserver(aObserver: nsIEarlyHintObserver): void;
    earlyHintPreloaderId: u64;
    readonly isProxyUsed: boolean;
    setWebTransportSessionEventListener(aListener: WebTransportSessionEventListener): void;
    earlyHintLinkType: u32;
    isUserAgentHeaderModified: boolean;
    setResponseOverride(aReplacedHttpResponse: nsIReplacedHttpResponse): void;
    setResponseStatus(aStatus: u32, aStatusText: string): void;
    readonly lastTransportStatus: nsresult;
    transparentRedirectTo(aTargetURI: nsIURI): void;
    readonly caps: u32;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIHttpHeaderVisitor.idl

  type nsIHttpHeaderVisitor = Callable<{
    visitHeader(aHeader: string, aValue: string): void;
  }>;

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIHttpProtocolHandler.idl

  interface nsIHttpProtocolHandler extends nsIProxiedProtocolHandler {
    readonly userAgent: string;
    readonly rfpUserAgent: string;
    readonly appName: string;
    readonly appVersion: string;
    readonly platform: string;
    readonly oscpu: string;
    readonly misc: string;
    readonly altSvcCacheKeys: string[];
    readonly authCacheKeys: string[];
    EnsureHSTSDataReady(): Promise<any>;
    clearCORSPreflightCache(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsINetworkErrorLogging.idl

  interface nsINetworkErrorLogging extends nsISupports {
    registerPolicy(aChannel: nsIHttpChannel): void;
    generateNELReport(aChannel: nsIHttpChannel): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIObliviousHttp.idl

  interface nsIObliviousHttpClientResponse extends nsISupports {
    decapsulate(encResponse: u8[]): u8[];
  }

  interface nsIObliviousHttpClientRequest extends nsISupports {
    readonly encRequest: u8[];
    readonly response: nsIObliviousHttpClientResponse;
  }

  interface nsIObliviousHttpServerResponse extends nsISupports {
    readonly request: u8[];
    encapsulate(response: u8[]): u8[];
  }

  interface nsIObliviousHttpServer extends nsISupports {
    readonly encodedConfig: u8[];
    decapsulate(encRequest: u8[]): nsIObliviousHttpServerResponse;
  }

  interface nsIObliviousHttp extends nsISupports {
    encapsulateRequest(encodedConfig: u8[], request: u8[]): nsIObliviousHttpClientRequest;
    server(): nsIObliviousHttpServer;
    decodeConfigList(encodedConfigList: u8[]): u8[][];
  }

  interface nsIObliviousHttpService extends nsISupports {
    newChannel(relayURI: nsIURI, targetURI: nsIURI, encodedConfig: u8[]): nsIChannel;
    getTRRSettings(relayURI: OutParam<nsIURI>, encodedConfig: OutParam<u8[]>): void;
    clearTRRConfig(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIObliviousHttpChannel.idl

  interface nsIObliviousHttpChannel extends nsIHttpChannel {
    readonly relayChannel: nsIHttpChannel;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIRaceCacheWithNetwork.idl

  interface nsIRaceCacheWithNetwork extends nsISupports {
    allowRacing: boolean;
    test_triggerNetwork(timeout: i32): void;
    test_delayCacheEntryOpeningBy(timeout: i32): void;
    test_triggerDelayedOpenCacheEntry(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIReplacedHttpResponse.idl

  interface nsIReplacedHttpResponse extends nsISupports {
    init(): void;
    responseBody: string;
    responseStatus: u32;
    responseStatusText: string;
    visitResponseHeaders(visitor: nsIHttpHeaderVisitor): void;
    setResponseHeader(header: string, value: string, merge: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsITlsHandshakeListener.idl

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/http/nsIWellKnownOpportunisticUtils.idl

  interface nsIWellKnownOpportunisticUtils extends nsISupports {
    verify(aJSON: string, aOrigin: string): void;
    readonly valid: boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/streamconv/converters/nsICompressConvStats.idl

  interface nsICompressConvStats extends nsISupports {
    readonly decodedDataLength: u64;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/res/nsIResProtocolHandler.idl

  interface nsIResProtocolHandler extends nsISubstitutingProtocolHandler {
    allowContentToAccess(url: nsIURI): boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/res/nsISubstitutingProtocolHandler.idl

  interface nsISubstitutingProtocolHandler extends nsIProtocolHandler {
    readonly ALLOW_CONTENT_ACCESS?: 1;
    readonly RESOLVE_JAR_URI?: 2;

    setSubstitution(root: string, baseURI: nsIURI): void;
    setSubstitutionWithFlags(root: string, baseURI: nsIURI, flags: u32): void;
    getSubstitution(root: string): nsIURI;
    hasSubstitution(root: string): boolean;
    resolveURI(resURI: nsIURI): string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/socket/nsISocketProvider.idl

  interface nsISocketProvider extends nsISupports {
    readonly PROXY_RESOLVES_HOST?: 1;
    readonly ANONYMOUS_CONNECT?: 2;
    readonly NO_PERMANENT_STORAGE?: 4;
    readonly BE_CONSERVATIVE?: 8;
    readonly ANONYMOUS_CONNECT_ALLOW_CLIENT_CERT?: 16;
    readonly IS_SPECULATIVE_CONNECTION?: 32;
    readonly DONT_TRY_ECH?: 1024;
    readonly IS_RETRY?: 2048;
    readonly USED_PRIVATE_DNS?: 4096;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/socket/nsISocketProviderService.idl

  interface nsISocketProviderService extends nsISupports {
    getSocketProvider(socketType: string): nsISocketProvider;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/streamconv/mozITXTToHTMLConv.idl

  interface mozITXTToHTMLConv extends nsIStreamConverter {
    readonly kEntities?: 0;
    readonly kURLs?: 2;
    readonly kGlyphSubstitution?: 4;
    readonly kStructPhrase?: 8;

    scanTXT(text: string, whattodo: u32): string;
    scanHTML(text: string, whattodo: u32): string;
    citeLevelTXT(line: string, logLineStart: OutParam<u32>): u32;
    findURLInPlaintext(
      text: string,
      aLength: i32,
      aPos: i32,
      aStartPos: OutParam<i32>,
      aEndPos: OutParam<i32>
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/streamconv/nsIDirIndex.idl

  interface nsIDirIndex extends nsISupports {
    readonly TYPE_UNKNOWN?: 0;
    readonly TYPE_DIRECTORY?: 1;
    readonly TYPE_FILE?: 2;
    readonly TYPE_SYMLINK?: 3;

    type: u32;
    location: string;
    size: i64;
    lastModified: PRTime;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/streamconv/nsIDirIndexListener.idl

  interface nsIDirIndexListener extends nsISupports {
    onIndexAvailable(aRequest: nsIRequest, aIndex: nsIDirIndex): void;
  }

  interface nsIDirIndexParser extends nsIStreamListener {
    listener: nsIDirIndexListener;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/streamconv/nsIStreamConverter.idl

  interface nsIStreamConverter extends nsIThreadRetargetableStreamListener {
    convert(
      aFromStream: nsIInputStream,
      aFromType: string,
      aToType: string,
      aCtxt: nsISupports
    ): nsIInputStream;
    asyncConvertData(
      aFromType: string,
      aToType: string,
      aListener: nsIStreamListener,
      aCtxt: nsISupports
    ): void;
    maybeRetarget(request: nsIRequest): void;
    getConvertedType(aFromType: string, aChannel: nsIChannel): string;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/streamconv/nsIStreamConverterService.idl

  interface nsIStreamConverterService extends nsISupports {
    canConvert(aFromType: string, aToType: string): boolean;
    convertedType(aFromType: string, aChannel: nsIChannel): string;
    convert(
      aFromStream: nsIInputStream,
      aFromType: string,
      aToType: string,
      aContext: nsISupports
    ): nsIInputStream;
    asyncConvertData(
      aFromType: string,
      aToType: string,
      aListener: nsIStreamListener,
      aContext: nsISupports
    ): nsIStreamListener;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/streamconv/nsITXTToHTMLConv.idl

  interface nsITXTToHTMLConv extends nsIStreamConverter {
    setTitle(text: string): void;
    preFormatHTML(value: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/viewsource/nsIViewSourceChannel.idl

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/websocket/nsITransportProvider.idl

  interface nsITransportProvider extends nsISupports {
    setListener(listener: nsIHttpUpgradeListener): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/websocket/nsIWebSocketChannel.idl

  interface nsIWebSocketChannel extends nsISupports {
    readonly CLOSE_NORMAL?: 1000;
    readonly CLOSE_GOING_AWAY?: 1001;
    readonly CLOSE_PROTOCOL_ERROR?: 1002;
    readonly CLOSE_UNSUPPORTED_DATATYPE?: 1003;
    readonly CLOSE_NO_STATUS?: 1005;
    readonly CLOSE_ABNORMAL?: 1006;
    readonly CLOSE_INVALID_PAYLOAD?: 1007;
    readonly CLOSE_POLICY_VIOLATION?: 1008;
    readonly CLOSE_TOO_LARGE?: 1009;
    readonly CLOSE_EXTENSION_MISSING?: 1010;
    readonly CLOSE_INTERNAL_ERROR?: 1011;
    readonly CLOSE_TLS_FAILED?: 1015;

    readonly originalURI: nsIURI;
    readonly URI: nsIURI;
    notificationCallbacks: nsIInterfaceRequestor;
    readonly securityInfo: nsITransportSecurityInfo;
    loadGroup: nsILoadGroup;
    loadInfo: nsILoadInfo;
    protocol: string;
    readonly extensions: string;
    readonly httpChannelId: u64;
    initLoadInfo(
      aLoadingNode: Node,
      aLoadingPrincipal: nsIPrincipal,
      aTriggeringPrincipal: nsIPrincipal,
      aSecurityFlags: u32,
      aContentPolicyType: nsContentPolicyType
    ): void;
    asyncOpen(
      aURI: nsIURI,
      aOrigin: string,
      aOriginAttributes: any,
      aInnerWindowID: u64,
      aListener: nsIWebSocketListener,
      aContext: nsISupports
    ): void;
    close(aCode: u16, aReason: string): void;
    sendMsg(aMsg: string): void;
    sendBinaryMsg(aMsg: string): void;
    sendBinaryStream(aStream: nsIInputStream, length: u32): void;
    pingInterval: u32;
    pingTimeout: u32;
    serial: u32;
    setServerParameters(aProvider: nsITransportProvider, aNegotiatedExtensions: string): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/websocket/nsIWebSocketEventService.idl

  interface nsIWebSocketFrame extends nsISupports {
    readonly OPCODE_CONTINUATION?: 0;
    readonly OPCODE_TEXT?: 1;
    readonly OPCODE_BINARY?: 2;
    readonly OPCODE_CLOSE?: 8;
    readonly OPCODE_PING?: 9;
    readonly OPCODE_PONG?: 10;

    readonly timeStamp: DOMHighResTimeStamp;
    readonly finBit: boolean;
    readonly rsvBit1: boolean;
    readonly rsvBit2: boolean;
    readonly rsvBit3: boolean;
    readonly opCode: u16;
    readonly maskBit: boolean;
    readonly mask: u32;
    readonly payload: string;
  }

  interface nsIWebSocketEventListener extends nsISupports {
    readonly TYPE_STRING?: 0;
    readonly TYPE_BLOB?: 1;
    readonly TYPE_ARRAYBUFFER?: 2;

    webSocketCreated(aWebSocketSerialID: u32, aURI: string, aProtocols: string): void;
    webSocketOpened(
      aWebSocketSerialID: u32,
      aEffectiveURI: string,
      aProtocols: string,
      aExtensions: string,
      aHttpChannelId: u64
    ): void;
    webSocketMessageAvailable(aWebSocketSerialID: u32, aMessage: string, aType: u16): void;
    webSocketClosed(aWebSocketSerialID: u32, aWasClean: boolean, aCode: u16, aReason: string): void;
    frameReceived(aWebSocketSerialID: u32, aFrame: nsIWebSocketFrame): void;
    frameSent(aWebSocketSerialID: u32, aFrame: nsIWebSocketFrame): void;
  }

  interface nsIWebSocketEventService extends nsISupports {
    sendMessage(aWebSocketSerialID: u32, aMessage: string): void;
    addListener(aInnerWindowID: u64, aListener: nsIWebSocketEventListener): void;
    removeListener(aInnerWindowID: u64, aListener: nsIWebSocketEventListener): void;
    hasListenerFor(aInnerWindowID: u64): boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/websocket/nsIWebSocketImpl.idl

  interface nsIWebSocketImpl extends nsISupports {
    sendMessage(aMessage: string): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/websocket/nsIWebSocketListener.idl

  interface nsIWebSocketListener extends nsISupports {
    onStart(aContext: nsISupports): void;
    onStop(aContext: nsISupports, aStatusCode: nsresult): void;
    onMessageAvailable(aContext: nsISupports, aMsg: string): void;
    onBinaryMessageAvailable(aContext: nsISupports, aMsg: string): void;
    onAcknowledge(aContext: nsISupports, aSize: u32): void;
    onServerClose(aContext: nsISupports, aCode: u16, aReason: string): void;
    OnError(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/webtransport/nsIWebTransport.idl
} // global

declare enum nsIWebTransport_WebTransportError {
  UNKNOWN_ERROR = 0,
  INVALID_STATE_ERROR = 1,
}

declare enum nsIWebTransport_HTTPVersion {
  h3 = 0,
  h2 = 1,
}

declare global {
  namespace nsIWebTransport {
    type WebTransportError = nsIWebTransport_WebTransportError;
    type HTTPVersion = nsIWebTransport_HTTPVersion;
  }

  interface nsIWebTransport
    extends nsISupports,
      Enums<typeof nsIWebTransport_WebTransportError & typeof nsIWebTransport_HTTPVersion> {
    asyncConnect(
      aURI: nsIURI,
      aDedicated: boolean,
      aServerCertHashes: nsIWebTransportHash[],
      aLoadingPrincipal: nsIPrincipal,
      aSecurityFlags: u32,
      aListener: WebTransportSessionEventListener,
      aVersion?: nsIWebTransport.HTTPVersion
    ): void;
    getStats(): void;
    closeSession(aErrorCode: u32, aReason: string): void;
    createOutgoingBidirectionalStream(aListener: nsIWebTransportStreamCallback): void;
    createOutgoingUnidirectionalStream(aListener: nsIWebTransportStreamCallback): void;
    sendDatagram(aData: u8[], aTrackingId: u64): void;
    getMaxDatagramSize(): void;
  }
} // global

declare enum WebTransportSessionEventListener_DatagramOutcome {
  UNKNOWN = 0,
  DROPPED_TOO_MUCH_DATA = 1,
  SENT = 2,
}

declare global {
  namespace WebTransportSessionEventListener {
    type DatagramOutcome = WebTransportSessionEventListener_DatagramOutcome;
  }

  interface WebTransportSessionEventListener
    extends nsISupports,
      Enums<typeof WebTransportSessionEventListener_DatagramOutcome> {
    onSessionReady(aSessionId: u64): void;
    onSessionClosed(aCleanly: boolean, aErrorCode: u32, aReason: string): void;
    onIncomingBidirectionalStreamAvailable(aStream: nsIWebTransportBidirectionalStream): void;
    onIncomingUnidirectionalStreamAvailable(aStream: nsIWebTransportReceiveStream): void;
    onStopSending(aStreamId: u64, aError: nsresult): void;
    onResetReceived(aStreamId: u64, aError: nsresult): void;
    onDatagramReceived(aData: u8[]): void;
    onMaxDatagramSize(aSize: u64): void;
    onOutgoingDatagramOutCome(
      aId: u64,
      aOutCome: WebTransportSessionEventListener.DatagramOutcome
    ): void;
  }

  interface nsIWebTransportStreamCallback extends nsISupports {
    onBidirectionalStreamReady(aStream: nsIWebTransportBidirectionalStream): void;
    onUnidirectionalStreamReady(aStream: nsIWebTransportSendStream): void;
    onError(aError: u8): void;
  }

  interface nsIWebTransportHash extends nsISupports {
    readonly algorithm: string;
    readonly value: u8[];
  }

  // https://searchfox.org/mozilla-central/source/netwerk/protocol/webtransport/nsIWebTransportStream.idl

  interface nsIWebTransportSendStreamStats extends nsISupports {
    readonly bytesSent: u64;
    readonly bytesAcknowledged: u64;
  }

  interface nsIWebTransportReceiveStreamStats extends nsISupports {
    readonly bytesReceived: u64;
  }

  interface nsIWebTransportStreamStatsCallback extends nsISupports {
    onSendStatsAvailable(aStats: nsIWebTransportSendStreamStats): void;
    onReceiveStatsAvailable(aStats: nsIWebTransportReceiveStreamStats): void;
  }

  interface nsIWebTransportReceiveStream extends nsISupports {
    sendStopSending(aError: u8): void;
    getReceiveStreamStats(aCallback: nsIWebTransportStreamStatsCallback): void;
    readonly hasReceivedFIN: boolean;
    readonly inputStream: nsIAsyncInputStream;
    readonly streamId: u64;
  }

  interface nsIWebTransportSendStream extends nsISupports {
    sendFin(): void;
    reset(aErrorCode: u8): void;
    getSendStreamStats(aCallback: nsIWebTransportStreamStatsCallback): void;
    readonly outputStream: nsIAsyncOutputStream;
    readonly streamId: u64;
  }

  interface nsIWebTransportBidirectionalStream extends nsISupports {
    sendStopSending(aError: u8): void;
    sendFin(): void;
    reset(aErrorCode: u8): void;
    readonly hasReceivedFIN: boolean;
    readonly inputStream: nsIAsyncInputStream;
    readonly outputStream: nsIAsyncOutputStream;
    readonly streamId: u64;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/wifi/nsIWifiAccessPoint.idl

  interface nsIWifiAccessPoint extends nsISupports {
    readonly mac: string;
    readonly ssid: string;
    readonly rawSSID: string;
    readonly signal: i32;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/wifi/nsIWifiListener.idl

  interface nsIWifiListener extends nsISupports {
    onChange(accessPoints: nsIWifiAccessPoint[]): void;
    onError(error: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/wifi/nsIWifiMonitor.idl

  interface nsIWifiMonitor extends nsISupports {
    startWatching(aListener: nsIWifiListener, aForcePolling: boolean): void;
    stopWatching(aListener: nsIWifiListener): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/parentalcontrols/nsIParentalControlsService.idl

  interface nsIParentalControlsService extends nsISupports {
    readonly DOWNLOAD?: 1;
    readonly INSTALL_EXTENSION?: 2;
    readonly INSTALL_APP?: 3;
    readonly BROWSE?: 4;
    readonly SHARE?: 5;
    readonly BOOKMARK?: 6;
    readonly ADD_CONTACT?: 7;
    readonly SET_IMAGE?: 8;
    readonly MODIFY_ACCOUNTS?: 9;
    readonly REMOTE_DEBUGGING?: 10;
    readonly IMPORT_SETTINGS?: 11;
    readonly PRIVATE_BROWSING?: 12;
    readonly DATA_CHOICES?: 13;
    readonly CLEAR_HISTORY?: 14;
    readonly MASTER_PASSWORD?: 15;
    readonly GUEST_BROWSING?: 16;
    readonly ADVANCED_SETTINGS?: 17;
    readonly CAMERA_MICROPHONE?: 18;
    readonly BLOCK_LIST?: 19;
    readonly TELEMETRY?: 20;
    readonly HEALTH_REPORT?: 21;
    readonly DEFAULT_THEME?: 22;
    readonly ePCLog_URIVisit?: 1;
    readonly ePCLog_FileDownload?: 2;

    readonly parentalControlsEnabled: boolean;
    readonly blockFileDownloadsEnabled: boolean;
    isAllowed(aAction: i16, aUri?: nsIURI): boolean;
    readonly loggingEnabled: boolean;
    log(aEntryType: i16, aFlag: boolean, aSource: nsIURI, aTarget?: nsIFile): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/bridge/IPeerConnection.idl

  interface IPeerConnectionObserver extends nsISupports {}

  interface IPeerConnection extends nsISupports {
    readonly kHintAudio?: 1;
    readonly kHintVideo?: 2;
    readonly kActionNone?: -1;
    readonly kActionOffer?: 0;
    readonly kActionAnswer?: 1;
    readonly kActionPRAnswer?: 2;
    readonly kActionRollback?: 3;
    readonly kIceGathering?: 0;
    readonly kIceWaiting?: 1;
    readonly kIceChecking?: 2;
    readonly kIceConnected?: 3;
    readonly kIceFailed?: 4;
    readonly kNew?: 0;
    readonly kNegotiating?: 1;
    readonly kActive?: 2;
    readonly kClosing?: 3;
    readonly kClosed?: 4;
    readonly kDataChannelReliable?: 0;
    readonly kDataChannelPartialReliableRexmit?: 1;
    readonly kDataChannelPartialReliableTimed?: 2;
    readonly kNoError?: 0;
    readonly kInvalidCandidate?: 2;
    readonly kInvalidMediastreamTrack?: 3;
    readonly kInvalidState?: 4;
    readonly kInvalidSessionDescription?: 5;
    readonly kIncompatibleSessionDescription?: 6;
    readonly kIncompatibleMediaStreamTrack?: 8;
    readonly kInternalError?: 9;
    readonly kTypeError?: 10;
    readonly kOperationError?: 11;
    readonly kMaxErrorType?: 11;
  }

  // https://searchfox.org/mozilla-central/source/extensions/permissions/nsIRemotePermissionService.idl

  interface nsIRemotePermissionService extends nsISupports {
    init(): void;
    readonly isInitialized: Promise<any>;
    testAllowedPermissionValues: any;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsICertOverrideService.idl

  interface nsICertOverride extends nsISupports {
    readonly asciiHost: string;
    readonly port: i32;
    readonly hostPort: string;
    readonly fingerprint: string;
    readonly originAttributes: any;
  }

  interface nsICertOverrideService extends nsISupports {
    rememberValidityOverride(
      aHostName: string,
      aPort: i32,
      aOriginAttributes: any,
      aCert: nsIX509Cert,
      aTemporary: boolean
    ): void;
    hasMatchingOverride(
      aHostName: string,
      aPort: i32,
      aOriginAttributes: any,
      aCert: nsIX509Cert,
      aIsTemporary: OutParam<boolean>
    ): boolean;
    clearValidityOverride(aHostName: string, aPort: i32, aOriginAttributes: any): void;
    clearAllOverrides(): void;
    getOverrides(): nsICertOverride[];
    setDisableAllSecurityChecksAndLetAttackersInterceptMyData(aDisable: boolean): void;
    readonly securityCheckDisabled: boolean;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsICertStorage.idl

  type nsICertStorageCallback = Callable<{
    done(rv: nsresult, result: nsIVariant): void;
  }>;

  interface nsIRevocationState extends nsISupports {
    readonly state: i16;
  }

  interface nsIIssuerAndSerialRevocationState extends nsIRevocationState {
    readonly issuer: string;
    readonly serial: string;
  }

  interface nsISubjectAndPubKeyRevocationState extends nsIRevocationState {
    readonly subject: string;
    readonly pubKey: string;
  }

  interface nsICertInfo extends nsISupports {
    readonly cert: string;
    readonly subject: string;
    readonly trust: i16;
  }

  interface nsICertStorage extends nsISupports {
    readonly DATA_TYPE_REVOCATION?: 1;
    readonly DATA_TYPE_CERTIFICATE?: 2;
    readonly DATA_TYPE_CRLITE?: 3;
    readonly DATA_TYPE_CRLITE_FILTER_FULL?: 4;
    readonly DATA_TYPE_CRLITE_FILTER_INCREMENTAL?: 5;
    readonly STATE_UNSET?: 0;
    readonly STATE_ENFORCE?: 1;
    readonly STATE_NOT_ENROLLED?: 2;
    readonly STATE_NOT_COVERED?: 3;
    readonly STATE_NO_FILTER?: 4;
    readonly TRUST_INHERIT?: 0;
    readonly TRUST_ANCHOR?: 1;

    hasPriorData(type: u8, callback: nsICertStorageCallback): void;
    setRevocations(revocations: nsIRevocationState[], callback: nsICertStorageCallback): void;
    getRevocationState(issuer: u8[], serial: u8[], subject: u8[], pubkey: u8[]): i16;
    setFullCRLiteFilter(filter: u8[], callback: nsICertStorageCallback): void;
    addCRLiteDelta(delta: u8[], filename: string, callback: nsICertStorageCallback): void;
    testNoteCRLiteUpdateTime(callback: nsICertStorageCallback): void;
    addCerts(certs: nsICertInfo[], callback: nsICertStorageCallback): void;
    removeCertsByHashes(hashes: string[], callback: nsICertStorageCallback): void;
    findCertsBySubject(subject: u8[]): u8[][];
    GetRemainingOperationCount(): i32;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsICertTree.idl

  interface nsICertTreeItem extends nsISupports {
    readonly cert: nsIX509Cert;
  }

  interface nsICertTree extends nsITreeView {
    loadCertsFromCache(cache: nsIX509Cert[], type: u32): void;
    getCert(index: u32): nsIX509Cert;
    getTreeItem(index: u32): nsICertTreeItem;
    deleteEntryObject(index: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsICertificateDialogs.idl

  interface nsICertificateDialogs extends nsISupports {
    confirmDownloadCACert(
      ctx: nsIInterfaceRequestor,
      cert: nsIX509Cert,
      trust: OutParam<u32>
    ): boolean;
    setPKCS12FilePassword(ctx: nsIInterfaceRequestor, password: OutParam<string>): boolean;
    getPKCS12FilePassword(ctx: nsIInterfaceRequestor, password: OutParam<string>): boolean;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIClientAuthDialogService.idl

  type nsIClientAuthDialogCallback = Callable<{
    certificateChosen(
      cert: nsIX509Cert,
      rememberDuration: nsIClientAuthRememberService.Duration
    ): void;
  }>;

  interface nsIClientAuthDialogService extends nsISupports {
    chooseCertificate(
      hostname: string,
      certArray: nsIX509Cert[],
      loadContext: nsILoadContext,
      callback: nsIClientAuthDialogCallback
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIClientAuthRememberService.idl

  interface nsIClientAuthRememberRecord extends nsISupports {
    readonly asciiHost: string;
    readonly dbKey: string;
    readonly entryKey: string;
  }
} // global

declare enum nsIClientAuthRememberService_Duration {
  Once = 0,
  Permanent = 1,
  Session = 2,
}

declare global {
  namespace nsIClientAuthRememberService {
    type Duration = nsIClientAuthRememberService_Duration;
  }

  interface nsIClientAuthRememberService
    extends nsISupports,
      Enums<typeof nsIClientAuthRememberService_Duration> {
    forgetRememberedDecision(key: string): void;
    getDecisions(): nsIClientAuthRememberRecord[];
    rememberDecisionScriptable(
      aHostName: string,
      originAttributes: any,
      aClientCert: nsIX509Cert,
      aDuration: nsIClientAuthRememberService.Duration
    ): void;
    hasRememberedDecisionScriptable(
      aHostName: string,
      originAttributes: any,
      aCertDBKey: OutParam<string>
    ): boolean;
    clearRememberedDecisions(): void;
    deleteDecisionsByHost(aHostName: string, aOriginAttributes: any): void;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIContentSignatureVerifier.idl

  interface nsIContentSignatureVerifier extends nsISupports {
    readonly ContentSignatureProdRoot?: 1;
    readonly ContentSignatureStageRoot?: 2;
    readonly ContentSignatureDevRoot?: 3;
    readonly ContentSignatureLocalRoot?: 4;

    asyncVerifyContentSignature(
      aData: string,
      aContentSignatureHeader: string,
      aCertificateChain: string,
      aHostname: string,
      aTrustedRoot: AppTrustedRoot
    ): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsICryptoHash.idl

  interface nsICryptoHash extends nsISupports {
    readonly MD5?: 2;
    readonly SHA1?: 3;
    readonly SHA256?: 4;
    readonly SHA384?: 5;
    readonly SHA512?: 6;

    init(aAlgorithm: u32): void;
    initWithString(aAlgorithm: string): void;
    update(aData: u8[], aLen: u32): void;
    updateFromStream(aStream: nsIInputStream, aLen: u32): void;
    finish(aASCII: boolean): string;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIDataStorage.idl
} // global

declare enum nsIDataStorageManager_DataStorage {
  AlternateServices = 0,
  ClientAuthRememberList = 1,
  SiteSecurityServiceState = 2,
}

declare global {
  namespace nsIDataStorageManager {
    type DataStorage = nsIDataStorageManager_DataStorage;
  }

  interface nsIDataStorageManager
    extends nsISupports,
      Enums<typeof nsIDataStorageManager_DataStorage> {
    get(dataStorage: nsIDataStorageManager.DataStorage): nsIDataStorage;
  }
} // global

declare enum nsIDataStorage_DataType {
  Persistent = 0,
  Private = 1,
  Temporary = 2,
}

declare global {
  namespace nsIDataStorage {
    type DataType = nsIDataStorage_DataType;
  }

  interface nsIDataStorage extends nsISupports, Enums<typeof nsIDataStorage_DataType> {
    get(key: string, type: nsIDataStorage.DataType): string;
    put(key: string, value: string, type: nsIDataStorage.DataType): void;
    remove(key: string, type: nsIDataStorage.DataType): void;
    clear(): void;
    isReady(): boolean;
    getAll(): nsIDataStorageItem[];
  }

  interface nsIDataStorageItem extends nsISupports {
    readonly key: string;
    readonly value: string;
    readonly type: nsIDataStorage.DataType;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsINSSComponent.idl

  interface nsINSSComponent extends nsISupports {
    getEnterpriseRoots(): u8[][];
    getEnterpriseRootsPEM(): string;
    getEnterpriseIntermediates(): u8[][];
    getEnterpriseIntermediatesPEM(): string;
    addEnterpriseIntermediate(intermediateBytes: u8[]): void;
    clearSSLExternalAndInternalSessionCache(): void;
    asyncClearSSLExternalAndInternalSessionCache(): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsINSSErrorsService.idl

  interface nsINSSErrorsService extends nsISupports {
    readonly ERROR_CLASS_SSL_PROTOCOL?: 1;
    readonly ERROR_CLASS_BAD_CERT?: 2;
    readonly NSS_SEC_ERROR_BASE?: -8192;
    readonly NSS_SEC_ERROR_LIMIT?: -7192;
    readonly NSS_SSL_ERROR_BASE?: -12288;
    readonly NSS_SSL_ERROR_LIMIT?: -11288;
    readonly MOZILLA_PKIX_ERROR_BASE?: -16384;
    readonly MOZILLA_PKIX_ERROR_LIMIT?: -15384;

    isNSSErrorCode(aNSPRCode: i32): boolean;
    getXPCOMFromNSSError(aNSPRCode: i32): nsresult;
    getErrorMessage(aXPCOMErrorCode: nsresult): string;
    getErrorName(aXPCOMErrorCode: nsresult): string;
    getErrorClass(aXPCOMErrorCode: nsresult): u32;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsINSSVersion.idl

  interface nsINSSVersion extends nsISupports {
    readonly NSPR_MinVersion: string;
    readonly NSS_MinVersion: string;
    readonly NSSUTIL_MinVersion: string;
    readonly NSSSSL_MinVersion: string;
    readonly NSSSMIME_MinVersion: string;
    readonly NSPR_Version: string;
    readonly NSS_Version: string;
    readonly NSSUTIL_Version: string;
    readonly NSSSSL_Version: string;
    readonly NSSSMIME_Version: string;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIOSKeyStore.idl

  interface nsIOSKeyStore extends nsISupports {
    asyncGenerateSecret(label: string): Promise<any>;
    asyncSecretAvailable(label: string): Promise<any>;
    asyncRecoverSecret(label: string, recoveryPhrase: string): Promise<any>;
    asyncDeleteSecret(label: string): Promise<any>;
    asyncEncryptBytes(label: string, inBytes: u8[]): Promise<any>;
    asyncDecryptBytes(label: string, encryptedBase64Text: string): Promise<any>;
    asyncGetRecoveryPhrase(aLabel: string): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIOSReauthenticator.idl

  interface nsIOSReauthenticator extends nsISupports {
    asyncReauthenticateUser(
      prompt: string,
      caption: string,
      parentWindow: mozIDOMWindow
    ): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIPK11Token.idl

  interface nsIPK11Token extends nsISupports {
    readonly tokenName: string;
    readonly isInternalKeyToken: boolean;
    readonly tokenManID: string;
    readonly tokenHWVersion: string;
    readonly tokenFWVersion: string;
    readonly tokenSerialNumber: string;
    isLoggedIn(): boolean;
    login(force: boolean): void;
    logoutSimple(): void;
    logoutAndDropAuthenticatedResources(): void;
    needsLogin(): boolean;
    readonly needsUserInit: boolean;
    reset(): void;
    checkPassword(password: string): boolean;
    initPassword(initialPassword: string): void;
    changePassword(oldPassword: string, newPassword: string): void;
    readonly hasPassword: boolean;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIPK11TokenDB.idl

  interface nsIPK11TokenDB extends nsISupports {
    getInternalKeyToken(): nsIPK11Token;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIPKCS11Module.idl

  interface nsIPKCS11Module extends nsISupports {
    readonly name: string;
    readonly libName: string;
    listSlots(): nsISimpleEnumerator;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIPKCS11ModuleDB.idl

  interface nsIPKCS11ModuleDB extends nsISupports {
    deleteModule(moduleName: string): void;
    addModule(
      moduleName: string,
      libraryFullPath: string,
      cryptoMechanismFlags: i32,
      cipherFlags: i32
    ): void;
    listModules(): nsISimpleEnumerator;
    readonly canToggleFIPS: boolean;
    toggleFIPSMode(): void;
    readonly isFIPSEnabled: boolean;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIPKCS11Slot.idl

  interface nsIPKCS11Slot extends nsISupports {
    readonly SLOT_DISABLED?: 0;
    readonly SLOT_NOT_PRESENT?: 1;
    readonly SLOT_UNINITIALIZED?: 2;
    readonly SLOT_NOT_LOGGED_IN?: 3;
    readonly SLOT_LOGGED_IN?: 4;
    readonly SLOT_READY?: 5;

    readonly name: string;
    readonly desc: string;
    readonly manID: string;
    readonly HWVersion: string;
    readonly FWVersion: string;
    readonly status: u32;
    getToken(): nsIPK11Token;
    readonly tokenName: string;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIPublicKeyPinningService.idl

  interface nsIPublicKeyPinningService extends nsISupports {
    hostHasPins(aURI: nsIURI): boolean;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsISecretDecoderRing.idl

  interface nsISecretDecoderRing extends nsISupports {
    encryptString(text: string): string;
    asyncEncryptStrings(plaintexts: string[]): Promise<any>;
    decryptString(encryptedBase64Text: string): string;
    asyncDecryptStrings(encryptedStrings: string[]): Promise<any>;
    changePassword(): void;
    logout(): void;
    logoutAndTeardown(): void;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsISecurityUITelemetry.idl

  interface nsISecurityUITelemetry extends nsISupports {
    readonly WARNING_ADDON_ASKING_PREVENTED?: 1;
    readonly WARNING_ADDON_ASKING_PREVENTED_CLICK_THROUGH?: 2;
    readonly WARNING_CONFIRM_ADDON_INSTALL?: 3;
    readonly WARNING_CONFIRM_ADDON_INSTALL_CLICK_THROUGH?: 4;
    readonly WARNING_CONFIRM_POST_TO_INSECURE_FROM_SECURE?: 9;
    readonly WARNING_CONFIRM_POST_TO_INSECURE_FROM_SECURE_CLICK_THROUGH?: 10;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsISiteSecurityService.idl
} // global

declare enum nsISiteSecurityService_ResetStateBy {
  ExactDomain = 0,
  RootDomain = 1,
  BaseDomain = 2,
}

declare global {
  namespace nsISiteSecurityService {
    type ResetStateBy = nsISiteSecurityService_ResetStateBy;
  }

  interface nsISiteSecurityService
    extends nsISupports,
      Enums<typeof nsISiteSecurityService_ResetStateBy> {
    readonly Success?: 0;
    readonly ERROR_UNKNOWN?: 1;
    readonly ERROR_COULD_NOT_PARSE_HEADER?: 3;
    readonly ERROR_NO_MAX_AGE?: 4;
    readonly ERROR_MULTIPLE_MAX_AGES?: 5;
    readonly ERROR_INVALID_MAX_AGE?: 6;
    readonly ERROR_MULTIPLE_INCLUDE_SUBDOMAINS?: 7;
    readonly ERROR_INVALID_INCLUDE_SUBDOMAINS?: 8;
    readonly ERROR_COULD_NOT_SAVE_STATE?: 13;

    processHeader(
      aSourceURI: nsIURI,
      aHeader: string,
      aOriginAttributes?: any,
      aMaxAge?: OutParam<u64>,
      aIncludeSubdomains?: OutParam<boolean>,
      aFailureResult?: OutParam<u32>
    ): void;
    resetState(
      aURI: nsIURI,
      aOriginAttributes?: any,
      aScope?: nsISiteSecurityService.ResetStateBy
    ): void;
    isSecureURI(aURI: nsIURI, aOriginAttributes?: any): boolean;
    clearAll(): void;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsITLSSocketControl.idl

  interface nsITLSSocketControl extends nsISupports {
    readonly KEY_EXCHANGE_UNKNOWN?: -1;
    readonly SSL_VERSION_3?: 768;
    readonly TLS_VERSION_1?: 769;
    readonly TLS_VERSION_1_1?: 770;
    readonly TLS_VERSION_1_2?: 771;
    readonly TLS_VERSION_1_3?: 772;
    readonly SSL_VERSION_UNKNOWN?: -1;
    readonly SSL_MAC_UNKNOWN?: -1;
    readonly SSL_MAC_NULL?: 0;
    readonly SSL_MAC_MD5?: 1;
    readonly SSL_MAC_SHA?: 2;
    readonly SSL_HMAC_MD5?: 3;
    readonly SSL_HMAC_SHA?: 4;
    readonly SSL_HMAC_SHA256?: 5;
    readonly SSL_MAC_AEAD?: 6;

    asyncStartTLS(): Promise<any>;
    getAlpnEarlySelection(): string;
    readonly earlyDataAccepted: boolean;
    driveHandshake(): void;
    joinConnection(npnProtocol: string, hostname: string, port: i32): boolean;
    testJoinConnection(npnProtocol: string, hostname: string, port: i32): boolean;
    isAcceptableForHost(hostname: string): boolean;
    readonly KEAUsed: i16;
    readonly KEAKeyBits: u32;
    readonly providerFlags: u32;
    readonly SSLVersionUsed: i16;
    readonly SSLVersionOffered: i16;
    readonly MACAlgorithmUsed: i16;
    readonly clientCertSent: boolean;
    readonly failedVerification: boolean;
    esniTxt: string;
    echConfig: string;
    readonly retryEchConfig: string;
    readonly peerId: string;
    readonly securityInfo: nsITransportSecurityInfo;
    asyncGetSecurityInfo(): Promise<any>;
    claim(): void;
    browserId: u64;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsITokenPasswordDialogs.idl

  interface nsITokenPasswordDialogs extends nsISupports {
    setPassword(ctx: nsIInterfaceRequestor, token: nsIPK11Token): boolean;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsITransportSecurityInfo.idl
} // global

declare enum nsITransportSecurityInfo_OverridableErrorCategory {
  ERROR_UNSET = 0,
  ERROR_TRUST = 1,
  ERROR_DOMAIN = 2,
  ERROR_TIME = 3,
}

declare global {
  namespace nsITransportSecurityInfo {
    type OverridableErrorCategory = nsITransportSecurityInfo_OverridableErrorCategory;
  }

  interface nsITransportSecurityInfo
    extends nsISupports,
      Enums<typeof nsITransportSecurityInfo_OverridableErrorCategory> {
    readonly SSL_VERSION_3?: 0;
    readonly TLS_VERSION_1?: 1;
    readonly TLS_VERSION_1_1?: 2;
    readonly TLS_VERSION_1_2?: 3;
    readonly TLS_VERSION_1_3?: 4;
    readonly CERTIFICATE_TRANSPARENCY_NOT_APPLICABLE?: 0;
    readonly CERTIFICATE_TRANSPARENCY_POLICY_COMPLIANT?: 5;
    readonly CERTIFICATE_TRANSPARENCY_POLICY_NOT_ENOUGH_SCTS?: 6;
    readonly CERTIFICATE_TRANSPARENCY_POLICY_NOT_DIVERSE_SCTS?: 7;

    readonly securityState: u32;
    readonly errorCode: i32;
    readonly errorCodeString: string;
    readonly failedCertChain: nsIX509Cert[];
    readonly serverCert: nsIX509Cert;
    readonly succeededCertChain: nsIX509Cert[];
    readonly cipherName: string;
    readonly keyLength: u32;
    readonly secretKeyLength: u32;
    readonly keaGroupName: string;
    readonly signatureSchemeName: string;
    readonly protocolVersion: u16;
    readonly certificateTransparencyStatus: u16;
    readonly isAcceptedEch: boolean;
    readonly isDelegatedCredential: boolean;
    readonly overridableErrorCategory: nsITransportSecurityInfo.OverridableErrorCategory;
    readonly madeOCSPRequests: boolean;
    readonly usedPrivateDNS: boolean;
    readonly isExtendedValidation: boolean;
    toString(): string;
    readonly negotiatedNPN: string;
    readonly resumed: boolean;
    readonly isBuiltCertChainRootBuiltInRoot: boolean;
    readonly peerId: string;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIX509Cert.idl

  interface nsIX509Cert extends nsISupports {
    readonly UNKNOWN_CERT?: 0;
    readonly CA_CERT?: 1;
    readonly USER_CERT?: 2;
    readonly EMAIL_CERT?: 4;
    readonly SERVER_CERT?: 8;
    readonly ANY_CERT?: 65535;

    readonly emailAddress: string;
    getEmailAddresses(): string[];
    containsEmailAddress(aEmailAddress: string): boolean;
    readonly subjectName: string;
    readonly commonName: string;
    readonly organization: string;
    readonly organizationalUnit: string;
    readonly sha256Fingerprint: string;
    readonly sha1Fingerprint: string;
    readonly tokenName: string;
    readonly issuerName: string;
    readonly serialNumber: string;
    readonly issuerCommonName: string;
    readonly issuerOrganization: string;
    readonly issuerOrganizationUnit: string;
    readonly validity: nsIX509CertValidity;
    readonly dbKey: string;
    readonly displayName: string;
    readonly certType: u32;
    getRawDER(): u8[];
    getBase64DERString(): string;
    readonly sha256SubjectPublicKeyInfoDigest: string;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIX509CertDB.idl
} // global

declare enum nsIAppSignatureInfo_SignatureAlgorithm {
  PKCS7_WITH_SHA1 = 0,
  PKCS7_WITH_SHA256 = 1,
  COSE_WITH_SHA256 = 2,
}

declare global {
  namespace nsIAppSignatureInfo {
    type SignatureAlgorithm = nsIAppSignatureInfo_SignatureAlgorithm;
  }

  interface nsIAppSignatureInfo
    extends nsISupports,
      Enums<typeof nsIAppSignatureInfo_SignatureAlgorithm> {
    readonly signerCert: nsIX509Cert;
    readonly signatureAlgorithm: nsIAppSignatureInfo.SignatureAlgorithm;
  }

  type nsIOpenSignedAppFileCallback = Callable<{
    openSignedAppFileFinished(
      rv: nsresult,
      aZipReader: nsIZipReader,
      aSignatureInfos: nsIAppSignatureInfo[]
    ): void;
  }>;

  type nsIAsyncBoolCallback = Callable<{
    onResult(result: boolean): void;
  }>;

  type nsICertVerificationCallback = Callable<{
    verifyCertFinished(
      aPRErrorCode: i32,
      aVerifiedChain: nsIX509Cert[],
      aHasEVPolicy: boolean
    ): void;
  }>;
} // global

declare enum nsIX509CertDB_VerifyUsage {
  verifyUsageTLSServer = 1,
  verifyUsageTLSServerCA = 2,
  verifyUsageTLSClient = 3,
  verifyUsageTLSClientCA = 4,
  verifyUsageEmailSigner = 5,
  verifyUsageEmailRecipient = 6,
  verifyUsageEmailCA = 7,
}

declare global {
  namespace nsIX509CertDB {
    type VerifyUsage = nsIX509CertDB_VerifyUsage;
  }

  interface nsIX509CertDB extends nsISupports, Enums<typeof nsIX509CertDB_VerifyUsage> {
    readonly UNTRUSTED?: 0;
    readonly TRUSTED_SSL?: 1;
    readonly TRUSTED_EMAIL?: 2;
    readonly Success?: 0;
    readonly ERROR_UNKNOWN?: 1;
    readonly ERROR_PKCS12_NOSMARTCARD_EXPORT?: 2;
    readonly ERROR_PKCS12_RESTORE_FAILED?: 3;
    readonly ERROR_PKCS12_BACKUP_FAILED?: 4;
    readonly ERROR_PKCS12_CERT_COLLISION?: 5;
    readonly ERROR_BAD_PASSWORD?: 6;
    readonly ERROR_DECODE_ERROR?: 7;
    readonly ERROR_PKCS12_DUPLICATE_DATA?: 8;
    readonly AppXPCShellRoot?: 6;
    readonly AddonsPublicRoot?: 7;
    readonly AddonsStageRoot?: 8;
    readonly FLAG_LOCAL_ONLY?: 1;
    readonly FLAG_MUST_BE_EV?: 2;

    findCertByDBKey(aDBkey: string): nsIX509Cert;
    importCertificates(data: u8[], length: u32, type: u32, ctx: nsIInterfaceRequestor): void;
    importEmailCertificate(data: u8[], length: u32, ctx: nsIInterfaceRequestor): void;
    importUserCertificate(data: u8[], length: u32, ctx: nsIInterfaceRequestor): void;
    deleteCertificate(aCert: nsIX509Cert): void;
    setCertTrust(cert: nsIX509Cert, type: u32, trust: u32): void;
    setCertTrustFromString(cert: nsIX509Cert, trustString: string): void;
    isCertTrusted(cert: nsIX509Cert, certType: u32, trustType: u32): boolean;
    importCertsFromFile(aFile: nsIFile, aType: u32): void;
    importPKCS12File(aFile: nsIFile, aPassword: string): u32;
    exportPKCS12File(aFile: nsIFile, aCerts: nsIX509Cert[], aPassword: string): u32;
    constructX509FromBase64(base64: string): nsIX509Cert;
    constructX509(certDER: u8[]): nsIX509Cert;
    openSignedAppFileAsync(
      trustedRoot: AppTrustedRoot,
      aJarFile: nsIFile,
      callback: nsIOpenSignedAppFileCallback
    ): void;
    addCert(certDER: string, trust: string): nsIX509Cert;
    asyncVerifyCertAtTime(
      aCert: nsIX509Cert,
      aUsage: nsIX509CertDB.VerifyUsage,
      aFlags: u32,
      aHostname: string,
      aTime: u64,
      aCallback: nsICertVerificationCallback
    ): void;
    clearOCSPCache(): void;
    addCertFromBase64(base64: string, trust: string): nsIX509Cert;
    getCerts(): nsIX509Cert[];
    asPKCS7Blob(certList: nsIX509Cert[]): string;
    asyncHasThirdPartyRoots(callback: nsIAsyncBoolCallback): void;
    countTrustObjects(): u32;
    getAndroidCertificateFromAlias(alias: string): nsIX509Cert;
  }

  // https://searchfox.org/mozilla-central/source/security/manager/ssl/nsIX509CertValidity.idl

  interface nsIX509CertValidity extends nsISupports {
    readonly notBefore: PRTime;
    readonly notAfter: PRTime;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/places/mozIAsyncHistory.idl

  interface mozIVisitInfo extends nsISupports {
    readonly visitId: i64;
    readonly visitDate: PRTime;
    readonly transitionType: u32;
    readonly referrerURI: nsIURI;
  }

  interface mozIPlaceInfo extends nsISupports {
    readonly placeId: i64;
    readonly guid: string;
    readonly uri: nsIURI;
    readonly title: string;
    readonly frecency: i64;
    readonly visits: any;
  }

  interface mozIVisitInfoCallback extends nsISupports {
    handleError(aResultCode: nsresult, aPlaceInfo: mozIPlaceInfo): void;
    handleResult(aPlaceInfo: mozIPlaceInfo): void;
    handleCompletion(aUpdatedItems: u32): void;
    readonly ignoreResults: boolean;
    readonly ignoreErrors: boolean;
  }

  type mozIVisitedStatusCallback = Callable<{
    isVisited(aURI: nsIURI, aVisitedStatus: boolean): void;
  }>;

  interface mozIAsyncHistory extends nsISupports {
    updatePlaces(aPlaceInfo: any, aCallback?: mozIVisitInfoCallback): void;
    isURIVisited(aURI: nsIURI, aCallback: mozIVisitedStatusCallback): void;
    clearCache(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/places/mozIPlacesAutoComplete.idl

  interface mozIPlacesAutoComplete extends nsISupports {
    readonly MATCH_ANYWHERE?: 0;
    readonly MATCH_BOUNDARY_ANYWHERE?: 1;
    readonly MATCH_BOUNDARY?: 2;
    readonly MATCH_BEGINNING?: 3;
    readonly MATCH_ANYWHERE_UNMODIFIED?: 4;
    readonly MATCH_BEGINNING_CASE_SENSITIVE?: 5;
    readonly BEHAVIOR_HISTORY?: 1;
    readonly BEHAVIOR_BOOKMARK?: 2;
    readonly BEHAVIOR_TAG?: 4;
    readonly BEHAVIOR_TITLE?: 8;
    readonly BEHAVIOR_URL?: 16;
    readonly BEHAVIOR_TYPED?: 32;
    readonly BEHAVIOR_JAVASCRIPT?: 64;
    readonly BEHAVIOR_OPENPAGE?: 128;
    readonly BEHAVIOR_RESTRICT?: 256;
    readonly BEHAVIOR_SEARCH?: 512;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/places/mozIPlacesPendingOperation.idl

  interface mozIPlacesPendingOperation extends nsISupports {
    cancel(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/places/mozISyncedBookmarksMirror.idl

  interface mozISyncedBookmarksMirrorProgressListener extends nsISupports {
    onFetchLocalTree(took: i64, itemCount: i64, deletedCount: i64, problems: nsIPropertyBag): void;
    onFetchRemoteTree(took: i64, itemCount: i64, deletedCount: i64, problems: nsIPropertyBag): void;
    onMerge(took: i64, counts: nsIPropertyBag): void;
    onApply(took: i64): void;
  }

  interface mozISyncedBookmarksMirrorCallback extends nsISupports {
    handleSuccess(result: boolean): void;
    handleError(code: nsresult, message: string): void;
  }

  interface mozISyncedBookmarksMirrorLogger extends nsISupports {
    readonly LEVEL_OFF?: 0;
    readonly LEVEL_ERROR?: 1;
    readonly LEVEL_WARN?: 2;
    readonly LEVEL_DEBUG?: 3;
    readonly LEVEL_TRACE?: 4;

    maxLevel: i16;
    error(message: string): void;
    warn(message: string): void;
    debug(message: string): void;
    trace(message: string): void;
  }
} // global

declare enum mozISyncedBookmarksMerger_SyncedItemKinds {
  KIND_BOOKMARK = 1,
  KIND_QUERY = 2,
  KIND_FOLDER = 3,
  KIND_LIVEMARK = 4,
  KIND_SEPARATOR = 5,
}

declare enum mozISyncedBookmarksMerger_SyncedItemValidity {
  VALIDITY_VALID = 1,
  VALIDITY_REUPLOAD = 2,
  VALIDITY_REPLACE = 3,
}

declare global {
  namespace mozISyncedBookmarksMerger {
    type SyncedItemKinds = mozISyncedBookmarksMerger_SyncedItemKinds;
    type SyncedItemValidity = mozISyncedBookmarksMerger_SyncedItemValidity;
  }

  interface mozISyncedBookmarksMerger
    extends nsISupports,
      Enums<
        typeof mozISyncedBookmarksMerger_SyncedItemKinds &
          typeof mozISyncedBookmarksMerger_SyncedItemValidity
      > {
    db: mozIStorageConnection;
    logger: mozIServicesLogSink;
    merge(
      localTimeSeconds: i64,
      remoteTimeSeconds: i64,
      callback: mozISyncedBookmarksMirrorCallback
    ): mozIPlacesPendingOperation;
    reset(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/places/nsIFaviconService.idl

  interface nsIFaviconService extends nsISupports {
    readonly FAVICON_LOAD_PRIVATE?: 1;
    readonly FAVICON_LOAD_NON_PRIVATE?: 2;
    readonly ICONDATA_FLAGS_RICH?: 1;
    readonly MAX_FAVICON_BUFFER_SIZE?: 65536;

    getFaviconLinkForIcon(aFaviconURI: nsIURI): nsIURI;
    expireAllFavicons(): void;
    setDefaultIconURIPreferredSize(aDefaultSize: u16): void;
    preferredSizeFromURI(aURI: nsIURI): u16;
    readonly defaultFavicon: nsIURI;
    readonly defaultFaviconMimeType: string;
    setFaviconForPage(
      aPageURI: nsIURI,
      aFaviconURI: nsIURI,
      aDataURL: nsIURI,
      aExpiration?: PRTime,
      isRichIcon?: boolean
    ): Promise<any>;
    getFaviconURLForPage(
      aPageURI: nsIURI,
      aCallback: nsIFaviconDataCallback,
      aPreferredWidth?: u16
    ): void;
    getFaviconDataForPage(
      aPageURI: nsIURI,
      aCallback: nsIFaviconDataCallback,
      aPreferredWidth?: u16
    ): void;
    copyFavicons(
      aFromPageURI: nsIURI,
      aToPageURI: nsIURI,
      aFaviconLoadType: u32,
      aCallback?: nsIFaviconDataCallback
    ): void;
  }

  type nsIFaviconDataCallback = Callable<{
    onComplete(
      aFaviconURI: nsIURI,
      aDataLen: u32,
      aData: u8[],
      aMimeType: string,
      aWidth: u16
    ): void;
  }>;

  // https://searchfox.org/mozilla-central/source/toolkit/components/places/nsINavBookmarksService.idl

  interface nsINavBookmarksService extends nsISupports {
    readonly DEFAULT_INDEX?: -1;
    readonly TYPE_BOOKMARK?: 1;
    readonly TYPE_FOLDER?: 2;
    readonly TYPE_SEPARATOR?: 3;
    readonly TYPE_DYNAMIC_CONTAINER?: 4;
    readonly SOURCE_DEFAULT?: 0;
    readonly SOURCE_SYNC?: 1;
    readonly SOURCE_IMPORT?: 2;
    readonly SOURCE_SYNC_REPARENT_REMOVED_FOLDER_CHILDREN?: 4;
    readonly SOURCE_RESTORE?: 5;
    readonly SOURCE_RESTORE_ON_STARTUP?: 6;
    readonly SYNC_STATUS_UNKNOWN?: 0;
    readonly SYNC_STATUS_NEW?: 1;
    readonly SYNC_STATUS_NORMAL?: 2;

    readonly tagsFolder: i64;
    readonly totalSyncChanges: i64;
    insertBookmark(
      aParentId: i64,
      aURI: nsIURI,
      aIndex: i32,
      aTitle: string,
      aGuid?: string,
      aSource?: u16
    ): i64;
    removeItem(aItemId: i64, aSource?: u16): void;
    createFolder(aParentFolder: i64, name: string, index: i32, aGuid?: string, aSource?: u16): i64;
    setItemTitle(aItemId: i64, aTitle: string, aSource?: u16): void;
    getItemTitle(aItemId: i64): string;
    setItemLastModified(aItemId: i64, aLastModified: PRTime, aSource?: u16): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/places/nsINavHistoryService.idl

  interface nsINavHistoryResultNode extends nsISupports {
    readonly RESULT_TYPE_URI?: 0;
    readonly RESULT_TYPE_QUERY?: 5;
    readonly RESULT_TYPE_FOLDER?: 6;
    readonly RESULT_TYPE_SEPARATOR?: 7;
    readonly RESULT_TYPE_FOLDER_SHORTCUT?: 9;

    readonly parent: nsINavHistoryContainerResultNode;
    readonly parentResult: nsINavHistoryResult;
    readonly uri: string;
    readonly type: u32;
    readonly title: string;
    readonly accessCount: u32;
    readonly time: PRTime;
    readonly icon: string;
    readonly indentLevel: i32;
    readonly bookmarkIndex: i32;
    readonly itemId: i64;
    readonly dateAdded: PRTime;
    readonly lastModified: PRTime;
    readonly tags: string;
    readonly pageGuid: string;
    readonly bookmarkGuid: string;
    readonly visitId: i64;
    readonly visitType: u32;
  }

  interface nsINavHistoryContainerResultNode extends nsINavHistoryResultNode {
    readonly STATE_CLOSED?: 0;
    readonly STATE_LOADING?: 1;
    readonly STATE_OPENED?: 2;

    containerOpen: boolean;
    readonly state: u16;
    readonly hasChildren: boolean;
    readonly childCount: u32;
    getChild(aIndex: u32): nsINavHistoryResultNode;
    getChildIndex(aNode: nsINavHistoryResultNode): u32;
  }

  interface nsINavHistoryQueryResultNode extends nsINavHistoryContainerResultNode {
    readonly query: nsINavHistoryQuery;
    readonly queryOptions: nsINavHistoryQueryOptions;
    readonly folderItemId: i64;
    readonly targetFolderGuid: string;
  }

  interface nsINavHistoryResultObserver extends nsISupports {
    readonly skipHistoryDetailsNotifications: boolean;
    nodeInserted(
      aParent: nsINavHistoryContainerResultNode,
      aNode: nsINavHistoryResultNode,
      aNewIndex: u32
    ): void;
    nodeRemoved(
      aParent: nsINavHistoryContainerResultNode,
      aItem: nsINavHistoryResultNode,
      aOldIndex: u32
    ): void;
    nodeMoved(
      aNode: nsINavHistoryResultNode,
      aOldParent: nsINavHistoryContainerResultNode,
      aOldIndex: u32,
      aNewParent: nsINavHistoryContainerResultNode,
      aNewIndex: u32
    ): void;
    nodeTitleChanged(aNode: nsINavHistoryResultNode, aNewTitle: string): void;
    nodeURIChanged(aNode: nsINavHistoryResultNode, aOldURI: string): void;
    nodeIconChanged(aNode: nsINavHistoryResultNode): void;
    nodeHistoryDetailsChanged(
      aNode: nsINavHistoryResultNode,
      aOldVisitDate: PRTime,
      aOldAccessCount: u32
    ): void;
    nodeTagsChanged(aNode: nsINavHistoryResultNode): void;
    nodeKeywordChanged(aNode: nsINavHistoryResultNode, aNewKeyword: string): void;
    nodeDateAddedChanged(aNode: nsINavHistoryResultNode, aNewValue: PRTime): void;
    nodeLastModifiedChanged(aNode: nsINavHistoryResultNode, aNewValue: PRTime): void;
    containerStateChanged(
      aContainerNode: nsINavHistoryContainerResultNode,
      aOldState: u32,
      aNewState: u32
    ): void;
    invalidateContainer(aContainerNode: nsINavHistoryContainerResultNode): void;
    sortingChanged(sortingMode: u16): void;
    batching(aToggleMode: boolean): void;
    result: nsINavHistoryResult;
  }

  interface nsINavHistoryResult extends nsISupports {
    sortingMode: u16;
    suppressNotifications: boolean;
    addObserver(aObserver: nsINavHistoryResultObserver, aOwnsWeak?: boolean): void;
    removeObserver(aObserver: nsINavHistoryResultObserver): void;
    readonly root: nsINavHistoryContainerResultNode;
    onBeginUpdateBatch(): void;
    onEndUpdateBatch(): void;
  }

  interface nsINavHistoryQuery extends nsISupports {
    readonly TIME_RELATIVE_EPOCH?: 0;
    readonly TIME_RELATIVE_TODAY?: 1;
    readonly TIME_RELATIVE_NOW?: 2;

    beginTime: PRTime;
    beginTimeReference: u32;
    readonly hasBeginTime: boolean;
    readonly absoluteBeginTime: PRTime;
    endTime: PRTime;
    endTimeReference: u32;
    readonly hasEndTime: boolean;
    readonly absoluteEndTime: PRTime;
    searchTerms: string;
    readonly hasSearchTerms: boolean;
    minVisits: i32;
    maxVisits: i32;
    setTransitions(transitions: u32[]): void;
    getTransitions(): u32[];
    readonly transitionCount: u32;
    domainIsHost: boolean;
    domain: string;
    readonly hasDomain: boolean;
    uri: nsIURI;
    readonly hasUri: boolean;
    tags: nsIVariant;
    tagsAreNot: boolean;
    getParents(): string[];
    readonly parentCount: u32;
    setParents(aGuids: string[]): void;
    clone(): nsINavHistoryQuery;
  }

  interface nsINavHistoryQueryOptions extends nsISupports {
    readonly SORT_BY_NONE?: 0;
    readonly SORT_BY_TITLE_ASCENDING?: 1;
    readonly SORT_BY_TITLE_DESCENDING?: 2;
    readonly SORT_BY_DATE_ASCENDING?: 3;
    readonly SORT_BY_DATE_DESCENDING?: 4;
    readonly SORT_BY_URI_ASCENDING?: 5;
    readonly SORT_BY_URI_DESCENDING?: 6;
    readonly SORT_BY_VISITCOUNT_ASCENDING?: 7;
    readonly SORT_BY_VISITCOUNT_DESCENDING?: 8;
    readonly SORT_BY_DATEADDED_ASCENDING?: 11;
    readonly SORT_BY_DATEADDED_DESCENDING?: 12;
    readonly SORT_BY_LASTMODIFIED_ASCENDING?: 13;
    readonly SORT_BY_LASTMODIFIED_DESCENDING?: 14;
    readonly SORT_BY_TAGS_ASCENDING?: 17;
    readonly SORT_BY_TAGS_DESCENDING?: 18;
    readonly SORT_BY_FRECENCY_ASCENDING?: 21;
    readonly SORT_BY_FRECENCY_DESCENDING?: 22;
    readonly RESULTS_AS_URI?: 0;
    readonly RESULTS_AS_VISIT?: 1;
    readonly RESULTS_AS_DATE_QUERY?: 3;
    readonly RESULTS_AS_SITE_QUERY?: 4;
    readonly RESULTS_AS_DATE_SITE_QUERY?: 5;
    readonly RESULTS_AS_TAGS_ROOT?: 6;
    readonly RESULTS_AS_TAG_CONTENTS?: 7;
    readonly RESULTS_AS_ROOTS_QUERY?: 8;
    readonly RESULTS_AS_LEFT_PANE_QUERY?: 9;
    readonly QUERY_TYPE_HISTORY?: 0;
    readonly QUERY_TYPE_BOOKMARKS?: 1;

    sortingMode: u16;
    resultType: u16;
    excludeItems: boolean;
    excludeQueries: boolean;
    expandQueries: boolean;
    includeHidden: boolean;
    maxResults: u32;
    queryType: u16;
    asyncEnabled: boolean;
    clone(): nsINavHistoryQueryOptions;
  }

  interface nsINavHistoryService extends nsISupports {
    readonly DATABASE_SCHEMA_VERSION?: 78;
    readonly TRANSITION_LINK?: 1;
    readonly TRANSITION_TYPED?: 2;
    readonly TRANSITION_BOOKMARK?: 3;
    readonly TRANSITION_EMBED?: 4;
    readonly TRANSITION_REDIRECT_PERMANENT?: 5;
    readonly TRANSITION_REDIRECT_TEMPORARY?: 6;
    readonly TRANSITION_DOWNLOAD?: 7;
    readonly TRANSITION_FRAMED_LINK?: 8;
    readonly TRANSITION_RELOAD?: 9;
    readonly DATABASE_STATUS_OK?: 0;
    readonly DATABASE_STATUS_CREATE?: 1;
    readonly DATABASE_STATUS_CORRUPT?: 2;
    readonly DATABASE_STATUS_UPGRADED?: 3;
    readonly DATABASE_STATUS_LOCKED?: 4;
    readonly VISIT_SOURCE_ORGANIC?: 0;
    readonly VISIT_SOURCE_SPONSORED?: 1;
    readonly VISIT_SOURCE_BOOKMARKED?: 2;
    readonly VISIT_SOURCE_SEARCHED?: 3;

    readonly databaseStatus: u16;
    markPageAsFollowedBookmark(aURI: nsIURI): void;
    markPageAsTyped(aURI: nsIURI): void;
    markPageAsFollowedLink(aURI: nsIURI): void;
    canAddURI(aURI: nsIURI): boolean;
    getNewQuery(): nsINavHistoryQuery;
    getNewQueryOptions(): nsINavHistoryQueryOptions;
    executeQuery(
      aQuery: nsINavHistoryQuery,
      options: nsINavHistoryQueryOptions
    ): nsINavHistoryResult;
    queryStringToQuery(
      aQueryString: string,
      aQuery: OutParam<nsINavHistoryQuery>,
      options: OutParam<nsINavHistoryQueryOptions>
    ): void;
    queryToQueryString(aQuery: nsINavHistoryQuery, options: nsINavHistoryQueryOptions): string;
    readonly historyDisabled: boolean;
    makeGuid(): string;
    hashURL(aSpec: string, aMode?: string): u64;
    isFrecencyDecaying: boolean;
    shouldStartFrecencyRecalculation: boolean;
    readonly DBConnection: mozIStorageConnection;
    asyncExecuteLegacyQuery(
      aQuery: nsINavHistoryQuery,
      aOptions: nsINavHistoryQueryOptions,
      aCallback: mozIStorageStatementCallback
    ): mozIStoragePendingStatement;
    readonly shutdownClient: nsIAsyncShutdownClient;
    readonly connectionShutdownClient: nsIAsyncShutdownClient;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/places/nsIPlacesPreviewsHelperService.idl

  interface nsIPlacesPreviewsHelperService extends nsISupports {
    getFilePathForURL(aURL: string): string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/places/nsITaggingService.idl

  interface nsITaggingService extends nsISupports {
    tagURI(aURI: nsIURI, aTags: nsIVariant, aSource?: u16): void;
    untagURI(aURI: nsIURI, aTags: nsIVariant, aSource?: u16): void;
    getTagsForURI(aURI: nsIURI): string[];
  }

  // https://searchfox.org/mozilla-central/source/modules/libpref/nsIPrefBranch.idl

  interface nsIPrefBranch extends nsISupports {
    readonly PREF_INVALID?: 0;
    readonly PREF_STRING?: 32;
    readonly PREF_INT?: 64;
    readonly PREF_BOOL?: 128;

    readonly root: string;
    getPrefType(aPrefName: string): i32;
    getBoolPref(aPrefName: string, aDefaultValue?: boolean): boolean;
    setBoolPref(aPrefName: string, aValue: boolean): void;
    getFloatPref(aPrefName: string, aDefaultValue?: float): float;
    getCharPref(aPrefName: string, aDefaultValue?: string): string;
    setCharPref(aPrefName: string, aValue: string): void;
    getStringPref(aPrefName: string, aDefaultValue?: string): string;
    setStringPref(aPrefName: string, aValue: string): void;
    getIntPref(aPrefName: string, aDefaultValue?: i32): i32;
    setIntPref(aPrefName: string, aValue: i32): void;
    getComplexValue<T extends nsIID>(aPrefName: string, aType: T): nsQIResult<T>;
    setComplexValue(aPrefName: string, aType: nsID, aValue: nsISupports): void;
    clearUserPref(aPrefName: string): void;
    lockPref(aPrefName: string): void;
    prefHasUserValue(aPrefName: string): boolean;
    prefHasDefaultValue(aPrefName: string): boolean;
    prefIsLocked(aPrefName: string): boolean;
    prefIsSanitized(aPrefName: string): boolean;
    unlockPref(aPrefName: string): void;
    deleteBranch(aStartingAt: string): void;
    getChildList(aStartingAt: string): string[];
    addObserver(aDomain: string, aObserver: nsIObserver, aHoldWeak?: boolean): void;
    removeObserver(aDomain: string, aObserver: nsIObserver): void;
  }

  // https://searchfox.org/mozilla-central/source/modules/libpref/nsIPrefLocalizedString.idl

  interface nsIPrefLocalizedString extends nsISupportsString {}

  // https://searchfox.org/mozilla-central/source/modules/libpref/nsIPrefService.idl

  type nsIPrefStatsCallback = Callable<{
    visit(prefName: string, accessCount: u32): void;
  }>;

  interface nsIPrefObserver extends nsISupports {
    onStringPref(
      kind: string,
      name: string,
      value: string,
      isSticky: boolean,
      isLocked: boolean
    ): void;
    onIntPref(kind: string, name: string, value: i32, isSticky: boolean, isLocked: boolean): void;
    onBoolPref(
      kind: string,
      name: string,
      value: boolean,
      isSticky: boolean,
      isLocked: boolean
    ): void;
    onError(message: string): void;
  }

  interface nsIPrefService extends nsISupports {
    resetPrefs(): void;
    savePrefFile(aFile: nsIFile): void;
    backupPrefFile(aFile: nsIFile): Promise<any>;
    getBranch(aPrefRoot: string): nsIPrefBranch;
    getDefaultBranch(aPrefRoot: string): nsIPrefBranch;
    readonly dirty: boolean;
    readDefaultPrefsFromFile(aFile: nsIFile): void;
    readUserPrefsFromFile(aFile: nsIFile): void;
    readStats(callback: nsIPrefStatsCallback): void;
    resetStats(): void;
    parsePrefsFromBuffer(bytes: u8[], observer: nsIPrefObserver, pathLabel?: string): void;
    readonly userPrefsFileLastModifiedAtStartup: PRTime;
  }

  // https://searchfox.org/mozilla-central/source/modules/libpref/nsIRelativeFilePref.idl

  interface nsIRelativeFilePref extends nsISupports {
    file: nsIFile;
    relativeToKey: string;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/prefetch/nsIPrefetchService.idl

  interface nsIPrefetchService extends nsISupports {
    prefetchURI(
      aURI: nsIURI,
      aReferrerInfo: nsIReferrerInfo,
      aSource: Node,
      aExplicit: boolean
    ): void;
    preloadURI(
      aURI: nsIURI,
      aReferrerInfo: nsIReferrerInfo,
      aSource: Node,
      aPolicyType: nsContentPolicyType
    ): void;
    hasMoreElements(): boolean;
    cancelPrefetchPreloadURI(aURI: nsIURI, aSource: Node): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/privateattribution/nsIPrivateAttributionService.idl

  interface nsIPrivateAttributionService extends nsISupports {
    onAttributionEvent(
      sourceHost: string,
      type: string,
      index: u32,
      ad: string,
      targetHost: string
    ): void;
    onAttributionConversion(
      targetHost: string,
      task: string,
      histogramSize: u32,
      lookbackDays: u32,
      impressionType: string,
      ads: string[],
      sourceHosts: string[]
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/tools/profiler/gecko/nsIProfiler.idl

  interface nsIProfilerStartParams extends nsISupports {
    readonly entries: u32;
    readonly duration: double;
    readonly interval: double;
    readonly features: u32;
    readonly activeTabID: u64;
  }

  interface nsIProfiler extends nsISupports {
    StartProfiler(
      aEntries: u32,
      aInterval: double,
      aFeatures: string[],
      aFilters?: string[],
      aActiveTabID?: u64,
      aDuration?: double
    ): Promise<any>;
    StopProfiler(): Promise<any>;
    IsPaused(): boolean;
    Pause(): Promise<any>;
    Resume(): Promise<any>;
    IsSamplingPaused(): boolean;
    PauseSampling(): Promise<any>;
    ResumeSampling(): Promise<any>;
    waitOnePeriodicSampling(): Promise<any>;
    GetProfile(aSinceTime?: double): string;
    getProfileData(aSinceTime?: double): any;
    getProfileDataAsync(aSinceTime?: double): Promise<any>;
    getProfileDataAsArrayBuffer(aSinceTime?: double): Promise<any>;
    getProfileDataAsGzippedArrayBuffer(aSinceTime?: double): Promise<any>;
    dumpProfileToFileAsync(aFilename: string, aSinceTime?: double): Promise<any>;
    dumpProfileToFile(aFilename: string): void;
    IsActive(): boolean;
    ClearAllPages(): void;
    GetFeatures(): string[];
    readonly activeConfiguration: any;
    GetAllFeatures(): string[];
    GetBufferInfo(
      aCurrentPosition: OutParam<u32>,
      aTotalSize: OutParam<u32>,
      aGeneration: OutParam<u32>
    ): void;
    getElapsedTime(): double;
    readonly sharedLibraries: any;
    getSymbolTable(aDebugPath: string, aBreakpadID: string): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/test/rdd_process_xpcom/nsIRddProcessTest.idl

  interface nsIRddProcessTest extends nsISupports {
    testTelemetryProbes(): Promise<any>;
    stopProcess(): void;
  }

  // https://searchfox.org/mozilla-central/source/remote/components/nsIMarionette.idl

  interface nsIMarionette extends nsISupports {
    readonly running: boolean;
  }

  // https://searchfox.org/mozilla-central/source/remote/components/nsIRemoteAgent.idl

  interface nsIRemoteAgent extends nsISupports {
    readonly debuggerAddress: string;
    readonly running: boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/reputationservice/nsIApplicationReputation.idl

  interface nsIApplicationReputationService extends nsISupports {
    readonly VERDICT_SAFE?: 0;
    readonly VERDICT_DANGEROUS?: 1;
    readonly VERDICT_UNCOMMON?: 2;
    readonly VERDICT_POTENTIALLY_UNWANTED?: 3;
    readonly VERDICT_DANGEROUS_HOST?: 4;

    queryReputation(
      aQuery: nsIApplicationReputationQuery,
      aCallback: nsIApplicationReputationCallback
    ): void;
    isBinary(aFilename: string): boolean;
    isExecutable(aFilename: string): boolean;
  }

  interface nsIApplicationReputationQuery extends nsISupports {
    readonly sourceURI: nsIURI;
    readonly referrerInfo: nsIReferrerInfo;
    readonly suggestedFileName: string;
    readonly fileSize: u32;
    readonly sha256Hash: string;
    readonly signatureInfo: u8[][][];
    readonly redirects: nsIArray;
  }

  type nsIApplicationReputationCallback = Callable<{
    onComplete(aShouldBlock: boolean, aStatus: nsresult, aVerdict: u32): void;
  }>;

  // https://searchfox.org/mozilla-central/source/security/sandbox/common/mozISandboxSettings.idl

  interface mozISandboxSettings extends nsISupports {
    readonly effectiveContentSandboxLevel: i32;
    readonly contentWin32kLockdownState: i32;
    readonly contentWin32kLockdownStateString: string;
  }

  // https://searchfox.org/mozilla-central/source/security/sandbox/linux/interfaces/mozISandboxReporter.idl

  interface mozISandboxReport extends nsISupports {
    readonly msecAgo: u64;
    readonly pid: i32;
    readonly tid: i32;
    readonly procType: string;
    readonly syscall: u32;
    readonly numArgs: u32;
    getArg(aIndex: u32): string;
  }

  interface mozISandboxReportArray extends nsISupports {
    readonly begin: u64;
    readonly end: u64;
    getElement(aIndex: u64): mozISandboxReport;
  }

  interface mozISandboxReporter extends nsISupports {
    snapshot(): mozISandboxReportArray;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/satchel/nsIFormFillController.idl

  interface nsIFormFillController extends nsISupports {
    readonly focusedElement: Element;
    readonly passwordPopupAutomaticallyOpened: boolean;
    markAsAutoCompletableField(aElement: Element): void;
    showPopup(): void;
  }

  type nsIFormFillCompleteObserver = Callable<{
    onSearchCompletion(result: nsIAutoCompleteResult): void;
  }>;

  // https://searchfox.org/mozilla-central/source/services/interfaces/mozIAppServicesLogger.idl

  interface mozIAppServicesLogger extends nsISupports {
    register(target: string, logger: mozIServicesLogSink): void;
  }

  // https://searchfox.org/mozilla-central/source/services/interfaces/mozIBridgedSyncEngine.idl

  interface mozIBridgedSyncEngineCallback extends nsISupports {
    handleSuccess(result: nsIVariant): void;
    handleError(code: nsresult, message: string): void;
  }

  interface mozIBridgedSyncEngineApplyCallback extends nsISupports {
    handleSuccess(outgoingEnvelopesAsJSON: string[]): void;
    handleError(code: nsresult, message: string): void;
  }

  interface mozIBridgedSyncEngine extends nsISupports {
    readonly storageVersion: i32;
    readonly allowSkippedRecord: boolean;
    logger: mozIServicesLogSink;
    getLastSync(callback: mozIBridgedSyncEngineCallback): void;
    setLastSync(lastSyncMillis: i64, callback: mozIBridgedSyncEngineCallback): void;
    getSyncId(callback: mozIBridgedSyncEngineCallback): void;
    resetSyncId(callback: mozIBridgedSyncEngineCallback): void;
    ensureCurrentSyncId(newSyncId: string, callback: mozIBridgedSyncEngineCallback): void;
    syncStarted(callback: mozIBridgedSyncEngineCallback): void;
    storeIncoming(incomingEnvelopesAsJSON: string[], callback: mozIBridgedSyncEngineCallback): void;
    apply(callback: mozIBridgedSyncEngineApplyCallback): void;
    setUploaded(
      newTimestampMillis: i64,
      uploadedIds: string[],
      callback: mozIBridgedSyncEngineCallback
    ): void;
    syncFinished(callback: mozIBridgedSyncEngineCallback): void;
    reset(callback: mozIBridgedSyncEngineCallback): void;
    wipe(callback: mozIBridgedSyncEngineCallback): void;
  }

  // https://searchfox.org/mozilla-central/source/services/interfaces/mozIInterruptible.idl

  interface mozIInterruptible extends nsISupports {
    interrupt(): void;
  }

  // https://searchfox.org/mozilla-central/source/services/interfaces/mozIServicesLogSink.idl

  interface mozIServicesLogSink extends nsISupports {
    readonly LEVEL_OFF?: 0;
    readonly LEVEL_ERROR?: 1;
    readonly LEVEL_WARN?: 2;
    readonly LEVEL_INFO?: 3;
    readonly LEVEL_DEBUG?: 4;
    readonly LEVEL_TRACE?: 5;

    maxLevel: i16;
    error(message: string): void;
    warn(message: string): void;
    debug(message: string): void;
    trace(message: string): void;
    info(message: string): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/sessionstore/nsISessionStoreFunctions.idl

  interface nsISessionStoreFunctions extends nsISupports {
    UpdateSessionStore(
      aBrowser: Element,
      aBrowsingContext: BrowsingContext,
      aPermanentKey: any,
      aEpoch: u32,
      aCollectSHistory: boolean,
      aData: any
    ): void;
    UpdateSessionStoreForStorage(
      aBrowser: Element,
      aBrowsingContext: BrowsingContext,
      aPermanentKey: any,
      aEpoch: u32,
      aData: any
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/sessionstore/nsISessionStoreRestoreData.idl

  interface nsISessionStoreRestoreData extends nsISupports {
    url: string;
    innerHTML: string;
    scroll: string;
    addTextField(aIsXPath: boolean, aIdOrXPath: string, aValue: string): void;
    addCheckbox(aIsXPath: boolean, aIdOrXPath: string, aValue: boolean): void;
    addFileList(aIsXPath: boolean, aIdOrXPath: string, aType: string, aFileList: string[]): void;
    addSingleSelect(
      aIsXPath: boolean,
      aIdOrXPath: string,
      aSelectedIndex: u32,
      aValue: string
    ): void;
    addMultipleSelect(aIsXPath: boolean, aIdOrXPath: string, aValues: string[]): void;
    addCustomElement(aIsXPath: boolean, aIdOrXPath: string, aValue: any, aState: any): void;
    addChild(aChild: nsISessionStoreRestoreData, aIndex: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/browser/components/shell/nsIShellService.idl

  interface nsIShellService extends nsISupports {
    readonly BACKGROUND_TILE?: 1;
    readonly BACKGROUND_STRETCH?: 2;
    readonly BACKGROUND_CENTER?: 3;
    readonly BACKGROUND_FILL?: 4;
    readonly BACKGROUND_FIT?: 5;
    readonly BACKGROUND_SPAN?: 6;

    isDefaultBrowser(aForAllTypes?: boolean): boolean;
    setDefaultBrowser(aForAllUsers: boolean): void;
    setDesktopBackground(aElement: Element, aPosition: i32, aImageName: string): void;
    desktopBackgroundColor: u32;
  }

  // https://searchfox.org/mozilla-central/source/docshell/shistory/nsIBFCacheEntry.idl

  interface nsIBFCacheEntry extends nsISupports {
    RemoveFromBFCacheSync(): void;
    RemoveFromBFCacheAsync(): void;
  }

  // https://searchfox.org/mozilla-central/source/docshell/shistory/nsISHEntry.idl

  interface nsISHEntry extends nsISupports {
    URI: nsIURI;
    originalURI: nsIURI;
    resultPrincipalURI: nsIURI;
    unstrippedURI: nsIURI;
    loadReplace: boolean;
    title: string;
    name: string;
    isSubFrame: boolean;
    hasUserInteraction: boolean;
    hasUserActivation: boolean;
    referrerInfo: nsIReferrerInfo;
    documentViewer: nsIDocumentViewer;
    readonly isInBFCache: boolean;
    sticky: boolean;
    windowState: nsISupports;
    refreshURIList: nsIMutableArray;
    postData: nsIInputStream;
    readonly hasPostData: boolean;
    layoutHistoryState: nsILayoutHistoryState;
    parent: nsISHEntry;
    loadType: u32;
    ID: u32;
    cacheKey: u32;
    saveLayoutStateFlag: boolean;
    contentType: string;
    URIWasModified: boolean;
    triggeringPrincipal: nsIPrincipal;
    principalToInherit: nsIPrincipal;
    partitionedPrincipalToInherit: nsIPrincipal;
    csp: nsIContentSecurityPolicy;
    stateData: nsIStructuredCloneContainer;
    docshellID: nsID;
    readonly isSrcdocEntry: boolean;
    srcdocData: string;
    baseURI: nsIURI;
    scrollRestorationIsManual: boolean;
    readonly loadedInThisProcess: boolean;
    readonly childCount: i32;
    persist: boolean;
    setScrollPosition(x: i32, y: i32): void;
    getScrollPosition(x: OutParam<i32>, y: OutParam<i32>): void;
    initLayoutHistoryState(): nsILayoutHistoryState;
    clone(): nsISHEntry;
    hasDynamicallyAddedChild(): boolean;
    adoptBFCacheEntry(aEntry: nsISHEntry): void;
    abandonBFCacheEntry(): void;
    sharesDocumentWith(aEntry: nsISHEntry): boolean;
    setLoadTypeAsHistory(): void;
    AddChild(aChild: nsISHEntry, aOffset: i32, aUseRemoteSubframes?: boolean): void;
    GetChildAt(aIndex: i32): nsISHEntry;
    readonly bfcacheID: u64;
    wireframe: any;
  }

  // https://searchfox.org/mozilla-central/source/docshell/shistory/nsISHistory.idl

  interface nsISHistory extends nsISupports {
    readonly count: i32;
    index: i32;
    readonly requestedIndex: i32;
    getEntryAtIndex(aIndex: i32): nsISHEntry;
    purgeHistory(aNumEntries: i32): void;
    addSHistoryListener(aListener: nsISHistoryListener): void;
    removeSHistoryListener(aListener: nsISHistoryListener): void;
    reloadCurrentEntry(): void;
    addEntry(aEntry: nsISHEntry, aPersist: boolean): void;
    updateIndex(): void;
    replaceEntry(aIndex: i32, aReplaceEntry: nsISHEntry): void;
    notifyOnHistoryReload(): boolean;
    evictOutOfRangeDocumentViewers(aIndex: i32): void;
    evictAllDocumentViewers(): void;
    reload(aReloadFlags: u32): void;
    createEntry(): nsISHEntry;
    canGoBackFromEntryAtIndex(aIndex: i32): boolean;
  }

  // https://searchfox.org/mozilla-central/source/docshell/shistory/nsISHistoryListener.idl

  interface nsISHistoryListener extends nsISupports {
    OnHistoryNewEntry(aNewURI: nsIURI, aOldIndex: i32): void;
    OnHistoryReload(): boolean;
    OnHistoryGotoIndex(): void;
    OnHistoryPurge(aNumEntries: i32): void;
    OnHistoryTruncate(aNumEntries: i32): void;
    OnHistoryReplaceEntry(): void;
    OnDocumentViewerEvicted(aNumEvicted: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/extensions/spellcheck/idl/mozIPersonalDictionary.idl

  interface mozIPersonalDictionary extends nsISupports {
    load(): void;
    save(): void;
    readonly wordList: nsIStringEnumerator;
    check(word: string): boolean;
    addWord(word: string): void;
    removeWord(word: string): void;
    ignoreWord(word: string): void;
    endSession(): void;
  }

  // https://searchfox.org/mozilla-central/source/extensions/spellcheck/idl/mozISpellCheckingEngine.idl

  interface mozISpellCheckingEngine extends nsISupports {
    dictionaries: string[];
    personalDictionary: mozIPersonalDictionary;
    getDictionaryList(): string[];
    check(word: string): boolean;
    suggest(word: string): string[];
    loadDictionariesFromDir(dir: nsIFile): void;
    addDirectory(dir: nsIFile): void;
    removeDirectory(dir: nsIFile): void;
    addDictionary(lang: string, file: nsIURI): void;
    removeDictionary(lang: string, file: nsIURI): boolean;
  }

  // https://searchfox.org/mozilla-central/source/startupcache/nsIStartupCacheInfo.idl

  interface nsIStartupCacheInfo extends nsISupports {
    readonly IgnoreDiskCache: boolean;
    readonly FoundDiskCacheOnInit: boolean;
    readonly WroteToDiskCache: boolean;
    readonly DiskCachePath: string;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageAsyncConnection.idl

  interface mozIStorageAsyncConnection extends nsISupports {
    readonly TRANSACTION_DEFAULT?: -1;
    readonly TRANSACTION_DEFERRED?: 0;
    readonly TRANSACTION_IMMEDIATE?: 1;
    readonly TRANSACTION_EXCLUSIVE?: 2;

    defaultTransactionType: i32;
    variableLimit: i32;
    readonly transactionInProgress: boolean;
    asyncClose(aCallback?: mozIStorageCompletionCallback): void;
    asyncClone(aReadOnly: boolean, aCallback: mozIStorageCompletionCallback): void;
    readonly databaseFile: nsIFile;
    interrupt(): void;
    asyncVacuum(
      aCallback?: mozIStorageCompletionCallback,
      aUseIncremental?: boolean,
      aSetPageSize?: i32
    ): void;
    createAsyncStatement(aSQLStatement: string): mozIStorageAsyncStatement;
    executeAsync(
      aStatements: mozIStorageBaseStatement[],
      aCallback?: mozIStorageStatementCallback
    ): mozIStoragePendingStatement;
    executeSimpleSQLAsync(
      aSQLStatement: string,
      aCallback?: mozIStorageStatementCallback
    ): mozIStoragePendingStatement;
    loadExtension(aExtensionName: string, aCallback?: mozIStorageCompletionCallback): void;
    createFunction(aFunctionName: string, aNumArguments: i32, aFunction: mozIStorageFunction): void;
    removeFunction(aFunctionName: string): void;
    setProgressHandler(
      aGranularity: i32,
      aHandler: mozIStorageProgressHandler
    ): mozIStorageProgressHandler;
    removeProgressHandler(): mozIStorageProgressHandler;
    backupToFileAsync(
      aDestinationFile: nsIFile,
      aCallback: mozIStorageCompletionCallback,
      aPagesPerStep?: u32,
      aStepDelayMs?: u32
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageAsyncStatement.idl

  interface mozIStorageAsyncStatement extends mozIStorageBaseStatement {}

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageBaseStatement.idl

  interface mozIStorageBaseStatement extends mozIStorageBindingParams {
    readonly MOZ_STORAGE_STATEMENT_INVALID?: 0;
    readonly MOZ_STORAGE_STATEMENT_READY?: 1;
    readonly MOZ_STORAGE_STATEMENT_EXECUTING?: 2;

    finalize(): void;
    bindParameters(aParameters: mozIStorageBindingParamsArray): void;
    newBindingParamsArray(): mozIStorageBindingParamsArray;
    executeAsync(aCallback?: mozIStorageStatementCallback): mozIStoragePendingStatement;
    readonly state: i32;
    escapeStringForLIKE(aValue: string, aEscapeChar: string): string;
    escapeUTF8StringForLIKE(aValue: string, aEscapeChar: string): string;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageBindingParams.idl

  interface mozIStorageBindingParams extends nsISupports {
    bindByName(aName: string, aValue: nsIVariant): void;
    bindBlobByName(aName: string, aValue: u8[]): void;
    bindStringAsBlobByName(aName: string, aValue: string): void;
    bindUTF8StringAsBlobByName(aName: string, aValue: string): void;
    bindArrayOfIntegersByName(aName: string, aValue: i64[]): void;
    bindArrayOfDoublesByName(aName: string, aValue: double[]): void;
    bindArrayOfStringsByName(aName: string, aValue: string[]): void;
    bindArrayOfUTF8StringsByName(aName: string, aValue: string[]): void;
    bindByIndex(aIndex: u32, aValue: nsIVariant): void;
    bindBlobByIndex(aIndex: u32, aValue: u8[]): void;
    bindStringAsBlobByIndex(aIndex: u32, aValue: string): void;
    bindUTF8StringAsBlobByIndex(aIndex: u32, aValue: string): void;
    bindArrayOfIntegersByIndex(aIndex: u32, aValue: i64[]): void;
    bindArrayOfDoublesByIndex(aIndex: u32, aValue: double[]): void;
    bindArrayOfStringsByIndex(aIndex: u32, aValue: string[]): void;
    bindArrayOfUTF8StringsByIndex(aIndex: u32, aValue: string[]): void;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageBindingParamsArray.idl

  interface mozIStorageBindingParamsArray extends nsISupports {
    newBindingParams(): mozIStorageBindingParams;
    addParams(aParameters: mozIStorageBindingParams): void;
    readonly length: u32;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageCompletionCallback.idl

  type mozIStorageCompletionCallback = Callable<{
    complete(status: nsresult, value?: nsISupports): void;
  }>;

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageConnection.idl

  interface mozIStorageConnection extends mozIStorageAsyncConnection {
    close(): void;
    clone(aReadOnly?: boolean): mozIStorageConnection;
    readonly defaultPageSize: i32;
    readonly connectionReady: boolean;
    readonly lastInsertRowID: i64;
    readonly affectedRows: i32;
    readonly lastError: i32;
    readonly lastErrorString: string;
    schemaVersion: i32;
    createStatement(aSQLStatement: string): mozIStorageStatement;
    executeSimpleSQL(aSQLStatement: string): void;
    tableExists(aTableName: string): boolean;
    indexExists(aIndexName: string): boolean;
    beginTransaction(): void;
    commitTransaction(): void;
    rollbackTransaction(): void;
    createTable(aTableName: string, aTableSchema: string): void;
    setGrowthIncrement(aIncrement: i32, aDatabaseName: string): void;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageError.idl

  interface mozIStorageError extends nsISupports {
    readonly ERROR?: 1;
    readonly INTERNAL?: 2;
    readonly PERM?: 3;
    readonly ABORT?: 4;
    readonly BUSY?: 5;
    readonly LOCKED?: 6;
    readonly NOMEM?: 7;
    readonly READONLY?: 8;
    readonly INTERRUPT?: 9;
    readonly IOERR?: 10;
    readonly CORRUPT?: 11;
    readonly FULL?: 13;
    readonly CANTOPEN?: 14;
    readonly EMPTY?: 16;
    readonly SCHEMA?: 17;
    readonly TOOBIG?: 18;
    readonly CONSTRAINT?: 19;
    readonly MISMATCH?: 20;
    readonly MISUSE?: 21;
    readonly NOLFS?: 22;
    readonly AUTH?: 23;
    readonly FORMAT?: 24;
    readonly RANGE?: 25;
    readonly NOTADB?: 26;

    readonly result: i32;
    readonly message: string;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageFunction.idl

  type mozIStorageFunction = Callable<{
    onFunctionCall(aFunctionArguments: mozIStorageValueArray): nsIVariant;
  }>;

  // https://searchfox.org/mozilla-central/source/storage/mozIStoragePendingStatement.idl

  interface mozIStoragePendingStatement extends nsISupports {
    cancel(): void;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageProgressHandler.idl

  interface mozIStorageProgressHandler extends nsISupports {
    onProgress(aConnection: mozIStorageConnection): boolean;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageResultSet.idl

  interface mozIStorageResultSet extends nsISupports {
    getNextRow(): mozIStorageRow;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageRow.idl

  interface mozIStorageRow extends mozIStorageValueArray {
    getResultByIndex(aIndex: u32): nsIVariant;
    getResultByName(aName: string): nsIVariant;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageService.idl

  interface mozIStorageService extends nsISupports {
    readonly OPEN_DEFAULT?: 0;
    readonly OPEN_SHARED?: 1;
    readonly OPEN_READONLY?: 2;
    readonly OPEN_IGNORE_LOCKING_MODE?: 4;
    readonly OPEN_NOT_EXCLUSIVE?: 8;
    readonly CONNECTION_DEFAULT?: 0;
    readonly CONNECTION_INTERRUPTIBLE?: 1;

    openAsyncDatabase(
      aDatabaseStore: nsIVariant,
      aOpenFlags: u32,
      aConnectionFlags: u32,
      aCallback: mozIStorageCompletionCallback
    ): void;
    openSpecialDatabase(
      aStorageKey: string,
      aName?: string,
      aConnectionFlags?: u32
    ): mozIStorageConnection;
    openDatabase(aDatabaseFile: nsIFile, aConnectionFlags?: u32): mozIStorageConnection;
    openUnsharedDatabase(aDatabaseFile: nsIFile, aConnectionFlags?: u32): mozIStorageConnection;
    openDatabaseWithFileURL(
      aFileURL: nsIFileURL,
      aTelemetryFilename?: string,
      aConnectionFlags?: u32
    ): mozIStorageConnection;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageStatement.idl

  interface mozIStorageStatement extends mozIStorageBaseStatement {
    readonly VALUE_TYPE_NULL?: 0;
    readonly VALUE_TYPE_INTEGER?: 1;
    readonly VALUE_TYPE_FLOAT?: 2;
    readonly VALUE_TYPE_TEXT?: 3;
    readonly VALUE_TYPE_BLOB?: 4;

    clone(): mozIStorageStatement;
    readonly parameterCount: u32;
    getParameterName(aParamIndex: u32): string;
    getParameterIndex(aName: string): u32;
    readonly columnCount: u32;
    getColumnName(aColumnIndex: u32): string;
    getColumnIndex(aName: string): u32;
    reset(): void;
    execute(): void;
    executeStep(): boolean;
    readonly numEntries: u32;
    getTypeOfIndex(aIndex: u32): i32;
    getVariant(aIndex: u32): nsIVariant;
    getInt32(aIndex: u32): i32;
    getInt64(aIndex: u32): i64;
    getDouble(aIndex: u32): double;
    getUTF8String(aIndex: u32): string;
    getString(aIndex: u32): string;
    getBlob(aIndex: u32, aDataSize: OutParam<u32>, aData: OutParam<u8[]>): void;
    getBlobAsString(aIndex: u32): string;
    getBlobAsUTF8String(aIndex: u32): string;
    getIsNull(aIndex: u32): boolean;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageStatementCallback.idl

  interface mozIStorageStatementCallback extends nsISupports {
    readonly REASON_FINISHED?: 0;
    readonly REASON_CANCELED?: 1;
    readonly REASON_ERROR?: 2;

    handleResult(aResultSet: mozIStorageResultSet): void;
    handleError(aError: mozIStorageError): void;
    handleCompletion(aReason: u16): void;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageVacuumParticipant.idl

  interface mozIStorageVacuumParticipant extends nsISupports {
    readonly expectedDatabasePageSize: i32;
    readonly useIncrementalVacuum: boolean;
    readonly databaseConnection: mozIStorageAsyncConnection;
    onBeginVacuum(): boolean;
    onEndVacuum(aSucceeded: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/storage/mozIStorageValueArray.idl

  interface mozIStorageValueArray extends nsISupports {
    readonly VALUE_TYPE_NULL?: 0;
    readonly VALUE_TYPE_INTEGER?: 1;
    readonly VALUE_TYPE_FLOAT?: 2;
    readonly VALUE_TYPE_TEXT?: 3;
    readonly VALUE_TYPE_BLOB?: 4;

    readonly numEntries: u32;
    getTypeOfIndex(aIndex: u32): i32;
    getInt32(aIndex: u32): i32;
    getInt64(aIndex: u32): i64;
    getDouble(aIndex: u32): double;
    getUTF8String(aIndex: u32): string;
    getString(aIndex: u32): string;
    getBlob(aIndex: u32, aDataSize: OutParam<u32>, aData: OutParam<u8[]>): void;
    getBlobAsString(aIndex: u32): string;
    getBlobAsUTF8String(aIndex: u32): string;
    getIsNull(aIndex: u32): boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/telemetry/core/nsITelemetry.idl

  type nsIFetchTelemetryDataCallback = Callable<{
    complete(): void;
  }>;

  interface nsITelemetry extends nsISupports {
    readonly HISTOGRAM_EXPONENTIAL?: 0;
    readonly HISTOGRAM_LINEAR?: 1;
    readonly HISTOGRAM_BOOLEAN?: 2;
    readonly HISTOGRAM_FLAG?: 3;
    readonly HISTOGRAM_COUNT?: 4;
    readonly HISTOGRAM_CATEGORICAL?: 5;
    readonly SCALAR_TYPE_COUNT?: 0;
    readonly SCALAR_TYPE_STRING?: 1;
    readonly SCALAR_TYPE_BOOLEAN?: 2;
    readonly DATASET_ALL_CHANNELS?: 0;
    readonly DATASET_PRERELEASE_CHANNELS?: 1;
    readonly INCLUDE_OLD_LOADEVENTS?: 1;
    readonly KEEP_LOADEVENTS_NEW?: 2;
    readonly INCLUDE_PRIVATE_FIELDS_IN_LOADEVENTS?: 4;
    readonly EXCLUDE_STACKINFO_FROM_LOADEVENTS?: 8;

    getCategoricalLabels(): any;
    getSnapshotForHistograms(
      aStoreName?: string,
      aClearStore?: boolean,
      aFilterTest?: boolean
    ): any;
    getSnapshotForKeyedHistograms(
      aStoreName?: string,
      aClearStore?: boolean,
      aFilterTest?: boolean
    ): any;
    getSnapshotForScalars(aStoreName?: string, aClearStore?: boolean, aFilterTest?: boolean): any;
    getSnapshotForKeyedScalars(
      aStoreName?: string,
      aClearStore?: boolean,
      aFilterTest?: boolean
    ): any;
    readonly lastShutdownDuration: u32;
    readonly failedProfileLockCount: u32;
    readonly slowSQL: any;
    readonly debugSlowSQL: any;
    getUntrustedModuleLoadEvents(aFlags?: u32): Promise<any>;
    readonly areUntrustedModuleLoadEventsReady: boolean;
    getLoadedModules(): Promise<any>;
    readonly lateWrites: any;
    getHistogramById(id: string): any;
    getKeyedHistogramById(id: string): any;
    canRecordBase: boolean;
    canRecordExtended: boolean;
    readonly canRecordReleaseData: boolean;
    readonly canRecordPrereleaseData: boolean;
    readonly isOfficialTelemetry: boolean;
    asyncFetchTelemetryData(aCallback: nsIFetchTelemetryDataCallback): void;
    readonly fileIOReports: any;
    msSinceProcessStart(): double;
    msSinceProcessStartIncludingSuspend(): double;
    msSinceProcessStartExcludingSuspend(): double;
    msSystemNow(): double;
    clearScalars(): void;
    flushBatchedChildTelemetry(): void;
    snapshotEvents(aDataset: u32, aClear?: boolean, aEventLimit?: u32): any;
    registerBuiltinEvents(aCategory: string, aEventData: any): void;
    registerBuiltinScalars(aCategoryName: string, aScalarData: any): void;
    clearEvents(): void;
    getAllStores(): any;
    earlyInit(): void;
    delayedInit(): void;
    shutdown(): void;
    gatherMemory(): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/telemetry/dap/nsIDAPTelemetry.idl

  interface nsIDAPTelemetry extends nsISupports {
    GetReportU8(
      leaderHpkeConfig: u8[],
      helperHpkeConfig: u8[],
      measurement: u8,
      task_id: u8[],
      time_precision: u64,
      report: OutParam<u8[]>
    ): void;
    GetReportVecU8(
      leaderHpkeConfig: u8[],
      helperHpkeConfig: u8[],
      measurement: u8[],
      task_id: u8[],
      time_precision: u64,
      report: OutParam<u8[]>
    ): void;
    GetReportVecU16(
      leaderHpkeConfig: u8[],
      helperHpkeConfig: u8[],
      measurement: u16[],
      task_id: u8[],
      time_precision: u64,
      report: OutParam<u8[]>
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/test/httpserver/nsIHttpServer.idl

  interface nsIHttpServer extends nsISupports {
    start(port: i32): void;
    start_ipv6(port: i32): void;
    start_dualStack(port: i32): void;
    stop(callback: nsIHttpServerStoppedCallback): void;
    registerFile(path: string, file: nsIFile, handler?: nsIHttpRequestHandler): void;
    registerPathHandler(path: string, handler: nsIHttpRequestHandler): void;
    registerPrefixHandler(prefix: string, handler: nsIHttpRequestHandler): void;
    registerErrorHandler(code: u32, handler: nsIHttpRequestHandler): void;
    registerDirectory(path: string, dir: nsIFile): void;
    registerContentType(extension: string, type: string): void;
    setIndexHandler(handler: nsIHttpRequestHandler): void;
    readonly identity: nsIHttpServerIdentity;
    getState(path: string, key: string): string;
    setState(path: string, key: string, value: string): void;
    getSharedState(key: string): string;
    setSharedState(key: string, value: string): void;
    getObjectState(key: string): nsISupports;
    setObjectState(key: string, value: nsISupports): void;
  }

  type nsIHttpServerStoppedCallback = Callable<{
    onStopped(): void;
  }>;

  interface nsIHttpServerIdentity extends nsISupports {
    readonly primaryScheme: string;
    readonly primaryHost: string;
    readonly primaryPort: i32;
    add(scheme: string, host: string, port: i32): void;
    remove(scheme: string, host: string, port: i32): boolean;
    has(scheme: string, host: string, port: i32): boolean;
    getScheme(host: string, port: i32): string;
    setPrimary(scheme: string, host: string, port: i32): void;
  }

  type nsIHttpRequestHandler = Callable<{
    handle(request: nsIHttpRequest, response: nsIHttpResponse): void;
  }>;

  interface nsIHttpRequest extends nsISupports {
    readonly method: string;
    readonly scheme: string;
    readonly host: string;
    readonly port: u32;
    readonly path: string;
    readonly queryString: string;
    readonly httpVersion: string;
    getHeader(fieldName: string): string;
    hasHeader(fieldName: string): boolean;
    readonly headers: nsISimpleEnumerator;
    readonly bodyInputStream: nsIInputStream;
  }

  interface nsIHttpResponse extends nsISupports {
    setStatusLine(httpVersion: string, statusCode: u16, description: string): void;
    setHeader(name: string, value: string, merge?: boolean): void;
    setHeaderNoCheck(name: string, value: string): void;
    readonly bodyOutputStream: nsIOutputStream;
    write(data: string): void;
    processAsync(): void;
    seizePower(): void;
    finish(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/thumbnails/nsIPageThumbsStorageService.idl

  interface nsIPageThumbsStorageService extends nsISupports {
    getLeafNameForURL(aURL: string): string;
    readonly path: string;
    getFilePathForURL(aURL: string): string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/antitracking/bouncetrackingprotection/nsIBTPRemoteExceptionList.idl

  interface nsIBTPRemoteExceptionList extends nsISupports {
    init(aProtection: nsIBounceTrackingProtection): Promise<any>;
    shutdown(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/antitracking/bouncetrackingprotection/nsIBounceTrackingMapEntry.idl

  interface nsIBounceTrackingMapEntry extends nsISupports {
    readonly siteHost: string;
    readonly timeStamp: PRTime;
  }

  interface nsIBounceTrackingPurgeEntry extends nsIBounceTrackingMapEntry {
    readonly purgeTime: PRTime;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/antitracking/bouncetrackingprotection/nsIBounceTrackingProtection.idl
} // global

declare enum nsIBounceTrackingProtection_Modes {
  MODE_DISABLED = 0,
  MODE_ENABLED = 1,
  MODE_ENABLED_STANDBY = 2,
  MODE_ENABLED_DRY_RUN = 3,
  MAX_MODE_VALUE = 3,
}

declare global {
  namespace nsIBounceTrackingProtection {
    type Modes = nsIBounceTrackingProtection_Modes;
  }

  interface nsIBounceTrackingProtection
    extends nsISupports,
      Enums<typeof nsIBounceTrackingProtection_Modes> {
    clearAll(): void;
    clearBySiteHostAndOriginAttributes(aSiteHost: string, originAttributes: any): void;
    clearBySiteHostAndOriginAttributesPattern(
      aSiteHost: string,
      aOriginAttributesPattern: any
    ): void;
    clearByTimeRange(aFrom: PRTime, aTo: PRTime): void;
    clearByOriginAttributesPattern(aPattern: string): void;
    addSiteHostExceptions(aSiteHosts: string[]): void;
    removeSiteHostExceptions(aSiteHosts: string[]): void;
    hasRecentlyPurgedSite(aSiteHost: string): boolean;
    testGetSiteHostExceptions(): string[];
    testRunPurgeBounceTrackers(): Promise<any>;
    testClearExpiredUserActivations(): void;
    testGetBounceTrackerCandidateHosts(originAttributes: any): nsIBounceTrackingMapEntry[];
    testGetUserActivationHosts(originAttributes: any): nsIBounceTrackingMapEntry[];
    testAddBounceTrackerCandidate(
      originAttributes: any,
      aSiteHost: string,
      aBounceTime: PRTime
    ): void;
    testAddUserActivation(originAttributes: any, aSiteHost: string, aActivationTime: PRTime): void;
    testGetRecentlyPurgedTrackers(originAttributes: any): nsIBounceTrackingPurgeEntry[];
    testMaybeMigrateUserInteractionPermissions(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/antitracking/nsIContentBlockingAllowList.idl

  interface nsIContentBlockingAllowList extends nsISupports {
    computeContentBlockingAllowListPrincipal(aPrincipal: nsIPrincipal): nsIPrincipal;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/antitracking/nsIPartitioningExceptionListService.idl

  type nsIPartitioningExceptionListObserver = Callable<{
    onExceptionListUpdate(aList: string): void;
  }>;

  interface nsIPartitioningExceptionListService extends nsISupports {
    registerAndRunExceptionListObserver(aObserver: nsIPartitioningExceptionListObserver): void;
    unregisterExceptionListObserver(aObserver: nsIPartitioningExceptionListObserver): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/antitracking/nsIPurgeTrackerService.idl

  interface nsIPurgeTrackerService extends nsISupports {
    purgeTrackingCookieJars(): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/antitracking/nsITrackingDBService.idl

  interface nsITrackingDBService extends nsISupports {
    readonly OTHER_COOKIES_BLOCKED_ID?: 0;
    readonly TRACKERS_ID?: 1;
    readonly TRACKING_COOKIES_ID?: 2;
    readonly CRYPTOMINERS_ID?: 3;
    readonly FINGERPRINTERS_ID?: 4;
    readonly SOCIAL_ID?: 5;
    readonly SUSPICIOUS_FINGERPRINTERS_ID?: 6;
    readonly BOUNCETRACKERS_ID?: 7;

    recordContentBlockingLog(data: string): void;
    saveEvents(data: string): Promise<any>;
    clearAll(): Promise<any>;
    clearSince(since: i64): Promise<any>;
    getEventsByDateRange(dateFrom: i64, dateTo: i64): Promise<any>;
    sumAllEvents(): Promise<any>;
    getEarliestRecordedDate(): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/antitracking/nsIURLDecorationAnnotationsService.idl

  interface nsIURLDecorationAnnotationsService extends nsISupports {
    ensureUpdated(): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/antitracking/nsIURLQueryStringStripper.idl

  interface nsIURLQueryStringStripper extends nsISupports {
    strip(aURI: nsIURI, aIsPBM: boolean, aOutput: OutParam<nsIURI>): u32;
    stripForCopyOrShare(aURI: nsIURI): nsIURI;
    canStripForShare(aURI: nsIURI): boolean;
    testGetStripList(): string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/antitracking/nsIURLQueryStrippingListService.idl

  interface nsIURLQueryStrippingListObserver extends nsISupports {
    onQueryStrippingListUpdate(aStripList: string, aAllowList: string): void;
    onStripOnShareUpdate(aStripRules: string[]): void;
  }

  interface nsIURLQueryStrippingListService extends nsISupports {
    registerAndRunObserver(aObserver: nsIURLQueryStrippingListObserver): void;
    registerAndRunObserverStripOnShare(aObserver: nsIURLQueryStrippingListObserver): void;
    unregisterObserver(aObserver: nsIURLQueryStrippingListObserver): void;
    unregisterStripOnShareObserver(aObserver: nsIURLQueryStrippingListObserver): void;
    clearLists(): void;
    testWaitForInit(): Promise<any>;
    testSetList(testFile: any): Promise<any>;
    testHasStripOnShareObservers(): boolean;
    testHasQPSObservers(): boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/asyncshutdown/nsIAsyncShutdown.idl

  interface nsIAsyncShutdownBlocker extends nsISupports {
    readonly name: string;
    blockShutdown(aBarrierClient: nsIAsyncShutdownClient): void;
    readonly state: nsIPropertyBag;
  }

  interface nsIAsyncShutdownClient extends nsISupports {
    readonly name: string;
    readonly isClosed: boolean;
    addBlocker(
      aBlocker: nsIAsyncShutdownBlocker,
      aFileName: string,
      aLineNumber: i32,
      aStack: string
    ): void;
    removeBlocker(aBlocker: nsIAsyncShutdownBlocker): void;
    readonly jsclient: any;
  }

  type nsIAsyncShutdownCompletionCallback = Callable<{
    done(): void;
  }>;

  interface nsIAsyncShutdownBarrier extends nsISupports {
    readonly client: nsIAsyncShutdownClient;
    readonly state: nsIPropertyBag;
    wait(aOnReady: nsIAsyncShutdownCompletionCallback): void;
  }

  interface nsIAsyncShutdownService extends nsISupports {
    makeBarrier(aName: string): nsIAsyncShutdownBarrier;
    readonly profileBeforeChange: nsIAsyncShutdownClient;
    readonly profileChangeTeardown: nsIAsyncShutdownClient;
    readonly appShutdownConfirmed: nsIAsyncShutdownClient;
    readonly quitApplicationGranted: nsIAsyncShutdownClient;
    readonly sendTelemetry: nsIAsyncShutdownClient;
    readonly webWorkersShutdown: nsIAsyncShutdownClient;
    readonly xpcomWillShutdown: nsIAsyncShutdownClient;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/backgroundtasks/nsIBackgroundTasks.idl

  interface nsIBackgroundTasks extends nsISupports {
    readonly isBackgroundTaskMode: boolean;
    backgroundTaskName(): string;
    overrideBackgroundTaskNameForTesting(taskName: string): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/backgroundtasks/nsIBackgroundTasksManager.idl

  interface nsIBackgroundTasksManager extends nsICommandLineHandler {
    runBackgroundTaskNamed(aTaskName: string, aCommandLine: nsICommandLine): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/backgroundtasks/nsIBackgroundTasksRunner.idl

  interface nsIBackgroundTasksRunner extends nsISupports {
    runInDetachedProcess(aTaskName: string, aCommandLine: string[]): void;
    removeDirectoryInDetachedProcess(
      aParentDirPath: string,
      aChildDirName: string,
      aSecondsToWait: string,
      aOtherFoldersSuffix: string,
      aMetricsId?: string
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/cleardata/nsIClearBySiteEntry.idl

  interface nsIClearBySiteEntry extends nsISupports {
    schemelessSite: string;
    patternJSON: string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/cleardata/nsIClearDataService.idl

  interface nsIClearDataService extends nsISupports {
    readonly CLEAR_COOKIES?: 1;
    readonly CLEAR_NETWORK_CACHE?: 2;
    readonly CLEAR_IMAGE_CACHE?: 4;
    readonly CLEAR_JS_CACHE?: 8;
    readonly CLEAR_DOWNLOADS?: 16;
    readonly CLEAR_MEDIA_DEVICES?: 64;
    readonly CLEAR_DOM_QUOTA?: 128;
    readonly CLEAR_PREDICTOR_NETWORK_DATA?: 256;
    readonly CLEAR_DOM_PUSH_NOTIFICATIONS?: 512;
    readonly CLEAR_HISTORY?: 1024;
    readonly CLEAR_MESSAGING_LAYER_SECURITY_STATE?: 2048;
    readonly CLEAR_AUTH_TOKENS?: 4096;
    readonly CLEAR_AUTH_CACHE?: 8192;
    readonly CLEAR_SITE_PERMISSIONS?: 16384;
    readonly CLEAR_CONTENT_PREFERENCES?: 32768;
    readonly CLEAR_HSTS?: 65536;
    readonly CLEAR_EME?: 131072;
    readonly CLEAR_REPORTS?: 262144;
    readonly CLEAR_STORAGE_ACCESS?: 524288;
    readonly CLEAR_CERT_EXCEPTIONS?: 1048576;
    readonly CLEAR_CONTENT_BLOCKING_RECORDS?: 2097152;
    readonly CLEAR_CSS_CACHE?: 4194304;
    readonly CLEAR_PREFLIGHT_CACHE?: 8388608;
    readonly CLEAR_CLIENT_AUTH_REMEMBER_SERVICE?: 16777216;
    readonly CLEAR_CREDENTIAL_MANAGER_STATE?: 33554432;
    readonly CLEAR_COOKIE_BANNER_EXCEPTION?: 67108864;
    readonly CLEAR_COOKIE_BANNER_EXECUTED_RECORD?: 134217728;
    readonly CLEAR_FINGERPRINTING_PROTECTION_STATE?: 268435456;
    readonly CLEAR_BOUNCE_TRACKING_PROTECTION_STATE?: 536870912;
    readonly CLEAR_STORAGE_PERMISSIONS?: 1073741824;
    readonly CLEAR_SHUTDOWN_EXCEPTIONS?: 2147483648;
    readonly CLEAR_ALL?: 4294967295;
    readonly CLEAR_PERMISSIONS?: 2147500032;
    readonly CLEAR_ALL_CACHES?: 12648462;
    readonly CLEAR_DOM_STORAGES?: 262784;
    readonly CLEAR_FORGET_ABOUT_SITE?: 3218591647;
    readonly CLEAR_COOKIES_AND_SITE_DATA?: 2013739649;
    readonly CLEAR_STATE_FOR_TRACKER_PURGING?: 2043624143;

    deleteDataFromLocalFiles(
      aIsUserRequest: boolean,
      aFlags: u32,
      aCallback: nsIClearDataCallback
    ): void;
    deleteDataFromHost(
      aHost: string,
      aIsUserRequest: boolean,
      aFlags: u32,
      aCallback: nsIClearDataCallback
    ): void;
    deleteDataFromSite(
      aSchemelessSite: string,
      aOriginAttributesPattern: any,
      aIsUserRequest: boolean,
      aFlags: u32,
      aCallback: nsIClearDataCallback
    ): void;
    deleteDataFromSiteAndOriginAttributesPatternString(
      aSchemelessSite: string,
      aOriginAttributesPatternString: string,
      aIsUserRequest: boolean,
      aFlags: u32,
      aCallback: nsIClearDataCallback
    ): void;
    deleteDataFromPrincipal(
      aPrincipal: nsIPrincipal,
      aIsUserRequest: boolean,
      aFlags: u32,
      aCallback: nsIClearDataCallback
    ): void;
    deleteDataInTimeRange(
      aFrom: PRTime,
      aTo: PRTime,
      aIsUserRequest: boolean,
      aFlags: u32,
      aCallback: nsIClearDataCallback
    ): void;
    deleteData(aFlags: u32, aCallback: nsIClearDataCallback): void;
    deleteDataFromOriginAttributesPattern(
      aOriginAttributesPattern: any,
      aCallback?: nsIClearDataCallback
    ): void;
    deleteUserInteractionForClearingHistory(
      aPrincipalsWithStorage: nsIPrincipal[],
      aFrom?: PRTime,
      aCallback?: nsIClearDataCallback
    ): void;
    cleanupAfterDeletionAtShutdown(aFlags: u32, aCallback: nsIClearDataCallback): void;
    hostMatchesSite(
      aHost: string,
      aOriginAttributes: any,
      aSchemelessSite: string,
      aOriginAttributesPattern?: any
    ): boolean;
  }

  type nsIClearDataCallback = Callable<{
    onDataDeleted(aFailedFlags: u32): void;
  }>;

  // https://searchfox.org/mozilla-central/source/toolkit/components/contentanalysis/nsIContentAnalysis.idl
} // global

declare enum nsIContentAnalysisAcknowledgement_Result {
  eSuccess = 1,
  eInvalidResponse = 2,
  eTooLate = 3,
}

declare enum nsIContentAnalysisAcknowledgement_FinalAction {
  eUnspecified = 0,
  eAllow = 1,
  eReportOnly = 2,
  eWarn = 3,
  eBlock = 4,
}

declare global {
  namespace nsIContentAnalysisAcknowledgement {
    type Result = nsIContentAnalysisAcknowledgement_Result;
    type FinalAction = nsIContentAnalysisAcknowledgement_FinalAction;
  }

  interface nsIContentAnalysisAcknowledgement
    extends nsISupports,
      Enums<
        typeof nsIContentAnalysisAcknowledgement_Result &
          typeof nsIContentAnalysisAcknowledgement_FinalAction
      > {
    readonly result: nsIContentAnalysisAcknowledgement.Result;
    readonly finalAction: nsIContentAnalysisAcknowledgement.FinalAction;
  }

  interface nsIContentAnalysisResult extends nsISupports {
    readonly shouldAllowContent: boolean;
  }
} // global

declare enum nsIContentAnalysisResponse_Action {
  eUnspecified = 0,
  eReportOnly = 1,
  eWarn = 2,
  eBlock = 3,
  eAllow = 1000,
  eCanceled = 1001,
}

declare enum nsIContentAnalysisResponse_CancelError {
  eUserInitiated = 0,
  eNoAgent = 1,
  eInvalidAgentSignature = 2,
  eErrorOther = 3,
  eOtherRequestInGroupCancelled = 4,
  eShutdown = 5,
  eTimeout = 6,
}

declare global {
  namespace nsIContentAnalysisResponse {
    type Action = nsIContentAnalysisResponse_Action;
    type CancelError = nsIContentAnalysisResponse_CancelError;
  }

  interface nsIContentAnalysisResponse
    extends nsIContentAnalysisResult,
      Enums<
        typeof nsIContentAnalysisResponse_Action & typeof nsIContentAnalysisResponse_CancelError
      > {
    readonly action: nsIContentAnalysisResponse.Action;
    readonly cancelError: nsIContentAnalysisResponse.CancelError;
    readonly requestToken: string;
    readonly userActionId: string;
    readonly isCachedResponse: boolean;
    readonly isAgentResponse: boolean;
    acknowledge(aCaa: nsIContentAnalysisAcknowledgement): void;
  }

  interface nsIClientDownloadResource extends nsISupports {
    readonly DOWNLOAD_URL?: 0;
    readonly DOWNLOAD_REDIRECT?: 1;
    readonly TAB_URL?: 2;
    readonly TAB_REDIRECT?: 3;
    readonly PPAPI_DOCUMENT?: 4;
    readonly PPAPI_PLUGIN?: 5;

    readonly url: string;
    readonly type: u32;
  }
} // global

declare enum nsIContentAnalysisRequest_AnalysisType {
  eUnspecified = 0,
  eFileDownloaded = 1,
  eFileAttached = 2,
  eBulkDataEntry = 3,
  ePrint = 4,
  eFileTransfer = 5,
}

declare enum nsIContentAnalysisRequest_Reason {
  eUnknown = 0,
  eClipboardPaste = 1,
  eDragAndDrop = 2,
  eFilePickerDialog = 3,
  ePrintPreviewPrint = 4,
  eSystemDialogPrint = 5,
  eNormalDownload = 6,
  eSaveAsDownload = 7,
}

declare enum nsIContentAnalysisRequest_OperationType {
  eCustomDisplayString = 0,
  eClipboard = 1,
  eDroppedText = 2,
  eOperationPrint = 3,
}

declare global {
  namespace nsIContentAnalysisRequest {
    type AnalysisType = nsIContentAnalysisRequest_AnalysisType;
    type Reason = nsIContentAnalysisRequest_Reason;
    type OperationType = nsIContentAnalysisRequest_OperationType;
  }

  interface nsIContentAnalysisRequest
    extends nsISupports,
      Enums<
        typeof nsIContentAnalysisRequest_AnalysisType &
          typeof nsIContentAnalysisRequest_Reason &
          typeof nsIContentAnalysisRequest_OperationType
      > {
    readonly analysisType: nsIContentAnalysisRequest.AnalysisType;
    readonly reason: nsIContentAnalysisRequest.Reason;
    readonly operationTypeForDisplay: nsIContentAnalysisRequest.OperationType;
    readonly operationDisplayString: string;
    readonly dataTransfer: DataTransfer;
    readonly transferable: nsITransferable;
    readonly textContent: string;
    readonly filePath: string;
    readonly printDataHandle: u64;
    readonly printDataSize: u64;
    readonly printerName: string;
    readonly url: nsIURI;
    readonly sha256Digest: string;
    readonly resources: nsIClientDownloadResource[];
    readonly email: string;
    requestToken: string;
    readonly windowGlobalParent: WindowGlobalParent;
    userActionId: string;
    userActionRequestsCount: i64;
    readonly sourceWindowGlobal: WindowGlobalParent;
    timeoutMultiplier: u32;
  }

  interface nsIContentAnalysisCallback extends nsISupports {
    contentResult(aResult: nsIContentAnalysisResult): void;
    error(aResult: nsresult): void;
  }

  interface nsIContentAnalysisDiagnosticInfo extends nsISupports {
    readonly connectedToAgent: boolean;
    readonly agentPath: string;
    readonly failedSignatureVerification: boolean;
    readonly requestCount: i64;
  }

  interface nsIContentAnalysis extends nsISupports {
    readonly isActive: boolean;
    readonly mightBeActive: boolean;
    isSetByEnterprisePolicy: boolean;
    analyzeContentRequests(
      aCars: nsIContentAnalysisRequest[],
      aAutoAcknowledge: boolean
    ): Promise<any>;
    analyzeContentRequestsCallback(
      aCars: nsIContentAnalysisRequest[],
      aAutoAcknowledge: boolean,
      callback: nsIContentAnalysisCallback
    ): void;
    analyzeContentRequestPrivate(
      aRequest: nsIContentAnalysisRequest,
      aAutoAcknowledge: boolean,
      aCallback: nsIContentAnalysisCallback
    ): void;
    cancelRequestsByUserAction(aUserActionId: string): void;
    cancelRequestsByRequestToken(aRequestToken: string): void;
    respondToWarnDialog(aRequestToken: string, aAllowContent: boolean): void;
    cancelAllRequests(aForbidFutureRequests?: boolean): void;
    testOnlySetCACmdLineArg(aVal: boolean): void;
    getDiagnosticInfo(): Promise<any>;
    getURIForBrowsingContext(aBrowsingContext: BrowsingContext): nsIURI;
    getURIForDropEvent(aEvent: DragEvent): nsIURI;
    setCachedResponse(
      aURI: nsIURI,
      aSequenceNumber: i32,
      aAction: nsIContentAnalysisResponse.Action
    ): void;
    getCachedResponse(
      aURI: nsIURI,
      aSequenceNumber: i32,
      aAction: OutParam<nsIContentAnalysisResponse.Action>,
      aIsValid: OutParam<boolean>
    ): void;
    showBlockedRequestDialog(aRequest: nsIContentAnalysisRequest): void;
    makeResponseForTest(
      aAction: nsIContentAnalysisResponse.Action,
      aToken: string,
      aUserActionId: string
    ): nsIContentAnalysisResponse;
    sendCancelToAgent(aUserActionId: string): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/cookiebanners/nsIClickRule.idl
} // global

declare enum nsIClickRule_RunContext {
  RUN_TOP = 0,
  RUN_CHILD = 1,
  RUN_ALL = 2,
}

declare global {
  namespace nsIClickRule {
    type RunContext = nsIClickRule_RunContext;
  }

  interface nsIClickRule extends nsISupports, Enums<typeof nsIClickRule_RunContext> {
    readonly presence: string;
    readonly skipPresenceVisibilityCheck: boolean;
    readonly runContext: nsIClickRule.RunContext;
    readonly hide: string;
    readonly optOut: string;
    readonly optIn: string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/cookiebanners/nsICookieBannerListService.idl

  interface nsICookieBannerListService extends nsISupports {
    init(): void;
    initForTest(): Promise<any>;
    shutdown(): void;
    importAllRules(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/cookiebanners/nsICookieBannerRule.idl

  interface nsICookieBannerRule extends nsISupports {
    id: string;
    domains: string[];
    readonly cookiesOptOut: nsICookieRule[];
    readonly cookiesOptIn: nsICookieRule[];
    clearCookies(): void;
    addCookie(
      aIsOptOut: boolean,
      aName: string,
      aValue: string,
      aHost: string,
      aPath: string,
      aExpiryRelative: i64,
      aUnsetValue: string,
      aIsSecure: boolean,
      aIsHttpOnly: boolean,
      aIsSession: boolean,
      aSameSite: i32,
      aSchemeMap: nsICookie.schemeType
    ): void;
    readonly clickRule: nsIClickRule;
    addClickRule(
      aPresence: string,
      aSkipPresenceVisibilityCheck?: boolean,
      aRunContext?: nsIClickRule.RunContext,
      aHide?: string,
      aOptOut?: string,
      aOptIn?: string
    ): void;
    clearClickRule(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/cookiebanners/nsICookieBannerService.idl
} // global

declare enum nsICookieBannerService_Modes {
  MODE_DISABLED = 0,
  MODE_REJECT = 1,
  MODE_REJECT_OR_ACCEPT = 2,
  MODE_UNSET = 3,
}

declare global {
  namespace nsICookieBannerService {
    type Modes = nsICookieBannerService_Modes;
  }

  interface nsICookieBannerService extends nsISupports, Enums<typeof nsICookieBannerService_Modes> {
    readonly isEnabled: boolean;
    readonly rules: nsICookieBannerRule[];
    resetRules(doImport?: boolean): void;
    getCookiesForURI(aURI: nsIURI, aIsPrivateBrowsing: boolean): nsICookieRule[];
    getClickRulesForDomain(aDomain: string, aIsTopLevel: boolean): nsIClickRule[];
    insertRule(aRule: nsICookieBannerRule): void;
    removeRule(aRule: nsICookieBannerRule): void;
    hasRuleForBrowsingContextTree(aBrowsingContext: BrowsingContext): boolean;
    getDomainPref(aTopLevelURI: nsIURI, aIsPrivate: boolean): nsICookieBannerService.Modes;
    setDomainPref(
      aTopLevelURI: nsIURI,
      aMode: nsICookieBannerService.Modes,
      aIsPrivate: boolean
    ): void;
    setDomainPrefAndPersistInPrivateBrowsing(
      aTopLevelURI: nsIURI,
      aMode: nsICookieBannerService.Modes
    ): void;
    removeDomainPref(aTopLevelURI: nsIURI, aIsPrivate: boolean): void;
    removeAllDomainPrefs(aIsPrivate: boolean): void;
    shouldStopBannerClickingForSite(
      aSite: string,
      aIsTopLevel: boolean,
      aIsPrivate: boolean
    ): boolean;
    markSiteExecuted(aSite: string, aIsTopLevel: boolean, aIsPrivate: boolean): void;
    removeExecutedRecordForSite(aSite: string, aIsPrivate: boolean): void;
    removeAllExecutedRecords(aIsPrivate: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/cookiebanners/nsICookieBannerTelemetryService.idl

  interface nsICookieBannerTelemetryService extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/toolkit/components/cookiebanners/nsICookieRule.idl

  interface nsICookieRule extends nsISupports {
    readonly cookie: nsICookie;
    readonly expiryRelative: i64;
    readonly unsetValue: string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/crashes/nsICrashService.idl

  interface nsICrashService extends nsISupports {
    readonly CRASH_TYPE_CRASH?: 0;
    readonly CRASH_TYPE_HANG?: 1;

    addCrash(processType: i32, crashType: i32, id: string): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/finalizationwitness/nsIFinalizationWitnessService.idl

  interface nsIFinalizationWitnessService extends nsISupports {
    make(aTopic: string, aString: string): any;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/modules/nsIBrowserWindowTracker.idl

  interface nsIVisibleTab extends nsISupports {
    contentTitle: string;
    browserId: i64;
  }

  interface nsIBrowserWindowTracker extends nsISupports {
    getAllVisibleTabs(): nsIVisibleTab[];
    getBrowserById(aBrowserId: u64): nsISupports;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/modules/nsIRegion.idl

  interface nsIRegion extends nsISupports {
    readonly current: string;
    readonly home: string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/processtools/nsIProcessToolsService.idl

  interface nsIProcessToolsService extends nsISupports {
    kill(pid: u64): void;
    crash(pid: u64): void;
    readonly pid: u64;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/resistfingerprinting/nsIFingerprintingWebCompatService.idl

  interface nsIFingerprintingOverride extends nsISupports {
    readonly firstPartyDomain: string;
    readonly thirdPartyDomain: string;
    readonly overrides: string;
  }

  interface nsIFingerprintingWebCompatService extends nsISupports {
    init(): void;
    shutdown(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/resistfingerprinting/nsIRFPService.idl

  interface nsIRFPService extends nsISupports {
    setFingerprintingOverrides(aOverrides: nsIFingerprintingOverride[]): void;
    getFingerprintingOverrides(aDomainKey: string): nsIRFPTargetSetIDL;
    cleanAllOverrides(): void;
    readonly enabledFingerprintingProtections: nsIRFPTargetSetIDL;
    cleanAllRandomKeys(): void;
    cleanRandomKeyByPrincipal(aPrincipal: nsIPrincipal): void;
    cleanRandomKeyBySite(aSchemelessSite: string, originAttributes: any): void;
    cleanRandomKeyByHost(aHost: string, aPattern: string): void;
    cleanRandomKeyByOriginAttributesPattern(aPattern: string): void;
    testGenerateRandomKey(aChannel: nsIChannel): u8[];
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/resistfingerprinting/nsIRFPTargetSetIDL.idl

  interface nsIRFPTargetSetIDL extends nsISupports {
    low: u64;
    high: u64;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/resistfingerprinting/nsIUserCharacteristicsPageService.idl

  interface nsIUserCharacteristicsPageService extends nsISupports {
    createContentPage(principal: nsIPrincipal): Promise<any>;
    pageLoaded(browsingContext: BrowsingContext, data: any): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/search/nsISearchService.idl

  interface nsISearchSubmission extends nsISupports {
    readonly postData: nsIInputStream;
    readonly uri: nsIURI;
  }

  interface nsISearchEngine extends nsISupports {
    getSubmission(searchTerms: string, responseType?: string): nsISearchSubmission;
    searchTermFromResult(uri: nsIURI): string;
    readonly searchUrlQueryParamName: string;
    readonly searchUrlPublicSuffix: string;
    supportsResponseType(responseType: string): boolean;
    getIconURL(preferredWidth?: u16): Promise<any>;
    speculativeConnect(options: any): void;
    alias: string;
    readonly aliases: string[];
    hidden: boolean;
    hideOneOffButton: boolean;
    readonly name: string;
    readonly id: string;
    readonly telemetryId: string;
    readonly identifier: string;
    readonly isAppProvided: boolean;
    readonly inMemory: boolean;
    readonly overriddenById: string;
    readonly isGeneralPurposeEngine: boolean;
    readonly searchUrlDomain: string;
    readonly clickUrl: string;
    readonly searchForm: string;
    readonly partnerCode: string;
  }

  interface nsISearchParseSubmissionResult extends nsISupports {
    readonly engine: nsISearchEngine;
    readonly terms: string;
    readonly termsParameterName: string;
  }
} // global

declare enum nsISearchService_OpenSearchInstallErrors {
  ERROR_DOWNLOAD_FAILURE = 1,
  ERROR_DUPLICATE_ENGINE = 2,
  ERROR_ENGINE_CORRUPTED = 3,
}

declare enum nsISearchService_DefaultEngineChangeReason {
  CHANGE_REASON_UNKNOWN = 0,
  CHANGE_REASON_USER = 1,
  CHANGE_REASON_USER_PRIVATE_SPLIT = 2,
  CHANGE_REASON_USER_SEARCHBAR = 3,
  CHANGE_REASON_USER_SEARCHBAR_CONTEXT = 4,
  CHANGE_REASON_ADDON_INSTALL = 5,
  CHANGE_REASON_ADDON_UNINSTALL = 6,
  CHANGE_REASON_CONFIG = 7,
  CHANGE_REASON_LOCALE = 8,
  CHANGE_REASON_REGION = 9,
  CHANGE_REASON_EXPERIMENT = 10,
  CHANGE_REASON_ENTERPRISE = 11,
  CHANGE_REASON_UITOUR = 12,
  CHANGE_REASON_ENGINE_UPDATE = 13,
  CHANGE_REASON_USER_PRIVATE_PREF_ENABLED = 14,
}

declare global {
  namespace nsISearchService {
    type OpenSearchInstallErrors = nsISearchService_OpenSearchInstallErrors;
    type DefaultEngineChangeReason = nsISearchService_DefaultEngineChangeReason;
  }

  interface nsISearchService
    extends nsISupports,
      Enums<
        typeof nsISearchService_OpenSearchInstallErrors &
          typeof nsISearchService_DefaultEngineChangeReason
      > {
    init(): Promise<any>;
    readonly promiseInitialized: Promise<any>;
    readonly isInitialized: boolean;
    readonly hasSuccessfullyInitialized: boolean;
    runBackgroundChecks(): Promise<any>;
    resetToAppDefaultEngine(): void;
    addOpenSearchEngine(engineURL: string, iconURL: string): Promise<any>;
    addUserEngine(formInfo: any): Promise<any>;
    addEnginesFromExtension(extension: any): Promise<any>;
    restoreDefaultEngines(): void;
    getEngineByAlias(alias: string): Promise<any>;
    getEngineByName(aEngineName: string): nsISearchEngine;
    getEngineById(aEngineId: string): nsISearchEngine;
    getEngines(): Promise<any>;
    getVisibleEngines(): Promise<any>;
    getAppProvidedEngines(): Promise<any>;
    getEnginesByExtensionID(extensionID: string): Promise<any>;
    findContextualSearchEngineByHost(host: string): Promise<any>;
    shouldShowInstallPrompt(engine: any): Promise<any>;
    addSearchEngine(engine: any): Promise<any>;
    moveEngine(engine: nsISearchEngine, newIndex: i32): Promise<any>;
    removeEngine(engine: nsISearchEngine): Promise<any>;
    removeWebExtensionEngine(id: string): Promise<any>;
    readonly appDefaultEngine: nsISearchEngine;
    readonly appPrivateDefaultEngine: nsISearchEngine;
    defaultEngine: nsISearchEngine;
    getDefault(): Promise<any>;
    setDefault(engine: nsISearchEngine, changeSource: u16): Promise<any>;
    defaultPrivateEngine: nsISearchEngine;
    getDefaultPrivate(): Promise<any>;
    setDefaultPrivate(engine: nsISearchEngine, changeSource: u16): Promise<any>;
    readonly separatePrivateDefaultUrlbarResultEnabled: boolean;
    maybeSetAndOverrideDefault(extension: any): Promise<any>;
    getDefaultEngineInfo(): any;
    parseSubmissionURL(url: string): nsISearchParseSubmissionResult;
    getAlternateDomains(domain: string): string[];
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/shell/nsIToolkitShellService.idl

  interface nsIToolkitShellService extends nsISupports {
    isDefaultApplication(): boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/terminator/nsITerminatorTest.idl

  interface nsITerminatorTest extends nsISupports {
    getTicksForShutdownPhases(): any;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/xulstore/nsIXULStore.idl

  interface nsIXULStore extends nsISupports {
    persist(aNode: Node, attr: string): void;
    setValue(doc: string, id: string, attr: string, value: string): void;
    hasValue(doc: string, id: string, attr: string): boolean;
    getValue(doc: string, id: string, attr: string): string;
    removeValue(doc: string, id: string, attr: string): void;
    removeDocument(doc: string): void;
    getIDsEnumerator(doc: string): nsIStringEnumerator;
    getAttributeEnumerator(doc: string, id: string): nsIStringEnumerator;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/profile/nsIProfileMigrator.idl

  interface nsIProfileStartup extends nsISupports {
    readonly directory: nsIFile;
    doStartup(): void;
  }

  interface nsIProfileMigrator extends nsISupports {
    migrate(aStartup: nsIProfileStartup, aKey: string, aProfileName?: string): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/profile/nsIProfileUnlocker.idl

  interface nsIProfileUnlocker extends nsISupports {
    readonly ATTEMPT_QUIT?: 0;
    readonly FORCE_QUIT?: 1;

    unlock(aSeverity: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/profile/nsIToolkitProfile.idl

  interface nsIProfileLock extends nsISupports {
    readonly directory: nsIFile;
    readonly localDirectory: nsIFile;
    readonly replacedLockTime: PRTime;
    unlock(): void;
  }

  interface nsIToolkitProfile extends nsISupports {
    rootDir: nsIFile;
    readonly localDir: nsIFile;
    name: string;
    storeID: string;
    showProfileSelector: boolean;
    remove(removeFiles: boolean): void;
    removeInBackground(removeFiles: boolean): void;
    lock(aUnlocker: OutParam<nsIProfileUnlocker>): nsIProfileLock;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/profile/nsIToolkitProfileService.idl
} // global

declare enum nsIToolkitProfileService_downgradeUIFlags {
  hasSync = 1,
}

declare enum nsIToolkitProfileService_downgradeUIChoice {
  quit = 0,
  createNewProfile = 1,
}

declare enum nsIToolkitProfileService_profileManagerResult {
  exit = 0,
  launchWithProfile = 1,
  restart = 2,
}

declare global {
  namespace nsIToolkitProfileService {
    type downgradeUIFlags = nsIToolkitProfileService_downgradeUIFlags;
    type downgradeUIChoice = nsIToolkitProfileService_downgradeUIChoice;
    type profileManagerResult = nsIToolkitProfileService_profileManagerResult;
  }

  interface nsIToolkitProfileService
    extends nsISupports,
      Enums<
        typeof nsIToolkitProfileService_downgradeUIFlags &
          typeof nsIToolkitProfileService_downgradeUIChoice &
          typeof nsIToolkitProfileService_profileManagerResult
      > {
    readonly isListOutdated: boolean;
    startWithLastProfile: boolean;
    readonly profiles: nsISimpleEnumerator;
    readonly currentProfile: nsIToolkitProfile;
    readonly groupProfile: nsIToolkitProfile;
    defaultProfile: nsIToolkitProfile;
    selectStartupProfile(
      aArgv: string[],
      aIsResetting: boolean,
      aUpdateChannel: string,
      aLegacyInstallHash: string,
      aRootDir: OutParam<nsIFile>,
      aLocalDir: OutParam<nsIFile>,
      aProfile: OutParam<nsIToolkitProfile>
    ): boolean;
    getProfileByName(aName: string): nsIToolkitProfile;
    getProfileByDir(aRootDir: nsIFile, aLocalDir?: nsIFile): nsIToolkitProfile;
    createProfile(aRootDir: nsIFile, aName: string): nsIToolkitProfile;
    createUniqueProfile(aRootDir: nsIFile, aNamePrefix: string): nsIToolkitProfile;
    readonly profileCount: u32;
    flush(): void;
    asyncFlush(): Promise<any>;
    asyncFlushGroupProfile(): Promise<any>;
    removeProfileFilesByPath(aRootDir: nsIFile, aLocalDir: nsIFile, aTimeout: u32): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/remote/nsIRemoteService.idl

  interface nsIRemoteService extends nsISupports {
    sendCommandLine(aProfile: string, aArgs: string[], aRaise?: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/editor/txmgr/nsITransaction.idl

  interface nsITransaction extends nsISupports {
    doTransaction(): void;
    undoTransaction(): void;
    redoTransaction(): void;
    readonly isTransient: boolean;
    merge(aTransaction: nsITransaction): boolean;
  }

  // https://searchfox.org/mozilla-central/source/editor/txmgr/nsITransactionManager.idl

  interface nsITransactionManager extends nsISupports {
    doTransaction(aTransaction: nsITransaction): void;
    undoTransaction(): void;
    redoTransaction(): void;
    clear(): void;
    clearUndoStack(): void;
    clearRedoStack(): void;
    beginBatch(aData: nsISupports): void;
    endBatch(aAllowEmpty: boolean): void;
    readonly numberOfUndoItems: i32;
    readonly numberOfRedoItems: i32;
    maxTransactionCount: i32;
    batchTopUndo(): void;
    removeTopUndo(): void;
    peekUndoStack(): nsITransaction;
    peekRedoStack(): nsITransaction;
  }

  // https://searchfox.org/mozilla-central/source/editor/spellchecker/nsIInlineSpellChecker.idl

  interface nsIInlineSpellChecker extends nsISupports {
    readonly spellChecker: nsIEditorSpellCheck;
    init(aEditor: nsIEditor): void;
    cleanup(aDestroyingFrames: boolean): void;
    enableRealTimeSpell: boolean;
    spellCheckRange(aSelection: Range): void;
    getMisspelledWord(aNode: Node, aOffset: u32): Range;
    replaceWord(aNode: Node, aOffset: u32, aNewword: string): void;
    addWordToDictionary(aWord: string): void;
    removeWordFromDictionary(aWord: string): void;
    ignoreWord(aWord: string): void;
    ignoreWords(aWordsToIgnore: string[]): void;
    updateCurrentDictionary(): void;
    readonly spellCheckPending: boolean;
  }

  // https://searchfox.org/mozilla-central/source/intl/uconv/nsIScriptableUConv.idl

  interface nsIScriptableUnicodeConverter extends nsISupports {
    ConvertFromUnicode(aSrc: string): string;
    Finish(): string;
    ConvertToUnicode(aSrc: string): string;
    charset: string;
    isInternal: boolean;
  }

  // https://searchfox.org/mozilla-central/source/intl/uconv/nsITextToSubURI.idl

  interface nsITextToSubURI extends nsISupports {
    ConvertAndEscape(charset: string, text: string): string;
    UnEscapeAndConvert(charset: string, text: string): string;
    unEscapeURIForUI(aURIFragment: string, aDontEscape?: boolean): string;
    unEscapeNonAsciiURI(aCharset: string, aURIFragment: string): string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/timermanager/nsIUpdateTimerManager.idl

  interface nsIUpdateTimerManager extends nsISupports {
    registerTimer(id: string, callback: nsITimerCallback, interval: u32, skipFirst?: boolean): void;
    unregisterTimer(id: string): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/mozapps/update/nsIUpdateService.idl

  interface nsIUpdatePatch extends nsISupports {
    readonly type: string;
    readonly URL: string;
    finalURL: string;
    readonly size: u32;
    state: string;
    errorCode: i32;
    selected: boolean;
    serialize(updates: Document): Element;
  }

  interface nsIUpdate extends nsISupports {
    readonly type: string;
    readonly name: string;
    readonly displayVersion: string;
    readonly appVersion: string;
    readonly platformVersion: string;
    readonly previousAppVersion: string;
    readonly buildID: string;
    readonly detailsURL: string;
    readonly serviceURL: string;
    readonly channel: string;
    readonly unsupported: boolean;
    promptWaitTime: i64;
    isCompleteUpdate: boolean;
    installDate: i64;
    statusText: string;
    readonly selectedPatch: nsIUpdatePatch;
    state: string;
    errorCode: i32;
    elevationFailure: boolean;
    readonly patchCount: u32;
    getPatchAt(index: u32): nsIUpdatePatch;
    serialize(updates: Document): Element;
  }

  interface nsIUpdateCheckResult extends nsISupports {
    readonly checksAllowed: boolean;
    readonly succeeded: boolean;
    readonly request: any;
    readonly updates: nsIUpdate[];
  }

  interface nsIUpdateCheck extends nsISupports {
    readonly id: i32;
    readonly result: Promise<any>;
  }

  interface nsIUpdateCheckerInternal extends nsISupports {
    checkForUpdates(checkType: i32): nsIUpdateCheck;
  }

  interface nsIUpdateChecker extends nsISupports {
    readonly BACKGROUND_CHECK?: 1;
    readonly FOREGROUND_CHECK?: 2;

    checkForUpdates(checkType: i32): nsIUpdateCheck;
    getUpdateURL(checkType: i32): Promise<any>;
    stopCheck(id: i32): void;
    stopAllChecks(): void;
    readonly internal: nsIUpdateCheckerInternal;
  }

  interface nsIApplicationUpdateServiceInternal extends nsISupports {
    init(force: boolean): Promise<any>;
    downloadUpdate(update: nsIUpdate): Promise<any>;
    stopDownload(): Promise<any>;
  }

  interface nsIApplicationUpdateService extends nsISupports {
    readonly DOWNLOAD_SUCCESS?: 1;
    readonly DOWNLOAD_FAILURE_CANNOT_RESUME_IN_BACKGROUND?: 2;
    readonly DOWNLOAD_FAILURE_GENERIC?: 3;
    readonly STATE_IDLE?: 1;
    readonly STATE_DOWNLOADING?: 2;
    readonly STATE_STAGING?: 4;
    readonly STATE_PENDING?: 5;
    readonly STATE_SWAP?: 6;

    init(): Promise<any>;
    checkForBackgroundUpdates(): Promise<any>;
    selectUpdate(updates: nsIUpdate[]): Promise<any>;
    addDownloadListener(listener: nsIRequestObserver): void;
    removeDownloadListener(listener: nsIRequestObserver): void;
    downloadUpdate(update: nsIUpdate): Promise<any>;
    onCheckComplete(result: nsIUpdateCheckResult): Promise<any>;
    stopDownload(): Promise<any>;
    readonly disabled: boolean;
    readonly canUsuallyCheckForUpdates: boolean;
    readonly canCheckForUpdates: boolean;
    readonly elevationRequired: boolean;
    readonly canUsuallyApplyUpdates: boolean;
    readonly canApplyUpdates: boolean;
    readonly isOtherInstanceHandlingUpdates: boolean;
    readonly canUsuallyStageUpdates: boolean;
    readonly canStageUpdates: boolean;
    readonly canUsuallyUseBits: boolean;
    readonly canUseBits: boolean;
    readonly manualUpdateOnly: boolean;
    readonly isAppBaseDirWritable: boolean;
    onlyDownloadUpdatesThisSession: boolean;
    getStateName(state: i32): string;
    readonly currentState: i32;
    readonly stateTransition: Promise<any>;
    readonly internal: nsIApplicationUpdateServiceInternal;
  }

  interface nsIUpdateProcessor extends nsISupports {
    processUpdate(): void;
    getServiceRegKeyExists(): boolean;
    attemptAutomaticApplicationRestartWithLaunchArgs(argvExtra: string[]): i32;
    waitForProcessExit(pid: u32, timeoutMS: u32): void;
  }

  interface nsIUpdateSyncManager extends nsISupports {
    isOtherInstanceRunning(): boolean;
    resetLock(anAppFile?: nsIFile): void;
  }

  interface nsIUpdateMutex extends nsISupports {
    isLocked(): boolean;
    tryLock(): boolean;
    unlock(): void;
  }

  interface nsIUpdateManagerInternal extends nsISupports {
    reload(skipFiles: boolean): Promise<any>;
    getHistory(): nsIUpdate[];
    addUpdateToHistory(update: nsIUpdate): void;
    readyUpdate: nsIUpdate;
    downloadingUpdate: nsIUpdate;
    refreshUpdateStatus(): Promise<any>;
  }

  interface nsIUpdateManager extends nsISupports {
    getHistory(): Promise<any>;
    getReadyUpdate(): Promise<any>;
    getDownloadingUpdate(): Promise<any>;
    updateInstalledAtStartup(): Promise<any>;
    lastUpdateInstalled(): Promise<any>;
    addUpdateToHistory(update: nsIUpdate): Promise<any>;
    saveUpdates(): void;
    refreshUpdateStatus(): Promise<any>;
    elevationOptedIn(): Promise<any>;
    cleanupDownloadingUpdate(): Promise<any>;
    cleanupReadyUpdate(): Promise<any>;
    cleanupActiveUpdates(): Promise<any>;
    doInstallCleanup(): Promise<any>;
    doUninstallCleanup(): Promise<any>;
    readonly internal: nsIUpdateManagerInternal;
  }

  interface nsIApplicationUpdateServiceStub extends nsISupports {
    init(): Promise<any>;
    initUpdate(): Promise<any>;
    readonly updateDisabled: boolean;
    readonly updateDisabledForTesting: boolean;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/base/nsCURILoader.idl

  // https://searchfox.org/mozilla-central/source/uriloader/base/nsIContentHandler.idl

  interface nsIContentHandler extends nsISupports {
    handleContent(
      aContentType: string,
      aWindowContext: nsIInterfaceRequestor,
      aRequest: nsIRequest
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/base/nsIDocumentLoader.idl

  interface nsIDocumentLoader extends nsISupports {
    stop(): void;
    readonly container: nsISupports;
    readonly loadGroup: nsILoadGroup;
    readonly documentChannel: nsIChannel;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/base/nsITransfer.idl

  interface nsITransfer extends nsIWebProgressListener2 {
    readonly DOWNLOAD_ACCEPTABLE?: 0;
    readonly DOWNLOAD_FORBIDDEN?: 1;
    readonly DOWNLOAD_POTENTIALLY_UNSAFE?: 2;

    init(
      aSource: nsIURI,
      aSourceOriginalURI: nsIURI,
      aTarget: nsIURI,
      aDisplayName: string,
      aMIMEInfo: nsIMIMEInfo,
      startTime: PRTime,
      aTempFile: nsIFile,
      aCancelable: nsICancelable,
      aIsPrivate: boolean,
      aDownloadClassification: i32,
      aReferrerInfo: nsIReferrerInfo,
      aOpenDownloadsListOnStart?: boolean
    ): void;
    initWithBrowsingContext(
      aSource: nsIURI,
      aTarget: nsIURI,
      aDisplayName: string,
      aMIMEInfo: nsIMIMEInfo,
      startTime: PRTime,
      aTempFile: nsIFile,
      aCancelable: nsICancelable,
      aIsPrivate: boolean,
      aDownloadClassification: i32,
      aReferrerInfo: nsIReferrerInfo,
      aOpenDownloadsListOnStart: boolean,
      aBrowsingContext: BrowsingContext,
      aHandleInternally: boolean,
      aHttpChannel: nsIHttpChannel
    ): void;
    setSha256Hash(aHash: string): void;
    setSignatureInfo(aSignatureInfo: u8[][][]): void;
    setRedirects(aRedirects: nsIArray): void;
    readonly downloadPromise: Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/base/nsIURIContentListener.idl

  interface nsIURIContentListener extends nsISupports {
    doContent(
      aContentType: string,
      aIsContentPreferred: boolean,
      aRequest: nsIRequest,
      aContentHandler: OutParam<nsIStreamListener>
    ): boolean;
    isPreferred(aContentType: string, aDesiredContentType: OutParam<string>): boolean;
    canHandleContent(
      aContentType: string,
      aIsContentPreferred: boolean,
      aDesiredContentType: OutParam<string>
    ): boolean;
    loadCookie: nsISupports;
    parentContentListener: nsIURIContentListener;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/base/nsIURILoader.idl

  interface nsIURILoader extends nsISupports {
    readonly IS_CONTENT_PREFERRED?: 1;
    readonly DONT_RETARGET?: 2;

    registerContentListener(aContentListener: nsIURIContentListener): void;
    unRegisterContentListener(aContentListener: nsIURIContentListener): void;
    openURI(aChannel: nsIChannel, aFlags: u32, aWindowContext: nsIInterfaceRequestor): void;
    openChannel(
      aChannel: nsIChannel,
      aFlags: u32,
      aWindowContext: nsIInterfaceRequestor
    ): nsIStreamListener;
    stop(aLoadCookie: nsISupports): void;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/base/nsIWebProgress.idl

  interface nsIWebProgress extends nsISupports {
    readonly NOTIFY_STATE_REQUEST?: 1;
    readonly NOTIFY_STATE_DOCUMENT?: 2;
    readonly NOTIFY_STATE_NETWORK?: 4;
    readonly NOTIFY_STATE_WINDOW?: 8;
    readonly NOTIFY_STATE_ALL?: 15;
    readonly NOTIFY_PROGRESS?: 16;
    readonly NOTIFY_STATUS?: 32;
    readonly NOTIFY_SECURITY?: 64;
    readonly NOTIFY_LOCATION?: 128;
    readonly NOTIFY_REFRESH?: 256;
    readonly NOTIFY_CONTENT_BLOCKING?: 512;
    readonly NOTIFY_ALL?: 1023;

    addProgressListener(aListener: nsIWebProgressListener, aNotifyMask: u32): void;
    removeProgressListener(aListener: nsIWebProgressListener): void;
    readonly browsingContext: BrowsingContext;
    readonly DOMWindow: mozIDOMWindowProxy;
    readonly isTopLevel: boolean;
    readonly isLoadingDocument: boolean;
    readonly loadType: u32;
    target: nsIEventTarget;
    readonly documentRequest: nsIRequest;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/base/nsIWebProgressListener.idl

  interface nsIWebProgressListener extends nsISupports {
    readonly STATE_START?: 1;
    readonly STATE_REDIRECTING?: 2;
    readonly STATE_TRANSFERRING?: 4;
    readonly STATE_NEGOTIATING?: 8;
    readonly STATE_STOP?: 16;
    readonly STATE_IS_REQUEST?: 65536;
    readonly STATE_IS_DOCUMENT?: 131072;
    readonly STATE_IS_NETWORK?: 262144;
    readonly STATE_IS_WINDOW?: 524288;
    readonly STATE_IS_REDIRECTED_DOCUMENT?: 1048576;
    readonly STATE_RESTORING?: 16777216;
    readonly STATE_IS_INSECURE?: 4;
    readonly STATE_IS_BROKEN?: 1;
    readonly STATE_IS_SECURE?: 2;
    readonly STATE_BLOCKED_MIXED_ACTIVE_CONTENT?: 16;
    readonly STATE_LOADED_MIXED_ACTIVE_CONTENT?: 32;
    readonly STATE_BLOCKED_MIXED_DISPLAY_CONTENT?: 256;
    readonly STATE_LOADED_MIXED_DISPLAY_CONTENT?: 512;
    readonly STATE_IDENTITY_EV_TOPLEVEL?: 1048576;
    readonly STATE_IDENTITY_ASSOCIATED?: 2097152;
    readonly STATE_USES_SSL_3?: 16777216;
    readonly STATE_USES_WEAK_CRYPTO?: 33554432;
    readonly STATE_CERT_USER_OVERRIDDEN?: 67108864;
    readonly STATE_BLOCKED_TRACKING_CONTENT?: 4096;
    readonly STATE_LOADED_LEVEL_1_TRACKING_CONTENT?: 8192;
    readonly STATE_LOADED_LEVEL_2_TRACKING_CONTENT?: 1048576;
    readonly STATE_BLOCKED_FINGERPRINTING_CONTENT?: 64;
    readonly STATE_LOADED_FINGERPRINTING_CONTENT?: 1024;
    readonly STATE_REPLACED_FINGERPRINTING_CONTENT?: 134217728;
    readonly STATE_ALLOWED_FINGERPRINTING_CONTENT?: 512;
    readonly STATE_BLOCKED_CRYPTOMINING_CONTENT?: 2048;
    readonly STATE_LOADED_CRYPTOMINING_CONTENT?: 2097152;
    readonly STATE_BLOCKED_UNSAFE_CONTENT?: 16384;
    readonly STATE_COOKIES_LOADED?: 32768;
    readonly STATE_COOKIES_LOADED_TRACKER?: 262144;
    readonly STATE_COOKIES_LOADED_SOCIALTRACKER?: 524288;
    readonly STATE_COOKIES_BLOCKED_BY_PERMISSION?: 268435456;
    readonly STATE_COOKIES_BLOCKED_TRACKER?: 536870912;
    readonly STATE_COOKIES_BLOCKED_SOCIALTRACKER?: 16777216;
    readonly STATE_COOKIES_BLOCKED_ALL?: 1073741824;
    readonly STATE_COOKIES_PARTITIONED_TRACKER?: 2;
    readonly STATE_COOKIES_PARTITIONED_FOREIGN?: 2147483648;
    readonly STATE_COOKIES_BLOCKED_FOREIGN?: 128;
    readonly STATE_BLOCKED_SOCIALTRACKING_CONTENT?: 65536;
    readonly STATE_LOADED_SOCIALTRACKING_CONTENT?: 131072;
    readonly STATE_REPLACED_TRACKING_CONTENT?: 16;
    readonly STATE_ALLOWED_TRACKING_CONTENT?: 32;
    readonly STATE_BLOCKED_EMAILTRACKING_CONTENT?: 4194304;
    readonly STATE_LOADED_EMAILTRACKING_LEVEL_1_CONTENT?: 8388608;
    readonly STATE_LOADED_EMAILTRACKING_LEVEL_2_CONTENT?: 256;
    readonly STATE_ALLOWED_CANVAS_FINGERPRINTING?: 33554432;
    readonly STATE_ALLOWED_FONT_FINGERPRINTING?: 67108864;
    readonly STATE_BLOCKED_SUSPICIOUS_FINGERPRINTING?: 4;
    readonly STATE_PURGED_BOUNCETRACKER?: 8;
    readonly STATE_HTTPS_ONLY_MODE_UPGRADED?: 4194304;
    readonly STATE_HTTPS_ONLY_MODE_UPGRADE_FAILED?: 8388608;
    readonly STATE_HTTPS_ONLY_MODE_UPGRADED_FIRST?: 134217728;
    readonly LOCATION_CHANGE_SAME_DOCUMENT?: 1;
    readonly LOCATION_CHANGE_ERROR_PAGE?: 2;
    readonly LOCATION_CHANGE_RELOAD?: 4;
    readonly LOCATION_CHANGE_HASHCHANGE?: 8;
    readonly LOCATION_CHANGE_SESSION_STORE?: 16;

    onStateChange(
      aWebProgress: nsIWebProgress,
      aRequest: nsIRequest,
      aStateFlags: u32,
      aStatus: nsresult
    ): void;
    onProgressChange(
      aWebProgress: nsIWebProgress,
      aRequest: nsIRequest,
      aCurSelfProgress: i32,
      aMaxSelfProgress: i32,
      aCurTotalProgress: i32,
      aMaxTotalProgress: i32
    ): void;
    onLocationChange(
      aWebProgress: nsIWebProgress,
      aRequest: nsIRequest,
      aLocation: nsIURI,
      aFlags?: u32
    ): void;
    onStatusChange(
      aWebProgress: nsIWebProgress,
      aRequest: nsIRequest,
      aStatus: nsresult,
      aMessage: string
    ): void;
    onSecurityChange(aWebProgress: nsIWebProgress, aRequest: nsIRequest, aState: u32): void;
    onContentBlockingEvent(aWebProgress: nsIWebProgress, aRequest: nsIRequest, aEvent: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/uriloader/base/nsIWebProgressListener2.idl

  interface nsIWebProgressListener2 extends nsIWebProgressListener {
    onProgressChange64(
      aWebProgress: nsIWebProgress,
      aRequest: nsIRequest,
      aCurSelfProgress: i64,
      aMaxSelfProgress: i64,
      aCurTotalProgress: i64,
      aMaxTotalProgress: i64
    ): void;
    onRefreshAttempted(
      aWebProgress: nsIWebProgress,
      aRefreshURI: nsIURI,
      aMillis: u32,
      aSameURI: boolean
    ): boolean;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/url-classifier/nsIChannelClassifierService.idl

  interface nsIUrlClassifierBlockedChannel extends nsISupports {
    readonly TRACKING_PROTECTION?: 0;
    readonly SOCIAL_TRACKING_PROTECTION?: 1;
    readonly FINGERPRINTING_PROTECTION?: 2;
    readonly CRYPTOMINING_PROTECTION?: 3;

    readonly reason: u8;
    readonly tables: string;
    readonly url: string;
    readonly tabId: u64;
    readonly channelId: u64;
    readonly isPrivateBrowsing: boolean;
    readonly topLevelUrl: string;
    replace(): void;
    allow(): void;
  }

  interface nsIChannelClassifierService extends nsISupports {
    addListener(aObserver: nsIObserver): void;
    removeListener(aObserver: nsIObserver): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/url-classifier/nsIURIClassifier.idl

  type nsIURIClassifierCallback = Callable<{
    onClassifyComplete(
      aErrorCode: nsresult,
      aList: string,
      aProvider: string,
      aFullHash: string
    ): void;
  }>;

  interface nsIURIClassifier extends nsISupports {
    classify(aPrincipal: nsIPrincipal, aCallback: nsIURIClassifierCallback): boolean;
    asyncClassifyLocalWithFeatures(
      aURI: nsIURI,
      aFeatures: nsIUrlClassifierFeature[],
      aListType: nsIUrlClassifierFeature.listType,
      aCallback: nsIUrlClassifierFeatureCallback,
      aIdlePriority?: boolean
    ): void;
    asyncClassifyLocalWithFeatureNames(
      aURI: nsIURI,
      aFeatures: string[],
      aListType: nsIUrlClassifierFeature.listType,
      aCallback: nsIUrlClassifierFeatureCallback
    ): void;
    getFeatureByName(aFeatureName: string): nsIUrlClassifierFeature;
    getFeatureNames(): string[];
    createFeatureWithTables(
      aName: string,
      aBlocklistTables: string[],
      aEntitylistTables: string[]
    ): nsIUrlClassifierFeature;
    sendThreatHitReport(
      aChannel: nsIChannel,
      aProvider: string,
      aList: string,
      aFullHash: string
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/url-classifier/nsIUrlClassifierExceptionListService.idl

  type nsIUrlClassifierExceptionListObserver = Callable<{
    onExceptionListUpdate(aList: string): void;
  }>;

  interface nsIUrlClassifierExceptionListService extends nsISupports {
    registerAndRunExceptionListObserver(
      aFeature: string,
      aPrefName: string,
      aObserver: nsIUrlClassifierExceptionListObserver
    ): void;
    unregisterExceptionListObserver(
      aFeature: string,
      aObserver: nsIUrlClassifierExceptionListObserver
    ): void;
    clear(): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/url-classifier/nsIUrlClassifierFeature.idl
} // global

declare enum nsIUrlClassifierFeature_listType {
  blocklist = 0,
  entitylist = 1,
}

declare enum nsIUrlClassifierFeature_URIType {
  blocklistURI = 0,
  entitylistURI = 1,
  pairwiseEntitylistURI = 2,
}

declare global {
  namespace nsIUrlClassifierFeature {
    type listType = nsIUrlClassifierFeature_listType;
    type URIType = nsIUrlClassifierFeature_URIType;
  }

  interface nsIUrlClassifierFeature
    extends nsISupports,
      Enums<typeof nsIUrlClassifierFeature_listType & typeof nsIUrlClassifierFeature_URIType> {
    readonly name: string;
    readonly exceptionHostList: string;
  }

  interface nsIUrlClassifierFeatureResult extends nsISupports {
    readonly uri: nsIURI;
    readonly feature: nsIUrlClassifierFeature;
    readonly list: string;
  }

  type nsIUrlClassifierFeatureCallback = Callable<{
    onClassifyComplete(aResults: nsIUrlClassifierFeatureResult[]): void;
  }>;

  // https://searchfox.org/mozilla-central/source/toolkit/components/url-classifier/IUrlClassifierUITelemetry.idl

  interface IUrlClassifierUITelemetry extends nsISupports {
    readonly WARNING_MALWARE_PAGE_TOP?: 1;
    readonly WARNING_MALWARE_PAGE_TOP_WHY_BLOCKED?: 2;
    readonly WARNING_MALWARE_PAGE_TOP_GET_ME_OUT_OF_HERE?: 3;
    readonly WARNING_MALWARE_PAGE_TOP_IGNORE_WARNING?: 4;
    readonly WARNING_MALWARE_PAGE_FRAME?: 5;
    readonly WARNING_MALWARE_PAGE_FRAME_WHY_BLOCKED?: 6;
    readonly WARNING_MALWARE_PAGE_FRAME_GET_ME_OUT_OF_HERE?: 7;
    readonly WARNING_MALWARE_PAGE_FRAME_IGNORE_WARNING?: 8;
    readonly WARNING_PHISHING_PAGE_TOP?: 9;
    readonly WARNING_PHISHING_PAGE_TOP_WHY_BLOCKED?: 10;
    readonly WARNING_PHISHING_PAGE_TOP_GET_ME_OUT_OF_HERE?: 11;
    readonly WARNING_PHISHING_PAGE_TOP_IGNORE_WARNING?: 12;
    readonly WARNING_PHISHING_PAGE_FRAME?: 13;
    readonly WARNING_PHISHING_PAGE_FRAME_WHY_BLOCKED?: 14;
    readonly WARNING_PHISHING_PAGE_FRAME_GET_ME_OUT_OF_HERE?: 15;
    readonly WARNING_PHISHING_PAGE_FRAME_IGNORE_WARNING?: 16;
    readonly WARNING_UNWANTED_PAGE_TOP?: 17;
    readonly WARNING_UNWANTED_PAGE_TOP_WHY_BLOCKED?: 18;
    readonly WARNING_UNWANTED_PAGE_TOP_GET_ME_OUT_OF_HERE?: 19;
    readonly WARNING_UNWANTED_PAGE_TOP_IGNORE_WARNING?: 20;
    readonly WARNING_UNWANTED_PAGE_FRAME?: 21;
    readonly WARNING_UNWANTED_PAGE_FRAME_WHY_BLOCKED?: 22;
    readonly WARNING_UNWANTED_PAGE_FRAME_GET_ME_OUT_OF_HERE?: 23;
    readonly WARNING_UNWANTED_PAGE_FRAME_IGNORE_WARNING?: 24;
    readonly WARNING_HARMFUL_PAGE_TOP?: 25;
    readonly WARNING_HARMFUL_PAGE_TOP_WHY_BLOCKED?: 26;
    readonly WARNING_HARMFUL_PAGE_TOP_GET_ME_OUT_OF_HERE?: 27;
    readonly WARNING_HARMFUL_PAGE_TOP_IGNORE_WARNING?: 28;
    readonly WARNING_HARMFUL_PAGE_FRAME?: 29;
    readonly WARNING_HARMFUL_PAGE_FRAME_WHY_BLOCKED?: 30;
    readonly WARNING_HARMFUL_PAGE_FRAME_GET_ME_OUT_OF_HERE?: 31;
    readonly WARNING_HARMFUL_PAGE_FRAME_IGNORE_WARNING?: 32;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/url-classifier/nsIUrlClassifierDBService.idl

  type nsIUrlClassifierCallback = Callable<{
    handleEvent(value: string): void;
  }>;

  interface nsIUrlClassifierUpdateObserver extends nsISupports {
    updateUrlRequested(url: string, table: string): void;
    streamFinished(status: nsresult, delay: u32): void;
    updateError(error: nsresult): void;
    updateSuccess(requestedTimeout: u32): void;
  }

  interface nsIUrlClassifierDBService extends nsISupports {
    lookup(principal: nsIPrincipal, tables: string, c: nsIUrlClassifierCallback): void;
    getTables(c: nsIUrlClassifierCallback): void;
    setHashCompleter(tableName: string, completer: nsIUrlClassifierHashCompleter): void;
    clearLastResults(): void;
    beginUpdate(updater: nsIUrlClassifierUpdateObserver, tables: string): void;
    beginStream(table: string): void;
    updateStream(updateChunk: string): void;
    finishStream(): void;
    finishUpdate(): void;
    cancelUpdate(): void;
    resetDatabase(): void;
    reloadDatabase(): void;
    clearCache(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/url-classifier/nsIUrlClassifierHashCompleter.idl

  interface nsIFullHashMatch extends nsISupports {
    readonly tableName: string;
    readonly fullHash: string;
    readonly cacheDuration: u32;
  }

  interface nsIUrlClassifierHashCompleterCallback extends nsISupports {
    completionV2(hash: string, table: string, chunkId: u32): void;
    completionV4(
      partialHash: string,
      table: string,
      negativeCacheDuration: u32,
      fullHashes: nsIArray
    ): void;
    completionFinished(status: nsresult): void;
  }

  interface nsIUrlClassifierHashCompleter extends nsISupports {
    complete(
      partialHash: string,
      gethashUrl: string,
      tableName: string,
      callback: nsIUrlClassifierHashCompleterCallback
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/url-classifier/nsIUrlClassifierInfo.idl

  interface nsIUrlClassifierPositiveCacheEntry extends nsISupports {
    readonly fullhash: string;
    readonly expiry: i64;
  }

  interface nsIUrlClassifierCacheEntry extends nsISupports {
    readonly prefix: string;
    readonly expiry: i64;
    readonly matches: nsIArray;
  }

  interface nsIUrlClassifierCacheInfo extends nsISupports {
    readonly table: string;
    readonly entries: nsIArray;
  }

  type nsIUrlClassifierGetCacheCallback = Callable<{
    onGetCacheComplete(info: nsIUrlClassifierCacheInfo): void;
  }>;

  interface nsIUrlClassifierInfo extends nsISupports {
    getCacheInfo(table: string, callback: nsIUrlClassifierGetCacheCallback): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/url-classifier/nsIUrlClassifierPrefixSet.idl

  interface nsIUrlClassifierPrefixSet extends nsISupports {
    init(aName: string): void;
    setPrefixes(aPrefixes: u32[], aLength: u32): void;
    getPrefixes(aCount: OutParam<u32>): u32[];
    contains(aPrefix: u32): boolean;
    isEmpty(): boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/url-classifier/nsIUrlClassifierRemoteSettingsService.idl

  interface nsIUrlClassifierRemoteSettingsService extends nsISupports {
    fetchList(aPayload: string, aListener: nsIStreamListener): void;
    clear(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/url-classifier/nsIUrlClassifierStreamUpdater.idl

  interface nsIUrlClassifierStreamUpdater extends nsISupports {
    downloadUpdates(
      aRequestTables: string,
      aRequestPayload: string,
      aIsPostRequest: boolean,
      aUpdateUrl: string,
      aSuccessCallback: nsIUrlClassifierCallback,
      aUpdateErrorCallback: nsIUrlClassifierCallback,
      aDownloadErrorCallback: nsIUrlClassifierCallback
    ): boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/url-classifier/nsIUrlClassifierUtils.idl

  interface nsIUrlClassifierParseFindFullHashCallback extends nsISupports {
    onCompleteHashFound(
      aCompleteHash: string,
      aTableNames: string,
      aPerHashCacheDuration: u32
    ): void;
    onResponseParsed(aMinWaitDuration: u32, aNegCacheDuration: u32): void;
  }

  interface nsIUrlClassifierUtils extends nsISupports {
    getKeyForURI(uri: nsIURI): string;
    getProvider(tableName: string): string;
    getTelemetryProvider(tableName: string): string;
    getProtocolVersion(provider: string): string;
    convertThreatTypeToListNames(threatType: u32): string;
    convertListNameToThreatType(listName: string): u32;
    makeUpdateRequestV4(aListNames: string[], aStatesBase64: string[]): string;
    makeFindFullHashRequestV4(
      aListNames: string[],
      aListStatesBase64: string[],
      aPrefixes: string[]
    ): string;
    makeThreatHitReport(aChannel: nsIChannel, aListName: string, aHashBase64: string): string;
    parseFindFullHashResponseV4(
      aResponse: string,
      aCallback: nsIUrlClassifierParseFindFullHashCallback
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/url-classifier/nsIUrlListManager.idl

  interface nsIUrlListManager extends nsISupports {
    getGethashUrl(tableName: string): string;
    getUpdateUrl(tableName: string): string;
    registerTable(
      tableName: string,
      providerName: string,
      updateUrl: string,
      gethashUrl: string
    ): boolean;
    unregisterTable(tableName: string): void;
    enableUpdate(tableName: string): void;
    disableAllUpdates(): void;
    disableUpdate(tableName: string): void;
    maybeToggleUpdateChecking(): void;
    checkForUpdates(updateUrl: string): boolean;
    forceUpdates(tableNames: string): boolean;
    getBackOffTime(provider: string): u64;
    isRegistered(): boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/urlformatter/nsIURLFormatter.idl

  interface nsIURLFormatter extends nsISupports {
    formatURL(aFormat: string): string;
    formatURLPref(aPref: string): string;
    trimSensitiveURLs(aMsg: string): string;
  }

  // https://searchfox.org/mozilla-central/source/ipc/glue/test/utility_process_xpcom/nsIUtilityProcessTest.idl

  interface nsIUtilityProcessTest extends nsISupports {
    startProcess(actorsToAdd?: string[]): Promise<any>;
    untilChildProcessDead(pid: u32): Promise<any>;
    noteIntentionalCrash(pid: u32): void;
    stopProcess(utilityActorName?: string): void;
    testTelemetryProbes(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/browser/nsIWebBrowser.idl

  interface nsIWebBrowser extends nsISupports {
    containerWindow: nsIWebBrowserChrome;
    readonly contentDOMWindow: mozIDOMWindowProxy;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/browser/nsIWebBrowserChrome.idl

  interface nsIWebBrowserChrome extends nsISupports {
    readonly CHROME_DEFAULT?: 1;
    readonly CHROME_WINDOW_BORDERS?: 2;
    readonly CHROME_WINDOW_CLOSE?: 4;
    readonly CHROME_WINDOW_RESIZE?: 8;
    readonly CHROME_MENUBAR?: 16;
    readonly CHROME_TOOLBAR?: 32;
    readonly CHROME_LOCATIONBAR?: 64;
    readonly CHROME_STATUSBAR?: 128;
    readonly CHROME_PERSONAL_TOOLBAR?: 256;
    readonly CHROME_SCROLLBARS?: 512;
    readonly CHROME_TITLEBAR?: 1024;
    readonly CHROME_EXTRA?: 2048;
    readonly CHROME_ALL?: 4094;
    readonly CHROME_WINDOW_MINIMIZE?: 16384;
    readonly CHROME_ALERT?: 32768;
    readonly CHROME_PRIVATE_WINDOW?: 65536;
    readonly CHROME_NON_PRIVATE_WINDOW?: 131072;
    readonly CHROME_PRIVATE_LIFETIME?: 262144;
    readonly CHROME_ALWAYS_ON_TOP?: 524288;
    readonly CHROME_REMOTE_WINDOW?: 1048576;
    readonly CHROME_FISSION_WINDOW?: 2097152;
    readonly CHROME_SUPPRESS_ANIMATION?: 16777216;
    readonly CHROME_CENTER_SCREEN?: 134217728;
    readonly CHROME_DEPENDENT?: 268435456;
    readonly CHROME_MODAL?: 536870912;
    readonly CHROME_OPENAS_DIALOG?: 1073741824;
    readonly CHROME_OPENAS_CHROME?: 2147483648;
    readonly CHROME_MINIMAL_POPUP?: 18126;

    setLinkStatus(status: string): void;
    chromeFlags: u32;
    showAsModal(): void;
    isWindowModal(): boolean;
    blur(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/browser/nsIWebBrowserPrint.idl

  interface nsIWebBrowserPrint extends nsISupports {
    readonly PRINTPREVIEW_GOTO_PAGENUM?: 0;
    readonly PRINTPREVIEW_PREV_PAGE?: 1;
    readonly PRINTPREVIEW_NEXT_PAGE?: 2;
    readonly PRINTPREVIEW_HOME?: 3;
    readonly PRINTPREVIEW_END?: 4;

    readonly doingPrint: boolean;
    readonly doingPrintPreview: boolean;
    readonly rawNumPages: i32;
    readonly printPreviewNumPages: i32;
    readonly printPreviewCurrentPageNumber: i32;
    closeWindowAfterPrint: boolean;
    printPreviewScrollToPage(aNavType: i16, aPageNum: i32): void;
    exitPrintPreview(): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/webbrowserpersist/nsIWebBrowserPersist.idl

  interface nsIWebBrowserPersist extends nsICancelable {
    readonly PERSIST_FLAGS_NONE?: 0;
    readonly PERSIST_FLAGS_FROM_CACHE?: 1;
    readonly PERSIST_FLAGS_BYPASS_CACHE?: 2;
    readonly PERSIST_FLAGS_IGNORE_REDIRECTED_DATA?: 4;
    readonly PERSIST_FLAGS_IGNORE_IFRAMES?: 8;
    readonly PERSIST_FLAGS_NO_CONVERSION?: 16;
    readonly PERSIST_FLAGS_REPLACE_EXISTING_FILES?: 32;
    readonly PERSIST_FLAGS_NO_BASE_TAG_MODIFICATIONS?: 64;
    readonly PERSIST_FLAGS_FIXUP_ORIGINAL_DOM?: 128;
    readonly PERSIST_FLAGS_FIXUP_LINKS_TO_DESTINATION?: 256;
    readonly PERSIST_FLAGS_DONT_FIXUP_LINKS?: 512;
    readonly PERSIST_FLAGS_SERIALIZE_OUTPUT?: 1024;
    readonly PERSIST_FLAGS_DONT_CHANGE_FILENAMES?: 2048;
    readonly PERSIST_FLAGS_FAIL_ON_BROKEN_LINKS?: 4096;
    readonly PERSIST_FLAGS_CLEANUP_ON_FAILURE?: 8192;
    readonly PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION?: 16384;
    readonly PERSIST_FLAGS_APPEND_TO_FILE?: 32768;
    readonly PERSIST_STATE_READY?: 1;
    readonly PERSIST_STATE_SAVING?: 2;
    readonly PERSIST_STATE_FINISHED?: 3;
    readonly ENCODE_FLAGS_SELECTION_ONLY?: 1;
    readonly ENCODE_FLAGS_FORMATTED?: 2;
    readonly ENCODE_FLAGS_RAW?: 4;
    readonly ENCODE_FLAGS_BODY_ONLY?: 8;
    readonly ENCODE_FLAGS_PREFORMATTED?: 16;
    readonly ENCODE_FLAGS_WRAP?: 32;
    readonly ENCODE_FLAGS_FORMAT_FLOWED?: 64;
    readonly ENCODE_FLAGS_ABSOLUTE_LINKS?: 128;
    readonly ENCODE_FLAGS_CR_LINEBREAKS?: 512;
    readonly ENCODE_FLAGS_LF_LINEBREAKS?: 1024;
    readonly ENCODE_FLAGS_NOSCRIPT_CONTENT?: 2048;
    readonly ENCODE_FLAGS_NOFRAMES_CONTENT?: 4096;
    readonly ENCODE_FLAGS_ENCODE_BASIC_ENTITIES?: 8192;

    persistFlags: u32;
    readonly currentState: u32;
    readonly result: nsresult;
    progressListener: nsIWebProgressListener;
    saveURI(
      aURI: nsIURI,
      aTriggeringPrincipal: nsIPrincipal,
      aCacheKey: u32,
      aReferrerInfo: nsIReferrerInfo,
      aCookieJarSettings: nsICookieJarSettings,
      aPostData: nsIInputStream,
      aExtraHeaders: string,
      aFile: nsISupports,
      aContentPolicyType: nsContentPolicyType,
      aIsPrivate: boolean
    ): void;
    saveChannel(aChannel: nsIChannel, aFile: nsISupports): void;
    saveDocument(
      aDocument: nsISupports,
      aFile: nsISupports,
      aDataPath: nsISupports,
      aOutputContentType: string,
      aEncodingFlags: u32,
      aWrapColumn: u32
    ): void;
    cancelSave(): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/webbrowserpersist/nsIWebBrowserPersistDocument.idl

  interface nsIWebBrowserPersistURIMap extends nsISupports {
    readonly numMappedURIs: u32;
    getURIMapping(aIndex: u32, aMapFrom: OutParam<string>, aMapTo: OutParam<string>): void;
    readonly targetBaseURI: string;
  }

  interface nsIWebBrowserPersistDocument extends nsISupports {
    readonly isClosed: boolean;
    readonly isPrivate: boolean;
    readonly documentURI: string;
    readonly baseURI: string;
    readonly contentType: string;
    readonly characterSet: string;
    readonly title: string;
    readonly referrerInfo: nsIReferrerInfo;
    readonly cookieJarSettings: nsICookieJarSettings;
    readonly contentDisposition: string;
    readonly postData: nsIInputStream;
    readonly principal: nsIPrincipal;
    readonly cacheKey: u32;
    persistFlags: u32;
    readResources(aVisitor: nsIWebBrowserPersistResourceVisitor): void;
    writeContent(
      aStream: nsIOutputStream,
      aURIMap: nsIWebBrowserPersistURIMap,
      aRequestedContentType: string,
      aEncoderFlags: u32,
      aWrapColumn: u32,
      aCompletion: nsIWebBrowserPersistWriteCompletion
    ): void;
  }

  interface nsIWebBrowserPersistResourceVisitor extends nsISupports {
    visitResource(
      aDocument: nsIWebBrowserPersistDocument,
      aURI: string,
      aContentPolicyType: nsContentPolicyType
    ): void;
    visitDocument(
      aDocument: nsIWebBrowserPersistDocument,
      aSubDocument: nsIWebBrowserPersistDocument
    ): void;
    visitBrowsingContext(aDocument: nsIWebBrowserPersistDocument, aContext: BrowsingContext): void;
    endVisit(aDocument: nsIWebBrowserPersistDocument, aStatus: nsresult): void;
  }

  type nsIWebBrowserPersistWriteCompletion = Callable<{
    onFinish(
      aDocument: nsIWebBrowserPersistDocument,
      aStream: nsIOutputStream,
      aContentType: string,
      aStatus: nsresult
    ): void;
  }>;

  interface nsIWebBrowserPersistDocumentReceiver extends nsISupports {
    onDocumentReady(aDocument: nsIWebBrowserPersistDocument): void;
    onError(aFailure: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/extensions/extIWebNavigation.idl

  interface extIWebNavigation extends nsISupports {
    onDocumentChange(bc: BrowsingContext, transitionData: any, location: nsIURI): void;
    onHistoryChange(
      bc: BrowsingContext,
      transitionData: any,
      location: nsIURI,
      isHistoryStateUpdated: boolean,
      isReferenceFragmentUpdated: boolean
    ): void;
    onStateChange(bc: BrowsingContext, requestURI: nsIURI, status: nsresult, stateFlags: u32): void;
    onCreatedNavigationTarget(bc: BrowsingContext, sourceBC: BrowsingContext, url: string): void;
    onDOMContentLoaded(bc: BrowsingContext, documentURI: nsIURI): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/extensions/mozIExtensionAPIRequestHandling.idl

  interface mozIExtensionServiceWorkerInfo extends nsISupports {
    readonly principal: nsIPrincipal;
    readonly scriptURL: string;
    readonly clientInfoId: string;
    readonly descriptorId: u64;
  }
} // global

declare enum mozIExtensionListenerCallOptions_APIObjectType {
  NONE = 0,
  RUNTIME_PORT = 1,
}

declare enum mozIExtensionListenerCallOptions_CallbackType {
  CALLBACK_NONE = 0,
  CALLBACK_SEND_RESPONSE = 1,
}

declare global {
  namespace mozIExtensionListenerCallOptions {
    type APIObjectType = mozIExtensionListenerCallOptions_APIObjectType;
    type CallbackType = mozIExtensionListenerCallOptions_CallbackType;
  }

  interface mozIExtensionListenerCallOptions
    extends nsISupports,
      Enums<
        typeof mozIExtensionListenerCallOptions_APIObjectType &
          typeof mozIExtensionListenerCallOptions_CallbackType
      > {
    readonly apiObjectType: mozIExtensionListenerCallOptions.APIObjectType;
    readonly apiObjectDescriptor: any;
    readonly apiObjectPrepended: boolean;
    callbackType: mozIExtensionListenerCallOptions.CallbackType;
  }

  interface mozIExtensionEventListener extends nsISupports {
    callListener(args: any[], listenerCallOptions?: mozIExtensionListenerCallOptions): Promise<any>;
  }
} // global

declare enum mozIExtensionAPIRequest_RequestType {
  CALL_FUNCTION = 0,
  CALL_FUNCTION_NO_RETURN = 1,
  CALL_FUNCTION_ASYNC = 2,
  ADD_LISTENER = 3,
  REMOVE_LISTENER = 4,
  GET_PROPERTY = 5,
}

declare global {
  namespace mozIExtensionAPIRequest {
    type RequestType = mozIExtensionAPIRequest_RequestType;
  }

  interface mozIExtensionAPIRequest
    extends nsISupports,
      Enums<typeof mozIExtensionAPIRequest_RequestType> {
    toString(): string;
    readonly requestType: string;
    readonly apiNamespace: string;
    readonly apiName: string;
    readonly apiObjectType: string;
    readonly apiObjectId: string;
    readonly args: any;
    normalizedArgs: any;
    readonly callerSavedFrame: any;
    readonly serviceWorkerInfo: mozIExtensionServiceWorkerInfo;
    readonly eventListener: mozIExtensionEventListener;
  }
} // global

declare enum mozIExtensionAPIRequestResult_ResultType {
  RETURN_VALUE = 0,
  EXTENSION_ERROR = 1,
}

declare global {
  namespace mozIExtensionAPIRequestResult {
    type ResultType = mozIExtensionAPIRequestResult_ResultType;
  }

  interface mozIExtensionAPIRequestResult
    extends nsISupports,
      Enums<typeof mozIExtensionAPIRequestResult_ResultType> {
    readonly type: mozIExtensionAPIRequestResult.ResultType;
    readonly value: any;
  }

  interface mozIExtensionAPIRequestHandler extends nsISupports {
    handleAPIRequest(
      extension: nsISupports,
      apiRequest: mozIExtensionAPIRequest
    ): mozIExtensionAPIRequestResult;
    initExtensionWorker(
      extension: nsISupports,
      serviceWorkerInfo: mozIExtensionServiceWorkerInfo
    ): void;
    onExtensionWorkerLoaded(extension: nsISupports, serviceWorkerDescriptorId: u64): void;
    onExtensionWorkerDestroyed(extension: nsISupports, serviceWorkerDescriptorId: u64): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/extensions/mozIExtensionProcessScript.idl

  interface mozIExtensionProcessScript extends nsISupports {
    preloadContentScript(contentScript: nsISupports): void;
    loadContentScript(
      contentScript: WebExtensionContentScript,
      window: mozIDOMWindow
    ): Promise<any>;
    initExtensionDocument(extension: nsISupports, doc: Document, privileged: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/extensions/nsINativeMessagingPortal.idl

  interface nsINativeMessagingPortal extends nsISupports {
    shouldUse(): boolean;
    readonly available: Promise<any>;
    createSession(aApplication: string): Promise<any>;
    closeSession(aHandle: string): Promise<any>;
    getManifest(aHandle: string, aName: string, aExtension: string): Promise<any>;
    start(aHandle: string, aName: string, aExtension: string): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/webvtt/nsIWebVTTListener.idl

  interface nsIWebVTTListener extends nsISupports {
    onCue(cue: any): void;
    onRegion(region: any): void;
    onParsingError(errorCode: i32): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/media/webvtt/nsIWebVTTParserWrapper.idl

  interface nsIWebVTTParserWrapper extends nsISupports {
    loadParser(window: mozIDOMWindow): void;
    parse(data: string): void;
    flush(): void;
    watch(callback: nsIWebVTTListener): void;
    cancel(): void;
    convertCueToDOMTree(window: mozIDOMWindow, cue: nsISupports): DocumentFragment;
    processCues(
      window: mozIDOMWindow,
      cues: nsIVariant,
      overlay: nsISupports,
      controls: nsISupports
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIAppShell.idl

  // https://searchfox.org/mozilla-central/source/widget/nsIBaseWindow.idl

  interface nsIBaseWindow extends nsISupports {
    readonly eRepaint?: 1;
    readonly eDelayResize?: 2;

    destroy(): void;
    setPosition(x: i32, y: i32): void;
    setPositionDesktopPix(x: i32, y: i32): void;
    getPosition(x: OutParam<i32>, y: OutParam<i32>): void;
    setSize(cx: i32, cy: i32, fRepaint: boolean): void;
    getSize(cx: OutParam<i32>, cy: OutParam<i32>): void;
    setPositionAndSize(x: i32, y: i32, cx: i32, cy: i32, flags: u32): void;
    getPositionAndSize(
      x: OutParam<i32>,
      y: OutParam<i32>,
      cx: OutParam<i32>,
      cy: OutParam<i32>
    ): void;
    repaint(force: boolean): void;
    readonly nativeHandle: string;
    visibility: boolean;
    enabled: boolean;
    readonly devicePixelsPerDesktopPixel: double;
    title: string;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIBidiKeyboard.idl

  interface nsIBidiKeyboard extends nsISupports {
    reset(): void;
    isLangRTL(): boolean;
    readonly haveBidiKeyboards: boolean;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIClipboard.idl

  interface nsIAsyncSetClipboardData extends nsISupports {
    setData(aTransferable: nsITransferable, aOwner?: nsIClipboardOwner): void;
    abort(aReason: nsresult): void;
  }

  type nsIAsyncClipboardRequestCallback = Callable<{
    onComplete(aResult: nsresult): void;
  }>;

  interface nsIClipboardDataSnapshot extends nsISupports {
    readonly valid: boolean;
    readonly flavorList: string[];
    getData(aTransferable: nsITransferable, aCallback: nsIAsyncClipboardRequestCallback): void;
    getDataSync(aTransferable: nsITransferable): void;
  }

  interface nsIClipboardGetDataSnapshotCallback extends nsISupports {
    onSuccess(aClipboardDataSnapshot: nsIClipboardDataSnapshot): void;
    onError(aResult: nsresult): void;
  }
} // global

declare enum nsIClipboard_ClipboardType {
  kSelectionClipboard = 0,
  kGlobalClipboard = 1,
  kFindClipboard = 2,
  kSelectionCache = 3,
}

declare global {
  namespace nsIClipboard {
    type ClipboardType = nsIClipboard_ClipboardType;
  }

  interface nsIClipboard extends nsISupports, Enums<typeof nsIClipboard_ClipboardType> {
    setData(
      aTransferable: nsITransferable,
      anOwner: nsIClipboardOwner,
      aWhichClipboard: nsIClipboard.ClipboardType,
      aSettingWindowContext?: WindowContext
    ): void;
    asyncSetData(
      aWhichClipboard: nsIClipboard.ClipboardType,
      aSettingWindowContext?: WindowContext,
      aCallback?: nsIAsyncClipboardRequestCallback
    ): nsIAsyncSetClipboardData;
    getData(
      aTransferable: nsITransferable,
      aWhichClipboard: nsIClipboard.ClipboardType,
      aRequestingWindowContext?: WindowContext
    ): void;
    getDataSnapshot(
      aFlavorList: string[],
      aWhichClipboard: nsIClipboard.ClipboardType,
      aRequestingWindowContext: WindowContext,
      aRequestingPrincipal: nsIPrincipal,
      aCallback: nsIClipboardGetDataSnapshotCallback
    ): void;
    getDataSnapshotSync(
      aFlavorList: string[],
      aWhichClipboard: nsIClipboard.ClipboardType,
      aRequestingWindowContext?: WindowContext
    ): nsIClipboardDataSnapshot;
    emptyClipboard(aWhichClipboard: nsIClipboard.ClipboardType): void;
    hasDataMatchingFlavors(
      aFlavorList: string[],
      aWhichClipboard: nsIClipboard.ClipboardType
    ): boolean;
    isClipboardTypeSupported(aWhichClipboard: nsIClipboard.ClipboardType): boolean;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIClipboardHelper.idl
} // global

declare enum nsIClipboardHelper_SensitiveData {
  NotSensitive = 0,
  Sensitive = 1,
}

declare global {
  namespace nsIClipboardHelper {
    type SensitiveData = nsIClipboardHelper_SensitiveData;
  }

  interface nsIClipboardHelper extends nsISupports, Enums<typeof nsIClipboardHelper_SensitiveData> {
    copyStringToClipboard(
      aString: string,
      aClipboardID: nsIClipboard.ClipboardType,
      aSettingWindowContext?: WindowContext,
      aSensitive?: nsIClipboardHelper.SensitiveData
    ): void;
    copyString(
      aString: string,
      aSettingWindowContext?: WindowContext,
      aSensitive?: nsIClipboardHelper.SensitiveData
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIClipboardOwner.idl

  interface nsIClipboardOwner extends nsISupports {
    LosingOwnership(aTransferable: nsITransferable): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIColorPicker.idl

  interface nsIColorPickerShownCallback extends nsISupports {
    update(color: string): void;
    done(color: string): void;
  }

  interface nsIColorPicker extends nsISupports {
    init(
      browsingContext: BrowsingContext,
      title: string,
      initialColor: string,
      defaultColors: string[]
    ): void;
    open(aColorPickerShownCallback: nsIColorPickerShownCallback): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIDisplayInfo.idl

  interface nsIDisplayInfo extends nsISupports {
    readonly id: i32;
    readonly connected: boolean;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIDragService.idl

  interface nsIDragService extends nsISupports {
    readonly DRAGDROP_ACTION_NONE?: 0;
    readonly DRAGDROP_ACTION_COPY?: 1;
    readonly DRAGDROP_ACTION_MOVE?: 2;
    readonly DRAGDROP_ACTION_LINK?: 4;
    readonly DRAGDROP_ACTION_UNINITIALIZED?: 64;

    getCurrentSession(aWidgetProvider?: nsISupports): nsIDragSession;
    startDragSessionForTests(aWidgetProvider: nsISupports, aAllowedEffect: u32): void;
    suppress(): void;
    unsuppress(): void;
    getMockDragController(): nsIMockDragServiceController;
    readonly isMockService: boolean;
    neverAllowSessionIsSynthesizedForTests: boolean;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIDragSession.idl

  interface nsIDragSession extends nsISupports {
    canDrop: boolean;
    onlyChromeDrop: boolean;
    dragAction: u32;
    readonly numDropItems: u32;
    sourceWindowContext: WindowContext;
    sourceTopWindowContext: WindowContext;
    readonly sourceNode: Node;
    triggeringPrincipal: nsIPrincipal;
    csp: nsIContentSecurityPolicy;
    dataTransfer: DataTransfer;
    getData(aTransferable: nsITransferable, aItemIndex: u32): void;
    isDataFlavorSupported(aDataFlavor: string): boolean;
    userCancelled(): void;
    dragEventDispatchedToChildProcess(): void;
    updateDragEffect(): void;
    updateDragImage(aImage: Node, aImageX: i32, aImageY: i32): void;
    setDragEndPoint(aScreenX: i32, aScreenY: i32): void;
    setDragEndPointForTests(aScreenX: i32, aScreenY: i32): void;
    endDragSession(aDoneDrag: boolean, aKeyModifiers?: u32): void;
    sendStoreDropTargetAndDelayEndDragSession(aEvent: DragEvent): void;
    sendDispatchToDropTargetAndResumeEndDragSession(aShouldDrop: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIFilePicker.idl
} // global

declare enum nsIFilePicker_Mode {
  modeOpen = 0,
  modeSave = 1,
  modeGetFolder = 2,
  modeOpenMultiple = 3,
}

declare enum nsIFilePicker_ResultCode {
  returnOK = 0,
  returnCancel = 1,
  returnReplace = 2,
}

declare enum nsIFilePicker_CaptureTarget {
  captureNone = 0,
  captureDefault = 1,
  captureUser = 2,
  captureEnv = 3,
}

declare global {
  namespace nsIFilePicker {
    type Mode = nsIFilePicker_Mode;
    type ResultCode = nsIFilePicker_ResultCode;
    type CaptureTarget = nsIFilePicker_CaptureTarget;
  }

  interface nsIFilePicker
    extends nsISupports,
      Enums<
        typeof nsIFilePicker_Mode &
          typeof nsIFilePicker_ResultCode &
          typeof nsIFilePicker_CaptureTarget
      > {
    readonly filterAll?: 1;
    readonly filterHTML?: 2;
    readonly filterText?: 4;
    readonly filterImages?: 8;
    readonly filterXML?: 16;
    readonly filterXUL?: 32;
    readonly filterApps?: 64;
    readonly filterAllowURLs?: 128;
    readonly filterAudio?: 256;
    readonly filterVideo?: 512;
    readonly filterPDF?: 1024;

    init(browsingContext: BrowsingContext, title: string, mode: nsIFilePicker.Mode): void;
    isModeSupported(mode: nsIFilePicker.Mode): Promise<any>;
    appendFilters(filterMask: i32): void;
    appendFilter(title: string, filter: string): void;
    appendRawFilter(filter: string): void;
    defaultString: string;
    defaultExtension: string;
    filterIndex: i32;
    displayDirectory: nsIFile;
    displaySpecialDirectory: string;
    readonly file: nsIFile;
    readonly fileURL: nsIURI;
    readonly files: nsISimpleEnumerator;
    readonly domFileOrDirectory: nsISupports;
    readonly domFileOrDirectoryEnumerator: nsISimpleEnumerator;
    addToRecentDocs: boolean;
    open(aFilePickerShownCallback: nsIFilePickerShownCallback): void;
    readonly mode: nsIFilePicker.Mode;
    okButtonLabel: string;
    capture: nsIFilePicker.CaptureTarget;
    readonly domFilesInWebKitDirectory: nsISimpleEnumerator;
  }

  type nsIFilePickerShownCallback = Callable<{
    done(aResult: nsIFilePicker.ResultCode): void;
  }>;

  // https://searchfox.org/mozilla-central/source/widget/nsIFormatConverter.idl

  interface nsIFormatConverter extends nsISupports {
    getInputDataFlavors(): string[];
    getOutputDataFlavors(): string[];
    canConvert(aFromDataFlavor: string, aToDataFlavor: string): boolean;
    convert(
      aFromDataFlavor: string,
      aFromData: nsISupports,
      aToDataFlavor: string,
      aToData: OutParam<nsISupports>
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIGfxInfo.idl
} // global

declare enum nsIGfxInfo_FontVisibilityDeviceDetermination {
  Unassigned = 0,
  Unknown_Platform = 1,
  Windows_Platform = 2,
  MacOS_Unknown = 3,
  Android_Unknown_Release_Version = 4,
  Android_Unknown_Peloton = 5,
  Android_Unknown_vbox = 6,
  Android_Unknown_mitv = 7,
  Android_Chromebook = 8,
  Android_Amazon = 9,
  Android_sub_9 = 10,
  Android_9_11 = 11,
  Android_12_plus = 12,
  Linux_Unknown = 13,
  Linux_Ubuntu_any = 14,
  Linux_Ubuntu_20 = 15,
  Linux_Ubuntu_22 = 16,
  Linux_Fedora_any = 17,
  Linux_Fedora_38 = 18,
  Linux_Fedora_39 = 19,
  MacOS_13_plus = 20,
  MacOS_sub_13 = 21,
}

declare global {
  namespace nsIGfxInfo {
    type FontVisibilityDeviceDetermination = nsIGfxInfo_FontVisibilityDeviceDetermination;
  }

  interface nsIGfxInfo
    extends nsISupports,
      Enums<typeof nsIGfxInfo_FontVisibilityDeviceDetermination> {
    readonly D2DEnabled: boolean;
    readonly DWriteEnabled: boolean;
    readonly EmbeddedInFirefoxReality: boolean;
    readonly AzureCanvasBackend: string;
    readonly AzureContentBackend: string;
    readonly usingGPUProcess: boolean;
    readonly usingRemoteCanvas: boolean;
    readonly usingAcceleratedCanvas: boolean;
    readonly hasBattery: boolean;
    readonly DWriteVersion: string;
    readonly cleartypeParameters: string;
    readonly textScaleFactor: float;
    readonly windowProtocol: string;
    readonly testType: string;
    readonly ContentBackend: string;
    readonly isHeadless: boolean;
    readonly TargetFrameRate: u32;
    readonly CodecSupportInfo: string;
    readonly fontVisibilityDetermination: nsIGfxInfo.FontVisibilityDeviceDetermination;
    readonly fontVisibilityDeterminationStr: string;
    readonly adapterDescription: string;
    readonly adapterDescription2: string;
    readonly adapterDriver: string;
    readonly adapterDriver2: string;
    readonly adapterVendorID: string;
    readonly adapterVendorID2: string;
    readonly adapterDeviceID: string;
    readonly adapterDeviceID2: string;
    readonly adapterSubsysID: string;
    readonly adapterSubsysID2: string;
    readonly adapterRAM: u32;
    readonly adapterRAM2: u32;
    readonly adapterDriverVendor: string;
    readonly adapterDriverVendor2: string;
    readonly adapterDriverVersion: string;
    readonly adapterDriverVersion2: string;
    readonly adapterDriverDate: string;
    readonly adapterDriverDate2: string;
    readonly isGPU2Active: boolean;
    readonly drmRenderDevice: string;
    getMonitors(): any;
    getFailures(indices: OutParam<i32[]>): string[];
    getFeatureStatus(aFeature: i32, aFailureId?: OutParam<string>): i32;
    getFeatureStatusStr(aFeature: string, aFailureId?: OutParam<string>): string;
    getFeatureSuggestedDriverVersion(aFeature: i32): string;
    getFeatureSuggestedDriverVersionStr(aFeature: string): string;
    getInfo(): any;
    getFeatureLog(): any;
    getFeatures(): any;
    getActiveCrashGuards(): any;
    controlGPUProcessForXPCShell(aEnable: boolean): boolean;
    killGPUProcessForTests(): void;
    crashGPUProcessForTests(): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIGfxInfoDebug.idl

  interface nsIGfxInfoDebug extends nsISupports {
    spoofVendorID(aVendorID: string): void;
    spoofDeviceID(aDeviceID: string): void;
    spoofDriverVersion(aDriverVersion: string): void;
    spoofOSVersion(aVersion: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIMockDragServiceController.idl
} // global

declare enum nsIMockDragServiceController_EventType {
  eDragEnter = 0,
  eDragOver = 1,
  eDragExit = 2,
  eDrop = 3,
  eMouseDown = 4,
  eMouseMove = 5,
  eMouseUp = 6,
}

declare global {
  namespace nsIMockDragServiceController {
    type EventType = nsIMockDragServiceController_EventType;
  }

  interface nsIMockDragServiceController
    extends nsISupports,
      Enums<typeof nsIMockDragServiceController_EventType> {
    readonly mockDragService: nsIDragService;
    sendEvent(
      aBC: BrowsingContext,
      aEventType: nsIMockDragServiceController.EventType,
      aScreenX: i32,
      aScreenY: i32,
      aKeyModifiers?: u32
    ): void;
    cancelDrag(aKeyModifiers?: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIPaper.idl

  interface nsIPaper extends nsISupports {
    readonly id: string;
    readonly name: string;
    readonly width: double;
    readonly height: double;
    readonly unwriteableMargin: Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIPaperMargin.idl

  interface nsIPaperMargin extends nsISupports {
    readonly top: double;
    readonly right: double;
    readonly bottom: double;
    readonly left: double;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIPrintDialogService.idl

  interface nsIPrintDialogService extends nsISupports {
    init(): void;
    showPrintDialog(
      aParent: mozIDOMWindowProxy,
      aHaveSelection: boolean,
      aPrintSettings: nsIPrintSettings
    ): void;
    showPageSetupDialog(aParent: mozIDOMWindowProxy, aPrintSettings: nsIPrintSettings): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIPrintSettings.idl
} // global

declare enum nsIPrintSettings_OutputDestinationType {
  kOutputDestinationPrinter = 0,
  kOutputDestinationFile = 1,
  kOutputDestinationStream = 2,
}

declare global {
  namespace nsIPrintSettings {
    type OutputDestinationType = nsIPrintSettings_OutputDestinationType;
  }

  interface nsIPrintSettings
    extends nsISupports,
      Enums<typeof nsIPrintSettings_OutputDestinationType> {
    readonly kInitSaveHeaderLeft?: 2;
    readonly kInitSaveHeaderCenter?: 4;
    readonly kInitSaveHeaderRight?: 8;
    readonly kInitSaveFooterLeft?: 16;
    readonly kInitSaveFooterCenter?: 32;
    readonly kInitSaveFooterRight?: 64;
    readonly kInitSaveBGColors?: 128;
    readonly kInitSaveBGImages?: 256;
    readonly kInitSavePaperSize?: 512;
    readonly kInitSaveDuplex?: 2048;
    readonly kInitSaveUnwriteableMargins?: 16384;
    readonly kInitSaveEdges?: 32768;
    readonly kInitSaveReversed?: 65536;
    readonly kInitSaveInColor?: 131072;
    readonly kInitSaveOrientation?: 262144;
    readonly kInitSavePrinterName?: 1048576;
    readonly kInitSavePrintToFile?: 2097152;
    readonly kInitSaveToFileName?: 4194304;
    readonly kInitSavePageDelay?: 8388608;
    readonly kInitSaveMargins?: 16777216;
    readonly kInitSaveShrinkToFit?: 134217728;
    readonly kInitSaveScaling?: 268435456;
    readonly kInitSaveAll?: 4294967295;
    readonly kGlobalSettings?: 134447614;
    readonly kPrintDialogPersistSettings?: 428313598;
    readonly kJustLeft?: 0;
    readonly kJustCenter?: 1;
    readonly kJustRight?: 2;
    readonly kPaperSizeInches?: 0;
    readonly kPaperSizeMillimeters?: 1;
    readonly kPortraitOrientation?: 0;
    readonly kLandscapeOrientation?: 1;
    readonly kOutputFormatNative?: 0;
    readonly kOutputFormatPDF?: 2;
    readonly kDuplexNone?: 0;
    readonly kDuplexFlipOnLongEdge?: 1;
    readonly kDuplexFlipOnShortEdge?: 2;

    GetEffectivePageSize(aWidth: OutParam<double>, aHeight: OutParam<double>): void;
    clone(): nsIPrintSettings;
    assign(aPS: nsIPrintSettings): void;
    equivalentTo(aPrintSettings: nsIPrintSettings): boolean;
    edgeTop: double;
    edgeLeft: double;
    edgeBottom: double;
    edgeRight: double;
    marginTop: double;
    marginLeft: double;
    marginBottom: double;
    marginRight: double;
    unwriteableMarginTop: double;
    unwriteableMarginLeft: double;
    unwriteableMarginBottom: double;
    unwriteableMarginRight: double;
    scaling: double;
    printBGColors: boolean;
    printBGImages: boolean;
    honorPageRuleMargins: boolean;
    usePageRuleSizeAsPaperSize: boolean;
    ignoreUnwriteableMargins: boolean;
    showMarginGuides: boolean;
    printSelectionOnly: boolean;
    title: string;
    docURL: string;
    headerStrLeft: string;
    headerStrCenter: string;
    headerStrRight: string;
    footerStrLeft: string;
    footerStrCenter: string;
    footerStrRight: string;
    printSilent: boolean;
    shrinkToFit: boolean;
    paperId: string;
    paperWidth: double;
    paperHeight: double;
    paperSizeUnit: i16;
    printReversed: boolean;
    printInColor: boolean;
    orientation: i32;
    numCopies: i32;
    numPagesPerSheet: i32;
    outputDestination: nsIPrintSettings.OutputDestinationType;
    outputFormat: i16;
    printerName: string;
    toFileName: string;
    outputStream: nsIOutputStream;
    printPageDelay: i32;
    resolution: i32;
    duplex: i32;
    isInitializedFromPrinter: boolean;
    isInitializedFromPrefs: boolean;
    pageRanges: i32[];
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIPrintSettingsService.idl

  interface nsIPrintSettingsService extends nsISupports {
    createNewPrintSettings(): nsIPrintSettings;
    readonly lastUsedPrinterName: string;
    initPrintSettingsFromPrinter(aPrinterName: string, aPrintSettings: nsIPrintSettings): void;
    initPrintSettingsFromPrefs(
      aPrintSettings: nsIPrintSettings,
      aUsePrinterNamePrefix: boolean,
      aFlags: u32
    ): void;
    maybeSavePrintSettingsToPrefs(aPrintSettings: nsIPrintSettings, aFlags: u32): void;
    maybeSaveLastUsedPrinterNameToPrefs(aPrinterName: string): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIPrinter.idl

  interface nsIPrinterInfo extends nsISupports {
    readonly paperList: nsIPaper[];
    readonly defaultSettings: nsIPrintSettings;
  }

  interface nsIPrinter extends nsISupports {
    readonly name: string;
    readonly systemName: string;
    readonly printerInfo: Promise<any>;
    copyFromWithValidation(aSettingsToCopyFrom: nsIPrintSettings): Promise<any>;
    readonly supportsDuplex: Promise<any>;
    readonly supportsColor: Promise<any>;
    readonly supportsMonochrome: Promise<any>;
    readonly supportsCollation: Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIPrinterList.idl

  interface nsIPrinterList extends nsISupports {
    initPrintSettingsFromPrinter(aPrinterName: string, aPrintSettings: nsIPrintSettings): void;
    readonly systemDefaultPrinterName: string;
    getPrinterByName(aPrinterName: string): Promise<any>;
    getPrinterBySystemName(aPrinterName: string): Promise<any>;
    getNamedOrDefaultPrinter(aPrinterName: string): Promise<any>;
    readonly printers: Promise<any>;
    readonly fallbackPaperList: Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIScreen.idl

  interface nsIScreen extends nsISupports {
    GetRect(
      left: OutParam<i32>,
      top: OutParam<i32>,
      width: OutParam<i32>,
      height: OutParam<i32>
    ): void;
    GetAvailRect(
      left: OutParam<i32>,
      top: OutParam<i32>,
      width: OutParam<i32>,
      height: OutParam<i32>
    ): void;
    GetRectDisplayPix(
      left: OutParam<i32>,
      top: OutParam<i32>,
      width: OutParam<i32>,
      height: OutParam<i32>
    ): void;
    GetAvailRectDisplayPix(
      left: OutParam<i32>,
      top: OutParam<i32>,
      width: OutParam<i32>,
      height: OutParam<i32>
    ): void;
    readonly pixelDepth: i32;
    readonly colorDepth: i32;
    readonly contentsScaleFactor: double;
    readonly defaultCSSScaleFactor: double;
    readonly dpi: float;
    readonly refreshRate: i32;
    readonly isPseudoDisplay: boolean;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIScreenManager.idl

  interface nsIScreenManager extends nsISupports {
    screenForRect(left: i32, top: i32, width: i32, height: i32): nsIScreen;
    readonly primaryScreen: nsIScreen;
    readonly totalScreenPixels: i64;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsISharePicker.idl

  interface nsISharePicker extends nsISupports {
    init(openerWindow: mozIDOMWindowProxy): void;
    readonly openerWindow: mozIDOMWindowProxy;
    share(title: string, text: string, url: nsIURI): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsISound.idl

  interface nsISound extends nsISupports {
    readonly EVENT_NEW_MAIL_RECEIVED?: 0;
    readonly EVENT_ALERT_DIALOG_OPEN?: 1;
    readonly EVENT_CONFIRM_DIALOG_OPEN?: 2;
    readonly EVENT_PROMPT_DIALOG_OPEN?: 3;
    readonly EVENT_SELECT_DIALOG_OPEN?: 4;
    readonly EVENT_MENU_EXECUTE?: 5;
    readonly EVENT_MENU_POPUP?: 6;
    readonly EVENT_EDITOR_MAX_LEN?: 7;

    play(aURL: nsIURL): void;
    beep(): void;
    init(): void;
    playEventSound(aEventId: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsISystemStatusBar.idl

  interface nsISystemStatusBar extends nsISupports {
    addItem(aMenuElement: Element): void;
    removeItem(aMenuElement: Element): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsITransferable.idl

  interface nsIFlavorDataProvider extends nsISupports {
    getFlavorData(
      aTransferable: nsITransferable,
      aFlavor: string,
      aData: OutParam<nsISupports>
    ): void;
  }

  interface nsITransferable extends nsISupports {
    init(aContext: nsILoadContext): void;
    flavorsTransferableCanExport(): string[];
    getTransferData(aFlavor: string, aData: OutParam<nsISupports>): void;
    getAnyTransferData(aFlavor: OutParam<string>, aData: OutParam<nsISupports>): void;
    flavorsTransferableCanImport(): string[];
    setTransferData(aFlavor: string, aData: nsISupports): void;
    clearAllData(): void;
    addDataFlavor(aDataFlavor: string): void;
    removeDataFlavor(aDataFlavor: string): void;
    converter: nsIFormatConverter;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIUserIdleService.idl

  interface nsIUserIdleService extends nsISupports {
    readonly idleTime: u32;
    addIdleObserver(observer: nsIObserver, time: u32): void;
    removeIdleObserver(observer: nsIObserver, time: u32): void;
    disabled: boolean;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIUserIdleServiceInternal.idl

  interface nsIUserIdleServiceInternal extends nsIUserIdleService {
    resetIdleTimeOut(idleDeltaInMS: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/windowcreator/nsIWindowCreator.idl

  interface nsIWindowCreator extends nsISupports {
    createChromeWindow(
      parent: nsIWebBrowserChrome,
      chromeFlags: u32,
      aOpenWindowInfo: nsIOpenWindowInfo,
      cancel: OutParam<boolean>
    ): nsIWebBrowserChrome;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/windowcreator/nsIWindowProvider.idl

  interface nsIWindowProvider extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/toolkit/components/windowwatcher/nsIDialogParamBlock.idl

  interface nsIDialogParamBlock extends nsISupports {
    GetInt(inIndex: i32): i32;
    SetInt(inIndex: i32, inInt: i32): void;
    SetNumberStrings(inNumStrings: i32): void;
    GetString(inIndex: i32): string;
    SetString(inIndex: i32, inString: string): void;
    objects: nsIMutableArray;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/windowwatcher/nsIOpenWindowInfo.idl

  interface nsIOpenWindowInfo extends nsISupports {
    readonly parent: BrowsingContext;
    readonly isRemote: boolean;
    readonly forceNoOpener: boolean;
    readonly isForPrinting: boolean;
    readonly isForWindowDotPrint: boolean;
    readonly isTopLevelCreatedByWebContent: boolean;
    readonly hasValidUserGestureActivation: boolean;
    readonly textDirectiveUserActivation: boolean;
    readonly originAttributes: any;
    cancel(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/windowwatcher/nsIPromptCollection.idl

  interface nsIPromptCollection extends nsISupports {
    asyncBeforeUnloadCheck(aBrowsingContext: BrowsingContext): Promise<any>;
    confirmRepost(aBrowsingContext: BrowsingContext): boolean;
    confirmFolderUpload(aBrowsingContext: BrowsingContext, aDirectoryName: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/windowwatcher/nsIPromptFactory.idl

  interface nsIPromptFactory extends nsISupports {
    getPrompt<T extends nsIID>(aParent: mozIDOMWindowProxy, iid: T): nsQIResult<T>;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/windowwatcher/nsIPromptService.idl

  interface nsIPromptService extends nsISupports {
    readonly BUTTON_POS_0?: 1;
    readonly BUTTON_POS_1?: 256;
    readonly BUTTON_POS_2?: 65536;
    readonly BUTTON_TITLE_OK?: 1;
    readonly BUTTON_TITLE_CANCEL?: 2;
    readonly BUTTON_TITLE_YES?: 3;
    readonly BUTTON_TITLE_NO?: 4;
    readonly BUTTON_TITLE_SAVE?: 5;
    readonly BUTTON_TITLE_DONT_SAVE?: 6;
    readonly BUTTON_TITLE_REVERT?: 7;
    readonly BUTTON_TITLE_IS_STRING?: 127;
    readonly BUTTON_POS_0_DEFAULT?: 0;
    readonly BUTTON_POS_1_DEFAULT?: 16777216;
    readonly BUTTON_POS_2_DEFAULT?: 33554432;
    readonly BUTTON_DELAY_ENABLE?: 67108864;
    readonly SHOW_SPINNER?: 134217728;
    readonly BUTTON_NONE_ENABLE_BIT?: 268435456;
    readonly BUTTON_NONE?: 268435583;
    readonly BUTTON_POS_1_IS_SECONDARY?: 536870912;
    readonly STD_OK_CANCEL_BUTTONS?: 513;
    readonly STD_YES_NO_BUTTONS?: 1027;
    readonly MODAL_TYPE_CONTENT?: 1;
    readonly MODAL_TYPE_TAB?: 2;
    readonly MODAL_TYPE_WINDOW?: 3;
    readonly MODAL_TYPE_INTERNAL_WINDOW?: 4;

    alert(aParent: mozIDOMWindowProxy, aDialogTitle: string, aText: string): void;
    alertBC(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string
    ): void;
    asyncAlert(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string
    ): Promise<any>;
    alertCheck(
      aParent: mozIDOMWindowProxy,
      aDialogTitle: string,
      aText: string,
      aCheckMsg: string,
      aCheckState: InOutParam<boolean>
    ): void;
    alertCheckBC(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aCheckMsg: string,
      aCheckState: InOutParam<boolean>
    ): void;
    asyncAlertCheck(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aCheckMsg: string,
      aCheckState: boolean
    ): Promise<any>;
    confirm(aParent: mozIDOMWindowProxy, aDialogTitle: string, aText: string): boolean;
    confirmBC(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string
    ): boolean;
    asyncConfirm(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string
    ): Promise<any>;
    confirmCheck(
      aParent: mozIDOMWindowProxy,
      aDialogTitle: string,
      aText: string,
      aCheckMsg: string,
      aCheckState: InOutParam<boolean>
    ): boolean;
    confirmCheckBC(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aCheckMsg: string,
      aCheckState: InOutParam<boolean>
    ): boolean;
    asyncConfirmCheck(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aCheckMsg: string,
      aCheckState: boolean
    ): Promise<any>;
    confirmEx(
      aParent: mozIDOMWindowProxy,
      aDialogTitle: string,
      aText: string,
      aButtonFlags: u32,
      aButton0Title: string,
      aButton1Title: string,
      aButton2Title: string,
      aCheckMsg: string,
      aCheckState: InOutParam<boolean>
    ): i32;
    confirmExBC(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aButtonFlags: u32,
      aButton0Title: string,
      aButton1Title: string,
      aButton2Title: string,
      aCheckMsg: string,
      aCheckState: InOutParam<boolean>
    ): i32;
    asyncConfirmEx(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aButtonFlags: u32,
      aButton0Title: string,
      aButton1Title: string,
      aButton2Title: string,
      aCheckMsg: string,
      aCheckState: boolean,
      aExtraArgs?: any
    ): Promise<any>;
    prompt(
      aParent: mozIDOMWindowProxy,
      aDialogTitle: string,
      aText: string,
      aValue: InOutParam<string>,
      aCheckMsg: string,
      aCheckState: InOutParam<boolean>
    ): boolean;
    promptBC(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aValue: InOutParam<string>,
      aCheckMsg: string,
      aCheckState: InOutParam<boolean>
    ): boolean;
    asyncPrompt(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aValue: string,
      aCheckMsg: string,
      aCheckState: boolean
    ): Promise<any>;
    promptUsernameAndPassword(
      aParent: mozIDOMWindowProxy,
      aDialogTitle: string,
      aText: string,
      aUsername: InOutParam<string>,
      aPassword: InOutParam<string>
    ): boolean;
    promptUsernameAndPasswordBC(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aUsername: InOutParam<string>,
      aPassword: InOutParam<string>
    ): boolean;
    asyncPromptUsernameAndPassword(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aUsername: string,
      aPassword: string
    ): Promise<any>;
    promptPassword(
      aParent: mozIDOMWindowProxy,
      aDialogTitle: string,
      aText: string,
      aPassword: InOutParam<string>
    ): boolean;
    promptPasswordBC(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aPassword: InOutParam<string>
    ): boolean;
    asyncPromptPassword(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aPassword: string
    ): Promise<any>;
    select(
      aParent: mozIDOMWindowProxy,
      aDialogTitle: string,
      aText: string,
      aSelectList: string[],
      aOutSelection: OutParam<i32>
    ): boolean;
    selectBC(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aSelectList: string[],
      aOutSelection: OutParam<i32>
    ): boolean;
    asyncSelect(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aDialogTitle: string,
      aText: string,
      aSelectList: string[]
    ): Promise<any>;
    promptAuth(
      aParent: mozIDOMWindowProxy,
      aChannel: nsIChannel,
      level: u32,
      authInfo: nsIAuthInformation
    ): boolean;
    promptAuthBC(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aChannel: nsIChannel,
      level: u32,
      authInfo: nsIAuthInformation
    ): boolean;
    asyncPromptAuth(
      aBrowsingContext: BrowsingContext,
      modalType: u32,
      aChannel: nsIChannel,
      level: u32,
      authInfo: nsIAuthInformation
    ): Promise<any>;
    confirmUserPaste(aWindow: WindowGlobalParent): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/windowwatcher/nsIWindowWatcher.idl

  interface nsIWindowWatcher extends nsISupports {
    openWindow(
      aParent: mozIDOMWindowProxy,
      aUrl: string,
      aName: string,
      aFeatures: string,
      aArguments: nsISupports
    ): mozIDOMWindowProxy;
    registerNotification(aObserver: nsIObserver): void;
    unregisterNotification(aObserver: nsIObserver): void;
    getWindowEnumerator(): nsISimpleEnumerator;
    getNewPrompter(aParent: mozIDOMWindowProxy): nsIPrompt;
    getNewAuthPrompter(aParent: mozIDOMWindowProxy): nsIAuthPrompt;
    setWindowCreator(creator: nsIWindowCreator): void;
    hasWindowCreator(): boolean;
    getChromeForWindow(aWindow: mozIDOMWindowProxy): nsIWebBrowserChrome;
    getWindowByName(aTargetName: string): mozIDOMWindowProxy;
    readonly activeWindow: mozIDOMWindowProxy;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/windowwatcher/nsPIWindowWatcher.idl

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIAvailableMemoryWatcherBase.idl

  interface nsITabUnloader extends nsISupports {
    unloadTabAsync(): void;
  }

  interface nsIAvailableMemoryWatcherBase extends nsISupports {
    registerTabUnloader(aTabUnloader: nsITabUnloader): void;
    onUnloadAttemptCompleted(aResult: nsresult): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIConsoleListener.idl

  type nsIConsoleListener = Callable<{
    observe(aMessage: nsIConsoleMessage): void;
  }>;

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIConsoleMessage.idl

  interface nsIConsoleMessage extends nsISupports {
    readonly debug?: 0;
    readonly info?: 1;
    readonly warn?: 2;
    readonly error?: 3;

    readonly logLevel: u32;
    readonly timeStamp: i64;
    readonly microSecondTimeStamp: i64;
    readonly message: string;
    isForwardedFromContentProcess: boolean;
    toString(): string;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIConsoleService.idl
} // global

declare enum nsIConsoleService_OutputMode {
  SuppressLog = 0,
  OutputToLog = 1,
}

declare global {
  namespace nsIConsoleService {
    type OutputMode = nsIConsoleService_OutputMode;
  }

  interface nsIConsoleService extends nsISupports, Enums<typeof nsIConsoleService_OutputMode> {
    logMessage(message: nsIConsoleMessage): void;
    callFunctionAndLogException(targetGlobal: any, func: any): any;
    logMessageWithMode(message: nsIConsoleMessage, mode: nsIConsoleService.OutputMode): void;
    logStringMessage(message: string): void;
    getMessageArray(): nsIConsoleMessage[];
    registerListener(listener: nsIConsoleListener): void;
    unregisterListener(listener: nsIConsoleListener): void;
    reset(): void;
    resetWindow(windowInnerId: u64): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsICycleCollectorListener.idl

  interface nsICycleCollectorHandler extends nsISupports {
    noteRefCountedObject(aAddress: string, aRefCount: u32, aObjectDescription: string): void;
    noteGCedObject(
      aAddress: string,
      aMarked: boolean,
      aObjectDescription: string,
      aCompartmentAddress: string
    ): void;
    noteEdge(aFromAddress: string, aToAddress: string, aEdgeName: string): void;
    describeRoot(aAddress: string, aKnownEdges: u32): void;
    describeGarbage(aAddress: string): void;
  }

  interface nsICycleCollectorLogSink extends nsISupports {
    closeGCLog(): void;
    closeCCLog(): void;
    filenameIdentifier: string;
    processIdentifier: i32;
    readonly gcLog: nsIFile;
    readonly ccLog: nsIFile;
  }

  interface nsICycleCollectorListener extends nsISupports {
    allTraces(): nsICycleCollectorListener;
    readonly wantAllTraces: boolean;
    disableLog: boolean;
    logSink: nsICycleCollectorLogSink;
    wantAfterProcessing: boolean;
    processNext(aHandler: nsICycleCollectorHandler): boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIDebug2.idl

  interface nsIDebug2 extends nsISupports {
    readonly isDebugBuild: boolean;
    readonly assertionCount: i32;
    readonly isDebuggerAttached: boolean;
    assertion(aStr: string, aExpr: string, aFile: string, aLine: i32): void;
    warning(aStr: string, aFile: string, aLine: i32): void;
    break(aFile: string, aLine: i32): void;
    abort(aFile: string, aLine: i32): void;
    rustPanic(aMessage: string): void;
    rustLog(aTarget: string, aMessage: string): void;
    crashWithOOM(): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIException.idl

  interface nsIStackFrame extends nsISupports {
    readonly filename: string;
    readonly name: string;
    readonly sourceId: i32;
    readonly lineNumber: i32;
    readonly columnNumber: i32;
    readonly asyncCause: string;
    readonly asyncCaller: nsIStackFrame;
    readonly caller: nsIStackFrame;
    readonly formattedStack: string;
    readonly nativeSavedFrame: any;
    toString(): string;
  }

  interface nsIException extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIInterfaceRequestor.idl

  interface nsIInterfaceRequestor extends nsISupports {
    getInterface<T extends nsIID>(uuid: T): nsQIResult<T>;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIMemoryInfoDumper.idl

  type nsIFinishDumpingCallback = Callable<{
    callback(data: nsISupports): void;
  }>;

  interface nsIDumpGCAndCCLogsCallback extends nsISupports {
    onDump(aGCLog: nsIFile, aCCLog: nsIFile, aIsParent: boolean): void;
    onFinish(): void;
  }

  interface nsIMemoryInfoDumper extends nsISupports {
    dumpMemoryReportsToNamedFile(
      aFilename: string,
      aFinishDumping: nsIFinishDumpingCallback,
      aFinishDumpingData: nsISupports,
      aAnonymize: boolean,
      aMinimizeMemoryUsage: boolean
    ): void;
    dumpMemoryInfoToTempDir(
      aIdentifier: string,
      aAnonymize: boolean,
      aMinimizeMemoryUsage: boolean
    ): void;
    dumpGCAndCCLogsToFile(
      aIdentifier: string,
      aDumpAllTraces: boolean,
      aDumpChildProcesses: boolean,
      aCallback: nsIDumpGCAndCCLogsCallback
    ): void;
    dumpGCAndCCLogsToSink(aDumpAllTraces: boolean, aSink: nsICycleCollectorLogSink): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIMemoryReporter.idl

  type nsIHandleReportCallback = Callable<{
    callback(
      process: string,
      path: string,
      kind: i32,
      units: i32,
      amount: i64,
      description: string,
      data: nsISupports
    ): void;
  }>;

  interface nsIMemoryReporter extends nsISupports {
    readonly KIND_NONHEAP?: 0;
    readonly KIND_HEAP?: 1;
    readonly KIND_OTHER?: 2;
    readonly UNITS_BYTES?: 0;
    readonly UNITS_COUNT?: 1;
    readonly UNITS_COUNT_CUMULATIVE?: 2;
    readonly UNITS_PERCENTAGE?: 3;

    collectReports(callback: nsIHandleReportCallback, data: nsISupports, anonymize: boolean): void;
  }

  type nsIFinishReportingCallback = Callable<{
    callback(data: nsISupports): void;
  }>;

  type nsIHeapAllocatedCallback = Callable<{
    callback(bytesAllocated: i64): void;
  }>;

  interface nsIMemoryReporterManager extends nsISupports {
    init(): void;
    registerStrongReporter(reporter: nsIMemoryReporter): void;
    registerStrongAsyncReporter(reporter: nsIMemoryReporter): void;
    registerWeakReporter(reporter: nsIMemoryReporter): void;
    registerWeakAsyncReporter(reporter: nsIMemoryReporter): void;
    unregisterStrongReporter(reporter: nsIMemoryReporter): void;
    unregisterWeakReporter(reporter: nsIMemoryReporter): void;
    blockRegistrationAndHideExistingReporters(): void;
    unblockRegistrationAndRestoreOriginalReporters(): void;
    registerStrongReporterEvenIfBlocked(aReporter: nsIMemoryReporter): void;
    getReports(
      handleReport: nsIHandleReportCallback,
      handleReportData: nsISupports,
      finishReporting: nsIFinishReportingCallback,
      finishReportingData: nsISupports,
      anonymize: boolean
    ): void;
    getReportsExtended(
      handleReport: nsIHandleReportCallback,
      handleReportData: nsISupports,
      finishReporting: nsIFinishReportingCallback,
      finishReportingData: nsISupports,
      anonymize: boolean,
      minimizeMemoryUsage: boolean,
      DMDDumpIdent: string
    ): void;
    readonly vsize: i64;
    readonly vsizeMaxContiguous: i64;
    readonly resident: i64;
    readonly residentFast: i64;
    readonly residentPeak: i64;
    readonly residentUnique: i64;
    readonly heapAllocated: i64;
    readonly heapOverheadFraction: i64;
    readonly JSMainRuntimeGCHeap: i64;
    readonly JSMainRuntimeTemporaryPeak: i64;
    readonly JSMainRuntimeCompartmentsSystem: i64;
    readonly JSMainRuntimeCompartmentsUser: i64;
    readonly JSMainRuntimeRealmsSystem: i64;
    readonly JSMainRuntimeRealmsUser: i64;
    readonly imagesContentUsedUncompressed: i64;
    readonly storageSQLite: i64;
    readonly lowMemoryEventsPhysical: i64;
    readonly ghostWindows: i64;
    readonly pageFaultsHard: i64;
    readonly hasMozMallocUsableSize: boolean;
    readonly isDMDEnabled: boolean;
    readonly isDMDRunning: boolean;
    minimizeMemoryUsage(callback: nsIRunnable): void;
    sizeOfTab(
      window: mozIDOMWindowProxy,
      jsObjectsSize: OutParam<i64>,
      jsStringsSize: OutParam<i64>,
      jsOtherSize: OutParam<i64>,
      domSize: OutParam<i64>,
      styleSize: OutParam<i64>,
      otherSize: OutParam<i64>,
      totalSize: OutParam<i64>,
      jsMilliseconds: OutParam<double>,
      nonJSMilliseconds: OutParam<double>
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsISecurityConsoleMessage.idl

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsISupports.idl

  interface nsISupports {
    QueryInterface?<T extends nsIID>(aIID: T): nsQIResult<T>;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIUUIDGenerator.idl

  interface nsIUUIDGenerator extends nsISupports {
    generateUUID(): nsID;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIVersionComparator.idl

  interface nsIVersionComparator extends nsISupports {
    compare(A: string, B: string): i32;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIWeakReference.idl

  interface nsIWeakReference extends nsISupports {
    QueryReferent<T extends nsIID>(uuid: T): nsQIResult<T>;
  }

  interface nsISupportsWeakReference extends nsISupports {
    GetWeakReference(): nsIWeakReference;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsrootidl.idl

  // https://searchfox.org/mozilla-central/source/xpcom/components/nsICategoryManager.idl

  interface nsICategoryEntry extends nsISupportsCString {
    readonly entry: string;
    readonly value: string;
  }

  interface nsICategoryManager extends nsISupports {
    getCategoryEntry(aCategory: string, aEntry: string): string;
    addCategoryEntry(
      aCategory: string,
      aEntry: string,
      aValue: string,
      aPersist: boolean,
      aReplace: boolean
    ): string;
    deleteCategoryEntry(aCategory: string, aEntry: string, aPersist: boolean): void;
    deleteCategory(aCategory: string): void;
    enumerateCategory(aCategory: string): nsISimpleEnumerator;
    enumerateCategories(): nsISimpleEnumerator;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/components/nsIClassInfo.idl

  interface nsIClassInfo extends nsISupports {
    readonly SINGLETON?: 1;
    readonly THREADSAFE?: 2;
    readonly SINGLETON_CLASSINFO?: 32;
    readonly RESERVED?: 2147483648;

    readonly interfaces: nsID[];
    readonly contractID: string;
    readonly classDescription: string;
    readonly classID: nsID;
    readonly flags: u32;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/components/nsIComponentManager.idl

  interface nsIComponentManager extends nsISupports {
    getClassObject<T extends nsIID>(aClass: nsID, aIID: T): nsQIResult<T>;
    getClassObjectByContractID<T extends nsIID>(aContractID: string, aIID: T): nsQIResult<T>;
    addBootstrappedManifestLocation(aLocation: nsIFile): void;
    removeBootstrappedManifestLocation(aLocation: nsIFile): void;
    getManifestLocations(): nsIArray;
    getComponentESModules(): nsIUTF8StringEnumerator;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/components/nsIComponentRegistrar.idl

  interface nsIComponentRegistrar extends nsISupports {
    autoRegister(aSpec: nsIFile): void;
    registerFactory(
      aClass: nsID,
      aClassName: string,
      aContractID: string,
      aFactory: nsIFactory
    ): void;
    unregisterFactory(aClass: nsID, aFactory: nsIFactory): void;
    isCIDRegistered(aClass: nsID): boolean;
    isContractIDRegistered(aContractID: string): boolean;
    getContractIDs(): string[];
    contractIDToCID(aContractID: string): nsID;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/components/nsIFactory.idl

  interface nsIFactory extends nsISupports {
    createInstance<T extends nsIID>(iid: T): nsQIResult<T>;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/components/nsIServiceManager.idl

  interface nsIServiceManager extends nsISupports {
    getService<T extends nsIID>(aClass: nsID, aIID: T): nsQIResult<T>;
    getServiceByContractID<T extends nsIID>(aContractID: string, aIID: T): nsQIResult<T>;
    isServiceInstantiated(aClass: nsID, aIID: nsID): boolean;
    isServiceInstantiatedByContractID(aContractID: string, aIID: nsID): boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIArray.idl

  interface nsIArray extends nsISupports {
    readonly length: u32;
    queryElementAt<T extends nsIID>(index: u32, uuid: T): nsQIResult<T>;
    indexOf(startIndex: u32, element: nsISupports): u32;
    enumerate(aElemIID?: nsID): nsISimpleEnumerator;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIArrayExtensions.idl

  interface nsIArrayExtensions extends nsIArray {
    Count(): u32;
    GetElementAt(index: u32): nsISupports;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIINIParser.idl

  interface nsIINIParser extends nsISupports {
    initFromString(aData: string): void;
    getSections(): nsIUTF8StringEnumerator;
    getKeys(aSection: string): nsIUTF8StringEnumerator;
    getString(aSection: string, aKey: string): string;
  }

  interface nsIINIParserWriter extends nsISupports {
    setString(aSection: string, aKey: string, aValue: string): void;
    writeFile(aINIFile: nsIFile): void;
    writeToString(): string;
  }

  interface nsIINIParserFactory extends nsISupports {
    createINIParser(aINIFile?: nsIFile): nsIINIParser;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIMutableArray.idl

  interface nsIMutableArray extends nsIArrayExtensions {
    appendElement(element: nsISupports): void;
    removeElementAt(index: u32): void;
    insertElementAt(element: nsISupports, index: u32): void;
    replaceElementAt(element: nsISupports, index: u32): void;
    clear(): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIObserver.idl

  type nsIObserver = Callable<{
    observe(aSubject: nsISupports, aTopic: string, aData: string): void;
  }>;

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIObserverService.idl

  interface nsIObserverService extends nsISupports {
    addObserver(anObserver: nsIObserver, aTopic: string, ownsWeak?: boolean): void;
    removeObserver(anObserver: nsIObserver, aTopic: string): void;
    notifyObservers(aSubject: nsISupports, aTopic: string, someData?: string): void;
    enumerateObservers(aTopic: string): nsISimpleEnumerator;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIPersistentProperties2.idl

  interface nsIPropertyElement extends nsISupports {
    key: string;
    value: string;
  }

  interface nsIPersistentProperties extends nsIProperties {
    load(input: nsIInputStream): void;
    save(output: nsIOutputStream, header: string): void;
    enumerate(): nsISimpleEnumerator;
    getStringProperty(key: string): string;
    setStringProperty(key: string, value: string): string;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIProperties.idl

  interface nsIProperties extends nsISupports {
    get<T extends nsIID>(prop: string, iid: T): nsQIResult<T>;
    set(prop: string, value: nsISupports): void;
    has(prop: string): boolean;
    undefine(prop: string): void;
    getKeys(): string[];
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIProperty.idl

  interface nsIProperty extends nsISupports {
    readonly name: string;
    readonly value: nsIVariant;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIPropertyBag.idl

  interface nsIPropertyBag extends nsISupports {
    readonly enumerator: nsISimpleEnumerator;
    getProperty(name: string): nsIVariant;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIPropertyBag2.idl

  interface nsIPropertyBag2 extends nsIPropertyBag {
    getPropertyAsInt32(prop: string): i32;
    getPropertyAsUint32(prop: string): u32;
    getPropertyAsInt64(prop: string): i64;
    getPropertyAsUint64(prop: string): u64;
    getPropertyAsDouble(prop: string): double;
    getPropertyAsAString(prop: string): string;
    getPropertyAsACString(prop: string): string;
    getPropertyAsAUTF8String(prop: string): string;
    getPropertyAsBool(prop: string): boolean;
    getPropertyAsInterface<T extends nsIID>(prop: string, iid: T): nsQIResult<T>;
    get(prop: string): nsIVariant;
    hasKey(prop: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsISerializable.idl

  interface nsISerializable extends nsISupports {
    read(aInputStream: nsIObjectInputStream): void;
    write(aOutputStream: nsIObjectOutputStream): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsISimpleEnumerator.idl

  interface nsIJSEnumerator extends nsISupports {
    iterator(): nsIJSEnumerator;
    next(): any;
  }

  interface nsISimpleEnumeratorBase extends nsISupports {
    iterator(): nsIJSEnumerator;
    entries(aIface: nsID): nsIJSEnumerator;
  }

  interface nsISimpleEnumerator extends nsISimpleEnumeratorBase {
    hasMoreElements(): boolean;
    getNext(): nsISupports;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIStringEnumerator.idl

  interface nsIStringEnumeratorBase extends nsISupports {
    iterator(): nsIJSEnumerator;
  }

  interface nsIStringEnumerator extends nsIStringEnumeratorBase {
    hasMore(): boolean;
    getNext(): string;
  }

  interface nsIUTF8StringEnumerator extends nsIStringEnumeratorBase {
    hasMore(): boolean;
    getNext(): string;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsISupportsIterators.idl

  interface nsIOutputIterator extends nsISupports {
    putElement(anElementToPut: nsISupports): void;
    stepForward(): void;
  }

  interface nsIInputIterator extends nsISupports {
    getElement(): nsISupports;
    stepForward(): void;
    isEqualTo(anotherIterator: nsISupports): boolean;
    clone(): nsISupports;
  }

  interface nsIForwardIterator extends nsISupports {
    getElement(): nsISupports;
    putElement(anElementToPut: nsISupports): void;
    stepForward(): void;
    isEqualTo(anotherIterator: nsISupports): boolean;
    clone(): nsISupports;
  }

  interface nsIBidirectionalIterator extends nsISupports {
    getElement(): nsISupports;
    putElement(anElementToPut: nsISupports): void;
    stepForward(): void;
    stepBackward(): void;
    isEqualTo(anotherIterator: nsISupports): boolean;
    clone(): nsISupports;
  }

  interface nsIRandomAccessIterator extends nsISupports {
    getElement(): nsISupports;
    getElementAt(anOffset: i32): nsISupports;
    putElement(anElementToPut: nsISupports): void;
    putElementAt(anOffset: i32, anElementToPut: nsISupports): void;
    stepForward(): void;
    stepForwardBy(anOffset: i32): void;
    stepBackward(): void;
    stepBackwardBy(anOffset: i32): void;
    isEqualTo(anotherIterator: nsISupports): boolean;
    clone(): nsISupports;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsISupportsPrimitives.idl

  interface nsISupportsPrimitive extends nsISupports {
    readonly TYPE_ID?: 1;
    readonly TYPE_CSTRING?: 2;
    readonly TYPE_STRING?: 3;
    readonly TYPE_PRBOOL?: 4;
    readonly TYPE_PRUINT8?: 5;
    readonly TYPE_PRUINT16?: 6;
    readonly TYPE_PRUINT32?: 7;
    readonly TYPE_PRUINT64?: 8;
    readonly TYPE_PRTIME?: 9;
    readonly TYPE_CHAR?: 10;
    readonly TYPE_PRINT16?: 11;
    readonly TYPE_PRINT32?: 12;
    readonly TYPE_PRINT64?: 13;
    readonly TYPE_FLOAT?: 14;
    readonly TYPE_DOUBLE?: 15;
    readonly TYPE_INTERFACE_POINTER?: 17;

    readonly type: u16;
  }

  interface nsISupportsID extends nsISupportsPrimitive {
    data: nsID;
    toString(): string;
  }

  interface nsISupportsCString extends nsISupportsPrimitive {
    data: string;
    toString(): string;
  }

  interface nsISupportsString extends nsISupportsPrimitive {
    data: string;
    toString(): string;
  }

  interface nsISupportsPRBool extends nsISupportsPrimitive {
    data: boolean;
    toString(): string;
  }

  interface nsISupportsPRUint8 extends nsISupportsPrimitive {
    data: u8;
    toString(): string;
  }

  interface nsISupportsPRUint16 extends nsISupportsPrimitive {
    data: u16;
    toString(): string;
  }

  interface nsISupportsPRUint32 extends nsISupportsPrimitive {
    data: u32;
    toString(): string;
  }

  interface nsISupportsPRUint64 extends nsISupportsPrimitive {
    data: u64;
    toString(): string;
  }

  interface nsISupportsPRTime extends nsISupportsPrimitive {
    data: PRTime;
    toString(): string;
  }

  interface nsISupportsChar extends nsISupportsPrimitive {
    data: string;
    toString(): string;
  }

  interface nsISupportsPRInt16 extends nsISupportsPrimitive {
    data: i16;
    toString(): string;
  }

  interface nsISupportsPRInt32 extends nsISupportsPrimitive {
    data: i32;
    toString(): string;
  }

  interface nsISupportsPRInt64 extends nsISupportsPrimitive {
    data: i64;
    toString(): string;
  }

  interface nsISupportsFloat extends nsISupportsPrimitive {
    data: float;
    toString(): string;
  }

  interface nsISupportsDouble extends nsISupportsPrimitive {
    data: double;
    toString(): string;
  }

  interface nsISupportsInterfacePointer extends nsISupportsPrimitive {
    data: nsISupports;
    dataIID: nsID;
    toString(): string;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIVariant.idl

  interface nsIVariant extends nsISupports {}

  interface nsIWritableVariant extends nsIVariant {
    writable: boolean;
    setAsInt8(aValue: u8): void;
    setAsInt16(aValue: i16): void;
    setAsInt32(aValue: i32): void;
    setAsInt64(aValue: i64): void;
    setAsUint8(aValue: u8): void;
    setAsUint16(aValue: u16): void;
    setAsUint32(aValue: u32): void;
    setAsUint64(aValue: u64): void;
    setAsFloat(aValue: float): void;
    setAsDouble(aValue: double): void;
    setAsBool(aValue: boolean): void;
    setAsChar(aValue: string): void;
    setAsWChar(aValue: string): void;
    setAsID(aValue: nsID): void;
    setAsAString(aValue: string): void;
    setAsACString(aValue: string): void;
    setAsAUTF8String(aValue: string): void;
    setAsString(aValue: string): void;
    setAsWString(aValue: string): void;
    setAsISupports(aValue: nsISupports): void;
    setAsStringWithSize(size: u32, str: string): void;
    setAsWStringWithSize(size: u32, str: string): void;
    setAsVoid(): void;
    setAsEmpty(): void;
    setAsEmptyArray(): void;
    setFromVariant(aValue: nsIVariant): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIWritablePropertyBag.idl

  interface nsIWritablePropertyBag extends nsIPropertyBag {
    setProperty(name: string, value: nsIVariant): void;
    deleteProperty(name: string): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIWritablePropertyBag2.idl

  interface nsIWritablePropertyBag2 extends nsIPropertyBag2 {
    setPropertyAsInt32(prop: string, value: i32): void;
    setPropertyAsUint32(prop: string, value: u32): void;
    setPropertyAsInt64(prop: string, value: i64): void;
    setPropertyAsUint64(prop: string, value: u64): void;
    setPropertyAsDouble(prop: string, value: double): void;
    setPropertyAsAString(prop: string, value: string): void;
    setPropertyAsACString(prop: string, value: string): void;
    setPropertyAsAUTF8String(prop: string, value: string): void;
    setPropertyAsBool(prop: string, value: boolean): void;
    setPropertyAsInterface(prop: string, value: nsISupports): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIAsyncInputStream.idl

  interface nsIAsyncInputStream extends nsIInputStream {
    readonly WAIT_CLOSURE_ONLY?: 1;

    closeWithStatus(aStatus: nsresult): void;
    asyncWait(
      aCallback: nsIInputStreamCallback,
      aFlags: u32,
      aRequestedCount: u32,
      aEventTarget: nsIEventTarget
    ): void;
  }

  type nsIInputStreamCallback = Callable<{
    onInputStreamReady(aStream: nsIAsyncInputStream): void;
  }>;

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIAsyncOutputStream.idl

  interface nsIAsyncOutputStream extends nsIOutputStream {
    readonly WAIT_CLOSURE_ONLY?: 1;

    closeWithStatus(reason: nsresult): void;
    asyncWait(
      aCallback: nsIOutputStreamCallback,
      aFlags: u32,
      aRequestedCount: u32,
      aEventTarget: nsIEventTarget
    ): void;
  }

  type nsIOutputStreamCallback = Callable<{
    onOutputStreamReady(aStream: nsIAsyncOutputStream): void;
  }>;

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIBinaryInputStream.idl

  interface nsIBinaryInputStream extends nsIInputStream {
    setInputStream(aInputStream: nsIInputStream): void;
    readBoolean(): boolean;
    read8(): u8;
    read16(): u16;
    read32(): u32;
    read64(): u64;
    readFloat(): float;
    readDouble(): double;
    readCString(): string;
    readString(): string;
    readBytes(aLength: u32): string;
    readByteArray(aLength: u32): u8[];
    readArrayBuffer(aLength: u64, aArrayBuffer: any): u64;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIBinaryOutputStream.idl

  interface nsIBinaryOutputStream extends nsIOutputStream {
    setOutputStream(aOutputStream: nsIOutputStream): void;
    writeBoolean(aBoolean: boolean): void;
    write8(aByte: u8): void;
    write16(a16: u16): void;
    write32(a32: u32): void;
    write64(a64: u64): void;
    writeFloat(aFloat: float): void;
    writeDouble(aDouble: double): void;
    writeStringZ(aString: string): void;
    writeWStringZ(aString: string): void;
    writeUtf8Z(aString: string): void;
    writeBytes(aString: string, aLength?: u32): void;
    writeByteArray(aBytes: u8[]): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsICloneableInputStream.idl

  interface nsICloneableInputStream extends nsISupports {
    readonly cloneable: boolean;
    clone(): nsIInputStream;
  }

  interface nsICloneableInputStreamWithRange extends nsICloneableInputStream {
    cloneWithRange(start: u64, length: u64): nsIInputStream;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIConverterInputStream.idl

  interface nsIConverterInputStream extends nsIUnicharInputStream {
    readonly DEFAULT_REPLACEMENT_CHARACTER?: 65533;
    readonly ERRORS_ARE_FATAL?: 0;

    init(aStream: nsIInputStream, aCharset: string, aBufferSize: i32, aReplacementChar: u16): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIConverterOutputStream.idl

  interface nsIConverterOutputStream extends nsIUnicharOutputStream {
    init(aOutStream: nsIOutputStream, aCharset: string): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIDirectoryEnumerator.idl

  interface nsIDirectoryEnumerator extends nsISimpleEnumerator {
    readonly nextFile: nsIFile;
    close(): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIDirectoryService.idl

  interface nsIDirectoryServiceProvider extends nsISupports {
    getFile(prop: string, persistent: OutParam<boolean>): nsIFile;
  }

  interface nsIDirectoryServiceProvider2 extends nsIDirectoryServiceProvider {
    getFiles(prop: string): nsISimpleEnumerator;
  }

  interface nsIDirectoryService extends nsISupports {
    init(): void;
    registerProvider(prov: nsIDirectoryServiceProvider): void;
    unregisterProvider(prov: nsIDirectoryServiceProvider): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIFile.idl

  interface nsIFile extends nsISupports {
    readonly NORMAL_FILE_TYPE?: 0;
    readonly DIRECTORY_TYPE?: 1;
    readonly OS_READAHEAD?: 1073741824;
    readonly DELETE_ON_CLOSE?: 2147483648;

    append(node: string): void;
    normalize(): void;
    create(type: u32, permissions: u32, skipAncestors?: boolean): void;
    leafName: string;
    readonly displayName: string;
    hostPath(): Promise<any>;
    copyTo(newParentDir: nsIFile, newName: string): void;
    copyToFollowingLinks(newParentDir: nsIFile, newName: string): void;
    moveTo(newParentDir: nsIFile, newName: string): void;
    moveToFollowingLinks(newParentDir: nsIFile, newName: string): void;
    renameTo(newParentDir: nsIFile, newName: string): void;
    remove(recursive: boolean, removeCount?: InOutParam<u32>): void;
    permissions: u32;
    permissionsOfLink: u32;
    lastAccessedTime: PRTime;
    lastAccessedTimeOfLink: PRTime;
    lastModifiedTime: PRTime;
    lastModifiedTimeOfLink: PRTime;
    readonly creationTime: PRTime;
    readonly creationTimeOfLink: PRTime;
    fileSize: i64;
    readonly fileSizeOfLink: i64;
    readonly target: string;
    readonly path: string;
    exists(): boolean;
    isWritable(): boolean;
    isReadable(): boolean;
    isExecutable(): boolean;
    isHidden(): boolean;
    isDirectory(): boolean;
    isFile(): boolean;
    isSymlink(): boolean;
    isSpecial(): boolean;
    createUnique(type: u32, permissions: u32): void;
    clone(): nsIFile;
    equals(inFile: nsIFile): boolean;
    contains(inFile: nsIFile): boolean;
    readonly parent: nsIFile;
    readonly directoryEntries: nsIDirectoryEnumerator;
    initWithPath(filePath: string): void;
    initWithFile(aFile: nsIFile): void;
    readonly diskSpaceAvailable: i64;
    readonly diskCapacity: i64;
    appendRelativePath(relativeFilePath: string): void;
    persistentDescriptor: string;
    reveal(): void;
    launch(): void;
    getRelativeDescriptor(fromFile: nsIFile): string;
    setRelativeDescriptor(fromFile: nsIFile, relativeDesc: string): void;
    getRelativePath(fromFile: nsIFile): string;
    setRelativePath(fromFile: nsIFile, relativeDesc: string): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIIOUtil.idl

  interface nsIIOUtil extends nsISupports {
    inputStreamIsBuffered(aStream: nsIInputStream): boolean;
    outputStreamIsBuffered(aStream: nsIOutputStream): boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIInputStream.idl

  interface nsIInputStream extends nsISupports {
    close(): void;
    available(): u64;
    streamStatus(): void;
    isNonBlocking(): boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIInputStreamLength.idl

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIInputStreamPriority.idl

  interface nsIInputStreamPriority extends nsISupports {
    priority: u32;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIInputStreamTee.idl

  interface nsIInputStreamTee extends nsIInputStream {
    source: nsIInputStream;
    sink: nsIOutputStream;
    eventTarget: nsIEventTarget;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsILineInputStream.idl

  interface nsILineInputStream extends nsISupports {
    readLine(aLine: OutParam<string>): boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsILocalFileWin.idl

  interface nsILocalFileWin extends nsIFile {
    initWithCommandLine(aCommandLine: string): void;
    getVersionInfoField(aField: string): string;
    readOnly: boolean;
    useDOSDevicePathSyntax: boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIMultiplexInputStream.idl

  interface nsIMultiplexInputStream extends nsISupports {
    readonly count: u32;
    appendStream(stream: nsIInputStream): void;
    getStream(index: u32): nsIInputStream;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIObjectInputStream.idl

  interface nsIObjectInputStream extends nsIBinaryInputStream {
    readObject(aIsStrongRef: boolean): nsISupports;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIObjectOutputStream.idl

  interface nsIObjectOutputStream extends nsIBinaryOutputStream {
    writeObject(aObject: nsISupports, aIsStrongRef: boolean): void;
    writeSingleRefObject(aObject: nsISupports): void;
    writeCompoundObject(aObject: nsISupports, aIID: nsID, aIsStrongRef: boolean): void;
    writeID(aID: nsID): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIOutputStream.idl

  interface nsIOutputStream extends nsISupports {
    close(): void;
    flush(): void;
    streamStatus(): void;
    write(aBuf: string, aCount: u32): u32;
    writeFrom(aFromStream: nsIInputStream, aCount: u32): u32;
    isNonBlocking(): boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIPipe.idl

  interface nsIPipe extends nsISupports {
    init(
      nonBlockingInput: boolean,
      nonBlockingOutput: boolean,
      segmentSize: u32,
      segmentCount: u32
    ): void;
    readonly inputStream: nsIAsyncInputStream;
    readonly outputStream: nsIAsyncOutputStream;
  }

  interface nsISearchableInputStream extends nsISupports {
    search(
      forString: string,
      ignoreCase: boolean,
      found: OutParam<boolean>,
      offsetSearchedTo: OutParam<u32>
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIRandomAccessStream.idl

  interface nsIRandomAccessStream extends nsISeekableStream {
    getInputStream(): nsIInputStream;
    getOutputStream(): nsIOutputStream;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsISafeOutputStream.idl

  interface nsISafeOutputStream extends nsISupports {
    finish(): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIScriptableBase64Encoder.idl

  interface nsIScriptableBase64Encoder extends nsISupports {
    encodeToCString(stream: nsIInputStream, length: u32): string;
    encodeToString(stream: nsIInputStream, length: u32): string;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIScriptableInputStream.idl

  interface nsIScriptableInputStream extends nsISupports {
    close(): void;
    init(aInputStream: nsIInputStream): void;
    available(): u64;
    read(aCount: u32): string;
    readBytes(aCount: u32): string;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsISeekableStream.idl

  interface nsISeekableStream extends nsITellableStream {
    readonly NS_SEEK_SET?: 0;
    readonly NS_SEEK_CUR?: 1;
    readonly NS_SEEK_END?: 2;

    seek(whence: i32, offset: i64): void;
    setEOF(): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIStorageStream.idl

  interface nsIStorageStream extends nsISupports {
    init(segmentSize: u32, maxSize: u32): void;
    getOutputStream(startPosition: i32): nsIOutputStream;
    newInputStream(startPosition: i32): nsIInputStream;
    length: u32;
    readonly writeInProgress: boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIStreamBufferAccess.idl

  interface nsIStreamBufferAccess extends nsISupports {
    disableBuffering(): void;
    enableBuffering(): void;
    readonly unbufferedStream: nsISupports;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIStringStream.idl

  interface nsIStringInputStream extends nsIInputStream {
    setByteStringData(data: string): void;
    setUTF8Data(data: string): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsITellableStream.idl

  interface nsITellableStream extends nsISupports {
    tell(): i64;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIUnicharInputStream.idl

  interface nsIUnicharInputStream extends nsISupports {
    readString(aCount: u32, aString: OutParam<string>): u32;
    close(): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIUnicharLineInputStream.idl

  interface nsIUnicharLineInputStream extends nsISupports {
    readLine(aLine: OutParam<string>): boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsIUnicharOutputStream.idl

  interface nsIUnicharOutputStream extends nsISupports {
    write(aCount: u32, c: u16[]): boolean;
    writeString(str: string): boolean;
    flush(): void;
    close(): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/system/nsIBlocklistService.idl

  interface nsIBlocklistService extends nsISupports {
    readonly STATE_NOT_BLOCKED?: 0;
    readonly STATE_SOFTBLOCKED?: 1;
    readonly STATE_BLOCKED?: 2;
    readonly STATE_MAX?: 3;

    readonly isLoaded: boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/system/nsICrashReporter.idl

  interface nsICrashReporter extends nsISupports {
    readonly crashReporterEnabled: boolean;
    serverURL: nsIURL;
    minidumpPath: nsIFile;
    getMinidumpForID(id: string): nsIFile;
    getExtraFileForID(id: string): nsIFile;
    annotateCrashReport(key: string, data: any): void;
    removeCrashReportAnnotation(key: string): void;
    isAnnotationValid(value: string): boolean;
    isAnnotationAllowedForPing(value: string): boolean;
    isAnnotationAllowedForReport(value: string): boolean;
    appendAppNotesToCrashReport(data: string): void;
    registerAppMemory(ptr: u64, size: u64): void;
    submitReports: boolean;
    UpdateCrashEventsDir(): void;
    saveMemoryReport(): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/system/nsIDeviceSensors.idl

  interface nsIDeviceSensorData extends nsISupports {
    readonly TYPE_ORIENTATION?: 0;
    readonly TYPE_ACCELERATION?: 1;
    readonly TYPE_PROXIMITY?: 2;
    readonly TYPE_LINEAR_ACCELERATION?: 3;
    readonly TYPE_GYROSCOPE?: 4;
    readonly TYPE_LIGHT?: 5;
    readonly TYPE_ROTATION_VECTOR?: 6;
    readonly TYPE_GAME_ROTATION_VECTOR?: 7;

    readonly type: u32;
    readonly x: double;
    readonly y: double;
    readonly z: double;
  }

  interface nsIDeviceSensors extends nsISupports {
    hasWindowListener(aType: u32, aWindow: nsIDOMWindow): boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/system/nsIGIOService.idl

  interface nsIGIOHandlerApp extends nsIHandlerApp {
    readonly id: string;
    launchFile(fileName: string): void;
    getMozIconURL(): string;
  }

  interface nsIGIOMimeApp extends nsIHandlerApp {
    readonly EXPECTS_URIS?: 0;
    readonly EXPECTS_PATHS?: 1;
    readonly EXPECTS_URIS_FOR_NON_FILES?: 2;

    readonly id: string;
    readonly command: string;
    readonly expectsURIs: i32;
    readonly supportedURISchemes: nsIUTF8StringEnumerator;
    setAsDefaultForMimeType(mimeType: string): void;
    setAsDefaultForFileExtensions(extensions: string): void;
    setAsDefaultForURIScheme(uriScheme: string): void;
  }

  interface nsIGIOService extends nsISupports {
    getMimeTypeFromExtension(extension: string): string;
    getAppForURIScheme(aURIScheme: string): nsIHandlerApp;
    getAppsForURIScheme(aURIScheme: string): nsIMutableArray;
    getAppForMimeType(mimeType: string): nsIHandlerApp;
    createHandlerAppFromAppId(appId: string): nsIGIOHandlerApp;
    createAppFromCommand(cmd: string, appName: string): nsIGIOMimeApp;
    findAppFromCommand(cmd: string): nsIGIOMimeApp;
    getDescriptionForMimeType(mimeType: string): string;
    readonly isRunningUnderFlatpak: boolean;
    readonly isRunningUnderSnap: boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/system/nsIGSettingsService.idl

  interface nsIGSettingsCollection extends nsISupports {
    setString(key: string, value: string): void;
    setBoolean(key: string, value: boolean): void;
    setInt(key: string, value: i32): void;
    getString(key: string): string;
    getBoolean(key: string): boolean;
    getInt(key: string): i32;
    getStringList(key: string): nsIArray;
  }

  interface nsIGSettingsService extends nsISupports {
    getCollectionForSchema(schema: string): nsIGSettingsCollection;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/system/nsIGeolocationProvider.idl

  interface nsIGeolocationUpdate extends nsISupports {
    update(position: nsIDOMGeoPosition): void;
    notifyError(error: u16): void;
  }

  interface nsIGeolocationProvider extends nsISupports {
    startup(): void;
    watch(callback: nsIGeolocationUpdate): void;
    shutdown(): void;
    setHighAccuracy(enable: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/system/nsIHapticFeedback.idl

  interface nsIHapticFeedback extends nsISupports {
    readonly ShortPress?: 0;
    readonly LongPress?: 1;

    performSimpleAction(isLongPress: i32): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/system/nsIPlatformInfo.idl

  interface nsIPlatformInfo extends nsISupports {
    readonly platformVersion: string;
    readonly platformBuildID: string;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/system/nsISystemInfo.idl

  interface nsISystemInfo extends nsISupports {
    readonly diskInfo: Promise<any>;
    readonly countryCode: Promise<any>;
    readonly osInfo: Promise<any>;
    readonly processInfo: Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/system/nsIXULAppInfo.idl

  interface nsIXULAppInfo extends nsIPlatformInfo {
    readonly vendor: string;
    readonly name: string;
    readonly ID: string;
    readonly version: string;
    readonly appBuildID: string;
    readonly UAName: string;
    readonly sourceURL: string;
    readonly updateURL: string;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/system/nsIXULRuntime.idl
} // global

declare enum nsIXULRuntime_ExperimentStatus {
  eExperimentStatusUnenrolled = 0,
  eExperimentStatusControl = 1,
  eExperimentStatusTreatment = 2,
  eExperimentStatusDisqualified = 3,
  eExperimentStatusRollout = 4,
  eExperimentStatusCount = 5,
}

declare enum nsIXULRuntime_ContentWin32kLockdownState {
  LockdownEnabled = 1,
  MissingWebRender = 2,
  OperatingSystemNotSupported = 3,
  PrefNotSet = 4,
  MissingRemoteWebGL = 5,
  MissingNonNativeTheming = 6,
  DisabledByEnvVar = 7,
  DisabledBySafeMode = 8,
  DisabledByE10S = 9,
  DisabledByUserPref = 10,
  EnabledByUserPref = 11,
  DisabledByControlGroup = 12,
  EnabledByTreatmentGroup = 13,
  DisabledByDefault = 14,
  EnabledByDefault = 15,
  DecodersArentRemote = 16,
  IncompatibleMitigationPolicy = 17,
}

declare enum nsIXULRuntime_FissionDecisionStatus {
  eFissionStatusUnknown = 0,
  eFissionDisabledByE10sEnv = 3,
  eFissionEnabledByEnv = 4,
  eFissionDisabledByEnv = 5,
  eFissionEnabledByDefault = 7,
  eFissionDisabledByDefault = 8,
  eFissionEnabledByUserPref = 9,
  eFissionDisabledByUserPref = 10,
  eFissionDisabledByE10sOther = 11,
}

declare global {
  namespace nsIXULRuntime {
    type ExperimentStatus = nsIXULRuntime_ExperimentStatus;
    type ContentWin32kLockdownState = nsIXULRuntime_ContentWin32kLockdownState;
    type FissionDecisionStatus = nsIXULRuntime_FissionDecisionStatus;
  }

  interface nsIXULRuntime
    extends nsISupports,
      Enums<
        typeof nsIXULRuntime_ExperimentStatus &
          typeof nsIXULRuntime_ContentWin32kLockdownState &
          typeof nsIXULRuntime_FissionDecisionStatus
      > {
    readonly PROCESS_TYPE_DEFAULT?: 0;
    readonly PROCESS_TYPE_CONTENT?: 2;
    readonly PROCESS_TYPE_IPDLUNITTEST?: 3;
    readonly PROCESS_TYPE_GMPLUGIN?: 4;
    readonly PROCESS_TYPE_GPU?: 5;
    readonly PROCESS_TYPE_VR?: 6;
    readonly PROCESS_TYPE_RDD?: 7;
    readonly PROCESS_TYPE_SOCKET?: 8;
    readonly PROCESS_TYPE_FORKSERVER?: 10;
    readonly PROCESS_TYPE_UTILITY?: 11;
    readonly E10S_MULTI_EXPERIMENT?: 1;

    readonly inSafeMode: boolean;
    readonly win32kExperimentStatus: nsIXULRuntime.ExperimentStatus;
    readonly win32kLiveStatusTestingOnly: nsIXULRuntime.ContentWin32kLockdownState;
    readonly win32kSessionStatus: nsIXULRuntime.ContentWin32kLockdownState;
    readonly fissionAutostart: boolean;
    readonly fissionDecisionStatus: nsIXULRuntime.FissionDecisionStatus;
    readonly fissionDecisionStatusString: string;
    readonly sessionHistoryInParent: boolean;
    readonly sessionStorePlatformCollection: boolean;
    logConsoleErrors: boolean;
    readonly OS: string;
    readonly XPCOMABI: string;
    readonly widgetToolkit: string;
    readonly processType: u32;
    readonly processID: u32;
    readonly uniqueProcessID: u64;
    readonly remoteType: string;
    readonly browserTabsRemoteAutostart: boolean;
    readonly maxWebProcessCount: u32;
    readonly accessibilityEnabled: boolean;
    readonly accessibilityInstantiator: string;
    readonly is64Bit: boolean;
    readonly isTextRecognitionSupported: boolean;
    invalidateCachesOnRestart(): void;
    readonly replacedLockTime: PRTime;
    readonly defaultUpdateChannel: string;
    readonly distributionID: string;
    readonly windowsDLLBlocklistStatus: boolean;
    readonly restartedByOS: boolean;
    readonly chromeColorSchemeIsDark: boolean;
    readonly contentThemeDerivedColorSchemeIsDark: boolean;
    readonly prefersReducedMotion: boolean;
    readonly drawInTitlebar: boolean;
    readonly caretBlinkCount: i32;
    readonly caretBlinkTime: i32;
    readonly desktopEnvironment: string;
    readonly isWayland: boolean;
    readonly processStartupShortcut: string;
    readonly launcherProcessState: u32;
    readonly lastAppVersion: string;
    readonly lastAppBuildID: string;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsIDirectTaskDispatcher.idl

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsIEnvironment.idl

  interface nsIEnvironment extends nsISupports {
    set(aName: string, aValue: string): void;
    get(aName: string): string;
    exists(aName: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsIEventTarget.idl

  interface nsIEventTarget extends nsISupports {
    readonly DISPATCH_NORMAL?: 0;
    readonly DISPATCH_AT_END?: 2;
    readonly DISPATCH_EVENT_MAY_BLOCK?: 4;
    readonly DISPATCH_IGNORE_BLOCK_DISPATCH?: 8;

    isOnCurrentThread(): boolean;
    dispatch(event: nsIRunnable, flags: u32): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsIIdlePeriod.idl

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsINamed.idl

  interface nsINamed extends nsISupports {
    readonly name: string;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsIProcess.idl

  interface nsIProcess extends nsISupports {
    init(executable: nsIFile): void;
    kill(): void;
    run(blocking: boolean, args: string[], count: u32): void;
    runAsync(args: string[], count: u32, observer?: nsIObserver, holdWeak?: boolean): void;
    runw(blocking: boolean, args: string[], count: u32): void;
    runwAsync(args: string[], count: u32, observer?: nsIObserver, holdWeak?: boolean): void;
    startHidden: boolean;
    noShell: boolean;
    readonly pid: u32;
    readonly exitValue: i32;
    readonly isRunning: boolean;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsIRunnable.idl

  type nsIRunnable = Callable<{
    run(): void;
  }>;

  interface nsIRunnablePriority extends nsISupports {
    readonly PRIORITY_IDLE?: 0;
    readonly PRIORITY_DEFERRED_TIMERS?: 1;
    readonly PRIORITY_LOW?: 2;
    readonly PRIORITY_NORMAL?: 4;
    readonly PRIORITY_MEDIUMHIGH?: 5;
    readonly PRIORITY_INPUT_HIGH?: 6;
    readonly PRIORITY_VSYNC?: 7;
    readonly PRIORITY_RENDER_BLOCKING?: 9;
    readonly PRIORITY_CONTROL?: 10;

    readonly priority: u32;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsISerialEventTarget.idl

  interface nsISerialEventTarget extends nsIEventTarget {}

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsISupportsPriority.idl

  interface nsISupportsPriority extends nsISupports {
    readonly PRIORITY_HIGHEST?: -20;
    readonly PRIORITY_HIGH?: -10;
    readonly PRIORITY_NORMAL?: 0;
    readonly PRIORITY_LOW?: 10;
    readonly PRIORITY_LOWEST?: 20;

    priority: i32;
    adjustPriority(delta: i32): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsIThread.idl
} // global

declare enum nsIThread_QoSPriority {
  QOS_PRIORITY_NORMAL = 0,
  QOS_PRIORITY_LOW = 1,
}

declare global {
  namespace nsIThread {
    type QoSPriority = nsIThread_QoSPriority;
  }

  interface nsIThread extends nsISerialEventTarget, Enums<typeof nsIThread_QoSPriority> {
    shutdown(): void;
    hasPendingEvents(): boolean;
    hasPendingHighPriorityEvents(): boolean;
    processNextEvent(mayWait: boolean): boolean;
    asyncShutdown(): void;
    beginShutdown(): nsIThreadShutdown;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsIThreadInternal.idl

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsIThreadManager.idl

  type nsINestedEventLoopCondition = Callable<{
    isDone(): boolean;
  }>;

  interface nsIThreadManager extends nsISupports {
    readonly mainThread: nsIThread;
    readonly currentThread: nsIThread;
    dispatchToMainThread(event: nsIRunnable, priority?: u32): void;
    dispatchToMainThreadWithMicroTask(event: nsIRunnable, priority?: u32): void;
    idleDispatchToMainThread(event: nsIRunnable, timeout?: u32): void;
    dispatchDirectTaskToCurrentThread(event: nsIRunnable): void;
    spinEventLoopUntil(
      aVeryGoodReasonToDoThis: string,
      condition: nsINestedEventLoopCondition
    ): void;
    spinEventLoopUntilOrQuit(
      aVeryGoodReasonToDoThis: string,
      condition: nsINestedEventLoopCondition
    ): void;
    spinEventLoopUntilEmpty(): void;
    readonly mainThreadEventTarget: nsIEventTarget;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsIThreadPool.idl

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsIThreadShutdown.idl

  interface nsIThreadShutdown extends nsISupports {
    onCompletion(aEvent: nsIRunnable): void;
    readonly completed: boolean;
    stopWaitingAndLeakThread(): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/threads/nsITimer.idl

  type nsITimerCallback = Callable<{
    notify(timer: nsITimer): void;
  }>;

  interface nsITimer extends nsISupports {
    readonly TYPE_ONE_SHOT?: 0;
    readonly TYPE_REPEATING_SLACK?: 1;
    readonly TYPE_REPEATING_PRECISE?: 2;
    readonly TYPE_REPEATING_PRECISE_CAN_SKIP?: 3;
    readonly TYPE_REPEATING_SLACK_LOW_PRIORITY?: 4;
    readonly TYPE_ONE_SHOT_LOW_PRIORITY?: 5;

    init(aObserver: nsIObserver, aDelayInMs: u32, aType: u32): void;
    initWithCallback(aCallback: nsITimerCallback, aDelayInMs: u32, aType: u32): void;
    cancel(): void;
    delay: u32;
    type: u32;
    readonly callback: nsITimerCallback;
    target: nsIEventTarget;
    readonly name: string;
  }

  interface nsITimerManager extends nsISupports {
    getTimers(): nsITimer[];
  }

  // https://searchfox.org/mozilla-central/source/xpcom/tests/NotXPCOMTest.idl

  interface nsIScriptableOK extends nsISupports {
    method1(): void;
  }

  interface nsIScriptableWithNotXPCOM extends nsISupports {}

  // https://searchfox.org/mozilla-central/source/js/xpconnect/idl/mozIJSSubScriptLoader.idl

  interface mozIJSSubScriptLoader extends nsISupports {
    loadSubScript(url: string, obj?: any): any;
    loadSubScriptWithOptions(url: string, options: any): any;
  }

  // https://searchfox.org/mozilla-central/source/js/xpconnect/idl/nsIXPCScriptable.idl

  // https://searchfox.org/mozilla-central/source/js/xpconnect/idl/xpcIJSWeakReference.idl

  interface xpcIJSWeakReference extends nsISupports {
    get(): any;
  }

  // https://searchfox.org/mozilla-central/source/js/xpconnect/idl/xpccomponents.idl

  interface nsIXPCComponents_Classes extends nsISupports {}

  interface nsIXPCComponents_Results extends nsISupports {}

  interface nsIXPCComponents_ID extends nsISupports {}

  interface nsIXPCComponents_Exception extends nsISupports {}

  interface nsIXPCComponents_Constructor extends nsISupports {}

  interface nsIXPCComponents_utils_Sandbox extends nsISupports {}

  type nsIScheduledGCCallback = Callable<{
    callback(): void;
  }>;

  interface nsIXPCComponents_Utils extends nsISupports {
    printStderr(message: string): void;
    reportError(error: any, stack?: any): void;
    readonly Sandbox: nsIXPCComponents_utils_Sandbox;
    evalInSandbox(
      source: string,
      sandbox: any,
      version?: any,
      filename?: string,
      lineNo?: i32,
      enforceFilenameRestrictions?: boolean
    ): any;
    getUAWidgetScope(principal: nsIPrincipal): any;
    getSandboxMetadata(sandbox: any): any;
    setSandboxMetadata(sandbox: any, metadata: any): void;
    isESModuleLoaded(aResourceURI: string): boolean;
    importGlobalProperties(aPropertyList: any): void;
    getWeakReference(obj: any): xpcIJSWeakReference;
    forceGC(): void;
    forceCC(aListener?: nsICycleCollectorListener): void;
    createCCLogger(): nsICycleCollectorListener;
    finishCC(): void;
    ccSlice(budget: i64): void;
    getMaxCCSliceTimeSinceClear(): i32;
    clearMaxCCTime(): void;
    forceShrinkingGC(): void;
    schedulePreciseGC(callback: nsIScheduledGCCallback): void;
    schedulePreciseShrinkingGC(callback: nsIScheduledGCCallback): void;
    unlinkGhostWindows(): void;
    intentionallyLeak(): void;
    getJSTestingFunctions(): any;
    getFunctionSourceLocation(func: any): any;
    callFunctionWithAsyncStack(func: any, stack: nsIStackFrame, asyncCause: string): any;
    getGlobalForObject(obj: any): any;
    isProxy(vobject: any): boolean;
    exportFunction(vfunction: any, vscope: any, voptions?: any): any;
    createObjectIn(vobj: any, voptions?: any): any;
    makeObjectPropsNormal(vobj: any): void;
    isDeadWrapper(obj: any): boolean;
    isRemoteProxy(val: any): boolean;
    recomputeWrappers(vobj?: any): void;
    setWantXrays(vscope: any): void;
    dispatch(runnable: any, scope?: any): void;
    readonly isInAutomation: boolean;
    exitIfInAutomation(): void;
    crashIfNotInAutomation(): void;
    setGCZeal(zeal: i32): void;
    nukeSandbox(obj: any): void;
    blockScriptForGlobal(global: any): void;
    unblockScriptForGlobal(global: any): void;
    isOpaqueWrapper(obj: any): boolean;
    isXrayWrapper(obj: any): boolean;
    waiveXrays(aVal: any): any;
    unwaiveXrays(aVal: any): any;
    getClassName(aObj: any, aUnwrap: boolean): string;
    getIncumbentGlobal(callback?: any): any;
    getDebugName(obj: any): string;
    getWatchdogTimestamp(aCategory: string): PRTime;
    getJSEngineTelemetryValue(): any;
    cloneInto(value: any, scope: any, options?: any): any;
    getWebIDLCallerPrincipal(): nsIPrincipal;
    getObjectPrincipal(obj: any): nsIPrincipal;
    getRealmLocation(obj: any): string;
    now(): double;
    readUTF8File(file: nsIFile): string;
    readUTF8URI(url: nsIURI): string;
    createSpellChecker(): nsIEditorSpellCheck;
    createCommandLine(args: string[], workingDir: nsIFile, state: u32): nsISupports;
    createCommandParams(): nsICommandParams;
    createLoadContext(): nsILoadContext;
    createPrivateLoadContext(): nsILoadContext;
    createPersistentProperties(): nsIPersistentProperties;
    createDocumentEncoder(contentType: string): nsIDocumentEncoder;
    createHTMLCopyEncoder(): nsIDocumentEncoder;
    readonly loadedESModules: string[];
    getModuleImportStack(aLocation: string): string;
  }

  interface nsIXPCComponents extends nsISupports {
    readonly interfaces: nsIXPCComponents_Interfaces;
    readonly results: nsIXPCComponents_Results;
    isSuccessCode(result: nsresult): boolean;
    readonly classes: nsIXPCComponents_Classes;
    readonly stack: nsIStackFrame;
    readonly manager: nsIComponentManager;
    readonly utils: nsIXPCComponents_Utils;
    readonly ID: nsIXPCComponents_ID;
    readonly Exception: nsIXPCComponents_Exception;
    readonly Constructor: nsIXPCComponents_Constructor;
    returnCode: any;
  }

  // https://searchfox.org/mozilla-central/source/js/xpconnect/tests/idl/xpctest_attributes.idl

  interface nsIXPCTestObjectReadOnly extends nsISupports {
    readonly strReadOnly: string;
    readonly boolReadOnly: boolean;
    readonly shortReadOnly: i16;
    readonly longReadOnly: i32;
    readonly floatReadOnly: float;
    readonly charReadOnly: string;
    readonly timeReadOnly: PRTime;
  }

  interface nsIXPCTestObjectReadWrite extends nsISupports {
    stringProperty: string;
    booleanProperty: boolean;
    shortProperty: i16;
    longProperty: i32;
    floatProperty: float;
    charProperty: string;
    timeProperty: PRTime;
  }

  // https://searchfox.org/mozilla-central/source/js/xpconnect/tests/idl/xpctest_bug809674.idl

  interface nsIXPCTestBug809674 extends nsISupports {
    addArgs(x: u32, y: u32): u32;
    addSubMulArgs(x: u32, y: u32, subOut: OutParam<u32>, mulOut: OutParam<u32>): u32;
    addVals(x: any, y: any): any;
    methodNoArgs(): u32;
    methodNoArgsNoRetVal(): void;
    addMany(x1: u32, x2: u32, x3: u32, x4: u32, x5: u32, x6: u32, x7: u32, x8: u32): u32;
    valProperty: any;
    uintProperty: u32;
    methodWithOptionalArgc(): void;
  }

  // https://searchfox.org/mozilla-central/source/js/xpconnect/tests/idl/xpctest_cenums.idl
} // global

declare enum nsIXPCTestCEnums_testFlagsExplicit {
  shouldBe1Explicit = 1,
  shouldBe2Explicit = 2,
  shouldBe4Explicit = 4,
  shouldBe8Explicit = 8,
  shouldBe12Explicit = 12,
}

declare enum nsIXPCTestCEnums_testFlagsImplicit {
  shouldBe0Implicit = 0,
  shouldBe1Implicit = 1,
  shouldBe2Implicit = 2,
  shouldBe3Implicit = 3,
  shouldBe5Implicit = 5,
  shouldBe6Implicit = 6,
  shouldBe2AgainImplicit = 2,
  shouldBe3AgainImplicit = 3,
}

declare global {
  namespace nsIXPCTestCEnums {
    type testFlagsExplicit = nsIXPCTestCEnums_testFlagsExplicit;
    type testFlagsImplicit = nsIXPCTestCEnums_testFlagsImplicit;
  }

  interface nsIXPCTestCEnums
    extends nsISupports,
      Enums<typeof nsIXPCTestCEnums_testFlagsExplicit & typeof nsIXPCTestCEnums_testFlagsImplicit> {
    readonly testConst?: 1;

    testCEnumInput(abc: nsIXPCTestCEnums.testFlagsExplicit): void;
    testCEnumOutput(): nsIXPCTestCEnums.testFlagsExplicit;
  }

  // https://searchfox.org/mozilla-central/source/js/xpconnect/tests/idl/xpctest_interfaces.idl

  interface nsIXPCTestInterfaceA extends nsISupports {
    name: string;
  }

  interface nsIXPCTestInterfaceB extends nsISupports {
    name: string;
  }

  interface nsIXPCTestInterfaceC extends nsISupports {
    someInteger: i32;
  }

  // https://searchfox.org/mozilla-central/source/js/xpconnect/tests/idl/xpctest_params.idl

  interface nsIXPCTestParams extends nsISupports {
    testBoolean(a: boolean, b: InOutParam<boolean>): boolean;
    testOctet(a: u8, b: InOutParam<u8>): u8;
    testShort(a: i16, b: InOutParam<i16>): i16;
    testLong(a: i32, b: InOutParam<i32>): i32;
    testLongLong(a: i64, b: InOutParam<i64>): i64;
    testUnsignedShort(a: u16, b: InOutParam<u16>): u16;
    testUnsignedLong(a: u32, b: InOutParam<u32>): u32;
    testUnsignedLongLong(a: u64, b: InOutParam<u64>): u64;
    testFloat(a: float, b: InOutParam<float>): float;
    testDouble(a: double, b: InOutParam<float>): double;
    testChar(a: string, b: InOutParam<string>): string;
    testString(a: string, b: InOutParam<string>): string;
    testWchar(a: string, b: InOutParam<string>): string;
    testWstring(a: string, b: InOutParam<string>): string;
    testAString(a: string, b: InOutParam<string>): string;
    testAUTF8String(a: string, b: InOutParam<string>): string;
    testACString(a: string, b: InOutParam<string>): string;
    testJsval(a: any, b: InOutParam<any>): any;
    testShortSequence(a: i16[], b: InOutParam<i16[]>): i16[];
    testDoubleSequence(a: double[], b: InOutParam<double[]>): double[];
    testInterfaceSequence(
      a: nsIXPCTestInterfaceA[],
      b: InOutParam<nsIXPCTestInterfaceA[]>
    ): nsIXPCTestInterfaceA[];
    testAStringSequence(a: string[], b: InOutParam<string[]>): string[];
    testACStringSequence(a: string[], b: InOutParam<string[]>): string[];
    testJsvalSequence(a: any[], b: InOutParam<any[]>): any[];
    testSequenceSequence(a: i16[][], b: InOutParam<i16[][]>): i16[][];
    testOptionalSequence(arr?: u8[]): u8[];
    testShortArray(
      aLength: u32,
      a: i16[],
      bLength: InOutParam<u32>,
      b: InOutParam<i16[]>,
      rvLength: OutParam<u32>
    ): i16[];
    testDoubleArray(
      aLength: u32,
      a: double[],
      bLength: InOutParam<u32>,
      b: InOutParam<double[]>,
      rvLength: OutParam<u32>
    ): double[];
    testStringArray(
      aLength: u32,
      a: string[],
      bLength: InOutParam<u32>,
      b: InOutParam<string[]>,
      rvLength: OutParam<u32>
    ): string[];
    testWstringArray(
      aLength: u32,
      a: string[],
      bLength: InOutParam<u32>,
      b: InOutParam<string[]>,
      rvLength: OutParam<u32>
    ): string[];
    testInterfaceArray(
      aLength: u32,
      a: nsIXPCTestInterfaceA[],
      bLength: InOutParam<u32>,
      b: InOutParam<nsIXPCTestInterfaceA[]>,
      rvLength: OutParam<u32>
    ): nsIXPCTestInterfaceA[];
    testByteArrayOptionalLength(a: u8[], aLength?: u32): u32;
    testSizedString(
      aLength: u32,
      a: string,
      bLength: InOutParam<u32>,
      b: InOutParam<string>,
      rvLength: OutParam<u32>
    ): string;
    testSizedWstring(
      aLength: u32,
      a: string,
      bLength: InOutParam<u32>,
      b: InOutParam<string>,
      rvLength: OutParam<u32>
    ): string;
    testJsvalArray(
      aLength: u32,
      a: any[],
      bLength: InOutParam<u32>,
      b: InOutParam<any[]>,
      rvLength: OutParam<u32>
    ): any[];
    testOutAString(o: OutParam<string>): void;
    testStringArrayOptionalSize(a: string[], aLength?: u32): string;
    testOmittedOptionalOut(aJSObj: nsIXPCTestParams, aOut?: OutParam<nsIURI>): void;
    readonly testNaN: double;
  }

  // https://searchfox.org/mozilla-central/source/js/xpconnect/tests/idl/xpctest_returncode.idl

  interface nsIXPCTestReturnCodeParent extends nsISupports {
    callChild(childBehavior: i32): nsresult;
  }

  interface nsIXPCTestReturnCodeChild extends nsISupports {
    readonly CHILD_SHOULD_THROW?: 0;
    readonly CHILD_SHOULD_RETURN_SUCCESS?: 1;
    readonly CHILD_SHOULD_RETURN_RESULTCODE?: 2;
    readonly CHILD_SHOULD_NEST_RESULTCODES?: 3;

    doIt(behavior: i32): void;
  }

  // https://searchfox.org/mozilla-central/source/js/xpconnect/tests/idl/xpctest_utils.idl

  type nsIXPCTestFunctionInterface = Callable<{
    echo(arg: string): string;
  }>;

  interface nsIXPCTestUtils extends nsISupports {
    doubleWrapFunction(f: nsIXPCTestFunctionInterface): nsIXPCTestFunctionInterface;
  }

  interface nsIXPCTestTypeScript extends nsISupports {
    exposedProp: i32;
    exposedMethod(arg: i32): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/xul/nsIBrowserController.idl

  interface nsIBrowserController extends nsISupports {
    enableDisableCommands(
      action: string,
      enabledCommands: string[],
      disabledCommands: string[]
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/dom/xul/nsIController.idl

  interface nsIController extends nsISupports {
    isCommandEnabled(command: string): boolean;
    supportsCommand(command: string): boolean;
    doCommand(command: string): void;
    onEvent(eventName: string): void;
  }

  interface nsICommandController extends nsISupports {
    getCommandStateWithParams(command: string, aCommandParams: nsICommandParams): void;
    doCommandWithParams(command: string, aCommandParams: nsICommandParams): void;
    getSupportedCommands(): string[];
  }

  // https://searchfox.org/mozilla-central/source/dom/xul/nsIControllers.idl

  interface nsIControllers extends nsISupports {
    getControllerForCommand(command: string): nsIController;
    insertControllerAt(index: u32, controller: nsIController): void;
    removeControllerAt(index: u32): nsIController;
    getControllerAt(index: u32): nsIController;
    appendController(controller: nsIController): void;
    removeController(controller: nsIController): void;
    getControllerId(controller: nsIController): u32;
    getControllerById(controllerID: u32): nsIController;
    getControllerCount(): u32;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/xre/nsINativeAppSupport.idl

  interface nsINativeAppSupport extends nsISupports {
    start(): boolean;
    enable(): void;
    onLastWindowClosing(): void;
    ReOpen(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/xre/nsIXREDirProvider.idl

  interface nsIXREDirProvider extends nsISupports {
    setUserDataDirectory(aFile: nsIFile, aLocal: boolean): void;
    getInstallHash(): string;
  }

  // https://searchfox.org/mozilla-central/source/modules/libjar/zipwriter/nsIZipWriter.idl

  interface nsIZipWriter extends nsISupports {
    readonly COMPRESSION_NONE?: 0;
    readonly COMPRESSION_FASTEST?: 1;
    readonly COMPRESSION_DEFAULT?: 6;
    readonly COMPRESSION_BEST?: 9;

    comment: string;
    readonly inQueue: boolean;
    readonly file: nsIFile;
    open(aFile: nsIFile, aIoFlags: i32): void;
    getEntry(aZipEntry: string): nsIZipEntry;
    hasEntry(aZipEntry: string): boolean;
    addEntryDirectory(aZipEntry: string, aModTime: PRTime, aQueue: boolean): void;
    addEntryFile(aZipEntry: string, aCompression: i32, aFile: nsIFile, aQueue: boolean): void;
    addEntryChannel(
      aZipEntry: string,
      aModTime: PRTime,
      aCompression: i32,
      aChannel: nsIChannel,
      aQueue: boolean
    ): void;
    addEntryStream(
      aZipEntry: string,
      aModTime: PRTime,
      aCompression: i32,
      aStream: nsIInputStream,
      aQueue: boolean
    ): void;
    removeEntry(aZipEntry: string, aQueue: boolean): void;
    processQueue(aObserver: nsIRequestObserver, aContext: nsISupports): void;
    close(): void;
    alignStoredFiles(aAlignSize: u16): void;
  }

  interface nsIXPCComponents_Interfaces {
    nsIBits: nsJSIID<nsIBits>;
    nsIBitsNewRequestCallback: nsJSIID<nsIBitsNewRequestCallback>;
    nsIBitsRequest: nsJSIID<nsIBitsRequest>;
    nsIBitsCallback: nsJSIID<nsIBitsCallback>;
    nsIAccessibilityService: nsJSIID<nsIAccessibilityService>;
    nsIAccessible: nsJSIID<nsIAccessible>;
    nsIAccessibleAnnouncementEvent: nsJSIID<nsIAccessibleAnnouncementEvent>;
    nsIAccessibleApplication: nsJSIID<nsIAccessibleApplication>;
    nsIAccessibleCaretMoveEvent: nsJSIID<nsIAccessibleCaretMoveEvent>;
    nsIAccessibleDocument: nsJSIID<nsIAccessibleDocument>;
    nsIAccessibleEditableText: nsJSIID<nsIAccessibleEditableText>;
    nsIAccessibleEvent: nsJSIID<nsIAccessibleEvent>;
    nsIAccessibleHideEvent: nsJSIID<nsIAccessibleHideEvent>;
    nsIAccessibleHyperLink: nsJSIID<nsIAccessibleHyperLink>;
    nsIAccessibleHyperText: nsJSIID<nsIAccessibleHyperText>;
    nsIAccessibleImage: nsJSIID<nsIAccessibleImage>;
    nsIAccessibleObjectAttributeChangedEvent: nsJSIID<nsIAccessibleObjectAttributeChangedEvent>;
    nsIAccessiblePivot: nsJSIID<nsIAccessiblePivot>;
    nsIAccessibleTraversalRule: nsJSIID<nsIAccessibleTraversalRule>;
    nsIAccessibleRelation: nsJSIID<nsIAccessibleRelation>;
    nsIAccessibleRole: nsJSIID<nsIAccessibleRole>;
    nsIAccessibleScrollingEvent: nsJSIID<nsIAccessibleScrollingEvent>;
    nsIAccessibleSelectable: nsJSIID<nsIAccessibleSelectable>;
    nsIAccessibleStateChangeEvent: nsJSIID<nsIAccessibleStateChangeEvent>;
    nsIAccessibleStates: nsJSIID<nsIAccessibleStates>;
    nsIAccessibleTable: nsJSIID<nsIAccessibleTable>;
    nsIAccessibleTableCell: nsJSIID<nsIAccessibleTableCell>;
    nsIAccessibleTableChangeEvent: nsJSIID<nsIAccessibleTableChangeEvent>;
    nsIAccessibleText: nsJSIID<nsIAccessibleText>;
    nsIAccessibleTextChangeEvent: nsJSIID<nsIAccessibleTextChangeEvent>;
    nsIAccessibleTextLeafPoint: nsJSIID<nsIAccessibleTextLeafPoint>;
    nsIAccessibleTextRange: nsJSIID<nsIAccessibleTextRange>;
    nsIAccessibleTextSelectionChangeEvent: nsJSIID<nsIAccessibleTextSelectionChangeEvent>;
    nsIAccessibleScrollType: nsJSIID<nsIAccessibleScrollType>;
    nsIAccessibleCoordinateType: nsJSIID<nsIAccessibleCoordinateType>;
    nsIAccessibleValue: nsJSIID<nsIAccessibleValue>;
    nsIAlertNotificationImageListener: nsJSIID<nsIAlertNotificationImageListener>;
    nsIAlertAction: nsJSIID<nsIAlertAction>;
    nsIAlertNotification: nsJSIID<nsIAlertNotification>;
    nsIAlertsService: nsJSIID<nsIAlertsService>;
    nsIAlertsDoNotDisturb: nsJSIID<nsIAlertsDoNotDisturb>;
    nsIAppShellService: nsJSIID<nsIAppShellService>;
    nsIAppWindow: nsJSIID<nsIAppWindow>;
    nsIWindowMediator: nsJSIID<nsIWindowMediator>;
    nsIWindowMediatorListener: nsJSIID<nsIWindowMediatorListener>;
    nsIWindowlessBrowser: nsJSIID<nsIWindowlessBrowser>;
    nsIXULBrowserWindow: nsJSIID<nsIXULBrowserWindow>;
    nsIAppStartup: nsJSIID<nsIAppStartup, typeof nsIAppStartup_IDLShutdownPhase>;
    nsIAutoCompleteController: nsJSIID<nsIAutoCompleteController>;
    nsIAutoCompleteInput: nsJSIID<nsIAutoCompleteInput>;
    nsIAutoCompletePopup: nsJSIID<nsIAutoCompletePopup>;
    nsIAutoCompleteResult: nsJSIID<nsIAutoCompleteResult>;
    nsIAutoCompleteSearch: nsJSIID<nsIAutoCompleteSearch>;
    nsIAutoCompleteObserver: nsJSIID<nsIAutoCompleteObserver>;
    nsIAutoCompleteSimpleResult: nsJSIID<nsIAutoCompleteSimpleResult>;
    nsIAutoCompleteSimpleResultListener: nsJSIID<nsIAutoCompleteSimpleResultListener>;
    nsIAutoCompleteSimpleSearch: nsJSIID<nsIAutoCompleteSimpleSearch>;
    nsIAutoplay: nsJSIID<nsIAutoplay>;
    nsIHangDetails: nsJSIID<nsIHangDetails>;
    nsIBrowserHandler: nsJSIID<nsIBrowserHandler>;
    nsIAddonPolicyService: nsJSIID<nsIAddonPolicyService>;
    nsIAddonContentPolicy: nsJSIID<nsIAddonContentPolicy>;
    nsIDomainPolicy: nsJSIID<nsIDomainPolicy>;
    nsIDomainSet: nsJSIID<nsIDomainSet>;
    nsIPrincipal: nsJSIID<nsIPrincipal>;
    nsIScriptSecurityManager: nsJSIID<nsIScriptSecurityManager>;
    nsICaptivePortalCallback: nsJSIID<nsICaptivePortalCallback>;
    nsICaptivePortalDetector: nsJSIID<nsICaptivePortalDetector>;
    nsICascadeFilter: nsJSIID<nsICascadeFilter>;
    nsIChromeRegistry: nsJSIID<nsIChromeRegistry>;
    nsIXULChromeRegistry: nsJSIID<nsIXULChromeRegistry>;
    nsIToolkitChromeRegistry: nsJSIID<nsIToolkitChromeRegistry>;
    nsICommandManager: nsJSIID<nsICommandManager>;
    nsICommandParams: nsJSIID<nsICommandParams>;
    nsIControllerCommand: nsJSIID<nsIControllerCommand>;
    nsIControllerCommandTable: nsJSIID<nsIControllerCommandTable>;
    nsIControllerContext: nsJSIID<nsIControllerContext>;
    nsICommandLine: nsJSIID<nsICommandLine>;
    nsICommandLineHandler: nsJSIID<nsICommandLineHandler>;
    nsICommandLineValidator: nsJSIID<nsICommandLineValidator>;
    nsIEditingSession: nsJSIID<nsIEditingSession>;
    nsIEventListenerChange: nsJSIID<nsIEventListenerChange>;
    nsIListenerChangeListener: nsJSIID<nsIListenerChangeListener>;
    nsIEventListenerInfo: nsJSIID<nsIEventListenerInfo>;
    nsIEventListenerService: nsJSIID<nsIEventListenerService>;
    mozIGeckoMediaPluginChromeService: nsJSIID<mozIGeckoMediaPluginChromeService>;
    mozIGeckoMediaPluginService: nsJSIID<mozIGeckoMediaPluginService>;
    nsIDocShell: nsJSIID<
      nsIDocShell,
      typeof nsIDocShell_DocShellEnumeratorDirection &
        typeof nsIDocShell_AppType &
        typeof nsIDocShell_BusyFlags &
        typeof nsIDocShell_LoadCommand
    >;
    nsIDocShellTreeItem: nsJSIID<nsIDocShellTreeItem>;
    nsIDocShellTreeOwner: nsJSIID<nsIDocShellTreeOwner>;
    nsIDocumentLoaderFactory: nsJSIID<nsIDocumentLoaderFactory>;
    nsIDocumentViewer: nsJSIID<
      nsIDocumentViewer,
      typeof nsIDocumentViewer_PermitUnloadAction & typeof nsIDocumentViewer_PermitUnloadResult
    >;
    nsIDocumentViewerEdit: nsJSIID<nsIDocumentViewerEdit>;
    nsILoadContext: nsJSIID<nsILoadContext>;
    nsILoadURIDelegate: nsJSIID<nsILoadURIDelegate>;
    nsIPrivacyTransitionObserver: nsJSIID<nsIPrivacyTransitionObserver>;
    nsIReflowObserver: nsJSIID<nsIReflowObserver>;
    nsIRefreshURI: nsJSIID<nsIRefreshURI>;
    nsITooltipListener: nsJSIID<nsITooltipListener>;
    nsITooltipTextProvider: nsJSIID<nsITooltipTextProvider>;
    nsIURIFixupInfo: nsJSIID<nsIURIFixupInfo>;
    nsIURIFixup: nsJSIID<nsIURIFixup>;
    nsIWebNavigation: nsJSIID<nsIWebNavigation>;
    nsIWebNavigationInfo: nsJSIID<nsIWebNavigationInfo>;
    nsIWebPageDescriptor: nsJSIID<nsIWebPageDescriptor>;
    mozIDOMWindow: nsJSIID<mozIDOMWindow>;
    mozIDOMWindowProxy: nsJSIID<mozIDOMWindowProxy>;
    nsIContentPolicy: nsJSIID<nsIContentPolicy, typeof nsIContentPolicy_nsContentPolicyType>;
    nsIDroppedLinkItem: nsJSIID<nsIDroppedLinkItem>;
    nsIDroppedLinkHandler: nsJSIID<nsIDroppedLinkHandler>;
    nsIEventSourceEventListener: nsJSIID<nsIEventSourceEventListener>;
    nsIEventSourceEventService: nsJSIID<nsIEventSourceEventService>;
    nsIImageLoadingContent: nsJSIID<nsIImageLoadingContent>;
    nsIMessageSender: nsJSIID<nsIMessageSender>;
    nsIObjectLoadingContent: nsJSIID<nsIObjectLoadingContent>;
    nsIScriptableContentIterator: nsJSIID<
      nsIScriptableContentIterator,
      typeof nsIScriptableContentIterator_IteratorType
    >;
    nsISelectionController: nsJSIID<
      nsISelectionController,
      typeof nsISelectionController_ControllerScrollFlags
    >;
    nsISelectionDisplay: nsJSIID<nsISelectionDisplay>;
    nsISelectionListener: nsJSIID<nsISelectionListener>;
    nsISlowScriptDebugCallback: nsJSIID<nsISlowScriptDebugCallback>;
    nsISlowScriptDebuggerStartupCallback: nsJSIID<nsISlowScriptDebuggerStartupCallback>;
    nsISlowScriptDebugRemoteCallback: nsJSIID<nsISlowScriptDebugRemoteCallback>;
    nsISlowScriptDebug: nsJSIID<nsISlowScriptDebug>;
    nsIConsoleAPIStorage: nsJSIID<nsIConsoleAPIStorage>;
    mozIRemoteLazyInputStream: nsJSIID<mozIRemoteLazyInputStream>;
    nsIDOMProcessChild: nsJSIID<nsIDOMProcessChild>;
    nsIDOMProcessParent: nsJSIID<nsIDOMProcessParent>;
    nsIContentParentKeepAlive: nsJSIID<nsIContentParentKeepAlive>;
    nsIHangReport: nsJSIID<nsIHangReport>;
    nsILoginDetectionService: nsJSIID<nsILoginDetectionService>;
    nsISuspendedTypes: nsJSIID<nsISuspendedTypes>;
    nsIBrowser: nsJSIID<nsIBrowser>;
    nsIBrowserChild: nsJSIID<nsIBrowserChild>;
    nsIOpenURIInFrameParams: nsJSIID<nsIOpenURIInFrameParams>;
    nsIBrowserDOMWindow: nsJSIID<nsIBrowserDOMWindow>;
    nsIBrowserUsage: nsJSIID<nsIBrowserUsage>;
    nsIContentPermissionType: nsJSIID<nsIContentPermissionType>;
    nsIContentPermissionRequest: nsJSIID<nsIContentPermissionRequest>;
    nsIContentPermissionPrompt: nsJSIID<nsIContentPermissionPrompt>;
    nsIContentPrefObserver: nsJSIID<nsIContentPrefObserver>;
    nsIContentPrefService2: nsJSIID<nsIContentPrefService2>;
    nsIContentPrefCallback2: nsJSIID<nsIContentPrefCallback2>;
    nsIContentPref: nsJSIID<nsIContentPref>;
    nsIDOMGlobalPropertyInitializer: nsJSIID<nsIDOMGlobalPropertyInitializer>;
    nsIDOMWindow: nsJSIID<nsIDOMWindow>;
    nsIDOMWindowUtils: nsJSIID<nsIDOMWindowUtils>;
    nsITranslationNodeList: nsJSIID<nsITranslationNodeList>;
    nsIJSRAIIHelper: nsJSIID<nsIJSRAIIHelper>;
    nsIFocusManager: nsJSIID<nsIFocusManager>;
    nsIGeckoViewServiceWorker: nsJSIID<nsIGeckoViewServiceWorker>;
    nsIPermissionDelegateHandler: nsJSIID<nsIPermissionDelegateHandler>;
    nsIQueryContentEventResult: nsJSIID<nsIQueryContentEventResult>;
    nsIRemoteTab: nsJSIID<nsIRemoteTab, typeof nsIRemoteTab_NavigationType>;
    nsIServiceWorkerUnregisterCallback: nsJSIID<nsIServiceWorkerUnregisterCallback>;
    nsIServiceWorkerInfo: nsJSIID<nsIServiceWorkerInfo>;
    nsIServiceWorkerRegistrationInfoListener: nsJSIID<nsIServiceWorkerRegistrationInfoListener>;
    nsIServiceWorkerRegistrationInfo: nsJSIID<nsIServiceWorkerRegistrationInfo>;
    nsIServiceWorkerManagerListener: nsJSIID<nsIServiceWorkerManagerListener>;
    nsIServiceWorkerManager: nsJSIID<nsIServiceWorkerManager>;
    nsIStructuredCloneContainer: nsJSIID<nsIStructuredCloneContainer>;
    nsITextInputProcessor: nsJSIID<nsITextInputProcessor>;
    nsITextInputProcessorNotification: nsJSIID<nsITextInputProcessorNotification>;
    nsITextInputProcessorCallback: nsJSIID<nsITextInputProcessorCallback>;
    nsIScriptErrorNote: nsJSIID<nsIScriptErrorNote>;
    nsIScriptError: nsJSIID<nsIScriptError>;
    nsIDOMGeoPosition: nsJSIID<nsIDOMGeoPosition>;
    nsIDOMGeoPositionCallback: nsJSIID<nsIDOMGeoPositionCallback>;
    nsIDOMGeoPositionCoords: nsJSIID<nsIDOMGeoPositionCoords>;
    nsIDOMGeoPositionErrorCallback: nsJSIID<nsIDOMGeoPositionErrorCallback>;
    nsICredentialChooserService: nsJSIID<nsICredentialChooserService>;
    nsICredentialChosenCallback: nsJSIID<nsICredentialChosenCallback>;
    nsIIdentityCredentialPromptService: nsJSIID<nsIIdentityCredentialPromptService>;
    nsIIdentityCredentialStorageService: nsJSIID<nsIIdentityCredentialStorageService>;
    nsIIDBPermissionsRequest: nsJSIID<nsIIDBPermissionsRequest>;
    nsIIndexedDatabaseManager: nsJSIID<nsIIndexedDatabaseManager>;
    nsILocalStorageManager: nsJSIID<nsILocalStorageManager>;
    nsIAudioDeviceInfo: nsJSIID<nsIAudioDeviceInfo>;
    nsIMediaDevice: nsJSIID<nsIMediaDevice>;
    nsIMediaManagerService: nsJSIID<nsIMediaManagerService>;
    nsITCPSocketCallback: nsJSIID<nsITCPSocketCallback>;
    nsIUDPSocketInternal: nsJSIID<nsIUDPSocketInternal>;
    nsINotificationActionStorageEntry: nsJSIID<nsINotificationActionStorageEntry>;
    nsINotificationStorageEntry: nsJSIID<nsINotificationStorageEntry>;
    nsINotificationStorageCallback: nsJSIID<nsINotificationStorageCallback>;
    nsINotificationStorage: nsJSIID<nsINotificationStorage>;
    nsIPaymentResponseData: nsJSIID<nsIPaymentResponseData>;
    nsIGeneralResponseData: nsJSIID<nsIGeneralResponseData>;
    nsIBasicCardResponseData: nsJSIID<nsIBasicCardResponseData>;
    nsIPaymentActionResponse: nsJSIID<nsIPaymentActionResponse>;
    nsIPaymentCanMakeActionResponse: nsJSIID<nsIPaymentCanMakeActionResponse>;
    nsIPaymentShowActionResponse: nsJSIID<nsIPaymentShowActionResponse>;
    nsIPaymentAbortActionResponse: nsJSIID<nsIPaymentAbortActionResponse>;
    nsIPaymentCompleteActionResponse: nsJSIID<nsIPaymentCompleteActionResponse>;
    nsIMethodChangeDetails: nsJSIID<nsIMethodChangeDetails>;
    nsIGeneralChangeDetails: nsJSIID<nsIGeneralChangeDetails>;
    nsIBasicCardChangeDetails: nsJSIID<nsIBasicCardChangeDetails>;
    nsIPaymentAddress: nsJSIID<nsIPaymentAddress>;
    nsIPaymentMethodData: nsJSIID<nsIPaymentMethodData>;
    nsIPaymentCurrencyAmount: nsJSIID<nsIPaymentCurrencyAmount>;
    nsIPaymentItem: nsJSIID<nsIPaymentItem>;
    nsIPaymentDetailsModifier: nsJSIID<nsIPaymentDetailsModifier>;
    nsIPaymentShippingOption: nsJSIID<nsIPaymentShippingOption>;
    nsIPaymentDetails: nsJSIID<nsIPaymentDetails>;
    nsIPaymentOptions: nsJSIID<nsIPaymentOptions>;
    nsIPaymentRequest: nsJSIID<nsIPaymentRequest>;
    nsIPaymentRequestService: nsJSIID<nsIPaymentRequestService>;
    nsIPaymentUIService: nsJSIID<nsIPaymentUIService>;
    nsIDOMMozWakeLockListener: nsJSIID<nsIDOMMozWakeLockListener>;
    nsIPowerManagerService: nsJSIID<nsIPowerManagerService>;
    nsIWakeLock: nsJSIID<nsIWakeLock>;
    nsIPushErrorReporter: nsJSIID<nsIPushErrorReporter>;
    nsIPushNotifier: nsJSIID<nsIPushNotifier>;
    nsIPushData: nsJSIID<nsIPushData>;
    nsIPushMessage: nsJSIID<nsIPushMessage>;
    nsIPushSubscription: nsJSIID<nsIPushSubscription>;
    nsIPushSubscriptionCallback: nsJSIID<nsIPushSubscriptionCallback>;
    nsIUnsubscribeResultCallback: nsJSIID<nsIUnsubscribeResultCallback>;
    nsIPushClearResultCallback: nsJSIID<nsIPushClearResultCallback>;
    nsIPushService: nsJSIID<nsIPushService>;
    nsIPushQuotaManager: nsJSIID<nsIPushQuotaManager>;
    nsIQuotaArtificialFailure: nsJSIID<
      nsIQuotaArtificialFailure,
      typeof nsIQuotaArtificialFailure_Category
    >;
    nsIQuotaUsageCallback: nsJSIID<nsIQuotaUsageCallback>;
    nsIQuotaCallback: nsJSIID<nsIQuotaCallback>;
    nsIQuotaManagerService: nsJSIID<nsIQuotaManagerService>;
    nsIQuotaManagerServiceInternal: nsJSIID<nsIQuotaManagerServiceInternal>;
    nsIQuotaRequestBase: nsJSIID<nsIQuotaRequestBase>;
    nsIQuotaUsageRequest: nsJSIID<nsIQuotaUsageRequest>;
    nsIQuotaRequest: nsJSIID<nsIQuotaRequest>;
    nsIQuotaFullOriginMetadataResult: nsJSIID<nsIQuotaFullOriginMetadataResult>;
    nsIQuotaUsageResult: nsJSIID<nsIQuotaUsageResult>;
    nsIQuotaOriginUsageResult: nsJSIID<nsIQuotaOriginUsageResult>;
    nsIQuotaEstimateResult: nsJSIID<nsIQuotaEstimateResult>;
    nsIQuotaUtilsService: nsJSIID<nsIQuotaUtilsService>;
    nsIContentSecurityManager: nsJSIID<nsIContentSecurityManager>;
    nsIContentSecurityPolicy: nsJSIID<
      nsIContentSecurityPolicy,
      typeof nsIContentSecurityPolicy_CSPDirective &
        typeof nsIContentSecurityPolicy_RequireTrustedTypesForDirectiveState
    >;
    nsICSPEventListener: nsJSIID<nsICSPEventListener>;
    nsIReferrerInfo: nsJSIID<nsIReferrerInfo, typeof nsIReferrerInfo_ReferrerPolicyIDL>;
    nsIHttpsOnlyModePermission: nsJSIID<nsIHttpsOnlyModePermission>;
    nsIDocumentEncoderNodeFixup: nsJSIID<nsIDocumentEncoderNodeFixup>;
    nsIDocumentEncoder: nsJSIID<nsIDocumentEncoder>;
    nsIWebProtocolHandlerRegistrar: nsJSIID<nsIWebProtocolHandlerRegistrar>;
    nsISDBCallback: nsJSIID<nsISDBCallback>;
    nsISDBCloseCallback: nsJSIID<nsISDBCloseCallback>;
    nsISDBConnection: nsJSIID<nsISDBConnection>;
    nsISDBRequest: nsJSIID<nsISDBRequest>;
    nsISDBResult: nsJSIID<nsISDBResult>;
    nsIDOMStorageManager: nsJSIID<nsIDOMStorageManager>;
    nsIStorageActivityService: nsJSIID<nsIStorageActivityService>;
    nsISessionStorageService: nsJSIID<nsISessionStorageService>;
    nsIOSPermissionRequest: nsJSIID<nsIOSPermissionRequest>;
    nsICredentialParameters: nsJSIID<nsICredentialParameters>;
    nsIWebAuthnAutoFillEntry: nsJSIID<nsIWebAuthnAutoFillEntry>;
    nsIWebAuthnService: nsJSIID<nsIWebAuthnService>;
    nsISpeechTaskCallback: nsJSIID<nsISpeechTaskCallback>;
    nsISpeechTask: nsJSIID<nsISpeechTask>;
    nsISpeechService: nsJSIID<nsISpeechService>;
    nsISynthVoiceRegistry: nsJSIID<nsISynthVoiceRegistry>;
    nsIWorkerChannelLoadInfo: nsJSIID<nsIWorkerChannelLoadInfo>;
    nsIWorkerChannelInfo: nsJSIID<nsIWorkerChannelInfo>;
    nsIWorkerDebuggerListener: nsJSIID<nsIWorkerDebuggerListener>;
    nsIWorkerDebugger: nsJSIID<nsIWorkerDebugger>;
    nsIWorkerDebuggerManagerListener: nsJSIID<nsIWorkerDebuggerManagerListener>;
    nsIWorkerDebuggerManager: nsJSIID<nsIWorkerDebuggerManager>;
    txIEXSLTFunctions: nsJSIID<txIEXSLTFunctions>;
    nsIDOMXULButtonElement: nsJSIID<nsIDOMXULButtonElement>;
    nsIDOMXULCommandDispatcher: nsJSIID<nsIDOMXULCommandDispatcher>;
    nsIDOMXULContainerItemElement: nsJSIID<nsIDOMXULContainerItemElement>;
    nsIDOMXULContainerElement: nsJSIID<nsIDOMXULContainerElement>;
    nsIDOMXULControlElement: nsJSIID<nsIDOMXULControlElement>;
    nsIDOMXULMenuListElement: nsJSIID<nsIDOMXULMenuListElement>;
    nsIDOMXULMultiSelectControlElement: nsJSIID<nsIDOMXULMultiSelectControlElement>;
    nsIDOMXULRadioGroupElement: nsJSIID<nsIDOMXULRadioGroupElement>;
    nsIDOMXULRelatedElement: nsJSIID<nsIDOMXULRelatedElement>;
    nsIDOMXULSelectControlElement: nsJSIID<nsIDOMXULSelectControlElement>;
    nsIDOMXULSelectControlItemElement: nsJSIID<nsIDOMXULSelectControlItemElement>;
    mozIDownloadPlatform: nsJSIID<mozIDownloadPlatform>;
    nsIDocumentStateListener: nsJSIID<nsIDocumentStateListener>;
    nsIEditActionListener: nsJSIID<nsIEditActionListener>;
    nsIEditor: nsJSIID<nsIEditor>;
    nsIEditorMailSupport: nsJSIID<nsIEditorMailSupport>;
    nsIEditorSpellCheck: nsJSIID<nsIEditorSpellCheck>;
    nsIEditorSpellCheckCallback: nsJSIID<nsIEditorSpellCheckCallback>;
    nsIHTMLAbsPosEditor: nsJSIID<nsIHTMLAbsPosEditor>;
    nsIHTMLEditor: nsJSIID<nsIHTMLEditor>;
    nsIHTMLInlineTableEditor: nsJSIID<nsIHTMLInlineTableEditor>;
    nsIHTMLObjectResizer: nsJSIID<nsIHTMLObjectResizer>;
    nsITableEditor: nsJSIID<nsITableEditor>;
    nsIEnterprisePolicies: nsJSIID<nsIEnterprisePolicies>;
    amIAddonManagerStartup: nsJSIID<amIAddonManagerStartup>;
    amIWebInstallPrompt: nsJSIID<amIWebInstallPrompt>;
    nsIContentDispatchChooser: nsJSIID<nsIContentDispatchChooser>;
    nsIExternalHelperAppService: nsJSIID<nsIExternalHelperAppService>;
    nsPIExternalAppLauncher: nsJSIID<nsPIExternalAppLauncher>;
    nsIHelperAppLauncher: nsJSIID<nsIHelperAppLauncher>;
    nsIExternalProtocolService: nsJSIID<nsIExternalProtocolService>;
    nsIHandlerService: nsJSIID<nsIHandlerService>;
    nsIHelperAppLauncherDialog: nsJSIID<nsIHelperAppLauncherDialog>;
    nsISharingHandlerApp: nsJSIID<nsISharingHandlerApp>;
    nsITypeAheadFind: nsJSIID<nsITypeAheadFind>;
    nsIFOG: nsJSIID<nsIFOG>;
    nsIGleanPingTestCallback: nsJSIID<nsIGleanPingTestCallback>;
    nsIGleanPing: nsJSIID<nsIGleanPing>;
    nsIFontEnumerator: nsJSIID<nsIFontEnumerator>;
    nsIParserUtils: nsJSIID<nsIParserUtils>;
    nsIExpatSink: nsJSIID<nsIExpatSink>;
    nsISFVBareItem: nsJSIID<nsISFVBareItem>;
    nsISFVInteger: nsJSIID<nsISFVInteger>;
    nsISFVString: nsJSIID<nsISFVString>;
    nsISFVBool: nsJSIID<nsISFVBool>;
    nsISFVDecimal: nsJSIID<nsISFVDecimal>;
    nsISFVToken: nsJSIID<nsISFVToken>;
    nsISFVByteSeq: nsJSIID<nsISFVByteSeq>;
    nsISFVParams: nsJSIID<nsISFVParams>;
    nsISFVParametrizable: nsJSIID<nsISFVParametrizable>;
    nsISFVItemOrInnerList: nsJSIID<nsISFVItemOrInnerList>;
    nsISFVSerialize: nsJSIID<nsISFVSerialize>;
    nsISFVItem: nsJSIID<nsISFVItem>;
    nsISFVInnerList: nsJSIID<nsISFVInnerList>;
    nsISFVList: nsJSIID<nsISFVList>;
    nsISFVDictionary: nsJSIID<nsISFVDictionary>;
    nsISFVService: nsJSIID<nsISFVService>;
    imgICache: nsJSIID<imgICache>;
    imgIContainer: nsJSIID<imgIContainer, typeof imgIContainer_DecodeResult>;
    imgIContainerDebug: nsJSIID<imgIContainerDebug>;
    imgIEncoder: nsJSIID<imgIEncoder>;
    imgILoader: nsJSIID<imgILoader>;
    imgINotificationObserver: nsJSIID<imgINotificationObserver>;
    imgIRequest: nsJSIID<imgIRequest>;
    imgIScriptedNotificationObserver: nsJSIID<imgIScriptedNotificationObserver>;
    imgITools: nsJSIID<imgITools>;
    imgIContainerCallback: nsJSIID<imgIContainerCallback>;
    nsIMozIconURI: nsJSIID<nsIMozIconURI>;
    inIDeepTreeWalker: nsJSIID<inIDeepTreeWalker>;
    nsIStringBundle: nsJSIID<nsIStringBundle>;
    nsIStringBundleService: nsJSIID<nsIStringBundleService>;
    nsIJARChannel: nsJSIID<nsIJARChannel>;
    nsIJARURI: nsJSIID<nsIJARURI>;
    nsIZipEntry: nsJSIID<nsIZipEntry>;
    nsIZipReader: nsJSIID<nsIZipReader>;
    nsIZipReaderCache: nsJSIID<nsIZipReaderCache>;
    IJSDebugger: nsJSIID<IJSDebugger>;
    nsIJSInspector: nsJSIID<nsIJSInspector>;
    nsIKeyValueService: nsJSIID<nsIKeyValueService, typeof nsIKeyValueService_RecoveryStrategy>;
    nsIKeyValueImportSourceSpec: nsJSIID<nsIKeyValueImportSourceSpec>;
    nsIKeyValueImporter: nsJSIID<
      nsIKeyValueImporter,
      typeof nsIKeyValueImporter_ConflictPolicy & typeof nsIKeyValueImporter_CleanupPolicy
    >;
    nsIKeyValueDatabaseImportOptions: nsJSIID<nsIKeyValueDatabaseImportOptions>;
    nsIKeyValueDatabase: nsJSIID<nsIKeyValueDatabase>;
    nsIKeyValuePair: nsJSIID<nsIKeyValuePair>;
    nsIKeyValueEnumerator: nsJSIID<nsIKeyValueEnumerator>;
    nsIKeyValueDatabaseCallback: nsJSIID<nsIKeyValueDatabaseCallback>;
    nsIKeyValueEnumeratorCallback: nsJSIID<nsIKeyValueEnumeratorCallback>;
    nsIKeyValuePairCallback: nsJSIID<nsIKeyValuePairCallback>;
    nsIKeyValueVariantCallback: nsJSIID<nsIKeyValueVariantCallback>;
    nsIKeyValueVoidCallback: nsJSIID<nsIKeyValueVoidCallback>;
    nsILayoutHistoryState: nsJSIID<nsILayoutHistoryState>;
    nsIPreloadedStyleSheet: nsJSIID<nsIPreloadedStyleSheet>;
    nsISVGPaintContext: nsJSIID<nsISVGPaintContext>;
    nsIStyleSheetService: nsJSIID<nsIStyleSheetService>;
    nsITreeSelection: nsJSIID<nsITreeSelection>;
    nsITreeView: nsJSIID<nsITreeView>;
    mozILocaleService: nsJSIID<mozILocaleService>;
    mozIOSPreferences: nsJSIID<mozIOSPreferences>;
    nsILoginInfo: nsJSIID<nsILoginInfo>;
    nsILoginSearchCallback: nsJSIID<nsILoginSearchCallback>;
    nsILoginManager: nsJSIID<nsILoginManager>;
    nsILoginManagerAuthPrompter: nsJSIID<nsILoginManagerAuthPrompter>;
    nsILoginManagerCrypto: nsJSIID<nsILoginManagerCrypto>;
    nsILoginManagerPrompter: nsJSIID<nsILoginManagerPrompter>;
    nsILoginMetaInfo: nsJSIID<nsILoginMetaInfo>;
    nsIPromptInstance: nsJSIID<nsIPromptInstance>;
    nsIEdgeMigrationUtils: nsJSIID<nsIEdgeMigrationUtils>;
    nsIMIMEHeaderParam: nsJSIID<nsIMIMEHeaderParam>;
    nsIHandlerInfo: nsJSIID<nsIHandlerInfo>;
    nsIMIMEInfo: nsJSIID<nsIMIMEInfo>;
    nsIHandlerApp: nsJSIID<nsIHandlerApp>;
    nsILocalHandlerApp: nsJSIID<nsILocalHandlerApp>;
    nsIWebHandlerApp: nsJSIID<nsIWebHandlerApp>;
    nsIDBusHandlerApp: nsJSIID<nsIDBusHandlerApp>;
    nsIMIMEService: nsJSIID<nsIMIMEService>;
    nsIMLUtils: nsJSIID<nsIMLUtils>;
    nsIFind: nsJSIID<nsIFind>;
    nsIFindService: nsJSIID<nsIFindService>;
    nsIWebBrowserFind: nsJSIID<nsIWebBrowserFind>;
    nsIWebBrowserFindInFrames: nsJSIID<nsIWebBrowserFindInFrames>;
    mozIMozIntl: nsJSIID<mozIMozIntl>;
    mozIMozIntlHelper: nsJSIID<mozIMozIntlHelper>;
    mozIThirdPartyUtil: nsJSIID<mozIThirdPartyUtil>;
    nsIAndroidContentInputStream: nsJSIID<nsIAndroidContentInputStream>;
    nsIArrayBufferInputStream: nsJSIID<nsIArrayBufferInputStream>;
    nsIAsyncStreamCopier: nsJSIID<nsIAsyncStreamCopier>;
    nsIAsyncStreamCopier2: nsJSIID<nsIAsyncStreamCopier2>;
    nsIAsyncVerifyRedirectCallback: nsJSIID<nsIAsyncVerifyRedirectCallback>;
    nsIAuthInformation: nsJSIID<nsIAuthInformation>;
    nsIAuthPrompt: nsJSIID<nsIAuthPrompt>;
    nsIAuthPrompt2: nsJSIID<nsIAuthPrompt2>;
    nsIAuthPromptAdapterFactory: nsJSIID<nsIAuthPromptAdapterFactory>;
    nsIAuthPromptCallback: nsJSIID<nsIAuthPromptCallback>;
    nsIAuthPromptProvider: nsJSIID<nsIAuthPromptProvider>;
    nsIBackgroundFileSaver: nsJSIID<nsIBackgroundFileSaver>;
    nsIBackgroundFileSaverObserver: nsJSIID<nsIBackgroundFileSaverObserver>;
    nsIBufferedInputStream: nsJSIID<nsIBufferedInputStream>;
    nsIBufferedOutputStream: nsJSIID<nsIBufferedOutputStream>;
    nsIByteRangeRequest: nsJSIID<nsIByteRangeRequest>;
    nsIInputStreamReceiver: nsJSIID<nsIInputStreamReceiver>;
    nsICacheInfoChannel: nsJSIID<
      nsICacheInfoChannel,
      typeof nsICacheInfoChannel_PreferredAlternativeDataDeliveryType
    >;
    nsICachingChannel: nsJSIID<nsICachingChannel>;
    nsICancelable: nsJSIID<nsICancelable>;
    nsICaptivePortalServiceCallback: nsJSIID<nsICaptivePortalServiceCallback>;
    nsICaptivePortalService: nsJSIID<nsICaptivePortalService>;
    nsIChannel: nsJSIID<nsIChannel>;
    nsIIdentChannel: nsJSIID<nsIIdentChannel>;
    nsIChannelEventSink: nsJSIID<nsIChannelEventSink>;
    nsIChildChannel: nsJSIID<nsIChildChannel>;
    nsIClassOfService: nsJSIID<nsIClassOfService, typeof nsIClassOfService_FetchPriority>;
    nsIClassifiedChannel: nsJSIID<
      nsIClassifiedChannel,
      typeof nsIClassifiedChannel_ClassificationFlags
    >;
    nsIContentSniffer: nsJSIID<nsIContentSniffer>;
    nsIDHCPClient: nsJSIID<nsIDHCPClient>;
    nsINetDashboardCallback: nsJSIID<nsINetDashboardCallback>;
    nsIDashboard: nsJSIID<nsIDashboard>;
    nsIDownloader: nsJSIID<nsIDownloader>;
    nsIDownloadObserver: nsJSIID<nsIDownloadObserver>;
    nsIEncodedChannel: nsJSIID<nsIEncodedChannel>;
    nsIExternalProtocolHandler: nsJSIID<nsIExternalProtocolHandler>;
    nsIFileInputStream: nsJSIID<nsIFileInputStream>;
    nsIFileOutputStream: nsJSIID<nsIFileOutputStream>;
    nsIFileRandomAccessStream: nsJSIID<nsIFileRandomAccessStream>;
    nsIFileMetadata: nsJSIID<nsIFileMetadata>;
    nsIAsyncFileMetadata: nsJSIID<nsIAsyncFileMetadata>;
    nsIFileMetadataCallback: nsJSIID<nsIFileMetadataCallback>;
    nsIFileURL: nsJSIID<nsIFileURL>;
    nsIFileURLMutator: nsJSIID<nsIFileURLMutator>;
    nsIFormPOSTActionChannel: nsJSIID<nsIFormPOSTActionChannel>;
    nsIHttpPushListener: nsJSIID<nsIHttpPushListener>;
    nsIIOService: nsJSIID<nsIIOService>;
    nsIIncrementalDownload: nsJSIID<nsIIncrementalDownload>;
    nsIIncrementalStreamLoaderObserver: nsJSIID<nsIIncrementalStreamLoaderObserver>;
    nsIIncrementalStreamLoader: nsJSIID<nsIIncrementalStreamLoader>;
    nsIInputStreamChannel: nsJSIID<nsIInputStreamChannel>;
    nsIInputStreamPump: nsJSIID<nsIInputStreamPump>;
    nsIInterceptionInfo: nsJSIID<nsIInterceptionInfo>;
    nsILoadContextInfo: nsJSIID<nsILoadContextInfo>;
    nsILoadContextInfoFactory: nsJSIID<nsILoadContextInfoFactory>;
    nsILoadGroup: nsJSIID<nsILoadGroup>;
    nsILoadGroupChild: nsJSIID<nsILoadGroupChild>;
    nsILoadInfo: nsJSIID<
      nsILoadInfo,
      typeof nsILoadInfo_StoragePermissionState &
        typeof nsILoadInfo_CrossOriginOpenerPolicy &
        typeof nsILoadInfo_CrossOriginEmbedderPolicy &
        typeof nsILoadInfo_SchemelessInputType &
        typeof nsILoadInfo_HTTPSUpgradeTelemetryType
    >;
    nsIMIMEInputStream: nsJSIID<nsIMIMEInputStream>;
    nsIMockNetworkLayerController: nsJSIID<nsIMockNetworkLayerController>;
    nsIMultiPartChannel: nsJSIID<nsIMultiPartChannel>;
    nsIMultiPartChannelListener: nsJSIID<nsIMultiPartChannelListener>;
    nsINestedURI: nsJSIID<nsINestedURI>;
    nsINestedURIMutator: nsJSIID<nsINestedURIMutator>;
    nsINestedAboutURIMutator: nsJSIID<nsINestedAboutURIMutator>;
    nsIJSURIMutator: nsJSIID<nsIJSURIMutator>;
    nsINetAddr: nsJSIID<nsINetAddr>;
    nsINetUtil: nsJSIID<nsINetUtil>;
    nsINetworkConnectivityService: nsJSIID<
      nsINetworkConnectivityService,
      typeof nsINetworkConnectivityService_ConnectivityState
    >;
    nsIListNetworkAddressesListener: nsJSIID<nsIListNetworkAddressesListener>;
    nsIGetHostnameListener: nsJSIID<nsIGetHostnameListener>;
    nsINetworkInfoService: nsJSIID<nsINetworkInfoService>;
    nsIInterceptedBodyCallback: nsJSIID<nsIInterceptedBodyCallback>;
    nsIInterceptedChannel: nsJSIID<nsIInterceptedChannel>;
    nsINetworkInterceptController: nsJSIID<nsINetworkInterceptController>;
    nsINetworkLinkService: nsJSIID<nsINetworkLinkService>;
    nsINetworkPredictor: nsJSIID<nsINetworkPredictor>;
    nsINetworkPredictorVerifier: nsJSIID<nsINetworkPredictorVerifier>;
    nsINullChannel: nsJSIID<nsINullChannel>;
    nsIParentChannel: nsJSIID<nsIParentChannel>;
    nsIPermission: nsJSIID<nsIPermission>;
    nsIPermissionManager: nsJSIID<nsIPermissionManager>;
    nsIPrivateBrowsingChannel: nsJSIID<nsIPrivateBrowsingChannel>;
    nsIProgressEventSink: nsJSIID<nsIProgressEventSink>;
    nsIPrompt: nsJSIID<nsIPrompt>;
    nsIProtocolHandlerWithDynamicFlags: nsJSIID<nsIProtocolHandlerWithDynamicFlags>;
    nsIProtocolHandler: nsJSIID<nsIProtocolHandler>;
    nsIProtocolProxyCallback: nsJSIID<nsIProtocolProxyCallback>;
    nsIProxyProtocolFilterResult: nsJSIID<nsIProxyProtocolFilterResult>;
    nsIProtocolProxyFilter: nsJSIID<nsIProtocolProxyFilter>;
    nsIProtocolProxyChannelFilter: nsJSIID<nsIProtocolProxyChannelFilter>;
    nsIProxyConfigChangedCallback: nsJSIID<nsIProxyConfigChangedCallback>;
    nsIProtocolProxyService: nsJSIID<nsIProtocolProxyService>;
    nsIProtocolProxyService2: nsJSIID<nsIProtocolProxyService2>;
    nsIProxiedChannel: nsJSIID<nsIProxiedChannel>;
    nsIProxiedProtocolHandler: nsJSIID<nsIProxiedProtocolHandler>;
    nsIProxyInfo: nsJSIID<nsIProxyInfo>;
    nsIRandomGenerator: nsJSIID<nsIRandomGenerator>;
    nsIRedirectChannelRegistrar: nsJSIID<nsIRedirectChannelRegistrar>;
    nsIRedirectHistoryEntry: nsJSIID<nsIRedirectHistoryEntry>;
    nsIRedirectResultListener: nsJSIID<nsIRedirectResultListener>;
    nsIRequest: nsJSIID<nsIRequest, typeof nsIRequest_TRRMode>;
    nsIRequestObserver: nsJSIID<nsIRequestObserver>;
    nsIRequestObserverProxy: nsJSIID<nsIRequestObserverProxy>;
    nsIResumableChannel: nsJSIID<nsIResumableChannel>;
    nsISecCheckWrapChannel: nsJSIID<nsISecCheckWrapChannel>;
    nsISecureBrowserUI: nsJSIID<nsISecureBrowserUI>;
    nsISensitiveInfoHiddenURI: nsJSIID<nsISensitiveInfoHiddenURI>;
    nsISerializationHelper: nsJSIID<nsISerializationHelper>;
    nsIServerSocket: nsJSIID<nsIServerSocket>;
    nsIServerSocketListener: nsJSIID<nsIServerSocketListener>;
    nsISimpleStreamListener: nsJSIID<nsISimpleStreamListener>;
    nsISimpleURIMutator: nsJSIID<nsISimpleURIMutator>;
    nsISocketTransport: nsJSIID<nsISocketTransport>;
    nsISTSShutdownObserver: nsJSIID<nsISTSShutdownObserver>;
    nsISocketTransportService: nsJSIID<nsISocketTransportService>;
    nsIRoutedSocketTransportService: nsJSIID<nsIRoutedSocketTransportService>;
    nsISpeculativeConnect: nsJSIID<nsISpeculativeConnect>;
    nsIStandardURL: nsJSIID<nsIStandardURL>;
    nsIStandardURLMutator: nsJSIID<nsIStandardURLMutator>;
    nsIStreamListener: nsJSIID<nsIStreamListener>;
    nsIStreamListenerTee: nsJSIID<nsIStreamListenerTee>;
    nsIStreamLoaderObserver: nsJSIID<nsIStreamLoaderObserver>;
    nsIStreamLoader: nsJSIID<nsIStreamLoader>;
    nsIStreamTransportService: nsJSIID<nsIStreamTransportService>;
    nsISuspendableChannelWrapper: nsJSIID<nsISuspendableChannelWrapper>;
    nsISyncStreamListener: nsJSIID<nsISyncStreamListener>;
    nsISystemProxySettings: nsJSIID<nsISystemProxySettings>;
    nsITLSServerSocket: nsJSIID<nsITLSServerSocket>;
    nsITLSClientStatus: nsJSIID<nsITLSClientStatus>;
    nsITLSServerConnectionInfo: nsJSIID<nsITLSServerConnectionInfo>;
    nsITLSServerSecurityObserver: nsJSIID<nsITLSServerSecurityObserver>;
    nsIThreadRetargetableStreamListener: nsJSIID<nsIThreadRetargetableStreamListener>;
    nsIInputChannelThrottleQueue: nsJSIID<nsIInputChannelThrottleQueue>;
    nsIThrottledInputChannel: nsJSIID<nsIThrottledInputChannel>;
    nsIServerTiming: nsJSIID<nsIServerTiming>;
    nsITimedChannel: nsJSIID<nsITimedChannel, typeof nsITimedChannel_BodyInfoAccess>;
    nsITraceableChannel: nsJSIID<nsITraceableChannel>;
    nsITransport: nsJSIID<nsITransport>;
    nsITransportEventSink: nsJSIID<nsITransportEventSink>;
    nsIUDPSocket: nsJSIID<nsIUDPSocket>;
    nsIUDPSocketListener: nsJSIID<nsIUDPSocketListener>;
    nsIUDPMessage: nsJSIID<nsIUDPMessage>;
    nsIURI: nsJSIID<nsIURI>;
    nsIURISetSpec: nsJSIID<nsIURISetSpec>;
    nsIURISetters: nsJSIID<nsIURISetters>;
    nsIURIMutator: nsJSIID<nsIURIMutator>;
    nsIURIWithSpecialOrigin: nsJSIID<nsIURIWithSpecialOrigin>;
    nsIURL: nsJSIID<nsIURL>;
    nsIURLMutator: nsJSIID<nsIURLMutator>;
    nsIURLParser: nsJSIID<nsIURLParser>;
    nsIUploadChannel: nsJSIID<nsIUploadChannel>;
    nsIUploadChannel2: nsJSIID<nsIUploadChannel2>;
    nsPISocketTransportService: nsJSIID<nsPISocketTransportService>;
    nsIAboutModule: nsJSIID<nsIAboutModule>;
    nsICacheEntry: nsJSIID<nsICacheEntry>;
    nsICacheEntryMetaDataVisitor: nsJSIID<nsICacheEntryMetaDataVisitor>;
    nsICacheEntryDoomCallback: nsJSIID<nsICacheEntryDoomCallback>;
    nsICacheEntryOpenCallback: nsJSIID<nsICacheEntryOpenCallback>;
    nsICachePurgeLock: nsJSIID<nsICachePurgeLock>;
    nsICacheStorage: nsJSIID<nsICacheStorage>;
    nsICacheStorageService: nsJSIID<nsICacheStorageService>;
    nsICacheStorageConsumptionObserver: nsJSIID<nsICacheStorageConsumptionObserver>;
    nsICacheStorageVisitor: nsJSIID<nsICacheStorageVisitor>;
    nsICacheTesting: nsJSIID<nsICacheTesting>;
    nsICookie: nsJSIID<nsICookie, typeof nsICookie_schemeType>;
    nsICookieJarSettings: nsJSIID<nsICookieJarSettings>;
    nsICookieManager: nsJSIID<nsICookieManager>;
    nsICookieNotification: nsJSIID<nsICookieNotification, typeof nsICookieNotification_Action>;
    nsICookiePermission: nsJSIID<nsICookiePermission>;
    nsICookieTransactionCallback: nsJSIID<nsICookieTransactionCallback>;
    nsICookieService: nsJSIID<nsICookieService>;
    nsIThirdPartyCookieBlockingExceptionListService: nsJSIID<nsIThirdPartyCookieBlockingExceptionListService>;
    nsIThirdPartyCookieExceptionEntry: nsJSIID<nsIThirdPartyCookieExceptionEntry>;
    nsIDNSAdditionalInfo: nsJSIID<nsIDNSAdditionalInfo>;
    nsIDNSByTypeRecord: nsJSIID<nsIDNSByTypeRecord>;
    nsIDNSTXTRecord: nsJSIID<nsIDNSTXTRecord>;
    nsISVCParam: nsJSIID<nsISVCParam>;
    nsISVCParamAlpn: nsJSIID<nsISVCParamAlpn>;
    nsISVCParamNoDefaultAlpn: nsJSIID<nsISVCParamNoDefaultAlpn>;
    nsISVCParamPort: nsJSIID<nsISVCParamPort>;
    nsISVCParamIPv4Hint: nsJSIID<nsISVCParamIPv4Hint>;
    nsISVCParamEchConfig: nsJSIID<nsISVCParamEchConfig>;
    nsISVCParamIPv6Hint: nsJSIID<nsISVCParamIPv6Hint>;
    nsISVCParamODoHConfig: nsJSIID<nsISVCParamODoHConfig>;
    nsISVCBRecord: nsJSIID<nsISVCBRecord>;
    nsIDNSHTTPSSVCRecord: nsJSIID<nsIDNSHTTPSSVCRecord>;
    nsIDNSListener: nsJSIID<nsIDNSListener>;
    nsIDNSRecord: nsJSIID<nsIDNSRecord>;
    nsIDNSAddrRecord: nsJSIID<nsIDNSAddrRecord>;
    nsIDNSService: nsJSIID<
      nsIDNSService,
      typeof nsIDNSService_ResolveType &
        typeof nsIDNSService_ResolverMode &
        typeof nsIDNSService_DNSFlags &
        typeof nsIDNSService_ConfirmationState
    >;
    nsIEffectiveTLDService: nsJSIID<nsIEffectiveTLDService>;
    nsIIDNService: nsJSIID<nsIIDNService>;
    nsINativeDNSResolverOverride: nsJSIID<nsINativeDNSResolverOverride>;
    nsITRRSkipReason: nsJSIID<nsITRRSkipReason, typeof nsITRRSkipReason_value>;
    nsPIDNSService: nsJSIID<nsPIDNSService>;
    nsIFileChannel: nsJSIID<nsIFileChannel>;
    nsIFileProtocolHandler: nsJSIID<nsIFileProtocolHandler>;
    nsIDataChannel: nsJSIID<nsIDataChannel>;
    nsIBinaryHttpRequest: nsJSIID<nsIBinaryHttpRequest>;
    nsIBinaryHttpResponse: nsJSIID<nsIBinaryHttpResponse>;
    nsIBinaryHttp: nsJSIID<nsIBinaryHttp>;
    nsICORSPreflightCache: nsJSIID<nsICORSPreflightCache>;
    nsICORSPreflightCacheEntry: nsJSIID<nsICORSPreflightCacheEntry>;
    nsIEarlyHintObserver: nsJSIID<nsIEarlyHintObserver>;
    nsIHttpActivityObserver: nsJSIID<nsIHttpActivityObserver>;
    nsIHttpActivityDistributor: nsJSIID<nsIHttpActivityDistributor>;
    nsIHttpAuthManager: nsJSIID<nsIHttpAuthManager>;
    nsIHttpChannel: nsJSIID<nsIHttpChannel>;
    nsIHttpUpgradeListener: nsJSIID<nsIHttpUpgradeListener>;
    nsIHttpChannelInternal: nsJSIID<nsIHttpChannelInternal>;
    nsIHttpHeaderVisitor: nsJSIID<nsIHttpHeaderVisitor>;
    nsIHttpProtocolHandler: nsJSIID<nsIHttpProtocolHandler>;
    nsINetworkErrorLogging: nsJSIID<nsINetworkErrorLogging>;
    nsIObliviousHttpClientResponse: nsJSIID<nsIObliviousHttpClientResponse>;
    nsIObliviousHttpClientRequest: nsJSIID<nsIObliviousHttpClientRequest>;
    nsIObliviousHttpServerResponse: nsJSIID<nsIObliviousHttpServerResponse>;
    nsIObliviousHttpServer: nsJSIID<nsIObliviousHttpServer>;
    nsIObliviousHttp: nsJSIID<nsIObliviousHttp>;
    nsIObliviousHttpService: nsJSIID<nsIObliviousHttpService>;
    nsIObliviousHttpChannel: nsJSIID<nsIObliviousHttpChannel>;
    nsIRaceCacheWithNetwork: nsJSIID<nsIRaceCacheWithNetwork>;
    nsIReplacedHttpResponse: nsJSIID<nsIReplacedHttpResponse>;
    nsIWellKnownOpportunisticUtils: nsJSIID<nsIWellKnownOpportunisticUtils>;
    nsICompressConvStats: nsJSIID<nsICompressConvStats>;
    nsIResProtocolHandler: nsJSIID<nsIResProtocolHandler>;
    nsISubstitutingProtocolHandler: nsJSIID<nsISubstitutingProtocolHandler>;
    nsISocketProvider: nsJSIID<nsISocketProvider>;
    nsISocketProviderService: nsJSIID<nsISocketProviderService>;
    mozITXTToHTMLConv: nsJSIID<mozITXTToHTMLConv>;
    nsIDirIndex: nsJSIID<nsIDirIndex>;
    nsIDirIndexListener: nsJSIID<nsIDirIndexListener>;
    nsIDirIndexParser: nsJSIID<nsIDirIndexParser>;
    nsIStreamConverter: nsJSIID<nsIStreamConverter>;
    nsIStreamConverterService: nsJSIID<nsIStreamConverterService>;
    nsITXTToHTMLConv: nsJSIID<nsITXTToHTMLConv>;
    nsITransportProvider: nsJSIID<nsITransportProvider>;
    nsIWebSocketChannel: nsJSIID<nsIWebSocketChannel>;
    nsIWebSocketFrame: nsJSIID<nsIWebSocketFrame>;
    nsIWebSocketEventListener: nsJSIID<nsIWebSocketEventListener>;
    nsIWebSocketEventService: nsJSIID<nsIWebSocketEventService>;
    nsIWebSocketImpl: nsJSIID<nsIWebSocketImpl>;
    nsIWebSocketListener: nsJSIID<nsIWebSocketListener>;
    nsIWebTransport: nsJSIID<
      nsIWebTransport,
      typeof nsIWebTransport_WebTransportError & typeof nsIWebTransport_HTTPVersion
    >;
    WebTransportSessionEventListener: nsJSIID<
      WebTransportSessionEventListener,
      typeof WebTransportSessionEventListener_DatagramOutcome
    >;
    nsIWebTransportStreamCallback: nsJSIID<nsIWebTransportStreamCallback>;
    nsIWebTransportHash: nsJSIID<nsIWebTransportHash>;
    nsIWebTransportSendStreamStats: nsJSIID<nsIWebTransportSendStreamStats>;
    nsIWebTransportReceiveStreamStats: nsJSIID<nsIWebTransportReceiveStreamStats>;
    nsIWebTransportStreamStatsCallback: nsJSIID<nsIWebTransportStreamStatsCallback>;
    nsIWebTransportReceiveStream: nsJSIID<nsIWebTransportReceiveStream>;
    nsIWebTransportSendStream: nsJSIID<nsIWebTransportSendStream>;
    nsIWebTransportBidirectionalStream: nsJSIID<nsIWebTransportBidirectionalStream>;
    nsIWifiAccessPoint: nsJSIID<nsIWifiAccessPoint>;
    nsIWifiListener: nsJSIID<nsIWifiListener>;
    nsIWifiMonitor: nsJSIID<nsIWifiMonitor>;
    nsIParentalControlsService: nsJSIID<nsIParentalControlsService>;
    IPeerConnectionObserver: nsJSIID<IPeerConnectionObserver>;
    IPeerConnection: nsJSIID<IPeerConnection>;
    nsIRemotePermissionService: nsJSIID<nsIRemotePermissionService>;
    nsICertOverride: nsJSIID<nsICertOverride>;
    nsICertOverrideService: nsJSIID<nsICertOverrideService>;
    nsICertStorageCallback: nsJSIID<nsICertStorageCallback>;
    nsIRevocationState: nsJSIID<nsIRevocationState>;
    nsIIssuerAndSerialRevocationState: nsJSIID<nsIIssuerAndSerialRevocationState>;
    nsISubjectAndPubKeyRevocationState: nsJSIID<nsISubjectAndPubKeyRevocationState>;
    nsICertInfo: nsJSIID<nsICertInfo>;
    nsICertStorage: nsJSIID<nsICertStorage>;
    nsICertTreeItem: nsJSIID<nsICertTreeItem>;
    nsICertTree: nsJSIID<nsICertTree>;
    nsICertificateDialogs: nsJSIID<nsICertificateDialogs>;
    nsIClientAuthDialogCallback: nsJSIID<nsIClientAuthDialogCallback>;
    nsIClientAuthDialogService: nsJSIID<nsIClientAuthDialogService>;
    nsIClientAuthRememberRecord: nsJSIID<nsIClientAuthRememberRecord>;
    nsIClientAuthRememberService: nsJSIID<
      nsIClientAuthRememberService,
      typeof nsIClientAuthRememberService_Duration
    >;
    nsIContentSignatureVerifier: nsJSIID<nsIContentSignatureVerifier>;
    nsICryptoHash: nsJSIID<nsICryptoHash>;
    nsIDataStorageManager: nsJSIID<nsIDataStorageManager, typeof nsIDataStorageManager_DataStorage>;
    nsIDataStorage: nsJSIID<nsIDataStorage, typeof nsIDataStorage_DataType>;
    nsIDataStorageItem: nsJSIID<nsIDataStorageItem>;
    nsINSSComponent: nsJSIID<nsINSSComponent>;
    nsINSSErrorsService: nsJSIID<nsINSSErrorsService>;
    nsINSSVersion: nsJSIID<nsINSSVersion>;
    nsIOSKeyStore: nsJSIID<nsIOSKeyStore>;
    nsIOSReauthenticator: nsJSIID<nsIOSReauthenticator>;
    nsIPK11Token: nsJSIID<nsIPK11Token>;
    nsIPK11TokenDB: nsJSIID<nsIPK11TokenDB>;
    nsIPKCS11Module: nsJSIID<nsIPKCS11Module>;
    nsIPKCS11ModuleDB: nsJSIID<nsIPKCS11ModuleDB>;
    nsIPKCS11Slot: nsJSIID<nsIPKCS11Slot>;
    nsIPublicKeyPinningService: nsJSIID<nsIPublicKeyPinningService>;
    nsISecretDecoderRing: nsJSIID<nsISecretDecoderRing>;
    nsISecurityUITelemetry: nsJSIID<nsISecurityUITelemetry>;
    nsISiteSecurityService: nsJSIID<
      nsISiteSecurityService,
      typeof nsISiteSecurityService_ResetStateBy
    >;
    nsITLSSocketControl: nsJSIID<nsITLSSocketControl>;
    nsITokenPasswordDialogs: nsJSIID<nsITokenPasswordDialogs>;
    nsITransportSecurityInfo: nsJSIID<
      nsITransportSecurityInfo,
      typeof nsITransportSecurityInfo_OverridableErrorCategory
    >;
    nsIX509Cert: nsJSIID<nsIX509Cert>;
    nsIAppSignatureInfo: nsJSIID<
      nsIAppSignatureInfo,
      typeof nsIAppSignatureInfo_SignatureAlgorithm
    >;
    nsIOpenSignedAppFileCallback: nsJSIID<nsIOpenSignedAppFileCallback>;
    nsIAsyncBoolCallback: nsJSIID<nsIAsyncBoolCallback>;
    nsICertVerificationCallback: nsJSIID<nsICertVerificationCallback>;
    nsIX509CertDB: nsJSIID<nsIX509CertDB, typeof nsIX509CertDB_VerifyUsage>;
    nsIX509CertValidity: nsJSIID<nsIX509CertValidity>;
    mozIVisitInfo: nsJSIID<mozIVisitInfo>;
    mozIPlaceInfo: nsJSIID<mozIPlaceInfo>;
    mozIVisitInfoCallback: nsJSIID<mozIVisitInfoCallback>;
    mozIVisitedStatusCallback: nsJSIID<mozIVisitedStatusCallback>;
    mozIAsyncHistory: nsJSIID<mozIAsyncHistory>;
    mozIPlacesAutoComplete: nsJSIID<mozIPlacesAutoComplete>;
    mozIPlacesPendingOperation: nsJSIID<mozIPlacesPendingOperation>;
    mozISyncedBookmarksMirrorProgressListener: nsJSIID<mozISyncedBookmarksMirrorProgressListener>;
    mozISyncedBookmarksMirrorCallback: nsJSIID<mozISyncedBookmarksMirrorCallback>;
    mozISyncedBookmarksMirrorLogger: nsJSIID<mozISyncedBookmarksMirrorLogger>;
    mozISyncedBookmarksMerger: nsJSIID<
      mozISyncedBookmarksMerger,
      typeof mozISyncedBookmarksMerger_SyncedItemKinds &
        typeof mozISyncedBookmarksMerger_SyncedItemValidity
    >;
    nsIFaviconService: nsJSIID<nsIFaviconService>;
    nsIFaviconDataCallback: nsJSIID<nsIFaviconDataCallback>;
    nsINavBookmarksService: nsJSIID<nsINavBookmarksService>;
    nsINavHistoryResultNode: nsJSIID<nsINavHistoryResultNode>;
    nsINavHistoryContainerResultNode: nsJSIID<nsINavHistoryContainerResultNode>;
    nsINavHistoryQueryResultNode: nsJSIID<nsINavHistoryQueryResultNode>;
    nsINavHistoryResultObserver: nsJSIID<nsINavHistoryResultObserver>;
    nsINavHistoryResult: nsJSIID<nsINavHistoryResult>;
    nsINavHistoryQuery: nsJSIID<nsINavHistoryQuery>;
    nsINavHistoryQueryOptions: nsJSIID<nsINavHistoryQueryOptions>;
    nsINavHistoryService: nsJSIID<nsINavHistoryService>;
    nsIPlacesPreviewsHelperService: nsJSIID<nsIPlacesPreviewsHelperService>;
    nsITaggingService: nsJSIID<nsITaggingService>;
    nsIPrefBranch: nsJSIID<nsIPrefBranch>;
    nsIPrefLocalizedString: nsJSIID<nsIPrefLocalizedString>;
    nsIPrefStatsCallback: nsJSIID<nsIPrefStatsCallback>;
    nsIPrefObserver: nsJSIID<nsIPrefObserver>;
    nsIPrefService: nsJSIID<nsIPrefService>;
    nsIRelativeFilePref: nsJSIID<nsIRelativeFilePref>;
    nsIPrefetchService: nsJSIID<nsIPrefetchService>;
    nsIPrivateAttributionService: nsJSIID<nsIPrivateAttributionService>;
    nsIProfilerStartParams: nsJSIID<nsIProfilerStartParams>;
    nsIProfiler: nsJSIID<nsIProfiler>;
    nsIRddProcessTest: nsJSIID<nsIRddProcessTest>;
    nsIMarionette: nsJSIID<nsIMarionette>;
    nsIRemoteAgent: nsJSIID<nsIRemoteAgent>;
    nsIApplicationReputationService: nsJSIID<nsIApplicationReputationService>;
    nsIApplicationReputationQuery: nsJSIID<nsIApplicationReputationQuery>;
    nsIApplicationReputationCallback: nsJSIID<nsIApplicationReputationCallback>;
    mozISandboxSettings: nsJSIID<mozISandboxSettings>;
    mozISandboxReport: nsJSIID<mozISandboxReport>;
    mozISandboxReportArray: nsJSIID<mozISandboxReportArray>;
    mozISandboxReporter: nsJSIID<mozISandboxReporter>;
    nsIFormFillController: nsJSIID<nsIFormFillController>;
    nsIFormFillCompleteObserver: nsJSIID<nsIFormFillCompleteObserver>;
    mozIAppServicesLogger: nsJSIID<mozIAppServicesLogger>;
    mozIBridgedSyncEngineCallback: nsJSIID<mozIBridgedSyncEngineCallback>;
    mozIBridgedSyncEngineApplyCallback: nsJSIID<mozIBridgedSyncEngineApplyCallback>;
    mozIBridgedSyncEngine: nsJSIID<mozIBridgedSyncEngine>;
    mozIInterruptible: nsJSIID<mozIInterruptible>;
    mozIServicesLogSink: nsJSIID<mozIServicesLogSink>;
    nsISessionStoreFunctions: nsJSIID<nsISessionStoreFunctions>;
    nsISessionStoreRestoreData: nsJSIID<nsISessionStoreRestoreData>;
    nsIShellService: nsJSIID<nsIShellService>;
    nsIBFCacheEntry: nsJSIID<nsIBFCacheEntry>;
    nsISHEntry: nsJSIID<nsISHEntry>;
    nsISHistory: nsJSIID<nsISHistory>;
    nsISHistoryListener: nsJSIID<nsISHistoryListener>;
    mozIPersonalDictionary: nsJSIID<mozIPersonalDictionary>;
    mozISpellCheckingEngine: nsJSIID<mozISpellCheckingEngine>;
    nsIStartupCacheInfo: nsJSIID<nsIStartupCacheInfo>;
    mozIStorageAsyncConnection: nsJSIID<mozIStorageAsyncConnection>;
    mozIStorageAsyncStatement: nsJSIID<mozIStorageAsyncStatement>;
    mozIStorageBaseStatement: nsJSIID<mozIStorageBaseStatement>;
    mozIStorageBindingParams: nsJSIID<mozIStorageBindingParams>;
    mozIStorageBindingParamsArray: nsJSIID<mozIStorageBindingParamsArray>;
    mozIStorageCompletionCallback: nsJSIID<mozIStorageCompletionCallback>;
    mozIStorageConnection: nsJSIID<mozIStorageConnection>;
    mozIStorageError: nsJSIID<mozIStorageError>;
    mozIStorageFunction: nsJSIID<mozIStorageFunction>;
    mozIStoragePendingStatement: nsJSIID<mozIStoragePendingStatement>;
    mozIStorageProgressHandler: nsJSIID<mozIStorageProgressHandler>;
    mozIStorageResultSet: nsJSIID<mozIStorageResultSet>;
    mozIStorageRow: nsJSIID<mozIStorageRow>;
    mozIStorageService: nsJSIID<mozIStorageService>;
    mozIStorageStatement: nsJSIID<mozIStorageStatement>;
    mozIStorageStatementCallback: nsJSIID<mozIStorageStatementCallback>;
    mozIStorageVacuumParticipant: nsJSIID<mozIStorageVacuumParticipant>;
    mozIStorageValueArray: nsJSIID<mozIStorageValueArray>;
    nsIFetchTelemetryDataCallback: nsJSIID<nsIFetchTelemetryDataCallback>;
    nsITelemetry: nsJSIID<nsITelemetry>;
    nsIDAPTelemetry: nsJSIID<nsIDAPTelemetry>;
    nsIHttpServer: nsJSIID<nsIHttpServer>;
    nsIHttpServerStoppedCallback: nsJSIID<nsIHttpServerStoppedCallback>;
    nsIHttpServerIdentity: nsJSIID<nsIHttpServerIdentity>;
    nsIHttpRequestHandler: nsJSIID<nsIHttpRequestHandler>;
    nsIHttpRequest: nsJSIID<nsIHttpRequest>;
    nsIHttpResponse: nsJSIID<nsIHttpResponse>;
    nsIPageThumbsStorageService: nsJSIID<nsIPageThumbsStorageService>;
    nsIBTPRemoteExceptionList: nsJSIID<nsIBTPRemoteExceptionList>;
    nsIBounceTrackingMapEntry: nsJSIID<nsIBounceTrackingMapEntry>;
    nsIBounceTrackingPurgeEntry: nsJSIID<nsIBounceTrackingPurgeEntry>;
    nsIBounceTrackingProtection: nsJSIID<
      nsIBounceTrackingProtection,
      typeof nsIBounceTrackingProtection_Modes
    >;
    nsIContentBlockingAllowList: nsJSIID<nsIContentBlockingAllowList>;
    nsIPartitioningExceptionListObserver: nsJSIID<nsIPartitioningExceptionListObserver>;
    nsIPartitioningExceptionListService: nsJSIID<nsIPartitioningExceptionListService>;
    nsIPurgeTrackerService: nsJSIID<nsIPurgeTrackerService>;
    nsITrackingDBService: nsJSIID<nsITrackingDBService>;
    nsIURLDecorationAnnotationsService: nsJSIID<nsIURLDecorationAnnotationsService>;
    nsIURLQueryStringStripper: nsJSIID<nsIURLQueryStringStripper>;
    nsIURLQueryStrippingListObserver: nsJSIID<nsIURLQueryStrippingListObserver>;
    nsIURLQueryStrippingListService: nsJSIID<nsIURLQueryStrippingListService>;
    nsIAsyncShutdownBlocker: nsJSIID<nsIAsyncShutdownBlocker>;
    nsIAsyncShutdownClient: nsJSIID<nsIAsyncShutdownClient>;
    nsIAsyncShutdownCompletionCallback: nsJSIID<nsIAsyncShutdownCompletionCallback>;
    nsIAsyncShutdownBarrier: nsJSIID<nsIAsyncShutdownBarrier>;
    nsIAsyncShutdownService: nsJSIID<nsIAsyncShutdownService>;
    nsIBackgroundTasks: nsJSIID<nsIBackgroundTasks>;
    nsIBackgroundTasksManager: nsJSIID<nsIBackgroundTasksManager>;
    nsIBackgroundTasksRunner: nsJSIID<nsIBackgroundTasksRunner>;
    nsIClearBySiteEntry: nsJSIID<nsIClearBySiteEntry>;
    nsIClearDataService: nsJSIID<nsIClearDataService>;
    nsIClearDataCallback: nsJSIID<nsIClearDataCallback>;
    nsIContentAnalysisAcknowledgement: nsJSIID<
      nsIContentAnalysisAcknowledgement,
      typeof nsIContentAnalysisAcknowledgement_Result &
        typeof nsIContentAnalysisAcknowledgement_FinalAction
    >;
    nsIContentAnalysisResult: nsJSIID<nsIContentAnalysisResult>;
    nsIContentAnalysisResponse: nsJSIID<
      nsIContentAnalysisResponse,
      typeof nsIContentAnalysisResponse_Action & typeof nsIContentAnalysisResponse_CancelError
    >;
    nsIClientDownloadResource: nsJSIID<nsIClientDownloadResource>;
    nsIContentAnalysisRequest: nsJSIID<
      nsIContentAnalysisRequest,
      typeof nsIContentAnalysisRequest_AnalysisType &
        typeof nsIContentAnalysisRequest_Reason &
        typeof nsIContentAnalysisRequest_OperationType
    >;
    nsIContentAnalysisCallback: nsJSIID<nsIContentAnalysisCallback>;
    nsIContentAnalysisDiagnosticInfo: nsJSIID<nsIContentAnalysisDiagnosticInfo>;
    nsIContentAnalysis: nsJSIID<nsIContentAnalysis>;
    nsIClickRule: nsJSIID<nsIClickRule, typeof nsIClickRule_RunContext>;
    nsICookieBannerListService: nsJSIID<nsICookieBannerListService>;
    nsICookieBannerRule: nsJSIID<nsICookieBannerRule>;
    nsICookieBannerService: nsJSIID<nsICookieBannerService, typeof nsICookieBannerService_Modes>;
    nsICookieBannerTelemetryService: nsJSIID<nsICookieBannerTelemetryService>;
    nsICookieRule: nsJSIID<nsICookieRule>;
    nsICrashService: nsJSIID<nsICrashService>;
    nsIFinalizationWitnessService: nsJSIID<nsIFinalizationWitnessService>;
    nsIVisibleTab: nsJSIID<nsIVisibleTab>;
    nsIBrowserWindowTracker: nsJSIID<nsIBrowserWindowTracker>;
    nsIRegion: nsJSIID<nsIRegion>;
    nsIProcessToolsService: nsJSIID<nsIProcessToolsService>;
    nsIFingerprintingOverride: nsJSIID<nsIFingerprintingOverride>;
    nsIFingerprintingWebCompatService: nsJSIID<nsIFingerprintingWebCompatService>;
    nsIRFPService: nsJSIID<nsIRFPService>;
    nsIRFPTargetSetIDL: nsJSIID<nsIRFPTargetSetIDL>;
    nsIUserCharacteristicsPageService: nsJSIID<nsIUserCharacteristicsPageService>;
    nsISearchSubmission: nsJSIID<nsISearchSubmission>;
    nsISearchEngine: nsJSIID<nsISearchEngine>;
    nsISearchParseSubmissionResult: nsJSIID<nsISearchParseSubmissionResult>;
    nsISearchService: nsJSIID<
      nsISearchService,
      typeof nsISearchService_OpenSearchInstallErrors &
        typeof nsISearchService_DefaultEngineChangeReason
    >;
    nsIToolkitShellService: nsJSIID<nsIToolkitShellService>;
    nsITerminatorTest: nsJSIID<nsITerminatorTest>;
    nsIXULStore: nsJSIID<nsIXULStore>;
    nsIProfileStartup: nsJSIID<nsIProfileStartup>;
    nsIProfileMigrator: nsJSIID<nsIProfileMigrator>;
    nsIProfileUnlocker: nsJSIID<nsIProfileUnlocker>;
    nsIProfileLock: nsJSIID<nsIProfileLock>;
    nsIToolkitProfile: nsJSIID<nsIToolkitProfile>;
    nsIToolkitProfileService: nsJSIID<
      nsIToolkitProfileService,
      typeof nsIToolkitProfileService_downgradeUIFlags &
        typeof nsIToolkitProfileService_downgradeUIChoice &
        typeof nsIToolkitProfileService_profileManagerResult
    >;
    nsIRemoteService: nsJSIID<nsIRemoteService>;
    nsITransaction: nsJSIID<nsITransaction>;
    nsITransactionManager: nsJSIID<nsITransactionManager>;
    nsIInlineSpellChecker: nsJSIID<nsIInlineSpellChecker>;
    nsIScriptableUnicodeConverter: nsJSIID<nsIScriptableUnicodeConverter>;
    nsITextToSubURI: nsJSIID<nsITextToSubURI>;
    nsIUpdateTimerManager: nsJSIID<nsIUpdateTimerManager>;
    nsIUpdatePatch: nsJSIID<nsIUpdatePatch>;
    nsIUpdate: nsJSIID<nsIUpdate>;
    nsIUpdateCheckResult: nsJSIID<nsIUpdateCheckResult>;
    nsIUpdateCheck: nsJSIID<nsIUpdateCheck>;
    nsIUpdateCheckerInternal: nsJSIID<nsIUpdateCheckerInternal>;
    nsIUpdateChecker: nsJSIID<nsIUpdateChecker>;
    nsIApplicationUpdateServiceInternal: nsJSIID<nsIApplicationUpdateServiceInternal>;
    nsIApplicationUpdateService: nsJSIID<nsIApplicationUpdateService>;
    nsIUpdateProcessor: nsJSIID<nsIUpdateProcessor>;
    nsIUpdateSyncManager: nsJSIID<nsIUpdateSyncManager>;
    nsIUpdateMutex: nsJSIID<nsIUpdateMutex>;
    nsIUpdateManagerInternal: nsJSIID<nsIUpdateManagerInternal>;
    nsIUpdateManager: nsJSIID<nsIUpdateManager>;
    nsIApplicationUpdateServiceStub: nsJSIID<nsIApplicationUpdateServiceStub>;
    nsIContentHandler: nsJSIID<nsIContentHandler>;
    nsIDocumentLoader: nsJSIID<nsIDocumentLoader>;
    nsITransfer: nsJSIID<nsITransfer>;
    nsIURIContentListener: nsJSIID<nsIURIContentListener>;
    nsIURILoader: nsJSIID<nsIURILoader>;
    nsIWebProgress: nsJSIID<nsIWebProgress>;
    nsIWebProgressListener: nsJSIID<nsIWebProgressListener>;
    nsIWebProgressListener2: nsJSIID<nsIWebProgressListener2>;
    nsIUrlClassifierBlockedChannel: nsJSIID<nsIUrlClassifierBlockedChannel>;
    nsIChannelClassifierService: nsJSIID<nsIChannelClassifierService>;
    nsIURIClassifierCallback: nsJSIID<nsIURIClassifierCallback>;
    nsIURIClassifier: nsJSIID<nsIURIClassifier>;
    nsIUrlClassifierExceptionListObserver: nsJSIID<nsIUrlClassifierExceptionListObserver>;
    nsIUrlClassifierExceptionListService: nsJSIID<nsIUrlClassifierExceptionListService>;
    nsIUrlClassifierFeature: nsJSIID<
      nsIUrlClassifierFeature,
      typeof nsIUrlClassifierFeature_listType & typeof nsIUrlClassifierFeature_URIType
    >;
    nsIUrlClassifierFeatureResult: nsJSIID<nsIUrlClassifierFeatureResult>;
    nsIUrlClassifierFeatureCallback: nsJSIID<nsIUrlClassifierFeatureCallback>;
    IUrlClassifierUITelemetry: nsJSIID<IUrlClassifierUITelemetry>;
    nsIUrlClassifierCallback: nsJSIID<nsIUrlClassifierCallback>;
    nsIUrlClassifierUpdateObserver: nsJSIID<nsIUrlClassifierUpdateObserver>;
    nsIUrlClassifierDBService: nsJSIID<nsIUrlClassifierDBService>;
    nsIFullHashMatch: nsJSIID<nsIFullHashMatch>;
    nsIUrlClassifierHashCompleterCallback: nsJSIID<nsIUrlClassifierHashCompleterCallback>;
    nsIUrlClassifierHashCompleter: nsJSIID<nsIUrlClassifierHashCompleter>;
    nsIUrlClassifierPositiveCacheEntry: nsJSIID<nsIUrlClassifierPositiveCacheEntry>;
    nsIUrlClassifierCacheEntry: nsJSIID<nsIUrlClassifierCacheEntry>;
    nsIUrlClassifierCacheInfo: nsJSIID<nsIUrlClassifierCacheInfo>;
    nsIUrlClassifierGetCacheCallback: nsJSIID<nsIUrlClassifierGetCacheCallback>;
    nsIUrlClassifierInfo: nsJSIID<nsIUrlClassifierInfo>;
    nsIUrlClassifierPrefixSet: nsJSIID<nsIUrlClassifierPrefixSet>;
    nsIUrlClassifierRemoteSettingsService: nsJSIID<nsIUrlClassifierRemoteSettingsService>;
    nsIUrlClassifierStreamUpdater: nsJSIID<nsIUrlClassifierStreamUpdater>;
    nsIUrlClassifierParseFindFullHashCallback: nsJSIID<nsIUrlClassifierParseFindFullHashCallback>;
    nsIUrlClassifierUtils: nsJSIID<nsIUrlClassifierUtils>;
    nsIUrlListManager: nsJSIID<nsIUrlListManager>;
    nsIURLFormatter: nsJSIID<nsIURLFormatter>;
    nsIUtilityProcessTest: nsJSIID<nsIUtilityProcessTest>;
    nsIWebBrowser: nsJSIID<nsIWebBrowser>;
    nsIWebBrowserChrome: nsJSIID<nsIWebBrowserChrome>;
    nsIWebBrowserPrint: nsJSIID<nsIWebBrowserPrint>;
    nsIWebBrowserPersist: nsJSIID<nsIWebBrowserPersist>;
    nsIWebBrowserPersistURIMap: nsJSIID<nsIWebBrowserPersistURIMap>;
    nsIWebBrowserPersistDocument: nsJSIID<nsIWebBrowserPersistDocument>;
    nsIWebBrowserPersistResourceVisitor: nsJSIID<nsIWebBrowserPersistResourceVisitor>;
    nsIWebBrowserPersistWriteCompletion: nsJSIID<nsIWebBrowserPersistWriteCompletion>;
    nsIWebBrowserPersistDocumentReceiver: nsJSIID<nsIWebBrowserPersistDocumentReceiver>;
    extIWebNavigation: nsJSIID<extIWebNavigation>;
    mozIExtensionServiceWorkerInfo: nsJSIID<mozIExtensionServiceWorkerInfo>;
    mozIExtensionListenerCallOptions: nsJSIID<
      mozIExtensionListenerCallOptions,
      typeof mozIExtensionListenerCallOptions_APIObjectType &
        typeof mozIExtensionListenerCallOptions_CallbackType
    >;
    mozIExtensionEventListener: nsJSIID<mozIExtensionEventListener>;
    mozIExtensionAPIRequest: nsJSIID<
      mozIExtensionAPIRequest,
      typeof mozIExtensionAPIRequest_RequestType
    >;
    mozIExtensionAPIRequestResult: nsJSIID<
      mozIExtensionAPIRequestResult,
      typeof mozIExtensionAPIRequestResult_ResultType
    >;
    mozIExtensionAPIRequestHandler: nsJSIID<mozIExtensionAPIRequestHandler>;
    mozIExtensionProcessScript: nsJSIID<mozIExtensionProcessScript>;
    nsINativeMessagingPortal: nsJSIID<nsINativeMessagingPortal>;
    nsIWebVTTListener: nsJSIID<nsIWebVTTListener>;
    nsIWebVTTParserWrapper: nsJSIID<nsIWebVTTParserWrapper>;
    nsIBaseWindow: nsJSIID<nsIBaseWindow>;
    nsIBidiKeyboard: nsJSIID<nsIBidiKeyboard>;
    nsIAsyncSetClipboardData: nsJSIID<nsIAsyncSetClipboardData>;
    nsIAsyncClipboardRequestCallback: nsJSIID<nsIAsyncClipboardRequestCallback>;
    nsIClipboardDataSnapshot: nsJSIID<nsIClipboardDataSnapshot>;
    nsIClipboardGetDataSnapshotCallback: nsJSIID<nsIClipboardGetDataSnapshotCallback>;
    nsIClipboard: nsJSIID<nsIClipboard, typeof nsIClipboard_ClipboardType>;
    nsIClipboardHelper: nsJSIID<nsIClipboardHelper, typeof nsIClipboardHelper_SensitiveData>;
    nsIClipboardOwner: nsJSIID<nsIClipboardOwner>;
    nsIColorPickerShownCallback: nsJSIID<nsIColorPickerShownCallback>;
    nsIColorPicker: nsJSIID<nsIColorPicker>;
    nsIDisplayInfo: nsJSIID<nsIDisplayInfo>;
    nsIDragService: nsJSIID<nsIDragService>;
    nsIDragSession: nsJSIID<nsIDragSession>;
    nsIFilePicker: nsJSIID<
      nsIFilePicker,
      typeof nsIFilePicker_Mode &
        typeof nsIFilePicker_ResultCode &
        typeof nsIFilePicker_CaptureTarget
    >;
    nsIFilePickerShownCallback: nsJSIID<nsIFilePickerShownCallback>;
    nsIFormatConverter: nsJSIID<nsIFormatConverter>;
    nsIGfxInfo: nsJSIID<nsIGfxInfo, typeof nsIGfxInfo_FontVisibilityDeviceDetermination>;
    nsIGfxInfoDebug: nsJSIID<nsIGfxInfoDebug>;
    nsIMockDragServiceController: nsJSIID<
      nsIMockDragServiceController,
      typeof nsIMockDragServiceController_EventType
    >;
    nsIPaper: nsJSIID<nsIPaper>;
    nsIPaperMargin: nsJSIID<nsIPaperMargin>;
    nsIPrintDialogService: nsJSIID<nsIPrintDialogService>;
    nsIPrintSettings: nsJSIID<nsIPrintSettings, typeof nsIPrintSettings_OutputDestinationType>;
    nsIPrintSettingsService: nsJSIID<nsIPrintSettingsService>;
    nsIPrinterInfo: nsJSIID<nsIPrinterInfo>;
    nsIPrinter: nsJSIID<nsIPrinter>;
    nsIPrinterList: nsJSIID<nsIPrinterList>;
    nsIScreen: nsJSIID<nsIScreen>;
    nsIScreenManager: nsJSIID<nsIScreenManager>;
    nsISharePicker: nsJSIID<nsISharePicker>;
    nsISound: nsJSIID<nsISound>;
    nsISystemStatusBar: nsJSIID<nsISystemStatusBar>;
    nsIFlavorDataProvider: nsJSIID<nsIFlavorDataProvider>;
    nsITransferable: nsJSIID<nsITransferable>;
    nsIUserIdleService: nsJSIID<nsIUserIdleService>;
    nsIUserIdleServiceInternal: nsJSIID<nsIUserIdleServiceInternal>;
    nsIWindowCreator: nsJSIID<nsIWindowCreator>;
    nsIWindowProvider: nsJSIID<nsIWindowProvider>;
    nsIDialogParamBlock: nsJSIID<nsIDialogParamBlock>;
    nsIOpenWindowInfo: nsJSIID<nsIOpenWindowInfo>;
    nsIPromptCollection: nsJSIID<nsIPromptCollection>;
    nsIPromptFactory: nsJSIID<nsIPromptFactory>;
    nsIPromptService: nsJSIID<nsIPromptService>;
    nsIWindowWatcher: nsJSIID<nsIWindowWatcher>;
    nsITabUnloader: nsJSIID<nsITabUnloader>;
    nsIAvailableMemoryWatcherBase: nsJSIID<nsIAvailableMemoryWatcherBase>;
    nsIConsoleListener: nsJSIID<nsIConsoleListener>;
    nsIConsoleMessage: nsJSIID<nsIConsoleMessage>;
    nsIConsoleService: nsJSIID<nsIConsoleService, typeof nsIConsoleService_OutputMode>;
    nsICycleCollectorHandler: nsJSIID<nsICycleCollectorHandler>;
    nsICycleCollectorLogSink: nsJSIID<nsICycleCollectorLogSink>;
    nsICycleCollectorListener: nsJSIID<nsICycleCollectorListener>;
    nsIDebug2: nsJSIID<nsIDebug2>;
    nsIStackFrame: nsJSIID<nsIStackFrame>;
    nsIException: nsJSIID<nsIException>;
    nsIInterfaceRequestor: nsJSIID<nsIInterfaceRequestor>;
    nsIFinishDumpingCallback: nsJSIID<nsIFinishDumpingCallback>;
    nsIDumpGCAndCCLogsCallback: nsJSIID<nsIDumpGCAndCCLogsCallback>;
    nsIMemoryInfoDumper: nsJSIID<nsIMemoryInfoDumper>;
    nsIHandleReportCallback: nsJSIID<nsIHandleReportCallback>;
    nsIMemoryReporter: nsJSIID<nsIMemoryReporter>;
    nsIFinishReportingCallback: nsJSIID<nsIFinishReportingCallback>;
    nsIHeapAllocatedCallback: nsJSIID<nsIHeapAllocatedCallback>;
    nsIMemoryReporterManager: nsJSIID<nsIMemoryReporterManager>;
    nsISupports: nsJSIID<nsISupports>;
    nsIUUIDGenerator: nsJSIID<nsIUUIDGenerator>;
    nsIVersionComparator: nsJSIID<nsIVersionComparator>;
    nsIWeakReference: nsJSIID<nsIWeakReference>;
    nsISupportsWeakReference: nsJSIID<nsISupportsWeakReference>;
    nsICategoryEntry: nsJSIID<nsICategoryEntry>;
    nsICategoryManager: nsJSIID<nsICategoryManager>;
    nsIClassInfo: nsJSIID<nsIClassInfo>;
    nsIComponentManager: nsJSIID<nsIComponentManager>;
    nsIComponentRegistrar: nsJSIID<nsIComponentRegistrar>;
    nsIFactory: nsJSIID<nsIFactory>;
    nsIServiceManager: nsJSIID<nsIServiceManager>;
    nsIArray: nsJSIID<nsIArray>;
    nsIArrayExtensions: nsJSIID<nsIArrayExtensions>;
    nsIINIParser: nsJSIID<nsIINIParser>;
    nsIINIParserWriter: nsJSIID<nsIINIParserWriter>;
    nsIINIParserFactory: nsJSIID<nsIINIParserFactory>;
    nsIMutableArray: nsJSIID<nsIMutableArray>;
    nsIObserver: nsJSIID<nsIObserver>;
    nsIObserverService: nsJSIID<nsIObserverService>;
    nsIPropertyElement: nsJSIID<nsIPropertyElement>;
    nsIPersistentProperties: nsJSIID<nsIPersistentProperties>;
    nsIProperties: nsJSIID<nsIProperties>;
    nsIProperty: nsJSIID<nsIProperty>;
    nsIPropertyBag: nsJSIID<nsIPropertyBag>;
    nsIPropertyBag2: nsJSIID<nsIPropertyBag2>;
    nsISerializable: nsJSIID<nsISerializable>;
    nsIJSEnumerator: nsJSIID<nsIJSEnumerator>;
    nsISimpleEnumeratorBase: nsJSIID<nsISimpleEnumeratorBase>;
    nsISimpleEnumerator: nsJSIID<nsISimpleEnumerator>;
    nsIStringEnumeratorBase: nsJSIID<nsIStringEnumeratorBase>;
    nsIStringEnumerator: nsJSIID<nsIStringEnumerator>;
    nsIUTF8StringEnumerator: nsJSIID<nsIUTF8StringEnumerator>;
    nsIOutputIterator: nsJSIID<nsIOutputIterator>;
    nsIInputIterator: nsJSIID<nsIInputIterator>;
    nsIForwardIterator: nsJSIID<nsIForwardIterator>;
    nsIBidirectionalIterator: nsJSIID<nsIBidirectionalIterator>;
    nsIRandomAccessIterator: nsJSIID<nsIRandomAccessIterator>;
    nsISupportsPrimitive: nsJSIID<nsISupportsPrimitive>;
    nsISupportsID: nsJSIID<nsISupportsID>;
    nsISupportsCString: nsJSIID<nsISupportsCString>;
    nsISupportsString: nsJSIID<nsISupportsString>;
    nsISupportsPRBool: nsJSIID<nsISupportsPRBool>;
    nsISupportsPRUint8: nsJSIID<nsISupportsPRUint8>;
    nsISupportsPRUint16: nsJSIID<nsISupportsPRUint16>;
    nsISupportsPRUint32: nsJSIID<nsISupportsPRUint32>;
    nsISupportsPRUint64: nsJSIID<nsISupportsPRUint64>;
    nsISupportsPRTime: nsJSIID<nsISupportsPRTime>;
    nsISupportsChar: nsJSIID<nsISupportsChar>;
    nsISupportsPRInt16: nsJSIID<nsISupportsPRInt16>;
    nsISupportsPRInt32: nsJSIID<nsISupportsPRInt32>;
    nsISupportsPRInt64: nsJSIID<nsISupportsPRInt64>;
    nsISupportsFloat: nsJSIID<nsISupportsFloat>;
    nsISupportsDouble: nsJSIID<nsISupportsDouble>;
    nsISupportsInterfacePointer: nsJSIID<nsISupportsInterfacePointer>;
    nsIVariant: nsJSIID<nsIVariant>;
    nsIWritableVariant: nsJSIID<nsIWritableVariant>;
    nsIWritablePropertyBag: nsJSIID<nsIWritablePropertyBag>;
    nsIWritablePropertyBag2: nsJSIID<nsIWritablePropertyBag2>;
    nsIAsyncInputStream: nsJSIID<nsIAsyncInputStream>;
    nsIInputStreamCallback: nsJSIID<nsIInputStreamCallback>;
    nsIAsyncOutputStream: nsJSIID<nsIAsyncOutputStream>;
    nsIOutputStreamCallback: nsJSIID<nsIOutputStreamCallback>;
    nsIBinaryInputStream: nsJSIID<nsIBinaryInputStream>;
    nsIBinaryOutputStream: nsJSIID<nsIBinaryOutputStream>;
    nsICloneableInputStream: nsJSIID<nsICloneableInputStream>;
    nsICloneableInputStreamWithRange: nsJSIID<nsICloneableInputStreamWithRange>;
    nsIConverterInputStream: nsJSIID<nsIConverterInputStream>;
    nsIConverterOutputStream: nsJSIID<nsIConverterOutputStream>;
    nsIDirectoryEnumerator: nsJSIID<nsIDirectoryEnumerator>;
    nsIDirectoryServiceProvider: nsJSIID<nsIDirectoryServiceProvider>;
    nsIDirectoryServiceProvider2: nsJSIID<nsIDirectoryServiceProvider2>;
    nsIDirectoryService: nsJSIID<nsIDirectoryService>;
    nsIFile: nsJSIID<nsIFile>;
    nsIIOUtil: nsJSIID<nsIIOUtil>;
    nsIInputStream: nsJSIID<nsIInputStream>;
    nsIInputStreamPriority: nsJSIID<nsIInputStreamPriority>;
    nsIInputStreamTee: nsJSIID<nsIInputStreamTee>;
    nsILineInputStream: nsJSIID<nsILineInputStream>;
    nsILocalFileWin: nsJSIID<nsILocalFileWin>;
    nsIMultiplexInputStream: nsJSIID<nsIMultiplexInputStream>;
    nsIObjectInputStream: nsJSIID<nsIObjectInputStream>;
    nsIObjectOutputStream: nsJSIID<nsIObjectOutputStream>;
    nsIOutputStream: nsJSIID<nsIOutputStream>;
    nsIPipe: nsJSIID<nsIPipe>;
    nsISearchableInputStream: nsJSIID<nsISearchableInputStream>;
    nsIRandomAccessStream: nsJSIID<nsIRandomAccessStream>;
    nsISafeOutputStream: nsJSIID<nsISafeOutputStream>;
    nsIScriptableBase64Encoder: nsJSIID<nsIScriptableBase64Encoder>;
    nsIScriptableInputStream: nsJSIID<nsIScriptableInputStream>;
    nsISeekableStream: nsJSIID<nsISeekableStream>;
    nsIStorageStream: nsJSIID<nsIStorageStream>;
    nsIStreamBufferAccess: nsJSIID<nsIStreamBufferAccess>;
    nsIStringInputStream: nsJSIID<nsIStringInputStream>;
    nsITellableStream: nsJSIID<nsITellableStream>;
    nsIUnicharInputStream: nsJSIID<nsIUnicharInputStream>;
    nsIUnicharLineInputStream: nsJSIID<nsIUnicharLineInputStream>;
    nsIUnicharOutputStream: nsJSIID<nsIUnicharOutputStream>;
    nsIBlocklistService: nsJSIID<nsIBlocklistService>;
    nsICrashReporter: nsJSIID<nsICrashReporter>;
    nsIDeviceSensorData: nsJSIID<nsIDeviceSensorData>;
    nsIDeviceSensors: nsJSIID<nsIDeviceSensors>;
    nsIGIOHandlerApp: nsJSIID<nsIGIOHandlerApp>;
    nsIGIOMimeApp: nsJSIID<nsIGIOMimeApp>;
    nsIGIOService: nsJSIID<nsIGIOService>;
    nsIGSettingsCollection: nsJSIID<nsIGSettingsCollection>;
    nsIGSettingsService: nsJSIID<nsIGSettingsService>;
    nsIGeolocationUpdate: nsJSIID<nsIGeolocationUpdate>;
    nsIGeolocationProvider: nsJSIID<nsIGeolocationProvider>;
    nsIHapticFeedback: nsJSIID<nsIHapticFeedback>;
    nsIPlatformInfo: nsJSIID<nsIPlatformInfo>;
    nsISystemInfo: nsJSIID<nsISystemInfo>;
    nsIXULAppInfo: nsJSIID<nsIXULAppInfo>;
    nsIXULRuntime: nsJSIID<
      nsIXULRuntime,
      typeof nsIXULRuntime_ExperimentStatus &
        typeof nsIXULRuntime_ContentWin32kLockdownState &
        typeof nsIXULRuntime_FissionDecisionStatus
    >;
    nsIEnvironment: nsJSIID<nsIEnvironment>;
    nsIEventTarget: nsJSIID<nsIEventTarget>;
    nsINamed: nsJSIID<nsINamed>;
    nsIProcess: nsJSIID<nsIProcess>;
    nsIRunnable: nsJSIID<nsIRunnable>;
    nsIRunnablePriority: nsJSIID<nsIRunnablePriority>;
    nsISerialEventTarget: nsJSIID<nsISerialEventTarget>;
    nsISupportsPriority: nsJSIID<nsISupportsPriority>;
    nsIThread: nsJSIID<nsIThread, typeof nsIThread_QoSPriority>;
    nsINestedEventLoopCondition: nsJSIID<nsINestedEventLoopCondition>;
    nsIThreadManager: nsJSIID<nsIThreadManager>;
    nsIThreadShutdown: nsJSIID<nsIThreadShutdown>;
    nsITimerCallback: nsJSIID<nsITimerCallback>;
    nsITimer: nsJSIID<nsITimer>;
    nsITimerManager: nsJSIID<nsITimerManager>;
    nsIScriptableOK: nsJSIID<nsIScriptableOK>;
    nsIScriptableWithNotXPCOM: nsJSIID<nsIScriptableWithNotXPCOM>;
    mozIJSSubScriptLoader: nsJSIID<mozIJSSubScriptLoader>;
    xpcIJSWeakReference: nsJSIID<xpcIJSWeakReference>;
    nsIXPCComponents_Classes: nsJSIID<nsIXPCComponents_Classes>;
    nsIXPCComponents_Results: nsJSIID<nsIXPCComponents_Results>;
    nsIXPCComponents_ID: nsJSIID<nsIXPCComponents_ID>;
    nsIXPCComponents_Exception: nsJSIID<nsIXPCComponents_Exception>;
    nsIXPCComponents_Constructor: nsJSIID<nsIXPCComponents_Constructor>;
    nsIXPCComponents_utils_Sandbox: nsJSIID<nsIXPCComponents_utils_Sandbox>;
    nsIScheduledGCCallback: nsJSIID<nsIScheduledGCCallback>;
    nsIXPCComponents_Utils: nsJSIID<nsIXPCComponents_Utils>;
    nsIXPCComponents: nsJSIID<nsIXPCComponents>;
    nsIXPCTestObjectReadOnly: nsJSIID<nsIXPCTestObjectReadOnly>;
    nsIXPCTestObjectReadWrite: nsJSIID<nsIXPCTestObjectReadWrite>;
    nsIXPCTestBug809674: nsJSIID<nsIXPCTestBug809674>;
    nsIXPCTestCEnums: nsJSIID<
      nsIXPCTestCEnums,
      typeof nsIXPCTestCEnums_testFlagsExplicit & typeof nsIXPCTestCEnums_testFlagsImplicit
    >;
    nsIXPCTestInterfaceA: nsJSIID<nsIXPCTestInterfaceA>;
    nsIXPCTestInterfaceB: nsJSIID<nsIXPCTestInterfaceB>;
    nsIXPCTestInterfaceC: nsJSIID<nsIXPCTestInterfaceC>;
    nsIXPCTestParams: nsJSIID<nsIXPCTestParams>;
    nsIXPCTestReturnCodeParent: nsJSIID<nsIXPCTestReturnCodeParent>;
    nsIXPCTestReturnCodeChild: nsJSIID<nsIXPCTestReturnCodeChild>;
    nsIXPCTestFunctionInterface: nsJSIID<nsIXPCTestFunctionInterface>;
    nsIXPCTestUtils: nsJSIID<nsIXPCTestUtils>;
    nsIXPCTestTypeScript: nsJSIID<nsIXPCTestTypeScript>;
    nsIBrowserController: nsJSIID<nsIBrowserController>;
    nsIController: nsJSIID<nsIController>;
    nsICommandController: nsJSIID<nsICommandController>;
    nsIControllers: nsJSIID<nsIControllers>;
    nsINativeAppSupport: nsJSIID<nsINativeAppSupport>;
    nsIXREDirProvider: nsJSIID<nsIXREDirProvider>;
    nsIZipWriter: nsJSIID<nsIZipWriter>;
  }
} // global

// Typedefs from xpidl.
type AccessibleTextBoundary = i32;
type AppTrustedRoot = u32;
type COSEAlgorithmIdentifier = i32;
type CSPDirective = nsIContentSecurityPolicy.CSPDirective;
type DOMHighResTimeStamp = double;
type DOMTimeStamp = u64;
type EpochTimeStamp = u64;
type PRTime = i64;
type PivotMoveReason = i16;
type PredictorLearnReason = u32;
type PredictorPredictReason = u32;
type RequireTrustedTypesForDirectiveState =
  nsIContentSecurityPolicy.RequireTrustedTypesForDirectiveState;
type nsBitsErrorAction = i32;
type nsBitsErrorStage = i32;
type nsBitsErrorType = i32;
type nsContentPolicyType = nsIContentPolicy.nsContentPolicyType;
type nsCookieAccess = i32;
type nsCookiePolicy = i32;
type nsCookieStatus = i32;
type nsHandlerInfoAction = i32;
type nsLoadFlags = u32;
type nsProxyUsage = i32;
type nsSecurityFlags = u32;
type nsServerSocketFlag = u32;
type nsSuspendedTypes = u32;
type nsViewID = u64;

// XPCOM internal utility types.

/** XPCOM inout param is passed in as a js object with a value property. */
type InOutParam<T> = { value: T };

/** XPCOM out param is written to the passed in object's value property. */
type OutParam<T> = { value?: T };

/** Enable interfaces to inherit from enums: pick variants as optional. */
type Enums<enums> = Partial<Pick<enums, keyof enums>>;

/** Callable accepts either form of a [function] interface. */
type Callable<iface> = iface | Extract<iface[keyof iface], Function>;

export {};
