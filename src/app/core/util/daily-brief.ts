/**
 * "Today at a glance": turns the weather data you already fetch into a one-line summary,
 * quick answers (umbrella? jacket? sunscreen?) and sun times.
 *
 * Pure functions only (no Angular), so it is easy to test and tune.
 * All thresholds are in the "Tunable settings" block below.
 */
import { HourlyPoint, UNIT_LABELS, Units, WeatherReport } from '../models/weather.models';
import { aqiCategory, formatHour, uvCategory } from './hourly-format';
import { describeWeather } from './weather-codes';

export type TipLevel = 'ok' | 'note' | 'alert';

export interface Tip {
  id: string;
  icon: string;
  title: string;
  /** Short answer, e.g. "Yes", "No", "Maybe". */
  answer: string;
  /** One line of "why". */
  detail: string;
  /** Drives the tint: ok = nothing needed, note = take along, alert = take care. */
  level: TipLevel;
}

export interface SunInfo {
  sunrise: string;
  sunset: string;
  dayLength: string;
  goldenHour: string;
}

export interface DailyBrief {
  greeting: string;
  headline: string;
  tips: Tip[];
  sun: SunInfo | null;
}

// ---------------------------------------------------------------------------
// Tunable settings
// ---------------------------------------------------------------------------
const LOOKAHEAD_HOURS = 12; // how far ahead the quick answers look
const RAIN_YES = 60; //        % chance: "take an umbrella"
const RAIN_MAYBE = 30; //      % chance: "maybe"
const JACKET_YES_BELOW_C = 10; // feels-like °C
const JACKET_LIGHT_BELOW_C = 18;
const HEAT_NOTE_C = 30; //     feels-like °C thresholds for "Heat & water"
const HEAT_OFTEN_C = 35;
const HEAT_RISK_C = 41;
const UV_COVER_UP = 8; //      UV index at which the advice becomes "cover up"
// ---------------------------------------------------------------------------

/** One hour, converted to metric for the rules, keeping the user's own number for display. */
interface Hr {
  date: string;
  hour: number;
  label: string;
  feelsC: number;
  feelsShown: number;
  rain: number; // %
  mm: number;
  code: number;
  uv: number | null;
  aqi: number | null;
  isDay: boolean;
}

function normalise(h: HourlyPoint, units: Units): Hr {
  console.log(h, 'hhhh')
  const imperial = units === 'imperial';
  const mm = imperial ? h.precipitation * 25.4 : h.precipitation;
  const hour = Number(h.time.slice(11, 13));
  return {
    date: h.time.slice(0, 10),
    hour,
    label: formatHour(hour),
    feelsC: imperial ? ((h.apparentTemperature - 32) * 5) / 9 : h.apparentTemperature,
    feelsShown: Math.round(h.apparentTemperature),
    rain: h.precipitationProbability ?? (mm >= 0.2 ? 60 : 0),
    mm,
    code: h.weatherCode,
    uv: h.uvIndex,
    aqi: h.aqi,
    isDay: h.isDay,
  };
}

const maxBy = <T>(items: T[], value: (t: T) => number): T => items.reduce((a, b) => (value(b) > value(a) ? b : a));
const minBy = <T>(items: T[], value: (t: T) => number): T => items.reduce((a, b) => (value(b) < value(a) ? b : a));

export function tempWord(feelsC: number): string {
  if (feelsC < 0) return 'Freezing';
  if (feelsC < 10) return 'Cold';
  if (feelsC < 18) return 'Cool';
  if (feelsC < 25) return 'Mild';
  if (feelsC < 30) return 'Warm';
  if (feelsC < 35) return 'Hot';
  return 'Very hot';
}

