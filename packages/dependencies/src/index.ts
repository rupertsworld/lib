/**
 * Simple dependency container for singleton services.
 */

class DependencyContainer {
  private singletons = new Map<string, unknown>();

  register<T>(name: string, instance: T): void {
    this.singletons.set(name, instance);
  }

  resolve<T>(name: string): T {
    const instance = this.singletons.get(name);
    if (!instance) {
      throw new Error(`No singleton registered for: ${name}`);
    }
    return instance as T;
  }
}

export const dependencies = new DependencyContainer();
