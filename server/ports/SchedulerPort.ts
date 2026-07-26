export interface SchedulerPort {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

