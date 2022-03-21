import { shallowReadonly } from "@vue/reactivity";
import { reactive, effect, shallowReactive } from "@vue/reactivity";
import { queueJob } from "./scheduler";
const Text = new Symbol("text");
const Fragment = new Symbol("fragment");
let currentInstance = null;
function setCurrentInstance(instance) {
  currentInstance = instance;
}
function createRenderer(options = {}) {
  const {
    createElement,
    setElementText,
    insert,
    patchProps,
    creatText,
    setText,
  } = options;
  function render(vNode, container) {
    if (vNode) {
      patch(container._vNode, vNode, container);
    } else {
      if (container._vNode) {
        unmount(container._vNode);
      }
    }
    container._vNode = vNode;
  }
  function patch(n1, n2, container) {
    if (n1 && n1.tag !== n2.tag) {
      unmount(n1);
      n1 = null;
    }
    const { type } = n2;
    if (typeof type === "string") {
      if (!n1) {
        mountElement(n2, container);
      } else {
        patchElement(n1, n2);
      }
    } else if (typeof type === Text) {
      if (!n1) {
        const el = (n2.el = creatText(n2.children));
        insert(el, container);
      } else {
        const el = (n2.el = n1.el);
        if (n2.children !== n1.children) {
          setText(el, n2.children);
        }
      }
    } else if (type === Fragment) {
      if (!n1) {
        n2.children.forEach((c) => {
          patch(null, c, container);
        });
      } else {
        patchChildren(n1, n2, container);
      }
    } else if (typeof type === "object") {
      if (!n1) {
        mountComponent(n2, container, anchor);
      } else {
        patchComponent(n1, n2, anchor);
      }
    }
  }
  function mountElement(vNode, container, anchor) {
    const el = (vNode.el = createElement(vNode.tag));
    if (typeof vNode.children === "string") {
      setElementText(el, vNode.children);
    } else if (Array.isArray(vNode.children)) {
      vNode.children.forEach((child) => {
        patch(null, child, el);
      });
    }
    if (vNode.props) {
      for (const key in vNode.props) {
        patchProps(el, key, null, vNode.props[key]);
      }
    }
    insert(el, container, anchor);
  }
  return {
    render,
  };
  function unmount(vNode) {
    if (vNode.type === Fragment) {
      vNode.children.forEach(() => {
        unmount(c);
      });
      return;
    }
    // 卸载封装成函数好处1、有机会调用绑定在DOM上的钩子函数 2、如果发现是组件，还可以调用生命周期函数
    const parent = vNode.el.parent;
    if (parent) {
      parent.remove(vNode.el);
    }
  }
  function patchElement(n1, n2) {
    const el = (n2.el = n1.el);
    //对比节点，对比props
    const oldProps = n1.props;
    const newProps = n2.props;
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[k], newProps[key]);
      }
    }
    for (const key in oldProps) {
      if (!key in newProps) {
        patchProps(el, key, oldProps[key], null);
      }
    }
    patchChildren(n1, n2, el);
  }
  function patchChildren(n1, n2, container) {
    if (typeof n2.children === "string") {
      if (Array.isArray(n1.children)) {
        n1.child.forEach((c) => {
          unmount(c);
        });
      } else {
        setElementText(container, n2.children);
      }
    } else if (Array.isArray(n2.children)) {
      if (Array.isArray(n1.children)) {
        diff(n1, n2, container);
      } else {
        setElementText(container, "");
        n2.children.forEach((c) => {
          patch(null, c, container);
        });
      }
    } else {
      if (Array.isArray(n1.children)) {
        n1.child.forEach((c) => {
          unmount(c);
        });
      } else if (typeof n1.children === "string") {
        setElementText(container, "");
      }
    }
  }
  function diff(n1, n2, container) {
    //快速diff 算法。
    const newChildren = n2.children;
    const oldChildren = n1.children;
    let j = 0;
    let oldEnd = n1.children.length - 1;
    let newEnd = n2.children.length - 1;
    while (newChildren[j].key === oldChildren[j].key) {
      patch(oldChildren[j], newChildren[j], container);
      j++;
    }
    while (newChildren[newEnd].key === oldChildren[oldEnd].key) {
      patch(oldChildren[oldEnd], newChildren[newEnd], container);
      oldEnd--;
      newEnd--;
    }
    if (j <= oldEnd && j > newEnd) {
      // for (let index = j; index <= oldEnd; index++) {
      //   unmount(oldEnd[index]);
      // }
      while (j <= oldEnd) {
        unmount(oldEnd[j++]);
      }
    } else if (j > oldEnd && j <= newEnd) {
      /*  for (let index = j; index <= newEnd; index++) {
        patch(null, newChildren[j], oldChildren[j].el);
      } */
      const anchorIndex = j + 1;
      const anchor =
        anchorIndex < length ? newChildren[anchorIndex].el.nextSibling : null;
      while (j <= newEnd) {
        patch(null, newChildren[j++], container, anchor);
      }
    } else {
      const source = new Array(newChildren - j + 1);
      source.fill(-1);
      const keyIndex = {};
      const oldStart = j;
      const newStart = j;
      let pos = 0;
      let moving = false;
      let count = newEnd - newStart + 1;
      let patched = 0;
      for (let index = j; index <= newEnd; index++) {
        keyIndex[newChildren[index].key] = index;
      }
      for (let index = j; index <= oldEnd; index++) {
        const node = oldChildren[index];
        const k = keyIndex[node.key];
        if (patch <= count) {
          if (typeof k !== undefined) {
            patch(oldChildren[index], newChildren[k], container);
            source[k - newStart] = index;
            if (k > pos) {
              pos = k;
            } else {
              moving = true;
            }
          } else {
            unmount(node);
          }
        } else {
          unmount(node);
        }
      }
      if (moving) {
        const seq = getSequence(source);
        let s = seq.length - 1;
        let i = count - 1;
        while (i >= 0) {
          const pos = i + newStart;
          const newVNode = newChildren[pos];
          const nextPos = pos + 1;
          const anchor = nextPos < length ? newChildren[nextPos].el : null;
          if (source[i] === -1) {
            patch(null, newVNode, container, anchor);
            i--;
          } else if (seq[s] === i) {
            s--;
            i--;
          } else {
            insert(newVNode.el, container, anchor);
            i--;
          }
        }
      }
    }
  }

  function mountComponent(vnode, container, anchor) {
    const componentOptions = vnode.type;
    const {
      render,
      data,
      props: propsOption,
      setup,
      beforeCreate,
      created,
      beforeMount,
      mounted,
      beforeUpdate,
      updated,
    } = componentOptions;
    const [props, attrs] = resolveProps(propsOption, vnode.props);
    beforeCreate && beforeCreate();
    const state = reactive(data());
    const slots = vnode.children || {};
    const instance = {
      state,
      isMounted: false,
      subTree: null,
      props: shallowReactive(props),
      slots,
    };
    function emits(event, ...payload) {
      const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
      const handler = instance.props[eventName];
      if (handler) {
        handler(...payload);
      } else {
        console.error("事件不存在");
      }
    }

    const setupContext = { attrs, emits, slots };
    setCurrentInstance(instance);
    const setupResult = setup(shallowReadonly(instance.props), setupContext);
    setCurrentInstance(null);
    let setupState = null;
    if (typeof setupResult === "function") {
      if (render) {
        console.error("setup返回为函数,render将被忽略");
      }
      render = setupResult;
    } else {
      setupState = setupResult;
    }
    const renderContext = new Proxy(instance, {
      get(t, k, r) {
        if (k === "$slots") return t.slots;
        const { state, props } = t;
        if (state && k in state) {
          return state[k];
        } else if (k in props) {
          return props[k];
        } else if (setupState && k in setupState) {
          return setupState[k];
        } else {
          console.log("no exist K");
        }
      },
      set(t, k, v, r) {
        const { state, props } = t;
        if (state && k in state) {
          state[k] = v;
        } else if (k in props) {
          props[k] = v;
        } else if (setupState && k in setupState) {
          setupState[k] = v;
        } else {
          console.log("no exist K");
        }
      },
    });
    created && created.call(renderContext);
    vnode.component = instance;
    effect(
      () => {
        beforeMount && beforeMount.call(renderContext);
        const subTree = render.call(renderContext, renderContext);
        if (!instance.isMounted) {
          patch(null, subTree, container, anchor);
          instance.isMounted = true;
        } else {
          beforeUpdate && beforeUpdate.call(renderContext);
          patch(instance.subTree, subTree, container, anchor);
          updated && updated.call(renderContext);
        }
        instance.subTree = subTree;
        mounted && mounted.forEach((cb) => cb.call(renderContext));
      },
      { scheduler: queueJob }
    );
  }
  function patchComponent(n1, n2, anchor) {
    const instance = (n2.instance = n1.instance); //信息都保存在instance上，更新组件，首先把instance传递
    const { props } = instance;
    if (hasPropsChanged(n1.props, n2.props)) {
      // 因为prop 是响应式的，每次修改的时候，会触发组件更新
      for (const key in n2.props) {
        const [nextProps] = resolveProps(n2.type.props, n2.props);
        for (const k in nextProps) {
          if (k in props) {
            props[k] = nextProps[props];
          }
        }
        for (const k in props) {
          if (!(k in nextProps)) {
            delete props[k];
          }
        }
      }
    }
  }
}

