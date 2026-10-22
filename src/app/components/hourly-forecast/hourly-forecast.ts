import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { HourlyPoint, UNIT_LABELS, Units } from '../../core/models/weather.models';
import { HourlyMetric, formatHour, metricCell } from '../../core/util/hourly-format';
import { describeWeather } from '../../core/util/weather-codes';

const METRICS: { id: HourlyMetric; label: string }[] = [
  { id: 'rain', label: 'Rain' },
  { id: 'wind', label: 'Wind' },
  { id: 'uv', label: 'UV' },
  { id: 'aqi', label: 'Air' },
];

/** Presentational: next-24-hours strip with a temperature curve and a switchable detail row. */
@Component({
  selector: 'app-hourly-forecast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hourly-forecast.html',
  styleUrl: './hourly-forecast.css',
})
export class HourlyForecast {
  readonly hours = input.required<HourlyPoint[]>();
  readonly units = input.required<Units>();

  protected readonly metrics = METRICS;
  protected readonly metric = signal<HourlyMetric>('rain');

  /** Each cell is 3.5rem wide; the strip scrolls sideways when the screen is narrower. */
  protected readonly cellRem = 3.5;
  protected readonly widthRem = computed(() => this.hours().length * this.cellRem);

  protected readonly note = computed(() => {
    const u = UNIT_LABELS[this.units()];
    switch (this.metric()) {
      case 'rain': return 'Chance of rain each hour';
      case 'wind': return `Wind speed in ${u.wind}`;
      case 'uv': return 'UV index (0 at night)';
      case 'aqi': return 'Air quality, US AQI';
    }
  });

  protected readonly rows = computed(() => {
    const hours = this.hours();
    const metric = this.metric();
    const units = this.units();
    return hours.map((h, i) => {
      const hour = Number(h.time.slice(11, 13));
      const info = describeWeather(h.weatherCode, h.isDay);
      const cell = metricCell(h, metric, units);
      const label = i === 0 ? 'Now' : formatHour(hour);
      const temp = Math.round(h.temperature);
      return {
        key: h.time,
        label,
        icon: info.icon,
        temp,
        night: !h.isDay,
        newDay: hour === 0 && i > 0,
        value: cell.value,
        level: cell.level,
        spoken: `${label}${hour === 0 && i > 0 ? ', tomorrow' : ''}: ${info.label}, ${temp} degrees, ${cell.spoken}`,
      };
    });
  });

  /** Temperature curve in a (columns x 100) box; x = column centre, y = 10..90 (top = warmest). */
  protected readonly curve = computed(() => {
    const temps = this.hours().map((h) => h.temperature);
    if (temps.length < 2) return '';
    const min = Math.min(...temps);
    const span = Math.max(Math.max(...temps) - min, 1);
    return temps.map((t, i) => `${i + 0.5},${(90 - ((t - min) / span) * 80).toFixed(1)}`).join(' ');
  });
}
