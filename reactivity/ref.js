import { reactive } from "./reactive.js";

function ref(val) {
  const warp = {
    value: val,
  };
  Object.defineProperty(warp, "_v_isRef", { value: true });
  return reactive(warp);
}

function toRef(obj, key) {
  const warp = {
    get value() {
      return obj[key];
    },
    set value(val) {
      return (obj[key] = val);
    },
  };
  Object.defineProperty(obj, "_v_isRef", {
    value: true,
  });
  return warp;
}
function toRefs(obj) {
  const res = {};
  Object.keys(obj).forEach((key) => {
    res[key] = toRef(obj, key);
  });
  return res;
}

function proxyRefs(target) {
  //脱去ref ,方便在template中 使用ref,不用加.value
  // reactive 也有脱ref的能力，本段代码 尚未实现。
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect(target, key, receiver);
      return value._v_isRef ? value.value : value;
    },
    set(target, key, val, receiver) {
      const value = target[key];
      if (value._v_isRef) {
        value.value = key;
        return true;
      }
      return Reflect.set(target, key, val, receiver);
    },
  });
}
