/**
 * API configuration.
 *
 * Open-Meteo is free and needs NO API key (non-commercial use, CC BY 4.0).
 * Current conditions refresh every ~15 minutes upstream.
 *
 * If you prefer OpenWeatherMap, keep the same WeatherApiService public methods and
 * swap the implementation; put the key in a build-time environment file, never in git.
 * Note: any key shipped to a browser is public, so proxy through your own backend for
 * production use with a paid key.
 */
export const API = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
  reverseGeocoding: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
  airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
} as const;

/** Poll interval for near-real-time updates. Open-Meteo updates "current" every 15 min. */
export const POLL_INTERVAL_MS = 5 * 60 * 1000;
