// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
/**
 * NOTE: Do not modify this file by hand.
 * Content was generated from xpc.msg and error_list.json.
 * If you're updating some of the sources, see README for instructions.
 */

interface nsIXPCComponents_Results {
  // Error Message definitions.

  // xpconnect specific codes (from nsIXPConnect.h)

  /** Not enough arguments */
  NS_ERROR_XPC_NOT_ENOUGH_ARGS: 0x80570001;

  /** 'Out' argument must be an object */
  NS_ERROR_XPC_NEED_OUT_OBJECT: 0x80570002;

  /** Cannot set 'value' property of 'out' argument */
  NS_ERROR_XPC_CANT_SET_OUT_VAL: 0x80570003;

  /** Component returned failure code: */
  NS_ERROR_XPC_NATIVE_RETURNED_FAILURE: 0x80570004;

  /** Cannot find interface information */
  NS_ERROR_XPC_CANT_GET_INTERFACE_INFO: 0x80570005;

  /** Cannot find interface information for parameter */
  NS_ERROR_XPC_CANT_GET_PARAM_IFACE_INFO: 0x80570006;

  /** Cannot find method information */
  NS_ERROR_XPC_CANT_GET_METHOD_INFO: 0x80570007;

  /** Unexpected error in XPConnect */
  NS_ERROR_XPC_UNEXPECTED: 0x80570008;

  /** Could not convert JavaScript argument */
  NS_ERROR_XPC_BAD_CONVERT_JS: 0x80570009;

  /** Could not convert Native argument */
  NS_ERROR_XPC_BAD_CONVERT_NATIVE: 0x8057000a;

  /** Could not convert JavaScript argument (NULL value cannot be used for a C++ reference type) */
  NS_ERROR_XPC_BAD_CONVERT_JS_NULL_REF: 0x8057000b;

  /** Illegal operation on WrappedNative prototype object */
  NS_ERROR_XPC_BAD_OP_ON_WN_PROTO: 0x8057000c;

  /** Cannot convert WrappedNative to function */
  NS_ERROR_XPC_CANT_CONVERT_WN_TO_FUN: 0x8057000d;

  /** Cannot define new property in a WrappedNative */
  NS_ERROR_XPC_CANT_DEFINE_PROP_ON_WN: 0x8057000e;

  /** Cannot place watchpoints on WrappedNative object static properties */
  NS_ERROR_XPC_CANT_WATCH_WN_STATIC: 0x8057000f;

  /** Cannot export a WrappedNative object's static properties */
  NS_ERROR_XPC_CANT_EXPORT_WN_STATIC: 0x80570010;

  /** nsIXPCScriptable::Call failed */
  NS_ERROR_XPC_SCRIPTABLE_CALL_FAILED: 0x80570011;

  /** nsIXPCScriptable::Construct failed */
  NS_ERROR_XPC_SCRIPTABLE_CTOR_FAILED: 0x80570012;

  /** Cannot use wrapper as function unless it implements nsIXPCScriptable */
  NS_ERROR_XPC_CANT_CALL_WO_SCRIPTABLE: 0x80570013;

  /** Cannot use wrapper as constructor unless it implements nsIXPCScriptable */
  NS_ERROR_XPC_CANT_CTOR_WO_SCRIPTABLE: 0x80570014;

  /** ComponentManager::CreateInstance returned failure code: */
  NS_ERROR_XPC_CI_RETURNED_FAILURE: 0x80570015;

  /** ServiceManager::GetService returned failure code: */
  NS_ERROR_XPC_GS_RETURNED_FAILURE: 0x80570016;

  /** Invalid ClassID or ContractID */
  NS_ERROR_XPC_BAD_CID: 0x80570017;

  /** Invalid InterfaceID */
  NS_ERROR_XPC_BAD_IID: 0x80570018;

  /** Cannot create wrapper around native interface */
  NS_ERROR_XPC_CANT_CREATE_WN: 0x80570019;

  /** JavaScript component threw exception */
  NS_ERROR_XPC_JS_THREW_EXCEPTION: 0x8057001a;

  /** JavaScript component threw a native object that is not an exception */
  NS_ERROR_XPC_JS_THREW_NATIVE_OBJECT: 0x8057001b;

