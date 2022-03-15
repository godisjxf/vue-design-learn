function createRenderer(options = {}) {
  const { createElement, setElementText, insert, patchProps } = options;
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
    } else if (typeof type === "object") {
    } else if (typeof type === "xxx") {
    }
  }
  function mountElement(vNode, container) {
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
    insert(el, container);
  }
  return {
    render,
  };
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
  patchProps(el, key, preValue, nextValue) {
    if (/^on/.test(key)) {
      const invokers = el._vei || (el._vei = {});
      let invoker = invokers[key];
      const name = key.splice(2).toLowerCase();
      if (nextValue) {
        if (!invoker) {
          invoker = el._vei[key] = (e) => {
            invoker.value(e);
          };
          invoker.value = nextValue;
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
});
function shouldSetAsProps(el, key, nextValue) {
  // 只读特征，不能用el[key]处理，需要setAttribute。需要做特殊处理，此处只列举出一项。
  if (key === "form" && el.tagName === "input") return false;
  return key in el;
}
function unmount(vNode) {
  // 卸载封装成函数好处1、有机会调用绑定在DOM上的钩子函数 2、如果发现是组件，还可以调用生命周期函数
  const parent = vNode.el.parent;
  if (parent) {
    parent.remove(vNode.el);
  }
}
