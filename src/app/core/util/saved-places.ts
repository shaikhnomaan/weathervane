/**
 * Pure helpers for the saved-cities list (no Angular, easy to test).
 */
import { Coordinates, Place } from '../models/weather.models';

export const MAX_SAVED = 8;

/** Two places are "the same" when they are within ~2 km (stops duplicates from search vs. geolocation). */
export function samePlace(a: Coordinates, b: Coordinates): boolean {
  return Math.abs(a.latitude - b.latitude) < 0.02 && Math.abs(a.longitude - b.longitude) < 0.02;
}

/** Stable key for lookups, e.g. "21.01,75.56". */
export function placeKey(p: Coordinates): string {
  return `${p.latitude.toFixed(2)},${p.longitude.toFixed(2)}`;
}

/** Adds a place at the end. Ignores duplicates; returns the same list when full. */
export function addPlace(list: Place[], place: Place): Place[] {
  if (list.some((p) => samePlace(p, place)) || list.length >= MAX_SAVED) return list;
  return [...list, place];
}

export function removePlace(list: Place[], place: Place): Place[] {
  return list.filter((p) => !samePlace(p, place));
}

/** Validates whatever came out of localStorage so a corrupted value can never break the app. */
export function parseSaved(raw: unknown): Place[] {
  if (!Array.isArray(raw)) return [];
  const places: Place[] = [];
  for (const item of raw) {
    if (
      typeof item === 'object' && item !== null &&
      typeof (item as Place).name === 'string' &&
      Number.isFinite((item as Place).latitude) && Number.isFinite((item as Place).longitude)
    ) {
      const p = item as Place;
      places.push({
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
        region: typeof p.region === 'string' ? p.region : undefined,
        country: typeof p.country === 'string' ? p.country : undefined,
      });
    }
  }
  return places.slice(0, MAX_SAVED);
}
