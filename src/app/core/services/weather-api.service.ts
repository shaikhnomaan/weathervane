import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { API } from '../config';
import { Coordinates, HourlyPoint, Place, Units, WeatherReport } from '../models/weather.models';

// ---- Raw API shapes (only the fields we request) ----
interface ForecastResponse {
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    pressure_msl: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    uv_index?: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: (number | null)[];
    wind_speed_10m_max: number[];
    sunrise: string[];
    sunset: string[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    precipitation: number[];
    precipitation_probability: (number | null)[];
    weather_code: number[];
    wind_speed_10m: number[];
    uv_index: (number | null)[];
    is_day: number[];
  };
}

interface AirQualityResponse {
  current?: {
    us_aqi?: number;
  };
  hourly?: { time: string[]; us_aqi: (number | null)[] };
}

interface GeocodeResponse {
  results?: { id: number; name: string; latitude: number; longitude: number; country?: string; admin1?: string }[];
}

interface ReverseResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

const CURRENT_FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
  'precipitation', 'weather_code', 'pressure_msl', 'wind_speed_10m', 'wind_direction_10m', 'uv_index',
].join(',');

const DAILY_FIELDS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
  'precipitation_probability_max', 'wind_speed_10m_max', 'sunrise', 'sunset',
].join(',');

const HOURLY_FIELDS = [
  'temperature_2m', 'apparent_temperature', 'precipitation', 'precipitation_probability',
  'weather_code', 'wind_speed_10m', 'uv_index', 'is_day',
].join(',');

@Injectable({ providedIn: 'root' })
export class WeatherApiService {
  private readonly http = inject(HttpClient);

  /** Current conditions + 7-day forecast. Errors propagate to the store. */
  getWeather(place: Place, units: Units): Observable<WeatherReport> {
    const imperial = units === 'imperial';
    const params = new HttpParams({
      fromObject: {
        latitude: place.latitude,
        longitude: place.longitude,
        current: CURRENT_FIELDS,
        daily: DAILY_FIELDS,
        hourly: HOURLY_FIELDS,
        timezone: 'auto',
        forecast_days: 7,
        temperature_unit: imperial ? 'fahrenheit' : 'celsius',
        wind_speed_unit: imperial ? 'mph' : 'kmh',
        precipitation_unit: imperial ? 'inch' : 'mm',
      },
    });

    const aqiParams = new HttpParams({
      fromObject: {
        latitude: place.latitude,
        longitude: place.longitude,
        current: 'us_aqi',
        hourly: 'us_aqi',
        timezone: 'auto',
        forecast_days: 2,
      },
    });

    const forecast$ = this.http.get<ForecastResponse>(API.forecast, { params });
    const aqi$ = this.http.get<AirQualityResponse>(API.airQuality, { params: aqiParams }).pipe(
      catchError(() => of(null as AirQualityResponse | null)),
    );

    return forkJoin({ forecast: forecast$, aqi: aqi$ }).pipe(
      map(({ forecast: r, aqi }): WeatherReport => ({
        place,
        timezone: r.timezone,
        fetchedAt: Date.now(),
        current: {
          time: r.current.time,
          temperature: r.current.temperature_2m,
          apparentTemperature: r.current.apparent_temperature,
          humidity: r.current.relative_humidity_2m,
          windSpeed: r.current.wind_speed_10m,
          windDirection: r.current.wind_direction_10m,
          precipitation: r.current.precipitation,
          pressure: r.current.pressure_msl,
          weatherCode: r.current.weather_code,
          isDay: r.current.is_day === 1,
          uvIndex: r.current.uv_index != null ? Math.round(r.current.uv_index * 10) / 10 : undefined,
          aqi: aqi?.current?.us_aqi != null ? Math.round(aqi.current.us_aqi) : undefined,
        },
        daily: r.daily.time.map((date, i) => ({
          date,
          weatherCode: r.daily.weather_code[i] ?? 0,
          tempMax: r.daily.temperature_2m_max[i] ?? 0,
          tempMin: r.daily.temperature_2m_min[i] ?? 0,
          precipitationSum: r.daily.precipitation_sum[i] ?? 0,
          precipitationProbability: r.daily.precipitation_probability_max[i] ?? null,
          windSpeedMax: r.daily.wind_speed_10m_max[i] ?? 0,
          sunrise: r.daily.sunrise[i] ?? '',
          sunset: r.daily.sunset[i] ?? '',
        })),
        hourly: this.mapHourly(r, aqi),
      })),
    );
  }


  /** City autocomplete. Returns [] when nothing matches. */
  searchCities(query: string): Observable<Place[]> {
    const params = new HttpParams({ fromObject: { name: query, count: 6, language: 'en', format: 'json' } });
    return this.http.get<GeocodeResponse>(API.geocoding, { params }).pipe(
      map((r) =>
        (r.results ?? []).map((c): Place => ({
          name: c.name,
          region: c.admin1,
          country: c.country,
          latitude: c.latitude,
          longitude: c.longitude,
        })),
      ),
    );
  }

  /** Best-effort place name for coordinates. Never errors: falls back to a generic label. */
  reverseGeocode(coords: Coordinates): Observable<Place> {
    const fallback: Place = { ...coords, name: 'Current location' };
    const params = new HttpParams({
      fromObject: { latitude: coords.latitude, longitude: coords.longitude, localityLanguage: 'en' },
    });
    return this.http.get<ReverseResponse>(API.reverseGeocoding, { params }).pipe(
      map((r): Place => {
        const name = r.city || r.locality;
        return name ? { ...coords, name, region: r.principalSubdivision || undefined, country: r.countryName || undefined } : fallback;
      }),
      catchError(() => of(fallback)),
    );
  }

  mapHourly(r: ForecastResponse, aqi: AirQualityResponse | null): HourlyPoint[] {
    const h = r.hourly;
    const aqiByTime = new Map<string, number | null>(
      (aqi?.hourly?.time ?? []).map((t, i): [string, number | null] => [t, aqi?.hourly?.us_aqi[i] ?? null]),
    );
    const nowHour = r.current.time.slice(0, 13); // "2026-10-16T14"
    const start = Math.max(0, h.time.findIndex((t) => t.slice(0, 13) >= nowHour));

    return h.time.slice(start, start + 24).map((time, k): HourlyPoint => {
      const i = start + k;
      return {
        time,
        temperature: h.temperature_2m[i] ?? 0,
        apparentTemperature: h.apparent_temperature[i] ?? 0,
        precipitation: h.precipitation[i] ?? 0,
        precipitationProbability: h.precipitation_probability[i] ?? null,
        weatherCode: h.weather_code[i] ?? 0,
        windSpeed: h.wind_speed_10m[i] ?? 0,
        uvIndex: h.uv_index[i] ?? null,
        aqi: aqiByTime.get(time) ?? null,
        isDay: h.is_day[i] === 1,
      };
    });
  }
}