const renderer = createRenderer({
  createElement(tag) {
    return document.createElement(tag);
  },
  setElementText(el, text) {
    el.textContent = text;
  },
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor);
  },
  patchProps(el, key, nextValue) {
    if (/^on/.test(key)) {
      const invokers = el._vei || (el._vei = {});
      let invoker = invokers[key];
      const name = key.splice(2).toLowerCase();
      if (nextValue) {
        if (!invoker) {
          invoker = el._vei[key] = (e) => {
            if (e.timeStamp < invoker.attached) return; // 阻止掉绑定之前 所触发的时间，防止出现更新 时机问题
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach((fn) => {
                fn(e);
              });
            } else {
              invoker.value(e);
            }
          };
          invoker.value = nextValue;
          invoker.attached = performance.now();
          el.addEventListener(name, invoker);
        } else {
          invoker.value = nextValue;
        }
      } else if (invoker) {
        el.removeElement(name, invoker);
      }
    }
    if (key === "class") {
      // 处理 html attribute 与 DOM Attribute 的不同
      // 使用className 性能最好,style 也做了处理，这里未实现。 normalizeClass 这里未实现。
      el.className = nextValue;
      return;
    }
    if (key === "style") {
      //使用CSSStyleDeclaration的cssText 进行改变style
      el.style.cssText = nextValue;
      return;
    }
    if (shouldSetAsProps(el, key, nextValue)) {
      const type = typeof el[key];
      if (type === "boolean" && nextValue === "") {
        // 特征 例如disable, <input disable>不赋值时应该也是生效，所以做特殊处理。
        el[key] = true;
      } else {
        el[key] = nextValue;
      }
    } else {
      el.setAttribute(key, nextValue);
    }
  },
  creatText(text) {
    return document.createTextNode(text);
  },
  setText(el, text) {
    el.nodeValue = text;
  },
});
function shouldSetAsProps(el, key, nextValue) {
  // 只读特征，不能用el[key]处理，需要setAttribute。需要做特殊处理，此处只列举出一项。
  if (key === "form" && el.tagName === "input") return false;
  return key in el;
}

