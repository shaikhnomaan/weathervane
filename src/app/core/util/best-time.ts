/**
 * "Best time for activities": scores each of the next 24 hours for every activity
 * and finds the best window. Fully self-contained: it does NOT use or change the
 * rules inside your existing Activities component (so ratings can differ slightly).
 *
 * Pure functions only (no Angular). All tuning lives in the "Tunable settings" block.
 */
import { HourlyPoint, Units } from '../models/weather.models';
import { formatHour } from './hourly-format';
import { describeWeather } from './weather-codes';

export type BestStatus = 'Great' | 'Good' | 'Fair' | 'Bad';

export interface BestSlot {
  time: string;
  date: string;
  hour: number;
  label: string;
  temp: number;
  icon: string;
  /** 0-100, or null when it is not a sensible time for this activity. */
  score: number | null;
  status: BestStatus | null;
  reason: string;
  barHeight: number;
  barClass: string;
  isNow: boolean;
  newDay: boolean;
  inBest: boolean;
  ariaLabel: string;
}

export interface BestWindow {
  text: string;
  status: BestStatus;
  badgeClass: string;
  reason: string;
}

export interface ActivityBestTime {
  id: string;
  name: string;
  icon: string;
  slots: BestSlot[];
  best: BestWindow | null;
}

// ---------------------------------------------------------------------------
// Tunable settings
// ---------------------------------------------------------------------------
interface Profile {
  id: string;
  name: string;
  icon: string;
  /** Sensible hours (local time at the place): from inclusive, to exclusive. */
  from: number;
  to: number;
  daylightOnly?: boolean;
  /** Exercise is affected by air quality and UV; dining is not. */
  exercise: boolean;
  /** Comfortable "feels like" range in °C. Outside it the score drops. */
  tempLo: number;
  tempHi: number;
  /** Wind (km/h) above which the score drops. */
  windOk: number;
  /** If set, a 50%+ rain chance caps the score at this value (dining and rain don't mix). */
  rainCap?: number;
}

const PROFILES: Profile[] = [
  { id: 'running', name: 'Running', icon: '🏃', from: 5, to: 21, exercise: true, tempLo: 8, tempHi: 20, windOk: 20 },
  { id: 'jogging', name: 'Jogging', icon: '👟', from: 5, to: 21, exercise: true, tempLo: 10, tempHi: 22, windOk: 20 },
  { id: 'cycling', name: 'Cycling', icon: '🚴', from: 5, to: 20, exercise: true, tempLo: 12, tempHi: 26, windOk: 16 },
  { id: 'hiking', name: 'Hiking', icon: '🥾', from: 6, to: 18, daylightOnly: true, exercise: true, tempLo: 10, tempHi: 24, windOk: 25 },
  { id: 'walking', name: 'Walking', icon: '🚶', from: 5, to: 22, exercise: true, tempLo: 12, tempHi: 27, windOk: 25 },
  { id: 'dining', name: 'Outdoor dining', icon: '🍽️', from: 8, to: 22, exercise: false, tempLo: 18, tempHi: 30, windOk: 15, rainCap: 35 },
];

const GREAT_FROM = 80; // score thresholds
const GOOD_FROM = 60;
const FAIR_FROM = 40;
const WINDOW_TOLERANCE = 10; // hours within this many points of the best hour join the window
const MAX_WINDOW_HOURS = 3;
// ---------------------------------------------------------------------------

interface Norm {
  feelsC: number;
  windKmh: number;
  mm: number;
  rain: number;
  code: number;
  aqi: number | null;
  uv: number | null;
  isDay: boolean;
}

function normalise(h: HourlyPoint, units: Units): Norm {
  const imperial = units === 'imperial';
  const mm = imperial ? h.precipitation * 25.4 : h.precipitation;
  return {
    feelsC: imperial ? ((h.apparentTemperature - 32) * 5) / 9 : h.apparentTemperature,
    windKmh: imperial ? h.windSpeed * 1.60934 : h.windSpeed,
    mm,
    rain: h.precipitationProbability ?? (mm >= 0.2 ? 60 : 0),
    code: h.weatherCode,
    aqi: h.aqi,
    uv: h.uvIndex,
    isDay: h.isDay,
  };
}

function statusOf(score: number): BestStatus {
  if (score >= GREAT_FROM) return 'Great';
  if (score >= GOOD_FROM) return 'Good';
  if (score >= FAIR_FROM) return 'Fair';
  return 'Bad';
}

