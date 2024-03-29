import { Naming, NamingResultArray, RefType, ValType } from "../wasm-tools/pkg/wasm_viewer";
import { goto } from "./goto";
import { Module, funcTypeToString, globalTypeToString, refTypeToString, valTypeToString } from "./types";
import { assertUnreachable } from "./util";

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
}): HTMLElement {
  const outer = E("div", ["toggle", "flex", "items-start", "br1"]);
  if (props.item) {
    outer.classList.add("item");
  }

  const toggler = E("div", ["toggle-toggler", "pa2"], ">");
  outer.appendChild(toggler);

  const titleEl = E("div", ["toggle-title", "pv2", "pr2"], props.title);
  const inner = E("div", ["flex", "flex-column", "flex-grow-1"], titleEl);
  outer.appendChild(inner);

  const contents = E("div", ["toggle-contents", "pb2", "pr2"], props.children);
  inner.appendChild(contents);

  addToggleEvents(outer);

  return outer;
}

export function KindChip(props: { kind: string }) {
  let colorClass: string;
  switch (props.kind) {
    case "type": {
      colorClass = "chip-green";
    } break;
    case "import": {
      colorClass = "chip-orange";
    } break;
    case "table": {
      colorClass = "chip-green";
    } break;
    case "memory": {
      colorClass = "chip-red";
    } break;
    case "global": {
      colorClass = "chip-red";
    } break;
    case "func": {
      colorClass = "chip-blue";
    } break;
    default: {
      colorClass = "chip-gray";
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
  ref.addEventListener("click", () => props.goto?.());
  return ref;
}

export function TypeRef(props: {
  module: Module;
  index: number;
  hideName?: boolean;
}): Node {
  const type = props.module.type(props.index);
  if (type) {
    const name = props.module.names.types[props.index];

    let descriptiveName = "";
    const kind = type.t.kind;
    switch (kind) {
      case "func": {
        descriptiveName = funcTypeToString(type.t.func);
      } break;
      default:
        assertUnreachable(kind);
    }

    return Reference({
      text: ((name && !props.hideName) ? name : undefined) ?? descriptiveName,
      tooltip: `type ${props.index}`,
      goto: () => goto({ kind: "type", index: props.index }),
    });
  } else {
    return Reference({
      text: `type ${props.index} (invalid)`,
    });
  }
}

export function FunctionRef(props: {
  module: Module;
  index: number;
  hideName?: boolean;
}): Node {
  const typeIndex = props.module.functionType(props.index);
  if (typeIndex !== undefined) {
    const type = props.module.type(typeIndex)?.t.func;
    const typeStr = type ? funcTypeToString(type) : `type ${typeIndex} (invalid)`;

    const name = props.module.names.funcs[props.index];
    if (name && !props.hideName) {
      return Reference({
        text: `function ${name}`,
        tooltip: `function ${props.index}, ${typeStr}`,
        // TODO: goto
      });
    } else {
      return Reference({
        text: `function ${props.index}`,
        tooltip: typeStr,
        // TODO: goto
      });
    }
  } else {
    return Reference({
      text: `function ${props.index} (invalid)`,
    });
  }
}

export function ValTypeRef(props: {
  module: Module;
  type: ValType;
}): Node {
  switch (props.type.kind) {
    case "ref_type": {
      return RefTypeRef({ module: props.module, type: props.type.ref_type });
    }
    default: {
      return E("span", [], valTypeToString(props.type));
    }
  }
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
      const displayType = refTypeToString(props.type, true);
      const tooltipType = refTypeToString(props.type, false);
      if (displayType !== tooltipType) {
        return Tip({ text: displayType, tooltip: tooltipType });
      } else {
        return E("span", [], displayType);
      }
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

export function MemoryRef(props: {
  index: number;
}): Node {
  return Reference({
    text: `memory ${props.index}`,
    // TODO: goto
  });
}

export function GlobalRef(props: {
  module: Module;
  index: number;
}): Node {
  // TODO: The type we discover may be invalid if there were errors decoding imports.
  const type = props.module.globalType(props.index);
  if (type) {
    return Reference({
      text: `global ${props.index}`,
      tooltip: globalTypeToString(type),
      // TODO: goto
    });
  } else {
    return Reference({
      text: `global ${props.index} (invalid)`,
    });
  }
}

export function ElementSegmentRef(props: {
  index: number;
}): Node {
  return Reference({
    text: `element segment ${props.index}`,
    // TODO: goto
  });
}

export function DataSegmentRef(props: {
  index: number;
}): Node {
  return Reference({
    text: `data segment ${props.index}`,
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

export function NameSection(props: {
  title: string;
  names: NamingResultArray;
  ref: (n: Naming) => WVNode;
}): Node {
  return Toggle({
    title: E("div", ["b"], props.title),
    children: E("div", ["flex", "flex-column", "g2", "overflow-hidden"], props.names.map(n => {
      if (n.is_error) {
        return WasmError(`ERROR (offset ${n.offset}): ${n.message}`);
      } else {
        return E("div", ["flex", "flex-column", "g1", "overflow-hidden"], [
          E("div", ["overflow-x-auto"], n.name),
          E("div", ["f--small"], props.ref(n)),
        ]);
      }
    })),
  });
}

export function ScrollPadder(): Node {
  return E("div", ["scroll-padder"], undefined);
}
