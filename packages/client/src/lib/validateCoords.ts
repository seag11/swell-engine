export function validateLat(lat: string): string | null {
  const n = parseFloat(lat)
  if (isNaN(n))          return 'Must be a valid number'
  if (n < -90 || n > 90) return 'Must be between -90 and 90'
  return null
}

export function validateLon(lon: string): string | null {
  const n = parseFloat(lon)
  if (isNaN(n))              return 'Must be a valid number'
  if (n < -180 || n > 180)   return 'Must be between -180 and 180'
  return null
}

