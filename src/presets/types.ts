import type { AnyCanvas } from '../lib/canvas';

export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;

export interface SliderControl {
  kind: 'slider';
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Optional unit suffix shown after the value. */
  unit?: string;
}
export interface SelectControl {
  kind: 'select';
  key: string;
  label: string;
  options: { value: string; label: string }[];
}
export interface ToggleControl {
  kind: 'toggle';
  key: string;
  label: string;
}
export interface ColorControl {
  kind: 'color';
  key: string;
  label: string;
}
export interface ButtonControl {
  kind: 'button';
  key: string;
  label: string;
  /** Called with current params; returns a patch. */
  action: (params: Params) => Params;
}
export interface FileControl {
  kind: 'file';
  key: string;
  label: string;
  accept: string;
  /** Turns the file's text into a params patch, or returns null when it cannot be used. */
  parse: (text: string, name: string) => Params | null;
}
export interface SectionControl {
  kind: 'section';
  label: string;
  /** Collapsed by default in the panel. */
  collapsed?: boolean;
}
export type Control = SliderControl | SelectControl | ToggleControl | ColorControl | ButtonControl | FileControl | SectionControl;

export interface RenderInput {
  /** Cropped source at the resolution to render (preview or full). */
  source: AnyCanvas;
  width: number;
  height: number;
  /** True when rendering the final export (full resolution). */
  fullRes: boolean;
  /** Scale of `source` relative to the full-resolution crop (1 for export). */
  scale: number;
  params: Params;
  signal?: AbortSignal;
}

export type Category = 'colour' | 'mono' | 'graphic' | 'vision';

export interface Preset {
  id: string;
  name: string;
  tagline: string;
  category: Category;
  /** Photographers whose published work the look is inspired by (credit, not endorsement). */
  inspiredBy?: string;
  /** Render a live thumbnail of the user's photo in the look strip (default true). */
  thumbnail?: boolean;
  /** Parameter overrides used only for the strip thumbnail (e.g. a single panel instead of a diptych). */
  thumbnailParams?: Params;
  defaults: Params;
  controls: Control[];
  /** Preferred crop aspect when the preset is first chosen (w/h), or undefined for original. */
  preferredAspect?: number;
  /** Renders the look. May be async (e.g. model loading). */
  render: (input: RenderInput) => Promise<AnyCanvas>;
  /** Optional lazy preparation (model download) with progress messages. */
  prepare?: (report: (msg: string) => void) => Promise<void>;
}
