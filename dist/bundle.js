'use strict';

let activeEffect = null;
const effectStack = []; // 解决effect包含effect时，activeEffect正确指向的问题

const targetMap = new WeakMap();
const ITERATE_KEY = Symbol("iterate");
const TriggerType = { SET: "SET", ADD: "ADD", DELETE: "DELETE" };

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}

function effect(fn, options = {}) {
  const effectFn = function () {
    cleanup(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    fn();
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  };
  effectFn.deps = [];
  effectFn.options = options;
  if (!options.lazy) {
    effectFn();
  }
  return effectFn;
}

function track(target, key) {
  if (!activeEffect) return;
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
  activeEffect.deps.push(deps); // 为了做cleanUp
}

function trigger(target, key, type) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  const effectToRun = new Set(); // 防止无限执行
  console.log(target, type, effects);
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectToRun.add(effectFn);
      } // 防止循环递归调用
    });
  if (type === TriggerType.ADD || type === TriggerType.DELETE) {
    const iterateEffects = depsMap.get(ITERATE_KEY); // 获取 forin 的依赖
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectToRun.add(effectFn);
        } // 防止循环递归调用
      });
  }
  effectToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn); // 计划调度
    } else {
      effectFn();
    }
  });
}

function reactive(value) {
  return new Proxy(value, {
    get: function (target, key, receiver) {
      track(target, key);
      return Reflect.get(target, key, receiver);
    },
    set: function (target, key, value, receiver) {
      const oldValue = target[key];
      const type = Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;
      const res = Reflect.set(target, key, value, receiver);
      if (oldValue !== value || oldValue === oldValue || value === value) {
        // 因为NAN!== NAN  所以做如下判断
        trigger(target, key, type);
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

const obj = {};
const proto = { bar: 1 };
const child = reactive(obj);
const parent = reactive(proto);
Object.setPrototypeOf(child, parent);
effect(() => {
  console.log(child.bar);
});
child.bar = 2;
