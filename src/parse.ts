import { readVarU } from "./leb128";
import { WasmReader } from "./reader";
import { FuncInfo, Module, Section, CustomSection } from "./types";
import {
    parse_code_section,
    parse_custom_section,
    parse_data_section,
    parse_element_section,
    parse_export_section,
    parse_function_body,
    parse_function_section,
    parse_global_section,
    parse_import_section,
    parse_memory_section,
    parse_name_section,
    parse_table_section,
    parse_type_section,
} from "../wasm-tools/pkg/wasm_viewer";

export async function parse(stream: ReadableStream<Uint8Array>): Promise<Module> {
    const reader = new WasmReader(stream);

    async function expect(bytes: number[]) {
        for (const [i, expected] of bytes.entries()) {
            const actual = await reader.getByte(`byte ${expected} (at index ${i} in ${JSON.stringify(bytes)})`);
            if (actual !== expected) {
                throw new Error(`expected byte ${expected} but got ${actual} (at index ${i} in ${JSON.stringify(bytes)})`);
            }
        }
    }

    await expect([0x00, 0x61, 0x73, 0x6D]); // magic: 0asm
    await expect([0x01, 0x00, 0x00, 0x00]); // version: 1
    console.log("it sure is wasm");

    // This is designed to be a very forgiving parser, free of the shackles of real-life engines.
    // This means we don't care about section order, we are generous with opcodes, etc.

    const sections: Section[] = [];

    // Parse sections
    while (true) {
        const sectionID = await reader.getByte("a section id");
        const sectionSize = await readVarU(reader, 32);

        switch (sectionID) {
            case 0: {
                // Custom section
                console.log("Custom section");
                console.log("Getting this many bytes:", sectionSize);
                const offset = reader.cursor;
                const bytes = await reader.getNBytes(sectionSize);
                const custom = parse_custom_section(bytes, offset);

                const sec: CustomSection = {
                    type: "Custom",
                    custom: custom,
                };
                if (sec.custom.name === "name") {
                    console.log("Custom section is name section; parsing that too");
                    sec.names = parse_name_section(custom.data, 0); // TODO: wrong offset
                }

                sections.push(sec);
            } break;
            case 1: {
                // Type section
                console.log("Type section");
                console.log("Getting this many bytes:", sectionSize);
                const offset = reader.cursor;
                const bytes = await reader.getNBytes(sectionSize);
                const types = parse_type_section(bytes, offset);

                sections.push({
                    type: "Type",
                    types: types,
                });
            } break;
            case 2: {
                // Import section
                console.log("Import section");
                console.log("Getting this many bytes:", sectionSize);
                const offset = reader.cursor;
                const bytes = await reader.getNBytes(sectionSize);
                const imports = parse_import_section(bytes, offset);

                sections.push({
                    type: "Import",
                    imports: imports,
                });
            } break;
            case 3: {
                // Function section
                console.log("Function section");
                console.log("Getting this many bytes:", sectionSize);
                const offset = reader.cursor;
                const bytes = await reader.getNBytes(sectionSize);
                const functions = parse_function_section(bytes, offset);

                sections.push({
                    type: "Function",
                    functions: functions,
                });
            } break;
            case 4: {
                // Table section
                console.log("Table section");
                console.log("Getting this many bytes:", sectionSize);
                const offset = reader.cursor;
                const bytes = await reader.getNBytes(sectionSize);
                const tables = parse_table_section(bytes, offset);

                sections.push({
                    type: "Table",
                    tables: tables,
                });
            } break;
            case 5: {
                // Memory section
                console.log("Memory section");
                console.log("Getting this many bytes:", sectionSize);
                const memOffset = reader.cursor;
                const memBytes = await reader.getNBytes(sectionSize);
                const mems = parse_memory_section(memBytes, memOffset);

                sections.push({
                    type: "Memory",
                    mems: mems,
                });
            } break;
            case 6: {
                // Global section
                console.log("Global section");
                console.log("Getting this many bytes:", sectionSize);
                const offset = reader.cursor;
                const bytes = await reader.getNBytes(sectionSize);
                const globals = parse_global_section(bytes, offset);

                sections.push({
                    type: "Global",
                    globals: globals,
                });
            } break;
            case 7: {
                // Export section
                console.log("Export section");
                console.log("Getting this many bytes:", sectionSize);
                const offset = reader.cursor;
                const bytes = await reader.getNBytes(sectionSize);
                const exports = parse_export_section(bytes, offset);

                sections.push({
                    type: "Export",
                    exports: exports,
                });
            } break;
            case 8: {
                // Start section
                console.log("Start section");
                console.log("Getting this many bytes:", sectionSize);
                const startFunc = await readVarU(reader, 32);

                sections.push({
                    type: "Start",
                    func: startFunc,
                });
            } break;
            case 9: {
                // Element section
                console.log("Element section");
                console.log("Getting this many bytes:", sectionSize);
                const offset = reader.cursor;
                const bytes = await reader.getNBytes(sectionSize);
                const elements = parse_element_section(bytes, offset);

                sections.push({
                    type: "Element",
                    elements: elements,
                });
            } break;
            case 10: {
                // Code section
                console.log("Code section");
                console.log("Getting this many bytes:", sectionSize);
                const offset = reader.cursor;
                const bytes = await reader.getNBytes(sectionSize);
                const funcs = parse_code_section(bytes, offset);

                // TODO: Parse functions separately on a thread or whatever

                for (const func of funcs) {
                    if (func.is_error) {
                        continue;
                    }
                    const start = func.range.start - offset;
                    const end = start + (func.range.end - func.range.start);
                    const funcBytes = bytes.slice(start, end);
                    func.ops = parse_function_body(funcBytes, func.range.start);
                }

                sections.push({
                    type: "Code",
                    funcs: funcs,
                });
            } break;
            case 11: {
                // Data section
                console.log("Data section");
                console.log("Getting this many bytes:", sectionSize);
                const offset = reader.cursor;
                const bytes = await reader.getNBytes(sectionSize);
                const datas = parse_data_section(bytes, offset);

                sections.push({
                    type: "Data",
                    datas: datas,
                });
            } break;
            case 12: {
                // Data count section
                console.log("Data count section");
                console.log("Getting this many bytes:", sectionSize);
                const numDatas = await readVarU(reader, 32);

                sections.push({
                    type: "DataCount",
                    numDataSegments: numDatas,
                });
            } break;
            default: {
                console.log(`Unknown section type ${sectionID}`);
                console.log("Advancing by", sectionSize, "to skip over it");
                await reader.advanceBy(sectionSize);
            } break;
        }

        await reader.getChunkIfDoneWithThisOne();
        if (reader.done) {
            break;
        }
    }

    return {
        sections: sections,
    };
}
