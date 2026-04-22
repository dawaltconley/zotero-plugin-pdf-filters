import pluginCss from './styles.scss';
import { createSlider, createSliderGroup, type SliderConfig } from './slider';
import { isPDFReader, waitForReader, waitForInternalReader } from './utils';
import { config, version as packageVersion } from '../package.json';
import debounce from 'lodash.debounce';

const CONTRAST_CONFIG: SliderConfig = {
  min: 80,
  max: 360,
  step: 10,
  label: 'Contrast',
  dataAttr: 'contrast-slider',
  inputId: 'contrast-slider',
};

const BRIGHTNESS_CONFIG: SliderConfig = {
  min: 50,
  max: 150,
  step: 5,
  label: 'Brightness',
  dataAttr: 'brightness-slider',
  inputId: 'brightness-slider',
};

const PREFS = {
  defaultContrast: `${config.prefsPrefix}.default-contrast`,
  defaultBrightness: `${config.prefsPrefix}.default-brightness`,
  contrastValues: `${config.prefsPrefix}.contrast-values`,
  brightnessValues: `${config.prefsPrefix}.brightness-values`,
} satisfies Record<string, string>;

export interface PluginOptions {
  id: string;
  version: string;
  rootURI: string;
  stylesId?: string;
}

export class Plugin {
  readonly id: string;
  readonly stylesId: string;
  readonly version: string;
  readonly rootURI: string;

  #contrastValues: Map<string, number> = new Map();
  #brightnessValues: Map<string, number> = new Map();
  #defaultContrast: number = 100;
  #defaultBrightness: number = 100;
  #appearanceObservers = new Map<string, MutationObserver>();

  getContrast(reader: _ZoteroTypes.ReaderInstance): number {
    return this.#contrastValues.get(reader._item.key) ?? this.#defaultContrast;
  }

  setContrast(reader: _ZoteroTypes.ReaderInstance, contrast: number): void {
    const key = reader._item.key;
    if (contrast === this.#defaultContrast) {
      this.#contrastValues.delete(key);
    } else {
      this.#contrastValues.set(key, contrast);
    }
  }

  getBrightness(reader: _ZoteroTypes.ReaderInstance): number {
    return (
      this.#brightnessValues.get(reader._item.key) ?? this.#defaultBrightness
    );
  }

  setBrightness(reader: _ZoteroTypes.ReaderInstance, brightness: number): void {
    const key = reader._item.key;
    if (brightness === this.#defaultBrightness) {
      this.#brightnessValues.delete(key);
    } else {
      this.#brightnessValues.set(key, brightness);
    }
  }

  getDefaultContrast(): number | null {
    const contrast = Number(Zotero.Prefs.get(PREFS.defaultContrast, true));
    return Number.isNaN(contrast) ? null : contrast;
  }

  setDefaultContrast(contrast: number): void {
    Zotero.Prefs.set(PREFS.defaultContrast, contrast, true);
    this.#defaultContrast = contrast;
  }

  getDefaultBrightness(): number | null {
    const brightness = Number(Zotero.Prefs.get(PREFS.defaultBrightness, true));
    return Number.isNaN(brightness) ? null : brightness;
  }

  setDefaultBrightness(brightness: number): void {
    Zotero.Prefs.set(PREFS.defaultBrightness, brightness, true);
    this.#defaultBrightness = brightness;
  }

