import type { Type, MemoryType, Global, BinaryError, ValType, RefType, Import, Function, Table } from "../wasm-tools/pkg/wasm_viewer";

export interface FuncInfo {
    size: number;
}

export interface CustomSection {
    type: "Custom";
    size: number;
}

export interface TypeSection {
    type: "Type";
    types: Array<Type | BinaryError>;
}

export interface ImportSection {
    type: "Import";
    imports: Array<Import | BinaryError>;
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

export interface CodeSection {
    type: "Code";
    funcs: FuncInfo[];
}

export type Section =
    CustomSection
    | TypeSection
    | ImportSection
    | FunctionSection
    | TableSection
    | MemorySection
    | GlobalSection
    | CodeSection;

export interface Module {
    sections: Section[];
}

export function valTypeToString(t: ValType): string {
    switch (t.kind) {
        case "ref_type": return refTypeToString(t.ref_type!);
        default: return t.kind;
    }
}

export function refTypeToString(t: RefType): string {
    switch (t.kind) {
        case "extern":
            return t.nullable ? "externref" : "(ref extern)";
        case "func":
            return t.nullable ? "funcref" : "(ref func)";
        case "type":
            return t.nullable ? `(ref null ${t.type_index})` : `$(ref ${t.type_index})`
        default:
            return "[unknown ref type]";
    }
}
