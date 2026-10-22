import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrentConditions, Units } from '../../core/models/weather.models';

export type ActivityStatus = 'Great' | 'Good' | 'Fair' | 'Bad';

export interface ActivityItem {
  id: string;
  name: string;
  icon: string;
  status: ActivityStatus;
  badgeClass: string;
  reason: string;
}

@Component({
  selector: 'app-activities',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activities.html',
  styleUrl: './activities.css',
})
export class Activities {
  readonly current = input.required<CurrentConditions>();
  readonly units = input.required<Units>();

  readonly activities = computed<ActivityItem[]>(() => {
    const c = this.current();
    const isImperial = this.units() === 'imperial';

    // Normalize to metric for consistent threshold logic
    const tempC = isImperial ? ((c.temperature - 32) * 5) / 9 : c.temperature;
    const feelsC = isImperial ? ((c.apparentTemperature - 32) * 5) / 9 : c.apparentTemperature;
    const windKmh = isImperial ? c.windSpeed * 1.60934 : c.windSpeed;
    const precipMm = isImperial ? c.precipitation * 25.4 : c.precipitation;

    const isSnow = (c.weatherCode >= 71 && c.weatherCode <= 77) || (c.weatherCode >= 85 && c.weatherCode <= 86);
    const isThunder = c.weatherCode >= 95;
    const isHeavyRain = precipMm > 3 || (c.weatherCode >= 63 && c.weatherCode <= 67) || (c.weatherCode >= 81 && c.weatherCode <= 82);
    const isLightRain = precipMm > 0 || (c.weatherCode >= 51 && c.weatherCode <= 61);
    const aqi = c.aqi;

    return [
      this.evaluateRunning(tempC, feelsC, windKmh, isSnow, isThunder, isHeavyRain, isLightRain, aqi),
      this.evaluateJogging(tempC, feelsC, windKmh, isSnow, isThunder, isHeavyRain, isLightRain, aqi),
      this.evaluateCycling(tempC, feelsC, windKmh, isSnow, isThunder, isHeavyRain, isLightRain, aqi),
      this.evaluateHiking(tempC, feelsC, windKmh, isSnow, isThunder, isHeavyRain, isLightRain, c.weatherCode),
      this.evaluateWalking(tempC, feelsC, windKmh, isSnow, isThunder, isHeavyRain, isLightRain),
      this.evaluateOutdoorDining(tempC, windKmh, isSnow, isThunder, isHeavyRain, isLightRain),
    ];
  });

  private evaluateRunning(
    tempC: number,
    feelsC: number,
    windKmh: number,
    isSnow: boolean,
    isThunder: boolean,
    isHeavyRain: boolean,
    isLightRain: boolean,
    aqi?: number,
  ): ActivityItem {
    if (isThunder || isHeavyRain || isSnow) {
      return {
        id: 'running',
        name: 'Running',
        icon: '🏃',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: isSnow ? 'Snow & slippery paths' : isThunder ? 'Thunderstorm risk' : 'Heavy rain & puddles',
      };
    }
    if (aqi != null && aqi > 150) {
      return {
        id: 'running',
        name: 'Running',
        icon: '🏃',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: 'Poor air quality (high AQI)',
      };
    }
    if (tempC > 33 || feelsC > 35) {
      return {
        id: 'running',
        name: 'Running',
        icon: '🏃',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: 'High heat exhaustion risk',
      };
    }
    if (tempC < -2) {
      return {
        id: 'running',
        name: 'Running',
        icon: '🏃',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: 'Freezing temperatures',
      };
    }
    if (isLightRain) {
      return {
        id: 'running',
        name: 'Running',
        icon: '🏃',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: 'Light rain - wear waterproof gear',
      };
    }
    if (tempC > 27) {
      return {
        id: 'running',
        name: 'Running',
        icon: '🏃',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: 'Warm conditions - hydrate frequently',
      };
    }
    if (tempC < 7 || windKmh > 30) {
      return {
        id: 'running',
        name: 'Running',
        icon: '🏃',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: windKmh > 30 ? 'High headwind' : 'Chilly - layer up',
      };
    }
    if (aqi != null && aqi > 100) {
      return {
        id: 'running',
        name: 'Running',
        icon: '🏃',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: 'Moderate AQI - sensitive lungs take care',
      };
    }
    if (tempC >= 11 && tempC <= 20 && windKmh < 20) {
      return {
        id: 'running',
        name: 'Running',
        icon: '🏃',
        status: 'Great',
        badgeClass: 'status-great',
        reason: 'Prime running temperature & breeze',
      };
    }
    return {
      id: 'running',
      name: 'Running',
      icon: '🏃',
      status: 'Good',
      badgeClass: 'status-good',
      reason: 'Comfortable weather for running',
    };
  }

