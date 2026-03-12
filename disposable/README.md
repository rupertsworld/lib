# @rupertsworld/disposable

Disposable pattern for resource cleanup.

## Install

```bash
npm install @rupertsworld/disposable
```

## Usage

### `Disposable` interface

Any object with a `dispose()` method. Use it to represent a resource that needs cleanup — subscriptions, handles, connections.

```typescript
import type { Disposable } from "@rupertsworld/disposable";

function subscribe(callback: () => void): Disposable {
  window.addEventListener("resize", callback);
  return { dispose: () => window.removeEventListener("resize", callback) };
}

const sub = subscribe(() => console.log("resized"));
sub.dispose(); // cleans up the listener
```

### `DisposableGroup`

Groups multiple disposables for batch cleanup. Call `dispose()` once to clean up everything.

```typescript
import { DisposableGroup } from "@rupertsworld/disposable";

const group = new DisposableGroup();

group.add(subscribeToResize(() => { /* ... */ }));
group.add(subscribeToScroll(() => { /* ... */ }));
group.add(subscribeToKeyboard(() => { /* ... */ }));

// later: clean up all at once
group.dispose();
```

## API

### `Disposable`

```typescript
interface Disposable {
  dispose(): void;
}
```

### `DisposableGroup`

| Method              | Description                                      |
| ------------------- | ------------------------------------------------ |
| `add(disposable)`   | Add a disposable to the group. Returns it back.  |
| `dispose()`         | Dispose all members and clear the group.         |
