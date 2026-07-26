import type { MutableClock } from "./MutableClock";

export class FakeClock implements MutableClock {
  private initialTime: Date;
  private currentTime: Date;

  constructor(initialTime: Date = new Date("2026-07-20T00:00:00.000Z")) {
    this.initialTime = new Date(initialTime.getTime());
    this.currentTime = new Date(initialTime.getTime());
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  advanceBy(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }

  set(date: Date): void {
    this.currentTime = new Date(date.getTime());
  }

  reset(): void {
    this.currentTime = new Date(this.initialTime.getTime());
  }
}
