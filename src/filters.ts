import type { SliderConfig } from './slider';
import { config } from '../package.json';

const FILTER_IDS = [
  'brightness',
  'contrast',
  'saturate',
  'grayscale',
  'sepia',
  'hue-rotate',
  'invert',
] as const;

export type FilterID = (typeof FILTER_IDS)[number];

export interface FilterDescriptor<T = FilterID> {
  readonly id: T;
  readonly cssVar: string;
  readonly unit?: string;
  readonly neutral: number;
  readonly enabledByDefault: boolean;
  readonly slider: Pick<SliderConfig, 'min' | 'max' | 'step' | 'label'>;
}

type FilterRecord = {
  [id in FilterID]: FilterDescriptor<id>;
};

const FILTER_RECORD: FilterRecord = {
  brightness: {
    id: 'brightness',
    cssVar: '--pdf-brightness',
    unit: '%',
    neutral: 100,
    enabledByDefault: true,
    slider: { min: 50, max: 150, step: 5, label: 'Brightness' },
  },
  contrast: {
    id: 'contrast',
    cssVar: '--pdf-contrast',
    unit: '%',
    neutral: 100,
    enabledByDefault: true,
    slider: { min: 80, max: 360, step: 10, label: 'Contrast' },
  },
  saturate: {
    id: 'saturate',
    cssVar: '--pdf-saturate',
    unit: '%',
    neutral: 100,
    enabledByDefault: false,
    slider: { min: 0, max: 200, step: 10, label: 'Saturation' },
  },
  grayscale: {
    id: 'grayscale',
    cssVar: '--pdf-grayscale',
    unit: '%',
    neutral: 0,
    enabledByDefault: false,
    slider: { min: 0, max: 100, step: 5, label: 'Grayscale' },
  },
  sepia: {
    id: 'sepia',
    cssVar: '--pdf-sepia',
    unit: '%',
    neutral: 0,
    enabledByDefault: false,
    slider: { min: 0, max: 100, step: 5, label: 'Sepia' },
  },
  'hue-rotate': {
    id: 'hue-rotate',
    cssVar: '--pdf-hue-rotate',
    unit: 'deg',
    neutral: 0,
    enabledByDefault: false,
    slider: { min: 0, max: 360, step: 15, label: 'Hue Rotate' },
  },
  invert: {
    id: 'invert',
    cssVar: '--pdf-invert',
    unit: '%',
    neutral: 0,
    enabledByDefault: false,
    slider: { min: 0, max: 100, step: 5, label: 'Invert' },
  },
};

export const isFilterID = (string: string): string is FilterID =>
  string in FILTER_RECORD;

export const FILTERS: FilterDescriptor[] = FILTER_IDS.map(
  (id) => FILTER_RECORD[id],
);

export function getFilter<T extends FilterID>(id: T): FilterDescriptor<T> {
  return FILTER_RECORD[id];
}

export function filterPref(
  id: FilterID,
  type: 'enabled' | 'default' | 'values',
): string {
  return `${config.prefsPrefix}.${id}.${type}`;
}
