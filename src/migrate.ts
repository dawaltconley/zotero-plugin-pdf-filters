import { FILTERS, filterPref, type FilterID } from './filters';
import { config } from '../package.json';

declare const Services: {
  prefs: {
    prefHasUserValue(key: string): boolean;
    clearUserPref(key: string): void;
  };
};

function oldFilterPref(
  id: FilterID,
  type: 'enabled' | 'default' | 'values',
): string {
  const base = config.prefsPrefix;
  if (type === 'enabled') return `${base}.enabled-${id}`;
  if (type === 'default') return `${base}.default-${id}`;
  return `${base}.${id}-values`;
}

function migrateOnePref(oldKey: string, newKey: string): void {
  if (!Services.prefs.prefHasUserValue(oldKey)) return;
  if (!Services.prefs.prefHasUserValue(newKey)) {
    const value = Zotero.Prefs.get(oldKey, true);
    if (value !== undefined) {
      Zotero.Prefs.set(newKey, value as string | number | boolean, true);
    }
  }
  Services.prefs.clearUserPref(oldKey);
}

export function migratePrefs(): void {
  for (const filter of FILTERS) {
    migrateOnePref(
      oldFilterPref(filter.id, 'enabled'),
      filterPref(filter.id, 'enabled'),
    );
    migrateOnePref(
      oldFilterPref(filter.id, 'default'),
      filterPref(filter.id, 'default'),
    );
    migrateOnePref(
      oldFilterPref(filter.id, 'values'),
      filterPref(filter.id, 'values'),
    );
  }
}
