import type { Preset, Category } from './types';
import { LOOK_PRESETS } from './looks';
import { cutoutPreset } from './cutout';
import { blobsPreset } from './blobs';
import { detectPreset } from './detect';

export const PRESETS: Preset[] = [...LOOK_PRESETS, cutoutPreset, blobsPreset, detectPreset];

export const CATEGORIES: { id: Category | 'all'; label: string; blurb: string }[] = [
  { id: 'all', label: 'All', blurb: 'Every look' },
  { id: 'colour', label: 'Colour', blurb: 'Film and print colour, from Kodachrome to blue hour' },
  { id: 'mono', label: 'Mono', blurb: 'Black and white, from the zone system to grainy street' },
  { id: 'graphic', label: 'Graphic', blurb: 'Shape cut-out diptychs' },
  { id: 'vision', label: 'Vision', blurb: 'Machine-vision overlays and detection fragments' },
];

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}
