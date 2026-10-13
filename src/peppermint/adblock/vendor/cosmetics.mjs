/* eslint-disable */
/*!
 * Bundled from @ghostery/adblocker@2.18.2 (MPL-2.0).
 * Copyright (c) 2017-present Ghostery GmbH. All rights reserved.
 * https://github.com/ghostery/adblocker
 */

// node_modules/@ghostery/adblocker-extended-selectors/dist/esm/parse.js
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
var TOKENS_FOR_RESTORE = Object.assign({}, TOKENS);
TOKENS_FOR_RESTORE["pseudo-element"] = RegExp(TOKENS["pseudo-element"].source.replace("(?<argument>\xB6*)", "(?<argument>.*?)"), "gu");
TOKENS_FOR_RESTORE["pseudo-class"] = RegExp(TOKENS["pseudo-class"].source.replace("(?<argument>\xB6*)", "(?<argument>.*)"), "gu");

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
var SelectorType;
(function(SelectorType2) {
  SelectorType2[SelectorType2["Normal"] = 0] = "Normal";
  SelectorType2[SelectorType2["Extended"] = 1] = "Extended";
  SelectorType2[SelectorType2["Invalid"] = 2] = "Invalid";
})(SelectorType || (SelectorType = {}));

// node_modules/@ghostery/adblocker-extended-selectors/dist/esm/eval.js
var createXpathExpression = /* @__PURE__ */ (function() {
  const expressions = [];
  return function compile(query) {
    for (const [literal, expression2] of expressions) {
      if (query === literal) {
        return expression2;
      }
    }
    const expression = document.createExpression(query);
    expressions.push([query, expression]);
    return expression;
  };
})();
function handleXPathSelector(element, xpathExpression) {
  try {
    if (typeof Node === "undefined" || typeof XPathResult === "undefined") {
      return [];
    }
    const result = createXpathExpression(xpathExpression).evaluate(element, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE);
    if (result.resultType !== XPathResult.ORDERED_NODE_SNAPSHOT_TYPE) {
      return [];
    }
    const elements = [];
    for (let i = 0; i < result.snapshotLength; i++) {
      const node = result.snapshotItem(i);
      if (node?.nodeType === Node.ELEMENT_NODE) {
        elements.push(node);
      }
    }
    return elements;
  } catch (e) {
    return [];
  }
}
function parseCSSValue(cssValue) {
  const firstColonIndex = cssValue.indexOf(":");
  if (firstColonIndex === -1) {
    throw new Error("Invalid CSS value format: no colon found");
  }
  const property = cssValue.slice(0, firstColonIndex).trim();
  const value = cssValue.slice(firstColonIndex + 1).trim();
  const isRegex = value.startsWith("/") && value.lastIndexOf("/") > 0;
  return { property, value, isRegex };
}
function matchCSSProperty(element, cssValue, pseudoElement) {
  const { property, value, isRegex } = parseCSSValue(cssValue);
  const win = element.ownerDocument && element.ownerDocument.defaultView;
  if (!win)
    throw new Error("No window context for element");
  const computedStyle = win.getComputedStyle(element, pseudoElement);
  const actualValue = computedStyle[property];
  if (isRegex) {
    const regex = parseRegex(value);
    return regex.test(actualValue);
  }
  return actualValue === value;
}
function parseRegex(str) {
  if (str.startsWith("/") && str.lastIndexOf("/") > 0) {
    const lastSlashIndex = str.lastIndexOf("/");
    const pattern = str.slice(1, lastSlashIndex);
    const flags = str.slice(lastSlashIndex + 1);
    if (flags.length > 3 || !/^[imu]*$/.test(flags)) {
      throw new Error(`Invalid regex flags: ${flags}`);
    }
    return new RegExp(pattern, flags);
  } else {
    return new RegExp(str);
  }
}
function stripsWrappingQuotes(str) {
  if (str.startsWith('"') && str.endsWith('"') || str.startsWith("'") && str.endsWith("'")) {
    return str.slice(1, -1);
  }
  return str;
}
function matchPattern(pattern, text) {
  pattern = stripsWrappingQuotes(pattern);
  if (pattern.startsWith("/") && (pattern.endsWith("/") || pattern.endsWith("/i"))) {
    let caseSensitive = true;
    pattern = pattern.slice(1);
    if (pattern.endsWith("/")) {
      pattern = pattern.slice(0, -1);
    } else {
      pattern = pattern.slice(0, -2);
      caseSensitive = false;
    }
    return new RegExp(pattern, caseSensitive === false ? "i" : void 0).test(text);
  }
  return text.includes(pattern);
}
function matches(element, selector) {
  if (selector.type === "id" || selector.type === "class" || selector.type === "type" || selector.type === "attribute") {
    return element.matches(selector.content);
  } else if (selector.type === "list") {
    return selector.list.some((s) => matches(element, s));
  } else if (selector.type === "compound") {
    return selector.compound.every((s) => matches(element, s));
  } else if (selector.type === "pseudo-class") {
    if (selector.name === "has") {
      return selector.subtree !== void 0 && querySelectorAll(element, selector.subtree).length !== 0;
    } else if (selector.name === "not") {
      return selector.subtree !== void 0 && traverse(element, [selector.subtree]).length === 0;
    } else if (selector.name === "has-text") {
      const { argument } = selector;
      if (argument === void 0) {
        return false;
      }
      const text = element.textContent;
      if (text === null) {
        return false;
      }
      return matchPattern(argument, text.trim());
    } else if (selector.name === "min-text-length") {
      const minLength = Number(selector.argument);
      if (Number.isNaN(minLength) || minLength < 0) {
        return false;
      }
      const text = element.textContent;
      if (text === null) {
        return false;
      }
      return text.length >= minLength;
    } else if (selector.name === "matches-path") {
      const { argument } = selector;
      if (argument === void 0) {
        return false;
      }
      const window = element.ownerDocument?.defaultView;
      if (!window) {
        return false;
      }
      const path = window.location.pathname;
      const search = window.location.search;
      const fullUrl = path + search;
      try {
        const regex = parseRegex(argument);
        return regex.test(fullUrl);
      } catch (e) {
        return fullUrl.includes(argument);
      }
    } else if (selector.name === "matches-attr") {
      const { argument } = selector;
      if (argument === void 0) {
        return false;
      }
      const indexOfEqual = argument.indexOf("=");
      let namePattern;
      let valuePattern;
      if (indexOfEqual === -1) {
        namePattern = argument;
      } else {
        namePattern = argument.slice(0, indexOfEqual);
        valuePattern = argument.slice(indexOfEqual + 1);
      }
      namePattern = stripsWrappingQuotes(namePattern);
      valuePattern = valuePattern ? stripsWrappingQuotes(valuePattern) : void 0;
      let valueRegex = null;
      if (valuePattern?.startsWith("/") && valuePattern.lastIndexOf("/") > 0) {
        valueRegex = parseRegex(valuePattern);
      }
      if (namePattern.startsWith("/") && namePattern.lastIndexOf("/") > 0) {
        const regex = parseRegex(namePattern);
        const matchingAttrs = [...element.attributes].filter((attr) => regex.test(attr.name));
        if (!valuePattern) {
          return matchingAttrs.length > 0;
        }
        return matchingAttrs.some((attr) => valueRegex ? valueRegex.test(attr.value) : attr.value === valuePattern);
      } else {
        const value = element.getAttribute(namePattern);
        if (value === null) {
          return false;
        }
        if (!valuePattern) {
          return true;
        }
        return valueRegex ? valueRegex.test(value) : value === valuePattern;
      }
    } else if (selector.name === "matches-css") {
      return selector.argument !== void 0 && matchCSSProperty(element, selector.argument);
    } else if (selector.name === "matches-css-after") {
      return selector.argument !== void 0 && matchCSSProperty(element, selector.argument, "::after");
    } else if (selector.name === "matches-css-before") {
      return selector.argument !== void 0 && matchCSSProperty(element, selector.argument, "::before");
    }
  }
  return false;
}
function handleComplexSelector(element, selector) {
  const leftElements = selector.left === void 0 ? [element] : querySelectorAll(element, selector.left);
  const selectors = selector.right.type === "compound" ? selector.right.compound : [selector.right];
  const results = /* @__PURE__ */ new Set();
  switch (selector.combinator) {
    case " ":
      for (const leftElement of leftElements) {
        for (const child of leftElement.querySelectorAll("*")) {
          for (const result of traverse(child, selectors)) {
            results.add(result);
          }
        }
      }
      break;
    case ">":
      for (const leftElement of leftElements) {
        for (const child of leftElement.children) {
          for (const result of traverse(child, selectors)) {
            results.add(result);
          }
        }
      }
      break;
    case "~":
      for (const leftElement of leftElements) {
        let sibling = leftElement;
        while ((sibling = sibling.nextElementSibling) !== null) {
          for (const result of traverse(sibling, selectors)) {
            results.add(result);
          }
        }
      }
      break;
    case "+":
      for (const leftElement of leftElements) {
        if (leftElement.nextElementSibling === null) {
          continue;
        }
        for (const result of traverse(leftElement.nextElementSibling, selectors)) {
          results.add(result);
        }
      }
      break;
  }
  return Array.from(results);
}
function transpose(element, selector) {
  if (selector.type === "pseudo-class") {
    if (selector.name === "upward") {
      if (selector.argument === void 0) {
        return [];
      }
      const argument = stripsWrappingQuotes(selector.argument);
      let parentElement = element;
      let number = Number(argument);
      if (Number.isInteger(number)) {
        if (number <= 0 || number >= 256) {
          return [];
        }
        while ((parentElement = parentElement.parentElement) !== null) {
          if (--number === 0) {
            return [parentElement];
          }
        }
      } else {
        while ((parentElement = parentElement.parentElement) !== null) {
          if (parentElement.matches(argument)) {
            return [parentElement];
          }
        }
      }
      return [];
    } else if (selector.name === "xpath") {
      if (selector.argument === void 0) {
        return [];
      }
      return handleXPathSelector(element, selector.argument);
    }
  }
  return null;
}
function traverse(root, selectors) {
  if (selectors.length === 0) {
    return [];
  }
  const traversals = [{ element: root, index: 0 }];
  const results = [];
  while (traversals.length) {
    const traversal = traversals.pop();
    const { element } = traversal;
    let { index } = traversal;
    for (; index < selectors.length; index++) {
      const candidates = transpose(element, selectors[index]);
      const isTransposeOperator = candidates !== null;
      if (isTransposeOperator) {
        traversals.push(...candidates.map((element2) => ({ element: element2, index: index + 1 })));
        break;
      } else if (matches(element, selectors[index]) === false) {
        break;
      }
    }
    if (index === selectors.length && !results.includes(element)) {
      results.push(element);
    }
  }
  return results;
}
function isDelegatedPseudoClass(selector) {
  return (
    // `xpath` and `upward` changes the subjective element
    selector.name === "xpath" || selector.name === "upward" || // `matches-path` doesn't depend on the element
    selector.name === "matches-path"
  );
}
function isExtendedSelector(selector, insideHasSelector = false) {
  if (selector.type === "id" || selector.type === "class" || selector.type === "type" || selector.type === "attribute") {
    return false;
  }
  if (selector.type === "list") {
    for (const item of selector.list) {
      if (isExtendedSelector(item, insideHasSelector)) {
        return true;
      }
    }
    return false;
  }
  if (selector.type === "compound") {
    for (const item of selector.compound) {
      if (isExtendedSelector(item, insideHasSelector)) {
        return true;
      }
    }
    return false;
  }
  if (selector.type === "complex") {
    if (isExtendedSelector(selector.right, insideHasSelector)) {
      return true;
    } else if (selector.left !== void 0 && isExtendedSelector(selector.left, insideHasSelector)) {
      return true;
    }
    return false;
  }
  if (selector.type === "pseudo-class") {
    if (isDelegatedPseudoClass(selector)) {
      return true;
    }
    if (selector.name === "has") {
      if (selector.subtree === void 0) {
        return false;
      } else if (insideHasSelector) {
        return true;
      }
      return isExtendedSelector(selector.subtree, true);
    }
    return EXTENDED_PSEUDO_CLASSES.has(selector.name) || selector.subtree !== void 0 && isExtendedSelector(selector.subtree, insideHasSelector);
  }
  return false;
}
function querySelectorAll(element, selector) {
  if (selector.type === "id" || selector.type === "class" || selector.type === "type" || selector.type === "attribute") {
    return Array.from(element.querySelectorAll(selector.content));
  }
  if (selector.type === "list") {
    const results = [];
    for (const item of selector.list) {
      for (const result of querySelectorAll(element, item)) {
        if (!results.includes(result)) {
          results.push(result);
        }
      }
    }
    return results;
  }
  if (selector.type === "compound") {
    const results = [];
    const [first, ...rest] = selector.compound;
    for (const subjective of querySelectorAll(element, first)) {
      for (const result of traverse(subjective, rest)) {
        if (!results.includes(result)) {
          results.push(result);
        }
      }
    }
    return results;
  }
  if (selector.type === "complex") {
    return handleComplexSelector(element, selector);
  }
  if (selector.type === "pseudo-class") {
    if (isDelegatedPseudoClass(selector)) {
      return traverse(element, [selector]);
    }
    if (!isExtendedSelector(selector)) {
      return Array.from(element.querySelectorAll(selector.content));
    }
    const results = [];
    for (const subjective of element.querySelectorAll("*")) {
      for (const result of traverse(subjective, [selector])) {
        if (!results.includes(result)) {
          results.push(result);
        }
      }
    }
    return results;
  }
  return [];
}
function handlePseudoDirective(element, selector) {
  if (selector.type !== "pseudo-class") {
    return;
  }
  if (selector.name === "remove") {
    element.remove();
  } else if (selector.name === "remove-attr") {
    if (selector.argument === void 0) {
      return;
    } else if (selector.argument.startsWith("/") && selector.argument.endsWith("/")) {
      const regex = parseRegex(selector.argument);
      for (let i = element.attributes.length - 1; i >= 0; i--) {
        const attribute = element.attributes.item(i);
        if (attribute !== null && regex.test(attribute.name)) {
          element.removeAttribute(attribute.name);
        }
      }
    } else {
      return element.removeAttribute(stripsWrappingQuotes(selector.argument));
    }
  } else if (selector.name === "remove-class") {
    if (selector.argument === void 0) {
      return;
    } else if (selector.argument.startsWith("/") && selector.argument.endsWith("/")) {
      const regex = parseRegex(selector.argument);
      for (let i = element.classList.length - 1; i >= 0; i--) {
        const className = element.classList.item(i);
        if (className !== null && regex.test(className)) {
          element.classList.remove(className);
        }
      }
    } else {
      return element.classList.remove(stripsWrappingQuotes(selector.argument));
    }
  }
}
export {
  handlePseudoDirective,
  querySelectorAll
};
