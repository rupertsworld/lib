# @rupertsworld/emitter

Typed event emitter with disposable subscriptions.

## Install

```bash
npm install @rupertsworld/emitter
```

## Usage

Extend `Emitter` with an event map to get a fully typed emitter. Subscriptions return a `Disposable` — call `dispose()` to unsubscribe.

```typescript
import { Emitter } from "@rupertsworld/emitter";

type Events = {
  message: string;
  error: Error;
  close: undefined;
};

class Chat extends Emitter<Events> {
  send(text: string) {
    this.emit("message", text);
  }

  disconnect() {
    this.emit("close");
  }
}

const chat = new Chat();

const sub = chat.on("message", (text) => {
  console.log("received:", text);
});

chat.send("hello"); // logs "received: hello"
sub.dispose();      // unsubscribed
chat.send("world"); // nothing logged
```

### One-time listeners

```typescript
chat.once("close", () => {
  console.log("disconnected");
});
```

## API

### `Emitter<T>`

Base class. `T` is a `Record<string, any>` mapping event names to payload types. Use `undefined` for events with no payload.

| Method | Description |
| --- | --- |
| `on(type, handler)` | Subscribe to an event. Returns a `Disposable`. |
| `once(type, handler)` | Subscribe to an event once. Returns a `Disposable`. |
| `off(type, handler)` | Unsubscribe a handler. |
| `emit(type, payload)` | Emit an event (protected — only available in subclasses). |

Wildcard `'*'` can be used with `on` and `once` to listen to all events.
