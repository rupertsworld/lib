# @rupertsworld/dependencies

Lazy singleton dependency container with stable proxies, typed identifiers, and optional class-based injection.

## Install

```bash
npm install @rupertsworld/dependencies
```

## Why

Use this when one part of your app is responsible for wiring services up at runtime, but other parts of the app need access to those services without importing back into the entry point.

A common case is:

- `index.ts` imports UI modules
- `index.ts` creates services later during startup
- the UI modules need those services
- the UI cannot import back from `index.ts` without creating a circular import

In that setup, both sides import the container instead. The bootstrap code registers services, and the rest of the app resolves them when needed.

It also helps with circular service wiring. `resolve(...)` returns a stable lazy proxy, so two services can hold references to each other without forcing immediate construction order. The real instance is only created on first real use.

For design rationale and architectural notes, see `docs/architecture.md`.

## Usage

### `register(Class)`

Use `register(Class)` when the container can fully construct the class itself.

```typescript
import { dependencies } from "@rupertsworld/dependencies";

class Database {
  read() {
    return "db";
  }
}

dependencies.register(Database);

const db = dependencies.resolve(Database);
db.read();
```

This also works for self-resolving classes:

```typescript
class Editor {
  db = dependencies.resolve(Database);

  render() {
    return this.db.read();
  }
}

dependencies.register(Editor);
```

### `register(Key, () => value)`

Use a factory when you need custom wiring, runtime args, or an existing instance.

```typescript
const db = await Database.connect(process.env.DATABASE_URL!);
dependencies.register(Database, () => db);
```

```typescript
dependencies.register("appDb", () => db);
```

Factories must be synchronous. If setup is async, await it before registering.

### `@injectable(...)`

Use `@injectable(...)` when you want constructor injection with `register(Class)`.

```typescript
import { dependencies, injectable } from "@rupertsworld/dependencies";

class Database {
  read() {
    return "db";
  }
}

class Logger {
  format(value: string) {
    return `log:${value}`;
  }
}

@injectable(Database, Logger)
class Editor {
  constructor(
    readonly db: Database,
    readonly logger: Logger,
  ) {}

  render() {
    return this.logger.format(this.db.read());
  }
}

dependencies.register(Database);
dependencies.register(Logger);
dependencies.register(Editor);

dependencies.resolve(Editor).render();
```

### `createIdentifier<T>(name)`

Use identifiers for interfaces or multiple instances of the same class.

```typescript
import {
  createIdentifier,
  dependencies,
} from "@rupertsworld/dependencies";

interface AuthService {
  check(): boolean;
}

const IAuth = createIdentifier<AuthService>("IAuth");

dependencies.register(IAuth, () => ({
  check: () => true,
}));

const auth = dependencies.resolve(IAuth);
auth.check();
```

String keys still work as a fallback:

```typescript
const db = dependencies.resolve<Database>("appDb");
```

## Circular construction

This is supported as long as constructors only store references and do not call back into each other during construction.

```typescript
dependencies.register(Database, () => new Database(dependencies.resolve(Logger)));
dependencies.register(Logger, () => new Logger(dependencies.resolve(Database)));
```

If you create a true behavioral cycle during construction, the container throws with the full path:

```text
Circular dependency detected: Database -> Logger -> Database
```

## Notes

- `resolve(key)` returns one stable proxy per key.
- Nothing is instantiated on `register(...)` or `resolve(...)`; instantiation happens on first real property access.
- If a key has not been registered yet, using its proxy throws until you register it.
- Re-registering a key keeps existing proxies stable and forwards them to the new instance on future access.
- Proxies are not promise-like and should not be relied on for full reflection parity such as `instanceof`.

## API

### `dependencies`

Exported singleton `DependencyContainer` instance.

### `DependencyContainer`

| Method | Description |
| --- | --- |
| `register(Class)` | Register a class for container-managed construction. |
| `register(key, () => value)` | Register a manual factory for a class key, identifier, or string key. |
| `resolve(key)` | Resolve a stable lazy proxy for the key. |
| `has(key)` | Return whether the key is currently registered. |

### `createIdentifier<T>(name)`

Create a typed identifier for interfaces or multiple instances of the same class.

### `@injectable(...dependencies)`

Declare constructor dependencies for classes that will be registered with `register(Class)`.
