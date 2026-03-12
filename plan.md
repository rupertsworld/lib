# Daemon module

Extract the generic platform service management from stash's `service/controller.ts` into a standalone `@rupertsworld/daemon` package. The goal is a simple, reliable module for installing, uninstalling, and checking the status of a background daemon on macOS (launchd) and Linux (systemd). The original code is tightly scoped and has no stash-specific dependencies — we're reshaping the API from a factory-function-returning-an-object into a class so consumers configure the daemon identity once and call clean zero-arg methods.

## Daemon class

**Behavior / API**

Construct with the daemon's full identity:
- `name` — service identifier (e.g. `com.example.myapp`)
- `description` — human-readable description
- `command` — absolute path to the executable
- `args` — array of arguments
- `env` — optional `Record<string, string>` of environment variables

Instance methods:
- `install()` — writes the platform service file and registers it. Idempotent: if already installed, unloads/disables first, then re-registers.
- `uninstall()` — stops the service and removes the service file. Safe to call when not installed.
- `status()` — returns `{ installed: boolean, running: boolean }`.

Platforms: macOS (launchd plist in `~/Library/LaunchAgents`) and Linux (systemd user unit in `~/.config/systemd/user`). Unsupported platforms throw a clear error.

Env vars are only written into the plist/unit when provided by the caller. No automatic PATH injection.

**Decisions**

- Constructor also accepts optional `platform`, `homeDir`, and `exec` overrides for testing — same injection pattern as the original.
- The plist renderer and systemd unit renderer stay as private helpers, not part of the public API.
- No dependencies on other `@rupertsworld/*` packages. Pure Node stdlib.

**Tests**

Carry over and adapt the existing stash test scenarios:
- macOS install writes correct plist and calls `launchctl load`
- macOS reinstall unloads before reloading (idempotent)
- Linux install writes correct systemd unit and calls `systemctl enable`
- Linux reinstall disables before re-enabling (idempotent)
- Linux uninstall removes unit file and disables service
- macOS status reports installed+running for active service
- macOS status reports not-installed when no plist exists
- Unsupported platform throws
- Env vars appear in plist when provided, omitted when not

## Package structure

Follow the same layout as sibling packages (`emitter/`, `disposable/`, `dependencies/`): own `package.json`, `tsconfig.json`, `src/index.ts`. Package name `@rupertsworld/daemon`.

## README

Include a README with:
- What the module does (one-liner)
- Supported platforms
- Install instructions
- Usage example showing construction + install/status/uninstall
- API reference for the constructor options and each method

## Constraints

- macOS uses `launchctl load/unload` (not the newer `bootstrap/bootout`) for broader compatibility.
- All shell execution goes through the injectable `exec` function — never call `child_process` directly from the class methods.
- Unsupported platforms must fail with a clear error, never silently no-op.

## Out of scope

- Messaging / IPC to the daemon process (future work)
- Opening ports / sockets to the daemon (future work)
- Windows support
- The stash-specific `BackgroundDaemon` orchestration class — that stays in stash

## Docs to update

- `daemon/README.md` (new)
