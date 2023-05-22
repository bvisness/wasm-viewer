import { RefType } from "../wasm-tools/pkg/wasm_viewer";
import { Module, funcTypeToString, refTypeToString, valTypeToString } from "./types";

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

export function E<T extends keyof HTMLElementTagNameMap>(type: T, classes: string[], children?: WVNodes) {
  const el = document.createElement(type);
  if (classes.length > 0) {
    el.classList.add(...classes);
  }
  if (children) {
    addChildren(el, children);
  }
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

export function ItemCount(count: number): Node {
  return N(`(${count} item${count === 1 ? "" : "s"})`);
}

export function addToggleEvents(toggle: HTMLElement) {
  function onToggle(e: Event) {
    e.preventDefault();
    toggle.classList.toggle("open");
  }
  toggle.querySelector(".toggle-toggler")?.addEventListener("click", onToggle);
  toggle.querySelector(".toggle-title")?.addEventListener("click", onToggle);
}

export function Toggle(props: {
  title: WVNode;
  item?: boolean;
  children: WVNodes;
}): Node {
  const outer = document.createElement("div");
  outer.classList.add("toggle", "flex", "items-start", "br1");
  if (props.item) {
    outer.classList.add("item");
  }

  const toggler = document.createElement("div");
  toggler.innerText = ">";
  toggler.classList.add("toggle-toggler", "pa2");
  outer.appendChild(toggler);

  const titleEl = E("div", ["toggle-title", "pv2", "pr2"], props.title);
  const inner = E("div", ["flex", "flex-column", "flex-grow-1"], titleEl);
  outer.appendChild(inner);

  const contents = document.createElement("div");
  contents.classList.add("toggle-contents", "pb2", "pr2");
  addChildren(contents, props.children);
  inner.appendChild(contents);

  addToggleEvents(outer);

  return outer;
}

export function KindChip(props: { kind: string }) {
  let colorClass: string;
  switch (props.kind) {
    case "memory": {
      colorClass = "chip-red";
    } break;
    case "func":
    default: {
      colorClass = "chip-blue";
    } break;
  }
  return E("span", ["chip", colorClass], props.kind);
}

export function Tooltip(msg: string): Node {
  return E("div", ["tooltip"], [
    E("div", ["tooltip-content"], msg),
  ]);
}

export function Reference(props: {
  text: string;
  tooltip?: string;
  goto?: () => void;
}): Node {
  const ref = E("span", ["reference", "br2", "relative"], props.text);
  if (props.tooltip) {
    ref.appendChild(Tooltip(props.tooltip));
  }
  return ref;
}

export function TypeRef(props: {
  module: Module;
  index: number;
}): Node {
  const type = props.module.type(props.index);
  if (type) {
    switch (type.kind) {
      case "func": {
        return Reference({
          text: funcTypeToString(type.func),
          tooltip: `type ${props.index}`,
          // TODO: goto
        });
      }
    }
  } else {
    return Reference({
      text: `type ${props.index} (invalid)`,
    });
  }
}

export function FunctionRef(props: {
  index: number;
}): Node {
  return Reference({
    text: `function ${props.index}`,
    // TODO: goto
  });
}

export function RefTypeRef(props: {
  module: Module;
  type: RefType;
}): Node {
  switch (props.type.heap_type.kind) {
    case "typed_func": {
      return E("span", [], [
        `(ref ${props.type.nullable ? "null " : ""}`,
        TypeRef({ module: props.module, index: props.type.heap_type.typed_func }),
        ")"
      ]);
    }
    default: {
      return E("span", [], refTypeToString(props.type));
    }
  }
}

export function TableRef(props: {
  index: number;
}): Node {
  return Reference({
    text: `table ${props.index}`,
    // TODO: goto
  });
}

export function Tip(props: {
  text: string;
  tooltip: string;
}): Node {
  return E("span", ["tip"], [
    props.text,
    Tooltip(props.tooltip),
  ]);
}
