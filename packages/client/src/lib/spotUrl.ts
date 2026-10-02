/**
 * Spot coordinates live in the query string so a lookup can be shared,
 * bookmarked, and linked to from elsewhere. The API already takes these as
 * query parameters, so this is only about keeping the browser's URL in step.
 */

export interface SpotQuery {
  lat: string;
  lon: string;
  facing?: number;
  label?: string;
}

export function readSpotFromUrl(): SpotQuery | null {
  const params = new URLSearchParams(window.location.search);
  const lat = params.get('lat');
  const lon = params.get('lon');
  if (lat === null || lon === null) return null;

  const facing = params.get('facing');
  const parsedFacing = facing === null ? undefined : Number(facing);

  return {
    lat,
    lon,
    facing: parsedFacing !== undefined && Number.isFinite(parsedFacing) ? parsedFacing : undefined,
    label: params.get('label') ?? undefined,
  };
}

/** replaceState rather than pushState: a lookup is not a separate page. */
export function writeSpotToUrl(spot: SpotQuery): void {
  const params = new URLSearchParams({ lat: spot.lat, lon: spot.lon });
  if (spot.facing !== undefined) params.set('facing', String(spot.facing));
  if (spot.label) params.set('label', spot.label);
  window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
}
