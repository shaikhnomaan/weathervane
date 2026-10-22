import { HourlyPoint } from '../models/weather.models';
import { aqiCategory, formatHour, metricCell, uvCategory } from './hourly-format';

const hour = (extra: Partial<HourlyPoint> = {}): HourlyPoint => ({
  time: '2026-10-16T14:00', temperature: 34, apparentTemperature: 36, precipitation: 0,
  precipitationProbability: 40, weatherCode: 1, windSpeed: 12, uvIndex: 9, aqi: 97, isDay: true, ...extra,
});

describe('hourly-format', () => {
  it('formats hours on a 12-hour clock', () => {
    expect(formatHour(0)).toBe('12 AM');
    expect(formatHour(12)).toBe('12 PM');
    expect(formatHour(15)).toBe('3 PM');
  });
  it('categorises UV and AQI', () => {
    expect(uvCategory(9).label).toBe('very high');
    expect(aqiCategory(97).label).toBe('moderate');
    expect(aqiCategory(180).level).toBe(2);
  });
  it('builds a cell for each metric', () => {
    expect(metricCell(hour(), 'rain', 'metric').value).toBe('40%');
    expect(metricCell(hour(), 'wind', 'metric').value).toBe('12');
    expect(metricCell(hour(), 'uv', 'metric').level).toBe(2);
    expect(metricCell(hour({ aqi: null }), 'aqi', 'metric').value).toBe('–');
  });
  it('judges imperial wind in km/h terms', () => {
    // 30 mph is about 48 km/h: should be "take care"
    expect(metricCell(hour({ windSpeed: 30 }), 'wind', 'imperial').level).toBe(2);
  });
});
