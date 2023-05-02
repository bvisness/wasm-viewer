import type { MemoryType, Global, BinaryError } from "../wasm-tools/pkg/wasm_viewer";

export interface FuncInfo {
    size: number;
}

export interface CustomSection {
    type: "Custom";
    size: number;
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

export type Section = CustomSection | MemorySection | GlobalSection | CodeSection;

export interface Module {
    sections: Section[];
}
