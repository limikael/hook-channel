# hook-channel

A minimal, deterministic hook execution system for composing modular systems.

---

## Overview

`hook-channel` loads modules (typically from `node_modules`) and executes exported functions based on hook names.

It is designed to be:

* **Simple** – no boilerplate required in plugins
* **Deterministic** – ordered execution via priorities
* **Flexible** – works both at runtime (Node.js) and build-time (bundled for browsers)

---

## Core Concept

A *hook* is just a named function exported from a module:

```js
export function build(ev) {
  // do something
}
```

When a hook is dispatched:

```js
await channel.dispatch(new HookEvent("build", {...}));
```

All exported functions named `build` across all loaded modules are executed in order.

---

## Installation

```bash
npm install hook-channel
```

---

## Usage

### Load a channel

```js
import { loadHookChannel, HookEvent } from "hook-channel";

const channel = await loadHookChannel({
  keyword: "mysys-plugin",
  export: "mysys-build-events",
  cwd: "somedir"
});
```

This will:

1. Locate the nearest `package.json` (based on `cwd`)
2. Read its dependencies
3. Filter packages containing the keyword, e.g. `"mysys-plugin"`
4. Resolve the export `"./mysys-build-events"` using Node resolution
5. Import all matching modules

---

### Dispatch a hook (async)

```js
await channel.dispatch(new HookEvent("build", {
  /* data */
}));
```

---

### Dispatch a hook (sync)

```js
channel.dispatchSync(new HookEvent("build", {
  /* data */
}));
```

> ⚠️ All handlers must be synchronous. If a handler returns a Promise, an error should be thrown.

---

### Shorthand

```js
await channel.dispatch("build", {...});
```

---

## Plugin Authoring

A plugin is just a module exporting functions.

### Example

```js
export function build(ev) {
  console.log("running build step");
}
```

---

### Priority

Execution order is controlled via a `priority` property:

```js
build.priority = 15; // default is 10
```

Lower values run earlier.

---

### Stop propagation

A handler can stop further execution:

```js
export function build(ev) {
  if (something) {
    ev.stopPropagation();
  }
}
```

---

## HookEvent

```js
class HookEvent {
  constructor(name, data = {}) {
    this.name = name;
    this.data = data;
    this._stopped = false;
  }

  stopPropagation() {
    this._stopped = true;
  }
}
```

---

## Bundle Mode (Browser)

Instead of loading modules at runtime, you can bundle them.

### Create a channel in bundle mode

```js
const channel = await loadHookChannel({
  keyword: "peac-plugin",
  export: "peac-build-events",
  load: false
});
```

---

### Bundle

```js
await channel.bundle({
  target: "file.js"
});
```

This generates a standalone module containing all hooks.

---

### Use in browser

```js
import { dispatch, HookEvent } from "./file.js";

await dispatch(new HookEvent("build", {...}));
```

---

## Design Goals

* No registration API (zero boilerplate)
* Function name = hook name
* Deterministic execution order
* Works in both Node.js and browser environments
* Keeps plugin system **internal** and minimal

---

## Non-Goals

* Dependency injection framework
* Complex lifecycle management
* Runtime plugin installation in browsers

---

## Summary

`hook-channel` is a small primitive:

> Load modules → collect functions → dispatch by name

Everything else is built on top of that.

---

## License

MIT
