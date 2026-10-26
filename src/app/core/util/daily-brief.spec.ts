import { HourlyPoint, WeatherReport } from '../models/weather.models';
import { buildBrief, formatClock } from './daily-brief';

const hour = (h: number, extra: Partial<HourlyPoint> = {}, day = '2026-10-16'): HourlyPoint => ({
  time: `${day}T${String(h).padStart(2, '0')}:00`,
  temperature: 30, apparentTemperature: 31, precipitation: 0, precipitationProbability: 0,
  weatherCode: 1, windSpeed: 8, uvIndex: 2, aqi: 40, isDay: h >= 6 && h < 18, ...extra,
});

/** A report whose hourly data starts at `startHour` and runs 24 hours. */
const report = (startHour: number, tweak: (h: number) => Partial<HourlyPoint> = () => ({})): WeatherReport => ({
  place: { name: 'Test', latitude: 21, longitude: 75 },
  timezone: 'Asia/Kolkata',
  fetchedAt: 0,
  current: {
    time: `2026-10-16T${String(startHour).padStart(2, '0')}:00`, temperature: 36, apparentTemperature: 38, humidity: 40,
    windSpeed: 8, windDirection: 90, precipitation: 0, pressure: 1010, weatherCode: 1, isDay: startHour >= 6 && startHour < 18,
  },
  daily: [{
    date: '2026-10-16', weatherCode: 1, tempMax: 36, tempMin: 24, precipitationSum: 0, precipitationProbability: 0,
    windSpeedMax: 10, sunrise: '2026-10-16T06:20', sunset: '2026-10-16T18:05',
  }],
  hourly: Array.from({ length: 24 }, (_, k) => {
    const abs = startHour + k;
    return hour(abs % 24, tweak(abs), abs < 24 ? '2026-10-16' : '2026-10-17');
  }),
});

describe('buildBrief', () => {
  it('writes a headline from feels-like and conditions', () => {
    const b = buildBrief(report(14), 'metric');
    expect(b.headline.startsWith('Very hot and mainly clear.')).toBe(true);
    expect(b.greeting).toBe('Good afternoon');
  });

  it('says yes to an umbrella when rain is likely, and names the hour', () => {
    const b = buildBrief(report(14, (h) => (h === 16 ? { precipitationProbability: 80, weatherCode: 61 } : {})), 'metric');
    const umbrella = b.tips.find((t) => t.id === 'umbrella')!;
    expect(umbrella.answer).toBe('Yes');
    expect(umbrella.detail).toContain('4 PM');
    expect(b.headline).toContain('take an umbrella');
  });

  it('says no umbrella when it stays dry', () => {
    expect(buildBrief(report(14), 'metric').tips.find((t) => t.id === 'umbrella')!.answer).toBe('No');
  });

  it('flags strong UV and tells people to cover up', () => {
    const b = buildBrief(report(9, (h) => (h === 13 ? { uvIndex: 10 } : {})), 'metric');
    const s = b.tips.find((t) => t.id === 'sunscreen')!;
    expect(s.answer).toBe('Yes, cover up');
    expect(s.level).toBe('alert');
    expect(s.detail).toContain('1 PM');
  });

  it('says no sunscreen once the sun has set', () => {
    const s = buildBrief(report(20), 'metric').tips.find((t) => t.id === 'sunscreen')!;
    expect(s.answer).toBe('No');
  });

  it('omits the air-quality tip when there is no AQI data', () => {
    const b = buildBrief(report(14, () => ({ aqi: null })), 'metric');
    expect(b.tips.some((t) => t.id === 'air')).toBe(false);
  });

  it('works with imperial units (feels-like 100.4°F is very hot)', () => {
    const r = report(14, () => ({ apparentTemperature: 100 }));
    r.current.apparentTemperature = 100;
    expect(buildBrief(r, 'imperial').headline.startsWith('Very hot')).toBe(true);
  });

  it('falls back to current conditions when hourly data is missing', () => {
    const r = report(14);
    r.hourly = [];
    const b = buildBrief(r, 'metric');
    expect(b.tips.length).toBeGreaterThan(3);
  });

  it('computes sun times', () => {
    const sun = buildBrief(report(14), 'metric').sun!;
    expect(sun.sunrise).toBe('6:20 AM');
    expect(sun.sunset).toBe('6:05 PM');
    expect(sun.dayLength).toBe('11h 45m');
    expect(sun.goldenHour).toBe('5:05 PM – 6:05 PM');
  });
});

describe('formatClock', () => {
  it('formats times on a 12-hour clock', () => {
    expect(formatClock('2026-10-16T00:05')).toBe('12:05 AM');
    expect(formatClock('2026-10-16T12:00')).toBe('12:00 PM');
    expect(formatClock('2026-10-16T18:10')).toBe('6:10 PM');
  });
});
