import { track, trigger, ITERATE_KEY, TriggerType } from "./effect.js";

export function reactive(value) {
  const existionProxy = reactiveMap.get(value);
  if (existionProxy) return existionProxy;
  const proxy = createReactive(value);
  reactiveMap.set(obj, proxy);
  return proxy;
}
export function shallowReactive(value) {
  return createReactive(value, true);
}
export function readOnlyReactive(value) {
  return createReactive(value, false, true);
}
export function shallowReadOnlyReactive(value) {
  return createReactive(value, true, true);
}

const reactiveMap = new Map(); // 储存代理对象，免得重复创建和 代理相等 避免[a].include(a)===false
const originMethod = Array.prototype.includes;
const arrayInstrumentations = {
  includes: function (...args) {
    let res = originMethod.apply(this, args);
    if (res === false) {
      res = originMethod.apply(this.raw, args);
    }
    return res;
  },
};

function createReactive(value, isShallow, isReadOnly) {
  return new Proxy(value, {
    get: function (target, key, receiver) {
      if (key === "raw") {
        return target;
      }
      const res = Reflect.get(target, key, receiver);
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      if (!isReadOnly && typeof key !== "symbol") {
        track(target, key);
      }
      if (isShallow) {
        return res;
      }
      if (typeof res === "object" && res !== null) {
        return isReadOnly ? readOnlyReactive(res) : reactive(res);
      }
      return res;
    },
    set: function (target, key, value, receiver) {
      if (isReadOnly) {
        console.error(`属性${key}是只读的`);
        return true;
      }
      const oldValue = target[key];
      const type = Array.isArray(target)
        ? Number(key) < target.length
          ? TriggerType.SET
          : TriggerType.ADD
        : Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;
      const res = Reflect.set(target, key, value, receiver);
      if (receiver.raw === target) {
        // 判断作用，防止继承的时候，多次trigger。
        if (oldValue !== value || oldValue === oldValue || value === value) {
          // 防止值未变化，过度更新
          // 因为NAN!== NAN  所以做如下判断
          trigger(target, key, type, value);
        }
      }
      return res;
    },
    ownKeys: function (target) {
      // 拦截for in
      track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    deleteProperty(target, key) {
      if (isReadOnly) {
        console.error(`属性${key}是只读的`);
        return true;
      }
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);
      if (hadKey & res) {
        trigger(target, key, TriggerType.DELETE);
      }
      return res;
    },
  });
}
