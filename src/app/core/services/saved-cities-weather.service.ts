/**
 * Live temperature + icon for ALL saved cities in ONE request.
 * Open-Meteo accepts comma-separated coordinates, so 8 cities cost 1 call, not 8.
 * Separate from WeatherApiService on purpose: your existing service is not modified.
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { API } from '../config';
import { Place, Units } from '../models/weather.models';

export interface CityGlance {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
}

interface GlanceResponse {
  current: { temperature_2m: number; weather_code: number; is_day: number };
}

@Injectable({ providedIn: 'root' })
export class SavedCitiesWeatherService {
  private readonly http = inject(HttpClient);

  /** Result is in the same order as `places`. */
  getGlance(places: Place[], units: Units): Observable<CityGlance[]> {
    if (!places.length) return of([]);

    const params = new HttpParams({
      fromObject: {
        latitude: places.map((p) => p.latitude).join(','),
        longitude: places.map((p) => p.longitude).join(','),
        current: 'temperature_2m,weather_code,is_day',
        temperature_unit: units === 'imperial' ? 'fahrenheit' : 'celsius',
      },
    });

    return this.http.get<GlanceResponse | GlanceResponse[]>(API.forecast, { params }).pipe(
      // With ONE location the API returns an object; with several it returns an array.
      map((r) =>
        (Array.isArray(r) ? r : [r]).map((x): CityGlance => ({
          temperature: x.current.temperature_2m,
          weatherCode: x.current.weather_code,
          isDay: x.current.is_day === 1,
        })),
      ),
    );
  }
}
