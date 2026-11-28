# Zen design tokens

## Format

```json
{
  "background-color": {
    "--zen-glance-close-button-background": { "value": "rgb(220, 53, 69)" },
    "--zen-glance-sidebar-background": {
      "value": { "light": "rgb(41, 41, 41)", "dark": "rgb(204, 204, 204)" }
    }
  },
  "size": {
    "--zen-toolbar-height": { "external": true, "also": ["space"] }
  }
}
```

- The top-level key is the token's category, which decides the properties it may
  be used for: `background-color`, `text-color`, `icon-color` (`fill`/`stroke`),
  `border-color`, `box-shadow`, `border-radius`, `space` (margin, padding, gap,
  inset), `size` (width, height), `font-size`, `font-weight`, `opacity`, `border`
  and `outline` (whole shorthands). `versatile-color` is shorthand for all four
  color categories, and `also` lists extra categories for a single token.
- `value` is either a string or a `{ "light", "dark" }` pair, which is written
  as `light-dark()`. Tokens with a value are generated onto `:root`, so the value
  has to be self-contained: it cannot reference another custom property that is
  overridden further down the tree.
- `"external": true` registers a custom property whose value is defined in a
  hand-written stylesheet (because it depends on state, prefs, platform or other
  properties). Only the name and category are recorded here.

## Changing tokens

Edit the JSON, then run:

```sh
npm run tokens
```

This regenerates `src/zen/common/styles/zen-tokens.css`, which `zen-theme.css`
includes.

When a value really cannot be a token (a font size relative to its parent, for
example), disable the rule for that line and say why:

```css
/* stylelint-disable-next-line stylelint-plugin-mozilla/use-design-tokens -- relative to the inherited font size */
font-size: 0.9em;
```

## Tokens Studio

Token values are managed in the "Zen Browser" project on
[Tokens Studio](https://tokens.studio) and pulled into this repository. Nothing
is pushed from the repository to Tokens Studio.

### Adding a token

Create the token in Tokens Studio, inside the group named after its category
(`space`, `background-color`, `box-shadow`, ...) and with a lowercase name that
starts with `zen-`. A color that differs between color schemes goes in both
the `light` and the `dark` set; everything else goes in `base`.

The next pull adds it to the tokens files, to
`components/<name>.tokens.json` when its name starts with that component's
name (`zen-library-...`), otherwise to `base.tokens.json`. Move it afterwards if
it belongs elsewhere. Tokens that cannot be added are listed with the reason.

Tokens whose value is computed (external tokens, `color-mix()`, `min()`, ...)
cannot live in Tokens Studio. Add those to a `*.tokens.json` file by hand and
run `npm run tokens`.
