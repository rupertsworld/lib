import mitt, { type Emitter as MittEmitter } from 'mitt';
import type { Disposable } from '@rupertsworld/disposable';

export type { Disposable } from '@rupertsworld/disposable';

/**
 * Base class that provides event emitting capabilities with disposable subscriptions.
 */
export class Emitter<T extends Record<string, any>> {
  private emitter: MittEmitter<T> = mitt<T>();

  /**
   * Subscribe to an event & return a disposable subscription.
   */
  readonly on = <K extends keyof T | '*'>(
    type: K,
    handler: (event: T[K]) => void
  ): Disposable => {
    this.emitter.on(type, handler);
    return { dispose: () => this.emitter.off(type, handler) };
  };

  /**
   * Subscribe to an event once and return a disposable subscription.
   */
  readonly once = <K extends keyof T | '*'>(
    type: K,
    handler: (event: T[K]) => void
  ): Disposable => {
    const wrappedHandler = (event: T[K]) => {
      handler(event);
      this.emitter.off(type, wrappedHandler);
    };

    this.emitter.on(type, wrappedHandler);
    return { dispose: () => this.emitter.off(type, wrappedHandler) };
  };

  /**
   * Unsubscribe from an event
   */
  readonly off = this.emitter.off;

  /**
   * Emit an event
   */
  protected emit<K extends keyof T>(
    type: K,
    ...[event]: T[K] extends undefined ? [] : [T[K]]
  ): void {
    this.emitter.emit(type, event as T[K]);
  }
}