  /** JavaScript component threw a JavaScript object */
  NS_ERROR_XPC_JS_THREW_JS_OBJECT: 0x8057001c;

  /** JavaScript component threw a null value as an exception */
  NS_ERROR_XPC_JS_THREW_NULL: 0x8057001d;

  /** JavaScript component threw a string as an exception */
  NS_ERROR_XPC_JS_THREW_STRING: 0x8057001e;

  /** JavaScript component threw a number as an exception */
  NS_ERROR_XPC_JS_THREW_NUMBER: 0x8057001f;

  /** JavaScript component caused a JavaScript error */
  NS_ERROR_XPC_JAVASCRIPT_ERROR: 0x80570020;

  /** JavaScript component caused a JavaScript error (detailed report attached) */
  NS_ERROR_XPC_JAVASCRIPT_ERROR_WITH_DETAILS: 0x80570021;

  /** Cannot convert primitive JavaScript value into an array */
  NS_ERROR_XPC_CANT_CONVERT_PRIMITIVE_TO_ARRAY: 0x80570022;

  /** Cannot convert JavaScript object into an array */
  NS_ERROR_XPC_CANT_CONVERT_OBJECT_TO_ARRAY: 0x80570023;

  /** JavaScript Array does not have as many elements as indicated by size argument */
  NS_ERROR_XPC_NOT_ENOUGH_ELEMENTS_IN_ARRAY: 0x80570024;

  /** Cannot find array information */
  NS_ERROR_XPC_CANT_GET_ARRAY_INFO: 0x80570025;

  /** JavaScript String does not have as many characters as indicated by size argument */
  NS_ERROR_XPC_NOT_ENOUGH_CHARS_IN_STRING: 0x80570026;

  /** Security Manager vetoed action */
  NS_ERROR_XPC_SECURITY_MANAGER_VETO: 0x80570027;

  /** Failed to build a wrapper because the interface that was not declared [scriptable] */
  NS_ERROR_XPC_INTERFACE_NOT_SCRIPTABLE: 0x80570028;

  /** Failed to build a wrapper because the interface does not inherit from nsISupports */
  NS_ERROR_XPC_INTERFACE_NOT_FROM_NSISUPPORTS: 0x80570029;

  /** Property is a constant and cannot be changed */
  NS_ERROR_XPC_CANT_SET_READ_ONLY_CONSTANT: 0x8057002b;

  /** Property is a read only attribute and cannot be changed */
  NS_ERROR_XPC_CANT_SET_READ_ONLY_ATTRIBUTE: 0x8057002c;

  /** Property is an interface method and cannot be changed */
  NS_ERROR_XPC_CANT_SET_READ_ONLY_METHOD: 0x8057002d;

  /** Cannot add property to WrappedNative object */
  NS_ERROR_XPC_CANT_ADD_PROP_TO_WRAPPED_NATIVE: 0x8057002e;

  /** Call to nsIXPCScriptable interface for WrappedNative failed unexpecedly */
  NS_ERROR_XPC_CALL_TO_SCRIPTABLE_FAILED: 0x8057002f;

  /** JavaScript component does not have a method named: */
  NS_ERROR_XPC_JSOBJECT_HAS_NO_FUNCTION_NAMED: 0x80570030;

  /** Bad ID string */
  NS_ERROR_XPC_BAD_ID_STRING: 0x80570031;

  /** Bad initializer name in Constructor - Component has no method with that name */
  NS_ERROR_XPC_BAD_INITIALIZER_NAME: 0x80570032;

  /** Operation failed because the XPConnect subsystem has been shutdown */
  NS_ERROR_XPC_HAS_BEEN_SHUTDOWN: 0x80570033;

  /** Cannot modify properties of a WrappedNative */
  NS_ERROR_XPC_CANT_MODIFY_PROP_ON_WN: 0x80570034;

  /** Could not convert JavaScript argument - 0 was passed, expected object. Did you mean null? */
  NS_ERROR_XPC_BAD_CONVERT_JS_ZERO_ISNOT_NULL: 0x80570035;

