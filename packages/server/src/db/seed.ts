import { sql } from './client.js';

const STATIONS = [
  // Pacific Northwest
  { id: '46041', name: 'Cape Elizabeth, WA', lat: 47.353, lon: -124.731 },
  { id: '46029', name: 'Columbia River Bar, OR', lat: 46.143, lon: -124.511 },
  // Northern California
  { id: '46022', name: 'Eel River, CA', lat: 40.749, lon: -124.577 },
  { id: '46026', name: 'San Francisco, CA', lat: 37.759, lon: -122.833 },
  { id: '46012', name: 'Half Moon Bay, CA', lat: 37.363, lon: -122.882 },
  // Central / Southern California
  { id: '46028', name: 'Cape San Martin, CA', lat: 35.774, lon: -121.858 },
  { id: '46054', name: 'W Santa Barbara, CA', lat: 34.274, lon: -120.459 },
  { id: '46025', name: 'Santa Monica Basin, CA', lat: 33.749, lon: -119.053 },
  { id: '46047', name: 'Tanner Bank, CA', lat: 32.434, lon: -119.531 },
  // Hawaii
  { id: '51001', name: 'NW Hawaii', lat: 23.445, lon: -162.279 },
  { id: '51002', name: 'SW Hawaii', lat: 17.094, lon: -157.808 },
  // East Coast
  { id: '44025', name: 'New Jersey Offshore', lat: 40.251, lon: -73.164 },
  { id: '44097', name: 'Block Island, RI', lat: 40.967, lon: -71.124 },
  { id: '41002', name: 'South Hatteras, NC', lat: 31.743, lon: -74.955 },
];

export async function seed() {
  for (const s of STATIONS) {
    await sql`
      INSERT INTO buoy_stations (id, name, lat, lon)
      VALUES (${s.id}, ${s.name}, ${s.lat}, ${s.lon})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`Seeded ${STATIONS.length} buoy stations`);
}
