import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PwaService } from '../../core/services/pwa.service';

/**
 * Two small notices in one place:
 *  1. "You're offline" (shown only while offline)
 *  2. "Install Weathervane" (Chrome/Edge/Android prompt, or Add-to-Home-Screen steps on iPhone/iPad)
 * Injecting PwaService here is also what registers the service worker.
 */
@Component({
  selector: 'app-pwa-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pwa-bar.html',
  styleUrl: './pwa-bar.css',
})
export class PwaBar {
  protected readonly pwa = inject(PwaService);
}
