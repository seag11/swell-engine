const toRad = (deg: number) => (deg * Math.PI) / 180;

export interface Position {
  lat: number;
  lon: number;
}

/**
 * Bearing from one position to another, degrees true.
 *
 * Equirectangular rather than great-circle: at the distance between a break and
 * its buoys the difference is far below the precision anyone reads off a
 * compass rose, and it matches how the server computes distance.
 */
export function bearingTo(from: Position, to: Position): number {
  const dy = to.lat - from.lat;
  const dx = (to.lon - from.lon) * Math.cos(toRad((from.lat + to.lat) / 2));
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}
