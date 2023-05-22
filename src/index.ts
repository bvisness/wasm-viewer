import { parse } from "./parse";
import wasmUrl from "../wasm-tools/pkg/wasm_viewer_bg.wasm";
import wasmInit, { BinaryError, Export, Import, IndirectNamingResultArray, NamingResultArray } from "../wasm-tools/pkg";
import { Module, WASM_PAGE_SIZE, bytesToString, funcTypeToString, memoryTypeToString, refTypeToString, valTypeToString } from "./types";
import { E, F, FunctionRef, ItemCount, Items, KindChip, N, RefTypeRef, Reference, TableRef, Tip, Toggle, TypeRef, WVNode, WasmError, addToggleEvents } from "./components";
import { assertUnreachable } from "./util";

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

let module: Module;

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
  module = await parse(wasmFile.stream());

  sections.innerHTML = "";
  for (const section of module.sections) {
    const sectionContents = E("div", ["toggle-contents"], []);

    const headerEl = E("div", ["toggle-title", "ma0", "mt2", "flex", "g2"], [
      E("b", [], `${section.type} Section`),
    ]);
    const sectionEl = E("div", ["section", "toggle", "open", "flex", "items-start"], [
      E("div", ["toggle-toggler", "pa2"], ">"),
      E("div", ["flex-grow-1", "flex", "flex-column", "g2"], [
        headerEl,
        sectionContents,
      ]),
    ]);

    switch (section.type) {
      case "Custom": {
        sectionContents.appendChild(p(`"${section.custom.name}": ${section.custom.data.length} bytes`));
        if (section.names) {
          for (const name of section.names) {
            if (name.is_error) {
              sectionContents.appendChild(p(`ERROR (offset ${name.offset}): ${name.message}`));
            } else {
              sectionContents.appendChild(p("Names:"));

              const nameMap = (name: string, map: NamingResultArray) => {
                for (const n of map) {
                  if (n.is_error) {
                    sectionContents.appendChild(p(`ERROR (offset ${n.offset}): ${n.message}`));
                  } else {
                    sectionContents.appendChild(p(`${name} ${n.index}: "${n.name}"`));
                  }
                }
              };

              const indirectNameMap = (name: string, map: IndirectNamingResultArray) => {
                for (const outer of map) {
                  if (outer.is_error) {
                    sectionContents.appendChild(p(`ERROR (offset ${outer.offset}): ${outer.message}`));
                  } else {
                    for (const inner of outer.names) {
                      if (inner.is_error) {
                        sectionContents.appendChild(p(`ERROR (offset ${inner.offset}): ${inner.message}`));
                      } else {
                        sectionContents.appendChild(p(`${name} ${outer.index}.${inner.index}: "${inner.name}"`));
                      }
                    }
                  }
                }
              };

              switch (name.kind) {
                case "module": {
                  sectionContents.appendChild(p(`Module: "${name.module}"`));
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
                  sectionContents.appendChild(p(`Unknown name type ${name.unknown.ty}: ${name.unknown.data.length} bytes`));
                } break;
              }
            }
          }
        }
      } break;
      case "Type": {
        headerEl.appendChild(ItemCount(section.types.length));

        const items: Node[] = [];
        for (const [i, type] of section.types.entries()) {
          if (type.is_error) {
            items.push(WasmError(`ERROR (offset ${type.offset}): ${type.message}`));
          } else {
            let details: string;
            switch (type.kind) {
              case "func": {
                details = funcTypeToString(type.func);
              } break;
            }
            items.push(E("div", ["item", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Type ${i}`),
              E("div", [], details),
            ]));
          }
        }
        sectionContents.appendChild(Items(items));
        sectionEl.classList.remove("open");
      } break;
      case "Import": {
        headerEl.appendChild(ItemCount(section.imports.imports.length));

        const items: Node[] = [];

        const importModules: { name: string; imports: Import[] }[] = [];
        for (const imp of section.imports.imports) {
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
            item: true,
            title: E("div", ["flex", "g2"], [
              E("b", [], importModule.name),
              ItemCount(importModule.imports.length),
            ]),
            children: E("div", ["import-export-grid"], importModule.imports.map(imp => {
              let details: WVNode;
              switch (imp.ty.kind) {
                case "func": {
                  details = TypeRef({ module: module, index: imp.ty.func });
                } break;
                case "global": {
                  details = `${imp.ty.global.mutable ? "mutable " : ""}global`;
                  // TODO: calculate the global index and mark it in the goto system
                } break;
                case "memory": {
                  details = E("span", [], memoryTypeToString(imp.ty.memory));
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
              return F([
                E("div", ["tr"], [
                  KindChip({ kind: imp.ty.kind }),
                ]),
                E("div", ["flex", "items-start", "g2"], [
                  E("div", ["flex", "flex-column", "g1"], [
                    imp.name,
                    E("div", ["f--small"], details),
                  ]),
                ]),
              ]);
            })),
          }));
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "Function": {
        headerEl.appendChild(ItemCount(section.functions.length));

        const items: Node[] = [];
        for (const [i, func] of section.functions.entries()) {
          if (func.is_error) {
            items.push(WasmError(`ERROR (offset ${func.offset}): ${func.message}`));
          } else {
            // TODO: function names
            items.push(E("div", ["item", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Function ${i}`),
              E("div", [], TypeRef({ module: module, index: func.type_idx })),
            ]));
          }
        }
        sectionContents.appendChild(Items(items));
        sectionEl.classList.remove("open");
      } break;
      case "Table": {
        headerEl.appendChild(ItemCount(section.tables.length));

        const items: Node[] = [];
        for (const [i, table] of section.tables.entries()) {
          if (table.is_error) {
            items.push(WasmError(`ERROR (offset ${table.offset}): ${table.message}`));
          } else {
            // TODO: table names?
            const initStr = `${table.ty.initial} elements`;
            const maxStr = table.ty.maximum ? `, max ${table.ty.maximum} elements` : ", no max";
            items.push(E("div", ["item", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Table ${i}`),
              E("div", [], ["of ", RefTypeRef({ module: module, type: table.ty.element_type })]),
              E("div", [], `${initStr}${maxStr}`),
              // TODO: "initialized by" for active segments
            ]));
          }
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "Memory": {
        headerEl.appendChild(ItemCount(section.mems.length));

        const items: Node[] = [];
        for (const [i, mem] of section.mems.entries()) {
          if (mem.is_error) {
            items.push(WasmError(`ERROR (offset ${mem.offset}): ${mem.message}`));
          } else {
            // TODO: memory names?
            const details = E("div", []);
            const memEl = E("div", ["item", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Memory ${i}`),
              details,
            ]);
            if (mem.initial === mem.maximum) {
              details.appendChild(Tip({
                text: `exactly ${mem.initial} pages`,
                tooltip: `${bytesToString(mem.initial * BigInt(WASM_PAGE_SIZE))} (initial = max)`,
              }));
            } else {
              details.appendChild(Tip({
                text: `${mem.initial} pages`,
                tooltip: bytesToString(mem.initial * BigInt(WASM_PAGE_SIZE)),
              }));
              if (mem.maximum) {
                details.appendChild(N(", max "));
                details.appendChild(Tip({
                  text: `${mem.maximum} pages`,
                  tooltip: bytesToString(mem.maximum * BigInt(WASM_PAGE_SIZE)),
                }));
              } else {
                details.appendChild(N(", no max"));
              }
            }
            details.appendChild(N(mem.memory64 ? ", 64-bit" : ", 32-bit"));
            details.appendChild(N(mem.shared ? ", shared" : ", not shared"));
            // TODO: list relevant data segments (WARNING! there can be a lot of them!)
            items.push(memEl);
          }
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "Global": {
        headerEl.appendChild(ItemCount(section.globals.length));

        for (const [i, global] of section.globals.entries()) {
          if (global.is_error) {
            sectionContents.appendChild(p(`ERROR (offset ${global.offset}): ${global.message}`));
          } else {
            const parts = [];
            parts.push(global.ty.content_type.kind);
            if (global.ty.content_type.kind === "ref_type") {
              // const refType = global.ty.content_type.ref_type!;
              // if (refType.nullable) {
              //   parts.push("nullable");
              // }
              // parts.push(refType.kind);
              // if (refType.kind === "type") {
              //   parts.push(`type ${refType.type_index}`);
              // }
            }
            if (global.ty.mutable) {
              parts.push("mutable");
            }
            sectionContents.appendChild(p(`Global ${i}: ${parts.join(", ")}`));
          }
        }
      } break;
      case "Export": {
        headerEl.appendChild(ItemCount(section.exports.length));

        const goodExports: Export[] = [];
        for (const exp of section.exports) {
          if (exp.is_error) {
            sectionContents.appendChild(WasmError(`ERROR (offset ${exp.offset}): ${exp.message}`));
          } else {
            goodExports.push(exp);
          }
        }

        const exports: Node[] = [];
        for (const exp of goodExports) {
          let details: WVNode;
          switch (exp.kind.kind) {
            // TODO: names of things
            // TODO: references to each thing
            case "func": {
              details = FunctionRef({ index: exp.index });
            } break;
            case "global": {
              details = `global ${exp.index}`;
            } break;
            case "memory": {
              details = `memory ${exp.index}`;
            } break;
            case "table": {
              details = `table ${exp.index}`;
            } break;
            case "tag": {
              details = `tag ${exp.index}`;
            } break;
            default: {
              details = "???";
            } break;
          }
          exports.push(
            E("div", ["tr"], [
              KindChip({ kind: exp.kind.kind }),
            ]),
            E("div", ["flex", "items-start", "g2"], [
              E("div", ["flex", "flex-column", "g1"], [
                exp.name,
                E("div", ["f--small"], details),
              ]),
            ]),
          );
        }
        sectionContents.appendChild(E("div", ["item", "pv2", "ph3", "import-export-grid"], exports));
      } break;
      case "Start": {
        sectionContents.appendChild(p(`Start func: ${section.func}`));
      } break;
      case "Element": {
        headerEl.appendChild(ItemCount(section.elements.length));

        const items: Node[] = [];
        for (const [i, element] of section.elements.entries()) {
          if (element.is_error) {
            items.push(WasmError(`ERROR (offset ${element.offset}): ${element.message}`));
          } else {
            // TODO: element segment items
            const segmentItem = E("div", ["item", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Element Segment ${i}`),
              E("div", [], [`${element.kind.kind}, of `, RefTypeRef({ module: module, type: element.ty })]),
            ]);
            if (element.kind.kind === "active") {
              const active = element.kind.active;
              segmentItem.appendChild(E("div", [], [
                "initializes ", TableRef({ index: active.table_index }),
                // TODO: offset expr (possibly specializing to i32.const)
              ]));
            }
            const itemNodes: Node[] = [];
            switch (element.items.kind) {
              case "functions": {
                for (const funcIdx of element.items.functions) {
                  itemNodes.push(E("div", [], FunctionRef({ index: funcIdx })));
                }
              } break;
              case "expressions": {
                // TODO
              } break;
              default:
                assertUnreachable(element.items);
            }
            segmentItem.appendChild(Toggle({
              title: E("div", [], [
                E("b", ["mr2"], "Items"),
                E("span", [], `(${itemNodes.length} total)`),
              ]),
              children: E("div", ["flex", "flex-column", "g2"], itemNodes),
            }));
            items.push(segmentItem);
          }
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "Code": {
        headerEl.appendChild(ItemCount(section.funcs.length));

        sectionContents.appendChild(p(`Number of functions: ${section.funcs.length}`));

        for (const [i, func] of section.funcs.entries()) {
          if (func.is_error) {
            sectionContents.appendChild(p(`ERROR (offset ${func.offset}): ${func.message}`));
          } else {
            sectionContents.appendChild(plain("h3", `Func ${i}`));
            // for (const op of func.ops) {
            //   if (op.is_error) {
            //     sectionEl.appendChild(p(`ERROR (offset ${op.offset}): ${op.message}`));
            //   } else {
            //     sectionEl.appendChild(p(op.name));
            //   }
            // }
          }
        }
      } break;
      case "Data": {
        headerEl.appendChild(ItemCount(section.datas.length));

        for (const [i, data] of section.datas.entries()) {
          if (data.is_error) {
            sectionContents.appendChild(p(`ERROR (offset ${data.offset}): ${data.message}`));
          } else {
            const parts = [];
            parts.push(data.kind.kind);
            if (data.kind.kind === "active") {
              parts.push(`memory ${data.kind.active.memory_index}`);
            }
            parts.push(`${data.data.length} bytes`);
            sectionContents.appendChild(p(`Data ${i}: ${parts.join(", ")}`));
          }
        }
      } break;
      case "DataCount": {
        sectionContents.appendChild(p(`Num data segments: ${section.numDataSegments}`));
      } break;
    }

    addToggleEvents(sectionEl);
    sections.appendChild(sectionEl);
  }
});

export {};