  private evaluateJogging(
    tempC: number,
    feelsC: number,
    windKmh: number,
    isSnow: boolean,
    isThunder: boolean,
    isHeavyRain: boolean,
    isLightRain: boolean,
    aqi?: number,
  ): ActivityItem {
    if (isThunder || isHeavyRain || isSnow) {
      return {
        id: 'jogging',
        name: 'Jogging',
        icon: '👟',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: 'Inclement weather outside',
      };
    }
    if (tempC > 34 || feelsC > 36 || (aqi != null && aqi > 150)) {
      return {
        id: 'jogging',
        name: 'Jogging',
        icon: '👟',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: aqi && aqi > 150 ? 'Unhealthy air pollution' : 'Excessive heat',
      };
    }
    if (isLightRain) {
      return {
        id: 'jogging',
        name: 'Jogging',
        icon: '👟',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: 'Light precipitation',
      };
    }
    if (tempC > 28 || tempC < 6 || windKmh > 28) {
      return {
        id: 'jogging',
        name: 'Jogging',
        icon: '👟',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: tempC > 28 ? 'Warm - keep a steady pace' : 'Brisk chill in the air',
      };
    }
    if (tempC >= 13 && tempC <= 23 && windKmh < 18) {
      return {
        id: 'jogging',
        name: 'Jogging',
        icon: '👟',
        status: 'Great',
        badgeClass: 'status-great',
        reason: 'Crisp & inviting conditions',
      };
    }
    return {
      id: 'jogging',
      name: 'Jogging',
      icon: '👟',
      status: 'Good',
      badgeClass: 'status-good',
      reason: 'Favorable jog conditions',
    };
  }

  private evaluateCycling(
    tempC: number,
    feelsC: number,
    windKmh: number,
    isSnow: boolean,
    isThunder: boolean,
    isHeavyRain: boolean,
    isLightRain: boolean,
    aqi?: number,
  ): ActivityItem {
    if (isThunder || isHeavyRain || isSnow || windKmh > 38) {
      return {
        id: 'cycling',
        name: 'Cycling',
        icon: '🚴',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: windKmh > 38 ? 'Dangerous wind gusts' : 'Slick roads & low grip',
      };
    }
    if (tempC > 35 || tempC < 2) {
      return {
        id: 'cycling',
        name: 'Cycling',
        icon: '🚴',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: tempC > 35 ? 'Extreme heat' : 'Freezing tarmac',
      };
    }
    if (isLightRain) {
      return {
        id: 'cycling',
        name: 'Cycling',
        icon: '🚴',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: 'Damp roads - brake earlier',
      };
    }
    if (windKmh > 24) {
      return {
        id: 'cycling',
        name: 'Cycling',
        icon: '🚴',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: 'Moderate headwinds',
      };
    }
    if (tempC > 29 || tempC < 10) {
      return {
        id: 'cycling',
        name: 'Cycling',
        icon: '🚴',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: tempC > 29 ? 'Warm - carry plenty of water' : 'Cold airflow',
      };
    }
    if (tempC >= 15 && tempC <= 24 && windKmh < 16) {
      return {
        id: 'cycling',
        name: 'Cycling',
        icon: '🚴',
        status: 'Great',
        badgeClass: 'status-great',
        reason: 'Smooth roads & calm winds',
      };
    }
    return {
      id: 'cycling',
      name: 'Cycling',
      icon: '🚴',
      status: 'Good',
      badgeClass: 'status-good',
      reason: 'Good weather for a ride',
    };
  }

