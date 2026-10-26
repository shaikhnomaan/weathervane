import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Activities } from './components/activities/activities';
import { CitySearch } from './components/city-search/city-search';
import { ErrorBanner } from './components/error-banner/error-banner';
import { ForecastList } from './components/forecast-list/forecast-list';
import { LoadingSpinner } from './components/loading-spinner/loading-spinner';
import { LocationButton } from './components/location-button/location-button';
import { WeatherCard } from './components/weather-card/weather-card';
import { GeolocationService, PermissionStatusValue } from './core/services/geolocation.service';
import { WeatherStore } from './core/state/weather.store';
import { describeWeather } from './core/util/weather-codes';
import { HourlyForecast } from './components/hourly-forecast/hourly-forecast';
import { ActivityPlanner } from './components/activity-planner/activity-planner';
import { PwaBar } from './components/pwa-bar/pwa-bar';
import { SavedCities } from './components/saved-cities/saved-cities';
import { TodayBrief } from './components/today-brief/today-brief';

/** Smart container: owns the store, passes plain data down, handles outputs. */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CitySearch, LocationButton, WeatherCard, ForecastList, Activities, LoadingSpinner, ErrorBanner, HourlyForecast, TodayBrief, SavedCities, PwaBar, ActivityPlanner],
  host: { '[attr.data-sky]': 'sky()' },
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly store = inject(WeatherStore);
  private readonly geo = inject(GeolocationService);
  private readonly citySearch = viewChild(CitySearch);

  protected readonly state = this.store.state;
  protected readonly permission = toSignal(this.geo.permission$, { initialValue: 'prompt' as PermissionStatusValue });

  /** Page theme follows live conditions. */
  protected readonly sky = computed(() => {
    const report = this.state().report;
    return report ? describeWeather(report.current.weatherCode, report.current.isDay).sky : 'idle';
  });

  protected onLocate(): void {
    this.citySearch()?.clear();
    this.store.locateMe();
  }
}
