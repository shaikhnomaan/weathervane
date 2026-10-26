import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, combineLatest, filter, map, switchMap, timer } from 'rxjs';
import { Place, Units } from '../../core/models/weather.models';
import { CityGlance, SavedCitiesWeatherService } from '../../core/services/saved-cities-weather.service';
import { SavedCitiesStore } from '../../core/state/saved-cities.store';
import { MAX_SAVED, placeKey, samePlace } from '../../core/util/saved-places';
import { describeWeather } from '../../core/util/weather-codes';

const REFRESH_MS = 10 * 60 * 1000;

/**
 * Quick-switch chips for saved cities, each with live temperature, plus a Save button
 * for the city currently on screen.
 * Needs only two inputs and one output, so App just passes the active place and reacts to a pick.
 */
@Component({
  selector: 'app-saved-cities',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './saved-cities.html',
  styleUrl: './saved-cities.css',
})
export class SavedCities {
  private readonly store = inject(SavedCitiesStore);
  private readonly api = inject(SavedCitiesWeatherService);

  /** The city currently shown in the app (null before anything is chosen). */
  readonly activePlace = input<Place | null>(null);
  readonly units = input.required<Units>();
  /** Emits when a saved chip is tapped. */
  readonly placeSelected = output<Place>();

  protected readonly announcement = signal('');
  protected readonly maxSaved = MAX_SAVED;

  /**
   * saved list + units + 10-minute timer -> one batched request -> map keyed by place.
   * switchMap cancels an older request; on error the previous temperatures simply stay.
   */
  private readonly glances = toSignal(
    combineLatest([
      this.store.places$,
      toObservable(this.units),
      timer(0, REFRESH_MS).pipe(filter((tick) => tick === 0 || !document.hidden)),
    ]).pipe(
      switchMap(([places, units]) =>
        this.api.getGlance(places, units).pipe(
          map((list) => {
            const byKey = new Map<string, CityGlance>();
            places.forEach((place, i) => {
              if (list[i]) byKey.set(placeKey(place), list[i]);
            });
            return byKey;
          }),
          catchError(() => EMPTY),
        ),
      ),
    ),
    { initialValue: new Map<string, CityGlance>() },
  );

  protected readonly chips = computed(() => {
    const active = this.activePlace();
    const glances = this.glances();
    return this.store.places().map((place) => {
      const glance = glances.get(placeKey(place));
      const temp = glance ? Math.round(glance.temperature) : null;
      return {
        place,
        key: placeKey(place),
        name: place.name,
        temp,
        icon: glance ? describeWeather(glance.weatherCode, glance.isDay).icon : '',
        active: !!active && samePlace(active, place),
        label: temp === null ? place.name : `${place.name}, ${temp} degrees`,
      };
    });
  });

  protected readonly isSaved = computed(() => {
    const active = this.activePlace();
    return !!active && this.store.places().some((p) => samePlace(p, active));
  });

  protected readonly isFull = computed(() => this.store.places().length >= MAX_SAVED);

  protected select(place: Place): void {
    this.placeSelected.emit(place);
  }

  protected save(place: Place): void {
    this.store.add(place);
    this.announcement.set(`${place.name} saved.`);
  }

  protected remove(place: Place): void {
    this.store.remove(place);
    this.announcement.set(`${place.name} removed.`);
  }
}
