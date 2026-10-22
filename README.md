# Weathervane

Responsive weather app: Angular 22 + RxJS + signals, powered by [Open-Meteo](https://open-meteo.com/) (no API key).

## Run
```bash
npm install
npm start            # http://localhost:4200
```
Geolocation works on `localhost` and on HTTPS origins only.

## Scripts
| Script | What it does |
|---|---|
| `npm start` | Dev server with live reload |
| `npm run build` | Development build |
| `npm run build:prod` | Optimised production build → `dist/weathervane/browser` |
| `npm run preview` | Serve the production build at http://localhost:8080 |
| `npm test` | Unit tests (Vitest via `ng test`) |

## If `npm install` complains about versions
Angular's TypeScript peer range moves between releases. Easiest fix:
```bash
npm i -g @angular/cli
ng new weathervane --style=css --ssr=false --routing=false
# then copy this project's src/ over the generated src/ (keep generated package.json/angular.json)
```
Make sure `src/app/app.config.ts` still provides `provideHttpClient(withFetch())`.

## Layout
```
src/app/
  app.ts, app.config.ts          root component and providers
  core/
    config.ts                    API URLs, poll interval
    models/                      types and user-facing errors
    services/                    WeatherApiService, GeolocationService
    state/weather.store.ts       RxJS store (the heart of the app)
    util/                        WMO code mapping, formatting (+ unit tests)
  components/                    CitySearch, LocationButton, WeatherCard,
                                 ForecastList, LoadingSpinner, ErrorBanner
docs/ARCHITECTURE.md             plan, decisions, data-flow diagrams
```
See `docs/ARCHITECTURE.md` for the full plan.
