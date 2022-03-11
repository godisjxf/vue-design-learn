import { effect, track, trigger } from "../reactivity.js";

function traverse(value, seen = new set()) {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  for (const k in value) {
    traverse(value[k], seen);
  }
  return value;
}
export function watch(source, cb, options = {}) {
  let getter;
  let oldValue, newValue;
  if (typeof source === "function") {
    getter = source;
  } else {
    source = () => {
      traverse(source);
    };
  }
  let cleanup;
  function onInvalidate(fn) {
    cleanup = fn;
  }
  const job = () => {
    newValue = effectFn();
    if (cleanup) cleanup();
    cb(newValue, oldValue, onInvalidate);
    oldValue = newValue;
  };
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      if (options.flush === "post") {
        Promise.resolve().then(job);
      } else {
        job();
      }
    },
  });
  if (options.immediate) {
    job();
  } else {
    oldValue = effectFn();
  }
}
