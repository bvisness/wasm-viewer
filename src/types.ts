import type {
  BinaryError,
  CustomSection as WasmCustomSection,
  Data,
  Element,
  Export,
  Function,
  Global,
  Import,
  ImportSection as WasmImportSection,
  MemoryType,
  RefType,
  Table,
  Type,
  ValType,
  Name,
  FunctionBody,
  FuncType,
  HeapType,
} from "../wasm-tools/pkg/wasm_viewer";
import { assertUnreachable } from "./util";

export interface CustomSection {
    type: "Custom";
    custom: WasmCustomSection;

    names?: Array<Name | BinaryError>;
}

export interface TypeSection {
    type: "Type";
    types: Array<Type | BinaryError>;
}

export interface ImportSection {
    type: "Import";
    imports: WasmImportSection;
}

export interface FunctionSection {
    type: "Function";
    functions: Array<Function | BinaryError>;
}

export interface TableSection {
    type: "Table";
    tables: Array<Table | BinaryError>;
}

export interface MemorySection {
    type: "Memory";
    mems: Array<MemoryType | BinaryError>;
}

export interface GlobalSection {
    type: "Global";
    globals: Array<Global | BinaryError>;
}

export interface ExportSection {
    type: "Export";
    exports: Array<Export | BinaryError>;
}

export interface StartSection {
    type: "Start";
    func: number;
}

export interface ElementSection {
    type: "Element";
    elements: Array<Element | BinaryError>;
}

export interface CodeSection {
    type: "Code";
    funcs: Array<FunctionBody | BinaryError>;
}

export interface DataSection {
    type: "Data";
    datas: Array<Data | BinaryError>;
}

export interface DataCountSection {
    type: "DataCount";
    numDataSegments: number;
}

export type Section =
    CustomSection
    | TypeSection
    | ImportSection
    | FunctionSection
    | TableSection
    | MemorySection
    | GlobalSection
    | ExportSection
    | StartSection
    | ElementSection
    | CodeSection
    | DataSection
    | DataCountSection;

export class Module {
  sections: Section[];

  constructor(sections: Section[]) {
    this.sections = sections;
  }

  section<Type extends Section["type"]>(type: Type): (Section & { type: Type }) | undefined {
    for (const section of this.sections) {
      if (section.type === type) {
        return section as Section & { type: Type };
      }
    }
  }

  type(index: number): Type | undefined {
    const typeSection = this.section("Type");
    if (!typeSection) {
      return undefined;
    }

    const t = typeSection.types[index];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (t && !t.is_error) {
      return t;
    }

    return undefined;
  }
}

export function valTypeToString(t: ValType): string {
  switch (t.kind) {
    case "ref_type": return refTypeToString(t.ref_type);
    default: return t.kind;
  }
}

export function refTypeToString(t: RefType): string {
  switch (t.heap_type.kind) {
    case "typed_func":
      return t.nullable ? `(ref null ${t.heap_type.typed_func})` : `$(ref ${t.heap_type.typed_func})`;
    case "func":
      return t.nullable ? "funcref" : "(ref func)";
    case "extern_":
      return t.nullable ? "externref" : "(ref extern)";
    case "any":
      return t.nullable ? "anyref" : "(ref any)";
    case "none":
      return t.nullable ? "noneref" : "(ref none)";
    case "noextern":
      return t.nullable ? "noexternref" : "(ref noextern)";
    case "nofunc":
      return t.nullable ? "nofuncref" : "(ref nofunc)";
    case "eq":
      return t.nullable ? "eqref" : "(ref eq)";
    case "struct_":
      return t.nullable ? "structref" : "(ref struct)";
    case "array":
      return t.nullable ? "arrayref" : "(ref array)";
    case "i31":
      return t.nullable ? "i31ref" : "(ref i31)";
    default:
      return assertUnreachable(t.heap_type);
  }
}

export function funcTypeToString(f: FuncType): string {
  const params = f.params_results.slice(0, f.len_params);
  const results = f.params_results.slice(f.len_params);
  let str = "func";
  if (params.length > 0) {
    str += ` (param ${params.map(p => valTypeToString(p)).join(" ")})`;
  }
  if (results.length > 0) {
    str += ` (result ${results.map(r => valTypeToString(r)).join(" ")})`;
  }
  return str;
}

export function memoryTypeToString(mem: MemoryType): string {
  const parts = [];
  if (mem.initial === mem.maximum) {
    parts.push(`exactly ${mem.initial} pages`);
  } else {
    parts.push(`${mem.initial} pages`);
    parts.push(mem.maximum ? `max ${mem.maximum} pages` : "no max");
  }
  parts.push(mem.memory64 ? "64-bit" : "32-bit");
  parts.push(mem.shared ? "shared" : "not shared");
  return parts.join(", ");
}

export const WASM_PAGE_SIZE = 65536;

export function bytesToString(numBytes: bigint): string {
  const fmt = new Intl.NumberFormat();
  if (numBytes >= 1024 * 1024 * 1024) {
    return `${fmt.format(numBytes / BigInt(1024 * 1024 * 1024))} GiB`;
  } else if (numBytes >= 1024 * 1024) {
    return `${fmt.format(numBytes / BigInt(1024 * 1024))} MiB`;
  } else if (numBytes >= 1024) {
    return `${fmt.format(numBytes / BigInt(1024))} KiB`;
  } else {
    return `${fmt.format(numBytes)} bytes`;
  }
}
