import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AppError } from '../../core/models/errors';

@Component({
  selector: 'app-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-banner.html',
  styleUrl: './error-banner.css',
})
export class ErrorBanner {
  readonly error = input.required<AppError>();
  readonly canRetry = input(false);
  readonly retry = output<void>();
  readonly dismissed = output<void>();
}