  // common global codes (from nsError.h)

  /** Success */
  NS_OK: 0x0;

  /** Component not initialized */
  NS_ERROR_NOT_INITIALIZED: 0xc1f30001;

  /** Component already initialized */
  NS_ERROR_ALREADY_INITIALIZED: 0xc1f30002;

  /** Method not implemented */
  NS_ERROR_NOT_IMPLEMENTED: 0x80004001;

  /** Component does not have requested interface */
  NS_NOINTERFACE: 0x80004002;

  /** Component does not have requested interface */
  NS_ERROR_NO_INTERFACE: 0x80004002;

  /** Illegal value */
  NS_ERROR_ILLEGAL_VALUE: 0x80070057;

  /** Invalid pointer */
  NS_ERROR_INVALID_POINTER: 0x80070057;

  /** Null pointer */
  NS_ERROR_NULL_POINTER: 0x80070057;

  /** Abort */
  NS_ERROR_ABORT: 0x80004004;

  /** Failure */
  NS_ERROR_FAILURE: 0x80004005;

  /** Unexpected error */
  NS_ERROR_UNEXPECTED: 0x8000ffff;

  /** Out of Memory */
  NS_ERROR_OUT_OF_MEMORY: 0x8007000e;

  /** Invalid argument */
  NS_ERROR_INVALID_ARG: 0x80070057;

  /** Component is not available */
  NS_ERROR_NOT_AVAILABLE: 0x80040111;

  /** Factory not registered */
  NS_ERROR_FACTORY_NOT_REGISTERED: 0x80040154;

  /** Factory not registered (may be tried again) */
  NS_ERROR_FACTORY_REGISTER_AGAIN: 0x80040155;

  /** Factory not loaded */
  NS_ERROR_FACTORY_NOT_LOADED: 0x800401f8;

  /** Factory does not support signatures */
  NS_ERROR_FACTORY_NO_SIGNATURE_SUPPORT: 0xc1f30101;

  /** Factory already exists */
  NS_ERROR_FACTORY_EXISTS: 0xc1f30100;

  // added from nsError.h on Feb 28 2001...

  /** Stream closed */
  NS_BASE_STREAM_CLOSED: 0x80470002;

  /** Error from the operating system */
  NS_BASE_STREAM_OSERROR: 0x80470003;

  /** Illegal arguments */
  NS_BASE_STREAM_ILLEGAL_ARGS: 0x80470004;

  /** No converter for unichar streams */
  NS_BASE_STREAM_NO_CONVERTER: 0x80470005;

  /** Bad converter for unichar streams */
  NS_BASE_STREAM_BAD_CONVERSION: 0x80470006;

  /** Stream would block */
  NS_BASE_STREAM_WOULD_BLOCK: 0x80470007;

  /** File error: Unrecognized path */
  NS_ERROR_FILE_UNRECOGNIZED_PATH: 0x80520001;

  /** File error: Unresolvable symlink */
  NS_ERROR_FILE_UNRESOLVABLE_SYMLINK: 0x80520002;

  /** File error: Execution failed */
  NS_ERROR_FILE_EXECUTION_FAILED: 0x80520003;

  /** File error: Unknown type */
  NS_ERROR_FILE_UNKNOWN_TYPE: 0x80520004;

  /** File error: Destination not dir */
  NS_ERROR_FILE_DESTINATION_NOT_DIR: 0x80520005;

  /** File error: Copy or move failed */
  NS_ERROR_FILE_COPY_OR_MOVE_FAILED: 0x80520007;

  /** File error: Already exists */
  NS_ERROR_FILE_ALREADY_EXISTS: 0x80520008;

  /** File error: Invalid path */
  NS_ERROR_FILE_INVALID_PATH: 0x80520009;

  /** File error: Corrupted */
  NS_ERROR_FILE_CORRUPTED: 0x8052000b;

  /** File error: Not directory */
  NS_ERROR_FILE_NOT_DIRECTORY: 0x8052000c;

  /** File error: Is directory */
  NS_ERROR_FILE_IS_DIRECTORY: 0x8052000d;

  /** File error: Is locked */
  NS_ERROR_FILE_IS_LOCKED: 0x8052000e;

