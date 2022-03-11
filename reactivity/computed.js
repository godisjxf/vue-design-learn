import { effect, trigger, track, TriggerType } from "./effect.js";

export function computed(fn) {
  let value;
  let dirty = true;
  const effectFn = effect(fn, {
    lazy: true,
    scheduler(fn) {
      dirty = true;
      trigger(obj, "value", TriggerType.SET);
    },
  });
  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, "value");
      return value;
    },
  };
  return obj;
}
