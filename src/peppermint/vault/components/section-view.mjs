/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { clear, h, iconButton, ICONS, initialOf } from "./dom.mjs";
import { openModal } from "./modal.mjs";

const REVEAL_MS = 30000;
const SEARCH_DEBOUNCE_MS = 150;
const MASK = "•".repeat(10);

const ERROR_L10N = {
  exists: "peppermint-vault-error-exists",
  "invalid-origin": "peppermint-vault-error-invalid-origin",
  "empty-password": "peppermint-vault-error-empty-password",
  "not-found": "peppermint-vault-error-not-found",
  "reveal-blocked": "peppermint-vault-error-reveal-blocked",
};

export function errorL10n(error) {
  return ERROR_L10N[error?.code] ?? "peppermint-vault-error-generic";
}

function openWebLink(url) {
  Services.wm
    .getMostRecentBrowserWindow()
    ?.openWebLinkIn(url, "tab", { relatedToCurrent: false });
}

/**
 * The list, search, filters and row actions of one section. Everything the
 * section does goes through api.call(), which handles locking and asking for
 * the Primary Password again, so this file never deals with authentication.
 *
 * @param {object} options
 * @param {object} options.section    The description from the registry.
 * @param {{ call: Function }} options.api
 * @param {Function} options.toast    toast(l10nId, args)
 * @param {string} [options.query]
 * @returns {{ element: HTMLElement, refresh: Function, destroy: Function, focusSearch: Function }}
 */
