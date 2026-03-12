/**
 * Lazy singleton dependency container with stable proxies.
 */

type Constructor<T extends object> = new (...args: any[]) => T;

export type Identifier<T extends object> = symbol & {
  readonly __type__?: T;
};

export type DependencyKey<T extends object> =
  | Constructor<T>
  | Identifier<T>
  | string;

type AnyDependencyKey = DependencyKey<object>;
type Factory<T extends object> = () => T;

type Entry = {
  key: AnyDependencyKey;
  factory?: Factory<object>;
  instance?: object;
  proxy?: object;
  error?: unknown;
};

const injectableMetadata = new WeakMap<
  Constructor<object>,
  readonly AnyDependencyKey[]
>();

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof (value as PromiseLike<unknown>).then === "function"
  );
}

function keyName(key: AnyDependencyKey): string {
  if (typeof key === "string") {
    return key;
  }
  if (typeof key === "symbol") {
    return key.description ?? key.toString();
  }
  return key.name || "(anonymous class)";
}

function invalidFactoryError(): Error {
  return new Error(
    "register(Key, factory) requires a factory function. Wrap existing instances as () => instance.",
  );
}

function asyncFactoryError(): Error {
  return new Error(
    "register(Key, factory) does not accept async factories. Await setup before registering.",
  );
}

export function createIdentifier<T extends object>(name: string): Identifier<T> {
  return Symbol(name) as Identifier<T>;
}

export function injectable(...dependencies: AnyDependencyKey[]) {
  return <T extends Constructor<object>>(
    value: T,
    _context?: ClassDecoratorContext<T>,
  ): void => {
    injectableMetadata.set(value, dependencies);
  };
}

export class DependencyContainer {
  private readonly entries = new Map<AnyDependencyKey, Entry>();
  private readonly constructionStack: AnyDependencyKey[] = [];

  register<T extends object>(ctor: Constructor<T>): void;
  register<T extends object>(key: DependencyKey<T>, factory: Factory<T>): void;
  register<T extends object>(
    keyOrCtor: DependencyKey<T>,
    factory?: Factory<T>,
  ): void {
    if (factory === undefined) {
      if (typeof keyOrCtor !== "function") {
        throw invalidFactoryError();
      }

      this.validateClassRegistration(keyOrCtor);
      this.storeFactory(keyOrCtor, () => this.instantiateClass(keyOrCtor));
      return;
    }

    if (typeof factory !== "function") {
      throw invalidFactoryError();
    }

    if (factory.constructor.name === "AsyncFunction") {
      throw asyncFactoryError();
    }

    this.storeFactory(keyOrCtor, factory);
  }

  has<T extends object>(key: DependencyKey<T>): boolean {
    return this.entries.get(key)?.factory !== undefined;
  }

  resolve<T extends object>(ctor: Constructor<T>): T;
  resolve<T extends object>(identifier: Identifier<T>): T;
  resolve<T extends object>(key: string): T;
  resolve<T extends object>(key: DependencyKey<T>): T {
    return this.resolveAny(key) as T;
  }

  private storeFactory<T extends object>(
    key: DependencyKey<T>,
    factory: Factory<T>,
  ): void {
    const entry = this.getOrCreateEntry(key);
    entry.factory = factory as Factory<object>;
    entry.instance = undefined;
    entry.error = undefined;
  }

  private validateClassRegistration<T extends object>(
    ctor: Constructor<T>,
  ): void {
    const dependencies = injectableMetadata.get(ctor as Constructor<object>);
    if (dependencies) {
      if (ctor.length !== dependencies.length) {
        throw new Error(
          `${keyName(ctor)} cannot be registered with register(Class). @injectable(...) declared ${dependencies.length} dependencies but constructor arity is ${ctor.length}. Use register(Key, () => value) instead.`,
        );
      }
      return;
    }

    if (ctor.length !== 0) {
      throw new Error(
        `${keyName(ctor)} cannot be registered with register(Class). Undecorated classes must have zero required constructor parameters. Use register(Key, () => value) instead.`,
      );
    }
  }

  private instantiateClass<T extends object>(ctor: Constructor<T>): T {
    const dependencies = injectableMetadata.get(ctor as Constructor<object>);
    if (!dependencies) {
      return new ctor();
    }

    const resolved = dependencies.map((dependency) => this.resolveAny(dependency));
    return new ctor(...resolved);
  }

  private resolveAny(key: AnyDependencyKey): object {
    return this.getOrCreateEntry(key).proxy as object;
  }

  private getOrCreateEntry(key: AnyDependencyKey): Entry {
    let entry = this.entries.get(key);
    if (entry) {
      return entry;
    }

    entry = { key };
    entry.proxy = this.createProxy(entry);
    this.entries.set(key, entry);
    return entry;
  }

  private createProxy(entry: Entry): object {
    return new Proxy(
      {},
      {
        get: (_target, property) => {
          if (property === "then") {
            return undefined;
          }

          const instance = this.getInstance(entry);
          const value = Reflect.get(instance, property, instance);
          if (typeof value === "function") {
            return value.bind(instance);
          }
          return value;
        },
        set: (_target, property, value) => {
          const instance = this.getInstance(entry);
          return Reflect.set(instance, property, value, instance);
        },
        has: (_target, property) => {
          const instance = this.getInstance(entry);
          return property in instance;
        },
      },
    );
  }

  private getInstance(entry: Entry): object {
    if (entry.instance) {
      return entry.instance;
    }

    if (entry.error) {
      throw entry.error;
    }

    if (!entry.factory) {
      throw new Error(`${keyName(entry.key)} was resolved but never registered`);
    }

    const cycleIndex = this.constructionStack.indexOf(entry.key);
    if (cycleIndex !== -1) {
      const cycle = [...this.constructionStack.slice(cycleIndex), entry.key]
        .map((key) => keyName(key))
        .join(" -> ");
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    this.constructionStack.push(entry.key);

    try {
      const value = entry.factory();
      if (isThenable(value)) {
        throw new Error(
          `Factory for ${keyName(entry.key)} returned a Promise. Await setup before registering.`,
        );
      }
      if (typeof value !== "object" || value === null) {
        throw new Error(
          `Factory for ${keyName(entry.key)} returned a non-object value. Wrap primitives in an object.`,
        );
      }

      entry.instance = value;
      return value;
    } catch (error) {
      entry.error = error;
      throw error;
    } finally {
      this.constructionStack.pop();
    }
  }
}

export const dependencies = new DependencyContainer();
