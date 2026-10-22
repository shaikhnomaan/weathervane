import { Injectable } from '@angular/core';
import { Observable, catchError, defer, from, fromEvent, map, of, shareReplay, startWith, switchMap, throwError } from 'rxjs';
import { AppError } from '../models/errors';
import { Coordinates } from '../models/weather.models';

export type PermissionStatusValue = PermissionState | 'unsupported';

/** Wraps the browser Geolocation + Permissions APIs as observables. */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  /**
   * Emits the current permission state and any later change
   * ('granted' | 'denied' | 'prompt', or 'unsupported' where the Permissions API is missing).
   */
  readonly permission$: Observable<PermissionStatusValue> = defer(() =>
    navigator.permissions
      ? from(navigator.permissions.query({ name: 'geolocation' }))
      : throwError(() => new Error('unsupported')),
  ).pipe(
    switchMap((status) =>
      fromEvent(status, 'change').pipe(
        map(() => status.state as PermissionStatusValue),
        startWith(status.state as PermissionStatusValue),
      ),
    ),
    catchError(() => of<PermissionStatusValue>('unsupported')),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** One-shot position lookup. Triggers the browser permission prompt on first use. */
  getCurrentPosition(): Observable<Coordinates> {
    return new Observable<Coordinates>((subscriber) => {
      if (!('geolocation' in navigator)) {
        subscriber.error(ERRORS.unavailable);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          subscriber.next({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          subscriber.complete();
        },
        (err) => subscriber.error(toGeoError(err)),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
      );
    });
  }
}

const ERRORS = {
  denied: {
    kind: 'geolocation-denied',
    title: 'Location access is off',
    message: 'Search for a city instead, or allow location for this site in your browser settings.',
  },
  unavailable: {
    kind: 'geolocation-unavailable',
    title: "Couldn't find your location",
    message: 'Your device did not return a position. Search for a city instead.',
  },
  timeout: {
    kind: 'geolocation-timeout',
    title: 'Location took too long',
    message: 'Try again, or search for a city instead.',
  },
} satisfies Record<string, AppError>;

function toGeoError(err: GeolocationPositionError): AppError {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return ERRORS.denied;
    case err.TIMEOUT:
      return ERRORS.timeout;
    default:
      return ERRORS.unavailable;
  }
}