export function createSectionView({ section, api, toast, query = "" }) {
  const state = { query, filter: "all", sort: section.sorts[0]?.id ?? "" };
  const revealed = new Map();
  let searchTimer = null;
  let generation = 0;

  const list = h("ul", {
    class: "vault-list",
    attrs: { "aria-labelledby": "vault-section-title" },
  });
  const empty = h(
    "section",
    { class: "vault-empty", attrs: { hidden: true } },
    h("img", {
      class: "vault-hero-icon",
      attrs: { src: section.icon ?? ICONS.vault, alt: "" },
    }),
    h("h2", { l10n: "peppermint-vault-empty-title" }),
    h("p", { class: "vault-muted", l10n: "peppermint-vault-empty-description" })
  );
  const noResults = h("p", {
    class: "vault-muted vault-note",
    l10n: "peppermint-vault-no-results",
    attrs: { hidden: true },
  });
  const count = h("p", {
    class: "vault-visually-hidden",
    attrs: { role: "status", "aria-live": "polite" },
  });

  const search = h("input", {
    class: "vault-search",
    attrs: {
      type: "search",
      autocomplete: "off",
      spellcheck: "false",
    },
    l10n: "peppermint-vault-search",
    on: {
      input() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.query = search.value;
          refresh();
        }, SEARCH_DEBOUNCE_MS);
      },
    },
  });
  search.value = query;

  function select(options, key, l10n) {
    const element = h(
      "select",
      { class: "vault-select", l10n },
      options.map(option =>
        h("option", { attrs: { value: option.id }, l10n: option.l10nId })
      )
    );
    element.addEventListener("change", () => {
      state[key] = element.value;
      refresh();
    });
    return element;
  }

  const addButton = h(
    "button",
    {
      class: "vault-button vault-primary",
      attrs: { type: "button" },
      on: { click: () => openCreate(addButton) },
    },
    h("img", { class: "vault-icon", attrs: { src: ICONS.plus, alt: "" } }),
    h("span", { l10n: "peppermint-vault-add" })
  );

  const controls = h(
    "div",
    { class: "vault-toolbar", attrs: { role: "search" } },
    search,
    section.filters.length
      ? select(section.filters, "filter", "peppermint-vault-filter-label")
      : null,
    section.sorts.length
      ? select(section.sorts, "sort", "peppermint-vault-sort-label")
      : null,
    section.createFields.length ? addButton : null
  );

  const element = h(
    "section",
    { class: "vault-section" },
    controls,
    count,
    list,
    empty,
    noResults
  );

  function mask(id, field) {
    const key = `${id}:${field}`;
    const entry = revealed.get(key);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    revealed.delete(key);
    entry.value.textContent = MASK;
    entry.toggle.setAttribute("aria-pressed", "false");
    entry.toggle.querySelector("img").src = ICONS.eye;
    document.l10n.setAttributes(entry.toggle, "peppermint-vault-reveal", {
      site: entry.site,
    });
  }

  function maskAll() {
    for (const key of [...revealed.keys()]) {
      const [id, field] = key.split(":");
      mask(id, field);
    }
  }

  async function reveal(item, field, valueElement, toggle) {
    const key = `${item.id}:${field.id}`;
    if (revealed.has(key)) {
      mask(item.id, field.id);
      return;
    }
    try {
      valueElement.textContent = await api.call("getSecret", item.id, field.id);
    } catch (error) {
      showFailure(error);
      return;
    }
    toggle.setAttribute("aria-pressed", "true");
    toggle.querySelector("img").src = ICONS.eyeSlash;
    document.l10n.setAttributes(toggle, "peppermint-vault-hide", {
      site: item.title,
    });
    revealed.set(key, {
      value: valueElement,
      toggle,
      site: item.title,
      timer: setTimeout(() => mask(item.id, field.id), REVEAL_MS),
    });
  }

  async function copy(item, field) {
    try {
      await api.call("copy", item.id, field.id);
      const seconds = Services.prefs.getIntPref(
        "peppermint.vault.clipboard-clear-seconds",
        30
      );
      toast(
        seconds > 0
          ? "peppermint-vault-toast-copied-cleared"
          : "peppermint-vault-toast-copied",
        { seconds }
      );
    } catch (error) {
      showFailure(error);
    }
  }

  function showFailure(error) {
    if (error?.name == "VaultLockedError") {
      return;
    }
    if (error?.name != "VaultStepUpCancelled") {
      toast(errorL10n(error));
    }
  }

  async function openEdit(item, trigger) {
    let editable;
    try {
      editable = await api.call("getEditable", item.id);
    } catch (error) {
      showFailure(error);
      return;
    }
    openModal({
      titleL10n: "peppermint-vault-edit-title",
      submitL10n: "peppermint-vault-save",
      fields: section.editFields.map(id => fieldSpec(id, editable[id])),
      errorL10n,
      returnFocusTo: trigger,
      async onSubmit(values) {
        await api.call("update", item.id, values);
        refresh();
      },
      async onDelete() {
        await api.call("remove", item.id);
        refresh();
      },
    });
  }

  function fieldSpec(id, value = "") {
    const field = section.fields.find(f => f.id == id) ?? {
      id,
      kind: id == "origin" ? "origin" : "text",
      labelL10nId: `peppermint-vault-field-${id == "origin" ? "website" : id}`,
    };
    return {
      id,
      kind: field.kind,
      labelL10nId: field.labelL10nId ?? `peppermint-vault-field-${id}`,
      value,
      required: id == "password" || id == "origin",
    };
  }

  function openCreate(trigger) {
    openModal({
      titleL10n: "peppermint-vault-add-title",
      submitL10n: "peppermint-vault-add-submit",
      fields: section.createFields.map(id => fieldSpec(id)),
      errorL10n,
      returnFocusTo: trigger,
      async onSubmit(values) {
        await api.call("create", values);
        refresh();
      },
    });
  }

  function renderRow(item) {
    const site = item.link
      ? h("a", {
          class: "vault-site",
          attrs: { href: item.link, rel: "noopener noreferrer" },
          text: item.title,
          on: {
            click(event) {
              event.preventDefault();
              openWebLink(item.link);
            },
            auxclick(event) {
              if (event.button == 1) {
                event.preventDefault();
                openWebLink(item.link);
              }
            },
          },
        })
      : h("span", { class: "vault-site", text: item.title });

    const editButton = iconButton(ICONS.edit, "peppermint-vault-edit", {
      site: item.title,
    });
    editButton.addEventListener("click", () => openEdit(item, editButton));

    const fields = section.fields.map(field => {
      const secret = field.kind == "secret";
      const text = secret ? MASK : (item.values[field.id] ?? "");
      const value = h("span", {
        class: secret ? "vault-value vault-secret" : "vault-value",
        attrs: { title: secret ? null : text || null },
        text,
      });
      if (!secret && !item.values[field.id]) {
        value.textContent = "";
        document.l10n.setAttributes(value, "peppermint-vault-no-value");
        value.classList.add("vault-muted");
      }
      const actions = [];
      if (field.reveal) {
        const toggle = iconButton(ICONS.eye, "peppermint-vault-reveal", {
          site: item.title,
        });
        toggle.setAttribute("aria-pressed", "false");
        toggle.addEventListener("click", () =>
          reveal(item, field, value, toggle)
        );
        actions.push(toggle);
      }
      if (field.copy) {
        const copyButton = iconButton(
          ICONS.copy,
          `peppermint-vault-copy-${field.id}`,
          { site: item.title }
        );
        copyButton.addEventListener("click", () => copy(item, field));
        actions.push(copyButton);
      }
      return h(
        "div",
        { class: "vault-field-row" },
        h("dt", { l10n: field.labelL10nId }),
        h("dd", {}, value, h("span", { class: "vault-field-actions" }, actions))
      );
    });

    return h(
      "li",
      { class: "vault-row", attrs: { "data-id": item.id, tabindex: "-1" } },
      h(
        "div",
        { class: "vault-row-head" },
        h("span", {
          class: "vault-tile",
          attrs: { "aria-hidden": "true" },
          text: initialOf(item.title),
        }),
        h(
          "div",
          { class: "vault-row-title" },
          site,
          item.insecure
            ? h("span", {
                class: "vault-badge",
                l10n: "peppermint-vault-insecure",
              })
            : null
        ),
        editButton
      ),
      h("dl", { class: "vault-fields" }, fields)
    );
  }

  async function refresh() {
    const mine = ++generation;
    let items;
    try {
      items = await api.call("list", {
        query: state.query,
        filter: state.filter,
        sort: state.sort,
      });
    } catch (error) {
      showFailure(error);
      return;
    }
    if (mine != generation) {
      return;
    }
    maskAll();
    clear(list);
    list.append(...items.map(renderRow));
    const filtered = !!state.query.trim() || state.filter != "all";
    empty.hidden = !!items.length || filtered;
    noResults.hidden = !!items.length || !filtered;
    list.hidden = !items.length;
    document.l10n.setAttributes(count, "peppermint-vault-result-count", {
      count: items.length,
    });
  }

  element.addEventListener("keydown", event => {
    if (event.key != "ArrowDown" && event.key != "ArrowUp") {
      return;
    }
    if (event.target.closest("select, dialog")) {
      return;
    }
    const rows = [...list.querySelectorAll(".vault-row")];
    const current = event.target.closest(".vault-row");
    const index = current ? rows.indexOf(current) : -1;
    const next = rows[index + (event.key == "ArrowDown" ? 1 : -1)];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  });

  return {
    element,
    refresh,
    focusSearch: () => search.focus(),
    destroy() {
      clearTimeout(searchTimer);
      generation++;
      maskAll();
      clear(list);
    },
  };
}
