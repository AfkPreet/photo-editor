import type { Preset } from './types';
import { gradePreset } from './grade';
import { cutoutPreset } from './cutout';
import { blobsPreset } from './blobs';
import { detectPreset } from './detect';

export const PRESETS: Preset[] = [gradePreset, cutoutPreset, blobsPreset, detectPreset];

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}
