import pluginCss from './styles.scss';
import { config, version as packageVersion } from '../package.json';

export interface PluginOptions {
  id: string;
  version: string;
  rootURI: string;
  stylesId?: string;
}

const CONTRAST_PREFS_KEY = `${config.prefsPrefix}.contrast`;
const CONTRAST_MIN = 80;
const CONTRAST_MAX = 200;
const CONTRAST_STEP = 20;
const CONTRAST_TICKS = Array.from(
  { length: (CONTRAST_MAX - CONTRAST_MIN) / CONTRAST_STEP + 1 },
  (_, i) => {
    const pct = (i / ((CONTRAST_MAX - CONTRAST_MIN) / CONTRAST_STEP)) * 100;
    return `${pct.toFixed(2)}%`;
  },
);

export class Plugin {
  readonly id: string;
  readonly stylesId: string;
  readonly version: string;
  readonly rootURI: string;

  #isActive: boolean = true;
  get isActive(): boolean {
    return this.#isActive;
  }

  #contrastValues = new Map<string, number>();
  #appearanceObservers = new Map<string, MutationObserver>();
  #defaultContrast: number = 100;

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
    const stored = Zotero.Prefs.get(CONTRAST_PREFS_KEY);
    if (typeof stored === 'number') {
      this.#defaultContrast = stored;
    }
    this.addToAllWindows();
    this.registerObserver();
    this.#registerToolbarListener();
    await this.styleExistingTabs();
  }

  shutdown(): void {
    this.removeFromAllWindows();
    this.unregisterObserver();
    this.#unregisterToolbarListener();
    for (const observer of this.#appearanceObservers.values()) {
      observer.disconnect();
    }
    this.#appearanceObservers.clear();
  }

  #registerToolbarListener() {
    this.#toolbarEventHandler = ({ reader, doc }) => {
      this.log(
        `renderToolbar fired: tabID=${reader.tabID} doc.URL=${doc.URL} body=${!!doc.body}`,
      );
      if (!reader._iframeWindow) return;
      this.#observeAppearancePanel(reader);
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

  addToWindow(window: _ZoteroTypes.MainWindow): void {
    this.addMenuItems(window);
  }

  addToAllWindows(): void {
    Zotero.getMainWindows().forEach((win) => {
      if (!win.ZoteroPane) return;
      this.addToWindow(win);
    });
  }

  removeFromWindow(window: _ZoteroTypes.MainWindow): void {
    this.removeMenuItems(window);
  }

  removeFromAllWindows(): void {
    Zotero.getMainWindows().forEach((win) => {
      if (!win.ZoteroPane) return;
      this.removeFromWindow(win);
    });
  }

  async attachStylesToReader(reader: _ZoteroTypes.ReaderInstance) {
    await reader._waitForReader();
    await reader._initPromise;
    const pdfDoc: Document | undefined =
      // @ts-expect-error no types for _internalReader._primaryView
      reader?._internalReader?._primaryView?._iframeWindow?.document;
    if (!pdfDoc || !pdfDoc.documentElement) {
      this.log(`couldn't attach styles; tab ${reader.tabID} not ready`);
      return;
    }
    const contrast =
      this.#contrastValues.get(reader.tabID) ?? this.#defaultContrast;
    this.#applyContrast(pdfDoc, contrast);

    // Fallback for tabs already open when the plugin loads — renderToolbar won't
    // fire for them, so set up the appearance panel observer directly.
    const outerDoc = reader?._iframeWindow?.document;
    this.log(
      `attachStylesToReader fallback: tabID=${reader.tabID} outerDoc=${!!outerDoc} outerDoc.URL=${outerDoc?.URL}`,
    );
    if (outerDoc && reader._iframeWindow) {
      this.#observeAppearancePanel(reader);
    }
  }

  #applyContrast(pdfDoc: Document, contrast: number) {
    const root = pdfDoc.documentElement as HTMLElement;
    if (contrast === 100) {
      pdfDoc.getElementById(this.stylesId)?.remove();
      root.style.removeProperty('--pdf-contrast');
    } else {
      if (!pdfDoc.getElementById(this.stylesId)) {
        const styles = pdfDoc.createElement('style');
        styles.id = this.stylesId;
        styles.innerText = pluginCss;
        pdfDoc.documentElement?.appendChild(styles);
      }
      root.style.setProperty('--pdf-contrast', `${contrast}%`);
    }
  }

  #observeAppearancePanel(reader: _ZoteroTypes.ReaderInstance) {
    const tabID = reader.tabID;
    this.#appearanceObservers.get(tabID)?.disconnect();

    const doc = reader._iframeWindow?.document;
    const iframeWindow = doc?.defaultView;
    if (!doc || !iframeWindow) {
      this.log(`observeAppearancePanel: no document for tabID=${tabID}`);
      return;
    }

    const observeRoot = doc.body ?? doc.documentElement;
    if (!observeRoot) {
      this.log(
        `observeAppearancePanel: no body or documentElement for tabID=${tabID}, URL=${doc.URL}`,
      );
      return;
    }

    const pdfDoc: Document | undefined =
      // @ts-expect-error no types for _internalReader._primaryView
      reader?._internalReader?._primaryView?._iframeWindow?.document;
    if (!pdfDoc) {
      this.log(
        `observeAppearancePanel: no PDF document for tabID=${tabID}, URL=${doc.URL}`,
      );
      return;
    }

    const slider = this.createContrastSlider(reader, (contrast) => {
      this.#contrastValues.set(tabID, contrast);
      this.#applyContrast(pdfDoc, contrast);
      this.#defaultContrast = contrast;
      Zotero.Prefs.set(CONTRAST_PREFS_KEY, contrast);
    });
    if (!slider) {
      this.log(
        `observeAppearancePanel: couldn't create contrast slider; tabID=${tabID}, URL=${doc.URL}`,
      );
      return;
    }

    this.log(
      `observeAppearancePanel: setting up observer on tabID=${tabID} root=${observeRoot.tagName} URL=${doc.URL}`,
    );

    const observer = new iframeWindow.MutationObserver(
      (mutations: MutationRecord[]) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof iframeWindow.Element)) continue;
            const elem = node as Element;
            this.log(
              `MutationObserver node added: tag=${elem.tagName} classes="${elem.className}"`,
            );
            // React may add a wrapper (e.g. .toolbar-popup-overlay) containing
            // the popup rather than the popup itself, so check descendants too.
            const popup = elem.classList.contains('appearance-popup')
              ? elem
              : elem.querySelector('.appearance-popup');
            this.log(`  → popup found: ${!!popup}`);
            if (popup && !popup.querySelector('[data-contrast-slider]')) {
              popup.prepend(slider);
            }
          }
        }
      },
    );

    observer.observe(observeRoot, { childList: true, subtree: true });
    this.#appearanceObservers.set(tabID, observer);
    this.log(`observeAppearancePanel: observer active for tabID=${tabID}`);
  }

  createContrastSlider(
    reader: _ZoteroTypes.ReaderInstance,
    callback: (contrast: number) => void,
  ): HTMLDivElement | null {
    const doc = reader._iframeWindow?.document;
    if (!doc) return null;

    const group = doc.createElement('div');
    group.className = 'group';
    group.setAttribute('data-contrast-slider', '');

    const row = doc.createElement('div');
    row.className = 'row';

    const label = doc.createElement('label');
    label.setAttribute('for', 'contrast-slider');
    label.textContent = 'Contrast';

    const tickedRange = doc.createElement('div');
    tickedRange.className = 'ticked-range-input';

    const tickBar = doc.createElement('div');
    tickBar.className = 'tick-bar';
    for (const position of CONTRAST_TICKS) {
      const tick = doc.createElement('div');
      tick.className = 'tick';
      tick.style.setProperty('--position', position);
      tickBar.appendChild(tick);
    }

    const contrast =
      this.#contrastValues.get(reader.tabID) ?? this.#defaultContrast;

    const input = doc.createElement('input');
    input.type = 'range';
    input.id = 'contrast-slider';
    input.min = String(CONTRAST_MIN);
    input.max = String(CONTRAST_MAX);
    input.step = String(CONTRAST_STEP);
    input.value = String(contrast);
    input.setAttribute('data-tabstop', '1');
    input.setAttribute('tabindex', '-1');
    input.style.cssText = 'position: relative; width: 100%;';

    tickedRange.appendChild(tickBar);
    tickedRange.appendChild(input);

    const valueSpan = doc.createElement('span');
    valueSpan.className = 'value';
    valueSpan.textContent = `${contrast}%`;

    input.addEventListener('input', () => {
      const value = Number(input.value);
      valueSpan.textContent = `${value}%`;
      callback(value);
    });

    row.appendChild(label);
    row.appendChild(tickedRange);
    row.appendChild(valueSpan);
    group.appendChild(row);
    return group;
  }

  async styleExistingTabs() {
    this.log('adding styles to existing tabs');
    const readers = Zotero.Reader._readers;
    this.log(
      `found ${readers.length} reader tags: ${readers.map((r) => r.tabID).join(', ')}`,
    );
    await Promise.all(readers.map((r) => this.attachStylesToReader(r)));
    this.log('done adding styles to existing tabs');
  }

  #observerID?: string;
  registerObserver() {
    this.log('registering tab observer');
    if (this.#observerID) {
      throw new Error(`${this.id}: observer is already registered`);
    }
    this.#observerID = Zotero.Notifier.registerObserver(
      {
        notify: async (event, type, ids, extraData) => {
          // @ts-expect-error zotero-types doesn't include 'load' in the event definition, but tabs have a load event
          if ((event === 'add' || event === 'load') && type === 'tab') {
            const tabIDs = ids.filter((id) => extraData[id].type === 'reader');
            await Promise.all(
              tabIDs.map(async (id) => {
                const reader = Zotero.Reader.getByTabID(id.toString());
                await this.attachStylesToReader(reader);
              }),
            );
          }
        },
      },
      ['tab'],
    );
    this.log('registered observer: ' + this.#observerID);
  }

  unregisterObserver() {
    if (this.#observerID) {
      this.log('unregistering observer: ' + this.#observerID);
      Zotero.Notifier.unregisterObserver(this.#observerID);
      this.#observerID = undefined;
    }
  }

  addMenuItems(window: _ZoteroTypes.MainWindow): void {
    const doc = window.document;
    const menuId = `${config.addonRef}-menu-item`;
    if (doc.getElementById(menuId)) {
      this.log('toolbar menu already attached');
      return;
    }

    window.MozXULElement.insertFTLIfNeeded(`${config.addonRef}-menu.ftl`);

    const menuitem = doc.createXULElement('menuitem') as XULMenuItemElement;
    menuitem.id = menuId;
    menuitem.classList.add('menu-type-reader');
    menuitem.setAttribute('type', 'checkbox');
    menuitem.setAttribute('data-l10n-id', menuId);

    menuitem.addEventListener('command', async (_e: CommandEvent) => {
      const isChecked = menuitem.getAttribute('checked') === 'true';
      this.#isActive = isChecked;
    });

    const viewMenu = doc.getElementById('menu_viewPopup');
    const referenceNode =
      viewMenu?.querySelector('menuseparator.menu-type-library') || null;
    const inserted = viewMenu?.insertBefore(menuitem, referenceNode);

    if (inserted) {
      this.log(`successfully inserted menuitem: ${menuitem.id}`);
      this.storeAddedElement(menuitem);
    }
  }

  removeMenuItems(window: _ZoteroTypes.MainWindow): void {
    const doc = window.document;
    for (const id of this.#addedElementIDs) {
      doc.getElementById(id)?.remove();
    }
  }

  #addedElementIDs: string[] = [];
  storeAddedElement(elem: Element) {
    if (!elem.id) {
      throw new Error('Element must have an id');
    }
    this.#addedElementIDs.push(elem.id);
  }

  log(msg: string) {
    Zotero.log(`[${config.addonName}] ${msg}`);
  }
}
