export interface FuncInfo {
    size: number;
}

export interface CustomSection {
    type: "Custom";
    size: number;
}

export interface CodeSection {
    type: "Code";
    funcs: FuncInfo[];
}

export type Section = CustomSection | CodeSection;

export interface Module {
    sections: Section[];
}
