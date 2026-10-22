import { describeWeather } from './weather-codes';
import { compass, timeAgo } from './format';

describe('describeWeather', () => {
  it('maps clear sky by day and night', () => {
    expect(describeWeather(0, true)).toMatchObject({ label: 'Clear sky', sky: 'clear-day' });
    expect(describeWeather(0, false).sky).toBe('clear-night');
  });
  it('maps rain and storms', () => {
    expect(describeWeather(63).sky).toBe('rain');
    expect(describeWeather(95).sky).toBe('storm');
  });
  it('falls back for unknown codes', () => {
    expect(describeWeather(1234).label).toBe('Unknown conditions');
  });
});

describe('format helpers', () => {
  it('converts degrees to compass points', () => {
    expect(compass(0)).toBe('N');
    expect(compass(225)).toBe('SW');
    expect(compass(359)).toBe('N');
  });
  it('formats relative time', () => {
    expect(timeAgo(0, 30_000)).toBe('just now');
    expect(timeAgo(0, 5 * 60_000)).toBe('5 min ago');
    expect(timeAgo(0, 2 * 3_600_000)).toBe('2 h ago');
  });
});
