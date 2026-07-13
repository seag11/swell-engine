export interface Preset {
  label: string;
  lat: number;
  lon: number;
  facing: number;
}

export const PRESETS: Preset[] = [
  { label: 'Ocean Beach, SF', lat: 37.757, lon: -122.51, facing: 270 },
  { label: 'Mavericks, CA', lat: 37.495, lon: -122.497, facing: 310 },
  { label: 'Trestles, CA', lat: 33.383, lon: -117.589, facing: 230 },
  { label: 'Pipeline, HI', lat: 21.665, lon: -158.053, facing: 345 },
  { label: 'Montauk, NY', lat: 41.036, lon: -71.952, facing: 160 },
  { label: 'Cocoa Beach, FL', lat: 28.32, lon: -80.608, facing: 90 },
];