/** Scores one hour for one activity: starts at 100, subtracts penalties, then applies hard safety caps. */
function scoreHour(p: Profile, n: Norm): { score: number; reason: string } {
  const penalties: { amount: number; reason: string }[] = [];

  if (n.feelsC > p.tempHi) penalties.push({ amount: Math.min(80, (n.feelsC - p.tempHi) * 7), reason: 'Too hot' });
  else if (n.feelsC < p.tempLo) penalties.push({ amount: Math.min(80, (p.tempLo - n.feelsC) * 5), reason: 'Too cold' });

  if (n.windKmh > p.windOk) penalties.push({ amount: Math.min(40, (n.windKmh - p.windOk) * 2), reason: 'Windy' });

  const rainAmount = Math.min(50, n.rain * 0.35 + (n.mm > 0.1 ? 15 : 0) + Math.min(n.mm, 4) * 5);
  if (rainAmount > 0) penalties.push({ amount: rainAmount, reason: 'Rain likely' });

  if (p.exercise && n.aqi !== null && n.aqi > 50) {
    // US AQI 51-100 is "Moderate" (common in many cities), above 100 is unhealthy for sensitive groups.
    penalties.push({ amount: Math.min(50, (n.aqi - 50) * 0.35), reason: n.aqi <= 100 ? 'Moderate air quality' : 'Poor air quality' });
  }
  if (p.exercise && n.isDay && n.uv !== null && n.uv > 5) penalties.push({ amount: Math.min(30, (n.uv - 5) * 5), reason: 'Strong UV' });

  const total = penalties.reduce((sum, x) => sum + x.amount, 0);
  let score = Math.max(0, 100 - total);
  let reason = total < 15 ? 'Comfortable conditions' : penalties.reduce((a, b) => (b.amount > a.amount ? b : a)).reason;

  // Hard caps: some conditions are simply not good, however pleasant the temperature is.
  const caps: { max: number; reason: string }[] = [];
  if (n.code >= 95) caps.push({ max: 5, reason: 'Thunderstorm risk' });
  if ((n.code >= 71 && n.code <= 77) || n.code === 85 || n.code === 86) caps.push({ max: 10, reason: 'Snow or ice' });
  if (n.mm > 3 || (n.code >= 63 && n.code <= 67) || n.code === 81 || n.code === 82) caps.push({ max: 15, reason: 'Heavy rain' });
  if ((n.code === 45 || n.code === 48) && (p.id === 'cycling' || p.id === 'hiking')) caps.push({ max: 35, reason: 'Low visibility' });
  if (p.exercise && n.aqi !== null && n.aqi > 150) caps.push({ max: 20, reason: 'Unhealthy air quality' });
  else if (p.exercise && n.aqi !== null && n.aqi > 100) caps.push({ max: 55, reason: 'Poor air quality' });
  if (p.rainCap !== undefined && (n.rain >= 50 || n.mm > 0.2)) caps.push({ max: p.rainCap, reason: 'Rain likely' });

  for (const cap of caps) {
    if (score > cap.max) {
      score = cap.max;
      reason = cap.reason;
    }
  }
  return { score, reason };
}

/** Score the next hours for every activity and find each activity's best window. */
export function planBestTimes(hours: HourlyPoint[], units: Units): ActivityBestTime[] {
  if (!hours.length) return PROFILES.map((p) => ({ id: p.id, name: p.name, icon: p.icon, slots: [], best: null }));

  const firstDate = hours[0].time.slice(0, 10);
  const norms = hours.map((h) => normalise(h, units));

  return PROFILES.map((p): ActivityBestTime => {
    const slots = hours.map((h, i): BestSlot => {
      const hour = Number(h.time.slice(11, 13));
      const label = formatHour(hour);
      const temp = Math.round(h.temperature);
      const base = {
        time: h.time,
        date: h.time.slice(0, 10),
        hour,
        label,
        temp,
        icon: describeWeather(h.weatherCode, h.isDay).icon,
        isNow: i === 0,
        newDay: hour === 0 && i > 0,
        inBest: false,
      };

      const sensible = hour >= p.from && hour < p.to && (!p.daylightOnly || h.isDay);
      if (!sensible) {
        return { ...base, score: null, status: null, reason: 'Not a usual time for this activity', barHeight: 6, barClass: 'bar-na', ariaLabel: `${label}: not a usual time` };
      }
      const { score, reason } = scoreHour(p, norms[i]);
      const status = statusOf(score);
      return {
        ...base, score, status, reason,
        barHeight: Math.max(8, Math.round(score)),
        barClass: `bar-${status.toLowerCase()}`,
        ariaLabel: `${label}: ${status}, ${temp} degrees`,
      };
    });
    return { id: p.id, name: p.name, icon: p.icon, slots, best: findBestWindow(slots, firstDate) };
  });
}

function findBestWindow(slots: BestSlot[], firstDate: string): BestWindow | null {
  let top = -1;
  slots.forEach((s, i) => {
    if (s.score !== null && (top === -1 || s.score > (slots[top].score ?? -1))) top = i;
  });
  if (top === -1) return null;
  const topScore = slots[top].score ?? 0;
  if (statusOf(topScore) === 'Bad') return null; // nothing better than "Bad": say so honestly

  // Grow the window over neighbouring hours that are nearly as good (max 3 hours).
  let start = top;
  let end = top;
  const joins = (s: BestSlot | undefined): s is BestSlot =>
    !!s && s.score !== null && s.score >= FAIR_FROM && topScore - s.score <= WINDOW_TOLERANCE;
  while (end - start + 1 < MAX_WINDOW_HOURS) {
    const next = slots[end + 1];
    const prev = slots[start - 1];
    const nextOk = joins(next);
    const prevOk = joins(prev);
    if (nextOk && (!prevOk || (next.score ?? 0) >= (prev.score ?? 0))) end++;
    else if (prevOk) start--;
    else break;
  }
  for (let i = start; i <= end; i++) slots[i].inBest = true;

  const first = slots[start];
  const endLabel = formatHour(slots[end].hour + 1);
  const text = start === 0 ? `Now until ${endLabel}` : `${first.date === firstDate ? 'Today' : 'Tomorrow'} ${first.label} – ${endLabel}`;
  const status = statusOf(topScore);
  return { text, status, badgeClass: `status-${status.toLowerCase()}`, reason: slots[top].reason };
}
