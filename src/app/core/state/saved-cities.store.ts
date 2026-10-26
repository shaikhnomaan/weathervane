/**
 * Saved cities: a small RxJS store persisted in localStorage.
 * Independent of WeatherStore, so nothing in your existing state code changes.
 */
import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject } from 'rxjs';
import { Place } from '../models/weather.models';
import { addPlace, parseSaved, removePlace } from '../util/saved-places';

const STORAGE_KEY = 'weathervane.saved';

function load(): Place[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseSaved(JSON.parse(raw)) : [];
  } catch {
    return []; // storage blocked or corrupted: start empty
  }
}

function persist(list: Place[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode / quota): the list still works for this session */
  }
}

@Injectable({ providedIn: 'root' })
export class SavedCitiesStore {
  private readonly subject = new BehaviorSubject<Place[]>(load());

  readonly places$ = this.subject.asObservable();
  /** Signal view for templates. BehaviorSubject emits synchronously, so requireSync is safe. */
  readonly places = toSignal(this.places$, { requireSync: true });

  add(place: Place): void {
    const next = addPlace(this.subject.value, place);
    if (next !== this.subject.value) this.commit(next);
  }

  remove(place: Place): void {
    this.commit(removePlace(this.subject.value, place));
  }

  private commit(list: Place[]): void {
    persist(list);
    this.subject.next(list);
  }
}
