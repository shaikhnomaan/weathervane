import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { HourlyPoint, Units } from '../../core/models/weather.models';
import { planBestTimes } from '../../core/util/best-time';

/**
 * "Best time to go out": for each activity, the best window in the next 24 hours,
 * plus an hour-by-hour strip for the selected activity.
 * Separate from the existing Activities component (which rates "right now").
 * All scoring lives in core/util/best-time.ts.
 */
@Component({
  selector: 'app-activity-planner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity-planner.html',
  styleUrl: './activity-planner.css',
})
export class ActivityPlanner {
  readonly hours = input.required<HourlyPoint[]>();
  readonly units = input.required<Units>();

  protected readonly selectedId = signal('running');

  protected readonly results = computed(() => planBestTimes(this.hours(), this.units()));
  protected readonly selected = computed(() => this.results().find((r) => r.id === this.selectedId()) ?? null);

  protected select(id: string): void {
    this.selectedId.set(id);
  }
}
