# Alpine markup cheat sheet

Load from [SKILL.md](SKILL.md). Confirm names against current Alpine 3 docs (context7 `/websites/alpinejs_dev`).

## Directives

| Directive | Use |
|-----------|-----|
| `x-data` | Named component (`x-data="monitor"`) or a tiny literal for toys |
| `x-init` | One-shot after the component is ready (prefer methods on the factory) |
| `x-on` / `@` | Events. `@click.prevent`, `@click.outside`, `@keydown.escape` |
| `x-bind` / `:` | Attributes. `:aria-expanded="open"`, `:class` for existing utilities |
| `x-text` | Text. Never `x-html` for untrusted CI names |
| `x-show` | Toggle `display`. Prefer this over `x-if` for menus and lists |
| `x-if` | `<template x-if>` when the node must leave the DOM |
| `x-transition` | Optional motion on `x-show`; not a substitute for `aria-expanded` |
| `x-for` | `<template x-for="row in repos" :key="row.repo">` |
| `x-model` | Native inputs only |
| `x-ref` | Escape hatch for focus; do not querySelector the whole page |
| `x-cloak` | Hide until Alpine starts |
| `x-ignore` | Third-party widgets Alpine must not walk |

## Factory shape

```javascript
document.addEventListener('alpine:init', () => {
  Alpine.data('dropdown', () => ({
    open: false,
    toggle() {
      this.open = !this.open
    },
    close() {
      this.open = false
    },
  }))
})
```

```html
<div x-data="dropdown">
  <button type="button" @click="toggle" :aria-expanded="open">Menu</button>
  <div x-show="open" x-transition @click.outside="close" @keydown.escape.window="close">…</div>
</div>
```

On `@alpinejs/csp`, assignments in the template are invalid. Use `toggle()` / `close()` only.

## Magics (use sparingly)

`$el`, `$refs`, `$dispatch`, `$watch`, `$nextTick`. `$store` only for global chrome.
