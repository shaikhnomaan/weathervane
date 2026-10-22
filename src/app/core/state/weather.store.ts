import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Subject, catchError, combineLatest, filter, fromEvent, map, merge,
  of, retry, switchMap, tap, throwError, timer,
} from 'rxjs';
import { POLL_INTERVAL_MS } from '../config';
import { AppError, isTransient, toAppError } from '../models/errors';
import { Place, Units, WeatherReport } from '../models/weather.models';
import { GeolocationService } from '../services/geolocation.service';
import { WeatherApiService } from '../services/weather-api.service';

export interface WeatherState {
  place: Place | null;
  units: Units;
  report: WeatherReport | null;
  /** A weather request is in flight (first load OR background refresh). */
  fetching: boolean;
  /** Waiting on the browser's geolocation answer. */
  locating: boolean;
  error: AppError | null;
}

const PLACE_KEY = 'weathervane.place';
const UNITS_KEY = 'weathervane.units';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota): safe to ignore */
  }
}
function defaultUnits(): Units {
  return read<Units>(UNITS_KEY) ?? 'metric';
}

/**
 * Single source of truth for weather data.
 *
 *   intents (Subjects)                     streams                           state
 *   ───────────────────   ┌───────────────────────────────────────┐   ┌─────────────────┐
 *   place$ ─┐             │ combineLatest(place, units)           │   │ stateSubject    │
 *   units$ ─┴────────────▶│  └ switchMap(→ trigger$ → HTTP)       │──▶│ (BehaviorSubject)│──▶ state$ / state()
 *   refreshNow$ ─────────▶│       trigger$ = timer ∪ visible ∪    │   └─────────────────┘
 *   locate$ ─▶ geo ─▶ place$      online ∪ refreshNow$            │
 *                         └───────────────────────────────────────┘
 */
@Injectable({ providedIn: 'root' })
export class WeatherStore {
  private readonly api = inject(WeatherApiService);
  private readonly geo = inject(GeolocationService);

  // ---- Intents ----
  private readonly place$ = new BehaviorSubject<Place | null>(read<Place>(PLACE_KEY));
  private readonly units$ = new BehaviorSubject<Units>(defaultUnits());
  private readonly refreshNow$ = new Subject<void>();
  private readonly locate$ = new Subject<void>();

  // ---- State ----
  private readonly stateSubject = new BehaviorSubject<WeatherState>({
    place: this.place$.value,
    units: this.units$.value,
    report: null,
    fetching: this.place$.value !== null,
    locating: false,
    error: null,
  });
  readonly state$ = this.stateSubject.asObservable();
  /** Signal view of the state for templates. BehaviorSubject emits synchronously, so requireSync is safe. */
  readonly state = toSignal(this.state$, { requireSync: true });

  constructor() {
    this.connectWeatherStream();
    this.connectLocateStream();
  }

  // ---- Public API ----
  selectPlace(place: Place): void {
    write(PLACE_KEY, place);
    // Clear the old report immediately so a stale city never flashes under a new heading.
    this.patch({ place, report: null, error: null, fetching: true });
    this.place$.next(place);
  }

  locateMe(): void {
    this.locate$.next();
  }

  refresh(): void {
    this.refreshNow$.next();
  }

  setUnits(units: Units): void {
    if (units === this.units$.value) return;
    write(UNITS_KEY, units);
    this.patch({ units });
    this.units$.next(units);
  }

  dismissError(): void {
    this.patch({ error: null });
  }

  // ---- Streams ----
  /**
   * place + units  →  (switch to) a fresh polling stream  →  HTTP
   * switchMap cancels the previous city's polling AND any in-flight request
   * the moment the user picks another city or unit.
   */
  private connectWeatherStream(): void {
    const tabVisible$ = fromEvent(document, 'visibilitychange').pipe(filter(() => !document.hidden));
    const backOnline$ = fromEvent(window, 'online');

    combineLatest([this.place$.pipe(filter((p): p is Place => p !== null)), this.units$])
      .pipe(
        switchMap(([place, units]) => {
          const trigger$ = merge(
            // Immediate load, then every POLL_INTERVAL_MS, but skip ticks while the tab is hidden.
            timer(0, POLL_INTERVAL_MS).pipe(filter((tick) => tick === 0 || !document.hidden)),
            tabVisible$, // catch up as soon as the user returns to the tab
            backOnline$, // retry as soon as the connection is back
            this.refreshNow$, // manual "Try again"
          );

          return trigger$.pipe(
            tap(() => this.patch({ fetching: true, error: null })),
            // Inner switchMap: a new trigger cancels a slower, older request.
            switchMap(() =>
              this.api.getWeather(place, units).pipe(
                retry({
                  count: 2,
                  delay: (err, attempt) => (isTransient(err) ? timer(attempt * 1000) : throwError(() => err)),
                }),
                map((report) => ({ ok: true as const, report })),
                // Catch INSIDE so one failed poll never kills the polling stream.
                catchError((err: unknown) => of({ ok: false as const, error: toAppError(err) })),
              ),
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (result.ok) this.patch({ report: result.report, fetching: false, error: null });
        else this.patch({ fetching: false, error: result.error }); // keeps the last good report on screen
      });
  }

  /** locate click → browser permission → coordinates → place name → selectPlace(). */
  private connectLocateStream(): void {
    this.locate$
      .pipe(
        tap(() => this.patch({ locating: true, error: null })),
        switchMap(() =>
          this.geo.getCurrentPosition().pipe(
            switchMap((coords) => this.api.reverseGeocode(coords)),
            map((place) => ({ ok: true as const, place })),
            catchError((err: unknown) => of({ ok: false as const, error: toAppError(err) })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.patch({ locating: false });
        if (result.ok) this.selectPlace(result.place);
        else this.patch({ error: result.error }); // user can still search by city
      });
  }

  private patch(partial: Partial<WeatherState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
