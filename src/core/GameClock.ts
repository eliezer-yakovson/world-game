import { bus } from './EventBus';
import type { Weather } from './types';

/** 1 real second = 60 game seconds by default (1 minute per second). */
export class GameClock {
  day = 1;
  minutes = 8 * 60; // 08:00
  speed = 60;
  paused = false;
  weather: Weather = 'clear';
  private rainDays = new Set<number>();

  constructor() {
    this.rollWeatherForDay();
  }

  get hour(): number {
    return Math.floor(this.minutes / 60) % 24;
  }

  get minuteOfHour(): number {
    return Math.floor(this.minutes % 60);
  }

  get timeLabel(): string {
    return `${String(this.hour).padStart(2, '0')}:${String(this.minuteOfHour).padStart(2, '0')}`;
  }

  get dayLabel(): string {
    return `יום ${this.day}`;
  }

  get isNight(): boolean {
    return this.hour >= 20 || this.hour < 6;
  }

  get isSchoolTime(): boolean {
    return this.hour >= 8 && this.hour < 14;
  }

  get isRecess(): boolean {
    const m = this.minutes;
    return (m >= 10 * 60 && m < 10 * 60 + 20) || (m >= 12 * 60 && m < 12 * 60 + 30);
  }

  get isMealTime(): boolean {
    return this.hour === 13 || this.hour === 19;
  }

  get isBedtime(): boolean {
    return this.hour >= 21;
  }

  update(dt: number): void {
    if (this.paused) return;
    const prevHour = this.hour;
    this.minutes += (dt * this.speed) / 60;
    while (this.minutes >= 24 * 60) {
      this.minutes -= 24 * 60;
      this.day += 1;
      this.rollWeatherForDay();
      bus.emit('day-changed', { day: this.day });
    }
    if (this.hour !== prevHour) {
      bus.emit('hour-changed', { hour: this.hour, day: this.day });
    }
    bus.emit('clock-tick', {
      day: this.day,
      minutes: this.minutes,
      label: this.timeLabel,
      weather: this.weather,
    });
  }

  setSpeed(multiplier: number): void {
    this.speed = 60 * multiplier;
  }

  setTime(day: number, minutes: number): void {
    this.day = day;
    this.minutes = minutes;
    this.rollWeatherForDay();
    bus.emit('clock-tick', {
      day: this.day,
      minutes: this.minutes,
      label: this.timeLabel,
      weather: this.weather,
    });
  }

  private rollWeatherForDay(): void {
    if (this.rainDays.has(this.day)) {
      this.weather = 'rain';
    } else if (this.day % 4 === 0) {
      this.weather = 'rain';
      this.rainDays.add(this.day);
    } else if (this.day % 3 === 0) {
      this.weather = 'cloudy';
    } else {
      this.weather = 'clear';
    }
    bus.emit('weather-changed', { weather: this.weather, day: this.day });
  }
}
