import assert from "node:assert/strict";
import test from "node:test";
import {
  DependencyContainer,
  createIdentifier,
  injectable,
} from "../src/index.ts";

test("register(Class): empty class is lazily instantiated on first property access", () => {
  const dependencies = new DependencyContainer();
  let constructions = 0;

  class EmptyService {
    readonly id = ++constructions;

    ping(): number {
      return this.id;
    }
  }

  dependencies.register(EmptyService);
  assert.equal(constructions, 0);

  const service = dependencies.resolve(EmptyService);
  assert.equal(constructions, 0);

  assert.equal(service.ping(), 1);
  assert.equal(service.ping(), 1);
  assert.equal(constructions, 1);
});

test("register(Class): self-resolving field dependencies work with zero-arg classes", () => {
  const dependencies = new DependencyContainer();

  class Database {
    read(): string {
      return "db";
    }
  }

  class Editor {
    readonly db = dependencies.resolve(Database);

    render(): string {
      return this.db.read();
    }
  }

  dependencies.register(Database);
  dependencies.register(Editor);

  const editor = dependencies.resolve(Editor);
  assert.equal(editor.render(), "db");
});

test("register(Class): undecorated classes with required constructor args fail fast", () => {
  const dependencies = new DependencyContainer();

  class NeedsArg {
    constructor(_name: string) {}
  }

  assert.throws(
    () => dependencies.register(NeedsArg),
    /zero required constructor parameters|fully own construction/i,
  );
});

test("register(Class): decorated classes whose constructor arity mismatches declared deps fail fast", () => {
  const dependencies = new DependencyContainer();

  class Database {}

  @injectable(Database)
  class BrokenService {
    constructor(_db: Database, _mode: string) {}
  }

  assert.throws(
    () => dependencies.register(BrokenService),
    /constructor arity|declared dependency/i,
  );
});

test("register(Key, () => value): existing instances and custom setup are supported", () => {
  const dependencies = new DependencyContainer();

  class Database {
    constructor(readonly value: string) {}

    read(): string {
      return this.value;
    }
  }

  const db = new Database("existing");
  dependencies.register(Database, () => db);

  const resolved = dependencies.resolve(Database);
  assert.equal(resolved.read(), "existing");
});

test("resolve(key): returns one stable proxy per key before and after registration", () => {
  const dependencies = new DependencyContainer();

  class Database {
    ping(): string {
      return "pong";
    }
  }

  const beforeRegister = dependencies.resolve(Database);
  const beforeRegisterAgain = dependencies.resolve(Database);

  assert.equal(beforeRegister, beforeRegisterAgain);
  assert.equal(dependencies.has(Database), false);
  assert.throws(() => beforeRegister.ping(), /Database was resolved but never registered/);

  dependencies.register(Database);

  const afterRegister = dependencies.resolve(Database);
  assert.equal(afterRegister, beforeRegister);
  assert.equal(dependencies.has(Database), true);
  assert.equal(beforeRegister.ping(), "pong");
});

test("resolve(key): no construction happens during register or resolve, only on first property access", () => {
  const dependencies = new DependencyContainer();
  let constructions = 0;

  class Database {
    readonly id = ++constructions;

    ping(): number {
      return this.id;
    }
  }

  dependencies.register(Database);
  assert.equal(constructions, 0);

  const db = dependencies.resolve(Database);
  assert.equal(constructions, 0);

  void db.ping;
  assert.equal(constructions, 1);
});

test("resolve(key): first property access constructs exactly once per registration", () => {
  const dependencies = new DependencyContainer();
  let constructions = 0;

  class Database {
    readonly id = ++constructions;

    ping(): number {
      return this.id;
    }
  }

  dependencies.register(Database);

  const db = dependencies.resolve(Database);
  void db.ping;
  void db.ping;
  void db.ping;

  assert.equal(constructions, 1);
});

test("createIdentifier(): supports multiple instances of the same class without collisions", () => {
  const dependencies = new DependencyContainer();

  class Database {
    constructor(readonly name: string) {}

    read(): string {
      return this.name;
    }
  }

  const appDb = createIdentifier<Database>("AppDb");
  const analyticsDb = createIdentifier<Database>("AnalyticsDb");

  dependencies.register(appDb, () => new Database("app"));
  dependencies.register(analyticsDb, () => new Database("analytics"));

  assert.equal(dependencies.resolve(appDb).read(), "app");
  assert.equal(dependencies.resolve(analyticsDb).read(), "analytics");
});

test("string keys: remain supported as a fallback", () => {
  const dependencies = new DependencyContainer();

  class Database {
    read(): string {
      return "db";
    }
  }

  dependencies.register("db", () => new Database());

  assert.equal(dependencies.resolve<Database>("db").read(), "db");
});

test("@injectable(...): register(Class) resolves constructor dependencies in order", () => {
  const dependencies = new DependencyContainer();

  class Database {
    read(): string {
      return "db";
    }
  }

  class Logger {
    format(value: string): string {
      return `log:${value}`;
    }
  }

  @injectable(Database, Logger)
  class Editor {
    constructor(
      readonly db: Database,
      readonly logger: Logger,
    ) {}

    render(): string {
      return this.logger.format(this.db.read());
    }
  }

  dependencies.register(Database);
  dependencies.register(Logger);
  dependencies.register(Editor);

  const editor = dependencies.resolve(Editor);
  assert.equal(editor.render(), "log:db");
});

