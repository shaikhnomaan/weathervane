import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PermissionStatusValue } from '../../core/services/geolocation.service';

@Component({
  selector: 'app-location-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './location-button.html',
  styleUrl: './location-button.css',
})
export class LocationButton {
  readonly busy = input(false);
  readonly permission = input<PermissionStatusValue>('prompt');
  readonly locate = output<void>();
}
