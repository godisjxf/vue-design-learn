let activeEffect = null;
export let shouldTrack = true; //防止跟踪，阻断某些方法的时候，例如 array.push时阻断’length'收集依赖。
const effectStack = []; // 解决effect包含effect时，activeEffect正确指向的问题

const targetMap = new WeakMap();
export const ITERATE_KEY = Symbol("iterate");
export const TriggerType = { SET: "SET", ADD: "ADD", DELETE: "DELETE" };

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}

export function effect(fn, options = {}) {
  const effectFn = function () {
    cleanup(effectFn);
    shouldTrack = true;
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

export function pauseTracking() {
  shouldTrack = false;
}
export function enableTracking() {
  shouldTrack = true;
}

export function track(target, key) {
  if (!activeEffect || !shouldTrack) return;
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

export function trigger(target, key, type, value) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  const effectToRun = new Set(); // 防止无限执行
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectToRun.add(effectFn);
      } // 防止循环递归调用
    });
  if (type === TriggerType.ADD && Array.isArray(target)) {
    // 数组添加新元素 触发依赖
    const lengthEffects = depsMap.get("length");
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectToRun.add(effectFn);
        } // 防止循环递归调用
      });
  }
  if (Array.isArray(target) && key === "length") {
    //修改数组长度的时候，需要触发那些被删掉的依赖
    depsMap.forEach((effects, key) => {
      if (key >= value) {
        effects &&
          effects.forEach((effect) => {
            if (effect !== activeEffect) {
              effectToRun.add(effect);
            }
          });
      }
    });
  }
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
