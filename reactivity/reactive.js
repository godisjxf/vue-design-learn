import { isShallow } from "@vue/reactivity";
import {
  track,
  trigger,
  ITERATE_KEY,
  TriggerType,
  pauseTracking,
  enableTracking,
} from "./effect.js";

export function reactive(value) {
  const existionProxy = reactiveMap.get(value);
  if (existionProxy) return existionProxy;
  const proxy = createReactive(value);
  reactiveMap.set(value, proxy);
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
const arrayInstrumentations = {};
["include", "indexOf", "lastIndexOf"].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    let res = originMethod.apply(this, args);
    if (res === false) {
      res = originMethod.apply(this.raw, args);
    }
    return res;
  };
});
["push", "pop", "shift", "unshift", "splice"].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    pauseTracking();
    let res = originMethod.apply(this, args);
    enableTracking();
    return res;
  };
});

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
        if (oldValue !== value && (oldValue === oldValue || value === value)) {
          // 防止值未变化，过度更新
          // 因为NAN!== NAN  所以做如下判断
          console.log(target.length, oldValue, key, value);
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

const mutableInstrumentation = {
  // Set Map 函数不是直接执行的。
  add: function (key) {
    const target = this.raw;
    const hadKey = target.has(key);
    if (!hadKey) {
      const res = target.add(key);
      trigger(target, key, TrackEvent.ADD);
    }
    return this;
  },
  delete: function (key) {
    const target = this.raw;
    const hadKey = target.has(key);
    const res = target.delete(key);
    if (!hadKey) {
      trigger(target, key, TrackEvent.DELETE);
    }
    return res;
  },
  get(key) {
    const target = this.raw;
    const had = target.has(key);
    track(target, key);
    if (had) {
      const res = target.get(key);
      return typeof res === "object" ? reactive(res) : res;
    }
  },
  set(key, value) {
    const target = this.raw;
    const had = target.has(key);
    const rawValue = value.raw || value; // 防止数据污染   很多添加操作的地方 都要做防数据污染的处理。
    target.set(key, rawValue);
    if (had) {
      const oldValue = target.get(key);
      if (oldValue !== value && (oldValue === oldValue || value === value)) {
        trigger(target, key, TriggerType.SET);
      }
    } else {
      trigger(target, key, TriggerType.ADD);
    }
    return this;
  },
  forEach(cb, thisArg) {
    const target = this.raw;
    track(target, ITERATE_KEY);
    target.forEach((k, v) => {
      cb.call(thisArg, wrap(k), wrap(v), this);
    });
  },
  [Symbol.iterator]: iterationMethod,
  entries: iterationMethod,
  values: valuesMethod,
  keys: keysMethod,
};
function iterationMethod() {
  const target = this.raw;
  const itr = target[Symbol.iterator]();
  track(target, ITERATE_KEY);
  return {
    next() {
      const res = itr.next();
      return {
        value: res.value ? [wrap(res.value[0]), wrap(res.value[1])] : res.value,
        done: res.done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}
function valuesMethod() {
  const target = this.raw;
  const itr = target.values();
  track(target, ITERATE_KEY);
  return {
    next() {
      const { value, done } = itr.next();
      return {
        value: value ? wrap(value) : value,
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}
function keysMethod() {
  const target = this.raw;
  const itr = target.keys();
  track(target, MAP_KEY_ITERATE_KEY);
  return {
    next() {
      const { value, done } = itr.next();
      return {
        value: value ? wrap(value) : value,
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}
const wrap = (val) =>
  typeof val === "object" && val !== null ? reactive(val) : val;
function creatCollectionHandler(isShallow = false, isReadOnly = false) {
  //Map Set
  return {
    get: function (target, key, receiver) {
      if (key === "raw") {
        return target;
      }
      if (key === "size") {
        track(target, ITERATE_KEY);
        return Reflect.get(target, key, target); // 获取size 的时候 会调用 [[SetData]],所以要调用原对象
      }
      return mutableInstrumentation[key];
    },
  };
}
