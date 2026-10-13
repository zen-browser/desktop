/* eslint-disable */
/*!
 * Bundled from @ghostery/adblocker@2.18.2 (MPL-2.0).
 * Copyright (c) 2017-present Ghostery GmbH. All rights reserved.
 * https://github.com/ghostery/adblocker
 */

// node_modules/@ghostery/url-parser/dist/esm/const.js
var CODE_SPACE = 32;
var CODE_AMPERSAND = 38;
var CODE_EQUALS = 61;

// node_modules/tldts-core/dist/es6/src/domain.js
function shareSameDomainSuffix(hostname, vhost) {
  if (hostname.endsWith(vhost)) {
    return hostname.length === vhost.length || hostname[hostname.length - vhost.length - 1] === ".";
  }
  return false;
}
function extractDomainWithSuffix(hostname, publicSuffix) {
  const publicSuffixIndex = hostname.length - publicSuffix.length - 2;
  const lastDotBeforeSuffixIndex = hostname.lastIndexOf(".", publicSuffixIndex);
  if (lastDotBeforeSuffixIndex === -1) {
    return hostname;
  }
  return hostname.slice(lastDotBeforeSuffixIndex + 1);
}
function getDomain(suffix, hostname, options) {
  if (options.validHosts !== null) {
    const validHosts = options.validHosts;
    for (const vhost of validHosts) {
      if (
        /*@__INLINE__*/
        shareSameDomainSuffix(hostname, vhost)
      ) {
        return vhost;
      }
    }
  }
  let numberOfLeadingDots = 0;
  if (hostname.startsWith(".")) {
    while (numberOfLeadingDots < hostname.length && hostname[numberOfLeadingDots] === ".") {
      numberOfLeadingDots += 1;
    }
  }
  if (suffix.length === hostname.length - numberOfLeadingDots) {
    return null;
  }
  return (
    /*@__INLINE__*/
    extractDomainWithSuffix(hostname, suffix)
  );
}

// node_modules/tldts-core/dist/es6/src/domain-without-suffix.js
function getDomainWithoutSuffix(domain, suffix) {
  return domain.slice(0, -suffix.length - 1);
}

// node_modules/tldts-core/dist/es6/src/extract-hostname.js
var CONTROL_CHARS = /[\t\n\r]/g;
var extractedHostnameValidated = false;
function isValidHostnameChar(code) {
  return code >= 97 && code <= 122 || // a-z
  code >= 48 && code <= 57 || // 0-9
  code > 127 || // non-ASCII (accepted, not punycode-checked)
  code >= 65 && code <= 90 || // A-Z (becomes valid once lowercased)
  code === 45 || // '-'
  code === 95;
}
function getSpecialScheme(url, schemeStart, colonIndex) {
  const length = colonIndex - schemeStart;
  const c0 = url.charCodeAt(schemeStart) | 32;
  if (length === 2) {
    return c0 === 119 && (url.charCodeAt(schemeStart + 1) | 32) === 115 ? 1 : 0;
  } else if (length === 3) {
    const c1 = url.charCodeAt(schemeStart + 1) | 32;
    const c2 = url.charCodeAt(schemeStart + 2) | 32;
    if (c0 === 119 && c1 === 115 && c2 === 115)
      return 1;
    if (c0 === 102 && c1 === 116 && c2 === 112)
      return 1;
    return 0;
  } else if (length === 4) {
    const c1 = url.charCodeAt(schemeStart + 1) | 32;
    const c2 = url.charCodeAt(schemeStart + 2) | 32;
    const c3 = url.charCodeAt(schemeStart + 3) | 32;
    if (c0 === 104 && c1 === 116 && c2 === 116 && c3 === 112)
      return 1;
    if (c0 === 102 && c1 === 105 && c2 === 108 && c3 === 101)
      return 2;
    return 0;
  } else if (length === 5) {
    return c0 === 104 && (url.charCodeAt(schemeStart + 1) | 32) === 116 && (url.charCodeAt(schemeStart + 2) | 32) === 116 && (url.charCodeAt(schemeStart + 3) | 32) === 112 && (url.charCodeAt(schemeStart + 4) | 32) === 115 ? 1 : 0;
  }
  return 0;
}
function extractHostname(url, urlIsValidHostname, validate = false) {
  let start = 0;
  let end = url.length;
  let hasUpper = false;
  let isSpecial = false;
  extractedHostnameValidated = false;
  if (!urlIsValidHostname) {
    if (url.startsWith("data:")) {
      return null;
    }
    while (start < url.length && url.charCodeAt(start) <= 32) {
      start += 1;
    }
    while (end > start + 1 && url.charCodeAt(end - 1) <= 32) {
      end -= 1;
    }
    if (url.charCodeAt(start) === 47 && url.charCodeAt(start + 1) === 47) {
      start += 2;
    } else {
      const indexOfProtocol = url.indexOf(":/", start);
      if (indexOfProtocol !== -1) {
        const special = getSpecialScheme(url, start, indexOfProtocol);
        if (special === 1) {
          isSpecial = true;
          start = indexOfProtocol + 2;
          while (url.charCodeAt(start) === 47 || url.charCodeAt(start) === 92) {
            start += 1;
          }
        } else if (special === 2) {
          isSpecial = true;
          start = indexOfProtocol + 1;
          let slashes = 0;
          while ((url.charCodeAt(start) === 47 || url.charCodeAt(start) === 92) && slashes < 2) {
            start += 1;
            slashes += 1;
          }
          if (slashes < 2) {
            return null;
          }
        } else {
          for (let i = start; i < indexOfProtocol; i += 1) {
            const code = url.charCodeAt(i) | 32;
            if (!(code >= 97 && code <= 122 || // [a, z]
            code >= 48 && code <= 57 || // [0, 9]
            code === 46 || // '.'
            code === 45 || // '-'
            code === 43)) {
              const raw = url.charCodeAt(i);
              if (raw === 9 || raw === 10 || raw === 13) {
                return extractHostname(url.replace(CONTROL_CHARS, ""), urlIsValidHostname, validate);
              }
              return null;
            }
          }
          if (url.charCodeAt(indexOfProtocol + 2) === 47) {
            start = indexOfProtocol + 3;
          } else {
            return null;
          }
        }
      } else if (url.charCodeAt(start) !== 91) {
        let indexOfColon = -1;
        for (let i = start; i < end; i += 1) {
          const code = url.charCodeAt(i);
          if (code === 9 || code === 10 || code === 13) {
            return extractHostname(url.replace(CONTROL_CHARS, ""), urlIsValidHostname, validate);
          }
          if (code === 58) {
            indexOfColon = i;
            break;
          }
          if (code === 47 || code === 92 || code === 63 || code === 35) {
            break;
          }
        }
        if (indexOfColon !== -1) {
          let hasIdentifier = false;
          for (let i = indexOfColon + 1; i < end; i += 1) {
            const code = url.charCodeAt(i);
            if (code === 47 || code === 92 || code === 63 || code === 35) {
              break;
            }
            if (code === 64) {
              hasIdentifier = true;
              break;
            }
          }
          if (!hasIdentifier) {
            let allDigits = true;
            let i = indexOfColon + 1;
            for (; i < end; i += 1) {
              const code = url.charCodeAt(i);
              if (code === 47 || code === 92 || code === 63 || code === 35) {
                break;
              }
              if (code < 48 || code > 57) {
                allDigits = false;
                break;
              }
            }
            if (i === indexOfColon + 1) {
              allDigits = false;
            }
            if (!allDigits) {
              const special = getSpecialScheme(url, start, indexOfColon);
              if (special === 0) {
                let isBareIpv6 = false;
                for (let j = indexOfColon + 1; j < end; j += 1) {
                  const code = url.charCodeAt(j);
                  if (code === 47 || code === 92 || code === 63 || code === 35) {
                    break;
                  }
                  if (code === 58) {
                    isBareIpv6 = true;
                    break;
                  }
                }
                if (!isBareIpv6) {
                  return null;
                }
              } else {
                isSpecial = true;
                start = indexOfColon + 1;
                if (special === 2) {
                  let slashes = 0;
                  while ((url.charCodeAt(start) === 47 || url.charCodeAt(start) === 92) && slashes < 2) {
                    start += 1;
                    slashes += 1;
                  }
                  if (slashes < 2) {
                    return null;
                  }
                } else {
                  while (url.charCodeAt(start) === 47 || url.charCodeAt(start) === 92) {
                    start += 1;
                  }
                }
              }
            }
          }
        }
      }
    }
    let indexOfIdentifier = -1;
    let indexOfClosingBracket = -1;
    let indexOfPort = -1;
    let indexOfFirstColon = -1;
    let hasControl = false;
    let vValid = validate;
    let vLastDot = start - 1;
    let vLastCode = -1;
    if (validate && start < end) {
      const c0 = url.charCodeAt(start);
      if (
        // Keep these parens: they scope /*@__INLINE__*/ for terser.
        // prettier-ignore
        !/*@__INLINE__*/
        (isValidHostnameChar(c0) || c0 === 46 || c0 === 95) || c0 === 45
      ) {
        vValid = false;
      }
    }
    for (let i = start; i < end; i += 1) {
      const code = url.charCodeAt(i);
      if (code < 64) {
        if (code === 47 || code === 35 || code === 63) {
          end = i;
          break;
        } else if (code === 58) {
          if (indexOfFirstColon === -1) {
            indexOfFirstColon = i;
          }
          indexOfPort = i;
        } else if (code === 9 || code === 10 || code === 13) {
          hasControl = true;
        } else if (validate) {
          if (code === 46) {
            if (i - vLastDot > 64 || vLastCode === 46 || vLastCode === 45) {
              vValid = false;
            }
            vLastDot = i;
          } else if (code < 48 || code > 57) {
            if (code !== 45 || vLastCode === 46) {
              vValid = false;
            }
          }
        }
      } else if (isSpecial && code === 92) {
        end = i;
        break;
      } else if (code === 64) {
        indexOfIdentifier = i;
        indexOfFirstColon = -1;
      } else if (code === 93) {
        indexOfClosingBracket = i;
      } else if (code >= 65 && code <= 90) {
        hasUpper = true;
      } else if (validate && !/*@__INLINE__*/
      isValidHostnameChar(code)) {
        vValid = false;
      }
      if (validate) {
        vLastCode = code;
      }
    }
    if (hasControl) {
      return extractHostname(url.replace(CONTROL_CHARS, ""), urlIsValidHostname, validate);
    }
    if (indexOfIdentifier !== -1 && indexOfIdentifier >= start && indexOfIdentifier < end) {
      start = indexOfIdentifier + 1;
    }
    if (url.charCodeAt(start) === 91) {
      if (indexOfClosingBracket !== -1) {
        return url.slice(start + 1, indexOfClosingBracket).toLowerCase();
      }
      return null;
    } else if (indexOfPort !== -1 && indexOfPort > start && indexOfPort < end && // A host:port has exactly one ':' in the host (so its first ':' is its
    // last); a bare, unbracketed IPv6 literal ("2a01:e35::1") has >= 2, so
    // its first ':' precedes the last. Only the former has a ':port' to trim.
    indexOfFirstColon === indexOfPort) {
      end = indexOfPort;
    }
    if (start >= end) {
      return null;
    }
    if (validate && vValid && indexOfIdentifier === -1 && indexOfPort === -1 && indexOfClosingBracket === -1 && url.charCodeAt(end - 1) !== 46 && end - start <= 255 && // total length
    end - vLastDot - 1 <= 63 && // last label length
    vLastCode !== 45) {
      extractedHostnameValidated = true;
    }
  }
  while (end > start + 1 && url.charCodeAt(end - 1) === 46) {
    end -= 1;
  }
  const hostname = start !== 0 || end !== url.length ? url.slice(start, end) : url;
  if (hasUpper) {
    return hostname.toLowerCase();
  }
  return hostname;
}

// node_modules/tldts-core/dist/es6/src/is-ip.js
function isProbablyIpv4(hostname) {
  if (hostname.length < 7) {
    return false;
  }
  if (hostname.length > 15) {
    return false;
  }
  let numberOfDots = 0;
  for (let i = 0; i < hostname.length; i += 1) {
    const code = hostname.charCodeAt(i);
    if (code === 46) {
      numberOfDots += 1;
    } else if (code < 48 || code > 57) {
      return false;
    }
  }
  return numberOfDots === 3 && hostname.charCodeAt(0) !== 46 && hostname.charCodeAt(hostname.length - 1) !== 46;
}
function isProbablyIpv6(hostname) {
  if (hostname.length < 3) {
    return false;
  }
  let start = hostname.startsWith("[") ? 1 : 0;
  let end = hostname.length;
  if (hostname[end - 1] === "]") {
    end -= 1;
  }
  if (end - start > 39) {
    return false;
  }
  let hasColon = false;
  for (; start < end; start += 1) {
    const code = hostname.charCodeAt(start);
    if (code === 58) {
      hasColon = true;
    } else if (!(code >= 48 && code <= 57 || // 0-9
    code >= 97 && code <= 102 || // a-f
    code >= 65 && code <= 70)) {
      return false;
    }
  }
  return hasColon;
}
function isIp(hostname) {
  return isProbablyIpv6(hostname) || isProbablyIpv4(hostname);
}

// node_modules/tldts-core/dist/es6/src/is-special-use.js
var SPECIAL_USE_DOMAINS = [
  "test",
  // RFC 6761
  "localhost",
  // RFC 6761
  "invalid",
  // RFC 6761
  "example",
  // RFC 6761
  "example.com",
  // RFC 6761
  "example.net",
  // RFC 6761
  "example.org",
  // RFC 6761
  "local",
  // RFC 6762 (mDNS)
  "onion",
  // RFC 7686 (Tor)
  "alt",
  // RFC 9476
  "home.arpa",
  // RFC 8375
  "ipv4only.arpa",
  // RFC 8880
  "resolver.arpa",
  // RFC 9462
  "service.arpa",
  // RFC 9665
  "6tisch.arpa",
  // RFC 9031
  "eap.arpa"
  // RFC 9965
];
function isSpecialUse(hostname) {
  for (const name of SPECIAL_USE_DOMAINS) {
    if (hostname.endsWith(name) && (hostname.length === name.length || hostname.charCodeAt(hostname.length - name.length - 1) === 46)) {
      return true;
    }
  }
  return false;
}

// node_modules/tldts-core/dist/es6/src/is-valid.js
function isValidAscii(code) {
  return code >= 97 && code <= 122 || code >= 48 && code <= 57 || code > 127;
}
function is_valid_default(hostname) {
  if (hostname.length > 255) {
    return false;
  }
  if (hostname.length === 0) {
    return false;
  }
  if (
    /*@__INLINE__*/
    !isValidAscii(hostname.charCodeAt(0)) && hostname.charCodeAt(0) !== 46 && // '.' (dot)
    hostname.charCodeAt(0) !== 95
  ) {
    return false;
  }
  let lastDotIndex = -1;
  let lastCharCode = -1;
  const len = hostname.length;
  for (let i = 0; i < len; i += 1) {
    const code = hostname.charCodeAt(i);
    if (code === 46) {
      if (
        // Check that previous label is < 63 bytes long (64 = 63 + '.')
        i - lastDotIndex > 64 || // Check that previous character was not already a '.'
        lastCharCode === 46 || // Check that the previous label does not end with '-' (RFC 1035 §2.3.1 LDH).
        // '_' is intentionally NOT restricted: DNS allows any octet (RFC 2181 §11) and
        // WHATWG URL does not treat '_' as a forbidden host code point.
        lastCharCode === 45
      ) {
        return false;
      }
      lastDotIndex = i;
    } else if (
      // A forbidden character in the label...
      // Keep these parens: they scope /*@__INLINE__*/ for terser.
      // prettier-ignore
      !/*@__INLINE__*/
      (isValidAscii(code) || code === 45 || code === 95) || // ...or a '-' starting a label (the byte right after a '.'). A label must
      // not begin with a hyphen (RFC 1034 §3.5 / RFC 1035 §2.3.1 LDH, as amended
      // by RFC 1123 §2.1; cf. UTS #46 CheckHyphens). The first label is covered by
      // the leading-character guard above; mirrors the trailing-'-' rule below.
      code === 45 && lastCharCode === 46
    ) {
      return false;
    }
    lastCharCode = code;
  }
  return (
    // Check that last label is shorter than 63 chars
    len - lastDotIndex - 1 <= 63 && // Check that the last character is an allowed trailing label character.
    // Since we already checked that the char is a valid hostname character,
    // we only need to check that it's different from '-'.
    lastCharCode !== 45
  );
}

// node_modules/tldts-core/dist/es6/src/options.js
function setDefaultsImpl({ allowIcannDomains = true, allowPrivateDomains = false, detectIp = true, detectSpecialUse = false, extractHostname: extractHostname2 = true, mixedInputs = true, validHosts = null, validateHostname = true }) {
  return {
    allowIcannDomains,
    allowPrivateDomains,
    detectIp,
    detectSpecialUse,
    extractHostname: extractHostname2,
    mixedInputs,
    validHosts,
    validateHostname
  };
}
var DEFAULT_OPTIONS = (
  /*@__INLINE__*/
  setDefaultsImpl({})
);
function setDefaults(options) {
  if (options === void 0) {
    return DEFAULT_OPTIONS;
  }
  return (
    /*@__INLINE__*/
    setDefaultsImpl(options)
  );
}

// node_modules/tldts-core/dist/es6/src/subdomain.js
function getSubdomain(hostname, domain) {
  if (domain.length === hostname.length) {
    return "";
  }
  return hostname.slice(0, -domain.length - 1);
}

// node_modules/tldts-core/dist/es6/src/factory.js
function getEmptyResult() {
  return {
    domain: null,
    domainWithoutSuffix: null,
    hostname: null,
    isIcann: null,
    isIp: null,
    isPrivate: null,
    isSpecialUse: null,
    publicSuffix: null,
    subdomain: null
  };
}
function parseImpl(url, step, suffixLookup2, partialOptions, result) {
  const options = (
    /*@__INLINE__*/
    setDefaults(partialOptions)
  );
  if (typeof url !== "string") {
    return result;
  }
  let urlIsValid = false;
  if (!options.extractHostname) {
    result.hostname = url;
  } else if (options.mixedInputs) {
    urlIsValid = is_valid_default(url);
    result.hostname = extractHostname(url, urlIsValid, options.validateHostname);
  } else {
    result.hostname = extractHostname(url, false, options.validateHostname);
  }
  if (options.detectIp && result.hostname !== null) {
    result.isIp = isIp(result.hostname);
    if (result.isIp) {
      return result;
    }
  }
  if (options.validateHostname && options.extractHostname && result.hostname !== null && // Skip the re-scan when `url` was already validated and extractHostname
  // returned it unchanged (same reference => identical string, still valid).
  !(urlIsValid && result.hostname === url) && // Skip the re-scan when extractHostname already validated the host inline
  // (a confirmed-valid simple authority — see extract-hostname.ts).
  !extractedHostnameValidated && !is_valid_default(result.hostname)) {
    result.hostname = null;
    return result;
  }
  if (step === 0 || result.hostname === null) {
    return result;
  }
  if (step === 5 && options.detectSpecialUse) {
    result.isSpecialUse = isSpecialUse(result.hostname);
  }
  suffixLookup2(result.hostname, options, result);
  if (step === 2 || result.publicSuffix === null) {
    return result;
  }
  result.domain = getDomain(result.publicSuffix, result.hostname, options);
  if (step === 3 || result.domain === null) {
    return result;
  }
  result.subdomain = getSubdomain(result.hostname, result.domain);
  if (step === 4) {
    return result;
  }
  result.domainWithoutSuffix = getDomainWithoutSuffix(result.domain, result.publicSuffix);
  return result;
}

// node_modules/tldts-core/dist/es6/src/lookup/fast-path.js
function fast_path_default(hostname, options, out) {
  if (!options.allowPrivateDomains && hostname.length > 3) {
    const last = hostname.length - 1;
    const c3 = hostname.charCodeAt(last);
    const c2 = hostname.charCodeAt(last - 1);
    const c1 = hostname.charCodeAt(last - 2);
    const c0 = hostname.charCodeAt(last - 3);
    if (c3 === 109 && c2 === 111 && c1 === 99 && c0 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "com";
      return true;
    } else if (c3 === 103 && c2 === 114 && c1 === 111 && c0 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "org";
      return true;
    } else if (c3 === 117 && c2 === 100 && c1 === 101 && c0 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "edu";
      return true;
    } else if (c3 === 118 && c2 === 111 && c1 === 103 && c0 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "gov";
      return true;
    } else if (c3 === 116 && c2 === 101 && c1 === 110 && c0 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "net";
      return true;
    } else if (c3 === 101 && c2 === 100 && c1 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "de";
      return true;
    }
  }
  return false;
}

// node_modules/tldts-experimental/dist/es6/src/data/hashes.js
var hashes_default = new Uint32Array([6, 0, 0, 7, 5860978, 5861026, 5861029, 5861352, 5861357, 5861403, 5861586, 0, 0, 0, 1, 1850179732, 0, 9, 328184559, 1866923597, 2123501943, 2282562397, 2795346450, 3130446446, 3136607046, 3453334789, 4194175729, 91, 3156266, 19510334, 20989895, 64887183, 65021741, 101876503, 177080427, 179500755, 182385953, 311298055, 425802535, 460682395, 492095970, 582839475, 809563086, 819014943, 819028732, 828498514, 891873016, 922117623, 1075688039, 1126402299, 1139486022, 1156921983, 1179004234, 1241916785, 1329165410, 1335010188, 1370787547, 1370800824, 1431231509, 1447112085, 1498275876, 1508988617, 1516508161, 1522025464, 1544104458, 1554032448, 1554653742, 1570707647, 1573939511, 1626814538, 1675555530, 1675593396, 1679919230, 1692185483, 1730108052, 1781528047, 1781528437, 1784183980, 1789539963, 1827963150, 1873769763, 1881070667, 1890696062, 1893848785, 1927992574, 1937808954, 2005097031, 2182413090, 2391299855, 2419619562, 2445171142, 2453492351, 2496327381, 2525245455, 2573179642, 2703420555, 2709520566, 2800127296, 2921343336, 2970075511, 2989808530, 3000405309, 3015527775, 3043937580, 3047607849, 3048022317, 3160720065, 3382460164, 3461355676, 3498015045, 3503665706, 3688442504, 3738715095, 3925657990, 4033285539, 4076983130, 4085096371, 4146774829, 4208486561, 3786, 100835, 372942, 373596, 399643, 403867, 589540, 737224, 1210028, 1861414, 2424682, 2658901, 2946999, 3329363, 3333156, 6942202, 9086062, 9095117, 9267209, 9340158, 9485932, 11010102, 11406846, 16314893, 17546564, 18146303, 18331450, 19211200, 20314441, 20797457, 25057869, 26663359, 28320278, 30499151, 30585840, 36605120, 36775470, 36775473, 36990037, 39275208, 41892561, 42049478, 42538024, 45214788, 47656662, 50173535, 53599326, 53858455, 54537430, 63815836, 69971116, 73517283, 73904368, 75706244, 78793775, 78794171, 79558910, 80324123, 84993902, 87977581, 87978853, 87978860, 93811268, 95641381, 95641777, 96671837, 100511481, 100947456, 108215410, 108929491, 110526112, 110662188, 112311307, 114507832, 116811054, 120488259, 120575574, 122521550, 133427701, 134012911, 141513861, 141517490, 144349377, 144362028, 144550088, 144770230, 147205859, 147810002, 147989623, 149598895, 150736276, 150856054, 152379730, 156555774, 163952417, 163952613, 163952704, 163952815, 163953167, 163953232, 164189124, 164189258, 164189262, 164189326, 164189691, 164189842, 164560958, 165069166, 165106627, 165107021, 165339368, 165444557, 165444558, 165444615, 165444629, 165444745, 165444749, 165445368, 165512129, 165512527, 165749053, 165749188, 165749299, 165749435, 165749535, 165778992, 165779060, 167155067, 169909265, 169909275, 169909419, 169909512, 169909517, 169909531, 169909608, 169909724, 169909733, 169909734, 169909738, 169909857, 169910036, 169910195, 169910226, 169939304, 169977029, 169977163, 170281136, 170281250, 170281253, 170281258, 170281275, 170281382, 170281390, 170281415, 170281447, 170281457, 170281473, 170281497, 170281511, 170281522, 170281525, 170281528, 170281579, 170281589, 170281687, 170281689, 170281699, 170281742, 170281776, 170281812, 170281852, 170281902, 170281972, 170311352, 170649202, 170649385, 170649596, 171188220, 172078401, 172145927, 172213761, 172213835, 172214443, 172484301, 172788260, 172788319, 172788689, 172788693, 172788754, 172788809, 172788827, 173118530, 173118924, 173253960, 173254504, 173456648, 173591948, 173930212, 173930286, 174129293, 174306499, 174306893, 174307245, 174307439, 174358551, 174374100, 174407806, 174410098, 174488250, 174509317, 174577099, 174606766, 174644617, 174843632, 174844030, 174847160, 175181758, 175524135, 175524873, 176843304, 176948764, 178529610, 178530165, 178530256, 178530299, 178530303, 178530355, 178868363, 178868576, 178868974, 179274397, 179274476, 179379459, 179379616, 179379849, 179379853, 179380220, 179657877, 179692651, 179714168, 179913714, 180090112, 180090244, 180090304, 180090314, 180090337, 180090372, 180090450, 180090510, 180090525, 180090526, 180090587, 180090702, 180090747, 180091049, 180091118, 180091210, 180091228, 180091258, 180091259, 180283722, 180292996, 180293014, 180293036, 180293067, 180293093, 180293105, 180293124, 180293152, 180293156, 180293169, 180293179, 180293199, 180293253, 180293290, 180293294, 180293300, 180293302, 180293304, 180293317, 180293344, 180293346, 180293381, 180293447, 180293487, 180293501, 180293503, 180293522, 180293535, 180293716, 180293796, 180293819, 180293997, 180294e3, 180294004, 180294009, 180428032, 180902137, 180969265, 180969566, 180969653, 180969723, 181105061, 181105190, 181105676, 181240259, 181240353, 181240367, 181240371, 181240391, 181240392, 181240393, 181240398, 181240404, 181240451, 181240474, 181240479, 181240483, 181240490, 181240509, 181240515, 181240637, 181240844, 181240853, 181240956, 181241149, 181241165, 181241168, 181244839, 181278273, 181375534, 181375748, 181548621, 181548644, 181548727, 181548873, 181549108, 181549176, 181949900, 181950639, 182056031, 182385920, 182419943, 182893167, 182893283, 182893394, 182893788, 183163149, 183163151, 183163152, 183163155, 183163168, 183163169, 183163171, 183163181, 183163182, 183163183, 183163186, 183163188, 183163233, 183163248, 183163251, 183163252, 183163254, 183163270, 183163303, 183163314, 183163317, 183163334, 183163335, 183163336, 183163340, 183163345, 183163347, 183163350, 183163362, 183163363, 183163365, 183163366, 183163367, 183163371, 183163375, 183163376, 183163378, 183163380, 183163383, 183163630, 183163631, 183163644, 183163649, 183163651, 183163653, 183163655, 183163664, 183163668, 183163669, 183163678, 183163679, 183163682, 183163687, 183163713, 183163715, 183163728, 183163731, 183163735, 183163742, 183163777, 183163779, 183163780, 183163781, 183163783, 183163796, 183163797, 183163801, 183163843, 183163845, 183163847, 183163859, 183163864, 183163865, 183163874, 183163895, 183163897, 183163913, 183163922, 183163933, 183163960, 183163961, 183163963, 183163977, 183163978, 183163979, 183163981, 183163988, 183163989, 183163991, 183163992, 183163994, 183163995, 183163998, 183164008, 183164010, 183164012, 183164021, 183164025, 183164026, 183164027, 183164029, 183164041, 183164044, 183164045, 183164047, 183164050, 183164051, 183164057, 183164060, 183164061, 183164093, 184080938, 184081253, 184081673, 184081677, 184081778, 184246330, 184246511, 184486318, 184486865, 184487263, 184828195, 184828212, 184844696, 184844824, 184848486, 184848491, 184849029, 184849387, 184859173, 184859210, 184869208, 184869819, 184994607, 185163947, 185216284, 185289081, 185292632, 185295605, 185502073, 185502077, 185772974, 186723357, 186723671, 186723801, 186753074, 186763265, 186771866, 186840059, 186858006, 186875993, 186950941, 186953244, 186994101, 186994720, 187011432, 187022814, 187064894, 187067400, 187076090, 187078647, 187088813, 187161171, 187188812, 187203075, 187219343, 187222314, 187251332, 187328908, 187332203, 187378741, 187385256, 187386889, 187403121, 187403860, 187404132, 187409119, 187410536, 187415116, 187415841, 187417183, 187453423, 187455618, 187483569, 187506658, 187521457, 187531575, 187554851, 187557872, 187932036, 187932044, 187932595, 187932730, 187932752, 187932756, 187932794, 187932985, 187932989, 189797875, 189851312, 190236828, 190304994, 190305388, 190575460, 190575594, 190879986, 190880380, 191458643, 191459037, 193856736, 193857103, 193857114, 193857243, 193991787, 194363750, 194498585, 194498630, 194498988, 194499056, 194499063, 194499187, 194532263, 194532626, 194532630, 194532693, 194532760, 194532936, 194533115, 194802308, 194802313, 194802316, 194802351, 194802671, 194802818, 194802832, 194802974, 194803141, 194803143, 194803161, 194803162, 194803220, 194803226, 194803230, 194803290, 194836546, 194870589, 194870610, 194871004, 195040013, 195040230, 195040360, 195077902, 195078025, 195078028, 195078034, 195078035, 195078038, 195078058, 195078062, 195078071, 195078081, 195078095, 195078112, 195078119, 195078120, 195078149, 195078150, 195078156, 195078185, 195078215, 195078217, 195078250, 195078251, 195078272, 195078273, 195078277, 195078283, 195078287, 195078298, 195078299, 195078300, 195078368, 195078372, 195078375, 195078394, 195078464, 195078474, 195078493, 195078531, 195078554, 195078559, 195078687, 195078710, 195078753, 195078828, 195078837, 195078892, 195078895, 195078900, 195078906, 195078959, 195078960, 195078974, 195078995, 195078997, 195079007, 195145607, 195146051, 195817892, 195817910, 195818040, 197775763, 198219289, 198248729, 198354195, 198354632, 200387773, 202063369, 203326381, 203326382, 203326695, 203326709, 203326825, 203326829, 203327047, 203327192, 203360584, 203427712, 203428110, 203563443, 203563837, 203664976, 203665374, 203762913, 203901612, 203969343, 204069808, 204070876, 206121592, 207568995, 208227118, 218659706, 219797064, 231775478, 232791016, 232866163, 232870916, 237059472, 238230825, 238671321, 241611072, 245880244, 249954601, 256262487, 257210252, 257542887, 259829097, 260353797, 260353928, 260353938, 260354380, 260381156, 260390354, 271387034, 274691435, 279382168, 280527902, 280532777, 280535076, 280542659, 281931451, 292827804, 295209043, 296292341, 297619746, 305011770, 306510696, 313583e3, 314643431, 320313766, 320318114, 321023689, 321141002, 321447655, 325454853, 326762411, 337081594, 338040061, 339830659, 340010259, 341833935, 342149828, 342665371, 356194258, 359223603, 359276554, 360327984, 368215882, 370146306, 370150662, 373255328, 373394720, 374785091, 376173808, 377307531, 377336144, 377652210, 381874529, 381884647, 382049883, 382486912, 382598847, 389909922, 392084057, 393290800, 395076177, 395140257, 402724451, 403769719, 404122044, 410188633, 413977571, 418962805, 419080649, 423458772, 430711818, 430784915, 431116435, 431157415, 431370962, 431390595, 431489022, 431585240, 431586828, 431608121, 433686700, 442888655, 442922019, 445176561, 449218512, 449424719, 451217894, 451870618, 459172225, 459395692, 464626711, 464765206, 464834904, 469098393, 471052880, 478642118, 480635114, 480636362, 480638119, 480638181, 480638612, 480653244, 480658155, 480658807, 484603510, 484645735, 486805732, 490264076, 490274093, 493445761, 511578298, 513731936, 514111995, 514955151, 515474792, 515491843, 515593995, 518161197, 520595267, 522631343, 525872321, 527144416, 531170133, 531427447, 533682535, 533847771, 534396735, 539772390, 545433338, 547443445, 550462929, 551440509, 557981738, 559064708, 560636591, 572640614, 572652435, 572800203, 572833146, 572867160, 575127842, 575742406, 575835832, 576106402, 576590271, 577168455, 582462766, 583917065, 583936789, 584490345, 587768078, 588145733, 596395114, 596517435, 602054693, 609523853, 627471386, 630686153, 632559259, 635121653, 635859009, 635924539, 637007260, 641121432, 643488605, 643663853, 648304671, 650538190, 656171171, 656243914, 656640963, 665693626, 667797222, 678076451, 684522993, 684536293, 689172736, 689202009, 693611235, 694324728, 695649196, 703142796, 706540885, 707132367, 715533184, 722903474, 725879070, 728415570, 731964179, 733989474, 744440632, 745674128, 752520493, 752687122, 752687226, 752699150, 752938578, 753314817, 762792020, 766278458, 772916985, 785945688, 787032422, 793080342, 794341423, 794638681, 799598398, 803443550, 803504423, 803576910, 803750530, 804899040, 810638083, 813049915, 813882670, 813882809, 821390609, 822184173, 824372117, 826639012, 826993974, 827624512, 831815016, 834750300, 834856638, 834963202, 835666250, 838463501, 843454848, 845393562, 845537310, 846032279, 853098265, 855980394, 858467853, 869651422, 878524814, 881613818, 885943745, 896206971, 896253025, 900375831, 900562876, 904696072, 907903147, 911040096, 912288153, 912452591, 913046780, 914761571, 915088911, 915769822, 915838470, 919008564, 919376364, 928343570, 933141848, 935240483, 936096500, 936817801, 939243980, 939281294, 939375524, 939697158, 939922440, 940027871, 942743627, 943328481, 943363810, 947022624, 950098348, 954017396, 958817278, 959069811, 961909457, 961915153, 962363178, 962549619, 962816118, 963013768, 968961134, 973306633, 973587946, 973591516, 973595243, 973613934, 973618563, 976871270, 977251657, 983929219, 983931665, 983936021, 984542401, 985854160, 994961720, 1002154839, 1005485664, 1005660307, 1005931709, 1008280710, 1009678005, 1015938248, 1018008327, 1024510565, 1027688850, 1033879086, 1034357170, 1038843968, 1039500800, 1043537387, 1043742405, 1044060157, 1045601283, 1046273911, 1046743273, 1046756254, 1048099261, 1052311686, 1052441930, 1052883806, 1055187548, 1056740120, 1058016469, 1059921109, 1068743400, 1072264613, 1080832696, 1083646554, 1084662717, 1086818213, 1087030220, 1088313455, 1101657937, 1101658065, 1102136407, 1102691201, 1104888372, 1107574816, 1107604513, 1107608406, 1115463717, 1115465004, 1115468021, 1115471703, 1115487475, 1115489714, 1115490713, 1115517588, 1116603570, 1116886791, 1120207383, 1121068214, 1121069468, 1123274870, 1123277038, 1123281470, 1123286137, 1123290290, 1123300855, 1135543458, 1135544712, 1135545955, 1135553917, 1135559494, 1135563376, 1141006631, 1141018311, 1142918810, 1143019669, 1145288372, 1146787097, 1149112251, 1151589762, 1152383075, 1153556935, 1153560693, 1153560855, 1153576209, 1153582928, 1155609853, 1158010336, 1158014282, 1158019276, 1158022529, 1158025585, 1158030151, 1158040127, 1158040853, 1158043091, 1160141196, 1160246728, 1160248618, 1160253683, 1160256465, 1160259051, 1160271099, 1160271446, 1160272445, 1160277399, 1160508856, 1161223806, 1161235355, 1162489113, 1166908086, 1166937977, 1166949933, 1166952503, 1166953757, 1166959964, 1169030529, 1169037994, 1169039382, 1169046802, 1169046815, 1169048548, 1169054036, 1169994302, 1171270813, 1172775704, 1174752677, 1174762471, 1175721241, 1175725254, 1175726508, 1175727467, 1175727495, 1175735444, 1175735449, 1175736592, 1175738385, 1175738578, 1175738760, 1175746250, 1175746252, 1175749986, 1175793566, 1181427747, 1181429001, 1181435208, 1181446765, 1181453654, 1181460959, 1185692184, 1189090107, 1193567716, 1194400508, 1204258276, 1204470469, 1207765705, 1207825797, 1208230324, 1208517393, 1208911775, 1211364607, 1212671635, 1214258492, 1217924538, 1220965831, 1229000062, 1229783327, 1232816452, 1237771172, 1237773393, 1237773841, 1245899123, 1247245722, 1257366451, 1260762188, 1261854970, 1263148478, 1265324777, 1265669119, 1273073240, 1280280379, 1280768035, 1291368159, 1295085673, 1296518360, 1297048848, 1303650868, 1304687455, 1304781392, 1304918086, 1305056028, 1306968125, 1306972554, 1306973586, 1307665177, 1308558601, 1308559744, 1308574194, 1308583254, 1308584508, 1308585495, 1310785148, 1310799239, 1310800921, 1310801269, 1310803416, 1310807041, 1310808370, 1311349087, 1313021694, 1313023237, 1313031514, 1313033243, 1313033533, 1314270973, 1314287001, 1314293208, 1321085506, 1324313259, 1324313985, 1324320704, 1324322270, 1324332261, 1324636022, 1325293061, 1325300526, 1325303158, 1325308368, 1325309334, 1325309339, 1325310241, 1325310486, 1325311328, 1325311482, 1326707500, 1327036152, 1327646591, 1328209699, 1328777903, 1328778629, 1328785348, 1328786906, 1328789635, 1328794451, 1328797153, 1329963165, 1329987910, 1330666198, 1330807345, 1330903052, 1331009222, 1331010221, 1331013633, 1331015175, 1331019352, 1331025251, 1331026645, 1331028446, 1331143849, 1335892543, 1336436046, 1336436772, 1336437775, 1336438057, 1336439236, 1336443338, 1336449024, 1336456660, 1336460266, 1336462620, 1336463768, 1336469142, 1341018428, 1341081128, 1341091249, 1341179896, 1342001696, 1344411053, 1344426134, 1344436952, 1344437939, 1344444146, 1346529166, 1349466130, 1350170659, 1350170661, 1350356518, 1350356534, 1350620578, 1351056251, 1351154191, 1351382419, 1351445663, 1354447091, 1354448055, 1354464484, 1354467042, 1354475004, 1354584300, 1355466970, 1355483586, 1355607656, 1355929695, 1355947655, 1356150953, 1356150969, 1356150973, 1356457867, 1356471002, 1356757572, 1357240883, 1357692080, 1357876668, 1357880232, 1360043731, 1360220638, 1362168625, 1362262729, 1362271868, 1362285703, 1362326863, 1362506071, 1362656266, 1365811994, 1367692098, 1367811071, 1368820926, 1369663049, 1377739598, 1378565283, 1379014609, 1383613953, 1383613964, 1383629111, 1383647122, 1385857457, 1385879444, 1388074128, 1388078600, 1388084119, 1388086017, 1388094003, 1388104573, 1388109527, 1388111766, 1390304957, 1390318095, 1390319238, 1390327192, 1390328435, 1390329689, 1391292472, 1391295130, 1391298115, 1391299402, 1391302044, 1391307254, 1391308253, 1392560940, 1396553940, 1397006395, 1397007527, 1397007872, 1397007885, 1397015305, 1397016949, 1397022431, 1400354688, 1400355947, 1400356673, 1400364702, 1400366245, 1401334766, 1401741660, 1407044461, 1407049415, 1407053336, 1407060753, 1407067683, 1409840426, 1410939834, 1414623055, 1417953492, 1417953925, 1417969521, 1417971248, 1418042854, 1418666866, 1422407147, 1422418384, 1422432926, 1422433613, 1422434165, 1422435892, 1423090882, 1425971467, 1426162994, 1426865884, 1426871783, 1426872814, 1426880658, 1426881913, 1426884152, 1428612014, 1429098926, 1429105132, 1429112250, 1430623854, 1433558874, 1433568865, 1433577620, 1433578879, 1435862377, 1444705448, 1444706435, 1444707945, 1444708598, 1444713016, 1444718265, 1444720166, 1444723003, 1444725453, 1444731199, 1444731564, 1444731950, 1444732047, 1444732342, 1444732347, 1444738453, 1448052138, 1448052864, 1448054123, 1448067662, 1448078965, 1449172589, 1452091461, 1453961462, 1457037634, 1457145422, 1457156469, 1457178704, 1459376581, 1459377857, 1459377868, 1459384567, 1459385707, 1459403577, 1459405260, 1459408531, 1463053013, 1463840740, 1463842504, 1463849459, 1463849797, 1463867222, 1463868221, 1463873175, 1464819582, 1464821125, 1464829402, 1464830128, 1464831131, 1465838987, 1466068861, 1466074694, 1466091096, 1466403701, 1467047928, 1467061763, 1467063453, 1467065948, 1467070902, 1468307140, 1468314970, 1468321435, 1469284474, 1469285761, 1469294772, 1469295775, 1471526086, 1474720970, 1474751199, 1474796155, 1474852365, 1474856386, 1474857640, 1474858627, 1474866589, 1474867476, 1474871748, 1474880870, 1482183211, 1482187228, 1482389973, 1486003341, 1486005836, 1486010790, 1486021608, 1486029338, 1486036499, 1486036510, 1491300687, 1492905126, 1495099017, 1496999162, 1497335658, 1497338257, 1497341434, 1497353781, 1497360500, 1497361503, 1503214457, 1504022303, 1504024292, 1504032122, 1504033105, 1504038587, 1509379857, 1510741574, 1514359714, 1514604870, 1517410020, 1517415502, 1517416485, 1517424315, 1517426048, 1519466742, 1519486936, 1521633706, 1524564715, 1526518672, 1534242148, 1535379077, 1535411685, 1535411852, 1535411990, 1535416896, 1535416972, 1535417153, 1535418201, 1535418206, 1535418272, 1535418759, 1535418771, 1535419013, 1535419392, 1535420502, 1535420894, 1535421252, 1535425151, 1535426337, 1535426473, 1535426999, 1535427585, 1535429447, 1535430154, 1535430405, 1535437817, 1535440501, 1535442771, 1535444522, 1535444884, 1535444944, 1535445002, 1535445010, 1535446558, 1535446757, 1535447196, 1535447220, 1538631370, 1539876488, 1539883905, 1539891891, 1539902461, 1539907415, 1539909654, 1540853566, 1540863813, 1540865371, 1540871834, 1540872816, 1540972285, 1544565822, 1547523228, 1548000883, 1548203684, 1548662272, 1548668010, 1548668993, 1548676831, 1548677846, 1548686756, 1550655859, 1551291701, 1552780862, 1554083280, 1554160502, 1556617220, 1556618479, 1556619205, 1556627226, 1556629025, 1572843623, 1576437481, 1576444370, 1576461878, 1576463132, 1576464375, 1577978899, 1578737375, 1579027766, 1580891870, 1580902117, 1580903020, 1580910138, 1580910864, 1580912123, 1580922741, 1581061599, 1584242651, 1584252576, 1584258687, 1584260414, 1584261397, 1594150134, 1594318433, 1594644051, 1595762332, 1596503336, 1599871881, 1600554193, 1600562964, 1600967980, 1600968967, 1600970477, 1600988233, 1600993979, 1600994866, 1600997301, 1601541268, 1602995891, 1603061457, 1604314670, 1604316655, 1604330442, 1604341489, 1604342648, 1605183784, 1605406132, 1605908391, 1607689728, 1607689741, 1607690628, 1607701062, 1607701276, 1607705078, 1607710365, 1607715640, 1607716607, 1607716627, 1608344260, 1610313759, 1610666926, 1611239998, 1611396088, 1614382839, 1614530679, 1615167003, 1615172374, 1615640392, 1615647347, 1615658840, 1615665110, 1615666109, 1615671063, 1620094847, 1620095619, 1620095929, 1620105028, 1620113841, 1620119323, 1620795340, 1621082362, 1621083649, 1621092660, 1622329964, 1622331641, 1622337218, 1622353628, 1623408910, 1624559739, 1624569664, 1624577502, 1624577906, 1624578485, 1626556599, 1628470609, 1630022199, 1632310642, 1633163415, 1635568907, 1635591150, 1635593749, 1635643420, 1635994183, 1635994320, 1638368701, 1641006393, 1645672758, 1645785364, 1645803376, 1645808858, 1645809841, 1646891621, 1646892908, 1646907799, 1646910247, 1646917618, 1646918617, 1648006829, 1648007716, 1648013185, 1648013984, 1648014125, 1648016015, 1648021910, 1648025704, 1648032728, 1648033439, 1648033715, 1648035901, 1648039922, 1648043240, 1649454738, 1649581121, 1652486802, 1652497372, 1652504566, 1652932064, 1652936599, 1653583645, 1653598182, 1653599929, 1653606136, 1653607123, 1654697756, 1654712103, 1654713134, 1654716280, 1654721234, 1654722233, 1656168200, 1659162648, 1659176739, 1659180924, 1659185878, 1659186877, 1659695250, 1660874915, 1664393911, 1666510724, 1668155429, 1669474757, 1673661122, 1673662353, 1673671436, 1673686839, 1673856704, 1674136053, 1674769898, 1674770881, 1674776363, 1674793871, 1675780006, 1676641114, 1677004461, 1677008482, 1677010668, 1677010688, 1677011655, 1677022217, 1677028523, 1677030942, 1677037554, 1679194024, 1679234542, 1679234666, 1679237897, 1679241007, 1679252114, 1679258763, 1679261552, 1679266928, 1681499983, 1681500998, 1681504918, 1681509234, 1681510306, 1681510964, 1681520272, 1681524681, 1681526010, 1681526993, 1682221833, 1682359277, 1685960411, 1685962398, 1685964612, 1685965520, 1685965569, 1685965582, 1685965890, 1685967499, 1685968865, 1685974082, 1685987547, 1685988215, 1685988552, 1685991645, 1686112357, 1686592668, 1686670946, 1687209729, 1687209740, 1687216901, 1687224887, 1687235705, 1687240659, 1687242898, 1690419670, 1690419852, 1690423356, 1690429255, 1690430286, 1690438386, 1690439385, 1690439477, 1691674376, 1691689779, 1691700349, 1691705303, 1691707542, 1691739899, 1692242488, 1693900733, 1693913871, 1693915014, 1693915019, 1693922968, 1693924211, 1693925465, 1696137279, 1696148081, 1696153563, 1696514991, 1697110779, 1697112784, 1697112842, 1697116346, 1697119048, 1697126337, 1697127463, 1697127903, 1697134366, 1697135348, 1699859798, 1705948764, 1706596362, 1707661217, 1709380801, 1709397036, 1709401602, 1709403991, 1709403994, 1709715630, 1709719753, 1710553669, 1710842194, 1711349139, 1711911296, 1712862856, 1712864099, 1712865353, 1712874413, 1712889750, 1715042583, 1716067791, 1716074254, 1716075236, 1716090026, 1716093784, 1716101073, 1716987897, 1717046504, 1717344945, 1717458342, 1717567159, 1717665490, 1720424110, 1720435157, 1720448732, 1720448944, 1720449947, 1720450929, 1722611952, 1723770733, 1723771620, 1723777366, 1723796376, 1723797619, 1723869014, 1724144999, 1724360630, 1724887843, 1724888746, 1724891334, 1724900049, 1724902970, 1724913588, 1724914591, 1724915573, 1727744610, 1733044570, 1737465416, 1740104597, 1740108386, 1741479646, 1741618915, 1741621154, 1741622153, 1741631292, 1741636935, 1741709977, 1742216984, 1743089654, 1744959211, 1744968590, 1744969829, 1744971556, 1744977659, 1744987840, 1745343269, 1745488513, 1746392299, 1747200908, 1747202151, 1747210105, 1747211248, 1747212978, 1747215938, 1747219291, 1747533677, 1747671543, 1747762259, 1748301224, 1748301648, 1748302211, 1748318651, 1748321229, 1748327140, 1748327340, 1748328118, 1748329946, 1749416322, 1749419816, 1749422630, 1749422974, 1749423815, 1749423848, 1749423862, 1749423980, 1749432545, 1749435316, 1749435457, 1749435956, 1749437829, 1749437986, 1749440303, 1749441388, 1749442296, 1749442361, 1749443256, 1749443576, 1749444398, 1749445477, 1749445739, 1749750164, 1749955965, 1752768365, 1753028168, 1753430927, 1753880966, 1753882221, 1753900232, 1753906931, 1756680747, 1759105063, 1762715404, 1763952265, 1763967858, 1763978172, 1763979159, 1765274516, 1768132013, 1774870841, 1775278057, 1776446407, 1778765218, 1779479261, 1779706923, 1779707649, 1779709525, 1779713177, 1779714057, 1779714368, 1779715934, 1779715971, 1779725925, 1779730307, 1779731494, 1780768183, 1781938118, 1781938242, 1781939241, 1781948380, 1781954023, 1781961852, 1781965719, 1783657515, 1785147288, 1785152492, 1785564290, 1786402886, 1786403885, 1786408839, 1786413016, 1786418915, 1786422601, 1793085197, 1793091404, 1793103209, 1793109842, 1794311882, 1796513490, 1798682988, 1799934413, 1800873944, 1804734874, 1804986274, 1805201900, 1805201909, 1805381533, 1805390218, 1805394927, 1805396070, 1805397817, 1805404024, 1805405011, 1805410294, 1808346875, 1809278593, 1809846425, 1809852765, 1809854826, 1809860706, 1809868668, 1809869655, 1809909084, 1810126394, 1810162729, 1811189710, 1812804641, 1813167465, 1818860644, 1819164253, 1824377544, 1826567786, 1826567942, 1826568769, 1826574251, 1826586852, 1826591759, 1826593533, 1826594804, 1826595685, 1826597041, 1826838298, 1830073720, 1832102940, 1835526804, 1835527882, 1835530317, 1835531888, 1835536950, 1835540435, 1835541852, 1835548479, 1835548755, 1835552425, 1835554706, 1835556216, 1836706536, 1838062951, 1839007628, 1839021100, 1839022775, 1839033593, 1839038547, 1839040786, 1839994953, 1840001842, 1840013399, 1840019350, 1840019827, 1840020860, 1843076481, 1845608978, 1846070315, 1848013570, 1854921046, 1859450748, 1859510931, 1859511204, 1860240647, 1860312281, 1860334137, 1861101595, 1863024310, 1866891339, 1866893066, 1866896736, 1866908847, 1866910185, 1866914026, 1867191437, 1867861644, 1867861768, 1867865679, 1867867083, 1867872142, 1867873124, 1867876289, 1867885376, 1867885466, 1867887914, 1867888607, 1867892691, 1867898961, 1867899162, 1869137193, 1873521117, 1875950626, 1878219696, 1883713830, 1883718737, 1883722494, 1883726489, 1883992567, 1884025074, 1889208808, 1889317056, 1890185274, 1890552293, 1891315242, 1893129355, 1894534152, 1894535395, 1894543357, 1894548934, 1895822736, 1896748195, 1896864381, 1896883495, 1896884690, 1896893413, 1897086584, 1897144569, 1897150382, 1897161336, 1898308423, 1899713189, 1903920486, 1903920882, 1906518923, 1906815088, 1907758428, 1907908343, 1907910446, 1907911172, 1907924055, 1907926218, 1907937265, 1910568778, 1912588116, 1912664290, 1912773142, 1919704439, 1919708663, 1925589573, 1928014104, 1931786446, 1933270769, 1933847987, 1934282690, 1935832225, 1937137824, 1940180687, 1941545223, 1944881831, 1944883085, 1944889292, 1944901097, 1944907730, 1944915291, 1947690884, 1949378607, 1949381140, 1949385828, 1949388221, 1949404634, 1953208595, 1957126749, 1965980590, 1966393263, 1967560433, 1968030901, 1968344522, 1968345101, 1968345505, 1968353343, 1968354820, 1969952988, 1969953274, 1970271924, 1982830318, 1982831301, 1982836783, 1982854539, 1982856313, 1982857328, 1982862253, 1982863214, 1983945412, 1983946415, 1983946627, 1983953134, 1983957025, 1983968650, 1983971249, 1983972408, 1983977373, 1985096774, 1985106740, 1985116048, 1985122769, 1987352594, 1989155232, 1991785536, 1991792841, 1991799730, 1991811287, 1991817238, 1991817715, 1991818748, 1994019132, 1994026062, 1994028952, 1994613365, 2000627256, 2002587178, 2002703477, 2004055936, 2004062657, 2004080420, 2007546240, 2007547499, 2007556254, 2007557797, 2009780252, 2013938002, 2016158046, 2016458632, 2016459875, 2016461129, 2016470189, 2016476340, 2016482461, 2016485526, 2019785049, 2023148389, 2023153871, 2023155598, 2023156002, 2023157760, 2023171627, 2023174160, 2023812622, 2029256230, 2029286951, 2029296544, 2037064184, 2042215210, 2042272668, 2042423451, 2043073993, 2044012869, 2046744295, 2047386704, 2047490213, 2047625030, 2047828609, 2051192703, 2052284669, 2056364987, 2056365175, 2056459861, 2057257910, 2058376024, 2058382302, 2058436464, 2058440319, 2058445367, 2058448694, 2058452545, 2058552215, 2058569521, 2058573621, 2058924197, 2058929805, 2058958371, 2058984507, 2058988863, 2059003240, 2059051015, 2059075746, 2059422408, 2059824807, 2061714098, 2062014471, 2063260135, 2063415690, 2063627333, 2063814283, 2064238717, 2064313581, 2064484772, 2064499575, 2064635107, 2064635452, 2064635773, 2064639428, 2064639883, 2064648773, 2064654772, 2064655646, 2065476844, 2065542420, 2065542544, 2065543022, 2065727011, 2066567940, 2066734284, 2066828553, 2066833534, 2067202738, 2067233317, 2068031208, 2068725531, 2068831008, 2068854498, 2068854512, 2068858196, 2068859575, 2068860177, 2068862627, 2068863232, 2068869021, 2068950273, 2068994789, 2068994807, 2069062998, 2069102686, 2069161595, 2069263945, 2069338842, 2069365704, 2069468800, 2069558220, 2069561350, 2069566268, 2069591394, 2069593072, 2069595618, 2069600040, 2069600946, 2069600957, 2069604100, 2069765192, 2069904166, 2069904305, 2071035931, 2071149679, 2071643658, 2073289171, 2073308845, 2073310709, 2073312474, 2073322881, 2073335784, 2073440452, 2073448514, 2073457247, 2073500084, 2073509625, 2073523923, 2073533208, 2073640292, 2073794194, 2073803151, 2073803461, 2073808229, 2073811616, 2073811996, 2073815760, 2073826308, 2073826688, 2073827152, 2073830759, 2073831593, 2073831601, 2074299520, 2075044848, 2075423284, 2075693433, 2078935992, 2078936931, 2078937889, 2078937913, 2078938163, 2078938295, 2078944407, 2078944555, 2078944613, 2078944933, 2081181239, 2082063743, 2082285629, 2082430948, 2084946688, 2086083080, 2087431076, 2087431077, 2087431079, 2087431080, 2087431081, 2087431082, 2087431085, 2087431086, 2087431087, 2087431088, 2087431089, 2087431090, 2087431091, 2087431092, 2087431093, 2087431094, 2087431096, 2087431097, 2087431098, 2087431099, 2087431100, 2087431102, 2087431103, 2087617590, 2087617591, 2087617592, 2087617593, 2087617594, 2087617595, 2087617596, 2087617597, 2087617598, 2087617599, 2087617632, 2087617633, 2087617634, 2087617635, 2087617636, 2087617637, 2087617638, 2087617639, 2087617640, 2087617641, 2087617642, 2087617643, 2087617644, 2087617645, 2087617647, 2087617652, 2087617654, 2087617655, 2087617656, 2087617657, 2087617658, 2087617659, 2087617660, 2087617661, 2087617662, 2087617663, 2087629931, 2087822490, 2088302297, 2088726760, 2088953542, 2090213881, 2090218574, 2090297888, 2090298020, 2090439875, 2090439900, 2091225604, 2092577468, 2092702023, 2092715579, 2092766986, 2092957042, 2093991393, 2093995617, 2093995632, 2097113374, 2098599777, 2098599792, 2099138174, 2102249573, 2102285158, 2102285168, 2102285285, 2102285374, 2102286572, 2102291553, 2102297313, 2102301463, 2102304381, 2102311282, 2102312281, 2102313468, 2102315379, 2102317235, 2102322718, 2103529616, 2105684477, 2105873178, 2106751208, 2106757636, 2106766355, 2106769656, 2106775467, 2106775926, 2106776925, 2106781879, 2118750891, 2119037299, 2119037310, 2119041270, 2119043865, 2119381911, 2119891962, 2120136928, 2120142410, 2120143393, 2120151231, 2120152708, 2121629990, 2122433548, 2123414271, 2123472843, 2123472936, 2123472941, 2123472990, 2123473376, 2123479292, 2123481132, 2123481326, 2123481391, 2123481939, 2123481960, 2123482409, 2123482928, 2123482935, 2123485221, 2123485512, 2123485548, 2123486092, 2123487587, 2123487602, 2123487868, 2123488061, 2123488218, 2123489049, 2123491458, 2123491494, 2123491502, 2123491940, 2123491944, 2123491950, 2123491964, 2123492067, 2123492380, 2123492410, 2123492613, 2123492943, 2123493403, 2123494323, 2123494721, 2123494806, 2123495205, 2123495222, 2123495263, 2123495538, 2123495599, 2123495615, 2123495829, 2123496707, 2123496899, 2123496945, 2123497027, 2123497539, 2123498152, 2123498482, 2123498621, 2123498738, 2123499337, 2123499387, 2123499393, 2123499675, 2123499817, 2123499823, 2123500085, 2123500670, 2123501043, 2123501651, 2123501946, 2123502012, 2123502614, 2123502618, 2123502909, 2123502931, 2123502972, 2123503489, 2123503580, 2123503633, 2123503639, 2123503645, 2123503683, 2123503690, 2123503871, 2123503914, 2123503925, 2123506021, 2123508761, 2123508887, 2123508888, 2123509104, 2123509367, 2123510210, 2126830924, 2126831627, 2126831911, 2126831915, 2126834731, 2126838118, 2126839865, 2126841008, 2126851442, 2126854146, 2126854761, 2127933481, 2127939688, 2127940675, 2127945958, 2127950989, 2127966582, 2130163562, 2130164545, 2130170027, 2130187535, 2130190580, 2131286378, 2132327224, 2132331087, 2132359596, 2133546426, 2134655216, 2135730753, 2135744303, 2135751022, 2135766376, 2135766538, 2136033383, 2136198665, 2140379406, 2140382005, 2140404240, 2140405499, 2140406225, 2141369520, 2141378580, 2141384318, 2142607534, 2142608862, 2142616598, 2143588731, 2143590729, 2143592861, 2143597618, 2143609175, 2143615126, 2143616636, 2144000095, 2144838611, 2144844042, 2144846897, 2144858266, 2144868884, 2144870143, 2144870869, 2157945278, 2158338411, 2160318468, 2160324206, 2160325189, 2160333019, 2160343200, 2161569257, 2161578129, 2161578140, 2161592231, 2161595735, 2165898261, 2166038855, 2166996811, 2167003274, 2167004256, 2167015877, 2167018798, 2167213797, 2167993101, 2169327252, 2170481633, 2170487115, 2170488842, 2170504623, 2170507412, 2176528068, 2179101309, 2180545870, 2191744103, 2191744212, 2191821366, 2191883015, 2192566334, 2193960351, 2195897610, 2195898849, 2195906687, 2195916612, 2195922100, 2196631346, 2205406696, 2211506222, 2216825796, 2219145843, 2221394610, 2225058301, 2225061335, 2225064134, 2225071439, 2225073075, 2225080536, 2226037368, 2226044042, 2226051203, 2226052893, 2226055388, 2226060342, 2226419862, 2229788675, 2230793522, 2230840997, 2231615745, 2231617728, 2231623210, 2231628742, 2231632031, 2231633170, 2231633764, 2231638049, 2231729235, 2231751291, 2231760201, 2231761216, 2231769054, 2231770037, 2231775519, 2233884981, 2235097422, 2235100587, 2235101313, 2235108032, 2235109598, 2235116887, 2235119589, 2236869449, 2241796550, 2241797549, 2241806680, 2241812579, 2242828527, 2246244298, 2246245281, 2246250763, 2246260079, 2246271316, 2247223374, 2247249937, 2247251096, 2248592412, 2250708942, 2250715407, 2250719552, 2250724971, 2250725805, 2250733692, 2250734937, 2250735952, 2258665553, 2258878642, 2264886749, 2266447633, 2267607e3, 2274782645, 2282544968, 2285662351, 2290599544, 2292158595, 2293175691, 2293351636, 2296071446, 2299255515, 2301040846, 2306079466, 2307580553, 2313504811, 2318220358, 2320224028, 2325476095, 2337176745, 2339504386, 2344847762, 2345345412, 2345556981, 2346482211, 2346482871, 2351498341, 2352240646, 2352738840, 2358991500, 2361087993, 2364634824, 2371011349, 2373457221, 2376425283, 2379512524, 2379580075, 2390286898, 2390518325, 2390736011, 2392516839, 2392521063, 2400874900, 2400879124, 2402335630, 2404974948, 2405102721, 2405117283, 2405120727, 2409238241, 2414810349, 2415093005, 2415923742, 2415925541, 2415935547, 2415976346, 2418152088, 2422623072, 2422625395, 2422631927, 2422634373, 2422636295, 2422636392, 2425962056, 2425963043, 2425969250, 2425969487, 2425971892, 2425985030, 2428197348, 2428202830, 2428203813, 2428211643, 2428212914, 2428213376, 2428240545, 2430223084, 2433759338, 2433759634, 2433760321, 2433765803, 2433783311, 2433785126, 2433786356, 2433788522, 2435993901, 2436000108, 2436001095, 2436011657, 2436026994, 2437110252, 2439339076, 2439340079, 2439340291, 2439346798, 2439350689, 2439362314, 2439364913, 2439366072, 2439371037, 2439876345, 2440431898, 2440444045, 2440449369, 2444112661, 2447928023, 2450527587, 2452264162, 2454797153, 2458316286, 2459819944, 2462285242, 2462802458, 2463186757, 2466741694, 2466758807, 2467213089, 2467545358, 2467601561, 2467655846, 2467686484, 2467740953, 2473985870, 2474042431, 2474150919, 2474285829, 2474577412, 2474661520, 2475343068, 2475470210, 2475772433, 2475877012, 2475877016, 2475892298, 2476213365, 2476552306, 2479517659, 2489453909, 2489531547, 2498555779, 2501597440, 2507278661, 2510852110, 2511694664, 2512156190, 2528764752, 2540805343, 2542362598, 2543008264, 2547140668, 2553182506, 2558063998, 2558416820, 2560726248, 2564751176, 2566787042, 2569608194, 2572602371, 2577853220, 2579803386, 2583084289, 2586020617, 2600402029, 2604613571, 2614694552, 2616608417, 2623678483, 2624091113, 2626979216, 2627765050, 2629831661, 2630340943, 2630577386, 2637047575, 2637160117, 2637393619, 2637589507, 2639283063, 2642320383, 2657728452, 2661288721, 2663538084, 2673250796, 2673678071, 2673953045, 2683622002, 2686768508, 2689921282, 2691751732, 2691869931, 2692015714, 2693065457, 2693628719, 2694158948, 2699054734, 2699567323, 2701589506, 2708247797, 2710218932, 2713114330, 2714570818, 2714658156, 2715859111, 2716538256, 2717691085, 2718235570, 2719851426, 2722275573, 2728431851, 2731033959, 2733567145, 2745064373, 2747735009, 2748168364, 2748310006, 2753354596, 2761147374, 2762813598, 2767767034, 2769808878, 2775691349, 2789347571, 2792452218, 2793624174, 2794767436, 2795183554, 2795185357, 2795205893, 2798224110, 2803597621, 2804113804, 2807804736, 2809486328, 2812191981, 2813025413, 2815428841, 2815585428, 2816618421, 2819662823, 2822221150, 2824682484, 2828575765, 2828866516, 2829935276, 2834927579, 2836892761, 2839658405, 2844621372, 2844815106, 2844828277, 2844958826, 2845489684, 2845638303, 2850816977, 2857120519, 2857193006, 2859698097, 2860702321, 2870435535, 2874906565, 2880233005, 2885526550, 2889073982, 2893961579, 2896360091, 2896815948, 2898520762, 2898642745, 2908250170, 2908376536, 2911135641, 2915014315, 2918403731, 2918486269, 2919235927, 2920587887, 2922468503, 2922493886, 2923084706, 2929584080, 2931398379, 2931402541, 2934893225, 2937779198, 2941551192, 2942859576, 2948690168, 2948867989, 2949433359, 2951266128, 2954570766, 2956489777, 2960184498, 2960188722, 2960612931, 2962892549, 2963032843, 2966548328, 2976545290, 2976620947, 2978924197, 2982913903, 2986096991, 2987284613, 2988637881, 2993692642, 2996709992, 2999106536, 3000568496, 3005531064, 3005732955, 3007175865, 3007286028, 3008753857, 3010444860, 3010880247, 3019938621, 3020499579, 3022866914, 3023311759, 3024482653, 3024795687, 3024807531, 3027071777, 3029820267, 3032088673, 3032839979, 3033043261, 3033965900, 3036878933, 3037343835, 3038234864, 3051293097, 3052701732, 3055037923, 3056484673, 3060407188, 3061523114, 3071254387, 3071254500, 3071254881, 3073058130, 3074871971, 3074935051, 3075008146, 3075048985, 3075285442, 3075422693, 3075548305, 3075766008, 3075860343, 3075962648, 3076097045, 3077391764, 3079190285, 3085252246, 3091553195, 3103424085, 3107541791, 3107727924, 3107749241, 3107778469, 3107783354, 3107787446, 3107790299, 3107948057, 3107956419, 3107974264, 3107984588, 3107991466, 3108296169, 3111583245, 3113459538, 3116256345, 3116975703, 3117043431, 3121647752, 3123411243, 3123445549, 3123737595, 3127243644, 3131616468, 3134139083, 3134716611, 3141709512, 3148676509, 3154082174, 3155375542, 3160028447, 3163162577, 3163167462, 3163515572, 3163650864, 3172095015, 3178395499, 3179705353, 3183658699, 3187099641, 3187299343, 3189362935, 3189614929, 3189845278, 3191231848, 3191324353, 3196795314, 3196799538, 3197664642, 3200115829, 3202732235, 3206363778, 3207294280, 3218691622, 3224832477, 3226582088, 3231960701, 3231960825, 3238444781, 3240506687, 3241127686, 3245505639, 3246685420, 3255250502, 3255475289, 3255493270, 3258010725, 3259268259, 3259708744, 3272088211, 3277477189, 3287497511, 3289363789, 3294281816, 3300709686, 3302430666, 3307080284, 3310372188, 3310580422, 3313110325, 3317570505, 3323504524, 3331794938, 3332552236, 3344936763, 3351242611, 3351386507, 3354164541, 3356161036, 3357443896, 3358280978, 3360549707, 3361435146, 3362509089, 3362630778, 3366341181, 3366920760, 3368509209, 3372160500, 3373297021, 3374596217, 3375285141, 3377755895, 3379029866, 3380241983, 3380595728, 3381834713, 3385946526, 3386125251, 3388057612, 3393544563, 3404840083, 3405857857, 3407191084, 3408814815, 3408819560, 3409018494, 3409457570, 3410577155, 3411051814, 3411102162, 3413983999, 3416635233, 3418887913, 3424150275, 3424328663, 3424396902, 3424402597, 3424461304, 3424574116, 3424937078, 3425024187, 3425041814, 3425042139, 3425175341, 3426036948, 3426656604, 3429124e3, 3430316367, 3430320824, 3430870942, 3431771155, 3432731814, 3434192147, 3440930072, 3441289467, 3448289841, 3448536520, 3452859864, 3455445539, 3455973701, 3456106851, 3456282588, 3457601666, 3463597433, 3467469261, 3473077716, 3481649290, 3487446962, 3488816292, 3495434909, 3503723552, 3503962589, 3503975251, 3504111353, 3504116046, 3504274912, 3506277065, 3508805241, 3509081590, 3511319965, 3513566261, 3515728076, 3515960057, 3516630755, 3523519258, 3526432473, 3530287752, 3530798581, 3531066474, 3531601080, 3531878476, 3532265658, 3532567787, 3533680386, 3538145547, 3539874876, 3540002868, 3540019679, 3541120058, 3551826674, 3554146688, 3557238629, 3557288966, 3560409651, 3560721423, 3560755308, 3560772904, 3560776799, 3560843986, 3563273081, 3564228288, 3564677062, 3564681286, 3567399383, 3582031081, 3584271853, 3584286131, 3585048866, 3585049834, 3585528102, 3593775985, 3599378282, 3602300234, 3607509617, 3611661676, 3611790203, 3621965124, 3621966081, 3621966083, 3621968414, 3621969916, 3621970585, 3621975893, 3622095083, 3622538650, 3627671724, 3631197772, 3636965307, 3639447013, 3650032210, 3667545339, 3668394990, 3668555001, 3668632957, 3671699945, 3674122558, 3682693088, 3690182854, 3691035506, 3691048605, 3691317036, 3693068020, 3697923226, 3699114476, 3702342894, 3706900355, 3708334595, 3709045244, 3712703179, 3712728440, 3712733478, 3718845099, 3718930524, 3720827503, 3728968422, 3729352785, 3730027878, 3734185373, 3735541918, 3737224996, 3738382782, 3738387349, 3738389800, 3738389990, 3738390006, 3738390241, 3738390427, 3738394220, 3738394620, 3738394722, 3738394744, 3738394859, 3738396519, 3738397033, 3738399064, 3738400460, 3738887202, 3738887334, 3739466542, 3743223168, 3743289449, 3744330913, 3745299015, 3748385635, 3749221030, 3756564018, 3766265917, 3766587032, 3767014136, 3767872686, 3768672199, 3771460344, 3771941409, 3772113601, 3772128853, 3772772804, 3776028623, 3776032376, 3777321837, 3777702607, 3777706691, 3777840696, 3778052019, 3778877784, 3788596678, 3788641118, 3789096147, 3790949066, 3792555306, 3792675197, 3794434962, 3795445637, 3799396589, 3802359444, 3802425981, 3802900168, 3803509878, 3803533553, 3803824710, 3817195077, 3825134626, 3831783888, 3836226283, 3837130236, 3839963077, 3842564401, 3842605521, 3845461162, 3845489549, 3848928610, 3854658802, 3856336918, 3857323999, 3858008723, 3862352064, 3863661320, 3867966833, 3870049918, 3871085378, 3871829833, 3872291932, 3872427595, 3873740388, 3875975886, 3876231871, 3878080222, 3881750832, 3882302039, 3886373040, 3890622701, 3890644440, 3890892359, 3896043913, 3896689307, 3899279503, 3900747045, 3906847659, 3911916015, 3927826024, 3935292304, 3943337509, 3944324480, 3944448839, 3945529821, 3947301018, 3949488650, 3950038675, 3952494101, 3960241116, 3960376152, 3961917741, 3963099658, 3963421060, 3963723254, 3967007952, 3967259205, 3969124422, 3970612783, 3970678261, 3973713485, 3975040093, 3975243357, 3975693785, 3987058095, 3989825156, 3989847268, 3990634986, 3990704705, 3992681822, 3994071046, 3995478227, 3998971354, 3999298006, 4000670401, 4000993351, 4001099777, 4001277861, 4001735503, 4002465742, 4003357293, 4005356768, 4007925342, 4011050686, 4011066530, 4011075332, 4011273939, 4011552428, 4011788459, 4012217148, 4012217259, 4024186918, 4027830515, 4028975169, 4029110469, 4029583348, 4030423947, 4031498693, 4031499367, 4031499504, 4031509172, 4031928713, 4032208645, 4032479130, 4033316487, 4036743247, 4038287798, 4038545865, 4040900190, 4042024153, 4059950647, 4061045790, 4064482362, 4064482494, 4064686007, 4068398139, 4074270800, 4074270919, 4074308286, 4075674315, 4075712516, 4075885548, 4078878227, 4080178633, 4081049105, 4089654486, 4090206590, 4090679933, 4091412422, 4095259202, 4095274203, 4097043581, 4097047544, 4097047888, 4097050487, 4097053538, 4097094723, 4097094855, 4097218811, 4097289420, 4097298261, 4097355529, 4097358800, 4097358806, 4097359478, 4097365147, 4097365569, 4097368351, 4097368475, 4097373732, 4097381131, 4097390898, 4097493023, 4097494448, 4097500420, 4097504860, 4097508952, 4097518447, 4097523657, 4097528230, 4097528249, 4097565588, 4097595928, 4097769515, 4097769660, 4097770040, 4097900631, 4097993352, 4097993363, 4098078311, 4098093255, 4098096816, 4098101881, 4098102013, 4098120408, 4099257624, 4099391059, 4100119818, 4101141701, 4101990706, 4102099355, 4102141580, 4102295291, 4103385373, 4104416776, 4108421678, 4108481771, 4113654278, 4119925923, 4120143040, 4120685305, 4120832270, 4121323786, 4122670575, 4122797449, 4123137490, 4123141719, 4123166778, 4123237466, 4124517918, 4124852870, 4126190390, 4126265264, 4126330058, 4126584791, 4128561486, 4130538182, 4130665595, 4135804702, 4138805004, 4138959002, 4139959493, 4142649353, 4143010615, 4143011353, 4149276818, 4149741566, 4155964946, 4160851306, 4165043845, 4165602674, 4166101816, 4168666626, 4168671212, 4169534192, 4169538416, 4175499442, 4178182706, 4179726175, 4180321577, 4180398911, 4180437564, 4180584501, 4180592595, 4180655876, 4182610142, 4190427894, 4190436241, 4190438903, 4190464587, 4190536489, 4191350062, 4197904504, 4208748285, 4213114634, 4213114766, 4213115878, 4213133169, 4213139443, 4216213600, 4229539334, 4230260404, 4236039784, 4239211903, 4244301284, 4244359264, 4244636840, 4244650461, 4244697370, 4246504751, 4248927363, 4249781266, 4250093591, 4255547342, 4269915810, 4271230391, 4273205904, 4280822506, 4281987205, 4281991429, 4288642117, 4290818353, 4290862694, 4290938088, 4291163255, 4291519114, 4292375442, 1842, 113029, 2431109, 9085905, 9674111, 10454523, 11833936, 15005411, 29039073, 29369909, 32348563, 32392946, 34831997, 35241656, 35407085, 38660731, 41719852, 42040525, 44148994, 49751269, 54657448, 54829135, 56701348, 61297674, 64435235, 64616140, 64789207, 64792746, 65243007, 69912355, 73497087, 75564691, 82422700, 84754216, 88950783, 95227810, 97869711, 98556036, 99860970, 100645653, 111529024, 118457586, 119013459, 124940101, 129204800, 129504899, 132934253, 133576354, 139644807, 140643360, 141325108, 142928709, 144351849, 147399388, 147811980, 148485881, 153516070, 162751717, 163986572, 164324729, 165069240, 165136294, 165136894, 165338893, 166383271, 169804649, 169909381, 170281316, 170281555, 170281599, 170281951, 172221532, 172281155, 172281601, 172282023, 173287589, 173930363, 176745749, 176745997, 176746509, 176746841, 176746843, 176844018, 177079695, 177546706, 178721594, 179139641, 179379975, 179569944, 179956098, 180259371, 181198501, 181205574, 181240422, 181950714, 182150488, 182892938, 183129361, 183468910, 183469260, 186043176, 187501046, 187763081, 189174183, 190912115, 191120173, 193357074, 193420201, 193885172, 193990734, 194024818, 194130004, 194267945, 194407569, 195040605, 195184107, 195615400, 195788148, 197577014, 201802654, 202716248, 203969128, 204000291, 204003102, 207663471, 208540214, 211702237, 213315812, 216283771, 216404638, 221220686, 225036633, 233832515, 235585683, 236122625, 238349947, 244953360, 244983020, 253603556, 270508724, 274628826, 279497384, 282260013, 282734069, 286117940, 288337735, 294222691, 294944592, 297796540, 299806932, 302133360, 305396028, 309814229, 316711416, 319659866, 321667918, 322393118, 323472705, 329290740, 336073493, 344556873, 345150446, 345725228, 346582968, 348036069, 348240977, 349085323, 352942917, 353468686, 356549889, 361618841, 362641227, 363650316, 371447569, 379803748, 381683792, 384388494, 388445241, 390037588, 392534911, 393050977, 393824765, 398079720, 401473592, 404580880, 408076405, 409551689, 412923104, 413989960, 417762611, 418643706, 419980117, 420076057, 423460135, 424671062, 425269591, 425273951, 430774757, 430888404, 431128362, 431420666, 431463230, 433024678, 433601547, 433960232, 434424313, 435581614, 435734242, 440990792, 443167100, 448347366, 449230284, 450319806, 453082265, 459993498, 467355959, 468677861, 470584767, 474853468, 478194174, 481007914, 483933287, 492579864, 492820046, 495294245, 500922416, 501132892, 502571724, 503870109, 505520155, 505540840, 505547348, 507674743, 507704542, 508732896, 508756709, 518314331, 524499536, 527090713, 528698966, 532828844, 533082472, 536472645, 536606854, 536706420, 543383677, 544035780, 545100578, 545520298, 547829195, 548068662, 550157112, 554422931, 554479688, 557980541, 558904957, 559619560, 560236326, 566123574, 569085212, 569128746, 575078226, 579214441, 582810837, 582830896, 582836839, 583362052, 583453417, 594063106, 598128236, 601157755, 601161740, 601948346, 602413319, 603986209, 605582466, 609198625, 610045978, 617827459, 620396524, 626039263, 626988485, 629099694, 630452394, 635400744, 640415961, 643558590, 645257576, 652659119, 656273907, 665354414, 666296511, 666839269, 667333922, 668403785, 669929645, 681124787, 682364285, 689215333, 699075989, 704136516, 706383966, 708808466, 710978465, 712995495, 717519098, 722655660, 722956329, 725449644, 727209749, 729977159, 734622016, 735035205, 737152212, 737166334, 737644692, 737837074, 739516787, 739566545, 739985822, 741816033, 742260586, 745092996, 745620605, 747930588, 748263061, 750219296, 750508933, 752522257, 753857751, 754000708, 757807602, 758376308, 758478444, 761228031, 762067870, 762641736, 764248075, 764320946, 766296725, 766355544, 766543587, 766643209, 766774330, 767540529, 772363084, 774299734, 777688891, 787564577, 789530990, 792068311, 792844833, 795680507, 796533587, 800010738, 800087019, 810061706, 810813298, 811092091, 817847511, 819009519, 819011131, 826260124, 833658992, 834470340, 839856739, 841338378, 842147301, 847675799, 861294299, 862950715, 867021650, 867036335, 869064225, 870151875, 874296659, 875096251, 875944810, 876149555, 879009267, 884498580, 887482102, 893652881, 894264732, 896104248, 896979123, 897240751, 902139830, 911653942, 912249299, 918271732, 919599881, 927052135, 933697266, 933717702, 933742623, 939098524, 939114841, 945413839, 948752149, 955130439, 955354780, 955942299, 956480228, 958121442, 961145400, 966830075, 968732370, 970076747, 972273212, 976185771, 976381303, 978919739, 980011820, 981829565, 984418838, 997412732, 1001458257, 1001637783, 1001651627, 1003192987, 1005191377, 1010556097, 1012937200, 1016009727, 1016348317, 1019849895, 1023879932, 1024317101, 1027856392, 1032266307, 1033049924, 1035709107, 1041294385, 1043437244, 1049779946, 1051535617, 1053737172, 1054370922, 1056150770, 1056645919, 1056720884, 1059758114, 1063952736, 1064188994, 1064732809, 1064857294, 1065290596, 1080478458, 1081536009, 1086069586, 1088535269, 1090938281, 1094421058, 1095718313, 1096687866, 1100372480, 1101019943, 1101043104, 1102004406, 1104733017, 1110237878, 1112959177, 1113096701, 1113651864, 1114972095, 1118952562, 1125668821, 1128494983, 1130216203, 1132104794, 1132534664, 1132579070, 1132598106, 1136018325, 1137104375, 1138832527, 1145147923, 1145899518, 1146014840, 1146523166, 1149204820, 1151262913, 1152056864, 1154446700, 1154536335, 1154536715, 1154542665, 1155367440, 1155994599, 1158265339, 1158326174, 1161218045, 1164964007, 1166033123, 1166422202, 1167024992, 1167025137, 1171269392, 1174582808, 1174756828, 1179491634, 1181469438, 1186977866, 1187653498, 1188208310, 1189560180, 1191923730, 1192723278, 1195304992, 1198195980, 1199133859, 1199554249, 1199600208, 1204911535, 1208370349, 1208429990, 1210779948, 1210807525, 1221782335, 1221920801, 1222146519, 1222596609, 1236932222, 1238449939, 1246474378, 1257256866, 1257395124, 1257876060, 1257878939, 1258281930, 1259689738, 1260820433, 1260836076, 1261324364, 1268763191, 1269301612, 1271531819, 1273274467, 1282928227, 1283757717, 1296235125, 1301946320, 1305140481, 1308857550, 1310807544, 1310899277, 1312056732, 1312163653, 1316036626, 1316125796, 1324285266, 1324310094, 1324331646, 1324337571, 1324579984, 1325750278, 1326569216, 1332893391, 1333842476, 1349684561, 1351415139, 1351558342, 1351862653, 1351880550, 1354386923, 1356250756, 1356331589, 1356360705, 1357629674, 1362733356, 1363404812, 1364008114, 1364487272, 1365133140, 1365599531, 1365623138, 1366730785, 1366987615, 1372705460, 1372794328, 1373871548, 1375834117, 1377641421, 1378095694, 1378253217, 1383623210, 1389962149, 1391288061, 1391291390, 1391293134, 1391299074, 1391300548, 1391306067, 1393577155, 1394469288, 1394469303, 1394469473, 1394469866, 1394470005, 1394470066, 1396870772, 1398550692, 1399867662, 1413067533, 1419304208, 1423547895, 1430902259, 1431096661, 1435770227, 1436788950, 1441443055, 1441473969, 1443172426, 1444705872, 1444722875, 1444727957, 1445594238, 1447082963, 1448082324, 1455246557, 1457519039, 1458493639, 1459794391, 1460930084, 1465058743, 1465974914, 1465976327, 1465976425, 1465976436, 1465976550, 1465976625, 1465976632, 1465976747, 1465976986, 1465976991, 1465977196, 1465977261, 1465977274, 1465977303, 1465977323, 1474444421, 1478092049, 1478716185, 1481566528, 1482522967, 1489772937, 1492902674, 1494181387, 1503721626, 1504535254, 1509029106, 1510450262, 1511907991, 1512683093, 1515598870, 1519441587, 1520424549, 1522685369, 1525831150, 1526085253, 1527459723, 1529619411, 1532042759, 1533712942, 1535986906, 1537663939, 1539580287, 1539879505, 1539902893, 1541073018, 1541496652, 1542773859, 1549199388, 1549209224, 1549210203, 1553692884, 1555806428, 1561102750, 1561615369, 1570440897, 1570561776, 1571877627, 1573188605, 1578795427, 1582406800, 1585380899, 1587251606, 1592687509, 1594093747, 1600551222, 1601662530, 1602151715, 1602222565, 1604313702, 1610724928, 1613430619, 1616149762, 1616623247, 1616826805, 1622345684, 1624120544, 1630208269, 1631446240, 1634840328, 1635306209, 1637735434, 1639041637, 1640826914, 1643893360, 1645239134, 1645714411, 1645721939, 1646967505, 1647700483, 1648026812, 1648459154, 1652482428, 1654623339, 1656524016, 1659538076, 1660752253, 1661285202, 1661619318, 1662950537, 1664993389, 1675032552, 1676328914, 1681382184, 1682883176, 1683407715, 1684605451, 1684964181, 1686375531, 1686572406, 1687236156, 1687238599, 1688631229, 1688907428, 1693905970, 1694678234, 1696017211, 1697022103, 1698247372, 1700196518, 1700874190, 1702743585, 1704831752, 1705503614, 1705572464, 1705775316, 1705920264, 1708553688, 1709604401, 1711224201, 1713051167, 1715999558, 1716087943, 1716947524, 1721557559, 1722492001, 1724478613, 1724631897, 1728197301, 1730378323, 1730461660, 1732377833, 1740500925, 1747349646, 1747349737, 1747349747, 1747349811, 1747350242, 1747350353, 1747350383, 1747350483, 1747350570, 1754249179, 1757526884, 1758838683, 1759487629, 1759488516, 1759498393, 1759499821, 1759502442, 1759502966, 1759512274, 1759512283, 1759513528, 1759514495, 1759514515, 1759516437, 1759524172, 1760335250, 1762975960, 1762992044, 1763004314, 1771261987, 1772061961, 1772164204, 1772417482, 1772475101, 1773460108, 1775305704, 1778177081, 1782043531, 1788148481, 1789421301, 1793905730, 1800839994, 1801140929, 1801396125, 1804673412, 1806579373, 1813955111, 1814430790, 1816595094, 1817436421, 1822787251, 1827892416, 1828043124, 1839996532, 1839996844, 1841030555, 1842344296, 1842560365, 1844006530, 1844448916, 1844480213, 1846724376, 1853272628, 1856607747, 1861064328, 1863000850, 1867708596, 1868655428, 1869007419, 1872936175, 1873773882, 1873774456, 1873775792, 1873776479, 1874142716, 1875798230, 1877413368, 1880233189, 1882601503, 1885862630, 1887960381, 1890372289, 1891031342, 1891205640, 1891938925, 1892631265, 1896919160, 1896919227, 1896919294, 1897898461, 1899147627, 1900573373, 1901379444, 1902628941, 1906789934, 1906790006, 1906790139, 1906795057, 1906796594, 1906797455, 1906801573, 1906801694, 1906806837, 1906810233, 1906810485, 1906811690, 1906812875, 1906817274, 1906818921, 1906820915, 1906820924, 1906823423, 1906823469, 1906857590, 1906857691, 1906857989, 1908003407, 1918700844, 1921631441, 1925206882, 1927020241, 1928994e3, 1934036927, 1936188797, 1939984501, 1939994885, 1941474619, 1944071536, 1945201987, 1946130305, 1946324244, 1947055740, 1948193468, 1949193282, 1951127334, 1951598957, 1960661844, 1964294607, 1968339113, 1971670426, 1973838680, 1975660003, 1977074332, 1977076352, 1979063800, 1987660949, 1991785763, 1992080509, 1995174355, 1995890751, 2001507875, 2004392121, 2004488903, 2015900220, 2018783243, 2021213332, 2023260368, 2025018361, 2025037989, 2025039155, 2026455612, 2026543248, 2027114414, 2034028822, 2034497157, 2034927376, 2035815698, 2037403782, 2037552632, 2038238057, 2038463378, 2038609522, 2040354520, 2040943501, 2041028464, 2047340057, 2047377876, 2047791608, 2047824538, 2050823774, 2050838609, 2051525062, 2051827668, 2052255777, 2052901511, 2053206810, 2053240934, 2053478875, 2053493456, 2053853373, 2054449324, 2055229681, 2055578022, 2056180496, 2057710300, 2058751811, 2058759336, 2058759788, 2059048621, 2061275137, 2061282643, 2064241908, 2066721635, 2067699997, 2071301924, 2075934693, 2077460241, 2077463931, 2078177352, 2082273412, 2082279457, 2082340026, 2082350395, 2082490504, 2084905908, 2087383811, 2087506861, 2087568425, 2087595516, 2087950666, 2092046651, 2092301721, 2092419132, 2097381010, 2097529923, 2100199727, 2103470828, 2107063121, 2107436658, 2113664954, 2116750738, 2117068897, 2119040128, 2122563214, 2122618177, 2124668692, 2133443920, 2133514276, 2133540902, 2134191641, 2134715695, 2138494997, 2140204319, 2142609419, 2142633914, 2144770101, 2146688546, 2148535197, 2151094932, 2151644274, 2153187194, 2156215921, 2163712208, 2164607930, 2168105062, 2176727539, 2177318798, 2178944930, 2179027416, 2184528600, 2185606643, 2186571792, 2187374596, 2190645414, 2190660247, 2190897184, 2194211966, 2194876236, 2194876314, 2194876881, 2195314033, 2195413098, 2195424198, 2203121973, 2211529485, 2216861598, 2219976143, 2224936471, 2229428098, 2233205867, 2235535537, 2238302643, 2239584661, 2242523496, 2243922068, 2246095470, 2249578444, 2251500542, 2253395698, 2256423319, 2257131811, 2258848076, 2259012151, 2265403416, 2269793269, 2277922362, 2278366865, 2281444864, 2283990470, 2284221844, 2290521795, 2298483014, 2298859942, 2303709693, 2305684069, 2306183534, 2309632352, 2313038876, 2315634657, 2317618110, 2319104481, 2326416557, 2327685947, 2330979339, 2331542577, 2339348712, 2340481172, 2340483598, 2340566443, 2343955873, 2343987387, 2344081298, 2344135862, 2354634240, 2357782940, 2360233424, 2362899900, 2365749167, 2368305640, 2372460029, 2372478071, 2378367797, 2380959235, 2384339112, 2385564998, 2387086868, 2391410598, 2392072803, 2393811335, 2399346319, 2399662383, 2399865739, 2401643245, 2401782259, 2403261116, 2403870591, 2406918497, 2407789481, 2409182571, 2417084170, 2417165267, 2417652035, 2419411749, 2419417423, 2422324904, 2423117096, 2424431334, 2424771770, 2432634086, 2433143557, 2435584133, 2436015021, 2441679501, 2441854846, 2444838503, 2451094457, 2453483137, 2453497460, 2454223125, 2454448917, 2456215407, 2459247176, 2463271525, 2463506842, 2467234433, 2469945372, 2473920266, 2476783882, 2485004952, 2486666796, 2489018185, 2489169796, 2490201095, 2490847830, 2491969832, 2492970238, 2497220049, 2503042985, 2515254157, 2518379243, 2518777282, 2525588137, 2525608018, 2528358668, 2531896313, 2539686262, 2542890487, 2545443378, 2551310943, 2554772601, 2556085817, 2558131228, 2564231467, 2564346385, 2568929373, 2569358076, 2571159128, 2572746788, 2575905107, 2579846032, 2582295686, 2585286228, 2585297154, 2587884409, 2587999085, 2590263013, 2592032772, 2597156358, 2600208325, 2602467246, 2614031703, 2617427457, 2622453927, 2622601193, 2635726130, 2636739119, 2637611531, 2637745410, 2637827916, 2639832942, 2644708943, 2646831691, 2652889161, 2656916375, 2658971428, 2660417858, 2669967601, 2671812960, 2675377616, 2677517890, 2677527742, 2680331975, 2682569422, 2687839420, 2688047810, 2692646873, 2694622232, 2707358863, 2707431632, 2708098424, 2708256980, 2721005193, 2721996537, 2727613517, 2729386864, 2732129495, 2737608016, 2738025026, 2739504392, 2743561936, 2745053658, 2748129339, 2755346949, 2756835810, 2758308210, 2760059768, 2762308724, 2772048233, 2773342582, 2774237802, 2777215669, 2779765943, 2780442125, 2780900117, 2784038323, 2786612080, 2787145966, 2787151566, 2791623281, 2793843165, 2794535853, 2794558276, 2794571602, 2794589073, 2794607684, 2794781905, 2794812897, 2794904579, 2795201682, 2795215251, 2795316793, 2795413889, 2795489178, 2795518714, 2795546979, 2795547152, 2795551511, 2795554576, 2795555553, 2795567189, 2795581043, 2795588603, 2796767057, 2797512177, 2799152382, 2799526810, 2799947922, 2802973072, 2804403738, 2804874542, 2805637755, 2805753744, 2809447657, 2812187177, 2812916202, 2815541885, 2820491263, 2822394574, 2829422945, 2831048350, 2832237259, 2834623189, 2837348717, 2839958087, 2840525902, 2841159353, 2842490055, 2843506215, 2844781614, 2846385194, 2846982791, 2849248490, 2849860412, 2850213786, 2852028874, 2852573181, 2854701866, 2854943229, 2855519660, 2857974075, 2859686627, 2866201598, 2873369054, 2873382924, 2878248977, 2878625875, 2880150758, 2882016813, 2889508141, 2894321712, 2896549226, 2900972274, 2905747927, 2907164383, 2909422460, 2910191497, 2912050734, 2914081458, 2914744694, 2914938714, 2915009556, 2916482073, 2917041430, 2918571873, 2924790692, 2931708704, 2931991392, 2932164581, 2932643151, 2933052029, 2935350303, 2939956665, 2940702931, 2943539162, 2944512053, 2944562948, 2945364171, 2947166646, 2950332665, 2953032334, 2953041500, 2955690868, 2958695479, 2959025464, 2963193938, 2963907974, 2964323647, 2965610869, 2969439522, 2972958854, 2976917923, 2978201778, 2982085395, 2985605450, 2992765158, 2996423818, 2999691650, 3003669621, 3003669622, 3003669626, 3008190733, 3008855969, 3016122305, 3017646001, 3023062741, 3023766416, 3029366772, 3031325313, 3032047068, 3036119914, 3036992672, 3039024727, 3042813479, 3043177368, 3044984954, 3050467218, 3051886594, 3053067553, 3053287882, 3062030652, 3065890236, 3065938060, 3067331584, 3067801157, 3067842181, 3068762275, 3074108603, 3077857486, 3080857101, 3087935921, 3088190003, 3091255985, 3095401268, 3096813247, 3098725318, 3105671535, 3111527444, 3115079967, 3117883740, 3118052513, 3118932015, 3119183299, 3121944857, 3123256667, 3124299682, 3124496054, 3126706525, 3129135980, 3130292716, 3136193853, 3138538729, 3142466124, 3143250549, 3145203874, 3146277579, 3146688e3, 3150523560, 3151212508, 3154412692, 3155723084, 3156177950, 3164499075, 3164706839, 3168577861, 3171832589, 3173559921, 3174529089, 3176196996, 3176871024, 3180784320, 3180964696, 3181226348, 3185392090, 3187205025, 3188304803, 3189849017, 3190997898, 3192015124, 3194172481, 3200818130, 3206103617, 3212240200, 3222057289, 3229338204, 3231038915, 3236684869, 3240062262, 3243217472, 3244361100, 3245554401, 3249410406, 3254464708, 3257959952, 3258011239, 3274402918, 3276160836, 3276181105, 3276196901, 3278107133, 3289739448, 3290502878, 3291450742, 3293286977, 3293297241, 3296419295, 3299472058, 3299767442, 3301223392, 3301309499, 3301391192, 3304599725, 3306064327, 3308237550, 3313552392, 3328014532, 3331885553, 3332277580, 3333914252, 3337182013, 3337858974, 3341471161, 3342158460, 3343555600, 3345774854, 3347209717, 3350345047, 3350816321, 3351869587, 3352060268, 3355691995, 3356175586, 3357239148, 3361938502, 3362723114, 3366755503, 3367073048, 3367944003, 3372319994, 3375346812, 3376868662, 3380047964, 3382258705, 3385088233, 3389287501, 3391503522, 3392485763, 3392548719, 3392751068, 3403435361, 3403782237, 3406109171, 3406111906, 3407120290, 3407122639, 3408196928, 3411575670, 3411908233, 3423045385, 3424242744, 3426100153, 3426523263, 3430187119, 3431675506, 3431798787, 3431896672, 3432167999, 3432725491, 3433958809, 3442215666, 3443103158, 3445734210, 3450482982, 3453219838, 3455171543, 3458629656, 3460581568, 3460835389, 3471910127, 3474158466, 3478804050, 3479897537, 3480605972, 3480868929, 3481097537, 3485240025, 3491815953, 3492209950, 3494777461, 3498728233, 3500328283, 3503925212, 3506796962, 3514555514, 3514565086, 3519718992, 3519725933, 3524188747, 3529349528, 3542452078, 3549966844, 3550700124, 3550989552, 3551573749, 3553175952, 3553442167, 3554781799, 3556847596, 3557221487, 3557691349, 3558264087, 3560824248, 3563344816, 3565186253, 3565418379, 3566074326, 3569886279, 3570187564, 3576593305, 3584104748, 3586564634, 3586945393, 3588013803, 3590119076, 3591676857, 3594103710, 3594126223, 3605649145, 3607964178, 3610130320, 3611466472, 3618863110, 3621805519, 3629119210, 3629792790, 3635135986, 3635459541, 3636074310, 3638424639, 3640911628, 3642130958, 3647798063, 3656108419, 3657615451, 3659534155, 3659534172, 3659611370, 3659667263, 3660545348, 3660867367, 3662104715, 3671487562, 3671864484, 3674207720, 3678946749, 3680027665, 3684023399, 3684591773, 3686510836, 3686613485, 3686646984, 3687433566, 3691543485, 3691543777, 3694814128, 3695175653, 3697285380, 3697415853, 3698130051, 3700803863, 3717443225, 3718851041, 3722297297, 3724304421, 3727475379, 3727535579, 3735375385, 3735382080, 3740438523, 3740440657, 3748157778, 3751843037, 3759175702, 3760229117, 3767579376, 3767636566, 3770939244, 3774416951, 3774620406, 3775107448, 3777554302, 3784459817, 3789217359, 3790213466, 3791430232, 3791505672, 3792756850, 3797275201, 3797334865, 3797547975, 3797752814, 3798120765, 3799727891, 3800284920, 3802208503, 3804066593, 3807736858, 3808570978, 3811590943, 3812650457, 3814583456, 3816238011, 3817828977, 3818244185, 3821631768, 3824973847, 3827674221, 3830752599, 3831121452, 3831131041, 3837373870, 3839962587, 3842157165, 3849728326, 3849729892, 3849734551, 3849787726, 3849792721, 3849819373, 3850951568, 3853184002, 3856121458, 3857014848, 3860607422, 3861431943, 3861926244, 3867504094, 3868548883, 3869648625, 3871255217, 3879613384, 3888702999, 3893630517, 3895969787, 3897018811, 3898712433, 3902486573, 3904611129, 3909678524, 3911290870, 3914258422, 3916138569, 3917283101, 3919381871, 3919568627, 3924938673, 3928836058, 3929271846, 3932881151, 3932899585, 3933213384, 3934007962, 3950379841, 3957651078, 3960912026, 3973890763, 3976040035, 3977971580, 3981048153, 3981060932, 3981985710, 3982983475, 3988202550, 3991078309, 3992022849, 3992259208, 3993609185, 4006426271, 4010941807, 4012569891, 4013412307, 4014322879, 4016735572, 4021161495, 4025854722, 4027536004, 4030686503, 4033312623, 4035527703, 4037300319, 4043405137, 4048222256, 4048420974, 4048962899, 4049948378, 4051811237, 4052267313, 4054339631, 4060910197, 4062598208, 4064836207, 4066383490, 4070580503, 4073707968, 4080427569, 4096860877, 4100449932, 4101511682, 4104807039, 4115427659, 4116271014, 4117626035, 4122766752, 4125939775, 4127381498, 4128299636, 4132054341, 4132795027, 4133480683, 4136878052, 4137094151, 4137128166, 4138537192, 4138587115, 4148483014, 4149336082, 4149626272, 4149641566, 4149809179, 4152090640, 4152153727, 4154732349, 4156628388, 4157060403, 4159166567, 4161006924, 4161031359, 4166727800, 4167095051, 4168702437, 4168921085, 4170608841, 4175490343, 4178043127, 4179607399, 4180201861, 4182917435, 4196816243, 4201195770, 4201710836, 4204344500, 4207814302, 4212159173, 4216249688, 4218603456, 4220181346, 4221072852, 4221621479, 4230252988, 4230808631, 4236867197, 4243509465, 4245730359, 4250048329, 4254397175, 4261049438, 4265986719, 4266150865, 4270257086, 4272517612, 4285995571, 4287463560, 4287809158, 4287924367, 4293141634, 4293320049, 7, 171252454, 314658260, 1911007288, 2310391087, 2705648135, 3085052283, 4199583372, 0, 0, 67, 66987915, 193433406, 366428436, 366991379, 487687151, 545941207, 716916462, 900018457, 911616432, 914855142, 981141093, 981156754, 992272510, 1135214957, 1135523977, 1201200239, 1213136917, 1357549542, 1437166305, 1491010671, 1491010869, 1612421885, 1881252413, 1964062562, 1983295731, 2035443912, 2412701058, 2447973967, 2572472237, 2572499572, 2572504631, 2647476763, 2726870506, 2734871983, 2819823116, 2856570282, 2856570297, 2873757688, 2905936018, 3147193074, 3147281891, 3229893628, 3497603669, 3576896779, 3613204738, 3628727675, 3797575573, 4020469118, 4072505995, 4072506010, 4072506013, 4072506057, 4072506072, 4072506079, 4072506084, 4072506156, 4072506170, 4072506173, 4072506189, 4072506203, 4072506204, 4072506218, 4072506235, 4072506236, 4072506350, 4072506360, 4072506367, 1982, 3609572, 4707302, 4731941, 7066741, 12732264, 12733869, 12874473, 12898727, 15239865, 15443925, 15464989, 17770158, 18806137, 22641470, 34805542, 37254453, 38352510, 47103897, 47124528, 47160482, 47264668, 47270558, 47521880, 47670735, 47682584, 48206184, 54052064, 55399270, 55790429, 57861540, 64629239, 65951659, 73540622, 74816563, 79005572, 79010572, 79432449, 79977826, 80960607, 90941114, 91781471, 93732497, 101061895, 101792620, 105281118, 114635485, 121111459, 126395821, 127613999, 134819976, 135124399, 135156325, 135512978, 139443164, 140195744, 146403274, 147165318, 147311351, 147680945, 154712981, 156193153, 157683252, 162021680, 165184869, 165682351, 167795310, 169177047, 169285407, 170248114, 175536255, 176298648, 181584625, 186190871, 188366635, 190461039, 190805290, 190817793, 191644192, 193330267, 200367649, 204872798, 208246903, 213994908, 222038678, 222914983, 226753977, 227658815, 230657663, 231976681, 232418677, 234224516, 235125560, 235385397, 235630461, 235880887, 236100347, 237106084, 237695302, 243768879, 244905302, 245221564, 245221621, 245248688, 246957980, 247379872, 247404538, 247547714, 249186148, 249832804, 250298968, 252007821, 252166643, 254498243, 256250975, 256734086, 257675257, 258276240, 260078806, 269653037, 270614174, 270803459, 279865482, 290747254, 296104342, 296106331, 296214241, 297365588, 297388265, 297388314, 297395043, 297872731, 297875338, 305678573, 310113063, 317059542, 318726251, 320983337, 321380700, 329390871, 340233049, 343985311, 368331859, 368339983, 374202536, 374729119, 377042975, 377218502, 377330983, 379160277, 387137528, 390536878, 397426025, 410462833, 410898354, 411028646, 415359567, 418289923, 418809394, 420699727, 422768411, 423087664, 434374676, 434499530, 439966930, 443910462, 444881445, 446735168, 470802373, 473022090, 475752042, 480190019, 481797890, 482141996, 493334140, 493996949, 494002753, 494111972, 496668263, 497004637, 505642028, 513006918, 520166698, 522732652, 524323805, 524791178, 525296785, 532366388, 537994409, 538156652, 539123093, 539125333, 540384923, 545724556, 546598380, 552815312, 564847266, 572585472, 572589595, 572660745, 572917514, 572938118, 581295982, 583116728, 584477771, 585356786, 585510953, 586974440, 588341431, 590260151, 593171510, 600861600, 602587622, 608185550, 608501e3, 611172806, 617227910, 620862123, 625412750, 626878575, 627192073, 628675473, 636454657, 644892435, 645708934, 646772532, 650376939, 653264074, 653865504, 654835286, 655274400, 657684596, 657843927, 665654464, 665772443, 667917050, 667982163, 668803663, 678409190, 685972429, 687873546, 699223116, 722349553, 723381066, 723506578, 725289629, 728910939, 728916446, 729301272, 730375222, 731520837, 731524865, 731524893, 733458327, 734942836, 742063133, 744425628, 745118723, 750501894, 753379261, 753585532, 755936840, 755999442, 757164322, 757742871, 758908039, 758927262, 766978617, 767310694, 767319597, 768502512, 775086059, 775783015, 776818569, 777129529, 782249017, 782470551, 782586541, 783225086, 783819749, 787058931, 793173186, 793643539, 793791572, 794069868, 797737785, 801549019, 805476735, 809560577, 810471911, 810660018, 813069363, 813965189, 814609400, 819689086, 822265343, 827811881, 828807618, 840895172, 842670706, 845178939, 849626506, 857304293, 867054787, 875581912, 878480613, 878489001, 888652626, 892902192, 904040802, 904780949, 904781069, 904781208, 904781211, 904781269, 904781270, 904781407, 904781445, 904781469, 904781569, 904781597, 904781741, 904781750, 904781797, 904781798, 907680375, 909542970, 913350787, 915552624, 943105427, 944616168, 945567936, 946059164, 946112067, 950116031, 950459761, 950797941, 950991772, 952407653, 954708706, 954904735, 956279390, 959296218, 959317553, 960000436, 960088334, 964474682, 965248297, 965252181, 968600148, 969495568, 969714387, 969714391, 969714751, 975014436, 976847064, 977515724, 978655375, 985441466, 985451059, 988676432, 989199112, 995754553, 995754557, 998100773, 998582596, 1001682227, 1002897238, 1005026102, 1007267340, 1018029509, 1019292109, 1021170671, 1021615491, 1027478448, 1027904949, 1028176876, 1028524011, 1033544761, 1037073656, 1039464298, 1041396131, 1043364491, 1051084878, 1053049944, 1055328538, 1055480209, 1058862972, 1066609925, 1068948457, 1071874351, 1072134738, 1082834847, 1084511341, 1087693738, 1089012798, 1089634494, 1093384439, 1093825560, 1094815391, 1098082937, 1102471353, 1113642022, 1113846049, 1121249692, 1127953536, 1132317159, 1132485954, 1132585385, 1132689597, 1132723356, 1132858392, 1133501028, 1133636064, 1134046361, 1134351151, 1134824033, 1135467502, 1135737574, 1135775689, 1136782059, 1136883336, 1137085890, 1137173922, 1138138823, 1138714596, 1139072942, 1139153897, 1139221159, 1139981182, 1140405028, 1140510661, 1141246959, 1141280718, 1141381995, 1141584549, 1141719585, 1141874653, 1142159541, 1142193300, 1142260818, 1142366610, 1144440814, 1144457023, 1144667374, 1144802410, 1145579956, 1145625081, 1147135141, 1147314976, 1148184718, 1148522564, 1149131059, 1150514349, 1150729533, 1151393172, 1151494449, 1153073825, 1154465661, 1155177503, 1156094385, 1156940664, 1158572559, 1160038984, 1160487168, 1161167906, 1161578459, 1161965872, 1162013821, 1163255421, 1163472226, 1163645377, 1163777146, 1163979700, 1164916562, 1165010690, 1165068597, 1165937726, 1165940993, 1166410608, 1167096330, 1167193469, 1167260731, 1167598577, 1169823858, 1170720439, 1171147706, 1171150005, 1180230175, 1180849387, 1188216287, 1188228500, 1188701654, 1190334387, 1190352716, 1190641324, 1202600586, 1206718941, 1209302133, 1214814043, 1216095517, 1220486075, 1223892937, 1224444732, 1225577971, 1229986049, 1243738793, 1247471306, 1252266596, 1252792940, 1253960230, 1254127330, 1255848785, 1255859538, 1257563663, 1257583343, 1258195056, 1258213434, 1262993336, 1263908042, 1265512654, 1267283463, 1278475387, 1281229947, 1281889125, 1284797630, 1288585218, 1290240457, 1290513099, 1293031053, 1295516865, 1297095740, 1297597617, 1298827289, 1298832842, 1299380998, 1300818337, 1304310342, 1304455504, 1310534169, 1316956180, 1336232039, 1337809090, 1340075459, 1343684265, 1347737800, 1348149256, 1354685816, 1355025196, 1357282216, 1357301365, 1363667295, 1364395531, 1364732891, 1373278040, 1373514813, 1373685873, 1375205051, 1375419602, 1376146087, 1380234474, 1380513046, 1381723825, 1382632688, 1382645602, 1382709874, 1386126578, 1388184353, 1389190819, 1389902309, 1389912616, 1390104485, 1390958270, 1391687090, 1391699393, 1393151104, 1395748391, 1395924208, 1397018707, 1397022500, 1397827261, 1398423514, 1400330808, 1401462671, 1410284129, 1411428439, 1412479074, 1412717811, 1412831927, 1420822802, 1423109435, 1423890423, 1424552007, 1425040900, 1428131728, 1431817030, 1431897749, 1433480127, 1433483767, 1434457973, 1451286836, 1451565010, 1452211848, 1452224159, 1455851258, 1458060161, 1458176029, 1458620255, 1463365872, 1466302404, 1472319400, 1475303091, 1484355552, 1486115226, 1486401243, 1489893113, 1490054949, 1492145100, 1494001659, 1494630697, 1494690535, 1494695213, 1494714660, 1494714786, 1494714930, 1494889015, 1494990523, 1494992680, 1494997876, 1495466906, 1500014997, 1502962162, 1504548128, 1505655813, 1508029184, 1508045454, 1509815249, 1518807662, 1524160328, 1529373691, 1536802563, 1538089784, 1539586715, 1544812783, 1547140470, 1552392687, 1552405115, 1552405169, 1553111822, 1553462237, 1554120313, 1554158027, 1555241094, 1555436471, 1555595989, 1556675361, 1557492455, 1557696008, 1558835738, 1558865070, 1559582938, 1559928005, 1561078602, 1565016185, 1565113430, 1565407826, 1568314306, 1568314316, 1568317266, 1568696751, 1568699472, 1568940804, 1569248185, 1570879860, 1573625992, 1573800670, 1576869802, 1581247153, 1581398717, 1581675892, 1581718434, 1583510121, 1583803496, 1588886160, 1595292826, 1602148307, 1605015374, 1609481646, 1612153257, 1618209596, 1618218864, 1618873873, 1619384363, 1624861042, 1630153983, 1638526919, 1639454708, 1640524262, 1641042489, 1641812886, 1647303548, 1648240296, 1650468220, 1650500409, 1651513056, 1658862087, 1658979753, 1661301475, 1667470132, 1667473335, 1667728240, 1667806132, 1677105623, 1680875001, 1680882207, 1681660610, 1685495090, 1685495093, 1685495270, 1685495398, 1688394353, 1688567575, 1688665455, 1688778883, 1690751126, 1691125863, 1693300755, 1694472929, 1703388735, 1709297356, 1709313729, 1712511978, 1715661089, 1717927392, 1718114956, 1721373840, 1722360575, 1724823399, 1726408681, 1726606395, 1726645504, 1732927910, 1736066754, 1736347741, 1740486766, 1742215384, 1745377406, 1758824175, 1758930481, 1758975612, 1759122505, 1759143730, 1759143733, 1759227293, 1759313682, 1759313685, 1759412017, 1759432510, 1759498975, 1759505228, 1759507354, 1759515800, 1759642661, 1759864276, 1759893786, 1760159824, 1763810143, 1766750547, 1769211545, 1769618102, 1772590156, 1775156822, 1780760274, 1783870720, 1784406502, 1786353732, 1793007575, 1811810046, 1815656403, 1816569647, 1816866992, 1822574126, 1822868024, 1822868031, 1823268852, 1823275309, 1823288115, 1823390804, 1823768300, 1833535991, 1842420860, 1844031908, 1844296341, 1844524436, 1844853963, 1845272265, 1845433501, 1850725233, 1851761689, 1851765614, 1852766386, 1853687691, 1854177922, 1861204803, 1863593250, 1872674263, 1872992134, 1873841021, 1877281407, 1877305076, 1881597618, 1884316146, 1886743174, 1887188539, 1892879921, 1905997196, 1912353097, 1916296381, 1919640688, 1919643810, 1924325687, 1935798204, 1935801369, 1935813711, 1935815187, 1935818499, 1941710024, 1944260378, 1945210145, 1951157591, 1955955663, 1957378415, 1957388660, 1957444069, 1958153525, 1958153878, 1962799016, 1964448624, 1967235715, 1967514117, 1968334692, 1970709900, 1974828022, 1977445003, 1980811473, 1981302481, 1984866213, 1986874949, 1987285901, 1987558613, 1988913069, 1998855379, 2023930736, 2026542768, 2029442974, 2029502301, 2031253491, 2041190670, 2044176332, 2044519717, 2044521677, 2044845895, 2044862336, 2050748464, 2055299797, 2059226128, 2060744697, 2060874008, 2061631935, 2062602594, 2062613436, 2062713055, 2062721365, 2062782118, 2064194523, 2064289093, 2064667157, 2064835977, 2065546931, 2065580690, 2065783508, 2066019598, 2067177842, 2067640249, 2068518016, 2068619301, 2069026672, 2069773511, 2070805664, 2073324624, 2075547993, 2076314666, 2076760108, 2076927096, 2078661044, 2080078919, 2080126248, 2080270176, 2080768362, 2080948565, 2081049148, 2081811414, 2082081519, 2083365940, 2084275182, 2089789238, 2090043919, 2090165361, 2090287045, 2092471497, 2092773191, 2093281591, 2093290649, 2093484170, 2095261287, 2096596043, 2096775591, 2100685312, 2102866955, 2108433077, 2109903284, 2110249550, 2112026046, 2112754908, 2114424326, 2115251185, 2116737470, 2118764990, 2119510407, 2120903194, 2121183749, 2121530494, 2121539444, 2122085862, 2123968241, 2123974461, 2124038667, 2126585211, 2127702833, 2127711196, 2129393172, 2140172366, 2141043403, 2144163444, 2144352359, 2146552134, 2146559400, 2146579609, 2146771534, 2146787712, 2147192784, 2149214372, 2150227387, 2151276842, 2152677197, 2158829447, 2159124528, 2159550475, 2161337980, 2161361535, 2163722410, 2163917836, 2165826914, 2169168320, 2170868227, 2173022808, 2174751247, 2179048400, 2184998274, 2196541409, 2200622033, 2203412941, 2206322353, 2208794483, 2219653172, 2219657520, 2225010953, 2226828879, 2238722895, 2238722920, 2238723506, 2241976578, 2245936247, 2248375230, 2249276550, 2249625301, 2254065144, 2254179087, 2254183431, 2254275149, 2254449430, 2254449877, 2255178054, 2264880989, 2270863210, 2290294367, 2304704334, 2304866355, 2305219189, 2310350875, 2310486036, 2312897274, 2314773060, 2315564905, 2319231065, 2319463533, 2325240383, 2327016339, 2330482855, 2337919027, 2340169455, 2359883328, 2361871491, 2366081778, 2369823335, 2369831600, 2371523459, 2372759050, 2374977123, 2376431395, 2378889732, 2382890223, 2383755454, 2386589953, 2387052696, 2389856295, 2391789782, 2398718314, 2399324290, 2400888860, 2401211408, 2404756392, 2406557074, 2407241140, 2409418646, 2411497922, 2411691127, 2413846222, 2413908037, 2414944572, 2415208709, 2417936111, 2419639306, 2423159152, 2423360684, 2425978408, 2428076111, 2437572023, 2440527060, 2444775143, 2449407487, 2457428534, 2469735934, 2475146676, 2475744613, 2476033552, 2476112212, 2476147614, 2477393954, 2478803388, 2479415778, 2482075359, 2485317413, 2485370363, 2488499588, 2488699734, 2491415998, 2492607180, 2493496209, 2497515972, 2499072481, 2499532790, 2504383993, 2504870149, 2505121421, 2505147736, 2513647314, 2513693640, 2513701512, 2513706827, 2521253655, 2521398855, 2526527953, 2526528078, 2527291586, 2527292245, 2527666001, 2528098475, 2536669081, 2536933437, 2537106090, 2538335365, 2541170503, 2541170604, 2541177518, 2545965593, 2546249066, 2546819122, 2548278991, 2548782015, 2549421379, 2557808039, 2557863700, 2558865115, 2568950385, 2569073380, 2569341502, 2569405925, 2570837952, 2575053435, 2575619554, 2575627585, 2579451785, 2581687876, 2582936524, 2586547509, 2590439971, 2600983050, 2602643559, 2605946857, 2608238576, 2608504686, 2611889973, 2612202111, 2619739935, 2621175072, 2627204334, 2627570013, 2627677159, 2631480810, 2631901285, 2635187702, 2637430468, 2638897207, 2639751704, 2642390316, 2644459471, 2644532855, 2644906311, 2645171587, 2647433605, 2647443463, 2649904288, 2651288351, 2652440186, 2655263134, 2660229222, 2660362019, 2662714632, 2671981072, 2673085999, 2676359415, 2678218950, 2680015310, 2683201101, 2683726243, 2687071289, 2687546085, 2689958531, 2690565794, 2691049537, 2696922944, 2702278755, 2705586928, 2707450736, 2708750293, 2710694053, 2710777678, 2717039465, 2719746264, 2719953243, 2722365346, 2724396360, 2730361077, 2732178535, 2732249147, 2732255792, 2732453216, 2732465831, 2733162785, 2733179003, 2740913336, 2743326046, 2745816408, 2746770100, 2768031559, 2768594053, 2769743066, 2770453396, 2777301260, 2777413063, 2779047561, 2779131760, 2781151044, 2788878449, 2791114477, 2792266216, 2795123222, 2795130739, 2795148393, 2803000277, 2803220098, 2820015673, 2824852881, 2825063248, 2825297984, 2826183623, 2826618777, 2828159974, 2830840737, 2840364717, 2844137461, 2844192015, 2844331414, 2844474265, 2845536368, 2847702680, 2847708560, 2849875839, 2854691117, 2857021867, 2857111846, 2857167445, 2857291628, 2857718467, 2857718874, 2859609075, 2860369035, 2860944275, 2861234828, 2861431296, 2861773187, 2862323803, 2862729831, 2862789186, 2862818280, 2865000297, 2865536587, 2872917161, 2879220442, 2885591219, 2886256228, 2886266660, 2886337850, 2886340600, 2886347487, 2886358758, 2886559394, 2888553420, 2893735969, 2893987517, 2894277589, 2895201770, 2895970159, 2903889952, 2904798808, 2907566289, 2911967032, 2913775681, 2917443420, 2921648360, 2921994283, 2925162127, 2925540459, 2931480722, 2936112276, 2938485423, 2939997155, 2941295122, 2942568797, 2944555176, 2950549599, 2952067971, 2952072562, 2955690120, 2961421753, 2962144430, 2962519996, 2962841785, 2964270344, 2964373735, 2965548040, 2966852375, 2970298080, 2974400461, 2975755381, 2981996158, 2987922608, 2991195167, 2991625994, 2993771546, 2995901561, 3000958971, 3001281849, 3001388716, 3004478994, 3004479027, 3004479111, 3004479159, 3004479171, 3004479184, 3004479190, 3004479239, 3004479240, 3004479258, 3004479289, 3004479305, 3004479323, 3004479334, 3004479373, 3004479389, 3004479390, 3004479401, 3004479425, 3004479785, 3004479787, 3004479818, 3004479829, 3004479837, 3004479976, 3004479994, 3004480114, 3005847375, 3006723884, 3006726944, 3006727797, 3006731179, 3006737252, 3006744684, 3006811183, 3012299493, 3014399025, 3019017018, 3019072181, 3019996757, 3020108825, 3020133371, 3020188532, 3023885513, 3024558034, 3024589567, 3024626538, 3033483503, 3034109278, 3035739007, 3035887950, 3044634578, 3044797796, 3044821749, 3045244983, 3045788419, 3045876876, 3046124074, 3046256428, 3050244615, 3050333064, 3050334784, 3056297406, 3062281966, 3063798750, 3063849681, 3073445035, 3073797863, 3073848296, 3086119708, 3087786680, 3089398889, 3089451715, 3089454054, 3089461994, 3089735415, 3094552970, 3097888413, 3098875466, 3099276787, 3104375123, 3104503715, 3105798493, 3107144912, 3107146953, 3110631110, 3110681545, 3111601102, 3111601746, 3111606786, 3114815727, 3119543502, 3119594433, 3120807553, 3120857998, 3122897068, 3125786613, 3128821880, 3133975234, 3135838657, 3136281421, 3145164732, 3147940006, 3154068140, 3154152867, 3157412719, 3157501664, 3159380027, 3160589879, 3161016478, 3161897203, 3174437714, 3180245112, 3180300610, 3182786585, 3183126568, 3183293814, 3183325319, 3184294753, 3188347051, 3191217062, 3196370198, 3197567695, 3198643172, 3198783739, 3198824989, 3198841920, 3198930383, 3199640352, 3200095506, 3203439089, 3203573947, 3203579445, 3208441350, 3209729826, 3210506925, 3210514725, 3210570457, 3214383466, 3214394316, 3214653823, 3215790970, 3217760577, 3218901480, 3218928718, 3218996674, 3218997101, 3219339071, 3219427268, 3220535722, 3220543483, 3221757640, 3223098753, 3224727829, 3232284385, 3232339054, 3234508143, 3234559072, 3235473148, 3237969392, 3243142044, 3247991594, 3253953941, 3269910681, 3270985722, 3273573836, 3273628995, 3275986591, 3277061645, 3277112578, 3277868236, 3277980164, 3278129999, 3278154322, 3280832255, 3280992609, 3283017533, 3286262047, 3290414111, 3301409832, 3301494567, 3302526185, 3302610918, 3305712858, 3305866028, 3305950755, 3309540327, 3309590022, 3309595898, 3309596203, 3309660560, 3309660597, 3309937069, 3312550946, 3312639405, 3317007142, 3317095593, 3324397363, 3331028046, 3331525682, 3331580349, 3331802213, 3332642035, 3332696700, 3333929978, 3334870005, 3334920442, 3335058344, 3335315569, 3343940221, 3345496201, 3350023967, 3353092349, 3358586999, 3365687143, 3366763202, 3368167300, 3371155980, 3372842751, 3373802982, 3374003367, 3374007861, 3374013921, 3374033257, 3374071862, 3374072315, 3374075119, 3374222601, 3374506623, 3377952754, 3382868701, 3384928690, 3388197033, 3390931348, 3391051206, 3391063809, 3391068622, 3391334282, 3391402631, 3391423133, 3391432603, 3392425741, 3394879910, 3395277647, 3399311251, 3402270417, 3404440519, 3414226886, 3414277321, 3415566709, 3417045783, 3417060092, 3418683074, 3418733517, 3431921225, 3437307073, 3437430868, 3437705452, 3444401619, 3445590826, 3447374472, 3456431399, 3458638240, 3461359920, 3463272868, 3468986640, 3469121667, 3471246134, 3474393156, 3474446194, 3476056250, 3478543821, 3486841411, 3486906847, 3489097968, 3491201265, 3495569706, 3496705474, 3497897502, 3497994843, 3498252682, 3502149957, 3504414102, 3504826781, 3506839508, 3506948350, 3508950458, 3509210745, 3509498189, 3511959565, 3512025010, 3512493029, 3514111400, 3517669498, 3518790968, 3521920341, 3523035738, 3523862571, 3524226140, 3530307622, 3530358057, 3536335853, 3536792162, 3538712404, 3541452460, 3541507619, 3542648636, 3544416242, 3550676375, 3551025439, 3553383951, 3556498831, 3561501051, 3561585780, 3565016796, 3565023071, 3565174365, 3565227623, 3565288856, 3566089568, 3572109810, 3575114019, 3577841990, 3586425916, 3589694483, 3591020567, 3592221649, 3594125448, 3595182758, 3596128381, 3602035250, 3602533630, 3602552275, 3604829927, 3607233834, 3607322789, 3607604079, 3608554389, 3610981370, 3617629034, 3619761411, 3623812162, 3629877419, 3636237811, 3636292476, 3639577654, 3639632313, 3645953597, 3647523178, 3649784978, 3653883892, 3660676457, 3664234276, 3674197367, 3675513627, 3681233287, 3684650455, 3688377898, 3689406359, 3692544695, 3693437133, 3694959415, 3703294733, 3704443907, 3704956777, 3706490306, 3709178884, 3709268355, 3709272958, 3717182590, 3718660896, 3719413702, 3721853564, 3731122282, 3734934472, 3736397122, 3736397691, 3738359136, 3744502996, 3744505315, 3744515994, 3744516038, 3745225898, 3745403285, 3749377655, 3751498613, 3752631559, 3753565240, 3756319792, 3758308501, 3758308691, 3761682835, 3762386667, 3762488637, 3763193356, 3763904751, 3764062969, 3764739038, 3769398133, 3770065529, 3774076759, 3779092995, 3780318738, 3781089827, 3783201212, 3785420602, 3786786081, 3788364543, 3791375542, 3791430201, 3791912060, 3792007260, 3792147146, 3793208754, 3794029235, 3805317549, 3808957225, 3809652473, 3811984999, 3812594538, 3819295903, 3819351056, 3821104144, 3821104746, 3829518367, 3832811824, 3833121835, 3833171090, 3833706374, 3838812042, 3843969806, 3844552031, 3850681433, 3851222744, 3851541567, 3851602009, 3851679807, 3853676291, 3855415829, 3856249405, 3859110665, 3859972063, 3862928629, 3865386916, 3865396334, 3873108359, 3873163016, 3876524049, 3883472548, 3885986978, 3888196487, 3895773227, 3898366596, 3900605466, 3900796753, 3906034907, 3907036333, 3914330405, 3916906002, 3922403377, 3925982068, 3933039724, 3936549300, 3939824482, 3940957272, 3941201834, 3941535714, 3943160335, 3943296300, 3950173236, 3955179593, 3959867562, 3960938237, 3961299015, 3961303520, 3961836502, 3962329360, 3963273426, 3966271140, 3969493837, 3970184201, 3971378905, 3972349404, 3972404563, 3974206923, 3977375686, 3977639927, 3981851856, 3984175284, 3984369770, 3984383153, 3984388901, 3984577838, 3986753035, 3987449768, 3988320676, 3989122328, 3989124781, 3989300792, 3991957101, 3991978776, 3992246021, 3993156440, 3995285601, 4002046206, 4002059123, 4002298131, 4007368305, 4009075902, 4012314248, 4014272956, 4018800601, 4021398623, 4022152923, 4023242992, 4034787018, 4034837957, 4040007159, 4040507273, 4040558214, 4042630615, 4042667369, 4044815570, 4044899805, 4046325025, 4051504220, 4051593171, 4059166898, 4059387372, 4060969098, 4060986772, 4062588735, 4063625944, 4063736412, 4064813411, 4074640059, 4077930265, 4080197122, 4081731399, 4081736449, 4081740860, 4081761692, 4082508192, 4082648933, 4085037592, 4085499470, 4085741867, 4086206754, 4087477773, 4087973382, 4087974431, 4087975312, 4087977920, 4087977986, 4087982672, 4087983230, 4087984585, 4087984590, 4087984656, 4087988411, 4087993231, 4087993234, 4087993291, 4087993428, 4088004545, 4089941093, 4090379779, 4094838531, 4095533224, 4098180267, 4104794847, 4104808845, 4105491350, 4105500480, 4109580593, 4111598640, 4115797781, 4116207257, 4116258198, 4116322118, 4116406345, 4116912946, 4122262153, 4126221625, 4127308650, 4128209898, 4128210099, 4128224738, 4128228031, 4128452341, 4131804567, 4131859224, 4137741343, 4141029933, 4142953920, 4145022541, 4149201544, 4150566897, 4151710650, 4152474623, 4155185738, 4156445644, 4157556469, 4159136925, 4159401066, 4159780211, 4159864444, 4164601660, 4166043368, 4168091484, 4169450331, 4170161097, 4170579962, 4170925049, 4171014006, 4171016671, 4171029715, 4172482250, 4175353143, 4176008925, 4178981053, 4184703759, 4186748423, 4188894668, 4189635776, 4190045706, 4190142208, 4195146068, 4196943735, 4199824850, 4203521301, 4206809827, 4206944958, 4207535653, 4208164707, 4211585807, 4215346074, 4215356593, 4218114605, 4218115138, 4218132009, 4219656584, 4219999876, 4220379359, 4221957810, 4222018626, 4225873997, 4227433758, 4228171984, 4228217908, 4228360888, 4228368741, 4228368760, 4231583294, 4231662792, 4232149414, 4232629512, 4234942237, 4235762280, 4240864861, 4241320459, 4241740950, 4242647335, 4243702915, 4245105172, 4246629902, 4248741847, 4252833472, 4252840599, 4254781707, 4254799704, 4255058051, 4260594638, 4261873154, 4261894730, 4262104449, 4262374147, 4262375371, 4262499171, 4264253465, 4265048576, 4267292711, 4271528787, 4272039260, 4272350188, 4272417877, 4276136562, 4288066094, 496, 47871540, 54631547, 68945260, 76317054, 90122581, 107533418, 116755925, 126180178, 134757519, 138717385, 149084067, 151992766, 159782934, 165071847, 169736776, 199499008, 205527546, 205536464, 224032181, 244603010, 255553804, 262051769, 263431316, 289494951, 354252953, 371032970, 373243562, 374621869, 387545720, 415171499, 415171548, 415171976, 417501621, 418990158, 418990556, 418990602, 428935062, 435420269, 446013731, 470667520, 483976516, 501379566, 505515071, 531625563, 545287533, 553327069, 557914884, 561052958, 590191545, 595217502, 605053578, 631419393, 638690382, 656131164, 668816409, 678957092, 680578927, 714686602, 715141614, 717942499, 720974524, 720974736, 720975995, 725617684, 744932012, 771409750, 771414216, 780626120, 793535325, 806495002, 814511503, 817571047, 823641433, 857348365, 859756734, 871542102, 874127079, 874448701, 877175745, 894926763, 914435801, 931438088, 936346962, 937200556, 985925171, 999743180, 1015486168, 1024036955, 1026348750, 1029964103, 1030875558, 1083568115, 1106088318, 1129760065, 1133753081, 1206251138, 1219433535, 1220725895, 1220852235, 1220852260, 1220852796, 1220852957, 1236957398, 1239105997, 1240508317, 1242746690, 1260212779, 1276379155, 1281346067, 1282239389, 1320845190, 1338160975, 1340954405, 1351436722, 1361325259, 1374669131, 1374800320, 1389479998, 1389489864, 1401511709, 1416204741, 1421711922, 1423819961, 1442213995, 1451199708, 1452449030, 1467196671, 1467386990, 1478637836, 1481066904, 1485660590, 1490648152, 1514073041, 1515784934, 1515785058, 1523142552, 1553174585, 1554493328, 1576120812, 1618516112, 1618520769, 1620678315, 1629584534, 1630185905, 1634082427, 1641166031, 1641329381, 1651813653, 1651813852, 1651813873, 1651813877, 1651814134, 1661678914, 1679178836, 1704277516, 1705410866, 1705908110, 1716909455, 1739901060, 1772526810, 1780819577, 1792953560, 1800373353, 1804335977, 1818263278, 1821800212, 1833750850, 1834601376, 1834613468, 1866278547, 1867401367, 1871519061, 1877316119, 1885093049, 1905117283, 1912525112, 1936236019, 1943696156, 1945296852, 1997464432, 2003082032, 2004696035, 2006615489, 2021590912, 2037553580, 2055461758, 2058918178, 2059994636, 2080694907, 2086814061, 2089989988, 2123843096, 2165441834, 2170766397, 2172738430, 2174442073, 2177527468, 2178512614, 2233637259, 2239303300, 2241981847, 2246941078, 2256781073, 2268386306, 2270125231, 2274359414, 2274845447, 2274845649, 2277752833, 2279046513, 2283736377, 2292248115, 2293400491, 2299536904, 2299670458, 2300280964, 2300527715, 2305877279, 2307152224, 2316307169, 2322963439, 2335588857, 2337430377, 2354006485, 2368524443, 2383909797, 2386527633, 2389375265, 2396889473, 2405952063, 2419834458, 2422838897, 2423179189, 2436862648, 2436862650, 2436862651, 2436862652, 2436862653, 2436862654, 2436862655, 2439178127, 2460729245, 2517521888, 2517875246, 2524826096, 2548329620, 2605457434, 2631335866, 2637136164, 2717218632, 2721685109, 2726314137, 2726667654, 2726667661, 2726667752, 2726667756, 2726667834, 2726667995, 2726668398, 2737177336, 2757711981, 2787445139, 2792808143, 2796817467, 2800030928, 2812190333, 2816464305, 2817592022, 2824075537, 2826795200, 2827908591, 2840757647, 2841353452, 2845015293, 2856476794, 2859719956, 2859720066, 2860331821, 2872823135, 2876785673, 2876785759, 2882486166, 2895975372, 2901134565, 2912581980, 2913059937, 2928411462, 2928411600, 2938670220, 2939089089, 2943360116, 2945389039, 2953167354, 2969218809, 2998181471, 2998181566, 3004528792, 3005172573, 3015670621, 3022308183, 3023519083, 3050185270, 3050185436, 3054410303, 3056015384, 3056015484, 3061244438, 3061953314, 3069865977, 3079506072, 3079766179, 3079929644, 3093295703, 3109459404, 3116612793, 3125191143, 3137409148, 3149479373, 3164879219, 3176028223, 3176996220, 3183078197, 3227651590, 3234432745, 3278041418, 3278041727, 3278041816, 3278041938, 3281518967, 3281526189, 3287738371, 3319967633, 3330642108, 3331528546, 3334769994, 3354637514, 3366845240, 3366856802, 3375261606, 3375312977, 3386385708, 3423153883, 3441231669, 3461071037, 3473412940, 3486684134, 3493806728, 3495007090, 3504293483, 3517650814, 3547292615, 3571189672, 3593285841, 3612407497, 3636895974, 3654320918, 3666061454, 3666061458, 3666061568, 3666061577, 3666061585, 3666061591, 3666061602, 3666061610, 3666061613, 3666061619, 3666061666, 3666061672, 3666061702, 3666061706, 3666061732, 3666061760, 3666061781, 3666061864, 3666061891, 3666061895, 3666061896, 3666061902, 3666061903, 3666061913, 3666062029, 3666062293, 3666062299, 3666062326, 3666062331, 3666062345, 3666062357, 3666062361, 3666062379, 3666062386, 3666062390, 3666062391, 3666062394, 3666062408, 3666062418, 3666062422, 3666062427, 3666062453, 3666062517, 3666062569, 3666062581, 3666062582, 3666062586, 3666062587, 3666099519, 3667007182, 3667641944, 3676644409, 3676644411, 3676644421, 3676644429, 3676644442, 3676644586, 3676644600, 3676644610, 3676644643, 3676644706, 3676644759, 3676644775, 3676644800, 3676644806, 3676644819, 3676644874, 3676644887, 3676644888, 3676644905, 3676644939, 3676644953, 3676644982, 3676645005, 3676645006, 3676645021, 3676645049, 3676645073, 3691777760, 3697941178, 3708654452, 3709845083, 3735337540, 3749170769, 3797573522, 3808507552, 3820675046, 3829710462, 3829710568, 3845152461, 3847111189, 3848170841, 3848172796, 3859732587, 3861225221, 3866815930, 3871154340, 3872238039, 3877533355, 3916589493, 3952274701, 3956209759, 3956209883, 3957571326, 3967179311, 3967188440, 3967452457, 4020468984, 4034325518, 4046119801, 4063274567, 4063274705, 4085542669, 4088042711, 4088042763, 4088043471, 4098608917, 4098609219, 4098704176, 4098704230, 4098775844, 4098776178, 4098815877, 4098816211, 4126370696, 4128194716, 4155818428, 4157715930, 4179162156, 4189349925, 4196060584, 4201278290, 4224941776, 4233200080, 4233407375, 4248600132, 4259920717, 4268562148, 4278362009, 4290344436, 0, 0, 0, 117, 32645503, 51019695, 132194736, 312195571, 314389013, 343511425, 378651314, 411036087, 470670155, 491072198, 622717971, 665235600, 671018825, 702016907, 749686474, 783482313, 940203815, 940203856, 944390301, 994283205, 1023125587, 1030334438, 1035444912, 1035444966, 1089939915, 1089940134, 1089940268, 1089940571, 1089940670, 1126785125, 1126785220, 1126785554, 1126785661, 1160516735, 1194527639, 1286944368, 1314246125, 1363073681, 1423206836, 1525138979, 1525939176, 1629871844, 1768132753, 2016993734, 2016993895, 2041104019, 2167803470, 2172444755, 2214438419, 2437002995, 2455582525, 2471787754, 2496101809, 2496102290, 2496102373, 2501069285, 2501069363, 2501069943, 2506938014, 2541187472, 2613448893, 2668096359, 2677072971, 2701778596, 2736107658, 2752224776, 2767610756, 2786488082, 2788365409, 2943255975, 3189844301, 3226681138, 3281262578, 3302811409, 3307921937, 3307922086, 3307922629, 3345635911, 3364310697, 3364311312, 3364311551, 3424631121, 3483670337, 3483670475, 3483670694, 3483670995, 3500811163, 3540406064, 3641922754, 3690744304, 3724295102, 3724295272, 3724295674, 3728257340, 3728257887, 3728257896, 3963283600, 3976448966, 3976460069, 4020011242, 4027914761, 4071377939, 4076917287, 4076917941, 4082817617, 4104438845, 4104439147, 4108257948, 4108258155, 4151184708, 4151184786, 4156151698, 4170341772, 4188141953, 4191096425, 4206482405, 4233599295, 3, 989615076, 2372695675, 2793429742, 557, 2315777, 2516160, 11643297, 13203897, 21231554, 35967653, 38712935, 47792331, 72865995, 74144458, 82734700, 83460346, 105527502, 113271207, 114075176, 133175084, 133306274, 134752460, 139681591, 140540365, 149081424, 153628834, 159784149, 160693466, 187981691, 192478478, 196554557, 201714711, 248032557, 257089230, 271126044, 284628322, 288401789, 293512087, 299470436, 301921344, 303087651, 310748895, 315932160, 317229038, 318673258, 321508235, 328967865, 331740776, 333043316, 343618051, 344116268, 349554276, 368842915, 373240553, 380288946, 385653806, 387546555, 391603917, 397299232, 399675396, 407552584, 411195e3, 444280280, 457925677, 459126046, 465045723, 466546683, 476300545, 492825035, 496262010, 508940895, 516076913, 528158848, 556967719, 576308682, 587182649, 592244350, 599016891, 599034260, 599035482, 617473653, 629010449, 643159709, 649306413, 657763177, 658030821, 663498697, 666920016, 684079208, 685681630, 714054828, 718967674, 730892591, 745170160, 748876721, 748886222, 752803028, 756281027, 761348098, 764441186, 767592699, 768148470, 771634050, 771637032, 776981331, 797075449, 798164153, 806496217, 807477757, 814547322, 823640218, 828791723, 830209933, 830328663, 830812219, 831086733, 843422410, 848961657, 865242478, 871543061, 884068409, 884552461, 885566443, 890057914, 898403917, 903718636, 931459402, 935392831, 935834596, 953760609, 956026316, 971072782, 973201175, 976698407, 985556812, 990107236, 1002251210, 1006286666, 1015491227, 1017212284, 1017751931, 1021423441, 1022625874, 1026349709, 1027559288, 1039189287, 1040655967, 1045248606, 1048681185, 1049173028, 1069937338, 1071441344, 1072691903, 1126599587, 1128950639, 1139782538, 1139843834, 1141008431, 1156488897, 1156508121, 1156523661, 1156525328, 1160815779, 1194239092, 1194271807, 1197936283, 1211577197, 1211637010, 1216928124, 1216930642, 1222641289, 1236208034, 1240507358, 1249107752, 1250860863, 1264600767, 1288872441, 1321698432, 1329660539, 1338155660, 1339210968, 1373285759, 1382125974, 1390628516, 1399578255, 1399657308, 1400295402, 1403708559, 1408484449, 1421977812, 1432456391, 1433498959, 1468959011, 1474134153, 1481167509, 1481892069, 1485735468, 1512063165, 1514478145, 1519263375, 1522675342, 1541305645, 1542981532, 1545890970, 1547575222, 1551921794, 1553720283, 1557499238, 1570793035, 1608428239, 1632730660, 1635518266, 1640297675, 1644040136, 1645084619, 1672625515, 1675268949, 1675573659, 1679183895, 1683449608, 1701744405, 1704282831, 1705918154, 1709094170, 1740118996, 1745197398, 1746168006, 1763490076, 1764138250, 1777350272, 1778504542, 1781330447, 1804707890, 1807895638, 1812124962, 1825087480, 1826407997, 1827997201, 1834433178, 1836295865, 1836721468, 1837118382, 1842831596, 1855831597, 1858789092, 1871287494, 1874044309, 1894332319, 1894472089, 1911094612, 1944286571, 1945301911, 1964668429, 1980629213, 1980666008, 1992457158, 2001245397, 2005254865, 2009607860, 2045076089, 2048724462, 2072914399, 2073220142, 2080693816, 2086817070, 2091822363, 2106898657, 2116894487, 2120589916, 2132854800, 2138833857, 2145793595, 2149555928, 2149786502, 2159131792, 2166792548, 2193556503, 2203826663, 2222814745, 2224555259, 2233632200, 2234478015, 2248080793, 2266871804, 2270958851, 2280109123, 2299904377, 2300684501, 2300777625, 2320975486, 2327221019, 2363964101, 2368015199, 2368150205, 2378859099, 2402357659, 2406246052, 2420231640, 2421406330, 2421832104, 2429899162, 2437980806, 2442099500, 2445444524, 2450316872, 2465503949, 2473625907, 2473727242, 2473783490, 2473979105, 2477231344, 2480056360, 2497381376, 2507603130, 2511017726, 2535682339, 2548872209, 2564758885, 2566495456, 2571185839, 2577440767, 2580206998, 2581034625, 2602638176, 2634443356, 2647576485, 2655498207, 2659744440, 2664398480, 2665288759, 2683912382, 2685363948, 2692722188, 2697995386, 2705244823, 2707054618, 2722204667, 2731133769, 2731911143, 2746095604, 2750223108, 2751457001, 2754792045, 2757038073, 2757714990, 2757832374, 2763102979, 2764615893, 2768173321, 2769632227, 2788021838, 2789621599, 2804556717, 2805563472, 2808290141, 2812672828, 2813866328, 2817995155, 2818163158, 2823576784, 2832963785, 2833300206, 2839929991, 2842899363, 2855442276, 2856513455, 2861724882, 2873826097, 2875201553, 2889802328, 2894057006, 2902844704, 2917859896, 2920776771, 2938675535, 2940382413, 2940687092, 2942499160, 2944606430, 2976147113, 2999699036, 3012594373, 3014878073, 3018472732, 3021947486, 3024482894, 3027886950, 3028740654, 3033143700, 3041972547, 3043054392, 3061104959, 3068420353, 3068421535, 3068431129, 3068448592, 3068451149, 3073259213, 3076287128, 3090497579, 3090580217, 3090737416, 3090825152, 3092740204, 3097180103, 3100000510, 3103387337, 3126517186, 3134714387, 3141033517, 3141902906, 3153726305, 3159778476, 3161099645, 3164570023, 3168616586, 3171093691, 3174505760, 3178721795, 3185964212, 3199657339, 3206010734, 3213212569, 3227558031, 3234959359, 3242752110, 3245911312, 3250117513, 3255207552, 3263028169, 3267416959, 3271443733, 3276067803, 3303582289, 3303582897, 3303582994, 3303614961, 3327283712, 3336973745, 3344426237, 3345667381, 3346748653, 3355942409, 3358811093, 3365430328, 3371744816, 3378392276, 3393399711, 3418876414, 3421916439, 3451234301, 3462047339, 3466186248, 3487461167, 3489942689, 3497005689, 3497827554, 3511023565, 3525195500, 3528253833, 3548126664, 3567612396, 3579570991, 3581968529, 3587382024, 3594263141, 3597175734, 3609198260, 3620670314, 3644061745, 3686687805, 3699471696, 3704450806, 3704697978, 3719669200, 3724302375, 3732631655, 3737866131, 3737867596, 3737868683, 3737869333, 3737882439, 3737883738, 3743824089, 3748450386, 3755463030, 3762725071, 3774110483, 3780090414, 3785581089, 3786960458, 3789613664, 3804388979, 3804546306, 3804622433, 3804769098, 3805029153, 3814239798, 3826380201, 3829814476, 3834232417, 3836376093, 3843018675, 3847110230, 3849573984, 3852325723, 3881564216, 3885535149, 3888536498, 3895950835, 3925391633, 3927045026, 3929681833, 3930866393, 3935135407, 3974478460, 3989861270, 3990612749, 3994206764, 3994206767, 4003176468, 4005639964, 4013705057, 4020891302, 4040130402, 4048452106, 4055956024, 4064081091, 4067448500, 4069710253, 4076793042, 4078153021, 4080150694, 4080153416, 4081704564, 4090215578, 4095557691, 4103392506, 4105790268, 4130682685, 4131077260, 4150503708, 4155492542, 4165042016, 4180101814, 4186885299, 4188349987, 4190709408, 4193373567, 4197651626, 4198443983, 4202984206, 4210375752, 4212069506, 4216891535, 4228991204, 4251429164, 4263509307, 4273680312, 4279717352, 4282015733, 0, 0, 0, 16, 194015595, 898804372, 1302949420, 1641101705, 1641101791, 1789205820, 1793025130, 2420122849, 3254830271, 3258793065, 3421857213, 3595171289, 3598774216, 3739342506, 3927441874, 3927442035, 0, 203, 14034108, 23188555, 46966025, 63548133, 69988957, 176179919, 181602757, 199230788, 231162178, 234878220, 241015393, 282017655, 286917352, 298380305, 303225044, 333040682, 436746473, 437068413, 449019336, 449464240, 451920903, 472319354, 495318858, 500388520, 512606097, 527005648, 531402563, 554651161, 561857715, 570474602, 588675343, 615779940, 680838102, 688229624, 722503086, 733631603, 759879349, 760863762, 768579191, 769161927, 777931472, 804592434, 820388681, 834351359, 838060561, 871806992, 907959623, 917609192, 921095799, 922653385, 936253712, 951807472, 976944213, 1057868108, 1061438860, 1097991931, 1099387701, 1118780323, 1129127307, 1134058690, 1149298066, 1173449599, 1188365042, 1221482277, 1242510922, 1244344576, 1249042959, 1256956692, 1322375458, 1340682260, 1389219463, 1394442279, 1420709285, 1468300758, 1544881072, 1554252850, 1557974723, 1564485910, 1566036640, 1637844009, 1641584834, 1668922875, 1697481902, 1700564263, 1779722906, 1817679755, 1844196310, 1862443027, 1862944289, 1863425670, 1874439438, 1918635827, 1942164974, 1953292144, 1996832610, 2005075462, 2023914578, 2171493616, 2174172768, 2200270403, 2205873634, 2224853335, 2232538822, 2253530761, 2271804726, 2307427283, 2314778321, 2325064176, 2347507979, 2356867634, 2422267260, 2435625787, 2442761119, 2448910470, 2454582508, 2471444403, 2478294033, 2487762682, 2505529649, 2513007594, 2514973059, 2523046044, 2584135332, 2644823364, 2645305307, 2697781106, 2700249759, 2713921343, 2822144244, 2858583336, 2869381059, 2875883974, 2877426354, 2906087318, 2940183875, 2941854634, 2983778787, 2991311078, 3020661286, 3033841873, 3036938981, 3061233249, 3088839886, 3090851e3, 311688e4, 3160125774, 3173697968, 3175256934, 3193365922, 3209525171, 3247520471, 3248874150, 3262696949, 3293334302, 3294129343, 3298593e3, 3336190368, 3342381501, 3344449059, 3367460946, 3387371732, 3391640312, 3415133140, 3415553447, 3416872467, 3486599559, 3505446608, 3554833241, 3594782899, 3615198865, 3629910769, 3642670614, 3643744473, 3654513786, 3675702820, 3697030868, 3710380917, 3732976135, 3779661543, 3795518186, 3803370028, 3804920752, 3840174405, 3861583079, 3867650596, 3894082090, 3900359633, 3942119031, 3951224511, 4009634354, 4063453845, 4065646590, 4079144597, 4096136978, 4163056211, 4180315949, 4189523019, 4196008531, 4202817696, 4241738188, 4254148468, 4265459019, 4273759132, 0, 0, 0, 3, 1058807915, 1331654816, 2187720341, 0, 8, 1148034389, 1373602048, 1696875615, 1876694122, 1880539619, 2160920720, 2391490885, 2722440867]);

// node_modules/tldts-experimental/dist/es6/src/packed-hashes.js
function binSearch(arr, elt, start, end) {
  if (start >= end) {
    return false;
  }
  let low = start;
  let high = end - 1;
  while (low <= high) {
    const mid = low + high >>> 1;
    const midVal = arr[mid];
    if (midVal < elt) {
      low = mid + 1;
    } else if (midVal > elt) {
      high = mid - 1;
    } else {
      return true;
    }
  }
  return false;
}
var BUFFER = new Uint32Array(20);
function hashHostnameLabelsBackward(hostname, maximumNumberOfLabels) {
  let hash = 5381;
  let index = 0;
  for (let i = hostname.length - 1; i >= 0; i -= 1) {
    const code = hostname.charCodeAt(i);
    if (code === 46) {
      BUFFER[index << 1] = hash >>> 0;
      BUFFER[(index << 1) + 1] = i + 1;
      index += 1;
      if (index === maximumNumberOfLabels) {
        return index;
      }
    }
    hash = hash * 33 ^ code;
  }
  BUFFER[index << 1] = hash >>> 0;
  BUFFER[(index << 1) + 1] = 0;
  index += 1;
  return index;
}
function suffixLookup(hostname, options, out) {
  if (fast_path_default(hostname, options, out)) {
    return;
  }
  const { allowIcannDomains, allowPrivateDomains } = options;
  let matchIndex = -1;
  let matchKind = 0;
  let matchLabels = 0;
  let index = 1;
  const numberOfHashes = hashHostnameLabelsBackward(
    hostname,
    hashes_default[0]
    /* maximumNumberOfLabels */
  );
  for (let label = 0; label < numberOfHashes; label += 1) {
    const hash = BUFFER[label << 1];
    const labelStart = BUFFER[(label << 1) + 1];
    let match = 0;
    if (allowIcannDomains) {
      match = binSearch(hashes_default, hash, index + 1, index + hashes_default[index] + 1) ? 1 | 4 : 0;
    }
    index += hashes_default[index] + 1;
    if (allowPrivateDomains && match === 0) {
      match = binSearch(hashes_default, hash, index + 1, index + hashes_default[index] + 1) ? 2 | 4 : 0;
    }
    index += hashes_default[index] + 1;
    if (allowIcannDomains && match === 0 && (matchKind & 4) === 0) {
      match = binSearch(hashes_default, hash, index + 1, index + hashes_default[index] + 1) ? 16 | 1 : 0;
    }
    index += hashes_default[index] + 1;
    if (allowPrivateDomains && match === 0 && (matchKind & 4) === 0) {
      match = binSearch(hashes_default, hash, index + 1, index + hashes_default[index] + 1) ? 16 | 2 : 0;
    }
    index += hashes_default[index] + 1;
    if (allowIcannDomains && match === 0 && (matchKind & 4) === 0 && matchLabels <= label) {
      match = binSearch(hashes_default, hash, index + 1, index + hashes_default[index] + 1) ? 8 | 1 : 0;
    }
    index += hashes_default[index] + 1;
    if (allowPrivateDomains && match === 0 && (matchKind & 4) === 0 && matchLabels <= label) {
      match = binSearch(hashes_default, hash, index + 1, index + hashes_default[index] + 1) ? 8 | 2 : 0;
    }
    index += hashes_default[index] + 1;
    if (match !== 0) {
      matchKind = match;
      matchLabels = label + ((match & 16) !== 0 ? 2 : 1);
      matchIndex = labelStart;
    }
  }
  out.isIcann = (matchKind & 1) !== 0;
  out.isPrivate = (matchKind & 2) !== 0;
  if (matchIndex === -1) {
    out.publicSuffix = numberOfHashes === 1 ? hostname : hostname.slice(BUFFER[1]);
    return;
  }
  if ((matchKind & 4) !== 0) {
    out.publicSuffix = hostname.slice(BUFFER[(matchLabels - 2 << 1) + 1]);
    return;
  }
  if ((matchKind & 16) !== 0) {
    if (matchLabels < numberOfHashes) {
      out.publicSuffix = hostname.slice(BUFFER[(matchLabels - 1 << 1) + 1]);
      return;
    }
    let suffixStart = 0;
    let seenDots = 0;
    for (let i = hostname.length - 1; i >= 0; i -= 1) {
      if (hostname.charCodeAt(i) === 46) {
        seenDots += 1;
        if (seenDots === matchLabels) {
          suffixStart = i + 1;
          break;
        }
      }
    }
    out.publicSuffix = hostname.slice(suffixStart);
    return;
  }
  out.publicSuffix = hostname.slice(matchIndex);
}

// node_modules/tldts-experimental/dist/es6/index.js
var RESULT = getEmptyResult();
function parse(url, options) {
  return parseImpl(url, 5, suffixLookup, options, getEmptyResult());
}

// node_modules/@ghostery/url-parser/dist/esm/url-search-params.js
var SearchParams = class {
  get [Symbol.toStringTag]() {
    return "URLSearchParams";
  }
  constructor(init) {
    this.isEncoded = false;
    this.params = [];
    if (typeof init === "string") {
      extractParams(init, init[0] === "?" ? 1 : 0, init.length, this, [CODE_AMPERSAND], CODE_EQUALS, [], {
        encode: true
      });
    } else if (Array.isArray(init)) {
      init.forEach((kv) => {
        this.append(kv[0], kv[1]);
      });
    } else if (typeof init === "object") {
      Object.keys(init).forEach((key) => {
        this.append(key, init[key]);
      });
    }
  }
  *entries() {
    for (let i = 0; i < this.params.length; i += 1) {
      yield [
        optionalDecode(this.params[i][0]),
        optionalDecode(this.params[i][1])
      ];
    }
  }
  append(name, value) {
    this.params.push([encodeParameter(name), encodeParameter(value)]);
  }
  delete(name) {
    this.params = this.params.filter(([key]) => optionalDecode(key) !== name);
  }
  forEach(callback) {
    this.params.forEach(([key, value]) => {
      callback(optionalDecode(value), optionalDecode(key), this);
    });
  }
  get(name) {
    const entry = this.params.find(([k]) => optionalDecode(k) === name);
    if (entry) {
      return optionalDecode(entry[1]);
    }
    return null;
  }
  getAll(name) {
    return this.params.filter(([key]) => optionalDecode(key) === name).map((kv) => kv[1]);
  }
  has(name) {
    return this.get(name) !== null;
  }
  *keys() {
    for (let i = 0; i < this.params.length; i += 1) {
      yield optionalDecode(this.params[i][0]);
    }
  }
  /**
   * The set() method of the URLSearchParams interface sets the value associated with a given
   * search parameter to the given value. If there were several matching values, this method
   * deletes the others. If the search parameter doesn't exist, this method creates it.
   * @param name
   * @param value
   */
  set(name, value) {
    const firstIndex = this.params.findIndex(([k]) => optionalDecode(k) === name);
    if (firstIndex === -1) {
      this.append(name, value);
      return;
    }
    this.delete(name);
    this.params.splice(firstIndex, 0, [
      encodeParameter(name),
      encodeParameter(value)
    ]);
  }
  sort() {
    this.params = this.params.sort((a, b) => a[0].localeCompare(b[0]));
  }
  toString() {
    return this.params.map(([k, v]) => `${k}=${v}`).join("&");
  }
  *values() {
    for (let i = 0; i < this.params.length; i += 1) {
      yield optionalDecode(this.params[i][1]);
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  get size() {
    return this.params.length;
  }
};
function extractParams(urlString, start, end, params, separators, equals, breakCodes, { encode: encode2 } = { encode: false }) {
  let index = start;
  let keyStart = index;
  let keyEnd = 0;
  let valStart = 0;
  const appendParams = encode2 ? params.append.bind(params) : (n, v) => params.params.push([n, v]);
  for (; index <= end; index += 1) {
    const code = urlString.charCodeAt(index);
    if (code === equals && keyEnd === 0) {
      keyEnd = index;
      valStart = index + 1;
    } else if (separators.indexOf(code) !== -1) {
      if (index > keyStart) {
        appendParams(urlString.slice(keyStart, keyEnd || index), urlString.slice(valStart || index, index));
      }
      keyStart = index + 1;
      keyEnd = 0;
      valStart = 0;
    } else if (breakCodes.indexOf(code) !== -1) {
      break;
    }
  }
  if (index !== keyStart) {
    appendParams(urlString.slice(keyStart, keyEnd || index), urlString.slice(valStart || index, index));
  }
  return index;
}
function optionalDecode(s) {
  if (s.indexOf("%") !== -1) {
    try {
      return decodeURIComponent(s.replace(/\+/g, " "));
    } catch (_e) {
      return s;
    }
  } else {
    return s;
  }
}
function encodeParameter(_s) {
  const s = "" + _s;
  let encoded = "";
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === CODE_SPACE) {
      encoded += "+";
    } else {
      encoded += encodeURIComponent(s[i]);
    }
  }
  return encoded;
}

// node_modules/@remusao/trie/dist/esm/index.js
function newNode() {
  return {
    chars: /* @__PURE__ */ new Map(),
    code: void 0
  };
}
function create(strings) {
  const node = newNode();
  for (let i = 0; i < strings.length; i += 1) {
    const tok = strings[i];
    let root = node;
    for (let j = 0; j < tok.length; j += 1) {
      const c = tok.charCodeAt(j);
      let next = root.chars.get(c);
      if (next === void 0) {
        next = newNode();
        root.chars.set(c, next);
      }
      root = next;
    }
    root.code = i;
  }
  return node;
}

// node_modules/@remusao/smaz-compress/dist/esm/index.js
var EMPTY_UINT8_ARRAY = new Uint8Array(0);
var SmazCompress = class {
  constructor(codebook, maxSize = 3e4) {
    this.trie = create(codebook);
    this.buffer = new Uint8Array(maxSize);
    this.verbatim = new Uint8Array(255);
  }
  getCompressedSize(buffer) {
    if (buffer.length === 0) {
      return 0;
    }
    const retrieve = typeof buffer === "string" ? (idx) => buffer.charCodeAt(idx) : (idx) => buffer[idx];
    let bufferIndex = 0;
    let verbatimIndex = 0;
    let inputIndex = 0;
    while (inputIndex < buffer.length) {
      let indexAfterMatch = -1;
      let code = -1;
      let root = this.trie;
      for (let j = inputIndex; j < buffer.length; j += 1) {
        root = root.chars.get(retrieve(j));
        if (root === void 0) {
          break;
        }
        if (root.code !== void 0) {
          code = root.code;
          indexAfterMatch = j + 1;
        }
      }
      if (code === -1) {
        verbatimIndex++;
        inputIndex++;
        if (verbatimIndex === 255) {
          bufferIndex += 2 + verbatimIndex;
          verbatimIndex = 0;
        }
      } else {
        if (verbatimIndex !== 0) {
          bufferIndex += 2 + (verbatimIndex === 1 ? 0 : verbatimIndex);
          verbatimIndex = 0;
        }
        bufferIndex++;
        inputIndex = indexAfterMatch;
      }
    }
    if (verbatimIndex !== 0) {
      bufferIndex += 2 + (verbatimIndex === 1 ? 0 : verbatimIndex);
    }
    return bufferIndex;
  }
  compress(buffer) {
    if (buffer.length === 0) {
      return EMPTY_UINT8_ARRAY;
    }
    const retrieve = typeof buffer === "string" ? (idx) => buffer.charCodeAt(idx) : (idx) => buffer[idx];
    let bufferIndex = 0;
    let verbatimIndex = 0;
    let inputIndex = 0;
    while (inputIndex < buffer.length) {
      let indexAfterMatch = -1;
      let code = -1;
      let root = this.trie;
      for (let j = inputIndex; j < buffer.length; j += 1) {
        root = root.chars.get(retrieve(j));
        if (root === void 0) {
          break;
        }
        if (root.code !== void 0) {
          code = root.code;
          indexAfterMatch = j + 1;
        }
      }
      if (code === -1) {
        this.verbatim[verbatimIndex++] = retrieve(inputIndex++);
        if (verbatimIndex === 255) {
          bufferIndex = this.flushVerbatim(verbatimIndex, bufferIndex);
          verbatimIndex = 0;
        }
      } else {
        if (verbatimIndex !== 0) {
          bufferIndex = this.flushVerbatim(verbatimIndex, bufferIndex);
          verbatimIndex = 0;
        }
        this.buffer[bufferIndex++] = code;
        inputIndex = indexAfterMatch;
      }
    }
    if (verbatimIndex !== 0) {
      bufferIndex = this.flushVerbatim(verbatimIndex, bufferIndex);
    }
    return this.buffer.slice(0, bufferIndex);
  }
  flushVerbatim(verbatimIndex, bufferIndex) {
    if (verbatimIndex === 1) {
      this.buffer[bufferIndex++] = 254;
      this.buffer[bufferIndex++] = this.verbatim[0];
    } else {
      this.buffer[bufferIndex++] = 255;
      this.buffer[bufferIndex++] = verbatimIndex;
      for (let k = 0; k < verbatimIndex; k += 1) {
        this.buffer[bufferIndex++] = this.verbatim[k];
      }
    }
    return bufferIndex;
  }
};

// node_modules/@remusao/smaz-decompress/dist/esm/index.js
var SmazDecompress = class {
  constructor(codebook) {
    this.codebook = codebook;
  }
  decompress(arr) {
    if (arr.byteLength === 0) {
      return "";
    }
    let output = "";
    let i = 0;
    while (i < arr.byteLength) {
      if (arr[i] === 254) {
        output += String.fromCharCode(arr[i + 1]);
        i += 2;
      } else if (arr[i] === 255) {
        const stop = i + arr[i + 1] + 2;
        for (i += 2; i < stop; i += 1) {
          output += String.fromCharCode(arr[i]);
        }
      } else {
        output += this.codebook[arr[i]];
        i += 1;
      }
    }
    return output;
  }
};
var EMPTY_UINT8_ARRAY2 = new Uint8Array(0);
var SmazDecompressRaw = class {
  /**
   * Initialize `SmazDecompressRaw` with a codebook with strings.
   * We use `TextEncoder` which encodes into utf8 to handle unicode characters such as '🥳'.
   * If you rely on a different encoding, you should pass encoded codebook to constructor
   * we don't distinguish the codebook chunk of the output from `decompress` method.
   * If you mix other encodings in the buffer while relying on this method, you need to
   * detect utf8 signatures and handle them separately, which is also not guaranteed.
   */
  static fromStringCodebook(codebook) {
    const TEXT_ENCODER2 = new TextEncoder();
    return new this(codebook.map((str) => TEXT_ENCODER2.encode(str)));
  }
  constructor(codebook) {
    this.codebook = codebook;
  }
  decompress(arr) {
    if (arr.byteLength === 0) {
      return EMPTY_UINT8_ARRAY2;
    }
    const chunks = [];
    let i = 0;
    while (i < arr.byteLength) {
      if (arr[i] === 254) {
        chunks.push(arr.subarray(i + 1, i + 2));
        i += 2;
      } else if (arr[i] === 255) {
        const stop = i + arr[i + 1] + 2;
        chunks.push(arr.subarray(i + 2, stop));
        i = stop;
      } else {
        chunks.push(this.codebook[arr[i]]);
        i += 1;
      }
    }
    const output = new Uint8Array(chunks.reduce((state, chunk) => state + chunk.byteLength, 0));
    for (let j = 0, offset = 0; j < chunks.length; j++) {
      output.set(chunks[j], offset);
      offset += chunks[j].byteLength;
    }
    return output;
  }
};

// node_modules/@remusao/smaz/dist/esm/index.js
var Smaz = class {
  constructor(codebook, maxSize = 3e4) {
    this.codebook = codebook;
    this.compressor = new SmazCompress(codebook, maxSize);
    this.decompressor = new SmazDecompress(codebook);
    this.rawDecompressor = SmazDecompressRaw.fromStringCodebook(codebook);
  }
  compress(buffer) {
    return this.compressor.compress(buffer);
  }
  getCompressedSize(buffer) {
    return this.compressor.getCompressedSize(buffer);
  }
  decompress(buffer) {
    return this.decompressor.decompress(buffer);
  }
  decompressRaw(buffer) {
    return this.rawDecompressor.decompress(buffer);
  }
};
var dictionary = ' ;the;e;t;a;of;o;and;i;n;s;e ;r; th; t;in;he;th;h;he ;to;\r\n;l;s ;d; a;an;er;c; o;d ;on; of;re;of ;t ;, ;is;u;at;   ;n ;or;which;f;m;as;it;that;\n;was;en;  ; w;es; an; i;f ;g;p;nd; s;nd ;ed ;w;ed;http://;https://;for;te;ing;y ;The; c;ti;r ;his;st; in;ar;nt;,; to;y;ng; h;with;le;al;to ;b;ou;be;were; b;se;o ;ent;ha;ng ;their;";hi;from; f;in ;de;ion;me;v;.;ve;all;re ;ri;ro;is ;co;f t;are;ea;. ;her; m;er ; p;es ;by;they;di;ra;ic;not;s, ;d t;at ;ce;la;h ;ne;as ;tio;on ;n t;io;we; a ;om;, a;s o;ur;li;ll;ch;had;this;e t;g ;e\r\n; wh;ere; co;e o;a ;us; d;ss;\n\r\n;\r\n\r;="; be; e;s a;ma;one;t t;or ;but;el;so;l ;e s;s,;no;ter; wa;iv;ho;e a; r;hat;s t;ns;ch ;wh;tr;ut;/;have;ly ;ta; ha; on;tha;-; l;ati;en ;pe; re;there;ass;si; fo;wa;ec;our;who;its;z;fo;rs;>;ot;un;<;im;th ;nc;ate;><;ver;ad; we;ly;ee; n;id; cl;ac;il;</;rt; wi;div;e, ; it;whi; ma;ge;x;e c;men;.com'.split(";");

// node_modules/@ghostery/adblocker/dist/esm/codebooks/cosmetic-selector.js
var cosmetic_selector_default = [
  ", document.createElement, ",
  ", document.getElementById,",
  "%3A%20initial%20!important",
  "%5Bhref%5E%3D%22https%3A%2",
  "%2522%253Afalse%252C%2522",
  ", document.oncontextmenu",
  "%22%3A%22denied%22%2C%22",
  "aeld, DOMContentLoaded, ",
  "set-local-storage-item, ",
  "trusted-click-element, ",
  "_ENSIGHTEN_PRIVACY_",
  "decodeURIComponent",
  '[target="_blank"]',
  "%22%3Afalse%2C%22",
  '[href^="https://',
  "%22%3Atrue%2C%22",
  '[href^="http://',
  '[href="https://',
  '[src^="https://',
  '[data-testid="',
  "%22%3Afalse%7D",
  "%22%5D, , 1000",
  "0!important%3B",
  "rmnt, script, ",
  ", , reload, 1",
  "BlockDetected",
  'div[class^="',
  ".prototype.",
  "contextmenu",
  "leaderboard",
  "no-fetch-if",
  "otification",
  ":has-text(",
  "aria-label",
  "background",
  "visibility",
  "analytics",
  "container",
  "Container",
  "div[style",
  "document.",
  "necessary",
  "no-xhr-if",
  "placehold",
  '[href*="',
  "%5Bdata-",
  "AAAAAAAA",
  "disclaim",
  "noopFunc",
  "trusted-",
  '.com/"]',
  "article",
  "consent",
  "Consent",
  "content",
  "keydown",
  "message",
  "privacy",
  "product",
  "sidebar",
  "sponsor",
  "wrapper",
  "-child",
  "[class",
  "[data-",
  '[id^="',
  "accept",
  "banner",
  "bottom",
  "button",
  "cookie",
  "Cookie",
  "COOKIE",
  "google",
  "iframe",
  "nostif",
  "notice",
  "nowoif",
  "policy",
  "Policy",
  "script",
  "widget",
  ":has(",
  ":not(",
  "Accep",
  "block",
  "Block",
  "click",
  "disab",
  "false",
  "fixed",
  "modal",
  "popup",
  "style",
  "video",
  "width",
  "0px;",
  "2%3A",
  "aeld",
  "aopr",
  "body",
  "foot",
  "gdpr",
  "html",
  "icky",
  "ight",
  "Info",
  "set-",
  "show",
  "tion",
  "true",
  "www.",
  " > ",
  "-ov",
  "%3A",
  "%3B",
  "%3D",
  "%3F",
  "522",
  "52C",
  "53A",
  "age",
  "app",
  "box",
  "com",
  "div",
  "dow",
  "ent",
  "lay",
  "out",
  "rap",
  "__",
  ", ",
  ".t",
  '"]',
  "%2",
  "%5",
  "%7",
  '="',
  "00",
  "ac",
  "ad",
  "Ad",
  "al",
  "an",
  "ar",
  "at",
  "ce",
  "de",
  "di",
  "ed",
  "en",
  "er",
  "et",
  "he",
  "id",
  "in",
  "it",
  "la",
  "le",
  "li",
  "lo",
  "ma",
  "mo",
  "mp",
  "ol",
  "on",
  "op",
  "or",
  "ra",
  "re",
  "ro",
  "s_",
  "s-",
  "se",
  "si",
  "sp",
  "st",
  "t-",
  "te",
  "ti",
  "un",
  "ve",
  " ",
  "_",
  "-",
  ";",
  ":",
  ".",
  "(",
  ")",
  "[",
  "]",
  "*",
  "/",
  "#",
  "^",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "a",
  "b",
  "B",
  "c",
  "C",
  "d",
  "D",
  "e",
  "E",
  "f",
  "F",
  "g",
  "G",
  "h",
  "H",
  "i",
  "I",
  "j",
  "k",
  "l",
  "L",
  "m",
  "M",
  "n",
  "N",
  "o",
  "O",
  "p",
  "P",
  "q",
  "Q",
  "r",
  "R",
  "s",
  "S",
  "t",
  "T",
  "u",
  "U",
  "v",
  "V",
  "w",
  "W",
  "x",
  "y",
  "Y",
  "z"
];

// node_modules/@ghostery/adblocker/dist/esm/codebooks/network-csp.js
var network_csp_default = [
  "sandbox allow-forms allow-same-origin allow-scripts allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' ",
  "default-src 'unsafe-inline' 'self' ",
  " allow-same-origin allow-scripts",
  "script-src 'self' 'unsafe-eval' ",
  " *.google.com *.gstatic.com *.",
  "gle.com *.googletagmanager.com",
  "script-src * 'unsafe-inline'",
  "default-src 'self'",
  " *.googleapis.com",
  "child-src 'none';",
  "worker-src 'none'",
  "'unsafe-inline'",
  " 'unsafe-eval'",
  "e-src 'self' *",
  " allow-modals",
  " data: blob:",
  ".gstatic.com",
  "child-src *",
  "script-src ",
  " https://",
  "facebook.",
  "frame-src",
  " allow-",
  ".com *.",
  "data: *",
  "sandbox",
  "'self'",
  "disqus",
  "google",
  "-src ",
  "ation",
  "data:",
  "media",
  ".com",
  "http",
  "styl",
  " *.",
  "cdn",
  "ent",
  "net",
  "ram",
  "yti",
  " *",
  " f",
  ".c",
  "ad",
  "ag",
  "ai",
  "al",
  "ap",
  "ch",
  "ck",
  "er",
  "es",
  "go",
  "ic",
  "il",
  "in",
  "is",
  "lo",
  "m:",
  "mg",
  "on",
  "or",
  "rc",
  "re",
  "st",
  "th",
  "tu",
  " ",
  "-",
  ";",
  ":",
  ".",
  "'",
  "*",
  "/",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y"
];

// node_modules/@ghostery/adblocker/dist/esm/codebooks/network-filter.js
var network_filter_default = [
  `,ipaddress=/^(1(72\\.67\\.\\d{3}|04\\.21\\.\\d+)\\.\\d+|188\\.114\\.9[67]\\.[08]|64:ff9b::[a-f0-9]{4}:[a-f0-9]{1,4})$/,replace='/^/<script>(()=>{window.open=new Proxy(window.open,{apply:(n,o,w)=>{}});let e=document.querySelector("script");e.innerHTML.includes("window.open")&&e.parentElement.removeChild(e)})();<\\/script>/i'`,
  "\\/(?:assets|build|bundles|chunks|dist|files|j|public|scripts|static)?\\/?(?:js\\/)?[0-9_a-z]{6,16}\\/?[0-9_a-z]{5,120}(?:[-.](?:app|bundle|ma?in|module|prod|index|v\\d|vendor))?(?:\\.js)?(?:\\?r=\\d)?$/$script,3p,match-case,",
  "~adatoolbar.com|~aswpsdkus.com|~chimpstatic.com|~clickiocmp.com|~mojirater.com|~polldaddy.com|~squareoffs.com|~succeedscene.com|~tallysight.com|~veraviews.com,",
  "/^https:\\/\\/(?:www\\d\\.)?[-a-z]{6,}\\.(?:club|com|info|net|org)\\/(?=[-_a-zA-Z]{0,42}\\d)(?=[-_0-9a-z]{0,42}[A-Z])[-_0-9a-zA-Z]{43}\\/\\?",
  "/^https:\\/\\/s[cfntz]y?[ace][acemnu][a-z]{1,4}or?[mn][a-z]{4,8}[iy][a-z]?\\.",
  "*&iu=%2F18190176%2C22509719621%2FAdThrive_Video_",
  "/(\\d{0,1})?tamilprint(\\d{1,2})?\\.[a-z]{3,7}/##",
  "/pagead/managed/js/gpt/*/pubads_impl",
  "[0-9a-z][0-9a-z][0-9a-z][0-9a-z]",
  "/extensions/*/AppMeasurement",
  "/pagead/js/adsbygoogle.js",
  "/js/sdkloader/ima3.js",
  "/js/sdkloader/ima3_d",
  "/videojs-contrib-ads",
  "/wp-content/plugins/",
  "/wp-content/uploads/",
  "/public/widget/data",
  "/wp-content/themes/",
  "/detroitchicago/",
  "/appmeasurement",
  "/cdn-cgi/trace",
  "\\/[a-zA-Z0-9]{",
  "/^https?:\\/\\/",
  "/^https:\\/\\/",
  "notification",
  "fingerprint",
  "/413gkwmt/",
  "/affiliate",
  "impression",
  "[a-z0-9]{",
  "/plugins/",
  "analytics",
  "telemetry",
  "[a-f0-9]",
  "/assets/",
  "/images/",
  "tracking",
  "/public",
  "300x250",
  "captcha",
  "collect",
  "consent",
  "content",
  "counter",
  "metrics",
  "/media",
  "banner",
  "client",
  "cookie",
  "google",
  "module",
  "rivacy",
  "script",
  "source",
  "widget",
  ".aspx",
  ".cgi?",
  ".com/",
  ".html",
  "[a-z]",
  "/api/",
  "/java",
  "/stat",
  "0x600",
  "a-z]{",
  "block",
  "click",
  "event",
  "fault",
  "frame",
  "manag",
  "pixel",
  "theme",
  "track",
  "type=",
  "video",
  "visit",
  ".gif",
  ".jpg",
  ".min",
  ".php",
  ".png",
  "[0-9",
  "/img",
  "/jqu",
  "/js/",
  "/lib",
  "/log",
  "/v1/",
  "/web",
  "/wp-",
  "468x",
  "gi-b",
  "http",
  "mail",
  "nfig",
  "sync",
  "tect",
  "uild",
  "view",
  ".js",
  "(?:",
  "/ad",
  "%2f",
  "%2F",
  "=*&",
  "age",
  "dpr",
  "jax",
  "key",
  "lay",
  "log",
  "new",
  "sdk",
  "tag",
  "unt",
  "web",
  "-p",
  ":/",
  "*/",
  "/_",
  "/?",
  "/*",
  "/b",
  "/d",
  "/f",
  "/g",
  "/h",
  "/l",
  "/m",
  "/n",
  "/p",
  "/r",
  "/u",
  "/w",
  "\\.",
  "\\/",
  "a-",
  "ac",
  "ad",
  "ai",
  "al",
  "am",
  "an",
  "ap",
  "ar",
  "at",
  "ce",
  "ch",
  "co",
  "de",
  "di",
  "e/",
  "ed",
  "el",
  "en",
  "er",
  "et",
  "ic",
  "id",
  "im",
  "in",
  "it",
  "js",
  "le",
  "li",
  "lo",
  "mm",
  "mp",
  "o/",
  "ol",
  "om",
  "on",
  "op",
  "or",
  "ot",
  "re",
  "ro",
  "s_",
  "s-",
  "s?",
  "s/",
  "sh",
  "si",
  "sp",
  "ss",
  "st",
  "t/",
  "te",
  "ti",
  "tm",
  "tr",
  "ub",
  "un",
  "up",
  "ur",
  "ut",
  "ve",
  "_",
  "-",
  ",",
  "?",
  ".",
  ")",
  "[",
  "]",
  "{",
  "}",
  "*",
  "/",
  "\\",
  "&",
  "%",
  "^",
  "+",
  "=",
  "|",
  "$",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z"
];

// node_modules/@ghostery/adblocker/dist/esm/codebooks/network-hostname.js
var network_hostname_default = [
  ".cloudfront.net",
  "googlesyndicati",
  "imasdk.googleap",
  ".actonservice",
  "analytics.",
  "marketing.",
  "tracking.",
  ".website",
  "metrics.",
  ".online",
  ".co.uk",
  ".space",
  "a8clk.",
  "stats.",
  ".cyou",
  ".qpon",
  ".shop",
  ".site",
  "a8cv.",
  "track",
  ".cfd",
  ".com",
  ".net",
  ".xyz",
  "www.",
  ".au",
  ".de",
  ".jp",
  "app",
  "cdn",
  ".b",
  ".c",
  ".d",
  ".f",
  ".h",
  ".k",
  ".l",
  ".m",
  ".n",
  ".p",
  ".s",
  ".w",
  "a1",
  "a2",
  "a4",
  "ab",
  "ac",
  "ad",
  "af",
  "ag",
  "ah",
  "ai",
  "ak",
  "al",
  "am",
  "an",
  "ap",
  "ar",
  "as",
  "at",
  "au",
  "av",
  "aw",
  "ax",
  "ay",
  "az",
  "be",
  "bl",
  "bo",
  "br",
  "bu",
  "ca",
  "ce",
  "ch",
  "ci",
  "ck",
  "cl",
  "cr",
  "ct",
  "cu",
  "cy",
  "de",
  "di",
  "dl",
  "dn",
  "do",
  "dr",
  "ds",
  "dy",
  "e-",
  "eb",
  "ec",
  "ed",
  "ef",
  "eg",
  "ek",
  "el",
  "em",
  "en",
  "ep",
  "er",
  "es",
  "et",
  "ev",
  "ew",
  "ex",
  "ey",
  "ff",
  "fi",
  "fl",
  "fo",
  "fr",
  "ge",
  "gl",
  "go",
  "gr",
  "gs",
  "gu",
  "gy",
  "he",
  "ho",
  "ia",
  "ib",
  "ic",
  "id",
  "ie",
  "if",
  "ig",
  "ik",
  "il",
  "im",
  "in",
  "io",
  "ip",
  "iq",
  "ir",
  "is",
  "it",
  "iv",
  "ix",
  "iz",
  "jo",
  "ks",
  "le",
  "li",
  "ll",
  "lo",
  "ly",
  "ma",
  "me",
  "mo",
  "mp",
  "my",
  "no",
  "ob",
  "ok",
  "ol",
  "om",
  "on",
  "oo",
  "op",
  "or",
  "ot",
  "ph",
  "pl",
  "po",
  "pr",
  "qu",
  "re",
  "ro",
  "ru",
  "ry",
  "s-",
  "sc",
  "se",
  "sh",
  "si",
  "sk",
  "sl",
  "sn",
  "so",
  "sp",
  "ss",
  "st",
  "sw",
  "sy",
  "ta",
  "te",
  "th",
  "ti",
  "tl",
  "tn",
  "to",
  "tr",
  "ts",
  "tu",
  "tv",
  "tw",
  "ty",
  "ub",
  "ud",
  "ug",
  "uk",
  "ul",
  "um",
  "un",
  "up",
  "ur",
  "us",
  "ut",
  "ve",
  "vi",
  "vo",
  "we",
  "wn",
  "yo",
  "-",
  ".",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z"
];

// node_modules/@ghostery/adblocker/dist/esm/codebooks/network-redirect.js
var network_redirect_default = [
  "google-analytics.com/analytics.js",
  "googlesyndication_adsbygoogle.js",
  "googletagmanager.com/gtm.js",
  "googletagservices_gpt.js",
  "googletagmanager_gtm.js",
  "fuckadblock.js-3.2.0:5",
  "amazon_apstag.js",
  "google-analytics",
  "fingerprint2.js",
  "noop-1s.mp4:10",
  "google-ima.js",
  "noop-0.1s.mp3",
  "prebid-ads.js",
  "analytics.js",
  "nobab2.js:10",
  "noopmp3-0.1s",
  "noop-1s.mp4",
  "noopmp4-1s",
  "32x32.png",
  "noop.html",
  "noopframe",
  "noop.css",
  "noop.txt",
  "nooptext",
  "1x1.gif",
  "2x2.png",
  "noop.js",
  "noopjs",
  ".com/",
  ".js:5",
  "noopv",
  ":10",
  ".js",
  "ads",
  "bea",
  ":5",
  ".0",
  "ar",
  "ch",
  "in",
  "le",
  "ma",
  "on",
  "oo",
  "re",
  "se",
  "st",
  "_",
  "-",
  ":",
  ".",
  "/",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z"
];

// node_modules/@ghostery/adblocker/dist/esm/codebooks/raw-network.js
var raw_network_default = [
  ".actonservi",
  "/js/sdkload",
  "^https:\\/\\/",
  "||smetrics.",
  "third-party",
  "xmlhttprequ",
  "-rule=noop",
  "marketing.",
  ",redirect",
  ".website^",
  "analytics",
  ",domain=",
  ".online^",
  "document",
  "metrics.",
  "tracking",
  ".space^",
  "$script",
  ".co.uk",
  ".cyou^",
  ".qpon^",
  ".shop^",
  ".site^",
  "a8clk.",
  "cookie",
  "google",
  "script",
  ".cfd^",
  ".com^",
  ".xyz^",
  "[a-z]",
  "/wp-c",
  "$doma",
  "a8cv.",
  "image",
  "media",
  "track",
  ".au^",
  ".com",
  ".fr^",
  ".gif",
  ".jp^",
  ".net",
  "/js/",
  "$doc",
  "$xhr",
  "www.",
  ",1p",
  ",3p",
  ".js",
  "%2F",
  "cdn",
  "web",
  ".b",
  ".c",
  ".m",
  ".n",
  ".p",
  ".t",
  "@@",
  "/*",
  "/p",
  "^$",
  "||",
  "ab",
  "ac",
  "ad",
  "af",
  "ag",
  "ak",
  "al",
  "am",
  "an",
  "ap",
  "ar",
  "as",
  "at",
  "au",
  "av",
  "aw",
  "ax",
  "ay",
  "az",
  "be",
  "bo",
  "br",
  "ca",
  "ce",
  "ch",
  "ck",
  "cl",
  "cr",
  "ct",
  "de",
  "di",
  "do",
  "ds",
  "e-",
  "eb",
  "ec",
  "ed",
  "el",
  "em",
  "en",
  "ep",
  "er",
  "es",
  "et",
  "ev",
  "ew",
  "ex",
  "ey",
  "fa",
  "ff",
  "fi",
  "fo",
  "fr",
  "g^",
  "ge",
  "go",
  "gr",
  "gu",
  "he",
  "hi",
  "ho",
  "hp",
  "ht",
  "ic",
  "id",
  "ie",
  "if",
  "ig",
  "ik",
  "il",
  "im",
  "in",
  "io",
  "ip",
  "ir",
  "is",
  "it",
  "iv",
  "ix",
  "iz",
  "jo",
  "jp",
  "js",
  "la",
  "le",
  "li",
  "lo",
  "lu",
  "ly",
  "ma",
  "mo",
  "mp",
  "my",
  "no",
  "od",
  "ok",
  "ol",
  "om",
  "on",
  "op",
  "or",
  "ot",
  "pl",
  "po",
  "pr",
  "qu",
  "re",
  "ri",
  "ro",
  "ru",
  "s/",
  "sc",
  "se",
  "sh",
  "si",
  "sk",
  "sm",
  "so",
  "sp",
  "ss",
  "st",
  "sw",
  "sy",
  "te",
  "th",
  "ti",
  "to",
  "tr",
  "ts",
  "ub",
  "ud",
  "ul",
  "um",
  "un",
  "up",
  "ur",
  "us",
  "ut",
  "ve",
  "vi",
  "yo",
  "_",
  "-",
  ",",
  "?",
  ".",
  "*",
  "/",
  "\\",
  "^",
  "=",
  "|",
  "~",
  "$",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z"
];

// node_modules/@ghostery/adblocker/dist/esm/codebooks/raw-cosmetic.js
var raw_cosmetic_default = [
  " !important;",
  "-storage-ite",
  "-touch-callo",
  '[href^="http',
  "%22%3Afalse%",
  'div[class^="',
  "ed-click-ele",
  "ment, button",
  "nt, script, ",
  "trusted-set-",
  "user-select:",
  ", document.",
  ".prototype.",
  "contextmenu",
  "ut: default",
  ":has-text(",
  "!important",
  ".com##+js(",
  "background",
  "flow: auto",
  "container",
  "set-local",
  "2%3Atrue",
  "-webkit",
  ":style(",
  ".*,xham",
  "AAAAAAA",
  "consent",
  "nowoif)",
  "privacy",
  "-wrapp",
  ".co.uk",
  "[class",
  "[data-",
  '[id^="',
  "##+js(",
  "accept",
  "banner",
  "bottom",
  "cookie",
  "Cookie",
  "google",
  "policy",
  "script",
  " text",
  ":has(",
  ".com,",
  "1000)",
  "block",
  "true)",
  ".com",
  ".de,",
  ".fr,",
  ".pl,",
  "#@#.",
  "aeld",
  "gdpr",
  "html",
  "ight",
  "news",
  "s://",
  "www.",
  " > ",
  "##.",
  "###",
  "%5B",
  "%5C",
  "%5D",
  "522",
  "52C",
  "age",
  "ent",
  "tru",
  "web",
  "__",
  "-s",
  ", ",
  ": ",
  ".*",
  ".b",
  ".n",
  ".p",
  ".t",
  '"]',
  "##",
  "%2",
  "%3",
  "%7",
  '="',
  "00",
  "ab",
  "ac",
  "ad",
  "Ad",
  "al",
  "am",
  "an",
  "ap",
  "ar",
  "as",
  "at",
  "bi",
  "bo",
  "ca",
  "ce",
  "ch",
  "ck",
  "co",
  "ct",
  "d-",
  "da",
  "de",
  "di",
  "do",
  "e-",
  "ed",
  "el",
  "en",
  "er",
  "es",
  "et",
  "fi",
  "fo",
  "g-",
  "ga",
  "ge",
  "go",
  "he",
  "ho",
  "ic",
  "id",
  "if",
  "il",
  "im",
  "in",
  "is",
  "it",
  "la",
  "ld",
  "le",
  "li",
  "lo",
  "ma",
  "me",
  "mi",
  "mo",
  "mp",
  "na",
  "ne",
  "no",
  "ok",
  "ol",
  "on",
  "op",
  "or",
  "ot",
  "ov",
  "po",
  "pp",
  "qu",
  "ra",
  "re",
  "ro",
  "ru",
  "s_",
  "s-",
  "sc",
  "se",
  "sh",
  "si",
  "sk",
  "so",
  "sp",
  "ss",
  "st",
  "t-",
  "ta",
  "th",
  "ti",
  "ub",
  "ul",
  "um",
  "un",
  "up",
  "ur",
  "us",
  "ut",
  "ve",
  "vi",
  "y-",
  " ",
  "_",
  "-",
  ",",
  ";",
  ":",
  ".",
  "(",
  ")",
  "[",
  "]",
  "*",
  "/",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "a",
  "A",
  "b",
  "B",
  "c",
  "C",
  "d",
  "D",
  "e",
  "E",
  "f",
  "F",
  "g",
  "h",
  "i",
  "I",
  "j",
  "k",
  "l",
  "L",
  "m",
  "M",
  "n",
  "N",
  "o",
  "O",
  "p",
  "P",
  "r",
  "R",
  "s",
  "S",
  "t",
  "T",
  "u",
  "v",
  "w",
  "W",
  "x",
  "y",
  "z"
];

// node_modules/@ghostery/adblocker/dist/esm/compression.js
var Compression = class {
  constructor() {
    this.cosmeticSelector = new Smaz(cosmetic_selector_default);
    this.networkCSP = new Smaz(network_csp_default);
    this.networkRedirect = new Smaz(network_redirect_default);
    this.networkHostname = new Smaz(network_hostname_default);
    this.networkFilter = new Smaz(network_filter_default);
    this.networkRaw = new Smaz(raw_network_default);
    this.cosmeticRaw = new Smaz(raw_cosmetic_default, 8e5);
  }
};

// node_modules/@ghostery/adblocker/dist/esm/crc32.js
var POLY = 3988292384;
var [T0, T1, T2, T3, T4, T5, T6, T7] = (() => {
  const tables = Array.from({ length: 8 }, () => new Int32Array(256));
  let c = 0;
  let n = 0;
  let k = 0;
  for (; n !== 256; n += 1) {
    c = n;
    for (k = 0; k !== 8; k += 1) {
      c = c & 1 ? POLY ^ c >>> 1 : c >>> 1;
    }
    tables[0][n] = c;
  }
  for (let i = 0; i !== 256; i += 1) {
    c = tables[0][i];
    for (n = 1; n !== tables.length; n += 1) {
      c = c >>> 8 ^ tables[0][c & 255];
      tables[n][i] = c;
    }
  }
  return tables;
})();
function crc32(buf, start, end) {
  const L = end - 7;
  let C = -1;
  let i = start;
  while (i < L) {
    C ^= buf[i] | buf[i + 1] << 8 | buf[i + 2] << 16 | buf[i + 3] << 24;
    C = T7[C & 255] ^ T6[C >>> 8 & 255] ^ T5[C >>> 16 & 255] ^ T4[C >>> 24] ^ T3[buf[i + 4]] ^ T2[buf[i + 5]] ^ T1[buf[i + 6]] ^ T0[buf[i + 7]];
    i += 8;
  }
  while (i < end) {
    C = C >>> 8 ^ T0[(C ^ buf[i]) & 255];
    i += 1;
  }
  return (C ^ -1) >>> 0;
}

// node_modules/@ghostery/adblocker/dist/esm/data-view.js
var EMPTY_UINT8_ARRAY3 = new Uint8Array(0);
var EMPTY_UINT32_ARRAY = new Uint32Array(0);
var LITTLE_ENDIAN = new Int8Array(new Int16Array([1]).buffer)[0] === 1;
var TEXT_ENCODER = new TextEncoder();
var TEXT_DECODER = new TextDecoder("utf8", { ignoreBOM: true });
var getCompressionSingleton = () => {
  const COMPRESSION = new Compression();
  getCompressionSingleton = () => COMPRESSION;
  return COMPRESSION;
};
function align4(pos) {
  return pos + 3 & ~3;
}
function sizeOfByte() {
  return 1;
}
function sizeOfBool() {
  return 1;
}
function sizeOfLength(length) {
  return length <= 127 ? 1 : 5;
}
function sizeOfBytes(array, align) {
  return sizeOfBytesWithLength(array.length, align);
}
function sizeOfBytesWithLength(length, align) {
  return (align ? 3 : 0) + length + sizeOfLength(length);
}
function sizeOfASCII(str) {
  return str.length + sizeOfLength(str.length);
}
function sizeOfUTF8(str) {
  const encodedLength = TEXT_ENCODER.encode(str).length;
  return encodedLength + sizeOfLength(encodedLength);
}
function sizeOfUint32Array(array) {
  return array.byteLength + sizeOfLength(array.length);
}
function sizeOfNetworkRedirect(str, compression) {
  return compression === true ? sizeOfBytesWithLength(getCompressionSingleton().networkRedirect.getCompressedSize(str), false) : sizeOfASCII(str);
}
function sizeOfNetworkHostname(str, compression) {
  return compression === true ? sizeOfBytesWithLength(getCompressionSingleton().networkHostname.getCompressedSize(str), false) : sizeOfASCII(str);
}
function sizeOfNetworkCSP(str, compression) {
  return compression === true ? sizeOfBytesWithLength(getCompressionSingleton().networkCSP.getCompressedSize(str), false) : sizeOfASCII(str);
}
function sizeOfNetworkFilter(str, compression) {
  return compression === true ? sizeOfBytesWithLength(getCompressionSingleton().networkFilter.getCompressedSize(str), false) : sizeOfASCII(str);
}
function sizeOfCosmeticSelector(str, compression) {
  return compression === true ? sizeOfBytesWithLength(getCompressionSingleton().cosmeticSelector.getCompressedSize(str), false) : sizeOfASCII(str);
}
function sizeOfRawNetwork(str, compression) {
  return compression === true ? sizeOfBytesWithLength(getCompressionSingleton().networkRaw.getCompressedSize(TEXT_ENCODER.encode(str)), false) : sizeOfUTF8(str);
}
function sizeOfRawCosmetic(str, compression) {
  return compression === true ? sizeOfBytesWithLength(getCompressionSingleton().cosmeticRaw.getCompressedSize(TEXT_ENCODER.encode(str)), false) : sizeOfUTF8(str);
}
var StaticDataView = class _StaticDataView {
  /**
   * Create an empty (i.e.: size = 0) StaticDataView.
   */
  static empty(options) {
    return _StaticDataView.fromUint8Array(EMPTY_UINT8_ARRAY3, options);
  }
  /**
   * Instantiate a StaticDataView instance from `array` of type Uint8Array.
   */
  static fromUint8Array(array, options) {
    return new _StaticDataView(array, options);
  }
  /**
   * Instantiate a StaticDataView with given `capacity` number of bytes.
   */
  static allocate(capacity, options) {
    return new _StaticDataView(new Uint8Array(capacity), options);
  }
  constructor(buffer, { enableCompression }) {
    if (LITTLE_ENDIAN === false) {
      throw new Error("Adblocker currently does not support Big-endian systems");
    }
    if (enableCompression === true) {
      this.enableCompression();
    }
    this.buffer = buffer;
    this.pos = 0;
  }
  enableCompression() {
    this.compression = getCompressionSingleton();
  }
  checksum() {
    return crc32(this.buffer, 0, this.pos);
  }
  dataAvailable() {
    return this.pos < this.buffer.byteLength;
  }
  setPos(pos) {
    this.pos = pos;
  }
  getPos() {
    return this.pos;
  }
  seekZero() {
    this.pos = 0;
  }
  slice() {
    this.checkSize();
    return this.buffer.slice(0, this.pos);
  }
  subarray() {
    if (this.pos === this.buffer.byteLength) {
      return this.buffer;
    }
    this.checkSize();
    return this.buffer.subarray(0, this.pos);
  }
  /**
   * Make sure that `this.pos` is aligned on a multiple of 4.
   */
  align4() {
    this.pos = align4(this.pos);
  }
  set(buffer) {
    this.buffer = new Uint8Array(buffer);
    this.seekZero();
  }
  pushBool(bool) {
    this.pushByte(Number(bool));
  }
  getBool() {
    return Boolean(this.getByte());
  }
  setByte(pos, byte) {
    this.buffer[pos] = byte;
  }
  pushByte(octet) {
    this.pushUint8(octet);
  }
  getByte() {
    return this.getUint8();
  }
  pushBytes(bytes, align = false) {
    this.pushLength(bytes.length);
    if (align === true) {
      this.align4();
    }
    this.buffer.set(bytes, this.pos);
    this.pos += bytes.byteLength;
  }
  getBytes(align = false) {
    const numberOfBytes = this.getLength();
    if (align === true) {
      this.align4();
    }
    const bytes = this.buffer.subarray(this.pos, this.pos + numberOfBytes);
    this.pos += numberOfBytes;
    return bytes;
  }
  /**
   * Allows row access to the internal buffer through a Uint32Array acting like
   * a view. This is used for super fast writing/reading of large chunks of
   * Uint32 numbers in the byte array.
   */
  getUint32ArrayView(desiredSize) {
    this.align4();
    if (desiredSize === 0) {
      return EMPTY_UINT32_ARRAY;
    }
    const view = new Uint32Array(this.buffer.buffer, this.pos + this.buffer.byteOffset, desiredSize);
    this.pos += desiredSize * 4;
    return view;
  }
  pushUint8(uint8) {
    this.buffer[this.pos++] = uint8;
  }
  getUint8() {
    return this.buffer[this.pos++];
  }
  pushUint16(uint16) {
    this.buffer[this.pos++] = uint16 >>> 8;
    this.buffer[this.pos++] = uint16;
  }
  getUint16() {
    return (this.buffer[this.pos++] << 8 | this.buffer[this.pos++]) >>> 0;
  }
  pushUint32(uint32) {
    this.buffer[this.pos++] = uint32 >>> 24;
    this.buffer[this.pos++] = uint32 >>> 16;
    this.buffer[this.pos++] = uint32 >>> 8;
    this.buffer[this.pos++] = uint32;
  }
  getUint32() {
    return (this.buffer[this.pos++] << 24 >>> 0) + (this.buffer[this.pos++] << 16 | this.buffer[this.pos++] << 8 | this.buffer[this.pos++]) >>> 0;
  }
  pushUint32Array(arr) {
    this.pushLength(arr.length);
    for (const n of arr) {
      this.pushUint32(n);
    }
  }
  getUint32Array() {
    const length = this.getLength();
    const arr = new Uint32Array(length);
    for (let i = 0; i < length; i += 1) {
      arr[i] = this.getUint32();
    }
    return arr;
  }
  pushUTF8(raw) {
    const pos = this.getPos();
    const start = pos + sizeOfLength(raw.length);
    const { written } = TEXT_ENCODER.encodeInto(raw, this.buffer.subarray(start));
    if (pos + sizeOfLength(written) !== start) {
      this.buffer.copyWithin(pos + 5, start, start + written);
    }
    this.setPos(pos);
    this.pushLength(written);
    this.setPos(this.pos + written);
  }
  getUTF8() {
    const byteLength = this.getLength();
    this.pos += byteLength;
    return TEXT_DECODER.decode(this.buffer.subarray(this.pos - byteLength, this.pos));
  }
  pushASCII(str) {
    this.pushLength(str.length);
    for (let i = 0; i < str.length; i += 1) {
      this.buffer[this.pos++] = str.charCodeAt(i);
    }
  }
  getASCII() {
    const byteLength = this.getLength();
    this.pos += byteLength;
    return String.fromCharCode.apply(null, this.buffer.subarray(this.pos - byteLength, this.pos));
  }
  pushNetworkRedirect(str) {
    if (this.compression !== void 0) {
      this.pushBytes(this.compression.networkRedirect.compress(str));
    } else {
      this.pushASCII(str);
    }
  }
  getNetworkRedirect() {
    if (this.compression !== void 0) {
      return this.compression.networkRedirect.decompress(this.getBytes());
    }
    return this.getASCII();
  }
  pushNetworkHostname(str) {
    if (this.compression !== void 0) {
      this.pushBytes(this.compression.networkHostname.compress(str));
    } else {
      this.pushASCII(str);
    }
  }
  getNetworkHostname() {
    if (this.compression !== void 0) {
      return this.compression.networkHostname.decompress(this.getBytes());
    }
    return this.getASCII();
  }
  pushNetworkCSP(str) {
    if (this.compression !== void 0) {
      this.pushBytes(this.compression.networkCSP.compress(str));
    } else {
      this.pushASCII(str);
    }
  }
  getNetworkCSP() {
    if (this.compression !== void 0) {
      return this.compression.networkCSP.decompress(this.getBytes());
    }
    return this.getASCII();
  }
  pushNetworkFilter(str) {
    if (this.compression !== void 0) {
      this.pushBytes(this.compression.networkFilter.compress(str));
    } else {
      this.pushASCII(str);
    }
  }
  getNetworkFilter() {
    if (this.compression !== void 0) {
      return this.compression.networkFilter.decompress(this.getBytes());
    }
    return this.getASCII();
  }
  pushCosmeticSelector(str) {
    if (this.compression !== void 0) {
      this.pushBytes(this.compression.cosmeticSelector.compress(str));
    } else {
      this.pushASCII(str);
    }
  }
  getCosmeticSelector() {
    if (this.compression !== void 0) {
      return this.compression.cosmeticSelector.decompress(this.getBytes());
    }
    return this.getASCII();
  }
  pushRawCosmetic(str) {
    if (this.compression !== void 0) {
      this.pushBytes(this.compression.cosmeticRaw.compress(TEXT_ENCODER.encode(str)));
    } else {
      this.pushUTF8(str);
    }
  }
  getRawCosmetic() {
    if (this.compression !== void 0) {
      return TEXT_DECODER.decode(this.compression.cosmeticRaw.decompressRaw(this.getBytes()));
    }
    return this.getUTF8();
  }
  pushRawNetwork(str) {
    if (this.compression !== void 0) {
      this.pushBytes(this.compression.networkRaw.compress(TEXT_ENCODER.encode(str)));
    } else {
      this.pushUTF8(str);
    }
  }
  getRawNetwork() {
    if (this.compression !== void 0) {
      return TEXT_DECODER.decode(this.compression.networkRaw.decompressRaw(this.getBytes()));
    }
    return this.getUTF8();
  }
  checkSize() {
    if (this.pos !== 0 && this.pos > this.buffer.byteLength) {
      throw new Error(`StaticDataView too small: ${this.buffer.byteLength}, but required ${this.pos} bytes`);
    }
  }
  // Serialiez `length` with variable encoding to save space
  pushLength(length) {
    if (length <= 127) {
      this.pushUint8(length);
    } else {
      this.pushUint8(128);
      this.pushUint32(length);
    }
  }
  getLength() {
    const lengthShort = this.getUint8();
    return lengthShort === 128 ? this.getUint32() : lengthShort;
  }
};

// node_modules/@ghostery/adblocker/dist/esm/config.js
var Config = class _Config {
  static deserialize(buffer) {
    return new _Config({
      debug: buffer.getBool(),
      enableCompression: buffer.getBool(),
      enableHtmlFiltering: buffer.getBool(),
      enableInMemoryCache: buffer.getBool(),
      enableMutationObserver: buffer.getBool(),
      enableOptimizations: buffer.getBool(),
      enablePushInjectionsOnNavigationEvents: buffer.getBool(),
      guessRequestTypeFromUrl: buffer.getBool(),
      integrityCheck: buffer.getBool(),
      loadCSPFilters: buffer.getBool(),
      loadCosmeticFilters: buffer.getBool(),
      loadExceptionFilters: buffer.getBool(),
      loadExtendedSelectors: buffer.getBool(),
      loadGenericCosmeticsFilters: buffer.getBool(),
      loadNetworkFilters: buffer.getBool(),
      loadPreprocessors: buffer.getBool()
    });
  }
  constructor({ debug = false, enableCompression = false, enableHtmlFiltering = false, enableInMemoryCache = true, enableMutationObserver = true, enableOptimizations = true, enablePushInjectionsOnNavigationEvents = true, guessRequestTypeFromUrl = false, integrityCheck = true, loadCSPFilters = true, loadCosmeticFilters = true, loadExceptionFilters = true, loadExtendedSelectors = false, loadGenericCosmeticsFilters = true, loadNetworkFilters = true, loadPreprocessors = false } = {}) {
    this.debug = debug;
    this.enableCompression = enableCompression;
    this.enableHtmlFiltering = enableHtmlFiltering;
    this.enableInMemoryCache = enableInMemoryCache;
    this.enableMutationObserver = enableMutationObserver;
    this.enableOptimizations = enableOptimizations;
    this.enablePushInjectionsOnNavigationEvents = enablePushInjectionsOnNavigationEvents;
    this.guessRequestTypeFromUrl = guessRequestTypeFromUrl;
    this.integrityCheck = integrityCheck;
    this.loadCSPFilters = loadCSPFilters;
    this.loadCosmeticFilters = loadCosmeticFilters;
    this.loadExceptionFilters = loadExceptionFilters;
    this.loadExtendedSelectors = loadExtendedSelectors;
    this.loadGenericCosmeticsFilters = loadGenericCosmeticsFilters;
    this.loadNetworkFilters = loadNetworkFilters;
    this.loadPreprocessors = loadPreprocessors;
  }
  getSerializedSize() {
    return 16 * sizeOfBool();
  }
  serialize(buffer) {
    buffer.pushBool(this.debug);
    buffer.pushBool(this.enableCompression);
    buffer.pushBool(this.enableHtmlFiltering);
    buffer.pushBool(this.enableInMemoryCache);
    buffer.pushBool(this.enableMutationObserver);
    buffer.pushBool(this.enableOptimizations);
    buffer.pushBool(this.enablePushInjectionsOnNavigationEvents);
    buffer.pushBool(this.guessRequestTypeFromUrl);
    buffer.pushBool(this.integrityCheck);
    buffer.pushBool(this.loadCSPFilters);
    buffer.pushBool(this.loadCosmeticFilters);
    buffer.pushBool(this.loadExceptionFilters);
    buffer.pushBool(this.loadExtendedSelectors);
    buffer.pushBool(this.loadGenericCosmeticsFilters);
    buffer.pushBool(this.loadNetworkFilters);
    buffer.pushBool(this.loadPreprocessors);
  }
};

// node_modules/@ghostery/adblocker/dist/esm/queue-microtask.js
var promise;
var queueMicrotask = typeof window !== "undefined" && typeof window.queueMicrotask === "function" ? (cb) => window.queueMicrotask(cb) : (
  // reuse resolved promise, and allocate it lazily
  (cb) => (promise || (promise = Promise.resolve())).then(cb).catch((err) => setTimeout(() => {
    throw err;
  }, 0))
);

// node_modules/@ghostery/adblocker/dist/esm/events.js
function registerCallback(event, callback, listeners) {
  let listenersForEvent = listeners.get(event);
  if (listenersForEvent === void 0) {
    listenersForEvent = [];
    listeners.set(event, listenersForEvent);
  }
  listenersForEvent.push(callback);
}
function unregisterCallback(event, callback, listeners) {
  const listenersForEvent = listeners.get(event);
  if (listenersForEvent !== void 0) {
    const indexOfCallback = listenersForEvent.indexOf(callback);
    if (indexOfCallback !== -1) {
      listenersForEvent.splice(indexOfCallback, 1);
    }
  }
}
function triggerCallback(event, args, listeners) {
  if (listeners.size === 0) {
    return false;
  }
  const listenersForEvent = listeners.get(event);
  if (listenersForEvent !== void 0) {
    queueMicrotask(() => {
      for (const listener of listenersForEvent) {
        listener(...args);
      }
    });
    return true;
  }
  return false;
}
var EventEmitter = class {
  constructor() {
    this.onceListeners = /* @__PURE__ */ new Map();
    this.onListeners = /* @__PURE__ */ new Map();
  }
  /**
   * Register an event listener for `event`.
   */
  on(event, callback) {
    registerCallback(event, callback, this.onListeners);
  }
  /**
   * Register an event listener for `event`; but only listen to first instance
   * of this event. The listener is automatically deleted afterwards.
   */
  once(event, callback) {
    registerCallback(event, callback, this.onceListeners);
  }
  /**
   * Remove `callback` from list of listeners for `event`.
   */
  unsubscribe(event, callback) {
    unregisterCallback(event, callback, this.onListeners);
    unregisterCallback(event, callback, this.onceListeners);
  }
  /**
   * Emit an event. Call all registered listeners to this event.
   */
  emit(event, ...args) {
    triggerCallback(event, args, this.onListeners);
    if (triggerCallback(event, args, this.onceListeners) === true) {
      this.onceListeners.delete(event);
    }
  }
};

// node_modules/@ghostery/adblocker/dist/esm/fetch.js
function fetchWithRetry(fetch2, url) {
  let retry = 3;
  const fetchWrapper = () => {
    return fetch2(url).catch((ex) => {
      if (retry > 0) {
        retry -= 1;
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            fetchWrapper().then(resolve).catch(reject);
          }, 500);
        });
      }
      throw ex;
    });
  };
  return fetchWrapper();
}
function fetchResource(fetch2, url) {
  return fetchWithRetry(fetch2, url).then((response) => response.text());
}
var PREFIX = "https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets";
var adsLists = [
  `${PREFIX}/easylist/easylist.txt`,
  `${PREFIX}/peter-lowe/serverlist.txt`,
  `${PREFIX}/ublock-origin/badware.txt`,
  `${PREFIX}/ublock-origin/filters-2020.txt`,
  `${PREFIX}/ublock-origin/filters-2021.txt`,
  `${PREFIX}/ublock-origin/filters-2022.txt`,
  `${PREFIX}/ublock-origin/filters-2023.txt`,
  `${PREFIX}/ublock-origin/filters-2024.txt`,
  `${PREFIX}/ublock-origin/filters.txt`,
  `${PREFIX}/ublock-origin/quick-fixes.txt`,
  `${PREFIX}/ublock-origin/resource-abuse.txt`,
  `${PREFIX}/ublock-origin/unbreak.txt`
];
var adsAndTrackingLists = [
  ...adsLists,
  `${PREFIX}/easylist/easyprivacy.txt`,
  `${PREFIX}/ublock-origin/privacy.txt`
];
var fullLists = [
  ...adsAndTrackingLists,
  `${PREFIX}/easylist/easylist-cookie.txt`,
  `${PREFIX}/ublock-origin/annoyances-others.txt`,
  `${PREFIX}/ublock-origin/annoyances-cookies.txt`
];
function fetchLists(fetch2, urls) {
  return Promise.all(urls.map((url) => fetchResource(fetch2, url)));
}
function fetchResources(fetch2) {
  return fetchResource(fetch2, `${PREFIX}/ublock-origin/resources.json`);
}

// node_modules/@ghostery/adblocker-extended-selectors/dist/esm/types.js
function isAtoms(tokens) {
  return tokens.every((token) => typeof token !== "string");
}
function isAST(tokens) {
  return tokens.every((token) => token.type !== "comma" && token.type !== "combinator");
}

// node_modules/@ghostery/adblocker-extended-selectors/dist/esm/parse.js
var RECURSIVE_PSEUDO_CLASSES = /* @__PURE__ */ new Set([
  "any",
  "dir",
  "has",
  "host-context",
  "is",
  "matches",
  "not",
  "where"
]);
var TOKENS = {
  attribute: /\[\s*(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)\s*(?:(?<operator>\W?=)\s*(?<value>.+?)\s*(?<caseSensitive>[iIsS])?\s*)?\]/gu,
  id: /#(?<name>(?:[-\w\u{0080}-\u{FFFF}]|\\.)+)/gu,
  class: /\.(?<name>(?:[-\w\u{0080}-\u{FFFF}]|\\.)+)/gu,
  comma: /\s*,\s*/g,
  // must be before combinator
  combinator: /\s*[\s>+~]\s*/g,
  // this must be after attribute
  "pseudo-element": /::(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?:¶*)\))?/gu,
  // this must be before pseudo-class
  "pseudo-class": /:(?<name>[-\w\u{0080}-\u{FFFF}]+)(?:\((?<argument>¶*)\))?/gu,
  type: /(?:(?<namespace>\*|[-\w]*)\|)?(?<name>[-\w\u{0080}-\u{FFFF}]+)|\*/gu
  // this must be last
};
var TOKENS_WITH_PARENS = /* @__PURE__ */ new Set(["pseudo-class", "pseudo-element"]);
var TOKENS_WITH_STRINGS = /* @__PURE__ */ new Set([...TOKENS_WITH_PARENS, "attribute"]);
var TRIM_TOKENS = /* @__PURE__ */ new Set(["combinator", "comma"]);
var TOKENS_FOR_RESTORE = Object.assign({}, TOKENS);
TOKENS_FOR_RESTORE["pseudo-element"] = RegExp(TOKENS["pseudo-element"].source.replace("(?<argument>\xB6*)", "(?<argument>.*?)"), "gu");
TOKENS_FOR_RESTORE["pseudo-class"] = RegExp(TOKENS["pseudo-class"].source.replace("(?<argument>\xB6*)", "(?<argument>.*)"), "gu");
function splitOnMatch(pattern, str) {
  pattern.lastIndex = 0;
  const match = pattern.exec(str);
  if (match === null) {
    return void 0;
  }
  const from = match.index - 1;
  const content = match[0];
  const before = str.slice(0, from + 1);
  const after = str.slice(from + content.length + 1);
  return [before, [content, match.groups || {}], after];
}
var GRAMMAR = [
  // attribute
  (str) => {
    const match = splitOnMatch(TOKENS.attribute, str);
    if (match === void 0) {
      return void 0;
    }
    const [before, [content, { name, operator, value, namespace, caseSensitive }], after] = match;
    if (name === void 0) {
      return void 0;
    }
    return [
      before,
      {
        type: "attribute",
        content,
        length: content.length,
        namespace,
        caseSensitive,
        pos: [],
        name,
        operator,
        value
      },
      after
    ];
  },
  // #id
  (str) => {
    const match = splitOnMatch(TOKENS.id, str);
    if (match === void 0) {
      return void 0;
    }
    const [before, [content, { name }], after] = match;
    if (name === void 0) {
      return void 0;
    }
    return [
      before,
      {
        type: "id",
        content,
        length: content.length,
        pos: [],
        name
      },
      after
    ];
  },
  // .class
  (str) => {
    const match = splitOnMatch(TOKENS.class, str);
    if (match === void 0) {
      return void 0;
    }
    const [before, [content, { name }], after] = match;
    if (name === void 0) {
      return void 0;
    }
    return [
      before,
      {
        type: "class",
        content,
        length: content.length,
        pos: [],
        name
      },
      after
    ];
  },
  // comma ,
  (str) => {
    const match = splitOnMatch(TOKENS.comma, str);
    if (match === void 0) {
      return void 0;
    }
    const [before, [content], after] = match;
    return [
      before,
      {
        type: "comma",
        content,
        length: content.length,
        pos: []
      },
      after
    ];
  },
  // combinator
  (str) => {
    const match = splitOnMatch(TOKENS.combinator, str);
    if (match === void 0) {
      return void 0;
    }
    const [before, [content], after] = match;
    return [
      before,
      {
        type: "combinator",
        content,
        length: content.length,
        pos: []
      },
      after
    ];
  },
  // pseudo-element
  (str) => {
    const match = splitOnMatch(TOKENS["pseudo-element"], str);
    if (match === void 0) {
      return void 0;
    }
    const [before, [content, { name }], after] = match;
    if (name === void 0) {
      return void 0;
    }
    return [
      before,
      {
        type: "pseudo-element",
        content,
        length: content.length,
        pos: [],
        name
      },
      after
    ];
  },
  // pseudo-class
  (str) => {
    const match = splitOnMatch(TOKENS["pseudo-class"], str);
    if (match === void 0) {
      return void 0;
    }
    const [before, [content, { name, argument }], after] = match;
    if (name === void 0) {
      return void 0;
    }
    return [
      before,
      {
        type: "pseudo-class",
        content,
        length: content.length,
        pos: [],
        name,
        argument,
        subtree: void 0
      },
      after
    ];
  },
  // type
  (str) => {
    const match = splitOnMatch(TOKENS.type, str);
    if (match === void 0) {
      return void 0;
    }
    const [before, [content, { name, namespace }], after] = match;
    return [
      before,
      {
        type: "type",
        content,
        length: content.length,
        namespace,
        pos: [],
        name
      },
      after
    ];
  }
];
function tokenizeBy(text) {
  if (!text) {
    return [];
  }
  const strarr = [text];
  for (const tokenizer of GRAMMAR) {
    for (let i = 0; i < strarr.length; i++) {
      const str = strarr[i];
      if (typeof str === "string") {
        const match = tokenizer(str);
        if (match !== void 0) {
          strarr.splice(i, 1, ...match.filter((a) => a.length !== 0));
        }
      }
    }
  }
  let offset = 0;
  for (const token of strarr) {
    if (typeof token !== "string") {
      token.pos = [offset, offset + token.length];
      if (TRIM_TOKENS.has(token.type)) {
        token.content = token.content.trim() || " ";
      }
    }
    offset += token.length;
  }
  if (isAtoms(strarr)) {
    return strarr;
  }
  return [];
}
function restoreNested(tokens, strings, regex, types) {
  for (const str of strings) {
    for (const token of tokens) {
      if (types.has(token.type) && token.pos[0] < str.start && str.start < token.pos[1]) {
        const content = token.content;
        token.content = token.content.replace(regex, str.str);
        if (token.content !== content) {
          TOKENS_FOR_RESTORE[token.type].lastIndex = 0;
          const match = TOKENS_FOR_RESTORE[token.type].exec(token.content);
          if (match !== null) {
            Object.assign(token, match.groups);
          }
        }
      }
    }
  }
}
function isEscaped(str, index) {
  let backslashes = 0;
  index -= 1;
  while (index >= 0 && str[index] === "\\") {
    backslashes += 1;
    index -= 1;
  }
  return backslashes % 2 !== 0;
}
function gobbleQuotes(text, quote, start) {
  let end = start + 1;
  while ((end = text.indexOf(quote, end)) !== -1 && isEscaped(text, end) === true) {
    end += 1;
  }
  if (end === -1) {
    return void 0;
  }
  return text.slice(start, end + 1);
}
function gobbleParens(text, start) {
  let stack = 0;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (char === "(") {
      stack += 1;
    } else if (char === ")") {
      if (stack > 0) {
        stack -= 1;
      } else {
        return void 0;
      }
    }
    if (stack === 0) {
      return text.slice(start, i + 1);
    }
  }
  return void 0;
}
function replace(selector, replacement, opening, gobble) {
  const strings = [];
  let offset = 0;
  while ((offset = selector.indexOf(opening, offset)) !== -1) {
    const str = gobble(selector, offset);
    if (str === void 0) {
      break;
    }
    strings.push({ str, start: offset });
    selector = `${selector.slice(0, offset + 1)}${replacement.repeat(str.length - 2)}${selector.slice(offset + str.length - 1)}`;
    offset += str.length;
  }
  return [strings, selector];
}
function tokenize(selector) {
  if (typeof selector !== "string") {
    return [];
  }
  selector = selector.trim();
  if (selector.length === 0) {
    return [];
  }
  const [doubleQuotes, selectorWithoutDoubleQuotes] = replace(selector, "\xA7", '"', (text, start) => gobbleQuotes(text, '"', start));
  const [singleQuotes, selectorWithoutQuotes] = replace(selectorWithoutDoubleQuotes, "\xA7", "'", (text, start) => gobbleQuotes(text, "'", start));
  const [parens, selectorWithoutParens] = replace(selectorWithoutQuotes, "\xB6", "(", gobbleParens);
  const tokens = tokenizeBy(selectorWithoutParens);
  restoreNested(tokens, parens, /\(¶*\)/, TOKENS_WITH_PARENS);
  restoreNested(tokens, doubleQuotes, /"§*"/, TOKENS_WITH_STRINGS);
  restoreNested(tokens, singleQuotes, /'§*'/, TOKENS_WITH_STRINGS);
  return tokens;
}
function nestTokens(tokens, { list = true } = {}) {
  if (list === true && tokens.some((t) => t.type === "comma")) {
    const selectors = [];
    const temp = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token.type === "comma") {
        if (temp.length === 0) {
          throw new Error("Incorrect comma at " + i);
        }
        const sub = nestTokens(temp, { list: false });
        if (sub !== void 0) {
          selectors.push(sub);
        }
        temp.length = 0;
      } else {
        temp.push(token);
      }
    }
    if (temp.length === 0) {
      throw new Error("Trailing comma");
    } else {
      const sub = nestTokens(temp, { list: false });
      if (sub !== void 0) {
        selectors.push(sub);
      }
    }
    return { type: "list", list: selectors };
  }
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === "combinator") {
      const left = nestTokens(tokens.slice(0, i));
      const right = nestTokens(tokens.slice(i + 1));
      if (right === void 0) {
        return void 0;
      }
      if (token.content !== " " && token.content !== "~" && token.content !== "+" && token.content !== ">") {
        return void 0;
      }
      return {
        type: "complex",
        combinator: token.content,
        left,
        right
      };
    }
  }
  if (tokens.length === 0) {
    return void 0;
  }
  if (isAST(tokens)) {
    if (tokens.length === 1) {
      return tokens[0];
    }
    return {
      type: "compound",
      compound: [...tokens]
      // clone to avoid pointers messing up the AST
    };
  }
  return void 0;
}
function walk(node, callback, o, parent) {
  if (node === void 0) {
    return;
  }
  if (node.type === "complex") {
    walk(node.left, callback, o, node);
    walk(node.right, callback, o, node);
  } else if (node.type === "compound") {
    for (const n of node.compound) {
      walk(n, callback, o, node);
    }
  } else if (node.type === "pseudo-class" && node.subtree !== void 0 && o !== void 0 && o.type === "pseudo-class" && o.subtree !== void 0) {
    walk(node.subtree, callback, o, node);
  }
  callback(node, parent);
}
function parse2(selector, { recursive = true, list = true } = {}) {
  const tokens = tokenize(selector);
  if (tokens.length === 0) {
    return void 0;
  }
  const ast = nestTokens(tokens, { list });
  if (recursive === true) {
    walk(ast, (node) => {
      if (node.type === "pseudo-class" && node.argument && node.name !== void 0 && RECURSIVE_PSEUDO_CLASSES.has(node.name)) {
        node.subtree = parse2(node.argument, { recursive: true, list: true });
      }
    });
  }
  return ast;
}

// node_modules/@ghostery/adblocker-extended-selectors/dist/esm/extended.js
var EXTENDED_PSEUDO_CLASSES = /* @__PURE__ */ new Set([
  // '-abp-contains',
  // '-abp-has',
  // '-abp-properties',
  "has-text",
  "matches-path",
  "matches-attr",
  "matches-css",
  "matches-css-after",
  "matches-css-before",
  "upward",
  "xpath"
  // 'if',
  // 'if-not',
  // 'min-text-length',
  // 'nth-ancestor',
  // 'watch-attr',
  // 'watch-attrs',
]);
var PSEUDO_CLASSES = /* @__PURE__ */ new Set([
  "active",
  "any",
  "any-link",
  "blank",
  "checked",
  "default",
  "defined",
  "dir",
  "disabled",
  "empty",
  "enabled",
  "first",
  "first-child",
  "first-of-type",
  "focus",
  "focus-visible",
  "focus-within",
  "fullscreen",
  "has",
  "host",
  "host-context",
  "hover",
  "in-range",
  "indeterminate",
  "invalid",
  "is",
  "lang",
  "last-child",
  "last-of-type",
  "left",
  "link",
  "matches",
  // NOTE: by default we consider `:not(...)` to be a normal CSS selector since,
  // we are only interested in cases where the argument is an extended selector.
  // If that is the case, it will still be detected as such.
  "not",
  "nth-child",
  "nth-last-child",
  "nth-last-of-type",
  "nth-of-type",
  "only-child",
  "only-of-type",
  "optional",
  "out-of-range",
  "placeholder-shown",
  "read-only",
  "read-write",
  "required",
  "right",
  "root",
  "scope",
  "target",
  "valid",
  "visited",
  "where"
]);
var PSEUDO_ELEMENTS = /* @__PURE__ */ new Set(["after", "before", "first-letter", "first-line"]);
var PSEUDO_DIRECTIVES = /* @__PURE__ */ new Set(["remove", "remove-attr", "remove-class"]);
var SelectorType;
(function(SelectorType2) {
  SelectorType2[SelectorType2["Normal"] = 0] = "Normal";
  SelectorType2[SelectorType2["Extended"] = 1] = "Extended";
  SelectorType2[SelectorType2["Invalid"] = 2] = "Invalid";
})(SelectorType || (SelectorType = {}));
function classifySelector(selector) {
  if (selector.indexOf(":") === -1) {
    return SelectorType.Normal;
  }
  const tokens = tokenize(selector);
  let foundSupportedExtendedSelector = false;
  for (const token of tokens) {
    if (token.type === "pseudo-class") {
      const { name } = token;
      if (EXTENDED_PSEUDO_CLASSES.has(name) === true || PSEUDO_DIRECTIVES.has(name) === true) {
        foundSupportedExtendedSelector = true;
      } else if (PSEUDO_CLASSES.has(name) === false && PSEUDO_ELEMENTS.has(name) === false) {
        return SelectorType.Invalid;
      }
      if (name === "has" && token.argument !== void 0 && token.argument.indexOf(":has(") !== -1) {
        foundSupportedExtendedSelector = true;
      }
      if (foundSupportedExtendedSelector === false && token.argument !== void 0 && RECURSIVE_PSEUDO_CLASSES.has(name) === true) {
        const argumentType = classifySelector(token.argument);
        if (argumentType === SelectorType.Invalid) {
          return argumentType;
        } else if (argumentType === SelectorType.Extended) {
          foundSupportedExtendedSelector = true;
        }
      }
    }
  }
  if (foundSupportedExtendedSelector === true) {
    return SelectorType.Extended;
  }
  return SelectorType.Normal;
}
function destructAST(ast) {
  if (ast.type === "compound") {
    const last = ast.compound[ast.compound.length - 1];
    if (last.type === "pseudo-class" && PSEUDO_DIRECTIVES.has(last.name)) {
      if (ast.compound.length < 3) {
        return {
          element: ast.compound[0],
          directive: last
        };
      }
      return {
        element: {
          type: "compound",
          compound: ast.compound.slice(0, -1)
        },
        directive: last
      };
    }
  }
  return {
    element: ast,
    directive: null
  };
}
function indexOfPseudoDirective(selector) {
  let i = selector.lastIndexOf(")");
  if (i === -1) {
    return -1;
  }
  while (i--) {
    const c = selector.charCodeAt(i);
    if (c < 33)
      continue;
    if (c === 39 || c === 34 || c === 96) {
      while (i--) {
        if (selector.charCodeAt(i) === c) {
          break;
        }
      }
      break;
    }
  }
  if (i < 0)
    i = selector.length;
  while (i--) {
    if (selector.charCodeAt(i) === 40) {
      break;
    }
  }
  const lastIndexOfColon = selector.lastIndexOf(":", i);
  if (PSEUDO_DIRECTIVES.has(selector.slice(lastIndexOfColon + 1, i))) {
    return lastIndexOfColon;
  }
  return -1;
}

// node_modules/@remusao/guess-url-type/dist/esm/extensions/documents.js
var EXTENSIONS = /* @__PURE__ */ new Set(["htm", "html", "xhtml"]);

// node_modules/@remusao/guess-url-type/dist/esm/extensions/fonts.js
var EXTENSIONS2 = /* @__PURE__ */ new Set([
  "eot",
  "otf",
  "sfnt",
  "ttf",
  "woff",
  "woff2"
]);

// node_modules/@remusao/guess-url-type/dist/esm/extensions/images.js
var EXTENSIONS3 = /* @__PURE__ */ new Set([
  "apng",
  "bmp",
  "cur",
  "dib",
  "eps",
  "gif",
  "heic",
  "heif",
  "ico",
  "j2k",
  "jfi",
  "jfif",
  "jif",
  "jp2",
  "jpe",
  "jpeg",
  "jpf",
  "jpg",
  "jpm",
  "jpx",
  "mj2",
  "pjp",
  "pjpeg",
  "png",
  "svg",
  "svgz",
  "tif",
  "tiff",
  "webp"
]);

// node_modules/@remusao/guess-url-type/dist/esm/extensions/medias.js
var EXTENSIONS4 = /* @__PURE__ */ new Set([
  "avi",
  "flv",
  "mp3",
  "mp4",
  "ogg",
  "wav",
  "weba",
  "webm",
  "wmv"
]);

// node_modules/@remusao/guess-url-type/dist/esm/extensions/scripts.js
var EXTENSIONS5 = /* @__PURE__ */ new Set(["js", "ts", "jsx", "esm"]);

// node_modules/@remusao/guess-url-type/dist/esm/extensions/stylesheets.js
var EXTENSIONS6 = /* @__PURE__ */ new Set(["css", "scss"]);

// node_modules/@remusao/guess-url-type/dist/esm/extname.js
function extname(url) {
  let endOfPath = url.length;
  const indexOfFragment = url.indexOf("#");
  if (indexOfFragment !== -1) {
    endOfPath = indexOfFragment;
  }
  const indexOfQuery = url.indexOf("?");
  if (indexOfQuery !== -1 && indexOfQuery < endOfPath) {
    endOfPath = indexOfQuery;
  }
  let startOfExt = endOfPath - 1;
  let code = 0;
  for (; startOfExt >= 0; startOfExt -= 1) {
    code = url.charCodeAt(startOfExt);
    if ((code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 48 && code <= 57) === false) {
      break;
    }
  }
  if (code !== 46 || startOfExt < 0 || endOfPath - startOfExt >= 10) {
    return "";
  }
  return url.slice(startOfExt + 1, endOfPath);
}

// node_modules/@remusao/guess-url-type/dist/esm/index.js
function getRequestType(url) {
  const ext = extname(url);
  if (EXTENSIONS3.has(ext) || url.startsWith("data:image/") || url.startsWith("https://frog.wix.com/bt")) {
    return "image";
  }
  if (EXTENSIONS4.has(ext) || url.startsWith("data:audio/") || url.startsWith("data:video/")) {
    return "media";
  }
  if (EXTENSIONS6.has(ext) || url.startsWith("data:text/css")) {
    return "stylesheet";
  }
  if (EXTENSIONS5.has(ext) || url.startsWith("data:") && (url.startsWith("data:application/ecmascript") || url.startsWith("data:application/javascript") || url.startsWith("data:application/x-ecmascript") || url.startsWith("data:application/x-javascript") || url.startsWith("data:text/ecmascript") || url.startsWith("data:text/javascript") || url.startsWith("data:text/javascript1.0") || url.startsWith("data:text/javascript1.1") || url.startsWith("data:text/javascript1.2") || url.startsWith("data:text/javascript1.3") || url.startsWith("data:text/javascript1.4") || url.startsWith("data:text/javascript1.5") || url.startsWith("data:text/jscript") || url.startsWith("data:text/livescript") || url.startsWith("data:text/x-ecmascript") || url.startsWith("data:text/x-javascript")) || url.startsWith("https://maps.googleapis.com/maps/api/js") || url.startsWith("https://www.googletagmanager.com/gtag/js")) {
    return "script";
  }
  if (EXTENSIONS.has(ext) || url.startsWith("data:text/html") || url.startsWith("data:application/xhtml") || url.startsWith("https://www.youtube.com/embed/") || url.startsWith("https://www.google.com/gen_204")) {
    return "document";
  }
  if (EXTENSIONS2.has(ext) || url.startsWith("data:font/")) {
    return "font";
  }
  return "other";
}

// node_modules/@ghostery/adblocker/dist/esm/tokens-buffer.js
var TokensBuffer = class {
  constructor(size) {
    this.pos = 0;
    this.buffer = new Uint32Array(size);
  }
  reset() {
    this.pos = 0;
  }
  slice() {
    return this.buffer.slice(0, this.pos);
  }
  push(token) {
    this.buffer[this.pos++] = token;
  }
  empty() {
    return this.pos === 0;
  }
  full() {
    return this.pos === this.buffer.length;
  }
  remaining() {
    return this.buffer.length - this.pos;
  }
};
var TOKENS_BUFFER = new TokensBuffer(1024);

// node_modules/@ghostery/adblocker/dist/esm/utils.js
var HASH_INTERNAL_MULT = 37;
var HASH_SEED = 5011;
function bitCount(n) {
  n = n - (n >> 1 & 1431655765);
  n = (n & 858993459) + (n >> 2 & 858993459);
  return (n + (n >> 4) & 252645135) * 16843009 >> 24;
}
function getBit(n, mask) {
  return !!(n & mask);
}
function setBit(n, mask) {
  return (n | mask) >>> 0;
}
function clearBit(n, mask) {
  return (n & ~mask) >>> 0;
}
function fastHashBetween(str, begin, end) {
  let hash = HASH_SEED;
  for (let i = begin; i < end; i += 1) {
    hash = hash * HASH_INTERNAL_MULT ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}
function fastHash(str) {
  if (typeof str !== "string") {
    return HASH_SEED;
  }
  if (str.length === 0) {
    return HASH_SEED;
  }
  return fastHashBetween(str, 0, str.length);
}
function hashStrings(strings) {
  const result = new Uint32Array(strings.length);
  let index = 0;
  for (const str of strings) {
    result[index++] = fastHash(str);
  }
  return result;
}
function isDigit(ch) {
  return ch >= 48 && ch <= 57;
}
function isAlpha(ch) {
  return ch >= 97 && ch <= 122 || ch >= 65 && ch <= 90;
}
function isAlphaExtended(ch) {
  return ch >= 192 && ch <= 450;
}
function isCyrillic(ch) {
  return ch >= 1024 && ch <= 1279;
}
function isAllowedCode(ch) {
  return isAlpha(ch) || isDigit(ch) || ch === 37 || isAlphaExtended(ch) || isCyrillic(ch);
}
function tokenizeWithWildcardsInPlace(pattern, skipFirstToken, skipLastToken, buffer) {
  const len = Math.min(pattern.length, buffer.remaining() * 2);
  let inside = false;
  let precedingCh = 0;
  let start = 0;
  let hash = HASH_SEED;
  for (let i = 0; i < len; i += 1) {
    const ch = pattern.charCodeAt(i);
    if (isAllowedCode(ch) === true) {
      if (inside === false) {
        hash = HASH_SEED;
        inside = true;
        start = i;
      }
      hash = hash * HASH_INTERNAL_MULT ^ ch;
    } else {
      if (inside === true) {
        inside = false;
        if (i - start > 1 && // Ignore tokens of 1 character
        ch !== 42 && // Ignore tokens followed by a '*'
        precedingCh !== 42 && // Ignore tokens preceeded by a '*'
        (skipFirstToken === false || start !== 0)) {
          buffer.push(hash >>> 0);
        }
      }
      precedingCh = ch;
    }
  }
  if (skipLastToken === false && inside === true && precedingCh !== 42 && // Ignore tokens preceeded by a '*'
  pattern.length - start > 1 && // Ignore tokens of 1 character
  buffer.full() === false) {
    buffer.push(hash >>> 0);
  }
}
function tokenizeInPlace(pattern, skipFirstToken, skipLastToken, buffer) {
  const len = Math.min(pattern.length, buffer.remaining() * 2);
  let inside = false;
  let start = 0;
  let hash = HASH_SEED;
  for (let i = 0; i < len; i += 1) {
    const ch = pattern.charCodeAt(i);
    if (isAllowedCode(ch) === true) {
      if (inside === false) {
        hash = HASH_SEED;
        inside = true;
        start = i;
      }
      hash = hash * HASH_INTERNAL_MULT ^ ch;
    } else if (inside === true) {
      inside = false;
      if (i - start > 1 && // Ignore tokens of 1 character
      (skipFirstToken === false || start !== 0)) {
        buffer.push(hash >>> 0);
      }
    }
  }
  if (inside === true && skipLastToken === false && pattern.length - start > 1 && // Ignore tokens of 1 character
  buffer.full() === false) {
    buffer.push(hash >>> 0);
  }
}
function tokenizeNoSkipInPlace(pattern, buffer) {
  const len = Math.min(pattern.length, buffer.remaining() * 2);
  let inside = false;
  let start = 0;
  let hash = HASH_SEED;
  for (let i = 0; i < len; i += 1) {
    const ch = pattern.charCodeAt(i);
    if (isAllowedCode(ch) === true) {
      if (inside === false) {
        hash = HASH_SEED;
        inside = true;
        start = i;
      }
      hash = hash * HASH_INTERNAL_MULT ^ ch;
    } else if (inside === true) {
      inside = false;
      if (i - start > 1) {
        buffer.push(hash >>> 0);
      }
    }
  }
  if (inside === true && pattern.length - start > 1 && buffer.full() === false) {
    buffer.push(hash >>> 0);
  }
}
function tokenizeNoSkip(pattern) {
  TOKENS_BUFFER.reset();
  tokenizeNoSkipInPlace(pattern, TOKENS_BUFFER);
  return TOKENS_BUFFER.slice();
}
function tokenize2(pattern, skipFirstToken, skipLastToken) {
  TOKENS_BUFFER.reset();
  tokenizeInPlace(pattern, skipFirstToken, skipLastToken, TOKENS_BUFFER);
  return TOKENS_BUFFER.slice();
}
function tokenizeRegexInPlace(selector, tokens) {
  let end = selector.length - 1;
  let begin = 1;
  let prev = 0;
  for (; begin < end; begin += 1) {
    const code = selector.charCodeAt(begin);
    if (code === 124) {
      return;
    }
    if (code === 40 || code === 42 || code === 43 || code === 63 || code === 91 || code === 123 || code === 46 && prev !== 92 || code === 92 && isAlpha(selector.charCodeAt(begin + 1))) {
      break;
    }
    prev = code;
  }
  prev = 0;
  for (; end >= begin; end -= 1) {
    const code = selector.charCodeAt(end);
    if (code === 124) {
      return;
    }
    if (code === 41 || code === 42 || code === 43 || code === 63 || code === 93 || code === 125 || code === 46 && selector.charCodeAt(end - 1) !== 92 || code === 92 && isAlpha(prev)) {
      break;
    }
    prev = code;
  }
  if (end < begin) {
    const skipFirstToken = selector.charCodeAt(1) !== 94;
    const skipLastToken = selector.charCodeAt(selector.length - 1) !== 36;
    tokenizeInPlace(selector.slice(1, selector.length - 1), skipFirstToken, skipLastToken, tokens);
  } else {
    if (begin > 1) {
      tokenizeInPlace(
        selector.slice(1, begin),
        selector.charCodeAt(1) !== 94,
        // skipFirstToken
        true,
        tokens
      );
    }
    if (end < selector.length - 1) {
      tokenizeInPlace(
        selector.slice(end + 1, selector.length - 1),
        true,
        selector.charCodeAt(selector.length - 1) !== 94,
        // skipLastToken
        tokens
      );
    }
  }
}
function binSearch2(arr, elt) {
  if (arr.length === 0) {
    return -1;
  }
  let low = 0;
  let high = arr.length - 1;
  while (low <= high) {
    const mid = low + high >>> 1;
    const midVal = arr[mid];
    if (midVal < elt) {
      low = mid + 1;
    } else if (midVal > elt) {
      high = mid - 1;
    } else {
      return mid;
    }
  }
  return -1;
}
function binLookup(arr, elt) {
  return binSearch2(arr, elt) !== -1;
}
var hasUnicodeRe = /[^\u0000-\u00ff]/;
function hasUnicode(str) {
  return hasUnicodeRe.test(str);
}
function findLastIndexOfUnescapedCharacter(text, character) {
  let lastIndex = text.lastIndexOf(character);
  if (lastIndex === -1) {
    return -1;
  }
  while (lastIndex > 0 && text.charCodeAt(lastIndex - 1) === 92) {
    lastIndex = text.lastIndexOf(character, lastIndex - 1);
  }
  return lastIndex;
}

// node_modules/@ghostery/adblocker/dist/esm/request.js
var TLDTS_OPTIONS = {
  extractHostname: true,
  mixedInputs: false,
  validateHostname: false
};
var NORMALIZED_TYPE_TOKEN = {
  beacon: fastHash("type:beacon"),
  cspReport: fastHash("type:csp"),
  csp_report: fastHash("type:csp"),
  cspviolationreport: fastHash("type:cspviolationreport"),
  document: fastHash("type:document"),
  eventsource: fastHash("type:other"),
  fedcm: fastHash("type:script"),
  fetch: fastHash("type:xhr"),
  font: fastHash("type:font"),
  image: fastHash("type:image"),
  imageset: fastHash("type:image"),
  json: fastHash("type:script"),
  mainFrame: fastHash("type:document"),
  main_frame: fastHash("type:document"),
  manifest: fastHash("type:other"),
  media: fastHash("type:media"),
  object: fastHash("type:object"),
  object_subrequest: fastHash("type:object"),
  other: fastHash("type:other"),
  ping: fastHash("type:ping"),
  prefetch: fastHash("type:other"),
  preflight: fastHash("type:preflight"),
  script: fastHash("type:script"),
  signedexchange: fastHash("type:signedexchange"),
  speculative: fastHash("type:other"),
  stylesheet: fastHash("type:stylesheet"),
  subFrame: fastHash("type:subdocument"),
  sub_frame: fastHash("type:subdocument"),
  texttrack: fastHash("type:other"),
  webSocket: fastHash("type:websocket"),
  web_manifest: fastHash("type:other"),
  websocket: fastHash("type:websocket"),
  xhr: fastHash("type:xhr"),
  xml_dtd: fastHash("type:other"),
  xmlhttprequest: fastHash("type:xhr"),
  xslt: fastHash("type:other")
};
function hashHostnameBackward(hostname) {
  let hash = HASH_SEED;
  for (let j = hostname.length - 1; j >= 0; j -= 1) {
    hash = hash * HASH_INTERNAL_MULT ^ hostname.charCodeAt(j);
  }
  return hash >>> 0;
}
function getHashesFromLabelsBackward(hostname, end, startOfDomain) {
  TOKENS_BUFFER.reset();
  let hash = HASH_SEED;
  for (let i = end - 1; i >= 0; i -= 1) {
    const code = hostname.charCodeAt(i);
    if (code === 46 && i < startOfDomain) {
      TOKENS_BUFFER.push(hash >>> 0);
    }
    hash = hash * HASH_INTERNAL_MULT ^ code;
  }
  TOKENS_BUFFER.push(hash >>> 0);
  return TOKENS_BUFFER.slice();
}
function getHostnameWithoutPublicSuffix(hostname, domain) {
  let hostnameWithoutPublicSuffix = null;
  const indexOfDot = domain.indexOf(".");
  if (indexOfDot !== -1) {
    const publicSuffix = domain.slice(indexOfDot + 1);
    hostnameWithoutPublicSuffix = hostname.slice(0, -publicSuffix.length - 1);
  }
  return hostnameWithoutPublicSuffix;
}
function getEntityHashesFromLabelsBackward(hostname, domain) {
  const hostnameWithoutPublicSuffix = getHostnameWithoutPublicSuffix(hostname, domain);
  if (hostnameWithoutPublicSuffix !== null) {
    return getHashesFromLabelsBackward(hostnameWithoutPublicSuffix, hostnameWithoutPublicSuffix.length, hostnameWithoutPublicSuffix.length);
  }
  return EMPTY_UINT32_ARRAY;
}
function getHostnameHashesFromLabelsBackward(hostname, domain) {
  return getHashesFromLabelsBackward(hostname, hostname.length, hostname.length - domain.length);
}
function isThirdParty(hostname, domain, sourceHostname, sourceDomain, type) {
  if (type === "main_frame" || type === "mainFrame") {
    return false;
  } else if (domain.length !== 0 && sourceDomain.length !== 0) {
    return domain !== sourceDomain;
  } else if (domain.length !== 0 && sourceHostname.length !== 0) {
    return domain !== sourceHostname;
  } else if (sourceDomain.length !== 0 && hostname.length !== 0) {
    return hostname !== sourceDomain;
  }
  return false;
}
var Request = class _Request {
  /**
   * Create an instance of `Request` from raw request details.
   */
  static fromRawDetails({ requestId = "0", tabId = 0, url = "", hostname, domain, sourceUrl = "", sourceHostname, sourceDomain, type = "main_frame", _originalRequestDetails }) {
    if (hostname === void 0 || domain === void 0) {
      const parsed = parse(url, TLDTS_OPTIONS);
      hostname = hostname || parsed.hostname || "";
      domain = domain || parsed.domain || "";
    }
    if (sourceHostname === void 0 || sourceDomain === void 0) {
      const parsed = parse(sourceHostname || sourceDomain || sourceUrl, TLDTS_OPTIONS);
      sourceHostname = sourceHostname || parsed.hostname || "";
      sourceDomain = sourceDomain || parsed.domain || sourceHostname || "";
    }
    return new _Request({
      requestId,
      tabId,
      domain,
      hostname,
      url,
      sourceDomain,
      sourceHostname,
      sourceUrl,
      type,
      _originalRequestDetails
    });
  }
  constructor({ requestId, tabId, type, domain, hostname, url, sourceDomain, sourceHostname, _originalRequestDetails }) {
    this.tokens = void 0;
    this.hostnameHashes = void 0;
    this.entityHashes = void 0;
    this._originalRequestDetails = _originalRequestDetails;
    this.id = requestId;
    this.tabId = tabId;
    this.type = type;
    this.url = url;
    this.hostname = hostname;
    this.domain = domain;
    this.sourceHostnameHashes = sourceHostname.length === 0 ? EMPTY_UINT32_ARRAY : getHostnameHashesFromLabelsBackward(sourceHostname, sourceDomain);
    this.sourceEntityHashes = sourceHostname.length === 0 ? EMPTY_UINT32_ARRAY : getEntityHashesFromLabelsBackward(sourceHostname, sourceDomain);
    this.isThirdParty = isThirdParty(hostname, domain, sourceHostname, sourceDomain, type);
    this.isFirstParty = !this.isThirdParty;
    this.isSupported = true;
    if (this.type === "websocket" || this.url.startsWith("ws:") || this.url.startsWith("wss:")) {
      this.isHttp = false;
      this.isHttps = false;
      this.type = "websocket";
      this.isSupported = true;
    } else if (this.url.startsWith("http:")) {
      this.isHttp = true;
      this.isHttps = false;
    } else if (this.url.startsWith("https:")) {
      this.isHttps = true;
      this.isHttp = false;
    } else if (this.url.startsWith("data:")) {
      this.isHttp = false;
      this.isHttps = false;
      const indexOfComa = this.url.indexOf(",");
      if (indexOfComa !== -1) {
        this.url = this.url.slice(0, indexOfComa);
      }
    } else {
      this.isHttp = false;
      this.isHttps = false;
      this.isSupported = false;
    }
    this.normalizedUrl = this.url.toLowerCase();
  }
  getHostnameHashes() {
    if (this.hostnameHashes === void 0) {
      this.hostnameHashes = this.hostname.length === 0 ? EMPTY_UINT32_ARRAY : getHostnameHashesFromLabelsBackward(this.hostname, this.domain);
    }
    return this.hostnameHashes;
  }
  getEntityHashes() {
    if (this.entityHashes === void 0) {
      this.entityHashes = this.hostname.length === 0 ? EMPTY_UINT32_ARRAY : getEntityHashesFromLabelsBackward(this.hostname, this.domain);
    }
    return this.entityHashes;
  }
  getTokens() {
    if (this.tokens === void 0) {
      TOKENS_BUFFER.reset();
      for (const hash of this.sourceHostnameHashes) {
        TOKENS_BUFFER.push(hash);
      }
      TOKENS_BUFFER.push(NORMALIZED_TYPE_TOKEN[this.type]);
      tokenizeNoSkipInPlace(this.normalizedUrl, TOKENS_BUFFER);
      this.tokens = TOKENS_BUFFER.slice();
    }
    return this.tokens;
  }
  isMainFrame() {
    return this.type === "main_frame" || this.type === "mainFrame";
  }
  isSubFrame() {
    return this.type === "sub_frame" || this.type === "subFrame";
  }
  /**
   * Calling this method will attempt to guess the type of a request based on
   * information found in `url` only. This can be useful to try and fine-tune
   * the type of a Request when it is not otherwise available or if it was
   * inferred as 'other'.
   */
  guessTypeOfRequest() {
    const currentType = this.type;
    this.type = getRequestType(this.url);
    if (currentType !== this.type) {
      this.tokens = void 0;
    }
    return this.type;
  }
};

// node_modules/@ghostery/adblocker/dist/esm/punycode.js
var maxInt = 2147483647;
var base = 36;
var tMin = 1;
var tMax = 26;
var skew = 38;
var damp = 700;
var initialBias = 72;
var initialN = 128;
var delimiter = "-";
var regexNonASCII = /[^\0-\x7E]/;
var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
var errors = {
  "invalid-input": "Invalid input",
  "not-basic": "Illegal input >= 0x80 (not a basic code point)",
  "overflow": "Overflow: input needs wider integers to process"
};
var baseMinusTMin = base - tMin;
function error(type) {
  throw new RangeError(errors[type]);
}
function ucs2decode(str) {
  const output = [];
  let counter = 0;
  const length = str.length;
  while (counter < length) {
    const value = str.charCodeAt(counter++);
    if (value >= 55296 && value <= 56319 && counter < length) {
      const extra = str.charCodeAt(counter++);
      if ((extra & 64512) === 56320) {
        output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
      } else {
        output.push(value);
        counter--;
      }
    } else {
      output.push(value);
    }
  }
  return output;
}
function digitToBasic(digit, flag) {
  return digit + 22 + 75 * (digit < 26 ? 1 : 0) - ((flag !== 0 ? 1 : 0) << 5);
}
function adapt(delta, numPoints, firstTime) {
  let k = 0;
  delta = firstTime ? Math.floor(delta / damp) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  for (
    ;
    /* no initialization */
    delta > baseMinusTMin * tMax >> 1;
    k += base
  ) {
    delta = Math.floor(delta / baseMinusTMin);
  }
  return Math.floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
}
function encode(str) {
  const output = [];
  const input = ucs2decode(str);
  const inputLength = input.length;
  let n = initialN;
  let delta = 0;
  let bias = initialBias;
  for (let i = 0; i < input.length; i += 1) {
    const currentValue = input[i];
    if (currentValue < 128) {
      output.push(String.fromCharCode(currentValue));
    }
  }
  const basicLength = output.length;
  let handledCPCount = basicLength;
  if (basicLength) {
    output.push(delimiter);
  }
  while (handledCPCount < inputLength) {
    let m = maxInt;
    for (let i = 0; i < input.length; i += 1) {
      const currentValue = input[i];
      if (currentValue >= n && currentValue < m) {
        m = currentValue;
      }
    }
    const handledCPCountPlusOne = handledCPCount + 1;
    if (m - n > Math.floor((maxInt - delta) / handledCPCountPlusOne)) {
      error("overflow");
    }
    delta += (m - n) * handledCPCountPlusOne;
    n = m;
    for (let i = 0; i < input.length; i += 1) {
      const currentValue = input[i];
      if (currentValue < n && ++delta > maxInt) {
        error("overflow");
      }
      if (currentValue === n) {
        let q = delta;
        for (let k = base; ; k += base) {
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (q < t) {
            break;
          }
          const qMinusT = q - t;
          const baseMinusT = base - t;
          output.push(String.fromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
          q = Math.floor(qMinusT / baseMinusT);
        }
        output.push(String.fromCharCode(digitToBasic(q, 0)));
        bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
        delta = 0;
        ++handledCPCount;
      }
    }
    ++delta;
    ++n;
  }
  return output.join("");
}
function toASCII(input) {
  const labels = input.replace(regexSeparators, ".").split(".");
  const encoded = [];
  for (let i = 0; i < labels.length; i += 1) {
    encoded.push(regexNonASCII.test(labels[i]) ? "xn--" + encode(labels[i]) : labels[i]);
  }
  return encoded.join(".");
}

// node_modules/@ghostery/adblocker/dist/esm/engine/domains.js
var Domains = class _Domains {
  static parse(value, { delimiter: delimiter2 = ",", debug = false } = {}) {
    if (typeof value === "string") {
      if (value.length === 0) {
        return void 0;
      }
    } else if (value.size === 0) {
      return void 0;
    }
    const parts = typeof value === "string" ? value.split(delimiter2) : value;
    for (const part of parts) {
      if (part.length === 0) {
        return void 0;
      }
    }
    const entities = [];
    const notEntities = [];
    const hostnames = [];
    const notHostnames = [];
    const rawParts = [];
    for (const rawHostname of parts) {
      let hostname = rawHostname;
      if (hasUnicode(hostname)) {
        hostname = toASCII(hostname);
      }
      const negation = hostname.charCodeAt(0) === 126;
      const entity = hostname.charCodeAt(hostname.length - 1) === 42 && hostname.charCodeAt(hostname.length - 2) === 46;
      const start = negation ? 1 : 0;
      const end = entity ? hostname.length - 2 : hostname.length;
      const hash = hashHostnameBackward(negation === true || entity === true ? hostname.slice(start, end) : hostname);
      if (negation) {
        if (entity) {
          notEntities.push(hash);
        } else {
          notHostnames.push(hash);
        }
        if (debug) {
          rawParts.push(negation ? rawHostname : `~${rawHostname}`);
        }
      } else {
        if (entity) {
          entities.push(hash);
        } else {
          hostnames.push(hash);
        }
        if (debug) {
          rawParts.push(negation ? rawHostname.slice(1) : rawHostname);
        }
      }
    }
    return new _Domains({
      entities: entities.length !== 0 ? new Uint32Array(entities).sort() : void 0,
      hostnames: hostnames.length !== 0 ? new Uint32Array(hostnames).sort() : void 0,
      notEntities: notEntities.length !== 0 ? new Uint32Array(notEntities).sort() : void 0,
      notHostnames: notHostnames.length !== 0 ? new Uint32Array(notHostnames).sort() : void 0,
      parts: debug === true ? rawParts.join(delimiter2) : void 0
    });
  }
  static deserialize(buffer) {
    const optionalParts = buffer.getUint8();
    return new _Domains({
      entities: (optionalParts & 1) === 1 ? buffer.getUint32Array() : void 0,
      hostnames: (optionalParts & 2) === 2 ? buffer.getUint32Array() : void 0,
      notEntities: (optionalParts & 4) === 4 ? buffer.getUint32Array() : void 0,
      notHostnames: (optionalParts & 8) === 8 ? buffer.getUint32Array() : void 0,
      parts: (optionalParts & 16) === 16 ? buffer.getUTF8() : void 0
    });
  }
  constructor({ entities, hostnames, notEntities, notHostnames, parts }) {
    this.entities = entities;
    this.hostnames = hostnames;
    this.notEntities = notEntities;
    this.notHostnames = notHostnames;
    this.parts = parts;
  }
  updateId(hash) {
    const { hostnames, entities, notHostnames, notEntities } = this;
    if (hostnames !== void 0) {
      for (const hostname of hostnames) {
        hash = hash * HASH_INTERNAL_MULT ^ hostname;
      }
    }
    if (entities !== void 0) {
      for (const entity of entities) {
        hash = hash * HASH_INTERNAL_MULT ^ entity;
      }
    }
    if (notHostnames !== void 0) {
      for (const notHostname of notHostnames) {
        hash = hash * HASH_INTERNAL_MULT ^ notHostname;
      }
    }
    if (notEntities !== void 0) {
      for (const notEntity of notEntities) {
        hash = hash * HASH_INTERNAL_MULT ^ notEntity;
      }
    }
    return hash;
  }
  serialize(buffer) {
    const index = buffer.getPos();
    buffer.pushUint8(0);
    let optionalParts = 0;
    if (this.entities !== void 0) {
      optionalParts |= 1;
      buffer.pushUint32Array(this.entities);
    }
    if (this.hostnames !== void 0) {
      optionalParts |= 2;
      buffer.pushUint32Array(this.hostnames);
    }
    if (this.notEntities !== void 0) {
      optionalParts |= 4;
      buffer.pushUint32Array(this.notEntities);
    }
    if (this.notHostnames !== void 0) {
      optionalParts |= 8;
      buffer.pushUint32Array(this.notHostnames);
    }
    if (this.parts !== void 0) {
      optionalParts |= 16;
      buffer.pushUTF8(this.parts);
    }
    buffer.setByte(index, optionalParts);
  }
  getSerializedSize() {
    let estimate = 1;
    if (this.entities !== void 0) {
      estimate += sizeOfUint32Array(this.entities);
    }
    if (this.hostnames !== void 0) {
      estimate += sizeOfUint32Array(this.hostnames);
    }
    if (this.notHostnames !== void 0) {
      estimate += sizeOfUint32Array(this.notHostnames);
    }
    if (this.notEntities !== void 0) {
      estimate += sizeOfUint32Array(this.notEntities);
    }
    if (this.parts !== void 0) {
      estimate += sizeOfUTF8(this.parts);
    }
    return estimate;
  }
  match(hostnameHashes, entityHashes) {
    if (this.notHostnames !== void 0) {
      for (const hash of hostnameHashes) {
        if (binLookup(this.notHostnames, hash)) {
          return false;
        }
      }
    }
    if (this.notEntities !== void 0) {
      for (const hash of entityHashes) {
        if (binLookup(this.notEntities, hash)) {
          return false;
        }
      }
    }
    if (this.hostnames !== void 0 || this.entities !== void 0) {
      if (this.hostnames !== void 0) {
        for (const hash of hostnameHashes) {
          if (binLookup(this.hostnames, hash)) {
            return true;
          }
        }
      }
      if (this.entities !== void 0) {
        for (const hash of entityHashes) {
          if (binLookup(this.entities, hash)) {
            return true;
          }
        }
      }
      return false;
    }
    return true;
  }
};

// node_modules/@ghostery/adblocker/dist/esm/html-filtering.js
function extractHTMLSelectorFromRule(rule) {
  if (rule.startsWith("^script") === false) {
    return void 0;
  }
  const prefix = ":has-text(";
  const selectors = [];
  let index = 7;
  while (rule.startsWith(prefix, index)) {
    index += prefix.length;
    let currentParsingDepth = 1;
    const startOfSelectorIndex = index;
    let prev = -1;
    for (; index < rule.length && currentParsingDepth !== 0; index += 1) {
      const code = rule.charCodeAt(index);
      if (prev !== 92) {
        if (code === 40) {
          currentParsingDepth += 1;
        }
        if (code === 41) {
          currentParsingDepth -= 1;
        }
      }
      prev = code;
    }
    selectors.push(rule.slice(startOfSelectorIndex, index - 1));
  }
  if (index !== rule.length) {
    return void 0;
  }
  return ["script", selectors];
}

// node_modules/@ghostery/adblocker/dist/esm/filters/cosmetic.js
var EMPTY_TOKENS = [EMPTY_UINT32_ARRAY];
var DEFAULT_HIDING_STYLE = "display: none !important;";
var REGEXP_UNICODE_COMMA = new RegExp(/\\u002C/, "g");
var REGEXP_UNICODE_BACKSLASH = new RegExp(/\\u005C/, "g");
var REGEXP_ESCAPED_COMMA = new RegExp(/\\,/, "g");
var REGEXP_ESCAPED_SINGLE_QUOTE = new RegExp(/\\'/, "g");
var REGEXP_ESCAPED_DOUBLE_QUOTE = new RegExp(/\\"/, "g");
var REGEXP_ESCAPED_BACKTICK = new RegExp(/\\`/, "g");
function isSimpleSelector(selector) {
  for (let i = 1; i < selector.length; i += 1) {
    const code = selector.charCodeAt(i);
    if (!(code === 45 || code === 95 || code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122)) {
      if (i < selector.length - 1) {
        const nextCode = selector.charCodeAt(i + 1);
        if (code === 91 || code === 46 || code === 58 || code === 32 && (nextCode === 62 || nextCode === 43 || nextCode === 126 || nextCode === 46 || nextCode === 35)) {
          return true;
        }
      }
      return false;
    }
  }
  return true;
}
function isSimpleHrefSelector(selector, start) {
  return selector.startsWith('href^="', start) || selector.startsWith('href*="', start) || selector.startsWith('href="', start);
}
var isValidCss = (() => {
  const div = typeof document !== "undefined" ? document.createElement("div") : {
    matches: () => {
    }
  };
  const matches2 = (selector) => div.matches(selector);
  const validSelectorRe = /^[#.]?[\w-.]+$/;
  return function isValidCssImpl(selector) {
    if (validSelectorRe.test(selector)) {
      return true;
    }
    try {
      matches2(selector);
    } catch (ex) {
      return false;
    }
    return true;
  };
})();
var COSMETICS_MASK;
(function(COSMETICS_MASK2) {
  COSMETICS_MASK2[COSMETICS_MASK2["unhide"] = 1] = "unhide";
  COSMETICS_MASK2[COSMETICS_MASK2["scriptInject"] = 2] = "scriptInject";
  COSMETICS_MASK2[COSMETICS_MASK2["isUnicode"] = 4] = "isUnicode";
  COSMETICS_MASK2[COSMETICS_MASK2["isClassSelector"] = 8] = "isClassSelector";
  COSMETICS_MASK2[COSMETICS_MASK2["isIdSelector"] = 16] = "isIdSelector";
  COSMETICS_MASK2[COSMETICS_MASK2["isHrefSelector"] = 32] = "isHrefSelector";
  COSMETICS_MASK2[COSMETICS_MASK2["extended"] = 64] = "extended";
})(COSMETICS_MASK || (COSMETICS_MASK = {}));
var HASH_DOMAINS_MARKER_LOW = 1;
var HASH_DOMAINS_MARKER_HIGH = 253;
function computeFilterId(mask, selector, domains, parentDomains, style) {
  let hash = HASH_SEED * HASH_INTERNAL_MULT ^ mask;
  if (selector !== void 0) {
    for (let i = 0; i < selector.length; i += 1) {
      hash = hash * HASH_INTERNAL_MULT ^ selector.charCodeAt(i);
    }
  }
  if (domains !== void 0) {
    hash = hash * HASH_INTERNAL_MULT ^ HASH_DOMAINS_MARKER_LOW;
    hash = domains.updateId(hash);
  }
  if (parentDomains !== void 0) {
    hash = hash * HASH_INTERNAL_MULT ^ HASH_DOMAINS_MARKER_HIGH;
    hash = parentDomains.updateId(hash);
  }
  if (style !== void 0) {
    for (let i = 0; i < style.length; i += 1) {
      hash = hash * HASH_INTERNAL_MULT ^ style.charCodeAt(i);
    }
  }
  return hash >>> 0;
}
function normalizeSelector(filter, getScriptletCanonicalName) {
  let selector = filter.getSelector();
  if (filter.style !== void 0) {
    selector += filter.style;
  }
  if (filter.isScriptInject() === false) {
    return selector;
  }
  const parsed = filter.parseScript();
  if (parsed === void 0) {
    return selector;
  }
  const canonicalName = getScriptletCanonicalName(parsed.name);
  if (canonicalName === void 0) {
    return selector;
  }
  return selector.replace(parsed.name, canonicalName);
}
var CosmeticFilter = class _CosmeticFilter {
  /**
   * Given a line that we know contains a cosmetic filter, create a CosmeticFiler
   * instance out of it. This function should be *very* efficient, as it will be
   * used to parse tens of thousands of lines.
   */
  static parse(line, debug = false) {
    const rawLine = line;
    let mask = 0;
    let selector;
    let domains;
    let parentDomains;
    let style;
    const sharpIndex = line.indexOf("#");
    const afterSharpIndex = sharpIndex + 1;
    let suffixStartIndex = afterSharpIndex + 1;
    if (line.length > afterSharpIndex) {
      if (line[afterSharpIndex] === "@") {
        mask = setBit(mask, COSMETICS_MASK.unhide);
        suffixStartIndex += 1;
      } else if (line[afterSharpIndex] === "?") {
        suffixStartIndex += 1;
      }
    }
    if (suffixStartIndex >= line.length) {
      return null;
    }
    if (sharpIndex > 0) {
      const domainEntries = [];
      const parentDomainEntries = [];
      for (const entry of line.slice(0, sharpIndex).split(",")) {
        if (entry.endsWith(">>")) {
          parentDomainEntries.push(entry.slice(0, -2));
        } else {
          domainEntries.push(entry);
        }
      }
      if (domainEntries.length !== 0) {
        domains = Domains.parse(domainEntries.join(","), {
          debug
        });
      }
      if (parentDomainEntries.length !== 0) {
        parentDomains = Domains.parse(parentDomainEntries.join(","), {
          debug
        });
      }
    }
    if (line.length - suffixStartIndex >= 8 && line.endsWith(")") && line.indexOf(":style(", suffixStartIndex) !== -1) {
      const indexOfStyle = line.indexOf(":style(", suffixStartIndex);
      style = line.slice(indexOfStyle + 7, -1);
      line = line.slice(0, indexOfStyle);
    }
    if (line.charCodeAt(suffixStartIndex) === 94) {
      if (line.startsWith("script:has-text(", suffixStartIndex + 1) === false || line.charCodeAt(line.length - 1) !== 41) {
        return null;
      }
      selector = line.slice(suffixStartIndex, line.length);
      if (extractHTMLSelectorFromRule(selector) === void 0) {
        return null;
      }
    } else if (line.length - suffixStartIndex > 4 && line.charCodeAt(suffixStartIndex) === 43 && line.startsWith("+js(", suffixStartIndex)) {
      if ((domains === void 0 || domains.hostnames === void 0 && domains.entities === void 0) && (parentDomains === void 0 || parentDomains.hostnames === void 0 && parentDomains.entities === void 0) && getBit(mask, COSMETICS_MASK.unhide) === false) {
        return null;
      }
      mask = setBit(mask, COSMETICS_MASK.scriptInject);
      selector = line.slice(suffixStartIndex + 4, line.length - 1);
      if (getBit(mask, COSMETICS_MASK.unhide) === false && selector.length === 0) {
        return null;
      }
    } else {
      selector = line.slice(suffixStartIndex);
      const selectorType = classifySelector(selector);
      if (selectorType === SelectorType.Extended) {
        if (
          // Selectors not having an element selector are invalid.
          // `:remove()` or `:remove-attr(attr-name)` without an
          // element selector doesn't make sense.
          selector.slice(0, indexOfPseudoDirective(selector)).trim().length === 0
        ) {
          return null;
        }
        mask = setBit(mask, COSMETICS_MASK.extended);
      } else if (selectorType === SelectorType.Invalid || !isValidCss(selector)) {
        return null;
      }
    }
    if (parentDomains !== void 0 && getBit(mask, COSMETICS_MASK.scriptInject) === false) {
      return null;
    }
    if (domains === void 0 && getBit(mask, COSMETICS_MASK.extended) === true) {
      return null;
    }
    if (selector !== void 0) {
      if (hasUnicode(selector)) {
        mask = setBit(mask, COSMETICS_MASK.isUnicode);
      }
      if (getBit(mask, COSMETICS_MASK.scriptInject) === false && getBit(mask, COSMETICS_MASK.extended) === false && selector.startsWith("^") === false) {
        const c0 = selector.charCodeAt(0);
        const c1 = selector.charCodeAt(1);
        const c2 = selector.charCodeAt(2);
        if (getBit(mask, COSMETICS_MASK.scriptInject) === false) {
          if (c0 === 46 && isSimpleSelector(selector)) {
            mask = setBit(mask, COSMETICS_MASK.isClassSelector);
          } else if (c0 === 35 && isSimpleSelector(selector)) {
            mask = setBit(mask, COSMETICS_MASK.isIdSelector);
          } else if (c0 === 97 && c1 === 91 && c2 === 104 && isSimpleHrefSelector(selector, 2)) {
            mask = setBit(mask, COSMETICS_MASK.isHrefSelector);
          } else if (c0 === 91 && c1 === 104 && isSimpleHrefSelector(selector, 1)) {
            mask = setBit(mask, COSMETICS_MASK.isHrefSelector);
          }
        }
      }
    }
    return new _CosmeticFilter({
      mask,
      rawLine: debug === true ? rawLine : void 0,
      selector,
      style,
      domains,
      parentDomains
    });
  }
  /**
   * Deserialize cosmetic filters. The code accessing the buffer should be
   * symetrical to the one in `serializeCosmeticFilter`.
   */
  static deserialize(buffer) {
    const mask = buffer.getUint16();
    const isUnicode = getBit(mask, COSMETICS_MASK.isUnicode);
    const optionalParts = buffer.getUint8();
    const selector = isUnicode ? buffer.getUTF8() : buffer.getCosmeticSelector();
    return new _CosmeticFilter({
      // Mandatory fields
      mask,
      selector,
      // Optional fields
      domains: (optionalParts & 1) === 1 ? Domains.deserialize(buffer) : void 0,
      rawLine: (optionalParts & 2) === 2 ? buffer.getRawCosmetic() : void 0,
      style: (optionalParts & 4) === 4 ? buffer.getASCII() : void 0,
      parentDomains: (optionalParts & 8) === 8 ? Domains.deserialize(buffer) : void 0
    });
  }
  constructor({ mask, selector, domains, rawLine, style, parentDomains }) {
    this.mask = mask;
    this.selector = selector;
    this.domains = domains;
    this.parentDomains = parentDomains;
    this.style = style;
    this.id = void 0;
    this.rawLine = rawLine;
    this.scriptletDetails = void 0;
  }
  isCosmeticFilter() {
    return true;
  }
  isNetworkFilter() {
    return false;
  }
  /**
   * The format of a cosmetic filter is:
   *
   * | mask | selector length | selector... | hostnames length | hostnames...
   *   32     16                              16
   *
   * The header (mask) is 32 bits, then we have a total of 32 bits to store the
   * length of `selector` and `hostnames` (16 bits each).
   *
   * Improvements similar to the onces mentioned in `serializeNetworkFilters`
   * could be applied here, to get a more compact representation.
   */
  serialize(buffer) {
    buffer.pushUint16(this.mask);
    const index = buffer.getPos();
    buffer.pushUint8(0);
    if (this.isUnicode()) {
      buffer.pushUTF8(this.selector);
    } else {
      buffer.pushCosmeticSelector(this.selector);
    }
    let optionalParts = 0;
    if (this.domains !== void 0) {
      optionalParts |= 1;
      this.domains.serialize(buffer);
    }
    if (this.rawLine !== void 0) {
      optionalParts |= 2;
      buffer.pushRawCosmetic(this.rawLine);
    }
    if (this.style !== void 0) {
      optionalParts |= 4;
      buffer.pushASCII(this.style);
    }
    if (this.parentDomains !== void 0) {
      optionalParts |= 8;
      this.parentDomains.serialize(buffer);
    }
    buffer.setByte(index, optionalParts);
  }
  /**
   * Return an estimation of the size (in bytes) needed to persist this filter
   * in a DataView. This does not need to be 100% accurate but should be an
   * upper-bound. It should also be as fast as possible.
   */
  getSerializedSize(compression) {
    let estimate = 2 + 1;
    if (this.isUnicode()) {
      estimate += sizeOfUTF8(this.selector);
    } else {
      estimate += sizeOfCosmeticSelector(this.selector, compression);
    }
    if (this.domains !== void 0) {
      estimate += this.domains.getSerializedSize();
    }
    if (this.parentDomains !== void 0) {
      estimate += this.parentDomains.getSerializedSize();
    }
    if (this.rawLine !== void 0) {
      estimate += sizeOfRawCosmetic(this.rawLine, compression);
    }
    if (this.style !== void 0) {
      estimate += sizeOfASCII(this.style);
    }
    return estimate;
  }
  /**
   * Create a more human-readable version of this filter. It is mainly used for
   * debugging purpose, as it will expand the values stored in the bit mask.
   */
  toString() {
    if (this.rawLine !== void 0) {
      return this.rawLine;
    }
    let filter = "";
    if (this.domains !== void 0) {
      if (this.domains.parts !== void 0) {
        filter += this.domains.parts;
      } else {
        filter += "<hostnames>";
      }
    }
    if (this.parentDomains !== void 0) {
      if (this.domains !== void 0) {
        filter += ",";
      }
      if (this.parentDomains.parts !== void 0) {
        filter += this.parentDomains.parts.split(",").map((part) => part + ">>").join(",");
      } else {
        filter += "<hostnames>>>";
      }
    }
    if (this.isUnhide()) {
      filter += "#@#";
    } else {
      filter += "##";
    }
    if (this.isScriptInject()) {
      filter += "+js(";
      filter += this.selector;
      filter += ")";
    } else {
      filter += this.selector;
    }
    if (this.hasCustomStyle()) {
      filter += ":style(" + this.getStyle() + ")";
    }
    return filter;
  }
  match(hostname, domain, ancestors) {
    if (this.hasHostnameConstraint() === false) {
      return true;
    }
    if (!hostname) {
      return false;
    }
    if (this.domains !== void 0 && // TODO - this hashing could be re-used between cosmetics by using an
    // abstraction like `Request` (similar to network filters matching).
    // Maybe could we reuse `Request` directly without any change?
    this.domains.match(getHostnameHashesFromLabelsBackward(hostname, domain), getEntityHashesFromLabelsBackward(hostname, domain))) {
      return true;
    }
    if (ancestors !== void 0 && this.parentDomains !== void 0) {
      for (const { hostname: hostname2, domain: domain2 } of ancestors) {
        if (this.parentDomains.match(hostname2.length === 0 ? EMPTY_UINT32_ARRAY : getHostnameHashesFromLabelsBackward(hostname2, domain2), hostname2.length === 0 ? EMPTY_UINT32_ARRAY : getEntityHashesFromLabelsBackward(hostname2, domain2))) {
          return true;
        }
      }
    }
    return false;
  }
  /**
   * Get tokens for this filter. It can be indexed multiple times if multiple
   * hostnames are specified (e.g.: host1,host2##.selector).
   */
  getTokens() {
    const tokens = [];
    if (this.domains !== void 0) {
      const { hostnames, entities } = this.domains;
      if (hostnames !== void 0) {
        for (const hostname of hostnames) {
          tokens.push(new Uint32Array([hostname]));
        }
      }
      if (entities !== void 0) {
        for (const entity of entities) {
          tokens.push(new Uint32Array([entity]));
        }
      }
    }
    if (this.parentDomains !== void 0) {
      const { hostnames, entities } = this.parentDomains;
      if (hostnames !== void 0) {
        for (const hostname of hostnames) {
          tokens.push(new Uint32Array([hostname]));
        }
      }
      if (entities !== void 0) {
        for (const entity of entities) {
          tokens.push(new Uint32Array([entity]));
        }
      }
    }
    if (tokens.length === 0 && this.isUnhide() === false) {
      if (this.isIdSelector() || this.isClassSelector()) {
        let endOfSelector = 1;
        const selector = this.selector;
        for (; endOfSelector < selector.length; endOfSelector += 1) {
          const code = selector.charCodeAt(endOfSelector);
          if (code === 32 || code === 46 || code === 58 || code === 91) {
            break;
          }
        }
        const arr = new Uint32Array(1);
        arr[0] = fastHashBetween(selector, 1, endOfSelector);
        tokens.push(arr);
      } else if (this.isHrefSelector() === true) {
        const selector = this.getSelector();
        let hrefIndex = selector.indexOf("href");
        if (hrefIndex === -1) {
          return EMPTY_TOKENS;
        }
        hrefIndex += 4;
        let skipFirstToken = false;
        let skipLastToken = true;
        if (selector.charCodeAt(hrefIndex) === 42) {
          skipFirstToken = true;
          hrefIndex += 1;
        } else if (selector.charCodeAt(hrefIndex) === 94) {
          hrefIndex += 1;
        } else {
          skipLastToken = false;
        }
        hrefIndex += 2;
        const hrefEnd = selector.indexOf('"', hrefIndex);
        if (hrefEnd === -1) {
          return EMPTY_TOKENS;
        }
        tokens.push(tokenize2(this.selector.slice(hrefIndex, hrefEnd), skipFirstToken, skipLastToken));
      }
    }
    if (tokens.length === 0) {
      return EMPTY_TOKENS;
    }
    return tokens;
  }
  parseScript() {
    if (this.scriptletDetails !== void 0) {
      return this.scriptletDetails;
    }
    const selector = this.getSelector();
    if (selector.length === 0) {
      return void 0;
    }
    const parts = [];
    let index = 0;
    let lastComaIndex = -1;
    let inDoubleQuotes = false;
    let inSingleQuotes = false;
    let inBackticks = false;
    let inRegexp = false;
    let objectNesting = 0;
    let lastCharIsBackslash = false;
    let inArgument = false;
    for (; index < selector.length; index += 1) {
      const char = selector[index];
      if (lastCharIsBackslash === false) {
        if (inDoubleQuotes === true) {
          if (char === '"') {
            inDoubleQuotes = false;
          }
        } else if (inSingleQuotes === true) {
          if (char === "'") {
            inSingleQuotes = false;
          }
        } else if (inBackticks === true) {
          if (char === "`") {
            inBackticks = false;
          }
        } else if (objectNesting !== 0) {
          if (char === "{") {
            objectNesting += 1;
          } else if (char === "}") {
            objectNesting -= 1;
          } else if (char === '"') {
            inDoubleQuotes = true;
          } else if (char === "'") {
            inSingleQuotes = true;
          } else if (char === "`") {
            inBackticks = true;
          }
        } else if (inRegexp === true) {
          if (char === "/") {
            inRegexp = false;
          }
        } else {
          if (inArgument === false) {
            if (char === " ") {
            } else if (char === '"' && selector.indexOf('"', index + 1) > 0) {
              inDoubleQuotes = true;
            } else if (char === "'" && selector.indexOf("'", index + 1) > 0) {
              inSingleQuotes = true;
            } else if (char === "`" && selector.indexOf("`", index + 1) > 0) {
              inBackticks = true;
            } else if (char === "{" && selector.indexOf("}", index + 1) > 0) {
              objectNesting += 1;
            } else if (char === "/" && selector.indexOf("/", index + 1) > 0) {
              inRegexp = true;
            } else {
              inArgument = true;
            }
          }
        }
      }
      if (lastCharIsBackslash === false && char === "," && inDoubleQuotes === false && inSingleQuotes === false && inBackticks === false && inRegexp === false) {
        parts.push(selector.slice(lastComaIndex + 1, index).trim());
        lastComaIndex = index;
        inArgument = false;
      }
      lastCharIsBackslash = char === "\\" && !lastCharIsBackslash;
    }
    parts.push(selector.slice(lastComaIndex + 1).trim());
    const args = parts.slice(1).map((part) => {
      const openingCode = part.charCodeAt(0);
      if (!(openingCode === 39 && part.endsWith(`'`)) && !(openingCode === 34 && part.endsWith(`"`)) && !(openingCode === 96 && part.endsWith("`"))) {
        return part;
      }
      if (part.charCodeAt(part.length - 2) === 92) {
        return part;
      }
      if (part.length > 2) {
        for (let i = 1; i < part.length - 1; i++) {
          if (part.charCodeAt(i) === openingCode && part.charCodeAt(i - 1) !== 92) {
            return part;
          }
        }
      }
      const escaped = part.substring(1, part.length - 1);
      if (openingCode === 39) {
        return escaped.replace(REGEXP_ESCAPED_SINGLE_QUOTE, "'");
      } else if (openingCode === 34) {
        return escaped.replace(REGEXP_ESCAPED_DOUBLE_QUOTE, '"');
      }
      return escaped.replace(REGEXP_ESCAPED_BACKTICK, "`");
    }).map((part) => {
      const isObjectLiteral = part.startsWith("{");
      let result = part.replace(REGEXP_UNICODE_COMMA, ",").replace(REGEXP_UNICODE_BACKSLASH, "\\");
      if (!isObjectLiteral) {
        result = result.replace(REGEXP_ESCAPED_COMMA, ",");
      }
      return result;
    });
    this.scriptletDetails = { name: parts[0], args };
    return this.scriptletDetails;
  }
  getScript(getScriptlet) {
    const parsed = this.parseScript();
    if (parsed === void 0) {
      return void 0;
    }
    const { name, args } = parsed;
    let script = getScriptlet(name);
    if (script !== void 0) {
      for (let i = 0; i < args.length; i += 1) {
        const arg = args[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        script = script.replace(`{{${i + 1}}}`, arg);
      }
      return script;
    }
    return void 0;
  }
  hasHostnameConstraint() {
    return this.domains !== void 0 || this.parentDomains !== void 0;
  }
  // `hasSubframeConstraint` is only `true` when the filter is scriptlet.
  // Other cosmetic filters with subframe constraint will be rejected in the parse time.
  hasSubframeConstraint() {
    return this.parentDomains !== void 0;
  }
  getId() {
    if (this.id === void 0) {
      this.id = computeFilterId(this.mask, this.selector, this.domains, this.parentDomains, this.style);
    }
    return this.id;
  }
  hasCustomStyle() {
    return this.style !== void 0;
  }
  getStyle(defaultStyle = DEFAULT_HIDING_STYLE) {
    return this.style || defaultStyle;
  }
  getStyleAttributeHash() {
    return `s${fastHash(this.getStyle())}`;
  }
  getSelector() {
    return this.selector;
  }
  getSelectorAST() {
    return parse2(this.getSelector());
  }
  getASTComponents() {
    const ast = this.getSelectorAST();
    if (ast === void 0) {
      return void 0;
    }
    return destructAST(ast);
  }
  getExtendedSelector() {
    return extractHTMLSelectorFromRule(this.selector);
  }
  isExtended() {
    return getBit(this.mask, COSMETICS_MASK.extended);
  }
  /**
   * @deprecated `...:remove` is migrated to extended selectors' implementation. Use `getASTComponents` instead to get the "directive" specifically.
   */
  isRemove() {
    const asts = this.getASTComponents();
    if (asts === void 0 || asts.directive === null) {
      return false;
    }
    return asts.directive.name === "remove";
  }
  isUnhide() {
    return getBit(this.mask, COSMETICS_MASK.unhide);
  }
  isScriptInject() {
    return getBit(this.mask, COSMETICS_MASK.scriptInject);
  }
  isCSS() {
    return this.isScriptInject() === false;
  }
  isIdSelector() {
    return getBit(this.mask, COSMETICS_MASK.isIdSelector);
  }
  isClassSelector() {
    return getBit(this.mask, COSMETICS_MASK.isClassSelector);
  }
  isHrefSelector() {
    return getBit(this.mask, COSMETICS_MASK.isHrefSelector);
  }
  isUnicode() {
    return getBit(this.mask, COSMETICS_MASK.isUnicode);
  }
  isHtmlFiltering() {
    return this.getSelector().startsWith("^");
  }
  // A generic hide cosmetic filter is one that:
  //
  // * Do not have a domain specified. "Hide this element on all domains"
  // * Have only domain exceptions specified. "Hide this element on all domains except example.com"
  //
  // For example: ~example.com##.ad  is a generic filter as well!
  isGenericHide() {
    return this?.domains?.hostnames === void 0 && this?.domains?.entities === void 0 && this?.parentDomains?.hostnames === void 0 && this?.parentDomains?.entities === void 0;
  }
};

// node_modules/@ghostery/adblocker/dist/esm/filters/dsl.js
var NetworkBuilder = class {
  constructor() {
    this.options = /* @__PURE__ */ new Set();
    this.prefix = void 0;
    this.infix = void 0;
    this.suffix = void 0;
    this.redirect = void 0;
  }
  blockRequestsWithType(t) {
    if (this.options.has(t)) {
      throw new Error(`Already blocking type ${t}`);
    }
    this.options.add(t);
    return this;
  }
  images() {
    return this.blockRequestsWithType("image");
  }
  scripts() {
    return this.blockRequestsWithType("script");
  }
  frames() {
    return this.blockRequestsWithType("frame");
  }
  fonts() {
    return this.blockRequestsWithType("font");
  }
  medias() {
    return this.blockRequestsWithType("media");
  }
  styles() {
    return this.blockRequestsWithType("css");
  }
  redirectTo(redirect) {
    if (this.redirect !== void 0) {
      throw new Error(`Already redirecting: ${this.redirect}`);
    }
    this.redirect = `redirect=${redirect}`;
    return this;
  }
  urlContains(infix) {
    if (this.infix !== void 0) {
      throw new Error(`Already matching pattern: ${this.infix}`);
    }
    this.infix = infix;
    return this;
  }
  urlStartsWith(prefix) {
    if (this.prefix !== void 0) {
      throw new Error(`Already matching prefix: ${this.prefix}`);
    }
    this.prefix = `|${prefix}`;
    return this;
  }
  urlEndsWith(suffix) {
    if (this.suffix !== void 0) {
      throw new Error(`Already matching suffix: ${this.suffix}`);
    }
    this.suffix = `${suffix}|`;
    return this;
  }
  withHostname(hostname) {
    if (this.prefix !== void 0) {
      throw new Error(`Cannot match hostname if filter already has prefix: ${this.prefix}`);
    }
    this.prefix = `||${hostname}^`;
    return this;
  }
  toString() {
    const parts = [];
    if (this.prefix !== void 0) {
      parts.push(this.prefix);
    }
    if (this.infix !== void 0) {
      parts.push(this.infix);
    }
    if (this.suffix !== void 0) {
      parts.push(this.suffix);
    }
    const options = ["important"];
    if (this.options.size !== 0) {
      for (const option of this.options) {
        options.push(option);
      }
    }
    if (this.redirect !== void 0) {
      options.push(this.redirect);
    }
    return `${parts.length === 0 ? "*" : parts.join("*")}$${options.join(",")}`;
  }
};
function block() {
  return new NetworkBuilder();
}

// node_modules/@ghostery/adblocker/dist/esm/filters/network.js
var HTTP_HASH = fastHash("http");
var HTTPS_HASH = fastHash("https");
function isAllowedHostname(ch) {
  return isDigit(ch) || isAlpha(ch) || ch === 95 || ch === 45 || ch === 46;
}
var NETWORK_FILTER_MASK;
(function(NETWORK_FILTER_MASK2) {
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromDocument"] = 1] = "fromDocument";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromFont"] = 2] = "fromFont";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromHttp"] = 4] = "fromHttp";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromHttps"] = 8] = "fromHttps";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromImage"] = 16] = "fromImage";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromMedia"] = 32] = "fromMedia";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromObject"] = 64] = "fromObject";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromOther"] = 128] = "fromOther";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromPing"] = 256] = "fromPing";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromScript"] = 512] = "fromScript";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromStylesheet"] = 1024] = "fromStylesheet";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromSubdocument"] = 2048] = "fromSubdocument";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromWebsocket"] = 4096] = "fromWebsocket";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["fromXmlHttpRequest"] = 8192] = "fromXmlHttpRequest";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["firstParty"] = 16384] = "firstParty";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["thirdParty"] = 32768] = "thirdParty";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isReplace"] = 65536] = "isReplace";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isBadFilter"] = 131072] = "isBadFilter";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isCSP"] = 262144] = "isCSP";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isGenericHide"] = 524288] = "isGenericHide";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isImportant"] = 1048576] = "isImportant";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isSpecificHide"] = 2097152] = "isSpecificHide";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isFullRegex"] = 4194304] = "isFullRegex";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isRegex"] = 8388608] = "isRegex";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isUnicode"] = 16777216] = "isUnicode";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isLeftAnchor"] = 33554432] = "isLeftAnchor";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isRightAnchor"] = 67108864] = "isRightAnchor";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isException"] = 134217728] = "isException";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isHostnameAnchor"] = 268435456] = "isHostnameAnchor";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isRedirectRule"] = 536870912] = "isRedirectRule";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isRedirect"] = 1073741824] = "isRedirect";
  NETWORK_FILTER_MASK2[NETWORK_FILTER_MASK2["isRemoveParam"] = -2147483648] = "isRemoveParam";
})(NETWORK_FILTER_MASK || (NETWORK_FILTER_MASK = {}));
var NETWORK_FILTER_OPTIONAL_PARTS_MASK;
(function(NETWORK_FILTER_OPTIONAL_PARTS_MASK2) {
  NETWORK_FILTER_OPTIONAL_PARTS_MASK2[NETWORK_FILTER_OPTIONAL_PARTS_MASK2["hasFilter"] = 1] = "hasFilter";
  NETWORK_FILTER_OPTIONAL_PARTS_MASK2[NETWORK_FILTER_OPTIONAL_PARTS_MASK2["hasHostname"] = 2] = "hasHostname";
  NETWORK_FILTER_OPTIONAL_PARTS_MASK2[NETWORK_FILTER_OPTIONAL_PARTS_MASK2["hasDomains"] = 4] = "hasDomains";
  NETWORK_FILTER_OPTIONAL_PARTS_MASK2[NETWORK_FILTER_OPTIONAL_PARTS_MASK2["hasRawLine"] = 8] = "hasRawLine";
  NETWORK_FILTER_OPTIONAL_PARTS_MASK2[NETWORK_FILTER_OPTIONAL_PARTS_MASK2["hasDenyallow"] = 16] = "hasDenyallow";
  NETWORK_FILTER_OPTIONAL_PARTS_MASK2[NETWORK_FILTER_OPTIONAL_PARTS_MASK2["hasOptionValue"] = 32] = "hasOptionValue";
  NETWORK_FILTER_OPTIONAL_PARTS_MASK2[NETWORK_FILTER_OPTIONAL_PARTS_MASK2["isCaseSensitive"] = 64] = "isCaseSensitive";
})(NETWORK_FILTER_OPTIONAL_PARTS_MASK || (NETWORK_FILTER_OPTIONAL_PARTS_MASK = {}));
var FROM_ANY = NETWORK_FILTER_MASK.fromDocument | NETWORK_FILTER_MASK.fromFont | NETWORK_FILTER_MASK.fromImage | NETWORK_FILTER_MASK.fromMedia | NETWORK_FILTER_MASK.fromObject | NETWORK_FILTER_MASK.fromOther | NETWORK_FILTER_MASK.fromPing | NETWORK_FILTER_MASK.fromScript | NETWORK_FILTER_MASK.fromStylesheet | NETWORK_FILTER_MASK.fromSubdocument | NETWORK_FILTER_MASK.fromWebsocket | NETWORK_FILTER_MASK.fromXmlHttpRequest;
var REQUEST_TYPE_TO_MASK = {
  beacon: NETWORK_FILTER_MASK.fromPing,
  // fromOther?
  document: NETWORK_FILTER_MASK.fromDocument,
  cspviolationreport: NETWORK_FILTER_MASK.fromOther,
  // https://developer.mozilla.org/en-US/docs/Web/API/FedCM_API/IDP_integration#provide_a_config_file_and_endpoints
  // FedCM configuration file is resolved as a JSON module, which is interpreted as a "script".
  // Some of FedCM related requests are resolved as "xhr/fetch" but we use "script" to add weight to the meaning of "standardised" module behavior in browser-side.
  fedcm: NETWORK_FILTER_MASK.fromScript,
  fetch: NETWORK_FILTER_MASK.fromXmlHttpRequest,
  font: NETWORK_FILTER_MASK.fromFont,
  image: NETWORK_FILTER_MASK.fromImage,
  imageset: NETWORK_FILTER_MASK.fromImage,
  // https://searchfox.org/mozilla-central/rev/fcfb558f8946f3648d962576125af46bf6e2910a/toolkit/components/extensions/schemas/web_request.json
  // This is for JSON modules from import statements.
  // Our `NETWORK_FILTER_MASK` is already full and we can treat this as a script request.
  json: NETWORK_FILTER_MASK.fromScript,
  mainFrame: NETWORK_FILTER_MASK.fromDocument,
  main_frame: NETWORK_FILTER_MASK.fromDocument,
  media: NETWORK_FILTER_MASK.fromMedia,
  object: NETWORK_FILTER_MASK.fromObject,
  object_subrequest: NETWORK_FILTER_MASK.fromObject,
  ping: NETWORK_FILTER_MASK.fromPing,
  // fromOther?
  script: NETWORK_FILTER_MASK.fromScript,
  stylesheet: NETWORK_FILTER_MASK.fromStylesheet,
  subFrame: NETWORK_FILTER_MASK.fromSubdocument,
  sub_frame: NETWORK_FILTER_MASK.fromSubdocument,
  webSocket: NETWORK_FILTER_MASK.fromWebsocket,
  websocket: NETWORK_FILTER_MASK.fromWebsocket,
  xhr: NETWORK_FILTER_MASK.fromXmlHttpRequest,
  xmlhttprequest: NETWORK_FILTER_MASK.fromXmlHttpRequest,
  // Other
  cspReport: NETWORK_FILTER_MASK.fromOther,
  csp_report: NETWORK_FILTER_MASK.fromOther,
  eventsource: NETWORK_FILTER_MASK.fromOther,
  manifest: NETWORK_FILTER_MASK.fromOther,
  other: NETWORK_FILTER_MASK.fromOther,
  prefetch: NETWORK_FILTER_MASK.fromOther,
  preflight: NETWORK_FILTER_MASK.fromOther,
  signedexchange: NETWORK_FILTER_MASK.fromOther,
  speculative: NETWORK_FILTER_MASK.fromOther,
  texttrack: NETWORK_FILTER_MASK.fromOther,
  web_manifest: NETWORK_FILTER_MASK.fromOther,
  xml_dtd: NETWORK_FILTER_MASK.fromOther,
  xslt: NETWORK_FILTER_MASK.fromOther
};
function getListOfRequestTypesNegated(filter) {
  const types = [];
  if (filter.fromDocument() === false) {
    types.push("document");
  }
  if (filter.fromImage() === false) {
    types.push("image");
  }
  if (filter.fromMedia() === false) {
    types.push("media");
  }
  if (filter.fromObject() === false) {
    types.push("object");
  }
  if (filter.fromOther() === false) {
    types.push("other");
  }
  if (filter.fromPing() === false) {
    types.push("ping");
  }
  if (filter.fromScript() === false) {
    types.push("script");
  }
  if (filter.fromStylesheet() === false) {
    types.push("stylesheet");
  }
  if (filter.fromSubdocument() === false) {
    types.push("sub_frame");
  }
  if (filter.fromWebsocket() === false) {
    types.push("websocket");
  }
  if (filter.fromXmlHttpRequest() === false) {
    types.push("xhr");
  }
  if (filter.fromFont() === false) {
    types.push("font");
  }
  return types;
}
function getListOfRequestTypes(filter) {
  const types = [];
  if (filter.fromDocument()) {
    types.push("document");
  }
  if (filter.fromImage()) {
    types.push("image");
  }
  if (filter.fromMedia()) {
    types.push("media");
  }
  if (filter.fromObject()) {
    types.push("object");
  }
  if (filter.fromOther()) {
    types.push("other");
  }
  if (filter.fromPing()) {
    types.push("ping");
  }
  if (filter.fromScript()) {
    types.push("script");
  }
  if (filter.fromStylesheet()) {
    types.push("stylesheet");
  }
  if (filter.fromSubdocument()) {
    types.push("sub_frame");
  }
  if (filter.fromWebsocket()) {
    types.push("websocket");
  }
  if (filter.fromXmlHttpRequest()) {
    types.push("xhr");
  }
  if (filter.fromFont()) {
    types.push("font");
  }
  return types;
}
function computeFilterId2(mask, filter, hostname, domains, denyallow, optionValue, isCaseSensitive) {
  let hash = HASH_SEED * HASH_INTERNAL_MULT ^ mask;
  if (domains !== void 0) {
    hash = domains.updateId(hash);
  }
  if (denyallow !== void 0) {
    hash = denyallow.updateId(hash);
  }
  if (filter !== void 0) {
    for (let i = 0; i < filter.length; i += 1) {
      hash = hash * HASH_INTERNAL_MULT ^ filter.charCodeAt(i);
    }
  }
  if (hostname !== void 0) {
    for (let i = 0; i < hostname.length; i += 1) {
      hash = hash * HASH_INTERNAL_MULT ^ hostname.charCodeAt(i);
    }
  }
  if (optionValue !== void 0) {
    for (let i = 0; i < optionValue.length; i += 1) {
      hash = hash * HASH_INTERNAL_MULT ^ optionValue.charCodeAt(i);
    }
  }
  if (isCaseSensitive !== void 0) {
    hash = hash * HASH_INTERNAL_MULT ^ 1 << +isCaseSensitive;
  }
  return hash >>> 0;
}
function compileRegex(filter, isLeftAnchor, isRightAnchor, isFullRegex, isCaseSensitive) {
  if (isFullRegex === true) {
    return new RegExp(filter.slice(1, filter.length - 1), isCaseSensitive ? "" : "i");
  }
  filter = filter.replace(/([|.$+?{}()[\]\\])/g, "\\$1");
  filter = filter.replace(/\*/g, ".*");
  filter = filter.replace(/\^/g, "(?:[^\\w\\d_.%-]|$)");
  if (isRightAnchor) {
    filter = `${filter}$`;
  }
  if (isLeftAnchor) {
    filter = `^${filter}`;
  }
  return new RegExp(filter, isCaseSensitive ? "" : "i");
}
function getFilterOptionName(line, pos, end) {
  const start = pos;
  for (; pos < end; pos++) {
    const code = line.charCodeAt(pos);
    if (code === 61 || code === 44) {
      end = pos;
      break;
    }
  }
  return [pos, line.slice(start, end)];
}
function getFilterOptionValue(line, pos, end) {
  let start = pos;
  let value = "";
  for (; pos < end; pos++) {
    const code = line.charCodeAt(pos);
    if (code === 92) {
      value += line.slice(start, pos);
      start = ++pos;
    } else if (code === 44) {
      break;
    }
  }
  if (start - pos !== 0) {
    value += line.slice(start, pos);
  }
  return [pos, value];
}
var REGEXP_CHARACTER_ESCAPES = /* @__PURE__ */ new Set([
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Character_escape
  102,
  // f
  110,
  // n
  114,
  // r
  116,
  // t
  118,
  // v
  48,
  // 0
  94,
  // ^
  36,
  // $
  92,
  // \
  46,
  // .
  42,
  // *
  43,
  // +
  63,
  // ?
  40,
  // (
  41,
  // )
  91,
  // [
  93,
  // ]
  123,
  // {
  125,
  // }
  124,
  // |
  47,
  // /
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Character_class_escape
  100,
  // d
  68,
  // D
  119,
  // s
  87,
  // S
  115,
  // w
  83,
  // W
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Word_boundary_assertion
  98,
  // b
  66
  // B
]);
function isHexLiteral(code) {
  return code >= 48 && code <= 57 || // 0-9
  code <= 65 && code <= 70 || // A-F
  code >= 97 && code <= 102;
}
function isCharacterEscapeInRegExp(line, pos, _end) {
  const code = line.charCodeAt(pos + 1);
  if (code === 44 || REGEXP_CHARACTER_ESCAPES.has(code)) {
    return [pos + 1, true];
  }
  if (code === 99) {
    const next = line.charCodeAt(pos + 2);
    if (next >= 65 && next <= 90 || next >= 97 && next <= 122) {
      return [pos + 2, true];
    }
  }
  if (code === 120 && isHexLiteral(line.charCodeAt(pos + 2)) && isHexLiteral(line.charCodeAt(pos + 3))) {
    return [pos + 3, true];
  }
  if (code === 117) {
    if (line.charCodeAt(pos + 2) === 123) {
      const close = line.indexOf("}", pos + 3);
      const hexLiteralLength = close - pos + 3;
      if (hexLiteralLength >= 1 && hexLiteralLength <= 6) {
        return [close, true];
      }
    } else if (
      // \uHHHH
      isHexLiteral(line.charCodeAt(pos + 2)) && isHexLiteral(line.charCodeAt(pos + 3)) && isHexLiteral(line.charCodeAt(pos + 4)) && isHexLiteral(line.charCodeAt(pos + 5))
    ) {
      return [pos + 5, true];
    }
  }
  return [pos + 1, false];
}
function isCharacterEscapeInReplace(line, pos, end) {
  const code = line.charCodeAt(pos + 1);
  if (code === 44 || code === 47) {
    return [pos + 1, false];
  }
  return isCharacterEscapeInRegExp(line, pos, end);
}
function getFilterReplaceOptionValue(line, pos, end) {
  if (line.charCodeAt(pos++) !== 47) {
    return [end, void 0];
  }
  const parts = ["", "", ""];
  let start = pos;
  let slashes = 0;
  for (; pos < end; pos++) {
    const code = line.charCodeAt(pos);
    if (code === 92) {
      parts[slashes] += line.slice(start, pos);
      const [posAfterCharacterEscape, isCharacterEscape] = isCharacterEscapeInReplace(line, pos, end);
      if (isCharacterEscape === false) {
        ++pos;
      }
      start = pos;
      pos = posAfterCharacterEscape;
    } else if (code === 47) {
      if (pos - start !== 0) {
        parts[slashes] += line.slice(start, pos);
      }
      start = pos + 1;
      if (++slashes === 2) {
        break;
      }
    }
  }
  const valueEnd = line.indexOf(",", pos);
  if (valueEnd !== -1) {
    end = valueEnd;
  }
  parts[2] = line.slice(start, end);
  pos = end;
  return [pos, parts];
}
function getFilterOptions(line, pos, end) {
  const options = [];
  let name;
  let value;
  for (; pos < end; pos++) {
    [pos, name] = getFilterOptionName(line, pos, end);
    if (name !== void 0) {
      if (line.charCodeAt(pos) === 61) {
        pos++;
      }
      if (name === "replace") {
        const result = getFilterReplaceOptionValue(line, pos, end);
        if (result[1] === void 0) {
          value = "";
        } else {
          value = line.slice(pos, result[0]);
        }
        pos = result[0];
      } else {
        [pos, value] = getFilterOptionValue(line, pos, end);
      }
      options.push([name, value]);
    }
  }
  return options;
}
function replaceOptionValueToRegexp(value) {
  const [, values] = getFilterReplaceOptionValue(value, 0, value.length);
  if (values === void 0) {
    return null;
  }
  try {
    return [new RegExp(values[0], values[2]), values[1]];
  } catch (error2) {
    return null;
  }
}
var MATCH_ALL = new RegExp("");
var NetworkFilter = class _NetworkFilter {
  static parse(line, debug = false) {
    let mask = NETWORK_FILTER_MASK.thirdParty | NETWORK_FILTER_MASK.firstParty | NETWORK_FILTER_MASK.fromHttps | NETWORK_FILTER_MASK.fromHttp;
    let cptMaskPositive = 0;
    let cptMaskNegative = FROM_ANY;
    let hostname;
    let domains;
    let denyallow;
    let optionValue;
    let isCaseSensitive = false;
    let filterIndexStart = 0;
    let filterIndexEnd = line.length;
    if (line.charCodeAt(0) === 64 && line.charCodeAt(1) === 64) {
      filterIndexStart += 2;
      mask = setBit(mask, NETWORK_FILTER_MASK.isException);
    }
    const optionsIndex = findLastIndexOfUnescapedCharacter(line, "$");
    if (optionsIndex !== -1 && line.charCodeAt(optionsIndex + 1) !== 47) {
      filterIndexEnd = optionsIndex;
      let domainsList;
      let denyallowList;
      for (const rawOption of getFilterOptions(line, optionsIndex + 1, line.length)) {
        const negation = rawOption[0].charCodeAt(0) === 126;
        const option = negation === true ? rawOption[0].slice(1) : rawOption[0];
        const value = rawOption[1];
        switch (option) {
          case "to": {
            domainsList ?? (domainsList = /* @__PURE__ */ new Set());
            denyallowList ?? (denyallowList = /* @__PURE__ */ new Set());
            for (const hostname2 of value.split("|")) {
              if (hostname2.startsWith("~")) {
                denyallowList.add(hostname2.slice(1));
              } else {
                domainsList.add(hostname2);
              }
            }
            break;
          }
          case "denyallow": {
            denyallowList ?? (denyallowList = /* @__PURE__ */ new Set());
            for (const domain of value.split("|")) {
              denyallowList.add(domain);
            }
            break;
          }
          case "domain":
          case "from": {
            domainsList ?? (domainsList = /* @__PURE__ */ new Set());
            for (const domain of value.split("|")) {
              domainsList.add(domain);
            }
            break;
          }
          case "badfilter":
            mask = setBit(mask, NETWORK_FILTER_MASK.isBadFilter);
            break;
          case "important":
            if (negation) {
              return null;
            }
            mask = setBit(mask, NETWORK_FILTER_MASK.isImportant);
            break;
          case "match-case":
            if (negation) {
              return null;
            }
            isCaseSensitive = true;
            break;
          case "3p":
          case "third-party":
            if (negation) {
              mask = clearBit(mask, NETWORK_FILTER_MASK.thirdParty);
            } else {
              mask = clearBit(mask, NETWORK_FILTER_MASK.firstParty);
            }
            break;
          case "1p":
          case "first-party":
            if (negation) {
              mask = clearBit(mask, NETWORK_FILTER_MASK.firstParty);
            } else {
              mask = clearBit(mask, NETWORK_FILTER_MASK.thirdParty);
            }
            break;
          case "redirect-rule":
          case "redirect": {
            if (negation) {
              return null;
            }
            if (value.length === 0) {
              return null;
            }
            const priorityIndex = value.lastIndexOf(":");
            if (priorityIndex === 0) {
              return null;
            } else if (priorityIndex !== -1 && (isNaN(Number(value.slice(priorityIndex + 1))) === true || priorityIndex + 1 === value.length)) {
              return null;
            }
            mask = setBit(mask, NETWORK_FILTER_MASK.isRedirect);
            if (option === "redirect-rule") {
              mask = setBit(mask, NETWORK_FILTER_MASK.isRedirectRule);
            }
            if (optionValue !== void 0) {
              return null;
            }
            optionValue = value;
            break;
          }
          case "csp":
            if (negation) {
              return null;
            }
            mask = setBit(mask, NETWORK_FILTER_MASK.isCSP);
            if (value.length > 0) {
              if (optionValue !== void 0) {
                return null;
              }
              optionValue = value;
            }
            break;
          case "ehide":
          case "elemhide":
            if (negation) {
              return null;
            }
            mask = setBit(mask, NETWORK_FILTER_MASK.isGenericHide);
            mask = setBit(mask, NETWORK_FILTER_MASK.isSpecificHide);
            break;
          case "shide":
          case "specifichide":
            if (negation) {
              return null;
            }
            mask = setBit(mask, NETWORK_FILTER_MASK.isSpecificHide);
            break;
          case "ghide":
          case "generichide":
            if (negation) {
              return null;
            }
            mask = setBit(mask, NETWORK_FILTER_MASK.isGenericHide);
            break;
          case "inline-script":
            if (negation || optionValue !== void 0) {
              return null;
            }
            mask = setBit(mask, NETWORK_FILTER_MASK.isCSP);
            optionValue = "script-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:";
            break;
          case "inline-font":
            if (negation || optionValue !== void 0) {
              return null;
            }
            mask = setBit(mask, NETWORK_FILTER_MASK.isCSP);
            optionValue = "font-src 'self' 'unsafe-eval' http: https: data: blob: mediastream: filesystem:";
            break;
          case "replace":
          case "content":
            if (negation || (value.length === 0 ? getBit(mask, NETWORK_FILTER_MASK.isException) === false : replaceOptionValueToRegexp(value) === null) || optionValue !== void 0) {
              return null;
            }
            mask = setBit(mask, NETWORK_FILTER_MASK.isReplace);
            optionValue = value;
            break;
          case "removeparam":
            if (negation || value.startsWith("/") || optionValue !== void 0) {
              return null;
            }
            mask = setBit(mask, NETWORK_FILTER_MASK.isRemoveParam);
            optionValue = value;
            break;
          default: {
            let optionMask = 0;
            switch (option) {
              case "all":
                if (negation) {
                  return null;
                }
                break;
              case "image":
                optionMask = NETWORK_FILTER_MASK.fromImage;
                break;
              case "media":
                optionMask = NETWORK_FILTER_MASK.fromMedia;
                break;
              case "object":
              case "object-subrequest":
                optionMask = NETWORK_FILTER_MASK.fromObject;
                break;
              case "other":
                optionMask = NETWORK_FILTER_MASK.fromOther;
                break;
              case "ping":
              case "beacon":
                optionMask = NETWORK_FILTER_MASK.fromPing;
                break;
              case "script":
                optionMask = NETWORK_FILTER_MASK.fromScript;
                break;
              case "css":
              case "stylesheet":
                optionMask = NETWORK_FILTER_MASK.fromStylesheet;
                break;
              case "frame":
              case "subdocument":
                optionMask = NETWORK_FILTER_MASK.fromSubdocument;
                break;
              case "xhr":
              case "xmlhttprequest":
                optionMask = NETWORK_FILTER_MASK.fromXmlHttpRequest;
                break;
              case "websocket":
                optionMask = NETWORK_FILTER_MASK.fromWebsocket;
                break;
              case "font":
                optionMask = NETWORK_FILTER_MASK.fromFont;
                break;
              case "doc":
              case "document":
                optionMask = NETWORK_FILTER_MASK.fromDocument;
                break;
              default:
                return null;
            }
            if (negation) {
              cptMaskNegative = clearBit(cptMaskNegative, optionMask);
            } else {
              cptMaskPositive = setBit(cptMaskPositive, optionMask);
            }
            break;
          }
        }
      }
      if (domainsList !== void 0 && domainsList.size !== 0) {
        domains = Domains.parse(domainsList, {
          delimiter: "|",
          debug
        });
        if (domains === void 0) {
          return null;
        }
      }
      if (denyallowList !== void 0 && denyallowList.size !== 0) {
        if (domainsList === void 0 || domainsList.size === 0) {
          return null;
        }
        denyallow = Domains.parse(denyallowList, {
          delimiter: "|",
          debug
        });
        if (denyallow === void 0) {
          return null;
        }
      }
    }
    if (cptMaskPositive === 0) {
      mask = setBit(mask, cptMaskNegative);
    } else if (cptMaskNegative === FROM_ANY) {
      mask = setBit(mask, cptMaskPositive);
    } else {
      mask = setBit(mask, cptMaskPositive & cptMaskNegative);
    }
    let filter;
    if (filterIndexEnd - filterIndexStart >= 2 && line.charCodeAt(filterIndexStart) === 47 && line.charCodeAt(filterIndexEnd - 1) === 47) {
      filter = line.slice(filterIndexStart, filterIndexEnd);
      try {
        compileRegex(filter, false, false, true, isCaseSensitive);
      } catch (ex) {
        return null;
      }
      mask = setBit(mask, NETWORK_FILTER_MASK.isFullRegex);
    } else {
      if (isCaseSensitive === true) {
        return null;
      }
      if (filterIndexEnd > 0 && line.charCodeAt(filterIndexEnd - 1) === 124) {
        mask = setBit(mask, NETWORK_FILTER_MASK.isRightAnchor);
        filterIndexEnd -= 1;
      }
      if (filterIndexStart < filterIndexEnd && line.charCodeAt(filterIndexStart) === 124) {
        if (filterIndexStart < filterIndexEnd - 1 && line.charCodeAt(filterIndexStart + 1) === 124) {
          mask = setBit(mask, NETWORK_FILTER_MASK.isHostnameAnchor);
          filterIndexStart += 2;
        } else {
          mask = setBit(mask, NETWORK_FILTER_MASK.isLeftAnchor);
          filterIndexStart += 1;
        }
      }
      if (getBit(mask, NETWORK_FILTER_MASK.isHostnameAnchor)) {
        let firstSeparator = filterIndexStart;
        while (firstSeparator < filterIndexEnd && isAllowedHostname(line.charCodeAt(firstSeparator)) === true) {
          firstSeparator += 1;
        }
        if (firstSeparator === filterIndexEnd) {
          hostname = line.slice(filterIndexStart, filterIndexEnd);
          filterIndexStart = filterIndexEnd;
        } else {
          hostname = line.slice(filterIndexStart, firstSeparator);
          filterIndexStart = firstSeparator;
          const separatorCode = line.charCodeAt(firstSeparator);
          if (separatorCode === 94) {
            if (filterIndexEnd - filterIndexStart === 1) {
              filterIndexStart = filterIndexEnd;
              mask = setBit(mask, NETWORK_FILTER_MASK.isRightAnchor);
            } else {
              mask = setBit(mask, NETWORK_FILTER_MASK.isRegex);
              mask = setBit(mask, NETWORK_FILTER_MASK.isLeftAnchor);
            }
          } else if (separatorCode === 42) {
            mask = setBit(mask, NETWORK_FILTER_MASK.isRegex);
          } else {
            mask = setBit(mask, NETWORK_FILTER_MASK.isLeftAnchor);
          }
        }
      }
      if (filterIndexEnd - filterIndexStart > 0 && line.charCodeAt(filterIndexEnd - 1) === 42) {
        filterIndexEnd -= 1;
      }
      if (getBit(mask, NETWORK_FILTER_MASK.isHostnameAnchor) === false && filterIndexEnd - filterIndexStart > 0 && line.charCodeAt(filterIndexStart) === 42) {
        mask = clearBit(mask, NETWORK_FILTER_MASK.isLeftAnchor);
        filterIndexStart += 1;
      }
      if (getBit(mask, NETWORK_FILTER_MASK.isLeftAnchor)) {
        if (filterIndexEnd - filterIndexStart === 5 && line.startsWith("ws://", filterIndexStart)) {
          mask = setBit(mask, NETWORK_FILTER_MASK.fromWebsocket);
          mask = clearBit(mask, NETWORK_FILTER_MASK.isLeftAnchor);
          mask = clearBit(mask, NETWORK_FILTER_MASK.fromHttp);
          mask = clearBit(mask, NETWORK_FILTER_MASK.fromHttps);
          filterIndexStart = filterIndexEnd;
        } else if (filterIndexEnd - filterIndexStart === 7 && line.startsWith("http://", filterIndexStart)) {
          mask = setBit(mask, NETWORK_FILTER_MASK.fromHttp);
          mask = clearBit(mask, NETWORK_FILTER_MASK.fromHttps);
          mask = clearBit(mask, NETWORK_FILTER_MASK.isLeftAnchor);
          filterIndexStart = filterIndexEnd;
        } else if (filterIndexEnd - filterIndexStart === 8 && line.startsWith("https://", filterIndexStart)) {
          mask = setBit(mask, NETWORK_FILTER_MASK.fromHttps);
          mask = clearBit(mask, NETWORK_FILTER_MASK.fromHttp);
          mask = clearBit(mask, NETWORK_FILTER_MASK.isLeftAnchor);
          filterIndexStart = filterIndexEnd;
        } else if (filterIndexEnd - filterIndexStart === 8 && line.startsWith("http*://", filterIndexStart)) {
          mask = setBit(mask, NETWORK_FILTER_MASK.fromHttps);
          mask = setBit(mask, NETWORK_FILTER_MASK.fromHttp);
          mask = clearBit(mask, NETWORK_FILTER_MASK.isLeftAnchor);
          filterIndexStart = filterIndexEnd;
        }
      }
      if (filterIndexEnd - filterIndexStart > 0) {
        filter = line.slice(filterIndexStart, filterIndexEnd);
        mask = setNetworkMask(mask, NETWORK_FILTER_MASK.isUnicode, hasUnicode(filter));
        if (getBit(mask, NETWORK_FILTER_MASK.isRegex) === false && checkIsRegex(filter, 0, filter.length)) {
          mask = setNetworkMask(mask, NETWORK_FILTER_MASK.isRegex, true);
        } else {
          filter = filter.toLowerCase();
        }
      }
      if (hostname !== void 0) {
        hostname = hostname.toLowerCase();
        if (hasUnicode(hostname)) {
          mask = setNetworkMask(mask, NETWORK_FILTER_MASK.isUnicode, true);
          hostname = toASCII(hostname);
        }
      }
    }
    return new _NetworkFilter({
      filter,
      hostname,
      mask,
      domains,
      denyallow,
      optionValue,
      rawLine: debug === true ? line : void 0,
      regex: void 0,
      isCaseSensitive
    });
  }
  /**
   * Deserialize network filters. The code accessing the buffer should be
   * symetrical to the one in `serializeNetworkFilter`.
   */
  static deserialize(buffer) {
    const mask = buffer.getUint32();
    const optionalParts = buffer.getUint8();
    const isUnicode = getBit(mask, NETWORK_FILTER_MASK.isUnicode);
    return new _NetworkFilter({
      // Mandatory field
      mask,
      // Optional parts
      filter: getBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasFilter) ? isUnicode ? buffer.getUTF8() : buffer.getNetworkFilter() : void 0,
      hostname: getBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasHostname) ? buffer.getNetworkHostname() : void 0,
      domains: getBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasDomains) ? Domains.deserialize(buffer) : void 0,
      rawLine: getBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasRawLine) ? buffer.getRawNetwork() : void 0,
      denyallow: getBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasDenyallow) ? Domains.deserialize(buffer) : void 0,
      optionValue: getBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasOptionValue) ? getBit(mask, NETWORK_FILTER_MASK.isCSP) ? buffer.getNetworkCSP() : getBit(mask, NETWORK_FILTER_MASK.isRedirect) ? buffer.getNetworkRedirect() : buffer.getUTF8() : void 0,
      regex: void 0,
      isCaseSensitive: getBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.isCaseSensitive)
    });
  }
  constructor({ filter, hostname, mask, domains, denyallow, optionValue, rawLine, regex, isCaseSensitive = false }) {
    this.filter = filter;
    this.hostname = hostname;
    this.mask = setBit(mask, 0);
    this.domains = domains;
    this.denyallow = denyallow;
    this.optionValue = optionValue;
    this.isCaseSensitive = isCaseSensitive;
    this.rawLine = rawLine;
    this.id = void 0;
    this.regex = regex;
  }
  get csp() {
    if (!this.isCSP()) {
      return void 0;
    }
    return this.optionValue;
  }
  get redirect() {
    if (!this.isRedirect()) {
      return void 0;
    }
    return this.optionValue;
  }
  get removeparam() {
    if (!this.isRemoveParam()) {
      return void 0;
    }
    return this.optionValue;
  }
  isCosmeticFilter() {
    return false;
  }
  isNetworkFilter() {
    return true;
  }
  match(request) {
    return checkOptions(this, request) && checkPattern(this, request);
  }
  /**
   * To allow for a more compact representation of network filters, the
   * representation is composed of a mandatory header, and some optional
   *
   * Header:
   * =======
   *
   *  | opt | mask
   *     8     32
   *
   * For an empty filter having no pattern, hostname, the minimum size is: 42 bits.
   *
   * Then for each optional part (filter, hostname optDomains, optNotDomains,
   * redirect), it takes 16 bits for the length of the string + the length of the
   * string in bytes.
   *
   * The optional parts are written in order of there number of occurrence in the
   * filter list used by the adblocker. The most common being `hostname`, then
   * `filter`, `optDomains`, `optNotDomains`, `redirect`.
   *
   * Example:
   * ========
   *
   * @@||cliqz.com would result in a serialized version:
   *
   * | 1 | mask | 9 | c | l | i | q | z | . | c | o | m  (16 bytes)
   *
   * In this case, the serialized version is actually bigger than the original
   * filter, but faster to deserialize. In the future, we could optimize the
   * representation to compact small filters better.
   *
   * Ideas:
   *  * variable length encoding for the mask (if not option, take max 1 byte).
   *  * first byte could contain the mask as well if small enough.
   *  * when packing ascii string, store several of them in each byte.
   */
  serialize(buffer) {
    buffer.pushUint32(this.mask);
    const index = buffer.getPos();
    buffer.pushUint8(0);
    let optionalParts = 0;
    if (this.filter !== void 0) {
      optionalParts = setBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasFilter);
      if (this.isUnicode()) {
        buffer.pushUTF8(this.filter);
      } else {
        buffer.pushNetworkFilter(this.filter);
      }
    }
    if (this.hostname !== void 0) {
      optionalParts = setBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasHostname);
      buffer.pushNetworkHostname(this.hostname);
    }
    if (this.domains !== void 0) {
      optionalParts = setBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasDomains);
      this.domains.serialize(buffer);
    }
    if (this.rawLine !== void 0) {
      optionalParts = setBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasRawLine);
      buffer.pushRawNetwork(this.rawLine);
    }
    if (this.denyallow !== void 0) {
      optionalParts = setBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasDenyallow);
      this.denyallow.serialize(buffer);
    }
    if (this.optionValue !== void 0) {
      optionalParts = setBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.hasOptionValue);
      if (this.isCSP()) {
        buffer.pushNetworkCSP(this.optionValue);
      } else if (this.isRedirect()) {
        buffer.pushNetworkRedirect(this.optionValue);
      } else {
        buffer.pushUTF8(this.optionValue);
      }
    }
    if (this.isCaseSensitive) {
      optionalParts = setBit(optionalParts, NETWORK_FILTER_OPTIONAL_PARTS_MASK.isCaseSensitive);
    }
    buffer.setByte(index, optionalParts);
  }
  getSerializedSize(compression) {
    let estimate = 4 + 1;
    if (this.filter !== void 0) {
      if (this.isUnicode() === true) {
        estimate += sizeOfUTF8(this.filter);
      } else {
        estimate += sizeOfNetworkFilter(this.filter, compression);
      }
    }
    if (this.hostname !== void 0) {
      estimate += sizeOfNetworkHostname(this.hostname, compression);
    }
    if (this.domains !== void 0) {
      estimate += this.domains.getSerializedSize();
    }
    if (this.rawLine !== void 0) {
      estimate += sizeOfRawNetwork(this.rawLine, compression);
    }
    if (this.denyallow !== void 0) {
      estimate += this.denyallow.getSerializedSize();
    }
    if (this.optionValue !== void 0) {
      if (this.isCSP()) {
        estimate += sizeOfNetworkCSP(this.optionValue, compression);
      } else if (this.isRedirect()) {
        estimate += sizeOfNetworkRedirect(this.optionValue, compression);
      } else {
        estimate += sizeOfUTF8(this.optionValue);
      }
    }
    return estimate;
  }
  /**
   * Tries to recreate the original representation of the filter (adblock
   * syntax) from the internal representation. If `rawLine` is set (when filters
   * are parsed in `debug` mode for example), then it is returned directly.
   * Otherwise, we try to stick as closely as possible to the original form;
   * there are things which cannot be recovered though, like domains options
   * of which only hashes are stored.
   */
  toString(modifierReplacer) {
    if (this.rawLine !== void 0) {
      return this.rawLine;
    }
    let filter = "";
    if (this.isException()) {
      filter += "@@";
    }
    if (this.isHostnameAnchor()) {
      filter += "||";
    } else if (this.fromHttp() !== this.fromHttps()) {
      if (this.fromHttp()) {
        filter += "|http://";
      } else {
        filter += "|https://";
      }
    } else if (this.isLeftAnchor()) {
      filter += "|";
    }
    if (this.hasHostname()) {
      filter += this.getHostname();
      filter += "^";
    }
    if (this.isFullRegex()) {
      filter += `/${this.getRegex().source}/`;
    } else if (this.isRegex()) {
      filter += this.getRegex().source;
    } else {
      filter += this.getFilter();
    }
    if (this.isRightAnchor() && filter[filter.length - 1] !== "^") {
      filter += "|";
    }
    const options = [];
    if (this.fromAny() === false) {
      const numberOfCptOptions = bitCount(this.getCptMask());
      const numberOfNegatedOptions = bitCount(FROM_ANY) - numberOfCptOptions;
      if (numberOfNegatedOptions < numberOfCptOptions) {
        for (const type of getListOfRequestTypesNegated(this)) {
          if (type === "sub_frame") {
            options.push("~subdocument");
          } else {
            options.push(`~${type}`);
          }
        }
      } else {
        for (const type of getListOfRequestTypes(this)) {
          if (type === "sub_frame") {
            options.push("subdocument");
          } else {
            options.push(type);
          }
        }
      }
    }
    if (this.isImportant()) {
      options.push("important");
    }
    if (this.isRedirectRule()) {
      if (this.optionValue === "") {
        options.push("redirect-rule");
      } else {
        options.push(`redirect-rule=${this.optionValue}`);
      }
    } else if (this.isRedirect()) {
      if (this.optionValue === "") {
        options.push("redirect");
      } else {
        options.push(`redirect=${this.optionValue}`);
      }
    }
    if (this.isCSP()) {
      options.push(`csp=${this.optionValue}`);
    }
    if (this.isElemHide()) {
      options.push("elemhide");
    }
    if (this.isSpecificHide()) {
      options.push("specifichide");
    }
    if (this.isGenericHide()) {
      options.push("generichide");
    }
    if (this.firstParty() !== this.thirdParty()) {
      if (this.firstParty()) {
        options.push("1p");
      }
      if (this.thirdParty()) {
        options.push("3p");
      }
    }
    if (this.domains !== void 0) {
      if (this.domains.parts !== void 0) {
        options.push(`domain=${this.domains.parts}`);
      } else {
        options.push("domain=<hashed>");
      }
    }
    if (this.denyallow !== void 0) {
      if (this.denyallow.parts !== void 0) {
        options.push(`denyallow=${this.denyallow.parts}`);
      } else {
        options.push("denyallow=<hashed>");
      }
    }
    if (this.isBadFilter()) {
      options.push("badfilter");
    }
    const removeparam = this.removeparam;
    if (removeparam !== void 0) {
      if (removeparam.length > 0) {
        options.push(`removeparam=${removeparam}`);
      } else {
        options.push("removeparam");
      }
    }
    if (this.isCaseSensitive) {
      options.push("match-case");
    }
    if (options.length > 0) {
      if (typeof modifierReplacer === "function") {
        filter += `$${options.map(modifierReplacer).join(",")}`;
      } else {
        filter += `$${options.join(",")}`;
      }
    }
    return filter;
  }
  // Public API (Read-Only)
  getIdWithoutBadFilter() {
    return computeFilterId2(this.mask & ~NETWORK_FILTER_MASK.isBadFilter, this.filter, this.hostname, this.domains, this.denyallow, this.optionValue, this.isCaseSensitive);
  }
  getId() {
    if (this.id === void 0) {
      this.id = computeFilterId2(this.mask, this.filter, this.hostname, this.domains, this.denyallow, this.optionValue, this.isCaseSensitive);
    }
    return this.id;
  }
  hasFilter() {
    return this.filter !== void 0;
  }
  hasDomains() {
    return this.domains !== void 0;
  }
  getMask() {
    return this.mask;
  }
  getCptMask() {
    return this.getMask() & FROM_ANY;
  }
  isRedirect() {
    return getBit(this.getMask(), NETWORK_FILTER_MASK.isRedirect);
  }
  isRedirectRule() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isRedirectRule);
  }
  getRedirect() {
    return this.optionValue ?? "";
  }
  isReplace() {
    return getBit(this.getMask(), NETWORK_FILTER_MASK.isReplace);
  }
  isRemoveParam() {
    return getBit(this.getMask(), NETWORK_FILTER_MASK.isRemoveParam);
  }
  // Expected to be called only with `$replace` modifiers
  getHtmlModifier() {
    if (this.optionValue?.length === 0) {
      return null;
    }
    return replaceOptionValueToRegexp(this.optionValue);
  }
  isHtmlFilteringRule() {
    return this.isReplace();
  }
  getRedirectResource() {
    const redirect = this.getRedirect();
    const priorityIndex = redirect.lastIndexOf(":");
    if (priorityIndex === -1) {
      return redirect;
    }
    return redirect.slice(0, priorityIndex);
  }
  getRedirectPriority() {
    const redirect = this.getRedirect();
    const priorityIndex = redirect.lastIndexOf(":");
    if (priorityIndex === -1) {
      return 0;
    }
    return Number(redirect.slice(priorityIndex + 1));
  }
  hasHostname() {
    return this.hostname !== void 0;
  }
  getHostname() {
    return this.hostname || "";
  }
  getFilter() {
    return this.filter || "";
  }
  getRegex() {
    if (this.regex === void 0) {
      this.regex = this.filter !== void 0 && this.isRegex() ? compileRegex(this.filter, this.isLeftAnchor(), this.isRightAnchor(), this.isFullRegex(), this.isCaseSensitive === true) : MATCH_ALL;
    }
    return this.regex;
  }
  getTokens() {
    TOKENS_BUFFER.reset();
    if (this.domains !== void 0 && this.domains.hostnames !== void 0 && this.domains.entities === void 0 && this.domains.notHostnames === void 0 && this.domains.notEntities === void 0 && this.domains.hostnames.length === 1) {
      TOKENS_BUFFER.push(this.domains.hostnames[0]);
    }
    if (this.isFullRegex() === false) {
      if (this.filter !== void 0) {
        const skipLastToken = !this.isRightAnchor();
        const skipFirstToken = !this.isLeftAnchor();
        tokenizeWithWildcardsInPlace(this.isRegex() ? this.filter.toLowerCase() : this.filter, skipFirstToken, skipLastToken, TOKENS_BUFFER);
      }
      if (this.hostname !== void 0) {
        tokenizeInPlace(this.hostname, false, this.filter !== void 0 && this.filter.charCodeAt(0) === 42, TOKENS_BUFFER);
      }
    } else if (this.filter !== void 0) {
      tokenizeRegexInPlace(this.filter.toLowerCase(), TOKENS_BUFFER);
    }
    if (TOKENS_BUFFER.empty() === true && this.domains !== void 0 && this.domains.hostnames !== void 0 && this.domains.entities === void 0 && this.domains.notHostnames === void 0 && this.domains.notEntities === void 0) {
      const result = [];
      for (const hostname of this.domains.hostnames) {
        const arr = new Uint32Array(1);
        arr[0] = hostname;
        result.push(arr);
      }
      return result;
    }
    if (TOKENS_BUFFER.empty() === true && this.fromAny() === false) {
      const types = getListOfRequestTypes(this);
      if (types.length !== 0) {
        const result = [];
        for (const type of types) {
          const arr = new Uint32Array(1);
          arr[0] = NORMALIZED_TYPE_TOKEN[type];
          result.push(arr);
        }
        return result;
      }
    }
    if (this.fromHttp() === true && this.fromHttps() === false) {
      TOKENS_BUFFER.push(HTTP_HASH);
    } else if (this.fromHttps() === true && this.fromHttp() === false) {
      TOKENS_BUFFER.push(HTTPS_HASH);
    }
    return [TOKENS_BUFFER.slice()];
  }
  /**
   * Check if this filter should apply to a request with this content type.
   */
  isCptAllowed(cpt) {
    const mask = REQUEST_TYPE_TO_MASK[cpt];
    if (mask !== void 0) {
      return getBit(this.mask, mask);
    }
    return this.fromAny();
  }
  isException() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isException);
  }
  isHostnameAnchor() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isHostnameAnchor);
  }
  isRightAnchor() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isRightAnchor);
  }
  isLeftAnchor() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isLeftAnchor);
  }
  isImportant() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isImportant);
  }
  isFullRegex() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isFullRegex);
  }
  isRegex() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isRegex) || getBit(this.mask, NETWORK_FILTER_MASK.isFullRegex);
  }
  isPlain() {
    return !this.isRegex();
  }
  isCSP() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isCSP);
  }
  isElemHide() {
    return this.isSpecificHide() && this.isGenericHide();
  }
  isSpecificHide() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isSpecificHide);
  }
  isGenericHide() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isGenericHide);
  }
  isBadFilter() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isBadFilter);
  }
  isUnicode() {
    return getBit(this.mask, NETWORK_FILTER_MASK.isUnicode);
  }
  fromAny() {
    return this.getCptMask() === FROM_ANY;
  }
  thirdParty() {
    return getBit(this.mask, NETWORK_FILTER_MASK.thirdParty);
  }
  firstParty() {
    return getBit(this.mask, NETWORK_FILTER_MASK.firstParty);
  }
  fromImage() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromImage);
  }
  fromMedia() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromMedia);
  }
  fromObject() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromObject);
  }
  fromOther() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromOther);
  }
  fromPing() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromPing);
  }
  fromScript() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromScript);
  }
  fromStylesheet() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromStylesheet);
  }
  fromDocument() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromDocument);
  }
  fromSubdocument() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromSubdocument);
  }
  fromWebsocket() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromWebsocket);
  }
  fromHttp() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromHttp);
  }
  fromHttps() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromHttps);
  }
  fromXmlHttpRequest() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromXmlHttpRequest);
  }
  fromFont() {
    return getBit(this.mask, NETWORK_FILTER_MASK.fromFont);
  }
};
function setNetworkMask(mask, m, value) {
  if (value === true) {
    return setBit(mask, m);
  }
  return clearBit(mask, m);
}
function checkIsRegex(filter, start, end) {
  const indexOfSeparator = filter.indexOf("^", start);
  if (indexOfSeparator !== -1 && indexOfSeparator < end) {
    return true;
  }
  const indexOfWildcard = filter.indexOf("*", start);
  return indexOfWildcard !== -1 && indexOfWildcard < end;
}
function isAnchoredByHostname(filterHostname, hostname, isFollowedByWildcard) {
  if (filterHostname.length === 0) {
    return true;
  }
  if (filterHostname.length > hostname.length) {
    return false;
  }
  if (filterHostname.length === hostname.length) {
    return filterHostname === hostname;
  }
  const matchIndex = hostname.indexOf(filterHostname);
  if (matchIndex === -1) {
    return false;
  }
  if (matchIndex === 0) {
    return isFollowedByWildcard === true || hostname.charCodeAt(filterHostname.length) === 46 || filterHostname.charCodeAt(filterHostname.length - 1) === 46;
  }
  if (hostname.length === matchIndex + filterHostname.length) {
    return hostname.charCodeAt(matchIndex - 1) === 46 || filterHostname.charCodeAt(0) === 46;
  }
  return (isFollowedByWildcard === true || hostname.charCodeAt(filterHostname.length) === 46 || filterHostname.charCodeAt(filterHostname.length - 1) === 46) && (hostname.charCodeAt(matchIndex - 1) === 46 || filterHostname.charCodeAt(0) === 46);
}
function checkPattern(filter, request) {
  const pattern = filter.getFilter();
  const url = filter.isCaseSensitive ? request.url : request.normalizedUrl;
  if (filter.isHostnameAnchor() === true) {
    const filterHostname = filter.getHostname();
    if (isAnchoredByHostname(
      filterHostname,
      request.hostname,
      filter.filter !== void 0 && filter.filter.charCodeAt(0) === 42
      /* '*' */
    ) === false) {
      return false;
    }
    if (filter.isRegex()) {
      return filter.getRegex().test(url.slice(url.indexOf(filterHostname) + filterHostname.length));
    } else if (filter.isRightAnchor() && filter.isLeftAnchor()) {
      const urlAfterHostname = url.slice(url.indexOf(filterHostname) + filterHostname.length);
      return pattern === urlAfterHostname;
    } else if (filter.isRightAnchor()) {
      const requestHostname = request.hostname;
      if (filter.hasFilter() === false) {
        return filterHostname.length === requestHostname.length || requestHostname.endsWith(filterHostname);
      } else {
        return url.endsWith(pattern);
      }
    } else if (filter.isLeftAnchor()) {
      return url.startsWith(pattern, url.indexOf(filterHostname) + filterHostname.length);
    }
    if (filter.hasFilter() === false) {
      return true;
    }
    return url.indexOf(pattern, url.indexOf(filterHostname) + filterHostname.length) !== -1;
  } else if (filter.isRegex()) {
    return filter.getRegex().test(url);
  } else if (filter.isLeftAnchor() && filter.isRightAnchor()) {
    return url === pattern;
  } else if (filter.isLeftAnchor()) {
    return url.startsWith(pattern);
  } else if (filter.isRightAnchor()) {
    return url.endsWith(pattern);
  }
  if (filter.hasFilter() === false) {
    return true;
  }
  return url.indexOf(pattern) !== -1;
}
function checkOptions(filter, request) {
  if (filter.isCptAllowed(request.type) === false || request.isHttps === true && filter.fromHttps() === false || request.isHttp === true && filter.fromHttp() === false || filter.firstParty() === false && request.isFirstParty === true || filter.thirdParty() === false && request.isThirdParty === true) {
    return false;
  }
  if (filter.domains !== void 0 && filter.domains.match(request.sourceHostnameHashes, request.sourceEntityHashes) === false) {
    return false;
  }
  if (filter.denyallow !== void 0 && filter.denyallow.match(request.getHostnameHashes(), request.getEntityHashes()) === true) {
    return false;
  }
  return true;
}

// node_modules/@ghostery/adblocker/dist/esm/preprocessor.js
var Env = class extends Map {
};
var PreprocessorTokens;
(function(PreprocessorTokens2) {
  PreprocessorTokens2[PreprocessorTokens2["INVALID"] = 0] = "INVALID";
  PreprocessorTokens2[PreprocessorTokens2["BEGIF"] = 1] = "BEGIF";
  PreprocessorTokens2[PreprocessorTokens2["ELSE"] = 2] = "ELSE";
  PreprocessorTokens2[PreprocessorTokens2["ENDIF"] = 3] = "ENDIF";
})(PreprocessorTokens || (PreprocessorTokens = {}));
function detectPreprocessor(line) {
  if (line.length < 6 || line.charCodeAt(0) !== 33 || line.charCodeAt(1) !== 35) {
    return PreprocessorTokens.INVALID;
  }
  if (line.startsWith("!#if ")) {
    return PreprocessorTokens.BEGIF;
  }
  if (line === "!#else") {
    return PreprocessorTokens.ELSE;
  }
  if (line === "!#endif") {
    return PreprocessorTokens.ENDIF;
  }
  return PreprocessorTokens.INVALID;
}
var tokenizerPattern = /(!|&&|\|\||\(|\)|[a-zA-Z0-9_]+)/g;
var identifierPattern = /^[a-zA-Z0-9_]+$/;
var tokenize3 = (expression) => expression.match(tokenizerPattern);
var isIdentifier = (expression) => identifierPattern.test(expression);
var precedence = {
  "!": 2,
  "&&": 1,
  "||": 0
};
var isOperator = (token) => Object.prototype.hasOwnProperty.call(precedence, token);
var testIdentifier = (identifier, env) => {
  if (identifier === "true" && !env.has("true")) {
    return true;
  }
  if (identifier === "false" && !env.has("false")) {
    return false;
  }
  return !!env.get(identifier);
};
var evaluate = (expression, env) => {
  if (expression.length === 0) {
    return false;
  }
  if (isIdentifier(expression)) {
    return testIdentifier(expression, env);
  }
  const tokens = tokenize3(expression);
  if (!tokens || tokens.length === 0) {
    return false;
  }
  if (expression.length !== tokens.reduce((partialSum, token) => partialSum + token.length, 0)) {
    return false;
  }
  const output = [];
  const stack = [];
  for (let i = 0, token = tokens[0], next = tokens[1]; i < tokens.length; i++, token = tokens[i], next = tokens[i + 1]) {
    if (token === "(") {
      if (next === ")") {
        return false;
      }
      stack.push(token);
    } else if (token === ")") {
      while (stack.length !== 0 && stack[stack.length - 1] !== "(") {
        output.push(stack.pop());
      }
      if (stack.length === 0) {
        return false;
      }
      stack.pop();
    } else if (isOperator(token)) {
      if (token === "!" && (next === void 0 || next === ")" || next !== "!" && isOperator(next))) {
        return false;
      }
      while (stack.length !== 0 && isOperator(stack[stack.length - 1]) && precedence[token] < precedence[stack[stack.length - 1]]) {
        output.push(stack.pop());
      }
      stack.push(token);
    } else {
      output.push(testIdentifier(token, env));
    }
  }
  if (stack.includes("(")) {
    return false;
  }
  while (stack.length !== 0) {
    output.push(stack.pop());
  }
  for (const token of output) {
    if (token === true || token === false) {
      stack.push(token);
    } else if (token === "!") {
      stack.push(!stack.pop());
    } else if (token === "&&" || token === "||") {
      if (stack.length < 2) {
        return false;
      }
      const right = stack.pop();
      const left = stack.pop();
      stack.push(token === "&&" ? left && right : left || right);
    }
  }
  return stack.pop() === true && stack.length === 0;
};
var joinConditions = (expressions) => {
  if (expressions.length === 1) {
    return expressions[0];
  }
  return expressions.map((expression) => `(${expression})`).join("&&");
};
var Preprocessor = class _Preprocessor {
  static getCondition(line) {
    return line.slice(
      5
      /* '!#if '.length */
    ).replace(/\s/g, "");
  }
  static parse(line, filterIDs) {
    return new this({
      condition: _Preprocessor.getCondition(line),
      filterIDs
    });
  }
  static deserialize(view) {
    const condition = view.getUTF8();
    const filterIDs = /* @__PURE__ */ new Set();
    for (let i = 0, l = view.getUint32(); i < l; i++) {
      filterIDs.add(view.getUint32());
    }
    return new this({
      condition,
      filterIDs
    });
  }
  constructor({ condition, filterIDs = /* @__PURE__ */ new Set() }) {
    this.condition = condition;
    this.filterIDs = filterIDs;
  }
  evaluate(env) {
    return evaluate(this.condition, env);
  }
  serialize(view) {
    view.pushUTF8(this.condition);
    view.pushUint32(this.filterIDs.size);
    for (const filterID of this.filterIDs) {
      view.pushUint32(filterID);
    }
  }
  getSerializedSize() {
    let estimatedSize = sizeOfUTF8(this.condition);
    estimatedSize += (1 + this.filterIDs.size) * 4;
    return estimatedSize;
  }
};

// node_modules/@ghostery/adblocker/dist/esm/lists.js
var FilterType;
(function(FilterType2) {
  FilterType2[FilterType2["NOT_SUPPORTED"] = 0] = "NOT_SUPPORTED";
  FilterType2[FilterType2["NETWORK"] = 1] = "NETWORK";
  FilterType2[FilterType2["COSMETIC"] = 2] = "COSMETIC";
  FilterType2[FilterType2["NOT_SUPPORTED_EMPTY"] = 100] = "NOT_SUPPORTED_EMPTY";
  FilterType2[FilterType2["NOT_SUPPORTED_COMMENT"] = 101] = "NOT_SUPPORTED_COMMENT";
  FilterType2[FilterType2["NOT_SUPPORTED_ADGUARD"] = 102] = "NOT_SUPPORTED_ADGUARD";
})(FilterType || (FilterType = {}));
function detectFilterType(line, { extendedNonSupportedTypes = false } = {}) {
  if (line.length === 0 || line.length === 1) {
    if (extendedNonSupportedTypes) {
      return FilterType.NOT_SUPPORTED_EMPTY;
    }
    return FilterType.NOT_SUPPORTED;
  }
  const firstCharCode = line.charCodeAt(0);
  const secondCharCode = line.charCodeAt(1);
  if (firstCharCode === 33 || firstCharCode === 35 && secondCharCode <= 32 || firstCharCode === 91 && line.startsWith("[Adblock")) {
    if (extendedNonSupportedTypes) {
      return FilterType.NOT_SUPPORTED_COMMENT;
    }
    return FilterType.NOT_SUPPORTED;
  }
  const lastCharCode = line.charCodeAt(line.length - 1);
  if (firstCharCode === 36 && secondCharCode !== 36 && secondCharCode !== 64 || firstCharCode === 38 || firstCharCode === 42 || firstCharCode === 45 || firstCharCode === 46 || firstCharCode === 47 || firstCharCode === 58 || firstCharCode === 61 || firstCharCode === 63 || firstCharCode === 64 || firstCharCode === 95 || firstCharCode === 124 || lastCharCode === 124) {
    return FilterType.NETWORK;
  }
  const dollarIndex = line.indexOf("$");
  if (dollarIndex !== -1 && dollarIndex !== line.length - 1) {
    const afterDollarIndex = dollarIndex + 1;
    const afterDollarCharCode = line.charCodeAt(afterDollarIndex);
    if (afterDollarCharCode === 36 || afterDollarCharCode === 64 && line.startsWith(
      /* $@$ */
      "@$",
      afterDollarIndex
    )) {
      if (extendedNonSupportedTypes) {
        return FilterType.NOT_SUPPORTED_ADGUARD;
      }
      return FilterType.NOT_SUPPORTED;
    }
  }
  const sharpIndex = line.indexOf("#");
  if (sharpIndex !== -1 && sharpIndex !== line.length - 1) {
    const afterSharpIndex = sharpIndex + 1;
    const afterSharpCharCode = line.charCodeAt(afterSharpIndex);
    if (afterSharpCharCode === 35 || afterSharpCharCode === 64 && line.startsWith(
      /* #@# */
      "@#",
      afterSharpIndex
    )) {
      return FilterType.COSMETIC;
    } else if (afterSharpCharCode === 64 && (line.startsWith(
      /* #@$# */
      "@$#",
      afterSharpIndex
    ) || line.startsWith(
      /* #@%# */
      "@%#",
      afterSharpIndex
    ) || line.startsWith(
      /* #@?# */
      "@?#",
      afterSharpIndex
    )) || afterSharpCharCode === 37 && line.startsWith(
      /* #%# */
      "%#",
      afterSharpIndex
    ) || afterSharpCharCode === 36 && (line.startsWith(
      /* #$# */
      "$#",
      afterSharpIndex
    ) || line.startsWith(
      /* #$?# */
      "$?#",
      afterSharpIndex
    )) || afterSharpCharCode === 63 && line.startsWith(
      /* #?# */
      "?#",
      afterSharpIndex
    )) {
      if (extendedNonSupportedTypes) {
        return FilterType.NOT_SUPPORTED_ADGUARD;
      }
      return FilterType.NOT_SUPPORTED;
    }
  }
  return FilterType.NETWORK;
}
function parseFilters(list, config = new Config()) {
  config = new Config(config);
  const networkFilters = [];
  const cosmeticFilters = [];
  const notSupportedFilters = [];
  const lines = list.split("\n");
  const preprocessors = /* @__PURE__ */ new Map();
  const conditions = [];
  let preprocessor = null;
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];
    if (line.length !== 0 && line.charCodeAt(0) <= 32) {
      line = line.trimStart();
    }
    if (line.length > 2) {
      while (i < lines.length - 1 && line.charCodeAt(line.length - 1) === 92 && line.charCodeAt(line.length - 2) === 32) {
        line = line.slice(0, -2);
        const nextLine = lines[i + 1];
        if (nextLine.length > 4 && nextLine.charCodeAt(0) === 32 && nextLine.charCodeAt(1) === 32 && nextLine.charCodeAt(2) === 32 && nextLine.charCodeAt(3) === 32 && nextLine.charCodeAt(4) !== 32) {
          line += nextLine.slice(4);
          i += 1;
        } else {
          break;
        }
      }
    }
    if (line.length !== 0 && line.charCodeAt(line.length - 1) <= 32) {
      line = line.trimEnd();
    }
    const filterType = detectFilterType(line, { extendedNonSupportedTypes: true });
    if (filterType === FilterType.NETWORK && config.loadNetworkFilters === true) {
      const filter = NetworkFilter.parse(line, config.debug);
      if (filter !== null) {
        networkFilters.push(filter);
        if (preprocessor !== null) {
          preprocessor.filterIDs.add(filter.getId());
        }
      } else {
        notSupportedFilters.push({
          lineNumber: i,
          filter: line,
          filterType
        });
      }
    } else if (filterType === FilterType.COSMETIC && config.loadCosmeticFilters === true) {
      const filter = CosmeticFilter.parse(line, config.debug);
      if (filter !== null) {
        if (config.loadGenericCosmeticsFilters === true || filter.isGenericHide() === false) {
          cosmeticFilters.push(filter);
          if (preprocessor !== null) {
            preprocessor.filterIDs.add(filter.getId());
          }
        }
      } else {
        notSupportedFilters.push({
          lineNumber: i,
          filter: line,
          filterType: FilterType.COSMETIC
        });
      }
    } else if (config.loadPreprocessors) {
      const preprocessorToken = detectPreprocessor(line);
      if (preprocessorToken === PreprocessorTokens.BEGIF) {
        const condition = Preprocessor.getCondition(line);
        conditions.push(condition);
        const nextCondition = joinConditions(conditions);
        preprocessor = preprocessors.get(nextCondition);
        if (preprocessor === void 0) {
          preprocessor = new Preprocessor({
            condition: nextCondition
          });
          preprocessors.set(nextCondition, preprocessor);
        }
      } else if (preprocessorToken === PreprocessorTokens.ENDIF) {
        conditions.pop();
        preprocessor = preprocessors.get(joinConditions(conditions)) || null;
      } else if (preprocessorToken === PreprocessorTokens.ELSE && conditions.length > 0) {
        conditions.push(`!(${conditions.pop()})`);
        const nextCondition = joinConditions(conditions);
        preprocessor = preprocessors.get(nextCondition);
        if (preprocessor === void 0) {
          preprocessor = new Preprocessor({
            condition: nextCondition
          });
          preprocessors.set(nextCondition, preprocessor);
        }
      } else if (filterType === FilterType.NOT_SUPPORTED_ADGUARD) {
        notSupportedFilters.push({
          lineNumber: i,
          filter: line,
          filterType
        });
      }
    } else if (filterType === FilterType.NOT_SUPPORTED_ADGUARD) {
      notSupportedFilters.push({
        lineNumber: i,
        filter: line,
        filterType
      });
    }
  }
  return {
    networkFilters,
    cosmeticFilters,
    preprocessors: Array.from(preprocessors.values()).filter((preprocessor2) => preprocessor2.filterIDs.size > 0),
    notSupportedFilters
  };
}

// node_modules/@remusao/small/dist/esm/types.js
var PREFIX2 = "MIME_TYPE_STUB";

// node_modules/@remusao/small/dist/esm/flv.js
var CONTENT_TYPE = "video/flv";
var resource = {
  name: `${PREFIX2}.flv`,
  contentType: `${CONTENT_TYPE};base64`,
  aliases: [CONTENT_TYPE, ".flv", "flv"],
  body: "RkxWAQEAAAAJAAAAABIAALgAAAAAAAAAAgAKb25NZXRhRGF0YQgAAAAIAAhkdXJhdGlvbgAAAAAAAAAAAAAFd2lkdGgAP/AAAAAAAAAABmhlaWdodAA/8AAAAAAAAAANdmlkZW9kYXRhcmF0ZQBAaGoAAAAAAAAJZnJhbWVyYXRlAEBZAAAAAAAAAAx2aWRlb2NvZGVjaWQAQAAAAAAAAAAAB2VuY29kZXICAA1MYXZmNTcuNDEuMTAwAAhmaWxlc2l6ZQBAaoAAAAAAAAAACQAAAMM="
};
var flv_default = resource;

// node_modules/@remusao/small/dist/esm/gif.js
var CONTENT_TYPE2 = "image/gif";
var resource2 = {
  name: `${PREFIX2}.gif`,
  contentType: `${CONTENT_TYPE2};base64`,
  aliases: [CONTENT_TYPE2, ".gif", "gif"],
  body: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
};
var gif_default = resource2;

// node_modules/@remusao/small/dist/esm/html.js
var CONTENT_TYPE3 = "text/html";
var resource3 = {
  name: `${PREFIX2}.html`,
  contentType: CONTENT_TYPE3,
  aliases: [
    CONTENT_TYPE3,
    ".html",
    "html",
    ".htm",
    "htm",
    "noopframe",
    "noop.html"
  ],
  body: "<!DOCTYPE html>"
};
var html_default = resource3;

// node_modules/@remusao/small/dist/esm/ico.js
var CONTENT_TYPE4 = "image/vnd.microsoft.icon";
var resource4 = {
  name: `${PREFIX2}.ico`,
  contentType: `${CONTENT_TYPE4};base64`,
  aliases: [CONTENT_TYPE4, ".ico", "ico"],
  body: "AAABAAEAAQEAAAEAGAAwAAAAFgAAACgAAAABAAAAAgAAAAEAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAA=="
};
var ico_default = resource4;

// node_modules/@remusao/small/dist/esm/jpeg.js
var CONTENT_TYPE5 = "image/jpeg";
var resource5 = {
  name: `${PREFIX2}.jpg`,
  contentType: `${CONTENT_TYPE5};base64`,
  aliases: [CONTENT_TYPE5, ".jpg", "jpg", ".jpeg", "jpeg"],
  body: "/9j/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k="
};
var jpeg_default = resource5;

// node_modules/@remusao/small/dist/esm/javascript.js
var CONTENT_TYPE6 = "application/javascript";
var resource6 = {
  name: `${PREFIX2}.js`,
  contentType: CONTENT_TYPE6,
  aliases: [
    CONTENT_TYPE6,
    ".js",
    "js",
    "javascript",
    ".jsx",
    "jsx",
    "typescript",
    ".ts",
    "ts",
    "noop.js",
    "noopjs"
  ],
  body: ""
};
var javascript_default = resource6;

// node_modules/@remusao/small/dist/esm/json.js
var CONTENT_TYPE7 = "application/json";
var resource7 = {
  name: `${PREFIX2}.json`,
  contentType: CONTENT_TYPE7,
  aliases: [CONTENT_TYPE7, ".json", "json"],
  body: "0"
};
var json_default = resource7;

// node_modules/@remusao/small/dist/esm/mp3.js
var CONTENT_TYPE8 = "audio/mpeg";
var resource8 = {
  name: `${PREFIX2}.mp3`,
  contentType: `${CONTENT_TYPE8};base64`,
  aliases: [CONTENT_TYPE8, ".mp3", "mp3", "noop-0.1s.mp3", "noopmp3-0.1s"],
  body: "/+MYxAAAAANIAAAAAExBTUUzLjk4LjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
};
var mp3_default = resource8;

// node_modules/@remusao/small/dist/esm/mp4.js
var CONTENT_TYPE9 = "video/mp4";
var resource9 = {
  name: `${PREFIX2}.mp4`,
  contentType: `${CONTENT_TYPE9};base64`,
  aliases: [
    CONTENT_TYPE9,
    ".mp4",
    "mp4",
    ".m4a",
    "m4a",
    ".m4p",
    "m4p",
    ".m4b",
    "m4b",
    ".m4r",
    "m4r",
    ".m4v",
    "m4v",
    "noop-1s.mp4",
    "noopmp4-1s"
  ],
  body: "AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAAhmcmVlAAAC721kYXQhEAUgpBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3pwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcCEQBSCkG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADengAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAsJtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAALwABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAB7HRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAIAAAAAAAAALwAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAC8AAAAAAAEAAAAAAWRtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAKxEAAAIAFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAEPbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAADTc3RibAAAAGdzdHNkAAAAAAAAAAEAAABXbXA0YQAAAAAAAAABAAAAAAAAAAAAAgAQAAAAAKxEAAAAAAAzZXNkcwAAAAADgICAIgACAASAgIAUQBUAAAAAAfQAAAHz+QWAgIACEhAGgICAAQIAAAAYc3R0cwAAAAAAAAABAAAAAgAABAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAIAAAABAAAAHHN0c3oAAAAAAAAAAAAAAAIAAAFzAAABdAAAABRzdGNvAAAAAAAAAAEAAAAsAAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExhdmY1Ni40MC4xMDE="
};
var mp4_default = resource9;

// node_modules/@remusao/small/dist/esm/pdf.js
var CONTENT_TYPE10 = "application/pdf";
var resource10 = {
  name: `${PREFIX2}.pdf`,
  contentType: `${CONTENT_TYPE10};base64`,
  aliases: [CONTENT_TYPE10, ".pdf", "pdf"],
  body: "JVBERi0xLgoxIDAgb2JqPDwvUGFnZXMgMiAwIFI+PmVuZG9iagoyIDAgb2JqPDwvS2lkc1szIDAgUl0vQ291bnQgMT4+ZW5kb2JqCjMgMCBvYmo8PC9QYXJlbnQgMiAwIFI+PmVuZG9iagp0cmFpbGVyIDw8L1Jvb3QgMSAwIFI+Pg=="
};
var pdf_default = resource10;

// node_modules/@remusao/small/dist/esm/png.js
var CONTENT_TYPE11 = "image/png";
var resource11 = {
  name: `${PREFIX2}.png`,
  contentType: `${CONTENT_TYPE11};base64`,
  aliases: [CONTENT_TYPE11, ".png", "png"],
  body: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
};
var png_default = resource11;

// node_modules/@remusao/small/dist/esm/svg.js
var CONTENT_TYPE12 = "image/svg+xml";
var resource12 = {
  name: `${PREFIX2}.svg`,
  contentType: CONTENT_TYPE12,
  aliases: [CONTENT_TYPE12, ".svg", "svg"],
  body: "https://raw.githubusercontent.com/mathiasbynens/small/master/svg.svg"
};
var svg_default = resource12;

// node_modules/@remusao/small/dist/esm/txt.js
var CONTENT_TYPE13 = "text/plain";
var resource13 = {
  name: `${PREFIX2}.txt`,
  contentType: CONTENT_TYPE13,
  aliases: [CONTENT_TYPE13, ".txt", "txt", "text", "nooptext", "noop.txt"],
  body: ""
};
var txt_default = resource13;

// node_modules/@remusao/small/dist/esm/wav.js
var CONTENT_TYPE14 = "audio/wav";
var resource14 = {
  name: `${PREFIX2}.wav`,
  contentType: `${CONTENT_TYPE14};base64`,
  aliases: [CONTENT_TYPE14, ".wav", "wav"],
  body: "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
};
var wav_default = resource14;

// node_modules/@remusao/small/dist/esm/webm.js
var CONTENT_TYPE15 = "video/webm";
var resource15 = {
  name: `${PREFIX2}.webm`,
  contentType: `${CONTENT_TYPE15};base64`,
  aliases: [CONTENT_TYPE15, ".webm", "webm"],
  body: "GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmQCgq17FAAw9CQE2AQAZ3aGFtbXlXQUAGd2hhbW15RIlACECPQAAAAAAAFlSua0AxrkAu14EBY8WBAZyBACK1nEADdW5khkAFVl9WUDglhohAA1ZQOIOBAeBABrCBCLqBCB9DtnVAIueBAKNAHIEAAIAwAQCdASoIAAgAAUAmJaQAA3AA/vz0AAA="
};
var webm_default = resource15;

// node_modules/@remusao/small/dist/esm/webp.js
var CONTENT_TYPE16 = "image/webp";
var resource16 = {
  name: `${PREFIX2}.webp`,
  contentType: `${CONTENT_TYPE16};base64`,
  aliases: [CONTENT_TYPE16, ".webp", "webp"],
  body: "UklGRhIAAABXRUJQVlA4TAYAAAAvQWxvAGs="
};
var webp_default = resource16;

// node_modules/@remusao/small/dist/esm/wmv.js
var CONTENT_TYPE17 = "video/wmv";
var resource17 = {
  name: `${PREFIX2}.wmv`,
  contentType: `${CONTENT_TYPE17};base64`,
  aliases: [CONTENT_TYPE17, ".wmv", "wmv"],
  body: "MCaydY5mzxGm2QCqAGLObOUBAAAAAAAABQAAAAECodyrjEepzxGO5ADADCBTZWgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABcCAAAAAAAAAIA+1d6xnQEAAAAAAAAAAMAF2QEAAAAAAAAAAAAAAAAcDAAAAAAAAAIAAACADAAAgAwAAEANAwC1A79fLqnPEY7jAMAMIFNlLgAAAAAAAAAR0tOruqnPEY7mAMAMIFNlBgAAAAAAQKTQ0gfj0hGX8ACgyV6oUGQAAAAAAAAAAQAoAFcATQAvAEUAbgBjAG8AZABpAG4AZwBTAGUAdAB0AGkAbgBnAHMAAAAAABwATABhAHYAZgA1ADcALgA0ADEALgAxADAAMAAAAJEH3Le3qc8RjuYAwAwgU2WBAAAAAAAAAMDvGbxNW88RqP0AgF9cRCsAV/sgVVvPEaj9AIBfXEQrAAAAAAAAAAAzAAAAAAAAAAEAAAAAAAEAAAABAAAAAigAKAAAAAEAAAABAAAAAQAYAE1QNDMDAAAAAAAAAAAAAAAAAAAAAAAAAEBS0YYdMdARo6QAoMkDSPZMAAAAAAAAAEFS0YYdMdARo6QAoMkDSPYBAAAAAQAKAG0AcwBtAHAAZQBnADQAdgAzAAAAAAAEAE1QNDM2JrJ1jmbPEabZAKoAYs5sMgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQ=="
};
var wmv_default = resource17;

// node_modules/@remusao/small/dist/esm/index.js
var MIME_TO_RESOURCE = (() => {
  const resources = {};
  for (const fake of [
    flv_default,
    gif_default,
    html_default,
    ico_default,
    jpeg_default,
    javascript_default,
    json_default,
    mp3_default,
    mp4_default,
    pdf_default,
    png_default,
    svg_default,
    txt_default,
    wav_default,
    webm_default,
    webp_default,
    wmv_default
  ]) {
    for (const alias of fake.aliases) {
      resources[alias] = fake;
    }
  }
  return resources;
})();
function getFallbackTextResource() {
  return txt_default;
}
function getResourceForMime(mime) {
  return MIME_TO_RESOURCE[mime] || getFallbackTextResource();
}

// node_modules/@ghostery/adblocker/dist/esm/resources.js
function btoaPolyfill(buffer) {
  if (typeof btoa !== "undefined") {
    return btoa(buffer);
  } else if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }
  return buffer;
}
function isResourceValid(resource18) {
  if (resource18 === null) {
    return false;
  }
  if (typeof resource18 !== "object") {
    return false;
  }
  const { name, aliases, body, contentType } = resource18;
  if (typeof name !== "string") {
    return false;
  }
  if (!Array.isArray(aliases) || !aliases.every((alias) => typeof alias === "string")) {
    return false;
  }
  if (typeof body !== "string") {
    return false;
  }
  if (typeof contentType !== "string") {
    return false;
  }
  return true;
}
function isScriptletValid(scriptlet) {
  if (scriptlet === null) {
    return false;
  }
  if (typeof scriptlet !== "object") {
    return false;
  }
  const { name, aliases, body, dependencies, executionWorld, requiresTrust } = scriptlet;
  if (typeof name !== "string") {
    return false;
  }
  if (!Array.isArray(aliases) || !aliases.every((alias) => typeof alias === "string")) {
    return false;
  }
  if (typeof body !== "string") {
    return false;
  }
  if (!Array.isArray(dependencies) || !dependencies.every((depencency) => typeof depencency === "string")) {
    return false;
  }
  if (typeof executionWorld !== "undefined" && executionWorld !== "MAIN" && executionWorld !== "ISOLATED") {
    return false;
  }
  if (typeof requiresTrust !== "undefined" && typeof requiresTrust !== "boolean") {
    return false;
  }
  return true;
}
var assembleScript = (script, dependencies = []) => [
  `if (typeof scriptletGlobals === 'undefined') { var scriptletGlobals = {}; }`,
  ...dependencies,
  `(${script})(...[\`{{1}}\`,\`{{2}}\`,\`{{3}}\`,\`{{4}}\`,\`{{5}}\`,\`{{6}}\`,\`{{7}}\`,\`{{8}}\`,\`{{9}}\`,\`{{10}}\`].filter((a,i) => a !== '{{'+(i+1)+'}}').map((a) => decodeURIComponent(a)))`
].join(";");
var Resources = class _Resources {
  static deserialize(buffer) {
    const checksum = buffer.getASCII();
    const resources = [];
    const scriptlets = [];
    for (let i = 0, numberOfResources = buffer.getUint16(); i < numberOfResources; i++) {
      const name = buffer.getASCII();
      const aliases = [];
      for (let i2 = 0, numberOfAliases = buffer.getUint16(); i2 < numberOfAliases; i2++) {
        aliases.push(buffer.getASCII());
      }
      resources.push({
        name,
        aliases,
        body: buffer.getUTF8(),
        contentType: buffer.getASCII()
      });
    }
    for (let i = 0, numberOfScriptlets = buffer.getUint16(); i < numberOfScriptlets; i++) {
      const name = buffer.getASCII();
      const aliases = [];
      for (let i2 = 0, numberOfAliases = buffer.getUint16(); i2 < numberOfAliases; i2++) {
        aliases.push(buffer.getASCII());
      }
      const body = buffer.getUTF8();
      const hasExecutionWorld = buffer.getBool();
      const isExecutionWorldIsolated = buffer.getBool();
      const hasRequiresTrust = buffer.getBool();
      const requiresTrust = buffer.getBool();
      const dependencies = [];
      for (let i2 = 0, numberOfDependencies = buffer.getUint16(); i2 < numberOfDependencies; i2++) {
        dependencies.push(buffer.getASCII());
      }
      const scriptlet = {
        name,
        aliases,
        body,
        dependencies
      };
      if (hasExecutionWorld) {
        scriptlet.executionWorld = isExecutionWorldIsolated === true ? "ISOLATED" : "MAIN";
      }
      if (hasRequiresTrust) {
        scriptlet.requiresTrust = requiresTrust;
      }
      scriptlets.push(scriptlet);
    }
    return new _Resources({
      checksum,
      scriptlets,
      resources
    });
  }
  static parse(data, { checksum }) {
    const distribution = JSON.parse(data);
    if (distribution === null || typeof distribution !== "object") {
      throw new Error(`Cannot parse resources.json`);
    }
    const { scriptlets: rawScriplets, redirects: rawResources } = distribution;
    const resources = [];
    if (Array.isArray(rawResources)) {
      for (const redirect of rawResources) {
        if (isResourceValid(redirect)) {
          resources.push(redirect);
        } else {
          throw new Error(`Cannot parse redirect resource: ${JSON.stringify(redirect)}`);
        }
      }
    }
    const scriptlets = [];
    if (Array.isArray(rawScriplets)) {
      for (const scriptlet of rawScriplets) {
        if (isScriptletValid(scriptlet)) {
          scriptlets.push(scriptlet);
        } else {
          throw new Error(`Cannot parse scriptlet: ${JSON.stringify(scriptlet)}`);
        }
      }
    }
    return new _Resources({
      checksum,
      scriptlets,
      resources
    });
  }
  static copy(sourceResources) {
    const checksum = sourceResources.checksum;
    const resources = [];
    const scriptlets = [];
    for (const resource18 of sourceResources.resources) {
      resources.push(structuredClone(resource18));
    }
    for (const scriptlet of sourceResources.scriptlets) {
      scriptlets.push(structuredClone(scriptlet));
    }
    return new this({
      checksum,
      resources,
      scriptlets
    });
  }
  constructor({ checksum = "", resources = [], scriptlets = [] } = {}) {
    this.checksum = checksum;
    this.resources = resources;
    this.scriptlets = scriptlets;
    this.scriptletsCache = /* @__PURE__ */ new Map();
    this.resourcesByName = /* @__PURE__ */ new Map();
    this.scriptletsByName = /* @__PURE__ */ new Map();
    this.updateAliases();
  }
  /**
   * In case of scriptlet or resource update, you need to clear the populated caches and mappings by calling this method.
   */
  updateAliases() {
    this.scriptletsCache.clear();
    this.resourcesByName.clear();
    this.scriptletsByName.clear();
    for (const resource18 of this.resources) {
      for (const name of [resource18.name, ...resource18.aliases]) {
        if (this.resourcesByName.has(name)) {
          throw new Error(`Resource with a name or alias "${name}" already exists`);
        }
        this.resourcesByName.set(name, resource18);
      }
    }
    for (const scriptlet of this.scriptlets) {
      for (const name of [scriptlet.name, ...scriptlet.aliases]) {
        if (this.scriptletsByName.has(name)) {
          throw new Error(`Scriptlet with a name or alias "${name}" already exists`);
        }
        this.scriptletsByName.set(name, scriptlet);
      }
    }
    for (const scriptlet of this.scriptlets) {
      for (const dependencyName of scriptlet.dependencies) {
        if (!this.scriptletsByName.has(dependencyName)) {
          throw new Error(`Scriptlet with a name or alias "${scriptlet.name}" has a missing depencency "${dependencyName}"`);
        }
      }
    }
  }
  getResource(name) {
    let resource18 = this.resourcesByName.get(name);
    if (resource18 === void 0) {
      const extensionIndex = name.lastIndexOf(".");
      resource18 = getResourceForMime(extensionIndex === -1 ? name : name.slice(extensionIndex));
    }
    const { contentType, body } = resource18;
    let dataUrl;
    if (resource18.contentType.indexOf(";") !== -1) {
      dataUrl = `data:${contentType},${body}`;
    } else {
      dataUrl = `data:${contentType};base64,${btoaPolyfill(body)}`;
    }
    return { filename: resource18.name, body, contentType, dataUrl };
  }
  getScriptlet(name) {
    const scriptlet = this.getRawScriptlet(name);
    if (scriptlet === void 0) {
      return this.getSurrogate(name);
    }
    let script = this.scriptletsCache.get(scriptlet.name);
    if (script !== void 0) {
      if (script.length === 0) {
        return void 0;
      }
      return script;
    }
    const dependencies = this.getScriptletDependencies(scriptlet);
    script = assembleScript(scriptlet.body, dependencies);
    this.scriptletsCache.set(scriptlet.name, script);
    return script;
  }
  getSurrogate(name) {
    const resource18 = this.resourcesByName.get(name.endsWith(".js") ? name : `${name}.js`);
    if (resource18 === void 0 || resource18.contentType !== "application/javascript") {
      return void 0;
    }
    return resource18.body;
  }
  getScriptletCanonicalName(name) {
    return this.getRawScriptlet(name)?.name;
  }
  getRawScriptlet(name) {
    if (name.endsWith(".fn")) {
      return void 0;
    }
    return this.scriptletsByName.get(name.endsWith(".js") ? name : `${name}.js`);
  }
  getScriptletDependencies(scriptlet) {
    const dependencies = /* @__PURE__ */ new Map();
    const queue = [...scriptlet.dependencies];
    while (queue.length > 0) {
      const dependencyName = queue.pop();
      if (dependencies.has(dependencyName)) {
        continue;
      }
      const dependency = this.scriptletsByName.get(dependencyName);
      dependencies.set(dependencyName, dependency.body);
      queue.push(...dependency.dependencies);
    }
    return Array.from(dependencies.values());
  }
  getSerializedSize() {
    let estimatedSize = sizeOfASCII(this.checksum);
    estimatedSize += 2 * sizeOfByte();
    for (const { name, aliases, body: content, contentType } of this.resources) {
      estimatedSize += sizeOfASCII(name);
      estimatedSize += aliases.reduce((state, alias) => state + sizeOfASCII(alias), 2 * sizeOfByte());
      estimatedSize += sizeOfUTF8(content);
      estimatedSize += sizeOfASCII(contentType);
    }
    estimatedSize += 2 * sizeOfByte();
    for (const { name, aliases, body: content, dependencies } of this.scriptlets) {
      estimatedSize += sizeOfASCII(name);
      estimatedSize += aliases.reduce((state, alias) => state + sizeOfASCII(alias), 2 * sizeOfByte());
      estimatedSize += sizeOfUTF8(content);
      estimatedSize += sizeOfBool();
      estimatedSize += sizeOfBool();
      estimatedSize += sizeOfBool();
      estimatedSize += sizeOfBool();
      estimatedSize += dependencies.reduce((state, dependency) => state + sizeOfASCII(dependency), 2 * sizeOfByte());
    }
    return estimatedSize;
  }
  serialize(buffer) {
    buffer.pushASCII(this.checksum);
    buffer.pushUint16(this.resources.length);
    for (const { name, aliases, body: content, contentType } of this.resources) {
      buffer.pushASCII(name);
      buffer.pushUint16(aliases.length);
      for (const alias of aliases) {
        buffer.pushASCII(alias);
      }
      buffer.pushUTF8(content);
      buffer.pushASCII(contentType);
    }
    buffer.pushUint16(this.scriptlets.length);
    for (const { name, aliases, body: content, dependencies, executionWorld, requiresTrust } of this.scriptlets) {
      buffer.pushASCII(name);
      buffer.pushUint16(aliases.length);
      for (const alias of aliases) {
        buffer.pushASCII(alias);
      }
      buffer.pushUTF8(content);
      buffer.pushBool(executionWorld !== void 0);
      buffer.pushBool(executionWorld === "ISOLATED");
      buffer.pushBool(requiresTrust !== void 0);
      buffer.pushBool(requiresTrust === true);
      buffer.pushUint16(dependencies.length);
      dependencies.forEach((dependency) => buffer.pushASCII(dependency));
    }
  }
};

// node_modules/@ghostery/adblocker/dist/esm/compact-set.js
function compactTokens(tokens) {
  const sorted = tokens.sort();
  let lastIndex = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[lastIndex - 1] !== sorted[i]) {
      sorted[lastIndex++] = sorted[i];
    }
  }
  return sorted.subarray(0, lastIndex);
}
var EMPTY_UINT32_ARRAY2 = new Uint32Array(0);
function concatTypedArrays(arrays) {
  if (arrays.length === 0) {
    return EMPTY_UINT32_ARRAY2;
  }
  if (arrays.length === 1) {
    return arrays[0];
  }
  let totalSize = 0;
  for (let i = 0; i < arrays.length; i += 1) {
    totalSize += arrays[i].length;
  }
  const result = new Uint32Array(totalSize);
  let index = 0;
  for (let i = 0; i < arrays.length; i += 1) {
    const array = arrays[i];
    for (let j = 0; j < array.length; j += 1) {
      result[index++] = array[j];
    }
  }
  return result;
}

// node_modules/@ghostery/adblocker/dist/esm/engine/optimizer.js
function processRegex(r) {
  return `(?:${r.source})`;
}
function escape(s) {
  return `(?:${s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`;
}
function setWithDefault(map, key, value) {
  let bucket = map.get(key);
  if (bucket === void 0) {
    bucket = [];
    map.set(key, bucket);
  }
  bucket.push(value);
}
function groupBy(filters, criteria) {
  const grouped = /* @__PURE__ */ new Map();
  for (const filter of filters) {
    setWithDefault(grouped, criteria(filter), filter);
  }
  return Array.from(grouped.values());
}
function splitBy(filters, condition) {
  const positive = [];
  const negative = [];
  for (const filter of filters) {
    if (condition(filter)) {
      positive.push(filter);
    } else {
      negative.push(filter);
    }
  }
  return {
    negative,
    positive
  };
}
var OPTIMIZATIONS = [
  {
    description: "Remove duplicated filters by ID",
    fusion: (filters) => filters[0],
    groupByCriteria: (filter) => "" + filter.getId(),
    select: () => true
  },
  {
    description: "Group idential filter with same mask but different domains in single filters",
    fusion: (filters) => {
      const parts = [];
      const hostnames = /* @__PURE__ */ new Set();
      const notHostnames = /* @__PURE__ */ new Set();
      const entities = /* @__PURE__ */ new Set();
      const notEntities = /* @__PURE__ */ new Set();
      for (const { domains } of filters) {
        if (domains !== void 0) {
          if (domains.parts !== void 0) {
            parts.push(domains.parts);
          }
          if (domains.hostnames !== void 0) {
            for (const hash of domains.hostnames) {
              hostnames.add(hash);
            }
          }
          if (domains.entities !== void 0) {
            for (const hash of domains.entities) {
              entities.add(hash);
            }
          }
          if (domains.notHostnames !== void 0) {
            for (const hash of domains.notHostnames) {
              notHostnames.add(hash);
            }
          }
          if (domains.notEntities !== void 0) {
            for (const hash of domains.notEntities) {
              notEntities.add(hash);
            }
          }
        }
      }
      return new NetworkFilter(Object.assign({}, filters[0], {
        domains: new Domains({
          hostnames: hostnames.size !== 0 ? new Uint32Array(hostnames).sort() : void 0,
          entities: entities.size !== 0 ? new Uint32Array(entities).sort() : void 0,
          notHostnames: notHostnames.size !== 0 ? new Uint32Array(notHostnames).sort() : void 0,
          notEntities: notEntities.size !== 0 ? new Uint32Array(notEntities).sort() : void 0,
          parts: parts.length !== 0 ? parts.join(",") : void 0
        }),
        rawLine: filters[0].rawLine !== void 0 ? filters.map(({ rawLine }) => rawLine).join(" <+> ") : void 0
      }));
    },
    groupByCriteria: (filter) => filter.getHostname() + filter.getFilter() + filter.getMask() + (filter.optionValue ?? ""),
    select: (filter) => !filter.isCSP() && filter.denyallow === void 0 && filter.domains !== void 0
  },
  {
    description: "Group simple patterns, into a single filter",
    fusion: (filters) => {
      const patterns = [];
      for (const f2 of filters) {
        if (f2.isRegex()) {
          patterns.push(processRegex(f2.getRegex()));
        } else if (f2.isRightAnchor()) {
          patterns.push(`${escape(f2.getFilter())}$`);
        } else if (f2.isLeftAnchor()) {
          patterns.push(`^${escape(f2.getFilter())}`);
        } else {
          patterns.push(escape(f2.getFilter()));
        }
      }
      return new NetworkFilter(Object.assign({}, filters[0], {
        mask: setBit(filters[0].mask, NETWORK_FILTER_MASK.isRegex),
        rawLine: filters[0].rawLine !== void 0 ? filters.map(({ rawLine }) => rawLine).join(" <+> ") : void 0,
        regex: new RegExp(patterns.join("|"), "i")
      }));
    },
    groupByCriteria: (filter) => "" + (filter.getMask() & ~NETWORK_FILTER_MASK.isRegex & ~NETWORK_FILTER_MASK.isFullRegex),
    select: (filter) => filter.domains === void 0 && filter.denyallow === void 0 && !filter.isHostnameAnchor() && !filter.isRedirect() && !filter.isCSP() && !filter.isCaseSensitive
  }
];
function noopOptimizeNetwork(filters) {
  return filters;
}
function noopOptimizeCosmetic(filters) {
  return filters;
}
function optimizeNetwork(filters) {
  const fused = [];
  let toFuse = filters;
  for (const { select, fusion, groupByCriteria } of OPTIMIZATIONS) {
    const { positive, negative } = splitBy(toFuse, select);
    toFuse = negative;
    const groups = groupBy(positive, groupByCriteria);
    for (const group of groups) {
      if (group.length > 1) {
        fused.push(fusion(group));
      } else {
        toFuse.push(group[0]);
      }
    }
  }
  for (const filter of toFuse) {
    fused.push(filter);
  }
  return fused;
}

// node_modules/@ghostery/adblocker/dist/esm/engine/reverse-index.js
function nextPow2(v) {
  v--;
  v |= v >> 1;
  v |= v >> 2;
  v |= v >> 4;
  v |= v >> 8;
  v |= v >> 16;
  v++;
  return v;
}
var UID = 1;
function getNextId() {
  const id = UID;
  UID = (UID + 1) % 1e9;
  return id;
}
var EMPTY_BUCKET = Number.MAX_SAFE_INTEGER >>> 0;
var ReverseIndex = class _ReverseIndex {
  static merge(sources, config, optimize, opts) {
    if (sources.length < 2) {
      throw new Error("ReverseIndex.merge requires at least two source indexes.");
    }
    const firstSource = sources[0];
    for (const source of sources) {
      if (source.config.debug === true) {
        throw new Error("ReverseIndex.merge requires debug=false for every source.");
      }
      if (source.config.enableCompression !== firstSource.config.enableCompression) {
        throw new Error("ReverseIndex.merge requires matching compression settings.");
      }
    }
    if (config.debug === true) {
      throw new Error("ReverseIndex.merge requires debug=false for target config.");
    }
    if (config.enableCompression !== firstSource.config.enableCompression) {
      throw new Error("ReverseIndex.merge requires target config compression to match sources.");
    }
    const numberOfFilters = sources.reduce((total, source) => total + source.numberOfFilters, 0);
    if (numberOfFilters === 0) {
      return new _ReverseIndex({
        config,
        deserialize: firstSource.deserializeFilter,
        filters: [],
        optimize
      });
    }
    const hashFunc = typeof opts?.hashFunc === "function" ? opts.hashFunc : crc32;
    const filtersByHash = /* @__PURE__ */ new Map();
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      const source = sources[sourceIndex];
      const tokensByOffset = /* @__PURE__ */ new Map();
      for (let i = 1; i < source.bucketsIndex.length; i += 2) {
        const arr = tokensByOffset.get(source.bucketsIndex[i]);
        if (typeof arr === "undefined") {
          tokensByOffset.set(source.bucketsIndex[i], [source.bucketsIndex[i - 1]]);
        } else {
          arr.push(source.bucketsIndex[i - 1]);
        }
      }
      if (tokensByOffset.size !== source.numberOfFilters) {
        throw new Error(`ReverseIndex.merge cannot infer filter byte ranges for source ${sourceIndex}: ${source.numberOfFilters} filters were serialized, but only ${tokensByOffset.size} have bucket entries.`);
      }
      const aligned = Array.from(tokensByOffset.keys()).sort(function(a, b) {
        return a - b;
      });
      aligned.push(source.view.buffer.byteLength);
      for (let i = 1, hash, tokens, filter; i < aligned.length; i++) {
        hash = hashFunc(source.view.buffer, aligned[i - 1], aligned[i]);
        tokens = tokensByOffset.get(aligned[i - 1]);
        filter = filtersByHash.get(hash);
        if (typeof filter === "undefined" || filter.tokens.length < tokens.length) {
          filtersByHash.set(hash, {
            tokens: tokensByOffset.get(aligned[i - 1]),
            bytes: source.view.buffer.subarray(aligned[i - 1], aligned[i])
          });
        }
      }
    }
    let totalNumberOfIndexedTokens = 0;
    let filtersIndexSize = 0;
    for (const filter of filtersByHash.values()) {
      totalNumberOfIndexedTokens += filter.tokens.length;
      filtersIndexSize += filter.bytes.byteLength;
    }
    const bucketsIndexSize = totalNumberOfIndexedTokens * 2;
    const tokensLookupIndexSize = Math.max(2, nextPow2(totalNumberOfIndexedTokens));
    const view = StaticDataView.allocate(tokensLookupIndexSize * 4 + bucketsIndexSize * 4 + filtersIndexSize, config);
    const tokensLookupIndex = view.getUint32ArrayView(tokensLookupIndexSize);
    const bucketsIndex = view.getUint32ArrayView(bucketsIndexSize);
    const filtersIndexStart = view.getPos();
    const mask = tokensLookupIndexSize - 1;
    const suffixes = [];
    for (let i = 0; i < tokensLookupIndexSize; i += 1) {
      suffixes.push([]);
    }
    for (const filter of filtersByHash.values()) {
      const filterIndex = view.getPos();
      view.buffer.set(filter.bytes, filterIndex);
      view.setPos(filterIndex + filter.bytes.byteLength);
      for (const token of filter.tokens) {
        suffixes[token & mask].push([token, filterIndex]);
      }
    }
    let indexInBucketsIndex = 0;
    for (let i = 0; i < tokensLookupIndexSize; i += 1) {
      const filtersForMask = suffixes[i];
      tokensLookupIndex[i] = indexInBucketsIndex;
      for (const [token, filterIndex] of filtersForMask) {
        bucketsIndex[indexInBucketsIndex++] = token;
        bucketsIndex[indexInBucketsIndex++] = filterIndex;
      }
    }
    view.seekZero();
    return new _ReverseIndex({
      config,
      deserialize: firstSource.deserializeFilter,
      filters: [],
      optimize
    }).updateInternals({
      bucketsIndex,
      filtersIndexStart,
      numberOfFilters: filtersByHash.size,
      tokensLookupIndex,
      view
    });
  }
  static deserialize(buffer, deserialize4, optimize, config) {
    const tokensLookupIndexSize = buffer.getUint32();
    const bucketsIndexSize = buffer.getUint32();
    const numberOfFilters = buffer.getUint32();
    const view = StaticDataView.fromUint8Array(buffer.getBytes(
      true
      /* align */
    ), config);
    const tokensLookupIndex = view.getUint32ArrayView(tokensLookupIndexSize);
    const bucketsIndex = view.getUint32ArrayView(bucketsIndexSize);
    const filtersIndexStart = view.pos;
    view.seekZero();
    return new _ReverseIndex({
      config,
      deserialize: deserialize4,
      filters: [],
      optimize
    }).updateInternals({
      bucketsIndex,
      filtersIndexStart,
      numberOfFilters,
      tokensLookupIndex,
      view
    });
  }
  constructor({ deserialize: deserialize4, filters, optimize, config }) {
    this.bucketsIndex = EMPTY_UINT32_ARRAY;
    this.filtersIndexStart = 0;
    this.numberOfFilters = 0;
    this.tokensLookupIndex = EMPTY_UINT32_ARRAY;
    this.cache = /* @__PURE__ */ new Map();
    this.view = StaticDataView.empty(config);
    this.deserializeFilter = deserialize4;
    this.optimize = optimize;
    this.config = config;
    if (filters.length !== 0) {
      this.update(filters, void 0);
    }
  }
  /**
   * Load all filters from this index in memory (i.e.: deserialize them from
   * the byte array into NetworkFilter or CosmeticFilter instances). This is
   * mostly useful for debugging or testing purposes.
   */
  getFilters() {
    const filters = [];
    if (this.numberOfFilters === 0) {
      return filters;
    }
    this.view.setPos(this.filtersIndexStart);
    for (let i = 0; i < this.numberOfFilters; i += 1) {
      filters.push(this.deserializeFilter(this.view));
    }
    this.view.seekZero();
    return filters;
  }
  /**
   * Return an array of all the tokens currently used as keys of the "buckets index".
   */
  getTokens() {
    const tokens = /* @__PURE__ */ new Set();
    for (let i = 0; i < this.bucketsIndex.length; i += 2) {
      tokens.add(this.bucketsIndex[i]);
    }
    return new Uint32Array(tokens);
  }
  /**
   * Estimate the number of bytes needed to serialize this instance of `ReverseIndex`.
   */
  getSerializedSize() {
    return 12 + sizeOfBytes(
      this.view.buffer,
      true
      /* align */
    );
  }
  /**
   * Dump this index to `buffer`.
   */
  serialize(buffer) {
    buffer.pushUint32(this.tokensLookupIndex.length);
    buffer.pushUint32(this.bucketsIndex.length);
    buffer.pushUint32(this.numberOfFilters);
    buffer.pushBytes(
      this.view.buffer,
      true
      /* align */
    );
  }
  /**
   * Iterate on all filters found in buckets associated with the given list of
   * tokens. The callback is called on each of them. Early termination can be
   * achieved if the callback returns `false`.
   *
   * This will not check if each filter returned would match a given request but
   * is instead used as a list of potential candidates (much smaller than the
   * total set of filters; typically between 5 and 10 filters will be checked).
   */
  iterMatchingFilters(tokens, cb) {
    const requestId = getNextId();
    for (const token of tokens) {
      if (this.iterBucket(token, requestId, cb) === false) {
        return;
      }
    }
    this.iterBucket(0, requestId, cb);
  }
  /**
   * Re-create the internal data-structure of the reverse index *in-place*. It
   * needs to be called with a list of new filters and optionally a list of ids
   * (as returned by either NetworkFilter.getId() or CosmeticFilter.getId())
   * which need to be removed from the index.
   */
  update(newFilters, removedFilters) {
    if (this.cache.size !== 0) {
      this.cache.clear();
    }
    const compression = this.config.enableCompression;
    let totalNumberOfTokens = 0;
    let totalNumberOfIndexedFilters = 0;
    const filtersTokens = [];
    let bucketsIndexSize = 0;
    let estimatedBufferSize = this.view.buffer.byteLength - this.filtersIndexStart;
    let filters = this.getFilters();
    if (filters.length !== 0) {
      if (removedFilters !== void 0 && removedFilters.size !== 0) {
        filters = filters.filter((f2) => {
          if (removedFilters.has(f2.getId())) {
            estimatedBufferSize -= f2.getSerializedSize(compression);
            return false;
          }
          return true;
        });
      }
      for (const filter of newFilters) {
        estimatedBufferSize += filter.getSerializedSize(compression);
        filters.push(filter);
      }
    } else {
      filters = newFilters;
      for (const filter of newFilters) {
        estimatedBufferSize += filter.getSerializedSize(compression);
      }
    }
    if (filters.length === 0) {
      this.updateInternals({
        bucketsIndex: EMPTY_UINT32_ARRAY,
        filtersIndexStart: 0,
        numberOfFilters: 0,
        tokensLookupIndex: EMPTY_UINT32_ARRAY,
        view: StaticDataView.empty(this.config)
      });
      return;
    }
    if (this.config.debug === true) {
      filters.sort((f1, f2) => f1.getId() - f2.getId());
    }
    const histogram = new Uint32Array(Math.max(nextPow2(2 * filters.length), 256));
    for (const filter of filters) {
      const multiTokens = filter.getTokens();
      filtersTokens.push(multiTokens);
      bucketsIndexSize += 2 * multiTokens.length;
      totalNumberOfIndexedFilters += multiTokens.length;
      for (const tokens of multiTokens) {
        totalNumberOfTokens += tokens.length;
        for (const token of tokens) {
          histogram[token % histogram.length] += 1;
        }
      }
    }
    estimatedBufferSize += bucketsIndexSize * 4;
    const tokensLookupIndexSize = Math.max(2, nextPow2(totalNumberOfIndexedFilters));
    const mask = tokensLookupIndexSize - 1;
    const suffixes = [];
    for (let i = 0; i < tokensLookupIndexSize; i += 1) {
      suffixes.push([]);
    }
    estimatedBufferSize += tokensLookupIndexSize * 4;
    const buffer = StaticDataView.allocate(estimatedBufferSize, this.config);
    const tokensLookupIndex = buffer.getUint32ArrayView(tokensLookupIndexSize);
    const bucketsIndex = buffer.getUint32ArrayView(bucketsIndexSize);
    const filtersIndexStart = buffer.getPos();
    for (let i = 0; i < filtersTokens.length; i += 1) {
      const filter = filters[i];
      const multiTokens = filtersTokens[i];
      const filterIndex = buffer.pos;
      filter.serialize(buffer);
      for (const tokens of multiTokens) {
        let bestToken = 0;
        let minCount = totalNumberOfTokens + 1;
        for (const token of tokens) {
          const tokenCount = histogram[token % histogram.length];
          if (tokenCount < minCount) {
            minCount = tokenCount;
            bestToken = token;
            if (minCount === 1) {
              break;
            }
          }
        }
        suffixes[bestToken & mask].push([bestToken, filterIndex]);
      }
    }
    let indexInBucketsIndex = 0;
    for (let i = 0; i < tokensLookupIndexSize; i += 1) {
      const filtersForMask = suffixes[i];
      tokensLookupIndex[i] = indexInBucketsIndex;
      for (const [token, filterIndex] of filtersForMask) {
        bucketsIndex[indexInBucketsIndex++] = token;
        bucketsIndex[indexInBucketsIndex++] = filterIndex;
      }
    }
    buffer.seekZero();
    this.updateInternals({
      bucketsIndex,
      filtersIndexStart,
      numberOfFilters: filtersTokens.length,
      tokensLookupIndex,
      view: buffer
    });
  }
  updateInternals({ bucketsIndex, filtersIndexStart, numberOfFilters, tokensLookupIndex, view }) {
    this.bucketsIndex = bucketsIndex;
    this.filtersIndexStart = filtersIndexStart;
    this.numberOfFilters = numberOfFilters;
    this.tokensLookupIndex = tokensLookupIndex;
    this.view = view;
    view.seekZero();
    return this;
  }
  /**
   * If a bucket exists for the given token, call the callback on each filter
   * found inside. An early termination mechanism is built-in, to stop iterating
   * as soon as `false` is returned from the callback.
   */
  iterBucket(token, requestId, cb) {
    let bucket = this.config.enableInMemoryCache === true ? this.cache.get(token) : void 0;
    if (bucket === void 0) {
      const offset = token & this.tokensLookupIndex.length - 1;
      const startOfBucket = this.tokensLookupIndex[offset];
      if (startOfBucket === EMPTY_BUCKET) {
        return true;
      }
      const endOfBucket = offset === this.tokensLookupIndex.length - 1 ? this.bucketsIndex.length : this.tokensLookupIndex[offset + 1];
      const filtersIndices = [];
      for (let i = startOfBucket; i < endOfBucket; i += 2) {
        const currentToken = this.bucketsIndex[i];
        if (currentToken === token) {
          filtersIndices.push(this.bucketsIndex[i + 1]);
        }
      }
      if (filtersIndices.length === 0) {
        return true;
      }
      const filters = [];
      const view = this.view;
      for (let i = 0; i < filtersIndices.length; i += 1) {
        view.setPos(filtersIndices[i]);
        filters.push(this.deserializeFilter(view));
      }
      bucket = {
        filters: filters.length > 1 ? this.optimize(filters) : filters,
        lastRequestSeen: -1
        // safe because all ids are positive
      };
      if (this.config.enableInMemoryCache === true) {
        this.cache.set(token, bucket);
      }
    }
    if (bucket.lastRequestSeen !== requestId) {
      bucket.lastRequestSeen = requestId;
      const filters = bucket.filters;
      for (let i = 0; i < filters.length; i += 1) {
        if (cb(filters[i]) === false) {
          if (i > 0) {
            const filter = filters[i];
            filters[i] = filters[i - 1];
            filters[i - 1] = filter;
          }
          return false;
        }
      }
    }
    return true;
  }
};

// node_modules/@ghostery/adblocker/dist/esm/engine/bucket/filters.js
var FiltersContainer = class _FiltersContainer {
  static merge(sources, opts) {
    if (sources.length < 2) {
      throw new Error("FiltersContainer.merge requires at least two source containers.");
    }
    const firstSource = sources[0];
    let numberOfFilters = 0;
    for (const source of sources) {
      if (source.config.debug === true) {
        throw new Error("FiltersContainer.merge requires debug=false for every source.");
      }
      if (source.config.enableCompression !== firstSource.config.enableCompression) {
        throw new Error("FiltersContainer.merge requires matching compression settings.");
      }
      numberOfFilters += source.numberOfFilters;
    }
    if (numberOfFilters === 0) {
      return new _FiltersContainer({
        config: firstSource.config,
        deserialize: firstSource.deserialize,
        filters: []
      });
    }
    const hashFunc = typeof opts?.hashFunc === "function" ? opts.hashFunc : crc32;
    const filtersByHash = /* @__PURE__ */ new Map();
    for (const source of sources) {
      if (source.numberOfFilters === 0) {
        continue;
      }
      for (let i = 0, filterIndex, filterIndexEnd; i < source.numberOfFilters; i += 1) {
        filterIndex = source.offsets[i];
        filterIndexEnd = source.offsets[i + 1];
        filtersByHash.set(hashFunc(source.filters, filterIndex, filterIndexEnd), source.filters.subarray(filterIndex, filterIndexEnd));
      }
    }
    let filtersIndexSize = 0;
    for (const filter of filtersByHash.values()) {
      filtersIndexSize += filter.byteLength;
    }
    const view = StaticDataView.allocate(filtersIndexSize, firstSource.config);
    const offsets = new Uint32Array(filtersByHash.size + 1);
    let index = 0;
    for (const filter of filtersByHash.values()) {
      offsets[index++] = view.pos;
      view.buffer.set(filter, view.pos);
      view.setPos(view.pos + filter.byteLength);
    }
    offsets[index] = view.getPos();
    const container = new _FiltersContainer({
      config: firstSource.config,
      deserialize: firstSource.deserialize,
      filters: []
    });
    container.filters = view.subarray();
    container.offsets = offsets;
    container.numberOfFilters = filtersByHash.size;
    return container;
  }
  static deserialize(buffer, deserialize4, config) {
    const container = new _FiltersContainer({ deserialize: deserialize4, config, filters: [] });
    const numberOfFilters = buffer.getUint32();
    container.numberOfFilters = numberOfFilters;
    if (numberOfFilters !== 0) {
      container.offsets = new Uint32Array(numberOfFilters + 1);
      for (let i = 0; i < container.offsets.length; i += 1) {
        container.offsets[i] = buffer.getUint32();
      }
      const filtersIndexSize = container.offsets[numberOfFilters];
      container.filters = buffer.buffer.subarray(buffer.pos, buffer.pos + filtersIndexSize);
      buffer.setPos(buffer.pos + filtersIndexSize);
    }
    return container;
  }
  constructor({ config, deserialize: deserialize4, filters }) {
    this.deserialize = deserialize4;
    this.filters = EMPTY_UINT8_ARRAY3;
    this.offsets = EMPTY_UINT32_ARRAY;
    this.numberOfFilters = 0;
    this.config = config;
    if (filters.length !== 0) {
      this.update(filters, void 0);
    }
  }
  /**
   * Update filters based on `newFilters` and `removedFilters`.
   */
  update(newFilters, removedFilters) {
    let selected = [];
    const compression = this.config.enableCompression;
    const currentFilters = this.getFilters();
    if (currentFilters.length !== 0) {
      if (removedFilters === void 0 || removedFilters.size === 0) {
        selected = currentFilters;
      } else {
        for (const filter of currentFilters) {
          if (removedFilters.has(filter.getId()) === false) {
            selected.push(filter);
          }
        }
      }
    }
    const storedFiltersRemoved = selected.length !== currentFilters.length;
    const numberOfExistingFilters = selected.length;
    for (const filter of newFilters) {
      selected.push(filter);
    }
    const storedFiltersAdded = selected.length > numberOfExistingFilters;
    if (selected.length === 0) {
      this.filters = EMPTY_UINT8_ARRAY3;
      this.offsets = EMPTY_UINT32_ARRAY;
      this.numberOfFilters = 0;
    } else if (storedFiltersAdded === true || storedFiltersRemoved === true) {
      if (this.config.debug === true) {
        selected.sort((f1, f2) => f1.getId() - f2.getId());
      }
      let bufferSizeEstimation = 0;
      for (const filter of selected) {
        bufferSizeEstimation += filter.getSerializedSize(compression);
      }
      const buffer = StaticDataView.allocate(bufferSizeEstimation, this.config);
      const offsets = new Uint32Array(selected.length + 1);
      for (let i = 0; i < selected.length; i += 1) {
        offsets[i] = buffer.getPos();
        selected[i].serialize(buffer);
      }
      offsets[selected.length] = buffer.getPos();
      this.filters = buffer.subarray();
      this.offsets = offsets;
      this.numberOfFilters = selected.length;
    }
  }
  getSerializedSize() {
    return 4 + this.offsets.byteLength + this.filters.byteLength;
  }
  serialize(buffer) {
    buffer.pushUint32(this.numberOfFilters);
    for (const offset of this.offsets) {
      buffer.pushUint32(offset);
    }
    buffer.buffer.set(this.filters, buffer.pos);
    buffer.setPos(buffer.pos + this.filters.byteLength);
  }
  getFilters() {
    if (this.numberOfFilters === 0) {
      return [];
    }
    const filters = [];
    const buffer = StaticDataView.fromUint8Array(this.filters, this.config);
    for (let i = 0; i < this.numberOfFilters; i += 1) {
      filters.push(this.deserialize(buffer));
    }
    return filters;
  }
};

// node_modules/@ghostery/adblocker/dist/esm/engine/bucket/cosmetic.js
function createStylesheet(rules, style = DEFAULT_HIDING_STYLE) {
  if (rules.length === 0) {
    return "";
  }
  const maximumNumberOfSelectors = 1024;
  const parts = [];
  const styleStr = ` { ${style} }`;
  for (let i = 0; i < rules.length; i += maximumNumberOfSelectors) {
    let selector = rules[i];
    for (let j = i + 1, end = Math.min(rules.length, i + maximumNumberOfSelectors); j < end; j += 1) {
      selector += ",\n" + rules[j];
    }
    selector += styleStr;
    if (rules.length < maximumNumberOfSelectors) {
      return selector;
    }
    parts.push(selector);
  }
  return parts.join("\n");
}
function createStylesheetFromRulesWithCustomStyles(rules, hidingStyle = DEFAULT_HIDING_STYLE) {
  const selectorsPerStyle = /* @__PURE__ */ new Map();
  for (const rule of rules) {
    const style = rule.getStyle(hidingStyle);
    const selectors = selectorsPerStyle.get(style);
    if (selectors === void 0) {
      selectorsPerStyle.set(style, [rule.getSelector()]);
    } else {
      selectors.push(rule.getSelector());
    }
  }
  const stylesheets = [];
  const selectorsPerStyleArray = Array.from(selectorsPerStyle.entries());
  for (const [style, selectors] of selectorsPerStyleArray) {
    stylesheets.push(createStylesheet(selectors, style));
  }
  return stylesheets.join("\n\n");
}
function createStylesheetFromRules(rules, hidingStyle = DEFAULT_HIDING_STYLE) {
  const selectors = [];
  for (const rule of rules) {
    if (rule.hasCustomStyle()) {
      return createStylesheetFromRulesWithCustomStyles(rules, hidingStyle);
    }
    selectors.push(rule.selector);
  }
  return createStylesheet(selectors, hidingStyle);
}
function createLookupTokens(hostname, domain) {
  const hostnamesHashes = getHostnameHashesFromLabelsBackward(hostname, domain);
  const entitiesHashes = getEntityHashesFromLabelsBackward(hostname, domain);
  const tokens = new Uint32Array(hostnamesHashes.length + entitiesHashes.length);
  let index = 0;
  for (const hash of hostnamesHashes) {
    tokens[index++] = hash;
  }
  for (const hash of entitiesHashes) {
    tokens[index++] = hash;
  }
  return tokens;
}
var CosmeticFilterBucket = class _CosmeticFilterBucket {
  static deserialize(buffer, config) {
    const bucket = new _CosmeticFilterBucket({ config });
    bucket.genericRules = FiltersContainer.deserialize(buffer, CosmeticFilter.deserialize, config);
    bucket.classesIndex = ReverseIndex.deserialize(buffer, CosmeticFilter.deserialize, noopOptimizeCosmetic, config);
    bucket.hostnameIndex = ReverseIndex.deserialize(buffer, CosmeticFilter.deserialize, noopOptimizeCosmetic, config);
    bucket.hrefsIndex = ReverseIndex.deserialize(buffer, CosmeticFilter.deserialize, noopOptimizeCosmetic, config);
    bucket.idsIndex = ReverseIndex.deserialize(buffer, CosmeticFilter.deserialize, noopOptimizeCosmetic, config);
    bucket.unhideIndex = ReverseIndex.deserialize(buffer, CosmeticFilter.deserialize, noopOptimizeCosmetic, config);
    return bucket;
  }
  constructor({ filters = [], config }) {
    this.genericRules = new FiltersContainer({
      config,
      deserialize: CosmeticFilter.deserialize,
      filters: []
    });
    this.classesIndex = new ReverseIndex({
      config,
      deserialize: CosmeticFilter.deserialize,
      filters: [],
      optimize: noopOptimizeCosmetic
    });
    this.hostnameIndex = new ReverseIndex({
      config,
      deserialize: CosmeticFilter.deserialize,
      filters: [],
      optimize: noopOptimizeCosmetic
    });
    this.hrefsIndex = new ReverseIndex({
      config,
      deserialize: CosmeticFilter.deserialize,
      filters: [],
      optimize: noopOptimizeCosmetic
    });
    this.idsIndex = new ReverseIndex({
      config,
      deserialize: CosmeticFilter.deserialize,
      filters: [],
      optimize: noopOptimizeCosmetic
    });
    this.unhideIndex = new ReverseIndex({
      config,
      deserialize: CosmeticFilter.deserialize,
      filters: [],
      optimize: noopOptimizeCosmetic
    });
    this.baseStylesheet = null;
    this.extraGenericRules = null;
    if (filters.length !== 0) {
      this.update(filters, void 0, config);
    }
  }
  getFilters() {
    const filters = [];
    return filters.concat(this.genericRules.getFilters(), this.classesIndex.getFilters(), this.hostnameIndex.getFilters(), this.hrefsIndex.getFilters(), this.idsIndex.getFilters(), this.unhideIndex.getFilters());
  }
  update(newFilters, removedFilters, config) {
    const classSelectors = [];
    const genericHideRules = [];
    const hostnameSpecificRules = [];
    const hrefSelectors = [];
    const idSelectors = [];
    const unHideRules = [];
    for (const rule of newFilters) {
      if (rule.isUnhide()) {
        unHideRules.push(rule);
      } else if (rule.isGenericHide()) {
        if (rule.isClassSelector()) {
          classSelectors.push(rule);
        } else if (rule.isIdSelector()) {
          idSelectors.push(rule);
        } else if (rule.isHrefSelector()) {
          hrefSelectors.push(rule);
        } else {
          genericHideRules.push(rule);
        }
      } else if (rule.isExtended() === false || config.loadExtendedSelectors === true) {
        hostnameSpecificRules.push(rule);
      }
    }
    this.genericRules.update(genericHideRules, removedFilters);
    this.classesIndex.update(classSelectors, removedFilters);
    this.hostnameIndex.update(hostnameSpecificRules, removedFilters);
    this.hrefsIndex.update(hrefSelectors, removedFilters);
    this.idsIndex.update(idSelectors, removedFilters);
    this.unhideIndex.update(unHideRules, removedFilters);
  }
  getSerializedSize() {
    return this.genericRules.getSerializedSize() + this.classesIndex.getSerializedSize() + this.hostnameIndex.getSerializedSize() + this.hrefsIndex.getSerializedSize() + this.idsIndex.getSerializedSize() + this.unhideIndex.getSerializedSize();
  }
  serialize(buffer) {
    this.genericRules.serialize(buffer);
    this.classesIndex.serialize(buffer);
    this.hostnameIndex.serialize(buffer);
    this.hrefsIndex.serialize(buffer);
    this.idsIndex.serialize(buffer);
    this.unhideIndex.serialize(buffer);
  }
  /**
   * Request cosmetics and scripts to inject in a page.
   */
  getCosmeticsFilters({
    domain,
    hostname,
    ancestors = [],
    classes = [],
    hrefs = [],
    ids = [],
    allowGenericHides = true,
    allowSpecificHides = true,
    // Allows to specify which rules to return
    getRulesFromDOM = true,
    getRulesFromHostname = true,
    isFilterExcluded
  }) {
    const hostnameTokens = createLookupTokens(hostname, domain);
    const combinedHostnameTokens = Uint32Array.from([
      ...hostnameTokens,
      ...ancestors.flatMap((ancestor) => Array.from(createLookupTokens(ancestor.hostname, ancestor.domain)))
    ]);
    const filters = [];
    if (getRulesFromHostname === true) {
      this.hostnameIndex.iterMatchingFilters(combinedHostnameTokens, (filter) => {
        if ((allowSpecificHides === true || filter.isScriptInject() === true) && filter.match(hostname, domain, ancestors) && !isFilterExcluded?.(filter)) {
          filters.push(filter);
        }
        return true;
      });
    }
    if (allowGenericHides === true && getRulesFromHostname === true) {
      const genericRules = this.getGenericRules();
      for (const filter of genericRules) {
        if (filter.match(hostname, domain) === true && !isFilterExcluded?.(filter)) {
          filters.push(filter);
        }
      }
    }
    if (allowGenericHides === true && getRulesFromDOM === true && classes.length !== 0) {
      this.classesIndex.iterMatchingFilters(hashStrings(classes), (filter) => {
        if (filter.match(hostname, domain) && !isFilterExcluded?.(filter)) {
          filters.push(filter);
        }
        return true;
      });
    }
    if (allowGenericHides === true && getRulesFromDOM === true && ids.length !== 0) {
      this.idsIndex.iterMatchingFilters(hashStrings(ids), (filter) => {
        if (filter.match(hostname, domain) && !isFilterExcluded?.(filter)) {
          filters.push(filter);
        }
        return true;
      });
    }
    if (allowGenericHides === true && getRulesFromDOM === true && hrefs.length !== 0) {
      this.hrefsIndex.iterMatchingFilters(compactTokens(concatTypedArrays(hrefs.map((href) => tokenizeNoSkip(href)))), (filter) => {
        if (filter.match(hostname, domain) && !isFilterExcluded?.(filter)) {
          filters.push(filter);
        }
        return true;
      });
    }
    const unhides = [];
    if (filters.length !== 0) {
      this.unhideIndex.iterMatchingFilters(combinedHostnameTokens, (filter) => {
        if (filter.match(hostname, domain, ancestors) && !isFilterExcluded?.(filter)) {
          unhides.push(filter);
        }
        return true;
      });
    }
    return {
      filters,
      unhides
    };
  }
  getStylesheetsFromFilters({ filters, extendedFilters }, { getBaseRules, allowGenericHides, hidingStyle = DEFAULT_HIDING_STYLE }) {
    let stylesheet = getBaseRules === false || allowGenericHides === false ? "" : this.getBaseStylesheet();
    if (hidingStyle !== DEFAULT_HIDING_STYLE) {
      stylesheet = stylesheet.replace(DEFAULT_HIDING_STYLE, hidingStyle);
    }
    if (filters.length !== 0) {
      if (stylesheet.length !== 0) {
        stylesheet += "\n\n";
      }
      stylesheet += createStylesheetFromRules(filters, hidingStyle);
    }
    const extended = [];
    if (extendedFilters.length !== 0) {
      const extendedStyles = /* @__PURE__ */ new Map();
      for (const filter of extendedFilters) {
        const asts = filter.getASTComponents();
        if (asts !== void 0) {
          const attribute = asts.directive === null ? filter.getStyleAttributeHash() : void 0;
          if (attribute !== void 0) {
            extendedStyles.set(filter.getStyle(hidingStyle), attribute);
          }
          extended.push({
            id: filter.getId(),
            ast: asts.element,
            attribute,
            directive: asts.directive || void 0
          });
        }
      }
      if (extendedStyles.size !== 0) {
        if (stylesheet.length !== 0) {
          stylesheet += "\n\n";
        }
        stylesheet += [...extendedStyles.entries()].map(([style, attribute]) => `[${attribute}] { ${style} }`).join("\n\n");
      }
    }
    return { stylesheet, extended };
  }
  /**
   * Return the list of filters which can potentially be un-hidden by another
   * rule currently contained in the cosmetic bucket.
   */
  getGenericRules() {
    if (this.extraGenericRules === null) {
      return this.lazyPopulateGenericRulesCache().genericRules;
    }
    return this.extraGenericRules;
  }
  /**
   * The base stylesheet is made of generic filters (not specific to any
   * hostname) which cannot be hidden (i.e.: there is currently no rule which
   * might hide their selector). This means that it will never change and is
   * the same for all sites. We generate it once and re-use it any-time we want
   * to inject it.
   */
  getBaseStylesheet() {
    if (this.baseStylesheet === null) {
      return this.lazyPopulateGenericRulesCache().baseStylesheet;
    }
    return this.baseStylesheet;
  }
  /**
   * This is used to lazily generate both the list of generic rules which can
   * *potentially be un-hidden* (i.e.: there exists at least one unhide rule
   * for the selector) and a stylesheet containing all selectors which cannot
   * be un-hidden. Since this list will not change between updates we can
   * generate once and use many times.
   */
  lazyPopulateGenericRulesCache() {
    if (this.baseStylesheet === null || this.extraGenericRules === null) {
      const unHideRules = this.unhideIndex.getFilters();
      const canBeHiddenSelectors = /* @__PURE__ */ new Set();
      for (const rule of unHideRules) {
        canBeHiddenSelectors.add(rule.getSelector());
      }
      const genericRules = this.genericRules.getFilters();
      const cannotBeHiddenRules = [];
      const canBeHiddenRules = [];
      for (const rule of genericRules) {
        if (rule.hasCustomStyle() || rule.isScriptInject() || rule.hasHostnameConstraint() || canBeHiddenSelectors.has(rule.getSelector())) {
          canBeHiddenRules.push(rule);
        } else {
          cannotBeHiddenRules.push(rule);
        }
      }
      this.baseStylesheet = createStylesheetFromRules(cannotBeHiddenRules);
      this.extraGenericRules = canBeHiddenRules;
    }
    return {
      baseStylesheet: this.baseStylesheet,
      genericRules: this.extraGenericRules
    };
  }
};

// node_modules/@ghostery/adblocker/dist/esm/engine/bucket/network.js
var NetworkFilterBucket = class _NetworkFilterBucket {
  static deserialize(buffer, config) {
    const bucket = new _NetworkFilterBucket({ config });
    bucket.index = ReverseIndex.deserialize(buffer, NetworkFilter.deserialize, config.enableOptimizations ? optimizeNetwork : noopOptimizeNetwork, config);
    bucket.badFilters = FiltersContainer.deserialize(buffer, NetworkFilter.deserialize, config);
    return bucket;
  }
  constructor({ filters = [], config }) {
    this.index = new ReverseIndex({
      config,
      deserialize: NetworkFilter.deserialize,
      filters: [],
      optimize: config.enableOptimizations ? optimizeNetwork : noopOptimizeNetwork
    });
    this.badFiltersIds = null;
    this.badFilters = new FiltersContainer({
      config,
      deserialize: NetworkFilter.deserialize,
      filters: []
    });
    if (filters.length !== 0) {
      this.update(filters, void 0);
    }
  }
  getFilters() {
    const filters = [];
    return filters.concat(this.badFilters.getFilters(), this.index.getFilters());
  }
  update(newFilters, removedFilters) {
    const badFilters = [];
    const remaining = [];
    for (const filter of newFilters) {
      if (filter.isBadFilter()) {
        badFilters.push(filter);
      } else {
        remaining.push(filter);
      }
    }
    this.badFilters.update(badFilters, removedFilters);
    this.index.update(remaining, removedFilters);
    this.badFiltersIds = null;
  }
  getSerializedSize() {
    return this.badFilters.getSerializedSize() + this.index.getSerializedSize();
  }
  serialize(buffer) {
    this.index.serialize(buffer);
    this.badFilters.serialize(buffer);
  }
  matchAll(request, isFilterExcluded) {
    const filters = [];
    this.index.iterMatchingFilters(request.getTokens(), (filter) => {
      if (filter.match(request) && this.isFilterDisabled(filter) === false && !isFilterExcluded?.(filter)) {
        filters.push(filter);
      }
      return true;
    });
    return filters;
  }
  match(request, isFilterExcluded) {
    let match;
    this.index.iterMatchingFilters(request.getTokens(), (filter) => {
      if (filter.match(request) && this.isFilterDisabled(filter) === false && !isFilterExcluded?.(filter)) {
        match = filter;
        return false;
      }
      return true;
    });
    return match;
  }
  /**
   * Given a matching filter, check if it is disabled by a $badfilter.
   */
  isFilterDisabled(filter) {
    if (this.badFiltersIds === null) {
      const badFilters = this.badFilters.getFilters();
      if (badFilters.length === 0) {
        return false;
      }
      const badFiltersIds = /* @__PURE__ */ new Set();
      for (const badFilter of badFilters) {
        badFiltersIds.add(badFilter.getIdWithoutBadFilter());
      }
      this.badFiltersIds = badFiltersIds;
    }
    return this.badFiltersIds.has(filter.getId());
  }
};

// node_modules/@ghostery/adblocker/dist/esm/engine/bucket/html.js
var HTMLBucket = class _HTMLBucket {
  static deserialize(buffer, config) {
    const bucket = new _HTMLBucket({ config });
    bucket.networkIndex = ReverseIndex.deserialize(buffer, NetworkFilter.deserialize, config.enableOptimizations ? optimizeNetwork : noopOptimizeNetwork, config);
    bucket.exceptionsIndex = ReverseIndex.deserialize(buffer, NetworkFilter.deserialize, config.enableOptimizations ? optimizeNetwork : noopOptimizeNetwork, config);
    bucket.cosmeticIndex = ReverseIndex.deserialize(buffer, CosmeticFilter.deserialize, noopOptimizeCosmetic, config);
    bucket.unhideIndex = ReverseIndex.deserialize(buffer, CosmeticFilter.deserialize, noopOptimizeCosmetic, config);
    return bucket;
  }
  constructor({ filters = [], config }) {
    this.config = config;
    this.networkIndex = new ReverseIndex({
      config,
      deserialize: NetworkFilter.deserialize,
      filters: [],
      optimize: config.enableOptimizations ? optimizeNetwork : noopOptimizeNetwork
    });
    this.exceptionsIndex = new ReverseIndex({
      config,
      deserialize: NetworkFilter.deserialize,
      filters: [],
      optimize: config.enableOptimizations ? optimizeNetwork : noopOptimizeNetwork
    });
    this.cosmeticIndex = new ReverseIndex({
      config,
      deserialize: CosmeticFilter.deserialize,
      filters: [],
      optimize: noopOptimizeCosmetic
    });
    this.unhideIndex = new ReverseIndex({
      config,
      deserialize: CosmeticFilter.deserialize,
      filters: [],
      optimize: noopOptimizeCosmetic
    });
    if (filters.length !== 0) {
      this.update(filters, void 0);
    }
  }
  update(newFilters, removedFilters) {
    const networkFilters = [];
    const exceptionFilters = [];
    const cosmeticFilters = [];
    const unhideFilters = [];
    for (const filter of newFilters) {
      if (filter.isNetworkFilter()) {
        if (filter.isException()) {
          exceptionFilters.push(filter);
        } else {
          networkFilters.push(filter);
        }
      } else if (filter.isCosmeticFilter()) {
        if (filter.isUnhide()) {
          unhideFilters.push(filter);
        } else {
          cosmeticFilters.push(filter);
        }
      }
    }
    this.networkIndex.update(networkFilters, removedFilters);
    this.exceptionsIndex.update(exceptionFilters, removedFilters);
    this.cosmeticIndex.update(cosmeticFilters, removedFilters);
    this.unhideIndex.update(unhideFilters, removedFilters);
  }
  serialize(buffer) {
    this.networkIndex.serialize(buffer);
    this.exceptionsIndex.serialize(buffer);
    this.cosmeticIndex.serialize(buffer);
    this.unhideIndex.serialize(buffer);
  }
  getSerializedSize() {
    return this.networkIndex.getSerializedSize() + this.exceptionsIndex.getSerializedSize() + this.cosmeticIndex.getSerializedSize() + this.unhideIndex.getSerializedSize();
  }
  getHTMLFilters(request, isFilterExcluded) {
    const networkFilters = [];
    const cosmeticFilters = [];
    const exceptions = [];
    const unhides = [];
    if (this.config.loadNetworkFilters === true) {
      this.networkIndex.iterMatchingFilters(request.getTokens(), (filter) => {
        if (filter.match(request) && !isFilterExcluded?.(filter)) {
          networkFilters.push(filter);
        }
        return true;
      });
    }
    if (networkFilters.length !== 0) {
      this.exceptionsIndex.iterMatchingFilters(request.getTokens(), (filter) => {
        if (filter.match(request) && !isFilterExcluded?.(filter)) {
          exceptions.push(filter);
        }
        return true;
      });
    }
    if (this.config.loadCosmeticFilters === true && request.isMainFrame()) {
      const { hostname, domain = "" } = request;
      const hostnameTokens = createLookupTokens(hostname, domain);
      this.cosmeticIndex.iterMatchingFilters(hostnameTokens, (filter) => {
        if (filter.match(hostname, domain) && !isFilterExcluded?.(filter)) {
          cosmeticFilters.push(filter);
        }
        return true;
      });
      if (cosmeticFilters.length !== 0) {
        this.unhideIndex.iterMatchingFilters(hostnameTokens, (rule) => {
          if (rule.match(hostname, domain) && !isFilterExcluded?.(rule)) {
            unhides.push(rule);
          }
          return true;
        });
      }
    }
    return {
      networkFilters,
      cosmeticFilters,
      unhides,
      exceptions
    };
  }
  getFilters() {
    const filters = [];
    return filters.concat(this.networkIndex.getFilters(), this.exceptionsIndex.getFilters(), this.cosmeticIndex.getFilters(), this.unhideIndex.getFilters());
  }
};

// node_modules/@ghostery/adblocker/dist/esm/engine/map.js
var EMPTY_BUCKET2 = Number.MAX_SAFE_INTEGER >>> 0;
var CompactMap = class _CompactMap {
  static deserialize(buffer, deserialize4) {
    const tokensLookupIndexSize = buffer.getUint32();
    const bucketsIndexSize = buffer.getUint32();
    const numberOfValues = buffer.getUint32();
    const view = StaticDataView.fromUint8Array(buffer.getBytes(
      true
      /* align */
    ), {
      enableCompression: false
    });
    const tokensLookupIndex = view.getUint32ArrayView(tokensLookupIndexSize);
    const bucketsIndex = view.getUint32ArrayView(bucketsIndexSize);
    const valuesIndexStart = view.pos;
    view.seekZero();
    return new _CompactMap({
      deserialize: deserialize4,
      // Left empty on purpose since we don't need these to deserialize (all
      // the data is already in the serialized data).
      values: [],
      getKeys: () => [],
      getSerializedSize: () => 0,
      serialize: () => {
      }
    }).updateInternals({
      bucketsIndex,
      valuesIndexStart,
      numberOfValues,
      tokensLookupIndex,
      view
    });
  }
  constructor({ serialize: serialize4, deserialize: deserialize4, getKeys: getKeys2, getSerializedSize: getSerializedSize4, values }) {
    this.cache = /* @__PURE__ */ new Map();
    this.bucketsIndex = EMPTY_UINT32_ARRAY;
    this.tokensLookupIndex = EMPTY_UINT32_ARRAY;
    this.valuesIndexStart = 0;
    this.numberOfValues = 0;
    this.view = StaticDataView.empty({ enableCompression: false });
    this.deserializeValue = deserialize4;
    if (values.length !== 0) {
      const patternsKeys = [];
      let bucketsIndexSize = 0;
      let estimatedBufferSize = 0;
      for (const value of values) {
        estimatedBufferSize += getSerializedSize4(value);
      }
      if (values.length === 0) {
        this.updateInternals({
          bucketsIndex: EMPTY_UINT32_ARRAY,
          valuesIndexStart: 0,
          numberOfValues: 0,
          tokensLookupIndex: EMPTY_UINT32_ARRAY,
          view: StaticDataView.empty({ enableCompression: false })
        });
        return;
      }
      for (const value of values) {
        const keys = getKeys2(value);
        patternsKeys.push(keys);
        bucketsIndexSize += 2 * keys.length;
      }
      estimatedBufferSize += bucketsIndexSize * 4;
      const tokensLookupIndexSize = Math.max(2, nextPow2(values.length));
      const mask = tokensLookupIndexSize - 1;
      const suffixes = [];
      for (let i = 0; i < tokensLookupIndexSize; i += 1) {
        suffixes.push([]);
      }
      estimatedBufferSize += tokensLookupIndexSize * 4;
      const buffer = StaticDataView.allocate(estimatedBufferSize, { enableCompression: false });
      const tokensLookupIndex = buffer.getUint32ArrayView(tokensLookupIndexSize);
      const bucketsIndex = buffer.getUint32ArrayView(bucketsIndexSize);
      const valuesIndexStart = buffer.getPos();
      for (let i = 0; i < patternsKeys.length; i += 1) {
        const value = values[i];
        const keys = patternsKeys[i];
        const valueIndex = buffer.pos;
        serialize4(value, buffer);
        for (const key of keys) {
          suffixes[key & mask].push([key, valueIndex]);
        }
      }
      let indexInBucketsIndex = 0;
      for (let i = 0; i < tokensLookupIndexSize; i += 1) {
        const valuesForMask = suffixes[i];
        tokensLookupIndex[i] = indexInBucketsIndex;
        for (const [token, valueIndex] of valuesForMask) {
          bucketsIndex[indexInBucketsIndex++] = token;
          bucketsIndex[indexInBucketsIndex++] = valueIndex;
        }
      }
      this.updateInternals({
        bucketsIndex,
        valuesIndexStart,
        numberOfValues: patternsKeys.length,
        tokensLookupIndex,
        view: buffer
      });
    }
  }
  updateInternals({ bucketsIndex, valuesIndexStart, numberOfValues, tokensLookupIndex, view }) {
    this.bucketsIndex = bucketsIndex;
    this.valuesIndexStart = valuesIndexStart;
    this.numberOfValues = numberOfValues;
    this.tokensLookupIndex = tokensLookupIndex;
    this.view = view;
    view.seekZero();
    return this;
  }
  getValues() {
    const values = [];
    if (this.numberOfValues === 0) {
      return values;
    }
    this.view.setPos(this.valuesIndexStart);
    for (let i = 0; i < this.numberOfValues; i += 1) {
      values.push(this.deserializeValue(this.view));
    }
    this.view.seekZero();
    return values;
  }
  /**
   * Estimate the number of bytes needed to serialize this instance of `Map`.
   */
  getSerializedSize() {
    return 12 + sizeOfBytes(
      this.view.buffer,
      true
      /* align */
    );
  }
  /**
   * Dump this index to `buffer`.
   */
  serialize(buffer) {
    buffer.pushUint32(this.tokensLookupIndex.length);
    buffer.pushUint32(this.bucketsIndex.length);
    buffer.pushUint32(this.numberOfValues);
    buffer.pushBytes(
      this.view.buffer,
      true
      /* align */
    );
  }
  get(key) {
    const cachedValues = this.cache.get(key);
    if (cachedValues !== void 0) {
      return cachedValues;
    }
    const offset = key & this.tokensLookupIndex.length - 1;
    const startOfBucket = this.tokensLookupIndex[offset];
    if (startOfBucket === EMPTY_BUCKET2) {
      return [];
    }
    const endOfBucket = offset === this.tokensLookupIndex.length - 1 ? this.bucketsIndex.length : this.tokensLookupIndex[offset + 1];
    const valuesIndices = [];
    for (let i = startOfBucket; i < endOfBucket; i += 2) {
      const currentToken = this.bucketsIndex[i];
      if (currentToken === key) {
        valuesIndices.push(this.bucketsIndex[i + 1]);
      }
    }
    if (valuesIndices.length === 0) {
      return [];
    }
    const values = [];
    const view = this.view;
    for (let i = 0; i < valuesIndices.length; i += 1) {
      view.setPos(valuesIndices[i]);
      values.push(this.deserializeValue(view));
    }
    this.cache.set(key, values);
    return values;
  }
};

// node_modules/@ghostery/adblocker/dist/esm/engine/metadata/categories.js
function isValid(category) {
  if (category === null) {
    return false;
  }
  if (typeof category !== "object") {
    return false;
  }
  const { key, name, color, description } = category;
  if (typeof key !== "string") {
    return false;
  }
  if (typeof name !== "string") {
    return false;
  }
  if (typeof color !== "string") {
    return false;
  }
  if (typeof description !== "string") {
    return false;
  }
  return true;
}
function getKey(category) {
  return fastHash(category.key);
}
function getSerializedSize(category) {
  return sizeOfUTF8(category.key) + sizeOfUTF8(category.name) + sizeOfUTF8(category.color) + sizeOfUTF8(category.description);
}
function serialize(category, view) {
  view.pushUTF8(category.key);
  view.pushUTF8(category.name);
  view.pushUTF8(category.color);
  view.pushUTF8(category.description);
}
function deserialize(view) {
  return {
    key: view.getUTF8(),
    name: view.getUTF8(),
    color: view.getUTF8(),
    description: view.getUTF8()
  };
}
function createMap(categories) {
  return new CompactMap({
    getSerializedSize,
    getKeys: (category) => [getKey(category)],
    serialize,
    deserialize,
    values: categories
  });
}

// node_modules/@ghostery/adblocker/dist/esm/engine/metadata/organizations.js
function isValid2(organization) {
  if (organization === null) {
    return false;
  }
  if (typeof organization !== "object") {
    return false;
  }
  const { key, name, description, country, website_url: websiteUrl, privacy_policy_url: privacyPolicyUrl, privacy_contact: privacyContact, ghostery_id: ghosteryId } = organization;
  if (typeof key !== "string") {
    return false;
  }
  if (typeof name !== "string") {
    return false;
  }
  if (description !== null && typeof description !== "string") {
    return false;
  }
  if (country !== null && typeof country !== "string") {
    return false;
  }
  if (websiteUrl !== null && typeof websiteUrl !== "string") {
    return false;
  }
  if (privacyPolicyUrl !== null && typeof privacyPolicyUrl !== "string") {
    return false;
  }
  if (privacyContact !== null && typeof privacyContact !== "string") {
    return false;
  }
  if (ghosteryId !== null && typeof ghosteryId !== "string") {
    return false;
  }
  return true;
}
function getKey2(organization) {
  return fastHash(organization.key);
}
function getSerializedSize2(organization) {
  return sizeOfUTF8(organization.key) + sizeOfUTF8(organization.name) + sizeOfUTF8(organization.description || "") + sizeOfUTF8(organization.website_url || "") + sizeOfUTF8(organization.country || "") + sizeOfUTF8(organization.privacy_policy_url || "") + sizeOfUTF8(organization.privacy_contact || "") + sizeOfUTF8(organization.ghostery_id || "");
}
function serialize2(organization, view) {
  view.pushUTF8(organization.key);
  view.pushUTF8(organization.name);
  view.pushUTF8(organization.description || "");
  view.pushUTF8(organization.website_url || "");
  view.pushUTF8(organization.country || "");
  view.pushUTF8(organization.privacy_policy_url || "");
  view.pushUTF8(organization.privacy_contact || "");
  view.pushUTF8(organization.ghostery_id || "");
}
function deserialize2(view) {
  return {
    key: view.getUTF8(),
    name: view.getUTF8(),
    description: view.getUTF8() || null,
    website_url: view.getUTF8() || null,
    country: view.getUTF8() || null,
    privacy_policy_url: view.getUTF8() || null,
    privacy_contact: view.getUTF8() || null,
    ghostery_id: view.getUTF8() || null
  };
}
function createMap2(organizations) {
  return new CompactMap({
    getSerializedSize: getSerializedSize2,
    getKeys: (organization) => [getKey2(organization)],
    serialize: serialize2,
    deserialize: deserialize2,
    values: organizations
  });
}

// node_modules/@ghostery/adblocker/dist/esm/engine/metadata/patterns.js
function isValid3(pattern) {
  if (pattern === null) {
    return false;
  }
  if (typeof pattern !== "object") {
    return false;
  }
  const { key, name, category, organization, alias, website_url: websiteUrl, domains, filters } = pattern;
  if (typeof key !== "string") {
    return false;
  }
  if (typeof name !== "string") {
    return false;
  }
  if (typeof category !== "string") {
    return false;
  }
  if (organization !== null && typeof organization !== "string") {
    return false;
  }
  if (typeof alias !== "string" && alias !== null) {
    return false;
  }
  if (websiteUrl !== null && typeof websiteUrl !== "string") {
    return false;
  }
  if (!Array.isArray(domains) || !domains.every((domain) => typeof domain === "string")) {
    return false;
  }
  if (!Array.isArray(filters) || !filters.every((filter) => typeof filter === "string")) {
    return false;
  }
  return true;
}
function getKeys(pattern) {
  const keys = [];
  for (const filter of pattern.filters) {
    const parsedFilter = NetworkFilter.parse(filter);
    if (parsedFilter !== null) {
      keys.push(parsedFilter.getId());
    }
  }
  for (const domain of pattern.domains) {
    const parsedFilter = NetworkFilter.parse(`||${domain}^`);
    if (parsedFilter !== null) {
      keys.push(parsedFilter.getId());
    }
  }
  return [...new Set(keys)];
}
function getSerializedSize3(pattern) {
  let sizeOfDomains = sizeOfLength(pattern.domains.length);
  for (const domain of pattern.domains) {
    sizeOfDomains += sizeOfUTF8(domain);
  }
  let sizeOfFilters = sizeOfLength(pattern.filters.length);
  for (const filter of pattern.filters) {
    sizeOfFilters += sizeOfUTF8(filter);
  }
  return sizeOfUTF8(pattern.key) + sizeOfUTF8(pattern.name) + sizeOfUTF8(pattern.category) + sizeOfUTF8(pattern.organization || "") + sizeOfUTF8(pattern.alias || "") + sizeOfUTF8(pattern.website_url || "") + sizeOfUTF8(pattern.ghostery_id || "") + sizeOfDomains + sizeOfFilters;
}
function serialize3(pattern, view) {
  view.pushUTF8(pattern.key);
  view.pushUTF8(pattern.name);
  view.pushUTF8(pattern.category);
  view.pushUTF8(pattern.organization || "");
  view.pushUTF8(pattern.alias || "");
  view.pushUTF8(pattern.website_url || "");
  view.pushUTF8(pattern.ghostery_id || "");
  view.pushLength(pattern.domains.length);
  for (const domain of pattern.domains) {
    view.pushUTF8(domain);
  }
  view.pushLength(pattern.filters.length);
  for (const filter of pattern.filters) {
    view.pushUTF8(filter);
  }
}
function deserialize3(view) {
  const key = view.getUTF8();
  const name = view.getUTF8();
  const category = view.getUTF8();
  const organization = view.getUTF8() || null;
  const alias = view.getUTF8() || null;
  const website_url = view.getUTF8() || null;
  const ghostery_id = view.getUTF8() || null;
  const numberOfDomains = view.getLength();
  const domains = [];
  for (let i = 0; i < numberOfDomains; i += 1) {
    domains.push(view.getUTF8());
  }
  const numberOfFilters = view.getLength();
  const filters = [];
  for (let i = 0; i < numberOfFilters; i += 1) {
    filters.push(view.getUTF8());
  }
  return {
    key,
    name,
    category,
    organization,
    alias,
    website_url,
    ghostery_id,
    domains,
    filters
  };
}
function createMap3(patterns) {
  return new CompactMap({
    getSerializedSize: getSerializedSize3,
    getKeys,
    serialize: serialize3,
    deserialize: deserialize3,
    values: patterns
  });
}

// node_modules/@ghostery/adblocker/dist/esm/engine/metadata.js
var Metadata = class _Metadata {
  static deserialize(buffer) {
    const metadata = new _Metadata(null);
    metadata.categories = CompactMap.deserialize(buffer, deserialize);
    metadata.organizations = CompactMap.deserialize(buffer, deserialize2);
    metadata.patterns = CompactMap.deserialize(buffer, deserialize3);
    return metadata;
  }
  constructor(rawTrackerDB) {
    if (!rawTrackerDB) {
      this.organizations = createMap2([]);
      this.categories = createMap([]);
      this.patterns = createMap3([]);
      return;
    }
    const { patterns: rawPatterns, organizations: rawOrganizations, categories: rawCategories } = rawTrackerDB;
    const categories = [];
    if (typeof rawCategories === "object") {
      for (const [key, category] of Object.entries(rawCategories)) {
        if (typeof category !== "object") {
          continue;
        }
        const categoryWithKey = { key, ...category };
        if (isValid(categoryWithKey)) {
          categories.push(categoryWithKey);
        } else {
          console.error("?? invalid category", categoryWithKey);
        }
      }
    }
    this.categories = createMap(categories);
    const organizations = [];
    if (typeof rawOrganizations === "object") {
      for (const [key, organization] of Object.entries(rawOrganizations)) {
        if (typeof organization !== "object") {
          continue;
        }
        const organizationWithKey = { key, ...organization };
        if (isValid2(organizationWithKey)) {
          organizations.push(organizationWithKey);
        } else {
          console.error("?? invalid organization", organizationWithKey);
        }
      }
    }
    this.organizations = createMap2(organizations);
    const patterns = [];
    if (typeof rawPatterns === "object") {
      for (const [key, pattern] of Object.entries(rawPatterns)) {
        if (typeof pattern !== "object") {
          continue;
        }
        const patternWithKey = { key, ...pattern };
        if (isValid3(patternWithKey)) {
          patterns.push(patternWithKey);
        } else {
          console.error("?? invalid pattern", patternWithKey);
        }
      }
    }
    this.patterns = createMap3(patterns);
  }
  getCategories() {
    return this.categories.getValues();
  }
  getOrganizations() {
    return this.organizations.getValues();
  }
  getPatterns() {
    return this.patterns.getValues();
  }
  /**
   * Estimate the total serialized size of this Metadata instance.
   */
  getSerializedSize() {
    return this.categories.getSerializedSize() + this.organizations.getSerializedSize() + this.patterns.getSerializedSize();
  }
  /**
   * Serialize this instance of Metadata into `view`
   */
  serialize(buffer) {
    this.categories.serialize(buffer);
    this.organizations.serialize(buffer);
    this.patterns.serialize(buffer);
  }
  /**
   * Given an instance of NetworkFilter, retrieve pattern, organization and
   * category information.
   */
  fromFilter(filter) {
    return this.fromId(filter.getId());
  }
  /**
   * Given a domain, retrieve pattern, organization and category information.
   */
  fromDomain(domain) {
    const domainParts = domain.split(".");
    for (; domainParts.length >= 2; domainParts.shift()) {
      const subdomain = domainParts.join(".");
      const parsedDomainFilter = NetworkFilter.parse(`||${subdomain}^`);
      if (parsedDomainFilter === null) {
        continue;
      }
      const patterns = this.fromId(parsedDomainFilter.getId());
      if (patterns.length > 0) {
        return patterns;
      }
    }
    return [];
  }
  /**
   * Given an `id` from filter, retrieve using the NetworkFilter.getId() method,
   * lookup associated patterns (including organization and category) in an
   * efficient way.
   */
  fromId(id) {
    const results = [];
    for (const pattern of this.patterns.get(id)) {
      results.push({
        pattern,
        category: this.categories.get(getKey({ key: pattern.category }))?.[0],
        organization: pattern.organization !== null ? this.organizations.get(getKey2({ key: pattern.organization }))?.[0] : null
      });
    }
    return results;
  }
};

// node_modules/@ghostery/adblocker/dist/esm/engine/bucket/preprocessor.js
var PreprocessorBucket = class {
  static deserialize(view) {
    const excluded = /* @__PURE__ */ new Set();
    for (let i = 0, l = view.getUint32(); i < l; i++) {
      excluded.add(view.getUint32());
    }
    const preprocessors = [];
    for (let i = 0, l = view.getUint32(); i < l; i++) {
      preprocessors.push(Preprocessor.deserialize(view));
    }
    return new this({
      excluded,
      preprocessors
    });
  }
  constructor({ excluded = /* @__PURE__ */ new Set(), preprocessors = [] }) {
    this.excluded = excluded;
    this.preprocessors = preprocessors;
  }
  isFilterExcluded(filter) {
    return this.excluded.has(filter.getId());
  }
  updateEnv(env) {
    this.excluded.clear();
    for (const preprocessor of this.preprocessors) {
      if (!preprocessor.evaluate(env)) {
        for (const filterID of preprocessor.filterIDs) {
          this.excluded.add(filterID);
        }
      }
    }
  }
  update({ added, removed }, env) {
    if (removed) {
      for (const preprocessor of removed) {
        const local = this.preprocessors.find((local2) => local2.condition === preprocessor.condition);
        if (!local) {
          continue;
        }
        for (const filterID of preprocessor.filterIDs) {
          local.filterIDs.delete(filterID);
        }
      }
    }
    if (added) {
      for (const preprocessor of added) {
        const local = this.preprocessors.find((local2) => local2.condition === preprocessor.condition);
        if (!local) {
          this.preprocessors.push(preprocessor);
          continue;
        }
        for (const filterID of preprocessor.filterIDs) {
          local.filterIDs.add(filterID);
        }
      }
    }
    if (removed && removed.length !== 0 || added && added.length !== 0) {
      this.updateEnv(env);
    }
  }
  serialize(view) {
    view.pushUint32(this.excluded.size);
    for (const filterID of this.excluded) {
      view.pushUint32(filterID);
    }
    view.pushUint32(this.preprocessors.length);
    for (const preprocessor of this.preprocessors) {
      preprocessor.serialize(view);
    }
  }
  getSerializedSize() {
    let estimatedSize = (1 + this.excluded.size) * 4;
    estimatedSize += 4;
    for (const preprocessor of this.preprocessors) {
      estimatedSize += preprocessor.getSerializedSize();
    }
    return estimatedSize;
  }
};

// node_modules/@ghostery/adblocker/dist/esm/engine/merger.js
function mergeMetadata(engines) {
  const metadata = {
    organizations: {},
    categories: {},
    patterns: {}
  };
  for (const engine of engines) {
    if (engine.metadata !== void 0) {
      for (const organization of engine.metadata.organizations.getValues()) {
        if (metadata.organizations[organization.key] === void 0) {
          metadata.organizations[organization.key] = organization;
        }
      }
      for (const category of engine.metadata.categories.getValues()) {
        if (metadata.categories[category.key] === void 0) {
          metadata.categories[category.key] = category;
        }
      }
      for (const pattern of engine.metadata.patterns.getValues()) {
        if (metadata.patterns[pattern.key] === void 0) {
          metadata.patterns[pattern.key] = pattern;
        }
      }
    }
  }
  return metadata;
}
function mergeLists(engines) {
  const lists = /* @__PURE__ */ new Map();
  for (const engine of engines) {
    for (const [key, value] of engine.lists) {
      if (lists.has(key)) {
        continue;
      }
      lists.set(key, value);
    }
  }
  return lists;
}
function mergePreprocessors(engines) {
  const preprocessors = [];
  for (const engine of engines) {
    for (const preprocessor of engine.preprocessors.preprocessors) {
      const local = preprocessors.find((local2) => local2.condition === preprocessor.condition);
      if (local === void 0) {
        preprocessors.push(new Preprocessor({
          condition: preprocessor.condition,
          filterIDs: new Set(preprocessor.filterIDs)
        }));
        continue;
      }
      for (const filterID of preprocessor.filterIDs) {
        local.filterIDs.add(filterID);
      }
    }
  }
  return preprocessors;
}
function hasMetadata(metadata) {
  return Object.keys(metadata.categories).length + Object.keys(metadata.organizations).length + Object.keys(metadata.patterns).length !== 0;
}
function legacyMerge(self, engines, { skipResources = false, overrideConfig = {} } = {}) {
  if (!engines || engines.length < 2) {
    throw new Error("merging engines requires at least two engines");
  }
  for (const engine2 of engines) {
    if (engine2.config.enableCompression !== engines[0].config.enableCompression) {
      throw new Error(`compression of all merged engines must match with the first one: "${engines[0].config.enableCompression}" but got: "${engine2.config.enableCompression}"`);
    }
  }
  const networkFilters = /* @__PURE__ */ new Map();
  const cosmeticFilters = /* @__PURE__ */ new Map();
  const metadata = mergeMetadata(engines);
  const lists = mergeLists(engines);
  const preprocessors = mergePreprocessors(engines);
  for (const engine2 of engines) {
    const filters = engine2.getFilters();
    for (const networkFilter of filters.networkFilters) {
      networkFilters.set(networkFilter.getId(), networkFilter);
    }
    for (const cosmeticFilter of filters.cosmeticFilters) {
      cosmeticFilters.set(cosmeticFilter.getId(), cosmeticFilter);
    }
  }
  const engine = new self({
    networkFilters: Array.from(networkFilters.values()),
    cosmeticFilters: Array.from(cosmeticFilters.values()),
    preprocessors,
    lists,
    config: new Config({ ...engines[0].config, ...overrideConfig })
  });
  if (hasMetadata(metadata)) {
    engine.metadata = new Metadata(metadata);
  }
  if (skipResources !== true) {
    for (const engine2 of engines.slice(1)) {
      if (engine2.resources.checksum !== engines[0].resources.checksum) {
        throw new Error(`resource checksum of all merged engines must match with the first one: "${engines[0].resources.checksum}" but got: "${engine2.resources.checksum}"`);
      }
    }
    engine.resources = Resources.copy(engines[0].resources);
  }
  return engine;
}
function mergeNetworkFilterBucket(sources, config, hashFunc) {
  const bucket = new NetworkFilterBucket({ config });
  const optimize = config.enableOptimizations ? optimizeNetwork : noopOptimizeNetwork;
  bucket.index = ReverseIndex.merge(sources.map((source) => source.index), config, optimize, { hashFunc });
  bucket.badFilters = FiltersContainer.merge(sources.map((source) => source.badFilters), { hashFunc });
  return bucket;
}
function mergeCosmeticFilterBucket(sources, config, hashFunc) {
  const bucket = new CosmeticFilterBucket({ config });
  bucket.genericRules = FiltersContainer.merge(sources.map((source) => source.genericRules), { hashFunc });
  bucket.classesIndex = ReverseIndex.merge(sources.map((source) => source.classesIndex), config, noopOptimizeCosmetic, { hashFunc });
  bucket.hostnameIndex = ReverseIndex.merge(sources.map((source) => source.hostnameIndex), config, noopOptimizeCosmetic, { hashFunc });
  bucket.hrefsIndex = ReverseIndex.merge(sources.map((source) => source.hrefsIndex), config, noopOptimizeCosmetic, { hashFunc });
  bucket.idsIndex = ReverseIndex.merge(sources.map((source) => source.idsIndex), config, noopOptimizeCosmetic, { hashFunc });
  bucket.unhideIndex = ReverseIndex.merge(sources.map((source) => source.unhideIndex), config, noopOptimizeCosmetic, { hashFunc });
  return bucket;
}
function mergeHTMLBucket(sources, config, hashFunc) {
  const bucket = new HTMLBucket({ config });
  const optimize = config.enableOptimizations ? optimizeNetwork : noopOptimizeNetwork;
  if (config.loadNetworkFilters === true) {
    bucket.networkIndex = ReverseIndex.merge(sources.map((source) => source.networkIndex), config, optimize, {
      hashFunc
    });
    bucket.exceptionsIndex = ReverseIndex.merge(sources.map((source) => source.exceptionsIndex), config, optimize, { hashFunc });
  }
  if (config.loadCosmeticFilters === true) {
    bucket.cosmeticIndex = ReverseIndex.merge(sources.map((source) => source.cosmeticIndex), config, noopOptimizeCosmetic, { hashFunc });
    bucket.unhideIndex = ReverseIndex.merge(sources.map((source) => source.unhideIndex), config, noopOptimizeCosmetic, { hashFunc });
  }
  return bucket;
}
function binaryMerge(self, engines, { skipResources = false, overrideConfig = {}, hashFunc } = {}) {
  if (!engines || engines.length < 2) {
    throw new Error("merging engines requires at least two engines");
  }
  for (const engine2 of engines) {
    if (engine2.config.enableCompression !== engines[0].config.enableCompression) {
      throw new Error(`compression of all merged engines must match with the first one: "${engines[0].config.enableCompression}" but got: "${engine2.config.enableCompression}"`);
    }
    if (engine2.config.debug === true) {
      throw new Error("merging engines with binaryMerge method is not allowed with debug mode strictly!");
    }
  }
  if (overrideConfig.debug === true) {
    throw new Error(`the resulting engine cannot have debug or compression when merging engines with binaryMerge method!`);
  }
  if (typeof overrideConfig.enableCompression === "boolean" && overrideConfig.enableCompression !== engines[0].config.enableCompression) {
    throw new Error(`the resulting engine should have same compression config when merging engines!`);
  }
  const metadata = mergeMetadata(engines);
  const lists = mergeLists(engines);
  const config = new Config({ ...engines[0].config, ...overrideConfig });
  const engine = new self({
    config,
    lists
  });
  engine.preprocessors = new PreprocessorBucket({
    preprocessors: config.loadPreprocessors === true ? mergePreprocessors(engines) : []
  });
  if (config.loadNetworkFilters === true) {
    engine.importants = mergeNetworkFilterBucket(engines.map((source) => source.importants), config, hashFunc);
    engine.redirects = mergeNetworkFilterBucket(engines.map((source) => source.redirects), config, hashFunc);
    engine.removeparams = mergeNetworkFilterBucket(engines.map((source) => source.removeparams), config, hashFunc);
    engine.filters = mergeNetworkFilterBucket(engines.map((source) => source.filters), config, hashFunc);
    engine.exceptions = config.loadExceptionFilters === true ? mergeNetworkFilterBucket(engines.map((source) => source.exceptions), config, hashFunc) : new NetworkFilterBucket({ config });
    engine.csp = config.loadCSPFilters === true ? mergeNetworkFilterBucket(engines.map((source) => source.csp), config, hashFunc) : new NetworkFilterBucket({ config });
    engine.hideExceptions = mergeNetworkFilterBucket(engines.map((source) => source.hideExceptions), config, hashFunc);
  }
  if (config.loadCosmeticFilters === true) {
    engine.cosmetics = mergeCosmeticFilterBucket(engines.map((source) => source.cosmetics), config, hashFunc);
  }
  if (config.enableHtmlFiltering === true) {
    engine.htmlFilters = mergeHTMLBucket(engines.map((source) => source.htmlFilters), config, hashFunc);
  }
  if (hasMetadata(metadata)) {
    engine.metadata = new Metadata(metadata);
  }
  if (skipResources !== true) {
    for (const engine2 of engines.slice(1)) {
      if (engine2.resources.checksum !== engines[0].resources.checksum) {
        throw new Error(`resource checksum of all merged engines must match with the first one: "${engines[0].resources.checksum}" but got: "${engine2.resources.checksum}"`);
      }
    }
    engine.resources = Resources.copy(engines[0].resources);
  }
  return engine;
}

// node_modules/@ghostery/adblocker/dist/esm/engine/engine.js
var ENGINE_VERSION = 895;
function findApplicableHideException(filters) {
  if (filters.length === 0) {
    return;
  }
  let hideFilter;
  let currentScore = 0;
  for (const filter of filters) {
    const score = (filter.isImportant() ? 4 : 0) | (filter.isException() ? 1 : 2);
    if (score >= currentScore) {
      currentScore = score;
      hideFilter = filter;
    }
  }
  if (hideFilter === void 0) {
    return;
  }
  if (hideFilter.isException() === false) {
    return;
  }
  return hideFilter;
}
var FilterEngine = class extends EventEmitter {
  static fromCached(init, caching) {
    if (caching === void 0) {
      return init();
    }
    const { path, read, write } = caching;
    return read(path).then((buffer) => this.deserialize(buffer)).catch(() => init().then((engine) => write(path, engine.serialize()).then(() => engine)));
  }
  static empty(config = {}) {
    return new this({ config });
  }
  /**
   * Create an instance of `FiltersEngine` (or subclass like `ElectronBlocker`,
   * etc.), from the list of subscriptions provided as argument (e.g.:
   * EasyList).
   *
   * Lists are fetched using the instance of `fetch` provided as a first
   * argument. Optionally resources.txt and config can be provided.
   */
  static fromLists(fetch2, urls, config = {}, caching) {
    return this.fromCached(() => {
      const listsPromises = fetchLists(fetch2, urls);
      const resourcesPromise = fetchResources(fetch2);
      return Promise.all([listsPromises, resourcesPromise]).then(([lists, resources]) => {
        const engine = this.parse(lists.join("\n"), config);
        if (resources !== void 0) {
          engine.updateResources(resources, "" + resources.length);
        }
        return engine;
      });
    }, caching);
  }
  /**
   * Initialize blocker of *ads only*.
   *
   * Attempt to initialize a blocking engine using a pre-built version served
   * from Ghostery's CDN. If this fails (e.g.: if no pre-built engine is available
   * for this version of the library), then falls-back to using `fromLists(...)`
   * method with the same subscriptions.
   */
  static fromPrebuiltAdsOnly(fetchImpl = fetch, caching) {
    return this.fromLists(fetchImpl, adsLists, {}, caching);
  }
  /**
   * Same as `fromPrebuiltAdsOnly(...)` but also contains rules to block
   * tracking (i.e.: using extra lists such as EasyPrivacy and more).
   */
  static fromPrebuiltAdsAndTracking(fetchImpl = fetch, caching) {
    return this.fromLists(fetchImpl, adsAndTrackingLists, {}, caching);
  }
  /**
   * Same as `fromPrebuiltAdsAndTracking(...)` but also contains annoyances
   * rules to block things like cookie notices.
   */
  static fromPrebuiltFull(fetchImpl = fetch, caching) {
    return this.fromLists(fetchImpl, fullLists, {}, caching);
  }
  static fromTrackerDB(rawJsonDump, options = {}) {
    const config = new Config(options);
    const metadata = new Metadata(rawJsonDump);
    const filters = [];
    for (const pattern of metadata.getPatterns()) {
      filters.push(...pattern.filters);
    }
    const engine = this.parse(filters.join("\n"), config);
    engine.metadata = metadata;
    return engine;
  }
  /**
   * Merges compatible engines into one.
   *
   * This action references objects from the source engines, including
   * network filters, cosmetic filters, preprocessors, metadata, and lists.
   * These objects are not deep-copied, so modifying them directly can have
   * unintended side effects.
   * However, resources are deep-copied from the first engine.
   *
   * Optionally, you can specify a second parameter to skip merging specific
   * resources or override the resulting engine config. If resource merging is
   * skipped, the resulting engine will be assigned empty resources.
   *
   * Set `useBinaryMerge` to use the byte-level merge path. This method is
   * faster for large engines, but it has stricter requirements: source engines
   * must not be built with `debug: true`, their compression settings must
   * match, and the resulting engine cannot enable debug or compression through
   * `overrideConfig`.
   *
   * When using `useBinaryMerge`, you can pass `hashFunc` to deduplicate
   * serialized filters. Prefer a collision-resistant bigint or string hash for
   * large merges; the built-in fallback is intended for convenience and does
   * not provide strict collision-proof deduplication.
   *
   * Call `updateEnv` on the merged engine before use when preprocessor bindings
   * should affect which filters are active.
   *
   * Binary merge skips buckets disabled by target load flags. It does not skip
   * buckets for `loadExtendedSelectors`, `enableInMemoryCache`, or
   * `enableOptimizations`, which do not represent whole filter categories.
   */
  static merge(engines, opts = {}) {
    if (opts.useBinaryMerge === true) {
      return binaryMerge(this, engines, opts);
    }
    return legacyMerge(this, engines, opts);
  }
  static parse(filters, options = {}) {
    const config = new Config(options);
    return new this({
      ...parseFilters(filters, config),
      config
    });
  }
  static deserialize(serialized) {
    const buffer = StaticDataView.fromUint8Array(serialized, {
      enableCompression: false
    });
    const serializedEngineVersion = buffer.getUint16();
    if (ENGINE_VERSION !== serializedEngineVersion) {
      throw new Error(`serialized engine version mismatch, expected ${ENGINE_VERSION} but got ${serializedEngineVersion}`);
    }
    const config = Config.deserialize(buffer);
    if (config.enableCompression) {
      buffer.enableCompression();
    }
    if (config.integrityCheck) {
      const currentPos = buffer.pos;
      buffer.pos = serialized.length - 4;
      const checksum = buffer.checksum();
      const expected = buffer.getUint32();
      if (checksum !== expected) {
        throw new Error(`serialized engine checksum mismatch, expected ${expected} but got ${checksum}`);
      }
      buffer.pos = currentPos;
    }
    const engine = new this({ config });
    engine.resources = Resources.deserialize(buffer);
    const lists = /* @__PURE__ */ new Map();
    const numberOfLists = buffer.getUint16();
    for (let i = 0; i < numberOfLists; i += 1) {
      lists.set(buffer.getASCII(), buffer.getASCII());
    }
    engine.lists = lists;
    engine.preprocessors = PreprocessorBucket.deserialize(buffer);
    engine.importants = NetworkFilterBucket.deserialize(buffer, config);
    engine.redirects = NetworkFilterBucket.deserialize(buffer, config);
    engine.removeparams = NetworkFilterBucket.deserialize(buffer, config);
    engine.filters = NetworkFilterBucket.deserialize(buffer, config);
    engine.exceptions = NetworkFilterBucket.deserialize(buffer, config);
    engine.csp = NetworkFilterBucket.deserialize(buffer, config);
    engine.cosmetics = CosmeticFilterBucket.deserialize(buffer, config);
    engine.hideExceptions = NetworkFilterBucket.deserialize(buffer, config);
    engine.htmlFilters = HTMLBucket.deserialize(buffer, config);
    const hasMetadata2 = buffer.getBool();
    if (hasMetadata2) {
      engine.metadata = Metadata.deserialize(buffer);
    }
    buffer.seekZero();
    return engine;
  }
  constructor({
    // Optionally initialize the engine with filters
    cosmeticFilters = [],
    networkFilters = [],
    preprocessors = [],
    config = new Config(),
    lists = /* @__PURE__ */ new Map()
  } = {}) {
    super();
    this.config = new Config(config);
    this.lists = lists;
    this.preprocessors = new PreprocessorBucket({});
    this.csp = new NetworkFilterBucket({ config: this.config });
    this.hideExceptions = new NetworkFilterBucket({ config: this.config });
    this.exceptions = new NetworkFilterBucket({ config: this.config });
    this.importants = new NetworkFilterBucket({ config: this.config });
    this.redirects = new NetworkFilterBucket({ config: this.config });
    this.removeparams = new NetworkFilterBucket({ config: this.config });
    this.filters = new NetworkFilterBucket({ config: this.config });
    this.cosmetics = new CosmeticFilterBucket({ config: this.config });
    this.htmlFilters = new HTMLBucket({ config: this.config });
    this.resources = new Resources();
    if (networkFilters.length !== 0 || cosmeticFilters.length !== 0) {
      this.update({
        newCosmeticFilters: cosmeticFilters,
        newNetworkFilters: networkFilters,
        newPreprocessors: preprocessors
      });
    }
  }
  isFilterExcluded(filter) {
    return this.preprocessors.isFilterExcluded(filter);
  }
  updateEnv(env) {
    this.preprocessors.updateEnv(env);
  }
  /**
   * Estimate the number of bytes needed to serialize this instance of
   * `FiltersEngine` using the `serialize(...)` method. It is used internally
   * by `serialize(...)` to allocate a buffer of the right size and you should
   * not have to call it yourself most of the time.
   *
   * There are cases where we cannot estimate statically the exact size of the
   * resulting buffer (due to alignement which needs to be performed); this
   * method will return a safe estimate which will always be at least equal to
   * the real number of bytes needed, or bigger (usually of a few bytes only:
   * ~20 bytes is to be expected).
   */
  getSerializedSize() {
    let estimatedSize = sizeOfByte() * 2 + // engine version
    this.config.getSerializedSize() + this.resources.getSerializedSize() + this.preprocessors.getSerializedSize() + this.filters.getSerializedSize() + this.exceptions.getSerializedSize() + this.importants.getSerializedSize() + this.redirects.getSerializedSize() + this.removeparams.getSerializedSize() + this.csp.getSerializedSize() + this.cosmetics.getSerializedSize() + this.hideExceptions.getSerializedSize() + this.htmlFilters.getSerializedSize() + 4;
    estimatedSize += sizeOfByte() * 2;
    for (const [name, checksum] of this.lists) {
      estimatedSize += sizeOfASCII(name) + sizeOfASCII(checksum);
    }
    estimatedSize += sizeOfBool();
    if (this.metadata !== void 0) {
      estimatedSize += this.metadata.getSerializedSize();
    }
    return estimatedSize;
  }
  /**
   * Creates a binary representation of the full engine. It can be stored
   * on-disk for faster loading of the adblocker. The `deserialize` static
   * method of Engine can be used to restore the engine.
   */
  serialize(array) {
    const buffer = StaticDataView.fromUint8Array(array || new Uint8Array(this.getSerializedSize()), this.config);
    buffer.pushUint16(ENGINE_VERSION);
    this.config.serialize(buffer);
    this.resources.serialize(buffer);
    buffer.pushUint16(this.lists.size);
    for (const [name, value] of Array.from(this.lists.entries()).sort()) {
      buffer.pushASCII(name);
      buffer.pushASCII(value);
    }
    this.preprocessors.serialize(buffer);
    this.importants.serialize(buffer);
    this.redirects.serialize(buffer);
    this.removeparams.serialize(buffer);
    this.filters.serialize(buffer);
    this.exceptions.serialize(buffer);
    this.csp.serialize(buffer);
    this.cosmetics.serialize(buffer);
    this.hideExceptions.serialize(buffer);
    this.htmlFilters.serialize(buffer);
    buffer.pushBool(this.metadata !== void 0);
    if (this.metadata !== void 0) {
      this.metadata.serialize(buffer);
    }
    if (this.config.integrityCheck) {
      buffer.pushUint32(buffer.checksum());
    }
    return buffer.subarray();
  }
  /**
   * Update engine with new filters or resources.
   */
  loadedLists() {
    return Array.from(this.lists.keys());
  }
  hasList(name, checksum) {
    return this.lists.has(name) && this.lists.get(name) === checksum;
  }
  /**
   * Update engine with `resources.txt` content.
   */
  updateResources(data, checksum) {
    if (this.resources.checksum === checksum) {
      return false;
    }
    this.resources = Resources.parse(data, { checksum });
    return true;
  }
  getFilters() {
    const cosmeticFilters = this.cosmetics.getFilters();
    const networkFilters = [
      ...this.filters.getFilters(),
      ...this.exceptions.getFilters(),
      ...this.importants.getFilters(),
      ...this.redirects.getFilters(),
      ...this.csp.getFilters(),
      ...this.hideExceptions.getFilters(),
      ...this.removeparams.getFilters()
    ];
    for (const filter of this.htmlFilters.getFilters()) {
      if (filter.isNetworkFilter()) {
        networkFilters.push(filter);
      } else if (filter.isCosmeticFilter()) {
        cosmeticFilters.push(filter);
      }
    }
    return {
      cosmeticFilters,
      networkFilters
    };
  }
  /**
   * Update engine with new filters as well as optionally removed filters.
   */
  update({ newNetworkFilters = [], newCosmeticFilters = [], newPreprocessors = [], removedCosmeticFilters = [], removedNetworkFilters = [], removedPreprocessors = [] }, env = new Env()) {
    let updated = false;
    if (this.config.loadPreprocessors && (newPreprocessors.length !== 0 || removedPreprocessors.length !== 0)) {
      updated = true;
      this.preprocessors.update({
        added: newPreprocessors,
        removed: removedPreprocessors
      }, env);
    }
    const htmlFilters = [];
    if (this.config.loadCosmeticFilters && (newCosmeticFilters.length !== 0 || removedCosmeticFilters.length !== 0)) {
      updated = true;
      const cosmeticFitlers = [];
      for (const filter of newCosmeticFilters) {
        if (filter.isHtmlFiltering()) {
          htmlFilters.push(filter);
        } else {
          cosmeticFitlers.push(filter);
        }
      }
      this.cosmetics.update(cosmeticFitlers, removedCosmeticFilters.length === 0 ? void 0 : new Set(removedCosmeticFilters), this.config);
    }
    if (this.config.loadNetworkFilters && (newNetworkFilters.length !== 0 || removedNetworkFilters.length !== 0)) {
      updated = true;
      const filters = [];
      const csp = [];
      const exceptions = [];
      const importants = [];
      const redirects = [];
      const removeparams = [];
      const hideExceptions = [];
      for (const filter of newNetworkFilters) {
        if (filter.isCSP()) {
          csp.push(filter);
        } else if (filter.isHtmlFilteringRule()) {
          htmlFilters.push(filter);
        } else if (filter.isGenericHide() || filter.isSpecificHide()) {
          hideExceptions.push(filter);
        } else if (filter.isException()) {
          if (filter.isRemoveParam()) {
            removeparams.push(filter);
          } else {
            exceptions.push(filter);
          }
        } else if (filter.isImportant()) {
          importants.push(filter);
        } else if (filter.isRedirect()) {
          redirects.push(filter);
        } else if (filter.isRemoveParam()) {
          removeparams.push(filter);
        } else {
          filters.push(filter);
        }
      }
      const removedNetworkFiltersSet = removedNetworkFilters.length === 0 ? void 0 : new Set(removedNetworkFilters);
      this.importants.update(importants, removedNetworkFiltersSet);
      this.redirects.update(redirects, removedNetworkFiltersSet);
      this.removeparams.update(removeparams, removedNetworkFiltersSet);
      this.filters.update(filters, removedNetworkFiltersSet);
      if (this.config.loadExceptionFilters === true) {
        this.exceptions.update(exceptions, removedNetworkFiltersSet);
      }
      if (this.config.loadCSPFilters === true) {
        this.csp.update(csp, removedNetworkFiltersSet);
      }
      this.hideExceptions.update(hideExceptions, removedNetworkFiltersSet);
    }
    if (this.config.enableHtmlFiltering && (htmlFilters.length !== 0 || removedNetworkFilters.length !== 0 || removedCosmeticFilters.length !== 0)) {
      const removeFilters = /* @__PURE__ */ new Set([...removedNetworkFilters, ...removedCosmeticFilters]);
      this.htmlFilters.update(htmlFilters, removeFilters);
    }
    return updated;
  }
  updateFromDiff({ added, removed, preprocessors }, env) {
    const newCosmeticFilters = [];
    const newNetworkFilters = [];
    const newPreprocessors = [];
    const removedCosmeticFilters = [];
    const removedNetworkFilters = [];
    const removedPreprocessors = [];
    if (removed !== void 0 && removed.length !== 0) {
      const { networkFilters, cosmeticFilters } = parseFilters(removed.join("\n"), this.config);
      Array.prototype.push.apply(removedCosmeticFilters, cosmeticFilters);
      Array.prototype.push.apply(removedNetworkFilters, networkFilters);
    }
    if (added !== void 0 && added.length !== 0) {
      const { networkFilters, cosmeticFilters } = parseFilters(added.join("\n"), this.config);
      Array.prototype.push.apply(newCosmeticFilters, cosmeticFilters);
      Array.prototype.push.apply(newNetworkFilters, networkFilters);
    }
    if (preprocessors !== void 0) {
      for (const [condition, details] of Object.entries(preprocessors)) {
        if (details.removed !== void 0 && details.removed.length !== 0) {
          const { networkFilters, cosmeticFilters } = parseFilters(details.removed.join("\n"), this.config);
          const filterIDs = new Set([].concat(cosmeticFilters.map((filter) => filter.getId())).concat(networkFilters.map((filter) => filter.getId())));
          removedPreprocessors.push(new Preprocessor({
            condition,
            filterIDs
          }));
        }
        if (details.added !== void 0 && details.added.length !== 0) {
          const { networkFilters, cosmeticFilters } = parseFilters(details.added.join("\n"), this.config);
          const filterIDs = new Set([].concat(cosmeticFilters.map((filter) => filter.getId())).concat(networkFilters.map((filter) => filter.getId())));
          newPreprocessors.push(new Preprocessor({
            condition,
            filterIDs
          }));
        }
      }
    }
    return this.update({
      newCosmeticFilters,
      newNetworkFilters,
      newPreprocessors,
      removedCosmeticFilters: removedCosmeticFilters.map((f2) => f2.getId()),
      removedNetworkFilters: removedNetworkFilters.map((f2) => f2.getId()),
      removedPreprocessors
    }, env);
  }
  /**
   * Return a list of HTML filtering rules.
   */
  getHtmlFilters(request) {
    const htmlSelectors = [];
    if (this.config.enableHtmlFiltering === false) {
      return htmlSelectors;
    }
    const { networkFilters, exceptions, cosmeticFilters, unhides } = this.htmlFilters.getHTMLFilters(request, this.isFilterExcluded.bind(this));
    if (cosmeticFilters.length !== 0) {
      const unhideMap = new Map(unhides.map((unhide) => [unhide.getSelector(), unhide]));
      for (const filter of cosmeticFilters) {
        const extended = filter.getExtendedSelector();
        if (extended === void 0) {
          continue;
        }
        const unhide = unhideMap.get(filter.getSelector());
        if (unhide === void 0) {
          htmlSelectors.push(extended);
        }
        this.emit("filter-matched", { filter, exception: unhide }, {
          request,
          filterType: FilterType.COSMETIC
        });
      }
    }
    if (networkFilters.length !== 0) {
      const exceptionsMap = /* @__PURE__ */ new Map();
      let replaceDisabledException;
      for (const exception of exceptions) {
        const optionValue = exception.optionValue;
        if (optionValue === "") {
          replaceDisabledException = exception;
          break;
        }
        exceptionsMap.set(optionValue, exception);
      }
      for (const filter of networkFilters) {
        const modifier = filter.getHtmlModifier();
        if (modifier === null) {
          continue;
        }
        const exception = replaceDisabledException || exceptionsMap.get(filter.optionValue);
        this.emit("filter-matched", { filter, exception }, {
          request,
          filterType: FilterType.NETWORK
        });
        if (exception === void 0) {
          htmlSelectors.push(["replace", modifier]);
        }
      }
    }
    if (htmlSelectors.length !== 0) {
      this.emit("html-filtered", htmlSelectors, request.url);
    }
    return htmlSelectors;
  }
  /**
   * Given `hostname` and `domain` of a page (or frame), return the list of
   * styles and scripts to inject in the page.
   */
  getCosmeticsFilters({
    // Page information
    url,
    hostname,
    domain,
    ancestors,
    // DOM information
    classes,
    hrefs,
    ids,
    // Allows to specify which rules to return
    getBaseRules = true,
    getInjectionRules = true,
    getExtendedRules = true,
    getRulesFromDOM = true,
    getRulesFromHostname = true,
    hidingStyle,
    callerContext
  }) {
    if (this.config.loadCosmeticFilters === false) {
      return {
        active: false,
        extended: [],
        scripts: [],
        styles: ""
      };
    }
    const { matches: matches2, allowGenericHides } = this.matchCosmeticFilters({
      url,
      hostname,
      domain,
      ancestors,
      classes,
      hrefs,
      ids,
      getRulesFromDOM,
      getRulesFromHostname,
      getInjectionRules,
      getExtendedRules,
      callerContext
    });
    const filters = [];
    for (const { filter, exception } of matches2) {
      if (filter !== void 0 && exception === void 0) {
        filters.push(filter);
      }
    }
    const { extended, scripts, styles } = this.injectCosmeticFilters(filters, {
      url,
      injectScriptlets: getInjectionRules,
      injectExtended: getExtendedRules,
      allowGenericHides,
      getBaseRules,
      hidingStyle
    });
    return {
      active: true,
      extended,
      scripts,
      styles
    };
  }
  /**
   * Prepares cosmetic filters to be injected by compiling them to stylesheets, scripts and extented selector ASTs.
   */
  injectCosmeticFilters(filters, { url, injectStyles = true, injectScriptlets, injectExtended, allowGenericHides = true, getBaseRules, hidingStyle }) {
    const scripts = [];
    const styleFilters = [];
    const extendedFilters = [];
    for (const filter of filters) {
      if (injectScriptlets && filter.isScriptInject()) {
        const script = filter.getScript(this.resources.getScriptlet.bind(this.resources));
        if (script !== void 0) {
          scripts.push(script);
        }
      } else if (filter.isExtended()) {
        if (injectExtended === true && this.config.loadExtendedSelectors) {
          extendedFilters.push(filter);
        }
      } else if (injectStyles === true) {
        styleFilters.push(filter);
      }
    }
    const stylesheets = this.cosmetics.getStylesheetsFromFilters({
      filters: styleFilters,
      extendedFilters
    }, { getBaseRules, allowGenericHides, hidingStyle });
    for (const script of scripts) {
      this.emit("script-injected", script, url);
    }
    if (stylesheets.stylesheet.length !== 0) {
      this.emit("style-injected", stylesheets.stylesheet, url);
    }
    return {
      extended: stylesheets.extended,
      scripts,
      styles: stylesheets.stylesheet
    };
  }
  matchCosmeticFilters({
    // Page information
    url,
    hostname,
    domain,
    ancestors,
    // DOM information
    classes,
    hrefs,
    ids,
    getRulesFromDOM = true,
    getRulesFromHostname = true,
    getInjectionRules,
    getExtendedRules,
    callerContext
  }) {
    domain || (domain = "");
    const matches2 = [];
    const exceptions = this.hideExceptions.matchAll(Request.fromRawDetails({
      domain,
      hostname,
      url,
      sourceDomain: "",
      sourceHostname: "",
      sourceUrl: ""
    }), this.isFilterExcluded.bind(this));
    const genericHides = [];
    const specificHides = [];
    for (const filter of exceptions) {
      if (filter.isSpecificHide()) {
        specificHides.push(filter);
      }
      if (filter.isGenericHide()) {
        genericHides.push(filter);
      }
    }
    const genericHideException = findApplicableHideException(genericHides);
    const specificHideException = findApplicableHideException(specificHides);
    if (genericHideException !== void 0) {
      const match = {
        filter: void 0,
        exception: genericHideException
      };
      matches2.push(match);
      this.emit("filter-matched", match, {
        url,
        callerContext,
        filterType: FilterType.COSMETIC
      });
    }
    if (specificHideException !== void 0 && // The filter can be $elemhide which get set both for ghide and shide
    genericHideException !== specificHideException) {
      const match = {
        filter: void 0,
        exception: specificHideException
      };
      matches2.push(match);
      this.emit("filter-matched", match, {
        url,
        callerContext,
        filterType: FilterType.COSMETIC
      });
    }
    const { filters, unhides } = this.cosmetics.getCosmeticsFilters({
      domain,
      hostname,
      ancestors,
      classes,
      hrefs,
      ids,
      allowGenericHides: genericHideException === void 0,
      allowSpecificHides: specificHideException === void 0,
      getRulesFromDOM,
      getRulesFromHostname,
      isFilterExcluded: this.isFilterExcluded.bind(this)
    });
    let injectionsDisabledFilter = void 0;
    const unhideExceptions = /* @__PURE__ */ new Map();
    for (const unhide of unhides) {
      if (unhide.isScriptInject() === true && unhide.isUnhide() === true && unhide.getSelector().length === 0) {
        injectionsDisabledFilter = unhide;
      } else {
        unhideExceptions.set(normalizeSelector(unhide, this.resources.getScriptletCanonicalName.bind(this.resources)), unhide);
      }
    }
    for (const filter of filters) {
      if (filter.isExtended() && getExtendedRules === false) {
        continue;
      }
      let exception = unhideExceptions.get(normalizeSelector(filter, this.resources.getScriptletCanonicalName.bind(this.resources)));
      if (filter.isScriptInject()) {
        if (injectionsDisabledFilter !== void 0) {
          exception = injectionsDisabledFilter;
        }
        if (getInjectionRules === false) {
          continue;
        }
      }
      matches2.push({ filter, exception });
      this.emit("filter-matched", {
        filter,
        exception
      }, {
        url,
        callerContext,
        filterType: FilterType.COSMETIC
      });
    }
    return {
      matches: matches2,
      allowGenericHides: genericHideException === void 0
    };
  }
  /**
   * Given a `request`, return all matching network filters found in the engine.
   */
  matchAll(request) {
    const filters = [];
    if (request.isSupported) {
      Array.prototype.push.apply(filters, this.importants.matchAll(request, this.isFilterExcluded.bind(this)));
      Array.prototype.push.apply(filters, this.filters.matchAll(request, this.isFilterExcluded.bind(this)));
      Array.prototype.push.apply(filters, this.exceptions.matchAll(request, this.isFilterExcluded.bind(this)));
      Array.prototype.push.apply(filters, this.csp.matchAll(request, this.isFilterExcluded.bind(this)));
      Array.prototype.push.apply(filters, this.hideExceptions.matchAll(request, this.isFilterExcluded.bind(this)));
      Array.prototype.push.apply(filters, this.redirects.matchAll(request, this.isFilterExcluded.bind(this)));
    }
    return new Set(filters);
  }
  /**
   * Given a "main_frame" request, check if some content security policies
   * should be injected in the page.
   */
  getCSPDirectives(request) {
    if (!this.config.loadNetworkFilters) {
      return void 0;
    }
    if (request.isSupported !== true || request.isMainFrame() === false) {
      return void 0;
    }
    const matches2 = this.csp.matchAll(request, this.isFilterExcluded.bind(this));
    if (matches2.length === 0) {
      return void 0;
    }
    const cspExceptions = /* @__PURE__ */ new Map();
    const cspFilters = [];
    for (const filter of matches2) {
      if (filter.isException()) {
        if (filter.csp === void 0) {
          this.emit("filter-matched", { exception: filter }, { request, filterType: FilterType.NETWORK });
          return void 0;
        }
        cspExceptions.set(filter.csp, filter);
      } else {
        cspFilters.push(filter);
      }
    }
    if (cspFilters.length === 0) {
      return void 0;
    }
    const enabledCsp = /* @__PURE__ */ new Set();
    for (const filter of cspFilters.values()) {
      const exception = cspExceptions.get(filter.csp);
      if (exception === void 0) {
        enabledCsp.add(filter.csp);
      }
      this.emit("filter-matched", { filter, exception }, { request, filterType: FilterType.NETWORK });
    }
    const csps = Array.from(enabledCsp).join("; ");
    if (csps.length > 0) {
      this.emit("csp-injected", request, csps);
    }
    return csps;
  }
  /**
   * Decide if a network request (usually from WebRequest API) should be
   * blocked, redirected or allowed.
   */
  match(request, withMetadata = false) {
    const result = {
      exception: void 0,
      filter: void 0,
      match: false,
      redirect: void 0,
      rewrite: void 0,
      metadata: void 0
    };
    if (!this.config.loadNetworkFilters) {
      return result;
    }
    if (request.isSupported) {
      result.filter = this.importants.match(request, this.isFilterExcluded.bind(this));
      let redirectNone;
      let redirectRule;
      if (result.filter === void 0) {
        const redirects = this.redirects.matchAll(request, this.isFilterExcluded.bind(this)).sort((a, b) => b.getRedirectPriority() - a.getRedirectPriority());
        if (redirects.length !== 0) {
          for (const filter of redirects) {
            if (filter.getRedirectResource() === "none") {
              redirectNone = filter;
            } else if (filter.isRedirectRule()) {
              if (redirectRule === void 0) {
                redirectRule = filter;
              }
            } else if (result.filter === void 0) {
              result.filter = filter;
            }
          }
        }
        if (result.filter === void 0) {
          result.filter = this.filters.match(request, this.isFilterExcluded.bind(this));
          if (redirectRule !== void 0 && result.filter !== void 0) {
            result.filter = redirectRule;
          }
        }
        if (result.filter !== void 0) {
          result.exception = this.exceptions.match(request, this.isFilterExcluded.bind(this));
        }
        if (result.filter === void 0) {
          const searchParamSeparatorIndex = request.url.indexOf("?");
          if (searchParamSeparatorIndex !== -1 && searchParamSeparatorIndex !== request.url.length - 1) {
            const searchParamLiteral = request.url.slice(searchParamSeparatorIndex);
            const searchParams = new SearchParams(searchParamLiteral);
            let modified = false;
            const removeparamFilters = /* @__PURE__ */ new Map();
            const removeparamExceptions = /* @__PURE__ */ new Map();
            for (const filter of this.removeparams.matchAll(request, this.isFilterExcluded.bind(this))) {
              if (filter.isException()) {
                removeparamExceptions.set(filter.removeparam, filter);
              } else {
                removeparamFilters.set(filter.removeparam, filter);
              }
            }
            const removeparamIgnoreFilter = (
              // `result.exception` is conditionally matched only if `result.filter` is available.
              (result.filter === void 0 ? this.exceptions.match(request, this.isFilterExcluded.bind(this)) : result.exception) || removeparamExceptions.get("")
            );
            for (const [key, filter] of removeparamFilters) {
              if (key === "") {
                if (removeparamIgnoreFilter === void 0) {
                  for (const key2 of Array.from(searchParams.keys())) {
                    searchParams.delete(key2);
                  }
                  modified = true;
                }
                this.emit("filter-matched", { filter, exception: removeparamIgnoreFilter }, { request, filterType: FilterType.NETWORK });
                break;
              }
              if (!key.startsWith("~") && // Try to find `?${key}` pattern.
              searchParamLiteral.slice(1, key.length + 1) !== key && !searchParamLiteral.includes(`&${key}`)) {
                continue;
              }
              const exception = removeparamExceptions.get(key) ?? removeparamIgnoreFilter;
              if (exception === void 0) {
                if (key.startsWith("~")) {
                  const inversionKey = key.slice(1);
                  for (const param of Array.from(searchParams.keys())) {
                    if (param !== inversionKey && !removeparamExceptions.has(param)) {
                      searchParams.delete(param);
                      modified = true;
                    }
                  }
                } else {
                  searchParams.delete(key);
                  modified = true;
                }
              }
              this.emit("filter-matched", { filter, exception }, { request, filterType: FilterType.NETWORK });
            }
            if (modified) {
              let url = request.url.slice(0, searchParamSeparatorIndex);
              if (searchParams.size > 0) {
                url += "?" + searchParams.toString();
              }
              result.rewrite = {
                url
              };
            }
          }
        }
      }
      if (result.filter !== void 0 && result.exception === void 0 && result.filter.isRedirect()) {
        if (redirectNone !== void 0) {
          result.exception = redirectNone;
        } else {
          result.redirect = this.resources.getResource(result.filter.getRedirectResource());
        }
      }
    }
    result.match = result.exception === void 0 && result.filter !== void 0;
    if (result.filter) {
      this.emit("filter-matched", { filter: result.filter, exception: result.exception }, { request, filterType: FilterType.NETWORK });
    }
    if (result.exception !== void 0) {
      this.emit("request-whitelisted", request, result);
    } else if (result.redirect !== void 0) {
      this.emit("request-redirected", request, result);
    } else if (result.filter !== void 0) {
      this.emit("request-blocked", request, result);
    } else {
      this.emit("request-allowed", request, result);
    }
    if (withMetadata === true && result.filter !== void 0 && this.metadata) {
      result.metadata = this.metadata.fromFilter(result.filter);
    }
    return result;
  }
  getPatternMetadata(request, { getDomainMetadata = false } = {}) {
    if (this.metadata === void 0) {
      return [];
    }
    const seenPatterns = /* @__PURE__ */ new Set();
    const patterns = [];
    for (const filter of this.matchAll(request)) {
      for (const patternInfo of this.metadata.fromFilter(filter)) {
        if (!seenPatterns.has(patternInfo.pattern.key)) {
          seenPatterns.add(patternInfo.pattern.key);
          patterns.push(patternInfo);
        }
      }
    }
    if (getDomainMetadata) {
      for (const patternInfo of this.metadata.fromDomain(request.hostname)) {
        if (!seenPatterns.has(patternInfo.pattern.key)) {
          seenPatterns.add(patternInfo.pattern.key);
          patterns.push(patternInfo);
        }
      }
    }
    return patterns;
  }
  blockScripts() {
    this.updateFromDiff({
      added: [block().scripts().redirectTo("javascript").toString()]
    });
    return this;
  }
  blockImages() {
    this.updateFromDiff({
      added: [block().images().redirectTo("png").toString()]
    });
    return this;
  }
  blockMedias() {
    this.updateFromDiff({
      added: [block().medias().redirectTo("mp4").toString()]
    });
    return this;
  }
  blockFrames() {
    this.updateFromDiff({
      added: [block().frames().redirectTo("html").toString()]
    });
    return this;
  }
  blockFonts() {
    this.updateFromDiff({
      added: [block().fonts().toString()]
    });
    return this;
  }
  blockStyles() {
    this.updateFromDiff({
      added: [block().styles().toString()]
    });
    return this;
  }
};

// node_modules/@ghostery/adblocker/dist/esm/encoding.js
var utf8d = new Uint8Array([
  /* eslint-disable prettier/prettier */
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  // 00..1f
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  // 20..3f
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  // 40..5f
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  // 60..7f
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  9,
  9,
  9,
  9,
  9,
  9,
  9,
  9,
  9,
  9,
  9,
  9,
  9,
  9,
  9,
  9,
  // 80..9f
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  7,
  // a0..bf
  8,
  8,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  // c0..df
  10,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  4,
  3,
  3,
  // e0..ef
  11,
  6,
  6,
  6,
  5,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  // f0..ff
  0,
  1,
  2,
  3,
  5,
  8,
  7,
  1,
  1,
  1,
  4,
  6,
  1,
  1,
  1,
  1,
  // s0..s0
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  0,
  1,
  1,
  1,
  1,
  1,
  0,
  1,
  0,
  1,
  1,
  1,
  1,
  1,
  1,
  // s1..s2
  1,
  2,
  1,
  1,
  1,
  1,
  1,
  2,
  1,
  2,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  2,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  // s3..s4
  1,
  2,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  2,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  3,
  1,
  3,
  1,
  1,
  1,
  1,
  1,
  1,
  // s5..s6
  1,
  3,
  1,
  1,
  1,
  1,
  1,
  3,
  1,
  3,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  3,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1
  // s7..s8
  /* eslint-enable prettier/prettier */
]);
export {
  FilterEngine as FiltersEngine,
  Request
};
