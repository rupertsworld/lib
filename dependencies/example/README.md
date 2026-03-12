# dependencies example

Tiny Vite app showing the real entry-point pattern this package is meant for:

- the view is imported first
- services are registered later in `src/main.ts`
- the view resolves them through the container
- the page shows both:
  - a self-resolving service
  - a decorator-based `@injectable(...)` service

## Run

```bash
cd dependencies/example
npm install
npm run dev
```

Open the local Vite URL and click **Refresh greeting**.

## Notes

- The example aliases `@rupertsworld/dependencies` to `../src/index.ts`, so it runs against the local source in this repo.
- It demonstrates both:
  - `register(Class)` for container-managed classes
  - `register(Key, () => value)` for manual registration via `createIdentifier(...)`
  - `@injectable(...)` for constructor injection
