import { parse } from "./parse";
import wasmUrl from "../wasm-tools/pkg/wasm_viewer_bg.wasm";
import wasmInit, { BinaryError, Import, IndirectNamingResultArray, NamingResultArray } from "../wasm-tools/pkg";
import { refTypeToString, valTypeToString } from "./types";
import { E, F, Items, Toggle, TypeRef, WVNode, WasmError } from "./components";

async function init() {
    const url = wasmUrl as unknown as string;
    await wasmInit(fetch(url));
}
init();

function el(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`no element exists with id '${id}'`);
    }
    return element;
}

const filePicker = el("file-picker") as HTMLInputElement & { files: FileList };
const doButton = el("doeet");
const sections = el("sections");

function updatePickerUI() {
    if (filePicker.files.length === 0) {
        doButton.setAttribute("disabled", "disabled");
    } else {
        doButton.removeAttribute("disabled");
    }
}
filePicker.addEventListener("change", () => updatePickerUI());
updatePickerUI();

doButton.addEventListener("click", async () => {
    if (filePicker.files.length === 0) {
        return;
    }

    function p(msg: string) {
        const el = document.createElement("p");
        el.innerText = msg;
        return el;
    }
    function plain(type: string, msg: string) {
        const el = document.createElement(type);
        el.innerText = msg;
        return el;
    }

    const wasmFile = filePicker.files[0];
    const module = await parse(wasmFile.stream());

    sections.innerHTML = "";
    for (const section of module.sections) {
        const sectionEl = document.createElement("div");
        sectionEl.classList.add("section");
        {
            const headerEl = document.createElement("h2");
            headerEl.innerText = `${section.type} Section`;
            sectionEl.appendChild(headerEl);

            switch (section.type) {
                case "Custom": {
                    sectionEl.appendChild(p(`"${section.custom.name}": ${section.custom.data.length} bytes`));
                    if (section.names) {
                        for (const name of section.names) {
                            if (name.is_error) {
                                sectionEl.appendChild(p(`ERROR (offset ${name.offset}): ${name.message}`));
                            } else {
                                sectionEl.appendChild(p("Names:"));

                                function nameMap(name: string, map: NamingResultArray) {
                                    for (const n of map) {
                                        if (n.is_error) {
                                            sectionEl.appendChild(p(`ERROR (offset ${n.offset}): ${n.message}`));
                                        } else {
                                            sectionEl.appendChild(p(`${name} ${n.index}: "${n.name}"`));
                                        }
                                    }
                                }

                                function indirectNameMap(name: string, map: IndirectNamingResultArray) {
                                    for (const outer of map) {
                                        if (outer.is_error) {
                                            sectionEl.appendChild(p(`ERROR (offset ${outer.offset}): ${outer.message}`));
                                        } else {
                                            for (const inner of outer.names) {
                                                if (inner.is_error) {
                                                    sectionEl.appendChild(p(`ERROR (offset ${inner.offset}): ${inner.message}`));
                                                } else {
                                                    sectionEl.appendChild(p(`${name} ${outer.index}.${inner.index}: "${inner.name}"`));
                                                }
                                            }
                                        }
                                    }
                                }

                                switch (name.kind) {
                                    case "module": {
                                        sectionEl.appendChild(p(`Module: "${name.module}"`));
                                    } break;
                                    case "function": {
                                        nameMap("Function", name.function);
                                    } break;
                                    case "local": {
                                        indirectNameMap("Local", name.local);
                                    } break;
                                    case "label": {
                                        indirectNameMap("Label", name.label);
                                    } break;
                                    case "type_": {
                                        nameMap("Type", name.type_);
                                    } break;
                                    case "table": {
                                        nameMap("Table", name.table);
                                    } break;
                                    case "memory": {
                                        nameMap("Memory", name.memory);
                                    } break;
                                    case "global": {
                                        nameMap("Global", name.global);
                                    } break;
                                    case "element": {
                                        nameMap("Element", name.element);
                                    } break;
                                    case "data": {
                                        nameMap("Data", name.data);
                                    } break;
                                    case "unknown": {
                                        sectionEl.appendChild(p(`Unknown name type ${name.unknown.ty}: ${name.unknown.data.length} bytes`));
                                    } break;
                                }
                            }
                        }
                    }
                } break;
                case "Type": {
                    for (const [i, type] of section.types.entries()) {
                        if (type.is_error) {
                            sectionEl.appendChild(WasmError(`ERROR (offset ${type.offset}): ${type.message}`));
                        } else {
                            const parts = [];
                            parts.push(type.kind);
                            if (type.kind === "func") {
                                const funcType = type.func!;
                                for (const [i, vt] of funcType.params_results.entries()) {
                                    const kind = i >= funcType.len_params ? "result" : "param";
                                    parts.push(`${kind} ${valTypeToString(vt)}`);
                                }
                            }
                            sectionEl.appendChild(p(`Type ${i}: ${parts.join(", ")}`));
                        }
                    }
                } break;
                case "Import": {
                    const items: Node[] = [];

                    const importModules: { name: string, imports: Import[] }[] = [];
                    for (const imp of section.imports) {
                        if (imp.is_error) {
                            items.push(WasmError(`ERROR (offset ${imp.offset}): ${imp.message}`));
                            continue;
                        }
                        const existingMod = importModules.find(m => m.name === imp.module);
                        if (existingMod) {
                            existingMod.imports.push(imp);
                        } else {
                            importModules.push({
                                name: imp.module,
                                imports: [imp],
                            });
                        }
                    }

                    for (const importModule of importModules) {
                        items.push(Toggle({
                            title: E("div", [], [
                                E("b", [], importModule.name),
                                ` (${importModule.imports.length} items)`,
                            ]),
                            children: E("div", ["flex", "flex-column", "g2"], importModule.imports.map(imp => {
                                let details: WVNode;
                                switch (imp.ty.kind) {
                                    case "func": {
                                        details = F(["function, ", TypeRef({ index: imp.ty.func, text: `type ${imp.ty.func}` })]);
                                    } break;
                                    case "global": {
                                        details = `${imp.ty.global.mutable ? "mutable " : ""}global`;
                                        // TODO: calculate the global index and mark it in the goto system
                                    } break;
                                    case "memory": {
                                        details = "memory";
                                        // TODO: all the memory info
                                        // TODO: calculate the mem index and mark it in the goto system
                                    } break;
                                    case "table": {
                                        details = "table";
                                        // TODO: all the table info
                                        // TODO: calculate the table index and mark it in the goto system
                                    } break;
                                    case "tag": {
                                        details = "tag";
                                        // TODO: all the tag info
                                        // TODO: calculate the tag index and mark it in the goto system
                                    } break;
                                    default: {
                                        details = "???";
                                    } break;
                                }
                                return E("div", [], [`${imp.name}: `, details]);
                            })),
                        }));
                    }
                    sectionEl.appendChild(Items(items));
                } break;
                case "Function": {
                    for (const [i, func] of section.functions.entries()) {
                        if (func.is_error) {
                            sectionEl.appendChild(p(`ERROR (offset ${func.offset}): ${func.message}`));
                        } else {
                            sectionEl.appendChild(p(`Func ${i}: type ${func.type_idx}`));
                        }
                    }
                } break;
                case "Table": {
                    for (const [i, table] of section.tables.entries()) {
                        if (table.is_error) {
                            sectionEl.appendChild(p(`ERROR (offset ${table.offset}): ${table.message}`));
                        } else {
                            const parts = [];
                            parts.push(`of ${refTypeToString(table.ty.element_type)}`);
                            parts.push(`${table.ty.initial} elements`);
                            if (table.ty.maximum) {
                                parts.push(`up to ${table.ty.maximum} elements`);
                            }
                            sectionEl.appendChild(p(`Table ${i}: ${parts.join(", ")}`));
                        }
                    }
                } break;
                case "Memory": {
                    for (const mem of section.mems) {
                        if (mem.is_error) {
                            sectionEl.appendChild(p(`ERROR (offset ${mem.offset}): ${mem.message}`));
                        } else {
                            const initialStr = `${mem.initial} pages`;
                            const maxStr = mem.maximum !== undefined ? `, max ${mem.maximum} pages` : "";
                            const bitStr = mem.memory64 ? ", 64-bit" : ", 32-bit";
                            const sharedStr = mem.shared ? ", shared" : ", not shared";
                            sectionEl.appendChild(p(`Memory: ${initialStr}${maxStr}${bitStr}${sharedStr}`));
                        }
                    }
                } break;
                case "Global": {
                    for (const [i, global] of section.globals.entries()) {
                        if (global.is_error) {
                            sectionEl.appendChild(p(`ERROR (offset ${global.offset}): ${global.message}`));
                        } else {
                            const parts = [];
                            parts.push(global.ty.content_type.kind);
                            if (global.ty.content_type.kind === "ref_type") {
                                const refType = global.ty.content_type.ref_type!;
                                if (refType.nullable) {
                                    parts.push("nullable");
                                }
                                parts.push(refType.kind);
                                if (refType.kind === "type") {
                                    parts.push(`type ${refType.type_index}`);
                                }
                            }
                            if (global.ty.mutable) {
                                parts.push("mutable");
                            }
                            sectionEl.appendChild(p(`Global ${i}: ${parts.join(", ")}`));
                        }
                    }
                } break;
                case "Export": {
                    for (const [i, exp] of section.exports.entries()) {
                        if (exp.is_error) {
                            sectionEl.appendChild(p(`ERROR (offset ${exp.offset}): ${exp.message}`));
                        } else {
                            sectionEl.appendChild(p(`"${exp.name}": ${exp.kind.kind} ${exp.index}`));
                        }
                    }
                } break;
                case "Start": {
                    sectionEl.appendChild(p(`Start func: ${section.func}`));
                } break;
                case "Element": {
                    for (const [i, element] of section.elements.entries()) {
                        if (element.is_error) {
                            sectionEl.appendChild(p(`ERROR (offset ${element.offset}): ${element.message}`));
                        } else {
                            const parts = [];
                            parts.push(element.kind.kind);
                            if (element.kind.kind === "active") {
                                parts.push(`table ${element.kind.active.table_index}`);
                            }
                            parts.push(`of ${refTypeToString(element.ty)}`);
                            sectionEl.appendChild(p(`Element ${i}: ${parts.join(", ")}`));
                        }
                    }
                } break;
                case "Code": {
                    sectionEl.appendChild(p(`Number of functions: ${section.funcs.length}`));

                    for (const [i, func] of section.funcs.entries()) {
                        if (func.is_error) {
                            sectionEl.appendChild(p(`ERROR (offset ${func.offset}): ${func.message}`));
                        } else {
                            sectionEl.appendChild(plain("h3", `Func ${i}`));
                            for (const op of func.ops) {
                                if (op.is_error) {
                                    sectionEl.appendChild(p(`ERROR (offset ${op.offset}): ${op.message}`));
                                } else {
                                    sectionEl.appendChild(p(op.name));
                                }
                            }
                        }
                    }
                } break;
                case "Data": {
                    for (const [i, data] of section.datas.entries()) {
                        if (data.is_error) {
                            sectionEl.appendChild(p(`ERROR (offset ${data.offset}): ${data.message}`));
                        } else {
                            const parts = [];
                            parts.push(data.kind.kind);
                            if (data.kind.kind === "active") {
                                parts.push(`memory ${data.kind.active.memory_index}`);
                            }
                            parts.push(`${data.data.length} bytes`);
                            sectionEl.appendChild(p(`Data ${i}: ${parts.join(", ")}`));
                        }
                    }
                } break;
                case "DataCount": {
                    sectionEl.appendChild(p(`Num data segments: ${section.numDataSegments}`));
                } break;
            }
        }
        sections.appendChild(sectionEl);
    }
});

export {};
