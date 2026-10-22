# Weathervane: plan, architecture and data flow

## 1. Constraints and assumptions
| Area | Decision | Why |
|---|---|---|
| Framework | Angular 22 (latest stable, June 2026), standalone components, signals, zoneless | No NgModules; zoneless is the default since v21 |
| State | RxJS (`BehaviorSubject` store + `Subject` intents), exposed to templates via `toSignal` | The app has one domain slice. NgRx would add ceremony without payoff |
| Styling | Component-scoped CSS (Angular emulated encapsulation) + a small global file of CSS custom-property tokens | Scoped by default, zero extra tooling, themes switch with one attribute. CSS Modules need extra build config in Angular |
| Weather API | Open-Meteo (forecast + geocoding) | Free, no key, real-time `current` block, built-in city autocomplete. OpenWeatherMap's free tier needs a key that would be public in a browser app |
| a11y target | WCAG 2.2 AA: keyboard operable, visible focus, ARIA combobox, live regions, skip link, contrast-checked themes, reduced-motion |
| Responsive | Mobile-first: 1 column <48rem, wider header ≥48rem, two-column dashboard ≥64rem |
| Persistence | `localStorage` for last place and units only |
| Not in scope (MVP) | Accounts, saved-city lists, hourly charts, PWA/offline, i18n |

## 2. MVP scope
1. City search with debounced autocomplete.
2. "Use my location" (permission requested only on click; denied → clear message + city search).
3. Near-real-time updates: poll every 5 min, pause while tab hidden, refresh on tab focus and when back online.
4. Current conditions (temp, feels like, humidity, wind, precipitation, pressure) + 7-day forecast.
5. Loading, empty and error states; last good data stays visible if a refresh fails.
6. °C/°F toggle.

## 3. Component tree
```
App (smart, owns WeatherStore)
├─ CitySearch        (own search stream, emits placeSelected)
├─ LocationButton    (input: busy, permission → output: locate)
├─ ErrorBanner       (input: error → outputs: retry, dismissed)
├─ LoadingSpinner
├─ WeatherCard       (input: report, units, refreshing)
└─ ForecastList      (input: days, units)
```
Routing: single page, no router. If you add saved cities later, add `/` and `/city/:lat/:lon` routes and let the route params call `store.selectPlace`.

## 4. Data flow (conceptual)
```
 User actions                         WeatherStore (RxJS)                              View
 ────────────                         ───────────────────                              ────
 pick city ───────────▶ selectPlace() ─▶ place$ (BehaviorSubject) ─┐
 toggle units ────────▶ setUnits()  ──▶ units$ (BehaviorSubject) ──┴▶ combineLatest
                                                                         │
                                                                    switchMap  (cancels old city/units)
                                                                         │
        timer(0, 5 min) ─ skip while hidden ┐                            ▼
        visibilitychange (visible) ─────────┤                        trigger$ ──▶ tap(fetching=true)
        window "online" ────────────────────┤                            │
        refresh() ("Try again") ────────────┘                       switchMap (cancels slower request)
                                                                         │
                                                       WeatherApiService.getWeather()
                                                         │ retry ×2 (network / 5xx only)
                                                         │ catchError → of({ok:false})   ← keeps polling alive
                                                         ▼
 click "Use my location" ─▶ locate$ ─▶ switchMap ─▶ GeolocationService.getCurrentPosition()
                                                  ─▶ api.reverseGeocode() ─▶ selectPlace()
                                                  └ error → state.error (denied / timeout / unavailable)

                           patch() ─▶ stateSubject (BehaviorSubject<WeatherState>) ─▶ toSignal ─▶ templates
```

Autocomplete (inside `CitySearch`):
```
keystrokes ─▶ valueChanges ─▶ trim ─▶ debounceTime(250) ─▶ distinctUntilChanged
          ─▶ switchMap( q<2 ? idle : concat(loading, searchCities(q) ▶ catchError) ) ─▶ toSignal ─▶ listbox
```

## 5. Permissions and error handling
- Geolocation is requested **only after a click** (never on load), the Permissions API is observed so the button disables with an explanation when blocked.
- `denied` / `timeout` / `unavailable` each map to a plain-language `AppError`; the search box always remains usable.
- HTTP errors: `status 0` → network, `429` → rate limit, `5xx` → server; transient errors retry with backoff.
- A failed background refresh keeps the previous report visible and shows a dismissible banner.

## 6. Production notes
- `npm run build:prod` → `dist/weathervane/browser` (static files; host anywhere, SPA fallback not needed because there is no router).
- Open-Meteo's free API is for non-commercial use; for commercial use buy their API plan or self-host. Keep the attribution footer.
- If you switch to a keyed provider (e.g. OpenWeatherMap), call it through your own backend or serverless proxy so the key is not shipped to browsers, and keep the `WeatherApiService` method signatures unchanged.
- Add CSP headers allowing `connect-src` to `api.open-meteo.com`, `geocoding-api.open-meteo.com`, `api.bigdatacloud.net`, and `fonts.googleapis.com` / `fonts.gstatic.com` for fonts.
