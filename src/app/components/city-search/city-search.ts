import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, catchError, concat, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { Place } from '../../core/models/weather.models';
import { WeatherApiService } from '../../core/services/weather-api.service';

interface SearchState { query: string; items: Place[]; loading: boolean; failed: boolean }
const IDLE: SearchState = { query: '', items: [], loading: false, failed: false };

/**
 * Autocomplete following the ARIA 1.2 combobox pattern:
 * input[role=combobox] + ul[role=listbox], arrow keys / Enter / Escape.
 */
@Component({
  selector: 'app-city-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './city-search.html',
  styleUrl: './city-search.css',
})
export class CitySearch {
  private readonly api = inject(WeatherApiService);

  readonly placeSelected = output<Place>();

  readonly query = new FormControl('', { nonNullable: true });
  readonly dismissed = signal(false);
  readonly active = signal(-1);

  /** keystrokes → debounce → dedupe → switchMap (cancels stale requests) → state */
  readonly state = toSignal(
    this.query.valueChanges.pipe(
      map((v) => v.trim()),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q): Observable<SearchState> =>
        q.length < 2
          ? of({ ...IDLE, query: q })
          : concat(
              of({ query: q, items: [], loading: true, failed: false }),
              this.api.searchCities(q).pipe(
                map((items) => ({ query: q, items, loading: false, failed: false })),
                catchError(() => of({ query: q, items: [], loading: false, failed: true })),
              ),
            ),
      ),
    ),
    { initialValue: IDLE },
  );

  readonly open = computed(() => !this.dismissed() && this.state().items.length > 0);
  readonly activeId = computed(() => (this.open() && this.active() >= 0 ? 'city-opt-' + this.active() : null));
  readonly message = computed(() => {
    const s = this.state();
    if (this.dismissed()) return '';
    if (s.failed) return 'City search is unavailable. Check your connection and try again.';
    if (s.loading) return 'Searching…';
    if (s.query.length >= 2 && s.items.length === 0) return `No cities match “${s.query}”. Check the spelling.`;
    return '';
  });

  meta(p: Place): string {
    return [p.region, p.country].filter(Boolean).join(', ');
  }

  onInput(): void {
    this.dismissed.set(false);
    this.active.set(-1);
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.state().items.length;
    switch (event.key) {
      case 'ArrowDown':
        if (!count) return;
        event.preventDefault();
        this.dismissed.set(false);
        this.active.update((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        if (!count) return;
        event.preventDefault();
        this.dismissed.set(false);
        this.active.update((i) => (i <= 0 ? count - 1 : i - 1));
        break;
      case 'Enter': {
        const item = this.open() ? this.state().items[this.active()] : undefined;
        if (item) {
          event.preventDefault();
          this.choose(item);
        }
        break;
      }
      case 'Escape':
        this.dismissed.set(true);
        break;
    }
  }

  clear(): void {
    this.query.setValue('', { emitEvent: false });
    this.dismissed.set(true);
    this.active.set(-1);
  }

  choose(place: Place): void {
    this.placeSelected.emit(place);
    this.clear();
  }
}
