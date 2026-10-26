import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Units, WeatherReport } from '../../core/models/weather.models';
import { buildBrief } from '../../core/util/daily-brief';

/**
 * "Today at a glance": greeting, a one-line summary, quick answers
 * (umbrella / jacket / sunscreen / heat / air / laundry) and sun times.
 * Presentational: all logic lives in core/util/daily-brief.ts.
 */
@Component({
  selector: 'app-today-brief',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './today-brief.html',
  styleUrl: './today-brief.css',
})
export class TodayBrief {
  readonly report = input.required<WeatherReport>();
  readonly units = input.required<Units>();

  protected readonly brief = computed(() => buildBrief(this.report(), this.units()));
}
