# Zotero PDF Filters

A [Zotero](https://www.zotero.org/) plugin that adds CSS filter sliders to the
PDF reader's Appearance panel.

![Brightness and Contrast sliders in the Zotero PDF reader Appearance 
panel](example.png)

## Features

- **Brightness** slider (50–150%, step 5%)
- **Contrast** slider (80–360%, step 10%)
- **Saturation** slider (0–200%, step 10%)
- **Grayscale** slider (0–100%, step 5%)
- **Sepia** slider (0–100%, step 5%)
- **Hue Rotate** slider (0–360°, step 15°)
- **Invert** slider (0–100%, step 5%)
- Each filter can be enabled or disabled independently in **Tools → Preferences → Plugins**
- Disabled filters apply their global default value silently (no slider shown)
- Per-document values are saved and restored when you reopen a document
- Default values for each filter are configurable in **Tools → Preferences → Plugins**
- Changing a default value in Preferences updates all currently open tabs immediately

## Installation

Download the latest `.xpi` from [Releases](../../releases) and drag it onto the
Zotero window, or install via **Tools → Plugins → Install Plugin From File**.

## Development

Copy `.env.example` to `.env` and set `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` and
`ZOTERO_PLUGIN_PROFILE_PATH`, then:

```bash
npm install
npm run dev     # hot-reload dev server
npm run build   # production build + type check
```

## Known Limitations

- This plugin only supports Zotero 7 and higher
- In version before Zotero 10, the contrast / brightness filters also affect
  annotations.
