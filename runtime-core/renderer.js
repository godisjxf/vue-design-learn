const Text = new Symbol("text");
const Fragment = new Symbol("fragment");
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
  function patch(n1, n2, container, anchor) {
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
      vNode.children.forEach((e) => {
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
    if (typeof n2.children.type === "string") {
      if (Array.isArray(n1.children)) {
        n1.child.forEach((c) => {
          unmount(c);
        });
      } else {
        setElementText(container, n2.children);
      }
    } else if (Array.isArray(n2.children)) {
      if (Array.isArray(n1.children)) {
        diffSimple(n1, n2, container);
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

function doubleEndedDiff(n1, n2, container) {}