test("@injectable(...): circular constructor wiring that only stores proxies works", () => {
  const dependencies = new DependencyContainer();

  @injectable()
  class Database {
    logger = dependencies.resolve(Logger);

    read(): string {
      return "db";
    }
  }

  @injectable(Database)
  class Logger {
    constructor(readonly db: Database) {}

    render(): string {
      return this.db.read();
    }
  }

  dependencies.register(Database);
  dependencies.register(Logger);

  assert.equal(dependencies.resolve(Logger).render(), "db");
});

test("runtime guarantees: obvious async factories are rejected at registration time", () => {
  const dependencies = new DependencyContainer();

  assert.throws(
    () => dependencies.register("db", async () => ({ read: () => "db" })),
    /async/i,
  );
});

test("runtime guarantees: promise-returning factories are rejected at first construction time", () => {
  const dependencies = new DependencyContainer();

  dependencies.register("db", () => Promise.resolve({ read: () => "db" }) as never);

  const db = dependencies.resolve<{ read(): string }>("db");

  assert.throws(
    () => void db.read,
    /returned a Promise|Await setup before registering/i,
  );
});

test("runtime guarantees: methods are bound to instances that rely on #private fields", () => {
  const dependencies = new DependencyContainer();

  class Counter {
    #count = 0;

    inc(): number {
      this.#count += 1;
      return this.#count;
    }
  }

  dependencies.register(Counter);

  const counter = dependencies.resolve(Counter);
  const inc = counter.inc;

  assert.equal(inc(), 1);
  assert.equal(inc(), 2);
});

test("runtime guarantees: property reads, writes, getters, and setters are forwarded", () => {
  const dependencies = new DependencyContainer();

  class Box {
    value = 1;

    get doubled(): number {
      return this.value * 2;
    }

    set doubled(next: number) {
      this.value = next / 2;
    }
  }

  dependencies.register(Box);

  const box = dependencies.resolve(Box);
  assert.equal(box.value, 1);
  assert.equal(box.doubled, 2);

  box.value = 3;
  assert.equal(box.value, 3);
  assert.equal(box.doubled, 6);

  box.doubled = 10;
  assert.equal(box.value, 5);
  assert.equal(box.doubled, 10);
});

test("runtime guarantees: proxies are not promise-like", () => {
  const dependencies = new DependencyContainer();

  class Box {
    value = 1;
  }

  dependencies.register(Box);

  const box = dependencies.resolve(Box) as Box & { then?: unknown };
  assert.equal(box.then, undefined);
});

test("runtime guarantees: construction errors are cached and rethrown until re-registration", () => {
  const dependencies = new DependencyContainer();
  let attempts = 0;

  class Database {
    read(): string {
      return "ok";
    }
  }

  dependencies.register(Database, () => {
    attempts += 1;
    throw new Error("boom");
  });

  const db = dependencies.resolve(Database);

  assert.throws(() => db.read(), /boom/);
  assert.throws(() => db.read(), /boom/);
  assert.equal(attempts, 1);

  dependencies.register(Database, () => new Database());

  assert.equal(db.read(), "ok");
  assert.equal(attempts, 1);
});

test("runtime guarantees: existing proxies keep working after re-registration", () => {
  const dependencies = new DependencyContainer();

  class VersionedService {
    constructor(readonly version: string) {}

    read(): string {
      return this.version;
    }
  }

  dependencies.register(VersionedService, () => new VersionedService("v1"));

  const service = dependencies.resolve(VersionedService);
  assert.equal(service.read(), "v1");

  dependencies.register(VersionedService, () => new VersionedService("v2"));

  assert.equal(service.read(), "v2");
  assert.equal(service, dependencies.resolve(VersionedService));
});

test("cycle detection: behavioral two-node cycles throw with the full path", () => {
  const dependencies = new DependencyContainer();

  class Database {
    constructor(readonly logger: Logger) {
      this.logger.touch();
    }

    touch(): string {
      return "db";
    }
  }

  class Logger {
    constructor(readonly db: Database) {
      this.db.touch();
    }

    touch(): string {
      return "logger";
    }
  }

  dependencies.register(Database, () => new Database(dependencies.resolve(Logger)));
  dependencies.register(Logger, () => new Logger(dependencies.resolve(Database)));

  const db = dependencies.resolve(Database);
  assert.throws(() => db.touch(), /Database -> Logger -> Database/);
});

test("cycle detection: behavioral three-node cycles report the full path in order", () => {
  const dependencies = new DependencyContainer();

  class A {
    constructor(readonly b: B) {
      this.b.touch();
    }

    touch(): string {
      return "A";
    }
  }

  class B {
    constructor(readonly c: C) {
      this.c.touch();
    }

    touch(): string {
      return "B";
    }
  }

  class C {
    constructor(readonly a: A) {
      this.a.touch();
    }

    touch(): string {
      return "C";
    }
  }

  dependencies.register(A, () => new A(dependencies.resolve(B)));
  dependencies.register(B, () => new B(dependencies.resolve(C)));
  dependencies.register(C, () => new C(dependencies.resolve(A)));

  const a = dependencies.resolve(A);
  assert.throws(() => a.touch(), /A -> B -> C -> A/);
});
