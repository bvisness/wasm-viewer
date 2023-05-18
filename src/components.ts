export type WVNode = Node | string;
export type WVNodes = WVNode | WVNode[];

export function N(v: WVNode): Node {
  if (typeof v === "string") {
    return document.createTextNode(v);
  }
  return v;
}

function addChildren(n: Node, children: WVNodes) {
  if (Array.isArray(children)) {
    for (const child of children) {
      n.appendChild(N(child));
    }
  } else {
    n.appendChild(N(children));
  }
}

export function E(type: keyof HTMLElementTagNameMap, classes: string[], children: WVNodes): Node {
  const el = document.createElement(type);
  if (classes.length > 0) {
    el.classList.add(...classes);
  }
  addChildren(el, children);
  return el;
}

export function F(children: WVNodes): Node {
  const f = document.createDocumentFragment();
  addChildren(f, children);
  return f;
}

export function Items(it: Node[]): Node {
  const el = document.createElement("div");
  el.classList.add("flex", "flex-column", "g2");
  for (const item of it) {
    el.appendChild(item);
  }
  return el;
}

export function WasmError(msg: string): Node {
  const el = document.createElement("div");
  el.classList.add("item", "wasm-error", "pa2");
  el.innerText = msg;
  return el;
}

export function Toggle(props: {
  title: Node | string,
  children: WVNodes,
}): Node {
  const outer = document.createElement("div");
  outer.classList.add("toggle", "item", "flex", "items-start", "ba", "br1", "b--dim");

  const toggler = document.createElement("div");
  toggler.innerText = ">";
  toggler.classList.add("toggle-toggler", "pa2");
  outer.appendChild(toggler);

  const inner = document.createElement("div");
  inner.classList.add("flex", "flex-column", "flex-grow-1", "pv2", "pr2");
  inner.appendChild(N(props.title));
  outer.appendChild(inner);

  const contents = document.createElement("div");
  contents.classList.add("toggle-contents", "pt2");
  addChildren(contents, props.children);
  inner.appendChild(contents);

  toggler.addEventListener("click", () => {
    outer.classList.toggle("open");
  });

  return outer;
}

export function TypeRef(props: {
  index: number,
  text?: string,
}): Node {
  const el = document.createElement("span");
  el.innerText = `${props.text ?? props.index}`;
  el.classList.add("type-ref");
  el.setAttribute("data-type-index", `${props.index}`);
  return el;
}