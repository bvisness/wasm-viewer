import { parse } from "./parse";
import wasmUrl from "../wasm-tools/pkg/wasm_viewer_bg.wasm";
import wasmInit, { Export, Import, IndirectNamingResultArray } from "../wasm-tools/pkg";
import { Module, Section, WASM_PAGE_SIZE, bytesToString, funcTypeToString, memoryTypeToString } from "./types";
import { DataSegmentRef, E, ElementSegmentRef, F, FunctionRef, GlobalRef, ItemCount, Items, KindChip, MemoryRef, N, NameSection, RefTypeRef, TableRef, Tip, Toggle, TypeRef, ValTypeRef, WVNode, WasmError, addToggleEvents } from "./components";
import { assertUnreachable } from "./util";

async function init() {
  const url = wasmUrl as unknown as string;
  await wasmInit(fetch(url));
  // TODO: disable UI until this completes
}
init().catch(e => {
  throw e;
});

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
  function indirectNameMap(name: string, map: IndirectNamingResultArray) {
    return Toggle({
      title: name,
      children: map.map(outer => {
        if (outer.is_error) {
          return WasmError(`ERROR (offset ${outer.offset}): ${outer.message}`);
        } else {
          return Toggle({
            title: `${outer.index}`,
            children: outer.names.map(inner => {
              if (inner.is_error) {
                return WasmError(`ERROR (offset ${inner.offset}): ${inner.message}`);
              } else {
                return p(`${name} ${outer.index}.${inner.index}: "${inner.name}"`);
              }
            }),
          });
        }
      }),
    });
  }

  const wasmFile = filePicker.files[0];
  module = await parse(wasmFile.stream());

  sections.innerHTML = "";
  for (const section of module.sections) {
    const sectionContents = E("div", ["toggle-contents"], []);

    const headerEl = E("div", ["toggle-title", "ma0", "mt2", "flex", "g2"], [
      E("b", [], sectionName(section)),
    ]);
    const sectionEl = E("div", ["section", "toggle", "flex", "items-start", "overflow-hidden"], [
      E("div", ["toggle-toggler", "pa2"], ">"),
      E("div", ["flex-grow-1", "mw-100", "flex", "flex-column", "g2", "overflow-hidden"], [
        headerEl,
        sectionContents,
      ]),
    ]);

    switch (section.type) {
      case "Custom": {
        const customItem = E("div", ["item", "pa2", "flex", "flex-column"]);

        if (section.names) {
          customItem.classList.remove("pa2");
          customItem.classList.add("ph2");
          for (const name of section.names) {
            if (name.is_error) {
              customItem.appendChild(p(`ERROR (offset ${name.offset}): ${name.message}`));
            } else {
              switch (name.kind) {
                case "module": {
                  customItem.appendChild(p(`Module: "${name.module}"`));
                } break;
                case "function": {
                  customItem.appendChild(NameSection({
                    title: "Functions",
                    names: name.function,
                    ref: n => FunctionRef({ module: module, index: n.index }),
                  }));
                } break;
                case "local": {
                  customItem.appendChild(indirectNameMap("Local", name.local));
                } break;
                case "label": {
                  customItem.appendChild(indirectNameMap("Label", name.label));
                } break;
                case "type_": {
                  customItem.appendChild(NameSection({
                    title: "Types",
                    names: name.type_,
                    ref: n => TypeRef({ module: module, index: n.index }),
                  }));
                } break;
                case "table": {
                  customItem.appendChild(NameSection({
                    title: "Tables",
                    names: name.table,
                    ref: n => TableRef({ index: n.index }),
                  }));
                } break;
                case "memory": {
                  customItem.appendChild(NameSection({
                    title: "Memories",
                    names: name.memory,
                    ref: n => MemoryRef({ index: n.index }),
                  }));
                } break;
                case "global": {
                  customItem.appendChild(NameSection({
                    title: "Globals",
                    names: name.global,
                    ref: n => GlobalRef({ module: module, index: n.index }),
                  }));
                } break;
                case "element": {
                  customItem.appendChild(NameSection({
                    title: "Element Segments",
                    names: name.element,
                    ref: n => ElementSegmentRef({ index: n.index }),
                  }));
                } break;
                case "data": {
                  customItem.appendChild(NameSection({
                    title: "Data Segments",
                    names: name.data,
                    ref: n => DataSegmentRef({ index: n.index }),
                  }));
                } break;
                case "unknown": {
                  customItem.appendChild(p(`Unknown name type ${name.unknown.ty}: ${name.unknown.data.length} bytes`));
                } break;
              }
            }
          }
        } else {
          customItem.appendChild(E("div", [], bytesToString(section.custom.data.byteLength)));
          // TODO: hex viewer for custom section data
        }
        sectionContents.appendChild(customItem);
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

        const items: Node[] = [];
        for (const [i, global] of section.globals.entries()) {
          if (global.is_error) {
            items.push(WasmError(`ERROR (offset ${global.offset}): ${global.message}`));
          } else {
            // TODO: global names
            // TODO: global init expr
            items.push(E("div", ["item", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Global ${i}`),
              E("div", [], [
                global.ty.mutable ? "mutable " : "immutable ",
                ValTypeRef({ module: module, type: global.ty.content_type }),
              ]),
            ]));
          }
        }
        sectionContents.appendChild(Items(items));
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
              details = FunctionRef({ module: module, index: exp.index });
            } break;
            case "global": {
              details = GlobalRef({ module: module, index: exp.index });
            } break;
            case "memory": {
              details = MemoryRef({ index: exp.index });
            } break;
            case "table": {
              details = TableRef({ index: exp.index });
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
                  itemNodes.push(E("div", [], FunctionRef({ module: module, index: funcIdx })));
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

        const items: Node[] = [];
        for (const [i, data] of section.datas.entries()) {
          if (data.is_error) {
            items.push(WasmError(`ERROR (offset ${data.offset}): ${data.message}`));
          } else {
            // TODO: data names
            // TODO: active data offset expr
            // TODO: locations of referencing memory.init instructions
            items.push(E("div", ["item", "pa2", "flex", "flex-column", "g2"], [
              E("div", ["b"], `Data Segment ${i}`),
              E("div", [], data.kind.kind === "active"
                ? ["active, initializes ", MemoryRef({ index: data.kind.active.memory_index })]
                : ["passive"]
              ),
              // TODO: hex viewer for data
              // Toggle({
              //   title: E("div", [], [
              //     E("b", ["mr2"], "Data"),
              //     E("span", [], `(${bytesToString(data.data.byteLength)})`),
              //   ]),
              //   children: E("div", ["flex", "flex-column", "g2"], itemNodes),
              // }),
            ]));
          }
        }
        sectionContents.appendChild(Items(items));
      } break;
      case "DataCount": {
        sectionContents.appendChild(p(`Num data segments: ${section.numDataSegments}`));
      } break;
    }

    addToggleEvents(sectionEl);
    sections.appendChild(sectionEl);
  }
});

function sectionName(section: Section): string {
  switch (section.type) {
    case "Custom":
      return `Custom Section "${section.custom.name}"`;
    case "DataCount":
      return "Data Count Section";
    default:
      return `${section.type} Section`;
  }
}

export {};