  /** File error: Too big */
  NS_ERROR_FILE_TOO_BIG: 0x8052000f;

  /** File error: No device space */
  NS_ERROR_FILE_NO_DEVICE_SPACE: 0x80520010;

  /** File error: Name too long */
  NS_ERROR_FILE_NAME_TOO_LONG: 0x80520011;

  /** File error: Not found */
  NS_ERROR_FILE_NOT_FOUND: 0x80520012;

  /** File error: Read only */
  NS_ERROR_FILE_READ_ONLY: 0x80520013;

  /** File error: Dir not empty */
  NS_ERROR_FILE_DIR_NOT_EMPTY: 0x80520014;

  /** File error: Access denied */
  NS_ERROR_FILE_ACCESS_DENIED: 0x80520015;

  // added from nsError.h on Sept 6 2001...

  /** Data conversion error */
  NS_ERROR_CANNOT_CONVERT_DATA: 0x80460001;

  /** Can not modify immutable data container */
  NS_ERROR_OBJECT_IS_IMMUTABLE: 0x80460002;

  /** Data conversion failed because significant data would be lost */
  NS_ERROR_LOSS_OF_SIGNIFICANT_DATA: 0x80460003;

  /** Data conversion succeeded but data was rounded to fit */
  NS_SUCCESS_LOSS_OF_INSIGNIFICANT_DATA: 0x460001;

  // network related codes (from nsNetError.h)

  /** The async request failed for some unknown reason */
  NS_BINDING_FAILED: 0x804b0001;

  /** The async request failed because it was aborted by some user action */
  NS_BINDING_ABORTED: 0x804b0002;

  /** The async request has been redirected to a different async request */
  NS_BINDING_REDIRECTED: 0x804b0003;

  /** The async request has been retargeted to a different handler */
  NS_BINDING_RETARGETED: 0x804b0004;

  /** The URI is malformed */
  NS_ERROR_MALFORMED_URI: 0x804b000a;

  /** The URI scheme corresponds to an unknown protocol handler */
  NS_ERROR_UNKNOWN_PROTOCOL: 0x804b0012;

  /** Channel opened successfully but no data will be returned */
  NS_ERROR_NO_CONTENT: 0x804b0011;

  /** The requested action could not be completed while the object is busy */
  NS_ERROR_IN_PROGRESS: 0x804b000f;

  /** Channel is already open */
  NS_ERROR_ALREADY_OPENED: 0x804b0049;

  /** The content encoding of the source document is incorrect */
  NS_ERROR_INVALID_CONTENT_ENCODING: 0x804b001b;

  /** Corrupted content received from server (potentially MIME type mismatch because of 'X-Content-Type-Options: nosniff') */
  NS_ERROR_CORRUPTED_CONTENT: 0x804b001d;

  /** Couldn't extract first component from potentially corrupted header field */
  NS_ERROR_FIRST_HEADER_FIELD_COMPONENT_EMPTY: 0x804b0022;

  /** The connection is already established */
  NS_ERROR_ALREADY_CONNECTED: 0x804b000b;

  /** The connection does not exist */
  NS_ERROR_NOT_CONNECTED: 0x804b000c;

  /** The connection was refused */
  NS_ERROR_CONNECTION_REFUSED: 0x804b000d;

  /** User refused navigation to potentially unsafe URL with embedded credentials/superfluos authentication */
  NS_ERROR_SUPERFLUOS_AUTH: 0x804b005b;

  /** User attempted basic HTTP authentication when it is disabled */
  NS_ERROR_BASIC_HTTP_AUTH_DISABLED: 0x804b005c;

  // Error codes return from the proxy

  /** The connection to the proxy server was refused */
  NS_ERROR_PROXY_CONNECTION_REFUSED: 0x804b0048;

  /** The proxy requires authentication */
  NS_ERROR_PROXY_AUTHENTICATION_FAILED: 0x804b057f;

  /** The request failed on the proxy */
  NS_ERROR_PROXY_BAD_GATEWAY: 0x804b05de;

  /** The request timed out on the proxy */
  NS_ERROR_PROXY_GATEWAY_TIMEOUT: 0x804b05e0;

