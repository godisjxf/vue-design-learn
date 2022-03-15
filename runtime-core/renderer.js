function createRenderer(options = {}) {
  const { createElement, setElementText, insert, patchProps } = options;
  function render(vNode, container) {
    if (vNode) {
      patch(container._vNode, vNode, container);
    } else {
      if (container._vNode) {
        container.innerHTMl = "";
      }
    }
    container._vNode = vNode;
  }
  function patch(n1, n2, container) {
    if (!n1) {
      mountElement(n2, container);
    } else {
    }
  }
  function mountElement(vNode, container) {
    const el = createElement(vNode.tag);
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
    // 处理 html attribute 与 DOM Attribute 的不同
    if (key === "class") {
      // 使用className 性能最好
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
