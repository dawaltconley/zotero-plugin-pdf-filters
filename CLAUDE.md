# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Zotero 7 plugin that adds Brightness and Contrast sliders to the PDF reader's Appearance panel. Built on a simplified personal template that drops the zotero-plugin-toolkit dependency and targets Zotero 7 only.

## Commands

```bash
npm run dev          # Start local dev server with hot reload (requires .env)
npm run build        # Build plugin and type-check
npm run lint:check   # Check formatting and linting
npm run lint:fix     # Auto-fix formatting and linting issues
npm run release      # Create versioned release
```

Before running `npm run dev`, copy `.env.example` to `.env` and set `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` and `ZOTERO_PLUGIN_PROFILE_PATH`.

## Architecture

The plugin has two layers that connect through the build pipeline:

**`addon/bootstrap.js`** — Firefox/XUL extension entry point. Runs in Zotero's privileged scope. Handles Firefox lifecycle hooks (`startup`, `shutdown`, `onMainWindowLoad`, `onMainWindowUnload`), registers the chrome manifest, loads the compiled TypeScript bundle via `Services.scriptloader`, and manages `Plugin` class instantiation per window.

**`src/filters.ts`** — Centralises all filter definitions. Exports `FILTERS` (ordered array of `FilterDescriptor`), `getFilter(id)`, `filterPref(id, type)` (builds pref keys for `enabled`, `default`, and `values` subtypes), and `isFilterID`. The seven supported filters are: `brightness`, `contrast`, `saturate`, `grayscale`, `sepia`, `hue-rotate`, `invert`. Each descriptor carries its CSS variable name, unit, neutral value, whether it is enabled by default, and slider range/step/label.

**`src/plugin.ts`** — Core plugin logic compiled by esbuild into the bundle loaded above. The `Plugin` class:

- On `startup()`, loads each filter's default value and saved per-document values from `Zotero.Prefs`, then registers a `Zotero.Prefs` observer on each default-value pref so that changes made in Preferences immediately re-apply filters to all open tabs (debounced 1 s).
- Listens for `Zotero.Reader.registerEventListener('renderToolbar', ...)` events to call `attachStylesToReader()` on PDF readers.
- `attachStylesToReader()` waits for both the outer reader iframe and inner PDF iframe to initialize, then calls `applyFilters()` and `addSliders()`.
- `applyFilters()` injects `styles.scss` as a `<style>` element into the **inner** PDF iframe (`reader._internalReader._primaryView._iframeWindow`) and sets a CSS custom property for each filter on its root element. When all active values are at their neutral, the style element and all properties are removed entirely.
- `addSliders()` sets up a `MutationObserver` on `#reader-ui` in the **outer** reader iframe (`reader._iframeWindow`) to detect when `.appearance-popup` is added to the DOM, then prepends sliders for every *enabled* filter into that popup. Closing the panel triggers `saveFilterValues()`.
- `isFilterEnabled(id)` reads the `enabled-<id>` pref; disabled filters skip the per-document lookup and fall back to the global default.
- Per-document filter values are keyed by `reader._item.key` (stable across tab close/reopen). The global default and per-document values are persisted via `Zotero.Prefs`.

**`src/slider.ts`** — Pure DOM helpers. `createSlider(doc, initialValue, callback, config)` builds a `.row` with a ticked range input matching Zotero's native Appearance panel style. `createSliderGroup(doc, dataAttr)` wraps multiple sliders in a `.group` div used as both a container and a duplicate-injection guard.

**`src/utils.ts`** — Reader type guards (`isPDFReader`, etc.) and async helpers (`waitForReader`, `waitForInternalReader`) that await the reader's initialization promises.

**`src/styles.scss`** — Compiled to an inline CSS string at build time. Applies all seven CSS filters to `.canvasWrapper canvas` via custom properties with neutral fallbacks (`brightness` and `contrast` default to 100%; the rest default to their neutral off-value).

**`zotero-plugin.config.ts`** — Build config using zotero-plugin-scaffold + esbuild. Bundles `src/index.ts` with esbuild-sass-plugin for SCSS support, targeting Firefox 115+. Output goes to `.scaffold/build/`.

## Two-iframe architecture

The PDF reader uses two nested iframes:

- **Outer iframe** (`reader._iframeWindow`) — React app hosting the toolbar, sidebar, and Appearance popup. This is where the `MutationObserver` and slider DOM live.
- **Inner iframe** (`reader._internalReader._primaryView._iframeWindow`) — The PDF.js canvas. This is where the CSS filter is applied.

These must not be confused: injecting styles into the wrong iframe has no visible effect.

## Key Constraint

ESLint enforces using `Zotero.getMainWindow()` instead of the global `window` — global DOM access is unsafe in Zotero's multi-window environment.
