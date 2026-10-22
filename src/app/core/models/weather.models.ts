export type Units = 'metric' | 'imperial';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place extends Coordinates {
  name: string;
  region?: string;
  country?: string;
}

export interface CurrentConditions {
  time: string; // ISO local time at the place
  temperature: number;
  apparentTemperature: number;
  humidity: number; // %
  windSpeed: number;
  windDirection: number; // degrees
  precipitation: number;
  pressure: number; // hPa
  weatherCode: number; // WMO code
  isDay: boolean;
  uvIndex?: number;
  aqi?: number;
}

export interface DailyForecast {
  date: string; // YYYY-MM-DD at the place
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipitationProbability: number | null;
  windSpeedMax: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherReport {
  place: Place;
  timezone: string;
  current: CurrentConditions;
  daily: DailyForecast[];
  fetchedAt: number; // epoch ms
  hourly: HourlyPoint[];
}

export const UNIT_LABELS: Record<Units, { temp: string; tempName: string; wind: string; precip: string }> = {
  metric: { temp: '°C', tempName: 'Celsius', wind: 'km/h', precip: 'mm' },
  imperial: { temp: '°F', tempName: 'Fahrenheit', wind: 'mph', precip: 'in' },
};


export interface HourlyPoint {
  time: string;                          // "2026-10-16T14:00" (local time at the place)
  temperature: number;                   // in the user's units
  apparentTemperature: number;
  precipitation: number;
  precipitationProbability: number | null;
  weatherCode: number;
  windSpeed: number;
  uvIndex: number | null;
  aqi: number | null;                    // US AQI
  isDay: boolean;
}