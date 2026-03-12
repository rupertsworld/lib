import assert from "node:assert/strict";
import test from "node:test";
import { DependencyContainer, injectable } from "../src/index.ts";

test("integration: entry-point registration can satisfy UI modules created before service wiring", () => {
  const dependencies = new DependencyContainer();

  class ApiClient {
    currentUser(): string {
      return "rupert";
    }
  }

  class AuthService {
    constructor(readonly api: ApiClient) {}

    currentUser(): string {
      return this.api.currentUser();
    }
  }

  class AppRoot {
    readonly auth = dependencies.resolve<AuthService>("auth");

    connectedCallback(): string {
      return this.auth.currentUser();
    }
  }

  const root = new AppRoot();

  dependencies.register("api", () => new ApiClient());
  dependencies.register("auth", () => new AuthService(dependencies.resolve<ApiClient>("api")));

  assert.equal(root.connectedCallback(), "rupert");
});

test("integration: self-resolving classes can coordinate multiple singleton dependencies across methods", () => {
  const dependencies = new DependencyContainer();

  class Database {
    private readonly reads: string[] = [];

    read(id: string): string {
      this.reads.push(id);
      return `user:${id}`;
    }

    snapshot(): string[] {
      return [...this.reads];
    }
  }

  class Logger {
    private readonly messages: string[] = [];

    log(message: string): void {
      this.messages.push(message);
    }

    snapshot(): string[] {
      return [...this.messages];
    }
  }

  class UserPanel {
    readonly db = dependencies.resolve(Database);
    readonly logger = dependencies.resolve(Logger);

    load(id: string): string {
      const user = this.db.read(id);
      this.logger.log(`loaded:${id}`);
      return user;
    }

    refresh(id: string): string {
      this.logger.log(`refresh:${id}`);
      return this.db.read(id);
    }
  }

  dependencies.register(Database);
  dependencies.register(Logger);
  dependencies.register(UserPanel);

  const panel = dependencies.resolve(UserPanel);
  assert.equal(panel.load("42"), "user:42");
  assert.equal(panel.refresh("42"), "user:42");

  assert.deepEqual(dependencies.resolve(Database).snapshot(), ["42", "42"]);
  assert.deepEqual(dependencies.resolve(Logger).snapshot(), ["loaded:42", "refresh:42"]);
});

test("integration: injectable classes resolve through a deeper transitive graph", () => {
  const dependencies = new DependencyContainer();

  class ConfigService {
    prefix(): string {
      return "cfg";
    }
  }

  @injectable(ConfigService)
  class Database {
    constructor(readonly config: ConfigService) {}

    query(id: string): string {
      return `${this.config.prefix()}:${id}`;
    }
  }

  @injectable(Database)
  class UserRepository {
    constructor(readonly db: Database) {}

    find(id: string): string {
      return this.db.query(id);
    }
  }

  class Logger {
    private readonly messages: string[] = [];

    log(message: string): void {
      this.messages.push(message);
    }

    snapshot(): string[] {
      return [...this.messages];
    }
  }

  @injectable(UserRepository, Logger)
  class UserController {
    constructor(
      readonly users: UserRepository,
      readonly logger: Logger,
    ) {}

    show(id: string): string {
      const value = this.users.find(id);
      this.logger.log(value);
      return value;
    }
  }

  dependencies.register(ConfigService);
  dependencies.register(Database);
  dependencies.register(UserRepository);
  dependencies.register(Logger);
  dependencies.register(UserController);

  const controller = dependencies.resolve(UserController);
  assert.equal(controller.show("42"), "cfg:42");
  assert.deepEqual(dependencies.resolve(Logger).snapshot(), ["cfg:42"]);
});
