# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Zotero 7 plugin that injects custom CSS styles into PDF reader windows. Built on a simplified personal template that drops the zotero-plugin-toolkit dependency and targets Zotero 7 only.

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

**`src/plugin.ts`** — Core plugin logic compiled by esbuild into the bundle loaded above. The `Plugin` class:
- Uses an observer (`Zotero.Notifier`) to watch for tab add/load events and call `attachStylesToReader()` on new PDF readers
- Injects `styles.scss` (compiled to CSS at build time) as a `<style>` element into PDF reader iframes
- Adds a checkbox menu item to the View menu to toggle the plugin active state via `Plugin.#isActive`

**`zotero-plugin.config.ts`** — Build config using zotero-plugin-scaffold + esbuild. Bundles `src/index.ts` with esbuild-sass-plugin for SCSS support, targeting Firefox 115+. Output goes to `.scaffold/build/`.

## Key Constraint

ESLint enforces using `Zotero.getMainWindow()` instead of the global `window` — global DOM access is unsafe in Zotero's multi-window environment.
