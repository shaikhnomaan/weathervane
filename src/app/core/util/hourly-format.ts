import { HourlyPoint, UNIT_LABELS, Units } from '../models/weather.models';

export type HourlyMetric = 'rain' | 'wind' | 'uv' | 'aqi';

/** 0 = fine, 1 = take note, 2 = take care. Drives the tint on each hour's value. */
export type Level = 0 | 1 | 2;

export interface MetricCell {
  /** Short text shown in the strip, e.g. "40%" or "12". */
  value: string;
  /** Full phrase for screen readers. */
  spoken: string;
  level: Level;
}

/** 0 -> "12 AM", 13 -> "1 PM". */
export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

export function uvCategory(uv: number): { label: string; level: Level } {
  if (uv < 3) return { label: 'low', level: 0 };
  if (uv < 6) return { label: 'moderate', level: 1 };
  if (uv < 8) return { label: 'high', level: 1 };
  if (uv < 11) return { label: 'very high', level: 2 };
  return { label: 'extreme', level: 2 };
}

/** US AQI categories. */
export function aqiCategory(aqi: number): { label: string; level: Level } {
  if (aqi <= 50) return { label: 'good', level: 0 };
  if (aqi <= 100) return { label: 'moderate', level: 1 };
  if (aqi <= 150) return { label: 'unhealthy for sensitive groups', level: 1 };
  if (aqi <= 200) return { label: 'unhealthy', level: 2 };
  return { label: 'very unhealthy', level: 2 };
}

export function metricCell(hour: HourlyPoint, metric: HourlyMetric, units: Units): MetricCell {
  switch (metric) {
    case 'rain': {
      const p = Math.round(hour.precipitationProbability ?? 0);
      return { value: `${p}%`, spoken: `${p} percent chance of rain`, level: p < 30 ? 0 : p < 60 ? 1 : 2 };
    }
    case 'wind': {
      const w = Math.round(hour.windSpeed);
      const kmh = units === 'imperial' ? hour.windSpeed * 1.60934 : hour.windSpeed;
      return { value: `${w}`, spoken: `wind ${w} ${UNIT_LABELS[units].wind}`, level: kmh < 20 ? 0 : kmh < 40 ? 1 : 2 };
    }
    case 'uv': {
      if (hour.uvIndex === null) return { value: '–', spoken: 'UV not available', level: 0 };
      const uv = Math.round(hour.uvIndex);
      const c = uvCategory(hour.uvIndex);
      return { value: `${uv}`, spoken: `UV index ${uv}, ${c.label}`, level: c.level };
    }
    case 'aqi': {
      if (hour.aqi === null) return { value: '–', spoken: 'air quality not available', level: 0 };
      const a = Math.round(hour.aqi);
      const c = aqiCategory(hour.aqi);
      return { value: `${a}`, spoken: `air quality ${a}, ${c.label}`, level: c.level };
    }
  }
}
