/**
 * Disposable pattern for resource cleanup.
 */

export interface Disposable {
  dispose(): void;
}

/**
 * Groups multiple disposables for batch cleanup.
 */
export class DisposableGroup implements Disposable {
  private disposables: Disposable[] = [];

  add<T extends Disposable>(disposable: T): T {
    this.disposables.push(disposable);
    return disposable;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
