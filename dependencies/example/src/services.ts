import {
  createIdentifier,
  dependencies,
  injectable,
} from "@rupertsworld/dependencies";

export type AppConfig = {
  name: string;
};

export const AppConfig = createIdentifier<AppConfig>("AppConfig");

export class ClockService {
  now(): string {
    return new Date().toLocaleTimeString();
  }
}

export class GreeterService {
  readonly config = dependencies.resolve(AppConfig);
  readonly clock = dependencies.resolve(ClockService);

  message(): string {
    return `Hello ${this.config.name}! It is ${this.clock.now()}.`;
  }
}

@injectable(AppConfig, ClockService)
export class DecoratedGreeterService {
  constructor(
    readonly config: AppConfig,
    readonly clock: ClockService,
  ) {}

  message(): string {
    return `Hello ${this.config.name}, from @injectable(...). The time is ${this.clock.now()}.`;
  }
}
