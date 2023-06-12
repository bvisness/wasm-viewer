import type {
  BinaryError,
  CustomSection as WasmCustomSection,
  Data,
  Element,
  Export,
  Function,
  Global,
  ImportSection as WasmImportSection,
  MemoryType,
  RefType,
  Table,
  Type,
  ValType,
  Name,
  FunctionBody,
  FuncType,
  GlobalType,
  TableType,
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

export interface ImportedData {
  funcs: Function["type_idx"][];
  tables: TableType[];
  memories: MemoryType[];
  globals: GlobalType[];
}

export class Module {
  sections: Section[];
  imported: ImportedData;

  constructor(sections: Section[]) {
    this.sections = sections;
    this.imported = {
      funcs: [],
      tables: [],
      memories: [],
      globals: [],
    };

    for (const imp of this.section("Import")?.imports.imports ?? []) {
      if (imp.is_error) {
        continue;
      }
      switch (imp.ty.kind) {
        case "func": {
          this.imported.funcs.push(imp.ty.func);
        } break;
        case "table": {
          this.imported.tables.push(imp.ty.table);
        } break;
        case "memory": {
          this.imported.memories.push(imp.ty.memory);
        } break;
        case "global": {
          this.imported.globals.push(imp.ty.global);
        } break;
      }
    }
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

  functionType(index: number): Function["type_idx"] | undefined {
    if (index < this.imported.funcs.length) {
      return this.imported.funcs[index];
    }
    const func = this.section("Function")?.functions[index];
    if (!func?.is_error) {
      return func?.type_idx;
    }
  }

  globalType(index: number): GlobalType | undefined {
    if (index < this.imported.globals.length) {
      return this.imported.globals[index];
    }
    const global = this.section("Global")?.globals[index];
    if (!global?.is_error) {
      return global?.ty;
    }
  }
}

export function valTypeToString(t: ValType): string {
  switch (t.kind) {
    case "ref_type": return refTypeToString(t.ref_type);
    default: return t.kind;
  }
}

export function refTypeToString(t: RefType, shorthand = true): string {
  switch (t.heap_type.kind) {
    case "typed_func":
      return t.nullable ? `(ref null ${t.heap_type.typed_func})` : `$(ref ${t.heap_type.typed_func})`;
    case "func":
      return t.nullable
        ? (shorthand ? "funcref" : "(ref null func)")
        : "(ref func)";
    case "extern_":
      return t.nullable
        ? (shorthand ? "externref" : "(ref null extern)")
        : "(ref extern)";
    case "any":
      return t.nullable
        ? (shorthand ? "anyref" : "(ref null any)")
        : "(ref any)";
    case "none":
      return t.nullable
        ? (shorthand ? "noneref" : "(ref null none)")
        : "(ref none)";
    case "noextern":
      return t.nullable
        ? (shorthand ? "noexternref" : "(ref null noextern)")
        : "(ref noextern)";
    case "nofunc":
      return t.nullable
        ? (shorthand ? "nofuncref" : "(ref null nofunc)")
        : "(ref nofunc)";
    case "eq":
      return t.nullable
        ? (shorthand ? "eqref" : "(ref null eq)")
        : "(ref eq)";
    case "struct_":
      return t.nullable
        ? (shorthand ? "structref" : "(ref null struct)")
        : "(ref struct)";
    case "array":
      return t.nullable
        ? (shorthand ? "arrayref" : "(ref null array)")
        : "(ref array)";
    case "i31":
      return t.nullable
        ? (shorthand ? "i31ref" : "(ref null i31)")
        : "(ref i31)";
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

export function globalTypeToString(ty: GlobalType): string {
  return `${ty.mutable ? "mutable" : "immutable"} ${valTypeToString(ty.content_type)}`;
}

export const WASM_PAGE_SIZE = 65536;

// TODO: do the math without truncating
export function bytesToString(numBytes: number | bigint): string {
  const _numBytes = BigInt(numBytes);
  const fmt = new Intl.NumberFormat();
  let shortened: string | undefined;
  if (numBytes >= 1024 * 1024 * 1024) {
    shortened = `${fmt.format(_numBytes / BigInt(1024 * 1024 * 1024))} GiB`;
  } else if (numBytes >= 1024 * 1024) {
    shortened = `${fmt.format(_numBytes / BigInt(1024 * 1024))} MiB`;
  } else if (numBytes >= 1024) {
    shortened = `${fmt.format(_numBytes / BigInt(1024))} KiB`;
  }

  return `${fmt.format(_numBytes)} bytes${shortened ? ` (${shortened})` : ""}`;
}