  /** Sending too many requests to a proxy */
  NS_ERROR_PROXY_TOO_MANY_REQUESTS: 0x804b0595;

  /** The proxy does not support the version of the HTTP request */
  NS_ERROR_PROXY_VERSION_NOT_SUPPORTED: 0x804b05e1;

  /** The user is banned from the proxy */
  NS_ERROR_PROXY_FORBIDDEN: 0x804b057b;

  /** The proxy is not available */
  NS_ERROR_PROXY_SERVICE_UNAVAILABLE: 0x804b05df;

  /** The desired destination is unavailable for legal reasons */
  NS_ERROR_PROXY_UNAVAILABLE_FOR_LEGAL_REASONS: 0x804b05ab;

  /** The connection has timed out */
  NS_ERROR_NET_TIMEOUT: 0x804b000e;

  /** The request has been cancelled because of a timeout */
  NS_ERROR_NET_TIMEOUT_EXTERNAL: 0x804b0055;

  /** The requested action could not be completed in the offline state */
  NS_ERROR_OFFLINE: 0x804b0010;

  /** Establishing a connection to an unsafe or otherwise banned port was prohibited */
  NS_ERROR_PORT_ACCESS_NOT_ALLOWED: 0x804b0013;

  /** The connection was established, but no data was ever received */
  NS_ERROR_NET_RESET: 0x804b0014;

  /** The connection was established, but the browser received an empty page with an error response */
  NS_ERROR_NET_EMPTY_RESPONSE: 0x804b0024;

  /** The connection was established, but the browser received an error response from the server */
  NS_ERROR_NET_ERROR_RESPONSE: 0x804b0023;

  /** The connection was established, but the data transfer was interrupted */
  NS_ERROR_NET_INTERRUPT: 0x804b0047;

  /** A transfer was only partially done when it completed */
  NS_ERROR_NET_PARTIAL_TRANSFER: 0x804b004c;

  /** There has been a http3 protocol error */
  NS_ERROR_NET_HTTP3_PROTOCOL_ERROR: 0x804b0054;

  /** This request is not resumable, but it was tried to resume it, or to request resume-specific data */
  NS_ERROR_NOT_RESUMABLE: 0x804b0019;

  /** It was attempted to resume the request, but the entity has changed in the meantime */
  NS_ERROR_ENTITY_CHANGED: 0x804b0020;

  /** The request failed as a result of a detected redirection loop */
  NS_ERROR_REDIRECT_LOOP: 0x804b001f;

  /** The request failed because the content type returned by the server was not a type expected by the channel */
  NS_ERROR_UNSAFE_CONTENT_TYPE: 0x804b004a;

  /** The load caused an error page to be displayed. */
  NS_ERROR_LOAD_SHOWED_ERRORPAGE: 0x804b004d;

  /** The request was blocked by a policy set by the system administrator. */
  NS_ERROR_BLOCKED_BY_POLICY: 0x80780003;

  /** The lookup of the hostname failed */
  NS_ERROR_UNKNOWN_HOST: 0x804b001e;

  /** The DNS lookup queue is full */
  NS_ERROR_DNS_LOOKUP_QUEUE_FULL: 0x804b0021;

  /** The lookup of the proxy hostname failed */
  NS_ERROR_UNKNOWN_PROXY_HOST: 0x804b002a;

  /** The specified socket type does not exist */
  NS_ERROR_UNKNOWN_SOCKET_TYPE: 0x804b0033;

  /** The specified socket type could not be created */
  NS_ERROR_SOCKET_CREATE_FAILED: 0x804b0034;

  /** The specified socket address type is not supported */
  NS_ERROR_SOCKET_ADDRESS_NOT_SUPPORTED: 0x804b0035;

  /** Some other socket is already using the specified address. */
  NS_ERROR_SOCKET_ADDRESS_IN_USE: 0x804b0036;

  /** Cache key could not be found */
  NS_ERROR_CACHE_KEY_NOT_FOUND: 0x804b003d;

  /** Cache data is a stream */
  NS_ERROR_CACHE_DATA_IS_STREAM: 0x804b003e;