function diffSimple(n1, n2, container) {
  const oldChildren = n1.children;
  const newChildren = n2.children;
  // const minLength = Math.min(oldChildren.length,newChildren.length)
  let lastIndex = 0;
  for (let i = 0; i < newChildren.length; i++) {
    let find = false;
    for (let j = 0; j < newChildren.length; j++) {
      if (newChildren[i].key === oldChildren[j].key) {
        find = true;
        patch(oldChildren[j], newChildren[i], container);
        if (j < lastIndex) {
          const node = newChildren[i - 1];
          if (node) {
            //如果不存在 就是第一个节点  不需要移动
            const anchor = node.el.nextSibling;
            insert(newChildren[i].el, container, anchor);
          }
        } else {
          lastIndex = j;
        }
      }
    }
    if (!find) {
      const anchor = children[i - 1]
        ? children[i - 1].el.nextSibling
        : container.firstChild;
      patch(null, newChildren[i], container, anchor);
    }
  }
  for (let index = 0; index < oldChildren.length; index++) {
    let key = oldChildren[index].key;
    let has = newChildren.find((x) => x.key === key);
    if (!has) {
      unmount(oldChildren[index]);
    }
  }
}

function doubleEndedDiff(n1, n2, container) {
  // 双端diff ,对比双端，然后往中间回缩。
  const oldChildren = n1.children;
  const newChildren = n2.children;
  let oldStartIdx = 0;
  let newStartIdx = 0;
  let oldEndIdx = oldChildren.length - 1;
  let newEndIdx = newChildren.length - 1;

  while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    if (!oldChildren[oldStartIdx]) {
      oldStartIdx++;
    } else if (!oldChildren[oldEndIdx]) {
      oldEndIdx--;
    } else if (oldChildren[oldStartIdx].key === newChildren[newStartIdx].key) {
      patch(oldChildren[oldStartIdx], newChildren[newStartIdx], container);
      oldStartIdx++;
      newStartIdx++;
    } else if (oldChildren[oldEndIdx].key === newChildren[newEndIdx].key) {
      patch(oldChildren[oldEndIdx], newChildren[newEndIdx], container);
      oldEndIdx--;
      newEndIdx--;
    } else if (oldChildren[oldStartIdx].key === newChildren[newEndIdx].key) {
      patch(oldChildren[oldStartIdx], newChildren[newEndIdx], container);
      const p = newEndIdx + 1;
      const anchor = oldChildren.el.nextSibling;
      insert(oldChildren[oldStartIdx].el, container, anchor);
      oldStartIdx++;
      newEndIdx--;
    } else if (oldChildren[oldEndIdx].key === newChildren[newStartIdx].key) {
      patch(oldChildren[oldEndIdx], newChildren[newStartIdx], container);
      insert(oldChildren[oldEndIdx].el, container, oldChildren[oldStartIdx]);
      newStartIdx++;
      oldEndIdx--;
    } else {
      for (let index = oldStartIdx + 1; index < oldEndIdx; index++) {
        if (oldChildren[index].key === newChildren[newStartIdx].key) {
          patch(oldChildren[index], newChildren[newStartIdx], container);
          const p = newStartIdx - 1;
          const anchor = oldChildren[oldStartIdx].el;
          insert(oldChildren[oldStartIdx].el, container, anchor);
          oldChildren[index] = undefined;
          newStartIdx++;
          break;
        }
      }
    }
  }
  if (oldStartIdx > oldEndIdx && newStartIdx <= newEndIdx) {
    for (let index = newStartIdx; index <= newEndIdx; index++) {
      patch(null, newChildren[index], container, oldChildren[oldStartIdx]);
    }
  }
  if (oldStartIdx <= oldEndIdx && newStartIdx > newEndIdx) {
    for (let index = oldStartIdx; index <= oldEndIdx; index++) {
      unmount(oldChildren[index]);
    }
  }
}

function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
function resolveProps(options, propsData) {
  const props = {};
  const attrs = {};
  Object.keys(propsData).forEach((k) => {
    if (k in options || key.startWith("on")) {
      props[k] = propsData[k];
    } else {
      attrs[k] = propsData[k];
    }
  });
  return [props, attrs];
}
function hasPropsChanged(preProps, nextPros) {
  const nextKeys = Object.keys(nextPros);
  if (nextKeys.length !== Object.keys(preProps).length) return true;

  for (let i = 0; i < nextKeys.length; i++) {
    const k = nextKeys[i];
    if (nextPros[k] !== preProps[k]) return true;
  }
  return false;
}
function onMounted(fn) {
  if (currentInstance) {
    currentInstance.mounted && currentInstance.mounted.push(fn);
  } else {
    console.error("onMounted只能在setup中调用");
  }
}
