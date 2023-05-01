import type { MemoryType } from "../wasm-tools/pkg/wasm_viewer";

export interface FuncInfo {
    size: number;
}

export interface CustomSection {
    type: "Custom";
    size: number;
}

export interface MemorySection {
    type: "Memory";
    mems: MemoryType[];
}

export interface CodeSection {
    type: "Code";
    funcs: FuncInfo[];
}

export type Section = CustomSection | MemorySection | CodeSection;

export interface Module {
    sections: Section[];
}