  /** Cache data is not a stream */
  NS_ERROR_CACHE_DATA_IS_NOT_STREAM: 0x804b003f;

  /** Cache entry exists but needs to be validated first */
  NS_ERROR_CACHE_WAIT_FOR_VALIDATION: 0x804b0040;

  /** Cache entry has been  doomed */
  NS_ERROR_CACHE_ENTRY_DOOMED: 0x804b0041;

  /** Read access to cache denied */
  NS_ERROR_CACHE_READ_ACCESS_DENIED: 0x804b0042;

  /** Write access to cache denied */
  NS_ERROR_CACHE_WRITE_ACCESS_DENIED: 0x804b0043;

  /** Cache is currently in use */
  NS_ERROR_CACHE_IN_USE: 0x804b0044;

  /** Document does not exist in cache */
  NS_ERROR_DOCUMENT_NOT_CACHED: 0x804b0046;

  /** The requested number of domain levels exceeds those present in the host string */
  NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS: 0x804b0050;

  /** The host string is an IP address */
  NS_ERROR_HOST_IS_IP_ADDRESS: 0x804b0051;

  /** Can't access a wrapped JS object from a different thread */
  NS_ERROR_NOT_SAME_THREAD: 0x80460004;

  // storage related codes (from mozStorage.h)

  /** SQLite database connection is busy */
  NS_ERROR_STORAGE_BUSY: 0x80630001;

  /** SQLite encountered an IO error */
  NS_ERROR_STORAGE_IOERR: 0x80630002;

  /** SQLite database operation failed because a constraint was violated */
  NS_ERROR_STORAGE_CONSTRAINT: 0x80630003;

  // plugin related codes (from nsPluginError.h)

  /** Clearing site data by time range not supported by plugin */
  NS_ERROR_PLUGIN_TIME_RANGE_NOT_SUPPORTED: 0x804c03eb;

  // character converter related codes

  /** The input characters have illegal sequences */
  NS_ERROR_ILLEGAL_INPUT: 0x8050000e;

  // Codes related to signd jars

  /** The JAR is not signed. */
  NS_ERROR_SIGNED_JAR_NOT_SIGNED: 0x80680001;

  /** An entry in the JAR has been modified after the JAR was signed. */
  NS_ERROR_SIGNED_JAR_MODIFIED_ENTRY: 0x80680002;

  /** An entry in the JAR has not been signed. */
  NS_ERROR_SIGNED_JAR_UNSIGNED_ENTRY: 0x80680003;

  /** An entry is missing from the JAR file. */
  NS_ERROR_SIGNED_JAR_ENTRY_MISSING: 0x80680004;

  /** The JAR's signature is wrong. */
  NS_ERROR_SIGNED_JAR_WRONG_SIGNATURE: 0x80680005;

  /** An entry in the JAR is too large. */
  NS_ERROR_SIGNED_JAR_ENTRY_TOO_LARGE: 0x80680006;

  /** An entry in the JAR is invalid. */
  NS_ERROR_SIGNED_JAR_ENTRY_INVALID: 0x80680007;

  /** The JAR's manifest or signature file is invalid. */
  NS_ERROR_SIGNED_JAR_MANIFEST_INVALID: 0x80680008;

  /** The PKCS#7 signature is malformed or invalid. */
  NS_ERROR_CMS_VERIFY_NO_CONTENT_INFO: 0x805a0401;

  /** The PKCS#7 information is not signed. */
  NS_ERROR_CMS_VERIFY_NOT_SIGNED: 0x805a0400;

  // Codes related to signed manifests

  /** The signed app manifest or signature file is invalid. */
  NS_ERROR_SIGNED_APP_MANIFEST_INVALID: 0x806b0001;

  // Codes for printing-related errors.

  /** No printers available. */
  NS_ERROR_GFX_PRINTER_NO_PRINTER_AVAILABLE: 0x80480001;

  /** The selected printer could not be found. */
  NS_ERROR_GFX_PRINTER_NAME_NOT_FOUND: 0x80480002;

  /** Failed to open output file for print to file. */
  NS_ERROR_GFX_PRINTER_COULD_NOT_OPEN_FILE: 0x80480003;

