export type SkyTheme = 'clear-day' | 'clear-night' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';
type Group = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

interface CodeInfo { label: string; icon: string; nightIcon?: string; group: Group }

/** WMO weather interpretation codes used by Open-Meteo. */
const CODES: Record<number, CodeInfo> = {
  0: { label: 'Clear sky', icon: '☀️', nightIcon: '🌙', group: 'clear' },
  1: { label: 'Mainly clear', icon: '🌤️', nightIcon: '🌙', group: 'clear' },
  2: { label: 'Partly cloudy', icon: '⛅', nightIcon: '☁️', group: 'cloudy' },
  3: { label: 'Overcast', icon: '☁️', group: 'cloudy' },
  45: { label: 'Fog', icon: '🌫️', group: 'fog' },
  48: { label: 'Freezing fog', icon: '🌫️', group: 'fog' },
  51: { label: 'Light drizzle', icon: '🌦️', group: 'rain' },
  53: { label: 'Drizzle', icon: '🌦️', group: 'rain' },
  55: { label: 'Heavy drizzle', icon: '🌧️', group: 'rain' },
  56: { label: 'Freezing drizzle', icon: '🌧️', group: 'rain' },
  57: { label: 'Heavy freezing drizzle', icon: '🌧️', group: 'rain' },
  61: { label: 'Light rain', icon: '🌦️', group: 'rain' },
  63: { label: 'Rain', icon: '🌧️', group: 'rain' },
  65: { label: 'Heavy rain', icon: '🌧️', group: 'rain' },
  66: { label: 'Freezing rain', icon: '🌧️', group: 'rain' },
  67: { label: 'Heavy freezing rain', icon: '🌧️', group: 'rain' },
  71: { label: 'Light snow', icon: '🌨️', group: 'snow' },
  73: { label: 'Snow', icon: '❄️', group: 'snow' },
  75: { label: 'Heavy snow', icon: '❄️', group: 'snow' },
  77: { label: 'Snow grains', icon: '❄️', group: 'snow' },
  80: { label: 'Light showers', icon: '🌦️', group: 'rain' },
  81: { label: 'Showers', icon: '🌧️', group: 'rain' },
  82: { label: 'Violent showers', icon: '🌧️', group: 'rain' },
  85: { label: 'Light snow showers', icon: '🌨️', group: 'snow' },
  86: { label: 'Heavy snow showers', icon: '🌨️', group: 'snow' },
  95: { label: 'Thunderstorm', icon: '⛈️', group: 'storm' },
  96: { label: 'Thunderstorm, light hail', icon: '⛈️', group: 'storm' },
  99: { label: 'Thunderstorm, heavy hail', icon: '⛈️', group: 'storm' },
};

const FALLBACK: CodeInfo = { label: 'Unknown conditions', icon: '🌡️', group: 'cloudy' };

export interface WeatherDescription { label: string; icon: string; sky: SkyTheme }

export function describeWeather(code: number, isDay = true): WeatherDescription {
  const info = CODES[code] ?? FALLBACK;
  const sky: SkyTheme = info.group === 'clear' ? (isDay ? 'clear-day' : 'clear-night') : info.group;
  return { label: info.label, icon: isDay ? info.icon : (info.nightIcon ?? info.icon), sky };
}
