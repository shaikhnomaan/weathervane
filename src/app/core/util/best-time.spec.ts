import { HourlyPoint } from '../models/weather.models';
import { planBestTimes } from './best-time';

const hour = (h: number, temp: number, extra: Partial<HourlyPoint> = {}): HourlyPoint => ({
  time: `2026-10-16T${String(h).padStart(2, '0')}:00`,
  temperature: temp, apparentTemperature: temp, precipitation: 0, precipitationProbability: 0,
  weatherCode: 0, windSpeed: 5, uvIndex: 0, aqi: 30, isDay: h >= 6 && h < 18, ...extra,
});

/** A hot-climate day: cool at dawn, 34°C in the afternoon. Hours 00-23. */
const TEMPS = [22, 22, 22, 22, 22, 21, 20, 22, 26, 29, 33, 34, 34, 34, 34, 34, 34, 31, 28, 27, 27, 26, 25, 24];
const day = (extra: Partial<HourlyPoint> = {}) => TEMPS.map((t, h) => hour(h, t, extra));
const get = (hours: HourlyPoint[], id: string) => planBestTimes(hours, 'metric').find((a) => a.id === id)!;

describe('planBestTimes', () => {
  it('returns all six activities', () => {
    expect(planBestTimes(day(), 'metric').map((a) => a.id)).toEqual(['running', 'jogging', 'cycling', 'hiking', 'walking', 'dining']);
  });

  it('never suggests the small hours or the dark for hiking', () => {
    expect(get(day(), 'running').slots[3].score).toBeNull();
    expect(get(day(), 'hiking').slots[20].score).toBeNull();
  });

  it('picks the cool early morning for running', () => {
    const run = get(day(), 'running');
    expect(run.best?.text).toContain('Today');
    expect(run.best?.text).toContain('AM');
    expect(run.slots[14].status).toBe('Bad'); // 34°C at 2 PM
  });

  it('gives no window when air quality is unhealthy, except for dining', () => {
    const hours = day({ aqi: 200 });
    expect(get(hours, 'running').best).toBeNull();
    expect(get(hours, 'dining').best).not.toBeNull();
  });

  it('gives no window anywhere during a thunderstorm', () => {
    const hours = day({ weatherCode: 95 });
    for (const a of planBestTimes(hours, 'metric')) expect(a.best).toBeNull();
  });

  it('lowers the score when UV is very high', () => {
    const calm = get(day(), 'running').slots[7].score!;
    const sunny = get(day().map((h) => (h.time.endsWith('07:00') ? { ...h, uvIndex: 10 } : h)), 'running').slots[7].score!;
    expect(sunny < calm).toBe(true);
  });

  it('rules out outdoor dining when rain is likely', () => {
    const hours = day({ precipitationProbability: 80 });
    expect(get(hours, 'dining').best).toBeNull();
  });

  it('starts the label with "Now until" when the best time is right now', () => {
    const hours = [hour(7, 20), hour(8, 31), hour(9, 33), hour(10, 35)];
    expect(get(hours, 'running').best?.text).toBe('Now until 8 AM');
  });

  it('labels windows after midnight as Tomorrow', () => {
    const hours: HourlyPoint[] = [];
    for (let h = 14; h < 24; h++) hours.push(hour(h, 35));
    for (let h = 0; h < 14; h++) hours.push({ ...hour(h, h === 6 ? 19 : 33), time: `2026-10-17T${String(h).padStart(2, '0')}:00` });
    expect(get(hours, 'running').best?.text).toContain('Tomorrow');
  });

  it('handles imperial units (68°F is comfortable)', () => {
    const hours = [hour(7, 68, { apparentTemperature: 68 }), hour(8, 69, { apparentTemperature: 69 })];
    const run = planBestTimes(hours, 'imperial').find((a) => a.id === 'running')!;
    expect(run.slots[0].status).toBe('Great');
  });

  it('copes with no hourly data', () => {
    const none = planBestTimes([], 'metric');
    expect(none).toHaveLength(6);
    expect(none[0].best).toBeNull();
  });
});