  getSavedValues(prefsKey: string): Map<string, number> | null {
    try {
      const raw = Zotero.Prefs.get(prefsKey, true);
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object') {
          return new Map(Object.entries(parsed as Record<string, number>));
        }
      }
    } catch (e) {
      this.log(`error retrieving saved pref ${prefsKey}: ${e}`);
    }
    return null;
  }

  setSavedValues(prefsKey: string, values: Map<string, number>): void {
    Zotero.Prefs.set(
      prefsKey,
      JSON.stringify(Object.fromEntries(values)),
      true,
    );
  }

  constructor({
    id = config.addonID,
    stylesId = `${config.addonRef}__pluginStyles`,
    version = packageVersion,
    rootURI,
  }: PluginOptions) {
    this.id = id;
    this.stylesId = stylesId;
    this.version = version;
    this.rootURI = rootURI;
  }

  #toolbarEventHandler?: _ZoteroTypes.Reader.EventHandler<'renderToolbar'>;

  async startup(): Promise<void> {
    this.#defaultContrast = this.getDefaultContrast() ?? 100;
    this.#defaultBrightness = this.getDefaultBrightness() ?? 100;
    this.#contrastValues =
      this.getSavedValues(PREFS.contrastValues) ?? new Map();
    this.#brightnessValues =
      this.getSavedValues(PREFS.brightnessValues) ?? new Map();
    this.#registerToolbarListener();
    await this.styleExistingTabs();
  }

  shutdown(): void {
    this.setSavedValues(PREFS.contrastValues, this.#contrastValues);
    this.setSavedValues(PREFS.brightnessValues, this.#brightnessValues);
    this.#unregisterToolbarListener();
    for (const observer of this.#appearanceObservers.values()) {
      observer.disconnect();
    }
    this.#appearanceObservers.clear();
  }

  #registerToolbarListener() {
    this.#toolbarEventHandler = async ({ reader, doc }) => {
      this.log(
        `renderToolbar fired: tabID=${reader.tabID} doc.URL=${doc.URL} body=${!!doc.body}`,
      );
      if (!isPDFReader(reader)) return;
      await this.attachStylesToReader(reader);
    };
    Zotero.Reader.registerEventListener(
      'renderToolbar',
      this.#toolbarEventHandler,
      this.id,
    );
  }

  #unregisterToolbarListener() {
    if (this.#toolbarEventHandler) {
      Zotero.Reader.unregisterEventListener(
        'renderToolbar',
        this.#toolbarEventHandler,
      );
      this.#toolbarEventHandler = undefined;
    }
  }

  async attachStylesToReader(reader: _ZoteroTypes.ReaderInstance<'pdf'>) {
    await waitForReader(reader);
    await waitForInternalReader(reader);

    this.applyFilters(reader);
    this.addSliders(reader);

    this.log(`attachStylesToReader: tabID=${reader.tabID}`);
  }

  applyFilters(reader: _ZoteroTypes.ReaderInstance<'pdf'>): void {
    const contrast = this.getContrast(reader);
    const brightness = this.getBrightness(reader);

    const pdfDoc: Document | undefined =
      reader._internalReader._primaryView._iframeWindow?.document;
    if (!pdfDoc || !pdfDoc.documentElement) {
      this.log(`applyFilters: tab ${reader.tabID} not ready`);
      return;
    }

    const root = (pdfDoc.documentElement as HTMLElement | null) || pdfDoc.body;
    if (!root) return;

    if (contrast === 100 && brightness === 100) {
      pdfDoc.getElementById(this.stylesId)?.remove();
      root.style.removeProperty('--pdf-contrast');
      root.style.removeProperty('--pdf-brightness');
    } else {
      if (!pdfDoc.getElementById(this.stylesId)) {
        const styles = pdfDoc.createElement('style');
        styles.id = this.stylesId;
        styles.innerText = pluginCss;
        pdfDoc.documentElement.appendChild(styles);
      }
      if (contrast !== 100) {
        root.style.setProperty('--pdf-contrast', `${contrast}%`);
      } else {
        root.style.removeProperty('--pdf-contrast');
      }
      if (brightness !== 100) {
        root.style.setProperty('--pdf-brightness', `${brightness}%`);
      } else {
        root.style.removeProperty('--pdf-brightness');
      }
    }
  }

  /** Add sliders to the appearance panel when it is opened. */
  addSliders(reader: _ZoteroTypes.ReaderInstance<'pdf'>) {
    const tabID = reader.tabID;
    this.#appearanceObservers.get(tabID)?.disconnect();

    const doc = reader._iframeWindow?.document;
    const iframeWindow = doc?.defaultView;
    if (!doc || !iframeWindow) {
      this.log(`addSliders: no document for tabID=${tabID}`);
      return;
    }

    const observeRoot = doc.getElementById('reader-ui');
    if (!observeRoot) {
      this.log(`addSliders: no reader-ui for tabID=${tabID}, URL=${doc.URL}`);
      return;
    }

    const DEBOUNCE_TIMEOUT = 4000;
    const saveBrightness = debounce(
      this.setSavedValues.bind(this, PREFS.brightnessValues),
      DEBOUNCE_TIMEOUT,
    );
    const saveContrast = debounce(
      this.setSavedValues.bind(this, PREFS.contrastValues),
      DEBOUNCE_TIMEOUT,
    );

    const brightnessSlider = createSlider(
      doc,
      this.getBrightness(reader),
      (brightness) => {
        this.setBrightness(reader, brightness);
        this.applyFilters(reader);
        saveBrightness(this.#brightnessValues);
      },
      BRIGHTNESS_CONFIG,
    );

    const contrastSlider = createSlider(
      doc,
      this.getContrast(reader),
      (contrast) => {
        this.setContrast(reader, contrast);
        this.applyFilters(reader);
        saveContrast(this.#contrastValues);
      },
      CONTRAST_CONFIG,
    );

    const groupDataAttr = 'pdf-sliders';
    const group = createSliderGroup(doc, groupDataAttr);
    group.appendChild(brightnessSlider);
    group.appendChild(contrastSlider);

    const observer = new iframeWindow.MutationObserver(
      (mutations: MutationRecord[]) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof iframeWindow.Element)) continue;
            const elem = node as Element;
            const popup = elem.classList.contains('appearance-popup')
              ? elem
              : elem.querySelector('.appearance-popup');
            if (popup && !popup.querySelector(`[data-${groupDataAttr}]`)) {
              popup.prepend(group);
            }
          }
        }
      },
    );

    observer.observe(observeRoot, { childList: true, subtree: false });
    this.#appearanceObservers.set(tabID, observer);
    this.log(`addSliders: observer active for tabID=${tabID}`);
  }

  async styleExistingTabs() {
    this.log('adding styles to existing tabs');
    const readers = Zotero.Reader._readers;
    this.log(
      `found ${readers.length} reader tags: ${readers.map((r) => r.tabID).join(', ')}`,
    );
    await Promise.all(
      readers.map((r) => isPDFReader(r) && this.attachStylesToReader(r)),
    );
    this.log('done adding styles to existing tabs');
  }

  log(
    msg: string,
    type: 'error' | 'warning' | 'exception' | 'strict' = 'warning',
  ) {
    Zotero.log(`[${config.addonName}] ${msg}`, type);
  }
}
