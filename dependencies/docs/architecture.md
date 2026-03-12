# Dependencies Architecture

This package is intentionally small. It is not trying to be a full dependency injection framework like VSCode's instantiation service. The goal is a lightweight singleton container that solves two practical problems well:

1. Breaking import cycles between an app entry point and the modules that need services created there.
2. Breaking circular construction between services that only need to hold references to each other.

## Core shape

There are two registration modes:

- `register(Class)`
- `register(Key, () => value)`

`register(Class)` is the convenience path when the container can fully own construction. That means one of:

- the class has no required constructor args
- the class self-resolves dependencies through `dependencies.resolve(...)`
- the class is decorated with `@injectable(...)` and all constructor args come from the container

`register(Key, () => value)` is the escape hatch for everything else:

- existing instances
- runtime/manual constructor args
- custom setup
- string keys or typed identifiers

This split keeps the common case terse without turning the package into a large descriptor-based framework.

## Why proxies

`resolve(key)` always returns one stable proxy per key.

That proxy exists for two reasons:

1. It keeps resolution lazy. Nothing is instantiated on `register(...)` or `resolve(...)`; construction happens on first real property access.
2. It allows circular construction to work when services only store references to each other.

Example:

```typescript
dependencies.register(Database, () => new Database(dependencies.resolve(Logger)));
dependencies.register(Logger, () => new Logger(dependencies.resolve(Database)));
```

Both constructors receive proxies. Neither constructor needs the other service to be fully instantiated yet. The real object is only created when one of those proxies is actually used.

The proxy is stable by design:

```typescript
dependencies.resolve(Database) === dependencies.resolve(Database);
```

That matters for consistency, for re-registration, and for modules that resolve early and hold onto the returned reference.

## Why re-registration keeps proxy identity

Re-registering a key replaces the factory/instance behind that key, but not the proxy object that callers already hold.

This avoids a subtle footgun:

- module A resolves a dependency early and stores it
- later, the key is re-registered
- module A should keep working without having to resolve again

So the proxy is the stable public identity, and the concrete instance behind it can change.

## Why async factories are not supported

The container only accepts synchronous factories.

If setup is async, the caller should do the async work first and then register the finished instance:

```typescript
const db = await Database.connect(url);
dependencies.register(Database, () => db);
```

This keeps the mental model simple:

- `resolve(...)` returns a proxy
- first property access constructs synchronously
- methods do not secretly become async on first use

Allowing async factories would blur that line and make the first call on a dependency behave differently from later calls.

The package still defends against mistakes in two places:

- obvious async functions are rejected at registration time
- Promise-returning factories are rejected when first executed

## Why `@injectable(...)` is a class decorator

The package uses `@injectable(...)` as a class decorator instead of parameter decorators.

Reasons:

- modern decorator design fits class decorators much better
- parameter decorators are not the direction this package is built around
- constructor injection stays explicit without requiring a separate public `createInstance(...)` API

`@injectable(...)` only declares constructor dependencies. `register(Class)` is still the public construction path.

This package also allows classes to self-resolve through fields or methods:

```typescript
class Editor {
  db = dependencies.resolve(Database);
}
```

That is intentionally supported because it is often the lowest-friction way to break circular imports in UI or app code.

## Why there is no public `createInstance(...)`

Early on, the design considered a public helper like `createInstance(Editor)`.

That was dropped because it would introduce a third public construction mode:

- `register(Class)`
- `register(Key, () => value)`
- `createInstance(Class)`

For this package, `register(Class)` already covers the container-managed use case. Exposing `createInstance(...)` would add surface area without solving a concrete problem the package needs to solve today.

## Why keys work the way they do

There are three key types:

- class constructor
- `createIdentifier<T>(name)`
- string

Class constructors are the primary path because they give the best developer experience:

```typescript
dependencies.register(Database);
const db = dependencies.resolve(Database);
```

`createIdentifier<T>(name)` exists for the edge cases:

- interfaces, which do not exist at runtime
- multiple instances of the same class

String keys remain supported because they are convenient and sometimes avoid extra imports. They are the lowest-friction fallback, but they need explicit typing on `resolve<T>()`.

## Cycle detection scope

The package detects behavioral cycles at runtime and throws with the full path:

```text
Circular dependency detected: Database -> Logger -> Database
```

What it does **not** do:

- build a full dependency graph up front
- plan construction order
- try to act like a full DI framework

This is intentional. The package is designed to handle the common wiring cycles cheaply, then fail fast if a constructor actually causes recursive construction.

## Gotchas

### Constructors should store references, not call through them

This works:

```typescript
class Database {
  constructor(readonly logger: Logger) {}
}
```

This can be fine:

```typescript
class Database {
  constructor(readonly logger: Logger) {
    logger.log("starting");
  }
}
```

Calling dependencies in constructors is allowed, but only when you are confident the call path cannot recurse back into services that are still being constructed. If that call triggers the other side of a cycle, construction becomes behavioral recursion and the container will throw.

### Proxies are normal enough, not perfect mirrors

The package guarantees normal property access, assignment, getters/setters, and method calls. It does **not** promise perfect reflection parity for things like:

- `instanceof`
- `Object.keys(...)`
- property descriptors
- prototype-sensitive metaprogramming

If a consumer needs the literal concrete instance identity for that sort of reflection, this container is the wrong abstraction.

### `has(key)` means "registered", not "already constructed"

This is easy to misunderstand.

`has(key)` tells you whether the container knows how to build the value. It does not tell you whether the value has already been instantiated.

## Non-goals

These are deliberately out of scope for now:

- child/scoped containers
- disposal/lifecycle management
- async factories
- full graph planning

If the package ever grows toward a larger DI system, those are the likely next areas to revisit.
