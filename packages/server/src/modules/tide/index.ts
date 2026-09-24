export {
  seedTideStations,
  findNearestStation,
  MAX_STATION_DISTANCE_KM,
} from './tideService.js';

export type { TideStation } from './tideService.js';

export { fetchTideExtremes } from './coopsClient.js';