function greetingFor(time: string): string {
  const hour = Number(time.slice(11, 13));
  if (hour < 5) return 'Hello';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ---- clock helpers (strings like "2026-10-16T18:10", local time at the place) ----
const minutesOfDay = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

function clockFromMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = String(t % 60).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "2026-10-16T06:20" -> "6:20 AM" */
export function formatClock(iso: string): string {
  return clockFromMinutes(minutesOfDay(iso));
}

function sunInfo(report: WeatherReport): SunInfo | null {
  const today = report.daily[0];
  if (!today?.sunrise || !today.sunset) return null;
  const rise = minutesOfDay(today.sunrise);
  const set = minutesOfDay(today.sunset);
  const length = set - rise;
  if (length <= 0) return null;
  return {
    sunrise: clockFromMinutes(rise),
    sunset: clockFromMinutes(set),
    dayLength: `${Math.floor(length / 60)}h ${length % 60}m`,
    goldenHour: `${clockFromMinutes(set - 60)} – ${clockFromMinutes(set)}`,
  };
}

export function buildBrief(report: WeatherReport, units: Units): DailyBrief {
  const c = report.current;
  console.log(c, 'current')
  const unit = UNIT_LABELS[units].temp;

  // If hourly data is missing, fall back to "right now" so the brief still works.
  const source: HourlyPoint[] = report.hourly.length
    ? report.hourly
    : [{
      time: c.time, temperature: c.temperature, apparentTemperature: c.apparentTemperature,
      precipitation: c.precipitation, precipitationProbability: null, weatherCode: c.weatherCode,
      windSpeed: c.windSpeed, uvIndex: c.uvIndex ?? null, aqi: c.aqi ?? null, isDay: c.isDay,
    }];
  const all = source.map((h) => normalise(h, units));
  const ahead = all.slice(0, LOOKAHEAD_HOURS);
  const span = ahead.length > 1 ? `in the next ${ahead.length} hours` : 'right now';
  const sunHours = all.filter((h) => h.date === all[0].date && h.isDay); // daylight left today

  // ---- facts used by both the tips and the headline ----
  const rainPeak = maxBy(ahead, (h) => h.rain);
  const firstWet = ahead.find((h) => h.rain >= RAIN_MAYBE);
  const storm = ahead.find((h) => h.code >= 95);
  const heavy = ahead.some((h) => h.mm > 3 || (h.code >= 63 && h.code <= 67) || (h.code >= 81 && h.code <= 82));
  const coldest = minBy(ahead, (h) => h.feelsC);
  const hottest = maxBy(ahead, (h) => h.feelsC);
  const uvPeak = sunHours.length ? maxBy(sunHours, (h) => h.uv ?? 0) : null;
  const aqiHours = ahead.filter((h) => h.aqi !== null);
  const aqiPeak = aqiHours.length ? maxBy(aqiHours, (h) => h.aqi ?? 0) : null;
  const rainYes = rainPeak.rain >= RAIN_YES || heavy;

  const tips: Tip[] = [];

  // ---- Umbrella ----
  if (storm) {
    tips.push({
      id: 'umbrella', icon: '☂️', title: 'Umbrella', answer: 'Yes', level: 'alert',
      detail: `Thunderstorm risk around ${storm.label}. Stay indoors if you can.`
    });
  } else if (rainYes) {
    tips.push({
      id: 'umbrella', icon: '☂️', title: 'Umbrella', answer: 'Yes', level: heavy ? 'alert' : 'note',
      detail: `Rain likely around ${(firstWet ?? rainPeak).label} (${Math.round(rainPeak.rain)}% chance).`
    });
  } else if (rainPeak.rain >= RAIN_MAYBE) {
    tips.push({
      id: 'umbrella', icon: '☂️', title: 'Umbrella', answer: 'Maybe', level: 'note',
      detail: `${Math.round(rainPeak.rain)}% chance of showers around ${rainPeak.label}.`
    });
  } else {
    tips.push({
      id: 'umbrella', icon: '☂️', title: 'Umbrella', answer: 'No', level: 'ok',
      detail: `No rain expected ${span}.`
    });
  }

  // ---- Jacket ----
  if (coldest.feelsC < JACKET_YES_BELOW_C) {
    tips.push({
      id: 'jacket', icon: '🧥', title: 'Jacket', answer: 'Yes', level: coldest.feelsC < 0 ? 'alert' : 'note',
      detail: `Feels as low as ${coldest.feelsShown}${unit} at ${coldest.label}.`
    });
  } else if (coldest.feelsC < JACKET_LIGHT_BELOW_C) {
    tips.push({
      id: 'jacket', icon: '🧥', title: 'Jacket', answer: 'Light layer', level: 'note',
      detail: `Feels as low as ${coldest.feelsShown}${unit} at ${coldest.label}.`
    });
  } else {
    tips.push({
      id: 'jacket', icon: '🧥', title: 'Jacket', answer: 'No', level: 'ok',
      detail: `Feels ${coldest.feelsShown}${unit} or warmer ${span}.`
    });
  }

  // ---- Sunscreen ----
  if (!uvPeak) {
    tips.push({
      id: 'sunscreen', icon: '🧴', title: 'Sunscreen', answer: 'No', level: 'ok',
      detail: 'No daylight left today. Check again tomorrow morning.'
    });
  } else {
    const uv = uvPeak.uv ?? 0;
    const uvRounded = Math.round(uv);
    if (uv < 3) {
      tips.push({
        id: 'sunscreen', icon: '🧴', title: 'Sunscreen', answer: 'No', level: 'ok',
        detail: `UV stays low (up to ${uvRounded}).`
      });
    } else {
      const cat = uvCategory(uv).label;
      tips.push({
        id: 'sunscreen', icon: '🧴', title: 'Sunscreen',
        answer: uv >= UV_COVER_UP ? 'Yes, cover up' : 'Yes', level: uv >= UV_COVER_UP ? 'alert' : 'note',
        detail: `UV up to ${uvRounded} (${cat}) around ${uvPeak.label}.`
      });
    }
  }

  // ---- Heat & water ----
  const hot = hottest.feelsC;
  if (hot >= HEAT_RISK_C) {
    tips.push({
      id: 'heat', icon: '💧', title: 'Heat & water', answer: 'Take care', level: 'alert',
      detail: `Feels like up to ${hottest.feelsShown}${unit} at ${hottest.label}. Avoid hard effort outdoors.`
    });
  } else if (hot >= HEAT_OFTEN_C) {
    tips.push({
      id: 'heat', icon: '💧', title: 'Heat & water', answer: 'Drink often', level: 'note',
      detail: `Feels like up to ${hottest.feelsShown}${unit} at ${hottest.label}. Rest in the shade.`
    });
  } else if (hot >= HEAT_NOTE_C) {
    tips.push({
      id: 'heat', icon: '💧', title: 'Heat & water', answer: 'Stay hydrated', level: 'note',
      detail: `Feels like up to ${hottest.feelsShown}${unit} at ${hottest.label}.`
    });
  } else {
    tips.push({
      id: 'heat', icon: '💧', title: 'Heat & water', answer: 'Normal', level: 'ok',
      detail: `Feels like up to ${hottest.feelsShown}${unit} ${span}.`
    });
  }

  // ---- Air quality (skipped when no data) ----
  if (aqiPeak) {
    const aqi = Math.round(aqiPeak.aqi ?? 0);
    const label = aqiCategory(aqi).label;
    if (aqi <= 50) {
      tips.push({ id: 'air', icon: '🍃', title: 'Air quality', answer: 'Good', level: 'ok', detail: `AQI up to ${aqi} (US scale).` });
    } else if (aqi <= 100) {
      tips.push({
        id: 'air', icon: '🍃', title: 'Air quality', answer: 'Moderate', level: 'ok',
        detail: `AQI up to ${aqi}. Fine for most people.`
      });
    } else if (aqi <= 150) {
      tips.push({
        id: 'air', icon: '🍃', title: 'Air quality', answer: 'Limit effort', level: 'note',
        detail: `AQI up to ${aqi} (${label}).`
      });
    } else {
      tips.push({
        id: 'air', icon: '🍃', title: 'Air quality', answer: aqi <= 200 ? 'Unhealthy' : 'Very unhealthy', level: 'alert',
        detail: `AQI up to ${aqi}. Limit time outdoors; consider a mask.`
      });
    }
  }

  // ---- Laundry outside ----
  const wetDay = sunHours.find((h) => h.rain >= RAIN_MAYBE);
  if (sunHours.length < 3) {
    tips.push({
      id: 'laundry', icon: '🧺', title: 'Laundry outside', answer: 'No', level: 'note',
      detail: 'Too little daylight left today.'
    });
  } else if (wetDay) {
    tips.push({
      id: 'laundry', icon: '🧺', title: 'Laundry outside', answer: 'Risky', level: 'note',
      detail: `Rain possible around ${wetDay.label}.`
    });
  } else if (c.humidity >= 80) {
    tips.push({
      id: 'laundry', icon: '🧺', title: 'Laundry outside', answer: 'Slow', level: 'note',
      detail: `Humidity is ${Math.round(c.humidity)}%, so clothes dry slowly.`
    });
  } else {
    tips.push({
      id: 'laundry', icon: '🧺', title: 'Laundry outside', answer: 'Yes', level: 'ok',
      detail: 'Dry weather until sunset.'
    });
  }

  // ---- Headline: "<Temperature word> and <conditions>." + the single most important thing ----
  const cond = describeWeather(c.weatherCode, c.isDay).label.toLowerCase();
  const joiner = /rain|drizzle|shower|snow|thunder|fog|hail/.test(cond) ? 'with' : 'and';
  const feelsNow = units === 'imperial' ? ((c.apparentTemperature - 32) * 5) / 9 : c.apparentTemperature;
  const first = `${tempWord(feelsNow)} ${joiner} ${cond}.`;
  console.log(first, 'first');
  let second: string;
  if (storm) second = `Thunderstorms possible around ${storm.label}, so plan to stay indoors.`;
  else if (rainYes) second = `Rain likely around ${(firstWet ?? rainPeak).label}, so take an umbrella.`;
  else if (uvPeak && (uvPeak.uv ?? 0) >= UV_COVER_UP) second = `UV peaks around ${uvPeak.label}, so cover up at midday.`;
  else if (hot >= 38) second = `Feels like up to ${hottest.feelsShown}${unit}, so drink plenty of water.`;
  else if (aqiPeak && (aqiPeak.aqi ?? 0) > 150) second = 'Air quality is unhealthy, so limit time outdoors.';
  else if (coldest.feelsC < JACKET_YES_BELOW_C) second = 'Take a jacket.';
  else if (rainPeak.rain >= RAIN_MAYBE) second = `A shower is possible around ${rainPeak.label}.`;
  else second = 'No rain expected.';
  console.log(second, 'second');
  return { greeting: greetingFor(c.time), headline: `${first} ${second}`, tips, sun: sunInfo(report) };
}
