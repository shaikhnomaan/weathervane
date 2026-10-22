import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, timer } from 'rxjs';
import { UNIT_LABELS, Units, WeatherReport } from '../../core/models/weather.models';
import { compass, timeAgo } from '../../core/util/format';
import { describeWeather } from '../../core/util/weather-codes';

@Component({
  selector: 'app-weather-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './weather-card.html',
  styleUrl: './weather-card.css',
})
export class WeatherCard {
  readonly report = input.required<WeatherReport>();
  readonly units = input.required<Units>();
  readonly refreshing = input(false);

  /** Ticks every 30 s so "Updated 4 min ago" stays honest (RxJS timer → signal). */
  private readonly now = toSignal(timer(0, 30_000).pipe(map(() => Date.now())), { initialValue: Date.now() });

  readonly labels = computed(() => UNIT_LABELS[this.units()]);
  readonly info = computed(() => describeWeather(this.report().current.weatherCode, this.report().current.isDay));
  readonly temp = computed(() => Math.round(this.report().current.temperature));
  readonly feelsLike = computed(() => Math.round(this.report().current.apparentTemperature));
  readonly ago = computed(() => timeAgo(this.report().fetchedAt, this.now()));
  readonly regionLine = computed(() => [this.report().place.region, this.report().place.country].filter(Boolean).join(', '));

  readonly stats = computed(() => {
    const c = this.report().current;
    const l = this.labels();

    const aqiStatus = this.getAqiStatus(c.aqi);
    const uvStatus = this.getUvStatus(c.uvIndex);

    return [
      { label: 'Humidity', value: `${Math.round(c.humidity)}%` },
      { label: 'Wind', value: `${Math.round(c.windSpeed)} ${l.wind} ${compass(c.windDirection)}` },
      { label: 'Precipitation', value: `${c.precipitation} ${l.precip}` },
      { label: 'Pressure', value: `${Math.round(c.pressure)} hPa` },
      { label: 'AQI', value: c.aqi != null ? `${c.aqi}` : '—', sub: aqiStatus.label, statusClass: aqiStatus.className },
      { label: 'UV Index', value: c.uvIndex != null ? `${c.uvIndex}` : '—', sub: uvStatus.label, statusClass: uvStatus.className },
    ];
  });

  private getAqiStatus(aqi?: number | null): { label?: string; className: string; } {
    if (aqi == null || !Number.isFinite(aqi)) return { className: 'status-unknown' };
    if (aqi <= 50) return { label: 'Good', className: 'aqi-good' };
    if (aqi <= 100) return { label: 'Moderate', className: 'aqi-moderate' };
    if (aqi <= 150) return { label: 'Sensitive', className: 'aqi-sensitive' };
    if (aqi <= 200) return { label: 'Unhealthy', className: 'aqi-unhealthy' };
    if (aqi <= 300) return { label: 'Very Unhealthy', className: 'aqi-very-unhealthy' };
    return { label: 'Hazardous', className: 'aqi-hazardous' };
  }

  private getUvStatus(uv?: number | null): { label?: string; className: string; } {
    if (uv == null || !Number.isFinite(uv)) return { className: 'status-unknown' };
    if (uv <= 2) return { label: 'Low', className: 'uv-low' };
    if (uv <= 5) return { label: 'Moderate', className: 'uv-moderate' };
    if (uv <= 7) return { label: 'High', className: 'uv-high' };
    if (uv <= 10) return { label: 'Very High', className: 'uv-very-high' };
    return { label: 'Extreme', className: 'uv-extreme' };
  }
}
