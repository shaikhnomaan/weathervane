/**
 * PWA support: registers the service worker, tracks online/offline,
 * and handles the "Install app" prompt (Chrome/Edge/Android) plus the iOS hint.
 *
 * The service worker is only registered in production builds (isDevMode() is false),
 * so `ng serve` is never affected by caching.
 */
import { Injectable, computed, isDevMode, signal } from '@angular/core';

/** Not in TypeScript's DOM types yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'weathervane.install.dismissedAt';
const DISMISS_DAYS = 14;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function detectStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIos(): boolean {
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; // iPads report as Mac
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || iPadOs;
}

@Injectable({ providedIn: 'root' })
export class PwaService {
  /** False when the browser reports no connection. */
  readonly online = signal(navigator.onLine);
  /** True when the browser offered a native install prompt. */
  readonly canInstall = signal(false);
  private readonly installed = signal(false);
  private readonly dismissed = signal(recentlyDismissed());

  private readonly standalone = detectStandalone(); // already running as an installed app
  private readonly ios = detectIos(); //               iOS has no prompt: show "Add to Home Screen" steps

  /** Show the install banner? Never when already installed, or dismissed in the last 14 days. */
  readonly showInstall = computed(
    () => !this.standalone && !this.installed() && !this.dismissed() && (this.canInstall() || this.ios),
  );

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor() {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault(); // keep the event so we can show our own button
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
      this.installed.set(true);
    });

    this.registerServiceWorker();
  }

  async install(): Promise<void> {
    const prompt = this.deferredPrompt;
    if (!prompt) return;
    this.deferredPrompt = null; // a prompt can only be used once
    this.canInstall.set(false);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'dismissed') this.dismiss();
  }

  /** Hide the banner for 14 days. */
  dismiss(): void {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore: banner just comes back next visit */
    }
    this.dismissed.set(true);
  }

  private registerServiceWorker(): void {
    if (isDevMode() || !('serviceWorker' in navigator)) return;
    // new URL(..., baseURI) keeps this working if the app is ever hosted under a sub-path.
    const register = () =>
      navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href).catch(() => {
        /* offline support is optional: the app works without it */
      });
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
}