  /** Printing failed while starting the print job. */
  NS_ERROR_GFX_PRINTER_STARTDOC: 0x80480004;

  /** Printing failed while completing the print job. */
  NS_ERROR_GFX_PRINTER_ENDDOC: 0x80480005;

  /** Printing failed while starting a new page. */
  NS_ERROR_GFX_PRINTER_STARTPAGE: 0x80480006;

  /** Cannot print this document yet, it is still being loaded. */
  NS_ERROR_GFX_PRINTER_DOC_IS_BUSY: 0x80480007;

  // Codes related to content

  /** The process that hosted this content has crashed. */
  NS_ERROR_CONTENT_CRASHED: 0x805e0010;

  /** The process that hosted this frame has crashed. */
  NS_ERROR_FRAME_CRASHED: 0x805e000e;

  /** The process that hosted this content did not have the same buildID as the parent. */
  NS_ERROR_BUILDID_MISMATCH: 0x805e0011;

  /** The load for this content was blocked. */
  NS_ERROR_CONTENT_BLOCKED: 0x805e0006;

  // Codes for the JS-implemented Push DOM API. These can be removed as part of bug 1252660.

  /** Invalid raw ECDSA P-256 public key. */
  NS_ERROR_DOM_PUSH_INVALID_KEY_ERR: 0x806d0005;

  /** A subscription with a different application server key already exists. */
  NS_ERROR_DOM_PUSH_MISMATCHED_KEY_ERR: 0x806d0006;

  // Codes defined in WebIDL https://heycam.github.io/webidl/#idl-DOMException-error-names

  /** The object can not be found here. */
  NS_ERROR_DOM_NOT_FOUND_ERR: 0x80530008;

  /** The request is not allowed. */
  NS_ERROR_DOM_NOT_ALLOWED_ERR: 0x80530021;

  // Codes related to the URIClassifier service

  /** The URI is malware */
  NS_ERROR_MALWARE_URI: 0x805d001e;

  /** The URI is phishing */
  NS_ERROR_PHISHING_URI: 0x805d001f;

  /** The URI is tracking */
  NS_ERROR_TRACKING_URI: 0x805d0022;

  /** The URI is unwanted */
  NS_ERROR_UNWANTED_URI: 0x805d0023;

  /** The URI is blocked */
  NS_ERROR_BLOCKED_URI: 0x805d0025;

  /** The URI is harmful */
  NS_ERROR_HARMFUL_URI: 0x805d0026;

  /** The URI is fingerprinting */
  NS_ERROR_FINGERPRINTING_URI: 0x805d0029;

  /** The URI is cryptomining */
  NS_ERROR_CRYPTOMINING_URI: 0x805d002a;

  /** The URI is social tracking */
  NS_ERROR_SOCIALTRACKING_URI: 0x805d002b;

  /** The URI is email tracking */
  NS_ERROR_EMAILTRACKING_URI: 0x805d002c;

  // Profile manager error codes

  /** Flushing the profiles to disk would have overwritten changes made elsewhere. */
  NS_ERROR_DATABASE_CHANGED: 0x805800ca;

  // Codes related to URILoader

  /** The data from a channel has already been parsed and cached so it doesn't need to be reparsed from the original source. */
  NS_ERROR_PARSED_DATA_CACHED: 0x805d0021;

  /** The async request has been cancelled by another async request */
  NS_BINDING_CANCELLED_OLD_LOAD: 0x805d0027;

  /** The ProgID classes had not been registered. */
  NS_ERROR_WDBA_NO_PROGID: 0x80720001;

  /** The existing UserChoice Hash could not be verified. */
  NS_ERROR_WDBA_HASH_CHECK: 0x80720002;

  /** UserChoice was set, but checking the default did not return our ProgID. */
  NS_ERROR_WDBA_REJECTED: 0x80720003;

  /** The existing UserChoice Hash was verified, but we're on an older, unsupported Windows build, so do not attempt to update the UserChoice hash. */
  NS_ERROR_WDBA_BUILD: 0x80720004;
}

type nsIXPCComponents_Values = nsIXPCComponents_Results[keyof nsIXPCComponents_Results];
