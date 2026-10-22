import { HttpErrorResponse } from '@angular/common/http';

export type AppErrorKind =
  | 'network'
  | 'rate-limit'
  | 'server'
  | 'geolocation-denied'
  | 'geolocation-unavailable'
  | 'geolocation-timeout'
  | 'unknown';

/** User-facing error: says what happened and what to do next. */
export interface AppError {
  kind: AppErrorKind;
  title: string;
  message: string;
}

export function isAppError(e: unknown): e is AppError {
  return typeof e === 'object' && e !== null && 'kind' in e && 'title' in e && 'message' in e;
}

/** Retry only failures that are likely to be temporary. */
export function isTransient(e: unknown): boolean {
  return e instanceof HttpErrorResponse && (e.status === 0 || e.status >= 500);
}

export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) {
      return { kind: 'network', title: "Can't reach the weather service", message: 'Check your internet connection and try again.' };
    }
    if (e.status === 429) {
      return { kind: 'rate-limit', title: 'Too many requests', message: 'Wait a minute, then try again.' };
    }
    if (e.status >= 500) {
      return { kind: 'server', title: 'Weather service is having trouble', message: 'Try again in a few minutes.' };
    }
  }
  return { kind: 'unknown', title: 'Something went wrong', message: 'Reload the page or try a different city.' };
}
