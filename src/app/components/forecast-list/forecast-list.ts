import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DailyForecast, UNIT_LABELS, Units } from '../../core/models/weather.models';
import { describeWeather } from '../../core/util/weather-codes';

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

@Component({
  selector: 'app-forecast-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forecast-list.html',
  styleUrl: './forecast-list.css',
})
export class ForecastList {
  readonly days = input.required<DailyForecast[]>();
  readonly units = input.required<Units>();

  readonly unitName = computed(() => UNIT_LABELS[this.units()].tempName);

  /** Each row's bar spans that day's low→high relative to the week's overall range. */
  readonly rows = computed(() => {
    const days = this.days();
    if (!days.length) return [];
    const lo = Math.min(...days.map((d) => d.tempMin));
    const hi = Math.max(...days.map((d) => d.tempMax));
    const span = Math.max(hi - lo, 1);
    return days.map((d, i) => {
      const info = describeWeather(d.weatherCode);
      return {
        key: d.date,
        // Parse at local noon so the calendar date never shifts across time zones.
        day: i === 0 ? 'Today' : WEEKDAY.format(new Date(`${d.date}T12:00:00`)),
        icon: info.icon,
        label: info.label,
        rain: d.precipitationProbability ?? 0,
        min: Math.round(d.tempMin),
        max: Math.round(d.tempMax),
        left: ((d.tempMin - lo) / span) * 100,
        width: ((d.tempMax - d.tempMin) / span) * 100,
      };
    });
  });
}
