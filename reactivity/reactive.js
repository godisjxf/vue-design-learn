import { track, trigger, ITERATE_KEY, TriggerType } from "./effect.js";

export function reactive(value) {
  return new Proxy(value, {
    get: function (target, key, receiver) {
      if (key === "raw") {
        return target;
      }
      track(target, key);
      return Reflect.get(target, key, receiver);
    },
    set: function (target, key, value, receiver) {
      const oldValue = target[key];
      const type = Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;
      const res = Reflect.set(target, key, value, receiver);
      if (receiver.raw === target) {
        // 判断作用，防止继承的时候，多次trigger。
        if (oldValue !== value || oldValue === oldValue || value === value) {
          // 防止值未变化，过度更新
          // 因为NAN!== NAN  所以做如下判断
          trigger(target, key, type);
        }
      }
      return res;
    },
    ownKeys: function (target) {
      track(target, ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);
      if (hadKey & res) {
        trigger(target, key, TriggerType.DELETE);
      }
      return res;
    },
  });
}