  private evaluateHiking(
    tempC: number,
    feelsC: number,
    windKmh: number,
    isSnow: boolean,
    isThunder: boolean,
    isHeavyRain: boolean,
    isLightRain: boolean,
    weatherCode: number,
  ): ActivityItem {
    const isFog = weatherCode === 45 || weatherCode === 48;
    if (isThunder || isHeavyRain || isSnow || isFog) {
      return {
        id: 'hiking',
        name: 'Hiking',
        icon: '🥾',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: isFog ? 'Low trail visibility' : 'Muddy / hazardous trails',
      };
    }
    if (tempC > 34 || tempC < 0) {
      return {
        id: 'hiking',
        name: 'Hiking',
        icon: '🥾',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: tempC > 34 ? 'Heat exhaustion hazard' : 'Freezing trail conditions',
      };
    }
    if (isLightRain) {
      return {
        id: 'hiking',
        name: 'Hiking',
        icon: '🥾',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: 'Damp paths - wear tread shoes',
      };
    }
    if (tempC > 28 || tempC < 7 || windKmh > 30) {
      return {
        id: 'hiking',
        name: 'Hiking',
        icon: '🥾',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: tempC > 28 ? 'Warm - pack sunscreen & fluids' : 'Cold / breezy at elevation',
      };
    }
    if (tempC >= 13 && tempC <= 23 && windKmh < 20) {
      return {
        id: 'hiking',
        name: 'Hiking',
        icon: '🥾',
        status: 'Great',
        badgeClass: 'status-great',
        reason: 'Stunning & clear trail weather',
      };
    }
    return {
      id: 'hiking',
      name: 'Hiking',
      icon: '🥾',
      status: 'Good',
      badgeClass: 'status-good',
      reason: 'Pleasant conditions for trekking',
    };
  }

  private evaluateWalking(
    tempC: number,
    feelsC: number,
    windKmh: number,
    isSnow: boolean,
    isThunder: boolean,
    isHeavyRain: boolean,
    isLightRain: boolean,
  ): ActivityItem {
    if (isThunder || isHeavyRain) {
      return {
        id: 'walking',
        name: 'Walking',
        icon: '🚶',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: 'Heavy rain & storms outside',
      };
    }
    if (tempC > 37 || tempC < -6) {
      return {
        id: 'walking',
        name: 'Walking',
        icon: '🚶',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: 'Uncomfortable extreme temperatures',
      };
    }
    if (isLightRain) {
      return {
        id: 'walking',
        name: 'Walking',
        icon: '🚶',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: 'Carry an umbrella for drizzles',
      };
    }
    if (tempC > 31 || tempC < 5 || windKmh > 34) {
      return {
        id: 'walking',
        name: 'Walking',
        icon: '🚶',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: tempC > 31 ? 'Hot sun - seek shaded routes' : 'Chilly breeze',
      };
    }
    if (tempC >= 15 && tempC <= 25 && windKmh < 18) {
      return {
        id: 'walking',
        name: 'Walking',
        icon: '🚶',
        status: 'Great',
        badgeClass: 'status-great',
        reason: 'Delightful & refreshing outdoor stroll',
      };
    }
    return {
      id: 'walking',
      name: 'Walking',
      icon: '🚶',
      status: 'Good',
      badgeClass: 'status-good',
      reason: 'Nice weather for an outdoor walk',
    };
  }

  private evaluateOutdoorDining(
    tempC: number,
    windKmh: number,
    isSnow: boolean,
    isThunder: boolean,
    isHeavyRain: boolean,
    isLightRain: boolean,
  ): ActivityItem {
    if (isThunder || isHeavyRain || isSnow || isLightRain) {
      return {
        id: 'dining',
        name: 'Outdoor Dining',
        icon: '🍽️',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: 'Rainy / wet patio conditions',
      };
    }
    if (windKmh > 26) {
      return {
        id: 'dining',
        name: 'Outdoor Dining',
        icon: '🍽️',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: 'Windy - items may blow away',
      };
    }
    if (tempC < 13 || tempC > 35) {
      return {
        id: 'dining',
        name: 'Outdoor Dining',
        icon: '🍽️',
        status: 'Bad',
        badgeClass: 'status-bad',
        reason: tempC < 13 ? 'Too chilly for outdoor seating' : 'Too hot without climate control',
      };
    }
    if (tempC >= 13 && tempC < 18) {
      return {
        id: 'dining',
        name: 'Outdoor Dining',
        icon: '🍽️',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: 'Cool - patio heaters recommended',
      };
    }
    if (tempC > 28) {
      return {
        id: 'dining',
        name: 'Outdoor Dining',
        icon: '🍽️',
        status: 'Fair',
        badgeClass: 'status-fair',
        reason: 'Warm - look for shaded seating',
      };
    }
    if (tempC >= 19 && tempC <= 26 && windKmh < 14) {
      return {
        id: 'dining',
        name: 'Outdoor Dining',
        icon: '🍽️',
        status: 'Great',
        badgeClass: 'status-great',
        reason: 'Wonderful al fresco dining atmosphere',
      };
    }
    return {
      id: 'dining',
      name: 'Outdoor Dining',
      icon: '🍽️',
      status: 'Good',
      badgeClass: 'status-good',
      reason: 'Pleasant outdoor patio weather',
    };
  }
}
