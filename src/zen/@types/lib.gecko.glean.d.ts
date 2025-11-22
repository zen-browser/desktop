// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
/**
 * NOTE: Do not modify this file by hand.
 * Content was generated from glean .yaml files.
 * If you're updating some of the sources, see README for instructions.
 */

interface GleanImpl {
  a11y: {
    alwaysUnderlineLinks: GleanBoolean;
    backplate: GleanBoolean;
    consumers: GleanCustomDistribution;
    hcmBackground: GleanQuantity;
    hcmForeground: GleanQuantity;
    instantiators: GleanString;
    invertColors: GleanBoolean;
    theme: Record<'always' | 'default' | 'never', GleanBoolean>;
    treeUpdateTiming: GleanTimingDistribution;
    useSystemColors: GleanBoolean;
  };

  fullscreen: {
    change: GleanTimingDistribution;
  };

  browserEngagement: {
    bookmarksToolbarBookmarkAdded: GleanCounter;
    bookmarksToolbarBookmarkOpened: GleanCounter;
    totalTopVisits: Record<'false' | 'true', GleanCounter>;
    sessionrestoreInterstitial: Record<string, GleanCounter>;
    tabExplicitUnload: GleanEventWithExtras<{
      all_tabs_unloaded?: string;
      memory_after?: string;
      memory_before?: string;
      tabs_unloaded?: string;
      time_to_unload_in_ms?: string;
      unload_selected_tab?: string;
    }>;
    tabReloadCount: GleanCounter;
    tabUnloadCount: GleanCounter;
    tabUnloadToReload: GleanTimingDistribution;
    activeTicks: GleanCounter;
    loadedTabCount: GleanCustomDistribution;
    maxConcurrentTabCount: GleanQuantity;
    maxConcurrentTabPinnedCount: GleanQuantity;
    maxConcurrentVerticalTabCount: GleanQuantity;
    maxConcurrentVerticalTabPinnedCount: GleanQuantity;
    maxConcurrentWindowCount: GleanQuantity;
    profileCount: GleanQuantity;
    tabCount: GleanCustomDistribution;
    tabOpenEventCount: GleanCounter;
    tabPinnedEventCount: GleanCounter;
    unfilteredUriCount: GleanCounter;
    uniqueDomainsCount: GleanQuantity;
    uriCount: GleanCounter;
    uriCountNormalMode: GleanCounter;
    verticalTabOpenEventCount: GleanCounter;
    verticalTabPinnedEventCount: GleanCounter;
    windowOpenEventCount: GleanCounter;
    sessionTimeExcludingSuspend: GleanQuantity;
    sessionTimeIncludingSuspend: GleanQuantity;
  };

  browserTimings: {
    newWindow: GleanTimingDistribution;
    pageLoad: GleanTimingDistribution;
    pageReloadNormal: GleanTimingDistribution;
    pageReloadSkipCache: GleanTimingDistribution;
    startupTimeline: Record<
      'blankWindowShown' | 'delayedStartupFinished' | 'delayedStartupStarted',
      GleanQuantity
    >;
    tabClick: GleanTimingDistribution;
    lastShutdown: GleanQuantity;
  };

  networking: {
    captivePortalBannerDisplayTime: Record<'abort' | 'dismiss' | 'success', GleanCounter>;
    captivePortalBannerDisplayed: GleanCounter;
    cacheMetadataFirstReadTime: GleanTimingDistribution;
    cacheMetadataSecondReadTime: GleanTimingDistribution;
    cacheMetadataSize: GleanMemoryDistribution;
    cachePurgeDueToMemoryLimit: Record<
      'cache_memory_limit' | 'meta_data_file_size_limit',
      GleanCounter
    >;
    cookieAccessFixupDiff: GleanCustomDistribution;
    cookieChipsPartitionLimitOverflow: GleanCustomDistribution;
    cookieCountPartByKey: GleanCustomDistribution;
    cookieCountPartitioned: GleanCustomDistribution;
    cookieCountTotal: GleanCustomDistribution;
    cookieCountUnpartByKey: GleanCustomDistribution;
    cookieCountUnpartitioned: GleanCustomDistribution;
    cookieCreationFixupDiff: GleanCustomDistribution;
    cookieDbValidation: Record<
      | 'eOK'
      | 'eRejectedAttributeDomainOversize'
      | 'eRejectedAttributeExpiryOversize'
      | 'eRejectedAttributePathOversize'
      | 'eRejectedEmptyNameAndValue'
      | 'eRejectedForNonSameSiteness'
      | 'eRejectedHttpOnlyButFromScript'
      | 'eRejectedInvalidCharName'
      | 'eRejectedInvalidCharValue'
      | 'eRejectedInvalidDomain'
      | 'eRejectedInvalidPath'
      | 'eRejectedInvalidPrefix'
      | 'eRejectedNameValueOversize'
      | 'eRejectedNoneRequiresSecure'
      | 'eRejectedPartitionedRequiresSecure'
      | 'eRejectedSecureButNonHttps',
      GleanCounter
    >;
    cookiePurgeEntryMax: GleanCustomDistribution;
    cookiePurgeMax: GleanCustomDistribution;
    cookieTimestampFixedCount: Record<'creationTime' | 'lastAccessed', GleanCounter>;
    dnsFailedLookupTime: GleanTimingDistribution;
    dnsLookupTime: GleanTimingDistribution;
    dnsNativeCount: Record<'https_private' | 'https_regular' | 'private' | 'regular', GleanCounter>;
    dnsNativeHttpsCallTime: GleanTimingDistribution;
    dnsRenewalTime: GleanTimingDistribution;
    dnsRenewalTimeForTtl: GleanTimingDistribution;
    fetchKeepaliveDiscardCount: Record<'per_origin_limit' | 'total_keepalive_limit', GleanCounter>;
    fetchKeepaliveRequestCount: Record<'main' | 'worker', GleanCounter>;
    http3ChannelOnstartSuccess: GleanDualLabeledCounter;
    http1DownloadThroughput: GleanCustomDistribution;
    http1DownloadThroughput100: GleanCustomDistribution;
    http1DownloadThroughput1050: GleanCustomDistribution;
    http1DownloadThroughput50100: GleanCustomDistribution;
    http1UploadThroughput: GleanCustomDistribution;
    http1UploadThroughput100: GleanCustomDistribution;
    http1UploadThroughput1050: GleanCustomDistribution;
    http1UploadThroughput50100: GleanCustomDistribution;
    http2DownloadThroughput: GleanCustomDistribution;
    http2DownloadThroughput100: GleanCustomDistribution;
    http2DownloadThroughput1050: GleanCustomDistribution;
    http2DownloadThroughput50100: GleanCustomDistribution;
    http2UploadThroughput: GleanCustomDistribution;
    http2UploadThroughput100: GleanCustomDistribution;
    http2UploadThroughput1050: GleanCustomDistribution;
    http2UploadThroughput50100: GleanCustomDistribution;
    http3ConnectionCloseReason: Record<
      | 'AckedUnsentPacket'
      | 'Application'
      | 'ApplicationError'
      | 'ConnectionIdLimitExceeded'
      | 'ConnectionIdsExhausted'
      | 'ConnectionRefused'
      | 'ConnectionState'
      | 'CryptoAlert'
      | 'CryptoBufferExceeded'
      | 'CryptoError'
      | 'DecodingFrame'
      | 'DecryptError'
      | 'DisabledVersion'
      | 'EchRetry'
      | 'FinalSizeError'
      | 'FlowControlError'
      | 'FrameEncodingError'
      | 'IdleTimeout'
      | 'IntegerOverflow'
      | 'InternalError'
      | 'InvalidInput'
      | 'InvalidMigration'
      | 'InvalidPacket'
      | 'InvalidResumptionToken'
      | 'InvalidRetry'
      | 'InvalidStreamId'
      | 'InvalidToken'
      | 'KeyUpdateBlocked'
      | 'KeysDiscarded'
      | 'KeysExhausted'
      | 'KeysPending'
      | 'NoAvailablePath'
      | 'NoError'
      | 'NoMoreData'
      | 'NotAvailable'
      | 'NotConnected'
      | 'PacketNumberOverlap'
      | 'PeerApplicationError'
      | 'PeerError'
      | 'ProtocolViolation'
      | 'QlogError'
      | 'StatelessReset'
      | 'StreamLimitError'
      | 'StreamStateError'
      | 'TooMuchData'
      | 'TransportParameterError'
      | 'UnexpectedMessage'
      | 'UnknownConnectionId'
      | 'UnknownFrameType'
      | 'VersionNegotiation'
      | 'WrongRole',
      GleanCounter
    >;
    http3DownloadThroughput: GleanCustomDistribution;
    http3DownloadThroughput100: GleanCustomDistribution;
    http3DownloadThroughput1050: GleanCustomDistribution;
    http3DownloadThroughput50100: GleanCustomDistribution;
    http3EcnCeEct0RatioReceived: GleanCustomDistribution;
    http3EcnCeEct0RatioSent: GleanCustomDistribution;
    http3EcnPathCapability: Record<
      'black-hole' | 'bleaching' | 'capable' | 'received-unsent-ect-1',
      GleanCounter
    >;
    http3LossRatio: GleanCustomDistribution;
    http3QuicFrameCount: Record<
      | 'ack_frequency_rx'
      | 'ack_frequency_tx'
      | 'ack_rx'
      | 'ack_tx'
      | 'connection_close_rx'
      | 'connection_close_tx'
      | 'crypto_rx'
      | 'crypto_tx'
      | 'data_blocked_rx'
      | 'data_blocked_tx'
      | 'datagram_rx'
      | 'datagram_tx'
      | 'handshake_done_rx'
      | 'handshake_done_tx'
      | 'max_data_rx'
      | 'max_data_tx'
      | 'max_stream_data_rx'
      | 'max_stream_data_tx'
      | 'max_streams_rx'
      | 'max_streams_tx'
      | 'new_connection_id_rx'
      | 'new_connection_id_tx'
      | 'new_token_rx'
      | 'new_token_tx'
      | 'padding_rx'
      | 'padding_tx'
      | 'path_challenge_rx'
      | 'path_challenge_tx'
      | 'path_response_rx'
      | 'path_response_tx'
      | 'ping_rx'
      | 'ping_tx'
      | 'reset_stream_rx'
      | 'reset_stream_tx'
      | 'retire_connection_id_rx'
      | 'retire_connection_id_tx'
      | 'stop_sending_rx'
      | 'stop_sending_tx'
      | 'stream_data_blocked_rx'
      | 'stream_data_blocked_tx'
      | 'stream_rx'
      | 'stream_tx'
      | 'streams_blocked_rx'
      | 'streams_blocked_tx',
      GleanCounter
    >;
    http3UdpDatagramSegmentSizeReceived: GleanMemoryDistribution;
    http3UdpDatagramSegmentSizeSent: GleanMemoryDistribution;
    http3UdpDatagramSegmentsReceived: GleanCustomDistribution;
    http3UdpDatagramSegmentsSent: GleanCustomDistribution;
    http3UdpDatagramSizeReceived: GleanMemoryDistribution;
    http3UdpDatagramSizeSent: GleanMemoryDistribution;
    http3UploadThroughput: GleanCustomDistribution;
    http3UploadThroughput100: GleanCustomDistribution;
    http3UploadThroughput1050: GleanCustomDistribution;
    http3UploadThroughput50100: GleanCustomDistribution;
    httpChannelDisposition: Record<
      | 'http_cancelled'
      | 'http_disk'
      | 'http_net_early_fail'
      | 'http_net_late_fail'
      | 'http_net_ok'
      | 'https_cancelled'
      | 'https_disk'
      | 'https_net_early_fail'
      | 'https_net_late_fail'
      | 'https_net_ok',
      GleanCounter
    >;
    httpChannelDispositionDisabledNoReason: Record<
      'cancel' | 'disk' | 'net_early_fail' | 'net_late_fail' | 'net_ok',
      GleanCounter
    >;
    httpChannelDispositionDisabledUpgrade: Record<
      'cancel' | 'disk' | 'net_early_fail' | 'net_late_fail' | 'net_ok',
      GleanCounter
    >;
    httpChannelDispositionDisabledWont: Record<
      'cancel' | 'disk' | 'net_early_fail' | 'net_late_fail' | 'net_ok',
      GleanCounter
    >;
    httpChannelDispositionEnabledNoReason: Record<
      'cancel' | 'disk' | 'net_early_fail' | 'net_late_fail' | 'net_ok',
      GleanCounter
    >;
    httpChannelDispositionEnabledUpgrade: Record<
      'cancel' | 'disk' | 'net_early_fail' | 'net_late_fail' | 'net_ok',
      GleanCounter
    >;
    httpChannelDispositionEnabledWont: Record<
      'cancel' | 'disk' | 'net_early_fail' | 'net_late_fail' | 'net_ok',
      GleanCounter
    >;
    httpChannelDispositionUpgrade: GleanDualLabeledCounter;
    httpChannelOnstartStatus: Record<'fail' | 'successful', GleanCounter>;
    httpChannelOnstartSuccessHttpsRr: Record<
      'failure' | 'failure_ech_used' | 'success' | 'success_ech_used',
      GleanCounter
    >;
    httpChannelPageOpenToFirstSent: GleanTimingDistribution;
    httpChannelPageOpenToFirstSentHttpsRr: GleanTimingDistribution;
    httpChannelSubOpenToFirstSent: GleanTimingDistribution;
    httpChannelSubOpenToFirstSentHttpsRr: GleanTimingDistribution;
    httpContentCssloaderOndatafinishedToOnstopDelay: GleanTimingDistribution;
    httpContentHtml5parserOndatafinishedToOnstopDelay: GleanTimingDistribution;
    httpContentOndatafinishedDelay: GleanTimingDistribution;
    httpContentOndatafinishedDelay2: GleanTimingDistribution;
    httpContentOndatafinishedToOnstopDelay: GleanTimingDistribution;
    httpContentOnstartDelay: GleanTimingDistribution;
    httpContentOnstopDelay: GleanTimingDistribution;
    httpOnstartSuspendTotalTime: GleanTimingDistribution;
    httpRedirectToSchemeSubresource: Record<string, GleanCounter>;
    httpRedirectToSchemeTopLevel: Record<string, GleanCounter>;
    httpResponseStatusCode: Record<
      | '200_ok'
      | '301_moved_permanently'
      | '302_found'
      | '304_not_modified'
      | '307_temporary_redirect'
      | '308_permanent_redirect'
      | '400_bad_request'
      | '401_unauthorized'
      | '403_forbidden'
      | '404_not_found'
      | '421_misdirected_request'
      | '425_too_early'
      | '429_too_many_requests'
      | 'other'
      | 'other_4xx'
      | 'other_5xx',
      GleanCounter
    >;
    httpResponseVersion: Record<'http_1' | 'http_2' | 'http_3' | 'unknown', GleanCounter>;
    httpToHttpsUpgradeReason: Record<
      | 'already_https'
      | 'csp_uir'
      | 'hsts'
      | 'https_first_schemeless_upgrade'
      | 'https_first_schemeless_upgrade_downgrade'
      | 'https_first_upgrade'
      | 'https_first_upgrade_downgrade'
      | 'https_only_upgrade'
      | 'https_only_upgrade_downgrade'
      | 'https_rr'
      | 'no_upgrade'
      | 'no_upgrade_https'
      | 'not_initialized'
      | 'not_initialized_https'
      | 'skip_upgrade'
      | 'upgrade_exception'
      | 'web_extension_upgrade',
      GleanCounter
    >;
    httpsHttpOrLocal: Record<
      'load_is_http' | 'load_is_http_for_local_domain' | 'load_is_https',
      GleanCounter
    >;
    httpsRrPresented: Record<'none' | 'presented' | 'presented_with_http3', GleanCounter>;
    localNetworkAccess: Record<
      | 'failure'
      | 'private_to_local_http'
      | 'private_to_local_https'
      | 'public_to_local_http'
      | 'public_to_local_https'
      | 'public_to_private_http'
      | 'public_to_private_https'
      | 'success',
      GleanCounter
    >;
    localNetworkAccessPort: GleanCustomDistribution;
    localNetworkAccessPromptsShown: Record<'local_network' | 'localhost', GleanCounter>;
    localNetworkBlockedTracker: GleanCounter;
    osSocketLimitReached: GleanCounter;
    prcloseTcpBlockingTimeConnectivityChange: GleanTimingDistribution;
    prcloseTcpBlockingTimeLinkChange: GleanTimingDistribution;
    prcloseTcpBlockingTimeNormal: GleanTimingDistribution;
    prcloseTcpBlockingTimeOffline: GleanTimingDistribution;
    prcloseTcpBlockingTimeShutdown: GleanTimingDistribution;
    prcloseUdpBlockingTimeConnectivityChange: GleanTimingDistribution;
    prcloseUdpBlockingTimeLinkChange: GleanTimingDistribution;
    prcloseUdpBlockingTimeNormal: GleanTimingDistribution;
    prcloseUdpBlockingTimeOffline: GleanTimingDistribution;
    prcloseUdpBlockingTimeShutdown: GleanTimingDistribution;
    prconnectBlockingTimeConnectivityChange: GleanTimingDistribution;
    prconnectBlockingTimeLinkChange: GleanTimingDistribution;
    prconnectBlockingTimeNormal: GleanTimingDistribution;
    prconnectBlockingTimeOffline: GleanTimingDistribution;
    prconnectBlockingTimeShutdown: GleanTimingDistribution;
    prconnectFailBlockingTimeConnectivityChange: GleanTimingDistribution;
    prconnectFailBlockingTimeLinkChange: GleanTimingDistribution;
    prconnectFailBlockingTimeNormal: GleanTimingDistribution;
    prconnectFailBlockingTimeOffline: GleanTimingDistribution;
    prconnectFailBlockingTimeShutdown: GleanTimingDistribution;
    prconnectcontinueBlockingTimeConnectivityChange: GleanTimingDistribution;
    prconnectcontinueBlockingTimeLinkChange: GleanTimingDistribution;
    prconnectcontinueBlockingTimeNormal: GleanTimingDistribution;
    prconnectcontinueBlockingTimeOffline: GleanTimingDistribution;
    prconnectcontinueBlockingTimeShutdown: GleanTimingDistribution;
    proxyInfoType: Record<
      'direct' | 'http' | 'https' | 'socks4' | 'socks4a' | 'socks5' | 'socks5h' | 'unknown',
      GleanCounter
    >;
    residualCacheFolderCount: GleanCounter;
    residualCacheFolderRemoval: Record<'failure' | 'success', GleanCounter>;
    setCookie: GleanDenominator;
    setCookieForeign: GleanNumerator;
    setCookieForeignPartitioned: GleanNumerator;
    setCookiePartitioned: GleanNumerator;
    speculativeConnectOutcome: Record<
      'aborted_https_not_enabled' | 'aborted_socket_fail' | 'aborted_socket_limit' | 'successful',
      GleanCounter
    >;
    sqliteCookiesBlockMainThread: GleanTimingDistribution;
    sqliteCookiesTimeToBlockMainThread: GleanTimingDistribution;
    transactionWaitTime: GleanTimingDistribution;
    transactionWaitTimeHttpsRr: GleanTimingDistribution;
    trrCompleteLoad: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanTimingDistribution
    >;
    trrDnsEnd: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanTimingDistribution
    >;
    trrDnsStart: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanTimingDistribution
    >;
    trrFetchDuration: Record<
      'h1' | 'h1_network_only' | 'h2' | 'h2_network_only' | 'h3' | 'h3_network_only',
      GleanTimingDistribution
    >;
    trrFirstSentToLastReceived: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanTimingDistribution
    >;
    trrOpenToFirstReceived: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanTimingDistribution
    >;
    trrOpenToFirstSent: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanTimingDistribution
    >;
    trrRequestCount: Record<'private' | 'regular', GleanCounter>;
    trrRequestCountPerConn: Record<
      | 'dns.shaw.ca_h1'
      | 'dns.shaw.ca_h2'
      | 'dns.shaw.ca_h3'
      | 'doh.xfinity.com_h1'
      | 'doh.xfinity.com_h2'
      | 'doh.xfinity.com_h3'
      | 'dooh.cloudflare-dns.com_h1'
      | 'dooh.cloudflare-dns.com_h2'
      | 'dooh.cloudflare-dns.com_h3'
      | 'firefox.dns.nextdns.io_h1'
      | 'firefox.dns.nextdns.io_h2'
      | 'firefox.dns.nextdns.io_h3'
      | 'mozilla.cloudflare-dns.com_h1'
      | 'mozilla.cloudflare-dns.com_h2'
      | 'mozilla.cloudflare-dns.com_h3'
      | 'private.canadianshield.cira.ca_h1'
      | 'private.canadianshield.cira.ca_h2'
      | 'private.canadianshield.cira.ca_h3',
      GleanCounter
    >;
    trrRequestSize: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanMemoryDistribution
    >;
    trrResponseSize: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanMemoryDistribution
    >;
    trrTcpConnection: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanTimingDistribution
    >;
    trrTlsHandshake: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanTimingDistribution
    >;
    connectionAddressType: Record<
      'http_1_ipv4' | 'http_1_ipv6' | 'http_2_ipv4' | 'http_2_ipv6' | 'http_3_ipv4' | 'http_3_ipv6',
      GleanCounter
    >;
    dataTransferredV3Kb: Record<string, GleanCounter>;
    http3Enabled: GleanBoolean;
    httpsRecordState: Record<
      'all_excluded' | 'invalid' | 'no_default_alpn' | 'others' | 'succeeded' | 'unmatched_cname',
      GleanCounter
    >;
    httpsRrPrefsUsage: GleanQuantity;
    trrConnectionCycleCount: Record<string, GleanCounter>;
    loadingCertsTask: GleanQuantity;
    nssInitialization: GleanQuantity;
    dohHeuristicEverTripped: Record<string, GleanBoolean>;
    dohHeuristicsAttempts: GleanCounter;
    dohHeuristicsPassCount: GleanCounter;
    dohHeuristicsResult: GleanQuantity;
  };

  securityUiProtectionspopup: {
    clickCookiebToggleOff: GleanEventNoExtras;
    clickCookiebToggleOn: GleanEventNoExtras;
    clickCookies: GleanEventNoExtras;
    clickCryptominers: GleanEventNoExtras;
    clickEtpToggleOff: GleanEventNoExtras;
    clickEtpToggleOn: GleanEventNoExtras;
    clickFingerprinters: GleanEventNoExtras;
    clickFullReport: GleanEventNoExtras;
    clickMilestoneMessage: GleanEventNoExtras;
    clickProtectionspopupCfr: GleanEventWithExtras<{ message?: string; value?: string }>;
    clickSettings: GleanEventNoExtras;
    clickSmartblockembedsToggle: GleanEventWithExtras<{ isBlock?: string; openingReason?: string }>;
    clickSocial: GleanEventNoExtras;
    clickSubviewSettings: GleanEventWithExtras<{ value?: string }>;
    clickTrackers: GleanEventNoExtras;
    closeProtectionsPopup: GleanEventWithExtras<{
      openingReason?: string;
      smartblockToggleClicked?: string;
    }>;
    openProtectionsPopup: GleanEventWithExtras<{
      openingReason?: string;
      smartblockEmbedTogglesShown?: string;
    }>;
    openProtectionspopupCfr: GleanEventWithExtras<{ message?: string; value?: string }>;
    smartblockembedsShown: GleanCounter;
  };

  messagingSystem: {
    addonVersion: GleanString;
    browserSessionId: GleanUuid;
    bucketId: GleanString;
    clientId: GleanUuid;
    event: GleanString;
    eventContext: GleanText;
    eventContextParseError: GleanCounter;
    eventPage: GleanString;
    eventReason: GleanString;
    eventScreenFamily: GleanText;
    eventScreenId: GleanText;
    eventScreenIndex: GleanQuantity;
    eventScreenInitials: GleanText;
    eventSource: GleanString;
    gleanPingForPingFailures: GleanCounter;
    impressionId: GleanUuid;
    invalidNestedData: Record<string, GleanCounter>;
    locale: GleanString;
    messageId: GleanText;
    messageRequestTime: GleanTimingDistribution;
    pingType: GleanString;
    source: GleanString;
    unknownKeyCount: GleanCounter;
    unknownKeys: Record<string, GleanCounter>;
  };

  messagingSystemAttribution: {
    campaign: GleanString;
    content: GleanString;
    dlsource: GleanString;
    dltoken: GleanString;
    experiment: GleanString;
    medium: GleanString;
    msstoresignedin: GleanString;
    source: GleanString;
    ua: GleanString;
    unknownKeys: Record<string, GleanCounter>;
    variation: GleanString;
  };

  gleanAttribution: {
    ext: GleanObject;
  };

  gleanDistribution: {
    ext: GleanObject;
  };

  browserBackup: {
    browserExtensionDataSize: GleanQuantity;
    changeLocation: GleanEventNoExtras;
    compressedArchiveSize: GleanMemoryDistribution;
    cookiesSize: GleanQuantity;
    created: GleanEventNoExtras;
    credentialsDataSize: GleanQuantity;
    enabled: GleanBoolean;
    error: GleanEventWithExtras<{ backup_step?: string; error_code?: string }>;
    extensionStorePermissionsDataSize: GleanQuantity;
    extensionsJsonSize: GleanQuantity;
    extensionsStorageSize: GleanQuantity;
    extensionsXpiDirectorySize: GleanQuantity;
    faviconsSize: GleanQuantity;
    faviconsTime: GleanTimingDistribution;
    formHistorySize: GleanQuantity;
    locationOnDevice: GleanQuantity;
    miscDataSize: GleanQuantity;
    passwordAdded: GleanEventNoExtras;
    passwordChanged: GleanEventNoExtras;
    passwordRemoved: GleanEventNoExtras;
    placesSize: GleanQuantity;
    placesTime: GleanTimingDistribution;
    preferencesSize: GleanQuantity;
    profDDiskSpace: GleanQuantity;
    pswdEncrypted: GleanBoolean;
    schedulerEnabled: GleanBoolean;
    securityDataSize: GleanQuantity;
    sessionStoreBackupsDirectorySize: GleanQuantity;
    sessionStoreSize: GleanQuantity;
    storageSyncSize: GleanQuantity;
    toggleOff: GleanEventNoExtras;
    toggleOn: GleanEventNoExtras;
    totalBackupSize: GleanMemoryDistribution;
    totalBackupTime: GleanTimingDistribution;
  };

  containers: {
    containerCreated: GleanEventWithExtras<{ container_id?: string }>;
    containerDeleted: GleanEventWithExtras<{ container_id?: string }>;
    containerModified: GleanEventWithExtras<{ container_id?: string }>;
    containerProfileLoaded: GleanEventWithExtras<{ containers?: string }>;
    containerTabClosed: GleanEventWithExtras<{ container_id?: string }>;
    containerTabOpened: GleanEventWithExtras<{ container_id?: string }>;
    containersEnabled: GleanEventWithExtras<{ enabled?: string }>;
    tabAssignedContainer: GleanEventWithExtras<{
      from_container_id?: string;
      to_container_id?: string;
    }>;
  };

  downloads: {
    panelShown: GleanCounter;
    addedFileExtension: GleanEventWithExtras<{ value?: string }>;
    fileOpened: GleanCounter;
    userActionOnBlockedDownload: Record<string, GleanCustomDistribution>;
  };

  extensionsButton: {
    openViaAppMenu: GleanEventWithExtras<{
      is_extensions_button_visible?: string;
      is_extensions_panel_empty?: string;
    }>;
    prefersHiddenButton: GleanBoolean;
    temporarilyUnhidden: Record<
      | 'addon_install_doorhanger'
      | 'attention_blocklist'
      | 'attention_permission_denied'
      | 'customize'
      | 'extension_browser_action_popup'
      | 'extension_controlled_setting'
      | 'extension_permission_prompt'
      | 'extensions_panel_showing',
      GleanCounter
    >;
    toggleVisibility: GleanEventWithExtras<{
      is_customizing?: string;
      is_extensions_panel_empty?: string;
      is_temporarily_shown?: string;
      should_hide?: string;
    }>;
  };

  firefoxview: {
    cumulativeSearches: Record<
      'history' | 'opentabs' | 'recentbrowsing' | 'recentlyclosed' | 'syncedtabs',
      GleanCustomDistribution
    >;
  };

  firefoxviewNext: {
    browserContextMenuTabs: GleanEventWithExtras<{ menu_action?: string; page?: string }>;
    cardCollapsedCardContainer: GleanEventWithExtras<{ data_type?: string }>;
    cardExpandedCardContainer: GleanEventWithExtras<{ data_type?: string }>;
    changePageNavigation: GleanEventWithExtras<{ page?: string; source?: string }>;
    closeOpenTabTabs: GleanEventNoExtras;
    contextMenuTabs: GleanEventWithExtras<{ data_type?: string; menu_action?: string }>;
    dismissClosedTabTabs: GleanEventWithExtras<{
      delta?: string;
      page?: string;
      position?: string;
    }>;
    enteredFirefoxview: GleanEventWithExtras<{ page?: string }>;
    fxaContinueSync: GleanEventNoExtras;
    fxaMobileSync: GleanEventWithExtras<{ has_devices?: string }>;
    historyVisits: GleanEventNoExtras;
    openTabTabs: GleanEventWithExtras<{ page?: string; window?: string }>;
    recentlyClosedTabs: GleanEventWithExtras<{ delta?: string; page?: string; position?: string }>;
    searchInitiatedSearch: GleanEventWithExtras<{ page?: string }>;
    searchShowAllShowallbutton: GleanEventWithExtras<{ section?: string }>;
    showAllHistoryTabs: GleanEventNoExtras;
    sortHistoryTabs: GleanEventWithExtras<{ search_start?: string; sort_type?: string }>;
    syncedTabsTabs: GleanEventWithExtras<{ page?: string }>;
    tabSelectedToolbarbutton: GleanEventNoExtras;
  };

  genaiChatbot: {
    badges: GleanString;
    contextmenuChoose: GleanEventWithExtras<{ provider?: string }>;
    contextmenuPromptClick: GleanEventWithExtras<{
      prompt?: string;
      provider?: string;
      selection?: string;
    }>;
    contextmenuRemove: GleanEventWithExtras<{ provider?: string }>;
    enabled: GleanBoolean;
    experimentCheckboxClick: GleanEventWithExtras<{ enabled?: string }>;
    keyboardShortcut: GleanEventWithExtras<{ enabled?: string; sidebar?: string }>;
    lengthDisclaimer: GleanEventWithExtras<{ length?: string; provider?: string; type?: string }>;
    lengthDisclaimerDismissed: GleanEventWithExtras<{ provider?: string; type?: string }>;
    menu: GleanBoolean;
    onboardingClose: GleanEventWithExtras<{ provider?: string; step?: string }>;
    onboardingFinish: GleanEventWithExtras<{ provider?: string; step?: string }>;
    onboardingLearnMore: GleanEventWithExtras<{ provider?: string; step?: string }>;
    onboardingProviderChoiceDisplayed: GleanEventWithExtras<{ provider?: string; step?: string }>;
    onboardingProviderSelection: GleanEventWithExtras<{ provider?: string; step?: string }>;
    onboardingProviderTerms: GleanEventWithExtras<{
      provider?: string;
      step?: string;
      text?: string;
    }>;
    page: GleanBoolean;
    promptClick: GleanEventWithExtras<{
      content_type?: string;
      prompt?: string;
      provider?: string;
      reader_mode?: string;
      selection?: string;
      source?: string;
    }>;
    provider: GleanString;
    providerChange: GleanEventWithExtras<{ current?: string; previous?: string; surface?: string }>;
    shortcuts: GleanBoolean;
    shortcutsCheckboxClick: GleanEventWithExtras<{ enabled?: string }>;
    shortcutsCustom: GleanBoolean;
    shortcutsDisplayed: GleanEventWithExtras<{
      delay?: string;
      inputType?: string;
      selection?: string;
    }>;
    shortcutsExpanded: GleanEventWithExtras<{
      provider?: string;
      selection?: string;
      warning?: string;
    }>;
    shortcutsHideClick: GleanEventWithExtras<{ selection?: string }>;
    shortcutsPromptClick: GleanEventWithExtras<{
      prompt?: string;
      provider?: string;
      selection?: string;
    }>;
    sidebar: GleanBoolean;
    sidebarCloseClick: GleanEventWithExtras<{ provider?: string }>;
    sidebarMoreMenuClick: GleanEventWithExtras<{ action?: string; provider?: string }>;
    sidebarMoreMenuDisplay: GleanEventWithExtras<{ provider?: string }>;
    sidebarProviderMenuClick: GleanEventWithExtras<{ action?: string; provider?: string }>;
    sidebarToggle: GleanEventWithExtras<{
      opened?: string;
      provider?: string;
      reason?: string;
      version?: string;
    }>;
    summarizePage: GleanEventWithExtras<{
      provider?: string;
      reader_mode?: string;
      selection?: string;
      source?: string;
    }>;
  };

  genaiLinkpreview: {
    aiOptin: GleanBoolean;
    cardAiConsent: GleanEventWithExtras<{ option?: string }>;
    cardClose: GleanEventWithExtras<{ duration?: string; tab?: string }>;
    cardLink: GleanEventWithExtras<{ key_points?: string; source?: string; tab?: string }>;
    enabled: GleanBoolean;
    fetch: GleanEventWithExtras<{
      description?: string;
      image?: string;
      length?: string;
      outcome?: string;
      sitename?: string;
      skipped?: string;
      tab?: string;
      time?: string;
      title?: string;
    }>;
    generate: GleanEventWithExtras<{
      delay?: string;
      download?: string;
      latency?: string;
      outcome?: string;
      sentences?: string;
      time?: string;
    }>;
    keyPoints: GleanBoolean;
    keyPointsToggle: GleanEventWithExtras<{ expand?: string }>;
    onboardingCard: GleanEventWithExtras<{ action?: string; type?: string }>;
    prefChanged: GleanEventWithExtras<{ enabled?: string; pref?: string }>;
    shortcut: GleanString;
    start: GleanEventWithExtras<{ cached?: string; source?: string; tab?: string }>;
  };

  ipprotection: {
    clickUpgradeButton: GleanEventNoExtras;
    enabled: GleanBoolean;
    toggled: GleanEventWithExtras<{ duration?: string; enabled?: string; userAction?: string }>;
    usageRx: GleanMemoryDistribution;
    usageTx: GleanMemoryDistribution;
  };

  backgroundUpdate: {
    reasonsToNotUpdate: GleanStringList;
    timeLastUpdateScheduled: GleanDatetime;
    automaticRestartAttempted: GleanBoolean;
    automaticRestartSuccess: GleanBoolean;
    clientId: GleanUuid;
    daysSinceLastBrowsed: GleanQuantity;
    debounced: GleanCounter;
    exitCodeException: GleanBoolean;
    exitCodeSuccess: GleanBoolean;
    finalState: GleanString;
    reasons: GleanStringList;
    states: GleanStringList;
    targetingEnvCurrentDate: GleanDatetime;
    targetingEnvFirefoxVersion: GleanQuantity;
    targetingEnvProfileAge: GleanDatetime;
    targetingException: GleanBoolean;
    targetingExists: GleanBoolean;
    targetingVersion: GleanQuantity;
    throttled: GleanBoolean;
    throttlingPreventedUpdates: GleanCounter;
  };

  browser: {
    attributionErrors: Record<
      | 'decode_error'
      | 'empty_error'
      | 'null_error'
      | 'quarantine_error'
      | 'read_error'
      | 'write_error',
      GleanCounter
    >;
    defaultAtLaunch: GleanBoolean;
    isUserDefault: Record<'false' | 'true', GleanCounter>;
    isUserDefaultError: Record<'false' | 'true', GleanCounter>;
    setDefaultAlwaysCheck: Record<'false' | 'true', GleanCounter>;
    setDefaultDialogPromptRawcount: GleanCustomDistribution;
    setDefaultError: Record<'false' | 'true', GleanCounter>;
    setDefaultPdfHandlerUserChoiceResult: Record<
      | 'ErrBuild'
      | 'ErrExeHash'
      | 'ErrExeOther'
      | 'ErrExeProgID'
      | 'ErrExeRejected'
      | 'ErrExeTimeout'
      | 'ErrHash'
      | 'ErrLaunchExe'
      | 'ErrOther'
      | 'ErrProgID'
      | 'Success',
      GleanCounter
    >;
    setDefaultResult: GleanCustomDistribution;
    setDefaultUserChoiceResult: Record<
      | 'ErrBuild'
      | 'ErrExeHash'
      | 'ErrExeOther'
      | 'ErrExeProgID'
      | 'ErrExeRejected'
      | 'ErrExeTimeout'
      | 'ErrHash'
      | 'ErrLaunchExe'
      | 'ErrOther'
      | 'ErrProgID'
      | 'Success',
      GleanCounter
    >;
  };

  browserLaunchedToHandle: {
    systemNotification: GleanEventWithExtras<{ action?: string; name?: string }>;
  };

  browserStartup: {
    abouthomeCacheResult: GleanQuantity;
    abouthomeCacheShutdownwrite: GleanBoolean;
    kioskMode: GleanBoolean;
  };

  datasanitization: {
    privacyClearOnShutdownCache: GleanBoolean;
    privacyClearOnShutdownCookies: GleanBoolean;
    privacyClearOnShutdownDownloads: GleanBoolean;
    privacyClearOnShutdownFormdata: GleanBoolean;
    privacyClearOnShutdownHistory: GleanBoolean;
    privacyClearOnShutdownOfflineApps: GleanBoolean;
    privacyClearOnShutdownOpenWindows: GleanBoolean;
    privacyClearOnShutdownSessions: GleanBoolean;
    privacyClearOnShutdownSiteSettings: GleanBoolean;
    privacySanitizeSanitizeOnShutdown: GleanBoolean;
    sessionPermissionExceptions: GleanQuantity;
  };

  launchOnLogin: {
    lastProfileDisableStartup: GleanEventNoExtras;
  };

  osEnvironment: {
    invokedToHandle: Record<string, GleanCounter>;
    isDefaultHandler: Record<string, GleanBoolean>;
    isKeptInDock: GleanBoolean;
    isTaskbarPinned: GleanBoolean;
    isTaskbarPinnedPrivate: GleanBoolean;
    launchMethod: GleanString;
    launchedToHandle: Record<string, GleanCounter>;
    allowedAppSources: GleanString;
    isAdminWithoutUac: GleanBoolean;
  };

  primaryPassword: {
    enabled: GleanBoolean;
  };

  security: {
    globalPrivacyControlEnabled: GleanQuantity;
    httpsOnlyModeEnabled: GleanQuantity;
    httpsOnlyModeEnabledPbm: GleanQuantity;
    fissionPrincipals: GleanEventWithExtras<{
      principalType?: string;
      scheme?: string;
      value?: string;
    }>;
    shadowedHtmlDocumentPropertyAccess: GleanEventWithExtras<{ name?: string }>;
    shadowedHtmlFormElementPropertyAccess: GleanEventWithExtras<{ name?: string }>;
    cspViolationInternalPage: GleanEventWithExtras<{
      blockeduridetails?: string;
      blockeduritype?: string;
      columnnumber?: string;
      directive?: string;
      linenumber?: string;
      sample?: string;
      selfdetails?: string;
      selftype?: string;
      sourcedetails?: string;
      sourcetype?: string;
    }>;
    evalUsageParentProcess: GleanEventWithExtras<{ fileinfo?: string; value?: string }>;
    evalUsageSystemContext: GleanEventWithExtras<{ fileinfo?: string; value?: string }>;
    httpsOnlyModeUpgradeTime: Record<
      | 'sub_f_aborted'
      | 'sub_f_cxnrefused'
      | 'sub_f_other'
      | 'sub_f_redirectloop'
      | 'sub_f_ssl_badcertdm'
      | 'sub_f_ssl_other'
      | 'sub_f_ssl_selfsignd'
      | 'sub_f_ssl_unkwnissr'
      | 'sub_f_timeout'
      | 'sub_successful'
      | 'top_f_aborted'
      | 'top_f_cxnrefused'
      | 'top_f_other'
      | 'top_f_redirectloop'
      | 'top_f_ssl_badcertdm'
      | 'top_f_ssl_other'
      | 'top_f_ssl_selfsignd'
      | 'top_f_ssl_unkwnissr'
      | 'top_f_timeout'
      | 'top_successful',
      GleanTimingDistribution
    >;
    httpsOnlyModeUpgradeType: GleanDualLabeledCounter;
    javascriptLoadParentProcess: GleanEventWithExtras<{
      blocked?: string;
      fileinfo?: string;
      value?: string;
    }>;
    referrerPolicyCount: GleanCustomDistribution;
    unexpectedLoad: GleanEventWithExtras<{
      contenttype?: string;
      filedetails?: string;
      redirects?: string;
      remotetype?: string;
      value?: string;
    }>;
    prefUsageContentProcess: GleanEventWithExtras<{ value?: string }>;
    addonSignatureVerificationStatus: GleanCustomDistribution;
    clientAuthCertUsage: Record<string, GleanCounter>;
    contentSignatureVerificationErrors: GleanDualLabeledCounter;
    contentSignatureVerificationStatus: GleanCustomDistribution;
    ntlmModuleUsed: GleanCustomDistribution;
  };

  sslkeylogging: {
    enabled: GleanBoolean;
  };

  startMenu: {
    manuallyUnpinnedSinceLastLaunch: GleanEventNoExtras;
  };

  startup: {
    isCold: GleanBoolean;
    secondsSinceLastOsRestart: GleanQuantity;
    profileCount: GleanQuantity;
    profileDatabaseVersion: GleanString;
    profileSelectionReason: GleanString;
  };

  upgradeDialog: {
    triggerReason: GleanEventWithExtras<{ value?: string }>;
  };

  browserMigration: {
    bookmarksQuantity: Record<string, GleanCustomDistribution>;
    browserSelectedWizard: GleanEventWithExtras<{ migrator_key?: string }>;
    cardsQuantity: Record<string, GleanCustomDistribution>;
    chromePasswordFileWizard: GleanEventNoExtras;
    entryPointCategorical: Record<
      | 'bookmarks_toolbar'
      | 'file_menu'
      | 'firstrun'
      | 'fxrefresh'
      | 'help_menu'
      | 'newtab'
      | 'passwords'
      | 'places'
      | 'preferences'
      | 'unknown',
      GleanCounter
    >;
    errors: Record<string, GleanCustomDistribution>;
    extensionsQuantity: Record<string, GleanCustomDistribution>;
    historyQuantity: Record<string, GleanCustomDistribution>;
    linuxPermsWizard: GleanEventWithExtras<{ migrator_key?: string }>;
    loginsQuantity: Record<string, GleanCustomDistribution>;
    matchedExtensions: GleanStringList;
    migrationFinishedWizard: GleanEventWithExtras<{
      bookmarks?: string;
      extensions?: string;
      formdata?: string;
      history?: string;
      migrator_key?: string;
      other?: string;
      passwords?: string;
      payment_methods?: string;
    }>;
    migrationStartedWizard: GleanEventWithExtras<{
      bookmarks?: string;
      extensions?: string;
      formdata?: string;
      history?: string;
      migrator_key?: string;
      other?: string;
      passwords?: string;
      payment_methods?: string;
    }>;
    noBrowsersFoundWizard: GleanEventNoExtras;
    openedWizard: GleanEventNoExtras;
    profileSelectedWizard: GleanEventWithExtras<{ migrator_key?: string }>;
    resourcesSelectedWizard: GleanEventWithExtras<{
      bookmarks?: string;
      configured?: string;
      extensions?: string;
      formdata?: string;
      history?: string;
      migrator_key?: string;
      other?: string;
      passwords?: string;
      payment_methods?: string;
    }>;
    safariPasswordFileWizard: GleanEventNoExtras;
    safariPermsWizard: GleanEventNoExtras;
    sourceBrowser: GleanCustomDistribution;
    unmatchedExtensions: GleanStringList;
    usage: Record<string, GleanCustomDistribution>;
  };

  migration: {
    discoveredMigrators: Record<string, GleanCounter>;
    timeToProduceMigratorList: GleanTimespan;
    uninstallerProfileRefresh: GleanBoolean;
  };

  activityStream: {
    endSession: GleanEventWithExtras<{
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventBlock: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventBookmarkAdd: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventBookmarkDelete: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventClick: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventClickPrivacyInfo: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventCloseNewtabPrefs: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventDelete: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventDeleteConfirm: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventDialogCancel: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventDialogOpen: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventDisclaimerAcked: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventDrag: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventDrop: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventFakespotCategory: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventFakespotClick: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventHidePersonalize: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventImpression: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventMenuAddSearch: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventMenuAddTopsite: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventMenuCollapse: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventMenuExpand: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventMenuManage: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventMenuMoveDown: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventMenuMoveUp: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventMenuPrivacyNotice: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventMenuRemove: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventMigrationCancel: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventMigrationStart: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventOpenNewWindow: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventOpenNewtabPrefs: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventOpenPrivateWindow: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventPin: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventPocketThumbsDown: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventPocketThumbsUp: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventPrefChanged: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventPreviewRequest: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventSearch: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventSearchEditAdd: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventSearchEditClose: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventSearchEditDelete: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventSearchHandoff: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventShowPersonalize: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventShowPrivacyInfo: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventSkippedSignin: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventSubmitEmail: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventTopSitesEdit: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventTopSitesEditClose: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventTopsiteSponsorInfo: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
    eventUnpin: GleanEventWithExtras<{
      action_position?: string;
      addon_version?: string;
      page?: string;
      session_id?: string;
      user_prefs?: string;
      value?: string;
    }>;
  };

  contextualServicesTopsites: {
    click: Record<string, GleanCounter>;
    impression: Record<string, GleanCounter>;
  };

  deletionRequest: {
    contextId: GleanString;
    impressionId: GleanString;
    syncDeviceId: GleanString;
  };

  newtab: {
    abouthomeCacheConstruction: GleanTimingDistribution;
    activityStreamCtorSuccess: GleanBoolean;
    addonReadySuccess: GleanBoolean;
    addonXpiUsed: GleanBoolean;
    blockedSponsors: GleanStringList;
    closed: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    fakespotAboutClick: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    fakespotCategory: GleanEventWithExtras<{ category?: string; newtab_visit_id?: string }>;
    fakespotClick: GleanEventWithExtras<{
      category?: string;
      newtab_visit_id?: string;
      product_id?: string;
    }>;
    fakespotCtaClick: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    fakespotDismiss: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    fakespotProductImpression: GleanEventWithExtras<{
      category?: string;
      newtab_visit_id?: string;
      product_id?: string;
      product_title?: string;
    }>;
    featureHighlightDismiss: GleanEventWithExtras<{ feature?: string; newtab_visit_id?: string }>;
    featureHighlightImpression: GleanEventWithExtras<{
      feature?: string;
      newtab_visit_id?: string;
    }>;
    featureHighlightOpen: GleanEventWithExtras<{ feature?: string; newtab_visit_id?: string }>;
    homepageCategory: GleanString;
    inlineSelectionClick: GleanEventWithExtras<{
      is_followed?: string;
      newtab_visit_id?: string;
      section_position?: string;
      topic?: string;
      topic_position?: string;
    }>;
    inlineSelectionImpression: GleanEventWithExtras<{
      newtab_visit_id?: string;
      section_position?: string;
    }>;
    locale: GleanString;
    metricRegistered: Record<string, GleanBoolean>;
    newtabCategory: GleanString;
    opened: GleanEventWithExtras<{
      newtab_visit_id?: string;
      source?: string;
      window_inner_height?: string;
      window_inner_width?: string;
    }>;
    pingRegistered: Record<string, GleanBoolean>;
    promoCardClick: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    promoCardDismiss: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    promoCardImpression: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    sectionsBlockSection: GleanEventWithExtras<{
      content_redacted?: string;
      event_source?: string;
      newtab_visit_id?: string;
      section?: string;
      section_position?: string;
    }>;
    sectionsFollowSection: GleanEventWithExtras<{
      content_redacted?: string;
      event_source?: string;
      newtab_visit_id?: string;
      section?: string;
      section_position?: string;
    }>;
    sectionsImpression: GleanEventWithExtras<{
      content_redacted?: string;
      is_section_followed?: string;
      layout_name?: string;
      newtab_visit_id?: string;
      section?: string;
      section_position?: string;
    }>;
    sectionsUnblockSection: GleanEventWithExtras<{
      content_redacted?: string;
      event_source?: string;
      newtab_visit_id?: string;
      section?: string;
      section_position?: string;
    }>;
    sectionsUnfollowSection: GleanEventWithExtras<{
      content_redacted?: string;
      event_source?: string;
      newtab_visit_id?: string;
      section?: string;
      section_position?: string;
    }>;
    selectedTopics: GleanStringList;
    sovAllocation: GleanStringList;
    sponsNavTrafficRecvd: GleanMemoryDistribution;
    sponsNavTrafficSent: GleanMemoryDistribution;
    tooltipClick: GleanEventWithExtras<{ feature?: string; newtab_visit_id?: string }>;
    topicSelectionDismiss: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    topicSelectionOpen: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    topicSelectionTopicsSaved: GleanEventWithExtras<{
      first_save?: string;
      newtab_visit_id?: string;
      previous_topics?: string;
      topics?: string;
    }>;
    trendingSearchDismiss: GleanEventWithExtras<{ newtab_visit_id?: string; variant?: string }>;
    trendingSearchImpression: GleanEventWithExtras<{ newtab_visit_id?: string; variant?: string }>;
    trendingSearchSuggestionOpen: GleanEventWithExtras<{
      newtab_visit_id?: string;
      variant?: string;
    }>;
    wallpaperCategoryClick: GleanEventWithExtras<{
      newtab_visit_id?: string;
      selected_category?: string;
    }>;
    wallpaperClick: GleanEventWithExtras<{
      had_previous_wallpaper?: string;
      had_uploaded_previously?: string;
      newtab_visit_id?: string;
      selected_wallpaper?: string;
    }>;
    wallpaperHighlightCtaClick: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    wallpaperHighlightDismissed: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    weatherChangeDisplay: GleanEventWithExtras<{
      newtab_visit_id?: string;
      weather_display_mode?: string;
    }>;
    weatherEnabled: GleanBoolean;
    weatherImpression: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    weatherLoadError: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    weatherLocationSelected: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    weatherOpenProviderUrl: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    widgetsListsChangeDisplay: GleanEventWithExtras<{
      display_status?: string;
      newtab_visit_id?: string;
    }>;
    widgetsListsImpression: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    widgetsListsUserEvent: GleanEventWithExtras<{ newtab_visit_id?: string; user_action?: string }>;
    widgetsTimerChangeDisplay: GleanEventWithExtras<{
      display_status?: string;
      newtab_visit_id?: string;
    }>;
    widgetsTimerImpression: GleanEventWithExtras<{ newtab_visit_id?: string }>;
    widgetsTimerToggleNotification: GleanEventWithExtras<{
      display_status?: string;
      newtab_visit_id?: string;
    }>;
    widgetsTimerUserEvent: GleanEventWithExtras<{ newtab_visit_id?: string; user_action?: string }>;
  };

  newtabHandoffPreference: {
    enabled: GleanBoolean;
  };

  newtabSearch: {
    enabled: GleanBoolean;
    issued: GleanEventWithExtras<{
      newtab_visit_id?: string;
      search_access_point?: string;
      telemetry_id?: string;
    }>;
  };

  newtabContent: {
    click: GleanEventWithExtras<{
      corpus_item_id?: string;
      format?: string;
      is_list_card?: string;
      is_section_followed?: string;
      is_sponsored?: string;
      matches_selected_topic?: string;
      position?: string;
      received_rank?: string;
      recommendation_id?: string;
      recommended_at?: string;
      scheduled_corpus_item_id?: string;
      section?: string;
      section_position?: string;
      selected_topics?: string;
      tile_id?: string;
      topic?: string;
    }>;
    coarseOs: GleanString;
    country: GleanString;
    dismiss: GleanEventWithExtras<{
      corpus_item_id?: string;
      format?: string;
      is_section_followed?: string;
      is_sponsored?: string;
      position?: string;
      received_rank?: string;
      recommendation_id?: string;
      recommended_at?: string;
      scheduled_corpus_item_id?: string;
      section?: string;
      section_position?: string;
      tile_id?: string;
    }>;
    experimentBranch: GleanString;
    experimentName: GleanString;
    followedSections: GleanStringList;
    impression: GleanEventWithExtras<{
      corpus_item_id?: string;
      format?: string;
      is_list_card?: string;
      is_section_followed?: string;
      is_sponsored?: string;
      position?: string;
      received_rank?: string;
      recommendation_id?: string;
      recommended_at?: string;
      scheduled_corpus_item_id?: string;
      section?: string;
      section_position?: string;
      selected_topics?: string;
      tile_id?: string;
      topic?: string;
    }>;
    inferredInterests: GleanObject;
    pingVersion: GleanQuantity;
    reportContentOpen: GleanEventWithExtras<{
      corpus_item_id?: string;
      scheduled_corpus_item_id?: string;
    }>;
    reportContentSubmit: GleanEventWithExtras<{
      card_type?: string;
      corpus_item_id?: string;
      report_reason?: string;
      scheduled_corpus_item_id?: string;
      section?: string;
      section_position?: string;
      title?: string;
      topic?: string;
      url?: string;
    }>;
    sectionsBlockSection: GleanEventWithExtras<{
      event_source?: string;
      section?: string;
      section_position?: string;
    }>;
    sectionsFollowSection: GleanEventWithExtras<{
      event_source?: string;
      section?: string;
      section_position?: string;
    }>;
    sectionsImpression: GleanEventWithExtras<{
      is_section_followed?: string;
      layout_name?: string;
      section?: string;
      section_position?: string;
    }>;
    sectionsUnblockSection: GleanEventWithExtras<{
      event_source?: string;
      section?: string;
      section_position?: string;
    }>;
    sectionsUnfollowSection: GleanEventWithExtras<{
      event_source?: string;
      section?: string;
      section_position?: string;
    }>;
    surfaceId: GleanString;
    thumbVotingInteraction: GleanEventWithExtras<{
      corpus_item_id?: string;
      format?: string;
      is_list_card?: string;
      is_section_followed?: string;
      position?: string;
      received_rank?: string;
      recommendation_id?: string;
      recommended_at?: string;
      scheduled_corpus_item_id?: string;
      section?: string;
      section_position?: string;
      thumbs_down?: string;
      thumbs_up?: string;
      tile_id?: string;
      topic?: string;
    }>;
    utcOffset: GleanQuantity;
  };

  pocket: {
    click: GleanEventWithExtras<{
      content_redacted?: string;
      corpus_item_id?: string;
      event_source?: string;
      format?: string;
      is_list_card?: string;
      is_section_followed?: string;
      is_sponsored?: string;
      layout_name?: string;
      matches_selected_topic?: string;
      newtab_visit_id?: string;
      position?: string;
      received_rank?: string;
      recommendation_id?: string;
      recommended_at?: string;
      scheduled_corpus_item_id?: string;
      section?: string;
      section_position?: string;
      selected_topics?: string;
      tile_id?: string;
      topic?: string;
    }>;
    dismiss: GleanEventWithExtras<{
      corpus_item_id?: string;
      format?: string;
      is_list_card?: string;
      is_section_followed?: string;
      is_sponsored?: string;
      newtab_visit_id?: string;
      position?: string;
      received_rank?: string;
      recommendation_id?: string;
      recommended_at?: string;
      scheduled_corpus_item_id?: string;
      section?: string;
      section_position?: string;
      tile_id?: string;
    }>;
    enabled: GleanBoolean;
    fetchTimestamp: GleanDatetime;
    impression: GleanEventWithExtras<{
      content_redacted?: string;
      corpus_item_id?: string;
      format?: string;
      is_list_card?: string;
      is_section_followed?: string;
      is_sponsored?: string;
      layout_name?: string;
      newtab_visit_id?: string;
      position?: string;
      received_rank?: string;
      recommendation_id?: string;
      recommended_at?: string;
      scheduled_corpus_item_id?: string;
      section?: string;
      section_position?: string;
      selected_topics?: string;
      tile_id?: string;
      topic?: string;
    }>;
    isSignedIn: GleanBoolean;
    newtabCreationTimestamp: GleanDatetime;
    save: GleanEventWithExtras<{
      corpus_item_id?: string;
      format?: string;
      is_list_card?: string;
      is_section_followed?: string;
      is_sponsored?: string;
      matches_selected_topic?: string;
      newtab_visit_id?: string;
      position?: string;
      received_rank?: string;
      recommendation_id?: string;
      recommended_at?: string;
      scheduled_corpus_item_id?: string;
      section?: string;
      section_position?: string;
      selected_topics?: string;
      tile_id?: string;
      topic?: string;
    }>;
    shim: GleanText;
    sponsoredStoriesEnabled: GleanBoolean;
    thumbVotingInteraction: GleanEventWithExtras<{
      content_redacted?: string;
      corpus_item_id?: string;
      format?: string;
      is_list_card?: string;
      is_section_followed?: string;
      newtab_visit_id?: string;
      position?: string;
      received_rank?: string;
      recommendation_id?: string;
      recommended_at?: string;
      scheduled_corpus_item_id?: string;
      section?: string;
      section_position?: string;
      thumbs_down?: string;
      thumbs_up?: string;
      tile_id?: string;
      topic?: string;
    }>;
    topicClick: GleanEventWithExtras<{ newtab_visit_id?: string; topic?: string }>;
  };

  topSites: {
    advertiser: GleanString;
    contextId: GleanUuid;
    pingType: GleanString;
    position: GleanQuantity;
    reportingUrl: GleanUrl;
    source: GleanString;
    tileId: GleanString;
  };

  topsites: {
    add: GleanEventWithExtras<{
      advertiser_name?: string;
      is_sponsored?: string;
      newtab_visit_id?: string;
      position?: string;
      tile_id?: string;
    }>;
    click: GleanEventWithExtras<{
      advertiser_name?: string;
      is_pinned?: string;
      is_sponsored?: string;
      newtab_visit_id?: string;
      position?: string;
      tile_id?: string;
      visible_topsites?: string;
    }>;
    dismiss: GleanEventWithExtras<{
      advertiser_name?: string;
      content_redacted?: string;
      is_sponsored?: string;
      newtab_visit_id?: string;
      position?: string;
      tile_id?: string;
    }>;
    edit: GleanEventWithExtras<{
      advertiser_name?: string;
      has_title_changed?: string;
      has_url_changed?: string;
      is_sponsored?: string;
      newtab_visit_id?: string;
      position?: string;
      tile_id?: string;
    }>;
    enabled: GleanBoolean;
    impression: GleanEventWithExtras<{
      advertiser_name?: string;
      is_pinned?: string;
      is_sponsored?: string;
      newtab_visit_id?: string;
      position?: string;
      tile_id?: string;
      visible_topsites?: string;
    }>;
    pin: GleanEventWithExtras<{
      advertiser_name?: string;
      is_sponsored?: string;
      newtab_visit_id?: string;
      position?: string;
      tile_id?: string;
    }>;
    prefChanged: GleanEventWithExtras<{ new_value?: string; pref_name?: string }>;
    rows: GleanQuantity;
    showPrivacyClick: GleanEventWithExtras<{
      advertiser_name?: string;
      newtab_visit_id?: string;
      position?: string;
      tile_id?: string;
    }>;
    sponsoredEnabled: GleanBoolean;
    sponsoredTilesConfigured: GleanQuantity;
    sponsoredTilesReceived: GleanText;
    unpin: GleanEventWithExtras<{
      advertiser_name?: string;
      is_sponsored?: string;
      newtab_visit_id?: string;
      position?: string;
      tile_id?: string;
    }>;
  };

  bookmarksSidebar: {
    cumulativeSearches: GleanCustomDistribution;
  };

  bookmarksToolbar: {
    init: GleanTimingDistribution;
  };

  historySidebar: {
    cumulativeFilterCount: GleanCustomDistribution;
    cumulativeSearches: GleanCustomDistribution;
    filterType: Record<'day' | 'dayandsite' | 'lastvisited' | 'site' | 'visited', GleanCounter>;
    lastvisitedTreeQueryTime: GleanTimingDistribution;
  };

  library: {
    cumulativeBookmarkSearches: GleanCustomDistribution;
    cumulativeHistorySearches: GleanCustomDistribution;
    historySearchTime: GleanTimingDistribution;
    link: Record<string, GleanCounter>;
    opened: Record<string, GleanCounter>;
    search: Record<string, GleanCounter>;
  };

  aboutpreferences: {
    showClick: GleanEventWithExtras<{ value?: string }>;
    showHash: GleanEventWithExtras<{ value?: string }>;
    showInitial: GleanEventWithExtras<{ value?: string }>;
  };

  intlUiBrowserLanguage: {
    acceptDialog: GleanEventWithExtras<{ value?: string }>;
    addDialog: GleanEventWithExtras<{ installId?: string; value?: string }>;
    applyMain: GleanEventNoExtras;
    cancelDialog: GleanEventWithExtras<{ value?: string }>;
    manageMain: GleanEventWithExtras<{ value?: string }>;
    removeDialog: GleanEventWithExtras<{ value?: string }>;
    reorderDialog: GleanEventWithExtras<{ value?: string }>;
    reorderMain: GleanEventNoExtras;
    searchDialog: GleanEventWithExtras<{ value?: string }>;
    searchMain: GleanEventWithExtras<{ value?: string }>;
    setFallbackDialog: GleanEventWithExtras<{ value?: string }>;
  };

  networkProxySettings: {
    proxyTypePreference: GleanEventWithExtras<{ value?: string }>;
  };

  privacyUiFppClick: {
    checkbox: GleanEventWithExtras<{ checked?: string }>;
    menu: GleanEventWithExtras<{ value?: string }>;
  };

  securityDohSettings: {
    modeChangedButton: GleanEventWithExtras<{ value?: string }>;
    providerChoiceValue: GleanEventWithExtras<{ value?: string }>;
  };

  aboutprivatebrowsing: {
    clickDismissButton: GleanEventNoExtras;
    clickInfoLink: GleanEventNoExtras;
    clickPromoLink: GleanEventNoExtras;
  };

  privateBrowsingResetPbm: {
    confirmPanel: GleanEventWithExtras<{ action?: string; reason?: string }>;
    resetAction: GleanEventWithExtras<{ did_confirm?: string }>;
  };

  profileLock: {
    failedLockCount: GleanQuantity;
  };

  profilesDefault: {
    updated: GleanEventNoExtras;
  };

  profilesDelete: {
    cancel: GleanEventNoExtras;
    confirm: GleanEventNoExtras;
    displayed: GleanEventNoExtras;
  };

  profilesExisting: {
    alert: GleanEventWithExtras<{ value?: string }>;
    avatar: GleanEventWithExtras<{ value?: string }>;
    closed: GleanEventWithExtras<{ value?: string }>;
    deleted: GleanEventNoExtras;
    displayed: GleanEventNoExtras;
    learnMore: GleanEventNoExtras;
    name: GleanEventNoExtras;
    theme: GleanEventWithExtras<{ value?: string }>;
  };

  profilesNew: {
    alert: GleanEventWithExtras<{ value?: string }>;
    avatar: GleanEventWithExtras<{ value?: string }>;
    closed: GleanEventWithExtras<{ value?: string }>;
    deleted: GleanEventNoExtras;
    displayed: GleanEventNoExtras;
    learnMore: GleanEventNoExtras;
    name: GleanEventNoExtras;
    theme: GleanEventWithExtras<{ value?: string }>;
  };

  profilesSelectorWindow: {
    launch: GleanEventNoExtras;
    showAtStartup: GleanEventWithExtras<{ value?: string }>;
  };

  securityUiProtections: {
    clickLwAboutLink: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickLwOpenButton: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickLwSyncLink: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickMobileAppLink: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickMtrAboutLink: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickMtrReportLink: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickMtrSignupButton: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickSettingsLink: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickTrackersAboutLink: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickVpnAppLinkAndroid: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickVpnAppLinkIos: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickVpnBannerClose: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickVpnBannerLink: GleanEventWithExtras<{ category?: string; value?: string }>;
    clickVpnCardLink: GleanEventWithExtras<{ category?: string; value?: string }>;
    closeProtectionReport: GleanEventWithExtras<{ category?: string; value?: string }>;
    showProtectionReport: GleanEventWithExtras<{ category?: string; value?: string }>;
    showVpnBanner: GleanEventWithExtras<{ category?: string; value?: string }>;
  };

  protocolhandlerMailto: {
    handlerPromptShown: Record<'fx_default' | 'os_default', GleanCounter>;
    promptClicked: Record<
      | 'dismiss_local_default'
      | 'dismiss_os_default'
      | 'set_local_default'
      | 'set_os_default'
      | 'set_os_default_error'
      | 'set_os_default_impossible',
      GleanCounter
    >;
    visit: GleanEventWithExtras<{ triggered_externally?: string }>;
  };

  screenshots: {
    canceledContextMenu: GleanEventNoExtras;
    canceledEscape: GleanEventNoExtras;
    canceledNavigation: GleanEventNoExtras;
    canceledOverlayCancel: GleanEventNoExtras;
    canceledPreviewCancel: GleanEventNoExtras;
    canceledQuickActions: GleanEventNoExtras;
    canceledShortcut: GleanEventNoExtras;
    canceledToolbarButton: GleanEventNoExtras;
    copyOverlayCopy: GleanEventWithExtras<{
      element?: string;
      fullpage?: string;
      move?: string;
      region?: string;
      resize?: string;
      visible?: string;
    }>;
    copyPreviewCopy: GleanEventWithExtras<{
      element?: string;
      fullpage?: string;
      move?: string;
      region?: string;
      resize?: string;
      visible?: string;
    }>;
    downloadOverlayDownload: GleanEventWithExtras<{
      element?: string;
      fullpage?: string;
      move?: string;
      region?: string;
      resize?: string;
      visible?: string;
    }>;
    downloadPreviewDownload: GleanEventWithExtras<{
      element?: string;
      fullpage?: string;
      move?: string;
      region?: string;
      resize?: string;
      visible?: string;
    }>;
    failedScreenshotTooLarge: GleanEventNoExtras;
    selectedElement: GleanEventNoExtras;
    selectedFullPage: GleanEventNoExtras;
    selectedRegionSelection: GleanEventNoExtras;
    selectedVisible: GleanEventNoExtras;
    startedContextMenu: GleanEventNoExtras;
    startedOverlayRetry: GleanEventNoExtras;
    startedPreviewRetry: GleanEventNoExtras;
    startedQuickActions: GleanEventNoExtras;
    startedShortcut: GleanEventNoExtras;
    startedToolbarButton: GleanEventNoExtras;
  };

  browserEngagementNavigation: {
    aboutHome: Record<string, GleanCounter>;
    aboutNewtab: Record<string, GleanCounter>;
    contextmenu: Record<string, GleanCounter>;
    contextmenuVisual: Record<string, GleanCounter>;
    searchbar: Record<string, GleanCounter>;
    urlbar: Record<string, GleanCounter>;
    urlbarHandoff: Record<string, GleanCounter>;
    urlbarPersisted: Record<string, GleanCounter>;
    urlbarSearchmode: Record<string, GleanCounter>;
    webextension: Record<string, GleanCounter>;
  };

  browserSearchAdclicks: {
    aboutHome: Record<string, GleanCounter>;
    aboutNewtab: Record<string, GleanCounter>;
    contextmenu: Record<string, GleanCounter>;
    contextmenuVisual: Record<string, GleanCounter>;
    reload: Record<string, GleanCounter>;
    searchbar: Record<string, GleanCounter>;
    system: Record<string, GleanCounter>;
    tabhistory: Record<string, GleanCounter>;
    unknown: Record<string, GleanCounter>;
    urlbar: Record<string, GleanCounter>;
    urlbarHandoff: Record<string, GleanCounter>;
    urlbarPersisted: Record<string, GleanCounter>;
    urlbarSearchmode: Record<string, GleanCounter>;
    webextension: Record<string, GleanCounter>;
  };

  browserSearchContent: {
    aboutHome: Record<string, GleanCounter>;
    aboutNewtab: Record<string, GleanCounter>;
    contextmenu: Record<string, GleanCounter>;
    contextmenuVisual: Record<string, GleanCounter>;
    reload: Record<string, GleanCounter>;
    searchbar: Record<string, GleanCounter>;
    system: Record<string, GleanCounter>;
    tabhistory: Record<string, GleanCounter>;
    unknown: Record<string, GleanCounter>;
    urlbar: Record<string, GleanCounter>;
    urlbarHandoff: Record<string, GleanCounter>;
    urlbarPersisted: Record<string, GleanCounter>;
    urlbarSearchmode: Record<string, GleanCounter>;
    webextension: Record<string, GleanCounter>;
  };

  browserSearchWithads: {
    aboutHome: Record<string, GleanCounter>;
    aboutNewtab: Record<string, GleanCounter>;
    contextmenu: Record<string, GleanCounter>;
    contextmenuVisual: Record<string, GleanCounter>;
    reload: Record<string, GleanCounter>;
    searchbar: Record<string, GleanCounter>;
    system: Record<string, GleanCounter>;
    tabhistory: Record<string, GleanCounter>;
    unknown: Record<string, GleanCounter>;
    urlbar: Record<string, GleanCounter>;
    urlbarHandoff: Record<string, GleanCounter>;
    urlbarPersisted: Record<string, GleanCounter>;
    urlbarSearchmode: Record<string, GleanCounter>;
    webextension: Record<string, GleanCounter>;
  };

  newtabSearchAd: {
    click: GleanEventWithExtras<{
      is_follow_on?: string;
      is_tagged?: string;
      newtab_visit_id?: string;
      search_access_point?: string;
      telemetry_id?: string;
    }>;
    impression: GleanEventWithExtras<{
      is_follow_on?: string;
      is_tagged?: string;
      newtab_visit_id?: string;
      search_access_point?: string;
      telemetry_id?: string;
    }>;
  };

  sap: {
    counts: GleanEventWithExtras<{
      overridden_by_third_party?: string;
      partner_code?: string;
      provider_id?: string;
      provider_name?: string;
      source?: string;
    }>;
    deprecatedCounts: Record<string, GleanCounter>;
    searchFormCounts: GleanEventWithExtras<{ provider_id?: string; source?: string }>;
  };

  sapImpressionCounts: {
    contextmenuVisual: Record<string, GleanCounter>;
  };

  searchWith: {
    contextId: GleanUuid;
    reportingUrl: GleanUrl;
  };

  searchbar: {
    selectedResultMethod: Record<'click' | 'enter' | 'enterSelection', GleanCounter>;
  };

  serp: {
    abandonment: GleanEventWithExtras<{ impression_id?: string; reason?: string }>;
    adImpression: GleanEventWithExtras<{
      ads_hidden?: string;
      ads_loaded?: string;
      ads_visible?: string;
      component?: string;
      impression_id?: string;
    }>;
    adsBlockedCount: Record<'beyond_viewport' | 'hidden_child' | 'hidden_parent', GleanCounter>;
    categorization: GleanEventWithExtras<{
      app_version?: string;
      channel?: string;
      is_shopping_page?: string;
      mappings_version?: string;
      num_ads_clicked?: string;
      num_ads_hidden?: string;
      num_ads_loaded?: string;
      num_ads_visible?: string;
      organic_category?: string;
      organic_num_domains?: string;
      organic_num_inconclusive?: string;
      organic_num_unknown?: string;
      partner_code?: string;
      provider?: string;
      region?: string;
      sponsored_category?: string;
      sponsored_num_domains?: string;
      sponsored_num_inconclusive?: string;
      sponsored_num_unknown?: string;
      tagged?: string;
    }>;
    categorizationDuration: GleanTimingDistribution;
    categorizationNoMapFound: GleanCounter;
    engagement: GleanEventWithExtras<{ action?: string; impression_id?: string; target?: string }>;
    experimentInfo: GleanObject;
    impression: GleanEventWithExtras<{
      impression_id?: string;
      is_private?: string;
      is_shopping_page?: string;
      is_signed_in?: string;
      partner_code?: string;
      provider?: string;
      search_mode?: string;
      shopping_tab_displayed?: string;
      source?: string;
      tagged?: string;
    }>;
  };

  urlbarSearchmode: {
    bookmarkmenu: Record<string, GleanCounter>;
    handoff: Record<string, GleanCounter>;
    historymenu: Record<string, GleanCounter>;
    keywordoffer: Record<string, GleanCounter>;
    oneoff: Record<string, GleanCounter>;
    other: Record<string, GleanCounter>;
    searchbutton: Record<string, GleanCounter>;
    shortcut: Record<string, GleanCounter>;
    tabmenu: Record<string, GleanCounter>;
    tabtosearch: Record<string, GleanCounter>;
    tabtosearchOnboard: Record<string, GleanCounter>;
    topsitesNewtab: Record<string, GleanCounter>;
    topsitesUrlbar: Record<string, GleanCounter>;
    touchbar: Record<string, GleanCounter>;
    typed: Record<string, GleanCounter>;
  };

  sessionRestore: {
    allFilesCorrupt: Record<'false' | 'true', GleanCounter>;
    autoRestoreDurationUntilEagerTabsRestored: GleanTimingDistribution;
    backupCanBeLoadedSessionFile: GleanEventWithExtras<{
      can_load?: string;
      loadfail_reason?: string;
      path_key?: string;
    }>;
    collectAllWindowsData: GleanTimingDistribution;
    collectData: GleanTimingDistribution;
    collectSessionHistory: GleanTimingDistribution;
    corruptFile: Record<'false' | 'true', GleanCounter>;
    fileSizeBytes: GleanMemoryDistribution;
    manualRestoreDurationUntilEagerTabsRestored: GleanTimingDistribution;
    numberOfEagerTabsRestored: GleanCustomDistribution;
    numberOfTabsRestored: GleanCustomDistribution;
    numberOfWindowsRestored: GleanCustomDistribution;
    readFile: GleanTimingDistribution;
    restoreWindow: GleanTimingDistribution;
    shutdownFlushAllOutcomes: Record<
      'abnormal_content_shutdown' | 'complete' | 'oop_frameloader_crashed' | 'timed_out',
      GleanCounter
    >;
    shutdownOk: Record<'false' | 'true', GleanCounter>;
    shutdownSuccessSessionStartup: GleanEventWithExtras<{
      shutdown_ok?: string;
      shutdown_reason?: string;
    }>;
    shutdownType: Record<'async' | 'sync', GleanCounter>;
    startupInitSession: GleanTimingDistribution;
    startupOnloadInitialWindow: GleanTimingDistribution;
    startupTimeline: Record<'sessionRestoreInitialized' | 'sessionRestoreRestoring', GleanQuantity>;
    writeFile: GleanTimingDistribution;
  };

  bookmarks: {
    sidebarToggle: GleanEventWithExtras<{ opened?: string; version?: string }>;
  };

  contextualManager: {
    passwordsEnabled: GleanEventWithExtras<{ checked?: string }>;
    sidebarToggle: GleanEventWithExtras<{ opened?: string }>;
    notificationInteraction: GleanEventWithExtras<{
      action_type?: string;
      notification_detail?: string;
    }>;
    notificationShown: GleanEventWithExtras<{ notification_detail?: string }>;
    recordsInteraction: GleanEventWithExtras<{ interaction_type?: string }>;
    recordsUpdate: GleanEventWithExtras<{ change_type?: string }>;
    toolbarAction: GleanEventWithExtras<{ option_name?: string; trigger?: string }>;
  };

  extension: {
    sidebarToggle: GleanEventWithExtras<{
      addon_id?: string;
      addon_name?: string;
      opened?: string;
      version?: string;
    }>;
  };

  history: {
    sidebarToggle: GleanEventWithExtras<{ opened?: string; version?: string }>;
  };

  pinnedTabs: {
    activations: Record<'horizontal_bar' | 'sidebar', GleanCounter>;
    close: GleanEventWithExtras<{ layout?: string }>;
    count: Record<'horizontal_bar' | 'sidebar', GleanQuantity>;
    pin: GleanEventWithExtras<{ layout?: string; source?: string }>;
  };

  sidebar: {
    addonIconClick: GleanEventWithExtras<{ addon_id?: string; sidebar_open?: string }>;
    bookmarksIconClick: GleanEventWithExtras<{ sidebar_open?: string }>;
    chatbotIconClick: GleanEventWithExtras<{ sidebar_open?: string }>;
    displaySettings: GleanString;
    expand: GleanEventNoExtras;
    historyIconClick: GleanEventWithExtras<{ sidebar_open?: string }>;
    keyboardShortcut: GleanEventWithExtras<{ opened?: string; panel?: string }>;
    link: Record<string, GleanCounter>;
    positionSettings: GleanString;
    resize: GleanEventWithExtras<{ current?: string; percentage?: string; previous?: string }>;
    search: Record<string, GleanCounter>;
    syncedTabsIconClick: GleanEventWithExtras<{ sidebar_open?: string }>;
    tabsLayout: GleanString;
    width: GleanQuantity;
  };

  sidebarCustomize: {
    bookmarksEnabled: GleanEventWithExtras<{ checked?: string }>;
    chatbotEnabled: GleanEventWithExtras<{ checked?: string }>;
    expandOnHoverEnabled: GleanEventWithExtras<{ checked?: string }>;
    extensionsClicked: GleanEventNoExtras;
    firefoxSettingsClicked: GleanEventNoExtras;
    historyEnabled: GleanEventWithExtras<{ checked?: string }>;
    iconClick: GleanEventNoExtras;
    panelToggle: GleanEventWithExtras<{ opened?: string }>;
    sidebarDisplay: GleanEventWithExtras<{ preference?: string }>;
    sidebarPosition: GleanEventWithExtras<{ position?: string }>;
    syncedTabsEnabled: GleanEventWithExtras<{ checked?: string }>;
    tabsDisplay: GleanEventWithExtras<{ checked?: string }>;
    tabsLayout: GleanEventWithExtras<{ orientation?: string }>;
  };

  syncedTabs: {
    sidebarToggle: GleanEventWithExtras<{
      opened?: string;
      synced_tabs_loaded?: string;
      version?: string;
    }>;
    clickFxaAppMenu: GleanEventWithExtras<{ filter?: string; tab_pos?: string }>;
    clickFxaAvatarMenu: GleanEventWithExtras<{ filter?: string; tab_pos?: string }>;
    clickSyncedTabsSidebar: GleanEventWithExtras<{ filter?: string; tab_pos?: string }>;
  };

  browserTabclose: {
    permitUnloadTime: GleanTimingDistribution;
    timeAnim: GleanTimingDistribution;
    timeNoAnim: GleanTimingDistribution;
  };

  browserTabswitch: {
    spinnerVisible: GleanTimingDistribution;
    spinnerVisibleTrigger: Record<
      | 'none'
      | 'onEndSwapDocShells'
      | 'onLayersReady'
      | 'onLoadTimeout'
      | 'onSizeModeOrOcc'
      | 'postActions'
      | 'preActions',
      GleanCounter
    >;
    total: GleanTimingDistribution;
    update: GleanTimingDistribution;
  };

  browserUiInteraction: {
    allTabsPanelDragstartTabEventCount: GleanCounter;
    allTabsPanelEntrypoint: Record<string, GleanCounter>;
    textrecognitionError: GleanCounter;
    appMenu: Record<string, GleanCounter>;
    bookmarksBar: Record<string, GleanCounter>;
    contentContext: Record<string, GleanCounter>;
    menuBar: Record<string, GleanCounter>;
    navBar: Record<string, GleanCounter>;
    overflowMenu: Record<string, GleanCounter>;
    pageactionPanel: Record<string, GleanCounter>;
    pageactionUrlbar: Record<string, GleanCounter>;
    pinnedOverflowMenu: Record<string, GleanCounter>;
    preferencesPaneContainers: Record<string, GleanCounter>;
    preferencesPaneExperimental: Record<string, GleanCounter>;
    preferencesPaneGeneral: Record<string, GleanCounter>;
    preferencesPaneHome: Record<string, GleanCounter>;
    preferencesPaneMoreFromMozilla: Record<string, GleanCounter>;
    preferencesPanePrivacy: Record<string, GleanCounter>;
    preferencesPaneSearch: Record<string, GleanCounter>;
    preferencesPaneSearchResults: Record<string, GleanCounter>;
    preferencesPaneSync: Record<string, GleanCounter>;
    preferencesPaneUnknown: Record<string, GleanCounter>;
    tabsBar: Record<string, GleanCounter>;
    tabsContext: Record<string, GleanCounter>;
    tabsContextEntrypoint: Record<string, GleanCounter>;
    unifiedExtensionsArea: Record<string, GleanCounter>;
    verticalTabsContainer: Record<string, GleanCounter>;
    keyboard: Record<string, GleanCounter>;
  };

  tabgroup: {
    activeGroups: Record<'collapsed' | 'expanded', GleanQuantity>;
    addTab: GleanEventWithExtras<{
      group_type?: string;
      layout?: string;
      source?: string;
      tabs?: string;
    }>;
    createGroup: GleanEventWithExtras<{
      id?: string;
      layout?: string;
      source?: string;
      tabs?: string;
    }>;
    delete: GleanEventWithExtras<{ id?: string; source?: string }>;
    groupInteractions: Record<
      | 'change_color'
      | 'collapse'
      | 'delete'
      | 'expand'
      | 'hover_preview'
      | 'move_window'
      | 'open_recent'
      | 'open_suggest'
      | 'open_tabmenu'
      | 'rename'
      | 'reopen'
      | 'save'
      | 'ungroup',
      GleanCounter
    >;
    reopen: GleanEventWithExtras<{ id?: string; layout?: string; source?: string; type?: string }>;
    save: GleanEventWithExtras<{ id?: string; user_triggered?: string }>;
    savedGroups: GleanQuantity;
    smartTab: GleanEventWithExtras<{ enabled?: string }>;
    smartTabEnabled: GleanBoolean;
    smartTabOptin: GleanEventWithExtras<{ step?: string }>;
    smartTabSuggest: GleanEventWithExtras<{
      action?: string;
      backend?: string;
      id?: string;
      model_revision?: string;
      tabs_approved?: string;
      tabs_in_group?: string;
      tabs_in_window?: string;
      tabs_removed?: string;
      tabs_suggested?: string;
    }>;
    smartTabTopic: GleanEventWithExtras<{
      action?: string;
      backend?: string;
      id?: string;
      label_reason?: string;
      levenshtein_distance?: string;
      ml_label_length?: string;
      model_revision?: string;
      tabs_in_group?: string;
      user_label_length?: string;
    }>;
    tabCountInGroups: Record<'inside' | 'outside', GleanQuantity>;
    tabInteractions: Record<
      | 'activate_collapsed'
      | 'activate_expanded'
      | 'add'
      | 'close_tab_other'
      | 'close_tabmenu'
      | 'close_tabstrip'
      | 'duplicate'
      | 'new'
      | 'remove_new_window'
      | 'remove_other_window'
      | 'remove_same_window'
      | 'reorder',
      GleanCounter
    >;
    tabsPerActiveGroup: Record<'average' | 'max' | 'median' | 'min', GleanQuantity>;
    tabsPerSavedGroup: Record<'average' | 'max' | 'median' | 'min', GleanQuantity>;
    ungroup: GleanEventWithExtras<{ source?: string }>;
  };

  webApp: {
    activate: GleanEventNoExtras;
    eject: GleanEventNoExtras;
    install: GleanEventNoExtras;
    moveToTaskbar: GleanEventNoExtras;
    pin: GleanEventWithExtras<{ result?: string }>;
    uninstall: GleanEventNoExtras;
    unpin: GleanEventWithExtras<{ result?: string }>;
    usageTime: GleanTimingDistribution;
  };

  textRecognition: {
    apiPerformance: GleanTimingDistribution;
    interactionTiming: GleanTimingDistribution;
    textLength: GleanCustomDistribution;
  };

  quickSuggest: {
    advertiser: GleanString;
    blockId: GleanString;
    contextId: GleanUuid;
    country: GleanString;
    iabCategory: GleanString;
    improveSuggestExperience: GleanBoolean;
    isClicked: GleanBoolean;
    matchType: GleanString;
    pingType: GleanString;
    position: GleanQuantity;
    reportingUrl: GleanUrl;
    requestId: GleanString;
    source: GleanString;
    suggestedIndex: GleanString;
    suggestedIndexRelativeToGroup: GleanBoolean;
  };

  suggest: {
    ingestDownloadTime: Record<
      | 'amo-suggestions'
      | 'amp'
      | 'configuration'
      | 'icon'
      | 'mdn-suggestions'
      | 'weather'
      | 'wikipedia'
      | 'yelp-suggestions',
      GleanTimingDistribution
    >;
    ingestTime: Record<
      | 'amo-suggestions'
      | 'amp'
      | 'configuration'
      | 'icon'
      | 'mdn-suggestions'
      | 'weather'
      | 'wikipedia'
      | 'yelp-suggestions',
      GleanTimingDistribution
    >;
    queryTime: Record<
      'amo' | 'amp' | 'mdn' | 'weather' | 'wikipedia' | 'yelp',
      GleanTimingDistribution
    >;
  };

  suggestRelevance: {
    outcome: Record<'boosted' | 'decreased', GleanCounter>;
    status: Record<'failure' | 'success', GleanCounter>;
  };

  urlbar: {
    abandonment: GleanEventWithExtras<{
      abandonment_type?: string;
      actions?: string;
      available_semantic_sources?: string;
      groups?: string;
      interaction?: string;
      n_chars?: string;
      n_results?: string;
      n_words?: string;
      results?: string;
      sap?: string;
      search_engine_default_id?: string;
      search_mode?: string;
    }>;
    autocompleteFirstResultTime: GleanTimingDistribution;
    autocompleteSixthResultTime: GleanTimingDistribution;
    autofillDeletion: GleanCounter;
    bounce: GleanEventWithExtras<{
      engagement_type?: string;
      interaction?: string;
      n_chars?: string;
      n_results?: string;
      n_words?: string;
      provider?: string;
      results?: string;
      sap?: string;
      search_engine_default_id?: string;
      search_mode?: string;
      selected_position?: string;
      selected_result?: string;
      threshold?: string;
      view_time?: string;
    }>;
    disable: GleanEventWithExtras<{
      feature?: string;
      interaction?: string;
      n_chars?: string;
      n_results?: string;
      n_words?: string;
      results?: string;
      sap?: string;
      search_engine_default_id?: string;
      search_mode?: string;
      selected_result?: string;
    }>;
    engagement: GleanEventWithExtras<{
      actions?: string;
      available_semantic_sources?: string;
      engagement_type?: string;
      groups?: string;
      interaction?: string;
      n_chars?: string;
      n_results?: string;
      n_words?: string;
      provider?: string;
      results?: string;
      sap?: string;
      search_engine_default_id?: string;
      search_mode?: string;
      selected_position?: string;
      selected_result?: string;
    }>;
    exposure: GleanEventWithExtras<{ results?: string; terminal?: string }>;
    heuristicResultMissing: GleanRate;
    keywordExposure: GleanEventWithExtras<{ keyword?: string; result?: string; terminal?: string }>;
    prefMaxResults: GleanQuantity;
    prefSuggestDataCollection: GleanBoolean;
    prefSuggestNonsponsored: GleanBoolean;
    prefSuggestSponsored: GleanBoolean;
    prefSuggestTopsites: GleanBoolean;
    prefSwitchTabsSearchAllContainers: GleanBoolean;
    quickSuggestContextualOptIn: GleanEventWithExtras<{
      interaction?: string;
      say_hello?: string;
      top_position?: string;
    }>;
  };

  urlbarMerino: {
    latencyByResponseStatus: Record<string, GleanTimingDistribution>;
  };

  urlbarPersistedsearchterms: {
    revertByPopupCount: GleanCounter;
    viewCount: GleanCounter;
  };

  urlbarQuickaction: {
    picked: Record<string, GleanCounter>;
  };

  urlbarTrending: {
    block: GleanCounter;
  };

  urlbarUnifiedsearchbutton: {
    opened: GleanCounter;
    picked: Record<string, GleanCounter>;
  };

  urlbarZeroprefix: {
    abandonment: GleanCounter;
    engagement: GleanCounter;
    exposure: GleanCounter;
  };

  dataLeakBlocker: {
    reportV1: GleanEventWithExtras<{
      addon_id?: string;
      blocked?: string;
      content_policy_type?: string;
      is_addon_loading?: string;
      is_addon_triggering?: string;
      is_content_script?: string;
      method?: string;
    }>;
  };

  addonsSearchDetection: {
    etldChangeOther: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      from?: string;
      to?: string;
      value?: string;
    }>;
    etldChangeWebrequest: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      from?: string;
      to?: string;
      value?: string;
    }>;
    sameSiteRedirect: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      origin?: string;
      paramChanged?: string;
    }>;
  };

  browserContentCrash: {
    dumpUnavailable: GleanCounter;
    notSubmitted: GleanCounter;
  };

  browserSanitizer: {
    cache: GleanTimingDistribution;
    cookies: GleanTimingDistribution;
    downloads: GleanTimingDistribution;
    formdata: GleanTimingDistribution;
    history: GleanTimingDistribution;
    openwindows: GleanTimingDistribution;
    sessions: GleanTimingDistribution;
    sitesettings: GleanTimingDistribution;
    total: GleanTimingDistribution;
  };

  browserUi: {
    customizedWidgets: Record<string, GleanCounter>;
    mirrorForToolbarWidgets: Record<string, GleanBoolean>;
    toolbarWidgets: GleanObject;
  };

  browserUsage: {
    interaction: GleanEventWithExtras<{ flow_id?: string; source?: string; widget_id?: string }>;
  };

  contextualServices: {
    contextId: GleanUuid;
  };

  homepage: {
    preferenceIgnore: GleanEventWithExtras<{ value?: string; webExtensionId?: string }>;
  };

  installation: {
    firstSeenFull: GleanEventWithExtras<{
      admin_user?: string;
      build_id?: string;
      default_path?: string;
      from_msi?: string;
      install_existed?: string;
      other_inst?: string;
      other_msix_inst?: string;
      profdir_existed?: string;
      silent?: string;
      version?: string;
    }>;
    firstSeenMsix: GleanEventWithExtras<{
      admin_user?: string;
      build_id?: string;
      default_path?: string;
      from_msi?: string;
      install_existed?: string;
      other_inst?: string;
      other_msix_inst?: string;
      profdir_existed?: string;
      silent?: string;
      version?: string;
    }>;
    firstSeenStub: GleanEventWithExtras<{
      admin_user?: string;
      build_id?: string;
      default_path?: string;
      from_msi?: string;
      install_existed?: string;
      other_inst?: string;
      other_msix_inst?: string;
      profdir_existed?: string;
      silent?: string;
      version?: string;
    }>;
  };

  installationFirstSeen: {
    adminUser: GleanBoolean;
    defaultPath: GleanBoolean;
    failureReason: GleanString;
    fromMsi: GleanBoolean;
    installExisted: GleanBoolean;
    installerType: GleanString;
    otherInst: GleanBoolean;
    otherMsixInst: GleanBoolean;
    profdirExisted: GleanBoolean;
    silent: GleanBoolean;
    version: GleanString;
  };

  linkIconSizesAttr: {
    dimension: GleanCustomDistribution;
    usage: GleanCustomDistribution;
  };

  partnerLink: {
    attributionAbort: GleanEventWithExtras<{ value?: string }>;
    attributionFailure: GleanEventWithExtras<{ value?: string }>;
    attributionSuccess: GleanEventWithExtras<{ value?: string }>;
    clickNewtab: GleanEventWithExtras<{ value?: string }>;
    clickUrlbar: GleanEventWithExtras<{ value?: string }>;
  };

  performanceInteraction: {
    tabSwitchComposite: GleanTimingDistribution;
    keypressPresentLatency: GleanTimingDistribution;
    mouseupClickPresentLatency: GleanTimingDistribution;
  };

  timestamps: {
    aboutHomeTopsitesFirstPaint: GleanQuantity;
    firstPaint: GleanQuantity;
    firstPaintTwo: GleanQuantity;
  };

  devtoolsAccessibility: {
    accessibleContextMenuItemActivated: Record<string, GleanCounter>;
    accessibleContextMenuOpened: GleanCounter;
    auditActivated: Record<string, GleanCounter>;
    nodeInspectedCount: GleanCounter;
    selectAccessibleForNode: Record<string, GleanCounter>;
    simulationActivated: Record<string, GleanCounter>;
    openedCount: GleanCounter;
    pickerUsedCount: GleanCounter;
  };

  devtools: {
    coldToolboxOpenDelay: Record<string, GleanTimingDistribution>;
    currentTheme: Record<string, GleanCounter>;
    toolboxHost: GleanCustomDistribution;
    toolboxPageReloadDelay: Record<string, GleanTimingDistribution>;
    warmToolboxOpenDelay: Record<string, GleanTimingDistribution>;
    aboutdebuggingOpenedCount: GleanCounter;
    aboutdebuggingTimeActive: GleanTimingDistribution;
    accessibilityPickerTimeActive: GleanTimingDistribution;
    accessibilityServiceTimeActive: GleanTimingDistribution;
    accessibilityTimeActive: GleanTimingDistribution;
    animationinspectorOpenedCount: GleanCounter;
    animationinspectorTimeActive: GleanTimingDistribution;
    browserconsoleOpenedCount: GleanCounter;
    browserconsoleTimeActive: GleanTimingDistribution;
    changesviewTimeActive: GleanTimingDistribution;
    compatibilityviewOpenedCount: GleanCounter;
    compatibilityviewTimeActive: GleanTimingDistribution;
    computedviewOpenedCount: GleanCounter;
    computedviewTimeActive: GleanTimingDistribution;
    customOpenedCount: GleanCounter;
    customTimeActive: GleanTimingDistribution;
    domOpenedCount: GleanCounter;
    domTimeActive: GleanTimingDistribution;
    entryPoint: Record<
      | 'CommandLine'
      | 'ContextMenu'
      | 'HamburgerMenu'
      | 'KeyShortcut'
      | 'SessionRestore'
      | 'SlowScript'
      | 'SystemMenu',
      GleanCounter
    >;
    eyedropperOpenedCount: GleanCounter;
    flexboxHighlighterTimeActive: GleanTimingDistribution;
    fontinspectorOpenedCount: GleanCounter;
    fontinspectorTimeActive: GleanTimingDistribution;
    gridHighlighterTimeActive: GleanTimingDistribution;
    inspectorOpenedCount: GleanCounter;
    inspectorTimeActive: GleanTimingDistribution;
    jsbrowserdebuggerOpenedCount: GleanCounter;
    jsbrowserdebuggerTimeActive: GleanTimingDistribution;
    jsdebuggerOpenedCount: GleanCounter;
    jsdebuggerTimeActive: GleanTimingDistribution;
    jsprofilerOpenedCount: GleanCounter;
    jsprofilerTimeActive: GleanTimingDistribution;
    layoutviewOpenedCount: GleanCounter;
    layoutviewTimeActive: GleanTimingDistribution;
    memoryOpenedCount: GleanCounter;
    memoryTimeActive: GleanTimingDistribution;
    menuEyedropperOpenedCount: GleanCounter;
    netmonitorOpenedCount: GleanCounter;
    netmonitorTimeActive: GleanTimingDistribution;
    optionsOpenedCount: GleanCounter;
    optionsTimeActive: GleanTimingDistribution;
    pickerEyedropperOpenedCount: GleanCounter;
    responsiveOpenedCount: GleanCounter;
    responsiveTimeActive: GleanTimingDistribution;
    ruleviewOpenedCount: GleanCounter;
    ruleviewTimeActive: GleanTimingDistribution;
    storageOpenedCount: GleanCounter;
    storageTimeActive: GleanTimingDistribution;
    styleeditorOpenedCount: GleanCounter;
    styleeditorTimeActive: GleanTimingDistribution;
    toolboxOpenedCount: GleanCounter;
    toolboxTimeActive: GleanTimingDistribution;
    webconsoleOpenedCount: GleanCounter;
    webconsoleTimeActive: GleanTimingDistribution;
    heapSnapshotEdgeCount: GleanCustomDistribution;
    heapSnapshotNodeCount: GleanCustomDistribution;
    readHeapSnapshot: GleanTimingDistribution;
    saveHeapSnapshot: GleanTimingDistribution;
  };

  devtoolsTool: {
    registered: Record<string, GleanBoolean>;
  };

  devtoolsToolbox: {
    tabsReordered: Record<string, GleanCounter>;
  };

  devtoolsGridGridinspector: {
    opened: GleanCounter;
  };

  devtoolsInspector: {
    fonteditorFontTypeDisplayed: Record<'nonvariable' | 'variable', GleanCounter>;
    newRootToReloadDelay: GleanTimingDistribution;
    nodeSelectionCount: GleanCounter;
    numberOfCssGridsInAPage: GleanCustomDistribution;
    threePaneEnabled: Record<string, GleanCounter>;
  };

  devtoolsLayoutFlexboxhighlighter: {
    opened: GleanCounter;
  };

  devtoolsMarkupFlexboxhighlighter: {
    opened: GleanCounter;
  };

  devtoolsMarkupGridinspector: {
    opened: GleanCounter;
  };

  devtoolsMarkupScrollableBadge: {
    clicked: GleanCounter;
  };

  devtoolsRulesFlexboxhighlighter: {
    opened: GleanCounter;
  };

  devtoolsRulesGridinspector: {
    opened: GleanCounter;
  };

  devtoolsShadowdom: {
    revealLinkClicked: GleanBoolean;
    shadowRootDisplayed: GleanBoolean;
    shadowRootExpanded: GleanBoolean;
  };

  devtoolsTooltip: {
    shown: Record<string, GleanCounter>;
  };

  devtoolsResponsive: {
    openTrigger: Record<string, GleanCounter>;
    toolboxOpenedFirst: GleanCounter;
  };

  devtoolsChangesview: {
    openedCount: GleanCounter;
  };

  devtoolsMain: {
    activateResponsiveDesign: GleanEventWithExtras<{
      host?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    activateSplitConsole: GleanEventWithExtras<{
      host?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    addBreakpointDebugger: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    blackboxDebugger: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    closeAdbgAboutdebugging: GleanEventWithExtras<{
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    closeTools: GleanEventWithExtras<{
      host?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    connectionAttemptAboutdebugging: GleanEventWithExtras<{
      connection_id?: string;
      connection_type?: string;
      runtime_id?: string;
      session_id?: string;
      status?: string;
      value?: string;
    }>;
    continueDebugger: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    deactivateResponsiveDesign: GleanEventWithExtras<{
      host?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    deactivateSplitConsole: GleanEventWithExtras<{
      host?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    deviceAddedAboutdebugging: GleanEventWithExtras<{
      connection_type?: string;
      device_name?: string;
      session_id?: string;
      value?: string;
    }>;
    deviceRemovedAboutdebugging: GleanEventWithExtras<{
      connection_type?: string;
      device_name?: string;
      session_id?: string;
      value?: string;
    }>;
    editHtmlInspector: GleanEventWithExtras<{
      made_changes?: string;
      session_id?: string;
      time_open?: string;
      value?: string;
    }>;
    editResendNetmonitor: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    editRuleRuleview: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    enterAccessibility: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterApplication: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterDom: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterFakeTool4242: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterInspector: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterJsdebugger: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterMemory: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterNetmonitor: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterOptions: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterOther: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterPerformance: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterStorage: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterStyleeditor: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterTestBlankPanel: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterTestTool: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterTestTool1072208: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterTesttool1: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterTesttool2: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterWebconsole: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    enterWhatsnew: GleanEventWithExtras<{
      cold?: string;
      host?: string;
      message_count?: string;
      panel_name?: string;
      session_id?: string;
      start_state?: string;
      value?: string;
      width?: string;
    }>;
    executeJsWebconsole: GleanEventWithExtras<{
      input?: string;
      lines?: string;
      session_id?: string;
      value?: string;
    }>;
    exitAccessibility: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitApplication: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitDom: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitFakeTool4242: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitInspector: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitJsdebugger: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitMemory: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitNetmonitor: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitOptions: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitOther: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitPerformance: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitStorage: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitStyleeditor: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitTestBlankPanel: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitTestTool: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitTestTool1072208: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitTesttool1: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitTesttool2: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitWebconsole: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    exitWhatsnew: GleanEventWithExtras<{
      host?: string;
      next_panel?: string;
      panel_name?: string;
      reason?: string;
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    filtersChangedNetmonitor: GleanEventWithExtras<{
      active?: string;
      inactive?: string;
      session_id?: string;
      trigger?: string;
      value?: string;
    }>;
    filtersChangedWebconsole: GleanEventWithExtras<{
      active?: string;
      inactive?: string;
      session_id?: string;
      trigger?: string;
      value?: string;
    }>;
    inspectAboutdebugging: GleanEventWithExtras<{
      runtime_type?: string;
      session_id?: string;
      target_type?: string;
      value?: string;
    }>;
    jumpToDefinitionWebconsole: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    jumpToSourceWebconsole: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    objectExpandedWebconsole: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    openAdbgAboutdebugging: GleanEventWithExtras<{
      session_id?: string;
      value?: string;
      width?: string;
    }>;
    openTools: GleanEventWithExtras<{
      entrypoint?: string;
      first_panel?: string;
      host?: string;
      session_id?: string;
      shortcut?: string;
      splitconsole?: string;
      value?: string;
      width?: string;
    }>;
    pauseDebugger: GleanEventWithExtras<{
      lib_stacks?: string;
      reason?: string;
      session_id?: string;
      value?: string;
    }>;
    pauseOnExceptionsDebugger: GleanEventWithExtras<{
      caught_exceptio?: string;
      exceptions?: string;
      session_id?: string;
      value?: string;
    }>;
    persistChangedNetmonitor: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    persistChangedWebconsole: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    prettyPrintDebugger: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    removeBreakpointDebugger: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    reverseSearchWebconsole: GleanEventWithExtras<{
      functionality?: string;
      session_id?: string;
      value?: string;
    }>;
    runtimeAddedAboutdebugging: GleanEventWithExtras<{
      connection_type?: string;
      device_name?: string;
      runtime_id?: string;
      runtime_name?: string;
      session_id?: string;
      value?: string;
    }>;
    runtimeConnectedAboutdebugging: GleanEventWithExtras<{
      connection_type?: string;
      device_name?: string;
      runtime_id?: string;
      runtime_name?: string;
      runtime_os?: string;
      runtime_version?: string;
      session_id?: string;
      value?: string;
    }>;
    runtimeDisconnectedAboutdebugging: GleanEventWithExtras<{
      connection_type?: string;
      device_name?: string;
      runtime_id?: string;
      runtime_name?: string;
      session_id?: string;
      value?: string;
    }>;
    runtimeRemovedAboutdebugging: GleanEventWithExtras<{
      connection_type?: string;
      device_name?: string;
      runtime_id?: string;
      runtime_name?: string;
      session_id?: string;
      value?: string;
    }>;
    selectPageAboutdebugging: GleanEventWithExtras<{
      page_type?: string;
      session_id?: string;
      value?: string;
    }>;
    selectPageApplication: GleanEventWithExtras<{
      page_type?: string;
      session_id?: string;
      value?: string;
    }>;
    selectWsFrameNetmonitor: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    showProfilerAboutdebugging: GleanEventWithExtras<{
      runtime_id?: string;
      session_id?: string;
      value?: string;
    }>;
    sidepanelChangedInspector: GleanEventWithExtras<{
      newpanel?: string;
      oldpanel?: string;
      os?: string;
      session_id?: string;
      value?: string;
    }>;
    sidepanelChangedNetmonitor: GleanEventWithExtras<{
      newpanel?: string;
      oldpanel?: string;
      os?: string;
      session_id?: string;
      value?: string;
    }>;
    startWorkerApplication: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    throttleChangedNetmonitor: GleanEventWithExtras<{
      mode?: string;
      session_id?: string;
      value?: string;
    }>;
    toolTimerAnimationinspector: GleanEventWithExtras<{
      os?: string;
      session_id?: string;
      time_open?: string;
      value?: string;
    }>;
    toolTimerChangesview: GleanEventWithExtras<{
      os?: string;
      session_id?: string;
      time_open?: string;
      value?: string;
    }>;
    toolTimerCompatibilityview: GleanEventWithExtras<{
      os?: string;
      session_id?: string;
      time_open?: string;
      value?: string;
    }>;
    toolTimerComputedview: GleanEventWithExtras<{
      os?: string;
      session_id?: string;
      time_open?: string;
      value?: string;
    }>;
    toolTimerFontinspector: GleanEventWithExtras<{
      os?: string;
      session_id?: string;
      time_open?: string;
      value?: string;
    }>;
    toolTimerLayoutview: GleanEventWithExtras<{
      os?: string;
      session_id?: string;
      time_open?: string;
      value?: string;
    }>;
    toolTimerRuleview: GleanEventWithExtras<{
      os?: string;
      session_id?: string;
      time_open?: string;
      value?: string;
    }>;
    unregisterWorkerApplication: GleanEventWithExtras<{ session_id?: string; value?: string }>;
    updateConnPromptAboutdebugging: GleanEventWithExtras<{
      prompt_enabled?: string;
      runtime_id?: string;
      session_id?: string;
      value?: string;
    }>;
  };

  devtoolsConsole: {
    javascriptErrorDisplayed: Record<string, GleanCounter>;
  };

  bfcache: {
    combo: Record<
      | 'BFCache_Success'
      | 'Beforeunload'
      | 'Other'
      | 'Remote_Subframes'
      | 'Req'
      | 'SPD_Unload_Req_Peer'
      | 'Success_Not_Toplevel'
      | 'Unload'
      | 'Unload_Req'
      | 'Unload_Req_MSE'
      | 'Unload_Req_Peer'
      | 'Unload_Req_Peer_MSE',
      GleanCounter
    >;
    pageRestored: Record<'false' | 'true', GleanCounter>;
  };

  page: {
    loadError: GleanDualLabeledCounter;
  };

  performancePage: {
    totalContentPageLoad: GleanTimingDistribution;
    nonBlankPaint: GleanTimingDistribution;
  };

  useCounter: {
    contentDocumentsDestroyed: GleanCounter;
    dedicatedWorkersDestroyed: GleanCounter;
    serviceWorkersDestroyed: GleanCounter;
    sharedWorkersDestroyed: GleanCounter;
    topLevelContentDocumentsDestroyed: GleanCounter;
  };

  useCounterCssDoc: {
    alignmentBaseline: GleanCounter;
    backgroundRepeatX: GleanCounter;
    backgroundRepeatY: GleanCounter;
    baselineShift: GleanCounter;
    bufferedRendering: GleanCounter;
    colorRendering: GleanCounter;
    cssAccentColor: GleanCounter;
    cssAlignContent: GleanCounter;
    cssAlignItems: GleanCounter;
    cssAlignSelf: GleanCounter;
    cssAll: GleanCounter;
    cssAnchorName: GleanCounter;
    cssAnchorScope: GleanCounter;
    cssAnimation: GleanCounter;
    cssAnimationComposition: GleanCounter;
    cssAnimationDelay: GleanCounter;
    cssAnimationDirection: GleanCounter;
    cssAnimationDuration: GleanCounter;
    cssAnimationFillMode: GleanCounter;
    cssAnimationIterationCount: GleanCounter;
    cssAnimationName: GleanCounter;
    cssAnimationPlayState: GleanCounter;
    cssAnimationTimeline: GleanCounter;
    cssAnimationTimingFunction: GleanCounter;
    cssAppearance: GleanCounter;
    cssAspectRatio: GleanCounter;
    cssBackdropFilter: GleanCounter;
    cssBackfaceVisibility: GleanCounter;
    cssBackground: GleanCounter;
    cssBackgroundAttachment: GleanCounter;
    cssBackgroundBlendMode: GleanCounter;
    cssBackgroundClip: GleanCounter;
    cssBackgroundColor: GleanCounter;
    cssBackgroundImage: GleanCounter;
    cssBackgroundOrigin: GleanCounter;
    cssBackgroundPosition: GleanCounter;
    cssBackgroundPositionX: GleanCounter;
    cssBackgroundPositionY: GleanCounter;
    cssBackgroundRepeat: GleanCounter;
    cssBackgroundSize: GleanCounter;
    cssBaselineSource: GleanCounter;
    cssBlockSize: GleanCounter;
    cssBorder: GleanCounter;
    cssBorderBlock: GleanCounter;
    cssBorderBlockColor: GleanCounter;
    cssBorderBlockEnd: GleanCounter;
    cssBorderBlockEndColor: GleanCounter;
    cssBorderBlockEndStyle: GleanCounter;
    cssBorderBlockEndWidth: GleanCounter;
    cssBorderBlockStart: GleanCounter;
    cssBorderBlockStartColor: GleanCounter;
    cssBorderBlockStartStyle: GleanCounter;
    cssBorderBlockStartWidth: GleanCounter;
    cssBorderBlockStyle: GleanCounter;
    cssBorderBlockWidth: GleanCounter;
    cssBorderBottom: GleanCounter;
    cssBorderBottomColor: GleanCounter;
    cssBorderBottomLeftRadius: GleanCounter;
    cssBorderBottomRightRadius: GleanCounter;
    cssBorderBottomStyle: GleanCounter;
    cssBorderBottomWidth: GleanCounter;
    cssBorderCollapse: GleanCounter;
    cssBorderColor: GleanCounter;
    cssBorderEndEndRadius: GleanCounter;
    cssBorderEndStartRadius: GleanCounter;
    cssBorderImage: GleanCounter;
    cssBorderImageOutset: GleanCounter;
    cssBorderImageRepeat: GleanCounter;
    cssBorderImageSlice: GleanCounter;
    cssBorderImageSource: GleanCounter;
    cssBorderImageWidth: GleanCounter;
    cssBorderInline: GleanCounter;
    cssBorderInlineColor: GleanCounter;
    cssBorderInlineEnd: GleanCounter;
    cssBorderInlineEndColor: GleanCounter;
    cssBorderInlineEndStyle: GleanCounter;
    cssBorderInlineEndWidth: GleanCounter;
    cssBorderInlineStart: GleanCounter;
    cssBorderInlineStartColor: GleanCounter;
    cssBorderInlineStartStyle: GleanCounter;
    cssBorderInlineStartWidth: GleanCounter;
    cssBorderInlineStyle: GleanCounter;
    cssBorderInlineWidth: GleanCounter;
    cssBorderLeft: GleanCounter;
    cssBorderLeftColor: GleanCounter;
    cssBorderLeftStyle: GleanCounter;
    cssBorderLeftWidth: GleanCounter;
    cssBorderRadius: GleanCounter;
    cssBorderRight: GleanCounter;
    cssBorderRightColor: GleanCounter;
    cssBorderRightStyle: GleanCounter;
    cssBorderRightWidth: GleanCounter;
    cssBorderSpacing: GleanCounter;
    cssBorderStartEndRadius: GleanCounter;
    cssBorderStartStartRadius: GleanCounter;
    cssBorderStyle: GleanCounter;
    cssBorderTop: GleanCounter;
    cssBorderTopColor: GleanCounter;
    cssBorderTopLeftRadius: GleanCounter;
    cssBorderTopRightRadius: GleanCounter;
    cssBorderTopStyle: GleanCounter;
    cssBorderTopWidth: GleanCounter;
    cssBorderWidth: GleanCounter;
    cssBottom: GleanCounter;
    cssBoxDecorationBreak: GleanCounter;
    cssBoxShadow: GleanCounter;
    cssBoxSizing: GleanCounter;
    cssBreakAfter: GleanCounter;
    cssBreakBefore: GleanCounter;
    cssBreakInside: GleanCounter;
    cssCaptionSide: GleanCounter;
    cssCaretColor: GleanCounter;
    cssClear: GleanCounter;
    cssClip: GleanCounter;
    cssClipPath: GleanCounter;
    cssClipRule: GleanCounter;
    cssColor: GleanCounter;
    cssColorAdjust: GleanCounter;
    cssColorInterpolation: GleanCounter;
    cssColorInterpolationFilters: GleanCounter;
    cssColorScheme: GleanCounter;
    cssColumnCount: GleanCounter;
    cssColumnFill: GleanCounter;
    cssColumnGap: GleanCounter;
    cssColumnRule: GleanCounter;
    cssColumnRuleColor: GleanCounter;
    cssColumnRuleStyle: GleanCounter;
    cssColumnRuleWidth: GleanCounter;
    cssColumnSpan: GleanCounter;
    cssColumnWidth: GleanCounter;
    cssColumns: GleanCounter;
    cssContain: GleanCounter;
    cssContainIntrinsicBlockSize: GleanCounter;
    cssContainIntrinsicHeight: GleanCounter;
    cssContainIntrinsicInlineSize: GleanCounter;
    cssContainIntrinsicSize: GleanCounter;
    cssContainIntrinsicWidth: GleanCounter;
    cssContainer: GleanCounter;
    cssContainerName: GleanCounter;
    cssContainerType: GleanCounter;
    cssContent: GleanCounter;
    cssContentVisibility: GleanCounter;
    cssCounterIncrement: GleanCounter;
    cssCounterReset: GleanCounter;
    cssCounterSet: GleanCounter;
    cssCursor: GleanCounter;
    cssCx: GleanCounter;
    cssCy: GleanCounter;
    cssD: GleanCounter;
    cssDirection: GleanCounter;
    cssDisplay: GleanCounter;
    cssDominantBaseline: GleanCounter;
    cssEmptyCells: GleanCounter;
    cssFieldSizing: GleanCounter;
    cssFill: GleanCounter;
    cssFillOpacity: GleanCounter;
    cssFillRule: GleanCounter;
    cssFilter: GleanCounter;
    cssFlex: GleanCounter;
    cssFlexBasis: GleanCounter;
    cssFlexDirection: GleanCounter;
    cssFlexFlow: GleanCounter;
    cssFlexGrow: GleanCounter;
    cssFlexShrink: GleanCounter;
    cssFlexWrap: GleanCounter;
    cssFloat: GleanCounter;
    cssFloodColor: GleanCounter;
    cssFloodOpacity: GleanCounter;
    cssFont: GleanCounter;
    cssFontFamily: GleanCounter;
    cssFontFeatureSettings: GleanCounter;
    cssFontKerning: GleanCounter;
    cssFontLanguageOverride: GleanCounter;
    cssFontOpticalSizing: GleanCounter;
    cssFontPalette: GleanCounter;
    cssFontSize: GleanCounter;
    cssFontSizeAdjust: GleanCounter;
    cssFontStretch: GleanCounter;
    cssFontStyle: GleanCounter;
    cssFontSynthesis: GleanCounter;
    cssFontSynthesisPosition: GleanCounter;
    cssFontSynthesisSmallCaps: GleanCounter;
    cssFontSynthesisStyle: GleanCounter;
    cssFontSynthesisWeight: GleanCounter;
    cssFontVariant: GleanCounter;
    cssFontVariantAlternates: GleanCounter;
    cssFontVariantCaps: GleanCounter;
    cssFontVariantEastAsian: GleanCounter;
    cssFontVariantEmoji: GleanCounter;
    cssFontVariantLigatures: GleanCounter;
    cssFontVariantNumeric: GleanCounter;
    cssFontVariantPosition: GleanCounter;
    cssFontVariationSettings: GleanCounter;
    cssFontWeight: GleanCounter;
    cssForcedColorAdjust: GleanCounter;
    cssGap: GleanCounter;
    cssGrid: GleanCounter;
    cssGridArea: GleanCounter;
    cssGridAutoColumns: GleanCounter;
    cssGridAutoFlow: GleanCounter;
    cssGridAutoRows: GleanCounter;
    cssGridColumn: GleanCounter;
    cssGridColumnEnd: GleanCounter;
    cssGridColumnGap: GleanCounter;
    cssGridColumnStart: GleanCounter;
    cssGridGap: GleanCounter;
    cssGridRow: GleanCounter;
    cssGridRowEnd: GleanCounter;
    cssGridRowGap: GleanCounter;
    cssGridRowStart: GleanCounter;
    cssGridTemplate: GleanCounter;
    cssGridTemplateAreas: GleanCounter;
    cssGridTemplateColumns: GleanCounter;
    cssGridTemplateRows: GleanCounter;
    cssHeight: GleanCounter;
    cssHyphenateCharacter: GleanCounter;
    cssHyphenateLimitChars: GleanCounter;
    cssHyphens: GleanCounter;
    cssImageOrientation: GleanCounter;
    cssImageRendering: GleanCounter;
    cssImeMode: GleanCounter;
    cssInitialLetter: GleanCounter;
    cssInlineSize: GleanCounter;
    cssInset: GleanCounter;
    cssInsetBlock: GleanCounter;
    cssInsetBlockEnd: GleanCounter;
    cssInsetBlockStart: GleanCounter;
    cssInsetInline: GleanCounter;
    cssInsetInlineEnd: GleanCounter;
    cssInsetInlineStart: GleanCounter;
    cssIsolation: GleanCounter;
    cssJustifyContent: GleanCounter;
    cssJustifyItems: GleanCounter;
    cssJustifySelf: GleanCounter;
    cssLeft: GleanCounter;
    cssLetterSpacing: GleanCounter;
    cssLightingColor: GleanCounter;
    cssLineBreak: GleanCounter;
    cssLineHeight: GleanCounter;
    cssListStyle: GleanCounter;
    cssListStyleImage: GleanCounter;
    cssListStylePosition: GleanCounter;
    cssListStyleType: GleanCounter;
    cssMargin: GleanCounter;
    cssMarginBlock: GleanCounter;
    cssMarginBlockEnd: GleanCounter;
    cssMarginBlockStart: GleanCounter;
    cssMarginBottom: GleanCounter;
    cssMarginInline: GleanCounter;
    cssMarginInlineEnd: GleanCounter;
    cssMarginInlineStart: GleanCounter;
    cssMarginLeft: GleanCounter;
    cssMarginRight: GleanCounter;
    cssMarginTop: GleanCounter;
    cssMarker: GleanCounter;
    cssMarkerEnd: GleanCounter;
    cssMarkerMid: GleanCounter;
    cssMarkerStart: GleanCounter;
    cssMask: GleanCounter;
    cssMaskClip: GleanCounter;
    cssMaskComposite: GleanCounter;
    cssMaskImage: GleanCounter;
    cssMaskMode: GleanCounter;
    cssMaskOrigin: GleanCounter;
    cssMaskPosition: GleanCounter;
    cssMaskPositionX: GleanCounter;
    cssMaskPositionY: GleanCounter;
    cssMaskRepeat: GleanCounter;
    cssMaskSize: GleanCounter;
    cssMaskType: GleanCounter;
    cssMasonryAutoFlow: GleanCounter;
    cssMathDepth: GleanCounter;
    cssMathShift: GleanCounter;
    cssMathStyle: GleanCounter;
    cssMaxBlockSize: GleanCounter;
    cssMaxHeight: GleanCounter;
    cssMaxInlineSize: GleanCounter;
    cssMaxWidth: GleanCounter;
    cssMinBlockSize: GleanCounter;
    cssMinHeight: GleanCounter;
    cssMinInlineSize: GleanCounter;
    cssMinWidth: GleanCounter;
    cssMixBlendMode: GleanCounter;
    cssMozAnimation: GleanCounter;
    cssMozAnimationDelay: GleanCounter;
    cssMozAnimationDirection: GleanCounter;
    cssMozAnimationDuration: GleanCounter;
    cssMozAnimationFillMode: GleanCounter;
    cssMozAnimationIterationCount: GleanCounter;
    cssMozAnimationName: GleanCounter;
    cssMozAnimationPlayState: GleanCounter;
    cssMozAnimationTimingFunction: GleanCounter;
    cssMozAppearance: GleanCounter;
    cssMozBackfaceVisibility: GleanCounter;
    cssMozBorderEnd: GleanCounter;
    cssMozBorderEndColor: GleanCounter;
    cssMozBorderEndStyle: GleanCounter;
    cssMozBorderEndWidth: GleanCounter;
    cssMozBorderImage: GleanCounter;
    cssMozBorderStart: GleanCounter;
    cssMozBorderStartColor: GleanCounter;
    cssMozBorderStartStyle: GleanCounter;
    cssMozBorderStartWidth: GleanCounter;
    cssMozBoxAlign: GleanCounter;
    cssMozBoxCollapse: GleanCounter;
    cssMozBoxDirection: GleanCounter;
    cssMozBoxFlex: GleanCounter;
    cssMozBoxOrdinalGroup: GleanCounter;
    cssMozBoxOrient: GleanCounter;
    cssMozBoxPack: GleanCounter;
    cssMozBoxSizing: GleanCounter;
    cssMozContextProperties: GleanCounter;
    cssMozControlCharacterVisibility: GleanCounter;
    cssMozDefaultAppearance: GleanCounter;
    cssMozFloatEdge: GleanCounter;
    cssMozFontFeatureSettings: GleanCounter;
    cssMozFontLanguageOverride: GleanCounter;
    cssMozForceBrokenImageIcon: GleanCounter;
    cssMozHyphens: GleanCounter;
    cssMozInert: GleanCounter;
    cssMozMarginEnd: GleanCounter;
    cssMozMarginStart: GleanCounter;
    cssMozMathVariant: GleanCounter;
    cssMozMinFontSizeRatio: GleanCounter;
    cssMozOrient: GleanCounter;
    cssMozOsxFontSmoothing: GleanCounter;
    cssMozPaddingEnd: GleanCounter;
    cssMozPaddingStart: GleanCounter;
    cssMozPerspective: GleanCounter;
    cssMozPerspectiveOrigin: GleanCounter;
    cssMozSubtreeHiddenOnlyVisually: GleanCounter;
    cssMozTabSize: GleanCounter;
    cssMozTextSizeAdjust: GleanCounter;
    cssMozTheme: GleanCounter;
    cssMozTopLayer: GleanCounter;
    cssMozTransform: GleanCounter;
    cssMozTransformOrigin: GleanCounter;
    cssMozTransformStyle: GleanCounter;
    cssMozTransition: GleanCounter;
    cssMozTransitionDelay: GleanCounter;
    cssMozTransitionDuration: GleanCounter;
    cssMozTransitionProperty: GleanCounter;
    cssMozTransitionTimingFunction: GleanCounter;
    cssMozUserFocus: GleanCounter;
    cssMozUserSelect: GleanCounter;
    cssMozWindowDragging: GleanCounter;
    cssMozWindowInputRegionMargin: GleanCounter;
    cssMozWindowOpacity: GleanCounter;
    cssMozWindowShadow: GleanCounter;
    cssMozWindowTransform: GleanCounter;
    cssObjectFit: GleanCounter;
    cssObjectPosition: GleanCounter;
    cssOffset: GleanCounter;
    cssOffsetAnchor: GleanCounter;
    cssOffsetDistance: GleanCounter;
    cssOffsetPath: GleanCounter;
    cssOffsetPosition: GleanCounter;
    cssOffsetRotate: GleanCounter;
    cssOpacity: GleanCounter;
    cssOrder: GleanCounter;
    cssOutline: GleanCounter;
    cssOutlineColor: GleanCounter;
    cssOutlineOffset: GleanCounter;
    cssOutlineStyle: GleanCounter;
    cssOutlineWidth: GleanCounter;
    cssOverflow: GleanCounter;
    cssOverflowAnchor: GleanCounter;
    cssOverflowBlock: GleanCounter;
    cssOverflowClipBox: GleanCounter;
    cssOverflowClipBoxBlock: GleanCounter;
    cssOverflowClipBoxInline: GleanCounter;
    cssOverflowClipMargin: GleanCounter;
    cssOverflowInline: GleanCounter;
    cssOverflowWrap: GleanCounter;
    cssOverflowX: GleanCounter;
    cssOverflowY: GleanCounter;
    cssOverscrollBehavior: GleanCounter;
    cssOverscrollBehaviorBlock: GleanCounter;
    cssOverscrollBehaviorInline: GleanCounter;
    cssOverscrollBehaviorX: GleanCounter;
    cssOverscrollBehaviorY: GleanCounter;
    cssPadding: GleanCounter;
    cssPaddingBlock: GleanCounter;
    cssPaddingBlockEnd: GleanCounter;
    cssPaddingBlockStart: GleanCounter;
    cssPaddingBottom: GleanCounter;
    cssPaddingInline: GleanCounter;
    cssPaddingInlineEnd: GleanCounter;
    cssPaddingInlineStart: GleanCounter;
    cssPaddingLeft: GleanCounter;
    cssPaddingRight: GleanCounter;
    cssPaddingTop: GleanCounter;
    cssPage: GleanCounter;
    cssPageBreakAfter: GleanCounter;
    cssPageBreakBefore: GleanCounter;
    cssPageBreakInside: GleanCounter;
    cssPageOrientation: GleanCounter;
    cssPaintOrder: GleanCounter;
    cssPerspective: GleanCounter;
    cssPerspectiveOrigin: GleanCounter;
    cssPlaceContent: GleanCounter;
    cssPlaceItems: GleanCounter;
    cssPlaceSelf: GleanCounter;
    cssPointerEvents: GleanCounter;
    cssPosition: GleanCounter;
    cssPositionAnchor: GleanCounter;
    cssPositionArea: GleanCounter;
    cssPositionTry: GleanCounter;
    cssPositionTryFallbacks: GleanCounter;
    cssPositionTryOrder: GleanCounter;
    cssPositionVisibility: GleanCounter;
    cssPrintColorAdjust: GleanCounter;
    cssQuotes: GleanCounter;
    cssR: GleanCounter;
    cssResize: GleanCounter;
    cssRight: GleanCounter;
    cssRotate: GleanCounter;
    cssRowGap: GleanCounter;
    cssRubyAlign: GleanCounter;
    cssRubyPosition: GleanCounter;
    cssRx: GleanCounter;
    cssRy: GleanCounter;
    cssScale: GleanCounter;
    cssScrollBehavior: GleanCounter;
    cssScrollMargin: GleanCounter;
    cssScrollMarginBlock: GleanCounter;
    cssScrollMarginBlockEnd: GleanCounter;
    cssScrollMarginBlockStart: GleanCounter;
    cssScrollMarginBottom: GleanCounter;
    cssScrollMarginInline: GleanCounter;
    cssScrollMarginInlineEnd: GleanCounter;
    cssScrollMarginInlineStart: GleanCounter;
    cssScrollMarginLeft: GleanCounter;
    cssScrollMarginRight: GleanCounter;
    cssScrollMarginTop: GleanCounter;
    cssScrollPadding: GleanCounter;
    cssScrollPaddingBlock: GleanCounter;
    cssScrollPaddingBlockEnd: GleanCounter;
    cssScrollPaddingBlockStart: GleanCounter;
    cssScrollPaddingBottom: GleanCounter;
    cssScrollPaddingInline: GleanCounter;
    cssScrollPaddingInlineEnd: GleanCounter;
    cssScrollPaddingInlineStart: GleanCounter;
    cssScrollPaddingLeft: GleanCounter;
    cssScrollPaddingRight: GleanCounter;
    cssScrollPaddingTop: GleanCounter;
    cssScrollSnapAlign: GleanCounter;
    cssScrollSnapStop: GleanCounter;
    cssScrollSnapType: GleanCounter;
    cssScrollTimeline: GleanCounter;
    cssScrollTimelineAxis: GleanCounter;
    cssScrollTimelineName: GleanCounter;
    cssScrollbarColor: GleanCounter;
    cssScrollbarGutter: GleanCounter;
    cssScrollbarWidth: GleanCounter;
    cssShapeImageThreshold: GleanCounter;
    cssShapeMargin: GleanCounter;
    cssShapeOutside: GleanCounter;
    cssShapeRendering: GleanCounter;
    cssSize: GleanCounter;
    cssStopColor: GleanCounter;
    cssStopOpacity: GleanCounter;
    cssStroke: GleanCounter;
    cssStrokeDasharray: GleanCounter;
    cssStrokeDashoffset: GleanCounter;
    cssStrokeLinecap: GleanCounter;
    cssStrokeLinejoin: GleanCounter;
    cssStrokeMiterlimit: GleanCounter;
    cssStrokeOpacity: GleanCounter;
    cssStrokeWidth: GleanCounter;
    cssTabSize: GleanCounter;
    cssTableLayout: GleanCounter;
    cssTextAlign: GleanCounter;
    cssTextAlignLast: GleanCounter;
    cssTextAnchor: GleanCounter;
    cssTextAutospace: GleanCounter;
    cssTextCombineUpright: GleanCounter;
    cssTextDecoration: GleanCounter;
    cssTextDecorationColor: GleanCounter;
    cssTextDecorationLine: GleanCounter;
    cssTextDecorationSkipInk: GleanCounter;
    cssTextDecorationStyle: GleanCounter;
    cssTextDecorationThickness: GleanCounter;
    cssTextDecorationTrim: GleanCounter;
    cssTextEmphasis: GleanCounter;
    cssTextEmphasisColor: GleanCounter;
    cssTextEmphasisPosition: GleanCounter;
    cssTextEmphasisStyle: GleanCounter;
    cssTextIndent: GleanCounter;
    cssTextJustify: GleanCounter;
    cssTextOrientation: GleanCounter;
    cssTextOverflow: GleanCounter;
    cssTextRendering: GleanCounter;
    cssTextShadow: GleanCounter;
    cssTextTransform: GleanCounter;
    cssTextUnderlineOffset: GleanCounter;
    cssTextUnderlinePosition: GleanCounter;
    cssTextWrap: GleanCounter;
    cssTextWrapMode: GleanCounter;
    cssTextWrapStyle: GleanCounter;
    cssTop: GleanCounter;
    cssTouchAction: GleanCounter;
    cssTransform: GleanCounter;
    cssTransformBox: GleanCounter;
    cssTransformOrigin: GleanCounter;
    cssTransformStyle: GleanCounter;
    cssTransition: GleanCounter;
    cssTransitionBehavior: GleanCounter;
    cssTransitionDelay: GleanCounter;
    cssTransitionDuration: GleanCounter;
    cssTransitionProperty: GleanCounter;
    cssTransitionTimingFunction: GleanCounter;
    cssTranslate: GleanCounter;
    cssUnicodeBidi: GleanCounter;
    cssUserSelect: GleanCounter;
    cssVectorEffect: GleanCounter;
    cssVerticalAlign: GleanCounter;
    cssViewTimeline: GleanCounter;
    cssViewTimelineAxis: GleanCounter;
    cssViewTimelineInset: GleanCounter;
    cssViewTimelineName: GleanCounter;
    cssViewTransitionClass: GleanCounter;
    cssViewTransitionName: GleanCounter;
    cssVisibility: GleanCounter;
    cssWebkitAlignContent: GleanCounter;
    cssWebkitAlignItems: GleanCounter;
    cssWebkitAlignSelf: GleanCounter;
    cssWebkitAnimation: GleanCounter;
    cssWebkitAnimationDelay: GleanCounter;
    cssWebkitAnimationDirection: GleanCounter;
    cssWebkitAnimationDuration: GleanCounter;
    cssWebkitAnimationFillMode: GleanCounter;
    cssWebkitAnimationIterationCount: GleanCounter;
    cssWebkitAnimationName: GleanCounter;
    cssWebkitAnimationPlayState: GleanCounter;
    cssWebkitAnimationTimingFunction: GleanCounter;
    cssWebkitAppearance: GleanCounter;
    cssWebkitBackfaceVisibility: GleanCounter;
    cssWebkitBackgroundClip: GleanCounter;
    cssWebkitBackgroundOrigin: GleanCounter;
    cssWebkitBackgroundSize: GleanCounter;
    cssWebkitBorderBottomLeftRadius: GleanCounter;
    cssWebkitBorderBottomRightRadius: GleanCounter;
    cssWebkitBorderImage: GleanCounter;
    cssWebkitBorderRadius: GleanCounter;
    cssWebkitBorderTopLeftRadius: GleanCounter;
    cssWebkitBorderTopRightRadius: GleanCounter;
    cssWebkitBoxAlign: GleanCounter;
    cssWebkitBoxDirection: GleanCounter;
    cssWebkitBoxFlex: GleanCounter;
    cssWebkitBoxOrdinalGroup: GleanCounter;
    cssWebkitBoxOrient: GleanCounter;
    cssWebkitBoxPack: GleanCounter;
    cssWebkitBoxShadow: GleanCounter;
    cssWebkitBoxSizing: GleanCounter;
    cssWebkitClipPath: GleanCounter;
    cssWebkitFilter: GleanCounter;
    cssWebkitFlex: GleanCounter;
    cssWebkitFlexBasis: GleanCounter;
    cssWebkitFlexDirection: GleanCounter;
    cssWebkitFlexFlow: GleanCounter;
    cssWebkitFlexGrow: GleanCounter;
    cssWebkitFlexShrink: GleanCounter;
    cssWebkitFlexWrap: GleanCounter;
    cssWebkitFontFeatureSettings: GleanCounter;
    cssWebkitFontSmoothing: GleanCounter;
    cssWebkitJustifyContent: GleanCounter;
    cssWebkitLineClamp: GleanCounter;
    cssWebkitMask: GleanCounter;
    cssWebkitMaskClip: GleanCounter;
    cssWebkitMaskComposite: GleanCounter;
    cssWebkitMaskImage: GleanCounter;
    cssWebkitMaskOrigin: GleanCounter;
    cssWebkitMaskPosition: GleanCounter;
    cssWebkitMaskPositionX: GleanCounter;
    cssWebkitMaskPositionY: GleanCounter;
    cssWebkitMaskRepeat: GleanCounter;
    cssWebkitMaskSize: GleanCounter;
    cssWebkitOrder: GleanCounter;
    cssWebkitPerspective: GleanCounter;
    cssWebkitPerspectiveOrigin: GleanCounter;
    cssWebkitTextFillColor: GleanCounter;
    cssWebkitTextSecurity: GleanCounter;
    cssWebkitTextSizeAdjust: GleanCounter;
    cssWebkitTextStroke: GleanCounter;
    cssWebkitTextStrokeColor: GleanCounter;
    cssWebkitTextStrokeWidth: GleanCounter;
    cssWebkitTransform: GleanCounter;
    cssWebkitTransformOrigin: GleanCounter;
    cssWebkitTransformStyle: GleanCounter;
    cssWebkitTransition: GleanCounter;
    cssWebkitTransitionDelay: GleanCounter;
    cssWebkitTransitionDuration: GleanCounter;
    cssWebkitTransitionProperty: GleanCounter;
    cssWebkitTransitionTimingFunction: GleanCounter;
    cssWebkitUserSelect: GleanCounter;
    cssWhiteSpace: GleanCounter;
    cssWhiteSpaceCollapse: GleanCounter;
    cssWidth: GleanCounter;
    cssWillChange: GleanCounter;
    cssWordBreak: GleanCounter;
    cssWordSpacing: GleanCounter;
    cssWordWrap: GleanCounter;
    cssWritingMode: GleanCounter;
    cssX: GleanCounter;
    cssXLang: GleanCounter;
    cssXSpan: GleanCounter;
    cssXTextScale: GleanCounter;
    cssY: GleanCounter;
    cssZIndex: GleanCounter;
    cssZoom: GleanCounter;
    maxZoom: GleanCounter;
    minZoom: GleanCounter;
    orientation: GleanCounter;
    orphans: GleanCounter;
    speak: GleanCounter;
    textSizeAdjust: GleanCounter;
    userZoom: GleanCounter;
    webkitAppRegion: GleanCounter;
    webkitBorderAfter: GleanCounter;
    webkitBorderAfterColor: GleanCounter;
    webkitBorderAfterStyle: GleanCounter;
    webkitBorderAfterWidth: GleanCounter;
    webkitBorderBefore: GleanCounter;
    webkitBorderBeforeColor: GleanCounter;
    webkitBorderBeforeStyle: GleanCounter;
    webkitBorderBeforeWidth: GleanCounter;
    webkitBorderEnd: GleanCounter;
    webkitBorderEndColor: GleanCounter;
    webkitBorderEndStyle: GleanCounter;
    webkitBorderEndWidth: GleanCounter;
    webkitBorderHorizontalSpacing: GleanCounter;
    webkitBorderStart: GleanCounter;
    webkitBorderStartColor: GleanCounter;
    webkitBorderStartStyle: GleanCounter;
    webkitBorderStartWidth: GleanCounter;
    webkitBorderVerticalSpacing: GleanCounter;
    webkitBoxDecorationBreak: GleanCounter;
    webkitBoxReflect: GleanCounter;
    webkitColumnBreakAfter: GleanCounter;
    webkitColumnBreakBefore: GleanCounter;
    webkitColumnBreakInside: GleanCounter;
    webkitColumnCount: GleanCounter;
    webkitColumnGap: GleanCounter;
    webkitColumnRule: GleanCounter;
    webkitColumnRuleColor: GleanCounter;
    webkitColumnRuleStyle: GleanCounter;
    webkitColumnRuleWidth: GleanCounter;
    webkitColumnSpan: GleanCounter;
    webkitColumnWidth: GleanCounter;
    webkitColumns: GleanCounter;
    webkitFontSizeDelta: GleanCounter;
    webkitHighlight: GleanCounter;
    webkitHyphenateCharacter: GleanCounter;
    webkitLineBreak: GleanCounter;
    webkitLocale: GleanCounter;
    webkitLogicalHeight: GleanCounter;
    webkitLogicalWidth: GleanCounter;
    webkitMarginAfter: GleanCounter;
    webkitMarginAfterCollapse: GleanCounter;
    webkitMarginBefore: GleanCounter;
    webkitMarginBeforeCollapse: GleanCounter;
    webkitMarginBottomCollapse: GleanCounter;
    webkitMarginCollapse: GleanCounter;
    webkitMarginEnd: GleanCounter;
    webkitMarginStart: GleanCounter;
    webkitMarginTopCollapse: GleanCounter;
    webkitMaskBoxImage: GleanCounter;
    webkitMaskBoxImageOutset: GleanCounter;
    webkitMaskBoxImageRepeat: GleanCounter;
    webkitMaskBoxImageSlice: GleanCounter;
    webkitMaskBoxImageSource: GleanCounter;
    webkitMaskBoxImageWidth: GleanCounter;
    webkitMaskRepeatX: GleanCounter;
    webkitMaskRepeatY: GleanCounter;
    webkitMaxLogicalHeight: GleanCounter;
    webkitMaxLogicalWidth: GleanCounter;
    webkitMinLogicalHeight: GleanCounter;
    webkitMinLogicalWidth: GleanCounter;
    webkitOpacity: GleanCounter;
    webkitPaddingAfter: GleanCounter;
    webkitPaddingBefore: GleanCounter;
    webkitPaddingEnd: GleanCounter;
    webkitPaddingStart: GleanCounter;
    webkitPerspectiveOriginX: GleanCounter;
    webkitPerspectiveOriginY: GleanCounter;
    webkitPrintColorAdjust: GleanCounter;
    webkitRtlOrdering: GleanCounter;
    webkitRubyPosition: GleanCounter;
    webkitShapeImageThreshold: GleanCounter;
    webkitShapeMargin: GleanCounter;
    webkitShapeOutside: GleanCounter;
    webkitTapHighlightColor: GleanCounter;
    webkitTextCombine: GleanCounter;
    webkitTextDecorationsInEffect: GleanCounter;
    webkitTextEmphasis: GleanCounter;
    webkitTextEmphasisColor: GleanCounter;
    webkitTextEmphasisPosition: GleanCounter;
    webkitTextEmphasisStyle: GleanCounter;
    webkitTextOrientation: GleanCounter;
    webkitTransformOriginX: GleanCounter;
    webkitTransformOriginY: GleanCounter;
    webkitTransformOriginZ: GleanCounter;
    webkitUserDrag: GleanCounter;
    webkitUserModify: GleanCounter;
    webkitWritingMode: GleanCounter;
    widows: GleanCounter;
  };

  useCounterCssPage: {
    alignmentBaseline: GleanCounter;
    backgroundRepeatX: GleanCounter;
    backgroundRepeatY: GleanCounter;
    baselineShift: GleanCounter;
    bufferedRendering: GleanCounter;
    colorRendering: GleanCounter;
    cssAccentColor: GleanCounter;
    cssAlignContent: GleanCounter;
    cssAlignItems: GleanCounter;
    cssAlignSelf: GleanCounter;
    cssAll: GleanCounter;
    cssAnchorName: GleanCounter;
    cssAnchorScope: GleanCounter;
    cssAnimation: GleanCounter;
    cssAnimationComposition: GleanCounter;
    cssAnimationDelay: GleanCounter;
    cssAnimationDirection: GleanCounter;
    cssAnimationDuration: GleanCounter;
    cssAnimationFillMode: GleanCounter;
    cssAnimationIterationCount: GleanCounter;
    cssAnimationName: GleanCounter;
    cssAnimationPlayState: GleanCounter;
    cssAnimationTimeline: GleanCounter;
    cssAnimationTimingFunction: GleanCounter;
    cssAppearance: GleanCounter;
    cssAspectRatio: GleanCounter;
    cssBackdropFilter: GleanCounter;
    cssBackfaceVisibility: GleanCounter;
    cssBackground: GleanCounter;
    cssBackgroundAttachment: GleanCounter;
    cssBackgroundBlendMode: GleanCounter;
    cssBackgroundClip: GleanCounter;
    cssBackgroundColor: GleanCounter;
    cssBackgroundImage: GleanCounter;
    cssBackgroundOrigin: GleanCounter;
    cssBackgroundPosition: GleanCounter;
    cssBackgroundPositionX: GleanCounter;
    cssBackgroundPositionY: GleanCounter;
    cssBackgroundRepeat: GleanCounter;
    cssBackgroundSize: GleanCounter;
    cssBaselineSource: GleanCounter;
    cssBlockSize: GleanCounter;
    cssBorder: GleanCounter;
    cssBorderBlock: GleanCounter;
    cssBorderBlockColor: GleanCounter;
    cssBorderBlockEnd: GleanCounter;
    cssBorderBlockEndColor: GleanCounter;
    cssBorderBlockEndStyle: GleanCounter;
    cssBorderBlockEndWidth: GleanCounter;
    cssBorderBlockStart: GleanCounter;
    cssBorderBlockStartColor: GleanCounter;
    cssBorderBlockStartStyle: GleanCounter;
    cssBorderBlockStartWidth: GleanCounter;
    cssBorderBlockStyle: GleanCounter;
    cssBorderBlockWidth: GleanCounter;
    cssBorderBottom: GleanCounter;
    cssBorderBottomColor: GleanCounter;
    cssBorderBottomLeftRadius: GleanCounter;
    cssBorderBottomRightRadius: GleanCounter;
    cssBorderBottomStyle: GleanCounter;
    cssBorderBottomWidth: GleanCounter;
    cssBorderCollapse: GleanCounter;
    cssBorderColor: GleanCounter;
    cssBorderEndEndRadius: GleanCounter;
    cssBorderEndStartRadius: GleanCounter;
    cssBorderImage: GleanCounter;
    cssBorderImageOutset: GleanCounter;
    cssBorderImageRepeat: GleanCounter;
    cssBorderImageSlice: GleanCounter;
    cssBorderImageSource: GleanCounter;
    cssBorderImageWidth: GleanCounter;
    cssBorderInline: GleanCounter;
    cssBorderInlineColor: GleanCounter;
    cssBorderInlineEnd: GleanCounter;
    cssBorderInlineEndColor: GleanCounter;
    cssBorderInlineEndStyle: GleanCounter;
    cssBorderInlineEndWidth: GleanCounter;
    cssBorderInlineStart: GleanCounter;
    cssBorderInlineStartColor: GleanCounter;
    cssBorderInlineStartStyle: GleanCounter;
    cssBorderInlineStartWidth: GleanCounter;
    cssBorderInlineStyle: GleanCounter;
    cssBorderInlineWidth: GleanCounter;
    cssBorderLeft: GleanCounter;
    cssBorderLeftColor: GleanCounter;
    cssBorderLeftStyle: GleanCounter;
    cssBorderLeftWidth: GleanCounter;
    cssBorderRadius: GleanCounter;
    cssBorderRight: GleanCounter;
    cssBorderRightColor: GleanCounter;
    cssBorderRightStyle: GleanCounter;
    cssBorderRightWidth: GleanCounter;
    cssBorderSpacing: GleanCounter;
    cssBorderStartEndRadius: GleanCounter;
    cssBorderStartStartRadius: GleanCounter;
    cssBorderStyle: GleanCounter;
    cssBorderTop: GleanCounter;
    cssBorderTopColor: GleanCounter;
    cssBorderTopLeftRadius: GleanCounter;
    cssBorderTopRightRadius: GleanCounter;
    cssBorderTopStyle: GleanCounter;
    cssBorderTopWidth: GleanCounter;
    cssBorderWidth: GleanCounter;
    cssBottom: GleanCounter;
    cssBoxDecorationBreak: GleanCounter;
    cssBoxShadow: GleanCounter;
    cssBoxSizing: GleanCounter;
    cssBreakAfter: GleanCounter;
    cssBreakBefore: GleanCounter;
    cssBreakInside: GleanCounter;
    cssCaptionSide: GleanCounter;
    cssCaretColor: GleanCounter;
    cssClear: GleanCounter;
    cssClip: GleanCounter;
    cssClipPath: GleanCounter;
    cssClipRule: GleanCounter;
    cssColor: GleanCounter;
    cssColorAdjust: GleanCounter;
    cssColorInterpolation: GleanCounter;
    cssColorInterpolationFilters: GleanCounter;
    cssColorScheme: GleanCounter;
    cssColumnCount: GleanCounter;
    cssColumnFill: GleanCounter;
    cssColumnGap: GleanCounter;
    cssColumnRule: GleanCounter;
    cssColumnRuleColor: GleanCounter;
    cssColumnRuleStyle: GleanCounter;
    cssColumnRuleWidth: GleanCounter;
    cssColumnSpan: GleanCounter;
    cssColumnWidth: GleanCounter;
    cssColumns: GleanCounter;
    cssContain: GleanCounter;
    cssContainIntrinsicBlockSize: GleanCounter;
    cssContainIntrinsicHeight: GleanCounter;
    cssContainIntrinsicInlineSize: GleanCounter;
    cssContainIntrinsicSize: GleanCounter;
    cssContainIntrinsicWidth: GleanCounter;
    cssContainer: GleanCounter;
    cssContainerName: GleanCounter;
    cssContainerType: GleanCounter;
    cssContent: GleanCounter;
    cssContentVisibility: GleanCounter;
    cssCounterIncrement: GleanCounter;
    cssCounterReset: GleanCounter;
    cssCounterSet: GleanCounter;
    cssCursor: GleanCounter;
    cssCx: GleanCounter;
    cssCy: GleanCounter;
    cssD: GleanCounter;
    cssDirection: GleanCounter;
    cssDisplay: GleanCounter;
    cssDominantBaseline: GleanCounter;
    cssEmptyCells: GleanCounter;
    cssFieldSizing: GleanCounter;
    cssFill: GleanCounter;
    cssFillOpacity: GleanCounter;
    cssFillRule: GleanCounter;
    cssFilter: GleanCounter;
    cssFlex: GleanCounter;
    cssFlexBasis: GleanCounter;
    cssFlexDirection: GleanCounter;
    cssFlexFlow: GleanCounter;
    cssFlexGrow: GleanCounter;
    cssFlexShrink: GleanCounter;
    cssFlexWrap: GleanCounter;
    cssFloat: GleanCounter;
    cssFloodColor: GleanCounter;
    cssFloodOpacity: GleanCounter;
    cssFont: GleanCounter;
    cssFontFamily: GleanCounter;
    cssFontFeatureSettings: GleanCounter;
    cssFontKerning: GleanCounter;
    cssFontLanguageOverride: GleanCounter;
    cssFontOpticalSizing: GleanCounter;
    cssFontPalette: GleanCounter;
    cssFontSize: GleanCounter;
    cssFontSizeAdjust: GleanCounter;
    cssFontStretch: GleanCounter;
    cssFontStyle: GleanCounter;
    cssFontSynthesis: GleanCounter;
    cssFontSynthesisPosition: GleanCounter;
    cssFontSynthesisSmallCaps: GleanCounter;
    cssFontSynthesisStyle: GleanCounter;
    cssFontSynthesisWeight: GleanCounter;
    cssFontVariant: GleanCounter;
    cssFontVariantAlternates: GleanCounter;
    cssFontVariantCaps: GleanCounter;
    cssFontVariantEastAsian: GleanCounter;
    cssFontVariantEmoji: GleanCounter;
    cssFontVariantLigatures: GleanCounter;
    cssFontVariantNumeric: GleanCounter;
    cssFontVariantPosition: GleanCounter;
    cssFontVariationSettings: GleanCounter;
    cssFontWeight: GleanCounter;
    cssForcedColorAdjust: GleanCounter;
    cssGap: GleanCounter;
    cssGrid: GleanCounter;
    cssGridArea: GleanCounter;
    cssGridAutoColumns: GleanCounter;
    cssGridAutoFlow: GleanCounter;
    cssGridAutoRows: GleanCounter;
    cssGridColumn: GleanCounter;
    cssGridColumnEnd: GleanCounter;
    cssGridColumnGap: GleanCounter;
    cssGridColumnStart: GleanCounter;
    cssGridGap: GleanCounter;
    cssGridRow: GleanCounter;
    cssGridRowEnd: GleanCounter;
    cssGridRowGap: GleanCounter;
    cssGridRowStart: GleanCounter;
    cssGridTemplate: GleanCounter;
    cssGridTemplateAreas: GleanCounter;
    cssGridTemplateColumns: GleanCounter;
    cssGridTemplateRows: GleanCounter;
    cssHeight: GleanCounter;
    cssHyphenateCharacter: GleanCounter;
    cssHyphenateLimitChars: GleanCounter;
    cssHyphens: GleanCounter;
    cssImageOrientation: GleanCounter;
    cssImageRendering: GleanCounter;
    cssImeMode: GleanCounter;
    cssInitialLetter: GleanCounter;
    cssInlineSize: GleanCounter;
    cssInset: GleanCounter;
    cssInsetBlock: GleanCounter;
    cssInsetBlockEnd: GleanCounter;
    cssInsetBlockStart: GleanCounter;
    cssInsetInline: GleanCounter;
    cssInsetInlineEnd: GleanCounter;
    cssInsetInlineStart: GleanCounter;
    cssIsolation: GleanCounter;
    cssJustifyContent: GleanCounter;
    cssJustifyItems: GleanCounter;
    cssJustifySelf: GleanCounter;
    cssLeft: GleanCounter;
    cssLetterSpacing: GleanCounter;
    cssLightingColor: GleanCounter;
    cssLineBreak: GleanCounter;
    cssLineHeight: GleanCounter;
    cssListStyle: GleanCounter;
    cssListStyleImage: GleanCounter;
    cssListStylePosition: GleanCounter;
    cssListStyleType: GleanCounter;
    cssMargin: GleanCounter;
    cssMarginBlock: GleanCounter;
    cssMarginBlockEnd: GleanCounter;
    cssMarginBlockStart: GleanCounter;
    cssMarginBottom: GleanCounter;
    cssMarginInline: GleanCounter;
    cssMarginInlineEnd: GleanCounter;
    cssMarginInlineStart: GleanCounter;
    cssMarginLeft: GleanCounter;
    cssMarginRight: GleanCounter;
    cssMarginTop: GleanCounter;
    cssMarker: GleanCounter;
    cssMarkerEnd: GleanCounter;
    cssMarkerMid: GleanCounter;
    cssMarkerStart: GleanCounter;
    cssMask: GleanCounter;
    cssMaskClip: GleanCounter;
    cssMaskComposite: GleanCounter;
    cssMaskImage: GleanCounter;
    cssMaskMode: GleanCounter;
    cssMaskOrigin: GleanCounter;
    cssMaskPosition: GleanCounter;
    cssMaskPositionX: GleanCounter;
    cssMaskPositionY: GleanCounter;
    cssMaskRepeat: GleanCounter;
    cssMaskSize: GleanCounter;
    cssMaskType: GleanCounter;
    cssMasonryAutoFlow: GleanCounter;
    cssMathDepth: GleanCounter;
    cssMathShift: GleanCounter;
    cssMathStyle: GleanCounter;
    cssMaxBlockSize: GleanCounter;
    cssMaxHeight: GleanCounter;
    cssMaxInlineSize: GleanCounter;
    cssMaxWidth: GleanCounter;
    cssMinBlockSize: GleanCounter;
    cssMinHeight: GleanCounter;
    cssMinInlineSize: GleanCounter;
    cssMinWidth: GleanCounter;
    cssMixBlendMode: GleanCounter;
    cssMozAnimation: GleanCounter;
    cssMozAnimationDelay: GleanCounter;
    cssMozAnimationDirection: GleanCounter;
    cssMozAnimationDuration: GleanCounter;
    cssMozAnimationFillMode: GleanCounter;
    cssMozAnimationIterationCount: GleanCounter;
    cssMozAnimationName: GleanCounter;
    cssMozAnimationPlayState: GleanCounter;
    cssMozAnimationTimingFunction: GleanCounter;
    cssMozAppearance: GleanCounter;
    cssMozBackfaceVisibility: GleanCounter;
    cssMozBorderEnd: GleanCounter;
    cssMozBorderEndColor: GleanCounter;
    cssMozBorderEndStyle: GleanCounter;
    cssMozBorderEndWidth: GleanCounter;
    cssMozBorderImage: GleanCounter;
    cssMozBorderStart: GleanCounter;
    cssMozBorderStartColor: GleanCounter;
    cssMozBorderStartStyle: GleanCounter;
    cssMozBorderStartWidth: GleanCounter;
    cssMozBoxAlign: GleanCounter;
    cssMozBoxCollapse: GleanCounter;
    cssMozBoxDirection: GleanCounter;
    cssMozBoxFlex: GleanCounter;
    cssMozBoxOrdinalGroup: GleanCounter;
    cssMozBoxOrient: GleanCounter;
    cssMozBoxPack: GleanCounter;
    cssMozBoxSizing: GleanCounter;
    cssMozContextProperties: GleanCounter;
    cssMozControlCharacterVisibility: GleanCounter;
    cssMozDefaultAppearance: GleanCounter;
    cssMozFloatEdge: GleanCounter;
    cssMozFontFeatureSettings: GleanCounter;
    cssMozFontLanguageOverride: GleanCounter;
    cssMozForceBrokenImageIcon: GleanCounter;
    cssMozHyphens: GleanCounter;
    cssMozInert: GleanCounter;
    cssMozMarginEnd: GleanCounter;
    cssMozMarginStart: GleanCounter;
    cssMozMathVariant: GleanCounter;
    cssMozMinFontSizeRatio: GleanCounter;
    cssMozOrient: GleanCounter;
    cssMozOsxFontSmoothing: GleanCounter;
    cssMozPaddingEnd: GleanCounter;
    cssMozPaddingStart: GleanCounter;
    cssMozPerspective: GleanCounter;
    cssMozPerspectiveOrigin: GleanCounter;
    cssMozSubtreeHiddenOnlyVisually: GleanCounter;
    cssMozTabSize: GleanCounter;
    cssMozTextSizeAdjust: GleanCounter;
    cssMozTheme: GleanCounter;
    cssMozTopLayer: GleanCounter;
    cssMozTransform: GleanCounter;
    cssMozTransformOrigin: GleanCounter;
    cssMozTransformStyle: GleanCounter;
    cssMozTransition: GleanCounter;
    cssMozTransitionDelay: GleanCounter;
    cssMozTransitionDuration: GleanCounter;
    cssMozTransitionProperty: GleanCounter;
    cssMozTransitionTimingFunction: GleanCounter;
    cssMozUserFocus: GleanCounter;
    cssMozUserSelect: GleanCounter;
    cssMozWindowDragging: GleanCounter;
    cssMozWindowInputRegionMargin: GleanCounter;
    cssMozWindowOpacity: GleanCounter;
    cssMozWindowShadow: GleanCounter;
    cssMozWindowTransform: GleanCounter;
    cssObjectFit: GleanCounter;
    cssObjectPosition: GleanCounter;
    cssOffset: GleanCounter;
    cssOffsetAnchor: GleanCounter;
    cssOffsetDistance: GleanCounter;
    cssOffsetPath: GleanCounter;
    cssOffsetPosition: GleanCounter;
    cssOffsetRotate: GleanCounter;
    cssOpacity: GleanCounter;
    cssOrder: GleanCounter;
    cssOutline: GleanCounter;
    cssOutlineColor: GleanCounter;
    cssOutlineOffset: GleanCounter;
    cssOutlineStyle: GleanCounter;
    cssOutlineWidth: GleanCounter;
    cssOverflow: GleanCounter;
    cssOverflowAnchor: GleanCounter;
    cssOverflowBlock: GleanCounter;
    cssOverflowClipBox: GleanCounter;
    cssOverflowClipBoxBlock: GleanCounter;
    cssOverflowClipBoxInline: GleanCounter;
    cssOverflowClipMargin: GleanCounter;
    cssOverflowInline: GleanCounter;
    cssOverflowWrap: GleanCounter;
    cssOverflowX: GleanCounter;
    cssOverflowY: GleanCounter;
    cssOverscrollBehavior: GleanCounter;
    cssOverscrollBehaviorBlock: GleanCounter;
    cssOverscrollBehaviorInline: GleanCounter;
    cssOverscrollBehaviorX: GleanCounter;
    cssOverscrollBehaviorY: GleanCounter;
    cssPadding: GleanCounter;
    cssPaddingBlock: GleanCounter;
    cssPaddingBlockEnd: GleanCounter;
    cssPaddingBlockStart: GleanCounter;
    cssPaddingBottom: GleanCounter;
    cssPaddingInline: GleanCounter;
    cssPaddingInlineEnd: GleanCounter;
    cssPaddingInlineStart: GleanCounter;
    cssPaddingLeft: GleanCounter;
    cssPaddingRight: GleanCounter;
    cssPaddingTop: GleanCounter;
    cssPage: GleanCounter;
    cssPageBreakAfter: GleanCounter;
    cssPageBreakBefore: GleanCounter;
    cssPageBreakInside: GleanCounter;
    cssPageOrientation: GleanCounter;
    cssPaintOrder: GleanCounter;
    cssPerspective: GleanCounter;
    cssPerspectiveOrigin: GleanCounter;
    cssPlaceContent: GleanCounter;
    cssPlaceItems: GleanCounter;
    cssPlaceSelf: GleanCounter;
    cssPointerEvents: GleanCounter;
    cssPosition: GleanCounter;
    cssPositionAnchor: GleanCounter;
    cssPositionArea: GleanCounter;
    cssPositionTry: GleanCounter;
    cssPositionTryFallbacks: GleanCounter;
    cssPositionTryOrder: GleanCounter;
    cssPositionVisibility: GleanCounter;
    cssPrintColorAdjust: GleanCounter;
    cssQuotes: GleanCounter;
    cssR: GleanCounter;
    cssResize: GleanCounter;
    cssRight: GleanCounter;
    cssRotate: GleanCounter;
    cssRowGap: GleanCounter;
    cssRubyAlign: GleanCounter;
    cssRubyPosition: GleanCounter;
    cssRx: GleanCounter;
    cssRy: GleanCounter;
    cssScale: GleanCounter;
    cssScrollBehavior: GleanCounter;
    cssScrollMargin: GleanCounter;
    cssScrollMarginBlock: GleanCounter;
    cssScrollMarginBlockEnd: GleanCounter;
    cssScrollMarginBlockStart: GleanCounter;
    cssScrollMarginBottom: GleanCounter;
    cssScrollMarginInline: GleanCounter;
    cssScrollMarginInlineEnd: GleanCounter;
    cssScrollMarginInlineStart: GleanCounter;
    cssScrollMarginLeft: GleanCounter;
    cssScrollMarginRight: GleanCounter;
    cssScrollMarginTop: GleanCounter;
    cssScrollPadding: GleanCounter;
    cssScrollPaddingBlock: GleanCounter;
    cssScrollPaddingBlockEnd: GleanCounter;
    cssScrollPaddingBlockStart: GleanCounter;
    cssScrollPaddingBottom: GleanCounter;
    cssScrollPaddingInline: GleanCounter;
    cssScrollPaddingInlineEnd: GleanCounter;
    cssScrollPaddingInlineStart: GleanCounter;
    cssScrollPaddingLeft: GleanCounter;
    cssScrollPaddingRight: GleanCounter;
    cssScrollPaddingTop: GleanCounter;
    cssScrollSnapAlign: GleanCounter;
    cssScrollSnapStop: GleanCounter;
    cssScrollSnapType: GleanCounter;
    cssScrollTimeline: GleanCounter;
    cssScrollTimelineAxis: GleanCounter;
    cssScrollTimelineName: GleanCounter;
    cssScrollbarColor: GleanCounter;
    cssScrollbarGutter: GleanCounter;
    cssScrollbarWidth: GleanCounter;
    cssShapeImageThreshold: GleanCounter;
    cssShapeMargin: GleanCounter;
    cssShapeOutside: GleanCounter;
    cssShapeRendering: GleanCounter;
    cssSize: GleanCounter;
    cssStopColor: GleanCounter;
    cssStopOpacity: GleanCounter;
    cssStroke: GleanCounter;
    cssStrokeDasharray: GleanCounter;
    cssStrokeDashoffset: GleanCounter;
    cssStrokeLinecap: GleanCounter;
    cssStrokeLinejoin: GleanCounter;
    cssStrokeMiterlimit: GleanCounter;
    cssStrokeOpacity: GleanCounter;
    cssStrokeWidth: GleanCounter;
    cssTabSize: GleanCounter;
    cssTableLayout: GleanCounter;
    cssTextAlign: GleanCounter;
    cssTextAlignLast: GleanCounter;
    cssTextAnchor: GleanCounter;
    cssTextAutospace: GleanCounter;
    cssTextCombineUpright: GleanCounter;
    cssTextDecoration: GleanCounter;
    cssTextDecorationColor: GleanCounter;
    cssTextDecorationLine: GleanCounter;
    cssTextDecorationSkipInk: GleanCounter;
    cssTextDecorationStyle: GleanCounter;
    cssTextDecorationThickness: GleanCounter;
    cssTextDecorationTrim: GleanCounter;
    cssTextEmphasis: GleanCounter;
    cssTextEmphasisColor: GleanCounter;
    cssTextEmphasisPosition: GleanCounter;
    cssTextEmphasisStyle: GleanCounter;
    cssTextIndent: GleanCounter;
    cssTextJustify: GleanCounter;
    cssTextOrientation: GleanCounter;
    cssTextOverflow: GleanCounter;
    cssTextRendering: GleanCounter;
    cssTextShadow: GleanCounter;
    cssTextTransform: GleanCounter;
    cssTextUnderlineOffset: GleanCounter;
    cssTextUnderlinePosition: GleanCounter;
    cssTextWrap: GleanCounter;
    cssTextWrapMode: GleanCounter;
    cssTextWrapStyle: GleanCounter;
    cssTop: GleanCounter;
    cssTouchAction: GleanCounter;
    cssTransform: GleanCounter;
    cssTransformBox: GleanCounter;
    cssTransformOrigin: GleanCounter;
    cssTransformStyle: GleanCounter;
    cssTransition: GleanCounter;
    cssTransitionBehavior: GleanCounter;
    cssTransitionDelay: GleanCounter;
    cssTransitionDuration: GleanCounter;
    cssTransitionProperty: GleanCounter;
    cssTransitionTimingFunction: GleanCounter;
    cssTranslate: GleanCounter;
    cssUnicodeBidi: GleanCounter;
    cssUserSelect: GleanCounter;
    cssVectorEffect: GleanCounter;
    cssVerticalAlign: GleanCounter;
    cssViewTimeline: GleanCounter;
    cssViewTimelineAxis: GleanCounter;
    cssViewTimelineInset: GleanCounter;
    cssViewTimelineName: GleanCounter;
    cssViewTransitionClass: GleanCounter;
    cssViewTransitionName: GleanCounter;
    cssVisibility: GleanCounter;
    cssWebkitAlignContent: GleanCounter;
    cssWebkitAlignItems: GleanCounter;
    cssWebkitAlignSelf: GleanCounter;
    cssWebkitAnimation: GleanCounter;
    cssWebkitAnimationDelay: GleanCounter;
    cssWebkitAnimationDirection: GleanCounter;
    cssWebkitAnimationDuration: GleanCounter;
    cssWebkitAnimationFillMode: GleanCounter;
    cssWebkitAnimationIterationCount: GleanCounter;
    cssWebkitAnimationName: GleanCounter;
    cssWebkitAnimationPlayState: GleanCounter;
    cssWebkitAnimationTimingFunction: GleanCounter;
    cssWebkitAppearance: GleanCounter;
    cssWebkitBackfaceVisibility: GleanCounter;
    cssWebkitBackgroundClip: GleanCounter;
    cssWebkitBackgroundOrigin: GleanCounter;
    cssWebkitBackgroundSize: GleanCounter;
    cssWebkitBorderBottomLeftRadius: GleanCounter;
    cssWebkitBorderBottomRightRadius: GleanCounter;
    cssWebkitBorderImage: GleanCounter;
    cssWebkitBorderRadius: GleanCounter;
    cssWebkitBorderTopLeftRadius: GleanCounter;
    cssWebkitBorderTopRightRadius: GleanCounter;
    cssWebkitBoxAlign: GleanCounter;
    cssWebkitBoxDirection: GleanCounter;
    cssWebkitBoxFlex: GleanCounter;
    cssWebkitBoxOrdinalGroup: GleanCounter;
    cssWebkitBoxOrient: GleanCounter;
    cssWebkitBoxPack: GleanCounter;
    cssWebkitBoxShadow: GleanCounter;
    cssWebkitBoxSizing: GleanCounter;
    cssWebkitClipPath: GleanCounter;
    cssWebkitFilter: GleanCounter;
    cssWebkitFlex: GleanCounter;
    cssWebkitFlexBasis: GleanCounter;
    cssWebkitFlexDirection: GleanCounter;
    cssWebkitFlexFlow: GleanCounter;
    cssWebkitFlexGrow: GleanCounter;
    cssWebkitFlexShrink: GleanCounter;
    cssWebkitFlexWrap: GleanCounter;
    cssWebkitFontFeatureSettings: GleanCounter;
    cssWebkitFontSmoothing: GleanCounter;
    cssWebkitJustifyContent: GleanCounter;
    cssWebkitLineClamp: GleanCounter;
    cssWebkitMask: GleanCounter;
    cssWebkitMaskClip: GleanCounter;
    cssWebkitMaskComposite: GleanCounter;
    cssWebkitMaskImage: GleanCounter;
    cssWebkitMaskOrigin: GleanCounter;
    cssWebkitMaskPosition: GleanCounter;
    cssWebkitMaskPositionX: GleanCounter;
    cssWebkitMaskPositionY: GleanCounter;
    cssWebkitMaskRepeat: GleanCounter;
    cssWebkitMaskSize: GleanCounter;
    cssWebkitOrder: GleanCounter;
    cssWebkitPerspective: GleanCounter;
    cssWebkitPerspectiveOrigin: GleanCounter;
    cssWebkitTextFillColor: GleanCounter;
    cssWebkitTextSecurity: GleanCounter;
    cssWebkitTextSizeAdjust: GleanCounter;
    cssWebkitTextStroke: GleanCounter;
    cssWebkitTextStrokeColor: GleanCounter;
    cssWebkitTextStrokeWidth: GleanCounter;
    cssWebkitTransform: GleanCounter;
    cssWebkitTransformOrigin: GleanCounter;
    cssWebkitTransformStyle: GleanCounter;
    cssWebkitTransition: GleanCounter;
    cssWebkitTransitionDelay: GleanCounter;
    cssWebkitTransitionDuration: GleanCounter;
    cssWebkitTransitionProperty: GleanCounter;
    cssWebkitTransitionTimingFunction: GleanCounter;
    cssWebkitUserSelect: GleanCounter;
    cssWhiteSpace: GleanCounter;
    cssWhiteSpaceCollapse: GleanCounter;
    cssWidth: GleanCounter;
    cssWillChange: GleanCounter;
    cssWordBreak: GleanCounter;
    cssWordSpacing: GleanCounter;
    cssWordWrap: GleanCounter;
    cssWritingMode: GleanCounter;
    cssX: GleanCounter;
    cssXLang: GleanCounter;
    cssXSpan: GleanCounter;
    cssXTextScale: GleanCounter;
    cssY: GleanCounter;
    cssZIndex: GleanCounter;
    cssZoom: GleanCounter;
    maxZoom: GleanCounter;
    minZoom: GleanCounter;
    orientation: GleanCounter;
    orphans: GleanCounter;
    speak: GleanCounter;
    textSizeAdjust: GleanCounter;
    userZoom: GleanCounter;
    webkitAppRegion: GleanCounter;
    webkitBorderAfter: GleanCounter;
    webkitBorderAfterColor: GleanCounter;
    webkitBorderAfterStyle: GleanCounter;
    webkitBorderAfterWidth: GleanCounter;
    webkitBorderBefore: GleanCounter;
    webkitBorderBeforeColor: GleanCounter;
    webkitBorderBeforeStyle: GleanCounter;
    webkitBorderBeforeWidth: GleanCounter;
    webkitBorderEnd: GleanCounter;
    webkitBorderEndColor: GleanCounter;
    webkitBorderEndStyle: GleanCounter;
    webkitBorderEndWidth: GleanCounter;
    webkitBorderHorizontalSpacing: GleanCounter;
    webkitBorderStart: GleanCounter;
    webkitBorderStartColor: GleanCounter;
    webkitBorderStartStyle: GleanCounter;
    webkitBorderStartWidth: GleanCounter;
    webkitBorderVerticalSpacing: GleanCounter;
    webkitBoxDecorationBreak: GleanCounter;
    webkitBoxReflect: GleanCounter;
    webkitColumnBreakAfter: GleanCounter;
    webkitColumnBreakBefore: GleanCounter;
    webkitColumnBreakInside: GleanCounter;
    webkitColumnCount: GleanCounter;
    webkitColumnGap: GleanCounter;
    webkitColumnRule: GleanCounter;
    webkitColumnRuleColor: GleanCounter;
    webkitColumnRuleStyle: GleanCounter;
    webkitColumnRuleWidth: GleanCounter;
    webkitColumnSpan: GleanCounter;
    webkitColumnWidth: GleanCounter;
    webkitColumns: GleanCounter;
    webkitFontSizeDelta: GleanCounter;
    webkitHighlight: GleanCounter;
    webkitHyphenateCharacter: GleanCounter;
    webkitLineBreak: GleanCounter;
    webkitLocale: GleanCounter;
    webkitLogicalHeight: GleanCounter;
    webkitLogicalWidth: GleanCounter;
    webkitMarginAfter: GleanCounter;
    webkitMarginAfterCollapse: GleanCounter;
    webkitMarginBefore: GleanCounter;
    webkitMarginBeforeCollapse: GleanCounter;
    webkitMarginBottomCollapse: GleanCounter;
    webkitMarginCollapse: GleanCounter;
    webkitMarginEnd: GleanCounter;
    webkitMarginStart: GleanCounter;
    webkitMarginTopCollapse: GleanCounter;
    webkitMaskBoxImage: GleanCounter;
    webkitMaskBoxImageOutset: GleanCounter;
    webkitMaskBoxImageRepeat: GleanCounter;
    webkitMaskBoxImageSlice: GleanCounter;
    webkitMaskBoxImageSource: GleanCounter;
    webkitMaskBoxImageWidth: GleanCounter;
    webkitMaskRepeatX: GleanCounter;
    webkitMaskRepeatY: GleanCounter;
    webkitMaxLogicalHeight: GleanCounter;
    webkitMaxLogicalWidth: GleanCounter;
    webkitMinLogicalHeight: GleanCounter;
    webkitMinLogicalWidth: GleanCounter;
    webkitOpacity: GleanCounter;
    webkitPaddingAfter: GleanCounter;
    webkitPaddingBefore: GleanCounter;
    webkitPaddingEnd: GleanCounter;
    webkitPaddingStart: GleanCounter;
    webkitPerspectiveOriginX: GleanCounter;
    webkitPerspectiveOriginY: GleanCounter;
    webkitPrintColorAdjust: GleanCounter;
    webkitRtlOrdering: GleanCounter;
    webkitRubyPosition: GleanCounter;
    webkitShapeImageThreshold: GleanCounter;
    webkitShapeMargin: GleanCounter;
    webkitShapeOutside: GleanCounter;
    webkitTapHighlightColor: GleanCounter;
    webkitTextCombine: GleanCounter;
    webkitTextDecorationsInEffect: GleanCounter;
    webkitTextEmphasis: GleanCounter;
    webkitTextEmphasisColor: GleanCounter;
    webkitTextEmphasisPosition: GleanCounter;
    webkitTextEmphasisStyle: GleanCounter;
    webkitTextOrientation: GleanCounter;
    webkitTransformOriginX: GleanCounter;
    webkitTransformOriginY: GleanCounter;
    webkitTransformOriginZ: GleanCounter;
    webkitUserDrag: GleanCounter;
    webkitUserModify: GleanCounter;
    webkitWritingMode: GleanCounter;
    widows: GleanCounter;
  };

  useCounterDeprecatedOpsDoc: {
    afterScriptExecuteEvent: GleanCounter;
    ambientLightEvent: GleanCounter;
    appCache: GleanCounter;
    beforeScriptExecuteEvent: GleanCounter;
    components: GleanCounter;
    createImageBitmapCanvasRenderingContext2D: GleanCounter;
    deprecatedTestingAttribute: GleanCounter;
    deprecatedTestingInterface: GleanCounter;
    deprecatedTestingMethod: GleanCounter;
    documentReleaseCapture: GleanCounter;
    domquadBoundsAttr: GleanCounter;
    drawWindowCanvasRenderingContext2D: GleanCounter;
    elementReleaseCapture: GleanCounter;
    elementSetCapture: GleanCounter;
    externalAddSearchProvider: GleanCounter;
    formSubmissionUntrustedEvent: GleanCounter;
    idbobjectStoreCreateIndexLocale: GleanCounter;
    idbopenDboptionsStorageType: GleanCounter;
    imageBitmapRenderingContextTransferImageBitmap: GleanCounter;
    importXulintoContent: GleanCounter;
    initMouseEvent: GleanCounter;
    initNsmouseEvent: GleanCounter;
    installTriggerDeprecated: GleanCounter;
    lenientSetter: GleanCounter;
    lenientThis: GleanCounter;
    mathMlDeprecatedMathSpaceValue2: GleanCounter;
    mathMlDeprecatedMathVariant: GleanCounter;
    motionEvent: GleanCounter;
    mouseEventMozPressure: GleanCounter;
    mozInputSource: GleanCounter;
    mozRequestFullScreenDeprecatedPrefix: GleanCounter;
    mozfullscreenchangeDeprecatedPrefix: GleanCounter;
    mozfullscreenerrorDeprecatedPrefix: GleanCounter;
    navigatorGetUserMedia: GleanCounter;
    nodeIteratorDetach: GleanCounter;
    offscreenCanvasToBlob: GleanCounter;
    orientationEvent: GleanCounter;
    proximityEvent: GleanCounter;
    rtcpeerConnectionGetStreams: GleanCounter;
    svgdeselectAll: GleanCounter;
    syncXmlhttpRequestDeprecated: GleanCounter;
    useOfCaptureEvents: GleanCounter;
    useOfReleaseEvents: GleanCounter;
    webrtcDeprecatedPrefix: GleanCounter;
    windowCcOntrollers: GleanCounter;
    windowContentUntrusted: GleanCounter;
  };

  useCounterDeprecatedOpsPage: {
    afterScriptExecuteEvent: GleanCounter;
    ambientLightEvent: GleanCounter;
    appCache: GleanCounter;
    beforeScriptExecuteEvent: GleanCounter;
    components: GleanCounter;
    createImageBitmapCanvasRenderingContext2D: GleanCounter;
    deprecatedTestingAttribute: GleanCounter;
    deprecatedTestingInterface: GleanCounter;
    deprecatedTestingMethod: GleanCounter;
    documentReleaseCapture: GleanCounter;
    domquadBoundsAttr: GleanCounter;
    drawWindowCanvasRenderingContext2D: GleanCounter;
    elementReleaseCapture: GleanCounter;
    elementSetCapture: GleanCounter;
    externalAddSearchProvider: GleanCounter;
    formSubmissionUntrustedEvent: GleanCounter;
    idbobjectStoreCreateIndexLocale: GleanCounter;
    idbopenDboptionsStorageType: GleanCounter;
    imageBitmapRenderingContextTransferImageBitmap: GleanCounter;
    importXulintoContent: GleanCounter;
    initMouseEvent: GleanCounter;
    initNsmouseEvent: GleanCounter;
    installTriggerDeprecated: GleanCounter;
    lenientSetter: GleanCounter;
    lenientThis: GleanCounter;
    mathMlDeprecatedMathSpaceValue2: GleanCounter;
    mathMlDeprecatedMathVariant: GleanCounter;
    motionEvent: GleanCounter;
    mouseEventMozPressure: GleanCounter;
    mozInputSource: GleanCounter;
    mozRequestFullScreenDeprecatedPrefix: GleanCounter;
    mozfullscreenchangeDeprecatedPrefix: GleanCounter;
    mozfullscreenerrorDeprecatedPrefix: GleanCounter;
    navigatorGetUserMedia: GleanCounter;
    nodeIteratorDetach: GleanCounter;
    offscreenCanvasToBlob: GleanCounter;
    orientationEvent: GleanCounter;
    proximityEvent: GleanCounter;
    rtcpeerConnectionGetStreams: GleanCounter;
    svgdeselectAll: GleanCounter;
    syncXmlhttpRequestDeprecated: GleanCounter;
    useOfCaptureEvents: GleanCounter;
    useOfReleaseEvents: GleanCounter;
    webrtcDeprecatedPrefix: GleanCounter;
    windowCcOntrollers: GleanCounter;
    windowContentUntrusted: GleanCounter;
  };

  useCounterDoc: {
    componentsShimResolved: GleanCounter;
    consoleAssert: GleanCounter;
    consoleClear: GleanCounter;
    consoleCount: GleanCounter;
    consoleCountreset: GleanCounter;
    consoleDebug: GleanCounter;
    consoleDir: GleanCounter;
    consoleDirxml: GleanCounter;
    consoleError: GleanCounter;
    consoleException: GleanCounter;
    consoleGroup: GleanCounter;
    consoleGroupcollapsed: GleanCounter;
    consoleGroupend: GleanCounter;
    consoleInfo: GleanCounter;
    consoleLog: GleanCounter;
    consoleProfile: GleanCounter;
    consoleProfileend: GleanCounter;
    consoleTable: GleanCounter;
    consoleTime: GleanCounter;
    consoleTimeend: GleanCounter;
    consoleTimelog: GleanCounter;
    consoleTimestamp: GleanCounter;
    consoleTrace: GleanCounter;
    consoleWarn: GleanCounter;
    cookiestoreDelete: GleanCounter;
    cookiestoreGet: GleanCounter;
    cookiestoreGetall: GleanCounter;
    cookiestoreSet: GleanCounter;
    customelementregistryDefine: GleanCounter;
    customizedBuiltin: GleanCounter;
    datatransferAddelement: GleanCounter;
    datatransferMozcleardataat: GleanCounter;
    datatransferMozcursorGetter: GleanCounter;
    datatransferMozcursorSetter: GleanCounter;
    datatransferMozgetdataat: GleanCounter;
    datatransferMozitemcountGetter: GleanCounter;
    datatransferMozitemcountSetter: GleanCounter;
    datatransferMozsetdataat: GleanCounter;
    datatransferMozsourcenodeGetter: GleanCounter;
    datatransferMozsourcenodeSetter: GleanCounter;
    datatransferMoztypesat: GleanCounter;
    datatransferMozusercancelledGetter: GleanCounter;
    datatransferMozusercancelledSetter: GleanCounter;
    documentExecCommandContentReadOnly: GleanCounter;
    documentMozsetimageelement: GleanCounter;
    documentOpen: GleanCounter;
    documentQueryCommandStateOrValueContentReadOnly: GleanCounter;
    documentQueryCommandStateOrValueInsertBrOnReturn: GleanCounter;
    documentQueryCommandSupportedOrEnabledContentReadOnly: GleanCounter;
    documentQueryCommandSupportedOrEnabledInsertBrOnReturn: GleanCounter;
    domparserParsefromstring: GleanCounter;
    elementAttachshadow: GleanCounter;
    elementReleasecapture: GleanCounter;
    elementReleasepointercapture: GleanCounter;
    elementSetcapture: GleanCounter;
    elementSethtml: GleanCounter;
    elementSetpointercapture: GleanCounter;
    enumerateDevicesInsec: GleanCounter;
    enumerateDevicesUnfocused: GleanCounter;
    feBlend: GleanCounter;
    feColorMatrix: GleanCounter;
    feComponentTransfer: GleanCounter;
    feComposite: GleanCounter;
    feConvolveMatrix: GleanCounter;
    feDiffuseLighting: GleanCounter;
    feDisplacementMap: GleanCounter;
    feFlood: GleanCounter;
    feGaussianBlur: GleanCounter;
    feImage: GleanCounter;
    feMerge: GleanCounter;
    feMorphology: GleanCounter;
    feOffset: GleanCounter;
    feSpecularLighting: GleanCounter;
    feTile: GleanCounter;
    feTurbulence: GleanCounter;
    filteredCrossOriginIframe: GleanCounter;
    getUserMediaInsec: GleanCounter;
    getUserMediaUnfocused: GleanCounter;
    htmldialogelementShow: GleanCounter;
    htmldocumentCaretrangefrompoint: GleanCounter;
    htmldocumentExitpictureinpicture: GleanCounter;
    htmldocumentFeaturepolicy: GleanCounter;
    htmldocumentNamedGetterHit: GleanCounter;
    htmldocumentOnbeforecopy: GleanCounter;
    htmldocumentOnbeforecut: GleanCounter;
    htmldocumentOnbeforepaste: GleanCounter;
    htmldocumentOncancel: GleanCounter;
    htmldocumentOnfreeze: GleanCounter;
    htmldocumentOnmousewheel: GleanCounter;
    htmldocumentOnresume: GleanCounter;
    htmldocumentOnsearch: GleanCounter;
    htmldocumentOnwebkitfullscreenchange: GleanCounter;
    htmldocumentOnwebkitfullscreenerror: GleanCounter;
    htmldocumentPictureinpictureelement: GleanCounter;
    htmldocumentPictureinpictureenabled: GleanCounter;
    htmldocumentRegisterelement: GleanCounter;
    htmldocumentWasdiscarded: GleanCounter;
    htmldocumentWebkitcancelfullscreen: GleanCounter;
    htmldocumentWebkitcurrentfullscreenelement: GleanCounter;
    htmldocumentWebkitexitfullscreen: GleanCounter;
    htmldocumentWebkitfullscreenelement: GleanCounter;
    htmldocumentWebkitfullscreenenabled: GleanCounter;
    htmldocumentWebkithidden: GleanCounter;
    htmldocumentWebkitisfullscreen: GleanCounter;
    htmldocumentWebkitvisibilitystate: GleanCounter;
    htmldocumentXmlencoding: GleanCounter;
    htmldocumentXmlstandalone: GleanCounter;
    htmldocumentXmlversion: GleanCounter;
    invalidTextDirectives: GleanCounter;
    jsAsmjs: GleanCounter;
    jsDateparse: GleanCounter;
    jsDateparseImplDef: GleanCounter;
    jsIcStubOom: GleanCounter;
    jsIcStubTooLarge: GleanCounter;
    jsIsHtmlddaFuse: GleanCounter;
    jsLargeOomRecovered: GleanCounter;
    jsLargeOomReported: GleanCounter;
    jsLegacyLangSubtag: GleanCounter;
    jsOptimizeArraySpeciesFuse: GleanCounter;
    jsOptimizeGetIteratorFuse: GleanCounter;
    jsOptimizePromiseLookupFuse: GleanCounter;
    jsRegexpSymbolProtocolOnPrimitive: GleanCounter;
    jsSmallOomRecovered: GleanCounter;
    jsSmallOomReported: GleanCounter;
    jsThenable: GleanCounter;
    jsThenableObjectProto: GleanCounter;
    jsThenableProto: GleanCounter;
    jsThenableStandardProto: GleanCounter;
    jsUseAsm: GleanCounter;
    jsWasm: GleanCounter;
    jsWasmLegacyExceptions: GleanCounter;
    locationAncestororigins: GleanCounter;
    mathMlused: GleanCounter;
    mediadevicesEnumeratedevices: GleanCounter;
    mediadevicesGetdisplaymedia: GleanCounter;
    mediadevicesGetusermedia: GleanCounter;
    mixedContentNotUpgradedAudioFailure: GleanCounter;
    mixedContentNotUpgradedAudioSuccess: GleanCounter;
    mixedContentNotUpgradedImageFailure: GleanCounter;
    mixedContentNotUpgradedImageSuccess: GleanCounter;
    mixedContentNotUpgradedVideoFailure: GleanCounter;
    mixedContentNotUpgradedVideoSuccess: GleanCounter;
    mixedContentUpgradedAudioFailure: GleanCounter;
    mixedContentUpgradedAudioSuccess: GleanCounter;
    mixedContentUpgradedImageFailure: GleanCounter;
    mixedContentUpgradedImageSuccess: GleanCounter;
    mixedContentUpgradedVideoFailure: GleanCounter;
    mixedContentUpgradedVideoSuccess: GleanCounter;
    mlsDeriveexporter: GleanCounter;
    mlsGeneratecredentialbasic: GleanCounter;
    mlsGeneratekeypackage: GleanCounter;
    mlsGeneratesignaturekeypair: GleanCounter;
    mlsGroupadd: GleanCounter;
    mlsGroupclose: GleanCounter;
    mlsGroupcreate: GleanCounter;
    mlsGroupjoin: GleanCounter;
    mlsGroupmembers: GleanCounter;
    mlsGroupproposeadd: GleanCounter;
    mlsGroupproposeremove: GleanCounter;
    mlsGroupremove: GleanCounter;
    mlsReceive: GleanCounter;
    mlsSend: GleanCounter;
    mlsStatedelete: GleanCounter;
    mlsStatedeletegroup: GleanCounter;
    navigatorMozgetusermedia: GleanCounter;
    ondommousescroll: GleanCounter;
    onmozmousepixelscroll: GleanCounter;
    percentageStrokeWidthInSvg: GleanCounter;
    percentageStrokeWidthInSvgtext: GleanCounter;
    privateBrowsingCachesDelete: GleanCounter;
    privateBrowsingCachesHas: GleanCounter;
    privateBrowsingCachesKeys: GleanCounter;
    privateBrowsingCachesMatch: GleanCounter;
    privateBrowsingCachesOpen: GleanCounter;
    privateBrowsingIdbfactoryDeleteDatabase: GleanCounter;
    privateBrowsingIdbfactoryOpen: GleanCounter;
    privateBrowsingNavigatorServiceWorker: GleanCounter;
    pushmanagerSubscribe: GleanCounter;
    pushsubscriptionUnsubscribe: GleanCounter;
    rangeCreatecontextualfragment: GleanCounter;
    sanitizerConstructor: GleanCounter;
    sanitizerSanitize: GleanCounter;
    schedulerPosttask: GleanCounter;
    svgsvgelementCurrentscaleGetter: GleanCounter;
    svgsvgelementCurrentscaleSetter: GleanCounter;
    svgsvgelementGetelementbyid: GleanCounter;
    textDirectiveNotCreated: GleanCounter;
    textDirectivePages: GleanCounter;
    windowAbsoluteorientationsensor: GleanCounter;
    windowAccelerometer: GleanCounter;
    windowBackgroundfetchmanager: GleanCounter;
    windowBackgroundfetchrecord: GleanCounter;
    windowBackgroundfetchregistration: GleanCounter;
    windowBeforeinstallpromptevent: GleanCounter;
    windowBluetooth: GleanCounter;
    windowBluetoothcharacteristicproperties: GleanCounter;
    windowBluetoothdevice: GleanCounter;
    windowBluetoothremotegattcharacteristic: GleanCounter;
    windowBluetoothremotegattdescriptor: GleanCounter;
    windowBluetoothremotegattserver: GleanCounter;
    windowBluetoothremotegattservice: GleanCounter;
    windowBluetoothuuid: GleanCounter;
    windowCanvascapturemediastreamtrack: GleanCounter;
    windowChrome: GleanCounter;
    windowClipboarditem: GleanCounter;
    windowCssimagevalue: GleanCounter;
    windowCsskeywordvalue: GleanCounter;
    windowCssmathclamp: GleanCounter;
    windowCssmathinvert: GleanCounter;
    windowCssmathmax: GleanCounter;
    windowCssmathmin: GleanCounter;
    windowCssmathnegate: GleanCounter;
    windowCssmathproduct: GleanCounter;
    windowCssmathsum: GleanCounter;
    windowCssmathvalue: GleanCounter;
    windowCssmatrixcomponent: GleanCounter;
    windowCssnumericarray: GleanCounter;
    windowCssnumericvalue: GleanCounter;
    windowCssperspective: GleanCounter;
    windowCsspositionvalue: GleanCounter;
    windowCsspropertyrule: GleanCounter;
    windowCssrotate: GleanCounter;
    windowCssscale: GleanCounter;
    windowCssskew: GleanCounter;
    windowCssskewx: GleanCounter;
    windowCssskewy: GleanCounter;
    windowCssstylevalue: GleanCounter;
    windowCsstransformcomponent: GleanCounter;
    windowCsstransformvalue: GleanCounter;
    windowCsstranslate: GleanCounter;
    windowCssunitvalue: GleanCounter;
    windowCssunparsedvalue: GleanCounter;
    windowCssvariablereferencevalue: GleanCounter;
    windowDefaultstatus: GleanCounter;
    windowDevicemotioneventacceleration: GleanCounter;
    windowDevicemotioneventrotationrate: GleanCounter;
    windowDomerror: GleanCounter;
    windowEncodedvideochunk: GleanCounter;
    windowEnterpictureinpictureevent: GleanCounter;
    windowExternal: GleanCounter;
    windowFederatedcredential: GleanCounter;
    windowGyroscope: GleanCounter;
    windowHtmlcontentelement: GleanCounter;
    windowHtmlshadowelement: GleanCounter;
    windowImagecapture: GleanCounter;
    windowInputdevicecapabilities: GleanCounter;
    windowInputdeviceinfo: GleanCounter;
    windowKeyboard: GleanCounter;
    windowKeyboardlayoutmap: GleanCounter;
    windowLinearaccelerationsensor: GleanCounter;
    windowMediasettingsrange: GleanCounter;
    windowMidiaccess: GleanCounter;
    windowMidiconnectionevent: GleanCounter;
    windowMidiinput: GleanCounter;
    windowMidiinputmap: GleanCounter;
    windowMidimessageevent: GleanCounter;
    windowMidioutput: GleanCounter;
    windowMidioutputmap: GleanCounter;
    windowMidiport: GleanCounter;
    windowNetworkinformation: GleanCounter;
    windowOffscreenbuffering: GleanCounter;
    windowOnbeforeinstallprompt: GleanCounter;
    windowOncancel: GleanCounter;
    windowOnmousewheel: GleanCounter;
    windowOnorientationchange: GleanCounter;
    windowOnsearch: GleanCounter;
    windowOnselectionchange: GleanCounter;
    windowOpenEmptyUrl: GleanCounter;
    windowOpendatabase: GleanCounter;
    windowOrientation: GleanCounter;
    windowOrientationsensor: GleanCounter;
    windowOverconstrainederror: GleanCounter;
    windowPasswordcredential: GleanCounter;
    windowPaymentaddress: GleanCounter;
    windowPaymentinstruments: GleanCounter;
    windowPaymentmanager: GleanCounter;
    windowPaymentmethodchangeevent: GleanCounter;
    windowPaymentrequest: GleanCounter;
    windowPaymentrequestupdateevent: GleanCounter;
    windowPaymentresponse: GleanCounter;
    windowPerformancelongtasktiming: GleanCounter;
    windowPhotocapabilities: GleanCounter;
    windowPictureinpictureevent: GleanCounter;
    windowPictureinpicturewindow: GleanCounter;
    windowPresentation: GleanCounter;
    windowPresentationavailability: GleanCounter;
    windowPresentationconnection: GleanCounter;
    windowPresentationconnectionavailableevent: GleanCounter;
    windowPresentationconnectioncloseevent: GleanCounter;
    windowPresentationconnectionlist: GleanCounter;
    windowPresentationreceiver: GleanCounter;
    windowPresentationrequest: GleanCounter;
    windowRelativeorientationsensor: GleanCounter;
    windowRemoteplayback: GleanCounter;
    windowReport: GleanCounter;
    windowReportbody: GleanCounter;
    windowReportingobserver: GleanCounter;
    windowRtcerror: GleanCounter;
    windowRtcerrorevent: GleanCounter;
    windowRtcicetransport: GleanCounter;
    windowRtcpeerconnectioniceerrorevent: GleanCounter;
    windowSensor: GleanCounter;
    windowSensorerrorevent: GleanCounter;
    windowSidebarGetter: GleanCounter;
    windowSidebarSetter: GleanCounter;
    windowSpeechrecognitionalternative: GleanCounter;
    windowSpeechrecognitionresult: GleanCounter;
    windowSpeechrecognitionresultlist: GleanCounter;
    windowStylemedia: GleanCounter;
    windowStylepropertymap: GleanCounter;
    windowStylepropertymapreadonly: GleanCounter;
    windowSvgdiscardelement: GleanCounter;
    windowSyncmanager: GleanCounter;
    windowTaskattributiontiming: GleanCounter;
    windowTextevent: GleanCounter;
    windowTouch: GleanCounter;
    windowTouchevent: GleanCounter;
    windowTouchlist: GleanCounter;
    windowUsb: GleanCounter;
    windowUsbalternateinterface: GleanCounter;
    windowUsbconfiguration: GleanCounter;
    windowUsbconnectionevent: GleanCounter;
    windowUsbdevice: GleanCounter;
    windowUsbendpoint: GleanCounter;
    windowUsbinterface: GleanCounter;
    windowUsbintransferresult: GleanCounter;
    windowUsbisochronousintransferpacket: GleanCounter;
    windowUsbisochronousintransferresult: GleanCounter;
    windowUsbisochronousouttransferpacket: GleanCounter;
    windowUsbisochronousouttransferresult: GleanCounter;
    windowUsbouttransferresult: GleanCounter;
    windowUseractivation: GleanCounter;
    windowVideocolorspace: GleanCounter;
    windowVideodecoder: GleanCounter;
    windowVideoencoder: GleanCounter;
    windowVideoframe: GleanCounter;
    windowWakelock: GleanCounter;
    windowWakelocksentinel: GleanCounter;
    windowWebkitcancelanimationframe: GleanCounter;
    windowWebkitmediastream: GleanCounter;
    windowWebkitmutationobserver: GleanCounter;
    windowWebkitrequestanimationframe: GleanCounter;
    windowWebkitrequestfilesystem: GleanCounter;
    windowWebkitresolvelocalfilesystemurl: GleanCounter;
    windowWebkitrtcpeerconnection: GleanCounter;
    windowWebkitspeechgrammar: GleanCounter;
    windowWebkitspeechgrammarlist: GleanCounter;
    windowWebkitspeechrecognition: GleanCounter;
    windowWebkitspeechrecognitionerror: GleanCounter;
    windowWebkitspeechrecognitionevent: GleanCounter;
    windowWebkitstorageinfo: GleanCounter;
    wrFilterFallback: GleanCounter;
    xslstylesheet: GleanCounter;
    xsltprocessorConstructor: GleanCounter;
    youTubeFlashEmbed: GleanCounter;
  };

  useCounterPage: {
    componentsShimResolved: GleanCounter;
    consoleAssert: GleanCounter;
    consoleClear: GleanCounter;
    consoleCount: GleanCounter;
    consoleCountreset: GleanCounter;
    consoleDebug: GleanCounter;
    consoleDir: GleanCounter;
    consoleDirxml: GleanCounter;
    consoleError: GleanCounter;
    consoleException: GleanCounter;
    consoleGroup: GleanCounter;
    consoleGroupcollapsed: GleanCounter;
    consoleGroupend: GleanCounter;
    consoleInfo: GleanCounter;
    consoleLog: GleanCounter;
    consoleProfile: GleanCounter;
    consoleProfileend: GleanCounter;
    consoleTable: GleanCounter;
    consoleTime: GleanCounter;
    consoleTimeend: GleanCounter;
    consoleTimelog: GleanCounter;
    consoleTimestamp: GleanCounter;
    consoleTrace: GleanCounter;
    consoleWarn: GleanCounter;
    cookiestoreDelete: GleanCounter;
    cookiestoreGet: GleanCounter;
    cookiestoreGetall: GleanCounter;
    cookiestoreSet: GleanCounter;
    customelementregistryDefine: GleanCounter;
    customizedBuiltin: GleanCounter;
    datatransferAddelement: GleanCounter;
    datatransferMozcleardataat: GleanCounter;
    datatransferMozcursorGetter: GleanCounter;
    datatransferMozcursorSetter: GleanCounter;
    datatransferMozgetdataat: GleanCounter;
    datatransferMozitemcountGetter: GleanCounter;
    datatransferMozitemcountSetter: GleanCounter;
    datatransferMozsetdataat: GleanCounter;
    datatransferMozsourcenodeGetter: GleanCounter;
    datatransferMozsourcenodeSetter: GleanCounter;
    datatransferMoztypesat: GleanCounter;
    datatransferMozusercancelledGetter: GleanCounter;
    datatransferMozusercancelledSetter: GleanCounter;
    documentExecCommandContentReadOnly: GleanCounter;
    documentMozsetimageelement: GleanCounter;
    documentOpen: GleanCounter;
    documentQueryCommandStateOrValueContentReadOnly: GleanCounter;
    documentQueryCommandStateOrValueInsertBrOnReturn: GleanCounter;
    documentQueryCommandSupportedOrEnabledContentReadOnly: GleanCounter;
    documentQueryCommandSupportedOrEnabledInsertBrOnReturn: GleanCounter;
    domparserParsefromstring: GleanCounter;
    elementAttachshadow: GleanCounter;
    elementReleasecapture: GleanCounter;
    elementReleasepointercapture: GleanCounter;
    elementSetcapture: GleanCounter;
    elementSethtml: GleanCounter;
    elementSetpointercapture: GleanCounter;
    enumerateDevicesInsec: GleanCounter;
    enumerateDevicesUnfocused: GleanCounter;
    feBlend: GleanCounter;
    feColorMatrix: GleanCounter;
    feComponentTransfer: GleanCounter;
    feComposite: GleanCounter;
    feConvolveMatrix: GleanCounter;
    feDiffuseLighting: GleanCounter;
    feDisplacementMap: GleanCounter;
    feFlood: GleanCounter;
    feGaussianBlur: GleanCounter;
    feImage: GleanCounter;
    feMerge: GleanCounter;
    feMorphology: GleanCounter;
    feOffset: GleanCounter;
    feSpecularLighting: GleanCounter;
    feTile: GleanCounter;
    feTurbulence: GleanCounter;
    filteredCrossOriginIframe: GleanCounter;
    getUserMediaInsec: GleanCounter;
    getUserMediaUnfocused: GleanCounter;
    htmldialogelementShow: GleanCounter;
    htmldocumentCaretrangefrompoint: GleanCounter;
    htmldocumentExitpictureinpicture: GleanCounter;
    htmldocumentFeaturepolicy: GleanCounter;
    htmldocumentNamedGetterHit: GleanCounter;
    htmldocumentOnbeforecopy: GleanCounter;
    htmldocumentOnbeforecut: GleanCounter;
    htmldocumentOnbeforepaste: GleanCounter;
    htmldocumentOncancel: GleanCounter;
    htmldocumentOnfreeze: GleanCounter;
    htmldocumentOnmousewheel: GleanCounter;
    htmldocumentOnresume: GleanCounter;
    htmldocumentOnsearch: GleanCounter;
    htmldocumentOnwebkitfullscreenchange: GleanCounter;
    htmldocumentOnwebkitfullscreenerror: GleanCounter;
    htmldocumentPictureinpictureelement: GleanCounter;
    htmldocumentPictureinpictureenabled: GleanCounter;
    htmldocumentRegisterelement: GleanCounter;
    htmldocumentWasdiscarded: GleanCounter;
    htmldocumentWebkitcancelfullscreen: GleanCounter;
    htmldocumentWebkitcurrentfullscreenelement: GleanCounter;
    htmldocumentWebkitexitfullscreen: GleanCounter;
    htmldocumentWebkitfullscreenelement: GleanCounter;
    htmldocumentWebkitfullscreenenabled: GleanCounter;
    htmldocumentWebkithidden: GleanCounter;
    htmldocumentWebkitisfullscreen: GleanCounter;
    htmldocumentWebkitvisibilitystate: GleanCounter;
    htmldocumentXmlencoding: GleanCounter;
    htmldocumentXmlstandalone: GleanCounter;
    htmldocumentXmlversion: GleanCounter;
    invalidTextDirectives: GleanCounter;
    jsAsmjs: GleanCounter;
    jsDateparse: GleanCounter;
    jsDateparseImplDef: GleanCounter;
    jsIcStubOom: GleanCounter;
    jsIcStubTooLarge: GleanCounter;
    jsIsHtmlddaFuse: GleanCounter;
    jsLargeOomRecovered: GleanCounter;
    jsLargeOomReported: GleanCounter;
    jsLegacyLangSubtag: GleanCounter;
    jsOptimizeArraySpeciesFuse: GleanCounter;
    jsOptimizeGetIteratorFuse: GleanCounter;
    jsOptimizePromiseLookupFuse: GleanCounter;
    jsRegexpSymbolProtocolOnPrimitive: GleanCounter;
    jsSmallOomRecovered: GleanCounter;
    jsSmallOomReported: GleanCounter;
    jsThenable: GleanCounter;
    jsThenableObjectProto: GleanCounter;
    jsThenableProto: GleanCounter;
    jsThenableStandardProto: GleanCounter;
    jsUseAsm: GleanCounter;
    jsWasm: GleanCounter;
    jsWasmLegacyExceptions: GleanCounter;
    locationAncestororigins: GleanCounter;
    mathMlused: GleanCounter;
    mediadevicesEnumeratedevices: GleanCounter;
    mediadevicesGetdisplaymedia: GleanCounter;
    mediadevicesGetusermedia: GleanCounter;
    mixedContentNotUpgradedAudioFailure: GleanCounter;
    mixedContentNotUpgradedAudioSuccess: GleanCounter;
    mixedContentNotUpgradedImageFailure: GleanCounter;
    mixedContentNotUpgradedImageSuccess: GleanCounter;
    mixedContentNotUpgradedVideoFailure: GleanCounter;
    mixedContentNotUpgradedVideoSuccess: GleanCounter;
    mixedContentUpgradedAudioFailure: GleanCounter;
    mixedContentUpgradedAudioSuccess: GleanCounter;
    mixedContentUpgradedImageFailure: GleanCounter;
    mixedContentUpgradedImageSuccess: GleanCounter;
    mixedContentUpgradedVideoFailure: GleanCounter;
    mixedContentUpgradedVideoSuccess: GleanCounter;
    mlsDeriveexporter: GleanCounter;
    mlsGeneratecredentialbasic: GleanCounter;
    mlsGeneratekeypackage: GleanCounter;
    mlsGeneratesignaturekeypair: GleanCounter;
    mlsGroupadd: GleanCounter;
    mlsGroupclose: GleanCounter;
    mlsGroupcreate: GleanCounter;
    mlsGroupjoin: GleanCounter;
    mlsGroupmembers: GleanCounter;
    mlsGroupproposeadd: GleanCounter;
    mlsGroupproposeremove: GleanCounter;
    mlsGroupremove: GleanCounter;
    mlsReceive: GleanCounter;
    mlsSend: GleanCounter;
    mlsStatedelete: GleanCounter;
    mlsStatedeletegroup: GleanCounter;
    navigatorMozgetusermedia: GleanCounter;
    ondommousescroll: GleanCounter;
    onmozmousepixelscroll: GleanCounter;
    percentageStrokeWidthInSvg: GleanCounter;
    percentageStrokeWidthInSvgtext: GleanCounter;
    privateBrowsingCachesDelete: GleanCounter;
    privateBrowsingCachesHas: GleanCounter;
    privateBrowsingCachesKeys: GleanCounter;
    privateBrowsingCachesMatch: GleanCounter;
    privateBrowsingCachesOpen: GleanCounter;
    privateBrowsingIdbfactoryDeleteDatabase: GleanCounter;
    privateBrowsingIdbfactoryOpen: GleanCounter;
    privateBrowsingNavigatorServiceWorker: GleanCounter;
    pushmanagerSubscribe: GleanCounter;
    pushsubscriptionUnsubscribe: GleanCounter;
    rangeCreatecontextualfragment: GleanCounter;
    sanitizerConstructor: GleanCounter;
    sanitizerSanitize: GleanCounter;
    schedulerPosttask: GleanCounter;
    svgsvgelementCurrentscaleGetter: GleanCounter;
    svgsvgelementCurrentscaleSetter: GleanCounter;
    svgsvgelementGetelementbyid: GleanCounter;
    textDirectiveNotCreated: GleanCounter;
    textDirectivePages: GleanCounter;
    windowAbsoluteorientationsensor: GleanCounter;
    windowAccelerometer: GleanCounter;
    windowBackgroundfetchmanager: GleanCounter;
    windowBackgroundfetchrecord: GleanCounter;
    windowBackgroundfetchregistration: GleanCounter;
    windowBeforeinstallpromptevent: GleanCounter;
    windowBluetooth: GleanCounter;
    windowBluetoothcharacteristicproperties: GleanCounter;
    windowBluetoothdevice: GleanCounter;
    windowBluetoothremotegattcharacteristic: GleanCounter;
    windowBluetoothremotegattdescriptor: GleanCounter;
    windowBluetoothremotegattserver: GleanCounter;
    windowBluetoothremotegattservice: GleanCounter;
    windowBluetoothuuid: GleanCounter;
    windowCanvascapturemediastreamtrack: GleanCounter;
    windowChrome: GleanCounter;
    windowClipboarditem: GleanCounter;
    windowCssimagevalue: GleanCounter;
    windowCsskeywordvalue: GleanCounter;
    windowCssmathclamp: GleanCounter;
    windowCssmathinvert: GleanCounter;
    windowCssmathmax: GleanCounter;
    windowCssmathmin: GleanCounter;
    windowCssmathnegate: GleanCounter;
    windowCssmathproduct: GleanCounter;
    windowCssmathsum: GleanCounter;
    windowCssmathvalue: GleanCounter;
    windowCssmatrixcomponent: GleanCounter;
    windowCssnumericarray: GleanCounter;
    windowCssnumericvalue: GleanCounter;
    windowCssperspective: GleanCounter;
    windowCsspositionvalue: GleanCounter;
    windowCsspropertyrule: GleanCounter;
    windowCssrotate: GleanCounter;
    windowCssscale: GleanCounter;
    windowCssskew: GleanCounter;
    windowCssskewx: GleanCounter;
    windowCssskewy: GleanCounter;
    windowCssstylevalue: GleanCounter;
    windowCsstransformcomponent: GleanCounter;
    windowCsstransformvalue: GleanCounter;
    windowCsstranslate: GleanCounter;
    windowCssunitvalue: GleanCounter;
    windowCssunparsedvalue: GleanCounter;
    windowCssvariablereferencevalue: GleanCounter;
    windowDefaultstatus: GleanCounter;
    windowDevicemotioneventacceleration: GleanCounter;
    windowDevicemotioneventrotationrate: GleanCounter;
    windowDomerror: GleanCounter;
    windowEncodedvideochunk: GleanCounter;
    windowEnterpictureinpictureevent: GleanCounter;
    windowExternal: GleanCounter;
    windowFederatedcredential: GleanCounter;
    windowGyroscope: GleanCounter;
    windowHtmlcontentelement: GleanCounter;
    windowHtmlshadowelement: GleanCounter;
    windowImagecapture: GleanCounter;
    windowInputdevicecapabilities: GleanCounter;
    windowInputdeviceinfo: GleanCounter;
    windowKeyboard: GleanCounter;
    windowKeyboardlayoutmap: GleanCounter;
    windowLinearaccelerationsensor: GleanCounter;
    windowMediasettingsrange: GleanCounter;
    windowMidiaccess: GleanCounter;
    windowMidiconnectionevent: GleanCounter;
    windowMidiinput: GleanCounter;
    windowMidiinputmap: GleanCounter;
    windowMidimessageevent: GleanCounter;
    windowMidioutput: GleanCounter;
    windowMidioutputmap: GleanCounter;
    windowMidiport: GleanCounter;
    windowNetworkinformation: GleanCounter;
    windowOffscreenbuffering: GleanCounter;
    windowOnbeforeinstallprompt: GleanCounter;
    windowOncancel: GleanCounter;
    windowOnmousewheel: GleanCounter;
    windowOnorientationchange: GleanCounter;
    windowOnsearch: GleanCounter;
    windowOnselectionchange: GleanCounter;
    windowOpenEmptyUrl: GleanCounter;
    windowOpendatabase: GleanCounter;
    windowOrientation: GleanCounter;
    windowOrientationsensor: GleanCounter;
    windowOverconstrainederror: GleanCounter;
    windowPasswordcredential: GleanCounter;
    windowPaymentaddress: GleanCounter;
    windowPaymentinstruments: GleanCounter;
    windowPaymentmanager: GleanCounter;
    windowPaymentmethodchangeevent: GleanCounter;
    windowPaymentrequest: GleanCounter;
    windowPaymentrequestupdateevent: GleanCounter;
    windowPaymentresponse: GleanCounter;
    windowPerformancelongtasktiming: GleanCounter;
    windowPhotocapabilities: GleanCounter;
    windowPictureinpictureevent: GleanCounter;
    windowPictureinpicturewindow: GleanCounter;
    windowPresentation: GleanCounter;
    windowPresentationavailability: GleanCounter;
    windowPresentationconnection: GleanCounter;
    windowPresentationconnectionavailableevent: GleanCounter;
    windowPresentationconnectioncloseevent: GleanCounter;
    windowPresentationconnectionlist: GleanCounter;
    windowPresentationreceiver: GleanCounter;
    windowPresentationrequest: GleanCounter;
    windowRelativeorientationsensor: GleanCounter;
    windowRemoteplayback: GleanCounter;
    windowReport: GleanCounter;
    windowReportbody: GleanCounter;
    windowReportingobserver: GleanCounter;
    windowRtcerror: GleanCounter;
    windowRtcerrorevent: GleanCounter;
    windowRtcicetransport: GleanCounter;
    windowRtcpeerconnectioniceerrorevent: GleanCounter;
    windowSensor: GleanCounter;
    windowSensorerrorevent: GleanCounter;
    windowSidebarGetter: GleanCounter;
    windowSidebarSetter: GleanCounter;
    windowSpeechrecognitionalternative: GleanCounter;
    windowSpeechrecognitionresult: GleanCounter;
    windowSpeechrecognitionresultlist: GleanCounter;
    windowStylemedia: GleanCounter;
    windowStylepropertymap: GleanCounter;
    windowStylepropertymapreadonly: GleanCounter;
    windowSvgdiscardelement: GleanCounter;
    windowSyncmanager: GleanCounter;
    windowTaskattributiontiming: GleanCounter;
    windowTextevent: GleanCounter;
    windowTouch: GleanCounter;
    windowTouchevent: GleanCounter;
    windowTouchlist: GleanCounter;
    windowUsb: GleanCounter;
    windowUsbalternateinterface: GleanCounter;
    windowUsbconfiguration: GleanCounter;
    windowUsbconnectionevent: GleanCounter;
    windowUsbdevice: GleanCounter;
    windowUsbendpoint: GleanCounter;
    windowUsbinterface: GleanCounter;
    windowUsbintransferresult: GleanCounter;
    windowUsbisochronousintransferpacket: GleanCounter;
    windowUsbisochronousintransferresult: GleanCounter;
    windowUsbisochronousouttransferpacket: GleanCounter;
    windowUsbisochronousouttransferresult: GleanCounter;
    windowUsbouttransferresult: GleanCounter;
    windowUseractivation: GleanCounter;
    windowVideocolorspace: GleanCounter;
    windowVideodecoder: GleanCounter;
    windowVideoencoder: GleanCounter;
    windowVideoframe: GleanCounter;
    windowWakelock: GleanCounter;
    windowWakelocksentinel: GleanCounter;
    windowWebkitcancelanimationframe: GleanCounter;
    windowWebkitmediastream: GleanCounter;
    windowWebkitmutationobserver: GleanCounter;
    windowWebkitrequestanimationframe: GleanCounter;
    windowWebkitrequestfilesystem: GleanCounter;
    windowWebkitresolvelocalfilesystemurl: GleanCounter;
    windowWebkitrtcpeerconnection: GleanCounter;
    windowWebkitspeechgrammar: GleanCounter;
    windowWebkitspeechgrammarlist: GleanCounter;
    windowWebkitspeechrecognition: GleanCounter;
    windowWebkitspeechrecognitionerror: GleanCounter;
    windowWebkitspeechrecognitionevent: GleanCounter;
    windowWebkitstorageinfo: GleanCounter;
    wrFilterFallback: GleanCounter;
    xslstylesheet: GleanCounter;
    xsltprocessorConstructor: GleanCounter;
    youTubeFlashEmbed: GleanCounter;
  };

  useCounterWorkerDedicated: {
    consoleAssert: GleanCounter;
    consoleClear: GleanCounter;
    consoleCount: GleanCounter;
    consoleCountreset: GleanCounter;
    consoleDebug: GleanCounter;
    consoleDir: GleanCounter;
    consoleDirxml: GleanCounter;
    consoleError: GleanCounter;
    consoleException: GleanCounter;
    consoleGroup: GleanCounter;
    consoleGroupcollapsed: GleanCounter;
    consoleGroupend: GleanCounter;
    consoleInfo: GleanCounter;
    consoleLog: GleanCounter;
    consoleProfile: GleanCounter;
    consoleProfileend: GleanCounter;
    consoleTable: GleanCounter;
    consoleTime: GleanCounter;
    consoleTimeend: GleanCounter;
    consoleTimelog: GleanCounter;
    consoleTimestamp: GleanCounter;
    consoleTrace: GleanCounter;
    consoleWarn: GleanCounter;
    cookiestoreDelete: GleanCounter;
    cookiestoreGet: GleanCounter;
    cookiestoreGetall: GleanCounter;
    cookiestoreSet: GleanCounter;
    mlsDeriveexporter: GleanCounter;
    mlsGeneratecredentialbasic: GleanCounter;
    mlsGeneratekeypackage: GleanCounter;
    mlsGeneratesignaturekeypair: GleanCounter;
    mlsGroupadd: GleanCounter;
    mlsGroupclose: GleanCounter;
    mlsGroupcreate: GleanCounter;
    mlsGroupjoin: GleanCounter;
    mlsGroupmembers: GleanCounter;
    mlsGroupproposeadd: GleanCounter;
    mlsGroupproposeremove: GleanCounter;
    mlsGroupremove: GleanCounter;
    mlsReceive: GleanCounter;
    mlsSend: GleanCounter;
    mlsStatedelete: GleanCounter;
    mlsStatedeletegroup: GleanCounter;
    privateBrowsingCachesDelete: GleanCounter;
    privateBrowsingCachesHas: GleanCounter;
    privateBrowsingCachesKeys: GleanCounter;
    privateBrowsingCachesMatch: GleanCounter;
    privateBrowsingCachesOpen: GleanCounter;
    privateBrowsingIdbfactoryDeleteDatabase: GleanCounter;
    privateBrowsingIdbfactoryOpen: GleanCounter;
    pushmanagerSubscribe: GleanCounter;
    pushsubscriptionUnsubscribe: GleanCounter;
    schedulerPosttask: GleanCounter;
  };

  useCounterWorkerService: {
    consoleAssert: GleanCounter;
    consoleClear: GleanCounter;
    consoleCount: GleanCounter;
    consoleCountreset: GleanCounter;
    consoleDebug: GleanCounter;
    consoleDir: GleanCounter;
    consoleDirxml: GleanCounter;
    consoleError: GleanCounter;
    consoleException: GleanCounter;
    consoleGroup: GleanCounter;
    consoleGroupcollapsed: GleanCounter;
    consoleGroupend: GleanCounter;
    consoleInfo: GleanCounter;
    consoleLog: GleanCounter;
    consoleProfile: GleanCounter;
    consoleProfileend: GleanCounter;
    consoleTable: GleanCounter;
    consoleTime: GleanCounter;
    consoleTimeend: GleanCounter;
    consoleTimelog: GleanCounter;
    consoleTimestamp: GleanCounter;
    consoleTrace: GleanCounter;
    consoleWarn: GleanCounter;
    cookiestoreDelete: GleanCounter;
    cookiestoreGet: GleanCounter;
    cookiestoreGetall: GleanCounter;
    cookiestoreSet: GleanCounter;
    mlsDeriveexporter: GleanCounter;
    mlsGeneratecredentialbasic: GleanCounter;
    mlsGeneratekeypackage: GleanCounter;
    mlsGeneratesignaturekeypair: GleanCounter;
    mlsGroupadd: GleanCounter;
    mlsGroupclose: GleanCounter;
    mlsGroupcreate: GleanCounter;
    mlsGroupjoin: GleanCounter;
    mlsGroupmembers: GleanCounter;
    mlsGroupproposeadd: GleanCounter;
    mlsGroupproposeremove: GleanCounter;
    mlsGroupremove: GleanCounter;
    mlsReceive: GleanCounter;
    mlsSend: GleanCounter;
    mlsStatedelete: GleanCounter;
    mlsStatedeletegroup: GleanCounter;
    privateBrowsingCachesDelete: GleanCounter;
    privateBrowsingCachesHas: GleanCounter;
    privateBrowsingCachesKeys: GleanCounter;
    privateBrowsingCachesMatch: GleanCounter;
    privateBrowsingCachesOpen: GleanCounter;
    privateBrowsingIdbfactoryDeleteDatabase: GleanCounter;
    privateBrowsingIdbfactoryOpen: GleanCounter;
    pushmanagerSubscribe: GleanCounter;
    pushsubscriptionUnsubscribe: GleanCounter;
    schedulerPosttask: GleanCounter;
  };

  useCounterWorkerShared: {
    consoleAssert: GleanCounter;
    consoleClear: GleanCounter;
    consoleCount: GleanCounter;
    consoleCountreset: GleanCounter;
    consoleDebug: GleanCounter;
    consoleDir: GleanCounter;
    consoleDirxml: GleanCounter;
    consoleError: GleanCounter;
    consoleException: GleanCounter;
    consoleGroup: GleanCounter;
    consoleGroupcollapsed: GleanCounter;
    consoleGroupend: GleanCounter;
    consoleInfo: GleanCounter;
    consoleLog: GleanCounter;
    consoleProfile: GleanCounter;
    consoleProfileend: GleanCounter;
    consoleTable: GleanCounter;
    consoleTime: GleanCounter;
    consoleTimeend: GleanCounter;
    consoleTimelog: GleanCounter;
    consoleTimestamp: GleanCounter;
    consoleTrace: GleanCounter;
    consoleWarn: GleanCounter;
    cookiestoreDelete: GleanCounter;
    cookiestoreGet: GleanCounter;
    cookiestoreGetall: GleanCounter;
    cookiestoreSet: GleanCounter;
    mlsDeriveexporter: GleanCounter;
    mlsGeneratecredentialbasic: GleanCounter;
    mlsGeneratekeypackage: GleanCounter;
    mlsGeneratesignaturekeypair: GleanCounter;
    mlsGroupadd: GleanCounter;
    mlsGroupclose: GleanCounter;
    mlsGroupcreate: GleanCounter;
    mlsGroupjoin: GleanCounter;
    mlsGroupmembers: GleanCounter;
    mlsGroupproposeadd: GleanCounter;
    mlsGroupproposeremove: GleanCounter;
    mlsGroupremove: GleanCounter;
    mlsReceive: GleanCounter;
    mlsSend: GleanCounter;
    mlsStatedelete: GleanCounter;
    mlsStatedeletegroup: GleanCounter;
    privateBrowsingCachesDelete: GleanCounter;
    privateBrowsingCachesHas: GleanCounter;
    privateBrowsingCachesKeys: GleanCounter;
    privateBrowsingCachesMatch: GleanCounter;
    privateBrowsingCachesOpen: GleanCounter;
    privateBrowsingIdbfactoryDeleteDatabase: GleanCounter;
    privateBrowsingIdbfactoryOpen: GleanCounter;
    pushmanagerSubscribe: GleanCounter;
    pushsubscriptionUnsubscribe: GleanCounter;
    schedulerPosttask: GleanCounter;
  };

  canvas: {
    used2d: Record<'false' | 'true', GleanCounter>;
    webgl2Success: Record<'false' | 'true', GleanCounter>;
    webglAcclFailureId: Record<string, GleanCounter>;
    webglFailureId: Record<string, GleanCounter>;
    webglSuccess: Record<'false' | 'true', GleanCounter>;
    webglUsed: Record<'false' | 'true', GleanCounter>;
  };

  webcrypto: {
    alg: GleanCustomDistribution;
    extractableEnc: Record<'false' | 'true', GleanCounter>;
    extractableGenerate: Record<'false' | 'true', GleanCounter>;
    extractableImport: Record<'false' | 'true', GleanCounter>;
    extractableSig: Record<'false' | 'true', GleanCounter>;
    method: GleanCustomDistribution;
    resolved: Record<'false' | 'true', GleanCounter>;
  };

  geolocation: {
    accuracy: GleanCustomDistribution;
    fallback: Record<'none' | 'on_error' | 'on_timeout', GleanCounter>;
    linuxProvider: Record<'geoclue' | 'none' | 'portal', GleanBoolean>;
    requestResult: Record<
      'permission_denied' | 'position_unavailable' | 'success' | 'timeout',
      GleanCounter
    >;
  };

  idbMaintenance: {
    fallbackFullrestoreMetadata: GleanCounter;
    metadataRestored: GleanCounter;
    unknownMetadata: GleanCounter;
  };

  localstorageDatabase: {
    newObjectSetupTime: GleanTimingDistribution;
    requestAllowToCloseResponseTime: GleanTimingDistribution;
  };

  localstorageRequest: {
    prepareDatastoreProcessingTime: GleanTimingDistribution;
    recvCancelCounter: GleanCounter;
    sendCancelCounter: GleanCounter;
  };

  mediadrm: {
    decryption: Record<
      | 'has_hardware_clearlead'
      | 'has_hardware_decryption'
      | 'has_hdcp22_plus'
      | 'has_software_clearlead'
      | 'has_wmf',
      GleanBoolean
    >;
    emePlayback: GleanEventWithExtras<{
      key_system?: string;
      played_time?: string;
      resolution?: string;
      video_codec?: string;
    }>;
  };

  hls: {
    canplayRequested: GleanCounter;
    canplaySupported: GleanCounter;
    mediaLoad: GleanEventWithExtras<{ media_extension?: string }>;
  };

  gmp: {
    updateXmlFetchResult: Record<
      | 'cert_pin_abort'
      | 'cert_pin_failed'
      | 'cert_pin_invalid'
      | 'cert_pin_missing_data'
      | 'cert_pin_net_request_error'
      | 'cert_pin_net_timeout'
      | 'cert_pin_success'
      | 'cert_pin_unknown_error'
      | 'cert_pin_xml_parse_error'
      | 'content_sig_abort'
      | 'content_sig_failed'
      | 'content_sig_invalid'
      | 'content_sig_missing_data'
      | 'content_sig_net_request_error'
      | 'content_sig_net_timeout'
      | 'content_sig_success'
      | 'content_sig_unknown_error'
      | 'content_sig_xml_parse_error',
      GleanCounter
    >;
  };

  media: {
    audiblePlayTimePercent: Record<string, GleanCustomDistribution>;
    codecUsed: Record<string, GleanCounter>;
    elementInPageCount: GleanCounter;
    error: GleanEventWithExtras<{ error_name?: string; error_type?: string; key_system?: string }>;
    mediaPlayTime: Record<string, GleanTimingDistribution>;
    mkvCodecType: Record<
      | 'AudioAac'
      | 'AudioFlac'
      | 'AudioMp3'
      | 'AudioOpus'
      | 'AudioPcm'
      | 'AudioVorbis'
      | 'NoCodecSpecified'
      | 'VideoAv1'
      | 'VideoAvc'
      | 'VideoHevc'
      | 'VideoVp8'
      | 'VideoVp9',
      GleanCounter
    >;
    mkvContentCount: GleanCounter;
    mseSourceBufferType: Record<
      | 'AudioAac'
      | 'AudioMp2t'
      | 'AudioMp4'
      | 'AudioMpeg'
      | 'AudioWebm'
      | 'VideoHevc'
      | 'VideoMp2t'
      | 'VideoMp4'
      | 'VideoWebm',
      GleanCounter
    >;
    mutedPlayTimePercent: Record<string, GleanCustomDistribution>;
    videoClearkeyPlayTime: GleanTimingDistribution;
    videoDroppedCompositorFramesProportionExponential: GleanCustomDistribution;
    videoDroppedDecodedFramesProportionExponential: GleanCustomDistribution;
    videoDroppedFramesProportion: GleanCustomDistribution;
    videoDroppedFramesProportionExponential: GleanCustomDistribution;
    videoDroppedSinkFramesProportionExponential: GleanCustomDistribution;
    videoEncryptedPlayTime: GleanTimingDistribution;
    videoHardwareDecodingSupport: Record<string, GleanBoolean>;
    videoHdHardwareDecodingSupport: Record<string, GleanBoolean>;
    videoHdrPlayTime: GleanTimingDistribution;
    videoHiddenPlayTime: GleanTimingDistribution;
    videoHiddenPlayTimePercentage: Record<string, GleanCustomDistribution>;
    videoPlayTime: GleanTimingDistribution;
    videoVisiblePlayTime: Record<string, GleanTimingDistribution>;
    videoWidevinePlayTime: GleanTimingDistribution;
    decoderBackendUsed: GleanCustomDistribution;
  };

  mediaAudio: {
    backend: Record<
      | 'aaudio'
      | 'alsa'
      | 'audiounit'
      | 'audiounit-rust'
      | 'jack'
      | 'opensl'
      | 'oss'
      | 'pulse'
      | 'pulse-rust'
      | 'sndio'
      | 'sunaudio'
      | 'unknown'
      | 'wasapi'
      | 'winmm',
      GleanCounter
    >;
    initFailure: Record<'first' | 'other', GleanCounter>;
  };

  mediaPlayback: {
    decodeError: GleanEventWithExtras<{
      decoder_name?: string;
      error_name?: string;
      is_hardware_accelerated?: string;
      key_system?: string;
      mime_type?: string;
    }>;
    deviceHardwareDecoderSupport: Record<'av1' | 'h264' | 'hevc' | 'vp8' | 'vp9', GleanBoolean>;
    firstFrameLoaded: GleanEventWithExtras<{
      buffering_time?: string;
      decoder_name?: string;
      first_frame_loaded_time?: string;
      hls_decoder?: string;
      is_hardware_decoding?: string;
      is_hdr?: string;
      key_system?: string;
      metadata_loaded_time?: string;
      playback_type?: string;
      resolution?: string;
      total_waiting_data_time?: string;
      video_codec?: string;
    }>;
    notSupportedVideoPerMimeType: Record<string, GleanCounter>;
  };

  mediaMp4Parse: {
    numSampleDescriptionEntries: GleanCustomDistribution;
    sampleDescriptionEntriesHaveMultipleCodecs: Record<'false' | 'true', GleanCounter>;
    sampleDescriptionEntriesHaveMultipleCrypto: Record<'false' | 'true', GleanCounter>;
  };

  mfcdm: {
    emePlayback: GleanEventWithExtras<{
      dropped_frames?: string;
      key_system?: string;
      played_time?: string;
      rendered_frames?: string;
      resolution?: string;
      video_codec?: string;
    }>;
    error: GleanEventWithExtras<{
      audio_codec?: string;
      current_state?: string;
      error_name?: string;
      key_system?: string;
      platform_error?: string;
      resolution?: string;
      video_codec?: string;
    }>;
  };

  codecStats: {
    audioPreferredCodec: Record<string, GleanCounter>;
    otherFecSignaled: Record<string, GleanCounter>;
    ulpfecNegotiated: Record<'negotiated' | 'not_negotiated', GleanCounter>;
    videoPreferredCodec: Record<string, GleanCounter>;
  };

  rtcrtpsender: {
    count: GleanDenominator;
    countSetparametersCompat: GleanDenominator;
    usedSendencodings: GleanNumerator;
  };

  rtcrtpsenderSetparameters: {
    failLengthChanged: GleanNumerator;
    failNoEncodings: GleanNumerator;
    failNoGetparameters: GleanNumerator;
    failNoTransactionid: GleanNumerator;
    failOther: GleanNumerator;
    failRidChanged: GleanNumerator;
    failStaleTransactionid: GleanNumerator;
    warnLengthChanged: GleanNumerator;
    warnNoGetparameters: GleanNumerator;
    warnNoTransactionid: GleanNumerator;
  };

  webrtc: {
    audioQualityInboundBandwidthKbits: GleanCustomDistribution;
    audioQualityInboundJitter: GleanTimingDistribution;
    audioQualityInboundPacketlossRate: GleanCustomDistribution;
    audioQualityOutboundJitter: GleanTimingDistribution;
    audioQualityOutboundPacketlossRate: GleanCustomDistribution;
    audioQualityOutboundRtt: GleanTimingDistribution;
    avCallDuration: GleanTimingDistribution;
    callCount3: GleanCounter;
    callDuration: GleanTimingDistribution;
    callType: GleanCustomDistribution;
    datachannelNegotiated: Record<'false' | 'true', GleanCounter>;
    getUserMediaType: GleanCustomDistribution;
    gmpInitSuccess: Record<'false' | 'true', GleanCounter>;
    h264Enabled: Record<'false' | 'true', GleanCounter>;
    hardwareH264Enabled: Record<'false' | 'true', GleanCounter>;
    hasH264Hardware: Record<'false' | 'true', GleanCounter>;
    maxAudioReceiveTrack: GleanCustomDistribution;
    maxAudioSendTrack: GleanCustomDistribution;
    maxVideoReceiveTrack: GleanCustomDistribution;
    maxVideoSendTrack: GleanCustomDistribution;
    renegotiations: GleanCustomDistribution;
    softwareH264Enabled: Record<'false' | 'true', GleanCounter>;
    videoDecoderBitrateAvgPerCallKbps: GleanCustomDistribution;
    videoDecoderBitrateStdDevPerCallKbps: GleanCustomDistribution;
    videoDecoderDiscardedPacketsPerCallPpm: GleanCustomDistribution;
    videoDecoderFramerate10xStdDevPerCall: GleanCustomDistribution;
    videoDecoderFramerateAvgPerCall: GleanCustomDistribution;
    videoEncoderBitrateAvgPerCallKbps: GleanCustomDistribution;
    videoEncoderBitrateStdDevPerCallKbps: GleanCustomDistribution;
    videoEncoderFramerate10xStdDevPerCall: GleanCustomDistribution;
    videoEncoderFramerateAvgPerCall: GleanCustomDistribution;
    videoQualityInboundBandwidthKbits: GleanCustomDistribution;
    videoQualityInboundJitter: GleanTimingDistribution;
    videoQualityInboundPacketlossRate: GleanCustomDistribution;
    videoQualityOutboundJitter: GleanTimingDistribution;
    videoQualityOutboundPacketlossRate: GleanCustomDistribution;
    videoQualityOutboundRtt: GleanTimingDistribution;
  };

  webrtcSignaling: {
    audioMsectionNegotiated: GleanEventWithExtras<{
      codecs?: string;
      direction?: string;
      has_rtcp_mux?: string;
      pc_id?: string;
      pc_negotiation_count?: string;
      preferred_recv_codec?: string;
      preferred_send_codec?: string;
    }>;
    sdpNegotiated: GleanEventWithExtras<{
      bundle_policy?: string;
      ice_transport_policy?: string;
      is_remote_ice_lite?: string;
      negotiation_count?: string;
      num_msections_audio_recvonly?: string;
      num_msections_audio_sendonly?: string;
      num_msections_audio_sendrecv?: string;
      num_msections_data?: string;
      num_msections_video_recvonly?: string;
      num_msections_video_sendonly?: string;
      num_msections_video_sendrecv?: string;
      num_transports?: string;
      pc_id?: string;
    }>;
    videoMsectionNegotiated: GleanEventWithExtras<{
      codecs?: string;
      direction?: string;
      has_rtcp_mux?: string;
      num_send_simulcast_layers?: string;
      pc_id?: string;
      pc_negotiation_count?: string;
      preferred_recv_codec?: string;
      preferred_send_codec?: string;
    }>;
  };

  webrtcVideo: {
    recvCodecUsed: Record<string, GleanCounter>;
    sendCodecUsed: Record<string, GleanCounter>;
  };

  webrtcdtls: {
    cipher: Record<string, GleanCounter>;
    clientHandshakeResult: Record<string, GleanCounter>;
    clientHandshakeStartedCounter: GleanCounter;
    keyExchangeAlgorithm: GleanCustomDistribution;
    protocolVersion: Record<string, GleanCounter>;
    serverHandshakeResult: Record<string, GleanCounter>;
    serverHandshakeStartedCounter: GleanCounter;
    srtpCipher: Record<string, GleanCounter>;
  };

  dom: {
    blinkFilesystemUsed: Record<'false' | 'true', GleanCounter>;
    forgetSkippableDuringIdle: GleanCustomDistribution;
    forgetSkippableFrequency: GleanCustomDistribution;
    fullscreenTransitionBlack: GleanTimingDistribution;
    gcInProgress: GleanTimingDistribution;
    gcSliceDuringIdle: GleanCustomDistribution;
    scriptLoadingSource: Record<'AltData' | 'Inline' | 'Source' | 'SourceFallback', GleanCounter>;
    slowScriptNoticeCount: GleanCounter;
    slowScriptPageCount: GleanCounter;
    storageAccessApiUi: Record<
      'Allow' | 'AllowAutomatically' | 'AllowOnAnySite' | 'Deny' | 'Request',
      GleanCounter
    >;
    webkitDirectoryUsed: Record<'false' | 'true', GleanCounter>;
    xmlhttprequestAsyncOrSync: Record<'false' | 'true', GleanCounter>;
  };

  domContentprocess: {
    buildIdMismatch: GleanCounter;
    buildIdMismatchFalsePositive: GleanCounter;
    launchIsSync: Record<'false' | 'true', GleanCounter>;
    launchMainthread: GleanTimingDistribution;
    launchTotal: GleanTimingDistribution;
    osPriorityChangeConsidered: GleanCounter;
    osPriorityLowered: GleanCounter;
    osPriorityRaised: GleanCounter;
    syncLaunch: GleanTimingDistribution;
  };

  domParentprocess: {
    privateWindowUsed: GleanBoolean;
    processLaunchErrors: Record<string, GleanCounter>;
  };

  domTextfragment: {
    createDirective: GleanTimingDistribution;
    findDirectives: GleanTimingDistribution;
  };

  perf: {
    coldApplinkMainToLoadUri: GleanTimingDistribution;
    coldApplinkProcessLaunchToLoadUri: GleanTimingDistribution;
    dnsFirstByte: Record<string, GleanTimingDistribution>;
    dnsFirstContentfulPaint: Record<string, GleanTimingDistribution>;
    h3pFirstContentfulPaint: Record<string, GleanTimingDistribution>;
    h3pPageLoadTime: Record<string, GleanTimingDistribution>;
    http3FirstContentfulPaint: Record<string, GleanTimingDistribution>;
    http3PageLoadTime: Record<string, GleanTimingDistribution>;
    jsExecAsmJs: GleanTimingDistribution;
    largestContentfulPaint: GleanTimingDistribution;
    largestContentfulPaintFromResponseStart: GleanTimingDistribution;
    pageLoad: GleanEventWithExtras<{
      android_app_link_launch_type?: string;
      android_app_link_to_navigation_start?: string;
      cache_disposition?: string;
      delazify_time?: string;
      dns_lookup_time?: string;
      document_features?: string;
      fcp_time?: string;
      has_ssd?: string;
      http_ver?: string;
      js_exec_time?: string;
      lcp_time?: string;
      load_time?: string;
      load_type?: string;
      network_type?: string;
      redirect_count?: string;
      redirect_time?: string;
      response_time?: string;
      same_origin_nav?: string;
      time_to_request_start?: string;
      tls_handshake_time?: string;
      trr_domain?: string;
      user_features?: string;
      using_webdriver?: string;
    }>;
    pageLoadDomain: GleanEventWithExtras<{
      document_features?: string;
      domain?: string;
      http_ver?: string;
      lcp_time?: string;
      load_type?: string;
      same_origin_nav?: string;
    }>;
  };

  performancePageload: {
    fcp: GleanTimingDistribution;
    fcpResponsestart: GleanTimingDistribution;
    h3pFcpWithPriority: GleanTimingDistribution;
    http3FcpHttp3: GleanTimingDistribution;
    http3FcpSupportsHttp3: GleanTimingDistribution;
    http3FcpWithoutPriority: GleanTimingDistribution;
    loadTime: GleanTimingDistribution;
    loadTimeResponsestart: GleanTimingDistribution;
  };

  performanceTime: {
    domComplete: GleanTimingDistribution;
    domContentLoadedEnd: GleanTimingDistribution;
    domContentLoadedStart: GleanTimingDistribution;
    domInteractive: GleanTimingDistribution;
    loadEventEnd: GleanTimingDistribution;
    loadEventStart: GleanTimingDistribution;
    toDomLoading: GleanTimingDistribution;
    toFirstContentfulPaint: GleanTimingDistribution;
    responseStart: GleanTimingDistribution;
  };

  webNotification: {
    iconUrlEncoding: Record<
      'document_charset' | 'either_way' | 'neither_way' | 'utf8',
      GleanCounter
    >;
    insecureContextPermissionRequest: GleanCounter;
    permissionOrigin: Record<'first_party' | 'nested_first_party' | 'third_party', GleanCounter>;
    requestPermissionOrigin: Record<
      'first_party' | 'nested_first_party' | 'third_party',
      GleanCounter
    >;
    showOrigin: Record<'first_party' | 'nested_first_party' | 'third_party', GleanCounter>;
  };

  screenwakelock: {
    heldDuration: GleanTimingDistribution;
    releaseBatteryLevelDischarging: GleanCustomDistribution;
  };

  webPush: {
    apiNotify: GleanCounter;
    contentEncoding: Record<'aes128gcm' | 'aesgcm', GleanCounter>;
    detectedDuplicatedMessageIds: GleanCounter;
    errorCode: Record<
      | 'decryption_error'
      | 'internal_error'
      | 'not_delivered'
      | 'uncaught_exception'
      | 'unhandled_rejection',
      GleanCounter
    >;
    unsubscribedByClearingData: GleanCounter;
  };

  domQuota: {
    firstInitializationAttempt: GleanDualLabeledCounter;
    infoLoadTime: Record<string, GleanTimingDistribution>;
    shutdownTime: Record<string, GleanTimingDistribution>;
  };

  domQuotaTry: {
    errorStep: GleanEventWithExtras<{
      context?: string;
      frame_id?: string;
      process_id?: string;
      result?: string;
      seq?: string;
      severity?: string;
      source_file?: string;
      source_line?: string;
      stack_id?: string;
    }>;
  };

  quotamanager: {
    restoreOriginDirectoryMetadataCounter: GleanCounter;
  };

  quotamanagerInitializeRepository: {
    numberOfIterations: Record<
      'default' | 'persistent' | 'private' | 'temporary',
      GleanCustomDistribution
    >;
  };

  quotamanagerInitializeTemporarystorage: {
    nonPersistedZeroUsageOrigins: GleanCustomDistribution;
    totalTimeExcludingSuspend: GleanTimingDistribution;
  };

  quotamanagerShutdown: {
    totalTimeExcludingSuspend: GleanTimingDistribution;
  };

  httpsfirst: {
    downgradeTime: GleanTimingDistribution;
    downgradeTimeSchemeless: GleanTimingDistribution;
    downgraded: GleanDenominator;
    downgradedOnTimer: GleanNumerator;
    downgradedOnTimerSchemeless: GleanNumerator;
    downgradedSchemeless: GleanDenominator;
    upgraded: GleanCounter;
    upgradedSchemeless: GleanCounter;
  };

  mixedContent: {
    audio: Record<
      'AudioNoUpFailure' | 'AudioNoUpSuccess' | 'AudioUpFailure' | 'AudioUpSuccess',
      GleanCounter
    >;
    hsts: GleanCustomDistribution;
    images: Record<
      'ImgNoUpFailure' | 'ImgNoUpSuccess' | 'ImgUpFailure' | 'ImgUpSuccess',
      GleanCounter
    >;
    pageLoad: GleanCustomDistribution;
    unblockCounter: GleanCustomDistribution;
    video: Record<
      'VideoNoUpFailure' | 'VideoNoUpSuccess' | 'VideoUpFailure' | 'VideoUpSuccess',
      GleanCounter
    >;
  };

  securityUi: {
    events: GleanCustomDistribution;
  };

  unexpectedScriptLoad: {
    dialogDismissed: GleanEventNoExtras;
    infobarDismissed: GleanEventNoExtras;
    infobarShown: GleanEventNoExtras;
    moreInfoOpened: GleanEventNoExtras;
    scriptAllowed: GleanEventNoExtras;
    scriptAllowedOpened: GleanEventNoExtras;
    scriptBlocked: GleanEventNoExtras;
    scriptBlockedOpened: GleanEventNoExtras;
    scriptReported: GleanEventWithExtras<{ script_url?: string; user_email?: string }>;
  };

  serviceWorker: {
    fetchEventChannelReset: Record<string, GleanTimingDistribution>;
    fetchEventDispatch: Record<string, GleanTimingDistribution>;
    fetchEventFinishSynthesizedResponse: Record<string, GleanTimingDistribution>;
    fetchInterceptionDuration: Record<string, GleanTimingDistribution>;
    isolatedLaunchTime: GleanTimingDistribution;
    launchTime: GleanTimingDistribution;
    registrationLoading: GleanTimingDistribution;
    running: Record<'All' | 'Fetch', GleanCustomDistribution>;
  };

  localdomstorage: {
    preloadPendingOnFirstAccess: Record<'false' | 'true', GleanCounter>;
    shutdownDatabase: GleanTimingDistribution;
  };

  webauthnCreate: {
    authenticatorAttachment: Record<'cross-platform' | 'platform' | 'unknown', GleanCounter>;
    failure: GleanCounter;
    passkey: GleanCounter;
    success: GleanCounter;
  };

  webauthnGet: {
    authenticatorAttachment: Record<'cross-platform' | 'platform' | 'unknown', GleanCounter>;
    failure: GleanCounter;
    success: GleanCounter;
  };

  workers: {
    dedicatedWorkerSpawnGetsQueued: GleanCounter;
    serviceWorkerSpawnGetsQueued: GleanCounter;
    sharedWorkerSpawnGetsQueued: GleanCounter;
    syncWorkerOperation: Record<string, GleanTimingDistribution>;
  };

  htmleditors: {
    overriddenByBeforeinputListeners: Record<'false' | 'true', GleanCounter>;
    withBeforeinputListeners: Record<'false' | 'true', GleanCounter>;
    withMutationObserversWithoutBeforeinputListeners: Record<'false' | 'true', GleanCounter>;
  };

  permissions: {
    defectiveSqlRemoved: GleanCounter;
    sqlCorrupted: GleanCounter;
  };

  apzZoom: {
    activity: Record<'false' | 'true', GleanCounter>;
    pinchsource: GleanCustomDistribution;
  };

  fontlist: {
    badFallbackFont: Record<'false' | 'true', GleanCounter>;
    bundledfontsActivate: GleanTimingDistribution;
    dwritefontDelayedinitCollect: GleanTimingDistribution;
    dwritefontDelayedinitCount: GleanCustomDistribution;
    dwritefontDelayedinitTotal: GleanTimingDistribution;
    dwritefontInitProblem: GleanCustomDistribution;
    fontCacheHit: Record<'false' | 'true', GleanCounter>;
    initfacenamelists: GleanTimingDistribution;
    initotherfamilynames: GleanTimingDistribution;
    initotherfamilynamesNoDeferring: GleanTimingDistribution;
    macInitTotal: GleanTimingDistribution;
    systemFontFallback: GleanTimingDistribution;
    systemFontFallbackFirst: GleanTimingDistribution;
  };

  gfx: {
    compositeFrameRoundtripTime: GleanTimingDistribution;
    compositeSwapTime: GleanCustomDistribution;
    compositeTime: GleanTimingDistribution;
    contentFailedToAcquireDevice: GleanCustomDistribution;
    crash: GleanCustomDistribution;
    deviceResetReason: GleanCustomDistribution;
    forcedDeviceResetReason: GleanCustomDistribution;
    graphicsDriverStartupTest: GleanCustomDistribution;
    linuxWindowProtocol: GleanString;
    macosVideoLowPower: Record<
      | 'FailBacking'
      | 'FailEnqueue'
      | 'FailMacOSVersion'
      | 'FailMultipleVideo'
      | 'FailOverlaid'
      | 'FailPref'
      | 'FailSurface'
      | 'FailWindowed'
      | 'LowPower'
      | 'NotVideo',
      GleanCounter
    >;
    osCompositor: GleanBoolean;
    sanityTest: GleanCustomDistribution;
    scrollPresentLatency: GleanTimingDistribution;
    skippedComposites: GleanCounter;
    supportsHdr: GleanBoolean;
    adapters: GleanObject;
    contentBackend: GleanString;
    d2dEnabled: GleanBoolean;
    dwriteEnabled: GleanBoolean;
    headless: GleanBoolean;
    monitors: GleanObject;
    targetFrameRate: GleanQuantity;
    textScaleFactor: GleanString;
  };

  gfxAdapterPrimary: {
    description: GleanString;
    deviceId: GleanString;
    driverDate: GleanString;
    driverFiles: GleanString;
    driverVendor: GleanString;
    driverVersion: GleanString;
    ram: GleanQuantity;
    subsystemId: GleanString;
    vendorId: GleanString;
  };

  gfxCheckerboard: {
    duration: GleanTimingDistribution;
    peakPixelCount: GleanCustomDistribution;
    potentialDuration: GleanTimingDistribution;
    severity: GleanCustomDistribution;
  };

  gfxContent: {
    fullPaintTime: GleanTimingDistribution;
    largePaintPhaseWeightFull: Record<'dl' | 'fb' | 'sb' | 'wrdl', GleanCustomDistribution>;
    largePaintPhaseWeightPartial: Record<'dl' | 'fb' | 'sb' | 'wrdl', GleanCustomDistribution>;
    paintTime: GleanTimingDistribution;
    smallPaintPhaseWeightFull: Record<'dl' | 'fb' | 'sb' | 'wrdl', GleanCustomDistribution>;
    smallPaintPhaseWeightPartial: Record<'dl' | 'fb' | 'sb' | 'wrdl', GleanCustomDistribution>;
  };

  gfxContentFrameTime: {
    fromPaint: GleanCustomDistribution;
    fromVsync: GleanCustomDistribution;
    reason: Record<
      | 'missed_composite'
      | 'missed_composite_long'
      | 'missed_composite_low'
      | 'missed_composite_mid'
      | 'no_vsync'
      | 'no_vsync_no_id'
      | 'on_time'
      | 'slow_composite',
      GleanCounter
    >;
    withSvg: GleanCustomDistribution;
    withoutResourceUpload: GleanCustomDistribution;
    withoutUpload: GleanCustomDistribution;
  };

  gfxDisplay: {
    count: GleanQuantity;
    primaryHeight: GleanQuantity;
    primaryWidth: GleanQuantity;
    scaling: GleanCustomDistribution;
  };

  gfxFeature: {
    webrender: GleanString;
  };

  gfxHdr: {
    windowsDisplayColorspaceBitfield: GleanQuantity;
  };

  gfxStatus: {
    compositor: GleanString;
    headless: GleanBoolean;
    lastCompositorGeckoVersion: GleanString;
  };

  gpuProcess: {
    crashFallbacks: Record<'decoding_disabled' | 'disabled' | 'none', GleanCounter>;
    featureStatus: GleanString;
    initializationTime: GleanTimingDistribution;
    launchTime: GleanTimingDistribution;
    totalLaunchAttempts: GleanQuantity;
    unstableLaunchAttempts: GleanQuantity;
  };

  paint: {
    buildDisplaylistTime: GleanTimingDistribution;
  };

  webfont: {
    compressionWoff: GleanCustomDistribution;
    compressionWoff2: GleanCustomDistribution;
    downloadTime: GleanTimingDistribution;
    fonttype: GleanCustomDistribution;
    perPage: GleanCounter;
    size: GleanMemoryDistribution;
    sizePerPage: GleanMemoryDistribution;
    srctype: GleanCustomDistribution;
  };

  wr: {
    framebuildTime: GleanTimingDistribution;
    gpuWaitTime: GleanTimingDistribution;
    rasterizeBlobsTime: GleanTimingDistribution;
    rasterizeGlyphsTime: GleanTimingDistribution;
    rendererTime: GleanTimingDistribution;
    rendererTimeNoSc: GleanTimingDistribution;
    scenebuildTime: GleanTimingDistribution;
    sceneswapTime: GleanTimingDistribution;
    shaderloadTime: GleanTimingDistribution;
    textureCacheUpdateTime: GleanTimingDistribution;
    timeToFrameBuild: GleanTimingDistribution;
    timeToRenderStart: GleanTimingDistribution;
  };

  avif: {
    a1lx: Record<'absent' | 'present', GleanCounter>;
    a1op: Record<'absent' | 'present', GleanCounter>;
    alpha: Record<'absent' | 'present', GleanCounter>;
    aomDecodeError: Record<
      | 'abi_mismatch'
      | 'corrupt_frame'
      | 'error'
      | 'incapable'
      | 'invalid_param'
      | 'mem_error'
      | 'unsup_bitstream'
      | 'unsup_feature',
      GleanCounter
    >;
    bitDepth: Record<'color_10' | 'color_12' | 'color_16' | 'color_8' | 'unknown', GleanCounter>;
    cicpCp: Record<
      | 'bt2020'
      | 'bt470bg'
      | 'bt470m'
      | 'bt601'
      | 'bt709'
      | 'ebu3213'
      | 'generic_film'
      | 'reserved'
      | 'reserved_13'
      | 'reserved_14'
      | 'reserved_15'
      | 'reserved_16'
      | 'reserved_17'
      | 'reserved_18'
      | 'reserved_19'
      | 'reserved_20'
      | 'reserved_21'
      | 'reserved_3'
      | 'reserved_rest'
      | 'smpte240'
      | 'smpte431'
      | 'smpte432'
      | 'unspecified'
      | 'xyz',
      GleanCounter
    >;
    cicpMc: Record<
      | 'bt2020_cl'
      | 'bt2020_ncl'
      | 'bt470bg'
      | 'bt601'
      | 'bt709'
      | 'chromat_cl'
      | 'chromat_ncl'
      | 'fcc'
      | 'ictcp'
      | 'identity'
      | 'reserved'
      | 'reserved_rest'
      | 'smpte2085'
      | 'smpte240'
      | 'unspecified'
      | 'ycgco',
      GleanCounter
    >;
    cicpTc: Record<
      | 'bt2020_10bit'
      | 'bt2020_12bit'
      | 'bt470bg'
      | 'bt470m'
      | 'bt601'
      | 'bt709'
      | 'bt_1361'
      | 'hlg'
      | 'iec61966'
      | 'linear'
      | 'log_100'
      | 'log_100_sqrt10'
      | 'reserved'
      | 'reserved_3'
      | 'reserved_rest'
      | 'smpte2084'
      | 'smpte240'
      | 'smpte428'
      | 'srgb'
      | 'unspecified',
      GleanCounter
    >;
    clap: Record<'absent' | 'present', GleanCounter>;
    colr: Record<'absent' | 'both' | 'icc' | 'nclx', GleanCounter>;
    dav1dGetPictureReturnValue: GleanEventWithExtras<{ value?: string }>;
    decodeResult: Record<
      | 'ConvertYCbCr_failure'
      | 'a1lx_essential'
      | 'a1op_no_essential'
      | 'alpha_y_bpc_mismatch'
      | 'alpha_y_sz_mismatch'
      | 'construction_method'
      | 'decode_error'
      | 'frame_size_changed'
      | 'ftyp_not_first'
      | 'image_item_type'
      | 'invalid_cicp'
      | 'invalid_parse_status'
      | 'ispe_mismatch'
      | 'item_loc_not_found'
      | 'item_type_missing'
      | 'lsel_no_essential'
      | 'missing_brand'
      | 'multiple_moov'
      | 'no_image'
      | 'no_item_data_box'
      | 'no_moov'
      | 'no_primary_item'
      | 'no_samples'
      | 'out_of_memory'
      | 'parse_error'
      | 'pipe_init_error'
      | 'render_size_mismatch'
      | 'size_overflow'
      | 'success'
      | 'txform_no_essential'
      | 'uncategorized'
      | 'write_buffer_error',
      GleanCounter
    >;
    decoder: Record<'aom' | 'dav1d', GleanCounter>;
    grid: Record<'absent' | 'present', GleanCounter>;
    ipro: Record<'absent' | 'present', GleanCounter>;
    ispe: Record<'absent' | 'bitstream_mismatch' | 'valid', GleanCounter>;
    lsel: Record<'absent' | 'present', GleanCounter>;
    majorBrand: Record<'avif' | 'avis' | 'other', GleanCounter>;
    pasp: Record<'absent' | 'invalid' | 'nonsquare' | 'square', GleanCounter>;
    pixi: Record<'absent' | 'bitstream_mismatch' | 'valid', GleanCounter>;
    sequence: Record<'absent' | 'present', GleanCounter>;
    yuvColorSpace: Record<'bt2020' | 'bt601' | 'bt709' | 'identity' | 'unknown', GleanCounter>;
  };

  imageDecode: {
    chunks: GleanCustomDistribution;
    count: GleanCustomDistribution;
    onDrawLatency: GleanTimingDistribution;
    speedAvif: GleanMemoryDistribution;
    speedGif: GleanMemoryDistribution;
    speedJpeg: GleanMemoryDistribution;
    speedPng: GleanMemoryDistribution;
    speedWebp: GleanMemoryDistribution;
    time: GleanTimingDistribution;
  };

  intl: {
    acceptLanguages: GleanStringList;
    appLocales: GleanStringList;
    availableLocales: GleanStringList;
    regionalPrefsLocales: GleanStringList;
    requestedLocales: GleanStringList;
    systemLocales: GleanStringList;
  };

  ipc: {
    transactionCancel: Record<'false' | 'true', GleanCounter>;
  };

  process: {
    childLaunch: GleanTimingDistribution;
  };

  subprocess: {
    abnormalAbort: Record<string, GleanCounter>;
    crashesWithDump: Record<string, GleanCounter>;
    killHard: Record<string, GleanCounter>;
    launchFailure: Record<string, GleanCounter>;
  };

  javascriptGc: {
    animation: GleanTimingDistribution;
    budget: GleanTimingDistribution;
    budgetOverrun: GleanTimingDistribution;
    budgetWasIncreased: Record<'false' | 'true', GleanCounter>;
    compactTime: GleanTimingDistribution;
    effectiveness: GleanCustomDistribution;
    isZoneGc: Record<'false' | 'true', GleanCounter>;
    markGray: GleanTimingDistribution;
    markRate: GleanCustomDistribution;
    markRootsTime: GleanTimingDistribution;
    markTime: GleanTimingDistribution;
    markWeak: GleanTimingDistribution;
    maxPause: GleanTimingDistribution;
    minorReason: Record<
      | 'ABORT_GC'
      | 'ALLOC_TRIGGER'
      | 'API'
      | 'BG_TASK_FINISHED'
      | 'CC_FINISHED'
      | 'CC_FORCED'
      | 'COMPARTMENT_REVIVED'
      | 'COMPONENT_UTILS'
      | 'DEBUG_GC'
      | 'DESTROY_RUNTIME'
      | 'DISABLE_GENERATIONAL_GC'
      | 'DOCSHELL'
      | 'DOM_IPC'
      | 'DOM_TESTUTILS'
      | 'DOM_UTILS'
      | 'DOM_WINDOW_UTILS'
      | 'DOM_WORKER'
      | 'EAGER_ALLOC_TRIGGER'
      | 'EAGER_NURSERY_COLLECTION'
      | 'EVICT_NURSERY'
      | 'FINISH_GC'
      | 'FULL_CELL_PTR_BIGINT_BUFFER'
      | 'FULL_CELL_PTR_GETTER_SETTER_BUFFER'
      | 'FULL_CELL_PTR_OBJ_BUFFER'
      | 'FULL_CELL_PTR_STR_BUFFER'
      | 'FULL_GC_TIMER'
      | 'FULL_GENERIC_BUFFER'
      | 'FULL_SHAPE_BUFFER'
      | 'FULL_SLOT_BUFFER'
      | 'FULL_VALUE_BUFFER'
      | 'FULL_WASM_ANYREF_BUFFER'
      | 'FULL_WHOLE_CELL_BUFFER'
      | 'HTML_PARSER'
      | 'INTER_SLICE_GC'
      | 'LAST_DITCH'
      | 'LOAD_END'
      | 'MEM_PRESSURE'
      | 'NSJSCONTEXT_DESTROY'
      | 'NURSERY_MALLOC_BUFFERS'
      | 'NURSERY_TRAILERS'
      | 'OUT_OF_NURSERY'
      | 'PAGE_HIDE'
      | 'PREPARE_FOR_PAGELOAD'
      | 'PREPARE_FOR_TRACING'
      | 'RESET'
      | 'ROOTS_REMOVED'
      | 'SET_DOC_SHELL'
      | 'SHARED_MEMORY_LIMIT'
      | 'SHUTDOWN_CC'
      | 'TOO_MUCH_JIT_CODE'
      | 'TOO_MUCH_MALLOC'
      | 'TOO_MUCH_WASM_MEMORY'
      | 'UNUSED1'
      | 'UNUSED2'
      | 'UNUSED3'
      | 'USER_INACTIVE'
      | 'WORKER_SHUTDOWN'
      | 'XPCONNECT_SHUTDOWN',
      GleanCounter
    >;
    minorReasonLong: Record<
      | 'ABORT_GC'
      | 'ALLOC_TRIGGER'
      | 'API'
      | 'BG_TASK_FINISHED'
      | 'CC_FINISHED'
      | 'CC_FORCED'
      | 'COMPARTMENT_REVIVED'
      | 'COMPONENT_UTILS'
      | 'DEBUG_GC'
      | 'DESTROY_RUNTIME'
      | 'DISABLE_GENERATIONAL_GC'
      | 'DOCSHELL'
      | 'DOM_IPC'
      | 'DOM_TESTUTILS'
      | 'DOM_UTILS'
      | 'DOM_WINDOW_UTILS'
      | 'DOM_WORKER'
      | 'EAGER_ALLOC_TRIGGER'
      | 'EAGER_NURSERY_COLLECTION'
      | 'EVICT_NURSERY'
      | 'FINISH_GC'
      | 'FULL_CELL_PTR_BIGINT_BUFFER'
      | 'FULL_CELL_PTR_GETTER_SETTER_BUFFER'
      | 'FULL_CELL_PTR_OBJ_BUFFER'
      | 'FULL_CELL_PTR_STR_BUFFER'
      | 'FULL_GC_TIMER'
      | 'FULL_GENERIC_BUFFER'
      | 'FULL_SHAPE_BUFFER'
      | 'FULL_SLOT_BUFFER'
      | 'FULL_VALUE_BUFFER'
      | 'FULL_WASM_ANYREF_BUFFER'
      | 'FULL_WHOLE_CELL_BUFFER'
      | 'HTML_PARSER'
      | 'INTER_SLICE_GC'
      | 'LAST_DITCH'
      | 'LOAD_END'
      | 'MEM_PRESSURE'
      | 'NSJSCONTEXT_DESTROY'
      | 'NURSERY_MALLOC_BUFFERS'
      | 'NURSERY_TRAILERS'
      | 'OUT_OF_NURSERY'
      | 'PAGE_HIDE'
      | 'PREPARE_FOR_PAGELOAD'
      | 'PREPARE_FOR_TRACING'
      | 'RESET'
      | 'ROOTS_REMOVED'
      | 'SET_DOC_SHELL'
      | 'SHARED_MEMORY_LIMIT'
      | 'SHUTDOWN_CC'
      | 'TOO_MUCH_JIT_CODE'
      | 'TOO_MUCH_MALLOC'
      | 'TOO_MUCH_WASM_MEMORY'
      | 'UNUSED1'
      | 'UNUSED2'
      | 'UNUSED3'
      | 'USER_INACTIVE'
      | 'WORKER_SHUTDOWN'
      | 'XPCONNECT_SHUTDOWN',
      GleanCounter
    >;
    minorTime: GleanTimingDistribution;
    mmu50: GleanCustomDistribution;
    nonIncremental: Record<'false' | 'true', GleanCounter>;
    nonIncrementalReason: Record<
      | 'AbortRequested'
      | 'CompartmentRevived'
      | 'GCBytesTrigger'
      | 'GrayRootBufferingFailed'
      | 'IncrementalDisabled'
      | 'JitCodeBytesTrigger'
      | 'MallocBytesTrigger'
      | 'ModeChange'
      | 'NonIncrementalRequested'
      | 'None'
      | 'Unused1'
      | 'ZoneChange',
      GleanCounter
    >;
    nurseryBytes: GleanMemoryDistribution;
    nurseryPromotionRate: GleanCustomDistribution;
    parallelMarkInterruptions: GleanCustomDistribution;
    parallelMarkSpeedup: GleanCustomDistribution;
    parallelMarkUsed: Record<'false' | 'true', GleanCounter>;
    parallelMarkUtilization: GleanCustomDistribution;
    prepareTime: GleanTimingDistribution;
    pretenureCount: GleanCustomDistribution;
    reason: Record<
      | 'ABORT_GC'
      | 'ALLOC_TRIGGER'
      | 'API'
      | 'BG_TASK_FINISHED'
      | 'CC_FINISHED'
      | 'CC_FORCED'
      | 'COMPARTMENT_REVIVED'
      | 'COMPONENT_UTILS'
      | 'DEBUG_GC'
      | 'DESTROY_RUNTIME'
      | 'DISABLE_GENERATIONAL_GC'
      | 'DOCSHELL'
      | 'DOM_IPC'
      | 'DOM_TESTUTILS'
      | 'DOM_UTILS'
      | 'DOM_WINDOW_UTILS'
      | 'DOM_WORKER'
      | 'EAGER_ALLOC_TRIGGER'
      | 'EAGER_NURSERY_COLLECTION'
      | 'EVICT_NURSERY'
      | 'FINISH_GC'
      | 'FULL_CELL_PTR_BIGINT_BUFFER'
      | 'FULL_CELL_PTR_GETTER_SETTER_BUFFER'
      | 'FULL_CELL_PTR_OBJ_BUFFER'
      | 'FULL_CELL_PTR_STR_BUFFER'
      | 'FULL_GC_TIMER'
      | 'FULL_GENERIC_BUFFER'
      | 'FULL_SHAPE_BUFFER'
      | 'FULL_SLOT_BUFFER'
      | 'FULL_VALUE_BUFFER'
      | 'FULL_WASM_ANYREF_BUFFER'
      | 'FULL_WHOLE_CELL_BUFFER'
      | 'HTML_PARSER'
      | 'INTER_SLICE_GC'
      | 'LAST_DITCH'
      | 'LOAD_END'
      | 'MEM_PRESSURE'
      | 'NSJSCONTEXT_DESTROY'
      | 'NURSERY_MALLOC_BUFFERS'
      | 'NURSERY_TRAILERS'
      | 'OUT_OF_NURSERY'
      | 'PAGE_HIDE'
      | 'PREPARE_FOR_PAGELOAD'
      | 'PREPARE_FOR_TRACING'
      | 'RESET'
      | 'ROOTS_REMOVED'
      | 'SET_DOC_SHELL'
      | 'SHARED_MEMORY_LIMIT'
      | 'SHUTDOWN_CC'
      | 'TOO_MUCH_JIT_CODE'
      | 'TOO_MUCH_MALLOC'
      | 'TOO_MUCH_WASM_MEMORY'
      | 'UNUSED1'
      | 'UNUSED2'
      | 'UNUSED3'
      | 'USER_INACTIVE'
      | 'WORKER_SHUTDOWN'
      | 'XPCONNECT_SHUTDOWN',
      GleanCounter
    >;
    reset: Record<'false' | 'true', GleanCounter>;
    resetReason: Record<
      | 'AbortRequested'
      | 'CompartmentRevived'
      | 'GCBytesTrigger'
      | 'GrayRootBufferingFailed'
      | 'IncrementalDisabled'
      | 'JitCodeBytesTrigger'
      | 'MallocBytesTrigger'
      | 'ModeChange'
      | 'NonIncrementalRequested'
      | 'None'
      | 'Unused1'
      | 'ZoneChange',
      GleanCounter
    >;
    sliceCount: GleanCustomDistribution;
    sliceTime: GleanTimingDistribution;
    sliceWasLong: Record<'false' | 'true', GleanCounter>;
    slowPhase: Record<
      | 'COMPACT'
      | 'COMPACT_MOVE'
      | 'COMPACT_UPDATE'
      | 'COMPACT_UPDATE_CELLS'
      | 'DECOMMIT'
      | 'DESTROY'
      | 'EVICT_NURSERY'
      | 'EVICT_NURSERY_FOR_MAJOR_GC'
      | 'FINALIZE_END'
      | 'FINALIZE_START'
      | 'FIND_DEAD_COMPARTMENTS'
      | 'GC_BEGIN'
      | 'GC_END'
      | 'JOIN_PARALLEL_TASKS'
      | 'MARK'
      | 'MARK_CCWS'
      | 'MARK_DELAYED'
      | 'MARK_DISCARD_CODE'
      | 'MARK_EMBEDDING'
      | 'MARK_GRAY'
      | 'MARK_GRAY_WEAK'
      | 'MARK_INCOMING_GRAY'
      | 'MARK_ROOTS'
      | 'MARK_RUNTIME_DATA'
      | 'MARK_STACK'
      | 'MARK_WEAK'
      | 'MINOR_GC'
      | 'MUTATOR'
      | 'PARALLEL_MARK'
      | 'PARALLEL_MARK_MARK'
      | 'PARALLEL_MARK_OTHER'
      | 'PARALLEL_MARK_WAIT'
      | 'PREPARE'
      | 'PURGE'
      | 'PURGE_PROP_MAP_TABLES'
      | 'PURGE_SOURCE_URLS'
      | 'RELAZIFY_FUNCTIONS'
      | 'SWEEP'
      | 'SWEEP_ATOMS_TABLE'
      | 'SWEEP_BASE_SHAPE'
      | 'SWEEP_CC_WRAPPER'
      | 'SWEEP_COMPARTMENTS'
      | 'SWEEP_COMPRESSION'
      | 'SWEEP_FINALIZATION_OBSERVERS'
      | 'SWEEP_INITIAL_SHAPE'
      | 'SWEEP_INNER_VIEWS'
      | 'SWEEP_JIT_DATA'
      | 'SWEEP_JIT_SCRIPTS'
      | 'SWEEP_MISC'
      | 'SWEEP_PROP_MAP'
      | 'SWEEP_REGEXP'
      | 'SWEEP_UNIQUEIDS'
      | 'SWEEP_WEAKMAPS'
      | 'SWEEP_WEAK_CACHES'
      | 'SWEEP_WEAK_POINTERS'
      | 'TRACE_HEAP'
      | 'UNMARK'
      | 'UNMARK_WEAKMAPS'
      | 'UPDATE_ATOMS_BITMAP'
      | 'WAIT_BACKGROUND_THREAD'
      | 'WEAK_COMPARTMENT_CALLBACK'
      | 'WEAK_ZONES_CALLBACK',
      GleanCounter
    >;
    slowTask: Record<
      | 'COMPACT'
      | 'COMPACT_MOVE'
      | 'COMPACT_UPDATE'
      | 'COMPACT_UPDATE_CELLS'
      | 'DECOMMIT'
      | 'DESTROY'
      | 'EVICT_NURSERY'
      | 'EVICT_NURSERY_FOR_MAJOR_GC'
      | 'FINALIZE_END'
      | 'FINALIZE_START'
      | 'FIND_DEAD_COMPARTMENTS'
      | 'GC_BEGIN'
      | 'GC_END'
      | 'JOIN_PARALLEL_TASKS'
      | 'MARK'
      | 'MARK_CCWS'
      | 'MARK_DELAYED'
      | 'MARK_DISCARD_CODE'
      | 'MARK_EMBEDDING'
      | 'MARK_GRAY'
      | 'MARK_GRAY_WEAK'
      | 'MARK_INCOMING_GRAY'
      | 'MARK_ROOTS'
      | 'MARK_RUNTIME_DATA'
      | 'MARK_STACK'
      | 'MARK_WEAK'
      | 'MINOR_GC'
      | 'MUTATOR'
      | 'PARALLEL_MARK'
      | 'PARALLEL_MARK_MARK'
      | 'PARALLEL_MARK_OTHER'
      | 'PARALLEL_MARK_WAIT'
      | 'PREPARE'
      | 'PURGE'
      | 'PURGE_PROP_MAP_TABLES'
      | 'PURGE_SOURCE_URLS'
      | 'RELAZIFY_FUNCTIONS'
      | 'SWEEP'
      | 'SWEEP_ATOMS_TABLE'
      | 'SWEEP_BASE_SHAPE'
      | 'SWEEP_CC_WRAPPER'
      | 'SWEEP_COMPARTMENTS'
      | 'SWEEP_COMPRESSION'
      | 'SWEEP_FINALIZATION_OBSERVERS'
      | 'SWEEP_INITIAL_SHAPE'
      | 'SWEEP_INNER_VIEWS'
      | 'SWEEP_JIT_DATA'
      | 'SWEEP_JIT_SCRIPTS'
      | 'SWEEP_MISC'
      | 'SWEEP_PROP_MAP'
      | 'SWEEP_REGEXP'
      | 'SWEEP_UNIQUEIDS'
      | 'SWEEP_WEAKMAPS'
      | 'SWEEP_WEAK_CACHES'
      | 'SWEEP_WEAK_POINTERS'
      | 'TRACE_HEAP'
      | 'UNMARK'
      | 'UNMARK_WEAKMAPS'
      | 'UPDATE_ATOMS_BITMAP'
      | 'WAIT_BACKGROUND_THREAD'
      | 'WEAK_COMPARTMENT_CALLBACK'
      | 'WEAK_ZONES_CALLBACK',
      GleanCounter
    >;
    sweepTime: GleanTimingDistribution;
    taskStartDelay: GleanTimingDistribution;
    tenuredSurvivalRate: GleanCustomDistribution;
    timeBetween: GleanTimingDistribution;
    timeBetweenMinor: GleanTimingDistribution;
    timeBetweenSlices: GleanTimingDistribution;
    totalTime: GleanTimingDistribution;
    zoneCount: GleanCustomDistribution;
    zonesCollected: GleanCustomDistribution;
  };

  javascriptIon: {
    compileTime: GleanTimingDistribution;
  };

  scriptPreloader: {
    mainthreadRecompile: GleanCounter;
    requests: Record<'Hit' | 'HitChild' | 'Miss', GleanCounter>;
    waitTime: GleanTimingDistribution;
  };

  slowScriptWarning: {
    notifyDelay: GleanTimingDistribution;
    shownBrowser: GleanEventWithExtras<{ hang_duration?: string; uri_type?: string }>;
    shownContent: GleanEventWithExtras<{
      end_reason?: string;
      hang_duration?: string;
      n_tab_deselect?: string;
      uptime?: string;
      uri_type?: string;
      wait_count?: string;
    }>;
  };

  layout: {
    inputEventQueuedClick: GleanTimingDistribution;
    inputEventQueuedKeyboard: GleanTimingDistribution;
    inputEventResponse: GleanTimingDistribution;
    inputEventResponseCoalesced: GleanTimingDistribution;
    loadInputEventResponse: GleanTimingDistribution;
    longReflowInterruptible: Record<'false' | 'true', GleanCounter>;
    paintRasterizeTime: GleanTimingDistribution;
    refreshDriverChromeFrameDelay: GleanTimingDistribution;
    refreshDriverContentFrameDelay: GleanTimingDistribution;
    refreshDriverTick: GleanTimingDistribution;
    timeToFirstInteraction: GleanTimingDistribution;
  };

  geckoview: {
    documentSiteOrigins: GleanCustomDistribution;
    pageLoadProgressTime: GleanTimingDistribution;
    pageLoadTime: GleanTimingDistribution;
    pageReloadTime: GleanTimingDistribution;
    perDocumentSiteOrigins: GleanCustomDistribution;
  };

  zeroByteLoad: {
    loadCss: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
    loadDtd: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
    loadFtl: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
    loadHtml: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
    loadJs: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
    loadJson: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
    loadOthers: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
    loadPng: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
    loadProperties: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
    loadSvg: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
    loadXhtml: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
    loadXml: GleanEventWithExtras<{
      cancel_reason?: string;
      cancelled?: string;
      file_name?: string;
      status?: string;
      sync?: string;
    }>;
  };

  preferences: {
    prefsFileWasInvalid: GleanBoolean;
    userPrefs: GleanObject;
  };

  network: {
    cacheEntryCount: Record<'SMARTSIZE' | 'USERDEFINEDSIZE', GleanCustomDistribution>;
    cacheEntryCountShare: Record<
      'IMAGE' | 'JAVASCRIPT' | 'MEDIA' | 'OTHER' | 'STYLESHEET' | 'UNKNOWN' | 'WASM',
      GleanCustomDistribution
    >;
    cacheSize: Record<'SMARTSIZE' | 'USERDEFINEDSIZE', GleanMemoryDistribution>;
    cacheSizeShare: Record<
      'IMAGE' | 'JAVASCRIPT' | 'MEDIA' | 'OTHER' | 'STYLESHEET' | 'UNKNOWN' | 'WASM',
      GleanCustomDistribution
    >;
    cacheV2InputStreamStatus: GleanCustomDistribution;
    cacheV2OutputStreamStatus: GleanCustomDistribution;
    diskCache2ShutdownClearPrivate: GleanTimingDistribution;
    diskCacheShutdownV2: GleanTimingDistribution;
    httpCacheEntryAliveTime: GleanTimingDistribution;
    httpCacheEntryReloadTime: GleanTimingDistribution;
    httpCacheEntryReuseCount: GleanCustomDistribution;
    backgroundfilesaverThreadCount: GleanCustomDistribution;
    id: GleanCustomDistribution;
    idOnline: Record<'absent' | 'present', GleanCounter>;
    ipv4AndIpv6AddressConnectivity: GleanCustomDistribution;
    relPreloadMissRatio: Record<
      | 'TYPE_FETCH_UNUSED'
      | 'TYPE_FETCH_USED'
      | 'TYPE_FONT_UNUSED'
      | 'TYPE_FONT_USED'
      | 'TYPE_IMAGE_UNUSED'
      | 'TYPE_IMAGE_USED'
      | 'TYPE_SCRIPT_UNUSED'
      | 'TYPE_SCRIPT_USED'
      | 'TYPE_STYLE_UNUSED'
      | 'TYPE_STYLE_USED',
      GleanCounter
    >;
    alpnMismatchCount: Record<string, GleanCounter>;
    asyncOpenChildToTransactionPendingExp: Record<string, GleanTimingDistribution>;
    backPressureSuspensionCpType: GleanCustomDistribution;
    backPressureSuspensionDelayTime: GleanTimingDistribution;
    backPressureSuspensionRate: Record<
      'NotSuspended' | 'NotSuspendedLocal' | 'Suspended' | 'SuspendedLocal',
      GleanCounter
    >;
    byteRangeRequest: Record<'cacheable' | 'not_cacheable', GleanCounter>;
    cacheHitMissStatPerCacheSize: Record<string, GleanCounter>;
    cacheHitRatePerCacheSize: Record<string, GleanCustomDistribution>;
    cacheHitTime: GleanTimingDistribution;
    cacheMissTime: GleanTimingDistribution;
    cacheReadTime: GleanTimingDistribution;
    completeLoad: GleanTimingDistribution;
    completeLoadCached: GleanTimingDistribution;
    completeLoadNet: GleanTimingDistribution;
    corsAuthorizationHeader: Record<'allowed' | 'covered_by_wildcard' | 'disallowed', GleanCounter>;
    dnsEnd: GleanTimingDistribution;
    dnsEndToConnectStartExp: Record<string, GleanTimingDistribution>;
    dnsStart: GleanTimingDistribution;
    firstFromCache: GleanTimingDistribution;
    firstSentToLastReceived: GleanTimingDistribution;
    fontDownloadEnd: GleanTimingDistribution;
    http3CompleteLoad: Record<
      'supports_http3_page' | 'supports_http3_sub' | 'uses_http3_page' | 'uses_http3_sub',
      GleanTimingDistribution
    >;
    http3FirstSentToLastReceived: Record<
      'supports_http3_page' | 'supports_http3_sub' | 'uses_http3_page' | 'uses_http3_sub',
      GleanTimingDistribution
    >;
    http3OpenToFirstReceived: Record<
      'supports_http3_page' | 'supports_http3_sub' | 'uses_http3_page' | 'uses_http3_sub',
      GleanTimingDistribution
    >;
    http3OpenToFirstSent: Record<
      'supports_http3_page' | 'supports_http3_sub' | 'uses_http3_page' | 'uses_http3_sub',
      GleanTimingDistribution
    >;
    http3TlsHandshake: Record<
      'supports_http3_page' | 'supports_http3_sub' | 'uses_http3_page' | 'uses_http3_sub',
      GleanTimingDistribution
    >;
    httpFetchDuration: Record<
      'h1_cloudflare' | 'h1_others' | 'h2_cloudflare' | 'h2_others' | 'h3_cloudflare' | 'h3_others',
      GleanTimingDistribution
    >;
    httpRevalidation: GleanTimingDistribution;
    openToFirstReceived: GleanTimingDistribution;
    openToFirstSent: GleanTimingDistribution;
    pageLoadSize: Record<'page' | 'subresources', GleanMemoryDistribution>;
    raceCacheBandwidthNotRace: GleanMemoryDistribution;
    raceCacheBandwidthRaceCacheWin: GleanMemoryDistribution;
    raceCacheBandwidthRaceNetworkWin: GleanMemoryDistribution;
    raceCacheValidation: Record<
      'CachedContentNotUsed' | 'CachedContentUsed' | 'NotSent',
      GleanCounter
    >;
    raceCacheWithNetworkOcecOnStartDiff: GleanTimingDistribution;
    raceCacheWithNetworkSavedTime: GleanTimingDistribution;
    responseEndParentToContent: Record<string, GleanTimingDistribution>;
    responseStartParentToContentExp: Record<string, GleanTimingDistribution>;
    retriedSystemChannelAddonStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    retriedSystemChannelAddonversionStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    retriedSystemChannelOtherStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    retriedSystemChannelRemoteSettingsStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    retriedSystemChannelTelemetryStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    retriedSystemChannelUpdateStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    subCacheReadTime: GleanTimingDistribution;
    subCompleteLoad: GleanTimingDistribution;
    subCompleteLoadCached: GleanTimingDistribution;
    subCompleteLoadNet: GleanTimingDistribution;
    subDnsEnd: GleanTimingDistribution;
    subDnsStart: GleanTimingDistribution;
    subFirstFromCache: GleanTimingDistribution;
    subFirstSentToLastReceived: GleanTimingDistribution;
    subHttpRevalidation: GleanTimingDistribution;
    subOpenToFirstReceived: GleanTimingDistribution;
    subOpenToFirstSent: GleanTimingDistribution;
    subTcpConnection: GleanTimingDistribution;
    subTlsHandshake: GleanTimingDistribution;
    supHttp3TcpConnection: Record<
      'supports_http3_page' | 'supports_http3_sub',
      GleanTimingDistribution
    >;
    systemChannelAddonStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    systemChannelAddonversionStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    systemChannelOtherStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    systemChannelRemoteSettingsStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    systemChannelSuccessOrFailure: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    systemChannelTelemetryStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    systemChannelUpdateStatus: Record<
      | 'cancel'
      | 'connect_fail'
      | 'connectivity'
      | 'dns'
      | 'http_status'
      | 'offline'
      | 'ok'
      | 'other'
      | 'partial'
      | 'refused'
      | 'reset'
      | 'timeout'
      | 'tls_fail',
      GleanCounter
    >;
    tcpConnection: GleanTimingDistribution;
    tlsEarlyDataAccepted: Record<'accepted' | 'rejected', GleanCounter>;
    tlsEarlyDataBytesWritten: GleanCustomDistribution;
    tlsEarlyDataNegotiated: Record<
      'available_and_used' | 'available_but_not_used' | 'not_available',
      GleanCounter
    >;
    tlsHandshake: GleanTimingDistribution;
    trrIdleCloseTimeH1: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanTimingDistribution
    >;
    trrIdleCloseTimeH2: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanTimingDistribution
    >;
    trrIdleCloseTimeH3: Record<
      | 'dns.shaw.ca'
      | 'dns.shaw.ca_2'
      | 'dns.shaw.ca_3'
      | 'doh.xfinity.com'
      | 'doh.xfinity.com_2'
      | 'doh.xfinity.com_3'
      | 'dooh.cloudflare-dns.com'
      | 'dooh.cloudflare-dns.com_2'
      | 'dooh.cloudflare-dns.com_3'
      | 'firefox.dns.nextdns.io'
      | 'firefox.dns.nextdns.io_2'
      | 'firefox.dns.nextdns.io_3'
      | 'mozilla.cloudflare-dns.com'
      | 'mozilla.cloudflare-dns.com_2'
      | 'mozilla.cloudflare-dns.com_3'
      | 'private.canadianshield.cira.ca'
      | 'private.canadianshield.cira.ca_2'
      | 'private.canadianshield.cira.ca_3',
      GleanTimingDistribution
    >;
  };

  dns: {
    blocklistCount: GleanCustomDistribution;
    byTypeCleanupAge: GleanTimingDistribution;
    byTypeFailedLookupTime: GleanTimingDistribution;
    byTypePrematureEviction: GleanTimingDistribution;
    byTypeSucceededLookupTime: GleanTimingDistribution;
    cleanupAge: GleanTimingDistribution;
    lookupAlgorithm: Record<
      'nativeOnly' | 'trrFirst' | 'trrOnly' | 'trrRace' | 'trrShadow',
      GleanCounter
    >;
    lookupDisposition: GleanDualLabeledCounter;
    lookupMethod: GleanCustomDistribution;
    nativeLookupTime: GleanTimingDistribution;
    nativeQueuing: GleanTimingDistribution;
    prematureEviction: GleanTimingDistribution;
    trrAttemptCount: Record<string, GleanCustomDistribution>;
    trrBlacklisted: GleanDualLabeledCounter;
    trrDisabled: GleanDualLabeledCounter;
    trrFirst: GleanDualLabeledCounter;
    trrHttpVersion: GleanDualLabeledCounter;
    trrLookupTime: Record<string, GleanTimingDistribution>;
    trrNsVerfified: GleanDualLabeledCounter;
    trrProcessingTime: GleanTimingDistribution;
    trrRelevantSkipReasonNativeFailed: Record<string, GleanCustomDistribution>;
    trrRelevantSkipReasonNativeSuccess: Record<string, GleanCustomDistribution>;
    trrRelevantSkipReasonTrrFirst: Record<string, GleanCustomDistribution>;
    trrRelevantSkipReasonTrrFirstTypeRec: Record<string, GleanCustomDistribution>;
    trrSkipReasonNativeFailed: Record<string, GleanCustomDistribution>;
    trrSkipReasonNativeSuccess: Record<string, GleanCustomDistribution>;
    trrSkipReasonRetryFailed: Record<string, GleanCustomDistribution>;
    trrSkipReasonRetrySuccess: Record<string, GleanCustomDistribution>;
    trrSkipReasonStrictMode: Record<string, GleanCustomDistribution>;
    trrSkipReasonTrrFirst: Record<string, GleanCustomDistribution>;
    trrSuccess: GleanDualLabeledCounter;
  };

  networkCookies: {
    sqliteOpenReadahead: GleanTimingDistribution;
  };

  networkDns: {
    trrConfirmationContext: GleanEventWithExtras<{
      attemptCount?: string;
      captivePortal?: string;
      contextReason?: string;
      failedLookups?: string;
      networkID?: string;
      results?: string;
      time?: string;
      trigger?: string;
      value?: string;
    }>;
  };

  networkSso: {
    entraSuccess: Record<
      | 'both_headers_missing'
      | 'broker_error'
      | 'device_headers_missing'
      | 'invalid_controller_setup'
      | 'invalid_cookie'
      | 'no_credential'
      | 'prt_headers_missing'
      | 'success',
      GleanCounter
    >;
    totalEntraUses: GleanCounter;
  };

  predictor: {
    baseConfidence: GleanCustomDistribution;
    confidence: GleanCustomDistribution;
    globalDegradation: GleanCustomDistribution;
    learnAttempts: GleanCustomDistribution;
    learnWorkTime: GleanTimingDistribution;
    predictTimeToAction: GleanTimingDistribution;
    predictTimeToInaction: GleanTimingDistribution;
    predictWorkTime: GleanTimingDistribution;
    predictionsCalculated: GleanCustomDistribution;
    prefetchDecisionReason: GleanCustomDistribution;
    prefetchIgnoreReason: GleanCustomDistribution;
    prefetchTime: GleanTimingDistribution;
    prefetchUseStatus: Record<
      'Auth' | 'Etag' | 'Expired' | 'Not200' | 'Redirect' | 'Used' | 'WaitedTooLong' | 'WouldVary',
      GleanCounter
    >;
    subresourceDegradation: GleanCustomDistribution;
    totalPreconnects: GleanCustomDistribution;
    totalPredictions: GleanCustomDistribution;
    totalPrefetches: GleanCustomDistribution;
    totalPreresolves: GleanCustomDistribution;
    waitTime: GleanTimingDistribution;
  };

  http: {
    altsvcMappingChangedTarget: Record<'false' | 'true', GleanCounter>;
    cacheDisposition: GleanDualLabeledCounter;
    cacheLmInconsistent: Record<'false' | 'true', GleanCounter>;
    channelDisposition: GleanCustomDistribution;
    channelOnstartSuccess: Record<'false' | 'true', GleanCounter>;
    channelPageOnstartSuccessTrr: Record<string, GleanCustomDistribution>;
    channelSubOnstartSuccessTrr: Record<string, GleanCustomDistribution>;
    connectionCloseReason: Record<string, GleanCustomDistribution>;
    connectionEntryCacheHit: Record<'false' | 'true', GleanCounter>;
    contentEncoding: GleanCustomDistribution;
    dnsHttpssvcConnectionFailedReason: GleanCustomDistribution;
    dnsHttpssvcRecordReceivingStage: GleanCustomDistribution;
    dntUsage: GleanCustomDistribution;
    echconfigSuccessRate: Record<
      'EchConfigFailed' | 'EchConfigSucceeded' | 'NoEchConfigFailed' | 'NoEchConfigSucceeded',
      GleanCounter
    >;
    http2FailBeforeSettings: Record<'false' | 'true', GleanCounter>;
    kbreadPerConn2: GleanMemoryDistribution;
    pageloadIsSsl: Record<'false' | 'true', GleanCounter>;
    requestPerConn: GleanCustomDistribution;
    requestPerPage: GleanCustomDistribution;
    requestPerPageFromCache: GleanCustomDistribution;
    responseVersion: GleanCustomDistribution;
    scriptBlockIncorrectMime: Record<
      | 'CORS_origin'
      | 'app_json'
      | 'app_octet_stream'
      | 'app_xml'
      | 'audio'
      | 'cross_origin'
      | 'empty'
      | 'image'
      | 'importScript_load'
      | 'javaScript'
      | 'same_origin'
      | 'script_load'
      | 'serviceworker_load'
      | 'text_csv'
      | 'text_html'
      | 'text_json'
      | 'text_plain'
      | 'text_xml'
      | 'unknown'
      | 'video'
      | 'worker_load'
      | 'worklet_load',
      GleanCounter
    >;
    subitemFirstByteLatencyTime: GleanTimingDistribution;
    subitemOpenLatencyTime: GleanTimingDistribution;
    tlsEarlyDataAccepted: Record<'false' | 'true', GleanCounter>;
    tlsEarlyDataNegotiated: GleanCustomDistribution;
    trafficAnalysis: GleanDualLabeledCounter;
    transactionEchRetryEchFailedCount: GleanCustomDistribution;
    transactionEchRetryOthersCount: GleanCustomDistribution;
    transactionEchRetryWithEchCount: GleanCustomDistribution;
    transactionEchRetryWithoutEchCount: GleanCustomDistribution;
    transactionIsSsl: Record<'false' | 'true', GleanCounter>;
    transactionRestartReason: GleanCustomDistribution;
    transactionUseAltsvc: Record<'false' | 'true', GleanCounter>;
    transactionWaitTimeHttp: GleanTimingDistribution;
    transactionWaitTimeHttp2SupHttp3: GleanTimingDistribution;
    transactionWaitTimeHttp3: GleanTimingDistribution;
    transactionWaitTimeSpdy: GleanTimingDistribution;
    uploadBandwidthMbps: Record<string, GleanCustomDistribution>;
  };

  http3: {
    blockedByStreamLimitPerConn: GleanCustomDistribution;
    connectionCloseCode: Record<string, GleanCustomDistribution>;
    countsPto: Record<string, GleanCustomDistribution>;
    dropDgrams: GleanCustomDistribution;
    echOutcome: Record<'GREASE' | 'NONE' | 'REAL', GleanCustomDistribution>;
    lateAck: Record<'ack' | 'pto', GleanCustomDistribution>;
    lateAckRatio: Record<'ack' | 'pto', GleanCustomDistribution>;
    lossRatio: GleanCustomDistribution;
    receivedSentDgrams: Record<'received' | 'sent', GleanCustomDistribution>;
    requestPerConn: GleanCustomDistribution;
    savedDgrams: GleanCustomDistribution;
    sendingBlockedByFlowControlPerTrans: GleanCustomDistribution;
    timerDelayed: GleanTimingDistribution;
    transBlockedByStreamLimitPerConn: GleanCustomDistribution;
    transSendingBlockedByFlowControlPerConn: GleanCustomDistribution;
  };

  netwerk: {
    http30rttState: Record<
      'conn_closed_by_necko' | 'conn_error' | 'not_used' | 'rejected' | 'succeeded',
      GleanCounter
    >;
    http30rttStateDuration: Record<
      'conn_closed_by_necko' | 'conn_error' | 'not_used' | 'rejected' | 'succeeded',
      GleanTimingDistribution
    >;
    http3TimeToReuseIdleConnection: Record<'failed' | 'succeeded', GleanTimingDistribution>;
    parentConnectTimeout: GleanCounter;
  };

  opaqueResponseBlocking: {
    crossOriginOpaqueResponseCount: GleanCounter;
    javascriptValidationCount: GleanCounter;
  };

  orb: {
    blockInitiator: Record<
      | 'BEACON'
      | 'BLOCKED_FETCH'
      | 'CSP_REPORT'
      | 'DTD'
      | 'EXCLUDED'
      | 'FILTERED_FETCH'
      | 'FONT'
      | 'IMAGE'
      | 'IMAGESET'
      | 'INVALID'
      | 'JSON'
      | 'MEDIA'
      | 'OTHER'
      | 'PING'
      | 'PROXIED_WEBRTC_MEDIA'
      | 'SCRIPT'
      | 'SPECULATIVE'
      | 'STYLESHEET'
      | 'UA_FONT'
      | 'WEB_MANIFEST'
      | 'WEB_TRANSPORT'
      | 'XMLHTTPREQUEST'
      | 'XSLT',
      GleanCounter
    >;
    blockReason: Record<
      | 'AFTER_SNIFF_CT_FAIL'
      | 'AFTER_SNIFF_MEDIA'
      | 'AFTER_SNIFF_NOSNIFF'
      | 'AFTER_SNIFF_STA_CODE'
      | 'JS_VALIDATION_FAILED'
      | 'MEDIA_INCORRECT_RESP'
      | 'MEDIA_NOT_INITIAL'
      | 'MIME_NEVER_SNIFFED'
      | 'NOSNIFF_BLC_OR_TEXTP'
      | 'RESP_206_BLCLISTED'
      | 'RESP_206_NO_FIRST',
      GleanCounter
    >;
    didEverBlockResponse: Record<'false' | 'true', GleanCounter>;
    javascriptValidation: Record<
      'failure' | 'javascript' | 'json' | 'other',
      GleanTimingDistribution
    >;
    receiveDataForValidation: Record<
      'failure' | 'javascript' | 'json' | 'other',
      GleanTimingDistribution
    >;
  };

  spdy: {
    continuedHeaders: GleanMemoryDistribution;
    goawayLocal: GleanCustomDistribution;
    goawayPeer: GleanCustomDistribution;
    kbreadPerConn: GleanMemoryDistribution;
    parallelStreams: GleanCustomDistribution;
    requestPerConn: GleanCustomDistribution;
    serverInitiatedStreams: GleanCustomDistribution;
    settingsMaxStreams: GleanCustomDistribution;
  };

  websockets: {
    handshakeType: GleanCustomDistribution;
  };

  parsing: {
    svgUnusualPcdata: GleanRate;
  };

  ysod: {
    shownYsod: GleanEventWithExtras<{
      destroyed?: string;
      error_code?: string;
      hidden?: string;
      last_line?: string;
      last_line_len?: string;
      location?: string;
      value?: string;
    }>;
  };

  certSignatureCache: {
    hits: GleanNumerator;
    total: GleanDenominator;
  };

  certTrustCache: {
    hits: GleanNumerator;
    total: GleanDenominator;
  };

  certVerifier: {
    certRevocationMechanisms: Record<
      'CRLite' | 'CachedOCSP' | 'OCSP' | 'OneCRL' | 'ShortValidity' | 'StapledOCSP',
      GleanCounter
    >;
    crliteStatus: Record<
      | 'no_filter'
      | 'not_covered'
      | 'not_enrolled'
      | 'not_revoked'
      | 'revoked_in_filter'
      | 'revoked_in_stash',
      GleanCounter
    >;
    crliteVsOcspResult: Record<
      | 'CRLiteRevOCSPFail'
      | 'CRLiteRevOCSPOk'
      | 'CRLiteRevOCSPRev'
      | 'CRLiteRevOCSPSoft'
      | 'CRLiteRevOCSPUnk',
      GleanCounter
    >;
  };

  sctSignatureCache: {
    hits: GleanNumerator;
    total: GleanDenominator;
  };

  cert: {
    chainKeySizeStatus: GleanCustomDistribution;
    evStatus: GleanCustomDistribution;
    validationHttpRequestResult: GleanCustomDistribution;
    validationSuccessByCa2: GleanCustomDistribution;
  };

  certCompression: {
    failures: Record<'brotli' | 'zlib' | 'zstd', GleanCounter>;
  };

  certPinning: {
    failuresByCa2: GleanCustomDistribution;
    mozResultsByHost: GleanCustomDistribution;
    mozTestResultsByHost: GleanCustomDistribution;
    results: Record<'false' | 'true', GleanCounter>;
    testResults: Record<'false' | 'true', GleanCounter>;
  };

  certStorage: {
    memory: GleanMemoryDistribution;
  };

  certVerificationTime: {
    failure: GleanTimingDistribution;
    success: GleanTimingDistribution;
  };

  dataStorage: {
    alternateServices: GleanQuantity;
    clientAuthRememberList: GleanQuantity;
    siteSecurityServiceState: GleanQuantity;
  };

  ocspRequestTime: {
    cancel: GleanTimingDistribution;
    failure: GleanTimingDistribution;
    success: GleanTimingDistribution;
  };

  oskeystore: {
    returnCodes: GleanEventWithExtras<{ function?: string; result?: string }>;
  };

  pkcs11: {
    externalTrustAnchorModuleLoaded: GleanBoolean;
    thirdPartyModuleProfileEntries: GleanStringList;
    thirdPartyModuleSignatureType: GleanEventWithExtras<{ filename?: string; signature?: string }>;
    thirdPartyModulesLoaded: GleanQuantity;
  };

  ssl: {
    authAlgorithmFull: GleanCustomDistribution;
    authEcdsaCurveFull: GleanCustomDistribution;
    authRsaKeySizeFull: GleanCustomDistribution;
    bytesBeforeCertCallback: GleanMemoryDistribution;
    certErrorOverrides: GleanCustomDistribution;
    certVerificationErrors: GleanCustomDistribution;
    ctPolicyNonCompliantConnectionsByCa2: GleanCustomDistribution;
    keaDheKeySizeFull: GleanCustomDistribution;
    keaEcdheCurveFull: GleanCustomDistribution;
    keaRsaKeySizeFull: GleanCustomDistribution;
    keyExchangeAlgorithmFull: GleanCustomDistribution;
    keyExchangeAlgorithmResumed: GleanCustomDistribution;
    npnType: GleanCustomDistribution;
    ocspStapling: GleanCustomDistribution;
    permanentCertErrorOverrides: GleanCustomDistribution;
    reasonsForNotFalseStarting: GleanCustomDistribution;
    resumedSession: Record<'false' | 'true', GleanCounter>;
    sctsFromTiledLogsPerConnection: GleanCustomDistribution;
    sctsOrigin: GleanCustomDistribution;
    sctsPerConnection: GleanCustomDistribution;
    sctsVerificationStatus: GleanCustomDistribution;
    timeUntilHandshakeFinishedKeyedByKa: Record<string, GleanTimingDistribution>;
    timeUntilReady: GleanTimingDistribution;
    timeUntilReadyConservative: GleanTimingDistribution;
    timeUntilReadyEch: GleanTimingDistribution;
    timeUntilReadyEchGrease: GleanTimingDistribution;
    timeUntilReadyFirstTry: GleanTimingDistribution;
    tls10IntoleranceReasonPost: GleanCustomDistribution;
    tls10IntoleranceReasonPre: GleanCustomDistribution;
    tls11IntoleranceReasonPost: GleanCustomDistribution;
    tls11IntoleranceReasonPre: GleanCustomDistribution;
    tls12IntoleranceReasonPost: GleanCustomDistribution;
    tls12IntoleranceReasonPre: GleanCustomDistribution;
    tls13IntoleranceReasonPost: GleanCustomDistribution;
    tls13IntoleranceReasonPre: GleanCustomDistribution;
    versionFallbackInappropriate: GleanCustomDistribution;
  };

  sslHandshake: {
    completed: GleanCustomDistribution;
    privacy: GleanCustomDistribution;
    result: GleanCustomDistribution;
    resultConservative: GleanCustomDistribution;
    resultEch: GleanCustomDistribution;
    resultEchGrease: GleanCustomDistribution;
    resultFirstTry: GleanCustomDistribution;
    version: GleanCustomDistribution;
  };

  tls: {
    certificateVerifications: GleanDenominator;
    cipherSuite: GleanCustomDistribution;
    xyberIntoleranceReason: Record<
      | 'PR_CONNECT_RESET_ERROR'
      | 'PR_END_OF_FILE_ERROR'
      | 'SSL_ERROR_BAD_HANDSHAKE_HASH_VALUE'
      | 'SSL_ERROR_BAD_MAC_ALERT'
      | 'SSL_ERROR_BAD_MAC_READ'
      | 'SSL_ERROR_DECODE_ERROR_ALERT'
      | 'SSL_ERROR_HANDSHAKE_FAILED'
      | 'SSL_ERROR_HANDSHAKE_FAILURE_ALERT'
      | 'SSL_ERROR_HANDSHAKE_UNEXPECTED_ALERT'
      | 'SSL_ERROR_ILLEGAL_PARAMETER_ALERT'
      | 'SSL_ERROR_INTERNAL_ERROR_ALERT'
      | 'SSL_ERROR_KEY_EXCHANGE_FAILURE'
      | 'SSL_ERROR_NO_CYPHER_OVERLAP'
      | 'SSL_ERROR_PROTOCOL_VERSION_ALERT'
      | 'SSL_ERROR_RX_MALFORMED_HYBRID_KEY_SHARE'
      | 'SSL_ERROR_RX_UNEXPECTED_RECORD_TYPE'
      | 'SSL_ERROR_UNSUPPORTED_VERSION',
      GleanCounter
    >;
  };

  verificationUsedCertFrom: {
    builtInRootsModule: GleanNumerator;
    nssCertDb: GleanNumerator;
    preloadedIntermediates: GleanNumerator;
    thirdPartyCertificates: GleanNumerator;
    tlsHandshake: GleanNumerator;
  };

  sandbox: {
    contentWin32kLockdownState: GleanQuantity;
    effectiveContentProcessLevel: GleanQuantity;
    failedLaunchKeyed: Record<string, GleanCustomDistribution>;
    rejectedSyscalls: Record<string, GleanCounter>;
  };

  uptakeRemotecontentResult: {
    uptakeNormandy: GleanEventWithExtras<{
      age?: string;
      duration?: string;
      errorName?: string;
      source?: string;
      timestamp?: string;
      trigger?: string;
      value?: string;
    }>;
    uptakeRemotesettings: GleanEventWithExtras<{
      age?: string;
      duration?: string;
      errorName?: string;
      source?: string;
      timestamp?: string;
      trigger?: string;
      value?: string;
    }>;
  };

  clientAssociation: {
    legacyClientId: GleanUuid;
    uid: GleanString;
  };

  fxa: {
    accountEnabled: GleanBoolean;
    closetabReceived: GleanEventWithExtras<{
      flow_id?: string;
      hashed_device_id?: string;
      reason?: string;
      server_time?: string;
      stream_id?: string;
    }>;
    closetabSent: GleanEventWithExtras<{
      flow_id?: string;
      hashed_device_id?: string;
      server_time?: string;
      stream_id?: string;
    }>;
    connectAccount: GleanEventWithExtras<{ fxa?: string; sync?: string; value?: string }>;
    disconnectAccount: GleanEventWithExtras<{ fxa?: string; sync?: string; value?: string }>;
    sendtabReceived: GleanEventWithExtras<{
      flow_id?: string;
      hashed_device_id?: string;
      reason?: string;
      server_time?: string;
      stream_id?: string;
    }>;
    sendtabSent: GleanEventWithExtras<{
      flow_id?: string;
      hashed_device_id?: string;
      server_time?: string;
      stream_id?: string;
    }>;
    syncEnabled: GleanBoolean;
  };

  syncSettings: {
    openChooseWhatToSyncMenu: GleanEventWithExtras<{ why?: string }>;
    save: GleanEventWithExtras<{ disabled_engines?: string; enabled_engines?: string }>;
  };

  fxaAppMenu: {
    clickAccountSettings: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickCad: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickLogin: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickMonitorCta: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickOpenMonitor: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickOpenSend: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickRelayCta: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSendTab: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSyncCta: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSyncNow: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSyncSettings: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSyncTabs: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSyncTabsSidebar: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickToolbarIcon: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickUnverSyncSettings: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickVpnCta: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
  };

  fxaAvatarMenu: {
    clickAccountSettings: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickCad: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickLogin: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickMonitorCta: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickOpenMonitor: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickOpenSend: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickRelayCta: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSendTab: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSyncCta: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSyncNow: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSyncSettings: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSyncTabs: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickSyncTabsSidebar: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickToolbarIcon: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickUnverSyncSettings: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
    clickVpnCta: GleanEventWithExtras<{
      fxa_avatar?: string;
      fxa_status?: string;
      fxa_sync_on?: string;
    }>;
  };

  sync: {
    deviceCountDesktop: GleanCustomDistribution;
    deviceCountMobile: GleanCustomDistribution;
    maintenanceFixBookmarks: GleanEventNoExtras;
    maintenanceRunBookmarks: GleanEventNoExtras;
  };

  syncClient: {
    processcommand: GleanEventWithExtras<{
      command?: string;
      flow_id?: string;
      server_time?: string;
    }>;
    sendcommand: GleanEventWithExtras<{
      command?: string;
      device_id?: string;
      flow_id?: string;
      reason?: string;
      server_time?: string;
    }>;
  };

  syncMergeDialog: {
    clicked: GleanEventWithExtras<{ option_clicked?: string; variant_shown?: string }>;
  };

  syncs: {
    discarded: GleanQuantity;
    hashedDeviceId: GleanString;
    hashedFxaUid: GleanString;
    migrations: GleanObject;
    sessionStartDate: GleanDatetime;
    syncNodeType: GleanString;
    syncs: GleanObject;
  };

  startupCache: {
    requests: Record<'HitDisk' | 'HitMemory' | 'Miss', GleanCounter>;
  };

  sqliteStore: {
    open: GleanDualLabeledCounter;
    query: GleanDualLabeledCounter;
  };

  bounceTrackingProtection: {
    mode: GleanQuantity;
    numHostsPerPurgeRun: GleanCustomDistribution;
    purgeAction: GleanEventWithExtras<{
      bounce_time?: string;
      is_dry_run?: string;
      require_stateful_bounces?: string;
      site_host?: string;
      success?: string;
    }>;
    purgeCount: Record<'dry' | 'failure' | 'success', GleanCounter>;
    purgeCountClassifiedTracker: GleanCounter;
    purgeDuration: GleanTimingDistribution;
  };

  contentblocking: {
    canvasFingerprintingPerTab: Record<
      'known_text' | 'known_text_matched' | 'unknown' | 'unknown_matched',
      GleanCustomDistribution
    >;
    category: GleanQuantity;
    cookieBehavior: GleanCustomDistribution;
    cryptominersBlockedCount: Record<'allowed' | 'blocked' | 'pageLoad', GleanCounter>;
    cryptominingBlockingEnabled: GleanBoolean;
    emailTrackerCount: Record<
      'base_email_webapp' | 'base_normal' | 'content_email_webapp' | 'content_normal',
      GleanCounter
    >;
    emailTrackerEmbeddedPerTab: Record<
      | 'all_emailapp'
      | 'all_normal'
      | 'base_emailapp'
      | 'base_normal'
      | 'content_emailapp'
      | 'content_normal',
      GleanCustomDistribution
    >;
    fingerprintersBlockedCount: Record<'allowed' | 'blocked' | 'pageLoad', GleanCounter>;
    fingerprintingBlockingEnabled: GleanBoolean;
    fontFingerprintingPerTab: Record<'false' | 'true', GleanCounter>;
    queryStrippingCount: Record<
      'Navigation' | 'Redirect' | 'StripForNavigation' | 'StripForRedirect',
      GleanCounter
    >;
    queryStrippingCountByParam: Record<
      | 'param___hsfp'
      | 'param___hssc'
      | 'param___hstc'
      | 'param___s'
      | 'param__hsenc'
      | 'param__openstat'
      | 'param_dclid'
      | 'param_fbclid'
      | 'param_gbraid'
      | 'param_gclid'
      | 'param_hsctatracking'
      | 'param_mc_eid'
      | 'param_mkt_tok'
      | 'param_msclkid'
      | 'param_oly_anon_id'
      | 'param_oly_enc_id'
      | 'param_twclid'
      | 'param_vero_id'
      | 'param_wbraid'
      | 'param_wickedid'
      | 'param_yclid'
      | 'param_ysclid',
      GleanCounter
    >;
    queryStrippingParamCount: GleanCustomDistribution;
    storageAccessGrantedCount: Record<
      | 'Navigation'
      | 'Navigation_CT'
      | 'Opener'
      | 'OpenerAfterUI'
      | 'OpenerAfterUI_CT'
      | 'Opener_CT'
      | 'Redirect'
      | 'RedirectTracker'
      | 'RedirectTracker_CT'
      | 'Redirect_CT'
      | 'StorageAccessAPI'
      | 'StorageAccessAPI_CT'
      | 'StorageGranted'
      | 'StorageGranted_CT',
      GleanCounter
    >;
    storageAccessRemainingDays: GleanCustomDistribution;
    stripOnShareLengthDecrease: GleanCustomDistribution;
    stripOnShareParamsRemoved: GleanCustomDistribution;
    tpAllowlistBaselineEnabled: GleanBoolean;
    tpAllowlistConvenienceEnabled: GleanBoolean;
    trackersBlockedCount: GleanCounter;
    trackingProtectionEnabled: Record<'false' | 'true', GleanCounter>;
    trackingProtectionPbmDisabled: Record<'false' | 'true', GleanCounter>;
    trackingProtectionShield: GleanCustomDistribution;
  };

  cookiePurging: {
    duration: GleanTimingDistribution;
    intervalHours: GleanTimingDistribution;
    originsPurged: GleanCustomDistribution;
    trackersUserInteractionRemainingDays: GleanTimingDistribution;
    trackersWithUserInteraction: GleanCustomDistribution;
  };

  hangs: {
    modules: GleanObject;
    reports: GleanObject;
  };

  backgroundTasksRmdirBase: {
    elapsedMs: GleanQuantity;
    metricBase: GleanEventNoExtras;
    removalCount: GleanQuantity;
    retryCount: GleanQuantity;
    succeeded: GleanBoolean;
    suffixEverFailed: GleanBoolean;
    suffixRemovalCount: GleanQuantity;
    wasFirst: GleanBoolean;
  };

  backgroundTasksRmdirHttpCache: {
    elapsedMs: GleanQuantity;
    metricBase: GleanEventNoExtras;
    removalCount: GleanQuantity;
    retryCount: GleanQuantity;
    succeeded: GleanBoolean;
    suffixEverFailed: GleanBoolean;
    suffixRemovalCount: GleanQuantity;
    wasFirst: GleanBoolean;
  };

  backgroundTasksRmdirQuota: {
    elapsedMs: GleanQuantity;
    metricBase: GleanEventNoExtras;
    removalCount: GleanQuantity;
    retryCount: GleanQuantity;
    succeeded: GleanBoolean;
    suffixEverFailed: GleanBoolean;
    suffixRemovalCount: GleanQuantity;
    wasFirst: GleanBoolean;
  };

  captchaDetection: {
    arkoselabsOc: GleanCounter;
    arkoselabsOcPbm: GleanCounter;
    arkoselabsPc: GleanCounter;
    arkoselabsPcPbm: GleanCounter;
    arkoselabsPf: GleanCounter;
    arkoselabsPfPbm: GleanCounter;
    arkoselabsSolutionsRequired: GleanCustomDistribution;
    arkoselabsSolutionsRequiredPbm: GleanCustomDistribution;
    cloudflareTurnstileCc: GleanCounter;
    cloudflareTurnstileCcPbm: GleanCounter;
    cloudflareTurnstileCf: GleanCounter;
    cloudflareTurnstileCfPbm: GleanCounter;
    cloudflareTurnstileOc: GleanCounter;
    cloudflareTurnstileOcPbm: GleanCounter;
    datadomeBl: GleanCounter;
    datadomeBlPbm: GleanCounter;
    datadomeOc: GleanCounter;
    datadomePc: GleanCounter;
    datadomePcPbm: GleanCounter;
    datadomePs: GleanCounter;
    datadomePsPbm: GleanCounter;
    googleRecaptchaV2Ac: GleanCounter;
    googleRecaptchaV2AcPbm: GleanCounter;
    googleRecaptchaV2Oc: GleanCounter;
    googleRecaptchaV2OcPbm: GleanCounter;
    googleRecaptchaV2Pc: GleanCounter;
    googleRecaptchaV2PcPbm: GleanCounter;
    googleRecaptchaV2Ps: GleanCounter;
    googleRecaptchaV2PsPbm: GleanCounter;
    hcaptchaAc: GleanCounter;
    hcaptchaAcPbm: GleanCounter;
    hcaptchaOc: GleanCounter;
    hcaptchaOcPbm: GleanCounter;
    hcaptchaPc: GleanCounter;
    hcaptchaPcPbm: GleanCounter;
    hcaptchaPs: GleanCounter;
    hcaptchaPsPbm: GleanCounter;
    networkCookieCookiebehavior: GleanString;
    networkCookieCookiebehaviorOptinpartitioning: GleanBoolean;
    networkCookieCookiebehaviorOptinpartitioningPbm: GleanBoolean;
    pagesVisited: GleanCounter;
    pagesVisitedPbm: GleanCounter;
    privacyFingerprintingprotection: GleanBoolean;
    privacyFingerprintingprotectionPbm: GleanBoolean;
    privacyResistfingerprinting: GleanBoolean;
    privacyResistfingerprintingPbmode: GleanBoolean;
    privacyTrackingprotectionCryptominingEnabled: GleanBoolean;
    privacyTrackingprotectionEnabled: GleanBoolean;
    privacyTrackingprotectionFingerprintingEnabled: GleanBoolean;
    privacyTrackingprotectionPbmEnabled: GleanBoolean;
  };

  contentAnalysis: {
    agentName: GleanString;
    allowUrlRegexListSet: GleanBoolean;
    bypassForSameTabOperations: GleanBoolean;
    clientSignature: GleanString;
    connectionAttempt: GleanCounter;
    connectionAttemptRetry: GleanCounter;
    connectionFailure: Record<string, GleanCounter>;
    defaultResult: GleanQuantity;
    denyUrlRegexListSet: GleanBoolean;
    interceptionPointsTurnedOff: GleanStringList;
    requestAllowedByAllowUrl: GleanCounter;
    requestBlockedByDenyUrl: GleanCounter;
    requestSentByAnalysisType: Record<string, GleanCounter>;
    requestSentByReason: Record<string, GleanCounter>;
    responseAction: Record<string, GleanCounter>;
    responseDurationByAnalysisType: Record<string, GleanTimingDistribution>;
    showBlockedResult: GleanBoolean;
    timeoutResult: GleanQuantity;
  };

  relevancyClassify: {
    duration: GleanTimingDistribution;
    fail: GleanEventWithExtras<{ reason?: string }>;
    succeed: GleanEventWithExtras<{
      input_classified_size?: string;
      input_inconclusive_size?: string;
      input_size?: string;
      interest_top_1_hits?: string;
      interest_top_2_hits?: string;
      interest_top_3_hits?: string;
      output_interest_size?: string;
    }>;
  };

  cookieBanners: {
    googleGdprChoiceCookie: Record<string, GleanString>;
    googleGdprChoiceCookieEvent: GleanEventWithExtras<{
      choice?: string;
      region?: string;
      search_domain?: string;
    }>;
    googleGdprChoiceCookieEventPbm: GleanEventWithExtras<{ choice?: string }>;
    normalWindowServiceMode: Record<
      'disabled' | 'invalid' | 'reject' | 'reject_or_accept',
      GleanBoolean
    >;
    privateWindowServiceMode: Record<
      'disabled' | 'invalid' | 'reject' | 'reject_or_accept',
      GleanBoolean
    >;
    serviceDetectOnly: GleanBoolean;
  };

  crash: {
    appBuild: GleanString;
    appChannel: GleanString;
    appDisplayVersion: GleanString;
    asyncShutdownTimeout: GleanObject;
    backgroundTaskName: GleanString;
    compressedStoreSize: GleanMemoryDistribution;
    eventLoopNestingLevel: GleanQuantity;
    fontName: GleanString;
    gpuProcessLaunch: GleanQuantity;
    ipcChannelError: GleanString;
    isGarbageCollecting: GleanBoolean;
    mainThreadRunnableName: GleanString;
    minidumpSha256Hash: GleanString;
    mozCrashReason: GleanString;
    processType: GleanString;
    profilerChildShutdownPhase: GleanString;
    quotaManagerShutdownTimeout: GleanObject;
    remoteType: GleanString;
    shutdownProgress: GleanString;
    stackTraces: GleanObject;
    startup: GleanBoolean;
    submitAttempt: Record<
      | 'content-crash'
      | 'content-hang'
      | 'forkserver-crash'
      | 'forkserver-hang'
      | 'gmplugin-crash'
      | 'gmplugin-hang'
      | 'gpu-crash'
      | 'gpu-hang'
      | 'main-crash'
      | 'main-hang'
      | 'plugin-crash'
      | 'plugin-hang'
      | 'rdd-crash'
      | 'rdd-hang'
      | 'sandboxbroker-crash'
      | 'sandboxbroker-hang'
      | 'socket-crash'
      | 'socket-hang'
      | 'utility-crash'
      | 'utility-hang'
      | 'vr-crash'
      | 'vr-hang',
      GleanCounter
    >;
    submitSuccess: GleanDualLabeledCounter;
    time: GleanDatetime;
    utilityActorsName: GleanStringList;
  };

  crashWindows: {
    errorReporting: GleanBoolean;
    fileDialogErrorCode: GleanString;
  };

  crashSubmission: {
    channelStatus: Record<string, GleanCounter>;
    collectorErrors: Record<string, GleanCounter>;
    failure: GleanCounter;
    failureEvent: GleanEventWithExtras<{ id?: string; reason?: string }>;
    pending: GleanCounter;
    success: GleanCounter;
  };

  dllBlocklist: {
    initFailed: GleanBoolean;
    list: GleanStringList;
    user32LoadedBefore: GleanBoolean;
  };

  environment: {
    headlessMode: GleanBoolean;
    nimbusEnrollments: GleanStringList;
    uptime: GleanTimespan;
  };

  memory: {
    availableCommit: GleanQuantity;
    availablePhysical: GleanQuantity;
    availableSwap: GleanQuantity;
    availableVirtual: GleanQuantity;
    jsLargeAllocationFailure: GleanString;
    jsOutOfMemory: GleanString;
    lowPhysical: GleanQuantity;
    oomAllocationSize: GleanQuantity;
    purgeablePhysical: GleanQuantity;
    systemUsePercentage: GleanQuantity;
    texture: GleanQuantity;
    totalPageFile: GleanQuantity;
    totalPhysical: GleanQuantity;
    totalVirtual: GleanQuantity;
    collectionTime: GleanTimingDistribution;
    distributionAmongContent: Record<string, GleanCustomDistribution>;
    freePurgedPages: GleanTimingDistribution;
    ghostWindows: GleanCustomDistribution;
    heapAllocated: GleanMemoryDistribution;
    heapOverheadFraction: GleanCustomDistribution;
    imagesContentUsedUncompressed: GleanMemoryDistribution;
    jsCompartmentsSystem: GleanCustomDistribution;
    jsCompartmentsUser: GleanCustomDistribution;
    jsGcHeap: GleanMemoryDistribution;
    jsRealmsSystem: GleanCustomDistribution;
    jsRealmsUser: GleanCustomDistribution;
    lowMemoryEventsPhysical: GleanCustomDistribution;
    pageFaultsHard: GleanCustomDistribution;
    residentFast: GleanMemoryDistribution;
    residentPeak: GleanMemoryDistribution;
    storageSqlite: GleanMemoryDistribution;
    total: GleanMemoryDistribution;
    unique: GleanMemoryDistribution;
    uniqueContentStartup: GleanMemoryDistribution;
    vsize: GleanMemoryDistribution;
    vsizeMaxContiguous: GleanMemoryDistribution;
  };

  windows: {
    packageFamilyName: GleanString;
  };

  doh: {
    evaluateV2Heuristics: GleanEventWithExtras<{
      canaries?: string;
      captiveState?: string;
      enterprise?: string;
      evaluateReason?: string;
      filtering?: string;
      networkID?: string;
      platform?: string;
      steeredProvider?: string;
      value?: string;
    }>;
    stateDisabled: GleanEventWithExtras<{ value?: string }>;
    stateEnabled: GleanEventWithExtras<{ value?: string }>;
    stateManuallyDisabled: GleanEventWithExtras<{ value?: string }>;
    statePolicyDisabled: GleanEventWithExtras<{ value?: string }>;
    stateRollback: GleanEventWithExtras<{ value?: string }>;
    stateShutdown: GleanEventWithExtras<{ value?: string }>;
    stateUidisabled: GleanEventWithExtras<{ value?: string }>;
    stateUiok: GleanEventWithExtras<{ value?: string }>;
    stateUninstalled: GleanEventWithExtras<{ value?: string }>;
  };

  securityDohTrrPerformance: {
    resolvedRecord: GleanEventWithExtras<{
      captivePortal?: string;
      domain?: string;
      networkUnstable?: string;
      retryCount?: string;
      status?: string;
      time?: string;
      trr?: string;
      value?: string;
    }>;
    trrselectDryrunresult: GleanEventWithExtras<{ value?: string }>;
  };

  policies: {
    count: GleanQuantity;
    isEnterprise: GleanBoolean;
  };

  extensions: {
    processEvent: Record<
      | 'crashed_bg'
      | 'crashed_fg'
      | 'crashed_over_threshold_bg'
      | 'crashed_over_threshold_fg'
      | 'created_bg'
      | 'created_fg',
      GleanCounter
    >;
    startupCacheLoadTime: GleanTimespan;
    startupCacheReadErrors: Record<string, GleanCounter>;
    startupCacheWriteBytelength: GleanQuantity;
    useRemotePolicy: GleanBoolean;
    useRemotePref: GleanBoolean;
  };

  extensionsApisDnr: {
    evaluateRulesCountMax: GleanQuantity;
    evaluateRulesTime: GleanTimingDistribution;
    startupCacheEntries: Record<'hit' | 'miss', GleanCounter>;
    startupCacheReadSize: GleanMemoryDistribution;
    startupCacheReadTime: GleanTimingDistribution;
    startupCacheWriteSize: GleanMemoryDistribution;
    startupCacheWriteTime: GleanTimingDistribution;
    validateRulesTime: GleanTimingDistribution;
  };

  extensionsCounters: {
    browserActionPreloadResult: Record<
      'clearAfterHover' | 'clearAfterMousedown' | 'popupShown',
      GleanCounter
    >;
    browserActionPreloadResultByAddonid: GleanDualLabeledCounter;
    eventPageIdleResult: Record<
      | 'launchWebAuthFlow'
      | 'permissions_request'
      | 'reset_event'
      | 'reset_listeners'
      | 'reset_nativeapp'
      | 'reset_other'
      | 'reset_parentapicall'
      | 'reset_streamfilter'
      | 'suspend',
      GleanCounter
    >;
    eventPageIdleResultByAddonid: GleanDualLabeledCounter;
  };

  extensionsData: {
    migrateResult: GleanEventWithExtras<{
      addon_id?: string;
      backend?: string;
      data_migrated?: string;
      error_name?: string;
      has_jsonfile?: string;
      has_olddata?: string;
    }>;
    migrateResultCount: Record<'failure' | 'success', GleanCounter>;
    storageLocalError: GleanEventWithExtras<{
      addon_id?: string;
      error_name?: string;
      method?: string;
    }>;
    syncUsageQuotas: GleanEventWithExtras<{
      addon_id?: string;
      backend?: string;
      items_count?: string;
      items_over_quota?: string;
      total_size_bytes?: string;
    }>;
  };

  extensionsTiming: {
    backgroundPageLoad: GleanTimingDistribution;
    backgroundPageLoadByAddonid: Record<string, GleanTimingDistribution>;
    browserActionPopupOpen: GleanTimingDistribution;
    browserActionPopupOpenByAddonid: Record<string, GleanTimingDistribution>;
    contentScriptInjection: GleanTimingDistribution;
    contentScriptInjectionByAddonid: Record<string, GleanTimingDistribution>;
    eventPageRunningTime: GleanCustomDistribution;
    eventPageRunningTimeByAddonid: Record<string, GleanTimingDistribution>;
    extensionStartup: GleanTimingDistribution;
    extensionStartupByAddonid: Record<string, GleanTimingDistribution>;
    pageActionPopupOpen: GleanTimingDistribution;
    pageActionPopupOpenByAddonid: Record<string, GleanTimingDistribution>;
    storageLocalGetIdb: GleanTimingDistribution;
    storageLocalGetIdbByAddonid: Record<string, GleanTimingDistribution>;
    storageLocalSetIdb: GleanTimingDistribution;
    storageLocalSetIdbByAddonid: Record<string, GleanTimingDistribution>;
  };

  address: {
    addManage: GleanEventWithExtras<{ value?: string }>;
    cancelCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    cancelEditDoorhanger: GleanEventWithExtras<{ value?: string }>;
    cancelUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
    clearedAddressForm: GleanEventWithExtras<{ field_name?: string; value?: string }>;
    deleteManage: GleanEventWithExtras<{ value?: string }>;
    detectedAddressForm: GleanEventWithExtras<{
      address_level1?: string;
      address_level2?: string;
      address_line1?: string;
      address_line2?: string;
      address_line3?: string;
      country?: string;
      postal_code?: string;
      street_address?: string;
      value?: string;
    }>;
    detectedAddressFormExt: GleanEventWithExtras<{
      additional_name?: string;
      email?: string;
      family_name?: string;
      given_name?: string;
      name?: string;
      organization?: string;
      tel?: string;
      value?: string;
    }>;
    disableCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    disableEditDoorhanger: GleanEventWithExtras<{ value?: string }>;
    disableUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
    editManage: GleanEventWithExtras<{ value?: string }>;
    filledAddressForm: GleanEventWithExtras<{
      address_level1?: string;
      address_level2?: string;
      address_line1?: string;
      address_line2?: string;
      address_line3?: string;
      country?: string;
      postal_code?: string;
      street_address?: string;
      value?: string;
    }>;
    filledAddressFormExt: GleanEventWithExtras<{
      additional_name?: string;
      email?: string;
      family_name?: string;
      given_name?: string;
      name?: string;
      organization?: string;
      tel?: string;
      value?: string;
    }>;
    filledModifiedAddressForm: GleanEventWithExtras<{
      address_level1?: string;
      address_level2?: string;
      address_line1?: string;
      address_line2?: string;
      address_line3?: string;
      country?: string;
      field_name?: string;
      postal_code?: string;
      street_address?: string;
      value?: string;
    }>;
    filledOnFieldsUpdateAddressForm: GleanEventWithExtras<{
      additional_name?: string;
      address_level1?: string;
      address_level2?: string;
      address_line1?: string;
      address_line2?: string;
      address_line3?: string;
      country?: string;
      email?: string;
      family_name?: string;
      given_name?: string;
      name?: string;
      organization?: string;
      postal_code?: string;
      street_address?: string;
      tel?: string;
      value?: string;
    }>;
    learnMoreCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    learnMoreEditDoorhanger: GleanEventWithExtras<{ value?: string }>;
    learnMoreUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
    popupShownAddressForm: GleanEventWithExtras<{ field_name?: string; value?: string }>;
    prefCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    prefEditDoorhanger: GleanEventWithExtras<{ value?: string }>;
    prefUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
    saveCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    saveEditDoorhanger: GleanEventWithExtras<{ value?: string }>;
    saveUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
    showCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    showEditDoorhanger: GleanEventWithExtras<{ value?: string }>;
    showEntryManage: GleanEventWithExtras<{ value?: string }>;
    showManage: GleanEventWithExtras<{ value?: string }>;
    showUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
    submittedAddressForm: GleanEventWithExtras<{
      address_level1?: string;
      address_level2?: string;
      address_line1?: string;
      address_line2?: string;
      address_line3?: string;
      country?: string;
      postal_code?: string;
      street_address?: string;
      value?: string;
    }>;
    submittedAddressFormExt: GleanEventWithExtras<{
      additional_name?: string;
      email?: string;
      family_name?: string;
      given_name?: string;
      name?: string;
      organization?: string;
      tel?: string;
      value?: string;
    }>;
    updateCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    updateEditDoorhanger: GleanEventWithExtras<{ value?: string }>;
    updateUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
  };

  creditcard: {
    addManage: GleanEventWithExtras<{ value?: string }>;
    cancelCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    cancelUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
    clearedCcFormV2: GleanEventWithExtras<{
      cc_exp?: string;
      cc_exp_month?: string;
      cc_exp_year?: string;
      cc_name?: string;
      cc_number?: string;
      cc_type?: string;
      field_name?: string;
      value?: string;
    }>;
    deleteManage: GleanEventWithExtras<{ value?: string }>;
    detectedCcFormV2: GleanEventWithExtras<{
      cc_exp?: string;
      cc_exp_month?: string;
      cc_exp_year?: string;
      cc_name?: string;
      cc_number?: string;
      cc_type?: string;
      field_name?: string;
      value?: string;
    }>;
    detectedCcNumberFieldsCount: Record<
      | 'cc_number_fields_1'
      | 'cc_number_fields_2'
      | 'cc_number_fields_3'
      | 'cc_number_fields_4'
      | 'cc_number_fields_other',
      GleanCounter
    >;
    disableCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    disableUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
    editManage: GleanEventWithExtras<{ value?: string }>;
    filledCcFormV2: GleanEventWithExtras<{
      cc_exp?: string;
      cc_exp_month?: string;
      cc_exp_year?: string;
      cc_name?: string;
      cc_number?: string;
      cc_type?: string;
      field_name?: string;
      value?: string;
    }>;
    filledModifiedCcFormV2: GleanEventWithExtras<{
      cc_exp?: string;
      cc_exp_month?: string;
      cc_exp_year?: string;
      cc_name?: string;
      cc_number?: string;
      cc_type?: string;
      field_name?: string;
      value?: string;
    }>;
    filledOnFieldsUpdateCcFormV2: GleanEventWithExtras<{
      cc_exp?: string;
      cc_exp_month?: string;
      cc_exp_year?: string;
      cc_name?: string;
      cc_number?: string;
      cc_type?: string;
      value?: string;
    }>;
    osKeystoreDecrypt: GleanEventWithExtras<{
      errorResult?: string;
      isDecryptSuccess?: string;
      trigger?: string;
    }>;
    popupShownCcFormV2: GleanEventWithExtras<{
      cc_exp?: string;
      cc_exp_month?: string;
      cc_exp_year?: string;
      cc_name?: string;
      cc_number?: string;
      cc_type?: string;
      field_name?: string;
      value?: string;
    }>;
    saveCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    saveUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
    showCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    showEntryManage: GleanEventWithExtras<{ value?: string }>;
    showManage: GleanEventWithExtras<{ value?: string }>;
    showUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
    submittedCcFormV2: GleanEventWithExtras<{
      cc_exp?: string;
      cc_exp_month?: string;
      cc_exp_year?: string;
      cc_name?: string;
      cc_number?: string;
      cc_type?: string;
      field_name?: string;
      value?: string;
    }>;
    updateCaptureDoorhanger: GleanEventWithExtras<{ value?: string }>;
    updateUpdateDoorhanger: GleanEventWithExtras<{ value?: string }>;
  };

  formautofill: {
    availability: GleanBoolean;
    formSubmissionHeuristic: Record<
      'form-removal-after-fetch' | 'form-submit-event' | 'iframe-pagehide' | 'page-navigation',
      GleanCounter
    >;
    iframeLayoutDetection: GleanEventWithExtras<{
      category?: string;
      cross_origin?: string;
      flow_id?: string;
      iframe?: string;
      iframe_count?: string;
      main_frame?: string;
      sandboxed?: string;
    }>;
    osAuthEnabled: GleanBoolean;
    promptShownOsReauth: GleanEventWithExtras<{ result?: string; trigger?: string }>;
    requireOsReauthToggle: GleanEventWithExtras<{ toggle_state?: string }>;
  };

  formautofillAddresses: {
    autofillProfilesCount: GleanQuantity;
  };

  formautofillCreditcards: {
    autofillProfilesCount: GleanQuantity;
  };

  geckoTrace: {
    traces: GleanObject;
  };

  fog: {
    dataDirectoryInfo: GleanObject;
    failedIdleRegistration: GleanBoolean;
    initializations: GleanTimingDistribution;
    initsDuringShutdown: GleanCounter;
    maxPingsPerMinute: GleanQuantity;
    subdirEntryErr: Record<'db' | 'events' | 'pending_pings', GleanCounter>;
    subdirEntryMetadataErr: Record<'db' | 'events' | 'pending_pings', GleanCounter>;
    subdirErr: Record<'db' | 'events' | 'pending_pings', GleanBoolean>;
  };

  fogIpc: {
    bufferSizes: GleanMemoryDistribution;
    flushDurations: GleanTimingDistribution;
    flushFailures: GleanCounter;
    replayFailures: GleanCounter;
    shutdownRegistrationFailures: GleanCounter;
  };

  testOnly: {
    anEvent: GleanEventNoExtras;
    badCode: GleanCounter;
    balloons: GleanObject;
    buttonJars: Record<string, GleanQuantity>;
    canWeFlagIt: GleanBoolean;
    canWeTimeIt: GleanTimespan;
    cheesyString: GleanString;
    cheesyStringList: GleanStringList;
    collectionDisabledCounter: GleanCounter;
    crashStack: GleanObject;
    defaultProducts: GleanCounter;
    desktopOnly: GleanCounter;
    disabledCounter: GleanCounter;
    doYouRemember: GleanMemoryDistribution;
    expired: GleanCounter;
    expiredHist: GleanCustomDistribution;
    impressionIdOnly: GleanString;
    keyedCategories: GleanDualLabeledCounter;
    keyedExpired: Record<string, GleanCounter>;
    keyedMobileOnly: Record<string, GleanCounter>;
    keyedReleaseOptin: Record<string, GleanCounter>;
    keyedReleaseOptout: Record<string, GleanCounter>;
    mabelsBalloonLabels: Record<'celebratory' | 'celebratory_and_snarky', GleanString>;
    mabelsBalloonStrings: Record<string, GleanString>;
    mabelsBathroomCounters: Record<string, GleanCounter>;
    mabelsCustomLabelLengths: Record<string, GleanCustomDistribution>;
    mabelsKitchenCounters: Record<string, GleanCounter>;
    mabelsLabelMaker: Record<string, GleanString>;
    mabelsLabeledCounters: Record<'1st_counter' | 'clean' | 'next_to_the_fridge', GleanCounter>;
    mabelsLikeBalloons: Record<string, GleanBoolean>;
    mabelsLikeLabeledBalloons: Record<'birthday_party' | 'water', GleanBoolean>;
    mainOnly: GleanQuantity;
    meaningOfLife: GleanQuantity;
    mirrorTime: GleanTimespan;
    mirrorTimeNanos: GleanTimespan;
    mirrorsForLabeledBools: Record<string, GleanBoolean>;
    mobileOnly: GleanCounter;
    multiproduct: GleanCounter;
    onePingOneBool: GleanBoolean;
    releaseOptin: GleanCounter;
    releaseOptout: GleanCounter;
    unexpired: GleanCounter;
    whatADate: GleanDatetime;
    whatDoYouRemember: Record<string, GleanMemoryDistribution>;
    whatIdIt: GleanUuid;
    whatTimeIsIt: GleanTimingDistribution;
    whereHasTheTimeGone: Record<string, GleanTimingDistribution>;
  };

  testOnlyIpc: {
    aBool: GleanBoolean;
    aCounter: GleanCounter;
    aCounterForHgram: GleanCounter;
    aCustomDist: GleanCustomDistribution;
    aDate: GleanDatetime;
    aDualLabeledCounter: GleanDualLabeledCounter;
    aLabeledCounter: Record<string, GleanCounter>;
    aLabeledCounterForCategorical: Record<
      'CommonLabel' | 'Label4' | 'Label5' | 'Label6',
      GleanCounter
    >;
    aLabeledCounterForHgram: Record<'false' | 'true', GleanCounter>;
    aLabeledCounterForKeyedCountHgram: Record<string, GleanCounter>;
    aMemoryDist: GleanMemoryDistribution;
    aQuantity: GleanQuantity;
    aString: GleanString;
    aStringList: GleanStringList;
    aText: GleanText;
    aTimingDist: GleanTimingDistribution;
    aUrl: GleanUrl;
    aUuid: GleanUuid;
    anEvent: GleanEventWithExtras<{ extra1?: string; extra2?: string; value?: string }>;
    anExternalDenominator: GleanDenominator;
    anUnorderedBool: GleanBoolean;
    anUnorderedLabeledBoolean: Record<string, GleanBoolean>;
    anotherDualLabeledCounter: GleanDualLabeledCounter;
    anotherLabeledCounter: Record<string, GleanCounter>;
    eventWithExtra: GleanEventWithExtras<{
      extra1?: string;
      extra2?: string;
      extra3_longer_name?: string;
      extra4CamelCase?: string;
    }>;
    irate: GleanRate;
    noExtraEvent: GleanEventNoExtras;
    rateWithExternalDenominator: GleanNumerator;
  };

  testOnlyJog: {
    aCounter: GleanCounter;
    anEvent: GleanEventWithExtras<{ extra1?: string; extra2?: string }>;
  };

  mediaSniffer: {
    mp4BrandPattern: Record<
      | 'ftyp_3gp'
      | 'ftyp_3gp4'
      | 'ftyp_M4A'
      | 'ftyp_M4P'
      | 'ftyp_M4V'
      | 'ftyp_avc'
      | 'ftyp_avif'
      | 'ftyp_crx'
      | 'ftyp_iso'
      | 'ftyp_mmp4'
      | 'ftyp_mp4'
      | 'ftyp_qt',
      GleanCounter
    >;
  };

  messagingExperiments: {
    reachCfr: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFeatureCallout: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsBmbButton: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage1: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage10: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage11: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage12: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage13: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage14: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage15: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage2: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage3: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage4: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage5: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage6: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage7: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage8: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachFxmsMessage9: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachInfobar: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachMomentsPage: GleanEventWithExtras<{ branches?: string; value?: string }>;
    reachSpotlight: GleanEventWithExtras<{ branches?: string; value?: string }>;
    targetingAttributeError: GleanEventWithExtras<{ source?: string; value?: string }>;
    targetingAttributeTimeout: GleanEventWithExtras<{ source?: string; value?: string }>;
  };

  firefoxAiRuntime: {
    engineCreationFailure: GleanEventWithExtras<{
      engineId?: string;
      error?: string;
      featureId?: string;
      modelId?: string;
      taskName?: string;
    }>;
    engineCreationSuccess: Record<
      | 'about-inference'
      | 'autofill-ml'
      | 'default-engine'
      | 'ml-suggest-intent'
      | 'ml-suggest-ner'
      | 'pdfjs'
      | 'smart-tab-embedding-engine'
      | 'smart-tab-topic-engine'
      | 'webextension'
      | 'wllamapreview',
      GleanTimingDistribution
    >;
    modelDeletion: GleanEventWithExtras<{
      deletedBy?: string;
      error?: string;
      modelId?: string;
      modelRevision?: string;
    }>;
    modelDownload: GleanEventWithExtras<{
      duration?: string;
      engineId?: string;
      error?: string;
      featureId?: string;
      modelDownloadId?: string;
      modelId?: string;
      modelRevision?: string;
      step?: string;
      when?: string;
    }>;
    runInferenceFailure: GleanEventWithExtras<{
      engineId?: string;
      featureId?: string;
      modelId?: string;
    }>;
    runInferenceSuccess: Record<
      | 'about-inference'
      | 'autofill-ml'
      | 'default-engine'
      | 'ml-suggest-intent'
      | 'ml-suggest-ner'
      | 'pdfjs'
      | 'smart-tab-embedding-engine'
      | 'smart-tab-topic-engine'
      | 'webextension'
      | 'wllamapreview',
      GleanTimingDistribution
    >;
  };

  modelManagement: {
    detailsView: GleanEventWithExtras<{
      extension_ids?: string;
      feature_ids?: string;
      model?: string;
      version?: string;
    }>;
    listItemManage: GleanEventWithExtras<{
      extension_ids?: string;
      feature_ids?: string;
      model?: string;
      version?: string;
    }>;
    listView: GleanEventWithExtras<{ models?: string }>;
    modelCardLink: GleanEventWithExtras<{
      extension_ids?: string;
      feature_ids?: string;
      model?: string;
      version?: string;
    }>;
    removeConfirmation: GleanEventWithExtras<{
      action?: string;
      extension_ids?: string;
      feature_ids?: string;
      model?: string;
      version?: string;
    }>;
    removeInitiated: GleanEventWithExtras<{
      extension_ids?: string;
      feature_ids?: string;
      last_install?: string;
      last_used?: string;
      model?: string;
      size?: string;
      source?: string;
      version?: string;
    }>;
  };

  heartbeat: {
    closed: GleanDatetime;
    engaged: GleanDatetime;
    expired: GleanDatetime;
    flowId: GleanUuid;
    learnMore: GleanDatetime;
    offered: GleanDatetime;
    score: GleanQuantity;
    surveyId: GleanString;
    voted: GleanDatetime;
    windowClosed: GleanDatetime;
  };

  nimbusEvents: {
    databaseWrite: GleanEventWithExtras<{ success?: string }>;
    enrollFailed: GleanEventWithExtras<{ branch?: string; experiment?: string; reason?: string }>;
    enrollment: GleanEventWithExtras<{
      branch?: string;
      experiment?: string;
      experiment_type?: string;
    }>;
    enrollmentStatus: GleanEventWithExtras<{
      branch?: string;
      conflict_slug?: string;
      error_string?: string;
      reason?: string;
      slug?: string;
      status?: string;
    }>;
    exposure: GleanEventWithExtras<{ branch?: string; experiment?: string; feature_id?: string }>;
    isReady: GleanEventNoExtras;
    migration: GleanEventWithExtras<{
      enrollments?: string;
      error_reason?: string;
      migration_id?: string;
      success?: string;
    }>;
    remoteSettingsSync: GleanEventWithExtras<{
      experiments_empty?: string;
      experiments_success?: string;
      force_sync?: string;
      secure_experiments_empty?: string;
      secure_experiments_success?: string;
      trigger?: string;
    }>;
    startupDatabaseConsistency: GleanEventWithExtras<{
      db_active_count?: string;
      primary?: string;
      store_active_count?: string;
      total_db_count?: string;
      total_store_count?: string;
      trigger?: string;
    }>;
    unenrollFailed: GleanEventWithExtras<{ experiment?: string; reason?: string }>;
    unenrollment: GleanEventWithExtras<{
      branch?: string;
      changed_pref?: string;
      conflicting_slug?: string;
      experiment?: string;
      locale?: string;
      pref_name?: string;
      pref_type?: string;
      reason?: string;
    }>;
    validationFailed: GleanEventWithExtras<{
      branch?: string;
      experiment?: string;
      l10n_ids?: string;
      locale?: string;
      reason?: string;
    }>;
  };

  nimbusTargetingContext: {
    activeExperiments: GleanObject;
    activeRollouts: GleanObject;
    addonsInfo: GleanObject;
    addressesSaved: GleanQuantity;
    archBits: GleanQuantity;
    attributionData: GleanObject;
    browserSettings: GleanObject;
    buildId: GleanQuantity;
    currentDate: GleanString;
    defaultPdfHandler: GleanObject;
    distributionId: GleanString;
    doesAppNeedPin: GleanBoolean;
    enrollmentsMap: GleanObject;
    firefoxVersion: GleanQuantity;
    hasActiveEnterprisePolicies: GleanBoolean;
    hasPinnedTabs: GleanBoolean;
    homePageSettings: GleanObject;
    isDefaultBrowser: GleanBoolean;
    isDefaultHandler: GleanObject;
    isFirstStartup: GleanBoolean;
    isFxAEnabled: GleanBoolean;
    isFxASignedIn: GleanBoolean;
    isMsix: GleanBoolean;
    locale: GleanString;
    memoryMb: GleanQuantity;
    os: GleanObject;
    primaryResolution: GleanObject;
    profileAgeCreated: GleanQuantity;
    region: GleanString;
    totalBookmarksCount: GleanQuantity;
    userMonthlyActivity: GleanObject;
    userPrefersReducedMotion: GleanBoolean;
    usesFirefoxSync: GleanBoolean;
    version: GleanString;
  };

  nimbusTargetingEnvironment: {
    attrEvalErrors: Record<
      | 'activeExperiments'
      | 'activeRollouts'
      | 'addonsInfo'
      | 'addressesSaved'
      | 'archBits'
      | 'attributionData'
      | 'browserSettings'
      | 'buildId'
      | 'currentDate'
      | 'defaultPDFHandler'
      | 'distributionId'
      | 'doesAppNeedPin'
      | 'enrollmentsMap'
      | 'firefoxVersion'
      | 'hasActiveEnterprisePolicies'
      | 'hasPinnedTabs'
      | 'homePageSettings'
      | 'isDefaultBrowser'
      | 'isDefaultHandler'
      | 'isFirstStartup'
      | 'isFxAEnabled'
      | 'isFxASignedIn'
      | 'isMSIX'
      | 'locale'
      | 'memoryMB'
      | 'os'
      | 'primaryResolution'
      | 'profileAgeCreated'
      | 'region'
      | 'totalBookmarksCount'
      | 'userMonthlyActivity'
      | 'userPrefersReducedMotion'
      | 'usesFirefoxSync'
      | 'version',
      GleanCounter
    >;
    prefTypeErrors: Record<
      | 'browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons'
      | 'browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features'
      | 'browser.newtabpage.activity-stream.feeds.section.highlights'
      | 'browser.newtabpage.activity-stream.feeds.section.topstories'
      | 'browser.newtabpage.activity-stream.feeds.topsites'
      | 'browser.newtabpage.activity-stream.showSearch'
      | 'browser.newtabpage.activity-stream.showSponsoredTopSites'
      | 'browser.newtabpage.enabled'
      | 'browser.startup.page'
      | 'browser.toolbars.bookmarks.visibility'
      | 'browser.urlbar.quicksuggest.dataCollection.enabled'
      | 'browser.urlbar.showSearchSuggestionsFirst'
      | 'browser.urlbar.suggest.quicksuggest.sponsored'
      | 'media.videocontrols.picture-in-picture.enabled'
      | 'media.videocontrols.picture-in-picture.video-toggle.enabled'
      | 'media.videocontrols.picture-in-picture.video-toggle.has-used'
      | 'messaging-system-action.testday'
      | 'network.trr.mode'
      | 'nimbus.qa.pref-1'
      | 'nimbus.qa.pref-2'
      | 'security.sandbox.content.level'
      | 'trailhead.firstrun.didSeeAboutWelcome',
      GleanCounter
    >;
    prefValues: GleanObject;
    targetingContextValue: GleanText;
    userSetPrefs: GleanObject;
  };

  normandy: {
    exposeNimbusExperiment: GleanEventWithExtras<{
      branchSlug?: string;
      featureId?: string;
      value?: string;
    }>;
    enrollAddonRollout: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      experimentType?: string;
      value?: string;
    }>;
    enrollAddonStudy: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      experimentType?: string;
      value?: string;
    }>;
    enrollFailedAddonRollout: GleanEventWithExtras<{
      addonId?: string;
      branch?: string;
      conflictingSlug?: string;
      detail?: string;
      enrollmentId?: string;
      prefBranch?: string;
      preference?: string;
      reason?: string;
      value?: string;
    }>;
    enrollFailedAddonStudy: GleanEventWithExtras<{
      addonId?: string;
      branch?: string;
      conflictingSlug?: string;
      detail?: string;
      enrollmentId?: string;
      prefBranch?: string;
      preference?: string;
      reason?: string;
      value?: string;
    }>;
    enrollFailedNimbusExperiment: GleanEventWithExtras<{
      addonId?: string;
      branch?: string;
      conflictingSlug?: string;
      detail?: string;
      enrollmentId?: string;
      prefBranch?: string;
      preference?: string;
      reason?: string;
      value?: string;
    }>;
    enrollFailedPreferenceRollout: GleanEventWithExtras<{
      addonId?: string;
      branch?: string;
      conflictingSlug?: string;
      detail?: string;
      enrollmentId?: string;
      prefBranch?: string;
      preference?: string;
      reason?: string;
      value?: string;
    }>;
    enrollFailedPreferenceStudy: GleanEventWithExtras<{
      addonId?: string;
      branch?: string;
      conflictingSlug?: string;
      detail?: string;
      enrollmentId?: string;
      prefBranch?: string;
      preference?: string;
      reason?: string;
      value?: string;
    }>;
    enrollNimbusExperiment: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      experimentType?: string;
      value?: string;
    }>;
    enrollPreferenceRollout: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      experimentType?: string;
      value?: string;
    }>;
    enrollPreferenceStudy: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      experimentType?: string;
      value?: string;
    }>;
    expPrefChangedPreferenceStudy: GleanEventWithExtras<{
      enrollmentId?: string;
      preferenceName?: string;
      reason?: string;
      value?: string;
    }>;
    graduatePreferenceRollout: GleanEventWithExtras<{
      enrollmentId?: string;
      reason?: string;
      value?: string;
    }>;
    recipeFreshness: Record<string, GleanQuantity>;
    unenrollAddonRollback: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      changedPref?: string;
      conflictingSlug?: string;
      didResetValue?: string;
      enrollmentId?: string;
      prefName?: string;
      prefType?: string;
      reason?: string;
      value?: string;
    }>;
    unenrollAddonStudy: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      changedPref?: string;
      conflictingSlug?: string;
      didResetValue?: string;
      enrollmentId?: string;
      prefName?: string;
      prefType?: string;
      reason?: string;
      value?: string;
    }>;
    unenrollFailedAddonRollback: GleanEventWithExtras<{
      caller?: string;
      changedPref?: string;
      enrollmentId?: string;
      originalReason?: string;
      reason?: string;
      value?: string;
    }>;
    unenrollFailedNimbusExperiment: GleanEventWithExtras<{
      caller?: string;
      changedPref?: string;
      enrollmentId?: string;
      originalReason?: string;
      reason?: string;
      value?: string;
    }>;
    unenrollFailedPreferenceRollback: GleanEventWithExtras<{
      caller?: string;
      changedPref?: string;
      enrollmentId?: string;
      originalReason?: string;
      reason?: string;
      value?: string;
    }>;
    unenrollFailedPreferenceStudy: GleanEventWithExtras<{
      caller?: string;
      changedPref?: string;
      enrollmentId?: string;
      originalReason?: string;
      reason?: string;
      value?: string;
    }>;
    unenrollNimbusExperiment: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      changedPref?: string;
      conflictingSlug?: string;
      didResetValue?: string;
      enrollmentId?: string;
      prefName?: string;
      prefType?: string;
      reason?: string;
      value?: string;
    }>;
    unenrollPreferenceRollback: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      changedPref?: string;
      conflictingSlug?: string;
      didResetValue?: string;
      enrollmentId?: string;
      prefName?: string;
      prefType?: string;
      reason?: string;
      value?: string;
    }>;
    unenrollPreferenceStudy: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      changedPref?: string;
      conflictingSlug?: string;
      didResetValue?: string;
      enrollmentId?: string;
      prefName?: string;
      prefType?: string;
      reason?: string;
      value?: string;
    }>;
    updateAddonRollout: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      enrollmentId?: string;
      previousState?: string;
      value?: string;
    }>;
    updateAddonStudy: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      enrollmentId?: string;
      previousState?: string;
      value?: string;
    }>;
    updateFailedAddonRollout: GleanEventWithExtras<{
      branch?: string;
      detail?: string;
      enrollmentId?: string;
      reason?: string;
      value?: string;
    }>;
    updateFailedAddonStudy: GleanEventWithExtras<{
      branch?: string;
      detail?: string;
      enrollmentId?: string;
      reason?: string;
      value?: string;
    }>;
    updateNimbusExperiment: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      enrollmentId?: string;
      previousState?: string;
      value?: string;
    }>;
    updatePreferenceRollout: GleanEventWithExtras<{
      addonId?: string;
      addonVersion?: string;
      branch?: string;
      enrollmentId?: string;
      previousState?: string;
      value?: string;
    }>;
    validationFailedNimbusExperiment: GleanEventWithExtras<{
      branch?: string;
      l10n_ids?: string;
      locale?: string;
      reason?: string;
      value?: string;
    }>;
  };

  formAutocomplete: {
    showLogins: GleanEventWithExtras<{
      acFieldName?: string;
      fieldType?: string;
      generatedPasswo?: string;
      hadPrevious?: string;
      importableLogin?: string;
      insecureWarning?: string;
      login?: string;
      loginsFooter?: string;
      stringLength?: string;
      typeWasPassword?: string;
      value?: string;
    }>;
  };

  pwmgr: {
    autocompleteFieldGeneratedpassword: GleanEventNoExtras;
    autocompleteShownGeneratedpassword: GleanEventNoExtras;
    cancelExistingLogin: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    cancelNewLogin: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    copyPassword: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    copyUsername: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    deleteExistingLogin: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    deleteNewLogin: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    doorhangerSubmittedSave: GleanEventWithExtras<{
      did_edit_pw?: string;
      did_edit_un?: string;
      did_select_pw?: string;
      did_select_un?: string;
    }>;
    doorhangerSubmittedUpdate: GleanEventWithExtras<{
      did_edit_pw?: string;
      did_edit_un?: string;
      did_select_pw?: string;
      did_select_un?: string;
    }>;
    editExistingLogin: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    filledFieldEditedGeneratedpassword: GleanEventNoExtras;
    filterList: GleanEventNoExtras;
    formAutofillResult: Record<
      | 'autocomplete_off'
      | 'existing_password'
      | 'existing_username'
      | 'filled'
      | 'filled_username_only_form'
      | 'form_in_crossorigin_subframe'
      | 'insecure'
      | 'multiple_logins'
      | 'no_autofill_forms'
      | 'no_logins_fit'
      | 'no_password_field'
      | 'no_saved_logins'
      | 'password_autocomplete_new_password'
      | 'password_disabled_readonly'
      | 'type_no_longer_password',
      GleanCounter
    >;
    hidePassword: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    importLoginsFromFileCategorical: Record<
      'added' | 'error' | 'modified' | 'no_change',
      GleanCounter
    >;
    isUsernameOnlyForm: Record<'false' | 'true', GleanCounter>;
    learnMoreVulnExistingLogin: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    loginPageSafety: GleanCustomDistribution;
    mgmtMenuItemUsedExport: GleanEventNoExtras;
    mgmtMenuItemUsedExportComplete: GleanEventNoExtras;
    mgmtMenuItemUsedImportCsvComplete: GleanEventNoExtras;
    mgmtMenuItemUsedImportFromBrowser: GleanEventNoExtras;
    mgmtMenuItemUsedImportFromCsv: GleanEventNoExtras;
    mgmtMenuItemUsedPreferences: GleanEventNoExtras;
    migration: GleanEventWithExtras<{ error?: string; value?: string }>;
    newNewLogin: GleanEventNoExtras;
    numImprovedGeneratedPasswords: Record<'false' | 'true', GleanCounter>;
    numSavedPasswords: GleanQuantity;
    openManagementAboutprotections: GleanEventNoExtras;
    openManagementAutocomplete: GleanEventNoExtras;
    openManagementContextmenu: GleanEventNoExtras;
    openManagementDirect: GleanEventNoExtras;
    openManagementMainmenu: GleanEventNoExtras;
    openManagementPageinfo: GleanEventNoExtras;
    openManagementPreferences: GleanEventNoExtras;
    openManagementSnippet: GleanEventNoExtras;
    openSiteExistingLogin: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    osAuthEnabled: GleanBoolean;
    potentiallyBreachedPasswords: GleanQuantity;
    promptRememberAction: GleanCustomDistribution;
    promptShownOsReauth: GleanEventWithExtras<{ result?: string; trigger?: string }>;
    promptUpdateAction: GleanCustomDistribution;
    reauthenticateMasterPassword: GleanEventWithExtras<{
      auto_admin?: string;
      require_signon?: string;
      value?: string;
    }>;
    reauthenticateOsAuth: GleanEventWithExtras<{
      auto_admin?: string;
      require_signon?: string;
      value?: string;
    }>;
    requireOsReauthToggle: GleanEventWithExtras<{ toggle_state?: string }>;
    saveExistingLogin: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    saveNewLogin: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    savedLoginUsedAuthLogin: GleanEventWithExtras<{ filled?: string }>;
    savedLoginUsedFormLogin: GleanEventWithExtras<{ filled?: string }>;
    savedLoginUsedFormPassword: GleanEventWithExtras<{ filled?: string }>;
    savedLoginUsedPromptLogin: GleanEventWithExtras<{ filled?: string }>;
    savingEnabled: GleanBoolean;
    selectExistingLogin: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    showPassword: GleanEventWithExtras<{ breached?: string; vulnerable?: string }>;
    signupFormDetection: GleanTimingDistribution;
    sortList: GleanEventWithExtras<{ sort_key?: string }>;
  };

  relayIntegration: {
    clickedFillUsername: GleanEventWithExtras<{ error_code?: string; value?: string }>;
    clickedOfferRelay: GleanEventWithExtras<{ scenario?: string; value?: string }>;
    disabledOptInPanel: GleanEventWithExtras<{ value?: string }>;
    disabledPrefChange: GleanEventNoExtras;
    enabledOptInPanel: GleanEventWithExtras<{ value?: string }>;
    enabledPrefChange: GleanEventNoExtras;
    getUnlimitedMasksReusePanel: GleanEventWithExtras<{ value?: string }>;
    placedEmailMask: GleanEventWithExtras<{ error_code?: string; value?: string }>;
    postponedOptInPanel: GleanEventWithExtras<{ value?: string }>;
    reuseMaskReusePanel: GleanEventWithExtras<{ value?: string }>;
    shownFillUsername: GleanEventWithExtras<{ error_code?: string; value?: string }>;
    shownOfferRelay: GleanEventWithExtras<{ scenario?: string; value?: string }>;
    shownOptInPanel: GleanEventWithExtras<{ value?: string }>;
    shownReusePanel: GleanEventWithExtras<{ error_code?: string; value?: string }>;
  };

  pdfjs: {
    buttons: Record<
      | 'cursor_hand_tool'
      | 'cursor_select_tool'
      | 'document_properties'
      | 'first_page'
      | 'last_page'
      | 'page_rotate_ccw'
      | 'page_rotate_cw'
      | 'presentation_mode'
      | 'presentation_mode_keyboard'
      | 'scroll_horizontal'
      | 'scroll_page'
      | 'scroll_vertical'
      | 'scroll_wrapped'
      | 'spread_even'
      | 'spread_none'
      | 'spread_odd'
      | 'view_bookmark',
      GleanCounter
    >;
    editing: Record<'freetext' | 'ink' | 'print' | 'save' | 'signature' | 'stamp', GleanCounter>;
    geckoview: Record<
      | 'download_failed'
      | 'download_succeeded'
      | 'download_tapped'
      | 'open_in_app_always'
      | 'open_in_app_just_once'
      | 'open_in_app_tapped'
      | 'save_as_pdf_tapped',
      GleanCounter
    >;
    stamp: Record<
      | 'alt_text_cancel'
      | 'alt_text_decorative'
      | 'alt_text_description'
      | 'alt_text_edit'
      | 'alt_text_keyboard'
      | 'alt_text_save'
      | 'alt_text_tooltip'
      | 'inserted_image',
      GleanCounter
    >;
    timeToView: GleanCustomDistribution;
    used: GleanCounter;
  };

  pdfjsDigitalSignature: {
    certificate: Record<
      | 'adbe_pkcs7_detached'
      | 'adbe_pkcs7_sha1'
      | 'adbe_x509_rsa_sha1'
      | 'etsi_cades_detached'
      | 'etsi_rfc3161'
      | 'unsupported',
      GleanCounter
    >;
  };

  pdfjsEditingHighlight: {
    color: Record<'blue' | 'green' | 'pink' | 'red' | 'yellow', GleanCounter>;
    colorChanged: GleanCounter;
    deleted: GleanCounter;
    edited: GleanCounter;
    kind: Record<'free_highlight' | 'highlight', GleanCounter>;
    method: Record<'context_menu' | 'floating_button' | 'main_toolbar', GleanCounter>;
    numberOfColors: Record<'five' | 'four' | 'one' | 'three' | 'two', GleanCounter>;
    print: GleanCounter;
    save: GleanCounter;
    thickness: GleanCustomDistribution;
    thicknessChanged: GleanCounter;
    toggleVisibility: GleanCounter;
  };

  pdfjsImage: {
    addImageClick: GleanEventNoExtras;
    added: Record<'with_alt_text' | 'without_alt_text', GleanCounter>;
    altTextEdit: Record<'ai_generation' | 'ask_to_edit', GleanBoolean>;
    iconClick: GleanEventNoExtras;
    imageAdded: GleanEventWithExtras<{ alt_text_modal?: string; alt_text_type?: string }>;
    imageSelected: GleanEventWithExtras<{ alt_text_modal?: string }>;
  };

  pdfjsImageAltText: {
    aiGenerationCheck: GleanEventWithExtras<{ status?: string }>;
    calloutDismissed: GleanEventNoExtras;
    calloutDisplayed: GleanEventNoExtras;
    dismiss: GleanEventWithExtras<{ alt_text_type?: string; flow?: string }>;
    imageStatusLabelClicked: GleanEventWithExtras<{ label?: string }>;
    imageStatusLabelDisplayed: GleanEventWithExtras<{ label?: string }>;
    info: GleanEventWithExtras<{ topic?: string }>;
    modelDeleted: GleanEventNoExtras;
    modelDownloadComplete: GleanEventNoExtras;
    modelDownloadError: GleanEventWithExtras<{ error?: string }>;
    modelDownloadStart: GleanEventNoExtras;
    modelResult: GleanEventWithExtras<{ length?: string; time?: string }>;
    save: GleanEventWithExtras<{ alt_text_type?: string; flow?: string }>;
    settingsAiGenerationCheck: GleanEventWithExtras<{ status?: string }>;
    settingsDisplayed: GleanEventNoExtras;
    settingsEditAltTextCheck: GleanEventWithExtras<{ status?: string }>;
    userEdit: GleanEventWithExtras<{
      total_words?: string;
      words_added?: string;
      words_removed?: string;
    }>;
  };

  pdfjsSignature: {
    added: GleanEventWithExtras<{ has_alt_text?: string; has_no_alt_text?: string }>;
    clear: Record<'draw' | 'text' | 'type', GleanCounter>;
    created: GleanEventWithExtras<{
      description_changed?: string;
      saved?: string;
      saved_count?: string;
      type?: string;
    }>;
    deleteSaved: GleanEventWithExtras<{ saved_count?: string }>;
    editDescription: Record<'saved' | 'unsaved', GleanCounter>;
    inserted: GleanEventWithExtras<{ has_been_saved?: string; has_description?: string }>;
  };

  pictureinpicture: {
    backgroundTabPlayingDuration: GleanTimingDistribution;
    closedMethodBrowserCrash: GleanEventNoExtras;
    closedMethodCloseButton: GleanEventNoExtras;
    closedMethodClosePlayerShortcut: GleanEventNoExtras;
    closedMethodContextMenu: GleanEventNoExtras;
    closedMethodForegrounded: GleanEventNoExtras;
    closedMethodFullscreen: GleanEventNoExtras;
    closedMethodPagehide: GleanEventNoExtras;
    closedMethodSetupFailure: GleanEventNoExtras;
    closedMethodShortcut: GleanEventNoExtras;
    closedMethodUnpip: GleanEventNoExtras;
    closedMethodUrlBar: GleanEventNoExtras;
    closedMethodVideoElEmptied: GleanEventNoExtras;
    closedMethodVideoElRemove: GleanEventNoExtras;
    createPlayer: GleanEventWithExtras<{
      ccEnabled?: string;
      height?: string;
      screenX?: string;
      screenY?: string;
      value?: string;
      webVTTSubtitles?: string;
      width?: string;
    }>;
    disrespectDisableUrlBar: GleanEventNoExtras;
    foregroundTabPlayingDuration: GleanTimingDistribution;
    fullscreenPlayer: GleanEventWithExtras<{ enter?: string; value?: string }>;
    mostConcurrentPlayers: GleanQuantity;
    openedMethodAutoPip: GleanEventWithExtras<{
      callout?: string;
      disableDialog?: string;
      firstTimeToggle?: string;
    }>;
    openedMethodContextMenu: GleanEventWithExtras<{
      callout?: string;
      disableDialog?: string;
      firstTimeToggle?: string;
    }>;
    openedMethodShortcut: GleanEventWithExtras<{
      callout?: string;
      disableDialog?: string;
      firstTimeToggle?: string;
    }>;
    openedMethodToggle: GleanEventWithExtras<{
      callout?: string;
      disableDialog?: string;
      firstTimeToggle?: string;
    }>;
    openedMethodUrlBar: GleanEventWithExtras<{
      callout?: string;
      disableDialog?: string;
      firstTimeToggle?: string;
    }>;
    resizePlayer: GleanEventWithExtras<{ height?: string; value?: string; width?: string }>;
    sawToggleToggle: GleanEventWithExtras<{ firstTime?: string }>;
    subtitlesShownSubtitles: GleanEventWithExtras<{ webVTTSubtitles?: string }>;
    toggleEnabled: GleanBoolean;
    windowOpenDuration: GleanTimingDistribution;
  };

  pictureinpictureSettings: {
    disablePlayer: GleanEventNoExtras;
    disableSettings: GleanEventNoExtras;
    enableAutotriggerSettings: GleanEventNoExtras;
    enableSettings: GleanEventNoExtras;
  };

  pageIcon: {
    fitIconCount: GleanCounter;
    smallIconCount: GleanCounter;
  };

  places: {
    annosPagesCount: GleanCustomDistribution;
    backupsBookmarkstree: GleanTimingDistribution;
    backupsDaysfromlast: GleanTimingDistribution;
    backupsTojson: GleanTimingDistribution;
    bookmarksCount: GleanCustomDistribution;
    databaseFaviconsFilesize: GleanMemoryDistribution;
    databaseFilesize: GleanMemoryDistribution;
    databaseSemanticHistoryDefragmentTime: GleanTimingDistribution;
    databaseSemanticHistoryFilesize: GleanMemoryDistribution;
    databaseSemanticHistoryWastedPercentage: GleanQuantity;
    expirationStepsToClean: GleanCustomDistribution;
    exportTohtml: GleanTimingDistribution;
    frecencyRecalcChunkTime: GleanTimingDistribution;
    idleFrecencyDecayTime: GleanTimingDistribution;
    idleMaintenanceTime: GleanTimingDistribution;
    keywordsCount: GleanCustomDistribution;
    maintenanceDaysfromlast: GleanTimingDistribution;
    mostRecentExpiredVisit: GleanTimingDistribution;
    pagesCount: GleanCustomDistribution;
    pagesNeedFrecencyRecalculation: GleanQuantity;
    placesDatabaseCorruptionHandlingStage: Record<string, GleanString>;
    previousdayVisits: GleanQuantity;
    semanticHistoryChunkCalculateTime: GleanTimingDistribution;
    semanticHistoryFindChunksTime: GleanTimingDistribution;
    semanticHistoryMaxChunksCount: GleanQuantity;
    sortedBookmarksPerc: GleanCustomDistribution;
    sponsoredVisitNoTriggeringUrl: GleanCounter;
    taggedBookmarksPerc: GleanCustomDistribution;
    tagsCount: GleanCustomDistribution;
  };

  printing: {
    dialogOpenedViaPreviewTm: GleanCounter;
    dialogViaPreviewCancelledTm: GleanCounter;
    error: Record<
      | 'ABORT'
      | 'FAILURE'
      | 'FALLBACK_PAPER_LIST'
      | 'GFX_PRINTER_COULD_NOT_OPEN_FILE'
      | 'GFX_PRINTER_DOC_IS_BUSY'
      | 'GFX_PRINTER_ENDDOC'
      | 'GFX_PRINTER_NAME_NOT_FOUND'
      | 'GFX_PRINTER_NO_PRINTER_AVAILABLE'
      | 'GFX_PRINTER_STARTDOC'
      | 'GFX_PRINTER_STARTPAGE'
      | 'LAST_USED_PRINTER'
      | 'NOT_AVAILABLE'
      | 'NOT_IMPLEMENTED'
      | 'OUT_OF_MEMORY'
      | 'PAPER_MARGINS'
      | 'PRINTER_LIST'
      | 'PRINTER_PROPERTIES'
      | 'PRINTER_SETTINGS'
      | 'PRINT_DESTINATIONS'
      | 'PRINT_PREVIEW'
      | 'UNEXPECTED'
      | 'UNWRITEABLE_MARGIN',
      GleanCounter
    >;
    previewCancelledTm: GleanCounter;
    previewOpenedTm: GleanCounter;
    settingsChanged: Record<string, GleanCounter>;
    silentPrint: GleanCounter;
    targetType: Record<'pdf_file' | 'pdf_unknown' | 'unknown' | 'xps_file', GleanCounter>;
  };

  power: {
    cpuTimeBogusValues: GleanCounter;
    cpuTimePerProcessTypeMs: Record<
      | 'extension'
      | 'gmplugin'
      | 'gpu'
      | 'parent.active'
      | 'parent.active.playing-audio'
      | 'parent.active.playing-video'
      | 'parent.inactive'
      | 'parent.inactive.playing-audio'
      | 'parent.inactive.playing-video'
      | 'prealloc'
      | 'privilegedabout'
      | 'rdd'
      | 'socket'
      | 'utility'
      | 'web.background'
      | 'web.background-perceivable'
      | 'web.foreground',
      GleanCounter
    >;
    cpuTimePerTrackerTypeMs: Record<
      'ad' | 'analytics' | 'cryptomining' | 'fingerprinting' | 'social' | 'unknown',
      GleanCounter
    >;
    energyPerProcessType: Record<
      | 'extension'
      | 'gmplugin'
      | 'gpu'
      | 'parent.active'
      | 'parent.active.playing-audio'
      | 'parent.active.playing-video'
      | 'parent.inactive'
      | 'parent.inactive.playing-audio'
      | 'parent.inactive.playing-video'
      | 'prealloc'
      | 'privilegedabout'
      | 'rdd'
      | 'socket'
      | 'utility'
      | 'web.background'
      | 'web.background-perceivable'
      | 'web.foreground',
      GleanCounter
    >;
    gpuTimeBogusValues: GleanCounter;
    gpuTimePerProcessTypeMs: Record<
      | 'extension'
      | 'gmplugin'
      | 'gpu'
      | 'parent.active'
      | 'parent.active.playing-audio'
      | 'parent.active.playing-video'
      | 'parent.inactive'
      | 'parent.inactive.playing-audio'
      | 'parent.inactive.playing-video'
      | 'prealloc'
      | 'privilegedabout'
      | 'rdd'
      | 'socket'
      | 'utility'
      | 'web.background'
      | 'web.background-perceivable'
      | 'web.foreground',
      GleanCounter
    >;
    totalCpuTimeMs: GleanCounter;
    totalGpuTimeMs: GleanCounter;
    totalThreadWakeups: GleanCounter;
    wakeupsPerProcessType: Record<
      | 'extension'
      | 'gmplugin'
      | 'gpu'
      | 'parent.active'
      | 'parent.active.playing-audio'
      | 'parent.active.playing-video'
      | 'parent.inactive'
      | 'parent.inactive.playing-audio'
      | 'parent.inactive.playing-video'
      | 'prealloc'
      | 'privilegedabout'
      | 'rdd'
      | 'socket'
      | 'utility'
      | 'web.background'
      | 'web.background-perceivable'
      | 'web.foreground',
      GleanCounter
    >;
  };

  powerBattery: {
    percentageWhenUserActive: GleanCustomDistribution;
  };

  powerCpuMsPerThread: {
    contentBackground: Record<
      | 'androidui'
      | 'asynclogger'
      | 'audioipc'
      | 'audioipc_callback_rpc'
      | 'audioipc_client_callback'
      | 'audioipc_client_rpc'
      | 'audioipc_devicecollection_rpc'
      | 'audioipc_server_callback'
      | 'audioipc_server_rpc'
      | 'backgroundthreadpool'
      | 'bgiothreadpool'
      | 'bgreadurls'
      | 'bhmgr_monitor'
      | 'bhmgr_processor'
      | 'cameras_ipc'
      | 'canvasrenderer'
      | 'capturethread'
      | 'classifier_update'
      | 'com_mta'
      | 'compositor'
      | 'convolverworker'
      | 'cookie'
      | 'cubeboperation'
      | 'datachannel_io'
      | 'dns_resolver'
      | 'dom_worker'
      | 'dom_worklet'
      | 'domcachethread'
      | 'extensionprotocolhandler'
      | 'font_loader'
      | 'fontenumthread'
      | 'fs_broker'
      | 'geckomain'
      | 'gmpthread'
      | 'graphrunner'
      | 'hrtfdatabaseldr'
      | 'html5_parser'
      | 'imagebridgechld'
      | 'imageio'
      | 'indexeddb'
      | 'indexeddb_io'
      | 'initfontlist'
      | 'inotifyeventthread'
      | 'ipc_i_o_child'
      | 'ipc_i_o_parent'
      | 'ipc_launch'
      | 'ipdl_background'
      | 'js_watchdog'
      | 'jump_list'
      | 'libwebrtcmodulethread'
      | 'link_monitor'
      | 'ls_thread'
      | 'mdns_service'
      | 'mediacache'
      | 'mediadecoderstatemachine'
      | 'mediapdecoder'
      | 'mediasupervisor'
      | 'mediatimer'
      | 'mediatrackgrph'
      | 'memorypoller'
      | 'mozstorage'
      | 'mtransport'
      | 'netlink_monitor'
      | 'pacerthread'
      | 'permission'
      | 'playeventsound'
      | 'processhangmon'
      | 'profilerchild'
      | 'proxyresolution'
      | 'quotamanager_io'
      | 'registerfonts'
      | 'remotebackbuffer'
      | 'remotelzystream'
      | 'remvidchild'
      | 'renderer'
      | 'sandboxreporter'
      | 'savescripts'
      | 'socket_thread'
      | 'softwarevsyncthread'
      | 'sqldb_content-prefs_sqlite'
      | 'sqldb_cookies_sqlite'
      | 'sqldb_formhistory_sqlite'
      | 'ssl_cert'
      | 'startupcache'
      | 'streamtrans'
      | 'stylethread'
      | 'swcomposite'
      | 'taskcontroller'
      | 'timer'
      | 'toastbgthread'
      | 'trr_background'
      | 'untrusted_modules'
      | 'url_classifier'
      | 'videocapture'
      | 'vsynciothread'
      | 'webrtccallthread'
      | 'webrtcworker'
      | 'wifi_tickler'
      | 'wincompositor'
      | 'windowsvsyncthread'
      | 'winwindowocclusioncalc'
      | 'worker_launcher'
      | 'wrrenderbackend'
      | 'wrscenebuilder'
      | 'wrscenebuilderlp'
      | 'wrworker'
      | 'wrworkerlp',
      GleanCounter
    >;
    contentForeground: Record<
      | 'androidui'
      | 'asynclogger'
      | 'audioipc'
      | 'audioipc_callback_rpc'
      | 'audioipc_client_callback'
      | 'audioipc_client_rpc'
      | 'audioipc_devicecollection_rpc'
      | 'audioipc_server_callback'
      | 'audioipc_server_rpc'
      | 'backgroundthreadpool'
      | 'bgiothreadpool'
      | 'bgreadurls'
      | 'bhmgr_monitor'
      | 'bhmgr_processor'
      | 'cameras_ipc'
      | 'canvasrenderer'
      | 'capturethread'
      | 'classifier_update'
      | 'com_mta'
      | 'compositor'
      | 'convolverworker'
      | 'cookie'
      | 'cubeboperation'
      | 'datachannel_io'
      | 'dns_resolver'
      | 'dom_worker'
      | 'dom_worklet'
      | 'domcachethread'
      | 'extensionprotocolhandler'
      | 'font_loader'
      | 'fontenumthread'
      | 'fs_broker'
      | 'geckomain'
      | 'gmpthread'
      | 'graphrunner'
      | 'hrtfdatabaseldr'
      | 'html5_parser'
      | 'imagebridgechld'
      | 'imageio'
      | 'indexeddb'
      | 'indexeddb_io'
      | 'initfontlist'
      | 'inotifyeventthread'
      | 'ipc_i_o_child'
      | 'ipc_i_o_parent'
      | 'ipc_launch'
      | 'ipdl_background'
      | 'js_watchdog'
      | 'jump_list'
      | 'libwebrtcmodulethread'
      | 'link_monitor'
      | 'ls_thread'
      | 'mdns_service'
      | 'mediacache'
      | 'mediadecoderstatemachine'
      | 'mediapdecoder'
      | 'mediasupervisor'
      | 'mediatimer'
      | 'mediatrackgrph'
      | 'memorypoller'
      | 'mozstorage'
      | 'mtransport'
      | 'netlink_monitor'
      | 'pacerthread'
      | 'permission'
      | 'playeventsound'
      | 'processhangmon'
      | 'profilerchild'
      | 'proxyresolution'
      | 'quotamanager_io'
      | 'registerfonts'
      | 'remotebackbuffer'
      | 'remotelzystream'
      | 'remvidchild'
      | 'renderer'
      | 'sandboxreporter'
      | 'savescripts'
      | 'socket_thread'
      | 'softwarevsyncthread'
      | 'sqldb_content-prefs_sqlite'
      | 'sqldb_cookies_sqlite'
      | 'sqldb_formhistory_sqlite'
      | 'ssl_cert'
      | 'startupcache'
      | 'streamtrans'
      | 'stylethread'
      | 'swcomposite'
      | 'taskcontroller'
      | 'timer'
      | 'toastbgthread'
      | 'trr_background'
      | 'untrusted_modules'
      | 'url_classifier'
      | 'videocapture'
      | 'vsynciothread'
      | 'webrtccallthread'
      | 'webrtcworker'
      | 'wifi_tickler'
      | 'wincompositor'
      | 'windowsvsyncthread'
      | 'winwindowocclusioncalc'
      | 'worker_launcher'
      | 'wrrenderbackend'
      | 'wrscenebuilder'
      | 'wrscenebuilderlp'
      | 'wrworker'
      | 'wrworkerlp',
      GleanCounter
    >;
    gpuProcess: Record<
      | 'androidui'
      | 'asynclogger'
      | 'audioipc'
      | 'audioipc_callback_rpc'
      | 'audioipc_client_callback'
      | 'audioipc_client_rpc'
      | 'audioipc_devicecollection_rpc'
      | 'audioipc_server_callback'
      | 'audioipc_server_rpc'
      | 'backgroundthreadpool'
      | 'bgiothreadpool'
      | 'bgreadurls'
      | 'bhmgr_monitor'
      | 'bhmgr_processor'
      | 'cameras_ipc'
      | 'canvasrenderer'
      | 'capturethread'
      | 'classifier_update'
      | 'com_mta'
      | 'compositor'
      | 'convolverworker'
      | 'cookie'
      | 'cubeboperation'
      | 'datachannel_io'
      | 'dns_resolver'
      | 'dom_worker'
      | 'dom_worklet'
      | 'domcachethread'
      | 'extensionprotocolhandler'
      | 'font_loader'
      | 'fontenumthread'
      | 'fs_broker'
      | 'geckomain'
      | 'gmpthread'
      | 'graphrunner'
      | 'hrtfdatabaseldr'
      | 'html5_parser'
      | 'imagebridgechld'
      | 'imageio'
      | 'indexeddb'
      | 'indexeddb_io'
      | 'initfontlist'
      | 'inotifyeventthread'
      | 'ipc_i_o_child'
      | 'ipc_i_o_parent'
      | 'ipc_launch'
      | 'ipdl_background'
      | 'js_watchdog'
      | 'jump_list'
      | 'libwebrtcmodulethread'
      | 'link_monitor'
      | 'ls_thread'
      | 'mdns_service'
      | 'mediacache'
      | 'mediadecoderstatemachine'
      | 'mediapdecoder'
      | 'mediasupervisor'
      | 'mediatimer'
      | 'mediatrackgrph'
      | 'memorypoller'
      | 'mozstorage'
      | 'mtransport'
      | 'netlink_monitor'
      | 'pacerthread'
      | 'permission'
      | 'playeventsound'
      | 'processhangmon'
      | 'profilerchild'
      | 'proxyresolution'
      | 'quotamanager_io'
      | 'registerfonts'
      | 'remotebackbuffer'
      | 'remotelzystream'
      | 'remvidchild'
      | 'renderer'
      | 'sandboxreporter'
      | 'savescripts'
      | 'socket_thread'
      | 'softwarevsyncthread'
      | 'sqldb_content-prefs_sqlite'
      | 'sqldb_cookies_sqlite'
      | 'sqldb_formhistory_sqlite'
      | 'ssl_cert'
      | 'startupcache'
      | 'streamtrans'
      | 'stylethread'
      | 'swcomposite'
      | 'taskcontroller'
      | 'timer'
      | 'toastbgthread'
      | 'trr_background'
      | 'untrusted_modules'
      | 'url_classifier'
      | 'videocapture'
      | 'vsynciothread'
      | 'webrtccallthread'
      | 'webrtcworker'
      | 'wifi_tickler'
      | 'wincompositor'
      | 'windowsvsyncthread'
      | 'winwindowocclusioncalc'
      | 'worker_launcher'
      | 'wrrenderbackend'
      | 'wrscenebuilder'
      | 'wrscenebuilderlp'
      | 'wrworker'
      | 'wrworkerlp',
      GleanCounter
    >;
    parentActive: Record<
      | 'androidui'
      | 'asynclogger'
      | 'audioipc'
      | 'audioipc_callback_rpc'
      | 'audioipc_client_callback'
      | 'audioipc_client_rpc'
      | 'audioipc_devicecollection_rpc'
      | 'audioipc_server_callback'
      | 'audioipc_server_rpc'
      | 'backgroundthreadpool'
      | 'bgiothreadpool'
      | 'bgreadurls'
      | 'bhmgr_monitor'
      | 'bhmgr_processor'
      | 'cameras_ipc'
      | 'canvasrenderer'
      | 'capturethread'
      | 'classifier_update'
      | 'com_mta'
      | 'compositor'
      | 'convolverworker'
      | 'cookie'
      | 'cubeboperation'
      | 'datachannel_io'
      | 'dns_resolver'
      | 'dom_worker'
      | 'dom_worklet'
      | 'domcachethread'
      | 'extensionprotocolhandler'
      | 'font_loader'
      | 'fontenumthread'
      | 'fs_broker'
      | 'geckomain'
      | 'gmpthread'
      | 'graphrunner'
      | 'hrtfdatabaseldr'
      | 'html5_parser'
      | 'imagebridgechld'
      | 'imageio'
      | 'indexeddb'
      | 'indexeddb_io'
      | 'initfontlist'
      | 'inotifyeventthread'
      | 'ipc_i_o_child'
      | 'ipc_i_o_parent'
      | 'ipc_launch'
      | 'ipdl_background'
      | 'js_watchdog'
      | 'jump_list'
      | 'libwebrtcmodulethread'
      | 'link_monitor'
      | 'ls_thread'
      | 'mdns_service'
      | 'mediacache'
      | 'mediadecoderstatemachine'
      | 'mediapdecoder'
      | 'mediasupervisor'
      | 'mediatimer'
      | 'mediatrackgrph'
      | 'memorypoller'
      | 'mozstorage'
      | 'mtransport'
      | 'netlink_monitor'
      | 'pacerthread'
      | 'permission'
      | 'playeventsound'
      | 'processhangmon'
      | 'profilerchild'
      | 'proxyresolution'
      | 'quotamanager_io'
      | 'registerfonts'
      | 'remotebackbuffer'
      | 'remotelzystream'
      | 'remvidchild'
      | 'renderer'
      | 'sandboxreporter'
      | 'savescripts'
      | 'socket_thread'
      | 'softwarevsyncthread'
      | 'sqldb_content-prefs_sqlite'
      | 'sqldb_cookies_sqlite'
      | 'sqldb_formhistory_sqlite'
      | 'ssl_cert'
      | 'startupcache'
      | 'streamtrans'
      | 'stylethread'
      | 'swcomposite'
      | 'taskcontroller'
      | 'timer'
      | 'toastbgthread'
      | 'trr_background'
      | 'untrusted_modules'
      | 'url_classifier'
      | 'videocapture'
      | 'vsynciothread'
      | 'webrtccallthread'
      | 'webrtcworker'
      | 'wifi_tickler'
      | 'wincompositor'
      | 'windowsvsyncthread'
      | 'winwindowocclusioncalc'
      | 'worker_launcher'
      | 'wrrenderbackend'
      | 'wrscenebuilder'
      | 'wrscenebuilderlp'
      | 'wrworker'
      | 'wrworkerlp',
      GleanCounter
    >;
    parentInactive: Record<
      | 'androidui'
      | 'asynclogger'
      | 'audioipc'
      | 'audioipc_callback_rpc'
      | 'audioipc_client_callback'
      | 'audioipc_client_rpc'
      | 'audioipc_devicecollection_rpc'
      | 'audioipc_server_callback'
      | 'audioipc_server_rpc'
      | 'backgroundthreadpool'
      | 'bgiothreadpool'
      | 'bgreadurls'
      | 'bhmgr_monitor'
      | 'bhmgr_processor'
      | 'cameras_ipc'
      | 'canvasrenderer'
      | 'capturethread'
      | 'classifier_update'
      | 'com_mta'
      | 'compositor'
      | 'convolverworker'
      | 'cookie'
      | 'cubeboperation'
      | 'datachannel_io'
      | 'dns_resolver'
      | 'dom_worker'
      | 'dom_worklet'
      | 'domcachethread'
      | 'extensionprotocolhandler'
      | 'font_loader'
      | 'fontenumthread'
      | 'fs_broker'
      | 'geckomain'
      | 'gmpthread'
      | 'graphrunner'
      | 'hrtfdatabaseldr'
      | 'html5_parser'
      | 'imagebridgechld'
      | 'imageio'
      | 'indexeddb'
      | 'indexeddb_io'
      | 'initfontlist'
      | 'inotifyeventthread'
      | 'ipc_i_o_child'
      | 'ipc_i_o_parent'
      | 'ipc_launch'
      | 'ipdl_background'
      | 'js_watchdog'
      | 'jump_list'
      | 'libwebrtcmodulethread'
      | 'link_monitor'
      | 'ls_thread'
      | 'mdns_service'
      | 'mediacache'
      | 'mediadecoderstatemachine'
      | 'mediapdecoder'
      | 'mediasupervisor'
      | 'mediatimer'
      | 'mediatrackgrph'
      | 'memorypoller'
      | 'mozstorage'
      | 'mtransport'
      | 'netlink_monitor'
      | 'pacerthread'
      | 'permission'
      | 'playeventsound'
      | 'processhangmon'
      | 'profilerchild'
      | 'proxyresolution'
      | 'quotamanager_io'
      | 'registerfonts'
      | 'remotebackbuffer'
      | 'remotelzystream'
      | 'remvidchild'
      | 'renderer'
      | 'sandboxreporter'
      | 'savescripts'
      | 'socket_thread'
      | 'softwarevsyncthread'
      | 'sqldb_content-prefs_sqlite'
      | 'sqldb_cookies_sqlite'
      | 'sqldb_formhistory_sqlite'
      | 'ssl_cert'
      | 'startupcache'
      | 'streamtrans'
      | 'stylethread'
      | 'swcomposite'
      | 'taskcontroller'
      | 'timer'
      | 'toastbgthread'
      | 'trr_background'
      | 'untrusted_modules'
      | 'url_classifier'
      | 'videocapture'
      | 'vsynciothread'
      | 'webrtccallthread'
      | 'webrtcworker'
      | 'wifi_tickler'
      | 'wincompositor'
      | 'windowsvsyncthread'
      | 'winwindowocclusioncalc'
      | 'worker_launcher'
      | 'wrrenderbackend'
      | 'wrscenebuilder'
      | 'wrscenebuilderlp'
      | 'wrworker'
      | 'wrworkerlp',
      GleanCounter
    >;
  };

  powerWakeupsPerThread: {
    contentBackground: Record<
      | 'androidui'
      | 'asynclogger'
      | 'audioipc'
      | 'audioipc_callback_rpc'
      | 'audioipc_client_callback'
      | 'audioipc_client_rpc'
      | 'audioipc_devicecollection_rpc'
      | 'audioipc_server_callback'
      | 'audioipc_server_rpc'
      | 'backgroundthreadpool'
      | 'bgiothreadpool'
      | 'bgreadurls'
      | 'bhmgr_monitor'
      | 'bhmgr_processor'
      | 'cameras_ipc'
      | 'canvasrenderer'
      | 'capturethread'
      | 'classifier_update'
      | 'com_mta'
      | 'compositor'
      | 'convolverworker'
      | 'cookie'
      | 'cubeboperation'
      | 'datachannel_io'
      | 'dns_resolver'
      | 'dom_worker'
      | 'dom_worklet'
      | 'domcachethread'
      | 'extensionprotocolhandler'
      | 'font_loader'
      | 'fontenumthread'
      | 'fs_broker'
      | 'geckomain'
      | 'gmpthread'
      | 'graphrunner'
      | 'hrtfdatabaseldr'
      | 'html5_parser'
      | 'imagebridgechld'
      | 'imageio'
      | 'indexeddb'
      | 'indexeddb_io'
      | 'initfontlist'
      | 'inotifyeventthread'
      | 'ipc_i_o_child'
      | 'ipc_i_o_parent'
      | 'ipc_launch'
      | 'ipdl_background'
      | 'js_watchdog'
      | 'jump_list'
      | 'libwebrtcmodulethread'
      | 'link_monitor'
      | 'ls_thread'
      | 'mdns_service'
      | 'mediacache'
      | 'mediadecoderstatemachine'
      | 'mediapdecoder'
      | 'mediasupervisor'
      | 'mediatimer'
      | 'mediatrackgrph'
      | 'memorypoller'
      | 'mozstorage'
      | 'mtransport'
      | 'netlink_monitor'
      | 'pacerthread'
      | 'permission'
      | 'playeventsound'
      | 'processhangmon'
      | 'profilerchild'
      | 'proxyresolution'
      | 'quotamanager_io'
      | 'registerfonts'
      | 'remotebackbuffer'
      | 'remotelzystream'
      | 'remvidchild'
      | 'renderer'
      | 'sandboxreporter'
      | 'savescripts'
      | 'socket_thread'
      | 'softwarevsyncthread'
      | 'sqldb_content-prefs_sqlite'
      | 'sqldb_cookies_sqlite'
      | 'sqldb_formhistory_sqlite'
      | 'ssl_cert'
      | 'startupcache'
      | 'streamtrans'
      | 'stylethread'
      | 'swcomposite'
      | 'taskcontroller'
      | 'timer'
      | 'toastbgthread'
      | 'trr_background'
      | 'untrusted_modules'
      | 'url_classifier'
      | 'videocapture'
      | 'vsynciothread'
      | 'webrtccallthread'
      | 'webrtcworker'
      | 'wifi_tickler'
      | 'wincompositor'
      | 'windowsvsyncthread'
      | 'winwindowocclusioncalc'
      | 'worker_launcher'
      | 'wrrenderbackend'
      | 'wrscenebuilder'
      | 'wrscenebuilderlp'
      | 'wrworker'
      | 'wrworkerlp',
      GleanCounter
    >;
    contentForeground: Record<
      | 'androidui'
      | 'asynclogger'
      | 'audioipc'
      | 'audioipc_callback_rpc'
      | 'audioipc_client_callback'
      | 'audioipc_client_rpc'
      | 'audioipc_devicecollection_rpc'
      | 'audioipc_server_callback'
      | 'audioipc_server_rpc'
      | 'backgroundthreadpool'
      | 'bgiothreadpool'
      | 'bgreadurls'
      | 'bhmgr_monitor'
      | 'bhmgr_processor'
      | 'cameras_ipc'
      | 'canvasrenderer'
      | 'capturethread'
      | 'classifier_update'
      | 'com_mta'
      | 'compositor'
      | 'convolverworker'
      | 'cookie'
      | 'cubeboperation'
      | 'datachannel_io'
      | 'dns_resolver'
      | 'dom_worker'
      | 'dom_worklet'
      | 'domcachethread'
      | 'extensionprotocolhandler'
      | 'font_loader'
      | 'fontenumthread'
      | 'fs_broker'
      | 'geckomain'
      | 'gmpthread'
      | 'graphrunner'
      | 'hrtfdatabaseldr'
      | 'html5_parser'
      | 'imagebridgechld'
      | 'imageio'
      | 'indexeddb'
      | 'indexeddb_io'
      | 'initfontlist'
      | 'inotifyeventthread'
      | 'ipc_i_o_child'
      | 'ipc_i_o_parent'
      | 'ipc_launch'
      | 'ipdl_background'
      | 'js_watchdog'
      | 'jump_list'
      | 'libwebrtcmodulethread'
      | 'link_monitor'
      | 'ls_thread'
      | 'mdns_service'
      | 'mediacache'
      | 'mediadecoderstatemachine'
      | 'mediapdecoder'
      | 'mediasupervisor'
      | 'mediatimer'
      | 'mediatrackgrph'
      | 'memorypoller'
      | 'mozstorage'
      | 'mtransport'
      | 'netlink_monitor'
      | 'pacerthread'
      | 'permission'
      | 'playeventsound'
      | 'processhangmon'
      | 'profilerchild'
      | 'proxyresolution'
      | 'quotamanager_io'
      | 'registerfonts'
      | 'remotebackbuffer'
      | 'remotelzystream'
      | 'remvidchild'
      | 'renderer'
      | 'sandboxreporter'
      | 'savescripts'
      | 'socket_thread'
      | 'softwarevsyncthread'
      | 'sqldb_content-prefs_sqlite'
      | 'sqldb_cookies_sqlite'
      | 'sqldb_formhistory_sqlite'
      | 'ssl_cert'
      | 'startupcache'
      | 'streamtrans'
      | 'stylethread'
      | 'swcomposite'
      | 'taskcontroller'
      | 'timer'
      | 'toastbgthread'
      | 'trr_background'
      | 'untrusted_modules'
      | 'url_classifier'
      | 'videocapture'
      | 'vsynciothread'
      | 'webrtccallthread'
      | 'webrtcworker'
      | 'wifi_tickler'
      | 'wincompositor'
      | 'windowsvsyncthread'
      | 'winwindowocclusioncalc'
      | 'worker_launcher'
      | 'wrrenderbackend'
      | 'wrscenebuilder'
      | 'wrscenebuilderlp'
      | 'wrworker'
      | 'wrworkerlp',
      GleanCounter
    >;
    gpuProcess: Record<
      | 'androidui'
      | 'asynclogger'
      | 'audioipc'
      | 'audioipc_callback_rpc'
      | 'audioipc_client_callback'
      | 'audioipc_client_rpc'
      | 'audioipc_devicecollection_rpc'
      | 'audioipc_server_callback'
      | 'audioipc_server_rpc'
      | 'backgroundthreadpool'
      | 'bgiothreadpool'
      | 'bgreadurls'
      | 'bhmgr_monitor'
      | 'bhmgr_processor'
      | 'cameras_ipc'
      | 'canvasrenderer'
      | 'capturethread'
      | 'classifier_update'
      | 'com_mta'
      | 'compositor'
      | 'convolverworker'
      | 'cookie'
      | 'cubeboperation'
      | 'datachannel_io'
      | 'dns_resolver'
      | 'dom_worker'
      | 'dom_worklet'
      | 'domcachethread'
      | 'extensionprotocolhandler'
      | 'font_loader'
      | 'fontenumthread'
      | 'fs_broker'
      | 'geckomain'
      | 'gmpthread'
      | 'graphrunner'
      | 'hrtfdatabaseldr'
      | 'html5_parser'
      | 'imagebridgechld'
      | 'imageio'
      | 'indexeddb'
      | 'indexeddb_io'
      | 'initfontlist'
      | 'inotifyeventthread'
      | 'ipc_i_o_child'
      | 'ipc_i_o_parent'
      | 'ipc_launch'
      | 'ipdl_background'
      | 'js_watchdog'
      | 'jump_list'
      | 'libwebrtcmodulethread'
      | 'link_monitor'
      | 'ls_thread'
      | 'mdns_service'
      | 'mediacache'
      | 'mediadecoderstatemachine'
      | 'mediapdecoder'
      | 'mediasupervisor'
      | 'mediatimer'
      | 'mediatrackgrph'
      | 'memorypoller'
      | 'mozstorage'
      | 'mtransport'
      | 'netlink_monitor'
      | 'pacerthread'
      | 'permission'
      | 'playeventsound'
      | 'processhangmon'
      | 'profilerchild'
      | 'proxyresolution'
      | 'quotamanager_io'
      | 'registerfonts'
      | 'remotebackbuffer'
      | 'remotelzystream'
      | 'remvidchild'
      | 'renderer'
      | 'sandboxreporter'
      | 'savescripts'
      | 'socket_thread'
      | 'softwarevsyncthread'
      | 'sqldb_content-prefs_sqlite'
      | 'sqldb_cookies_sqlite'
      | 'sqldb_formhistory_sqlite'
      | 'ssl_cert'
      | 'startupcache'
      | 'streamtrans'
      | 'stylethread'
      | 'swcomposite'
      | 'taskcontroller'
      | 'timer'
      | 'toastbgthread'
      | 'trr_background'
      | 'untrusted_modules'
      | 'url_classifier'
      | 'videocapture'
      | 'vsynciothread'
      | 'webrtccallthread'
      | 'webrtcworker'
      | 'wifi_tickler'
      | 'wincompositor'
      | 'windowsvsyncthread'
      | 'winwindowocclusioncalc'
      | 'worker_launcher'
      | 'wrrenderbackend'
      | 'wrscenebuilder'
      | 'wrscenebuilderlp'
      | 'wrworker'
      | 'wrworkerlp',
      GleanCounter
    >;
    parentActive: Record<
      | 'androidui'
      | 'asynclogger'
      | 'audioipc'
      | 'audioipc_callback_rpc'
      | 'audioipc_client_callback'
      | 'audioipc_client_rpc'
      | 'audioipc_devicecollection_rpc'
      | 'audioipc_server_callback'
      | 'audioipc_server_rpc'
      | 'backgroundthreadpool'
      | 'bgiothreadpool'
      | 'bgreadurls'
      | 'bhmgr_monitor'
      | 'bhmgr_processor'
      | 'cameras_ipc'
      | 'canvasrenderer'
      | 'capturethread'
      | 'classifier_update'
      | 'com_mta'
      | 'compositor'
      | 'convolverworker'
      | 'cookie'
      | 'cubeboperation'
      | 'datachannel_io'
      | 'dns_resolver'
      | 'dom_worker'
      | 'dom_worklet'
      | 'domcachethread'
      | 'extensionprotocolhandler'
      | 'font_loader'
      | 'fontenumthread'
      | 'fs_broker'
      | 'geckomain'
      | 'gmpthread'
      | 'graphrunner'
      | 'hrtfdatabaseldr'
      | 'html5_parser'
      | 'imagebridgechld'
      | 'imageio'
      | 'indexeddb'
      | 'indexeddb_io'
      | 'initfontlist'
      | 'inotifyeventthread'
      | 'ipc_i_o_child'
      | 'ipc_i_o_parent'
      | 'ipc_launch'
      | 'ipdl_background'
      | 'js_watchdog'
      | 'jump_list'
      | 'libwebrtcmodulethread'
      | 'link_monitor'
      | 'ls_thread'
      | 'mdns_service'
      | 'mediacache'
      | 'mediadecoderstatemachine'
      | 'mediapdecoder'
      | 'mediasupervisor'
      | 'mediatimer'
      | 'mediatrackgrph'
      | 'memorypoller'
      | 'mozstorage'
      | 'mtransport'
      | 'netlink_monitor'
      | 'pacerthread'
      | 'permission'
      | 'playeventsound'
      | 'processhangmon'
      | 'profilerchild'
      | 'proxyresolution'
      | 'quotamanager_io'
      | 'registerfonts'
      | 'remotebackbuffer'
      | 'remotelzystream'
      | 'remvidchild'
      | 'renderer'
      | 'sandboxreporter'
      | 'savescripts'
      | 'socket_thread'
      | 'softwarevsyncthread'
      | 'sqldb_content-prefs_sqlite'
      | 'sqldb_cookies_sqlite'
      | 'sqldb_formhistory_sqlite'
      | 'ssl_cert'
      | 'startupcache'
      | 'streamtrans'
      | 'stylethread'
      | 'swcomposite'
      | 'taskcontroller'
      | 'timer'
      | 'toastbgthread'
      | 'trr_background'
      | 'untrusted_modules'
      | 'url_classifier'
      | 'videocapture'
      | 'vsynciothread'
      | 'webrtccallthread'
      | 'webrtcworker'
      | 'wifi_tickler'
      | 'wincompositor'
      | 'windowsvsyncthread'
      | 'winwindowocclusioncalc'
      | 'worker_launcher'
      | 'wrrenderbackend'
      | 'wrscenebuilder'
      | 'wrscenebuilderlp'
      | 'wrworker'
      | 'wrworkerlp',
      GleanCounter
    >;
    parentInactive: Record<
      | 'androidui'
      | 'asynclogger'
      | 'audioipc'
      | 'audioipc_callback_rpc'
      | 'audioipc_client_callback'
      | 'audioipc_client_rpc'
      | 'audioipc_devicecollection_rpc'
      | 'audioipc_server_callback'
      | 'audioipc_server_rpc'
      | 'backgroundthreadpool'
      | 'bgiothreadpool'
      | 'bgreadurls'
      | 'bhmgr_monitor'
      | 'bhmgr_processor'
      | 'cameras_ipc'
      | 'canvasrenderer'
      | 'capturethread'
      | 'classifier_update'
      | 'com_mta'
      | 'compositor'
      | 'convolverworker'
      | 'cookie'
      | 'cubeboperation'
      | 'datachannel_io'
      | 'dns_resolver'
      | 'dom_worker'
      | 'dom_worklet'
      | 'domcachethread'
      | 'extensionprotocolhandler'
      | 'font_loader'
      | 'fontenumthread'
      | 'fs_broker'
      | 'geckomain'
      | 'gmpthread'
      | 'graphrunner'
      | 'hrtfdatabaseldr'
      | 'html5_parser'
      | 'imagebridgechld'
      | 'imageio'
      | 'indexeddb'
      | 'indexeddb_io'
      | 'initfontlist'
      | 'inotifyeventthread'
      | 'ipc_i_o_child'
      | 'ipc_i_o_parent'
      | 'ipc_launch'
      | 'ipdl_background'
      | 'js_watchdog'
      | 'jump_list'
      | 'libwebrtcmodulethread'
      | 'link_monitor'
      | 'ls_thread'
      | 'mdns_service'
      | 'mediacache'
      | 'mediadecoderstatemachine'
      | 'mediapdecoder'
      | 'mediasupervisor'
      | 'mediatimer'
      | 'mediatrackgrph'
      | 'memorypoller'
      | 'mozstorage'
      | 'mtransport'
      | 'netlink_monitor'
      | 'pacerthread'
      | 'permission'
      | 'playeventsound'
      | 'processhangmon'
      | 'profilerchild'
      | 'proxyresolution'
      | 'quotamanager_io'
      | 'registerfonts'
      | 'remotebackbuffer'
      | 'remotelzystream'
      | 'remvidchild'
      | 'renderer'
      | 'sandboxreporter'
      | 'savescripts'
      | 'socket_thread'
      | 'softwarevsyncthread'
      | 'sqldb_content-prefs_sqlite'
      | 'sqldb_cookies_sqlite'
      | 'sqldb_formhistory_sqlite'
      | 'ssl_cert'
      | 'startupcache'
      | 'streamtrans'
      | 'stylethread'
      | 'swcomposite'
      | 'taskcontroller'
      | 'timer'
      | 'toastbgthread'
      | 'trr_background'
      | 'untrusted_modules'
      | 'url_classifier'
      | 'videocapture'
      | 'vsynciothread'
      | 'webrtccallthread'
      | 'webrtcworker'
      | 'wifi_tickler'
      | 'wincompositor'
      | 'windowsvsyncthread'
      | 'winwindowocclusioncalc'
      | 'worker_launcher'
      | 'wrrenderbackend'
      | 'wrscenebuilder'
      | 'wrscenebuilderlp'
      | 'wrworker'
      | 'wrworkerlp',
      GleanCounter
    >;
  };

  readermode: {
    buttonClick: GleanEventWithExtras<{ label?: string }>;
    downloadResult: GleanCustomDistribution;
    parseResult: GleanCustomDistribution;
    viewOff: GleanEventWithExtras<{
      reader_time?: string;
      scroll_position?: string;
      subcategory?: string;
    }>;
    viewOn: GleanEventWithExtras<{
      reader_time?: string;
      scroll_position?: string;
      subcategory?: string;
    }>;
  };

  brokenSiteReport: {
    breakageCategory: GleanString;
    description: GleanText;
    url: GleanUrl;
  };

  brokenSiteReportBrowserInfo: {
    addons: GleanObject;
    experiments: GleanObject;
  };

  brokenSiteReportBrowserInfoApp: {
    defaultLocales: GleanStringList;
    defaultUseragentString: GleanText;
    fissionEnabled: GleanBoolean;
  };

  brokenSiteReportBrowserInfoGraphics: {
    devicePixelRatio: GleanString;
    devicesJson: GleanText;
    driversJson: GleanText;
    featuresJson: GleanText;
    hasTouchScreen: GleanBoolean;
    monitorsJson: GleanText;
  };

  brokenSiteReportBrowserInfoPrefs: {
    cookieBehavior: GleanQuantity;
    forcedAcceleratedLayers: GleanBoolean;
    globalPrivacyControlEnabled: GleanBoolean;
    installtriggerEnabled: GleanBoolean;
    opaqueResponseBlocking: GleanBoolean;
    resistFingerprintingEnabled: GleanBoolean;
    softwareWebrender: GleanBoolean;
    thirdPartyCookieBlockingEnabled: GleanBoolean;
    thirdPartyCookieBlockingEnabledInPbm: GleanBoolean;
  };

  brokenSiteReportBrowserInfoSecurity: {
    antispyware: GleanStringList;
    antivirus: GleanStringList;
    firewall: GleanStringList;
  };

  brokenSiteReportBrowserInfoSystem: {
    isTablet: GleanBoolean;
    memory: GleanQuantity;
  };

  brokenSiteReportTabInfo: {
    languages: GleanStringList;
    useragentString: GleanText;
  };

  brokenSiteReportTabInfoAntitracking: {
    blockList: GleanString;
    blockedOrigins: GleanStringList;
    btpHasPurgedSite: GleanBoolean;
    etpCategory: GleanString;
    hasMixedActiveContentBlocked: GleanBoolean;
    hasMixedDisplayContentBlocked: GleanBoolean;
    hasTrackingContentBlocked: GleanBoolean;
    isPrivateBrowsing: GleanBoolean;
  };

  brokenSiteReportTabInfoFrameworks: {
    fastclick: GleanBoolean;
    marfeel: GleanBoolean;
    mobify: GleanBoolean;
  };

  webcompatreporting: {
    opened: GleanEventWithExtras<{ source?: string }>;
    reasonDropdown: GleanEventWithExtras<{ setting?: string }>;
    send: GleanEventNoExtras;
    sendMoreInfo: GleanEventNoExtras;
  };

  applicationReputation: {
    binaryArchive: Record<'DmgFile' | 'OtherBinaryFile' | 'RarFile' | 'ZipFile', GleanCounter>;
    binaryType: Record<
      'BinaryFile' | 'MissingFilename' | 'MozNonBinaryFile' | 'NonBinaryFile' | 'UnknownFile',
      GleanCounter
    >;
    local: GleanCustomDistribution;
    reason: Record<
      | 'DPDisabled'
      | 'DangerousHostPrefOff'
      | 'DangerousPrefOff'
      | 'InternalError'
      | 'LocalBlocklist'
      | 'LocalWhitelist'
      | 'NetworkError'
      | 'NonBinaryFile'
      | 'NotSet'
      | 'RemoteLookupDisabled'
      | 'UncommonPrefOff'
      | 'UnwantedPrefOff'
      | 'VerdictDangerous'
      | 'VerdictDangerousHost'
      | 'VerdictSafe'
      | 'VerdictUncommon'
      | 'VerdictUnknown'
      | 'VerdictUnrecognized'
      | 'VerdictUnwanted',
      GleanCounter
    >;
    remoteLookupResponseTime: GleanTimingDistribution;
    remoteLookupTimeout: Record<'false' | 'true', GleanCounter>;
    server: GleanCustomDistribution;
    server2: Record<
      | 'ErrAlreadyConnected'
      | 'ErrConnectionRefused'
      | 'ErrDNSLookupQueue'
      | 'ErrNetInadequate'
      | 'ErrNetInterrupt'
      | 'ErrNetPartial'
      | 'ErrNetReset'
      | 'ErrNetTimeout'
      | 'ErrNotConnected'
      | 'ErrOffline'
      | 'ErrOthers'
      | 'ErrPortAccess'
      | 'ErrProxyConnection'
      | 'ErrUnknownHost'
      | 'ErrUnknownProxyHost'
      | 'FailGetChannel'
      | 'FailGetResponse'
      | 'HTTP1xx'
      | 'HTTP204'
      | 'HTTP2xx'
      | 'HTTP3xx'
      | 'HTTP400'
      | 'HTTP403'
      | 'HTTP404'
      | 'HTTP408'
      | 'HTTP413'
      | 'HTTP4xx'
      | 'HTTP502_504_511'
      | 'HTTP503'
      | 'HTTP505'
      | 'HTTP5xx'
      | 'HTTPOthers'
      | 'ResponseValid',
      GleanCounter
    >;
    serverVerdict: GleanCustomDistribution;
    serverVerdict2: GleanDualLabeledCounter;
    shouldBlock: Record<'false' | 'true', GleanCounter>;
  };

  characteristics: {
    anyPointerType: GleanQuantity;
    audioChannels: GleanQuantity;
    audioFingerprint: GleanQuantity;
    audioFrames: GleanQuantity;
    audioRate: GleanQuantity;
    availHeight: GleanQuantity;
    availWidth: GleanQuantity;
    buildDate: GleanQuantity;
    cameraCount: GleanQuantity;
    canvasDpr: GleanString;
    canvasFeatureStatus: GleanString;
    canvasdata1: GleanString;
    canvasdata10: GleanString;
    canvasdata10software: GleanString;
    canvasdata11Webgl: GleanString;
    canvasdata11Webglsoftware: GleanString;
    canvasdata12Fingerprintjs1: GleanString;
    canvasdata12Fingerprintjs1software: GleanString;
    canvasdata13Fingerprintjs2: GleanString;
    canvasdata13Fingerprintjs2software: GleanString;
    canvasdata1software: GleanString;
    canvasdata2: GleanString;
    canvasdata2software: GleanString;
    canvasdata3: GleanString;
    canvasdata3software: GleanString;
    canvasdata4: GleanString;
    canvasdata4software: GleanString;
    canvasdata5: GleanString;
    canvasdata5software: GleanString;
    canvasdata6: GleanString;
    canvasdata6software: GleanString;
    canvasdata7: GleanString;
    canvasdata7software: GleanString;
    canvasdata8: GleanString;
    canvasdata8software: GleanString;
    canvasdata9: GleanString;
    canvasdata9software: GleanString;
    changedMediaPrefs: GleanString;
    channel: GleanString;
    clientIdentifier: GleanUuid;
    colorAccentcolor: GleanQuantity;
    colorAccentcolortext: GleanQuantity;
    colorCanvas: GleanQuantity;
    colorCanvastext: GleanQuantity;
    colorHighlight: GleanQuantity;
    colorHighlighttext: GleanQuantity;
    colorScheme: GleanQuantity;
    colorSelecteditem: GleanQuantity;
    colorSelecteditemtext: GleanQuantity;
    cpuArch: GleanString;
    cpuModel: GleanString;
    errors: GleanText;
    fontDefaultDefaultGroup: GleanString;
    fontDefaultModified: GleanQuantity;
    fontDefaultWestern: GleanString;
    fontMinimumSizeDefaultGroup: GleanString;
    fontMinimumSizeModified: GleanQuantity;
    fontMinimumSizeWestern: GleanString;
    fontNameListCursiveModified: GleanQuantity;
    fontNameListEmojiModified: GleanBoolean;
    fontNameListMonospaceModified: GleanQuantity;
    fontNameListSansSerifModified: GleanQuantity;
    fontNameListSerifModified: GleanQuantity;
    fontNameMonospaceDefaultGroup: GleanString;
    fontNameMonospaceModified: GleanQuantity;
    fontNameMonospaceWestern: GleanString;
    fontNameSansSerifDefaultGroup: GleanString;
    fontNameSansSerifModified: GleanQuantity;
    fontNameSansSerifWestern: GleanString;
    fontNameSerifDefaultGroup: GleanString;
    fontNameSerifModified: GleanQuantity;
    fontNameSerifWestern: GleanString;
    fontSizeMonospaceDefaultGroup: GleanString;
    fontSizeMonospaceModified: GleanQuantity;
    fontSizeMonospaceWestern: GleanString;
    fontSizeVariableDefaultGroup: GleanString;
    fontSizeVariableModified: GleanQuantity;
    fontSizeVariableWestern: GleanString;
    fontsFpjsAllowlisted: GleanString;
    fontsFpjsNonallowlisted: GleanString;
    fontsVariantAAllowlisted: GleanString;
    fontsVariantANonallowlisted: GleanString;
    fontsVariantBAllowlisted: GleanString;
    fontsVariantBNonallowlisted: GleanString;
    gamepads: GleanStringList;
    gl2ContextType: GleanString;
    gl2ContextTypeSoftware: GleanString;
    gl2Extensions: GleanText;
    gl2ExtensionsRaw: GleanText;
    gl2ExtensionsRawSoftware: GleanText;
    gl2ExtensionsSoftware: GleanText;
    gl2FragmentShader: GleanString;
    gl2FragmentShaderSoftware: GleanString;
    gl2MinimalSource: GleanText;
    gl2MinimalSourceSoftware: GleanText;
    gl2Params: GleanText;
    gl2ParamsExtensions: GleanText;
    gl2ParamsExtensionsSoftware: GleanText;
    gl2ParamsSoftware: GleanText;
    gl2PrecisionFragment: GleanText;
    gl2PrecisionFragmentSoftware: GleanText;
    gl2PrecisionVertex: GleanText;
    gl2PrecisionVertexSoftware: GleanText;
    gl2Renderer: GleanString;
    gl2RendererRaw: GleanString;
    gl2RendererRawSoftware: GleanString;
    gl2RendererSoftware: GleanString;
    gl2Vendor: GleanString;
    gl2VendorRaw: GleanString;
    gl2VendorRawSoftware: GleanString;
    gl2VendorSoftware: GleanString;
    gl2VersionRaw: GleanString;
    gl2VersionRawSoftware: GleanString;
    gl2VertexShader: GleanString;
    gl2VertexShaderSoftware: GleanString;
    glContextType: GleanString;
    glContextTypeSoftware: GleanString;
    glExtensions: GleanText;
    glExtensionsRaw: GleanText;
    glExtensionsRawSoftware: GleanText;
    glExtensionsSoftware: GleanText;
    glFragmentShader: GleanString;
    glFragmentShaderSoftware: GleanString;
    glMinimalSource: GleanText;
    glMinimalSourceSoftware: GleanText;
    glParams: GleanText;
    glParamsExtensions: GleanText;
    glParamsExtensionsSoftware: GleanText;
    glParamsSoftware: GleanText;
    glPrecisionFragment: GleanText;
    glPrecisionFragmentSoftware: GleanText;
    glPrecisionVertex: GleanText;
    glPrecisionVertexSoftware: GleanText;
    glRenderer: GleanString;
    glRendererRaw: GleanString;
    glRendererRawSoftware: GleanString;
    glRendererSoftware: GleanString;
    glVendor: GleanString;
    glVendorRaw: GleanString;
    glVendorRawSoftware: GleanString;
    glVendorSoftware: GleanString;
    glVersionRaw: GleanString;
    glVersionRawSoftware: GleanString;
    glVertexShader: GleanString;
    glVertexShaderSoftware: GleanString;
    groupCount: GleanQuantity;
    groupCountWoSpeakers: GleanQuantity;
    iceOrder: GleanQuantity;
    iceSd: GleanQuantity;
    innerHeight: GleanQuantity;
    innerWidth: GleanQuantity;
    intlLocale: GleanString;
    invertedColors: GleanBoolean;
    jsErrors: GleanText;
    keyboardLayout: GleanString;
    languages: GleanString;
    machineModelName: GleanString;
    mathOps: GleanText;
    mathOpsFdlibm: GleanText;
    mathml1: GleanString;
    mathml10: GleanString;
    mathml2: GleanString;
    mathml3: GleanString;
    mathml4: GleanString;
    mathml5: GleanString;
    mathml6: GleanString;
    mathml7: GleanString;
    mathml8: GleanString;
    mathml9: GleanString;
    maxTouchPoints: GleanQuantity;
    mediaCapabilitiesH264: GleanText;
    mediaCapabilitiesNotEfficient: GleanText;
    mediaCapabilitiesNotSmooth: GleanText;
    mediaCapabilitiesUnsupported: GleanText;
    microphoneCount: GleanQuantity;
    missingFonts: GleanText;
    monochrome: GleanBoolean;
    motionDecimals: GleanQuantity;
    motionFreq: GleanQuantity;
    orientationDecimals: GleanQuantity;
    orientationFreq: GleanQuantity;
    orientationabsDecimals: GleanQuantity;
    orientationabsFreq: GleanQuantity;
    osName: GleanString;
    osVersion: GleanString;
    oscpu: GleanString;
    outerHeight: GleanQuantity;
    outerWidth: GleanQuantity;
    pdfViewer: GleanBoolean;
    pixelRatio: GleanString;
    platform: GleanString;
    pointerHeight: GleanQuantity;
    pointerPressure: GleanString;
    pointerTangentinalPressure: GleanString;
    pointerTiltx: GleanQuantity;
    pointerTilty: GleanQuantity;
    pointerTwist: GleanQuantity;
    pointerType: GleanQuantity;
    pointerWidth: GleanQuantity;
    prefersContrast: GleanQuantity;
    prefersReducedMotion: GleanBoolean;
    prefersReducedTransparency: GleanBoolean;
    prefsBlockPopups: GleanBoolean;
    prefsBrowserDisplayUseDocumentFonts: GleanBoolean;
    prefsGeneralAutoscroll: GleanBoolean;
    prefsGeneralSmoothscroll: GleanBoolean;
    prefsIntlAcceptLanguages: GleanString;
    prefsMediaEmeEnabled: GleanBoolean;
    prefsNetworkCookieCookiebehavior: GleanQuantity;
    prefsOverlayScrollbars: GleanBoolean;
    prefsPrivacyDonottrackheaderEnabled: GleanBoolean;
    prefsPrivacyGlobalprivacycontrolEnabled: GleanBoolean;
    prefsZoomTextOnly: GleanBoolean;
    processorCount: GleanQuantity;
    screenHeight: GleanQuantity;
    screenWidth: GleanQuantity;
    screens: GleanText;
    sizeMode: GleanQuantity;
    speakerCount: GleanQuantity;
    submissionSchema: GleanQuantity;
    systemLocale: GleanString;
    targetFrameRate: GleanQuantity;
    textAntiAliasing: GleanString;
    timezone: GleanString;
    touchRotationAngle: GleanString;
    useDocumentColors: GleanBoolean;
    userAgent: GleanText;
    usingAcceleratedCanvas: GleanBoolean;
    version: GleanString;
    voicesAllSsdeep: GleanString;
    voicesCount: GleanQuantity;
    voicesDefault: GleanString;
    voicesLocalCount: GleanQuantity;
    voicesLocalSsdeep: GleanString;
    voicesNonlocalSsdeep: GleanString;
    voicesSample: GleanText;
    voicesSha1: GleanText;
    wgpuMaxbindgroups: GleanQuantity;
    wgpuMaxbindgroupsplusvertexbuffers: GleanQuantity;
    wgpuMaxbindingsperbindgroup: GleanQuantity;
    wgpuMaxbuffersize: GleanQuantity;
    wgpuMaxcolorattachmentbytespersample: GleanQuantity;
    wgpuMaxcolorattachments: GleanQuantity;
    wgpuMaxcomputeinvocationsperworkgroup: GleanQuantity;
    wgpuMaxcomputeworkgroupsizex: GleanQuantity;
    wgpuMaxcomputeworkgroupsizey: GleanQuantity;
    wgpuMaxcomputeworkgroupsizez: GleanQuantity;
    wgpuMaxcomputeworkgroupsperdimension: GleanQuantity;
    wgpuMaxcomputeworkgroupstoragesize: GleanQuantity;
    wgpuMaxdynamicstoragebuffersperpipelinelayout: GleanQuantity;
    wgpuMaxdynamicuniformbuffersperpipelinelayout: GleanQuantity;
    wgpuMaxinterstageshadervariables: GleanQuantity;
    wgpuMaxsampledtexturespershaderstage: GleanQuantity;
    wgpuMaxsamplerspershaderstage: GleanQuantity;
    wgpuMaxstoragebufferbindingsize: GleanQuantity;
    wgpuMaxstoragebufferspershaderstage: GleanQuantity;
    wgpuMaxstoragetexturespershaderstage: GleanQuantity;
    wgpuMaxtexturearraylayers: GleanQuantity;
    wgpuMaxtexturedimension1d: GleanQuantity;
    wgpuMaxtexturedimension2d: GleanQuantity;
    wgpuMaxtexturedimension3d: GleanQuantity;
    wgpuMaxuniformbufferbindingsize: GleanQuantity;
    wgpuMaxuniformbufferspershaderstage: GleanQuantity;
    wgpuMaxvertexattributes: GleanQuantity;
    wgpuMaxvertexbufferarraystride: GleanQuantity;
    wgpuMaxvertexbuffers: GleanQuantity;
    wgpuMinstoragebufferoffsetalignment: GleanQuantity;
    wgpuMinuniformbufferoffsetalignment: GleanQuantity;
    wgpuMissingFeatures: GleanString;
    zoomCount: GleanQuantity;
  };

  fingerprintingProtection: {
    canvasNoiseCalculateTime2: GleanTimingDistribution;
  };

  browserSearchinit: {
    engineInvalidWebextension: Record<string, GleanQuantity>;
    insecureOpensearchEngineCount: GleanQuantity;
    insecureOpensearchUpdateCount: GleanQuantity;
    secureOpensearchEngineCount: GleanQuantity;
    secureOpensearchUpdateCount: GleanQuantity;
  };

  searchEngineDefault: {
    changed: GleanEventWithExtras<{
      change_reason?: string;
      new_display_name?: string;
      new_engine_id?: string;
      new_load_path?: string;
      new_submission_url?: string;
      previous_engine_id?: string;
    }>;
    displayName: GleanString;
    engineId: GleanString;
    loadPath: GleanString;
    overriddenByThirdParty: GleanBoolean;
    partnerCode: GleanString;
    providerId: GleanString;
    submissionUrl: GleanUrl;
  };

  searchEnginePrivate: {
    changed: GleanEventWithExtras<{
      change_reason?: string;
      new_display_name?: string;
      new_engine_id?: string;
      new_load_path?: string;
      new_submission_url?: string;
      previous_engine_id?: string;
    }>;
    displayName: GleanString;
    engineId: GleanString;
    loadPath: GleanString;
    overriddenByThirdParty: GleanBoolean;
    partnerCode: GleanString;
    providerId: GleanString;
    submissionUrl: GleanUrl;
  };

  searchService: {
    initializationStatus: Record<
      | 'failedFetchEngines'
      | 'failedLoadEngines'
      | 'failedLoadSettingsAddonManager'
      | 'failedSettings'
      | 'settingsCorrupt'
      | 'success',
      GleanCounter
    >;
    startupTime: GleanTimingDistribution;
  };

  searchSuggestions: {
    abortedRequests: Record<string, GleanCounter>;
    failedRequests: Record<string, GleanCounter>;
    latency: Record<string, GleanTimingDistribution>;
    successfulRequests: Record<string, GleanCounter>;
  };

  searchSuggestionsOhttp: {
    enabled: GleanBoolean;
    latency: Record<string, GleanTimingDistribution>;
    requestCounter: GleanDualLabeledCounter;
  };

  legacyTelemetry: {
    clientId: GleanUuid;
    profileGroupId: GleanUuid;
    sessionId: GleanUuid;
    sessionStartDate: GleanDatetime;
  };

  onboardingOptOut: {
    activeExperiments: GleanObject;
    activeRollouts: GleanObject;
    enrollmentsMap: GleanObject;
  };

  startupIo: {
    read: Record<'sessionRestore' | 'windowVisible', GleanQuantity>;
    write: Record<'sessionRestore' | 'windowVisible', GleanQuantity>;
  };

  telemetry: {
    archiveCheckingOverQuota: GleanTimingDistribution;
    archiveDirectoriesCount: GleanCustomDistribution;
    archiveEvictedOldDirs: GleanCustomDistribution;
    archiveEvictedOverQuota: GleanCustomDistribution;
    archiveEvictingDirs: GleanTimingDistribution;
    archiveEvictingOverQuota: GleanTimingDistribution;
    archiveOldestDirectoryAge: GleanCustomDistribution;
    archiveScanPingCount: GleanCustomDistribution;
    archiveSessionPingCount: GleanCounter;
    archiveSize: GleanMemoryDistribution;
    compress: GleanTimingDistribution;
    dataUploadOptin: GleanBoolean;
    discardedArchivedPingsSize: GleanMemoryDistribution;
    discardedPendingPingsSize: GleanMemoryDistribution;
    discardedSendPingsSize: GleanMemoryDistribution;
    eventPingSent: Record<'max' | 'periodic' | 'shutdown', GleanCounter>;
    eventRecordingError: Record<
      'Expired' | 'Extra' | 'ExtraKey' | 'UnknownEvent' | 'Value',
      GleanCounter
    >;
    eventRegistrationError: Record<
      'Category' | 'ExtraKeys' | 'Method' | 'Name' | 'Object' | 'Other',
      GleanCounter
    >;
    invalidPayloadSubmitted: GleanCounter;
    invalidPingTypeSubmitted: Record<string, GleanCounter>;
    pendingCheckingOverQuota: GleanTimingDistribution;
    pendingEvictingOverQuota: GleanTimingDistribution;
    pendingLoadFailureParse: GleanCounter;
    pendingLoadFailureRead: GleanCounter;
    pendingPingsAge: GleanTimingDistribution;
    pendingPingsEvictedOverQuota: GleanCustomDistribution;
    pendingPingsSize: GleanMemoryDistribution;
    pingEvictedForServerErrors: GleanCounter;
    pingSizeExceededArchived: GleanCounter;
    pingSizeExceededPending: GleanCounter;
    pingSizeExceededSend: GleanCounter;
    pingSubmissionWaitingClientid: GleanCounter;
    sendFailure: GleanTimingDistribution;
    sendFailureType: Record<
      | 'abort'
      | 'eChannelOpen'
      | 'eOK'
      | 'eRedirect'
      | 'eRequest'
      | 'eTerminated'
      | 'eTooLate'
      | 'eUnreachable'
      | 'timeout',
      GleanCounter
    >;
    sendFailureTypePerPing: GleanDualLabeledCounter;
    sendSuccess: GleanTimingDistribution;
    stringify: GleanTimingDistribution;
    success: Record<'false' | 'true', GleanCounter>;
  };

  termsofuse: {
    date: GleanDatetime;
    version: GleanQuantity;
  };

  thirdPartyModules: {
    blockedModules: GleanStringList;
    modules: GleanObject;
    processes: GleanObject;
  };

  usage: {
    appBuild: GleanString;
    appChannel: GleanString;
    appDisplayVersion: GleanString;
    distributionId: GleanString;
    firstRunDate: GleanDatetime;
    isDefaultBrowser: GleanBoolean;
    os: GleanString;
    osVersion: GleanString;
    profileGroupId: GleanUuid;
    profileId: GleanUuid;
    reason: GleanString;
    windowsBackupEnabled: GleanBoolean;
    windowsBuildNumber: GleanQuantity;
    windowsUserProfileAgeInDays: GleanQuantity;
  };

  telemetryTest: {
    test1Object1: GleanEventWithExtras<{ key1?: string; key2?: string; value?: string }>;
    test2Object1: GleanEventWithExtras<{ key1?: string; key2?: string; value?: string }>;
    test2Object2: GleanEventWithExtras<{ key1?: string; key2?: string; value?: string }>;
  };

  thumbnails: {
    captureCanvasDrawTime: GleanTimingDistribution;
    captureDoneReason2: GleanCustomDistribution;
    capturePageLoadTime: GleanTimingDistribution;
    captureQueueTime: GleanTimingDistribution;
    captureTime: GleanTimingDistribution;
    queueSizeOnCapture: GleanCustomDistribution;
    storeTime: GleanTimingDistribution;
  };

  translations: {
    enginePerformance: GleanEventWithExtras<{
      average_words_per_request?: string;
      average_words_per_second?: string;
      flow_id?: string;
      from_language?: string;
      to_language?: string;
      total_completed_requests?: string;
      total_inference_seconds?: string;
      total_translated_words?: string;
    }>;
    error: GleanEventWithExtras<{ flow_id?: string; reason?: string }>;
    requestCount: Record<'full_page' | 'select', GleanCounter>;
    restorePage: GleanEventWithExtras<{ flow_id?: string }>;
    translationRequest: GleanEventWithExtras<{
      auto_translate?: string;
      document_language?: string;
      flow_id?: string;
      from_language?: string;
      request_target?: string;
      source_text_code_units?: string;
      source_text_word_count?: string;
      to_language?: string;
      top_preferred_language?: string;
    }>;
  };

  translationsAboutTranslationsPage: {
    open: GleanEventWithExtras<{ flow_id?: string }>;
  };

  translationsPanel: {
    aboutTranslations: GleanEventWithExtras<{ flow_id?: string }>;
    alwaysOfferTranslations: GleanEventWithExtras<{ flow_id?: string; toggled_on?: string }>;
    alwaysTranslateLanguage: GleanEventWithExtras<{
      flow_id?: string;
      language?: string;
      toggled_on?: string;
    }>;
    cancelButton: GleanEventWithExtras<{ flow_id?: string }>;
    changeFromLanguage: GleanEventWithExtras<{ flow_id?: string; language?: string }>;
    changeSourceLanguageButton: GleanEventWithExtras<{ flow_id?: string }>;
    changeToLanguage: GleanEventWithExtras<{ flow_id?: string; language?: string }>;
    close: GleanEventWithExtras<{ flow_id?: string }>;
    closeFromLanguageMenu: GleanEventWithExtras<{ flow_id?: string }>;
    closeSettingsMenu: GleanEventWithExtras<{ flow_id?: string }>;
    closeToLanguageMenu: GleanEventWithExtras<{ flow_id?: string }>;
    dismissErrorButton: GleanEventWithExtras<{ flow_id?: string }>;
    learnMore: GleanEventWithExtras<{ flow_id?: string }>;
    manageLanguages: GleanEventWithExtras<{ flow_id?: string }>;
    neverTranslateLanguage: GleanEventWithExtras<{
      flow_id?: string;
      language?: string;
      toggled_on?: string;
    }>;
    neverTranslateSite: GleanEventWithExtras<{ flow_id?: string; toggled_on?: string }>;
    open: GleanEventWithExtras<{
      auto_show?: string;
      document_language?: string;
      flow_id?: string;
      opened_from?: string;
      view_name?: string;
    }>;
    openFromLanguageMenu: GleanEventWithExtras<{ flow_id?: string }>;
    openSettingsMenu: GleanEventWithExtras<{ flow_id?: string }>;
    openToLanguageMenu: GleanEventWithExtras<{ flow_id?: string }>;
    restorePageButton: GleanEventWithExtras<{ flow_id?: string }>;
    translateButton: GleanEventWithExtras<{ flow_id?: string }>;
  };

  translationsSelectTranslationsPanel: {
    aboutTranslations: GleanEventWithExtras<{ flow_id?: string }>;
    cancelButton: GleanEventWithExtras<{ flow_id?: string }>;
    changeFromLanguage: GleanEventWithExtras<{
      document_language?: string;
      flow_id?: string;
      language?: string;
      previous_language?: string;
    }>;
    changeToLanguage: GleanEventWithExtras<{ flow_id?: string; language?: string }>;
    close: GleanEventWithExtras<{ flow_id?: string }>;
    copyButton: GleanEventWithExtras<{ flow_id?: string }>;
    doneButton: GleanEventWithExtras<{ flow_id?: string }>;
    initializationFailureMessage: GleanEventWithExtras<{ flow_id?: string }>;
    open: GleanEventWithExtras<{
      document_language?: string;
      flow_id?: string;
      from_language?: string;
      text_source?: string;
      to_language?: string;
      top_preferred_language?: string;
    }>;
    openSettingsMenu: GleanEventWithExtras<{ flow_id?: string }>;
    translateButton: GleanEventWithExtras<{
      detected_language?: string;
      flow_id?: string;
      from_language?: string;
      to_language?: string;
    }>;
    translateFullPageButton: GleanEventWithExtras<{ flow_id?: string }>;
    translationFailureMessage: GleanEventWithExtras<{
      flow_id?: string;
      from_language?: string;
      to_language?: string;
    }>;
    translationSettings: GleanEventWithExtras<{ flow_id?: string }>;
    tryAgainButton: GleanEventWithExtras<{ flow_id?: string }>;
    unsupportedLanguageMessage: GleanEventWithExtras<{
      detected_language?: string;
      document_language?: string;
      flow_id?: string;
    }>;
  };

  urlclassifier: {
    asyncClassifylocalTime: GleanTimingDistribution;
    clCheckTime: GleanTimingDistribution;
    clKeyedUpdateTime: Record<string, GleanTimingDistribution>;
    completeRemoteStatus2: Record<string, GleanCustomDistribution>;
    completeServerResponseTime: Record<string, GleanTimingDistribution>;
    completeTimeout: GleanDualLabeledCounter;
    completion: GleanEventWithExtras<{ hit?: string; table_name?: string }>;
    completionError: GleanCustomDistribution;
    lookupHit: Record<
      | 'ads-track-digest256'
      | 'analytics-track-digest256'
      | 'anti-fraud-track-digest256'
      | 'base-cryptomining-track-digest256'
      | 'base-email-track-digest256'
      | 'base-fingerprinting-track-digest256'
      | 'base-track-digest256'
      | 'consent-manager-track-digest256'
      | 'content-cryptomining-track-digest256'
      | 'content-email-track-digest256'
      | 'content-fingerprinting-track-digest256'
      | 'content-track-digest256'
      | 'goog-badbinurl-proto'
      | 'goog-downloadwhite-proto'
      | 'goog-harmful-proto'
      | 'goog-malware-proto'
      | 'goog-phish-proto'
      | 'goog-unwanted-proto'
      | 'google-trackwhite-digest256'
      | 'googpub-phish-proto'
      | 'mozplugin-block-digest256'
      | 'mozstd-trackwhite-digest256'
      | 'social-track-digest256'
      | 'social-tracking-protection-digest256'
      | 'social-tracking-protection-facebook-digest256'
      | 'social-tracking-protection-linkedin-digest256'
      | 'social-tracking-protection-twitter-digest256'
      | 'test-malware-simple'
      | 'test-unwanted-simple',
      GleanCounter
    >;
    lookupMiss: Record<
      | 'ads-track-digest256'
      | 'analytics-track-digest256'
      | 'anti-fraud-track-digest256'
      | 'base-cryptomining-track-digest256'
      | 'base-email-track-digest256'
      | 'base-fingerprinting-track-digest256'
      | 'base-track-digest256'
      | 'consent-manager-track-digest256'
      | 'content-cryptomining-track-digest256'
      | 'content-email-track-digest256'
      | 'content-fingerprinting-track-digest256'
      | 'content-track-digest256'
      | 'goog-badbinurl-proto'
      | 'goog-downloadwhite-proto'
      | 'goog-harmful-proto'
      | 'goog-malware-proto'
      | 'goog-phish-proto'
      | 'goog-unwanted-proto'
      | 'google-trackwhite-digest256'
      | 'googpub-phish-proto'
      | 'mozplugin-block-digest256'
      | 'mozstd-trackwhite-digest256'
      | 'social-track-digest256'
      | 'social-tracking-protection-digest256'
      | 'social-tracking-protection-facebook-digest256'
      | 'social-tracking-protection-linkedin-digest256'
      | 'social-tracking-protection-twitter-digest256'
      | 'test-malware-simple'
      | 'test-unwanted-simple',
      GleanCounter
    >;
    lookupTime2: GleanTimingDistribution;
    shutdownTime: GleanTimingDistribution;
    threathitNetworkError: GleanCustomDistribution;
    threathitRemoteStatus: GleanCustomDistribution;
    uiEvents: GleanCustomDistribution;
    updateError: Record<string, GleanCustomDistribution>;
    updateRemoteNetworkError: Record<string, GleanCustomDistribution>;
    updateRemoteStatus2: Record<string, GleanCustomDistribution>;
    updateServerResponseTime: Record<string, GleanTimingDistribution>;
    updateTimeout: Record<string, GleanCustomDistribution>;
    vlpsConstructTime: GleanTimingDistribution;
    vlpsFallocateTime: GleanTimingDistribution;
    vlpsFileloadTime: GleanTimingDistribution;
    vlpsMetadataCorrupt: Record<'false' | 'true', GleanCounter>;
  };

  findbar: {
    findNext: GleanCounter;
    findPrev: GleanCounter;
    highlightAll: GleanCounter;
    matchCase: GleanCounter;
    matchDiacritics: GleanCounter;
    shown: GleanCounter;
    wholeWords: GleanCounter;
  };

  securityDohNeterror: {
    clickAddExceptionButton: GleanEventWithExtras<{
      mode?: string;
      provider_key?: string;
      skip_reason?: string;
      value?: string;
    }>;
    clickContinueButton: GleanEventWithExtras<{
      mode?: string;
      provider_key?: string;
      skip_reason?: string;
      value?: string;
    }>;
    clickDisableWarning: GleanEventWithExtras<{
      mode?: string;
      provider_key?: string;
      skip_reason?: string;
      value?: string;
    }>;
    clickLearnMoreLink: GleanEventWithExtras<{
      mode?: string;
      provider_key?: string;
      skip_reason?: string;
      value?: string;
    }>;
    clickSettingsButton: GleanEventWithExtras<{
      mode?: string;
      provider_key?: string;
      skip_reason?: string;
      value?: string;
    }>;
    clickTryAgainButton: GleanEventWithExtras<{
      mode?: string;
      provider_key?: string;
      skip_reason?: string;
      value?: string;
    }>;
    loadDohwarning: GleanEventWithExtras<{
      mode?: string;
      provider_key?: string;
      skip_reason?: string;
      value?: string;
    }>;
  };

  securityUiCerterror: {
    clickAdvancedButton: GleanEventWithExtras<{
      has_sts?: string;
      is_frame?: string;
      value?: string;
    }>;
    clickAutoReportCb: GleanEventWithExtras<{
      has_sts?: string;
      is_frame?: string;
      value?: string;
    }>;
    clickClipboardButtonBot: GleanEventWithExtras<{
      has_sts?: string;
      is_frame?: string;
      value?: string;
    }>;
    clickClipboardButtonTop: GleanEventWithExtras<{
      has_sts?: string;
      is_frame?: string;
      value?: string;
    }>;
    clickErrorCodeLink: GleanEventWithExtras<{
      has_sts?: string;
      is_frame?: string;
      value?: string;
    }>;
    clickExceptionButton: GleanEventWithExtras<{
      has_sts?: string;
      is_frame?: string;
      value?: string;
    }>;
    clickLearnMoreLink: GleanEventWithExtras<{
      has_sts?: string;
      is_frame?: string;
      value?: string;
    }>;
    clickReturnButtonAdv: GleanEventWithExtras<{
      has_sts?: string;
      is_frame?: string;
      value?: string;
    }>;
    clickReturnButtonTop: GleanEventWithExtras<{
      has_sts?: string;
      is_frame?: string;
      value?: string;
    }>;
    loadAboutcerterror: GleanEventWithExtras<{
      channel_status?: string;
      has_sts?: string;
      is_frame?: string;
      issued_by_cca?: string;
      value?: string;
    }>;
  };

  securityUiTlserror: {
    loadAbouttlserror: GleanEventWithExtras<{
      channel_status?: string;
      is_frame?: string;
      value?: string;
    }>;
  };

  mozstorage: {
    sqlitejsmTransactionTimeout: Record<string, GleanCounter>;
  };

  region: {
    fetchResult: GleanCustomDistribution;
    fetchTime: GleanTimingDistribution;
    homeRegion: GleanString;
    storeRegionResult: Record<
      'ignoredUnitedStatesIncorrectTimezone' | 'setForRestOfWorld' | 'setForUnitedStates',
      GleanCounter
    >;
  };

  firstStartup: {
    deleteTasksTime: GleanQuantity;
    elapsed: GleanQuantity;
    newProfile: GleanBoolean;
    normandyInitTime: GleanQuantity;
    statusCode: GleanQuantity;
  };

  jsonfile: {
    loadAutofillprofiles: GleanEventWithExtras<{ value?: string }>;
    loadLogins: GleanEventWithExtras<{ value?: string }>;
  };

  newtabPage: {
    blockedSitesCount: GleanCustomDistribution;
    pinnedSitesCount: GleanCustomDistribution;
  };

  popupNotification: {
    dismissal: Record<string, GleanTimingDistribution>;
    mainAction: Record<string, GleanTimingDistribution>;
    stats: Record<string, GleanCustomDistribution>;
  };

  serviceRequest: {
    bypassProxyInfo: GleanEventWithExtras<{ source?: string; type?: string; value?: string }>;
  };

  defaultagent: {
    daysSinceLastAppLaunch: GleanQuantity;
  };

  notification: {
    action: GleanString;
    showSuccess: GleanBoolean;
  };

  system: {
    osVersion: GleanString;
    previousOsVersion: GleanString;
    appleModelId: GleanString;
    hasWinPackageId: GleanBoolean;
    isWow64: GleanBoolean;
    isWowArm64: GleanBoolean;
    memory: GleanQuantity;
    virtualMemory: GleanQuantity;
    winPackageFamilyName: GleanString;
  };

  systemDefault: {
    browser: GleanString;
    pdfHandler: GleanString;
    previousBrowser: GleanString;
  };

  addons: {
    activeAddons: GleanObject;
    activeGMPlugins: GleanObject;
    theme: GleanObject;
  };

  addonsManager: {
    compatibilityCheckEnabled: GleanBoolean;
    exception: GleanObject;
    install: GleanEventWithExtras<{
      addon_id?: string;
      addon_type?: string;
      download_time?: string;
      error?: string;
      install_id?: string;
      install_origins?: string;
      num_strings?: string;
      source?: string;
      source_method?: string;
      step?: string;
      updated_from?: string;
    }>;
    installStats: GleanEventWithExtras<{
      addon_id?: string;
      addon_type?: string;
      hashed_addon_id?: string;
      taar_based?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_medium?: string;
      utm_source?: string;
    }>;
    manage: GleanEventWithExtras<{
      addon_id?: string;
      addon_type?: string;
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      source_method?: string;
    }>;
    reportSuspiciousSite: GleanEventWithExtras<{ suspicious_site?: string }>;
    startupTimeline: Record<
      | 'AMI_startup_begin'
      | 'AMI_startup_end'
      | 'XPI_bootstrap_addons_begin'
      | 'XPI_bootstrap_addons_end'
      | 'XPI_finalUIStartup'
      | 'XPI_startup_begin'
      | 'XPI_startup_end',
      GleanQuantity
    >;
    update: GleanEventWithExtras<{
      addon_id?: string;
      addon_type?: string;
      download_time?: string;
      error?: string;
      install_id?: string;
      install_origins?: string;
      num_strings?: string;
      source?: string;
      source_method?: string;
      step?: string;
      updated_from?: string;
    }>;
    xpistatesWriteErrors: GleanEventWithExtras<{ error_type?: string; profile_state?: string }>;
    disableDictionary: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    disableExtension: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    disableLocale: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    disableOther: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    disableSitepermDeprecated: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    disableSitepermission: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    disableTheme: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    disableUnknown: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    enableDictionary: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    enableExtension: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    enableLocale: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    enableOther: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    enableSitepermDeprecated: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    enableSitepermission: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    enableTheme: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    enableUnknown: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    installDictionary: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    installExtension: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    installLocale: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    installOther: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    installSitepermDeprecated: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    installSitepermission: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    installStatsDictionary: GleanEventWithExtras<{
      addon_id?: string;
      taar_based?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_medium?: string;
      utm_source?: string;
      value?: string;
    }>;
    installStatsExtension: GleanEventWithExtras<{
      addon_id?: string;
      taar_based?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_medium?: string;
      utm_source?: string;
      value?: string;
    }>;
    installStatsLocale: GleanEventWithExtras<{
      addon_id?: string;
      taar_based?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_medium?: string;
      utm_source?: string;
      value?: string;
    }>;
    installStatsOther: GleanEventWithExtras<{
      addon_id?: string;
      taar_based?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_medium?: string;
      utm_source?: string;
      value?: string;
    }>;
    installStatsSitepermDeprecated: GleanEventWithExtras<{
      addon_id?: string;
      taar_based?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_medium?: string;
      utm_source?: string;
      value?: string;
    }>;
    installStatsSitepermission: GleanEventWithExtras<{
      addon_id?: string;
      taar_based?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_medium?: string;
      utm_source?: string;
      value?: string;
    }>;
    installStatsTheme: GleanEventWithExtras<{
      addon_id?: string;
      taar_based?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_medium?: string;
      utm_source?: string;
      value?: string;
    }>;
    installStatsUnknown: GleanEventWithExtras<{
      addon_id?: string;
      taar_based?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_medium?: string;
      utm_source?: string;
      value?: string;
    }>;
    installTheme: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    installUnknown: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    sideloadPromptDictionary: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    sideloadPromptExtension: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    sideloadPromptLocale: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    sideloadPromptOther: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    sideloadPromptSitepermDeprecated: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    sideloadPromptSitepermission: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    sideloadPromptTheme: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    sideloadPromptUnknown: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    uninstallDictionary: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    uninstallExtension: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    uninstallLocale: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    uninstallOther: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    uninstallSitepermDeprecated: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    uninstallSitepermission: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    uninstallTheme: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    uninstallUnknown: GleanEventWithExtras<{
      blocklist_state?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      value?: string;
    }>;
    updateDictionary: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    updateExtension: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    updateLocale: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    updateOther: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    updateSitepermDeprecated: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    updateSitepermission: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    updateTheme: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
    updateUnknown: GleanEventWithExtras<{
      addon_id?: string;
      download_time?: string;
      error?: string;
      install_origins?: string;
      method?: string;
      num_strings?: string;
      source?: string;
      step?: string;
      updated_from?: string;
      value?: string;
    }>;
  };

  blocklist: {
    addonBlockChange: GleanEventWithExtras<{
      addon_version?: string;
      blocklist_state?: string;
      hours_since?: string;
      mlbf_generation?: string;
      mlbf_last_time?: string;
      mlbf_softblocks_generation?: string;
      mlbf_softblocks_source?: string;
      mlbf_source?: string;
      object?: string;
      signed_date?: string;
      value?: string;
    }>;
    enabled: GleanBoolean;
    lastModifiedRsAddonsMblf: GleanDatetime;
    mlbfGenerationTime: GleanDatetime;
    mlbfSoftblocksGenerationTime: GleanDatetime;
    mlbfSoftblocksSource: GleanString;
    mlbfSource: GleanString;
    mlbfStashTimeNewest: GleanDatetime;
    mlbfStashTimeOldest: GleanDatetime;
  };

  xpiDatabase: {
    lateLoad: GleanText;
    lateStack: GleanText;
    parses: GleanTimingDistribution;
    rebuilds: Record<
      'XPIDB_rebuildBadJSON_MS' | 'XPIDB_rebuildReadFailed_MS' | 'XPIDB_rebuildUnreadableDB_MS',
      GleanTimingDistribution
    >;
    startupError: GleanString;
    startupLoadReasons: GleanStringList;
    syncStack: GleanText;
  };

  update: {
    autoDownload: GleanBoolean;
    backgroundUpdate: GleanBoolean;
    canUsuallyApplyUpdates: GleanBoolean;
    canUsuallyCheckForUpdates: GleanBoolean;
    canUsuallyStageUpdates: GleanBoolean;
    canUsuallyUseBits: GleanBoolean;
    channel: GleanString;
    enabled: GleanBoolean;
    serviceEnabled: GleanBoolean;
    bitsResultComplete: GleanCustomDistribution;
    bitsResultPartial: GleanCustomDistribution;
    canUseBitsExternal: Record<
      | 'CanUseBits'
      | 'NoBits_FeatureOff'
      | 'NoBits_NotWindows'
      | 'NoBits_OtherUser'
      | 'NoBits_Pref'
      | 'NoBits_Proxy',
      GleanCounter
    >;
    canUseBitsNotify: Record<
      | 'CanUseBits'
      | 'NoBits_FeatureOff'
      | 'NoBits_NotWindows'
      | 'NoBits_OtherUser'
      | 'NoBits_Pref'
      | 'NoBits_Proxy',
      GleanCounter
    >;
    canUseBitsSubsequent: Record<
      | 'CanUseBits'
      | 'NoBits_FeatureOff'
      | 'NoBits_NotWindows'
      | 'NoBits_OtherUser'
      | 'NoBits_Pref'
      | 'NoBits_Proxy',
      GleanCounter
    >;
    cannotStageExternal: GleanCounter;
    cannotStageNotify: GleanCounter;
    cannotStageSubsequent: GleanCounter;
    checkCodeExternal: GleanCustomDistribution;
    checkCodeNotify: GleanCustomDistribution;
    checkCodeSubsequent: GleanCustomDistribution;
    checkExtendedErrorExternal: Record<string, GleanCounter>;
    checkExtendedErrorNotify: Record<string, GleanCounter>;
    checkExtendedErrorSubsequent: Record<string, GleanCounter>;
    checkNoUpdateExternal: GleanCounter;
    checkNoUpdateNotify: GleanCounter;
    checkNoUpdateSubsequent: GleanCounter;
    downloadCodeComplete: GleanCustomDistribution;
    downloadCodePartial: GleanCustomDistribution;
    downloadCodeUnknown: GleanCustomDistribution;
    invalidLastupdatetimeExternal: GleanCounter;
    invalidLastupdatetimeNotify: GleanCounter;
    invalidLastupdatetimeSubsequent: GleanCounter;
    langpackOvertime: GleanTimingDistribution;
    lastNotifyIntervalDaysExternal: GleanTimingDistribution;
    lastNotifyIntervalDaysNotify: GleanTimingDistribution;
    lastNotifyIntervalDaysSubsequent: GleanTimingDistribution;
    notPrefUpdateAutoExternal: GleanCounter;
    notPrefUpdateAutoNotify: GleanCounter;
    notPrefUpdateAutoSubsequent: GleanCounter;
    notPrefUpdateServiceEnabledExternal: GleanCounter;
    notPrefUpdateServiceEnabledNotify: GleanCounter;
    notPrefUpdateServiceEnabledSubsequent: GleanCounter;
    notPrefUpdateStagingEnabledExternal: GleanCounter;
    notPrefUpdateStagingEnabledNotify: GleanCounter;
    notPrefUpdateStagingEnabledSubsequent: GleanCounter;
    notificationBadgeShown: Record<
      'available' | 'manual' | 'otherinstance' | 'restart' | 'unsupported',
      GleanCounter
    >;
    notificationDismissed: Record<
      'available' | 'manual' | 'otherinstance' | 'restart' | 'unsupported',
      GleanCounter
    >;
    notificationMainActionDoorhanger: Record<
      'available' | 'manual' | 'otherinstance' | 'restart' | 'unsupported',
      GleanCounter
    >;
    notificationMainActionMenu: Record<
      'available' | 'manual' | 'otherinstance' | 'restart' | 'unsupported',
      GleanCounter
    >;
    notificationShown: Record<
      'available' | 'manual' | 'otherinstance' | 'restart' | 'unsupported',
      GleanCounter
    >;
    pingCountExternal: GleanCounter;
    pingCountNotify: GleanCounter;
    pingCountSubsequent: GleanCounter;
    prefServiceErrorsExternal: GleanCustomDistribution;
    prefServiceErrorsNotify: GleanCustomDistribution;
    prefServiceErrorsSubsequent: GleanCustomDistribution;
    prefUpdateCancelationsExternal: GleanCustomDistribution;
    prefUpdateCancelationsNotify: GleanCustomDistribution;
    prefUpdateCancelationsSubsequent: GleanCustomDistribution;
    previousBuildId: GleanString;
    previousChannel: GleanString;
    previousVersion: GleanString;
    serviceInstalledExternal: Record<'false' | 'true', GleanCounter>;
    serviceInstalledNotify: Record<'false' | 'true', GleanCounter>;
    serviceInstalledSubsequent: Record<'false' | 'true', GleanCounter>;
    serviceManuallyUninstalledExternal: GleanCounter;
    serviceManuallyUninstalledNotify: GleanCounter;
    serviceManuallyUninstalledSubsequent: GleanCounter;
    stateCodeCompleteStage: GleanCustomDistribution;
    stateCodeCompleteStartup: GleanCustomDistribution;
    stateCodePartialStage: GleanCustomDistribution;
    stateCodePartialStartup: GleanCustomDistribution;
    stateCodeUnknownStage: GleanCustomDistribution;
    stateCodeUnknownStartup: GleanCustomDistribution;
    statusErrorCodeCompleteStage: GleanCustomDistribution;
    statusErrorCodeCompleteStartup: GleanCustomDistribution;
    statusErrorCodePartialStage: GleanCustomDistribution;
    statusErrorCodePartialStartup: GleanCustomDistribution;
    statusErrorCodeUnknownStage: GleanCustomDistribution;
    statusErrorCodeUnknownStartup: GleanCustomDistribution;
    targetBuildId: GleanString;
    targetChannel: GleanString;
    targetDisplayVersion: GleanString;
    targetVersion: GleanString;
    unableToApplyExternal: GleanCounter;
    unableToApplyNotify: GleanCounter;
    unableToApplySubsequent: GleanCounter;
    bitshresult: Record<string, GleanCounter>;
    moveResult: Record<string, GleanCounter>;
    noWindowAutoRestarts: GleanCounter;
    suppressPrompts: GleanBoolean;
    versionPin: GleanString;
  };

  updateSettings: {
    autoDownload: GleanBoolean;
    background: GleanBoolean;
    channel: GleanString;
    enabled: GleanBoolean;
  };

  updater: {
    available: GleanBoolean;
  };

  profiles: {
    creationDate: GleanQuantity;
    firstUseDate: GleanQuantity;
    recoveredFromBackup: GleanQuantity;
    resetDate: GleanQuantity;
  };

  e10s: {
    enabled: GleanBoolean;
    multiProcesses: GleanQuantity;
  };

  fission: {
    enabled: GleanBoolean;
  };

  gecko: {
    buildId: GleanString;
    safeModeUsage: GleanCustomDistribution;
    version: GleanString;
  };

  launcherProcess: {
    state: GleanQuantity;
  };

  widget: {
    imeNameOnMac: Record<string, GleanBoolean>;
    gtkVersion: GleanString;
    imeNameOnLinux: Record<string, GleanBoolean>;
    darkMode: GleanBoolean;
    notifyIdle: GleanTimingDistribution;
    pointingDevices: Record<'mouse' | 'pen' | 'touch', GleanBoolean>;
    imeNameOnWindows: Record<string, GleanBoolean>;
    imeNameOnWindowsInsertedCrlf: Record<string, GleanBoolean>;
    touchEnabledDevice: Record<'false' | 'true', GleanCounter>;
  };

  gfxFeatures: {
    compositor: GleanString;
    d2d: GleanObject;
    d3d11: GleanObject;
    gpuProcess: GleanObject;
    hwCompositing: GleanObject;
    omtp: GleanObject;
    openglCompositing: GleanObject;
    webrender: GleanObject;
    wrCompositor: GleanObject;
  };

  windowsSecurity: {
    antispyware: GleanStringList;
    antivirus: GleanStringList;
    firewall: GleanStringList;
  };

  cycleCollector: {
    asyncSnowWhiteFreeing: GleanTimingDistribution;
    collected: GleanCustomDistribution;
    deferredFinalizeAsync: GleanTimingDistribution;
    finishIgc: Record<'false' | 'true', GleanCounter>;
    forgetSkippableMax: GleanTimingDistribution;
    full: GleanTimingDistribution;
    maxPause: GleanTimingDistribution;
    needGc: Record<'false' | 'true', GleanCounter>;
    sliceDuringIdle: GleanCustomDistribution;
    syncSkippable: Record<'false' | 'true', GleanCounter>;
    time: GleanTimingDistribution;
    timeBetween: GleanTimingDistribution;
    visitedGced: GleanCustomDistribution;
    visitedRefCounted: GleanCustomDistribution;
    workerCollected: GleanCustomDistribution;
    workerNeedGc: Record<'false' | 'true', GleanCounter>;
    workerTime: GleanTimingDistribution;
    workerVisitedGced: GleanCustomDistribution;
    workerVisitedRefCounted: GleanCustomDistribution;
  };

  event: {
    longtask: Record<string, GleanTimingDistribution>;
  };

  hdd: {
    binary: GleanObject;
    profile: GleanObject;
    system: GleanObject;
  };

  memoryPhc: {
    slop: GleanMemoryDistribution;
    slotsAllocated: GleanCustomDistribution;
    slotsFreed: GleanCustomDistribution;
  };

  memoryWatcher: {
    onHighMemoryStats: GleanEventWithExtras<{ value?: string }>;
  };

  systemCpu: {
    bigCores: GleanQuantity;
    extensions: GleanStringList;
    family: GleanQuantity;
    l2Cache: GleanQuantity;
    l3Cache: GleanQuantity;
    littleCores: GleanQuantity;
    logicalCores: GleanQuantity;
    mediumCores: GleanQuantity;
    model: GleanQuantity;
    name: GleanString;
    physicalCores: GleanQuantity;
    speed: GleanQuantity;
    stepping: GleanQuantity;
    vendor: GleanString;
  };

  systemOs: {
    distro: GleanString;
    distroVersion: GleanString;
    locale: GleanString;
    name: GleanString;
    servicePackMajor: GleanQuantity;
    servicePackMinor: GleanQuantity;
    version: GleanString;
    windowsBuildNumber: GleanQuantity;
    windowsUbr: GleanQuantity;
  };

  timerThread: {
    timersFiredPerWakeup: GleanCustomDistribution;
  };

  xpcom: {
    abi: GleanString;
  };
}

interface GleanPingsImpl {
  messagingSystem: GleanPingNoReason;
  newtab: GleanPingWithReason<'component_init' | 'newtab_session_end'>;
  newtabContent: GleanPingWithReason<'component_init' | 'newtab_session_end'>;
  spoc: GleanPingWithReason<'click' | 'impression' | 'save'>;
  topSites: GleanPingNoReason;
  pocketButton: GleanPingNoReason;
  profiles: GleanPingNoReason;
  searchWith: GleanPingNoReason;
  serpCategorization: GleanPingWithReason<'inactivity' | 'startup' | 'threshold_reached'>;
  quickSuggest: GleanPingNoReason;
  quickSuggestDeletionRequest: GleanPingNoReason;
  urlbarKeywordExposure: GleanPingNoReason;
  dataLeakBlocker: GleanPingNoReason;
  contextIdDeletionRequest: GleanPingNoReason;
  prototypeNoCodeEvents: GleanPingNoReason;
  pageload: GleanPingWithReason<'startup' | 'threshold'>;
  pageloadBaseDomain: GleanPingWithReason<'pageload'>;
  useCounters: GleanPingWithReason<'app_shutdown_confirmed' | 'idle_startup'>;
  unexpectedScriptLoad: GleanPingNoReason;
  fxAccounts: GleanPingWithReason<'active' | 'dirty_startup' | 'inactive'>;
  sync: GleanPingWithReason<'idchanged' | 'schedule' | 'shutdown'>;
  bounceTrackingProtection: GleanPingNoReason;
  hangReport: GleanPingNoReason;
  backgroundTasks: GleanPingNoReason;
  captchaDetection: GleanPingNoReason;
  crash: GleanPingWithReason<'crash' | 'event_found'>;
  traces: GleanPingWithReason<'buffer_full' | 'idle' | 'shutdown'>;
  dauReporting: GleanPingWithReason<'active' | 'dirty_startup' | 'inactive'>;
  tempFogInitialState: GleanPingWithReason<'startup'>;
  collectionDisabledPing: GleanPingNoReason;
  disabledPing: GleanPingNoReason;
  onePingOnly: GleanPingNoReason;
  rideAlongPing: GleanPingNoReason;
  testOhttpPing: GleanPingNoReason;
  testPing: GleanPingNoReason;
  heartbeat: GleanPingNoReason;
  nimbusTargetingContext: GleanPingNoReason;
  brokenSiteReport: GleanPingNoReason;
  userCharacteristics: GleanPingNoReason;
  onboardingOptOut: GleanPingWithReason<'set_upload_enabled'>;
  thirdPartyModules: GleanPingNoReason;
  usageDeletionRequest: GleanPingWithReason<'set_upload_enabled'>;
  usageReporting: GleanPingWithReason<'active' | 'dirty_startup' | 'inactive'>;
  firstStartup: GleanPingNoReason;
  defaultAgent: GleanPingWithReason<'daily_ping'>;
  backgroundUpdate: GleanPingWithReason<'backgroundupdate_task'>;
  update: GleanPingWithReason<'ready' | 'success'>;
}

type GleanEventNoExtras = Omit<GleanEvent, 'record'> & { record(_?: never) };
type GleanEventWithExtras<T> = Omit<GleanEvent, 'record'> & { record(extras: T) };

type GleanPingNoReason = Omit<nsIGleanPing, 'submit'> & { submit(_?: never) };
type GleanPingWithReason<T> = Omit<nsIGleanPing, 'submit'> & { submit(reason: T) };
