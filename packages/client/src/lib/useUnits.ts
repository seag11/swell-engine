import { useEffect, useState } from 'react';
import type { Units } from '@/lib/units';

const KEY = 'units';

// Feet, because the audience is US breaks and surf is spoken about in feet.
const DEFAULT: Units = 'imperial';

function initial(): Units {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'metric' || saved === 'imperial' ? saved : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function useUnits() {
  const [units, setUnits] = useState<Units>(initial);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, units);
    } catch {
      // A private window or blocked site data; the choice just will not persist.
    }
  }, [units]);

  return { units, setUnits };
}
