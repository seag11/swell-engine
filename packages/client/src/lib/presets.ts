export interface Preset {
  label: string;
  lat: number;
  lon: number;
  facing: number;
}

// No Pacific Northwest break either: the buoys covering that coast (46029,
// 46041, 46022) regularly report WVHT as MM, so a preset there would look
// broken rather than empty. Arbitrary coordinates still work.
export const PRESETS: Preset[] = [
  { label: 'Ocean Beach, SF', lat: 37.757, lon: -122.51, facing: 270 },
  { label: 'Mavericks, CA', lat: 37.495, lon: -122.497, facing: 310 },
  { label: 'Trestles, CA', lat: 33.383, lon: -117.589, facing: 230 },
  { label: 'Montauk, NY', lat: 41.036, lon: -71.952, facing: 160 },
  { label: 'Cocoa Beach, FL', lat: 28.32, lon: -80.608, facing: 90 },
];
