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
} from "../wasm-tools/pkg/wasm_viewer";

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
